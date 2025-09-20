#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;
use sp_runtime::traits::AtLeast32BitUnsigned;
use frame_support::weights::Weight;
// use sp_runtime::Saturating;

/// 函数级中文注释：墓位接口抽象，保持与 `pallet-grave` 低耦合。
/// - `grave_exists`：校验墓位是否存在，避免挂接到无效墓位。
/// - `can_attach`：校验操作者是否有权在该墓位下管理逝者（通常是墓主或被授权者）。
pub trait GraveInspector<AccountId, GraveId> {
    fn grave_exists(grave_id: GraveId) -> bool;
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool;
    /// 函数级中文注释：可选的冗余校验接口——返回墓地下缓存的逝者令牌数量（若无实现则返回 None）。
    /// - 默认由 runtime 适配器从 `pallet-memo-grave::Graves[id].deceased_tokens.len()` 读取；
    /// - 仅作为快速拒绝优化，最终仍以本模块 `DeceasedByGrave` 的长度为准。
    fn cached_deceased_tokens_len(grave_id: GraveId) -> Option<u32> { let _ = grave_id; None }
}

/// 函数级中文注释：权重信息占位接口，后续可通过 benchmarking 生成并替换。
pub trait WeightInfo {
    fn create() -> Weight;
    fn update() -> Weight;
    fn remove() -> Weight;
    fn transfer() -> Weight;
}

impl WeightInfo for () {
    /// 函数级中文注释：Weight 新结构不再支持从整数直接转换，使用 from_parts(ref_time, proof_size)。
    fn create() -> Weight { Weight::from_parts(10_000, 0) }
    fn update() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove() -> Weight { Weight::from_parts(10_000, 0) }
    fn transfer() -> Weight { Weight::from_parts(10_000, 0) }
}

/// 函数级中文注释：性别枚举。
/// - 仅三种取值：M(男)、F(女)、B(保密/双性/未指明)。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub enum Gender { M, F, B }

