pallet-market-maker（草案）

> 低耦合：将“做市商治理+押金机制”从业务侧抽离；`pallet-otc-maker` 仅依赖其只读状态。

目标
- 先质押 (lock_deposit) → 再提交资料 (submit_info) → 委员会批准/驳回 (approve/reject)
- 资金安全：holds/reserve 锁定 MEMO；统一释放路径；提现限额/时间锁可选
- 资料分级：公开资料明文 CID；私密资料“内容加密+密钥包”，CID 明文

Storage（示例）
- Applications: mm_id -> { owner, deposit, status, public_root_cid, private_root_cid, fee_bps, pairs, min_amounts, submitted_at, expires_at }
- OwnerIndex: owner -> Option<mm_id>（可选）
- Config: MinDeposit, InfoWindow, ReviewWindow, RejectSlashBpsMax, MaxPairs, StorageDepositPerItem

Calls
- lock_deposit(amount) → DepositLocked（24h 提交窗口）
- submit_info(mm_id, public_root_cid, private_root_cid, fee_bps, pairs, min_amounts) → PendingReview
- cancel(mm_id)（仅 DepositLocked）→ 退回/扣手续费
- approve(mm_id)（collective）→ Active（押金转长期质押）
- reject(mm_id, slash_bps)（collective）→ 按比例扣罚+退余，Rejected
- expire_cleanup(mm_id)（anyone）→ 超时自动处理

Events
- Applied / Approved / Rejected / Cancelled / Expired / DepositSlashed / DepositReleased

安全
- 使用 FRAME v2 holds 或 ReservableCurrency；拒绝未授权转出
- 约束：各字段 BoundedVec 上限、长度限制、Weight 上限；StorageDeposit 收取

与 pallet-otc-maker 的关系
- otc-maker 仅读取 mm_status(mm_id) 等，只读依赖；不再承载治理与押金逻辑

后续
- Benchmark/Weights、单测
- 追加质押、调费率、批量对等扩展

