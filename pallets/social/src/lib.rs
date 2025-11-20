#![cfg_attr(not(feature = "std"), no_std)]

//! # Pallet Social
//!
//! 社交关系管理 pallet - 多类型目标关注系统
//!
//! ## 功能特性
//! - 支持多种目标类型（逝者、墓地、用户、宠物等）
//! - 继承 pallet-deceased 的关注功能
//! - 支持双向关注列表（关注者查看、被关注者查看）
//! - 关注者数量限制和关注数量限制
//! - 批量关注/取消关注操作

extern crate alloc;
use alloc::vec::Vec;
use sp_runtime::RuntimeDebug;
use codec::{Encode, Decode, MaxEncodedLen};
use frame_support::ensure;

// 函数级中文注释：导入log用于记录迁移信息
extern crate log;

pub use pallet::*;

/// 函数级详细中文注释：社交接口 trait
///
/// ### 设计目的
/// - 为其他 pallet 提供统一的社交关注功能接口
/// - 避免循环依赖，让其他 pallet 能够使用社交功能
/// - 支持多类型目标的关注系统
pub trait SocialInterface<AccountId> {
    /// 函数级中文注释：关注逝者（内部接口）
    fn follow_deceased_internal(
        follower: &AccountId,
        deceased_id: u64,
    ) -> Result<(), sp_runtime::DispatchError>;

    /// 函数级中文注释：取消关注逝者（内部接口）
    fn unfollow_deceased_internal(
        follower: &AccountId,
        deceased_id: u64,
    ) -> Result<(), sp_runtime::DispatchError>;

    /// 函数级中文注释：移除关注者（按目标）
    fn remove_follower_by_target(
        follower: &AccountId,
        target_id: u64,
    ) -> Result<(), sp_runtime::DispatchError>;

    /// 函数级中文注释：获取逝者关注者列表
    fn get_deceased_followers(deceased_id: u64) -> Vec<AccountId>;

    /// 函数级中文注释：检查是否关注逝者
    fn is_following_deceased(follower: &AccountId, deceased_id: u64) -> bool;

    /// 函数级中文注释：获取逝者关注者数量
    fn get_deceased_followers_count(deceased_id: u64) -> u32;
}

/// 函数级详细中文注释：目标类型枚举
///
/// ### 支持的目标类型
/// - **Deceased**: 逝者（从 pallet-deceased 迁移）
/// - **User**: 用户（社交关注）
/// - **Grave**: 墓地（从 pallet-stardust-grave，如果需要）
/// - **Pet**: 宠物（从 pallet-stardust-pet）
/// - **Memorial**: 纪念馆主题
#[derive(
    Encode,
    Decode,
    Clone,
    Copy,
    PartialEq,
    Eq,
    RuntimeDebug,
    scale_info::TypeInfo,
    MaxEncodedLen,
)]
pub enum TargetType {
    /// 逝者目标（继承自 pallet-deceased）
    Deceased = 0,
    /// 用户目标（社交关注）
    User = 1,
    /// 墓地目标
    Grave = 2,
    /// 宠物目标
    Pet = 3,
    /// 纪念馆主题目标
    Memorial = 4,
}

impl Default for TargetType {
    fn default() -> Self {
        Self::Deceased
    }
}

impl TargetType {
    /// 函数级中文注释：转换为 u8（用于事件）
    pub fn as_u8(&self) -> u8 {
        match self {
            Self::Deceased => 0,
            Self::User => 1,
            Self::Grave => 2,
            Self::Pet => 3,
            Self::Memorial => 4,
        }
    }
}

/// 函数级详细中文注释：目标标识符结构
///
/// ### 设计理念
/// - 类型安全：每个目标都有明确的类型和ID
/// - 可扩展：新增目标类型无需修改存储结构
/// - 高效索引：支持基于类型或ID的快速查询
#[derive(
    Encode,
    Decode,
    Clone,
    Copy,
    PartialEq,
    Eq,
    RuntimeDebug,
    scale_info::TypeInfo,
    MaxEncodedLen,
)]
pub struct Target {
    /// 目标类型
    pub target_type: TargetType,
    /// 目标ID
    pub target_id: u64,
}

