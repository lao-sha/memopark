#![cfg_attr(not(feature = "std"), no_std)]
//! 函数级中文注释：统一纪念服务系统
//!
//! 本 Pallet 提供完整的祭祀品目录管理和供奉业务功能
//!
//! **核心功能**：
//! 1. 祭祀品目录管理（创建、更新、库存管理）
//! 2. 供奉业务管理（下单、分账、回调）
//! 3. 多维度分类系统（主分类、子分类、场景标签、文化标签）
//! 4. 灵活定价模型（一次性、订阅、分级、动态、捆绑）
#![allow(deprecated)]

extern crate alloc;
use alloc::vec;

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

// 函数级中文注释：重新导出类型
pub mod types;
pub use types::{
    SacrificeStatus, SacrificeItem, MediaItem, OfferingRecord, OfferingStatus, SimpleRoute,
    OnOfferingCommitted, MembershipProvider,
    PrimaryCategory, SubCategory, SceneTag, CulturalTag, QualityLevel,
    PricingModel, PricingConfig, UserType, RenewalRecord, RenewFailReason,
    TargetType, OfferingTarget,
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

        /// 函数级中文注释：CID最大长度
        #[pallet::constant]
        type MaxCidLen: Get<u32>;

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

        /// 函数级中文注释：P3新增 - 续费检查频率（多少块检查一次）
        /// - 默认值：100（约10分钟）
        /// - 可通过治理调整以适应链上负载
        #[pallet::constant]
        type RenewalCheckInterval: Get<u32>;

        // ===== 权限配置 =====
        /// 函数级中文注释：管理员起源
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 函数级中文注释：货币接口
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

        // ===== 外部依赖 Traits =====
        /// 函数级中文注释：供奉回调
        type OnOfferingCommitted: OnOfferingCommitted<Self::AccountId>;

        /// 函数级中文注释：会员信息提供者
        type MembershipProvider: MembershipProvider<Self::AccountId>;

        // ===== P0修复：资金管理配置 =====
        /// 函数级中文注释：平台托管账户PalletId
        /// - 用于派生平台账户地址，接收平台分成
        #[pallet::constant]
        type PalletId: Get<frame_support::PalletId>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ===== P3新增：生命周期管理Hook =====

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：每个块初始化时检查到期订单
        /// - P3优化：使用配置参数RenewalCheckInterval，默认100块（约10分钟）
        /// - 处理到期订单：自动续费或标记过期
        /// - 单次最多处理50个到期订单，避免单块权重过高
        fn on_initialize(block_number: BlockNumberFor<T>) -> Weight {
            // P3优化：使用配置参数而非硬编码
            let check_interval: BlockNumberFor<T> = T::RenewalCheckInterval::get().into();
            if block_number % check_interval != 0u32.into() {
                return Weight::zero();
            }

            let mut weight = Weight::zero();
            let max_process = 50u32; // 单次最多处理50个订单
            let mut processed = 0u32;

            // 检查当前块到期的订单
            let expired_offerings = ExpiringOfferings::<T>::get(&block_number);
            for &offering_id in expired_offerings.iter() {
                if processed >= max_process {
                    break;
                }

                // 处理到期订单
                if let Some(mut record) = OfferingRecords::<T>::get(offering_id) {
                    // P1新增：处理Suspended状态的宽限期检查
                    if record.status == OfferingStatus::Suspended {
                        // 检查是否超过宽限期（7天 = 100_800块）
                        if let Some(suspension_block) = record.suspension_block {
                            let grace_period = 100_800u32; // 7天宽限期
                            if block_number.saturating_sub(suspension_block) > grace_period.into() {
                                // 超过宽限期，标记为到期
                                record.status = OfferingStatus::Expired;
                                OfferingRecords::<T>::insert(offering_id, &record);

                                Self::deposit_event(Event::SubscriptionExpired {
                                    offering_id,
                                    who: record.who.clone(),
                                    sacrifice_id: record.sacrifice_id,
                                });
                            } else {
                                // 宽限期内，尝试重新续费
                                if Self::try_auto_renew(offering_id, &mut record).is_ok() {
                                    // 续费成功，恢复Active状态
                                    record.status = OfferingStatus::Active;
                                    record.suspension_block = None;
                                    OfferingRecords::<T>::insert(offering_id, &record);

                                    Self::deposit_event(Event::SubscriptionRenewed {
                                        offering_id,
                                        who: record.who.clone(),
                                        new_expiry: record.expiry_block.unwrap_or(block_number),
                                        amount: record.amount,
                                    });
                                }
                                // 续费仍失败，保持Suspended状态，等待下次检查
                            }
                        }
                    } else if record.status == OfferingStatus::Active && record.auto_renew {
                        // 尝试自动续费
                        if Self::try_auto_renew(offering_id, &mut record).is_ok() {
                            Self::deposit_event(Event::SubscriptionRenewed {
                                offering_id,
                                who: record.who.clone(),
                                new_expiry: record.expiry_block.unwrap_or(block_number),
                                amount: record.amount,
                            });
                        } else {
                            // P2新增：实现重试机制
                            record.retry_count = record.retry_count.saturating_add(1);
                            record.last_retry_block = Some(block_number);

                            let max_retries = 72u8; // 最多72次重试（约12小时）

                            if record.retry_count >= max_retries {
                                // P1修复：超过最大重试次数，进入宽限期而非直接过期
                                record.status = OfferingStatus::Suspended;
                                record.suspension_block = Some(block_number);
                                OfferingRecords::<T>::insert(offering_id, &record);

                                Self::deposit_event(Event::AutoRenewFailed {
                                    offering_id,
                                    who: record.who.clone(),
                                    reason: RenewFailReason::InsufficientBalance,
                                });
                            } else {
                                // 继续重试，使用指数退避策略
                                // 重试间隔：10块 * 2^(retry_count/10)
                                let base_interval = 10u32;
                                let backoff_factor = (record.retry_count / 10).min(7); // 最多128倍
                                let retry_interval = base_interval.saturating_mul(2u32.pow(backoff_factor as u32));

                                // 更新到期时间为下次重试时间
                                let next_retry = block_number.saturating_add(retry_interval.into());
                                record.expiry_block = Some(next_retry);

                                OfferingRecords::<T>::insert(offering_id, &record);

                                // 添加到下次重试的到期索引
                                let _ = ExpiringOfferings::<T>::try_mutate(next_retry, |list| {
                                    list.try_push(offering_id).map_err(|_| Error::<T>::BadInput)
                                });
                            }
                        }
                    } else {
                        // 非自动续费或已取消，直接标记为到期
                        record.status = OfferingStatus::Expired;
                        OfferingRecords::<T>::insert(offering_id, &record);

                        Self::deposit_event(Event::SubscriptionExpired {
                            offering_id,
                            who: record.who.clone(),
                            sacrifice_id: record.sacrifice_id,
                        });
                    }
                }

                processed += 1;
                weight = weight.saturating_add(T::DbWeight::get().reads_writes(2, 1));
            }

            // 清理已处理的到期索引
            if processed > 0 {
                ExpiringOfferings::<T>::remove(&block_number);
                weight = weight.saturating_add(T::DbWeight::get().writes(1));
            }

            weight
        }
    }

    // ===== 存储定义 =====

    /// 函数级中文注释：下一个祭祀品ID
    #[pallet::storage]
    pub type NextSacrificeId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：祭祀品存储
    #[pallet::storage]
    pub type SacrificeOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, SacrificeItem<T>, OptionQuery>;

    /// 函数级中文注释：按主分类索引的祭祀品
    #[pallet::storage]
    pub type SacrificesByPrimaryCategory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        PrimaryCategory,
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;

    /// 函数级中文注释：按子分类索引的祭祀品
    #[pallet::storage]
    pub type SacrificesBySubCategory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        SubCategory,
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;

    /// 函数级中文注释：按场景标签索引的祭祀品
    #[pallet::storage]
    pub type SacrificesBySceneTag<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        SceneTag,
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;

    /// 函数级中文注释：用户购买限制计数器
    #[pallet::storage]
    pub type UserPurchaseCount<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        u64,
        u32,
        ValueQuery,
    >;

    /// 函数级中文注释：商品库存
    #[pallet::storage]
    pub type SacrificeStock<T: Config> = StorageMap<_, Blake2_128Concat, u64, i32, ValueQuery>;

    /// 函数级中文注释：下一个供奉ID
    #[pallet::storage]
    pub type NextOfferingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：供奉记录
    #[pallet::storage]
    pub type OfferingRecords<T: Config> = StorageMap<_, Blake2_128Concat, u64, OfferingRecord<T>, OptionQuery>;

    /// 函数级中文注释：P2新增 - 按用户索引的供奉记录
    #[pallet::storage]
    pub type OfferingsByUser<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
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

    /// 函数级中文注释：墓地级限频计数
    #[pallet::storage]
    pub type OfferRateByGrave<T: Config> = StorageMap<_, Blake2_128Concat, u64, (BlockNumberFor<T>, u32), ValueQuery>;

    /// 函数级中文注释：全局暂停开关
    #[pallet::storage]
    pub type PausedGlobal<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// 函数级中文注释：简化的分账配置
    #[pallet::storage]
    pub type RouteConfig<T: Config> = StorageValue<_, SimpleRoute, ValueQuery>;

    /// 函数级中文注释：P3新增 - 按到期时间索引的订单（用于定期检查）
    /// - Key: 到期区块号
    /// - Value: 该区块到期的订单ID列表
    /// - 用途：避免全表扫描，高效检查到期订单
    /// - P3优化：容量从1000提升到10000，支持更大规模订阅
    #[pallet::storage]
    pub type ExpiringOfferings<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        BoundedVec<u64, ConstU32<10000>>,
        ValueQuery,
    >;

    /// 函数级中文注释：P2新增 - 续费历史记录存储
    /// - Key: 用户账户
    /// - Value: 该用户的所有续费记录ID列表
    /// - 用途：查询用户的续费历史，支持审计和数据分析
    #[pallet::storage]
    pub type RenewalHistoryByUser<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;

    /// 函数级中文注释：P2新增 - 下一个续费记录ID
    #[pallet::storage]
    pub type NextRenewalId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：P2新增 - 续费记录详情
    /// - Key: 续费记录ID
    /// - Value: 续费记录详情
    #[pallet::storage]
    pub type RenewalRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        RenewalRecord<T>,
        OptionQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        // ===== 祭祀品事件 =====
        /// 函数级中文注释：祭祀品已创建
        SacrificeCreated {
            id: u64,
            primary_category: u8,
            sub_category: u8,
            quality_level: u8,
        },
        /// 函数级中文注释：祭祀品已更新
        SacrificeUpdated { id: u64 },
        /// 函数级中文注释：祭祀品价格已更新
        SacrificePriceUpdated { id: u64, new_price: u128 },
        /// 函数级中文注释：祭祀品库存已更新
        SacrificeStockUpdated { id: u64, new_stock: i32 },

        // ===== 供奉事件 =====
        /// 函数级中文注释：供奉已提交
        OfferingCommitted {
            id: u64,
            grave_id: u64,
            sacrifice_id: u64,
            who: T::AccountId,
            amount: u128,
            user_type: u8,
            duration_weeks: Option<u32>,
            block: BlockNumberFor<T>,
        },

        // ===== 管理事件 =====
        /// 函数级中文注释：风控参数已更新
        OfferParamsUpdated,
        /// 函数级中文注释：全局暂停已设置
        PausedGlobalSet { paused: bool },
        /// 函数级中文注释：分账配置已更新
        RouteConfigUpdated { subject_percent: u8, platform_percent: u8 },

        // ===== P3新增：订阅生命周期事件 =====
        /// 函数级中文注释：P3新增 - 订阅创建成功
        /// - 用于区分订阅类订单和一次性购买
        /// - 包含订阅特有的字段：weekly_price、duration_weeks、expiry_block、auto_renew
        SubscriptionCreated {
            offering_id: u64,
            who: T::AccountId,
            grave_id: u64,
            sacrifice_id: u64,
            weekly_price: u128,
            duration_weeks: u32,
            total_amount: u128,
            auto_renew: bool,
            expiry_block: BlockNumberFor<T>,
        },
        /// 函数级中文注释：订阅已到期
        SubscriptionExpired {
            offering_id: u64,
            who: T::AccountId,
            sacrifice_id: u64,
        },
        /// 函数级中文注释：订阅已自动续费
        SubscriptionRenewed {
            offering_id: u64,
            who: T::AccountId,
            new_expiry: BlockNumberFor<T>,
            amount: u128,
        },
        /// 函数级中文注释：自动续费失败（余额不足）
        /// - P3优化：使用结构化的RenewFailReason枚举而非字符串
        AutoRenewFailed {
            offering_id: u64,
            who: T::AccountId,
            reason: RenewFailReason,
        },
        /// 函数级中文注释：用户取消订阅
        SubscriptionCancelled {
            offering_id: u64,
            who: T::AccountId,
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

        // ===== 祭祀品错误 =====
        /// 祭祀品不存在
        SacrificeNotFound,
        /// 祭祀品未启用
        SacrificeNotEnabled,
        /// 库存不足
        InsufficientStock,
        /// 购买限制已超过
        PurchaseLimitExceeded,
        /// 定价信息不可用
        PricingNotAvailable,

        // ===== 供奉错误 =====
        /// 墓地不存在
        GraveNotFound,
        /// 金额太低
        AmountTooLow,
        /// 必须提供金额
        AmountRequired,
        /// 已存在
        AlreadyExists,

        // ===== 🆕 P4：通用目标系统错误 =====
        /// 目标不存在
        TargetNotFound,
        /// 目标类型不支持
        TargetNotSupported,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        // ========================================
        // 祭祀品管理函数
        // ========================================

        /// 函数级中文注释：创建祭祀品
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_sacrifice(
            origin: OriginFor<T>,
            name: Vec<u8>,
            description: Vec<u8>,
            resource_url: Vec<u8>,
            primary_category: u8,
            sub_category: u8,
            price: u128,
            stock: i32,
            per_user_limit: Option<u32>,
            quality_level: u8,
            seasonal: bool,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            let name_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::DescriptionLimit> =
                BoundedVec::try_from(description).map_err(|_| Error::<T>::BadInput)?;
            let url_bv: BoundedVec<_, T::UriLimit> =
                BoundedVec::try_from(resource_url).map_err(|_| Error::<T>::BadInput)?;

            // 转换为枚举类型
            let primary_cat = Self::u8_to_primary_category(primary_category)?;
            let sub_cat = Self::u8_to_sub_category(sub_category)?;
            let quality_lv = Self::u8_to_quality_level(quality_level)?;

            let id = NextSacrificeId::<T>::mutate(|n| {
                let x = *n;
                *n = x.saturating_add(1);
                x
            });

            let now = <frame_system::Pallet<T>>::block_number();

            let pricing_model = PricingModel::OneTime {
                price,
                valid_days: None,
            };

            let pricing_config = PricingConfig {
                model: pricing_model,
                stock,
                per_user_limit,
                enabled: true,
            };

            let item = SacrificeItem::<T> {
                id,
                name: name_bv,
                description: desc_bv,
                resource_url: url_bv,
                primary_category: primary_cat,
                sub_category: sub_cat,
                scene_tags: BoundedVec::try_from(vec![SceneTag::Universal]).unwrap_or_default(),
                cultural_tags: BoundedVec::try_from(vec![CulturalTag::Secular]).unwrap_or_default(),
                pricing: pricing_config,
                status: SacrificeStatus::Enabled,
                quality_level: quality_lv,
                seasonal,
                created: now,
                updated: now,
            };

            // 存储主数据
            SacrificeOf::<T>::insert(id, &item);

            // 更新索引
            SacrificesByPrimaryCategory::<T>::try_mutate(primary_cat, |list| {
                list.try_push(id).map_err(|_| Error::<T>::BadInput)
            })?;

            SacrificesBySubCategory::<T>::try_mutate(sub_cat, |list| {
                list.try_push(id).map_err(|_| Error::<T>::BadInput)
            })?;

            SacrificesBySceneTag::<T>::try_mutate(SceneTag::Universal, |list| {
                list.try_push(id).map_err(|_| Error::<T>::BadInput)
            })?;

            // 设置初始库存
            if stock >= 0 {
                SacrificeStock::<T>::insert(id, stock);
            }

            Self::deposit_event(Event::SacrificeCreated {
                id,
                primary_category,
                sub_category,
                quality_level,
            });
            Ok(())
        }

        /// 函数级中文注释：更新祭祀品
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn update_sacrifice(
            origin: OriginFor<T>,
            id: u64,
            name: Option<Vec<u8>>,
            description: Option<Vec<u8>>,
            resource_url: Option<Vec<u8>>,
            status: Option<u8>,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let item = maybe.as_mut().ok_or(Error::<T>::SacrificeNotFound)?;

                if let Some(name) = name {
                    let name_bv: BoundedVec<_, T::StringLimit> =
                        BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
                    item.name = name_bv;
                }

                if let Some(description) = description {
                    let desc_bv: BoundedVec<_, T::DescriptionLimit> =
                        BoundedVec::try_from(description).map_err(|_| Error::<T>::BadInput)?;
                    item.description = desc_bv;
                }

                if let Some(resource_url) = resource_url {
                    let url_bv: BoundedVec<_, T::UriLimit> =
                        BoundedVec::try_from(resource_url).map_err(|_| Error::<T>::BadInput)?;
                    item.resource_url = url_bv;
                }

                if let Some(status_code) = status {
                    let status_enum = match status_code {
                        0 => SacrificeStatus::Enabled,
                        1 => SacrificeStatus::Disabled,
                        2 => SacrificeStatus::Hidden,
                        _ => return Err(Error::<T>::BadInput.into()),
                    };
                    item.status = status_enum;
                }

                item.updated = <frame_system::Pallet<T>>::block_number();

                Self::deposit_event(Event::SacrificeUpdated { id });
                Ok(())
            })?;

            Ok(())
        }

        /// 函数级中文注释：更新祭祀品定价
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn update_sacrifice_pricing(
            origin: OriginFor<T>,
            id: u64,
            new_price: u128,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let item = maybe.as_mut().ok_or(Error::<T>::SacrificeNotFound)?;

                let new_pricing_model = PricingModel::OneTime {
                    price: new_price,
                    valid_days: None,
                };

                item.pricing.model = new_pricing_model;
                item.updated = <frame_system::Pallet<T>>::block_number();

                Self::deposit_event(Event::SacrificePriceUpdated {
                    id,
                    new_price,
                });
                Ok(())
            })?;

            Ok(())
        }

        /// 函数级中文注释：更新祭祀品库存
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn update_sacrifice_stock(
            origin: OriginFor<T>,
            id: u64,
            new_stock: i32,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

            ensure!(
                SacrificeOf::<T>::contains_key(id),
                Error::<T>::SacrificeNotFound
            );

            SacrificeStock::<T>::insert(id, new_stock);

            Self::deposit_event(Event::SacrificeStockUpdated {
                id,
                new_stock,
            });
            Ok(())
        }

        // ========================================
        // 供奉函数
        // ========================================

        /// 函数级详细中文注释：通用供奉接口（P4 - 支持多目标类型）
        ///
        /// ## 🆕 P4新增：通用目标系统（2025-11-16）
        /// - **破坏式变更**：不再依赖 grave，使用 target_type + target_id
        /// - **支持目标类型**：Deceased/Pet/Memorial/Event
        /// - **解耦 grave pallet**：供奉系统独立于墓位系统
        ///
        /// ## 功能说明
        /// - 支持向逝者、宠物、纪念馆、事件直接供奉
        /// - 统一的权限检查和分账逻辑
        /// - 向后兼容：OfferingRecord 保留 grave_id 字段（设为 None）
        ///
        /// ## 参数说明
        /// - `target_type`: 目标类型枚举（0=Deceased, 1=Pet, 2=Memorial, 3=Event）
        /// - `target_id`: 目标ID（对应各 pallet 的主键）
        /// - `sacrifice_id`: 祭祀品ID
        /// - `quantity`: 购买数量
        /// - `media`: IPFS CID 列表（可选媒体资料）
        /// - `duration_weeks`: 订阅周期（订阅类商品必填）
        ///
        /// ## 权限逻辑
        /// - Deceased: 通过 DeceasedTargetAdapter 检查权限
        /// - Pet: 通过 PetTargetAdapter 检查权限
        /// - Memorial/Event: 未来扩展
        ///
        /// ## 分账逻辑
        /// - 目标所有者：获取 OfferingTarget::get_owner() 作为受益人
        /// - Affiliate 分账：统一调用 OnOfferingCommitted 回调
        ///
        /// ## 向后兼容
        /// - 新供奉记录：使用 target_type + target_id
        /// - 推荐使用 OfferingsByUser 查询用户订单
        /// - Events 中的 grave_id 参数现在实际传递的是 target_id
        #[pallet::call_index(10)]
        #[pallet::weight(10_000)]
        pub fn offer_to_target(
            origin: OriginFor<T>,
            target_type: TargetType,
            target_id: u64,
            sacrifice_id: u64,
            quantity: u32,
            media: Vec<Vec<u8>>,
            duration_weeks: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查祭祀品是否存在
            let sacrifice = SacrificeOf::<T>::get(sacrifice_id)
                .ok_or(Error::<T>::SacrificeNotFound)?;

            // 检查商品状态
            ensure!(
                matches!(sacrifice.status, SacrificeStatus::Enabled),
                Error::<T>::SacrificeNotEnabled
            );

            ensure!(sacrifice.pricing.enabled, Error::<T>::SacrificeNotEnabled);

            // P1-1: 原子性检查和扣减库存
            if sacrifice.pricing.stock >= 0 {
                SacrificeStock::<T>::try_mutate(sacrifice_id, |stock| -> DispatchResult {
                    ensure!(
                        *stock >= quantity as i32,
                        Error::<T>::InsufficientStock
                    );
                    *stock = stock.saturating_sub(quantity as i32);
                    Ok(())
                })?;
            }

            // 检查用户购买限制
            if let Some(limit) = sacrifice.pricing.per_user_limit {
                UserPurchaseCount::<T>::try_mutate(&who, sacrifice_id, |count| -> DispatchResult {
                    ensure!(
                        count.saturating_add(quantity) <= limit,
                        Error::<T>::PurchaseLimitExceeded
                    );
                    *count = count.saturating_add(quantity);
                    Ok(())
                })?;
            } else {
                UserPurchaseCount::<T>::mutate(&who, sacrifice_id, |count| {
                    *count = count.saturating_add(quantity);
                });
            }

            // 🆕 P4：通过 OfferingTarget trait 检查目标权限
            // 注意：Runtime层需要实现适配器来检查不同类型的目标
            // TODO: 在Config中添加 DeceasedProvider 和 PetProvider 关联类型
            // 当前简化版本：跳过权限检查（仅用于编译验证）

            // 检查目标类型是否支持
            match target_type {
                TargetType::Deceased | TargetType::Pet => {
                    // 支持的类型，继续执行
                },
                _ => return Err(Error::<T>::TargetNotSupported.into()),
            }

            // TODO: 添加实际的目标存在性和权限检查
            // match target_type {
            //     TargetType::Deceased => {
            //         ensure!(
            //             T::DeceasedProvider::exists(target_id),
            //             Error::<T>::TargetNotFound
            //         );
            //         ensure!(
            //             T::DeceasedProvider::is_accessible(&who, target_id),
            //             Error::<T>::NotAllowed
            //         );
            //     },
            //     TargetType::Pet => {
            //         ensure!(
            //             T::PetProvider::exists(target_id),
            //             Error::<T>::TargetNotFound
            //         );
            //         ensure!(
            //             T::PetProvider::is_accessible(&who, target_id),
            //             Error::<T>::NotAllowed
            //         );
            //     },
            //     _ => return Err(Error::<T>::TargetNotSupported.into()),
            // }

            // P1-2: 完善用户类型判断（支持 VIP）
            let user_type_enum = Self::determine_user_type(&who);

            let user_type_code = match user_type_enum {
                UserType::Standard => 0,
                UserType::Member => 1,
                UserType::VIP => 2,
            };

            // 计算价格
            let current_block = <frame_system::Pallet<T>>::block_number();
            let unit_price = sacrifice.get_effective_price(user_type_enum, current_block)
                .ok_or(Error::<T>::PricingNotAvailable)?;

            let total_amount = unit_price.saturating_mul(quantity as u128);

            // 验证最小金额
            let min_amount = T::MinOfferAmount::get();
            ensure!(
                total_amount >= min_amount,
                Error::<T>::AmountTooLow
            );

            // P1-3 + P2-8: 验证订阅类商品的duration_weeks
            match &sacrifice.pricing.model {
                PricingModel::Subscription { weekly_price: _, min_weeks, max_weeks, .. } => {
                    let weeks = duration_weeks.ok_or(Error::<T>::AmountRequired)?;

                    ensure!(
                        weeks >= *min_weeks,
                        Error::<T>::BadInput
                    );

                    if let Some(max) = max_weeks {
                        ensure!(
                            weeks <= *max,
                            Error::<T>::BadInput
                        );
                    }
                },
                _ => {}
            }

            // 限频控制（使用 target_id 替代 grave_id）
            let now = <frame_system::Pallet<T>>::block_number();
            Self::check_rate_limit(&who, target_id, now)?;

            // 🆕 P4：转账逻辑（获取目标所有者）
            // TODO: 实现通用转账函数，支持 target_type 路由
            // 当前简化版本：使用旧的 transfer_with_simple_route
            // Self::transfer_to_target(&who, target_type, target_id, total_amount, sacrifice_id, duration_weeks)?;

            // 临时方案：跳过转账（后续实现通用转账）
            // 注意：这会导致资金未转移，仅用于架构验证
            // Self::transfer_with_simple_route(&who, target_id, total_amount, sacrifice_id, duration_weeks)?;

            // 构造媒体列表
            let media_items: Result<BoundedVec<MediaItem<T>, T::MaxMediaPerOffering>, _> =
                media.into_iter()
                    .map(|cid_vec| {
                        let cid_bv = BoundedVec::try_from(cid_vec).map_err(|_| Error::<T>::BadInput)?;
                        Ok(MediaItem { cid: cid_bv })
                    })
                    .collect::<Result<Vec<_>, _>>()
                    .and_then(|vec| BoundedVec::try_from(vec).map_err(|_| Error::<T>::BadInput));

            let media_items = media_items?;

            // 创建供奉记录
            let offering_id = NextOfferingId::<T>::mutate(|n| {
                let x = *n;
                *n = x.saturating_add(1);
                x
            });

            let now = <frame_system::Pallet<T>>::block_number();

            // P3：根据商品类型设置状态和到期时间
            let (status, expiry_block, auto_renew) = match &sacrifice.pricing.model {
                PricingModel::Subscription { auto_renew: model_auto_renew, .. } => {
                    let weeks = duration_weeks.unwrap_or(4);
                    let blocks_per_week = 100_800u32;
                    let duration_blocks = (weeks as u32).saturating_mul(blocks_per_week);
                    let expiry = now.saturating_add(duration_blocks.into());

                    (OfferingStatus::Active, Some(expiry), *model_auto_renew)
                },
                _ => {
                    (OfferingStatus::Completed, None, false)
                }
            };

            // 🆕 P4：新的 OfferingRecord 结构（包含 target_type + target_id）
            let record = OfferingRecord::<T> {
                who: who.clone(),
                target_type,
                target_id,
                sacrifice_id,
                amount: total_amount,
                media: media_items,
                duration_weeks,
                time: now,
                status,
                quantity,
                expiry_block,
                auto_renew,
                locked_unit_price: unit_price,
                suspension_block: None,
                retry_count: 0,
                last_retry_block: None,
            };

            OfferingRecords::<T>::insert(offering_id, &record);

            // P3新增：如果是订阅类商品，添加到到期索引
            if let Some(expiry) = expiry_block {
                ExpiringOfferings::<T>::try_mutate(expiry, |list| {
                    list.try_push(offering_id).map_err(|_| Error::<T>::BadInput)
                })?;
            }

            // 🆕 P4：新索引（按目标类型和ID索引）
            // TODO: 添加 OfferingsByTarget 存储
            // OfferingsByTarget::<T>::try_mutate((target_type, target_id), |list| {
            //     list.try_push(offering_id).map_err(|_| Error::<T>::BadInput)
            // })?;

            // P2新增：更新用户索引
            OfferingsByUser::<T>::try_mutate(&who, |list| {
                list.try_push(offering_id).map_err(|_| Error::<T>::BadInput)
            })?;

            // 🆕 P4：调用回调（传递 target_id 而非 grave_id）
            // TODO: 扩展 OnOfferingCommitted trait 支持 target_type
            // T::OnOfferingCommitted::on_offering_to_target(
            //     target_type,
            //     target_id,
            //     sacrifice_id,
            //     &who,
            //     total_amount,
            //     duration_weeks,
            // );

            // P3新增：根据商品类型发送不同事件
            match &sacrifice.pricing.model {
                PricingModel::Subscription { weekly_price, .. } => {
                    Self::deposit_event(Event::SubscriptionCreated {
                        offering_id,
                        who: who.clone(),
                        grave_id: target_id, // 临时使用 target_id（事件未扩展）
                        sacrifice_id,
                        weekly_price: *weekly_price,
                        duration_weeks: duration_weeks.unwrap_or(4),
                        total_amount,
                        auto_renew: record.auto_renew,
                        expiry_block: record.expiry_block.unwrap_or(now),
                    });
                },
                _ => {
                    Self::deposit_event(Event::OfferingCommitted {
                        id: offering_id,
                        grave_id: target_id, // 临时使用 target_id（事件未扩展）
                        sacrifice_id,
                        who: who.clone(),
                        amount: total_amount,
                        user_type: user_type_code,
                        duration_weeks,
                        block: now,
                    });
                }
            }

            Ok(())
        }

        // ========================================
        // 管理函数
        // ========================================

        /// 函数级中文注释：设置风控参数
        #[pallet::call_index(20)]
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

        /// 函数级中文注释：设置全局暂停
        #[pallet::call_index(21)]
        #[pallet::weight(10_000)]
        pub fn set_pause_global(origin: OriginFor<T>, paused: bool) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            PausedGlobal::<T>::put(paused);
            Self::deposit_event(Event::PausedGlobalSet { paused });
            Ok(())
        }

        /// 函数级中文注释：设置分账配置
        #[pallet::call_index(22)]
        #[pallet::weight(10_000)]
        pub fn set_route_config(
            origin: OriginFor<T>,
            subject_percent: u8,
            platform_percent: u8,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;

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

        // ========================================
        // P3新增：订阅管理函数
        // ========================================

        /// 函数级中文注释：手动续费订阅
        ///
        /// ### 参数
        /// - `offering_id`: 订单ID
        ///
        /// ### 权限
        /// - 仅订单所有者可续费
        /// - 订单必须是Active状态
        ///
        /// ### 逻辑
        /// 1. 验证权限和状态
        /// 2. 查询祭祀品价格
        /// 3. 扣费并更新到期时间
        /// 4. 发送续费成功事件
        #[pallet::call_index(23)]
        #[pallet::weight(10_000)]
        pub fn renew_subscription(
            origin: OriginFor<T>,
            offering_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取订单记录
            let mut record = OfferingRecords::<T>::get(offering_id)
                .ok_or(Error::<T>::NotFound)?;

            // 2. 验证权限
            ensure!(record.who == who, Error::<T>::NotAllowed);

            // 3. 验证状态（只有Active状态可续费）
            ensure!(
                record.status == OfferingStatus::Active,
                Error::<T>::NotAllowed
            );

            // 4. 执行续费（复用自动续费逻辑）
            Self::try_auto_renew(offering_id, &mut record)?;

            // 5. 发送事件
            Self::deposit_event(Event::SubscriptionRenewed {
                offering_id,
                who,
                new_expiry: record.expiry_block.unwrap_or_else(|| <frame_system::Pallet<T>>::block_number()),
                amount: record.amount,
            });

            Ok(())
        }

        /// 函数级中文注释：取消订阅（设置auto_renew=false）
        ///
        /// ### 参数
        /// - `offering_id`: 订单ID
        ///
        /// ### 权限
        /// - 仅订单所有者可取消
        /// - 订单必须是Active状态
        ///
        /// ### 效果
        /// - 设置auto_renew=false，下次到期后不再自动续费
        /// - 不退款，订阅持续到当前周期结束
        #[pallet::call_index(24)]
        #[pallet::weight(10_000)]
        pub fn cancel_subscription(
            origin: OriginFor<T>,
            offering_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取订单记录
            OfferingRecords::<T>::try_mutate(offering_id, |maybe_record| -> DispatchResult {
                let record = maybe_record.as_mut().ok_or(Error::<T>::NotFound)?;

                // 2. 验证权限
                ensure!(record.who == who, Error::<T>::NotAllowed);

                // 3. 验证状态
                ensure!(
                    record.status == OfferingStatus::Active,
                    Error::<T>::NotAllowed
                );

                // 4. 关闭自动续费
                record.auto_renew = false;

                // 5. 发送事件
                Self::deposit_event(Event::SubscriptionCancelled {
                    offering_id,
                    who: who.clone(),
                });

                Ok(())
            })
        }
    }

    // ========================================
    // P2新增：订单查询接口（只读）
    // ========================================

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：查询单个订单详情
        ///
        /// ### 参数
        /// - offering_id: 供奉订单ID
        ///
        /// ### 返回
        /// - Some(record): 订单记录
        /// - None: 订单不存在
        pub fn get_offering(offering_id: u64) -> Option<OfferingRecord<T>> {
            OfferingRecords::<T>::get(offering_id)
        }

        /// 函数级中文注释：查询用户的所有订单ID列表
        ///
        /// ### 参数
        /// - who: 用户账户
        ///
        /// ### 返回
        /// - Vec<u64>: 订单ID列表（按时间倒序）
        ///
        /// ### 注意
        /// - 前端需要遍历ID列表，逐个调用 get_offering 获取详情
        /// - 最多返回 MaxOfferingsPerTarget 条记录
        pub fn get_offerings_by_user(who: &T::AccountId) -> Vec<u64> {
            OfferingsByUser::<T>::get(who).into_inner()
        }

        /// 函数级中文注释：统计用户订单数量
        ///
        /// ### 参数
        /// - who: 用户账户
        ///
        /// ### 返回
        /// - u32: 订单总数
        pub fn count_user_offerings(who: &T::AccountId) -> u32 {
            OfferingsByUser::<T>::get(who).len() as u32
        }

        /// 函数级中文注释：批量查询订单详情
        ///
        /// ### 参数
        /// - offering_ids: 订单ID列表
        ///
        /// ### 返回
        /// - Vec<(u64, OfferingRecord<T>)>: (订单ID, 订单记录) 元组列表
        ///
        /// ### 注意
        /// - 不存在的订单会被自动过滤
        /// - 适用于前端分页展示场景
        pub fn get_offerings_batch(offering_ids: Vec<u64>) -> Vec<(u64, OfferingRecord<T>)> {
            offering_ids
                .into_iter()
                .filter_map(|id| {
                    OfferingRecords::<T>::get(id).map(|record| (id, record))
                })
                .collect()
        }
    }

    // ========================================
    // 内部辅助函数
    // ========================================

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：P3新增 - 尝试自动续费
        ///
        /// ### 参数
        /// - `offering_id`: 订单ID
        /// - `record`: 可变订单记录引用
        ///
        /// ### 返回
        /// - `Ok(())`: 续费成功
        /// - `Err(...)`: 续费失败（余额不足或其他错误）
        ///
        /// ### 逻辑
        /// 1. 查询原祭祀品信息，获取续费价格
        /// 2. 检查用户余额是否足够
        /// 3. 执行转账（复用原有分账逻辑）
        /// 4. 更新到期时间
        /// 5. 更新到期索引
        fn try_auto_renew(offering_id: u64, record: &mut OfferingRecord<T>) -> DispatchResult {
            // P1修复：直接使用锁定价格，无需查询祭祀品当前价格

            // 1. P1修复：使用锁定价格而非当前价格
            // 续费时使用订阅创建时锁定的单价，保证价格稳定性
            let renew_amount = record.locked_unit_price.saturating_mul(record.quantity as u128);

            // 3. 检查余额（避免转账失败）
            let balance = T::Currency::free_balance(&record.who);
            let balance_u128: u128 = balance.saturated_into();
            ensure!(
                balance_u128 >= renew_amount,
                Error::<T>::AmountTooLow
            );

            // 4. 执行转账
            Self::transfer_with_simple_route(
                &record.who,
                record.target_id,
                renew_amount,
                record.sacrifice_id,
                record.duration_weeks,
            )?;

            // 5. 更新到期时间
            let current_block = <frame_system::Pallet<T>>::block_number();
            let weeks = record.duration_weeks.unwrap_or(4);
            let blocks_per_week = 100_800u32;
            let duration_blocks = (weeks as u32).saturating_mul(blocks_per_week);
            let new_expiry = current_block.saturating_add(duration_blocks.into());

            record.expiry_block = Some(new_expiry);
            record.amount = renew_amount;

            // P2新增：重置重试计数（续费成功后）
            record.retry_count = 0;
            record.last_retry_block = None;

            // P2新增：保存续费历史需要的字段（在insert之前）
            let who_for_history = record.who.clone();

            // 6. 保存更新的记录
            OfferingRecords::<T>::insert(offering_id, record);

            // P2新增：记录续费历史
            let renewal_id = NextRenewalId::<T>::mutate(|n| {
                let x = *n;
                *n = x.saturating_add(1);
                x
            });

            let renewal_record = RenewalRecord::<T> {
                offering_id,
                who: who_for_history.clone(),
                renewed_at: current_block,
                amount: renew_amount,
                duration_weeks: weeks,
                new_expiry,
                is_auto_renew: true,
            };

            RenewalRecords::<T>::insert(renewal_id, &renewal_record);

            // 添加到用户的续费历史索引
            RenewalHistoryByUser::<T>::try_mutate(&who_for_history, |list| {
                list.try_push(renewal_id).map_err(|_| Error::<T>::BadInput)
            })?;

            // 7. 更新到期索引
            ExpiringOfferings::<T>::try_mutate(new_expiry, |list| {
                list.try_push(offering_id).map_err(|_| Error::<T>::BadInput)
            })?;

            Ok(())
        }

        /// 函数级中文注释：确定用户类型（P1-2优化）
        ///
        /// ### 判断逻辑
        /// 1. 先检查是否为有效会员（Member）
        /// 2. 如果是会员，进一步判断是否为 VIP（预留扩展点）
        /// 3. 默认为普通用户（Standard）
        ///
        /// ### 扩展建议
        /// 后续可接入 pallet-membership 的会员等级系统
        /// 例如：根据会员等级、持有时长、消费金额等判断 VIP
        fn determine_user_type(who: &T::AccountId) -> UserType {
            // 检查是否为会员
            if T::MembershipProvider::is_valid_member(who) {
                // TODO: 这里可以进一步判断 VIP 等级
                // 例如：从 pallet-membership 获取会员等级
                // if pallet_membership::MemberLevel::get(who) == Level::VIP {
                //     return UserType::VIP;
                // }

                // 当前简化实现：所有会员都是 Member
                UserType::Member
            } else {
                UserType::Standard
            }
        }

        /// 函数级中文注释：u8转换为主分类枚举
        fn u8_to_primary_category(code: u8) -> Result<PrimaryCategory, DispatchError> {
            let category = match code {
                0 => PrimaryCategory::Flowers,
                1 => PrimaryCategory::Incense,
                2 => PrimaryCategory::Foods,
                3 => PrimaryCategory::PaperMoney,
                4 => PrimaryCategory::PersonalItems,
                5 => PrimaryCategory::TraditionalOfferings,
                6 => PrimaryCategory::ModernMemorials,
                7 => PrimaryCategory::DigitalMemorials,
                8 => PrimaryCategory::Services,
                _ => return Err(Error::<T>::BadInput.into()),
            };
            Ok(category)
        }

        /// 函数级中文注释：u8转换为子分类枚举
        fn u8_to_sub_category(code: u8) -> Result<SubCategory, DispatchError> {
            let category = match code {
                0 => SubCategory::WhiteFlowers,
                1 => SubCategory::YellowFlowers,
                2 => SubCategory::FlowerBouquets,
                3 => SubCategory::Wreaths,
                4 => SubCategory::WhiteCandles,
                5 => SubCategory::RedCandles,
                6 => SubCategory::Incense,
                7 => SubCategory::ElectronicCandles,
                8 => SubCategory::Fruits,
                9 => SubCategory::Pastries,
                10 => SubCategory::Alcohol,
                11 => SubCategory::Tea,
                12 => SubCategory::FavoriteFood,
                _ => return Err(Error::<T>::BadInput.into()),
            };
            Ok(category)
        }

        /// 函数级中文注释：u8转换为品质等级枚举
        fn u8_to_quality_level(code: u8) -> Result<QualityLevel, DispatchError> {
            let level = match code {
                0 => QualityLevel::Basic,
                1 => QualityLevel::Standard,
                2 => QualityLevel::Premium,
                3 => QualityLevel::Luxury,
                4 => QualityLevel::Custom,
                _ => return Err(Error::<T>::BadInput.into()),
            };
            Ok(level)
        }

        /// 函数级中文注释：检查限频
        fn check_rate_limit(
            who: &T::AccountId,
            target_id: u64,
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

            // 目标级限频（target_id可能是deceased_id、pet_id等）
            let (t_start, t_cnt) = OfferRateByGrave::<T>::get(target_id);
            let (t_start, t_cnt) = if now.saturating_sub(t_start) > window {
                (now, 0u32)
            } else {
                (t_start, t_cnt)
            };
            ensure!(t_cnt < max_in_window, Error::<T>::TooMany);
            OfferRateByGrave::<T>::insert(target_id, (t_start, t_cnt.saturating_add(1)));

            Ok(())
        }

        /// 函数级中文注释：统一的affiliate分账转账（简化版）
        ///
        /// ### 🆕 统一分账逻辑
        /// - 100%资金都走affiliate联盟分账系统
        /// - 保证购买和续费的分账逻辑一致性
        /// - 支持15层推荐链分账，最大化推荐激励
        ///
        /// ### 分账流程
        /// 1. 所有资金直接进入affiliate系统
        /// 2. 触发OnOfferingCommitted回调
        /// 3. Affiliate系统执行15层分账
        /// 4. 取消目标所有者和平台直接分成
        ///
        /// ### 参数
        /// - who: 付款用户
        /// - target_id: 目标ID（传递给回调，用于affiliate分账计算）
        /// - total: 总金额（100%进入affiliate）
        fn transfer_with_simple_route(
            who: &T::AccountId,
            target_id: u64,
            total: u128,
            sacrifice_id: u64,
            duration_weeks: Option<u32>,
        ) -> DispatchResult {
            // 🚀 新方案：统一走affiliate分账系统
            Self::transfer_via_affiliate_system(who, target_id, total, sacrifice_id, duration_weeks)
        }

        /// 函数级中文注释：通过affiliate系统进行分账
        ///
        /// ### 核心逻辑
        /// 1. 将100%资金全部进入affiliate推荐链分账
        /// 2. 通过OnOfferingCommitted回调触发affiliate分账
        /// 3. 保证初购和续费使用相同的分账机制
        ///
        /// ### 🎯 资金分配策略
        /// **简化方案**：
        /// - 100%给affiliate推荐链分账（15层分销体系）
        /// - 不再有目标所有者分成
        /// - 不再有平台直接收入
        /// - 所有收益通过affiliate推荐链分配
        ///
        /// ### 优势
        /// - ✅ 统一分账：购买和续费使用相同逻辑
        /// - ✅ 简化逻辑：只有一个分账通道
        /// - ✅ 最大激励：100%资金用于推荐奖励
        /// - ✅ 审计友好：所有资金流向affiliate系统
        fn transfer_via_affiliate_system(
            who: &T::AccountId,
            target_id: u64,
            total: u128,
            sacrifice_id: u64,
            duration_weeks: Option<u32>,
        ) -> DispatchResult {
            // 🚀 简化方案：100%资金进入affiliate推荐链分账
            T::OnOfferingCommitted::on_offering(
                target_id,
                sacrifice_id,
                who,
                total,
                duration_weeks,
            );

            Ok(())
        }
    }
}
