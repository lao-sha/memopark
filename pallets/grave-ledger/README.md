# pallet-grave-ledger

- 用途：按墓位（grave）记录供奉（offering）历史，提供“最近 N 条明细 + 累计统计（总次数/分类次数）”。
- 低耦合：通过 `pallet-memorial-offerings` 的 Hook 写入；不直接依赖其内部数据结构。
- 隐私与安全：仅存最小元数据与可选 memo（CID/URL），不做任何 MEMO 资金处理。

## 存储
- `NextLogId: u64`
- `LogOf: LogId -> { grave_id, who, kind_code, block, memo? }`
- `RecentByGrave: GraveId -> BoundedVec<LogId, MaxRecentPerGrave>`
- `TotalsByGrave: GraveId -> u64`
- `TotalsByGraveKind: (GraveId, u8) -> u64`
- `TotalMemoByGrave: GraveId -> Balance`（累计金额）
- `TotalMemoByGraveUser: (GraveId, AccountId) -> Balance`（按用户累计金额）
- `TopGraves: BoundedVec<{ grave_id, total }, MaxTopGraves>`
- `WeeklyActive: (GraveId, AccountId, week_index) -> ()`（按周的“有效供奉”标记）

## 常量建议
- `MaxRecentPerGrave = 256`
- `MaxMemoLen = 64`
- `MaxTopGraves = 100`
- `BlocksPerWeek = 100_800`（6s/块 × 60 × 60 × 24 × 7）

## Extrinsics
- `prune_grave(grave_id, keep_last)`：Root/管理员清理历史，只保留最近 `keep_last` 条（防状态膨胀）。

## Hook 写入（由 runtime 适配）
- 在 runtime 实现 `pallet-memo-offerings::OnOfferingCommitted`，将供奉事件写入本模块：
```rust
// 记录流水 + 标记有效周
pallet_grave_ledger::Pallet::<Runtime>::record_from_hook_with_amount(grave_id, who.clone(), kind_code, amount, None);
let should_mark = duration_weeks.is_some() || amount.is_some();
if should_mark {
    let now = <frame_system::Pallet<Runtime>>::block_number();
    pallet_grave_ledger::Pallet::<Runtime>::mark_weekly_active(grave_id, who.clone(), now, duration_weeks);
}
```

## 判定：“当前周是否有效供奉”
- 运行时内调用：
```rust
let active = pallet_grave_ledger::Pallet::<Runtime>::is_current_week_active(grave_id, &who);
```
- 手工计算周索引并查询：
```rust
use sp_runtime::traits::SaturatedConversion;
let now = <frame_system::Pallet<Runtime>>::block_number();
let bpw = <Runtime as pallet_grave_ledger::Config>::BlocksPerWeek::get() as u128;
let week_idx = (now.saturated_into::<u128>() / bpw) as u64;
let active = pallet_grave_ledger::Pallet::<Runtime>::is_week_active(grave_id, &who, week_idx);
```

## 迁移与扩展
- 后续可增加“按月/按日”维度标记，或在 `on_initialize` 维护 `CurrentWeekIndex` 辅助只读查询。
- 排行/分析继续由本模块负责金额与 TopN，业务结算模块仅依赖 `WeeklyActive` 与金额统计。
