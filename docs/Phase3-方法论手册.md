# Phase 3 方法论手册

## 📖 手册说明

本手册沉淀了Phase 3（5周，164个测试）的完整方法论，供后续开发参考。

**适用场景**:
- Substrate/FRAME单元测试编写
- 测试修复与调试
- Mock runtime设计
- 代码质量提升

---

## 🎯 测试修复标准流程

### 流程图

```
开始
  ↓
1. 快速诊断（5-10分钟）
  ├─ 编译错误？ → trait bounds、类型检查
  ├─ 运行时错误？ → panic、断言
  └─ 业务逻辑错误？ → 预期vs实际
  ↓
2. 分类处理（10-30分钟）
  ├─ 共性问题？ → 批量修复
  ├─ 特殊case？ → 单独处理
  └─ 超复杂？ → 标记待后续
  ↓
3. 渐进验证（5-10分钟）
  ├─ 单个测试通过
  ├─ 不破坏已通过测试
  └─ 全面回归
  ↓
4. 文档同步（10-15分钟）
  ├─ 更新快速开始
  ├─ 记录完成报告
  └─ 决策总结
  ↓
结束
```

### 1. 快速诊断（Diagnosis）

#### 编译错误诊断

**常见错误类型**:

| 错误信息 | 可能原因 | 诊断命令 |
|---------|---------|---------|
| `trait bounds not satisfied` | 泛型约束缺失 | 查看Error上下文 |
| `type mismatch` | 类型不匹配 | 检查函数签名 |
| `cannot find ... in this scope` | 导入缺失 | 检查use语句 |
| `missing field` | struct字段缺失 | 查看struct定义 |

**诊断步骤**:
```bash
# 1. 查看完整编译错误
cargo build -p pallet-xxx 2>&1 | grep -A 10 "error\["

# 2. 定位错误位置
cargo build -p pallet-xxx 2>&1 | grep "error\[" | head -5

# 3. 查看具体代码
grep -n "问题关键字" pallets/xxx/src/tests.rs
```

#### 运行时错误诊断

**常见错误类型**:

| Panic信息 | 可能原因 | 诊断方法 |
|-----------|---------|---------|
| `assertion failed` | 断言不匹配 | 查看断言条件 |
| `called unwrap() on Err` | Result为Err | 添加?或match |
| `index out of bounds` | 数组越界 | 检查索引范围 |
| `Balance::InsufficientBalance` | 余额不足 | 检查初始余额 |

**诊断步骤**:
```bash
# 1. 运行单个测试查看panic
cargo test -p pallet-xxx --lib test_name -- --nocapture

# 2. 查看panic位置
cargo test -p pallet-xxx --lib test_name 2>&1 | grep "panicked at"

# 3. 添加调试信息
# 在代码中添加 println!("DEBUG: var={:?}", var);
```

#### 业务逻辑错误诊断

**常见场景**:

| 症状 | 可能原因 | 诊断方法 |
|------|---------|---------|
| 预期成功但失败 | 前置条件不满足 | 检查ensure! |
| 预期失败但成功 | 缺少检查逻辑 | 检查Error定义 |
| 存储数据不对 | 写入逻辑错误 | 添加存储查询 |
| Event未触发 | block_number未设置 | System::set_block_number(1) |

**诊断步骤**:
```bash
# 1. 添加详细日志
println!("Before: storage={:?}", Storage::get(key));
// ... 操作 ...
println!("After: storage={:?}", Storage::get(key));

# 2. 查看Event
println!("Events: {:?}", System::events());

# 3. 逐步验证
assert_ok!(step1());
assert_ok!(step2());
assert_ok!(step3());
```

---

### 2. 分类处理（Classification）

#### 批量修复（共性问题）

**识别共性问题的标志**:
- 多个测试报相同错误
- 错误模式一致（如都是BadStatus）
- 涉及相同代码路径

**批量修复示例**:

**问题**: Week 4 Day 2，6个测试都报`BadStatus`错误

