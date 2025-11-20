//! # 单元测试
//!
//! 函数级详细中文注释：pallet-dust-bridge 的完整测试套件

use crate::{self as pallet_dust_bridge, *};
use frame_support::{
	assert_noop, assert_ok,
	derive_impl,
	parameter_types,
	traits::{ConstU128, ConstU32, Currency},
	BoundedVec,
};
use sp_runtime::{
	traits::IdentityLookup,
	BuildStorage,
};

// ===== Mock Runtime =====

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
	pub enum Test {
		System: frame_system,
		Balances: pallet_balances,
		DustBridge: pallet_dust_bridge,
	}
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type Block = Block;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type AccountData = pallet_balances::AccountData<u128>;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
	type Balance = u128;
	type ExistentialDeposit = ConstU128<1>;
	type AccountStore = System;
}

parameter_types! {
	pub const MinBridgeAmount: u128 = 1_000_000_000_000; // 1 DUST
	pub const MaxBridgeAmount: u128 = 1_000_000_000_000_000_000; // 1,000,000 DUST
	pub const BridgeTimeout: u32 = 600; // 600 blocks
}

impl pallet_dust_bridge::Config for Test {
	type Currency = Balances;
	type GovernanceOrigin = frame_system::EnsureRoot<u64>;
	type MinBridgeAmount = MinBridgeAmount;
	type MaxBridgeAmount = MaxBridgeAmount;
	type BridgeTimeout = BridgeTimeout;
}

// ===== 测试辅助函数 =====

/// 函数级详细中文注释：构建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
	let mut t = frame_system::GenesisConfig::<Test>::default()
		.build_storage()
		.unwrap();

	pallet_balances::GenesisConfig::<Test> {
		balances: vec![
			(1, 10_000_000_000_000_000), // Alice: 10,000 DUST
			(2, 5_000_000_000_000_000),  // Bob: 5,000 DUST
			(3, 1_000_000_000_000_000),  // Charlie: 1,000 DUST
		],
		dev_accounts: None,
	}
	.assimilate_storage(&mut t)
	.unwrap();

	let mut ext = sp_io::TestExternalities::new(t);
	ext.execute_with(|| System::set_block_number(1));
	ext
}

/// 函数级详细中文注释：运行到指定区块
pub fn run_to_block(n: u64) {
	while System::block_number() < n {
		System::set_block_number(System::block_number() + 1);
	}
}

/// 函数级详细中文注释：创建测试用的以太坊地址
pub fn eth_address(s: &str) -> Vec<u8> {
	let mut addr = b"0x".to_vec();
	addr.extend_from_slice(s.as_bytes());
	// 填充到 42 字节
	while addr.len() < 42 {
		addr.push(b'0');
	}
	addr
}

/// 函数级详细中文注释：创建测试用的以太坊交易哈希  
pub fn eth_tx_hash(s: &str) -> Vec<u8> {
	let mut hash = b"0x".to_vec();
	hash.extend_from_slice(s.as_bytes());
	// 填充到 66 字节
	while hash.len() < 66 {
		hash.push(b'0');
	}
	hash
}

// ===== 桥接功能测试 =====

#[test]
fn test_bridge_to_arbitrum_works() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let amount = 100_000_000_000_000; // 100 DUST
		let target = eth_address("1234567890abcdef");

		// 执行桥接
		assert_ok!(DustBridge::bridge_to_arbitrum(
			RuntimeOrigin::signed(user),
			amount,
			target.clone()
		));

		// 验证桥接请求已创建
		let bridge_id = 0;
		let request = BridgeRequests::<Test>::get(bridge_id).unwrap();
		assert_eq!(request.user, user);
		assert_eq!(request.amount, amount);
		assert_eq!(request.target_address, target);
		assert_eq!(request.status, BridgeStatus::Pending);

		// 验证用户余额减少
		assert_eq!(
			Balances::free_balance(user),
			10_000_000_000_000_000 - amount
		);

		// 验证事件触发
		System::assert_last_event(
			Event::BridgeRequested {
				bridge_id,
				user,
				amount,
				target_address: target,
			}
			.into(),
		);
	});
}

