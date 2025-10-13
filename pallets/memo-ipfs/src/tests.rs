//! 单元测试：charge_due 流控与 Grace/Expire
#![cfg(test)]

use super::*;
use frame_support::{
    assert_ok, parameter_types,
    traits::{Currency as _, Everything, OnFinalize, OnInitialize},
};
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup, Saturating},
    BuildStorage,
};

// ---- Mock Runtime ----

type AccountId = u64;
type Balance = u128;
type BlockNumber = u64;

frame_support::construct_runtime!(
    pub enum Test where
        Block = frame_system::mocking::MockBlock<Test>,
        NodeBlock = frame_system::mocking::MockBlock<Test>,
        UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>,
    {
        System: frame_system,
        Balances: pallet_balances,
        Endowment: pallet_memo_endowment,
        Ipfs: crate,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const ExistentialDeposit: Balance = 0;
    pub const MaxLocks: u32 = 50;
    pub const IpfsMaxCidHashLen: u32 = 64;
    pub const SubjectPalletId: frame_support::PalletId = frame_support::PalletId(*b"ipfs/sub");
    pub const EndowmentPrincipalId: frame_support::PalletId = frame_support::PalletId(*b"end/prin");
    pub const EndowmentYieldId: frame_support::PalletId = frame_support::PalletId(*b"end/yild");
    pub const DeceasedDomain: u8 = 1;
    pub IpfsPoolPalletId: frame_support::PalletId = frame_support::PalletId(*b"py/ipfs+");
    pub OperatorEscrowPalletId: frame_support::PalletId = frame_support::PalletId(*b"py/opesc");
    pub const MonthlyPublicFeeQuota: Balance = 100_000_000_000_000; // 100 MEMO
    pub const QuotaResetPeriod: BlockNumber = 100; // 简化为 100 块用于测试
}

pub struct IpfsPoolAccount;
impl sp_core::Get<AccountId> for IpfsPoolAccount {
    fn get() -> AccountId {
        use sp_runtime::traits::AccountIdConversion;
        IpfsPoolPalletId::get().into_account_truncating()
    }
}

pub struct OperatorEscrowAccount;
impl sp_core::Get<AccountId> for OperatorEscrowAccount {
    fn get() -> AccountId {
        use sp_runtime::traits::AccountIdConversion;
        OperatorEscrowPalletId::get().into_account_truncating()
    }
}

impl frame_system::Config for Test {
    type BaseCallFilter = Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type Origin = RuntimeOrigin;
    type Call = RuntimeCall;
    type Index = u64;
    type BlockNumber = BlockNumber;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = AccountId;
    type Lookup = IdentityLookup<AccountId>;
    type Header = sp_runtime::generic::Header<BlockNumber, BlakeTwo256>;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<Balance>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = frame_support::traits::ConstU16<42>;
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
}

impl pallet_balances::Config for Test {
    type Balance = Balance;
    type DustRemoval = ();
    type RuntimeEvent = RuntimeEvent;
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type MaxLocks = MaxLocks;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    type FreezeIdentifier = ();
    type MaxFreezes = frame_support::traits::ConstU32<0>;
    type RuntimeHoldReason = ();
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

impl pallet_memo_endowment::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    type PrincipalPalletId = EndowmentPrincipalId;
    type YieldPalletId = EndowmentYieldId;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
    type WeightInfo = ();
    type Sla = SlaNoop;
}

pub struct SlaNoop;
impl pallet_memo_endowment::SlaProvider<AccountId, BlockNumber> for SlaNoop {
    fn visit<F: FnMut(&AccountId, u32, u32, BlockNumber)>(_f: F) {}
}

pub struct OwnerMap;
impl crate::OwnerProvider<AccountId> for OwnerMap {
    fn owner_of(subject_id: u64) -> Option<AccountId> {
        Some(subject_id)
    }
}

impl crate::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    type FeeCollector = IpfsPoolAccount; // 简化测试
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxCidHashLen = IpfsMaxCidHashLen;
    type MaxPeerIdLen = frame_support::traits::ConstU32<64>;
    type MinOperatorBond = frame_support::traits::ConstU128<0>;
    type MinCapacityGiB = frame_support::traits::ConstU32<1>;
    type WeightInfo = ();
    type SubjectPalletId = SubjectPalletId;
    type DeceasedDomain = DeceasedDomain;
    type OwnerProvider = OwnerMap;
    type IpfsPoolAccount = IpfsPoolAccount;
    type OperatorEscrowAccount = OperatorEscrowAccount;
    type MonthlyPublicFeeQuota = MonthlyPublicFeeQuota;
    type QuotaResetPeriod = QuotaResetPeriod;
}

fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::default()
        .build_storage::<Test>()
        .unwrap();
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![(1, 1_000_000_000_000u128), (2, 1_000_000_000_000u128)],
    }
    .assimilate_storage(&mut t)
    .unwrap();
    t.into()
}

fn run_to_block(n: BlockNumber) {
    while System::block_number() < n {
        let b = System::block_number() + 1;
        System::on_initialize(b);
        System::set_block_number(b);
        System::on_finalize(b);
    }
}

#[test]
fn charge_due_respects_limit_and_requeues() {
    new_test_ext().execute_with(|| {
        // 设置参数：每周=10 块，宽限=5 块，max_per_block=1
        crate::Pallet::<Test>::set_billing_params(
            frame_system::RawOrigin::Root.into(),
            Some(100),
            Some(10),
            Some(5),
            Some(1),
            Some(0),
            Some(false),
        )
        .unwrap();
        // subject_id=1 → 派生账户=1 的子账户（mock 中我们直接用 owner=1）
        let owner: AccountId = 1;
        // 模拟两条 Pin
        let cid1 = H256::repeat_byte(1);
        let cid2 = H256::repeat_byte(2);
        // 初始化 meta 与 subject 来源
        <crate::pallet::PinMeta<Test>>::insert(cid1, (1, 1_073_741_824u64, 1u64, 1u64));
        <crate::pallet::PinMeta<Test>>::insert(cid2, (1, 1_073_741_824u64, 1u64, 1u64));
        <crate::pallet::PinSubjectOf<Test>>::insert(cid1, (owner, 1u64));
        <crate::pallet::PinSubjectOf<Test>>::insert(cid2, (owner, 1u64));
        // 初始化计费：next=10
        <crate::pallet::PinBilling<Test>>::insert(cid1, (10u64, 100u128, 0u8));
        <crate::pallet::PinBilling<Test>>::insert(cid2, (10u64, 100u128, 0u8));
        <crate::pallet::DueQueue<Test>>::mutate(10u64, |v| {
            let _ = v.try_push(cid1);
            let _ = v.try_push(cid2);
        });
        // 提前给派生账户充值（直接给 owner 账户足额余额即可覆盖）
        // 前进到区块 10
        run_to_block(10);
        // limit=10 但受 MaxChargePerBlock=1 限制，应只处理一个
        assert_ok!(crate::Pallet::<Test>::charge_due(frame_system::RawOrigin::Root.into(), 10));
        // 一个被推进到 20，另一个仍在 10 的队列或已放回
        let (n1, _, _s1) = <crate::pallet::PinBilling<Test>>::get(cid1).unwrap();
        let (n2, _, _s2) = <crate::pallet::PinBilling<Test>>::get(cid2).unwrap();
        assert!(n1 == 20 || n2 == 20);
        assert!(<crate::pallet::DueQueue<Test>>::get(10u64).len() <= 1);
    });
}

