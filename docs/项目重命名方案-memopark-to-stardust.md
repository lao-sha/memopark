# 🔄 项目重命名方案：stardust → stardust

**📅 方案时间**: 2025-10-29  
**🎯 重命名目标**: 
- 项目名：stardust → **stardust**
- 代币名：MEMO → **DUST**

**⏱️ 预计耗时**: 4-6小时  
**🎯 成功标准**: 所有引用更新完毕，编译通过，功能正常

---

## 📊 影响范围分析

### 1️⃣ 文件和目录（需要重命名）

```bash
# 根目录文件
stardust/                                    → stardust/

# 节点和Runtime
node/                                        # Cargo.toml中的包名
├── Cargo.toml (stardust-node)              → stardust-node
runtime/                                     # Cargo.toml中的包名
├── Cargo.toml (stardust-runtime)           → stardust-runtime

# 前端项目
stardust-dapp/                               → stardust-dapp/
├── package.json (stardust-dapp)            → stardust-dapp
├── index.html (<title>Stardust</title>)   → Stardust
├── public/                                  # favicon等资源

# 治理前端
stardust-governance/                         → stardust-governance/
├── package.json (stardust-governance)      → stardust-governance

# 治理工具
stardust-gov/                                → stardust-gov/
├── package.json (stardust-gov)             → stardust-gov

# 治理脚本
stardust-gov-scripts/                        → stardust-gov-scripts/
├── package.json (stardust-gov-scripts)     → stardust-gov-scripts

# Subsquid
stardust-squid/                              → stardust-squid/

# 状态目录
my-chain-state/                              → 可保持或改为 stardust-chain-state/
```

### 2️⃣ Pallet名称（部分需要改）

```rust
// 🔴 需要修改的Pallet（包含stardust/memo前缀）
pallets/stardust-park/                           → pallets/stardust-park/
pallets/stardust-grave/                          → pallets/stardust-grave/
pallets/stardust-pet/                            → pallets/stardust-pet/
pallets/stardust-ipfs/                           → pallets/stardust-ipfs/
pallets/stardust-appeals/                        → pallets/stardust-appeals/
pallets/stardust-referrals/                      → pallets/stardust-referrals/

// 🟢 不需要修改的Pallet（通用名称）
pallets/trading/                             ✅ 保持
pallets/credit/                              ✅ 保持
pallets/deceased/                            ✅ 保持
pallets/memorial/                            ✅ 保持
pallets/affiliate/                           ✅ 保持
pallets/escrow/                              ✅ 保持
pallets/arbitration/                         ✅ 保持
// ... 其他通用pallet
```

### 3️⃣ 代码中的引用（需要全局替换）

#### Rust代码
```rust
// 包名引用
use stardust_runtime::...                    → use stardust_runtime::...
stardust-node                                → stardust-node

// Pallet引用
pallet_memo_park                             → pallet_stardust_park
pallet_memo_grave                            → pallet_stardust_grave
pallet_memo_pet                              → pallet_stardust_pet
pallet_memo_ipfs                             → pallet_stardust_ipfs
pallet_memo_appeals                          → pallet_stardust_appeals
pallet_memo_referrals                        → pallet_stardust_referrals

// 代币相关
MEMO (在注释和常量中)                        → DUST
10 MEMO                                      → 10 DUST
1000 MEMO                                    → 1000 DUST
memo_amount                                  → dust_amount (可选，建议保持)
```

#### TypeScript/JavaScript代码
```typescript
// 包名
"stardust-dapp"                              → "stardust-dapp"
"stardust-governance"                        → "stardust-governance"

// 变量名（可选，建议保持API稳定性）
memoAmount                                   → 可保持（内部变量）
MEMO                                         → DUST（显示文本）

// 注释
// MEMO代币                                   → // DUST代币
```

