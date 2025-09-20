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

## Extrinsics
- submit_appeal(domain, target, action, reason_cid, evidence_cid)
- withdraw_appeal(id)
- approve_appeal(id, notice_blocks?)（Root | 内容委员会 2/3）
- reject_appeal(id)（Root | 内容委员会 2/3）

## 处罚与资金
- 撤回：按 WithdrawSlashBps 罚没（其余退还给申诉人）
- 驳回：按 RejectedSlashBps 罚没（其余退还给申诉人）
- 通过：公示期到期后执行路由动作，成功后退还押金

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
