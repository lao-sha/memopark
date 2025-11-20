# pallet-dust-bridge

**DUST 跨链桥接模块（Stardust ↔ Arbitrum）**

## 模块概述

`pallet-dust-bridge` 实现了 Stardust 链原生 DUST 代币与 Arbitrum 链 ERC20 DUST 代币之间的跨链桥接服务。该模块采用**锁定-铸造（Lock & Mint）**模型，通过 Off-Chain Worker (OCW) 自动化中继交易，并引入治理监督机制确保桥接账户的安全管理。

### 核心功能

1. **双向跨链桥接**
   - **Stardust → Arbitrum**：锁定原生 DUST，在 Arbitrum 上铸造 ERC20 DUST
   - **Arbitrum → Stardust**：销毁 ERC20 DUST，从 Stardust 解锁原生 DUST

2. **OCW 自动化中继**
   - 监听链上桥接请求事件
   - 自动调用 Arbitrum 合约完成跨链铸造
   - 监听 Arbitrum 事件并触发解锁操作

3. **多签桥接账户**
   - 桥接资金由多签账户控制（推荐 M-of-N 多签）
   - 需要多个签名者授权才能动用资金

4. **治理监督机制**
   - 社区投票决策桥接账户设置
   - 紧急暂停/恢复桥接功能
   - 金额限制调整提案
   - 审计日志记录所有关键操作

5. **安全防护**
   - 防重放攻击（记录已处理交易）
   - 金额限制（最小/最大桥接金额）
   - 超时保护（超时自动失败并可退款）
   - 桥接暂停机制（应急措施）

---

## 锁定-铸造模型详解

### 正向流程（Stardust → Arbitrum）

```
用户 (Stardust)                 OCW                    Arbitrum 合约
     |                           |                            |
     |--1. bridge_to_arbitrum--->|                            |
     |   (锁定 DUST)              |                            |
     |                           |                            |
     |<--2. BridgeRequested------|                            |
     |   (事件触发)               |                            |
     |                           |                            |
     |                           |--3. call_arbitrum_mint---->|
     |                           |    (调用 mint())           |
     |                           |                            |
     |                           |<--4. Arbitrum TX Hash------|
     |                           |                            |
     |<--5. BridgeCompleted------|                            |
     |   (状态更新)               |                            |
```

**详细步骤**：

1. **用户发起桥接**（`bridge_to_arbitrum`）
   - 验证金额在 `MinBridgeAmount` 和 `MaxBridgeAmount` 之间
   - 验证以太坊地址格式（0x + 40个十六进制字符）
   - 将 DUST 转账至 `BridgeLockAccount`（多签账户）
   - 创建 `BridgeRequest` 记录（状态：`Pending`）
   - 触发 `BridgeRequested` 事件

2. **OCW 监听并处理**
   - `offchain_worker` 每个区块扫描 `Pending` 状态请求
   - 构建 Arbitrum `mint(bridgeId, to, amount)` 调用
   - 使用 ECDSA 签名交易并发送到 Arbitrum RPC
   - 等待交易确认后获取交易哈希

3. **状态更新**（`ocw_update_bridge_status`）
   - OCW 提交无签名交易更新链上状态
   - 状态从 `Pending` → `Completed`
   - 记录 Arbitrum 交易哈希
   - 触发 `BridgeCompleted` 事件

### 反向流程（Arbitrum → Stardust）

```
用户 (Arbitrum)                 OCW                   Stardust 链
     |                           |                            |
     |--1. burn()------------------->|                        |
     |   (销毁 ERC20 DUST)           |                        |
     |                               |                        |
     |<--2. BridgeBack Event---------|                        |
     |                               |                        |
     |                               |--3. unlock_from_------>|
     |                               |    arbitrum            |
     |                               |    (无签名交易)        |
     |                               |                        |
     |                               |<--4. DUST 转账---------|
     |                               |    (从桥接账户)        |
     |                               |                        |
     |<------------------------------5. BridgeUnlocked--------|
     |                                   (事件通知)           |
```

**详细步骤**：

1. **用户在 Arbitrum 销毁 DUST**
   - 调用 Arbitrum 合约 `burn(amount, substrateAddress)`
   - 合约触发 `BridgeBack` 事件

2. **OCW 监听 Arbitrum 事件**
   - 定期查询 Arbitrum 最新区块的事件日志
   - 解析 `BridgeBack(address from, uint256 amount, bytes substrateAddress)` 事件
   - 提取关键信息：交易哈希、接收地址、金额

3. **OCW 提交解锁交易**（`unlock_from_arbitrum`）
   - 提交无签名交易到 Stardust 链
   - 验证交易哈希未被处理（防重放）
   - 从 `BridgeLockAccount` 转账 DUST 给用户
   - 记录交易哈希到 `ProcessedArbitrumTxs`
   - 触发 `BridgeUnlocked` 事件

