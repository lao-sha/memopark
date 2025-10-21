# pallet-market-maker

## 概述

做市商治理+押金管理 Pallet，从 `pallet-otc-maker` 解耦出的独立治理模块。

## 目标

- **低耦合设计**：将"做市商治理+押金机制"从业务侧抽离；`pallet-otc-maker` 仅依赖其只读状态
- **资金安全**：使用 `ReservableCurrency` 锁定 MEMO；统一释放路径；提现限额/时间锁可选
- **资料分级**：公开资料明文 CID；私密资料"内容加密+密钥包"，CID 明文

## 核心流程

```
申请人                委员会
  |                      |
  |--lock_deposit------->|
  |  (质押押金)          |
  |                      |
  |  DepositLocked       |
  |  (24h 提交窗口)      |
  |                      |
  |--submit_info-------->|
  |  (提交资料)          |
  |                      |
  |  PendingReview       |
  |  (等待审核)          |
  |                      |
  |--update_info-------->|
  |  (可修改资料)        |
  |  [审核截止前]        |
  |                      |
  |<-----approve---------|
  |  (批准) 或 reject    |
  |                      |
  |  Active 或 Rejected  |
  ```

**流程说明**：
1. **质押阶段 (DepositLocked)**：
   - 申请人质押押金，获得 24 小时提交窗口
   - 可调用 `submit_info` 提交资料
   - 可调用 `update_info` 修改资料（需在 info_deadline 前）
   - 可调用 `cancel` 取消申请并退还押金

2. **审核阶段 (PendingReview)**：
   - 资料已提交，等待委员会审核
   - 可调用 `update_info` 继续修改资料（需在 review_deadline 前）
   - 委员会可调用 `approve` 批准或 `reject` 驳回

3. **终态**：
   - `Active`：批准通过，成为正式做市商
   - `Rejected`：驳回，按比例扣罚押金
   - `Cancelled`：用户主动取消（仅限质押阶段）
   - `Expired`：超时未提交或审核超时

## 存储结构

### Applications
`StorageMap<u64, Application>`

存储所有申请记录：

```rust
pub struct Application<AccountId, Balance> {
    pub owner: AccountId,          // 申请人地址
    pub deposit: Balance,          // 质押金额
    pub status: ApplicationStatus, // 申请状态
    // 🆕 2025-10-19: 做市商业务方向
    pub direction: Direction,      // 业务方向：Buy（仅Bridge）/Sell（仅OTC）/BuyAndSell（双向）
    pub public_cid: Cid,          // 公开资料根 CID
    pub private_cid: Cid,         // 私密资料根 CID
    pub min_amount: Balance,      // 最小下单额
    pub created_at: u32,          // 质押时间（秒）
    pub info_deadline: u32,       // 资料提交截止（秒）
    pub review_deadline: u32,     // 审核截止（秒）
    // 🆕 2025-10-13: 新增首购功能相关字段
    pub epay_gateway: BoundedVec<u8, ConstU32<128>>,  // epay支付网关地址
    pub epay_port: u16,                                // 🆕 2025-10-14: epay支付网关端口
    pub epay_pid: BoundedVec<u8, ConstU32<64>>,       // epay商户ID (PID)
    pub epay_key: BoundedVec<u8, ConstU32<64>>,       // epay商户密钥
    pub first_purchase_pool: Balance,                  // 首购资金池总额
    pub first_purchase_used: Balance,                  // 已使用的首购资金
    pub first_purchase_frozen: Balance,                // 冻结的首购资金（提取申请中）
    pub service_paused: bool,                          // 服务暂停状态
    pub users_served: u32,                             // 已服务的用户数量
}
```

### ApplicationStatus

```rust
pub enum ApplicationStatus {
    DepositLocked,   // 已质押，待提交资料
    PendingReview,   // 待审核
    Active,          // 已批准
    Rejected,        // 已驳回
    Cancelled,       // 已取消
    Expired,         // 已过期
}
```

### Direction（业务方向）🆕 2025-10-19

做市商业务方向枚举，用于限制做市商可以参与的业务类型：

```rust
pub enum Direction {
    Buy = 0,        // 仅买入（仅Bridge）- 做市商购买MEMO，支付USDT
    Sell = 1,       // 仅卖出（仅OTC）- 做市商出售MEMO，收取USDT
    BuyAndSell = 2, // 双向（OTC + Bridge）- 既可以买入也可以卖出
}
```

**业务范围说明**：

| 方向 | 值 | 业务范围 | 说明 | 资金要求 |
|------|---|----------|------|----------|
| **Buy** | 0 | 仅Bridge | 做市商购买MEMO，支付USDT | USDT资金（TRON链）+ 押金 |
| **Sell** | 1 | 仅OTC | 做市商出售MEMO，收取USDT | MEMO库存 + 保证金 |
| **BuyAndSell** | 2 | OTC + Bridge | 双向业务（推荐） | MEMO库存 + USDT资金 + 保证金 + 押金 |

**设计目标**：
- **降低准入门槛**：单向做市商只需准备单一方向的资金，资金压力降低50%
- **灵活性**：做市商可以专注擅长的业务方向
- **风险管理**：可以根据市场行情灵活调整业务方向

**默认值**：`BuyAndSell`（双向）

### OwnerIndex
`StorageMap<AccountId, u64>`

申请人 → mm_id 反向索引（可选）

### NextId
`StorageValue<u64>`

下一个可用的 mm_id

### 🆕 ActiveMarketMakers
`StorageMap<u64, Application>`

**新增于 2025-10-13**：存储已批准的活跃做市商

- 批准后从 Applications 迁移到这里
- 用于首购功能快速查询可用做市商
- mm_id → Application（状态为 Active）

