# Pallet Maker（做市商管理模块）

## 📋 模块概述

`pallet-maker` 是 Stardust 区块链的 **做市商管理模块**，从原 `pallet-trading` 拆分而来（v0.1.0, 2025-11-03），负责做市商的完整生命周期管理，包括申请、审核、押金管理、提现管理、溢价配置、服务暂停/恢复等功能。

### 核心特性

- ✅ **完整生命周期管理**：申请 → 审核 → 激活 → 提现/取消
- ✅ **动态押金管理**：基于 USD 锚定的押金系统（目标 1,000 USD）
- ✅ **自动押金补充**：价格波动时自动触发补充机制
- ✅ **押金扣除系统**：支持多种违规场景的押金扣除
- ✅ **申诉机制**：做市商可对押金扣除提起申诉
- ✅ **提现冷却期**：默认 7 天冷却期，防止恶意退出
- ✅ **溢价配置**：Buy/Sell 溢价独立配置（-500 ~ 500 基点）
- ✅ **服务暂停/恢复**：支持做市商主动暂停服务
- ✅ **数据脱敏**：姓名、身份证、生日、收款方式自动脱敏
- ✅ **IPFS 存储**：公开/私密资料分别存储，支持加密
- ✅ **EPAY 支持**：可选配置 EPAY 商户号和密钥

---

## 🔑 核心功能

### 1. 做市商申请流程

#### 1.1 lock_deposit（锁定押金）

**调用方**：用户

**功能**：申请成为做市商，锁定初始押金。

**流程**：
1. 检查是否已申请（不允许重复申请）
2. 锁定押金（初始金额由 `MakerDepositAmount` 配置）
3. 获取新的做市商 ID（自增）
4. 创建申请记录，状态为 `DepositLocked`
5. 设置资料提交截止时间（默认 1 小时）
6. 设置审核截止时间（默认 24 小时）
7. 初始化动态押金参数（目标 USD 价值、价格检查时间等）
8. 触发 `MakerDepositLocked` 事件

**押金用途**：
- 保证做市商履约
- 违约时扣除（转给受益人或国库）
- 提现时解锁

**代码示例**：
```rust
// 内部实现
pub fn do_lock_deposit(who: &T::AccountId) -> DispatchResult {
    // 检查是否已申请
    ensure!(
        !AccountToMaker::<T>::contains_key(who),
        Error::<T>::MakerAlreadyExists
    );

    let deposit = T::MakerDepositAmount::get();

    // 锁定押金
    T::Currency::reserve(who, deposit)
        .map_err(|_| Error::<T>::InsufficientBalance)?;

    // 获取新的做市商ID
    let maker_id = NextMakerId::<T>::get();
    NextMakerId::<T>::put(maker_id.saturating_add(1));

    // 获取当前时间
    let now = T::Timestamp::now().as_secs().saturated_into::<u32>();

    // 创建申请记录
    let application = MakerApplication::<T> {
        owner: who.clone(),
        deposit,
        status: ApplicationStatus::DepositLocked,
        direction: Direction::default(),
        // ... 其他字段
        target_deposit_usd: T::TargetDepositUsd::get(), // 1,000 USD
        last_price_check: frame_system::Pallet::<T>::block_number(),
        deposit_warning: false,
    };

    // 存储申请记录
    MakerApplications::<T>::insert(maker_id, application);
    AccountToMaker::<T>::insert(who, maker_id);

    // 触发事件
    Self::deposit_event(Event::MakerDepositLocked {
        maker_id,
        who: who.clone(),
        amount: deposit,
    });

    Ok(())
}
```

#### 1.2 submit_info（提交资料）

**调用方**：申请人

**功能**：提交做市商资料（KYC）。

**流程**：
1. 验证 TRON 地址格式（使用 `pallet-trading-common::is_valid_tron_address`）
2. 验证 EPAY 配置（使用 `pallet-trading-common::is_valid_epay_config`）
3. 脱敏处理（使用 `pallet-trading-common` 提供的脱敏函数）：
   - 姓名：保留姓氏，名字用 `*` 替换（如：张三 → 张*）
   - 身份证：保留前 6 位和后 4 位，中间用 `*` 替换
   - 生日：保留年份，月日用 `**-**` 替换（如：1990-01-01 → 1990-**-**）
4. 更新申请记录，状态为 `PendingReview`
5. TODO: 将完整资料上传到 IPFS 并存储 CID
6. 触发 `MakerInfoSubmitted` 事件

**资料要求**：
- 真实姓名（用于 KYC）
- 身份证号（18 位，用于 KYC）
- 生日（YYYY-MM-DD 格式）
- TRON 地址（统一用于 OTC 收款和 Bridge 发款，T 开头，34 字节）
- 微信号（用于联系）
- EPAY 商户号（可选，用于自动化支付）
- EPAY 密钥（可选，加密存储在 IPFS）

**代码示例**：
```rust
pub fn do_submit_info(
    who: &T::AccountId,
    real_name: sp_std::vec::Vec<u8>,
    id_card_number: sp_std::vec::Vec<u8>,
    birthday: sp_std::vec::Vec<u8>,
    tron_address: sp_std::vec::Vec<u8>,
    wechat_id: sp_std::vec::Vec<u8>,
    epay_no: Option<sp_std::vec::Vec<u8>>,
    epay_key: Option<sp_std::vec::Vec<u8>>,
) -> DispatchResult {
    use pallet_trading_common::{is_valid_tron_address, is_valid_epay_config};
    use pallet_trading_common::{mask_name, mask_id_card, mask_birthday};

    // 验证 TRON 地址
    ensure!(
        is_valid_tron_address(&tron_address),
        Error::<T>::InvalidTronAddress
    );

    // 验证 EPAY 配置
    ensure!(
        is_valid_epay_config(&epay_no, &epay_key),
        Error::<T>::InvalidEpayConfig
    );

    // 脱敏处理
    let masked_name = mask_name(&real_name);
    let masked_id = mask_id_card(&id_card_number);
    let masked_birth = mask_birthday(&birthday);

    // 更新申请记录
    // ...
}
```

---

### 2. 做市商审核

#### 2.1 approve_maker（审批做市商）

**调用方**：治理权限（GovernanceOrigin）

**功能**：审批做市商申请。

**流程**：
1. 验证治理权限
2. 检查申请状态（必须是 `PendingReview`）
3. 更新申请状态为 `Active`
4. 触发 `MakerApproved` 事件

**权限要求**：`GovernanceOrigin`（在 runtime 中配置，通常是理事会或 Sudo）

#### 2.2 reject_maker（驳回做市商）

**调用方**：治理权限（GovernanceOrigin）

**功能**：驳回做市商申请。

