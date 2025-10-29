#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

// 函数级中文注释：统一逝者数据管理 - 整合text和media模块
pub mod text;
pub mod media;
pub use text::*;
pub use media::*;

use frame_support::weights::Weight;
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::AtLeast32BitUnsigned;
use sp_std::vec::Vec;
use sp_core::hashing::blake2_256;

// 函数级中文注释：导入log用于记录自动pin失败的警告
extern crate log;
// 函数级中文注释：导入pallet_memo_ipfs用于IpfsPinner trait
extern crate pallet_memo_ipfs;

// 函数级中文注释：导入IpfsPinner trait以便使用其方法
use pallet_memo_ipfs::IpfsPinner;

/// 函数级详细中文注释：墓位接口抽象，保持与 `pallet-grave` 低耦合
/// 
/// ### 核心方法（原有）
/// - `grave_exists`：校验墓位是否存在，避免挂接到无效墓位
/// - `can_attach`：校验操作者是否有权在该墓位下管理逝者（通常是墓主或被授权者）
/// 
/// ### 同步方法（Phase 1.5新增）⭐
/// - `record_interment`：记录安葬操作，同步Interments存储
/// - `record_exhumation`：记录起掘操作，同步Interments存储
/// 
/// ### 设计理念
/// - **问题**：Interments（grave）与DeceasedByGrave（deceased）不同步
/// - **解决**：deceased pallet操作时，自动调用grave pallet记录
/// - **优势**：保持低耦合，通过trait解耦
/// 
/// ### 使用场景
/// - `create_deceased`：创建后自动调用`record_interment`
/// - `transfer_deceased`：迁移时调用`record_exhumation`+`record_interment`
pub trait GraveInspector<AccountId, GraveId> {
    /// 函数级中文注释：检查墓位是否存在
    fn grave_exists(grave_id: GraveId) -> bool;
    
    /// 函数级中文注释：检查操作者是否有权在该墓位管理逝者
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool;
    
    /// 函数级详细中文注释：记录安葬操作（Phase 1.5新增）
    /// 
    /// ### 功能
    /// - 将逝者记录到墓位的Interments中
    /// - 同步grave pallet的安葬记录
    /// 
    /// ### 参数
    /// - `grave_id`: 墓位ID
    /// - `deceased_id`: 逝者ID
    /// - `slot`: 槽位（可选）
    /// - `note_cid`: 备注CID（可选）
    /// 
    /// ### 调用场景
    /// - deceased::create_deceased - 创建逝者后自动记录
    /// - deceased::transfer_deceased - 迁入新墓位时记录
    /// 
    /// ### 权限
    /// - 本方法不检查权限（权限已在deceased pallet检查）
    /// - 仅用于同步数据
    /// 
    /// ### 注意
    /// - 不触发OnInterment钩子（避免重复触发）
    /// - 不检查容量（容量已在deceased pallet检查）
    fn record_interment(
        grave_id: GraveId,
        deceased_id: u64,
        slot: Option<u16>,
        note_cid: Option<Vec<u8>>,
    ) -> Result<(), sp_runtime::DispatchError>;
    
    /// 函数级详细中文注释：记录起掘操作（Phase 1.5新增）
    /// 
    /// ### 功能
    /// - 从墓位的Interments中移除逝者记录
    /// - 同步grave pallet的起掘操作
    /// 
    /// ### 参数
    /// - `grave_id`: 墓位ID
    /// - `deceased_id`: 逝者ID
    /// 
    /// ### 调用场景
    /// - deceased::transfer_deceased - 从旧墓位迁出时记录
    /// 
    /// ### 权限
    /// - 本方法不检查权限（权限已在deceased pallet检查）
    /// - 仅用于同步数据
    /// 
    /// ### 注意
    /// - 如果记录不存在，不报错（幂等操作）
    fn record_exhumation(
        grave_id: GraveId,
        deceased_id: u64,
    ) -> Result<(), sp_runtime::DispatchError>;
    
    /// 函数级详细中文注释：检查墓位准入策略（Phase 1.5新增 - 解决P0问题2）
    /// 
    /// ### 功能
    /// - 检查调用者是否有权限将逝者迁入目标墓位
    /// - 根据墓位的准入策略进行判断
    /// - 解决P0问题：逝者强行挤入私人墓位
    /// 
    /// ### 参数
    /// - `who`: 调用者账户（逝者owner）
    /// - `grave_id`: 目标墓位ID
    /// 
    /// ### 策略逻辑
    /// - **OwnerOnly（默认）**：仅墓主可以迁入 → 检查who == grave.owner
    /// - **Public**：任何人都可以迁入 → 总是返回Ok
    /// - **Whitelist**：仅白名单可以迁入 → 检查墓主或白名单
    /// 
    /// ### 调用场景
    /// - deceased::transfer_deceased - 迁移前检查准入策略
    /// - deceased::create_deceased - 创建时可选检查（暂时跳过，因为墓主创建）
    /// 
    /// ### 返回值
    /// - `Ok(())`: 允许迁入
    /// - `Err`: 拒绝迁入（AdmissionDenied/NotFound）
    /// 
    /// ### 设计理念
    /// - 平衡需求3（逝者自由迁移）与墓主控制权
    /// - 墓主可以设置准入策略保护墓位
    /// - 逝者owner在策略允许范围内自由迁移
    /// 
    /// ### 注意事项
    /// - 墓主始终可以迁入（不受策略限制）
    /// - 不检查墓位容量（容量在deceased pallet检查）
    fn check_admission_policy(
        who: &AccountId,
        grave_id: GraveId,
    ) -> Result<(), sp_runtime::DispatchError>;
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
    fn create() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn update() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn remove() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn transfer() -> Weight {
        Weight::from_parts(10_000, 0)
    }
}

/// 函数级中文注释：性别枚举。
/// - 仅三种取值：M(男)、F(女)、B(保密/双性/未指明)。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Gender {
    M,
    F,
    B,
}

impl Gender {
    /// 函数级中文注释：转换为字节代码（M/F/B）
    /// 
    /// 用途：
    /// - 在构建deceased_token时，将Gender枚举转换为字节代码
    /// - 统一性别代码转换逻辑，避免重复的match表达式
    /// 
    /// 返回：
    /// - Gender::M => b'M' (0x4D)
    /// - Gender::F => b'F' (0x46)
    /// - Gender::B => b'B' (0x42)
    pub fn to_byte(&self) -> u8 {
        match self {
            Gender::M => b'M',
            Gender::F => b'F',
            Gender::B => b'B',
        }
    }
    
    /// 函数级中文注释：从数字代码构建Gender枚举
    /// 
    /// 用途：
    /// - 在解析外部输入时，将数字代码转换为Gender枚举
    /// - 统一代码转换逻辑
    /// 
    /// 参数：
    /// - code: 数字代码（0=男, 1=女, 其他=保密）
    /// 
    /// 返回：
    /// - 0 => Gender::M
    /// - 1 => Gender::F
    /// - _ => Gender::B
    pub fn from_code(code: u8) -> Self {
        match code {
            0 => Gender::M,
            1 => Gender::F,
            _ => Gender::B,
        }
    }
}

/// 函数级中文注释：自动pin类型枚举
/// - 用于标识pin的CID类型，便于日志记录和事件区分
#[derive(Clone, Copy, Debug)]
pub enum AutoPinType {
    /// 全名CID
    NameFullCid,
    /// 主图CID
    MainImage,
}