impl Target {
    /// 函数级中文注释：创建新的目标标识符
    pub fn new(target_type: TargetType, target_id: u64) -> Self {
        Self { target_type, target_id }
    }

    /// 函数级中文注释：创建逝者目标（兼容性接口）
    pub fn deceased(deceased_id: u64) -> Self {
        Self::new(TargetType::Deceased, deceased_id)
    }

    /// 函数级中文注释：创建用户目标
    pub fn user(user_id: u64) -> Self {
        Self::new(TargetType::User, user_id)
    }
}

/// 函数级详细中文注释：关注信息结构
///
/// ### 扩展字段
/// - 关注时间：记录关注的具体时间
/// - 关注来源：标记关注的来源（手动、推荐、批量等）
/// - 通知设置：是否接收该目标的通知
#[derive(
    Encode,
    Decode,
    Clone,
    PartialEq,
    Eq,
    RuntimeDebug,
    scale_info::TypeInfo,
    MaxEncodedLen,
)]
pub struct FollowInfo<BlockNumber> {
    /// 关注时间
    pub followed_at: BlockNumber,
    /// 是否接收通知
    pub notifications_enabled: bool,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use frame_support::BoundedVec;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 函数级中文注释：每个目标最多关注者数量（继承自 deceased MaxFollowers）
        /// - 防止热门目标的关注者列表过大
        /// - 建议值：10,000（与 deceased 保持一致）
        type MaxFollowersPerTarget: Get<u32>;

        /// 函数级中文注释：每个用户最多关注数量
        /// - 防止用户无限制关注导致的存储膨胀
        /// - 建议值：1,000
        type MaxFollowingPerUser: Get<u32>;

        /// 函数级中文注释：批量操作最大数量
        /// - 单次批量关注/取消关注的最大目标数量
        /// - 建议值：100
        type MaxBatchSize: Get<u32>;