#[test]
fn charge_due_enters_grace_then_expire_on_insufficient_balance() {
    new_test_ext().execute_with(|| {
        // 单价较大以制造不足
        crate::Pallet::<Test>::set_billing_params(
            frame_system::RawOrigin::Root.into(),
            Some(1_000_000_000_000_000),
            Some(10),
            Some(5),
            Some(10),
            Some(0),
            Some(false),
        )
        .unwrap();
        let owner: AccountId = 2;
        let cid = H256::repeat_byte(9);
        <crate::pallet::PinMeta<Test>>::insert(cid, (1, 1_073_741_824u64, 1u64, 1u64));
        <crate::pallet::PinSubjectOf<Test>>::insert(cid, (owner, 1u64));
        <crate::pallet::PinBilling<Test>>::insert(cid, (10u64, 1_000_000_000_000_000u128, 0u8));
        <crate::pallet::DueQueue<Test>>::mutate(10u64, |v| {
            let _ = v.try_push(cid);
        });
        run_to_block(10);
        // 第一次不足 → 进入 Grace，next=10+5=15
        assert_ok!(crate::Pallet::<Test>::charge_due(frame_system::RawOrigin::Root.into(), 1));
        let (next, _u, state) = <crate::pallet::PinBilling<Test>>::get(cid).unwrap();
        assert_eq!(state, 1);
        assert_eq!(next, 15);
        // 到 15 再次处理 → 过期
        run_to_block(15);
        assert_ok!(crate::Pallet::<Test>::charge_due(frame_system::RawOrigin::Root.into(), 1));
        let (_n2, _u2, s2) = <crate::pallet::PinBilling<Test>>::get(cid).unwrap();
        assert_eq!(s2, 2);
    });
}

// ========================================
// 三重扣款机制测试（v3.0）
// ========================================

/// 测试场景 1：配额内，Pool 充足（免费）
#[test]
fn triple_charge_from_pool_with_quota() {
    new_test_ext().execute_with(|| {
        let caller: AccountId = 1;
        let deceased_id: u64 = 100;
        let amount: Balance = 50_000_000_000_000; // 50 MEMO
        
        // 给 IpfsPoolAccount 充值
        let pool_account = IpfsPoolAccount::get();
        let _ = <Test as crate::Config>::Currency::deposit_creating(&pool_account, 1_000_000_000_000_000); // 1000 MEMO
        
        // 执行三重扣款
        let result = crate::Pallet::<Test>::triple_charge_storage_fee(&caller, deceased_id, amount);
        
        // 断言：从 Pool 扣款成功
        assert_ok!(result, 0);
        
        // 验证余额变化
        let escrow_account = OperatorEscrowAccount::get();
        assert_eq!(<Test as crate::Config>::Currency::free_balance(&escrow_account), amount);
        
        // 验证配额使用
        let (used, _) = <crate::pallet::PublicFeeQuotaUsage<Test>>::get(deceased_id);
        assert_eq!(used, amount);
    });
}

/// 测试场景 2：超配额，Subject 充足
#[test]
fn triple_charge_from_subject_over_quota() {
    new_test_ext().execute_with(|| {
        let caller: AccountId = 1;
        let deceased_id: u64 = 100;
        let amount: Balance = 50_000_000_000_000; // 50 MEMO
        
        // 给 IpfsPoolAccount 充值
        let pool_account = IpfsPoolAccount::get();
        let _ = <Test as crate::Config>::Currency::deposit_creating(&pool_account, 1_000_000_000_000_000); // 1000 MEMO
        
        // 设置配额已用 95 MEMO（剩余 5 MEMO）
        let reset_block = System::block_number() + QuotaResetPeriod::get();
        <crate::pallet::PublicFeeQuotaUsage<Test>>::insert(
            deceased_id,
            (95_000_000_000_000u128, reset_block),
        );
        
        // 给 SubjectFunding 充值
        let subject_account = crate::Pallet::<Test>::derive_subject_funding_account(deceased_id);
        let _ = <Test as crate::Config>::Currency::deposit_creating(&subject_account, 200_000_000_000_000); // 200 MEMO
        
        // 执行三重扣款
        let result = crate::Pallet::<Test>::triple_charge_storage_fee(&caller, deceased_id, amount);
        
        // 断言：从 Subject 扣款成功
        assert_ok!(result, 1);
        
        // 验证余额变化
        let escrow_account = OperatorEscrowAccount::get();
        assert_eq!(<Test as crate::Config>::Currency::free_balance(&escrow_account), amount);
        assert_eq!(
            <Test as crate::Config>::Currency::free_balance(&subject_account),
            200_000_000_000_000 - amount
        );
    });
}

