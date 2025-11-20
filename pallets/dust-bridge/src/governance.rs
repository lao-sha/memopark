//! # 治理监督模块
//!
//! 函数级详细中文注释：实现桥接账户的治理监督与社区投票机制

use crate::*;
use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::{
	pallet_prelude::*, 
	BoundedVec, 
	traits::{Currency, ExistenceRequirement, ReservableCurrency}
};
use frame_system::pallet_prelude::BlockNumberFor;
use scale_info::TypeInfo;
use sp_runtime::{RuntimeDebug, traits::SaturatedConversion};

/// 函数级详细中文注释：提案类型枚举
#[derive(Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, Clone, Copy, PartialEq, Eq, RuntimeDebug)]
pub enum ProposalType {
	/// 设置桥接账户
	SetBridgeAccount,
	/// 紧急暂停桥接
	EmergencyPause,
	/// 恢复桥接
	ResumeBridge,
	/// 调整金额限制
	AdjustLimits,
	/// 提取资金（需要最高权限）
	WithdrawFunds,
}

/// 函数级详细中文注释：提案状态枚举
#[derive(Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, Clone, Copy, PartialEq, Eq, RuntimeDebug)]
pub enum ProposalStatus {
	/// 待投票
	Pending,
	/// 投票中
	Active,
	/// 已通过
	Approved,
	/// 已拒绝
	Rejected,
	/// 已执行
	Executed,
	/// 已过期
	Expired,
}

/// 函数级详细中文注释：投票选项枚举
#[derive(Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, Clone, Copy, PartialEq, Eq, RuntimeDebug)]
pub enum VoteOption {
	/// 赞成
	Aye,
	/// 反对
	Nay,
	/// 弃权
	Abstain,
}

/// 函数级详细中文注释：治理提案结构
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, Balance, BlockNumber))]
#[codec(mel_bound(AccountId: MaxEncodedLen, Balance: MaxEncodedLen, BlockNumber: MaxEncodedLen))]
pub struct GovernanceProposal<AccountId, Balance, BlockNumber> 
where
	AccountId: codec::Encode + codec::Decode,
	Balance: codec::Encode + codec::Decode,
	BlockNumber: codec::Encode + codec::Decode,
{
	/// 提案 ID
	pub proposal_id: u64,
	/// 提案者
	pub proposer: AccountId,
	/// 提案类型
	pub proposal_type: ProposalType,
	/// 提案描述（IPFS CID）
	pub description_cid: BoundedVec<u8, ConstU32<64>>,
	/// 提案参数（编码后的数据）
	pub params: BoundedVec<u8, ConstU32<256>>,
	/// 状态
	pub status: ProposalStatus,
	/// 创建时间
	pub created_at: BlockNumber,
	/// 投票截止时间
	pub voting_deadline: BlockNumber,
	/// 赞成票数
	pub aye_votes: Balance,
	/// 反对票数
	pub nay_votes: Balance,
	/// 弃权票数
	pub abstain_votes: Balance,
	/// 执行时间（可选）
	pub executed_at: Option<BlockNumber>,
}

/// 函数级详细中文注释：投票记录结构
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, Balance))]
#[codec(mel_bound(AccountId: MaxEncodedLen, Balance: MaxEncodedLen))]
pub struct VoteRecord<AccountId, Balance> 
where
	AccountId: codec::Encode + codec::Decode,
	Balance: codec::Encode + codec::Decode,
{
	/// 投票者
	pub voter: AccountId,
	/// 投票选项
	pub vote: VoteOption,
	/// 投票权重（按持币量）
	pub weight: Balance,
	/// 投票时间
	pub voted_at: u64,
}

