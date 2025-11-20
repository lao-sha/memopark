// 函数级详细中文注释：逝者拥有者操作投诉治理机制 - 永久质押押金模式
//
// ## 核心功能
// 1. **永久质押押金**：创建逝者时锁定押金，直到转让拥有权才释放
// 2. **USDT计价系统**：避免DUST价格波动，使用pallet-pricing进行汇率转换
// 3. **无操作押金**：拥有者日常增删改无需额外押金
// 4. **押金池扣款**：投诉成功从质押押金扣除，自动分配80%/20%
// 5. **自动权限控制**：押金不足时限制操作，补齐后恢复
//
// ## 设计理念
// - **用户体验优先**：一次质押，终身操作
// - **风险责任清晰**：质押押金作为所有操作的责任保证金
// - **治理自动化**：押金扣除和权限控制全自动
// - **经济合理性**：USDT计价避免波动，信誉调节降低门槛

use frame_support::{
    pallet_prelude::*,
    BoundedVec,
};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

use crate::*;
use crate::{Config, BalanceOf};  // 函数级中文注释：明确从crate根导入Config trait和BalanceOf类型别名

/// 函数级详细中文注释：内容规模枚举
///
/// ### 用途
/// - 用于计算创建押金的规模系数
/// - 预期内容量越大，押金倍数越高
///
/// ### 规模定义
/// - **Small**: <10条内容（照片、作品等），系数1.0x
/// - **Medium**: 10-50条内容，系数1.5x
/// - **Large**: >50条内容，系数2.0x
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ContentScale {
    /// 小规模：<10条内容，系数1.0x
    Small,
    /// 中规模：10-50条内容，系数1.5x
    Medium,
    /// 大规模：>50条内容，系数2.0x
    Large,
}

impl ContentScale {
    /// 函数级中文注释：获取规模系数（基于10000基点）
    ///
    /// ### 返回值
    /// - Small: 10000 (1.0x)
    /// - Medium: 15000 (1.5x)
    /// - Large: 20000 (2.0x)
    pub fn multiplier_bps(&self) -> u32 {
        match self {
            Self::Small => 10000,   // 1.0x
            Self::Medium => 15000,  // 1.5x
            Self::Large => 20000,   // 2.0x
        }
    }

    /// 函数级中文注释：转换为 u8（用于事件）
    ///
    /// ### 返回值
    /// - Small: 0
    /// - Medium: 1
    /// - Large: 2
    pub fn as_u8(&self) -> u8 {
        match self {
            Self::Small => 0,
            Self::Medium => 1,
            Self::Large => 2,
        }
    }
}

/// 函数级详细中文注释：押金状态枚举
///
/// ### 状态转换
/// - **Active** → Insufficient: 押金被扣除至不足
/// - **Insufficient** → Active: 补充押金至充足
/// - **Active/Insufficient** → Frozen: 转让前冻结
/// - **Frozen** → Released: 转让完成释放
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum DepositStatus {
    /// 活跃状态（押金充足）
    Active,
    /// 押金不足（需要补充）
    Insufficient,
    /// 已冻结（等待转让或其他处理）
    Frozen,
    /// 已释放
    Released,
}

/// 函数级详细中文注释：拥有者押金记录结构
///
/// ### 核心字段
/// - **total_deposited_usdt**: 总质押金额（USDT），创建时锁定
/// - **available_usdt**: 可用余额（USDT），扣除投诉罚款后的余额
/// - **deducted_usdt**: 已扣除金额（USDT），投诉罚款累计
/// - **status**: 押金状态，控制操作权限
///
/// ### USDT/DUST双记录
/// - 锁定时汇率不变，使用锁定时的汇率
/// - available余额根据USDT计算，避免汇率波动影响
///
/// ### 存储映射
/// - `OwnerDepositRecords<T>`: DeceasedId → OwnerDepositRecord
/// - `OwnerDepositsByOwner<T>`: (AccountId, DeceasedId) → ()
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OwnerDepositRecord<T: Config> {
    /// 拥有者账户
    pub owner: T::AccountId,
    /// 逝者ID
    pub deceased_id: u64,

    /// 初始押金（USDT）- 创建时锁定的金额
    pub initial_deposit_usdt: u32,
    /// 初始押金（DUST）- 创建时锁定的金额
    pub initial_deposit_dust: BalanceOf<T>,

    /// 当前锁定的DUST数量 - 包括初始押金+补充押金
    pub current_locked_dust: BalanceOf<T>,

    /// 可用押金（USDT）- 扣除投诉罚款后的余额
    pub available_usdt: u32,
    /// 可用押金（DUST）
    pub available_dust: BalanceOf<T>,

    /// 已扣除押金（USDT）- 投诉罚款累计
    pub deducted_usdt: u32,
    /// 已扣除押金（DUST）
    pub deducted_dust: BalanceOf<T>,

    /// 锁定时间
    pub locked_at: BlockNumberFor<T>,
    /// 锁定时汇率（USDT per DUST，scaled by 1e6）
    pub exchange_rate: u64,

    /// 预期内容规模
    pub expected_scale: ContentScale,

    /// 押金状态
    pub status: DepositStatus,
}