### 🆕 FirstPurchaseRecords
`StorageDoubleMap<u64, AccountId, ()>`

**新增于 2025-10-13**：首购使用记录

- (mm_id, buyer_account) → ()
- 防止同一买家重复使用首购服务
- 统计做市商服务的用户数量

## 可调用接口

### lock_deposit 🆕 2025-10-19：新增direction参数
```rust
pub fn lock_deposit(
    origin: OriginFor<T>, 
    deposit: BalanceOf<T>,
    direction_u8: u8,  // 🆕 业务方向：0=Buy, 1=Sell, 2=BuyAndSell
) -> DispatchResult
```

**功能**：质押押金并生成 mm_id

**参数**：
- `deposit`: 质押金额（必须 ≥ MinDeposit）
- `direction_u8`: 业务方向（🆕 2025-10-19）
  - `0`: Buy - 仅买入（仅Bridge）
  - `1`: Sell - 仅卖出（仅OTC）
  - `2`: BuyAndSell - 双向（默认，推荐）

**效果**：
- 锁定申请人的 `deposit` 金额
- 生成新的 mm_id
- 🆕 设置业务方向（`direction`）
- 设置 24 小时提交窗口（`info_deadline`）
- 设置 7 天审核窗口（`review_deadline`）
- 发出 `Applied` 事件

**JavaScript 示例**：
```javascript
// 申请双向做市商
await api.tx.marketMaker.lockDeposit(
  depositAmount,  // 质押金额
  2               // direction: BuyAndSell（双向）
).signAndSend(account)

// 申请仅买入（Bridge）做市商
await api.tx.marketMaker.lockDeposit(
  depositAmount,
  0  // direction: Buy
).signAndSend(account)

// 申请仅卖出（OTC）做市商
await api.tx.marketMaker.lockDeposit(
  depositAmount,
  1  // direction: Sell
).signAndSend(account)
```

### submit_info
```rust
pub fn submit_info(
    origin: OriginFor<T>,
    mm_id: u64,
    public_cid: Vec<u8>,
    private_cid: Vec<u8>,
    min_amount: BalanceOf<T>,
    // 🆕 新增参数
    epay_gateway: Vec<u8>,
    epay_port: u16,
    epay_pid: Vec<u8>,
    epay_key: Vec<u8>,
    first_purchase_pool: BalanceOf<T>,
) -> DispatchResult
```

**功能**：提交做市商资料（**2025-10-14 扩展**）

**参数**：
- `mm_id`: 申请编号
- `public_cid`: 公开资料根 CID（明文）
- `private_cid`: 私密资料根 CID（明文，内容加密）
- `min_amount`: 最小下单额
- 🆕 `epay_gateway`: epay支付网关地址（如：http://111.170.145.41）
- 🆕 `epay_port`: epay支付网关端口（如：80, 443, 8080等）
- 🆕 `epay_pid`: epay商户ID
- 🆕 `epay_key`: epay商户密钥
- 🆕 `first_purchase_pool`: 首购资金池总额（必须 ≥ MinFirstPurchasePool）

**权限**：申请人本人

**验证**：
- epay网关地址不能为空
- epay端口必须大于0
- epay商户ID和密钥不能为空
- 首购资金池必须 ≥ MinFirstPurchasePool

**效果**：
- 状态变更为 `PendingReview`
- 发出 `Submitted` 事件

### update_info
```rust
pub fn update_info(
    origin: OriginFor<T>,
    mm_id: u64,
    public_root_cid: Option<Cid>,
    private_root_cid: Option<Cid>,
    min_amount: Option<BalanceOf<T>>,
    // 🆕 新增参数
    epay_gateway: Option<Vec<u8>>,
    epay_port: Option<u16>,
    epay_pid: Option<Vec<u8>>,
    epay_key: Option<Vec<u8>>,
    first_purchase_pool: Option<BalanceOf<T>>,
) -> DispatchResult
```

**功能**：更新申请资料（审核前可修改）（**2025-10-14 扩展**）

**参数**：
- `mm_id`: 申请编号
- `public_root_cid`: 公开资料根 CID（None 表示不修改）
- `private_root_cid`: 私密资料根 CID（None 表示不修改）
- `min_amount`: 最小下单额（None 表示不修改）
- 🆕 `epay_gateway`: epay支付网关地址（None 表示不修改）
- 🆕 `epay_port`: epay支付网关端口（None 表示不修改）
- 🆕 `epay_pid`: epay商户ID（None 表示不修改）
- 🆕 `epay_key`: epay商户密钥（None 表示不修改）
- 🆕 `first_purchase_pool`: 首购资金池总额（None 表示不修改）

**权限**：申请人本人

**允许状态**：
- `DepositLocked`：可修改，需在资料提交截止时间（`info_deadline`）前
- `PendingReview`：可修改，需在审核截止时间（`review_deadline`）前

**验证**：
- 🆕 epay网关地址如果提供，不能为空
- 🆕 epay端口如果提供，必须大于0
- 🆕 epay商户ID和密钥如果提供，不能为空
- 🆕 首购资金池如果提供，必须 ≥ MinFirstPurchasePool

**效果**：
- 更新指定字段（参数为 None 的字段不修改）
- 如果从 `DepositLocked` 状态修改且所有必需字段都已填写（包括epay配置和首购资金池），自动变更为 `PendingReview`
- 发出 `InfoUpdated` 事件

**注意事项**：
- 质押金额不可修改
- 只能在审核前修改，一旦 `Active`、`Rejected`、`Cancelled` 或 `Expired` 则不可修改
- 费率范围：0-10000 bps（0%-100%）
- 最小下单额必须大于 0

### approve
```rust
pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult
```

**功能**：批准做市商申请（**2025-10-13 扩展**）

