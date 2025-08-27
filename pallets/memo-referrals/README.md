# pallet-memo-referrals

极简推荐关系源（只读可复用），只负责维护一次性绑定的推荐关系：`who -> sponsor`。

## 设计目标
- 稳定：一旦绑定不可改，避免策略变化导致图重写。
- 低耦合：不触碰资金，不做计酬，仅提供读取接口。
- 最小存储：不维护反向索引，子集交给索引器（SubQuery 等）。
- 可治理：可暂停新绑定。

## 存储
- `SponsorOf: AccountId -> AccountId`：被推荐人到直属推荐人。
- `BoundAt: AccountId -> BlockNumber`：绑定发生的区块（可选统计用）。
- `Paused: bool`：治理暂停位。

## 外部接口（解耦 trait）
- `ReferralProvider<AccountId>`：
  - `sponsor_of(who) -> Option<AccountId>`
  - `ancestors(who, max_hops) -> Vec<AccountId>`

## 绑定规则与防环
- 一次性绑定：仅允许每个账户绑定一次 `referrer`，绑定后不可修改。
- 防自推：`referrer != who`。
- 防环：绑定时自下而上遍历祖先链，若命中 `who` 则拒绝；遍历层数受 `MaxHops` 常量限制。
- 暂停：当 `Paused=true` 时禁止新绑定（链上已有关系不受影响）。

## 调用
- `bind_sponsor(sponsor)`：一次性绑定；防自推、防环、防重复；受暂停控制。
- `set_paused(value)`：Root 设定暂停开关。

## 版本迁移
- 使用 `StorageVersion` 管理升级，兼容未来迁移。

## 安全
- 不触碰资金逻辑；链上仅存账号关系，遵循最小披露原则。

## 与联盟计酬（pallet-memo-affiliate）的对接
- 本 pallet 仅提供只读关系：联盟计酬在供奉发生时自下而上按“动态压缩 15 层”查找有效上级：
  - 合格条件：上级处于有效供奉期，且其“直推有效数 ≥ 3×层数”。
  - 遍历方式：从 `SponsorOf(who)` 开始逐级上溯，跳过不合格者，直到凑满 15 人或到顶；最多遍历 `MaxSearchHops` 层（由联盟模块配置）。
- “直推有效数”的维护、活跃标记与到期回退均在联盟模块内完成；本模块不写入任何与活跃或资金相关的状态。

## 性能与索引建议
- 不维护“子节点列表/反向索引”，避免状态膨胀；需要全量子树或统计请使用链下索引器（SubQuery 等）。
- 读取祖先采用 `ancestors(who, max_hops)` 分页或限深策略，结合联盟模块的上限（如 15 层与搜索跳数）保证可预估的链上成本。

## 参数建议（由 runtime 注入）
- `MaxHops`：向上遍历最大层级（建议 ≥ 32，满足深链查询但有限制）。
- 治理开关：`Paused` 默认 false；极端情况下可暂停新绑定，保障 MEMO 资金与用户关系稳定。
