# pallet-stardust-ipfs 优化改造 - 集成测试计划

> **创建时间**: 2025-10-26  
> **测试类型**: 单元测试 + 集成测试 + 端到端测试  
> **预计时间**: 2-3小时

---

## 📋 **测试策略**

### 测试层级

```
┌─────────────────────────────────────────────────┐
│  端到端测试（E2E）                                │
│  ├─ 启动本地测试链                               │
│  ├─ 通过RPC调用测试                              │
│  └─ 验证链上状态                                 │
├─────────────────────────────────────────────────┤
│  集成测试（Integration Tests）                   │
│  ├─ 跨pallet交互测试                             │
│  ├─ Runtime环境测试                              │
│  └─ on_finalize自动化测试                        │
├─────────────────────────────────────────────────┤
│  单元测试（Unit Tests）                          │
│  ├─ 函数级测试                                   │
│  ├─ 错误处理测试                                 │
│  └─ 边界条件测试                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 **测试优先级**

### P0 - 核心功能（必须通过）

| 测试项 | 类型 | 优先级 | 状态 |
|--------|------|--------|------|
| 四层回退扣费机制 | 集成 | P0 | ⏳ 待测试 |
| Pin请求基本流程 | 单元 | P0 | ⏳ 待测试 |
| on_finalize自动扣费 | 集成 | P0 | ⏳ 待测试 |
| 分层配置读取 | 单元 | P0 | ⏳ 待测试 |

### P1 - 重要功能（应该通过）

| 测试项 | 类型 | 优先级 | 状态 |
|--------|------|--------|------|
| 健康巡检机制 | 集成 | P1 | ⏳ 待测试 |
| 治理接口 | 单元 | P1 | ⏳ 待测试 |
| 运营者奖励领取 | 单元 | P1 | ⏳ 待测试 |
| 宽限期机制 | 集成 | P1 | ⏳ 待测试 |

### P2 - 边缘情况（建议通过）

| 测试项 | 类型 | 优先级 | 状态 |
|--------|------|--------|------|
| 极端余额测试 | 单元 | P2 | ⏳ 待测试 |
| 并发Pin请求 | 集成 | P2 | ⏳ 待测试 |
| GenesisConfig初始化 | 单元 | P2 | ⏳ 待测试 |

---

## 🧪 **详细测试用例**

### 1. 四层回退扣费机制测试（P0）

#### 测试目标
验证四层扣费机制能够正确按顺序尝试扣费，并在失败时进入宽限期。

#### 测试场景

##### 场景1.1：第1层扣费成功（IpfsPoolAccount充足）
```rust
#[test]
fn test_four_layer_charge_layer1_success() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - IpfsPoolAccount余额充足（1000 DUST）
        // - 创建deceased并充值SubjectFunding（100 DUST）
        // - 注册运营者并充值OperatorEscrow（100 DUST）
        
        // 执行：
        // - 调用request_pin_for_deceased
        
        // 验证：
        // ✓ 从IpfsPoolAccount扣费成功
        // ✓ SubjectFunding余额不变
        // ✓ OperatorEscrow余额不变
        // ✓ 运营者奖励累计增加
        // ✓ 事件：PinRequested
        // ✓ 事件：ChargeSuccess { layer: IpfsPool }
    });
}
```

##### 场景1.2：第2层扣费成功（公共池不足，用户账户充足）
```rust
#[test]
fn test_four_layer_charge_layer2_success() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - IpfsPoolAccount余额不足（1 DUST）
        // - SubjectFunding余额充足（100 DUST）
        // - OperatorEscrow余额充足（100 DUST）
        
        // 执行：
        // - 调用request_pin_for_deceased
        
        // 验证：
        // ✓ IpfsPoolAccount余额不变
        // ✓ SubjectFunding余额减少
        // ✓ 公共池余额增加（从用户账户转入）
        // ✓ 运营者奖励累计增加
        // ✓ 事件：ChargeSuccess { layer: SubjectFunding }
        // ✓ 事件：IpfsPoolLowBalanceWarning
    });
}
```

##### 场景1.3：第3层扣费成功（用户余额不足，运营者垫付）
```rust
#[test]
fn test_four_layer_charge_layer3_success() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - IpfsPoolAccount余额不足（1 DUST）
        // - SubjectFunding余额不足（1 DUST）
        // - OperatorEscrow余额充足（100 DUST）
        
        // 执行：
        // - 调用request_pin_for_deceased
        
        // 验证：
        // ✓ OperatorEscrow余额减少
        // ✓ 运营者奖励累计增加（返还垫付）
        // ✓ 事件：ChargeSuccess { layer: OperatorEscrow }
        // ✓ 事件：OperatorEscrowUsed { amount }
    });
}
```

##### 场景1.4：第4层宽限期（所有账户余额不足）
```rust
#[test]
fn test_four_layer_charge_enter_grace() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - 所有账户余额不足（各1 DUST）
        
        // 执行：
        // - 调用request_pin_for_deceased
        
        // 验证：
        // ✓ Pin请求成功创建
        // ✓ 进入宽限期状态
        // ✓ 事件：GracePeriodStarted { expires_at }
        // ✓ BillingQueue中记录正确
    });
}
```

---

### 2. 分层Pin配置测试（P0）

#### 测试目标
验证分层配置能够正确读取、应用默认值、动态更新。

##### 场景2.1：默认配置应用
```rust
#[test]
fn test_tier_config_defaults() {
    new_test_ext().execute_with(|| {
        // 验证：
        // ✓ Critical: 5副本, 7200块, 1.5x费率, 7天宽限期
        // ✓ Standard: 3副本, 28800块, 1.0x费率, 7天宽限期
        // ✓ Temporary: 1副本, 604800块, 0.5x费率, 3天宽限期
    });
}
```

##### 场景2.2：治理动态更新配置
```rust
#[test]
fn test_update_tier_config() {
    new_test_ext().execute_with(|| {
        // 执行：
        // - 调用update_tier_config修改Standard配置
        
        // 验证：
        // ✓ 配置更新成功
        // ✓ 后续Pin请求使用新配置
        // ✓ 事件：TierConfigUpdated
    });
}
```

##### 场景2.3：Pin请求应用层级配置
```rust
#[test]
fn test_pin_applies_tier_config() {
    new_test_ext().execute_with(|| {
        // 执行：
        // - 使用Critical层级Pin
        // - 使用Standard层级Pin
        // - 使用Temporary层级Pin
        
        // 验证：
        // ✓ 副本数正确（5, 3, 1）
        // ✓ 费用正确（1.5x, 1.0x, 0.5x）
        // ✓ 巡检周期正确
    });
}
```

---

### 3. on_finalize自动化测试（P0）

#### 测试目标
验证on_finalize能够自动执行周期扣费和健康巡检。

##### 场景3.1：自动周期扣费
```rust
#[test]
fn test_on_finalize_auto_billing() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - 创建Pin并充值
        // - 前进到扣费块高
        
        // 执行：
        // - 调用on_finalize
        
        // 验证：
        // ✓ 自动扣费成功
        // ✓ BillingQueue更新下次扣费时间
        // ✓ 运营者奖励增加
    });
}
```

##### 场景3.2：自动健康巡检
```rust
#[test]
fn test_on_finalize_auto_health_check() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - 创建Pin
        // - 前进到巡检块高
        
        // 执行：
        // - 调用on_finalize
        
        // 验证：
        // ✓ 健康巡检执行
        // ✓ HealthCheckQueue更新下次巡检时间
        // ✓ 事件：HealthCheckCompleted
    });
}
```

##### 场景3.3：限流保护（每块最多20扣费，10巡检）
```rust
#[test]
fn test_on_finalize_rate_limiting() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - 创建100个Pin，全部到期
        
        // 执行：
        // - 调用on_finalize
        
        // 验证：
        // ✓ 只处理20个扣费任务
        // ✓ 只处理10个巡检任务
        // ✓ 剩余任务等待下一块
    });
}
```

---

### 4. 健康巡检机制测试（P1）

##### 场景4.1：健康状态检测
```rust
#[test]
fn test_health_check_status() {
    new_test_ext().execute_with(|| {
        // 测试：
        // - Healthy: 副本数 >= 目标
        // - Degraded: 副本数 < 目标 但 >= 2
        // - Critical: 副本数 < 2
        // - Unknown: 巡检失败
    });
}
```

##### 场景4.2：动态巡检间隔
```rust
#[test]
fn test_dynamic_check_interval() {
    new_test_ext().execute_with(|| {
        // 验证：
        // ✓ Healthy → 24小时间隔
        // ✓ Degraded → 6小时间隔
        // ✓ Critical → 1小时间隔
    });
}
```

---

### 5. 治理接口测试（P1）

##### 场景5.1：update_tier_config权限验证
```rust
#[test]
fn test_update_tier_config_requires_root() {
    new_test_ext().execute_with(|| {
        // 验证：
        // ✓ Root可以调用
        // ✗ 普通用户不能调用
    });
}
```

##### 场景5.2：运营者领取奖励
```rust
#[test]
fn test_operator_claim_rewards() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - 运营者累计奖励100 DUST
        
        // 执行：
        // - 调用operator_claim_rewards
        
        // 验证：
        // ✓ 奖励转入运营者账户
        // ✓ OperatorRewards清零
        // ✓ 事件：RewardsClaimed
    });
}
```

##### 场景5.3：紧急暂停/恢复扣费
```rust
#[test]
fn test_emergency_pause_resume() {
    new_test_ext().execute_with(|| {
        // 执行：
        // - 调用emergency_pause_billing
        // - 尝试自动扣费
        // - 调用resume_billing
        
        // 验证：
        // ✓ 暂停期间不执行扣费
        // ✓ 恢复后正常扣费
    });
}
```

---

### 6. 宽限期机制测试（P1）

##### 场景6.1：宽限期内充值恢复
```rust
#[test]
fn test_grace_period_recovery() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - 进入宽限期
        
        // 执行：
        // - 充值SubjectFunding
        // - 前进到下次重试块高
        
        // 验证：
        // ✓ 扣费成功
        // ✓ 退出宽限期
        // ✓ 事件：GracePeriodExited
    });
}
```

##### 场景6.2：宽限期过期Unpin
```rust
#[test]
fn test_grace_period_expired_unpin() {
    new_test_ext().execute_with(|| {
        // 准备：
        // - 进入宽限期
        // - 前进7天（100800块）
        
        // 执行：
        // - 调用on_finalize
        
        // 验证：
        // ✓ 标记为Unpin
        // ✓ 事件：MarkedForUnpin { reason: InsufficientFunds }
    });
}
```

---

## 🔧 **测试环境准备**

### 1. 本地测试链启动

```bash
# 编译release版本
cd /home/xiaodong/文档/stardust
cargo build --release

