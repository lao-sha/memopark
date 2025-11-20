//! # 作品投诉相关类型定义
//!
//! 定义作品域（Domain 7）的所有数据结构和枚举
//!
//! ## 版本历史
//! - v0.1.0 (2025-01-15): 初始版本，支持作品投诉基础类型

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;

/// 作品投诉操作类型常量
pub mod works_actions {
    /// 操作1：隐藏作品（设置为Private）
    ///
    /// ## 效果
    /// - 将作品隐私级别设置为Private
    /// - 保留作品数据（可申诉恢复）
    /// - 记录操作历史
    pub const HIDE_WORK: u8 = 1;

    /// 操作2：删除作品（彻底移除）
    ///
    /// ## 效果
    /// - 从存储中移除作品记录
    /// - 备份数据（用于申诉恢复，保留30天）
    /// - 通知IPFS服务取消pin
    pub const DELETE_WORK: u8 = 2;

    /// 操作3：撤销AI训练授权
    ///
    /// ## 效果
    /// - 禁止作品用于AI训练
    /// - 通知AI训练服务移除该作品数据
    /// - 不影响作品的公开展示
    pub const REVOKE_AI_TRAINING: u8 = 3;

    /// 操作4：取消作品验证
    ///
    /// ## 效果
    /// - 将verified标志设为false
    /// - 清除verifier信息
    /// - 降低作品信任度
    pub const UNVERIFY_WORK: u8 = 4;

    /// 操作5：修改作品隐私级别
    ///
    /// ## 效果
    /// - 根据投诉建议调整隐私级别
    /// - 可从Public降至Family/Private等
    pub const CHANGE_PRIVACY: u8 = 5;

    /// 操作6：添加违规标记
    ///
    /// ## 效果
    /// - 标记作品存在违规行为
    /// - 记录违规类型
    /// - 影响作品展示优先级
    pub const MARK_AS_VIOLATION: u8 = 6;

    /// 操作7：转移作品所有权（争议解决）
    ///
    /// ## 效果
    /// - 将作品所有权转移给新所有者
    /// - 用于解决版权纠纷
    /// - 需要提供充分证据
    pub const TRANSFER_OWNERSHIP: u8 = 7;

    /// 操作8：冻结作品（暂停所有操作）
    ///
    /// ## 效果
    /// - 暂停作品的所有读写操作
    /// - 用于调查期间的临时措施
    /// - 可通过申诉解冻
    pub const FREEZE_WORK: u8 = 8;
}

/// 函数级中文注释：获取作品操作的人类可读名称
///
/// ## 用途
/// - 日志记录
/// - 前端展示
/// - 事件描述
///
/// ## 参数
/// - `action`: 操作类型代码（1-8）
///
/// ## 返回
/// - `&'static str`: 操作名称字符串
pub fn get_works_action_name(action: u8) -> &'static str {
    match action {
        works_actions::HIDE_WORK => "HideWork",
        works_actions::DELETE_WORK => "DeleteWork",
        works_actions::REVOKE_AI_TRAINING => "RevokeAITraining",
        works_actions::UNVERIFY_WORK => "UnverifyWork",
        works_actions::CHANGE_PRIVACY => "ChangePrivacy",
        works_actions::MARK_AS_VIOLATION => "MarkAsViolation",
        works_actions::TRANSFER_OWNERSHIP => "TransferOwnership",
        works_actions::FREEZE_WORK => "FreezeWork",
        _ => "Unknown",
    }
}

/// 函数级详细中文注释：作品类型分类（简化版）
///
/// ## 用途
/// - 押金计算时使用（不同类型押金不同）
/// - 影响力评估时使用
/// - 统计分析时使用
///
/// ## 设计理念
/// - 从15种详细作品类型简化为8大类
/// - 便于押金标准的统一管理
/// - 对应deceased模块中的WorkType
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum WorkTypeCategory {
    /// 文学作品（小说、散文、诗歌、戏剧、书信）
    Literature,
    /// 学术论文
    Academic,
    /// 音频作品（音乐、语音日记、播客）
    Audio,
    /// 视频作品（视频日记、讲座、生活片段）
    Video,
    /// 图像作品（艺术作品、设计）
    Visual,
    /// 代码作品
    Code,
    /// 社交媒体内容
    SocialMedia,
    /// 其他（日记等）
    Other,
}

impl Default for WorkTypeCategory {
    fn default() -> Self {
        WorkTypeCategory::Other
    }
}

/// 函数级详细中文注释：违规类型枚举
///
/// ## 用途
/// - 标识作品投诉的具体违规类别
/// - 投诉分类统计
/// - 处理流程差异化
/// - 法律依据明确化
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum ViolationType {
    /// 版权侵犯（未经授权使用他人作品）
    CopyrightViolation,
    /// 抄袭剽窃（学术不端）
    Plagiarism,
    /// 虚假信息（不实内容、造假）
    Misinformation,
    /// 不当内容（低俗、暴力、恐怖等）
    InappropriateContent,
    /// 诽谤诬陷（恶意中伤）
    Defamation,
    /// 侵犯隐私（未经授权公开他人隐私）
    PrivacyViolation,
    /// 商业欺诈（虚假宣传、欺诈）
    CommercialFraud,
    /// 其他违规
    Other,
}

impl Default for ViolationType {
    fn default() -> Self {
        ViolationType::Other
    }
}

