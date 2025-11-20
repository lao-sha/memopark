//! # 逝者作品记录模块 (Phase 1: AI训练数据基础)
//!
//! ## 概述
//!
//! 本模块负责记录逝者生前创作的各类作品，为未来的AI智能体训练提供数据基础。
//! 通过IPFS存储原文件，链上存储元数据和分类信息。
//!
//! ## 功能特性
//!
//! - 支持多种作品类型（文字、音频、视频、图像等）
//! - 分层隐私控制（公开、家人、后代、私密）
//! - AI训练授权管理
//! - 作品验证机制
//! - 标签和分类系统
//!
//! ## 版本历史
//!
//! - v0.1.0 (2025-11-13): 初始实现，支持基础作品记录

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

// ===== 作品类型定义 =====

/// 函数级详细中文注释：文学体裁枚举
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum LiteratureGenre {
    /// 小说
    Novel,
    /// 散文
    Prose,
    /// 诗歌
    Poetry,
    /// 戏剧
    Drama,
    /// 杂文/评论
    Essay,
}

/// 函数级详细中文注释：隐私级别枚举
///
/// ## 级别说明
/// - **Public**: 完全公开，任何人可查看
/// - **Family**: 仅家人可见（需验证家庭关系）
/// - **Descendants**: 仅后代可见（需验证血缘关系）
/// - **Private**: 私密内容，仅用于AI训练，不公开展示
///
/// ## 权限控制
/// - 墓地所有者始终可以访问所有级别
/// - AI训练服务需要专门授权
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[codec(mel_bound())]
pub enum PrivacyLevel {
    /// 完全公开
    Public,
    /// 仅家人可见
    Family,
    /// 仅后代可见
    Descendants,
    /// 私密（仅AI训练）
    Private,
}

impl Default for PrivacyLevel {
    fn default() -> Self {
        PrivacyLevel::Family
    }
}

impl PrivacyLevel {
    /// 函数级中文注释：从u8代码转换为PrivacyLevel枚举
    ///
    /// 用途：
    /// - extrinsic参数使用u8传递，避免DecodeWithMemTracking问题
    /// - 在函数内部转换为枚举类型
    ///
    /// 映射：
    /// - 0 => Public
    /// - 1 => Family (默认)
    /// - 2 => Descendants
    /// - 3 => Private
    /// - 其他 => Family (默认)
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => PrivacyLevel::Public,
            1 => PrivacyLevel::Family,
            2 => PrivacyLevel::Descendants,
            3 => PrivacyLevel::Private,
            _ => PrivacyLevel::Family,
        }
    }

    /// 函数级中文注释：转换为u8代码
    ///
    /// 用途：
    /// - 事件发射时的编码
    /// - 与from_u8对应
    pub fn to_u8(&self) -> u8 {
        match self {
            PrivacyLevel::Public => 0,
            PrivacyLevel::Family => 1,
            PrivacyLevel::Descendants => 2,
            PrivacyLevel::Private => 3,
        }
    }
}

/// 函数级详细中文注释：作品类型枚举
///
/// ## 设计理念
/// - 支持多种媒体类型，覆盖逝者生前的各类创作
/// - 每种类型有特定的元数据字段
/// - 可通过runtime升级扩展新类型
///
/// ## 类型分类
/// - **文字类**：Literature, AcademicPaper, Diary, Letter
/// - **音频类**：VoiceDiary, Music, Podcast
/// - **视频类**：VideoLog, Lecture, LifeClip
/// - **图像类**：Artwork, Design
/// - **社交媒体**：SocialMedia
/// - **专业知识**：Code, SkillDemo
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[codec(mel_bound())]
pub enum WorkType {
    // === 文字类 ===
    /// 文学作品（小说、散文、诗歌、戏剧）
    Literature {
        /// 文学体裁
        genre: LiteratureGenre,
        /// 字数
        word_count: u32,
    },

    /// 学术论文
    AcademicPaper {
        /// 研究领域（BoundedVec限制50字符）
        field: BoundedVec<u8, ConstU32<50>>,
        /// 发表期刊（可选，BoundedVec限制100字符）
        publication: Option<BoundedVec<u8, ConstU32<100>>>,
    },

    /// 日记/随笔
    Diary,

    /// 书信
    Letter {
        /// 收信人（可选）
        recipient: Option<BoundedVec<u8, ConstU32<100>>>,
    },

    // === 音频类 ===
    /// 语音日记
    VoiceDiary {
        /// 时长（秒）
        duration: u32,
        /// 是否有转录文本
        has_transcript: bool,
    },

    /// 音乐作品
    Music {
        /// 音乐类型
        genre: BoundedVec<u8, ConstU32<50>>,
        /// 是否有歌词
        has_lyrics: bool,
    },

    /// 播客/演讲
    Podcast {
        /// 主题
        topic: BoundedVec<u8, ConstU32<100>>,
        /// 是否有转录文本
        has_transcript: bool,
    },

    // === 视频类 ===
    /// 视频日记/Vlog
    VideoLog {
        /// 时长（秒）
        duration: u32,
        /// 是否有字幕
        has_subtitles: bool,
    },

