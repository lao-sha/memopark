# pallet-memo-offerings

- 作用：祭祀品规格目录与供奉记录；替换旧 `pallet-ritual`。
- 隐私：媒体由本 Pallet 自身存储，仅上链 CID 与可选承诺（commit），不落明文。
- 解耦：目标采用 `(domain_code:u8, id:u64)`；存在性与权限通过 `TargetControl`；回调 `OnOfferingCommitted` 联动积分/统计。
 - 管理：支持注入管理员 `Origin` 上架/下架/编辑规格，普通用户仅能下单。

## 存储
- `Specs: kind_code -> OfferingSpec { name, media_schema_cid, enabled: bool, kind: OfferingKind }`
- `OfferingRecords: id -> OfferingRecord { who, target, kind_code, amount?, media[], duration?(单位：周), time }`
- `OfferingsByTarget: target -> BoundedVec<id>`
- `NextOfferingId: u64`

## Extrinsics
- 管理员（AdminOrigin）：
  - `create_offering(kind_code, name, media_schema_cid, kind_flag(0/1), min_duration?, max_duration?, can_renew, expire_action, enabled)`
  - `update_offering(kind_code, name?, media_schema_cid?, min_duration??, max_duration??, can_renew?, expire_action?)`
  - `set_offering_enabled(kind_code, enabled)`
- 用户：
  - `offer(target, kind_code, amount?, media[], duration?)`
  - `batch_offer([...])`

## 迁移
- 旧 `pallet-ritual` 下线，前端改为使用本 pallet 的 API。历史数据可选择迁移或保留只读。
 - 若从旧版本升级（未含管理员与时长）：
   - 旧 `OfferingSpec` 视为 `enabled=true, kind=Instant`
   - 旧 `OfferingRecord` 视为 `duration=None`

## Hook 回调（与账本/排行榜联动）
- 回调接口：`OnOfferingCommitted(target, kind_code, who, amount?, duration_weeks?)`
  - `amount?`: 本次实际成功转账的 MEMO 数额；无转账为 `None`
  - `duration_weeks?`: 若为 Timed 供奉则为以“周”为单位的时长；Instant 为 `None`
- 运行时可在 Hook 中写入 `pallet-grave-ledger` 与 `pallet-memo-affiliate`：
  - 始终记录供奉流水；
  - 若 `duration_weeks.is_some()`（Timed），从当周起连续标记 `w` 周为“有效供奉”；
  - 若为 Instant，仅在 `amount.is_some()` 时标记当周为“有效供奉”。
  - 分销托管：当存在入金时，调用 `pallet-memo-affiliate::report(who, amount, Some(target), now, duration_weeks)` 仅记账与托管归集；真实转账在联盟模块的周期结算中进行。

## 有效供奉周期（按周）
- 周长度：由 `pallet-grave-ledger::BlocksPerWeek` 常量给出（默认 100_800，6s/块）。
- 判定规则（在运行时 Hook 中已实现）：
  - Timed：不依赖是否发生转账，按下单周起连续 `duration` 周均视为有效；
  - Instant：仅当存在实际支付（`amount>0`）的当周视为有效。
  - 以上标记写入 `pallet-grave-ledger::WeeklyActive` 存储，供结算/统计查询。

## 托管路由（重要）
- 供奉入金账户由运行时的 `DonationAccountResolver` 决定。为支持托管结算，运行时将其路由到联盟托管账户（PalletId 派生）。
- 结算在 `pallet-memo-affiliate` 中进行：每周分页向获奖账户、黑洞与国库划拨；不足 15 层的预算并入国库。

## 新增（与成员制联动）
- `TargetControl` 增加可选接口 `is_member_of(target, who)`；
- 运行时可在 `ensure_allowed` 中要求“仅成员可供奉”（对域 code=1 的 Grave 生效），其余域放行。