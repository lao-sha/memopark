# pallet-storage-treasury

## 模块概述

`pallet-storage-treasury` 是一个去中心化存储费用专用账户管理模块，负责收集、托管和自动分配存储服务相关的费用。该模块采用委员会治理的路由表机制，实现完全自动化的资金分配，确保 IPFS、Arweave、Filecoin 等存储服务提供商获得公平、透明的激励。

### 核心特性

- **自动化路由分配**：通过 `OnInitialize` hook 每周自动执行资金分配，无需人工干预
- **多存储提供商支持**：支持 IPFS、Arweave、Filecoin、节点运维、研发基金等多种分配目标
- **委员会治理**：路由表配置由治理委员会控制，确保分配规则的公正性和可调整性
- **完整审计记录**：记录每次资金接收和分配的详细历史，支持透明审计
- **资金安全托管**：使用 PalletId 派生的无私钥账户，仅通过链上逻辑操作，确保资金安全

## 设计原理

### 资金流向

```
供奉路由 2% → StorageTreasury 托管账户
    ↓
IPFS pin 费用 → StorageTreasury 托管账户
    ↓
【每周自动触发】OnInitialize（每 100,800 区块）
    ↓
读取 StorageRouteTable（委员会治理）
    ↓
按比例分配：
    ├─ IPFS 运营者池 50%
    ├─ Arweave 运营者池 30%
    ├─ Filecoin 运营者池 10%
    └─ 节点运维激励 10%
```

### 托管账户派生

- **PalletId**: `py/dstor` (Decentralized Storage)
- **账户地址**: `DecentralizedStoragePalletId.into_account_truncating()`
- **无私钥控制**：仅通过链上逻辑操作，确保资金安全
- **确定性地址**：账户地址由 PalletId 确定性派生，可预测且不可更改

```rust
// PalletId
StoragePalletId = PalletId(*b"py/dstor")

// 账户地址派生
account_id = StoragePalletId.into_account_truncating()

// 特点
✅ 确定性派生（地址永不改变）
✅ 无私钥控制（仅通过链上逻辑操作）
✅ 任何人可验证地址正确性
```

### 自动化分配机制

模块在每个分配周期（默认 7 天）自动执行资金分配：

1. **周期检查**：在 `on_initialize` 中检查当前区块是否到达分配周期
2. **路由读取**：读取委员会配置的路由表
3. **余额计算**：获取托管账户的当前可用余额
4. **比例分配**：按路由表中的比例计算每个目标的分配金额
5. **执行转账**：向各个目标账户转账
6. **记录历史**：记录分配记录到链上，便于审计
7. **事件发出**：发出分配完成事件

#### 执行逻辑

```rust
fn on_initialize(block_number) {
    // 1. 检查是否到达分配周期
    if block_number % 100_800 == 0 {
        // 2. 读取路由表
        let routes = StorageRouteTable::get();

        // 3. 获取当前余额
        let balance = current_balance();

        // 4. 按路由表比例分配
        for route in routes {
            let amount = route.share * balance;
            transfer(treasury_account, route.account, amount);
        }

        // 5. 记录历史
        DistributionHistory::insert(block_number, record);

        // 6. 发出事件
        emit(AutoDistributionCompleted { ... });
    }
}
```

#### 分配周期

```
每 100,800 区块执行一次
= 100,800 × 6 秒
= 604,800 秒
= 7 天
```

## 数据结构

### StorageRouteEntry - 存储路由条目

定义存储费用的分配规则，由委员会治理。

```rust
pub struct StorageRouteEntry<AccountId> {
    /// 路由类型代码
    pub kind: u8,
    /// 目标账户
    pub account: AccountId,
    /// 分配比例（Permill，0-1,000,000 表示 0-100%）
    pub share: Permill,
}
```

#### 字段说明

- **kind**: 路由类型（0-255）
  - `0` = IPFS 运营者池
  - `1` = Arweave 运营者池
  - `2` = Filecoin 运营者池
  - `3` = 节点运维激励池
  - `4` = 存储研发基金
  - `5-255` = 预留（未来扩展）

- **account**: 目标账户地址（必填）
- **share**: 分配比例，使用 `Permill` 类型（千分率）
  - `Permill::from_percent(50)` = 50%
  - `Permill::from_percent(30)` = 30%

### DistributionRecord - 分配记录

记录每次自动分配的详细信息，便于审计和追溯。

```rust
pub struct DistributionRecord<Balance, BlockNumber> {
    /// 分配时间（区块号）
    pub block: BlockNumber,
    /// 总分配金额
    pub total_amount: Balance,
    /// 分配路由数量
    pub route_count: u32,
}
```

## 存储项

### TotalCollected - 累计收集总金额

```rust
pub type TotalCollected<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;
```

记录从供奉路由、IPFS pin 费用等渠道收集的所有存储费用的累计总额。

**查询方法**: `total_collected()`

