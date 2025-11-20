# OTC订单金额限制系统

## 版本信息
- **文档版本**: v1.0
- **创建日期**: 2025-11-10
- **修订日期**: 2025-11-10
- **负责模块**: pallet-otc-order

## 概述

本文档定义OTC订单的金额限制机制，确保单笔OTC订单金额不超过200 USDT等值，基于实时价格动态验证订单金额合规性。

## 设计原则

### 1. 金额限制标准
- **单笔限额**: 200 USDT等值的DUST
- **实时计算**: 基于pallet-pricing提供的DUST/USD汇率
- **精度支持**: 支持10^6精度的美元计算

### 2. 验证时机
- **订单创建时**: 验证购买金额不超过限制
- **首购订单**: 固定10 USD，无需额外验证
- **价格波动**: 已创建订单不受后续价格波动影响

## 技术实现

### 1. 常量配置

```rust
// runtime/src/configs/mod.rs
pub mod otc_limits {
    use super::*;

    /// OTC订单最大USD金额（200 USD，精度10^6）
    pub const MaxOrderUsdAmount: u64 = 200_000_000;

    /// 首购订单固定USD金额（10 USD，精度10^6）
    pub const FirstPurchaseUsdAmount: u64 = 10_000_000;

    /// 金额验证容差（1%，用于处理价格微小波动）
    pub const AmountValidationTolerance: u16 = 100; // 100 bps = 1%
}
```

### 2. 配置接口扩展

```rust
// pallet-otc-order Config trait 扩展
#[pallet::config]
pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
    // 现有配置...

    /// OTC订单最大USD金额
    #[pallet::constant]
    type MaxOrderUsdAmount: Get<u64>;

    /// 金额验证容差（基点，用于处理价格波动）
    #[pallet::constant]
    type AmountValidationTolerance: Get<u16>;
}
```

### 3. 金额验证接口

#### 3.1 核心验证逻辑

