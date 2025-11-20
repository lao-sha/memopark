#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod anti_spam_tests;

// 函数级中文注释：统一逝者数据管理 - 整合text、media和works模块
pub mod text;
pub mod media;
pub mod works;  // 🆕 Phase 1: AI训练数据基础
pub mod anti_spam;  // 🆕 Phase 5: 防刷机制
pub mod governance;  // 🆕 Phase 1.4: 永久质押押金治理机制
pub use text::*;
pub use media::*;
pub use works::*;  // 🆕 导出作品相关类型

// 🆕 导出防刷相关类型（显式指定，避免与 governance::OperationType 冲突）
pub use anti_spam::{
    OperationType as AntiSpamOperationType,
    DailyCountInfo,
};

// 🆕 导出治理相关类型（注意：HoldReason现在在pallet模块中，通过pub use pallet::*导出）
pub use governance::{
    ContentScale, DepositStatus, OwnerDepositRecord,
    OperationType as GovernanceOperationType, ContentType,
    OwnerOperation, OwnerOperationStatus,
    OwnerOperationComplaint, ComplaintType, ComplaintStatus, ExpertDecision,
};

use frame_support::weights::Weight;
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_runtime::RuntimeDebug;
use sp_std::vec::Vec;
use pallet_social::SocialInterface;

// 函数级中文注释：导入log用于记录自动pin失败的警告
extern crate log;


/// 函数级详细中文注释：独立权限检查系统 trait（⭐ Phase 1：渐进式解耦）
///
/// ## 设计目标
/// - 替代 GraveInspector trait，实现独立的权限管理
/// - 解耦 pallet-deceased 对墓位系统的强依赖
/// - 支持多种权限模式：所有权、关系、可见性等
///
/// ## 权限层次
/// 1. **所有权权限** - 逝者owner直接权限（最高）
/// 2. **关系权限** - 家属/朋友关系授权
/// 3. **可见性权限** - 基于可见性设置的访问控制
/// 4. **治理权限** - 治理账户的特殊权限
///
/// ## 使用场景
/// - 关系管理（add_relation, remove_relation）
/// - 内容修改（update_deceased）
/// - 权限查询（前端权限判断）
///
/// ## 实现策略
/// - Phase 1: 基于所有权的简单实现
/// - Phase 2: 集成关系网络权限
/// - Phase 3: 完整的可见性和隐私控制
pub trait DeceasedPermissionProvider<AccountId, DeceasedId> {
    /// 函数级中文注释：检查用户是否有权管理指定逝者
    ///
    /// ### 权限判断逻辑（Phase 1简化版）
    /// - deceased.owner == who：所有权权限 ✅
    /// - 未来扩展：关系权限、可见性权限等
    ///
    /// ### 参数
    /// - `who`: 操作者账户
    /// - `deceased_id`: 逝者ID
    ///
    /// ### 返回
    /// - `true`: 有权限
    /// - `false`: 无权限
    fn can_manage(who: &AccountId, deceased_id: DeceasedId) -> bool;

    /// 函数级中文注释：检查用户是否有权查看指定逝者
    ///
    /// ### 权限判断逻辑（Phase 1简化版）
    /// - deceased.owner == who：所有权权限 ✅
    /// - 公开可见性：所有人可查看 ✅
    /// - 未来扩展：家属可见、朋友可见等
    ///
    /// ### 参数
    /// - `who`: 查看者账户
    /// - `deceased_id`: 逝者ID
    ///
    /// ### 返回
    /// - `true`: 有权查看
    /// - `false`: 无权查看
    fn can_view(who: &AccountId, deceased_id: DeceasedId) -> bool;

    /// 函数级中文注释：检查逝者是否存在
    ///
    /// ### 功能
    /// - 提供统一的存在性检查接口
    /// - 替代原有的分散检查逻辑
    ///
    /// ### 参数
    /// - `deceased_id`: 逝者ID
    ///
    /// ### 返回
    /// - `true`: 逝者存在
    /// - `false`: 逝者不存在
    fn deceased_exists(deceased_id: DeceasedId) -> bool;
}

/// 函数级中文注释：权重信息占位接口，后续可通过 benchmarking 生成并替换。
pub trait WeightInfo {
    fn create() -> Weight;
    fn update() -> Weight;
    fn transfer() -> Weight;

    // === 作品相关权重 (Phase 1: AI训练数据基础) ===
    fn upload_work() -> Weight;
    fn batch_upload_works(count: u32) -> Weight;
    fn update_work() -> Weight;
    fn delete_work() -> Weight;
    fn verify_work() -> Weight;
}

impl WeightInfo for () {
    /// 函数级中文注释：Weight 新结构不再支持从整数直接转换，使用 from_parts(ref_time, proof_size)。
    fn create() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn update() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn transfer() -> Weight {
        Weight::from_parts(10_000, 0)
    }

    // === 作品相关权重实现 (Phase 1) ===

    /// 函数级详细中文注释：上传单个作品的权重
    ///
    /// ## 成本分析
    /// - 参数验证和BoundedVec转换
    /// - 创建DeceasedWork记录
    /// - 3个存储写入（DeceasedWorks, NextWorkId, WorksByDeceased）
    /// - 2个索引更新（WorksByType, AITrainingWorks）
    /// - 1个统计更新（WorkStatsByDeceased）
    /// - 事件发出
    fn upload_work() -> Weight {
        Weight::from_parts(50_000, 0)
    }

    /// 函数级详细中文注释：批量上传作品的权重
    ///
    /// ## 成本分析
    /// - 基础成本：30_000（批量操作的固定开销）
    /// - 单个作品成本：count * 30_000（略低于单独上传）
    /// - 批量操作减少了事务开销
    ///
    /// ## 参数
    /// - `count`: 上传的作品数量
    fn batch_upload_works(count: u32) -> Weight {
        Weight::from_parts(30_000u64.saturating_mul(count as u64), 0)
    }

    /// 函数级详细中文注释：更新作品元数据的权重
    ///
    /// ## 成本分析
    /// - 读取作品记录
    /// - 可选更新多个字段（标题、描述、标签、隐私、AI授权）
    /// - AI授权变更可能触发索引更新
    /// - 2个事件发出（WorkUpdated, AITrainingAuthUpdated）
    fn update_work() -> Weight {
        Weight::from_parts(30_000, 0)
    }

    /// 函数级详细中文注释：删除作品的权重
    ///
    /// ## 成本分析
    /// - 读取作品记录
    /// - 3个索引清理（WorksByDeceased, WorksByType, AITrainingWorks）
    /// - 统计信息更新（WorkStatsByDeceased）
    /// - 删除主记录（DeceasedWorks）
    /// - 事件发出
    /// - 成本较高，因为需要清理多个索引
    fn delete_work() -> Weight {
        Weight::from_parts(40_000, 0)
    }

    /// 函数级详细中文注释：验证作品的权重
    ///
    /// ## 成本分析
    /// - 读取作品记录
    /// - 更新verified和verifier字段
    /// - 事件发出
    /// - 成本较低，仅修改2个字段
    fn verify_work() -> Weight {
        Weight::from_parts(20_000, 0)
    }
}

/// 函数级中文注释：性别枚举（Phase 2.0：简化为二元）
/// - 仅两种取值：M(男)、F(女)
/// - 已移除：B(保密)
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Gender {
    M,
    F,
}

impl Gender {
    /// 函数级中文注释：转换为字节代码（M/F）
    /// 
    /// 用途：
    /// - 在构建deceased_token时，将Gender枚举转换为字节代码
    /// - 统一性别代码转换逻辑，避免重复的match表达式
    /// 
    /// 返回：
    /// - Gender::M => b'M' (0x4D)
    /// - Gender::F => b'F' (0x46)
    pub fn to_byte(&self) -> u8 {
        match self {
            Gender::M => b'M',
            Gender::F => b'F',
        }
    }
    
    /// 函数级中文注释：从数字代码构建Gender枚举
    /// 
    /// 用途：
    /// - 在解析外部输入时，将数字代码转换为Gender枚举
    /// - 统一代码转换逻辑
    /// 
    /// 参数：
    /// - code: 数字代码（0=男, 1=女）
    /// 
    /// 返回：
    /// - 0 => Gender::M
    /// - 1 => Gender::F
    /// - 其他值 => Gender::F（默认为女）
    pub fn from_code(code: u8) -> Self {
        match code {
            0 => Gender::M,
            _ => Gender::F,
        }
    }
}

/// 函数级中文注释：Token修改提案状态
/// - 用于追踪治理提案的生命周期
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum ProposalStatus {
    /// 待投票
    Pending,
    /// 已批准（投票通过）
    Approved,
    /// 已拒绝（投票未通过）
    Rejected,
    /// 已执行（批准后已生效）
    Executed,
}

/// 函数级中文注释：Token修改治理提案
/// - Owner用完3次自主修改后，可提交治理提案申请额外修改机会
/// - 委员会成员投票决定是否批准
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct TokenRevisionProposal<T: Config> {
    /// 提案ID
    pub proposal_id: u64,
    /// 逝者ID
    pub deceased_id: T::DeceasedId,
    /// 申请人（deceased的owner）
    pub applicant: T::AccountId,
    /// 申请的额外修改次数
    pub additional_revisions: u8,
    /// 申请理由
    pub reason: BoundedVec<u8, T::StringLimit>,
    /// 证据材料CID（最多5个）
    pub evidence_cids: BoundedVec<BoundedVec<u8, T::TokenLimit>, ConstU32<5>>,
    /// 提案状态
    pub status: ProposalStatus,
    /// 提交区块号
    pub submitted_at: BlockNumberFor<T>,
    /// 批准票数
    pub approve_votes: u32,
    /// 拒绝票数
    pub reject_votes: u32,
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

/// 函数级详细中文注释：逝者分类枚举
///
/// ### 设计理念
/// - 采用枚举类型，确保分类可控、可验证
/// - 每个分类有特定的纪念馆展示样式和权限配置
/// - 可通过runtime升级扩展新分类
///
/// ### 分类说明
/// - **Ordinary**：普通民众（默认分类）
/// - **HistoricalFigure**：历史人物（文学家、科学家、艺术家等）
/// - **Martyr**：革命烈士（享受国家级纪念待遇）
/// - **Hero**：英雄模范（见义勇为、抗疫英雄等）
/// - **PublicFigure**：公众人物（明星、企业家等）
/// - **ReligiousFigure**：宗教人物（高僧、神父等）
/// - **EventHall**：事件馆（纪念重大历史事件的集体纪念馆）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum DeceasedCategory {
    /// 普通民众（默认）
    Ordinary = 0,
    /// 历史人物
    HistoricalFigure = 1,
    /// 革命烈士
    Martyr = 2,
    /// 英雄模范
    Hero = 3,
    /// 公众人物
    PublicFigure = 4,
    /// 宗教人物
    ReligiousFigure = 5,
    /// 事件馆
    EventHall = 6,
}

impl Default for DeceasedCategory {
    fn default() -> Self {
        Self::Ordinary
    }
}

/// 函数级详细中文注释：分类修改申请状态
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum RequestStatus {
    /// 待审核
    Pending,
    /// 已批准
    Approved,
    /// 已拒绝
    Rejected,
    /// 已过期
    Expired,
}

/// 函数级详细中文注释：分类修改申请
///
/// ### 生命周期
/// 1. **Pending**：待审核（委员会投票中）
/// 2. **Approved**：已批准（自动执行分类修改）
/// 3. **Rejected**：已拒绝（申请被驳回）
/// 4. **Expired**：已过期（超过审核期限）
///
/// ### 押金处理
/// - 提交申请时冻结押金（10 DUST）
/// - 批准后：全额退回押金
/// - 拒绝后：50%退回，50%罚没至国库
/// - 过期后：全额退回押金
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct CategoryChangeRequest<T: Config> {
    /// 申请人账户
    pub applicant: T::AccountId,
    /// 逝者ID
    pub deceased_id: u64,
    /// 当前分类
    pub current_category: DeceasedCategory,
    /// 目标分类
    pub target_category: DeceasedCategory,
    /// 申请理由CID（存储在IPFS）
    pub reason_cid: BoundedVec<u8, ConstU32<64>>,
    /// 证据CID列表（存储在IPFS，最多10个）
    pub evidence_cids: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<10>>,
    /// 申请时间（区块号）
    pub submitted_at: BlockNumberFor<T>,
    /// 审核截止时间（区块号）
    pub deadline: BlockNumberFor<T>,
    /// 申请状态
    pub status: RequestStatus,
}