/// 函数级详细中文注释：操作类型枚举
///
/// ### 操作分类
/// - **Add**: 新增内容（文本、媒体、作品）
/// - **Modify**: 修改现有内容
/// - **Delete**: 删除内容
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum OperationType {
    /// 新增内容
    Add,
    /// 修改内容
    Modify,
    /// 删除内容
    Delete,
}

impl OperationType {
    /// 函数级详细中文注释：转换为 u8（用于事件）
    ///
    /// ### 返回值
    /// - Add: 0
    /// - Modify: 1
    /// - Delete: 2
    pub fn as_u8(&self) -> u8 {
        match self {
            Self::Add => 0,
            Self::Modify => 1,
            Self::Delete => 2,
        }
    }
}

/// 函数级详细中文注释：内容类型枚举
///
/// ### 内容分类
/// - **Text**: 文本档案（名字、生平等）
/// - **Media**: 媒体内容（照片、视频等）
/// - **Works**: 作品信息（文学、艺术作品等）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ContentType {
    /// 文本档案
    Text,
    /// 媒体内容
    Media,
    /// 作品信息
    Works,
}

/// 函数级详细中文注释：拥有者操作记录结构（方案E：服务费+自动退还）
///
/// ### 核心功能
/// - 记录所有拥有者和非拥有者的增删改操作
/// - 无限投诉期，任何时候都可以被投诉
/// - 投诉成功后操作撤销
/// - 30天后自动退还押金（简化流程）
///
/// ### 状态流转（方案E）
/// - **Active**: 活跃状态，可被投诉（0-30天）
/// - **Confirmed**: 已确认（30天后无投诉，押金已退还）
/// - **Revoked**: 投诉成功，操作撤销，罚没押金
///
/// ### 时间窗口
/// - 自动确认时间：executed_at + 30天
///
/// ### 存储映射
/// - `OwnerOperations<T>`: OperationId → OwnerOperation
/// - `OperationsByOwner<T>`: (AccountId, OperationId) → ()
/// - `OperationsByDeceased<T>`: (DeceasedId, OperationId) → ()
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OwnerOperation<T: Config> {
    /// 操作ID
    pub operation_id: u64,
    /// 拥有者账户
    pub owner: T::AccountId,
    /// 逝者ID
    pub deceased_id: u64,
    /// 操作类型
    pub operation: OperationType,
    /// 内容类型
    pub content_type: ContentType,
    /// 内容ID（修改/删除时）
    pub content_id: Option<u64>,
    /// 新内容CID（新增/修改时）
    pub new_content_cid: Option<BoundedVec<u8, ConstU32<128>>>,
    /// 操作理由
    pub reason: BoundedVec<u8, ConstU32<512>>,

    /// 执行时间
    pub executed_at: BlockNumberFor<T>,

    /// 【方案E】自动确认时间（executed_at + 30天）
    pub auto_confirm_at: BlockNumberFor<T>,

    /// 初始押金（USDT）
    pub initial_deposit_usdt: u32,
    /// 初始押金（DUST）
    pub initial_deposit_dust: BalanceOf<T>,

    /// 操作状态
    pub status: OwnerOperationStatus,
    /// 投诉数量
    pub complaint_count: u32,
}

