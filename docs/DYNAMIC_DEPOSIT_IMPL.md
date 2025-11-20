# 动态调整押金 - 完整实现代码

**基于**: DYNAMIC_DEPOSIT_CORE.md  
**状态**: 可直接集成到pallet-deceased

---

## 一、完整代码实现

### 1.1 类型定义（types.rs或governance.rs）

```rust
use frame_support::pallet_prelude::*;
use sp_runtime::Permill;

/// 调整类型
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum AdjustmentType {
    /// 用户主动补充
    Supplement,
    /// 用户主动解锁
    Unlock,
    /// 系统强制补充
    ForcedSupplement,
}

/// 押金调整记录
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct DepositAdjustment<T: Config> {
    pub adjustment_type: AdjustmentType,
    pub dust_amount: BalanceOf<T>,
    pub exchange_rate: u64,
    pub usdt_equivalent: u32,
    pub adjusted_at: BlockNumberFor<T>,
    pub reason: BoundedVec<u8, ConstU32<128>>,
}

/// 补充警告
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct SupplementWarning<T: Config> {
    pub warned_at: BlockNumberFor<T>,
    pub required_usdt: u32,
    pub required_dust: BalanceOf<T>,
    pub deadline: BlockNumberFor<T>,
    pub warning_rate: u64,
}

/// 检查结果
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum DepositCheckResult {
    BelowThreshold {
        current_value: u32,
        required: u32,
        shortfall: u32,
    },
    InSafeRange {
        current_value: u32,
        target: u32,
    },
    AboveThreshold {
        current_value: u32,
        target: u32,
        unlockable: u32,
    },
}
```

---

### 1.2 扩展 OwnerDepositRecord

```rust
// 在 governance.rs 中修改现有结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OwnerDepositRecord<T: Config> {
    pub owner: T::AccountId,
    pub deceased_id: u64,
    
    // 新增：目标押金
    pub target_deposit_usdt: u32,
    
    pub initial_deposit_usdt: u32,
    pub initial_deposit_dust: BalanceOf<T>,
    pub current_locked_dust: BalanceOf<T>,
    
    pub available_usdt: u32,
    pub available_dust: BalanceOf<T>,
    pub deducted_usdt: u32,
    pub deducted_dust: BalanceOf<T>,
    
    pub locked_at: BlockNumberFor<T>,
    pub exchange_rate: u64,
    pub expected_scale: ContentScale,
    pub status: DepositStatus,
    
    // 新增：调整历史
    pub adjustments: BoundedVec<DepositAdjustment<T>, ConstU32<50>>,
    
    // 新增：补充警告
    pub supplement_warning: Option<SupplementWarning<T>>,
}
```

---

