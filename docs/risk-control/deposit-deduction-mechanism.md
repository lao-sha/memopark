# 做市商押金扣除机制

## 版本信息
- **文档版本**: v1.0
- **创建日期**: 2025-11-10
- **修订日期**: 2025-11-10
- **负责模块**: pallet-maker, pallet-credit

## 概述

本文档定义做市商押金扣除的触发条件、扣除逻辑、金额计算和自动补充机制，确保押金系统能够有效约束做市商行为并维护交易生态健康。

## 设计原则

### 1. 扣除触发原则
- **行为约束**: 通过经济惩罚约束不当行为
- **比例适当**: 扣除金额与违规严重程度成正比
- **透明公正**: 所有扣除操作有明确规则和记录

### 2. 资金安全原则
- **权限控制**: 只有授权模块可以扣除押金
- **审计追踪**: 所有扣除操作完整记录
- **争议处理**: 支持申诉和仲裁机制

## 扣除触发条件

### 1. 订单违约行为

#### 1.1 OTC订单超时
**触发条件**: 做市商在OTC订单中锁定DUST后，买家已付款但做市商超时未释放
- **检测机制**: 买家标记付款后24小时内未释放
- **扣除金额**: 订单金额的5% + 固定罚金10 USDT
- **受益人**: 买家获得补偿，剩余进入国库

#### 1.2 Bridge兑换超时
**触发条件**: 用户发起Bridge兑换，做市商超时未完成USDT转账
- **检测机制**: OCW检测超过设定时间(2小时)未完成
- **扣除金额**: 兑换金额的3% + 固定罚金5 USDT
- **受益人**: 用户获得补偿，剩余进入国库

#### 1.3 争议败诉
**触发条件**: 仲裁委员会裁决做市商败诉
- **检测机制**: 仲裁模块回调通知败诉
- **扣除金额**: 争议金额的10% + 仲裁费用
- **受益人**: 用户获得补偿，仲裁费进入仲裁基金

### 2. 信用评级惩罚

#### 2.1 信用分过低
**触发条件**: 信用分低于最低阈值(300分)连续7天
- **检测机制**: 每日信用分检查
- **扣除金额**: 每日扣除1 USDT等值DUST
- **受益人**: 扣除金额进入信用保险基金

#### 2.2 恶意行为
**触发条件**: 检测到虚假交易、操控价格等恶意行为
- **检测机制**: 人工举报 + 算法检测
- **扣除金额**: 50-200 USDT等值DUST(根据严重程度)
- **受益人**: 全部进入国库

## 技术实现

### 1. 押金扣除接口

```rust
// 押金扣除类型
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum PenaltyType {
    /// OTC订单超时
    OtcTimeout {
        order_id: u64,
        timeout_hours: u32,
    },
    /// Bridge兑换超时
    BridgeTimeout {
        swap_id: u64,
        timeout_hours: u32,
    },
    /// 争议败诉
    ArbitrationLoss {
        case_id: u64,
        loss_amount: u64, // USD amount
    },
    /// 信用分过低
    LowCreditScore {
        current_score: u32,
        days_below_threshold: u32,
    },
    /// 恶意行为
    MaliciousBehavior {
        behavior_type: u8,
        evidence_cid: BoundedVec<u8, ConstU32<64>>,
    },
}

// 押金扣除记录
#[derive(Encode, Decode, Clone, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct PenaltyRecord<T: Config> {
    /// 做市商ID
    pub maker_id: u64,
    /// 扣除类型
    pub penalty_type: PenaltyType,
    /// 扣除的DUST数量
    pub deducted_amount: BalanceOf<T>,
    /// 扣除时的USD价值
    pub usd_value: u64,
    /// 受益人账户（如果有）
    pub beneficiary: Option<T::AccountId>,
    /// 扣除时间
    pub deducted_at: BlockNumberFor<T>,
    /// 是否已申诉
    pub appealed: bool,
    /// 申诉结果
    pub appeal_result: Option<bool>,
}
```

### 2. 核心扣除逻辑

