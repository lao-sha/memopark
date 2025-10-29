# pallet-storage-treasury

## 模块概述

去中心化存储费用专用账户管理模块，采用**完全自动化路由分配**机制：
- 收集供奉产生的存储费用（通常为 2%）
- 通过路由表自动分配给 IPFS/Arweave/Filecoin 等存储服务提供商
- 资金统计、审计和治理控制
- 委员会民主决策分配规则

## 设计原理

### 完全自动化分配（方案A）

- ✅ **路由表机制**：委员会治理分配规则，链上公开透明
- ✅ **自动执行**：每周自动分配，无需人工干预
- ✅ **职责单一**：仅处理存储费用，与国库、推荐完全隔离
- ✅ **民主治理**：所有分配规则由委员会投票决定

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
    └─ 节点运维激励 20%
```

### 账户派生

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

---

## 接口

### 可调用接口（Extrinsics）

#### 1. `set_storage_route_table` - 设置存储费用路由表

**权限**：需要 `GovernanceOrigin`（Root 或技术委员会 2/3）

**用途**：
- 配置资金自动分配规则
- 调整各存储服务商的分配比例
- 添加或移除分配目标

**参数**：
```rust
set_storage_route_table(
    origin: OriginFor<T>,
    routes: Vec<(u8, T::AccountId, Permill)>,  // [(kind, account, share), ...]
)
```

**路由类型（kind）**：
- `0` = IPFS 运营者池
- `1` = Arweave 运营者池
- `2` = Filecoin 运营者池
- `3` = 节点运维激励池
- `4` = 存储研发基金
- `5-255` = 预留（未来扩展）

**验证规则**：
- ✅ 路由表不能为空
- ✅ 最多 10 个路由条目
- ✅ 所有 share 总和必须 <= 100%

**示例**：
```javascript
// JavaScript 示例
const routes = [
    [0, ipfsPoolAccount,    50_0000], // IPFS 50%（Permill 格式：50% = 500,000/1,000,000）
    [1, arweavePoolAccount, 30_0000], // Arweave 30%
    [3, nodePoolAccount,    20_0000], // 节点运维 20%
];

await api.tx.storageTreasury
    .setStorageRouteTable(routes)
    .signAndSend(sudoAccount);
```

**Rust 示例**：
```rust
// runtime 初始化
pub fn initialize_storage_routes() {
    use sp_runtime::Permill;
    
    let routes = alloc::vec![
        (0u8, ipfs_pool,    Permill::from_percent(50)),
        (1u8, arweave_pool, Permill::from_percent(30)),
        (3u8, node_pool,    Permill::from_percent(20)),
    ];
    
    pallet_storage_treasury::Pallet::<Runtime>::set_storage_route_table(
        frame_system::RawOrigin::Root.into(),
        routes,
    ).ok();
}
```

---

#### 2. `withdraw` - 治理提取资金

**权限**：需要 `GovernanceOrigin`（Root 或技术委员会 2/3）

**用途**：
- 紧急情况下提取资金
- 升级或迁移时转移资金
- 调整资金分配策略

**参数**：
```rust
withdraw(
    origin: OriginFor<T>,
    dest: T::AccountId,     // 目标账户
    amount: BalanceOf<T>,   // 提取金额
)
```

**示例**：
```javascript
// 提取 10,000 DUST 到治理账户
await api.tx.storageTreasury
    .withdraw(governanceAccount, 10_000_000_000_000_000n)
    .signAndSend(sudoAccount);
```

---

### 查询接口（RPC / Chain State）

#### 1. `total_collected()` - 累计收集的总金额

```javascript
const totalCollected = await api.query.storageTreasury.totalCollected();
console.log(`累计收集: ${totalCollected} DUST`);
```

---

#### 2. `total_distributed()` - 累计分配的总金额

```javascript
const totalDistributed = await api.query.storageTreasury.totalDistributed();
console.log(`累计分配: ${totalDistributed} DUST`);
```

---

#### 3. `current_balance()` - 当前账户余额

```javascript
// 方法1：查询托管账户余额
const accountId = api.consts.storageTreasury.storagePalletId;
const account = await api.query.system.account(accountId);
console.log(`当前余额: ${account.data.free} DUST`);
```

---

#### 4. `storage_route_table()` - 当前路由表配置

```javascript
const routes = await api.query.storageTreasury.storageRouteTable();
console.log('当前路由表:');
routes.forEach(route => {
    console.log(`  Type ${route.kind}: ${route.account} = ${route.share.toNumber() / 10000}%`);
});
```

---

#### 5. `distribution_history(block)` - 分配历史记录

```javascript
// 查询最近的分配记录
const lastBlock = await api.query.storageTreasury.lastDistributionBlock();
const history = await api.query.storageTreasury.distributionHistory(lastBlock);

