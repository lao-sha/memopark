# pallet-pricing（链上价格源/风控最小实现）

本模块提供链上“报价快照 + 陈旧/跳变风控 + 事件”，供 `pallet-memo-bridge` 等模块只读使用，不触碰资金。

## 接口
- set_price(num, den)：Root/白名单喂价；限制单次跳变
- set_params(stale_seconds, max_jump_bps)：Root 调整风控
- set_pause(on)：Root 暂停
- set_feeders(accounts[])：Root 白名单

## 存储
- Price：{ price_num, price_den, last_updated }
- Params：{ stale_seconds, max_jump_bps, paused }
- Feeders：白名单

## 读取 Trait
- PriceProvider：`current_price() -> Option<(num, den, ts)>`；`is_stale(now_seconds) -> bool`

## 设计说明
- 不加密；事件化便于审计；前端显示更新时间与陈旧标志。
- 未来可扩展多交易对与 TWAP/中位数聚合，桥侧无感。


