//! # Hyperliquid DEX集成模块
//!
//! 本模块实现与Hyperliquid去中心化永续合约交易所的集成，包括：
//! 1. 数据类型定义
//! 2. EIP-712签名实现
//! 3. API接口封装
//! 4. 订单管理

use codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_core::{H160, H256};
use sp_runtime::RuntimeDebug;
use sp_std::vec::Vec;

/// Hyperliquid链ID（主网）
pub const HYPERLIQUID_CHAIN_ID: u64 = 42161;  // Arbitrum

/// Hyperliquid API端点
pub const HYPERLIQUID_API_URL: &str = "https://api.hyperliquid.xyz";

// ===== 数据类型定义 =====

/// 订单类型
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum OrderType {
    /// 市价单
    Market,
    /// 限价单
    Limit,
    /// 止损单
    StopLoss,
    /// 止盈单
    TakeProfit,
}

/// 订单方向
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum OrderSide {
    /// 买入/做多
    Buy,
    /// 卖出/做空
    Sell,
}

/// 订单状态
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum OrderStatus {
    /// 待提交
    Pending,
    /// 已提交
    Submitted,
    /// 部分成交
    PartiallyFilled,
    /// 完全成交
    Filled,
    /// 已取消
    Cancelled,
    /// 失败
    Failed,
}

/// Hyperliquid订单
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct HyperliquidOrder {
    /// 交易对（如"BTC-USD"）
    pub symbol: Vec<u8>,
    /// 订单类型
    pub order_type: OrderType,
    /// 订单方向
    pub side: OrderSide,
    /// 数量（使用整数表示，需要除以精度）
    pub size: u64,
    /// 价格（限价单使用，市价单为0）
    pub price: u64,
    /// 杠杆倍数（1-50）
    pub leverage: u8,
    /// 客户端订单ID
    pub client_order_id: Vec<u8>,
}

/// Hyperliquid账户信息
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct HyperliquidAccount {
    /// 用户地址
    pub address: H160,
    /// 账户余额（USDC）
    pub balance: u64,
    /// 可用余额
    pub available_balance: u64,
    /// 已用保证金
    pub margin_used: u64,
    /// 未实现盈亏
    pub unrealized_pnl: i64,
}

/// Hyperliquid持仓
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct HyperliquidPosition {
    /// 交易对
    pub symbol: Vec<u8>,
    /// 持仓方向
    pub side: OrderSide,
    /// 持仓数量
    pub size: u64,
    /// 入场价格
    pub entry_price: u64,
    /// 标记价格
    pub mark_price: u64,
    /// 未实现盈亏
    pub unrealized_pnl: i64,
    /// 杠杆
    pub leverage: u8,
}

// ===== EIP-712 签名相关 =====

/// EIP-712域分隔符
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct EIP712Domain {
    /// 域名
    pub name: Vec<u8>,
    /// 版本
    pub version: Vec<u8>,
    /// 链ID
    pub chain_id: u64,
    /// 验证合约地址
    pub verifying_contract: H160,
}

impl Default for EIP712Domain {
    fn default() -> Self {
        Self {
            name: b"Hyperliquid".to_vec(),
            version: b"1".to_vec(),
            chain_id: HYPERLIQUID_CHAIN_ID,
            verifying_contract: H160::zero(),  // TODO: 填入实际合约地址
        }
    }
}

/// EIP-712类型哈希
pub mod type_hashes {
    use sp_core::H256;
    
    /// Order类型哈希
    /// keccak256("Order(string symbol,bool isBuy,uint256 limitPx,uint256 sz,uint256 reduceOnly,uint256 postOnly,uint256 orderType,uint256 cloid)")
    pub const ORDER: H256 = H256([
        0x3a, 0xc2, 0x25, 0x16, 0x8d, 0xf5, 0x4b, 0x99,
        0x64, 0x58, 0xda, 0x2f, 0xef, 0xf4, 0x1a, 0x1f,
        0x56, 0xc7, 0xdb, 0x1d, 0x06, 0x32, 0xe8, 0x32,
        0x56, 0x17, 0xc6, 0x94, 0xd4, 0x82, 0x3f, 0xa4,
    ]);
}

/// EIP-712签名数据
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct EIP712SignatureData {
    /// 域分隔符
    pub domain: EIP712Domain,
    /// 消息哈希
    pub message_hash: H256,
    /// 签名
    pub signature: Vec<u8>,
}

// ===== API请求/响应结构 =====

/// 下单请求
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct PlaceOrderRequest {
    /// 订单信息
    pub order: HyperliquidOrder,
    /// EIP-712签名
    pub signature: Vec<u8>,
}

/// 下单响应
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct PlaceOrderResponse {
    /// 是否成功
    pub success: bool,
    /// 订单ID
    pub order_id: Vec<u8>,
    /// 错误信息（如果失败）
    pub error: Option<Vec<u8>>,
}

/// 查询持仓请求
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct GetPositionsRequest {
    /// 用户地址
    pub address: H160,
}

/// 查询持仓响应
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct GetPositionsResponse {
    /// 持仓列表
    pub positions: Vec<HyperliquidPosition>,
}

// ===== 辅助函数 =====

/// 计算EIP-712域分隔符哈希
pub fn compute_domain_separator(_domain: &EIP712Domain) -> H256 {
    // TODO: 实现完整的EIP-712域分隔符哈希计算
    // 这里返回占位符
    H256::zero()
}

/// 计算订单消息哈希
pub fn compute_order_hash(_order: &HyperliquidOrder) -> H256 {
    // TODO: 实现完整的EIP-712订单哈希计算
    // 这里返回占位符
    H256::zero()
}

/// 验证EIP-712签名
pub fn verify_eip712_signature(
    _message_hash: H256,
    _signature: &[u8],
    _address: H160,
) -> bool {
    // TODO: 实现EIP-712签名验证
    // 这需要使用secp256k1恢复签名
    true  // 占位符
}

// ===== 错误类型 =====

/// Hyperliquid错误
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum HyperliquidError {
    /// HTTP请求失败
    HttpRequestFailed,
    /// 响应解析失败
    ResponseParseFailed,
    /// 签名失败
    SignatureFailed,
    /// 余额不足
    InsufficientBalance,
    /// 订单被拒绝
    OrderRejected,
    /// 网络错误
    NetworkError,
    /// 未知错误
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_order_creation() {
        let order = HyperliquidOrder {
            symbol: b"BTC-USD".to_vec(),
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            size: 1000,  // 0.001 BTC (假设精度为1000000)
            price: 45000000,  // $45000 (假设精度为1000)
            leverage: 3,
            client_order_id: b"test-order-1".to_vec(),
        };

        assert_eq!(order.symbol, b"BTC-USD");
        assert_eq!(order.leverage, 3);
    }

    #[test]
    fn test_eip712_domain_default() {
        let domain = EIP712Domain::default();
        
        assert_eq!(domain.name, b"Hyperliquid");
        assert_eq!(domain.version, b"1");
        assert_eq!(domain.chain_id, HYPERLIQUID_CHAIN_ID);
    }
}