---

## OCW 中继机制

### OCW 工作流程

Off-Chain Worker 在每个区块执行 `offchain_worker` hook，执行以下任务：

```rust
fn offchain_worker(block_number: BlockNumberFor<T>) {
    // 1. 处理待处理的桥接请求（Stardust → Arbitrum）
    Self::process_pending_bridges();

    // 2. 监听 Arbitrum 事件（Arbitrum → Stardust）
    Self::process_arbitrum_events();
}
```

### 1. 处理 Stardust → Arbitrum 桥接

**扫描策略**：
- 扫描最近 100 个桥接请求
- 筛选 `status == Pending` 的请求
- 检查是否超时（`current_block > created_at + BridgeTimeout`）

**处理逻辑**：
```rust
for bridge_id in start_id..next_id {
    if request.status == Pending {
        // 检查超时
        if current_block >= request.created_at + BridgeTimeout {
            // 标记为失败
            submit_update_bridge_status(bridge_id, Failed, None);
            continue;
        }

        // 调用 Arbitrum 合约
        match call_arbitrum_mint(&request) {
            Ok(tx_hash) => {
                // 更新为 Completed
                submit_update_bridge_status(bridge_id, Completed, Some(tx_hash));
            }
            Err(_) => {
                // 标记为 Processing（可重试）
                submit_update_bridge_status(bridge_id, Processing, None);
            }
        }
    }
}
```

**Arbitrum 交易构建**：
1. 从 `ArbitrumBridgeAddress` 获取合约地址
2. 构建 `mint(uint64 bridgeId, address to, uint256 amount)` 调用数据
3. 使用 `sp_io::crypto::ecdsa_sign` 签名交易
4. 通过 HTTP 请求发送到 Arbitrum RPC
5. 解析响应获取交易哈希

### 2. 监听 Arbitrum 事件

**查询策略**：
- 定期查询 Arbitrum 最新区块
- 获取桥接合约的 `BridgeBack` 事件
- 解析事件参数并提交解锁交易

**事件解析**：
```solidity
// Arbitrum 合约事件
event BridgeBack(
    address indexed from,
    uint256 amount,
    bytes substrateAddress
);
```

**处理逻辑**：
```rust
// 查询 Arbitrum 事件
let events = query_arbitrum_events(bridge_contract, "BridgeBack");

for event in events {
    let tx_hash = event.transaction_hash;
    let amount = decode_amount(event.data);
    let substrate_address = decode_address(event.data);

    // 提交无签名交易解锁 DUST
    submit_unlock_dust(tx_hash, substrate_address, amount);
}
```

### 无签名交易验证

OCW 提交的交易通过 `ValidateUnsigned` trait 验证：

```rust
impl ValidateUnsigned for Pallet<T> {
    fn validate_unsigned(call: &Call<T>) -> TransactionValidity {
        match call {
            Call::ocw_update_bridge_status { bridge_id, .. } => {
                // 验证桥接 ID 存在
                ensure!(BridgeRequests::contains_key(bridge_id));
                ValidTransaction::with_tag_prefix("DustBridgeOCW")
                    .priority(100)
                    .longevity(5)
                    .build()
            }
            Call::unlock_from_arbitrum { arbitrum_tx_hash, .. } => {
                // 验证交易哈希未被处理（防重放）
                ensure!(!ProcessedArbitrumTxs::contains_key(tx_hash));
                ValidTransaction::with_tag_prefix("DustBridgeOCW")
                    .priority(100)
                    .longevity(5)
                    .build()
            }
            _ => InvalidTransaction::Call.into(),
        }
    }
}
```

---

## 多签安全机制

### 桥接账户设计

桥接账户 (`BridgeLockAccount`) 是所有锁定 DUST 的托管账户，必须采用**多签（Multisig）**架构：

**推荐配置**：
- **3-of-5 多签**：5个签名者中至少3个签名才能动用资金
- **5-of-7 多签**：7个签名者中至少5个签名（更高安全性）

### 多签账户创建

使用 Substrate 内置 `pallet-multisig`：

```rust
// 创建多签账户示例
let signatories = vec![
    alice_account,
    bob_account,
    charlie_account,
    dave_account,
    eve_account,
];
let threshold = 3; // 需要3个签名

// 多签账户地址由签名者和阈值确定
let multisig_account = Multisig::multi_account_id(&signatories, threshold);
```

### 设置桥接账户

通过治理提案设置桥接账户：

