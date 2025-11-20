# 押金锁定机制 - 技术实现方案

**方案**: 固定汇率锁定（短期推荐）  
**实施时间**: 1周  
**状态**: 待实施

---

## 一、核心原则

### 1.1 固定汇率原则

```
所有与押金相关的计算，均使用锁定时的汇率
- 罚款扣除：按锁定时汇率
- 押金退还：按锁定时汇率  
- 余额查询：按锁定时汇率
```

### 1.2 双账本原则

```rust
// USDT账本：业务逻辑层（对用户可见）
available_usdt: 10 USDT
deducted_usdt: 0 USDT

// DUST账本：链上实际锁定（系统内部）
available_dust: 20 DUST (at rate 0.5)
deducted_dust: 0 DUST
```

**关键**：两个账本通过 `exchange_rate` 保持一致。

---

## 二、需要补充的函数

### 2.1 汇率转换辅助函数

```rust
impl<T: Config> Pallet<T> {
    /// 使用记录的锁定时汇率转换USDT→DUST
    pub(crate) fn usdt_to_dust_at_locked_rate(
        usdt_amount: u32,
        locked_rate: u64,
    ) -> Result<BalanceOf<T>, DispatchError> {
        ensure\!(locked_rate > 0, Error::<T>::InvalidExchangeRate);
        
        // USDT金额扩展到10^6精度
        let usdt_scaled = (usdt_amount as u128).saturating_mul(1_000_000u128);
        
        // DUST = (USDT * 1e6) * 1e12 / rate
        let dust_scaled = usdt_scaled
            .saturating_mul(1_000_000_000_000u128)
            .checked_div(locked_rate as u128)
            .ok_or(Error::<T>::ArithmeticOverflow)?;
        
        dust_scaled
            .try_into()
            .map_err(|_| Error::<T>::AmountOverflow)
    }
    
    /// 使用记录的锁定时汇率转换DUST→USDT（用于查询）
    pub(crate) fn dust_to_usdt_at_locked_rate(
        dust_amount: BalanceOf<T>,
        locked_rate: u64,
    ) -> Result<u32, DispatchError> {
        let dust_u128: u128 = dust_amount.try_into()
            .map_err(|_| Error::<T>::AmountOverflow)?;
        
        // USDT = (DUST * rate) / 1e12 / 1e6
        let usdt_scaled = dust_u128
            .saturating_mul(locked_rate as u128)
            .checked_div(1_000_000_000_000u128)
            .ok_or(Error::<T>::ArithmeticOverflow)?
            .checked_div(1_000_000u128)
            .ok_or(Error::<T>::ArithmeticOverflow)?;
        
        usdt_scaled
            .try_into()
            .map_err(|_| Error::<T>::AmountOverflow)
    }
}
```

---

### 2.2 罚款扣除函数

```rust
impl<T: Config> Pallet<T> {
    /// 扣除投诉罚款
    /// 
    /// ### 参数
    /// - `deceased_id`: 逝者ID
    /// - `penalty_usdt`: 罚款金额（USDT）
    /// - `penalty_receiver`: 罚款接收者（通常是treasury或投诉人）
    /// 
    /// ### 返回
    /// - Ok(实际扣除的DUST数量)
    /// - Err(余额不足/其他错误)
    pub fn deduct_deposit_penalty(
        deceased_id: u64,
        penalty_usdt: u32,
        penalty_receiver: T::AccountId,
    ) -> Result<BalanceOf<T>, DispatchError> {
        OwnerDepositRecords::<T>::try_mutate(deceased_id, |maybe_record| {
            let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
            
            // 1. 检查余额是否足够
            ensure\!(
                record.available_usdt >= penalty_usdt,
                Error::<T>::InsufficientDeposit
            );
            
            // 2. 按锁定时汇率计算需要扣除的DUST
            let dust_to_deduct = Self::usdt_to_dust_at_locked_rate(
                penalty_usdt,
                record.exchange_rate,
            )?;
            
            // 3. 检查DUST余额
            ensure\!(
                record.available_dust >= dust_to_deduct,
                Error::<T>::InsufficientDeposit
            );
            
            // 4. 更新USDT账本
            record.available_usdt = record.available_usdt.saturating_sub(penalty_usdt);
            record.deducted_usdt = record.deducted_usdt.saturating_add(penalty_usdt);
            
            // 5. 更新DUST账本
            record.available_dust = record.available_dust.saturating_sub(dust_to_deduct);
            record.deducted_dust = record.deducted_dust.saturating_add(dust_to_deduct);
            
            // 6. 转移被hold的DUST给罚款接收者
            T::Fungible::transfer_on_hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &record.owner,
                &penalty_receiver,
                dust_to_deduct,
                Precision::Exact,
                Restriction::Free,
                Fortitude::Force,
            )?;
            
            // 7. 更新当前锁定数量
            record.current_locked_dust = record.current_locked_dust.saturating_sub(dust_to_deduct);
            
            // 8. 检查状态（如果余额为0，标记为Depleted）
            if record.available_usdt == 0 {
                record.status = DepositStatus::Depleted;
            }
            
            Ok(dust_to_deduct)
        })
    }
}
```

