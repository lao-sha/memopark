# OTC订单KYC认证 - 实现指南

## 🚀 快速开始

本指南提供OTC订单KYC认证功能的具体实现步骤。

---

## 📁 文件结构

```
pallets/otc-order/
├── src/
│   ├── lib.rs          # 主要逻辑
│   ├── types.rs        # 类型定义
│   ├── kyc.rs          # KYC验证逻辑
│   └── weights.rs      # 权重定义
├── Cargo.toml
└── README.md

docs/
└── OTC-KYC认证方案.md  # 详细方案文档
```

---

## 🔧 步骤1：添加依赖

### Cargo.toml

```toml
[dependencies]
# 基础依赖
codec = { package = "parity-scale-codec", version = "3.6.1", default-features = false, features = ["derive"] }
scale-info = { version = "2.5.0", default-features = false, features = ["derive"] }

# Substrate框架
frame-benchmarking = { version = "4.0.0-dev", default-features = false, optional = true }
frame-support = { version = "4.0.0-dev", default-features = false }
frame-system = { version = "4.0.0-dev", default-features = false }
sp-runtime = { version = "7.0.0", default-features = false }
sp-std = { version = "8.0.0", default-features = false }

# 身份认证依赖
pallet-identity = { version = "4.0.0-dev", default-features = false }
pallet-collective = { version = "4.0.0-dev", default-features = false }

[features]
default = ["std"]
std = [
    "codec/std",
    "frame-benchmarking?/std",
    "frame-support/std",
    "frame-system/std",
    "pallet-identity/std",
    "pallet-collective/std",
    "scale-info/std",
    "sp-runtime/std",
    "sp-std/std",
]
runtime-benchmarks = ["frame-benchmarking/runtime-benchmarks"]
try-runtime = ["frame-support/try-runtime"]
```

---

## 📋 步骤2：类型定义

### src/types.rs

```rust
//! OTC订单KYC认证相关类型定义

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;
use frame_system::pallet_prelude::BlockNumberFor;

/// KYC配置结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct KycConfig<BlockNumber> {
    /// 是否启用KYC要求
    pub enabled: bool,
    /// 创建OTC订单的最低认证等级
    pub min_judgment_level: pallet_identity::Judgement<u32>,
    /// 配置生效的区块高度
    pub effective_block: BlockNumber,
    /// 最后更新时间
    pub updated_at: BlockNumber,
}

impl<BlockNumber: Default> Default for KycConfig<BlockNumber> {
    fn default() -> Self {
        Self {
            enabled: false,
            min_judgment_level: pallet_identity::Judgement::Reasonable,
            effective_block: BlockNumber::default(),
            updated_at: BlockNumber::default(),
        }
    }
}

/// OTC订单结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct OtcOrder<AccountId, Balance, BlockNumber> {
    /// 创建者
    pub creator: AccountId,
    /// 出售资产ID
    pub asset_give: u32,
    /// 出售资产数量
    pub amount_give: Balance,
    /// 购买资产ID
    pub asset_want: u32,
    /// 购买资产数量
    pub amount_want: Balance,
    /// 订单状态
    pub status: OrderStatus,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 是否自动匹配
    pub auto_match: bool,
    /// KYC验证状态（记录创建时的KYC状态）
    pub kyc_verified: bool,
}

/// 订单状态枚举
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum OrderStatus {
    /// 活跃订单
    Active,
    /// 已完成
    Completed,
    /// 已取消
    Cancelled,
    /// 部分成交
    PartiallyFilled,
}

impl Default for OrderStatus {
    fn default() -> Self {
        Self::Active
    }
}

/// KYC验证结果
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, RuntimeDebug)]
pub enum KycVerificationResult {
    /// 验证通过
    Passed,
    /// 验证失败：KYC未启用但用户具备认证
    Failed(KycFailureReason),
    /// 豁免：用户在豁免列表中
    Exempted,
    /// 跳过：KYC未启用
    Skipped,
}

/// KYC验证失败原因
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, RuntimeDebug)]
pub enum KycFailureReason {
    /// 未设置身份信息
    IdentityNotSet,
    /// 没有有效的身份判断
    NoValidJudgement,
    /// 认证等级不足
    InsufficientLevel {
        required: pallet_identity::Judgement<u32>,
        current: Option<pallet_identity::Judgement<u32>>,
    },
    /// 身份认证质量问题
    QualityIssue(pallet_identity::Judgement<u32>),
}
```

