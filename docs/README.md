# Stardust 项目文档索引

本目录包含 Stardust 项目的所有技术文档和设计方案。

## 📚 文档分类

### 🏗️ 架构设计与技术方案

#### 性能优化
- **[DECEASED_PERFORMANCE_OPTIMIZATION.md](./DECEASED_PERFORMANCE_OPTIMIZATION.md)** - pallet-deceased 性能优化方案
  - 解决 create_deceased() 一次写入15个存储项问题
  - 批量操作缓存优化
  - 智能索引策略
  - 预期性能提升 60-80%

#### 功能设计审查
- **[JOINT_BURIAL_DESIGN.md](./JOINT_BURIAL_DESIGN.md)** - 合葬功能设计方案
- **[JOINT_BURIAL_DESIGN_REVIEW.md](./JOINT_BURIAL_DESIGN_REVIEW.md)** - 合葬功能技术审查报告
  - 识别致命设计缺陷
  - 安全性漏洞分析
  - 文化敏感性问题
  - 改进建议

### 🏛️ 治理系统

#### InstantLevelPercents 治理系统
- **[InstantLevelPercents治理系统技术文档.md](./InstantLevelPercents治理系统技术文档.md)** - 技术实现详细说明
- **[InstantLevelPercents治理系统用户指南.md](./InstantLevelPercents治理系统用户指南.md)** - 用户操作指南
- **[InstantLevelPercents全民投票治理系统-项目完成总结.md](./InstantLevelPercents全民投票治理系统-项目完成总结.md)** - 项目完成总结

#### 治理参数集成
- **[GOVERNANCE_PARAMS_INTEGRATION_COMPLETE.md](./GOVERNANCE_PARAMS_INTEGRATION_COMPLETE.md)** - 治理参数集成完成报告
- **[GOVERNANCE_PARAMS_INTEGRATION_GUIDE.md](./GOVERNANCE_PARAMS_INTEGRATION_GUIDE.md)** - 治理参数集成指南
- **[治理模块迁移完成报告.md](./治理模块迁移完成报告.md)** - 治理模块迁移完成报告

#### 投诉治理机制
- **[作品投诉治理机制补充方案.md](./作品投诉治理机制补充方案.md)** - 投诉机制补充设计
- **[公众投诉治理机制设计方案.md](./公众投诉治理机制设计方案.md)** - 公众投诉机制设计
- **[治理奖励机制可行性分析.md](./治理奖励机制可行性分析.md)** - 奖励机制分析
- **[第三层分成比例为0-治理更新完成.md](./第三层分成比例为0-治理更新完成.md)** - 分成比例更新

### 🔧 模块实现与集成

#### Appeals 系统
- **[STARDUST_APPEALS_INTEGRATION_COMPLETE.md](./STARDUST_APPEALS_INTEGRATION_COMPLETE.md)** - Appeals 系统集成完成报告

#### Deceased 系统
- **[PRIMARY_DECEASED_IMPLEMENTATION_COMPLETE.md](./PRIMARY_DECEASED_IMPLEMENTATION_COMPLETE.md)** - 主要 Deceased 实现完成报告

### 📋 接口文档
- **[pallets接口文档.md](./pallets接口文档.md)** - 所有 pallet 的接口说明

### 📝 项目管理
- **[项目索引.md](./项目索引.md)** - 项目整体索引

### 🛠️ 重命名与清理

#### 代码清理
- **[链端代码全面清理-完成报告.md](./链端代码全面清理-完成报告.md)** - 链端代码清理报告
- **[链端代码全面清理-综合方案.md](./链端代码全面清理-综合方案.md)** - 清理方案设计
- **[链端代码-memo字样清理方案.md](./链端代码-memo字样清理方案.md)** - memo 字样清理
- **[链端代码-memopark字样清理方案.md](./链端代码-memopark字样清理方案.md)** - memopark 字样清理
- **[链端memo清理-总结.md](./链端memo清理-总结.md)** - 清理工作总结

#### 变量重命名
- **[变量重命名方案-memo变量分析.md](./变量重命名方案-memo变量分析.md)** - 变量分析方案
- **[变量重命名-总结报告.md](./变量重命名-总结报告.md)** - 重命名总结
- **[重命名手动操作指南.md](./重命名手动操作指南.md)** - 手动操作指南

#### 项目重命名
- **[项目重命名-最终完成总结.md](./项目重命名-最终完成总结.md)** - 项目重命名完成总结
- **[项目重命名方案-memopark-to-stardust.md](./项目重命名方案-memopark-to-stardust.md)** - 重命名方案设计

