# Domain 7 阶段2 Runtime配置指南

## 概述

本文档说明如何在Runtime中配置Domain 7（作品域）阶段2的差异化押金机制。

## 新增配置项

### 1. ReputationProvider实现

```rust
// runtime/src/lib.rs

/// 函数级详细中文注释：信誉提供者适配器（临时实现）
///
/// ## 用途
/// - 桥接pallet-stardust-appeals和信誉管理系统
/// - 阶段2使用固定默认值（50分）
/// - 阶段3将实现真实的信誉计算pallet
///
/// ## 实现策略
/// - 阶段2：所有用户默认50分（标准押金1.0x）
/// - 阶段3：根据用户历史行为动态计算
///   - 成功投诉+5分
///   - 失败投诉-3分
///   - 恶意投诉（连续3次被驳回）-10分
pub struct DefaultReputationProvider;

impl pallet_stardust_appeals::ReputationProvider for DefaultReputationProvider {
    type AccountId = AccountId;

    fn get_reputation(_who: &Self::AccountId) -> Option<u8> {
        // 阶段2：所有用户默认50分（标准押金）
        Some(50)
    }
}
```

### 2. pallet-stardust-appeals配置

```rust
// runtime/src/configs/mod.rs

impl pallet_stardust_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Fungible = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;

    // ========== 🆕 阶段2：差异化押金配置 ==========

    /// 信誉提供者（阶段2使用默认实现）
    type ReputationProvider = DefaultReputationProvider;

    /// 作品投诉基础押金（已在阶段1配置）
    type BaseWorkComplaintDeposit = ConstU128<{ 20 * DUST }>;

    /// 🆕 最小押金限制（5 DUST）
    /// - 防止高信誉用户+低影响力作品导致押金过低
    /// - 即使折扣后也不能低于此值
    type MinWorkComplaintDeposit = ConstU128<{ 5 * DUST }>;

    /// 🆕 最大押金限制（1000 DUST）
    /// - 防止多重系数叠加导致押金过高
    /// - 即使所有系数叠加后也不能超过此值
    type MaxWorkComplaintDeposit = ConstU128<{ 1000 * DUST }>;

    // ========== 现有配置（保持不变） ==========

    /// 作品信息提供者
    type WorksProvider = DeceasedWorksProviderAdapter;

    /// 通用申诉配置
    type AppealDeposit = ConstU128<{ 10 * DUST }>;
    type RejectedSlashBps = ConstU16<3000>;  // 30%
    type WithdrawSlashBps = ConstU16<1000>;  // 10%
    type WindowBlocks = ConstU32<7200>;      // 12小时
    type MaxPerWindow = ConstU32<5>;
    type NoticeDefaultBlocks = ConstU32<50400>; // 7天
    type TreasuryAccount = TreasuryAccount;
    type Router = AppealRouterImpl;
    type GovernanceOrigin = EnsureRootOrHalfCouncil;
    type MaxExecPerBlock = ConstU32<10>;
    type MaxListLen = ConstU32<100>;
    type MaxRetries = ConstU32<3>;
    type RetryBackoffBlocks = ConstU32<14400>; // 1天
    type AppealDepositPolicy = DefaultDepositPolicy;
    type MinEvidenceCidLen = ConstU32<10>;
    type MinReasonCidLen = ConstU32<10>;
    type WeightInfo = ();
    type LastActiveProvider = LastActiveProviderImpl;
}
```

## 押金计算示例

### 场景1：高信誉用户投诉低影响力社交媒体作品

**参数**:
- 作品类型: SocialMedia（0.8x）
- 影响力: 10分（1.0x）
- 验证状态: 未验证（0.8x）
- 用户信誉: 95分（0.5x）
- 全局乘数: 1000（1.0x）
- 操作: HIDE_WORK，基础押金20 DUST

**计算**:
```
最终押金 = 20 × 0.8 × 1.0 × 0.8 × 0.5 × 1.0 = 6.4 DUST
```

**结果**: 6.4 DUST（在5-1000 DUST范围内，有效）

### 场景2：低信誉用户投诉高影响力学术论文

**参数**:
- 作品类型: Academic（2.0x）
- 影响力: 90分（3.0x）
- 验证状态: 已验证（1.5x）
- 用户信誉: 15分（2.0x）
- 全局乘数: 1000（1.0x）
- 操作: DELETE_WORK，基础押金50 DUST

**计算**:
```
最终押金 = 50 × 2.0 × 3.0 × 1.5 × 2.0 × 1.0 = 900 DUST
```

**结果**: 900 DUST（在5-1000 DUST范围内，有效）

### 场景3：极端情况触发上限

**参数**:
- 作品类型: Academic（2.0x）
- 影响力: 95分（3.0x）
- 验证状态: 已验证（1.5x）
- 用户信誉: 10分（2.0x）
- 全局乘数: 1500（1.5x，治理提高门槛）
- 操作: TRANSFER_OWNERSHIP，基础押金100 DUST

