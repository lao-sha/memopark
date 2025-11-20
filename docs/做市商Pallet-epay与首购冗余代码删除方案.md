# 做市商 Pallet - epay 与首购冗余代码删除方案

**文档版本**: v1.0  
**创建日期**: 2025-10-23  
**目标**: 清理首购功能删除后的冗余代码  
**状态**: 📋 设计方案

---

## 📋 一、背景说明

### 1.1 删除原因

随着做市商申请流程优化（方案A）的实施，首购功能已经被删除：
- ❌ **epay 相关功能**：支付网关集成已废弃
- ❌ **首购资金池功能**：新用户首购优惠已废弃

但是 `pallet-market-maker` 中仍然保留了大量相关代码，导致：
1. **代码冗余**：大量无用字段和函数
2. **存储浪费**：Application 结构体包含废弃字段
3. **维护困难**：增加理解和维护成本
4. **潜在风险**：废弃代码可能引发意外错误

### 1.2 影响范围

**直接影响**：
- `pallet-market-maker` 核心逻辑
- Application 数据结构
- 存储项定义
- 事件和错误类型

**间接影响**：
- `pallet-otc-order`（可能调用首购相关接口）
- Runtime 配置
- 前端代码（已在 Phase 4 清理）

---

## 🎯 二、删除清单

### 2.1 数据结构字段（Application）

**位置**：`pallets/market-maker/src/lib.rs:370-382`

```rust
// ❌ 需要删除的字段（共6个）
pub struct Application<AccountId, Balance> {
    // ... 保留字段 ...
    
    /// ❌ 删除：epay支付网关地址
    pub epay_gateway: BoundedVec<u8, ConstU32<128>>,
    /// ❌ 删除：epay支付网关端口
    pub epay_port: u16,
    /// ❌ 删除：epay商户ID (PID)
    pub epay_pid: BoundedVec<u8, ConstU32<64>>,
    /// ❌ 删除：epay商户密钥
    pub epay_key: BoundedVec<u8, ConstU32<64>>,
    /// ❌ 删除：首购资金池总额
    pub first_purchase_pool: Balance,
    /// ❌ 删除：已使用的首购资金
    pub first_purchase_used: Balance,
    /// ❌ 删除：冻结的首购资金（提取申请中）
    pub first_purchase_frozen: Balance,
    
    // ... 保留字段 ...
}
```

**影响评估**：
- 🔴 **破坏式变更**：修改存储结构
- ⚠️ **需要迁移逻辑**：清理链上已有数据
- ✅ **收益明显**：减少存储开销约 50%

### 2.2 Config Trait 定义

**位置**：`pallets/market-maker/src/lib.rs:204,222`

```rust
// ❌ 需要删除的 Config 类型（共2个）

/// ❌ 删除：首购资金池最小金额
#[pallet::constant]
type MinFirstPurchasePool: Get<BalanceOf<Self>>;

/// ❌ 删除：每次首购转账金额
#[pallet::constant]
type FirstPurchaseAmount: Get<BalanceOf<Self>>;
```

**Runtime 配置清理**：
```rust
// runtime/src/configs/mod.rs
// ❌ 删除对应的 parameter_types
```

### 2.3 存储项（Storage）

**位置**：`pallets/market-maker/src/lib.rs:440-446`

```rust
/// ❌ 删除：首购使用记录
#[pallet::storage]
pub type FirstPurchaseRecords<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat, u64,        // mm_id
    Blake2_128Concat, T::AccountId, // buyer
    (),
    OptionQuery,
>;
```

**影响评估**：
- 🔴 **存储迁移**：需要清理链上所有记录
- ✅ **性能提升**：减少存储查询开销

### 2.4 事件（Events）

**位置**：`pallets/market-maker/src/lib.rs:510-523`

```rust
// ❌ 需要删除的事件（共3个）

/// ❌ 删除：首购资金池已锁定（reserve）
FirstPurchasePoolReserved {
    mm_id: u64,
    owner: T::AccountId,
    amount: BalanceOf<T>,
},

/// ❌ 删除：首购资金已转入资金池账户
FirstPurchasePoolFunded {
    mm_id: u64,
    pool_account: T::AccountId,
    amount: BalanceOf<T>,
},

/// ❌ 删除：首购服务已完成
FirstPurchaseServed {
    mm_id: u64,
    buyer: T::AccountId,
    amount: BalanceOf<T>,
},
```