### 📦 Package 配置
- **[Package配置更新-完成报告.md](./Package配置更新-完成报告.md)** - 配置更新报告
- **[pallet-balance-tiers-重命名完成报告.md](./pallet-balance-tiers-重命名完成报告.md)** - Balance tiers 重命名

### 🔍 验证与测试

#### 编译验证
- **[编译验证-完成报告.md](./编译验证-完成报告.md)** - 编译验证报告
- **[编译成功-最终总结.md](./编译成功-最终总结.md)** - 编译成功总结
- **[测试验证报告.md](./测试验证报告.md)** - 测试验证报告
- **[测试验证完成报告-方案1快速验证.md](./测试验证完成报告-方案1快速验证.md)** - 快速验证报告
- **[最终验证报告.md](./最终验证报告.md)** - 最终验证结果

#### 问题修复
- **[2025-11-07-修复TransactionPayment和创建批量脚本.md](./2025-11-07-修复TransactionPayment和创建批量脚本.md)** - 支付问题修复
- **[2025-11-08-问题修复总结.md](./2025-11-08-问题修复总结.md)** - 问题修复总结

### 🔒 安全审计
- **[安全审计完整修复报告_最终版.md](./安全审计完整修复报告_最终版.md)** - 安全审计最终报告
- **[安全审计问题修复总结.md](./安全审计问题修复总结.md)** - 安全问题修复总结
- **[安全审计修复最终报告.md](./安全审计修复最终报告.md)** - 修复报告
- **[安全问题快速修复指南.md](./安全问题快速修复指南.md)** - 快速修复指南

### 🚀 部署指南
- **[测试网部署指南.md](./测试网部署指南.md)** - 测试网部署说明

### 💻 前端开发

#### API 迁移
- **[前端API迁移-OtcOrder到Trading.md](./前端API迁移-OtcOrder到Trading.md)** - API 迁移指南

#### UI 更新
- **[第二轮UI文本更新-完成报告.md](./第二轮UI文本更新-完成报告.md)** - UI 文本更新报告
- **[代码注释更新-完成报告.md](./代码注释更新-完成报告.md)** - 注释更新报告

#### 重命名相关
- **[第二轮重命名方案-MEMO和memopark全面分析.md](./第二轮重命名方案-MEMO和memopark全面分析.md)** - 重命名方案分析
- **[重命名进度-链端完成.md](./重命名进度-链端完成.md)** - 链端重命名进度
- **[重命名进度-阶段1-3完成.md](./重命名进度-阶段1-3完成.md)** - 分阶段重命名进度

### 🗄️ 数据清理
- **[被整合Pallet清理分析报告.md](./被整合Pallet清理分析报告.md)** - Pallet 清理分析

## 🔗 快速导航

### 最新文档 (2025-11-18)
1. [DECEASED_PERFORMANCE_OPTIMIZATION.md](./DECEASED_PERFORMANCE_OPTIMIZATION.md) - 性能优化方案
2. [JOINT_BURIAL_DESIGN_REVIEW.md](./JOINT_BURIAL_DESIGN_REVIEW.md) - 合葬功能审查

### 核心技术文档
1. [pallets接口文档.md](./pallets接口文档.md) - API 接口参考
2. [项目索引.md](./项目索引.md) - 项目总览

### 实施指南
1. [测试网部署指南.md](./测试网部署指南.md) - 部署说明
2. [安全问题快速修复指南.md](./安全问题快速修复指南.md) - 安全修复

---

## 📁 历史文档结构 (保留作为参考)

### 📁 maker/ - 做市商系统
| 文档 | 描述 | 状态 |
|------|------|------|
| [dynamic-deposit-management.md](./maker/dynamic-deposit-management.md) | 做市商动态押金管理系统 | ✅ 完成 |

**内容概要：**
- 动态押金机制：固定1000 USDT等值押金
- 自动补充机制：价格波动时自动触发补充
- 实时价格计算：基于pallet-pricing动态计算所需DUST数量
- 监控预警：押金不足时的预警和处理机制

### 📁 otc/ - OTC交易系统
| 文档 | 描述 | 状态 |
|------|------|------|
| [order-amount-limits.md](./otc/order-amount-limits.md) | OTC订单金额限制系统 | ✅ 完成 |