/// 测试场景 3：新用户，Caller 自费
#[test]
fn triple_charge_from_caller_fallback() {
    new_test_ext().execute_with(|| {
        let caller: AccountId = 1;
        let deceased_id: u64 = 100;
        let amount: Balance = 50_000_000_000_000; // 50 MEMO
        
        // IpfsPoolAccount 余额为 0（不充值）
        // SubjectFunding 余额为 0（不充值）
        // Caller 有充足余额（在 genesis 中已设置为 1_000_000_000_000）
        
        let caller_balance_before = <Test as crate::Config>::Currency::free_balance(&caller);
        
        // 执行三重扣款
        let result = crate::Pallet::<Test>::triple_charge_storage_fee(&caller, deceased_id, amount);
        
        // 断言：从 Caller 扣款成功
        assert_ok!(result, 2);
        
        // 验证余额变化
        let escrow_account = OperatorEscrowAccount::get();
        assert_eq!(<Test as crate::Config>::Currency::free_balance(&escrow_account), amount);
        assert_eq!(
            <Test as crate::Config>::Currency::free_balance(&caller),
            caller_balance_before - amount
        );
    });
}

/// 测试场景 4：三账户都不足
#[test]
fn triple_charge_all_three_accounts_insufficient() {
    new_test_ext().execute_with(|| {
        let caller: AccountId = 999; // 使用未充值的账户
        let deceased_id: u64 = 100;
        let amount: Balance = 50_000_000_000_000; // 50 MEMO
        
        // IpfsPoolAccount 余额为 0
        // SubjectFunding 余额为 0
        // Caller 余额为 0（999 账户未在 genesis 中设置）
        
        // 执行三重扣款
        let result = crate::Pallet::<Test>::triple_charge_storage_fee(&caller, deceased_id, amount);
        
        // 断言：所有账户都不足，返回错误
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            crate::pallet::Error::<Test>::AllThreeAccountsInsufficientBalance.into()
        );
    });
}

/// 测试场景 5：配额重置
#[test]
fn triple_charge_quota_reset() {
    new_test_ext().execute_with(|| {
        let caller: AccountId = 1;
        let deceased_id: u64 = 100;
        let amount: Balance = 50_000_000_000_000; // 50 MEMO
        
        // 给 IpfsPoolAccount 充值
        let pool_account = IpfsPoolAccount::get();
        let _ = <Test as crate::Config>::Currency::deposit_creating(&pool_account, 1_000_000_000_000_000); // 1000 MEMO
        
        // 设置配额已用 95 MEMO，并设置重置块为当前块（应触发重置）
        let current_block = System::block_number();
        <crate::pallet::PublicFeeQuotaUsage<Test>>::insert(
            deceased_id,
            (95_000_000_000_000u128, current_block),
        );
        
        // 执行三重扣款
        let result = crate::Pallet::<Test>::triple_charge_storage_fee(&caller, deceased_id, amount);
        
        // 断言：配额已重置，从 Pool 扣款成功
        assert_ok!(result, 0);
        
        // 验证配额已重置
        let (used, reset_block) = <crate::pallet::PublicFeeQuotaUsage<Test>>::get(deceased_id);
        assert_eq!(used, amount); // 重置后只用了 50 MEMO
        assert_eq!(reset_block, current_block + QuotaResetPeriod::get());
    });
}
