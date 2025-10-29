# Pallet Simple Bridge - 极简桥接系统

## 📋 模块概述

`pallet-simple-bridge` 是Memopark生态的**跨链桥接模块**，提供MEMO↔USDT(TRC20)双向兑换功能。支持**官方托管式**和**做市商OCW式**两种桥接模式，实现安全高效的跨链资产流通。

### 设计理念

- **混合架构**：官方托管+做市商OCW双轨并行
- **动态定价**：基于pallet-pricing的市场加权均价
- **OCW验证**：链下自动验证TRON转账
- **超时保护**：30分钟未完成自动退款
- **自动归档**：150天后清理已完成记录

## 🏗️ 架构设计

### 模式1：官方托管式（Simple Bridge）

```text
┌──────────────────────────────────────┐
│     用户发起兑换（swap）              │
│  - MEMO锁定到桥接账户                 │
│  - 使用市场均价                       │
└──────────────┬───────────────────────┘
               ↓ 链上记录
┌──────────────────────────────────────┐
│     运营团队链下转账                  │
│  - 向用户TRON地址发送USDT             │
│  - 人工确认                           │
└──────────────┬───────────────────────┘
               ↓ 完成确认
┌──────────────────────────────────────┐
│     标记完成（complete_swap）         │
│  - Root权限                           │
│  - 更新兑换状态                       │
└──────────────────────────────────────┘
```

### 模式2：做市商OCW式（Maker Bridge）

```text
┌──────────────────────────────────────┐
│     用户选择做市商（create_ocw_swap） │
│  - MEMO锁定到做市商                   │
│  - 使用做市商溢价                     │
└──────────────┬───────────────────────┘
               ↓ 做市商收到订单
┌──────────────────────────────────────┐
│     做市商转账USDT（链下）            │
│  - 向用户TRON地址发送USDT             │
│  - 提交TRON交易hash                   │
└──────────────┬───────────────────────┘
               ↓ OCW自动验证
┌──────────────────────────────────────┐
│     OCW验证TRON转账                   │
│  - 查询TRON区块链                     │
│  - 验证金额/地址/状态                 │
│  - 自动释放MEMO给做市商               │
└──────────────┬───────────────────────┘
               ↓ 用户确认
┌──────────────────────────────────────┐
│     用户确认收款（confirm_ocw_swap）  │
│  - 做市商信用+1                      │
│  - 完成流程                          │
└──────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 官方托管式兑换

#### swap - 创建兑换
```rust
pub fn swap(
    origin: OriginFor<T>,
    memo_amount: BalanceOf<T>,
    tron_address: Vec<u8>,
) -> DispatchResult
```

**功能**：
- MEMO锁定到桥接账户
- 根据市场价格计算USDT金额
- 设置超时时间（30分钟）

**价格计算**：
```rust
// 1. 获取市场基准价
let base_price = T::PricingProvider::get_market_price();  // 例如0.01 USDT/MEMO

// 2. 计算USDT金额
let usdt_amount = memo_amount * base_price / 10^12;
// 例如：100 MEMO × 0.01 = 1.0 USDT
```

#### complete_swap - 完成兑换
```rust
pub fn complete_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

**权限**：Root或治理Origin

**功能**：
- 标记兑换已完成
- 触发SwapCompleted事件
- 运营团队确认已转账USDT

### 2. 做市商OCW兑换

#### create_ocw_swap - 创建OCW兑换
```rust
pub fn create_ocw_swap(
    origin: OriginFor<T>,
    maker_id: u64,
    memo_amount: BalanceOf<T>,
    tron_address: Vec<u8>,
) -> DispatchResult
```

**功能**：
- 选择做市商
- MEMO锁定到做市商
- 应用做市商溢价
- 进入OCW验证队列

