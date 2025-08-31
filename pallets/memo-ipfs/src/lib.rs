#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, Get, ReservableCurrency},
    BoundedVec,
};
use frame_system::{
    pallet_prelude::*,
    offchain::{AppCrypto, CreateSignedTransaction, Signer},
};
use pallet_memo_endowment::EndowmentInterface;
use sp_core::crypto::KeyTypeId;
use sp_runtime::{offchain::{http, StorageKind, storage_lock::{StorageLock, BlockAndTime}}, traits::AtLeast32BitUnsigned};
use sp_std::{vec::Vec, str};
use codec::Encode;
use alloc::string::String;
use serde_json::Value as JsonValue;

pub use pallet::*;

/// 专用 Offchain 签名 KeyType。注意：需要在节点端注册对应密钥。
pub const KEY_TYPE: KeyTypeId = KeyTypeId(*b"ipfs");

/// 函数级详细中文注释：OCW 专用签名算法类型
/// - 使用 sr25519 作为默认曲线；
/// - 节点 keystore 中通过 `--key` 或 RPC 注入该类型的密钥；
pub mod sr25519_app {
    use super::KEY_TYPE;
    use sp_application_crypto::{app_crypto, sr25519};
    app_crypto!(sr25519, KEY_TYPE);
}

pub type AuthorityId = sr25519_app::Public;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    /// 余额别名
    pub type BalanceOf<T> = <T as Config>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config + CreateSignedTransaction<Call<Self>> {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 货币接口（用于预留押金或扣费）
        type Currency: Currency<Self::AccountId, Balance = Self::Balance> + ReservableCurrency<Self::AccountId>;
        /// 余额类型
        type Balance: Parameter + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// Endowment 接口（将一次性费用打入基金会）
        type Endowment: EndowmentInterface<Self::AccountId, BalanceOf<Self>, Self::Hash>;

        /// 治理 Origin（用于参数/黑名单/配额）
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// OCW 签名标识
        type AuthorityId: AppCrypto<Self::Public, Self::Signature>;

        /// 最大支持的 `cid_hash` 长度（字节）
        #[pallet::constant]
        type MaxCidHashLen: Get<u32>;

        /// 最大支持的 PeerId 字节长度（Base58 文本或多地址指纹摘要）
        #[pallet::constant]
        type MaxPeerIdLen: Get<u32>;

        /// 最小运营者保证金（MEMO 最小单位）
        #[pallet::constant]
        type MinOperatorBond: Get<Self::Balance>;

        /// 最小可宣告容量（GiB）
        #[pallet::constant]
        type MinCapacityGiB: Get<u32>;

        /// 权重信息占位
        type WeightInfo: WeightInfo;
    }

    #[pallet::pallet]
    #[pallet::storage_version(StorageVersion::new(0))]
    pub struct Pallet<T>(_);

    /// 定价参数原始字节（骨架）
    #[pallet::storage]
    pub type PricingParams<T: Config> = StorageValue<_, Vec<u8>, ValueQuery>;

    /// Pin 订单：存储 `cid_hash` 等元数据（骨架）
    #[pallet::storage]
    pub type PendingPins<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, (T::AccountId, u32, u64, T::Balance), OptionQuery>;

    /// Pin 元信息（副本数、大小、创建时间、最后巡检）
    #[pallet::storage]
    pub type PinMeta<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, (u32, u64, BlockNumberFor<T>, BlockNumberFor<T>), OptionQuery>;

    /// Pin 状态机：0=Requested,1=Pinning,2=Pinned,3=Degraded,4=Failed
    #[pallet::storage]
    pub type PinStateOf<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, u8, ValueQuery>;

    /// 副本分配：为每个 cid_hash 挑选的运营者账户
    #[pallet::storage]
    pub type PinAssignments<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, BoundedVec<T::AccountId, frame_support::traits::ConstU32<16>>, OptionQuery>;

    /// 分配内的成功标记：(cid_hash, operator) -> 成功与否
    #[pallet::storage]
    pub type PinSuccess<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::Hash, Blake2_128Concat, T::AccountId, bool, ValueQuery>;

    /// 运营者信息
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct OperatorInfo<T: Config> {
        pub peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
        pub capacity_gib: u32,
        pub endpoint_hash: T::Hash,
        pub cert_fingerprint: Option<T::Hash>,
        pub status: u8, // 0=Active,1=Suspended,2=Banned
    }

    /// 运营者注册表与保证金
    #[pallet::storage]
    pub type Operators<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, OperatorInfo<T>, OptionQuery>;

    #[pallet::storage]
    pub type OperatorBond<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

    /// 运营者 SLA 统计
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    #[scale_info(skip_type_params(T))]
    pub struct SlaStats<T: Config> {
        pub pinned_bytes: u64,
        pub probe_ok: u32,
        pub probe_fail: u32,
        pub degraded: u32,
        pub last_update: BlockNumberFor<T>,
    }

    #[pallet::storage]
    pub type OperatorSla<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, SlaStats<T>, ValueQuery>;

    /// 事件
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 请求已受理（cid_hash, payer, replicas, size, price）
        PinRequested(T::Hash, T::AccountId, u32, u64, T::Balance),
        /// 已提交到 ipfs-cluster（cid_hash）
        PinSubmitted(T::Hash),
        /// 标记已 Pin 成功（cid_hash, replicas）
        PinMarkedPinned(T::Hash, u32),
        /// 标记 Pin 失败（cid_hash, code）
        PinMarkedFailed(T::Hash, u16),
        /// 运营者相关事件
        OperatorJoined(T::AccountId),
        OperatorUpdated(T::AccountId),
        OperatorLeft(T::AccountId),
        OperatorStatusChanged(T::AccountId, u8),
        /// 运营者探测结果（ok=true 表示在线且集群识别到该 Peer）
        OperatorProbed(T::AccountId, bool),
        /// 创建了副本分配（cid_hash, count）
        AssignmentCreated(T::Hash, u32),
        /// 状态迁移（cid_hash, state）
        PinStateChanged(T::Hash, u8),
        /// 副本降级与修复（cid_hash, operator）
        ReplicaDegraded(T::Hash, T::AccountId),
        ReplicaRepaired(T::Hash, T::AccountId),
        /// 降级累计达到告警阈值（operator, degraded_count）
        OperatorDegradationAlert(T::AccountId, u32),
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 参数非法
        BadParams,
        /// 订单不存在
        OrderNotFound,
        /// 运营者不存在
        OperatorNotFound,
        /// 运营者已存在
        OperatorExists,
        /// 运营者已被禁用
        OperatorBanned,
        /// 保证金不足
        InsufficientBond,
        /// 容量不足
        InsufficientCapacity,
        /// 无效状态
        BadStatus,
        /// 分配不存在
        AssignmentNotFound,
        /// 仍存在未完成的副本分配，禁止退出
        HasActiveAssignments,
        /// 调用方未被指派到该内容的副本分配中
        OperatorNotAssigned,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：CID 解密/映射接口（OCW 本地）
        /// - 从 offchain local storage 读取 `/memo/ipfs/cid/<hash_hex>` → 明文 CID 字符串；
        /// - 若不存在则返回占位 `"<redacted>"`，让上层逻辑启用退避而不报错。
        fn resolve_cid(cid_hash: &T::Hash) -> alloc::string::String {
            let mut key = b"/memo/ipfs/cid/".to_vec();
            let hex = hex::encode(cid_hash.as_ref());
            key.extend_from_slice(hex.as_bytes());
            if let Some(bytes) = sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, &key) {
                if let Ok(s) = core::str::from_utf8(&bytes) { return s.into(); }
            }
            "<redacted>".into()
        }
        /// 函数级详细中文注释：用户请求 Pin（一次性付费进入基金会）
        /// - 输入为 `cid_hash`（避免泄露明文 CID）、大小与副本数；
        /// - 价格计算在链上依据 `PricingParams` 得出；当前骨架由外部直接给出 `price`；
        /// - 将 `price` 转入基金会（Endowment）并记录订单，等待 OCW 提交到 ipfs-cluster。
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::request_pin())]
        pub fn request_pin(
            origin: OriginFor<T>,
            cid_hash: T::Hash,
            size_bytes: u64,
            replicas: u32,
            price: T::Balance,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(replicas >= 1 && size_bytes > 0, Error::<T>::BadParams);
            T::Endowment::deposit_from_storage(&who, price, cid_hash)?;
            PendingPins::<T>::insert(&cid_hash, (who.clone(), replicas, size_bytes, price));
            let now = <frame_system::Pallet<T>>::block_number();
            PinMeta::<T>::insert(&cid_hash, (replicas, size_bytes, now, now));
            PinStateOf::<T>::insert(&cid_hash, 0u8); // Requested
            Self::deposit_event(Event::PinRequested(cid_hash, who, replicas, size_bytes, price));
            Ok(())
        }

        /// 函数级详细中文注释：OCW 上报标记已 Pin 成功
        /// - 需要节点 keystore 的专用 key 签名；
        /// - 仅更新状态并发出事件（骨架）。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::mark_pinned())]
        pub fn mark_pinned(origin: OriginFor<T>, cid_hash: T::Hash, replicas: u32) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 仅允许活跃运营者上报
            let op = Operators::<T>::get(&who).ok_or(Error::<T>::OperatorNotFound)?;
            ensure!(op.status == 0, Error::<T>::OperatorBanned);
            ensure!(PendingPins::<T>::contains_key(&cid_hash), Error::<T>::OrderNotFound);
            // 必须是该 cid 的指派运营者之一
            if let Some(assign) = PinAssignments::<T>::get(&cid_hash) {
                ensure!(assign.iter().any(|a| a == &who), Error::<T>::OperatorNotAssigned);
            } else { return Err(Error::<T>::AssignmentNotFound.into()); }
            // 标记该运营者完成
            PinSuccess::<T>::insert(&cid_hash, &who, true);
            // 达到副本数则完成
            if let Some((expect, _size, _created, _last)) = PinMeta::<T>::get(&cid_hash) {
                let mut ok_count: u32 = 0;
                if let Some(ops) = PinAssignments::<T>::get(&cid_hash) {
                    for o in ops.iter() {
                        if PinSuccess::<T>::get(&cid_hash, o) { ok_count = ok_count.saturating_add(1); }
                    }
                }
                if ok_count >= expect {
                    // 清理 pending，设置状态
                    PendingPins::<T>::remove(&cid_hash);
                    PinStateOf::<T>::insert(&cid_hash, 2u8); // Pinned
                    Self::deposit_event(Event::PinStateChanged(cid_hash, 2));
                } else {
                    PinStateOf::<T>::insert(&cid_hash, 1u8); // Pinning
                    Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
                }
            }
            Self::deposit_event(Event::PinMarkedPinned(cid_hash, replicas));
            Ok(())
        }

        /// 函数级详细中文注释：OCW 上报标记 Pin 失败
        /// - 记录错误码，便于外部审计。
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::mark_pin_failed())]
        pub fn mark_pin_failed(origin: OriginFor<T>, cid_hash: T::Hash, code: u16) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let op = Operators::<T>::get(&who).ok_or(Error::<T>::OperatorNotFound)?;
            ensure!(op.status == 0, Error::<T>::OperatorBanned);
            ensure!(PendingPins::<T>::contains_key(&cid_hash), Error::<T>::OrderNotFound);
            if let Some(assign) = PinAssignments::<T>::get(&cid_hash) {
                ensure!(assign.iter().any(|a| a == &who), Error::<T>::OperatorNotAssigned);
            } else { return Err(Error::<T>::AssignmentNotFound.into()); }
            // 标记失败并置为 Pinning/Failed
            PinSuccess::<T>::insert(&cid_hash, &who, false);
            PinStateOf::<T>::insert(&cid_hash, 1u8);
            Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
            Self::deposit_event(Event::PinMarkedFailed(cid_hash, code));
            Ok(())
        }

        /// 函数级详细中文注释：申请成为运营者并存入保证金
        /// - 要求容量 >= MinCapacityGiB，保证金 >= MinOperatorBond；
        /// - 保证金使用可保留余额（reserve），离开时解保留。
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn join_operator(
            origin: OriginFor<T>,
            peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
            capacity_gib: u32,
            endpoint_hash: T::Hash,
            cert_fingerprint: Option<T::Hash>,
            bond: BalanceOf<T>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(!Operators::<T>::contains_key(&who), Error::<T>::OperatorExists);
            ensure!(capacity_gib >= T::MinCapacityGiB::get(), Error::<T>::InsufficientCapacity);
            ensure!(bond >= T::MinOperatorBond::get(), Error::<T>::InsufficientBond);
            // 保证金保留
            <T as Config>::Currency::reserve(&who, bond)?;
            OperatorBond::<T>::insert(&who, bond);
            let info = OperatorInfo::<T>{ peer_id, capacity_gib, endpoint_hash, cert_fingerprint, status: 0 };
            Operators::<T>::insert(&who, info);
            Self::deposit_event(Event::OperatorJoined(who));
            Ok(())
        }

        /// 函数级详细中文注释：更新运营者元信息（不影响保证金）
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn update_operator(
            origin: OriginFor<T>,
            peer_id: Option<BoundedVec<u8, T::MaxPeerIdLen>>,
            capacity_gib: Option<u32>,
            endpoint_hash: Option<T::Hash>,
            cert_fingerprint: Option<Option<T::Hash>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Operators::<T>::try_mutate(&who, |maybe| -> DispatchResult {
                let op = maybe.as_mut().ok_or(Error::<T>::OperatorNotFound)?;
                if let Some(p) = peer_id { op.peer_id = p; }
                if let Some(c) = capacity_gib { ensure!(c >= T::MinCapacityGiB::get(), Error::<T>::InsufficientCapacity); op.capacity_gib = c; }
                if let Some(h) = endpoint_hash { op.endpoint_hash = h; }
                if let Some(cf) = cert_fingerprint { op.cert_fingerprint = cf; }
                Ok(())
            })?;
            Self::deposit_event(Event::OperatorUpdated(who));
            Ok(())
        }

        /// 函数级详细中文注释：退出运营者并解保留保证金（需无未完成订单，MVP 略过校验）
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn leave_operator(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Operators::<T>::contains_key(&who), Error::<T>::OperatorNotFound);
            // 退出校验：不得出现在任何分配中（MVP：线性扫描）
            for (_cid, ops) in PinAssignments::<T>::iter() {
                if ops.iter().any(|o| o == &who) { return Err(Error::<T>::HasActiveAssignments.into()); }
            }
            Operators::<T>::remove(&who);
            let bond = OperatorBond::<T>::take(&who);
            if !bond.is_zero() { let _ = <T as Config>::Currency::unreserve(&who, bond); }
            Self::deposit_event(Event::OperatorLeft(who));
            Ok(())
        }

        /// 函数级详细中文注释：治理设置运营者状态（0=Active,1=Suspended,2=Banned）
        #[pallet::call_index(6)]
        #[pallet::weight(10_000)]
        pub fn set_operator_status(origin: OriginFor<T>, who: T::AccountId, status: u8) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            Operators::<T>::try_mutate(&who, |maybe| -> DispatchResult {
                let op = maybe.as_mut().ok_or(Error::<T>::OperatorNotFound)?;
                op.status = status; Ok(())
            })?;
            Self::deposit_event(Event::OperatorStatusChanged(who, status));
            Ok(())
        }

        /// 函数级详细中文注释：运营者自证在线（由运行其节点的 OCW 定期上报）
        /// - 探测逻辑在 OCW：若 /peers 含有自身 peer_id → ok=true，否则 false。
        #[pallet::call_index(7)]
        #[pallet::weight(10_000)]
        pub fn report_probe(origin: OriginFor<T>, ok: bool) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let op = Operators::<T>::get(&who).ok_or(Error::<T>::OperatorNotFound)?;
            ensure!(op.status == 0, Error::<T>::BadStatus);
            OperatorSla::<T>::mutate(&who, |s| {
                if ok { s.probe_ok = s.probe_ok.saturating_add(1); } else { s.probe_fail = s.probe_fail.saturating_add(1); }
                s.last_update = <frame_system::Pallet<T>>::block_number();
            });
            Self::deposit_event(Event::OperatorProbed(who, ok));
            Ok(())
        }

        /// 函数级详细中文注释：治理扣罚运营者的保证金（阶梯惩罚使用）。
        #[pallet::call_index(8)]
        #[pallet::weight(10_000)]
        pub fn slash_operator(origin: OriginFor<T>, who: T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(Operators::<T>::contains_key(&who), Error::<T>::OperatorNotFound);
            let (slashed, _remaining) = <T as Config>::Currency::slash_reserved(&who, amount);
            // 记录剩余 bond（无法直接得知，简化为读取原值再减去 slashed）
            let old = OperatorBond::<T>::get(&who);
            let new = old.saturating_sub(slashed);
            OperatorBond::<T>::insert(&who, new);
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：Offchain Worker 入口
        /// - 周期性扫描 `PendingPins`，对每个 `cid_hash` 调用 ipfs-cluster API 进行 Pin；
        /// - 成功则提交 `mark_pinned`，失败则提交 `mark_pin_failed`；
        /// - HTTP 令牌与集群端点从本地 offchain storage 读取，避免上链泄露。
        fn offchain_worker(_n: BlockNumberFor<T>) {
            // 读取本地配置（示例键）："/memo/ipfs/cluster_endpoint" 与 "/memo/ipfs/token"
            let endpoint = sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, b"/memo/ipfs/cluster_endpoint")
                .and_then(|v| str::from_utf8(&v).ok().map(|s| s.to_string()))
                .unwrap_or_else(|| "http://127.0.0.1:9094".into());
            let token = sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, b"/memo/ipfs/token")
                .and_then(|v| str::from_utf8(&v).ok().map(|s| s.to_string()));

            // 分配与 Pin：遍历 PendingPins，若无分配则创建；否则尝试 POST /pins 携带 allocations
            if let Some((cid_hash, (_payer, replicas, _size, _price))) = <PendingPins<T>>::iter().next() {
                // 若未分配，则挑选活跃运营者账户（简化：取前 N 个）
                if PinAssignments::<T>::get(&cid_hash).is_none() {
                    let mut selected: BoundedVec<T::AccountId, frame_support::traits::ConstU32<16>> = Default::default();
                    for (op_acc, info) in Operators::<T>::iter() {
                        if info.status == 0 { let _ = selected.try_push(op_acc); }
                        if (selected.len() as u32) >= replicas { break; }
                    }
                    if !selected.is_empty() { PinAssignments::<T>::insert(&cid_hash, &selected); Self::deposit_event(Event::AssignmentCreated(cid_hash, selected.len() as u32)); }
                }
                // 发起 Pin 请求（MVP 不在 body 中传 allocations，真实集群应携带）
                let _ = Self::submit_pin_request::<T>(&endpoint, &token, cid_hash);
                PinStateOf::<T>::insert(&cid_hash, 1u8);
                Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
            }

            // 探测自身是否在线（运营者必须运行集群节点）：读取 /peers 并查找自身 peer_id
            let peers_resp = Self::http_get_bytes(&endpoint, &token, "/peers");
            if let Some(body) = peers_resp {
                // 使用任意本地签名账户（期望为运营者账户）上报探测结果
                let signer = Signer::<T, T::AuthorityId>::any_account();
                if let Some((acc, _)) = signer.account() {
                    if let Some(op) = Operators::<T>::get(&acc.id) {
                        let ok = body.windows(op.peer_id.len()).any(|w| w == op.peer_id.as_slice());
                        let _ = signer.send_signed_transaction(|_acct| Call::report_probe { ok });
                    }
                }
            }

            // 巡检：针对已 Pinned/Pinning 的对象，GET /pins/{cid} 矫正副本；若缺少则再 Pin
            // 注意：演示中未持有明文 CID，这里仅示意调用；生产需有 CID 解密/映射。
            // 逻辑：遍历 PinStateOf in {1=Pinning,2=Pinned}，若 assignments 存在，检查成功标记数；不足副本则再次发起 submit_pin_request。
            for (cid_hash, state) in PinStateOf::<T>::iter() {
                if state == 1u8 || state == 2u8 {
                    if let Some(assign) = PinAssignments::<T>::get(&cid_hash) {
                        let expect = PinMeta::<T>::get(&cid_hash).map(|m| m.0).unwrap_or(assign.len() as u32);
                        let mut ok_count: u32 = 0;
                        for o in assign.iter() { if PinSuccess::<T>::get(&cid_hash, o) { ok_count = ok_count.saturating_add(1); } }
                        if ok_count < expect {
                            // 解析 /pins/{cid}，对比分配并触发降级/修复事件
                            let cid_str = Self::resolve_cid(&cid_hash);
                            if let Some(body) = Self::submit_get_pin_status_collect(&endpoint, &token, &cid_str) {
                                let mut online_peers: Vec<Vec<u8>> = Vec::new();
                                if let Ok(json) = serde_json::from_slice::<JsonValue>(&body) {
                                    // 兼容两类结构：{peer_map:{"peerid":{status:"pinned"|...}}} 或 {allocations:["peerid",...]}
                                    if let Some(map) = json.get("peer_map").and_then(|v| v.as_object()) {
                                        for (pid, st) in map.iter() { if st.get("status").and_then(|s| s.as_str()) == Some("pinned") { online_peers.push(pid.as_bytes().to_vec()); } }
                                    } else if let Some(arr) = json.get("allocations").and_then(|v| v.as_array()) {
                                        for v in arr.iter() { if let Some(s) = v.as_str() { online_peers.push(s.as_bytes().to_vec()); } }
                                    }
                                }
                                // 标记降级与修复：对比本地分配和在线列表
                                for op_acc in assign.iter() {
                                    if let Some(info) = Operators::<T>::get(op_acc) {
                                        let present = online_peers.iter().any(|p| p.as_slice() == info.peer_id.as_slice());
                                        let success = PinSuccess::<T>::get(&cid_hash, op_acc);
                                        if present && !success { PinSuccess::<T>::insert(&cid_hash, op_acc, true); Self::deposit_event(Event::ReplicaRepaired(cid_hash, op_acc.clone())); }
                                        if !present && success {
                                            PinSuccess::<T>::insert(&cid_hash, op_acc, false);
                                            // 统计降级次数并触发告警建议
                                            OperatorSla::<T>::mutate(op_acc, |s| {
                                                s.degraded = s.degraded.saturating_add(1);
                                                if s.degraded % 10 == 0 { // 简单阈值：每 10 次降级告警
                                                    Self::deposit_event(Event::OperatorDegradationAlert(op_acc.clone(), s.degraded));
                                                }
                                            });
                                            Self::deposit_event(Event::ReplicaDegraded(cid_hash, op_acc.clone()));
                                        }
                                    }
                                }
                            }
                            // 再 Pin（带退避）
                            if !Self::backoff_should_delay(&cid_hash) { let _ = Self::submit_pin_request::<T>(&endpoint, &token, cid_hash); }
                            PinStateOf::<T>::insert(&cid_hash, 1u8);
                            Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
                        }
                    }
                }
            }
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：GET 请求帮助函数，返回主体字节（2xx 才返回）
        fn http_get_bytes(endpoint: &str, token: &Option<String>, path: &str) -> Option<Vec<u8>> {
            let url = alloc::format!("{}{}", endpoint, path);
            let mut req = http::Request::get(&url);
            if let Some(t) = token.as_ref() {
                let header = alloc::format!("Authorization: Bearer {}", t);
                let _ = req.add_header(&header);
            }
            let timeout = sp_io::offchain::timestamp().add(sp_runtime::offchain::Duration::from_millis(3_000));
            if let Ok(pending) = req.deadline(timeout).send() {
                if let Ok(Ok(resp)) = pending.try_wait(timeout) {
                    if resp.code / 100 == 2 { return Some(resp.body().collect::<Vec<u8>>()); }
                }
            }
            None
        }
        /// 函数级详细中文注释：通过 OCW 发送 HTTP POST /pins 请求到 ipfs-cluster
        /// - 仅示例：构造最小 JSON 体，包含 `cid` 字段（此处我们只有 `cid_hash`，生产应由 OCW 从密文解出 CID）。
        /// - 返回：若 HTTP 状态为 2xx 则认为提交成功，随后发起 `mark_pinned` 外部交易。
        fn submit_pin_request(
            endpoint: &str,
            token: &Option<String>,
            cid_hash: T::Hash,
        ) -> Result<(), ()> where T: CreateSignedTransaction<Call<T>> {
            let url = alloc::format!("{}/pins", endpoint);
            // 使用明文 CID 与 allocations 构造 JSON
            let cid_plain = Self::resolve_cid(&cid_hash);
            let mut json = String::from("{\"cid\":\"");
            json.push_str(&cid_plain);
            json.push_str("\",\"allocations\`:");
            let mut alloc_json = String::from("[");
            if let Some(ops) = PinAssignments::<T>::get(&cid_hash) {
                let mut first = true;
                for op in ops.iter() {
                    if let Some(info) = Operators::<T>::get(op) {
                        if let Ok(s) = core::str::from_utf8(&info.peer_id) {
                            if !s.is_empty() {
                                if !first { alloc_json.push(','); }
                                first = false;
                                alloc_json.push('"'); alloc_json.push_str(s); alloc_json.push('"');
                            }
                        }
                    }
                }
            }
            alloc_json.push(']');
            json.push_str(&alloc_json);
            json.push('}');
            let json = json.replace("allocations`", "allocations");
            let body = json.as_bytes().to_vec();
            let mut req = http::Request::post(&url, body);
            // Bearer 令牌
            if let Some(t) = token.as_ref() {
                let header = alloc::format!("Authorization: Bearer {}", t);
                let _ = req.add_header(&header);
                let _ = req.add_header("Content-Type: application/json");
            }
            let timeout = sp_io::offchain::timestamp().add(sp_runtime::offchain::Duration::from_millis(3_000));
            let pending = req.deadline(timeout).send().map_err(|_| ())?;
            let resp = pending.try_wait(timeout).map_err(|_| ())?.map_err(|_| ())?;
            let ok = resp.code / 100 == 2;

            // 使用本地签名提交外部交易
            let signer = Signer::<T, T::AuthorityId>::any_account();
            if ok { let _ = signer.send_signed_transaction(|_acct| Call::mark_pinned { cid_hash, replicas: 1 }); }
            else { let _ = signer.send_signed_transaction(|_acct| Call::mark_pin_failed { cid_hash, code: 500 }); }
            Ok(())
        }

        /// 函数级详细中文注释：通过 OCW 发送 HTTP GET /pins/{cid} 查询状态（示例）
        /// - 参数 `cid_str` 为明文 CID 字符串；生产中应由 OCW 从密文解出。
        /// - 返回：2xx 视为成功，其余失败；不触发上链，仅作为探活。
        fn submit_get_pin_status(
            endpoint: &str,
            token: &Option<String>,
            cid_str: &str,
        ) -> Result<(), ()> {
            let url = alloc::format!("{}/pins/{}", endpoint, cid_str);
            let mut req = http::Request::get(&url);
            if let Some(t) = token.as_ref() {
                let header = alloc::format!("Authorization: Bearer {}", t);
                let _ = req.add_header(&header);
            }
            let timeout = sp_io::offchain::timestamp().add(sp_runtime::offchain::Duration::from_millis(3_000));
            let pending = req.deadline(timeout).send().map_err(|_| ())?;
            let _resp = pending.try_wait(timeout).map_err(|_| ())?.map_err(|_| ())?;
            Ok(())
        }

        /// 函数级详细中文注释：GET /pins/{cid} 并返回原始主体（便于 JSON 解析）
        fn submit_get_pin_status_collect(endpoint: &str, token: &Option<String>, cid_str: &str) -> Option<Vec<u8>> {
            let url = alloc::format!("{}/pins/{}", endpoint, cid_str);
            let mut req = http::Request::get(&url);
            if let Some(t) = token.as_ref() { let header = alloc::format!("Authorization: Bearer {}", t); let _ = req.add_header(&header); }
            let timeout = sp_io::offchain::timestamp().add(sp_runtime::offchain::Duration::from_millis(3_000));
            let pending = req.deadline(timeout).send().ok()?;
            let resp = pending.try_wait(timeout).ok()??;
            if resp.code / 100 == 2 { Some(resp.body().collect::<Vec<u8>>()) } else { None }
        }

        /// 函数级详细中文注释：通过 OCW 发送 HTTP DELETE /pins/{cid}（示例）
        /// - 某些环境下可用 `X-HTTP-Method-Override: DELETE` 搭配 POST 以规避代理限制。
        /// - 返回：2xx 视为成功；不触发上链，仅作为示例。
        fn submit_delete_pin(
            endpoint: &str,
            token: &Option<String>,
            cid_str: &str,
        ) -> Result<(), ()> {
            let url = alloc::format!("{}/pins/{}", endpoint, cid_str);
            let mut req = http::Request::post(&url, Vec::new());
            let _ = req.add_header("X-HTTP-Method-Override: DELETE");
            if let Some(t) = token.as_ref() {
                let header = alloc::format!("Authorization: Bearer {}", t);
                let _ = req.add_header(&header);
            }
            let timeout = sp_io::offchain::timestamp().add(sp_runtime::offchain::Duration::from_millis(3_000));
            let pending = req.deadline(timeout).send().map_err(|_| ())?;
            let _resp = pending.try_wait(timeout).map_err(|_| ())?.map_err(|_| ())?;
            Ok(())
        }
    }

    /// 权重占位：后续通过 benchmarking 填充
    pub trait WeightInfo {
        fn request_pin() -> Weight;
        fn mark_pinned() -> Weight;
        fn mark_pin_failed() -> Weight;
    }
    impl WeightInfo for () {
        fn request_pin() -> Weight { 10_000 }
        fn mark_pinned() -> Weight { 10_000 }
        fn mark_pin_failed() -> Weight { 10_000 }
    }
}