---

## 🔐 步骤3：KYC验证逻辑

### src/kyc.rs

```rust
//! KYC验证相关逻辑实现

use crate::{Config, Error, Event, KycConfig, KycVerificationResult, KycFailureReason};
use frame_support::pallet_prelude::*;
use pallet_identity::Judgement;

impl<T: Config> crate::Pallet<T> {
    /// 检查用户是否满足KYC要求
    pub fn verify_kyc(who: &T::AccountId) -> KycVerificationResult {
        // 获取当前KYC配置
        let config = KycConfig::<T>::get();

        // 如果KYC未启用，直接跳过
        if !config.enabled {
            return KycVerificationResult::Skipped;
        }

        // 检查是否为豁免账户
        if Self::is_kyc_exempt(who) {
            return KycVerificationResult::Exempted;
        }

        // 验证身份认证状态
        match Self::check_identity_judgement(who, &config.min_judgment_level) {
            Ok(()) => KycVerificationResult::Passed,
            Err(reason) => KycVerificationResult::Failed(reason),
        }
    }

    /// 检查身份认证判断是否满足要求
    fn check_identity_judgement(
        who: &T::AccountId,
        min_level: &Judgement<u32>,
    ) -> Result<(), KycFailureReason> {
        // 获取用户身份信息
        let identity_info = pallet_identity::IdentityOf::<T>::get(who)
            .ok_or(KycFailureReason::IdentityNotSet)?;

        // 检查身份判断
        let judgements = &identity_info.judgements;
        if judgements.is_empty() {
            return Err(KycFailureReason::NoValidJudgement);
        }

        // 找到最好的判断
        let best_judgement = judgements
            .iter()
            .map(|(_, judgement)| judgement)
            .max_by_key(|j| Self::judgement_priority(j))
            .unwrap(); // judgements不为空，所以这里可以unwrap

        // 检查是否为问题判断
        if Self::is_problematic_judgement(best_judgement) {
            return Err(KycFailureReason::QualityIssue(best_judgement.clone()));
        }

        // 检查等级是否足够
        if Self::judgement_priority(best_judgement) >= Self::judgement_priority(min_level) {
            Ok(())
        } else {
            Err(KycFailureReason::InsufficientLevel {
                required: min_level.clone(),
                current: Some(best_judgement.clone()),
            })
        }
    }

    /// 获取判断的优先级（数字越大等级越高）
    pub fn judgement_priority(judgement: &Judgement<u32>) -> u8 {
        match judgement {
            Judgement::Unknown => 0,
            Judgement::FeePaid(_) => 1,
            Judgement::Reasonable => 2,
            Judgement::KnownGood => 3,
            Judgement::OutOfDate => 1,      // 过期等同于付费请求
            Judgement::LowQuality => 0,     // 低质量等同于未知
            Judgement::Erroneous => 0,      // 错误等同于未知
        }
    }

    /// 检查是否为有问题的判断
    fn is_problematic_judgement(judgement: &Judgement<u32>) -> bool {
        matches!(
            judgement,
            Judgement::LowQuality | Judgement::Erroneous
        )
    }

    /// 检查账户是否为KYC豁免账户
    pub fn is_kyc_exempt(who: &T::AccountId) -> bool {
        crate::KycExemptAccounts::<T>::contains_key(who)
    }

    /// 强制执行KYC检查（创建订单时使用）
    pub fn enforce_kyc_requirement(who: &T::AccountId) -> DispatchResult {
        match Self::verify_kyc(who) {
            KycVerificationResult::Passed |
            KycVerificationResult::Exempted |
            KycVerificationResult::Skipped => Ok(()),

            KycVerificationResult::Failed(reason) => {
                // 发出KYC验证失败事件
                Self::deposit_event(Event::KycVerificationFailed {
                    account: who.clone(),
                    reason: reason.clone(),
                });

                // 返回对应的错误
                match reason {
                    KycFailureReason::IdentityNotSet =>
                        Err(Error::<T>::IdentityNotSet.into()),
                    KycFailureReason::NoValidJudgement =>
                        Err(Error::<T>::NoValidJudgement.into()),
                    KycFailureReason::InsufficientLevel { .. } =>
                        Err(Error::<T>::InsufficientKycLevel.into()),
                    KycFailureReason::QualityIssue(_) =>
                        Err(Error::<T>::IdentityQualityIssue.into()),
                }
            }
        }
    }
}
```

