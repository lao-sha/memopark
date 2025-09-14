#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_support::traits::StorageVersion;
use frame_system::pallet_prelude::*;
use sp_runtime::traits::UniqueSaturatedInto;

/// 函数级中文注释：访问 `pallet-deceased` 的抽象接口，保持低耦合。
/// - `deceased_exists`：校验逝者存在。
/// - `can_manage`：校验操作者是否被允许管理该逝者的相册与媒体（一般为 owner/授权者）。
pub trait DeceasedAccess<AccountId, DeceasedId> {
    fn deceased_exists(id: DeceasedId) -> bool;
    fn can_manage(who: &AccountId, deceased_id: DeceasedId) -> bool;
}

/// 函数级中文注释：逝者令牌访问接口（低耦合）。
/// - 由 runtime 适配器从 `pallet-deceased::DeceasedOf` 读取 `deceased_token` 并按本 Pallet 的 `MaxTokenLen` 截断。
pub trait DeceasedTokenAccess<MaxTokenLen: Get<u32>, DeceasedId> {
    fn token_of(id: DeceasedId) -> Option<BoundedVec<u8, MaxTokenLen>>;
}

/// 函数级中文注释：媒体类型与可见性定义。
/// - Photo：图片；Video：视频；Audio：音频；Article：追忆文章（正文 JSON 以 IPFS CID 表示）；Message：未分类留言。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum DataKind { Photo, Video, Audio, Article, Message }

#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Visibility { Public, Unlisted, Private }

/// 函数级中文注释：相册结构体，记录逝者、拥有者与元数据（限长）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Album<T: Config> {
    pub deceased_id: T::DeceasedId,
    /// 函数级中文注释：逝者令牌（来自 `pallet-deceased`），用于弱关联展示与联动；避免跨 pallet 读写耦合。
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub title: BoundedVec<u8, T::StringLimit>,
    pub desc: BoundedVec<u8, T::StringLimit>,
    pub visibility: Visibility,
    pub tags: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags>,
    pub primary_photo_id: Option<T::DataId>,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：视频集结构体，承载视频/音频的聚合容器，并支持设置"主视频"。
/// - 仅视频/音频可加入视频集；文章与图片不加入视频集。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct VideoCollection<T: Config> {
    pub deceased_id: T::DeceasedId,
    /// 函数级中文注释：逝者令牌缓存，便于前端联动展示。
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub title: BoundedVec<u8, T::StringLimit>,
    pub desc: BoundedVec<u8, T::StringLimit>,
    pub tags: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags>,
    /// 函数级中文注释：主视频（可选），需指向本视频集内且为 Video/Audio 的媒体。
    pub primary_video_id: Option<T::DataId>,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：数据项结构体（原 Media），仅保存外链/哈希等最小信息。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Data<T: Config> {
    /// 函数级中文注释：数据自身的唯一标识，冗余存储，便于跨容器移动与事件溯源。
    pub data_id: T::DataId,
    /// 函数级中文注释：相册归属（仅图片必须），视频/音频为 None。
    pub album_id: Option<T::AlbumId>,
    /// 函数级中文注释：视频集归属（仅视频/音频必须），图片为 None。
    pub video_collection_id: Option<T::VideoCollectionId>,
    pub deceased_id: T::DeceasedId,
    /// 函数级中文注释：逝者令牌（来自 `pallet-deceased`），用于前端快速渲染与联动。
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub kind: DataKind,
    pub uri: BoundedVec<u8, T::StringLimit>,
    pub thumbnail_uri: Option<BoundedVec<u8, T::StringLimit>>,
    pub content_hash: Option<[u8; 32]>,
    /// 函数级中文注释：文章标题（仅当 kind=Article 时使用）。
    pub title: Option<BoundedVec<u8, T::StringLimit>>,
    /// 函数级中文注释：文章摘要（仅当 kind=Article 时使用）。
    pub summary: Option<BoundedVec<u8, T::StringLimit>>,
    pub duration_secs: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub order_index: u32,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：逝者“生平”结构体（明文存储，不可删除）。
/// - 仅创建者可免押金修改；非创建者修改需押金与成熟期并允许投诉/治理回滚。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Life<T: Config> {
    /// 函数级中文注释：所有者（首个写入者），用于免押金修改判定与收益归属。
    pub owner: T::AccountId,
    /// 函数级中文注释：所属逝者 ID（与 `pallet-deceased` 对齐）。
    pub deceased_id: T::DeceasedId,
    /// 函数级中文注释：逝者令牌快照（受 `MaxTokenLen` 限制），便于前端渲染与检索。
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    /// 函数级中文注释：生平正文 IPFS CID（受 StringLimit 限制）。
    pub cid: BoundedVec<u8, T::StringLimit>,
    /// 函数级中文注释：最后更新时间区块号。
    pub updated: BlockNumberFor<T>,
    /// 函数级中文注释：版本号（每次成功更新递增）。
    pub version: u32,
    /// 函数级中文注释：最近一次非创建者修改者（创建者修改为 None）。
    pub last_editor: Option<T::AccountId>,
}