---

### 2.3 押金退还函数

```rust
impl<T: Config> Pallet<T> {
    /// 退还押金（完全退还）
    /// 
    /// ### 使用场景
    /// - 删除逝者记录
    /// - 转移ownership后的原owner退款
    /// 
    /// ### 注意
    /// - 只能退还available部分（扣除罚款后的余额）
    /// - 按锁定时汇率退还
    pub fn refund_deposit(
        deceased_id: u64,
    ) -> Result<BalanceOf<T>, DispatchError> {
        OwnerDepositRecords::<T>::try_mutate(deceased_id, |maybe_record| {
            let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
            
            // 1. 检查状态
            ensure\!(
                record.status == DepositStatus::Active,
                Error::<T>::DepositNotRefundable
            );
            
            // 2. 计算可退还的DUST（按锁定时汇率）
            let refundable_dust = record.available_dust;
            
            ensure\!(
                refundable_dust > BalanceOf::<T>::zero(),
                Error::<T>::NoDepositToRefund
            );
            
            // 3. 释放hold的DUST
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &record.owner,
                refundable_dust,
                Precision::Exact,
            )?;
            
            // 4. 更新记录
            record.available_dust = BalanceOf::<T>::zero();
            record.available_usdt = 0;
            record.current_locked_dust = record.current_locked_dust.saturating_sub(refundable_dust);
            record.status = DepositStatus::Refunded;
            
            Ok(refundable_dust)
        })
    }
    
    /// 部分退还（按比例）
    /// 
    /// ### 使用场景
    /// - 降级内容规模
    /// - 用户申请部分退款
    pub fn refund_deposit_partial(
        deceased_id: u64,
        refund_ratio: Permill,  // 退还比例（0-100%）
    ) -> Result<BalanceOf<T>, DispatchError> {
        OwnerDepositRecords::<T>::try_mutate(deceased_id, |maybe_record| {
            let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
            
            ensure\!(
                record.status == DepositStatus::Active,
                Error::<T>::DepositNotRefundable
            );
            
            // 计算退还的USDT金额
            let refund_usdt = refund_ratio * record.available_usdt;
            
            // 转换为DUST
            let refund_dust = Self::usdt_to_dust_at_locked_rate(
                refund_usdt,
                record.exchange_rate,
            )?;
            
            ensure\!(
                record.available_dust >= refund_dust,
                Error::<T>::InsufficientDeposit
            );
            
            // 释放DUST
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &record.owner,
                refund_dust,
                Precision::Exact,
            )?;
            
            // 更新记录
            record.available_dust = record.available_dust.saturating_sub(refund_dust);
            record.available_usdt = record.available_usdt.saturating_sub(refund_usdt);
            record.current_locked_dust = record.current_locked_dust.saturating_sub(refund_dust);
            
            Ok(refund_dust)
        })
    }
}
```

---

### 2.4 查询函数（RPC）