#### 文档和注释
```markdown
# Stardust                                   → # Stardust
MEMO代币                                     → DUST代币
Stardust项目                                 → Stardust项目
纪念园                                       → 可保持或改为"星尘宇宙"
```

### 4️⃣ 配置文件

```toml
# Cargo.toml
[workspace]
members = [
    "node",              # stardust-node → stardust-node
    "runtime",           # stardust-runtime → stardust-runtime
    ...
]

# package.json
{
  "name": "stardust-dapp",                   → "stardust-dapp",
  "description": "Stardust DApp",            → "Stardust DApp",
}

# chain_spec.rs
id: "stardust",                              → "stardust",
protocol_id: "stardust",                     → "stardust",
```

---

## 🔧 详细修改步骤

### 阶段1: 准备工作（5分钟）✅

#### 1.1 创建Git分支
```bash
cd /home/xiaodong/文档/stardust
git checkout -b rename-to-stardust
git add -A
git commit -m "Checkpoint: Before rename to Stardust"
```

#### 1.2 创建备份
```bash
# 备份整个项目
cd /home/xiaodong/文档/
tar -czf stardust-backup-$(date +%Y%m%d).tar.gz stardust/

# 或者使用Git Tag
cd stardust
git tag before-rename-to-stardust
```

---

### 阶段2: 重命名Pallet目录（15分钟）✅

```bash
cd /home/xiaodong/文档/stardust/pallets

# 重命名6个memo-前缀的pallet
mv stardust-park stardust-park
mv stardust-grave stardust-grave
mv stardust-pet stardust-pet
mv stardust-ipfs stardust-ipfs
mv stardust-appeals stardust-appeals
mv stardust-referrals stardust-referrals

# 验证
ls -la | grep stardust
```

#### 更新每个Pallet的Cargo.toml
```bash
# 批量替换（示例：stardust-park）
cd stardust-park
sed -i 's/pallet-stardust-park/pallet-stardust-park/g' Cargo.toml
sed -i 's/stardust-park/stardust-park/g' Cargo.toml
```

#### 更新每个Pallet的lib.rs
```bash
# 批量替换pallet宏声明
find pallets/stardust-* -name "lib.rs" -exec sed -i 's/#\[pallet\][\s]*pub mod pallet_memo_/#[pallet] pub mod pallet_stardust_/g' {} \;

# 或手动修改每个lib.rs的开头
# 将 pub mod pallet_memo_xxx 改为 pub mod pallet_stardust_xxx
```

---

### 阶段3: 更新Workspace配置（10分钟）✅

#### 3.1 更新根Cargo.toml
```bash
cd /home/xiaodong/文档/stardust

# 编辑 Cargo.toml
# 将所有 "pallets/memo-" 改为 "pallets/stardust-"
```

**需要修改的行**:
```toml
[workspace]
members = [
    # ...
    "pallets/stardust-park",      # 原 stardust-park
    "pallets/stardust-grave",     # 原 stardust-grave
    "pallets/stardust-pet",       # 原 stardust-pet
    "pallets/stardust-ipfs",      # 原 stardust-ipfs
    "pallets/stardust-appeals",   # 原 stardust-appeals
    "pallets/stardust-referrals", # 原 stardust-referrals
    # ...
]
```

#### 3.2 更新node/Cargo.toml
```toml
[package]
name = "stardust-node"           # 原 stardust-node
# ...

[dependencies]
stardust-runtime = { path = "../runtime" }  # 原 stardust-runtime
pallet-stardust-park = { path = "../pallets/stardust-park", default-features = false }
pallet-stardust-grave = { path = "../pallets/stardust-grave", default-features = false }
pallet-stardust-pet = { path = "../pallets/stardust-pet", default-features = false }
pallet-stardust-ipfs = { path = "../pallets/stardust-ipfs", default-features = false }
pallet-stardust-appeals = { path = "../pallets/stardust-appeals", default-features = false }
pallet-stardust-referrals = { path = "../pallets/stardust-referrals", default-features = false }
```