/// 函数级中文注释：逝者实体，链上仅存最小必要信息与链下指针。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Deceased<T: Config> {
    /// 所属墓位 ID
    pub grave_id: T::GraveId,
    /// 记录拥有者（通常等于墓位所有者或其授权人）
    pub owner: T::AccountId,
    /// 函数级中文注释：创建者账户（不可变，只读审计字段）
    /// - 语义：最初发起 `create_deceased` 的签名账户；用于审计/治理/画像；不参与权限与派生。
    /// - 稳定性：创建后永久不可修改；迁移时对存量记录回填为 `owner`。
    pub creator: T::AccountId,
    /// 姓名（限长，避免敏感信息超量上链）
    pub name: BoundedVec<u8, T::StringLimit>,
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
    /// 逝者令牌（在 pallet 内构造）：gender(大写) + birth(8字节) + death(8字节) + 姓名哈希(blake2_256)
    /// 例如：M1981122420250901LIUXIAODONG
    /// 长度上限单独由 `Config::TokenLimit` 约束，便于与外部引用保持一致。
    pub deceased_token: BoundedVec<u8, T::TokenLimit>,
    /// 外部资源链接（IPFS/HTTPS），每条与数量均受限
    pub links: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>,
    /// 创建与更新区块号
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
    /// 函数级中文注释：版本号（从 1 开始）。每次“资料修改”自增，用于审计与回滚依据。
    pub version: u32,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::traits::ConstU32;
    use frame_support::traits::StorageVersion;
    use sp_runtime::traits::SaturatedConversion;
    use sp_std::vec;
    use frame_support::traits::Currency as CurrencyTrait;

    /// 函数级中文注释：Balance 类型别名（用于押金和费用）
    pub type BalanceOf<T> = <<T as Config>::Currency as CurrencyTrait<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 逝者 ID 类型
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 墓位 ID 类型（由外部 pallet 定义）
        type GraveId: Parameter + Member + Copy + MaxEncodedLen;

        /// 单字段字符串长度上限
        #[pallet::constant]
        type StringLimit: Get<u32>;

        /// 最大外部链接条数
        #[pallet::constant]
        type MaxLinks: Get<u32>;

        /// 函数级详细中文注释：墓位容量无限制设计说明
        /// 
        /// ### 设计变更
        /// - **已删除**：`MaxDeceasedPerGrave` 配置（原硬上限6人）
        /// - **改为**：Vec 无容量限制，支持家族墓、纪念墓
        /// 
        /// ### 合理性
        /// - 真实需求：家族墓可能几十人，纪念墓可能数千人
        /// - 经济保护：每人约10 MEMO成本，天然防止恶意填充
        /// - 性能可控：前端分页加载，1000人墓位仅8KB Storage
        /// 
        /// ### 风险控制
        /// - 经济门槛：创建+IPFS费用防止滥用
        /// - 前端优化：分页加载、虚拟滚动
        /// - 监控告警：超大墓位（>1000人）人工审核

        /// 函数级中文注释：`deceased_token` 的最大长度上限（字节）。
        /// - 设计目标：与外部引用者（如 `pallet-memo-grave`）的 `MaxCidLen` 对齐，避免跨 pallet 不一致。
        #[pallet::constant]
        type TokenLimit: Get<u32>;

        /// 墓位校验与权限提供者（低耦合关键）
        type GraveProvider: GraveInspector<Self::AccountId, Self::GraveId>;

        /// 权重信息
        type WeightInfo: WeightInfo;

        /// 函数级中文注释：治理起源（内容治理轨道/委员会白名单/Root 等）。
        /// - 用于本 Pallet 的治理专用接口（gov*），执行"失钥救济/内容治理类 C/U/D"。
        /// - 建议在 Runtime 中绑定为 EitherOfDiverse<Root, EnsureContentSigner>，与其他内容域保持一致。
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 函数级详细中文注释：IPFS自动pin提供者，供逝者CID自动固定
        /// 
        /// 集成目标：
        /// - main_image_cid: 逝者主图自动pin
        /// - name_full_cid: 逝者全名自动pin
        /// 
        /// 使用场景：
        /// - create_deceased: 创建时自动pin
        /// - update_deceased: 更新时pin新CID
        /// - set_main_image: 单独设置主图时pin
        /// 
        /// 注意：
        /// - Balance类型需要与IpfsPinner兼容
        /// - 由Runtime注入实现：pallet_memo_ipfs::Pallet<Runtime>
        type IpfsPinner: pallet_memo_ipfs::IpfsPinner<Self::AccountId, Self::Balance>;

        /// 函数级中文注释：余额类型（用于存储费用支付）
        /// - 必须与Currency的Balance类型一致
        /// - 用于IpfsPinner::pin_cid_for_deceased的price参数
        type Balance: Parameter + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 函数级中文注释：默认IPFS存储单价（每副本每月，单位为Balance最小单位）
        /// - 建议值：1 MEMO = 1_000_000_000_000（12位小数）
        /// - 用于自动pin时的费用估算
        #[pallet::constant]
        type DefaultStoragePrice: Get<Self::Balance>;

        // ========== Text 模块相关类型 ==========
        /// 函数级中文注释：文本ID类型（Article/Message/Eulogy共用）
        type TextId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        
        /// 函数级中文注释：每个逝者最大留言数
        #[pallet::constant]
        type MaxMessagesPerDeceased: Get<u32>;
        
        /// 函数级中文注释：每个逝者最大悼词数
        #[pallet::constant]
        type MaxEulogiesPerDeceased: Get<u32>;
        
        /// 函数级中文注释：文本押金（Article/Message/Eulogy）
        #[pallet::constant]
        type TextDeposit: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：投诉押金
        #[pallet::constant]
        type ComplaintDeposit: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：投诉成熟期（区块数）
        #[pallet::constant]
        type ComplaintPeriod: Get<BlockNumberFor<Self>>;
        
        /// 函数级中文注释：仲裁费用接收账户（5%）
        type ArbitrationAccount: Get<Self::AccountId>;

        // ========== Media 模块相关类型 ==========
        /// 函数级中文注释：相册ID类型
        type AlbumId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        
        /// 函数级中文注释：视频集ID类型
        type VideoCollectionId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        
        /// 函数级中文注释：媒体ID类型（Photo/Video/Audio共用）
        type MediaId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        
        /// 函数级中文注释：每个逝者最大相册数
        #[pallet::constant]
        type MaxAlbumsPerDeceased: Get<u32>;
        
        /// 函数级中文注释：每个逝者最大视频集数
        #[pallet::constant]
        type MaxVideoCollectionsPerDeceased: Get<u32>;
        
        /// 函数级中文注释：每个相册最大照片数
        #[pallet::constant]
        type MaxPhotoPerAlbum: Get<u32>;
        
        /// 函数级中文注释：最大标签数
        #[pallet::constant]
        type MaxTags: Get<u32>;
        
        /// 函数级中文注释：批量重排序最大数量
        #[pallet::constant]
        type MaxReorderBatch: Get<u32>;
        
        /// 函数级中文注释：相册押金
        #[pallet::constant]
        type AlbumDeposit: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：视频集押金
        #[pallet::constant]
        type VideoCollectionDeposit: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：媒体押金
        #[pallet::constant]
        type MediaDeposit: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：创建费用
        #[pallet::constant]
        type CreateFee: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：费用接收账户
        type FeeCollector: Get<Self::AccountId>;

        // ========== 共享类型（text和media共用）==========
        /// 函数级中文注释：货币接口（支持押金和转账）
        type Currency: frame_support::traits::ReservableCurrency<Self::AccountId>;
        
        /// 函数级中文注释：MaxTokenLen（复用TokenLimit，用于deceased_token）
        type MaxTokenLen: Get<u32>;
    }

    #[pallet::storage]
    #[pallet::getter(fn next_deceased_id)]
    /// 下一可用的逝者 ID
    pub type NextDeceasedId<T: Config> = StorageValue<_, T::DeceasedId, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn deceased_of)]
    /// 逝者详情：DeceasedId -> Deceased
    pub type DeceasedOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, Deceased<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn deceased_by_grave)]
    /// 函数级详细中文注释：墓位下的逝者列表（无容量限制，支持家族墓）
    /// 
    /// ### 数据结构
    /// - GraveId -> Vec<DeceasedId>
    /// - **无容量限制**：支持家族墓、宗族墓、纪念墓
    /// 
    /// ### 设计理念
    /// - **真实需求**：家族墓可能容纳几十人甚至上百人
    /// - **经济保护**：每人约10 MEMO成本，天然防止恶意填充
    /// - **性能可控**：前端分页加载，大墓位体验良好
    /// 
    /// ### 典型场景
    /// - 家庭墓：3-6人
    /// - 家族墓：10-50人
    /// - 宗族墓：50-200人
    /// - 纪念墓：数百至数千人
    /// - 公墓：无限制
    /// 
    /// ### 性能考虑
    /// - Storage：1000人仅8KB，完全可接受
    /// - 查询：前端分页加载（每页20人）
    /// - 监控：告警超大墓位（>1000人）
    pub type DeceasedByGrave<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::GraveId,
        Vec<T::DeceasedId>,  // ✅ 改为Vec，无容量限制
        OptionQuery,  // ✅ 改为OptionQuery，因为Vec没有MaxEncodedLen
    >;

    /// 函数级中文注释：逝者可见性标记（默认公开）。
    /// - 设计：创建时写入 true；后续可由管理员/owner 通过 set_visibility 修改。
    /// - 读取：若不存在记录（None）应视作 true（默认公开）。
    #[pallet::storage]
    pub type VisibilityOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, bool, OptionQuery>;

    /// 函数级中文注释：按 `deceased_token` 建立的唯一索引，用于防止重复创建。
    /// - Key：`deceased_token`（BoundedVec<u8, TokenLimit>）。
    /// - Val：`DeceasedId`。
    /// - 说明：在 create/update 时分别插入与维护，禁止同 token 的重复记录。
    #[pallet::storage]
    pub type DeceasedIdByToken<T: Config> =
        StorageMap<_, Blake2_128Concat, BoundedVec<u8, T::TokenLimit>, T::DeceasedId, OptionQuery>;

    /// 函数级中文注释：最近活跃块高（owner 对该逝者的最近一次有效签名交互）。
    #[pallet::storage]
    pub type LastActiveOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, BlockNumberFor<T>, OptionQuery>;

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
        /// 函数级中文注释：关系提案已被发起方撤回 (from, to, kind)
        RelationProposalCancelled(T::DeceasedId, T::DeceasedId, u8),
        /// 逝者关系：已撤销
        RelationRevoked(T::DeceasedId, T::DeceasedId),
        /// 逝者关系：备注更新
        RelationUpdated(T::DeceasedId, T::DeceasedId),
        /// 函数级中文注释：主图已更新（增强版）
        /// - deceased_id: 逝者ID
        /// - operator: 操作者账户（owner）
        /// - is_set: true=设置/修改，false=清空
        MainImageUpdated(T::DeceasedId, T::AccountId, bool),
        /// 函数级中文注释：治理证据已记录 (id, evidence_cid)。
        GovEvidenceNoted(T::DeceasedId, BoundedVec<u8, T::TokenLimit>),
        /// 函数级中文注释：治理设置主图（Some 设置；None 清空）。
        GovMainImageSet(T::DeceasedId, bool),
        /// 函数级中文注释：治理已转移拥有者（id, old_owner, new_owner）。
        OwnerTransferred(T::DeceasedId, T::AccountId, T::AccountId),
        /// 函数级中文注释：IPFS自动pin成功
        /// - deceased_id: 逝者ID
        /// - cid: 被pin的CID
        /// - pin_type: pin类型（0=name_full_cid, 1=main_image_cid）
        AutoPinSuccess(T::DeceasedId, BoundedVec<u8, T::TokenLimit>, u8),
        /// 函数级中文注释：IPFS自动pin失败
        /// - deceased_id: 逝者ID
        /// - cid: 尝试pin的CID
        /// - pin_type: pin类型（0=name_full_cid, 1=main_image_cid）
        /// - error_code: 错误码（0=未知, 1=余额不足, 2=网络错误, 3=CID无效）
        AutoPinFailed(T::DeceasedId, BoundedVec<u8, T::TokenLimit>, u8, u8),
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 墓位不存在
        GraveNotFound,
        /// 无权限操作
        NotAuthorized,
        /// 函数级中文注释：非逝者owner（需求2）
        /// - 场景：仅逝者owner可以转让owner或执行特定操作
        /// - 区别于 NotAuthorized：更精确的权限错误，明确指出调用者不是逝者owner
        NotDeceasedOwner,
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
        /// 函数级中文注释：关系功能——权限不足：只有提案接收方的管理员可以批准/拒绝提案
        /// - 场景：当提案发起方的管理员误调用 approve_relation 或 reject_relation 时返回此错误
        /// - 解释：approve/reject 操作必须由提案参数中 `to` 对应逝者的墓位管理员执行
        NotProposalResponder,
    }

    // 存储版本常量（用于 FRAME v2 storage_version 宏传参）
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(6);

    /// 函数级详细中文注释：禁用存储信息生成（因为使用Vec无界集合）
    /// 
    /// ### 原因
    /// - `DeceasedByGrave` 使用 `Vec<DeceasedId>` 替代 `BoundedVec`
    /// - Vec 没有 `MaxEncodedLen` trait（无法计算最大编码长度）
    /// - 需要禁用 storage info 生成
    /// 
    /// ### 影响
    /// - 无法自动计算 pallet 的最大存储大小
    /// - 不影响功能，仅影响元数据
    /// 
    /// ### 风险控制
    /// - 经济成本：每人约10 MEMO，天然限制
    /// - 监控告警：超大墓位（>1000人）人工审核
    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    #[pallet::without_storage_info]  // ✅ 禁用存储信息（因为Vec无MaxEncodedLen）
    pub struct Pallet<T>(_);

    /// 函数级中文注释：最近一次拥有者变更日志（用于前端展示与审计）。
    /// - 写入于治理转移成功后；仅保留最近一次，历史可由事件索引层查询。
    #[pallet::storage]
    pub type OwnerChangeLogOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        (
            T::AccountId,
            T::AccountId,
            BlockNumberFor<T>,
            BoundedVec<u8, T::TokenLimit>,
        ),
        OptionQuery,
    >;

    /// 函数级中文注释：版本历史条目（version, editor, at）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct VersionEntry<T: Config> {
        pub version: u32,
        pub editor: T::AccountId,
        pub at: BlockNumberFor<T>,
    }

    /// 函数级中文注释：逝者版本历史（最多 512 条，超出后停止追加）。
    #[pallet::storage]
    pub type DeceasedHistory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<VersionEntry<T>, ConstU32<512>>,
        ValueQuery,
    >;

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
    /// 函数级详细中文注释：亲友角色枚举
    /// 
    /// ### 角色说明
    /// - **Member (0)**：普通成员，可查看公开资料、关注逝者
    /// - **Core (1)**：核心成员，标识亲密关系（未来可扩展特殊权限）
    /// 
    /// ### 设计理念
    /// - ✅ 简化设计：删除 Admin 角色，避免权限争夺和复杂度
    /// - ✅ 唯一管理者：owner（通过 `DeceasedOf.owner`）是唯一管理者
    /// - ✅ 社交层面：Member/Core 仅用于区分关系亲疏
    /// 
    /// ### 未来扩展
    /// - Core 可能用于投票权、特殊权限、宠物养成游戏等
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub enum FriendRole {
        Member,  // 0：普通成员
        Core,    // 1：核心成员
    }

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
    pub type FriendPolicyOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, FriendPolicy<T>, OptionQuery>;

    /// 亲友成员： (DeceasedId, AccountId) -> FriendRecord
    #[pallet::storage]
    pub type FriendsOf<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        Blake2_128Concat,
        T::AccountId,
        FriendRecord<T>,
        OptionQuery,
    >;

    /// 亲友计数： DeceasedId -> u32
    #[pallet::storage]
    pub type FriendCount<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, u32, ValueQuery>;

    /// 待审批： DeceasedId -> BoundedVec<(AccountId, BlockNumber), ConstU32<256>>
    #[pallet::storage]
    pub type FriendJoinRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<(T::AccountId, BlockNumberFor<T>), ConstU32<256>>,
        ValueQuery,
    >;

    #[pallet::storage]
    pub type Relations<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        Blake2_128Concat,
        T::DeceasedId,
        Relation<T>,
        OptionQuery,
    >;

    #[pallet::storage]
    pub type RelationsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<(T::DeceasedId, u8), ConstU32<128>>,
        ValueQuery,
    >;

    #[pallet::storage]
    pub type PendingRelationRequests<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        Blake2_128Concat,
        T::DeceasedId,
        (
            u8,
            T::AccountId,
            BoundedVec<u8, T::StringLimit>,
            BlockNumberFor<T>,
        ),
        OptionQuery,
    >;

    /// 函数级详细中文注释：关系工具函数与规范
    /// - 0=ParentOf(有向) 1=SpouseOf(无向) 2=SiblingOf(无向) 3=ChildOf(有向)
    fn is_undirected_kind(kind: u8) -> bool {
        matches!(kind, 1 | 2)
    }

    /// 函数级详细中文注释：关系冲突矩阵（最小实现）
    /// - 父母/子女 与 配偶/兄弟姐妹 互斥；父母 与 子女 互斥（方向相反视为同类）
    fn is_conflicting_kind(a: u8, b: u8) -> bool {
        let dir_a = matches!(a, 0 | 3);
        let dir_b = matches!(b, 0 | 3);
        if dir_a && dir_b {
            return true;
        }
        if (dir_a && is_undirected_kind(b)) || (dir_b && is_undirected_kind(a)) {
            return true;
        }
        false
    }

    /// 函数级详细中文注释：对无向关系使用 canonical(min,max) 键；有向关系保持 (from,to) 原样
    fn canonical_ids<TC: Config>(
        from: TC::DeceasedId,
        to: TC::DeceasedId,
        kind: u8,
    ) -> (TC::DeceasedId, TC::DeceasedId) {
        if is_undirected_kind(kind) {
            let af: u128 = from.saturated_into::<u128>();
            let bf: u128 = to.saturated_into::<u128>();
            if af <= bf {
                (from, to)
            } else {
                (to, from)
            }
        } else {
            (from, to)
        }
    }

    // =================== Pallet 工具函数（非外部可调用） ===================
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：判断账户是否为该逝者的管理员
        /// 
        /// ### 权限模型
        /// - **唯一管理者**：逝者的 owner（通过 `DeceasedOf.owner` 字段）
        /// - **管理权限来源**：`DeceasedOf.owner`，不依赖于亲友团角色
        /// 
        /// ### 设计理念
        /// - ✅ 简化设计：删除 Admin 角色，避免权限争夺
        /// - ✅ 责任明确：owner 是唯一管理者，无需授权
        /// - ✅ 避免冲突：无多人管理，无权限争夺
        /// 
        /// ### 返回值
        /// - `true`：账户是该逝者的 owner
        /// - `false`：账户不是 owner，或逝者不存在
        pub(crate) fn is_admin(deceased_id: T::DeceasedId, who: &T::AccountId) -> bool {
            if let Some(d) = DeceasedOf::<T>::get(deceased_id) {
                d.owner == *who
            } else {
                false
            }
        }

        /// 函数级详细中文注释：确保调用者是逝者的 owner
        /// 
        /// ### 功能说明
        /// 统一的权限检查辅助函数，用于简化代码中的 owner 权限校验逻辑。
        /// 
        /// ### 设计目标
        /// - **统一模式**：避免代码中散落 `ensure!(d.owner == who, ...)` 的重复模式
        /// - **语义清晰**：`ensure_owner` 比 `is_admin` 更明确表达 "检查 owner" 的语义
        /// - **错误一致**：统一返回 `NotAuthorized` 错误，便于前端统一处理
        /// 
        /// ### 参数
        /// - `id`: 逝者记录ID
        /// - `who`: 待校验的账户
        /// 
        /// ### 返回
        /// - `Ok(())`: 账户是该逝者的 owner
        /// - `Err(NotAuthorized)`: 账户不是 owner，或逝者不存在
        /// 
        /// ### 使用场景
        /// - 修改逝者资料（update_deceased）
        /// - 设置主图（set_main_image）
        /// - 转让所有权（transfer_deceased）
        /// - 管理亲友团（leave_friend_group、kick_friend等）
        /// 
        /// ### 注意
        /// - 目前为工具函数，供未来代码重构使用
        /// - 在 try_mutate 内部的权限检查仍使用内联方式以避免重复存储读取
        #[allow(dead_code)]
        pub(crate) fn ensure_owner(
            id: T::DeceasedId,
            who: &T::AccountId,
        ) -> DispatchResult {
            DeceasedOf::<T>::get(id)
                .filter(|d| d.owner == *who)
                .map(|_| ())
                .ok_or(Error::<T>::NotAuthorized.into())
        }

        /// 函数级详细中文注释：治理起源统一校验入口。
        /// - 目的：将所有治理专用 extrinsic 的起源校验统一在本函数，避免各处散落导致错误不一致；
        /// - 行为：调用 `T::GovernanceOrigin::ensure_origin(origin)`；若失败，统一映射为本模块错误 `Error::<T>::NotAuthorized`；
        /// - 返回：成功则 Ok(())，失败返回模块内错误，便于前端与索引侧统一处理。
        fn ensure_gov(origin: OriginFor<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)
                .map(|_| ())
                .map_err(|_| Error::<T>::NotAuthorized.into())
        }

        /// 函数级中文注释（内部工具）：将证据 CID 记入事件，返回有界向量。
        pub(crate) fn note_evidence(
            id: T::DeceasedId,
            cid: Vec<u8>,
        ) -> Result<BoundedVec<u8, T::TokenLimit>, sp_runtime::DispatchError> {
            let bv: BoundedVec<u8, T::TokenLimit> =
                BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
            Self::deposit_event(Event::GovEvidenceNoted(id, bv.clone()));
            Ok(bv)
        }

        /// 函数级中文注释：更新"最近活跃时间"——在任何针对该逝者的签名写操作成功后调用。
        #[inline]
        pub(crate) fn touch_last_active(id: T::DeceasedId) {
            let now = <frame_system::Pallet<T>>::block_number();
            LastActiveOf::<T>::insert(id, now);
        }

        /// 函数级详细中文注释：规范化姓名（用于deceased_token生成）
        /// 
        /// ### 功能说明
        /// 统一处理姓名字符串，确保不同写法的同名人生成相同的token。
        /// 
        /// ### 处理规则
        /// 1. **去除首部空格**：跳过所有前导空白
        /// 2. **压缩连续空格**：多个空格压缩为单个空格
        /// 3. **ASCII小写转大写**：a-z → A-Z（仅处理ASCII，其他字符保持）
        /// 4. **去除尾部空格**：删除所有尾随空白
        /// 
        /// ### 示例
        /// ```
        /// "  John   Doe  " → "JOHN DOE"
        /// "李明  " → "李明"
        /// "mary-jane" → "MARY-JANE"
        /// ```
        /// 
        /// ### 用途
        /// - create_deceased: 生成初始token
        /// - update_deceased: 更新后重新生成token
        /// - gov_update_profile: 治理更新后重新生成token
        /// 
        /// ### 参数
        /// - `bytes`: 原始姓名字节（UTF-8编码）
        /// 
        /// ### 返回
        /// - 规范化后的姓名字节向量
        pub(crate) fn normalize_name(bytes: &[u8]) -> Vec<u8> {
            let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
            let mut i = 0usize;
            
            // 1. 跳过首部空格
            while i < bytes.len() && bytes[i] == b' ' {
                i += 1;
            }
            
            // 2. 处理中间字符：压缩空格 + ASCII小写转大写
            let mut last_space = false;
            while i < bytes.len() {
                let mut b = bytes[i];
                if b == b' ' {
                    // 连续空格只保留第一个
                    if !last_space {
                        out.push(b' ');
                        last_space = true;
                    }
                } else {
                    // ASCII小写字母转大写（a-z → A-Z）
                    if (b'a'..=b'z').contains(&b) {
                        b = b - 32;
                    }
                    out.push(b);
                    last_space = false;
                }
                i += 1;
            }
            
            // 3. 去除尾部空格
            while out.last().copied() == Some(b' ') {
                out.pop();
            }
            
            out
        }

        /// 函数级详细中文注释：从逝者字段构建唯一token
        /// 
        /// ### 功能说明
        /// 根据性别、出生日期、离世日期、姓名生成49字节的唯一标识token。
        /// 用于去重检查和跨墓位迁移时保持身份一致性。
        /// 
        /// ### Token格式（49字节）
        /// ```
        /// +--------+----------+----------+----------------+
        /// | Gender | Birth    | Death    | Name Hash      |
        /// | 1 byte | 8 bytes  | 8 bytes  | 32 bytes       |
        /// +--------+----------+----------+----------------+
        /// ```
        /// 
        /// **详细说明**：
        /// 1. **性别代码**（1 byte）：M/F/B（男/女/保密）
        /// 2. **出生日期**（8 bytes）：YYYYMMDD格式，缺失时用"00000000"
        /// 3. **离世日期**（8 bytes）：YYYYMMDD格式，缺失时用"00000000"
        /// 4. **姓名哈希**（32 bytes）：规范化后姓名的blake2_256哈希
        /// 
        /// ### 为什么用hash而非明文姓名？
        /// - 隐私保护：避免姓名明文直接暴露在token中
        /// - 长度固定：无论姓名多长，token始终49字节
        /// - 唯一性：blake2_256保证极低碰撞率
        /// 
        /// ### 使用场景
        /// - **create_deceased**: 创建时生成初始token
        /// - **update_deceased**: 更新姓名/日期后重新生成
        /// - **gov_update_profile**: 治理更新后重新生成
        /// - **去重检查**: 通过DeceasedIdByToken索引避免重复创建
        /// 
        /// ### 参数
        /// - `gender`: 性别枚举
        /// - `birth_ts`: 出生日期（可选，8字节YYYYMMDD）
        /// - `death_ts`: 离世日期（可选，8字节YYYYMMDD）
        /// - `name`: 姓名（BoundedVec）
        /// 
        /// ### 返回
        /// - 49字节的BoundedVec token（失败时返回空向量）
        pub(crate) fn build_deceased_token(
            gender: &Gender,
            birth_ts: &Option<BoundedVec<u8, T::StringLimit>>,
            death_ts: &Option<BoundedVec<u8, T::StringLimit>>,
            name: &BoundedVec<u8, T::StringLimit>,
        ) -> BoundedVec<u8, T::TokenLimit> {
            // 1. 规范化姓名并计算blake2_256哈希
            let name_norm = Self::normalize_name(name.as_slice());
            let name_hash = blake2_256(name_norm.as_slice());
            
            // 2. 组装token向量（预分配容量：1+8+8+32=49字节）
            let mut v: Vec<u8> = Vec::with_capacity(1 + 8 + 8 + 32);
            
            // 2.1 性别代码（1字节）- 使用Gender::to_byte()方法统一转换
            v.push(gender.to_byte());
            
            // 2.2 出生日期（8字节，缺失时用"00000000"）
            let zeros8: [u8; 8] = *b"00000000";
            let birth_bytes = birth_ts
                .as_ref()
                .map(|x| x.as_slice())
                .filter(|s| s.len() == 8)  // 仅使用有效的8字节日期
                .unwrap_or(&zeros8);
            v.extend_from_slice(birth_bytes);
            
            // 2.3 离世日期（8字节，缺失时用"00000000"）
            let death_bytes = death_ts
                .as_ref()
                .map(|x| x.as_slice())
                .filter(|s| s.len() == 8)  // 仅使用有效的8字节日期
                .unwrap_or(&zeros8);
            v.extend_from_slice(death_bytes);
            
            // 2.4 姓名哈希（32字节）
            v.extend_from_slice(&name_hash);
            
            // 3. 转换为BoundedVec（失败时返回空向量）
            BoundedVec::<u8, T::TokenLimit>::try_from(v).unwrap_or_default()
        }

        /// 函数级详细中文注释：自动pin CID到IPFS（容错处理）
        /// 
        /// 功能：
        /// - 使用triple-charge机制（IpfsPoolAccount → SubjectFunding → Caller）
        /// - 失败不阻塞业务，仅记录日志和发出事件
        /// - 发出链上事件通知pin结果
        /// 
        /// 参数：
        /// - caller: 调用者账户（用于triple-charge的第3优先级扣费）
        /// - deceased_id: 逝者ID（用于SubjectFunding派生和事件）
        /// - cid: 要pin的CID
        /// - pin_type: pin类型（用于日志和事件）
        /// 
        /// 事件：
        /// - AutoPinSuccess: pin成功
        /// - AutoPinFailed: pin失败（包含错误码）
        fn auto_pin_cid(
            caller: T::AccountId,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
            pin_type: AutoPinType,
        ) {
            let deceased_id_u64: u64 = deceased_id.saturated_into::<u64>();
            
            let pin_type_code = match pin_type {
                AutoPinType::NameFullCid => 0u8,
                AutoPinType::MainImage => 1u8,
            };
            
            let type_str = match pin_type {
                AutoPinType::NameFullCid => "name_full_cid",
                AutoPinType::MainImage => "main_image_cid",
            };
            
            // 尝试自动pin
            match T::IpfsPinner::pin_cid_for_grave(
                caller.clone(),
                deceased_id_u64,
                cid.clone(),
                None, // 使用默认Standard层级（3副本）
            ) {
                Ok(_) => {
                    // 成功：转换CID为BoundedVec并发出事件
                    if let Ok(cid_bv) = BoundedVec::<u8, T::TokenLimit>::try_from(cid.clone()) {
                        Self::deposit_event(Event::AutoPinSuccess(
                            deceased_id,
                            cid_bv,
                            pin_type_code,
                        ));
                    }
                    
                    log::info!(
                        target: "deceased",
                        "Auto-pin success: deceased={:?}, type={}, caller={:?}",
                        deceased_id,
                        type_str,
                        caller
                    );
                }
                Err(e) => {
                    // 失败：分析错误码并发出事件
                    let error_code = Self::map_pin_error(&e);
                    
                    // 发出失败事件
                    if let Ok(cid_bv) = BoundedVec::<u8, T::TokenLimit>::try_from(cid.clone()) {
                        Self::deposit_event(Event::AutoPinFailed(
                            deceased_id,
                            cid_bv,
                            pin_type_code,
                            error_code,
                        ));
                    }
                    
                    log::warn!(
                        target: "deceased",
                        "Auto-pin failed: deceased={:?}, type={}, caller={:?}, error={:?}, code={}",
                        deceased_id,
                        type_str,
                        caller,
                        e,
                        error_code
                    );
                }
            }
        }

        /// 函数级详细中文注释：将pin错误映射为简化的错误码
        /// 
        /// 错误码定义：
        /// - 0: 未知错误
        /// - 1: 余额不足（任何余额相关错误）
        /// - 2: IPFS网络错误或系统错误
        /// - 3: CID格式无效或参数错误
        /// 
        /// pallet_memo_ipfs::Error 映射表：
        /// - BadParams (0) → 3 (CID格式无效)
        /// - BothAccountsInsufficientBalance (12) → 1 (余额不足)
        /// - IpfsPoolInsufficientBalance (13) → 1 (余额不足)
        /// - SubjectFundingInsufficientBalance (14) → 1 (余额不足)
        /// - AllThreeAccountsInsufficientBalance (15) → 1 (余额不足)
        /// - OrderNotFound (1) → 2 (系统错误)
        /// - OperatorNotFound (2) → 2 (系统错误)
        /// - DirectPinDisabled (11) → 2 (系统错误)
        /// - 其他错误 → 2 (网络错误/系统错误)
        /// 
        /// 实现说明：
        /// - 使用 module_err.error[0] 获取错误索引
        /// - 根据 pallet_memo_ipfs 的错误顺序进行映射
        /// - 非模块错误统一视为系统错误（错误码 2）
        fn map_pin_error(error: &sp_runtime::DispatchError) -> u8 {
            use sp_runtime::DispatchError;
            
            match error {
                DispatchError::Module(module_err) => {
                    // ✅ 从模块错误中提取error index
                    // module_err.error 是一个字节数组，第一个字节是错误索引
                    let error_index = module_err.error[0];
                    
                    // ✅ 根据 pallet_memo_ipfs::Error 的定义进行精确映射
                    match error_index {
                        // BadParams (0) - CID格式错误或其他参数错误
                        0 => 3,
                        
                        // 余额不足相关错误
                        12 => 1,  // BothAccountsInsufficientBalance
                        13 => 1,  // IpfsPoolInsufficientBalance
                        14 => 1,  // SubjectFundingInsufficientBalance
                        15 => 1,  // AllThreeAccountsInsufficientBalance
                        
                        // 其他模块错误视为系统错误/网络错误
                        _ => 2,
                    }
                }
                // 非模块错误视为系统错误
                _ => 2,
            }
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：创建逝者记录并挂接到墓位
        /// 
        /// ### 权限
        /// - `GraveProvider::can_attach(origin, grave_id)` 必须为真
        /// - 通常是墓主、墓位管理员或园区管理员
        /// 
        /// ### 功能说明
        /// - 创建新的逝者记录
        /// - 创建者自动成为逝者owner
        /// - 自动pin姓名和主图到IPFS
        /// 
        /// ### Owner权利保护（需求2）
        /// ⚠️ **重要**：创建者成为逝者owner后，墓主无法强制收回管理权
        /// - 墓主可以创建逝者，但创建后owner=墓主
        /// - 如果墓主将owner转让给他人，则无法强制收回（需要对方同意）
        /// - 这是需求2的核心设计：保护逝者owner权利
        /// 
        /// ### 参数说明
        /// - 安全：限制文本与链接长度；敏感信息仅存链下链接
        /// 
        /// ### 事件
        /// - DeceasedCreated
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::create())]
        pub fn create_deceased(
            origin: OriginFor<T>,
            grave_id: T::GraveId,
            name: Vec<u8>,
            // name_badge 已移除
            gender_code: u8, // 0=M,1=F,2=B
            // bio 移除：简介/悼词请使用 deceased-data::Life（IPFS CID）
            name_full_cid: Option<Vec<u8>>, // 可选：完整姓名的链下 CID
            birth_ts: Vec<u8>,              // 必填，格式 YYYYMMDD（8 位数字）
            death_ts: Vec<u8>,              // 必填，格式 YYYYMMDD（8 位数字）
            links: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                T::GraveProvider::grave_exists(grave_id),
                Error::<T>::GraveNotFound
            );
            ensure!(
                T::GraveProvider::can_attach(&who, grave_id),
                Error::<T>::NotAuthorized
            );
            
            // 删除冗余检查：容量上限由 BoundedVec::try_push 自动管理（硬上限6）
            // 不再需要手动检查软上限和缓存校验

            // 校验与规范化字段
            let name_bv: BoundedVec<_, <T as pallet::Config>::StringLimit> =
                BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            // name_badge 相关逻辑已移除
            // 使用Gender::from_code()方法统一转换
            let gender: Gender = Gender::from_code(gender_code);
            // 校验日期：若提供则必须为 8 位数字
            fn is_yyyymmdd(v: &Vec<u8>) -> bool {
                v.len() == 8 && v.iter().all(|b| (b'0'..=b'9').contains(b))
            }
            ensure!(is_yyyymmdd(&birth_ts), Error::<T>::BadInput);
            ensure!(is_yyyymmdd(&death_ts), Error::<T>::BadInput);
            let birth_bv: Option<BoundedVec<_, <T as pallet::Config>::StringLimit>> =
                Some(BoundedVec::try_from(birth_ts).map_err(|_| Error::<T>::BadInput)?);
            let death_bv: Option<BoundedVec<_, <T as pallet::Config>::StringLimit>> =
                Some(BoundedVec::try_from(death_ts).map_err(|_| Error::<T>::BadInput)?);
            // 可选 CID 校验（仅限长度）
            let name_full_cid_bv: Option<BoundedVec<u8, T::TokenLimit>> = match name_full_cid {
                Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                None => None,
            };
            
            // 函数级中文注释：提前克隆CID用于后续自动pin（避免move问题）
            let cid_for_pin = name_full_cid_bv.as_ref().map(|bv| bv.clone().into_inner());

            let mut links_bv: BoundedVec<
                BoundedVec<u8, <T as pallet::Config>::StringLimit>,
                T::MaxLinks,
            > = Default::default();
            for l in links.into_iter() {
                let lb: BoundedVec<_, <T as pallet::Config>::StringLimit> =
                    BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
            }

            let id = NextDeceasedId::<T>::get();
            let next = id
                .checked_add(&<T as pallet::Config>::DeceasedId::from(1u32))
                .ok_or(Error::<T>::Overflow)?;
            NextDeceasedId::<T>::put(next);

            let now: BlockNumberFor<T> = <frame_system::Pallet<T>>::block_number();
            // 构造 token：使用Pallet级公共函数（已提取）
            let deceased_token = Self::build_deceased_token(&gender, &birth_bv, &death_bv, &name_bv);
            // 唯一性检查：同 token 已存在则拒绝创建
            ensure!(
                DeceasedIdByToken::<T>::get(&deceased_token).is_none(),
                Error::<T>::DeceasedTokenExists
            );
            let deceased = Deceased::<T> {
                grave_id,
                owner: who.clone(),
                creator: who.clone(),
                name: name_bv,

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
                version: 1,
            };

            DeceasedOf::<T>::insert(id, deceased);
            // 初始化版本历史
            let mut hist: BoundedVec<VersionEntry<T>, ConstU32<512>> = Default::default();
            let _ = hist.try_push(VersionEntry {
                version: 1,
                editor: who.clone(),
                at: now,
            });
            DeceasedHistory::<T>::insert(id, hist);
            
            // ✅ 墓位容量无限制：直接push，支持家族墓
            DeceasedByGrave::<T>::mutate(grave_id, |maybe_list| {
                if let Some(list) = maybe_list {
                    list.push(id);
                } else {
                    *maybe_list = Some(vec![id]);
                }
            });
            
            // 默认公开
            VisibilityOf::<T>::insert(id, true);
            // 建立 token -> id 索引
            if let Some(d) = DeceasedOf::<T>::get(id) {
                DeceasedIdByToken::<T>::insert(d.deceased_token, id);
            }

            // 由运行时或外部服务初始化 Life（去耦合：本 pallet 不直接依赖 deceased-data）。

            // 自动pin name_full_cid到IPFS（如果提供）
            if let Some(cid_vec) = cid_for_pin {
                Self::auto_pin_cid(
                    who.clone(),
                    id,
                    cid_vec,
                    AutoPinType::NameFullCid,
                );
            }

            // ⭐ Phase 1.5：同步Interments记录（解决P0问题1）
            // - 问题：Interments与DeceasedByGrave不同步
            // - 解决：创建逝者后自动记录安葬
            // - 注意：权限已检查，容量已检查，直接记录
            use sp_runtime::traits::UniqueSaturatedInto;
            let deceased_id_u64: u64 = id.unique_saturated_into();
            T::GraveProvider::record_interment(
                grave_id,
                deceased_id_u64,
                None,       // slot: 自动分配
                None,       // note_cid: 无备注
            )?;

            Self::deposit_event(Event::DeceasedCreated(id, grave_id, who));
            // 最近活跃：创建即记录
            Self::touch_last_active(id);
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
            // name_badge: Option<Vec<u8>>, // 已移除
            gender_code: Option<u8>,
            // bio 已移除
            name_full_cid: Option<Option<Vec<u8>>>,
            birth_ts: Option<Option<Vec<u8>>>,
            death_ts: Option<Option<Vec<u8>>>,
            links: Option<Vec<Vec<u8>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 函数级中文注释：提取name_full_cid用于后续自动pin
            // - Some(Some(vec)): 设置新CID，需要pin
            // - Some(None): 清空，不pin
            // - None: 不修改，不pin
            let cid_to_pin: Option<Vec<u8>> = match &name_full_cid {
                Some(Some(v)) => Some(v.clone()),
                _ => None,
            };
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                ensure!(d.owner == who, Error::<T>::NotAuthorized);
                // 捕获初始 owner，保证不可变更
                let original_owner = d.owner.clone();
                // 记录旧 token 以便更新索引
                let old_token = d.deceased_token.clone();

                if let Some(n) = name {
                    d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?;
                }
                // name_badge 已移除
                if let Some(gc) = gender_code {
                    // 使用Gender::from_code()方法统一转换
                    d.gender = Gender::from_code(gc);
                }
                // bio 已移除：改由 deceased-data::Life 维护
                if let Some(cid_opt) = name_full_cid {
                    d.name_full_cid = match cid_opt {
                        Some(v) => Some(
                            BoundedVec::<u8, T::TokenLimit>::try_from(v)
                                .map_err(|_| Error::<T>::BadInput)?,
                        ),
                        None => None,
                    };
                }
                // 主图字段通过专用接口设置/清空（见 set_main_image/clear_main_image）
                if let Some(bi) = birth_ts {
                    d.birth_ts = match bi {
                        Some(v) => {
                            ensure!(
                                v.len() == 8 && v.iter().all(|x| (b'0'..=b'9').contains(x)),
                                Error::<T>::BadInput
                            );
                            Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?)
                        }
                        None => None,
                    };
                }
                if let Some(de) = death_ts {
                    d.death_ts = match de {
                        Some(v) => {
                            ensure!(
                                v.len() == 8 && v.iter().all(|x| (b'0'..=b'9').contains(x)),
                                Error::<T>::BadInput
                            );
                            Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?)
                        }
                        None => None,
                    };
                }
                if let Some(ls) = links {
                    let mut links_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks> =
                        Default::default();
                    for l in ls.into_iter() {
                        let lb: BoundedVec<_, T::StringLimit> =
                            BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                        links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    d.links = links_bv;
                }
                d.updated = <frame_system::Pallet<T>>::block_number();
                // 版本自增并记录历史
                d.version = d.version.saturating_add(1);
                let v = d.version;
                let at = d.updated;
                DeceasedHistory::<T>::mutate(id, |h| {
                    let _ = h.try_push(VersionEntry {
                        version: v,
                        editor: who.clone(),
                        at,
                    });
                });
                // 重新构造 token：使用Pallet级公共函数（已提取）
                let new_token = Self::build_deceased_token(&d.gender, &d.birth_ts, &d.death_ts, &d.name);
                // 若 token 发生变化，需检查唯一性并更新索引
                if new_token != old_token {
                    if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) {
                        // 已存在同 token 且不是当前记录 → 拒绝
                        if existing_id != id {
                            return Err(Error::<T>::DeceasedTokenExists.into());
                        }
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

            // 自动pin更新的name_full_cid到IPFS
            if let Some(cid_vec) = cid_to_pin {
                Self::auto_pin_cid(
                    who.clone(),
                    id,
                    cid_vec,
                    AutoPinType::NameFullCid,
                );
            }

            Self::deposit_event(Event::DeceasedUpdated(id));
            Self::touch_last_active(id);
            Ok(())
        }

        /// 函数级中文注释：删除逝者（已禁用）。
        /// 
        /// ### 功能说明
        /// 为保证历史可追溯与家族谱系稳定，本 Pallet **永久禁止**删除已创建的逝者记录。
        /// 此函数保留接口签名以兼容旧的前端/脚本调用，但始终返回 `DeletionForbidden` 错误。
        /// 
        /// ### 设计原则
        /// - 📜 **合规要求**：逝者信息属于历史记录，删除可能违反数据保护法规
        /// - 🔗 **关系稳定**：删除逝者会破坏家族谱系（Relations）的完整性
        /// - 🔍 **审计追溯**：保留所有历史记录用于争议解决
        /// 
        /// ### 替代方案
        /// 如需"移除"逝者，请考虑以下方式：
        /// 1. **迁移墓位**：调用 `transfer_deceased(id, new_grave)` 转移到私密墓位
        /// 2. **设置隐私**：调用 `set_visibility(id, false)` 设为不公开
        /// 3. **清空信息**：调用 `update_deceased` 清空敏感字段（保留关系结构）
        /// 
        /// ### 参数
        /// - `origin`: 交易发起者（任何签名账户均可调用）
        /// - `id`: 逝者ID（参数会被忽略，仅保留接口兼容性）
        /// 
        /// ### 错误
        /// - `DeletionForbidden`: 始终返回此错误
        /// 
        /// ### 权重
        /// 极低（仅检查签名 + 返回错误）
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::remove())]
        pub fn remove_deceased(
            origin: OriginFor<T>,
            _id: T::DeceasedId,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;
            // 永久禁止删除操作，始终返回错误
            Err(Error::<T>::DeletionForbidden.into())
        }

        /// 函数级详细中文注释：迁移逝者到新的墓位（需求3：仅owner可迁墓）
        /// 
        /// ### 权限（核心设计）
        /// - **仅逝者owner**：只有逝者owner可以迁移逝者（需求3核心）
        /// - **墓主无权**：墓主不能强制迁移逝者
        /// 
        /// ### 功能说明
        /// - 将逝者从当前墓位迁移到目标墓位
        /// - 不影响逝者owner
        /// - 不影响亲友团和关系网络
        /// 
        /// ### 前置条件
        /// - 目标墓位必须存在
        /// - 目标墓位容量未满（硬上限6，由BoundedVec自动管理）
        /// 
        /// ### 使用场景
        /// - 逝者owner对当前墓位不满意，迁移到更好的墓位
        /// - 配合需求1：墓主要转让墓位，逝者owner先迁出
        /// - 市场流动性：逝者可自由选择墓位
        /// 
        /// ### 事件
        /// - DeceasedTransferred(id, old_grave, new_grave)
        /// 
        /// ### 注意事项
        /// ⚠️ **重要**：删除了墓位权限检查（需求3核心）
        /// ✅ **Phase 1.5**：已添加墓位准入策略检查（解决P0问题2）
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::transfer())]
        pub fn transfer_deceased(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            new_grave: T::GraveId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查目标墓位存在
            ensure!(
                T::GraveProvider::grave_exists(new_grave),
                Error::<T>::GraveNotFound
            );
            
            // ⭐ Phase 1.5：准入策略检查（解决P0问题2）
            // - 问题：逝者可以强行挤入私人墓位
            // - 解决：检查墓位的准入策略
            // - 设计：平衡需求3（逝者自由迁移）与墓主控制权
            // - 策略：OwnerOnly（默认）/ Public / Whitelist
            T::GraveProvider::check_admission_policy(&who, new_grave)?;
            
            // ⭐ 需求3核心：删除墓位权限检查（墓主无法强制迁移）
            // 原代码（已删除）：
            // ensure!(
            //     T::GraveProvider::can_attach(&who, new_grave),
            //     Error::<T>::NotAuthorized
            // );
            
            // 删除软上限检查：容量由 BoundedVec::try_push 自动管理（硬上限6）

            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                
                // ⭐ 需求3核心：仅逝者owner可迁移
                ensure!(d.owner == who, Error::<T>::NotDeceasedOwner);
                let original_owner = d.owner.clone();
                
                // 记录旧墓位（用于后续同步）
                let old_grave = d.grave_id;

                // ✅ 墓位容量无限制：直接添加到新墓位
                DeceasedByGrave::<T>::mutate(new_grave, |maybe_list| {
                    if let Some(list) = maybe_list {
                        list.push(id);
                    } else {
                        *maybe_list = Some(vec![id]);
                    }
                });

                // 从旧墓位移除
                DeceasedByGrave::<T>::mutate(old_grave, |maybe_list| {
                    if let Some(list) = maybe_list {
                        if let Some(pos) = list.iter().position(|x| x == &id) {
                            list.swap_remove(pos);
                        }
                    }
                });

                d.grave_id = new_grave;
                d.updated = <frame_system::Pallet<T>>::block_number();
                ensure!(d.owner == original_owner, Error::<T>::OwnerImmutable);
                
                // ⭐ Phase 1.5：同步Interments记录（解决P0问题1）
                // - 问题：Interments与DeceasedByGrave不同步
                // - 解决：迁移时同步起掘和安葬记录
                use sp_runtime::traits::UniqueSaturatedInto;
                let deceased_id_u64: u64 = id.unique_saturated_into();
                
                // 1. 从旧墓位起掘
                T::GraveProvider::record_exhumation(old_grave, deceased_id_u64)?;
                
                // 2. 安葬到新墓位
                T::GraveProvider::record_interment(
                    new_grave,
                    deceased_id_u64,
                    None,  // slot: 自动分配
                    None,  // note_cid: 无备注
                )?;
                
                Self::deposit_event(Event::DeceasedTransferred(id, old_grave, new_grave));
                Self::touch_last_active(id);
                Ok(())
            })
        }

        /// 函数级详细中文注释：转让逝者owner（需求2：禁止墓主强制替换）
        /// 
        /// ### 权限（核心设计）
        /// - **仅逝者当前owner**：只有逝者owner本人可以转让
        /// - **墓主无权**：墓主不能强制替换逝者owner（需求2核心）
        /// - **治理路径**：治理操作请使用 `gov_transfer_owner`
        /// 
        /// ### 功能说明
        /// - 将逝者的管理权转让给其他账户
        /// - 记录owner变更历史（审计用）
        /// - 不影响墓位归属
        /// - 不影响亲友团和关系网络
        /// 
        /// ### 参数
        /// - `id`: 逝者ID
        /// - `new_owner`: 新的owner账户
        /// 
        /// ### 使用场景
        /// - 墓主授权他人管理逝者资料
        /// - 家族墓中不同分支管理自己的逝者
        /// - VIP服务（委托专业人员维护）
        /// 
        /// ### 事件
        /// - DeceasedOwnerTransferred(id, grave_id, old_owner, new_owner, transferred_by)
        /// 
        /// ### 注意事项
        /// ⚠️ **重要**：此函数删除了墓位权限检查，墓主无法强制转让
        #[pallet::call_index(30)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn transfer_deceased_owner(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            new_owner: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                
                // ⭐ 需求2核心：仅逝者owner可转让，删除墓位权限检查
                ensure!(d.owner == who, Error::<T>::NotDeceasedOwner);
                
                // 不允许转给自己
                ensure!(d.owner != new_owner, Error::<T>::BadInput);
                
                let old_owner = d.owner.clone();
                
                // 更新owner
                d.owner = new_owner.clone();
                d.updated = <frame_system::Pallet<T>>::block_number();
                d.version = d.version.saturating_add(1);
                
                // 记录变更日志（与gov_transfer_owner保持一致）
                let now = d.updated;
                // 使用空证据CID（普通用户转让不需要证据）
                let empty_cid = BoundedVec::default();
                OwnerChangeLogOf::<T>::insert(
                    id,
                    (old_owner.clone(), new_owner.clone(), now, empty_cid)
                );
                
                // 发送事件
                Self::deposit_event(Event::OwnerTransferred(id, old_owner, new_owner));
                Self::touch_last_active(id);
                
                Ok(())
            })
        }

        /// 函数级中文注释：设置逝者可见性（public=true 公开；false 私有）。仅 Admin（含 owner）。
        /// - 默认：创建时已设为公开；本接口用于按需关闭/开启展示。
        /// - 事件：VisibilityChanged(id, public)
        #[pallet::call_index(39)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn set_visibility(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                DeceasedOf::<T>::contains_key(id),
                Error::<T>::DeceasedNotFound
            );
            ensure!(Self::is_admin(id, &who), Error::<T>::NotAuthorized);
            VisibilityOf::<T>::insert(id, public);
            Self::deposit_event(Event::VisibilityChanged(id, public));
            Self::touch_last_active(id);
            Ok(())
        }

        /// 函数级中文注释：设置/修改逝者主图（CID）
        /// 
        /// 权限：仅逝者owner
        /// - 治理操作请使用 `gov_set_main_image`
        /// 
        /// 功能：
        /// - 更新主图CID
        /// - 自动pin到IPFS（使用triple-charge机制）
        /// 
        /// 事件：
        /// - MainImageUpdated(id, operator, true)
        /// - AutoPinSuccess / AutoPinFailed
        #[pallet::call_index(40)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn set_main_image(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 保存cid用于后续pin
            let cid_for_pin = cid.clone();
            
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                
                // 清晰的权限检查：仅owner
                ensure!(d.owner == who, Error::<T>::NotAuthorized);
                
                // 更新CID
                let bv: BoundedVec<u8, T::TokenLimit> =
                    BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?;
                d.main_image_cid = Some(bv);
                d.updated = <frame_system::Pallet<T>>::block_number();
                
                Ok(())
            })?;

            // 自动pin（使用统一的公共函数）
            Self::auto_pin_cid(
                who.clone(),
                id,
                        cid_for_pin,
                AutoPinType::MainImage,
            );

            // 增强的事件：包含操作者
            Self::deposit_event(Event::MainImageUpdated(id, who, true));
            Self::touch_last_active(id);
            Ok(())
        }

        /// 函数级中文注释：清空逝者主图
        /// 
        /// 权限：仅逝者owner
        /// - 治理操作请使用 `gov_set_main_image`
        /// 
        /// 事件：MainImageUpdated(id, operator, false)
        #[pallet::call_index(41)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn clear_main_image(
            origin: OriginFor<T>,
            id: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                
                // 清晰的权限检查：仅owner
                ensure!(d.owner == who, Error::<T>::NotAuthorized);
                
                d.main_image_cid = None;
                d.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            
            // 增强的事件：包含操作者
            Self::deposit_event(Event::MainImageUpdated(id, who, false));
            Self::touch_last_active(id);
            Ok(())
        }

        /// 函数级中文注释：【治理】设置/清空逝者主图（CID）。
        /// - 允许非 owner，通过治理路径强制修复头像内容；记录证据。
        #[pallet::call_index(45)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn gov_set_main_image(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            cid: Option<Vec<u8>>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            let is_some = cid.is_some();
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                d.main_image_cid = match cid {
                    Some(v) => Some(
                        BoundedVec::<u8, T::TokenLimit>::try_from(v)
                            .map_err(|_| Error::<T>::BadInput)?,
                    ),
                    None => None,
                };
                d.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::GovMainImageSet(id, is_some));
            Self::touch_last_active(id);
            Ok(())
        }

        // =================== 治理专用接口（gov*） ===================
        /// 函数级中文注释：治理转移拥有者（仅治理路径）。
        /// - 起源：T::GovernanceOrigin；需携带证据 CID（明文，不加密）。
        /// - 行为：写入证据事件；将 owner 设置为 new_owner；version+=1；写入 OwnerChangeLogOf；事件 OwnerTransferred。
        #[pallet::call_index(46)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn gov_transfer_owner(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            new_owner: T::AccountId,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let ev = Self::note_evidence(id, evidence_cid)?;
            let now = <frame_system::Pallet<T>>::block_number();
            let mut old_owner: Option<T::AccountId> = None;
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                let old = d.owner.clone();
                old_owner = Some(old.clone());
                ensure!(old != new_owner, Error::<T>::BadInput);
                d.owner = new_owner.clone();
                d.updated = now;
                d.version = d.version.saturating_add(1);
                Ok(())
            })?;
            // 写入最近一次变更日志并发出事件
            if let Some(old) = old_owner {
                OwnerChangeLogOf::<T>::insert(id, (old.clone(), new_owner.clone(), now, ev));
                Self::deposit_event(Event::OwnerTransferred(id, old, new_owner));
            }
            Ok(())
        }
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
            // name_badge: Option<Vec<u8>>, // 已移除
            gender_code: Option<u8>,
            name_full_cid: Option<Option<Vec<u8>>>,
            birth_ts: Option<Option<Vec<u8>>>,
            death_ts: Option<Option<Vec<u8>>>,
            links: Option<Vec<Vec<u8>>>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                let original_owner = d.owner.clone();
                let old_token = d.deceased_token.clone();
                if let Some(n) = name {
                    d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?;
                }
                // name_badge 已移除
                if let Some(gc) = gender_code {
                    // 使用Gender::from_code()方法统一转换
                    d.gender = Gender::from_code(gc);
                }
                if let Some(cid_opt) = name_full_cid {
                    d.name_full_cid = match cid_opt {
                        Some(v) => Some(
                            BoundedVec::<u8, T::TokenLimit>::try_from(v)
                                .map_err(|_| Error::<T>::BadInput)?,
                        ),
                        None => None,
                    };
                }
                if let Some(bi) = birth_ts {
                    d.birth_ts = match bi {
                        Some(v) => {
                            ensure!(
                                v.len() == 8 && v.iter().all(|x| (b'0'..=b'9').contains(x)),
                                Error::<T>::BadInput
                            );
                            Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?)
                        }
                        None => None,
                    };
                }
                if let Some(de) = death_ts {
                    d.death_ts = match de {
                        Some(v) => {
                            ensure!(
                                v.len() == 8 && v.iter().all(|x| (b'0'..=b'9').contains(x)),
                                Error::<T>::BadInput
                            );
                            Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?)
                        }
                        None => None,
                    };
                }
                if let Some(ls) = links {
                    let mut links_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks> =
                        Default::default();
                    for l in ls.into_iter() {
                        let lb: BoundedVec<_, T::StringLimit> =
                            BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                        links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    d.links = links_bv;
                }
                d.updated = <frame_system::Pallet<T>>::block_number();
                // 版本自增并记录历史（治理代表修改，编辑者记为当前 owner）
                d.version = d.version.saturating_add(1);
                let v = d.version;
                let at = d.updated;
                let editor = d.owner.clone();
                DeceasedHistory::<T>::mutate(id, |h| {
                    let _ = h.try_push(VersionEntry {
                        version: v,
                        editor,
                        at,
                    });
                });
                // 重建 token：使用Pallet级公共函数（已提取）
                let new_token = Self::build_deceased_token(&d.gender, &d.birth_ts, &d.death_ts, &d.name);
                if new_token != old_token {
                    if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) {
                        if existing_id != id {
                            return Err(Error::<T>::DeceasedTokenExists.into());
                        }
                    }
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
        pub fn gov_transfer_deceased(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            new_grave: T::GraveId,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            ensure!(
                T::GraveProvider::grave_exists(new_grave),
                Error::<T>::GraveNotFound
            );
            
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                let original_owner = d.owner.clone();
                
                // ✅ 墓位容量无限制：直接添加到新墓位
                DeceasedByGrave::<T>::mutate(new_grave, |maybe_list| {
                    if let Some(list) = maybe_list {
                        list.push(id);
                    } else {
                        *maybe_list = Some(vec![id]);
                    }
                });
                
                // 从旧墓位移除
                DeceasedByGrave::<T>::mutate(d.grave_id, |maybe_list| {
                    if let Some(list) = maybe_list {
                        if let Some(pos) = list.iter().position(|x| x == &id) {
                            list.swap_remove(pos);
                        }
                    }
                });
                
                let old = d.grave_id;
                d.grave_id = new_grave;
                d.updated = <frame_system::Pallet<T>>::block_number();
                ensure!(d.owner == original_owner, Error::<T>::OwnerImmutable);
                Self::deposit_event(Event::DeceasedTransferred(id, old, new_grave));
                Self::touch_last_active(id);
                Ok(())
            })
        }

        /// 函数级中文注释：治理设置可见性（不要求 owner/Admin）。
        #[pallet::call_index(44)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn gov_set_visibility(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            public: bool,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(id, evidence_cid)?;
            ensure!(
                DeceasedOf::<T>::contains_key(id),
                Error::<T>::DeceasedNotFound
            );
            VisibilityOf::<T>::insert(id, public);
            Self::deposit_event(Event::VisibilityChanged(id, public));
            Ok(())
        }
        /// 函数级详细中文注释：发起关系绑定提案
        /// 
        /// ### 功能说明
        /// 由 `from` 方向 `to` 方发起关系声明提案，等待对方管理员批准。
        /// 
        /// ### 参数说明
        /// - `from`: 提案发起方的逝者ID（必须是当前调用者有权管理的逝者）
        /// - `to`: 提案接收方的逝者ID（对方逝者）
        /// - `kind`: 关系类型（0=ParentOf, 1=SpouseOf, 2=SiblingOf, 3=ChildOf）
        /// - `note`: 可选的关系备注（长度限制由 StringLimit 配置）
        /// 
        /// ### 权限要求
        /// - 调用者必须是 `from` 对应逝者所在墓位的管理员
        /// - 通过 `GraveProvider::can_attach(caller, from.grave_id)` 判定
        /// 
        /// ### 关系类型与方向性
        /// - **有向关系**（0=ParentOf, 3=ChildOf）：`from → to` 有明确方向
        /// - **无向关系**（1=SpouseOf, 2=SiblingOf）：`from ↔ to` 对称关系
        /// 
        /// ### 后续流程
        /// 1. 本函数发起提案后，提案存储在 `PendingRelationRequests(from, to)`
        /// 2. `to` 方管理员调用 `approve_relation(from, to)` 批准提案
        /// 3. 或者 `to` 方管理员调用 `reject_relation(from, to)` 拒绝提案
        /// 4. ⚠️ 当前版本不支持发起方撤回提案（未来将提供 `cancel_relation_proposal`）
        /// 
        /// ### 去重与冲突检查
        /// - 如果关系已建立（`Relations` 中存在），返回 `RelationExists` 错误
        /// - 如果无向关系的反向提案已存在，返回 `PendingApproval` 错误
        /// - 如果与已有关系存在逻辑冲突（如父母↔配偶），返回 `BadRelationKind` 错误
        /// 
        /// ### 事件
        /// - `RelationProposed(from, to, kind)`: 提案成功发起
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn propose_relation(
            origin: OriginFor<T>,
            from: T::DeceasedId,
            to: T::DeceasedId,
            kind: u8,
            note: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let _b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(
                T::GraveProvider::can_attach(&who, a.grave_id),
                Error::<T>::NotAuthorized
            );
            ensure!(from != to, Error::<T>::BadInput);
            ensure!(matches!(kind, 0..=3), Error::<T>::BadRelationKind);
            // 去重：主记录存在则拒绝；无向需同时检查反向
            if Relations::<T>::contains_key(from, to) {
                return Err(Error::<T>::RelationExists.into());
            }
            if is_undirected_kind(kind) && Relations::<T>::contains_key(to, from) {
                return Err(Error::<T>::RelationExists.into());
            }
            // Pending 去重：无向需阻止反向重复提案
            if is_undirected_kind(kind) && PendingRelationRequests::<T>::contains_key(to, from) {
                return Err(Error::<T>::PendingApproval.into());
            }
            // 冲突：若另一方向已存在且冲突
            if let Some(r) = Relations::<T>::get(to, from) {
                if is_conflicting_kind(r.kind, kind) {
                    return Err(Error::<T>::BadRelationKind.into());
                }
            }
            let now = <frame_system::Pallet<T>>::block_number();
            let note_bv: BoundedVec<_, T::StringLimit> = match note {
                Some(v) => BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?,
                None => Default::default(),
            };
            PendingRelationRequests::<T>::insert(from, to, (kind, who, note_bv, now));
            Self::deposit_event(Event::RelationProposed(from, to, kind));
            Ok(())
        }

        /// 函数级详细中文注释：批准关系绑定提案
        /// 
        /// ### 功能说明
        /// 作为提案接收方（`to`）的管理员，批准由 `from` 发起的关系提案，正式建立关系。
        /// 
        /// ### 参数说明
        /// ⚠️ **重要**：这两个参数是**提案的标识符**，而非"操作的方向"
        /// - `from`: 提案发起方的逝者ID（不是当前调用者，是对方）
        /// - `to`: 提案接收方的逝者ID（**必须是当前调用者有权管理的逝者**）
        /// 
        /// ### 权限要求
        /// - 调用者必须是 `to` 对应逝者所在墓位的管理员
        /// - 通过 `GraveProvider::can_attach(caller, to.grave_id)` 判定
        /// - ⚠️ `from` 方管理员无权调用此函数，会返回 `NotProposalResponder` 错误
        /// 
        /// ### 参数理解示例
        /// ```
        /// 场景：张三（ID=100）向李四（ID=200）提出配偶关系
        /// 
        /// Step 1: 张三的管理员发起提案
        ///   propose_relation(from=100, to=200, kind=SpouseOf)
        /// 
        /// Step 2: 李四的管理员批准提案（本函数）
        ///   approve_relation(from=100, to=200)
        ///   // 参数含义：
        ///   // - from=100: 提案发起方（张三，对方）
        ///   // - to=200: 提案接收方（李四，我管理的逝者）
        ///   // - 调用者必须是李四的墓位管理员
        /// 
        /// ❌ 常见错误：张三的管理员误调用
        ///   approve_relation(from=100, to=200)
        ///   // 结果：NotProposalResponder 错误
        ///   // 原因：只有李四的管理员可以批准
        /// ```
        /// 
        /// ### 处理流程
        /// 1. 检查权限：确保调用者是 `to` 方墓位管理员
        /// 2. 读取提案：从 `PendingRelationRequests(from, to)` 获取提案详情
        /// 3. 二次冲突检查：防止并发导致的重复建立
        /// 4. 建立关系：将关系存入 `Relations` 和 `RelationsByDeceased` 索引
        /// 5. 清理提案：从 `PendingRelationRequests` 中移除
        /// 
        /// ### 关系存储规则
        /// - **无向关系**：使用 canonical 键 `(min(from,to), max(from,to))`，双方索引
        /// - **有向关系**：使用原始键 `(from, to)`，保持方向性
        /// 
        /// ### 错误处理
        /// - `DeceasedNotFound`: `to` 对应的逝者不存在
        /// - `NotProposalResponder`: 调用者不是 `to` 方的墓位管理员
        /// - `RelationNotFound`: 提案不存在（可能已被拒绝或撤回）
        /// - `RelationExists`: 关系已存在（可能被并发操作建立）
        /// - `BadRelationKind`: 与已有关系存在逻辑冲突
        /// 
        /// ### 事件
        /// - `RelationApproved(from, to, kind)`: 提案批准成功
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn approve_relation(
            origin: OriginFor<T>,
            from: T::DeceasedId,
            to: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(
                T::GraveProvider::can_attach(&who, b.grave_id),
                Error::<T>::NotProposalResponder
            );
            let (kind, created_by, note, _created_at) =
                PendingRelationRequests::<T>::get(from, to).ok_or(Error::<T>::RelationNotFound)?;
            // 二次防冲突：避免并发与方向不一致
            if Relations::<T>::contains_key(from, to) {
                return Err(Error::<T>::RelationExists.into());
            }
            if is_undirected_kind(kind) && Relations::<T>::contains_key(to, from) {
                return Err(Error::<T>::RelationExists.into());
            }
            if let Some(r) = Relations::<T>::get(to, from) {
                if is_conflicting_kind(r.kind, kind) {
                    return Err(Error::<T>::BadRelationKind.into());
                }
            }
            let now = <frame_system::Pallet<T>>::block_number();
            let rec = Relation::<T> {
                kind,
                note: note.clone(),
                created_by,
                since: now,
            };
            let (ff, tt) = canonical_ids::<T>(from, to, kind);
            Relations::<T>::insert(ff, tt, &rec);
            RelationsByDeceased::<T>::try_mutate(ff, |list| {
                list.try_push((tt, kind)).map_err(|_| Error::<T>::BadInput)
            })?;
            if is_undirected_kind(kind) && ff != tt {
                RelationsByDeceased::<T>::try_mutate(tt, |list| {
                    list.try_push((ff, kind)).map_err(|_| Error::<T>::BadInput)
                })?;
            }
            PendingRelationRequests::<T>::remove(from, to);
            Self::deposit_event(Event::RelationApproved(from, to, kind));
            Ok(())
        }

        /// 函数级详细中文注释：拒绝关系绑定提案
        /// 
        /// ### 功能说明
        /// 作为提案接收方（`to`）的管理员，拒绝由 `from` 发起的关系提案，提案将被删除。
        /// 
        /// ### 参数说明
        /// ⚠️ **重要**：这两个参数是**提案的标识符**，而非"操作的方向"
        /// - `from`: 提案发起方的逝者ID（不是当前调用者，是对方）
        /// - `to`: 提案接收方的逝者ID（**必须是当前调用者有权管理的逝者**）
        /// 
        /// ### 权限要求
        /// - 调用者必须是 `to` 对应逝者所在墓位的管理员
        /// - 通过 `GraveProvider::can_attach(caller, to.grave_id)` 判定
        /// - ⚠️ `from` 方管理员无权调用此函数，会返回 `NotProposalResponder` 错误
        /// - ⚠️ 与 `approve_relation` 的权限要求完全一致
        /// 
        /// ### 参数理解示例
        /// ```
        /// 场景：张三（ID=100）向李四（ID=200）提出配偶关系，李四拒绝
        /// 
        /// Step 1: 张三的管理员发起提案
        ///   propose_relation(from=100, to=200, kind=SpouseOf)
        /// 
        /// Step 2: 李四的管理员拒绝提案（本函数）
        ///   reject_relation(from=100, to=200)
        ///   // 参数含义：
        ///   // - from=100: 提案发起方（张三，对方）
        ///   // - to=200: 提案接收方（李四，我管理的逝者）
        ///   // - 调用者必须是李四的墓位管理员
        /// 
        /// ❌ 常见错误：张三的管理员误调用
        ///   reject_relation(from=100, to=200)
        ///   // 结果：NotProposalResponder 错误
        ///   // 原因：只有李四的管理员可以拒绝
        ///   // 张三想撤回提案？当前版本不支持，未来将提供 cancel_relation_proposal
        /// ```
        /// 
        /// ### 处理流程
        /// 1. 检查权限：确保调用者是 `to` 方墓位管理员
        /// 2. 检查提案：确认 `PendingRelationRequests(from, to)` 存在
        /// 3. 删除提案：从 `PendingRelationRequests` 中移除
        /// 4. 发出事件：通知提案被拒绝
        /// 
        /// ### 错误处理
        /// - `DeceasedNotFound`: `to` 对应的逝者不存在
        /// - `NotProposalResponder`: 调用者不是 `to` 方的墓位管理员
        /// - `RelationNotFound`: 提案不存在（可能已被批准、拒绝或撤回）
        /// 
        /// ### 事件
        /// - `RelationRejected(from, to)`: 提案拒绝成功
        /// 
        /// ### 与 approve_relation 的区别
        /// - **相同点**：权限要求完全一致，都需要 `to` 方管理员权限
        /// - **不同点**：approve 会建立关系并更新索引，reject 只删除提案
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn reject_relation(
            origin: OriginFor<T>,
            from: T::DeceasedId,
            to: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(
                T::GraveProvider::can_attach(&who, b.grave_id),
                Error::<T>::NotProposalResponder
            );
            ensure!(
                PendingRelationRequests::<T>::contains_key(from, to),
                Error::<T>::RelationNotFound
            );
            PendingRelationRequests::<T>::remove(from, to);
            Self::deposit_event(Event::RelationRejected(from, to));
            Ok(())
        }

        /// 函数级详细中文注释：发起方撤回关系提案
        /// 
        /// ### 功能说明
        /// 由提案发起方（`from`）主动撤回尚未被批准/拒绝的关系提案。
        /// 
        /// ### 参数说明
        /// - `from`: 提案发起方的逝者ID（必须是当前调用者有权管理的逝者）
        /// - `to`: 提案接收方的逝者ID（对方逝者）
        /// 
        /// ### 权限要求
        /// - 调用者必须是 `from` 对应逝者所在墓位的管理员
        /// - 通过 `GraveProvider::can_attach(caller, from.grave_id)` 判定
        /// - ⚠️ 只有提案发起方可以撤回，接收方无权调用此函数
        /// 
        /// ### 使用场景
        /// 1. **发现错误**：发起提案后发现参数错误（如关系类型选错、目标逝者ID错误）
        /// 2. **改变主意**：不再希望建立该关系
        /// 3. **对方长时间未响应**：提案发起后对方一直不批准也不拒绝，可撤回重新发起
        /// 
        /// ### 参数理解示例
        /// ```
        /// 场景：张三（ID=100）向李四（ID=200）发起配偶关系提案，后来发现搞错了，想撤回
        /// 
        /// Step 1: 张三的管理员发起提案
        ///   propose_relation(from=100, to=200, kind=SpouseOf)
        /// 
        /// Step 2: 张三发现错误，撤回提案（本函数）
        ///   cancel_relation_proposal(from=100, to=200)
        ///   // 参数含义：
        ///   // - from=100: 提案发起方（张三，我管理的逝者）
        ///   // - to=200: 提案接收方（李四，对方）
        ///   // - 调用者必须是张三的墓位管理员
        /// 
        /// ❌ 常见错误：李四的管理员误调用
        ///   cancel_relation_proposal(from=100, to=200)
        ///   // 结果：NotAuthorized 错误
        ///   // 原因：只有提案发起方（张三）的管理员可以撤回
        ///   // 李四想拒绝提案？应该调用 reject_relation
        /// ```
        /// 
        /// ### 与 reject_relation 的区别
        /// | 维度 | cancel_relation_proposal | reject_relation |
        /// |------|-------------------------|----------------|
        /// | **操作主体** | 提案发起方（`from`） | 提案接收方（`to`） |
        /// | **权限要求** | `from` 方的墓位管理员 | `to` 方的墓位管理员 |
        /// | **业务语义** | 撤回自己发起的提案 | 拒绝对方的提案 |
        /// | **常见场景** | 发现错误、改变主意 | 不同意建立关系 |
        /// 
        /// ### 处理流程
        /// 1. 检查权限：确保调用者是 `from` 方墓位管理员
        /// 2. 检查提案：确认 `PendingRelationRequests(from, to)` 存在
        /// 3. 删除提案：从 `PendingRelationRequests` 中移除
        /// 4. 发出事件：通知提案已被发起方撤回
        /// 
        /// ### 错误处理
        /// - `DeceasedNotFound`: `from` 对应的逝者不存在
        /// - `NotAuthorized`: 调用者不是 `from` 方的墓位管理员
        /// - `RelationNotFound`: 提案不存在（可能已被批准、拒绝或撤回）
        /// 
        /// ### 事件
        /// - `RelationProposalCancelled(from, to, kind)`: 提案撤回成功
        /// 
        /// ### 注意事项
        /// - ⚠️ **不可逆操作**：撤回后提案完全删除，如需重新建立需重新发起提案
        /// - ⚠️ **仅限发起方**：只有 `from` 方可撤回，`to` 方应使用 `reject_relation`
        /// - ⚠️ **事件包含kind**：事件中包含关系类型，便于前端展示
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn cancel_relation_proposal(
            origin: OriginFor<T>,
            from: T::DeceasedId,
            to: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查提案是否存在，并获取kind
            let (kind, _created_by, _note, _created_at) = PendingRelationRequests::<T>::get(from, to)
                .ok_or(Error::<T>::RelationNotFound)?;
            
            // 权限检查：必须是发起方的管理员
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(
                T::GraveProvider::can_attach(&who, a.grave_id),
                Error::<T>::NotAuthorized
            );
            
            // 移除提案
            PendingRelationRequests::<T>::remove(from, to);
            
            // 发出事件（包含kind，便于前端展示）
            Self::deposit_event(Event::RelationProposalCancelled(from, to, kind));
            
            Ok(())
        }

        /// 函数级详细中文注释：撤销已建立的关系
        /// 
        /// ### 功能说明
        /// 删除已经正式建立的关系记录。**任一方**的墓位管理员都可以单方面撤销。
        /// 
        /// ### 参数说明
        /// - `from`: 关系的一方逝者ID
        /// - `to`: 关系的另一方逝者ID
        /// - ⚠️ 参数顺序可任意，函数会自动查找 `Relations(from,to)` 或 `Relations(to,from)`
        /// 
        /// ### 权限要求
        /// - 调用者必须是 `from` **或** `to` 任一方对应逝者所在墓位的管理员
        /// - 通过 `can_attach(caller, from.grave_id) || can_attach(caller, to.grave_id)` 判定
        /// - ⚠️ **单方面撤销**：不需要对方同意，任何一方都可以主动解除关系
        /// 
        /// ### 与 reject_relation 的区别
        /// | 维度 | revoke_relation | reject_relation |
        /// |------|----------------|----------------|
        /// | **操作对象** | 已建立的关系（`Relations`） | 待批准的提案（`PendingRelationRequests`） |
        /// | **权限要求** | 任一方管理员 | 仅 `to` 方管理员 |
        /// | **业务语义** | 解除正式关系 | 拒绝提案 |
        /// 
        /// ### 参数理解示例
        /// ```
        /// 场景：张三（ID=100）和李四（ID=200）是已建立的配偶关系，张三想解除
        /// 
        /// 调用方式（两种参数顺序都可以）：
        ///   revoke_relation(from=100, to=200)  // 张三的管理员调用
        ///   或
        ///   revoke_relation(from=200, to=100)  // 效果相同
        /// 
        /// 权限检查：
        ///   - 如果调用者是张三的墓位管理员 → ✅ 允许
        ///   - 如果调用者是李四的墓位管理员 → ✅ 也允许
        ///   - 如果调用者两边都不是管理员 → ❌ NotAuthorized
        /// ```
        /// 
        /// ### 处理流程
        /// 1. 检查权限：确保调用者是 `from` 或 `to` 任一方的墓位管理员
        /// 2. 查找关系：在 `Relations(from,to)` 或 `Relations(to,from)` 中查找
        /// 3. 删除关系：从 `Relations` 中移除
        /// 4. 更新索引：从 `RelationsByDeceased` 双方索引中移除（无向关系需清理双方）
        /// 5. 发出事件：通知关系已撤销
        /// 
        /// ### 错误处理
        /// - `DeceasedNotFound`: `from` 或 `to` 对应的逝者不存在
        /// - `NotAuthorized`: 调用者既不是 `from` 也不是 `to` 的墓位管理员
        /// - `RelationNotFound`: 关系不存在（可能已被撤销或从未建立）
        /// 
        /// ### 事件
        /// - `RelationRevoked(from, to)`: 关系撤销成功
        /// 
        /// ### 注意事项
        /// - ⚠️ **不可逆操作**：撤销后关系完全删除，如需重新建立需重新走提案流程
        /// - ⚠️ **单方面决策**：不需要对方同意，符合"解除关系自由"原则
        /// - ⚠️ **事件参数顺序**：事件中的 `from`/`to` 使用调用者传入的参数，不重排序
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn revoke_relation(
            origin: OriginFor<T>,
            from: T::DeceasedId,
            to: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(
                T::GraveProvider::can_attach(&who, a.grave_id)
                    || T::GraveProvider::can_attach(&who, b.grave_id),
                Error::<T>::NotAuthorized
            );
            let (ff, tt, kind) = if let Some(r) = Relations::<T>::get(from, to) {
                (from, to, r.kind)
            } else if let Some(r) = Relations::<T>::get(to, from) {
                (to, from, r.kind)
            } else {
                return Err(Error::<T>::RelationNotFound.into());
            };
            Relations::<T>::remove(ff, tt);
            RelationsByDeceased::<T>::mutate(ff, |list| {
                if let Some(i) = list.iter().position(|(peer, _)| *peer == tt) {
                    list.swap_remove(i);
                }
            });
            if is_undirected_kind(kind) && ff != tt {
                RelationsByDeceased::<T>::mutate(tt, |list| {
                    if let Some(i) = list.iter().position(|(peer, _)| *peer == ff) {
                        list.swap_remove(i);
                    }
                });
            }
            Self::deposit_event(Event::RelationRevoked(from, to));
            Ok(())
        }

        /// 函数级中文注释：更新关系备注。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn update_relation_note(
            origin: OriginFor<T>,
            from: T::DeceasedId,
            to: T::DeceasedId,
            note: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(
                T::GraveProvider::can_attach(&who, a.grave_id)
                    || T::GraveProvider::can_attach(&who, b.grave_id),
                Error::<T>::NotAuthorized
            );
            // 同时尝试两个方向，支持无向 canonical
            if Relations::<T>::try_mutate(from, to, |maybe| -> DispatchResult {
                let r = maybe.as_mut().ok_or(Error::<T>::RelationNotFound)?;
                r.note = match note.as_ref() {
                    Some(v) => BoundedVec::try_from(v.clone()).map_err(|_| Error::<T>::BadInput)?,
                    None => Default::default(),
                };
                Ok(())
            })
            .is_err()
            {
                Relations::<T>::try_mutate(to, from, |maybe| -> DispatchResult {
                    let r = maybe.as_mut().ok_or(Error::<T>::RelationNotFound)?;
                    r.note = match note.as_ref() {
                        Some(v) => {
                            BoundedVec::try_from(v.clone()).map_err(|_| Error::<T>::BadInput)?
                        }
                        None => Default::default(),
                    };
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
        pub fn set_friend_policy(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            require_approval: bool,
            is_private: bool,
            max_members: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                DeceasedOf::<T>::contains_key(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            ensure!(Self::is_admin(deceased_id, &who), Error::<T>::NotAuthorized);
            // 不允许将上限设置为小于现有成员数
            let current = FriendCount::<T>::get(deceased_id);
            ensure!(max_members >= current, Error::<T>::FriendTooMany);
            FriendPolicyOf::<T>::insert(
                deceased_id,
                FriendPolicy::<T> {
                    require_approval,
                    is_private,
                    max_members,
                    _phantom: core::marker::PhantomData,
                },
            );
            Ok(())
        }

        /// 函数级中文注释：申请加入亲友团。若 require_approval=false 则直接加入。
        #[pallet::call_index(33)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn request_join(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            note: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                DeceasedOf::<T>::contains_key(deceased_id),
                Error::<T>::DeceasedNotFound
            );
            ensure!(
                !FriendsOf::<T>::contains_key(deceased_id, &who),
                Error::<T>::FriendAlreadyMember
            );
            let mut fc = FriendCount::<T>::get(deceased_id);
            let policy = FriendPolicyOf::<T>::get(deceased_id).unwrap_or(FriendPolicy {
                require_approval: true,
                is_private: false,
                max_members: 1024,
                _phantom: core::marker::PhantomData,
            });
            if !policy.require_approval {
                ensure!(fc < policy.max_members, Error::<T>::FriendTooMany);
                let now = <frame_system::Pallet<T>>::block_number();
                let n: BoundedVec<_, T::StringLimit> = match note {
                    Some(v) => BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?,
                    None => Default::default(),
                };
                FriendsOf::<T>::insert(
                    deceased_id,
                    &who,
                    FriendRecord::<T> {
                        role: FriendRole::Member,
                        since: now,
                        note: n,
                    },
                );
                fc = fc.saturating_add(1);
                FriendCount::<T>::insert(deceased_id, fc);
                return Ok(());
            }
            // 需要审批：写入待审批列表（去重）
            let mut pend: BoundedVec<(T::AccountId, BlockNumberFor<T>), ConstU32<256>> =
                FriendJoinRequests::<T>::get(deceased_id);
            ensure!(
                !pend.iter().any(|(a, _)| a == &who),
                Error::<T>::FriendPendingExists
            );
            pend.try_push((who.clone(), <frame_system::Pallet<T>>::block_number()))
                .map_err(|_| Error::<T>::BadInput)?;
            FriendJoinRequests::<T>::insert(deceased_id, pend);
            Ok(())
        }

        /// 函数级中文注释：审批通过加入。仅 Admin。
        #[pallet::call_index(34)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn approve_join(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            who: T::AccountId,
        ) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(
                Self::is_admin(deceased_id, &admin),
                Error::<T>::NotAuthorized
            );
            let mut pend = FriendJoinRequests::<T>::get(deceased_id);
            let idx = pend
                .iter()
                .position(|(a, _)| a == &who)
                .ok_or(Error::<T>::FriendNoPending)?;
            pend.swap_remove(idx);
            FriendJoinRequests::<T>::insert(deceased_id, pend);
            ensure!(
                !FriendsOf::<T>::contains_key(deceased_id, &who),
                Error::<T>::FriendAlreadyMember
            );
            let policy = FriendPolicyOf::<T>::get(deceased_id).unwrap_or(FriendPolicy {
                require_approval: true,
                is_private: false,
                max_members: 1024,
                _phantom: core::marker::PhantomData,
            });
            let count = FriendCount::<T>::get(deceased_id);
            ensure!(count < policy.max_members, Error::<T>::FriendTooMany);
            let now = <frame_system::Pallet<T>>::block_number();
            FriendsOf::<T>::insert(
                deceased_id,
                &who,
                FriendRecord::<T> {
                    role: FriendRole::Member,
                    since: now,
                    note: Default::default(),
                },
            );
            FriendCount::<T>::insert(deceased_id, count.saturating_add(1));
            Ok(())
        }

        /// 函数级中文注释：拒绝加入。仅 Admin。
        #[pallet::call_index(35)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn reject_join(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            who: T::AccountId,
        ) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(
                Self::is_admin(deceased_id, &admin),
                Error::<T>::NotAuthorized
            );
            let mut pend = FriendJoinRequests::<T>::get(deceased_id);
            let idx = pend
                .iter()
                .position(|(a, _)| a == &who)
                .ok_or(Error::<T>::FriendNoPending)?;
            pend.swap_remove(idx);
            FriendJoinRequests::<T>::insert(deceased_id, pend);
            Ok(())
        }

        /// 函数级详细中文注释：退出亲友团（自愿退出）
        /// 
        /// ### 功能说明
        /// 允许成员主动退出亲友团。
        /// 
        /// ### 权限说明
        /// - **任何成员**：✅ 可以随时自由退出
        /// - **包括 owner**：✅ owner 也可以退出亲友团（退出后依然保留管理权限）
        /// 
        /// ### 设计理念
        /// - ✅ **自由退出**：删除 Admin 角色后，无需退出限制
        /// - ✅ **亲友团是可选的**：成员可以自由选择是否参与
        /// - ✅ **owner 的管理权限不受影响**：owner 的管理权限来自 `DeceasedOf.owner`，不依赖于亲友团
        /// 
        /// ### 使用场景
        /// 1. **普通成员退出**：不想继续关注该逝者
        /// 2. **owner 退出**：不想参与亲友团社交，但依然保留管理权限
        /// 
        /// ### 错误处理
        /// - `FriendNotMember`: 调用者不在亲友团中
        #[pallet::call_index(36)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn leave_friend_group(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                FriendsOf::<T>::contains_key(deceased_id, &who),
                Error::<T>::FriendNotMember
            );
            
            // ✅ 简化：删除 Admin 角色后，任何成员都可以自由退出
            FriendsOf::<T>::remove(deceased_id, &who);
            let cnt = FriendCount::<T>::get(deceased_id).saturating_sub(1);
            FriendCount::<T>::insert(deceased_id, cnt);
            Ok(())
        }

        /// 函数级详细中文注释：移出成员（仅 owner）
        /// 
        /// ### 功能说明
        /// 允许 owner 移除亲友团中的任何成员。
        /// 
        /// ### 权限说明
        /// - **调用者**：必须是 owner（通过 `is_admin` 判定）
        /// - **可移除对象**：任何成员（Member/Core），包括 owner 自己
        /// 
        /// ### 设计理念
        /// - ✅ **简化设计**：删除 Admin 角色后，只有 owner 有管理权限
        /// - ✅ **责任明确**：owner 是唯一管理者，可以移除任何成员
        /// - ✅ **避免冲突**：无多人管理，无权限争夺
        /// 
        /// ### owner 的特殊性
        /// - owner 可以移除自己（自愿退出亲友团的另一种方式）
        /// - owner 被移除后，依然通过 `DeceasedOf.owner` 保留管理权限
        /// 
        /// ### 使用场景
        /// 1. **owner 移除普通成员**：管理亲友团成员
        /// 2. **owner 移除自己**：退出亲友团社交
        /// 
        /// ### 错误处理
        /// - `NotAuthorized`: 调用者不是 owner
        /// - `FriendNotMember`: 被移除者不在亲友团中
        #[pallet::call_index(37)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn kick_friend(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            who: T::AccountId,
        ) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(
                Self::is_admin(deceased_id, &admin),
                Error::<T>::NotAuthorized
            );
            ensure!(
                FriendsOf::<T>::contains_key(deceased_id, &who),
                Error::<T>::FriendNotMember
            );
            
            // ✅ 简化：删除 Admin 角色后，owner 可以移除任何成员
            FriendsOf::<T>::remove(deceased_id, &who);
            let cnt = FriendCount::<T>::get(deceased_id).saturating_sub(1);
            FriendCount::<T>::insert(deceased_id, cnt);
            Ok(())
        }

        /// 函数级详细中文注释：设置成员角色（仅 owner）
        /// 
        /// ### 功能说明
        /// 允许 owner 设置亲友团成员的角色（Member 或 Core）。
        /// 
        /// ### 权限说明
        /// - **调用者**：必须是 owner（通过 `is_admin` 判定）
        /// - **可设置角色**：
        ///   - `0` → Member（普通成员）
        ///   - `1` → Core（核心成员）
        ///   - 其他值 → 默认为 Member
        /// 
        /// ### 设计理念
        /// - ✅ **简化设计**：删除 Admin 角色，只保留 Member/Core
        /// - ✅ **社交层面**：Member/Core 用于区分关系亲疏
        /// - ✅ **未来扩展**：Core 可能用于投票权、特殊权限等
        /// 
        /// ### 使用场景
        /// 1. **提升为核心成员**：将关系密切的成员设为 Core
        /// 2. **降级为普通成员**：调整成员角色
        /// 
        /// ### 错误处理
        /// - `NotAuthorized`: 调用者不是 owner
        /// - `FriendNotMember`: 被设置者不在亲友团中
        #[pallet::call_index(38)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn set_friend_role(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            who: T::AccountId,
            role: u8,
        ) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            ensure!(
                Self::is_admin(deceased_id, &admin),
                Error::<T>::NotAuthorized
            );
            FriendsOf::<T>::try_mutate(deceased_id, &who, |maybe| -> DispatchResult {
                let r = maybe.as_mut().ok_or(Error::<T>::FriendNotMember)?;
                // ✅ 简化：删除 Admin 角色，只支持 Member/Core
                r.role = match role {
                    1 => FriendRole::Core,
                    _ => FriendRole::Member,
                };
                Ok(())
            })?;
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：运行时升级钩子（开发期零迁移）。
        /// - 主网未上线阶段，采用“零迁移”策略：不执行 translate，仅写入当前 STORAGE_VERSION；
        /// - 若需结构调整，请清链/重启以应用最新结构；主网上线前再提供精确迁移版本。
        fn on_runtime_upgrade() -> Weight {
            STORAGE_VERSION.put::<Pallet<T>>();
            Weight::from_parts(10_000, 0)
        }
    }
}
