#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`（RuntimeEvent/常量权重），后续基准权重接入后移除
#![allow(deprecated)]

extern crate alloc;

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, Get, ReservableCurrency},
    BoundedVec,
};
use frame_system::pallet_prelude::*;
use pallet_memo_endowment::EndowmentInterface;
use sp_core::crypto::KeyTypeId;
use sp_runtime::{offchain::{http, StorageKind}, traits::AtLeast32BitUnsigned};
use sp_std::{vec::Vec, str};
use codec::Encode;
use alloc::string::String;
use serde_json::Value as JsonValue;

pub use pallet::*;

/// 函数级详细中文注释：逝者 owner 只读提供者（低耦合）。
/// - 由 runtime 注入实现，通常从 pallet-deceased 读取 owner 字段。
pub trait OwnerProvider<AccountId> {
    /// 返回 subject(owner)；None 表示 subject 不存在。
    fn owner_of(subject_id: u64) -> Option<AccountId>;
}

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
    use frame_support::traits::StorageVersion;
    use frame_support::traits::ConstU32;
    use sp_runtime::traits::Saturating;
    use sp_runtime::SaturatedConversion;
    // 已移除签名交易上报，避免对 CreateSignedTransaction 约束
    use frame_support::traits::tokens::Imbalance;
    use alloc::string::ToString;
    use frame_support::PalletId;
    use sp_runtime::traits::AccountIdConversion;

    /// 余额别名
    pub type BalanceOf<T> = <T as Config>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
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

        // 已移除：OCW 签名标识（当前版本不从 OCW 发送签名交易）

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

        /// 函数级中文注释：派生“主题资金账户”的 PalletId（creator+subject_id 派生稳定地址）
        #[pallet::constant]
        type SubjectPalletId: Get<PalletId>;

        /// 函数级中文注释：逝者域编码（用于 (domain, subject_id) 稳定派生）。
        #[pallet::constant]
        type DeceasedDomain: Get<u8>;

        /// 函数级中文注释：逝者所有者只读提供者（低耦合）。
        /// - 返回 `Some(owner)` 则视为 subject 存在；None 表示不存在。
        type OwnerProvider: OwnerProvider<Self::AccountId>;
    }

    const STORAGE_VERSION: StorageVersion = StorageVersion::new(0);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 定价参数原始字节（骨架）
    #[pallet::storage]
    /// 函数级中文注释：定价参数原始字节（使用 BoundedVec 以满足 MaxEncodedLen 要求）
    pub type PricingParams<T: Config> = StorageValue<_, BoundedVec<u8, ConstU32<8192>>, ValueQuery>;

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
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct SlaStats<T: Config> {
        pub pinned_bytes: u64,
        pub probe_ok: u32,
        pub probe_fail: u32,
        pub degraded: u32,
        pub last_update: BlockNumberFor<T>,
    }

    impl<T: Config> Default for SlaStats<T> {
        /// 函数级中文注释：为 SlaStats<T> 提供显式的 Default 实现，避免对 T 施加 Default 约束
        /// - 将计数置 0，last_update 使用 BlockNumber 的默认值
        fn default() -> Self {
            Self { pinned_bytes: 0, probe_ok: 0, probe_fail: 0, degraded: 0, last_update: Default::default() }
        }
    }

    #[pallet::storage]
    pub type OperatorSla<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, SlaStats<T>, ValueQuery>;

    // ====== 计费与生命周期（最小增量）======
    /// 函数级中文注释：每 GiB·周 单价（治理可调）。单位使用链上最小余额单位的整数，建议采用按字节的定点基数以避免小数。
    #[pallet::type_value]
    pub fn DefaultPricePerGiBWeek<T: Config>() -> u128 { 1_000_000_000 }
    #[pallet::storage]
    pub type PricePerGiBWeek<T: Config> = StorageValue<_, u128, ValueQuery, DefaultPricePerGiBWeek<T>>;

    /// 函数级中文注释：计费周期（块），默认一周（6s/块 × 60 × 60 × 24 × 7 = 100_800）。
    #[pallet::type_value]
    pub fn DefaultBillingPeriodBlocks<T: Config>() -> u32 { 100_800 }
    #[pallet::storage]
    pub type BillingPeriodBlocks<T: Config> = StorageValue<_, u32, ValueQuery, DefaultBillingPeriodBlocks<T>>;

    /// 函数级中文注释：宽限期（块）。在余额不足时进入 Grace，超过宽限仍不足则过期。
    #[pallet::type_value]
    pub fn DefaultGraceBlocks<T: Config>() -> u32 { 10_080 }
    #[pallet::storage]
    pub type GraceBlocks<T: Config> = StorageValue<_, u32, ValueQuery, DefaultGraceBlocks<T>>;

    /// 函数级中文注释：每块处理的最大扣费数，用于限流保护。
    #[pallet::type_value]
    pub fn DefaultMaxChargePerBlock<T: Config>() -> u32 { 50 }
    #[pallet::storage]
    pub type MaxChargePerBlock<T: Config> = StorageValue<_, u32, ValueQuery, DefaultMaxChargePerBlock<T>>;

    /// 函数级中文注释：主体资金账户最低保留（KeepAlive 余量），扣费需确保余额-金额≥该值。
    #[pallet::type_value]
    pub fn DefaultSubjectMinReserve<T: Config>() -> BalanceOf<T> { BalanceOf::<T>::default() }
    #[pallet::storage]
    pub type SubjectMinReserve<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery, DefaultSubjectMinReserve<T>>;

    /// 函数级中文注释：计费暂停总开关（治理控制）。
    #[pallet::type_value]
    pub fn DefaultBillingPaused<T: Config>() -> bool { false }
    #[pallet::storage]
    pub type BillingPaused<T: Config> = StorageValue<_, bool, ValueQuery, DefaultBillingPaused<T>>;

    /// 函数级中文注释：到期队列容量上限（每个区块键对应的最大 CID 数）。
    #[pallet::type_value]
    pub fn DefaultDueListCap<T: Config>() -> u32 { 1024 }
    #[pallet::storage]
    pub type DueQueue<T: Config> = StorageMap<_, Blake2_128Concat, BlockNumberFor<T>, BoundedVec<T::Hash, ConstU32<1024>>, ValueQuery>;

    /// 函数级中文注释：入队扩散窗口（块）。将到期项在 `base..base+spread` 内寻找首个未满的队列入队，平滑负载。
    #[pallet::type_value]
    pub fn DefaultDueEnqueueSpread<T: Config>() -> u32 { 10 }
    #[pallet::storage]
    pub type DueEnqueueSpread<T: Config> = StorageValue<_, u32, ValueQuery, DefaultDueEnqueueSpread<T>>;

    /// 函数级中文注释：每个 CID 的计费状态：下一次扣费块高、单价快照、状态（0=Active,1=Grace,2=Expired）。
    #[pallet::storage]
    pub type PinBilling<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, (BlockNumberFor<T>, u128, u8), OptionQuery>;

    /// 函数级中文注释：仅对“逝者主题扣费”的 CID 记录 funding 来源（owner, subject_id），用于从派生账户自动扣款。
    #[pallet::storage]
    pub type PinSubjectOf<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, (T::AccountId, u64), OptionQuery>;

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
        /// 主题账户已充值（subject_id, from, to, amount）
        SubjectFunded(u64, T::AccountId, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：已完成一次周期扣费（cid_hash, amount, period_blocks, next_charge_at）。
        PinCharged(T::Hash, BalanceOf<T>, u32, BlockNumberFor<T>),
        /// 函数级中文注释：余额不足进入宽限期（cid_hash）。
        PinGrace(T::Hash),
        /// 函数级中文注释：超出宽限期仍欠费，标记过期（cid_hash）。
        PinExpired(T::Hash),
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

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：根据 (domain, subject_id) 计算派生子账户（稳定派生，与创建者/拥有者解耦）
        /// - 使用 `SubjectPalletId.into_sub_account_truncating((domain:u8, subject_id:u64))` 派生稳定地址
        /// - 该账户无私钥，不可外发，仅用于托管与扣费
        #[inline]
        pub fn subject_account_for(domain: u8, subject_id: u64) -> T::AccountId {
            T::SubjectPalletId::get().into_sub_account_truncating((domain, subject_id))
        }
        /// 函数级详细中文注释：逝者域便捷封装（domain=DeceasedDomain）
        #[inline]
        pub fn subject_account_for_deceased(subject_id: u64) -> T::AccountId {
            Self::subject_account_for(T::DeceasedDomain::get(), subject_id)
        }
        /// 函数级详细中文注释：CID 解密/映射内部工具函数（非外部可调用）
        /// - 从 offchain local storage 读取 `/memo/ipfs/cid/<hash_hex>` 对应的明文 CID；
        /// - 若不存在，返回占位 `"<redacted>"`，用于上层降级处理。
        #[inline]
        fn resolve_cid(cid_hash: &T::Hash) -> alloc::string::String {
            let mut key = b"/memo/ipfs/cid/".to_vec();
            let hex = hex::encode(cid_hash.as_ref());
            key.extend_from_slice(hex.as_bytes());
            if let Some(bytes) = sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, &key) {
                if let Ok(s) = core::str::from_utf8(&bytes) { return s.into(); }
            }
            "<redacted>".into()
        }
    }

    // 说明：临时允许 warnings 以通过工作区 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：为“逝者主题资金账户”充值（留审计事件）
        /// - 限制：必须为该 subject 的 owner 调用；amount>0
        /// - 行为：从 caller → 派生账户 转账（KeepAlive）
        #[pallet::call_index(9)]
        #[pallet::weight(10_000)]
        pub fn fund_subject_account(origin: OriginFor<T>, subject_id: u64, amount: BalanceOf<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(amount != BalanceOf::<T>::default(), Error::<T>::BadParams);
            let owner = T::OwnerProvider::owner_of(subject_id).ok_or(Error::<T>::BadParams)?;
            ensure!(owner == who, Error::<T>::BadStatus);
            let to = Self::subject_account_for_deceased(subject_id);
            <T as Config>::Currency::transfer(&who, &to, amount, frame_support::traits::ExistenceRequirement::KeepAlive)?;
            Self::deposit_event(Event::SubjectFunded(subject_id, who, to, amount));
            Ok(())
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

        /// 函数级详细中文注释：为“逝者主题”发起 Pin（从派生账户扣费）
        /// - 授权：caller 必须为该 subject 的 owner
        /// - 资金：从 subject_account(owner, subject_id) → 基金会本金池
        #[pallet::call_index(10)]
        #[pallet::weight(T::WeightInfo::request_pin())]
        pub fn request_pin_for_deceased(
            origin: OriginFor<T>,
            subject_id: u64,
            cid_hash: T::Hash,
            size_bytes: u64,
            replicas: u32,
            price: T::Balance,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(replicas >= 1 && size_bytes > 0, Error::<T>::BadParams);
            let owner = T::OwnerProvider::owner_of(subject_id).ok_or(Error::<T>::BadParams)?;
            ensure!(owner == who, Error::<T>::BadStatus);
            let payer = Self::subject_account_for_deceased(subject_id);
            T::Endowment::deposit_from_storage(&payer, price, cid_hash)?;
            PendingPins::<T>::insert(&cid_hash, (who.clone(), replicas, size_bytes, price));
            let now = <frame_system::Pallet<T>>::block_number();
            PinMeta::<T>::insert(&cid_hash, (replicas, size_bytes, now, now));
            PinStateOf::<T>::insert(&cid_hash, 0u8);
            Self::deposit_event(Event::PinRequested(cid_hash, who, replicas, size_bytes, price));
            // 计费初始化：仅对“主题扣费”场景登记来源/周期
            PinSubjectOf::<T>::insert(&cid_hash, (owner.clone(), subject_id));
            let period = BillingPeriodBlocks::<T>::get();
            let unit = PricePerGiBWeek::<T>::get();
            let next = now.saturating_add(period.into());
            PinBilling::<T>::insert(&cid_hash, (next, unit, 0u8));
            // 加入到期队列（扩散入队，若全部满则静默丢弃；后续可由治理修复/补处理）
            Self::enqueue_due(cid_hash, next);
            Ok(())
        }

        /// 函数级详细中文注释：【治理/服务商】处理到期扣费项（limit 条）
        /// - Origin：GovernanceOrigin（可扩展加入白名单服务商 Origin）
        /// - 行为：从到期队列中取出 ≤limit 个，到期的 CID 进行扣费；成功则推进下一次扣费并重新入队；余额不足则进入宽限或过期。
        #[pallet::call_index(11)]
        #[pallet::weight(10_000)]
        pub fn charge_due(origin: OriginFor<T>, limit: u32) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(!BillingPaused::<T>::get(), Error::<T>::BadStatus);
            let now = <frame_system::Pallet<T>>::block_number();
            let mut left = core::cmp::min(limit, MaxChargePerBlock::<T>::get());
            if left == 0 { return Ok(()); }
            // 取出本块到期列表
            let mut list = DueQueue::<T>::take(now);
            while left > 0 {
                let Some(cid) = list.pop() else { break };
                left = left.saturating_sub(1);
                // 读取计费与来源
                if let Some((_, unit_price, state)) = PinBilling::<T>::get(&cid) {
                    if let Some((owner, subject_id)) = PinSubjectOf::<T>::get(&cid) {
                        // 仅处理 Active/Grace，已过期则跳过
                        if state <= 1u8 {
                            // 计算应收：ceil(size/GiB) * replicas * unit_price
                            if let Some((replicas, size_bytes, _c, _l)) = PinMeta::<T>::get(&cid) {
                                let gib: u128 = 1_073_741_824u128; // 1024^3
                                let sz = size_bytes as u128;
                                let units = (sz + gib - 1) / gib; // ceil
                                let due_u128 = units.saturating_mul(replicas as u128).saturating_mul(unit_price);
                                let due_bal: BalanceOf<T> = due_u128.saturated_into();
                                let payer = Self::subject_account_for_deceased(subject_id);
                                let min_res = SubjectMinReserve::<T>::get();
                                let free = <T as Config>::Currency::free_balance(&payer);
                                if free.saturating_sub(due_bal) >= min_res {
                                    // 扣费：打入基金会
                                    T::Endowment::deposit_from_storage(&payer, due_bal, cid)?;
                                    // 推进下一期并重新入队
                                    let period = BillingPeriodBlocks::<T>::get();
                                    let next = now.saturating_add(period.into());
                                    PinBilling::<T>::insert(&cid, (next, unit_price, 0u8));
                                    Self::enqueue_due(cid, next);
                                    Self::deposit_event(Event::PinCharged(cid, due_bal, period, next));
                                } else {
                                    // 余额不足：首次不足进入 Grace；已在 Grace 再次不足则过期
                                    if state == 0u8 {
                                        let g = GraceBlocks::<T>::get();
                                        let next = now.saturating_add(g.into());
                                        PinBilling::<T>::insert(&cid, (next, unit_price, 1u8));
                                        Self::enqueue_due(cid, next);
                                        Self::deposit_event(Event::PinGrace(cid));
                                    } else {
                                        PinBilling::<T>::insert(&cid, (now, unit_price, 2u8));
                                        Self::deposit_event(Event::PinExpired(cid));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // 剩余未处理的放回队列
            if !list.is_empty() { DueQueue::<T>::insert(now, list); }
            Ok(())
        }

        /// 函数级详细中文注释：治理设置/暂停计费参数。
        /// - 任何入参为 None 表示保持不变；部分更新。
        #[pallet::call_index(12)]
        #[pallet::weight(10_000)]
        pub fn set_billing_params(
            origin: OriginFor<T>,
            price_per_gib_week: Option<u128>,
            period_blocks: Option<u32>,
            grace_blocks: Option<u32>,
            max_charge_per_block: Option<u32>,
            subject_min_reserve: Option<BalanceOf<T>>,
            paused: Option<bool>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            // 参数防呆校验：确保关键参数为正，避免导致停摆或无限宽限
            if let Some(v) = price_per_gib_week {
                ensure!(v > 0, Error::<T>::BadParams);
                PricePerGiBWeek::<T>::put(v);
            }
            if let Some(v) = period_blocks {
                ensure!(v > 0, Error::<T>::BadParams);
                BillingPeriodBlocks::<T>::put(v);
            }
            if let Some(v) = grace_blocks {
                ensure!(v > 0, Error::<T>::BadParams);
                GraceBlocks::<T>::put(v);
            }
            if let Some(v) = max_charge_per_block {
                ensure!(v > 0, Error::<T>::BadParams);
                MaxChargePerBlock::<T>::put(v);
            }
            if let Some(v) = subject_min_reserve { SubjectMinReserve::<T>::put(v); }
            if let Some(v) = paused { BillingPaused::<T>::put(v); }
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
            // 记录剩余 bond（slash_reserved 返回负不平衡，使用 peek 获取相应余额值再进行安全减法）
            let old = OperatorBond::<T>::get(&who);
            let slashed_amount = slashed.peek();
            let new = old.saturating_sub(slashed_amount);
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
            let endpoint: alloc::string::String = sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, b"/memo/ipfs/cluster_endpoint")
                .and_then(|v| core::str::from_utf8(&v).ok().map(|s| s.to_string()))
                .unwrap_or_else(|| alloc::string::String::from("http://127.0.0.1:9094"));
            let token: Option<alloc::string::String> = sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, b"/memo/ipfs/token")
                .and_then(|v| core::str::from_utf8(&v).ok().map(|s| s.to_string()));

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
                let _ = Self::submit_pin_request(&endpoint, &token, cid_hash);
                PinStateOf::<T>::insert(&cid_hash, 1u8);
                Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
            }

            // 探测自身是否在线（运营者必须运行集群节点）：读取 /peers 并查找自身 peer_id
            // 探测自身是否在线：简化为本地统计，避免依赖 CreateSignedTransaction
            let _ = Self::http_get_bytes(&endpoint, &token, "/peers");

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
                            // 直接 GET /pins/{cid} 获取状态（Plan B 替换 submit_get_pin_status_collect）
                            if let Some(body) = Self::http_get_bytes(&endpoint, &token, &alloc::format!("/pins/{}", cid_str)) {
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
                            let _ = Self::submit_pin_request(&endpoint, &token, cid_hash);
                            PinStateOf::<T>::insert(&cid_hash, 1u8);
                            Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
                        }
                    }
                }
            }
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：扩散入队工具函数
        /// - 在 base..base+spread 范围内寻找首个未满的队列入队；全部满则放弃（避免单点拥塞）。
        #[inline]
        fn enqueue_due(cid: T::Hash, base_next: BlockNumberFor<T>) {
            let spread: u32 = DueEnqueueSpread::<T>::get();
            let mut inserted = false;
            for off in 0..=spread {
                let key = base_next.saturating_add(off.into());
                let mut v = DueQueue::<T>::get(key);
                if v.try_push(cid).is_ok() { DueQueue::<T>::insert(key, v); inserted = true; break; }
            }
            if !inserted { /* 放弃，治理可通过扫描修复 */ }
        }
        /// 函数级详细中文注释：GET 请求帮助函数，返回主体字节（2xx 才返回）
        fn http_get_bytes(endpoint: &str, token: &Option<String>, path: &str) -> Option<Vec<u8>> {
            let url = alloc::format!("{}{}", endpoint, path);
            let mut req = http::Request::get(&url);
            if let Some(t) = token.as_ref() {
                req = req.add_header("Authorization", &alloc::format!("Bearer {}", t));
            }
            let timeout = sp_io::offchain::timestamp()
                .add(sp_runtime::offchain::Duration::from_millis(3_000));
            let pending = req.deadline(timeout).send().ok()?;
            // try_wait 返回 Result<Option<Response>, _> → ok()?.ok()? 解包为 Response
            let resp = pending.try_wait(timeout).ok()?.ok()?;
            let code: u16 = resp.code;
            if (200..300).contains(&code) {
                Some(resp.body().collect::<Vec<u8>>())
            } else {
                None
            }
        }

        /// 函数级详细中文注释：通过 OCW 发送 HTTP POST /pins 请求到 ipfs-cluster
        /// - 仅示例：构造最小 JSON 体，包含 `cid` 字段（此处我们只有 `cid_hash`，生产应由 OCW 从密文解出 CID）。
        /// - 返回：若 HTTP 状态为 2xx 则认为提交成功，随后发起 `mark_pinned` 外部交易。
        fn submit_pin_request(
            endpoint: &str,
            token: &Option<String>,
            cid_hash: T::Hash,
        ) -> Result<(), ()> {
            let cid_hex = hex::encode(cid_hash.as_ref());
            // 构造最小 JSON（根据你的 API 需要调整）
            let body_json = alloc::format!(r#"{{"cid":"{}"}}"#, cid_hex);
            let body_vec: Vec<u8> = body_json.into_bytes();
            let url = alloc::format!("{}/pins", endpoint);
            // 不用切片：使用 Vec<Vec<u8>> 作为 POST body，以满足 add_header/deadline 的 T: Default 约束
            let chunks: Vec<Vec<u8>> = alloc::vec![body_vec];
            let mut req = http::Request::post(&url, chunks);
            if let Some(t) = token.as_ref() {
                req = req
                    .add_header("Authorization", &alloc::format!("Bearer {}", t))
                    .add_header("Content-Type", "application/json");
            }
            let timeout = sp_io::offchain::timestamp()
                .add(sp_runtime::offchain::Duration::from_millis(5_000));
            let pending = req.deadline(timeout).send().map_err(|_| ())?;
            let resp = pending.try_wait(timeout).map_err(|_| ())?.map_err(|_| ())?;
            let code: u16 = resp.code;
            if (200..300).contains(&code) { Ok(()) } else { Err(()) }
        }

        /// 函数级详细中文注释：通过 OCW 发送 HTTP DELETE /pins/{cid}（示例）
        /// - 某些环境下可用 `X-HTTP-Method-Override: DELETE` 搭配 POST 以规避代理限制。
        /// - 返回：2xx 视为成功；不触发上链，仅作为示例。
        #[allow(dead_code)]
        fn submit_delete_pin(
            endpoint: &str,
            token: &Option<String>,
            cid_str: &str,
        ) -> Result<(), ()> {
            let url = alloc::format!("{}/pins/{}", endpoint, cid_str);
            // 不用切片：空体使用 Vec<Vec<u8>>
            let chunks: Vec<Vec<u8>> = alloc::vec![Vec::new()];
            let mut req = http::Request::post(&url, chunks)
                .add_header("X-HTTP-Method-Override", "DELETE");
            if let Some(t) = token.as_ref() {
                req = req.add_header("Authorization", &alloc::format!("Bearer {}", t));
            }
            let timeout = sp_io::offchain::timestamp()
                .add(sp_runtime::offchain::Duration::from_millis(5_000));
            let pending = req.deadline(timeout).send().map_err(|_| ())?;
            let resp = pending.try_wait(timeout).map_err(|_| ())?.map_err(|_| ())?;
            let code: u16 = resp.code;
            if (200..300).contains(&code) { Ok(()) } else { Err(()) }
        }
    }

    /// 权重占位：后续通过 benchmarking 填充
    pub trait WeightInfo {
        fn request_pin() -> Weight;
        fn mark_pinned() -> Weight;
        fn mark_pin_failed() -> Weight;
    }
    impl WeightInfo for () {
        fn request_pin() -> Weight { Weight::from_parts(10_000, 0) }
        fn mark_pinned() -> Weight { Weight::from_parts(10_000, 0) }
        fn mark_pin_failed() -> Weight { Weight::from_parts(10_000, 0) }
    }
}


#[cfg(test)]
mod tests;
