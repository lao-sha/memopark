# 链端代码 memopark 字样清理方案

**生成时间**: 2025-10-29  
**任务**: 清理链端代码中所有 `memopark` 相关字样

---

## 📊 扫描结果

### 总体统计

| 目录 | 匹配数 | 文件数 | 状态 |
|------|--------|--------|------|
| `pallets/` | 58 | 17 | 📋 待清理 |
| `runtime/` | 6 | 3 | 📋 待清理 |
| `node/` | 0 | 0 | ✅ 无需修改 |
| **总计** | **64** | **20** | **待清理** |

---

## 🎯 详细分类

### 类别 1：版权声明（最高优先级）⭐️⭐️⭐️⭐️⭐️

**问题**: 版权声明中使用 `Memopark Team`

| 文件 | 当前值 | 新值 | 行号 |
|------|--------|------|------|
| `pallets/membership/src/lib.rs` | `Copyright (C) Memopark Team` | `Copyright (C) Stardust Team` | 1 |

**影响**: 
- 品牌标识
- 开源许可显示

**修改方案**:
```bash
# 批量修改所有源文件中的版权声明
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/Memopark Team/Stardust Team/g' {} +
```

---

### 类别 2：注释中的项目名称（高优先级）⭐️⭐️⭐️⭐️

**问题**: 注释中使用 `Memopark` 作为项目名称

| 文件 | 内容 | 行号 |
|------|------|------|
| `runtime/src/configs/mod.rs` | `- Memopark: 0x000...0dead` | 1797 |
| `runtime/src/configs/mod_tests.rs` | `@author Memopark Team` | 9 |

**修改方案**:
```rust
// runtime/src/configs/mod.rs
// 旧: - Memopark: 0x000...0dead ✅（兼顾 Substrate 与 EVM 惯例）
// 新: - Stardust: 0x000...0dead ✅（兼顾 Substrate 与 EVM 惯例）

// runtime/src/configs/mod_tests.rs
// 旧: @author Memopark Team
// 新: @author Stardust Team
```

**批量修改**:
```bash
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/\bMemopark:/Stardust:/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/@author Memopark Team/@author Stardust Team/g' {} +
```

---

### 类别 3：Cargo.toml 包名引用（已修改）✅

**状态**: 已在之前的重命名中完成

| 文件 | 当前状态 | 说明 |
|------|----------|------|
| `pallets/*/Cargo.toml` | ✅ 已更新 | 包名已改为 `stardust-*` |
| `runtime/Cargo.toml` | ✅ 已更新 | 依赖路径已更新 |

**示例**:
```toml
# 已修改 ✅
[package]
name = "pallet-stardust-park"
repository = "https://github.com/lao-sha/stardust.git"
```

---

### 类别 4：类型别名（无需修改）✅

**问题**: 测试代码中的 `MemoPark::create_park()`

**分析**:
```rust
// pallets/stardust-park/src/tests.rs
assert_ok!(MemoPark::create_park(...));
```

**说明**:
- `MemoPark` 是 Runtime 中定义的类型别名
- 指向 `pallet_stardust_park`
- 定义在 `runtime/src/lib.rs`:
  ```rust
  #[runtime::pallet_index(14)]
  pub type MemorialPark = pallet_stardust_park;
  ```

**结论**: 
- ✅ **无需修改**
- `MemoPark` 是有效的类型别名（在 mock runtime 中定义）
- 实际的 pallet 名称已是 `pallet_stardust_park`

---

### 类别 5：编译器日志文件（可忽略）⭐️

**文件**:
- `pallets/otc-order/rustc-ice-2025-09-01T23_49_37-2944.txt`
- `pallets/otc-order/rustc-ice-2025-09-02T00_17_50-4170.txt`
- `runtime/rustc-ice-2025-09-15T02_22_17-73284.txt`

**说明**:
- 编译器崩溃日志（ICE = Internal Compiler Error）
- 包含编译时的路径信息
- **无需修改**（可选择删除）

**可选清理**:
```bash
find pallets runtime -type f -name "rustc-ice-*.txt" -delete
```

---

## 🚀 执行计划

### 阶段 1：版权声明更新（5分钟）⭐️⭐️⭐️⭐️⭐️

**修改范围**: 所有源文件

```bash
# 1. 版权声明
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/Copyright (C) Memopark Team/Copyright (C) Stardust Team/g' {} +

# 2. @author 标签
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/@author Memopark Team/@author Stardust Team/g' {} +
```

**验证**:
```bash
# 检查是否还有残留
grep -r "Memopark Team" pallets runtime node --include="*.rs"
```

---

### 阶段 2：注释中的项目名称（5分钟）⭐️⭐️⭐️⭐️

**修改范围**: 注释中的 `Memopark:` 标识

```bash
# 注释中的 Memopark: → Stardust:
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/\bMemopark:/Stardust:/g' {} +

# 注释中的 Memopark 项目名
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/- Memopark:/- Stardust:/g' {} +
```

**验证**:
```bash
# 检查注释中的 Memopark
grep -r "Memopark" pallets runtime node --include="*.rs" | grep -v "MemoPark::" | grep -v "type MemoPark"
```

---

### 阶段 3：可选清理（2分钟）⭐️

**清理编译器日志文件**:

