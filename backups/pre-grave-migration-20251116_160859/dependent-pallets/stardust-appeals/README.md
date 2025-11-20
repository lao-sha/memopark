# Pallet Stardust Appeals

## 模块概述

通用申诉治理模块，支持多域（墓地、逝者、供奉品、媒体、文本等）的申诉流程管理。

**重要**: 本模块由 `pallet-memo-content-governance` 重命名而来（v0.2.0）

## 主要功能

### 1. 申诉提交
- 任何用户可对指定域的对象提交申诉
- 需要冻结押金（使用pallet-balances Holds API）
- 支持动态押金策略
- 限频控制防止恶意刷屏

### 2. 委员会审批
- 内容委员会投票批准或驳回申诉
- 公示期保护机制
- 批准的申诉进入公示期，给予对象所有者应答机会
- 公示期到期后自动执行

### 3. 自动执行机制
- 使用调度队列按块执行到期申诉
- 支持失败自动重试（指数退避）
- 应答自动否决（owner及时应答可自动否决申诉）
- Router模式解耦业务执行逻辑

### 4. 押金管理
- Phase 1优化：使用pallet-balances Holds API
- 更好的类型安全和官方维护
- 支持驳回罚没、撤回罚没
- 罚没资金自动转入国库

### 5. 证据管理
- 支持旧方式：reason_cid + evidence_cid
- 支持新方式：evidence_id（统一证据系统）
- 证据必填，避免空证据滥用

## 支持的域（Domain）

| Domain | 描述 | 目标对象 |
|--------|------|---------|
| 1 | 墓地 (Grave) | grave_id |
| 2 | 逝者档案 (Deceased) | deceased_id |
| 3 | 逝者文本 (Deceased Text) | text_id |
| 4 | 逝者媒体 (Deceased Media) | media_id |
| 5 | 供奉品 (Offerings) | offering_id |
| 6 | 园区 (Park) | park_id |

## 核心接口

### 用户接口

#### `submit_appeal()`
提交申诉（通用入口）

**参数：**
- `domain`: 申诉域（1-6）
- `target`: 目标对象ID
- `action`: 操作类型
- `reason_cid`: 理由CID（可选）
- `evidence_cid`: 证据CID（必填）

**权限：** 任何签名账户

**押金：** 动态计算或固定押金

#### `submit_appeal_with_evidence()`
使用统一证据ID提交申诉（Phase 3新增）

**参数：**
- `domain`: 申诉域
- `target`: 目标对象ID
- `action`: 操作类型
- `evidence_id`: 统一证据ID
- `reason_cid`: 理由CID（可选）

**权限：** 任何签名账户

#### `submit_owner_transfer_appeal()`
提交"治理转移逝者owner"的专用申诉入口

**参数：**
- `deceased_id`: 逝者ID
- `new_owner`: 新拥有者账户
- `evidence_cid`: 证据CID（必填）
- `reason_cid`: 理由CID（可选）

**权限：** 任何签名账户

**固定参数：** domain=2, action=4

#### `withdraw_appeal()`
撤回申诉

**参数：**
- `id`: 申诉ID

**权限：** 申诉提交者

**罚没：** 按WithdrawSlashBps比例罚没押金

### 治理接口

#### `approve_appeal()`
批准申诉

**参数：**
- `id`: 申诉ID
- `notice_blocks`: 公示期区块数（可选）

**权限：** GovernanceOrigin（Root或内容委员会）

**流程：**
1. 验证申诉状态为submitted(0)
2. 检查目标主体无并发批准申诉
3. 设置execute_at和approved_at
4. 入队到QueueByBlock
5. 标记PendingBySubject

#### `reject_appeal()`
驳回申诉

**参数：**
- `id`: 申诉ID

**权限：** GovernanceOrigin

**罚没：** 按RejectedSlashBps比例罚没押金

#### `purge_appeals()`
清理历史申诉

**参数：**
- `start_id`: 起始ID
- `end_id`: 结束ID
- `limit`: 最多清理条数

**权限：** GovernanceOrigin

**说明：** 仅清理已完成/已撤回/已驳回/重试耗尽的申诉

#### `purge_execution_queues()`
清理历史执行队列（Phase 3.5新增）

**参数：**
- `start_block`: 起始块高
- `end_block`: 结束块高

**权限：** GovernanceOrigin

**安全性：** 不允许清理当前块及未来块

## 只读接口

### `appeal_of(id) -> Option<Appeal>`
获取申诉详情

### `list_by_account(who, status, start_id, limit) -> Vec<u64>`
按账户与状态查询申诉列表

### `list_by_status_range(status_min, status_max, start_id, limit) -> Vec<u64>`
按状态范围查询申诉列表

### `list_due_between(from, to, start_id, limit) -> Vec<u64>`
按到期区间查询申诉列表

### `queue_len_at(block) -> u32`
查询某块的执行队列长度

### `due_at(block) -> Vec<u64>`
查询某块的到期执行ID列表

### `find_owner_transfer_params(target) -> Option<(u64, AccountId)>`
查找"治理转移逝者owner"所需参数

