//! AI策略Pallet的单元测试

use crate::{mock::*, types::*, Error};
use frame_support::{assert_noop, assert_ok, BoundedVec};

/// 创建测试用的AI配置
fn get_test_ai_config() -> AIModelConfig {
	AIModelConfig {
		primary_model: ModelType::LSTM,
		fallback_model: Some(ModelType::Transformer),
		inference_endpoint: BoundedVec::try_from(
			b"https://api.test.com/inference".to_vec()
		)
		.unwrap(),
		api_key_hash: [1u8; 32],
		confidence_threshold: 60,
		features_enabled: BoundedVec::try_from(vec![
			Feature::TechnicalIndicators,
			Feature::MarketMicrostructure,
		])
		.unwrap(),
		inference_timeout_secs: 10,
		max_retries: 3,
		model_version: BoundedVec::try_from(b"v1.0".to_vec()).unwrap(),
	}
}

#[test]
fn create_ai_strategy_works() {
	new_test_ext().execute_with(|| {
		// 准备测试数据
		let account_id = 1;
		let name = b"Test Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = get_test_ai_config();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		// 创建策略
		assert_ok!(AIStrategy::create_ai_strategy(
			RuntimeOrigin::signed(account_id),
			name.clone(),
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		));

		// 验证策略已创建
		let strategy = AIStrategy::strategies(0).unwrap();
		assert_eq!(strategy.strategy_id, 0);
		assert_eq!(strategy.owner, account_id);
		assert_eq!(strategy.status, StrategyStatus::Active);

		// 验证NextStrategyId已增加
		assert_eq!(AIStrategy::next_strategy_id(), 1);

		// 验证用户策略列表
		let user_strategies = AIStrategy::user_strategies(account_id);
		assert_eq!(user_strategies.len(), 1);
		assert_eq!(user_strategies[0], 0);
	});
}

#[test]
fn create_strategy_with_low_confidence_threshold_fails() {
	new_test_ext().execute_with(|| {
		let account_id = 1;
		let name = b"Test Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		
		let mut ai_config = get_test_ai_config();
		ai_config.confidence_threshold = 40; // 低于最小值50
		
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		// 应该失败
		assert_noop!(
			AIStrategy::create_ai_strategy(
				RuntimeOrigin::signed(account_id),
				name,
				hl_address,
				symbol,
				ai_config,
				strategy_type,
				strategy_params,
				risk_limits,
			),
			Error::<Test>::ConfidenceThresholdTooLow
		);
	});
}

#[test]
fn toggle_strategy_works() {
	new_test_ext().execute_with(|| {
		// 先创建策略
		let account_id = 1;
		let name = b"Test Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = get_test_ai_config();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		assert_ok!(AIStrategy::create_ai_strategy(
			RuntimeOrigin::signed(account_id),
			name,
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		));

		let strategy_id = 0;

		// 暂停策略
		assert_ok!(AIStrategy::toggle_strategy(
			RuntimeOrigin::signed(account_id),
			strategy_id,
			false
		));

		let strategy = AIStrategy::strategies(strategy_id).unwrap();
		assert_eq!(strategy.status, StrategyStatus::Paused);

		// 重新启用
		assert_ok!(AIStrategy::toggle_strategy(
			RuntimeOrigin::signed(account_id),
			strategy_id,
			true
		));

		let strategy = AIStrategy::strategies(strategy_id).unwrap();
		assert_eq!(strategy.status, StrategyStatus::Active);
	});
}

#[test]
fn toggle_strategy_not_owner_fails() {
	new_test_ext().execute_with(|| {
		// 账户1创建策略
		let account_id = 1;
		let name = b"Test Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = get_test_ai_config();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		assert_ok!(AIStrategy::create_ai_strategy(
			RuntimeOrigin::signed(account_id),
			name,
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		));

		let strategy_id = 0;

		// 账户2尝试修改，应该失败
		assert_noop!(
			AIStrategy::toggle_strategy(RuntimeOrigin::signed(2), strategy_id, false),
			Error::<Test>::NotOwner
		);
	});
}

