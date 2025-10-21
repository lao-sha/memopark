#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

use codec::Encode;
/// 函数级详细中文注释（模块级）：pallet-first-purchase（首购领取）
/// - 本 pallet 提供基于 pallet-balances 的"命名预留 + 预留再归属"式领取（claim）逻辑；
/// - 适用于用户首次购买MEMO或法币入金场景，由做市商（发行方）签发授权，用户链上领取 MEMO（原生代币）。
/// - 主要使用场景：
///   1) 新用户首次购买MEMO（首购场景，约80%使用率）；
///   2) 老用户法币入金（复购场景，约20%使用率）。
/// - 安全目标：
///   1) 服务器端不持有链上转账权限，仅签发授权；
///   2) 领取交易内原子执行 reserve_named -> repatriate_reserved_named，避免竞态；
///   3) 通过 (issuer, order_id) 一次性消费 + deadline_block + genesis_hash 域分离防重放；
///   4) 保持与其他 pallet 低耦合，仅依赖 frame-system 与 pallet-balances。
use frame_support::{
    pallet_prelude::*,
    traits::{Currency, ReservableCurrency},
};
use frame_system::pallet_prelude::*;
use sp_core::{sr25519, H256};
use sp_runtime::{
    traits::{SaturatedConversion, Zero},
    RuntimeDebug,
};
use sp_std::marker::PhantomData;
use sp_std::prelude::*;