**流程**：
1. 验证治理权限
2. 检查申请状态（必须是 `PendingReview`）
3. 更新申请状态为 `Rejected`
4. **解锁押金**（退还给申请人）
5. 触发 `MakerRejected` 事件

#### 2.3 cancel_maker（取消申请）

**调用方**：申请人

**功能**：申请人主动取消申请。

**流程**：
1. 验证调用者是申请人
2. 检查申请状态（只能在 `DepositLocked` 或 `PendingReview` 状态下取消）
3. 更新申请状态为 `Cancelled`
4. **解锁押金**（退还给申请人）
5. 触发 `MakerCancelled` 事件

**限制**：
- 只能在 `DepositLocked` 或 `PendingReview` 状态下取消
- `Active` 状态的做市商需要通过提现流程退出

---

### 3. 动态押金管理系统

#### 3.1 押金锚定机制

**设计目标**：押金价值锚定 USD，不受 DUST 代币价格波动影响。

**核心参数**：
- **目标押金价值**：1,000 USD（`TargetDepositUsd`，精度 10^6）
- **补充触发阈值**：950 USD（`DepositReplenishThreshold`）
- **补充目标价值**：1,050 USD（`DepositReplenishTarget`）
- **价格检查间隔**：每小时检查一次（`PriceCheckInterval`）

**工作原理**：

1. **价格查询**：通过 `PricingProvider` trait 获取 DUST/USD 实时汇率（精度 10^6）
2. **价值计算**：将做市商的 DUST 押金转换为 USD 价值
3. **阈值判断**：如果 USD 价值低于 950 USD，触发补充警告
4. **自动补充**：做市商需要主动调用 `replenish_deposit` 补充押金至 1,050 USD

**价值计算公式**：

```rust
// DUST → USD
usd_value = (deposit_dust × dust_to_usd_rate) ÷ 10^12

// USD → DUST
dust_amount = (usd_value × 10^12) ÷ dust_to_usd_rate
```

**示例**：
```
假设 DUST/USD 汇率 = 0.5 USD（即 1 DUST = 0.5 USD）
汇率精度表示：500,000（0.5 × 10^6）

初始押金：2,000 DUST
USD 价值 = (2,000 × 10^12 × 500,000) ÷ 10^12 ÷ 10^6 = 1,000 USD

如果 DUST 价格跌至 0.4 USD：
USD 价值 = (2,000 × 10^12 × 400,000) ÷ 10^12 ÷ 10^6 = 800 USD
低于 950 USD 阈值，需要补充押金至 2,625 DUST（1,050 USD）
```

#### 3.2 replenish_deposit（补充押金）

**调用方**：做市商

**功能**：主动补充押金至目标价值。

**流程**：
1. 验证做市商状态（必须是 `Active`）
2. 获取当前 DUST/USD 汇率
3. 计算补充目标数量（1,050 USD 对应的 DUST）
4. 计算需要补充的金额（目标 - 当前）
5. 锁定补充金额
6. 更新押金记录
7. 清除警告状态
8. 触发 `DepositReplenished` 事件

**代码示例**：
```rust
pub fn replenish_maker_deposit(maker_id: u64) -> Result<BalanceOf<T>, DispatchError> {
    MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> Result<BalanceOf<T>, DispatchError> {
        let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;

        // 确保做市商已激活
        ensure!(
            app.status == ApplicationStatus::Active,
            Error::<T>::MakerNotActive
        );

        // 计算补充目标数量（1,050 USD 对应的 DUST）
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
```

#### 3.3 check_deposit_sufficiency（检查押金充足性）

**调用方**：链上逻辑或前端查询

**功能**：检查做市商押金是否充足。

**流程**：
1. 获取做市商申请记录
2. 计算当前押金的 USD 价值
3. 与补充阈值（950 USD）比较
4. 返回是否充足

**代码示例**：
```rust
pub fn check_deposit_sufficiency(maker_id: u64) -> Result<bool, DispatchError> {
    let app = Self::maker_applications(maker_id)
        .ok_or(Error::<T>::MakerNotFound)?;

    // 计算当前押金的 USD 价值
    let current_usd_value = Self::calculate_usd_value_of_deposit(app.deposit)?;

    // 检查是否低于补充阈值
    Ok(current_usd_value >= T::DepositReplenishThreshold::get())
}
```

#### 3.4 get_deposit_usd_value（查询押金 USD 价值）

**调用方**：前端查询或链上逻辑

**功能**：实时查询做市商押金的 USD 价值。

**代码示例**：
```rust
pub fn get_deposit_usd_value(maker_id: u64) -> Result<u64, DispatchError> {
    let app = Self::maker_applications(maker_id)
        .ok_or(Error::<T>::MakerNotFound)?;

    Self::calculate_usd_value_of_deposit(app.deposit)
}
```

---

### 4. 押金扣除和惩罚机制

#### 4.1 deduct_maker_deposit（执行押金扣除）

**调用方**：其他 pallet（如 `pallet-otc-order`、`pallet-bridge`、`pallet-arbitration`）

**功能**：因违规行为扣除做市商押金。

**支持的违规类型**（`PenaltyType`）：

| 类型 | 说明 | 扣除规则 |
|-----|------|---------|
| OtcTimeout | OTC 订单超时 | 固定 50 USD + 超时时长影响 |
| BridgeTimeout | Bridge 兑换超时 | 固定 30 USD + 超时时长影响 |
| ArbitrationLoss | 争议败诉 | 损失金额的 10% + 20 USD 仲裁费 |
| LowCreditScore | 信用分过低 | 每日 1 USD × 低于阈值天数 |
| MaliciousBehavior | 恶意行为 | 根据严重程度：50/100/200 USD |

**流程**：
1. 验证做市商存在且处于 `Active` 状态
2. 计算扣除金额（USD → DUST）
3. 验证押金是否充足
4. 执行扣除：
   - 如果有受益人：转给受益人
   - 如果无受益人：转入国库或销毁
5. 记录扣除操作（`PenaltyRecord`）
6. 检查是否需要补充押金（低于 950 USD 触发警告）
7. 发出 `DepositDeducted` 事件

**代码示例**：
```rust
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
    let deduct_dust = Self::calculate_dust_amount_for_usd(deduct_usd)?;

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

    // 7. 更新做市商惩罚记录列表
    MakerPenalties::<T>::try_mutate(maker_id, |penalties| {
        penalties.try_push(penalty_id)
            .map_err(|_| Error::<T>::EncodingError)
    })?;

    // 8. 检查是否需要补充押金
    if Self::needs_deposit_replenishment_after_deduction(maker_id)? {
        Self::trigger_deposit_replenishment_warning(maker_id)?;
    }

    // 9. 发出事件
    Self::deposit_event(Event::DepositDeducted {
        maker_id,
        penalty_id,
        deducted_amount: deduct_dust,
        usd_value: deduct_usd,
        reason: BoundedVec::try_from(reason.as_bytes().to_vec()).unwrap_or_default(),
        beneficiary,
    });

    Ok(penalty_id)
}
```

