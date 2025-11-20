# Stardust OTC交易系统完整文档索引

## 文档说明

本索引为Stardust项目的OTC交易系统、仲裁系统、证据系统和信用惩罚机制的完整分析文档。

### 生成日期
2025年11月10日

### 覆盖范围
- **pallet-otc-order**: OTC订单管理 (订单创建、支付、释放、取消、首购)
- **pallet-arbitration**: 仲裁系统 (争议登记、证据管理、仲裁裁决、双向押金)
- **pallet-evidence**: 证据系统 (公开证据、承诺哈希、私密内容、IPFS Pin)
- **pallet-credit**: 信用系统 (做市商评分、等级、服务状态、惩罚规则)
- **跨模块交互**: 域路由、托管集成、信用更新

---

## 文档清单

### 1. 深度分析文档
**文件**: `OTC_ARBITRATION_SYSTEM_ANALYSIS.md` (1359行)
**大小**: 41KB
**类型**: 完整技术分析

#### 包含内容:
- 系统架构概览 (关系图、时序图)
- OTC订单系统 (数据结构、存储、关键函数、首购逻辑)
- 仲裁系统 (裁决类型、Router接口、函数实现、押金处理)
- 证据系统 (数据结构、提交流程、私密内容、限频控制)
- 信用与惩罚机制 (等级、记录、惩罚规则、配置参数)
- 跨Pallet交互 (Router、托管、信用、证据、定价集成)
- 完整流程示例 (买家争议仲裁全过程)
- 安全考虑和Runtime配置

#### 适用场景:
- 深入理解系统设计
- 添加新功能或修改现有逻辑
- 代码审计和安全分析
- 系统故障调试

**推荐阅读时间**: 60-90分钟

---

### 2. 快速参考指南
**文件**: `OTC_QUICK_REFERENCE.md` (534行)
**大小**: 12KB
**类型**: 速查手册

#### 包含内容:
- 核心执行流程 (标准流、争议流、信用变化)
- 关键数据结构速查表 (OrderState、CreditLevel、ServiceStatus)
- 函数签名速查 (OTC、Arbitration、Evidence、Credit pallets)
- 域标识常量表
- 存储结构映射
- 常见错误及解决方案
- 参数配置值速查
- 实战操作流程 (创建订单、发起争议、首购)
- 故障排查清单
- 监控指标
- 文件位置导航

#### 适用场景:
- 快速查找参数和常量
- 常见问题排查
- 集成开发时的参考
- 操作流程确认

**推荐阅读时间**: 10-20分钟

---

## 核心知识点速览

### 1. 订单生命周期
```
Created → PaidOrCommitted → Released
    ↓                          ↓
  Expired/Canceled        订单完成 (+2信用)
  
如有异议:
    PaidOrCommitted → Disputed → Release/Refund
                                  ↓
                            信用变化 (0/+1/-20)
```

### 2. 信用等级与保证金
```
950-1000分 (Diamond)  → 保证金×0.5
900-949分  (Platinum) → 保证金×0.7
850-899分  (Gold)     → 保证金×0.8
820-849分  (Silver)   → 保证金×0.9
800-819分  (Bronze)   → 保证金×1.0
```

### 3. 惩罚规则
```
订单完成         → +2分
超时未支付       → -10分
争议败诉         → -20分
3次违约          → 自动Suspended (暂停)
信用<750分       → 无法接收新订单
```

### 4. 仲裁裁决与罚没
```
Release (胜诉):
  发起方 → 罚没30% (败诉)
  应诉方 → 全额返还

Refund (败诉):
  发起方 → 全额返还
  应诉方 → 罚没30% (败诉)

Partial (部分):
  双方 → 各罚没50%
```

### 5. 首购订单特性
```
固定USD价值: 10 USD
动态DUST计算: 10 USD × 10^12 / price
数量范围: 1-1000 DUST
配额限制: 每个做市商5个并发
永久标记: 每个账户仅一次
```

---

## 关键接口与实现

### 主要Traits

1. **ArbitrationRouter** (Runtime实现)
   - `can_dispute()`: 权限检查
   - `apply_decision()`: 裁决应用
   - `get_counterparty()`: 对方账户
   - `get_order_amount()`: 订单金额

2. **MakerCreditInterface** (Credit Pallet提供)
   - `record_maker_order_completed()`: 订单完成
   - `record_maker_order_timeout()`: 订单超时
   - `record_maker_dispute_result()`: 争议结果

3. **Escrow** (Escrow Pallet提供)
   - `lock_from()`: 锁定资金
   - `release_all()`: 释放资金
   - `refund_all()`: 退款资金

---

## 各Pallet关系图

```
        ┌─────────────────┐
        │  pallet-otc-    │
        │  order          │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    v            v            v
┌────────┐  ┌─────────┐  ┌────────┐
│escrow  │  │credit   │  │pricing │
└────────┘  └─────────┘  └────────┘
    │
    └─── pallet-arbitration
             │
             └─── pallet-evidence
                    │
                    └─── pallet-stardust-ipfs
```

---

## 文档导航

### 按用途分类

#### 系统设计者
1. 阅读: `OTC_ARBITRATION_SYSTEM_ANALYSIS.md` 全文
2. 重点: 系统架构概览、数据结构、跨模块交互
3. 参考: Runtime配置示例