---

## 🏗️ 步骤4：主要Pallet实现

### src/lib.rs

```rust
#![cfg_attr(not(feature = "std"), no_std)]

//! # OTC订单 Pallet（集成KYC认证）
//!
//! 提供OTC（场外交易）订单功能，集成基于pallet-identity的KYC认证机制

pub use pallet::*;

mod types;
mod kyc;

pub use types::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod weights;
pub use weights::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::{Zero, Saturating, AccountIdConversion};
    use frame_support::{
        traits::{Currency, ReservableCurrency, ExistenceRequirement},
        PalletId,
    };

    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_identity::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 货币系统
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

        /// 委员会起源（用于KYC配置管理）
        type CommitteeOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Pallet ID
        #[pallet::constant]
        type PalletId: Get<PalletId>;

        /// 订单创建保证金
        #[pallet::constant]
        type OrderDeposit: Get<BalanceOf<Self>>;

        /// 权重信息
        type WeightInfo: WeightInfo;
    }

    /// KYC配置存储
    #[pallet::storage]
    pub type KycConfig<T: Config> = StorageValue<
        _,
        super::KycConfig<BlockNumberFor<T>>,
        ValueQuery,
    >;

    /// KYC豁免账户列表
    #[pallet::storage]
    pub type KycExemptAccounts<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        (),
        OptionQuery,
    >;

    /// OTC订单存储
    #[pallet::storage]
    pub type OtcOrders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        OtcOrder<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 下一个订单ID
    #[pallet::storage]
    pub type NextOrderId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 用户的活跃订单列表
    #[pallet::storage]
    pub type UserOrders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, ConstU32<100>>,
        ValueQuery,
    >;

    #[pallet::genesis_config]
    pub struct GenesisConfig<T: Config> {
        /// 初始KYC配置
        pub kyc_config: super::KycConfig<BlockNumberFor<T>>,
        /// 初始豁免账户
        pub exempt_accounts: Vec<T::AccountId>,
    }

    impl<T: Config> Default for GenesisConfig<T> {
        fn default() -> Self {
            Self {
                kyc_config: Default::default(),
                exempt_accounts: Default::default(),
            }
        }
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            KycConfig::<T>::put(&self.kyc_config);

            for account in &self.exempt_accounts {
                KycExemptAccounts::<T>::insert(account, ());
            }
        }
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// KYC要求已启用
        KycEnabled {
            min_judgment_level: pallet_identity::Judgement<u32>,
        },
        /// KYC要求已禁用
        KycDisabled,
        /// KYC最低等级已更新
        KycLevelUpdated {
            new_level: pallet_identity::Judgement<u32>,
        },
        /// 账户被添加到KYC豁免列表
        AccountExemptedFromKyc {
            account: T::AccountId,
        },
        /// 账户从KYC豁免列表中移除
        AccountRemovedFromKycExemption {
            account: T::AccountId,
        },
        /// OTC订单创建成功
        OtcOrderCreated {
            order_id: u64,
            creator: T::AccountId,
            asset_give: u32,
            amount_give: BalanceOf<T>,
            asset_want: u32,
            amount_want: BalanceOf<T>,
            kyc_verified: bool,
        },
        /// OTC订单被取消
        OtcOrderCancelled {
            order_id: u64,
            creator: T::AccountId,
        },
        /// KYC验证失败
        KycVerificationFailed {
            account: T::AccountId,
            reason: KycFailureReason,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 未设置身份信息
        IdentityNotSet,
        /// 没有有效的身份判断
        NoValidJudgement,
        /// KYC认证等级不足
        InsufficientKycLevel,
        /// 身份认证质量问题
        IdentityQualityIssue,
        /// 账户已在豁免列表中
        AccountAlreadyExempted,
        /// 账户不在豁免列表中
        AccountNotExempted,
        /// 订单不存在
        OrderNotFound,
        /// 无权限操作订单
        NotOrderOwner,
        /// 无效的订单金额
        InvalidAmount,
        /// 订单状态不允许此操作
        InvalidOrderStatus,
        /// 保证金不足
        InsufficientDeposit,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 启用KYC要求
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::enable_kyc_requirement())]
        pub fn enable_kyc_requirement(
            origin: OriginFor<T>,
            min_judgment_level: pallet_identity::Judgement<u32>,
        ) -> DispatchResult {
            T::CommitteeOrigin::ensure_origin(origin)?;

            let current_block = <frame_system::Pallet<T>>::block_number();
            let config = super::KycConfig {
                enabled: true,
                min_judgment_level: min_judgment_level.clone(),
                effective_block: current_block,
                updated_at: current_block,
            };

            KycConfig::<T>::put(config);

            Self::deposit_event(Event::KycEnabled { min_judgment_level });
            Ok(())
        }

        /// 禁用KYC要求
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::disable_kyc_requirement())]
        pub fn disable_kyc_requirement(origin: OriginFor<T>) -> DispatchResult {
            T::CommitteeOrigin::ensure_origin(origin)?;

            let current_block = <frame_system::Pallet<T>>::block_number();
            KycConfig::<T>::mutate(|config| {
                config.enabled = false;
                config.effective_block = current_block;
                config.updated_at = current_block;
            });

            Self::deposit_event(Event::KycDisabled);
            Ok(())
        }

        /// 更新最低认证等级
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::update_min_judgment_level())]
        pub fn update_min_judgment_level(
            origin: OriginFor<T>,
            new_level: pallet_identity::Judgement<u32>,
        ) -> DispatchResult {
            T::CommitteeOrigin::ensure_origin(origin)?;

            let current_block = <frame_system::Pallet<T>>::block_number();
            KycConfig::<T>::mutate(|config| {
                config.min_judgment_level = new_level.clone();
                config.effective_block = current_block;
                config.updated_at = current_block;
            });

            Self::deposit_event(Event::KycLevelUpdated { new_level });
            Ok(())
        }

        /// 将账户添加到KYC豁免列表
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::exempt_account_from_kyc())]
        pub fn exempt_account_from_kyc(
            origin: OriginFor<T>,
            account: T::AccountId,
        ) -> DispatchResult {
            T::CommitteeOrigin::ensure_origin(origin)?;

            ensure!(
                !KycExemptAccounts::<T>::contains_key(&account),
                Error::<T>::AccountAlreadyExempted
            );

            KycExemptAccounts::<T>::insert(&account, ());

            Self::deposit_event(Event::AccountExemptedFromKyc { account });
            Ok(())
        }

        /// 从KYC豁免列表移除账户
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::remove_kyc_exemption())]
        pub fn remove_kyc_exemption(
            origin: OriginFor<T>,
            account: T::AccountId,
        ) -> DispatchResult {
            T::CommitteeOrigin::ensure_origin(origin)?;

            ensure!(
                KycExemptAccounts::<T>::contains_key(&account),
                Error::<T>::AccountNotExempted
            );

            KycExemptAccounts::<T>::remove(&account);

            Self::deposit_event(Event::AccountRemovedFromKycExemption { account });
            Ok(())
        }

        /// 创建OTC订单（集成KYC检查）
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::create_otc_order())]
        pub fn create_otc_order(
            origin: OriginFor<T>,
            asset_give: u32,
            amount_give: BalanceOf<T>,
            asset_want: u32,
            amount_want: BalanceOf<T>,
            auto_match: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // KYC验证检查
            let kyc_result = Self::verify_kyc(&who);
            Self::enforce_kyc_requirement(&who)?;

            // 业务逻辑验证
            ensure!(!amount_give.is_zero(), Error::<T>::InvalidAmount);
            ensure!(!amount_want.is_zero(), Error::<T>::InvalidAmount);

            // 收取保证金
            let deposit = T::OrderDeposit::get();
            T::Currency::reserve(&who, deposit).map_err(|_| Error::<T>::InsufficientDeposit)?;

            // 创建订单
            let order_id = NextOrderId::<T>::get();
            let current_block = <frame_system::Pallet<T>>::block_number();

            let kyc_verified = matches!(
                kyc_result,
                KycVerificationResult::Passed |
                KycVerificationResult::Exempted
            );

            let order = OtcOrder {
                creator: who.clone(),
                asset_give,
                amount_give,
                asset_want,
                amount_want,
                status: OrderStatus::Active,
                created_at: current_block,
                auto_match,
                kyc_verified,
            };

            // 存储订单
            OtcOrders::<T>::insert(order_id, &order);
            NextOrderId::<T>::put(order_id.saturating_add(1));

            // 更新用户订单列表
            UserOrders::<T>::mutate(&who, |orders| {
                let _ = orders.try_push(order_id);
            });

            Self::deposit_event(Event::OtcOrderCreated {
                order_id,
                creator: who,
                asset_give,
                amount_give,
                asset_want,
                amount_want,
                kyc_verified,
            });

            Ok(())
        }

        /// 取消OTC订单
        #[pallet::call_index(6)]
        #[pallet::weight(T::WeightInfo::cancel_otc_order())]
        pub fn cancel_otc_order(
            origin: OriginFor<T>,
            order_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            OtcOrders::<T>::try_mutate(order_id, |maybe_order| -> DispatchResult {
                let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;

                ensure!(order.creator == who, Error::<T>::NotOrderOwner);
                ensure!(order.status == OrderStatus::Active, Error::<T>::InvalidOrderStatus);

                // 更新订单状态
                order.status = OrderStatus::Cancelled;

                // 退还保证金
                let deposit = T::OrderDeposit::get();
                T::Currency::unreserve(&who, deposit);

                // 从用户订单列表中移除
                UserOrders::<T>::mutate(&who, |orders| {
                    orders.retain(|&id| id != order_id);
                });

                Self::deposit_event(Event::OtcOrderCancelled {
                    order_id,
                    creator: who,
                });

                Ok(())
            })
        }
    }
}
```