    /// 讲座/课程
    Lecture {
        /// 学科/主题
        subject: BoundedVec<u8, ConstU32<100>>,
        /// 是否有字幕
        has_subtitles: bool,
    },

    /// 生活片段
    LifeClip {
        /// 场合描述
        occasion: BoundedVec<u8, ConstU32<100>>,
    },

    // === 图像类 ===
    /// 艺术作品（绘画、摄影）
    Artwork {
        /// 媒介（油画/水彩/摄影等）
        medium: BoundedVec<u8, ConstU32<50>>,
        /// 风格
        style: BoundedVec<u8, ConstU32<50>>,
    },

    /// 设计作品
    Design {
        /// 设计类别（平面/产品/建筑等）
        category: BoundedVec<u8, ConstU32<50>>,
    },

    // === 社交媒体 ===
    /// 社交媒体内容
    SocialMedia {
        /// 平台名称
        platform: BoundedVec<u8, ConstU32<50>>,
        /// 帖子类型（状态/文章/评论）
        post_type: BoundedVec<u8, ConstU32<50>>,
    },

    // === 专业知识 ===
    /// 代码/技术作品
    Code {
        /// 编程语言
        language: BoundedVec<u8, ConstU32<50>>,
        /// 项目描述
        project_desc: BoundedVec<u8, ConstU32<200>>,
    },

    /// 专业技能展示
    SkillDemo {
        /// 技能名称
        skill_name: BoundedVec<u8, ConstU32<100>>,
        /// 描述
        description: BoundedVec<u8, ConstU32<200>>,
    },
}

/// 函数级详细中文注释：逝者作品记录结构
///
/// ## 字段说明
/// - `work_id`: 作品唯一ID（全局递增）
/// - `deceased_id`: 所属逝者ID
/// - `work_type`: 作品类型及相关元数据
/// - `title`: 作品标题
/// - `description`: 作品描述
/// - `ipfs_cid`: IPFS内容地址（存储原文件）
/// - `file_size`: 文件大小（字节）
/// - `created_at`: 创作时间（逝者生前，Unix时间戳）
/// - `uploaded_at`: 上传时间（链上区块号）
/// - `uploader`: 上传者账户
///
/// ## AI训练相关字段
/// - `tags`: 主题标签（最多20个，每个50字符）
/// - `sentiment`: 情感倾向（-100到100，负面到正面）
/// - `style_tags`: 语言风格标签（最多10个）
/// - `expertise_fields`: 专业领域标签（最多10个）
///
/// ## 权限控制字段
/// - `privacy_level`: 隐私级别
/// - `ai_training_enabled`: 是否授权用于AI训练
/// - `public_display`: 是否可公开展示
///
/// ## 验证字段
/// - `verified`: 是否已验证真实性
/// - `verifier`: 验证者账户（可选）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, BlockNumber))]
pub struct DeceasedWork<AccountId, BlockNumber> {
    /// 作品ID
    pub work_id: u64,

    /// 所属逝者ID
    pub deceased_id: u64,

    /// 作品类型
    pub work_type: WorkType,

    /// 作品标题（最多200字符）
    pub title: BoundedVec<u8, ConstU32<200>>,

    /// 作品描述（最多1000字符）
    pub description: BoundedVec<u8, ConstU32<1000>>,

    /// IPFS存储地址（CID，最多64字符）
    pub ipfs_cid: BoundedVec<u8, ConstU32<64>>,

    /// 文件大小（字节）
    pub file_size: u64,

    /// 创作时间（Unix时间戳，可选）
    pub created_at: Option<u64>,

    /// 上传时间（区块号）
    pub uploaded_at: BlockNumber,

    /// 上传者账户
    pub uploader: AccountId,

    // === AI相关标签 ===
    /// 主题标签（最多20个，每个50字符）
    pub tags: BoundedVec<BoundedVec<u8, ConstU32<50>>, ConstU32<20>>,

    /// 情感倾向（-100到100，可选）
    pub sentiment: Option<i8>,

    /// 语言风格标签（最多10个，每个50字符）
    pub style_tags: BoundedVec<BoundedVec<u8, ConstU32<50>>, ConstU32<10>>,

    /// 专业领域标签（最多10个，每个50字符）
    pub expertise_fields: BoundedVec<BoundedVec<u8, ConstU32<50>>, ConstU32<10>>,

    // === 权限控制 ===
    /// 隐私级别
    pub privacy_level: PrivacyLevel,

    /// 是否授权用于AI训练
    pub ai_training_enabled: bool,

    /// 是否可公开展示
    pub public_display: bool,

    // === 验证信息 ===
    /// 是否已验证真实性
    pub verified: bool,

    /// 验证者账户（可选）
    pub verifier: Option<AccountId>,
}

/// 函数级详细中文注释：作品上传信息（简化版，用于批量上传）
///
/// ## 用途
/// - 批量上传作品时使用
/// - 减少参数传递复杂度
///
/// ## 字段
/// - 包含创建作品所需的核心信息
/// - 系统自动填充work_id、uploaded_at等字段
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[codec(mel_bound())]
pub struct WorkUploadInfo {
    /// 作品类型
    pub work_type: WorkType,

