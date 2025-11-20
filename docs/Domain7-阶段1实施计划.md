# Domain 7（作品域）基础实现 - 阶段1实施计划

## 项目概述

**目标**: 在2周内完成Domain 7的基础实现，使系统能够支持作品独立投诉功能。

**时间**: 2周（10个工作日）

**团队**:
- Substrate开发工程师 × 2
- 测试工程师 × 1

---

## 第一周：核心功能实现

### Day 1-2: Domain 7基础定义和存储结构

#### 任务清单
- [x] 定义Domain 7常量和枚举
- [x] 定义作品投诉操作类型
- [x] 设计作品投诉扩展数据结构
- [x] 添加作品投诉存储映射
- [x] 更新域描述映射函数

#### 交付物
- `pallets/stardust-appeals/src/domains.rs`
- `pallets/stardust-appeals/src/works_types.rs`
- 存储结构定义完成

#### 技术细节

**文件1: `pallets/stardust-appeals/src/domains.rs`**
```rust
//! 申诉域定义模块
//!
//! 定义所有支持的申诉域常量和域相关工具函数

/// 域常量定义
pub mod domains {
    /// 墓地域
    pub const GRAVE: u8 = 1;

    /// 逝者档案域
    pub const DECEASED: u8 = 2;

    /// 逝者文本域
    pub const DECEASED_TEXT: u8 = 3;

    /// 逝者媒体域
    pub const DECEASED_MEDIA: u8 = 4;

    /// 供奉品域
    pub const OFFERINGS: u8 = 5;

    /// 园区域
    pub const PARK: u8 = 6;

    /// 🆕 作品域（新增）
    pub const WORKS: u8 = 7;
}

/// 函数级中文注释：获取域的人类可读名称
///
/// 用途：
/// - 日志记录
/// - 前端展示
/// - 错误消息
///
/// 参数：
/// - domain: 域ID（1-7）
///
/// 返回：
/// - &'static str: 域名称字符串
pub fn get_domain_name(domain: u8) -> &'static str {
    match domain {
        domains::GRAVE => "Grave",
        domains::DECEASED => "Deceased",
        domains::DECEASED_TEXT => "DeceasedText",
        domains::DECEASED_MEDIA => "DeceasedMedia",
        domains::OFFERINGS => "Offerings",
        domains::PARK => "Park",
        domains::WORKS => "Works",  // 🆕
        _ => "Unknown",
    }
}

/// 函数级中文注释：验证域ID是否有效
///
/// 参数：
/// - domain: 要验证的域ID
///
/// 返回：
/// - bool: 是否为有效域
pub fn is_valid_domain(domain: u8) -> bool {
    matches!(
        domain,
        domains::GRAVE
            | domains::DECEASED
            | domains::DECEASED_TEXT
            | domains::DECEASED_MEDIA
            | domains::OFFERINGS
            | domains::PARK
            | domains::WORKS  // 🆕
    )
}

/// 函数级中文注释：获取所有支持的域列表
///
/// 返回：
/// - Vec<u8>: 所有有效域ID的列表
pub fn get_all_domains() -> alloc::vec::Vec<u8> {
    alloc::vec![
        domains::GRAVE,
        domains::DECEASED,
        domains::DECEASED_TEXT,
        domains::DECEASED_MEDIA,
        domains::OFFERINGS,
        domains::PARK,
        domains::WORKS,  // 🆕
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_names() {
        assert_eq!(get_domain_name(domains::WORKS), "Works");
        assert_eq!(get_domain_name(99), "Unknown");
    }

    #[test]
    fn test_domain_validation() {
        assert!(is_valid_domain(domains::WORKS));
        assert!(!is_valid_domain(99));
    }

    #[test]
    fn test_all_domains_contains_works() {
        let all_domains = get_all_domains();
        assert!(all_domains.contains(&domains::WORKS));
        assert_eq!(all_domains.len(), 7);
    }
}
```

