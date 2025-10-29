# pallet-stardust-referrals

- 职责：一次性绑定推荐关系（单父、防环/自荐、不可变更），为计酬等模块提供只读关系视图。
- 解耦：计酬层级与关系遍历各自治理（MaxLevels vs MaxHops）。

## 存储
- `SponsorOf: AccountId -> AccountId`（被推荐人 → 直属推荐人）
- `BoundAt: AccountId -> BlockNumber`（绑定区块高度）
- `Paused: bool`（暂停新绑定）
- 新增：`ReferralsOf: AccountId -> BoundedVec<AccountId, MaxReferralsPerAccount>`（反向索引）
- 新增：`BannedSponsors: AccountId -> ()`（封禁推荐人，仅影响计酬归集）

### 推荐码（集中治理）
- **统一归口**：推荐码的生成、长度、黑名单与"一次性/是否允许重领"等策略，全部在本模块（referrals）集中治理与实现；其他模块（如 membership、affiliate）不再承载推荐码策略，降低耦合与维护成本。
- **存储**：
  - `CodeOf{AccountId -> BoundedVec<u8,16>}`：账户默认推荐码（一次性领取）。
  - `OwnerOfCode{BoundedVec<u8,16> -> AccountId}`：规范化码的归属索引。
- **事件**：
  - `ReferralCodeAssigned{ who, code }`：首次分配默认码（8位大写HEX）。
- **外部函数**：
  - `claim_default_code()`：✅ **仅限年费会员**申请推荐码
    - 前置1：必须是有效年费会员（购买会员且未过期）
    - 前置2：必须已绑定推荐人（sponsor）
    - 发生冲突自动重试（最多8次）
  - 若需进一步策略（长度/黑名单/是否允许重领）治理，可追加：`set_code_policy(length?, allow_reassign?)`、`set_code_blacklist(code, banned)` 与事件 `CodePolicyUpdated/CodeBlacklistSet`（最小实现已可上线）。
- **Trait 接口（供其他模块使用）**：
  - `find_account_by_code(code)`: 通过推荐码查找账户
  - `get_referral_code(who)`: 获取账户的推荐码
  - `try_auto_claim_code(who)`: 自动为账户分配推荐码（静默失败）
  - `bind_sponsor_internal(who, sponsor)`: 内部绑定推荐关系（供其他模块调用）
- **会员验证**：
  - 通过 `MembershipProvider` trait 验证会员有效性
  - 只有年费会员才能申请推荐码，增强会员权益价值

## 事件
- `SponsorBound { who, sponsor }`
- `PausedSet { value }`
- 新增：`SponsorBannedSet { who, banned }`

## 外部函数
- `bind_sponsor(sponsor)`：一次性绑定；防自荐/防环（MaxHops），已绑定/暂停则拒绝。
- `set_paused(bool)`（Root）
- 新增：`set_banned(who, banned)`（Root）

### 示例（治理调用）
1) 暂停新绑定：`memoReferrals.setPaused(true)`
2) 封禁/解封推荐人：`memoReferrals.setBanned(who, true|false)`
3) 绑定推荐人（用户侧）：`memoReferrals.bindSponsor(sponsor)`（仅限首次，且防环/防自荐）

## 只读接口（Trait）
- `ReferralProvider::{ sponsor_of, ancestors }`
  - 前端与索引建议：默认推荐码读取优先从 `memoReferrals` 读取；Subsquid 监听 `memo_referrals.ReferralCodeAssigned` 事件建立 code↔owner 映射。

## 治理与风控建议
- 反向索引上限：`MaxReferralsPerAccount`（运行时配置）。
- 封禁策略：被封禁推荐人的佣金在 `pallet-memo-affiliate` 中统一归集 `TreasuryAccount/PlatformAccount`，不改 SponsorOf 图。
- 推荐码归口：自本版本起，推荐码策略在 referrals 统一治理；`pallet-memo-affiliate` 不再承载“码策略/生成/事件”，仅依赖 referrals 的只读关系与（如需）只读推荐码。
- 迁移路线：`StorageVersion` bump 至 v2 时，遍历 SponsorOf 构建 ReferralsOf，超上限截断并记录指标；当前版本为 v1，后续升级再引入迁移逻辑。
