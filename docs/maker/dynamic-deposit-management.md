# 做市商动态押金管理系统

## 版本信息
- **文档版本**: v1.0
- **创建日期**: 2025-11-10
- **修订日期**: 2025-11-10
- **负责模块**: pallet-maker

## 概述

本文档定义做市商押金的动态管理机制，押金金额固定为1000 USDT等值的DUST，根据实时价格动态计算所需DUST数量，并实现自动补充机制。

## 设计原则

### 1. 固定美元价值
- **押金标准**: 固定1000 USDT等值
- **动态计算**: 根据pallet-pricing提供的DUST/USD汇率实时计算
- **价格精度**: 支持10^6精度的美元价格

### 2. 自动补充机制
- **监控触发**: 当押金价值低于1000 USDT时自动补充
- **补充阈值**: 押金价值低于950 USDT时触发补充
- **补充目标**: 补充至1050 USDT等值（预留5%缓冲）

## 技术实现

### 1. 数据结构修改

```rust
// 在 MakerApplication 中新增字段
pub struct MakerApplication<T: Config> {
    // 现有字段...

    /// 押金目标USD价值（固定1000 USDT，精度10^6）
    pub target_deposit_usd: u64, // = 1_000_000_000 (1000 USD)

    /// 上次价格检查时间
    pub last_price_check: BlockNumberFor<T>,

    /// 押金不足警告状态
    pub deposit_warning: bool,
}
```

### 2. 新增常量配置

```rust
// runtime/src/configs/mod.rs
pub mod maker_constants {
    use super::*;

    /// 做市商押金目标USD价值（1000 USD，精度10^6）
    pub const TargetDepositUsd: u64 = 1_000_000_000;

    /// 押金补充触发阈值（950 USD，精度10^6）
    pub const DepositReplenishThreshold: u64 = 950_000_000;

    /// 押金补充目标（1050 USD，精度10^6）
    pub const DepositReplenishTarget: u64 = 1_050_000_000;

    /// 价格检查间隔（区块数，每小时检查一次）
    pub const PriceCheckInterval: BlockNumber = 600; // 假设6s/block，600块=1小时
}
```

### 3. 核心接口设计

#### 3.1 押金计算接口

```rust
impl<T: Config> Pallet<T> {
    /// 计算指定USD价值对应的DUST数量
    ///
    /// # 参数
    /// - usd_value: USD价值（精度10^6）
    ///
    /// # 返回
    /// - Ok(BalanceOf<T>): 对应的DUST数量
    /// - Err(DispatchError): 价格不可用或计算错误
    pub fn calculate_dust_amount_for_usd(
        usd_value: u64
    ) -> Result<BalanceOf<T>, DispatchError> {
        // 获取当前DUST/USD价格
        let dust_to_usd_rate = T::Pricing::get_dust_to_usd_rate()
            .ok_or(Error::<T>::PriceNotAvailable)?;

        // 计算所需DUST数量
        // DUST数量 = USD价值 / (DUST/USD价格)
        let dust_amount = Self::calculate_dust_from_usd_rate(
            usd_value,
            dust_to_usd_rate
        )?;

        Ok(dust_amount)
    }

    /// 检查做市商押金是否充足
    ///
    /// # 参数
    /// - maker_id: 做市商ID
    ///
    /// # 返回
    /// - Ok(true): 押金充足
    /// - Ok(false): 押金不足，需要补充
    /// - Err(DispatchError): 检查失败
    pub fn check_deposit_sufficiency(
        maker_id: u64
    ) -> Result<bool, DispatchError> {
        let app = Self::maker_applications(maker_id)
            .ok_or(Error::<T>::MakerNotFound)?;

        // 计算当前押金的USD价值
        let current_usd_value = Self::calculate_usd_value_of_deposit(
            app.deposit
        )?;

        // 检查是否低于补充阈值
        Ok(current_usd_value >= T::DepositReplenishThreshold::get())
    }
}
```