/// 函数级详细中文注释：拥有者操作状态枚举（方案E：服务费+自动退还）
///
/// ### 状态定义
/// - **Active**: 活跃状态，可被投诉（30天内）
/// - **Confirmed**: 已确认（30天无投诉，押金已退还）
/// - **Revoked**: 投诉成功，操作撤销
///
/// ### 状态流转（简化版）
/// ```
/// Day 0: 上传内容
///   - 服务费：1 USDT → 立即转给拥有者
///   - 押金：2 USDT → 锁定
///   - 状态：Active
///
/// Day 0-30: Active（可被投诉）
///
/// Day 30后：
///   无投诉 → 任何人可调用 auto_finalize → Confirmed（退还2 USDT押金）
///   被投诉 → 审核 → Revoked（罚没押金）或维持Active
/// ```
///
/// ### 核心优化
/// - ❌ 取消Confirming状态（不需要手动确认）
/// - ❌ 取消PermanentlyLocked状态（不再永久锁定）
/// - ❌ 取消额外押金机制（不需要再锁2 USDT）
/// - ✅ 30天后自动退还押金（用户体验友好）
/// - ✅ 拥有者获得服务费收益（1 USDT/次）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum OwnerOperationStatus {
    /// 活跃状态（可被投诉）
    Active,
    /// 已确认（押金已退还）
    Confirmed,
    /// 已撤销（投诉成功）
    Revoked,
}

/// 函数级详细中文注释：投诉记录结构
///
/// ### 核心功能
/// - 记录对拥有者操作的投诉
/// - 最小投诉押金：5 USDT
/// - 投诉成功：罚没申请押金 → 80%投诉人 + 20%委员会
/// - 投诉失败：罚没投诉押金 → 80%拥有者 + 20%委员会
///
/// ### 存储映射
/// - `OwnerOperationComplaints<T>`: ComplaintId → OwnerOperationComplaint
/// - `ComplaintsByOperation<T>`: (OperationId, ComplaintId) → ()
/// - `ComplaintsByComplainant<T>`: (AccountId, ComplaintId) → ()
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OwnerOperationComplaint<T: Config> {
    /// 投诉ID
    pub complaint_id: u64,
    /// 投诉人账户
    pub complainant: T::AccountId,
    /// 关联的操作ID
    pub operation_id: u64,
    /// 投诉类型
    pub complaint_type: ComplaintType,
    /// 投诉理由
    pub reason: BoundedVec<u8, ConstU32<1024>>,
    /// 证据CID列表
    pub evidence_cids: BoundedVec<BoundedVec<u8, ConstU32<128>>, ConstU32<10>>,
    /// 投诉押金（USDT）
    pub deposit_usdt: u32,
    /// 投诉押金（DUST）
    pub deposit_dust: BalanceOf<T>,
    /// 投诉状态
    pub status: ComplaintStatus,
    /// 提交时间
    pub submitted_at: BlockNumberFor<T>,
    /// 审核时间
    pub reviewed_at: Option<BlockNumberFor<T>>,
}

/// 函数级详细中文注释：投诉类型枚举
///
/// ### 投诉分类
/// - **FalseInformation**: 虚假信息
/// - **Inappropriate**: 内容不当
/// - **Unauthorized**: 无权操作
/// - **Malicious**: 恶意操作
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ComplaintType {
    /// 虚假信息
    FalseInformation,
    /// 内容不当
    Inappropriate,
    /// 无权操作
    Unauthorized,
    /// 恶意操作
    Malicious,
}

/// 函数级详细中文注释：投诉状态枚举
///
/// ### 状态流转
/// - **Submitted**: 已提交，等待审核
/// - **Upheld**: 投诉成功
/// - **Rejected**: 投诉失败
/// - **PendingEvidence**: 等待补充证据
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ComplaintStatus {
    /// 已提交
    Submitted,
    /// 投诉成功
    Upheld,
    /// 投诉失败
    Rejected,
    /// 等待补充证据
    PendingEvidence,
}

/// 函数级详细中文注释：专家决定枚举
///
/// ### 决策类型
/// - **ComplaintValid**: 投诉成立
/// - **ComplaintInvalid**: 投诉不成立
/// - **RequireMoreEvidence**: 需要更多证据
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ExpertDecision {
    /// 投诉成立
    ComplaintValid,
    /// 投诉不成立
    ComplaintInvalid,
    /// 需要更多证据
    RequireMoreEvidence,
}