```rust
impl<T: Config> Pallet<T> {
    /// 执行押金扣除
    ///
    /// # 参数
    /// - maker_id: 做市商ID
    /// - penalty_type: 惩罚类型
    /// - beneficiary: 受益人账户（可选）
    ///
    /// # 返回
    /// - Ok(扣除记录ID): 成功扣除
    /// - Err(DispatchError): 扣除失败
    pub fn deduct_maker_deposit(
        maker_id: u64,
        penalty_type: PenaltyType,
        beneficiary: Option<T::AccountId>,
    ) -> Result<u64, DispatchError> {
        // 1. 验证做市商存在且处于活跃状态
        let mut app = Self::maker_applications(maker_id)
            .ok_or(Error::<T>::MakerNotFound)?;

        ensure!(
            app.status == ApplicationStatus::Active,
            Error::<T>::MakerNotActive
        );

        // 2. 计算扣除金额
        let (deduct_usd, reason) = Self::calculate_penalty_amount(&penalty_type)?;
        let deduct_dust = Self::convert_usd_to_dust(deduct_usd)?;

        // 3. 验证押金是否充足
        ensure!(
            app.deposit >= deduct_dust,
            Error::<T>::InsufficientDeposit
        );

        // 4. 执行扣除
        let penalty_id = Self::next_penalty_id();
        app.deposit = app.deposit.saturating_sub(deduct_dust);

        // 5. 处理扣除的资金
        match beneficiary.as_ref() {
            Some(beneficiary_account) => {
                // 转给受益人
                T::Currency::unreserve(&app.owner, deduct_dust);
                T::Currency::transfer(
                    &app.owner,
                    beneficiary_account,
                    deduct_dust,
                    ExistenceRequirement::KeepAlive,
                )?;
            },
            None => {
                // 转入国库或销毁
                T::Currency::unreserve(&app.owner, deduct_dust);
                // TODO: 转入国库账户
            }
        }

        // 6. 记录扣除操作
        let record = PenaltyRecord {
            maker_id,
            penalty_type: penalty_type.clone(),
            deducted_amount: deduct_dust,
            usd_value: deduct_usd,
            beneficiary: beneficiary.clone(),
            deducted_at: frame_system::Pallet::<T>::block_number(),
            appealed: false,
            appeal_result: None,
        };

        PenaltyRecords::<T>::insert(penalty_id, record);
        MakerApplications::<T>::insert(maker_id, app.clone());
        NextPenaltyId::<T>::put(penalty_id + 1);

        // 7. 检查是否需要补充押金
        if Self::needs_deposit_replenishment_after_deduction(maker_id)? {
            Self::trigger_deposit_replenishment_warning(maker_id)?;
        }

        // 8. 发出事件
        Self::deposit_event(Event::DepositDeducted {
            maker_id,
            penalty_id,
            deducted_amount: deduct_dust,
            usd_value: deduct_usd,
            reason: reason.into(),
            beneficiary,
        });

        Ok(penalty_id)
    }

    /// 计算惩罚金额
    ///
    /// # 参数
    /// - penalty_type: 惩罚类型
    ///
    /// # 返回
    /// - Ok((USD金额, 原因)): 计算结果
    /// - Err(DispatchError): 计算失败
    fn calculate_penalty_amount(
        penalty_type: &PenaltyType,
    ) -> Result<(u64, &'static str), DispatchError> {
        let (base_usd, reason) = match penalty_type {
            PenaltyType::OtcTimeout { order_id, timeout_hours } => {
                // 获取订单信息计算5%罚金
                let order = pallet_otc_order::Orders::<T>::get(order_id)
                    .ok_or(Error::<T>::OrderNotFound)?;

                let order_usd = order.amount.saturated_into::<u64>();
                let penalty_usd = (order_usd * 5) / 100; // 5%
                let fixed_penalty = 10_000_000; // 10 USD

                (penalty_usd + fixed_penalty, "OTC订单超时违约")
            },

            PenaltyType::BridgeTimeout { swap_id, .. } => {
                // 获取兑换信息计算3%罚金
                let swap = pallet_bridge::MakerSwaps::<T>::get(swap_id)
                    .ok_or(Error::<T>::SwapNotFound)?;

                let swap_usd = swap.usdt_amount;
                let penalty_usd = (swap_usd * 3) / 100; // 3%
                let fixed_penalty = 5_000_000; // 5 USD

                (penalty_usd + fixed_penalty, "Bridge兑换超时")
            },

            PenaltyType::ArbitrationLoss { loss_amount, .. } => {
                // 争议败诉：10%罚金 + 仲裁费
                let penalty_usd = (loss_amount * 10) / 100;
                let arbitration_fee = 20_000_000; // 20 USD仲裁费

                (penalty_usd + arbitration_fee, "争议仲裁败诉")
            },

            PenaltyType::LowCreditScore { days_below_threshold, .. } => {
                // 信用分过低：每日1 USD
                let daily_penalty = 1_000_000; // 1 USD
                (*days_below_threshold as u64 * daily_penalty, "信用分过低")
            },

            PenaltyType::MaliciousBehavior { behavior_type, .. } => {
                // 恶意行为：根据严重程度
                let penalty_usd = match behavior_type {
                    1 => 50_000_000,   // 轻微恶意行为：50 USD
                    2 => 100_000_000,  // 中等恶意行为：100 USD
                    3 => 200_000_000,  // 严重恶意行为：200 USD
                    _ => 50_000_000,   // 默认：50 USD
                };

                (penalty_usd, "恶意行为违规")
            },
        };

        Ok((base_usd, reason))
    }

    /// 检查扣除后是否需要补充押金
    ///
    /// # 参数
    /// - maker_id: 做市商ID
    ///
    /// # 返回
    /// - Ok(bool): 是否需要补充
    /// - Err(DispatchError): 检查失败
    fn needs_deposit_replenishment_after_deduction(
        maker_id: u64,
    ) -> Result<bool, DispatchError> {
        let app = Self::maker_applications(maker_id)
            .ok_or(Error::<T>::MakerNotFound)?;

        // 计算当前押金的USD价值
        let current_usd_value = Self::calculate_usd_value_of_deposit(app.deposit)?;

        // 检查是否低于补充阈值
        Ok(current_usd_value < T::DepositReplenishThreshold::get())
    }

    /// 触发押金补充警告
    ///
    /// # 参数
    /// - maker_id: 做市商ID
    ///
    /// # 返回
    /// - Ok(()): 成功
    /// - Err(DispatchError): 失败
    fn trigger_deposit_replenishment_warning(
        maker_id: u64,
    ) -> Result<(), DispatchError> {
        // 设置警告状态
        MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> DispatchResult {
            let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;
            app.deposit_warning = true;
            Ok(())
        })?;

        // 发出警告事件
        Self::deposit_event(Event::DepositReplenishmentRequired {
            maker_id,
            current_usd_value: Self::get_deposit_usd_value(maker_id)?,
            required_usd_value: T::TargetDepositUsd::get(),
        });

        // 给做市商发送通知（通过链下系统）
        // TODO: 集成链下通知系统

        Ok(())
    }
}
```