#[test]
fn test_bridge_amount_too_small() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let amount = 100_000_000; // 0.0001 DUST (小于最小金额)
		let target = eth_address("1234567890abcdef");

		// 应该失败
		assert_noop!(
			DustBridge::bridge_to_arbitrum(RuntimeOrigin::signed(user), amount, target),
			Error::<Test>::BelowMinimumAmount
		);
	});
}

#[test]
fn test_bridge_amount_too_large() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let amount = 2_000_000_000_000_000_000; // 2,000,000 DUST (超过最大金额)
		let target = eth_address("1234567890abcdef");

		// 应该失败
		assert_noop!(
			DustBridge::bridge_to_arbitrum(RuntimeOrigin::signed(user), amount, target),
			Error::<Test>::AboveMaximumAmount
		);
	});
}

#[test]
fn test_bridge_insufficient_balance() {
	new_test_ext().execute_with(|| {
		let user = 3; // Charlie 只有 1,000 DUST
		let amount = 2_000_000_000_000_000; // 2,000 DUST
		let target = eth_address("1234567890abcdef");

		// 应该失败（余额不足）
		assert_noop!(
			DustBridge::bridge_to_arbitrum(RuntimeOrigin::signed(user), amount, target),
			pallet_balances::Error::<Test>::InsufficientBalance
		);
	});
}

#[test]
fn test_bridge_paused() {
	new_test_ext().execute_with(|| {
		// 暂停桥接
		BridgePaused::<Test>::put(true);

		let user = 1;
		let amount = 100_000_000_000_000;
		let target = eth_address("1234567890abcdef");

		// 应该失败
		assert_noop!(
			DustBridge::bridge_to_arbitrum(RuntimeOrigin::signed(user), amount, target),
			Error::<Test>::BridgePaused
		);
	});
}

#[test]
fn test_unlock_from_arbitrum_works() {
	new_test_ext().execute_with(|| {
		// 设置桥接账户并充值
		let bridge_account = 999u64; // 测试用桥接账户
		BridgeLockAccount::<Test>::put(bridge_account);
		let _ = <Test as pallet::Config>::Currency::make_free_balance_be(&bridge_account, 1_000_000_000_000_000);

		let tx_hash = eth_tx_hash("abcdef1234567890");
		let user = 1;
		let amount = 50_000_000_000_000; // 50 DUST

		let user_balance_before = Balances::free_balance(user);

		// 执行解锁
		assert_ok!(DustBridge::unlock_from_arbitrum(
			RuntimeOrigin::signed(user),
			tx_hash.clone(),
			user,
			amount
		));

		// 验证交易已处理
		assert!(ProcessedArbitrumTxs::<Test>::contains_key(&tx_hash));

		// 验证用户余额增加
		assert_eq!(Balances::free_balance(user), user_balance_before + amount);

		// 验证事件触发
		System::assert_last_event(
			Event::BridgeUnlocked {
				arbitrum_tx_hash: tx_hash,
				user,
				amount,
			}
			.into(),
		);
	});
}

#[test]
fn test_unlock_duplicate_tx() {
	new_test_ext().execute_with(|| {
		// 设置桥接账户并充值
		let bridge_account = 999u64;
		BridgeLockAccount::<Test>::put(bridge_account);
		let _ = <Test as pallet::Config>::Currency::make_free_balance_be(&bridge_account, 1_000_000_000_000_000);

		let tx_hash = eth_tx_hash("abcdef1234567890");
		let user = 1;
		let amount = 50_000_000_000_000;

		// 第一次解锁成功
		assert_ok!(DustBridge::unlock_from_arbitrum(
			RuntimeOrigin::signed(user),
			tx_hash.clone(),
			user,
			amount
		));

		// 第二次解锁应该失败（重复交易）
		assert_noop!(
			DustBridge::unlock_from_arbitrum(
				RuntimeOrigin::signed(user),
				tx_hash.clone(),
				user,
				amount
			),
			Error::<Test>::TxAlreadyProcessed
		);
	});
}