**扣除金额计算示例**：
```rust
fn calculate_penalty_amount(
    penalty_type: &PenaltyType,
) -> Result<(u64, &'static str), DispatchError> {
    let (base_usd, reason) = match penalty_type {
        PenaltyType::OtcTimeout { order_id: _, timeout_hours: _ } => {
            // OTC超时：固定50 USD（精度10^6）
            (50_000_000u64, "OTC订单超时违约")
        },
        PenaltyType::BridgeTimeout { swap_id: _, timeout_hours: _ } => {
            // Bridge超时：固定30 USD
            (30_000_000u64, "Bridge兑换超时")
        },
        PenaltyType::ArbitrationLoss { case_id: _, loss_amount } => {
            // 争议败诉：损失金额的10% + 20 USD仲裁费
            let penalty_usd = (loss_amount * 10) / 100;
            (penalty_usd + 20_000_000, "争议仲裁败诉")
        },
        PenaltyType::LowCreditScore { current_score: _, days_below_threshold } => {
            // 信用分过低：每日1 USD
            (*days_below_threshold as u64 * 1_000_000, "信用分过低")
        },
        PenaltyType::MaliciousBehavior { behavior_type, evidence_cid: _ } => {
            // 恶意行为：根据严重程度
            let penalty_usd = match behavior_type {
                1 => 50_000_000,   // 轻微：50 USD
                2 => 100_000_000,  // 中等：100 USD
                3 => 200_000_000,  // 严重：200 USD
                _ => 50_000_000,   // 默认：50 USD
            };
            (penalty_usd, "恶意行为违规")
        },
    };

    Ok((base_usd, reason))
}
```

#### 4.2 appeal_penalty（申诉押金扣除）

**调用方**：做市商

**功能**：对押金扣除提起申诉。

**流程**：
1. 验证申诉权限（必须是被扣除押金的做市商）
2. 检查是否已经申诉过（不允许重复申诉）
3. 验证申诉时限（扣除后 7 天内，由 `AppealDeadline` 配置）
4. 标记扣除记录为已申诉
5. 发出 `PenaltyAppealed` 事件
6. TODO: 创建仲裁案件（集成 `pallet-arbitration`）

**代码示例**：
```rust
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

    // 发出申诉事件
    Self::deposit_event(Event::PenaltyAppealed {
        maker_id,
        penalty_id,
        appeal_case_id: penalty_id, // TODO: 集成仲裁系统
    });

    Ok(())
}
```

**申诉限制**：
- 只能申诉一次
- 必须在扣除后 7 天内提起
- 需要提供证据（IPFS CID）

---

### 5. 提现管理

#### 5.1 request_withdrawal（申请提现）

**调用方**：做市商

**功能**：申请提现部分或全部押金。

**流程**：
1. 验证做市商状态（必须是 `Active`）
2. 检查押金是否足够（提现后剩余押金 ≥ 最小押金要求）
3. 检查是否已有待处理的提现请求（不允许重复提现）
4. 创建提现请求，状态为 `Pending`
5. 设置可执行时间（当前时间 + 冷却期）
6. 触发 `WithdrawalRequested` 事件

**冷却期**：默认 7 天（`WithdrawalCooldown`，按 6 秒一块计算约 100,800 块）

**用途**：
- 防止做市商恶意退出
- 给予纠纷解决的缓冲时间
- 保护用户权益

**代码示例**：
```rust
pub fn do_request_withdrawal(who: &T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
    // 获取做市商ID
    let maker_id = AccountToMaker::<T>::get(who)
        .ok_or(Error::<T>::MakerNotFound)?;

    // 检查做市商状态
    let app = MakerApplications::<T>::get(maker_id)
        .ok_or(Error::<T>::MakerNotFound)?;

    ensure!(
        app.status == ApplicationStatus::Active,
        Error::<T>::MakerNotActive
    );

    // 检查押金是否足够
    ensure!(
        app.deposit >= amount,
        Error::<T>::InsufficientDeposit
    );

    // 检查是否已有待处理的提现请求
    ensure!(
        !WithdrawalRequests::<T>::contains_key(maker_id),
        Error::<T>::NotAuthorized
    );

    // 获取当前时间
    let now = T::Timestamp::now().as_secs().saturated_into::<u32>();
    let cooldown = T::WithdrawalCooldown::get().saturated_into::<u32>();

    // 创建提现请求
    let request = WithdrawalRequest {
        amount,
        requested_at: now,
        executable_at: now.saturating_add(cooldown),
        status: WithdrawalStatus::Pending,
    };

    WithdrawalRequests::<T>::insert(maker_id, request);

    // 触发事件
    Self::deposit_event(Event::WithdrawalRequested {
        maker_id,
        amount,
    });

    Ok(())
}
```

#### 5.2 execute_withdrawal（执行提现）

**调用方**：做市商

**功能**：冷却期满后执行提现。

**流程**：
1. 验证提现请求存在且状态为 `Pending`
2. 检查冷却期是否满足（当前时间 ≥ 可执行时间）
3. 解锁押金（`unreserve`）
4. 更新申请记录中的押金金额
5. 更新提现请求状态为 `Executed`
6. 触发 `WithdrawalExecuted` 事件

**代码示例**：
```rust
pub fn do_execute_withdrawal(who: &T::AccountId) -> DispatchResult {
    // 获取做市商ID
    let maker_id = AccountToMaker::<T>::get(who)
        .ok_or(Error::<T>::MakerNotFound)?;

    // 获取提现请求
    let request = WithdrawalRequests::<T>::get(maker_id)
        .ok_or(Error::<T>::WithdrawalRequestNotFound)?;

    // 检查状态
    ensure!(
        request.status == WithdrawalStatus::Pending,
        Error::<T>::InvalidMakerStatus
    );

    // 检查冷却期
    let now = T::Timestamp::now().as_secs().saturated_into::<u32>();
    ensure!(
        now >= request.executable_at,
        Error::<T>::WithdrawalCooldownNotMet
    );

    // 解锁押金
    T::Currency::unreserve(who, request.amount);

    // 更新申请记录中的押金金额
    MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> DispatchResult {
        let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;
        app.deposit = app.deposit.saturating_sub(request.amount);
        Ok(())
    })?;

    // 更新提现请求状态
    WithdrawalRequests::<T>::mutate(maker_id, |maybe_req| {
        if let Some(req) = maybe_req {
            req.status = WithdrawalStatus::Executed;
        }
    });

    // 触发事件
    Self::deposit_event(Event::WithdrawalExecuted {
        maker_id,
        amount: request.amount,
    });

    Ok(())
}
```