**JavaScript 示例**:
```javascript
const totalCollected = await api.query.storageTreasury.totalCollected();
console.log(`累计收集: ${totalCollected} DUST`);
```

### TotalDistributed - 累计分配总金额

```rust
pub type TotalDistributed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;
```

记录通过路由表自动分配给各存储服务商的累计总额。

**查询方法**: `total_distributed()`

**JavaScript 示例**:
```javascript
const totalDistributed = await api.query.storageTreasury.totalDistributed();
console.log(`累计分配: ${totalDistributed} DUST`);
```

### StorageRouteTable - 存储费用路由表

```rust
pub type StorageRouteTable<T: Config> = StorageValue<
    _,
    BoundedVec<StorageRouteEntry<T::AccountId>, ConstU32<10>>,
    OptionQuery,
>;
```

定义资金自动分配规则，由委员会治理。

**限制**:
- 最多支持 10 个路由条目
- 所有路由的 share 总和必须 ≤ 100%
- 通过 `set_storage_route_table` 修改

**查询方法**: `storage_route_table()`

**JavaScript 示例**:
```javascript
const routes = await api.query.storageTreasury.storageRouteTable();
console.log('当前路由表:');
routes.forEach(route => {
    console.log(`  Type ${route.kind}: ${route.account} = ${route.share.toNumber() / 10000}%`);
});
```

### DistributionHistory - 分配历史记录

```rust
pub type DistributionHistory<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BlockNumberFor<T>,
    DistributionRecord<BalanceOf<T>, BlockNumberFor<T>>,
    OptionQuery,
>;
```

存储最近的分配记录，用于审计和追溯。

**索引**: 区块号 → 分配记录

**查询方法**: `distribution_history(block_number)`

**JavaScript 示例**:
```javascript
// 查询最近的分配记录
const lastBlock = await api.query.storageTreasury.lastDistributionBlock();
const history = await api.query.storageTreasury.distributionHistory(lastBlock);

console.log(`最近分配（区块 #${lastBlock}）:
  总金额: ${history.total_amount}
  路由数量: ${history.route_count}
`);
```

### LastDistributionBlock - 最后分配区块号

```rust
pub type LastDistributionBlock<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;
```

记录最后一次执行分配的区块号。

**查询方法**: `last_distribution_block()`

**JavaScript 示例**:
```javascript
const lastBlock = await api.query.storageTreasury.lastDistributionBlock();
console.log(`最后分配区块: #${lastBlock}`);
```

## 主要调用方法

### set_storage_route_table - 设置存储费用路由表

设置或更新资金自动分配规则。

```rust
pub fn set_storage_route_table(
    origin: OriginFor<T>,
    routes: Vec<(u8, T::AccountId, Permill)>,
) -> DispatchResult
```

**权限**: 需要 `GovernanceOrigin`（Root 或技术委员会 2/3）

**参数**:
- `origin`: 治理权限来源
- `routes`: 路由表配置，格式为 `[(kind, account, share), ...]`

**路由类型（kind）**:
- `0` = IPFS 运营者池
- `1` = Arweave 运营者池
- `2` = Filecoin 运营者池
- `3` = 节点运维激励池
- `4` = 存储研发基金
- `5-255` = 预留（未来扩展）

**验证规则**:
- ✅ 路由表不能为空
- ✅ 最多 10 个路由条目
- ✅ 所有 share 总和必须 ≤ 100%

**使用场景**:
- 配置资金自动分配规则
- 调整各存储服务商的分配比例
- 添加或移除分配目标

**Rust 示例**:
```rust
use sp_runtime::Permill;

// 配置路由表：IPFS 50%，Arweave 30%，节点运维 20%
let routes = vec![
    (0, ipfs_pool_account, Permill::from_percent(50)),    // IPFS 运营者池 50%
    (1, arweave_pool_account, Permill::from_percent(30)), // Arweave 运营者池 30%
    (3, node_pool_account, Permill::from_percent(20)),    // 节点运维激励 20%
];

StorageTreasury::set_storage_route_table(
    RuntimeOrigin::root(),
    routes,
)?;
```

**JavaScript 示例**:
```javascript
// JavaScript 示例
const routes = [
    [0, ipfsPoolAccount,    500000], // IPFS 50%（Permill 格式：50% = 500,000/1,000,000）
    [1, arweavePoolAccount, 300000], // Arweave 30%
    [3, nodePoolAccount,    200000], // 节点运维 20%
];

await api.tx.storageTreasury
    .setStorageRouteTable(routes)
    .signAndSend(sudoAccount);