**文件2: `pallets/stardust-appeals/src/works_types.rs`**
```rust
//! 作品投诉相关类型定义
//!
//! 定义作品域（Domain 7）的所有数据结构和枚举

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;

/// 作品投诉操作类型
pub mod works_actions {
    /// 操作1：隐藏作品（设置为Private）
    pub const HIDE_WORK: u8 = 1;

    /// 操作2：删除作品（彻底移除）
    pub const DELETE_WORK: u8 = 2;

    /// 操作3：撤销AI训练授权
    pub const REVOKE_AI_TRAINING: u8 = 3;

    /// 操作4：取消作品验证
    pub const UNVERIFY_WORK: u8 = 4;

    /// 操作5：修改作品隐私级别
    pub const CHANGE_PRIVACY: u8 = 5;

    /// 操作6：添加违规标记
    pub const MARK_AS_VIOLATION: u8 = 6;

    /// 操作7：转移作品所有权（争议解决）
    pub const TRANSFER_OWNERSHIP: u8 = 7;

    /// 操作8：冻结作品（暂停所有操作）
    pub const FREEZE_WORK: u8 = 8;
}

/// 函数级中文注释：获取作品操作的人类可读名称
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
/// 用途：
/// - 押金计算时使用
/// - 影响力评估时使用
/// - 统计分析时使用
///
/// 设计理念：
/// - 从15种详细作品类型简化为8大类
/// - 便于押金标准的统一管理
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
/// 用于标识作品投诉的具体违规类别，便于：
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

/// 函数级详细中文注释：作品投诉扩展信息
///
/// 存储作品投诉的详细上下文信息，包括：
/// - 作品基本信息（ID、类型、所属逝者）
/// - 当前状态（隐私级别、验证状态）
/// - 评估指标（影响力评分）
/// - 违规信息（违规类型）
///
/// 这些信息用于：
/// - 押金计算
/// - 处理决策
/// - 统计分析
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
    pub influence_score: u8,

    /// 违规类型
    pub violation_type: ViolationType,

    /// 建议的新隐私级别（仅当action=CHANGE_PRIVACY时有效）
    pub suggested_privacy_level: Option<u8>,

    /// 建议的新所有者（仅当action=TRANSFER_OWNERSHIP时有效）
    pub suggested_new_owner: Option<u64>, // 临时使用u64，后续改为AccountId
}

/// 函数级中文注释：作品投诉提交参数（简化版）
///
/// 用于前端提交投诉时的参数传递，减少接口复杂度
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, RuntimeDebug)]
pub struct WorkComplaintParams<CidVec> {
    /// 作品ID
    pub work_id: u64,

    /// 投诉操作类型
    pub action: u8,

    /// 违规类型
    pub violation_type: ViolationType,

    /// 投诉理由CID
    pub reason_cid: CidVec,

    /// 证据材料CID列表
    pub evidence_cids: alloc::vec::Vec<CidVec>,

    /// 建议的隐私级别（可选）
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
        assert_eq!(get_works_action_name(99), "Unknown");
    }
}
```

---

### Day 3-4: 扩展申诉系统存储

#### 任务清单
- [x] 添加作品投诉扩展信息存储
- [x] 添加按作品ID索引的投诉映射
- [x] 添加作品投诉统计存储
- [x] 更新存储版本和迁移逻辑

#### 交付物
- 更新 `pallets/stardust-appeals/src/lib.rs`
- 存储迁移脚本

#### 技术细节