type BalanceOf<T> =
    <<T as pallet::Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct IssuerInfo<AccountId> {
        /// 函数级中文注释：发行方账户（其 free 余额将被预留并再归属给受益人）
        pub account: AccountId,
        /// 函数级中文注释：授权签名公钥（sr25519），仅用于验签领取授权
        pub pubkey: [u8; 32],
        /// 函数级中文注释：状态：0=active, 1=frozen, 2=revoked
        pub status: u8,
        /// 函数级中文注释：单笔限额、日累计限额（单位：Balance）
        pub single_max: u128,
        pub daily_max: u128,
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type Currency: ReservableCurrency<Self::AccountId> + Currency<Self::AccountId>;
        /// 函数级中文注释：每日计量的 DayKey 生成函数（以区块高度切片）。
        #[pallet::constant]
        type BlocksPerDay: Get<BlockNumberFor<Self>>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(PhantomData<T>);

    /// 发行方注册表
    #[pallet::storage]
    pub type Issuers<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, IssuerInfo<T::AccountId>, OptionQuery>;

    /// 订单消费标记：(issuer, order_id) -> consumed
    #[pallet::storage]
    pub type ConsumedOrders<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        H256,
        bool,
        ValueQuery,
    >;

    /// 日累计额度：(issuer, day_key) -> amount
    #[pallet::storage]
    pub type DailyVolume<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        u32,
        u128,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 发行方注册或更新
        IssuerUpserted { issuer: T::AccountId },
        /// 发行方吊销
        IssuerRevoked { issuer: T::AccountId },
        /// 领取成功
        ClaimSucceeded {
            issuer: T::AccountId,
            order_id: H256,
            beneficiary: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 领取失败（链上校验失败原因）
        ClaimRejected {
            issuer: T::AccountId,
            order_id: H256,
            reason: u16,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        IssuerNotFound,
        IssuerRevoked,
        OrderConsumed,
        SignatureInvalid,
        DeadlineExceeded,
        InvalidChain,
        InsufficientFreeBalance,
        DailyLimitExceeded,
        BeneficiaryInvalid,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：注册/更新发行方（仅 Root/治理调用）。
        /// - 写入发行方账户与验签公钥、状态与限额；重复调用视为更新。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn upsert_issuer(
            origin: OriginFor<T>,
            issuer: T::AccountId,
            pubkey: [u8; 32],
            status: u8,
            single_max: u128,
            daily_max: u128,
        ) -> DispatchResult {
            ensure_root(origin)?;
            Issuers::<T>::insert(
                &issuer,
                IssuerInfo {
                    account: issuer.clone(),
                    pubkey,
                    status,
                    single_max,
                    daily_max,
                },
            );
            Self::deposit_event(Event::IssuerUpserted { issuer });
            Ok(())
        }

        /// 函数级详细中文注释：吊销发行方（仅 Root/治理调用）。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn revoke_issuer(origin: OriginFor<T>, issuer: T::AccountId) -> DispatchResult {
            ensure_root(origin)?;
            if let Some(mut info) = Issuers::<T>::get(&issuer) {
                info.status = 2u8; // revoked
                Issuers::<T>::insert(&issuer, info);
            }
            Self::deposit_event(Event::IssuerRevoked { issuer });
            Ok(())
        }

        /// 函数级详细中文注释：领取 MEMO（原生代币）。
        /// - 参数：做市商发行方、订单号、受益人、金额、授权签名、截止块、随机 nonce。
        /// - 安全：
        ///   a) 域分离：校验 genesis_hash == T::GenesisHash；
        ///   b) 一次性消费：(issuer, order_id) 未消费；
        ///   c) 验签：sr25519 签名验证；
        ///   d) 限额与余额：单笔 ≤ single_max；当日累计 ≤ daily_max；发行方 free 余额足以预留；
        ///   e) 原子资金流：reserve_named -> repatriate_reserved_named(to=beneficiary, Status::Free)。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(50_000)]
        pub fn claim(
            origin: OriginFor<T>,
            issuer: T::AccountId,
            order_id: H256,
            beneficiary: T::AccountId,
            amount: BalanceOf<T>,
            deadline_block: BlockNumberFor<T>,
            nonce: u128,
            signature: [u8; 64],
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?; // 允许任意人代提交（转发/赞助者）

            // 1) 发行方存在且未吊销
            let info = Issuers::<T>::get(&issuer).ok_or(Error::<T>::IssuerNotFound)?;
            ensure!(info.status == 0u8, Error::<T>::IssuerRevoked);

            // 2) 订单未消费、未过期、链标识一致
            ensure!(
                !ConsumedOrders::<T>::get(&issuer, &order_id),
                Error::<T>::OrderConsumed
            );
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now <= deadline_block, Error::<T>::DeadlineExceeded);

            // 3) 限额（转换到 u128 进行比较）
            let amt_u128: u128 = amount.saturated_into::<u128>();
            ensure!(amt_u128 <= info.single_max, Error::<T>::DailyLimitExceeded);
            let day_key: u32 = (now / T::BlocksPerDay::get()).saturated_into::<u32>();
            let day_used = DailyVolume::<T>::get(&issuer, day_key);
            ensure!(
                day_used.saturating_add(amt_u128) <= info.daily_max,
                Error::<T>::DailyLimitExceeded
            );

            // 4) 验签
            let mut msg = b"MEMOPARK_OTC_V1".to_vec();
            // 使用链上创世哈希进行域分离，防跨链重放
            let zero: BlockNumberFor<T> = Zero::zero();
            let genesis_hash = <frame_system::Pallet<T>>::block_hash(zero);
            msg.extend_from_slice(&genesis_hash.encode());
            msg.extend_from_slice(&issuer.encode());
            msg.extend_from_slice(&order_id.encode());
            msg.extend_from_slice(&beneficiary.encode());
            msg.extend_from_slice(&amount.encode());
            msg.extend_from_slice(&deadline_block.encode());
            msg.extend_from_slice(&nonce.encode());
            let h = sp_core::blake2_256(&msg);
            let pubkey = sr25519::Public::from_raw(info.pubkey);
            let sig = sr25519::Signature::from_raw(signature);
            let ok = sp_io::crypto::sr25519_verify(&sig, &h, &pubkey);
            ensure!(ok, Error::<T>::SignatureInvalid);

            // 5) 资金：预留 + 预留再归属（原子，未命名接口以兼容 ReservableCurrency）
            T::Currency::reserve(&issuer, amount)
                .map_err(|_| Error::<T>::InsufficientFreeBalance)?;
            let _moved = T::Currency::repatriate_reserved(
                &issuer,
                &beneficiary,
                amount,
                frame_support::traits::tokens::BalanceStatus::Free,
            )
            .map_err(|_| Error::<T>::InsufficientFreeBalance)?;

            // 6) 标记与累计
            ConsumedOrders::<T>::insert(&issuer, &order_id, true);
            DailyVolume::<T>::insert(&issuer, day_key, day_used.saturating_add(amt_u128));
            Self::deposit_event(Event::ClaimSucceeded {
                issuer,
                order_id,
                beneficiary,
                amount,
            });
            Ok(())
        }
    }
}

pub use pallet::*;