**内容概要：**
- 订单限额：单笔OTC订单最大200 USDT
- 实时验证：基于当前价格动态验证订单金额
- 前端集成：提供前端验证接口和用户反馈
- 首购特例：首购订单固定10 USD无需验证限额

### 📁 risk-control/ - 风险控制系统
| 文档 | 描述 | 状态 |
|------|------|------|
| [deposit-deduction-mechanism.md](./risk-control/deposit-deduction-mechanism.md) | 做市商押金扣除机制 | ✅ 完成 |

**内容概要：**
- 扣除触发条件：订单违约、超时、争议败诉等
- 扣除金额计算：按违规类型和严重程度计算罚金
- 自动补充机制：扣除后的押金自动补充流程
- 申诉机制：支持申诉和仲裁的完整流程

## 核心需求实现

### 📁 maker/ - 做市商系统
| 文档 | 描述 | 状态 |
|------|------|------|
| [dynamic-deposit-management.md](./maker/dynamic-deposit-management.md) | 做市商动态押金管理系统 | ✅ 完成 |

**内容概要：**
- 动态押金机制：固定1000 USDT等值押金
- 自动补充机制：价格波动时自动触发补充
- 实时价格计算：基于pallet-pricing动态计算所需DUST数量
- 监控预警：押金不足时的预警和处理机制

### 📁 otc/ - OTC交易系统
| 文档 | 描述 | 状态 |
|------|------|------|
| [order-amount-limits.md](./otc/order-amount-limits.md) | OTC订单金额限制系统 | ✅ 完成 |

**内容概要：**
- 订单限额：单笔OTC订单最大200 USDT
- 实时验证：基于当前价格动态验证订单金额
- 前端集成：提供前端验证接口和用户反馈
- 首购特例：首购订单固定10 USD无需验证限额

### 📁 risk-control/ - 风险控制系统
| 文档 | 描述 | 状态 |
|------|------|------|
| [deposit-deduction-mechanism.md](./risk-control/deposit-deduction-mechanism.md) | 做市商押金扣除机制 | ✅ 完成 |

**内容概要：**
- 扣除触发条件：订单违约、超时、争议败诉等
- 扣除金额计算：按违规类型和严重程度计算罚金
- 自动补充机制：扣除后的押金自动补充流程
- 申诉机制：支持申诉和仲裁的完整流程

## 核心需求实现

### 1. 做市商押金管理 🔒

**需求：** 做市商押金固定1000 USDT美金，根据实时价格计算DUST数量，扣除后立即补充

**实现要点：**
- 动态押金计算：`MakerDepositAmount = 1000 USD ÷ current_dust_price`
- 价格监控：每小时检查一次押金价值
- 自动补充：低于950 USD时触发补充至1050 USD
- 警告机制：押金不足时的多级预警系统

**关键接口：**
```rust
// 计算USD对应的DUST数量
fn calculate_dust_amount_for_usd(usd_value: u64) -> Result<BalanceOf<T>, DispatchError>

// 检查押金是否充足
fn check_deposit_sufficiency(maker_id: u64) -> Result<bool, DispatchError>

// 补充押金
fn replenish_maker_deposit(maker_id: u64) -> Result<BalanceOf<T>, DispatchError>
```

### 2. OTC订单限额控制 💰

**需求：** 创建的OTC订单金额不超过200 USDT

**实现要点：**
- 金额验证：订单创建时实时验证USD金额
- 价格计算：`USD_amount = DUST_amount × current_dust_price ÷ DUST_precision`
- 限额检查：确保不超过200 USDT限制
- 首购特例：首购订单固定10 USD，无需验证限额

**关键接口：**
```rust
// 验证订单金额
fn validate_order_amount(dust_amount: BalanceOf<T>, is_first_purchase: bool) -> Result<u64, DispatchError>

// 查询最大可购买DUST数量
fn get_max_purchasable_dust() -> Result<BalanceOf<T>, DispatchError>

// 检查DUST数量是否有效
fn is_dust_amount_valid(dust_amount: BalanceOf<T>) -> bool
```

### 3. 押金扣除逻辑 ⚖️

**需求：** 明确押金扣除的触发条件、计算方法和处理流程

**扣除触发条件：**
1. **OTC订单超时**：买家付款后24小时内未释放 → 扣除订单金额5% + 10 USD
2. **Bridge兑换超时**：做市商2小时内未完成USDT转账 → 扣除兑换金额3% + 5 USD
3. **争议败诉**：仲裁败诉 → 扣除争议金额10% + 仲裁费
4. **信用分过低**：低于300分连续7天 → 每日扣除1 USD
5. **恶意行为**：虚假交易等 → 扣除50-200 USD（按严重程度）