```

### withdraw - 治理提取资金

紧急情况下提取托管账户中的资金。

```rust
pub fn withdraw(
    origin: OriginFor<T>,
    dest: T::AccountId,
    amount: BalanceOf<T>,
) -> DispatchResult
```

**权限**: 需要 `GovernanceOrigin`（通常为 Root 或技术委员会 2/3）

**参数**:
- `origin`: 治理权限来源
- `dest`: 目标账户
- `amount`: 提取金额

**使用场景**:
- 紧急情况下提取资金
- 升级或迁移时转移资金
- 调整资金分配策略

**Rust 示例**:
```rust
// 提取 1000 DUST 到指定账户
StorageTreasury::withdraw(
    RuntimeOrigin::root(),
    dest_account,
    1_000 * DUST,
)?;
```

**JavaScript 示例**:
```javascript
// 提取 10,000 DUST 到治理账户
await api.tx.storageTreasury
    .withdraw(governanceAccount, 10_000_000_000_000_000n)
    .signAndSend(sudoAccount);
```

## 查询接口（RPC）

### total_collected - 累计收集的总金额

```rust
pub fn total_collected() -> BalanceOf<T>
```

返回从供奉路由、IPFS pin 费用等渠道收集的所有存储费用的累计总额。

### total_distributed - 累计分配的总金额

```rust
pub fn total_distributed() -> BalanceOf<T>
```

返回通过路由表自动分配给各存储服务商的累计总额。

### current_balance - 当前账户余额

```rust
pub fn current_balance() -> BalanceOf<T>
```

返回托管账户的当前可用余额。

**JavaScript 示例**:
```javascript
// 方法1：查询托管账户余额
const accountId = api.consts.storageTreasury.storagePalletId;
const account = await api.query.system.account(accountId);
console.log(`当前余额: ${account.data.free} DUST`);
```

### storage_route_table - 当前路由表配置

```rust
pub fn storage_route_table() -> Option<BoundedVec<StorageRouteEntry<T::AccountId>, ConstU32<10>>>
```

返回当前配置的路由表。

### distribution_history - 分配历史记录

```rust
pub fn distribution_history(block: BlockNumberFor<T>) -> Option<DistributionRecord<BalanceOf<T>, BlockNumberFor<T>>>
```

查询指定区块的分配记录。

### last_distribution_block - 最后分配区块号

```rust
pub fn last_distribution_block() -> BlockNumberFor<T>
```

返回最后一次执行分配的区块号。

### account_id - 托管账户地址

```rust
pub fn account_id() -> T::AccountId
```

返回托管账户的确定性派生地址。

## 内部方法

### record_funds_received - 记录资金接收

```rust
pub fn record_funds_received(from: &T::AccountId, amount: BalanceOf<T>)
```

当托管账户收到资金时调用此方法更新统计数据。

**用途**:
- 当供奉路由转入资金时调用
- 更新累计收集金额
- 发出资金接收事件

**注意**：此函数不执行实际转账，仅记录统计数据

**Rust 示例**:
```rust
// 在 pallet-memo-offerings 中调用
use pallet_storage_treasury::Pallet as StorageTreasury;

// 计算存储费用（供奉金额的 2%）
let storage_fee = offering_amount * Permill::from_percent(2);

// 转账到托管账户
T::Currency::transfer(
    &from,
    &StorageTreasury::<T>::account_id(),
    storage_fee,
    ExistenceRequirement::KeepAlive,
)?;