---

## ⚖️ 步骤5：Runtime集成

### runtime/src/configs/mod.rs

```rust
use frame_support::{
    parameter_types,
    traits::{EnsureOrigin, EitherOfDiverse},
    PalletId,
};
use frame_system::EnsureRoot;
use pallet_collective::EnsureProportionAtLeast;

// OTC订单相关参数
parameter_types! {
    pub const OtcOrderPalletId: PalletId = PalletId(*b"py/otcor");
    pub const OtcOrderDeposit: Balance = 10 * UNIT;  // 10 DUST 保证金
}

// 委员会类型别名
type CommitteeInstance = pallet_collective::Instance1;

impl pallet_otc_order::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;

    // 委员会或Root可以管理KYC配置
    type CommitteeOrigin = EitherOfDiverse<
        EnsureRoot<AccountId>,
        EnsureProportionAtLeast<AccountId, CommitteeInstance, 2, 3>,
    >;

    type PalletId = OtcOrderPalletId;
    type OrderDeposit = OtcOrderDeposit;
    type WeightInfo = pallet_otc_order::weights::SubstrateWeight<Runtime>;
}
```

### runtime/src/lib.rs

```rust
// 添加到construct_runtime!宏中
construct_runtime!(
    pub enum Runtime
    {
        // ... 现有pallets

        // 身份系统
        Identity: pallet_identity,

        // 治理
        Council: pallet_collective::<Instance1>,

        // OTC订单（带KYC）
        OtcOrder: pallet_otc_order,
    }
);
```

