# pallet-grave-ledger

- 用途：按墓位（grave）记录供奉（offering）历史，提供“最近 N 条明细 + 累计统计（总次数/分类次数）”。
- 低耦合：通过 `pallet-memorial-offerings` 的 Hook 写入；不直接依赖其内部数据结构。
- 隐私与安全：仅存最小元数据与可选 memo（CID/URL），不做任何 BUD 资金处理。

## 存储
- `NextLogId: u64`
- `LogOf: LogId -> { grave_id, who, kind_code, block, memo? }`
- `RecentByGrave: GraveId -> BoundedVec<LogId, MaxRecentPerGrave>`
- `TotalsByGrave: GraveId -> u64`
- `TotalsByGraveKind: (GraveId, u8) -> u64`

## Extrinsics
- `prune_grave(grave_id, keep_last)`：Root/管理员清理历史，只保留最近 `keep_last` 条（防状态膨胀）。

## Hook 写入（由 runtime 适配）
- 在 runtime 实现 `pallet-memorial-offerings::OnOfferingCommitted`，将供奉事件写入本模块：
```rust
pub struct GraveOfferingHook;
impl pallet_memorial_offerings::pallet::OnOfferingCommitted<AccountId> for GraveOfferingHook {
    fn on_offering(target: (u8, u64), kind_code: u8, who: &AccountId) {
        const DOMAIN_GRAVE: u8 = 1; // 约定域常量
        if target.0 == DOMAIN_GRAVE {
            pallet_grave_ledger::Pallet::<Runtime>::record_from_hook(target.1, who.clone(), kind_code, None);
        }
    }
}
```

## 运行时配置建议
- `MaxRecentPerGrave = 256`
- `MaxMemoLen = 64`

## 迁移与扩展
- 如后续需记录数量/金额，可：
  - 由索引器从 `pallet-memorial-offerings` 事件补全；或
  - 扩展 Hook 传入 `offering_id/qty/amount`，再扩本模块字段。