```rust
// 步骤1：创建提案
Pallet::create_proposal(
    origin,
    ProposalType::SetBridgeAccount,
    description_cid,  // IPFS 上的提案说明
    encode(multisig_account), // 多签账户地址
)?;

// 步骤2：社区投票
Pallet::vote(origin, proposal_id, VoteOption::Aye)?;

// 步骤3：执行提案（投票通过后）
Pallet::execute_proposal(origin, proposal_id)?;
// 内部调用 set_bridge_lock_account(multisig_account)
```

### 资金操作流程

所有涉及桥接账户的资金操作都需要多签授权：

**紧急提取资金**（最高权限）：
```rust
// 步骤1：创建提取提案
let params = encode((recipient_account, amount));
Pallet::create_proposal(
    origin,
    ProposalType::WithdrawFunds,
    description_cid,
    params,
)?;

// 步骤2：治理投票（需要达到 approval_threshold）
// 步骤3：执行提案后，资金从多签账户转移
```

---

## 数据结构

### BridgeRequest（桥接请求）

记录 Stardust → Arbitrum 的桥接请求：

```rust
pub struct BridgeRequest<AccountId, Balance, BlockNumber> {
    /// 桥接唯一 ID
    pub id: u64,
    /// 发起桥接的 Substrate 账户
    pub user: AccountId,
    /// 锁定的 DUST 数量
    pub amount: Balance,
    /// Arbitrum 接收地址（ERC20 地址）
    pub target_address: EthAddress,  // BoundedVec<u8, 42>
    /// 桥接状态
    pub status: BridgeStatus,
    /// 创建区块号
    pub created_at: BlockNumber,
    /// Arbitrum 交易哈希（完成后填充）
    pub arbitrum_tx_hash: Option<EthTxHash>,  // BoundedVec<u8, 66>
}
```

### BridgeStatus（桥接状态）

```rust
pub enum BridgeStatus {
    /// 待处理（等待 OCW 处理）
    Pending,
    /// 处理中（OCW 正在调用 Arbitrum 合约）
    Processing,
    /// 已完成（Arbitrum 交易已确认）
    Completed,
    /// 失败（Arbitrum 交易失败或超时）
    Failed,
}
```

### GovernanceProposal（治理提案）

```rust
pub struct GovernanceProposal<AccountId, Balance, BlockNumber> {
    /// 提案 ID
    pub proposal_id: u64,
    /// 提案者
    pub proposer: AccountId,
    /// 提案类型
    pub proposal_type: ProposalType,
    /// 提案描述（IPFS CID）
    pub description_cid: BoundedVec<u8, ConstU32<64>>,
    /// 提案参数（编码后的数据）
    pub params: BoundedVec<u8, ConstU32<256>>,
    /// 状态
    pub status: ProposalStatus,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 投票截止时间
    pub voting_deadline: BlockNumber,
    /// 赞成/反对/弃权票数
    pub aye_votes: Balance,
    pub nay_votes: Balance,
    pub abstain_votes: Balance,
    /// 执行时间（可选）
    pub executed_at: Option<BlockNumber>,
}
```

### ProposalType（提案类型）

```rust
pub enum ProposalType {
    /// 设置桥接账户
    SetBridgeAccount,
    /// 紧急暂停桥接
    EmergencyPause,
    /// 恢复桥接
    ResumeBridge,
    /// 调整金额限制
    AdjustLimits,
    /// 提取资金（需要最高权限）
    WithdrawFunds,
}
```

---

## 存储项

### 核心存储

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `NextBridgeId` | `StorageValue<u64>` | 下一个桥接 ID |
| `BridgeLockAccount` | `StorageValue<AccountId>` | 桥接锁定账户（多签） |
| `BridgeRequests` | `StorageMap<u64, BridgeRequest>` | 桥接请求记录 |
| `UserBridges` | `StorageMap<AccountId, Vec<u64>>` | 用户桥接列表（最多100个） |
| `ProcessedArbitrumTxs` | `StorageMap<EthTxHash, ()>` | 已处理的 Arbitrum 交易哈希 |
| `ArbitrumBridgeAddress` | `StorageValue<EthAddress>` | Arbitrum 桥接合约地址 |
| `BridgePaused` | `StorageValue<bool>` | 桥接是否暂停 |

### 治理存储

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `NextProposalId` | `StorageValue<u64>` | 下一个提案 ID |
| `Proposals` | `StorageMap<u64, GovernanceProposal>` | 治理提案记录 |
| `Votes` | `StorageDoubleMap<u64, AccountId, VoteRecord>` | 投票记录 |
| `GovernanceConfigStorage` | `StorageValue<GovernanceConfig>` | 治理配置 |
| `NextAuditId` | `StorageValue<u64>` | 下一个审计 ID |
| `AuditLogs` | `StorageMap<u64, AuditRecord>` | 审计日志 |

---

## 主要调用方法

### 用户调用

#### `bridge_to_arbitrum`