// ===== 治理功能测试 =====

#[test]
fn test_create_proposal_works() {
	new_test_ext().execute_with(|| {
		// 设置治理配置
		let config = governance::GovernanceConfig {
			voting_period: 100,
			approval_threshold: 6667, // 66.67%
			min_turnout: 1000,         // 10%
			proposal_deposit: 1_000_000_000_000, // 1 DUST
			require_council_approval: false,
		};
		GovernanceConfigStorage::<Test>::put(config);

		let proposer = 1;
		let description_cid = BoundedVec::try_from(b"QmTest123".to_vec()).unwrap();
		let params = BoundedVec::try_from(vec![]).unwrap();

		// 创建提案
		assert_ok!(DustBridge::create_proposal(
			RuntimeOrigin::signed(proposer),
			governance::ProposalType::EmergencyPause,
			description_cid.clone(),
			params.clone()
		));

		// 验证提案已创建
		let proposal_id = 0;
		let proposal = governance::Proposals::<Test>::get(proposal_id).unwrap();
		assert_eq!(proposal.proposer, proposer);
		assert_eq!(proposal.proposal_type, governance::ProposalType::EmergencyPause);
		assert_eq!(proposal.description_cid, description_cid);

		// 验证押金已锁定
		assert_eq!(
			Balances::free_balance(proposer),
			10_000_000_000_000_000 - 1_000_000_000_000
		);

		// 验证事件触发
		System::assert_last_event(
			Event::ProposalCreated {
				proposal_id,
				proposer,
				proposal_type: governance::ProposalType::EmergencyPause,
			}
			.into(),
		);
	});
}

#[test]
fn test_vote_works() {
	new_test_ext().execute_with(|| {
		// 设置治理配置
		let config = governance::GovernanceConfig {
			voting_period: 100,
			approval_threshold: 6667,
			min_turnout: 1000,
			proposal_deposit: 1_000_000_000_000,
			require_council_approval: false,
		};
		governance::GovernanceConfigStorage::<Test>::put(config);

		// 创建提案
		let proposer = 1;
		let description_cid = BoundedVec::try_from(b"QmTest123".to_vec()).unwrap();
		let params = BoundedVec::try_from(vec![]).unwrap();

		assert_ok!(DustBridge::create_proposal(
			RuntimeOrigin::signed(proposer),
			governance::ProposalType::EmergencyPause,
			description_cid,
			params
		));

		let proposal_id = 0;
		let voter = 2; // Bob 有 5,000 DUST

		// 投票
		assert_ok!(DustBridge::vote(
			RuntimeOrigin::signed(voter),
			proposal_id,
			governance::VoteOption::Aye
		));

		// 验证投票记录
		assert!(governance::Votes::<Test>::contains_key(proposal_id, voter));

		// 验证提案的赞成票数增加
		let proposal = governance::Proposals::<Test>::get(proposal_id).unwrap();
		assert_eq!(proposal.aye_votes, 5_000_000_000_000_000);

		// 验证事件触发
		System::assert_last_event(
			Event::Voted {
				proposal_id,
				voter,
				vote: governance::VoteOption::Aye,
				weight: 5_000_000_000_000_000,
			}
			.into(),
		);
	});
}

