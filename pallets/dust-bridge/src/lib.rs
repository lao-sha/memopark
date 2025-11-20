#![cfg_attr(not(feature = "std"), no_std)]

//! # DUST Bridge Pallet（DUST 跨链桥接模块）
//!
//! ## 概述
//!
//! 本模块实现 Stardust 链原生 DUST 与 Arbitrum ERC20 DUST 的跨链桥接服务。
//!
//! ## 架构
//!
//! ### 锁定-铸造模型（Lock & Mint）
//!
//! **正向流程**（Stardust → Arbitrum）：
//! 1. 用户在 Stardust 链锁定原生 DUST 到桥接账户
//! 2. 触发 `BridgeRequested` 事件
//! 3. OCW 监听事件，调用 Arbitrum 合约铸造 ERC20 DUST
//! 4. 更新桥接状态为 `Completed`
//!
//! **反向流程**（Arbitrum → Stardust）：
//! 1. 用户在 Arbitrum 销毁 ERC20 DUST
//! 2. 触发 `BridgeBack` 事件
//! 3. OCW 监听事件，调用 Substrate 解锁原生 DUST
//! 4. DUST 从桥接账户转回用户
//!
//! ## 安全机制
//!
//! - **桥接账户**：多签账户，需要 M/N 成员签名才能动用资金
//! - **防重放**：记录已处理的 Arbitrum 交易哈希
//! - **金额限制**：设置最小/最大桥接金额
//! - **超时保护**：桥接请求超时后可取消并退款
//!
//! ## 版本历史
//!
//! - v0.1.0 (2025-11-05): 初始版本，支持锁定-铸造桥接

pub use pallet::*;

pub mod types;
pub use types::*;

pub mod ocw;

