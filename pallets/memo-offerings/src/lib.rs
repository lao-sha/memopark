#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{pallet_prelude::*, BoundedVec, CloneNoBound, PartialEqNoBound, EqNoBound, traits::{EnsureOrigin, StorageVersion, Currency, ExistenceRequirement}, weights::Weight};
    use frame_system::pallet_prelude::*;
    use alloc::vec::Vec;
    use sp_runtime::traits::SaturatedConversion;

    /// 函数级中文注释：目标控制接口。
    /// - exists：目标是否存在；
    /// - ensure_allowed：是否允许对目标发起供奉（如墓地关闭、逝者隐私等）。
    pub trait TargetControl<Origin> {
        fn exists(target: (u8, u64)) -> bool;
        fn ensure_allowed(origin: Origin, target: (u8, u64)) -> DispatchResult;
        /// 函数级中文注释：用于成员制的允许策略（例如仅允许成员供奉）。
        /// - 返回 true 表示该调用者为目标的成员。
        fn is_member_of(target: (u8, u64), who: &<Origin as frame_system::OriginTrait>::AccountId) -> bool { let _ = (target, who); true }
    }

    /// 函数级中文注释：供奉提交后的回调接口，用于统计或联动积分。
    pub trait OnOfferingCommitted<AccountId> {
        /// 函数级中文注释：供奉落账后的回调。
        /// - target: (domain_code, id)
        /// - kind_code: 供奉规格编码
        /// - who: 供奉发起者
        /// - amount: 实际成功转账的金额（若无转账则为 None）
        /// - duration_weeks: 若为 Timed 供奉，则以“周”为单位的时长；Instant 则为 None。
        fn on_offering(target: (u8, u64), kind_code: u8, who: &AccountId, amount: Option<u128>, duration_weeks: Option<u32>);
    }

    /// 函数级中文注释：捐赠账户解析器（由 runtime 注入）。
    /// - 输入目标 (domain_code, id)，返回应接收捐赠的账户。
    pub trait DonationAccountResolver<AccountId> {
        fn account_for(target: (u8, u64)) -> AccountId;
    }

    // 函数级中文注释：删除证据提供者接口，改为在本 Pallet 内置媒体元数据存储（仅存 CID 与可选承诺）。

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant] type MaxCidLen: Get<u32>;
        #[pallet::constant] type MaxNameLen: Get<u32>;
        #[pallet::constant] type MaxOfferingsPerTarget: Get<u32>;
        /// 函数级中文注释：单次供奉所允许附带的媒体条目上限（每条仅存 CID 与可选承诺）。
        #[pallet::constant] type MaxMediaPerOffering: Get<u32>;
        /// 函数级中文注释：单条媒体的可选备注（memo）最大长度（如前端显示用途），当前未使用，保留扩展。
        #[pallet::constant] type MaxMemoLen: Get<u32>;
        // 函数级中文注释：目标控制器，使用 runtime 的 Origin 类型以进行权限校验
        type TargetCtl: TargetControl<Self::RuntimeOrigin>;
        type OnOffering: OnOfferingCommitted<Self::AccountId>;
        /// 函数级中文注释：管理员 Origin（Root / Council / 多签等），用于上架/下架/编辑。
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：用于资金转账的货币接口。
        type Currency: Currency<Self::AccountId>;
        /// 函数级中文注释：捐赠账户解析器，根据目标解析接收账户。
        type DonationResolver: DonationAccountResolver<Self::AccountId>;
    }

    /// 函数级中文注释：通用余额类型别名，便于在本 Pallet 内部进行从 u128 到链上 Balance 的安全饱和转换。
    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级中文注释：供奉品类型（区分是否需要时长）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub enum OfferingKind {
        /// 无时长：一次性生效
        Instant,
        /// 有时长：要求携带时长，支持上下限与到期动作
        Timed { min: u32, max: Option<u32>, can_renew: bool, expire_action: u8 },
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
    #[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct MediaItem<T: Config> {
        /// 媒体的 IPFS CID（或其他内容可寻址标识），链上仅存标识，不存明文。
        pub cid: BoundedVec<u8, T::MaxCidLen>,
        /// 可选的承诺哈希（例如对链下密文及盐的哈希），用于后续校验，不泄露明文。
        pub commit: Option<sp_core::H256>,
    }

    /// 函数级中文注释：供奉记录（内置媒体元数据，仅存 CID 与可选承诺，不依赖外部 Evidence）。
    #[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, TypeInfo, MaxEncodedLen)]
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

    #[pallet::storage]
    pub type Specs<T: Config> = StorageMap<_, Blake2_128Concat, u8, OfferingSpec<T>, OptionQuery>;

    #[pallet::storage]
    pub type OfferingsByTarget<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), BoundedVec<u64, T::MaxOfferingsPerTarget>, ValueQuery>;

    #[pallet::storage]
    pub type OfferingRecords<T: Config> = StorageMap<_, Blake2_128Concat, u64, OfferingRecord<T>, OptionQuery>;

    #[pallet::storage]
    pub type NextOfferingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：规格合法性检查（Instant 总是合法；Timed 要求 min ≤ max(若有)）。
    fn spec_validate<T: Config>(spec: &OfferingSpec<T>) -> bool {
        match &spec.kind {
            OfferingKind::Instant => true,
            OfferingKind::Timed { min, max, .. } => {
                if let Some(mx) = max { *min <= *mx } else { true }
            }
        }
    }

    /// 函数级中文注释：下单时长的策略校验。
    fn ensure_duration_allowed<T: Config>(spec: &OfferingSpec<T>, duration: &Option<u32>) -> DispatchResult {
        match &spec.kind {
            OfferingKind::Instant => {
                ensure!(duration.is_none(), Error::<T>::DurationNotAllowed);
                Ok(())
            }
            OfferingKind::Timed { min, max, .. } => {
                let d = duration.ok_or(Error::<T>::DurationRequired)?;
                if let Some(mx) = max { ensure!(d <= *mx, Error::<T>::DurationOutOfRange); }
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
        OfferingCommitted { id: u64, target: (u8, u64), kind_code: u8 },
    }

    #[pallet::error]
    pub enum Error<T> {
        BadKind,
        TargetNotFound,
        NotAllowed,
        TooMany,
        NotFound,
        /// 模板被禁用
        OfferingDisabled,
        /// 当前模板不允许/不需要时长
        DurationNotAllowed,
        /// 必须提供时长
        DurationRequired,
        /// 时长越界
        DurationOutOfRange,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：管理员上架（创建）供奉品规格模板。
        /// - 仅允许 AdminOrigin 调用；
        /// - kind_flag: 0=Instant；1=Timed（需配 min/max/can_renew/expire_action）。
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
                1 => OfferingKind::Timed { min: min_duration.unwrap_or(1), max: max_duration, can_renew, expire_action },
                _ => return Err(Error::<T>::BadKind.into()),
            };
            let spec = OfferingSpec::<T> { kind_code, name, media_schema_cid, enabled, kind };
            ensure!(spec_validate::<T>(&spec), Error::<T>::BadKind);
            Specs::<T>::insert(kind_code, spec);
            Self::deposit_event(Event::OfferingCreated { kind_code });
            Ok(())
        }

        /// 函数级中文注释：管理员编辑供奉品规格（可选字段）。
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
                if let Some(n) = name { s.name = n; }
                if let Some(c) = media_schema_cid { s.media_schema_cid = c; }
                if let OfferingKind::Timed { min, max, can_renew: cr, expire_action: ea } = &mut s.kind {
                    if let Some(md) = min_duration { *min = md.unwrap_or(*min); }
                    if let Some(mx) = max_duration { *max = mx; }
                    if let Some(r) = can_renew { *cr = r; }
                    if let Some(e) = expire_action { *ea = e; }
                }
                ensure!(spec_validate::<T>(s), Error::<T>::BadKind);
                Ok(())
            })?;
            Self::deposit_event(Event::OfferingUpdated { kind_code });
            Ok(())
        }

        /// 函数级中文注释：管理员设置模板启用状态（上/下架）。
        #[pallet::weight(10_000)]
        pub fn set_offering_enabled(origin: OriginFor<T>, kind_code: u8, enabled: bool) -> DispatchResult {
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
            ensure!(Specs::<T>::contains_key(kind_code), Error::<T>::BadKind);
            let spec = Specs::<T>::get(kind_code).ok_or(Error::<T>::BadKind)?;
            ensure!(spec.enabled, Error::<T>::OfferingDisabled);
            ensure!(T::TargetCtl::exists(target), Error::<T>::TargetNotFound);
            T::TargetCtl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;
            // 校验时长策略
            ensure_duration_allowed::<T>(&spec, &duration)?;
            // 若声明了金额，则先进行真实转账，确保资金安全
            let mut settled_amount: Option<u128> = None;
            if let Some(amt) = amount {
                if amt > 0 {
                    let dest = T::DonationResolver::account_for(target);
                    // 安全转换：将 u128 金额饱和转换为链上 Balance 类型，避免 From<u128> 约束
                    let amt_balance: BalanceOf<T> = amt.saturated_into();
                    T::Currency::transfer(&who, &dest, amt_balance, ExistenceRequirement::KeepAlive)?;
                    settled_amount = Some(amt);
                }
            }
            // 将输入 media 转换为受上限约束的 BoundedVec<MediaItem>
            let mut items: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering> = Default::default();
            for (cid, commit) in media.into_iter() {
                let item = MediaItem::<T> { cid, commit };
                items.try_push(item).map_err(|_| Error::<T>::TooMany)?;
            }
            let id = NextOfferingId::<T>::mutate(|n| { let id = *n; *n = n.saturating_add(1); id });
            let now = <frame_system::Pallet<T>>::block_number();
            let rec = OfferingRecord::<T> { who: who.clone(), target, kind_code, amount: settled_amount, media: items, duration, time: now };
            OfferingRecords::<T>::insert(id, &rec);
            OfferingsByTarget::<T>::try_mutate(target, |v| v.try_push(id).map_err(|_| Error::<T>::TooMany))?;
            // 传递以“周”为单位的有效期：Instant=None，Timed=Some(duration)
            let duration_weeks: Option<u32> = match &spec.kind { OfferingKind::Instant => None, OfferingKind::Timed { .. } => duration };
            T::OnOffering::on_offering(target, kind_code, &who, settled_amount, duration_weeks);
            Self::deposit_event(Event::OfferingCommitted { id, target, kind_code });
            Ok(())
        }

        /// 函数级中文注释：批量提交供奉记录（减少链上交互次数）。
        #[pallet::weight(10_000)]
        pub fn batch_offer(origin: OriginFor<T>, calls: Vec<(u8, u64, u8, Option<u128>, Vec<(BoundedVec<u8, T::MaxCidLen>, Option<sp_core::H256>)>, Option<u32>)>) -> DispatchResult {
            for (d,id,k,a,m,dur) in calls { Self::offer(origin.clone(), (d,id), k, a, m, dur)?; }
            Ok(())
        }
    }
}