**根因分析**:
```rust
// Mock中owner_of返回deceased_id本身
impl OwnerProvider<u64> for OwnerProvider {
    fn owner_of(id: u64) -> Option<u64> {
        Some(id) // 返回100
    }
}

// 测试中
let caller = 1;
let deceased_id = 100;
// pallet中检查
ensure!(owner == who, Error::<T>::BadStatus); // 100 != 1，失败
```

**批量修复**:
```bash
# 统一修改deceased_id为1
sed -i 's/deceased_id: u64 = 100/deceased_id: u64 = 1/g' pallets/stardust-ipfs/src/tests.rs
```

**验证**:
```bash
cargo test -p pallet-stardust-ipfs --lib pin_ 2>&1 | grep "test result"
# 预期：10 passed
```

#### 单独处理（特殊case）

**何时单独处理**:
- 问题仅出现在1-2个测试中
- 错误原因独特
- 需要深入分析

**单独处理示例**:

**问题**: Week 4 Day 2，`pin_for_deceased_works`的replicas断言失败

**深入分析**:
```rust
// 错误解构
let (_op_id, stored_size, stored_replicas, stored_price) = PinMeta::get(cid).unwrap();
// ❌ 假设：(_op_id, size, replicas, price)

// 实际结构（查看lib.rs定义）
pub type PinMeta<T> = StorageMap<..., (u32, u64, BlockNumber, BlockNumber), ...>;
// ✅ 实际：(replicas, size, created_at, last_activity)
```

**单独修复**:
```rust
// 修正解构顺序
let (stored_replicas, stored_size, _created_at, _last_activity) = PinMeta::get(cid).unwrap();
```

#### 标记待后续（复杂问题）

**何时标记**:
- 修复时间超过4小时
- 涉及多个pallet依赖
- 需要架构调整

**标记方式**:
```rust
#[test]
#[ignore] // TODO: Week X - 需要mm_id注册流程，待pallet稳定后补充
fn complex_test_case() {
    // ...
}
```

---

### 3. 渐进验证（Verification）

#### 单个测试验证

```bash
# 运行单个测试
cargo test -p pallet-xxx --lib test_name

# 运行单个测试（详细输出）
cargo test -p pallet-xxx --lib test_name -- --nocapture

# 运行单个测试（显示所有输出）
cargo test -p pallet-xxx --lib test_name -- --nocapture --show-output
```

#### 批量测试验证

```bash
# 运行某个模式的测试
cargo test -p pallet-xxx --lib pin_

# 运行所有测试
cargo test -p pallet-xxx --lib

# 运行多个pallet测试
for pallet in stardust-park deceased stardust-ipfs; do
    cargo test -p pallet-$pallet --lib 2>&1 | grep "test result"
done
```

#### 全面回归验证

```bash
# Phase 3全量测试
cargo test --workspace --lib 2>&1 | grep "test result"

# 统计总测试数
cargo test --workspace --lib 2>&1 | grep "passed" | awk '{sum+=$4} END {print sum}'
```

---

### 4. 文档同步（Documentation）

#### 快速开始指南模板

```markdown
# Phase X Week Y Day Z 快速开始

## 任务目标
**修复pallet-xxx的N个失败测试**

## 当前状态
- 通过: M个
- 失败: N个
- 覆盖率: X%

## 执行策略
1. 快速诊断
2. 分类处理
3. 渐进验证
4. 文档同步

## 执行中...
```

#### 完成报告模板

```markdown
# Phase X Week Y Day Z 完成报告

## 核心成果
1. ✅ 修复了N个测试
2. ✅ 发现了M个问题
3. ✅ 提出了X个优化

## 修复详情
### 问题1: xxx
**根因**: ...
**修复**: ...

## 关键发现
1. ...
2. ...

## 下一步行动
1. ...
```

---

## 🛠️ Mock Runtime设计指南

### Mock设计模式

#### 标准Mock结构

```rust
use frame_support::{
    parameter_types,
    traits::Everything,
};
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

// 构建runtime
frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Balances: pallet_balances,
        YourPallet: pallet_your_pallet,
    }
);

// System配置
impl frame_system::Config for Test {
    type BaseCallFilter = Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = ConstU64<250>;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<u128>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ConstU16<42>;
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
    // Frame v28+ required
    type RuntimeTask = ();
    type ExtensionsWeightInfo = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
}

// Balances配置
impl pallet_balances::Config for Test {
    type MaxLocks = ConstU32<50>;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    type Balance = u128;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ConstU128<1>;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ();
    type RuntimeHoldReason = ();
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

// YourPallet配置
impl Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    // ... 其他配置 ...
}

// 创建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 10_000_000_000_000_000u128), // 10000 DUST
            (2, 1_000_000_000_000u128),      // 1 DUST
        ],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();
    
    t.into()
}
```