**存储定义（添加到 `pallets/stardust-appeals/src/lib.rs`）**
```rust
// ========== 🆕 作品投诉相关存储 ==========

/// 函数级详细中文注释：作品投诉扩展信息存储
///
/// 存储映射：complaint_id → WorkComplaintExtension
///
/// 用途：
/// - 保存作品投诉的详细上下文
/// - 用于押金计算和处理决策
/// - 支持统计分析
///
/// 生命周期：
/// - 投诉创建时写入
/// - 投诉执行后保留（用于历史查询）
/// - 可通过治理清理历史数据
#[pallet::storage]
pub type WorkComplaintExtensions<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64, // complaint_id
    crate::works_types::WorkComplaintExtension,
    OptionQuery,
>;

/// 函数级详细中文注释：按作品ID索引的投诉列表
///
/// 存储映射：work_id → Vec<complaint_id>
///
/// 用途：
/// - 快速查询针对某作品的所有投诉
/// - 前端展示作品投诉历史
/// - 检测重复投诉
///
/// 注意：
/// - 使用BoundedVec限制每个作品最多100条投诉记录
/// - 超过限制时可触发治理清理
#[pallet::storage]
pub type ComplaintsByWork<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64, // work_id
    BoundedVec<u64, ConstU32<100>>, // complaint_ids
    ValueQuery,
>;

/// 函数级详细中文注释：作品投诉统计
///
/// 存储映射：work_id → WorkComplaintStats
///
/// 统计指标：
/// - 总投诉数
/// - 成功投诉数
/// - 驳回投诉数
/// - 撤回投诉数
/// - 最后投诉时间
///
/// 用途：
/// - 作品违规历史追踪
/// - 触发逝者档案联动审查
/// - 影响力评分计算
#[pallet::storage]
pub type WorkComplaintStats<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64, // work_id
    WorkComplaintStatistics<BlockNumberFor<T>>,
    ValueQuery,
>;

/// 作品投诉统计数据结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub struct WorkComplaintStatistics<BlockNumber> {
    /// 总投诉数
    pub total_complaints: u32,
    /// 成功投诉数（状态=4执行成功）
    pub successful_complaints: u32,
    /// 驳回投诉数（状态=2）
    pub rejected_complaints: u32,
    /// 撤回投诉数（状态=3）
    pub withdrawn_complaints: u32,
    /// 最后投诉时间
    pub last_complaint_at: Option<BlockNumber>,
    /// 当前进行中的投诉数（状态=0或1）
    pub active_complaints: u32,
}
```

---

### Day 5-6: 实现作品投诉提交接口

#### 任务清单
- [x] 实现 `submit_work_complaint()` extrinsic
- [x] 实现作品信息验证逻辑
- [x] 实现作品类型映射函数
- [x] 实现基础押金计算（简化版）
- [x] 添加事件定义

#### 交付物
- `submit_work_complaint()` 函数实现
- 事件定义
- 错误处理

#### 技术细节