```rust
impl<T: Config> Pallet<T> {
    /// 查询押金状态
    /// 
    /// ### 返回值
    /// - available_usdt: 可用余额（USDT）
    /// - locked_dust: 实际锁定的DUST
    /// - current_value_usdt: 当前市场价值（按最新汇率）
    /// - locked_rate: 锁定时汇率
    pub fn get_deposit_status(
        deceased_id: u64,
    ) -> Result<(u32, BalanceOf<T>, u32, u64), DispatchError> {
        let record = OwnerDepositRecords::<T>::get(deceased_id)
            .ok_or(Error::<T>::DepositNotFound)?;
        
        // 计算当前市场价值（仅供参考）
        let current_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
            .unwrap_or(record.exchange_rate);
        let current_value = Self::dust_to_usdt_at_locked_rate(
            record.current_locked_dust,
            current_rate,
        ).unwrap_or(0);
        
        Ok((
            record.available_usdt,
            record.current_locked_dust,
            current_value,
            record.exchange_rate,
        ))
    }
}
```

---

## 三、需要添加的错误类型

```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...
    
    /// 押金记录不存在
    DepositNotFound,
    
    /// 押金余额不足
    InsufficientDeposit,
    
    /// 无可退还押金
    NoDepositToRefund,
    
    /// 押金状态不允许退款
    DepositNotRefundable,
    
    /// 无效的汇率
    InvalidExchangeRate,
    
    /// 算术溢出
    ArithmeticOverflow,
    
    /// 金额溢出
    AmountOverflow,
}
```

---

## 四、需要添加的事件

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 现有事件 ...
    
    /// 押金罚款已扣除
    /// [deceased_id, penalty_usdt, deducted_dust, receiver]
    DepositPenaltyDeducted {
        deceased_id: u64,
        penalty_usdt: u32,
        deducted_dust: BalanceOf<T>,
        receiver: T::AccountId,
    },
    
    /// 押金已退还
    /// [deceased_id, refunded_usdt, refunded_dust, owner]
    DepositRefunded {
        deceased_id: u64,
        refunded_usdt: u32,
        refunded_dust: BalanceOf<T>,
        owner: T::AccountId,
    },
    
    /// 押金状态已更新
    /// [deceased_id, new_status]
    DepositStatusUpdated {
        deceased_id: u64,
        new_status: DepositStatus,
    },
}
```

---

## 五、集成到现有Extrinsics

### 5.1 在投诉处理中扣除罚款

```rust
// 在 pallet-deceased 的投诉处理逻辑中
pub fn handle_complaint_verdict(
    deceased_id: T::DeceasedId,
    guilty: bool,
    penalty_usdt: u32,
) -> DispatchResult {
    if guilty && penalty_usdt > 0 {
        let deceased_id_u64: u64 = deceased_id.try_into()
            .map_err(|_| Error::<T>::BadInput)?;
        
        // 扣除押金作为罚款
        let deducted_dust = Self::deduct_deposit_penalty(
            deceased_id_u64,
            penalty_usdt,
            T::TreasuryAccount::get(),  // 罚款进treasury
        )?;
        
        Self::deposit_event(Event::DepositPenaltyDeducted {
            deceased_id: deceased_id_u64,
            penalty_usdt,
            deducted_dust,
            receiver: T::TreasuryAccount::get(),
        });
    }
    
    Ok(())
}
```

---

### 5.2 在删除逝者时退还押金

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 删除逝者（退还押金）
    #[pallet::weight(10_000)]
    pub fn delete_deceased(
        origin: OriginFor<T>,
        deceased_id: T::DeceasedId,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;
        Self::ensure_owner(deceased_id, &who)?;
        
        // 退还押金
        let deceased_id_u64: u64 = deceased_id.try_into()
            .map_err(|_| Error::<T>::BadInput)?;
        
        if let Ok(refunded_dust) = Self::refund_deposit(deceased_id_u64) {
            let record = OwnerDepositRecords::<T>::get(deceased_id_u64)
                .ok_or(Error::<T>::DepositNotFound)?;
            
            Self::deposit_event(Event::DepositRefunded {
                deceased_id: deceased_id_u64,
                refunded_usdt: record.initial_deposit_usdt.saturating_sub(record.deducted_usdt),
                refunded_dust,
                owner: who.clone(),
            });
        }
        
        // 删除逝者记录
        DeceasedOf::<T>::remove(deceased_id);
        OwnerDepositRecords::<T>::remove(deceased_id_u64);
        
        Ok(())
    }
}
```

---

