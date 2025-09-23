# pallet-memo-content-governance

- 作用：第三方申诉 + 押金罚没 + 委员会强制执行（内容域）。
- 特性：限频窗口、公示期到期调度、执行路由（domain/action → 目标 Pallet gov_*）。

## 配置
- AppealDeposit：申诉押金
- RejectedSlashBps / WithdrawSlashBps：驳回/撤回罚没比例（bps）
- WindowBlocks / MaxPerWindow：限频窗口与最大次数
- NoticeDefaultBlocks：默认公示期
- TreasuryAccount：罚没入账账户
- Router：执行路由实现（由 runtime 注入）
- GovernanceOrigin：审批/驳回起源（运行时绑定 Root | 内容委员会 2/3）
- MaxExecPerBlock：每块最多执行的申诉数（DoS 防护）
- MaxRetries：执行失败最大重试次数（达到上限后不再自动重试）
- RetryBackoffBlocks：失败重试基础退避区块数（第 k 次重试延迟 = base × k）
- WeightInfo：权重提供者（建议用基准自动生成）
 - LastActiveProvider：最近活跃度提供者（用于“应答自动否决”）

## Extrinsics
- submit_appeal(domain, target, action, reason_cid, evidence_cid)
- withdraw_appeal(id)
- approve_appeal(id, notice_blocks?)（Root | 内容委员会 2/3）
- reject_appeal(id)（Root | 内容委员会 2/3）
- purge_appeals(start_id, end_id, limit)

## 处罚与资金
- 撤回：按 WithdrawSlashBps 罚没（其余退还给申诉人）
- 驳回：按 RejectedSlashBps 罚没（其余退还给申诉人）
- 通过：公示期到期后执行路由动作，成功后退还押金
## 生命周期与并发控制
- 状态码：0=submitted，1=approved，2=rejected，3=withdrawn，4=executed，5=retry_exhausted，6=auto_dismissed。
- 串行化：同一主体 `(domain,target)` 在任意时刻仅允许一个处于“已批准(1)”的申诉；
  - 审批时若发现占位存在将返回错误 `AlreadyPending`。
- 提交流程：提交 → 审批（写入 `execute_at` 与主体占位）→ 到期由 `on_initialize(n)` 执行。
- 执行成功：退还押金、释放主体占位并清理重试计数。
- 执行失败：按退避（`RetryBackoffBlocks` × 第 k 次重试）重入队，最多 `MaxRetries` 次；
  - 队列满或达到上限：标记 `retry_exhausted(5)`，退还押金并释放主体占位。
- 撤回/驳回：解保留押金后按 bps 罚没，且释放主体占位与重试信息。
- 队列：`QueueByBlock[n]` 存放本块待执行 id，受 `MaxExecPerBlock` 限制，处理后清空。

### 应答自动否决（Auto Dismiss on Response）
- 判定范围：对 `domain=2 (deceased)` 生效，`LastActiveProvider::last_active_of(2, deceased_id)` 来源于 `pallet-deceased::LastActiveOf`。
- 触发条件：若 `last_active` 满足 `approved_at < last_active <= execute_at`，视为 owner 已应答。
- 处理：标记为 `auto_dismissed(6)`，退押金、释放占位、清理重试，并发 `AppealAutoDismissed(id)`。

## 只读接口
- `appeal_of(id)`：读取申诉详情
- `list_by_account(who,status?,start,limit)`：按账户/状态分页
- `list_by_status_range(min,max,start,limit)`：按状态区间分页
- `list_due_between(from,to,start,limit)`：按到期区间分页（仅已批准）
- `queue_len_at(block)` / `due_at(block)`：队列长度与到期 id 列表
  
> 说明：重试的下一次计划块高可通过存储 `NextRetryAt[id]` 观察（仅链上可读）。

## 事件
- AppealSubmitted(id, who, domain, target, deposit)
- AppealWithdrawn(id, slash_bps, slashed)
- AppealApproved(id, execute_at)
- AppealRejected(id, slash_bps, slashed)
- AppealExecuted(id)
- AppealExecuteFailed(id, code)：执行失败，`code` 为错误码（统一映射自 DispatchError）
- AppealRetryScheduled(id, attempt, at_block)：已安排重试
- AppealRetryExhausted(id, attempts)：达到上限，放弃重试
- AppealsPurged(start_id, end_id, removed)：治理清理历史申诉的结果摘要
- AppealAutoDismissed(id)：在公示期内目标主体 owner 已应答，自动否决执行

## 权重与基准
- Pallet 已引入 `WeightInfo` 并为所有入口绑定占位权重。
- 在 runtime 的 `benchmarks.rs` 注册 `[pallet_memo_content_governance, Pallet]` 后，可执行：
  - 生成：`cargo run --features runtime-benchmarks -- benchmark pallet ...`（按 Substrate 指南）
  - 替换：将生成的权重实现替换本仓库 `weights.rs` 中占位实现。


## 路由码表（示例）
- 逝者（2）：
  - (2,1) gov_set_visibility(true)
  - (2,2) gov_set_main_image(None)
  - (2,3) gov_set_main_image(Some(default/占位))
- 文本（3）：
  - (3,20) gov_remove_eulogy
  - (3,21) gov_remove_text
  - (3,22) gov_edit_text
  - (3,23) gov_set_life
- 媒体（4）：
  - (4,30) gov_set_media_hidden(true)
  - (4,31) gov_replace_media_uri
  - (4,32) gov_freeze_video_collection(true)
- 墓地（1）：
  - (1,10) clear_cover_via_governance
  - (1,11) gov_transfer_grave
  - (1,12) gov_set_restricted(true, code)
  - (1,13) gov_remove_grave(code)
  - (1,14) gov_restore_grave
- 园区（5）：
  - (5,40) gov_transfer_park
  - (5,41) gov_set_park_cover
- 供奉（6）：
  - (6,50) gov_set_pause_domain
  - (6,51) gov_set_offering_enabled

> 以上为示例，实际参数在 runtime 路由中注入；前端提交申诉时需根据目标动作选择合适的 `domain/action`。

## 前端与索引建议
- 前端：
  - 申诉页校验限频与押金提示；展示“公示期 xx 区块后执行”。
  - 委员会端：为常用动作提供模板，自动填充 domain/action。
- 索引（Subsquid）：
  - 记录 AppealSubmitted/Approved/Rejected/Executed；
  - 关联目标 Pallet 事件，方便审计回溯。