# 启动本地开发链
./target/release/stardust-node --dev --tmp \
  --rpc-port 9944 \
  --rpc-cors all \
  --rpc-methods=Unsafe

# 清理链状态重新测试
./target/release/stardust-node purge-chain --dev -y
```

### 2. 单元测试执行

```bash
# 运行pallet-stardust-ipfs的所有测试
cargo test -p pallet-stardust-ipfs

# 运行特定测试
cargo test -p pallet-stardust-ipfs test_four_layer_charge

# 显示测试输出
cargo test -p pallet-stardust-ipfs -- --nocapture

# 并行运行测试
cargo test -p pallet-stardust-ipfs -- --test-threads=4
```

### 3. 集成测试执行

```bash
# 运行runtime集成测试
cargo test -p stardust-runtime

# 运行特定集成测试
cargo test -p stardust-runtime test_pin_integration
```

---

## 📊 **测试数据准备**

### 测试账户

```rust
// 账户角色定义
pub const ALICE: AccountId = AccountId32::new([1u8; 32]);      // 治理账户
pub const BOB: AccountId = AccountId32::new([2u8; 32]);        // 用户账户
pub const CHARLIE: AccountId = AccountId32::new([3u8; 32]);    // 运营者1
pub const DAVE: AccountId = AccountId32::new([4u8; 32]);       // 运营者2
pub const EVE: AccountId = AccountId32::new([5u8; 32]);        // 运营者3

