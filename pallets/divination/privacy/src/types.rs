//! # 统一隐私授权模块 - 类型定义
//!
//! 本模块定义了隐私授权系统所需的所有核心数据结构，
//! 为所有占卜类型提供统一的加密存储和授权机制。
//!
//! ## 核心类型
//!
//! - `PrivacyMode`: 隐私模式（公开/私密/授权）
//! - `AccessRole`: 授权角色（所有者/命理师/家族/AI/悬赏回答者）
//! - `AccessScope`: 访问范围（只读/可评论/完全访问）
//! - `ServiceProviderType`: 服务提供者类型
//! - `EncryptedRecord`: 加密数据记录
//! - `AuthorizationEntry`: 授权条目
//! - `ServiceProvider`: 服务提供者信息

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use pallet_divination_common::DivinationType;
use scale_info::TypeInfo;

// ============================================================================
// 基础枚举类型
// ============================================================================

/// 隐私模式
///
/// 定义占卜结果的可见性级别
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    codec::DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum PrivacyMode {
    /// 公开 - 所有人可见
    #[default]
    Public = 0,
    /// 私密 - 仅所有者可见
    Private = 1,
    /// 授权 - 被授权者可见
    Authorized = 2,
}

/// 授权角色
///
/// 定义被授权方的身份类型
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    codec::DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum AccessRole {
    /// 所有者 - 不可撤销
    #[default]
    Owner = 0,
    /// 命理师 - 专业解读者
    Master = 1,
    /// 家族成员 - 家庭内部共享
    Family = 2,
    /// AI 服务 - 自动化解读
    AiService = 3,
    /// 悬赏回答者 - 临时授权
    BountyAnswerer = 4,
}

/// 访问范围
///
/// 定义被授权方可以进行的操作
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    codec::DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum AccessScope {
    /// 只读 - 仅能查看
    #[default]
    ReadOnly = 0,
    /// 可评论 - 可以查看并添加解读评论
    CanComment = 1,
    /// 完全访问 - 完全访问所有数据
    FullAccess = 2,
}

/// 服务提供者类型
///
/// 定义不同类型的服务提供者
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    codec::DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum ServiceProviderType {
    /// 命理师 - 专业命理解读服务
    #[default]
    MingLiShi = 0,
    /// AI 服务 - 自动化 AI 解读
    AiService = 1,
    /// 家族成员 - 家庭内部成员
    FamilyMember = 2,
    /// 研究机构 - 学术研究用途
    Research = 3,
}

// ============================================================================
// 核心数据结构
// ============================================================================

/// 用户加密密钥信息
///
/// 存储用户的 X25519 公钥用于多方加密
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct UserEncryptionInfo<BlockNumber> {
    /// X25519 公钥（32 字节）
    pub public_key: [u8; 32],
    /// 注册时间
    pub registered_at: BlockNumber,
    /// 更新时间
    pub updated_at: BlockNumber,
}

/// 服务提供者信息
///
/// 记录服务提供者的注册信息和状态
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct ServiceProvider<BlockNumber> {
    /// 提供者类型
    pub provider_type: ServiceProviderType,
    /// X25519 公钥（32 字节）
    pub public_key: [u8; 32],
    /// 信誉分（0-100）
    pub reputation: u8,
    /// 是否活跃
    pub is_active: bool,
    /// 注册时间
    pub registered_at: BlockNumber,
    /// 完成服务数
    pub completed_services: u32,
}

impl<BlockNumber: Default> Default for ServiceProvider<BlockNumber> {
    fn default() -> Self {
        Self {
            provider_type: ServiceProviderType::default(),
            public_key: [0u8; 32],
            reputation: 50, // 初始信誉分
            is_active: true,
            registered_at: BlockNumber::default(),
            completed_services: 0,
        }
    }
}

/// 加密数据记录
///
/// 存储加密的敏感数据，适用于所有占卜类型
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxDataLen))]
pub struct EncryptedRecord<AccountId, BlockNumber, MaxDataLen: Get<u32>> {
    /// 占卜类型
    pub divination_type: DivinationType,
    /// 原始结果 ID（在对应占卜模块中的 ID）
    pub result_id: u64,
    /// 所有者
    pub owner: AccountId,
    /// 隐私模式
    pub privacy_mode: PrivacyMode,
    /// 加密的敏感数据（AES-256-GCM 加密）
    pub encrypted_data: BoundedVec<u8, MaxDataLen>,
    /// 加密随机数（24 字节）
    pub nonce: [u8; 24],
    /// 认证标签（16 字节）
    pub auth_tag: [u8; 16],
    /// 数据哈希（用于验证完整性）
    pub data_hash: [u8; 32],
    /// 创建区块
    pub created_at: BlockNumber,
    /// 更新区块
    pub updated_at: BlockNumber,
}

/// 授权条目
///
/// 记录单个授权关系的详细信息
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxKeyLen))]
pub struct AuthorizationEntry<AccountId, BlockNumber, MaxKeyLen: Get<u32>> {
    /// 被授权账户
    pub grantee: AccountId,
    /// 加密的 DataKey（用被授权者公钥封装）
    pub encrypted_key: BoundedVec<u8, MaxKeyLen>,
    /// 授权角色
    pub role: AccessRole,
    /// 访问范围
    pub scope: AccessScope,
    /// 授权时间
    pub granted_at: BlockNumber,
    /// 过期时间（0 表示永久）
    pub expires_at: BlockNumber,
    /// 关联的悬赏 ID（如果是悬赏授权）
    pub bounty_id: Option<u64>,
}