// 记录资金接收（更新统计）
StorageTreasury::<T>::record_funds_received(&from, storage_fee);
```

### execute_route_distribution - 执行路由分配

```rust
fn execute_route_distribution(block: BlockNumberFor<T>) -> DispatchResult
```

执行自动路由分配的内部方法，由 `on_initialize` hook 调用。

**逻辑**:
1. 读取路由表，如果未配置则跳过
2. 获取当前余额，如果为0则跳过
3. 遍历所有路由条目
4. 按比例计算每个路由的分配金额
5. 执行转账
6. 更新统计数据
7. 记录分配历史
8. 发出事件

## 事件定义

### FundsReceived - 收到存储费用

```rust
FundsReceived {
    from: T::AccountId,
    amount: BalanceOf<T>,
}
```

当托管账户收到资金时发出。

**字段**:
- `from`: 资金来源账户
- `amount`: 接收金额

**触发时机**：调用 `record_funds_received` 时

### RouteTableUpdated - 路由表更新

```rust
RouteTableUpdated {
    route_count: u32,
}
```

当治理委员会更新路由表配置时发出。

**字段**:
- `route_count`: 更新后的路由条目数量

**触发时机**：调用 `set_storage_route_table` 成功后

### RouteDistributed - 单笔路由分配

```rust
RouteDistributed {
    kind: u8,
    to: T::AccountId,
    amount: BalanceOf<T>,
}
```

每次向单个路由目标分配资金时发出。

**字段**:
- `kind`: 路由类型（0-255）
- `to`: 接收方账户
- `amount`: 分配金额

**触发时机**：自动分配时，每个路由都会发出此事件

### AutoDistributionCompleted - 自动分配完成

```rust
AutoDistributionCompleted {
    block: BlockNumberFor<T>,
    total_amount: BalanceOf<T>,
    route_count: u32,
}
```

每个分配周期的自动分配完成后发出。

**字段**:
- `block`: 分配执行的区块号
- `total_amount`: 总分配金额
- `route_count`: 分配的路由数量

**触发时机**：每周自动分配完成后

### Withdrawn - 治理提取

```rust
Withdrawn {
    to: T::AccountId,
    amount: BalanceOf<T>,
}
```

治理委员会提取资金时发出。

**字段**:
- `to`: 目标账户
- `amount`: 提取金额

**触发时机**：调用 `withdraw` 成功后

## 错误定义

### InsufficientBalance

```rust
InsufficientBalance
```

托管账户余额不足，无法完成转账操作。

### InvalidAmount

```rust
InvalidAmount
```

金额无效，可能为 0 或超过最大值。

### RouteTableTooLong

```rust
RouteTableTooLong
```

路由表条目超过 10 个。

### InvalidRouteTable

```rust
InvalidRouteTable
```

路由表无效，通常是因为：
- 所有路由的 share 总和超过 100%
- 存在无效的 share 值

### EmptyRouteTable

```rust
EmptyRouteTable
```

尝试设置空的路由表。

## 配置参数

### RuntimeEvent

```rust
type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
```

运行时事件类型。

### Currency

```rust
type Currency: Currency<Self::AccountId>;
```

货币类型，用于转账操作。

### StoragePalletId

```rust
#[pallet::constant]
type StoragePalletId: Get<PalletId>;
```

存储费用专用 PalletId，用于派生托管账户地址。

**推荐值**: `PalletId(*b"py/dstor")`

### GovernanceOrigin

```rust
type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
```

治理权限，可以修改路由表和提取资金。

**推荐配置**: `EnsureRoot` 或 `pallet_collective::EnsureProportionMoreThan<2, 3>`

### DistributionPeriod

```rust
#[pallet::constant]
type DistributionPeriod: Get<BlockNumberFor<Self>>;
```

自动分配周期（区块数），每隔多少区块自动执行一次路由分配。

**推荐值**: `100_800`（约 7 天，按 6s/块计算）

**计算公式**: `周期天数 * 24 * 60 * 60 / 区块时间(秒)`

## 使用示例

### Runtime 配置

```rust
use frame_support::PalletId;

parameter_types! {
    pub const StoragePalletId: PalletId = PalletId(*b"py/dstor");
    pub const DistributionPeriod: BlockNumber = 100_800; // 7 天
}

impl pallet_storage_treasury::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type StoragePalletId = StoragePalletId;

    // 治理权限：Root | 技术委员会 2/3
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, TechCommitteeCollective, 2, 3>,
    >;

    // 自动分配周期
    type DistributionPeriod = DistributionPeriod;
}
```

### 初始化路由表

```rust
use sp_runtime::Permill;

// 创建路由表配置
let routes = vec![
    (
        0, // IPFS 运营者池
        ipfs_pool_account.clone(),
        Permill::from_percent(50), // 50%
    ),
    (
        1, // Arweave 运营者池
        arweave_pool_account.clone(),
        Permill::from_percent(30), // 30%
    ),
    (
        2, // Filecoin 运营者池
        filecoin_pool_account.clone(),
        Permill::from_percent(10), // 10%
    ),
    (
        3, // 节点运维激励池
        node_ops_account.clone(),
        Permill::from_percent(10), // 10%
    ),
];

// 设置路由表（需要 Root 权限）
StorageTreasury::set_storage_route_table(
    RuntimeOrigin::root(),
    routes,
)?;
```

### 记录资金接收

```rust
// 在 pallet-memo-offerings 中调用
use pallet_storage_treasury::Pallet as StorageTreasury;

// 计算存储费用（供奉金额的 2%）
let storage_fee = offering_amount * Permill::from_percent(2);

// 转账到托管账户
T::Currency::transfer(
    &from,
    &StorageTreasury::<T>::account_id(),
    storage_fee,
    ExistenceRequirement::KeepAlive,
)?;

// 记录资金接收（更新统计）
StorageTreasury::<T>::record_funds_received(&from, storage_fee);
```

### 查询托管账户状态

```rust
// 查询托管账户地址
let treasury_account = StorageTreasury::account_id();
println!("托管账户地址: {:?}", treasury_account);

// 查询当前余额
let balance = StorageTreasury::current_balance();
println!("当前余额: {}", balance);

// 查询累计收集金额
let total_collected = StorageTreasury::total_collected();
println!("累计收集: {}", total_collected);

// 查询累计分配金额
let total_distributed = StorageTreasury::total_distributed();
println!("累计分配: {}", total_distributed);