---

## 🧪 步骤6：测试实现

### src/tests.rs

```rust
use crate::mock::*;
use crate::{Error, Event};
use frame_support::{assert_ok, assert_noop, traits::OnInitialize};
use pallet_identity::Judgement;

/// 辅助函数：设置用户身份
fn setup_identity_with_judgement(who: &AccountId, judgement: Judgement<u32>) {
    // 设置身份信息
    let identity_info = pallet_identity::IdentityInfo {
        display: pallet_identity::Data::Raw(b"Test User".to_vec().try_into().unwrap()),
        legal: pallet_identity::Data::None,
        web: pallet_identity::Data::None,
        riot: pallet_identity::Data::None,
        email: pallet_identity::Data::None,
        pgp_fingerprint: None,
        image: pallet_identity::Data::None,
        twitter: pallet_identity::Data::None,
    };

    assert_ok!(Identity::set_identity(
        RuntimeOrigin::signed(*who),
        Box::new(identity_info)
    ));

    // 注册员提供判断
    assert_ok!(Identity::provide_judgement(
        RuntimeOrigin::signed(1), // 假设1是注册员
        0,                        // reg_index
        *who,
        judgement,
        H256::zero(),             // identity_hash
    ));
}

#[test]
fn kyc_disabled_allows_order_creation() {
    ExtBuilder::default().build_and_execute(|| {
        // 默认KYC应该是禁用的
        assert!(!crate::KycConfig::<Test>::get().enabled);

        // 未设置身份的用户应该能创建订单
        assert_ok!(OtcOrder::create_otc_order(
            RuntimeOrigin::signed(ALICE),
            1, // asset_give
            100,
            2, // asset_want
            200,
            false, // auto_match
        ));

        // 检查事件
        System::assert_last_event(
            Event::OtcOrderCreated {
                order_id: 0,
                creator: ALICE,
                asset_give: 1,
                amount_give: 100,
                asset_want: 2,
                amount_want: 200,
                kyc_verified: false, // KYC跳过，所以是false
            }
            .into(),
        );
    });
}

#[test]
fn kyc_enabled_requires_identity() {
    ExtBuilder::default().build_and_execute(|| {
        // 启用KYC
        assert_ok!(OtcOrder::enable_kyc_requirement(
            RuntimeOrigin::signed(COUNCIL),
            Judgement::Reasonable,
        ));

        // 未设置身份的用户不能创建订单
        assert_noop!(
            OtcOrder::create_otc_order(
                RuntimeOrigin::signed(ALICE),
                1,
                100,
                2,
                200,
                false,
            ),
            Error::<Test>::IdentityNotSet
        );
    });
}

#[test]
fn sufficient_kyc_level_allows_order_creation() {
    ExtBuilder::default().build_and_execute(|| {
        // 设置身份并获得高等级认证
        setup_identity_with_judgement(&ALICE, Judgement::KnownGood);

        // 启用KYC，要求Reasonable等级
        assert_ok!(OtcOrder::enable_kyc_requirement(
            RuntimeOrigin::signed(COUNCIL),
            Judgement::Reasonable,
        ));

        // KnownGood > Reasonable，应该允许创建订单
        assert_ok!(OtcOrder::create_otc_order(
            RuntimeOrigin::signed(ALICE),
            1,
            100,
            2,
            200,
            false,
        ));

        // 检查KYC验证状态
        System::assert_last_event(
            Event::OtcOrderCreated {
                order_id: 0,
                creator: ALICE,
                asset_give: 1,
                amount_give: 100,
                asset_want: 2,
                amount_want: 200,
                kyc_verified: true, // 应该通过KYC验证
            }
            .into(),
        );
    });
}

#[test]
fn insufficient_kyc_level_blocks_order_creation() {
    ExtBuilder::default().build_and_execute(|| {
        // 设置身份但只有FeePaid等级
        setup_identity_with_judgement(&ALICE, Judgement::FeePaid(0));

        // 启用KYC，要求Reasonable等级
        assert_ok!(OtcOrder::enable_kyc_requirement(
            RuntimeOrigin::signed(COUNCIL),
            Judgement::Reasonable,
        ));

        // FeePaid < Reasonable，应该被拒绝
        assert_noop!(
            OtcOrder::create_otc_order(
                RuntimeOrigin::signed(ALICE),
                1,
                100,
                2,
                200,
                false,
            ),
            Error::<Test>::InsufficientKycLevel
        );
    });
}

#[test]
fn kyc_exemption_works() {
    ExtBuilder::default().build_and_execute(|| {
        // 启用KYC
        assert_ok!(OtcOrder::enable_kyc_requirement(
            RuntimeOrigin::signed(COUNCIL),
            Judgement::KnownGood,
        ));

        // 将Alice加入豁免列表
        assert_ok!(OtcOrder::exempt_account_from_kyc(
            RuntimeOrigin::signed(COUNCIL),
            ALICE,
        ));

        // 即使没有身份认证，豁免账户也应该能创建订单
        assert_ok!(OtcOrder::create_otc_order(
            RuntimeOrigin::signed(ALICE),
            1,
            100,
            2,
            200,
            false,
        ));
    });
}

#[test]
fn committee_can_manage_kyc_config() {
    ExtBuilder::default().build_and_execute(|| {
        // 启用KYC
        assert_ok!(OtcOrder::enable_kyc_requirement(
            RuntimeOrigin::signed(COUNCIL),
            Judgement::Reasonable,
        ));

        let config = crate::KycConfig::<Test>::get();
        assert!(config.enabled);
        assert_eq!(config.min_judgment_level, Judgement::Reasonable);

        // 更新等级
        assert_ok!(OtcOrder::update_min_judgment_level(
            RuntimeOrigin::signed(COUNCIL),
            Judgement::KnownGood,
        ));

        let config = crate::KycConfig::<Test>::get();
        assert_eq!(config.min_judgment_level, Judgement::KnownGood);

        // 禁用KYC
        assert_ok!(OtcOrder::disable_kyc_requirement(
            RuntimeOrigin::signed(COUNCIL),
        ));

        let config = crate::KycConfig::<Test>::get();
        assert!(!config.enabled);
    });
}

#[test]
fn non_committee_cannot_manage_kyc() {
    ExtBuilder::default().build_and_execute(|| {
        // 普通用户不能管理KYC配置
        assert_noop!(
            OtcOrder::enable_kyc_requirement(
                RuntimeOrigin::signed(ALICE),
                Judgement::Reasonable,
            ),
            sp_runtime::DispatchError::BadOrigin
        );
    });
}

#[test]
fn problematic_judgements_are_rejected() {
    ExtBuilder::default().build_and_execute(|| {
        // 设置低质量身份认证
        setup_identity_with_judgement(&ALICE, Judgement::LowQuality);

        // 启用KYC
        assert_ok!(OtcOrder::enable_kyc_requirement(
            RuntimeOrigin::signed(COUNCIL),
            Judgement::Reasonable,
        ));

        // 低质量认证应该被拒绝
        assert_noop!(
            OtcOrder::create_otc_order(
                RuntimeOrigin::signed(ALICE),
                1,
                100,
                2,
                200,
                false,
            ),
            Error::<Test>::IdentityQualityIssue
        );
    });
}
```