// 初始余额
pub const INITIAL_BALANCE: u128 = 1_000_000 * UNIT;
```

### 测试数据

```rust
// CID示例
pub const TEST_CID_1: &[u8] = b"QmTest1234567890abcdefghijklmn";
pub const TEST_CID_2: &[u8] = b"QmTest2234567890abcdefghijklmn";

// 费用配置
pub const DEFAULT_STORAGE_PRICE: u128 = 100 * UNIT;
pub const DEFAULT_BILLING_PERIOD: u32 = 100_800; // 7天
```

---

## ✅ **测试覆盖率目标**

| 模块 | 目标覆盖率 | 当前 | 状态 |
|------|-----------|------|------|
| 四层扣费机制 | 95% | 0% | ⏳ |
| 分层配置 | 90% | 0% | ⏳ |
| on_finalize自动化 | 85% | 0% | ⏳ |
| 健康巡检 | 80% | 0% | ⏳ |
| 治理接口 | 90% | 0% | ⏳ |
| **总体目标** | **≥85%** | **0%** | ⏳ |

---

## 📅 **测试执行计划**

### Day 1（2-3小时）

| 时间 | 任务 | 负责人 |
|------|------|--------|
| 09:00-10:00 | 搭建测试环境 | 后端团队 |
| 10:00-11:30 | P0测试用例编写 | 后端团队 |
| 11:30-12:00 | P0测试执行 | 后端团队 |
| 13:00-14:30 | P1测试用例编写 | 后端团队 |
| 14:30-15:30 | P1测试执行 | 后端团队 |
| 15:30-16:00 | 测试报告编写 | 后端团队 |

---

## 🐛 **已知问题追踪**

| ID | 问题描述 | 严重性 | 状态 |
|----|---------|--------|------|
| - | - | - | - |

---

## 📈 **测试指标**

### 性能指标

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| on_finalize执行时间 | <100ms | - | ⏳ |
| 单个Pin请求处理时间 | <50ms | - | ⏳ |
| 单块最大扣费任务 | 20个 | - | ⏳ |
| 单块最大巡检任务 | 10个 | - | ⏳ |

### 可靠性指标

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| 四层扣费成功率 | >99% | - | ⏳ |
| 宽限期恢复率 | >95% | - | ⏳ |
| 健康巡检成功率 | >98% | - | ⏳ |

---

## 🚀 **下一步**

1. ✅ 创建集成测试计划（本文档）
2. ⏳ 实现P0测试用例
3. ⏳ 执行P0测试
4. ⏳ 实现P1测试用例
5. ⏳ 执行P1测试
6. ⏳ 编写测试报告

**预计完成时间**：2-3小时

---

**文档创建时间**：2025-10-26  
**维护者**：Stardust开发团队