**权限**：Root 或 委员会 2/3 多数
- **Root 通道**：Sudo 账户可直接批准（紧急情况）
- **委员会通道**：需通过提案流程（推荐）
  1. 委员会成员提交提案：`council.propose(threshold=3, marketMaker.approve(mm_id), length)`
  2. 其他成员投票：`council.vote(proposalHash, index, true)`
  3. 达到阈值后执行：`council.close(proposalHash, index, weightBound, lengthBound)`

**🆕 新增验证**（2025-10-13）：
- 验证epay配置完整性（gateway、pid、key不能为空）
- 验证首购资金池 ≥ MinFirstPurchasePool
- 转移首购资金到资金池账户

**效果**：
- 状态变更为 `Active`
- 押金转为长期质押
- 🆕 首购资金转移到资金池账户（派生账户：PalletId + mm_id）
- 🆕 从 Applications 迁移到 ActiveMarketMakers 存储
- 发出 `Approved` 事件
- 🆕 发出 `FirstPurchasePoolFunded` 事件

### reject
```rust
pub fn reject(origin: OriginFor<T>, mm_id: u64, slash_bps: u16) -> DispatchResult
```

**功能**：驳回做市商申请

**参数**：
- `mm_id`: 申请编号
- `slash_bps`: 扣罚比例（0-10000 bps）

**权限**：Root 或 委员会 2/3 多数
- **Root 通道**：Sudo 账户可直接驳回
- **委员会通道**：需通过提案流程（推荐）
  1. 提案：`council.propose(threshold=3, marketMaker.reject(mm_id, slash_bps), length)`
  2. 投票：`council.vote(proposalHash, index, true/false)`
  3. 执行：`council.close(...)`

**效果**：
- 状态变更为 `Rejected`
- 按比例扣罚押金，扣罚部分销毁（slash_reserved）
- 余额退还申请人
- 发出 `Rejected` 事件

### cancel
```rust
pub fn cancel(origin: OriginFor<T>, mm_id: u64) -> DispatchResult
```

**功能**：取消申请（仅限 DepositLocked 状态）

**权限**：申请人本人

**效果**：
- 退还押金
- 删除申请记录
- 发出 `Cancelled` 事件

### update_epay_config
**新增于 2025-10-14**

```rust
pub fn update_epay_config(
    origin: OriginFor<T>,
    mm_id: u64,
    epay_gateway: Option<Vec<u8>>,
    epay_port: Option<u16>,
    epay_pid: Option<Vec<u8>>,
    epay_key: Option<Vec<u8>>,
) -> DispatchResult
```

**功能**：更新epay支付网关配置（做市商自主修改）

**参数**：
- `mm_id`: 做市商编号
- `epay_gateway`: epay支付网关地址（None 表示不修改）
- `epay_port`: epay支付网关端口（None 表示不修改）
- `epay_pid`: epay商户ID（None 表示不修改）
- `epay_key`: epay商户密钥（None 表示不修改）

**权限**：做市商本人

**允许状态**：
- 只能在 `Active` 状态下修改
- 申请和审核阶段请使用 `update_info` 接口

**验证**：
- epay网关地址如果提供，不能为空
- epay端口如果提供，必须大于0
- epay商户ID和密钥如果提供，不能为空

**效果**：
- 更新指定字段（参数为 None 的字段不修改）
- 发出 `EpayConfigUpdated` 事件

**使用场景**：
- 做市商更换支付网关服务商
- 做市商更新商户密钥
- 做市商调整网关端口配置

## 配置参数

### MinDeposit
最小押金（示例：1000 MEMO）

### InfoWindow
资料提交窗口（示例：24 小时 = 86400 秒）

### ReviewWindow
审核窗口（示例：7 天 = 604800 秒）

### RejectSlashBpsMax
驳回最大扣罚比例（示例：10000 bps = 100%）

### MaxPairs
最大交易对数量（预留）

### 🆕 MinFirstPurchasePool
**新增于 2025-10-13**：首购资金池最小金额（示例：10000 MEMO）

- 做市商必须质押至少这么多的首购资金
- 防止资金池过小导致首购服务中断

### 🆕 FirstPurchaseAmount
**新增于 2025-10-13**：每次首购转账金额（推荐：100 MEMO）

- 新用户首次购买时，从做市商资金池转账的固定金额

### 🆕 PalletId
**新增于 2025-10-13**：Pallet ID（推荐：`b"mm/pool!"`）

- 用于派生首购资金池账户地址
- 格式：PalletId + mm_id → 派生子账户

## 前端集成

### 申请页面
**路径**：`#/otc/mm-apply`

**功能**：
- 两步式流程：先质押 → 再提交资料
- CID 格式校验（禁止 `enc:` 前缀）
- 费率范围检查（0-10000 bps）
- 24 小时倒计时提示

### 审核页面
**路径**：`#/gov/mm-review`

**功能**：
- 待审列表展示（PendingReview 状态）
- 已批准做市商列表展示（Active 状态）
- 申请详情查看
- 批准/驳回操作
- CID 复制和 IPFS 网关链接
- 解密提示和审查流程指引