---

## 📚 步骤7：权重定义

### src/weights.rs

```rust
//! 权重定义模板

use frame_support::{traits::Get, weights::Weight};
use sp_std::marker::PhantomData;

/// 权重实现trait
pub trait WeightInfo {
    fn enable_kyc_requirement() -> Weight;
    fn disable_kyc_requirement() -> Weight;
    fn update_min_judgment_level() -> Weight;
    fn exempt_account_from_kyc() -> Weight;
    fn remove_kyc_exemption() -> Weight;
    fn create_otc_order() -> Weight;
    fn cancel_otc_order() -> Weight;
}

/// 测试用权重实现
pub struct SubstrateWeight<T>(PhantomData<T>);
impl<T: frame_system::Config> WeightInfo for SubstrateWeight<T> {
    fn enable_kyc_requirement() -> Weight {
        Weight::from_parts(20_000_000, 0)
            .saturating_add(T::DbWeight::get().reads(1))
            .saturating_add(T::DbWeight::get().writes(1))
    }

    fn disable_kyc_requirement() -> Weight {
        Weight::from_parts(15_000_000, 0)
            .saturating_add(T::DbWeight::get().reads(1))
            .saturating_add(T::DbWeight::get().writes(1))
    }

    fn update_min_judgment_level() -> Weight {
        Weight::from_parts(15_000_000, 0)
            .saturating_add(T::DbWeight::get().reads(1))
            .saturating_add(T::DbWeight::get().writes(1))
    }

    fn exempt_account_from_kyc() -> Weight {
        Weight::from_parts(25_000_000, 0)
            .saturating_add(T::DbWeight::get().reads(1))
            .saturating_add(T::DbWeight::get().writes(1))
    }

    fn remove_kyc_exemption() -> Weight {
        Weight::from_parts(20_000_000, 0)
            .saturating_add(T::DbWeight::get().reads(1))
            .saturating_add(T::DbWeight::get().writes(1))
    }

    fn create_otc_order() -> Weight {
        Weight::from_parts(50_000_000, 0)
            .saturating_add(T::DbWeight::get().reads(5)) // KYC + Identity + Order checks
            .saturating_add(T::DbWeight::get().writes(3)) // Order + NextOrderId + UserOrders
    }

    fn cancel_otc_order() -> Weight {
        Weight::from_parts(30_000_000, 0)
            .saturating_add(T::DbWeight::get().reads(2))
            .saturating_add(T::DbWeight::get().writes(2))
    }
}
```