### Mock设计最佳实践

#### 1. 账户余额初始化

**原则**: 确保足够余额支付各种操作

```rust
pallet_balances::GenesisConfig::<Test> {
    balances: vec![
        // 测试账户
        (1, 10_000_000_000_000_000u128), // 10000 DUST - 主测试账户
        (2, 1_000_000_000_000u128),      // 1 DUST - 次要账户
        
        // 系统账户
        (100, 10_000_000_000_000_000u128), // Treasury
        
        // 边界测试账户
        (999, 1_000_000_000u128), // 接近existential_deposit
    ],
    dev_accounts: None,
}
```

**考虑因素**:
- existential_deposit: 最小余额要求
- 操作成本: 转账、存储等成本
- 边界测试: 测试余额不足场景

#### 2. 派生账户处理

**问题**: 派生账户不在GenesisConfig中

**解决方案**: 测试中显式充值

```rust
#[test]
fn test_with_derived_account() {
    new_test_ext().execute_with(|| {
        // 给派生账户充值
        let derived = YourPallet::derive_account(1);
        let _ = Balances::deposit_creating(&derived, 1_000_000_000_000_000);
        
        // 执行测试
        assert_ok!(YourPallet::some_function(...));
    });
}
```

#### 3. OwnerProvider一致性

**问题**: owner_of返回值与caller不匹配

**解决方案**: Mock返回匹配值

```rust
pub struct OwnerProvider;
impl OwnerProvider<u64> for OwnerProvider {
    fn owner_of(id: u64) -> Option<u64> {
        // 简单策略：返回id本身
        Some(id)
        
        // 或使用HashMap存储所有权关系
        // OWNERSHIP.with(|m| m.borrow().get(&id).cloned())
    }
}
```

#### 4. 事件记录启用

**问题**: 测试中Event未触发

**解决方案**: 设置block_number

```rust
#[test]
fn test_with_events() {
    new_test_ext().execute_with(|| {
        // 必须设置block_number才能记录events
        System::set_block_number(1);
        
        assert_ok!(YourPallet::some_function(...));
        
        // 验证Event
        System::assert_has_event(
            Event::SomethingHappened { ... }.into()
        );
    });
}
```

---

## 🔍 常见错误类型及解决方案

### 1. Trait Bounds错误

**错误信息**:
```
error[E0277]: the trait bound `SomeType: SomeTrait` is not satisfied
```

**常见原因**:
1. 缺少trait bound
2. 类型参数约束不足
3. codec derive缺失

**解决方案**:

```rust
// 问题1: 缺少trait bound
// ❌ 错误
pub struct MyStruct<T> {
    value: T,
}

// ✅ 修复
pub struct MyStruct<T: Clone + Debug> {
    value: T,
}

// 问题2: codec derive缺失
// ❌ 错误
pub struct MyStruct {
    value: u32,
}

// ✅ 修复
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct MyStruct {
    value: u32,
}

// 问题3: 复杂泛型的codec bound
// ❌ 错误（自动derive可能失败）
#[derive(Encode, Decode)]
pub struct Complex<T, U> {
    data: Vec<(T, U)>,
}

// ✅ 修复（显式指定bound）
#[derive(Encode, Decode)]
#[codec(mel_bound())] // 放宽MaxEncodedLen约束
pub struct Complex<T, U> {
    data: Vec<(T, U)>,
}
```

### 2. Balance::InsufficientBalance

**错误信息**:
```
Module(ModuleError { index: 2, error: [3, 0, 0, 0], message: Some("InsufficientBalance") })
```

**常见原因**:
1. 初始余额不足
2. existential_deposit考虑不足
3. 派生账户未充值

**解决方案**:

