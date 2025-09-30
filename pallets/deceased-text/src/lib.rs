#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

use alloc::vec::Vec;
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::{AtLeast32BitUnsigned, Saturating};

/// 函数级中文注释：访问 `pallet-deceased` 的抽象接口（低耦合）。
pub trait DeceasedAccess<AccountId, DeceasedId> {
    fn deceased_exists(id: DeceasedId) -> bool;
    fn can_manage(who: &AccountId, deceased_id: DeceasedId) -> bool;
}

/// 函数级中文注释：逝者令牌访问接口（低耦合）。
pub trait DeceasedTokenAccess<MaxTokenLen: Get<u32>, DeceasedId> {
    fn token_of(id: DeceasedId) -> Option<BoundedVec<u8, MaxTokenLen>>;
}

/// 函数级中文注释：文本类型（Article/Message）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum TextKind {
    Article,
    Message,
}

/// 函数级中文注释：文本记录（仅存放 CID、标题/摘要等元数据）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct TextRecord<T: Config> {
    pub id: T::TextId,
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub author: T::AccountId,
    pub kind: TextKind,
    pub cid: BoundedVec<u8, T::StringLimit>,
    pub title: Option<BoundedVec<u8, T::StringLimit>>,
    pub summary: Option<BoundedVec<u8, T::StringLimit>>,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：生平（Life）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Life<T: Config> {
    pub owner: T::AccountId,
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub cid: BoundedVec<u8, T::StringLimit>,
    pub updated: BlockNumberFor<T>,
    pub version: u32,
    pub last_editor: Option<T::AccountId>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::traits::{Currency as CurrencyTrait, ReservableCurrency};

    /// 函数级中文注释：统一 Balance 类型别名。
    pub type BalanceOf<T> =
        <<T as Config>::Currency as CurrencyTrait<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type DeceasedId: Parameter
            + Member
            + AtLeast32BitUnsigned
            + Default
            + Copy
            + MaxEncodedLen
            + From<u64>
            + Into<u64>;
        type TextId: Parameter
            + Member
            + AtLeast32BitUnsigned
            + Default
            + Copy
            + MaxEncodedLen
            + From<u64>
            + Into<u64>;
        #[pallet::constant]
        type StringLimit: Get<u32>;
        #[pallet::constant]
        type MaxTokenLen: Get<u32>;
        #[pallet::constant]
        type MaxMessagesPerDeceased: Get<u32>;
        #[pallet::constant]
        type MaxEulogiesPerDeceased: Get<u32>;

        type DeceasedProvider: DeceasedAccess<Self::AccountId, Self::DeceasedId>;
        type DeceasedTokenProvider: DeceasedTokenAccess<Self::MaxTokenLen, Self::DeceasedId>;

        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        type Currency: ReservableCurrency<Self::AccountId>;
        #[pallet::constant]
        type TextDeposit: Get<BalanceOf<Self>>;
        #[pallet::constant]
        type ComplaintDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：仲裁费用接收账户（5%）。
        type ArbitrationAccount: Get<Self::AccountId>;
        #[pallet::constant]
        type ComplaintPeriod: Get<BlockNumberFor<Self>>;
    }

    #[pallet::storage]
    pub type NextTextId<T: Config> = StorageValue<_, T::TextId, ValueQuery>;
    #[pallet::storage]
    pub type TextOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::TextId, TextRecord<T>, OptionQuery>;
    #[pallet::storage]
    pub type MessagesByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<T::TextId, T::MaxMessagesPerDeceased>,
        ValueQuery,
    >;
    #[pallet::storage]
    pub type ArticlesByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<T::TextId, frame_support::traits::ConstU32<1024>>,
        ValueQuery,
    >;

    #[pallet::storage]
    pub type TextDeposits<T: Config> =
        StorageMap<_, Blake2_128Concat, T::TextId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage]
    pub type TextMaturity<T: Config> =
        StorageMap<_, Blake2_128Concat, T::TextId, BlockNumberFor<T>, OptionQuery>;

    // Life
    #[pallet::storage]
    pub type LifeOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, Life<T>, OptionQuery>;
    #[pallet::storage]
    pub type LifePrev<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<u8, T::StringLimit>, OptionQuery>;
    #[pallet::storage]
    pub type LifeDeposits<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage]
    pub type LifeMaturity<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, BlockNumberFor<T>, OptionQuery>;

    // Eulogy（沿用 TextId 空间）
    #[pallet::storage]
    pub type EulogiesByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<T::TextId, T::MaxEulogiesPerDeceased>,
        ValueQuery,
    >;
    #[pallet::storage]
    pub type EulogyOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::TextId,
        (T::DeceasedId, BoundedVec<u8, T::StringLimit>, T::AccountId),
        OptionQuery,
    >;
    #[pallet::storage]
    pub type EulogyDeposits<T: Config> =
        StorageMap<_, Blake2_128Concat, T::TextId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage]
    pub type EulogyMaturity<T: Config> =
        StorageMap<_, Blake2_128Concat, T::TextId, BlockNumberFor<T>, OptionQuery>;
    // 投诉：生平与悼词
    #[pallet::storage]
    pub type ComplaintOf<T: Config> =
        StorageMap<_, Blake2_128Concat, (u8, u64), ComplaintCase<T>, OptionQuery>;
    #[pallet::storage]
    pub type LifeComplaints<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, u32, ValueQuery>;
    #[pallet::storage]
    pub type EulogyComplaints<T: Config> =
        StorageMap<_, Blake2_128Concat, T::TextId, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        ArticleSet(T::TextId, T::DeceasedId, T::AccountId),
        MessageAdded(T::TextId, T::DeceasedId, T::AccountId),
        TextEdited(T::TextId),
        TextRemoved(T::TextId),
        TextDepositRefunded(T::TextId, T::AccountId, BalanceOf<T>),
        LifeCreated(T::DeceasedId, T::AccountId),
        LifeUpdated(T::DeceasedId),
        LifeUpdatedByOthers(T::DeceasedId, T::AccountId),
        LifeDepositRefunded(T::DeceasedId, T::AccountId, BalanceOf<T>),
        EulogyCreated(T::TextId, T::DeceasedId, T::AccountId),
        EulogyUpdated(T::TextId),
        EulogyRemoved(T::TextId),
        EulogyDepositRefunded(T::TextId, T::AccountId, BalanceOf<T>),
        // 投诉事件与分账
        LifeComplained(T::DeceasedId, u32),
        EulogyComplained(T::TextId, u32),
        ComplaintResolved(u8, u64, bool),
        ComplaintPayoutWinner(T::AccountId, BalanceOf<T>),
        ComplaintPayoutArbitration(T::AccountId, BalanceOf<T>),
        ComplaintPayoutLoserRefund(T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：治理证据已记录（scope,id,cid）。scope:3=Life(deceased),4=Eulogy(text)
        GovEvidenceNoted(u8, u64, BoundedVec<u8, T::StringLimit>),
    }

    #[pallet::error]
    pub enum Error<T> {
        DeceasedNotFound,
        NotAuthorized,
        TextNotFound,
        TooMany,
        BadInput,
        Overflow,
        DepositFailed,
        NotMatured,
        NoDepositToClaim,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub enum ComplaintStatus {
        Pending,
        Resolved,
    }
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    #[scale_info(skip_type_params(T))]
    pub struct ComplaintCase<T: Config> {
        pub complainant: T::AccountId,
        pub deposit: BalanceOf<T>,
        pub created: BlockNumberFor<T>,
        pub status: ComplaintStatus,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释（内部工具）：记录治理证据 CID（明文），返回有界向量。
        fn note_evidence(
            scope: u8,
            id: u64,
            cid: Vec<u8>,
        ) -> Result<BoundedVec<u8, T::StringLimit>, DispatchError> {
            let bv: BoundedVec<u8, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            Self::deposit_event(Event::GovEvidenceNoted(scope, id, bv.clone()));
            Ok(bv)
        }

        /// 函数级详细中文注释：治理起源统一校验入口。
        /// - 目的：集中治理起源检查，统一未授权错误为本模块错误 `Error::<T>::NotAuthorized`，便于前端与索引处理；
        /// - 行为：封装 `T::GovernanceOrigin::ensure_origin(origin)`，失败映射为模块错误；
        /// - 返回：Ok(()) 或 `DispatchError::Module`（NotAuthorized）。
        fn ensure_gov(origin: OriginFor<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)
                .map(|_| ())
                .map_err(|_| Error::<T>::NotAuthorized.into())
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：设置/创建逝者文章（Article）。仅 can_manage 的账户。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_article(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
            title: Option<Vec<u8>>,
            summary: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            ensure!(
                T::DeceasedProvider::can_manage(&who, deceased_id),
                Error::<T>::NotAuthorized
            );

            let cid_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            let title_bv = match title {
                Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                None => None,
            };
            let summary_bv = match summary {
                Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                None => None,
            };

            let id = NextTextId::<T>::get();
            let next = id.saturating_add(T::TextId::from(1u64));
            NextTextId::<T>::put(next);
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let rec = TextRecord::<T> {
                id,
                deceased_id,
                deceased_token: token,
                author: who.clone(),
                kind: TextKind::Article,
                cid: cid_bv,
                title: title_bv,
                summary: summary_bv,
                created: now,
                updated: now,
            };
            TextOf::<T>::insert(id, rec);
            ArticlesByDeceased::<T>::try_mutate(deceased_id, |list| {
                list.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;
            let dep = T::TextDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                TextDeposits::<T>::insert(id, (who.clone(), dep));
                TextMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::ArticleSet(id, deceased_id, who));
            Ok(())
        }

        // ========== 投诉与裁决（Life/Eulogy） ==========
        /// 投诉生平
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_life(origin: OriginFor<T>, deceased_id: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(LifeOf::<T>::contains_key(deceased_id), Error::<T>::BadInput);
            let key = (3u8, deceased_id.into());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::BadInput);
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
            }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(
                key,
                ComplaintCase {
                    complainant: who.clone(),
                    deposit: dep,
                    created: now,
                    status: ComplaintStatus::Pending,
                },
            );
            let cnt = LifeComplaints::<T>::get(deceased_id).saturating_add(1);
            LifeComplaints::<T>::insert(deceased_id, cnt);
            Self::deposit_event(Event::LifeComplained(deceased_id, cnt));
            Ok(())
        }

        /// 投诉悼词
        #[pallet::call_index(14)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_eulogy(origin: OriginFor<T>, id: T::TextId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                EulogyOf::<T>::contains_key(id) || EulogyDeposits::<T>::contains_key(id),
                Error::<T>::TextNotFound
            );
            let key = (4u8, id.into());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::BadInput);
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
            }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(
                key,
                ComplaintCase {
                    complainant: who.clone(),
                    deposit: dep,
                    created: now,
                    status: ComplaintStatus::Pending,
                },
            );
            let cnt = EulogyComplaints::<T>::get(id).saturating_add(1);
            EulogyComplaints::<T>::insert(id, cnt);
            Self::deposit_event(Event::EulogyComplained(id, cnt));
            Ok(())
        }

        /// 裁决生平投诉
        #[pallet::call_index(15)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_life_complaint(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            uphold: bool,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(3u8, deceased_id.into(), evidence_cid)?;
            ensure!(LifeOf::<T>::contains_key(deceased_id), Error::<T>::BadInput);
            let key = (3u8, deceased_id.into());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::BadInput)?;
            let arb = T::ArbitrationAccount::get();
            if uphold {
                // 回滚到 prev 并按非创建者押金分账（如存在）
                if let Some(prev) = LifePrev::<T>::take(deceased_id) {
                    LifeOf::<T>::mutate(deceased_id, |life| {
                        if let Some(l) = life {
                            l.cid = prev;
                            l.last_editor = None;
                        }
                    });
                }
                if let Some((editor, d)) = LifeDeposits::<T>::take(deceased_id) {
                    if !d.is_zero() {
                        let win = (d * 20u32.into()) / 100u32.into();
                        let fee = (d * 5u32.into()) / 100u32.into();
                        let back = d - win - fee;
                        T::Currency::repatriate_reserved(
                            &editor,
                            &case.complainant,
                            win,
                            frame_support::traits::BalanceStatus::Free,
                        )
                        .ok();
                        T::Currency::repatriate_reserved(
                            &editor,
                            &arb,
                            fee,
                            frame_support::traits::BalanceStatus::Free,
                        )
                        .ok();
                        T::Currency::unreserve(&editor, back);
                        Self::deposit_event(Event::ComplaintPayoutWinner(
                            case.complainant.clone(),
                            win,
                        ));
                        Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                        Self::deposit_event(Event::ComplaintPayoutLoserRefund(
                            editor.clone(),
                            back,
                        ));
                    }
                }
                if !case.deposit.is_zero() {
                    T::Currency::unreserve(&case.complainant, case.deposit);
                }
            } else {
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    if let Some(l) = LifeOf::<T>::get(deceased_id) {
                        T::Currency::repatriate_reserved(
                            &case.complainant,
                            &l.owner,
                            win,
                            frame_support::traits::BalanceStatus::Free,
                        )
                        .ok();
                    }
                    T::Currency::repatriate_reserved(
                        &case.complainant,
                        &arb,
                        fee,
                        frame_support::traits::BalanceStatus::Free,
                    )
                    .ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(
                        case.complainant.clone(),
                        back,
                    ));
                }
            }
            case.status = ComplaintStatus::Resolved;
            ComplaintOf::<T>::remove(key);
            LifeComplaints::<T>::insert(deceased_id, 0);
            Self::deposit_event(Event::ComplaintResolved(3u8, deceased_id.into(), uphold));
            Ok(())
        }

        /// 裁决悼词投诉
        #[pallet::call_index(16)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_eulogy_complaint(
            origin: OriginFor<T>,
            id: T::TextId,
            uphold: bool,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(4u8, id.into(), evidence_cid)?;
            ensure!(
                EulogyOf::<T>::contains_key(id) || EulogyDeposits::<T>::contains_key(id),
                Error::<T>::TextNotFound
            );
            let key = (4u8, id.into());
            let case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::BadInput)?;
            let arb = T::ArbitrationAccount::get();
            if uphold {
                if let Some((author, d)) = EulogyDeposits::<T>::take(id) {
                    if !d.is_zero() {
                        let win = (d * 20u32.into()) / 100u32.into();
                        let fee = (d * 5u32.into()) / 100u32.into();
                        let back = d - win - fee;
                        T::Currency::repatriate_reserved(
                            &author,
                            &case.complainant,
                            win,
                            frame_support::traits::BalanceStatus::Free,
                        )
                        .ok();
                        T::Currency::repatriate_reserved(
                            &author,
                            &arb,
                            fee,
                            frame_support::traits::BalanceStatus::Free,
                        )
                        .ok();
                        T::Currency::unreserve(&author, back);
                        Self::deposit_event(Event::ComplaintPayoutWinner(
                            case.complainant.clone(),
                            win,
                        ));
                        Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                        Self::deposit_event(Event::ComplaintPayoutLoserRefund(
                            author.clone(),
                            back,
                        ));
                    }
                }
                if !case.deposit.is_zero() {
                    T::Currency::unreserve(&case.complainant, case.deposit);
                }
            } else {
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    if let Some((author, _)) = EulogyDeposits::<T>::get(id) {
                        T::Currency::repatriate_reserved(
                            &case.complainant,
                            &author,
                            win,
                            frame_support::traits::BalanceStatus::Free,
                        )
                        .ok();
                    }
                    T::Currency::repatriate_reserved(
                        &case.complainant,
                        &arb,
                        fee,
                        frame_support::traits::BalanceStatus::Free,
                    )
                    .ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(
                        case.complainant.clone(),
                        back,
                    ));
                }
            }
            ComplaintOf::<T>::remove(key);
            EulogyComplaints::<T>::insert(id, 0);
            Self::deposit_event(Event::ComplaintResolved(4u8, id.into(), uphold));
            Ok(())
        }

        /// 函数级中文注释：添加留言（Message）。任何签名账户（可按需接入成员校验）。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn add_message(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
            title: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            let cid_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            let title_bv = match title {
                Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                None => None,
            };
            let id = NextTextId::<T>::get();
            NextTextId::<T>::put(id.saturating_add(T::TextId::from(1u64)));
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let rec = TextRecord::<T> {
                id,
                deceased_id,
                deceased_token: token,
                author: who.clone(),
                kind: TextKind::Message,
                cid: cid_bv,
                title: title_bv,
                summary: None,
                created: now,
                updated: now,
            };
            TextOf::<T>::insert(id, rec);
            MessagesByDeceased::<T>::try_mutate(deceased_id, |list| {
                list.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;
            let dep = T::TextDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                TextDeposits::<T>::insert(id, (who.clone(), dep));
                TextMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::MessageAdded(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：编辑文本（Article/Message）；仅作者。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn edit_text(
            origin: OriginFor<T>,
            id: T::TextId,
            cid: Option<Vec<u8>>,
            title: Option<Option<Vec<u8>>>,
            summary: Option<Option<Vec<u8>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            TextOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let t = maybe.as_mut().ok_or(Error::<T>::TextNotFound)?;
                ensure!(t.author == who, Error::<T>::NotAuthorized);
                if let Some(v) = cid {
                    t.cid = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?;
                }
                if let Some(tt) = title {
                    t.title = match tt {
                        Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                        None => None,
                    };
                }
                if let Some(ss) = summary {
                    t.summary = match ss {
                        Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                        None => None,
                    };
                }
                t.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::TextEdited(id));
            Ok(())
        }

        /// 函数级中文注释：删除文本（仅 Message）；Article 保持通过覆盖更新。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn remove_text(origin: OriginFor<T>, id: T::TextId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let rec = TextOf::<T>::get(id).ok_or(Error::<T>::TextNotFound)?;
            ensure!(rec.author == who, Error::<T>::NotAuthorized);
            ensure!(matches!(rec.kind, TextKind::Message), Error::<T>::BadInput);
            TextOf::<T>::remove(id);
            MessagesByDeceased::<T>::mutate(rec.deceased_id, |list| {
                if let Some(pos) = list.iter().position(|x| *x == id) {
                    list.swap_remove(pos);
                }
            });
            let now = <frame_system::Pallet<T>>::block_number();
            TextMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::TextRemoved(id));
            Ok(())
        }

        /// 函数级中文注释：【治理】强制删除文本（Message/Article 均可），并记录证据。
        /// - 用于纠纷裁决或合规治理；删除后写入成熟期，作者可按期领取押金（若有）。
        #[pallet::call_index(17)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_remove_text(
            origin: OriginFor<T>,
            id: T::TextId,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(4u8, id.into(), evidence_cid);
            let rec = TextOf::<T>::take(id).ok_or(Error::<T>::TextNotFound)?;
            match rec.kind {
                TextKind::Message => {
                    MessagesByDeceased::<T>::mutate(rec.deceased_id, |list| {
                        if let Some(pos) = list.iter().position(|x| *x == id) {
                            list.swap_remove(pos);
                        }
                    });
                }
                TextKind::Article => {
                    ArticlesByDeceased::<T>::mutate(rec.deceased_id, |list| {
                        if let Some(pos) = list.iter().position(|x| *x == id) {
                            list.swap_remove(pos);
                        }
                    });
                }
            }
            let now = <frame_system::Pallet<T>>::block_number();
            TextMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::TextRemoved(id));
            Ok(())
        }

        /// 函数级中文注释：【治理】强制编辑文本（Article/Message），并记录证据。
        /// - 可选参数保持不变；仅提供的字段会被更新。
        #[pallet::call_index(18)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_edit_text(
            origin: OriginFor<T>,
            id: T::TextId,
            cid: Option<Vec<u8>>,
            title: Option<Option<Vec<u8>>>,
            summary: Option<Option<Vec<u8>>>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(4u8, id.into(), evidence_cid)?;
            TextOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let t = maybe.as_mut().ok_or(Error::<T>::TextNotFound)?;
                if let Some(v) = cid {
                    t.cid = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?;
                }
                if let Some(tt) = title {
                    t.title = match tt {
                        Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                        None => None,
                    };
                }
                if let Some(ss) = summary {
                    t.summary = match ss {
                        Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                        None => None,
                    };
                }
                t.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::TextEdited(id));
            Ok(())
        }

        /// 函数级中文注释：【治理】强制设置生平（Life）CID，覆盖现有内容。
        /// - 行为：仅允许覆盖已存在的 Life；缺失时返回错误，避免创建时 owner 不确定。
        #[pallet::call_index(19)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_life(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(3u8, deceased_id.into(), evidence_cid)?;
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            let bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            let now = <frame_system::Pallet<T>>::block_number();
            LifeOf::<T>::try_mutate(deceased_id, |maybe| -> DispatchResult {
                let l = maybe.as_mut().ok_or(Error::<T>::BadInput)?;
                l.cid = bv.clone();
                l.updated = now;
                l.version = l.version.saturating_add(1);
                l.last_editor = None;
                Ok(())
            })?;
            Self::deposit_event(Event::LifeUpdated(deceased_id));
            Ok(())
        }

        /// 函数级中文注释：领取文本押金（到期）。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_text_deposit(origin: OriginFor<T>, id: T::TextId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = TextDeposits::<T>::get(id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            let mature_at = TextMaturity::<T>::get(id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            TextDeposits::<T>::remove(id);
            TextMaturity::<T>::remove(id);
            Self::deposit_event(Event::TextDepositRefunded(id, who, amt));
            Ok(())
        }

        // ========== Life ==========
        /// 函数级中文注释：创建生平（不可删除）。仅 can_manage 的账户。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_life(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            ensure!(
                T::DeceasedProvider::can_manage(&who, deceased_id),
                Error::<T>::NotAuthorized
            );
            ensure!(
                LifeOf::<T>::get(deceased_id).is_none(),
                Error::<T>::BadInput
            );
            let bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let life = Life {
                owner: who.clone(),
                deceased_id,
                deceased_token: token,
                cid: bv,
                updated: now,
                version: 1,
                last_editor: None,
            };
            LifeOf::<T>::insert(deceased_id, life);
            Self::deposit_event(Event::LifeCreated(deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新生平；创建者免押金，非创建者需押金+成熟期。
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_life(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            LifeOf::<T>::try_mutate(deceased_id, |maybe| -> DispatchResult {
                let life = maybe.as_mut().ok_or(Error::<T>::BadInput)?;
                let bv: BoundedVec<_, T::StringLimit> =
                    BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
                let now = <frame_system::Pallet<T>>::block_number();
                if who == life.owner {
                    life.cid = bv;
                    life.updated = now;
                    life.version = life.version.saturating_add(1);
                    life.last_editor = None;
                } else {
                    let dep = T::TextDeposit::get();
                    if !dep.is_zero() {
                        T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                        LifeDeposits::<T>::insert(deceased_id, (who.clone(), dep));
                        LifeMaturity::<T>::insert(deceased_id, now + T::ComplaintPeriod::get());
                    }
                    LifePrev::<T>::insert(deceased_id, life.cid.clone());
                    life.cid = bv;
                    life.updated = now;
                    life.version = life.version.saturating_add(1);
                    life.last_editor = Some(who.clone());
                }
                Ok(())
            })?;
            Ok(())
        }

        /// 函数级中文注释：领取生平更新押金（非创建者；到期）。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_life_deposit(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) =
                LifeDeposits::<T>::get(deceased_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            let mature_at = LifeMaturity::<T>::get(deceased_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            LifeDeposits::<T>::remove(deceased_id);
            LifeMaturity::<T>::remove(deceased_id);
            Self::deposit_event(Event::LifeDepositRefunded(deceased_id, who, amt));
            Ok(())
        }

        // ========== Eulogy ==========
        /// 函数级中文注释：创建悼词（任何签名账户，押金+成熟）。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_eulogy(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            let cid_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            let id = NextTextId::<T>::get();
            let next = id.saturating_add(T::TextId::from(1u64));
            NextTextId::<T>::put(next);
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let now = <frame_system::Pallet<T>>::block_number();
            EulogyOf::<T>::insert(id, (deceased_id, cid_bv, who.clone()));
            EulogiesByDeceased::<T>::try_mutate(deceased_id, |list| {
                list.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;
            let dep = T::TextDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                EulogyDeposits::<T>::insert(id, (who.clone(), dep));
                EulogyMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            }
            let _ = token; // 仅为保持接口一致，目前未直接存入悼词记录
            Self::deposit_event(Event::EulogyCreated(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新悼词（仅作者）。
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_eulogy(origin: OriginFor<T>, id: T::TextId, cid: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (did, _old, author) = EulogyOf::<T>::get(id).ok_or(Error::<T>::TextNotFound)?;
            ensure!(author == who, Error::<T>::NotAuthorized);
            let cid_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            EulogyOf::<T>::insert(id, (did, cid_bv, author));
            Self::deposit_event(Event::EulogyUpdated(id));
            Ok(())
        }

        /// 函数级中文注释：治理移除悼词（押金成熟后可退）。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_remove_eulogy(
            origin: OriginFor<T>,
            id: T::TextId,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(4u8, id.into(), evidence_cid)?;
            let (did, _cid, _author) = EulogyOf::<T>::take(id).ok_or(Error::<T>::TextNotFound)?;
            EulogiesByDeceased::<T>::mutate(did, |list| {
                if let Some(pos) = list.iter().position(|x| *x == id) {
                    list.swap_remove(pos);
                }
            });
            let now = <frame_system::Pallet<T>>::block_number();
            EulogyMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::EulogyRemoved(id));
            Ok(())
        }

        /// 函数级中文注释：领取悼词押金（到期）。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_eulogy_deposit(origin: OriginFor<T>, id: T::TextId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = EulogyDeposits::<T>::get(id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            let mature_at = EulogyMaturity::<T>::get(id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            EulogyDeposits::<T>::remove(id);
            EulogyMaturity::<T>::remove(id);
            Self::deposit_event(Event::EulogyDepositRefunded(id, who, amt));
            Ok(())
        }

        // ============== 治理专用最终落地接口（无私钥路径） ==============
        /// 函数级中文注释：【治理】代表 owner 设置文章。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_article_for(
            origin: OriginFor<T>,
            owner: T::AccountId,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
            title: Option<Vec<u8>>,
            summary: Option<Vec<u8>>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            ensure!(
                T::DeceasedProvider::can_manage(&owner, deceased_id),
                Error::<T>::NotAuthorized
            );
            let _ = Self::note_evidence(3u8, deceased_id.into(), evidence_cid)?;
            let cid_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            let title_bv = match title {
                Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                None => None,
            };
            let summary_bv = match summary {
                Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                None => None,
            };
            let id = NextTextId::<T>::get();
            NextTextId::<T>::put(id.saturating_add(T::TextId::from(1u64)));
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let rec = TextRecord::<T> {
                id,
                deceased_id,
                deceased_token: token,
                author: owner.clone(),
                kind: TextKind::Article,
                cid: cid_bv,
                title: title_bv,
                summary: summary_bv,
                created: now,
                updated: now,
            };
            TextOf::<T>::insert(id, rec);
            ArticlesByDeceased::<T>::try_mutate(deceased_id, |list| {
                list.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;
            let dep = T::TextDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&owner, dep).map_err(|_| Error::<T>::DepositFailed)?;
                TextDeposits::<T>::insert(id, (owner.clone(), dep));
                TextMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::ArticleSet(id, deceased_id, owner));
            Ok(())
        }
    }
}