---

## 🚀 步骤8：部署配置

### chain_spec.rs 示例

```rust
use pallet_otc_order::{KycConfig, GenesisConfig as OtcOrderGenesisConfig};
use pallet_identity::Judgement;

pub fn development_config() -> Result<ChainSpec, String> {
    let wasm_binary = WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?;

    Ok(ChainSpec::from_genesis(
        "Development",
        "dev",
        ChainType::Development,
        move || {
            testnet_genesis(
                wasm_binary,
                vec![
                    // 开发测试账户
                    get_account_id_from_seed::<sr25519::Public>("Alice"),
                    get_account_id_from_seed::<sr25519::Public>("Bob"),
                ],
                // OTC订单KYC配置
                OtcOrderGenesisConfig {
                    kyc_config: KycConfig {
                        enabled: false, // 开发环境默认禁用
                        min_judgment_level: Judgement::Reasonable,
                        effective_block: 0,
                        updated_at: 0,
                    },
                    exempt_accounts: vec![
                        // 开发测试账户默认豁免
                        get_account_id_from_seed::<sr25519::Public>("Alice"),
                        get_account_id_from_seed::<sr25519::Public>("Bob"),
                    ],
                },
            )
        },
        vec![],
        None,
        None,
        None,
        None,
    ))
}

pub fn production_config() -> Result<ChainSpec, String> {
    let wasm_binary = WASM_BINARY.ok_or_else(|| "Production wasm not available".to_string())?;

    Ok(ChainSpec::from_genesis(
        "Stardust Production",
        "stardust",
        ChainType::Live,
        move || {
            production_genesis(
                wasm_binary,
                vec![], // 生产环境初始验证者
                // 生产环境OTC KYC配置
                OtcOrderGenesisConfig {
                    kyc_config: KycConfig {
                        enabled: true, // 生产环境默认启用
                        min_judgment_level: Judgement::KnownGood,
                        effective_block: 0,
                        updated_at: 0,
                    },
                    exempt_accounts: vec![], // 生产环境无豁免
                },
            )
        },
        vec![],
        None,
        None,
        None,
        None,
    ))
}
```

---

## 📋 总结检查清单

### ✅ 实现完成检查

- [ ] **依赖配置**：Cargo.toml包含所有必需依赖
- [ ] **类型定义**：KYC配置、订单结构等类型正确定义
- [ ] **KYC验证**：身份认证验证逻辑实现正确
- [ ] **Pallet实现**：所有外部调用接口实现完整
- [ ] **Runtime集成**：正确配置到runtime中
- [ ] **测试覆盖**：关键功能都有对应测试用例
- [ ] **权重定义**：所有函数都有权重估算
- [ ] **文档完善**：代码注释和API文档完整

### 🧪 测试验证

1. **编译测试**：`cargo check --features runtime-benchmarks`
2. **单元测试**：`cargo test --package pallet-otc-order`
3. **集成测试**：在测试网络中验证功能
4. **性能测试**：运行benchmarks验证权重

### 🚀 部署准备

1. **创世配置**：根据环境配置合适的初始KYC设置
2. **委员会设置**：确保委员会成员配置正确
3. **注册员设置**：配置Identity pallet的注册员
4. **监控配置**：设置相关事件的监控告警

这个实现指南提供了完整的代码实现，您可以按照步骤逐步实现OTC订单的KYC认证功能。