**关键接口：**
```rust
// 执行押金扣除
fn deduct_maker_deposit(
    maker_id: u64,
    penalty_type: PenaltyType,
    beneficiary: Option<T::AccountId>
) -> Result<u64, DispatchError>

// 申诉扣除决定
fn appeal_penalty(
    penalty_id: u64,
    evidence_cid: Vec<u8>
) -> DispatchResult

// 处理申诉结果
fn handle_appeal_result(penalty_id: u64, appeal_granted: bool) -> DispatchResult
```

## 技术集成点

### 与现有模块的集成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   pallet-maker  │    │ pallet-otc-order│    │ pallet-pricing  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   押金管理   │◄├────┤ │   订单创建   │ │    │ │  实时价格    │ │
│ │  动态计算    │ │    │ │   金额验证   │ │◄───┤ │  DUST/USD   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ pallet-escrow   │    │ pallet-bridge   │    │ pallet-credit   │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  资金托管    │ │    │ │  兑换管理    │ │    │ │  信用记录    │ │
│ │  扣除执行    │ │    │ │  超时检测    │ │    │ │  惩罚触发    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 数据流图

```
用户创建OTC订单
       │
       ▼
1. 获取实时DUST/USD价格 (pallet-pricing)
       │
       ▼
2. 验证订单金额 ≤ 200 USD (pallet-otc-order)
       │
       ▼
3. 锁定做市商DUST到托管 (pallet-escrow)
       │
       ▼
4. 监控订单超时 (OCW)
       │
   ┌───▼───┐
   │ 正常  │   超时
   │ 释放  │   │
   └───────┘   ▼
            5. 扣除押金 (pallet-maker)
                │
                ▼
            6. 检查押金充足性
                │
                ▼
            7. 触发补充警告/自动补充
```

## 配置参数总览

| 参数名 | 数值 | 说明 | 所在模块 |
|--------|------|------|----------|
| `TargetDepositUsd` | 1000 USD | 做市商押金目标金额 | pallet-maker |
| `DepositReplenishThreshold` | 950 USD | 押金补充触发阈值 | pallet-maker |
| `DepositReplenishTarget` | 1050 USD | 押金补充目标金额 | pallet-maker |
| `PriceCheckInterval` | 600 blocks | 价格检查间隔(1小时) | pallet-maker |
| `MaxOrderUsdAmount` | 200 USD | OTC订单最大金额 | pallet-otc-order |
| `FirstPurchaseUsdAmount` | 10 USD | 首购订单固定金额 | pallet-otc-order |
| `OtcTimeoutPenaltyBps` | 500 bps (5%) | OTC超时罚金比例 | pallet-maker |
| `BridgeTimeoutPenaltyBps` | 300 bps (3%) | Bridge超时罚金比例 | pallet-maker |
| `AppealDeadline` | 7 days | 申诉时限 | pallet-maker |

## 监控指标

### 押金系统健康度
- 活跃做市商数量和总押金价值
- 押金补充频率和成功率
- 价格波动对押金系统的影响

### 订单限额合规性
- 订单金额分布统计
- 因金额超限被拒绝的订单比例
- 接近限额的订单趋势分析

### 风险控制效果
- 押金扣除频率和金额统计
- 各类违规行为的发生率
- 申诉成功率和处理时效

## 实施路线图

### Phase 1: 基础功能 (Week 1-2)
- [ ] 动态押金计算接口
- [ ] 订单金额验证逻辑
- [ ] 基础押金扣除功能

### Phase 2: 自动化 (Week 3-4)
- [ ] 价格监控和自动检查
- [ ] OCW超时检测集成
- [ ] 自动补充机制

### Phase 3: 完善治理 (Week 5-6)
- [ ] 申诉和仲裁流程
- [ ] 监控和报警系统
- [ ] 治理参数可配置

## 维护说明

### 文档更新流程
1. **代码变更时**：同步更新相关技术文档
2. **参数调整时**：更新配置参数表格
3. **新功能时**：添加对应的文档章节
4. **Bug修复时**：更新已知问题和解决方案

### 版本控制
- 主版本号：重大架构变更
- 次版本号：新功能添加
- 修订版本号：Bug修复和文档更新

---

**最后更新**: 2025-11-10
**维护人员**: Stardust开发团队
**反馈渠道**: 提交Issue到项目仓库