```rust
// 方案1: 增加初始余额
pallet_balances::GenesisConfig::<Test> {
    balances: vec![
        (1, 10_000_000_000_000_000u128), // 从1000增加到10000
    ],
    dev_accounts: None,
}

// 方案2: 测试中充值
#[test]
fn test_with_more_balance() {
    new_test_ext().execute_with(|| {
        let _ = Balances::deposit_creating(&1, 10_000_000_000_000_000);
        // ...
    });
}

// 方案3: 派生账户充值
let derived = Pallet::derive_account(1);
let _ = Balances::deposit_creating(&derived, 1_000_000_000_000_000);
```

### 3. BadStatus错误

**错误信息**:
```
Module(ModuleError { index: X, error: [Y, 0, 0, 0], message: Some("BadStatus") })
```

**常见原因**:
1. 权限检查失败（owner != caller）
2. 状态检查失败（状态不对）
3. 前置条件不满足

**解决方案**:

```rust
// 问题1: owner != caller
// ❌ Mock返回不匹配
impl OwnerProvider<u64> for OwnerProvider {
    fn owner_of(id: u64) -> Option<u64> {
        Some(100) // caller是1，owner是100，不匹配
    }
}

// ✅ 修复
impl OwnerProvider<u64> for OwnerProvider {
    fn owner_of(id: u64) -> Option<u64> {
        Some(id) // owner与id一致
    }
}

// 测试中
let caller = 1;
let id = 1; // 确保id与caller匹配
```

### 4. 断言失败

**错误信息**:
```
assertion `left == right` failed
  left: 1
 right: 3
```

**常见原因**:
1. 预期值错误
2. 计算逻辑错误
3. 存储结构理解错误

**解决方案**:

```rust
// 问题: 存储结构理解错误
// ❌ 错误理解
let (_op_id, size, replicas, price) = Storage::get(key).unwrap();
// 假设是4元组

// ✅ 查看定义
pub type Storage<T> = StorageMap<..., (u32, u64, BlockNumber, BlockNumber), ...>;
// 实际是(replicas, size, created_at, last_activity)

// ✅ 正确解构
let (replicas, size, _created, _last) = Storage::get(key).unwrap();
```

---

## 📝 代码质量提升Checklist

### 提交前自检清单

- [ ] **所有测试通过**
  ```bash
  cargo test -p pallet-xxx --lib
  ```

- [ ] **无编译警告**
  ```bash
  cargo build -p pallet-xxx 2>&1 | grep "warning"
  ```

- [ ] **函数级中文注释**
  ```rust
  /// 函数级中文注释：这个函数做什么
  /// - 参数说明
  /// - 返回值说明
  /// - 错误情况
  pub fn some_function() { }
  ```

- [ ] **Error定义完整**
  ```rust
  #[pallet::error]
  pub enum Error<T> {
      /// 函数级中文注释：具体错误描述
      SpecificError,
  }
  ```

- [ ] **重复检查**
  ```rust
  // 关键操作前检查
  ensure!(!Storage::contains_key(&key), Error::<T>::AlreadyExists);
  ```

- [ ] **边界case处理**
  ```rust
  // 数量边界
  ensure!(replicas >= 1 && replicas <= u32::MAX, Error::<T>::InvalidReplicas);
  
  // 余额边界
  ensure!(amount >= min && amount <= max, Error::<T>::InvalidAmount);
  ```

- [ ] **存储清理**
  ```rust
  // 删除时清理所有相关存储
  Storage1::remove(&key);
  Storage2::remove(&key);
  Storage3::mutate(&key, |v| v.clear());
  ```

### 代码审查重点

1. **类型安全**
   - 使用newtype避免类型混淆
   - 泛型约束完整
   - 避免unwrap，使用?

2. **资源管理**
   - 余额转移用transfer而非deposit+withdraw
   - 存储大小有界（BoundedVec）
   - 及时清理无用存储

3. **错误处理**
   - 所有Error有描述性名称
   - ensure!优于if+return Err
   - 错误信息包含上下文

4. **测试覆盖**
   - 正常路径
   - 错误路径
   - 边界case
   - 权限检查

---

## 🎓 进阶技巧

### 1. 使用feature控制复杂测试