### 3. 自动扣除触发器

#### 3.1 OTC订单超时检测

```rust
// 在 pallet-otc-order 中集成
impl<T: Config> Pallet<T> {
    /// OCW检测超时订单并触发押金扣除
    pub fn check_timeout_orders_and_penalize(
        current_block: BlockNumberFor<T>,
    ) -> Result<u32, ()> {
        let mut penalized_count = 0u32;

        // 遍历处于PaidOrCommitted状态的订单
        for order_id in Self::get_active_orders() {
            if let Some(order) = Orders::<T>::get(order_id) {
                if order.state != OrderState::PaidOrCommitted {
                    continue;
                }

                // 检查是否超过证据窗口
                let current_time = T::Timestamp::now().as_secs().saturated_into::<u64>();
                if current_time > order.evidence_until {
                    let timeout_hours = ((current_time - order.evidence_until) / 3600) as u32;

                    // 触发押金扣除
                    let penalty_type = PenaltyType::OtcTimeout {
                        order_id,
                        timeout_hours,
                    };

                    // 扣除做市商押金，补偿给买家
                    if let Ok(_) = pallet_maker::Pallet::<T>::deduct_maker_deposit(
                        order.maker_id,
                        penalty_type,
                        Some(order.taker.clone()),
                    ) {
                        // 强制退款给买家
                        let _ = T::Escrow::refund_all(order_id, &order.taker);

                        penalized_count += 1;
                    }
                }
            }
        }

        Ok(penalized_count)
    }
}
```

#### 3.2 Bridge兑换超时检测

```rust
// 在 pallet-bridge 中集成
impl<T: Config> Pallet<T> {
    /// OCW检测超时兑换并触发押金扣除
    pub fn check_timeout_swaps_and_penalize(
        current_block: BlockNumberFor<T>,
    ) -> Result<u32, ()> {
        let mut penalized_count = 0u32;

        // 遍历Pending状态的做市商兑换
        for swap_id in Self::get_pending_maker_swaps() {
            if let Some(mut swap) = MakerSwaps::<T>::get(swap_id) {
                if swap.status != SwapStatus::Pending {
                    continue;
                }

                // 检查是否超时
                if current_block >= swap.timeout_at {
                    let timeout_blocks = current_block - swap.timeout_at;
                    let timeout_hours = (timeout_blocks.saturated_into::<u64>() * 6 / 3600) as u32;

                    // 触发押金扣除
                    let penalty_type = PenaltyType::BridgeTimeout {
                        swap_id,
                        timeout_hours,
                    };

                    // 扣除做市商押金，补偿给用户
                    if let Ok(_) = pallet_maker::Pallet::<T>::deduct_maker_deposit(
                        swap.maker_id,
                        penalty_type,
                        Some(swap.user.clone()),
                    ) {
                        // 强制退款给用户
                        let _ = T::Escrow::refund_all(swap_id, &swap.user);

                        // 更新兑换状态
                        swap.status = SwapStatus::Refunded;
                        MakerSwaps::<T>::insert(swap_id, swap);

                        penalized_count += 1;
                    }
                }
            }
        }

        Ok(penalized_count)
    }
}
```

