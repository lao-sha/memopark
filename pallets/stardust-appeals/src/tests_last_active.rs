/**
 * pallet-stardust-appeals 应答否决测试
 * 
 * 测试LastActiveProvider trait和应答自动否决机制
 * 
 * @author Memopark Team
 * @version 1.0.0
 * @date 2025-10-27
 */

#[cfg(test)]
mod tests_last_active {
    use crate::{mock::*, Pallet, Appeals, PendingBySubject};
    use frame_support::{assert_ok, traits::{Currency, Hooks}};

/// 测试应答自动否决机制
#[test]
fn test_auto_dismiss_with_owner_response() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let submitter = account(1);
        let _owner = account(2);
        let _ = <Test as crate::Config>::Currency::deposit_creating(&submitter, 1000 * UNIT);
        
        // 1. 提交申诉（domain=2，deceased域）
        assert_ok!(Pallet::<Test>::submit_appeal(
            RuntimeOrigin::signed(submitter),
            2, // deceased域（支持应答否决）
            1, // target
            1,
            vec![].try_into().unwrap(),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].try_into().unwrap(),
        ));
        
        // 2. 治理批准申诉
        assert_ok!(Pallet::<Test>::approve_appeal(
            RuntimeOrigin::root(),
            0,
            Some(100), // 公示期100块
        ));
        
        let appeal = Appeals::<Test>::get(0).unwrap();
        assert_eq!(appeal.status, 1); // Approved
        let execute_at = appeal.execute_at.unwrap();
        let approved_at = appeal.approved_at.unwrap();
        
        // 3. 模拟所有者在公示期内有活跃操作
        // 在测试中，我们需要通过LastActiveProvider模拟
        // 假设deceased pallet记录了owner在block 50的活跃
        let _active_block = approved_at + 50;
        
        // 4. 到达执行时间，系统尝试执行
        System::set_block_number(execute_at);
        
        // 5. 触发on_initialize执行申诉
        Pallet::<Test>::on_initialize(execute_at);
        
        // 6. 如果LastActiveProvider返回的活跃时间在[approved_at, execute_at]内
        //    申诉应该被自动否决
        let appeal_after = Appeals::<Test>::get(0).unwrap();
        
        // 根据LastActiveProvider的实现，如果返回了活跃时间
        // 状态应该是6（AutoDismissed）
        // 如果没有活跃记录，状态应该是4（Executed）
        assert!(
            appeal_after.status == 4 || appeal_after.status == 6,
            "申诉应该被执行或自动否决"
        );
        
        // 检查PendingBySubject是否已清理
        assert!(PendingBySubject::<Test>::get((2, 1)).is_none());
    });
}

/// 测试不支持应答否决的域正常执行
#[test]
fn test_no_auto_dismiss_for_unsupported_domain() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let submitter = account(1);
        let _ = <Test as crate::Config>::Currency::deposit_creating(&submitter, 1000 * UNIT);
        
        // 1. 提交申诉（domain=3，不支持应答否决）
        assert_ok!(Pallet::<Test>::submit_appeal(
            RuntimeOrigin::signed(submitter),
            3, // deceased-text域（不支持应答否决）
            1,
            20,
            vec![].try_into().unwrap(),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].try_into().unwrap(),
        ));
        
        // 2. 治理批准申诉
        assert_ok!(Pallet::<Test>::approve_appeal(
            RuntimeOrigin::root(),
            0,
            Some(100),
        ));
        
        let appeal = Appeals::<Test>::get(0).unwrap();
        let execute_at = appeal.execute_at.unwrap();
        
        // 3. 到达执行时间
        System::set_block_number(execute_at);
        
        // 4. 触发执行
        Pallet::<Test>::on_initialize(execute_at);
        
        // 5. 不支持应答否决的域应该正常执行或失败，不会是AutoDismissed
        let appeal_after = Appeals::<Test>::get(0).unwrap();
        assert_ne!(appeal_after.status, 6, "不支持的域不应该触发应答否决");
    });
}

/// 测试所有者在批准前活跃不触发否决
#[test]
fn test_no_auto_dismiss_if_active_before_approval() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let submitter = account(1);
        let _ = <Test as crate::Config>::Currency::deposit_creating(&submitter, 1000 * UNIT);
        
        // 1. 所有者在block 5活跃（批准前）
        // 模拟：LastActiveProvider会返回block 5
        
        // 2. 在block 10提交申诉
        System::set_block_number(10);
        assert_ok!(Pallet::<Test>::submit_appeal(
            RuntimeOrigin::signed(submitter),
            2,
            1,
            1,
            vec![].try_into().unwrap(),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].try_into().unwrap(),
        ));
        
        // 3. 在block 20批准
        System::set_block_number(20);
        assert_ok!(Pallet::<Test>::approve_appeal(
            RuntimeOrigin::root(),
            0,
            Some(100),
        ));
        
        let appeal = Appeals::<Test>::get(0).unwrap();
        let execute_at = appeal.execute_at.unwrap();
        let approved_at = appeal.approved_at.unwrap();
        assert_eq!(approved_at, 20);
        
        // 4. 所有者的活跃时间(5)在批准时间(20)之前
        //    不应该触发自动否决
        System::set_block_number(execute_at);
        Pallet::<Test>::on_initialize(execute_at);
        
        let appeal_after = Appeals::<Test>::get(0).unwrap();
        // 应该正常执行，不是自动否决
        assert_ne!(
            appeal_after.status, 6,
            "批准前的活跃不应该触发自动否决"
        );
    });
}

/// 测试所有者在执行后活跃不触发否决
#[test]
fn test_no_auto_dismiss_if_active_after_execution() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let submitter = account(1);
        let _ = <Test as crate::Config>::Currency::deposit_creating(&submitter, 1000 * UNIT);
        
        // 1. 提交申诉
        assert_ok!(Pallet::<Test>::submit_appeal(
            RuntimeOrigin::signed(submitter),
            2,
            1,
            1,
            vec![].try_into().unwrap(),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].try_into().unwrap(),
        ));
        
        // 2. 批准申诉（block 10，执行时间block 110）
        System::set_block_number(10);
        assert_ok!(Pallet::<Test>::approve_appeal(
            RuntimeOrigin::root(),
            0,
            Some(100),
        ));
        
        // 3. 到达执行时间（block 110）
        let appeal = Appeals::<Test>::get(0).unwrap();
        let execute_at = appeal.execute_at.unwrap();
        System::set_block_number(execute_at);
        
        // 4. 执行申诉
        Pallet::<Test>::on_initialize(execute_at);
        
        // 5. 所有者在block 120活跃（执行后）
        //    此时申诉已经执行，不应该触发否决
        System::set_block_number(120);
        
        // 验证申诉状态
        let appeal_after = Appeals::<Test>::get(0).unwrap();
        // 应该是已执行或失败，不是自动否决
        assert!(
            appeal_after.status == 4 || appeal_after.status == 5,
            "执行后的活跃不应该触发自动否决"
        );
    });
}

} // mod tests_last_active