    /// 作品标题
    pub title: BoundedVec<u8, ConstU32<200>>,

    /// 作品描述
    pub description: BoundedVec<u8, ConstU32<1000>>,

    /// IPFS CID
    pub ipfs_cid: BoundedVec<u8, ConstU32<64>>,

    /// 文件大小
    pub file_size: u64,

    /// 创作时间（可选）
    pub created_at: Option<u64>,

    /// 主题标签
    pub tags: BoundedVec<BoundedVec<u8, ConstU32<50>>, ConstU32<20>>,

    /// 隐私级别
    pub privacy_level: PrivacyLevel,

    /// 是否授权AI训练
    pub ai_training_enabled: bool,
}

// ===== 辅助函数 =====

impl WorkType {
    /// 函数级详细中文注释：判断是否为文本类型作品
    ///
    /// ## 用途
    /// - AI训练时优先使用文本类型作品
    /// - 前端展示时区分处理方式
    ///
    /// ## 返回
    /// - true: 文本类型（Literature, AcademicPaper, Diary, Letter, SocialMedia）
    /// - false: 其他类型
    pub fn is_text_based(&self) -> bool {
        matches!(
            self,
            WorkType::Literature { .. }
                | WorkType::AcademicPaper { .. }
                | WorkType::Diary
                | WorkType::Letter { .. }
                | WorkType::SocialMedia { .. }
                | WorkType::Code { .. }
        )
    }

    /// 函数级详细中文注释：判断是否为音频类型作品
    pub fn is_audio_based(&self) -> bool {
        matches!(
            self,
            WorkType::VoiceDiary { .. } | WorkType::Music { .. } | WorkType::Podcast { .. }
        )
    }

    /// 函数级详细中文注释：判断是否为视频类型作品
    pub fn is_video_based(&self) -> bool {
        matches!(
            self,
            WorkType::VideoLog { .. } | WorkType::Lecture { .. } | WorkType::LifeClip { .. }
        )
    }

    /// 函数级详细中文注释：判断是否有转录文本
    ///
    /// ## 用途
    /// - AI训练时，有转录文本的音频/视频作品可以当作文本处理
    ///
    /// ## 返回
    /// - true: 作品有转录文本或字幕
    /// - false: 没有转录文本
    pub fn has_transcript(&self) -> bool {
        match self {
            WorkType::VoiceDiary { has_transcript, .. } => *has_transcript,
            WorkType::Podcast { has_transcript, .. } => *has_transcript,
            WorkType::VideoLog { has_subtitles, .. } => *has_subtitles,
            WorkType::Lecture { has_subtitles, .. } => *has_subtitles,
            _ => false,
        }
    }

    /// 函数级详细中文注释：获取作品类型的字符串表示
    ///
    /// ## 用途
    /// - 日志记录
    /// - 前端展示
    /// - 统计分析
    pub fn as_str(&self) -> &'static str {
        match self {
            WorkType::Literature { .. } => "Literature",
            WorkType::AcademicPaper { .. } => "AcademicPaper",
            WorkType::Diary => "Diary",
            WorkType::Letter { .. } => "Letter",
            WorkType::VoiceDiary { .. } => "VoiceDiary",
            WorkType::Music { .. } => "Music",
            WorkType::Podcast { .. } => "Podcast",
            WorkType::VideoLog { .. } => "VideoLog",
            WorkType::Lecture { .. } => "Lecture",
            WorkType::LifeClip { .. } => "LifeClip",
            WorkType::Artwork { .. } => "Artwork",
            WorkType::Design { .. } => "Design",
            WorkType::SocialMedia { .. } => "SocialMedia",
            WorkType::Code { .. } => "Code",
            WorkType::SkillDemo { .. } => "SkillDemo",
        }
    }
}

impl<AccountId, BlockNumber> DeceasedWork<AccountId, BlockNumber> {
    /// 函数级详细中文注释：检查作品是否对AI训练有价值
    ///
    /// ## 标准
    /// - 授权了AI训练
    /// - 是文本类型或有转录文本
    ///
    /// ## 返回
    /// - true: 可用于AI训练
    /// - false: 不适合AI训练
    pub fn is_ai_training_valuable(&self) -> bool {
        self.ai_training_enabled
            && (self.work_type.is_text_based() || self.work_type.has_transcript())
    }

    /// 函数级详细中文注释：获取作品的AI训练权重
    ///
    /// ## 权重规则
    /// - 文本类型：100（最高价值）
    /// - 有转录的音频/视频：80
    /// - 其他类型：20（辅助价值）
    ///
    /// ## 返回
    /// - 权重值（0-100）
    pub fn ai_training_weight(&self) -> u8 {
        if !self.ai_training_enabled {
            return 0;
        }

        if self.work_type.is_text_based() {
            100
        } else if self.work_type.has_transcript() {
            80
        } else {
            20
        }
    }
}