**优化记录**：
- ✅ **2025-10-13**: 添加首购功能支持
  - **需求**：为新用户提供首购服务，做市商需要配置 epay 支付网关和首购资金池
  - **实现方案**：
    - 扩展 `Application` 结构，添加 `epay_gateway`、`epay_pid`、`epay_key`、`first_purchase_pool`、`first_purchase_used`、`users_served` 字段
    - 修改 `submit_info` 和 `update_info` 接口，支持提交和修改 epay 配置和首购资金池
    - 修改 `approve` 接口，验证 epay 配置并转移首购资金到资金池账户（派生账户：PalletId + mm_id）
    - 新增 `ActiveMarketMakers` 存储，批准后从 Applications 迁移
    - 新增 `FirstPurchaseRecords` 存储，记录首购使用情况
    - 实现辅助函数 `record_first_purchase_usage()`、`has_used_first_purchase()`、`first_purchase_pool_account()` 等接口
  - **改进效果**：
    - ✅ 低耦合设计：通过公共存储和辅助函数与其他 pallet 交互
    - ✅ 资金安全：首购资金存储在派生账户，做市商无法直接提取
    - ✅ 防重复领取：FirstPurchaseRecords 记录每个买家的首购使用情况
    - ✅ 前端直查：前端可直接查询 ActiveMarketMakers 获取实时状态
    - ✅ 统计完善：记录已使用资金和服务用户数
  - **新增事件**：`FirstPurchasePoolFunded`、`FirstPurchaseServed`
  - **新增错误**：`InvalidEpayGateway`、`InvalidEpayPid`、`InvalidEpayKey`、`InsufficientFirstPurchasePool`、`EpayConfigTooLong`、`InsufficientPoolBalance`、`MarketMakerNotActive`、`AlreadyUsedFirstPurchase`
  - **新增配置**：`MinFirstPurchasePool`、`FirstPurchaseAmount`、`PalletId`
- ✅ **2025-10-06**: 添加 `update_info` 接口支持审核前修改资料
  - **需求**：做市商在审核成功前，需要能够修改申请资料（质押金额、费率、最小下单额等）
  - **实现方案**：
    - 新增 `update_info` 接口（call_index=2）
    - 允许在 `DepositLocked` 或 `PendingReview` 状态下修改资料
    - 参数使用 `Option` 类型，None 表示不修改该字段
    - 自动检查截止时间：DepositLocked 检查 info_deadline，PendingReview 检查 review_deadline
    - 如果从 DepositLocked 修改且所有必需字段已填写，自动转为 PendingReview 状态
  - **改进效果**：
    - ✅ 用户体验提升：提交后发现错误可以及时修改，无需取消重新申请
    - ✅ 灵活性增强：审核期间可根据委员会反馈调整资料
    - ✅ 保证安全：质押金额不可修改，状态转换严格控制
    - ✅ 时间保护：必须在截止时间前修改，防止无限拖延
  - **新增事件**：`InfoUpdated { mm_id }`
  - **新增错误**：`NotInEditableStatus`（状态不允许编辑）
- ✅ **2025-09-30**: 实现委员会治理机制
  - **问题**：委员会成员直接调用 `approve/reject` 被拒绝（BadOrigin）
  - **原因**：原实现使用 `ensure_root`，仅 Sudo 可批准
  - **解决方案**：
    - Pallet 增加 `GovernanceOrigin` 类型
    - Runtime 绑定为 `EitherOfDiverse<Root, Council 2/3>`
    - 委员会通过提案流程（propose → vote → close）批准
  - **改进效果**：
    - ✅ 去中心化治理，避免单点信任
    - ✅ Root 保留紧急通道
    - ✅ 委员会集体决策，2/3 多数通过
- ✅ **2025-09-30**: 修复批准审核后前端不显示结果的问题
  - **问题分析**：`signAndSend` 函数在交易提交后立即返回，不等待区块确认，导致前端轮询时状态未更新
  - **解决方案**：修改 `signAndSendLocalFromKeystore` 和 `signAndSendLocalWithPassword`，等待交易被打包进区块（`isFinalized`）后再返回
  - **影响范围**：所有使用本地钱包签名的交易都会等待区块确认，确保状态更新后再继续
  - **改进效果**：批准/驳回操作完成后，前端立即刷新列表即可看到最新状态，无需额外轮询

## 事件

### Applied
```rust
Applied { mm_id: u64, owner: AccountId, deposit: Balance }
```
质押成功，生成新申请

### Submitted
```rust
Submitted { mm_id: u64 }
```
资料提交成功

### InfoUpdated
```rust
InfoUpdated { mm_id: u64 }
```
资料更新成功

### Approved
```rust
Approved { mm_id: u64 }
```
申请批准

### Rejected
```rust
Rejected { mm_id: u64, slash: Balance }
```
申请驳回，扣罚金额

### Cancelled
```rust
Cancelled { mm_id: u64 }
```
申请取消

### Expired
```rust
Expired { mm_id: u64 }
```
申请过期

### 🆕 FirstPurchasePoolFunded
**新增于 2025-10-13**
```rust
FirstPurchasePoolFunded { mm_id: u64, pool_account: AccountId, amount: Balance }
```
首购资金已转入资金池账户

### 🆕 FirstPurchaseServed
**新增于 2025-10-13**
```rust
FirstPurchaseServed { mm_id: u64, buyer: AccountId, amount: Balance }
```
首购服务已完成（由 pallet-otc-order OCW 调用）

### 🆕 EpayConfigUpdated
**新增于 2025-10-14**
```rust
EpayConfigUpdated { mm_id: u64, owner: AccountId }
```
做市商epay配置已更新

## 错误

