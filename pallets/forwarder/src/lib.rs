#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

// 函数级中文注释：权重模块导入，提供 WeightInfo 接口用于基于输入规模计算交易权重。
pub mod weights;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use alloc::vec::Vec;
    use frame_support::{
        pallet_prelude::*,
        traits::Contains,
        dispatch::GetDispatchInfo,
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_core::sr25519;
    use sp_runtime::{traits::{StaticLookup, Dispatchable, Zero, Saturating}, RuntimeDebug};
    use sp_runtime::traits::{Verify, IdentifyAccount};
    use frame_system::RawOrigin;
    use codec::Decode;
    use sp_core::Pair;
    use crate::weights::WeightInfo;

    /// Authorizer 适配接口：由 runtime 实现以对接 `pallet-authorizer`
    ///
    /// 注意：这是极简接口，仅用于本 MVP 示例。实际项目可拓展为预算预扣与结算。
    pub trait ForwarderAuthorizer<AccountId, Call> {
        /// 校验赞助者是否在给定命名空间下被允许代付
        fn is_sponsor_allowed(ns: [u8; 8], sponsor: &AccountId) -> bool;
        /// 校验该调用是否在允许范围（可包含参数上限检查）
        fn is_call_allowed(ns: [u8; 8], sponsor: &AccountId, call: &Call) -> bool;
    }

    /// 会话许可（简化版）：登录/开局时由用户主钱包签名，授权一个会话公钥在 TTL 内代签
    #[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct SessionPermit<AccountId, BlockNumber> {
        /// 命名空间字节（与授权中心挂钩）
        pub ns: [u8; 8],
        /// 业务所有者账户（以该身份执行内层调用）
        pub owner: AccountId,
        /// 会话标识
        pub session_id: [u8; 16],
        /// 会话公钥（sr25519）
        pub session_pubkey: sr25519::Public,
        /// 过期高度（TTL）
        pub expires_at: BlockNumber,
    }

    /// 单笔元交易（简化版）：由会话私钥离线签名
    #[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct MetaTx<Call, BlockNumber> {
        /// 命名空间
        pub ns: [u8; 8],
        /// 会话标识
        pub session_id: [u8; 16],
        /// 真实 RuntimeCall
        pub call: Call,
        /// 会话级防重放 nonce（严格递增）
        pub nonce: u64,
        /// 单笔过期高度
        pub valid_till: BlockNumber,
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 运行时聚合调用类型（用于封装真实调用）
        /// 要求其 PostInfo 与标准 `PostDispatchInfo` 一致，以便返回类型统一
        type RuntimeCall: Parameter
            + Dispatchable<
                RuntimeOrigin = Self::RuntimeOrigin,
                PostInfo = frame_support::dispatch::PostDispatchInfo,
            >
            + GetDispatchInfo;
        /// Authorizer 适配器
        type Authorizer: ForwarderAuthorizer<Self::AccountId, <Self as pallet::Config>::RuntimeCall>;
        /// 拒绝的调用（例如 utility::batch/dispatch_as 等）
        type ForbiddenCalls: Contains<<Self as pallet::Config>::RuntimeCall>;
        /// MetaTx 字节上限（避免滥用过大负载）
        type MaxMetaLen: Get<u32>;
        /// SessionPermit 字节上限
        type MaxPermitLen: Get<u32>;
        /// 是否强制校验 open_session 的所有者签名；默认由运行时配置
        type RequirePermitSig: Get<bool>;
        /// 是否强制校验 forward 的会话签名（与存储中公钥一致）；默认由运行时配置
        type RequireMetaSig: Get<bool>;
        /// 每会话最多允许的转发次数（速率/配额控制）
        type MaxCallsPerSession: Get<u32>;
        /// 每会话累计允许的 ref_time 权重上限
        type MaxWeightPerSessionRefTime: Get<u64>;
        /// 函数级中文注释：最小有效期 TTL（区块）。forward 的 meta.valid_till 至少需要大于当前块 + 该常量。
        type MinMetaTxTTL: Get<BlockNumberFor<Self>>;
        /// 函数级中文注释：每块最多允许的代付转发条数（全局节流）。
        #[pallet::constant]
        type MaxForwardedPerBlock: Get<u32>;
        /// 函数级中文注释：赞助者×命名空间的统计窗口（块）。
        #[pallet::constant]
        type ForwarderWindowBlocks: Get<BlockNumberFor<Self>>;
        /// 权重信息接口
        type WeightInfo: WeightInfo;

        /// 函数级中文注释：所有者签名与公钥类型（用于对 SessionPermit 做离线签名校验）。
        /// - PermitSignature 一般绑定为 MultiSignature；PermitSigner 绑定为 MultiSigner；
        /// - 这样即可兼容 sr25519/ed25519/ecdsa 多曲线；
        /// - 校验时需携带 `owner_signer`（公钥多签封装），并验证其 into_account() == permit.owner。
        type PermitSignature: Verify<Signer = Self::PermitSigner> + codec::Decode + codec::MaxEncodedLen + TypeInfo + Parameter;
        type PermitSigner: IdentifyAccount<AccountId = Self::AccountId> + codec::Decode + TypeInfo + Parameter + Clone;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    #[pallet::getter(fn session_of)]
    /// 已开启的会话：(owner, ns, session_id) -> SessionPermit
    pub type Sessions<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat, (T::AccountId, [u8; 8]),
        Blake2_128Concat, [u8; 16],
        SessionPermit<T::AccountId, BlockNumberFor<T>>, OptionQuery
    >;

    /// 函数级中文注释：每块代付转发条数统计（用于全局节流）。
    #[pallet::storage]
    pub type ForwardedPerBlock<T: Config> = StorageMap<_, Blake2_128Concat, BlockNumberFor<T>, u32, ValueQuery>;

    /// 函数级中文注释：赞助者×命名空间的窗口统计 (window_start, calls, ref_time)。
    #[pallet::storage]
    pub type SponsorWindowStats<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::AccountId, Blake2_128Concat, [u8;8], (BlockNumberFor<T>, u32, u64), ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn next_nonce)]
    /// 会话内 nonce 记录：(owner, ns, session_id) -> next_nonce
    pub type SessionNonce<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat, (T::AccountId, [u8; 8]),
        Blake2_128Concat, [u8; 16],
        u64, ValueQuery
    >;

    /// 函数级中文注释：会话统计（调用次数与累计 ref_time 权重），用于配额控制与风控。
    #[pallet::storage]
    pub type SessionStats<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat, (T::AccountId, [u8; 8]),
        Blake2_128Concat, [u8; 16],
        (u32, u64), // (calls, total_ref_time)
        ValueQuery
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 开启会话
        SessionOpened { owner: T::AccountId, ns: [u8; 8], session_id: [u8; 16] },
        /// 关闭会话
        SessionClosed { owner: T::AccountId, ns: [u8; 8], session_id: [u8; 16] },
        /// 成功转发
        Forwarded { owner: T::AccountId, sponsor: T::AccountId, ns: [u8; 8], session_id: [u8; 16] },
        /// 失败转发（含错误码）
        ForwardFailed { owner: T::AccountId, sponsor: T::AccountId, ns: [u8; 8], session_id: [u8; 16], code: u8 },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 赞助者不在白名单
        SponsorNotAllowed,
        /// 调用未在允许范围
        CallNotAllowed,
        /// 会话不存在或已过期
        BadSession,
        /// Nonce 无效（非严格递增）
        BadNonce,
        /// 禁止的调用（如 batch/dispatch_as 等）
        ForbiddenCall,
        /// 签名非法
        BadSignature,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 开启会话：由赞助者代付将已签名的许可上链（本 MVP 省略许可签名校验，聚焦集成）
        ///
        /// 安全说明：生产环境应校验 SessionPermit 是由 `owner` 主钱包签名授权的。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::open_session())]
        pub fn open_session(
            origin: OriginFor<T>,
            permit_bytes: BoundedVec<u8, T::MaxPermitLen>,
            owner_signer: T::PermitSigner,
            owner_sig: Vec<u8>,
        ) -> DispatchResult {
            let sponsor = ensure_signed(origin)?;
            // 解码离线许可
            let mut input = &permit_bytes[..];
            let permit: SessionPermit<T::AccountId, BlockNumberFor<T>> = SessionPermit::decode(&mut input)
                .map_err(|_| Error::<T>::BadSession)?;
            // authorizer：仅允许在白名单中的赞助者代付开启
            ensure!(T::Authorizer::is_sponsor_allowed(permit.ns, &sponsor), Error::<T>::SponsorNotAllowed);
            let now = frame_system::Pallet::<T>::block_number();
            ensure!(now <= permit.expires_at, Error::<T>::BadSession);

            // 所有者签名强校验（可由运行时开关控制）
            if T::RequirePermitSig::get() {
                // 1) 校验公钥与账户映射一致（owner_signer.into_account() == permit.owner）
                let derived = owner_signer.clone().into_account();
                ensure!(derived == permit.owner, Error::<T>::BadSession);
                // 2) 构造签名消息：scale(permit_bytes) + genesis_hash + 域分隔符
                let mut msg = permit_bytes.to_vec();
                let gh = frame_system::Pallet::<T>::block_hash::<frame_system::pallet_prelude::BlockNumberFor<T>>(Zero::zero());
                msg.extend_from_slice(gh.as_ref());
                const DOMAIN_PERMIT: &[u8] = b"/mp/fwd/permit/v1";
                msg.extend_from_slice(DOMAIN_PERMIT);
                // 3) 解析并校验签名（要求为 SCALE 编码的 MultiSignature 变体）
                let mut sig_input = &owner_sig[..];
                let sig = <T as Config>::PermitSignature::decode(&mut sig_input).map_err(|_| Error::<T>::BadSignature)?;
                ensure!(sig.verify(msg.as_slice(), &derived), Error::<T>::BadSignature);
            }

            Sessions::<T>::insert((permit.owner.clone(), permit.ns), permit.session_id, permit.clone());
            SessionNonce::<T>::insert((permit.owner.clone(), permit.ns), permit.session_id, 0u64);
            SessionStats::<T>::insert((permit.owner.clone(), permit.ns), permit.session_id, (0u32, 0u64));
            Self::deposit_event(Event::SessionOpened { owner: permit.owner, ns: permit.ns, session_id: permit.session_id });
            Ok(())
        }

        /// 关闭会话：由所有者主动撤销
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::close_session())]
        pub fn close_session(origin: OriginFor<T>, ns: [u8; 8], session_id: [u8; 16]) -> DispatchResult {
            let owner = ensure_signed(origin)?;
            Sessions::<T>::remove((owner.clone(), ns), session_id);
            SessionNonce::<T>::remove((owner.clone(), ns), session_id);
            SessionStats::<T>::remove((owner.clone(), ns), session_id);
            Self::deposit_event(Event::SessionClosed { owner, ns, session_id });
            Ok(())
        }

        /// 元交易转发：由赞助者签名付费，会话私钥对 MetaTx 离线签名（MVP 省略校验）
        ///
        /// 安全说明：生产环境应校验 `session_sig` 确实由 `session_pubkey` 对 `meta` 的 SCALE 编码签发。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::forward())]
        pub fn forward(
            origin: OriginFor<T>,
            meta_bytes: BoundedVec<u8, T::MaxMetaLen>,
            session_sig: Vec<u8>,
            owner: <T::Lookup as StaticLookup>::Source,
        ) -> DispatchResultWithPostInfo {
            let sponsor = ensure_signed(origin)?;
            let owner = T::Lookup::lookup(owner)?;
            // 解码 meta
            let mut input = &meta_bytes[..];
            let meta: MetaTx<<T as pallet::Config>::RuntimeCall, BlockNumberFor<T>> =
                MetaTx::decode(&mut input).map_err(|_| Error::<T>::BadSession)?;

            // 赞助者白名单
            ensure!(T::Authorizer::is_sponsor_allowed(meta.ns, &sponsor), Error::<T>::SponsorNotAllowed);

            // 会话存在与未过期
            let maybe = Sessions::<T>::get((owner.clone(), meta.ns), meta.session_id).ok_or(Error::<T>::BadSession)?;
            let now = frame_system::Pallet::<T>::block_number();
            // 校验会话与 meta 的过期，同时要求 meta 至少满足最小 TTL
            if !(now <= maybe.expires_at) {
                Self::deposit_event(Event::ForwardFailed { owner: owner.clone(), sponsor: sponsor.clone(), ns: meta.ns, session_id: meta.session_id, code: 1 });
                return Err(Error::<T>::BadSession.into())
            }
            if !(now <= meta.valid_till && meta.valid_till.saturating_sub(now) >= T::MinMetaTxTTL::get()) {
                Self::deposit_event(Event::ForwardFailed { owner: owner.clone(), sponsor: sponsor.clone(), ns: meta.ns, session_id: meta.session_id, code: 2 });
                return Err(Error::<T>::BadSession.into())
            }

            // 会话签名校验（可选，运行时控制）
            if T::RequireMetaSig::get() {
                // 构造签名消息：scale(meta) + genesis_hash + domain
                let mut msg = meta_bytes.to_vec();
                // 绑定 genesis_hash 以防跨链复用
                let gh = frame_system::Pallet::<T>::block_hash::<frame_system::pallet_prelude::BlockNumberFor<T>>(Zero::zero());
                msg.extend_from_slice(gh.as_ref());
                // 域分隔符
                const DOMAIN: &[u8] = b"/mp/fwd/v1";
                msg.extend_from_slice(DOMAIN);
                // 解析签名
                if session_sig.len() != 64 {
                    // 失败事件
                    Self::deposit_event(Event::ForwardFailed { owner: owner.clone(), sponsor: sponsor.clone(), ns: meta.ns, session_id: meta.session_id, code: 6 });
                    return Err(Error::<T>::BadSession.into())
                }
                let mut sig_raw = [0u8; 64];
                sig_raw.copy_from_slice(&session_sig[..]);
                let sig = sp_core::sr25519::Signature::from_raw(sig_raw);
                let ok = sr25519::Pair::verify(&sig, &msg, &maybe.session_pubkey);
                if !ok {
                    Self::deposit_event(Event::ForwardFailed { owner: owner.clone(), sponsor: sponsor.clone(), ns: meta.ns, session_id: meta.session_id, code: 6 });
                    return Err(Error::<T>::BadSession.into())
                }
            }

            // 禁止的调用过滤
            ensure!(!T::ForbiddenCalls::contains(&meta.call), Error::<T>::ForbiddenCall);

            // 范围校验
            ensure!(T::Authorizer::is_call_allowed(meta.ns, &sponsor, &meta.call), Error::<T>::CallNotAllowed);

            // 会话配额与预算校验
            let info = meta.call.get_dispatch_info();
            let (calls, total) = SessionStats::<T>::get((owner.clone(), meta.ns), meta.session_id);
            ensure!(calls < T::MaxCallsPerSession::get(), Error::<T>::ForbiddenCall);
            let next_total = total
                .saturating_add(info.call_weight.ref_time())
                .saturating_add(info.extension_weight.ref_time());
            ensure!(next_total <= T::MaxWeightPerSessionRefTime::get(), Error::<T>::ForbiddenCall);
            // 预计记账（失败也计数，避免重放薅费）
            SessionStats::<T>::insert((owner.clone(), meta.ns), meta.session_id, (calls.saturating_add(1), next_total));

            // Nonce 检查：严格递增
            let next = SessionNonce::<T>::get((owner.clone(), meta.ns), meta.session_id);
            ensure!(meta.nonce == next, Error::<T>::BadNonce);
            SessionNonce::<T>::insert((owner.clone(), meta.ns), meta.session_id, next.saturating_add(1));

            // 全局节流：每块最多 MaxForwardedPerBlock
            let per_blk = ForwardedPerBlock::<T>::get(now);
            ensure!(per_blk < T::MaxForwardedPerBlock::get(), Error::<T>::ForbiddenCall);
            ForwardedPerBlock::<T>::insert(now, per_blk.saturating_add(1));

            // 以用户身份执行真实调用
            let dispatch_result = meta.call.dispatch(RawOrigin::Signed(owner.clone()).into());

            // 事件（无论成功与否，外层费用由赞助者承担）
            if dispatch_result.is_ok() {
                Self::deposit_event(Event::Forwarded { owner, sponsor: sponsor.clone(), ns: meta.ns, session_id: meta.session_id });
            } else {
                Self::deposit_event(Event::ForwardFailed { owner, sponsor: sponsor.clone(), ns: meta.ns, session_id: meta.session_id, code: 7 });
            }

            // 窗口统计：赞助者×ns
            SponsorWindowStats::<T>::mutate(sponsor.clone(), meta.ns, |w| {
                let wb = T::ForwarderWindowBlocks::get();
                let now_blk = now;
                if now_blk.saturating_sub(w.0) >= wb { w.0 = now_blk; w.1 = 0; w.2 = 0; }
                w.1 = w.1.saturating_add(1);
                w.2 = w.2
                    .saturating_add(info.call_weight.ref_time())
                    .saturating_add(info.extension_weight.ref_time());
            });

            dispatch_result
        }

        /// 函数级中文注释：批量清理 owner+ns 下已过期会话（最多移除 limit 个）。
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::purge_expired())]
        pub fn purge_expired(origin: OriginFor<T>, ns: [u8; 8], limit: u32) -> DispatchResult {
            let owner = ensure_signed(origin)?;
            let now = frame_system::Pallet::<T>::block_number();
            let mut removed: u32 = 0;
            for sid in Sessions::<T>::iter_key_prefix((owner.clone(), ns)) {
                if removed >= limit { break; }
                if let Some(p) = Sessions::<T>::get((owner.clone(), ns), sid) {
                    if now > p.expires_at {
                        Sessions::<T>::remove((owner.clone(), ns), sid);
                        SessionNonce::<T>::remove((owner.clone(), ns), sid);
                        SessionStats::<T>::remove((owner.clone(), ns), sid);
                        removed = removed.saturating_add(1);
                    }
                }
            }
            Ok(())
        }
    }

    #[pallet::view_functions]
    impl<T: Config> Pallet<T> {
        /// 只读：读取指定区块的代付条数
        pub fn forwarded_count_at(n: BlockNumberFor<T>) -> u32 { ForwardedPerBlock::<T>::get(n) }
        /// 只读：读取赞助者×命名空间的统计窗口 (window_start, calls, ref_time)
        pub fn sponsor_window_stats(sponsor: T::AccountId, ns: [u8;8]) -> (BlockNumberFor<T>, u32, u64) { SponsorWindowStats::<T>::get(sponsor, ns) }
    }
}