```rust
impl<T: Config> Pallet<T> {
    /// 验证订单金额是否符合限制
    ///
    /// # 参数
    /// - dust_amount: 购买的DUST数量
    /// - is_first_purchase: 是否为首购订单
    ///
    /// # 返回
    /// - Ok(usd_amount): 验证通过，返回对应的USD金额
    /// - Err(DispatchError): 验证失败
    pub fn validate_order_amount(
        dust_amount: BalanceOf<T>,
        is_first_purchase: bool,
    ) -> Result<u64, DispatchError> {
        // 首购订单使用固定价格，无需验证限额
        if is_first_purchase {
            return Ok(T::FirstPurchaseUsdValue::get());
        }

        // 获取当前DUST/USD价格
        let dust_to_usd_rate = T::Pricing::get_dust_to_usd_rate()
            .ok_or(Error::<T>::PricingUnavailable)?;

        // 计算订单的USD金额
        let usd_amount = Self::calculate_usd_amount_from_dust(
            dust_amount,
            dust_to_usd_rate,
        )?;

        // 验证是否超过最大限制
        let max_amount = T::MaxOrderUsdAmount::get();
        ensure!(
            usd_amount <= max_amount,
            Error::<T>::OrderAmountExceedsLimit
        );

        // 验证最小金额（至少1 USD）
        ensure!(
            usd_amount >= 1_000_000, // 1 USD
            Error::<T>::OrderAmountTooSmall
        );

        Ok(usd_amount)
    }

    /// 计算DUST对应的USD金额
    ///
    /// # 参数
    /// - dust_amount: DUST数量
    /// - dust_to_usd_rate: DUST/USD汇率
    ///
    /// # 返回
    /// - Ok(u64): USD金额（精度10^6）
    /// - Err(DispatchError): 计算错误
    fn calculate_usd_amount_from_dust(
        dust_amount: BalanceOf<T>,
        dust_to_usd_rate: BalanceOf<T>,
    ) -> Result<u64, DispatchError> {
        // 转换为u128进行高精度计算
        let dust_u128: u128 = dust_amount.saturated_into();
        let rate_u128: u128 = dust_to_usd_rate.saturated_into();

        // 计算USD金额 = DUST数量 × DUST/USD汇率 ÷ DUST精度
        // DUST精度为10^12，USD精度为10^6
        let usd_u128 = dust_u128
            .checked_mul(rate_u128)
            .ok_or(Error::<T>::CalculationOverflow)?
            .checked_div(1_000_000_000_000u128) // 除以DUST精度10^12
            .ok_or(Error::<T>::CalculationOverflow)?;

        // 验证结果是否在u64范围内
        let usd_amount: u64 = usd_u128
            .try_into()
            .map_err(|_| Error::<T>::CalculationOverflow)?;

        Ok(usd_amount)
    }

    /// 计算指定USD金额对应的最大DUST数量
    ///
    /// # 参数
    /// - usd_amount: USD金额（精度10^6）
    ///
    /// # 返回
    /// - Ok(BalanceOf<T>): 对应的DUST数量
    /// - Err(DispatchError): 计算错误
    pub fn calculate_max_dust_for_usd_amount(
        usd_amount: u64,
    ) -> Result<BalanceOf<T>, DispatchError> {
        // 获取当前DUST/USD价格
        let dust_to_usd_rate = T::Pricing::get_dust_to_usd_rate()
            .ok_or(Error::<T>::PricingUnavailable)?;

        // 计算DUST数量 = USD金额 × DUST精度 ÷ DUST/USD汇率
        let usd_u128 = usd_amount as u128;
        let rate_u128: u128 = dust_to_usd_rate.saturated_into();

        let dust_u128 = usd_u128
            .checked_mul(1_000_000_000_000u128) // 乘以DUST精度10^12
            .ok_or(Error::<T>::CalculationOverflow)?
            .checked_div(rate_u128)
            .ok_or(Error::<T>::CalculationOverflow)?;

        // 转换为BalanceOf<T>
        let dust_amount: BalanceOf<T> = dust_u128
            .try_into()
            .map_err(|_| Error::<T>::CalculationOverflow)?;

        Ok(dust_amount)
    }
}
```

#### 3.2 订单创建验证集成

```rust
impl<T: Config> Pallet<T> {
    /// 修改后的创建订单函数（集成金额验证）
    pub fn do_create_order(
        buyer: &T::AccountId,
        maker_id: u64,
        dust_amount: BalanceOf<T>,
        payment_commit: H256,
        contact_commit: H256,
    ) -> Result<u64, DispatchError> {
        // 1. 验证订单金额（新增）
        let usd_amount = Self::validate_order_amount(dust_amount, false)?;

        // 2. 查询做市商信息（现有逻辑）
        let maker_app = T::MakerPallet::get_maker_application(maker_id)
            .ok_or(Error::<T>::MakerNotFound)?;

        // 3. 验证做市商状态（现有逻辑）
        ensure!(maker_app.is_active, Error::<T>::MakerNotActive);

        // 4. 获取当前DUST/USD价格（修改为使用已验证的数据）
        let price = T::Pricing::get_dust_to_usd_rate()
            .ok_or(Error::<T>::PricingUnavailable)?;

        // 5. 计算总金额（使用验证后的USD金额）
        let amount: BalanceOf<T> = usd_amount
            .try_into()
            .map_err(|_| Error::<T>::CalculationOverflow)?;

        // ... 其余创建逻辑保持不变

        // 10. 发出事件（添加USD金额信息）
        Self::deposit_event(Event::OrderCreated {
            order_id,
            maker_id,
            buyer: buyer.clone(),
            dust_amount,
            usd_amount, // 新增USD金额字段
            is_first_purchase: false,
        });

        Ok(order_id)
    }

    /// 首购订单创建（金额已固定，无需额外验证）
    pub fn do_create_first_purchase(
        buyer: &T::AccountId,
        maker_id: u64,
        payment_commit: H256,
        contact_commit: H256,
    ) -> Result<u64, DispatchError> {
        // 首购订单金额验证（固定10 USD）
        let usd_value = T::FirstPurchaseUsdValue::get();
        let _validated_amount = Self::validate_order_amount(
            BalanceOf::<T>::default(), // 占位符，首购时会重新计算
            true, // 标记为首购
        )?;

        // ... 其余首购逻辑保持不变
    }
}
```