#### 3.3 更新runtime/Cargo.toml
```toml
[package]
name = "stardust-runtime"        # 原 stardust-runtime
# ...

[dependencies]
# 所有pallet-memo-前缀改为pallet-stardust-
pallet-stardust-park = { path = "../pallets/stardust-park", default-features = false }
pallet-stardust-grave = { path = "../pallets/stardust-grave", default-features = false }
pallet-stardust-pet = { path = "../pallets/stardust-pet", default-features = false }
pallet-stardust-ipfs = { path = "../pallets/stardust-ipfs", default-features = false }
pallet-stardust-appeals = { path = "../pallets/stardust-appeals", default-features = false }
pallet-stardust-referrals = { path = "../pallets/stardust-referrals", default-features = false }

[features]
std = [
    # ...
    "pallet-stardust-park/std",
    "pallet-stardust-grave/std",
    "pallet-stardust-pet/std",
    "pallet-stardust-ipfs/std",
    "pallet-stardust-appeals/std",
    "pallet-stardust-referrals/std",
]
```

---

### 阶段4: 更新Runtime代码（30分钟）✅

#### 4.1 更新runtime/src/lib.rs
```rust
// 1. 修改Runtime名称（可选）
pub struct Runtime;

// 2. 更新construct_runtime宏中的pallet类型名称
construct_runtime!(
    pub struct Runtime {
        // ...
        #[runtime::pallet_index(20)]
        pub type StardustPark = pallet_stardust_park;  // 原 StarDust = pallet_memo_park
        
        #[runtime::pallet_index(21)]
        pub type StardustGrave = pallet_stardust_grave;  // 原 MemoGrave = pallet_memo_grave
        
        #[runtime::pallet_index(38)]
        pub type StardustPet = pallet_stardust_pet;  // 原 MemoPet = pallet_memo_pet
        
        #[runtime::pallet_index(32)]
        pub type StardustIpfs = pallet_stardust_ipfs;  // 原 MemoIpfs = pallet_memo_ipfs
        
        #[runtime::pallet_index(42)]
        pub type ContentGovernance = pallet_stardust_appeals;  // 原 pallet_memo_appeals
        
        // ... 其他pallet
    }
);
```

#### 4.2 更新runtime/src/configs/mod.rs
```rust
// 所有 pallet_memo_xxx 改为 pallet_stardust_xxx

// 示例：
impl pallet_stardust_park::Config for Runtime {  // 原 pallet_memo_park
    type RuntimeEvent = RuntimeEvent;
    // ...
}

impl pallet_stardust_grave::Config for Runtime {  // 原 pallet_memo_grave
    type RuntimeEvent = RuntimeEvent;
    // ...
}

impl pallet_stardust_pet::Config for Runtime {  // 原 pallet_memo_pet
    type RuntimeEvent = RuntimeEvent;
    // ...
}

impl pallet_stardust_ipfs::Config for Runtime {  // 原 pallet_memo_ipfs
    type RuntimeEvent = RuntimeEvent;
    // ...
}

impl pallet_stardust_appeals::Config for Runtime {  // 原 pallet_memo_appeals
    type RuntimeEvent = RuntimeEvent;
    // ...
}
```

#### 4.3 更新node/src/chain_spec.rs
```rust
// 链ID和协议ID
pub fn stardust_testnet_config() -> ChainSpec {  // 原 stardust_testnet_config
    ChainSpec::builder(
        // ...
    )
    .with_id("stardust")           // 原 "stardust"
    .with_protocol_id("stardust")  // 原 "stardust"
    .build()
}
```

#### 4.4 更新node/src/service.rs
```rust
// 如果有stardust相关的服务名称，改为stardust
// 通常这个文件不需要大改
```

---

### 阶段5: 全局代码替换（30分钟）✅