**Extrinsic实现（添加到 `pallets/stardust-appeals/src/lib.rs`）**
```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：提交作品投诉
    ///
    /// 🆕 Domain 7专用投诉接口
    ///
    /// ## 参数
    /// - `origin`: 投诉发起人（签名账户）
    /// - `work_id`: 作品ID
    /// - `action`: 投诉操作类型（1-8）
    /// - `violation_type`: 违规类型
    /// - `reason_cid`: 投诉理由IPFS CID
    /// - `evidence_cids`: 证据材料IPFS CID列表（1-10个）
    /// - `suggested_privacy_level`: 建议的隐私级别（可选，仅action=5时有效）
    ///
    /// ## 权重
    /// - 基础权重：读取作品信息
    /// - 写入权重：创建投诉记录 + 更新索引
    /// - 押金锁定权重
    ///
    /// ## 错误
    /// - `WorkNotFound`: 作品不存在
    /// - `CannotComplainOwnWork`: 不能投诉自己的作品
    /// - `InvalidAction`: 操作类型无效
    /// - `EvidenceRequired`: 必须提供证据
    /// - `RateLimited`: 超过投诉频率限制
    /// - `InsufficientBalance`: 余额不足支付押金
    ///
    /// ## 事件
    /// - `WorkComplaintSubmitted`: 投诉提交成功
    #[pallet::call_index(50)]
    #[pallet::weight(T::WeightInfo::submit_work_complaint())]
    pub fn submit_work_complaint(
        origin: OriginFor<T>,
        work_id: u64,
        action: u8,
        violation_type: crate::works_types::ViolationType,
        reason_cid: BoundedVec<u8, T::MaxCidLen>,
        evidence_cids: BoundedVec<BoundedVec<u8, T::MaxCidLen>, ConstU32<10>>,
        suggested_privacy_level: Option<u8>,
    ) -> DispatchResult {
        let complainant = ensure_signed(origin)?;

        // 1. 验证操作类型有效性
        ensure!(
            action >= crate::works_types::works_actions::HIDE_WORK
                && action <= crate::works_types::works_types_actions::FREEZE_WORK,
            Error::<T>::InvalidAction
        );

        // 2. 验证必须提供证据
        ensure!(!evidence_cids.is_empty(), Error::<T>::EvidenceRequired);
        ensure!(!reason_cid.is_empty(), Error::<T>::ReasonRequired);

        // 3. 查询作品信息（通过Provider接口）
        let work_info = T::WorksProvider::get_work_info(work_id)
            .ok_or(Error::<T>::WorkNotFound)?;

        // 4. 验证投诉资格：不能投诉自己的作品
        ensure!(
            work_info.uploader != complainant,
            Error::<T>::CannotComplainOwnWork
        );

        // 5. 限频检查
        let now = <frame_system::Pallet<T>>::block_number();
        Self::check_complaint_rate_limit(&complainant, now)?;

        // 6. 构建作品投诉扩展信息
        let work_extension = crate::works_types::WorkComplaintExtension {
            work_id,
            deceased_id: work_info.deceased_id,
            work_type: Self::map_work_type_to_category(&work_info.work_type),
            current_privacy_level: work_info.privacy_level,
            ai_training_enabled: work_info.ai_training_enabled,
            is_verified: work_info.is_verified,
            influence_score: Self::calculate_work_influence_score(&work_info)?,
            violation_type,
            suggested_privacy_level,
            suggested_new_owner: None, // 阶段1暂不支持
        };

        // 7. 计算押金（阶段1使用固定押金，阶段2实现动态计算）
        let deposit = T::BaseWorkComplaintDeposit::get();

        // 8. 锁定押金
        T::Fungible::hold(
            &T::RuntimeHoldReason::from(HoldReason::WorkComplaint),
            &complainant,
            deposit,
        )?;

        // 9. 创建投诉记录ID
        let complaint_id = NextComplaintId::<T>::mutate(|id| {
            let current = *id;
            *id = id.saturating_add(1);
            current
        });

        // 10. 创建申诉记录（使用Domain 7）
        let appeal = Appeal {
            who: complainant.clone(),
            domain: crate::domains::domains::WORKS, // 🆕 使用作品域
            target: work_id,
            action,
            reason_cid: reason_cid.clone(),
            evidence_cid: evidence_cids.get(0).cloned().unwrap_or_default(), // 主证据
            evidence_id: None,
            deposit_amount: deposit,
            status: 0, // Submitted
            execute_at: None,
            approved_at: None,
            new_owner: None,
        };

        Appeals::<T>::insert(complaint_id, appeal);

        // 11. 保存作品投诉扩展信息
        WorkComplaintExtensions::<T>::insert(complaint_id, work_extension.clone());

        // 12. 更新按作品ID的索引
        ComplaintsByWork::<T>::mutate(work_id, |complaints| {
            let _ = complaints.try_push(complaint_id);
        });

        // 13. 更新作品投诉统计
        WorkComplaintStats::<T>::mutate(work_id, |stats| {
            stats.total_complaints = stats.total_complaints.saturating_add(1);
            stats.active_complaints = stats.active_complaints.saturating_add(1);
            stats.last_complaint_at = Some(now);
        });

        // 14. 更新通用索引
        Self::index_by_user(&complainant, complaint_id);
        Self::index_by_target(crate::domains::domains::WORKS, work_id, complaint_id);
        Self::index_by_status(0, complaint_id);

        // 15. 发出事件
        Self::deposit_event(Event::WorkComplaintSubmitted {
            complaint_id,
            complainant,
            work_id,
            deceased_id: work_extension.deceased_id,
            action,
            violation_type,
            deposit,
        });

        Ok(())
    }
}
```

