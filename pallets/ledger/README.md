# pallet-ledger

- 目标：保留奖励逻辑需要的最小字段，易膨胀/高变动查询交由 Subsquid。
- 存储（最小集）：
  - `TotalsByGrave: GraveId -> u64`（累计供奉次数）
  - `TotalMemoByGrave: GraveId -> Balance`（累计金额）
  - `WeeklyActive: (GraveId, AccountId, week_index) -> ()`（按周活跃标记）
- 常量：
  - `BlocksPerWeek`（默认建议 100_800，6s/块 × 60 × 60 × 24 × 7）
- Extrinsics：
  - `purge_weeks(grave_id, who, before_week, limit)`：按阈值清理历史周活跃标记（仅本人可调用）
  - `purge_weeks_by_range(grave_id, who, start_week, end_week, limit)`：按区间批量清理
- Hook 写入（由 runtime 适配）：
  - `record_from_hook_with_amount(grave_id, who, kind_code, amount?, memo?)`
  - `mark_weekly_active(grave_id, who, start_block, duration_weeks?)`
  - 去重键（可选）：`tx_key: Option<H256>`，命中则幂等不重复累计
- 判定 API：
  - `is_current_week_active(grave_id, &who)` / `is_week_active(grave_id, &who, week_index)`
  - `week_index_of_block(block)` / `current_week_index()`
  - `weeks_active_bitmap(grave_id, &who, start_week, len)`：连续周活跃位图（bit=1 表示活跃）
- 迁移与扩展：
  - 旧 `pallet-grave-ledger` 的 Top/明细/分类统计等，迁至 Subsquid；链上仅保留最小统计。
  - 后续若需清理旧存储，可在本 pallet 增加 `OnRuntimeUpgrade` 分批 `kill_prefix`。

## 周计算与建议

- 周索引：`week_index = floor(block_number / BlocksPerWeek)`。
- 推荐 `BlocksPerWeek = 100_800`（6s/块）。
- 清理建议：
  - 活跃位图/统计可通过 `purge_weeks*` 定期清理旧周，控制存储规模；
  - 建议前端或离线维护任务根据活跃度与页面需求，滚动清理 6-12 个月前的数据；
  - `limit` 参数用于分批删除，避免一次交易过重。

## 权重

- 已引入 `Config::WeightInfo`，并提供手写占位 `weights.rs`；
- 推荐使用 `frame-benchmarking` 自动生成覆盖 `purge_weeks*`、`record_from_hook_with_amount`、`add_to_deceased_total`、`mark_weekly_active`。