#### 开发工程师
1. 阅读: `OTC_QUICK_REFERENCE.md` 快速了解
2. 深入: `OTC_ARBITRATION_SYSTEM_ANALYSIS.md` 对应章节
3. 工具: 函数签名速查、参数配置值

#### 测试/QA
1. 阅读: `OTC_ARBITRATION_SYSTEM_ANALYSIS.md` 完整流程示例章节
2. 参考: `OTC_QUICK_REFERENCE.md` 故障排查清单
3. 检查: 常见错误及解决方案

#### 运维/监控
1. 阅读: `OTC_QUICK_REFERENCE.md` 监控指标章节
2. 参考: 故障排查流程
3. 检查: 关键KPI指标

---

## 常见问题快速查找

| 问题 | 位置 |
|------|------|
| 订单状态如何流转？ | 深度分析 - OTC订单系统 - 数据结构 |
| 如何计算信用分？ | 深度分析 - 信用与惩罚机制 |
| 仲裁裁决如何执行？ | 深度分析 - 仲裁系统 - arbitrate函数 |
| 双向押金如何处理？ | 深度分析 - 仲裁系统 - 押金处理逻辑 |
| 首购订单有何特殊？ | 深度分析 - OTC订单系统 - 首购订单特殊逻辑 |
| 如何排查故障？ | 快速参考 - 故障排查 |
| 参数配置怎么设置？ | 深度分析 - Runtime配置示例 |

---

## 关键文件对应

### 源代码位置

```
pallets/
├── otc-order/
│   ├── src/lib.rs          ← 订单创建、支付、释放、仲裁接收
│   └── README.md           ← OTC详细文档
├── arbitration/
│   ├── src/lib.rs          ← 争议登记、仲裁裁决、押金处理
│   └── README.md           ← 仲裁详细文档
├── evidence/
│   ├── src/lib.rs          ← 证据提交、链接、私密内容
│   └── README.md           ← 证据详细文档
└── credit/
    ├── src/lib.rs          ← 信用管理、等级、评分
    ├── src/maker.rs        ← 做市商信用具体实现
    └── src/buyer.rs        ← 买家信用实现

runtime/
└── src/configs/mod.rs      ← ArbitrationRouter实现、各pallet配置
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2025-11-10 | 初始完整分析文档 |

---

## 分析方法论

### 1. 深度分析文档 (OTC_ARBITRATION_SYSTEM_ANALYSIS.md)
**方法**: 源代码逐行分析
**覆盖**: 完整的API、数据结构、业务逻辑、安全考虑
**特点**: 详细、全面、适合深度学习

### 2. 快速参考指南 (OTC_QUICK_REFERENCE.md)
**方法**: 关键信息提炼和表格化
**覆盖**: 参数、函数签名、配置、故障排查
**特点**: 简洁、易查、适合快速参考

### 3. 文档索引 (本文件)
**方法**: 分类导航和交叉引用
**覆盖**: 文档概览、导航指南、知识点速览
**特点**: 实用、有组织、易于找到需要的内容

---

## 相关文档

### 官方Pallet README
- `pallets/otc-order/README.md` - OTC订单详细说明
- `pallets/arbitration/README.md` - 仲裁系统详细说明
- `pallets/evidence/README.md` - 证据系统详细说明
- `pallets/credit/README.md` - 信用系统详细说明

### 项目核心文档
- `CLAUDE.md` - 项目整体指导文档
- `runtime/src/configs/mod.rs` - Runtime配置源码

---

## 反馈与改进

如发现分析文档有误或有改进建议，请提交Issue或PR。

### 文档维护检查清单
- [ ] 与源代码保持同步
- [ ] 参数配置值正确
- [ ] 函数签名准确
- [ ] 流程图和示例可执行
- [ ] 所有链接有效
- [ ] 没有过时信息

---

## 快速入门

### 第一次阅读
1. 先读本文件理解整体结构 (5分钟)
2. 阅读`OTC_QUICK_REFERENCE.md`快速掌握概念 (15分钟)
3. 按需深入`OTC_ARBITRATION_SYSTEM_ANALYSIS.md`相关章节

### 开发前准备
1. 快速参考指南 - 了解全局
2. 快速参考指南 - 参数与配置
3. 深度分析 - 涉及部分的详细逻辑

### 故障排查
1. 快速参考指南 - 故障排查清单
2. 深度分析 - 完整流程示例
3. 源代码 - 验证具体实现

---

## 统计信息

| 指标 | 数值 |
|------|------|
| 总文档行数 | 1,893行 |
| 深度分析文档 | 1,359行 (41KB) |
| 快速参考指南 | 534行 (12KB) |
| 覆盖的Pallets | 4个 (otc-order, arbitration, evidence, credit) |
| 包含的数据结构 | 15+ |
| 关键函数分析 | 20+ |
| 配置参数详解 | 30+ |
| 代码示例 | 10+ |

---

## 免责声明

本分析文档基于Stardust项目在2025-11-10时刻的源代码进行分析。随着项目演进，文档可能需要更新。使用本文档时，请确保与当前源代码版本对应。

---

## 联系方式

文档生成者: Claude Code Analysis System
生成时间: 2025-11-10 09:45 UTC
相关模块: Stardust OTC Trading System