### 2.5 错误类型（Errors）

**位置**：`pallets/market-maker/src/lib.rs:652,660`

```rust
// ❌ 需要删除的错误类型（共2个）

/// ❌ 删除：首购资金池不足
InsufficientFirstPurchasePool,

/// ❌ 删除：已使用过首购服务
AlreadyUsedFirstPurchase,
```

**额外删除**：
```rust
// ❌ 删除：epay配置相关错误（共4个）
InvalidEpayGateway,
InvalidEpayPort,
InvalidEpayPid,
InvalidEpayKey,
EpayConfigTooLong,
```

### 2.6 函数（Extrinsics & Helper Functions）

#### 2.6.1 Extrinsic: `update_epay_config`

**位置**：`pallets/market-maker/src/lib.rs:1505-1560`

```rust
/// ❌ 删除：更新 epay 配置
#[pallet::call_index(6)]
#[pallet::weight(<T as Config>::WeightInfo::update_epay_config())]
pub fn update_epay_config(
    origin: OriginFor<T>,
    mm_id: u64,
    epay_gateway: Option<Vec<u8>>,
    epay_port: Option<u16>,
    epay_pid: Option<Vec<u8>>,
    epay_key: Option<Vec<u8>>,
) -> DispatchResult {
    // ... 全部删除 ...
}
```

**影响评估**：
- 🟢 **低风险**：该接口未被前端使用
- ✅ **简化接口**：减少 API 数量

#### 2.6.2 Helper Function: `first_purchase_pool_account`

**位置**：`pallets/market-maker/src/lib.rs:1947-1953`

```rust
/// ❌ 删除：生成首购资金池账户地址
pub fn first_purchase_pool_account(mm_id: u64) -> T::AccountId {
    let mut buf = b"mm/pool!".to_vec();
    buf.extend_from_slice(&mm_id.to_le_bytes());
    T::PalletId::get().into_sub_account_truncating(&buf[..])
}
```

#### 2.6.3 Helper Function: `record_first_purchase_usage`

**位置**：`pallets/market-maker/src/lib.rs:1955-1991`

```rust
/// ❌ 删除：记录首购使用情况
pub fn record_first_purchase_usage(
    mm_id: u64,
    buyer: &T::AccountId,
    amount: BalanceOf<T>,
) -> DispatchResult {
    // ... 全部删除 ...
}
```

#### 2.6.4 Helper Function: `has_used_first_purchase`

**位置**：`pallets/market-maker/src/lib.rs:1997-1999`

```rust
/// ❌ 删除：检查是否使用过首购服务
pub fn has_used_first_purchase(mm_id: u64, buyer: &T::AccountId) -> bool {
    FirstPurchaseRecords::<T>::contains_key(mm_id, buyer)
}
```

### 2.7 初始化逻辑（lock_deposit）

**位置**：`pallets/market-maker/src/lib.rs:769-776`

```rust
// ❌ 删除：lock_deposit 中的初始化
Applications::<T>::insert(
    mm_id,
    Application {
        // ... 保留字段 ...
        epay_gateway: BoundedVec::default(),  // ❌ 删除
        epay_port: 0,                          // ❌ 删除
        epay_pid: BoundedVec::default(),       // ❌ 删除
        epay_key: BoundedVec::default(),       // ❌ 删除
        first_purchase_pool: BalanceOf::<T>::zero(),   // ❌ 删除
        first_purchase_used: BalanceOf::<T>::zero(),   // ❌ 删除
        first_purchase_frozen: BalanceOf::<T>::zero(), // ❌ 删除
        // ... 保留字段 ...
    },
);
```

### 2.8 业务逻辑引用

#### 2.8.1 update_info 函数

**位置**：`pallets/market-maker/src/lib.rs:1015-1038`

```rust
// ❌ 删除：update_info 中的 epay 和首购处理逻辑
if let Some(gateway) = epay_gateway {
    app.epay_gateway = gateway.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
}
if let Some(port) = epay_port {
    app.epay_port = port;
}
if let Some(pid) = epay_pid {
    app.epay_pid = pid.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
}
if let Some(key) = epay_key {
    app.epay_key = key.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
}
if let Some(pool) = first_purchase_pool {
    ensure!(pool >= T::MinFirstPurchasePool::get(), Error::<T>::InsufficientFirstPurchasePool);
    app.first_purchase_pool = pool;
}
```