### 4. 申诉机制

```rust
impl<T: Config> Pallet<T> {
    /// 申诉押金扣除
    ///
    /// # 参数
    /// - origin: 做市商账户
    /// - penalty_id: 扣除记录ID
    /// - evidence_cid: 申诉证据IPFS CID
    ///
    /// # 返回
    /// - DispatchResult: 申诉结果
    #[pallet::call_index(10)]
    #[pallet::weight(T::WeightInfo::appeal_penalty())]
    pub fn appeal_penalty(
        origin: OriginFor<T>,
        penalty_id: u64,
        evidence_cid: sp_std::vec::Vec<u8>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 获取做市商ID
        let maker_id = Self::account_to_maker(&who)
            .ok_or(Error::<T>::MakerNotFound)?;

        // 获取扣除记录
        let mut record = PenaltyRecords::<T>::get(penalty_id)
            .ok_or(Error::<T>::PenaltyRecordNotFound)?;

        // 验证申诉权限
        ensure!(record.maker_id == maker_id, Error::<T>::NotAuthorized);
        ensure!(!record.appealed, Error::<T>::AlreadyAppealed);

        // 验证申诉时限（扣除后7天内）
        let current_block = frame_system::Pallet::<T>::block_number();
        let deadline = record.deducted_at + T::AppealDeadline::get();
        ensure!(current_block <= deadline, Error::<T>::AppealDeadlineExpired);

        // 标记为已申诉
        record.appealed = true;
        PenaltyRecords::<T>::insert(penalty_id, record);

        // 创建仲裁案件
        let evidence: BoundedVec<u8, ConstU32<64>> = evidence_cid
            .try_into()
            .map_err(|_| Error::<T>::EvidenceTooLong)?;

        let _case_id = T::Arbitration::create_case(
            who.clone(),
            ArbitrationType::PenaltyAppeal,
            penalty_id,
            evidence,
        )?;

        // 发出申诉事件
        Self::deposit_event(Event::PenaltyAppealed {
            maker_id,
            penalty_id,
            appeal_case_id: _case_id,
        });

        Ok(())
    }

    /// 处理申诉结果（由仲裁模块回调）
    pub fn handle_appeal_result(
        penalty_id: u64,
        appeal_granted: bool,
    ) -> DispatchResult {
        let mut record = PenaltyRecords::<T>::get(penalty_id)
            .ok_or(Error::<T>::PenaltyRecordNotFound)?;

        record.appeal_result = Some(appeal_granted);
        PenaltyRecords::<T>::insert(penalty_id, record.clone());

        if appeal_granted {
            // 申诉成功，退还扣除的押金
            Self::refund_penalty(penalty_id)?;
        }

        // 发出结果事件
        Self::deposit_event(Event::AppealResultProcessed {
            penalty_id,
            maker_id: record.maker_id,
            appeal_granted,
        });

        Ok(())
    }

    /// 退还扣除的押金
    fn refund_penalty(penalty_id: u64) -> DispatchResult {
        let record = PenaltyRecords::<T>::get(penalty_id)
            .ok_or(Error::<T>::PenaltyRecordNotFound)?;

        // 获取做市商应用
        let mut app = Self::maker_applications(record.maker_id)
            .ok_or(Error::<T>::MakerNotFound)?;

        // 重新锁定押金
        T::Currency::reserve(&app.owner, record.deducted_amount)?;

        // 更新押金金额
        app.deposit = app.deposit.saturating_add(record.deducted_amount);
        MakerApplications::<T>::insert(record.maker_id, app);

        // 从受益人追回资金（如果可能）
        // 注意：实际实现可能很复杂，可能需要替代方案

        // 发出退还事件
        Self::deposit_event(Event::PenaltyRefunded {
            penalty_id,
            maker_id: record.maker_id,
            refunded_amount: record.deducted_amount,
        });

        Ok(())
    }
}
```