### 4. 查询接口

```rust
impl<T: Config> Pallet<T> {
    /// 查询当前最大可购买DUST数量
    ///
    /// # 返回
    /// - Ok(BalanceOf<T>): 当前价格下最大可购买的DUST数量
    /// - Err(DispatchError): 查询失败
    pub fn get_max_purchasable_dust() -> Result<BalanceOf<T>, DispatchError> {
        Self::calculate_max_dust_for_usd_amount(T::MaxOrderUsdAmount::get())
    }

    /// 查询指定DUST数量对应的USD金额
    ///
    /// # 参数
    /// - dust_amount: DUST数量
    ///
    /// # 返回
    /// - Ok(u64): 对应的USD金额
    /// - Err(DispatchError): 查询失败
    pub fn get_usd_amount_for_dust(
        dust_amount: BalanceOf<T>
    ) -> Result<u64, DispatchError> {
        let dust_to_usd_rate = T::Pricing::get_dust_to_usd_rate()
            .ok_or(Error::<T>::PricingUnavailable)?;

        Self::calculate_usd_amount_from_dust(dust_amount, dust_to_usd_rate)
    }

    /// 检查指定DUST数量是否符合订单限制
    ///
    /// # 参数
    /// - dust_amount: 要检查的DUST数量
    ///
    /// # 返回
    /// - true: 符合限制
    /// - false: 超过限制
    pub fn is_dust_amount_valid(dust_amount: BalanceOf<T>) -> bool {
        Self::validate_order_amount(dust_amount, false).is_ok()
    }
}
```

### 5. 事件扩展

```rust
#[pallet::event]
pub enum Event<T: Config> {
    // 现有事件...

    /// 订单已创建（添加USD金额字段）
    OrderCreated {
        order_id: u64,
        maker_id: u64,
        buyer: T::AccountId,
        dust_amount: BalanceOf<T>,
        usd_amount: u64, // 新增：订单的USD金额
        is_first_purchase: bool,
    },

    /// 订单金额验证失败
    OrderAmountValidationFailed {
        buyer: T::AccountId,
        requested_dust: BalanceOf<T>,
        calculated_usd: u64,
        max_allowed_usd: u64,
    },
}
```

### 6. 错误扩展

```rust
#[pallet::error]
pub enum Error<T> {
    // 现有错误...

    /// 订单金额超过限制
    OrderAmountExceedsLimit,

    /// 订单金额太小
    OrderAmountTooSmall,

    /// 金额计算溢出
    CalculationOverflow,

    /// 定价服务不可用
    PricingUnavailable,
}
```

## 前端集成指南

### 1. 订单创建前验证

```typescript
// 前端验证示例
interface OrderValidation {
    dustAmount: string;
    isValid: boolean;
    usdAmount?: number;
    maxAllowedDust?: string;
    errorMessage?: string;
}

async function validateOrderAmount(dustAmount: string): Promise<OrderValidation> {
    try {
        // 查询当前最大可购买数量
        const maxDust = await api.query.otcOrder.getMaxPurchasableDust();

        // 查询指定数量的USD金额
        const usdAmount = await api.query.otcOrder.getUsdAmountForDust(dustAmount);

        // 检查是否有效
        const isValid = await api.query.otcOrder.isDustAmountValid(dustAmount);

        return {
            dustAmount,
            isValid,
            usdAmount: usdAmount / 1_000_000, // 转换为实际USD金额
            maxAllowedDust: maxDust.toString(),
            errorMessage: isValid ? undefined : '订单金额超过200 USDT限制'
        };
    } catch (error) {
        return {
            dustAmount,
            isValid: false,
            errorMessage: '验证失败，请稍后重试'
        };
    }
}
```

