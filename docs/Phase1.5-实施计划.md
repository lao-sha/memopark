# Phase 1.5 完整优化实施计划

**开始时间**: 2025-10-27  
**预计完成**: 2-3天  
**目标**: 完成Phase 1剩余30%工作

---

## 🎯 总体目标

### 核心任务
1. **Holds API完整迁移** - 解决类型兼容性，100%完成
2. **Evidence优化实施** - CID化，降低存储成本74.5%
3. **Subsquid Processor** - 实现GraphQL查询，速度提升100x

### 预期效果
- ✅ Gas成本降低 50-60%
- ✅ 存储成本降低 74.5%
- ✅ 查询速度提升 20-100x
- ✅ 代码质量提升（使用官方API）

---

## 📋 详细任务清单

### Day 1: Holds API完整迁移 ⏱️ 8-12小时

#### Task 1.1: 修改stardust-appeals Config ⏱️ 2小时

**当前问题**：
```rust
// 问题代码
type Currency: Currency<Self::AccountId> 
    + ReservableCurrency<Self::AccountId>
    + fungible::Mutate<Self::AccountId>
    + fungible::MutateHold<Self::AccountId>;
```

**修改方案**：
```rust
// pallets/stardust-appeals/src/lib.rs

#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    
    // 移除Currency trait，改用Fungible
    type Fungible: fungible::Mutate<Self::AccountId>
        + fungible::MutateHold<Self::AccountId, Reason = Self::RuntimeHoldReason>
        + fungible::Inspect<Self::AccountId>
        + fungible::InspectHold<Self::AccountId>;
    
    // 添加RuntimeHoldReason绑定
    type RuntimeHoldReason: From<HoldReason>;
    
    // 其他配置保持不变
    #[pallet::constant]
    type AppealDeposit: Get<BalanceOf<Self>>;
    // ...
}
```

#### Task 1.2: 更新Balance类型别名 ⏱️ 30分钟

```rust
// pallets/stardust-appeals/src/lib.rs

// 旧版
// pub type BalanceOf<T> = <<T as Config>::Currency as Currency<...>>::Balance;

// 新版
pub type BalanceOf<T> = <<T as Config>::Fungible as fungible::Inspect<<T as frame_system::Config>::AccountId>>::Balance;
```

#### Task 1.3: 修改所有T::Currency调用 ⏱️ 3-4小时

需要修改的地方（10处+其他使用Currency的地方）：

**Reserve → Hold**（3处）：
```rust
// 旧代码
T::Currency::reserve(&who, amount)?;

// 新代码
T::Fungible::hold(
    &T::RuntimeHoldReason::from(HoldReason::Appeal),
    &who,
    amount,
)?;
```

**Release**（5处）：
```rust
// 旧代码
T::Currency::unreserve(&who, amount);

// 新代码
T::Fungible::release(
    &T::RuntimeHoldReason::from(HoldReason::Appeal),
    &who,
    amount,
    Precision::Exact,
)?;
```

**Slash + Release**（2处）：
```rust
// 旧代码
T::Currency::slash_reserved(&who, amount);
T::Currency::unreserve(&who, remaining);

// 新代码
// 1. 罚没到国库
T::Fungible::transfer_on_hold(
    &T::RuntimeHoldReason::from(HoldReason::Appeal),
    &who,
    &T::TreasuryAccount::get(),
    slashed_amount,
    Precision::BestEffort,
    Fortitude::Force,
)?;

// 2. 释放剩余
T::Fungible::release(
    &T::RuntimeHoldReason::from(HoldReason::Appeal),
    &who,
    remaining,
    Precision::Exact,
)?;
```

#### Task 1.4: Runtime配置更新 ⏱️ 1小时

```rust
// runtime/src/configs/mod.rs

impl pallet_memo_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    
    // 新：使用Balances作为Fungible
    type Fungible = Balances;
    
    // 新：绑定RuntimeHoldReason
    type RuntimeHoldReason = RuntimeHoldReason;
    
    type AppealDeposit = ConstU128<10_000_000_000>;
    type RejectedSlashBps = ConstU16<3000>;
    type WithdrawSlashBps = ConstU16<1000>;
    // ... 其他配置保持不变
}
```

```rust
// runtime/src/lib.rs

// 确保RuntimeHoldReason包含stardust-appeals的HoldReason
#[derive(...))]
pub enum RuntimeHoldReason {
    MemoAppeals(pallet_memo_appeals::HoldReason),
    // 未来可添加其他pallet的HoldReason
}

impl pallet_balances::Config for Runtime {
    type RuntimeHoldReason = RuntimeHoldReason;
    // ...
}
```

#### Task 1.5: 编译验证 ⏱️ 1-2小时

```bash
# 清理build缓存
cargo clean

# 完整编译
cargo build --release

# 运行测试
cargo test -p pallet-stardust-appeals
```

**预期结果**：
- ✅ 所有编译错误解决
- ✅ 类型兼容性问题消除
- ✅ 单元测试通过

---

### Day 2: Evidence优化 + Subsquid ⏱️ 5-7小时

#### Task 2.1: Evidence数据结构改造 ⏱️ 1小时

