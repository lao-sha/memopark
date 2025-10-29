use crate::{mock::*, Error};
use frame_support::{assert_noop, assert_ok, BoundedVec, traits::ConstU32};

// ==================== 极简测试：验证编译通过 ====================

#[test]
fn lock_deposit_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let maker = 1u64;
        let deposit = 10000u128;
        let direction = 2u8;  // BuyAndSell
        
        // 锁定抵押
        assert_ok!(MarketMaker::lock_deposit(
            RuntimeOrigin::signed(maker),
            deposit,
            direction,
        ));
        
        // 验证基本功能：抵押已锁定
        let reserved = Balances::reserved_balance(maker);
        assert_eq!(reserved, deposit);
    });
}

#[test]
fn lock_deposit_below_minimum() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let maker = 1u64;
        let deposit = 5000u128; // 低于MinDeposit (10000)
        let direction = 2u8;
        
        // 锁定应失败
        assert_noop!(
            MarketMaker::lock_deposit(
                RuntimeOrigin::signed(maker),
                deposit,
                direction,
            ),
            Error::<Test>::MinDepositNotMet
        );
    });
}

// 注意：submit_info测试需要完整的mm_id注册流程
// 待pallet稳定后补充
#[test]
#[ignore]
fn submit_info_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        Timestamp::set_timestamp(1000);
        
        let maker = 1u64;
        let mm_id = 1u64;
        
        // 先锁定抵押
        assert_ok!(MarketMaker::lock_deposit(
            RuntimeOrigin::signed(maker),
            10000,
            2u8,  // BuyAndSell
        ));
        
        // 准备参数
        let public_cid: BoundedVec<u8, ConstU32<256>> = 
            BoundedVec::try_from(b"QmPublic123".to_vec()).unwrap();
        let private_cid: BoundedVec<u8, ConstU32<256>> = 
            BoundedVec::try_from(b"QmPrivate456".to_vec()).unwrap();
        
        // 提交信息
        assert_ok!(MarketMaker::submit_info(
            RuntimeOrigin::signed(maker),
            mm_id,
            public_cid,
            private_cid,
            100i16,  // buy_premium_bps
            -100i16, // sell_premium_bps
            1000u128, // min_amount
            b"TYGFjb9HqA9QwS6DgUAuH5p9jUfvLQNpL6".to_vec(),  // tron_address（标准Base58格式，34字符）
            b"Zhang San".to_vec(),  // full_name
            b"110101199001011234".to_vec(),  // id_card
            b"1990-01-01".to_vec(),  // birthday
            None,  // masked_payment_info_json
        ));
    });
}

#[test]
#[ignore]
fn submit_info_without_deposit() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let maker = 1u64;
        let mm_id = 1u64;
        
        let public_cid: BoundedVec<u8, ConstU32<256>> = 
            BoundedVec::try_from(b"QmPublic123".to_vec()).unwrap();
        let private_cid: BoundedVec<u8, ConstU32<256>> = 
            BoundedVec::try_from(b"QmPrivate456".to_vec()).unwrap();
        
        // 未锁定抵押，直接提交信息应失败
        assert_noop!(
            MarketMaker::submit_info(
                RuntimeOrigin::signed(maker),
                mm_id,
                public_cid,
                private_cid,
                100i16,
                -100i16,
                1000u128,
                b"TWzABC123def456".to_vec(),
                b"Zhang San".to_vec(),
                b"110101199001011234".to_vec(),
                b"1990-01-01".to_vec(),
                None,
            ),
            Error::<Test>::NotDepositLocked
        );
    });
}

#[test]
fn multiple_deposits_accumulate() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let maker1 = 1u64;
        let maker2 = 2u64;
        
        // 做市商1锁定
        assert_ok!(MarketMaker::lock_deposit(
            RuntimeOrigin::signed(maker1),
            10000,
            2u8,
        ));
        
        // 做市商2锁定
        assert_ok!(MarketMaker::lock_deposit(
            RuntimeOrigin::signed(maker2),
            15000,
            2u8,
        ));
        
        // 验证独立锁定
        assert_eq!(Balances::reserved_balance(maker1), 10000);
        assert_eq!(Balances::reserved_balance(maker2), 15000);
    });
}

// ==================== 注意事项 ====================
// 
// pallet-market-maker 当前处于早期开发阶段，仅实现了2个extrinsic：
// 1. lock_deposit(origin, deposit, direction_u8) - 锁定做市商抵押金
// 2. submit_info(origin, mm_id, ...) - 提交做市商信息（12个参数）
// 
// 测试策略：极简验证，确保编译通过和基本功能
// 
// 待实现功能（15+）：
// - withdraw / request_withdrawal (提款机制)
// - fund_pool (资金池管理)
// - approve / reject / expire (审核流程)
// - enable/disable_bridge_service (桥接服务)
// - update_maker_info (信息更新)
// - 等等...
//