发起 Stardust → Arbitrum 桥接：

```rust
/// 桥接到 Arbitrum
///
/// # 参数
/// - `amount`: DUST 数量
/// - `eth_address`: Arbitrum 接收地址（0x开头的42字节十六进制字符串）
///
/// # 返回
/// - `Ok(())`: 成功，触发 BridgeRequested 事件
/// - `Err(BelowMinimumAmount)`: 金额低于最小值
/// - `Err(AboveMaximumAmount)`: 金额超过最大值
/// - `Err(InvalidEthAddress)`: 以太坊地址无效
/// - `Err(BridgeAccountNotSet)`: 桥接账户未设置
/// - `Err(BridgePaused)`: 桥接已暂停
#[pallet::call_index(0)]
pub fn bridge_to_arbitrum(
    origin: OriginFor<T>,
    amount: BalanceOf<T>,
    eth_address: Vec<u8>,  // "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
) -> DispatchResult
```

**示例**：
```rust
// 桥接 1000 DUST 到 Arbitrum
let amount = 1_000 * 10u128.pow(12); // 1000 DUST（12位小数）
let eth_address = b"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb".to_vec();

Pallet::bridge_to_arbitrum(
    RuntimeOrigin::signed(alice_account),
    amount,
    eth_address,
)?;
```

### OCW 调用（无签名）

#### `unlock_from_arbitrum`

从 Arbitrum 解锁 DUST：

```rust
/// 从 Arbitrum 解锁 DUST
///
/// # 参数
/// - `arbitrum_tx_hash`: Arbitrum 交易哈希
/// - `substrate_address`: Substrate 接收地址
/// - `amount`: DUST 数量
///
/// # 返回
/// - `Ok(())`: 成功，触发 BridgeUnlocked 事件
/// - `Err(InvalidTxHash)`: 交易哈希无效
/// - `Err(TxAlreadyProcessed)`: 交易已处理（防重放）
#[pallet::call_index(1)]
pub fn unlock_from_arbitrum(
    origin: OriginFor<T>,
    arbitrum_tx_hash: Vec<u8>,
    substrate_address: T::AccountId,
    amount: BalanceOf<T>,
) -> DispatchResult
```

#### `ocw_update_bridge_status`

OCW 更新桥接状态：

```rust
/// OCW 更新桥接状态
///
/// # 参数
/// - `bridge_id`: 桥接 ID
/// - `status`: 新状态
/// - `arbitrum_tx_hash`: Arbitrum 交易哈希（可选）
#[pallet::call_index(4)]
pub fn ocw_update_bridge_status(
    origin: OriginFor<T>,
    bridge_id: u64,
    status: BridgeStatus,
    arbitrum_tx_hash: Option<Vec<u8>>,
) -> DispatchResult
```

### 治理调用

#### `set_bridge_lock_account`

设置桥接账户（治理权限）：

```rust
/// 设置桥接账户
///
/// # 权限
/// 需要 `GovernanceOrigin` 权限
///
/// # 参数
/// - `account`: 桥接账户（建议使用多签账户）
#[pallet::call_index(2)]
pub fn set_bridge_lock_account(
    origin: OriginFor<T>,
    account: T::AccountId,
) -> DispatchResult
```

#### `set_arbitrum_bridge_address`

设置 Arbitrum 桥接合约地址（治理权限）：

```rust
/// 设置 Arbitrum 桥接合约地址
///
/// # 权限
/// 需要 `GovernanceOrigin` 权限
///
/// # 参数
/// - `address`: Arbitrum 合约地址（0x开头的42字节十六进制字符串）
#[pallet::call_index(3)]
pub fn set_arbitrum_bridge_address(
    origin: OriginFor<T>,
    address: Vec<u8>,
) -> DispatchResult
```

### 社区治理调用

#### `create_proposal`

创建治理提案：

```rust
/// 创建治理提案
///
/// # 参数
/// - `proposal_type`: 提案类型
/// - `description_cid`: 提案描述 IPFS CID
/// - `params`: 提案参数（编码后的数据）
///
/// # 返回
/// - `Ok(())`: 成功，触发 ProposalCreated 事件
/// - `Err(InsufficientBalance)`: 余额不足以支付押金
#[pallet::call_index(5)]
pub fn create_proposal(
    origin: OriginFor<T>,
    proposal_type: ProposalType,
    description_cid: Vec<u8>,
    params: Vec<u8>,
) -> DispatchResult
```

#### `vote`

对提案投票：

