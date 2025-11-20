//! AI策略Pallet的基准测试

#![cfg(feature = "runtime-benchmarks")]

use super::*;
use crate::Pallet as AIStrategy;
use frame_benchmarking::{benchmarks, whitelisted_caller};
use frame_system::RawOrigin;

benchmarks! {
	create_ai_strategy {
		let caller: T::AccountId = whitelisted_caller();
		let name = b"Benchmark Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = AIModelConfig::default();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();
	}: _(
		RawOrigin::Signed(caller),
		name,
		hl_address,
		symbol,
		ai_config,
		strategy_type,
		strategy_params,
		risk_limits
	)

	toggle_strategy {
		let caller: T::AccountId = whitelisted_caller();
		// 首先创建一个策略
		let name = b"Benchmark Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = AIModelConfig::default();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();
		
		AIStrategy::<T>::create_ai_strategy(
			RawOrigin::Signed(caller.clone()).into(),
			name,
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		)?;
		
		let strategy_id = 0u64;
	}: _(RawOrigin::Signed(caller), strategy_id, false)

	update_ai_config {
		let caller: T::AccountId = whitelisted_caller();
		// 创建策略
		let name = b"Benchmark Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = AIModelConfig::default();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();
		
		AIStrategy::<T>::create_ai_strategy(
			RawOrigin::Signed(caller.clone()).into(),
			name,
			hl_address,
			symbol,
			ai_config.clone(),
			strategy_type,
			strategy_params,
			risk_limits,
		)?;
		
		let strategy_id = 0u64;
	}: _(RawOrigin::Signed(caller), strategy_id, ai_config)

	remove_strategy {
		let caller: T::AccountId = whitelisted_caller();
		// 创建策略
		let name = b"Benchmark Strategy".to_vec();
		let hl_address = b"0x1234567890abcdef1234567890abcdef".to_vec();
		let symbol = b"BTC-USD".to_vec();
		let ai_config = AIModelConfig::default();
		let strategy_type = StrategyType::Grid;
		let strategy_params = StrategyParams::default();
		let risk_limits = RiskLimits::default();
		
		AIStrategy::<T>::create_ai_strategy(
			RawOrigin::Signed(caller.clone()).into(),
			name,
			hl_address,
			symbol,
			ai_config,
			strategy_type,
			strategy_params,
			risk_limits,
		)?;
		
		let strategy_id = 0u64;
	}: _(RawOrigin::Signed(caller), strategy_id)

	impl_benchmark_test_suite!(AIStrategy, crate::mock::new_test_ext(), crate::mock::Test);
}