### 1.3 Extrinsics实现

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 补充押金
    #[pallet::weight(T::WeightInfo::supplement_deposit())]
    #[pallet::call_index(100)]  // 分配新的call index
    pub fn supplement_deposit(
        origin: OriginFor<T>,
        deceased_id: T::DeceasedId,
        dust_amount: BalanceOf<T>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;
        let deceased_id_u64: u64 = deceased_id.try_into()
            .map_err(|_| Error::<T>::BadInput)?;
        
        OwnerDepositRecords::<T>::try_mutate(deceased_id_u64, |maybe_record| {
            let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
            ensure!(record.owner == who, Error::<T>::NotAuthorized);
            
            // 获取当前汇率
            let current_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;
            
            // 锁定DUST
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &who,
                dust_amount,
            )?;
            
            // 更新记录
            record.current_locked_dust = record.current_locked_dust.saturating_add(dust_amount);
            
            // 计算USDT等价值
            let usdt_equivalent = Self::calculate_dust_value_in_usdt(dust_amount, current_rate)?;
            
            // 记录调整历史
            let adjustment = DepositAdjustment {
                adjustment_type: AdjustmentType::Supplement,
                dust_amount,
                exchange_rate: current_rate,
                usdt_equivalent,
                adjusted_at: <frame_system::Pallet<T>>::block_number(),
                reason: b"User supplemented deposit".to_vec().try_into().unwrap_or_default(),
            };
            let _ = record.adjustments.try_push(adjustment);
            
            // 清除警告
            record.supplement_warning = None;
            
            Self::deposit_event(Event::DepositSupplemented {
                deceased_id: deceased_id_u64,
                dust_amount,
                usdt_equivalent,
                owner: who,
            });
            
            Ok(())
        })
    }
    
    /// 解锁多余押金
    #[pallet::weight(T::WeightInfo::unlock_excess_deposit())]
    #[pallet::call_index(101)]
    pub fn unlock_excess_deposit(
        origin: OriginFor<T>,
        deceased_id: T::DeceasedId,
        dust_amount: BalanceOf<T>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;
        let deceased_id_u64: u64 = deceased_id.try_into()
            .map_err(|_| Error::<T>::BadInput)?;
        
        OwnerDepositRecords::<T>::try_mutate(deceased_id_u64, |maybe_record| {
            let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
            ensure!(record.owner == who, Error::<T>::NotAuthorized);
            
            let current_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
                .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;
            
            // 检查当前价值
            let current_value = Self::calculate_dust_value_in_usdt(
                record.current_locked_dust,
                current_rate,
            )?;
            let target = record.target_deposit_usdt;
            ensure!(current_value > target, Error::<T>::NoExcessDeposit);
            
            // 计算解锁后价值
            let unlock_value = Self::calculate_dust_value_in_usdt(dust_amount, current_rate)?;
            let remaining_value = current_value.saturating_sub(unlock_value);
            ensure!(remaining_value >= target, Error::<T>::UnlockWouldBelowTarget);
            
            // 释放DUST
            T::Fungible::release(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &who,
                dust_amount,
                Precision::Exact,
            )?;
            
            record.current_locked_dust = record.current_locked_dust.saturating_sub(dust_amount);
            
            let adjustment = DepositAdjustment {
                adjustment_type: AdjustmentType::Unlock,
                dust_amount,
                exchange_rate: current_rate,
                usdt_equivalent: unlock_value,
                adjusted_at: <frame_system::Pallet<T>>::block_number(),
                reason: b"User unlocked excess".to_vec().try_into().unwrap_or_default(),
            };
            let _ = record.adjustments.try_push(adjustment);
            
            Self::deposit_event(Event::DepositUnlocked {
                deceased_id: deceased_id_u64,
                dust_amount,
                usdt_equivalent: unlock_value,
                owner: who,
            });
            
            Ok(())
        })
    }
    
    /// 强制补充押金（治理）
    #[pallet::weight(T::WeightInfo::force_supplement_deposit())]
    #[pallet::call_index(102)]
    pub fn force_supplement_deposit(
        origin: OriginFor<T>,
        deceased_id: T::DeceasedId,
        dust_amount: BalanceOf<T>,
    ) -> DispatchResult {
        T::GovernanceOrigin::ensure_origin(origin)?;
        
        let deceased_id_u64: u64 = deceased_id.try_into()
            .map_err(|_| Error::<T>::BadInput)?;
        
        OwnerDepositRecords::<T>::try_mutate(deceased_id_u64, |maybe_record| {
            let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
            
            let warning = record.supplement_warning.as_ref()
                .ok_or(Error::<T>::NoSupplementWarning)?;
            
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now > warning.deadline, Error::<T>::DeadlineNotReached);
            
            let result = T::Fungible::hold(
                &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
                &record.owner,
                dust_amount,
            );
            
            let current_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
                .unwrap_or(warning.warning_rate);
            
            match result {
                Ok(_) => {
                    record.current_locked_dust = record.current_locked_dust.saturating_add(dust_amount);
                    record.supplement_warning = None;
                    
                    let usdt_equivalent = Self::calculate_dust_value_in_usdt(dust_amount, current_rate)?;
                    let adjustment = DepositAdjustment {
                        adjustment_type: AdjustmentType::ForcedSupplement,
                        dust_amount,
                        exchange_rate: current_rate,
                        usdt_equivalent,
                        adjusted_at: now,
                        reason: b"Forced by governance".to_vec().try_into().unwrap_or_default(),
                    };
                    let _ = record.adjustments.try_push(adjustment);
                    
                    Self::deposit_event(Event::DepositForcedSupplemented {
                        deceased_id: deceased_id_u64,
                        dust_amount,
                        owner: record.owner.clone(),
                    });
                }
                Err(_) => {
                    record.status = DepositStatus::Depleted;
                    record.supplement_warning = None;
                    
                    Self::deposit_event(Event::DepositDepleted {
                        deceased_id: deceased_id_u64,
                        owner: record.owner.clone(),
                    });
                }
            }
            
            Ok(())
        })
    }
}
```

---

### 1.4 辅助函数

```rust
impl<T: Config> Pallet<T> {
    /// 检查并触发调整
    pub(crate) fn check_and_trigger_adjustment(
        deceased_id: u64,
    ) -> Result<DepositCheckResult, DispatchError> {
        let mut record = OwnerDepositRecords::<T>::get(deceased_id)
            .ok_or(Error::<T>::DepositNotFound)?;
        
        let current_rate = governance::ExchangeRateHelper::<T>::get_cached_rate()
            .map_err(|_| Error::<T>::ExchangeRateUnavailable)?;
        
        let current_value = Self::calculate_dust_value_in_usdt(
            record.current_locked_dust,
            current_rate,
        )?;
        
        let target = record.target_deposit_usdt;
        let lower = target * 80 / 100;  // 8 USDT
        let upper = target * 120 / 100; // 12 USDT
        
        let result = if current_value < lower {
            if record.supplement_warning.is_none() {
                Self::issue_supplement_warning(&mut record, current_rate, current_value)?;
            }
            DepositCheckResult::BelowThreshold {
                current_value,
                required: target,
                shortfall: target.saturating_sub(current_value),
            }
        } else if current_value > upper {
            record.supplement_warning = None;
            DepositCheckResult::AboveThreshold {
                current_value,
                target,
                unlockable: current_value.saturating_sub(target),
            }
        } else {
            record.supplement_warning = None;
            DepositCheckResult::InSafeRange { current_value, target }
        };
        
        OwnerDepositRecords::<T>::insert(deceased_id, record);
        Ok(result)
    }
    
