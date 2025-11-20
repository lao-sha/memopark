//! # DeepSeek AI 集成模块
//!
//! 本模块实现与 DeepSeek API 的集成，用于AI交易决策
//!
//! DeepSeek API: https://api.deepseek.com

use codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;
use sp_std::vec::Vec;

// 在 no_std 环境中使用 alloc
extern crate alloc;
use alloc::{string::String, format};

/// DeepSeek API 配置
pub const DEEPSEEK_API_URL: &str = "https://api.deepseek.com/chat/completions";
pub const DEEPSEEK_MODEL: &str = "deepseek-chat";

/// DeepSeek 请求结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct DeepSeekRequest {
	/// 模型名称
	pub model: Vec<u8>,
	/// 对话消息列表
	pub messages: Vec<ChatMessage>,
	/// 温度参数 (0.0-2.0)，控制随机性
	pub temperature: u8,  // 实际值需除以10，如7表示0.7
	/// 最大token数
	pub max_tokens: u32,
}

/// 聊天消息
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct ChatMessage {
	/// 角色：system/user/assistant
	pub role: Vec<u8>,
	/// 消息内容
	pub content: Vec<u8>,
}

/// DeepSeek 响应结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct DeepSeekResponse {
	/// 响应ID
	pub id: Vec<u8>,
	/// 选择列表
	pub choices: Vec<Choice>,
	/// 使用情况
	pub usage: Usage,
}

/// 响应选择
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct Choice {
	/// 消息内容
	pub message: ChatMessage,
	/// 结束原因
	pub finish_reason: Vec<u8>,
}

/// Token使用情况
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct Usage {
	/// Prompt tokens
	pub prompt_tokens: u32,
	/// 完成 tokens
	pub completion_tokens: u32,
	/// 总 tokens
	pub total_tokens: u32,
}

/// 交易信号（从DeepSeek响应解析）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct TradingSignal {
	/// 交易动作: BUY/SELL/HOLD/CLOSE
	pub action: Vec<u8>,
	/// 置信度 (0-100)
	pub confidence: u8,
	/// 建议仓位大小 (USDC，精度6位)
	pub position_size: u64,
	/// 入场价格 (可选)
	pub entry_price: Option<u64>,
	/// 止损价格 (可选)
	pub stop_loss: Option<u64>,
	/// 止盈价格 (可选)
	pub take_profit: Option<u64>,
	/// 推理理由
	pub reasoning: Vec<u8>,
}

/// 函数级中文注释：构建交易分析的 Prompt
///
/// 根据市场数据和策略配置，生成适合 DeepSeek 的 prompt
pub fn build_trading_prompt(
	symbol: &[u8],
	current_price: u64,
	price_24h: &[u64],
	volume_24h: &[u64],
	strategy_type: &str,
) -> Vec<u8> {
	// 格式化价格（假设精度为6位小数）
	let price_str = format_price(current_price);
	
	// 计算24小时价格变化
	let price_change = if !price_24h.is_empty() {
		let old_price = price_24h[0];
		let change_pct = ((current_price as i128 - old_price as i128) * 100) / old_price as i128;
		change_pct
	} else {
		0
	};

	let prompt = format!(
		r#"你是一个专业的加密货币交易AI分析师。请基于以下市场数据，给出交易建议。

**交易对**: {}
**当前价格**: ${} USD
**24小时价格变化**: {}%
**策略类型**: {}

**24小时价格数据** (最近10个数据点):
{}

**24小时成交量数据**:
{}

**要求**:
1. 分析当前市场趋势
2. 给出明确的交易信号: BUY (买入), SELL (卖出), HOLD (持有), 或 CLOSE (平仓)
3. 提供置信度 (0-100)
4. 建议仓位大小 (以USDC计)
5. 建议止损和止盈价格
6. 简要说明理由

**响应格式** (必须严格遵守JSON格式):
{{
  "action": "BUY|SELL|HOLD|CLOSE",
  "confidence": 85,
  "position_size": 1000000000,
  "entry_price": 45000000000,
  "stop_loss": 44000000000,
  "take_profit": 47000000000,
  "reasoning": "分析理由..."
}}

请直接返回JSON，不要包含其他内容。"#,
		core::str::from_utf8(symbol).unwrap_or("UNKNOWN"),
		price_str,
		price_change,
		strategy_type,
		format_price_history(price_24h),
		format_volume_history(volume_24h)
	);

	prompt.into_bytes()
}

