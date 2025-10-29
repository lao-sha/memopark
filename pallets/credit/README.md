# Pallet Credit (信用管理整合模块)

## 函数级详细中文注释：统一的信用管理系统

### 概述

本模块整合了买家信用（Buyer Credit）和做市商信用（Maker Credit）两个子系统，提供统一的信用管理、评分计算和风控机制。

### 核心功能

#### 1. 买家信用管理 (buyer.rs)

- **多维度信任评估**
  - 资产信任度（DUST 余额、Staking）
  - 账户年龄信任度
  - 活跃度信任（转账历史）
  - 社交信任（邀请人、推荐）

- **新用户分层冷启动**
  - Premium（0-300风险分）：单笔5000U，日限20000U
  - Standard（301-500）：单笔1000U，日限5000U
  - Basic（501-700）：单笔500U，日限2000U
  - Restricted（701-1000）：单笔100U，日限500U

- **信用等级体系**
  - Newbie（0-5笔）
  - Bronze（6-20笔）
  - Silver（21-50笔）
  - Gold（51-100笔）
  - Diamond（101+笔）

- **快速学习机制**
  - 前3笔交易权重5x
  - 第4-5笔权重3x
  - 第6-10笔权重2x
  - 每5笔行为模式分析

- **社交信任网络**
  - 邀请人信誉传递
  - 用户互相推荐
  - 推荐人连带责任

- **违约惩罚与风险控制**
  - 连续违约检测（7天内3次违约直接封禁）
  - 违约冷却期（1/3/7/14/30天递增）
  - 风险分自然衰减（每30天降低50分）
  - 首笔订单分层折扣（10%限额，保底10U）

#### 2. 做市商信用管理 (maker.rs)

- **信用评分体系（800-1000分）**
  - Diamond（950-1000分）
  - Platinum（900-949分）
  - Gold（850-899分）
  - Silver（820-849分）
  - Bronze（800-819分）

- **履约率追踪**
  - 订单完成率
  - 及时释放率（< 24h）
  - 超时率
  - 平均响应时间

- **违约惩罚机制**
  - 超时未释放：-10分
  - 争议败诉：-20分
  - 自动记录违约历史

- **动态保证金**
  - Diamond：0.5x（减50%）
  - Platinum：0.7x（减30%）
  - Gold：0.8x（减20%）
  - Silver：0.9x（减10%）
  - Bronze：1.0x（无折扣）
  - Warning（750-799）：1.2x（加20%）
  - Suspended（< 750）：2.0x（加100%，但不可接单）

- **服务质量评价**
  - 买家1-5星评分影响信用分
  - 5星：+5分
  - 4星：+2分
  - 3星：0分
  - 1-2星：-5分

- **自动降级/禁用**
  - 信用分 < 750：自动暂停接单
  - 信用分 750-799：警告状态
  - 信用分 >= 800：正常服务

#### 3. 公共功能 (common.rs)

- 信用分计算工具
- 风险评估函数
- 数据验证和校验
- 履约率计算
- 违约率计算

### 模块架构

```text
pallet-credit/
├── src/
│   ├── lib.rs      # 主入口、Config、Event、Error
│   ├── buyer.rs    # 买家信用模块（数据结构）
│   ├── maker.rs    # 做市商信用模块（数据结构）
│   ├── common.rs   # 公共工具
│   ├── mock.rs     # 测试mock
│   └── tests.rs    # 单元测试
├── Cargo.toml
└── README.md
```

### 设计原则

- **模块化**: 买家和做市商逻辑独立，便于维护
- **低耦合**: 通过 trait interface 对外提供服务
- **类型安全**: 使用 BoundedVec 防止无界增长
- **可扩展**: 支持新增信用维度和评分算法

### 存储结构

#### 买家信用存储

1. **BuyerCredits**：买家信用记录
2. **BuyerDailyVolume**：买家每日交易量（用于限额控制）
3. **BuyerOrderHistory**：买家订单历史（最近20笔）
4. **BuyerReferrer**：买家推荐人
5. **BuyerEndorsements**：买家背书记录（最多10个）
6. **TransferCount**：转账计数（用于活跃度评估）
7. **DefaultHistory**：违约历史记录（最多50条）

#### 做市商信用存储

1. **MakerCredits**：做市商信用记录
2. **MakerRatings**：做市商买家评分记录
3. **MakerDefaultHistory**：做市商违约历史
4. **MakerDynamicDeposit**：做市商动态保证金要求

### 事件说明

#### 买家信用事件

