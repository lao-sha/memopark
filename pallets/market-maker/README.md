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
  |<-----approve---------|
  |  (批准) 或 reject    |
  |                      |
  |  Active 或 Rejected  |
  ```

## 存储结构

### Applications
`StorageMap<u64, Application>`

存储所有申请记录：

```rust
pub struct Application<AccountId, Balance> {
    pub owner: AccountId,          // 申请人地址
    pub deposit: Balance,          // 质押金额
    pub status: ApplicationStatus, // 申请状态
    pub public_cid: Cid,          // 公开资料根 CID
    pub private_cid: Cid,         // 私密资料根 CID
    pub fee_bps: u16,             // 费率（bps）
    pub min_amount: Balance,      // 最小下单额
    pub created_at: u32,          // 质押时间（秒）
    pub info_deadline: u32,       // 资料提交截止（秒）
    pub review_deadline: u32,     // 审核截止（秒）
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

### OwnerIndex
`StorageMap<AccountId, u64>`

申请人 → mm_id 反向索引（可选）

### NextId
`StorageValue<u64>`

下一个可用的 mm_id

## 可调用接口

### lock_deposit
```rust
pub fn lock_deposit(origin: OriginFor<T>, deposit: BalanceOf<T>) -> DispatchResult
```

**功能**：质押押金并生成 mm_id

**参数**：
- `deposit`: 质押金额（必须 ≥ MinDeposit）

**效果**：
- 锁定申请人的 `deposit` 金额
- 生成新的 mm_id
- 设置 24 小时提交窗口（`info_deadline`）
- 设置 7 天审核窗口（`review_deadline`）
- 发出 `Applied` 事件

### submit_info
```rust
pub fn submit_info(
    origin: OriginFor<T>,
    mm_id: u64,
    public_cid: Vec<u8>,
    private_cid: Vec<u8>,
    fee_bps: u16,
    min_amount: BalanceOf<T>,
) -> DispatchResult
```

**功能**：提交做市商资料

**参数**：
- `mm_id`: 申请编号
- `public_cid`: 公开资料根 CID（明文）
- `private_cid`: 私密资料根 CID（明文，内容加密）
- `fee_bps`: 费率（0-10000 bps，即 0%-100%）
- `min_amount`: 最小下单额

**权限**：申请人本人

**效果**：
- 状态变更为 `PendingReview`
- 发出 `Submitted` 事件

### approve
```rust
pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult
```

**功能**：批准做市商申请

**权限**：Root 或 委员会 2/3 多数
- **Root 通道**：Sudo 账户可直接批准（紧急情况）
- **委员会通道**：需通过提案流程（推荐）
  1. 委员会成员提交提案：`council.propose(threshold=3, marketMaker.approve(mm_id), length)`
  2. 其他成员投票：`council.vote(proposalHash, index, true)`
  3. 达到阈值后执行：`council.close(proposalHash, index, weightBound, lengthBound)`

**效果**：
- 状态变更为 `Active`
- 押金转为长期质押
- 发出 `Approved` 事件

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

## 错误

- `AlreadyExists`: 申请人已有待处理申请
- `NotFound`: 申请不存在
- `NotDepositLocked`: 状态不是 DepositLocked
- `NotPendingReview`: 状态不是 PendingReview
- `AlreadyFinalized`: 申请已终结
- `DeadlinePassed`: 超过截止时间
- `InvalidFee`: 费率超出范围
- `BadSlashRatio`: 扣罚比例超出限制
- `MinDepositNotMet`: 押金低于最小值

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

## 与 pallet-otc-maker 的关系

`pallet-otc-maker` 通过只读依赖本 pallet：
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

## 后续优化

1. **性能优化**：
   - 集成 Subsquid 索引，避免遍历查询
   - 实现分页加载和虚拟滚动

2. **功能增强**：
   - 追加质押
   - 调整费率
   - 批量审批
   - 审批历史和统计

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