        /// 函数级中文注释：目标验证器
        /// - 验证目标存在性和权限
        /// - runtime 层面注入实现
        type TargetValidator: TargetValidator<Self::AccountId>;
    }

    /// 函数级详细中文注释：关注关系存储 - 主索引
    ///
    /// ### 存储结构
    /// - Key: (follower, target) → 关注者和目标的组合
    /// - Value: FollowInfo → 关注信息（时间、通知设置等）
    ///
    /// ### 用途
    /// - 快速查询：某用户是否关注某目标
    /// - 关注列表：某用户关注的所有目标
    /// - 关注详情：获取关注时间和设置
    #[pallet::storage]
    #[pallet::getter(fn following_info)]
    pub type FollowingMap<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,      // 关注者
        Blake2_128Concat,
        Target,            // 目标
        FollowInfo<BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：被关注者列表存储 - 反向索引
    ///
    /// ### 存储结构
    /// - Key: Target → 目标标识符
    /// - Value: BoundedVec<AccountId> → 关注者列表（有上限）
    ///
    /// ### 用途
    /// - 关注者查询：获取某目标的所有关注者
    /// - 关注者统计：关注者数量统计
    /// - 通知分发：向所有关注者发送通知
    ///
    /// ### 限制
    /// - 数量上限：MaxFollowersPerTarget
    /// - 兼容性：支持 deceased 的关注者查询接口
    #[pallet::storage]
    #[pallet::getter(fn followers_list)]
    pub type FollowersList<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        Target,
        BoundedVec<T::AccountId, T::MaxFollowersPerTarget>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：用户关注计数存储
    ///
    /// ### 存储结构
    /// - Key: AccountId → 用户账户
    /// - Value: u32 → 该用户关注的目标总数
    ///
    /// ### 用途
    /// - 快速检查：用户是否超过关注数量限制
    /// - 统计展示：用户关注总数
    /// - 性能优化：避免遍历 FollowingMap 计算数量
    #[pallet::storage]
    #[pallet::getter(fn following_count)]
    pub type FollowingCount<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u32,
        ValueQuery,
    >;

    /// 函数级详细中文注释：目标关注者计数存储
    ///
    /// ### 存储结构
    /// - Key: Target → 目标标识符
    /// - Value: u32 → 该目标的关注者总数
    ///
    /// ### 用途
    /// - 快速检查：目标是否超过关注者数量限制
    /// - 统计展示：目标关注者总数
    /// - 性能优化：避免计算 FollowersList 长度
    #[pallet::storage]
    #[pallet::getter(fn followers_count)]
    pub type FollowersCount<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        Target,
        u32,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 用户关注目标 [follower, target_type(u8), target_id]
        Followed {
            follower: T::AccountId,
            target_type: u8,
            target_id: u64,
        },
        /// 取消关注目标 [follower, target_type(u8), target_id]
        Unfollowed {
            follower: T::AccountId,
            target_type: u8,
            target_id: u64,
        },
        /// 关注者被移除 [target_type(u8), target_id, removed_follower, removed_by]
        FollowerRemoved {
            target_type: u8,
            target_id: u64,
            removed_follower: T::AccountId,
            removed_by: T::AccountId,
        },
        /// 批量关注完成 [follower, targets_count, success_count]
        BatchFollowCompleted {
            follower: T::AccountId,
            targets_count: u32,
            success_count: u32,
        },
        /// 批量取消关注完成 [follower, targets_count, success_count]
        BatchUnfollowCompleted {
            follower: T::AccountId,
            targets_count: u32,
            success_count: u32,
        },
        /// 通知设置已更新 [follower, target_type(u8), target_id, enabled]
        NotificationSettingUpdated {
            follower: T::AccountId,
            target_type: u8,
            target_id: u64,
            enabled: bool,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 已经关注
        AlreadyFollowing,
        /// 未关注
        NotFollowing,
        /// 关注数量已达上限
        TooManyFollowing,
        /// 关注者数量已达上限
        TooManyFollowers,
        /// 批量操作数量过大
        BatchSizeTooLarge,
        /// 不能关注自己
        CannotFollowSelf,
        /// 目标不存在
        TargetNotExists,
        /// 无权限移除关注者
        NoPermissionToRemove,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：关注目标
        ///
        /// ### 参数
        /// - `target_type`: 目标类型（0=Deceased, 1=User, 2=Grave, 3=Pet, 4=Memorial）
        /// - `target_id`: 目标ID
        /// - `enable_notifications`: 是否启用通知（默认开启）
        ///
        /// ### 验证逻辑
        /// - 检查是否已经关注
        /// - 检查关注数量是否超限
        /// - 检查目标关注者数量是否超限
        /// - 检查目标是否存在（依据目标类型）
        ///
        /// ### 兼容性
        /// - 兼容原 pallet-deceased 的 follow_deceased 接口
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(50_000, 0))]
        pub fn follow(
            origin: OriginFor<T>,
            target_type: u8,
            target_id: u64,
            enable_notifications: Option<bool>,
        ) -> DispatchResult {
            let follower = ensure_signed(origin)?;
            let notifications_enabled = enable_notifications.unwrap_or(true);

            // 构造 Target 结构
            let target = Target {
                target_type: match target_type {
                    0 => TargetType::Deceased,
                    1 => TargetType::User,
                    2 => TargetType::Grave,
                    3 => TargetType::Pet,
                    4 => TargetType::Memorial,
                    _ => return Err(Error::<T>::TargetNotExists.into()),
                },
                target_id,
            };

            Self::do_follow(&follower, &target, notifications_enabled)
        }

        /// 函数级详细中文注释：取消关注目标
        ///
        /// ### 参数
        /// - `target_type`: 目标类型（0=Deceased, 1=User, 2=Grave, 3=Pet, 4=Memorial）
        /// - `target_id`: 要取消关注的目标ID
        ///
        /// ### 逻辑
        /// - 检查是否已关注该目标
        /// - 移除关注记录和关注者列表条目
        /// - 更新计数
        ///
        /// ### 兼容性
        /// - 兼容原 pallet-deceased 的 unfollow_deceased 接口
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(40_000, 0))]
        pub fn unfollow(
            origin: OriginFor<T>,
            target_type: u8,
            target_id: u64,
        ) -> DispatchResult {
            let follower = ensure_signed(origin)?;

            // 构造 Target 结构
            let target = Target {
                target_type: match target_type {
                    0 => TargetType::Deceased,
                    1 => TargetType::User,
                    2 => TargetType::Grave,
                    3 => TargetType::Pet,
                    4 => TargetType::Memorial,
                    _ => return Err(Error::<T>::TargetNotExists.into()),
                },
                target_id,
            };

            Self::do_unfollow(&follower, &target)
        }

        /// 函数级详细中文注释：移除关注者（目标拥有者专用）
        ///
        /// ### 参数
        /// - `target_type`: 目标类型（0=Deceased, 1=User, 2=Grave, 3=Pet, 4=Memorial）
        /// - `target_id`: 目标ID
        /// - `follower_to_remove`: 要移除的关注者
        ///
        /// ### 权限检查
        /// - 调用者必须是目标的拥有者或管理员
        /// - 根据目标类型进行权限验证
        ///
        /// ### 兼容性
        /// - 兼容原 pallet-deceased 的 remove_follower 接口
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(40_000, 0))]
        pub fn remove_follower(
            origin: OriginFor<T>,
            target_type: u8,
            target_id: u64,
            follower_to_remove: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 构造 Target 结构
            let target = Target {
                target_type: match target_type {
                    0 => TargetType::Deceased,
                    1 => TargetType::User,
                    2 => TargetType::Grave,
                    3 => TargetType::Pet,
                    4 => TargetType::Memorial,
                    _ => return Err(Error::<T>::TargetNotExists.into()),
                },
                target_id,
            };

            // 检查权限
            Self::ensure_can_manage_target(&who, &target)?;

            // 检查是否真的在关注
            ensure!(
                FollowingMap::<T>::contains_key(&follower_to_remove, &target),
                Error::<T>::NotFollowing
            );

            // 移除关注记录
            FollowingMap::<T>::remove(&follower_to_remove, &target);

            // 从关注者列表中移除
            FollowersList::<T>::mutate(&target, |list| {
                if let Some(pos) = list.iter().position(|x| x == &follower_to_remove) {
                    list.swap_remove(pos);
                }
            });

            // 更新计数
            FollowingCount::<T>::mutate(&follower_to_remove, |count| {
                *count = count.saturating_sub(1);
            });
            FollowersCount::<T>::mutate(&target, |count| {
                *count = count.saturating_sub(1);
            });

            // 发出事件
            Self::deposit_event(Event::FollowerRemoved {
                target_type: target.target_type.as_u8(),
                target_id: target.target_id,
                removed_follower: follower_to_remove,
                removed_by: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：批量关注
        ///
        /// ### 参数
        /// - `targets`: 要关注的目标列表，格式为 Vec<(target_type, target_id)>
        ///
        /// ### 逻辑
        /// - 逐个尝试关注，记录成功和失败
        /// - 不会因为单个失败而回滚整个操作
        /// - 返回成功关注的数量
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(10_000, 0).saturating_mul(targets.len() as u64))]
        pub fn batch_follow(
            origin: OriginFor<T>,
            targets: Vec<(u8, u64)>,
        ) -> DispatchResult {
            let follower = ensure_signed(origin)?;

            // 检查批量大小
            ensure!(
                targets.len() <= T::MaxBatchSize::get() as usize,
                Error::<T>::BatchSizeTooLarge
            );

            let mut success_count = 0u32;

            for (target_type, target_id) in &targets {
                // 构造 Target
                let target = Target {
                    target_type: match target_type {
                        0 => TargetType::Deceased,
                        1 => TargetType::User,
                        2 => TargetType::Grave,
                        3 => TargetType::Pet,
                        4 => TargetType::Memorial,
                        _ => continue, // 跳过无效的类型
                    },
                    target_id: *target_id,
                };

                // 逐个尝试关注，忽略错误
                if Self::do_follow(&follower, &target, true).is_ok() {
                    success_count += 1;
                }
            }

            // 发出事件
            Self::deposit_event(Event::BatchFollowCompleted {
                follower,
                targets_count: targets.len() as u32,
                success_count,
            });

            Ok(())
        }

        /// 函数级详细中文注释：批量取消关注
        ///
        /// ### 参数
        /// - `targets`: 要取消关注的目标列表，格式为 Vec<(target_type, target_id)>
        ///
        /// ### 逻辑
        /// - 逐个尝试取消关注，记录成功和失败
        /// - 不会因为单个失败而回滚整个操作
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(10_000, 0).saturating_mul(targets.len() as u64))]
        pub fn batch_unfollow(
            origin: OriginFor<T>,
            targets: Vec<(u8, u64)>,
        ) -> DispatchResult {
            let follower = ensure_signed(origin)?;

            // 检查批量大小
            ensure!(
                targets.len() <= T::MaxBatchSize::get() as usize,
                Error::<T>::BatchSizeTooLarge
            );

            let mut success_count = 0u32;

            for (target_type, target_id) in &targets {
                // 构造 Target
                let target = Target {
                    target_type: match target_type {
                        0 => TargetType::Deceased,
                        1 => TargetType::User,
                        2 => TargetType::Grave,
                        3 => TargetType::Pet,
                        4 => TargetType::Memorial,
                        _ => continue, // 跳过无效的类型
                    },
                    target_id: *target_id,
                };

                // 逐个尝试取消关注，忽略错误
                if Self::do_unfollow(&follower, &target).is_ok() {
                    success_count += 1;
                }
            }

            // 发出事件
            Self::deposit_event(Event::BatchUnfollowCompleted {
                follower,
                targets_count: targets.len() as u32,
                success_count,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新通知设置
        ///
        /// ### 参数
        /// - `target_type`: 目标类型（0=Deceased, 1=User, 2=Grave, 3=Pet, 4=Memorial）
        /// - `target_id`: 目标ID
        /// - `enabled`: 是否启用通知
        ///
        /// ### 逻辑
        /// - 只能更新已关注目标的通知设置
        /// - 更新 FollowInfo 中的 notifications_enabled 字段
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(20_000, 0))]
        pub fn update_notification_setting(
            origin: OriginFor<T>,
            target_type: u8,
            target_id: u64,
            enabled: bool,
        ) -> DispatchResult {
            let follower = ensure_signed(origin)?;

            // 构造 Target 结构
            let target = Target {
                target_type: match target_type {
                    0 => TargetType::Deceased,
                    1 => TargetType::User,
                    2 => TargetType::Grave,
                    3 => TargetType::Pet,
                    4 => TargetType::Memorial,
                    _ => return Err(Error::<T>::TargetNotExists.into()),
                },
                target_id,
            };

            // 检查是否已关注
            ensure!(
                FollowingMap::<T>::contains_key(&follower, &target),
                Error::<T>::NotFollowing
            );

            // 更新通知设置
            FollowingMap::<T>::try_mutate(&follower, &target, |info| -> DispatchResult {
                if let Some(follow_info) = info {
                    follow_info.notifications_enabled = enabled;
                    Ok(())
                } else {
                    Err(Error::<T>::NotFollowing.into())
                }
            })?;

            // 发出事件
            Self::deposit_event(Event::NotificationSettingUpdated {
                follower,
                target_type: target.target_type.as_u8(),
                target_id: target.target_id,
                enabled,
            });

            Ok(())
        }
    }

    /// 函数级详细中文注释：目标验证和权限检查 trait
    ///
    /// ### 用途
    /// - 验证目标是否存在（根据目标类型）
    /// - 检查用户是否有权限管理目标
    /// - 检查目标是否可见/公开
    ///
    /// ### 实现
    /// - runtime 层面注入具体实现
    /// - 每种目标类型需要对应的检查逻辑
    pub trait TargetValidator<AccountId> {
        /// 函数级中文注释：验证目标存在性
        fn target_exists(target: &Target) -> bool;

        /// 函数级中文注释：验证用户对目标的管理权限
        fn can_manage_target(who: &AccountId, target: &Target) -> bool;

        /// 函数级中文注释：验证目标是否可见（用于关注前检查）
        fn is_target_visible(who: &AccountId, target: &Target) -> bool;
    }

    /// 函数级详细中文注释：默认目标验证器（开发阶段）
    ///
    /// ### 注意
    /// - 这是一个占位符实现
    /// - 生产环境需要注入真实的验证逻辑
    pub struct DefaultTargetValidator;

    impl<AccountId> TargetValidator<AccountId> for DefaultTargetValidator {
        fn target_exists(_target: &Target) -> bool {
            // TODO: 集成其他 pallet 的存在性检查
            true
        }

        fn can_manage_target(_who: &AccountId, _target: &Target) -> bool {
            // TODO: 集成权限检查逻辑
            true
        }

        fn is_target_visible(_who: &AccountId, _target: &Target) -> bool {
            // TODO: 集成可见性检查逻辑
            true
        }
    }

    /// 函数级详细中文注释：私有实现函数
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：内部关注实现
        pub fn do_follow(
            follower: &T::AccountId,
            target: &Target,
            notifications_enabled: bool,
        ) -> DispatchResult {
            // 检查是否已关注
            ensure!(
                !FollowingMap::<T>::contains_key(follower, target),
                Error::<T>::AlreadyFollowing
            );

            // 检查关注数量限制
            let following_count = FollowingCount::<T>::get(follower);
            ensure!(
                following_count < T::MaxFollowingPerUser::get(),
                Error::<T>::TooManyFollowing
            );

            // 检查目标关注者数量限制
            let followers_count = FollowersCount::<T>::get(target);
            ensure!(
                followers_count < T::MaxFollowersPerTarget::get(),
                Error::<T>::TooManyFollowers
            );

            // 验证目标存在性（根据目标类型）
            Self::ensure_target_exists(target)?;

            let now = <frame_system::Pallet<T>>::block_number();

            // 创建关注记录
            let follow_info = FollowInfo {
                followed_at: now,
                notifications_enabled,
            };

            // 更新存储
            FollowingMap::<T>::insert(follower, target, follow_info);

            // 更新关注者列表
            FollowersList::<T>::try_mutate(target, |list| -> DispatchResult {
                list.try_push(follower.clone())
                    .map_err(|_| Error::<T>::TooManyFollowers)?;
                Ok(())
            })?;

            // 更新计数
            FollowingCount::<T>::mutate(follower, |count| *count += 1);
            FollowersCount::<T>::mutate(target, |count| *count += 1);

            // 发出事件
            Self::deposit_event(Event::Followed {
                follower: follower.clone(),
                target_type: target.target_type.as_u8(),
                target_id: target.target_id,
            });

            Ok(())
        }

        /// 函数级中文注释：内部取消关注实现
        pub fn do_unfollow(follower: &T::AccountId, target: &Target) -> DispatchResult {
            // 检查是否已关注
            ensure!(
                FollowingMap::<T>::contains_key(follower, target),
                Error::<T>::NotFollowing
            );

            // 移除关注记录
            FollowingMap::<T>::remove(follower, target);

            // 从关注者列表中移除
            FollowersList::<T>::mutate(target, |list| {
                if let Some(pos) = list.iter().position(|x| x == follower) {
                    list.swap_remove(pos);
                }
            });

            // 更新计数
            FollowingCount::<T>::mutate(follower, |count| {
                *count = count.saturating_sub(1);
            });
            FollowersCount::<T>::mutate(target, |count| {
                *count = count.saturating_sub(1);
            });

            // 发出事件
            Self::deposit_event(Event::Unfollowed {
                follower: follower.clone(),
                target_type: target.target_type.as_u8(),
                target_id: target.target_id,
            });

            Ok(())
        }

        /// 函数级中文注释：验证目标存在性
        fn ensure_target_exists(target: &Target) -> DispatchResult {
            ensure!(
                T::TargetValidator::target_exists(target),
                Error::<T>::TargetNotExists
            );
            Ok(())
        }

        /// 函数级中文注释：验证管理权限
        fn ensure_can_manage_target(who: &T::AccountId, target: &Target) -> DispatchResult {
            ensure!(
                T::TargetValidator::can_manage_target(who, target),
                Error::<T>::NoPermissionToRemove
            );
            Ok(())
        }
    }

    /// 函数级详细中文注释：兼容性接口（为 pallet-deceased 迁移提供）
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：获取逝者关注者列表（兼容接口）
        ///
        /// ### 迁移策略
        /// - 优先返回 pallet-social 中的数据
        /// - 如果没有数据，可能需要从 pallet-deceased 查询（迁移阶段）
        pub fn get_deceased_followers(deceased_id: u64) -> Vec<T::AccountId> {
            let target = Target::deceased(deceased_id);
            FollowersList::<T>::get(&target).into_inner()
        }

        /// 函数级中文注释：检查是否关注逝者（兼容接口）
        ///
        /// ### 迁移策略
        /// - 优先检查 pallet-social 中的数据
        /// - 如果没有数据，可能需要检查 pallet-deceased（迁移阶段）
        pub fn is_following_deceased(follower: &T::AccountId, deceased_id: u64) -> bool {
            let target = Target::deceased(deceased_id);
            FollowingMap::<T>::contains_key(follower, &target)
        }

        /// 函数级中文注释：获取逝者关注者数量（兼容接口）
        pub fn get_deceased_followers_count(deceased_id: u64) -> u32 {
            let target = Target::deceased(deceased_id);
            FollowersCount::<T>::get(&target)
        }

        /// 函数级中文注释：关注逝者（兼容接口）
        ///
        /// ### 用途
        /// - 供其他 pallet 调用的内部接口
        /// - 验证逻辑由调用方负责
        pub fn follow_deceased_internal(
            follower: &T::AccountId,
            deceased_id: u64,
        ) -> DispatchResult {
            let target = Target::deceased(deceased_id);
            Self::do_follow(follower, &target, true)
        }

        /// 函数级中文注释：取消关注逝者（兼容接口）
        pub fn unfollow_deceased_internal(
            follower: &T::AccountId,
            deceased_id: u64,
        ) -> DispatchResult {
            let target = Target::deceased(deceased_id);
            Self::do_unfollow(follower, &target)
        }

        /// 函数级中文注释：数据迁移辅助函数 - 从其他来源迁移关注数据
        ///
        /// ### 用途
        /// - 迁移阶段使用，将旧的关注数据迁移到新系统
        /// - 仅限 runtime migration 或特权调用
        pub fn migrate_followers_from_external(
            target: Target,
            followers: &[T::AccountId],
        ) -> DispatchResult {
            // 验证目标存在
            Self::ensure_target_exists(&target)?;

            let now = <frame_system::Pallet<T>>::block_number();
            let mut success_count = 0u32;

            for follower in followers {
                // 检查是否已经存在
                if FollowingMap::<T>::contains_key(follower, &target) {
                    continue;
                }

                // 检查容量限制
                let followers_count = FollowersCount::<T>::get(&target);
                if followers_count >= T::MaxFollowersPerTarget::get() {
                    break;
                }

                let following_count = FollowingCount::<T>::get(follower);
                if following_count >= T::MaxFollowingPerUser::get() {
                    continue;
                }

                // 创建关注记录
                let follow_info = FollowInfo {
                    followed_at: now,
                    notifications_enabled: true, // 默认开启通知
                };

                // 添加到存储
                FollowingMap::<T>::insert(follower, &target, follow_info);

                // 更新关注者列表
                if let Ok(_) = FollowersList::<T>::try_mutate(&target, |list| -> DispatchResult {
                    list.try_push(follower.clone())
                        .map_err(|_| Error::<T>::TooManyFollowers)?;
                    Ok(())
                }) {
                    // 更新计数
                    FollowingCount::<T>::mutate(follower, |count| *count += 1);
                    FollowersCount::<T>::mutate(&target, |count| *count += 1);
                    success_count += 1;
                }
            }

            // 迁移完成事件（可选）
            if success_count > 0 {
                // 可以添加一个迁移完成事件
                log::info!(
                    "Migrated {} followers for target {:?}",
                    success_count,
                    target
                );
            }

            Ok(())
        }

        /// 函数级中文注释：检查是否需要从外部数据源迁移
        ///
        /// ### 用途
        /// - 在查询时检查是否有遗漏的关注数据需要迁移
        /// - 渐进式迁移策略的一部分
        pub fn should_migrate_for_target(target: &Target) -> bool {
            // 如果 social 中没有任何关注者，但目标类型是 Deceased，可能需要迁移
            match target.target_type {
                TargetType::Deceased => {
                    FollowersCount::<T>::get(target) == 0
                }
                _ => false,
            }
        }
    }
}