```rust
/// 投票
///
/// # 参数
/// - `proposal_id`: 提案 ID
/// - `vote`: 投票选项（Aye/Nay/Abstain）
///
/// # 返回
/// - `Ok(())`: 成功，触发 Voted 事件
/// - `Err(ProposalNotFound)`: 提案不存在
/// - `Err(AlreadyVoted)`: 已投票
/// - `Err(VotingExpired)`: 投票已过期
#[pallet::call_index(6)]
pub fn vote(
    origin: OriginFor<T>,
    proposal_id: u64,
    vote: VoteOption,
) -> DispatchResult
```

#### `execute_proposal`

执行提案：

```rust
/// 执行提案
///
/// # 参数
/// - `proposal_id`: 提案 ID
///
/// # 返回
/// - `Ok(())`: 成功，触发 ProposalExecuted 或 ProposalRejected 事件
/// - `Err(VotingNotEnded)`: 投票未结束
/// - `Err(InsufficientTurnout)`: 投票率不足
#[pallet::call_index(7)]
pub fn execute_proposal(
    origin: OriginFor<T>,
    proposal_id: u64,
) -> DispatchResult
```

---

## 事件定义

| 事件 | 参数 | 说明 |
|------|------|------|
| `BridgeRequested` | `bridge_id`, `user`, `amount`, `target_address` | 桥接请求已创建（Stardust → Arbitrum） |
| `BridgeCompleted` | `bridge_id`, `arbitrum_tx_hash` | 桥接已完成（OCW 已铸造 ERC20 DUST） |
| `BridgeFailed` | `bridge_id`, `reason` | 桥接失败 |
| `BridgeUnlocked` | `arbitrum_tx_hash`, `user`, `amount` | DUST 已解锁（Arbitrum → Stardust） |
| `BridgeLockAccountSet` | `account` | 桥接账户已设置 |
| `ArbitrumBridgeAddressSet` | `address` | Arbitrum 桥接合约地址已设置 |
| `ProposalCreated` | `proposal_id`, `proposer`, `proposal_type` | 治理提案已创建 |
| `Voted` | `proposal_id`, `voter`, `vote`, `weight` | 已投票 |
| `ProposalExecuted` | `proposal_id` | 提案已执行 |
| `ProposalRejected` | `proposal_id` | 提案已拒绝 |
| `BridgePaused` | - | 桥接已暂停 |
| `BridgeResumed` | - | 桥接已恢复 |
| `LimitsAdjusted` | `min_amount`, `max_amount` | 限制已调整 |
| `FundsWithdrawn` | `to`, `amount` | 资金已提取 |

---

## 错误定义

| 错误 | 说明 |
|------|------|
| `BelowMinimumAmount` | 金额低于最小值 |
| `AboveMaximumAmount` | 金额超过最大值 |
| `InvalidEthAddress` | 以太坊地址无效 |
| `InvalidTxHash` | 交易哈希无效 |
| `BridgeAccountNotSet` | 桥接账户未设置 |
| `BridgeNotFound` | 桥接不存在 |
| `InvalidBridgeStatus` | 桥接状态不正确 |
| `NotAuthorized` | 未授权 |
| `TxAlreadyProcessed` | 交易已处理（防重放） |
| `TooManyBridges` | 桥接列表已满（最多100个） |
| `ArbitrumBridgeAddressNotSet` | Arbitrum 桥接合约地址未设置 |
| `BridgeTimeout` | 桥接超时 |
| `BridgePaused` | 桥接已暂停 |
| `ProposalNotFound` | 提案不存在 |
| `ProposalNotActive` | 提案未激活 |
| `VotingExpired` | 投票已过期 |
| `AlreadyVoted` | 已投票 |
| `InvalidProposalStatus` | 提案状态不正确 |
| `VotingNotEnded` | 投票未结束 |
| `InsufficientTurnout` | 投票率不足 |
| `InvalidAmount` | 金额无效 |
| `InsufficientBalance` | 余额不足 |
| `InvalidParams` | 参数无效 |

---

## 配置参数

### Runtime 配置

```rust
impl pallet_dust_bridge::Config for Runtime {
    type Currency = Balances;
    type GovernanceOrigin = EnsureRoot<AccountId>;
    type MinBridgeAmount = ConstU128<{ 100 * DUST }>;     // 最小桥接：100 DUST
    type MaxBridgeAmount = ConstU128<{ 100_000 * DUST }>; // 最大桥接：100,000 DUST
    type BridgeTimeout = ConstU32<{ 7 * DAYS }>;          // 超时时间：7天
}
```

### 治理配置

默认治理参数（可通过 `set_governance_config` 调整）：

```rust
GovernanceConfig {
    voting_period: 7 * 24 * 600,        // 投票期限：7天（假设6秒/区块）
    approval_threshold: 6667,           // 通过阈值：66.67%
    min_turnout: 3000,                  // 最小投票率：30%
    proposal_deposit: 10_000 * DUST,    // 提案押金：10,000 DUST
    require_council_approval: true,     // 需要理事会预批准
}
```