#### 3.2 押金补充接口

```rust
impl<T: Config> Pallet<T> {
    /// 补充做市商押金
    ///
    /// # 参数
    /// - maker_id: 做市商ID
    ///
    /// # 返回
    /// - Ok(补充金额): 成功补充的DUST数量
    /// - Err(DispatchError): 补充失败
    pub fn replenish_maker_deposit(
        maker_id: u64
    ) -> Result<BalanceOf<T>, DispatchError> {
        MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> Result<BalanceOf<T>, DispatchError> {
            let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;

            // 确保做市商已激活
            ensure!(
                app.status == ApplicationStatus::Active,
                Error::<T>::MakerNotActive
            );

            // 计算补充目标数量
            let target_dust_amount = Self::calculate_dust_amount_for_usd(
                T::DepositReplenishTarget::get()
            )?;

            // 计算需要补充的金额
            let replenish_amount = target_dust_amount
                .saturating_sub(app.deposit);

            if replenish_amount.is_zero() {
                return Ok(replenish_amount);
            }

            // 锁定补充金额
            T::Currency::reserve(&app.owner, replenish_amount)
                .map_err(|_| Error::<T>::InsufficientBalance)?;

            // 更新押金金额
            app.deposit = app.deposit.saturating_add(replenish_amount);
            app.deposit_warning = false;
            app.last_price_check = frame_system::Pallet::<T>::block_number();

            // 发出补充事件
            Self::deposit_event(Event::DepositReplenished {
                maker_id,
                amount: replenish_amount,
                total_deposit: app.deposit,
            });

            Ok(replenish_amount)
        })
    }
}
```

### 4. 自动检查机制

#### 4.1 定期价格检查

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_initialize(n: BlockNumberFor<T>) -> Weight {
        // 每小时检查一次做市商押金
        if n % T::PriceCheckInterval::get() == BlockNumberFor::<T>::zero() {
            let _ = Self::check_all_maker_deposits();
        }

        Weight::from_parts(10_000, 0) // 基础权重
    }
}

impl<T: Config> Pallet<T> {
    /// 检查所有活跃做市商的押金状况
    fn check_all_maker_deposits() -> Weight {
        let mut total_weight = Weight::zero();
        let mut checked_count = 0u32;

        // 遍历所有做市商（实际应该维护一个活跃做市商列表）
        for maker_id in 1..=Self::next_maker_id() {
            if let Some(app) = Self::maker_applications(maker_id) {
                if app.status != ApplicationStatus::Active {
                    continue;
                }

                // 检查押金是否充足
                match Self::check_deposit_sufficiency(maker_id) {
                    Ok(false) => {
                        // 押金不足，设置警告状态
                        Self::set_deposit_warning(maker_id, true);

                        // 触发押金不足事件
                        Self::deposit_event(Event::DepositInsufficient {
                            maker_id,
                            current_usd_value: Self::calculate_usd_value_of_deposit(
                                app.deposit
                            ).unwrap_or_default(),
                        });
                    },
                    Ok(true) => {
                        // 押金充足，清除警告状态
                        Self::set_deposit_warning(maker_id, false);
                    },
                    Err(_) => {
                        // 检查失败，记录日志但不中断
                        continue;
                    }
                }

                checked_count += 1;
                total_weight = total_weight.saturating_add(Weight::from_parts(5_000, 0));

                // 防止单次检查过多做市商
                if checked_count >= 50 {
                    break;
                }
            }
        }

        total_weight
    }
}
```

## 事件定义

```rust
#[pallet::event]
pub enum Event<T: Config> {
    // 现有事件...

    /// 押金已补充
    DepositReplenished {
        maker_id: u64,
        amount: BalanceOf<T>,
        total_deposit: BalanceOf<T>,
    },

    /// 押金不足警告
    DepositInsufficient {
        maker_id: u64,
        current_usd_value: u64,
    },