#[test]
fn update_ai_config_works() {
	new_test_ext().execute_with(|| {
		// 创建策略
		let account_id = 1;
		let name = b"Test Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = get_test_ai_config();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		assert_ok!(AIStrategy::create_ai_strategy(
			RuntimeOrigin::signed(account_id),
			name,
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		));

		let strategy_id = 0;

		// 更新AI配置
		let mut new_config = get_test_ai_config();
		new_config.primary_model = ModelType::GPT4;
		new_config.confidence_threshold = 70;

		assert_ok!(AIStrategy::update_ai_config(
			RuntimeOrigin::signed(account_id),
			strategy_id,
			new_config.clone()
		));

		let strategy = AIStrategy::strategies(strategy_id).unwrap();
		assert_eq!(strategy.ai_config.primary_model, ModelType::GPT4);
		assert_eq!(strategy.ai_config.confidence_threshold, 70);
	});
}

#[test]
fn remove_strategy_works() {
	new_test_ext().execute_with(|| {
		// 创建策略
		let account_id = 1;
		let name = b"Test Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = get_test_ai_config();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		assert_ok!(AIStrategy::create_ai_strategy(
			RuntimeOrigin::signed(account_id),
			name,
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		));

		let strategy_id = 0;

		// 删除策略
		assert_ok!(AIStrategy::remove_strategy(
			RuntimeOrigin::signed(account_id),
			strategy_id
		));

		// 验证策略已删除
		assert!(AIStrategy::strategies(strategy_id).is_none());

		// 验证用户策略列表已更新
		let user_strategies = AIStrategy::user_strategies(account_id);
		assert_eq!(user_strategies.len(), 0);
	});
}

#[test]
fn record_ai_signal_works() {
	new_test_ext().execute_with(|| {
		// 创建策略
		let account_id = 1;
		let name = b"Test Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = get_test_ai_config();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		assert_ok!(AIStrategy::create_ai_strategy(
			RuntimeOrigin::signed(account_id),
			name,
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		));

		let strategy_id = 0;

		// 创建AI信号
		let signal = AISignalRecord {
			signal_id: 0,
			strategy_id,
			timestamp: 1000,
			signal: TradeSignal::Buy,
			confidence: 75,
			reasoning_cid: BoundedVec::try_from(b"QmTest123".to_vec()).unwrap(),
			position_size: 1000_000_000,
			entry_price: 43_250_000_000,
			stop_loss: Some(42_500_000_000),
			take_profit: Some(45_000_000_000),
			feature_importance_cid: BoundedVec::try_from(b"QmFeatures123".to_vec()).unwrap(),
			risk_score: 35,
			market_condition: MarketCondition::Bullish,
			executed: false,
			execution_result: None,
		};

		// 记录信号（无签名交易）
		assert_ok!(AIStrategy::record_ai_signal(
			RuntimeOrigin::none(),
			strategy_id,
			signal
		));

		// 验证信号已记录
		let recorded_signal = AIStrategy::signal_records(strategy_id, 0).unwrap();
		assert_eq!(recorded_signal.signal, TradeSignal::Buy);
		assert_eq!(recorded_signal.confidence, 75);

		// 验证信号列表
		let signal_ids = AIStrategy::strategy_signals(strategy_id);
		assert_eq!(signal_ids.len(), 1);
		assert_eq!(signal_ids[0], 0);
	});
}

#[test]
fn get_active_strategies_works() {
	new_test_ext().execute_with(|| {
		let account_id = 1;
		let ai_config = get_test_ai_config();
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();

		// 创建3个策略
		for i in 0..3 {
			let name = format!("Strategy {}", i).into_bytes();
			let hl_address = b"0x1234567890abcdef".to_vec();
			let symbol = b"BTC-USD".to_vec();

			assert_ok!(AIStrategy::create_ai_strategy(
				RuntimeOrigin::signed(account_id),
				name,
				hl_address,
				symbol,
				ai_config.clone(),
				StrategyType::Grid,
				strategy_params.clone(),
				risk_limits.clone(),
			));
		}

		// 暂停第二个策略
		assert_ok!(AIStrategy::toggle_strategy(
			RuntimeOrigin::signed(account_id),
			1,
			false
		));

		// 获取活跃策略
		let active_strategies = AIStrategy::get_active_strategies();
		assert_eq!(active_strategies.len(), 2);
		assert_eq!(active_strategies[0].strategy_id, 0);
		assert_eq!(active_strategies[1].strategy_id, 2);
	});
}