- `AlreadyExists`: 申请人已有待处理申请
- `NotFound`: 申请不存在
- `NotDepositLocked`: 状态不是 DepositLocked
- `NotPendingReview`: 状态不是 PendingReview
- `NotInEditableStatus`: 状态不允许编辑（只能在 DepositLocked 或 PendingReview 状态下修改）
- `AlreadyFinalized`: 申请已终结
- `DeadlinePassed`: 超过截止时间
- `InvalidFee`: 费率超出范围
- `BadSlashRatio`: 扣罚比例超出限制
- `MinDepositNotMet`: 押金低于最小值
- 🆕 `InvalidEpayGateway`: epay网关地址无效或为空
- 🆕 `InvalidEpayPort`: epay网关端口无效（必须大于0）**新增于 2025-10-14**
- 🆕 `InvalidEpayPid`: epay商户ID无效或为空
- 🆕 `InvalidEpayKey`: epay商户密钥无效或为空
- 🆕 `InsufficientFirstPurchasePool`: 首购资金池金额不足
- 🆕 `EpayConfigTooLong`: epay配置字段过长
- 🆕 `InsufficientPoolBalance`: 做市商资金池余额不足
- 🆕 `MarketMakerNotActive`: 做市商未激活
- 🆕 `AlreadyUsedFirstPurchase`: 买家已经使用过首购服务
- 🆕 `NotOwner`: 不是做市商所有者
- 🆕 `NotActive`: 做市商未激活

## 治理机制

### 委员会审批流程（推荐）

**前提条件**：
- 链上已配置委员会成员（`council` pallet）
- 至少 3 名委员会成员（2/3 阈值需要至少 2 票）

**批准流程**：
1. **提交提案**（任一委员会成员）
   ```typescript
   const approveCall = api.tx.marketMaker.approve(mmId)
   await api.tx.council.propose(
     3,  // 阈值（最少需要几票）
     approveCall,
     approveCall.length
   ).signAndSend(councilMember)
   ```

2. **其他成员投票**
   ```typescript
   const proposalHash = approveCall.method.hash
   await api.tx.council.vote(
     proposalHash,
     0,  // 提案索引
     true  // 赞成
   ).signAndSend(otherMember)
   ```

3. **达到阈值后执行**
   ```typescript
   await api.tx.council.close(
     proposalHash,
     0,
     1_000_000_000,  // weight bound
     1000  // length bound
   ).signAndSend(anyMember)
   ```

### Root 直接批准（紧急通道）

仅在紧急情况下使用 Sudo 账户：
```typescript
await api.tx.sudo.sudo(
  api.tx.marketMaker.approve(mmId)
).signAndSend(sudoAccount)
```

## 安全考虑

1. **押金保护**：使用 `reserve` 锁定，防止二次花费
2. **权限校验**：
   - `submit_info`: 仅申请人本人
   - `cancel`: 仅申请人本人
   - `approve/reject`: Root 或 委员会 2/3 多数
3. **状态机保护**：严格状态转换，防止越权操作
4. **时间窗口**：自动过期机制，防止长期占用
5. **扣罚上限**：驳回扣罚比例可配置，防止过度惩罚
6. **去中心化治理**：推荐使用委员会提案流程，避免单点信任

## 与其他 Pallet 的关系

### pallet-otc-order（首购 OCW）
**新增于 2025-10-13**：
- 通过直接查询 `ActiveMarketMakers` 存储获取做市商信息
- 使用辅助函数 `record_first_purchase_usage()` 记录首购服务
- 使用辅助函数 `has_used_first_purchase()` 检查服务使用状态
- 使用辅助函数 `first_purchase_pool_account()` 获取资金池账户

### pallet-otc-maker（传统 OTC）
- 读取 `Applications` 查询做市商状态
- 检查 `status == Active` 判断是否可接单
- **不直接处理押金和治理逻辑**

## Runtime 集成状态

✅ **已完成集成**
- 依赖：`runtime/Cargo.toml`
- 配置：`runtime/src/configs/mod.rs`
- 注册：`runtime/src/lib.rs` (pallet_index = 45)
- 编译：✅ 通过
- 前端：✅ 审核页面已完成

## 🆕 桥接服务功能（2025-10-19）

做市商可以选择提供 Simple Bridge 兑换服务，为用户提供 MEMO → USDT（TRC20）的快速兑换通道。

### 功能概述

**核心价值**：
- ✅ 去中心化桥接（多做市商竞争）
- ✅ 市场化定价（费率竞争）
- ✅ 押金保障（用户资金安全）
- ✅ 24/7 自动化服务

### 数据结构

#### BridgeServiceConfig
```rust
pub struct BridgeServiceConfig<AccountId, Balance> {
    pub maker_account: AccountId,           // 🆕 做市商账户（接收 MEMO）
    pub tron_address: BoundedVec<u8, 64>,  // 🆕 做市商 TRON 地址（发送 USDT）
    pub max_swap_amount: u64,               // 单笔最大兑换额（USDT，精度10^6）
    pub fee_rate_bps: u32,                  // 手续费率（万分比，如 10 = 0.1%）
    pub enabled: bool,                      // 服务启用状态
    pub total_swaps: u64,                   // 累计兑换笔数
    pub total_volume: Balance,              // 累计兑换量（MEMO，精度10^12）
    pub success_count: u64,                 // 成功兑换数
    pub avg_time_seconds: u64,              // 平均完成时间（秒）
    pub deposit: Balance,                   // 押金额度（MEMO，精度10^12）
}
```

**🆕 2025-10-19 优化**：
- 新增 `maker_account` 字段：存储做市商账户（接收 MEMO）
- 新增 `tron_address` 字段：存储做市商 TRON 地址（发送 USDT）
- **优势**：买家无需手动输入做市商信息，系统自动查询，降低出错率

### 存储项

#### BridgeServices
`StorageMap<u64, BridgeServiceConfig>`

存储做市商的桥接服务配置：
- Key: 做市商 ID
- Value: 桥接服务配置

### 可调用方法

#### enable_bridge_service
```rust
pub fn enable_bridge_service(
    origin: OriginFor<T>,
    mm_id: u64,
    tron_address: BoundedVec<u8, ConstU32<64>>,  // 🆕 做市商 TRON 地址
    max_swap_amount: u64,    // USDT，精度 10^6
    fee_rate_bps: u32,       // 万分比，如 10 = 0.1%
) -> DispatchResult
```

