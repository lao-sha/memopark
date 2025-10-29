# 📊 第二轮重命名方案 - MEMO和stardust全面分析

**📅 日期**: 2025-10-29  
**🎯 目标**: 全面扫描并重命名项目中所有"MEMO"和"stardust"字样  
**📈 扫描结果**: MEMO 2760处，stardust 1541处

---

## 📋 执行摘要

### 统计数据
| 类型 | MEMO出现次数 | stardust出现次数 |
|------|-------------|-----------------|
| **Rust源码** | 265 | 170 |
| **TypeScript/TSX** | 366 | 32 |
| **Markdown文档** | 2027 | 1311 |
| **配置文件** | 102 | 28 |
| **总计** | **2760** | **1541** |

### 修改优先级
- 🔴 **高优先级**: 目录名、配置文件、UI显示文本（影响用户可见）
- 🟡 **中优先级**: 代码注释、变量名称（影响开发体验）
- 🟢 **低优先级**: 文档内容（可后续更新）

---

## 🎯 分类详解

### 类型1️⃣: 目录和文件名 🔴 高优先级

#### 需要重命名的目录

**前端项目目录** (3个):
1. `stardust-dapp` → `stardust-dapp` ⚠️ **已在其他方案中考虑**
2. `stardust-gov` → `stardust-gov`
3. `stardust-governance` → `stardust-governance`

**其他目录** (1个):
4. `stardust-squid` → `stardust-squid`

#### 需要重命名的文件

**配置文件中的包名**:
- `node/Cargo.toml`: `name = "stardust-node"` → `name = "stardust-node"` ⚠️ **已完成**
- `runtime/Cargo.toml`: `name = "stardust-runtime"` → `name = "stardust-runtime"` ⚠️ **已完成**

**编译产物** (自动生成，无需手动修改):
- `target/release/stardust-node` → 重新编译后自动生成 `stardust-node`
- `target/release/libstardust_runtime.rlib` → 自动生成
- `stardust_runtime.wasm` → 自动生成

#### 修改难度
- **代码难度**: 🟠 中等（目录重命名需要更新引用）
- **测试难度**: 🟡 中等（需要验证路径引用）
- **风险等级**: 🟡 中等（可能影响CI/CD配置）

---

### 类型2️⃣: UI显示文本 🔴 高优先级

#### 前端显示文本

**代币单位显示** (~200处):
```typescript
// ❌ 修改前
<Text>{amount} MEMO</Text>
<Input suffix="MEMO" />
return `${whole}.${fracStr} MEMO`

// ✅ 修改后
<Text>{amount} DUST</Text>
<Input suffix="DUST" />
return `${whole}.${fracStr} DUST`
```

**影响文件** (估计):
- `stardust-dapp/src/**/*.tsx` - ~150处
- `stardust-governance/src/**/*.tsx` - ~50处

**修改策略**:
- 使用全局搜索替换 `MEMO"` → `DUST"`
- 使用全局搜索替换 `MEMO<` → `DUST<`
- 手动检查边界情况（如变量名 `memoAmount` 已处理）

#### Rust代码中的UI文本

**错误消息和事件**:
```rust
// ❌ 修改前
Error::<T>::InsufficientMEMO
Self::deposit_event(Event::MEMODeposited { amount });

// ✅ 修改后
Error::<T>::InsufficientDUST
Self::deposit_event(Event::DUSTDeposited { amount });
```

**影响**: 影响错误提示的可读性，建议修改

#### 修改难度
- **代码难度**: 🟢 低（批量替换）
- **测试难度**: 🟡 中等（需要验证所有UI显示）
- **风险等级**: 🟢 低（不影响逻辑）

---

### 类型3️⃣: 代码注释 🟡 中优先级

#### Rust代码注释

**发现场景**:
```rust
// ❌ 修改前
/// 最低价格保护：如果市场价格为0或过低，使用默认价格（0.000001 USDT/MEMO）
/// 最高押金上限：单次押金不超过 100,000 MEMO
const MAX_DEPOSIT: Balance = 100_000 * MEMO_PRECISION; // 最高 100,000 MEMO

// ✅ 修改后
/// 最低价格保护：如果市场价格为0或过低，使用默认价格（0.000001 USDT/DUST）
/// 最高押金上限：单次押金不超过 100,000 DUST
const MAX_DEPOSIT: Balance = 100_000 * DUST_PRECISION; // 最高 100,000 DUST
```

**影响文件**:
- `runtime/src/configs/mod.rs` - ~30处
- `pallets/*/src/lib.rs` - ~100处
- `pallets/*/README.md` - ~135处