/// 函数级详细中文注释：为 Pallet<T> 实现 SocialInterface
///
/// ### 实现目标
/// - 提供对外接口，让其他 pallet 能够调用社交功能
/// - 避免循环依赖，通过 trait 进行解耦
/// - 特化处理逝者相关的关注功能
impl<T: Config> SocialInterface<T::AccountId> for Pallet<T> {
    /// 函数级中文注释：内部关注逝者接口实现
    fn follow_deceased_internal(
        follower: &T::AccountId,
        deceased_id: u64,
    ) -> Result<(), sp_runtime::DispatchError> {
        let target = Target::deceased(deceased_id);
        // 调用内部关注逻辑
        Self::do_follow(follower, &target, true)
    }

    /// 函数级中文注释：内部取消关注逝者接口实现
    fn unfollow_deceased_internal(
        follower: &T::AccountId,
        deceased_id: u64,
    ) -> Result<(), sp_runtime::DispatchError> {
        let target = Target::deceased(deceased_id);
        // 调用内部取消关注逻辑
        Self::do_unfollow(follower, &target)
    }

    /// 函数级中文注释：移除关注者接口实现
    fn remove_follower_by_target(
        follower: &T::AccountId,
        target_id: u64,
    ) -> Result<(), sp_runtime::DispatchError> {
        let target = Target {
            target_type: TargetType::Deceased,
            target_id,
        };

        // 检查关注关系是否存在
        ensure!(
            FollowingMap::<T>::contains_key(follower, &target),
            Error::<T>::NotFollowing
        );

        // 调用内部取消关注逻辑（这里复用取消关注的逻辑）
        Self::do_unfollow(follower, &target)
    }

    /// 函数级中文注释：获取逝者关注者列表
    fn get_deceased_followers(deceased_id: u64) -> Vec<T::AccountId> {
        let target = Target {
            target_type: TargetType::Deceased,
            target_id: deceased_id,
        };

        FollowersList::<T>::get(&target).into_inner()
    }

    /// 函数级中文注释：检查是否关注逝者
    fn is_following_deceased(follower: &T::AccountId, deceased_id: u64) -> bool {
        let target = Target {
            target_type: TargetType::Deceased,
            target_id: deceased_id,
        };

        FollowingMap::<T>::contains_key(follower, &target)
    }

    /// 函数级中文注释：获取逝者关注者数量
    fn get_deceased_followers_count(deceased_id: u64) -> u32 {
        let target = Target {
            target_type: TargetType::Deceased,
            target_id: deceased_id,
        };

        FollowersCount::<T>::get(&target)
    }
}