# pallet-ledger

- 目标：保留奖励逻辑需要的最小字段，易膨胀/高变动查询交由 Subsquid。
- 存储（最小集）：
  - `TotalsByGrave: GraveId -> u64`（累计供奉次数）
  - `TotalMemoByGrave: GraveId -> Balance`（累计金额）
  - `WeeklyActive: (GraveId, AccountId, week_index) -> ()`（按周活跃标记）
- 常量：
  - `BlocksPerWeek`（默认建议 100_800，6s/块 × 60 × 60 × 24 × 7）
- Extrinsics：无（管理清理由索引器与归档层承担；不再存储明细）
- Hook 写入（由 runtime 适配）：
  - `record_from_hook_with_amount(grave_id, who, kind_code, amount?, memo?)`
  - `mark_weekly_active(grave_id, who, start_block, duration_weeks?)`
- 判定 API：
  - `is_current_week_active(grave_id, &who)` / `is_week_active(grave_id, &who, week_index)`
- 迁移与扩展：
  - 旧 `pallet-grave-ledger` 的 Top/明细/分类统计等，迁至 Subsquid；链上仅保留最小统计。
  - 后续若需清理旧存储，可在本 pallet 增加 `OnRuntimeUpgrade` 分批 `kill_prefix`。