/// 函数级详细中文注释：桥接操作审计记录
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, Balance, BlockNumber))]
#[codec(mel_bound(AccountId: MaxEncodedLen, Balance: MaxEncodedLen, BlockNumber: MaxEncodedLen))]
pub struct AuditRecord<AccountId, Balance, BlockNumber> 
where
	AccountId: codec::Encode + codec::Decode,
	Balance: codec::Encode + codec::Decode,
	BlockNumber: codec::Encode + codec::Decode,
{
	/// 审计 ID
	pub audit_id: u64,
	/// 操作类型
	pub operation: BoundedVec<u8, ConstU32<64>>,
	/// 操作者
	pub operator: AccountId,
	/// 金额（如果适用）
	pub amount: Option<Balance>,
	/// 操作时间
	pub timestamp: BlockNumber,
	/// 关联提案 ID（如果适用）
	pub proposal_id: Option<u64>,
	/// 操作结果
	pub success: bool,
	/// 备注
	pub notes: BoundedVec<u8, ConstU32<128>>,
}

/// 函数级详细中文注释：治理配置参数
#[derive(Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, Clone, Copy, PartialEq, Eq, RuntimeDebug)]
pub struct GovernanceConfig {
	/// 提案投票期限（区块数）
	pub voting_period: u32,
	/// 提案通过阈值（百分比，如 6000 = 60%）
	pub approval_threshold: u16,
	/// 最小投票率要求（百分比，如 2000 = 20%）
	pub min_turnout: u16,
	/// 提案押金
	pub proposal_deposit: u128,
	/// 是否需要理事会预批准
	pub require_council_approval: bool,
}

impl Default for GovernanceConfig {
	fn default() -> Self {
		Self {
			voting_period: 7 * 24 * 600,      // 7 天（假设 6 秒/区块）
			approval_threshold: 6667,          // 66.67% 赞成
			min_turnout: 3000,                 // 30% 最小投票率
			proposal_deposit: 10_000_000_000_000_000, // 10,000 DUST
			require_council_approval: true,
		}
	}
}

impl<T: Config> Pallet<T> {
	/// 函数级详细中文注释：创建治理提案
	///
	/// ## 功能说明
	/// 任何持有足够押金的用户都可以创建治理提案
	///
	/// ## 参数
	/// - `proposer`: 提案者
	/// - `proposal_type`: 提案类型
	/// - `description_cid`: 提案描述 IPFS CID
	/// - `params`: 提案参数
	///
	/// ## 返回
	/// - `Ok(proposal_id)`: 提案 ID
	/// - `Err(...)`: 错误
	pub fn do_create_proposal(
		proposer: &T::AccountId,
		proposal_type: ProposalType,
		description_cid: BoundedVec<u8, ConstU32<64>>,
		params: BoundedVec<u8, ConstU32<256>>,
	) -> Result<u64, DispatchError> {
		// 1. 检查押金
		let config = GovernanceConfigStorage::<T>::get();
		let deposit: BalanceOf<T> = config.proposal_deposit.try_into().map_err(|_| Error::<T>::InvalidAmount)?;
		ensure!(
			T::Currency::free_balance(proposer) >= deposit,
			Error::<T>::InsufficientBalance
		);

		// 2. 锁定押金
		T::Currency::reserve(proposer, deposit)
			.map_err(|_| Error::<T>::InsufficientBalance)?;

		// 3. 创建提案
		let proposal_id = NextProposalId::<T>::get();
		let current_block = frame_system::Pallet::<T>::block_number();
		let voting_deadline = current_block + config.voting_period.into();

		let proposal = GovernanceProposal {
			proposal_id,
			proposer: proposer.clone(),
			proposal_type: proposal_type.clone(),
			description_cid: description_cid.clone(),
			params: params.clone(),
			status: if config.require_council_approval {
				ProposalStatus::Pending
			} else {
				ProposalStatus::Active
			},
			created_at: current_block,
			voting_deadline,
			aye_votes: Zero::zero(),
			nay_votes: Zero::zero(),
			abstain_votes: Zero::zero(),
			executed_at: None,
		};

		// 4. 保存提案
		Proposals::<T>::insert(proposal_id, proposal);
		NextProposalId::<T>::put(proposal_id + 1);

		// 5. 触发事件
		Self::deposit_event(Event::ProposalCreated {
			proposal_id,
			proposer: proposer.clone(),
			proposal_type,
		});

		Ok(proposal_id)
	}