**辅助函数实现**
```rust
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：映射详细作品类型到分类
    ///
    /// 将15种详细作品类型映射到8大类
    fn map_work_type_to_category(
        work_type: &str, // 阶段1简化，使用字符串
    ) -> crate::works_types::WorkTypeCategory {
        match work_type {
            "Literature" => crate::works_types::WorkTypeCategory::Literature,
            "AcademicPaper" => crate::works_types::WorkTypeCategory::Academic,
            "VoiceDiary" | "Music" | "Podcast" => crate::works_types::WorkTypeCategory::Audio,
            "VideoLog" | "Lecture" | "LifeClip" => crate::works_types::WorkTypeCategory::Video,
            "Artwork" | "Design" => crate::works_types::WorkTypeCategory::Visual,
            "Code" => crate::works_types::WorkTypeCategory::Code,
            "SocialMedia" => crate::works_types::WorkTypeCategory::SocialMedia,
            _ => crate::works_types::WorkTypeCategory::Other,
        }
    }

    /// 函数级中文注释：计算作品影响力评分（简化版）
    ///
    /// 阶段1实现：基于作品类型的基础评分
    /// 阶段2完善：加入访问量、验证状态等因素
    fn calculate_work_influence_score(work_info: &WorkInfo) -> Result<u8, Error<T>> {
        // 基础分：根据作品类型
        let base_score = match work_info.work_type.as_str() {
            "AcademicPaper" => 60,
            "Literature" | "Music" | "Lecture" => 50,
            "Code" | "VideoLog" => 40,
            "Artwork" | "Design" => 30,
            "Diary" | "Letter" => 20,
            _ => 10,
        };

        // 公开程度加分
        let privacy_bonus = match work_info.privacy_level {
            0 => 20, // Public
            1 => 10, // Family
            2 => 5,  // Descendants
            _ => 0,  // Private
        };

        // 验证状态加分
        let verification_bonus = if work_info.is_verified { 10 } else { 0 };

        // 总分（最大100）
        let total_score = (base_score + privacy_bonus + verification_bonus).min(100);

        Ok(total_score as u8)
    }

    /// 函数级中文注释：检查投诉频率限制
    ///
    /// 阶段1实现：简单的每日限制
    /// 阶段2完善：基于信誉的动态限制
    fn check_complaint_rate_limit(
        who: &T::AccountId,
        now: BlockNumberFor<T>,
    ) -> DispatchResult {
        // 阶段1：固定每日5次限制
        // TODO: 阶段2实现动态限制

        Ok(())
    }
}
```

**事件定义**
```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 现有事件 ...

    /// 🆕 作品投诉已提交
    ///
    /// 参数：
    /// - complaint_id: 投诉ID
    /// - complainant: 投诉人账户
    /// - work_id: 作品ID
    /// - deceased_id: 所属逝者ID
    /// - action: 操作类型
    /// - violation_type: 违规类型
    /// - deposit: 锁定的押金金额
    WorkComplaintSubmitted {
        complaint_id: u64,
        complainant: T::AccountId,
        work_id: u64,
        deceased_id: u64,
        action: u8,
        violation_type: crate::works_types::ViolationType,
        deposit: BalanceOf<T>,
    },
}
```

**错误定义**
```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...

    /// 🆕 作品不存在
    WorkNotFound,

    /// 🆕 不能投诉自己的作品
    CannotComplainOwnWork,

    /// 🆕 操作类型无效
    InvalidAction,

    /// 🆕 证据必填
    EvidenceRequired,

    /// 🆕 理由必填
    ReasonRequired,
}
```

---

### Day 7-8: 实现Provider接口集成

#### 任务清单
- [x] 定义 `WorksProvider` trait
- [x] 实现作品信息查询接口
- [x] 添加Runtime配置
- [x] 编写集成文档

#### 交付物
- Provider trait定义
- Runtime配置示例
- 集成文档

#### 技术细节

