# pallet-memo-affiliate
## 推荐码（已迁移与去耦）

- 自本版本起，推荐码的“策略/生成/事件”已统一迁移至 `pallet-memo-referrals`：
  - 领取入口：`memoReferrals.claimDefaultCode()`（仅当已绑定 sponsor 时可领，一次性）。
  - 事件：`memo_referrals.ReferralCodeAssigned`（Subsquid 监听以建立 code↔owner 映射）。
  - 策略治理（可选扩展）：长度/黑名单/是否允许重领，均在 referrals 侧集中治理，affiliate 不再承载，降低耦合与维护成本。
  - 前端：Profile 页读取/领取推荐码统一迁往 `memoReferrals`。

联盟计酬模块（托管结算 + 15 层压缩分配），依赖 `pallet-memo-referrals` 作为唯一推荐关系源。

## 目标与特性
- 托管安全：供奉入金先进入托管账户（PalletId），周期末批量结算，降低每笔多转账负载。
- 非压缩不等比：每笔最多 15 层，比例为 L1=20%、L2=10%、L3..L15=各 4%（合计 82%）；仅当上级“处于有效供奉期”且“直推有效数≥3×层数”时获得该层奖励；不合格即该层份额并入国库，不再压缩。
- 剩余并库：不足 15 层的预算并入国库；另有 10% 销毁与 15% 国库的基础份额。
- 周活跃：以“周”为周期维护活跃期与直推有效计数，和供奉 Hook 的 `duration_weeks` 对齐。
- 可治理：比例、层数、阈值、结算模式可通过 runtime 参数调整。

## 核心流程
1) 供奉发生（offerings Hook 调用 `report`）
- 标记活跃：根据 `duration_weeks` 延长 `ActiveUntilWeek`；首次从非活跃→活跃时给 sponsor 的 `DirectActiveCount +1`，并添加到期清单。
- 记账分配：逐层按固定距离与不等比例（20/10/4…）判断获奖者；合格则 `Entitlement += 该层份额`；不合格/不存在该层祖先则将该层份额并入国库。累计 `BurnAccrued += 10%×base`、`TreasuryAccrued += 8%×base + 未发层份额`。
- 资金归集：供奉金额已由 `pallet-memo-offerings` 路由至托管账户（PalletId）。

2) 周期末结算（分页）
- `settle(cycle, max_pay)`：从托管账户向 `Entitlement` 累计的账户分页转账；尾部支付本周销毁与国库；清理索引与游标。

## 接口（对外）
- `ConsumptionReporter::report(who, amount, meta, now, duration_weeks)`：供奉来源调用；内部完成活跃标记与记账式分配。
- `set_mode(Escrow|Immediate)`：治理切换结算模式（默认 Escrow）。
- `settle(cycle, max_pay)`：分页结算指定周数据。

## 存储（主要）
- `ActiveUntilWeek(AccountId) -> WeekNo`：活跃截至周（含）。
- `DirectActiveCount(AccountId) -> u32`：当前直推有效人数。
- `ExpiringAt(WeekNo) -> Vec<AccountId>`：到期回退清单。
- `Entitlement(WeekNo, AccountId) -> Balance`：本周应得累计。
- `EntitledAccounts(WeekNo) -> Vec<AccountId>`：本周应结账户索引（分页）。
- `BurnAccrued / TreasuryAccrued -> (WeekNo, Balance)`：本周销毁与国库累计。
- `SettleCursor(WeekNo) -> u32`：分页结算进度。

## 参数（可治理）
- 基础：`BlocksPerWeek = 100_800`；`MaxLevels = 15`；`PerLevelNeed = 3`；
- 比例：`LevelRatesBps = [2000,1000,400×13]`（82%）；`BurnBps = 1000`（10%）；`TreasuryBps = 800`（8%）；
- 防御：`MaxSearchHops`；`SettlementMode` 默认 Escrow。
- 新增（存储参数，运行时可通过 Root 更新）：
  - `BudgetSourceAccount`：奖励资金来源账户（默认为 Escrow PalletId 派生账户）。
  - `BudgetCapPerCycle`：每周奖励发放上限（0 表示不限制）。
  - `CycleRewardUsed(cycle)`：本周已计入的上级奖励额度。
  - `MinStakeForReward`：上级最小持仓门槛，未达则该层份额并入国库。
  - `MinQualifyingAction`：最小有效行为次数（占位，默认 0）。

读取方式（前端）：
```ts
// 读取预算上限与门槛（示例）
const cap = await api.query.memoAffiliate.budgetCapPerCycle();
const minStake = await api.query.memoAffiliate.minStakeForReward();
```

治理更新：
```ts
// Root: 更新奖励参数（未提供的字段保持不变）
api.tx.memoAffiliate.setRewardParams(
  /* budget_source: Option<AccountId> */ null,
  /* budget_cap_per_cycle: Option<Balance> */ someCap,
  /* min_stake_for_reward: Option<Balance> */ someMinStake,
  /* min_qual_actions: Option<u32> */ 0,
)
```

## 安全与注意
- 所有转账使用 `transfer_keep_alive`，避免误杀账户；比例恒等校验；分页结算避免单块过重。
- 推荐环与自推由 `pallet-memo-referrals` 保证（只读）；本模块不维护反向索引，重查询交给索引器。
 - 预算与门槛：
   - 分配时按 `BudgetCapPerCycle` 控制：本周额度不足时，仅按 `min(share, allowed)` 计入，超出部分并入国库；
   - `MinStakeForReward` 未达到、上级被封禁或不满足直推门槛时，该层份额并入国库；
   - 记账精度向下取整，remainder 并库，确保不超发。

## 事件
- `RewardClaimed { cycle, to, amount }`：结算时支付给账户；
- `RewardParamsUpdated`：治理更新奖励参数；
- 其余：`EscrowRecorded / Entitled / Settled / ActiveMarked / ModeChanged`。

## 封禁推荐人归集（风控）
- 依赖 `pallet-memo-referrals::BannedSponsors` 与 `ReferralProvider::is_banned(who)`：
  - 在 `record_distribution` 的逐层分配中，若某层上级被封禁，直接将该层份额并入当周 `treasury_extra`，不发放给该上级；
  - 该机制不改变推荐关系图（SponsorOf 不变），仅影响结算归集，满足风控与合规；
  - Root 可通过 `pallet-memo-referrals::set_banned(who, banned)` 动态管理封禁名单。

### 示例（治理操作）
1) 封禁某账户作为推荐人：
   - 调用：`memoReferrals.setBanned(who, true)`
2) 解除封禁：
   - 调用：`memoReferrals.setBanned(who, false)`
3) 结算某周：
   - 调用：`memoAffiliate.settle(cycle, max_pay)`；本周被封禁上游的份额将并入国库在尾部统一划拨。