	/// 函数级详细中文注释：投票
	///
	/// ## 功能说明
	/// 持币用户可以对提案投票，投票权重与持币量成正比
	///
	/// ## 参数
	/// - `voter`: 投票者
	/// - `proposal_id`: 提案 ID
	/// - `vote`: 投票选项
	///
	/// ## 返回
	/// - `Ok(())`: 成功
	/// - `Err(...)`: 错误
	pub fn do_vote(
		voter: &T::AccountId,
		proposal_id: u64,
		vote: VoteOption,
	) -> DispatchResult {
		// 1. 获取提案
		let mut proposal = Proposals::<T>::get(proposal_id)
			.ok_or(Error::<T>::ProposalNotFound)?;

		// 2. 检查状态
		ensure!(
			proposal.status == ProposalStatus::Active,
			Error::<T>::ProposalNotActive
		);

		// 3. 检查是否过期
		let current_block = frame_system::Pallet::<T>::block_number();
		ensure!(
			current_block <= proposal.voting_deadline,
			Error::<T>::VotingExpired
		);

		// 4. 检查是否已投票
		ensure!(
			!Votes::<T>::contains_key(proposal_id, voter),
			Error::<T>::AlreadyVoted
		);

		// 5. 计算投票权重（按持币量）
		let balance = T::Currency::free_balance(voter);

		// 6. 更新投票统计
		match vote {
			VoteOption::Aye => proposal.aye_votes += balance,
			VoteOption::Nay => proposal.nay_votes += balance,
			VoteOption::Abstain => proposal.abstain_votes += balance,
		}

		// 7. 记录投票
		let vote_record = VoteRecord {
			voter: voter.clone(),
			vote: vote.clone(),
			weight: balance,
			voted_at: current_block.saturated_into(),
		};
		Votes::<T>::insert(proposal_id, voter, vote_record);

		// 8. 保存提案
		Proposals::<T>::insert(proposal_id, proposal);

		// 9. 触发事件
		Self::deposit_event(Event::Voted {
			proposal_id,
			voter: voter.clone(),
			vote,
			weight: balance,
		});

		Ok(())
	}

	/// 函数级详细中文注释：执行提案
	///
	/// ## 功能说明
	/// 投票截止后，任何人都可以触发提案执行
	///
	/// ## 参数
	/// - `proposal_id`: 提案 ID
	///
	/// ## 返回
	/// - `Ok(())`: 成功
	/// - `Err(...)`: 错误
	pub fn do_execute_proposal(proposal_id: u64) -> DispatchResult {
		// 1. 获取提案
		let mut proposal = Proposals::<T>::get(proposal_id)
			.ok_or(Error::<T>::ProposalNotFound)?;

		// 2. 检查状态
		ensure!(
			proposal.status == ProposalStatus::Active,
			Error::<T>::InvalidProposalStatus
		);

		// 3. 检查投票是否结束
		let current_block = frame_system::Pallet::<T>::block_number();
		ensure!(
			current_block > proposal.voting_deadline,
			Error::<T>::VotingNotEnded
		);

		// 4. 计算结果
		let config = GovernanceConfigStorage::<T>::get();
		let total_votes = proposal.aye_votes + proposal.nay_votes + proposal.abstain_votes;
		let total_supply = T::Currency::total_issuance();

		// 检查投票率（转换为 u128 计算）
		let total_votes_u128: u128 = total_votes.saturated_into();
		let total_supply_u128: u128 = total_supply.saturated_into();
		let turnout_bps = if total_supply_u128 > 0 {
			(total_votes_u128 * 10_000u128 / total_supply_u128) as u16
		} else {
			0u16
		};
		
		ensure!(
			turnout_bps >= config.min_turnout,
			Error::<T>::InsufficientTurnout
		);

		// 计算赞成率
		let aye_votes_u128: u128 = proposal.aye_votes.saturated_into();
		let approval_bps = if total_votes_u128 > 0 {
			(aye_votes_u128 * 10_000u128 / total_votes_u128) as u16
		} else {
			0u16
		};

		// 5. 判断是否通过
		if approval_bps >= config.approval_threshold {
			proposal.status = ProposalStatus::Approved;

			// 执行提案
			Self::execute_proposal_action(&proposal)?;

			proposal.executed_at = Some(current_block);
			proposal.status = ProposalStatus::Executed;

			Self::deposit_event(Event::ProposalExecuted { proposal_id });
		} else {
			proposal.status = ProposalStatus::Rejected;
			Self::deposit_event(Event::ProposalRejected { proposal_id });
		}

		// 6. 保存提案
		Proposals::<T>::insert(proposal_id, proposal.clone());

		// 7. 退还押金
		let deposit: BalanceOf<T> = config.proposal_deposit.try_into().map_err(|_| Error::<T>::InvalidAmount)?;
		let _ = T::Currency::unreserve(&proposal.proposer, deposit);

		Ok(())
	}