**特殊情况 - 常量名称**:
```rust
// 需要决策：是否重命名常量名？
const MEMO_PRECISION: Balance = 1_000_000_000_000; // 12位小数

// 选项A：保持不变（推荐，避免破坏性修改）
// 选项B：重命名为 DUST_PRECISION
```

#### TypeScript代码注释

**发现场景**:
```typescript
// ❌ 修改前
/**
 * 函数级中文注释：格式化 MEMO 金额
 * 将最小单位转换为 MEMO（除以 10^12）
 */

// ✅ 修改后
/**
 * 函数级中文注释：格式化 DUST 金额
 * 将最小单位转换为 DUST（除以 10^12）
 */
```

**影响文件**:
- `stardust-dapp/src/**/*.ts` - ~50处
- `stardust-governance/src/**/*.ts` - ~20处

#### 修改难度
- **代码难度**: 🟢 低（批量替换）
- **测试难度**: 🟢 低（注释不影响运行）
- **风险等级**: 🟢 低（仅影响可读性）

---

### 类型4️⃣: 配置和元数据 🟡 中优先级

#### Package.json

**前端DApp**:
```json
// stardust-dapp/package.json
{
  "name": "stardust-dapp",  // → stardust-dapp
  "description": "Stardust DApp Frontend",  // → Stardust DApp Frontend
  "repository": {
    "url": "https://github.com/lao-sha/stardust.git"  // → stardust.git
  }
}
```

**治理前端**:
```json
// stardust-governance/package.json
{
  "name": "stardust-governance",  // → stardust-governance
  // ...
}
```

#### Cargo.toml

**根Cargo.toml**:
```toml
[workspace.package]
repository = "https://github.com/lao-sha/stardust.git"  # → stardust.git

[workspace]
members = [
    "node",  # 产出: stardust-node → stardust-node
    "runtime",  # 产出: stardust-runtime → stardust-runtime
    # ...
]
```

#### README和文档

**根README.md**:
```markdown
# Stardust  → # Stardust

A blockchain project for memorial park services.  
Token: MEMO → Token: DUST
```

#### 修改难度
- **代码难度**: 🟢 低（配置文件修改）
- **测试难度**: 🟡 中等（需要验证构建）
- **风险等级**: 🟡 中等（可能影响CI/CD）

---

### 类型5️⃣: 文档内容 🟢 低优先级

#### Markdown文档

**统计**: 
- MEMO: 2027处（大部分在文档中）
- stardust: 1311处（大部分在文档中）

**影响文件** (估计):
- `docs/*.md` - 大量
- `pallets/*/README.md` - 大量
- 各种使用说明和完成报告

**修改策略**:
- 批量替换 " MEMO" → " DUST"
- 批量替换 "MEMO " → "DUST "
- 批量替换 "stardust" → "stardust"
- 手动检查Git历史、提交信息等特殊场景

#### 修改难度
- **代码难度**: 🟢 低（批量替换）
- **测试难度**: 🟢 低（不影响功能）
- **风险等级**: 🟢 低（纯文档）

---

### 类型6️⃣: Chain Spec和元数据 🟡 中优先级

#### Chain Specification

**链配置**:
```rust
// node/src/chain_spec.rs (如果存在)
pub fn development_config() -> ChainSpec {
    ChainSpec::from_genesis(
        "Stardust Development",  // → "Stardust Development"
        "stardust_dev",  // → "stardust_dev"
        // ...
        properties.insert("tokenSymbol".into(), "MEMO".into());  // → "DUST"
        properties.insert("tokenDecimals".into(), 12.into());
        // ...
    )
}
```

#### Runtime元数据

**Runtime版本**:
```rust
// runtime/src/lib.rs
pub const VERSION: RuntimeVersion = RuntimeVersion {
    spec_name: create_runtime_str!("stardust"),  // → "stardust"
    impl_name: create_runtime_str!("stardust-node"),  // → "stardust-node"
    // ...
};
```

#### 修改难度
- **代码难度**: 🟡 中等（需要重新生成chain spec）
- **测试难度**: 🔴 高（影响链的identity）
- **风险等级**: 🔴 高（可能导致链不兼容）

---

## 🎯 综合修改方案

### 推荐策略：分阶段渐进式重命名 ⭐️

#### 阶段A: 高优先级（立即执行）✅

**目标**: UI显示文本和用户可见内容

**范围**:
1. 前端UI显示文本: "MEMO" → "DUST"
2. 前端包配置: package.json中的name和description
3. Git仓库URL更新

**工具**: 自动化脚本 + IDE重构