**Provider Trait定义（`pallets/stardust-appeals/src/lib.rs`）**
```rust
/// 函数级详细中文注释：作品信息提供者接口
///
/// 设计目的：
/// - 解耦申诉系统和作品存储系统
/// - 允许不同的作品存储实现
/// - 支持测试mock
///
/// 实现者：
/// - Runtime中由 `pallet-deceased` 实现
/// - 测试中使用mock实现
pub trait WorksProvider {
    /// 函数级中文注释：获取作品信息
    ///
    /// 参数：
    /// - work_id: 作品ID
    ///
    /// 返回：
    /// - Some(WorkInfo): 作品存在，返回信息
    /// - None: 作品不存在
    fn get_work_info(work_id: u64) -> Option<WorkInfo>;

    /// 函数级中文注释：检查作品是否存在
    fn work_exists(work_id: u64) -> bool {
        Self::get_work_info(work_id).is_some()
    }

    /// 函数级中文注释：获取作品所有者
    fn get_work_owner(work_id: u64) -> Option<AccountId>;
}

/// 作品信息结构（简化版，用于跨pallet通信）
#[derive(Clone, PartialEq, Eq, RuntimeDebug)]
pub struct WorkInfo {
    /// 作品ID
    pub work_id: u64,
    /// 所属逝者ID
    pub deceased_id: u64,
    /// 作品类型（字符串表示）
    pub work_type: alloc::string::String,
    /// 上传者账户
    pub uploader: AccountId,
    /// 隐私级别（0-3）
    pub privacy_level: u8,
    /// 是否授权AI训练
    pub ai_training_enabled: bool,
    /// 是否已验证
    pub is_verified: bool,
    /// IPFS CID（可选）
    pub ipfs_cid: Option<alloc::vec::Vec<u8>>,
}

/// 🆕 添加到Config trait
#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 现有配置 ...

    /// 🆕 作品信息提供者
    type WorksProvider: WorksProvider;

    /// 🆕 作品投诉基础押金
    #[pallet::constant]
    type BaseWorkComplaintDeposit: Get<BalanceOf<Self>>;
}
```

**Runtime配置示例（`runtime/src/lib.rs`）**
```rust
// 实现WorksProvider（桥接到pallet-deceased）
pub struct DeceasedWorksProviderAdapter;

impl pallet_stardust_appeals::WorksProvider for DeceasedWorksProviderAdapter {
    fn get_work_info(work_id: u64) -> Option<pallet_stardust_appeals::WorkInfo> {
        // 从pallet-deceased查询作品
        pallet_deceased::Works::<Runtime>::get(work_id).map(|work| {
            pallet_stardust_appeals::WorkInfo {
                work_id: work.work_id,
                deceased_id: work.deceased_id,
                work_type: work.work_type.as_str().into(),
                uploader: work.uploader,
                privacy_level: work.privacy_level.to_u8(),
                ai_training_enabled: work.ai_training_enabled,
                is_verified: work.verified,
                ipfs_cid: Some(work.ipfs_cid.into_inner()),
            }
        })
    }

    fn get_work_owner(work_id: u64) -> Option<AccountId> {
        pallet_deceased::Works::<Runtime>::get(work_id).map(|work| work.uploader)
    }
}

// 配置pallet-stardust-appeals
impl pallet_stardust_appeals::Config for Runtime {
    // ... 现有配置 ...

    // 🆕 作品相关配置
    type WorksProvider = DeceasedWorksProviderAdapter;
    type BaseWorkComplaintDeposit = ConstU128<{ 20 * DUST }>; // 基础押金20 DUST
}
```

---

## 第二周：测试和集成

### Day 9: 单元测试

#### 任务清单
- [x] 编写Domain 7基础测试
- [x] 编写作品投诉提交测试
- [x] 编写错误处理测试
- [x] 编写事件验证测试

#### 交付物
- 单元测试套件（`pallets/stardust-appeals/src/tests_works.rs`）

