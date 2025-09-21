# pallet-otc-order（撮合与订单）

- 职责：基于挂单撮合生成订单、记录金额与状态流转（已付/放行/退款/争议）。
- 定价：撮合价不再信任前端/静态输入，统一按“链上价 + spread”计算，并在事件中留存快照。

## 撮合价格
- 从 `pallet-pricing` 读取 `(price_num, price_den, ts)`，校验 `!is_stale(now)`。
- 计算：`base_price = floor(num/den)`；`exec_price = base_price * (1 + spread_bps/10000)`，其中 `spread_bps` 来自关联的 `Listing`。
- 价带保护：若 `price_min/max` 存在，要求 `price_min ≤ exec_price ≤ price_max`。

## 事件
- `OrderOpened { id, listing_id, maker, taker, price, qty, amount, created_at, expire_at }`
  - 其中 `price` 为本次成交的 `exec_price`（按链上价+spread 计算）。

## 风控
- 吃单限频：`OpenRate`（窗口大小与上限由运行时参数配置）。
- 最小订单金额：`MinOrderAmount`。
- 订单确认与证据窗口：`ConfirmTTLParam`。