#### 5.3 cancel_withdrawal（取消提现）

**调用方**：做市商

**功能**：取消提现请求。

**流程**：
1. 验证提现请求存在且状态为 `Pending`
2. 更新提现请求状态为 `Cancelled`
3. 触发 `WithdrawalCancelled` 事件

#### 5.4 emergency_withdrawal（紧急提现）

**调用方**：治理权限（GovernanceOrigin）

**功能**：治理功能，用于应急场景。

**流程**：
1. 验证治理权限
2. 解锁全部押金并转给指定账户
3. 更新申请记录中的押金金额为 0
4. 触发 `EmergencyWithdrawalExecuted` 事件

**用途**：
- 应急场景（如做市商账户被盗）
- 治理决议强制退出
- 异常情况处理

---

## 📊 数据结构详解

### 1. MakerApplication（做市商申请记录）

```rust
pub struct MakerApplication<T: Config> {
    /// 所有者账户
    pub owner: T::AccountId,

    /// 押金金额（DUST，可动态调整）
    pub deposit: BalanceOf<T>,

    /// 申请状态
    pub status: ApplicationStatus,

    /// 业务方向（Buy/Sell/BuyAndSell）
    pub direction: Direction,

    /// TRON 地址（统一用于 OTC 收款和 Bridge 发款）
    pub tron_address: TronAddress, // BoundedVec<u8, 34>

    /// 公开资料 CID（IPFS，加密存储）
    pub public_cid: Cid, // BoundedVec<u8, 64>

    /// 私密资料 CID（IPFS，加密存储）
    pub private_cid: Cid,

    /// Buy 溢价（基点，-500 ~ 500）
    /// 例如：100 表示 +1%，-50 表示 -0.5%
    pub buy_premium_bps: i16,

    /// Sell 溢价（基点，-500 ~ 500）
    pub sell_premium_bps: i16,

    /// 最小交易金额（DUST）
    pub min_amount: BalanceOf<T>,

    /// 创建时间（Unix 时间戳，秒）
    pub created_at: u32,

    /// 资料提交截止时间（Unix 时间戳，秒）
    pub info_deadline: u32,

    /// 审核截止时间（Unix 时间戳，秒）
    pub review_deadline: u32,

    /// 服务暂停状态
    pub service_paused: bool,

    /// 已服务用户数量
    pub users_served: u32,

    /// 脱敏姓名（显示给用户）
    pub masked_full_name: BoundedVec<u8, ConstU32<64>>,

    /// 脱敏身份证号
    pub masked_id_card: BoundedVec<u8, ConstU32<32>>,

    /// 脱敏生日
    pub masked_birthday: BoundedVec<u8, ConstU32<16>>,

    /// 脱敏收款方式信息（JSON 格式）
    pub masked_payment_info: BoundedVec<u8, ConstU32<512>>,

    /// 微信号（显示给用户）
    pub wechat_id: BoundedVec<u8, ConstU32<64>>,

    /// EPAY 商户号（可选）
    pub epay_no: Option<BoundedVec<u8, ConstU32<32>>>,

    /// EPAY 密钥 CID（可选，加密存储）
    pub epay_key_cid: Option<Cid>,

    /// 押金目标 USD 价值（固定 1000 USDT，精度 10^6）
    pub target_deposit_usd: u64,

    /// 上次价格检查时间（区块号）
    pub last_price_check: BlockNumberFor<T>,

    /// 押金不足警告状态
    pub deposit_warning: bool,
}
```

### 2. ApplicationStatus（申请状态）

| 状态 | 说明 | 可转换至 |
|-----|------|---------|
| DepositLocked | 押金已锁定，等待提交资料 | PendingReview, Cancelled, Expired |
| PendingReview | 资料已提交，等待审核 | Active, Rejected, Cancelled |
| Active | 审核通过，做市商已激活 | - |
| Rejected | 审核驳回 | - |
| Cancelled | 申请已取消 | - |
| Expired | 申请已超时 | - |

### 3. Direction（业务方向）

```rust
pub enum Direction {
    /// 仅买入（仅 Bridge）- 做市商购买 DUST，支付 USDT
    Buy = 0,

    /// 仅卖出（仅 OTC）- 做市商出售 DUST，收取 USDT
    Sell = 1,

    /// 双向（OTC + Bridge）- 既可以买入也可以卖出
    BuyAndSell = 2,
}
```

**使用场景**：
- **Buy**：专注 Bridge 业务的做市商（用户用 USDT 购买 DUST）
- **Sell**：专注 OTC 业务的做市商（用户用 DUST 兑换 USDT）
- **BuyAndSell**：全能做市商（同时提供 OTC 和 Bridge 服务）

### 4. PenaltyType（惩罚类型）

```rust
pub enum PenaltyType {
    /// OTC 订单超时
    OtcTimeout {
        order_id: u64,
        timeout_hours: u32,
    },

    /// Bridge 兑换超时
    BridgeTimeout {
        swap_id: u64,
        timeout_hours: u32,
    },

    /// 争议败诉
    ArbitrationLoss {
        case_id: u64,
        loss_amount: u64, // USD amount (精度 10^6)
    },

    /// 信用分过低
    LowCreditScore {
        current_score: u32,
        days_below_threshold: u32,
    },

    /// 恶意行为
    MaliciousBehavior {
        behavior_type: u8, // 1=轻微, 2=中等, 3=严重
        evidence_cid: BoundedVec<u8, ConstU32<64>>,
    },
}
```

### 5. PenaltyRecord（惩罚记录）

```rust
pub struct PenaltyRecord<T: Config> {
    /// 做市商 ID
    pub maker_id: u64,

    /// 扣除类型
    pub penalty_type: PenaltyType,

    /// 扣除的 DUST 数量
    pub deducted_amount: BalanceOf<T>,

    /// 扣除时的 USD 价值
    pub usd_value: u64,

    /// 受益人账户（如果有）
    pub beneficiary: Option<T::AccountId>,

    /// 扣除时间（区块号）
    pub deducted_at: BlockNumberFor<T>,

    /// 是否已申诉
    pub appealed: bool,

    /// 申诉结果（Some(true)=申诉成功，Some(false)=申诉失败，None=未处理）
    pub appeal_result: Option<bool>,
}
```

### 6. WithdrawalRequest（提现请求）

```rust
pub struct WithdrawalRequest<Balance> {
    /// 提现金额
    pub amount: Balance,

    /// 申请时间（Unix 时间戳，秒）
    pub requested_at: u32,

    /// 可执行时间（Unix 时间戳，秒）
    pub executable_at: u32,

    /// 请求状态
    pub status: WithdrawalStatus,
}
```