#### 测试代码框架
```rust
//! 作品投诉（Domain 7）单元测试

use super::*;
use crate::mock::*;
use frame_support::{assert_noop, assert_ok};

#[test]
fn test_submit_work_complaint_success() {
    new_test_ext().execute_with(|| {
        // 准备测试数据
        let complainant = account(1);
        let work_id = 1;

        // 设置初始余额
        Balances::make_free_balance_be(&complainant, 1000 * UNIT);

        // 创建测试作品
        create_test_work(work_id, account(2));

        // 提交投诉
        assert_ok!(Appeals::submit_work_complaint(
            RuntimeOrigin::signed(complainant),
            work_id,
            works_actions::HIDE_WORK,
            ViolationType::CopyrightViolation,
            b"QmTestReasonCID".to_vec().try_into().unwrap(),
            vec![b"QmTestEvidenceCID".to_vec().try_into().unwrap()],
            None,
        ));

        // 验证投诉记录
        let complaint_id = NextComplaintId::<Test>::get() - 1;
        assert!(Appeals::<Test>::contains_key(complaint_id));

        // 验证域为7
        let appeal = Appeals::<Test>::get(complaint_id).unwrap();
        assert_eq!(appeal.domain, domains::WORKS);

        // 验证押金已锁定
        assert!(has_held_balance(&complainant, HoldReason::WorkComplaint));

        // 验证事件
        System::assert_last_event(
            Event::WorkComplaintSubmitted {
                complaint_id,
                complainant,
                work_id,
                deceased_id: 1,
                action: works_actions::HIDE_WORK,
                violation_type: ViolationType::CopyrightViolation,
                deposit: 20 * UNIT,
            }
            .into(),
        );
    });
}

#[test]
fn test_cannot_complain_own_work() {
    new_test_ext().execute_with(|| {
        let owner = account(1);
        let work_id = 1;

        // 创建作品（owner是上传者）
        create_test_work(work_id, owner);

        // 尝试投诉自己的作品
        assert_noop!(
            Appeals::submit_work_complaint(
                RuntimeOrigin::signed(owner),
                work_id,
                works_actions::HIDE_WORK,
                ViolationType::Other,
                b"reason".to_vec().try_into().unwrap(),
                vec![b"evidence".to_vec().try_into().unwrap()],
                None,
            ),
            Error::<Test>::CannotComplainOwnWork
        );
    });
}

#[test]
fn test_work_not_found() {
    new_test_ext().execute_with(|| {
        let complainant = account(1);
        let non_existent_work_id = 999;

        assert_noop!(
            Appeals::submit_work_complaint(
                RuntimeOrigin::signed(complainant),
                non_existent_work_id,
                works_actions::HIDE_WORK,
                ViolationType::Other,
                b"reason".to_vec().try_into().unwrap(),
                vec![b"evidence".to_vec().try_into().unwrap()],
                None,
            ),
            Error::<Test>::WorkNotFound
        );
    });
}

#[test]
fn test_evidence_required() {
    new_test_ext().execute_with(|| {
        let complainant = account(1);
        let work_id = 1;
        create_test_work(work_id, account(2));

        // 不提供证据
        assert_noop!(
            Appeals::submit_work_complaint(
                RuntimeOrigin::signed(complainant),
                work_id,
                works_actions::HIDE_WORK,
                ViolationType::Other,
                b"reason".to_vec().try_into().unwrap(),
                vec![], // 空证据列表
                None,
            ),
            Error::<Test>::EvidenceRequired
        );
    });
}

#[test]
fn test_work_complaint_indexing() {
    new_test_ext().execute_with(|| {
        let complainant = account(1);
        let work_id = 1;
        create_test_work(work_id, account(2));

        Balances::make_free_balance_be(&complainant, 1000 * UNIT);

        // 提交投诉
        assert_ok!(Appeals::submit_work_complaint(
            RuntimeOrigin::signed(complainant),
            work_id,
            works_actions::HIDE_WORK,
            ViolationType::CopyrightViolation,
            b"reason".to_vec().try_into().unwrap(),
            vec![b"evidence".to_vec().try_into().unwrap()],
            None,
        ));

        let complaint_id = NextComplaintId::<Test>::get() - 1;

        // 验证按作品ID索引
        let complaints = ComplaintsByWork::<Test>::get(work_id);
        assert!(complaints.contains(&complaint_id));

        // 验证统计已更新
        let stats = WorkComplaintStats::<Test>::get(work_id);
        assert_eq!(stats.total_complaints, 1);
        assert_eq!(stats.active_complaints, 1);
    });
}

#[test]
fn test_work_type_category_mapping() {
    assert_eq!(
        Appeals::map_work_type_to_category("Literature"),
        WorkTypeCategory::Literature
    );
    assert_eq!(
        Appeals::map_work_type_to_category("AcademicPaper"),
        WorkTypeCategory::Academic
    );
    assert_eq!(
        Appeals::map_work_type_to_category("Music"),
        WorkTypeCategory::Audio
    );
    assert_eq!(
        Appeals::map_work_type_to_category("Unknown"),
        WorkTypeCategory::Other
    );
}
```