// 查询路由表
if let Some(routes) = StorageTreasury::storage_route_table() {
    println!("路由表:");
    for route in routes.iter() {
        println!(
            "  类型: {}, 账户: {:?}, 比例: {:?}",
            route.kind, route.account, route.share
        );
    }
}
```

### 更新路由表比例

```rust
// 调整 IPFS 比例为 60%，Arweave 比例为 30%，节点运维为 10%
let new_routes = vec![
    (0, ipfs_pool_account, Permill::from_percent(60)),
    (1, arweave_pool_account, Permill::from_percent(30)),
    (3, node_ops_account, Permill::from_percent(10)),
];

// 提交治理提案或使用 Root 权限更新
StorageTreasury::set_storage_route_table(
    RuntimeOrigin::root(),
    new_routes,
)?;
```

### 紧急提取资金

```rust
// 紧急情况下提取资金（需要治理权限）
let emergency_amount = 10_000 * DUST;
StorageTreasury::withdraw(
    RuntimeOrigin::root(),
    emergency_account,
    emergency_amount,
)?;
```

### 查询分配历史

```rust
// 查询最后一次分配
let last_block = StorageTreasury::last_distribution_block();
if let Some(record) = StorageTreasury::distribution_history(last_block) {
    println!("最后一次分配:");
    println!("  区块号: {}", record.block);
    println!("  总金额: {}", record.total_amount);
    println!("  路由数量: {}", record.route_count);
}
```

### 完整监控脚本（JavaScript）

```javascript
async function checkStorageTreasuryStatus() {
    // 1. 查询路由表
    const routes = await api.query.storageTreasury.storageRouteTable();
    console.log('当前路由表:');
    routes.forEach(route => {
        console.log(`  Type ${route.kind}: ${route.share.toNumber() / 10000}%`);
    });

    // 2. 查询统计数据
    const collected = await api.query.storageTreasury.totalCollected();
    const distributed = await api.query.storageTreasury.totalDistributed();
    const balance = await api.query.system.account(treasuryAccountId);

    console.log(`
    ============ 存储账户状态 ============
    累计收集: ${collected} DUST
    累计分配: ${distributed} DUST
    当前余额: ${balance.data.free} DUST

    分配率: ${(distributed / collected * 100).toFixed(2)}%
    剩余率: ${(balance.data.free / collected * 100).toFixed(2)}%
    ======================================
    `);

    // 3. 查询最近分配
    const lastBlock = await api.query.storageTreasury.lastDistributionBlock();
    const history = await api.query.storageTreasury.distributionHistory(lastBlock);

    console.log(`最近分配（区块 #${lastBlock}）:
      总金额: ${history.total_amount}
      路由数量: ${history.route_count}
    `);
}
```

## 集成说明

### 与 pallet-memo-offerings 集成

供奉模块需要在执行供奉时将 2% 的存储费用转入托管账户：

```rust
// 在 pallet-memo-offerings::offer() 中
use pallet_storage_treasury::Pallet as StorageTreasury;

// 计算各项费用
let storage_fee = total_amount * Permill::from_percent(2);   // 2% 存储费用
let affiliate_fee = total_amount * Permill::from_percent(75); // 75% 联盟营销
let treasury_fee = total_amount * Permill::from_percent(15);  // 15% 国库
let burn_fee = total_amount * Permill::from_percent(8);       // 8% 销毁

// 转账到存储财库
T::Currency::transfer(
    &who,
    &StorageTreasury::<T>::account_id(),
    storage_fee,
    ExistenceRequirement::KeepAlive,
)?;

// 记录资金接收
StorageTreasury::<T>::record_funds_received(&who, storage_fee);
```

**Runtime 配置方式（推荐）**:
```rust
// runtime/src/configs/mod.rs
use sp_runtime::Permill;

impl pallet_memo_offerings::Config for Runtime {
    // ... 其他配置 ...

    // 供奉费用路由表
    type RouteTable = OfferingRouteTable;
}

parameter_types! {
    pub OfferingRouteTable: Vec<RouteEntry<AccountId>> = vec![
        RouteEntry {
            kind: 1,
            account: Some(StorageTreasuryAccount::get()),
            share: Permill::from_percent(2),  // 2% 存储费用
        },
        // ... 其他路由 ...
    ];
}
```

### 与 pallet-stardust-ipfs 集成

IPFS 模块在收取 pin 费用时也应转入托管账户：

```rust
// 在 pallet-stardust-ipfs::request_pin() 中
use pallet_storage_treasury::Pallet as StorageTreasury;

// 计算 pin 费用
let pin_fee = size_in_bytes * fee_per_byte;

// 转账到存储财库
T::Currency::transfer(
    &who,
    &StorageTreasury::<T>::account_id(),
    pin_fee,
    ExistenceRequirement::KeepAlive,
)?;

// 记录资金接收
StorageTreasury::<T>::record_funds_received(&who, pin_fee);
```

**Runtime 配置方式（推荐）**:
```rust
impl pallet_stardust_ipfs::Config for Runtime {
    type FeeCollector = DecentralizedStorageAccount;  // ✅ 存储专用账户
}
```

### 与治理模块集成

路由表的修改应通过治理提案进行：

```rust
// 使用 pallet-collective 创建提案
use pallet_collective::Instance1 as TechCommittee;