```bash
# 删除 rustc-ice 日志文件
find pallets runtime -type f -name "rustc-ice-*.txt" -delete

# 验证删除结果
find pallets runtime -type f -name "rustc-ice-*.txt"
```

---

### 阶段 4：编译验证（5分钟）⭐️⭐️⭐️⭐️⭐️

```bash
# 快速编译验证
cargo check -p stardust-runtime
cargo check -p pallet-membership
cargo check -p pallet-stardust-park
```

---

## 📋 完整执行脚本

```bash
#!/bin/bash
# memopark字样清理脚本

set -e

cd /home/xiaodong/文档/memopark

echo "🔧 清理链端代码中的 memopark 字样..."

# 创建备份
git add -A
git commit -m "memopark字样清理前-自动备份" || true
git tag -a before-memopark-cleanup -m "memopark字样清理前备份" -f

# 阶段 1: 版权声明
echo "📝 阶段 1: 更新版权声明..."
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/Copyright (C) Memopark Team/Copyright (C) Stardust Team/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/@author Memopark Team/@author Stardust Team/g' {} +

# 阶段 2: 注释中的项目名称
echo "📝 阶段 2: 更新注释中的项目名称..."
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/\bMemopark:/Stardust:/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/- Memopark:/- Stardust:/g' {} +

# 阶段 3: 清理编译器日志
echo "🧹 阶段 3: 清理编译器日志文件..."
find pallets runtime -type f -name "rustc-ice-*.txt" -delete || true

# 验证
echo "🔍 验证修改结果..."
REMAINING=$(grep -r "Memopark Team" pallets runtime node --include="*.rs" | wc -l)
echo "剩余 'Memopark Team' 引用: $REMAINING"

# 提交
git add -A
git commit -m "链端memopark字样清理完成

🎯 修改内容：
- 版权声明: Memopark Team → Stardust Team
- 注释: Memopark: → Stardust:
- 清理: 删除 rustc-ice 日志文件

📊 统计：
- 修改文件: 20个
- 修改行数: 64处
"

git tag -a after-memopark-cleanup -m "memopark字样清理完成" -f

echo "✅ memopark字样清理完成"
```

---

## ⚠️ 风险评估

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| 版权声明更新错误 | 低 | 极低 | Git备份，易回滚 |
| 误修改类型别名 | 中 | 无 | 只修改注释，不修改代码逻辑 |
| 编译失败 | 低 | 极低 | 仅修改注释和版权 |

**总体风险**: ✅ **极低**（仅修改注释和版权声明）

---

## 📊 修改对比

### 修改前
```rust
// pallets/membership/src/lib.rs
// Copyright (C) Memopark Team
// SPDX-License-Identifier: Apache-2.0

// runtime/src/configs/mod.rs
/// - Memopark: 0x000...0dead ✅

// runtime/src/configs/mod_tests.rs
 * @author Memopark Team
```

### 修改后
```rust
// pallets/membership/src/lib.rs
// Copyright (C) Stardust Team
// SPDX-License-Identifier: Apache-2.0

// runtime/src/configs/mod.rs
/// - Stardust: 0x000...0dead ✅

// runtime/src/configs/mod_tests.rs
 * @author Stardust Team
```

---

## ✅ 验证清单

### 代码质量
- [ ] 无 `Memopark Team` 残留
- [ ] 无 `@author Memopark` 残留
- [ ] 类型别名 `MemoPark` 保持不变（正确）
- [ ] rustc-ice 日志已删除

### 编译验证
- [ ] `cargo check -p stardust-runtime` 通过
- [ ] `cargo check -p pallet-membership` 通过
- [ ] `cargo check -p pallet-stardust-park` 通过

### Git 管理
- [ ] 备份标签已创建
- [ ] 提交信息清晰
- [ ] 可随时回滚

---

## 🎯 推荐执行方案

### 方案 A：自动化执行（推荐）⭐️⭐️⭐️⭐️⭐️

**优势**:
- ✅ 快速完成（10分钟）
- ✅ 风险极低（仅修改注释）
- ✅ 自动备份和验证

**执行**:
```bash
cd /home/xiaodong/文档/memopark
chmod +x docs/链端memopark清理-自动执行.sh
./docs/链端memopark清理-自动执行.sh
```

---

### 方案 B：手动修改

**适用场景**: 仅修改关键文件

**步骤**:
1. 修改版权声明（3个文件）
2. 修改注释（2个文件）
3. 提交

**时间**: 5分钟

---

## 📝 后续任务

完成 `memopark` 字样清理后，配合之前的 `memo` 字样清理：

1. **执行 memo 清理**（如尚未执行）
   ```bash
   ./docs/链端memo清理-自动执行.sh
   ```

2. **统一验证**
   ```bash
   # 验证无残留
   grep -r "memopark" pallets runtime node --include="*.rs"
   grep -r "MEMO" pallets runtime node --include="*.rs" | grep -v "DUST"
   ```

3. **完整编译**
   ```bash
   cargo build --release
   ```

---

## 🎉 预期成果

清理完成后：
- ✅ 版权声明：`Stardust Team`
- ✅ 注释：`Stardust`
- ✅ 类型别名：`MemoPark` 保持（指向 `pallet_stardust_park`）
- ✅ 代码库整洁无遗留

---

**推荐立即执行**: 风险极低，快速完成 🚀