## 申诉状态流转

```
0 (submitted)  ──approve──>  1 (approved)  ──auto_execute──>  4 (executed)
      │                            │
      │                            ├──Router失败 + 重试──>  1 (approved)
      │                            │
      │                            ├──重试耗尽──>  5 (retry_exhausted)
      │                            │
      │                            └──owner应答──>  6 (auto_dismissed)
      │
      ├──reject──>  2 (rejected)
      │
      └──withdraw──>  3 (withdrawn)
```

## 自动执行机制（on_initialize）

### 执行流程
1. 读取当前块的QueueByBlock
2. 逐个执行申诉（最多MaxExecPerBlock条）
3. 应答自动否决检查（domain=2时）
4. 调用Router.execute()执行业务逻辑
5. 根据结果更新状态并维护索引

### 成功路径
- 状态：1(approved) → 4(executed)
- 押金：释放
- 占位：释放PendingBySubject
- 索引：更新AppealsByStatus（1→4）
- 清理：移除重试计数和计划

### 失败路径（自动重试）
- **重试次数 < MaxRetries**：
  - 递增重试计数
  - 计算退避延迟：RetryBackoffBlocks × attempts
  - 重新入队到未来块
  - 发出AppealRetryScheduled事件

- **重试次数 ≥ MaxRetries**：
  - 状态：1(approved) → 5(retry_exhausted)
  - 押金：释放（Router失败非提交者责任）
  - 占位：释放PendingBySubject
  - 索引：更新AppealsByStatus（1→5）
  - 发出AppealRetryExhausted事件

### 应答自动否决
- 仅对domain=2（deceased域）启用
- 检查时间窗口：(approved_at, execute_at]
- 若owner在此期间有活跃操作→自动否决
- 状态：1(approved) → 6(auto_dismissed)
- 押金：释放

## 限频机制

### 窗口参数
- **WindowBlocks**: 限频窗口大小（如1000块）
- **MaxPerWindow**: 窗口内最大提交次数（如10次）

### 检查逻辑
1. 读取账户的WindowInfo
2. 判断当前块是否在窗口内
3. 若超出窗口，重置计数
4. 检查计数是否超限
5. 通过后自增计数

## 押金策略

### 固定押金
配置参数：`AppealDeposit`（如100 DUST）

### 动态押金
通过`AppealDepositPolicy` trait实现：

```rust
fn calc_deposit(who, domain, target, action) -> Option<Balance>
```

**优先级：** 动态押金 > 固定押金

**策略示例：**
- 根据申诉历史调整
- 根据域和动作类型调整
- 根据目标对象规模调整

## 罚没比例

### 驳回罚没
配置参数：`RejectedSlashBps`（如3000 = 30%）

### 撤回罚没
配置参数：`WithdrawSlashBps`（如1000 = 10%）

### 计算方式
```rust
let per = Perbill::from_parts((bps as u32) * 10_000);
let slashed = per.mul_floor(deposit_amount);
```

## Router接口

### 定义
```rust
pub trait AppealRouter<AccountId> {
    fn execute(who: &AccountId, domain: u8, target: u64, action: u8) -> DispatchResult;
}
```

### 实现要求
- 由Runtime实现
- 根据domain分发到对应业务pallet
- 执行具体的强制操作（如设置可见性、删除内容等）

### 示例实现
```rust
impl AppealRouter<AccountId> for Runtime {
    fn execute(who: &AccountId, domain: u8, target: u64, action: u8) -> DispatchResult {
        match domain {
            1 => Grave::force_set_visibility(target, action),
            2 => Deceased::force_transfer_owner(target, who.clone(), action),
            // ... 其他域
            _ => Err(DispatchError::Other("Unknown domain"))
        }
    }
}
```

## 事件

### AppealSubmitted(id, who, domain, target, deposit)
申诉已提交

### AppealWithdrawn(id, slash_bps, slashed)
申诉已撤回

### AppealApproved(id, execute_at)
申诉已批准

### AppealRejected(id, slash_bps, slashed)
申诉已驳回

### AppealExecuted(id)
申诉已执行

### AppealExecuteFailed(id, code)
申诉执行失败

### AppealRetryScheduled(id, attempt, at_block)
已计划重试

### AppealRetryExhausted(id, attempts)
重试已达上限

### EvidenceLinked(appeal_id, evidence_id)
证据已链接到申诉（Phase 3）

### AppealAutoDismissed(id)
在公示期内目标主体owner已应答，自动否决

### AppealsPurged(start_id, end_id, removed_count)
已清理历史申诉

## 错误

### NotFound
申诉不存在

### BadStatus
申诉状态不正确

### NoPermission
无权限操作

### RateLimited
触发限频

### QueueFull
执行队列已满

### RouterFailed
Router执行失败

### AlreadyPending
同一主体已存在一个批准中的申诉

### EvidenceRequired
证据必填：evidence_cid不允许为空

### EvidenceTooShort
证据过短：evidence_cid长度不足

### ReasonTooShort
理由过短：reason_cid长度不足

