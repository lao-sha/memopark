#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

// 函数级中文注释：权重模块导入，提供 WeightInfo 接口用于基于输入规模计算交易权重。
pub mod weights;
#[cfg(feature = "runtime-benchmarks")]
pub mod benchmarking;

#[allow(deprecated)]
#[frame_support::pallet]
pub mod pallet {
	use super::*;
	use frame_support::{
		pallet_prelude::*,
		BoundedVec,
	};
	use frame_system::pallet_prelude::*;
	use alloc::vec::Vec;
	use sp_core::H256;
	use alloc::collections::BTreeSet;
	use crate::weights::WeightInfo;


	/// 函数级中文注释：共享证据（媒体）记录结构，存储跨域使用的图片/视频/文档的 IPFS CID（或哈希）。
	#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(MaxCidLen, MaxImg, MaxVid, MaxDoc, MaxMemoLen))]
	pub struct Evidence<
		AccountId,
		MaxCidLen: Get<u32>,
		MaxImg: Get<u32>,
		MaxVid: Get<u32>,
		MaxDoc: Get<u32>,
		MaxMemoLen: Get<u32>,
	> {
		pub id: u64,
		pub domain: u8,
		pub target_id: u64,
		pub owner: AccountId,
		pub imgs: BoundedVec<BoundedVec<u8, MaxCidLen>, MaxImg>,
		pub vids: BoundedVec<BoundedVec<u8, MaxCidLen>, MaxVid>,
		pub docs: BoundedVec<BoundedVec<u8, MaxCidLen>, MaxDoc>,
		pub memo: Option<BoundedVec<u8, MaxMemoLen>>,
		/// 新增：证据承诺（commit），例如 H(ns || subject_id || cid_enc || salt || ver)
		pub commit: Option<H256>,
		/// 新增：命名空间（8 字节），用于授权与分域检索
		pub ns: Option<[u8; 8]>,
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		#[allow(deprecated)]
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
		#[pallet::constant] type MaxCidLen: Get<u32>;
		#[pallet::constant] type MaxImg: Get<u32>;
		#[pallet::constant] type MaxVid: Get<u32>;
		#[pallet::constant] type MaxDoc: Get<u32>;
		#[pallet::constant] type MaxMemoLen: Get<u32>;
		/// 通过 Authorizer 控制谁可提交/链接证据
		#[pallet::constant] type EvidenceNsBytes: Get<[u8; 8]>;
		/// 授权适配器：由 runtime 桥接到 pallet-authorizer，避免本 Pallet 直接依赖其 Config 约束
		type Authorizer: EvidenceAuthorizer<Self::AccountId>;
		/// 权重信息接口：由 runtime 提供自动生成或手写的权重实现
		type WeightInfo: WeightInfo;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::storage]
	pub type NextEvidenceId<T: Config> = StorageValue<_, u64, ValueQuery>;
	#[pallet::storage]
	pub type Evidences<T: Config> = StorageMap<_, Blake2_128Concat, u64, Evidence<
		T::AccountId, T::MaxCidLen, T::MaxImg, T::MaxVid, T::MaxDoc, T::MaxMemoLen
	>, OptionQuery>;
	#[pallet::storage]
	pub type EvidenceByTarget<T: Config> = StorageDoubleMap<_, Blake2_128Concat, (u8, u64), Blake2_128Concat, u64, (), OptionQuery>;

	/// 新增：按命名空间+主体键值引用证据 id（便于按 ns/subject_id 聚合）
	#[pallet::storage]
	pub type EvidenceByNs<T: Config> = StorageDoubleMap<_, Blake2_128Concat, ([u8; 8], u64), Blake2_128Concat, u64, (), OptionQuery>;