### 2. 动态限额显示

```typescript
// 实时显示当前限额
async function updateOrderLimits() {
    try {
        const maxDust = await api.query.otcOrder.getMaxPurchasableDust();
        const currentPrice = await api.query.pricing.getDustToUsdRate();

        // 更新UI显示
        document.getElementById('max-dust-amount').textContent =
            `最大可购买: ${formatDustAmount(maxDust)} DUST`;
        document.getElementById('current-price').textContent =
            `当前价格: $${formatPrice(currentPrice)}`;
    } catch (error) {
        console.error('获取限额信息失败:', error);
    }
}

// 每30秒更新一次限额信息
setInterval(updateOrderLimits, 30000);
```

## 运营监控

### 1. 监控指标

```rust
// 可以添加到统计模块中
pub struct OrderLimitMetrics {
    /// 因金额超限被拒绝的订单数量
    pub rejected_orders_count: u32,

    /// 平均订单金额（USD）
    pub average_order_usd: u64,

    /// 接近限额的订单比例
    pub near_limit_orders_ratio: u16, // 基点

    /// 当前价格下的最大可购买量
    pub current_max_dust: BalanceOf<T>,
}
```

### 2. 报警规则

- **拒绝率过高**: 如果因金额超限被拒绝的订单比例超过10%，触发报警
- **价格异常**: 如果DUST价格波动导致最大可购买量变化超过50%，触发报警
- **系统异常**: 如果金额验证接口频繁失败，触发报警

## 测试用例

### 1. 边界测试

```rust
#[test]
fn test_order_amount_limits() {
    new_test_ext().execute_with(|| {
        // 测试正常金额
        let normal_amount = calculate_dust_for_usd(100_000_000); // 100 USD
        assert_ok!(OtcOrder::validate_order_amount(normal_amount, false));

        // 测试边界金额
        let max_amount = calculate_dust_for_usd(200_000_000); // 200 USD
        assert_ok!(OtcOrder::validate_order_amount(max_amount, false));

        // 测试超限金额
        let over_limit = calculate_dust_for_usd(201_000_000); // 201 USD
        assert_err!(
            OtcOrder::validate_order_amount(over_limit, false),
            Error::<Test>::OrderAmountExceedsLimit
        );

        // 测试首购订单（应该无限制）
        let first_purchase = calculate_dust_for_usd(10_000_000); // 10 USD
        assert_ok!(OtcOrder::validate_order_amount(first_purchase, true));
    });
}
```

### 2. 价格波动测试

```rust
#[test]
fn test_price_volatility_impact() {
    new_test_ext().execute_with(|| {
        // 设置初始价格
        MockPricing::set_dust_usd_rate(1_000_000); // $1 per DUST

        let dust_amount = 200_000_000_000_000_000_000u128; // 200 DUST
        assert_ok!(OtcOrder::validate_order_amount(dust_amount, false));

        // 价格上涨一倍
        MockPricing::set_dust_usd_rate(2_000_000); // $2 per DUST

        // 相同数量的DUST现在超限
        assert_err!(
            OtcOrder::validate_order_amount(dust_amount, false),
            Error::<Test>::OrderAmountExceedsLimit
        );
    });
}
```

## 实施建议

### 1. 部署步骤
1. **Runtime升级**: 添加新的常量和配置
2. **存储迁移**: 无需存储迁移，仅添加验证逻辑
3. **前端更新**: 更新订单创建界面，添加实时验证
4. **监控部署**: 部署金额限制相关的监控指标

### 2. 向后兼容性
- 现有订单不受影响
- 新创建的订单将应用新的限制
- 首购订单保持固定10 USD不变

### 3. 风险控制
- **渐进式实施**: 可以先设置较高的限额进行测试
- **紧急关闭**: 如果发现问题，可以通过治理快速调整限额
- **价格保护**: 如果价格异常，可以暂停订单创建

---

**文档维护**: 本文档应随着实现和运营经验的积累持续更新。