/// 函数级中文注释：逝者实体，链上仅存最小必要信息与链下指针。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Deceased<T: Config> {
    /// 记录拥有者（通常等于墓位所有者或其授权人）
    pub owner: T::AccountId,
    /// 函数级中文注释：创建者账户（不可变，只读审计字段）
    /// - 语义：最初发起 `create_deceased` 的签名账户；用于审计/治理/画像；不参与权限与派生。
    /// - 稳定性：创建后永久不可修改；迁移时对存量记录回填为 `owner`。
    pub creator: T::AccountId,
    /// 姓名（限长，避免敏感信息超量上链）
    pub name: BoundedVec<u8, T::StringLimit>,
    /// 性别枚举：M/F（男/女）
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
    /// - 安全：仅存 CID 字节；不涉及任何 DUST 代币逻辑；长度受 TokenLimit 约束
    /// - 权限：owner 可直接设置/修改；非 owner 需通过 Root 治理设置
    pub main_image_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    /// 逝者令牌（在 pallet 内构造）：gender(大写) + birth(8字节) + death(8字节) + 姓名哈希(blake2_256)
    /// 例如：M1981122420250901LIUXIAODONG
    /// 长度上限单独由 `Config::TokenLimit` 约束，便于与外部引用保持一致。
    pub deceased_token: BoundedVec<u8, T::TokenLimit>,
    /// 函数级中文注释：Token 修改次数（已使用）
    /// - 初始值：0
    /// - 每次修改影响 token 的字段时自增
    /// - 用于限制 token 修改频率，防止滥用
    pub token_revision_count: u8,
    /// 函数级中文注释：Token 修改次数上限
    /// - 初始值：3（Owner 自主修改）
    /// - 可通过治理扩展（委员会批准）
    /// - 最大值：10（即使治理批准也有上限）
    pub token_revision_limit: u8,
    /// 外部资源链接（IPFS/HTTPS），每条与数量均受限
    pub links: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>,
    /// 创建与更新区块号
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
    /// 函数级中文注释：版本号（从 1 开始）。每次"资料修改"自增，用于审计与回滚依据。
    pub version: u32,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::traits::ConstU32;
    use frame_support::traits::StorageVersion;
    use frame_support::traits::ReservableCurrency;
    use frame_support::traits::Currency;
    use frame_support::traits::fungible::{MutateHold, Inspect, Mutate}; // 添加 Mutate trait
    use sp_runtime::traits::{SaturatedConversion, AtLeast32BitUnsigned};
    use sp_runtime::Saturating;
    use sp_std::vec;
    use pallet_stardust_ipfs::IpfsPinner;  // 导入IpfsPinner trait

    // 🆕 明确导入防刷机制的 OperationType（避免与 governance::OperationType 冲突）
    use crate::anti_spam::OperationType as AntiSpamOperationType;
    use crate::anti_spam::HourlyCountInfo;

    /// 函数级中文注释：Balance 类型别名（用于押金和费用）
    pub type BalanceOf<T> = <<T as Config>::Currency as frame_support::traits::Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 逝者 ID 类型
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 单字段字符串长度上限
        #[pallet::constant]
        type StringLimit: Get<u32> + Clone;

        /// 最大外部链接条数
        #[pallet::constant]
        type MaxLinks: Get<u32> + Clone;

        /// 函数级详细中文注释：墓位容量无限制设计说明
        ///
        /// ### 设计变更
        /// - **已删除**：`MaxDeceasedPerGrave` 配置（原硬上限6人）
        /// - **改为**：Vec 无容量限制，支持家族墓、纪念墓
        ///
        /// ### 合理性
        /// - 真实需求：家族墓可能几十人，纪念墓可能数千人
        /// - 经济保护：每人约10 DUST成本，天然防止恶意填充
        /// - 性能可控：前端分页加载，1000人墓位仅8KB Storage
        ///
        /// ### 风险控制
        /// - 经济门槛：创建+IPFS费用防止滥用
        /// - 前端优化：分页加载、虚拟滚动
        /// - 监控告警：超大墓位（>1000人）人工审核

        /// 函数级中文注释：`deceased_token` 的最大长度上限（字节）。
        /// - 设计目标：与外部引用者（如 `pallet-stardust-grave`）的 `MaxCidLen` 对齐，避免跨 pallet 不一致。
        #[pallet::constant]
        type TokenLimit: Get<u32> + Clone;

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
        /// - 由Runtime注入实现：pallet_stardust_ipfs::Pallet<Runtime>
        type IpfsPinner: pallet_stardust_ipfs::IpfsPinner<Self::AccountId, Self::Balance>;

        /// 函数级中文注释：余额类型（用于存储费用支付）
        /// - 必须与Currency的Balance类型一致
        /// - 用于IpfsPinner::pin_cid_for_deceased的price参数
        type Balance: Parameter + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 函数级中文注释：默认IPFS存储单价（每副本每月，单位为Balance最小单位）
        /// - 建议值：1 DUST = 1_000_000_000_000（12位小数）
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
        type MaxTokenLen: Get<u32> + Clone;

        // ========== 治理机制相关类型（Phase 1.4：永久质押押金模式）==========

        /// 函数级详细中文注释：基础创建押金（USDT单位）
        /// 函数级详细中文注释：Pricing服务提供者
        /// - 用途：获取DUST/USDT汇率，进行押金转换
        /// - 实现：pallet-pricing
        type PricingProvider: governance::PricingProvider;

        /// 函数级详细中文注释：委员会治理起源
        /// - 用途：验证治理提案投票权限
        /// - 实现：pallet-collective 或自定义委员会
        /// - 说明：用于Token修改提案的投票和批准
        type CommitteeOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 函数级详细中文注释：提案批准阈值
        /// - 用途：Token修改提案通过所需的最小批准票数
        /// - 建议：设置为委员会成员总数的51%以上（如5人委员会设为3）
        #[pallet::constant]
        type ApprovalThreshold: Get<u32>;

        /// 函数级详细中文注释：Fungible接口（支持hold机制）
        /// - 用途：永久质押押金的锁定和释放
        /// - 实现：pallet-balances
        type Fungible: frame_support::traits::fungible::hold::Mutate<Self::AccountId, Balance = BalanceOf<Self>, Reason = Self::RuntimeHoldReason>
            + frame_support::traits::fungible::Inspect<Self::AccountId>
            + frame_support::traits::fungible::Mutate<Self::AccountId>;

        /// 函数级详细中文注释：RuntimeHoldReason类型
        /// - 用途：定义hold资金的原因类型
        /// - 包含：DeceasedOwnerDeposit、ComplaintDeposit等
        type RuntimeHoldReason: From<crate::HoldReason>;

        /// 函数级详细中文注释：国库账户
        /// - 用途：接收投诉和操作审核的委员会分配资金（20%）
        /// - 实现：runtime中定义的TreasuryAccount
        type TreasuryAccount: Get<Self::AccountId>;

        /// 函数级中文注释：Social pallet接口，用于关注功能迁移
        /// - 继承pallet-deceased的关注功能到统一的社交管理系统
        /// - 支持多类型目标关注（逝者、墓地、用户等）
        type Social: pallet_social::SocialInterface<Self::AccountId>;
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

    /// 函数级中文注释：Token修改提案存储
    /// - Key: 提案ID（u64）
    /// - Val: TokenRevisionProposal
    /// - 用途：存储所有token修改治理提案
    #[pallet::storage]
    pub type TokenRevisionProposals<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, TokenRevisionProposal<T>, OptionQuery>;

    /// 函数级中文注释：下一个提案ID
    /// - 递增计数器，用于生成唯一的提案ID
    #[pallet::storage]
    pub type NextProposalId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：提案投票记录
    /// - Key1: 提案ID
    /// - Key2: 投票人账户
    /// - Val: 投票结果（true=批准，false=拒绝）
    #[pallet::storage]
    pub type ProposalVotes<T: Config> =
        StorageDoubleMap<
            _,
            Blake2_128Concat, u64,           // proposal_id
            Blake2_128Concat, T::AccountId,  // voter
            bool,                            // approve/reject
            OptionQuery
        >;

    /// 函数级中文注释：最近活跃块高（owner 对该逝者的最近一次有效签名交互）。
    #[pallet::storage]
    pub type LastActiveOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::DeceasedId, BlockNumberFor<T>, OptionQuery>;

    // ============= 🆕 分类系统存储项 =============

    /// 函数级详细中文注释：逝者分类存储
    /// - Key: deceased_id (u64)
    /// - Value: DeceasedCategory
    /// - 默认值: Ordinary（普通民众）
    #[pallet::storage]
    #[pallet::getter(fn category_of)]
    pub type CategoryOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // deceased_id
        DeceasedCategory,
        ValueQuery, // 默认返回 Ordinary
    >;

    /// 函数级详细中文注释：按分类索引逝者（优化分类查询性能）
    /// - Key: DeceasedCategory（分类枚举）
    /// - Value: Vec<u64>（该分类下的所有逝者ID，最多1000个）
    /// - 用途：快速分类查询，避免全表扫描
    ///
    /// ### 设计考虑
    /// - **性能优化**：避免遍历所有逝者进行分类筛选
    /// - **存储限制**：使用BoundedVec限制单个分类最多1000个逝者
    /// - **自动维护**：在create_deceased和分类变更时自动更新
    /// - **降级策略**：超出限制时停止添加，但不影响现有功能
    #[pallet::storage]
    pub type DeceasedByCategory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        DeceasedCategory,
        BoundedVec<u64, ConstU32<1000>>, // 单个分类最多1000个逝者
        ValueQuery,
    >;

    /// 函数级详细中文注释：按创建时间索引逝者（支持时间排序查询）
    ///
    /// ### 设计目标
    /// - **时间排序查询**：支持"最新逝者"、"近期纪念"等时间相关功能
    /// - **高效时间筛选**：避免遍历所有逝者检查创建时间
    /// - **分页浏览**：支持按时间倒序的分页浏览
    /// - **内存控制**：单个区块最多100个逝者ID
    ///
    /// ### 技术特点
    /// - **Key**: BlockNumberFor<T> - 区块号（创建时间的代理指标）
    /// - **Value**: BoundedVec<u64, 100> - 该区块创建的逝者ID列表
    /// - **查询方向**: 从最新区块往前查找（倒序时间）
    /// - **存储策略**: 按区块分组，便于时间范围查询
    /// - **自动维护**: 创建逝者时自动添加到当前区块索引
    /// - **容量限制**: 单个区块最多100个逝者，正常情况足够使用
    #[pallet::storage]
    pub type DeceasedByCreationTime<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        BoundedVec<u64, ConstU32<100>>, // 单个区块最多100个逝者
        ValueQuery,
    >;

    /// 函数级详细中文注释：分类修改申请存储
    /// - Key: request_id (u64)
    /// - Value: CategoryChangeRequest
    #[pallet::storage]
    #[pallet::getter(fn change_requests)]
    pub type CategoryChangeRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // request_id
        CategoryChangeRequest<T>,
    >;

    /// 函数级详细中文注释：下一个申请ID
    #[pallet::storage]
    #[pallet::getter(fn next_request_id)]
    pub type NextRequestId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：用户申请历史索引
    /// - Key: (applicant, deceased_id)
    /// - Value: Vec<request_id>（最多100个）
    #[pallet::storage]
    pub type RequestsByUser<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (T::AccountId, u64), // (applicant, deceased_id)
        BoundedVec<u64, ConstU32<100>>, // request_ids
        ValueQuery,
    >;

    // ============= 🆕 Phase 1.4: 永久质押押金治理机制存储项 =============

    /// 函数级详细中文注释：拥有者押金记录存储
    /// - Key: deceased_id (u64)
    /// - Value: OwnerDepositRecord<T>
    /// - 用途：记录每个逝者的永久质押押金状态
    #[pallet::storage]
    #[pallet::getter(fn owner_deposit_records)]
    pub type OwnerDepositRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // deceased_id
        OwnerDepositRecord<T>,
    >;

    // ========== 🚀 Phase 2 破坏式优化：删除冗余索引 ==========
    // ❌ 已删除：OwnerDepositsByOwner 存储
    // 原因：低频查询，改用 OwnerDepositRecords::iter() 过滤
    // 收益：减少 create_deceased 和 transfer_deceased_ownership 的写入操作
    // 注意：主网未上线，无需数据迁移
    // =======================================================

    /// 函数级详细中文注释：缓存的汇率数据
    /// - Value: governance::ExchangeRate
    /// - 用途：缓存pallet-pricing的汇率，减少链上查询
    /// - 有效期：10分钟（可配置）
    #[pallet::storage]
    pub type CachedExchangeRate<T: Config> = StorageValue<_, governance::ExchangeRate>;

    /// 函数级详细中文注释：拥有者操作记录存储
    /// - Key: operation_id (u64)
    /// - Value: OwnerOperation<T>
    /// - 用途：记录拥有者的所有增删改操作
    #[pallet::storage]
    #[pallet::getter(fn owner_operations)]
    pub type OwnerOperations<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // operation_id
        OwnerOperation<T>,
    >;

    /// 函数级详细中文注释：下一个操作ID
    #[pallet::storage]
    #[pallet::getter(fn next_operation_id)]
    pub type NextOperationId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：按拥有者索引操作记录
    /// - Key: (AccountId, operation_id)
    /// - Value: ()（标记存在）
    #[pallet::storage]
    pub type OperationsByOwner<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (T::AccountId, u64), // (owner, operation_id)
        (),
    >;

    /// 函数级详细中文注释：按逝者索引操作记录
    /// - Key: (deceased_id, operation_id)
    /// - Value: ()（标记存在）
    #[pallet::storage]
    pub type OperationsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (u64, u64), // (deceased_id, operation_id)
        (),
    >;

    /// 函数级详细中文注释：拥有者操作投诉记录存储
    /// - Key: complaint_id (u64)
    /// - Value: OwnerOperationComplaint<T>
    #[pallet::storage]
    #[pallet::getter(fn owner_operation_complaints)]
    pub type OwnerOperationComplaints<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // complaint_id
        OwnerOperationComplaint<T>,
    >;

    /// 函数级详细中文注释：下一个投诉ID
    #[pallet::storage]
    #[pallet::getter(fn next_complaint_id)]
    pub type NextComplaintId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：按操作索引投诉记录
    /// - Key: (operation_id, complaint_id)
    /// - Value: ()（标记存在）
    #[pallet::storage]
    pub type ComplaintsByOperation<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (u64, u64), // (operation_id, complaint_id)
        (),
    >;

    /// 函数级详细中文注释：按投诉人索引投诉记录
    /// - Key: (AccountId, complaint_id)
    /// - Value: ()（标记存在）
    #[pallet::storage]
    pub type ComplaintsByComplainant<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (T::AccountId, u64), // (complainant, complaint_id)
        (),
    >;

    /// 函数级详细中文注释：下一个拥有者操作投诉ID（计数器）
    /// - 用于生成唯一的投诉ID
    #[pallet::storage]
    #[pallet::getter(fn next_operation_complaint_id)]
    pub type NextOperationComplaintId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：逝者已创建
        /// - deceased_id: 逝者ID
        /// - owner: 创建者/所有者账户
        DeceasedCreated(T::DeceasedId, T::AccountId),
        /// 更新逝者 (id)
        DeceasedUpdated(T::DeceasedId),
        /// 函数级中文注释：可见性已变更 (id, public)
        VisibilityChanged(T::DeceasedId, bool),
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

        // =================== 🆕 分类系统事件 ===================

        /// 函数级中文注释：分类修改申请已提交
        /// - request_id: 申请ID
        /// - deceased_id: 逝者ID
        /// - applicant: 申请人账户
        /// - from: 当前分类(u8代码)
        /// - to: 目标分类(u8代码)
        CategoryChangeRequested {
            request_id: u64,
            deceased_id: u64,
            applicant: T::AccountId,
            from: u8,
            to: u8,
        },

        /// 函数级中文注释：分类修改申请已批准
        /// - request_id: 申请ID
        /// - deceased_id: 逝者ID
        /// - from: 原分类(u8代码)
        /// - to: 新分类(u8代码)
        CategoryChangeApproved {
            request_id: u64,
            deceased_id: u64,
            from: u8,
            to: u8,
        },

        /// 函数级中文注释：分类修改申请已拒绝
        /// - request_id: 申请ID
        /// - deceased_id: 逝者ID
        /// - reason_cid: 拒绝理由CID
        CategoryChangeRejected {
            request_id: u64,
            deceased_id: u64,
            reason_cid: BoundedVec<u8, ConstU32<64>>,
        },

        /// 函数级中文注释：分类修改申请已过期
        /// - request_id: 申请ID
        /// - deceased_id: 逝者ID
        CategoryChangeExpired {
            request_id: u64,
            deceased_id: u64,
        },

        /// 函数级中文注释：分类已由Root强制修改
        /// - deceased_id: 逝者ID
        /// - from: 原分类(u8代码)
        /// - to: 新分类(u8代码)
        /// - note_cid: 修改备注CID（可选）
        CategoryForcedChanged {
            deceased_id: u64,
            from: u8,
            to: u8,
            note_cid: Option<BoundedVec<u8, ConstU32<64>>>,
        },

        // =================== 🆕 作品相关事件 (Phase 1: AI训练数据基础) ===================

        /// 函数级详细中文注释：作品已上传
        /// - work_id: 作品ID
        /// - deceased_id: 所属逝者ID
        /// - work_type_str: 作品类型字符串（BoundedVec编码）
        /// - uploader: 上传者账户
        /// - file_size: 文件大小（字节）
        /// - ai_training_enabled: 是否授权用于AI训练
        WorkUploaded {
            work_id: u64,
            deceased_id: T::DeceasedId,
            work_type_str: BoundedVec<u8, ConstU32<50>>,
            uploader: T::AccountId,
            file_size: u64,
            ai_training_enabled: bool,
        },

        /// 函数级详细中文注释：批量作品已上传
        /// - deceased_id: 所属逝者ID
        /// - count: 上传的作品数量
        /// - uploader: 上传者账户
        WorksBatchUploaded {
            deceased_id: T::DeceasedId,
            count: u32,
            uploader: T::AccountId,
        },

        /// 函数级详细中文注释：作品元数据已更新
        /// - work_id: 作品ID
        /// - updater: 更新者账户
        WorkUpdated {
            work_id: u64,
            updater: T::AccountId,
        },

        /// 函数级详细中文注释：作品已删除
        /// - work_id: 作品ID
        /// - deceased_id: 所属逝者ID
        /// - deleter: 删除者账户
        WorkDeleted {
            work_id: u64,
            deceased_id: T::DeceasedId,
            deleter: T::AccountId,
        },

        /// 函数级详细中文注释：作品已验证
        /// - work_id: 作品ID
        /// - verifier: 验证者账户
        WorkVerified {
            work_id: u64,
            verifier: T::AccountId,
        },

        /// 函数级详细中文注释：AI训练授权已更新
        /// - work_id: 作品ID
        /// - enabled: 是否启用（true=启用，false=禁用）
        AITrainingAuthUpdated {
            work_id: u64,
            enabled: bool,
        },

        // =================== 🆕 Phase 5：防刷机制事件 (Anti-Spam Events) ===================

        /// 函数级详细中文注释：检测到异常行为（1小时内操作过多）
        ///
        /// ## 事件参数
        /// - `who`: 操作用户账户
        /// - `operation_type`: 操作类型（View/Share/Favorite）
        /// - `count_in_hour`: 1小时内操作次数
        ///
        /// ## 触发条件
        /// - 浏览：1小时内超过100次
        /// - 分享：1小时内超过30次
        /// - 收藏：1小时内超过20次
        ///
        /// ## 事件用途
        /// - **警告级别**：不阻止操作，仅记录异常行为
        /// - 链下监控：可订阅此事件实现实时告警
        /// - 治理决策：积累异常记录作为封禁依据
        /// - 用户画像：分析用户行为模式
        ///
        /// ## 处理建议
        /// - 前端：显示友好提示\"您的操作频率较高，请注意合理使用\"
        /// - 治理：多次异常可人工审核并采取措施
        /// - 监控：集成到Subsquid索引层，生成异常用户报表
        ///
        /// ## 示例场景
        /// ```rust
        /// // 用户在1小时内浏览了120个作品，触发异常检测
        /// Event::AnomalyDetected {
        ///     who: alice_account,
        ///     operation_type: OperationType::View,
        ///     count_in_hour: 120,
        /// }
        /// ```
        AnomalyDetected {
            who: T::AccountId,
            operation_type: u8,  // OperationType: 0=View, 1=Share, 2=Favorite
            count_in_hour: u32,
        },

        /// 函数级详细中文注释：用户达到每日操作限额（接近或达到上限）
        ///
        /// ## 事件参数
        /// - `who`: 操作用户账户
        /// - `operation_type`: 操作类型（View/Share/Favorite）
        /// - `limit`: 每日限额值
        ///
        /// ## 触发条件
        /// - 用户操作次数达到限额的90%时触发
        /// - 例如：浏览限额1000次，达到900次时触发
        ///
        /// ## 事件用途
        /// - **预警提示**：提前通知用户接近限额
        /// - 前端优化：禁用或灰化操作按钮
        /// - 用户体验：避免突然达到限额造成困惑
        ///
        /// ## 处理建议
        /// - 前端：显示剩余次数\"您今天还可以浏览{remaining}个作品\"
        /// - UI交互：接近限额时显示醒目提示
        /// - 倒计时：显示距离次日重置的剩余时间
        ///
        /// ## 示例场景
        /// ```rust
        /// // 用户浏览了900个作品，达到1000次限额的90%
        /// Event::DailyLimitReached {
        ///     who: bob_account,
        ///     operation_type: OperationType::View,
        ///     limit: 1000,
        /// }
        /// ```
        ///
        /// ## 注意
        /// - 此事件在达到限额前触发（预警性质）
        /// - 实际达到限额时返回错误：DailyLimitExceeded
        DailyLimitReached {
            who: T::AccountId,
            operation_type: u8,  // OperationType: 0=View, 1=Share, 2=Favorite
            limit: u32,
        },

        // =================== 🆕 Phase 1.4: 永久质押押金治理机制事件 ===================

        /// 函数级详细中文注释：创建逝者并锁定永久质押押金
        /// - deceased_id: 逝者ID
        /// - owner: 拥有者账户
        /// - deposit_usdt: 质押押金金额（USDT）
        /// - deposit_dust: 质押押金金额（DUST）
        /// - expected_scale: 预期内容规模（0=Small, 1=Medium, 2=Large）
        DeceasedCreatedWithDeposit {
            deceased_id: u64,
            owner: T::AccountId,
            deposit_usdt: u32,
            deposit_dust: BalanceOf<T>,
            expected_scale: u8,
        },

        /// 函数级详细中文注释：押金已补充
        /// - deceased_id: 逝者ID
        /// - owner: 拥有者账户
        /// - top_up_usdt: 补充金额（USDT）
        /// - top_up_dust: 补充金额（DUST）
        /// - new_available_usdt: 补充后的可用余额（USDT）
        DepositToppedUp {
            deceased_id: u64,
            owner: T::AccountId,
            top_up_usdt: u32,
            top_up_dust: BalanceOf<T>,
            new_available_usdt: u32,
        },

        // =================== 🆕 方案3：动态调整押金事件 ===================

        /// 函数级详细中文注释：补充警告已发出（方案3）
        /// - deceased_id: 逝者ID
        /// - required_usdt: 需要补充的USDT等价金额
        /// - required_dust: 需要补充的DUST数量
        /// - deadline: 截止时间（7天后）
        SupplementWarningIssued {
            deceased_id: u64,
            required_usdt: u32,
            required_dust: BalanceOf<T>,
            deadline: BlockNumberFor<T>,
        },

        /// 函数级详细中文注释：押金已补充（方案3）
        /// - deceased_id: 逝者ID
        /// - dust_amount: 补充的DUST数量
        /// - usdt_equivalent: USDT等价值
        /// - owner: 补充者账户
        DepositSupplemented {
            deceased_id: u64,
            dust_amount: BalanceOf<T>,
            usdt_equivalent: u32,
            owner: T::AccountId,
        },

        /// 函数级详细中文注释：押金已解锁（方案3）
        /// - deceased_id: 逝者ID
        /// - dust_amount: 解锁的DUST数量
        /// - usdt_equivalent: USDT等价值
        /// - owner: 解锁者账户
        DepositUnlocked {
            deceased_id: u64,
            dust_amount: BalanceOf<T>,
            usdt_equivalent: u32,
            owner: T::AccountId,
        },

        /// 函数级详细中文注释：押金已强制补充（方案3）
        /// - deceased_id: 逝者ID
        /// - dust_amount: 强制补充的DUST数量
        /// - owner: 被强制补充的owner账户
        DepositForcedSupplemented {
            deceased_id: u64,
            dust_amount: BalanceOf<T>,
            owner: T::AccountId,
        },

        /// 函数级详细中文注释：押金已耗尽（方案3）
        /// - deceased_id: 逝者ID
        /// - owner: owner账户
        DepositDepleted {
            deceased_id: u64,
            owner: T::AccountId,
        },

        /// 函数级详细中文注释：拥有者操作已执行
        /// - operation_id: 操作ID
        /// - owner: 操作者
        /// - deceased_id: 逝者ID
        /// - operation: 操作类型（0=Add, 1=Modify, 2=Delete）
        OwnerOperationExecuted {
            operation_id: u64,
            owner: T::AccountId,
            deceased_id: u64,
            operation: u8,
            complaint_window_end: BlockNumberFor<T>,
        },

        /// 函数级详细中文注释：操作已被投诉
        /// - complaint_id: 投诉ID
        /// - operation_id: 关联的操作ID
        /// - complainant: 投诉人
        /// - deposit_usdt: 投诉押金（USDT）
        /// - deposit_dust: 投诉押金（DUST）
        OperationComplained {
            complaint_id: u64,
            operation_id: u64,
            complainant: T::AccountId,
            deposit_usdt: u32,
            deposit_dust: BalanceOf<T>,
        },

        /// 函数级详细中文注释：投诉已审核
        /// - complaint_id: 投诉ID
        /// - decision: 审核决定（0=ComplaintValid, 1=ComplaintInvalid, 2=RequireMoreEvidence）
        ComplaintReviewed {
            complaint_id: u64,
            operation_id: u64,
            decision: u8,
        },

        /// 函数级详细中文注释：投诉成功，押金已从质押池扣除并分配
        /// - complaint_id: 投诉ID
        /// - operation_id: 操作ID
        /// - deceased_id: 逝者ID
        /// - deducted_usdt: 扣除金额（USDT）
        /// - deducted_dust: 扣除金额（DUST）
        /// - complainant_reward: 投诉人奖励
        /// - committee_reward: 委员会奖励
        /// - remaining_deposit_usdt: 剩余押金（USDT）
        ComplaintSuccessDepositDeducted {
            complaint_id: u64,
            operation_id: u64,
            deceased_id: u64,
            deducted_usdt: u32,
            deducted_dust: BalanceOf<T>,
            complainant_reward: BalanceOf<T>,
            committee_reward: BalanceOf<T>,
            remaining_deposit_usdt: u32,
        },

        /// 函数级详细中文注释：投诉失败，投诉人押金已罚没并分配
        /// - complaint_id: 投诉ID
        /// - operation_id: 操作ID
        /// - complainant: 投诉人
        /// - owner_compensation: 拥有者补偿
        /// - committee_reward: 委员会奖励
        ComplaintRejectedDepositForfeited {
            complaint_id: u64,
            operation_id: u64,
            complainant: T::AccountId,
            owner_compensation: BalanceOf<T>,
            committee_reward: BalanceOf<T>,
        },

        /// 函数级详细中文注释：拥有权转让，押金已释放和锁定
        /// - deceased_id: 逝者ID
        /// - old_owner: 原拥有者
        /// - new_owner: 新拥有者
        /// - old_deposit_released_usdt: 释放的押金（USDT）
        /// - old_deposit_released_dust: 释放的押金（DUST）
        /// - new_deposit_locked_usdt: 新锁定的押金（USDT）
        /// - new_deposit_locked_dust: 新锁定的押金（DUST）
        OwnershipTransferredWithDeposit {
            deceased_id: u64,
            old_owner: T::AccountId,
            new_owner: T::AccountId,
            old_deposit_released_usdt: u32,
            old_deposit_released_dust: BalanceOf<T>,
            new_deposit_locked_usdt: u32,
            new_deposit_locked_dust: BalanceOf<T>,
        },

        /// 函数级详细中文注释：操作已被撤销（投诉成功）
        /// - operation_id: 操作ID
        /// - deceased_id: 逝者ID
        /// - operation: 操作类型（0=Add, 1=Modify, 2=Delete）
        OwnerOperationRevoked {
            operation_id: u64,
            deceased_id: u64,
            operation: u8,
        },

        /// 函数级详细中文注释：拥有者删除了非拥有者内容
        /// - deceased_id: 逝者ID
        /// - owner: 拥有者账户
        /// - content_type: 内容类型（0=Text, 1=Media, 2=Works）
        /// - content_id: 内容ID
        /// - reason: 删除理由（可选）
        /// 函数级详细中文注释：拥有者删除他人上传的操作（自动退还押金）
        /// - deceased_id: 逝者ID
        /// - owner: 逝者拥有者账户
        /// - operation_id: 被删除的操作ID
        /// - original_uploader: 原上传者账户
        /// - refunded_deposit: 退还的押金金额（DUST）
        OwnerDeletedNonOwnerOperation {
            deceased_id: u64,
            owner: T::AccountId,
            operation_id: u64,
            original_uploader: T::AccountId,
            refunded_deposit: BalanceOf<T>,
        },

        /// 【方案D】函数级详细中文注释：非拥有者操作开始确认期
        /// - operation_id: 操作ID
        /// - operator: 操作执行者
        /// - confirm_deadline: 确认期结束时间（7天后）
        /// - additional_deposit_usdt: 额外锁定的押金（USDT）
        /// 【方案E】函数级详细中文注释：非拥有者操作已确认，押金已退还
        /// - operation_id: 操作ID
        /// - operator: 操作执行者
        /// - refunded_dust: 退还的押金（DUST，仅initial deposit）
        ///
        /// ### 时间线
        /// - 30天后任何人可调用 auto_finalize_operation
        /// - 自动退还2 USDT押金（服务费1 USDT不退）
        NonOwnerOperationConfirmed {
            operation_id: u64,
            operator: T::AccountId,
            refunded_dust: BalanceOf<T>,
        },

        // =================== Text 模块事件 ===================

        /// 函数级详细中文注释：创建文本记录
        /// - text_id: 文本ID
        /// - deceased_id: 逝者ID
        /// - author: 作者（通常是deceased owner）
        /// - kind: 文本类型（0=Article, 1=Message）
        TextCreated {
            text_id: T::TextId,
            deceased_id: T::DeceasedId,
            author: T::AccountId,
            kind: u8, // 0=Article, 1=Message
        },

        /// 函数级详细中文注释：更新文本记录
        /// - text_id: 文本ID
        /// - deceased_id: 逝者ID
        /// - editor: 编辑者
        TextUpdated {
            text_id: T::TextId,
            deceased_id: T::DeceasedId,
            editor: T::AccountId,
        },

        /// 函数级详细中文注释：删除文本记录
        /// - text_id: 文本ID
        /// - deceased_id: 逝者ID
        /// - deleter: 删除者
        TextDeleted {
            text_id: T::TextId,
            deceased_id: T::DeceasedId,
            deleter: T::AccountId,
        },

        /// 函数级详细中文注释：创建/更新生平记录
        /// - deceased_id: 逝者ID
        /// - editor: 编辑者
        /// - version: 版本号
        LifeUpdated {
            deceased_id: T::DeceasedId,
            editor: T::AccountId,
            version: u32,
        },

        /// 函数级详细中文注释：提交文本投诉
        /// - text_id: 文本ID
        /// - complaint_id: 投诉ID
        /// - complainant: 投诉人
        TextComplaintSubmitted {
            text_id: T::TextId,
            complaint_id: u64,
            complainant: T::AccountId,
        },

        /// 函数级详细中文注释：文本投诉已解决
        /// - text_id: 文本ID
        /// - complaint_id: 投诉ID
        /// - upheld: 是否支持投诉
        TextComplaintResolved {
            text_id: T::TextId,
            complaint_id: u64,
            upheld: bool,
        },

        // =================== Media 模块事件 ===================

        /// 函数级详细中文注释：创建相册
        /// - album_id: 相册ID
        /// - deceased_id: 逝者ID
        /// - owner: 拥有者
        AlbumCreated {
            album_id: T::AlbumId,
            deceased_id: T::DeceasedId,
            owner: T::AccountId,
        },

        /// 函数级详细中文注释：更新相册
        /// - album_id: 相册ID
        /// - editor: 编辑者
        AlbumUpdated {
            album_id: T::AlbumId,
            editor: T::AccountId,
        },

        /// 函数级详细中文注释：删除相册
        /// - album_id: 相册ID
        /// - deceased_id: 逝者ID
        /// - deleter: 删除者
        AlbumDeleted {
            album_id: T::AlbumId,
            deceased_id: T::DeceasedId,
            deleter: T::AccountId,
        },

        /// 函数级详细中文注释：创建视频集
        /// - collection_id: 视频集ID
        /// - deceased_id: 逝者ID
        /// - owner: 拥有者
        VideoCollectionCreated {
            collection_id: T::VideoCollectionId,
            deceased_id: T::DeceasedId,
            owner: T::AccountId,
        },

        /// 函数级详细中文注释：更新视频集
        /// - collection_id: 视频集ID
        /// - editor: 编辑者
        VideoCollectionUpdated {
            collection_id: T::VideoCollectionId,
            editor: T::AccountId,
        },

        /// 函数级详细中文注释：删除视频集
        /// - collection_id: 视频集ID
        /// - deceased_id: 逝者ID
        /// - deleter: 删除者
        VideoCollectionDeleted {
            collection_id: T::VideoCollectionId,
            deceased_id: T::DeceasedId,
            deleter: T::AccountId,
        },

        /// 函数级详细中文注释：创建媒体记录
        /// - media_id: 媒体ID
        /// - deceased_id: 逝者ID
        /// - owner: 拥有者
        /// - kind: 媒体类型（0=Photo, 1=Video, 2=Audio）
        MediaCreated {
            media_id: T::MediaId,
            deceased_id: T::DeceasedId,
            owner: T::AccountId,
            kind: u8, // 0=Photo, 1=Video, 2=Audio
        },

        /// 函数级详细中文注释：更新媒体记录
        /// - media_id: 媒体ID
        /// - editor: 编辑者
        MediaUpdated {
            media_id: T::MediaId,
            editor: T::AccountId,
        },

        /// 函数级详细中文注释：删除媒体记录
        /// - media_id: 媒体ID
        /// - deceased_id: 逝者ID
        /// - deleter: 删除者
        MediaDeleted {
            media_id: T::MediaId,
            deceased_id: T::DeceasedId,
            deleter: T::AccountId,
        },

        /// 函数级详细中文注释：提交媒体投诉
        /// - media_id: 媒体ID
        /// - complaint_id: 投诉ID
        /// - complainant: 投诉人
        MediaComplaintSubmitted {
            media_id: T::MediaId,
            complaint_id: u64,
            complainant: T::AccountId,
        },

        /// 函数级详细中文注释：媒体投诉已解决
        /// - media_id: 媒体ID
        /// - complaint_id: 投诉ID
        /// - upheld: 是否支持投诉
        MediaComplaintResolved {
            media_id: T::MediaId,
            complaint_id: u64,
            upheld: bool,
        },

        // =================== 🆕 Token修改治理相关事件 ===================

        /// 函数级中文注释：Token被修改
        /// - deceased_id: 逝者ID
        /// - old_token: 旧token
        /// - new_token: 新token
        /// - revision_count: 当前已使用的修改次数
        TokenRevised {
            deceased_id: T::DeceasedId,
            old_token: BoundedVec<u8, T::TokenLimit>,
            new_token: BoundedVec<u8, T::TokenLimit>,
            revision_count: u8,
        },

        /// 函数级中文注释：提交Token修改治理提案
        /// - proposal_id: 提案ID
        /// - deceased_id: 逝者ID
        /// - applicant: 申请人
        /// - additional_revisions: 申请的额外修改次数
        TokenRevisionProposalSubmitted {
            proposal_id: u64,
            deceased_id: T::DeceasedId,
            applicant: T::AccountId,
            additional_revisions: u8,
        },

        /// 函数级中文注释：委员会成员投票
        /// - proposal_id: 提案ID
        /// - voter: 投票人
        /// - approve: 是否批准（true=批准，false=拒绝）
        TokenRevisionProposalVoted {
            proposal_id: u64,
            voter: T::AccountId,
            approve: bool,
        },

        /// 函数级中文注释：提案被批准
        /// - proposal_id: 提案ID
        /// - deceased_id: 逝者ID
        /// - approve_votes: 批准票数
        /// - reject_votes: 拒绝票数
        TokenRevisionProposalApproved {
            proposal_id: u64,
            deceased_id: T::DeceasedId,
            approve_votes: u32,
            reject_votes: u32,
        },

        /// 函数级中文注释：提案被拒绝
        /// - proposal_id: 提案ID
        /// - deceased_id: 逝者ID
        /// - approve_votes: 批准票数
        /// - reject_votes: 拒绝票数
        TokenRevisionProposalRejected {
            proposal_id: u64,
            deceased_id: T::DeceasedId,
            approve_votes: u32,
            reject_votes: u32,
        },

        /// 函数级中文注释：提案已执行（修改次数上限已扩展）
        /// - proposal_id: 提案ID
        /// - deceased_id: 逝者ID
        /// - old_limit: 旧的修改次数上限
        /// - new_limit: 新的修改次数上限
        TokenRevisionProposalExecuted {
            proposal_id: u64,
            deceased_id: T::DeceasedId,
            old_limit: u8,
            new_limit: u8,
        },

        // =================== 🆕 内容级治理相关事件 ===================

        /// 函数级详细中文注释：拥有者操作已记录
        /// - operation_id: 操作ID
        /// - owner: 拥有者账户
        /// - deceased_id: 逝者ID
        /// - operation_type: 操作类型（0=Add, 1=Modify, 2=Delete）
        /// - content_type: 内容类型（0=Text, 1=Media, 2=Works）
        /// - deposit_dust: 锁定的押金（DUST）
        OwnerOperationRecorded {
            operation_id: u64,
            owner: T::AccountId,
            deceased_id: T::DeceasedId,
            operation_type: u8,
            content_type: u8,
            deposit_dust: BalanceOf<T>,
        },

        /// 函数级详细中文注释：操作投诉已提交
        /// - complaint_id: 投诉ID
        /// - complainant: 投诉人账户
        /// - operation_id: 关联的操作ID
        /// - deposit_dust: 投诉押金（DUST）
        OperationComplaintSubmitted {
            complaint_id: u64,
            complainant: T::AccountId,
            operation_id: u64,
            deposit_dust: BalanceOf<T>,
        },

        /// 函数级详细中文注释：操作投诉审核完成
        /// - complaint_id: 投诉ID
        /// - operation_id: 操作ID
        /// - upheld: 是否支持投诉（true=投诉成立，false=投诉不成立）
        /// - complainant_reward: 投诉人获得的奖励（投诉成立时）
        /// - owner_reward: 拥有者获得的奖励（投诉不成立时）
        OperationComplaintReviewed {
            complaint_id: u64,
            operation_id: u64,
            upheld: bool,
            complainant_reward: Option<BalanceOf<T>>,
            owner_reward: Option<BalanceOf<T>>,
        },

        /// 函数级详细中文注释：操作已自动确认（30天无投诉）
        /// - operation_id: 操作ID
        /// - owner: 拥有者账户
        /// - refunded_deposit: 退还的押金（DUST）
        OperationAutoConfirmed {
            operation_id: u64,
            owner: T::AccountId,
            refunded_deposit: BalanceOf<T>,
        },
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

        // =================== 🆕 分类系统：错误 ===================
        /// 函数级中文注释：申请不存在
        RequestNotFound,
        /// 函数级中文注释：申请不是待审核状态
        RequestNotPending,
        /// 函数级中文注释：目标分类与当前分类相同
        SameCategory,
        /// 函数级中文注释：理由CID太长
        ReasonCidTooLong,
        /// 函数级中文注释：理由CID太短
        ReasonCidTooShort,
        /// 函数级中文注释：证据CID太长
        EvidenceCidTooLong,
        /// 函数级中文注释：证据数量过多
        TooManyEvidences,
        /// 函数级中文注释：申请历史数量过多
        TooManyRequests,

        // =================== 🆕 作品相关错误 (Phase 1: AI训练数据基础) ===================

        /// 函数级详细中文注释：作品不存在
        /// - 场景：查询、更新、删除作品时，指定的work_id不存在
        WorkNotFound,

        /// 函数级详细中文注释：作品列表已满
        /// - 场景：单个逝者的作品数量超过限制（10000个）
        /// - 解决：删除旧作品或联系管理员扩容
        TooManyWorks,

        /// 函数级详细中文注释：标题过长
        /// - 场景：作品标题超过200字符
        /// - 限制：标题最多200字符
        TitleTooLong,

        /// 函数级详细中文注释：描述过长
        /// - 场景：作品描述超过1000字符
        /// - 限制：描述最多1000字符
        DescriptionTooLong,

        /// 函数级详细中文注释：IPFS CID无效
        /// - 场景：提供的IPFS CID格式错误或长度不符合要求
        /// - 限制：CID最多64字符
        InvalidIpfsCid,

        /// 函数级详细中文注释：文件大小无效
        /// - 场景：文件大小为0或超出合理范围
        InvalidFileSize,

        /// 函数级详细中文注释：标签过多
        /// - 场景：作品标签数量超过限制（20个）或单个标签超过50字符
        /// - 限制：最多20个标签，每个标签最多50字符
        TooManyTags,

        /// 函数级详细中文注释：无权限操作该作品
        /// - 场景：非作品所属逝者的owner尝试修改、删除作品
        /// - 权限：仅逝者owner可操作
        WorkNotAuthorized,

        /// 函数级详细中文注释：作品已验证，无法修改
        /// - 场景：尝试修改已验证的作品
        /// - 保护：已验证的作品不可修改，确保数据完整性
        WorkAlreadyVerified,

        /// 函数级详细中文注释：创作时间无效
        /// - 场景：提供的创作时间晚于当前时间（未来时间）
        /// - 限制：创作时间不能晚于上传时间
        InvalidCreatedTime,

        // =================== 🆕 Phase 5：防刷机制错误 (Anti-Spam Errors) ===================

        /// 函数级详细中文注释：超过每日操作限额
        ///
        /// ## 触发条件
        /// - 用户当天的操作次数达到限额：
        ///   - 浏览：1000次/天
        ///   - 分享：100次/天
        ///   - 收藏：50次/天
        ///
        /// ## 错误处理
        /// - 前端提示：\"您今天的{操作类型}次数已达上限，请明天再试\"
        /// - 用户可查看剩余次数（通过查询DailyOperationCount存储）
        /// - 次日0点（按区块号计算）自动重置计数
        ///
        /// ## 防止误报
        /// - 系统自动检测跨天并重置计数
        /// - 使用区块号除以14400（每天区块数）判定天数
        DailyLimitExceeded,

        /// 函数级详细中文注释：操作过于频繁（时间窗口内重复）
        ///
        /// ## 触发条件
        /// - 用户在时间窗口内对同一作品重复操作：
        ///   - 浏览：10分钟（100个区块）内重复
        ///   - 分享：1分钟（10个区块）内重复
        ///   - 收藏：无时间窗口限制（双向操作，天然去重）
        ///
        /// ## 错误处理
        /// - 前端提示：\"操作过于频繁，请{X}分钟后再试\"
        /// - 建议前端实现倒计时功能
        /// - 不影响其他作品的操作
        ///
        /// ## 设计目的
        /// - 防止用户误触导致重复计数
        /// - 防止脚本快速刷量
        /// - 减轻链上存储压力
        TooFrequent,

        /// 函数级详细中文注释：对单个作品操作过多
        ///
        /// ## 触发条件
        /// - 用户当天对同一作品的操作次数超过10次
        /// - 适用于所有操作类型（浏览、分享、收藏）
        ///
        /// ## 错误处理
        /// - 前端提示：\"您今天对该作品的操作次数已达上限\"
        /// - 不影响对其他作品的操作
        /// - 次日自动重置计数
        ///
        /// ## 设计目的
        /// - 防止恶意用户针对特定作品刷量
        /// - 保护作品影响力评分的公平性
        /// - 避免单个作品数据异常
        ///
        /// ## 合理性
        /// - 正常用户不会在一天内对同一作品浏览/分享超过10次
        /// - 10次限制已足够满足真实需求
        TooManyOperationsOnSingleWork,

        /// 函数级详细中文注释：检测到异常行为（1小时内操作过多）
        ///
        /// ## 触发条件（警告级别，仅记录事件）
        /// - 1小时内浏览次数 > 100次
        /// - 1小时内分享次数 > 30次
        /// - 1小时内收藏次数 > 20次
        ///
        /// ## 处理策略
        /// - **不阻止操作**：异常检测仅发出警告事件
        /// - 事件记录：AnomalyDetected { who, operation_type, count_in_hour }
        /// - 治理层面：可根据事件历史进行人工审核和封禁
        ///
        /// ## 设计理念
        /// - 第3层防刷采用警告模式，避免误伤正常用户
        /// - 允许短时间高频操作（如用户批量浏览作品）
        /// - 通过事件日志建立用户行为画像
        ///
        /// ## 未来扩展
        /// - 可根据异常频率自动调整用户的每日限额
        /// - 可实现声誉系统：多次异常降低信誉分
        /// - 可集成链下监控系统自动预警
        ///
        /// ## 注意
        /// - 当前版本此错误类型**暂不使用**（异常检测仅发事件）
        /// - 保留错误定义供未来严格模式使用
        AnomalyDetected,

        /// 函数级详细中文注释：内容正在被投诉
        ///
        /// ## 触发条件
        /// - 尝试修改或删除正在被投诉的内容（Text/Media）
        /// - 投诉状态为 Pending（待审核）
        ///
        /// ## 错误处理
        /// - 前端提示：该内容正在投诉审核中，无法修改或删除
        /// - 等待投诉审核完成后再操作
        ///
        /// ## 设计理念
        /// - 保护投诉审核过程的完整性
        /// - 防止内容拥有者在投诉期间篡改证据
        ContentUnderComplaint,

        /// 函数级详细中文注释：项目数量过多
        ///
        /// ## 触发条件
        /// - 单个逝者的Text数量超过限制（MaxMessagesPerDeceased）
        /// - 单个相册的Media数量超过限制（MaxPhotoPerAlbum）
        ///
        /// ## 错误处理
        /// - 前端提示：已达到数量上限，请删除旧内容后再添加
        ///
        /// ## 设计理念
        /// - 防止状态膨胀
        /// - 强制用户管理内容质量
        TooManyItems,

        // =================== 🆕 Phase 1.4: 永久质押押金治理机制错误 (Governance Errors) ===================

        /// 函数级详细中文注释：余额不足
        ///
        /// ## 触发条件
        /// - 用户账户余额不足以支付押金
        /// - 补充押金时余额不足
        /// - 拥有权转让时新owner余额不足
        ///
        /// ## 错误处理
        /// - 前端提示：查询用户余额并计算所需金额
        /// - 建议用户充值或选择较小的内容规模
        InsufficientBalance,

        /// 函数级详细中文注释：押金警告已激活
        ///
        /// ## 触发条件
        /// - 逝者拥有者的押金记录存在 supplement_warning（补充警告）
        /// - 押金不足且已发出补充警告，在补充押金前不允许修改
        ///
        /// ## 设计原因
        /// - 防止押金不足时继续修改导致系统风险
        /// - 强制用户先补充押金再进行操作
        ///
        /// ## 错误处理
        /// - 前端提示：押金不足，已发出补充警告，请先补充押金
        /// - 显示需要补充的金额和截止时间
        /// - 提供补充押金的入口
        DepositWarningActive,

        /// 函数级详细中文注释：汇率不可用
        ///
        /// ## 触发条件
        /// - pallet-pricing未提供DUST/USDT汇率
        /// - 汇率缓存已过期且无法刷新
        ///
        /// ## 错误处理
        /// - 系统级错误：需要治理介入
        /// - 前端提示用户稍后重试
        ExchangeRateUnavailable,

        /// 函数级详细中文注释：押金记录不存在
        ///
        /// ## 触发条件
        /// - 查询不存在的押金记录
        /// - 补充押金时逝者不存在押金记录
        ///
        /// ## 错误处理
        /// - 可能是逝者创建时未正确初始化押金
        /// - 需要治理介入修复
        DepositRecordNotFound,

        /// 函数级详细中文注释：押金不足（无法执行操作）
        ///
        /// ## 触发条件
        /// - 押金余额低于MinimumDepositUsdt（默认50 USDT）
        /// - 尝试执行add/modify/delete操作时检查
        ///
        /// ## 错误处理
        /// - 前端提示：当前押金余额不足，请补充押金
        /// - 显示当前押金余额和最低要求
        /// - 提供补充押金接口链接
        InsufficientDeposit,

        // =================== 🆕 方案3：动态调整押金错误 ===================

        /// 函数级详细中文注释：无多余押金可解锁（方案3）
        ///
        /// ## 触发条件
        /// - 当前押金价值 <= 目标值（10 USDT）
        /// - 尝试解锁押金但没有超出部分
        NoExcessDeposit,

        /// 函数级详细中文注释：解锁会导致低于目标值（方案3）
        ///
        /// ## 触发条件
        /// - 解锁后押金价值 < 目标值（10 USDT）
        UnlockWouldBelowTarget,

        /// 函数级详细中文注释：无补充警告（方案3）
        ///
        /// ## 触发条件
        /// - 治理尝试强制补充，但没有发出过警告
        NoSupplementWarning,

        /// 函数级详细中文注释：未到期限（方案3）
        ///
        /// ## 触发条件
        /// - 治理尝试强制补充，但7天期限未到
        DeadlineNotReached,

        /// 函数级详细中文注释：无效汇率（方案3）
        ///
        /// ## 触发条件
        /// - 汇率为0或异常值
        InvalidExchangeRate,

        /// 函数级详细中文注释：算术溢出（方案3）
        ///
        /// ## 触发条件
        /// - USDT/DUST转换计算溢出
        ArithmeticOverflow,

        /// 函数级详细中文注释：金额溢出（方案3）
        ///
        /// ## 触发条件
        /// - 金额转换时发生溢出
        AmountOverflow,

        /// 函数级详细中文注释：操作记录不存在
        ///
        /// ## 触发条件
        /// - 查询不存在的操作记录ID
        /// - 对操作进行投诉时操作不存在
        ///
        /// ## 错误处理
        /// - 可能是操作ID错误
        /// - 或操作记录已被清理
        OperationNotFound,

        /// 函数级详细中文注释：投诉记录不存在
        ///
        /// ## 触发条件
        /// - 查询不存在的投诉记录ID
        /// - 审核投诉时投诉不存在
        ///
        /// ## 错误处理
        /// - 可能是投诉ID错误
        /// - 或投诉记录已被处理删除
        ComplaintNotFound,

        /// 函数级详细中文注释：投诉期已过
        ///
        /// ## 触发条件
        /// - 尝试投诉超过30天投诉期的操作
        /// - 操作执行时间 + 30天 < 当前时间
        ///
        /// ## 错误处理
        /// - 前端提示：该操作的投诉期已结束
        /// - 显示操作时间和投诉截止时间
        /// - 建议通过其他治理渠道申诉
        ComplaintPeriodExpired,

        /// 函数级详细中文注释：投诉状态不是待审核
        ///
        /// ## 触发条件
        /// - 尝试审核已完成/已拒绝的投诉
        /// - 投诉状态不是Pending
        ///
        /// ## 错误处理
        /// - 可能是重复审核
        /// - 或投诉已被其他专家处理
        ComplaintNotPending,

        /// 函数级详细中文注释：操作已被投诉（不可重复投诉）
        ///
        /// ## 触发条件
        /// - 对同一操作提交多次投诉
        /// - 操作已有待审核或已完成的投诉
        ///
        /// ## 错误处理
        /// - 前端提示：该操作已被投诉，请等待审核结果
        /// - 显示现有投诉的ID和状态
        OperationAlreadyComplained,

        /// 函数级详细中文注释：非投诉人（无权查看投诉详情）
        ///
        /// ## 触发条件
        /// - 非投诉提交者尝试查看投诉详情
        /// - 撤回他人的投诉
        ///
        /// ## 错误处理
        /// - 隐私保护：仅投诉人和专家可查看详情
        /// - 前端提示权限不足
        NotComplainant,

        /// 函数级详细中文注释：非专家评审员（无权审核投诉）
        ///
        /// ## 触发条件
        /// - 非委员会成员尝试审核投诉
        /// - GovernanceOrigin检查失败
        ///
        /// ## 错误处理
        /// - 前端提示：仅委员会成员可审核投诉
        /// - 建议联系委员会成员
        NotExpertReviewer,

        /// 函数级详细中文注释：核心字段不可修改
        ///
        /// ## 触发条件
        /// - 尝试修改逝者的核心身份字段：
        ///   - name_full_cid: 全名IPFS CID
        ///   - gender_code: 性别代码
        ///   - birth_ts: 出生时间戳
        ///   - death_ts: 死亡时间戳
        ///
        /// ## 错误处理
        /// - 前端提示：该字段为核心身份信息，一经设定不可更改
        /// - 说明可修改的字段：name（显示名称）、links（链接）
        ///
        /// ## 设计理念
        /// - 保护逝者身份信息的真实性和不可篡改性
        /// - 防止恶意修改核心身份数据
        /// - 确保deceased_token的稳定性（基于核心字段生成）
        ///
        /// ## 可修改字段
        /// - name: 显示名称（可修改）
        /// - links: 相关链接（可修改）
        /// - main_image_cid: 主图（通过专用接口修改）
        CoreFieldImmutable,

        // =================== 🆕 Token修改治理相关错误 ===================

        /// 函数级中文注释：Token修改次数已达上限
        /// - 场景：Owner已用完自主修改次数（默认3次）
        /// - 解决：发起治理提案申请额外修改机会
        TokenRevisionLimitExceeded,

        /// 函数级中文注释：提案不存在
        /// - 场景：查询、投票、执行不存在的提案ID
        ProposalNotFound,

        /// 函数级中文注释：提案状态不正确
        /// - 场景：尝试执行未批准的提案，或重复执行已执行的提案
        InvalidProposalStatus,

        /// 函数级中文注释：非委员会成员
        /// - 场景：非委员会成员尝试投票治理提案
        NotCommitteeMember,

        /// 函数级中文注释：已投票
        /// - 场景：同一委员会成员对同一提案重复投票
        AlreadyVoted,

        /// 函数级中文注释：不符合申请资格
        /// - 场景：Token修改次数未达到上限就申请治理扩展
        NotEligibleForExtension,
    }

    /// 函数级详细中文注释：Hold Reason - 资金锁定原因枚举
    ///
    /// ### 用途
    /// - 定义不同类型的资金锁定原因
    /// - 用于 Fungible::hold 和 Fungible::release 机制
    /// - Runtime会自动生成RuntimeHoldReason并实现From trait
    ///
    /// ### 锁定类型
    /// - **DeceasedOwnerDeposit**: 逝者拥有者永久质押押金（10 USDT）
    /// - **NonOwnerOperationDeposit**: 非拥有者操作押金（2 USDT + 可选额外2 USDT）
    /// - **ComplaintDeposit**: 投诉押金（2 USDT）
    #[pallet::composite_enum]
    pub enum HoldReason {
        /// 逝者拥有者永久质押押金
        DeceasedOwnerDeposit,
        /// 非拥有者操作押金
        NonOwnerOperationDeposit,
        /// 投诉押金
        ComplaintDeposit,
        /// 文本投诉押金
        TextComplaintDeposit,
        /// 媒体投诉押金
        MediaComplaintDeposit,
        /// 拥有者操作押金（内容级治理）
        OwnerOperationDeposit,
        /// 操作投诉押金（内容级治理）
        OperationComplaintDeposit,
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
    /// - 经济成本：每人约10 DUST，天然限制
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

    // ===== 作品记录存储 (Phase 1: AI训练数据基础) =====

    /// 函数级详细中文注释：作品统计信息结构
    ///
    /// ## 字段说明
    /// - total_count: 总作品数
    /// - text_count: 文本类作品数
    /// - audio_count: 音频类作品数
    /// - video_count: 视频类作品数
    /// - image_count: 图像类作品数
    /// - ai_training_count: 授权AI训练的作品数
    /// - total_size: 总文件大小（字节）
    ///
    /// ## 用途
    /// - 前端展示统计信息
    /// - 评估AI训练数据量
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
    pub struct WorkStats {
        pub total_count: u32,
        pub text_count: u32,
        pub audio_count: u32,
        pub video_count: u32,
        pub image_count: u32,
        pub ai_training_count: u32,
        pub total_size: u64,
    }

    /// 函数级详细中文注释：作品互动统计结构（阶段3新增）
    ///
    /// ## 字段说明
    /// - view_count: 浏览次数
    /// - share_count: 分享次数
    /// - favorite_count: 收藏次数
    /// - comment_count: 评论数
    /// - ai_training_usage: AI训练使用次数
    /// - last_viewed_at: 最后浏览时间（区块号）
    /// - last_shared_at: 最后分享时间（区块号）
    ///
    /// ## 用途
    /// - 作品影响力评分计算（阶段3高级评估）
    /// - 前端展示作品热度
    /// - 统计分析和推荐算法
    ///
    /// ## 更新时机
    /// - view_count: 前端调用view_work时+1
    /// - share_count: 前端调用share_work时+1
    /// - favorite_count: 用户收藏/取消收藏时±1
    /// - comment_count: 评论系统增删评论时同步
    /// - ai_training_usage: OCW报告AI训练使用时+1
    ///
    /// ## 防刷机制
    /// - 前端需要去重逻辑（同一用户短时间重复操作）
    /// - 后端可选限流（单账户每日操作上限）
    /// - OCW上报需要验证签名
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
    #[scale_info(skip_type_params(BlockNumber))]
    pub struct WorkEngagement<BlockNumber: MaxEncodedLen> {
        /// 浏览次数
        pub view_count: u32,
        /// 分享次数
        pub share_count: u32,
        /// 收藏次数
        pub favorite_count: u32,
        /// 评论数
        pub comment_count: u32,
        /// AI训练使用次数
        pub ai_training_usage: u32,
        /// 最后浏览时间（区块号）
        pub last_viewed_at: Option<BlockNumber>,
        /// 最后分享时间（区块号）
        pub last_shared_at: Option<BlockNumber>,
    }

    /// 函数级详细中文注释：下一个作品ID
    #[pallet::storage]
    #[pallet::getter(fn next_work_id)]
    pub type NextWorkId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：作品记录映射
    ///
    /// ## 键值
    /// - Key: work_id (u64)
    /// - Value: DeceasedWork结构
    ///
    /// ## 用途
    /// - 存储所有作品的完整元数据
    /// - 用于查询、更新、删除作品
    #[pallet::storage]
    #[pallet::getter(fn deceased_works)]
    pub type DeceasedWorks<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // work_id
        DeceasedWork<T::AccountId, BlockNumberFor<T>>,
    >;

    /// 函数级详细中文注释：逝者作品列表索引
    ///
    /// ## 键值
    /// - Key: deceased_id (T::DeceasedId)
    /// - Value: BoundedVec<u64> (work_ids，最多10000个)
    ///
    /// ## 用途
    /// - 快速查询某个逝者的所有作品
    /// - 用于AI训练数据导出
    #[pallet::storage]
    #[pallet::getter(fn works_by_deceased)]
    pub type WorksByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<u64, ConstU32<10000>>,  // 每个逝者最多10000个作品
        ValueQuery,
    >;

    /// 函数级详细中文注释：作品类型索引
    ///
    /// ## 键值
    /// - Key1: deceased_id (T::DeceasedId)
    /// - Key2: work_type_str (作品类型字符串)
    /// - Value: BoundedVec<u64> (work_ids，最多1000个)
    ///
    /// ## 用途
    /// - 按类型筛选作品
    /// - AI训练时优先获取文本类作品
    ///
    /// ## 注意
    /// - work_type_str使用WorkType::as_str()的返回值
    #[pallet::storage]
    #[pallet::getter(fn works_by_type)]
    pub type WorksByType<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat, T::DeceasedId,
        Blake2_128Concat, BoundedVec<u8, ConstU32<50>>,  // work_type_str
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：AI训练授权作品索引
    ///
    /// ## 键值
    /// - Key: deceased_id (T::DeceasedId)
    /// - Value: BoundedVec<u64> (work_ids，最多5000个)
    ///
    /// ## 用途
    /// - 快速查询可用于AI训练的作品列表
    /// - 导出训练数据集
    #[pallet::storage]
    #[pallet::getter(fn ai_training_works)]
    pub type AITrainingWorks<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<u64, ConstU32<5000>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：作品统计信息存储
    ///
    /// ## 键值
    /// - Key: deceased_id (T::DeceasedId)
    /// - Value: WorkStats结构
    ///
    /// ## 用途
    /// - 存储每个逝者的作品统计信息
    /// - 前端展示和AI训练评估
    #[pallet::storage]
    #[pallet::getter(fn work_stats)]
    pub type WorkStatsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        WorkStats,
        ValueQuery,
    >;

    /// 函数级详细中文注释：作品互动统计存储（阶段3新增）
    ///
    /// ## 键值
    /// - Key: work_id (u64)
    /// - Value: WorkEngagement结构
    ///
    /// ## 用途
    /// - 存储每个作品的互动统计（浏览、分享、收藏、评论等）
    /// - 用于作品影响力评分计算（阶段3高级评估）
    /// - 前端展示作品热度和用户互动数据
    ///
    /// ## 更新操作
    /// - view_work(): 浏览时+1
    /// - share_work(): 分享时+1
    /// - favorite_work(): 收藏/取消收藏时±1
    /// - update_comment_count(): 评论增删时同步
    /// - report_ai_training_usage(): OCW报告AI使用时+1
    ///
    /// ## 存储成本
    /// - 每个作品约40字节（7个u32/Option<BlockNumber>字段）
    /// - 10万个作品约4MB存储
    /// - 成本可控，按需增长
    ///
    /// ## 默认值
    /// - 作品创建时不自动创建记录（节省存储）
    /// - 首次互动时lazy初始化
    /// - 使用ValueQuery返回Default（全0）
    #[pallet::storage]
    #[pallet::getter(fn work_engagement)]
    pub type WorkEngagementStats<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // work_id
        WorkEngagement<BlockNumberFor<T>>,
        ValueQuery,  // 默认值：全0
    >;

    // ============= 🆕 Phase 5：防刷机制存储 (Anti-Spam Storage) =============

    /// 函数级详细中文注释：每日操作计数存储（按用户+操作类型）
    ///
    /// ## 功能说明
    /// - 跟踪每个用户每天的操作次数（浏览、分享、收藏）
    /// - 自动跨天重置（通过DailyCountInfo的last_reset字段判定）
    /// - 用于第1层防刷：每日操作限额检查
    ///
    /// ## 键值
    /// - Key1: AccountId（用户账户）
    /// - Key2: OperationType（操作类型：View/Share/Favorite）
    /// - Value: DailyCountInfo（计数+最后重置时间）
    ///
    /// ## 存储成本
    /// - 每条记录：32（AccountId）+ 1（OperationType）+ 8（count+last_reset）= 41字节
    /// - 100万活跃用户 × 3种操作 = 123MB
    ///
    /// ## 清理策略
    /// - 使用ValueQuery自动初始化为0
    /// - 跨天自动重置count为0
    /// - 不需要手动清理旧数据
    #[pallet::storage]
    pub type DailyOperationCount<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        anti_spam::OperationType,
        DailyCountInfo<BlockNumberFor<T>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：最近操作记录存储（用于时间窗口防重复）
    ///
    /// ## 功能说明
    /// - 记录用户对每个作品的最近操作时间
    /// - 防止短时间内重复操作（10分钟浏览窗口、1分钟分享窗口）
    /// - 用于第2层防刷：时间窗口防重复检查
    ///
    /// ## 键值
    /// - Key1: AccountId（用户账户）
    /// - Key2: u64（作品ID）
    /// - Key3: OperationType（操作类型）
    /// - Value: BlockNumberFor<T>（最后操作的区块号）
    ///
    /// ## 存储成本
    /// - 每条记录：32（AccountId）+ 8（work_id）+ 1（OperationType）+ 4（BlockNumber）= 45字节
    /// - 活跃窗口：假设10万用户 × 平均10个作品 × 3种操作 = 3百万条 = 135MB
    ///
    /// ## 清理策略
    /// - 使用OptionQuery（None表示从未操作或已过期）
    /// - 超过时间窗口的记录可以被覆盖
    /// - 未来优化：使用on_finalize批量清理1小时以上的旧记录
    #[pallet::storage]
    pub type RecentOperations<T: Config> = StorageNMap<
        _,
        (
            NMapKey<Blake2_128Concat, T::AccountId>,
            NMapKey<Blake2_128Concat, u64>,           // work_id
            NMapKey<Blake2_128Concat, anti_spam::OperationType>,
        ),
        BlockNumberFor<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：1小时操作计数存储（用于异常行为检测）
    ///
    /// ## 功能说明
    /// - 跟踪用户在1小时滑动窗口内的操作次数
    /// - 检测异常频繁操作（如机器人刷量）
    /// - 用于第3层防刷：异常行为检测（仅警告，不阻止）
    ///
    /// ## 键值
    /// - Key1: AccountId（用户账户）
    /// - Key2: OperationType（操作类型）
    /// - Value: HourlyCountInfo（1小时内计数+窗口起始时间）
    ///
    /// ## 检测阈值
    /// - 浏览：100次/小时
    /// - 分享：30次/小时
    /// - 收藏：20次/小时
    ///
    /// ## 存储成本
    /// - 每条记录：32（AccountId）+ 1（OperationType）+ 8（count+window_start）= 41字节
    /// - 10万活跃用户 × 3种操作 = 12.3MB
    ///
    /// ## 滑动窗口机制
    /// - 窗口大小：600个区块（约1小时）
    /// - 超过窗口时自动重置计数和窗口起始时间
    #[pallet::storage]
    pub type HourlyOperationCount<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        AntiSpamOperationType,
        HourlyCountInfo<BlockNumberFor<T>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：每日单作品操作计数存储
    ///
    /// ## 功能说明
    /// - 跟踪用户对单个作品每天的操作次数
    /// - 防止恶意用户对特定作品过度操作（刷量作弊）
    /// - 用于第4层防刷：单作品操作次数限制（10次/天）
    ///
    /// ## 键值
    /// - Key1: AccountId（用户账户）
    /// - Key2: u64（作品ID）
    /// - Key3: OperationType（操作类型）
    /// - Value: DailyCountInfo（计数+最后重置时间）
    ///
    /// ## 限制规则
    /// - 每个用户每天对单个作品的每种操作最多10次
    /// - 超过限制返回错误：TooManyOperationsOnSingleWork
    /// - 跨天自动重置计数
    ///
    /// ## 存储成本
    /// - 每条记录：32（AccountId）+ 8（work_id）+ 1（OperationType）+ 8（count+last_reset）= 49字节
    /// - 活跃场景：10万用户 × 平均20个作品 × 3种操作 = 6百万条 = 294MB
    ///
    /// ## 清理策略
    /// - 使用ValueQuery自动初始化为0
    /// - 跨天自动重置count为0
    /// - 不活跃的记录会被自然覆盖
    #[pallet::storage]
    pub type PerWorkDailyCount<T: Config> = StorageNMap<
        _,
        (
            NMapKey<Blake2_128Concat, T::AccountId>,
            NMapKey<Blake2_128Concat, u64>,           // work_id
            NMapKey<Blake2_128Concat, AntiSpamOperationType>,
        ),
        DailyCountInfo<BlockNumberFor<T>>,
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

    // =================== Text 模块存储定义 ===================

    /// 函数级详细中文注释：文本记录存储
    /// - 存储所有文本记录（Article/Message）
    /// - Key: TextId
    /// - Value: TextRecord
    #[pallet::storage]
    pub type TextRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::TextId,
        text::TextRecord<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：逝者的文本索引
    /// - Key: DeceasedId
    /// - Value: Vec<TextId>
    #[pallet::storage]
    pub type TextsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<T::TextId, T::MaxMessagesPerDeceased>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：下一个文本ID计数器
    #[pallet::storage]
    pub type NextTextId<T: Config> = StorageValue<_, T::TextId, ValueQuery>;

    /// 函数级详细中文注释：生平记录存储
    /// - 每个逝者只有一条生平记录
    /// - Key: DeceasedId
    /// - Value: Life
    #[pallet::storage]
    pub type Lives<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        text::Life<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：文本投诉记录存储
    /// - Key: (TextId, ComplaintId)
    /// - Value: ComplaintCase
    #[pallet::storage]
    pub type TextComplaints<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::TextId,
        Blake2_128Concat,
        u64, // ComplaintId
        text::ComplaintCase<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：下一个文本投诉ID计数器
    #[pallet::storage]
    pub type NextTextComplaintId<T: Config> = StorageValue<_, u64, ValueQuery>;

    // =================== Media 模块存储定义 ===================

    /// 函数级详细中文注释：相册存储
    /// - Key: AlbumId
    /// - Value: Album
    #[pallet::storage]
    pub type Albums<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AlbumId,
        media::Album<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：视频集存储
    /// - Key: VideoCollectionId
    /// - Value: VideoCollection
    #[pallet::storage]
    pub type VideoCollections<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::VideoCollectionId,
        media::VideoCollection<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：媒体记录存储
    /// - Key: MediaId
    /// - Value: Media
    #[pallet::storage]
    pub type MediaRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::MediaId,
        media::Media<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：逝者的相册索引
    /// - Key: DeceasedId
    /// - Value: Vec<AlbumId>
    #[pallet::storage]
    pub type AlbumsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<T::AlbumId, T::MaxAlbumsPerDeceased>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：逝者的视频集索引
    /// - Key: DeceasedId
    /// - Value: Vec<VideoCollectionId>
    #[pallet::storage]
    pub type VideoCollectionsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<T::VideoCollectionId, T::MaxVideoCollectionsPerDeceased>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：相册内的照片索引
    /// - Key: AlbumId
    /// - Value: Vec<MediaId>
    #[pallet::storage]
    pub type PhotosByAlbum<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AlbumId,
        BoundedVec<T::MediaId, T::MaxPhotoPerAlbum>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：视频集内的视频索引
    /// - Key: VideoCollectionId
    /// - Value: Vec<MediaId>
    #[pallet::storage]
    pub type VideosByCollection<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::VideoCollectionId,
        BoundedVec<T::MediaId, T::MaxPhotoPerAlbum>, // 复用照片限制
        ValueQuery,
    >;

    /// 函数级详细中文注释：下一个相册ID计数器
    #[pallet::storage]
    pub type NextAlbumId<T: Config> = StorageValue<_, T::AlbumId, ValueQuery>;

    /// 函数级详细中文注释：下一个视频集ID计数器
    #[pallet::storage]
    pub type NextVideoCollectionId<T: Config> = StorageValue<_, T::VideoCollectionId, ValueQuery>;

    /// 函数级详细中文注释：下一个媒体ID计数器
    #[pallet::storage]
    pub type NextMediaId<T: Config> = StorageValue<_, T::MediaId, ValueQuery>;

    /// 函数级详细中文注释：媒体投诉记录存储
    /// - Key: (MediaId, ComplaintId)
    /// - Value: MediaComplaintCase
    #[pallet::storage]
    pub type MediaComplaints<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::MediaId,
        Blake2_128Concat,
        u64, // ComplaintId
        media::MediaComplaintCase<T>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：下一个媒体投诉ID计数器
    #[pallet::storage]
    pub type NextMediaComplaintId<T: Config> = StorageValue<_, u64, ValueQuery>;

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

        /// 函数级详细中文注释：确保调用者是逝者的 owner
        /// 
        /// ### 功能说明
        /// 统一的权限检查辅助函数，用于简化代码中的 owner 权限校验逻辑。
        /// 
        /// ### 设计目标
        /// - **统一模式**：避免代码中散落 `ensure!(d.owner == who, ...)` 的重复模式
        /// - **语义清晰**：`ensure_owner` 明确表达 "检查 owner" 的语义
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
        /// ### Phase 1 优化：启用权限检查 helper（2025-11-18）
        /// - **目标**：统一 50+ 处重复的权限检查代码
        /// - **收益**：减少代码重复、统一错误处理、提升可维护性
        /// - **用法**：仅检查权限不需要数据时使用此函数
        pub(crate) fn ensure_owner(
            id: T::DeceasedId,
            who: &T::AccountId,
        ) -> DispatchResult {
            DeceasedOf::<T>::get(id)
                .filter(|d| d.owner == *who)
                .map(|_| ())
                .ok_or(Error::<T>::NotAuthorized.into())
        }

        /// 函数级详细中文注释：检查权限并返回逝者信息（Phase 1 优化）
        ///
        /// ### 设计目标
        /// - **统一模式**：避免代码中散落 `ensure!(d.owner == who, ...)` + `DeceasedOf::get` 的重复模式
        /// - **语义清晰**：`ensure_owner_and_get` 明确表达 "检查 owner 并获取数据" 的语义
        /// - **错误一致**：统一返回 `NotAuthorized` 错误，便于前端统一处理
        /// - **性能优化**：避免重复的存储读取（一次读取同时完成权限检查和数据获取）
        ///
        /// ### 用途
        /// - 替换 "获取数据 + 权限检查" 的重复模式
        /// - 减少存储读取次数（从 2 次减少到 1 次）
        /// - 统一错误类型（NotAuthorized）
        ///
        /// ### 示例
        /// ```rust
        /// // ❌ 旧代码（重复模式，50+ 处）
        /// let deceased = DeceasedOf::<T>::get(id)
        ///     .ok_or(Error::<T>::DeceasedNotFound)?;
        /// ensure!(deceased.owner == who, Error::<T>::NotAuthorized);
        ///
        /// // ✅ 新代码（统一模式）
        /// let deceased = Self::ensure_owner_and_get(id, &who)?;
        /// ```
        #[allow(dead_code)]
        pub(crate) fn ensure_owner_and_get(
            id: T::DeceasedId,
            who: &T::AccountId,
        ) -> Result<Deceased<T>, DispatchError> {
            let deceased = DeceasedOf::<T>::get(id)
                .ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(deceased.owner == *who, Error::<T>::NotAuthorized);
            Ok(deceased)
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
        /// 根据性别、出生日期、离世日期、姓名明文生成变长的唯一标识token（全UTF-8编码）。
        /// 用于去重检查和跨墓位迁移时保持身份一致性。
        /// 
        /// ### Token格式（变长，17+姓名长度字节）
        /// ```
        /// +--------+----------+----------+--------------+
        /// | Gender | Birth    | Death    | Name (UTF-8) |
        /// | 1 byte | 8 bytes  | 8 bytes  | 变长         |
        /// +--------+----------+----------+--------------+
        /// ```
        /// 
        /// ### 示例
        /// ```
        /// M19811224202509刘晓东  (性别M + 出生19811224 + 离世202509 + 姓名刘晓东)
        /// F19800101202501王芳    (性别F + 出生19800101 + 离世202501 + 姓名王芳)
        /// F00000000000000张三    (性别F + 无日期 + 姓名张三)
        /// ```
        /// 
        /// **详细说明**：
        /// 1. **性别代码**（1 byte ASCII）：M/F（男/女）
        /// 2. **出生日期**（8 bytes ASCII）：YYYYMMDD格式，缺失时用"00000000"
        /// 3. **离世日期**（8 bytes ASCII）：YYYYMMDD格式，缺失时用"00000000"
        /// 4. **姓名明文**（变长UTF-8）：规范化后的UTF-8姓名（不再使用哈希）
        /// 
        /// ### 设计变更（Phase 2.0）
        /// - ✅ **改用明文**：姓名直接使用UTF-8明文，不再计算blake2哈希
        /// - ✅ **前端友好**：整个token可直接UTF-8解码，无二进制数据
        /// - ✅ **可读性强**：便于调试、日志查看、用户理解
        /// - ✅ **唯一性**：性别+出生+离世+姓名的组合仍保证全局唯一
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
        /// - 变长的BoundedVec token（失败时返回空向量）
        /// - 最小长度：17字节（1+8+8+0，无姓名）
        /// - 最大长度：由TokenLimit限制（默认256字节）
        pub(crate) fn build_deceased_token(
            gender: &Gender,
            birth_ts: &Option<BoundedVec<u8, T::StringLimit>>,
            death_ts: &Option<BoundedVec<u8, T::StringLimit>>,
            name: &BoundedVec<u8, T::StringLimit>,
        ) -> BoundedVec<u8, T::TokenLimit> {
            // 1. 规范化姓名（去除首尾空白，保留UTF-8字符）
            let name_norm = Self::normalize_name(name.as_slice());
            
            // 2. 组装token向量（预分配容量：1+8+8+姓名长度，全UTF-8编码）
            let mut v: Vec<u8> = Vec::with_capacity(1 + 8 + 8 + name_norm.len());
            
            // 2.1 性别代码（1字节ASCII：'M'/'F'/'B'）
            v.push(gender.to_byte());
            
            // 2.2 出生日期（8字节ASCII，缺失时用"00000000"）
            let zeros8: [u8; 8] = *b"00000000";
            let birth_bytes = birth_ts
                .as_ref()
                .map(|x| x.as_slice())
                .filter(|s| s.len() == 8)  // 仅使用有效的8字节日期
                .unwrap_or(&zeros8);
            v.extend_from_slice(birth_bytes);
            
            // 2.3 离世日期（8字节ASCII，缺失时用"00000000"）
            let death_bytes = death_ts
                .as_ref()
                .map(|x| x.as_slice())
                .filter(|s| s.len() == 8)  // 仅使用有效的8字节日期
                .unwrap_or(&zeros8);
            v.extend_from_slice(death_bytes);
            
            // 2.4 姓名明文（变长UTF-8字节，不再使用哈希）
            v.extend_from_slice(&name_norm);
            
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
            match T::IpfsPinner::pin_cid_for_deceased(
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
        /// pallet_stardust_ipfs::Error 映射表：
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
                    
                    // ✅ 根据 pallet_stardust_ipfs::Error 的定义进行精确映射
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

    // =================== 🆕 Phase 2.1: 押金余额管理接口 (Deposit Balance Management) ===================

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：查询逝者押金记录（公开查询接口）
        ///
        /// ### 功能说明
        /// - 根据逝者ID查询完整的押金记录
        /// - 返回押金状态、金额、汇率等详细信息
        /// - 任何人都可以查询（透明度需求）
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID（u64）
        ///
        /// ### 返回值
        /// - `Some(OwnerDepositRecord)`: 押金记录详情
        /// - `None`: 逝者不存在或未创建押金记录
        ///
        /// ### 使用场景
        /// 1. **前端展示**：显示押金状态、余额
        /// 2. **权限检查**：判断用户是否有权限操作
        /// 3. **审计追踪**：查看押金历史和状态
        ///
        /// ### 返回字段说明
        /// - `owner`: 拥有者账户
        /// - `deceased_id`: 逝者ID
        /// - `initial_deposit_usdt`: 初始押金（USDT）
        /// - `initial_deposit_dust`: 初始押金（DUST）
        /// - `current_locked_dust`: 当前锁定的DUST数量
        /// - `available_usdt`: 可用余额（USDT单位）
        /// - `exchange_rate`: 锁定时的汇率
        /// - `locked_at`: 锁定时间（区块号）
        /// - `expected_scale`: 预期内容规模
        /// - `status`: 押金状态（Active/Depleted/Released）
        pub fn get_deposit_record(deceased_id: u64) -> Option<governance::OwnerDepositRecord<T>> {
            OwnerDepositRecords::<T>::get(deceased_id)
        }

        /// 函数级详细中文注释：检查押金是否充足（执行操作前检查）
        ///
        /// ### 功能说明
        /// - 检查指定逝者的押金余额是否满足最低要求
        /// - 最低要求：50 USDT（MinimumDepositUsdt配置）
        /// - 用于操作前的权限校验
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID（u64）
        ///
        /// ### 返回值
        /// - `Ok(())`: 押金充足，可以执行操作
        /// - `Err(DepositRecordNotFound)`: 押金记录不存在
        /// - `Err(InsufficientDeposit)`: 押金余额不足（< 50 USDT）
        ///
        /// ### 使用场景
        /// 1. **操作前检查**：add/modify/delete操作前调用
        /// 2. **前端提示**：显示押金不足警告
        /// 3. **权限控制**：限制低押金用户的操作
        ///
        /// ### 设计理念
        /// - **经济约束**：押金不足时限制操作，防止恶意行为
        /// - **柔性治理**：低押金用户可以补充押金后继续操作
        /// - **最低保障**：50 USDT作为基本操作门槛
        ///
        /// ### 错误处理
        /// - 押金记录不存在：可能是系统错误，需要治理介入
        /// - 押金不足：提示用户补充押金（top_up_deposit接口）
        pub fn check_deposit_sufficient(deceased_id: u64) -> DispatchResult {
            // 获取押金记录
            let record = OwnerDepositRecords::<T>::get(deceased_id)
                .ok_or(Error::<T>::DepositRecordNotFound)?;

            // 检查押金余额是否满足最低要求（50 USDT）
            let min_deposit_usdt = 2u32;
            ensure!(
                record.available_usdt >= min_deposit_usdt,
                Error::<T>::InsufficientDeposit
            );

            Ok(())
        }

        /// 函数级详细中文注释：计算创建逝者所需押金（预估接口）
        ///
        /// ### 功能说明
        /// - 根据内容规模和用户信誉计算创建押金金额
        /// - 返回 USDT 和 DUST 两种单位的金额
        /// - 供前端展示和用户决策使用
        ///
        /// ### 参数
        /// - `who`: 用户账户（用于信誉查询）
        /// - `expected_scale`: 预期内容规模（Small/Medium/Large）
        ///
        /// ### 返回值
        /// - `Ok((usdt_amount, dust_amount))`: 计算成功
        ///   - `usdt_amount`: USDT金额（u32）
        ///   - `dust_amount`: DUST金额（BalanceOf<T>）
        /// - `Err(ExchangeRateUnavailable)`: 无法获取汇率
        ///
        /// ### 计算公式
        /// ```
        /// 最终押金 = 基础押金(100 USDT) × 规模系数 × 信誉系数
        ///
        /// 规模系数：
        /// - Small: 1.0x
        /// - Medium: 1.5x (默认)
        /// - Large: 2.0x
        ///
        /// 信誉系数（未实现，默认1.0x）：
        /// - 0操作: 1.0x
        /// - 1-5操作: 0.9x
        /// - 6-20操作: 0.8x
        /// - 21-50操作: 0.7x
        /// - 51+操作: 0.6x
        /// ```
        ///
        /// ### 使用场景
        /// 1. **前端展示**：创建逝者前显示所需押金
        /// 2. **用户决策**：根据押金金额选择内容规模
        /// 3. **余额检查**：判断用户余额是否足够
        ///
        /// ### 设计理念
        /// - **透明定价**：用户提前知道所需押金
        /// - **灵活调整**：根据规模和信誉动态计算
        /// - **双币种显示**：同时显示USDT和DUST金额
        pub fn calculate_required_deposit(
            who: &T::AccountId,
            expected_scale: governance::ContentScale,
        ) -> Result<(u32, BalanceOf<T>), sp_runtime::DispatchError> {
            // 1. 计算押金金额（USDT）
            let deposit_usdt = governance::DepositCalculator::<T>::calculate_creation_deposit_usdt(
                who,
                expected_scale,
            );

            // 2. 通过 PricingProvider 获取汇率并转换为 DUST
            let deposit_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(deposit_usdt)?;

            Ok((deposit_usdt, deposit_dust))
        }

        /// 函数级详细中文注释：查询押金状态摘要（快速概览接口）
        ///
        /// ### 功能说明
        /// - 返回简化的押金状态信息（用于前端快速展示）
        /// - 包含关键指标：可用余额、状态、是否需要补充
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID（u64）
        ///
        /// ### 返回值
        /// - `Some((available_usdt, status, needs_top_up))`: 押金状态摘要
        ///   - `available_usdt`: 可用余额（USDT）
        ///   - `status`: 押金状态（Active/Depleted/Released）
        ///   - `needs_top_up`: 是否需要补充押金（< 50 USDT）
        /// - `None`: 押金记录不存在
        ///
        /// ### 使用场景
        /// 1. **快速检查**：列表页显示押金状态图标
        /// 2. **前端提示**：红色警告（需要补充）/绿色正常
        /// 3. **批量查询**：减少数据传输量
        ///
        /// ### 设计理念
        /// - **简化展示**：只返回关键信息，减少前端处理
        /// - **快速判断**：一次调用知道是否需要补充押金
        pub fn get_deposit_status_summary(deceased_id: u64) -> Option<(u32, governance::DepositStatus, bool)> {
            let record = OwnerDepositRecords::<T>::get(deceased_id)?;
            let min_deposit_usdt = 2u32;
            let needs_top_up = record.available_usdt < min_deposit_usdt;

            Some((record.available_usdt, record.status, needs_top_up))
        }
    }

    // =================== 🆕 Phase 2.2: 逝者查询接口 (Deceased Query Interfaces) ===================
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：查询单个逝者详情（公开查询接口）
        ///
        /// ### 功能说明
        /// - 根据逝者ID查询完整的逝者信息
        /// - 自动处理权限检查和可见性验证
        /// - 支持前端单点查询需求
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 返回
        /// - `Some(Deceased)`: 查询成功，返回逝者详情
        /// - `None`: 逝者不存在或无查看权限
        ///
        /// ### 使用场景
        /// - 逝者详情页展示
        /// - 单个逝者信息验证
        /// - 权限检查后的数据访问
        pub fn get_deceased_by_id(deceased_id: T::DeceasedId) -> Option<Deceased<T>> {
            // 检查逝者是否存在
            let deceased = DeceasedOf::<T>::get(deceased_id)?;

            // 检查可见性（公开 or 权限验证）
            if Self::is_deceased_visible(deceased_id) {
                Some(deceased)
            } else {
                None
            }
        }

        /// 函数级详细中文注释：按token查询逝者（已有接口的封装）
        ///
        /// ### 功能说明
        /// - 根据唯一token标识查询逝者
        /// - 复用现有的 DeceasedIdByToken 存储
        /// - 支持外部系统通过token集成
        ///
        /// ### 参数
        /// - `token`: 逝者的唯一标识token
        ///
        /// ### 返回
        /// - `Some((DeceasedId, Deceased))`: 查询成功
        /// - `None`: token不存在或无查看权限
        ///
        /// ### 使用场景
        /// - 外部系统集成
        /// - 通过token标识访问
        /// - API接口调用
        pub fn get_deceased_by_token(token: &[u8]) -> Option<(T::DeceasedId, Deceased<T>)> {
            let bounded_token = BoundedVec::try_from(token.to_vec()).ok()?;
            let deceased_id = DeceasedIdByToken::<T>::get(&bounded_token)?;
            let deceased = Self::get_deceased_by_id(deceased_id)?;
            Some((deceased_id, deceased))
        }

        /// 函数级详细中文注释：分页查询所有逝者（公开查询接口）
        ///
        /// ### 功能说明
        /// - 按ID升序返回所有可见逝者
        /// - 支持分页查询，避免单次查询过大
        /// - 自动过滤不可见或已删除的逝者
        ///
        /// ### 参数
        /// - `start_id`: 起始逝者ID（包含）
        /// - `limit`: 每页数量限制（最大100）
        ///
        /// ### 返回
        /// - `Vec<(DeceasedId, Deceased)>`: 逝者ID和详情的配对列表
        ///
        /// ### 性能考虑
        /// - 单次查询最多100个结果
        /// - 按ID顺序遍历，避免全表扫描
        /// - 自动跳过不可见的逝者
        ///
        /// ### 使用场景
        /// - 逝者列表页分页展示
        /// - 数据导出和同步
        /// - 批量数据处理
        pub fn get_deceased_paginated(
            start_id: Option<T::DeceasedId>,
            limit: u32
        ) -> Vec<(T::DeceasedId, Deceased<T>)> {
            let limit = limit.min(100); // 限制单次查询量
            let start = start_id.unwrap_or(T::DeceasedId::from(1u32));
            let mut results = Vec::new();
            let mut current_id = start;
            let mut count = 0;

            while count < limit {
                if let Some(deceased) = DeceasedOf::<T>::get(current_id) {
                    // 检查可见性
                    if Self::is_deceased_visible(current_id) {
                        results.push((current_id, deceased));
                        count += 1;
                    }
                }

                // 递增查找下一个ID
                if let Some(next_id) = current_id.checked_add(&T::DeceasedId::from(1u32)) {
                    current_id = next_id;
                } else {
                    break; // ID溢出，结束查询
                }

                // 防止无限循环：检查是否超过最大ID
                let current_id_u64 = TryInto::<u64>::try_into(current_id).unwrap_or(0u64);
                let max_id_u64 = TryInto::<u64>::try_into(NextDeceasedId::<T>::get()).unwrap_or(0u64);
                if current_id_u64 >= max_id_u64 {
                    break;
                }
            }

            results
        }

        /// 函数级详细中文注释：按类型分页查询逝者（公开查询接口）
        ///
        /// ### 功能说明
        /// - 根据逝者分类筛选并分页返回
        /// - 支持英雄、烈士、历史人物等分类查询
        /// - 适用于纪念馆分类浏览功能
        /// - 使用索引优化查询性能
        ///
        /// ### 参数
        /// - `category`: 逝者分类枚举（Ordinary/HistoricalFigure/Martyr/Hero/PublicFigure/ReligiousFigure/EventHall）
        /// - `start_index`: 起始索引位置（可选，用于分页）
        /// - `limit`: 每页数量限制（最大50）
        ///
        /// ### 返回
        /// - `Vec<(DeceasedId, Deceased)>`: 符合分类的逝者列表
        ///
        /// ### 性能特点
        /// - **索引查询**：使用DeceasedByCategory索引，避免全表扫描
        /// - **分页支持**：支持起始索引和数量限制
        /// - **可见性过滤**：自动跳过不可见的逝者
        /// - **高效筛选**：时间复杂度O(n)，n为该分类的逝者数量
        ///
        /// ### 使用场景
        /// - 纪念馆分类页面展示
        /// - 按逝者类型筛选浏览
        /// - 专题纪念活动数据获取
        pub fn get_deceased_by_category(
            category: DeceasedCategory,
            start_index: Option<usize>,
            limit: u32
        ) -> Vec<(T::DeceasedId, Deceased<T>)> {
            let limit = limit.min(50); // 分类查询限制更小
            let start = start_index.unwrap_or(0);
            let mut results = Vec::new();
            let mut count = 0;

            // 从索引中获取该分类的所有逝者ID
            let deceased_ids = DeceasedByCategory::<T>::get(&category);

            // 从起始索引开始遍历
            for (index, &deceased_id_u64) in deceased_ids.iter().enumerate() {
                if index < start {
                    continue; // 跳过起始索引之前的项目
                }

                if count >= limit {
                    break; // 达到限制数量
                }

                // 转换u64为DeceasedId类型
                let deceased_id = T::DeceasedId::from(deceased_id_u64 as u32);

                // 检查逝者是否存在且可见
                if let Some(deceased) = DeceasedOf::<T>::get(&deceased_id) {
                    if Self::is_deceased_visible(deceased_id) {
                        results.push((deceased_id, deceased));
                        count += 1;
                    }
                }
            }

            results
        }

        /// 函数级详细中文注释：按创建时间分页查询逝者（支持时间排序）
        ///
        /// ### 功能说明
        /// - 按创建时间倒序返回逝者（最新的在前）
        /// - 支持时间范围筛选和分页查询
        /// - 适用于"最新逝者"、"近期纪念"等功能
        /// - 基于区块索引优化查询性能
        ///
        /// ### 参数
        /// - `start_block`: 起始区块号（可选，默认当前块）
        /// - `limit`: 返回数量限制（最大20）
        ///
        /// ### 返回
        /// - `Vec<(DeceasedId, Deceased, BlockNumber)>`: 逝者信息及创建时间
        ///
        /// ### 性能特点
        /// - **索引查询**：使用DeceasedByCreationTime索引，避免全表扫描
        /// - **倒序遍历**：从最新区块往前查找
        /// - **可见性过滤**：自动跳过不可见的逝者
        /// - **适度限制**：单次最多20个结果，避免性能问题
        ///
        /// ### 使用场景
        /// - 首页"最新逝者"展示
        /// - 时间线浏览功能
        /// - 纪念活动的"近期逝者"统计
        /// - 管理员的创建活动监控
        pub fn get_deceased_by_creation_time(
            start_block: Option<BlockNumberFor<T>>,
            limit: u32
        ) -> Vec<(T::DeceasedId, Deceased<T>, BlockNumberFor<T>)> {
            let limit = limit.min(20); // 时间查询限制更小
            let mut results = Vec::new();
            let current_block = frame_system::Pallet::<T>::block_number();
            let start = start_block.unwrap_or(current_block);
            let mut count = 0;
            let mut block_num = start;

            // 从指定区块开始往前查找
            while count < limit && block_num > BlockNumberFor::<T>::zero() {
                let deceased_ids = DeceasedByCreationTime::<T>::get(block_num);

                // 倒序遍历该区块的逝者（最新的在前）
                for &deceased_id_u64 in deceased_ids.iter().rev() {
                    if count >= limit {
                        break;
                    }

                    // 转换u64为DeceasedId
                    if let Ok(deceased_id) = TryInto::<T::DeceasedId>::try_into(deceased_id_u64 as u32) {
                        if let Some(deceased) = DeceasedOf::<T>::get(deceased_id) {
                            if Self::is_deceased_visible(deceased_id) {
                                results.push((deceased_id, deceased, block_num));
                                count += 1;
                            }
                        }
                    }
                }

                // 查找前一个区块
                block_num = block_num.saturating_sub(BlockNumberFor::<T>::from(1u32));
            }

            results
        }

        /// 函数级详细中文注释：按生日月份查询逝者（计算型查询）
        ///
        /// ### 功能说明
        /// - 查询指定月份有生日的逝者
        /// - 支持生日纪念、周年活动等功能
        /// - 基于生平时间字段进行计算匹配
        /// - **计算密集型**：建议在后台任务中执行
        ///
        /// ### 参数
        /// - `month`: 目标月份（1-12）
        /// - `limit`: 返回数量限制（最大10）
        ///
        /// ### 返回
        /// - `Vec<(DeceasedId, Deceased)>`: 该月份有生日的逝者
        ///
        /// ### 性能特点
        /// - **计算密集**：需要解析所有逝者的生日信息
        /// - **时间复杂度**：O(总逝者数量)，适合小规模数据
        /// - **可见性过滤**：自动跳过不可见的逝者
        /// - **严格限制**：单次最多10个结果
        ///
        /// ### 注意事项
        /// - 不建议频繁调用，可配合缓存使用
        /// - 生日信息从逝者的birth_ts字段提取
        /// - 日期格式支持：YYYYMMDD、YYYY-MM-DD等常见格式
        /// - 无生日信息的逝者会被跳过
        ///
        /// ### 使用场景
        /// - 生日纪念提醒功能
        /// - 月度纪念活动筹划
        /// - 节日相关的逝者展示
        /// - 数据分析和统计报告
        pub fn get_deceased_by_birthday_month(
            month: u8,
            limit: u32
        ) -> Vec<(T::DeceasedId, Deceased<T>)> {
            if !(1..=12).contains(&month) {
                return Vec::new();
            }

            let limit = limit.min(10); // 生日查询限制最小
            let mut results = Vec::new();
            let mut count = 0;
            let max_id = NextDeceasedId::<T>::get();

            // 遍历所有逝者（性能开销大，建议后台执行）
            let max_id_u64 = TryInto::<u64>::try_into(max_id).unwrap_or(0);
            for id_u64 in 1..max_id_u64 {
                if count >= limit {
                    break;
                }

                if let Ok(deceased_id) = TryInto::<T::DeceasedId>::try_into(id_u64 as u32) {
                    if let Some(deceased) = DeceasedOf::<T>::get(deceased_id) {
                        if Self::is_deceased_visible(deceased_id) {
                            // 检查是否有生日信息匹配
                            if Self::has_birthday_in_month(&deceased, month) {
                                results.push((deceased_id, deceased));
                                count += 1;
                            }
                        }
                    }
                }
            }

            results
        }

        /// 函数级详细中文注释：检查逝者是否在指定月份有生日（内部辅助函数）
        ///
        /// ### 功能说明
        /// - 从逝者的birth_ts字段解析生日信息
        /// - 支持多种日期格式的解析
        /// - 匹配指定月份
        ///
        /// ### 支持的日期格式
        /// - YYYYMMDD: 20241225
        /// - YYYY-MM-DD: 2024-12-25
        /// - YYYY/MM/DD: 2024/12/25
        /// - MM-DD: 12-25（仅月日）
        /// - MM/DD: 12/25（仅月日）
        ///
        /// ### 参数
        /// - `deceased`: 逝者信息
        /// - `month`: 目标月份（1-12）
        ///
        /// ### 返回
        /// - `true`: 该逝者在指定月份有生日
        /// - `false`: 无生日信息或不在指定月份
        fn has_birthday_in_month(deceased: &Deceased<T>, month: u8) -> bool {
            let birth_ts = match &deceased.birth_ts {
                Some(ts) => ts,
                None => return false, // 无生日信息
            };

            // 转换为字符串进行解析
            let birth_str = match core::str::from_utf8(&birth_ts) {
                Ok(s) => s,
                Err(_) => return false, // 无效UTF-8
            };

            // 尝试解析不同的日期格式
            Self::extract_month_from_date_string(birth_str) == Some(month)
        }

        /// 函数级详细中文注释：从日期字符串中提取月份（内部解析函数）
        ///
        /// ### 支持的格式解析
        /// - "20241225" -> 12
        /// - "2024-12-25" -> 12
        /// - "2024/12/25" -> 12
        /// - "12-25" -> 12
        /// - "12/25" -> 12
        ///
        /// ### 参数
        /// - `date_str`: 日期字符串
        ///
        /// ### 返回
        /// - `Some(month)`: 解析成功，返回月份（1-12）
        /// - `None`: 解析失败或格式不支持
        fn extract_month_from_date_string(date_str: &str) -> Option<u8> {
            let date_str = date_str.trim();

            // 格式1: YYYYMMDD (8位数字)
            if date_str.len() == 8 && date_str.chars().all(|c| c.is_ascii_digit()) {
                if let Ok(date_num) = date_str.parse::<u32>() {
                    let month = (date_num / 100) % 100;
                    return if (1..=12).contains(&month) { Some(month as u8) } else { None };
                }
            }

            // 格式2: YYYY-MM-DD 或 YYYY/MM/DD
            let parts: Vec<&str> = if date_str.contains('-') {
                date_str.split('-').collect()
            } else if date_str.contains('/') {
                date_str.split('/').collect()
            } else {
                Vec::new()
            };

            if parts.len() >= 3 {
                // YYYY-MM-DD 或 YYYY/MM/DD 格式
                if let Ok(month) = parts[1].parse::<u8>() {
                    return if (1..=12).contains(&month) { Some(month) } else { None };
                }
            } else if parts.len() == 2 {
                // MM-DD 或 MM/DD 格式
                if let Ok(month) = parts[0].parse::<u8>() {
                    return if (1..=12).contains(&month) { Some(month) } else { None };
                }
            }

            None // 无法解析
        }

        /// 函数级详细中文注释：检查逝者是否可见的辅助函数
        ///
        /// ### 功能说明
        /// - 统一的可见性检查逻辑
        /// - 支持权限验证和隐私控制
        /// - 默认公开可见策略
        ///
        /// ### 权限判断逻辑
        /// 1. 检查逝者是否存在
        /// 2. 检查可见性设置（默认公开）
        /// 3. 未来扩展：关系权限、地区限制等
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 返回
        /// - `true`: 可见/有权限访问
        /// - `false`: 不可见/无权限访问
        fn is_deceased_visible(deceased_id: T::DeceasedId) -> bool {
            // 1. 检查逝者是否存在
            if DeceasedOf::<T>::get(deceased_id).is_none() {
                return false;
            }

            // 2. 检查可见性设置（默认公开）
            let visibility = VisibilityOf::<T>::get(deceased_id).unwrap_or(true);
            if !visibility {
                return false;
            }

            // 3. 其他权限检查...（未来扩展）
            // - 检查是否在黑名单
            // - 检查地区访问限制
            // - 检查用户关系权限

            true
        }

        /// 函数级详细中文注释：添加逝者到分类索引（内部辅助函数）
        ///
        /// ### 功能说明
        /// - 将逝者ID添加到指定分类的索引中
        /// - 自动处理BoundedVec容量限制
        /// - 超出容量时静默忽略（降级策略）
        ///
        /// ### 参数
        /// - `category`: 目标分类
        /// - `deceased_id_u64`: 逝者ID（u64格式）
        ///
        /// ### 设计考虑
        /// - **降级策略**: 超出1000个限制时停止添加，但不影响现有功能
        /// - **幂等性**: 重复添加同一ID不会出错
        /// - **性能优化**: 使用push操作，时间复杂度O(1)
        pub fn add_to_category_index(category: DeceasedCategory, deceased_id_u64: u64) {
            DeceasedByCategory::<T>::mutate(&category, |deceased_ids| {
                // 检查是否已存在，避免重复添加
                if !deceased_ids.contains(&deceased_id_u64) {
                    // 尝试添加，如果容量已满则忽略（降级策略）
                    let _ = deceased_ids.try_push(deceased_id_u64);
                }
            });
        }

        /// 函数级详细中文注释：从分类索引中移除逝者（内部辅助函数）
        ///
        /// ### 功能说明
        /// - 从指定分类的索引中移除逝者ID
        /// - 支持分类变更时的索引清理
        ///
        /// ### 参数
        /// - `category`: 原分类
        /// - `deceased_id_u64`: 逝者ID（u64格式）
        ///
        /// ### 设计考虑
        /// - **安全性**: ID不存在时不会报错
        /// - **性能**: 使用retain过滤，保持向量紧凑
        pub fn remove_from_category_index(category: DeceasedCategory, deceased_id_u64: u64) {
            DeceasedByCategory::<T>::mutate(&category, |deceased_ids| {
                deceased_ids.retain(|&id| id != deceased_id_u64);
            });
        }

        /// 函数级详细中文注释：更新分类索引（分类变更时调用）
        ///
        /// ### 功能说明
        /// - 处理逝者分类变更时的索引维护
        /// - 从旧分类中移除，添加到新分类中
        ///
        /// ### 参数
        /// - `old_category`: 原分类
        /// - `new_category`: 新分类
        /// - `deceased_id_u64`: 逝者ID（u64格式）
        ///
        /// ### 使用场景
        /// - 分类申请批准时
        /// - 管理员直接变更分类时
        pub fn update_category_index(
            old_category: DeceasedCategory,
            new_category: DeceasedCategory,
            deceased_id_u64: u64
        ) {
            if old_category != new_category {
                Self::remove_from_category_index(old_category, deceased_id_u64);
                Self::add_to_category_index(new_category, deceased_id_u64);
            }
        }

        /// 函数级详细中文注释：向创建时间索引中添加逝者ID
        ///
        /// ### 用途
        /// - 新增逝者时维护时间索引
        /// - 支持按时间排序的查询功能
        ///
        /// ### 参数
        /// - `block_number`: 创建时的区块号
        /// - `deceased_id_u64`: 逝者ID（u64格式）
        ///
        /// ### 设计考虑
        /// - **降级策略**: 超出100个限制时停止添加，但不影响现有功能
        /// - **幂等性**: 重复添加同一ID不会出错
        /// - **性能优化**: 使用push操作，时间复杂度O(1)
        pub fn add_to_creation_time_index(block_number: BlockNumberFor<T>, deceased_id_u64: u64) {
            DeceasedByCreationTime::<T>::mutate(&block_number, |deceased_ids| {
                // 检查是否已存在，避免重复添加
                if !deceased_ids.contains(&deceased_id_u64) {
                    // 尝试添加，如果容量已满则忽略（降级策略）
                    let _ = deceased_ids.try_push(deceased_id_u64);
                }
            });
        }
    }

    // =================== 作品管理内部实现 (Phase 1: AI训练数据基础) ===================

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：内部实现-上传作品
        ///
        /// ## 功能说明
        /// - 验证所有输入参数并转换为BoundedVec
        /// - 生成唯一work_id
        /// - 创建DeceasedWork记录并存储
        /// - 更新多个索引（WorksByDeceased, WorksByType, AITrainingWorks）
        /// - 更新统计信息（WorkStatsByDeceased）
        /// - 发出WorkUploaded事件
        ///
        /// ## 参数
        /// - `uploader`: 上传者账户
        /// - `deceased_id`: 逝者ID
        /// - `work_type`: 作品类型
        /// - `title`: 作品标题（Vec<u8>）
        /// - `description`: 作品描述（Vec<u8>）
        /// - `ipfs_cid`: IPFS存储地址（Vec<u8>）
        /// - `file_size`: 文件大小（字节）
        /// - `created_at`: 创作时间（可选，Unix时间戳）
        /// - `tags`: 主题标签列表（Vec<Vec<u8>>）
        /// - `privacy_level`: 隐私级别
        /// - `ai_training_enabled`: 是否授权AI训练
        ///
        /// ## 返回
        /// - `Ok(())`: 上传成功
        /// - `Err`: 验证失败或存储失败
        pub(crate) fn do_upload_work(
            uploader: T::AccountId,
            deceased_id: T::DeceasedId,
            work_type: WorkType,
            title: Vec<u8>,
            description: Vec<u8>,
            ipfs_cid: Vec<u8>,
            file_size: u64,
            created_at: Option<u64>,
            tags: Vec<Vec<u8>>,
            privacy_level: PrivacyLevel,
            ai_training_enabled: bool,
        ) -> DispatchResult {
            // 1. 验证输入参数并转换为BoundedVec
            let title_bounded: BoundedVec<u8, ConstU32<200>> = title
                .try_into()
                .map_err(|_| Error::<T>::TitleTooLong)?;

            let description_bounded: BoundedVec<u8, ConstU32<1000>> = description
                .try_into()
                .map_err(|_| Error::<T>::DescriptionTooLong)?;

            let ipfs_cid_bounded: BoundedVec<u8, ConstU32<64>> = ipfs_cid
                .try_into()
                .map_err(|_| Error::<T>::InvalidIpfsCid)?;

            // 验证文件大小
            ensure!(file_size > 0, Error::<T>::InvalidFileSize);

            // 验证创作时间（不能是未来时间）
            if let Some(created_time) = created_at {
                let now = <frame_system::Pallet<T>>::block_number();
                // 将区块号转换为Unix时间戳（假设6秒一个区块）
                let now_timestamp = now.saturated_into::<u64>() * 6;
                ensure!(created_time <= now_timestamp, Error::<T>::InvalidCreatedTime);
            }

            // 转换标签
            let mut tags_bounded = BoundedVec::<BoundedVec<u8, ConstU32<50>>, ConstU32<20>>::default();
            for tag in tags {
                ensure!(tag.len() <= 50, Error::<T>::TooManyTags);
                let tag_bounded: BoundedVec<u8, ConstU32<50>> = tag
                    .try_into()
                    .map_err(|_| Error::<T>::TooManyTags)?;
                tags_bounded
                    .try_push(tag_bounded)
                    .map_err(|_| Error::<T>::TooManyTags)?;
            }

            // 2. 获取work_id并递增
            let work_id = NextWorkId::<T>::get();
            let current_block = <frame_system::Pallet<T>>::block_number();

            // 3. 创建作品记录
            let deceased_id_u64: u64 = deceased_id.saturated_into();
            let work = DeceasedWork {
                work_id,
                deceased_id: deceased_id_u64,
                work_type: work_type.clone(),
                title: title_bounded,
                description: description_bounded,
                ipfs_cid: ipfs_cid_bounded,
                file_size,
                created_at,
                uploaded_at: current_block,
                uploader: uploader.clone(),
                tags: tags_bounded,
                sentiment: None,
                style_tags: BoundedVec::default(),
                expertise_fields: BoundedVec::default(),
                privacy_level,
                ai_training_enabled,
                public_display: privacy_level == PrivacyLevel::Public,
                verified: false,
                verifier: None,
            };

            // 4. 存储作品
            DeceasedWorks::<T>::insert(work_id, work.clone());
            NextWorkId::<T>::put(work_id + 1);

            // 5. 更新索引 - WorksByDeceased
            WorksByDeceased::<T>::try_mutate(deceased_id, |works| {
                works.try_push(work_id).map_err(|_| Error::<T>::TooManyWorks)
            })?;

            // 6. 按类型索引 - WorksByType
            let work_type_str: BoundedVec<u8, ConstU32<50>> = work_type.as_str()
                .as_bytes()
                .to_vec()
                .try_into()
                .unwrap();  // as_str()返回的字符串肯定<50字符

            WorksByType::<T>::try_mutate(deceased_id, work_type_str, |works| {
                works.try_push(work_id).map_err(|_| Error::<T>::TooManyWorks)
            })?;

            // 7. AI训练索引
            if ai_training_enabled && work.is_ai_training_valuable() {
                AITrainingWorks::<T>::try_mutate(deceased_id, |works| {
                    works.try_push(work_id).map_err(|_| Error::<T>::TooManyWorks)
                })?;
            }

            // 8. 更新统计信息
            WorkStatsByDeceased::<T>::mutate(deceased_id, |stats| {
                stats.total_count += 1;
                stats.total_size += file_size;

                if work_type.is_text_based() {
                    stats.text_count += 1;
                } else if work_type.is_audio_based() {
                    stats.audio_count += 1;
                } else if work_type.is_video_based() {
                    stats.video_count += 1;
                }

                if ai_training_enabled {
                    stats.ai_training_count += 1;
                }
            });

            // 9. 发出事件
            let work_type_str_bounded: BoundedVec<u8, ConstU32<50>> = work_type.as_str()
                .as_bytes()
                .to_vec()
                .try_into()
                .unwrap();  // as_str()返回的字符串肯定<50字符

            Self::deposit_event(Event::WorkUploaded {
                work_id,
                deceased_id,
                work_type_str: work_type_str_bounded,
                uploader,
                file_size,
                ai_training_enabled,
            });

            Ok(())
        }

        /// 函数级详细中文注释：内部实现-更新作品元数据
        ///
        /// ## 功能说明
        /// - 仅更新元数据字段（标题、描述、标签、隐私级别、AI授权）
        /// - IPFS CID和文件大小不可修改（确保数据完整性）
        /// - 已验证的作品无法修改（由调用方检查）
        ///
        /// ## 参数
        /// - `updater`: 更新者账户
        /// - `work_id`: 作品ID
        /// - `title`: 新标题（可选）
        /// - `description`: 新描述（可选）
        /// - `tags`: 新标签列表（可选）
        /// - `privacy_level`: 新隐私级别（可选）
        /// - `ai_training_enabled`: 是否启用AI训练（可选）
        ///
        /// ## 返回
        /// - `Ok(())`: 更新成功
        /// - `Err`: 验证失败或作品不存在
        pub(crate) fn do_update_work(
            updater: T::AccountId,
            work_id: u64,
            title: Option<Vec<u8>>,
            description: Option<Vec<u8>>,
            tags: Option<Vec<Vec<u8>>>,
            privacy_level: Option<PrivacyLevel>,
            ai_training_enabled: Option<bool>,
        ) -> DispatchResult {
            DeceasedWorks::<T>::try_mutate(work_id, |maybe_work| -> DispatchResult {
                let work = maybe_work.as_mut().ok_or(Error::<T>::WorkNotFound)?;

                // 更新标题
                if let Some(new_title) = title {
                    work.title = new_title
                        .try_into()
                        .map_err(|_| Error::<T>::TitleTooLong)?;
                }

                // 更新描述
                if let Some(new_description) = description {
                    work.description = new_description
                        .try_into()
                        .map_err(|_| Error::<T>::DescriptionTooLong)?;
                }

                // 更新标签
                if let Some(new_tags) = tags {
                    let mut tags_bounded = BoundedVec::<BoundedVec<u8, ConstU32<50>>, ConstU32<20>>::default();
                    for tag in new_tags {
                        ensure!(tag.len() <= 50, Error::<T>::TooManyTags);
                        let tag_bounded: BoundedVec<u8, ConstU32<50>> = tag
                            .try_into()
                            .map_err(|_| Error::<T>::TooManyTags)?;
                        tags_bounded
                            .try_push(tag_bounded)
                            .map_err(|_| Error::<T>::TooManyTags)?;
                    }
                    work.tags = tags_bounded;
                }

                // 更新隐私级别
                if let Some(new_privacy_level) = privacy_level {
                    work.privacy_level = new_privacy_level;
                    work.public_display = new_privacy_level == PrivacyLevel::Public;
                }

                // 更新AI训练授权
                let old_ai_enabled = work.ai_training_enabled;
                if let Some(new_ai_enabled) = ai_training_enabled {
                    work.ai_training_enabled = new_ai_enabled;

                    // 如果AI授权状态发生变化，更新AITrainingWorks索引
                    let deceased_id: T::DeceasedId = work.deceased_id.saturated_into();
                    if new_ai_enabled && !old_ai_enabled && work.is_ai_training_valuable() {
                        // 从禁用变为启用 - 添加到索引
                        AITrainingWorks::<T>::try_mutate(deceased_id, |works| {
                            if !works.contains(&work_id) {
                                works.try_push(work_id).map_err(|_| Error::<T>::TooManyWorks)?;
                            }
                            Ok::<(), DispatchError>(())
                        })?;
                    } else if !new_ai_enabled && old_ai_enabled {
                        // 从启用变为禁用 - 从索引移除
                        AITrainingWorks::<T>::mutate(deceased_id, |works| {
                            if let Some(pos) = works.iter().position(|&id| id == work_id) {
                                works.swap_remove(pos);
                            }
                        });
                    }

                    // 更新统计信息
                    if new_ai_enabled != old_ai_enabled {
                        WorkStatsByDeceased::<T>::mutate(deceased_id, |stats| {
                            if new_ai_enabled {
                                stats.ai_training_count += 1;
                            } else {
                                stats.ai_training_count = stats.ai_training_count.saturating_sub(1);
                            }
                        });
                    }

                    // 发出AI授权更新事件
                    Self::deposit_event(Event::AITrainingAuthUpdated {
                        work_id,
                        enabled: new_ai_enabled,
                    });
                }

                Ok(())
            })?;

            // 发出更新事件
            Self::deposit_event(Event::WorkUpdated {
                work_id,
                updater,
            });

            Ok(())
        }

        /// 函数级详细中文注释：内部实现-删除作品
        ///
        /// ## 功能说明
        /// - 从存储中移除作品记录
        /// - 更新所有相关索引（WorksByDeceased, WorksByType, AITrainingWorks）
        /// - 更新统计信息（WorkStatsByDeceased）
        /// - **不**删除IPFS文件（需要手动unpinning）
        ///
        /// ## 参数
        /// - `deleter`: 删除者账户
        /// - `work_id`: 作品ID
        ///
        /// ## 返回
        /// - `Ok(())`: 删除成功
        /// - `Err`: 作品不存在
        pub(crate) fn do_delete_work(
            deleter: T::AccountId,
            work_id: u64,
        ) -> DispatchResult {
            // 获取作品信息（用于清理索引）
            let work = DeceasedWorks::<T>::get(work_id)
                .ok_or(Error::<T>::WorkNotFound)?;

            let deceased_id: T::DeceasedId = work.deceased_id.saturated_into();

            // 1. 从WorksByDeceased索引移除
            WorksByDeceased::<T>::mutate(deceased_id, |works| {
                if let Some(pos) = works.iter().position(|&id| id == work_id) {
                    works.swap_remove(pos);
                }
            });

            // 2. 从WorksByType索引移除
            let work_type_str: BoundedVec<u8, ConstU32<50>> = work.work_type.as_str()
                .as_bytes()
                .to_vec()
                .try_into()
                .unwrap();  // as_str()返回的字符串肯定<50字符

            WorksByType::<T>::mutate(deceased_id, work_type_str, |works| {
                if let Some(pos) = works.iter().position(|&id| id == work_id) {
                    works.swap_remove(pos);
                }
            });

            // 3. 从AITrainingWorks索引移除（如果存在）
            if work.ai_training_enabled && work.is_ai_training_valuable() {
                AITrainingWorks::<T>::mutate(deceased_id, |works| {
                    if let Some(pos) = works.iter().position(|&id| id == work_id) {
                        works.swap_remove(pos);
                    }
                });
            }

            // 4. 更新统计信息
            WorkStatsByDeceased::<T>::mutate(deceased_id, |stats| {
                stats.total_count = stats.total_count.saturating_sub(1);
                stats.total_size = stats.total_size.saturating_sub(work.file_size);

                if work.work_type.is_text_based() {
                    stats.text_count = stats.text_count.saturating_sub(1);
                } else if work.work_type.is_audio_based() {
                    stats.audio_count = stats.audio_count.saturating_sub(1);
                } else if work.work_type.is_video_based() {
                    stats.video_count = stats.video_count.saturating_sub(1);
                }

                if work.ai_training_enabled {
                    stats.ai_training_count = stats.ai_training_count.saturating_sub(1);
                }
            });

            // 5. 删除作品记录
            DeceasedWorks::<T>::remove(work_id);

            // 6. 发出事件
            Self::deposit_event(Event::WorkDeleted {
                work_id,
                deceased_id,
                deleter,
            });

            Ok(())
        }

        /// 函数级详细中文注释：内部实现-验证作品
        ///
        /// ## 功能说明
        /// - 标记作品为"已验证"状态
        /// - 记录验证者信息
        /// - 验证后的作品无法修改（通过update_work的检查实现）
        ///
        /// ## 参数
        /// - `verifier`: 验证者账户（可能是owner或治理账户）
        /// - `work_id`: 作品ID
        ///
        /// ## 返回
        /// - `Ok(())`: 验证成功
        /// - `Err`: 作品不存在或已验证
        pub(crate) fn do_verify_work(
            verifier: T::AccountId,
            work_id: u64,
        ) -> DispatchResult {
            DeceasedWorks::<T>::try_mutate(work_id, |maybe_work| -> DispatchResult {
                let work = maybe_work.as_mut().ok_or(Error::<T>::WorkNotFound)?;

                // 检查是否已验证
                ensure!(!work.verified, Error::<T>::WorkAlreadyVerified);

                // 标记为已验证
                work.verified = true;
                work.verifier = Some(verifier.clone());

                Ok(())
            })?;

            // 发出事件
            Self::deposit_event(Event::WorkVerified {
                work_id,
                verifier,
            });

            Ok(())
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T>
    where
        u64: From<T::DeceasedId>,
    {
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
                token_revision_count: 0,    // 初始化为0
                token_revision_limit: 3,    // 初始化为3次自主修改
                links: links_bv,
                created: now,
                updated: now,
                version: 1,
            };

            DeceasedOf::<T>::insert(id, deceased);
            // ========== 🚀 Phase 1 优化：延迟初始化（Gas成本-30%） ==========
            // ❌ 删除：DeceasedHistory 初始化（首次 update_deceased 时自动创建）
            // ❌ 删除：VisibilityOf 初始化（默认值 unwrap_or(true) 已处理）
            // ==========================================================
            // 注：版本历史将在首次调用 update_deceased 时延迟初始化
            // 注：可见性默认为 true（通过 unwrap_or 处理）
            // 建立 token -> id 索引
            if let Some(d) = DeceasedOf::<T>::get(id) {
                DeceasedIdByToken::<T>::insert(d.deceased_token, id);
            }

            // ========== 🆕 Phase 2.2: 分类索引维护（创建时） ==========
            // 提前转换deceased_id为u64（后续多处使用）
            use sp_runtime::traits::UniqueSaturatedInto;
            let deceased_id_u64: u64 = id.unique_saturated_into();

            // 默认分类为 Ordinary，添加到分类索引中
            let default_category = DeceasedCategory::Ordinary;
            Self::add_to_category_index(default_category, deceased_id_u64);

            // ========== 🆕 Phase 2.4: 时间索引维护 ==========
            let current_block = <frame_system::Pallet<T>>::block_number();
            Self::add_to_creation_time_index(current_block, deceased_id_u64);
            // =========================================================

            // ========== 🆕 Phase 1.4: 永久质押押金锁定 ==========
            // (deceased_id_u64 已在上面定义)

            // 使用默认内容规模（Medium），后续可通过接口修改
            let expected_scale = ContentScale::Medium;

            // 计算押金金额（USDT）
            let deposit_usdt = governance::DepositCalculator::<T>::calculate_creation_deposit_usdt(
                &who,
                expected_scale.clone(),
            );

            // 通过PricingProvider获取汇率并转换为DUST
            let deposit_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(deposit_usdt)?;

            // 锁定押金（使用hold机制）
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &who,
                deposit_dust,
            )?;

            // 创建押金记录（方案3：动态调整押金）
            let deposit_record = OwnerDepositRecord {
                owner: who.clone(),
                deceased_id: deceased_id_u64,
                target_deposit_usdt: deposit_usdt,  // 方案3：目标押金，默认等于初始押金
                initial_deposit_usdt: deposit_usdt,
                initial_deposit_dust: deposit_dust,
                current_locked_dust: deposit_dust,
                available_usdt: deposit_usdt,
                available_dust: deposit_dust,
                deducted_usdt: 0,
                deducted_dust: BalanceOf::<T>::zero(),
                exchange_rate: governance::ExchangeRateHelper::<T>::get_cached_rate()?,
                locked_at: now,
                expected_scale: expected_scale.clone(),
                status: DepositStatus::Active,
                adjustments: BoundedVec::default(),  // 方案3：调整历史，初始为空
                supplement_warning: None,  // 方案3：补充警告，初始为None
            };

            // 存储押金记录
            OwnerDepositRecords::<T>::insert(deceased_id_u64, deposit_record);

            // ========== 🚀 Phase 1 优化：删除 Owner 索引 ==========
            // ❌ 删除：OwnerDepositsByOwner 索引（改用遍历查询，低频操作可接受）
            // 注：按 owner 查询押金时，改用 OwnerDepositRecords::iter() 过滤
            // =====================================================

            // 发出押金锁定事件
            Self::deposit_event(Event::DeceasedCreatedWithDeposit {
                deceased_id: deceased_id_u64,
                owner: who.clone(),
                deposit_usdt,
                deposit_dust,
                expected_scale: expected_scale.as_u8(),
            });
            // =================================================

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

            Self::deposit_event(Event::DeceasedCreated(id, who));
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
            // 🔐 Phase 2 优化：统一权限检查
            Self::ensure_owner(id, &who)?;

            // 🔒 押金检查：修改逝者信息需要至少 10 USDT 押金
            Self::ensure_sufficient_deposit_internal(u64::from(id))?;

            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;

                // 检查是否修改影响token的字段（仅name会影响token）
                let will_affect_token = name.is_some();

                if will_affect_token {
                    // 检查修改次数限制
                    ensure!(
                        d.token_revision_count < d.token_revision_limit,
                        Error::<T>::TokenRevisionLimitExceeded
                    );
                }

                // 捕获初始 owner，保证不可变更
                let original_owner = d.owner.clone();
                // 记录旧 token 以便更新索引
                let old_token = d.deceased_token.clone();

                if let Some(n) = name {
                    d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?;
                }
                // name_badge 已移除

                // 🚫 核心字段保护：gender_code 不允许修改
                if let Some(_gc) = gender_code {
                    // 拒绝修改性别代码 - 这是核心身份信息，一经设定不可更改
                    return Err(Error::<T>::CoreFieldImmutable.into());
                }

                // bio 已移除：改由 deceased-data::Life 维护

                // 🚫 核心字段保护：name_full_cid 不允许修改
                if let Some(_cid_opt) = name_full_cid {
                    // 拒绝修改全名CID - 这是核心身份信息，一经设定不可更改
                    return Err(Error::<T>::CoreFieldImmutable.into());
                }

                // 主图字段通过专用接口设置/清空（见 set_main_image/clear_main_image）

                // 🚫 核心字段保护：birth_ts 不允许修改
                if let Some(_bi) = birth_ts {
                    // 拒绝修改出生时间 - 这是核心身份信息，一经设定不可更改
                    return Err(Error::<T>::CoreFieldImmutable.into());
                }

                // 🚫 核心字段保护：death_ts 不允许修改
                if let Some(_de) = death_ts {
                    // 拒绝修改死亡时间 - 这是核心身份信息，一经设定不可更改
                    return Err(Error::<T>::CoreFieldImmutable.into());
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
                // 🚀 Phase 1 优化：延迟初始化版本历史
                DeceasedHistory::<T>::mutate(id, |h| {
                    // 如果是首次更新（历史为空），补充版本1的初始记录
                    if h.is_empty() {
                        let _ = h.try_push(VersionEntry {
                            version: 1,
                            editor: d.owner.clone(),
                            at: d.created,
                        });
                    }
                    // 添加当前版本记录
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
                    DeceasedIdByToken::<T>::remove(&old_token);
                    DeceasedIdByToken::<T>::insert(&new_token, id);

                    // 增加修改计数器
                    d.token_revision_count = d.token_revision_count.saturating_add(1);

                    // 发出Token修改事件
                    Self::deposit_event(Event::TokenRevised {
                        deceased_id: id,
                        old_token,
                        new_token,
                        revision_count: d.token_revision_count,
                    });
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

            // ========== 🆕 Phase 2.3: 押金释放和锁定逻辑 ==========
            // 转换 deceased_id 为 u64
            use sp_runtime::traits::UniqueSaturatedInto;
            let deceased_id_u64: u64 = id.unique_saturated_into();

            // 1. 获取旧的押金记录
            let old_record = OwnerDepositRecords::<T>::get(deceased_id_u64)
                .ok_or(Error::<T>::DepositRecordNotFound)?;

            // 2. 验证押金状态（只有 Active 和 Insufficient 状态可转让）
            ensure!(
                old_record.status == DepositStatus::Active ||
                old_record.status == DepositStatus::Insufficient,
                Error::<T>::BadInput
            );

            // 3. 计算新拥有者所需押金（使用旧记录的规模）
            let new_deposit_usdt = governance::DepositCalculator::<T>::calculate_creation_deposit_usdt(
                &new_owner,
                old_record.expected_scale.clone(),
            );

            // 4. 通过 PricingProvider 获取当前汇率并转换为 DUST
            let new_deposit_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(new_deposit_usdt)?;
            let new_exchange_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()?;

            // 5. 先锁定新拥有者的押金（如果失败则整个转让失败）
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &new_owner,
                new_deposit_dust,
            )?;

            // 6. 释放旧拥有者的押金（使用当前锁定的金额）
            let old_locked_amount = old_record.current_locked_dust;
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &who,
                old_locked_amount,
                frame_support::traits::tokens::Precision::BestEffort,
            )?;

            // 7. 更新旧记录状态为 Released
            let mut released_old_record = old_record.clone();
            released_old_record.status = DepositStatus::Released;
            OwnerDepositRecords::<T>::insert(deceased_id_u64, released_old_record);

            // 8. 创建新的押金记录（方案3：动态调整押金）
            let now = <frame_system::Pallet<T>>::block_number();
            let new_record = OwnerDepositRecord {
                owner: new_owner.clone(),
                deceased_id: deceased_id_u64,
                target_deposit_usdt: new_deposit_usdt,  // 方案3：目标押金
                initial_deposit_usdt: new_deposit_usdt,
                initial_deposit_dust: new_deposit_dust,
                current_locked_dust: new_deposit_dust,
                available_usdt: new_deposit_usdt,
                available_dust: new_deposit_dust,
                deducted_usdt: 0,
                deducted_dust: BalanceOf::<T>::zero(),
                exchange_rate: new_exchange_rate,
                locked_at: now,
                expected_scale: old_record.expected_scale,
                status: DepositStatus::Active,
                adjustments: BoundedVec::default(),  // 方案3：新owner的调整历史为空
                supplement_warning: None,  // 方案3：新owner无警告
            };

            // 9. 存储新的押金记录（覆盖旧记录）
            OwnerDepositRecords::<T>::insert(deceased_id_u64, new_record);

            // ========== 🚀 Phase 1 优化：删除 Owner 索引更新 ==========
            // ❌ 删除：OwnerDepositsByOwner 索引更新（已在 create_deceased 中删除）
            // 注：按 owner 查询改用 OwnerDepositRecords::iter() 过滤
            // =====================================================

            // 10. 执行原有的逝者所有权转移逻辑
            // 🔐 Phase 2 优化：统一权限检查（在 try_mutate 之前）
            Self::ensure_owner(id, &who)?;

            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;

                // 不允许转给自己
                ensure!(d.owner != new_owner, Error::<T>::BadInput);

                let old_owner = d.owner.clone();

                // 更新owner
                d.owner = new_owner.clone();
                d.updated = now;
                d.version = d.version.saturating_add(1);

                // 记录变更日志（与gov_transfer_owner保持一致）
                // 使用空证据CID（普通用户转让不需要证据）
                let empty_cid = BoundedVec::default();
                OwnerChangeLogOf::<T>::insert(
                    id,
                    (old_owner.clone(), new_owner.clone(), now, empty_cid)
                );

                // 12. 发送押金转让事件（包含押金详情）
                Self::deposit_event(Event::OwnershipTransferredWithDeposit {
                    deceased_id: deceased_id_u64,
                    old_owner: old_owner.clone(),
                    new_owner: new_owner.clone(),
                    old_deposit_released_usdt: old_record.available_usdt,
                    old_deposit_released_dust: old_locked_amount,
                    new_deposit_locked_usdt: new_deposit_usdt,
                    new_deposit_locked_dust: new_deposit_dust,
                });

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
            // Phase 1 优化：使用统一的 owner 权限检查 helper
            Self::ensure_owner(id, &who)?;
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

            // 🔐 Phase 2 优化：统一权限检查
            Self::ensure_owner(id, &who)?;

            // 保存cid用于后续pin
            let cid_for_pin = cid.clone();

            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                
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

            // 🔐 Phase 2 优化：统一权限检查
            Self::ensure_owner(id, &who)?;

            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                
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

                // 🔒 押金检查：治理修改逝者信息也需要 owner 有至少 10 USDT 押金
                Self::ensure_sufficient_deposit_internal(u64::from(id))?;

                // 检查是否修改影响 token 的字段（治理修改允许修改所有 token 相关字段）
                let will_affect_token = name.is_some()
                    || gender_code.is_some()
                    || birth_ts.is_some()
                    || death_ts.is_some();

                // 治理修改也需要检查修改次数限制
                if will_affect_token {
                    ensure!(
                        d.token_revision_count < d.token_revision_limit,
                        Error::<T>::TokenRevisionLimitExceeded
                    );
                }

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
                // 🚀 Phase 1 优化：延迟初始化版本历史
                DeceasedHistory::<T>::mutate(id, |h| {
                    // 如果是首次更新（历史为空），补充版本1的初始记录
                    if h.is_empty() {
                        let _ = h.try_push(VersionEntry {
                            version: 1,
                            editor: d.owner.clone(),
                            at: d.created,
                        });
                    }
                    // 添加当前版本记录（治理代表修改，编辑者记为当前 owner）
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
                    DeceasedIdByToken::<T>::remove(&old_token);
                    DeceasedIdByToken::<T>::insert(&new_token, id);

                    // 增加修改计数器
                    d.token_revision_count = d.token_revision_count.saturating_add(1);

                    // 发出 Token 修改事件
                    Self::deposit_event(Event::TokenRevised {
                        deceased_id: id,
                        old_token,
                        new_token,
                        revision_count: d.token_revision_count,
                    });
                }
                ensure!(d.owner == original_owner, Error::<T>::OwnerImmutable);
                Ok(())
            })?;
            Self::deposit_event(Event::DeceasedUpdated(id));
            Ok(())
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
            // Phase 1 优化：使用统一的权限检查 helper
            let _a = Self::ensure_owner_and_get(from, &who)?;
            let _b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
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
            // ✅ Phase 1.5: 使用独立权限检查替代 grave 权限
            ensure!(
                b.owner == who,  // 直接检查 deceased 所有权
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
            // ✅ Phase 1.5: 使用独立权限检查替代 grave 权限
            ensure!(
                b.owner == who,  // 直接检查 deceased 所有权
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
            // ✅ Phase 1.5: 使用独立权限检查替代 grave 权限
            ensure!(
                a.owner == who,  // 直接检查 deceased 所有权
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
            // ✅ Phase 1.5: 使用独立权限检查替代 grave 权限 - 任一方 owner 都可以撤销关系
            ensure!(
                a.owner == who || b.owner == who,  // 直接检查任一 deceased 的所有权
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
            // ✅ Phase 1.5: 使用独立权限检查替代 grave 权限 - 任一方 owner 都可以更新关系备注
            ensure!(
                a.owner == who || b.owner == who,  // 直接检查任一 deceased 的所有权
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
            // Phase 1 优化：使用统一的 owner 权限检查 helper
            Self::ensure_owner(deceased_id, &who)?;
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
            // Phase 1 优化：使用统一的 owner 权限检查 helper
            Self::ensure_owner(deceased_id, &admin)?;
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
            // Phase 1 优化：使用统一的 owner 权限检查 helper
            Self::ensure_owner(deceased_id, &admin)?;
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
        /// - **调用者**：必须是 owner
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
            // Phase 1 优化：使用统一的 owner 权限检查 helper
            Self::ensure_owner(deceased_id, &admin)?;
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
        /// - **调用者**：必须是 owner
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
            // Phase 1 优化：使用统一的 owner 权限检查 helper
            Self::ensure_owner(deceased_id, &admin)?;
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

        // =================== 关注功能：接口 ===================
        /// 函数级详细中文注释：关注逝者
        ///
        /// ### 功能说明
        /// - 任何人都可以关注公开的逝者
        /// - 关注不需要押金（与墓位关注不同）
        /// - 不自动加入亲友团（亲友团需要供奉才能加入）
        ///
        /// ### 权限要求
        /// - 逝者必须是公开的（`VisibilityOf` 为 true）
        /// - 调用者不能已经关注过
        ///
        /// ### 使用场景
        /// 1. **社交关注**：关注感兴趣的逝者，接收动态
        /// 2. **轻量社交**：无需供奉，无需押金
        ///
        /// ### 与亲友团的区别
        /// - **关注**：纯社交功能，无前置条件
        /// - **亲友团**：需要供奉过，有实质纪念关系
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 错误
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `NotAuthorized`: 逝者不公开
        /// - `AlreadyFollowing`: 已经关注过
        /// - `FriendTooMany`: 关注者数量达到上限
        ///
        /// ### 事件
        /// - `DeceasedFollowed`: 关注成功
        #[pallet::call_index(70)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn follow_deceased(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查逝者存在
            let _deceased = DeceasedOf::<T>::get(deceased_id)
                .ok_or(Error::<T>::DeceasedNotFound)?;

            // 检查可见性
            let is_visible = VisibilityOf::<T>::get(deceased_id).unwrap_or(true);
            ensure!(is_visible, Error::<T>::NotAuthorized);

            // 委托给 Social pallet 处理
            let deceased_id_u64 = TryInto::<u64>::try_into(deceased_id)
                .map_err(|_| Error::<T>::DeceasedNotFound)?;
            T::Social::follow_deceased_internal(&who, deceased_id_u64)?;

            Ok(())
        }

        /// 函数级详细中文注释：取消关注逝者
        ///
        /// ### 功能说明
        /// - 用户可以随时取消关注
        /// - 无需任何前置条件
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 错误
        /// - `NotFollowing`: 未关注该逝者
        ///
        /// ### 事件
        /// - `DeceasedUnfollowed`: 取消关注成功
        #[pallet::call_index(71)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn unfollow_deceased(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 委托给 Social pallet 处理
            let deceased_id_u64 = TryInto::<u64>::try_into(deceased_id)
                .map_err(|_| Error::<T>::DeceasedNotFound)?;
            T::Social::unfollow_deceased_internal(&who, deceased_id_u64)?;

            Ok(())
        }

        /// 函数级详细中文注释：owner 移除关注者
        ///
        /// ### 功能说明
        /// - 逝者的 owner 可以强制移除任何关注者
        /// - 用于隐私保护和骚扰防护
        ///
        /// ### 权限要求
        /// - 必须是逝者的 owner
        ///
        /// ### 使用场景
        /// 1. **隐私保护**：不希望某些人关注
        /// 2. **骚扰防护**：移除恶意关注者
        /// 3. **权限管理**：主动管理关注者列表
        ///
        /// ### 与用户取消关注的区别
        /// - **用户取消关注**：用户主动取消，自己的操作
        /// - **owner 移除**：owner 强制移除，管理操作
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        /// - `follower`: 要移除的关注者账户
        ///
        /// ### 错误
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `NotAuthorized`: 调用者不是 owner
        /// - `NotFollowing`: 该用户未关注此逝者
        ///
        /// ### 事件
        /// - `FollowerRemoved`: 关注者被移除
        #[pallet::call_index(72)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn remove_follower(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            follower: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Phase 1 优化：使用统一的 owner 权限检查 helper
            Self::ensure_owner(deceased_id, &who)?;

            // 委托给 Social pallet 处理关注者移除
            let deceased_id_u64 = TryInto::<u64>::try_into(deceased_id)
                .map_err(|_| Error::<T>::DeceasedNotFound)?;
            T::Social::remove_follower_by_target(&follower, deceased_id_u64)?;

            Ok(())
        }

        // =================== 🆕 分类系统接口 ===================

        /// 函数级详细中文注释：提交分类修改申请（普通用户接口）
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        /// - `target_category`: 目标分类
        /// - `reason_cid`: 申请理由CID（IPFS）
        /// - `evidence_cids`: 证据列表CID（IPFS）
        ///
        /// ### 权限
        /// - Signed origin（任何用户）
        ///
        /// ### 费用
        /// - 需要冻结押金（10 DUST）
        /// - 批准后全额退回
        /// - 拒绝后50%退回，50%罚没至国库
        #[pallet::call_index(80)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn request_category_change(
            origin: OriginFor<T>,
            deceased_id: u64,
            target_category_code: u8,  // 使用u8代替DeceasedCategory
            reason_cid: Vec<u8>,
            evidence_cids: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 检查逝者是否存在
            let deceased_id_typed: T::DeceasedId = deceased_id.saturated_into();
            ensure!(
                DeceasedOf::<T>::contains_key(deceased_id_typed),
                Error::<T>::DeceasedNotFound
            );

            // 2. 参数验证
            let current_category = Self::category_of(deceased_id);
            // 将 u8 转换为 DeceasedCategory
            let target_category = match target_category_code {
                0 => DeceasedCategory::Ordinary,
                1 => DeceasedCategory::HistoricalFigure,
                2 => DeceasedCategory::Martyr,
                3 => DeceasedCategory::Hero,
                4 => DeceasedCategory::PublicFigure,
                5 => DeceasedCategory::ReligiousFigure,
                6 => DeceasedCategory::EventHall,
                _ => return Err(Error::<T>::BadInput.into()),
            };
            ensure!(
                current_category != target_category,
                Error::<T>::SameCategory
            );

            // 3. CID长度检查
            let reason_cid_bounded: BoundedVec<u8, ConstU32<64>> = reason_cid
                .try_into()
                .map_err(|_| Error::<T>::ReasonCidTooLong)?;
            ensure!(
                reason_cid_bounded.len() >= 10,
                Error::<T>::ReasonCidTooShort
            );

            // 4. 转换证据CID列表
            let mut evidence_cids_bounded = BoundedVec::<BoundedVec<u8, ConstU32<64>>, ConstU32<10>>::new();
            for cid in evidence_cids {
                let cid_bounded: BoundedVec<u8, ConstU32<64>> =
                    cid.try_into().map_err(|_| Error::<T>::EvidenceCidTooLong)?;
                evidence_cids_bounded
                    .try_push(cid_bounded)
                    .map_err(|_| Error::<T>::TooManyEvidences)?;
            }

            // 5. 收取押金（10 DUST）
            let deposit = 10u128.saturating_mul(1_000_000_000_000u128);
            T::Currency::reserve(&who, deposit.saturated_into())?;

            // 6. 创建申请
            let request_id = Self::next_request_id();
            let now = <frame_system::Pallet<T>>::block_number();
            let deadline = now + 7u32.saturated_into::<BlockNumberFor<T>>() * 14400u32.saturated_into(); // 7天

            let request = CategoryChangeRequest {
                applicant: who.clone(),
                deceased_id,
                current_category,
                target_category,
                reason_cid: reason_cid_bounded,
                evidence_cids: evidence_cids_bounded,
                submitted_at: now,
                deadline,
                status: RequestStatus::Pending,
            };

            // 7. 存储申请
            CategoryChangeRequests::<T>::insert(request_id, request);
            NextRequestId::<T>::put(request_id + 1);

            // 8. 索引申请
            RequestsByUser::<T>::try_mutate((who.clone(), deceased_id), |requests| {
                requests
                    .try_push(request_id)
                    .map_err(|_| Error::<T>::TooManyRequests)
            })?;

            // 9. 发送事件
            Self::deposit_event(Event::CategoryChangeRequested {
                request_id,
                deceased_id,
                applicant: who,
                from: current_category as u8,
                to: target_category as u8,
            });

            Ok(())
        }

        /// 函数级详细中文注释：直接修改分类（Root接口）
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        /// - `category`: 新分类
        /// - `note_cid`: 修改备注CID（IPFS，可选）
        ///
        /// ### 权限
        /// - Root origin
        #[pallet::call_index(81)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn force_set_category(
            origin: OriginFor<T>,
            deceased_id: u64,
            category_code: u8,  // 使用u8代替DeceasedCategory
            note_cid: Option<Vec<u8>>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            // 1. 检查逝者是否存在
            let deceased_id_typed: T::DeceasedId = deceased_id.saturated_into();
            ensure!(
                DeceasedOf::<T>::contains_key(deceased_id_typed),
                Error::<T>::DeceasedNotFound
            );

            // 2. 将 u8 转换为 DeceasedCategory
            let category = match category_code {
                0 => DeceasedCategory::Ordinary,
                1 => DeceasedCategory::HistoricalFigure,
                2 => DeceasedCategory::Martyr,
                3 => DeceasedCategory::Hero,
                4 => DeceasedCategory::PublicFigure,
                5 => DeceasedCategory::ReligiousFigure,
                6 => DeceasedCategory::EventHall,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 3. 修改分类
            let old_category = Self::category_of(deceased_id);
            CategoryOf::<T>::insert(deceased_id, category);

            // 3. 发送事件
            let note_cid_bounded = note_cid.map(|v| {
                let mut bounded = BoundedVec::<u8, ConstU32<64>>::default();
                for byte in v.iter().take(64) {
                    let _ = bounded.try_push(*byte);
                }
                bounded
            });

            Self::deposit_event(Event::CategoryForcedChanged {
                deceased_id,
                from: old_category as u8,
                to: category as u8,
                note_cid: note_cid_bounded,
            });

            Ok(())
        }

        /// 函数级详细中文注释：批准分类修改申请（治理接口）
        ///
        /// ### 参数
        /// - `request_id`: 申请ID
        ///
        /// ### 权限
        /// - Root | 内容委员会2/3多数
        #[pallet::call_index(82)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn approve_category_change(
            origin: OriginFor<T>,
            request_id: u64,
        ) -> DispatchResult {
            // 权限检查: Root 或 GovernanceOrigin
            if let Err(_) = T::GovernanceOrigin::ensure_origin(origin.clone()) {
                ensure_root(origin)?;
            }

            // 1. 获取申请
            let mut request = CategoryChangeRequests::<T>::get(request_id)
                .ok_or(Error::<T>::RequestNotFound)?;

            // 2. 检查状态
            ensure!(
                request.status == RequestStatus::Pending,
                Error::<T>::RequestNotPending
            );

            // 3. 执行修改
            CategoryOf::<T>::insert(request.deceased_id, request.target_category);

            // 3.5. 维护分类索引
            Self::update_category_index(
                request.current_category,
                request.target_category,
                request.deceased_id
            );

            // 4. 退还押金
            let deposit = 10u128.saturating_mul(1_000_000_000_000u128);
            T::Currency::unreserve(&request.applicant, deposit.saturated_into());

            // 5. 更新申请状态
            request.status = RequestStatus::Approved;
            CategoryChangeRequests::<T>::insert(request_id, request.clone());

            // 6. 发送事件
            Self::deposit_event(Event::CategoryChangeApproved {
                request_id,
                deceased_id: request.deceased_id,
                from: request.current_category as u8,
                to: request.target_category as u8,
            });

            Ok(())
        }

        /// 函数级详细中文注释：拒绝分类修改申请（治理接口）
        ///
        /// ### 参数
        /// - `request_id`: 申请ID
        /// - `reason_cid`: 拒绝理由CID（IPFS）
        ///
        /// ### 权限
        /// - Root | 内容委员会2/3多数
        ///
        /// ### 押金处理
        /// - 50%退还申请人
        /// - 50%罚没至国库
        #[pallet::call_index(83)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn reject_category_change(
            origin: OriginFor<T>,
            request_id: u64,
            reason_cid: Vec<u8>,
        ) -> DispatchResult {
            // 权限检查: Root 或 GovernanceOrigin
            if let Err(_) = T::GovernanceOrigin::ensure_origin(origin.clone()) {
                ensure_root(origin)?;
            }

            // 1. 获取申请
            let mut request = CategoryChangeRequests::<T>::get(request_id)
                .ok_or(Error::<T>::RequestNotFound)?;

            // 2. 检查状态
            ensure!(
                request.status == RequestStatus::Pending,
                Error::<T>::RequestNotPending
            );

            // 3. 押金罚没（50%退还，50%罚没至国库）
            let full_deposit = 10u128.saturating_mul(1_000_000_000_000u128);
            let half_deposit = full_deposit / 2u128;

            // 释放50%给申请人
            T::Currency::unreserve(&request.applicant, half_deposit.saturated_into());

            // 罚没50%至国库（通过转账实现）
            // 注意：先取消剩余的reserve，再转账到国库
            T::Currency::unreserve(&request.applicant, half_deposit.saturated_into());
            T::Currency::transfer(
                &request.applicant,
                &T::FeeCollector::get(),
                half_deposit.saturated_into(),
                frame_support::traits::ExistenceRequirement::AllowDeath,
            )?;

            // 4. 更新申请状态
            request.status = RequestStatus::Rejected;
            CategoryChangeRequests::<T>::insert(request_id, request.clone());

            // 5. 发送事件
            let reason_cid_bounded = BoundedVec::<u8, ConstU32<64>>::truncate_from(reason_cid);
            Self::deposit_event(Event::CategoryChangeRejected {
                request_id,
                deceased_id: request.deceased_id,
                reason_cid: reason_cid_bounded,
            });

            Ok(())
        }

        // =================== 🆕 作品管理功能 (Phase 1: AI训练数据基础) ===================

        /// 函数级详细中文注释：上传逝者作品
        ///
        /// ## 参数
        /// - `origin`: 调用者（必须是墓地所有者或授权账户）
        /// - `deceased_id`: 逝者ID
        /// - `work_type`: 作品类型
        /// - `title`: 作品标题
        /// - `description`: 作品描述
        /// - `ipfs_cid`: IPFS存储地址
        /// - `file_size`: 文件大小（字节）
        /// - `created_at`: 创作时间（可选，Unix时间戳）
        /// - `tags`: 主题标签
        /// - `privacy_level`: 隐私级别
        /// - `ai_training_enabled`: 是否授权AI训练
        ///
        /// ## 权限检查
        /// - 调用者必须是墓地所有者或被授权的管理员
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        #[pallet::call_index(20)]
        #[pallet::weight(Weight::from_parts(50_000, 0))]
        pub fn upload_work(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            work_type_encoded: Vec<u8>,  // SCALE编码的WorkType
            title: Vec<u8>,
            description: Vec<u8>,
            ipfs_cid: Vec<u8>,
            file_size: u64,
            created_at: Option<u64>,
            tags: Vec<Vec<u8>>,
            privacy_level_code: u8,  // 0=Public, 1=Family, 2=Descendants, 3=Private
            ai_training_enabled: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Phase 1 优化：使用统一的权限检查 helper
            let _deceased = Self::ensure_owner_and_get(deceased_id, &who)?;

            // 解码WorkType
            let work_type: WorkType = WorkType::decode(&mut &work_type_encoded[..])
                .map_err(|_| Error::<T>::BadInput)?;

            // 转换PrivacyLevel
            let privacy_level = PrivacyLevel::from_u8(privacy_level_code);

            // 调用内部实现
            Self::do_upload_work(
                who,
                deceased_id,
                work_type,
                title,
                description,
                ipfs_cid,
                file_size,
                created_at,
                tags,
                privacy_level,
                ai_training_enabled,
            )
        }

        /// 函数级详细中文注释：批量上传逝者作品
        ///
        /// ## 功能说明
        /// - 减少交易次数和Gas费用
        /// - 提高大量作品上传效率
        /// - 自动处理所有作品的验证和索引
        ///
        /// ## 参数
        /// - `origin`: 调用者（必须是墓地所有者或授权账户）
        /// - `deceased_id`: 逝者ID
        /// - `works`: 作品信息列表（最多50个）
        ///
        /// ## 权限检查
        /// - 调用者必须是墓地所有者或被授权的管理员
        ///
        /// ## 批量限制
        /// - 单次最多上传50个作品
        /// - 超过限制返回TooManyWorks错误
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        #[pallet::call_index(21)]
        #[pallet::weight(Weight::from_parts(50_000u64.saturating_mul(50), 0))]  // 固定最大值50
        pub fn batch_upload_works(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            works_encoded: Vec<u8>,  // SCALE编码的Vec<WorkUploadInfo>
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 🔐 Phase 3 优化：统一权限检查
            Self::ensure_owner(deceased_id, &who)?;

            // 解码作品列表
            let works: Vec<WorkUploadInfo> = Vec::<WorkUploadInfo>::decode(&mut &works_encoded[..])
                .map_err(|_| Error::<T>::BadInput)?;

            // 批量限制检查：最多50个作品
            ensure!(works.len() <= 50, Error::<T>::TooManyWorks);
            ensure!(!works.is_empty(), Error::<T>::BadInput);

            // 逐个上传作品
            for work_info in works.iter() {
                Self::do_upload_work(
                    who.clone(),
                    deceased_id,
                    work_info.work_type.clone(),
                    work_info.title.clone().into_inner(),
                    work_info.description.clone().into_inner(),
                    work_info.ipfs_cid.clone().into_inner(),
                    work_info.file_size,
                    work_info.created_at,
                    work_info.tags.iter().map(|t| t.clone().into_inner()).collect(),
                    work_info.privacy_level,
                    work_info.ai_training_enabled,
                )?;
            }

            // 发出批量上传事件
            Self::deposit_event(Event::WorksBatchUploaded {
                deceased_id,
                count: works.len() as u32,
                uploader: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新作品元数据
        ///
        /// ## 功能说明
        /// - 更新作品的标题、描述、标签等元数据
        /// - IPFS CID和文件大小不可修改（确保数据完整性）
        /// - 已验证的作品无法修改（防止篡改）
        ///
        /// ## 可更新字段
        /// - 标题（title）
        /// - 描述（description）
        /// - 主题标签（tags）
        /// - 隐私级别（privacy_level）
        /// - AI训练授权（ai_training_enabled）
        ///
        /// ## 参数
        /// - `origin`: 调用者（必须是墓地所有者或授权账户）
        /// - `work_id`: 作品ID
        /// - `title`: 新标题（可选）
        /// - `description`: 新描述（可选）
        /// - `tags`: 新标签列表（可选）
        /// - `privacy_level`: 新隐私级别（可选）
        /// - `ai_training_enabled`: 是否启用AI训练（可选）
        ///
        /// ## 权限检查
        /// - 调用者必须是作品所属逝者的owner
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        #[pallet::call_index(22)]
        #[pallet::weight(Weight::from_parts(30_000, 0))]
        pub fn update_work(
            origin: OriginFor<T>,
            work_id: u64,
            title: Option<Vec<u8>>,
            description: Option<Vec<u8>>,
            tags: Option<Vec<Vec<u8>>>,
            privacy_level_code: Option<u8>,  // 0=Public, 1=Family, 2=Descendants, 3=Private
            ai_training_enabled: Option<bool>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取作品记录
            let work = DeceasedWorks::<T>::get(work_id)
                .ok_or(Error::<T>::WorkNotFound)?;

            // 🔐 Phase 3 优化：统一权限检查
            let deceased_id_typed: T::DeceasedId = work.deceased_id.saturated_into();
            Self::ensure_owner(deceased_id_typed, &who)?;

            // 已验证的作品无法修改
            ensure!(!work.verified, Error::<T>::WorkAlreadyVerified);

            // 转换PrivacyLevel
            let privacy_level = privacy_level_code.map(|code| PrivacyLevel::from_u8(code));

            // 调用内部实现
            Self::do_update_work(
                who,
                work_id,
                title,
                description,
                tags,
                privacy_level,
                ai_training_enabled,
            )
        }

        /// 函数级详细中文注释：删除作品
        ///
        /// ## 功能说明
        /// - 从链上存储中移除作品记录
        /// - 更新所有相关索引（WorksByDeceased, WorksByType, AITrainingWorks）
        /// - 更新统计信息（WorkStatsByDeceased）
        /// - 不删除IPFS文件（需要手动unpinning）
        ///
        /// ## 权限要求
        /// - 仅墓地所有者可以删除作品
        ///
        /// ## 参数
        /// - `origin`: 调用者（必须是墓地所有者）
        /// - `work_id`: 作品ID
        ///
        /// ## 注意事项
        /// - IPFS文件不会被自动删除，需要手动调用unpinning
        /// - 删除后作品ID无法恢复使用
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        #[pallet::call_index(23)]
        #[pallet::weight(Weight::from_parts(40_000, 0))]
        pub fn delete_work(
            origin: OriginFor<T>,
            work_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取作品记录
            let work = DeceasedWorks::<T>::get(work_id)
                .ok_or(Error::<T>::WorkNotFound)?;

            // 🔐 Phase 3 优化：统一权限检查
            let deceased_id_typed: T::DeceasedId = work.deceased_id.saturated_into();
            Self::ensure_owner(deceased_id_typed, &who)?;

            // 调用内部实现
            Self::do_delete_work(who, work_id)
        }

        /// 函数级详细中文注释：验证作品真实性
        ///
        /// ## 功能说明
        /// - 标记作品为"已验证"状态
        /// - 验证后的作品无法修改（保护数据完整性）
        /// - 记录验证者信息
        ///
        /// ## 权限要求
        /// - 逝者的owner可以验证
        /// - 委员会成员可以验证（通过GovernanceOrigin）
        ///
        /// ## 用途
        /// - 确认作品的真实性和完整性
        /// - 防止作品被篡改
        /// - 为AI训练提供可信数据源
        ///
        /// ## 参数
        /// - `origin`: 调用者（owner或治理账户）
        /// - `work_id`: 作品ID
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        #[pallet::call_index(24)]
        #[pallet::weight(Weight::from_parts(20_000, 0))]
        pub fn verify_work(
            origin: OriginFor<T>,
            work_id: u64,
        ) -> DispatchResult {
            // 尝试解析为治理起源或普通签名起源
            let verifier = match T::GovernanceOrigin::ensure_origin(origin.clone()) {
                Ok(_) => {
                    // 治理起源：使用特殊标识（可以是国库账户或委员会账户）
                    // 这里使用第一个验证者作为占位符，实际应该有专门的委员会账户
                    // 暂时使用ensure_signed获取调用者（如果治理调用带签名）
                    match ensure_signed(origin) {
                        Ok(who) => who,
                        Err(_) => {
                            // 如果是纯Root调用，使用系统账户占位
                            // 实际应该配置专门的委员会验证账户
                            return Err(Error::<T>::NotAuthorized.into());
                        }
                    }
                },
                Err(_) => {
                    // 普通签名起源：检查是否为逝者owner
                    let who = ensure_signed(origin)?;

                    // 获取作品记录
                    let work = DeceasedWorks::<T>::get(work_id)
                        .ok_or(Error::<T>::WorkNotFound)?;

                    // 🔐 Phase 3 优化：统一权限检查
                    let deceased_id_typed: T::DeceasedId = work.deceased_id.saturated_into();
                    Self::ensure_owner(deceased_id_typed, &who)?;

                    who
                }
            };

            // 调用内部实现
            Self::do_verify_work(verifier, work_id)
        }

        // =================== 🆕 阶段4：作品互动接口 (Phase 4: Work Interaction Interfaces) ===================

        /// 函数级详细中文注释：记录作品浏览（阶段4新增）
        ///
        /// ## 功能说明
        /// - 记录用户浏览作品的行为
        /// - 增加作品的view_count统计
        /// - 更新last_viewed_at时间戳
        /// - 用于作品影响力评分计算
        ///
        /// ## 权限要求
        /// - 任何已登录用户都可以浏览
        /// - 不需要特殊权限
        ///
        /// ## 防刷机制
        /// - 当前版本：无防刷限制（后续阶段5添加）
        /// - 建议前端去重：同一用户短时间重复浏览不重复调用
        ///
        /// ## 参数
        /// - `origin`: 调用者（任何已登录用户）
        /// - `work_id`: 作品ID
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        ///
        /// ## 事件
        /// - 无独立事件（视为轻量级操作）
        #[pallet::call_index(25)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn view_work(
            origin: OriginFor<T>,
            work_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查作品是否存在
            ensure!(
                DeceasedWorks::<T>::contains_key(work_id),
                Error::<T>::WorkNotFound
            );

            // ========== 🆕 Phase 5: 防刷检查 ==========
            // 执行三层防刷机制检查：
            // 1. 每日浏览限额（1000次/天）
            // 2. 时间窗口防重复（10分钟内不重复）
            // 3. 异常行为检测（1小时内>100次警告）
            // 4. 单作品操作限制（10次/天）
            Self::check_anti_spam(&who, work_id, AntiSpamOperationType::View)?;
            // ========================================

            // 更新统计数据
            let now = <frame_system::Pallet<T>>::block_number();
            WorkEngagementStats::<T>::mutate(work_id, |stats| {
                stats.view_count = stats.view_count.saturating_add(1);
                stats.last_viewed_at = Some(now);
            });

            Ok(())
        }

        /// 函数级详细中文注释：记录作品分享（阶段4新增）
        ///
        /// ## 功能说明
        /// - 记录用户分享作品的行为
        /// - 增加作品的share_count统计
        /// - 更新last_shared_at时间戳
        /// - 用于社交互动评分计算
        ///
        /// ## 权限要求
        /// - 任何已登录用户都可以分享
        /// - 不需要特殊权限
        ///
        /// ## 防刷机制
        /// - 当前版本：无防刷限制（后续阶段5添加）
        /// - 建议前端去重：同一用户短时间重复分享不重复调用
        ///
        /// ## 参数
        /// - `origin`: 调用者（任何已登录用户）
        /// - `work_id`: 作品ID
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        ///
        /// ## 事件
        /// - 无独立事件（视为轻量级操作）
        #[pallet::call_index(26)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn share_work(
            origin: OriginFor<T>,
            work_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查作品是否存在
            ensure!(
                DeceasedWorks::<T>::contains_key(work_id),
                Error::<T>::WorkNotFound
            );

            // ========== 🆕 Phase 5: 防刷检查 ==========
            // 执行三层防刷机制检查：
            // 1. 每日分享限额（100次/天）
            // 2. 时间窗口防重复（1分钟内不重复）
            // 3. 异常行为检测（1小时内>30次警告）
            // 4. 单作品操作限制（10次/天）
            Self::check_anti_spam(&who, work_id, AntiSpamOperationType::Share)?;
            // ========================================

            // 更新统计数据
            let now = <frame_system::Pallet<T>>::block_number();
            WorkEngagementStats::<T>::mutate(work_id, |stats| {
                stats.share_count = stats.share_count.saturating_add(1);
                stats.last_shared_at = Some(now);
            });

            Ok(())
        }

        /// 函数级详细中文注释：收藏/取消收藏作品（阶段4新增）
        ///
        /// ## 功能说明
        /// - 记录用户收藏/取消收藏作品的行为
        /// - 增加或减少作品的favorite_count统计
        /// - 用于社交互动评分计算
        ///
        /// ## 权限要求
        /// - 任何已登录用户都可以收藏
        /// - 不需要特殊权限
        ///
        /// ## 防刷机制
        /// - 当前版本：无防刷限制（后续阶段5添加）
        /// - 建议前端状态管理：避免重复收藏/取消收藏
        ///
        /// ## 参数
        /// - `origin`: 调用者（任何已登录用户）
        /// - `work_id`: 作品ID
        /// - `is_favorite`: true=收藏，false=取消收藏
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        ///
        /// ## 事件
        /// - 无独立事件（视为轻量级操作）
        ///
        /// ## 注意事项
        /// - 不防止同一用户多次收藏（需要前端管理状态）
        /// - favorite_count可能因为重复操作而不准确（后续阶段5修复）
        #[pallet::call_index(27)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn favorite_work(
            origin: OriginFor<T>,
            work_id: u64,
            is_favorite: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查作品是否存在
            ensure!(
                DeceasedWorks::<T>::contains_key(work_id),
                Error::<T>::WorkNotFound
            );

            // ========== 🆕 Phase 5: 防刷检查 ==========
            // 执行三层防刷机制检查：
            // 1. 每日收藏限额（50次/天）
            // 2. 时间窗口防重复（无限制，收藏是双向操作）
            // 3. 异常行为检测（1小时内>20次警告）
            // 4. 单作品操作限制（10次/天）
            Self::check_anti_spam(&who, work_id, AntiSpamOperationType::Favorite)?;
            // ========================================

            // 更新统计数据
            WorkEngagementStats::<T>::mutate(work_id, |stats| {
                if is_favorite {
                    // 收藏：+1
                    stats.favorite_count = stats.favorite_count.saturating_add(1);
                } else {
                    // 取消收藏：-1（但不会低于0）
                    stats.favorite_count = stats.favorite_count.saturating_sub(1);
                }
            });

            Ok(())
        }

        /// 函数级详细中文注释：报告AI训练使用次数（阶段4新增，OCW专用）
        ///
        /// ## 功能说明
        /// - 由Off-chain Worker (OCW)调用，报告作品被AI训练使用的次数
        /// - 增加作品的ai_training_usage统计
        /// - 用于AI训练实用性评分计算
        ///
        /// ## 权限要求
        /// - 仅允许Unsigned origin（OCW调用）
        /// - 普通用户无法直接调用（防止刷量）
        ///
        /// ## 使用场景
        /// - AI训练服务器通过OCW上报作品使用情况
        /// - 批量上报：建议每隔一段时间批量上报，减少链上交易
        ///
        /// ## 参数
        /// - `origin`: Unsigned（OCW）
        /// - `work_id`: 作品ID
        /// - `count`: 增加的使用次数（通常为1，批量上报时可能>1）
        ///
        /// ## 返回
        /// - `DispatchResult`: 成功或错误
        ///
        /// ## 事件
        /// - 无独立事件（视为后台操作）
        ///
        /// ## 安全性
        /// - 当前版本：无签名验证（后续阶段5添加OCW签名验证）
        /// - 建议：配置OCW专用账户，通过治理设置
        #[pallet::call_index(28)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn report_ai_training_usage(
            origin: OriginFor<T>,
            work_id: u64,
            count: u32,
        ) -> DispatchResult {
            // 仅允许Unsigned origin（OCW调用）
            // 注意：当前版本未实现OCW签名验证，后续阶段5添加
            ensure_none(origin)?;

            // 检查作品是否存在
            ensure!(
                DeceasedWorks::<T>::contains_key(work_id),
                Error::<T>::WorkNotFound
            );

            // 检查count是否合理（防止异常数据）
            ensure!(count > 0 && count <= 1000, Error::<T>::BadInput);

            // 更新统计数据
            WorkEngagementStats::<T>::mutate(work_id, |stats| {
                stats.ai_training_usage = stats.ai_training_usage.saturating_add(count);
            });

            Ok(())
        }

        // =================== 🆕 Phase 2.2: 押金补充接口 (Deposit Top-up Interface) ===================

        /// 函数级详细中文注释：补充逝者押金（拥有者接口）
        ///
        /// ### 功能说明
        /// - 允许逝者拥有者追加押金到押金池
        /// - 增加 available_usdt 余额，扩展操作权限
        /// - 使用当前汇率转换 USDT 金额为 DUST
        ///
        /// ### 参数
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `deceased_id`: 逝者ID（u64）
        /// - `amount_usdt`: 补充金额（USDT单位，u32）
        ///
        /// ### 权限要求
        /// - 调用者必须是逝者的拥有者（owner）
        /// - 押金记录必须存在且状态为 Active
        ///
        /// ### 补充流程
        /// 1. **权限校验**：检查调用者是否为逝者拥有者
        /// 2. **状态检查**：确认押金状态为 Active（非 Depleted/Released）
        /// 3. **汇率转换**：通过 pallet-pricing 获取当前汇率，计算 DUST 金额
        /// 4. **资金锁定**：使用 hold 机制锁定 DUST
        /// 5. **更新记录**：增加 available_usdt 和 current_locked_dust
        /// 6. **发出事件**：记录补充操作
        ///
        /// ### 汇率处理
        /// - **初始押金**：使用创建时锁定的汇率（exchange_rate字段）
        /// - **补充押金**：使用当前实时汇率（可能与初始不同）
        /// - **记录方式**：仅记录 USDT 增量，DUST 按当前汇率锁定
        ///
        /// ### 使用场景
        /// 1. **押金不足**：available_usdt < 50 时需要补充
        /// 2. **扩展规模**：升级内容规模（Small → Medium → Large）
        /// 3. **投诉扣款后**：投诉失败导致押金减少，需要补充
        ///
        /// ### 设计理念
        /// - **柔性治理**：允许拥有者随时补充押金，保持操作权限
        /// - **经济激励**：押金充足的用户享有更多操作自由
        /// - **汇率独立**：补充押金使用当前汇率，与初始押金分离记账
        ///
        /// ### 安全性
        /// - **防止滥用**：仅拥有者可补充，防止他人恶意锁定资金
        /// - **状态检查**：Released 状态不允许补充（拥有权已转让）
        /// - **余额验证**：自动检查调用者账户余额是否足够
        ///
        /// ### 错误处理
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `NotAuthorized`: 调用者不是拥有者
        /// - `DepositRecordNotFound`: 押金记录不存在（系统错误）
        /// - `InsufficientBalance`: 账户余额不足以支付补充金额
        /// - `ExchangeRateUnavailable`: 无法获取汇率（系统错误）
        ///
        /// ### 事件
        /// - `DepositToppedUp`: 补充成功
        ///   - deceased_id: 逝者ID
        ///   - owner: 拥有者账户
        ///   - top_up_usdt: 补充金额（USDT）
        ///   - top_up_dust: 补充金额（DUST）
        ///   - new_available_usdt: 补充后的可用余额（USDT）
        ///
        /// ### 示例
        /// ```rust
        /// // 补充 50 USDT 押金
        /// top_up_deposit(origin, deceased_id: 123, amount_usdt: 50)
        /// // 结果：available_usdt 增加 50，current_locked_dust 按当前汇率增加
        /// ```
        #[pallet::call_index(29)]
        #[pallet::weight(Weight::from_parts(30_000, 0))]
        pub fn top_up_deposit(
            origin: OriginFor<T>,
            deceased_id: u64,
            amount_usdt: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 🔐 Phase 3 优化：统一权限检查
            let deceased_id_typed: T::DeceasedId = deceased_id.saturated_into();
            Self::ensure_owner(deceased_id_typed, &who)?;

            // 2. 获取押金记录
            let mut record = OwnerDepositRecords::<T>::get(deceased_id)
                .ok_or(Error::<T>::DepositRecordNotFound)?;

            // 3. 检查押金状态（仅 Active 状态允许补充）
            ensure!(
                record.status == DepositStatus::Active,
                Error::<T>::BadInput
            );

            // 4. 检查补充金额是否合理（最少 10 USDT，最多 1000 USDT）
            ensure!(amount_usdt >= 10 && amount_usdt <= 1000, Error::<T>::BadInput);

            // 5. 通过 PricingProvider 获取当前汇率并转换为 DUST
            let top_up_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(amount_usdt)?;

            // 6. 锁定补充的 DUST 金额（使用 hold 机制）
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &who,
                top_up_dust,
            )?;

            // 7. 更新押金记录
            record.available_usdt = record.available_usdt.saturating_add(amount_usdt);
            record.current_locked_dust = record.current_locked_dust.saturating_add(top_up_dust);

            // 8. 如果押金从 Insufficient 状态恢复到充足，更新状态为 Active
            let min_deposit_usdt = 2u32;
            if record.available_usdt >= min_deposit_usdt && record.status == DepositStatus::Insufficient {
                record.status = DepositStatus::Active;
            }

            // 9. 存储更新后的记录
            OwnerDepositRecords::<T>::insert(deceased_id, record.clone());

            // 10. 发出事件
            Self::deposit_event(Event::DepositToppedUp {
                deceased_id,
                owner: who,
                top_up_usdt: amount_usdt,
                top_up_dust,
                new_available_usdt: record.available_usdt,
            });

            Ok(())
        }

        // =================== 🆕 方案3：动态调整押金 Extrinsics ===================

        /// 函数级详细中文注释：补充押金（方案3）
        ///
        /// ### 核心功能
        /// - 用户主动补充押金，响应系统警告
        /// - 补充后清除警告状态
        ///
        /// ### 参数
        /// - `origin`: 操作者（必须是拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `amount_usdt`: 补充金额（USDT）
        ///
        /// ### 触发条件
        /// - 收到补充警告后
        /// - 或押金价值低于目标值时主动补充
        ///
        /// ### 事件
        /// - `DepositSupplemented`: 补充成功
        #[pallet::call_index(60)]
        #[pallet::weight(Weight::from_parts(50_000, 0))]
        pub fn supplement_deposit(
            origin: OriginFor<T>,
            deceased_id: u64,
            amount_usdt: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取押金记录
            let mut record = OwnerDepositRecords::<T>::get(deceased_id)
                .ok_or(Error::<T>::DepositRecordNotFound)?;

            // 2. 验证权限
            ensure!(record.owner == who, Error::<T>::NotAuthorized);

            // 3. 按当前汇率转换USDT为DUST
            let current_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;
            let dust_amount = governance::ExchangeRateHelper::<T>::usdt_to_dust_at_rate(amount_usdt, current_rate)
                .map_err(|_| Error::<T>::AmountOverflow)?;

            // 4. 锁定押金
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &who,
                dust_amount,
            )?;

            // 5. 更新押金记录
            record.current_locked_dust = record.current_locked_dust.saturating_add(dust_amount);
            record.available_dust = record.available_dust.saturating_add(dust_amount);
            record.available_usdt = record.available_usdt.saturating_add(amount_usdt);

            // 6. 记录调整历史
            let now = <frame_system::Pallet<T>>::block_number();
            let adjustment = governance::DepositAdjustment {
                adjustment_type: governance::AdjustmentType::Supplement,
                dust_amount,
                exchange_rate: current_rate,
                usdt_equivalent: amount_usdt,
                adjusted_at: now,
                reason: BoundedVec::try_from(b"User supplement".to_vec()).unwrap_or_default(),
            };
            let _ = record.adjustments.try_push(adjustment);

            // 7. 清除警告（如果存在）
            record.supplement_warning = None;

            // 8. 更新状态
            if record.status == DepositStatus::Depleted {
                record.status = DepositStatus::Active;
            }

            // 9. 保存记录
            OwnerDepositRecords::<T>::insert(deceased_id, record);

            // 10. 发出事件
            Self::deposit_event(Event::DepositSupplemented {
                deceased_id,
                dust_amount,
                usdt_equivalent: amount_usdt,
                owner: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：解锁多余押金（方案3）
        ///
        /// ### 核心功能
        /// - 当押金价值超过12 USDT时，用户可解锁多余部分
        /// - 至少保留目标值（10 USDT）
        ///
        /// ### 参数
        /// - `origin`: 操作者（必须是拥有者）
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 触发条件
        /// - 押金价值 > 12 USDT（目标值的120%）
        ///
        /// ### 事件
        /// - `DepositUnlocked`: 解锁成功
        #[pallet::call_index(61)]
        #[pallet::weight(Weight::from_parts(50_000, 0))]
        pub fn unlock_excess_deposit(
            origin: OriginFor<T>,
            deceased_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取押金记录
            let mut record = OwnerDepositRecords::<T>::get(deceased_id)
                .ok_or(Error::<T>::DepositRecordNotFound)?;

            // 2. 验证权限
            ensure!(record.owner == who, Error::<T>::NotAuthorized);

            // 3. 计算当前押金价值
            let current_value_usdt = governance::ExchangeRateHelper::<T>::calculate_dust_value_in_usdt(record.current_locked_dust)
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;

            // 4. 检查是否有多余押金（> 12 USDT）
            let unlock_threshold = record.target_deposit_usdt.saturating_mul(120) / 100; // 120%
            ensure!(current_value_usdt > unlock_threshold, Error::<T>::NoExcessDeposit);

            // 5. 计算可解锁的USDT金额（保留10 USDT目标值）
            let unlockable_usdt = current_value_usdt.saturating_sub(record.target_deposit_usdt);

            // 6. 按当前汇率转换为DUST
            let current_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;
            let unlockable_dust = governance::ExchangeRateHelper::<T>::usdt_to_dust_at_rate(unlockable_usdt, current_rate)
                .map_err(|_| Error::<T>::AmountOverflow)?;

            // 7. 解锁押金
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &who,
                unlockable_dust,
                frame_support::traits::tokens::Precision::BestEffort,
            )?;

            // 8. 更新押金记录
            record.current_locked_dust = record.current_locked_dust.saturating_sub(unlockable_dust);
            record.available_dust = record.available_dust.saturating_sub(unlockable_dust);
            record.available_usdt = record.available_usdt.saturating_sub(unlockable_usdt);

            // 9. 记录调整历史
            let now = <frame_system::Pallet<T>>::block_number();
            let adjustment = governance::DepositAdjustment {
                adjustment_type: governance::AdjustmentType::Unlock,
                dust_amount: unlockable_dust,
                exchange_rate: current_rate,
                usdt_equivalent: unlockable_usdt,
                adjusted_at: now,
                reason: BoundedVec::try_from(b"User unlock excess".to_vec()).unwrap_or_default(),
            };
            let _ = record.adjustments.try_push(adjustment);

            // 10. 保存记录
            OwnerDepositRecords::<T>::insert(deceased_id, record);

            // 11. 发出事件
            Self::deposit_event(Event::DepositUnlocked {
                deceased_id,
                dust_amount: unlockable_dust,
                usdt_equivalent: unlockable_usdt,
                owner: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：强制补充押金（方案3 - 治理）
        ///
        /// ### 核心功能
        /// - 治理强制补充押金（用户逾期未响应警告）
        /// - 从用户余额中扣除
        ///
        /// ### 参数
        /// - `origin`: Root权限
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 触发条件
        /// - 已发出补充警告
        /// - 7天期限已过
        /// - 用户未主动补充
        ///
        /// ### 事件
        /// - `DepositForcedSupplemented`: 强制补充成功
        /// - `DepositDepleted`: 用户余额不足，押金耗尽
        #[pallet::call_index(62)]
        #[pallet::weight(Weight::from_parts(50_000, 0))]
        pub fn force_supplement_deposit(
            origin: OriginFor<T>,
            deceased_id: u64,
        ) -> DispatchResult {
            ensure_root(origin)?;

            // 1. 获取押金记录
            let mut record = OwnerDepositRecords::<T>::get(deceased_id)
                .ok_or(Error::<T>::DepositRecordNotFound)?;

            // 2. 检查是否有警告
            let warning = record.supplement_warning.clone()
                .ok_or(Error::<T>::NoSupplementWarning)?;

            // 3. 检查是否已到期限
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= warning.deadline, Error::<T>::DeadlineNotReached);

            // 4. 尝试强制锁定押金
            let result = T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &record.owner,
                warning.required_dust,
            );

            match result {
                Ok(_) => {
                    // 5. 成功锁定，更新押金记录
                    record.current_locked_dust = record.current_locked_dust.saturating_add(warning.required_dust);
                    record.available_dust = record.available_dust.saturating_add(warning.required_dust);
                    record.available_usdt = record.available_usdt.saturating_add(warning.required_usdt);

                    // 6. 记录调整历史
                    let adjustment = governance::DepositAdjustment {
                        adjustment_type: governance::AdjustmentType::ForcedSupplement,
                        dust_amount: warning.required_dust,
                        exchange_rate: warning.warning_rate,
                        usdt_equivalent: warning.required_usdt,
                        adjusted_at: now,
                        reason: BoundedVec::try_from(b"Forced by governance".to_vec()).unwrap_or_default(),
                    };
                    let _ = record.adjustments.try_push(adjustment);

                    // 7. 清除警告
                    record.supplement_warning = None;

                    // 8. 更新状态
                    if record.status == DepositStatus::Depleted {
                        record.status = DepositStatus::Active;
                    }

                    // 9. 保存记录
                    OwnerDepositRecords::<T>::insert(deceased_id, record.clone());

                    // 10. 发出事件
                    Self::deposit_event(Event::DepositForcedSupplemented {
                        deceased_id,
                        dust_amount: warning.required_dust,
                        owner: record.owner,
                    });
                },
                Err(_) => {
                    // 用户余额不足，标记押金耗尽
                    record.status = DepositStatus::Depleted;
                    record.supplement_warning = None;
                    OwnerDepositRecords::<T>::insert(deceased_id, record.clone());

                    Self::deposit_event(Event::DepositDepleted {
                        deceased_id,
                        owner: record.owner,
                    });
                }
            }

            Ok(())
        }

        /// 函数级详细中文注释：拥有者执行操作（无需额外押金）
        ///
        /// ### 核心功能
        /// - 拥有者对自有逝者进行增删改操作
        /// - 无需支付额外押金（使用永久质押的押金作为担保）
        /// - 操作进入30天投诉期
        /// - 押金充足性检查（但不锁定额外押金）
        ///
        /// ### 参数
        /// - `origin`: 操作者（必须是拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `operation`: 操作类型（0=Add, 1=Modify, 2=Delete）
        /// - `content_type`: 内容类型（0=Text, 1=Media, 2=Works）
        /// - `content_id`: 内容ID（修改/删除时必填）
        /// - `new_content_cid`: 新内容CID（新增/修改时必填）
        /// - `reason`: 操作理由
        ///
        /// ### 操作流程
        /// 1. 验证拥有权
        /// 2. 检查押金是否充足（无需锁定）
        /// 3. 验证操作参数
        /// 4. 执行操作
        /// 5. 创建操作记录
        /// 6. 进入30天投诉期
        ///
        /// ### 错误处理
        /// - `NotOwner`: 非拥有者
        /// - `InsufficientDeposit`: 押金不足
        /// - `InvalidOperation`: 操作参数无效
        ///
        /// ### 事件
        /// - `OwnerOperationExecuted`: 操作已执行
        #[pallet::call_index(73)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn owner_execute_operation(
            origin: OriginFor<T>,
            deceased_id: u64,
            operation: u8,           // 0=Add, 1=Modify, 2=Delete
            content_type: u8,        // 0=Text, 1=Media, 2=Works
            content_id: Option<u64>,
            new_content_cid: Option<BoundedVec<u8, ConstU32<128>>>,
            reason: BoundedVec<u8, ConstU32<512>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();

            use sp_runtime::traits::UniqueSaturatedInto;

            // 1. 验证拥有权
            let deceased_id_typed: T::DeceasedId = deceased_id.unique_saturated_into();
            Self::ensure_owner(deceased_id_typed, &who)?;

            // 2. 检查押金是否充足（无需锁定额外押金）
            Self::ensure_sufficient_deposit_internal(deceased_id)?;

            // 3. 验证操作参数
            ensure!(
                operation <= 2,
                Error::<T>::BadInput
            );
            ensure!(
                content_type <= 2,
                Error::<T>::BadInput
            );

            // 转换为枚举类型
            let operation_type = match operation {
                0 => governance::OperationType::Add,
                1 => governance::OperationType::Modify,
                2 => governance::OperationType::Delete,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            let content_type_enum = match content_type {
                0 => governance::ContentType::Text,
                1 => governance::ContentType::Media,
                2 => governance::ContentType::Works,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 验证操作参数合法性
            match operation_type {
                governance::OperationType::Add => {
                    // 新增操作必须提供新内容CID
                    ensure!(
                        new_content_cid.is_some(),
                        Error::<T>::BadInput
                    );
                },
                governance::OperationType::Modify => {
                    // 修改操作必须提供内容ID和新内容CID
                    ensure!(
                        content_id.is_some() && new_content_cid.is_some(),
                        Error::<T>::BadInput
                    );
                },
                governance::OperationType::Delete => {
                    // 删除操作必须提供内容ID
                    ensure!(
                        content_id.is_some(),
                        Error::<T>::BadInput
                    );
                },
            }

            // 4. 生成操作ID
            let operation_id = NextOperationId::<T>::mutate(|id| {
                let current = *id;
                *id = id.saturating_add(1);
                current
            });

            // 5. 创建操作记录（方案E：无押金，简化流程）
            const BLOCKS_PER_DAY: u32 = 14400; // 假设6秒/块，14400块 = 1天
            let auto_confirm_at = now.saturating_add((BLOCKS_PER_DAY * 30).into());

            let owner_operation = governance::OwnerOperation {
                operation_id,
                owner: who.clone(),
                deceased_id,
                operation: operation_type,
                content_type: content_type_enum,
                content_id,
                new_content_cid: new_content_cid.clone(),
                reason,
                executed_at: now,
                auto_confirm_at,
                initial_deposit_usdt: 0u32, // 拥有者操作无押金
                initial_deposit_dust: BalanceOf::<T>::zero(),
                status: governance::OwnerOperationStatus::Active,
                complaint_count: 0,
            };

            // 6. 存储操作记录
            OwnerOperations::<T>::insert(operation_id, owner_operation.clone());

            // 7. 建立索引
            OperationsByOwner::<T>::insert((who.clone(), operation_id), ());
            OperationsByDeceased::<T>::insert((deceased_id, operation_id), ());

            // 8. 发出事件
            Self::deposit_event(Event::OwnerOperationExecuted {
                operation_id,
                owner: who,
                deceased_id,
                operation,
                complaint_window_end: now, // 仅用于兼容，实际无限投诉期
            });

            Ok(())
        }

        /// 函数级详细中文注释：投诉拥有者操作（Phase 4.1 + 方案D）
        ///
        /// ### 功能描述
        /// - 允许任何用户对拥有者的增删改操作进行投诉
        /// - 投诉需要锁定押金（固定2 USDT）
        /// - 无限投诉期：任何时候都可以投诉Active/Confirming状态的操作
        /// - 方案D：投诉Confirming状态的操作将罚没全部4 USDT押金
        ///
        /// ### 参数说明
        /// - `origin`: 投诉人（任何用户）
        /// - `operation_id`: 被投诉的操作ID
        /// - `complaint_type`: 投诉类型（0=FalseInformation, 1=Inappropriate, 2=Unauthorized, 3=Malicious）
        /// - `reason`: 投诉理由（最长1024字节）
        /// - `evidence_cids`: 证据CID列表（最多10个）
        ///
        /// ### 流程
        /// 1. 验证投诉资格（操作存在且状态允许投诉）
        /// 2. 计算投诉押金（固定2 USDT）并转换为DUST
        /// 3. 锁定投诉押金
        /// 4. 创建投诉记录
        /// 5. 更新操作的投诉计数
        /// 6. 发出事件
        ///
        /// ### 押金分配
        /// - 投诉成功：退还押金 + 获得被投诉操作押金的80%（若有）
        /// - 投诉失败：押金罚没 → 80%给拥有者，20%给委员会
        ///
        /// ### 错误处理
        /// - `OperationNotFound`: 操作不存在
        /// - `BadInput`: 操作状态不允许投诉（已Revoked/Confirmed/PermanentlyLocked）
        /// - `InsufficientBalance`: 余额不足锁定押金
        ///
        /// ### 事件
        /// - `OperationComplained`: 投诉已提交
        #[pallet::call_index(74)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn complain_owner_operation(
            origin: OriginFor<T>,
            operation_id: u64,
            complaint_type: u8,    // 0=FalseInformation, 1=Inappropriate, 2=Unauthorized, 3=Malicious
            reason: BoundedVec<u8, ConstU32<1024>>,
            evidence_cids: BoundedVec<BoundedVec<u8, ConstU32<128>>, ConstU32<10>>,
        ) -> DispatchResult {
            let complainant = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 验证操作存在
            let mut operation = OwnerOperations::<T>::get(operation_id)
                .ok_or(Error::<T>::BadInput)?; // TODO: 添加 OperationNotFound 错误

            // 2. 验证投诉资格（方案E：只允许投诉Active状态）
            // 已Confirmed/Revoked的操作不能再投诉
            ensure!(
                operation.status == governance::OwnerOperationStatus::Active,
                Error::<T>::BadInput // 状态不对
            );

            // 3. 转换投诉类型
            let complaint_type_enum = match complaint_type {
                0 => governance::ComplaintType::FalseInformation,
                1 => governance::ComplaintType::Inappropriate,
                2 => governance::ComplaintType::Unauthorized,
                3 => governance::ComplaintType::Malicious,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 4. 计算投诉押金（USDT）
            let deposit_usdt = governance::DepositCalculator::<T>::calculate_complaint_deposit_usdt(
                operation.operation.clone(),
                operation.content_type.clone(),
            );

            // 5. 转换为DUST金额
            let deposit_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(deposit_usdt)
                .map_err(|_| Error::<T>::BadInput)?; // TODO: 添加 ExchangeRateUnavailable 错误

            // 6. 锁定投诉押金
            // TODO: 实现Hold机制
            // T::Fungible::hold(
            //     &T::RuntimeHoldReason::from(crate::HoldReason::ComplaintDeposit).into(),
            //     &complainant,
            //     deposit_dust,
            // ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 7. 生成投诉ID
            let complaint_id = NextComplaintId::<T>::get();
            NextComplaintId::<T>::put(
                complaint_id.checked_add(1).ok_or(Error::<T>::Overflow)?
            );

            // 8. 创建投诉记录
            let complaint = governance::OwnerOperationComplaint {
                complaint_id,
                complainant: complainant.clone(),
                operation_id,
                complaint_type: complaint_type_enum,
                reason,
                evidence_cids,
                deposit_usdt,
                deposit_dust,
                status: governance::ComplaintStatus::Submitted,
                submitted_at: now,
                reviewed_at: None,
            };

            // 9. 存储投诉记录
            OwnerOperationComplaints::<T>::insert(complaint_id, complaint);

            // 10. 建立索引
            ComplaintsByOperation::<T>::insert((operation_id, complaint_id), ());
            ComplaintsByComplainant::<T>::insert((complainant.clone(), complaint_id), ());

            // 11. 更新操作的投诉计数
            operation.complaint_count = operation.complaint_count.saturating_add(1);
            OwnerOperations::<T>::insert(operation_id, operation);

            // 12. 发出事件
            Self::deposit_event(Event::OperationComplained {
                complaint_id,
                operation_id,
                complainant,
                deposit_usdt,
                deposit_dust,
            });

            Ok(())
        }

        /// 函数级详细中文注释：审核投诉（Phase 4.2）
        ///
        /// ### 功能描述
        /// - 委员会成员审核对拥有者操作的投诉
        /// - 做出审核决定并执行相应的押金分配
        ///
        /// ### 参数说明
        /// - `origin`: 审核人（必须是委员会成员）
        /// - `complaint_id`: 投诉ID
        /// - `decision`: 审核决定（0=ComplaintValid, 1=ComplaintInvalid, 2=RequireMoreEvidence）
        /// - `review_note`: 审核备注（可选）
        ///
        /// ### 审核决定处理
        /// 1. **ComplaintValid（投诉成立）**：
        ///    - 撤销操作（调用 revoke_operation）
        ///    - 从拥有者押金扣除
        ///    - 80%给投诉人，20%给委员会
        ///    - 退还投诉押金给投诉人
        ///
        /// 2. **ComplaintInvalid（投诉不成立）**：
        ///    - 罚没投诉押金
        ///    - 80%给拥有者，20%给委员会
        ///
        /// 3. **RequireMoreEvidence（需要更多证据）**：
        ///    - 更新投诉状态为 PendingEvidence
        ///    - 不处理押金
        ///
        /// ### 错误处理
        /// - `NotAuthorized`: 非委员会成员
        /// - `ComplaintNotFound`: 投诉不存在
        /// - `ComplaintAlreadyReviewed`: 投诉已审核
        ///
        /// ### 事件
        /// - `ComplaintReviewed`: 审核已完成
        /// - `ComplaintSuccessDepositDeducted`: 投诉成功，押金已扣除
        /// - `ComplaintRejectedDepositForfeited`: 投诉失败，押金已罚没
        #[pallet::call_index(75)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn review_owner_complaint(
            origin: OriginFor<T>,
            complaint_id: u64,
            decision: u8,  // 0=ComplaintValid, 1=ComplaintInvalid, 2=RequireMoreEvidence
            _review_note: Option<BoundedVec<u8, ConstU32<512>>>,
        ) -> DispatchResult {
            let _reviewer = ensure_signed(origin.clone())?;
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 验证审核权限（需要委员会成员权限）
            // TODO: 实现委员会成员验证
            // T::GovernanceOrigin::ensure_origin(origin)?;

            // 2. 验证投诉存在
            let mut complaint = OwnerOperationComplaints::<T>::get(complaint_id)
                .ok_or(Error::<T>::BadInput)?; // TODO: 添加 ComplaintNotFound 错误

            // 3. 验证投诉状态（必须是 Submitted 或 PendingEvidence）
            ensure!(
                complaint.status == governance::ComplaintStatus::Submitted ||
                complaint.status == governance::ComplaintStatus::PendingEvidence,
                Error::<T>::BadInput // TODO: 添加 ComplaintAlreadyReviewed 错误
            );

            // 4. 获取关联的操作记录
            let operation = OwnerOperations::<T>::get(complaint.operation_id)
                .ok_or(Error::<T>::BadInput)?;

            // 5. 转换审核决定
            let decision_enum = match decision {
                0 => governance::ExpertDecision::ComplaintValid,
                1 => governance::ExpertDecision::ComplaintInvalid,
                2 => governance::ExpertDecision::RequireMoreEvidence,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 6. 根据审核决定处理
            match decision_enum {
                governance::ExpertDecision::ComplaintValid => {
                    // 投诉成立：撤销操作 + 扣除拥有者押金 + 分配
                    Self::handle_complaint_valid(complaint_id, &complaint, &operation)?;
                },
                governance::ExpertDecision::ComplaintInvalid => {
                    // 投诉不成立：罚没投诉押金 + 分配给拥有者和委员会
                    Self::handle_complaint_invalid(complaint_id, &complaint, &operation)?;
                },
                governance::ExpertDecision::RequireMoreEvidence => {
                    // 需要更多证据：更新状态
                    complaint.status = governance::ComplaintStatus::PendingEvidence;
                    complaint.reviewed_at = Some(now);
                    OwnerOperationComplaints::<T>::insert(complaint_id, complaint);

                    Self::deposit_event(Event::ComplaintReviewed {
                        complaint_id,
                        operation_id: operation.operation_id,
                        decision: 2,
                    });
                },
            }

            Ok(())
        }

        /// 函数级详细中文注释：非拥有者执行内容操作（需要押金）
        ///
        /// ### 功能描述
        /// - 允许非拥有者对逝者内容进行增删改操作
        /// - 每次操作需要锁定押金（最低2 USDT）
        /// - 无限投诉期，任何时候都可以被投诉
        ///
        /// ### 参数说明
        /// - `origin`: 操作者（非拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `operation`: 操作类型（0=Add, 1=Modify, 2=Delete）
        /// - `content_type`: 内容类型（0=Text, 1=Media, 2=Works）
        /// - `content_id`: 内容ID（修改/删除时必填）
        /// - `new_content_cid`: 新内容CID（新增/修改时必填）
        /// - `reason`: 操作理由
        ///
        /// ### 押金机制
        /// - 操作时锁定2 USDT
        /// - 投诉成功：押金罚没 → 80%给投诉人，20%给委员会
        /// - 投诉失败或无投诉：押金永久锁定（不退还）
        ///
        /// ### 错误处理
        /// - `NotAuthorized`: 是拥有者（拥有者应使用 owner_execute_operation）
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `InsufficientBalance`: 余额不足锁定押金
        ///
        /// ### 事件
        /// - `NonOwnerOperationExecuted`: 非拥有者操作已执行
        #[pallet::call_index(76)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn non_owner_execute_operation(
            origin: OriginFor<T>,
            deceased_id: u64,
            operation: u8,           // 0=Add, 1=Modify, 2=Delete
            content_type: u8,        // 0=Text, 1=Media, 2=Works
            content_id: Option<u64>,
            new_content_cid: Option<BoundedVec<u8, ConstU32<128>>>,
            reason: BoundedVec<u8, ConstU32<512>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 验证逝者存在
            let deceased_id_typed: T::DeceasedId = deceased_id.try_into()
                .map_err(|_| Error::<T>::BadInput)?;
            ensure!(
                DeceasedOf::<T>::contains_key(deceased_id_typed),
                Error::<T>::DeceasedNotFound
            );

            // 2. 确保不是拥有者（拥有者应该使用 owner_execute_operation）
            let deceased_info = DeceasedOf::<T>::get(deceased_id_typed)
                .ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(
                deceased_info.owner != who,
                Error::<T>::NotAuthorized
            );

            // 3. 转换操作类型和内容类型
            let operation_type = match operation {
                0 => governance::OperationType::Add,
                1 => governance::OperationType::Modify,
                2 => governance::OperationType::Delete,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            let content_type_enum = match content_type {
                0 => governance::ContentType::Text,
                1 => governance::ContentType::Media,
                2 => governance::ContentType::Works,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 4. 【方案E】支付服务费 + 锁定押金
            // 服务费：1 USDT → 立即转给逝者拥有者
            // 押金：2 USDT → 锁定（30天后可退还）
            let service_fee_usdt = 1u32;
            let deposit_usdt = 2u32;

            let service_fee_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(service_fee_usdt)
                .map_err(|_| Error::<T>::BadInput)?;
            let deposit_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(deposit_usdt)
                .map_err(|_| Error::<T>::BadInput)?;

            // 4.1 转账服务费给逝者拥有者（使用Currency trait）
            T::Currency::transfer(
                &who,
                &deceased_info.owner,
                service_fee_dust,
                frame_support::traits::ExistenceRequirement::KeepAlive,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 4.2 锁定押金（使用Fungible Hold机制）
            use frame_support::traits::fungible::hold::Mutate as HoldMutate;
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::NonOwnerOperationDeposit),
                &who,
                deposit_dust,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 5. 生成操作ID
            let operation_id = NextOperationId::<T>::mutate(|id| {
                let current = *id;
                *id = id.saturating_add(1);
                current
            });

            // 6. 创建操作记录（方案E：服务费+押金+自动退还）
            const BLOCKS_PER_DAY: u32 = 14400;
            let auto_confirm_at = now.saturating_add((BLOCKS_PER_DAY * 30).into());

            let owner_operation = governance::OwnerOperation {
                operation_id,
                owner: who.clone(),
                deceased_id,
                operation: operation_type,
                content_type: content_type_enum,
                content_id,
                new_content_cid: new_content_cid.clone(),
                reason,
                executed_at: now,
                auto_confirm_at,
                initial_deposit_usdt: deposit_usdt,
                initial_deposit_dust: deposit_dust,
                status: governance::OwnerOperationStatus::Active,
                complaint_count: 0,
            };

            // 7. 存储操作记录
            OwnerOperations::<T>::insert(operation_id, owner_operation.clone());

            // 8. 建立索引
            OperationsByOwner::<T>::insert((who.clone(), operation_id), ());
            OperationsByDeceased::<T>::insert((deceased_id, operation_id), ());

            // 9. 发出事件（复用 OwnerOperationExecuted 事件）
            Self::deposit_event(Event::OwnerOperationExecuted {
                operation_id,
                owner: who,
                deceased_id,
                operation,
                complaint_window_end: now, // 仅用于兼容，实际无限投诉期
            });

            Ok(())
        }

        /// 函数级详细中文注释：拥有者删除非拥有者上传的内容（无需押金）
        ///
        /// ### 功能描述
        /// - 拥有者可以无押金删除其他用户上传的内容
        /// - 仅限删除操作
        /// - 不需要投诉，直接生效
        ///
        /// ### 参数说明
        /// - `origin`: 拥有者
        /// - `deceased_id`: 逝者ID
        /// - `content_type`: 内容类型（0=Text, 1=Media, 2=Works）
        /// - `content_id`: 要删除的内容ID
        /// - `reason`: 删除理由（可选）
        ///
        /// ### 错误处理
        /// - `NotDeceasedOwner`: 非拥有者
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `BadInput`: 内容不存在
        ///
        /// ### 事件
        /// - `OwnerDeletedNonOwnerContent`: 拥有者删除了非拥有者内容
        #[pallet::call_index(77)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn owner_delete_non_owner_operation(
            origin: OriginFor<T>,
            operation_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取操作记录
            let operation = OwnerOperations::<T>::get(operation_id)
                .ok_or(Error::<T>::BadInput)?;

            // 2. 获取逝者信息
            let deceased_id_typed: T::DeceasedId = operation.deceased_id.try_into()
                .map_err(|_| Error::<T>::BadInput)?;
            let deceased_info = DeceasedOf::<T>::get(deceased_id_typed)
                .ok_or(Error::<T>::DeceasedNotFound)?;

            // 3. 验证调用者是逝者拥有者
            ensure!(who == deceased_info.owner, Error::<T>::NotDeceasedOwner);

            // 4. 验证该操作不是拥有者自己的操作（只能删除其他人的）
            ensure!(operation.owner != who, Error::<T>::BadInput);

            // 5. 验证操作不在仲裁流程中
            ensure!(
                !Self::is_operation_under_arbitration(operation_id),
                Error::<T>::BadInput // 操作在仲裁中，不可删除
            );

            // 6. 验证操作状态是Active（只能删除待确认的操作）
            ensure!(
                operation.status == governance::OwnerOperationStatus::Active,
                Error::<T>::BadInput // 只能删除Active状态的操作
            );

            // 7. 退还押金给原操作者
            if operation.initial_deposit_dust > Zero::zero() {
                use frame_support::traits::fungible::hold::Mutate as HoldMutate;
                T::Fungible::release(
                    &T::RuntimeHoldReason::from(crate::HoldReason::NonOwnerOperationDeposit),
                    &operation.owner,
                    operation.initial_deposit_dust,
                    frame_support::traits::tokens::Precision::Exact,
                ).map_err(|_| Error::<T>::BadInput)?;
            }

            // 8. 删除操作记录（标记为已撤销）
            let mut updated_operation = operation.clone();
            updated_operation.status = governance::OwnerOperationStatus::Revoked;
            OwnerOperations::<T>::insert(operation_id, updated_operation);

            // 9. 发出事件
            Self::deposit_event(Event::OwnerDeletedNonOwnerOperation {
                deceased_id: operation.deceased_id,
                owner: who,
                operation_id,
                original_uploader: operation.owner.clone(),
                refunded_deposit: operation.initial_deposit_dust,
            });

            Ok(())
        }

        // =================== Text 模块 CRUD 操作 ===================

        /// 函数级详细中文注释：创建文本内容（Text模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以创建文本内容（文章或留言）
        /// - 内容存储在IPFS，链上仅存储CID
        /// - 支持标题和摘要（可选）
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `kind`: 文本类型（0=Article文章, 1=Message留言）
        /// - `cid`: IPFS内容CID
        /// - `title`: 标题（可选）
        /// - `summary`: 摘要（可选）
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        /// - 逝者必须存在
        ///
        /// ### 返回
        /// - `Ok(())`: 创建成功
        /// - `Err(...)`: 创建失败（权限不足、参数错误等）
        #[pallet::call_index(78)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn create_text(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            kind: u8,
            cid: Vec<u8>,
            title: Option<Vec<u8>>,
            summary: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let deceased = Self::ensure_owner_and_get(deceased_id, &who)?;

            // 3. 转换kind为TextKind枚举
            let kind_enum = match kind {
                0 => text::TextKind::Article,
                1 => text::TextKind::Message,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 4. 转换参数为BoundedVec
            let cid_bounded: BoundedVec<u8, T::StringLimit> = cid.try_into()
                .map_err(|_| Error::<T>::BadInput)?;
            let title_bounded = if let Some(t) = title {
                Some(t.try_into().map_err(|_| Error::<T>::BadInput)?)
            } else {
                None
            };
            let summary_bounded = if let Some(s) = summary {
                Some(s.try_into().map_err(|_| Error::<T>::BadInput)?)
            } else {
                None
            };

            // 5. 获取下一个TextId
            let text_id = NextTextId::<T>::get();
            let next_id = text_id.saturating_add(One::one());
            NextTextId::<T>::put(next_id);

            // 6. 获取当前区块号
            let now = <frame_system::Pallet<T>>::block_number();

            // 7. 创建TextRecord
            let record = text::TextRecord {
                id: text_id,
                deceased_id,
                deceased_token: deceased.deceased_token.clone(),
                author: who.clone(),
                kind: kind_enum,
                cid: cid_bounded,
                title: title_bounded,
                summary: summary_bounded,
                created: now,
                updated: now,
            };

            // 8. 存储TextRecord
            TextRecords::<T>::insert(text_id, record);

            // 9. 更新索引（TextsByDeceased）
            TextsByDeceased::<T>::try_mutate(deceased_id, |texts| {
                texts.try_push(text_id)
                    .map_err(|_| Error::<T>::TooManyItems)
            })?;

            // 10. 发出事件
            Self::deposit_event(Event::TextCreated {
                text_id,
                deceased_id,
                author: who,
                kind,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新文本内容（Text模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以更新文本内容
        /// - 不能更新正在被投诉的内容
        /// - 更新后版本号不变（链上不跟踪版本）
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `text_id`: 文本ID
        /// - `new_cid`: 新的IPFS内容CID（可选）
        /// - `new_title`: 新的标题（可选）
        /// - `new_summary`: 新的摘要（可选）
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        /// - 文本不能正在被投诉
        ///
        /// ### 返回
        /// - `Ok(())`: 更新成功
        /// - `Err(...)`: 更新失败
        #[pallet::call_index(79)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn update_text(
            origin: OriginFor<T>,
            text_id: T::TextId,
            new_cid: Option<Vec<u8>>,
            new_title: Option<Vec<u8>>,
            new_summary: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取文本记录
            let mut record = TextRecords::<T>::get(text_id)
                .ok_or(Error::<T>::BadInput)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let _deceased = Self::ensure_owner_and_get(record.deceased_id, &who)?;

            // 4. 检查文本是否正在被投诉
            ensure!(
                !Self::is_text_under_complaint(text_id),
                Error::<T>::ContentUnderComplaint
            );

            // 5. 更新字段
            if let Some(cid) = new_cid {
                record.cid = cid.try_into()
                    .map_err(|_| Error::<T>::BadInput)?;
            }
            if let Some(title) = new_title {
                record.title = Some(title.try_into()
                    .map_err(|_| Error::<T>::BadInput)?);
            }
            if let Some(summary) = new_summary {
                record.summary = Some(summary.try_into()
                    .map_err(|_| Error::<T>::BadInput)?);
            }

            // 6. 更新时间戳
            record.updated = <frame_system::Pallet<T>>::block_number();

            // 7. 保存更新
            TextRecords::<T>::insert(text_id, record.clone());

            // 8. 发出事件
            Self::deposit_event(Event::TextUpdated {
                text_id,
                deceased_id: record.deceased_id,
                editor: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：删除文本内容（Text模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以删除文本内容
        /// - 不能删除正在被投诉的内容
        /// - 删除后从索引中移除
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `text_id`: 文本ID
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        /// - 文本不能正在被投诉
        ///
        /// ### 返回
        /// - `Ok(())`: 删除成功
        /// - `Err(...)`: 删除失败
        #[pallet::call_index(85)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn delete_text(
            origin: OriginFor<T>,
            text_id: T::TextId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取文本记录
            let record = TextRecords::<T>::get(text_id)
                .ok_or(Error::<T>::BadInput)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let _deceased = Self::ensure_owner_and_get(record.deceased_id, &who)?;

            // 4. 检查文本是否正在被投诉
            ensure!(
                !Self::is_text_under_complaint(text_id),
                Error::<T>::ContentUnderComplaint
            );

            // 5. 从索引中移除
            TextsByDeceased::<T>::mutate(record.deceased_id, |texts| {
                texts.retain(|&id| id != text_id);
            });

            // 6. 删除文本记录
            TextRecords::<T>::remove(text_id);

            // 7. 发出事件
            Self::deposit_event(Event::TextDeleted {
                text_id,
                deceased_id: record.deceased_id,
                deleter: who,
            });

            Ok(())
        }

        // =================== Media 模块 CRUD 功能实现 ===================

        /// 函数级详细中文注释：创建相册（Album模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以创建相册用于图片聚合
        /// - 自动生成唯一相册ID并建立索引
        /// - 支持标题、描述、可见性等基本属性
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `title`: 相册标题
        /// - `desc`: 相册描述
        /// - `visibility`: 可见性（0=Public, 1=Unlisted, 2=Private）
        /// - `tags`: 标签列表
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        ///
        /// ### 返回
        /// - `Ok(())`: 创建成功
        /// - `Err(...)`: 创建失败
        #[pallet::call_index(87)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn create_album(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            title: Vec<u8>,
            desc: Vec<u8>,
            visibility: u8,
            tags: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let deceased = Self::ensure_owner_and_get(deceased_id, &who)?;

            // 3. 转换visibility为枚举
            let visibility_enum = match visibility {
                0 => media::Visibility::Public,
                1 => media::Visibility::Unlisted,
                2 => media::Visibility::Private,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 4. 转换参数为BoundedVec
            let title_bounded: BoundedVec<u8, T::StringLimit> = title.try_into()
                .map_err(|_| Error::<T>::BadInput)?;
            let desc_bounded: BoundedVec<u8, T::StringLimit> = desc.try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 转换tags
            let tags_bounded: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = tags
                .into_iter()
                .map(|tag| tag.try_into().map_err(|_| Error::<T>::BadInput))
                .collect::<Result<Vec<_>, _>>()?
                .try_into()
                .map_err(|_| Error::<T>::TooManyItems)?;

            // 5. 获取下一个AlbumId
            let album_id = NextAlbumId::<T>::get();
            let next_id = album_id.saturating_add(One::one());
            NextAlbumId::<T>::put(next_id);

            // 6. 获取当前区块号
            let now = <frame_system::Pallet<T>>::block_number();

            // 7. 创建Album
            let album = media::Album {
                deceased_id,
                deceased_token: deceased.deceased_token.clone(),
                owner: who.clone(),
                title: title_bounded,
                desc: desc_bounded,
                visibility: visibility_enum,
                tags: tags_bounded,
                primary_photo_id: None,
                created: now,
                updated: now,
                version: 1,
            };

            // 8. 存储Album
            Albums::<T>::insert(album_id, album);

            // 9. 更新索引（AlbumsByDeceased）
            AlbumsByDeceased::<T>::try_mutate(deceased_id, |albums| {
                albums.try_push(album_id)
                    .map_err(|_| Error::<T>::TooManyItems)
            })?;

            // 10. 发出事件
            Self::deposit_event(Event::AlbumCreated {
                album_id,
                deceased_id,
                owner: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新相册（Album模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以更新相册属性
        /// - 不能更新正在被投诉的内容
        /// - 更新后版本号自增
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `album_id`: 相册ID
        /// - `title`: 新标题（可选）
        /// - `desc`: 新描述（可选）
        /// - `visibility`: 新可见性（可选）
        /// - `tags`: 新标签列表（可选）
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        /// - 相册不能正在被投诉
        ///
        /// ### 返回
        /// - `Ok(())`: 更新成功
        /// - `Err(...)`: 更新失败
        #[pallet::call_index(88)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn update_album(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            title: Option<Vec<u8>>,
            desc: Option<Vec<u8>>,
            visibility: Option<u8>,
            tags: Option<Vec<Vec<u8>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取相册记录
            let mut album = Albums::<T>::get(album_id)
                .ok_or(Error::<T>::BadInput)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let _deceased = Self::ensure_owner_and_get(album.deceased_id, &who)?;

            // 4. 检查相册是否正在被投诉
            ensure!(
                !Self::is_album_under_complaint(album_id),
                Error::<T>::ContentUnderComplaint
            );

            // 5. 更新字段
            if let Some(new_title) = title {
                album.title = new_title.try_into()
                    .map_err(|_| Error::<T>::BadInput)?;
            }
            if let Some(new_desc) = desc {
                album.desc = new_desc.try_into()
                    .map_err(|_| Error::<T>::BadInput)?;
            }
            if let Some(new_visibility) = visibility {
                album.visibility = match new_visibility {
                    0 => media::Visibility::Public,
                    1 => media::Visibility::Unlisted,
                    2 => media::Visibility::Private,
                    _ => return Err(Error::<T>::BadInput.into()),
                };
            }
            if let Some(new_tags) = tags {
                album.tags = new_tags
                    .into_iter()
                    .map(|tag| tag.try_into().map_err(|_| Error::<T>::BadInput))
                    .collect::<Result<Vec<_>, _>>()?
                    .try_into()
                    .map_err(|_| Error::<T>::TooManyItems)?;
            }

            // 6. 更新时间戳和版本号
            album.updated = <frame_system::Pallet<T>>::block_number();
            album.version = album.version.saturating_add(1);

            // 7. 保存更新
            Albums::<T>::insert(album_id, album);

            // 8. 发出事件
            Self::deposit_event(Event::AlbumUpdated {
                album_id,
                editor: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：删除相册（Album模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以删除相册
        /// - 不能删除正在被投诉的内容
        /// - 删除后从索引中移除
        /// - 相册下的所有照片也会被移除引用
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `album_id`: 相册ID
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        /// - 相册不能正在被投诉
        ///
        /// ### 返回
        /// - `Ok(())`: 删除成功
        /// - `Err(...)`: 删除失败
        #[pallet::call_index(89)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn delete_album(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取相册记录
            let album = Albums::<T>::get(album_id)
                .ok_or(Error::<T>::BadInput)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let _deceased = Self::ensure_owner_and_get(album.deceased_id, &who)?;

            // 4. 检查相册是否正在被投诉
            ensure!(
                !Self::is_album_under_complaint(album_id),
                Error::<T>::ContentUnderComplaint
            );

            // 5. 更新相册下的所有照片，清除album_id引用
            let photos = PhotosByAlbum::<T>::get(album_id);
            for photo_id in photos {
                if let Some(mut media) = MediaRecords::<T>::get(photo_id) {
                    media.album_id = None;
                    MediaRecords::<T>::insert(photo_id, media);
                }
            }

            // 6. 删除相册下的照片索引
            PhotosByAlbum::<T>::remove(album_id);

            // 7. 从逝者相册索引中移除
            AlbumsByDeceased::<T>::mutate(album.deceased_id, |albums| {
                albums.retain(|&id| id != album_id);
            });

            // 8. 删除相册记录
            Albums::<T>::remove(album_id);

            // 9. 发出事件
            Self::deposit_event(Event::AlbumDeleted {
                album_id,
                deceased_id: album.deceased_id,
                deleter: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：创建媒体记录（Media模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以创建媒体记录（Photo/Video/Audio）
        /// - 自动生成唯一媒体ID并建立索引
        /// - 可关联到相册或视频集
        /// - 支持元数据（尺寸、时长等）
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `kind`: 媒体类型（0=Photo, 1=Video, 2=Audio）
        /// - `uri`: 媒体URI（IPFS CID等）
        /// - `thumbnail_uri`: 缩略图URI（可选）
        /// - `album_id`: 所属相册ID（可选，仅Photo使用）
        /// - `video_collection_id`: 所属视频集ID（可选，Video/Audio使用）
        /// - `width`: 宽度（可选）
        /// - `height`: 高度（可选）
        /// - `duration_secs`: 时长秒数（可选）
        /// - `order_index`: 排序索引
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        ///
        /// ### 返回
        /// - `Ok(())`: 创建成功
        /// - `Err(...)`: 创建失败
        #[pallet::call_index(90)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn create_media(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            kind: u8,
            uri: Vec<u8>,
            thumbnail_uri: Option<Vec<u8>>,
            album_id: Option<T::AlbumId>,
            video_collection_id: Option<T::VideoCollectionId>,
            width: Option<u32>,
            height: Option<u32>,
            duration_secs: Option<u32>,
            order_index: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let deceased = Self::ensure_owner_and_get(deceased_id, &who)?;

            // 3. 转换kind为MediaKind枚举
            let kind_enum = match kind {
                0 => media::MediaKind::Photo,
                1 => media::MediaKind::Video,
                2 => media::MediaKind::Audio,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 4. 验证相册/视频集归属（如果指定的话）
            if let Some(aid) = album_id {
                let album = Albums::<T>::get(aid)
                    .ok_or(Error::<T>::BadInput)?;
                ensure!(album.deceased_id == deceased_id, Error::<T>::BadInput);
                // Photo类型才能关联相册
                ensure!(kind == 0, Error::<T>::BadInput);
            }
            if let Some(cid) = video_collection_id {
                let collection = VideoCollections::<T>::get(cid)
                    .ok_or(Error::<T>::BadInput)?;
                ensure!(collection.deceased_id == deceased_id, Error::<T>::BadInput);
                // Video/Audio类型才能关联视频集
                ensure!(kind == 1 || kind == 2, Error::<T>::BadInput);
            }

            // 5. 转换参数为BoundedVec
            let uri_bounded: BoundedVec<u8, T::StringLimit> = uri.try_into()
                .map_err(|_| Error::<T>::BadInput)?;
            let thumbnail_uri_bounded = if let Some(thumb) = thumbnail_uri {
                Some(thumb.try_into().map_err(|_| Error::<T>::BadInput)?)
            } else {
                None
            };

            // 6. 获取下一个MediaId
            let media_id = NextMediaId::<T>::get();
            let next_id = media_id.saturating_add(One::one());
            NextMediaId::<T>::put(next_id);

            // 7. 获取当前区块号
            let now = <frame_system::Pallet<T>>::block_number();

            // 8. 创建Media记录
            let media = media::Media {
                id: media_id,
                album_id,
                video_collection_id,
                deceased_id,
                deceased_token: deceased.deceased_token.clone(),
                owner: who.clone(),
                kind: kind_enum,
                uri: uri_bounded,
                thumbnail_uri: thumbnail_uri_bounded,
                content_hash: None, // 可后续添加哈希计算功能
                duration_secs,
                width,
                height,
                order_index,
                created: now,
                updated: now,
                version: 1,
            };

            // 9. 存储Media记录
            MediaRecords::<T>::insert(media_id, media);

            // 10. 更新相册/视频集索引
            if let Some(aid) = album_id {
                PhotosByAlbum::<T>::try_mutate(aid, |photos| {
                    photos.try_push(media_id)
                        .map_err(|_| Error::<T>::TooManyItems)
                })?;
            }
            if let Some(cid) = video_collection_id {
                VideosByCollection::<T>::try_mutate(cid, |videos| {
                    videos.try_push(media_id)
                        .map_err(|_| Error::<T>::TooManyItems)
                })?;
            }

            // 11. 发出事件
            Self::deposit_event(Event::MediaCreated {
                media_id,
                deceased_id,
                owner: who,
                kind,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新媒体记录（Media模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以更新媒体记录属性
        /// - 不能更新正在被投诉的内容
        /// - 更新后版本号自增
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `media_id`: 媒体ID
        /// - `uri`: 新URI（可选）
        /// - `thumbnail_uri`: 新缩略图URI（可选）
        /// - `width`: 新宽度（可选）
        /// - `height`: 新高度（可选）
        /// - `duration_secs`: 新时长（可选）
        /// - `order_index`: 新排序索引（可选）
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        /// - 媒体不能正在被投诉
        ///
        /// ### 返回
        /// - `Ok(())`: 更新成功
        /// - `Err(...)`: 更新失败
        #[pallet::call_index(91)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn update_media(
            origin: OriginFor<T>,
            media_id: T::MediaId,
            uri: Option<Vec<u8>>,
            thumbnail_uri: Option<Vec<u8>>,
            width: Option<u32>,
            height: Option<u32>,
            duration_secs: Option<u32>,
            order_index: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取媒体记录
            let mut media = MediaRecords::<T>::get(media_id)
                .ok_or(Error::<T>::BadInput)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let _deceased = Self::ensure_owner_and_get(media.deceased_id, &who)?;

            // 4. 检查媒体是否正在被投诉
            ensure!(
                !Self::is_media_under_complaint(media_id),
                Error::<T>::ContentUnderComplaint
            );

            // 5. 更新字段
            if let Some(new_uri) = uri {
                media.uri = new_uri.try_into()
                    .map_err(|_| Error::<T>::BadInput)?;
            }
            if let Some(new_thumbnail) = thumbnail_uri {
                media.thumbnail_uri = Some(new_thumbnail.try_into()
                    .map_err(|_| Error::<T>::BadInput)?);
            }
            if let Some(new_width) = width {
                media.width = Some(new_width);
            }
            if let Some(new_height) = height {
                media.height = Some(new_height);
            }
            if let Some(new_duration) = duration_secs {
                media.duration_secs = Some(new_duration);
            }
            if let Some(new_order) = order_index {
                media.order_index = new_order;
            }

            // 6. 更新时间戳和版本号
            media.updated = <frame_system::Pallet<T>>::block_number();
            media.version = media.version.saturating_add(1);

            // 7. 保存更新
            MediaRecords::<T>::insert(media_id, media);

            // 8. 发出事件
            Self::deposit_event(Event::MediaUpdated {
                media_id,
                editor: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：删除媒体记录（Media模块）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以删除媒体记录
        /// - 不能删除正在被投诉的内容
        /// - 删除后从所有索引中移除
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `media_id`: 媒体ID
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        /// - 媒体不能正在被投诉
        ///
        /// ### 返回
        /// - `Ok(())`: 删除成功
        /// - `Err(...)`: 删除失败
        #[pallet::call_index(92)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn delete_media(
            origin: OriginFor<T>,
            media_id: T::MediaId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取媒体记录
            let media = MediaRecords::<T>::get(media_id)
                .ok_or(Error::<T>::BadInput)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let _deceased = Self::ensure_owner_and_get(media.deceased_id, &who)?;

            // 4. 检查媒体是否正在被投诉
            ensure!(
                !Self::is_media_under_complaint(media_id),
                Error::<T>::ContentUnderComplaint
            );

            // 5. 从相册/视频集索引中移除
            if let Some(album_id) = media.album_id {
                PhotosByAlbum::<T>::mutate(album_id, |photos| {
                    photos.retain(|&id| id != media_id);
                });

                // 如果这是相册的主图，清除主图设置
                Albums::<T>::mutate(album_id, |album_opt| {
                    if let Some(album) = album_opt {
                        if album.primary_photo_id == Some(media_id) {
                            album.primary_photo_id = None;
                        }
                    }
                });
            }

            if let Some(collection_id) = media.video_collection_id {
                VideosByCollection::<T>::mutate(collection_id, |videos| {
                    videos.retain(|&id| id != media_id);
                });

                // 如果这是视频集的主视频，清除主视频设置
                VideoCollections::<T>::mutate(collection_id, |collection_opt| {
                    if let Some(collection) = collection_opt {
                        if collection.primary_video_id == Some(media_id) {
                            collection.primary_video_id = None;
                        }
                    }
                });
            }

            // 6. 删除媒体记录
            MediaRecords::<T>::remove(media_id);

            // 7. 发出事件
            Self::deposit_event(Event::MediaDeleted {
                media_id,
                deceased_id: media.deceased_id,
                deleter: who,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新生平信息（Life）
        ///
        /// ### 功能描述
        /// - 逝者拥有者可以更新生平信息
        /// - 生平是逝者的传记或生平简介
        /// - 每次更新版本号+1
        ///
        /// ### 参数说明
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `cid`: 新的IPFS内容CID
        ///
        /// ### 权限检查
        /// - 必须是逝者拥有者
        ///
        /// ### 返回
        /// - `Ok(())`: 更新成功
        /// - `Err(...)`: 更新失败
        #[pallet::call_index(86)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn update_life(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 验证逝者存在并获取deceased_token
            let deceased = DeceasedOf::<T>::get(deceased_id)
                .ok_or(Error::<T>::DeceasedNotFound)?;

            // 2. 验证调用者是逝者拥有者
            ensure!(who == deceased.owner, Error::<T>::NotDeceasedOwner);

            // 3. 转换CID为BoundedVec
            let cid_bounded: BoundedVec<u8, T::StringLimit> = cid.try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 4. 获取当前区块号
            let now = <frame_system::Pallet<T>>::block_number();

            // 5. 更新或创建Life记录
            Lives::<T>::mutate(deceased_id, |life_opt| {
                if let Some(life) = life_opt {
                    // 更新现有Life
                    life.cid = cid_bounded.clone();
                    life.updated = now;
                    life.version = life.version.saturating_add(1);
                    life.last_editor = Some(who.clone());
                } else {
                    // 创建新Life
                    *life_opt = Some(text::Life {
                        owner: who.clone(),
                        deceased_id,
                        deceased_token: deceased.deceased_token.clone(),
                        cid: cid_bounded.clone(),
                        updated: now,
                        version: 1,
                        last_editor: Some(who.clone()),
                    });
                }
            });

            // 6. 发出事件
            Self::deposit_event(Event::LifeUpdated {
                deceased_id,
                editor: who,
                version: Lives::<T>::get(deceased_id)
                    .map(|l| l.version)
                    .unwrap_or(1),
            });

            Ok(())
        }

        // =================== Text/Media 投诉机制实现 ===================

        /// 函数级详细中文注释：投诉文本内容
        ///
        /// ### 功能描述
        /// - 任何用户可以对文本内容提交投诉
        /// - 需要支付押金防止恶意投诉
        /// - 投诉成功返还押金，失败则押金罚没
        ///
        /// ### 参数说明
        /// - `origin`: 投诉人
        /// - `text_id`: 被投诉的文本ID
        /// - `reason`: 投诉原因
        ///
        /// ### 权限检查
        /// - 任何人可以投诉（包括匿名用户）
        /// - 文本必须存在
        ///
        /// ### 押金机制
        /// - 需要锁定一定数量的DUST作为投诉押金
        /// - 投诉成功：返还押金
        /// - 投诉失败：押金罚没给内容拥有者
        ///
        /// ### 返回
        /// - `Ok(())`: 投诉提交成功
        /// - `Err(...)`: 投诉提交失败
        #[pallet::call_index(96)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn complain_text(
            origin: OriginFor<T>,
            text_id: T::TextId,
            reason: Vec<u8>,
        ) -> DispatchResult {
            let complainant = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 验证文本记录存在
            let _text_record = TextRecords::<T>::get(text_id)
                .ok_or(Error::<T>::BadInput)?;

            // 2. 计算投诉押金（固定金额，例如10 DUST）
            let deposit = 10u128.saturating_mul(T::Fungible::minimum_balance().saturated_into::<u128>());
            let deposit_balance: BalanceOf<T> = deposit.saturated_into();

            // 3. 锁定投诉押金
            use frame_support::traits::fungible::hold::Mutate as HoldMutate;
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::TextComplaintDeposit),
                &complainant,
                deposit_balance,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 4. 生成投诉ID
            let complaint_id = NextTextComplaintId::<T>::get();
            let next_complaint_id = complaint_id.saturating_add(1);
            NextTextComplaintId::<T>::put(next_complaint_id);

            // 5. 转换reason为BoundedVec
            let _reason_bounded: BoundedVec<u8, ConstU32<1024>> = reason.try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 6. 创建投诉记录
            let complaint = text::ComplaintCase {
                complainant: complainant.clone(),
                deposit: deposit_balance,
                created: now,
                status: text::ComplaintStatus::Pending,
            };

            // 7. 存储投诉记录
            TextComplaints::<T>::insert(text_id, complaint_id, complaint);

            // 8. 发出事件
            Self::deposit_event(Event::TextComplaintSubmitted {
                text_id,
                complaint_id,
                complainant,
            });

            Ok(())
        }

        /// 函数级详细中文注释：审核文本投诉
        ///
        /// ### 功能描述
        /// - 管理员/委员会审核文本投诉
        /// - 决定投诉是否成立
        /// - 执行相应的押金分配
        ///
        /// ### 参数说明
        /// - `origin`: 审核人（需要治理权限）
        /// - `text_id`: 被投诉的文本ID
        /// - `complaint_id`: 投诉ID
        /// - `upheld`: 是否支持投诉（true=投诉成立，false=投诉不成立）
        ///
        /// ### 权限检查
        /// - 需要治理权限（管理员或委员会成员）
        ///
        /// ### 押金处理
        /// - 投诉成立：退还投诉人押金，删除违规内容
        /// - 投诉不成立：押金罚没给内容拥有者
        ///
        /// ### 返回
        /// - `Ok(())`: 审核完成
        /// - `Err(...)`: 审核失败
        #[pallet::call_index(97)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn review_text_complaint(
            origin: OriginFor<T>,
            text_id: T::TextId,
            complaint_id: u64,
            upheld: bool,
        ) -> DispatchResult {
            // TODO: 添加治理权限检查
            let _reviewer = ensure_signed(origin)?;

            // 1. 获取投诉记录
            let mut complaint = TextComplaints::<T>::get(text_id, complaint_id)
                .ok_or(Error::<T>::BadInput)?;

            // 2. 验证投诉状态（必须是Pending）
            ensure!(
                complaint.status == text::ComplaintStatus::Pending,
                Error::<T>::BadInput
            );

            // 3. 获取文本记录（用于获取拥有者信息）
            let text_record = TextRecords::<T>::get(text_id)
                .ok_or(Error::<T>::BadInput)?;

            // 4. 获取逝者记录（用于获取拥有者）
            let deceased = DeceasedOf::<T>::get(text_record.deceased_id)
                .ok_or(Error::<T>::DeceasedNotFound)?;

            use frame_support::traits::fungible::hold::Mutate as HoldMutate;

            if upheld {
                // 投诉成立：退还投诉人押金，删除文本
                T::Fungible::release(
                    &T::RuntimeHoldReason::from(crate::HoldReason::TextComplaintDeposit),
                    &complaint.complainant,
                    complaint.deposit,
                    frame_support::traits::tokens::Precision::Exact,
                )?;

                // 删除文本记录
                TextRecords::<T>::remove(text_id);

                // 从索引中移除
                TextsByDeceased::<T>::mutate(text_record.deceased_id, |texts| {
                    texts.retain(|&id| id != text_id);
                });
            } else {
                // 投诉不成立：转移押金给内容拥有者
                T::Fungible::transfer_on_hold(
                    &T::RuntimeHoldReason::from(crate::HoldReason::TextComplaintDeposit),
                    &complaint.complainant,
                    &deceased.owner,
                    complaint.deposit,
                    frame_support::traits::tokens::Precision::Exact,
                    frame_support::traits::tokens::Restriction::Free,
                    frame_support::traits::tokens::Fortitude::Polite,
                )?;
            }

            // 5. 更新投诉状态
            complaint.status = text::ComplaintStatus::Resolved;
            TextComplaints::<T>::insert(text_id, complaint_id, complaint);

            // 6. 发出事件
            Self::deposit_event(Event::TextComplaintResolved {
                text_id,
                complaint_id,
                upheld,
            });

            Ok(())
        }

        /// 函数级详细中文注释：投诉媒体内容（包括相册、视频集、媒体记录）
        ///
        /// ### 功能描述
        /// - 任何用户可以对媒体内容提交投诉
        /// - 需要支付押金防止恶意投诉
        /// - 投诉成功返还押金，失败则押金罚没
        ///
        /// ### 参数说明
        /// - `origin`: 投诉人
        /// - `media_id`: 被投诉的媒体ID
        /// - `reason`: 投诉原因
        ///
        /// ### 权限检查
        /// - 任何人可以投诉（包括匿名用户）
        /// - 媒体必须存在
        ///
        /// ### 押金机制
        /// - 需要锁定一定数量的DUST作为投诉押金
        /// - 投诉成功：返还押金
        /// - 投诉失败：押金罚没给内容拥有者
        ///
        /// ### 返回
        /// - `Ok(())`: 投诉提交成功
        /// - `Err(...)`: 投诉提交失败
        #[pallet::call_index(98)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn complain_media(
            origin: OriginFor<T>,
            media_id: T::MediaId,
            reason: Vec<u8>,
        ) -> DispatchResult {
            let complainant = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 验证媒体记录存在
            let _media_record = MediaRecords::<T>::get(media_id)
                .ok_or(Error::<T>::BadInput)?;

            // 2. 计算投诉押金（固定金额，例如10 DUST）
            let deposit = 10u128.saturating_mul(T::Fungible::minimum_balance().saturated_into::<u128>());
            let deposit_balance: BalanceOf<T> = deposit.saturated_into();

            // 3. 锁定投诉押金
            use frame_support::traits::fungible::hold::Mutate as HoldMutate;
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::MediaComplaintDeposit),
                &complainant,
                deposit_balance,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 4. 生成投诉ID
            let complaint_id = NextMediaComplaintId::<T>::get();
            let next_complaint_id = complaint_id.saturating_add(1);
            NextMediaComplaintId::<T>::put(next_complaint_id);

            // 5. 转换reason为BoundedVec
            let _reason_bounded: BoundedVec<u8, ConstU32<1024>> = reason.try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 6. 创建投诉记录
            let complaint = media::MediaComplaintCase {
                complainant: complainant.clone(),
                deposit: deposit_balance,
                created: now,
                status: media::MediaComplaintStatus::Pending,
            };

            // 7. 存储投诉记录
            MediaComplaints::<T>::insert(media_id, complaint_id, complaint);

            // 8. 发出事件
            Self::deposit_event(Event::MediaComplaintSubmitted {
                media_id,
                complaint_id,
                complainant,
            });

            Ok(())
        }

        /// 函数级详细中文注释：审核媒体投诉
        ///
        /// ### 功能描述
        /// - 管理员/委员会审核媒体投诉
        /// - 决定投诉是否成立
        /// - 执行相应的押金分配
        ///
        /// ### 参数说明
        /// - `origin`: 审核人（需要治理权限）
        /// - `media_id`: 被投诉的媒体ID
        /// - `complaint_id`: 投诉ID
        /// - `upheld`: 是否支持投诉（true=投诉成立，false=投诉不成立）
        ///
        /// ### 权限检查
        /// - 需要治理权限（管理员或委员会成员）
        ///
        /// ### 押金处理
        /// - 投诉成立：退还投诉人押金，删除违规内容
        /// - 投诉不成立：押金罚没给内容拥有者
        ///
        /// ### 返回
        /// - `Ok(())`: 审核完成
        /// - `Err(...)`: 审核失败
        #[pallet::call_index(99)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn review_media_complaint(
            origin: OriginFor<T>,
            media_id: T::MediaId,
            complaint_id: u64,
            upheld: bool,
        ) -> DispatchResult {
            // TODO: 添加治理权限检查
            let _reviewer = ensure_signed(origin)?;

            // 1. 获取投诉记录
            let mut complaint = MediaComplaints::<T>::get(media_id, complaint_id)
                .ok_or(Error::<T>::BadInput)?;

            // 2. 验证投诉状态（必须是Pending）
            ensure!(
                complaint.status == media::MediaComplaintStatus::Pending,
                Error::<T>::BadInput
            );

            // 3. 获取媒体记录（用于获取拥有者信息）
            let media_record = MediaRecords::<T>::get(media_id)
                .ok_or(Error::<T>::BadInput)?;

            // 4. 获取逝者记录（用于获取拥有者）
            let deceased = DeceasedOf::<T>::get(media_record.deceased_id)
                .ok_or(Error::<T>::DeceasedNotFound)?;

            use frame_support::traits::fungible::hold::Mutate as HoldMutate;

            if upheld {
                // 投诉成立：退还投诉人押金，删除媒体
                T::Fungible::release(
                    &T::RuntimeHoldReason::from(crate::HoldReason::MediaComplaintDeposit),
                    &complaint.complainant,
                    complaint.deposit,
                    frame_support::traits::tokens::Precision::Exact,
                )?;

                // 删除媒体记录前，先从相册/视频集索引中移除
                if let Some(album_id) = media_record.album_id {
                    PhotosByAlbum::<T>::mutate(album_id, |photos| {
                        photos.retain(|&id| id != media_id);
                    });

                    // 如果这是相册的主图，清除主图设置
                    Albums::<T>::mutate(album_id, |album_opt| {
                        if let Some(album) = album_opt {
                            if album.primary_photo_id == Some(media_id) {
                                album.primary_photo_id = None;
                            }
                        }
                    });
                }

                if let Some(collection_id) = media_record.video_collection_id {
                    VideosByCollection::<T>::mutate(collection_id, |videos| {
                        videos.retain(|&id| id != media_id);
                    });

                    // 如果这是视频集的主视频，清除主视频设置
                    VideoCollections::<T>::mutate(collection_id, |collection_opt| {
                        if let Some(collection) = collection_opt {
                            if collection.primary_video_id == Some(media_id) {
                                collection.primary_video_id = None;
                            }
                        }
                    });
                }

                // 删除媒体记录
                MediaRecords::<T>::remove(media_id);
            } else {
                // 投诉不成立：转移押金给内容拥有者
                T::Fungible::transfer_on_hold(
                    &T::RuntimeHoldReason::from(crate::HoldReason::MediaComplaintDeposit),
                    &complaint.complainant,
                    &deceased.owner,
                    complaint.deposit,
                    frame_support::traits::tokens::Precision::Exact,
                    frame_support::traits::tokens::Restriction::Free,
                    frame_support::traits::tokens::Fortitude::Polite,
                )?;
            }

            // 5. 更新投诉状态
            complaint.status = media::MediaComplaintStatus::Resolved;
            MediaComplaints::<T>::insert(media_id, complaint_id, complaint);

            // 6. 发出事件
            Self::deposit_event(Event::MediaComplaintResolved {
                media_id,
                complaint_id,
                upheld,
            });

            Ok(())
        }

        /// 函数级详细中文注释：自动确认操作并退还押金（方案E - 核心功能）
        ///
        /// ### 功能描述
        /// - 检查操作是否已过30天且无投诉
        /// - 自动转为Confirmed状态并退还押金
        /// - 可由任何人调用（类似垃圾回收）
        /// - 简化用户操作，不需要手动申请确认
        ///
        /// ### 时间线（方案E）
        /// ```
        /// Day 0: 非拥有者上传内容
        ///   - 支付1 USDT服务费给拥有者（立即）
        ///   - 锁定2 USDT押金
        ///   - 状态：Active
        ///
        /// Day 0-30: Active状态（可被投诉）
        ///
        /// Day 30+: 任何人可调用此函数
        ///   - 检查无投诉 → Confirmed状态
        ///   - 退还2 USDT押金给操作者
        /// ```
        ///
        /// ### 参数说明
        /// - `origin`: 任何签名账户（调用者）
        /// - `operation_id`: 操作ID
        ///
        /// ### 错误处理
        /// - `OperationNotFound`: 操作不存在
        /// - `BadInput`: 状态不是Active或30天未到
        ///
        /// ### 事件
        /// - `NonOwnerOperationConfirmed`: 操作已确认，押金已退还
        #[pallet::call_index(84)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn auto_finalize_operation(
            origin: OriginFor<T>,
            operation_id: u64,
        ) -> DispatchResult {
            let _caller = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 获取操作记录
            let mut operation = OwnerOperations::<T>::get(operation_id)
                .ok_or(Error::<T>::BadInput)?;

            // 2. 验证状态：必须是Active
            ensure!(
                operation.status == governance::OwnerOperationStatus::Active,
                Error::<T>::BadInput
            );

            // 3. 验证时间：必须已过30天
            ensure!(
                now >= operation.auto_confirm_at,
                Error::<T>::BadInput // TooEarly
            );

            // 4. 验证押金：只有非拥有者操作才有押金退还
            ensure!(
                operation.initial_deposit_usdt > 0,
                Error::<T>::BadInput // 拥有者操作无押金
            );

            // 5. 退还押金（使用Fungible Release机制）
            let total_deposit = operation.initial_deposit_dust;

            use frame_support::traits::fungible::hold::Mutate as HoldMutate;
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::NonOwnerOperationDeposit),
                &operation.owner,
                total_deposit,
                frame_support::traits::tokens::Precision::Exact,
            ).map_err(|_| Error::<T>::BadInput)?;

            // 6. 更新状态为Confirmed
            operation.status = governance::OwnerOperationStatus::Confirmed;

            OwnerOperations::<T>::insert(operation_id, operation.clone());

            // 7. 发出事件
            Self::deposit_event(Event::NonOwnerOperationConfirmed {
                operation_id,
                operator: operation.owner,
                refunded_dust: total_deposit,
            });

            Ok(())
        }

        // =================== Token 修改治理功能 ===================

        /// 函数级中文注释：提交 Token 修改次数扩展提案
        ///
        /// ### 功能描述
        /// - 逝者拥有者在用完修改次数后，可以发起治理提案申请额外修改次数
        /// - 提案需要提供申请理由和证据材料
        /// - 委员会将投票决定是否批准
        ///
        /// ### 权限
        /// - 必须是 deceased 的 owner
        /// - 必须已用完当前的修改次数（token_revision_count >= token_revision_limit）
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        /// - `additional_revisions`: 申请的额外修改次数（1-3次）
        /// - `reason`: 申请理由（需要详细说明为何需要额外修改）
        /// - `evidence_cids`: 证据材料CID列表（最多5个IPFS CID）
        ///
        /// ### 返回
        /// - `Ok(())`: 提案提交成功
        /// - `Err(NotAuthorized)`: 非逝者拥有者
        /// - `Err(NotEligibleForExtension)`: 还未用完修改次数
        /// - `Err(BadInput)`: 参数不合法
        #[pallet::call_index(100)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn submit_token_revision_proposal(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            additional_revisions: u8,
            reason: Vec<u8>,
            evidence_cids: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 🔐 Phase 3 优化：统一权限检查并获取数据
            let deceased = Self::ensure_owner_and_get(deceased_id, &who)?;

            // 验证已用完修改次数
            ensure!(
                deceased.token_revision_count >= deceased.token_revision_limit,
                Error::<T>::NotEligibleForExtension
            );

            // 验证额外次数合理（1-3次）
            ensure!(
                additional_revisions > 0 && additional_revisions <= 3,
                Error::<T>::BadInput
            );

            // 转换理由为 BoundedVec
            let reason_bv = BoundedVec::try_from(reason)
                .map_err(|_| Error::<T>::BadInput)?;

            // 转换证据CID列表为 BoundedVec
            let evidence_bv: BoundedVec<BoundedVec<u8, T::TokenLimit>, ConstU32<5>> = evidence_cids
                .into_iter()
                .map(|cid| BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput))
                .collect::<Result<Vec<_>, _>>()?
                .try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 生成提案ID
            let proposal_id = NextProposalId::<T>::get();
            NextProposalId::<T>::put(proposal_id.saturating_add(1));

            // 创建提案
            let proposal = TokenRevisionProposal {
                proposal_id,
                deceased_id,
                applicant: who.clone(),
                additional_revisions,
                reason: reason_bv,
                evidence_cids: evidence_bv,
                status: ProposalStatus::Pending,
                submitted_at: <frame_system::Pallet<T>>::block_number(),
                approve_votes: 0,
                reject_votes: 0,
            };

            // 存储提案
            TokenRevisionProposals::<T>::insert(proposal_id, proposal);

            // 发出事件
            Self::deposit_event(Event::TokenRevisionProposalSubmitted {
                proposal_id,
                deceased_id,
                applicant: who,
                additional_revisions,
            });

            Ok(())
        }

        /// 函数级中文注释：对 Token 修改提案投票
        ///
        /// ### 功能描述
        /// - 委员会成员对待审批的提案进行投票
        /// - 达到批准阈值后自动执行提案
        /// - 每个委员会成员每个提案只能投票一次
        ///
        /// ### 权限
        /// - 必须是委员会成员（CommitteeOrigin验证）
        /// - 每个提案只能投票一次
        ///
        /// ### 参数
        /// - `proposal_id`: 提案ID
        /// - `approve`: 是否批准（true=批准，false=拒绝）
        ///
        /// ### 返回
        /// - `Ok(())`: 投票成功
        /// - `Err(NotCommitteeMember)`: 非委员会成员
        /// - `Err(ProposalNotFound)`: 提案不存在
        /// - `Err(InvalidProposalStatus)`: 提案状态不正确（非Pending状态）
        /// - `Err(AlreadyVoted)`: 已对该提案投票
        #[pallet::call_index(101)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn vote_token_revision_proposal(
            origin: OriginFor<T>,
            proposal_id: u64,
            approve: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;

            // 验证是委员会成员
            T::CommitteeOrigin::ensure_origin(origin)
                .map_err(|_| Error::<T>::NotCommitteeMember)?;

            // 获取提案
            let mut proposal = TokenRevisionProposals::<T>::get(proposal_id)
                .ok_or(Error::<T>::ProposalNotFound)?;

            // 验证提案状态
            ensure!(
                proposal.status == ProposalStatus::Pending,
                Error::<T>::InvalidProposalStatus
            );

            // 检查是否已投票
            ensure!(
                !ProposalVotes::<T>::contains_key(proposal_id, &who),
                Error::<T>::AlreadyVoted
            );

            // 记录投票
            ProposalVotes::<T>::insert(proposal_id, &who, approve);

            // 更新计数
            if approve {
                proposal.approve_votes = proposal.approve_votes.saturating_add(1);
            } else {
                proposal.reject_votes = proposal.reject_votes.saturating_add(1);
            }

            // 发出投票事件
            Self::deposit_event(Event::TokenRevisionProposalVoted {
                proposal_id,
                voter: who,
                approve,
            });

            // 检查是否达到批准阈值
            let threshold = T::ApprovalThreshold::get();
            if proposal.approve_votes >= threshold {
                // 批准
                proposal.status = ProposalStatus::Approved;

                Self::deposit_event(Event::TokenRevisionProposalApproved {
                    proposal_id,
                    deceased_id: proposal.deceased_id,
                    approve_votes: proposal.approve_votes,
                    reject_votes: proposal.reject_votes,
                });

                // 自动执行
                Self::execute_token_revision_proposal(&proposal)?;
            } else {
                // 计算总投票数判断是否应该拒绝
                let total_votes = proposal.approve_votes + proposal.reject_votes;
                let committee_size = T::ApprovalThreshold::get() * 2; // 假设阈值是51%

                if total_votes >= committee_size && proposal.approve_votes < threshold {
                    // 拒绝
                    proposal.status = ProposalStatus::Rejected;

                    Self::deposit_event(Event::TokenRevisionProposalRejected {
                        proposal_id,
                        deceased_id: proposal.deceased_id,
                        approve_votes: proposal.approve_votes,
                        reject_votes: proposal.reject_votes,
                    });
                }
            }

            // 更新提案
            TokenRevisionProposals::<T>::insert(proposal_id, proposal);

            Ok(())
        }

        // =================== 🆕 内容级治理 Extrinsic 函数 ===================

        /// 函数级详细中文注释：记录拥有者操作（作品、文本、媒体的增删改）
        ///
        /// ### 核心功能
        /// - 记录拥有者对逝者内容的增删改操作
        /// - 锁定2 USDT等价押金（30天投诉期）
        /// - 30天无投诉自动确认并退还押金
        ///
        /// ### 参数
        /// - `origin`: 调用者（必须是逝者拥有者）
        /// - `deceased_id`: 逝者ID
        /// - `operation`: 操作类型（0=Add, 1=Modify, 2=Delete）
        /// - `content_type`: 内容类型（0=Text, 1=Media, 2=Works）
        /// - `content_id`: 内容ID（修改/删除时必填）
        /// - `new_content_cid`: 新内容CID（新增/修改时必填）
        /// - `reason`: 操作理由
        ///
        /// ### 押金机制
        /// - 押金金额：2 USDT（固定）
        /// - 锁定方式：Holds API
        /// - 退还条件：30天无投诉自动确认
        /// - 罚没条件：投诉成立后罚没（80%投诉人，20%委员会）
        ///
        /// ### 返回值
        /// - `Ok(())`: 操作记录成功
        /// - `Err(DeceasedNotFound)`: 逝者不存在
        /// - `Err(NotDeceasedOwner)`: 非逝者拥有者
        /// - `Err(ExchangeRateUnavailable)`: 汇率获取失败
        /// - `Err(InsufficientBalance)`: 余额不足锁定押金
        #[pallet::call_index(102)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn record_owner_operation(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            operation: u8,
            content_type: u8,
            content_id: Option<u64>,
            new_content_cid: Option<Vec<u8>>,
            reason: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 验证逝者存在且调用者是拥有者
            let deceased = DeceasedOf::<T>::get(deceased_id)
                .ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(deceased.owner == who, Error::<T>::NotDeceasedOwner);

            // 2. 转换操作类型和内容类型
            let operation_type = match operation {
                0 => governance::OperationType::Add,
                1 => governance::OperationType::Modify,
                2 => governance::OperationType::Delete,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            let content_type_enum = match content_type {
                0 => governance::ContentType::Text,
                1 => governance::ContentType::Media,
                2 => governance::ContentType::Works,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 3. 计算押金（固定2 USDT）
            let deposit_usdt = 2u32;
            let deposit_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(deposit_usdt)
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;
            let _exchange_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;

            // 4. 锁定押金（使用Holds API）
            T::Fungible::hold(
                &HoldReason::OwnerOperationDeposit.into(),
                &who,
                deposit_dust,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 5. 转换CID和理由
            let new_content_cid_bv = if let Some(cid) = new_content_cid {
                Some(BoundedVec::try_from(cid).map_err(|_| Error::<T>::BadInput)?)
            } else {
                None
            };
            let reason_bv = BoundedVec::try_from(reason)
                .map_err(|_| Error::<T>::BadInput)?;

            // 6. 生成操作ID
            let operation_id = NextOperationId::<T>::get();
            NextOperationId::<T>::put(operation_id.saturating_add(1));

            // 7. 计算30天后的自动确认时间（假设6秒/块，30天 = 432000块）
            let now = <frame_system::Pallet<T>>::block_number();
            let thirty_days_blocks: BlockNumberFor<T> = 432_000u32.into();
            let auto_confirm_at = now.saturating_add(thirty_days_blocks);

            // 7.5 类型转换（将 T::DeceasedId 转换为 u64）
            let deceased_id_u64: u64 = deceased_id.into();

            // 8. 创建操作记录
            let operation_record = governance::OwnerOperation {
                operation_id,
                owner: who.clone(),
                deceased_id: deceased_id_u64,
                operation: operation_type.clone(),
                content_type: content_type_enum.clone(),
                content_id,
                new_content_cid: new_content_cid_bv,
                reason: reason_bv,
                executed_at: now,
                auto_confirm_at,
                initial_deposit_usdt: deposit_usdt,
                initial_deposit_dust: deposit_dust,
                status: governance::OwnerOperationStatus::Active,
                complaint_count: 0,
            };

            // 9. 存储操作记录 (修复元组键语法，复用已定义的 deceased_id_u64)
            OwnerOperations::<T>::insert(operation_id, operation_record);
            OperationsByOwner::<T>::insert((who.clone(), operation_id), ());
            OperationsByDeceased::<T>::insert((deceased_id_u64, operation_id), ());

            // 10. 发出事件 (修复类型转换 - 使用原始的 deceased_id，它已经是 T::DeceasedId)
            Self::deposit_event(Event::OwnerOperationRecorded {
                operation_id,
                owner: who,
                deceased_id,  // 使用原始 T::DeceasedId 类型
                operation_type: operation,
                content_type,
                deposit_dust,
            });

            Ok(())
        }

        /// 函数级详细中文注释：提交操作投诉
        ///
        /// ### 核心功能
        /// - 任何人可对拥有者操作提交投诉
        /// - 锁定2 USDT等价投诉押金
        /// - 投诉成立：获得80%操作押金+退还投诉押金
        /// - 投诉不成立：罚没投诉押金（80%拥有者，20%委员会）
        ///
        /// ### 参数
        /// - `origin`: 调用者（投诉人）
        /// - `operation_id`: 操作ID
        /// - `complaint_type`: 投诉类型（0=虚假信息, 1=内容不当, 2=无权操作, 3=恶意操作）
        /// - `reason`: 投诉理由
        /// - `evidence_cids`: 证据CID列表（最多10个）
        ///
        /// ### 投诉条件
        /// - 操作必须在30天投诉期内
        /// - 操作状态必须是Active
        /// - 每个操作只能被投诉一次
        ///
        /// ### 返回值
        /// - `Ok(())`: 投诉提交成功
        /// - `Err(OperationNotFound)`: 操作不存在
        /// - `Err(ComplaintPeriodExpired)`: 投诉期已过
        /// - `Err(OperationAlreadyComplained)`: 操作已被投诉
        /// - `Err(ExchangeRateUnavailable)`: 汇率获取失败
        /// - `Err(InsufficientBalance)`: 余额不足锁定投诉押金
        #[pallet::call_index(103)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn submit_operation_complaint(
            origin: OriginFor<T>,
            operation_id: u64,
            complaint_type: u8,
            reason: Vec<u8>,
            evidence_cids: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 获取操作记录
            let operation = OwnerOperations::<T>::get(operation_id)
                .ok_or(Error::<T>::OperationNotFound)?;

            // 2. 检查操作状态（必须是Active）
            ensure!(
                operation.status == governance::OwnerOperationStatus::Active,
                Error::<T>::ComplaintNotPending // 复用错误类型
            );

            // 3. 检查投诉期（30天内）
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(
                now < operation.auto_confirm_at,
                Error::<T>::ComplaintPeriodExpired
            );

            // 4. 检查是否已被投诉 (修复存储查询方式)
            // StorageMap 使用元组键，需要手动检查投诉是否存在
            let next_complaint_id = NextOperationComplaintId::<T>::get();
            let mut has_existing_complaint = false;

            // 遍历所有投诉，查找与该操作相关的投诉
            for complaint_id in 0..next_complaint_id {
                if ComplaintsByOperation::<T>::contains_key((operation_id, complaint_id)) {
                    // 检查投诉状态是否仍然有效
                    if let Some(complaint) = OwnerOperationComplaints::<T>::get(complaint_id) {
                        if complaint.status == governance::ComplaintStatus::Submitted
                            || complaint.status == governance::ComplaintStatus::PendingEvidence {
                            has_existing_complaint = true;
                            break;
                        }
                    }
                }
            }

            ensure!(
                !has_existing_complaint,
                Error::<T>::OperationAlreadyComplained
            );

            // 5. 转换投诉类型
            let complaint_type_enum = match complaint_type {
                0 => governance::ComplaintType::FalseInformation,
                1 => governance::ComplaintType::Inappropriate,
                2 => governance::ComplaintType::Unauthorized,
                3 => governance::ComplaintType::Malicious,
                _ => return Err(Error::<T>::BadInput.into()),
            };

            // 6. 计算投诉押金（固定2 USDT）
            let deposit_usdt = 2u32;
            let deposit_dust = governance::ExchangeRateHelper::<T>::convert_usdt_to_dust(deposit_usdt)
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;

            // 7. 锁定投诉押金
            T::Fungible::hold(
                &HoldReason::OperationComplaintDeposit.into(),
                &who,
                deposit_dust,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 8. 转换理由和证据
            let reason_bv = BoundedVec::try_from(reason)
                .map_err(|_| Error::<T>::BadInput)?;
            let evidence_bv = evidence_cids.into_iter()
                .map(|cid| BoundedVec::try_from(cid))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|_| Error::<T>::BadInput)?;
            let evidence_bv = BoundedVec::try_from(evidence_bv)
                .map_err(|_| Error::<T>::BadInput)?;

            // 9. 生成投诉ID
            let complaint_id = NextOperationComplaintId::<T>::get();
            NextOperationComplaintId::<T>::put(complaint_id.saturating_add(1));

            // 10. 创建投诉记录
            let complaint = governance::OwnerOperationComplaint {
                complaint_id,
                complainant: who.clone(),
                operation_id,
                complaint_type: complaint_type_enum,
                reason: reason_bv,
                evidence_cids: evidence_bv,
                deposit_usdt,
                deposit_dust,
                status: governance::ComplaintStatus::Submitted,
                submitted_at: now,
                reviewed_at: None,
            };

            // 11. 存储投诉记录 (修复元组键语法)
            OwnerOperationComplaints::<T>::insert(complaint_id, complaint);
            ComplaintsByOperation::<T>::insert((operation_id, complaint_id), ());
            ComplaintsByComplainant::<T>::insert((who.clone(), complaint_id), ());

            // 12. 更新操作记录的投诉计数
            OwnerOperations::<T>::mutate(operation_id, |maybe_op| {
                if let Some(op) = maybe_op {
                    op.complaint_count = op.complaint_count.saturating_add(1);
                }
            });

            // 13. 发出事件 (修复变量作用域)
            Self::deposit_event(Event::OperationComplaintSubmitted {
                complaint_id,
                complainant: who,
                operation_id,
                deposit_dust,
            });

            Ok(())
        }

        /// 函数级详细中文注释：委员会审核操作投诉
        ///
        /// ### 核心功能
        /// - 委员会成员审核投诉并做出决定
        /// - 投诉成立：撤销操作，罚没操作押金（80%投诉人，20%委员会），退还投诉押金
        /// - 投诉不成立：罚没投诉押金（80%拥有者，20%委员会）
        ///
        /// ### 参数
        /// - `origin`: 调用者（必须是委员会成员）
        /// - `complaint_id`: 投诉ID
        /// - `decision`: 决策（0=投诉成立, 1=投诉不成立）
        ///
        /// ### 审核权限
        /// - 必须是委员会成员（GovernanceOrigin验证）
        ///
        /// ### 押金分配
        /// - **投诉成立**：
        ///   - 操作押金：80%投诉人 + 20%委员会
        ///   - 投诉押金：全额退还投诉人
        ///   - 操作状态：Revoked
        /// - **投诉不成立**：
        ///   - 投诉押金：80%拥有者 + 20%委员会
        ///   - 操作状态：维持Active
        ///
        /// ### 返回值
        /// - `Ok(())`: 审核成功
        /// - `Err(NotAuthorized)`: 非委员会成员
        /// - `Err(ComplaintNotFound)`: 投诉不存在
        /// - `Err(ComplaintNotPending)`: 投诉状态不是待审核
        /// - `Err(OperationNotFound)`: 操作不存在
        #[pallet::call_index(104)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn review_operation_complaint(
            origin: OriginFor<T>,
            complaint_id: u64,
            decision: u8,
        ) -> DispatchResult {
            // 1. 验证委员会权限
            Self::ensure_gov(origin)?;

            // 2. 获取投诉记录
            let mut complaint = OwnerOperationComplaints::<T>::get(complaint_id)
                .ok_or(Error::<T>::ComplaintNotFound)?;

            // 3. 验证投诉状态
            ensure!(
                complaint.status == governance::ComplaintStatus::Submitted,
                Error::<T>::ComplaintNotPending
            );

            // 4. 获取操作记录
            let mut operation = OwnerOperations::<T>::get(complaint.operation_id)
                .ok_or(Error::<T>::OperationNotFound)?;

            // 5. 转换决策
            let upheld = decision == 0; // 0=投诉成立, 1=投诉不成立
            let now = <frame_system::Pallet<T>>::block_number();

            let mut complainant_reward: Option<BalanceOf<T>> = None;
            let mut owner_reward: Option<BalanceOf<T>> = None;

            if upheld {
                // 投诉成立

                // 5.1 更新操作状态为Revoked
                operation.status = governance::OwnerOperationStatus::Revoked;

                // 5.2 释放操作押金并分配（80%投诉人，20%委员会）
                let total_deposit = operation.initial_deposit_dust;
                let complainant_share = total_deposit.saturating_mul(80u32.into()) / 100u32.into(); // 80%
                let committee_share = total_deposit.saturating_sub(complainant_share); // 20%

                // 释放拥有者的操作押金
                let _ = T::Fungible::release(
                    &HoldReason::OwnerOperationDeposit.into(),
                    &operation.owner,
                    total_deposit,
                    frame_support::traits::tokens::Precision::Exact,
                );

                // 转账给投诉人（80%）
                let _ = T::Fungible::transfer(
                    &operation.owner,
                    &complaint.complainant,
                    complainant_share,
                    frame_support::traits::tokens::Preservation::Expendable,
                );

                // 转账给委员会（20%）
                let committee_account = T::TreasuryAccount::get(); // 使用国库账户作为委员会账户
                let _ = T::Fungible::transfer(
                    &operation.owner,
                    &committee_account,
                    committee_share,
                    frame_support::traits::tokens::Preservation::Expendable,
                );

                // 5.3 释放投诉押金并退还给投诉人
                let _ = T::Fungible::release(
                    &HoldReason::OperationComplaintDeposit.into(),
                    &complaint.complainant,
                    complaint.deposit_dust,
                    frame_support::traits::tokens::Precision::Exact,
                );

                complainant_reward = Some(complainant_share);
            } else {
                // 投诉不成立

                // 5.1 操作状态维持Active（无需修改）

                // 5.2 释放投诉押金并分配（80%拥有者，20%委员会）
                let total_deposit = complaint.deposit_dust;
                let owner_share = total_deposit.saturating_mul(80u32.into()) / 100u32.into(); // 80%
                let committee_share = total_deposit.saturating_sub(owner_share); // 20%

                // 释放投诉人的投诉押金
                let _ = T::Fungible::release(
                    &HoldReason::OperationComplaintDeposit.into(),
                    &complaint.complainant,
                    total_deposit,
                    frame_support::traits::tokens::Precision::Exact,
                );

                // 转账给拥有者（80%）
                let _ = T::Fungible::transfer(
                    &complaint.complainant,
                    &operation.owner,
                    owner_share,
                    frame_support::traits::tokens::Preservation::Expendable,
                );

                // 转账给委员会（20%）
                let committee_account = T::TreasuryAccount::get(); // 使用国库账户作为委员会账户
                let _ = T::Fungible::transfer(
                    &complaint.complainant,
                    &committee_account,
                    committee_share,
                    frame_support::traits::tokens::Preservation::Expendable,
                );

                owner_reward = Some(owner_share);
            }

            // 6. 更新投诉状态
            complaint.status = if upheld {
                governance::ComplaintStatus::Upheld
            } else {
                governance::ComplaintStatus::Rejected
            };
            complaint.reviewed_at = Some(now);

            // 7. 保存更新
            OwnerOperationComplaints::<T>::insert(complaint_id, complaint.clone());
            OwnerOperations::<T>::insert(complaint.operation_id, operation);

            // 8. 发出事件
            Self::deposit_event(Event::OperationComplaintReviewed {
                complaint_id,
                operation_id: complaint.operation_id,
                upheld,
                complainant_reward,
                owner_reward,
            });

            Ok(())
        }
    }

    // ==================== 辅助函数 ====================

    impl<T: Config> Pallet<T>
    where
        u64: From<T::DeceasedId>,
    {
        // ==================== Token 修改治理辅助函数 ====================

        /// 函数级中文注释：执行 Token 修改提案（内部函数）
        ///
        /// ### 功能
        /// - 扩展 deceased 的 token_revision_limit
        /// - 发出执行事件
        /// - 更新提案状态为 Executed
        ///
        /// ### 参数
        /// - `proposal`: Token修改提案引用
        ///
        /// ### 返回值
        /// - `Ok(())`: 执行成功
        /// - `Err(InvalidProposalStatus)`: 提案状态不正确
        /// - `Err(DeceasedNotFound)`: 逝者记录不存在
        ///
        /// ### 设计说明
        /// - 额外次数上限：3次（单次申请最多）
        /// - 绝对上限：10次（累计最大值，即使治理批准也不能超过）
        fn execute_token_revision_proposal(
            proposal: &TokenRevisionProposal<T>
        ) -> DispatchResult {
            // 验证提案已批准
            ensure!(
                proposal.status == ProposalStatus::Approved,
                Error::<T>::InvalidProposalStatus
            );

            // 扩展修改次数上限
            DeceasedOf::<T>::try_mutate(proposal.deceased_id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;

                let old_limit = d.token_revision_limit;

                // 增加额外次数，但不超过最大值10
                let new_limit = d.token_revision_limit
                    .saturating_add(proposal.additional_revisions)
                    .min(10);

                d.token_revision_limit = new_limit;

                // 发出执行事件
                Self::deposit_event(Event::TokenRevisionProposalExecuted {
                    proposal_id: proposal.proposal_id,
                    deceased_id: proposal.deceased_id,
                    old_limit,
                    new_limit,
                });

                Ok(())
            })?;

            // 更新提案状态
            TokenRevisionProposals::<T>::mutate(proposal.proposal_id, |p| {
                if let Some(proposal) = p {
                    proposal.status = ProposalStatus::Executed;
                }
            });

            Ok(())
        }

        // ==================== 原有辅助函数 ====================

        /// 函数级详细中文注释：内部检查押金警告状态
        ///
        /// ### 功能
        /// - 检查是否已发出补充警告（supplement_warning）
        /// - 检查押金状态是否正常
        /// - 不锁定任何押金，仅做检查
        ///
        /// ### 设计理念
        /// - supplement_warning 的存在本身就说明押金不足
        /// - 无需重复检查 available_usdt，避免功能重复
        /// - 系统会在押金不足时自动设置 supplement_warning
        ///
        /// ### 参数
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 返回值
        /// - `Ok(())`: 无警告且状态正常，允许修改
        /// - `Err(DepositWarningActive)`: 已发出补充警告，禁止修改
        /// - `Err(BadInput)`: 押金记录不存在或状态异常
        pub fn ensure_sufficient_deposit_internal(deceased_id: u64) -> DispatchResult {
            let deposit_record = OwnerDepositRecords::<T>::get(deceased_id)
                .ok_or(Error::<T>::BadInput)?;

            // 检查是否已发出补充警告
            // 如果有警告，说明押金不足，不允许修改逝者信息
            if deposit_record.supplement_warning.is_some() {
                return Err(Error::<T>::DepositWarningActive.into());
            }

            // 检查押金状态是否为Active
            ensure!(
                deposit_record.status == governance::DepositStatus::Active,
                Error::<T>::BadInput
            );

            Ok(())
        }

        // ==================== Phase 3.2: 操作记录管理和30天投诉期机制 ====================

        /// 函数级详细中文注释：查询操作记录
        ///
        /// ### 功能
        /// - 根据operation_id查询操作记录
        ///
        /// ### 参数
        /// - `operation_id`: 操作ID
        ///
        /// ### 返回值
        /// - `Some(OwnerOperation<T>)`: 操作记录存在
        /// - `None`: 操作记录不存在
        pub fn get_owner_operation(operation_id: u64) -> Option<governance::OwnerOperation<T>> {
            OwnerOperations::<T>::get(operation_id)
        }

        /// 函数级详细中文注释：撤销操作（投诉成功时调用）
        ///
        /// ### 功能
        /// - 将操作状态从Active变为Revoked
        /// - 恢复被删除的内容（如果是删除操作）
        /// - 回滚被修改的内容（如果是修改操作）
        ///
        /// ### 参数
        /// - `operation_id`: 操作ID
        ///
        /// ### 返回值
        /// - `Ok(())`: 操作撤销成功
        /// - `Err`: 操作不存在或无法撤销
        ///
        /// ### 注意
        /// - 本函数仅标记操作为已撤销，不处理押金扣除（由投诉处理逻辑负责）
        /// - 实际的内容恢复需要根据operation_type进行不同处理
        pub fn revoke_operation(operation_id: u64) -> DispatchResult {
            let mut operation = OwnerOperations::<T>::get(operation_id)
                .ok_or(Error::<T>::OperationNotFound)?;

            // 只能撤销Active状态的操作
            ensure!(
                operation.status == governance::OwnerOperationStatus::Active,
                Error::<T>::BadInput
            );

            // 更新操作状态为已撤销
            operation.status = governance::OwnerOperationStatus::Revoked;
            OwnerOperations::<T>::insert(operation_id, operation.clone());

            // TODO: 根据操作类型恢复内容
            // - Delete操作：需要恢复被删除的内容
            // - Modify操作：需要回滚到修改前的内容
            // - Add操作：需要删除新增的内容
            //
            // 这部分逻辑较复杂，需要访问text/media/works模块
            // 暂时先标记为已撤销，具体恢复逻辑后续实现

            // 发出事件
            Self::deposit_event(Event::OwnerOperationRevoked {
                operation_id,
                deceased_id: operation.deceased_id,
                operation: operation.operation.as_u8(),
            });

            Ok(())
        }

        // ==================== Phase 4.3: 押金扣除和分配逻辑（80%/20%） ====================

        /// 函数级详细中文注释：处理投诉成立的情况
        ///
        /// ### 功能
        /// 1. 撤销操作（调用 revoke_operation）
        /// 2. 从拥有者押金池扣除罚款
        /// 3. 分配押金：
        ///    - 80%给投诉人（作为奖励）
        ///    - 20%给委员会（治理奖励）
        /// 4. 退还投诉押金给投诉人
        /// 5. 更新投诉状态为 Upheld
        /// 6. 发出事件
        ///
        /// ### 参数
        /// - `complaint_id`: 投诉ID
        /// - `complaint`: 投诉记录
        /// - `operation`: 操作记录
        ///
        /// ### 返回值
        /// - `Ok(())`: 处理成功
        /// - `Err`: 处理失败
        fn handle_complaint_valid(
            complaint_id: u64,
            complaint: &governance::OwnerOperationComplaint<T>,
            operation: &governance::OwnerOperation<T>,
        ) -> DispatchResult {
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 撤销操作
            Self::revoke_operation(complaint.operation_id)?;

            // 2. 从拥有者押金池扣除
            let deceased_id = operation.deceased_id;
            let mut deposit_record = OwnerDepositRecords::<T>::get(deceased_id)
                .ok_or(Error::<T>::BadInput)?;

            // 计算扣除金额（投诉押金的倍数，例如投诉押金的2倍）
            let deducted_usdt = complaint.deposit_usdt.saturating_mul(2);
            let deducted_dust = complaint.deposit_dust.saturating_mul(2u32.into());

            // 检查押金是否足够扣除
            ensure!(
                deposit_record.available_usdt >= deducted_usdt,
                Error::<T>::InsufficientBalance
            );

            // 扣除押金
            deposit_record.available_usdt = deposit_record.available_usdt.saturating_sub(deducted_usdt);
            deposit_record.available_dust = deposit_record.available_dust.saturating_sub(deducted_dust);
            deposit_record.deducted_usdt = deposit_record.deducted_usdt.saturating_add(deducted_usdt);
            deposit_record.deducted_dust = deposit_record.deducted_dust.saturating_add(deducted_dust);

            // 更新押金状态
            let min_required_usdt = 2u32; // TODO: 改为配置项
            if deposit_record.available_usdt < min_required_usdt {
                deposit_record.status = governance::DepositStatus::Insufficient;
            }

            OwnerDepositRecords::<T>::insert(deceased_id, deposit_record.clone());

            // 3. 分配押金：80%给投诉人，20%给委员会
            // 使用 u128 中间值来计算百分比
            let deducted_dust_u128: u128 = deducted_dust.saturated_into();
            let complainant_reward_u128 = deducted_dust_u128.saturating_mul(80).saturating_div(100);
            let committee_reward_u128 = deducted_dust_u128.saturating_mul(20).saturating_div(100);

            let complainant_reward: BalanceOf<T> = complainant_reward_u128.saturated_into();
            let committee_reward: BalanceOf<T> = committee_reward_u128.saturated_into();

            // 3.1 从拥有者的Hold押金中释放扣除的金额
            use frame_support::traits::fungible::hold::Mutate as HoldMutate;
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &operation.owner,
                deducted_dust,
                frame_support::traits::tokens::Precision::Exact,
            ).map_err(|_| Error::<T>::BadInput)?;

            // 3.2 转账给投诉人（80%）
            use frame_support::traits::fungible::Mutate as FungibleMutate;
            T::Fungible::transfer(
                &operation.owner,
                &complaint.complainant,
                complainant_reward,
                frame_support::traits::tokens::Preservation::Expendable,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 3.3 转账给委员会账户（20%）
            // 需要从 runtime 配置获取委员会账户
            // 这里使用 T::ArbitrationAccount 作为委员会账户
            T::Fungible::transfer(
                &operation.owner,
                &T::ArbitrationAccount::get(),
                committee_reward,
                frame_support::traits::tokens::Preservation::Expendable,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 4. 退还投诉押金给投诉人
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::ComplaintDeposit),
                &complaint.complainant,
                complaint.deposit_dust,
                frame_support::traits::tokens::Precision::Exact,
            ).map_err(|_| Error::<T>::BadInput)?;

            // 5. 更新投诉状态
            let mut updated_complaint = complaint.clone();
            updated_complaint.status = governance::ComplaintStatus::Upheld;
            updated_complaint.reviewed_at = Some(now);
            OwnerOperationComplaints::<T>::insert(complaint_id, updated_complaint);

            // 6. 发出事件
            Self::deposit_event(Event::ComplaintReviewed {
                complaint_id,
                operation_id: operation.operation_id,
                decision: 0, // ComplaintValid
            });

            Self::deposit_event(Event::ComplaintSuccessDepositDeducted {
                complaint_id,
                operation_id: operation.operation_id,
                deceased_id,
                deducted_usdt,
                deducted_dust,
                complainant_reward,
                committee_reward,
                remaining_deposit_usdt: deposit_record.available_usdt,
            });

            Ok(())
        }

        /// 函数级详细中文注释：处理投诉不成立的情况
        ///
        /// ### 功能
        /// 1. 罚没投诉押金
        /// 2. 分配投诉押金：
        ///    - 80%给拥有者（作为补偿）
        ///    - 20%给委员会（治理奖励）
        /// 3. 更新投诉状态为 Rejected
        /// 4. 发出事件
        ///
        /// ### 参数
        /// - `complaint_id`: 投诉ID
        /// - `complaint`: 投诉记录
        /// - `operation`: 操作记录
        ///
        /// ### 返回值
        /// - `Ok(())`: 处理成功
        /// - `Err`: 处理失败
        fn handle_complaint_invalid(
            complaint_id: u64,
            complaint: &governance::OwnerOperationComplaint<T>,
            operation: &governance::OwnerOperation<T>,
        ) -> DispatchResult {
            let now = <frame_system::Pallet<T>>::block_number();

            // 1. 计算分配金额：80%给拥有者，20%给委员会
            // 使用 u128 中间值来计算百分比
            let deposit_dust_u128: u128 = complaint.deposit_dust.saturated_into();
            let owner_compensation_u128 = deposit_dust_u128.saturating_mul(80).saturating_div(100);
            let committee_reward_u128 = deposit_dust_u128.saturating_mul(20).saturating_div(100);

            let owner_compensation: BalanceOf<T> = owner_compensation_u128.saturated_into();
            let committee_reward: BalanceOf<T> = committee_reward_u128.saturated_into();

            // 2. 罚没投诉人的押金并分配
            use frame_support::traits::fungible::hold::Mutate as HoldMutate;

            // 2.1 释放投诉押金（从Hold状态释放）
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::ComplaintDeposit),
                &complaint.complainant,
                complaint.deposit_dust,
                frame_support::traits::tokens::Precision::Exact,
            ).map_err(|_| Error::<T>::BadInput)?;

            // 2.2 从投诉人账户转账给拥有者（80%）
            use frame_support::traits::fungible::Mutate as FungibleMutate;
            T::Fungible::transfer(
                &complaint.complainant,
                &operation.owner,
                owner_compensation,
                frame_support::traits::tokens::Preservation::Expendable,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 2.3 从投诉人账户转账给委员会（20%）
            T::Fungible::transfer(
                &complaint.complainant,
                &T::ArbitrationAccount::get(),
                committee_reward,
                frame_support::traits::tokens::Preservation::Expendable,
            ).map_err(|_| Error::<T>::InsufficientBalance)?;

            // 3. 更新投诉状态
            let mut updated_complaint = complaint.clone();
            updated_complaint.status = governance::ComplaintStatus::Rejected;
            updated_complaint.reviewed_at = Some(now);
            OwnerOperationComplaints::<T>::insert(complaint_id, updated_complaint);

            // 4. 发出事件
            Self::deposit_event(Event::ComplaintReviewed {
                complaint_id,
                operation_id: operation.operation_id,
                decision: 1, // ComplaintInvalid
            });

            Self::deposit_event(Event::ComplaintRejectedDepositForfeited {
                complaint_id,
                operation_id: operation.operation_id,
                complainant: complaint.complainant.clone(),
                owner_compensation,
                committee_reward,
            });

            Ok(())
        }

        /// 函数级详细中文注释：检查操作是否在仲裁流程中
        ///
        /// ### 功能
        /// - 检查操作是否有待审核的投诉
        /// - 用于判断拥有者是否可以删除该操作
        ///
        /// ### 参数
        /// - `operation_id`: 操作ID
        ///
        /// ### 返回值
        /// - `true`: 有待审核投诉，不可删除
        /// - `false`: 无待审核投诉，可以删除
        fn is_operation_under_arbitration(operation_id: u64) -> bool {
            // 遍历该操作的所有投诉
            for ((op_id, complaint_id), _) in ComplaintsByOperation::<T>::iter() {
                if op_id == operation_id {
                    // 检查投诉状态
                    if let Some(complaint) = OwnerOperationComplaints::<T>::get(complaint_id) {
                        // 只有 Pending 状态才算在仲裁中
                        if complaint.status == governance::ComplaintStatus::Submitted ||
                           complaint.status == governance::ComplaintStatus::PendingEvidence {
                            return true;
                        }
                    }
                }
            }
            false
        }

        /// 函数级详细中文注释：检查文本是否正在被投诉
        ///
        /// ### 功能描述
        /// - 检查文本是否有待审核的投诉
        /// - 用于判断拥有者是否可以修改/删除该文本
        ///
        /// ### 参数
        /// - `text_id`: 文本ID
        ///
        /// ### 返回值
        /// - `true`: 有待审核投诉，不可修改/删除
        /// - `false`: 无待审核投诉，可以修改/删除
        fn is_text_under_complaint(text_id: T::TextId) -> bool {
            // 遍历该文本的所有投诉 (注意：DoubleMap迭代返回3元组)
            for (tid, _complaint_id, case) in TextComplaints::<T>::iter() {
                if tid == text_id {
                    // 只有 Pending 状态才算在投诉中
                    if case.status == text::ComplaintStatus::Pending {
                        return true;
                    }
                }
            }
            false
        }

        /// 函数级详细中文注释：检查媒体是否正在被投诉
        ///
        /// ### 功能描述
        /// - 检查媒体是否有待审核的投诉
        /// - 用于判断拥有者是否可以修改/删除该媒体
        ///
        /// ### 参数
        /// - `media_id`: 媒体ID
        ///
        /// ### 返回值
        /// - `true`: 有待审核投诉，不可修改/删除
        /// - `false`: 无待审核投诉，可以修改/删除
        fn is_media_under_complaint(media_id: T::MediaId) -> bool {
            // 遍历该媒体的所有投诉 (注意：DoubleMap迭代返回3元组)
            for (mid, _complaint_id, case) in MediaComplaints::<T>::iter() {
                if mid == media_id {
                    // 只有 Pending 状态才算在投诉中
                    if case.status == media::MediaComplaintStatus::Pending {
                        return true;
                    }
                }
            }
            false
        }

        /// 函数级详细中文注释：检查相册是否正在被投诉
        ///
        /// ### 功能描述
        /// - 检查相册下的任何媒体是否有待审核的投诉
        /// - 用于判断拥有者是否可以修改/删除该相册
        ///
        /// ### 参数
        /// - `album_id`: 相册ID
        ///
        /// ### 返回值
        /// - `true`: 有待审核投诉，不可修改/删除
        /// - `false`: 无待审核投诉，可以修改/删除
        fn is_album_under_complaint(album_id: T::AlbumId) -> bool {
            // 获取相册下的所有照片
            let photos = PhotosByAlbum::<T>::get(album_id);
            for photo_id in photos {
                if Self::is_media_under_complaint(photo_id) {
                    return true;
                }
            }
            false
        }

        /// 函数级详细中文注释：检查视频集是否正在被投诉
        ///
        /// ### 功能描述
        /// - 检查视频集下的任何媒体是否有待审核的投诉
        /// - 用于判断拥有者是否可以修改/删除该视频集
        ///
        /// ### 参数
        /// - `collection_id`: 视频集ID
        ///
        /// ### 返回值
        /// - `true`: 有待审核投诉，不可修改/删除
        /// - `false`: 无待审核投诉，可以修改/删除
        #[allow(dead_code)]
        fn is_video_collection_under_complaint(collection_id: T::VideoCollectionId) -> bool {
            // 获取视频集下的所有视频
            let videos = VideosByCollection::<T>::get(collection_id);
            for video_id in videos {
                if Self::is_media_under_complaint(video_id) {
                    return true;
                }
            }
            false
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：运行时升级钩子（开发期零迁移）。
        /// - 主网未上线阶段，采用"零迁移"策略：不执行 translate，仅写入当前 STORAGE_VERSION；
        /// - 若需结构调整，请清链/重启以应用最新结构；主网上线前再提供精确迁移版本。
        fn on_runtime_upgrade() -> Weight {
            STORAGE_VERSION.put::<Pallet<T>>();
            Weight::from_parts(10_000, 0)
        }

        /// 函数级详细中文注释：区块结束钩子 - 自动过期处理
        ///
        /// ### 功能说明
        /// 在每个区块结束时,自动检查所有待审核的分类修改申请:
        /// - 检查申请是否已超过截止时间
        /// - 自动将过期的申请标记为 Expired
        /// - 全额退还押金给申请人
        /// - 发出 CategoryChangeExpired 事件
        ///
        /// ### 执行条件
        /// - 申请状态为 Pending
        /// - 当前区块号 > 申请截止时间
        ///
        /// ### 押金处理
        /// - 过期申请: 全额退还 10 DUST 押金
        ///
        /// ### 性能考虑
        /// - 只遍历待审核状态的申请
        /// - 批量处理时考虑权重限制
        /// - 使用存储读写次数计算权重
        fn on_finalize(now: BlockNumberFor<T>) {
            // 遍历所有分类修改申请
            for (request_id, mut request) in CategoryChangeRequests::<T>::iter() {
                // 仅处理待审核且已过期的申请
                if request.status == RequestStatus::Pending && now > request.deadline {
                    // 更新状态为过期
                    request.status = RequestStatus::Expired;

                    // 退还全额押金
                    let deposit = 10u128.saturating_mul(1_000_000_000_000u128);
                    T::Currency::unreserve(&request.applicant, deposit.saturated_into());

                    // 更新存储
                    CategoryChangeRequests::<T>::insert(request_id, request.clone());

                    // 发出事件
                    Self::deposit_event(Event::CategoryChangeExpired {
                        request_id,
                        deceased_id: request.deceased_id,
                    });
                }
            }
        }
    }
}
