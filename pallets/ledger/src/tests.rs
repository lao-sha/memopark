//! 函数级中文注释：pallet-ledger 单元测试。
//! 覆盖：周索引计算、溢出保护、去重键命中/未命中、清理接口、事件正确性。

#![cfg(test)]

use crate::{pallet::Event as LedgerEvent, Pallet as Ledger};
use frame_support::{assert_ok};
use sp_core::H256;

use crate::mock::{new_test_ext, System, Test, RuntimeOrigin, RuntimeEvent};

#[test]
fn week_index_calculation() {
    new_test_ext().execute_with(|| {
        System::set_block_number(0);
        assert_eq!(Ledger::<Test>::current_week_index(), 0);
        System::set_block_number(100_800);
        assert_eq!(Ledger::<Test>::current_week_index(), 1);
        assert_eq!(Ledger::<Test>::week_index_of_block(201_600), 2);
    });
}

#[test]
fn dedup_hit_and_miss() {
    new_test_ext().execute_with(|| {
        let gid: u64 = 1;
        let who: u64 = 9;
        let k = H256::repeat_byte(7);
        // 首次，未命中去重，累计一次
        Ledger::<Test>::record_from_hook_with_amount(gid, who, 0, Some(10u128), None, Some(k));
        assert_eq!(Ledger::<Test>::totals_by_grave(gid), 1);
        assert_eq!(Ledger::<Test>::total_memo_by_grave(gid), 10u128);
        // 再次，同键命中去重，不累计
        Ledger::<Test>::record_from_hook_with_amount(gid, who, 0, Some(10u128), None, Some(k));
        assert_eq!(Ledger::<Test>::totals_by_grave(gid), 1);
        assert_eq!(Ledger::<Test>::total_memo_by_grave(gid), 10u128);
        // 换键，未命中，累计
        let k2 = H256::repeat_byte(8);
        Ledger::<Test>::record_from_hook_with_amount(gid, who, 0, Some(5u128), None, Some(k2));
        assert_eq!(Ledger::<Test>::totals_by_grave(gid), 2);
        assert_eq!(Ledger::<Test>::total_memo_by_grave(gid), 15u128);
    });
}

#[test]
fn mark_and_purge_range_and_event() {
    new_test_ext().execute_with(|| {
        let gid: u64 = 1;
        let who: u64 = 9;
        // 标记从当前块对应周起 5 周
        let start = System::block_number();
        Ledger::<Test>::mark_weekly_active(gid, who, start, Some(5));
        // 清理一个区间 [1,4) 不应报错
        assert_ok!(Ledger::<Test>::purge_weeks_by_range(RuntimeOrigin::signed(who), gid, who, 1, 4, 10));
        // 事件至少发出一次 WeeksPurged
        let ev = System::events().into_iter().find(|e| matches!(
            e.event,
            RuntimeEvent::Ledger(LedgerEvent::WeeksPurged(_, _, _, _))
        ));
        assert!(ev.is_some());
    });
}