/// 函数级中文注释：悼词结构体（明文 IPFS CID，不可批量化复杂字段）。
/// - 任何账户均可为某逝者提交悼词（可配置：若需收紧可接入成员/亲友校验）；
/// - 创建时保留押金，成熟期后可退；支持投诉/治理删除。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Eulogy<T: Config> {
    /// 悼词 ID（与 DataId 共用类型空间）。
    pub id: T::DataId,
    /// 目标逝者。
    pub deceased_id: T::DeceasedId,
    /// 逝者令牌快照（前端渲染）。
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    /// 提交者（押金所有者）。
    pub author: T::AccountId,
    /// 内容 IPFS CID（受 StringLimit 限制）。
    pub cid: BoundedVec<u8, T::StringLimit>,
    /// 创建/更新区块号。
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::weights::Weight;
    use codec::{Decode, Encode};
    use alloc::vec::Vec;
    use sp_runtime::traits::{AtLeast32BitUnsigned, Zero, SaturatedConversion};
    use frame_support::traits::{ReservableCurrency, ExistenceRequirement, Currency as CurrencyTrait};
    /// 函数级中文注释：余额与押金类型别名，统一本 pallet 内 Balance 表达。
    pub type BalanceOf<T> = <<T as Config>::Currency as CurrencyTrait<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen + UniqueSaturatedInto<u64> + From<u64>;
        type AlbumId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        /// 函数级中文注释：视频集 ID 类型（推荐与 AlbumId/DataId 一致的 u64）。
        type VideoCollectionId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        /// 函数级中文注释：数据项 ID 类型（原名 DataId），用于标识 Data 记录。
        type DataId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        #[pallet::constant] type MaxAlbumsPerDeceased: Get<u32>;
        /// 函数级中文注释：每个相册允许的最大图片数上限。
        #[pallet::constant] type MaxPhotoPerAlbum: Get<u32>;
        /// 函数级中文注释：每位逝者最多视频集数量。
        #[pallet::constant] type MaxVideoCollectionsPerDeceased: Get<u32>;
        #[pallet::constant] type StringLimit: Get<u32>;
        #[pallet::constant] type MaxTags: Get<u32>;
        #[pallet::constant] type MaxReorderBatch: Get<u32>;
        /// 函数级中文注释：本模块内部缓存的 `deceased_token` 最大长度；建议与 `pallet-deceased::TokenLimit`/`GraveMaxCidLen` 对齐。
        #[pallet::constant] type MaxTokenLen: Get<u32>;
        /// 函数级中文注释：每位逝者最多留言条数（Message 未分类，按逝者维度索引）。
        #[pallet::constant] type MaxMessagesPerDeceased: Get<u32>;
        /// 函数级中文注释：每位逝者最多悼词条数（Eulogy 未分类，按逝者维度索引）。
        #[pallet::constant] type MaxEulogiesPerDeceased: Get<u32>;

        type DeceasedProvider: DeceasedAccess<Self::AccountId, Self::DeceasedId>;
        /// 函数级中文注释：逝者令牌提供者（低耦合读取 `deceased_token`）。
        type DeceasedTokenProvider: DeceasedTokenAccess<Self::MaxTokenLen, Self::DeceasedId>;

        /// 函数级中文注释：治理起源（Root/议会等），用于冻结/隐藏/替换等治理动作。
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：货币接口，支持 reserve/unreserve 与转账。
        type Currency: ReservableCurrency<Self::AccountId>;
        /// 函数级中文注释：创建相册需保留的押金金额。
        #[pallet::constant]
        type AlbumDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：创建视频集需保留的押金金额。
        #[pallet::constant]
        type VideoCollectionDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：添加媒体需保留的押金金额。
        #[pallet::constant]
        type DataDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：申诉押金金额（由申诉方在 complain_* 时保留）。
        #[pallet::constant]
        type ComplaintDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：小额手续费（优先用于相册创建），转入费用账户。
        #[pallet::constant]
        type CreateFee: Get<BalanceOf<Self>>;
        /// 函数级中文注释：费用接收账户（建议指向国库 PalletId 派生地址）。
        type FeeCollector: Get<Self::AccountId>;
        /// 函数级中文注释：仲裁费用接收账户（败诉押金的 5%）。
        type ArbitrationAccount: Get<Self::AccountId>;
        /// 函数级中文注释：投诉观察/成熟期（区块数）。到期且无投诉时可退款；删除后同等待期再退。
        #[pallet::constant]
        type ComplaintPeriod: Get<BlockNumberFor<Self>>;
    }

    #[pallet::storage] pub type NextAlbumId<T: Config> = StorageValue<_, T::AlbumId, ValueQuery>;
    #[pallet::storage] pub type NextVideoCollectionId<T: Config> = StorageValue<_, T::VideoCollectionId, ValueQuery>;
    #[pallet::storage] pub type NextDataId<T: Config> = StorageValue<_, T::DataId, ValueQuery>;
    #[pallet::storage] pub type AlbumOf<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, Album<T>, OptionQuery>;
    #[pallet::storage] pub type VideoCollectionOf<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, VideoCollection<T>, OptionQuery>;
    #[pallet::storage] pub type DataOf<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, Data<T>, OptionQuery>;
    #[pallet::storage] pub type AlbumsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::AlbumId, T::MaxAlbumsPerDeceased>, ValueQuery>;
    #[pallet::storage] pub type VideoCollectionsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::VideoCollectionId, T::MaxVideoCollectionsPerDeceased>, ValueQuery>;
    #[pallet::storage] pub type DataByAlbum<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, BoundedVec<T::DataId, T::MaxPhotoPerAlbum>, ValueQuery>;
    #[pallet::storage] pub type DataByVideoCollection<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, BoundedVec<T::DataId, T::MaxPhotoPerAlbum>, ValueQuery>;
    /// 函数级中文注释：按逝者维度的留言索引（Message 未归类，按 deceased_id 分组）。
    #[pallet::storage] pub type MessagesByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::DataId, T::MaxMessagesPerDeceased>, ValueQuery>;
    /// 函数级中文注释：悼词列表（按逝者维度聚合）。
    #[pallet::storage] pub type EulogiesByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::DataId, T::MaxEulogiesPerDeceased>, ValueQuery>;
    /// 函数级中文注释：下一个悼词 ID（使用 DataId 类型）。
    #[pallet::storage] pub type NextEulogyId<T: Config> = StorageValue<_, T::DataId, ValueQuery>;
    /// 函数级中文注释：悼词详情。
    #[pallet::storage] pub type EulogyOf<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, Eulogy<T>, OptionQuery>;
    /// 函数级中文注释：悼词先前版本（回滚预留；当前仅治理删除使用，不自动回滚）。
    #[pallet::storage] pub type EulogyPrev<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, BoundedVec<u8, T::StringLimit>, OptionQuery>;
    /// 函数级中文注释：悼词押金与成熟期（创建时保留押金，成熟到期可退；被投诉维持时按 20/5/75 分账）。
    #[pallet::storage] pub type EulogyDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage] pub type EulogyMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, BlockNumberFor<T>, OptionQuery>;
    /// 函数级中文注释：悼词投诉计数。
    #[pallet::storage] pub type EulogyComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, u32, ValueQuery>;
    /// 函数级中文注释：相册押金记录（who, amount）。
    #[pallet::storage] pub type AlbumDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    /// 函数级中文注释：视频集押金记录（who, amount）。
    #[pallet::storage] pub type VideoCollectionDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    /// 函数级中文注释：媒体押金记录（who, amount）。
    #[pallet::storage] pub type DataDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    /// 函数级中文注释：申诉存证（域+目标ID → 案件）。域：1=Album, 2=Media。
    #[pallet::storage] pub type ComplaintOf<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), ComplaintCase<T>, OptionQuery>;
    /// 函数级中文注释：相册冻结标志（治理设定）。
    #[pallet::storage] pub type AlbumFrozen<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, bool, ValueQuery>;
    /// 函数级中文注释：视频集冻结标志（治理设定）。
    #[pallet::storage] pub type VideoCollectionFrozen<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, bool, ValueQuery>;
    /// 函数级中文注释：媒体隐藏标志（治理设定）。
    #[pallet::storage] pub type DataHidden<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, bool, ValueQuery>;
    /// 函数级中文注释：相册投诉计数。
    #[pallet::storage] pub type AlbumComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, u32, ValueQuery>;
    /// 函数级中文注释：视频集投诉计数（预留，当前未使用）。
    #[pallet::storage] pub type VideoCollectionComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, u32, ValueQuery>;
    /// 函数级中文注释：媒体投诉计数。
    #[pallet::storage] pub type DataComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, u32, ValueQuery>;
    /// 函数级中文注释：逝者生平（明文，不可删除）。
    #[pallet::storage] pub type LifeOf<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, Life<T>, OptionQuery>;
    /// 函数级中文注释：修改前的旧文本（仅非创建者修改时保存，用于治理回滚）。
    #[pallet::storage] pub type LifePrev<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<u8, T::StringLimit>, OptionQuery>;
    /// 函数级中文注释：非创建者修改押金与所有者。
    #[pallet::storage] pub type LifeDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    /// 函数级中文注释：非创建者修改成熟区块。
    #[pallet::storage] pub type LifeMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BlockNumberFor<T>, OptionQuery>;
    /// 函数级中文注释：生平投诉计数（>0 阻止押金领取）。
    #[pallet::storage] pub type LifeComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, u32, ValueQuery>;
    /// 函数级中文注释：相册押金成熟区块（创建或删除时设置为 now + ComplaintPeriod）。
    #[pallet::storage] pub type AlbumMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, BlockNumberFor<T>, OptionQuery>;
    /// 函数级中文注释：视频集押金成熟区块。
    #[pallet::storage] pub type VideoCollectionMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, BlockNumberFor<T>, OptionQuery>;
    /// 函数级中文注释：媒体押金成熟区块（创建或删除时设置为 now + ComplaintPeriod）。
    #[pallet::storage] pub type DataMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::DataId, BlockNumberFor<T>, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        AlbumCreated(T::AlbumId, T::DeceasedId, T::AccountId),
        AlbumUpdated(T::AlbumId),
        AlbumDeleted(T::AlbumId),
        /// 函数级中文注释：视频集创建/更新/删除与主视频更新事件。
        VideoCollectionCreated(T::VideoCollectionId, T::DeceasedId, T::AccountId),
        VideoCollectionUpdated(T::VideoCollectionId),
        VideoCollectionDeleted(T::VideoCollectionId),
        VideoCollectionPrimaryChanged(T::VideoCollectionId, Option<T::DataId>),
        DataAdded(T::DataId, T::AlbumId),
        /// 函数级中文注释：媒体添加至视频集事件（与相册并行）。
        DataAddedToVideoCollection(T::DataId, T::VideoCollectionId),
        DataUpdated(T::DataId),
        DataRemoved(T::DataId),
        DataMoved(T::DataId, T::AlbumId, T::AlbumId),
        AlbumReordered(T::AlbumId),
        VideoCollectionReordered(T::VideoCollectionId),
        /// 函数级中文注释：留言创建事件（Message 未分类，按逝者索引）。
        DataMessageAdded(T::DataId, T::DeceasedId),
        /// 函数级中文注释：治理事件：相册冻结/解冻。
        GovAlbumFrozen(T::AlbumId, bool),
        /// 函数级中文注释：治理事件：媒体隐藏/取消隐藏。
        GovDataHidden(T::DataId, bool),
        /// 函数级中文注释：治理事件：替换数据项 URI。
        GovDataReplaced(T::DataId),
        /// 函数级中文注释：投诉事件（相册/媒体）。
        AlbumComplained(T::AlbumId, u32),
        DataComplained(T::DataId, u32),
        /// 函数级中文注释：治理裁决完成（Upheld=维持投诉/隐藏，Dismiss=驳回），并包含胜诉方与金额明细。
        ComplaintResolved(u8, u64, bool),
        /// 函数级中文注释：申诉押金分账：胜诉方收到奖励。
        ComplaintPayoutWinner(T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：申诉押金分账：仲裁账户收到费用。
        ComplaintPayoutArbitration(T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：申诉押金分账：败诉方退回剩余押金。
        ComplaintPayoutLoserRefund(T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：相册押金退款成功。
        AlbumDepositRefunded(T::AlbumId, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：媒体押金退款成功。
        DataDepositRefunded(T::DataId, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：悼词创建/更新/删除/投诉/退款事件。
        EulogyCreated(T::DataId, T::DeceasedId, T::AccountId),
        EulogyUpdated(T::DataId),
        EulogyRemoved(T::DataId),
        EulogyComplained(T::DataId, u32),
        EulogyDepositRefunded(T::DataId, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：生平创建/更新/投诉/退款事件。
        LifeCreated(T::DeceasedId, T::AccountId),
        LifeUpdated(T::DeceasedId),
        LifeUpdatedByOthers(T::DeceasedId, T::AccountId),
        LifeComplained(T::DeceasedId, u32),
        LifeDepositRefunded(T::DeceasedId, T::AccountId, BalanceOf<T>),
    }

    #[pallet::error]
    pub enum Error<T> {
        DeceasedNotFound,
        NotAuthorized,
        AlbumNotFound,
        DataNotFound,
        TooMany,
        BadInput,
        MismatchDeceased,
        Overflow,
        /// 函数级中文注释：押金/费用失败（余额不足或保留失败）。
        DepositFailed,
        /// 函数级中文注释：相册已冻结。
        Frozen,
        /// 函数级中文注释：媒体被隐藏（只读提示，不阻止写）。
        Hidden,
        /// 函数级中文注释：押金未成熟或存在投诉。
        NotMatured,
        /// 函数级中文注释：无可退款押金。
        NoDepositToClaim,
        /// 函数级中文注释：当前无进行中的申诉。
        NoActiveComplaint,
    }

    /// 函数级中文注释：存储版本管理，用于新增字段（如 Article 标题/摘要）时的安全迁移。
    /// - v1：初始版本（无 Article 与标题/摘要字段）。
    /// - v2：新增 `DataKind::Article`，并在 `Media` 结构中追加 `title`/`summary` 字段。
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(2);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 函数级中文注释：申诉状态。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub enum ComplaintStatus { Pending, Resolved }

    /// 函数级中文注释：申诉案件。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    #[scale_info(skip_type_params(T))]
    pub struct ComplaintCase<T: Config> {
        pub complainant: T::AccountId,
        pub deposit: BalanceOf<T>,
        pub created: BlockNumberFor<T>,
        pub status: ComplaintStatus,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建相册；校验逝者存在与权限；限制标题/描述/标签长度数量。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_album(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            title: Vec<u8>,
            desc: Vec<u8>,
            visibility: u8,
            tags: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);

            let title_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(title).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(desc).map_err(|_| Error::<T>::BadInput)?;
            let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
            for t in tags.into_iter() {
                let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
            }

            // 小额手续费：转入费用账户
            let fee = T::CreateFee::get();
            if !fee.is_zero() {
                T::Currency::transfer(&who, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive)
                    .map_err(|_| Error::<T>::DepositFailed)?;
            }

            let id = NextAlbumId::<T>::get();
            let next = id.checked_add(&T::AlbumId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextAlbumId::<T>::put(next);

            let vis = match visibility { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) };
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let album = Album::<T> { deceased_id, deceased_token: token, owner: who.clone(), title: title_bv, desc: desc_bv, visibility: vis, tags: tags_bv, primary_photo_id: None, created: now, updated: now };

            AlbumOf::<T>::insert(id, album);
            AlbumsByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;
            // 押金 reserve 并设置成熟时间
            let dep = T::AlbumDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                AlbumDeposits::<T>::insert(id, (who.clone(), dep));
                let mature_at = now + T::ComplaintPeriod::get();
                AlbumMaturity::<T>::insert(id, mature_at);
            }
            Self::deposit_event(Event::AlbumCreated(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：创建视频集；校验逝者存在与权限；限制标题/描述/标签长度数量。
        /// - 收取小额创建费（CreateFee）与可退押金（VideoCollectionDeposit）。
        #[pallet::call_index(19)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_video_collection(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            title: Vec<u8>,
            desc: Vec<u8>,
            tags: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);

            let title_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(title).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(desc).map_err(|_| Error::<T>::BadInput)?;
            let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
            for t in tags.into_iter() {
                let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
            }

            // 创建费
            let fee = T::CreateFee::get();
            if !fee.is_zero() {
                T::Currency::transfer(&who, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive)
                    .map_err(|_| Error::<T>::DepositFailed)?;
            }

            let id = NextVideoCollectionId::<T>::get();
            let next = id.checked_add(&T::VideoCollectionId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextVideoCollectionId::<T>::put(next);

            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let vs = VideoCollection::<T> {
                deceased_id,
                deceased_token: token,
                owner: who.clone(),
                title: title_bv,
                desc: desc_bv,
                tags: tags_bv,
                primary_video_id: None,
                created: now,
                updated: now,
            };
            VideoCollectionOf::<T>::insert(id, vs);
            VideoCollectionsByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;

            let dep = T::VideoCollectionDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                VideoCollectionDeposits::<T>::insert(id, (who.clone(), dep));
                VideoCollectionMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::VideoCollectionCreated(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新视频集；仅 owner；可更新标题/描述/标签。
        #[pallet::call_index(20)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_video_collection(
            origin: OriginFor<T>,
            video_collection_id: T::VideoCollectionId,
            title: Option<Vec<u8>>,
            desc: Option<Vec<u8>>,
            tags: Option<Vec<Vec<u8>>>,
        ) -> DispatchResult {
            // 函数级中文注释：更新视频集元数据（标题/描述/标签）。
            // - 仅视频集拥有者可调用；
            // - 当视频集被冻结（治理）时拒绝更新；
            // - 字段为可选，未提供的字段保持不变；
            // - 成功后更新 `updated` 区块号并发出 `VideoCollectionUpdated` 事件。
            let who = ensure_signed(origin)?;
            VideoCollectionOf::<T>::try_mutate(video_collection_id, |maybe_v| -> DispatchResult {
                let v = maybe_v.as_mut().ok_or(Error::<T>::BadInput)?;
                ensure!(v.owner == who, Error::<T>::NotAuthorized);
                ensure!(!VideoCollectionFrozen::<T>::get(video_collection_id), Error::<T>::Frozen);
                if let Some(t) = title { v.title = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(d) = desc { v.desc = BoundedVec::try_from(d).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(ts) = tags {
                    let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
                    for t in ts.into_iter() {
                        let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                        tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    v.tags = tags_bv;
                }
                v.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::VideoCollectionUpdated(video_collection_id));
            Ok(())
        }

        /// 函数级中文注释：删除视频集；仅 owner；需为空。
        #[pallet::call_index(21)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn delete_video_collection(origin: OriginFor<T>, video_collection_id: T::VideoCollectionId) -> DispatchResult {
            // 函数级中文注释：删除视频集；
            // - 仅视频集拥有者可删除；
            // - 视频集需为空（无关联媒体）；
            // - 若存在押金，删除后设置成熟等待期，期满可退款。
            let who = ensure_signed(origin)?;
            let vs = VideoCollectionOf::<T>::get(video_collection_id).ok_or(Error::<T>::BadInput)?;
            ensure!(vs.owner == who, Error::<T>::NotAuthorized);
            ensure!(!VideoCollectionFrozen::<T>::get(video_collection_id), Error::<T>::Frozen);
            let medias = DataByVideoCollection::<T>::get(video_collection_id);
            ensure!(medias.is_empty(), Error::<T>::BadInput);
            VideoCollectionOf::<T>::remove(video_collection_id);
            VideoCollectionsByDeceased::<T>::mutate(vs.deceased_id, |list| { if let Some(pos) = list.iter().position(|x| x == &video_collection_id) { list.swap_remove(pos); } });
            if VideoCollectionDeposits::<T>::contains_key(video_collection_id) {
                let now = <frame_system::Pallet<T>>::block_number();
                VideoCollectionMaturity::<T>::insert(video_collection_id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::VideoCollectionDeleted(video_collection_id));
            Ok(())
        }

        /// 函数级中文注释：设置视频集主视频；需为该视频集内且类型为 Video/Audio。
        #[pallet::call_index(22)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_video_collection_primary(origin: OriginFor<T>, video_collection_id: T::VideoCollectionId, primary_data_id: Option<T::DataId>) -> DispatchResult {
            // 函数级中文注释：设置/取消视频集主视频；
            // - 主视频必须属于该视频集且类型为 Video/Audio；
            // - 仅拥有者可设置；冻结状态下不可设置。
            let who = ensure_signed(origin)?;
            VideoCollectionOf::<T>::try_mutate(video_collection_id, |maybe_v| -> DispatchResult {
                let v = maybe_v.as_mut().ok_or(Error::<T>::BadInput)?;
                ensure!(v.owner == who, Error::<T>::NotAuthorized);
                ensure!(!VideoCollectionFrozen::<T>::get(video_collection_id), Error::<T>::Frozen);
                if let Some(mid) = primary_data_id {
                    let m = DataOf::<T>::get(mid).ok_or(Error::<T>::DataNotFound)?;
                    ensure!(m.video_collection_id == Some(video_collection_id), Error::<T>::BadInput);
                    ensure!(matches!(m.kind, DataKind::Video | DataKind::Audio), Error::<T>::BadInput);
                    v.primary_video_id = Some(mid);
                } else {
                    v.primary_video_id = None;
                }
                v.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::VideoCollectionPrimaryChanged(video_collection_id, primary_data_id));
            Ok(())
        }

        /// 函数级中文注释：重排视频集内媒体顺序；仅 owner；限制批量大小。
        #[pallet::call_index(23)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn reorder_video_collection(origin: OriginFor<T>, video_collection_id: T::VideoCollectionId, ordered_media: Vec<T::DataId>) -> DispatchResult {
            // 函数级中文注释：批量重排视频集内媒体顺序；
            // - 仅拥有者可操作；冻结状态下拒绝；
            // - 批量大小受 `MaxReorderBatch` 限制；
            // - 对每个媒体校验归属后写入新顺序。
            let who = ensure_signed(origin)?;
            let vs = VideoCollectionOf::<T>::get(video_collection_id).ok_or(Error::<T>::BadInput)?;
            ensure!(vs.owner == who, Error::<T>::NotAuthorized);
            ensure!(!VideoCollectionFrozen::<T>::get(video_collection_id), Error::<T>::Frozen);
            ensure!((ordered_media.len() as u32) <= T::MaxReorderBatch::get(), Error::<T>::BadInput);
            for (idx, mid) in ordered_media.iter().enumerate() {
                DataOf::<T>::try_mutate(*mid, |maybe_m| -> DispatchResult {
                    let m = maybe_m.as_mut().ok_or(Error::<T>::DataNotFound)?;
                    ensure!(m.video_collection_id == Some(video_collection_id), Error::<T>::BadInput);
                    m.order_index = idx as u32;
                    m.updated = <frame_system::Pallet<T>>::block_number();
                    Ok(())
                })?;
            }
            DataByVideoCollection::<T>::insert(video_collection_id, BoundedVec::try_from(ordered_media).map_err(|_| Error::<T>::BadInput)?);
            Self::deposit_event(Event::VideoCollectionReordered(video_collection_id));
            Ok(())
        }

        /// 函数级中文注释：统一添加数据（原 add_media2 更名为 add_data），强制容器-类型一致：
        /// - Photo→相册(album_id)，Video/Audio→视频集(video_collection_id)，Article→相册（与旧 add_media 行为保持一致）。
        #[pallet::call_index(24)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn add_data(
            origin: OriginFor<T>,
            container_kind: u8, // 0=Album, 1=VideoCollection, 2=Uncategorized
            container_id: Option<u64>,
            kind: u8,
            uri: Vec<u8>,
            thumbnail_uri: Option<Vec<u8>>,
            content_hash: Option<[u8;32]>,
            title: Option<Vec<u8>>,
            summary: Option<Vec<u8>>,
            duration_secs: Option<u32>,
            width: Option<u32>,
            height: Option<u32>,
            order_index: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let kind_enum = match kind { 0 => DataKind::Photo, 1 => DataKind::Video, 2 => DataKind::Audio, 3 => DataKind::Article, 4 => DataKind::Message, _ => return Err(Error::<T>::BadInput.into()) };
            let uri_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(uri).map_err(|_| Error::<T>::BadInput)?;
            let thumb_bv = match thumbnail_uri { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };

            match kind_enum {
                DataKind::Photo => {
                    ensure!(container_kind == 0, Error::<T>::BadInput);
                    let aid_u64 = container_id.ok_or(Error::<T>::BadInput)?;
                    let aid: T::AlbumId = aid_u64.saturated_into::<u64>().saturated_into();
                    let album = AlbumOf::<T>::get(aid).ok_or(Error::<T>::AlbumNotFound)?;
                    ensure!(album.owner == who, Error::<T>::NotAuthorized);
                    ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen);
                    if let (Some(w), Some(h)) = (width, height) { ensure!(w > 0 && h > 0, Error::<T>::BadInput); }
                    let id = NextDataId::<T>::get();
                    let next = id.checked_add(&T::DataId::from(1u32)).ok_or(Error::<T>::Overflow)?;
                    NextDataId::<T>::put(next);
                    let mut list = DataByAlbum::<T>::get(aid);
                    let ord = order_index.unwrap_or(list.len() as u32);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(album.deceased_id).unwrap_or_default();
                    let media = Data::<T> { data_id: id, album_id: Some(aid), video_collection_id: None, deceased_id: album.deceased_id, deceased_token: token, owner: who.clone(), kind: DataKind::Photo, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, title: None, summary: None, duration_secs: None, width, height, order_index: ord, created: now, updated: now };
                    DataOf::<T>::insert(id, media);
                    list.try_push(id).map_err(|_| Error::<T>::TooMany)?;
                    DataByAlbum::<T>::insert(aid, list);
                    let dep = T::DataDeposit::get();
                    if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; DataDeposits::<T>::insert(id, (who.clone(), dep)); DataMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
                    Self::deposit_event(Event::DataAdded(id, aid));
                    return Ok(())
                }
                DataKind::Video | DataKind::Audio => {
                    ensure!(container_kind == 1, Error::<T>::BadInput);
                    let vsid_u64 = container_id.ok_or(Error::<T>::BadInput)?;
                    let vsid: T::VideoCollectionId = vsid_u64.saturated_into::<u64>().saturated_into();
                    let vs = VideoCollectionOf::<T>::get(vsid).ok_or(Error::<T>::BadInput)?;
                    ensure!(vs.owner == who, Error::<T>::NotAuthorized);
                    ensure!(!VideoCollectionFrozen::<T>::get(vsid), Error::<T>::Frozen);
                    if let Some(d) = duration_secs { ensure!(d > 0u32, Error::<T>::BadInput); }
                    let id = NextDataId::<T>::get();
                    let next = id.checked_add(&T::DataId::from(1u32)).ok_or(Error::<T>::Overflow)?;
                    NextDataId::<T>::put(next);
                    let mut list = DataByVideoCollection::<T>::get(vsid);
                    let ord = order_index.unwrap_or(list.len() as u32);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(vs.deceased_id).unwrap_or_default();
                    let media = Data::<T> { data_id: id, album_id: None, video_collection_id: Some(vsid), deceased_id: vs.deceased_id, deceased_token: token, owner: who.clone(), kind: kind_enum, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, title: None, summary: None, duration_secs, width: None, height: None, order_index: ord, created: now, updated: now };
                    DataOf::<T>::insert(id, media);
                    list.try_push(id).map_err(|_| Error::<T>::TooMany)?;
                    DataByVideoCollection::<T>::insert(vsid, list);
                    let dep = T::DataDeposit::get();
                    if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; DataDeposits::<T>::insert(id, (who.clone(), dep)); DataMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
                    Self::deposit_event(Event::DataAddedToVideoCollection(id, vsid));
                    return Ok(())
                }
                DataKind::Article => {
                    // 与旧 add_media 行为保持一致：文章归入相册，支持 title/summary/content_hash
                    ensure!(container_kind == 0, Error::<T>::BadInput);
                    ensure!(content_hash.is_some(), Error::<T>::BadInput);
                    let aid_u64 = container_id.ok_or(Error::<T>::BadInput)?;
                    let aid: T::AlbumId = aid_u64.saturated_into::<u64>().saturated_into();
                    let album = AlbumOf::<T>::get(aid).ok_or(Error::<T>::AlbumNotFound)?;
                    ensure!(album.owner == who, Error::<T>::NotAuthorized);
                    ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen);

                    let id = NextDataId::<T>::get();
                    let next = id.checked_add(&T::DataId::from(1u32)).ok_or(Error::<T>::Overflow)?;
                    NextDataId::<T>::put(next);

                    let mut list = DataByAlbum::<T>::get(aid);
                    let ord = order_index.unwrap_or(list.len() as u32);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(album.deceased_id).unwrap_or_default();
                    let title_bv: Option<BoundedVec<_, T::StringLimit>> = match title { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                    let summary_bv: Option<BoundedVec<_, T::StringLimit>> = match summary { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };

                    let media = Data::<T> {
                        data_id: id,
                        album_id: Some(aid),
                        video_collection_id: None,
                        deceased_id: album.deceased_id,
                        deceased_token: token,
                        owner: who.clone(),
                        kind: DataKind::Article,
                        uri: uri_bv,
                        thumbnail_uri: thumb_bv,
                        content_hash,
                        title: title_bv,
                        summary: summary_bv,
                        duration_secs: None,
                        width: None,
                        height: None,
                        order_index: ord,
                        created: now,
                        updated: now,
                    };
                    DataOf::<T>::insert(id, media);
                    list.try_push(id).map_err(|_| Error::<T>::TooMany)?;
                    DataByAlbum::<T>::insert(aid, list);
                    let dep = T::DataDeposit::get();
                    if !dep.is_zero() {
                        T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                        DataDeposits::<T>::insert(id, (who.clone(), dep));
                        DataMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
                    }
                    Self::deposit_event(Event::DataAdded(id, aid));
                    return Ok(())
                }
                DataKind::Message => {
                    // Message 未分类：按逝者维度索引；要求 container_kind=2 且 container_id=Some(deceased_id)
                    ensure!(container_kind == 2, Error::<T>::BadInput);
                    let did_u64 = container_id.ok_or(Error::<T>::BadInput)?;
                    let deceased_id: T::DeceasedId = did_u64.saturated_into();
                    ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
                    // 可选：允许任意账户留言；若需收紧，可引入 can_manage 或成员校验
                    let id = NextDataId::<T>::get();
                    let next = id.checked_add(&T::DataId::from(1u32)).ok_or(Error::<T>::Overflow)?;
                    NextDataId::<T>::put(next);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
                    let title_bv = match title { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                    let summary_bv = match summary { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                    let media = Data::<T> { data_id: id, album_id: None, video_collection_id: None, deceased_id, deceased_token: token, owner: who.clone(), kind: DataKind::Message, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, title: title_bv, summary: summary_bv, duration_secs: None, width: None, height: None, order_index: 0, created: now, updated: now };
                    DataOf::<T>::insert(id, media);
                    MessagesByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;
                    let dep = T::DataDeposit::get();
                    if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; DataDeposits::<T>::insert(id, (who.clone(), dep)); DataMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
                    Self::deposit_event(Event::DataMessageAdded(id, deceased_id));
                    return Ok(())
                }
            }
        }

        /// 函数级中文注释：移动数据到新容器（统一接口）：Photo→相册；Video/Audio→视频集；Article→不可移动（未分类）。
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn move_data(origin: OriginFor<T>, data_id: T::DataId, to_kind: u8, to_id: Option<u64>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            DataOf::<T>::try_mutate(data_id, |maybe_m| -> DispatchResult {
                let m = maybe_m.as_mut().ok_or(Error::<T>::DataNotFound)?;
                ensure!(m.owner == who, Error::<T>::NotAuthorized);
                match m.kind {
                    DataKind::Photo => {
                        ensure!(to_kind == 0, Error::<T>::BadInput);
                        let aid_u64 = to_id.ok_or(Error::<T>::BadInput)?;
                        let aid: T::AlbumId = aid_u64.saturated_into::<u64>().saturated_into();
                        let dst = AlbumOf::<T>::get(aid).ok_or(Error::<T>::AlbumNotFound)?;
                        ensure!(dst.deceased_id == m.deceased_id, Error::<T>::MismatchDeceased);
                        if let Some(from) = m.album_id { DataByAlbum::<T>::mutate(from, |src| { if let Some(pos) = src.iter().position(|x| x == &data_id) { src.swap_remove(pos); } }); }
                        DataByAlbum::<T>::try_mutate(aid, |dst_list| dst_list.try_push(data_id).map_err(|_| Error::<T>::TooMany))?;
                        m.album_id = Some(aid); m.video_collection_id = None;
                    }
                    DataKind::Video | DataKind::Audio => {
                        ensure!(to_kind == 1, Error::<T>::BadInput);
                        let vsid_u64 = to_id.ok_or(Error::<T>::BadInput)?;
                        let vsid: T::VideoCollectionId = vsid_u64.saturated_into::<u64>().saturated_into();
                        let dst = VideoCollectionOf::<T>::get(vsid).ok_or(Error::<T>::BadInput)?;
                        ensure!(dst.deceased_id == m.deceased_id, Error::<T>::MismatchDeceased);
                        if let Some(from) = m.video_collection_id { DataByVideoCollection::<T>::mutate(from, |src| { if let Some(pos) = src.iter().position(|x| x == &data_id) { src.swap_remove(pos); } }); }
                        DataByVideoCollection::<T>::try_mutate(vsid, |dst_list| dst_list.try_push(data_id).map_err(|_| Error::<T>::TooMany))?;
                        m.video_collection_id = Some(vsid); m.album_id = None;
                    }
                    DataKind::Article => { return Err(Error::<T>::BadInput.into()); }
                    DataKind::Message => { return Err(Error::<T>::BadInput.into()); }
                }
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Ok(())
        }
        /// 函数级中文注释：更新相册；仅 owner；可更新标题/描述/可见性/标签/封面。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_album(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            title: Option<Vec<u8>>,
            desc: Option<Vec<u8>>,
            visibility: Option<u8>,
            tags: Option<Vec<Vec<u8>>>,
            primary_photo_id: Option<Option<T::DataId>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            AlbumOf::<T>::try_mutate(album_id, |maybe_a| -> DispatchResult {
                let a = maybe_a.as_mut().ok_or(Error::<T>::AlbumNotFound)?;
                ensure!(a.owner == who, Error::<T>::NotAuthorized);
                ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);
                if let Some(t) = title { a.title = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(d) = desc { a.desc = BoundedVec::try_from(d).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = visibility { a.visibility = match v { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) }; }
                if let Some(ts) = tags {
                    let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
                    for t in ts.into_iter() {
                        let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                        tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    a.tags = tags_bv;
                }
                if let Some(cov) = primary_photo_id {
                    if let Some(mid) = cov {
                        let m = DataOf::<T>::get(mid).ok_or(Error::<T>::DataNotFound)?;
                        ensure!(m.album_id == Some(album_id), Error::<T>::BadInput);
                        ensure!(matches!(m.kind, DataKind::Photo), Error::<T>::BadInput);
                    }
                    a.primary_photo_id = cov;
                }
                a.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::AlbumUpdated(album_id));
            Ok(())
        }

        /// 函数级中文注释：删除相册；仅 owner；若非空则拒绝，避免重交易。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn delete_album(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);
            ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);
            let medias = DataByAlbum::<T>::get(album_id);
            ensure!(medias.is_empty(), Error::<T>::BadInput);
            AlbumOf::<T>::remove(album_id);
            AlbumsByDeceased::<T>::mutate(album.deceased_id, |list| { if let Some(pos) = list.iter().position(|x| x == &album_id) { list.swap_remove(pos); } });
            // 删除后，若存在押金，重置成熟期等待投诉期结束再可退款
            if AlbumDeposits::<T>::contains_key(album_id) {
                let now = <frame_system::Pallet<T>>::block_number();
                AlbumMaturity::<T>::insert(album_id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::AlbumDeleted(album_id));
            Ok(())
        }

        // 已删除：add_media（旧接口）。统一使用 add_data(container_kind, container_id, kind, ...) 入口。

        /// 函数级中文注释：更新媒体项；仅 owner；可改外链/哈希/尺寸/排序等。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_data(
            origin: OriginFor<T>,
            data_id: T::DataId,
            uri: Option<Vec<u8>>,
            thumbnail_uri: Option<Option<Vec<u8>>>,
            content_hash: Option<Option<[u8;32]>>,
            // 文章标题/摘要更新（仅当目标媒体为 Article 时有效）。
            title: Option<Option<Vec<u8>>>,
            summary: Option<Option<Vec<u8>>>,
            duration_secs: Option<Option<u32>>,
            width: Option<Option<u32>>,
            height: Option<Option<u32>>,
            order_index: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            DataOf::<T>::try_mutate(data_id, |maybe_m| -> DispatchResult {
                let m = maybe_m.as_mut().ok_or(Error::<T>::DataNotFound)?;
                ensure!(m.owner == who, Error::<T>::NotAuthorized);
                // 函数级中文注释：仅对相册内的数据（Photo/Article）检查相册冻结；
                // 对视频/音频检查视频集冻结；Message 不依赖容器，跳过校验，避免误报。
                if matches!(m.kind, DataKind::Photo | DataKind::Article) {
                    let aid = m.album_id.ok_or(Error::<T>::BadInput)?;
                    ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen);
                } else if matches!(m.kind, DataKind::Video | DataKind::Audio) {
                    if let Some(vsid) = m.video_collection_id {
                        ensure!(!VideoCollectionFrozen::<T>::get(vsid), Error::<T>::Frozen);
                    }
                }
                if let Some(u) = uri { m.uri = BoundedVec::try_from(u).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(t) = thumbnail_uri { m.thumbnail_uri = match t { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None }; }
                if let Some(h) = content_hash { m.content_hash = h; }
                if let Some(dur) = duration_secs {
                    // 对视频/音频：若提供时长则要求 > 0
                    if matches!(m.kind, DataKind::Video | DataKind::Audio) {
                        if let Some(x) = dur { ensure!(x > 0u32, Error::<T>::BadInput); }
                    }
                    m.duration_secs = dur;
                }
                // Article 专属字段更新
                if let Some(t) = title {
                    if matches!(m.kind, DataKind::Article) {
                        m.title = match t { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                    }
                }
                if let Some(s) = summary {
                    if matches!(m.kind, DataKind::Article) {
                        m.summary = match s { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                    }
                }
                if let Some(w_opt) = width {
                    if matches!(m.kind, DataKind::Photo) { if let Some(x) = w_opt { ensure!(x > 0u32, Error::<T>::BadInput); } }
                    m.width = w_opt;
                }
                if let Some(h_opt) = height {
                    if matches!(m.kind, DataKind::Photo) { if let Some(x) = h_opt { ensure!(x > 0u32, Error::<T>::BadInput); } }
                    m.height = h_opt;
                }
                if let Some(ord) = order_index { m.order_index = ord; }
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::DataUpdated(data_id));
            Ok(())
        }

        /// 函数级中文注释：删除媒体项；仅 owner；从相册索引中同步移除。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn remove_data(origin: OriginFor<T>, data_id: T::DataId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let m = DataOf::<T>::get(data_id).ok_or(Error::<T>::DataNotFound)?;
            ensure!(m.owner == who, Error::<T>::NotAuthorized);
            // Photo：相册内删除；Message：按逝者索引删除；其他类型当前不支持用户删除
            if let Some(aid) = m.album_id {
                ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen);
                DataOf::<T>::remove(data_id);
                DataByAlbum::<T>::mutate(aid, |list| { if let Some(pos) = list.iter().position(|x| x == &data_id) { list.swap_remove(pos); } });
            } else if matches!(m.kind, DataKind::Message) {
                DataOf::<T>::remove(data_id);
                MessagesByDeceased::<T>::mutate(m.deceased_id, |list| { if let Some(pos) = list.iter().position(|x| x == &data_id) { list.swap_remove(pos); } });
            } else {
                return Err(Error::<T>::BadInput.into());
            }
            // 删除后，若存在押金，重置成熟期等待投诉期结束再可退款
            if DataDeposits::<T>::contains_key(data_id) {
                let now = <frame_system::Pallet<T>>::block_number();
                DataMaturity::<T>::insert(data_id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::DataRemoved(data_id));
            Ok(())
        }

        

        /// 函数级中文注释：重排相册媒体顺序；仅 owner；限制批量大小。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn reorder_album(origin: OriginFor<T>, album_id: T::AlbumId, ordered_media: Vec<T::DataId>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);
            ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);
            ensure!((ordered_media.len() as u32) <= T::MaxReorderBatch::get(), Error::<T>::BadInput);
            for (idx, mid) in ordered_media.iter().enumerate() {
                DataOf::<T>::try_mutate(*mid, |maybe_m| -> DispatchResult {
                    let m = maybe_m.as_mut().ok_or(Error::<T>::DataNotFound)?;
                    ensure!(m.album_id == Some(album_id), Error::<T>::BadInput);
                    m.order_index = idx as u32;
                    m.updated = <frame_system::Pallet<T>>::block_number();
                    Ok(())
                })?;
            }
            DataByAlbum::<T>::insert(album_id, BoundedVec::try_from(ordered_media).map_err(|_| Error::<T>::BadInput)?);
            Self::deposit_event(Event::AlbumReordered(album_id));
            Ok(())
        }

        // ===================== 投诉与押金退款 =====================
        /// 函数级中文注释：投诉相册（累加计数 + 申诉押金 reserve）。存在投诉将阻止押金退款。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_album(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            // 每次仅允许一个有效申诉
            let key = (1u8, album_id.saturated_into::<u64>());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::NoActiveComplaint);
            // 申诉押金：与媒体押金等额或由常量指定
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
            }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = AlbumComplaints::<T>::get(album_id).saturating_add(1);
            AlbumComplaints::<T>::insert(album_id, cnt);
            Self::deposit_event(Event::AlbumComplained(album_id, cnt));
            Ok(())
        }

        /// 函数级中文注释：投诉媒体（累加计数 + 申诉押金 reserve）。存在投诉将阻止押金退款。
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_data(origin: OriginFor<T>, data_id: T::DataId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(DataOf::<T>::contains_key(data_id) || DataDeposits::<T>::contains_key(data_id), Error::<T>::DataNotFound);
            let key = (2u8, data_id.saturated_into::<u64>());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::NoActiveComplaint);
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
            }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = DataComplaints::<T>::get(data_id).saturating_add(1);
            DataComplaints::<T>::insert(data_id, cnt);
            Self::deposit_event(Event::DataComplained(data_id, cnt));
            Ok(())
        }

        /// 函数级中文注释：领取相册押金（需到期且无投诉）。删除后同等待期可退。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_album_deposit(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = AlbumDeposits::<T>::get(album_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            ensure!(AlbumComplaints::<T>::get(album_id) == 0, Error::<T>::NotMatured);
            let mature_at = AlbumMaturity::<T>::get(album_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            AlbumDeposits::<T>::remove(album_id);
            AlbumMaturity::<T>::remove(album_id);
            Self::deposit_event(Event::AlbumDepositRefunded(album_id, who, amt));
            Ok(())
        }

        /// 函数级中文注释：领取媒体押金（需到期且无投诉）。删除后同等待期可退。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_data_deposit(origin: OriginFor<T>, data_id: T::DataId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = DataDeposits::<T>::get(data_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            ensure!(DataComplaints::<T>::get(data_id) == 0, Error::<T>::NotMatured);
            let mature_at = DataMaturity::<T>::get(data_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            DataDeposits::<T>::remove(data_id);
            DataMaturity::<T>::remove(data_id);
            Self::deposit_event(Event::DataDepositRefunded(data_id, who, amt));
            Ok(())
        }

        // ===================== 治理动作 =====================
        /// 函数级中文注释：【治理】裁决相册申诉（true=维持投诉；false=驳回）。
        #[pallet::call_index(17)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_album_complaint(origin: OriginFor<T>, album_id: T::AlbumId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            let key = (1u8, album_id.saturated_into::<u64>());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::NoActiveComplaint)?;
            let (uploader, upload_dep) = AlbumDeposits::<T>::get(album_id).unwrap_or_else(|| (T::FeeCollector::get(), Zero::zero()));
            let arb = T::ArbitrationAccount::get();
            // 按败诉方押金 D 分配：20% → 胜诉；5% → 仲裁；75% → 败诉退款
            if uphold {
                // 败诉：上传者；胜诉：投诉者
                let d = upload_dep;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    // 从上传者保留押金划转
                    T::Currency::repatriate_reserved(&uploader, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&uploader, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&uploader, back);
                    // 清除上传侧押金记录
                    AlbumDeposits::<T>::remove(album_id);
                    AlbumMaturity::<T>::remove(album_id);
                    Self::deposit_event(Event::ComplaintPayoutWinner(case.complainant.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(uploader.clone(), back));
                }
                // 胜诉方申诉押金全额退回
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                // 败诉：投诉者；胜诉：上传者
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    T::Currency::repatriate_reserved(&case.complainant, &uploader, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutWinner(uploader.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(case.complainant.clone(), back));
                }
                // 上传者押金保持原成熟路径（不动）
            }
            // 结案与计数归零
            case.status = ComplaintStatus::Resolved;
            ComplaintOf::<T>::remove(key);
            AlbumComplaints::<T>::insert(album_id, 0);
            let id_u64: u64 = album_id.saturated_into::<u64>();
            Self::deposit_event(Event::ComplaintResolved(1u8, id_u64, uphold));
            Ok(())
        }

        /// 函数级中文注释：【治理】裁决媒体申诉（true=维持投诉；false=驳回）。
        #[pallet::call_index(18)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_data_complaint(origin: OriginFor<T>, data_id: T::DataId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(DataOf::<T>::contains_key(data_id) || DataDeposits::<T>::contains_key(data_id), Error::<T>::DataNotFound);
            let key = (2u8, data_id.saturated_into::<u64>());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::NoActiveComplaint)?;
            let (uploader, upload_dep) = DataDeposits::<T>::get(data_id).unwrap_or_else(|| (T::FeeCollector::get(), Zero::zero()));
            let arb = T::ArbitrationAccount::get();
            if uphold {
                // 败诉：上传者；胜诉：投诉者
                let d = upload_dep;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    T::Currency::repatriate_reserved(&uploader, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&uploader, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&uploader, back);
                    DataDeposits::<T>::remove(data_id);
                    DataMaturity::<T>::remove(data_id);
                    Self::deposit_event(Event::ComplaintPayoutWinner(case.complainant.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(uploader.clone(), back));
                }
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                // 败诉：投诉者；胜诉：上传者
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    T::Currency::repatriate_reserved(&case.complainant, &uploader, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutWinner(uploader.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(case.complainant.clone(), back));
                }
            }
            case.status = ComplaintStatus::Resolved;
            ComplaintOf::<T>::remove(key);
            DataComplaints::<T>::insert(data_id, 0);
            let id_u64: u64 = data_id.saturated_into::<u64>();
            Self::deposit_event(Event::ComplaintResolved(2u8, id_u64, uphold));
            Ok(())
        }
        /// 函数级中文注释：【治理】冻结/解冻相册。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_freeze_album(origin: OriginFor<T>, album_id: T::AlbumId, frozen: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            AlbumFrozen::<T>::insert(album_id, frozen);
            Self::deposit_event(Event::GovAlbumFrozen(album_id, frozen));
            Ok(())
        }

        /// 函数级中文注释：【治理】设置相册元数据与封面（任选）。
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_album_meta(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            title: Option<Vec<u8>>,
            desc: Option<Vec<u8>>,
            visibility: Option<u8>,
            tags: Option<Vec<Vec<u8>>>,
            primary_photo_id: Option<Option<T::DataId>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            AlbumOf::<T>::try_mutate(album_id, |maybe_a| -> DispatchResult {
                let a = maybe_a.as_mut().ok_or(Error::<T>::AlbumNotFound)?;
                if let Some(t) = title { a.title = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(d) = desc { a.desc = BoundedVec::try_from(d).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = visibility { a.visibility = match v { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) }; }
                if let Some(ts) = tags {
                    let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
                    for t in ts.into_iter() {
                        let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                        tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    a.tags = tags_bv;
                }
                if let Some(cov) = primary_photo_id {
                    if let Some(mid) = cov { let m = DataOf::<T>::get(mid).ok_or(Error::<T>::DataNotFound)?; ensure!(m.album_id == Some(album_id), Error::<T>::BadInput); ensure!(matches!(m.kind, DataKind::Photo), Error::<T>::BadInput); }
                    a.primary_photo_id = cov;
                }
                a.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::AlbumUpdated(album_id));
            Ok(())
        }

        /// 函数级中文注释：【治理】隐藏/取消隐藏媒体。
        #[pallet::call_index(14)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_media_hidden(origin: OriginFor<T>, data_id: T::DataId, hidden: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(DataOf::<T>::contains_key(data_id) || DataDeposits::<T>::contains_key(data_id), Error::<T>::DataNotFound);
            DataHidden::<T>::insert(data_id, hidden);
            Self::deposit_event(Event::GovDataHidden(data_id, hidden));
            Ok(())
        }

        /// 函数级中文注释：【治理】替换媒体 URI（例如涉敏内容替换为打码资源）。
        #[pallet::call_index(15)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_replace_media_uri(origin: OriginFor<T>, media_id: T::DataId, new_uri: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            DataOf::<T>::try_mutate(media_id, |maybe_m| -> DispatchResult {
                let m = maybe_m.as_mut().ok_or(Error::<T>::DataNotFound)?;
                m.uri = BoundedVec::try_from(new_uri).map_err(|_| Error::<T>::BadInput)?;
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::GovDataReplaced(media_id));
            Ok(())
        }

        /// 函数级中文注释：【治理】移除媒体（押金保留，删除后等待成熟可退）。
        #[pallet::call_index(16)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_remove_data(origin: OriginFor<T>, data_id: T::DataId) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let m = DataOf::<T>::get(data_id).ok_or(Error::<T>::DataNotFound)?;
            DataOf::<T>::remove(data_id);
            if let Some(aid) = m.album_id {
                DataByAlbum::<T>::mutate(aid, |list| { if let Some(pos) = list.iter().position(|x| x == &data_id) { list.swap_remove(pos); } });
            } else if matches!(m.kind, DataKind::Message) {
                MessagesByDeceased::<T>::mutate(m.deceased_id, |list| { if let Some(pos) = list.iter().position(|x| x == &data_id) { list.swap_remove(pos); } });
            }
            // 重置成熟时间，待期后可退押金
            let now = <frame_system::Pallet<T>>::block_number();
            DataMaturity::<T>::insert(data_id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::DataRemoved(data_id));
            Ok(())
        }

        // ===================== 生平（Life） =====================
        /// 函数级中文注释：创建生平（不可删除）。仅允许 can_manage 的账户创建，避免被抢注。
        #[pallet::call_index(26)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_life(origin: OriginFor<T>, deceased_id: T::DeceasedId, text: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);
            ensure!(LifeOf::<T>::get(deceased_id).is_none(), Error::<T>::BadInput);
            let bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(text).map_err(|_| Error::<T>::BadInput)?;
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let life = Life { owner: who.clone(), deceased_id, deceased_token: token, cid: bv, updated: now, version: 1, last_editor: None };
            LifeOf::<T>::insert(deceased_id, life);
            Self::deposit_event(Event::LifeCreated(deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新生平；创建者免押金，非创建者需押金 + 成熟期并允许投诉。
        #[pallet::call_index(27)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_life(origin: OriginFor<T>, deceased_id: T::DeceasedId, text: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            LifeOf::<T>::try_mutate(deceased_id, |maybe_life| -> DispatchResult {
                let life = maybe_life.as_mut().ok_or(Error::<T>::BadInput)?;
                let bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(text).map_err(|_| Error::<T>::BadInput)?;
                let now = <frame_system::Pallet<T>>::block_number();
                if who == life.owner {
                    life.cid = bv; life.updated = now; life.version = life.version.saturating_add(1); life.last_editor = None;
                    Self::deposit_event(Event::LifeUpdated(deceased_id));
                } else {
                    // 非创建者：押金 + 进入成熟期；保存旧文本用于治理回滚
                    let dep = T::DataDeposit::get();
                    if !dep.is_zero() {
                        T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                        LifeDeposits::<T>::insert(deceased_id, (who.clone(), dep));
                        LifeMaturity::<T>::insert(deceased_id, now + T::ComplaintPeriod::get());
                    }
                    LifePrev::<T>::insert(deceased_id, life.cid.clone());
                    life.cid = bv; life.updated = now; life.version = life.version.saturating_add(1); life.last_editor = Some(who.clone());
                    Self::deposit_event(Event::LifeUpdatedByOthers(deceased_id, who));
                }
                Ok(())
            })?;
            Ok(())
        }

        /// 函数级中文注释：投诉生平（域=3）。
        #[pallet::call_index(28)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_life(origin: OriginFor<T>, deceased_id: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(LifeOf::<T>::contains_key(deceased_id), Error::<T>::BadInput);
            let key: (u8, u64) = (3u8, deceased_id.saturated_into());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::NoActiveComplaint);
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = LifeComplaints::<T>::get(deceased_id).saturating_add(1);
            LifeComplaints::<T>::insert(deceased_id, cnt);
            Self::deposit_event(Event::LifeComplained(deceased_id, cnt));
            Ok(())
        }

        /// 函数级中文注释：治理裁决生平投诉（维持：回滚并分账非创建者押金；驳回：分账投诉押金）。
        #[pallet::call_index(29)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_life_complaint(origin: OriginFor<T>, deceased_id: T::DeceasedId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(LifeOf::<T>::contains_key(deceased_id), Error::<T>::BadInput);
            let key: (u8, u64) = (3u8, deceased_id.saturated_into());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::NoActiveComplaint)?;
            let arb = T::ArbitrationAccount::get();
            if uphold {
                // 维持投诉：回滚文本（若有旧文本），并按非创建者押金分账
                if let Some(prev) = LifePrev::<T>::take(deceased_id) {
                    LifeOf::<T>::mutate(deceased_id, |life| { if let Some(l) = life { l.cid = prev; l.last_editor = None; } });
                }
                if let Some((editor, d)) = LifeDeposits::<T>::take(deceased_id) {
                    if !d.is_zero() {
                        let win = (d * 20u32.into()) / 100u32.into();
                        let fee = (d * 5u32.into()) / 100u32.into();
                        let back = d - win - fee;
                        T::Currency::repatriate_reserved(&editor, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                        T::Currency::repatriate_reserved(&editor, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                        T::Currency::unreserve(&editor, back);
                    }
                }
                // 投诉押金全退
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                // 驳回：投诉押金 20/5/75 分账
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    // 受益人用创建者代替“上传者”定位
                    if let Some(l) = LifeOf::<T>::get(deceased_id) {
                        T::Currency::repatriate_reserved(&case.complainant, &l.owner, win, frame_support::traits::BalanceStatus::Free).ok();
                    }
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                }
            }
            LifeMaturity::<T>::remove(deceased_id);
            LifeComplaints::<T>::insert(deceased_id, 0);
            ComplaintOf::<T>::remove(key);
            Self::deposit_event(Event::ComplaintResolved(3u8, deceased_id.saturated_into(), uphold));
            Ok(())
        }

        /// 函数级中文注释：非创建者修改押金领取（需到期且无投诉）。
        #[pallet::call_index(30)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_life_deposit(origin: OriginFor<T>, deceased_id: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = LifeDeposits::<T>::get(deceased_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            ensure!(LifeComplaints::<T>::get(deceased_id) == 0, Error::<T>::NotMatured);
            let mature_at = LifeMaturity::<T>::get(deceased_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            LifeDeposits::<T>::remove(deceased_id);
            LifeMaturity::<T>::remove(deceased_id);
            Self::deposit_event(Event::LifeDepositRefunded(deceased_id, who, amt));
            Ok(())
        }

        // ===================== 悼词（Eulogy） =====================
        /// 创建悼词（任何签名账户；押金+成熟；支持投诉/治理删除）。
        #[pallet::call_index(31)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_eulogy(origin: OriginFor<T>, deceased_id: T::DeceasedId, cid: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            let cid_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            let id = NextEulogyId::<T>::get();
            let next = id.checked_add(&T::DataId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextEulogyId::<T>::put(next);
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let now = <frame_system::Pallet<T>>::block_number();
            let e = Eulogy { id, deceased_id, deceased_token: token, author: who.clone(), cid: cid_bv, created: now, updated: now };
            EulogyOf::<T>::insert(id, e);
            EulogiesByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;
            let dep = T::DataDeposit::get();
            if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; EulogyDeposits::<T>::insert(id, (who.clone(), dep)); EulogyMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
            Self::deposit_event(Event::EulogyCreated(id, deceased_id, who));
            Ok(())
        }

        /// 更新悼词（仅作者）。
        #[pallet::call_index(32)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_eulogy(origin: OriginFor<T>, id: T::DataId, cid: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let cid_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            EulogyOf::<T>::try_mutate(id, |maybe_e| -> DispatchResult {
                let e = maybe_e.as_mut().ok_or(Error::<T>::DataNotFound)?;
                ensure!(e.author == who, Error::<T>::NotAuthorized);
                e.cid = cid_bv; e.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::EulogyUpdated(id));
            Ok(())
        }

        /// 删除悼词（治理）。
        #[pallet::call_index(33)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_remove_eulogy(origin: OriginFor<T>, id: T::DataId) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let e = EulogyOf::<T>::take(id).ok_or(Error::<T>::DataNotFound)?;
            EulogiesByDeceased::<T>::mutate(e.deceased_id, |list| { if let Some(pos) = list.iter().position(|x| x == &id) { list.swap_remove(pos); } });
            // 重置成熟时间，待期可退押金
            let now = <frame_system::Pallet<T>>::block_number();
            EulogyMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::EulogyRemoved(id));
            Ok(())
        }

        /// 投诉悼词（任何人）。
        #[pallet::call_index(34)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_eulogy(origin: OriginFor<T>, id: T::DataId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(EulogyOf::<T>::contains_key(id) || EulogyDeposits::<T>::contains_key(id), Error::<T>::DataNotFound);
            let key = (4u8, id.saturated_into::<u64>());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::NoActiveComplaint);
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = EulogyComplaints::<T>::get(id).saturating_add(1);
            EulogyComplaints::<T>::insert(id, cnt);
            Self::deposit_event(Event::EulogyComplained(id, cnt));
            Ok(())
        }

        /// 裁决悼词投诉（治理）。
        #[pallet::call_index(35)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_eulogy_complaint(origin: OriginFor<T>, id: T::DataId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(EulogyOf::<T>::contains_key(id) || EulogyDeposits::<T>::contains_key(id), Error::<T>::DataNotFound);
            let key = (4u8, id.saturated_into::<u64>());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::NoActiveComplaint)?;
            let arb = T::ArbitrationAccount::get();
            if uphold {
                if let Some((author, d)) = EulogyDeposits::<T>::take(id) {
                    if !d.is_zero() {
                        let win = (d * 20u32.into()) / 100u32.into();
                        let fee = (d * 5u32.into()) / 100u32.into();
                        let back = d - win - fee;
                        T::Currency::repatriate_reserved(&author, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                        T::Currency::repatriate_reserved(&author, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                        T::Currency::unreserve(&author, back);
                    }
                }
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    if let Some((author, _)) = EulogyDeposits::<T>::get(id) { T::Currency::repatriate_reserved(&case.complainant, &author, win, frame_support::traits::BalanceStatus::Free).ok(); }
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                }
            }
            ComplaintOf::<T>::remove(key);
            EulogyComplaints::<T>::insert(id, 0);
            Self::deposit_event(Event::ComplaintResolved(4u8, id.saturated_into::<u64>(), uphold));
            Ok(())
        }

        /// 领取悼词押金（到期且无投诉）。
        #[pallet::call_index(36)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_eulogy_deposit(origin: OriginFor<T>, id: T::DataId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = EulogyDeposits::<T>::get(id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            ensure!(EulogyComplaints::<T>::get(id) == 0, Error::<T>::NotMatured);
            let mature_at = EulogyMaturity::<T>::get(id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            EulogyDeposits::<T>::remove(id);
            EulogyMaturity::<T>::remove(id);
            Self::deposit_event(Event::EulogyDepositRefunded(id, who, amt));
            Ok(())
        }
    }

    // ===================== 存储迁移（v1 -> v2）=====================
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：将旧版本 `Media`（无 `title`/`summary`）迁移为新版本（追加字段为 None）。
        fn migrate_v1_to_v2() -> Weight {
            // 旧版结构定义：与 v1 完全一致，用于从存储解码。
            #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
            #[scale_info(skip_type_params(T))]
            struct OldMedia<T: Config> {
                pub album_id: T::AlbumId,
                pub deceased_id: T::DeceasedId,
                pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
                pub owner: T::AccountId,
                pub kind: DataKind,
                pub uri: BoundedVec<u8, T::StringLimit>,
                pub thumbnail_uri: Option<BoundedVec<u8, T::StringLimit>>,
                pub content_hash: Option<[u8; 32]>,
                pub duration_secs: Option<u32>,
                pub width: Option<u32>,
                pub height: Option<u32>,
                pub order_index: u32,
                pub created: BlockNumberFor<T>,
                pub updated: BlockNumberFor<T>,
            }

            let mut reads: u64 = 0;
            let mut writes: u64 = 0;

            for (media_id, _) in DataOf::<T>::iter() {
                reads += 1;
                // 取底层原始字节并按旧版解码（避免直接解码为新结构失败）
                let storage_key = DataOf::<T>::hashed_key_for(media_id);
                if let Some(raw) = sp_io::storage::get(&storage_key) {
                    if let Ok(old) = OldMedia::<T>::decode(&mut &raw[..]) {
                        let new_media = Data::<T> {
                            data_id: media_id,
                            album_id: Some(old.album_id),
                            video_collection_id: None,
                            deceased_id: old.deceased_id,
                            deceased_token: old.deceased_token,
                            owner: old.owner,
                            kind: old.kind,
                            uri: old.uri,
                            thumbnail_uri: old.thumbnail_uri,
                            content_hash: old.content_hash,
                            title: None,
                            summary: None,
                            duration_secs: old.duration_secs,
                            width: old.width,
                            height: old.height,
                            order_index: old.order_index,
                            created: old.created,
                            updated: old.updated,
                        };
                        DataOf::<T>::insert(media_id, new_media);
                        writes += 1;
                    }
                }
            }
            // 写入新版本号
            frame_support::pallet_prelude::StorageVersion::new(2).put::<Pallet<T>>();
            T::DbWeight::get().reads_writes(reads, writes + 1)
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：在运行时升级时执行存储迁移，将 v1 的 Data 数据迁移至 v2 结构。
        fn on_runtime_upgrade() -> Weight {
            let onchain = Pallet::<T>::on_chain_storage_version();
            if onchain < 2 {
                return Self::migrate_v1_to_v2();
            }
            Weight::zero()
        }
    }
}