**参数删除**：
```rust
// ❌ 删除函数参数
epay_gateway: Option<Vec<u8>>,
epay_port: Option<u16>,
epay_pid: Option<Vec<u8>>,
epay_key: Option<Vec<u8>>,
first_purchase_pool: Option<BalanceOf<T>>,
```

#### 2.8.2 approve 函数

**位置**：`pallets/market-maker/src/lib.rs:1114-1150`

```rust
// ❌ 删除：approve 中的 epay 验证和首购资金池转账逻辑

// epay 配置验证
ensure!(!app.epay_gateway.is_empty(), Error::<T>::InvalidEpayGateway);
ensure!(app.epay_port > 0, Error::<T>::InvalidEpayPort);
ensure!(!app.epay_pid.is_empty(), Error::<T>::InvalidEpayPid);
ensure!(!app.epay_key.is_empty(), Error::<T>::InvalidEpayKey);

// 首购资金池验证
ensure!(
    app.first_purchase_pool >= T::MinFirstPurchasePool::get(),
    Error::<T>::InsufficientFirstPurchasePool
);

// 解锁并转账首购资金池
T::Currency::unreserve(&app.owner, app.first_purchase_pool);
let pool_account = Self::first_purchase_pool_account(mm_id);
T::Currency::transfer(
    &app.owner,
    &pool_account,
    app.first_purchase_pool,
    ExistenceRequirement::AllowDeath,
)?;

// 发出事件
Self::deposit_event(Event::FirstPurchasePoolFunded {
    mm_id,
    pool_account,
    amount: app.first_purchase_pool,
});
```

#### 2.8.3 cancel 函数

**位置**：`pallets/market-maker/src/lib.rs:1082-1083`

```rust
// ❌ 删除：cancel 中的首购资金池退还逻辑
if app.first_purchase_pool > Zero::zero() {
    T::Currency::unreserve(&who, app.first_purchase_pool);
}
```

#### 2.8.4 reject 函数

**位置**：`pallets/market-maker/src/lib.rs:1175,1193-1194`

```rust
// ❌ 删除：reject 中的首购资金池退还逻辑
let first_purchase_pool = app.first_purchase_pool;

// ... 后续 ...

if first_purchase_pool > Zero::zero() {
    T::Currency::unreserve(&who, first_purchase_pool);
}
```

#### 2.8.5 提取相关函数

**位置**：`pallets/market-maker/src/lib.rs:1275-1279, 1296-1298, 1359-1372, ...`

```rust
// ❌ 删除：request_withdrawal 中的首购资金计算
let available = app.first_purchase_pool
    .saturating_sub(app.first_purchase_used)
    .saturating_sub(app.first_purchase_frozen);

// ... 更新 frozen 字段 ...
app.first_purchase_frozen = app.first_purchase_frozen.saturating_add(amount);

// ❌ 删除：execute_withdrawal 中的首购资金处理
let pool_account = Self::first_purchase_pool_account(mm_id);
// ... 首购资金池转账逻辑 ...
app.first_purchase_pool = app.first_purchase_pool.saturating_sub(amount);
app.first_purchase_frozen = app.first_purchase_frozen.saturating_sub(amount);
```

---

## 🛠️ 三、删除方案

### 3.1 方案 A：破坏式删除（推荐）✅

**适用场景**：主网未上线，可进行破坏式调整

**实施步骤**：

