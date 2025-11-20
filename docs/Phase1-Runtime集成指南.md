# pallet-deposits Runtime集成指南

## ✅ 已完成

### 1. Cargo.toml配置 ✅

**文件**：`runtime/Cargo.toml`

**已添加依赖**：
```toml
# Line 60
pallet-deposits = { path = "../pallets/deposits", default-features = false }
```

**已添加std feature**：
```toml
# Line 136
"pallet-deposits/std",
```

---

## 📝 待完成（需要手动操作）

### 2. Runtime lib.rs配置

**文件**：`runtime/src/lib.rs`

#### Step 1: 添加pallet配置

在`runtime/src/lib.rs`或`runtime/src/configs/mod.rs`中添加：

```rust
/// pallet-deposits配置
impl pallet_deposits::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type ReleaseOrigin = EnsureRoot<AccountId>;  // 或使用委员会
    type SlashOrigin = EnsureRoot<AccountId>;    // 或使用委员会
    type MaxDepositsPerAccount = ConstU32<100>;
}
```

**配置说明**：

| 参数 | 推荐值 | 说明 |
|-----|--------|------|
| RuntimeEvent | RuntimeEvent | 标准配置 |
| Currency | Balances | 使用MEMO余额 |
| ReleaseOrigin | EnsureRoot | 释放押金权限（Root或委员会） |
| SlashOrigin | EnsureRoot | 罚没押金权限（Root或委员会） |
| MaxDepositsPerAccount | 100 | 每账户最多100个押金 |

**可选：使用委员会权限**

```rust
// 如果想让委员会管理押金（2/3多数）
type ReleaseOrigin = pallet_collective::EnsureProportionAtLeast<
    AccountId,
    pallet_collective::Instance3,
    2,
    3,
>;
```

#### Step 2: 添加到construct_runtime!

在`construct_runtime!`宏中添加：

```rust
construct_runtime!(
    pub enum Runtime {
        // ... 现有pallet ...
        
        // 在合适的位置添加（建议在Pricing之后）
        Deposits: pallet_deposits,
        
        // ... 其他pallet ...
    }
);
```

**建议位置**：在Pricing pallet之后，StorageTreasury之前

```rust
// 参考位置
Pricing: pallet_pricing,
Deposits: pallet_deposits,  // ← 这里
StorageTreasury: pallet_storage_treasury,
```

---

## 🧪 验证步骤

### Step 1: 编译检查

```bash
cd /home/xiaodong/文档/stardust
cargo check --release
```

**预期结果**：编译通过，无错误

### Step 2: 运行测试

```bash
# 测试pallet-deposits
cargo test -p pallet-deposits

# 测试runtime
cargo test -p stardust-runtime
```

**预期结果**：所有测试通过

### Step 3: 启动测试链

```bash
cargo build --release
./target/release/node-template --dev --tmp
```

**预期结果**：
- 节点正常启动
- 可以看到Deposits pallet在runtime中

### Step 4: 前端验证（PolkadotJS Apps）

1. 访问：https://polkadot.js.org/apps/
2. 连接到本地节点：ws://127.0.0.1:9944
3. 检查：Developer → Extrinsics → deposits
4. 应该看到：
   - reserveDeposit
   - releaseDeposit
   - slashDeposit

---

## 📋 集成检查清单

### 配置文件

- [x] runtime/Cargo.toml - 添加依赖
- [x] runtime/Cargo.toml - 添加std feature
- [ ] runtime/src/lib.rs - 实现Config trait
- [ ] runtime/src/lib.rs - 添加到construct_runtime!

### 编译验证

- [ ] cargo check通过
- [ ] cargo test通过（deposits）
- [ ] cargo test通过（runtime）
- [ ] cargo build --release成功

### 功能验证

- [ ] 测试链启动成功
- [ ] PolkadotJS能看到deposits extrinsics
- [ ] 可以调用reserveDeposit
- [ ] 可以查询deposits存储

---

## 🚨 常见问题

### 问题1：编译错误 - 找不到pallet_deposits

**原因**：没有在workspace Cargo.toml中添加

**解决**：
```toml
# 项目根目录Cargo.toml
[workspace]
members = [
    # ...
    "pallets/deposits",  # ← 确保这行存在
]
```

### 问题2：ReleaseOrigin类型错误

**原因**：Origin类型不匹配

**解决**：
```rust
// 确保使用正确的AccountId类型
type ReleaseOrigin = EnsureRoot<AccountId>;  // ✅
// 而不是
type ReleaseOrigin = EnsureRoot<u64>;  // ❌
```

### 问题3：construct_runtime重复定义

**原因**：Deposits名称已被使用

**解决**：
```rust
// 使用不同的名称
PalletDeposits: pallet_deposits,  // 或
MemDeposits: pallet_deposits,     // 或其他名称
```

---

## 📝 下一步

完成Runtime集成后：

1. ✅ 验证编译通过
2. ✅ 运行单元测试
3. ✅ 启动测试链
4. ✅ 前端测试功能
5. 🔄 开始Phase 1 Week 2任务
   - 实现动态定价策略
   - 集成pallet-pricing
   - Benchmarking

---

## 💡 提示

### 权限配置建议

**开发环境**：
```rust
type ReleaseOrigin = EnsureRoot<AccountId>;
type SlashOrigin = EnsureRoot<AccountId>;
```

**生产环境**：
```rust
// 使用委员会，需要2/3多数
type ReleaseOrigin = pallet_collective::EnsureProportionAtLeast<
    AccountId,
    pallet_collective::Instance3,  // 内容委员会
    2,
    3,
>;

type SlashOrigin = pallet_collective::EnsureProportionAtLeast<
    AccountId,
    pallet_collective::Instance3,
    2,
    3,
>;
```

### 参数调优建议

**MaxDepositsPerAccount**：
- 默认：100
- 小项目：50
- 大项目：200
- 企业级：500

根据实际使用情况调整。

---

**完成时间预估**：30-60分钟  
**难度**：⭐⭐（中等）

---

*更新时间：2025-10-25*