#### 5.1 批量替换Rust代码中的引用
```bash
cd /home/xiaodong/文档/stardust

# 替换pallet模块引用（注意：先备份！）
find . -name "*.rs" -type f -exec sed -i 's/pallet_memo_park/pallet_stardust_park/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/pallet_memo_grave/pallet_stardust_grave/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/pallet_memo_pet/pallet_stardust_pet/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/pallet_memo_ipfs/pallet_stardust_ipfs/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/pallet_memo_appeals/pallet_stardust_appeals/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/pallet_memo_referrals/pallet_stardust_referrals/g' {} \;

# 替换use语句中的引用
find . -name "*.rs" -type f -exec sed -i 's/use pallet_memo_/use pallet_stardust_/g' {} \;

# 替换注释中的项目名称
find . -name "*.rs" -type f -exec sed -i 's/Stardust/Stardust/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/stardust/stardust/g' {} \;

# 替换代币名称（注意：这个需要谨慎，可能有false positive）
# 建议手动查找替换或使用更精确的正则
find . -name "*.rs" -type f -exec sed -i 's/ MEMO / DUST /g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/\bMEMO\b/DUST/g' {} \;
```

#### 5.2 更新注释中的代币单位
```bash
# 替换注释中的常见模式
find . -name "*.rs" -type f -exec sed -i 's/10 MEMO/10 DUST/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/100 MEMO/100 DUST/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/1000 MEMO/1000 DUST/g' {} \;
find . -name "*.rs" -type f -exec sed -i 's/10_000 MEMO/10_000 DUST/g' {} \;
```

---

### 阶段6: 更新前端项目（1小时）✅

#### 6.1 重命名前端目录
```bash
cd /home/xiaodong/文档/
mv stardust/stardust-dapp stardust/stardust-dapp
mv stardust/stardust-governance stardust/stardust-governance
mv stardust/stardust-gov stardust/stardust-gov
mv stardust/stardust-gov-scripts stardust/stardust-gov-scripts
mv stardust/stardust-squid stardust/stardust-squid
```

#### 6.2 更新主前端DApp
```bash
cd /home/xiaodong/文档/stardust/stardust-dapp

# 更新package.json
sed -i 's/"stardust-dapp"/"stardust-dapp"/g' package.json
sed -i 's/Stardust DApp/Stardust DApp/g' package.json

# 更新index.html
sed -i 's/<title>Stardust<\/title>/<title>Stardust<\/title>/g' index.html
sed -i 's/Stardust/Stardust/g' index.html

# 更新vite.config.ts（如果有项目名称）
sed -i 's/stardust/stardust/g' vite.config.ts

# 更新README.md
sed -i 's/Stardust/Stardust/g' README.md
sed -i 's/stardust/stardust/g' README.md
sed -i 's/MEMO/DUST/g' README.md
```

#### 6.3 全局替换前端代码中的显示文本
```bash
cd stardust-dapp/src

# 替换UI中显示的文本（注意：API变量名可以选择性保留）
# 显示的代币名称
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO/DUST/g'

# 显示的项目名称
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/Stardust/Stardust/g'

# 注释
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/stardust/stardust/g'

# ⚠️ 注意：API接口变量名建议保持（memoAmount等），避免破坏性更改
# 或者使用IDE的重构功能，更精确地重命名
```

#### 6.4 更新其他前端项目
```bash
# stardust-governance
cd /home/xiaodong/文档/stardust/stardust-governance
sed -i 's/"stardust-governance"/"stardust-governance"/g' package.json
sed -i 's/Stardust/Stardust/g' package.json README.md

# stardust-gov
cd /home/xiaodong/文档/stardust/stardust-gov
sed -i 's/"stardust-gov"/"stardust-gov"/g' package.json
sed -i 's/Stardust/Stardust/g' package.json README.md

# stardust-gov-scripts
cd /home/xiaodong/文档/stardust/stardust-gov-scripts
sed -i 's/"stardust-gov-scripts"/"stardust-gov-scripts"/g' package.json
sed -i 's/Stardust/Stardust/g' package.json README.md
```