---

## 使用示例

### 1. 初始化桥接系统

**步骤1：创建多签账户**

```rust
use pallet_multisig;

// 定义签名者
let signatories = vec![
    alice(),
    bob(),
    charlie(),
    dave(),
    eve(),
];
let threshold = 3; // 3-of-5

// 计算多签账户地址
let multisig_account = Multisig::multi_account_id(&signatories, threshold);
```

**步骤2：设置桥接账户**

```rust
// 治理调用（需要 GovernanceOrigin 权限）
DustBridge::set_bridge_lock_account(
    RuntimeOrigin::root(),
    multisig_account,
)?;
```

**步骤3：设置 Arbitrum 合约地址**

```rust
// 假设在 Arbitrum 上已部署 DUSTBridge 合约
let arbitrum_contract = b"0x1234567890abcdef1234567890abcdef12345678".to_vec();

DustBridge::set_arbitrum_bridge_address(
    RuntimeOrigin::root(),
    arbitrum_contract,
)?;
```

### 2. 用户发起跨链桥接

**场景：Alice 想将 5000 DUST 从 Stardust 桥接到 Arbitrum**

```rust
// Alice 的 Arbitrum 地址
let alice_eth_address = b"0xabc1234567890abcdef1234567890abcdef12345".to_vec();

// 桥接金额：5000 DUST
let amount = 5_000 * 10u128.pow(12); // DUST 有 12 位小数

// 发起桥接
DustBridge::bridge_to_arbitrum(
    RuntimeOrigin::signed(alice()),
    amount,
    alice_eth_address,
)?;

// 事件：BridgeRequested { bridge_id: 0, user: alice(), amount: 5000 DUST, ... }
```

**后续流程（自动）**：
1. OCW 在下一个区块检测到 `BridgeRequested` 事件
2. OCW 调用 Arbitrum 合约 `mint(0, 0xabc..., 5000000000000000000000)` （5000 DUST，18位小数）
3. OCW 提交无签名交易更新状态为 `Completed`
4. 事件：`BridgeCompleted { bridge_id: 0, arbitrum_tx_hash: "0x..." }`

### 3. 用户从 Arbitrum 桥接回 Stardust

**场景：Bob 在 Arbitrum 上持有 3000 ERC20 DUST，想桥接回 Stardust**

**步骤1：在 Arbitrum 上销毁 DUST**

```solidity
// Arbitrum 合约调用（使用 Web3 或 MetaMask）
// Bob 的 Substrate 地址编码为 bytes
bytes memory substrateAddress = hex"d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"; // Bob 的 SS58 地址

DUSTBridge.burn(3000 ether, substrateAddress);
// 事件：BridgeBack(msg.sender, 3000 ether, substrateAddress)
```

**步骤2：OCW 自动处理**

OCW 监听到 Arbitrum `BridgeBack` 事件后：

```rust
// OCW 提交无签名交易
DustBridge::unlock_from_arbitrum(
    RuntimeOrigin::none(),
    arbitrum_tx_hash,  // 从事件获取
    bob_account,       // 从事件解析
    3_000 * DUST,
)?;

// 事件：BridgeUnlocked { arbitrum_tx_hash: "0x...", user: bob(), amount: 3000 DUST }
```

### 4. 治理操作示例

**场景：社区提议调整桥接金额限制**

**步骤1：创建提案**

```rust
use codec::Encode;

// 新的金额限制
let new_min = 50 * DUST;   // 最小：50 DUST
let new_max = 500_000 * DUST; // 最大：500,000 DUST
let params = (new_min, new_max).encode();

// 提案描述（存储在 IPFS）
let description_cid = b"QmXxxxx...".to_vec(); // IPFS CID

// 创建提案（需要 10,000 DUST 押金）
DustBridge::create_proposal(
    RuntimeOrigin::signed(proposer()),
    ProposalType::AdjustLimits,
    description_cid,
    params,
)?;

// 事件：ProposalCreated { proposal_id: 0, proposer, proposal_type: AdjustLimits }
```

**步骤2：社区投票**

```rust
// Alice 投赞成票（权重按持币量计算）
DustBridge::vote(
    RuntimeOrigin::signed(alice()),
    0, // proposal_id
    VoteOption::Aye,
)?;

// Bob 投反对票
DustBridge::vote(
    RuntimeOrigin::signed(bob()),
    0,
    VoteOption::Nay,
)?;

// 事件：Voted { proposal_id: 0, voter: alice(), vote: Aye, weight: 10000 DUST }
```

**步骤3：执行提案**