impl ViolationType {
    /// 函数级中文注释：将ViolationType转换为u8代码
    ///
    /// ## 用途
    /// - 事件发射时使用
    /// - 与from_u8对应
    ///
    /// ## 映射
    /// - CopyrightViolation => 0
    /// - Plagiarism => 1
    /// - Misinformation => 2
    /// - InappropriateContent => 3
    /// - Defamation => 4
    /// - PrivacyViolation => 5
    /// - CommercialFraud => 6
    /// - Other => 7
    pub fn to_u8(&self) -> u8 {
        match self {
            ViolationType::CopyrightViolation => 0,
            ViolationType::Plagiarism => 1,
            ViolationType::Misinformation => 2,
            ViolationType::InappropriateContent => 3,
            ViolationType::Defamation => 4,
            ViolationType::PrivacyViolation => 5,
            ViolationType::CommercialFraud => 6,
            ViolationType::Other => 7,
        }
    }

    /// 函数级中文注释：从u8代码转换为ViolationType
    ///
    /// ## 用途
    /// - 前端传参时使用
    /// - 与to_u8对应
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => ViolationType::CopyrightViolation,
            1 => ViolationType::Plagiarism,
            2 => ViolationType::Misinformation,
            3 => ViolationType::InappropriateContent,
            4 => ViolationType::Defamation,
            5 => ViolationType::PrivacyViolation,
            6 => ViolationType::CommercialFraud,
            _ => ViolationType::Other,
        }
    }
}

/// 函数级详细中文注释：作品投诉扩展信息
///
/// ## 存储内容
/// 存储作品投诉的详细上下文信息，包括：
/// - 作品基本信息（ID、类型、所属逝者）
/// - 当前状态（隐私级别、验证状态）
/// - 评估指标（影响力评分）
/// - 违规信息（违规类型）
///
/// ## 用途
/// - 押金计算依据
/// - 处理决策参考
/// - 统计分析数据源
/// - 历史记录追溯
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(T))]
pub struct WorkComplaintExtension {
    /// 作品ID
    pub work_id: u64,

    /// 所属逝者ID（用于关联查询和联动处理）
    pub deceased_id: u64,

    /// 作品类型分类
    pub work_type: WorkTypeCategory,

    /// 当前隐私级别（0=Public, 1=Family, 2=Descendants, 3=Private）
    pub current_privacy_level: u8,

    /// 是否已授权AI训练
    pub ai_training_enabled: bool,

    /// 是否已验证
    pub is_verified: bool,

    /// 作品影响力评分（0-100）
    ///
    /// ## 计算因素
    /// - 作品类型基础分
    /// - 访问量加分
    /// - 公开程度加分
    /// - 验证状态加分
    /// - AI训练授权加分
    pub influence_score: u8,

    /// 违规类型
    pub violation_type: ViolationType,

    /// 建议的新隐私级别（仅当action=CHANGE_PRIVACY时有效）
    pub suggested_privacy_level: Option<u8>,

    /// 建议的新所有者（仅当action=TRANSFER_OWNERSHIP时有效）
    ///
    /// 注意：Phase 1暂不支持所有权转移，此字段保留用于Phase 2
    pub suggested_new_owner: Option<u64>, // 临时使用u64，后续改为AccountId
}

/// 函数级中文注释：作品投诉提交参数（简化版）
///
/// ## 用途
/// - 用于前端提交投诉时的参数传递
/// - 减少接口复杂度
/// - 系统自动填充其他字段
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, RuntimeDebug)]
pub struct WorkComplaintParams<CidVec> {
    /// 作品ID
    pub work_id: u64,

    /// 投诉操作类型（1-8）
    pub action: u8,

    /// 违规类型
    pub violation_type: ViolationType,

    /// 投诉理由CID（IPFS内容地址）
    pub reason_cid: CidVec,

    /// 证据材料CID列表（最多10个）
    pub evidence_cids: alloc::vec::Vec<CidVec>,

    /// 建议的隐私级别（可选，仅action=5时使用）
    pub suggested_privacy_level: Option<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_work_type_category_default() {
        let default_category = WorkTypeCategory::default();
        assert_eq!(default_category, WorkTypeCategory::Other);
    }

    #[test]
    fn test_violation_type_default() {
        let default_violation = ViolationType::default();
        assert_eq!(default_violation, ViolationType::Other);
    }

    #[test]
    fn test_violation_type_encoding() {
        let violation = ViolationType::CopyrightViolation;
        let encoded = violation.encode();
        let decoded = ViolationType::decode(&mut &encoded[..]).unwrap();
        assert_eq!(violation, decoded);
    }

    #[test]
    fn test_works_action_names() {
        assert_eq!(get_works_action_name(works_actions::HIDE_WORK), "HideWork");
        assert_eq!(get_works_action_name(works_actions::DELETE_WORK), "DeleteWork");
        assert_eq!(get_works_action_name(works_actions::REVOKE_AI_TRAINING), "RevokeAITraining");
        assert_eq!(get_works_action_name(99), "Unknown");
    }

    #[test]
    fn test_work_type_category_encoding() {
        let category = WorkTypeCategory::Academic;
        let encoded = category.encode();
        let decoded = WorkTypeCategory::decode(&mut &encoded[..]).unwrap();
        assert_eq!(category, decoded);
    }
}
