//! # 类型定义
//!
//! 函数级详细中文注释：定义 pallet-dust-bridge 使用的数据结构

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::BoundedVec;
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

/// 函数级详细中文注释：以太坊地址类型（42 字节：0x + 40个十六进制字符）
pub type EthAddress = BoundedVec<u8, frame_support::traits::ConstU32<42>>;

/// 函数级详细中文注释：以太坊交易哈希类型（66 字节：0x + 64个十六进制字符）
pub type EthTxHash = BoundedVec<u8, frame_support::traits::ConstU32<66>>;

/// 函数级详细中文注释：桥接状态枚举
#[derive(Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, Clone, Copy, PartialEq, Eq, RuntimeDebug)]
pub enum BridgeStatus {
	/// 待处理（等待 OCW 处理）
	Pending,
	/// 处理中（OCW 正在调用 Arbitrum 合约）
	Processing,
	/// 已完成（Arbitrum 交易已确认）
	Completed,
	/// 失败（Arbitrum 交易失败或超时）
	Failed,
}

/// 函数级详细中文注释：桥接请求结构（Stardust → Arbitrum）
/// 
/// ## 字段说明
/// - `id`: 桥接唯一 ID
/// - `user`: 发起桥接的 Substrate 账户
/// - `amount`: 锁定的 DUST 数量
/// - `target_address`: Arbitrum 接收地址
/// - `status`: 桥接状态
/// - `created_at`: 创建区块号
/// - `arbitrum_tx_hash`: Arbitrum 交易哈希（完成后填充）
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, Balance, BlockNumber))]
pub struct BridgeRequest<AccountId, Balance, BlockNumber> {
	/// 桥接 ID
	pub id: u64,
	/// 用户账户（Substrate）
	pub user: AccountId,
	/// DUST 数量
	pub amount: Balance,
	/// 目标地址（Arbitrum）
	pub target_address: EthAddress,
	/// 状态
	pub status: BridgeStatus,
	/// 创建时间
	pub created_at: BlockNumber,
	/// Arbitrum 交易哈希（完成后填充）
	pub arbitrum_tx_hash: Option<EthTxHash>,
}

/// 函数级详细中文注释：桥接返回请求结构（Arbitrum → Stardust）
/// 
/// ## 字段说明
/// - `arbitrum_tx_hash`: Arbitrum 上的销毁交易哈希
/// - `substrate_address`: Substrate 接收地址
/// - `amount`: 解锁的 DUST 数量
/// - `processed`: 是否已处理
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, Balance))]
pub struct BridgeBackRequest<AccountId, Balance> {
	/// Arbitrum 交易哈希
	pub arbitrum_tx_hash: EthTxHash,
	/// Substrate 接收地址
	pub substrate_address: AccountId,
	/// DUST 数量
	pub amount: Balance,
	/// 是否已处理
	pub processed: bool,
}

