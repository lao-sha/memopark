# pallet-memo-affiliate

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
- `BlocksPerWeek = 100_800`；`MaxLevels = 15`；`PerLevelNeed = 3`；
- `LevelRatesBps = [2000,1000,400×13]`（82%）；`BurnBps = 1000`（10%）；`TreasuryBps = 800`（8%）；
- `MaxSearchHops` 防御性限制；`SettlementMode` 默认 Escrow。

## 安全与注意
- 所有转账使用 `transfer_keep_alive`，避免误杀账户；比例恒等校验；分页结算避免单块过重。
- 推荐环与自推由 `pallet-memo-referrals` 保证（只读）；本模块不维护反向索引，重查询交给索引器。