### 5. 存储定义

```rust
/// 下一个惩罚记录ID
#[pallet::storage]
#[pallet::getter(fn next_penalty_id)]
pub type NextPenaltyId<T> = StorageValue<_, u64, ValueQuery>;

/// 惩罚记录
#[pallet::storage]
#[pallet::getter(fn penalty_records)]
pub type PenaltyRecords<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64, // penalty_id
    PenaltyRecord<T>,
>;

/// 做市商的惩罚记录列表
#[pallet::storage]
#[pallet::getter(fn maker_penalties)]
pub type MakerPenalties<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64, // maker_id
    BoundedVec<u64, ConstU32<100>>, // penalty_ids
    ValueQuery,
>;
```

### 6. 事件定义

```rust
#[pallet::event]
pub enum Event<T: Config> {
    // 现有事件...

    /// 押金已扣除
    DepositDeducted {
        maker_id: u64,
        penalty_id: u64,
        deducted_amount: BalanceOf<T>,
        usd_value: u64,
        reason: BoundedVec<u8, ConstU32<64>>,
        beneficiary: Option<T::AccountId>,
    },

    /// 需要补充押金
    DepositReplenishmentRequired {
        maker_id: u64,
        current_usd_value: u64,
        required_usd_value: u64,
    },

    /// 押金扣除申诉
    PenaltyAppealed {
        maker_id: u64,
        penalty_id: u64,
        appeal_case_id: u64,
    },

    /// 申诉结果处理
    AppealResultProcessed {
        penalty_id: u64,
        maker_id: u64,
        appeal_granted: bool,
    },

    /// 押金已退还
    PenaltyRefunded {
        penalty_id: u64,
        maker_id: u64,
        refunded_amount: BalanceOf<T>,
    },
}
```

## 运营管理

### 1. 监控指标

```rust
pub struct DepositDeductionMetrics {
    /// 总扣除次数
    pub total_deductions: u32,

    /// 总扣除金额（DUST）
    pub total_deducted_dust: BalanceOf<T>,

    /// 总扣除价值（USD）
    pub total_deducted_usd: u64,

    /// 按类型分类的扣除统计
    pub deductions_by_type: BTreeMap<PenaltyType, u32>,

    /// 申诉成功率
    pub appeal_success_rate: u16, // 基点

    /// 平均押金补充时间
    pub avg_replenishment_time: BlockNumberFor<T>,
}
```

### 2. 治理参数

```rust
// runtime配置
pub mod penalty_params {
    /// OTC超时罚金比例（基点）
    pub const OtcTimeoutPenaltyBps: u16 = 500; // 5%

    /// Bridge超时罚金比例（基点）
    pub const BridgeTimeoutPenaltyBps: u16 = 300; // 3%

    /// 争议败诉罚金比例（基点）
    pub const ArbitrationLossPenaltyBps: u16 = 1000; // 10%

    /// 申诉时限（区块数，7天）
    pub const AppealDeadline: BlockNumber = 100800;

    /// 最大单次扣除金额（USD，精度10^6）
    pub const MaxSingleDeductionUsd: u64 = 500_000_000; // 500 USD
}
```

## 风险控制

### 1. 扣除限制
- **单次限额**: 单次扣除不超过500 USD
- **每日限额**: 每个做市商每日扣除不超过总押金的30%
- **最低保留**: 扣除后押金不低于200 USD

### 2. 异常检测
- **频繁扣除**: 单个做市商24小时内扣除超过3次
- **大额扣除**: 单次扣除超过100 USD
- **申诉异常**: 申诉成功率异常高或异常低

### 3. 紧急机制
- **暂停扣除**: 紧急情况下可暂停自动扣除
- **人工干预**: 支持治理账户手动干预
- **回滚机制**: 错误扣除可通过治理回滚

## 实施建议

### 1. 部署流程
1. **Runtime升级**: 添加扣除相关的存储和接口
2. **测试验证**: 在测试网充分验证各种扣除场景
3. **逐步启用**: 先启用手动扣除，再启用自动扣除
4. **监控完善**: 部署完整的监控和报警系统

### 2. 风险缓解
- **保险基金**: 设立保险基金补偿错误扣除
- **多签控制**: 大额扣除需要多签确认
- **透明公开**: 所有扣除记录公开透明
- **定期审计**: 定期审计扣除机制的有效性

---

**文档维护**: 本文档是押金扣除机制的核心设计，应随着实施和运营经验不断完善。