#[test]
fn test_vote_already_voted() {
	new_test_ext().execute_with(|| {
		// 设置治理配置
		let config = governance::GovernanceConfig {
			voting_period: 100,
			approval_threshold: 6667,
			min_turnout: 1000,
			proposal_deposit: 1_000_000_000_000,
			require_council_approval: false,
		};
		governance::GovernanceConfigStorage::<Test>::put(config);

		// 创建提案
		assert_ok!(DustBridge::create_proposal(
			RuntimeOrigin::signed(1),
			governance::ProposalType::EmergencyPause,
			BoundedVec::try_from(b"QmTest123".to_vec()).unwrap(),
			BoundedVec::try_from(vec![]).unwrap()
		));

		let proposal_id = 0;
		let voter = 2;

		// 第一次投票
		assert_ok!(DustBridge::vote(
			RuntimeOrigin::signed(voter),
			proposal_id,
			governance::VoteOption::Aye
		));

		// 第二次投票应该失败
		assert_noop!(
			DustBridge::vote(
				RuntimeOrigin::signed(voter),
				proposal_id,
				governance::VoteOption::Nay
			),
			Error::<Test>::AlreadyVoted
		);
	});
}

#[test]
fn test_execute_proposal_works() {
	new_test_ext().execute_with(|| {
		// 设置治理配置（低门槛以便测试）
		let config = governance::GovernanceConfig {
			voting_period: 100,
			approval_threshold: 5000, // 50%
			min_turnout: 1000,        // 10%
			proposal_deposit: 1_000_000_000_000,
			require_council_approval: false,
		};
		governance::GovernanceConfigStorage::<Test>::put(config);

		// 创建提案
		assert_ok!(DustBridge::create_proposal(
			RuntimeOrigin::signed(1),
			governance::ProposalType::EmergencyPause,
			BoundedVec::try_from(b"QmTest123".to_vec()).unwrap(),
			BoundedVec::try_from(vec![]).unwrap()
		));

		let proposal_id = 0;

		// Alice (10,000 DUST) 投赞成票
		assert_ok!(DustBridge::vote(
			RuntimeOrigin::signed(1),
			proposal_id,
			governance::VoteOption::Aye
		));

		// 前进到投票期结束后
		run_to_block(101);

		// 执行提案
		assert_ok!(DustBridge::execute_proposal(
			RuntimeOrigin::signed(1),
			proposal_id
		));

		// 验证提案状态变为已执行
		let proposal = governance::Proposals::<Test>::get(proposal_id).unwrap();
		assert_eq!(proposal.status, governance::ProposalStatus::Executed);

		// 验证桥接已暂停
		assert!(BridgePaused::<Test>::get());

		// 验证事件触发
		System::assert_last_event(
			Event::ProposalExecuted { proposal_id }.into(),
		);
	});
}

#[test]
fn test_execute_proposal_not_passed() {
	new_test_ext().execute_with(|| {
		// 设置治理配置
		let config = governance::GovernanceConfig {
			voting_period: 100,
			approval_threshold: 6667, // 66.67%
			min_turnout: 1000,
			proposal_deposit: 1_000_000_000_000,
			require_council_approval: false,
		};
		governance::GovernanceConfigStorage::<Test>::put(config);

		// 创建提案
		assert_ok!(DustBridge::create_proposal(
			RuntimeOrigin::signed(1),
			governance::ProposalType::EmergencyPause,
			BoundedVec::try_from(b"QmTest123".to_vec()).unwrap(),
			BoundedVec::try_from(vec![]).unwrap()
		));

		let proposal_id = 0;

		// Bob (5,000 DUST) 投反对票
		assert_ok!(DustBridge::vote(
			RuntimeOrigin::signed(2),
			proposal_id,
			governance::VoteOption::Nay
		));

		// 前进到投票期结束后
		run_to_block(101);

		// 执行提案应该失败（未通过）
		assert_noop!(
			DustBridge::execute_proposal(RuntimeOrigin::signed(1), proposal_id),
			Error::<Test>::InsufficientTurnout
		);
	});
}

