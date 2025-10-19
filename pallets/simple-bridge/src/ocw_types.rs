// 函数级详细中文注释：OCW 做市商兑换相关类型定义

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::BoundedVec;
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

/// 函数级详细中文注释：OCW 做市商兑换订单状态
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum OcwMakerSwapStatus {
    /// 待做市商发送 USDT
    Pending,
    /// 做市商已提交 TRON 交易哈希，待 OCW 验证
    TronTxSubmitted,
    /// OCW 验证成功，MEMO 已放行
    Completed,
    /// 超时，买家已申诉退款
    Timeout,
    /// 用户举报做市商
    UserReported,
    /// 仲裁中
    Arbitrating,
    /// 仲裁批准（做市商履约）
    ArbitrationApproved,
    /// 仲裁拒绝（做市商违约）
    ArbitrationRejected,
    /// 已退款
    Refunded,
}

/// 函数级详细中文注释：OCW 做市商兑换订单记录
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(AccountId, Balance, BlockNumber))]
pub struct OcwMakerSwapRecord<AccountId, Balance, BlockNumber> {
    /// 订单 ID
    pub id: u64,
    
    /// 做市商 ID
    pub maker_id: u64,
    
    /// 做市商的 TRON 地址（用于发送 USDT）
    pub maker_tron_address: BoundedVec<u8, frame_support::traits::ConstU32<64>>,
    
    /// 做市商的链上收款账户（用于接收 MEMO）
    pub maker_memo_account: AccountId,
    
    /// 买家账户（MEMO 从这里锁定）
    pub buyer: AccountId,
    
    /// 买家的 TRON 地址（接收 USDT）
    pub buyer_tron_address: BoundedVec<u8, frame_support::traits::ConstU32<64>>,
    
    /// MEMO 数量（已锁定）
    pub memo_amount: Balance,
    
    /// 应付 USDT 金额（精度 10^6）
    pub usdt_amount: u64,
    
    /// 订单状态
    pub status: OcwMakerSwapStatus,
    
    /// TRON 交易哈希（做市商提交）
    pub tron_tx_hash: Option<BoundedVec<u8, frame_support::traits::ConstU32<128>>>,
    
    /// 创建区块
    pub created_at: BlockNumber,
    
    /// 超时区块（如果做市商不发币，买家可申诉）
    pub timeout_at: BlockNumber,
}

/// 函数级详细中文注释：TRON 交易数据（从 API 解析）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct TronTransactionData {
    /// 接收地址（Base58 格式）
    pub to_address: BoundedVec<u8, frame_support::traits::ConstU32<64>>,
    /// USDT 金额（精度 10^6）
    pub amount: u64,
    /// 确认数
    pub confirmations: u32,
    /// 时间戳（毫秒）
    pub timestamp: u64,
    /// 合约地址（验证是 USDT 合约）
    pub contract_address: BoundedVec<u8, frame_support::traits::ConstU32<64>>,
}

