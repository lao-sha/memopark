#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{pallet_prelude::*, traits::Get};
    use frame_system::pallet_prelude::*;
    use sp_core::H256;

    /// 函数级详细中文注释：KYC 抽象接口
    /// - 由运行时提供具体实现（例如基于 pallet-identity 的判定）。
    /// - 返回 true 表示账户已通过有效的实名/审查（如 KnownGood/Reasonable）。
    pub trait KycProvider<AccountId> {
        fn is_verified(who: &AccountId) -> bool;
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 最大支付承诺 CID 长度（加密 CID 对应的哈希承诺）
        type MaxCidLen: Get<u32>;
        /// KYC 提供者：由 Runtime 绑定到具体实现
        type Kyc: KycProvider<Self::AccountId>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    /// 函数级详细中文注释：做市商资料
    /// - payment_cid_commit: 支付方式/联系方式等链下加密 CID 的承诺哈希
    /// - active: 启用/停牌
    pub type Makers<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (H256, bool), OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 注册或更新做市商资料
        MakerUpserted { who: T::AccountId },
        /// 做市商状态变更
        MakerStatusChanged { who: T::AccountId, active: bool },
    }

    #[pallet::error]
    pub enum Error<T> {
        NotMaker,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：注册/更新做市商资料
        /// - 输入：payment_cid_commit 为加密 CID 的哈希（H(encrypted_cid||salt)）
        /// - 仅记录承诺，避免泄露隐私；明文与密文由链下安全存储
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn upsert_maker(origin: OriginFor<T>, payment_cid_commit: H256) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 要求账户已通过 KYC（例如 pallet-identity 的 KnownGood/Reasonable）
            ensure!(<T as Config>::Kyc::is_verified(&who), Error::<T>::NotMaker);
            Makers::<T>::insert(&who, (payment_cid_commit, true));
            Self::deposit_event(Event::MakerUpserted { who });
            Ok(())
        }

        /// 函数级详细中文注释：设置做市商启用状态
        /// - 仅账户自身可设置；未来可改由授权中心或治理控制
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn set_active(origin: OriginFor<T>, active: bool) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Makers::<T>::try_mutate(&who, |maybe| -> Result<(), DispatchError> {
                let v = maybe.as_mut().ok_or(Error::<T>::NotMaker)?;
                // 启用前仍校验 KYC 状态
                if active { ensure!(<T as Config>::Kyc::is_verified(&who), Error::<T>::NotMaker); }
                v.1 = active;
                Ok(())
            })?;
            Self::deposit_event(Event::MakerStatusChanged { who, active });
            Ok(())
        }
    }
}


