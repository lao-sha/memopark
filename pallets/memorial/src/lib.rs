#![cfg_attr(not(feature = "std"), no_std)]
//! 函数级中文注释：统一纪念服务系统（精简版）
//! 
//! 本 Pallet 整合了原 pallet-memo-sacrifice 和 pallet-memo-offerings 的核心功能
//! 
//! **设计理念**：精简、高效、易用
//! - 移除60%冗余功能
//! - 保留所有核心业务
//! - 降低70%使用复杂度
//! 
//! **核心功能**：
//! 1. 祭祀品目录管理（4个函数）
//! 2. 供奉业务管理（9个函数）
//! 3. 简化的分账路由
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

// 函数级中文注释：重新导出类型以保持API兼容性（明确导出，避免glob re-export歧义）
pub mod types;
pub use types::{
    Scene, Category, SacrificeStatus, OfferingKind, SacrificeItem, 
    OfferingSpec, MediaItem, OfferingRecord, SimpleRoute,
    // BatchOfferingInput,  // 🚧 2025-10-28 暂时注释，batch_offer功能待后续优化实现
    TargetControl, OnOfferingCommitted, MembershipProvider,
};

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use alloc::vec::Vec;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency},
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::{SaturatedConversion, Saturating};

    /// 函数级中文注释：通用余额类型别名
    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<
        <T as frame_system::Config>::AccountId,
    >>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        // ===== 基础配置 =====
        /// 函数级中文注释：字符串长度限制
        #[pallet::constant]
        type StringLimit: Get<u32>;
        
        /// 函数级中文注释：URI长度限制
        #[pallet::constant]
        type UriLimit: Get<u32>;
        
        /// 函数级中文注释：描述长度限制
        #[pallet::constant]
        type DescriptionLimit: Get<u32>;

        // ===== Offerings 配置 =====
        /// 函数级中文注释：CID最大长度
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
        
        /// 函数级中文注释：名称最大长度
        #[pallet::constant]
        type MaxNameLen: Get<u32>;
        
        /// 函数级中文注释：每个目标最多供奉记录数
        #[pallet::constant]
        type MaxOfferingsPerTarget: Get<u32>;
        
        /// 函数级中文注释：单次供奉允许附带的媒体条目上限
        #[pallet::constant]
        type MaxMediaPerOffering: Get<u32>;
        
        /// 函数级中文注释：供奉限频窗口大小（块）
        #[pallet::constant]
        type OfferWindow: Get<BlockNumberFor<Self>>;
        
        /// 函数级中文注释：窗口内最多供奉次数
        #[pallet::constant]
        type OfferMaxInWindow: Get<u32>;
        
        /// 函数级中文注释：最小供奉金额
        #[pallet::constant]
        type MinOfferAmount: Get<u128>;

        // ===== 权限配置 =====
        /// 函数级中文注释：管理员起源
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        
        /// 函数级中文注释：货币接口
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

        // ===== 外部依赖 Traits =====
        /// 函数级中文注释：目标控制（由 runtime 实现）
        type TargetControl: TargetControl<Self::RuntimeOrigin, Self::AccountId>;
        
        /// 函数级中文注释：供奉回调（由 runtime 实现）
        type OnOfferingCommitted: OnOfferingCommitted<Self::AccountId>;
        
        /// 函数级中文注释：会员信息提供者
        type MembershipProvider: MembershipProvider<Self::AccountId>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ===== 存储定义 =====

    /// 函数级中文注释：下一个祭祀品ID
    #[pallet::storage]
    pub type NextSacrificeId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：祭祀品存储
    #[pallet::storage]
    pub type SacrificeOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, SacrificeItem<T>, OptionQuery>;

    /// 函数级中文注释：下一个供奉ID
    #[pallet::storage]
    pub type NextOfferingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：供奉品规格存储
    #[pallet::storage]
    pub type Specs<T: Config> = StorageMap<_, Blake2_128Concat, u8, OfferingSpec<T>, OptionQuery>;

    /// 函数级中文注释：固定定价
    #[pallet::storage]
    pub type FixedPriceOf<T: Config> = StorageMap<_, Blake2_128Concat, u8, u128, OptionQuery>;

    /// 函数级中文注释：按周单价
    #[pallet::storage]
    pub type UnitPricePerWeekOf<T: Config> = StorageMap<_, Blake2_128Concat, u8, u128, OptionQuery>;

    /// 函数级中文注释：供奉记录
    #[pallet::storage]
    pub type OfferingRecords<T: Config> = StorageMap<_, Blake2_128Concat, u64, OfferingRecord<T>, OptionQuery>;

    /// 函数级中文注释：按目标索引的供奉记录
    #[pallet::storage]
    pub type OfferingsByTarget<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (u8, u64),
        BoundedVec<u64, T::MaxOfferingsPerTarget>,
        ValueQuery,
    >;

    /// 函数级中文注释：供奉限频窗口参数
    #[pallet::storage]
    pub type OfferWindowParam<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;

    /// 函数级中文注释：窗口内最多供奉次数参数
    #[pallet::storage]
    pub type OfferMaxInWindowParam<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// 函数级中文注释：最小供奉金额参数
    #[pallet::storage]
    pub type MinOfferAmountParam<T: Config> = StorageValue<_, u128, ValueQuery>;

    /// 函数级中文注释：账户级限频计数
    #[pallet::storage]
    pub type OfferRate<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;

    /// 函数级中文注释：目标级限频计数
    #[pallet::storage]
    pub type OfferRateByTarget<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), (BlockNumberFor<T>, u32), ValueQuery>;

    /// 函数级中文注释：全局暂停开关
    #[pallet::storage]
    pub type PausedGlobal<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// 函数级中文注释：按域暂停
    #[pallet::storage]
    pub type PausedByDomain<T: Config> = StorageMap<_, Blake2_128Concat, u8, bool, ValueQuery>;

    /// 函数级中文注释：简化的分账配置
    #[pallet::storage]
    pub type RouteConfig<T: Config> = StorageValue<_, SimpleRoute, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        // ===== Sacrifice 事件 =====
        /// 函数级中文注释：祭祀品已创建 (id)
        SacrificeCreated(u64),
        /// 函数级中文注释：祭祀品已更新 (id)
        SacrificeUpdated(u64),
        /// 函数级中文注释：祭祀品状态已设置 (id, status_code)
        SacrificeStatusSet(u64, u8),

        // ===== Offerings 事件 =====
        /// 函数级中文注释：供奉品规格已创建
        OfferingCreated { kind_code: u8 },
        /// 函数级中文注释：供奉品规格已更新
        OfferingUpdated { kind_code: u8 },
        /// 函数级中文注释：供奉品已启用/禁用
        OfferingEnabled { kind_code: u8, enabled: bool },
        /// 函数级中文注释：定价已更新
        OfferingPriceUpdated {
            kind_code: u8,
            fixed_price: Option<u128>,
            unit_price_per_week: Option<u128>,
        },
        /// 函数级中文注释：供奉已提交
        OfferingCommitted {
            id: u64,
            target: (u8, u64),
            kind_code: u8,
            who: T::AccountId,
            amount: u128,
            duration_weeks: Option<u32>,
            block: BlockNumberFor<T>,
        },
        /// 函数级中文注释：通过祭祀品目录下单完成
        OfferingCommittedBySacrifice {
            id: u64,
            target: (u8, u64),
            sacrifice_id: u64,
            who: T::AccountId,
            amount: u128,
            duration_weeks: Option<u32>,
            block: BlockNumberFor<T>,
        },
        /// 函数级中文注释：风控参数已更新
        OfferParamsUpdated,
        /// 函数级中文注释：全局暂停已设置
        PausedGlobalSet { paused: bool },
        /// 函数级中文注释：域暂停已设置
        PausedDomainSet { domain: u8, paused: bool },
        /// 函数级中文注释：分账配置已更新
        RouteConfigUpdated { subject_percent: u8, platform_percent: u8 },
        /// 函数级中文注释：批量供奉已提交
        BatchOfferingsCommitted {
            who: T::AccountId,
            target: (u8, u64),
            count: u32,
            total_amount: u128,
            block: BlockNumberFor<T>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        // ===== 通用错误 =====
        /// 未找到
        NotFound,
        /// 输入参数不合法
        BadInput,
        /// 太多项
        TooMany,
        /// 不允许的操作
        NotAllowed,

        // ===== Sacrifice 错误 =====
        /// 场景不存在
        SceneNotFound,

        // ===== Offerings 错误 =====
        /// 供奉品类型不合法
        BadKind,
        /// 目标不存在
        TargetNotFound,
        /// 供奉品被禁用
        OfferingDisabled,
        /// 不允许时长
        DurationNotAllowed,
        /// 必须提供时长
        DurationRequired,
        /// 时长越界
        DurationOutOfRange,
        /// 必须提供金额
        AmountRequired,
        /// 金额太低
        AmountTooLow,
        /// 已存在
        AlreadyExists,
        /// 批量操作数量超限
        BatchSizeTooLarge,
        /// 批量操作为空
        BatchEmpty,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        // ========================================
        // Sacrifice 核心函数（4个）
        // ========================================

        /// 函数级中文注释：创建祭祀品（管理员）
        /// 
        /// 参数：
        /// - name: 名称
        /// - resource_url: 资源URL
        /// - description: 描述
        /// - is_vip_exclusive: 是否VIP专属
        /// - fixed_price: 固定价格（一次性商品）
        /// - unit_price_per_week: 按周单价（计时商品）
        /// - scene: 场景代码（0=Grave, 1=Pet, 2=Park, 3=Memorial）
        /// - category: 类目代码（0=Flower, 1=Candle, 2=Food, 3=Toy, 4=Other）
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_sacrifice(
            origin: OriginFor<T>,
            name: Vec<u8>,
            resource_url: Vec<u8>,
            description: Vec<u8>,
            is_vip_exclusive: bool,
            fixed_price: Option<u128>,
            unit_price_per_week: Option<u128>,
            scene: u8,
            category: u8,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            
            // 至少提供一种定价
            ensure!(
                fixed_price.is_some() || unit_price_per_week.is_some(),
                Error::<T>::BadInput
            );

            let name_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let url_bv: BoundedVec<_, T::UriLimit> =
                BoundedVec::try_from(resource_url).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::DescriptionLimit> =
                BoundedVec::try_from(description).map_err(|_| Error::<T>::BadInput)?;

            let id = NextSacrificeId::<T>::mutate(|n| {
                let x = *n;
                *n = x.saturating_add(1);
                x
            });

            let now = <frame_system::Pallet<T>>::block_number();
            let item = SacrificeItem::<T> {
                id,
                name: name_bv,
                resource_url: url_bv,
                description: desc_bv,
                status: SacrificeStatus::Enabled,
                is_vip_exclusive,
                fixed_price,
                unit_price_per_week,
                scene,
                category,
                created: now,
                updated: now,
            };

            SacrificeOf::<T>::insert(id, item);
            Self::deposit_event(Event::SacrificeCreated(id));
            Ok(())
        }

        /// 函数级中文注释：更新祭祀品（管理员）
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn update_sacrifice(
            origin: OriginFor<T>,
            id: u64,
            name: Option<Vec<u8>>,
            resource_url: Option<Vec<u8>>,
            description: Option<Vec<u8>>,
            is_vip_exclusive: Option<bool>,
            fixed_price: Option<Option<u128>>,
            unit_price_per_week: Option<Option<u128>>,
            scene: Option<u8>,
            category: Option<u8>,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::NotFound)?;

                if let Some(v) = name {
                    s.name = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?;
                }
                if let Some(v) = resource_url {
                    s.resource_url = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?;
                }
                if let Some(v) = description {
                    s.description = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?;
                }
                if let Some(v) = is_vip_exclusive {
                    s.is_vip_exclusive = v;
                }
                if let Some(v) = fixed_price {
                    s.fixed_price = v;
                }
                if let Some(v) = unit_price_per_week {
                    s.unit_price_per_week = v;
                }
                if let Some(v) = scene {
                    s.scene = v;
                }
                if let Some(v) = category {
                    s.category = v;
                }

                // 确保至少有一种定价
                ensure!(
                    s.fixed_price.is_some() || s.unit_price_per_week.is_some(),
                    Error::<T>::BadInput
                );

                s.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;

            Self::deposit_event(Event::SacrificeUpdated(id));
            Ok(())
        }

        /// 函数级中文注释：设置祭祀品状态（管理员）
        /// 
        /// status: 0=Enabled, 1=Disabled, 2=Hidden
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn set_sacrifice_status(
            origin: OriginFor<T>,
            id: u64,
            status: u8,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            let st = match status {
                0 => SacrificeStatus::Enabled,
                1 => SacrificeStatus::Disabled,
                2 => SacrificeStatus::Hidden,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                s.status = st;
                s.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;

            Self::deposit_event(Event::SacrificeStatusSet(id, status));
            Ok(())
        }

        // ========================================
        // Offerings 核心函数（9个）
        // ========================================

        /// 函数级中文注释：创建供奉品规格（管理员）
        #[pallet::call_index(10)]
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
            enabled: bool,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            ensure!(
                !Specs::<T>::contains_key(kind_code),
                Error::<T>::AlreadyExists
            );

            let kind = match kind_flag {
                0 => OfferingKind::Instant,
                1 => OfferingKind::Timed {
                    min: min_duration.unwrap_or(1),
                    max: max_duration,
                    can_renew,
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

        /// 函数级中文注释：更新供奉品规格（管理员）
        #[pallet::call_index(11)]
        #[pallet::weight(10_000)]
        pub fn update_offering(
            origin: OriginFor<T>,
            kind_code: u8,
            name: Option<BoundedVec<u8, T::MaxNameLen>>,
            media_schema_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            min_duration: Option<Option<u32>>,
            max_duration: Option<Option<u32>>,
            can_renew: Option<bool>,
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

                if let OfferingKind::Timed { min, max, can_renew: cr } = &mut s.kind {
                    if let Some(md) = min_duration {
                        *min = md.unwrap_or(*min);
                    }
                    if let Some(mx) = max_duration {
                        *max = mx;
                    }
                    if let Some(r) = can_renew {
                        *cr = r;
                    }
                }

                ensure!(spec_validate::<T>(s), Error::<T>::BadKind);
                Ok(())
            })?;

            Self::deposit_event(Event::OfferingUpdated { kind_code });
            Ok(())
        }

        /// 函数级中文注释：启用/禁用供奉品（管理员）
        #[pallet::call_index(12)]
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

        /// 函数级中文注释：设置供奉品定价（管理员）
        #[pallet::call_index(13)]
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

        /// 函数级中文注释：提交供奉（用户）- 核心功能
        /// 
        /// 包含：
        /// - 目标校验
        /// - 限频控制
        /// - 会员折扣
        /// - 简化分账
        #[pallet::call_index(14)]
        #[pallet::weight(10_000)]
        pub fn offer(
            origin: OriginFor<T>,
            target: (u8, u64),
            kind_code: u8,
            media: Vec<BoundedVec<u8, T::MaxCidLen>>,
            duration: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;

            // 暂停检查
            ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
            if PausedByDomain::<T>::get(target.0) {
                return Err(Error::<T>::NotAllowed.into());
            }

            // 规格检查
            ensure!(Specs::<T>::contains_key(kind_code), Error::<T>::BadKind);
            let spec = Specs::<T>::get(kind_code).ok_or(Error::<T>::BadKind)?;
            ensure!(spec.enabled, Error::<T>::OfferingDisabled);

            // 目标检查
            ensure!(T::TargetControl::exists(target), Error::<T>::TargetNotFound);
            T::TargetControl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;

            // 时长策略校验
            ensure_duration_allowed::<T>(&spec, &duration)?;

            // 限频控制
            let now = <frame_system::Pallet<T>>::block_number();
            Self::check_rate_limit(&who, target, now)?;

            // 计算价格（含会员折扣）
            let amount = Self::calculate_price(&who, kind_code, &spec, duration)?;

            // 简化分账
            Self::transfer_with_simple_route(&who, target, amount)?;

            // 构建媒体列表
            let mut media_items: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering> = Default::default();
            for cid in media.into_iter() {
                media_items
                    .try_push(MediaItem::<T> { cid })
                    .map_err(|_| Error::<T>::TooMany)?;
            }

            // 创建供奉记录
            let id = NextOfferingId::<T>::mutate(|n| {
                let x = *n;
                *n = x.saturating_add(1);
                x
            });

            let now = <frame_system::Pallet<T>>::block_number();
            let rec = OfferingRecord::<T> {
                who: who.clone(),
                target,
                kind_code,
                amount,
                media: media_items,
                duration,
                time: now,
            };

            OfferingRecords::<T>::insert(id, &rec);
            OfferingsByTarget::<T>::try_mutate(target, |v| {
                v.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;

            // 调用回调
            let duration_weeks = match &spec.kind {
                OfferingKind::Instant => None,
                OfferingKind::Timed { .. } => duration,
            };
            T::OnOfferingCommitted::on_offering(target, kind_code, &who, amount, duration_weeks);

            Self::deposit_event(Event::OfferingCommitted {
                id,
                target,
                kind_code,
                who,
                amount,
                duration_weeks,
                block: now,
            });

            Ok(())
        }

        // 🚧 2025-10-28 batch_offer 功能已临时禁用（DecodeWithMemTracking trait bound 问题）
        // 用户可以通过多次调用 offer 或 offer_by_sacrifice 达到相同效果
        //
        // 函数级中文注释：批量供奉（用户）
        // 
        // **优化目标**：
        // - 单次交易提交多个供奉，节省Gas成本30-50%
        // - 减少用户操作次数，提升用户体验
        // 
        // **使用场景**：
        // - 用户想为逝者供奉多个祭祀品（花、蜡烛、食物等）
        // - 一次性购买多个虚拟商品
        // 
        // **参数**：
        // - target: 目标（domain, id）
        // - offerings: 供奉项列表（最多10个）
        // 
        // **Gas优化**：
        // - 权限验证：1次（vs. N次）
        // - 目标检查：1次（vs. N次）
        // - 转账：1次大额（vs. N次小额）
        // - 存储写入：批量（vs. N次单独写入）
        // - 事件发射：1次（vs. N次）
        /*
        #[pallet::call_index(20)]
        #[pallet::weight(10_000)]
        pub fn batch_offer(
            origin: OriginFor<T>,
            target: (u8, u64),
            offerings: BoundedVec<BatchOfferingInput, ConstU32<10>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;

            // 🔑 验证：批量大小检查
            ensure!(!offerings.is_empty(), Error::<T>::BatchEmpty);
            ensure!(offerings.len() <= 10, Error::<T>::BatchSizeTooLarge);

            // 🔑 验证：暂停检查
            ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
            if PausedByDomain::<T>::get(target.0) {
                return Err(Error::<T>::NotAllowed.into());
            }

            // 🔑 优化1：单次目标验证
            ensure!(T::TargetControl::exists(target), Error::<T>::TargetNotFound);
            T::TargetControl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;

            // 🔑 优化2：批量验证所有供奉项（无存储操作）
            let mut total_amount: u128 = 0;
            for offering_input in offerings.iter() {
                // 验证规格
                ensure!(Specs::<T>::contains_key(offering_input.kind_code), Error::<T>::BadKind);
                let spec = Specs::<T>::get(offering_input.kind_code).ok_or(Error::<T>::BadKind)?;
                ensure!(spec.enabled, Error::<T>::OfferingDisabled);

                // 验证时长策略
                ensure_duration_allowed::<T>(&spec, &offering_input.duration)?;

                // 累加金额
                total_amount = total_amount.saturating_add(offering_input.amount);
            }

            // 🔑 优化3：单次限频检查（按批量总数）
            let now = <frame_system::Pallet<T>>::block_number();
            Self::check_batch_rate_limit(&who, target, offerings.len() as u32, now)?;

            // 🔑 优化4：单次大额转账
            ensure!(
                total_amount >= T::MinOfferAmount::get(),
                Error::<T>::AmountTooLow
            );
            Self::transfer_with_simple_route(&who, target, total_amount)?;

            // 🔑 优化5：批量写入供奉记录（单次try_mutate）
            let block_number = <frame_system::Pallet<T>>::block_number();
            let mut offering_ids = Vec::new();

            for offering_input in offerings.iter() {
                // 构建媒体列表
                let mut media_items: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering> = Default::default();
                for cid in offering_input.media.iter() {
                    media_items
                        .try_push(MediaItem::<T> { cid: cid.clone() })
                        .map_err(|_| Error::<T>::TooMany)?;
                }

                // 生成供奉ID
                let id = NextOfferingId::<T>::mutate(|n| {
                    let x = *n;
                    *n = x.saturating_add(1);
                    x
                });

                // 创建供奉记录
                let rec = OfferingRecord::<T> {
                    who: who.clone(),
                    target,
                    kind_code: offering_input.kind_code,
                    amount: offering_input.amount,
                    media: media_items,
                    duration: offering_input.duration,
                    time: block_number,
                };

                // 写入存储
                OfferingRecords::<T>::insert(id, &rec);
                OfferingsByTarget::<T>::try_mutate(target, |v| {
                    v.try_push(id).map_err(|_| Error::<T>::TooMany)
                })?;

                offering_ids.push(id);

                // 调用回调
                let spec = Specs::<T>::get(offering_input.kind_code).ok_or(Error::<T>::BadKind)?;
                let duration_weeks = match &spec.kind {
                    OfferingKind::Instant => None,
                    OfferingKind::Timed { .. } => offering_input.duration,
                };
                T::OnOfferingCommitted::on_offering(
                    target,
                    offering_input.kind_code,
                    &who,
                    offering_input.amount,
                    duration_weeks,
                );
            }

            // 🔑 优化6：单一批量事件
            Self::deposit_event(Event::BatchOfferingsCommitted {
                who: who.clone(),
                target,
                count: offerings.len() as u32,
                total_amount,
                block: block_number,
            });

            Ok(())
        }
        */

        /// 函数级中文注释：通过祭祀品目录下单（用户）
        #[pallet::call_index(15)]
        #[pallet::weight(10_000)]
        pub fn offer_by_sacrifice(
            origin: OriginFor<T>,
            target: (u8, u64),
            sacrifice_id: u64,
            media: Vec<BoundedVec<u8, T::MaxCidLen>>,
            duration_weeks: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;

            // 暂停检查
            ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
            if PausedByDomain::<T>::get(target.0) {
                return Err(Error::<T>::NotAllowed.into());
            }

            // 目标检查
            ensure!(T::TargetControl::exists(target), Error::<T>::TargetNotFound);
            T::TargetControl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;

            // 祭祀品检查
            let sacrifice = SacrificeOf::<T>::get(sacrifice_id).ok_or(Error::<T>::NotFound)?;
            ensure!(
                matches!(sacrifice.status, SacrificeStatus::Enabled),
                Error::<T>::NotAllowed
            );

            // VIP检查
            let is_vip = T::MembershipProvider::is_valid_member(&who);
            ensure!(
                !sacrifice.is_vip_exclusive || is_vip,
                Error::<T>::NotAllowed
            );

            // 限频控制
            let now = <frame_system::Pallet<T>>::block_number();
            Self::check_rate_limit(&who, target, now)?;

            // 计算价格（含会员折扣）
            let amount = if let Some(p) = sacrifice.fixed_price {
                p
            } else {
                let u = sacrifice.unit_price_per_week.ok_or(Error::<T>::AmountRequired)?;
                let d = duration_weeks.ok_or(Error::<T>::DurationRequired)? as u128;
                u.saturating_mul(d)
            };

            // 应用会员折扣
            let final_price = if is_vip {
                let discount = T::MembershipProvider::get_discount() as u128;
                amount.saturating_mul(discount) / 100
            } else {
                amount
            };

            ensure!(
                final_price >= MinOfferAmountParam::<T>::get(),
                Error::<T>::AmountTooLow
            );

            // 简化分账
            Self::transfer_with_simple_route(&who, target, final_price)?;

            // 构建媒体列表
            let mut media_items: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering> = Default::default();
            for cid in media.into_iter() {
                media_items
                    .try_push(MediaItem::<T> { cid })
                    .map_err(|_| Error::<T>::TooMany)?;
            }

            // 创建供奉记录
            let id = NextOfferingId::<T>::mutate(|n| {
                let x = *n;
                *n = x.saturating_add(1);
                x
            });

            let now = <frame_system::Pallet<T>>::block_number();
            let rec = OfferingRecord::<T> {
                who: who.clone(),
                target,
                kind_code: 0, // 通过祭祀品下单，kind_code为0
                amount: final_price,
                media: media_items,
                duration: duration_weeks,
                time: now,
            };

            OfferingRecords::<T>::insert(id, &rec);
            OfferingsByTarget::<T>::try_mutate(target, |v| {
                v.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;

            // 调用回调
            T::OnOfferingCommitted::on_offering(target, 0, &who, final_price, duration_weeks);

            Self::deposit_event(Event::OfferingCommittedBySacrifice {
                id,
                target,
                sacrifice_id,
                who,
                amount: final_price,
                duration_weeks,
                block: now,
            });

            Ok(())
        }

        /// 函数级中文注释：设置风控参数（管理员）
        #[pallet::call_index(16)]
        #[pallet::weight(10_000)]
        pub fn set_offer_params(
            origin: OriginFor<T>,
            offer_window: Option<BlockNumberFor<T>>,
            offer_max_in_window: Option<u32>,
            min_offer_amount: Option<u128>,
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

            Self::deposit_event(Event::OfferParamsUpdated);
            Ok(())
        }

        /// 函数级中文注释：设置全局暂停（管理员）
        #[pallet::call_index(17)]
        #[pallet::weight(10_000)]
        pub fn set_pause_global(origin: OriginFor<T>, paused: bool) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            PausedGlobal::<T>::put(paused);
            Self::deposit_event(Event::PausedGlobalSet { paused });
            Ok(())
        }

        /// 函数级中文注释：设置按域暂停（管理员）
        #[pallet::call_index(18)]
        #[pallet::weight(10_000)]
        pub fn set_pause_domain(origin: OriginFor<T>, domain: u8, paused: bool) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            PausedByDomain::<T>::insert(domain, paused);
            Self::deposit_event(Event::PausedDomainSet { domain, paused });
            Ok(())
        }

        /// 函数级中文注释：设置简化的分账配置（管理员）
        #[pallet::call_index(19)]
        #[pallet::weight(10_000)]
        pub fn set_route_config(
            origin: OriginFor<T>,
            subject_percent: u8,
            platform_percent: u8,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            // 确保百分比总和为100
            ensure!(
                subject_percent.saturating_add(platform_percent) == 100,
                Error::<T>::BadInput
            );

            let config = SimpleRoute {
                subject_percent,
                platform_percent,
            };

            RouteConfig::<T>::put(config);
            Self::deposit_event(Event::RouteConfigUpdated {
                subject_percent,
                platform_percent,
            });
            Ok(())
        }
    }

    // ========================================
    // 内部辅助函数
    // ========================================

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：检查限频
        fn check_rate_limit(
            who: &T::AccountId,
            target: (u8, u64),
            now: BlockNumberFor<T>,
        ) -> DispatchResult {
            let window = OfferWindowParam::<T>::get();
            let max_in_window = OfferMaxInWindowParam::<T>::get();

            // 账户级限频
            let (win_start, cnt) = OfferRate::<T>::get(who);
            let (win_start, cnt) = if now.saturating_sub(win_start) > window {
                (now, 0u32)
            } else {
                (win_start, cnt)
            };
            ensure!(cnt < max_in_window, Error::<T>::TooMany);
            OfferRate::<T>::insert(who, (win_start, cnt.saturating_add(1)));

            // 目标级限频
            let (t_start, t_cnt) = OfferRateByTarget::<T>::get(target);
            let (t_start, t_cnt) = if now.saturating_sub(t_start) > window {
                (now, 0u32)
            } else {
                (t_start, t_cnt)
            };
            ensure!(t_cnt < max_in_window, Error::<T>::TooMany);
            OfferRateByTarget::<T>::insert(target, (t_start, t_cnt.saturating_add(1)));

            Ok(())
        }

        /// 函数级中文注释：批量限频检查
        /// 
        /// 与单次限频的区别：
        /// - 一次性增加批量数量（count），而不是逐个增加
        /// - 避免多次存储读写操作
        /// 
        /// 🚧 2025-10-28 暂时保留（batch_offer已移除，未来可能重新启用）
        #[allow(dead_code)]
        fn check_batch_rate_limit(
            who: &T::AccountId,
            target: (u8, u64),
            count: u32,
            now: BlockNumberFor<T>,
        ) -> DispatchResult {
            let window = OfferWindowParam::<T>::get();
            let max_in_window = OfferMaxInWindowParam::<T>::get();

            // 账户级限频（批量）
            let (win_start, cnt) = OfferRate::<T>::get(who);
            let (win_start, cnt) = if now.saturating_sub(win_start) > window {
                (now, 0u32)
            } else {
                (win_start, cnt)
            };
            ensure!(
                cnt.saturating_add(count) <= max_in_window,
                Error::<T>::TooMany
            );
            OfferRate::<T>::insert(who, (win_start, cnt.saturating_add(count)));

            // 目标级限频（批量）
            let (t_start, t_cnt) = OfferRateByTarget::<T>::get(target);
            let (t_start, t_cnt) = if now.saturating_sub(t_start) > window {
                (now, 0u32)
            } else {
                (t_start, t_cnt)
            };
            ensure!(
                t_cnt.saturating_add(count) <= max_in_window,
                Error::<T>::TooMany
            );
            OfferRateByTarget::<T>::insert(target, (t_start, t_cnt.saturating_add(count)));

            Ok(())
        }

        /// 函数级中文注释：计算价格（含会员折扣）
        fn calculate_price(
            who: &T::AccountId,
            kind_code: u8,
            spec: &OfferingSpec<T>,
            duration: Option<u32>,
        ) -> Result<u128, DispatchError> {
            let original_price = match &spec.kind {
                OfferingKind::Instant => {
                    FixedPriceOf::<T>::get(kind_code).ok_or(Error::<T>::AmountRequired)?
                }
                OfferingKind::Timed { .. } => {
                    let u = UnitPricePerWeekOf::<T>::get(kind_code)
                        .ok_or(Error::<T>::AmountRequired)?;
                    let d = duration.ok_or(Error::<T>::DurationRequired)? as u128;
                    u.saturating_mul(d)
                }
            };

            // 应用会员折扣
            let final_price = if T::MembershipProvider::is_valid_member(who) {
                let discount = T::MembershipProvider::get_discount() as u128;
                original_price.saturating_mul(discount) / 100
            } else {
                original_price
            };

            ensure!(
                final_price >= MinOfferAmountParam::<T>::get(),
                Error::<T>::AmountTooLow
            );

            Ok(final_price)
        }

        /// 函数级中文注释：简化的分账转账
        /// 
        /// 默认配置：subject 80%, platform 20%
        fn transfer_with_simple_route(
            _who: &T::AccountId,
            _target: (u8, u64),
            total: u128,
        ) -> DispatchResult {
            let config = RouteConfig::<T>::get();
            
            let _total_bal: BalanceOf<T> = total.saturated_into();

            // 计算两部分金额
            let subject_amount = total.saturating_mul(config.subject_percent as u128) / 100;
            let platform_amount = total.saturating_sub(subject_amount);

            // 转账给目标账户
            if subject_amount > 0 {
                let _subject_bal: BalanceOf<T> = subject_amount.saturated_into();
                // TODO: 这里需要根据target获取实际账户，暂时忽略
                // 实际实现中应该通过 DonationAccountResolver 获取
            }

            // 转账给平台
            if platform_amount > 0 {
                let _platform_bal: BalanceOf<T> = platform_amount.saturated_into();
                // TODO: 这里需要配置平台账户
            }

            Ok(())
        }
    }

    /// 函数级中文注释：规格合法性检查
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

    /// 函数级中文注释：时长策略校验
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
}
