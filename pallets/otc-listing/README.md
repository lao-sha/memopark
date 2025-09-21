# pallet-otc-listing（动态价 + spread）

- 职责：做市商发布买/卖挂单，管理数量区间、有效期、是否允许部分成交、条款承诺；报价锚定链上价 `pallet-pricing`，仅维护 spread 与可选价带（min/max）。
- 托管：上链资产场景可与 `pallet-escrow` 对接；法币仅做承诺并走仲裁。

## 接口
- `create_listing(side, base, quote, spread_bps, min_qty, max_qty, total, partial, expire_at, price_min, price_max, terms_commit)`：创建挂单（无静态手填价）。
- `cancel_listing(id)`：取消挂单。
  
附加安全/风控：
- KYC：runtime 可通过 `RequireKyc=true` 开启，调用 `otc_maker::KycProvider::is_verified(who)`。
- 限频：`CreateRate` 记录滑动窗口 `(start, count)`；窗口大小 `CreateWindow`，上限 `CreateMaxInWindow`。
- 上架费：`ListingFee`（默认 0 关闭，收款账户 `FeeReceiver`）。
- 保证金：`ListingBond`（默认 0 关闭；以 `bond_id = id | (1<<63)` 锁入 escrow，取消/到期退回）。

## 存储
- `Listings: id -> Listing{ maker, side, base/quote, pricing_spread_bps, price_min, price_max, min_qty, max_qty, total, remaining, partial, expire_at, terms_commit, active }`
- `NextListingId`
- `ExpiringAt: block -> [listing_id]`（到期索引）
- `CreateRate: who -> (start, count)`（创建限频）

## 价格来源与风控
- 价格来源：`exec_price = floor(num/den) * (1 + spread_bps/10000)`，其中 `(num,den,ts) = pallet-pricing.current_price()`。
- 风控：下单前 `ensure!(!PriceFeed::is_stale(now))`；当 `price_min/max` 设置时，`ensure!(price_min ≤ exec_price ≤ price_max)`。
- 治理参数：`MaxSpreadBps` 上限；`RequireKyc` 是否硬性要求做市商通过 KYC。

## 事件
- `ListingCreated { id, maker, side, base, quote, pricing_spread_bps, price_min, price_max, min_qty, max_qty, total, remaining, partial, expire_at }`
  - 不再输出静态 price；实际成交价在订单事件中留存快照。
- `ListingCanceled { id, escrow_amount, bond_amount }`
  - 取消时输出托管余额快照：`escrow_amount = amount_of(id)`、`bond_amount = amount_of(bond_id(id))`。
- `ListingExpired { id, escrow_amount, bond_amount }`
  - 到期处理时同样输出托管余额快照，便于索引与审计核对。