```rust
#[cfg(feature = "extensive-tests")]
mod extensive_tests {
    use super::*;
    
    #[test]
    fn complex_boundary_test() {
        // 复杂的边界测试
    }
}
```

```toml
# Cargo.toml
[features]
extensive-tests = []
```

```bash
# 运行扩展测试
cargo test --features extensive-tests
```

### 2. 使用macro减少重复

```rust
macro_rules! test_error_case {
    ($test_name:ident, $error:expr, $setup:expr) => {
        #[test]
        fn $test_name() {
            new_test_ext().execute_with(|| {
                $setup;
                assert_noop!(
                    YourPallet::some_function(...),
                    $error
                );
            });
        }
    };
}

test_error_case!(
    insufficient_balance_fails,
    Error::<Test>::InsufficientBalance,
    Balances::set_balance(&1, 0)
);
```

### 3. 使用helper函数

```rust
// 通用helper
fn setup_account(id: u64, balance: u128) {
    let _ = Balances::deposit_creating(&id, balance);
}

fn assert_event_emitted(event: Event<Test>) {
    System::assert_has_event(event.into());
}

// 业务helper
fn create_test_park() -> u64 {
    assert_ok!(Park::create(...));
    1 // park_id
}
```

---

## 📚 参考资源

### Substrate官方文档
- [Testing](https://docs.substrate.io/test/)
- [Mock Runtime](https://docs.substrate.io/test/unit-testing/)
- [FRAME Macros](https://paritytech.github.io/substrate/master/frame_support/attr.pallet.html)

### 本项目文档
- `Phase3-完整总结.md` - 整体回顾
- `Phase3-Week4-Day*-完成报告.md` - 具体案例
- `Phase3-100%覆盖达成里程碑.md` - 最终成果

### 工具推荐
- `cargo-nextest` - 更快的测试运行器
- `cargo-watch` - 自动重新运行测试
- `ripgrep` - 快速代码搜索

---

## 🎯 方法论应用示例

### 场景1: 新增pallet

```bash
# 1. 创建pallet骨架
# 2. 编写核心逻辑
# 3. 创建tests.rs

# 4. 运行测试（预期失败）
cargo test -p pallet-new --lib

# 5. 按本手册流程修复
# - 快速诊断
# - 分类处理
# - 渐进验证
# - 文档同步

# 6. 达成100%覆盖
cargo test -p pallet-new --lib
# test result: ok. N passed; 0 failed; 0 ignored
```

### 场景2: 修复failing tests

```bash
# 1. 列出所有failing tests
cargo test -p pallet-xxx --lib 2>&1 | grep FAILED

# 2. 逐个诊断
cargo test -p pallet-xxx --lib test_name -- --nocapture

# 3. 识别共性问题
# - 如果多个测试报同样错误 → 批量修复
# - 如果每个测试错误不同 → 逐个修复

# 4. 修复验证
cargo test -p pallet-xxx --lib

# 5. 文档记录
# 创建快速开始、完成报告
```

### 场景3: 重构已有代码

```bash
# 1. 确保所有测试通过
cargo test -p pallet-xxx --lib
# test result: ok. N passed

# 2. 执行重构
# - Tuple → Struct
# - 函数拆分
# - 优化逻辑

# 3. 持续验证
cargo watch -x "test -p pallet-xxx --lib"

# 4. 重构完成验证
cargo test -p pallet-xxx --lib
# test result: ok. N passed (应与重构前一致)
```

---

## 📈 持续改进

### 方法论迭代

本手册基于Phase 3（164个测试）总结而成，后续应持续迭代：

1. **Phase 4集成测试** - 补充跨pallet测试方法
2. **Phase 5压力测试** - 补充性能测试方法
3. **实际问题反馈** - 收集新的错误类型及解决方案

### 贡献指南

如果你发现：
- 新的错误类型
- 更好的解决方案
- 方法论改进建议

请：
1. 记录到对应Week的文档
2. 更新本手册
3. 分享给团队

---

**方法论手册版本**: v1.0  
**基于**: Phase 3（Week 1-5，164测试）  
**更新日期**: 2025-10-25  
**适用范围**: Substrate/FRAME单元测试  