// 创建路由表更新提案
let proposal = RuntimeCall::StorageTreasury(
    pallet_storage_treasury::Call::set_storage_route_table {
        routes: new_routes,
    }
);

// 技术委员会成员提交提案
TechCommittee::propose(
    RuntimeOrigin::signed(member),
    threshold,
    Box::new(proposal),
    length_bound,
)?;
```

**JavaScript 示例**:
```javascript
// 前端提交治理提案
const proposal = api.tx.storageTreasury.setStorageRouteTable([
    [0, ipfsPoolAccount,    600000], // IPFS 提升到 60%
    [1, arweavePoolAccount, 200000], // Arweave 降低到 20%
    [3, nodePoolAccount,    200000], // 节点运维保持 20%
]);

// 提交到技术委员会
await api.tx.council.propose(
    3,  // 需要 3 票通过（假设委员会有 5 人，2/3 = 3.33）
    proposal,
    proposal.length
).signAndSend(councilMember);
```

## 费用路由分配机制

### 分配时机

自动分配在每个 `DistributionPeriod` 周期执行，通过 `on_initialize` hook 触发：

```rust
fn on_initialize(n: BlockNumberFor<T>) -> Weight {
    let period = T::DistributionPeriod::get();
    if !period.is_zero() && n % period == Zero::zero() {
        // 执行自动分配
        let _ = Self::execute_route_distribution(n);
    }
    Weight::from_parts(10_000, 0)
}
```

### 分配算法

```rust
for route in routes.iter() {
    // 计算分配金额（余额 × 比例）
    let amount = route.share * balance;

    if amount.is_zero() {
        continue;
    }

    // 执行转账
    T::Currency::transfer(
        &treasury_account,
        &route.account,
        amount,
        ExistenceRequirement::KeepAlive,
    )?;

    // 累加统计
    total_distributed = total_distributed.saturating_add(amount);
    route_count = route_count.saturating_add(1);
}
```

### 分配示例

假设托管账户余额为 100,000 DUST，路由表配置为：

| 类型 | 目标 | 比例 |
|-----|------|------|
| IPFS 运营者池 | 0x1111... | 50% |
| Arweave 运营者池 | 0x2222... | 30% |
| 节点运维激励 | 0x3333... | 20% |

自动分配结果：

- IPFS 运营者池：50,000 DUST
- Arweave 运营者池：30,000 DUST
- 节点运维激励：20,000 DUST

## 多存储提供商支持

### 支持的存储类型

模块通过路由类型（`kind` 字段）支持多种存储提供商：

| kind | 存储类型 | 说明 |
|------|---------|------|
| 0 | IPFS 运营者池 | 去中心化点对点存储网络 |
| 1 | Arweave 运营者池 | 永久存储区块链 |
| 2 | Filecoin 运营者池 | 去中心化存储市场 |
| 3 | 节点运维激励池 | 链节点运维激励 |
| 4 | 存储研发基金 | 存储技术研发资金 |
| 5-255 | 预留 | 未来扩展（如 Sia、Storj 等） |

### 添加新的存储提供商

通过治理提案更新路由表即可添加新的存储提供商：

```rust
// 添加 Filecoin 支持（kind = 2）
let routes = vec![
    (0, ipfs_pool, Permill::from_percent(40)),       // IPFS 40%
    (1, arweave_pool, Permill::from_percent(30)),    // Arweave 30%
    (2, filecoin_pool, Permill::from_percent(20)),   // Filecoin 20% (新增)
    (3, node_ops, Permill::from_percent(10)),        // 节点运维 10%
];

StorageTreasury::set_storage_route_table(
    RuntimeOrigin::root(),
    routes,
)?;
```

### 动态调整比例

根据各存储提供商的服务质量和成本，委员会可以动态调整分配比例：

```rust
// 季度调整：增加 IPFS 比例，减少 Arweave 比例
let adjusted_routes = vec![
    (0, ipfs_pool, Permill::from_percent(55)),       // IPFS 55% (↑5%)
    (1, arweave_pool, Permill::from_percent(25)),    // Arweave 25% (↓5%)
    (2, filecoin_pool, Permill::from_percent(10)),   // Filecoin 10%
    (3, node_ops, Permill::from_percent(10)),        // 节点运维 10%
];
```

## 最佳实践

### 1. 路由表配置建议

- **总比例不超过 100%**：确保 `share` 总和 ≤ 100%，避免过度分配
- **预留缓冲空间**：建议总比例在 90-95%，留 5-10% 作为缓冲
- **定期审查调整**：根据存储服务商的表现和市场情况，每季度审查一次
- **分散风险**：避免将超过 60% 的资金分配给单一存储提供商

示例配置：

```rust
let balanced_routes = vec![
    (0, ipfs_pool, Permill::from_percent(45)),       // IPFS 45%
    (1, arweave_pool, Permill::from_percent(30)),    // Arweave 30%
    (3, node_ops, Permill::from_percent(15)),        // 节点运维 15%
    // 总计 90%，预留 10% 缓冲
];
```

### 2. 治理权限设置

- **使用多签或委员会**：避免单点控制，推荐 2/3 或 3/5 多签
- **分离提取权限**：考虑将 `withdraw` 权限设置为更高门槛（如 Root）
- **引入时间锁**：重要变更应有延迟生效机制

```rust
// 路由表更新：技术委员会 2/3
type RouteTableOrigin = EnsureRootOrTwoThirdsTechCommittee;