- **NewUserInitialized**：新用户初始化（账户, 新用户等级代码, 初始风险分）
- **BuyerCreditUpdated**：买家信用更新（账户, 新风险分, 新等级代码）
- **BuyerLevelUpgraded**：买家等级升级（账户, 旧等级代码, 新等级代码）
- **BuyerDefaultPenalty**：买家违约惩罚（账户, 惩罚分数, 连续违约次数, 新风险分）
- **ConsecutiveDefaultDetected**：连续违约检测到（账户, 连续违约次数, 时间窗口天数）
- **UserBanned**：用户被封禁（账户, 原因）
- **UserEndorsed**：用户推荐（推荐人, 被推荐人）
- **ReferrerSet**：设置邀请人（被邀请人, 邀请人）
- **BehaviorPatternDetected**：行为模式识别（账户, 模式代码, 调整分数）
- **RiskScoreDecayed**：风险分自然衰减（账户, 衰减量, 新风险分）

#### 做市商信用事件

- **MakerCreditInitialized**：做市商信用初始化（做市商ID, 初始分数）
- **MakerOrderCompleted**：订单完成（做市商ID, 订单ID, 新分数, 奖励分数）
- **MakerOrderTimeout**：订单超时（做市商ID, 订单ID, 新分数, 惩罚分数）
- **MakerDisputeResolved**：争议解决（做市商ID, 订单ID, 是否胜诉, 新分数）
- **MakerRated**：买家评价做市商（做市商ID, 订单ID, 买家, 星级, 新分数）
- **MakerStatusChanged**：服务状态变更（做市商ID, 旧状态代码, 新状态代码, 信用分）
- **MakerLevelChanged**：信用等级变更（做市商ID, 旧等级代码, 新等级代码, 信用分）

### 错误说明

#### 买家信用错误

- `CreditScoreTooLow`：信用分过低（风险分 > 800）
- `ExceedSingleLimit`：超过单笔限额
- `ExceedDailyLimit`：超过每日限额
- `InCooldownPeriod`：新用户冷却期内不能交易
- `InDefaultCooldown`：违约冷却期内不能交易
- `InsufficientCreditToEndorse`：推荐人信用不足
- `CannotEndorseSelf`：不能推荐自己
- `AlreadyEndorsed`：已经被推荐过
- `ReferrerAlreadySet`：邀请人已设置
- `CannotReferSelf`：不能邀请自己

#### 做市商信用错误

- `MakerNotFound`：做市商不存在
- `CreditRecordNotFound`：信用记录不存在
- `InvalidRating`：评分超出范围（必须1-5）
- `AlreadyRated`：已评价过此订单
- `NotOrderBuyer`：不是订单买家，无权评价
- `OrderNotCompleted`：订单未完成，无法评价
- `ServiceSuspended`：服务已暂停
- `ScoreOverflow`：信用分计算溢出

### 可调用接口（Extrinsics）

#### 买家信用接口

1. **endorse_user**：推荐用户
   - 参数：`endorsee` - 被推荐人账户
   - 要求：推荐人信用分 >= 700

2. **set_referrer**：设置邀请人
   - 参数：`referrer` - 邀请人账户
   - 要求：仅能设置一次

#### 做市商信用接口

1. **rate_maker**：买家评价做市商
   - 参数：`maker_id`, `order_id`, `stars`, `tags_codes`
   - 要求：评分1-5星，不能重复评价

### 内部函数（跨 Pallet 调用）

#### 买家信用函数

- `check_buyer_limit(buyer, amount_usdt)`：检查买家是否可以创建订单
- `update_credit_on_success(buyer, amount_usdt, payment_time_seconds)`：订单完成后更新信用
- `penalize_default(buyer)`：违约惩罚
- `record_transfer(account)`：记录转账（用于活跃度统计）

#### 做市商信用函数

- `initialize_maker_credit(maker_id)`：初始化做市商信用记录
- `record_maker_order_completed(maker_id, order_id, response_time_seconds)`：记录订单完成
- `record_maker_order_timeout(maker_id, order_id)`：记录订单超时
- `record_maker_dispute_result(maker_id, order_id, maker_win)`：记录争议结果
- `query_maker_credit_score(maker_id)`：查询做市商信用分
- `check_maker_service_status(maker_id)`：检查服务状态
- `calculate_required_deposit(maker_id)`：计算动态保证金要求

### Trait Interfaces

#### BuyerCreditInterface

```rust
pub trait BuyerCreditInterface<AccountId> {
    fn get_buyer_credit_score(buyer: &AccountId) -> Result<u16, DispatchError>;
    fn check_buyer_daily_limit(buyer: &AccountId, amount_usd_cents: u64) -> Result<(), DispatchError>;
    fn check_buyer_single_limit(buyer: &AccountId, amount_usd_cents: u64) -> Result<(), DispatchError>;
}
```

#### MakerCreditInterface

```rust
pub trait MakerCreditInterface {
    fn initialize_credit(maker_id: u64) -> DispatchResult;
    fn check_service_status(maker_id: u64) -> Result<ServiceStatus, DispatchError>;
    fn record_order_completed(maker_id: u64, order_id: u64, response_time_seconds: u32) -> DispatchResult;
    fn record_default_timeout(maker_id: u64, order_id: u64) -> DispatchResult;
    fn record_default_dispute(maker_id: u64, order_id: u64) -> DispatchResult;
}
```