/// 悬赏授权信息
///
/// 记录悬赏与加密数据的关联
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct BountyAuthInfo<BlockNumber> {
    /// 占卜类型
    pub divination_type: DivinationType,
    /// 关联的结果 ID
    pub result_id: u64,
    /// 授权过期时间
    pub expires_at: BlockNumber,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 是否自动授权新回答者
    pub auto_authorize: bool,
}

// ============================================================================
// 记录键类型（用于存储索引）
// ============================================================================

/// 加密记录唯一标识
/// 由 (DivinationType, result_id) 组成
#[derive(Clone, Copy, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct RecordKey {
    pub divination_type: DivinationType,
    pub result_id: u64,
}

impl RecordKey {
    pub fn new(divination_type: DivinationType, result_id: u64) -> Self {
        Self {
            divination_type,
            result_id,
        }
    }
}

// ============================================================================
// Runtime API 返回类型
// ============================================================================

/// 加密记录信息（用于 Runtime API 返回）
#[derive(Clone, Encode, Decode, TypeInfo, PartialEq, Eq, Debug)]
pub struct EncryptedRecordInfo {
    /// 占卜类型
    pub divination_type: u8,
    /// 结果 ID
    pub result_id: u64,
    /// 所有者地址（hex 编码）
    pub owner: sp_std::vec::Vec<u8>,
    /// 隐私模式
    pub privacy_mode: u8,
    /// 授权数量
    pub authorization_count: u32,
    /// 创建区块
    pub created_at: u64,
}

/// 授权信息（用于 Runtime API 返回）
#[derive(Clone, Encode, Decode, TypeInfo, PartialEq, Eq, Debug)]
pub struct AuthorizationInfo {
    /// 被授权账户地址（hex 编码）
    pub grantee: sp_std::vec::Vec<u8>,
    /// 授权角色
    pub role: u8,
    /// 访问范围
    pub scope: u8,
    /// 授权时间（区块号）
    pub granted_at: u64,
    /// 过期时间（区块号，0 表示永久）
    pub expires_at: u64,
    /// 关联悬赏 ID
    pub bounty_id: Option<u64>,
}

/// 服务提供者信息（用于 Runtime API 返回）
#[derive(Clone, Encode, Decode, TypeInfo, PartialEq, Eq, Debug)]
pub struct ServiceProviderInfo {
    /// 提供者类型
    pub provider_type: u8,
    /// 公钥（hex 编码）
    pub public_key: sp_std::vec::Vec<u8>,
    /// 信誉分
    pub reputation: u8,
    /// 是否活跃
    pub is_active: bool,
    /// 注册区块
    pub registered_at: u64,
    /// 完成服务数
    pub completed_services: u32,
}

/// 悬赏授权状态（用于 Runtime API 返回）
#[derive(Clone, Encode, Decode, TypeInfo, PartialEq, Eq, Debug, Default)]
pub struct BountyAuthorizationStatus {
    /// 是否需要授权（关联加密数据）
    pub requires_authorization: bool,
    /// 占卜类型
    pub divination_type: Option<u8>,
    /// 结果 ID
    pub result_id: Option<u64>,
    /// 已授权回答者数量
    pub authorized_count: u32,
    /// 是否自动授权
    pub auto_authorize: bool,
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_privacy_mode_default() {
        assert_eq!(PrivacyMode::default(), PrivacyMode::Public);
    }

    #[test]
    fn test_access_role_values() {
        assert_eq!(AccessRole::Owner as u8, 0);
        assert_eq!(AccessRole::Master as u8, 1);
        assert_eq!(AccessRole::Family as u8, 2);
        assert_eq!(AccessRole::AiService as u8, 3);
        assert_eq!(AccessRole::BountyAnswerer as u8, 4);
    }

    #[test]
    fn test_access_scope_values() {
        assert_eq!(AccessScope::ReadOnly as u8, 0);
        assert_eq!(AccessScope::CanComment as u8, 1);
        assert_eq!(AccessScope::FullAccess as u8, 2);
    }

    #[test]
    fn test_service_provider_type_values() {
        assert_eq!(ServiceProviderType::MingLiShi as u8, 0);
        assert_eq!(ServiceProviderType::AiService as u8, 1);
        assert_eq!(ServiceProviderType::FamilyMember as u8, 2);
        assert_eq!(ServiceProviderType::Research as u8, 3);
    }

    #[test]
    fn test_record_key() {
        let key = RecordKey::new(DivinationType::Bazi, 123);
        assert_eq!(key.divination_type, DivinationType::Bazi);
        assert_eq!(key.result_id, 123);
    }

    #[test]
    fn test_service_provider_default() {
        let provider: ServiceProvider<u32> = ServiceProvider::default();
        assert_eq!(provider.reputation, 50);
        assert!(provider.is_active);
        assert_eq!(provider.completed_services, 0);
    }
}