---

### 阶段7: 更新文档（30分钟）✅

```bash
cd /home/xiaodong/文档/stardust/docs

# 批量替换所有Markdown文档
find . -name "*.md" -exec sed -i 's/Stardust/Stardust/g' {} \;
find . -name "*.md" -exec sed -i 's/stardust/stardust/g' {} \;
find . -name "*.md" -exec sed -i 's/\bMEMO\b/DUST/g' {} \;

# 更新根目录README.md
cd /home/xiaodong/文档/stardust
sed -i 's/Stardust/Stardust/g' README.md
sed -i 's/stardust/stardust/g' README.md
sed -i 's/MEMO/DUST/g' README.md
```

---

### 阶段8: 重命名项目根目录（5分钟）✅

```bash
# ⚠️ 这一步最后做！
cd /home/xiaodong/文档/
mv stardust stardust

# 验证
cd stardust
pwd  # 应该显示 /home/xiaodong/文档/stardust
```

---

### 阶段9: 编译验证（30分钟）✅

#### 9.1 清理旧构建产物
```bash
cd /home/xiaodong/文档/stardust

# 清理Cargo缓存
cargo clean

# 清理前端node_modules（可选）
# rm -rf stardust-dapp/node_modules
# rm -rf stardust-governance/node_modules
```

#### 9.2 编译Runtime
```bash
cd /home/xiaodong/文档/stardust
cargo check -p stardust-runtime
```

**预期输出**: ✅ Checking stardust-runtime ... Finished

**可能的错误**:
```
❌ error: package `stardust-runtime` not found
解决: 检查Cargo.toml中是否还有未替换的stardust引用

❌ error: unresolved import `pallet_memo_xxx`
解决: 检查runtime/src/configs/mod.rs中的use语句

❌ error: no pallet in scope named `StarDust`
解决: 检查construct_runtime!宏中的pallet类型名称
```

#### 9.3 编译节点
```bash
cargo build --release -p stardust-node
```

**预期输出**: ✅ Compiling stardust-node ... Finished

#### 9.4 编译前端
```bash
cd stardust-dapp
npm install  # 如果清理了node_modules
npm run build
```

**预期输出**: ✅ Build completed

---

### 阶段10: 功能测试（30分钟）✅

#### 10.1 启动节点
```bash
cd /home/xiaodong/文档/stardust
./target/release/stardust-node --dev --tmp
```

**验证**:
- ✅ 节点启动成功
- ✅ 链ID显示为 "stardust"
- ✅ 区块正常产生

#### 10.2 启动前端
```bash
cd stardust-dapp
npm run dev
```

**验证**:
- ✅ 前端正常启动
- ✅ 页面标题显示 "Stardust"
- ✅ 代币显示为 "DUST"
- ✅ 可以连接到节点

#### 10.3 基础功能测试
```
1. 连接钱包 ✅
2. 查看余额（显示DUST） ✅
3. 发起一笔转账 ✅
4. 检查Polkadot.js Apps
   - 查看链上数据
   - 确认pallet名称正确
```

---

## 📋 完整替换清单

### 🔴 必须替换的内容

