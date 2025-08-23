# pallet-otc-order

- 职责：吃单→下单→履约→放行/退款→仲裁。链上仅存承诺（支付方式、联系方式）。

## 接口（骨架）
- `open_order(...)`：基于挂单创建订单。

## 存储
- `Orders: id -> Order{ listing_id, maker, taker, price, qty, amount, commits, state }`
- `NextOrderId`
