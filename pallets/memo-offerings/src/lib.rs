#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    // 函数级中文注释：移除未使用的 StorageVersion 导入以消除未使用警告
    use alloc::vec::Vec;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, EnsureOrigin, ExistenceRequirement},
        BoundedVec, CloneNoBound, EqNoBound, PartialEqNoBound,
    };
    use frame_system::pallet_prelude::*;
    // 引入 PerThing 以便使用 Permill::ACCURACY 常量
    use sp_runtime::{
        traits::{SaturatedConversion, Saturating},
        PerThing, Permill,
    };

    /// 函数级中文注释：目标控制接口。
    /// - exists：目标是否存在；
    /// - ensure_allowed：是否允许对目标发起供奉（如墓地关闭、逝者隐私等）。
    /// - 说明：为避免引用私有 OriginTrait，直接将 AccountId 作为独立泛型注入。
    pub trait TargetControl<Origin, AccountId> {
        fn exists(target: (u8, u64)) -> bool;
        fn ensure_allowed(origin: Origin, target: (u8, u64)) -> DispatchResult;
        /// 函数级中文注释：用于成员制的允许策略（例如仅允许成员供奉）。
        /// - 返回 true 表示该调用者为目标的成员。
        fn is_member_of(target: (u8, u64), who: &AccountId) -> bool {
            let _ = (target, who);
            true
        }
    }

    /// 函数级中文注释：供奉提交后的回调接口，用于统计或联动积分。
    pub trait OnOfferingCommitted<AccountId> {
        /// 函数级详细中文注释：供奉落账后的回调。
        /// - target: (domain_code, id)
        /// - kind_code: 供奉规格编码
        /// - who: 供奉发起者
        /// - amount: 实际成功转账的金额（若无转账则为 None）
        /// - duration_weeks: 若为 Timed 供奉，则以"周"为单位的时长；Instant 则为 None。
        /// - routed: 路由分账记录，每个元素为 (账户, 金额)，记录了资金流向
        fn on_offering(
            target: (u8, u64),
            kind_code: u8,
            who: &AccountId,
            amount: Option<u128>,
            duration_weeks: Option<u32>,
            routed: alloc::vec::Vec<(AccountId, u128)>,
        );
    }

    /// 函数级中文注释：捐赠账户解析器（由 runtime 注入）。
    /// - 输入目标 (domain_code, id)，返回应接收捐赠的账户。
    pub trait DonationAccountResolver<AccountId> {
        fn account_for(target: (u8, u64)) -> AccountId;
    }

    /// 函数级中文注释：供奉收款路由（多路分账）。
    /// - 输入：目标与总额（u128），返回 [(账户, 份额permill)]；∑ ≤ 100%。
    /// - Pallet 内部将按比例转账；剩余部分回退到 DonationResolver 账户。
    pub trait DonationRouter<AccountId> {
        fn route(target: (u8, u64), gross: u128) -> alloc::vec::Vec<(AccountId, Permill)>;
    }

    /// 函数级中文注释：会员信息提供者接口（用于供奉折扣验证）
    /// - 由 pallet-membership 实现
    /// - 供奉购买时检查会员状态并应用折扣
    pub trait MembershipProvider<AccountId> {
        /// 函数级中文注释：检查账户是否为有效会员
        /// - 返回 true 表示账户是有效会员（已购买且未过期）
        /// - 返回 false 表示不是会员或会员已过期
        fn is_valid_member(who: &AccountId) -> bool;
        
        /// 函数级中文注释：获取会员折扣比例（0-100）
        /// - 返回折扣百分比，例如：30 表示30%（3折）
        /// - 供奉最终价格 = 原价 × 折扣比例 / 100
        fn get_discount() -> u8;
    }

    /// 函数级中文注释：祭祀品目录只读接口（由 runtime 提供实现，指向 memo-sacrifice）。
    /// - spec_of：读取 (fixed_price, unit_price_per_week, enabled, is_vip_exclusive, exclusive_subjects)
    /// - can_purchase：校验可购（结合会员态）
    /// - effect_of：读取可选"消费效果"定义（例如宠物道具效果），由消费侧解释与应用
    pub trait SacrificeCatalog<AccountId, SacrificeId, Balance, BlockNumber> {
        fn spec_of(
            id: SacrificeId,
        ) -> Option<(
            Option<Balance>,
            Option<Balance>,
            bool,
            bool,
            alloc::vec::Vec<(u8, u64)>,
        )>;
        fn can_purchase(who: &AccountId, id: SacrificeId, is_vip: bool) -> bool;
        fn effect_of(id: SacrificeId) -> Option<EffectSpec> {
            let _ = id;
            None
        }
    }

    /// 函数级中文注释：消费效果定义（跨 Pallet 的低耦合数据契约）。
    /// - 目录层仅声明效果元数据；具体业务由消费侧解释与应用。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub struct EffectSpec {
        /// 是否为一次性消耗品（true 则消费后不入库，立即生效；false 可由消费侧选择入库）
        pub consumable: bool,
        /// 目标域（例如：1=Grave，3=Pet）
        pub target_domain: u8,
        /// 效果种类（由消费侧自定义枚举协议）
        pub effect_kind: u8,
        /// 效果数值（正负均可）
        pub effect_value: i32,
        /// 建议冷却（以“秒/块”为单位，按域约定解释）
        pub cooldown_secs: u32,
        /// 是否偏好铸入库存（true 则建议入库，由消费侧决定具体策略）
        pub inventory_mint: bool,
    }

    /// 函数级中文注释：消费回调（由 Runtime 注入具体实现，如 memo-pet）。
    /// - 供奉成交后若存在 EffectSpec 且目标域匹配，则回调应用效果；失败不回滚交易。
    pub trait EffectConsumer<AccountId> {
        fn apply(target: (u8, u64), who: &AccountId, effect: &EffectSpec) -> DispatchResult;
    }

    // 函数级中文注释：删除证据提供者接口，改为在本 Pallet 内置媒体元数据存储（仅存 CID 与可选承诺）。

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
        #[pallet::constant]
        type MaxNameLen: Get<u32>;
        #[pallet::constant]
        type MaxOfferingsPerTarget: Get<u32>;
        /// 函数级中文注释：单次供奉所允许附带的媒体条目上限（每条仅存 CID 与可选承诺）。
        #[pallet::constant]
        type MaxMediaPerOffering: Get<u32>;
        /// 函数级中文注释：单条媒体的可选备注（memo）最大长度（如前端显示用途），当前未使用，保留扩展。
        #[pallet::constant]
        type MaxMemoLen: Get<u32>;
        /// 函数级中文注释：供奉限频窗口大小（以块为单位，常量默认，存储参数可覆盖）。
        #[pallet::constant]
        type OfferWindow: Get<BlockNumberFor<Self>>;
        /// 函数级中文注释：窗口内最多供奉次数（常量默认，存储参数可覆盖）。
        #[pallet::constant]
        type OfferMaxInWindow: Get<u32>;
        /// 函数级中文注释：最小供奉金额（以 u128 表示，常量默认，存储参数可覆盖）。
        #[pallet::constant]
        type MinOfferAmount: Get<u128>;
        // 函数级中文注释：目标控制器，使用 runtime 的 Origin 与 AccountId 类型以进行权限校验
        type TargetCtl: TargetControl<
            Self::RuntimeOrigin,
            <Self as frame_system::Config>::AccountId,
        >;
        type OnOffering: OnOfferingCommitted<Self::AccountId>;
        /// 函数级中文注释：管理员 Origin（Root / Council / 多签等），用于上架/下架/编辑。
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：治理起源（Root/内容治理签名账户），用于带证据的 gov* 接口。
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：用于资金转账的货币接口。
        type Currency: Currency<Self::AccountId>;
        /// 函数级中文注释：捐赠账户解析器，根据目标解析接收账户。
        type DonationResolver: DonationAccountResolver<Self::AccountId>;
        /// 函数级中文注释：收款路由（多路分账），返回若干 (账户, permill)；为空则回退到 DonationResolver。
        type DonationRouter: DonationRouter<Self::AccountId>;
        /// 函数级中文注释：目录只读接口（低耦合）。
        type Catalog: SacrificeCatalog<Self::AccountId, u64, u128, BlockNumberFor<Self>>;
        /// 函数级中文注释：消费回调，由消费侧 Pallet 实现（如 memo-pet）。
        type Consumer: EffectConsumer<Self::AccountId>;
        /// 函数级中文注释：会员信息提供者（用于供奉折扣验证）
        /// - 由 pallet-membership 实现
        /// - 供奉购买时检查会员状态并应用折扣
        type MembershipProvider: MembershipProvider<Self::AccountId>;
        /// 函数级详细中文注释：联盟计酬托管账户
        /// - 供奉资金将先转入此托管账户
        /// - 再由 pallet-affiliate-instant 从托管账户分配给推荐人
        /// - 这样确保资金流向可控且推荐奖励能正常发放
        type AffiliateEscrowAccount: Get<Self::AccountId>;
        /// 函数级详细中文注释：存储费用账户
        /// - 用于接收供奉产生的存储费用（通常为2%）
        /// - 独立于国库账户，便于资金分类和审计
        /// - 可配置为专用账户或复用国库账户
        type StorageAccount: Get<Self::AccountId>;
        /// 函数级中文注释：黑洞账户（用于销毁 MEMO）。
        /// 约定：使用全零地址或特定 PalletId 派生的不可访问账户。
        type BurnAccount: Get<Self::AccountId>;
        /// 函数级中文注释：国库账户（用于平台财政收入）。
        /// 约定：使用 PalletId("py/trsry") 派生的托管账户。
        type TreasuryAccount: Get<Self::AccountId>;
    }

    /// 函数级中文注释：通用余额类型别名，便于在本 Pallet 内部进行从 u128 到链上 Balance 的安全饱和转换。
    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级中文注释：供奉品类型（区分是否需要时长）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub enum OfferingKind {
        /// 无时长：一次性生效
        Instant,
        /// 有时长：要求携带时长，支持上下限与到期动作
        Timed {
            min: u32,
            max: Option<u32>,
            can_renew: bool,
            expire_action: u8,
        },
    }

    /// 函数级中文注释：祭祀品规格（目录）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct OfferingSpec<T: Config> {
        pub kind_code: u8,
        pub name: BoundedVec<u8, T::MaxNameLen>,
        pub media_schema_cid: BoundedVec<u8, T::MaxCidLen>,
        /// 是否上架（允许下单）
        pub enabled: bool,
        /// 供奉品类型配置
        pub kind: OfferingKind,
    }

    /// 函数级中文注释：单个媒体条目，仅存 IPFS CID 与可选承诺哈希（不存明文）。
    #[derive(
        Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, TypeInfo, MaxEncodedLen,
    )]
    #[scale_info(skip_type_params(T))]
    pub struct MediaItem<T: Config> {
        /// 媒体的 IPFS CID（或其他内容可寻址标识），链上仅存标识，不存明文。
        pub cid: BoundedVec<u8, T::MaxCidLen>,
        /// 可选的承诺哈希（例如对链下密文及盐的哈希），用于后续校验，不泄露明文。
        pub commit: Option<sp_core::H256>,
    }

    /// 函数级中文注释：供奉记录（内置媒体元数据，仅存 CID 与可选承诺，不依赖外部 Evidence）。
    #[derive(
        Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, TypeInfo, MaxEncodedLen,
    )]
    #[scale_info(skip_type_params(T))]
    pub struct OfferingRecord<T: Config> {
        pub who: T::AccountId,
        pub target: (u8, u64),
        pub kind_code: u8,
        pub amount: Option<u128>,
        /// 本次供奉关联的媒体列表（受上限约束），每个条目仅包含 CID 与可选承诺。
        pub media: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering>,
        /// Timed 规格的下单时长；Instant 必须为 None
        pub duration: Option<u32>,
        pub time: BlockNumberFor<T>,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ===== 可治理风控参数（以存储参数为准，常量作为默认）=====
    #[pallet::type_value]
    pub fn DefaultOfferWindow<T: Config>() -> BlockNumberFor<T> {
        T::OfferWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultOfferMaxInWindow<T: Config>() -> u32 {
        T::OfferMaxInWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultMinOfferAmount<T: Config>() -> u128 {
        T::MinOfferAmount::get()
    }

    /// 供奉限频窗口（块）
    #[pallet::storage]
    pub type OfferWindowParam<T: Config> =
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultOfferWindow<T>>;
    /// 窗口内最多供奉次数
    #[pallet::storage]
    pub type OfferMaxInWindowParam<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultOfferMaxInWindow<T>>;
    /// 最小供奉金额
    #[pallet::storage]
    pub type MinOfferAmountParam<T: Config> =
        StorageValue<_, u128, ValueQuery, DefaultMinOfferAmount<T>>;
    /// 限频计数（账户 -> (窗口起点, 计数)）
    #[pallet::storage]
    pub type OfferRate<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;
    /// 目标级限频计数（目标 -> (窗口起点, 计数)）
    #[pallet::storage]
    pub type OfferRateByTarget<T: Config> =
        StorageMap<_, Blake2_128Concat, (u8, u64), (BlockNumberFor<T>, u32), ValueQuery>;
    /// 暂停总开关
    #[pallet::storage]
    pub type PausedGlobal<T: Config> = StorageValue<_, bool, ValueQuery>;
    /// 按域暂停
    #[pallet::storage]
    pub type PausedByDomain<T: Config> = StorageMap<_, Blake2_128Concat, u8, bool, ValueQuery>;

    /// 函数级中文注释：逝者主题账户分账比例（Permill，默认 20%）。
    #[pallet::type_value]
    pub fn DefaultSubjectBps<T: Config>() -> Permill {
        Permill::from_percent(20)
    }
    #[pallet::storage]
    pub type SubjectBps<T: Config> = StorageValue<_, Permill, ValueQuery, DefaultSubjectBps<T>>;

    /// 函数级中文注释：路由分账最大笔数（用于裁剪 Router 返回项，防止状态/计算膨胀）。
    #[pallet::type_value]
    pub fn DefaultMaxRouteSplits<T: Config>() -> u32 {
        5
    }
    #[pallet::storage]
    pub type MaxRouteSplits<T: Config> = StorageValue<_, u32, ValueQuery, DefaultMaxRouteSplits<T>>;

    /// 函数级中文注释：是否将超过 100% 的剩余（或 Router 返回为空时）回退至默认收款账户。
    /// - true：回退到 `DonationResolver::account_for(target)`；
    /// - false：忽略剩余（不再额外转账）。
    #[pallet::type_value]
    pub fn DefaultRouteRemainderToDefault<T: Config>() -> bool {
        true
    }
    #[pallet::storage]
    pub type RouteRemainderToDefault<T: Config> =
        StorageValue<_, bool, ValueQuery, DefaultRouteRemainderToDefault<T>>;

    // ====== 多路分账（可治理）======
    /// 函数级中文注释：路由项（最多 5 条）。
    /// 路由类型（kind）说明：
    /// - 0 = SubjectFunding：派生主题资金账户（墓地/宠物管理者收益）
    /// - 1 = SpecificAccount：指定固定账户（联盟计酬/平台费等）
    /// - 2 = Burn：销毁（发送到黑洞账户）
    /// - 3 = Treasury：国库（发送到财政账户）
    ///
    /// 字段说明：
    /// - kind：路由类型代码（0-3）
    /// - account：当 kind=1 时必填，指定收款账户；其余类型为 None
    /// - share：Permill 分配比例（0-1,000,000，100% = 1,000,000）
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct RouteEntry<T: Config> {
        pub kind: u8,
        pub account: Option<T::AccountId>,
        pub share: Permill,
    }

    /// 函数级中文注释：全局路由表（当按域未配置时回退）。
    #[pallet::storage]
    pub type RouteTableGlobal<T: Config> =
        StorageValue<_, BoundedVec<RouteEntry<T>, ConstU32<5>>, OptionQuery>;

    /// 函数级中文注释：按域路由表（优先级高于全局）。key = domain（u8）。
    #[pallet::storage]
    pub type RouteTableByDomain<T: Config> =
        StorageMap<_, Blake2_128Concat, u8, BoundedVec<RouteEntry<T>, ConstU32<5>>, OptionQuery>;

    #[pallet::storage]
    pub type Specs<T: Config> = StorageMap<_, Blake2_128Concat, u8, OfferingSpec<T>, OptionQuery>;

    /// 函数级中文注释：定价（独立存储，避免变更规格结构导致迁移）。
    /// - Instant：使用 FixedPriceOf(kind_code)；
    /// - Timed：使用 UnitPricePerWeekOf(kind_code) × duration；
    #[pallet::storage]
    pub type FixedPriceOf<T: Config> = StorageMap<_, Blake2_128Concat, u8, u128, OptionQuery>;
    #[pallet::storage]
    pub type UnitPricePerWeekOf<T: Config> = StorageMap<_, Blake2_128Concat, u8, u128, OptionQuery>;

    #[pallet::storage]
    pub type OfferingsByTarget<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (u8, u64),
        BoundedVec<u64, T::MaxOfferingsPerTarget>,
        ValueQuery,
    >;

    #[pallet::storage]
    pub type OfferingRecords<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, OfferingRecord<T>, OptionQuery>;

    #[pallet::storage]
    pub type NextOfferingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：规格合法性检查（Instant 总是合法；Timed 要求 min ≤ max(若有)）。
    fn spec_validate<T: Config>(spec: &OfferingSpec<T>) -> bool {
        match &spec.kind {
            OfferingKind::Instant => true,
            OfferingKind::Timed { min, max, .. } => {
                if let Some(mx) = max {
                    *min <= *mx
                } else {
                    true
                }
            }
        }
    }

    /// 函数级中文注释：下单时长的策略校验。
    fn ensure_duration_allowed<T: Config>(
        spec: &OfferingSpec<T>,
        duration: &Option<u32>,
    ) -> DispatchResult {
        match &spec.kind {
            OfferingKind::Instant => {
                ensure!(duration.is_none(), Error::<T>::DurationNotAllowed);
                Ok(())
            }
            OfferingKind::Timed { min, max, .. } => {
                let d = duration.ok_or(Error::<T>::DurationRequired)?;
                if let Some(mx) = max {
                    ensure!(d <= *mx, Error::<T>::DurationOutOfRange);
                }
                ensure!(d >= *min, Error::<T>::DurationOutOfRange);
                Ok(())
            }
        }
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 管理员创建/上架模板
        OfferingCreated { kind_code: u8 },
        /// 管理员编辑模板
        OfferingUpdated { kind_code: u8 },
        /// 设置模板是否启用
        OfferingEnabled { kind_code: u8, enabled: bool },
        /// 函数级中文注释：定价已更新（快照）。
        OfferingPriceUpdated {
            kind_code: u8,
            fixed_price: Option<u128>,
            unit_price_per_week: Option<u128>,
        },
        /// 函数级中文注释：供奉已确认并落账（便于 Subsquid 索引）。
        /// - 增补字段：who/amount/duration_weeks/block，降低索引端读取存储的复杂度与成本。
        OfferingCommitted {
            id: u64,
            target: (u8, u64),
            kind_code: u8,
            who: T::AccountId,
            amount: Option<u128>,
            duration_weeks: Option<u32>,
            block: BlockNumberFor<T>,
        },
        /// 函数级中文注释：供奉风控参数已更新（Root）。
        OfferParamsUpdated,
        /// 函数级中文注释：供奉分账路由快照（便于审计）。
        OfferingRouted {
            id: u64,
            target: (u8, u64),
            gross: u128,
            shares: alloc::vec::Vec<(T::AccountId, u128)>,
            remainder: u128,
        },
        /// 函数级中文注释：通过祭祀品目录下单完成（便于 Subsquid 索引）。
        OfferingCommittedBySacrifice {
            id: u64,
            target: (u8, u64),
            sacrifice_id: u64,
            who: T::AccountId,
            amount: u128,
            duration_weeks: Option<u32>,
            block: BlockNumberFor<T>,
        },
        /// 函数级中文注释：全局暂停状态已更新
        PausedGlobalSet { paused: bool },
        /// 函数级中文注释：域暂停状态已更新
        PausedDomainSet { domain: u8, paused: bool },
        /// 函数级中文注释：治理证据已记录（scope, key, cid）。scope：1=Params, 2=Price, 3=PauseG, 4=PauseD
        GovEvidenceNoted(u8, u64, BoundedVec<u8, T::MaxCidLen>),
        /// 函数级中文注释：路由表已更新（scope=0 全局；scope=1 按域，key 为 domain）。
        RouteTableUpdated { scope: u8, key: u64 },
    }

    #[pallet::error]
    pub enum Error<T> {
        BadKind,
        TargetNotFound,
        NotAllowed,
        TooMany,
        NotFound,
        /// 路由表项不合法（kind/account/permill）
        BadRouteEntry,
        /// 模板被禁用
        OfferingDisabled,
        /// 当前模板不允许/不需要时长
        DurationNotAllowed,
        /// 必须提供时长
        DurationRequired,
        /// 时长越界
        DurationOutOfRange,
        /// 必须提供金额
        AmountRequired,
        /// 金额必须大于 0
        AmountTooLow,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释（内部工具）：记录治理证据 CID（明文），返回有界向量。
        fn note_evidence(
            scope: u8,
            key: u64,
            cid: Vec<u8>,
        ) -> Result<BoundedVec<u8, T::MaxCidLen>, DispatchError> {
            let bv: BoundedVec<u8, T::MaxCidLen> =
                BoundedVec::try_from(cid).map_err(|_| DispatchError::Other("BadInput"))?;
            Self::deposit_event(Event::GovEvidenceNoted(scope, key, bv.clone()));
            Ok(bv)
        }
    }

    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：管理员上架（创建）供奉品规格模板。
        /// - 仅允许 AdminOrigin 调用；
        /// - kind_flag: 0=Instant；1=Timed（需配 min/max/can_renew/expire_action）。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_offering(
            origin: OriginFor<T>,
            kind_code: u8,
            name: BoundedVec<u8, T::MaxNameLen>,
            media_schema_cid: BoundedVec<u8, T::MaxCidLen>,
            kind_flag: u8,
            min_duration: Option<u32>,
            max_duration: Option<u32>,
            can_renew: bool,
            expire_action: u8,
            enabled: bool,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            let kind = match kind_flag {
                0 => OfferingKind::Instant,
                1 => OfferingKind::Timed {
                    min: min_duration.unwrap_or(1),
                    max: max_duration,
                    can_renew,
                    expire_action,
                },
                _ => return Err(Error::<T>::BadKind.into()),
            };
            let spec = OfferingSpec::<T> {
                kind_code,
                name,
                media_schema_cid,
                enabled,
                kind,
            };
            ensure!(spec_validate::<T>(&spec), Error::<T>::BadKind);
            Specs::<T>::insert(kind_code, spec);
            Self::deposit_event(Event::OfferingCreated { kind_code });
            Ok(())
        }

        /// 函数级中文注释：管理员编辑供奉品规格（可选字段）。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_offering(
            origin: OriginFor<T>,
            kind_code: u8,
            name: Option<BoundedVec<u8, T::MaxNameLen>>,
            media_schema_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            min_duration: Option<Option<u32>>,
            max_duration: Option<Option<u32>>,
            can_renew: Option<bool>,
            expire_action: Option<u8>,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            Specs::<T>::try_mutate(kind_code, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::BadKind)?;
                if let Some(n) = name {
                    s.name = n;
                }
                if let Some(c) = media_schema_cid {
                    s.media_schema_cid = c;
                }
                if let OfferingKind::Timed {
                    min,
                    max,
                    can_renew: cr,
                    expire_action: ea,
                } = &mut s.kind
                {
                    if let Some(md) = min_duration {
                        *min = md.unwrap_or(*min);
                    }
                    if let Some(mx) = max_duration {
                        *max = mx;
                    }
                    if let Some(r) = can_renew {
                        *cr = r;
                    }
                    if let Some(e) = expire_action {
                        *ea = e;
                    }
                }
                ensure!(spec_validate::<T>(s), Error::<T>::BadKind);
                Ok(())
            })?;
            Self::deposit_event(Event::OfferingUpdated { kind_code });
            Ok(())
        }

        /// 函数级中文注释：管理员设置模板启用状态（上/下架）。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_offering_enabled(
            origin: OriginFor<T>,
            kind_code: u8,
            enabled: bool,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            Specs::<T>::try_mutate(kind_code, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::BadKind)?;
                s.enabled = enabled;
                Ok(())
            })?;
            Self::deposit_event(Event::OfferingEnabled { kind_code, enabled });
            Ok(())
        }

        /// 函数级中文注释：提交一次供奉记录。
        /// - 校验目标存在性与调用者是否被允许；
        /// - 可选 `amount` 仅作记录，真实支付建议走 `order+escrow`；
        /// - `media`：本次供奉关联的媒体列表（仅 CID 与可选承诺），不落明文；长度受上限约束。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn offer(
            origin: OriginFor<T>,
            target: (u8, u64),
            kind_code: u8,
            amount: Option<u128>,
            media: Vec<(BoundedVec<u8, T::MaxCidLen>, Option<sp_core::H256>)>,
            duration: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            // 暂停检查（全局/按域）
            ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
            if PausedByDomain::<T>::get(target.0) {
                return Err(Error::<T>::NotAllowed.into());
            }
            ensure!(Specs::<T>::contains_key(kind_code), Error::<T>::BadKind);
            let spec = Specs::<T>::get(kind_code).ok_or(Error::<T>::BadKind)?;
            ensure!(spec.enabled, Error::<T>::OfferingDisabled);
            ensure!(T::TargetCtl::exists(target), Error::<T>::TargetNotFound);
            T::TargetCtl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;
            // 校验时长策略
            ensure_duration_allowed::<T>(&spec, &duration)?;
            // 限频：账户 + 目标 双滑动窗口
            let now = <frame_system::Pallet<T>>::block_number();
            let (win_start, cnt) = OfferRate::<T>::get(&who);
            let window = OfferWindowParam::<T>::get();
            let (win_start, cnt) = if now.saturating_sub(win_start) > window {
                (now, 0u32)
            } else {
                (win_start, cnt)
            };
            ensure!(cnt < OfferMaxInWindowParam::<T>::get(), Error::<T>::TooMany);
            OfferRate::<T>::insert(&who, (win_start, cnt.saturating_add(1)));
            let (t_start, t_cnt) = OfferRateByTarget::<T>::get(target);
            let (t_start, t_cnt) = if now.saturating_sub(t_start) > window {
                (now, 0u32)
            } else {
                (t_start, t_cnt)
            };
            ensure!(
                t_cnt < OfferMaxInWindowParam::<T>::get(),
                Error::<T>::TooMany
            );
            OfferRateByTarget::<T>::insert(target, (t_start, t_cnt.saturating_add(1)));
            
            // 函数级中文注释：计算原价（根据供奉类型）
            let original_price = match &spec.kind {
                OfferingKind::Instant => {
                    FixedPriceOf::<T>::get(kind_code).ok_or(Error::<T>::AmountRequired)?
                }
                OfferingKind::Timed { .. } => {
                    let u = UnitPricePerWeekOf::<T>::get(kind_code).ok_or(Error::<T>::AmountRequired)?;
                    let d = duration.ok_or(Error::<T>::DurationRequired)? as u128;
                    u.saturating_mul(d)
                }
            };
            
            // 函数级中文注释：应用会员折扣（年费会员3折）
            let final_price = if T::MembershipProvider::is_valid_member(&who) {
                let discount_percent = T::MembershipProvider::get_discount() as u128; // 30 (3折)
                original_price.saturating_mul(discount_percent) / 100
            } else {
                original_price
            };
            
            // 函数级中文注释：验证用户提供的 amount 是否匹配最终价格
            let amt = amount.ok_or(Error::<T>::AmountRequired)?;
            ensure!(
                amt >= MinOfferAmountParam::<T>::get(),
                Error::<T>::AmountTooLow
            );
            ensure!(amt == final_price, Error::<T>::AmountTooLow);
            
            // 函数级详细中文注释：【职责转移方案】通过 DonationRouter 多路分账
            // - offerings 负责固定分账（销毁、国库、存储）
            // - affiliate 仅负责推荐分配（基于托管账户收到的金额）
            // - 优势：职责分离、配置灵活、审计透明
            let mut remainder_u128: u128 = amt;
            let mut routed: alloc::vec::Vec<(T::AccountId, u128)> = alloc::vec::Vec::new();
            let shares = T::DonationRouter::route(target, amt);
            
            // 函数级中文注释：裁剪路由条数（最多5个路由规则）
            let max_splits = MaxRouteSplits::<T>::get().max(0);
            let shares_trimmed = if shares.len() as u32 > max_splits {
                shares.into_iter().take(max_splits as usize).collect()
            } else {
                shares
            };
            
            // 函数级中文注释：按路由表逐个转账
            for (acc, pm) in shares_trimmed.into_iter() {
                let part_u128: u128 = pm * amt; // Permill * u128 → u128
                if part_u128 == 0 {
                    continue;
                }
                let transfer_u128 = core::cmp::min(part_u128, remainder_u128);
                if transfer_u128 == 0 {
                    break;
                }
                let bal: BalanceOf<T> = transfer_u128.saturated_into();
                
                // 函数级中文注释：执行转账
                T::Currency::transfer(&who, &acc, bal, ExistenceRequirement::KeepAlive)?;
                
                routed.push((acc, transfer_u128));
                remainder_u128 = remainder_u128.saturating_sub(transfer_u128);
                if remainder_u128 == 0 {
                    break;
                }
            }
            
            // 函数级中文注释：处理剩余金额（根据 RouteRemainderToDefault 配置）
            if remainder_u128 > 0 && RouteRemainderToDefault::<T>::get() {
                let dest = T::DonationResolver::account_for(target);
                let bal: BalanceOf<T> = remainder_u128.saturated_into();
                T::Currency::transfer(&who, &dest, bal, ExistenceRequirement::KeepAlive)?;
                routed.push((dest, remainder_u128));
                remainder_u128 = 0;
            }
            
            let settled_amount: Option<u128> = Some(amt);
            // 将输入 media 转换为受上限约束的 BoundedVec<MediaItem>
            let mut items: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering> = Default::default();
            for (cid, commit) in media.into_iter() {
                let item = MediaItem::<T> { cid, commit };
                items.try_push(item).map_err(|_| Error::<T>::TooMany)?;
            }
            let id = NextOfferingId::<T>::mutate(|n| {
                let id = *n;
                *n = n.saturating_add(1);
                id
            });
            let now = <frame_system::Pallet<T>>::block_number();
            let rec = OfferingRecord::<T> {
                who: who.clone(),
                target,
                kind_code,
                amount: settled_amount,
                media: items,
                duration,
                time: now,
            };
            OfferingRecords::<T>::insert(id, &rec);
            OfferingsByTarget::<T>::try_mutate(target, |v| {
                v.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;
            // 审计分账事件
            Self::deposit_event(Event::OfferingRouted {
                id,
                target,
                gross: amt,
                shares: routed.clone(), // 克隆以供后续 Hook 使用
                remainder: remainder_u128,
            });
            // 传递以"周"为单位的有效期：Instant=None，Timed=Some(duration)
            let duration_weeks: Option<u32> = match &spec.kind {
                OfferingKind::Instant => None,
                OfferingKind::Timed { .. } => duration,
            };
            // 函数级中文注释：调用 Hook 并传递路由分账记录
            T::OnOffering::on_offering(target, kind_code, &who, settled_amount, duration_weeks, routed);
            Self::deposit_event(Event::OfferingCommitted {
                id,
                target,
                kind_code,
                who,
                amount: settled_amount,
                duration_weeks,
                block: now,
            });
            Ok(())
        }

        /// 函数级中文注释：批量提交供奉记录（减少链上交互次数）。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn batch_offer(
            origin: OriginFor<T>,
            calls: Vec<(
                u8,
                u64,
                u8,
                Option<u128>,
                Vec<(BoundedVec<u8, T::MaxCidLen>, Option<sp_core::H256>)>,
                Option<u32>,
            )>,
        ) -> DispatchResult {
            for (d, id, k, a, m, dur) in calls {
                Self::offer(origin.clone(), (d, id), k, a, m, dur)?;
            }
            Ok(())
        }

        /// 函数级中文注释：治理更新供奉风控参数（Root）。
        /// - 未提供的参数保持不变；
        /// - OfferWindow（块）/OfferMaxInWindow（次数）/MinOfferAmount（u128）。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_offer_params(
            origin: OriginFor<T>,
            offer_window: Option<BlockNumberFor<T>>,
            offer_max_in_window: Option<u32>,
            min_offer_amount: Option<u128>,
            subject_bps: Option<u32>,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            if let Some(v) = offer_window {
                OfferWindowParam::<T>::put(v);
            }
            if let Some(v) = offer_max_in_window {
                OfferMaxInWindowParam::<T>::put(v);
            }
            if let Some(v) = min_offer_amount {
                MinOfferAmountParam::<T>::put(v);
            }
            if let Some(p) = subject_bps {
                SubjectBps::<T>::put(Permill::from_parts(p.min(1_000_000)));
            }
            Self::deposit_event(Event::OfferParamsUpdated);
            Ok(())
        }

        /// 函数级详细中文注释：【治理】设置全局多路路由表（最多 5 条，∑permill ≤ 100%）。
        #[pallet::call_index(15)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_route_table_global(
            origin: OriginFor<T>,
            routes: Vec<(u8, Option<T::AccountId>, u32)>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut list: BoundedVec<RouteEntry<T>, ConstU32<5>> = Default::default();
            let mut sum: u32 = 0;
            for (kind, acc, ppm) in routes.into_iter() {
                let pm = Permill::from_parts(ppm.min(1_000_000));
                sum = sum.saturating_add(pm.deconstruct() as u32);
                // 函数级中文注释：验证 kind-account 匹配规则
                // - kind=0 (SubjectFunding): account 忽略（自动派生）
                // - kind=1 (SpecificAccount): account 必填
                // - kind=2 (Burn): account 忽略（使用配置的 BurnAccount）
                // - kind=3 (Treasury): account 忽略（使用配置的 TreasuryAccount）
                match (kind, &acc) {
                    (1, None) => return Err(Error::<T>::BadRouteEntry.into()),  // kind=1 必须有账户
                    (0, _) | (1, Some(_)) | (2, _) | (3, _) => {}              // 合法组合
                    _ => return Err(Error::<T>::BadRouteEntry.into()),          // 非法 kind
                }
                list.try_push(RouteEntry::<T> {
                    kind,
                    account: acc,
                    share: pm,
                })
                .map_err(|_| Error::<T>::TooMany)?;
            }
            ensure!(sum <= Permill::ACCURACY as u32, Error::<T>::TooMany);
            RouteTableGlobal::<T>::put(list);
            Self::deposit_event(Event::RouteTableUpdated { scope: 0, key: 0 });
            Ok(())
        }

        /// 函数级详细中文注释：【治理】设置按域路由表（最多 5 条，∑permill ≤ 100%）。
        #[pallet::call_index(16)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_route_table_by_domain(
            origin: OriginFor<T>,
            domain: u8,
            routes: Vec<(u8, Option<T::AccountId>, u32)>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut list: BoundedVec<RouteEntry<T>, ConstU32<5>> = Default::default();
            let mut sum: u32 = 0;
            for (kind, acc, ppm) in routes.into_iter() {
                let pm = Permill::from_parts(ppm.min(1_000_000));
                sum = sum.saturating_add(pm.deconstruct() as u32);
                // 函数级中文注释：验证 kind-account 匹配规则
                // - kind=0 (SubjectFunding): account 忽略（自动派生）
                // - kind=1 (SpecificAccount): account 必填
                // - kind=2 (Burn): account 忽略（使用配置的 BurnAccount）
                // - kind=3 (Treasury): account 忽略（使用配置的 TreasuryAccount）
                match (kind, &acc) {
                    (1, None) => return Err(Error::<T>::BadRouteEntry.into()),  // kind=1 必须有账户
                    (0, _) | (1, Some(_)) | (2, _) | (3, _) => {}              // 合法组合
                    _ => return Err(Error::<T>::BadRouteEntry.into()),          // 非法 kind
                }
                list.try_push(RouteEntry::<T> {
                    kind,
                    account: acc,
                    share: pm,
                })
                .map_err(|_| Error::<T>::TooMany)?;
            }
            ensure!(sum <= Permill::ACCURACY as u32, Error::<T>::TooMany);
            RouteTableByDomain::<T>::insert(domain, list);
            Self::deposit_event(Event::RouteTableUpdated {
                scope: 1,
                key: domain as u64,
            });
            Ok(())
        }

        /// 函数级中文注释：【治理】更新供奉风控参数（携带证据）。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_offer_params(
            origin: OriginFor<T>,
            offer_window: Option<BlockNumberFor<T>>,
            offer_max_in_window: Option<u32>,
            min_offer_amount: Option<u128>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(1u8, 0u64, evidence_cid)?;
            if let Some(v) = offer_window {
                OfferWindowParam::<T>::put(v);
            }
            if let Some(v) = offer_max_in_window {
                OfferMaxInWindowParam::<T>::put(v);
            }
            if let Some(v) = min_offer_amount {
                MinOfferAmountParam::<T>::put(v);
            }
            Self::deposit_event(Event::OfferParamsUpdated);
            Ok(())
        }

        /// 函数级中文注释：设置/更新定价（Root/Admin）。
        /// - Instant：fixed_price；Timed：unit_price_per_week；未提供的字段不变；
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_offering_price(
            origin: OriginFor<T>,
            kind_code: u8,
            fixed_price: Option<Option<u128>>,
            unit_price_per_week: Option<Option<u128>>,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            if let Some(fp) = fixed_price {
                match fp {
                    Some(v) => FixedPriceOf::<T>::insert(kind_code, v),
                    None => FixedPriceOf::<T>::remove(kind_code),
                }
            }
            if let Some(up) = unit_price_per_week {
                match up {
                    Some(v) => UnitPricePerWeekOf::<T>::insert(kind_code, v),
                    None => UnitPricePerWeekOf::<T>::remove(kind_code),
                }
            }
            let cur_fp = FixedPriceOf::<T>::get(kind_code);
            let cur_up = UnitPricePerWeekOf::<T>::get(kind_code);
            Self::deposit_event(Event::OfferingPriceUpdated {
                kind_code,
                fixed_price: cur_fp,
                unit_price_per_week: cur_up,
            });
            Ok(())
        }

        /// 函数级中文注释：【治理】设置定价（携带证据）。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_offering_price(
            origin: OriginFor<T>,
            kind_code: u8,
            fixed_price: Option<Option<u128>>,
            unit_price_per_week: Option<Option<u128>>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(2u8, kind_code as u64, evidence_cid)?;
            if let Some(fp) = fixed_price {
                match fp {
                    Some(v) => FixedPriceOf::<T>::insert(kind_code, v),
                    None => FixedPriceOf::<T>::remove(kind_code),
                }
            }
            if let Some(up) = unit_price_per_week {
                match up {
                    Some(v) => UnitPricePerWeekOf::<T>::insert(kind_code, v),
                    None => UnitPricePerWeekOf::<T>::remove(kind_code),
                }
            }
            let cur_fp = FixedPriceOf::<T>::get(kind_code);
            let cur_up = UnitPricePerWeekOf::<T>::get(kind_code);
            Self::deposit_event(Event::OfferingPriceUpdated {
                kind_code,
                fixed_price: cur_fp,
                unit_price_per_week: cur_up,
            });
            Ok(())
        }

        /// 函数级中文注释：设置全局暂停（Admin）。
        /// - paused=true 时，所有 offer/offer_by_sacrifice 调用将被拒绝。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_pause_global(origin: OriginFor<T>, paused: bool) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            PausedGlobal::<T>::put(paused);
            Self::deposit_event(Event::PausedGlobalSet { paused });
            Ok(())
        }

        /// 函数级中文注释：设置按域暂停（Admin）。
        /// - 对应 domain 的供奉调用将被拒绝；不影响其他域。
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_pause_domain(origin: OriginFor<T>, domain: u8, paused: bool) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            PausedByDomain::<T>::insert(domain, paused);
            Self::deposit_event(Event::PausedDomainSet { domain, paused });
            Ok(())
        }

        /// 函数级中文注释：【治理】设置全局暂停（携带证据）。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_pause_global(
            origin: OriginFor<T>,
            paused: bool,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(3u8, 0u64, evidence_cid)?;
            PausedGlobal::<T>::put(paused);
            Self::deposit_event(Event::PausedGlobalSet { paused });
            Ok(())
        }

        /// 函数级中文注释：【治理】设置按域暂停（携带证据）。
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_pause_domain(
            origin: OriginFor<T>,
            domain: u8,
            paused: bool,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(4u8, domain as u64, evidence_cid)?;
            PausedByDomain::<T>::insert(domain, paused);
            Self::deposit_event(Event::PausedDomainSet { domain, paused });
            Ok(())
        }

        /// 函数级中文注释：【治理】启用/停用供奉模板（上/下架）。
        /// - 仅治理起源；记录证据；与 `set_offering_enabled` 等效但具备审计事件。
        #[pallet::call_index(14)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_offering_enabled(
            origin: OriginFor<T>,
            kind_code: u8,
            enabled: bool,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(1u8, kind_code as u64, evidence_cid)?;
            Specs::<T>::try_mutate(kind_code, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::BadKind)?;
                s.enabled = enabled;
                Ok(())
            })?;
            Self::deposit_event(Event::OfferingEnabled { kind_code, enabled });
            Ok(())
        }

        /// 函数级中文注释：基于祭祀品目录的下单入口（自动读取定价与可购校验）。
        /// - 输入：target 域对象、sacrifice_id、媒体列表（CID+承诺，可空）、可选 duration（周）、是否会员 is_vip；
        /// - 逻辑：读取目录 spec，校验启用与会员限制，计算应付金额（fixed 或 unit×duration），完成转账并落记录。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn offer_by_sacrifice(
            origin: OriginFor<T>,
            target: (u8, u64),
            sacrifice_id: u64,
            media: Vec<(BoundedVec<u8, T::MaxCidLen>, Option<sp_core::H256>)>,
            duration_weeks: Option<u32>,
            is_vip: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            // 暂停检查（全局/按域）
            ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
            if PausedByDomain::<T>::get(target.0) {
                return Err(Error::<T>::NotAllowed.into());
            }
            ensure!(T::TargetCtl::exists(target), Error::<T>::TargetNotFound);
            T::TargetCtl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;
            let (fixed, unit, enabled, _vip_only, exclusive) =
                T::Catalog::spec_of(sacrifice_id).ok_or(Error::<T>::NotFound)?;
            ensure!(enabled, Error::<T>::NotFound);
            ensure!(
                T::Catalog::can_purchase(&who, sacrifice_id, is_vip),
                Error::<T>::NotAllowed
            );
            if !exclusive.is_empty() {
                ensure!(
                    exclusive
                        .iter()
                        .any(|pair| pair.0 == target.0 && pair.1 == target.1),
                    Error::<T>::NotAllowed
                );
            }
            // 限频：账户 + 目标 双滑动窗口
            let now = <frame_system::Pallet<T>>::block_number();
            let (win_start, cnt) = OfferRate::<T>::get(&who);
            let window = OfferWindowParam::<T>::get();
            let (win_start, cnt) = if now.saturating_sub(win_start) > window {
                (now, 0u32)
            } else {
                (win_start, cnt)
            };
            ensure!(cnt < OfferMaxInWindowParam::<T>::get(), Error::<T>::TooMany);
            OfferRate::<T>::insert(&who, (win_start, cnt.saturating_add(1)));
            let (t_start, t_cnt) = OfferRateByTarget::<T>::get(target);
            let (t_start, t_cnt) = if now.saturating_sub(t_start) > window {
                (now, 0u32)
            } else {
                (t_start, t_cnt)
            };
            ensure!(
                t_cnt < OfferMaxInWindowParam::<T>::get(),
                Error::<T>::TooMany
            );
            OfferRateByTarget::<T>::insert(target, (t_start, t_cnt.saturating_add(1)));
            
            // 函数级中文注释：计算原价
            let original_price: u128 = if let Some(p) = fixed {
                p
            } else {
                let u = unit.ok_or(Error::<T>::AmountRequired)?;
                let d = duration_weeks.ok_or(Error::<T>::DurationRequired)? as u128;
                u.saturating_mul(d)
            };
            
            // 函数级中文注释：应用会员折扣（年费会员3折）
            let final_price = if T::MembershipProvider::is_valid_member(&who) {
                let discount_percent = T::MembershipProvider::get_discount() as u128; // 30 (3折)
                original_price.saturating_mul(discount_percent) / 100
            } else {
                original_price
            };
            
            if final_price > 0 {
                ensure!(
                    final_price >= MinOfferAmountParam::<T>::get(),
                    Error::<T>::AmountTooLow
                );
            }
            let dest = T::DonationResolver::account_for(target);
            if final_price > 0 {
                let amt_balance: BalanceOf<T> = final_price.saturated_into();
                T::Currency::transfer(&who, &dest, amt_balance, ExistenceRequirement::KeepAlive)?;
            }
            let mut items: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering> = Default::default();
            for (cid, commit) in media.into_iter() {
                items
                    .try_push(MediaItem::<T> { cid, commit })
                    .map_err(|_| Error::<T>::TooMany)?;
            }
            let id = NextOfferingId::<T>::mutate(|n| {
                let id = *n;
                *n = n.saturating_add(1);
                id
            });
            let now = <frame_system::Pallet<T>>::block_number();
            let rec = OfferingRecord::<T> {
                who: who.clone(),
                target,
                kind_code: 0,
                amount: Some(final_price),
                media: items,
                duration: duration_weeks,
                time: now,
            };
            OfferingRecords::<T>::insert(id, &rec);
            OfferingsByTarget::<T>::try_mutate(target, |v| {
                v.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;
            // 函数级中文注释：offer_by_sacrifice 直接转账，构造简单的路由记录
            let routed_simple = if final_price > 0 {
                alloc::vec![(dest.clone(), final_price)]
            } else {
                alloc::vec![]
            };
            T::OnOffering::on_offering(target, 0, &who, Some(final_price), duration_weeks, routed_simple);
            Self::deposit_event(Event::OfferingCommittedBySacrifice {
                id,
                target,
                sacrifice_id,
                who,
                amount: final_price,
                duration_weeks,
                block: now,
            });
            // 尝试读取消费效果并调用消费侧回调（失败不回滚交易，确保资金路径安全）
            if let Some(effect) = T::Catalog::effect_of(sacrifice_id) {
                if effect.target_domain == target.0 {
                    let _ = T::Consumer::apply(
                        target,
                        &OfferingRecords::<T>::get(id).unwrap().who,
                        &effect,
                    );
                }
            }
            Ok(())
        }
    }
}