#### 步骤1：删除 Application 字段
```rust
// 修改前（17个字段）
pub struct Application<AccountId, Balance> {
    pub owner: AccountId,
    pub deposit: Balance,
    pub status: ApplicationStatus,
    pub direction: Direction,
    pub tron_address: BoundedVec<u8, ConstU32<64>>,
    pub public_cid: Cid,
    pub private_cid: Cid,
    pub buy_premium_bps: i16,
    pub sell_premium_bps: i16,
    pub min_amount: Balance,
    pub created_at: u32,
    pub info_deadline: u32,
    pub review_deadline: u32,
    pub epay_gateway: BoundedVec<u8, ConstU32<128>>,      // ❌ 删除
    pub epay_port: u16,                                    // ❌ 删除
    pub epay_pid: BoundedVec<u8, ConstU32<64>>,           // ❌ 删除
    pub epay_key: BoundedVec<u8, ConstU32<64>>,           // ❌ 删除
    pub first_purchase_pool: Balance,                      // ❌ 删除
    pub first_purchase_used: Balance,                      // ❌ 删除
    pub first_purchase_frozen: Balance,                    // ❌ 删除
    pub service_paused: bool,
    pub users_served: u32,
    pub masked_full_name: BoundedVec<u8, ConstU32<64>>,
    pub masked_id_card: BoundedVec<u8, ConstU32<32>>,
    pub masked_payment_info: BoundedVec<u8, ConstU32<512>>,
}

// 修改后（10个字段）
pub struct Application<AccountId, Balance> {
    pub owner: AccountId,
    pub deposit: Balance,
    pub status: ApplicationStatus,
    pub direction: Direction,
    pub tron_address: BoundedVec<u8, ConstU32<64>>,
    pub public_cid: Cid,
    pub private_cid: Cid,
    pub buy_premium_bps: i16,
    pub sell_premium_bps: i16,
    pub min_amount: Balance,
    pub created_at: u32,
    pub info_deadline: u32,
    pub review_deadline: u32,
    pub service_paused: bool,
    pub users_served: u32,
    pub masked_full_name: BoundedVec<u8, ConstU32<64>>,
    pub masked_id_card: BoundedVec<u8, ConstU32<32>>,
    pub masked_payment_info: BoundedVec<u8, ConstU32<512>>,
}
```

**存储优化**：
- 删除字段数：7个
- 预计减少存储：~400 字节/记录
- 字段减少率：41%

#### 步骤2：删除存储项
```rust
// ❌ 完全删除
#[pallet::storage]
pub type FirstPurchaseRecords<T: Config> = StorageDoubleMap<...>;
```

#### 步骤3：删除 Config Trait
```rust
// ❌ 删除
type MinFirstPurchasePool: Get<BalanceOf<Self>>;
type FirstPurchaseAmount: Get<BalanceOf<Self>>;
```

#### 步骤4：删除事件和错误
```rust
// ❌ 删除 3 个事件
// ❌ 删除 6 个错误类型
```

#### 步骤5：删除函数
```rust
// ❌ 删除 update_epay_config extrinsic
// ❌ 删除 3 个 helper 函数
```

#### 步骤6：清理业务逻辑
```rust
// 修改 lock_deposit, update_info, approve, reject, cancel
// 删除所有 epay 和 first_purchase 相关代码
```

#### 步骤7：清理 Runtime 配置
```rust
// runtime/src/configs/mod.rs
// ❌ 删除 MinFirstPurchasePool, FirstPurchaseAmount 配置
```

**优点**：
- ✅ 彻底清理，无技术债务
- ✅ 代码简洁，易于维护
- ✅ 存储优化明显

**缺点**：
- ⚠️ 破坏式变更，已有数据丢失
- ⚠️ 需要重新部署整个链

### 3.2 方案 B：保留字段+标记废弃（兼容方案）

**适用场景**：主网已上线，需要平滑迁移

**实施步骤**：

#### 步骤1：标记字段为废弃
```rust
pub struct Application<AccountId, Balance> {
    // ... 保留字段 ...
    
    /// ⚠️ DEPRECATED：已废弃，请勿使用
    #[deprecated]
    pub epay_gateway: BoundedVec<u8, ConstU32<128>>,
    // ... 其他废弃字段 ...
}
```

#### 步骤2：删除函数和业务逻辑
```rust
// ❌ 删除 update_epay_config extrinsic
// ❌ 删除 helper 函数
// ✅ 保留字段定义（不写入，只读取）
```

#### 步骤3：添加迁移逻辑
```rust
// 在后续版本中提供迁移 pallet
// 逐步清理链上数据
```

**优点**：
- ✅ 平滑过渡，不破坏已有数据
- ✅ 降低升级风险

**缺点**：
- ⚠️ 仍然占用存储空间
- ⚠️ 增加技术债务
- ⚠️ 需要后续清理工作

---

## 📊 四、影响评估

### 4.1 代码量统计