| 原内容 | 新内容 | 位置 | 优先级 |
|--------|--------|------|--------|
| `stardust-node` | `stardust-node` | Cargo.toml | P0 |
| `stardust-runtime` | `stardust-runtime` | Cargo.toml | P0 |
| `stardust-dapp` | `stardust-dapp` | package.json | P0 |
| `pallet-stardust-park` | `pallet-stardust-park` | Cargo.toml | P0 |
| `pallet-stardust-grave` | `pallet-stardust-grave` | Cargo.toml | P0 |
| `pallet-stardust-pet` | `pallet-stardust-pet` | Cargo.toml | P0 |
| `pallet-stardust-ipfs` | `pallet-stardust-ipfs` | Cargo.toml | P0 |
| `pallet-stardust-appeals` | `pallet-stardust-appeals` | Cargo.toml | P0 |
| `pallet-stardust-referrals` | `pallet-stardust-referrals` | Cargo.toml | P0 |
| `pallet_memo_park` | `pallet_stardust_park` | *.rs | P0 |
| `pallet_memo_grave` | `pallet_stardust_grave` | *.rs | P0 |
| `pallet_memo_pet` | `pallet_stardust_pet` | *.rs | P0 |
| `pallet_memo_ipfs` | `pallet_stardust_ipfs` | *.rs | P0 |
| `pallet_memo_appeals` | `pallet_stardust_appeals` | *.rs | P0 |
| `pallet_memo_referrals` | `pallet_stardust_referrals` | *.rs | P0 |
| `id: "stardust"` | `id: "stardust"` | chain_spec.rs | P0 |
| `protocol_id: "stardust"` | `protocol_id: "stardust"` | chain_spec.rs | P0 |

### 🟡 建议替换的内容

| 原内容 | 新内容 | 位置 | 优先级 |
|--------|--------|------|--------|
| `Stardust` | `Stardust` | 注释、文档 | P1 |
| `MEMO` (代币) | `DUST` | 注释、UI文本 | P1 |
| `10 MEMO` | `10 DUST` | 注释 | P1 |
| `1000 MEMO` | `1000 DUST` | 注释 | P1 |
| `<title>Stardust</title>` | `<title>Stardust</title>` | index.html | P1 |

### 🟢 可选替换的内容

| 原内容 | 新内容 | 说明 | 优先级 |
|--------|--------|------|--------|
| `memo_amount` | `dust_amount` | API变量名（可保持） | P2 |
| `MemoAmount` | `DustAmount` | 类型名（可保持） | P2 |
| `releaseMemo` | `releaseDust` | 函数名（可保持） | P2 |

---

## ⚠️ 风险和注意事项

### 🔴 高风险操作
1. **直接重命名根目录**
   - ⚠️ 会导致Git历史路径变化
   - 建议: 先完成所有内部修改，最后重命名根目录

2. **批量sed替换**
   - ⚠️ 可能误替换（如变量名、注释中的无关内容）
   - 建议: 先在小范围测试，或使用IDE的重构功能

3. **前端API变量名**
   - ⚠️ 修改API变量名会破坏现有代码
   - 建议: 保持API层变量名不变，只改UI显示文本

### 🟡 中等风险
1. **Pallet名称变化**
   - ⚠️ 会导致链上数据路径变化
   - 影响: 如果已有链上数据，需要迁移
   - 建议: 如果是新链，无影响；如果是已运行的链，谨慎操作

2. **代币名称**
   - ⚠️ 前端显示DUST，但链上仍是原生代币
   - 影响: 不影响功能，只是显示名称
   - 建议: 统一所有UI文本

### 🟢 低风险
1. **文档更新**
   - 影响: 无功能影响
   - 建议: 可以逐步更新

2. **注释更新**
   - 影响: 无功能影响
   - 建议: 可以逐步更新

---

## 🧪 验证清单

### 编译验证
- [ ] `cargo check -p stardust-runtime` 通过
- [ ] `cargo check -p stardust-node` 通过
- [ ] `cargo build --release` 通过
- [ ] `cd stardust-dapp && npm run build` 通过
- [ ] 无任何编译警告（关于stardust的）

### 功能验证
- [ ] 节点启动成功，链ID为"stardust"
- [ ] 前端启动成功，标题显示"Stardust"
- [ ] Polkadot.js Apps可以连接
- [ ] 代币显示为"DUST"
- [ ] 转账功能正常
- [ ] OTC订单功能正常
- [ ] 供奉功能正常
- [ ] 做市商功能正常

