# pallet-otc-order

- 职责：吃单→下单→履约→放行/退款→仲裁。链上仅存承诺（支付方式、联系方式）。

## 接口（骨架）
- `open_order(...)`：基于挂单创建订单（吃单）。
- `mark_paid(id)`：买家标记已支付/已提交凭据。
- `mark_disputed(id)`：将订单标记为争议中（仲裁登记在仲裁 pallet）。
- `release(id)`：卖家放行（从挂单托管划转到买家）。
- `refund_on_timeout(id)`：超时退款（任意人可触发）。
- `reveal_payment(id, payload, salt)` / `reveal_contact(id, payload, salt)`：承诺揭示与校验。

## 存储
- `Orders: id -> Order{ listing_id, maker, taker, price, qty, amount, commits, state }`
- `NextOrderId`
- `ExpiringAt: block -> [order_id]`（到期索引）
- `OpenRate: who -> (start, count)`（吃单限频）
- `PaidRate: who -> (start, count)`（标记支付限频）

## 风控（限频）
- `OpenWindow/OpenMaxInWindow`：吃单滑动窗口与窗口内最大次数（常量，可由 runtime 配置）。
- `PaidWindow/PaidMaxInWindow`：标记支付滑动窗口与窗口内最大次数（常量，可由 runtime 配置）。