**做市商验证**：
```rust
// 1. 检查做市商存在且激活
let maker = pallet_market_maker::Applications::<T>::get(maker_id)
    .ok_or(Error::<T>::MakerNotActiveOrNotFound)?;

ensure!(
    maker.status == ApplicationStatus::Active,
    Error::<T>::MakerNotActiveOrNotFound
);

// 2. 检查业务方向支持Bridge
ensure!(
    maker.direction == Direction::Buy || maker.direction == Direction::BuyAndSell,
    Error::<T>::DirectionNotSupported
);

// 3. 应用买入溢价
let price_usdt = base_price * (10000 + maker.buy_premium_bps) / 10000;
// 例如：base_price=0.01, buy_premium_bps=-200 (-2%)
// price_usdt = 0.01 × 0.98 = 0.0098 USDT/MEMO
```

#### submit_tron_tx_hash - 提交TRON交易hash
```rust
pub fn submit_tron_tx_hash(
    origin: OriginFor<T>,
    swap_id: u64,
    tron_tx_hash: Vec<u8>,
) -> DispatchResult
```

**权限**：做市商

**功能**：
- 提交TRON转账交易hash
- 防重放检查
- 进入OCW验证队列

#### confirm_ocw_swap - 用户确认收款
```rust
pub fn confirm_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

**权限**：买家

**功能**：
- 用户确认收到USDT
- 做市商信用+1
- 完成流程

### 3. OCW自动验证

#### offchain_worker - OCW入口
```rust
fn offchain_worker(block_number: BlockNumberFor<T>) {
    let pending_swaps = OcwVerificationQueue::<T>::get();
    
    for swap_id in pending_swaps.iter().take(MaxOrdersPerBlock) {
        Self::verify_tron_transaction(swap_id);
    }
}
```

#### verify_tron_transaction - 验证TRON交易
```rust
fn verify_tron_transaction(swap_id: u64) -> bool {
    // 1. 查询TRON API
    let tron_endpoint = TronApiEndpoint::<T>::get();
    let url = format!("{}/wallet/gettransactionbyid?value={}", tron_endpoint, tx_hash);
    
    let response = http::Request::get(&url)
        .send()
        .map_err(|_| "HTTP request failed")?;
    
    // 2. 解析JSON响应
    let tx_info: TronTxInfo = serde_json::from_slice(&response.body)?;
    
    // 3. 验证要素
    // - 收款地址正确
    // - 金额正确
    // - 合约地址正确（USDT TRC20）
    // - 交易成功
    
    if tx_info.to_address == expected_address &&
       tx_info.amount >= expected_amount &&
       tx_info.token_contract == USDT_CONTRACT {
        // 4. 提交无签名交易释放MEMO
        Self::submit_unsigned_tx_release_memo(swap_id);
        return true;
    }
    
    false
}
```

### 4. 举报与仲裁

#### report_ocw_swap - 用户举报
```rust
pub fn report_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
    evidence: Vec<u8>,
) -> DispatchResult
```

**触发条件**：
- 做市商30分钟未转账
- 或OCW验证失败

**功能**：
- 用户提交证据
- 状态变更：Pending → UserReported
- 等待治理仲裁

#### arbitrate_ocw_swap - 治理仲裁
```rust
pub fn arbitrate_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
    approved: bool,
    penalty: Option<BalanceOf<T>>,
) -> DispatchResult
```

**权限**：Root或治理Origin

**功能**：
- approved=true：做市商履约，释放MEMO给做市商
- approved=false：做市商违约，退款给用户+罚没做市商押金

### 5. 超时与退款

#### refund_ocw_swap - 超时退款
```rust
pub fn refund_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

**触发条件**：
- 30分钟后做市商未提交TRON交易hash
- 或OCW验证失败次数超限

**功能**：
- MEMO退还给用户
- 做市商信用-20分
- 状态变更：Pending → Refunded

### 6. 自动归档