## 配置参数

### 必需参数
- `RuntimeEvent`: 事件类型
- `Fungible`: Fungible traits（Holds API）
- `RuntimeHoldReason`: HoldReason绑定
- `AppealDeposit`: 押金数额
- `RejectedSlashBps`: 驳回罚没比例
- `WithdrawSlashBps`: 撤回罚没比例
- `WindowBlocks`: 限频窗口
- `MaxPerWindow`: 窗口内最大提交次数
- `NoticeDefaultBlocks`: 默认公示期
- `TreasuryAccount`: 国库账户
- `Router`: 执行路由
- `GovernanceOrigin`: 治理起源

### 防护参数
- `MaxExecPerBlock`: 每块最大执行条数
- `MaxListLen`: 只读分页最大返回条数
- `MaxRetries`: 失败最大重试次数
- `RetryBackoffBlocks`: 重试退避区块数

### 证据参数
- `MinEvidenceCidLen`: 证据CID最小长度
- `MinReasonCidLen`: 理由CID最小长度

### 策略接口
- `AppealDepositPolicy`: 动态押金策略
- `LastActiveProvider`: 最近活跃度提供者

### 权重
- `WeightInfo`: 权重提供者

## 版本历史

### v0.3.0 - Phase 1优化（2025-10-27）
- 迁移到Holds API：移除pallet-deposits依赖
- 使用pallet-balances Holds API管理押金
- 更好的类型安全和官方维护

### v0.2.0
- 重命名为 pallet-stardust-appeals
- 准备集成 pallet-deposits

### v0.1.0
- 初始版本，名称为 pallet-memo-content-governance

## 使用示例

### 提交申诉
```rust
// 使用CID方式
let reason_cid = b"QmReason123".to_vec().try_into().unwrap();
let evidence_cid = b"QmEvidence456".to_vec().try_into().unwrap();
Appeals::submit_appeal(
    Origin::signed(alice),
    2,  // domain: deceased
    123,  // target: deceased_id
    1,  // action: set_visibility
    reason_cid,
    evidence_cid,
)?;

// 使用统一证据ID方式（Phase 3）
Appeals::submit_appeal_with_evidence(
    Origin::signed(alice),
    2,  // domain: deceased
    123,  // target: deceased_id
    1,  // action: set_visibility
    evidence_id,  // 从pallet-evidence获取
    Some(reason_cid),
)?;
```

### 治理批准
```rust
Appeals::approve_appeal(
    Origin::root(),
    appeal_id,
    Some(100u32.into()),  // 100块公示期
)?;
```

### 查询申诉
```rust
// 按ID查询
let appeal = Appeals::appeal_of(appeal_id);

// 按账户查询
let ids = Appeals::list_by_account(&alice, Some(0), 0, 10);

// 按状态查询
let ids = Appeals::list_by_status_range(0, 1, 0, 100);

// 查询到期申诉
let now = frame_system::Pallet::<T>::block_number();
let ids = Appeals::list_due_between(now, now + 100u32.into(), 0, 50);
```

## 最佳实践

### 1. 证据管理
- 优先使用evidence_id（统一证据系统）
- 证据必须真实、完整、有效
- 证据CID长度不少于MinEvidenceCidLen

### 2. 申诉提交
- 提前检查限频状态
- 准备充足的押金
- 填写清晰的理由
- 提供充分的证据

### 3. 委员会审批
- 仔细审查证据
- 合理设置公示期
- 注意并发申诉限制

### 4. Router实现
- 实现幂等操作
- 处理所有错误情况
- 记录详细日志
- 测试失败重试

### 5. 应答机制
- Owner应及时查看批准申诉
- 在公示期内及时应答
- 应答操作需成功执行（会记录LastActive）

## 安全考虑

### 1. 押金保护
- 使用Holds API锁定押金
- 押金在释放前不可转移
- 罚没资金自动转入国库

### 2. 并发控制
- 同一主体同时只能有一个批准申诉
- 避免竞态条件和重复执行

### 3. DoS防护
- 限频机制防止刷屏
- MaxExecPerBlock限制单块执行数量
- MaxListLen限制只读返回数量

### 4. 权限控制
- 仅GovernanceOrigin可批准/驳回
- 申诉提交者可撤回（有罚没）
- Owner应答可自动否决

### 5. 错误处理
- Router失败自动重试
- 重试耗尽后标记并释放押金
- 详细错误码记录

## 依赖

### Runtime依赖
- `frame-system`
- `frame-support`
- `pallet-balances`（Holds API）

### Trait依赖
- `AppealRouter`: 执行路由（Runtime实现）
- `AppealDepositPolicy`: 动态押金策略（可选）
- `LastActiveProvider`: 最近活跃度提供者（可选）

### 可选集成
- `pallet-evidence`: 统一证据管理
- `pallet-collective`: 内容委员会投票

## 测试

### 单元测试
```bash
cargo test -p pallet-stardust-appeals
```

### 集成测试
参见 `tests/` 目录

### 基准测试
参见 `benchmarking/` 目录
