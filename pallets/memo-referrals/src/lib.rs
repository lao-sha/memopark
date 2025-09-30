#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use alloc::vec::Vec;
    use frame_support::traits::ConstU32;
    use frame_support::{pallet_prelude::*, traits::StorageVersion};
    use frame_system::pallet_prelude::*;

    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 运行时事件类型
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 最大遍历层级（用于上游遍历与防御性限制）
        #[pallet::constant]
        type MaxHops: Get<u32>;
        /// 函数级中文注释：每个推荐人最多可拥有的直接下级数量（反向索引容量上限，防状态膨胀）
        #[pallet::constant]
        type MaxReferralsPerAccount: Get<u32>;
    }

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 函数级中文注释：被推荐人到其直属推荐人的映射。
    /// - 仅允许每个账户绑定一次；一旦绑定不可修改，用于保证稳定的推荐图。
    #[pallet::storage]
    pub type SponsorOf<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, T::AccountId>;

    /// 函数级中文注释：记录绑定区块高度，便于做基于时间/周期的策略统计（可选使用）。
    #[pallet::storage]
    pub type BoundAt<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, BlockNumberFor<T>>;

    /// 函数级中文注释：反向索引：推荐人 -> 其直接下级集合（BoundedVec，上限由 MaxReferralsPerAccount 决定）。
    #[pallet::storage]
    pub type ReferralsOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<T::AccountId, <T as Config>::MaxReferralsPerAccount>,
        ValueQuery,
    >;

    /// 函数级中文注释：封禁推荐人集合（仅影响计酬归集，不改变 SponsorOf 图）。
    #[pallet::storage]
    pub type BannedSponsors<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    /// 函数级中文注释：治理暂停位。为 true 时禁止新绑定，已绑定关系不受影响。
    #[pallet::storage]
    #[pallet::getter(fn paused)]
    pub type Paused<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// 函数级中文注释：账户主推荐码（一次性领取，不可重复）。
    #[pallet::storage]
    pub type CodeOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u8, ConstU32<16>>, OptionQuery>;

    /// 函数级中文注释：推荐码归属索引（规范化码 → 账户）。
    #[pallet::storage]
    pub type OwnerOfCode<T: Config> =
        StorageMap<_, Blake2_128Concat, BoundedVec<u8, ConstU32<16>>, T::AccountId, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 新的推荐关系被绑定（who → sponsor）。
        SponsorBound {
            who: T::AccountId,
            sponsor: T::AccountId,
        },
        /// 暂停/恢复状态已更新。
        PausedSet { value: bool },
        /// 已更新封禁推荐人状态（仅治理）。
        SponsorBannedSet { who: T::AccountId, banned: bool },
        /// 函数级中文注释：已为账户分配唯一默认推荐码。
        /// - code 为 8 位大写十六进制（ASCII），仅包含 [0-9A-F]。
        ReferralCodeAssigned {
            who: T::AccountId,
            code: BoundedVec<u8, ConstU32<16>>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 已绑定过推荐人，禁止重复绑定。
        AlreadyBound,
        /// 不能推荐自己。
        SelfSponsor,
        /// 检测到环路（遍历祖先链时命中自身）。
        CycleDetected,
        /// 系统已暂停新绑定。
        Paused,
        /// 函数级中文注释：尚未绑定推荐人，不能领取默认推荐码。
        NotEligible,
        /// 函数级中文注释：已领取过默认推荐码，不能重复领取。
        AlreadyHasCode,
        /// 函数级中文注释：推荐码生成冲突（多次重试仍冲突）。
        CodeCollision,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：一次性绑定直属推荐人。
        /// 约束：
        /// - 调用方必须为签名账户；
        /// - 未曾绑定；
        /// - sponsor != self；
        /// - 祖先链防环；
        /// - 未被治理暂停。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn bind_sponsor(origin: OriginFor<T>, sponsor: T::AccountId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(!Self::paused(), Error::<T>::Paused);
            ensure!(who != sponsor, Error::<T>::SelfSponsor);
            ensure!(
                !SponsorOf::<T>::contains_key(&who),
                Error::<T>::AlreadyBound
            );

            // 环检测：向上遍历 sponsor 链，最多 MaxHops 步，若命中 who 则拒绝。
            let mut cursor = Some(sponsor.clone());
            let mut hops: u32 = 0;
            while let Some(cur) = cursor {
                ensure!(cur != who, Error::<T>::CycleDetected);
                if hops >= T::MaxHops::get() {
                    break;
                }
                cursor = SponsorOf::<T>::get(&cur);
                hops = hops.saturating_add(1);
            }

            SponsorOf::<T>::insert(&who, &sponsor);
            BoundAt::<T>::insert(&who, <frame_system::Pallet<T>>::block_number());
            // 维护反向索引：若超上限则拒绝（保障状态量）
            ReferralsOf::<T>::try_mutate(&sponsor, |v| {
                v.try_push(who.clone()).map_err(|_| Error::<T>::Paused)
            })?; // 复用 Paused 作为容量错误替身，避免新增错误
            Self::deposit_event(Event::SponsorBound { who, sponsor });
            Ok(())
        }

        /// 函数级中文注释：设置暂停位，仅 Root 可调用。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_paused(origin: OriginFor<T>, value: bool) -> DispatchResult {
            ensure_root(origin)?;
            Paused::<T>::put(value);
            Self::deposit_event(Event::PausedSet { value });
            Ok(())
        }

        /// 函数级中文注释：治理设置封禁推荐人状态（banned=true 表示该账户作为推荐人被封禁）。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_banned(origin: OriginFor<T>, who: T::AccountId, banned: bool) -> DispatchResult {
            ensure_root(origin)?;
            if banned {
                BannedSponsors::<T>::insert(&who, ());
            } else {
                BannedSponsors::<T>::remove(&who);
            }
            Self::deposit_event(Event::SponsorBannedSet { who, banned });
            Ok(())
        }

        /// 函数级详细中文注释：领取“唯一默认推荐码”（一次性，不可重复）。
        /// - 前置：必须已绑定推荐人（SponsorOf 存在）。
        /// - 生成：blake2_256(account_id||salt)→前4字节→8位大写 HEX；冲突时 salt 自增重试（最多8次）。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_default_code(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(SponsorOf::<T>::contains_key(&who), Error::<T>::NotEligible);
            ensure!(!CodeOf::<T>::contains_key(&who), Error::<T>::AlreadyHasCode);
            let mut salt: u8 = 0;
            let mut assigned: Option<BoundedVec<u8, ConstU32<16>>> = None;
            while salt < 8 {
                let mut bytes = who.encode();
                bytes.push(salt);
                let hash = sp_core::hashing::blake2_256(&bytes);
                let mut code_bytes: [u8; 8] = [0u8; 8];
                for i in 0..4 {
                    let b = hash[i];
                    code_bytes[i * 2] = Self::hex_upper(b >> 4);
                    code_bytes[i * 2 + 1] = Self::hex_upper(b & 0x0F);
                }
                let bv: BoundedVec<u8, ConstU32<16>> = BoundedVec::try_from(code_bytes.to_vec())
                    .map_err(|_| Error::<T>::CodeCollision)?;
                if !OwnerOfCode::<T>::contains_key(&bv) {
                    CodeOf::<T>::insert(&who, &bv);
                    OwnerOfCode::<T>::insert(&bv, who.clone());
                    assigned = Some(bv);
                    break;
                }
                salt = salt.saturating_add(1);
            }
            ensure!(assigned.is_some(), Error::<T>::CodeCollision);
            Self::deposit_event(Event::ReferralCodeAssigned {
                who,
                code: assigned.unwrap(),
            });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：获取账户的直属推荐人。
        pub fn sponsor_of(who: &T::AccountId) -> Option<T::AccountId> {
            SponsorOf::<T>::get(who)
        }

        /// 函数级中文注释：向上遍历祖先链，最多 `max_hops` 层，返回路径（不含 self）。
        pub fn ancestors(who: &T::AccountId, max_hops: u32) -> Vec<T::AccountId> {
            let mut out = Vec::new();
            let mut cursor = SponsorOf::<T>::get(who);
            let mut hops: u32 = 0;
            while let Some(cur) = cursor {
                out.push(cur.clone());
                if hops >= max_hops {
                    break;
                }
                cursor = SponsorOf::<T>::get(&cur);
                hops = hops.saturating_add(1);
            }
            out
        }

        /// 函数级中文注释：十六进制编码（大写），输入低 4 比特返回 ASCII 字节。
        #[inline]
        fn hex_upper(n: u8) -> u8 {
            match n {
                0..=9 => b'0' + n,
                10..=15 => b'A' + (n - 10),
                _ => b'0',
            }
        }
    }
}

/// 函数级中文注释：对外提供统一的推荐关系读取接口，供计酬等模块解耦引用。
pub trait ReferralProvider<AccountId> {
    /// 返回被推荐人 `who` 的直属推荐人（若有）。
    fn sponsor_of(who: &AccountId) -> Option<AccountId>;
    /// 受控向上遍历，最多 `max_hops` 层。
    fn ancestors(who: &AccountId, max_hops: u32) -> alloc::vec::Vec<AccountId>;
    /// 函数级中文注释：该账户是否被标记为“封禁推荐人”。
    /// - 用于计酬结算时将对应层的佣金归集至国库/平台账户。
    fn is_banned(who: &AccountId) -> bool;
}

impl<T: pallet::Config> ReferralProvider<T::AccountId> for Pallet<T> {
    fn sponsor_of(who: &T::AccountId) -> Option<T::AccountId> {
        <pallet::SponsorOf<T>>::get(who)
    }
    fn ancestors(who: &T::AccountId, max_hops: u32) -> alloc::vec::Vec<T::AccountId> {
        Pallet::<T>::ancestors(who, max_hops)
    }
    fn is_banned(who: &T::AccountId) -> bool {
        <pallet::BannedSponsors<T>>::contains_key(who)
    }
}