/// 函数级详细中文注释：汇率记录结构
///
/// ### 用途
/// - 缓存pallet-pricing的汇率，减少链上查询
/// - 缓存时长：10分钟（可配置）
///
/// 汇率格式
/// - USDT per DUST，scaled by 1e6
/// - 例如：1 DUST = 0.5 USDT → rate = 500000
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct ExchangeRate {
    /// USDT per DUST（scaled by 1e6）
    pub rate: u64,
    /// 更新时间
    pub updated_at: u32,
}
/// - 前端查询押金状态的统一格式
/// - 包含所有必要的状态信息和操作提示
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct DepositStatusInfo {
    /// 总押金（USDT）
    pub total_deposited_usdt: u32,
    /// 可用押金（USDT）
    pub available_usdt: u32,
    /// 已扣除（USDT）
    pub deducted_usdt: u32,
    /// 最低要求（USDT）
    pub min_required_usdt: u32,
    /// 缺口（USDT）
    pub shortage_usdt: u32,
    /// 是否充足
    pub is_sufficient: bool,
    /// 是否可以操作
    pub can_operate: bool,
}

/// 函数级详细中文注释：押金分配计划结构 - 用于投诉处理
///
/// ### 用途
/// - 投诉成功/失败时的押金分配计划
/// - 确保分配逻辑清晰可追踪
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
#[scale_info(skip_type_params(T))]
pub struct DistributionPlan<T: Config> {
    /// 投诉人奖励（投诉成功时）
    pub complainant_reward: Option<BalanceOf<T>>,
    /// 投诉人退款（投诉成功时）
    pub complainant_refund: Option<BalanceOf<T>>,
    /// 拥有者奖励（投诉失败时）
    pub owner_reward: Option<BalanceOf<T>>,
    /// 委员会分配
    pub committee_distribution: Vec<(T::AccountId, BalanceOf<T>)>,
    /// 国库分配
    pub treasury_allocation: BalanceOf<T>,
}

/// 函数级详细中文注释：Pricing Provider Trait - 与pallet-pricing集成
///
/// ### 用途
/// - 提供USDT/DUST汇率查询接口
/// - 将USDT金额转换为DUST金额
/// - 缓存汇率减少重复查询
///
/// ### 实现
/// - pallet-pricing提供实现
/// - 汇率格式：USDT per DUST，scaled by 1e6
pub trait PricingProvider {
    /// 函数级中文注释：获取当前DUST/USDT参考价格
    ///
    /// ### 返回值
    /// - USDT per DUST（精度10^6）
    /// - 例如：1 DUST = 0.5 USDT → 返回 500000
    ///
    /// ### 来源
    /// - pallet-pricing::get_dust_market_price_weighted()
    /// - 综合OTC和Bridge价格的加权平均
    fn get_current_exchange_rate() -> Result<u64, &'static str>;
}

/// 函数级详细中文注释：汇率转换帮助函数实现
///
/// ### 核心功能
/// 1. **USDT → DUST转换**
/// 2. **汇率缓存管理**（10分钟有效期）
/// 3. **转换精度处理**
pub struct ExchangeRateHelper<T: Config> {
    _phantom: sp_std::marker::PhantomData<T>,
}

impl<T: Config> ExchangeRateHelper<T> {
    /// 函数级详细中文注释：将USDT金额转换为DUST金额
    ///
    /// ### 参数
    /// - `usdt_amount`: USDT金额（整数，不含小数）
    ///
    /// ### 返回值
    /// - DUST金额（BalanceOf<T>，精度12位）
    ///
    /// ### 计算逻辑
    /// ```
    /// DUST = USDT × 10^6 / exchange_rate
    /// ```
    ///
    /// ### 示例
    /// - USDT: 100
    /// - 汇率: 500000 (0.5 USDT per DUST)
    /// - DUST = 100 × 1000000 / 500000 = 200 DUST
    pub fn convert_usdt_to_dust(usdt_amount: u32) -> Result<BalanceOf<T>, &'static str> {
        let rate = Self::get_cached_rate()?;

        // USDT金额扩展到10^6精度
        let usdt_scaled = (usdt_amount as u128).saturating_mul(1_000_000u128);

        // DUST金额 = USDT金额 / 汇率
        // 由于汇率是 USDT per DUST (scaled by 1e6)
        // 所以 DUST = (USDT * 1e6) / rate
        let dust_scaled = usdt_scaled
            .saturating_mul(1_000_000_000_000u128) // 扩展到DUST精度(12位)
            .checked_div(rate as u128)
            .ok_or("Exchange rate is zero")?;

