#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, Get},
};
use frame_system::{
    pallet_prelude::*,
    offchain::{AppCrypto, CreateSignedTransaction, Signer},
};
use pallet_memo_endowment::EndowmentInterface;
use sp_core::crypto::KeyTypeId;
use sp_runtime::{offchain::{http, StorageKind}, traits::AtLeast32BitUnsigned};
use sp_std::{vec::Vec, str};

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
        type Currency: Currency<Self::AccountId, Balance = Self::Balance>;
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
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 参数非法
        BadParams,
        /// 订单不存在
        OrderNotFound,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
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
            Self::deposit_event(Event::PinRequested(cid_hash, who, replicas, size_bytes, price));
            Ok(())
        }

        /// 函数级详细中文注释：OCW 上报标记已 Pin 成功
        /// - 需要节点 keystore 的专用 key 签名；
        /// - 仅更新状态并发出事件（骨架）。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::mark_pinned())]
        pub fn mark_pinned(origin: OriginFor<T>, cid_hash: T::Hash, replicas: u32) -> DispatchResult {
            let _who = ensure_signed(origin)?; // 骨架不校验角色，生产可引入 Membership/Operator 验证
            ensure!(PendingPins::<T>::contains_key(&cid_hash), Error::<T>::OrderNotFound);
            Self::deposit_event(Event::PinMarkedPinned(cid_hash, replicas));
            Ok(())
        }

        /// 函数级详细中文注释：OCW 上报标记 Pin 失败
        /// - 记录错误码，便于外部审计。
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::mark_pin_failed())]
        pub fn mark_pin_failed(origin: OriginFor<T>, cid_hash: T::Hash, code: u16) -> DispatchResult {
            let _who = ensure_signed(origin)?;
            ensure!(PendingPins::<T>::contains_key(&cid_hash), Error::<T>::OrderNotFound);
            Self::deposit_event(Event::PinMarkedFailed(cid_hash, code));
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

            // 简化：仅示意发起一次 POST /pins（实际应遍历 PendingPins 并做节流锁）
            if let Some((cid_hash, _order)) = <PendingPins<T>>::iter().next() {
                let _ = Self::submit_pin_request::<T>(&endpoint, &token, cid_hash);
                // 示例：可在需要时查询或删除（此处仅演示 API 形态，不在生产中直接删除）
                let _ = Self::submit_get_pin_status(&endpoint, &token, "<redacted>");
                let _ = Self::submit_delete_pin(&endpoint, &token, "<redacted>");
            }
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：通过 OCW 发送 HTTP POST /pins 请求到 ipfs-cluster
        /// - 仅示例：构造最小 JSON 体，包含 `cid` 字段（此处我们只有 `cid_hash`，生产应由 OCW 从密文解出 CID）。
        /// - 返回：若 HTTP 状态为 2xx 则认为提交成功，随后发起 `mark_pinned` 外部交易。
        fn submit_pin_request(
            endpoint: &str,
            token: &Option<String>,
            cid_hash: T::Hash,
        ) -> Result<(), ()> where T: CreateSignedTransaction<Call<T>> {
            let url = alloc::format!("{}/pins", endpoint);
            // 占位 JSON，生产中应传入明文 CID 或对应的 CIDv1 字符串
            let body = b"{\"cid\":\"<redacted>\"}".to_vec();
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