**状态流转**：
```
Pending → Executed（冷却期满，执行提现）
Pending → Cancelled（用户取消）
```

---

## 🗄️ 存储项

| 存储项 | 类型 | 说明 |
|-------|------|------|
| NextMakerId | StorageValue<u64> | 下一个做市商 ID（自增） |
| MakerApplications | StorageMap<u64, MakerApplication> | 做市商申请记录 |
| AccountToMaker | StorageMap<AccountId, u64> | 账户到做市商 ID 的映射 |
| WithdrawalRequests | StorageMap<u64, WithdrawalRequest> | 提现请求记录 |
| NextPenaltyId | StorageValue<u64> | 下一个惩罚记录 ID（自增） |
| PenaltyRecords | StorageMap<u64, PenaltyRecord> | 惩罚记录 |
| MakerPenalties | StorageMap<u64, BoundedVec<u64, 100>> | 做市商的惩罚记录列表 |

---

## 📡 事件定义

| 事件 | 参数 | 说明 |
|-----|------|------|
| MakerDepositLocked | maker_id, who, amount | 押金已锁定 |
| MakerInfoSubmitted | maker_id, who | 资料已提交 |
| MakerApproved | maker_id, approved_by | 做市商已批准 |
| MakerRejected | maker_id, rejected_by | 做市商已驳回 |
| MakerCancelled | maker_id, who | 做市商申请已取消 |
| WithdrawalRequested | maker_id, amount | 提现已申请 |
| WithdrawalExecuted | maker_id, amount | 提现已执行 |
| WithdrawalCancelled | maker_id | 提现已取消 |
| EmergencyWithdrawalExecuted | maker_id, to, amount | 紧急提现已执行 |
| DepositReplenished | maker_id, amount, total_deposit | 押金已补充 |
| DepositInsufficient | maker_id, current_usd_value | 押金不足警告 |
| DepositCheckCompleted | checked_count, insufficient_count | 押金检查完成 |
| DepositDeducted | maker_id, penalty_id, deducted_amount, usd_value, reason, beneficiary | 押金已扣除 |
| DepositReplenishmentRequired | maker_id, current_usd_value, required_usd_value | 需要补充押金 |
| PenaltyAppealed | maker_id, penalty_id, appeal_case_id | 押金扣除申诉 |
| AppealResultProcessed | penalty_id, maker_id, appeal_granted | 申诉结果处理 |
| PenaltyRefunded | penalty_id, maker_id, refunded_amount | 押金已退还 |

---

## ❌ 错误定义

| 错误 | 说明 |
|-----|------|
| MakerAlreadyExists | 已经申请过做市商 |
| MakerNotFound | 做市商不存在 |
| InvalidMakerStatus | 状态不正确 |
| InsufficientDeposit | 押金不足 |
| MakerNotActive | 做市商未激活 |
| InsufficientBalance | 余额不足 |
| InvalidTronAddress | 无效的 TRON 地址 |
| InvalidEpayConfig | 无效的 EPAY 配置 |
| EncodingError | 编码错误 |
| WithdrawalRequestNotFound | 提现请求不存在 |
| WithdrawalCooldownNotMet | 提现冷却期未满足 |
| NotAuthorized | 未授权 |
| PriceNotAvailable | 价格不可用 |
| DepositCalculationOverflow | 押金计算溢出 |
| CannotReplenishDeposit | 押金不足且无法补充 |
| PenaltyRecordNotFound | 惩罚记录不存在 |
| AlreadyAppealed | 已经申诉过 |
| AppealDeadlineExpired | 申诉期限已过 |
| EvidenceTooLong | 证据太长 |
| OrderNotFound | 订单不存在 |
| SwapNotFound | 兑换不存在 |
| CalculationOverflow | 计算溢出 |

---

## ⚙️ 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| Currency | Currency + ReservableCurrency | - | 货币类型（用于押金锁定） |
| MakerCredit | MakerCreditInterface | - | 信用记录接口 |
| GovernanceOrigin | EnsureOrigin | - | 治理权限 |
| Timestamp | UnixTime | - | 时间戳提供者 |
| MakerDepositAmount | Balance | 1,000,000 DUST | 做市商初始押金金额 |
| TargetDepositUsd | u64 | 1,000,000,000 (1,000 USD) | 押金目标 USD 价值 |
| DepositReplenishThreshold | u64 | 950,000,000 (950 USD) | 押金补充触发阈值 |
| DepositReplenishTarget | u64 | 1,050,000,000 (1,050 USD) | 押金补充目标 |
| PriceCheckInterval | BlockNumber | 600 块（约 1 小时） | 价格检查间隔 |
| AppealDeadline | BlockNumber | 100,800 块（约 7 天） | 申诉时限 |
| Pricing | PricingProvider | - | 定价服务接口 |
| MakerApplicationTimeout | BlockNumber | 86,400 块（约 6 天） | 申请超时时间 |
| WithdrawalCooldown | BlockNumber | 100,800 块（约 7 天） | 提现冷却期 |
| WeightInfo | WeightInfo | - | 权重信息 |

**Runtime 配置示例**：
```rust
impl pallet_maker::Config for Runtime {
    type Currency = Balances;
    type MakerCredit = Credit;
    type GovernanceOrigin = EnsureRoot<AccountId>;
    type Timestamp = Timestamp;
    type MakerDepositAmount = ConstU128<1_000_000_000_000_000_000>; // 1,000,000 DUST
    type TargetDepositUsd = ConstU64<1_000_000_000>; // 1,000 USD (精度10^6)
    type DepositReplenishThreshold = ConstU64<950_000_000>; // 950 USD
    type DepositReplenishTarget = ConstU64<1_050_000_000>; // 1,050 USD
    type PriceCheckInterval = ConstU32<600>; // 每小时检查一次
    type AppealDeadline = ConstU32<100_800>; // 7天申诉期
    type Pricing = Pricing;
    type MakerApplicationTimeout = ConstU32<86_400>; // 6天
    type WithdrawalCooldown = ConstU32<100_800>; // 7天
    type WeightInfo = ();
}
```

---

## 💻 使用示例

### 1. Rust 集成示例

#### 1.1 其他 pallet 调用押金扣除

```rust
// 在 pallet-otc-order 中调用
use pallet_maker::{PenaltyType, Pallet as MakerPallet};

impl<T: Config> Pallet<T> {
    pub fn handle_otc_timeout(order_id: u64, maker_id: u64) -> DispatchResult {
        // 扣除做市商押金
        let penalty_id = MakerPallet::<T>::deduct_maker_deposit(
            maker_id,
            PenaltyType::OtcTimeout {
                order_id,
                timeout_hours: 24,
            },
            Some(buyer_account), // 受益人为买家
        )?;

        log::info!("OTC订单超时，已扣除做市商押金，penalty_id: {}", penalty_id);
        Ok(())
    }
}
```

