//! # AI策略管理Pallet
//!
//! 本Pallet实现AI驱动的交易策略管理，包括：
//! - 策略配置和生命周期管理
//! - AI模型配置
//! - AI信号历史记录
//! - 策略表现指标跟踪
//!
//! ## 概述
//!
//! 本Pallet允许用户创建和管理AI增强的交易策略，OCW会定期调用AI推理服务
//! 生成交易信号，并在Hyperliquid DEX上执行交易。

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod types;
pub mod weights;
pub mod ocw;  // 🆕 OCW模块
pub mod hyperliquid;  // 🆕 Hyperliquid DEX集成
pub mod deepseek;  // 🆕 DeepSeek AI集成

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;
use frame_system::offchain::AppCrypto;
use sp_std::vec::Vec;

pub use types::*;
pub use weights::WeightInfo;

#[frame_support::pallet]
pub mod pallet {
	use super::*;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// 配置接口
	#[pallet::config]
	pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> + pallet_timestamp::Config {

		/// 权重信息
		type WeightInfo: WeightInfo;
		
		/// OCW授权ID
		type AuthorityId: AppCrypto<sp_runtime::MultiSigner, sp_runtime::MultiSignature>;

		/// 最大策略名称长度
		#[pallet::constant]
		type MaxNameLength: Get<u32>;

		/// 最大交易对符号长度
		#[pallet::constant]
		type MaxSymbolLength: Get<u32>;

		/// 最大CID长度
		#[pallet::constant]
		type MaxCIDLength: Get<u32>;

		/// 最大特征数量
		#[pallet::constant]
		type MaxFeatures: Get<u32>;

		/// 最大推理端点URL长度
		#[pallet::constant]
		type MaxEndpointLength: Get<u32>;
	}

	// ===== 存储项 =====

	/// 下一个策略ID
	#[pallet::storage]
	#[pallet::getter(fn next_strategy_id)]
	pub type NextStrategyId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// AI交易策略存储
	/// 映射：策略ID => AITradingStrategy
	#[pallet::storage]
	#[pallet::getter(fn strategies)]
	pub type AIStrategies<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64, // strategy_id
		AITradingStrategy<T::AccountId, T::Moment>,
		OptionQuery,
	>;

	/// 用户拥有的策略列表
	/// 映射：账户 => Vec<策略ID>
	#[pallet::storage]
	#[pallet::getter(fn user_strategies)]
	pub type UserStrategies<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<u64, ConstU32<100>>, // 最多100个策略
		ValueQuery,
	>;

	/// 下一个信号ID
	#[pallet::storage]
	#[pallet::getter(fn next_signal_id)]
	pub type NextSignalId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// AI信号历史记录
	/// 双重映射：策略ID => 信号ID => AISignalRecord
	#[pallet::storage]
	#[pallet::getter(fn signal_records)]
	pub type AISignalHistory<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		u64, // strategy_id
		Blake2_128Concat,
		u64, // signal_id
		AISignalRecord<T::Moment>,
		OptionQuery,
	>;

	/// 策略的信号ID列表（用于查询）
	#[pallet::storage]
	#[pallet::getter(fn strategy_signals)]
	pub type StrategySignals<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64, // strategy_id
		BoundedVec<u64, ConstU32<1000>>, // 最多保存最近1000条信号
		ValueQuery,
	>;

	// ===== Hooks =====
	
