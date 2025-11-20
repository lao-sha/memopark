# Runtime 参数优化方案

> 生成时间：2025-11-03  
> 版本：v1.0  
> 状态：待审核

## 📊 概述

本文档分析当前 Stardust Runtime 的参数配置，并提出优化建议。

---

## 1️⃣ Maker 模块参数

### 当前配置

```rust
// runtime/src/configs/mod.rs:1643-1647
pub const MakerDepositAmount: Balance = 1_000_000_000_000_000_000; // 1000 DUST
pub const MakerApplicationTimeout: BlockNumber = 3 * DAYS;
pub const WithdrawalCooldown: BlockNumber = 7 * DAYS;
```

### 参数分析

| 参数 | 当前值 | 分析 | 建议 |
|------|--------|------|------|
| **押金数量** | 1000 DUST | 合理。按 $0.01/DUST 计算约 $10，适合早期招募 | ✅ 保持 |
| **申请超时** | 3天 | 合理。给予治理足够审核时间 | ✅ 保持 |
| **提现冷却期** | 7天 | 偏长。可能影响做市商资金灵活性 | ⚠️ 建议缩短至 3-5天 |

### 优化建议

```rust
// 🔧 优化方案
pub const MakerDepositAmount: Balance = 1_000_000_000_000_000_000; // 1000 DUST (保持)
pub const MakerApplicationTimeout: BlockNumber = 3 * DAYS; // 3天 (保持)
pub const WithdrawalCooldown: BlockNumber = 5 * DAYS; // 7天 → 5天 (优化)
```

**理由**：
- 5天冷却期既能防止恶意提现，又能提高资金周转效率
- 如有争议，5天内足以发现和处理

---

## 2️⃣ OTC Order 模块参数

### 当前配置

```rust
// runtime/src/configs/mod.rs:1779-1780 + 1574-1581
type OrderTimeout = ConstU64<3_600_000>;  // 1小时 (毫秒)
type EvidenceWindow = ConstU64<86_400_000>;  // 24小时 (毫秒)

pub const FirstPurchaseUsdValue: u128 = 10_000_000; // $10 USD
pub const MinFirstPurchaseDustAmount: Balance = 100_000_000_000_000_000_000; // 100 DUST
pub const MaxFirstPurchaseDustAmount: Balance = 10_000_000_000_000_000_000_000; // 10,000 DUST
pub const MaxFirstPurchaseOrdersPerMaker: u32 = 5;
```

### 参数分析

| 参数 | 当前值 | 分析 | 建议 |
|------|--------|------|------|
| **订单超时** | 1小时 | 偏短。买家可能需要更多时间转账 | ⚠️ 建议延长至 2-3小时 |
| **证据窗口** | 24小时 | 合理。给予充足的举证时间 | ✅ 保持 |
| **首购金额** | $10 | 合理。适合新用户体验 | ✅ 保持 |
| **最小DUST** | 100 DUST | 合理。防止汇率异常 | ✅ 保持 |
| **最大DUST** | 10,000 DUST | 合理。限制单笔风险 | ✅ 保持 |
| **做市商配额** | 5个 | 可能偏低。优质做市商可处理更多 | ⚠️ 建议提升至 10-20个 |

### 优化建议

```rust
// 🔧 优化方案
type OrderTimeout = ConstU64<7_200_000>;  // 1小时 → 2小时 (优化)
type EvidenceWindow = ConstU64<86_400_000>;  // 24小时 (保持)

pub const FirstPurchaseUsdValue: u128 = 10_000_000; // $10 (保持)
pub const MinFirstPurchaseDustAmount: Balance = 100_000_000_000_000_000_000; // 100 DUST (保持)
pub const MaxFirstPurchaseDustAmount: Balance = 10_000_000_000_000_000_000_000; // 10,000 DUST (保持)
pub const MaxFirstPurchaseOrdersPerMaker: u32 = 10; // 5 → 10 (优化)
```

**理由**：
- **订单超时延长**：给予买家更充裕的转账和确认时间，减少超时纠纷
- **做市商配额提升**：优质做市商信用分高，可承接更多首购订单，提升用户体验

---

## 3️⃣ Bridge 模块参数

### 当前配置

```rust
// runtime/src/configs/mod.rs:1654 + 1661-1662
pub const SwapTimeout: BlockNumber = 30 * MINUTES;  // 30分钟
pub const OcwSwapTimeoutBlocks: BlockNumber = 10;  // 10区块 (~2分钟，假设6秒出块)
pub const OcwMinSwapAmount: Balance = 10_000_000_000_000_000; // 10 DUST
```

### 参数分析

| 参数 | 当前值 | 分析 | 建议 |
|------|--------|------|------|
| **官方桥接超时** | 30分钟 | 合理。治理有足够时间处理 | ✅ 保持 |
| **做市商超时区块** | 10区块 (~2分钟) | 过短。做市商可能来不及转账 | ❌ 建议延长至 100区块 (~10分钟) |
| **最小兑换额** | 10 DUST | 合理。防止小额兑换 | ✅ 保持 |

### 优化建议

```rust
// 🔧 优化方案
pub const SwapTimeout: BlockNumber = 30 * MINUTES;  // 30分钟 (保持)
pub const OcwSwapTimeoutBlocks: BlockNumber = 100;  // 10 → 100区块 (优化)
pub const OcwMinSwapAmount: Balance = 10_000_000_000_000_000; // 10 DUST (保持)
```