**计算**:
```
最终押金 = 100 × 2.0 × 3.0 × 1.5 × 2.0 × 1.5 = 2700 DUST
```

**结果**: 1000 DUST（触发上限，受限于MaxWorkComplaintDeposit）

## 治理操作

### 调整全局押金乘数

```javascript
// 通过polkadot.js调用
api.tx.stardustAppeals.setGlobalDepositMultiplier(1500) // 1.5x
  .signAndSend(sudoAccount);
```

**场景示例**:
1. **DUST价格暴涨10倍** → 设置multiplier=100（0.1x）维持押金价值
2. **恶意投诉激增** → 设置multiplier=1500（1.5x）提高门槛
3. **系统初期鼓励试用** → 设置multiplier=800（0.8x）降低门槛

## 存储查询

### 查询当前全局乘数

```javascript
// polkadot.js查询
const multiplier = await api.query.stardustAppeals.globalDepositMultiplier();
console.log('当前乘数:', multiplier.toNumber()); // 1000 = 1.0x
```

### 查询作品投诉统计

```javascript
const workId = 123;
const stats = await api.query.stardustAppeals.workComplaintStats(workId);
console.log('总投诉数:', stats.totalComplaints.toNumber());
console.log('成功投诉数:', stats.successfulComplaints.toNumber());
console.log('活跃投诉数:', stats.activeComplaints.toNumber());
```

## 事件监听

### 监听押金乘数变化

```javascript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;

    if (api.events.stardustAppeals.GlobalDepositMultiplierUpdated.is(event)) {
      const [oldMultiplier, newMultiplier] = event.data;
      console.log(`押金乘数更新: ${oldMultiplier} → ${newMultiplier}`);
    }
  });
});
```

### 监听作品投诉提交

```javascript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;

    if (api.events.stardustAppeals.WorkComplaintSubmitted.is(event)) {
      const { complaintId, complainant, workId, deposit } = event.data;
      console.log(`投诉 ${complaintId}: 用户 ${complainant} 投诉作品 ${workId}，押金 ${deposit}`);
    }
  });
});
```

## 测试Mock实现

### Mock信誉提供者（用于单元测试）

```rust
// pallets/stardust-appeals/src/mock.rs

pub struct MockReputationProvider;

impl crate::ReputationProvider for MockReputationProvider {
    type AccountId = AccountId;

    fn get_reputation(who: &Self::AccountId) -> Option<u8> {
        // 测试中使用不同账户返回不同信誉值
        match who {
            ALICE => Some(95),  // 高信誉用户
            BOB => Some(50),    // 标准信誉用户
            CHARLIE => Some(15), // 低信誉用户
            _ => Some(50),      // 默认
        }
    }
}
```

## 迁移指南

### 从阶段1升级到阶段2

1. **添加Runtime配置**（见上文）
2. **不需要存储迁移**（GlobalDepositMultiplier有默认值1000）
3. **已存在的投诉不受影响**（押金已锁定）
4. **新投诉自动使用新计算方式**

### 存储影响

- **新增存储**: `GlobalDepositMultiplier`（1个u16值）
- **存储成本**: 可忽略不计（单个值，有默认值）
- **历史兼容**: 完全兼容，不影响已存在数据

## 常见问题

### Q1: 为什么押金计算结果和预期不一致？

**检查项**:
1. 全局乘数是否被治理修改过？查询`GlobalDepositMultiplier`
2. 用户信誉是否正确？检查`ReputationProvider`实现
3. 作品影响力评分是否准确？查看`calculate_work_influence_score`逻辑
4. 是否触发了min/max押金限制？

### Q2: 如何禁用差异化押金？

**方案**:
```rust
// 简单做法：设置所有系数为1000（1.0x）
type MinWorkComplaintDeposit = ConstU128<{ 20 * DUST }>;
type MaxWorkComplaintDeposit = ConstU128<{ 20 * DUST }>;
// 这样最终押金约等于BaseWorkComplaintDeposit
```

### Q3: 信誉系统何时实现？

**计划**:
- 阶段2：使用默认值50（本阶段）
- 阶段3：实现真实的信誉管理pallet
- 阶段4：引入机器学习优化信誉评分

## 性能指标

### 押金计算性能

- **计算时间**: < 1ms（纯整数运算）
- **存储读取**: 1次（GlobalDepositMultiplier）+ 1次（ReputationProvider）
- **Gas成本**: 约5000-10000 gas（取决于ReputationProvider复杂度）

### 存储成本

- **单个投诉**: WorkComplaintExtension约200字节
- **全局乘数**: 2字节（u16）
- **按作品索引**: 每作品约8字节 × 投诉数

---

**文档版本**: v1.0
**创建日期**: 2025-01-15
**负责人**: Substrate开发团队
**状态**: 已完成
