//! # Off-Chain Worker (OCW) 模块
//!
//! 本模块实现链下工作者，负责：
//! 1. 定期调用AI推理服务获取交易信号
//! 2. 与Hyperliquid DEX交互执行交易
//! 3. 更新链上状态

extern crate alloc;
use alloc::format;

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::BlockNumberFor;
use sp_core::crypto::KeyTypeId;
use sp_runtime::{
    offchain::{http, Duration, HttpError},
    traits::SaturatedConversion,
    RuntimeDebug,
};
use sp_std::vec::Vec;
use codec::{Decode, Encode};

use crate::{Config, Pallet, types::*};

/// OCW专用密钥类型ID
pub const KEY_TYPE: KeyTypeId = KeyTypeId(*b"aist");  // AI Strategy

/// OCW App Crypto
pub mod crypto {
    use super::KEY_TYPE;
    use sp_runtime::{
        app_crypto::{app_crypto, sr25519},
        MultiSignature, MultiSigner,
    };
    app_crypto!(sr25519, KEY_TYPE);

    pub struct TestAuthId;

    impl frame_system::offchain::AppCrypto<MultiSigner, MultiSignature> for TestAuthId {
        type RuntimeAppPublic = Public;
        type GenericSignature = sp_core::sr25519::Signature;
        type GenericPublic = sp_core::sr25519::Public;
    }
}

/// AI推理服务请求（匹配FastAPI的InferenceRequest模型）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, scale_info::TypeInfo)]
pub struct AIInferenceRequest {
    /// 策略ID
    pub strategy_id: u64,
    /// 交易对
    pub symbol: Vec<u8>,
    /// 当前价格（整数，精度6位小数）
    pub current_price: u64,
    /// 1小时价格历史（12个点，5分钟间隔）
    pub prices_1h: Vec<u64>,
    /// 24小时价格历史（288个点，5分钟间隔）
    pub prices_24h: Vec<u64>,
    /// 24小时成交量历史
    pub volumes_24h: Vec<u64>,
    /// 买卖价差
    pub bid_ask_spread: u64,
    /// 资金费率（可选）
    pub funding_rate: Option<i32>,  // 放大10000倍的资金费率
    /// 模型类型
    pub model_type: Vec<u8>,
    /// 置信度阈值 (0-100)
    pub confidence_threshold: u8,
}

/// AI推理服务响应
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, scale_info::TypeInfo)]
pub struct AIInferenceResponse {
    /// 交易信号 (BUY/SELL/HOLD/CLOSE)
    pub signal: Vec<u8>,
    /// 置信度 (0-100)
    pub confidence: u8,
    /// 建议仓位大小
    pub position_size: u64,
    /// 入场价格
    pub entry_price: u64,
    /// 止损价格
    pub stop_loss: Option<u64>,
    /// 止盈价格
    pub take_profit: Option<u64>,
    /// 推理理由
    pub reasoning: Vec<u8>,
}

/// 市场数据结构
#[derive(Clone, RuntimeDebug)]
pub struct MarketData {
    /// 当前价格
    pub current_price: u64,
    /// 1小时价格历史
    pub prices_1h: Vec<u64>,
    /// 24小时价格历史
    pub prices_24h: Vec<u64>,
    /// 24小时成交量历史
    pub volumes_24h: Vec<u64>,
    /// 买卖价差
    pub bid_ask_spread: u64,
    /// 资金费率
    pub funding_rate: Option<i32>,
}

impl<T: Config> Pallet<T> {
    /// OCW主入口函数
    ///
    /// 在每个区块执行一次，检查是否需要更新策略
    pub fn offchain_worker(block_number: BlockNumberFor<T>) {
        log::info!("🤖 OCW执行于区块 #{:?}", block_number);

        // 检查是否应该在这个区块执行（每10个区块执行一次）
        if !Self::should_execute_at_block(block_number) {
            return;
        }

        // 执行策略更新
        if let Err(e) = Self::process_all_strategies() {
            log::error!("❌ 处理策略时出错: {:?}", e);
        }
    }