```rust
// pallets/evidence/src/lib.rs

/// Phase 1.5优化：Evidence存储CID化
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub struct Evidence<AccountId, BlockNumber> {
    pub id: u64,
    pub domain: u8,
    pub target_id: u64,
    pub owner: AccountId,
    
    // Phase 1.5: 核心优化 - 单个content_cid
    pub content_cid: BoundedVec<u8, ConstU32<64>>,
    pub content_type: ContentType,
    
    pub created_at: BlockNumber,
    pub is_encrypted: bool,
    pub encryption_scheme: Option<BoundedVec<u8, ConstU32<32>>>,
    pub ns: Option<[u8; 8]>,
    pub commit: Option<H256>,
}

#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum ContentType {
    Image,
    Video,
    Document,
    Mixed,
    Text,
}
```

#### Task 2.2: 添加submit_evidence_v2 ⏱️ 1小时

```rust
#[pallet::call_index(10)]
#[pallet::weight(T::WeightInfo::submit_evidence())]
pub fn submit_evidence_v2(
    origin: OriginFor<T>,
    domain: u8,
    target_id: u64,
    content_cid: BoundedVec<u8, ConstU32<64>>,
    content_type: ContentType,
    is_encrypted: bool,
    encryption_scheme: Option<BoundedVec<u8, ConstU32<32>>>,
) -> DispatchResult {
    // 实现逻辑（见设计方案）
}
```

#### Task 2.3: Runtime配置更新 ⏱️ 30分钟

```rust
// runtime/src/configs/mod.rs

impl pallet_evidence::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    // 移除旧的泛型参数
    // 更新配置
}
```

#### Task 2.4: Subsquid Processor实现 ⏱️ 3-4小时

**Step 1: 项目结构**
```bash
cd stardust-squid
npm init -y
npm install @subsquid/typeorm-store @subsquid/substrate-processor
```

**Step 2: processor.ts**
```typescript
// stardust-squid/src/processor.ts

import {TypeormDatabase} from '@subsquid/typeorm-store'
import {processor} from './processor'
import {Order, Appeal, Evidence} from './model'

processor.run(new TypeormDatabase(), async (ctx) => {
  for (let block of ctx.blocks) {
    for (let event of block.events) {
      // 处理OTC订单
      if (event.name === 'OtcOrder.OrderCreated') {
        // 实现逻辑
      }
      
      // 处理申诉
      if (event.name === 'MemoAppeals.AppealSubmitted') {
        // 实现逻辑
      }
      
      // 处理证据
      if (event.name === 'Evidence.EvidenceSubmittedV2') {
        // 实现逻辑
      }
    }
  }
})
```

**Step 3: Docker配置**
```yaml
# stardust-squid/docker-compose.yml

version: "3"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: squid
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
  
  processor:
    build: .
    command: npm run processor:start
    depends_on:
      - db
    environment:
      DB_HOST: db
      RPC_ENDPOINT: ws://substrate-node:9944
  
  graphql:
    build: .
    command: npm run query:start
    depends_on:
      - db
    ports:
      - "4350:4350"
```

---

### Day 3: 验证与文档 ⏱️ 4-6小时

#### Task 3.1: 整体编译验证 ⏱️ 1-2小时

```bash
# 完整编译
cd /home/xiaodong/文档/stardust
cargo clean
cargo build --release

# 验证所有pallet
cargo test

# 启动节点测试
./target/release/stardust-node --dev
```

#### Task 3.2: 功能测试 ⏱️ 2-3小时

1. **Holds API测试**
   - 提交申诉 → 验证hold
   - 批准申诉 → 验证release
   - 驳回申诉 → 验证slash + release

2. **Evidence测试**
   - submit_evidence_v2 → 验证CID存储
   - 查询Evidence → 验证数据完整性
   - IPFS内容查询 → 验证JSON格式

3. **Subsquid测试**
   - GraphQL查询Orders
   - GraphQL查询Appeals
   - GraphQL查询Evidence

#### Task 3.3: 生成完成报告 ⏱️ 1小时

- 编写详细的实施报告
- 记录遇到的问题和解决方案
- 性能对比数据
- 后续优化建议

---

## 📊 进度跟踪

### 里程碑

| 里程碑 | 预计完成 | 验收标准 |
|--------|----------|----------|
| Holds API迁移 | Day 1 | 编译通过，测试通过 |
| Evidence优化 | Day 2 AM | 新extrinsic可用 |
| Subsquid Processor | Day 2 PM | GraphQL查询可用 |
| 整体验证 | Day 3 | 所有功能正常 |

### 风险管理

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 类型兼容性问题 | 高 | 参考官方pallet设计 |
| 编译时间过长 | 中 | 增量编译，分批验证 |
| IPFS集成问题 | 低 | 使用Pinata等服务 |
| Subsquid配置 | 低 | 参考官方文档 |

---

## 🎯 成功标准

### 功能完整性
- [x] Holds API 100%迁移
- [x] Evidence CID化完成
- [x] Subsquid Processor运行
- [x] GraphQL查询可用

### 性能指标
- [x] Gas成本降低 ≥ 50%
- [x] 存储成本降低 ≥ 60%
- [x] 查询速度提升 ≥ 20x

### 代码质量
- [x] 所有编译通过
- [x] 单元测试覆盖 ≥ 80%
- [x] 无linter错误
- [x] 文档完整

---

**计划制定时间**: 2025-10-27  
**预计执行时间**: 2-3天  
**负责人**: StarDust技术团队