#### 1.2 查询做市商押金状态

```rust
// 检查押金是否充足
let is_sufficient = pallet_maker::Pallet::<T>::check_deposit_sufficiency(maker_id)?;

if !is_sufficient {
    // 获取当前USD价值
    let current_usd = pallet_maker::Pallet::<T>::get_deposit_usd_value(maker_id)?;
    log::warn!("做市商 {} 押金不足，当前价值: {} USD", maker_id, current_usd);
}

// 检查做市商是否活跃
let is_active = pallet_maker::Pallet::<T>::is_maker_active(maker_id);
```

### 2. TypeScript/JavaScript 前端示例

#### 2.1 查询做市商信息

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';

// 连接节点
const provider = new WsProvider('ws://localhost:9944');
const api = await ApiPromise.create({ provider });

// 查询做市商信息
const makerId = 1;
const maker = await api.query.maker.makerApplications(makerId);

if (maker.isSome) {
  const app = maker.unwrap();
  console.log('做市商状态:', app.status.toString());
  console.log('押金金额:', app.deposit.toString());
  console.log('业务方向:', app.direction.toNumber()); // 0=Buy, 1=Sell, 2=BuyAndSell
  console.log('TRON地址:', app.tron_address.toUtf8());
  console.log('脱敏姓名:', app.masked_full_name.toUtf8());
  console.log('微信号:', app.wechat_id.toUtf8());
  console.log('押金警告:', app.deposit_warning.toString());
  console.log('目标USD价值:', app.target_deposit_usd.toNumber() / 1_000_000, 'USD');
}

// 查询账户对应的做市商ID
const account = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const makerIdOpt = await api.query.maker.accountToMaker(account);

if (makerIdOpt.isSome) {
  const id = makerIdOpt.unwrap().toNumber();
  console.log('做市商ID:', id);
}

// 查询提现请求
const withdrawal = await api.query.maker.withdrawalRequests(makerId);

if (withdrawal.isSome) {
  const req = withdrawal.unwrap();
  console.log('提现金额:', req.amount.toString());
  console.log('申请时间:', new Date(req.requested_at.toNumber() * 1000));
  console.log('可执行时间:', new Date(req.executable_at.toNumber() * 1000));
  console.log('状态:', req.status.toString()); // Pending/Executed/Cancelled
}

// 查询惩罚记录
const penaltyId = 1;
const penalty = await api.query.maker.penaltyRecords(penaltyId);

if (penalty.isSome) {
  const record = penalty.unwrap();
  console.log('做市商ID:', record.maker_id.toNumber());
  console.log('扣除DUST:', record.deducted_amount.toString());
  console.log('USD价值:', record.usd_value.toNumber() / 1_000_000, 'USD');
  console.log('已申诉:', record.appealed.toString());

  // 解析惩罚类型
  if (record.penalty_type.isOtcTimeout) {
    const otc = record.penalty_type.asOtcTimeout;
    console.log('OTC超时 - 订单ID:', otc.order_id.toNumber());
  }
}

// 查询做市商的所有惩罚记录
const penaltyIds = await api.query.maker.makerPenalties(makerId);
console.log('惩罚记录IDs:', penaltyIds.toJSON());
```

#### 2.2 申请成为做市商

```typescript
import { Keyring } from '@polkadot/keyring';

const keyring = new Keyring({ type: 'sr25519' });
const alice = keyring.addFromUri('//Alice');

// 1. 锁定押金
const lockTx = api.tx.maker.lockDeposit();
await lockTx.signAndSend(alice, ({ status, events }) => {
  if (status.isInBlock) {
    console.log('押金已锁定，区块哈希:', status.asInBlock.toString());

    // 查找 MakerDepositLocked 事件获取 maker_id
    events.forEach(({ event }) => {
      if (api.events.maker.MakerDepositLocked.is(event)) {
        const [makerId, who, amount] = event.data;
        console.log('做市商ID:', makerId.toString());
        console.log('押金金额:', amount.toString());
      }
    });
  }
});

// 2. 提交资料
const submitTx = api.tx.maker.submitInfo(
  '张三',                                   // real_name
  '110101199001011234',                    // id_card_number
  '1990-01-01',                            // birthday
  'TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW',   // tron_address
  'weixin123',                             // wechat_id
  null,                                     // epay_no (可选)
  null                                      // epay_key (可选)
);

await submitTx.signAndSend(alice, ({ status }) => {
  if (status.isInBlock) {
    console.log('资料已提交');
  }
});
```

#### 2.3 治理审批做市商

```typescript
// 审批通过
const approveTx = api.tx.maker.approveMaker(makerId);
await approveTx.signAndSend(governanceAccount, ({ status, events }) => {
  if (status.isInBlock) {
    console.log('做市商已批准');

    events.forEach(({ event }) => {
      if (api.events.maker.MakerApproved.is(event)) {
        const [makerId, approvedBy] = event.data;
        console.log('做市商ID:', makerId.toString());
      }
    });
  }
});

// 驳回申请
const rejectTx = api.tx.maker.rejectMaker(makerId);
await rejectTx.signAndSend(governanceAccount, ({ status }) => {
  if (status.isInBlock) {
    console.log('做市商已驳回，押金已退还');
  }
});
```

#### 2.4 补充押金

```typescript
// 检查是否需要补充押金
const needsReplenishment = await api.rpc.state.call(
  'MakerApi_needs_deposit_replenishment',
  makerId
);

if (needsReplenishment) {
  // 补充押金
  const replenishTx = api.tx.maker.replenishDeposit();
  await replenishTx.signAndSend(makerAccount, ({ status, events }) => {
    if (status.isInBlock) {
      events.forEach(({ event }) => {
        if (api.events.maker.DepositReplenished.is(event)) {
          const [makerId, amount, totalDeposit] = event.data;
          console.log('押金已补充:', amount.toString(), 'DUST');
          console.log('总押金:', totalDeposit.toString(), 'DUST');
        }
      });
    }
  });
}
```

#### 2.5 申请提现

```typescript
// 1. 申请提现
const amount = api.createType('Balance', '500000000000000000000000'); // 500,000 DUST
const requestTx = api.tx.maker.requestWithdrawal(amount);

await requestTx.signAndSend(makerAccount, ({ status, events }) => {
  if (status.isInBlock) {
    console.log('提现已申请，7天后可执行');

    events.forEach(({ event }) => {
      if (api.events.maker.WithdrawalRequested.is(event)) {
        const [makerId, withdrawAmount] = event.data;
        console.log('提现金额:', withdrawAmount.toString());
      }
    });
  }
});