```rust
// 7 天投票期结束后，任何人都可以触发执行
DustBridge::execute_proposal(
    RuntimeOrigin::signed(anyone()),
    0, // proposal_id
)?;

// 如果赞成票 ≥ 66.67% 且投票率 ≥ 30%：
// 事件：ProposalExecuted { proposal_id: 0 }
// 事件：LimitsAdjusted { min_amount: 50 DUST, max_amount: 500000 DUST }

// 否则：
// 事件：ProposalRejected { proposal_id: 0 }
```

**步骤4：紧急暂停桥接**

```rust
// 创建紧急暂停提案
DustBridge::create_proposal(
    RuntimeOrigin::signed(emergency_proposer()),
    ProposalType::EmergencyPause,
    description_cid,
    vec![], // 无参数
)?;

// 投票通过后执行：
// 事件：BridgePaused
```

### 5. 查询桥接状态

```rust
// 查询用户的所有桥接请求
let user_bridges = DustBridge::get_user_bridges(&alice());
// 返回：[0, 1, 5, 10] (bridge IDs)

// 查询单个桥接详情
let bridge = DustBridge::bridge_requests(0).unwrap();
// BridgeRequest {
//     id: 0,
//     user: alice(),
//     amount: 5000 DUST,
//     target_address: "0xabc...",
//     status: Completed,
//     created_at: 12345,
//     arbitrum_tx_hash: Some("0x..."),
// }

// 检查 Arbitrum 交易是否已处理
let is_processed = DustBridge::is_tx_processed(&tx_hash);
// 返回：true / false
```

---

## 与 Arbitrum 链集成

### Arbitrum 智能合约接口

**DUSTBridge.sol**（Solidity 合约）：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DUSTBridge is Ownable {
    ERC20 public dustToken;

    // 事件：桥接到 Arbitrum（Stardust → Arbitrum）
    event BridgeMinted(
        uint64 indexed bridgeId,
        address indexed to,
        uint256 amount
    );

    // 事件：桥接回 Stardust（Arbitrum → Stardust）
    event BridgeBack(
        address indexed from,
        uint256 amount,
        bytes substrateAddress
    );

    constructor(address _dustToken) {
        dustToken = ERC20(_dustToken);
    }

    /// 铸造 DUST（由桥接服务调用）
    function mint(uint64 bridgeId, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");

        // 铸造 ERC20 DUST
        DUST(address(dustToken)).mint(to, amount);

        emit BridgeMinted(bridgeId, to, amount);
    }

    /// 销毁 DUST 并桥接回 Stardust
    function burn(uint256 amount, bytes calldata substrateAddress) external {
        require(amount > 0, "Invalid amount");
        require(substrateAddress.length == 32, "Invalid Substrate address");

        // 销毁用户的 ERC20 DUST
        DUST(address(dustToken)).burnFrom(msg.sender, amount);

        emit BridgeBack(msg.sender, amount, substrateAddress);
    }
}

// DUST ERC20 代币合约
contract DUST is ERC20, Ownable {
    constructor() ERC20("DUST Token", "DUST") {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
```

### OCW 与 Arbitrum 交互

**1. 监听 Arbitrum 事件**

OCW 定期查询 Arbitrum 节点：

```rust
// 构建 eth_getLogs 请求
let request_body = format!(
    r#"{{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_getLogs",
        "params": [{{
            "address": "{}",
            "fromBlock": "{}",
            "toBlock": "latest",
            "topics": ["{}"]
        }}]
    }}"#,
    bridge_contract_address,
    last_processed_block,
    keccak256("BridgeBack(address,uint256,bytes)"), // 事件签名
);

// 发送 HTTP 请求
let response = http::Request::post("https://arb1.arbitrum.io/rpc", vec![request_body])
    .send()
    .wait()?;

// 解析响应
let logs = parse_json_response(response.body());
for log in logs {
    let tx_hash = log.transaction_hash;
    let amount = decode_uint256(log.data[0..32]);
    let substrate_address = decode_bytes(log.data[32..]);

    // 提交解锁交易
    submit_unlock_dust(tx_hash, substrate_address, amount)?;
}
```

**2. 调用 Arbitrum 合约**

OCW 构建并发送 Arbitrum 交易：

```rust
// 1. 构建 mint(uint64,address,uint256) 调用数据
let function_selector = keccak256("mint(uint64,address,uint256)")[0..4];
let calldata = encode_abi(
    function_selector,
    [bridge_id, to_address, amount],
);

// 2. 构建交易
let tx = EthTransaction {
    nonce: get_nonce(),
    gas_price: get_gas_price(),
    gas_limit: 200_000,
    to: bridge_contract_address,
    value: 0,
    data: calldata,
    chain_id: 42161, // Arbitrum One
};

// 3. 签名交易（使用桥接服务的私钥）
let signed_tx = ecdsa_sign(tx, bridge_service_key)?;