	/// 新增：承诺哈希到 EvidenceId 的唯一索引，防止重复提交
	#[pallet::storage]
	pub type CommitIndex<T: Config> = StorageMap<_, Blake2_128Concat, H256, u64, OptionQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		EvidenceCommitted { id: u64, domain: u8, target_id: u64, owner: T::AccountId },
		EvidenceLinked { domain: u8, target_id: u64, id: u64 },
		EvidenceUnlinked { domain: u8, target_id: u64, id: u64 },
		/// 新增：V2 事件，按命名空间与主体提交/链接
		EvidenceCommittedV2 { id: u64, ns: [u8; 8], subject_id: u64, owner: T::AccountId },
		EvidenceLinkedV2 { ns: [u8; 8], subject_id: u64, id: u64 },
		EvidenceUnlinkedV2 { ns: [u8; 8], subject_id: u64, id: u64 },
	}

	#[pallet::error]
	pub enum Error<T> {
		/// 权限不足（命名空间或账户不被授权）
		NotAuthorized,
		/// 未找到目标对象
		NotFound,
		/// 图片数量超过上限
		TooManyImages,
		/// 视频数量超过上限
		TooManyVideos,
		/// 文档数量超过上限
		TooManyDocs,
		/// CID 长度或格式非法（非可见 ASCII 或为空）
		InvalidCidFormat,
		/// 发现重复的 CID 输入
		DuplicateCid,
		/// 提交的承诺已存在（防重）
		CommitAlreadyExists,
		/// 证据命名空间与当前操作命名空间不匹配
		NamespaceMismatch,
	}

	#[allow(deprecated)]
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 函数级中文注释：提交证据，生成 EvidenceId 并落库；仅授权账户可提交。
		#[pallet::call_index(0)]
		#[allow(deprecated)]
		#[pallet::weight(T::WeightInfo::commit(imgs.len() as u32, vids.len() as u32, docs.len() as u32))]
		pub fn commit(
			origin: OriginFor<T>,
			domain: u8,
			target_id: u64,
			imgs: Vec<BoundedVec<u8, T::MaxCidLen>>,
			vids: Vec<BoundedVec<u8, T::MaxCidLen>>,
			docs: Vec<BoundedVec<u8, T::MaxCidLen>>,
			memo: Option<BoundedVec<u8, T::MaxMemoLen>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			// Authorizer 鉴权（通过适配器，解耦到 runtime）
			let ns = T::EvidenceNsBytes::get();
			ensure!(<T as Config>::Authorizer::is_authorized(ns, &who), Error::<T>::NotAuthorized);
			// 校验 CID（长度/格式/重复）与数量上限
			Self::validate_cid_vec(&imgs)?;
			Self::validate_cid_vec(&vids)?;
			Self::validate_cid_vec(&docs)?;
			let imgs_bounded: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxImg> = imgs.try_into().map_err(|_| Error::<T>::TooManyImages)?;
			let vids_bounded: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxVid> = vids.try_into().map_err(|_| Error::<T>::TooManyVideos)?;
			let docs_bounded: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxDoc> = docs.try_into().map_err(|_| Error::<T>::TooManyDocs)?;
			let id = NextEvidenceId::<T>::mutate(|n| { let id = *n; *n = n.saturating_add(1); id });
			let ev = Evidence { id, domain, target_id, owner: who.clone(), imgs: imgs_bounded, vids: vids_bounded, docs: docs_bounded, memo, commit: None, ns: Some(ns) };
			Evidences::<T>::insert(id, &ev);
			EvidenceByTarget::<T>::insert((domain, target_id), id, ());
			Self::deposit_event(Event::EvidenceCommitted { id, domain, target_id, owner: who });
			Ok(())
		}

		/// 函数级中文注释（V2）：仅登记承诺哈希（不在链上存储任何明文/可逆 CID）。
		/// - ns：8 字节命名空间（如 b"kyc_____"、b"otc_ord_"）。
		/// - subject_id：业务主体 id（如订单号、账户短码等）。
		/// - commit：承诺哈希（例如 blake2b256(ns||subject_id||cid_enc||salt||ver)）。
		#[pallet::call_index(1)]
		#[allow(deprecated)]
		#[pallet::weight(T::WeightInfo::commit_hash())]
		pub fn commit_hash(
			origin: OriginFor<T>,
			ns: [u8; 8],
			subject_id: u64,
			commit: H256,
			memo: Option<BoundedVec<u8, T::MaxMemoLen>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(<T as Config>::Authorizer::is_authorized(ns, &who), Error::<T>::NotAuthorized);
			// 防重：承诺哈希唯一
			ensure!(CommitIndex::<T>::get(commit).is_none(), Error::<T>::CommitAlreadyExists);
			let id = NextEvidenceId::<T>::mutate(|n| { let id = *n; *n = n.saturating_add(1); id });
			let empty_imgs: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxImg> = Default::default();
			let empty_vids: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxVid> = Default::default();
			let empty_docs: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxDoc> = Default::default();
			let ev = Evidence {
				id,
				domain: 0,
				target_id: subject_id,
				owner: who.clone(),
				imgs: empty_imgs,
				vids: empty_vids,
				docs: empty_docs,
				memo,
				commit: Some(commit),
				ns: Some(ns),
			};
			Evidences::<T>::insert(id, &ev);
			EvidenceByNs::<T>::insert((ns, subject_id), id, ());
			CommitIndex::<T>::insert(commit, id);
			Self::deposit_event(Event::EvidenceCommittedV2 { id, ns, subject_id, owner: who });
			Ok(())
		}

		/// 函数级中文注释：为目标链接已存在的证据（允许复用）；仅授权账户可调用。
		#[pallet::call_index(2)]
		#[allow(deprecated)]
		#[pallet::weight(T::WeightInfo::link())]
		pub fn link(origin: OriginFor<T>, domain: u8, target_id: u64, id: u64) -> DispatchResult {
			let who = ensure_signed(origin)?;
			let ev = Evidences::<T>::get(id).ok_or(Error::<T>::NotFound)?;
			let ev_ns = ev.ns.ok_or(Error::<T>::NamespaceMismatch)?;
			ensure!(<T as Config>::Authorizer::is_authorized(ev_ns, &who), Error::<T>::NotAuthorized);
			EvidenceByTarget::<T>::insert((domain, target_id), id, ());
			Self::deposit_event(Event::EvidenceLinked { domain, target_id, id });
			Ok(())
		}

		/// 函数级中文注释（V2）：按命名空间与主体链接既有证据 id（仅保存引用，不触碰明文）。
		#[pallet::call_index(3)]
		#[allow(deprecated)]
		#[pallet::weight(T::WeightInfo::link_by_ns())]
		pub fn link_by_ns(origin: OriginFor<T>, ns: [u8; 8], subject_id: u64, id: u64) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(<T as Config>::Authorizer::is_authorized(ns, &who), Error::<T>::NotAuthorized);
			let ev = Evidences::<T>::get(id).ok_or(Error::<T>::NotFound)?;
			let ev_ns = ev.ns.ok_or(Error::<T>::NamespaceMismatch)?;
			ensure!(ev_ns == ns, Error::<T>::NamespaceMismatch);
			EvidenceByNs::<T>::insert((ns, subject_id), id, ());
			Self::deposit_event(Event::EvidenceLinkedV2 { ns, subject_id, id });
			Ok(())
		}

		/// 函数级中文注释：取消目标与证据的链接；仅授权账户可调用。
		#[pallet::call_index(4)]
		#[allow(deprecated)]
		#[pallet::weight(T::WeightInfo::unlink())]
		pub fn unlink(origin: OriginFor<T>, domain: u8, target_id: u64, id: u64) -> DispatchResult {
			let who = ensure_signed(origin)?;
			let ev = Evidences::<T>::get(id).ok_or(Error::<T>::NotFound)?;
			let ev_ns = ev.ns.ok_or(Error::<T>::NamespaceMismatch)?;
			ensure!(<T as Config>::Authorizer::is_authorized(ev_ns, &who), Error::<T>::NotAuthorized);
			EvidenceByTarget::<T>::remove((domain, target_id), id);
			Self::deposit_event(Event::EvidenceUnlinked { domain, target_id, id });
			Ok(())
		}

		/// 函数级中文注释（V2）：按命名空间与主体取消链接。
		#[pallet::call_index(5)]
		#[allow(deprecated)]
		#[pallet::weight(T::WeightInfo::unlink_by_ns())]
		pub fn unlink_by_ns(origin: OriginFor<T>, ns: [u8; 8], subject_id: u64, id: u64) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(<T as Config>::Authorizer::is_authorized(ns, &who), Error::<T>::NotAuthorized);
			let ev = Evidences::<T>::get(id).ok_or(Error::<T>::NotFound)?;
			let ev_ns = ev.ns.ok_or(Error::<T>::NamespaceMismatch)?;
			ensure!(ev_ns == ns, Error::<T>::NamespaceMismatch);
			EvidenceByNs::<T>::remove((ns, subject_id), id);
			Self::deposit_event(Event::EvidenceUnlinkedV2 { ns, subject_id, id });
			Ok(())
		}
	}

	/// 授权适配接口：由 runtime 实现并桥接到 `pallet-authorizer`，以保持低耦合。
	pub trait EvidenceAuthorizer<AccountId> {
		/// 校验某账户是否在给定命名空间下被授权提交/链接证据
		fn is_authorized(ns: [u8; 8], who: &AccountId) -> bool;
	}

	/// 只读查询 trait 占位：供其他 pallet 低耦合读取证据（可在 runtime 或外部实现）。
	pub trait EvidenceProvider<AccountId> {
		/// 返回指定 ID 的证据；本 Pallet 不提供默认实现，避免类型推断问题。
		fn get(_id: u64) -> Option<()>;
	}

	impl<T: Config> Pallet<T> {
		/// 函数级中文注释：校验一组 CID 的格式与去重要求。
		/// 规则：每个 CID 必须非空、全部为可见 ASCII（0x21..=0x7E）；组内不得重复。
		fn validate_cid_vec(list: &Vec<BoundedVec<u8, T::MaxCidLen>>) -> Result<(), Error<T>> {
			let mut set: BTreeSet<Vec<u8>> = BTreeSet::new();
			for cid in list.iter() {
				if cid.is_empty() { return Err(Error::<T>::InvalidCidFormat); }
				for b in cid.iter() { if *b < 0x21 || *b > 0x7E { return Err(Error::<T>::InvalidCidFormat); } }
				let v: Vec<u8> = cid.clone().into_inner();
				if !set.insert(v) { return Err(Error::<T>::DuplicateCid); }
			}
			Ok(())
		}
	}

}