### 文档验证
- [ ] README.md更新完毕
- [ ] docs/目录下所有文档更新
- [ ] package.json中的描述更新
- [ ] 无遗漏的"stardust"或"MEMO"引用

### Git验证
- [ ] 所有更改已提交
- [ ] 创建重命名标签
- [ ] 推送到远程仓库（如果有）

---

## 🔄 回滚方案

如果重命名失败，可以快速回滚：

### 方案1: 使用Git
```bash
cd /home/xiaodong/文档/stardust
git checkout before-rename-to-stardust  # 回到重命名前的标签
```

### 方案2: 使用备份
```bash
cd /home/xiaodong/文档/
rm -rf stardust  # 删除失败的版本
tar -xzf stardust-backup-YYYYMMDD.tar.gz  # 恢复备份
```

---

## 📊 工作量估算

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 准备工作（备份、分支） | 5分钟 |
| 2 | 重命名Pallet目录 | 15分钟 |
| 3 | 更新Workspace配置 | 10分钟 |
| 4 | 更新Runtime代码 | 30分钟 |
| 5 | 全局代码替换 | 30分钟 |
| 6 | 更新前端项目 | 1小时 |
| 7 | 更新文档 | 30分钟 |
| 8 | 重命名根目录 | 5分钟 |
| 9 | 编译验证 | 30分钟 |
| 10 | 功能测试 | 30分钟 |
| **总计** | - | **4-6小时** |

---

## 💡 实施建议

### 推荐执行顺序
1. ✅ **先做准备工作**（备份、分支）
2. ✅ **从内到外修改**（Pallet → Runtime → Node → Frontend）
3. ✅ **边改边验证**（每个阶段编译一次）
4. ✅ **最后重命名根目录**
5. ✅ **完整测试**

### 使用自动化工具
```bash
# 可以编写一个重命名脚本
#!/bin/bash
# rename-to-stardust.sh

set -e  # 遇到错误立即退出

echo "🔄 开始重命名项目..."

# 阶段1: 备份
echo "📦 创建备份..."
git tag before-rename-to-stardust

# 阶段2: 重命名Pallet
echo "📂 重命名Pallet目录..."
# ... (脚本内容)

# 阶段3-10: ...

echo "✅ 重命名完成！"
```

### 团队协作
如果是团队项目：
1. 📢 **提前通知团队**（避免冲突）
2. 🔒 **锁定主分支**（防止其他人提交）
3. 🎯 **选择低峰时段**（减少影响）
4. 📝 **记录详细日志**（便于回溯）

---

## 📝 最终检查清单

### 编译检查 ✅
- [ ] Runtime编译通过
- [ ] Node编译通过
- [ ] 前端编译通过
- [ ] 无遗留警告

### 功能检查 ✅
- [ ] 节点启动正常
- [ ] 前端连接正常
- [ ] 核心功能可用
- [ ] UI显示正确

### 代码检查 ✅
- [ ] 无"stardust"残留（除文档说明）
- [ ] 无"MEMO"残留（除API变量名）
- [ ] Pallet名称全部更新
- [ ] 包名全部更新

### 文档检查 ✅
- [ ] README更新
- [ ] docs/更新
- [ ] package.json更新
- [ ] 注释更新

---

**🎯 准备好开始重命名了吗？**

建议执行流程：
1. 我先帮您创建备份和分支
2. 然后逐步执行重命名（边改边验证）
3. 每个阶段完成后确认无误再继续
4. 最后完整测试

**请告诉我：**
- ✅ **立即开始重命名**（我带您一步步执行）
- 🔍 **先查看某个具体步骤的详细说明**
- 🤔 **还有疑问需要解答**

---

**📅 方案生成时间**: 2025-10-29  
**✍️ 方案作者**: AI Assistant  
**🏷️ 标签**: `项目重命名` `stardust-to-stardust` `MEMO-to-DUST` `重构`