// 2. 查询提现请求
const withdrawal = await api.query.maker.withdrawalRequests(makerId);
if (withdrawal.isSome) {
  const req = withdrawal.unwrap();
  const executableTime = new Date(req.executable_at.toNumber() * 1000);
  console.log('可执行时间:', executableTime);

  // 检查是否可以执行
  const now = Date.now();
  const canExecute = now >= executableTime.getTime();

  if (canExecute) {
    // 3. 执行提现
    const executeTx = api.tx.maker.executeWithdrawal();
    await executeTx.signAndSend(makerAccount, ({ status }) => {
      if (status.isInBlock) {
        console.log('提现已执行');
      }
    });
  } else {
    console.log('冷却期未满，还需等待', Math.ceil((executableTime.getTime() - now) / 86400000), '天');
  }
}

// 4. 取消提现（可选）
const cancelTx = api.tx.maker.cancelWithdrawal();
await cancelTx.signAndSend(makerAccount, ({ status }) => {
  if (status.isInBlock) {
    console.log('提现已取消');
  }
});
```

#### 2.6 申诉押金扣除

```typescript
// 查询惩罚记录
const penaltyId = 1;
const penalty = await api.query.maker.penaltyRecords(penaltyId);

if (penalty.isSome) {
  const record = penalty.unwrap();

  if (!record.appealed) {
    // 上传证据到IPFS（示例）
    const evidenceCid = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';

    // 提起申诉
    const appealTx = api.tx.maker.appealPenalty(
      penaltyId,
      evidenceCid
    );

    await appealTx.signAndSend(makerAccount, ({ status, events }) => {
      if (status.isInBlock) {
        events.forEach(({ event }) => {
          if (api.events.maker.PenaltyAppealed.is(event)) {
            const [makerId, penaltyId, appealCaseId] = event.data;
            console.log('申诉已提交，案件ID:', appealCaseId.toString());
          }
        });
      }
    });
  } else {
    console.log('该惩罚记录已申诉过');
  }
}
```

#### 2.7 监听事件

```typescript
// 监听所有做市商相关事件
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;

    // 押金已锁定
    if (api.events.maker.MakerDepositLocked.is(event)) {
      const [makerId, who, amount] = event.data;
      console.log(`新做市商申请 - ID: ${makerId}, 账户: ${who}, 押金: ${amount}`);
    }

    // 押金已补充
    if (api.events.maker.DepositReplenished.is(event)) {
      const [makerId, amount, totalDeposit] = event.data;
      console.log(`押金已补充 - 做市商ID: ${makerId}, 补充: ${amount}, 总计: ${totalDeposit}`);
    }

    // 押金已扣除
    if (api.events.maker.DepositDeducted.is(event)) {
      const [makerId, penaltyId, deductedAmount, usdValue, reason, beneficiary] = event.data;
      console.log(`押金已扣除 - 做市商ID: ${makerId}, 金额: ${deductedAmount}, USD: ${usdValue / 1_000_000}`);
    }

    // 押金不足警告
    if (api.events.maker.DepositReplenishmentRequired.is(event)) {
      const [makerId, currentUsdValue, requiredUsdValue] = event.data;
      console.log(`押金不足警告 - 做市商ID: ${makerId}, 当前: ${currentUsdValue / 1_000_000} USD, 需要: ${requiredUsdValue / 1_000_000} USD`);
    }
  });
});
```

---

## 🔗 集成说明

### 1. 依赖 Pallet

#### 1.1 pallet-trading-common

**用途**：提供通用工具函数

**函数**：
- `is_valid_tron_address(address: &[u8]) -> bool`：验证 TRON 地址格式
- `is_valid_epay_config(epay_no: &Option<Vec<u8>>, epay_key: &Option<Vec<u8>>) -> bool`：验证 EPAY 配置
- `mask_name(name: &str) -> Vec<u8>`：脱敏姓名
- `mask_id_card(id_card: &str) -> Vec<u8>`：脱敏身份证号
- `mask_birthday(birthday: &str) -> Vec<u8>`：脱敏生日

**Cargo.toml 配置**：
```toml
[dependencies]
pallet-trading-common = { path = "../trading-common", default-features = false }
```

#### 1.2 pallet-credit

**用途**：信用评分系统

**接口**：
```rust
pub trait MakerCreditInterface<AccountId> {
    /// 获取做市商信用记录
    fn get_maker_credit(maker_id: u64) -> Option<MakerCredit>;

    /// 初始化做市商信用记录
    fn initialize_maker_credit(maker_id: u64, owner: &AccountId) -> DispatchResult;
}
```

#### 1.3 pallet-pricing

**用途**：提供 DUST/USD 实时汇率

**接口**：
```rust
pub trait PricingProvider<Balance> {
    /// 获取 DUST/USD 汇率（精度 10^6）
    fn get_dust_to_usd_rate() -> Option<Balance>;
}
```

**实现示例**（在 pallet-pricing 中）：
```rust
impl<T: Config> PricingProvider<BalanceOf<T>> for Pallet<T> {
    fn get_dust_to_usd_rate() -> Option<BalanceOf<T>> {
        // 从预言机或交易所获取实时汇率
        // 假设 1 DUST = 0.5 USD
        Some(500_000u128.into()) // 0.5 × 10^6
    }
}
```

### 2. 被调用 Pallet

#### 2.1 pallet-otc-order

**调用场景**：OTC 订单超时，扣除做市商押金

**代码示例**：
```rust
// 在 pallet-otc-order 中
use pallet_maker::{PenaltyType, Pallet as MakerPallet};

impl<T: Config> Pallet<T> {
    pub fn handle_order_timeout(order_id: u64) -> DispatchResult {
        let order = Orders::<T>::get(order_id)
            .ok_or(Error::<T>::OrderNotFound)?;

        // 扣除做市商押金
        let penalty_id = MakerPallet::<T>::deduct_maker_deposit(
            order.maker_id,
            PenaltyType::OtcTimeout {
                order_id,
                timeout_hours: 24,
            },
            Some(order.buyer), // 受益人为买家
        )?;

        Ok(())
    }
}
```

#### 2.2 pallet-bridge

**调用场景**：Bridge 兑换超时，扣除做市商押金

**代码示例**：
```rust
// 在 pallet-bridge 中
use pallet_maker::{PenaltyType, Pallet as MakerPallet};

impl<T: Config> Pallet<T> {
    pub fn handle_swap_timeout(swap_id: u64) -> DispatchResult {
        let swap = Swaps::<T>::get(swap_id)
            .ok_or(Error::<T>::SwapNotFound)?;

        // 扣除做市商押金
        let penalty_id = MakerPallet::<T>::deduct_maker_deposit(
            swap.maker_id,
            PenaltyType::BridgeTimeout {
                swap_id,
                timeout_hours: 48,
            },
            Some(swap.user), // 受益人为用户
        )?;

        Ok(())
    }
}
```

#### 2.3 pallet-arbitration

**调用场景**：争议仲裁败诉，扣除做市商押金

**代码示例**：
```rust
// 在 pallet-arbitration 中
use pallet_maker::{PenaltyType, Pallet as MakerPallet};

