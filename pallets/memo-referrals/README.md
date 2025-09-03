# pallet-memo-referrals

- 职责：一次性绑定推荐关系（单父、防环/自荐、不可变更），为计酬等模块提供只读关系视图。
- 解耦：计酬层级与关系遍历各自治理（MaxLevels vs MaxHops）。

## 存储
- `SponsorOf: AccountId -> AccountId`（被推荐人 → 直属推荐人）
- `BoundAt: AccountId -> BlockNumber`（绑定区块高度）
- `Paused: bool`（暂停新绑定）
- 新增：`ReferralsOf: AccountId -> BoundedVec<AccountId, MaxReferralsPerAccount>`（反向索引）
- 新增：`BannedSponsors: AccountId -> ()`（封禁推荐人，仅影响计酬归集）

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

## 治理与风控建议
- 反向索引上限：`MaxReferralsPerAccount`（运行时配置）。
- 封禁策略：被封禁推荐人的佣金在 `pallet-memo-affiliate` 中统一归集 `TreasuryAccount/PlatformAccount`，不改 SponsorOf 图。
- 迁移路线：`StorageVersion` bump 至 v2 时，遍历 SponsorOf 构建 ReferralsOf，超上限截断并记录指标；当前版本为 v1，后续升级再引入迁移逻辑。
