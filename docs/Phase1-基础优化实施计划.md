# Phase 1 基础优化实施计划

**开始时间**: 2025-10-27  
**预计时长**: 立即执行（破坏式编码）  
**状态**: 🚀 进行中

---

## 🎯 Phase 1 目标

1. **Holds API迁移**: 删除pallet-deposits，使用官方pallet-balances Holds API
2. **Evidence优化**: CID化，减少链上存储80%
3. **Subsquid准备**: 生成schema和processor模板
4. **编译验证**: 确保所有修改编译通过

**预期收益**:
- ✅ Gas成本降低 50%
- ✅ 查询速度提升 20x（Subsquid）
- ✅ 存储优化 40%
- ✅ 减少1个pallet维护负担

---

## 📋 任务清单

### Task 1: Holds API迁移 ⏳ 进行中

#### 1.1 分析依赖关系
**依赖pallet-deposits的模块**:
```rust
// 需要检查的pallet:
- pallet-stardust-appeals
- pallet-memo-offerings  
- pallet-deceased-text (archived?)
- pallet-deceased-media (archived?)
```

#### 1.2 Holds API实现方案

**官方Holds API**:
```rust
use frame_support::traits::tokens::{
    fungible::{Inspect, Mutate, MutateHold},
    Fortitude, Precision, Preservation
};

// 定义Hold Reason
#[pallet::composite_enum]
pub enum HoldReason {
    Appeal,
    Offering,
    Complaint,
}

// 锁定资金
T::Currency::hold(
    &HoldReason::Appeal,
    &who,
    amount
)?;

// 释放资金
T::Currency::release(
    &HoldReason::Appeal,
    &who,
    amount,
    Precision::Exact
)?;

// 罚没资金
T::Currency::transfer_on_hold(
    &HoldReason::Appeal,
    &who,
    &treasury,
    amount,
    Precision::BestEffort,
    Fortitude::Force
)?;
```

#### 1.3 迁移步骤

**Step 1**: 在runtime定义HoldReason
**Step 2**: 修改stardust-appeals使用Holds API
**Step 3**: 修改memo-offerings使用Holds API
**Step 4**: 删除pallet-deposits
**Step 5**: 更新runtime配置
**Step 6**: 编译验证

---

### Task 2: Evidence存储优化 ⏳ 待执行

#### 2.1 当前结构
```rust
pub struct Evidence {
    imgs: BoundedVec<BoundedVec<u8, 128>, 10>,  // 链上
    vids: BoundedVec<BoundedVec<u8, 128>, 5>,   // 链上
    docs: BoundedVec<BoundedVec<u8, 128>, 5>,   // 链上
}
// 存储成本: 高
```

#### 2.2 优化方案
```rust
pub struct Evidence {
    // 链上只存储CID
    content_cid: BoundedVec<u8, 64>,
    content_type: ContentType,  // Image/Video/Document
    
    // 元数据
    owner: AccountId,
    domain: u8,
    target_id: u64,
    created_at: BlockNumber,
}

// IPFS内容结构:
{
  "imgs": ["cid1", "cid2", ...],
  "vids": ["cid1", ...],
  "docs": ["cid1", ...]
}
```

#### 2.3 迁移策略
- 新Evidence使用CID结构
- 旧Evidence保持兼容（可选迁移）
- 前端适配新格式

---

### Task 3: Subsquid准备 ⏳ 待执行

#### 3.1 Schema设计
```graphql
# schema.graphql

type Order @entity {
  id: ID!
  orderId: BigInt!
  buyer: String!
  seller: String!
  amount: BigInt!
  usdtAmount: BigInt!
  state: OrderState!
  price: BigInt!
  createdAt: DateTime!
  paidAt: DateTime
  releasedAt: DateTime
  completedAt: DateTime
  makerId: BigInt
}

enum OrderState {
  Open
  Paid
  Released
  Refunded
  Disputed
  Cancelled
}

type Appeal @entity {
  id: ID!
  appealId: BigInt!
  submitter: String!
  domain: Int!
  target: BigInt!
  action: Int!
  status: AppealStatus!
  submittedAt: DateTime!
  approvedAt: DateTime
  executedAt: DateTime
}

enum AppealStatus {
  Pending
  Approved
  Rejected
  Withdrawn
  Executed
  RetryExhausted
}

type Evidence @entity {
  id: ID!
  evidenceId: BigInt!
  owner: String!
  domain: Int!
  targetId: BigInt!
  contentCid: String!
  contentType: ContentType!
  createdAt: DateTime!
}

enum ContentType {
  Image
  Video
  Document
}
```

#### 3.2 Processor模板
```typescript
// src/processor.ts
import {processor} from './processor'
import {Order, OrderState} from './model'

processor.run(new TypeormDatabase(), async (ctx) => {
  for (let block of ctx.blocks) {
    for (let event of block.events) {
      if (event.name === 'OtcOrder.OrderCreated') {
        const {orderId, buyer, seller, amount} = event.args
        
        const order = new Order({
          id: `${block.height}-${event.index}`,
          orderId: BigInt(orderId),
          buyer,
          seller,
          amount: BigInt(amount),
          state: OrderState.Open,
          createdAt: new Date(block.timestamp)
        })
        
        await ctx.store.save(order)
      }
    }
  }
})
```

---

## 📊 预期效果

### 性能指标

| 指标 | 当前 | Phase 1后 | 提升 |
|------|------|-----------|------|
| Pallet数量 | 30 | 29 | -1 |
| 查询速度 | 5-10s | 0.1-0.5s | 20-100x |
| 存储成本 | $5k/年 | $3k/年 | -40% |
| Gas成本 | $10k/年 | $5k/年 | -50% |

### 代码质量

- ✅ 使用官方维护的API
- ✅ 减少自研pallet
- ✅ 提升可维护性
- ✅ 更好的兼容性

---

## ⚠️ 风险控制

### 破坏性变更
- ✅ 主网未上线，可接受
- ✅ 完整测试后部署
- ✅ 准备回滚方案

### 迁移策略
1. **并行开发**: 新API与旧API共存
2. **灰度迁移**: 逐个pallet迁移
3. **充分测试**: 单元测试 + 集成测试
4. **文档同步**: 更新所有文档

---

## 🚀 执行时间表

### 立即执行（今天）
- [x] 生成Phase 1计划
- [ ] 分析pallet-deposits依赖
- [ ] 实现Holds API迁移
- [ ] Evidence CID化

### 明天
- [ ] Subsquid schema生成
- [ ] Processor模板
- [ ] 编译验证
- [ ] 集成测试

### 本周完成
- [ ] 所有功能验证通过
- [ ] 性能测试
- [ ] 文档更新
- [ ] Phase 1完成报告

---

**文档版本**: v1.0  
**维护人**: StarDust技术团队  
**最后更新**: 2025-10-27