impl<T: Config> Pallet<T> {
    pub fn process_arbitration_result(case_id: u64, winner: T::AccountId) -> DispatchResult {
        let case = Cases::<T>::get(case_id)
            .ok_or(Error::<T>::CaseNotFound)?;

        // 如果做市商败诉
        if winner != case.maker_account {
            let penalty_id = MakerPallet::<T>::deduct_maker_deposit(
                case.maker_id,
                PenaltyType::ArbitrationLoss {
                    case_id,
                    loss_amount: case.dispute_amount,
                },
                Some(winner), // 受益人为胜诉方
            )?;
        }

        Ok(())
    }
}
```

### 3. Runtime 集成

**runtime/src/lib.rs**：
```rust
// 配置 pallet-maker
impl pallet_maker::Config for Runtime {
    type Currency = Balances;
    type MakerCredit = Credit;
    type GovernanceOrigin = EnsureRoot<AccountId>;
    type Timestamp = Timestamp;
    type MakerDepositAmount = ConstU128<1_000_000_000_000_000_000>; // 1,000,000 DUST
    type TargetDepositUsd = ConstU64<1_000_000_000>; // 1,000 USD (精度10^6)
    type DepositReplenishThreshold = ConstU64<950_000_000>; // 950 USD
    type DepositReplenishTarget = ConstU64<1_050_000_000>; // 1,050 USD
    type PriceCheckInterval = ConstU32<600>; // 每小时检查一次
    type AppealDeadline = ConstU32<100_800>; // 7天申诉期
    type Pricing = Pricing;
    type MakerApplicationTimeout = ConstU32<86_400>; // 6天
    type WithdrawalCooldown = ConstU32<100_800>; // 7天
    type WeightInfo = ();
}

// 添加到 construct_runtime!
construct_runtime!(
    pub enum Runtime {
        // ... 其他 pallet
        Maker: pallet_maker,
        // ... 其他 pallet
    }
);
```

---

## 📌 最佳实践

### 1. 押金管理

**建议做市商**：
- 定期检查押金 USD 价值（每天或每周）
- 当收到 `DepositReplenishmentRequired` 事件时，及时补充押金
- 保持押金价值在 1,000 USD 以上，避免触发警告

**前端实现**：
```typescript
// 定期检查押金状态
setInterval(async () => {
  const maker = await api.query.maker.makerApplications(makerId);

  if (maker.isSome) {
    const app = maker.unwrap();

    // 获取当前USD价值
    const usdValue = await api.rpc.state.call(
      'MakerApi_get_deposit_usd_value',
      makerId
    );

    console.log('当前押金USD价值:', usdValue / 1_000_000, 'USD');

    // 检查是否需要补充
    if (app.deposit_warning || usdValue < 950_000_000) {
      alert('押金不足，请尽快补充！');
    }
  }
}, 3600000); // 每小时检查一次
```

### 2. 违规处理

**做市商应避免**：
- OTC 订单超时（24 小时内未转账）
- Bridge 兑换超时（48 小时内未转账）
- 争议仲裁败诉（提供虚假信息或服务不到位）
- 信用分持续过低（及时处理订单，提高服务质量）

**申诉流程**：
1. 收到 `DepositDeducted` 事件后，检查扣除是否合理
2. 准备证据（截图、聊天记录等）并上传到 IPFS
3. 在 7 天内调用 `appeal_penalty` 提起申诉
4. 等待仲裁委员会处理

### 3. 提现策略

**建议**：
- 不要提现全部押金（保留一定余量）
- 提现前确认没有待处理的订单
- 合理利用 7 天冷却期（用于处理纠纷）

### 4. 安全性

**做市商账户安全**：
- 使用硬件钱包（Ledger 等）
- 定期备份私钥
- 不要在公共设备上操作

**IPFS 数据安全**：
- 敏感资料（身份证、EPAY 密钥等）必须加密后上传
- 使用对称加密（AES-256）+ 非对称加密（RSA/ECC）
- 治理委员会持有解密密钥

### 5. 信用维护

**提高信用分**：
- 及时处理订单（< 1 小时）
- 提供优质服务（用户满意度高）
- 避免争议和投诉
- 保持押金充足

**信用等级对应押金折扣**：
- 钻石（≥900）：0.5× = 500,000 DUST
- 白金（≥800）：0.7× = 700,000 DUST
- 黄金（≥700）：0.8× = 800,000 DUST
- 白银（≥600）：0.9× = 900,000 DUST
- 青铜（<600）：1.0× = 1,000,000 DUST

---

## 🧪 测试指南

### 1. 单元测试

**运行测试**：
```bash
cargo test -p pallet-maker
```

**测试用例**：
- 做市商申请流程
- 押金动态调整
- 提现冷却期
- 押金扣除和申诉
- 状态转换

### 2. 集成测试

**测试场景**：
1. 做市商申请 → 提交资料 → 审核通过 → 创建订单
2. 订单超时 → 扣除押金 → 补充押金
3. 申请提现 → 等待冷却期 → 执行提现
4. 押金扣除 → 提起申诉 → 仲裁结果

### 3. 手动测试

**使用 Polkadot-JS Apps**：
1. 连接到本地节点：`ws://localhost:9944`
2. 导航到 Developer → Extrinsics
3. 选择 `maker` 模块
4. 测试各个 extrinsics

---

## 📚 参考资料

- **Substrate 文档**：https://docs.substrate.io/
- **Polkadot-JS API 文档**：https://polkadot.js.org/docs/
- **FRAME Pallet 开发指南**：https://docs.substrate.io/reference/frame-pallets/
- **TRON 地址格式**：https://developers.tron.network/docs/account
- **IPFS 文档**：https://docs.ipfs.tech/

---

## 📝 版本历史

| 版本 | 日期 | 说明 |
|-----|------|------|
| v0.1.0 | 2025-11-03 | 从 pallet-trading 拆分而来，初始版本 |
| v0.2.0 | 2025-11-10 | 新增动态押金管理系统 |
| v0.3.0 | 2025-11-11 | 新增押金扣除和申诉机制 |

---

## 🤝 贡献指南

欢迎贡献代码和文档！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 开启 Pull Request

---

## 📄 许可证

本项目使用 MIT 许可证。详见 `LICENSE` 文件。

---

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: https://github.com/your-repo/stardust/issues
- Email: support@stardust.io

---

**文档版本**: v1.0.0
**最后更新**: 2025-11-11
**作者**: Stardust Development Team