    /// 发出补充警告
    fn issue_supplement_warning(
        record: &mut OwnerDepositRecord<T>,
        current_rate: u64,
        current_value: u32,
    ) -> DispatchResult {
        let now = <frame_system::Pallet<T>>::block_number();
        let required_usdt = record.target_deposit_usdt.saturating_sub(current_value);
        let required_dust = Self::usdt_to_dust_at_rate(required_usdt, current_rate)?;
        let deadline = now.saturating_add(100_800u32.into()); // 7天
        
        record.supplement_warning = Some(SupplementWarning {
            warned_at: now,
            required_usdt,
            required_dust,
            deadline,
            warning_rate: current_rate,
        });
        
        Self::deposit_event(Event::SupplementWarningIssued {
            deceased_id: record.deceased_id,
            required_usdt,
            required_dust,
            deadline,
        });
        
        Ok(())
    }
    
    /// 计算DUST的USDT价值
    pub(crate) fn calculate_dust_value_in_usdt(
        dust_amount: BalanceOf<T>,
        rate: u64,
    ) -> Result<u32, DispatchError> {
        let dust_u128: u128 = dust_amount.try_into()
            .map_err(|_| Error::<T>::AmountOverflow)?;
        
        let usdt = dust_u128
            .saturating_mul(rate as u128)
            .checked_div(1_000_000_000_000u128)
            .ok_or(Error::<T>::ArithmeticOverflow)?
            .checked_div(1_000_000u128)
            .ok_or(Error::<T>::ArithmeticOverflow)?;
        
        usdt.try_into().map_err(|_| Error::<T>::AmountOverflow)
    }
    
    /// USDT转DUST
    pub(crate) fn usdt_to_dust_at_rate(
        usdt_amount: u32,
        rate: u64,
    ) -> Result<BalanceOf<T>, DispatchError> {
        ensure!(rate > 0, Error::<T>::InvalidExchangeRate);
        
        let usdt_scaled = (usdt_amount as u128).saturating_mul(1_000_000u128);
        let dust = usdt_scaled
            .saturating_mul(1_000_000_000_000u128)
            .checked_div(rate as u128)
            .ok_or(Error::<T>::ArithmeticOverflow)?;
        
        dust.try_into().map_err(|_| Error::<T>::AmountOverflow)
    }
}
```

---

### 1.5 Hooks实现

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_idle(_n: BlockNumberFor<T>, remaining_weight: Weight) -> Weight {
        // 每100块检查一次
        if _n % 100u32.into() != BlockNumberFor::<T>::zero() {
            return Weight::zero();
        }
        
        let mut checked = 0u32;
        let max_checks = 10u32;
        
        for (deceased_id, _) in OwnerDepositRecords::<T>::iter() {
            if checked >= max_checks {
                break;
            }
            let _ = Self::check_and_trigger_adjustment(deceased_id);
            checked += 1;
        }
        
        Weight::from_parts(checked as u64 * 10_000, 0)
    }
}
```

---