#### auto_cleanup_archived_swaps - 自动清理
```rust
// OnInitialize自动触发
fn auto_cleanup_archived_swaps() -> Weight {
    let threshold_days = T::ArchiveThresholdDays::get();  // 150天
    let max_cleanup = T::MaxCleanupPerBlock::get();       // 50个
    
    // 清理官方兑换记录
    for (swap_id, swap) in Swaps::<T>::iter() {
        if swap.completed && age_days > threshold_days {
            Swaps::<T>::remove(swap_id);
        }
    }
    
    // 清理做市商兑换记录
    for (swap_id, swap) in MakerSwaps::<T>::iter() {
        if swap.status == SwapStatus::Completed && age_days > threshold_days {
            MakerSwaps::<T>::remove(swap_id);
        }
    }
}
```

## 📦 存储结构

### 官方兑换记录
```rust
pub type Swaps<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // swap_id
    SwapRequest<T>,
    OptionQuery,
>;
```

**SwapRequest结构**：
```rust
pub struct SwapRequest<T: Config> {
    pub id: u64,
    pub user: T::AccountId,
    pub memo_amount: BalanceOf<T>,
    pub tron_address: BoundedVec<u8, ConstU32<64>>,
    pub completed: bool,
    pub price_usdt: u64,
    pub created_at: BlockNumberFor<T>,
    pub expire_at: BlockNumberFor<T>,
}
```

### 做市商兑换记录
```rust
pub type MakerSwaps<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // swap_id
    MakerSwapRecord<T>,
    OptionQuery,
>;
```

**MakerSwapRecord结构**：
```rust
pub struct MakerSwapRecord<T: Config> {
    pub swap_id: u64,
    pub maker_id: u64,
    pub maker: T::AccountId,
    pub user: T::AccountId,
    pub memo_amount: BalanceOf<T>,
    pub usdt_amount: u64,
    pub usdt_address: BoundedVec<u8, ConstU32<64>>,
    pub created_at: BlockNumberFor<T>,
    pub timeout_at: BlockNumberFor<T>,
    pub trc20_tx_hash: Option<BoundedVec<u8, ConstU32<128>>>,
    pub completed_at: Option<BlockNumberFor<T>>,
    pub status: SwapStatus,
    pub price_usdt: u64,
}
```

**SwapStatus枚举**：
```rust
pub enum SwapStatus {
    Pending,                // 待处理
    Completed,              // 已完成
    UserReported,           // 用户举报
    Arbitrating,            // 仲裁中
    ArbitrationApproved,    // 仲裁通过
    ArbitrationRejected,    // 仲裁拒绝
    Refunded,               // 已退款
}
```

### OCW验证队列
```rust
pub type OcwVerificationQueue<T: Config> = StorageValue<
    _,
    BoundedVec<u64, ConstU32<1000>>,  // swap_ids
    ValueQuery,
>;
```

### TRON交易hash记录
```rust
pub type TronTxHashUsed<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    Vec<u8>,            // tron_tx_hash
    BlockNumberFor<T>,  // 使用时的区块号
    OptionQuery,
>;
```

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config + 
                  pallet_pricing::Config + 
                  pallet_market_maker::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 兑换超时时间（区块数，默认300块≈30分钟）
    type SwapTimeout: Get<BlockNumberFor<Self>>;

    /// 兑换记录归档阈值（天数，默认150天）
    type ArchiveThresholdDays: Get<u32>;

    /// 每次自动清理的最大记录数（默认50）
    type MaxCleanupPerBlock: Get<u32>;

    /// OCW验证失败阈值（默认3次）
    type MaxVerificationFailures: Get<u32>;

    /// 每个区块最多验证的订单数（默认10）
    type MaxOrdersPerBlock: Get<u32>;

    /// TRON交易hash保留期（区块数，默认180天）
    type TronTxHashRetentionPeriod: Get<BlockNumberFor<Self>>;

    /// OCW兑换订单超时时长（区块数，默认300块）
    type OcwSwapTimeoutBlocks: Get<BlockNumberFor<Self>>;

    /// OCW最小兑换金额
    type OcwMinSwapAmount: Get<BalanceOf<Self>>;

    /// 无签名交易优先级
    type UnsignedPriority: Get<TransactionPriority>;
}
```

## 📡 可调用接口

### 官方托管式接口

#### 1. swap - 创建兑换
```rust
#[pallet::call_index(0)]
pub fn swap(
    origin: OriginFor<T>,
    memo_amount: BalanceOf<T>,
    tron_address: Vec<u8>,
) -> DispatchResult
```

#### 2. complete_swap - 完成兑换
```rust
#[pallet::call_index(1)]
pub fn complete_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