**功能**：做市商启用桥接服务

**流程**：
1. 验证做市商身份和状态（Active）
2. 🆕 验证 TRON 地址格式（非空且长度 <= 64）
3. 验证费率范围（5-500 bps = 0.05%-5%）
4. 计算所需押金：`max_swap_amount × 100 × 1,000,000`
5. 检查押金是否足够
6. 🆕 存储做市商账户和 TRON 地址到配置中
7. 发出 `BridgeServiceEnabled` 事件

**示例**：
```javascript
// 做市商启用桥接服务
// 最大单笔 1,000 USDT，手续费率 0.1%
await api.tx.marketMaker.enableBridgeService(
  1,                              // mm_id
  "TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS",  // 🆕 TRON 地址
  1_000_000_000,                 // max_swap_amount = 1,000 USDT（精度10^6）
  10                              // fee_rate_bps = 0.1%
).signAndSend(makerAccount);

// 需要押金：100,000 MEMO
```

**押金计算**：
```
押金 = max_swap_amount × 100 × 1,000,000

示例：
- max_swap_amount = 1,000 USDT = 1,000,000,000（精度10^6）
- 押金 = 1,000,000,000 × 100 × 1,000,000 / 1,000,000,000,000
      = 100,000 MEMO
```

---

#### disable_bridge_service
```rust
pub fn disable_bridge_service(
    origin: OriginFor<T>,
    mm_id: u64,
) -> DispatchResult
```

**功能**：做市商禁用桥接服务

**流程**：
1. 验证做市商身份
2. 更新服务状态为 disabled
3. 发出 `BridgeServiceDisabled` 事件

**示例**：
```javascript
// 做市商禁用桥接服务
await api.tx.marketMaker.disableBridgeService(
  1  // mm_id
).signAndSend(makerAccount);
```

---

#### re_enable_bridge_service 🆕

```rust
pub fn re_enable_bridge_service(
    origin: OriginFor<T>,
    mm_id: u64,
) -> DispatchResult
```

**功能**：做市商重新启用桥接服务

**流程**：
1. 验证做市商身份和状态（Active）
2. 验证桥接服务已禁用
3. 更新服务状态为 enabled
4. 发出 `BridgeServiceReEnabled` 事件

**用途**：
- ✅ 临时维护后恢复服务
- ✅ 误操作后快速恢复
- ✅ 无需治理介入

**示例**：
```javascript
// 做市商重新启用桥接服务
await api.tx.marketMaker.reEnableBridgeService(
  1  // mm_id
).signAndSend(makerAccount);
```

---

#### update_bridge_service 🆕

```rust
pub fn update_bridge_service(
    origin: OriginFor<T>,
    mm_id: u64,
    tron_address: Option<BoundedVec<u8, ConstU32<64>>>,  // 可选更新 TRON地址
    max_swap_amount: Option<u64>,                        // 可选更新最大兑换额
    fee_rate_bps: Option<u32>,                           // 可选更新手续费率
) -> DispatchResult
```

**功能**：更新桥接服务配置

**流程**：
1. 验证做市商身份和状态（Active）
2. 验证桥接服务存在
3. 根据参数更新相应配置：
   - `tron_address`：更新 TRON 地址
   - `max_swap_amount`：更新最大兑换额（增加额度需追加押金）
   - `fee_rate_bps`：更新手续费率（5-500 bps）
4. 发出相应事件

**注意事项**：
- ⚠️ 增加 `max_swap_amount` 可能需要追加押金
- ⚠️ 减少 `max_swap_amount` 不退还押金
- ✅ 至少提供一个参数进行更新

**示例**：
```javascript
// 场景 1：更新 TRON 地址（热钱包升级）
await api.tx.marketMaker.updateBridgeService(
  1,                              // mm_id
  "TNewAddress123...",            // 新 TRON 地址
  null,                           // 不更新 max_swap_amount
  null                            // 不更新 fee_rate_bps
).signAndSend(makerAccount);

// 场景 2：增加最大兑换额度（业务规模扩大）
await api.tx.marketMaker.updateBridgeService(
  1,                              // mm_id
  null,                           // 不更新 TRON 地址
  10_000_000_000,                 // 10,000 USDT（需追加押金）
  null                            // 不更新 fee_rate_bps
).signAndSend(makerAccount);

// 场景 3：调整手续费率（市场竞争）
await api.tx.marketMaker.updateBridgeService(
  1,                              // mm_id
  null,                           // 不更新 TRON 地址
  null,                           // 不更新 max_swap_amount
  5                               // 0.05% 手续费率
).signAndSend(makerAccount);

// 场景 4：一次性更新所有配置
await api.tx.marketMaker.updateBridgeService(
  1,                              // mm_id
  "TNewAddress123...",            // 新 TRON 地址
  5_000_000_000,                  // 5,000 USDT
  10                              // 0.1% 手续费率
).signAndSend(makerAccount);
```

---

#### update_maker_info 🆕

```rust
pub fn update_maker_info(
    origin: OriginFor<T>,
    mm_id: u64,
    public_cid: Option<Cid>,           // 可选更新公开资料
    private_cid: Option<Cid>,          // 可选更新私密资料
    min_amount: Option<BalanceOf<T>>,  // 可选更新最小下单额
) -> DispatchResult
```

**功能**：更新做市商业务配置

**流程**：
1. 验证做市商身份和状态（Active）
2. 根据参数更新相应配置：
   - `public_cid`：更新公开资料（IPFS CID）
   - `private_cid`：更新私密资料（IPFS CID）
   - `min_amount`：更新最小下单额（>= Currency::minimum_balance）