**风险**: 🟢 低

**预计时间**: 2-3小时

---

#### 阶段B: 中优先级（UI完成后）⚠️

**目标**: 代码注释和开发文档

**范围**:
1. Rust代码注释: MEMO → DUST
2. TypeScript代码注释: MEMO → DUST
3. README文档更新
4. pallet文档更新

**工具**: 批量替换 + 手动检查

**风险**: 🟢 低

**预计时间**: 3-4小时

---

#### 阶段C: 低优先级（可选）🔵

**目标**: 历史文档和辅助文件

**范围**:
1. docs/下的所有使用说明
2. 完成报告
3. Git提交历史（不建议修改）

**建议**: 可选，不影响功能

**风险**: 🟢 低

---

#### 阶段D: 慎重评估（需要充分测试）🔴

**目标**: Chain Spec和Runtime元数据

**前提**: 
- 所有其他修改已完成
- 充分的测试环境
- 明确的迁移策略

**范围**:
1. Runtime版本信息
2. Chain Spec配置
3. 重新生成genesis

**风险**: 🔴 高（可能导致链不兼容）

**建议**: **Phase 3或更晚**，需要团队决策

---

## 📋 详细修改清单

### 前端DApp (stardust-dapp)

#### 1. UI显示文本 (高优先级)

**文件类型**: `*.tsx`, `*.ts`

**搜索模式**:
```bash
# 搜索所有 " MEMO" 和 "MEMO "
grep -r " MEMO\|MEMO " stardust-dapp/src --include="*.tsx" --include="*.ts"
```

**修改示例**:
```typescript
// 示例文件: src/components/Balance.tsx
- <Text>{formatNumber(balance)} MEMO</Text>
+ <Text>{formatNumber(balance)} DUST</Text>

// 示例文件: src/utils/format.ts
- * @param amount - 金额（MEMO）
+ * @param amount - 金额（DUST）

// 示例文件: src/hooks/useBalance.ts
- /** 可用余额（MEMO） */
+ /** 可用余额（DUST） */
```

**预计修改**: ~200处

**测试重点**: 所有涉及金额显示的页面

---

#### 2. Package配置 (高优先级)

**文件**: `stardust-dapp/package.json`

```json
// 修改前
{
  "name": "stardust-dapp",
  "description": "Stardust DApp - Memorial Park on Blockchain",
  "repository": {
    "type": "git",
    "url": "https://github.com/lao-sha/stardust.git"
  }
}

// 修改后
{
  "name": "stardust-dapp",
  "description": "Stardust DApp - Memorial Park on Blockchain",
  "repository": {
    "type": "git",
    "url": "https://github.com/lao-sha/stardust.git"
  }
}
```

---

### 治理前端 (stardust-governance)

#### 3. UI显示文本和配置 (高优先级)

**类似前端DApp的修改**

**预计修改**: ~50处

---

### 链端Runtime

#### 4. 代码注释 (中优先级)

**文件**: `runtime/src/configs/mod.rs`

```rust
// 修改前
/// 最低价格保护：如果市场价格为0或过低，使用默认价格（0.000001 USDT/MEMO）
/// 最高押金上限：单次押金不超过 100,000 MEMO（防止价格异常导致押金过高）
/// 最低押金下限：单次押金不少于 1 MEMO（保证押金有意义）

// 修改后
/// 最低价格保护：如果市场价格为0或过低，使用默认价格（0.000001 USDT/DUST）
/// 最高押金上限：单次押金不超过 100,000 DUST（防止价格异常导致押金过高）
/// 最低押金下限：单次押金不少于 1 DUST（保证押金有意义）
```

**预计修改**: ~30处

---

#### 5. Pallet注释 (中优先级)

**文件**: `pallets/*/src/lib.rs`

```rust
// 典型修改
/// 函数级详细中文注释：供奉品提交押金（1,000,000 MEMO）
/// - 1,000,000 MEMO = 1,000,000,000,000 单位（假设 1 MEMO = 1,000,000 单位）

// 修改为
/// 函数级详细中文注释：供奉品提交押金（1,000,000 DUST）
/// - 1,000,000 DUST = 1,000,000,000,000 单位（假设 1 DUST = 1,000,000 单位）
```

**预计修改**: ~100处

---

### 文档

#### 6. README和使用文档 (中优先级)

**根README.md**:
```markdown
# 修改前
# Stardust

A blockchain project for memorial park services.

**Token**: MEMO
**Network**: Stardust Network

# 修改后
# Stardust

A blockchain project for memorial park services.

**Token**: DUST
**Network**: Stardust Network
```