    /// 押金检查完成
    DepositCheckCompleted {
        checked_count: u32,
        insufficient_count: u32,
    },
}
```

## 错误定义

```rust
#[pallet::error]
pub enum Error<T> {
    // 现有错误...

    /// 价格不可用
    PriceNotAvailable,

    /// 押金计算溢出
    DepositCalculationOverflow,

    /// 押金不足且无法补充
    CannotReplenishDeposit,
}
```

## 外部接口

### 1. 手动补充押金

```rust
/// 做市商主动补充押金
#[pallet::call_index(9)]
#[pallet::weight(T::WeightInfo::replenish_deposit())]
pub fn replenish_deposit(origin: OriginFor<T>) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 获取做市商ID
    let maker_id = Self::account_to_maker(&who)
        .ok_or(Error::<T>::MakerNotFound)?;

    // 执行补充
    let _amount = Self::replenish_maker_deposit(maker_id)?;

    Ok(())
}
```

### 2. 查询押金状态

```rust
impl<T: Config> Pallet<T> {
    /// 查询做市商押金的USD价值
    pub fn get_deposit_usd_value(maker_id: u64) -> Result<u64, DispatchError> {
        let app = Self::maker_applications(maker_id)
            .ok_or(Error::<T>::MakerNotFound)?;

        Self::calculate_usd_value_of_deposit(app.deposit)
    }

    /// 查询做市商是否需要补充押金
    pub fn needs_deposit_replenishment(maker_id: u64) -> bool {
        Self::check_deposit_sufficiency(maker_id)
            .map(|sufficient| !sufficient)
            .unwrap_or(true)
    }
}
```

## 迁移方案

### 1. 存储迁移

```rust
pub mod v2 {
    use super::*;

    pub fn migrate<T: Config>() -> Weight {
        let mut migrated = 0u32;

        // 为所有现有做市商设置新的押金字段
        MakerApplications::<T>::translate(|_key, mut app: MakerApplicationOld<T>| {
            // 设置默认值
            app.target_deposit_usd = 1_000_000_000; // 1000 USD
            app.last_price_check = frame_system::Pallet::<T>::block_number();
            app.deposit_warning = false;

            migrated += 1;
            Some(app.into()) // 转换为新版本
        });

        // 返回迁移权重
        T::DbWeight::get().reads_writes(migrated.into(), migrated.into())
    }
}
```

## 监控指标

### 1. 关键指标
- **押金总价值波动**: 监控所有做市商押金的USD总价值变化
- **补充频率**: 统计押金补充的频次和金额
- **价格影响**: 分析DUST价格波动对押金系统的影响
- **警告状态**: 监控处于押金不足警告状态的做市商数量

### 2. 报警阈值
- **价格异常**: DUST价格波动超过20%时报警
- **补充失败**: 押金补充失败率超过5%时报警
- **系统负载**: 价格检查耗时过长时报警

## 安全考虑

### 1. 价格操控防护
- **多源价格**: 建议pallet-pricing支持多个价格源
- **价格平滑**: 采用移动平均等方法平滑价格波动
- **异常检测**: 检测价格异常波动并暂停自动补充

### 2. 资金安全
- **权限控制**: 只有做市商本人可以补充押金
- **限额控制**: 设置单次补充上限防止意外损失
- **审计追踪**: 记录所有押金变动的完整日志

## 实施建议

### 1. 分阶段实施
1. **第一阶段**: 实现动态计算和查询功能
2. **第二阶段**: 实现自动检查和警告机制
3. **第三阶段**: 实现自动补充功能

### 2. 测试要求
- **单元测试**: 覆盖所有计算逻辑
- **集成测试**: 测试与pallet-pricing的集成
- **压力测试**: 测试大量做市商的性能表现
- **场景测试**: 测试各种价格波动场景

---

**文档维护**: 本文档应随着实现的更新而持续维护，确保与实际代码保持一致。