### 配置参数（Runtime Config）

#### 买家信用配置

- `InitialBuyerCreditScore`：买家初始信用分（0-1000，建议500）
- `OrderCompletedBonus`：订单完成信用分增加（建议10）
- `OrderDefaultPenalty`：订单违约信用分扣除（建议50）
- `BlocksPerDay`：每日区块数（用于计算日限额）
- `MinimumBalance`：最小持仓量（用于计算资产信任）

#### 做市商信用配置

- `InitialMakerCreditScore`：做市商初始信用分（800-1000，建议820）
- `MakerOrderCompletedBonus`：订单按时完成信用分增加（建议2）
- `MakerOrderTimeoutPenalty`：订单超时信用分扣除（建议10）
- `MakerDisputeLossPenalty`：争议败诉信用分扣除（建议20）
- `MakerSuspensionThreshold`：做市商服务暂停阈值（建议750）
- `MakerWarningThreshold`：做市商警告阈值（建议800）

### 集成到 Runtime

```rust
// runtime/src/lib.rs

impl pallet_credit::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    
    // 买家信用配置
    type InitialBuyerCreditScore = ConstU16<500>;
    type OrderCompletedBonus = ConstU16<10>;
    type OrderDefaultPenalty = ConstU16<50>;
    type BlocksPerDay = BlocksPerDay;
    type MinimumBalance = ExistentialDeposit;
    
    // 做市商信用配置
    type InitialMakerCreditScore = ConstU16<820>;
    type MakerOrderCompletedBonus = ConstU16<2>;
    type MakerOrderTimeoutPenalty = ConstU16<10>;
    type MakerDisputeLossPenalty = ConstU16<20>;
    type MakerSuspensionThreshold = ConstU16<750>;
    type MakerWarningThreshold = ConstU16<800>;
    
    type CreditWeightInfo = ();
}
```

### 使用示例

#### 买家信用使用

```rust
// 检查买家限额
pallet_credit::Pallet::<Runtime>::check_buyer_limit(&buyer, 1000_000000)?;

// 订单完成后更新信用
pallet_credit::Pallet::<Runtime>::update_credit_on_success(&buyer, 1000_000000, 300);

// 违约惩罚
pallet_credit::Pallet::<Runtime>::penalize_default(&buyer);
```

#### 做市商信用使用

```rust
// 初始化做市商信用
pallet_credit::Pallet::<Runtime>::initialize_maker_credit(maker_id)?;

// 检查服务状态
let status = pallet_credit::Pallet::<Runtime>::check_maker_service_status(maker_id)?;

// 记录订单完成
pallet_credit::Pallet::<Runtime>::record_maker_order_completed(maker_id, order_id, 3600)?;

// 记录订单超时
pallet_credit::Pallet::<Runtime>::record_maker_order_timeout(maker_id, order_id)?;

// 计算动态保证金
let required_deposit = pallet_credit::Pallet::<Runtime>::calculate_required_deposit(maker_id);
```

### 迁移说明

#### 从原有 Pallets 迁移

本模块整合了以下两个原有 pallets：
- `pallet-buyer-credit`
- `pallet-maker-credit`

迁移步骤：
1. 在 runtime 中添加 `pallet-credit` 配置
2. 将原有的买家和做市商信用数据迁移到新的存储结构
3. 更新其他 pallets 中的调用，从原有 pallet 接口改为新的 `pallet-credit` 接口
4. 更新前端调用，适配新的事件和接口

注意：由于主网未上线，现在是零迁移，允许破坏式调整。

### 未来扩展

1. **身份验证集成**：第三阶段实现身份信任评估
2. **机器学习模型**：基于历史数据训练更精准的风险评估模型
3. **跨链信用**：支持跨链信用数据同步和验证
4. **信用NFT**：将信用记录铸造为NFT，支持信用转移
5. **社区治理**：引入社区投票机制，允许社区参与信用规则制定

### 安全考虑

1. **防女巫攻击**：多维度信任评估，单一维度无法刷分
2. **防刷单攻击**：行为模式分析，检测异常交易
3. **防连带作弊**：推荐人连带责任，违约影响推荐人信用
4. **防循环推荐**：推荐关系单向，不允许循环推荐
5. **防信用修复**：违约记录永久保留，风险分自然衰减有限制

### 测试

```bash
# 运行单元测试
cargo test -p pallet-credit

# 编译检查
cargo check -p pallet-credit

# 运行全部测试
cargo test --all
```

### 许可证

参见根目录 LICENSE 文件。

### 贡献

欢迎提交 Issue 和 Pull Request。

### 联系方式

请通过项目 GitHub Issues 反馈问题。