**pallet README**:
- 批量替换所有 pallet README.md中的 "MEMO" → "DUST"
- 批量替换 "stardust" → "stardust"

**预计修改**: ~50个文件

---

## 🔧 自动化修改脚本

### 脚本1: UI文本重命名（安全）

```bash
#!/bin/bash
# rename-ui-text.sh

cd /home/xiaodong/文档/stardust

echo "=== 阶段1: 前端UI文本重命名 ==="

# 备份
git tag -f before-ui-text-rename -m "备份：UI文本重命名前"

# 前端DApp
echo "1️⃣ 更新前端DApp UI文本..."
cd stardust-dapp/src
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/ MEMO/ DUST/g'
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO /DUST /g'
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO"/DUST"/g'
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO</DUST</g'
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i "s/MEMO'/DUST'/g"

# 治理前端
echo "2️⃣ 更新治理前端UI文本..."
cd ../../stardust-governance/src
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/ MEMO/ DUST/g'
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO /DUST /g'
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO"/DUST"/g'

echo "✅ UI文本重命名完成"

# 验证
cd ../..
echo "🔍 验证剩余MEMO..."
grep -r " MEMO\|MEMO " stardust-dapp/src stardust-governance/src \
  --include="*.ts" --include="*.tsx" | wc -l

# 提交
git add stardust-dapp/src stardust-governance/src
git commit -m "UI文本更新: MEMO → DUST

- 前端DApp: ~200处
- 治理前端: ~50处
- 总计: ~250处"
```

---

### 脚本2: 代码注释重命名（安全）

```bash
#!/bin/bash
# rename-code-comments.sh

cd /home/xiaodong/文档/stardust

echo "=== 阶段2: 代码注释重命名 ==="

# 备份
git tag -f before-comment-rename -m "备份：注释重命名前"

# Rust代码注释
echo "1️⃣ 更新Rust代码注释..."
find runtime pallets -name "*.rs" | xargs sed -i 's/ MEMO/ DUST/g'
find runtime pallets -name "*.rs" | xargs sed -i 's/MEMO /DUST /g'
find runtime pallets -name "*.rs" | xargs sed -i 's/MEMO）/DUST）/g'
find runtime pallets -name "*.rs" | xargs sed -i 's/（MEMO/（DUST/g'

# TypeScript代码注释
echo "2️⃣ 更新TypeScript代码注释..."
cd stardust-dapp/src
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/格式化 MEMO/格式化 DUST/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/金额（MEMO）/金额（DUST）/g'

echo "✅ 注释重命名完成"

# 提交
cd ../..
git add runtime pallets stardust-dapp stardust-governance
git commit -m "代码注释更新: MEMO → DUST

- Rust注释: ~130处
- TypeScript注释: ~70处
- 总计: ~200处"
```

---

### 脚本3: Package配置更新（谨慎）

```bash
#!/bin/bash
# update-package-configs.sh

cd /home/xiaodong/文档/stardust

echo "=== 阶段3: Package配置更新 ==="

# 备份
git tag -f before-package-rename -m "备份：Package配置更新前"

# 更新前端DApp package.json
echo "1️⃣ 更新前端DApp配置..."
sed -i 's/"name": "stardust-dapp"/"name": "stardust-dapp"/' stardust-dapp/package.json
sed -i 's/Stardust DApp/Stardust DApp/' stardust-dapp/package.json
sed -i 's/stardust.git/stardust.git/' stardust-dapp/package.json

# 更新治理前端 package.json
echo "2️⃣ 更新治理前端配置..."
sed -i 's/"name": "stardust-governance"/"name": "stardust-governance"/' stardust-governance/package.json
sed -i 's/stardust.git/stardust.git/' stardust-governance/package.json

# 更新根Cargo.toml
echo "3️⃣ 更新根Cargo.toml..."
sed -i 's/stardust.git/stardust.git/' Cargo.toml

echo "✅ Package配置更新完成"

# 提交
git add stardust-dapp/package.json stardust-governance/package.json Cargo.toml
git commit -m "配置更新: stardust → stardust

- 前端DApp package.json
- 治理前端 package.json
- 根 Cargo.toml"
```

---

## 📊 修改影响评估

### 影响范围统计

| 类别 | 文件数（估） | 修改点（估） | 优先级 | 风险 |
|------|-------------|-------------|--------|------|
| UI显示文本 | 80 | ~250 | 高 | 低 |
| 代码注释 | 150 | ~200 | 中 | 低 |
| Package配置 | 5 | ~10 | 高 | 中 |
| 文档内容 | 100 | ~3000 | 低 | 低 |
| **总计** | **~335** | **~3460** | - | - |