### 做市商OCW接口

#### 3. create_ocw_swap - 创建OCW兑换
```rust
#[pallet::call_index(2)]
pub fn create_ocw_swap(
    origin: OriginFor<T>,
    maker_id: u64,
    memo_amount: BalanceOf<T>,
    tron_address: Vec<u8>,
) -> DispatchResult
```

#### 4. submit_tron_tx_hash - 提交TRON交易hash
```rust
#[pallet::call_index(3)]
pub fn submit_tron_tx_hash(
    origin: OriginFor<T>,
    swap_id: u64,
    tron_tx_hash: Vec<u8>,
) -> DispatchResult
```

#### 5. confirm_ocw_swap - 用户确认收款
```rust
#[pallet::call_index(4)]
pub fn confirm_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

#### 6. report_ocw_swap - 用户举报
```rust
#[pallet::call_index(5)]
pub fn report_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
    evidence: Vec<u8>,
) -> DispatchResult
```

#### 7. refund_ocw_swap - 超时退款
```rust
#[pallet::call_index(6)]
pub fn refund_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

### 治理接口

#### 8. arbitrate_ocw_swap - 治理仲裁
```rust
#[pallet::call_index(7)]
pub fn arbitrate_ocw_swap(
    origin: OriginFor<T>,
    swap_id: u64,
    approved: bool,
    penalty: Option<BalanceOf<T>>,
) -> DispatchResult
```

#### 9. set_tron_api_endpoint - 设置TRON API端点
```rust
#[pallet::call_index(8)]
pub fn set_tron_api_endpoint(
    origin: OriginFor<T>,
    endpoint: Vec<u8>,
) -> DispatchResult
```

#### 10. set_usdt_contract_address - 设置USDT合约地址
```rust
#[pallet::call_index(9)]
pub fn set_usdt_contract_address(
    origin: OriginFor<T>,
    address: Vec<u8>,
) -> DispatchResult
```

## 🎉 事件

### SwapCreated - 兑换创建事件
```rust
SwapCreated {
    swap_id: u64,
    user: T::AccountId,
    memo_amount: BalanceOf<T>,
    usdt_amount: u64,
}
```

### OcwMakerSwapCreated - OCW兑换创建事件
```rust
OcwMakerSwapCreated {
    swap_id: u64,
    maker_id: u64,
    user: T::AccountId,
    memo_amount: BalanceOf<T>,
    usdt_amount: u64,
}
```

### OcwMemoReleased - OCW MEMO释放事件
```rust
OcwMemoReleased {
    swap_id: u64,
    maker: T::AccountId,
    memo_amount: BalanceOf<T>,
    tron_tx_hash: BoundedVec<u8, ConstU32<128>>,
}
```

### OcwSwapRefunded - OCW退款事件
```rust
OcwSwapRefunded {
    swap_id: u64,
    user: T::AccountId,
    memo_amount: BalanceOf<T>,
}
```

## ❌ 错误处理

### AmountTooSmall
- **说明**：金额低于最小限制
- **触发**：兑换金额 < OcwMinSwapAmount

### MakerNotActiveOrNotFound
- **说明**：做市商不存在或未激活
- **触发**：选择无效做市商

### DirectionNotSupported
- **说明**：做市商业务方向不支持Bridge
- **触发**：做市商direction=Sell

### TronTxHashAlreadyUsed
- **说明**：TRON交易hash已使用
- **触发**：重复提交同一交易hash

### OcwSwapNotTimeout
- **说明**：OCW订单尚未超时
- **触发**：30分钟内尝试退款