	/// 函数级中文注释：Pallet Hooks
	/// 
	/// 实现链下工作者(OCW)，在每个区块执行时调用AI推理服务
	#[pallet::hooks]
	impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
		/// OCW执行入口
		/// 
		/// 每个区块都会执行，但我们只在特定区块（每10块）实际处理策略
		fn offchain_worker(block_number: BlockNumberFor<T>) {
			log::info!("🤖 OCW started at block {:?}", block_number);
			
			// 委托给OCW模块处理
			Self::offchain_worker(block_number);
		}
	}

	// ===== 事件 =====

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// AI策略已创建
		/// [strategy_id, owner, ai_model, strategy_type]
		AIStrategyCreated {
			strategy_id: u64,
			owner: T::AccountId,
			ai_model: ModelType,
			strategy_type: StrategyType,
		},

		/// 策略状态已更新
		/// [strategy_id, new_status]
		StrategyStatusUpdated {
			strategy_id: u64,
			status: StrategyStatus,
		},

		/// AI配置已更新
		/// [strategy_id, new_model]
		AIConfigUpdated {
			strategy_id: u64,
			new_model: ModelType,
		},

		/// AI信号已生成
		/// [strategy_id, signal_id, signal, confidence]
		AISignalGenerated {
			strategy_id: u64,
			signal_id: u64,
			signal: TradeSignal,
			confidence: u8,
		},

		/// 交易已执行
		/// [strategy_id, signal_id, order_id]
		TradeExecuted {
			strategy_id: u64,
			signal_id: u64,
			order_id: BoundedVec<u8, ConstU32<64>>,
		},

		/// 策略表现已更新
		/// [strategy_id, total_pnl]
		PerformanceUpdated {
			strategy_id: u64,
			total_pnl: i128,
		},

		/// 策略已删除
		/// [strategy_id]
		StrategyRemoved { strategy_id: u64 },
	}

	// ===== 错误 =====

	#[pallet::error]
	pub enum Error<T> {
		/// 策略不存在
		StrategyNotFound,
		/// 无权限
		NotOwner,
		/// 策略未激活
		StrategyNotActive,
		/// 无效的名称
		InvalidName,
		/// 无效的地址
		InvalidAddress,
		/// 无效的交易对符号
		InvalidSymbol,
		/// 无效的推理端点
		InvalidEndpoint,
		/// 置信度阈值过低
		ConfidenceThresholdTooLow,
		/// 策略数量超限
		TooManyStrategies,
		/// 信号不存在
		SignalNotFound,
		/// 信号历史已满
		SignalHistoryFull,
	}

	// ===== 可调用函数 =====

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 创建AI增强的交易策略
		///
		/// 参数:
		/// - `origin`: 交易发起者
		/// - `name`: 策略名称
		/// - `hl_address`: Hyperliquid账户地址
		/// - `symbol`: 交易对符号 (如 "BTC-USD")
		/// - `ai_config`: AI模型配置
		/// - `strategy_type`: 策略类型
		/// - `strategy_params`: 策略参数
		/// - `risk_limits`: 风控参数
		///
		/// 事件: `AIStrategyCreated`
		#[pallet::call_index(0)]
		#[pallet::weight(<T as Config>::WeightInfo::create_ai_strategy())]
		pub fn create_ai_strategy(
			origin: OriginFor<T>,
			name: Vec<u8>,
			hl_address: Vec<u8>,
			symbol: Vec<u8>,
			ai_config: AIModelConfig,
			strategy_type: StrategyType,
			strategy_params: StrategyParams,
			risk_limits: RiskLimits,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 1. 验证参数
			ensure!(
				ai_config.confidence_threshold >= 50,
				Error::<T>::ConfidenceThresholdTooLow
			);

			let name_bounded: BoundedVec<u8, ConstU32<64>> =
				name.try_into().map_err(|_| Error::<T>::InvalidName)?;

			let hl_address_bounded: BoundedVec<u8, ConstU32<42>> =
				hl_address.try_into().map_err(|_| Error::<T>::InvalidAddress)?;

			let symbol_bounded: BoundedVec<u8, ConstU32<32>> =
				symbol.try_into().map_err(|_| Error::<T>::InvalidSymbol)?;

			// 2. 生成策略ID
			let strategy_id = NextStrategyId::<T>::get();
			NextStrategyId::<T>::put(strategy_id.saturating_add(1));

			// 3. 创建策略
			let now = pallet_timestamp::Pallet::<T>::get();
			let strategy = AITradingStrategy {
				strategy_id,
				owner: who.clone(),
				name: name_bounded,
				description_cid: BoundedVec::default(),
				hl_address: hl_address_bounded,
				symbol: symbol_bounded,
				ai_config,
				strategy_type,
				strategy_params,
				risk_limits,
				ai_risk_enabled: true,
				execution_config: ExecutionConfig::default(),
				status: StrategyStatus::Active,
				performance: PerformanceMetrics::default(),
				created_at: now,
				last_executed_at: None,
			};

			// 4. 存储策略
			AIStrategies::<T>::insert(strategy_id, strategy.clone());

			// 5. 更新用户策略列表
			UserStrategies::<T>::try_mutate(&who, |strategies| {
				strategies
					.try_push(strategy_id)
					.map_err(|_| Error::<T>::TooManyStrategies)
			})?;

			// 6. 发出事件
			Self::deposit_event(Event::AIStrategyCreated {
				strategy_id,
				owner: who,
				ai_model: strategy.ai_config.primary_model,
				strategy_type: strategy.strategy_type,
			});

			Ok(())
		}

		/// 切换策略状态（启用/暂停）
		///
		/// 参数:
		/// - `origin`: 交易发起者
		/// - `strategy_id`: 策略ID
		/// - `enabled`: true=启用, false=暂停
		///
		/// 事件: `StrategyStatusUpdated`
		#[pallet::call_index(1)]
		#[pallet::weight(<T as Config>::WeightInfo::toggle_strategy())]
		pub fn toggle_strategy(
			origin: OriginFor<T>,
			strategy_id: u64,
			enabled: bool,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			AIStrategies::<T>::try_mutate(strategy_id, |strategy_opt| {
				let strategy = strategy_opt.as_mut().ok_or(Error::<T>::StrategyNotFound)?;
				ensure!(strategy.owner == who, Error::<T>::NotOwner);

				strategy.status = if enabled {
					StrategyStatus::Active
				} else {
					StrategyStatus::Paused
				};

				Self::deposit_event(Event::StrategyStatusUpdated {
					strategy_id,
					status: strategy.status,
				});

				Ok(())
			})
		}

		/// 更新AI模型配置
		///
		/// 参数:
		/// - `origin`: 交易发起者
		/// - `strategy_id`: 策略ID
		/// - `new_config`: 新的AI配置
		///
		/// 事件: `AIConfigUpdated`
		#[pallet::call_index(2)]
		#[pallet::weight(<T as Config>::WeightInfo::update_ai_config())]
		pub fn update_ai_config(
			origin: OriginFor<T>,
			strategy_id: u64,
			new_config: AIModelConfig,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			AIStrategies::<T>::try_mutate(strategy_id, |strategy_opt| {
				let strategy = strategy_opt.as_mut().ok_or(Error::<T>::StrategyNotFound)?;
				ensure!(strategy.owner == who, Error::<T>::NotOwner);

				strategy.ai_config = new_config.clone();

				Self::deposit_event(Event::AIConfigUpdated {
					strategy_id,
					new_model: new_config.primary_model,
				});

				Ok(())
			})
		}

		/// 删除策略
		///
		/// 参数:
		/// - `origin`: 交易发起者
		/// - `strategy_id`: 策略ID
		///
		/// 事件: `StrategyRemoved`
		#[pallet::call_index(3)]
		#[pallet::weight(<T as Config>::WeightInfo::remove_strategy())]
		pub fn remove_strategy(origin: OriginFor<T>, strategy_id: u64) -> DispatchResult {
			let who = ensure_signed(origin)?;

			let strategy = AIStrategies::<T>::get(strategy_id)
				.ok_or(Error::<T>::StrategyNotFound)?;
			
			ensure!(strategy.owner == who, Error::<T>::NotOwner);

			// 删除策略
			AIStrategies::<T>::remove(strategy_id);

			// 从用户列表中移除
			UserStrategies::<T>::mutate(&who, |strategies| {
				strategies.retain(|&id| id != strategy_id);
			});

			Self::deposit_event(Event::StrategyRemoved { strategy_id });

			Ok(())
		}

		/// 记录AI信号（由OCW调用，无签名交易）
		///
		/// 参数:
		/// - `origin`: None (无签名)
		/// - `strategy_id`: 策略ID
		/// - `signal`: AI信号记录
		///
		/// 事件: `AISignalGenerated`
		#[pallet::call_index(4)]
		#[pallet::weight(<T as Config>::WeightInfo::record_ai_signal())]
		pub fn record_ai_signal(
			origin: OriginFor<T>,
			strategy_id: u64,
			signal: AISignalRecord<T::Moment>,
		) -> DispatchResult {
			ensure_none(origin)?;

			// 验证策略存在
			ensure!(
				AIStrategies::<T>::contains_key(strategy_id),
				Error::<T>::StrategyNotFound
			);

			// 生成信号ID
			let signal_id = NextSignalId::<T>::get();
			NextSignalId::<T>::put(signal_id.saturating_add(1));

			// 存储信号
			let mut signal_with_id = signal.clone();
			signal_with_id.signal_id = signal_id;
			signal_with_id.strategy_id = strategy_id;

			AISignalHistory::<T>::insert(strategy_id, signal_id, signal_with_id.clone());

			// 更新信号列表
			StrategySignals::<T>::try_mutate(strategy_id, |signals| {
				// 如果列表满了，删除最旧的
				if signals.len() >= 1000 {
					signals.remove(0);
				}
				signals
					.try_push(signal_id)
					.map_err(|_| Error::<T>::SignalHistoryFull)
			})?;

			Self::deposit_event(Event::AISignalGenerated {
				strategy_id,
				signal_id,
				signal: signal_with_id.signal,
				confidence: signal_with_id.confidence,
			});

			Ok(())
		}
	}

	// ===== 辅助函数 =====

	impl<T: Config> Pallet<T> {
		/// 获取活跃的策略列表（供OCW使用）
		pub fn get_active_strategies() -> Vec<AITradingStrategy<T::AccountId, T::Moment>> {
			AIStrategies::<T>::iter()
				.filter(|(_, strategy)| strategy.status == StrategyStatus::Active)
				.map(|(_, strategy)| strategy)
				.collect()
		}

		/// 获取用户的策略列表
		pub fn get_user_strategies(
			account: &T::AccountId,
		) -> Vec<AITradingStrategy<T::AccountId, T::Moment>> {
			UserStrategies::<T>::get(account)
				.iter()
				.filter_map(|&id| AIStrategies::<T>::get(id))
				.collect()
		}

		/// 获取策略的最近N条信号
		pub fn get_recent_signals(
			strategy_id: u64,
			limit: u32,
		) -> Vec<AISignalRecord<T::Moment>> {
			let signal_ids = StrategySignals::<T>::get(strategy_id);
			let start = signal_ids.len().saturating_sub(limit as usize);
			
			signal_ids
				.iter()
				.skip(start)
				.filter_map(|&signal_id| AISignalHistory::<T>::get(strategy_id, signal_id))
				.collect()
		}
	}
}

