#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use sp_core::Get;
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
    use sp_core::blake2_256;
	use sp_runtime::traits::Saturating;
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
        /// 函数级中文注释：每 (domain,target_id) 允许的最大证据条数（提交维度，链接不计数）。
        #[pallet::constant]
        type MaxPerSubjectTarget: Get<u32>;
        /// 函数级中文注释：每 (ns,subject_id) 允许的最大证据条数（commit_hash 维度）。
        #[pallet::constant]
        type MaxPerSubjectNs: Get<u32>;
        /// 函数级中文注释：账号限频窗口大小（块）。
        #[pallet::constant]
        type WindowBlocks: Get<BlockNumberFor<Self>>;
        /// 函数级中文注释：窗口内账号最多允许的提交次数。
        #[pallet::constant]
        type MaxPerWindow: Get<u32>;
        /// 函数级中文注释：启用 Plain 模式全局 CID 去重（blake2_256）。
        #[pallet::constant]
        type EnableGlobalCidDedup: Get<bool>;
        /// 函数级中文注释：只读分页返回上限（防御性限制）。
        #[pallet::constant]
        type MaxListLen: Get<u32>;
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

    /// 函数级中文注释：Plain 模式全局 CID 去重索引（可选）。
    /// - key 为 blake2_256(cid)；value 为 EvidenceId（首次出现的记录）。
    #[pallet::storage]
    pub type CidHashIndex<T: Config> = StorageMap<_, Blake2_128Concat, H256, u64, OptionQuery>;

    /// 函数级中文注释：每主体（domain,target）下的证据提交计数（链接操作不计数）。
    #[pallet::storage]
    pub type EvidenceCountByTarget<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), u32, ValueQuery>;

    /// 函数级中文注释：每主体（ns,subject_id）下的证据提交计数（commit_hash 路径）。
    #[pallet::storage]
    pub type EvidenceCountByNs<T: Config> = StorageMap<_, Blake2_128Concat, ([u8; 8], u64), u32, ValueQuery>;

    /// 函数级中文注释：账户限频窗口存储（窗口起点与计数）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    pub struct WindowInfo<BlockNumber> { pub window_start: BlockNumber, pub count: u32 }
    #[pallet::storage]
    pub type AccountWindows<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, WindowInfo<BlockNumberFor<T>>, ValueQuery>;

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
        /// 函数级中文注释：因限频或配额被限制（便于前端提示）。
        EvidenceThrottled(T::AccountId, u8 /*reason_code: 1=RateLimited,2=Quota*/ ),
        /// 函数级中文注释：达到主体配额上限。
        EvidenceQuotaReached(u8 /*0=target,1=ns*/, u64 /*subject_id or target_id*/ ),
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
        /// 账号在窗口内达到提交上限
        RateLimited,
        /// 该主体已达到最大证据条数
        TooManyForSubject,
        /// 全局 CID 去重命中（Plain 模式）
        DuplicateCidGlobal,
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
			// 限频与配额
			let now = <frame_system::Pallet<T>>::block_number();
			Self::touch_window(&who, now)?;
			let cnt = EvidenceCountByTarget::<T>::get((domain, target_id));
			ensure!(cnt < T::MaxPerSubjectTarget::get(), Error::<T>::TooManyForSubject);
			// 校验 CID（长度/格式/重复）与数量上限
			Self::validate_cid_vec(&imgs)?;
			Self::validate_cid_vec(&vids)?;
			Self::validate_cid_vec(&docs)?;
			// 可选全局去重
			Self::ensure_global_cid_unique([&imgs, &vids, &docs])?;
			let imgs_bounded: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxImg> = imgs.try_into().map_err(|_| Error::<T>::TooManyImages)?;
			let vids_bounded: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxVid> = vids.try_into().map_err(|_| Error::<T>::TooManyVideos)?;
			let docs_bounded: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxDoc> = docs.try_into().map_err(|_| Error::<T>::TooManyDocs)?;
			let id = NextEvidenceId::<T>::mutate(|n| { let id = *n; *n = n.saturating_add(1); id });
			let ev = Evidence { id, domain, target_id, owner: who.clone(), imgs: imgs_bounded, vids: vids_bounded, docs: docs_bounded, memo, commit: None, ns: Some(ns) };
			Evidences::<T>::insert(id, &ev);
			EvidenceByTarget::<T>::insert((domain, target_id), id, ());
			// 计数 + 去重索引落库
			EvidenceCountByTarget::<T>::insert((domain, target_id), cnt.saturating_add(1));
			if T::EnableGlobalCidDedup::get() {
				for cid in ev.imgs.iter() { let h = H256::from(blake2_256(&cid.clone().into_inner())); if CidHashIndex::<T>::get(h).is_none() { CidHashIndex::<T>::insert(h, id); } }
				for cid in ev.vids.iter() { let h = H256::from(blake2_256(&cid.clone().into_inner())); if CidHashIndex::<T>::get(h).is_none() { CidHashIndex::<T>::insert(h, id); } }
				for cid in ev.docs.iter() { let h = H256::from(blake2_256(&cid.clone().into_inner())); if CidHashIndex::<T>::get(h).is_none() { CidHashIndex::<T>::insert(h, id); } }
			}

	// 只读方法移至模块外部以避免 non_local_definitions 警告在 -D warnings 下被提升为错误。
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
			// 限频与配额
			let now = <frame_system::Pallet<T>>::block_number();
			Self::touch_window(&who, now)?;
			let cnt = EvidenceCountByNs::<T>::get((ns, subject_id));
			ensure!(cnt < T::MaxPerSubjectNs::get(), Error::<T>::TooManyForSubject);
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
			EvidenceCountByNs::<T>::insert((ns, subject_id), cnt.saturating_add(1));
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

		// 只读接口应放置在 inherent impl 中，而非 extrinsics 块。
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
        /// 函数级中文注释：限频检查并计数。
        /// - 进入窗口：超过 WindowBlocks 自动滚动窗口并清零计数；严格小于最大次数方可提交。
        fn touch_window(who: &T::AccountId, now: BlockNumberFor<T>) -> Result<(), Error<T>> {
            AccountWindows::<T>::mutate(who, |w| {
                let wb = T::WindowBlocks::get();
                if now.saturating_sub(w.window_start) >= wb { w.window_start = now; w.count = 0; }
            });
            let info = AccountWindows::<T>::get(who);
            ensure!(info.count < T::MaxPerWindow::get(), Error::<T>::RateLimited);
            AccountWindows::<T>::mutate(who, |w| { w.count = w.count.saturating_add(1); });
            Ok(())
        }

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

        /// 函数级中文注释：可选的全局 CID 去重检查（Plain 模式）。
        /// - EnableGlobalCidDedup=true 时，逐个 CID 计算 blake2_256 并查重；首次出现时在提交成功后写入索引。
        fn ensure_global_cid_unique(list_groups: [&Vec<BoundedVec<u8, T::MaxCidLen>>; 3]) -> Result<(), Error<T>> {
            if !T::EnableGlobalCidDedup::get() { return Ok(()); }
            for list in list_groups.into_iter() {
                for cid in list.iter() {
                    let h = H256::from(blake2_256(&cid.clone().into_inner()));
                    if CidHashIndex::<T>::get(h).is_some() { return Err(Error::<T>::DuplicateCidGlobal); }
                }
            }
            Ok(())
        }
	}

}