// 资金提取：需要 Root
type WithdrawOrigin = EnsureRoot<AccountId>;
```

### 3. 监控和审计

定期监控以下指标：

```rust
// 监控脚本示例
fn monitor_storage_treasury() {
    let balance = StorageTreasury::current_balance();
    let collected = StorageTreasury::total_collected();
    let distributed = StorageTreasury::total_distributed();

    // 计算分配率
    let distribution_rate = distributed * 100 / collected;

    // 检查余额增长
    let pending = balance;

    println!("===== Storage Treasury 监控 =====");
    println!("当前余额: {} DUST", balance / DUST);
    println!("累计收集: {} DUST", collected / DUST);
    println!("累计分配: {} DUST", distributed / DUST);
    println!("分配率: {}%", distribution_rate);
    println!("待分配: {} DUST", pending / DUST);

    // 警报检查
    if distribution_rate < 80 {
        println!("警告：分配率低于 80%，检查路由表配置");
    }

    if pending > collected / 10 {
        println!("警告：待分配金额超过累计收集的 10%");
    }
}
```

**JavaScript 监控脚本**:
```javascript
async function checkHealth() {
    const collected = await api.query.storageTreasury.totalCollected();
    const distributed = await api.query.storageTreasury.totalDistributed();
    const balance = await api.query.system.account(treasuryAccount);

    // 计算分配率
    const distributionRate = distributed / collected;

    if (distributionRate < 0.9) {
        console.warn('⚠️ 警告：分配率低于 90%，可能存在积压');
    }

    if (balance.data.free > collected * 0.2) {
        console.warn('⚠️ 警告：余额超过累计收集的 20%，考虑提高分配频率');
    }
}
```

### 4. 分配周期设置

根据链的出块时间和运营需求设置合适的分配周期：

| 出块时间 | 7天周期 | 14天周期 | 30天周期 |
|---------|---------|----------|----------|
| 6s | 100,800 | 201,600 | 432,000 |
| 12s | 50,400 | 100,800 | 216,000 |
| 3s | 201,600 | 403,200 | 864,000 |

```rust
// 计算分配周期
const BLOCK_TIME: u64 = 6; // 秒
const DISTRIBUTION_DAYS: u64 = 7; // 天