        // 转换为BalanceOf<T>
        dust_scaled.try_into()
            .map_err(|_| "Amount overflow")
    }

    /// 函数级详细中文注释：获取缓存的汇率（10分钟有效期）
    ///
    /// ### 缓存策略
    /// - 有效期：10分钟（600秒）
    /// - 过期后重新查询pallet-pricing
    ///
    /// ### 返回值
    /// - 汇率（USDT per DUST，scaled by 1e6）
    pub fn get_cached_rate() -> Result<u64, &'static str> {
        // TODO: 这里需要在实际实现时添加存储读取逻辑
        // 暂时直接调用pricing pallet
        T::PricingProvider::get_current_exchange_rate()
    }

    /// 函数级详细中文注释：刷新汇率缓存
    ///
    /// ### 用途
    /// - 定期更新汇率缓存
    /// - 确保汇率时效性
    pub fn refresh_exchange_rate_cache() -> Result<u64, &'static str> {
        let rate = T::PricingProvider::get_current_exchange_rate()?;
        let _now = <frame_system::Pallet<T>>::block_number();

        // TODO: 更新CachedExchangeRate存储
        // CachedExchangeRate::<T>::put(ExchangeRate {
        //     rate,
        //     updated_at: now,
        // });

        Ok(rate)
    }
}

// ==================== 押金计算逻辑 ====================

/// 函数级详细中文注释：押金计算器 - 计算创建逝者所需押金
///
/// ### 核心功能
/// - 根据内容规模、用户信誉计算押金
/// - USDT计价，避免DUST波动
/// - 支持信誉折扣机制
pub struct DepositCalculator<T: Config> {
    _phantom: sp_std::marker::PhantomData<T>,
}

impl<T: Config> DepositCalculator<T> {
    /// 函数级详细中文注释：计算创建押金（USDT）
    ///
    /// ### 计算公式
    /// ```
    /// 押金 = 10 USDT（固定金额）
    /// ```
    ///
    /// ### 参数说明
    /// - **固定押金**: 10 USDT（简化版本，不考虑规模和信誉）
    ///
    /// ### 示例
    /// - 所有用户创建：10 USDT
    pub fn calculate_creation_deposit_usdt(
        _owner: &T::AccountId,
        _scale: ContentScale,
    ) -> u32 {
        // 固定返回 10 USDT
        10u32
    }

    /// 函数级详细中文注释：计算投诉押金（USDT）
    ///
    /// ### 投诉押金标准
    /// - **固定押金**: 2 USDT（所有投诉统一）
    ///
    /// ### 参数
    /// - `operation`: 操作类型（Add/Modify/Delete）- 暂未使用
    /// - `content_type`: 内容类型（Text/Media/Works）- 暂未使用
    ///
    /// ### 返回值
    /// - 投诉押金金额（USDT）
    pub fn calculate_complaint_deposit_usdt(
        _operation: OperationType,
        _content_type: ContentType,
    ) -> u32 {
        // 固定返回 2 USDT
        2u32
    }
}

// ==================== 主要接口实现 ====================

/// 函数级详细中文注释：逝者基本信息结构（用于创建接口）
///
/// ### 字段说明
/// - **name**: 逝者姓名
/// - **gender**: 性别（M/F）
/// - **birth_date**: 出生日期（Unix时间戳，秒）
/// - **death_date**: 死亡日期（Unix时间戳，秒）
/// - **epitaph**: 墓志铭（可选）
/// - **biography**: 生平简介（可选）
///
/// ### 注意
/// 这是一个简化结构，完整的DeceasedInfo在pallet主模块定义
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct DeceasedBasicInfo {
    /// 逝者姓名
    pub name: Vec<u8>,
    /// 性别
    pub gender: u8, // 0=男, 1=女
    /// 出生日期（Unix时间戳，秒）
    pub birth_date: u64,
    /// 死亡日期（Unix时间戳，秒）
    pub death_date: u64,
}