## 🔌 使用示例

### 场景1：官方托管式兑换

```rust
// 1. 用户发起兑换（100 MEMO → USDT）
let memo_amount = 100_000_000_000_000u128;  // 100 MEMO
let tron_address = b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS".to_vec();

let swap_id = pallet_simple_bridge::Pallet::<T>::swap(
    user_origin.clone(),
    memo_amount,
    tron_address,
)?;

// 2. 运营团队链下转账USDT
// 查询兑换记录，向用户TRON地址发送USDT...

// 3. 确认完成
pallet_simple_bridge::Pallet::<T>::complete_swap(
    root_origin,
    swap_id,
)?;
```

### 场景2：做市商OCW兑换（完整流程）

```rust
// 1. 用户选择做市商创建兑换
let swap_id = pallet_simple_bridge::Pallet::<T>::create_ocw_swap(
    user_origin.clone(),
    maker_id,
    100_000_000_000_000u128,  // 100 MEMO
    b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS".to_vec(),
)?;

// 2. 做市商链下转账USDT（向用户TRON地址）
// 链下操作...

// 3. 做市商提交TRON交易hash
pallet_simple_bridge::Pallet::<T>::submit_tron_tx_hash(
    maker_origin,
    swap_id,
    tron_tx_hash,
)?;

// 4. OCW自动验证（后台自动执行）
// offchain_worker() → verify_tron_transaction() → 释放MEMO

// 5. 用户确认收款
pallet_simple_bridge::Pallet::<T>::confirm_ocw_swap(
    user_origin,
    swap_id,
)?;

// 做市商信用+1
```

### 场景3：用户举报+治理仲裁

```rust
// 做市商30分钟未转账，用户举报

// 1. 用户举报
pallet_simple_bridge::Pallet::<T>::report_ocw_swap(
    user_origin,
    swap_id,
    b"Maker didn't transfer USDT within 30 minutes".to_vec(),
)?;

// 2. 治理委员会调查
// 链下核实TRON链...

// 3. 治理仲裁
// 如果做市商确实未转账，拒绝并罚没押金
pallet_simple_bridge::Pallet::<T>::arbitrate_ocw_swap(
    governance_origin,
    swap_id,
    false,  // 拒绝
    Some(10_000_000_000_000_000u128),  // 罚没10,000 MEMO
)?;

// MEMO退还给用户
// 做市商押金罚没
```

## 🛡️ 安全机制

### 1. OCW自动验证

- 查询TRON区块链
- 验证金额/地址/合约
- 无需人工介入

### 2. 防重放攻击

- TRON交易hash去重
- 保留期180天
- 定期清理

### 3. 超时保护

- 30分钟未完成自动退款
- 保护用户资金
- 做市商信用惩罚

### 4. 举报与仲裁

- 用户可举报
- 治理委员会仲裁
- 做市商押金罚没

### 5. 自动归档

- 150天后清理记录
- 释放存储空间
- 降低链上负担

## 📝 最佳实践

### 1. 模式选择

- **小额快速**：官方托管式
- **大额分散**：做市商OCW式
- **信任度高**：做市商OCW式

### 2. 做市商选择

- 选择高信用分（Gold+）
- 查看历史成交记录
- 注意溢价和限额

### 3. TRON地址

- 仔细核对地址
- 确认是TRC20地址
- 避免转错链

### 4. 监控指标

- 兑换完成率
- OCW验证成功率
- 平均完成时间
- 举报率

## 🔗 相关模块

- **pallet-market-maker**: 做市商管理（获取溢价）
- **pallet-maker-credit**: 做市商信用（更新记录）
- **pallet-pricing**: 价格管理（获取市场价格）
- **pallet-arbitration**: 仲裁系统（处理争议）

## 📚 参考资源

- [OCW验证原理](../../docs/ocw-verification-principle.md)
- [TRON API集成](../../docs/tron-api-integration.md)
- [桥接安全机制](../../docs/bridge-security-mechanisms.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Memopark 开发团队