| 删除类别 | 行数 | 占比 |
|---------|------|------|
| Application 字段 | ~40行 | 2% |
| 存储项定义 | ~10行 | 0.5% |
| 事件定义 | ~20行 | 1% |
| 错误类型 | ~15行 | 0.7% |
| Extrinsic 函数 | ~60行 | 3% |
| Helper 函数 | ~50行 | 2.5% |
| 业务逻辑引用 | ~150行 | 7.5% |
| **总计** | **~345行** | **~17%** |

### 4.2 存储优化

**单个 Application 记录**：
- 删除前：~850 字节
- 删除后：~450 字节
- **优化率：~47%**

**全局存储**（假设100个做市商）：
- 删除前：~85 KB
- 删除后：~45 KB
- **节省：~40 KB**

### 4.3 风险评估

| 风险类型 | 风险等级 | 缓解措施 |
|---------|---------|----------|
| 数据丢失 | 🔴 高 | 主网未上线，可接受 |
| 接口破坏 | 🟡 中 | 前端已适配，影响小 |
| 编译错误 | 🟢 低 | 逐步测试，分批修改 |
| Runtime 升级失败 | 🟡 中 | 充分测试后部署 |

---

## ✅ 五、实施建议

### 5.1 推荐方案

**方案 A（破坏式删除）** ✅

**理由**：
1. 主网未上线（规则第9条：允许破坏式调整）
2. 彻底清理技术债务
3. 最大化存储优化
4. 代码结构更清晰

### 5.2 实施优先级

| 任务 | 优先级 | 预计工期 |
|-----|--------|---------|
| 删除 Application 字段 | 🔴 高 | 1小时 |
| 删除存储项 | 🔴 高 | 0.5小时 |
| 删除 Config Trait | 🔴 高 | 0.5小时 |
| 删除事件和错误 | 🟡 中 | 0.5小时 |
| 删除 extrinsic 函数 | 🟡 中 | 1小时 |
| 清理业务逻辑 | 🔴 高 | 2小时 |
| 清理 Runtime 配置 | 🟡 中 | 0.5小时 |
| 编译测试 | 🔴 高 | 1小时 |
| **总计** | - | **~7小时** |

### 5.3 实施顺序

```
步骤1: 删除 helper 函数（无依赖）
  ↓
步骤2: 删除 extrinsic 函数（依赖 helper）
  ↓
步骤3: 清理业务逻辑引用（依赖函数）
  ↓
步骤4: 删除事件和错误类型（依赖业务逻辑）
  ↓
步骤5: 删除存储项（依赖事件）
  ↓
步骤6: 删除 Application 字段（依赖存储项）
  ↓
步骤7: 删除 Config Trait（依赖 Application）
  ↓
步骤8: 清理 Runtime 配置（依赖 Config）
  ↓
步骤9: 编译测试和验证
```

### 5.4 测试计划

**单元测试**：
- [ ] Application 结构体序列化/反序列化
- [ ] lock_deposit 正常流程
- [ ] submit_info 正常流程
- [ ] approve 正常流程
- [ ] reject 正常流程
- [ ] cancel 正常流程

**集成测试**：
- [ ] 完整申请流程测试
- [ ] 前端提交测试
- [ ] Runtime 升级测试

---

## 📝 六、后续工作

### 6.1 相关 Pallet 清理

**pallet-otc-order**：
- 检查是否调用 `first_purchase` 相关接口
- 删除相关调用代码

**pallet-simple-bridge**：
- 检查是否使用 epay 配置
- 删除相关引用

### 6.2 文档更新

- [ ] 更新 pallet-market-maker README
- [ ] 更新接口文档（pallets接口文档.md）
- [ ] 生成删除完成报告

---

## 🎉 七、预期收益

### 7.1 代码质量

- ✅ **代码行数减少 17%**（~345行）
- ✅ **函数数量减少**（4个函数）
- ✅ **接口简化**（1个 extrinsic 删除）

### 7.2 存储优化

- ✅ **单记录存储减少 47%**（~400字节）
- ✅ **全局存储优化**（节省约 40 KB）

### 7.3 维护成本

- ✅ **理解成本降低**：无废弃代码干扰
- ✅ **维护成本降低**：代码更简洁
- ✅ **错误风险降低**：减少潜在bug来源

---

**方案编制**: AI Assistant  
**审核批准**: 待用户确认  
**最后更新**: 2025-10-23