3. 发出 `MakerInfoUpdated` 事件

**用途**：
- ✅ 更新服务条款（公开资料）
- ✅ 调整 OTC 业务费率（应对市场竞争）
- ✅ 调整最小下单额（业务策略调整）

**示例**：
```javascript
// 场景 1：更新服务条款（公开资料）
await api.tx.marketMaker.updateMakerInfo(
  1,                              // mm_id
  "QmNewPublicCID...",            // 新的公开资料 CID
  null,                           // 不更新私密资料
  null,                           // 不更新费率
  null                            // 不更新最小下单额
).signAndSend(makerAccount);

// 场景 2：调整 OTC 费率（市场竞争）
await api.tx.marketMaker.updateMakerInfo(
  1,                              // mm_id
  null,                           // 不更新公开资料
  null,                           // 不更新私密资料
  30,                             // 0.3% 费率
  null                            // 不更新最小下单额
).signAndSend(makerAccount);

// 场景 3：调整最小下单额（业务策略）
await api.tx.marketMaker.updateMakerInfo(
  1,                              // mm_id
  null,                           // 不更新公开资料
  null,                           // 不更新私密资料
  null,                           // 不更新费率
  BigInt(1000 * 1e12)             // 1000 MEMO
).signAndSend(makerAccount);

// 场景 4：一次性更新多个配置
await api.tx.marketMaker.updateMakerInfo(
  1,                              // mm_id
  "QmNewPublicCID...",            // 新的公开资料
  "QmNewPrivateCID...",           // 新的私密资料
  25,                             // 0.25% 费率
  BigInt(500 * 1e12)              // 500 MEMO
).signAndSend(makerAccount);
```

---

#### update_direction 🆕 2025-10-19

```rust
pub fn update_direction(
    origin: OriginFor<T>,
    mm_id: u64,
    new_direction_u8: u8,  // 新的业务方向：0=Buy, 1=Sell, 2=BuyAndSell
) -> DispatchResult
```

**功能**：更新做市商业务方向

**流程**：
1. 验证做市商身份和状态（Active）
2. 验证新方向有效性（0-2）
3. 更新 `direction` 字段
4. 发出 `DirectionUpdated` 事件

**用途**：
- ✅ 调整业务范围（从单向 → 双向，或从双向 → 单向）
- ✅ 根据市场行情灵活切换业务方向
- ✅ 降低资金压力（切换到单向业务）

**示例**：
```javascript
// 场景 1：从双向切换到仅买入（Bridge）
await api.tx.marketMaker.updateDirection(
  1,   // mm_id
  0    // direction: Buy（仅Bridge）
).signAndSend(makerAccount);

// 场景 2：从仅卖出（OTC）切换到双向
await api.tx.marketMaker.updateDirection(
  1,   // mm_id
  2    // direction: BuyAndSell（双向）
).signAndSend(makerAccount);

// 场景 3：从双向切换到仅卖出（OTC）
await api.tx.marketMaker.updateDirection(
  1,   // mm_id
  1    // direction: Sell（仅OTC）
).signAndSend(makerAccount);
```

**事件**：
```rust
DirectionUpdated {
    mm_id: u64,
    owner: T::AccountId,
    old_direction: Direction,
    new_direction: Direction,
}
```

**错误**：
- `InvalidDirection`：无效的方向值（不在0-2范围内）
- `SameDirection`：新方向与旧方向相同
- `NotMarketMaker`：调用者不是做市商
- `NotActive`：做市商状态不是Active

---

### 辅助方法（链上调用）

#### update_bridge_stats
```rust
pub fn update_bridge_stats(
    mm_id: u64,
    volume: BalanceOf<T>,
    time_seconds: u64,
    success: bool,
) -> DispatchResult
```

**功能**：更新做市商桥接服务统计数据

**调用者**：`pallet-simple-bridge`（在兑换完成后调用）

**流程**：
1. 更新累计兑换笔数、交易量、成功数
2. 更新平均完成时间（滚动平均）
3. 发出 `BridgeStatsUpdated` 事件

### 事件

#### BridgeServiceEnabled
```rust
BridgeServiceEnabled {
    mm_id: u64,
    owner: T::AccountId,
    max_swap_amount: u64,
    fee_rate_bps: u32,
    deposit: BalanceOf<T>,
}
```

**说明**：桥接服务已启用

---

#### BridgeServiceDisabled
```rust
BridgeServiceDisabled {
    mm_id: u64,
    owner: T::AccountId,
}
```

**说明**：桥接服务已禁用

---

#### BridgeStatsUpdated
```rust
BridgeStatsUpdated {
    mm_id: u64,
    total_swaps: u64,
    total_volume: BalanceOf<T>,
    success_count: u64,
    avg_time_seconds: u64,
}
```

**说明**：统计数据已更新

### 错误类型

```rust
BridgeServiceAlreadyExists,    // 桥接服务已存在
BridgeServiceNotFound,         // 桥接服务不存在
InvalidBridgeFeeRate,          // 费率无效（5-500 bps）
InsufficientBridgeDeposit,     // 押金不足
BridgeServiceNotEnabled,       // 桥接服务未启用
InvalidTronAddress,            // TRON 地址格式无效（为空或过长）
BridgeServiceAlreadyEnabled,   // 🆕 桥接服务已启用（无需重新启用）
MinAmountTooLow,               // 🆕 最小下单额过低（必须 >= Currency::minimum_balance）
```

### 前端查询

