//! AI策略相关的数据类型定义

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::{pallet_prelude::*, BoundedVec};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

/// AI增强的交易策略
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct AITradingStrategy<AccountId, Moment> {
	// === 基础信息 ===
	/// 策略ID
	pub strategy_id: u64,
	/// 策略所有者
	pub owner: AccountId,
	/// 策略名称
	pub name: BoundedVec<u8, ConstU32<64>>,
	/// 描述（IPFS CID）
	pub description_cid: BoundedVec<u8, ConstU32<64>>,

	// === Hyperliquid配置 ===
	/// Hyperliquid账户地址
	pub hl_address: BoundedVec<u8, ConstU32<42>>,
	/// 交易对符号
	pub symbol: BoundedVec<u8, ConstU32<32>>,

	// === AI模型配置 ===
	pub ai_config: AIModelConfig,

	// === 策略配置 ===
	/// 策略类型
	pub strategy_type: StrategyType,
	/// 策略参数
	pub strategy_params: StrategyParams,

	// === 风控配置 ===
	/// 风控限制
	pub risk_limits: RiskLimits,
	/// 是否启用AI风险评估
	pub ai_risk_enabled: bool,

	// === 执行配置 ===
	pub execution_config: ExecutionConfig,

	// === 状态和表现 ===
	/// 策略状态
	pub status: StrategyStatus,
	/// 表现指标
	pub performance: PerformanceMetrics,
	/// 创建时间
	pub created_at: Moment,
	/// 最后执行时间
	pub last_executed_at: Option<Moment>,
}

/// AI模型配置
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct AIModelConfig {
	/// 主要模型类型
	pub primary_model: ModelType,
	/// 备用模型类型
	pub fallback_model: Option<ModelType>,

	/// 推理服务端点URL
	pub inference_endpoint: BoundedVec<u8, ConstU32<256>>,
	/// API密钥哈希（加密存储）
	pub api_key_hash: [u8; 32],

	/// 置信度阈值（0-100）
	pub confidence_threshold: u8,
	/// 启用的特征集
	pub features_enabled: BoundedVec<Feature, ConstU32<20>>,

	/// 推理超时时间（秒）
	pub inference_timeout_secs: u32,
	/// 最大重试次数
	pub max_retries: u8,

	/// 模型版本
	pub model_version: BoundedVec<u8, ConstU32<32>>,
}

impl Default for AIModelConfig {
	fn default() -> Self {
		Self {
			primary_model: ModelType::Ensemble,
			fallback_model: Some(ModelType::LSTM),
			inference_endpoint: BoundedVec::default(),
			api_key_hash: [0u8; 32],
			confidence_threshold: 60,
			features_enabled: BoundedVec::default(),
			inference_timeout_secs: 10,
			max_retries: 3,
			model_version: BoundedVec::default(),
		}
	}
}

/// AI模型类型
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ModelType {
	/// GPT-4大语言模型
	GPT4,
	/// Claude大语言模型
	Claude,
	/// DeepSeek大语言模型
	DeepSeek,
	/// Transformer模型
	Transformer,
	/// LSTM时间序列模型
	LSTM,
	/// 随机森林
	RandomForest,
	/// 集成模型（组合多个模型）
	Ensemble,
	/// 自定义模型
	Custom,
}

/// 特征类型
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum Feature {
	/// 技术指标（RSI, MACD等）
	TechnicalIndicators,
	/// 市场微观结构（订单簿、价差等）
	MarketMicrostructure,
	/// 链上数据
	OnChainMetrics,
	/// 社交媒体情绪
	SocialSentiment,
	/// 宏观经济指标
	MacroEconomics,
	/// 新闻事件
	NewsEvents,
	/// 资金费率
	FundingRate,
	/// 持仓量
	OpenInterest,
}

/// 策略类型
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum StrategyType {
	/// 网格交易
	Grid,
	/// 做市
	MarketMaking,
	/// 套利
	Arbitrage,
	/// 定投（DCA）
	DCA,
	/// 趋势跟踪
	TrendFollowing,
	/// AI纯策略（完全由AI决策）
	AIPure,
	/// 自定义
	Custom,
}

/// 策略参数
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct StrategyParams {
	// === 网格交易参数 ===
	/// 网格下界价格（单位：USDC，精度6位小数，存储时*1e6）
	pub grid_lower_price: Option<u64>,
	/// 网格上界价格
	pub grid_upper_price: Option<u64>,
	/// 网格层数
	pub grid_levels: Option<u32>,
	/// 每格订单大小（USDC）
	pub grid_order_size: Option<u64>,

	// === 做市参数 ===
	/// 价差（基点，1bp = 0.01%）
	pub mm_spread_bps: Option<u16>,
	/// 做市订单大小
	pub mm_order_size: Option<u64>,
	/// 深度层数
	pub mm_depth_levels: Option<u32>,

	// === 套利参数 ===
	/// 最小利润率（基点）
	pub arb_min_profit_bps: Option<u16>,
	/// 最大滑点（基点）
	pub arb_max_slippage_bps: Option<u16>,

	// === DCA参数 ===
	/// 定投间隔（区块数）
	pub dca_interval_blocks: Option<u32>,
	/// 每次定投金额
	pub dca_amount_per_order: Option<u64>,
}

