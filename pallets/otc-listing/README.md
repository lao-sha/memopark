# pallet-otc-listing

- 职责：做市商发布买/卖挂单，管理价格、数量区间、有效期、是否允许部分成交、条款承诺。
- 托管：上链资产场景可与 `pallet-escrow` 对接；法币仅做承诺并走仲裁。

## 接口（骨架）
- `create_listing(...)`：创建挂单。
- `cancel_listing(id)`：取消挂单。
  
附加安全/风控：
- KYC：runtime 可通过 `RequireKyc=true` 开启，调用 `otc_maker::KycProvider::is_verified(who)`。
- 限频：`CreateRate` 记录滑动窗口 `(start, count)`；窗口大小 `CreateWindow`，上限 `CreateMaxInWindow`。
- 上架费：`ListingFee`（默认 0 关闭，收款账户 `FeeReceiver`）。
- 保证金：`ListingBond`（默认 0 关闭；以 `bond_id = id | (1<<63)` 锁入 escrow，取消/到期退回）。

## 存储
- `Listings: id -> Listing{ maker, side, base/quote, price, qty_range, total, expire_at, terms_commit }`
- `NextListingId`
- `ExpiringAt: block -> [listing_id]`（到期索引）
- `CreateRate: who -> (start, count)`（创建限频）
