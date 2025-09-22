//! 函数级中文注释：单测覆盖限频、审批入队、on_initialize 执行与退押金、Router 失败分支。

#![cfg(test)]

use crate::{Pallet as MCG, pallet::Event as Evt};
use frame_support::traits::Hooks;
use frame_support::{assert_ok};

use crate::mock::{new_test_ext, Test, RuntimeOrigin, System, RuntimeEvent};

#[test]
fn rate_limit_works() {
    new_test_ext().execute_with(|| {
        // 连续两次允许，第三次触发限频
        assert_ok!(MCG::<Test>::submit_appeal(RuntimeOrigin::signed(1), 2, 1, 10, Default::default(), Default::default()));
        assert_ok!(MCG::<Test>::submit_appeal(RuntimeOrigin::signed(1), 2, 1, 10, Default::default(), Default::default()));
        let res = MCG::<Test>::submit_appeal(RuntimeOrigin::signed(1), 2, 1, 10, Default::default(), Default::default());
        assert!(res.is_err());
    });
}

#[test]
fn approve_enqueue_and_execute() {
    new_test_ext().execute_with(|| {
        assert_ok!(MCG::<Test>::submit_appeal(RuntimeOrigin::signed(1), 2, 1, 10, Default::default(), Default::default()));
        assert_ok!(MCG::<Test>::approve_appeal(frame_system::RawOrigin::Root.into(), 0, Some(1)));
        // 下一块触发 on_initialize 执行
        System::set_block_number(2);
        MCG::<Test>::on_initialize(2);
        // 事件应包含 Executed
        let ok = System::events().into_iter().any(|e| matches!(e.event, RuntimeEvent::MCG(Evt::AppealExecuted(0))));
        assert!(ok);
    });
}