**理由**：
- **OCW 超时延长**：做市商需要在链下确认、转账 USDT，然后返回链上标记完成。10区块（~2分钟）太短，100区块（~10分钟）更合理
- 如果 OCW 超时太短，会导致大量误报和自动退款

---

## 4️⃣ 经济参数（补充）

### 当前配置

```rust
// runtime/src/configs/mod.rs:1645
pub const MakerDepositAmount: Balance = 1_000_000_000_000_000_000; // 1000 DUST
```

### 未来扩展建议

1. **动态押金机制**：
   ```rust
   // 根据做市商信用分动态调整押金
   // 高信用（900+）：500 DUST
   // 中信用（800-899）：1000 DUST
   // 低信用（<800）：2000 DUST
   ```

2. **手续费机制**：
   ```rust
   // 平台手续费（可由治理调整）
   pub const PlatformFeeRate: u32 = 10; // 0.1% (10 bps)
   pub const MakerFeeRate: u32 = 20; // 0.2% (20 bps)
   ```

3. **激励机制**：
   ```rust
   // 首购补贴（吸引新用户）
   pub const FirstPurchaseSubsidy: Balance = 1_000_000_000_000_000; // 1 DUST
   ```

---

## 5️⃣ 存储限制参数

### 当前配置

```rust
// 在各个 pallet 的 lib.rs 中定义
BoundedVec<u8, ConstU32<34>>  // TRON 地址
BoundedVec<u8, ConstU32<128>> // TRC20 交易哈希
BoundedVec<u8, ConstU32<256>> // CID
BoundedVec<u64, ConstU32<100>> // 用户订单列表
```

### 分析与建议

| 存储类型 | 当前限制 | 分析 | 建议 |
|---------|---------|------|------|
| **TRON 地址** | 34 字节 | ✅ 精确 | 保持 |
| **TRC20 哈希** | 128 字节 | ✅ 足够 | 保持 |
| **CID** | 256 字节 | ✅ 兼容 CIDv1 | 保持 |
| **用户订单列表** | 100 个 | 可能偏低 | ⚠️ 建议提升至 500 |
| **做市商订单列表** | 未设置 | ❌ 缺失 | ➕ 建议添加 1000 |

### 优化建议

在 `pallet-otc-order/src/lib.rs` 中：
```rust
// 当前
BoundedVec<u64, ConstU32<100>>  // 买家订单列表

// 优化后
BoundedVec<u64, ConstU32<500>>  // 买家订单列表
BoundedVec<u64, ConstU32<1000>> // 做市商订单列表
```

---

## 6️⃣ 优化总结

### 优先级 P0（立即执行）

```rust
// 1. OTC Order 超时延长
type OrderTimeout = ConstU64<7_200_000>;  // 1小时 → 2小时

// 2. OCW 超时延长
pub const OcwSwapTimeoutBlocks: BlockNumber = 100;  // 10 → 100区块
```

### 优先级 P1（建议执行）

```rust
// 3. 提现冷却期缩短
pub const WithdrawalCooldown: BlockNumber = 5 * DAYS;  // 7天 → 5天

// 4. 做市商首购配额提升
pub const MaxFirstPurchaseOrdersPerMaker: u32 = 10;  // 5 → 10
```

### 优先级 P2（未来扩展）

- 动态押金机制
- 平台手续费配置
- 首购激励补贴
- 存储限制提升

---

## 7️⃣ 实施计划

### 阶段 1：参数调整（30分钟）
1. 修改 `runtime/src/configs/mod.rs` 中的常量定义
2. 修改 `pallet-otc-order` 配置中的超时参数
3. 编译验证

### 阶段 2：测试验证（1小时）
1. 启动开发节点
2. 测试订单超时行为
3. 测试桥接超时行为
4. 验证做市商首购配额

### 阶段 3：文档更新（30分钟）
1. 更新 pallet README
2. 记录参数变更日志
3. 生成配置文档

---

## 8️⃣ 风险评估

| 变更 | 风险等级 | 潜在影响 | 缓解措施 |
|------|----------|----------|----------|
| 订单超时延长 | 🟢 低 | 占用 Escrow 时间延长 | 2小时仍在合理范围 |
| OCW 超时延长 | 🟢 低 | 资金锁定时间延长 | 10分钟对用户体验影响小 |
| 提现冷却期缩短 | 🟡 中 | 可能增加恶意提现风险 | 保留5天已足够防范 |
| 首购配额提升 | 🟢 低 | 做市商资金压力增加 | 由做市商自主选择承接数量 |

---

## 9️⃣ 监控指标

优化后需要关注以下指标：

1. **订单超时率**：目标 < 5%
2. **做市商首购完成率**：目标 > 95%
3. **桥接成功率**：目标 > 98%
4. **平均订单处理时间**：目标 < 30分钟
5. **用户投诉率**：目标 < 2%

---

## 🎯 总结

本次优化主要聚焦于：
1. ✅ **提升用户体验**：延长订单超时，减少因时间不足导致的纠纷
2. ✅ **优化做市商效率**：提升首购配额，缩短提现冷却期
3. ✅ **增强系统稳定性**：延长 OCW 超时，减少误报
4. ✅ **保持经济安全**：押金和首购限额维持合理范围

**预期收益**：
- 订单超时纠纷减少 30-50%
- 做市商服务容量提升 100%
- 用户满意度提升 20%+