---

### 测试覆盖计划

#### 1. UI测试
- [ ] 所有金额显示页面
- [ ] 表单输入提示
- [ ] 错误消息显示
- [ ] Tooltip和帮助文本

#### 2. 功能测试
- [ ] 交易功能正常
- [ ] 查询功能正常
- [ ] 所有API调用正常

#### 3. 构建测试
- [ ] 前端编译通过
- [ ] 链端编译通过
- [ ] 生成的二进制文件名称正确

---

## 🚦 执行建议

### 推荐执行顺序

#### 第1步: UI文本重命名（立即可做）⭐️
- [ ] 执行 `rename-ui-text.sh`
- [ ] 手动验证关键页面
- [ ] 编译验证

#### 第2步: Package配置更新（UI完成后）
- [ ] 执行 `update-package-configs.sh`
- [ ] 验证构建流程
- [ ] 更新CI/CD配置（如有）

#### 第3步: 代码注释更新（可选）
- [ ] 执行 `rename-code-comments.sh`
- [ ] 验证文档生成
- [ ] 检查API文档

#### 第4步: 文档批量更新（最后）
- [ ] 批量替换文档中的MEMO和stardust
- [ ] 手动检查关键文档
- [ ] 更新README

---

### 回滚方案

#### 场景1: UI文本修改失败
```bash
git reset --hard before-ui-text-rename
```

#### 场景2: Package配置导致构建失败
```bash
git reset --hard before-package-rename
# 手动修复配置文件
```

#### 场景3: 需要完全回滚
```bash
# 查看所有备份标签
git tag -l "before-*"

# 回滚到最早的备份点
git reset --hard before-ui-text-rename
```

---

## 💡 特殊考虑

### 1. 常量名称决策

**问题**: 是否重命名 `MEMO_PRECISION` 等常量？

**选项A: 保持不变（推荐）**
```rust
// 保持原样
pub const MEMO_PRECISION: Balance = 1_000_000_000_000;

// 理由：
// - 避免破坏性修改
// - 常量名不影响用户体验
// - 减少修改范围和风险
```

**选项B: 全面重命名**
```rust
// 重命名
pub const DUST_PRECISION: Balance = 1_000_000_000_000;

// 理由：
// - 完全统一命名
// - 提高代码一致性
// - 需要修改所有引用（高风险）
```

**建议**: **选择选项A（保持不变）**

---

### 2. Git历史处理

**问题**: 历史提交消息中包含"MEMO"和"stardust"

**建议**: **不修改Git历史**

**理由**:
- Git历史记录应保持不变
- 修改历史会影响所有克隆
- 历史提交仅供参考，不影响当前功能

---

### 3. Chain Spec迁移

**问题**: Runtime元数据和Chain Spec需要修改

**建议**: **Phase 3单独处理**

**原因**:
- 高风险（可能导致链不兼容）
- 需要充分测试
- 需要迁移策略
- 需要团队决策

**临时方案**: 保持Runtime spec_name不变，仅更新显示文本

---

## ✅ 完成检查清单

### 代码修改
- [ ] UI显示文本已更新
- [ ] 代码注释已更新
- [ ] Package配置已更新
- [ ] 文档内容已更新（可选）

### 测试验证
- [ ] 前端编译通过
- [ ] 链端编译通过
- [ ] UI显示正确
- [ ] 功能测试通过

### 文档更新
- [ ] README已更新
- [ ] API文档已更新
- [ ] 用户指南已更新

---

## 📞 需要确认的问题

### 问题1: 是否重命名常量名？
**建议**: 不重命名，保持 `MEMO_PRECISION` 等常量名不变

### 问题2: 是否更新Chain Spec？
**建议**: Phase 3单独处理，需要团队决策

### 问题3: 文档优先级？
**建议**: 低优先级，可后续更新

---

## 🎯 最终建议

### 最佳实践方案 ⭐️

1. **立即执行**: UI文本重命名（脚本1）
   - 风险低
   - 收益高
   - 用户可见

2. **随后执行**: Package配置更新（脚本3）
   - 中等风险
   - 影响构建
   - 需要测试

3. **可选执行**: 代码注释更新（脚本2）
   - 风险低
   - 提高可读性
   - 时间充裕时执行

4. **最后执行**: 文档批量更新
   - 风险低
   - 影响小
   - 可分批进行

---

**📅 文档生成时间**: 2025-10-29  
**✍️ 创建者**: AI Assistant  
**🔄 版本**: v1.0  
**🎯 状态**: 方案就绪，等待执行