#[test]
fn test_execute_proposal_too_early() {
	new_test_ext().execute_with(|| {
		// 设置治理配置
		let config = governance::GovernanceConfig {
			voting_period: 100,
			approval_threshold: 5000,
			min_turnout: 1000,
			proposal_deposit: 1_000_000_000_000,
			require_council_approval: false,
		};
		governance::GovernanceConfigStorage::<Test>::put(config);

		// 创建提案
		assert_ok!(DustBridge::create_proposal(
			RuntimeOrigin::signed(1),
			governance::ProposalType::EmergencyPause,
			BoundedVec::try_from(b"QmTest123".to_vec()).unwrap(),
			BoundedVec::try_from(vec![]).unwrap()
		));

		let proposal_id = 0;

		// Alice 投赞成票
		assert_ok!(DustBridge::vote(
			RuntimeOrigin::signed(1),
			proposal_id,
			governance::VoteOption::Aye
		));

		// 在投票期内执行应该失败
		assert_noop!(
			DustBridge::execute_proposal(RuntimeOrigin::signed(1), proposal_id),
			Error::<Test>::VotingNotEnded
		);
	});
}

// ===== 管理功能测试 =====

#[test]
fn test_set_arbitrum_bridge_address_works() {
	new_test_ext().execute_with(|| {
		let address = eth_address("1234567890abcdef1234567890abcdef12345678");

		// Root 可以设置
		assert_ok!(DustBridge::set_arbitrum_bridge_address(
			RuntimeOrigin::root(),
			address.clone()
		));

		// 验证地址已设置
		assert_eq!(ArbitrumBridgeAddress::<Test>::get(), Some(address.clone()));

		// 验证事件触发
		System::assert_last_event(
			Event::ArbitrumBridgeAddressSet { address }.into(),
		);
	});
}

#[test]
fn test_set_arbitrum_bridge_address_requires_root() {
	new_test_ext().execute_with(|| {
		let address = eth_address("1234567890abcdef1234567890abcdef12345678");

		// 普通用户不能设置
		assert_noop!(
			DustBridge::set_arbitrum_bridge_address(
				RuntimeOrigin::signed(1),
				address
			),
			sp_runtime::DispatchError::BadOrigin
		);
	});
}

#[test]
fn test_set_governance_config_works() {
	new_test_ext().execute_with(|| {
		let config = governance::GovernanceConfig {
			voting_period: 200,
			approval_threshold: 7000,
			min_turnout: 2000,
			proposal_deposit: 5_000_000_000_000,
			require_council_approval: true,
		};

		// Root 可以设置
		assert_ok!(DustBridge::set_governance_config(
			RuntimeOrigin::root(),
			config.clone()
		));

		// 验证配置已设置
		assert_eq!(governance::GovernanceConfigStorage::<Test>::get(), config);
	});
}

// ===== 边界条件和错误处理测试 =====

#[test]
fn test_bridge_lock_account_storage() {
	new_test_ext().execute_with(|| {
		let account = 999u64;
		
		// 设置桥接锁定账户
		BridgeLockAccount::<Test>::put(account);
		
		// 验证账户已设置
		assert_eq!(BridgeLockAccount::<Test>::get(), Some(account));
	});
}

#[test]
fn test_next_bridge_id_increments() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let amount = 100_000_000_000_000;
		let target = eth_address("1234567890abcdef");

		// 第一次桥接
		assert_ok!(DustBridge::bridge_to_arbitrum(
			RuntimeOrigin::signed(user),
			amount,
			target.clone()
		));
		assert_eq!(NextBridgeId::<Test>::get(), 1);

		// 第二次桥接
		assert_ok!(DustBridge::bridge_to_arbitrum(
			RuntimeOrigin::signed(user),
			amount,
			target.clone()
		));
		assert_eq!(NextBridgeId::<Test>::get(), 2);
	});
}

#[test]
fn test_max_bounded_vec_sizes() {
	new_test_ext().execute_with(|| {
		// 测试以太坊地址长度
		let valid_addr = eth_address("1234567890abcdef1234567890abcdef12345678");
		assert_eq!(valid_addr.len(), 42);

		// 测试交易哈希长度
		let valid_hash = eth_tx_hash("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd");
		assert_eq!(valid_hash.len(), 66);
	});
}