/// 函数级详细中文注释：治理接口实现 - 创建逝者并锁定押金
///
/// ### 核心功能
/// 1. 计算所需押金（USDT）
/// 2. 转换为DUST金额
/// 3. 锁定押金（永久质押）
/// 4. 创建逝者记录
/// 5. 创建押金记录
///
/// ### 调用示例
/// ```rust
/// let basic_info = DeceasedBasicInfo {
///     name: b"张三".to_vec(),
///     gender: 0, // 男
///     birth_date: 631152000, // 1990-01-01
///     death_date: 1640995200, // 2022-01-01
/// };
///
/// GovernanceOps::<T>::create_deceased_with_deposit(
///     origin,
///     basic_info,
///     ContentScale::Medium,
///     Some(grave_id),
/// )?;
/// ```
pub struct GovernanceOps<T: Config> {
    _phantom: sp_std::marker::PhantomData<T>,
}

impl<T: Config> GovernanceOps<T> {
    /// 函数级详细中文注释：创建逝者并锁定永久质押押金
    ///
    /// ### 参数
    /// - `origin`: 调用者（将成为逝者拥有者）
    /// - `basic_info`: 逝者基本信息
    /// - `expected_scale`: 预期内容规模
    /// - `grave_id`: 墓位ID（可选）
    ///
    /// ### 流程
    /// 1. 验证签名
    /// 2. 计算押金（USDT）
    /// 3. 转换为DUST
    /// 4. 锁定押金
    /// 5. 创建逝者记录（调用主pallet的内部方法）
    /// 6. 创建押金记录
    /// 7. 发出事件
    ///
    /// ### 错误处理
    /// - `InsufficientBalance`: 余额不足
    /// - `ExchangeRateUnavailable`: 汇率获取失败
    /// - `DeceasedCreationFailed`: 逝者创建失败
    ///
    /// ### 注意
    /// - 押金一旦锁定，只能在转让拥有权时释放
    /// - 押金不足时无法进行增删改操作
    pub fn create_deceased_with_deposit(
        origin: OriginFor<T>,
        _basic_info: DeceasedBasicInfo,
        expected_scale: ContentScale,
        _grave_id: Option<T::GraveId>,
    ) -> DispatchResult {
        let owner = ensure_signed(origin)?;
        let now = <frame_system::Pallet<T>>::block_number();

        // 1. 计算所需押金（USDT）
        let deposit_usdt = DepositCalculator::<T>::calculate_creation_deposit_usdt(
            &owner,
            expected_scale.clone(),
        );

        // 2. 转换为DUST金额
        let deposit_dust = ExchangeRateHelper::<T>::convert_usdt_to_dust(deposit_usdt)
            .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;

        // 3. 获取当前汇率（用于记录）
        let exchange_rate = ExchangeRateHelper::<T>::get_cached_rate()
            .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;

        // 4. 锁定押金（永久质押）
        // 注意：此函数为模板代码，实际实现在 lib.rs 的 create_deceased 函数中
        // T::Fungible::hold(
        //     &T::RuntimeHoldReason::from(HoldReason::DeceasedOwnerDeposit).into(),
        //     &owner,
        //     deposit_dust,
        // ).map_err(|_| Error::<T>::InsufficientBalance)?;

        // 5. 创建逝者记录
        // TODO: 调用主pallet的do_create_deceased方法
        // let deceased_id = Pallet::<T>::do_create_deceased(
        //     &owner,
        //     basic_info,
        //     grave_id,
        // )?;

        // 临时实现：生成一个假的deceased_id
        let deceased_id = 1u64; // TODO: 使用实际的deceased_id

        // 6. 创建押金记录
        let _deposit_record: governance::OwnerDepositRecord<T> = OwnerDepositRecord {
            owner: owner.clone(),
            deceased_id,
            initial_deposit_usdt: deposit_usdt,
            initial_deposit_dust: deposit_dust,
            current_locked_dust: deposit_dust,
            available_usdt: deposit_usdt,
            available_dust: deposit_dust,
            deducted_usdt: 0,
            deducted_dust: BalanceOf::<T>::zero(),
            locked_at: now,
            exchange_rate,
            expected_scale: expected_scale.clone(),
            status: DepositStatus::Active,
        };

        // TODO: 存储押金记录
        // OwnerDepositRecords::<T>::insert(deceased_id, deposit_record.clone());
        // OwnerDepositsByOwner::<T>::insert(&owner, deceased_id, ());

        // 7. 发出事件
        // TODO: 发出DeceasedCreatedWithDeposit事件
        // Pallet::<T>::deposit_event(Event::DeceasedCreatedWithDeposit {
        //     deceased_id,
        //     owner,
        //     deposit_usdt,
        //     deposit_dust,
        //     expected_scale,
        // });

        Ok(())
    }
}