/// 函数级中文注释：格式化价格
///
/// 将整数价格转换为美元格式 (精度6位)
fn format_price(price: u64) -> String {
	let dollars = price / 1_000_000;
	let cents = (price % 1_000_000) / 10_000;
	format!("{}.{:02}", dollars, cents)
}

/// 函数级中文注释：格式化价格历史
fn format_price_history(prices: &[u64]) -> String {
	prices
		.iter()
		.take(10)
		.map(|&p| format!("${}", format_price(p)))
		.collect::<Vec<_>>()
		.join(", ")
}

/// 函数级中文注释：格式化成交量历史
fn format_volume_history(volumes: &[u64]) -> String {
	volumes
		.iter()
		.take(10)
		.map(|&v| format!("${}", format_price(v)))
		.collect::<Vec<_>>()
		.join(", ")
}

/// 函数级中文注释：解析 DeepSeek 响应为交易信号
///
/// 从 DeepSeek 的 JSON 响应中提取交易信号
pub fn parse_trading_signal(response: &DeepSeekResponse) -> Result<TradingSignal, &'static str> {
	// 获取第一个选择的消息内容
	let content = response
		.choices
		.first()
		.ok_or("No choices in response")?
		.message
		.content
		.clone();

	// 解析 JSON
	// 注意：这里需要实现简单的 JSON 解析
	// 或者使用 serde-json-core (no_std 兼容)
	
	// 简化版本：使用字符串匹配
	let content_str = core::str::from_utf8(&content).map_err(|_| "Invalid UTF-8")?;
	
	// 提取 action
	let action = extract_json_field(content_str, "action")
		.unwrap_or(String::from("HOLD"))
		.into_bytes();
	
	// 提取 confidence
	let confidence = extract_json_number(content_str, "confidence")
		.unwrap_or(50) as u8;
	
	// 提取 position_size
	let position_size = extract_json_number(content_str, "position_size")
		.unwrap_or(0);
	
	// 提取价格
	let entry_price = extract_json_number(content_str, "entry_price");
	let stop_loss = extract_json_number(content_str, "stop_loss");
	let take_profit = extract_json_number(content_str, "take_profit");
	
	// 提取 reasoning
	let reasoning = extract_json_field(content_str, "reasoning")
		.unwrap_or(String::from("No reasoning provided"))
		.into_bytes();

	Ok(TradingSignal {
		action,
		confidence,
		position_size,
		entry_price,
		stop_loss,
		take_profit,
		reasoning,
	})
}

/// 函数级中文注释：从JSON字符串中提取字符串字段
fn extract_json_field(json: &str, field: &str) -> Option<String> {
	let pattern = format!("\"{}\":", field);
	if let Some(start) = json.find(&pattern) {
		let after = &json[start + pattern.len()..];
		if let Some(quote_start) = after.find('"') {
			let value_start = quote_start + 1;
			if let Some(quote_end) = after[value_start..].find('"') {
				return Some(String::from(&after[value_start..value_start + quote_end]));
			}
		}
	}
	None
}

/// 函数级中文注释：从JSON字符串中提取数字字段
fn extract_json_number(json: &str, field: &str) -> Option<u64> {
	let pattern = format!("\"{}\":", field);
	if let Some(start) = json.find(&pattern) {
		let after = &json[start + pattern.len()..].trim_start();
		let num_str: String = after
			.chars()
			.take_while(|c| c.is_ascii_digit())
			.collect();
		num_str.parse::<u64>().ok()
	} else {
		None
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn test_build_trading_prompt() {
		let symbol = b"BTC-USD";
		let current_price = 45_000_000_000u64; // $45,000
		let prices = vec![44_000_000_000u64, 44_500_000_000u64];
		let volumes = vec![1_000_000_000_000u64];
		
		let prompt = build_trading_prompt(
			symbol,
			current_price,
			&prices,
			&volumes,
			"Grid"
		);
		
		assert!(!prompt.is_empty());
		assert!(core::str::from_utf8(&prompt).unwrap().contains("BTC-USD"));
	}

	#[test]
	fn test_extract_json_field() {
		let json = r#"{"action": "BUY", "confidence": 85}"#;
		
		assert_eq!(
			extract_json_field(json, "action"),
			Some(String::from("BUY"))
		);
	}

	#[test]
	fn test_extract_json_number() {
		let json = r#"{"confidence": 85, "position_size": 1000000}"#;
		
		assert_eq!(extract_json_number(json, "confidence"), Some(85));
		assert_eq!(extract_json_number(json, "position_size"), Some(1000000));
	}

	#[test]
	fn test_format_price() {
		assert_eq!(format_price(45_000_000_000), "45000.00");
		assert_eq!(format_price(123_456_789), "123.45");
	}
}