    /// 判断是否应该在当前区块执行
    fn should_execute_at_block(block_number: BlockNumberFor<T>) -> bool {
        // 每10个区块执行一次
        let block_num: u64 = block_number.saturated_into();
        block_num % 10 == 0
    }

    /// 处理所有活跃策略
    fn process_all_strategies() -> Result<(), &'static str> {
        // 遍历所有策略
        for (strategy_id, strategy) in crate::pallet::AIStrategies::<T>::iter() {
            // 只处理活跃状态的策略
            if strategy.status != StrategyStatus::Active {
                continue;
            }

            log::info!("📊 处理策略 #{}", strategy_id);

            // 调用AI推理服务
            match Self::call_ai_inference_service(strategy_id, &strategy) {
                Ok(response) => {
                    log::info!("✅ AI信号: {:?}", sp_std::str::from_utf8(&response.signal));
                    
                    // 提交交易信号到链上
                    if let Err(e) = Self::submit_ai_signal(strategy_id, response) {
                        log::error!("❌ 提交AI信号失败: {:?}", e);
                    }
                }
                Err(e) => {
                    log::error!("❌ AI推理失败: {:?}", e);
                }
            }
        }

        Ok(())
    }

    /// 调用AI推理服务
    ///
    /// 调用DeepSeek混合架构API获取交易信号
    fn call_ai_inference_service(
        strategy_id: u64,
        strategy: &AITradingStrategy<T::AccountId, T::Moment>,
    ) -> Result<AIInferenceResponse, HttpError> {
        // AI服务端点（TODO: 从链上配置读取）
        let ai_service_url = b"http://localhost:8000/api/v1/inference";

        // 获取市场数据（从外部Oracle或Hyperliquid API）
        let market_data = Self::fetch_market_data(&strategy.symbol)?;

        // 构建请求体
        let request = AIInferenceRequest {
            strategy_id,
            symbol: strategy.symbol.to_vec(),
            current_price: market_data.current_price,
            prices_1h: market_data.prices_1h,
            prices_24h: market_data.prices_24h,
            volumes_24h: market_data.volumes_24h,
            bid_ask_spread: market_data.bid_ask_spread,
            funding_rate: market_data.funding_rate,
            model_type: Self::get_model_type(&strategy.ai_config),
            confidence_threshold: strategy.ai_config.confidence_threshold,
        };

        // 序列化请求为JSON
        let request_body = Self::encode_inference_request(&request)?;

        log::info!(
            "🌐 调用AI服务: {} (策略#{})",
            sp_std::str::from_utf8(&request.symbol).unwrap_or("?"),
            strategy_id
        );

        // 创建HTTP请求
        let chunks: Vec<Vec<u8>> = alloc::vec![request_body];
        let pending = http::Request::post(
            sp_std::str::from_utf8(ai_service_url).unwrap_or(""),
            chunks
        )
        .add_header("Content-Type", "application/json")
        .deadline(sp_io::offchain::timestamp().add(Duration::from_millis(30000)))  // 30秒超时
        .send()
        .map_err(|_| {
            log::error!("❌ HTTP请求发送失败");
            HttpError::IoError
        })?;

        // 等待响应
        let response = pending
            .try_wait(sp_io::offchain::timestamp().add(Duration::from_millis(30000)))
            .map_err(|_| {
                log::error!("❌ HTTP请求超时");
                HttpError::DeadlineReached
            })?
            .map_err(|_| {
                log::error!("❌ HTTP响应错误");
                HttpError::IoError
            })?;

        // 检查状态码
        if response.code != 200 {
            log::error!("❌ HTTP状态码: {}", response.code);
            let body = response.body().collect::<Vec<u8>>();
            if let Ok(error_msg) = sp_std::str::from_utf8(&body) {
                log::error!("错误详情: {}", error_msg);
            }
            return Err(HttpError::IoError);
        }

        // 解析响应体
        let body = response.body().collect::<Vec<u8>>();
        log::debug!("响应体长度: {} bytes", body.len());
        
        Self::decode_inference_response(&body)
    }

    /// 编码推理请求为JSON
    ///
    /// 生成符合FastAPI InferenceRequest模型的JSON字符串
    fn encode_inference_request(request: &AIInferenceRequest) -> Result<Vec<u8>, HttpError> {
        // 辅助函数：生成价格数组JSON
        let prices_1h_json = Self::encode_u64_array(&request.prices_1h);
        let prices_24h_json = Self::encode_u64_array(&request.prices_24h);
        let volumes_24h_json = Self::encode_u64_array(&request.volumes_24h);

        // 转换价格为浮点数（除以1_000_000）
        let current_price_f = request.current_price as f64 / 1_000_000.0;
        let bid_ask_spread_f = request.bid_ask_spread as f64 / 1_000_000.0;
        
        // 资金费率（如果存在，除以10000）
        let funding_rate_json = if let Some(rate) = request.funding_rate {
            let rate_f = rate as f64 / 10000.0;
            format!("{}", rate_f)
        } else {
            format!("null")
        };

        // 获取当前时间戳
        let timestamp = sp_io::offchain::timestamp().unix_millis();

        // 构建完整JSON
        let prices_1h_str = sp_std::str::from_utf8(&prices_1h_json).unwrap_or("[]");
        let prices_24h_str = sp_std::str::from_utf8(&prices_24h_json).unwrap_or("[]");
        let volumes_24h_str = sp_std::str::from_utf8(&volumes_24h_json).unwrap_or("[]");
        
        let json = format!(
            r#"{{"strategy_id":{},"market_data":{{"symbol":"{}","current_price":{},"prices_1h":{},"prices_24h":{},"volumes_24h":{},"bid_ask_spread":{},"funding_rate":{},"timestamp":{}}},"model_type":"{}","confidence_threshold":{}}}"#,
            request.strategy_id,
            sp_std::str::from_utf8(&request.symbol).unwrap_or("BTC-USD"),
            current_price_f,
            prices_1h_str,
            prices_24h_str,
            volumes_24h_str,
            bid_ask_spread_f,
            funding_rate_json,
            timestamp,
            sp_std::str::from_utf8(&request.model_type).unwrap_or("ensemble"),
            request.confidence_threshold
        );

        Ok(json.into_bytes())
    }

    /// 编码u64数组为JSON数组字符串
    fn encode_u64_array(arr: &[u64]) -> Vec<u8> {
        if arr.is_empty() {
            return b"[]".to_vec();
        }

        let mut result = Vec::new();
        result.push(b'[');

        for (i, &value) in arr.iter().enumerate() {
            if i > 0 {
                result.push(b',');
            }
            // 转换为浮点数（除以1_000_000）
            let value_f = value as f64 / 1_000_000.0;
            let value_str = format!("{}", value_f);
            result.extend_from_slice(value_str.as_bytes());
        }

        result.push(b']');
        result
    }

    /// 解码推理响应
    ///
    /// 从JSON响应中提取交易信号（简化版JSON解析）
    fn decode_inference_response(body: &[u8]) -> Result<AIInferenceResponse, HttpError> {
        let body_str = sp_std::str::from_utf8(body).map_err(|_| {
            log::error!("❌ 响应不是有效的UTF-8");
            HttpError::IoError
        })?;

        log::debug!("JSON响应: {}", body_str);

        // 简化的JSON解析（提取关键字段）
        // 生产环境建议使用完整的JSON库如serde_json_core

        let signal = Self::extract_json_string(body_str, "signal")
            .unwrap_or(b"HOLD".to_vec());
        
        let confidence = Self::extract_json_u8(body_str, "confidence")
            .unwrap_or(50);

        let position_size = Self::extract_json_u64(body_str, "position_size")
            .unwrap_or(0);

        let entry_price = Self::extract_json_u64(body_str, "entry_price")
            .unwrap_or(0);

        let stop_loss = Self::extract_json_u64(body_str, "stop_loss");
        let take_profit = Self::extract_json_u64(body_str, "take_profit");

        let reasoning = Self::extract_json_string(body_str, "reasoning")
            .unwrap_or(b"AI analysis".to_vec());

        Ok(AIInferenceResponse {
            signal,
            confidence,
            position_size,
            entry_price,
            stop_loss,
            take_profit,
            reasoning,
        })
    }

    /// 从JSON字符串中提取字符串字段
    fn extract_json_string(json: &str, key: &str) -> Option<Vec<u8>> {
        let pattern = format!(r#""{}":"#, key);
        let start = json.find(&pattern)?;
        let value_start = start + pattern.len();
        
        if json.as_bytes().get(value_start)? == &b'"' {
            let value_start = value_start + 1;
            let value_end = json[value_start..].find('"')?;
            Some(json[value_start..value_start + value_end].as_bytes().to_vec())
        } else {
            None
        }
    }

    /// 从JSON字符串中提取u8数字字段
    fn extract_json_u8(json: &str, key: &str) -> Option<u8> {
        let pattern = format!("\"{}\":", key);
        let start = json.find(&pattern)?;
        let value_start = start + pattern.len();
        
        // 找到数字的结束位置（逗号、右括号或换行）
        let remaining = &json[value_start..];
        let end_chars = [',', '}', '\n', ' '];
        let mut value_end = remaining.len();
        
        for (i, ch) in remaining.char_indices() {
            if end_chars.contains(&ch) {
                value_end = i;
                break;
            }
        }
        
        let value_str = remaining[..value_end].trim();
        value_str.parse::<u8>().ok()
    }

    /// 从JSON字符串中提取u64数字字段（浮点数转整数）
    fn extract_json_u64(json: &str, key: &str) -> Option<u64> {
        let pattern = format!("\"{}\":", key);
        let start = json.find(&pattern)?;
        let value_start = start + pattern.len();
        
        let remaining = &json[value_start..];
        let end_chars = [',', '}', '\n', ' '];
        let mut value_end = remaining.len();
        
        for (i, ch) in remaining.char_indices() {
            if end_chars.contains(&ch) {
                value_end = i;
                break;
            }
        }
        
        let value_str = remaining[..value_end].trim();
        
        // 跳过null值
        if value_str == "null" {
            return None;
        }
        
        // 解析为浮点数后转换为整数（乘以1_000_000）
        if let Ok(value_f) = value_str.parse::<f64>() {
            Some((value_f * 1_000_000.0) as u64)
        } else {
            None
        }
    }

    /// 提交AI信号到链上
    ///
    /// 注意：当前实现直接调用链上函数，不使用签名交易
    /// 未来可以考虑使用签名交易以提高安全性
    fn submit_ai_signal(
        strategy_id: u64,
        response: AIInferenceResponse,
    ) -> Result<(), &'static str> {
        // 转换信号
        let signal = match response.signal.as_slice() {
            b"BUY" => TradeSignal::Buy,
            b"SELL" => TradeSignal::Sell,
            b"HOLD" => TradeSignal::Hold,
            b"CLOSE" => TradeSignal::Close,
            _ => TradeSignal::Hold,
        };

        // 构建AI信号记录结构（用于日志记录）
        let _ai_signal = AISignalRecord {
            signal_id: 0, // 将在链上生成
            strategy_id,
            timestamp: <pallet_timestamp::Pallet<T>>::get(),
            signal,
            confidence: response.confidence,
            reasoning_cid: BoundedVec::try_from(response.reasoning)
                .unwrap_or_default(),
            position_size: response.position_size,
            entry_price: response.entry_price,
            stop_loss: response.stop_loss,
            take_profit: response.take_profit,
            feature_importance_cid: Default::default(),
            risk_score: 50, // 默认风险评分
            market_condition: MarketCondition::Uncertain,
            executed: false,
            execution_result: None,
        };

        // 注意：当前实现中，record_ai_signal 使用 ensure_none，所以OCW无法直接调用
        // 这里只是记录日志，实际信号记录需要其他机制
        log::info!(
            "📊 AI信号生成 (策略#{}, 信号:{:?}, 置信度:{})",
            strategy_id,
            signal,
            response.confidence
        );

        // TODO: 实现实际的信号记录机制
        // 可以考虑：
        // 1. 修改 record_ai_signal 接受签名交易
        // 2. 使用其他存储机制记录信号
        // 3. 使用事件日志记录信号

        Ok(())
    }

    /// 获取市场数据
    ///
    /// 从Hyperliquid或其他数据源获取实时市场数据
    /// TODO: 实现真实的市场数据获取逻辑
    fn fetch_market_data(symbol: &[u8]) -> Result<MarketData, HttpError> {
        log::info!("📈 获取市场数据: {}", sp_std::str::from_utf8(symbol).unwrap_or("?"));

        // TODO: 实际实现应该：
        // 1. 调用Hyperliquid API获取实时数据
        // 2. 或从链上Oracle读取数据
        // 3. 或使用其他数据提供商

        // 这里返回模拟数据用于MVP测试
        let current_price = 65_000_000_000u64; // $65,000 (精度6位小数)
        let base_price = 64_000_000_000u64;

        // 生成模拟的价格历史（12个点，5分钟间隔）
        let mut prices_1h = Vec::new();
        for i in 0..12 {
            let variation = (i as i64 - 6) * 100_000_000;  // ±$100波动
            let price = (base_price as i64 + variation) as u64;
            prices_1h.push(price);
        }

        // 生成模拟的24小时价格历史（288个点）
        // 使用简化的正弦波模拟（不依赖标准库的sin函数）
        let mut prices_24h = Vec::new();
        for i in 0..288 {
            // 使用简化的周期函数替代sin: (i % 288) / 288.0 * 2.0 * PI 的近似值
            let phase = (i % 288) as f64 / 288.0;
            // 简化的正弦近似：使用线性插值代替sin
            let sin_approx = if phase < 0.5 {
                phase * 4.0 - 1.0
            } else {
                3.0 - phase * 4.0
            };
            let variation = (sin_approx * 500_000_000.0) as i64;
            let price = (base_price as i64 + variation) as u64;
            prices_24h.push(price);
        }

        // 生成模拟的成交量历史
        let mut volumes_24h = Vec::new();
        for i in 0..288 {
            let base_volume = 1_000_000_000_000u64; // $1M
            let variation = (i % 100) as u64 * 10_000_000_000;
            volumes_24h.push(base_volume + variation);
        }

        Ok(MarketData {
            current_price,
            prices_1h,
            prices_24h,
            volumes_24h,
            bid_ask_spread: 5_000_000,  // $5价差
            funding_rate: Some(10),     // 0.001% (放大10000倍)
        })
    }

    /// 从策略配置获取模型类型字符串
    fn get_model_type(config: &AIModelConfig) -> Vec<u8> {
        // 根据策略配置的模型类型返回对应的字符串
        match config.primary_model {
            ModelType::LSTM => b"lstm".to_vec(),
            ModelType::Transformer => b"transformer".to_vec(),
            ModelType::RandomForest => b"random_forest".to_vec(),
            ModelType::Ensemble => b"ensemble".to_vec(),
            ModelType::GPT4 => b"gpt4".to_vec(),
            ModelType::Claude => b"claude".to_vec(),
            ModelType::DeepSeek => b"deepseek".to_vec(),
            ModelType::Custom => b"custom".to_vec(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_u64_array() {
        let arr = vec![65_000_000_000u64, 64_500_000_000u64, 65_500_000_000u64];
        let json = <Pallet<crate::mock::Test>>::encode_u64_array(&arr);
        let json_str = sp_std::str::from_utf8(&json).unwrap();
        
        // 应该生成类似 [65000.0,64500.0,65500.0] 的JSON
        assert!(json_str.starts_with('['));
        assert!(json_str.ends_with(']'));
        assert!(json_str.contains(','));
    }

    #[test]
    fn test_extract_json_string() {
        let json = r#"{"signal":"BUY","confidence":75}"#;
        let result = <Pallet<crate::mock::Test>>::extract_json_string(json, "signal");
        assert_eq!(result, Some(b"BUY".to_vec()));
    }

    #[test]
    fn test_extract_json_u8() {
        let json = r#"{"signal":"BUY","confidence":75}"#;
        let result = <Pallet<crate::mock::Test>>::extract_json_u8(json, "confidence");
        assert_eq!(result, Some(75));
    }
}

