# pallet-memo-offerings

- 供奉（祭祀品）目录与下单：规格上架/下架/更新，供奉下单并转账，事件快照，Hook 联动台账/计酬。

## 规格（OfferingSpec）
- `kind_code: u8` 唯一编码
- `name: BoundedVec` 名称
- `media_schema_cid: BoundedVec` 媒体 Schema CID
- `enabled: bool` 上/下架
- `kind: OfferingKind`：Instant 或 Timed{ min,max,can_renew,expire_action }
- 定价（独立存储以便兼容迁移）：
  - `FixedPriceOf(kind_code) -> Option<u128>`（Instant：等值校验）
  - `UnitPricePerWeekOf(kind_code) -> Option<u128>`（Timed：amount==单价×duration）

## 外部函数
- `create_offering(...)`：上架规格
- `update_offering(...)`：更新规格（名称/时长参数）
- `set_offering_enabled(kind_code, enabled)`：上下架
- `set_offering_price(kind_code, fixed_price?: Option<u128>, unit_price_per_week?: Option<u128>)`：更新定价
- `offer(target, kind_code, amount?, media[], duration?)`：下单（强校验：MinOfferAmount + 定价 + 时长策略 + 限频）
- `batch_offer([...])`：批量下单
- `set_offer_params(offer_window?, offer_max_in_window?, min_offer_amount?)`：治理更新风控

## 事件
- `OfferingCreated/Updated/Enabled`
- `OfferingPriceUpdated { kind_code, fixed_price, unit_price_per_week }`
- `OfferingCommitted { id, target, kind_code, who, amount, duration_weeks, block }`

## 校验逻辑（要点）
- Instant：若 `FixedPriceOf` 设置则 `amount==fixed`
- Timed：若 `UnitPricePerWeekOf` 设置则 `amount==unit×duration` 且 `duration` 在 `[min,max]`
- 叠加：`amount ≥ MinOfferAmount` 与 `OfferWindow/OfferMaxInWindow` 滑动窗口

## 迁移兼容
- 定价采用独立存储（非内嵌于 Spec），避免对老数据迁移；未设置定价则保持“自由金额（≥MinOfferAmount）”。