### 1.6 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 现有事件 ...
    
    /// 补充警告已发出
    SupplementWarningIssued {
        deceased_id: u64,
        required_usdt: u32,
        required_dust: BalanceOf<T>,
        deadline: BlockNumberFor<T>,
    },
    
    /// 押金已补充
    DepositSupplemented {
        deceased_id: u64,
        dust_amount: BalanceOf<T>,
        usdt_equivalent: u32,
        owner: T::AccountId,
    },
    
    /// 押金已解锁
    DepositUnlocked {
        deceased_id: u64,
        dust_amount: BalanceOf<T>,
        usdt_equivalent: u32,
        owner: T::AccountId,
    },
    
    /// 押金已强制补充
    DepositForcedSupplemented {
        deceased_id: u64,
        dust_amount: BalanceOf<T>,
        owner: T::AccountId,
    },
    
    /// 押金已耗尽
    DepositDepleted {
        deceased_id: u64,
        owner: T::AccountId,
    },
}
```

---

### 1.7 错误定义

```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...
    
    /// 押金记录不存在
    DepositNotFound,
    
    /// 无多余押金可解锁
    NoExcessDeposit,
    
    /// 解锁会导致低于目标值
    UnlockWouldBelowTarget,
    
    /// 无补充警告
    NoSupplementWarning,
    
    /// 未到期限
    DeadlineNotReached,
    
    /// 汇率不可用
    ExchangeRateUnavailable,
    
    /// 无效汇率
    InvalidExchangeRate,
    
    /// 算术溢出
    ArithmeticOverflow,
    
    /// 金额溢出
    AmountOverflow,
}
```

---

## 二、单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn supplement_deposit_works() {
        new_test_ext().execute_with(|| {
            // 1. 创建逝者（20 DUST @ 0.5 = 10 USDT）
            assert_ok!(Deceased::create_deceased(origin(ALICE), ...));
            
            // 2. 模拟DUST跌价（0.5 → 0.35）
            MockPricing::set_rate(350_000); // 0.35 USDT/DUST
            
            // 3. 检查触发警告
            let result = Deceased::check_and_trigger_adjustment(0).unwrap();
            assert!(matches!(result, DepositCheckResult::BelowThreshold { .. }));
            
            // 4. 补充9 DUST
            assert_ok!(Deceased::supplement_deposit(origin(ALICE), 0, 9_000_000_000_000));
            
            // 5. 验证总量（29 DUST @ 0.35 ≈ 10 USDT）
            let record = OwnerDepositRecords::<Test>::get(0).unwrap();
            assert_eq!(record.current_locked_dust, 29_000_000_000_000);
            assert!(record.supplement_warning.is_none());
        });
    }
    
    #[test]
    fn unlock_excess_works() {
        new_test_ext().execute_with(|| {
            assert_ok!(Deceased::create_deceased(origin(ALICE), ...));
            
            // DUST涨价（0.5 → 1.0）
            MockPricing::set_rate(1_000_000);
            
            // 解锁8 DUST
            assert_ok!(Deceased::unlock_excess_deposit(origin(ALICE), 0, 8_000_000_000_000));
            
            // 验证剩余12 DUST
            let record = OwnerDepositRecords::<Test>::get(0).unwrap();
            assert_eq!(record.current_locked_dust, 12_000_000_000_000);
        });
    }
}
```

---

## 三、前端集成示例

```typescript
// 查询押金状态
const record = await api.query.deceased.ownerDepositRecords(deceasedId);
const currentRate = await api.query.pricing.currentExchangeRate();

// 计算当前价值
const currentValue = (record.currentLockedDust * currentRate) / 1e18;

// 显示状态
if (currentValue < 8) {
  showWarning(`押金不足！当前：${currentValue} USDT，需要补充到10 USDT`);
  if (record.supplementWarning) {
    const deadline = record.supplementWarning.deadline;
    showCountdown(`截止时间：${deadline}，剩余 ${getDaysLeft(deadline)} 天`);
  }
} else if (currentValue > 12) {
  const unlockable = currentValue - 10;
  showSuccess(`可解锁 ${unlockable} USDT (约 ${unlockable / currentRate} DUST)`);
}

// 补充按钮
async function supplementDeposit() {
  const required = 10 - currentValue;
  const dustRequired = required / currentRate * 1e12;
  
  await api.tx.deceased
    .supplementDeposit(deceasedId, dustRequired)
    .signAndSend(account);
}

// 解锁按钮
async function unlockExcess() {
  const unlockable = Math.floor((currentValue - 10) / currentRate * 1e12);
  
  await api.tx.deceased
    .unlockExcessDeposit(deceasedId, unlockable)
    .signAndSend(account);
}
```

---

## 四、配置参数（runtime/src/lib.rs）

```rust
parameter_types! {
    // 押金调整阈值
    pub const DepositLowerThreshold: Permill = Permill::from_percent(80);  // 8 USDT
    pub const DepositUpperThreshold: Permill = Permill::from_percent(120); // 12 USDT
    
    // 补充警告期限
    pub const SupplementDeadline: BlockNumber = 100_800; // 7天
    
    // 自动检查间隔
    pub const CheckInterval: BlockNumber = 100; // 10分钟
    pub const MaxChecksPerBlock: u32 = 10;
}
```

---

## 五、总结

### 实施清单

- [ ] 添加类型定义（DepositAdjustment, SupplementWarning等）
- [ ] 扩展 OwnerDepositRecord 结构
- [ ] 实现3个新extrinsics（supplement/unlock/force）
- [ ] 实现检查和警告逻辑
- [ ] 实现on_idle hook
- [ ] 添加辅助函数
- [ ] 添加事件和错误
- [ ] 编写单元测试
- [ ] 前端集成

**预计工作量**: 2-3周