console.log(`最近分配（区块 #${lastBlock}）:
  总金额: ${history.total_amount}
  路由数量: ${history.route_count}
`);
```

---

#### 6. `last_distribution_block()` - 最后分配区块号

```javascript
const lastBlock = await api.query.storageTreasury.lastDistributionBlock();
console.log(`最后分配区块: #${lastBlock}`);
```

---

## 事件

### `RouteTableUpdated` - 路由表更新

```rust
RouteTableUpdated {
    route_count: u32,    // 路由条目数量
}
```

**触发时机**：调用 `set_storage_route_table` 成功后

---

### `RouteDistributed` - 单笔路由分配

```rust
RouteDistributed {
    kind: u8,            // 路由类型
    to: AccountId,       // 接收方
    amount: Balance,     // 金额
}
```

**触发时机**：自动分配时，每个路由都会发出此事件

---

### `AutoDistributionCompleted` - 自动分配完成

```rust
AutoDistributionCompleted {
    block: BlockNumber,   // 分配执行的区块号
    total_amount: Balance,// 总分配金额
    route_count: u32,     // 分配的路由数量
}
```

**触发时机**：每周自动分配完成后

---

### `FundsReceived` - 收到存储费用

```rust
FundsReceived {
    from: AccountId,     // 来源账户
    amount: Balance,     // 金额
}
```

**触发时机**：当供奉路由转入资金时（手动调用）

---

### `Withdrawn` - 治理提取

```rust
Withdrawn {
    to: AccountId,       // 目标账户
    amount: Balance,     // 提取金额
}
```

**触发时机**：调用 `withdraw` 成功后

---

## 错误

| 错误 | 说明 |
|------|------|
| `InsufficientBalance` | 账户余额不足 |
| `InvalidAmount` | 金额无效（为0或过大） |
| `RouteTableTooLong` | 路由表条目超过 10 个 |
| `InvalidRouteTable` | 路由表无效（总和超过 100% 或存在无效值） |
| `EmptyRouteTable` | 路由表为空 |

---

## 自动分配机制

### 执行时机

```
每 100,800 区块执行一次
= 100,800 × 6 秒
= 604,800 秒
= 7 天
```

### 执行逻辑

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

---

## 与其他模块的集成

### 1. `pallet-memo-offerings`（供奉模块）

**集成方式**：通过路由自动转入存储费用

```rust
// runtime/src/configs/mod.rs
RouteEntry {
    kind: 1,
    account: Some(StorageTreasuryAccount::get()),
    share: Permill::from_percent(2),  // 2% 存储费用
},
```

---

### 2. `pallet-stardust-ipfs`（IPFS 存储模块）

**集成方式**：费用接收账户切换到存储专用账户

```rust
impl pallet_memo_ipfs::Config for Runtime {
    type FeeCollector = DecentralizedStorageAccount;  // ✅ 存储专用账户
}
```

---

## 配置示例

### Runtime 配置

```rust
// runtime/src/configs/mod.rs

parameter_types! {
    pub const StorageDistributionPeriod: BlockNumber = 100_800; // 7 天
}

impl pallet_storage_treasury::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type StoragePalletId = DecentralizedStoragePalletId;
    
    // 治理权限：Root | 技术委员会 2/3
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
    
    // 自动分配周期
    type DistributionPeriod = StorageDistributionPeriod;
}
```

---

## 使用场景

### 场景1：初始化路由表

```rust
// 链初始化时调用
pub fn initialize_storage_routes() {
    let routes = alloc::vec![
        (0u8, ipfs_pool,    Permill::from_percent(50)),
        (1u8, arweave_pool, Permill::from_percent(30)),
        (3u8, node_pool,    Permill::from_percent(20)),
    ];
    
    pallet_storage_treasury::Pallet::<Runtime>::set_storage_route_table(
        frame_system::RawOrigin::Root.into(),
        routes,
    ).ok();
}
```

---

### 场景2：调整分配比例（委员会提案）

```javascript
// 前端提交治理提案
const proposal = api.tx.storageTreasury.setStorageRouteTable([
    [0, ipfsPoolAccount,    60_0000], // IPFS 提升到 60%
    [1, arweavePoolAccount, 20_0000], // Arweave 降低到 20%
    [3, nodePoolAccount,    20_0000], // 节点运维保持 20%
]);

// 提交到技术委员会
await api.tx.council.propose(
    3,  // 需要 3 票通过（假设委员会有 5 人，2/3 = 3.33）
    proposal,
    proposal.length
).signAndSend(councilMember);
```

---

### 场景3：查询分配状态

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

---

## 审计与监控

### 资金健康度检查

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

---

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

---

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

---

## 总结

`pallet-storage-treasury`（方案A）是一个完全自动化的去中心化存储费用管理模块，具有以下特点：

- ✅ **完全自动化**：每周自动分配，无需人工干预
- ✅ **委员会治理**：分配规则由委员会民主决策
- ✅ **职责单一**：仅管理存储费用，不与其他业务混淆
- ✅ **透明可审计**：所有规则和执行记录链上公开
- ✅ **安全可控**：权限分离、规则验证、治理监督

通过本模块，可以实现：
- 📊 存储费用专款专用，自动化分配
- 💰 IPFS/Arweave 运营者激励
- 🔍 资金流向透明追踪
- 🛡️ 治理控制和安全保障