impl Default for StrategyParams {
	fn default() -> Self {
		Self {
			grid_lower_price: None,
			grid_upper_price: None,
			grid_levels: None,
			grid_order_size: None,
			mm_spread_bps: None,
			mm_order_size: None,
			mm_depth_levels: None,
			arb_min_profit_bps: None,
			arb_max_slippage_bps: None,
			dca_interval_blocks: None,
			dca_amount_per_order: None,
		}
	}
}

/// 风控限制
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct RiskLimits {
	/// 最大仓位大小（USDC，*1e6）
	pub max_position_size: u64,
	/// 最大杠杆（*10，如50表示5x）
	pub max_leverage: u8,
	/// 止损价格（可选）
	pub stop_loss_price: Option<u64>,
	/// 止盈价格（可选）
	pub take_profit_price: Option<u64>,
	/// 每日最大交易次数
	pub max_trades_per_day: u32,
	/// 每日最大亏损（USDC，*1e6）
	pub max_daily_loss: u64,
}

impl Default for RiskLimits {
	fn default() -> Self {
		Self {
			max_position_size: 10_000_000_000, // 10,000 USDC
			max_leverage: 30,                   // 3x
			stop_loss_price: None,
			take_profit_price: None,
			max_trades_per_day: 100,
			max_daily_loss: 1_000_000_000, // 1,000 USDC
		}
	}
}

/// 执行配置
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct ExecutionConfig {
	/// 执行间隔（区块数）
	pub execution_interval_blocks: u32,
	/// 是否自动执行
	pub auto_execute: bool,
	/// 是否需要确认
	pub require_confirmation: bool,
}

impl Default for ExecutionConfig {
	fn default() -> Self {
		Self {
			execution_interval_blocks: 5, // 每5个区块执行一次（约30秒）
			auto_execute: true,
			require_confirmation: false,
		}
	}
}

/// 策略状态
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum StrategyStatus {
	/// 激活中
	Active,
	/// 已暂停
	Paused,
	/// 已停止
	Stopped,
	/// 错误状态
	Error,
}

/// 表现指标
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen, Default)]
pub struct PerformanceMetrics {
	/// 总交易次数
	pub total_trades: u32,
	/// 盈利次数
	pub winning_trades: u32,
	/// 亏损次数
	pub losing_trades: u32,
	/// 总盈亏（USDC，有符号，*1e6）
	pub total_pnl: i128,
	/// 最大回撤（USDC，*1e6）
	pub max_drawdown: u64,
	/// 夏普比率（*100）
	pub sharpe_ratio: i16,
	/// 胜率（百分比）
	pub win_rate: u8,
	/// 平均持仓时间（分钟）
	pub avg_holding_time: u32,
}

/// AI信号记录
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct AISignalRecord<Moment> {
	/// 信号ID
	pub signal_id: u64,
	/// 策略ID
	pub strategy_id: u64,
	/// 时间戳
	pub timestamp: Moment,

	// === AI推理结果 ===
	/// 交易信号
	pub signal: TradeSignal,
	/// 置信度（0-100）
	pub confidence: u8,
	/// 推理理由（IPFS CID）
	pub reasoning_cid: BoundedVec<u8, ConstU32<64>>,

	// === 交易参数 ===
	/// 推荐仓位大小（USDC，*1e6）
	pub position_size: u64,
	/// 入场价格（*1e6）
	pub entry_price: u64,
	/// 止损价格（可选）
	pub stop_loss: Option<u64>,
	/// 止盈价格（可选）
	pub take_profit: Option<u64>,

	// === 可解释性 ===
	/// 特征重要性（IPFS CID，JSON格式）
	pub feature_importance_cid: BoundedVec<u8, ConstU32<64>>,

	// === 风险评估 ===
	/// 风险评分（0-100）
	pub risk_score: u8,
	/// 市场状态
	pub market_condition: MarketCondition,

	// === 执行状态 ===
	/// 是否已执行
	pub executed: bool,
	/// 执行结果
	pub execution_result: Option<ExecutionResult>,
}

/// 交易信号
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum TradeSignal {
	/// 买入
	Buy,
	/// 卖出
	Sell,
	/// 持有
	Hold,
	/// 平仓
	Close,
}

/// 市场状态
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum MarketCondition {
	/// 牛市
	Bullish,
	/// 熊市
	Bearish,
	/// 震荡
	Sideways,
	/// 高波动
	HighVolatility,
	/// 低流动性
	LowLiquidity,
	/// 不确定
	Uncertain,
}

/// 执行结果
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct ExecutionResult {
	/// 订单ID
	pub order_id: BoundedVec<u8, ConstU32<64>>,
	/// 实际执行价格（*1e6）
	pub execution_price: u64,
	/// 实际执行数量（*1e6）
	pub execution_size: u64,
	/// 盈亏（USDC，有符号，*1e6）
	pub pnl: i64,
	/// 手续费（USDC，*1e6）
	pub fees: u64,
	/// 执行时间戳
	pub executed_at: u64,
	/// 平仓时间戳（可选）
	pub closed_at: Option<u64>,
	/// 是否成功
	pub success: bool,
	/// 错误信息（如果失败）
	pub error_message: Option<BoundedVec<u8, ConstU32<128>>>,
}