/// 函数级中文注释：逝者实体，链上仅存最小必要信息与链下指针。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Deceased<T: Config> {
    /// 所属墓位 ID
    pub grave_id: T::GraveId,
    /// 记录拥有者（通常等于墓位所有者或其授权人）
    pub owner: T::AccountId,
    /// 姓名（限长，避免敏感信息超量上链）
    pub name: BoundedVec<u8, T::StringLimit>,
    /// 姓名拼音徽标（大写，不含空格与特殊字符）。
    pub name_badge: BoundedVec<u8, T::StringLimit>,
    /// 性别枚举：M/F/B。
    pub gender: Gender,
    /// 函数级中文注释：全名的链下指针 CID（IPFS/HTTPS 等），建议前端使用该字段展示完整姓名；
    /// - 隐私：不在链上直接存储超长姓名明文；
    /// - 约束：可选字段；长度受 `TokenLimit` 约束，建议与外部引用者的 MaxCidLen 对齐；
    pub name_full_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    /// 出生与离世日期（可选，格式：YYYYMMDD，如 19811224）
    pub birth_ts: Option<BoundedVec<u8, T::StringLimit>>,
    pub death_ts: Option<BoundedVec<u8, T::StringLimit>>,
    /// 函数级中文注释：逝者主图 CID（IPFS/HTTPS 等）
    /// - 用途：前端头像/主图展示的链下资源指针；不在链上存原图
    /// - 安全：仅存 CID 字节；不涉及任何 MEMO 代币逻辑；长度受 TokenLimit 约束
    /// - 权限：owner 可直接设置/修改；非 owner 需通过 Root 治理设置
    pub main_image_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    /// 逝者令牌（在 pallet 内构造）：gender + birth + death + name_badge
    /// 例如：M1981122420250901LIUXIAODONG
    /// 长度上限单独由 `Config::TokenLimit` 约束，便于与外部引用保持一致。
    pub deceased_token: BoundedVec<u8, T::TokenLimit>,
    /// 外部资源链接（IPFS/HTTPS），每条与数量均受限
    pub links: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>,
    /// 创建与更新区块号
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::traits::StorageVersion;
    use sp_runtime::traits::SaturatedConversion;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 逝者 ID 类型
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 墓位 ID 类型（由外部 pallet 定义）
        type GraveId: Parameter + Member + Copy + MaxEncodedLen;

        /// 每墓位最大逝者数量
        #[pallet::constant]
        type MaxDeceasedPerGrave: Get<u32>;

        /// 单字段字符串长度上限
        #[pallet::constant]
        type StringLimit: Get<u32>;

        /// 最大外部链接条数
        #[pallet::constant]
        type MaxLinks: Get<u32>;

        /// 函数级中文注释：业务上每个墓位下允许的逝者上限（软上限）。
        /// - 与泛型 `MaxDeceasedPerGrave`（硬上限）并存；
        /// - 本模块在创建/迁移时同时检查软上限，默认值建议为 6；
        /// - 可通过治理升级灵活调整，兼容未来迁移。
        #[pallet::constant]
        type MaxDeceasedPerGraveSoft: Get<u32>;

        /// 函数级中文注释：`deceased_token` 的最大长度上限（字节）。
        /// - 设计目标：与外部引用者（如 `pallet-memo-grave`）的 `MaxCidLen` 对齐，避免跨 pallet 不一致。
        #[pallet::constant]
        type TokenLimit: Get<u32>;

        /// 墓位校验与权限提供者（低耦合关键）
        type GraveProvider: GraveInspector<Self::AccountId, Self::GraveId>;

        /// 权重信息
        type WeightInfo: WeightInfo;

        /// 函数级中文注释：治理起源（内容治理轨道/委员会白名单/Root 等）。
        /// - 用于本 Pallet 的治理专用接口（gov*），执行“失钥救济/内容治理类 C/U/D”。
        /// - 建议在 Runtime 中绑定为 EitherOfDiverse<Root, EnsureContentSigner>，与其他内容域保持一致。
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    }

    #[pallet::storage]
    #[pallet::getter(fn next_deceased_id)]
    /// 下一可用的逝者 ID
    pub type NextDeceasedId<T: Config> = StorageValue<_, T::DeceasedId, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn deceased_of)]
    /// 逝者详情：DeceasedId -> Deceased
    pub type DeceasedOf<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, Deceased<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn deceased_by_grave)]
    /// 墓位下的逝者列表：GraveId -> BoundedVec<DeceasedId>
    pub type DeceasedByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, BoundedVec<T::DeceasedId, T::MaxDeceasedPerGrave>, ValueQuery>;

    /// 函数级中文注释：逝者可见性标记（默认公开）。
    /// - 设计：创建时写入 true；后续可由管理员/owner 通过 set_visibility 修改。
    /// - 读取：若不存在记录（None）应视作 true（默认公开）。
    #[pallet::storage]
    pub type VisibilityOf<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, bool, OptionQuery>;

    /// 函数级中文注释：按 `deceased_token` 建立的唯一索引，用于防止重复创建。
    /// - Key：`deceased_token`（BoundedVec<u8, TokenLimit>）。
    /// - Val：`DeceasedId`。
    /// - 说明：在 create/update 时分别插入与维护，禁止同 token 的重复记录。
    #[pallet::storage]
    pub type DeceasedIdByToken<T: Config> = StorageMap<_, Blake2_128Concat, BoundedVec<u8, T::TokenLimit>, T::DeceasedId, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 新建逝者 (id, grave_id, owner)
        DeceasedCreated(T::DeceasedId, T::GraveId, T::AccountId),
        /// 更新逝者 (id)
        DeceasedUpdated(T::DeceasedId),
        /// 函数级中文注释：可见性已变更 (id, public)
        VisibilityChanged(T::DeceasedId, bool),
        /// 迁移逝者到新墓位 (id, from_grave, to_grave)
        DeceasedTransferred(T::DeceasedId, T::GraveId, T::GraveId),
        /// 逝者关系：已提交绑定请求(from -> to)
        RelationProposed(T::DeceasedId, T::DeceasedId, u8),
        /// 逝者关系：已批准绑定
        RelationApproved(T::DeceasedId, T::DeceasedId, u8),
        /// 逝者关系：已拒绝
        RelationRejected(T::DeceasedId, T::DeceasedId),
        /// 逝者关系：已撤销
        RelationRevoked(T::DeceasedId, T::DeceasedId),
        /// 逝者关系：备注更新
        RelationUpdated(T::DeceasedId, T::DeceasedId),
        /// 函数级中文注释：主图已更新（true=设置/修改；false=清空）
        MainImageUpdated(T::DeceasedId, bool),
        /// 函数级中文注释：治理证据已记录 (id, evidence_cid)。
        GovEvidenceNoted(T::DeceasedId, BoundedVec<u8, T::TokenLimit>),
        /// 函数级中文注释：治理设置主图（Some 设置；None 清空）。
        GovMainImageSet(T::DeceasedId, bool),
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 墓位不存在
        GraveNotFound,
        /// 无权限操作
        NotAuthorized,
        /// 该墓位下逝者数量已达上限
        TooManyDeceasedInGrave,
        /// 逝者不存在
        DeceasedNotFound,
        /// ID 溢出
        Overflow,
        /// 输入不合法（长度/数量越界等）
        BadInput,
        /// 关系已存在
        RelationExists,
        /// 关系不存在
        RelationNotFound,
        /// 非法关系类型
        BadRelationKind,
        /// 对方管理员未批准
        PendingApproval,
        /// 函数级中文注释：出于合规与审计需求，逝者一经创建不可删除；请改用迁移或关系功能。
        DeletionForbidden,
        /// 函数级中文注释：同样的 `deceased_token` 已存在，禁止重复创建。
        DeceasedTokenExists,
        /// 函数级中文注释：owner 为创建者且永久不可变更。
        OwnerImmutable,
        /// 函数级中文注释：亲友相关——成员已存在
        FriendAlreadyMember,
        /// 亲友相关——成员不存在
        FriendNotMember,
        /// 亲友相关——待审批已存在
        FriendPendingExists,
        /// 亲友相关——不存在待审批
        FriendNoPending,
        /// 亲友相关——成员数量达到上限
        FriendTooMany,
    }

    // 存储版本常量（用于 FRAME v2 storage_version 宏传参）
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(5);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 函数级中文注释：逝者关系记录。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Relation<T: Config> {
        pub kind: u8,
        pub note: BoundedVec<u8, T::StringLimit>,
        pub created_by: T::AccountId,
        pub since: BlockNumberFor<T>,
    }

    // =================== 亲友团：存储与类型（最小实现，无押金） ===================
    /// 函数级中文注释：亲友角色枚举（0=Member，1=Core，2=Admin）。Admin 固定包含逝者 owner。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub enum FriendRole { Member, Core, Admin }

    /// 函数级中文注释：亲友策略
    /// - require_approval：是否需要管理员审批
    /// - is_private：是否私密（仅管理员可读成员明细，对外仅暴露 FriendCount）
    /// - max_members：上限，受限以防膨胀
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct FriendPolicy<T: Config> {
        pub require_approval: bool,
        pub is_private: bool,
        pub max_members: u32,
        pub _phantom: core::marker::PhantomData<T>,
    }

    /// 函数级中文注释：亲友成员记录
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct FriendRecord<T: Config> {
        pub role: FriendRole,
        pub since: BlockNumberFor<T>,
        pub note: BoundedVec<u8, T::StringLimit>,
    }

    /// 亲友策略：DeceasedId -> FriendPolicy
    #[pallet::storage]
    pub type FriendPolicyOf<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, FriendPolicy<T>, OptionQuery>;

    /// 亲友成员： (DeceasedId, AccountId) -> FriendRecord
    #[pallet::storage]
    pub type FriendsOf<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::DeceasedId, Blake2_128Concat, T::AccountId, FriendRecord<T>, OptionQuery>;

    /// 亲友计数： DeceasedId -> u32
    #[pallet::storage]
    pub type FriendCount<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, u32, ValueQuery>;

    /// 待审批： DeceasedId -> BoundedVec<(AccountId, BlockNumber), ConstU32<256>>
    #[pallet::storage]
    pub type FriendJoinRequests<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<(T::AccountId, BlockNumberFor<T>), ConstU32<256>>, ValueQuery>;

    #[pallet::storage]
    pub type Relations<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::DeceasedId, Blake2_128Concat, T::DeceasedId, Relation<T>, OptionQuery>;

    #[pallet::storage]
    pub type RelationsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<(T::DeceasedId, u8), ConstU32<128>>, ValueQuery>;

    #[pallet::storage]
    pub type PendingRelationRequests<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::DeceasedId, Blake2_128Concat, T::DeceasedId, (u8, T::AccountId, BoundedVec<u8, T::StringLimit>, BlockNumberFor<T>), OptionQuery>;

    /// 函数级详细中文注释：关系工具函数与规范
    /// - 0=ParentOf(有向) 1=SpouseOf(无向) 2=SiblingOf(无向) 3=ChildOf(有向)
    fn is_undirected_kind(kind: u8) -> bool { matches!(kind, 1 | 2) }

    /// 函数级详细中文注释：关系冲突矩阵（最小实现）
    /// - 父母/子女 与 配偶/兄弟姐妹 互斥；父母 与 子女 互斥（方向相反视为同类）
    fn is_conflicting_kind(a: u8, b: u8) -> bool {
        let dir_a = matches!(a, 0 | 3);
        let dir_b = matches!(b, 0 | 3);
        if dir_a && dir_b { return true; }
        if (dir_a && is_undirected_kind(b)) || (dir_b && is_undirected_kind(a)) { return true; }
        false
    }

    /// 函数级详细中文注释：对无向关系使用 canonical(min,max) 键；有向关系保持 (from,to) 原样
    fn canonical_ids<TC: Config>(from: TC::DeceasedId, to: TC::DeceasedId, kind: u8) -> (TC::DeceasedId, TC::DeceasedId) {
        if is_undirected_kind(kind) {
            let af: u128 = from.saturated_into::<u128>();
            let bf: u128 = to.saturated_into::<u128>();
            if af <= bf { (from, to) } else { (to, from) }
        } else { (from, to) }
    }

    // =================== Pallet 工具函数（非外部可调用） ===================
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：判断账户是否为该逝者的管理员（owner 视为 Admin）。
        pub(crate) fn is_admin(deceased_id: T::DeceasedId, who: &T::AccountId) -> bool {
            if let Some(d) = DeceasedOf::<T>::get(deceased_id) {
                if d.owner == *who { return true; }
            }
            if let Some(rec) = FriendsOf::<T>::get(deceased_id, who) {
                matches!(rec.role, FriendRole::Admin)
            } else { false }
        }

        /// 函数级中文注释（内部工具）：将证据 CID 记入事件，返回有界向量。
        pub(crate) fn note_evidence(id: T::DeceasedId, cid: Vec<u8>) -> Result<BoundedVec<u8, T::TokenLimit>, sp_runtime::DispatchError> {
            let bv: BoundedVec<u8, T::TokenLimit> = BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            Self::deposit_event(Event::GovEvidenceNoted(id, bv.clone()));
            Ok(bv)
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建逝者记录并挂接到墓位。
        /// - 权限：`GraveProvider::can_attach(origin, grave_id)` 必须为真；
        /// - 安全：限制文本与链接长度；敏感信息仅存链下链接；
        /// - 事件：`DeceasedCreated`。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::create())]
        pub fn create_deceased(
            origin: OriginFor<T>,
            grave_id: T::GraveId,
            name: Vec<u8>,
            name_badge: Vec<u8>,
            gender_code: u8, // 0=M,1=F,2=B
            // bio 移除：简介/悼词请使用 deceased-data::Life（IPFS CID）
            name_full_cid: Option<Vec<u8>>, // 可选：完整姓名的链下 CID
            birth_ts: Vec<u8>, // 必填，格式 YYYYMMDD（8 位数字）
            death_ts: Vec<u8>, // 必填，格式 YYYYMMDD（8 位数字）
            links: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::GraveProvider::grave_exists(grave_id), Error::<T>::GraveNotFound);
            ensure!(T::GraveProvider::can_attach(&who, grave_id), Error::<T>::NotAuthorized);
            // 冗余快速校验：若外部缓存的令牌数已达软上限，也直接拒绝（最终仍以下方 DeceasedByGrave 为准）
            if let Some(cached) = T::GraveProvider::cached_deceased_tokens_len(grave_id) {
                ensure!(cached < T::MaxDeceasedPerGraveSoft::get(), Error::<T>::TooManyDeceasedInGrave);
            }
            // 软上限权威校验：每墓位最多允许的逝者数量（默认 6）。
            let existing_in_grave = DeceasedByGrave::<T>::get(grave_id).len() as u32;
            ensure!(existing_in_grave < T::MaxDeceasedPerGraveSoft::get(), Error::<T>::TooManyDeceasedInGrave);

            // 校验与规范化字段
            let name_bv: BoundedVec<_, <T as pallet::Config>::StringLimit> = BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            // name_badge：仅保留 [A-Z]，并转为大写
            fn to_badge(input: Vec<u8>) -> Vec<u8> {
                input.into_iter().filter_map(|b| {
                    let up = if (b'a'..=b'z').contains(&b) { b - 32 } else { b };
                    if (b'A'..=b'Z').contains(&up) { Some(up) } else { None }
                }).collect::<Vec<u8>>()
            }
            let badge_vec = to_badge(name_badge);
            let name_badge_bv: BoundedVec<_, <T as pallet::Config>::StringLimit> = BoundedVec::try_from(badge_vec).map_err(|_| Error::<T>::BadInput)?;
            let gender: Gender = match gender_code { 0 => Gender::M, 1 => Gender::F, _ => Gender::B };
            // 校验日期：若提供则必须为 8 位数字
            fn is_yyyymmdd(v: &Vec<u8>) -> bool { v.len() == 8 && v.iter().all(|b| (b'0'..=b'9').contains(b)) }
            ensure!(is_yyyymmdd(&birth_ts), Error::<T>::BadInput);
            ensure!(is_yyyymmdd(&death_ts), Error::<T>::BadInput);
            let birth_bv: Option<BoundedVec<_, <T as pallet::Config>::StringLimit>> = Some(BoundedVec::try_from(birth_ts).map_err(|_| Error::<T>::BadInput)?);
            let death_bv: Option<BoundedVec<_, <T as pallet::Config>::StringLimit>> = Some(BoundedVec::try_from(death_ts).map_err(|_| Error::<T>::BadInput)?);
            // 可选 CID 校验（仅限长度）
            let name_full_cid_bv: Option<BoundedVec<u8, T::TokenLimit>> = match name_full_cid {
                Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                None => None,
            };

            let mut links_bv: BoundedVec<BoundedVec<u8, <T as pallet::Config>::StringLimit>, T::MaxLinks> = Default::default();
            for l in links.into_iter() {
                let lb: BoundedVec<_, <T as pallet::Config>::StringLimit> = BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
            }

            let id = NextDeceasedId::<T>::get();
            let next = id.checked_add(&<T as pallet::Config>::DeceasedId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextDeceasedId::<T>::put(next);

            let now: BlockNumberFor<T> = <frame_system::Pallet<T>>::block_number();
            // 构造 token：GENDER + birth + death + name_badge
            fn build_token<TC: Config>(g: &Gender, birth: &Option<BoundedVec<u8, TC::StringLimit>>, death: &Option<BoundedVec<u8, TC::StringLimit>>, badge: &BoundedVec<u8, TC::StringLimit>) -> BoundedVec<u8, TC::TokenLimit> {
                let mut v: Vec<u8> = Vec::new();
                let c = match g { Gender::M => b'M', Gender::F => b'F', Gender::B => b'B' };
                v.push(c);
                if let Some(b) = birth { v.extend_from_slice(b.as_slice()); }
                if let Some(d) = death { v.extend_from_slice(d.as_slice()); }
                v.extend_from_slice(badge.as_slice());
                // 若超长则按 TokenLimit 截断，优先保留前缀信息
                let max = <TC as Config>::TokenLimit::get() as usize;
                let mut out = v;
                if out.len() > max { out.truncate(max); }
                BoundedVec::<u8, TC::TokenLimit>::try_from(out).unwrap_or_default()
            }
            let deceased_token = build_token::<T>(&gender, &birth_bv, &death_bv, &name_badge_bv);
            // 唯一性检查：同 token 已存在则拒绝创建
            ensure!(DeceasedIdByToken::<T>::get(&deceased_token).is_none(), Error::<T>::DeceasedTokenExists);
            let deceased = Deceased::<T> {
                grave_id,
                owner: who.clone(),
                name: name_bv,
                name_badge: name_badge_bv,
                gender,
                // bio 已移除：请使用 deceased-data::Life（CID）
                name_full_cid: name_full_cid_bv,
                birth_ts: birth_bv,
                death_ts: death_bv,
                main_image_cid: None,
                deceased_token,
                links: links_bv,
                created: now,
                updated: now,
            };

            DeceasedOf::<T>::insert(id, deceased);
            DeceasedByGrave::<T>::try_mutate(grave_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooManyDeceasedInGrave))?;
            // 默认公开
            VisibilityOf::<T>::insert(id, true);
            // 建立 token -> id 索引
            if let Some(d) = DeceasedOf::<T>::get(id) { DeceasedIdByToken::<T>::insert(d.deceased_token, id); }

            // 由运行时或外部服务初始化 Life（去耦合：本 pallet 不直接依赖 deceased-data）。

            Self::deposit_event(Event::DeceasedCreated(id, grave_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新逝者信息（不变更所属墓位）。
        /// - 权限：仅记录 `owner`；
        /// - 可选字段逐项更新；
        /// - 事件：`DeceasedUpdated`。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn update_deceased(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            name: Option<Vec<u8>>,
            name_badge: Option<Vec<u8>>,
            gender_code: Option<u8>,
            // bio 已移除
            name_full_cid: Option<Option<Vec<u8>>>,
            birth_ts: Option<Option<Vec<u8>>>,
            death_ts: Option<Option<Vec<u8>>>,
            links: Option<Vec<Vec<u8>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                ensure!(d.owner == who, Error::<T>::NotAuthorized);
                // 捕获初始 owner，保证不可变更
                let original_owner = d.owner.clone();
                // 记录旧 token 以便更新索引
                let old_token = d.deceased_token.clone();

                if let Some(n) = name { d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(nb) = name_badge {
                    let vec = nb.into_iter().filter_map(|b| { let up = if (b'a'..=b'z').contains(&b) { b-32 } else { b }; if (b'A'..=b'Z').contains(&up) { Some(up) } else { None } }).collect::<Vec<u8>>();
                    d.name_badge = BoundedVec::try_from(vec).map_err(|_| Error::<T>::BadInput)?;
                }
                if let Some(gc) = gender_code { d.gender = match gc { 0 => Gender::M, 1 => Gender::F, _ => Gender::B }; }
                // bio 已移除：改由 deceased-data::Life 维护
                if let Some(cid_opt) = name_full_cid {
                    d.name_full_cid = match cid_opt {
                        Some(v) => Some(BoundedVec::<u8, T::TokenLimit>::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                        None => None,
                    };
                }
                // 主图字段通过专用接口设置/清空（见 set_main_image/clear_main_image）
                if let Some(bi) = birth_ts {
                    d.birth_ts = match bi { Some(v) => { ensure!(v.len()==8 && v.iter().all(|x| (b'0'..=b'9').contains(x)), Error::<T>::BadInput); Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?) }, None => None };
                }
                if let Some(de) = death_ts {
                    d.death_ts = match de { Some(v) => { ensure!(v.len()==8 && v.iter().all(|x| (b'0'..=b'9').contains(x)), Error::<T>::BadInput); Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?) }, None => None };
                }
                if let Some(ls) = links {
                    let mut links_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks> = Default::default();
                    for l in ls.into_iter() {
                        let lb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                        links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    d.links = links_bv;
                }
                d.updated = <frame_system::Pallet<T>>::block_number();
                // 重新构造 token
                let mut v: Vec<u8> = Vec::new();
                let c = match d.gender { Gender::M => b'M', Gender::F => b'F', Gender::B => b'B' };
                v.push(c);
                if let Some(ref b) = d.birth_ts { v.extend_from_slice(b.as_slice()); }
                if let Some(ref de) = d.death_ts { v.extend_from_slice(de.as_slice()); }
                v.extend_from_slice(d.name_badge.as_slice());
                let max = <T as Config>::TokenLimit::get() as usize;
                if v.len() > max { v.truncate(max); }
                let new_token: BoundedVec<u8, T::TokenLimit> = BoundedVec::<u8, T::TokenLimit>::try_from(v).unwrap_or_default();
                // 若 token 发生变化，需检查唯一性并更新索引
                if new_token != old_token {
                    if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) {
                        // 已存在同 token 且不是当前记录 → 拒绝
                        if existing_id != id { return Err(Error::<T>::DeceasedTokenExists.into()); }
                    }
                    // 更新存储与索引
                    d.deceased_token = new_token.clone();
                    DeceasedIdByToken::<T>::remove(old_token);
                    DeceasedIdByToken::<T>::insert(new_token, id);
                }
                // 结束前再次断言 owner 未被篡改
                ensure!(d.owner == original_owner, Error::<T>::OwnerImmutable);
                Ok(())
            })?;

            Self::deposit_event(Event::DeceasedUpdated(id));
            Ok(())
        }

        /// 函数级中文注释：删除逝者（已禁用）。
        /// - 设计原则：为保证历史可追溯与家族谱系稳定，逝者一经创建不可删除；
        /// - 替代方案：
        ///   1) 使用 `transfer_deceased` 迁移至新的墓位（GRAVE）；
        ///   2) 通过逝者关系（亲友团）将成员关系维护到其他逝者名下；
        /// - 行为：本函数保持签名以兼容旧调用索引，但始终返回 `DeletionForbidden` 错误。
        // 已禁用：remove_deceased（为合规与审计保全，逝者创建后不可删除）

        /// 函数级中文注释：迁移逝者到新的墓位。
        /// - 权限：仅 `owner` 且新墓位需通过 `GraveProvider::can_attach`；
        /// - 事件：`DeceasedTransferred`。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::transfer())]
        pub fn transfer_deceased(origin: OriginFor<T>, id: T::DeceasedId, new_grave: T::GraveId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::GraveProvider::grave_exists(new_grave), Error::<T>::GraveNotFound);
            ensure!(T::GraveProvider::can_attach(&who, new_grave), Error::<T>::NotAuthorized);
            // 软上限校验：目标墓位是否已达上限
            let existing_in_target = DeceasedByGrave::<T>::get(new_grave).len() as u32;
            ensure!(existing_in_target < T::MaxDeceasedPerGraveSoft::get(), Error::<T>::TooManyDeceasedInGrave);

            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                ensure!(d.owner == who, Error::<T>::NotAuthorized);
                let original_owner = d.owner.clone();

                // 先检查新墓位容量
                DeceasedByGrave::<T>::try_mutate(new_grave, |list| list.try_push(id).map_err(|_| Error::<T>::TooManyDeceasedInGrave))?;

                // 从旧墓位移除
                DeceasedByGrave::<T>::mutate(d.grave_id, |list| {
                    if let Some(pos) = list.iter().position(|x| x == &id) { list.swap_remove(pos); }
                });

                let old = d.grave_id;
                d.grave_id = new_grave;
                d.updated = <frame_system::Pallet<T>>::block_number();
                ensure!(d.owner == original_owner, Error::<T>::OwnerImmutable);
                Self::deposit_event(Event::DeceasedTransferred(id, old, new_grave));
                Ok(())
            })
        }

        /// 函数级中文注释：设置逝者可见性（public=true 公开；false 私有）。仅 Admin（含 owner）。
        /// - 默认：创建时已设为公开；本接口用于按需关闭/开启展示。
        /// - 事件：VisibilityChanged(id, public)
        #[pallet::call_index(39)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn set_visibility(origin: OriginFor<T>, id: T::DeceasedId, public: bool) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(DeceasedOf::<T>::contains_key(id), Error::<T>::DeceasedNotFound);
            ensure!(Self::is_admin(id, &who), Error::<T>::NotAuthorized);
            VisibilityOf::<T>::insert(id, public);
            Self::deposit_event(Event::VisibilityChanged(id, public));
            Ok(())
        }

        /// 函数级中文注释：设置/修改逝者主图（CID）。
        /// - 权限：owner 可直接设置；非 owner 需 Root 治理来源。
        /// - 事件：MainImageUpdated(id, true)
        #[pallet::call_index(40)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn set_main_image(origin: OriginFor<T>, id: T::DeceasedId, cid: Vec<u8>) -> DispatchResult {
            let is_root = ensure_root(origin.clone()).is_ok();
            let who = ensure_signed(origin.clone()).ok();
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                if !is_root {
                    let caller = who.as_ref().ok_or(Error::<T>::NotAuthorized)?;
                    ensure!(d.owner == *caller, Error::<T>::NotAuthorized);
                }
                let bv: BoundedVec<u8, T::TokenLimit> = BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
                d.main_image_cid = Some(bv);
                d.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            // 迁移决策：主图功能已移至 `pallet-deceased-media`，此处接口保留仅为兼容。
            // 事件维持，便于前端平滑过渡。
            Self::deposit_event(Event::MainImageUpdated(id, true));
            Ok(())
        }

        /// 函数级中文注释：清空逝者主图。
        /// - 权限：owner 或 Root。
        /// - 事件：MainImageUpdated(id, false)
        #[pallet::call_index(41)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn clear_main_image(origin: OriginFor<T>, id: T::DeceasedId) -> DispatchResult {
            let is_root = ensure_root(origin.clone()).is_ok();
            let who = ensure_signed(origin.clone()).ok();
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                if !is_root {
                    let caller = who.as_ref().ok_or(Error::<T>::NotAuthorized)?;
                    ensure!(d.owner == *caller, Error::<T>::NotAuthorized);
                }
                d.main_image_cid = None;
                d.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            // 迁移决策：主图功能已移至 `pallet-deceased-media`，此处接口保留仅为兼容。
            Self::deposit_event(Event::MainImageUpdated(id, false));
            Ok(())
        }

        /// 函数级中文注释：【治理】设置/清空逝者主图（CID）。
        /// - 允许非 owner，通过治理路径强制修复头像内容；记录证据。
        #[pallet::call_index(45)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn gov_set_main_image(origin: OriginFor<T>, id: T::DeceasedId, cid: Option<Vec<u8>>, evidence_cid: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            let is_some = cid.is_some();
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                d.main_image_cid = match cid { Some(v)=>Some(BoundedVec::<u8, T::TokenLimit>::try_from(v).map_err(|_| Error::<T>::BadInput)?), None=>None };
                d.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::GovMainImageSet(id, is_some));
            Ok(())
        }

        // =================== 治理专用接口（gov*） ===================
        /// 函数级中文注释：治理更新逝者信息（不变更 owner）。
        /// - 起源：T::GovernanceOrigin（内容治理轨道授权/委员会白名单/Root）。
        /// - 要求：必须携带证据 CID（IPFS 明文），仅长度校验，内容由前端/索引侧审计。
        /// - 行为：与 `update_deceased` 类似，但不校验 owner；不可更改 owner。
        #[pallet::call_index(42)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn gov_update_profile(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            name: Option<Vec<u8>>,
            name_badge: Option<Vec<u8>>,
            gender_code: Option<u8>,
            name_full_cid: Option<Option<Vec<u8>>>,
            birth_ts: Option<Option<Vec<u8>>>,
            death_ts: Option<Option<Vec<u8>>>,
            links: Option<Vec<Vec<u8>>>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                let original_owner = d.owner.clone();
                let old_token = d.deceased_token.clone();
                if let Some(n) = name { d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(nb) = name_badge {
                    let vec = nb.into_iter().filter_map(|b| { let up = if (b'a'..=b'z').contains(&b) { b-32 } else { b }; if (b'A'..=b'Z').contains(&up) { Some(up) } else { None } }).collect::<Vec<u8>>();
                    d.name_badge = BoundedVec::try_from(vec).map_err(|_| Error::<T>::BadInput)?;
                }
                if let Some(gc) = gender_code { d.gender = match gc { 0 => Gender::M, 1 => Gender::F, _ => Gender::B }; }
                if let Some(cid_opt) = name_full_cid {
                    d.name_full_cid = match cid_opt { Some(v) => Some(BoundedVec::<u8, T::TokenLimit>::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                }
                if let Some(bi) = birth_ts {
                    d.birth_ts = match bi { Some(v) => { ensure!(v.len()==8 && v.iter().all(|x| (b'0'..=b'9').contains(x)), Error::<T>::BadInput); Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?) }, None => None };
                }
                if let Some(de) = death_ts {
                    d.death_ts = match de { Some(v) => { ensure!(v.len()==8 && v.iter().all(|x| (b'0'..=b'9').contains(x)), Error::<T>::BadInput); Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?) }, None => None };
                }
                if let Some(ls) = links {
                    let mut links_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks> = Default::default();
                    for l in ls.into_iter() {
                        let lb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                        links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    d.links = links_bv;
                }
                d.updated = <frame_system::Pallet<T>>::block_number();
                // 重建 token 并维护唯一索引
                let mut v: Vec<u8> = Vec::new();
                let c = match d.gender { Gender::M => b'M', Gender::F => b'F', Gender::B => b'B' };
                v.push(c);
                if let Some(ref b) = d.birth_ts { v.extend_from_slice(b.as_slice()); }
                if let Some(ref de) = d.death_ts { v.extend_from_slice(de.as_slice()); }
                v.extend_from_slice(d.name_badge.as_slice());
                let max = <T as Config>::TokenLimit::get() as usize; if v.len() > max { v.truncate(max); }
                let new_token: BoundedVec<u8, T::TokenLimit> = BoundedVec::<u8, T::TokenLimit>::try_from(v).unwrap_or_default();
                if new_token != old_token {
                    if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) { if existing_id != id { return Err(Error::<T>::DeceasedTokenExists.into()); } }
                    d.deceased_token = new_token.clone();
                    DeceasedIdByToken::<T>::remove(old_token);
                    DeceasedIdByToken::<T>::insert(new_token, id);
                }
                ensure!(d.owner == original_owner, Error::<T>::OwnerImmutable);
                Ok(())
            })?;
            Self::deposit_event(Event::DeceasedUpdated(id));
            Ok(())
        }

        /// 函数级中文注释：治理迁移逝者到新墓位（不更改 owner）。
        #[pallet::call_index(43)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::transfer())]
        pub fn gov_transfer_deceased(origin: OriginFor<T>, id: T::DeceasedId, new_grave: T::GraveId, evidence_cid: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            ensure!(T::GraveProvider::grave_exists(new_grave), Error::<T>::GraveNotFound);
            let existing_in_target = DeceasedByGrave::<T>::get(new_grave).len() as u32;
            ensure!(existing_in_target < T::MaxDeceasedPerGraveSoft::get(), Error::<T>::TooManyDeceasedInGrave);
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                let original_owner = d.owner.clone();
                DeceasedByGrave::<T>::try_mutate(new_grave, |list| list.try_push(id).map_err(|_| Error::<T>::TooManyDeceasedInGrave))?;
                DeceasedByGrave::<T>::mutate(d.grave_id, |list| { if let Some(pos) = list.iter().position(|x| x == &id) { list.swap_remove(pos); } });
                let old = d.grave_id;
                d.grave_id = new_grave;
                d.updated = <frame_system::Pallet<T>>::block_number();
                ensure!(d.owner == original_owner, Error::<T>::OwnerImmutable);
                Self::deposit_event(Event::DeceasedTransferred(id, old, new_grave));
                Ok(())
            })
        }

        /// 函数级中文注释：治理设置可见性（不要求 owner/Admin）。
        #[pallet::call_index(44)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn gov_set_visibility(origin: OriginFor<T>, id: T::DeceasedId, public: bool, evidence_cid: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            ensure!(DeceasedOf::<T>::contains_key(id), Error::<T>::DeceasedNotFound);
            VisibilityOf::<T>::insert(id, public);
            Self::deposit_event(Event::VisibilityChanged(id, public));
            Ok(())
        }
        /// 函数级中文注释：从 A(发起方) → B(对方) 发起关系绑定请求。
        /// - 权限：A 所属墓位的管理员（通过 GraveProvider::can_attach(sender, A.grave_id) 判定）。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn propose_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId, kind: u8, note: Option<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let _b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, a.grave_id), Error::<T>::NotAuthorized);
            ensure!(from != to, Error::<T>::BadInput);
            ensure!(matches!(kind, 0..=3), Error::<T>::BadRelationKind);
            // 去重：主记录存在则拒绝；无向需同时检查反向
            if Relations::<T>::contains_key(from, to) { return Err(Error::<T>::RelationExists.into()); }
            if is_undirected_kind(kind) && Relations::<T>::contains_key(to, from) { return Err(Error::<T>::RelationExists.into()); }
            // Pending 去重：无向需阻止反向重复提案
            if is_undirected_kind(kind) && PendingRelationRequests::<T>::contains_key(to, from) { return Err(Error::<T>::PendingApproval.into()); }
            // 冲突：若另一方向已存在且冲突
            if let Some(r) = Relations::<T>::get(to, from) { if is_conflicting_kind(r.kind, kind) { return Err(Error::<T>::BadRelationKind.into()); } }
            let now = <frame_system::Pallet<T>>::block_number();
            let note_bv: BoundedVec<_, T::StringLimit> = match note { Some(v) => BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?, None => Default::default() };
            PendingRelationRequests::<T>::insert(from, to, (kind, who, note_bv, now));
            Self::deposit_event(Event::RelationProposed(from, to, kind));
            Ok(())
        }

        /// 函数级中文注释：B 方管理员批准关系绑定。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn approve_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            let (kind, created_by, note, _created_at) = PendingRelationRequests::<T>::get(from, to).ok_or(Error::<T>::RelationNotFound)?;
            // 二次防冲突：避免并发与方向不一致
            if Relations::<T>::contains_key(from, to) { return Err(Error::<T>::RelationExists.into()); }
            if is_undirected_kind(kind) && Relations::<T>::contains_key(to, from) { return Err(Error::<T>::RelationExists.into()); }
            if let Some(r) = Relations::<T>::get(to, from) { if is_conflicting_kind(r.kind, kind) { return Err(Error::<T>::BadRelationKind.into()); } }
            let now = <frame_system::Pallet<T>>::block_number();
            let rec = Relation::<T> { kind, note: note.clone(), created_by, since: now };
            let (ff, tt) = canonical_ids::<T>(from, to, kind);
            Relations::<T>::insert(ff, tt, &rec);
            RelationsByDeceased::<T>::try_mutate(ff, |list| list.try_push((tt, kind)).map_err(|_| Error::<T>::BadInput))?;
            if is_undirected_kind(kind) && ff != tt {
                RelationsByDeceased::<T>::try_mutate(tt, |list| list.try_push((ff, kind)).map_err(|_| Error::<T>::BadInput))?;
            }
            PendingRelationRequests::<T>::remove(from, to);
            Self::deposit_event(Event::RelationApproved(from, to, kind));
            Ok(())
        }

        /// 函数级中文注释：B 方管理员拒绝关系绑定。
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn reject_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            ensure!(PendingRelationRequests::<T>::contains_key(from, to), Error::<T>::RelationNotFound);
            PendingRelationRequests::<T>::remove(from, to);
            Self::deposit_event(Event::RelationRejected(from, to));
            Ok(())
        }

        /// 函数级中文注释：任一方管理员撤销已建立的关系。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn revoke_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, a.grave_id) || T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            let (ff, tt, kind) = if let Some(r) = Relations::<T>::get(from, to) { (from, to, r.kind) } else if let Some(r) = Relations::<T>::get(to, from) { (to, from, r.kind) } else { return Err(Error::<T>::RelationNotFound.into()) };
            Relations::<T>::remove(ff, tt);
            RelationsByDeceased::<T>::mutate(ff, |list| { if let Some(i) = list.iter().position(|(peer, _)| *peer == tt) { list.swap_remove(i); } });
            if is_undirected_kind(kind) && ff != tt {
                RelationsByDeceased::<T>::mutate(tt, |list| { if let Some(i) = list.iter().position(|(peer, _)| *peer == ff) { list.swap_remove(i); } });
            }
            Self::deposit_event(Event::RelationRevoked(from, to));
            Ok(())
        }

        /// 函数级中文注释：更新关系备注。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn update_relation_note(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId, note: Option<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, a.grave_id) || T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            // 同时尝试两个方向，支持无向 canonical
            if Relations::<T>::try_mutate(from, to, |maybe| -> DispatchResult {
                let r = maybe.as_mut().ok_or(Error::<T>::RelationNotFound)?;
                r.note = match note.as_ref() { Some(v) => BoundedVec::try_from(v.clone()).map_err(|_| Error::<T>::BadInput)?, None => Default::default() };
                Ok(())
            }).is_err() {
                Relations::<T>::try_mutate(to, from, |maybe| -> DispatchResult {
                    let r = maybe.as_mut().ok_or(Error::<T>::RelationNotFound)?;
                    r.note = match note.as_ref() { Some(v) => BoundedVec::try_from(v.clone()).map_err(|_| Error::<T>::BadInput)?, None => Default::default() };
                    Ok(())
                })?;
            }
            Self::deposit_event(Event::RelationUpdated(from, to));
            Ok(())
        }

        // =================== 亲友团：接口（最小实现，无押金） ===================
        /// 函数级中文注释：设置亲友团策略。仅 Admin（含 owner）。
        #[pallet::call_index(32)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn set_friend_policy(origin: OriginFor<T>, deceased_id: T::DeceasedId, require_approval: bool, is_private: bool, max_members: u32) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(DeceasedOf::<T>::contains_key(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(Self::is_admin(deceased_id, &who), Error::<T>::NotAuthorized);
            // 不允许将上限设置为小于现有成员数
            let current = FriendCount::<T>::get(deceased_id);
            ensure!(max_members >= current, Error::<T>::FriendTooMany);
            FriendPolicyOf::<T>::insert(deceased_id, FriendPolicy::<T> { require_approval, is_private, max_members, _phantom: core::marker::PhantomData });
            Ok(())
        }

        /// 函数级中文注释：申请加入亲友团。若 require_approval=false 则直接加入。
        #[pallet::call_index(33)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn request_join(origin: OriginFor<T>, deceased_id: T::DeceasedId, note: Option<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(DeceasedOf::<T>::contains_key(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(!FriendsOf::<T>::contains_key(deceased_id, &who), Error::<T>::FriendAlreadyMember);
            let mut fc = FriendCount::<T>::get(deceased_id);
            let policy = FriendPolicyOf::<T>::get(deceased_id).unwrap_or(FriendPolicy { require_approval: true, is_private: false, max_members: 1024, _phantom: core::marker::PhantomData });
            if !policy.require_approval {
                ensure!(fc < policy.max_members, Error::<T>::FriendTooMany);
                let now = <frame_system::Pallet<T>>::block_number();
                let n: BoundedVec<_, T::StringLimit> = match note { Some(v)=>BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?, None=>Default::default() };
                FriendsOf::<T>::insert(deceased_id, &who, FriendRecord::<T>{ role: FriendRole::Member, since: now, note: n });
                fc = fc.saturating_add(1); FriendCount::<T>::insert(deceased_id, fc);
                return Ok(())
            }
            // 需要审批：写入待审批列表（去重）
            let mut pend: BoundedVec<(T::AccountId, BlockNumberFor<T>), ConstU32<256>> = FriendJoinRequests::<T>::get(deceased_id);
            ensure!(!pend.iter().any(|(a, _)| a == &who), Error::<T>::FriendPendingExists);
            pend.try_push((who.clone(), <frame_system::Pallet<T>>::block_number())).map_err(|_| Error::<T>::BadInput)?;
            FriendJoinRequests::<T>::insert(deceased_id, pend);
            Ok(())
        }

        /// 函数级中文注释：审批通过加入。仅 Admin。
        #[pallet::call_index(34)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn approve_join(origin: OriginFor<T>, deceased_id: T::DeceasedId, who: T::AccountId) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(Self::is_admin(deceased_id, &admin), Error::<T>::NotAuthorized);
            let mut pend = FriendJoinRequests::<T>::get(deceased_id);
            let idx = pend.iter().position(|(a, _)| a == &who).ok_or(Error::<T>::FriendNoPending)?;
            pend.swap_remove(idx); FriendJoinRequests::<T>::insert(deceased_id, pend);
            ensure!(!FriendsOf::<T>::contains_key(deceased_id, &who), Error::<T>::FriendAlreadyMember);
            let policy = FriendPolicyOf::<T>::get(deceased_id).unwrap_or(FriendPolicy { require_approval: true, is_private: false, max_members: 1024, _phantom: core::marker::PhantomData });
            let count = FriendCount::<T>::get(deceased_id);
            ensure!(count < policy.max_members, Error::<T>::FriendTooMany);
            let now = <frame_system::Pallet<T>>::block_number();
            FriendsOf::<T>::insert(deceased_id, &who, FriendRecord::<T>{ role: FriendRole::Member, since: now, note: Default::default() });
            FriendCount::<T>::insert(deceased_id, count.saturating_add(1));
            Ok(())
        }

        /// 函数级中文注释：拒绝加入。仅 Admin。
        #[pallet::call_index(35)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn reject_join(origin: OriginFor<T>, deceased_id: T::DeceasedId, who: T::AccountId) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(Self::is_admin(deceased_id, &admin), Error::<T>::NotAuthorized);
            let mut pend = FriendJoinRequests::<T>::get(deceased_id);
            let idx = pend.iter().position(|(a, _)| a == &who).ok_or(Error::<T>::FriendNoPending)?;
            pend.swap_remove(idx); FriendJoinRequests::<T>::insert(deceased_id, pend);
            Ok(())
        }

        /// 函数级中文注释：退出亲友团（自愿退出）。
        #[pallet::call_index(36)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn leave_friend_group(origin: OriginFor<T>, deceased_id: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(FriendsOf::<T>::contains_key(deceased_id, &who), Error::<T>::FriendNotMember);
            // 保护：owner/Admin 不允许用此接口自降级退出，避免孤儿；需由另一 Admin 处理
            let rec = FriendsOf::<T>::get(deceased_id, &who).unwrap();
            ensure!(!matches!(rec.role, FriendRole::Admin), Error::<T>::NotAuthorized);
            FriendsOf::<T>::remove(deceased_id, &who);
            let cnt = FriendCount::<T>::get(deceased_id).saturating_sub(1);
            FriendCount::<T>::insert(deceased_id, cnt);
            Ok(())
        }

        /// 函数级中文注释：移出成员（仅 Admin）。
        #[pallet::call_index(37)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn kick_friend(origin: OriginFor<T>, deceased_id: T::DeceasedId, who: T::AccountId) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(Self::is_admin(deceased_id, &admin), Error::<T>::NotAuthorized);
            ensure!(FriendsOf::<T>::contains_key(deceased_id, &who), Error::<T>::FriendNotMember);
            let rec = FriendsOf::<T>::get(deceased_id, &who).unwrap();
            // 禁止移除 owner/Admin，自我保护
            ensure!(!matches!(rec.role, FriendRole::Admin), Error::<T>::NotAuthorized);
            FriendsOf::<T>::remove(deceased_id, &who);
            let cnt = FriendCount::<T>::get(deceased_id).saturating_sub(1);
            FriendCount::<T>::insert(deceased_id, cnt);
            Ok(())
        }

        /// 函数级中文注释：设置成员角色（仅 Admin）。不可移除所有 Admin，owner 始终视为 Admin。
        #[pallet::call_index(38)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn set_friend_role(origin: OriginFor<T>, deceased_id: T::DeceasedId, who: T::AccountId, role: u8) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(Self::is_admin(deceased_id, &admin), Error::<T>::NotAuthorized);
            FriendsOf::<T>::try_mutate(deceased_id, &who, |maybe| -> DispatchResult {
                let r = maybe.as_mut().ok_or(Error::<T>::FriendNotMember)?;
                r.role = match role { 2 => FriendRole::Admin, 1 => FriendRole::Core, _ => FriendRole::Member };
                Ok(())
            })?;
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：运行时升级钩子（迁移到 StorageVersion=1）。
        /// - 当前仅写入版本号；为后续关系矩阵与状态机升级做准备。
        fn on_runtime_upgrade() -> Weight {
            let mut weight = Weight::zero();
            let current = <Pallet<T>>::on_chain_storage_version();
            if current < 1 {
                StorageVersion::new(1).put::<Pallet<T>>();
            }
            if current < 2 {
                // 旧结构：与 v1 定义保持一致
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldDeceased<TC: Config> {
                    grave_id: TC::GraveId,
                    owner: TC::AccountId,
                    name: BoundedVec<u8, TC::StringLimit>,
                    // bio 已移除
                    birth_ts: Option<u64>,
                    death_ts: Option<u64>,
                    links: BoundedVec<BoundedVec<u8, TC::StringLimit>, TC::MaxLinks>,
                    created: BlockNumberFor<TC>,
                    updated: BlockNumberFor<TC>,
                }

                let mut migrated: u64 = 0;
                DeceasedOf::<T>::translate(|_key, old: OldDeceased<T>| {
                    migrated = migrated.saturating_add(1);
                    // 迁移：
                    let name_badge: BoundedVec<u8, T::StringLimit> = {
                        let vec = old.name.clone().into_inner().into_iter().filter_map(|b| { let up = if (b'a'..=b'z').contains(&b) { b-32 } else { b }; if (b'A'..=b'Z').contains(&up) { Some(up) } else { None } }).collect::<Vec<u8>>();
                        BoundedVec::try_from(vec).unwrap_or_default()
                    };
                    let birth_str: Option<BoundedVec<u8, T::StringLimit>> = None;
                    let death_str: Option<BoundedVec<u8, T::StringLimit>> = None;
                    let gender = Gender::B;
                    let mut token: Vec<u8> = Vec::new();
                    token.push(b'B');
                    token.extend_from_slice(name_badge.as_slice());
                    let max = <T as Config>::TokenLimit::get() as usize;
                    if token.len() > max { let _ = token.split_off(max); }
                    let deceased_token = BoundedVec::<u8, T::TokenLimit>::try_from(token).unwrap_or_default();
                    Some(Deceased::<T> {
                        grave_id: old.grave_id,
                        owner: old.owner,
                        name: old.name,
                        name_badge,
                        gender,
                        // bio 已移除
                        name_full_cid: None,
                        birth_ts: birth_str,
                        death_ts: death_str,
                        main_image_cid: None,
                        deceased_token,
                        links: old.links,
                        created: old.created,
                        updated: old.updated,
                    })
                });
                StorageVersion::new(2).put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(10_000, 0));
                weight = weight.saturating_add(Weight::from_parts(migrated.saturating_mul(50_000) as u64, 0));
            }
            if current < 3 {
                // v2 -> v3：新增字段 name_full_cid: Option<BoundedVec<u8, TokenLimit>>
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldV2<TC: Config> {
                    grave_id: TC::GraveId,
                    owner: TC::AccountId,
                    name: BoundedVec<u8, TC::StringLimit>,
                    name_badge: BoundedVec<u8, TC::StringLimit>,
                    gender: super::Gender,
                    // bio 已移除
                    birth_ts: Option<BoundedVec<u8, TC::StringLimit>>,
                    death_ts: Option<BoundedVec<u8, TC::StringLimit>>,
                    deceased_token: BoundedVec<u8, TC::TokenLimit>,
                    links: BoundedVec<BoundedVec<u8, TC::StringLimit>, TC::MaxLinks>,
                    created: BlockNumberFor<TC>,
                    updated: BlockNumberFor<TC>,
                }
                let mut migrated: u64 = 0;
                DeceasedOf::<T>::translate(|_key, old: OldV2<T>| {
                    migrated = migrated.saturating_add(1);
                    Some(Deceased::<T> {
                        grave_id: old.grave_id,
                        owner: old.owner,
                        name: old.name,
                        name_badge: old.name_badge,
                        gender: old.gender,
                        // bio 已移除
                        name_full_cid: None,
                        birth_ts: old.birth_ts,
                        death_ts: old.death_ts,
                        main_image_cid: None,
                        deceased_token: old.deceased_token,
                        links: old.links,
                        created: old.created,
                        updated: old.updated,
                    })
                });
                StorageVersion::new(3).put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(10_000, 0));
                weight = weight.saturating_add(Weight::from_parts(migrated.saturating_mul(30_000) as u64, 0));
            }
            if current < 4 {
                // v3 -> v4：引入亲友团存储（默认空），仅写入版本号。
                StorageVersion::new(4).put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(10_000, 0));
            }
            if current < 5 {
                // v4 -> v5：新增 Deceased.main_image_cid=None
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldV4<TC: Config> {
                    grave_id: TC::GraveId,
                    owner: TC::AccountId,
                    name: BoundedVec<u8, TC::StringLimit>,
                    name_badge: BoundedVec<u8, TC::StringLimit>,
                    gender: super::Gender,
                    name_full_cid: Option<BoundedVec<u8, TC::TokenLimit>>,
                    birth_ts: Option<BoundedVec<u8, TC::StringLimit>>,
                    death_ts: Option<BoundedVec<u8, TC::StringLimit>>,
                    deceased_token: BoundedVec<u8, TC::TokenLimit>,
                    links: BoundedVec<BoundedVec<u8, TC::StringLimit>, TC::MaxLinks>,
                    created: BlockNumberFor<TC>,
                    updated: BlockNumberFor<TC>,
                }
                let mut migrated: u64 = 0;
                DeceasedOf::<T>::translate(|_key, old: OldV4<T>| {
                    migrated = migrated.saturating_add(1);
                    Some(Deceased::<T> {
                        grave_id: old.grave_id,
                        owner: old.owner,
                        name: old.name,
                        name_badge: old.name_badge,
                        gender: old.gender,
                        name_full_cid: old.name_full_cid,
                        birth_ts: old.birth_ts,
                        death_ts: old.death_ts,
                        main_image_cid: None,
                        deceased_token: old.deceased_token,
                        links: old.links,
                        created: old.created,
                        updated: old.updated,
                    })
                });
                StorageVersion::new(5).put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(10_000, 0));
                weight = weight.saturating_add(Weight::from_parts(migrated.saturating_mul(30_000) as u64, 0));
            }
            weight
        }
    }
}