## 六、单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_deduct_penalty_works() {
        new_test_ext().execute_with(|| {
            // 1. 创建逝者（锁定20 DUST @ 0.5 USDT/DUST）
            assert_ok\!(Deceased::create_deceased(
                origin(ALICE),
                // ... params ...
            ));
            
            let record = OwnerDepositRecords::<Test>::get(0).unwrap();
            assert_eq\!(record.available_usdt, 10);
            assert_eq\!(record.available_dust, 20_000_000_000_000); // 20 DUST
            
            // 2. 扣除3 USDT罚款
            assert_ok\!(Deceased::deduct_deposit_penalty(
                0,
                3,
                TREASURY,
            ));
            
            // 3. 验证扣除（按锁定时汇率：3 USDT = 6 DUST）
            let record = OwnerDepositRecords::<Test>::get(0).unwrap();
            assert_eq\!(record.available_usdt, 7);  // 10 - 3
            assert_eq\!(record.deducted_usdt, 3);
            assert_eq\!(record.available_dust, 14_000_000_000_000); // 20 - 6
            
            // 4. 验证DUST实际转移
            assert_eq\!(Balances::free_balance(TREASURY), 6_000_000_000_000);
        });
    }
    
    #[test]
    fn test_refund_deposit_works() {
        new_test_ext().execute_with(|| {
            // 创建并立即删除
            assert_ok\!(Deceased::create_deceased(origin(ALICE), ...));
            assert_ok\!(Deceased::delete_deceased(origin(ALICE), 0));
            
            // 验证押金退还（20 DUST）
            let alice_balance = Balances::free_balance(ALICE);
            assert_eq\!(alice_balance, INITIAL_BALANCE); // 完全退还
        });
    }
    
    #[test]
    fn test_penalty_exceeds_balance_fails() {
        new_test_ext().execute_with(|| {
            assert_ok\!(Deceased::create_deceased(origin(ALICE), ...));
            
            // 尝试扣除15 USDT（超过10 USDT押金）
            assert_noop\!(
                Deceased::deduct_deposit_penalty(0, 15, TREASURY),
                Error::<Test>::InsufficientDeposit
            );
        });
    }
}
```

---

## 七、前端集成建议

### 7.1 显示押金信息

```typescript
// 查询押金状态
const depositStatus = await api.query.deceased.ownerDepositRecords(deceasedId);

// 显示给用户
console.log({
  lockedUSDT: depositStatus.availableUsdt,           // 10 USDT
  lockedDUST: depositStatus.currentLockedDust,       // 20 DUST
  lockedRate: depositStatus.exchangeRate,            // 500000 (0.5 USDT/DUST)
  lockedAt: depositStatus.lockedAt,
  
  // 计算当前市场价值（仅供参考）
  currentValue: lockedDUST * currentMarketRate,
});

// 提示用户
if (currentValue < lockedUSDT) {
  showWarning("DUST价格已下跌，当前押金市场价值低于锁定时的价值");
}
```

### 7.2 汇率风险提示

```typescript
// 在创建逝者时显示
<Alert type="warning">
  您将锁定 {dustAmount} DUST (约 10 USDT)
  锁定时汇率：1 DUST = {rate} USDT
  
  ⚠️ 重要：
  - 罚款扣除将按此汇率计算
  - DUST价格波动不影响罚款金额
  - 退款时也将按此汇率计算
</Alert>
```

---

## 八、实施清单

- [ ] 1. 添加辅助函数（usdt_to_dust_at_locked_rate等）
- [ ] 2. 实现deduct_deposit_penalty函数
- [ ] 3. 实现refund_deposit函数
- [ ] 4. 添加新的错误类型
- [ ] 5. 添加新的事件
- [ ] 6. 集成到投诉处理逻辑
- [ ] 7. 集成到delete_deceased
- [ ] 8. 编写单元测试
- [ ] 9. 更新文档
- [ ] 10. 前端集成

**预计工作量**: 3-5天

---

## 九、验收标准

✅ **功能完整性**
- 罚款扣除正确（按锁定时汇率）
- 押金退还正确（按锁定时汇率）
- 双账本一致（USDT/DUST）

✅ **边界测试**
- 罚款超额被拒绝
- 零余额状态正确
- 汇率为0被拒绝

✅ **事件正确**
- 扣除事件包含完整信息
- 退款事件包含完整信息

✅ **文档完善**
- 用户文档说明汇率风险
- 开发文档说明实现细节
