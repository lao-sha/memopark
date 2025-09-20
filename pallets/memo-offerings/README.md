# pallet-memo-offerings

- 供奉（祭祀品）目录与下单：规格上架/下架/更新，供奉下单并转账，事件快照，Hook 联动台账/计酬。

## 规格（OfferingSpec）
- `kind_code: u8` 唯一编码
- `name: BoundedVec` 名称
- `media_schema_cid: BoundedVec` 媒体 Schema CID
- `enabled: bool` 上/下架
- `kind: OfferingKind`：Instant 或 Timed{ min,max,can_renew,expire_action }
- 定价（独立存储以便兼容迁移）：
  - `FixedPriceOf(kind_code) -> Option<u128>`（Instant：等值校验）
  - `UnitPricePerWeekOf(kind_code) -> Option<u128>`（Timed：amount==单价×duration）

## 外部函数
- `create_offering(...)`：上架规格
- `update_offering(...)`：更新规格（名称/时长参数）
- `set_offering_enabled(kind_code, enabled)`：上下架
- `set_offering_price(kind_code, fixed_price?: Option<u128>, unit_price_per_week?: Option<u128>)`：更新定价
- `offer(target, kind_code, amount?, media[], duration?)`：下单（强校验：MinOfferAmount + 定价 + 时长策略 + 限频）
- `offer_by_sacrifice(target, sacrifice_id, media[], duration_weeks?, is_vip)`：基于目录下单
  - 读取目录定价与“专属主体”限制；若 `exclusive_subjects` 非空，则仅当 `target` 属于该集合 `(domain,u64)` 之一才允许下单
- `batch_offer([...])`：批量下单
- `set_offer_params(offer_window?, offer_max_in_window?, min_offer_amount?)`：治理更新风控
- `set_pause_global(paused)`：全局暂停供奉
- `set_pause_domain(domain, paused)`：按域暂停供奉

### 治理层（gov*，带证据 CID）
- `gov_set_offer_params(offer_window?: Option<BlockNumber>, offer_max_in_window?: Option<u32>, min_offer_amount?: Option<u128>, evidence_cid: Vec<u8>)`
- `gov_set_offering_price(kind_code: u8, fixed_price?: Option<Option<u128>>, unit_price_per_week?: Option<Option<u128>>, evidence_cid: Vec<u8>)`
- `gov_set_pause_global(paused: bool, evidence_cid: Vec<u8>)`
- `gov_set_pause_domain(domain: u8, paused: bool, evidence_cid: Vec<u8>)`
- `gov_set_offering_enabled(kind_code: u8, enabled: bool, evidence_cid: Vec<u8>)`（治理上下架）
> 以上接口需满足 `Config::GovernanceOrigin`（例如 Root 或内容委员会阈值），并在链上事件中记录证据 CID（明文，不加密）。

## 事件
- `OfferingCreated/Updated/Enabled`
- `OfferingPriceUpdated { kind_code, fixed_price, unit_price_per_week }`
- `OfferingCommitted { id, target, kind_code, who, amount, duration_weeks, block }`
- `OfferingCommittedBySacrifice { id, target, sacrifice_id, who, amount, duration_weeks, block }`
- `PausedGlobalSet { paused }` / `PausedDomainSet { domain, paused }`
- `GovEvidenceNoted(scope: u8, key: u64, cid: BoundedVec<u8, MaxCidLen>)`（治理证据；scope：1=Params，2=Price，3=PauseG，4=PauseD）

## 路由码表（示例）
- `(6,50)`：按域暂停（以常量域 1=grave 为例）
- `(6,51)`：上/下架供奉模板（以 `target` 的低 8 位传 `kind_code`；当前实现示例固定启用 `enabled=true`）

## 校验逻辑（要点）
- Instant：若 `FixedPriceOf` 设置则 `amount==fixed`
- Timed：若 `UnitPricePerWeekOf` 设置则 `amount==unit×duration` 且 `duration` 在 `[min,max]`
- 叠加：`amount ≥ MinOfferAmount` 与 `OfferWindow/OfferMaxInWindow` 滑动窗口
- 目标级限频：`OfferRateByTarget[(domain,id)]` 与账户级并行控制
- 专属主体校验：当目录项 `exclusive_subjects: Vec<(domain,u64)>` 非空时，要求 `target==(domain,u64)` 命中其一；支持人类逝者域与宠物域

## 与 memo-sacrifice 的集成
- 通过 `Config::Catalog` 读取目录定价与专属主体集合；
- 读取 `effect_of(sacrifice_id) -> Option<EffectSpec>`，若存在且 `target_domain` 命中则回调 `Config::Consumer::apply` 应用效果（例如喂宠物道具）；失败不回滚转账；
- 目录/交易分层与低耦合：目录不执行效果，仅声明元数据；交易完成后由消费侧 Pallet 执行具体效果。

## 迁移兼容
- 定价采用独立存储（非内嵌于 Spec），避免对老数据迁移；未设置定价则保持“自由金额（≥MinOfferAmount）”。

## 委员会阈值 + 申诉治理流程
- 申诉：前端 `#/gov/appeal` 提交 `domain/action/target/reason_cid/evidence_cid`，链上冻结押金；
- 审批：内容委员会 2/3 通过后进入公示期；驳回/撤回按链上参数罚没至国库；
- 执行：公示期满由 `execute_approved` 路由至本模块 `gov_*` 执行，记录证据事件，CID 明文不加密；
- 模板：前端 `#/gov/templates` 提供常用动作模板与 target 填写提示。