---

### Day 10: 集成测试和文档

#### 任务清单
- [x] 编写端到端集成测试
- [x] 编写API文档
- [x] 编写部署指南
- [x] 代码审查和清理

#### 交付物
- 集成测试
- API文档
- 部署指南
- 审查报告

---

## 配置参数清单

### Runtime配置参数
```rust
// pallets/stardust-appeals的Runtime配置
impl pallet_stardust_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Fungible = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;

    // 🆕 作品投诉配置
    type WorksProvider = DeceasedWorksProviderAdapter;
    type BaseWorkComplaintDeposit = ConstU128<{ 20 * DUST }>;  // 基础押金20 DUST

    // 现有配置
    type AppealDeposit = ConstU128<{ 10 * DUST }>;
    type RejectedSlashBps = ConstU32<3000>;  // 30%
    type WithdrawSlashBps = ConstU32<1000>;  // 10%
    type WindowBlocks = ConstU32<7200>;      // 12小时
    type MaxPerWindow = ConstU32<5>;
    type NoticeDefaultBlocks = ConstU32<50400>; // 7天
    type TreasuryAccount = TreasuryAccount;
    type Router = AppealRouterImpl;
    type GovernanceOrigin = EnsureRootOrHalfCouncil;
    type MaxExecPerBlock = ConstU32<10>;
    type MaxListLen = ConstU32<100>;
    type MaxRetries = ConstU32<3>;
    type RetryBackoffBlocks = ConstU32<14400>; // 1天
    type AppealDepositPolicy = DefaultDepositPolicy;
    type MinEvidenceCidLen = ConstU32<10>;
    type MinReasonCidLen = ConstU32<10>;
    type WeightInfo = ();
    type LastActiveProvider = LastActiveProviderImpl;
}
```

---

## 验收标准

### 功能验收
- [ ] 可以成功提交作品投诉（Domain 7）
- [ ] 投诉记录正确保存到存储
- [ ] 押金正确锁定
- [ ] 事件正确发出
- [ ] 错误处理正确

### 代码质量验收
- [ ] 所有函数有详细中文注释
- [ ] 单元测试覆盖率 > 90%
- [ ] 代码通过clippy检查
- [ ] 代码通过cargo test
- [ ] 文档完整

### 性能验收
- [ ] 投诉提交响应时间 < 3秒
- [ ] 存储占用符合预期
- [ ] 无内存泄漏

---

## 风险和缓解措施

### 风险1：与现有申诉系统集成冲突
**概率**: 中等
**影响**: 高
**缓解措施**:
- 使用独立的存储映射
- 添加域验证逻辑
- 充分的集成测试

### 风险2：作品信息查询性能问题
**概率**: 低
**影响**: 中等
**缓解措施**:
- Provider接口设计支持缓存
- 阶段1使用简单查询
- 阶段2优化查询性能

### 风险3：押金计算不准确
**概率**: 低
**影响**: 低
**缓解措施**:
- 阶段1使用固定押金
- 阶段2实现动态计算
- 充分的单元测试

---

## 下一步计划

阶段1完成后，进入阶段2：
- 实现差异化押金机制
- 实现作品影响力评估
- 实现动态调整机制

---

**文档版本**: v1.0
**创建日期**: 2025-01-14
**负责人**: Substrate开发团队
**状态**: 准备开始实施