pub mod governance;
pub use governance::*;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
	use super::*;
	use frame_support::{
		pallet_prelude::*,
		traits::{Currency, ExistenceRequirement, Get, ReservableCurrency},
		BoundedVec,
	};
	use frame_system::pallet_prelude::*;

	/// 函数级详细中文注释：Balance 类型别名
	pub type BalanceOf<T> =
		<<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// 函数级详细中文注释：DUST Bridge 模块配置 trait
	#[pallet::config]
	pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
		/// 货币类型（DUST）
		type Currency: Currency<Self::AccountId>
			+ ReservableCurrency<Self::AccountId>;

		/// 治理权限（用于设置桥接账户等管理操作）
		type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// 最小桥接金额（防止粉尘攻击）
		#[pallet::constant]
		type MinBridgeAmount: Get<BalanceOf<Self>>;

		/// 最大桥接金额（风险控制）
		#[pallet::constant]
		type MaxBridgeAmount: Get<BalanceOf<Self>>;

		/// 桥接超时时间（区块数）
		#[pallet::constant]
		type BridgeTimeout: Get<BlockNumberFor<Self>>;
	}

	// ===== 存储 =====

	/// 函数级详细中文注释：下一个桥接 ID
	#[pallet::storage]
	#[pallet::getter(fn next_bridge_id)]
	pub type NextBridgeId<T> = StorageValue<_, u64, ValueQuery>;

	/// 函数级详细中文注释：桥接锁定账户
	/// 
	/// ## 安全要求
	/// 此账户必须是多签账户，例如 5/3 多签（5个成员中需要至少3个签名）
	#[pallet::storage]
	#[pallet::getter(fn bridge_lock_account)]
	pub type BridgeLockAccount<T: Config> = StorageValue<_, T::AccountId>;

	/// 函数级详细中文注释：桥接请求记录
	#[pallet::storage]
	#[pallet::getter(fn bridge_requests)]
	pub type BridgeRequests<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64, // bridge_id
		BridgeRequest<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
	>;

	/// 函数级详细中文注释：用户桥接列表
	#[pallet::storage]
	#[pallet::getter(fn user_bridges)]
	pub type UserBridges<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<u64, ConstU32<100>>, // 每个用户最多100个桥接请求
		ValueQuery,
	>;

	/// 函数级详细中文注释：已处理的 Arbitrum 交易哈希（防止重放攻击）
	/// 
	/// ## 安全机制
	/// 当 OCW 处理 Arbitrum → Stardust 桥接时，记录已处理的交易哈希
	/// 防止同一笔 Arbitrum 交易被重复处理
	#[pallet::storage]
	#[pallet::getter(fn processed_arbitrum_txs)]
	pub type ProcessedArbitrumTxs<T: Config> =
		StorageMap<_, Blake2_128Concat, EthTxHash, ()>;

	/// 函数级详细中文注释：Arbitrum 桥接合约地址
	/// 
	/// ## 配置说明
	/// 由治理设置，指向部署在 Arbitrum 上的 DUSTBridge 合约地址
	#[pallet::storage]
	#[pallet::getter(fn arbitrum_bridge_address)]
	pub type ArbitrumBridgeAddress<T: Config> = StorageValue<_, EthAddress>;

	/// 函数级详细中文注释：桥接是否暂停
	#[pallet::storage]
	#[pallet::getter(fn bridge_paused)]
	pub type BridgePaused<T: Config> = StorageValue<_, bool, ValueQuery>;

	/// 函数级详细中文注释：下一个提案 ID
	#[pallet::storage]
	#[pallet::getter(fn next_proposal_id)]
	pub type NextProposalId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// 函数级详细中文注释：治理提案记录
	#[pallet::storage]
	#[pallet::getter(fn proposals)]
	pub type Proposals<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64, // proposal_id
		governance::GovernanceProposal<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
	>;

	/// 函数级详细中文注释：投票记录
	#[pallet::storage]
	#[pallet::getter(fn votes)]
	pub type Votes<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		u64,           // proposal_id
		Blake2_128Concat,
		T::AccountId,  // voter
		governance::VoteRecord<T::AccountId, BalanceOf<T>>,
	>;

	/// 函数级详细中文注释：治理配置
	#[pallet::storage]
	#[pallet::getter(fn governance_config)]
	pub type GovernanceConfigStorage<T: Config> = StorageValue<_, governance::GovernanceConfig, ValueQuery>;

	/// 函数级详细中文注释：下一个审计 ID
	#[pallet::storage]
	#[pallet::getter(fn next_audit_id)]
	pub type NextAuditId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// 函数级详细中文注释：审计日志
	#[pallet::storage]
	#[pallet::getter(fn audit_logs)]
	pub type AuditLogs<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64, // audit_id
		governance::AuditRecord<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
	>;

	// ===== 事件 =====

	/// 函数级详细中文注释：DUST Bridge 模块事件
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 桥接请求已创建（Stardust → Arbitrum）
		BridgeRequested {
			bridge_id: u64,
			user: T::AccountId,
			amount: BalanceOf<T>,
			target_address: EthAddress,
		},
		/// 桥接已完成（OCW 已铸造 ERC20 DUST）
		BridgeCompleted {
			bridge_id: u64,
			arbitrum_tx_hash: EthTxHash,
		},
		/// 桥接失败
		BridgeFailed { bridge_id: u64, reason: BoundedVec<u8, ConstU32<128>> },
		/// DUST 已解锁（Arbitrum → Stardust）
		BridgeUnlocked {
			arbitrum_tx_hash: EthTxHash,
			user: T::AccountId,
			amount: BalanceOf<T>,
		},
		/// 桥接账户已设置
		BridgeLockAccountSet { account: T::AccountId },
	/// Arbitrum 桥接合约地址已设置
	ArbitrumBridgeAddressSet { address: EthAddress },
	/// 治理提案已创建
	ProposalCreated {
		proposal_id: u64,
		proposer: T::AccountId,
		proposal_type: governance::ProposalType,
	},
	/// 已投票
	Voted {
		proposal_id: u64,
		voter: T::AccountId,
		vote: governance::VoteOption,
		weight: BalanceOf<T>,
	},
	/// 提案已执行
	ProposalExecuted { proposal_id: u64 },
	/// 提案已拒绝
	ProposalRejected { proposal_id: u64 },
	/// 桥接已暂停
	BridgePaused,
	/// 桥接已恢复
	BridgeResumed,
	/// 限制已调整
	LimitsAdjusted {
		min_amount: BalanceOf<T>,
		max_amount: BalanceOf<T>,
	},
	/// 资金已提取
	FundsWithdrawn { to: T::AccountId, amount: BalanceOf<T> },
}

	// ===== 错误 =====

	/// 函数级详细中文注释：DUST Bridge 模块错误
	#[pallet::error]
	pub enum Error<T> {
		/// 金额低于最小值
		BelowMinimumAmount,
		/// 金额超过最大值
		AboveMaximumAmount,
		/// 以太坊地址无效
		InvalidEthAddress,
		/// 交易哈希无效
		InvalidTxHash,
		/// 桥接账户未设置
		BridgeAccountNotSet,
		/// 桥接不存在
		BridgeNotFound,
		/// 桥接状态不正确
		InvalidBridgeStatus,
		/// 未授权
		NotAuthorized,
		/// 交易已处理（防重放）
		TxAlreadyProcessed,
		/// 桥接列表已满
		TooManyBridges,
		/// Arbitrum 桥接合约地址未设置
		ArbitrumBridgeAddressNotSet,
	/// 桥接超时
	BridgeTimeout,
	/// 提案不存在
	ProposalNotFound,
	/// 提案未激活
	ProposalNotActive,
	/// 投票已过期
	VotingExpired,
	/// 已投票
	AlreadyVoted,
	/// 提案状态不正确
	InvalidProposalStatus,
	/// 投票未结束
	VotingNotEnded,
	/// 投票率不足
	InsufficientTurnout,
	/// 金额无效
	InvalidAmount,
	/// 余额不足
	InsufficientBalance,
	/// 参数无效
	InvalidParams,
	/// 桥接已暂停
	BridgePaused,
}

	// ===== Extrinsics =====

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 函数级详细中文注释：桥接到 Arbitrum
		///
		/// ## 功能说明
		/// 1. 验证金额在最小/最大值之间
		/// 2. 验证以太坊地址格式
		/// 3. 锁定 DUST 到桥接账户
		/// 4. 创建桥接请求
		/// 5. 触发 BridgeRequested 事件（OCW 监听此事件）
		///
		/// ## 参数
		/// - `origin`: 调用者（用户）
		/// - `amount`: DUST 数量
		/// - `eth_address`: Arbitrum 接收地址（0x开头的42字节十六进制字符串）
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 各种错误情况
		#[pallet::call_index(0)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn bridge_to_arbitrum(
			origin: OriginFor<T>,
			amount: BalanceOf<T>,
			eth_address: sp_std::vec::Vec<u8>,
		) -> DispatchResult {
			let user = ensure_signed(origin)?;

			// 0. 检查桥接是否暂停
			ensure!(!BridgePaused::<T>::get(), Error::<T>::BridgePaused);

			// 1. 验证金额范围
			ensure!(amount >= T::MinBridgeAmount::get(), Error::<T>::BelowMinimumAmount);
			ensure!(amount <= T::MaxBridgeAmount::get(), Error::<T>::AboveMaximumAmount);

			// 2. 验证以太坊地址格式（42字节：0x + 40个十六进制字符）
			let target_addr: EthAddress =
				eth_address.try_into().map_err(|_| Error::<T>::InvalidEthAddress)?;

			// 3. 锁定 DUST 到桥接账户
			let bridge_account =
				BridgeLockAccount::<T>::get().ok_or(Error::<T>::BridgeAccountNotSet)?;

			T::Currency::transfer(
				&user,
				&bridge_account,
				amount,
				ExistenceRequirement::KeepAlive,
			)?;

			// 4. 创建桥接请求
			let bridge_id = NextBridgeId::<T>::get();
			let request = BridgeRequest {
				id: bridge_id,
				user: user.clone(),
				amount,
				target_address: target_addr.clone(),
				status: BridgeStatus::Pending,
				created_at: frame_system::Pallet::<T>::block_number(),
				arbitrum_tx_hash: None,
			};

			BridgeRequests::<T>::insert(bridge_id, request);
			NextBridgeId::<T>::put(bridge_id + 1);

			// 5. 更新用户桥接列表
			UserBridges::<T>::try_mutate(&user, |bridges| {
				bridges.try_push(bridge_id).map_err(|_| Error::<T>::TooManyBridges)
			})?;

			// 6. 触发事件（OCW 监听此事件）
			Self::deposit_event(Event::BridgeRequested {
				bridge_id,
				user,
				amount,
				target_address: target_addr,
			});

			Ok(())
		}

		/// 函数级详细中文注释：从 Arbitrum 解锁 DUST
		///
		/// ## 功能说明
		/// 1. 验证 Arbitrum 交易哈希
		/// 2. 防止重放攻击（检查是否已处理）
		/// 3. 从桥接账户转账给用户
		/// 4. 记录已处理的交易
		///
		/// ## 参数
		/// - `origin`: 调用者（无签名，由 OCW 调用）
		/// - `arbitrum_tx_hash`: Arbitrum 交易哈希
		/// - `substrate_address`: Substrate 接收地址
		/// - `amount`: DUST 数量
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 各种错误情况
		#[pallet::call_index(1)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn unlock_from_arbitrum(
			origin: OriginFor<T>,
			arbitrum_tx_hash: sp_std::vec::Vec<u8>,
			substrate_address: T::AccountId,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			// 验证调用者（无签名交易，由 OCW 提交）
			ensure_none(origin)?;

			// 1. 验证交易哈希格式
			let tx_hash: EthTxHash =
				arbitrum_tx_hash.try_into().map_err(|_| Error::<T>::InvalidTxHash)?;

			// 2. 防止重放攻击：检查是否已处理
			ensure!(
				!ProcessedArbitrumTxs::<T>::contains_key(&tx_hash),
				Error::<T>::TxAlreadyProcessed
			);

			// 3. 从桥接账户转账给用户
			let bridge_account =
				BridgeLockAccount::<T>::get().ok_or(Error::<T>::BridgeAccountNotSet)?;

			T::Currency::transfer(
				&bridge_account,
				&substrate_address,
				amount,
				ExistenceRequirement::AllowDeath,
			)?;

			// 4. 记录已处理的交易
			ProcessedArbitrumTxs::<T>::insert(&tx_hash, ());

			// 5. 触发事件
			Self::deposit_event(Event::BridgeUnlocked {
				arbitrum_tx_hash: tx_hash,
				user: substrate_address,
				amount,
			});

			Ok(())
		}

		/// 函数级详细中文注释：设置桥接账户（治理功能）
		///
		/// ## 功能说明
		/// 设置用于锁定 DUST 的桥接账户
		///
		/// ## 参数
		/// - `origin`: 调用者（必须是治理权限）
		/// - `account`: 桥接账户（建议使用多签账户）
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 未授权
		#[pallet::call_index(2)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn set_bridge_lock_account(
			origin: OriginFor<T>,
			account: T::AccountId,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			BridgeLockAccount::<T>::put(account.clone());
			Self::deposit_event(Event::BridgeLockAccountSet { account });

			Ok(())
		}

		/// 函数级详细中文注释：设置 Arbitrum 桥接合约地址（治理功能）
		///
		/// ## 功能说明
		/// 设置部署在 Arbitrum 上的 DUSTBridge 合约地址
		///
		/// ## 参数
		/// - `origin`: 调用者（必须是治理权限）
		/// - `address`: Arbitrum 合约地址（0x开头的42字节十六进制字符串）
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 未授权或地址无效
		#[pallet::call_index(3)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn set_arbitrum_bridge_address(
			origin: OriginFor<T>,
			address: sp_std::vec::Vec<u8>,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			let eth_addr: EthAddress =
				address.try_into().map_err(|_| Error::<T>::InvalidEthAddress)?;

			ArbitrumBridgeAddress::<T>::put(eth_addr.clone());
			Self::deposit_event(Event::ArbitrumBridgeAddressSet { address: eth_addr });

			Ok(())
		}

		/// 函数级详细中文注释：OCW 更新桥接状态
		///
		/// ## 功能说明
		/// OCW 调用 Arbitrum 合约后，更新桥接状态
		///
		/// ## 参数
		/// - `origin`: 调用者（无签名，由 OCW 调用）
		/// - `bridge_id`: 桥接 ID
		/// - `status`: 新状态
		/// - `arbitrum_tx_hash`: Arbitrum 交易哈希（可选）
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 各种错误情况
		#[pallet::call_index(4)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn ocw_update_bridge_status(
			origin: OriginFor<T>,
			bridge_id: u64,
			status: BridgeStatus,
			arbitrum_tx_hash: Option<sp_std::vec::Vec<u8>>,
		) -> DispatchResult {
			// 验证调用者（无签名交易，由 OCW 提交）
			ensure_none(origin)?;

			// 获取桥接请求
			let mut request =
				BridgeRequests::<T>::get(bridge_id).ok_or(Error::<T>::BridgeNotFound)?;

			// 更新状态
			request.status = status.clone();

			// 如果提供了交易哈希，更新它
			if let Some(tx_hash_vec) = arbitrum_tx_hash {
				let tx_hash: EthTxHash =
					tx_hash_vec.try_into().map_err(|_| Error::<T>::InvalidTxHash)?;
				request.arbitrum_tx_hash = Some(tx_hash.clone());

				// 如果状态是完成，触发事件
				if status == BridgeStatus::Completed {
					Self::deposit_event(Event::BridgeCompleted {
						bridge_id,
						arbitrum_tx_hash: tx_hash,
					});
				}
			}

			// 保存更新
			BridgeRequests::<T>::insert(bridge_id, request);

			Ok(())
		}

		/// 函数级详细中文注释：创建治理提案
		///
		/// ## 功能说明
		/// 任何持有足够押金的用户都可以创建治理提案
		///
		/// ## 参数
		/// - `origin`: 调用者（用户）
		/// - `proposal_type`: 提案类型
		/// - `description_cid`: 提案描述 IPFS CID
		/// - `params`: 提案参数
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 各种错误情况
		#[pallet::call_index(5)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn create_proposal(
			origin: OriginFor<T>,
			proposal_type: governance::ProposalType,
			description_cid: sp_std::vec::Vec<u8>,
			params: sp_std::vec::Vec<u8>,
		) -> DispatchResult {
			let proposer = ensure_signed(origin)?;

			let description_cid_bounded: BoundedVec<u8, ConstU32<64>> =
				description_cid.try_into().map_err(|_| Error::<T>::InvalidParams)?;
			let params_bounded: BoundedVec<u8, ConstU32<256>> =
				params.try_into().map_err(|_| Error::<T>::InvalidParams)?;

			Self::do_create_proposal(&proposer, proposal_type, description_cid_bounded, params_bounded)?;

			Ok(())
		}

		/// 函数级详细中文注释：投票
		///
		/// ## 功能说明
		/// 持币用户可以对提案投票，投票权重与持币量成正比
		///
		/// ## 参数
		/// - `origin`: 调用者（用户）
		/// - `proposal_id`: 提案 ID
		/// - `vote`: 投票选项
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 各种错误情况
		#[pallet::call_index(6)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn vote(
			origin: OriginFor<T>,
			proposal_id: u64,
			vote: governance::VoteOption,
		) -> DispatchResult {
			let voter = ensure_signed(origin)?;
			Self::do_vote(&voter, proposal_id, vote)?;
			Ok(())
		}

		/// 函数级详细中文注释：执行提案
		///
		/// ## 功能说明
		/// 投票截止后，任何人都可以触发提案执行
		///
		/// ## 参数
		/// - `origin`: 调用者（任何人）
		/// - `proposal_id`: 提案 ID
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 各种错误情况
		#[pallet::call_index(7)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn execute_proposal(origin: OriginFor<T>, proposal_id: u64) -> DispatchResult {
			ensure_signed(origin)?;
			Self::do_execute_proposal(proposal_id)?;
			Ok(())
		}

		/// 函数级详细中文注释：设置治理配置（治理功能）
		///
		/// ## 功能说明
		/// 更新治理参数
		///
		/// ## 参数
		/// - `origin`: 调用者（必须是治理权限）
		/// - `config`: 新的治理配置
		///
		/// ## 返回
		/// - `Ok(())`: 成功
		/// - `Err(...)`: 未授权
		#[pallet::call_index(8)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn set_governance_config(
			origin: OriginFor<T>,
			config: governance::GovernanceConfig,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;
			GovernanceConfigStorage::<T>::put(config);
			Ok(())
		}
	}

	// ===== 公共查询接口 =====

	impl<T: Config> Pallet<T> {
		/// 函数级详细中文注释：获取用户桥接列表
		pub fn get_user_bridges(who: &T::AccountId) -> sp_std::vec::Vec<u64> {
			UserBridges::<T>::get(who).to_vec()
		}

		/// 函数级详细中文注释：检查交易是否已处理
		pub fn is_tx_processed(tx_hash: &EthTxHash) -> bool {
			ProcessedArbitrumTxs::<T>::contains_key(tx_hash)
		}
	}

	// ===== Hooks =====

	#[pallet::hooks]
	impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
		/// 函数级详细中文注释：OCW 入口函数
		///
		/// ## 功能说明
		/// 每个区块执行一次，负责：
		/// 1. 处理待处理的桥接请求（Stardust → Arbitrum）
		/// 2. 监听 Arbitrum 事件（Arbitrum → Stardust）
		fn offchain_worker(_block_number: BlockNumberFor<T>) {
			sp_runtime::print("🌉 DUST Bridge OCW 开始执行");

			// 处理待处理的桥接请求
			if let Err(_e) = Self::process_pending_bridges() {
				sp_runtime::print("❌ 处理桥接请求失败");
			}

			// 监听 Arbitrum 事件
			if let Err(_e) = Self::process_arbitrum_events() {
				sp_runtime::print("❌ 处理 Arbitrum 事件失败");
			}
		}
	}
}