// 4. 发送到 Arbitrum RPC
let request_body = format!(
    r#"{{"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":["{}"]}}"#,
    hex::encode(signed_tx),
);

let response = http::Request::post("https://arb1.arbitrum.io/rpc", vec![request_body])
    .send()
    .wait()?;

// 5. 解析交易哈希
let tx_hash = parse_tx_hash(response.body())?;
```

---

## 最佳实践

### 1. 安全建议

**多签配置**：
- 使用至少 **3-of-5** 多签账户作为 `BridgeLockAccount`
- 签名者应来自不同地理位置和组织
- 定期轮换签名者密钥

**金额限制**：
- 设置合理的 `MinBridgeAmount`（如 100 DUST）防止粉尘攻击
- 设置 `MaxBridgeAmount`（如 100,000 DUST）控制单笔风险
- 根据桥接量动态调整限制

**监控告警**：
- 监控桥接账户余额，余额不足时触发告警
- 监控 OCW 运行状态，确保中继服务正常
- 审计所有大额桥接操作（> 10,000 DUST）

### 2. 运维建议

**OCW 部署**：
- 至少部署 **3 个独立 OCW 节点**，避免单点故障
- OCW 节点需要稳定的 Arbitrum RPC 连接
- 使用高可用 Arbitrum RPC 服务（Infura、Alchemy、QuickNode）

**Gas 费管理**：
- OCW 桥接服务账户需要持有足够的 ETH 支付 Arbitrum Gas 费
- 设置 Gas 价格上限，避免高峰期成本失控
- 定期补充 ETH 余额

**故障恢复**：
- 定期备份桥接请求数据
- 超时的桥接请求可通过治理提案手动退款
- 记录所有 Arbitrum 交易哈希，便于溯源

### 3. 治理建议

**提案流程**：
1. 社区成员在论坛讨论提案
2. 提案者将详细说明上传到 IPFS
3. 创建链上提案，锁定押金
4. 7 天投票期，社区投票
5. 投票通过后执行提案

**投票权重**：
- 投票权重与持币量成正比
- 鼓励长期持有者参与治理（可考虑引入锁仓机制）

**紧急响应**：
- 重大安全事件可通过 `EmergencyPause` 提案快速暂停桥接
- 设置快速投票通道（如 24 小时紧急提案）

### 4. 用户建议

**桥接前**：
- 确认 Arbitrum 地址正确（错误地址会导致资金丢失）
- 检查金额在最小/最大限制之间
- 确保账户有足够余额支付交易费

**桥接中**：
- 记录 `bridge_id`，用于查询状态
- 等待 OCW 处理（通常 1-5 分钟）
- 关注 `BridgeCompleted` 事件

**桥接后**：
- 在 Arbitrum 区块浏览器验证 ERC20 DUST 余额
- 保存 Arbitrum 交易哈希，便于溯源

**桥接回 Stardust**：
- 在 Arbitrum 上调用 `burn()` 函数时，仔细填写 Substrate 地址（32字节）
- 使用 SS58 地址的十六进制编码（可通过 Polkadot.js 获取）
- 等待 OCW 处理（通常 1-5 分钟）

---

## 审计日志

所有关键操作都记录在 `AuditLogs` 中，包括：

- 桥接账户设置
- Arbitrum 合约地址更新
- 大额桥接操作（> 10,000 DUST）
- 治理提案执行
- 桥接暂停/恢复
- 资金提取

审计日志结构：

```rust
pub struct AuditRecord<AccountId, Balance, BlockNumber> {
    pub audit_id: u64,
    pub operation: BoundedVec<u8, ConstU32<64>>,  // 操作类型
    pub operator: AccountId,                      // 操作者
    pub amount: Option<Balance>,                  // 金额（如果适用）
    pub timestamp: BlockNumber,                   // 操作时间
    pub proposal_id: Option<u64>,                 // 关联提案 ID
    pub success: bool,                            // 操作结果
    pub notes: BoundedVec<u8, ConstU32<128>>,     // 备注
}
```

---

## 版本历史

- **v0.1.0** (2025-11-05): 初始版本
  - 锁定-铸造桥接模型
  - OCW 自动化中继
  - 治理监督机制
  - 多签桥接账户支持

---

## 参考资料

- **Polkadot SDK 文档**: https://docs.substrate.io/
- **Off-Chain Workers**: https://docs.substrate.io/learn/offchain-operations/
- **Arbitrum 文档**: https://docs.arbitrum.io/
- **EIP-712 签名标准**: https://eips.ethereum.org/EIPS/eip-712
- **Multisig Pallet**: https://paritytech.github.io/substrate/master/pallet_multisig/

---

## 许可证

Unlicense

---

**维护者**：Stardust Team
**联系方式**：请通过治理论坛或 GitHub Issues 反馈问题