// ===== 只读方法（模块外部，避免 non_local_definitions）=====
impl<T: pallet::Config> Pallet<T> {
    /// 函数级中文注释：只读-按 (domain,target) 分页列出 evidence id（从 start_id 起，最多 MaxListLen 条）。
    pub fn list_ids_by_target(domain: u8, target_id: u64, start_id: u64, limit: u32) -> alloc::vec::Vec<u64> {
        let mut out: alloc::vec::Vec<u64> = alloc::vec::Vec::new();
        let mut cnt: u32 = 0;
        let cap = core::cmp::min(limit, T::MaxListLen::get());
        for id in pallet::EvidenceByTarget::<T>::iter_key_prefix((domain, target_id)) {
            if id < start_id { continue; }
            out.push(id);
            cnt = cnt.saturating_add(1);
            if cnt >= cap { break; }
        }
        out
    }

    /// 函数级中文注释：只读-按 (ns,subject_id) 分页列出 evidence id（从 start_id 起，最多 MaxListLen 条）。
    pub fn list_ids_by_ns(ns: [u8; 8], subject_id: u64, start_id: u64, limit: u32) -> alloc::vec::Vec<u64> {
        let mut out: alloc::vec::Vec<u64> = alloc::vec::Vec::new();
        let mut cnt: u32 = 0;
        let cap = core::cmp::min(limit, T::MaxListLen::get());
        for id in pallet::EvidenceByNs::<T>::iter_key_prefix((ns, subject_id)) {
            if id < start_id { continue; }
            out.push(id);
            cnt = cnt.saturating_add(1);
            if cnt >= cap { break; }
        }
        out
    }

    /// 函数级中文注释：只读-获取主体证据数量。
    pub fn count_by_target(domain: u8, target_id: u64) -> u32 { pallet::EvidenceCountByTarget::<T>::get((domain, target_id)) }
    pub fn count_by_ns(ns: [u8; 8], subject_id: u64) -> u32 { pallet::EvidenceCountByNs::<T>::get((ns, subject_id)) }
}