#### 查询做市商桥接服务配置
```javascript
// 查询做市商桥接服务配置
const service = await api.query.marketMaker.bridgeServices(1);  // mm_id = 1

if (service.isSome) {
  const config = service.unwrap();
  console.log('最大兑换额:', config.max_swap_amount.toNumber() / 1_000_000, 'USDT');
  console.log('手续费率:', config.fee_rate_bps.toNumber() / 100, '%');
  console.log('服务状态:', config.enabled.toHuman());
  console.log('累计兑换:', config.total_swaps.toNumber(), '笔');
  console.log('累计交易量:', config.total_volume.toNumber() / 1e12, 'MEMO');
  console.log('成功率:', (config.success_count.toNumber() / config.total_swaps.toNumber() * 100).toFixed(2), '%');
  console.log('平均耗时:', config.avg_time_seconds.toNumber(), '秒');
  console.log('押金额度:', config.deposit.toNumber() / 1e12, 'MEMO');
}
```

#### 查询所有提供桥接服务的做市商
```javascript
// 获取所有活跃的做市商
const activeMakers = await api.query.marketMaker.activeMarketMakers.entries();

// 过滤出提供桥接服务的做市商
const bridgeMakers = [];
for (const [key, maker] of activeMakers) {
  const mmId = key.args[0].toNumber();
  const service = await api.query.marketMaker.bridgeServices(mmId);
  
  if (service.isSome) {
    const config = service.unwrap();
    if (config.enabled.toHuman()) {
      bridgeMakers.push({
        mmId,
        owner: maker.owner.toHuman(),
        maxSwapAmount: config.max_swap_amount.toNumber() / 1_000_000,
        feeRate: config.fee_rate_bps.toNumber() / 100,
        totalSwaps: config.total_swaps.toNumber(),
        successCount: config.success_count.toNumber(),
        avgTime: config.avg_time_seconds.toNumber(),
        deposit: config.deposit.toNumber() / 1e12,
      });
    }
  }
}

console.log('提供桥接服务的做市商:', bridgeMakers);
```

### 使用流程

#### 1. 做市商启用桥接服务

```javascript
// 1. 确认做市商状态
const maker = await api.query.marketMaker.activeMarketMakers(1);
console.log('做市商状态:', maker.status.toHuman());  // 应为 Active
console.log('押金余额:', maker.deposit.toNumber() / 1e12, 'MEMO');

// 2. 启用桥接服务（需要足够的押金）
const maxSwapAmount = 1_000_000_000;  // 1,000 USDT
const feeRateBps = 10;                 // 0.1%
const requiredDeposit = 100_000;       // 需要 100,000 MEMO

await api.tx.marketMaker.enableBridgeService(
  1,
  maxSwapAmount,
  feeRateBps
).signAndSend(makerAccount);

// 3. 部署 simple-bridge-service
// 参考：simple-bridge-service README
```

#### 2. 用户通过做市商兑换

```javascript
// 用户选择做市商进行兑换
// 参考：pallet-simple-bridge README
await api.tx.simpleBridge.swapWithMaker(
  1,                     // maker_id
  100n * 1_000_000_000_000n,  // 100 MEMO
  'TRC20_ADDRESS'        // USDT 接收地址
).signAndSend(userAccount);
```

#### 3. 做市商完成兑换

```javascript
// 做市商监听到兑换事件后，自动转账 USDT
// 然后调用链上完成方法
await api.tx.simpleBridge.completeSwapByMaker(
  swapId,
  trc20TxHash  // TRC20 交易哈希
).signAndSend(makerAccount);
```

### 监控指标

#### 做市商桥接服务 Dashboard

```javascript
// 实时监控做市商桥接服务
async function monitorBridgeService(mmId) {
  const service = await api.query.marketMaker.bridgeServices(mmId);
  
  if (service.isSome) {
    const config = service.unwrap();
    
    return {
      enabled: config.enabled.toHuman(),
      maxSwapAmount: config.max_swap_amount.toNumber() / 1_000_000,
      feeRate: config.fee_rate_bps.toNumber() / 100,
      totalSwaps: config.total_swaps.toNumber(),
      totalVolume: config.total_volume.toNumber() / 1e12,
      successRate: config.success_count.toNumber() / config.total_swaps.toNumber(),
      avgTime: config.avg_time_seconds.toNumber(),
      deposit: config.deposit.toNumber() / 1e12,
      
      // 告警指标
      alerts: {
        lowSuccessRate: config.success_count.toNumber() / config.total_swaps.toNumber() < 0.95,
        slowResponse: config.avg_time_seconds.toNumber() > 600,  // 超过10分钟
      }
    };
  }
  
  return null;
}
```

### 相关文档

- [pallet-simple-bridge README](/home/xiaodong/文档/memopark/pallets/simple-bridge/README.md)
- [做市商参与SimpleBridge兑换方案分析](/home/xiaodong/文档/memopark/docs/做市商参与SimpleBridge兑换方案分析.md)
- [做市商SimpleBridge-Phase1完成报告](/home/xiaodong/文档/memopark/docs/做市商SimpleBridge-Phase1完成报告.md)

---

## 后续优化

1. **性能优化**：
   - 集成 Subsquid 索引，避免遍历查询
   - 实现分页加载和虚拟滚动

2. **功能增强**：
   - 追加质押
   - 调整费率
   - 批量审批
   - 审批历史和统计
   - **桥接服务押金罚没机制**（仲裁违约时扣除）

3. **权限管理**：
   - 集成委员会集体签名（替换 ensure_root）
   - 添加投票机制和多签审批

4. **Benchmark**：
   - 生成权重函数
   - 单元测试覆盖

## 开发者提示

- CID 一律不加密（明文存储）
- 私密内容加密后存储，但 CID 指向密文文件的明文 CID
- 押金使用 `ReservableCurrency`（未来可升级为 `holds`）
- 事件齐全，重查询建议使用索引器（Subsquid）
- 前端已实现友好错误提示，提示用户 pallet 未注册时的集成步骤