	/// 函数级详细中文注释：执行提案具体操作
	fn execute_proposal_action(
		proposal: &GovernanceProposal<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
	) -> DispatchResult {
		match proposal.proposal_type {
			ProposalType::SetBridgeAccount => {
				// 从参数解析账户 ID
				let account: T::AccountId = Decode::decode(&mut &proposal.params[..])
					.map_err(|_| Error::<T>::InvalidParams)?;
				BridgeLockAccount::<T>::put(account.clone());
				Self::deposit_event(Event::BridgeLockAccountSet { account });
			},
			ProposalType::EmergencyPause => {
				BridgePaused::<T>::put(true);
				Self::deposit_event(Event::BridgePaused);
			},
			ProposalType::ResumeBridge => {
				BridgePaused::<T>::put(false);
				Self::deposit_event(Event::BridgeResumed);
			},
			ProposalType::AdjustLimits => {
				// 从参数解析新的限制
				let (min_amount, max_amount): (BalanceOf<T>, BalanceOf<T>) =
					Decode::decode(&mut &proposal.params[..])
						.map_err(|_| Error::<T>::InvalidParams)?;
				// 注意：这需要在 Config 中添加可调整限制的支持
				Self::deposit_event(Event::LimitsAdjusted { min_amount, max_amount });
			},
			ProposalType::WithdrawFunds => {
				// 紧急提取资金（需要最高治理权限）
				let (to, amount): (T::AccountId, BalanceOf<T>) =
					Decode::decode(&mut &proposal.params[..])
						.map_err(|_| Error::<T>::InvalidParams)?;
				
				let bridge_account = BridgeLockAccount::<T>::get()
					.ok_or(Error::<T>::BridgeAccountNotSet)?;
				
				T::Currency::transfer(
					&bridge_account,
					&to,
					amount,
					ExistenceRequirement::AllowDeath,
				)?;
				
				Self::deposit_event(Event::FundsWithdrawn { to, amount });
			},
		}

		Ok(())
	}

	/// 函数级详细中文注释：记录审计日志
	pub fn record_audit(
		operation: &[u8],
		operator: &T::AccountId,
		amount: Option<BalanceOf<T>>,
		proposal_id: Option<u64>,
		success: bool,
		notes: &[u8],
	) -> Result<(), DispatchError> {
		let audit_id = NextAuditId::<T>::get();
		let current_block = frame_system::Pallet::<T>::block_number();

		let record = AuditRecord {
			audit_id,
			operation: operation.to_vec().try_into().map_err(|_| Error::<T>::InvalidParams)?,
			operator: operator.clone(),
			amount,
			timestamp: current_block,
			proposal_id,
			success,
			notes: notes.to_vec().try_into().map_err(|_| Error::<T>::InvalidParams)?,
		};

		AuditLogs::<T>::insert(audit_id, record);
		NextAuditId::<T>::put(audit_id + 1);

		Ok(())
	}
}