parameter_types! {
    pub const DistributionPeriod: BlockNumber =
        (DISTRIBUTION_DAYS * 24 * 60 * 60 / BLOCK_TIME) as BlockNumber;
}
```

### 5. 错误处理

在集成时妥善处理可能的错误：

```rust
// 转账到托管账户时的错误处理
match T::Currency::transfer(
    &who,
    &StorageTreasury::<T>::account_id(),
    storage_fee,
    ExistenceRequirement::KeepAlive,
) {
    Ok(_) => {
        StorageTreasury::<T>::record_funds_received(&who, storage_fee);
    },
    Err(e) => {
        log::error!("转账到存储财库失败: {:?}", e);
        // 根据业务逻辑决定是否回滚整个交易
        return Err(e.into());
    }
}
```

### 6. 性能优化

- **批量分配**：避免在单个区块中处理过多转账
- **Gas 限制**：确保自动分配不会超过区块 Gas 上限
- **权重计算**：通过 benchmark 精确计算 `on_initialize` 的权重

```rust
// 使用 benchmark 计算实际权重
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_initialize(n: BlockNumberFor<T>) -> Weight {
        let period = T::DistributionPeriod::get();
        if !period.is_zero() && n % period == Zero::zero() {
            if let Some(routes) = StorageRouteTable::<T>::get() {
                let route_count = routes.len() as u64;
                // 每个路由转账消耗约 10,000 权重
                return Weight::from_parts(10_000 * route_count, 0);
            }
        }
        Weight::zero()
    }
}
```

### 7. 安全考虑

- **防止重入攻击**：使用 `ExistenceRequirement::KeepAlive` 确保账户存活
- **金额验证**：在转账前检查金额是否为零
- **账户验证**：验证目标账户的有效性
- **权限检查**：严格限制治理权限的使用

```rust
// 安全检查示例
fn safe_transfer(
    from: &T::AccountId,
    to: &T::AccountId,
    amount: BalanceOf<T>,
) -> DispatchResult {
    // 检查金额
    ensure!(!amount.is_zero(), Error::<T>::InvalidAmount);

    // 检查账户
    ensure!(from != to, Error::<T>::SameAccount);

    // 检查余额
    let balance = T::Currency::free_balance(from);
    ensure!(balance >= amount, Error::<T>::InsufficientBalance);

    // 执行转账
    T::Currency::transfer(from, to, amount, ExistenceRequirement::KeepAlive)?;

    Ok(())
}
```

## 审计与监控

### 资金健康度检查

建议定期进行以下检查：

1. **分配率检查**：累计分配 / 累计收集 > 80%
2. **余额检查**：当前余额 < 累计收集的 20%
3. **路由表验证**：所有 share 总和 ≤ 100%
4. **分配周期检查**：确保自动分配正常执行

### 监控指标

| 指标 | 查询方法 | 正常范围 | 警报阈值 |
|-----|---------|---------|---------|
| 分配率 | distributed / collected | > 80% | < 70% |
| 余额占比 | balance / collected | < 20% | > 30% |
| 路由数量 | routes.len() | 3-5 个 | > 8 个 |
| 分配间隔 | current_block - last_distribution_block | ~100,800 | > 150,000 |

## 安全考虑

### 1. 权限分离

- ✅ **治理权限**（`GovernanceOrigin`）：修改路由表、提取资金
- ✅ **自动执行**：无需人工干预，避免运营账户风险
- ✅ **委员会决策**：民主投票，防止单点操纵

### 2. 路由验证

- ✅ 路由表不能为空
- ✅ 最多 10 个路由条目
- ✅ 所有 share 总和必须 <= 100%
- ✅ 自动检查账户余额，不足则交易失败

### 3. 审计追踪

- ✅ 所有分配记录链上存储（`DistributionHistory`）
- ✅ 事件日志完整记录资金流向
- ✅ 路由表修改历史可追溯（通过事件）

### 4. 资金安全

- ✅ 托管账户无私钥，无法被盗
- ✅ 仅通过链上逻辑操作，透明可审计
- ✅ 治理提取需要多重签名（技术委员会 2/3）

## 未来扩展

### 1. 动态周期调整

```rust
// 添加可调整的分配周期
#[pallet::call_index(3)]
pub fn set_distribution_period(
    origin: OriginFor<T>,
    new_period: BlockNumberFor<T>,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    // 更新周期配置
    Ok(())
}
```

### 2. SLA 绑定

```rust
// 根据存储服务质量（SLA）动态调整分配比例
pub fn adjust_routes_by_sla(
    ipfs_uptime: u8,     // IPFS 在线率
    arweave_uptime: u8,  // Arweave 在线率
) {
    // 在线率高的服务商获得更多分配
    let ipfs_share = Permill::from_percent(ipfs_uptime / 2);
    let arweave_share = Permill::from_percent(arweave_uptime / 2);
    // ...
}
```

### 3. 条件分配

```rust
// 仅当余额超过阈值时才分配
const MIN_BALANCE_FOR_DISTRIBUTION: Balance = 1000_000_000_000;

fn on_initialize(n: BlockNumberFor<T>) -> Weight {
    let balance = Self::current_balance();
    if balance >= MIN_BALANCE_FOR_DISTRIBUTION {
        Self::execute_route_distribution(n);
    }
    Weight::zero()
}
```

## 总结

`pallet-storage-treasury` 提供了一个完整的去中心化存储费用管理解决方案，具有以下核心优势：

- ✅ **完全自动化**：通过链上逻辑自动执行分配，无需人工干预
- ✅ **灵活可配置**：支持多种存储提供商，委员会可动态调整分配规则
- ✅ **透明可审计**：所有资金流向记录在链上，支持完整审计
- ✅ **安全可靠**：使用无私钥托管账户，仅通过链上逻辑操作
- ✅ **治理友好**：重要配置由委员会治理，确保决策民主化
- ✅ **职责单一**：仅管理存储费用，不与其他业务混淆

该模块是 Stardust 区块链存储激励体系的核心组件，为 IPFS、Arweave、Filecoin 等存储服务商提供可持续的激励机制。

通过本模块，可以实现：
- 📊 存储费用专款专用，自动化分配
- 💰 IPFS/Arweave/Filecoin 运营者激励
- 🔍 资金流向透明追踪
- 🛡️ 治理控制和安全保障

---

**相关模块**:
- `pallet-memo-offerings` - 供奉模块（2% 存储费用来源）
- `pallet-stardust-ipfs` - IPFS 管理模块（pin 费用来源）
- `pallet-collective` - 技术委员会（治理权限）

**参考文档**:
- [Substrate 文档](https://docs.substrate.io/)
- [Polkadot SDK](https://github.com/paritytech/polkadot-sdk)
- [IPFS 文档](https://docs.ipfs.tech/)
- [Arweave 文档](https://docs.arweave.org/)
- [Filecoin 文档](https://docs.filecoin.io/)
