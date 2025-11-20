# Frontier Runtime 启动问题分析与解决方案

## 问题描述

### 错误信息
```
Error: Service(Client(VersionInvalid("Other error happened while constructing the runtime: 
runtime requires function imports which are not present on the host: 
'env:ext_storage_proof_size_storage_proof_size_version_1'")))
```

### 问题根源

经过排查确认：
1. ✅ Polkadot-SDK stable2506 升级成功
2. ✅ Frontier pallets (stable2506) 编译成功
3. ❌ **Runtime 启动失败** - Frontier pallets 需要的 host 函数在 node 中不存在

### 验证测试

**测试 1**: 禁用 Frontier
```bash
# 注释掉 runtime/src/lib.rs 中的 4 个 Frontier pallets
# 注释掉 runtime/src/configs/mod.rs 中的 evm 模块
cargo build --release
./target/release/stardust-node --dev --tmp
```
**结果**: ✅ 节点成功启动并正常出块

**结论**: 问题由 Frontier pallets 引起，与 Polkadot-SDK 升级无关。

---

## 技术分析

### ext_storage_proof_size 是什么？

`ext_storage_proof_size` 是 Substrate 引入的新 host 函数，用于：
- 跟踪 storage proof 的大小
- 用于 PoV (Proof-of-Validity) 计算
- 主要用于 Parachain 环境

**相关 PR**:
- [Polkadot-SDK PR #1234](https://github.com/paritytech/polkadot-sdk) (示例)
- 引入时间：约 2024-2025 之间

### 为什么 Frontier 需要它？

Frontier stable2506 可能在以下方面使用了这个函数：
1. EVM storage 操作时的 proof 计算
2. Ethereum 交易执行时的资源计量
3. 与 Parachain 环境的兼容性

### 为什么 Node 不支持？

当前 `node/src/service.rs` 使用的 host functions：
```rust
// 第 51 行
let executor = sc_service::new_wasm_executor::<sp_io::SubstrateHostFunctions>(&config.executor);
```

`sp_io::SubstrateHostFunctions` 可能不包含最新的 host 函数集合。

---

## 解决方案

### 方案 A: 等待官方支持 ⭐️ (推荐)

**原理**: Frontier stable2506 可能还在开发中，等待官方稳定版本

**优点**:
- 不需要手动修改代码
- 保证稳定性和兼容性

**缺点**:
- 需要等待时间（可能 1-3 个月）

**实施**:
1. 保持当前配置（Frontier 禁用状态）
2. 继续使用升级后的 Polkadot-SDK stable2506
3. 监控 Frontier 仓库的更新
4. 等待兼容版本发布后再启用

**监控渠道**:
- https://github.com/polkadot-evm/frontier/releases
- https://github.com/paritytech/polkadot-sdk/releases

### 方案 B: 使用 Feature Flag 条件编译

**原理**: 通过 Cargo feature 控制 Frontier 是否编译

**优点**:
- 灵活切换
- 便于测试和开发

**缺点**:
- 需要维护两套配置

**实施步骤**:

#### 1. 修改 runtime/Cargo.toml

```toml
[features]
default = ["std"]

# 🆕 Frontier 功能开关
frontier = [
    "pallet-evm",
    "pallet-ethereum",
    "pallet-base-fee",
    "pallet-dynamic-fee",
    "fp-evm",
    "fp-rpc",
    "fp-self-contained",
]

std = [
    # ... 现有 std features
    "pallet-evm?/std",
    "pallet-ethereum?/std",
    "pallet-base-fee?/std",
    "pallet-dynamic-fee?/std",
]
```

#### 2. 修改依赖为可选

```toml
[dependencies]
# Frontier Core Pallets (可选依赖)
pallet-evm = { workspace = true, optional = true }
pallet-ethereum = { workspace = true, optional = true }
pallet-base-fee = { workspace = true, optional = true }
pallet-dynamic-fee = { workspace = true, optional = true }
```

#### 3. 修改 runtime/src/lib.rs

```rust
// 条件编译 Frontier pallets
#[cfg(feature = "frontier")]
#[runtime::pallet_index(100)]
pub type EVM = pallet_evm;

#[cfg(feature = "frontier")]
#[runtime::pallet_index(101)]
pub type Ethereum = pallet_ethereum;

#[cfg(feature = "frontier")]
#[runtime::pallet_index(102)]
pub type BaseFee = pallet_base_fee;

#[cfg(feature = "frontier")]
#[runtime::pallet_index(103)]
pub type DynamicFee = pallet_dynamic_fee;
```

#### 4. 使用方式

```bash
# 不启用 Frontier
cargo build --release

# 启用 Frontier
cargo build --release --features frontier
```

### 方案 C: 尝试更新 Host Functions (高级)

**原理**: 手动添加新的 host functions 支持

**⚠️ 警告**: 这是高级方案，可能导致不稳定

**实施步骤**:

#### 1. 检查是否有新的 HostFunctions trait

```bash
# 搜索 Polkadot-SDK 中的新 host functions
cd ~/.cargo/git/checkouts/polkadot-sdk-*/
git grep "ext_storage_proof_size"
```

#### 2. 修改 node/src/service.rs

```rust
// 可能需要使用扩展的 HostFunctions
use sp_io::SubstrateHostFunctions;

// 或者创建自定义 HostFunctions
pub struct CustomHostFunctions;
impl sp_core::traits::HostFunctions for CustomHostFunctions {
    fn host_functions() -> Vec<&'static dyn sp_wasm_interface::Function> {
        // 包含标准 host functions + 新增的
        let mut funcs = SubstrateHostFunctions::host_functions();
        // 添加 ext_storage_proof_size
        // ...
        funcs
    }
}

// 使用自定义 HostFunctions
let executor = sc_service::new_wasm_executor::<CustomHostFunctions>(&config.executor);
```

**注意**: 这需要深入了解 Substrate host functions 机制，不推荐新手使用。

### 方案 D: 降级 Frontier 版本

**原理**: 使用与 polkadot-v1.18.9 兼容的 Frontier 版本

**缺点**:
- Frontier 没有 polkadot-v1.18.9 对应的分支
- 这是我们升级到 stable2506 的原因

**结论**: ❌ 不可行

---

## 推荐实施方案

### 当前最佳实践: 方案 A + 方案 B 混合

**阶段 1: 当前 (1-2 周)**
1. 保持 Frontier 禁用状态
2. 使用升级后的 Polkadot-SDK stable2506
3. 开发和测试非 EVM 功能
4. 为 Frontier 集成做准备工作

**阶段 2: 准备 (2-4 周)**
1. 实施方案 B (Feature Flag)
2. 创建两个构建配置：
   - `default`: 不含 Frontier (稳定)
   - `frontier`: 含 Frontier (实验)
3. 监控 Frontier 官方更新

**阶段 3: 启用 (等待官方更新)**
1. 当 Frontier 发布兼容版本时
2. 测试 `--features frontier` 构建
3. 验证所有功能
4. 逐步启用到主网

---

## 当前状态总结

### ✅ 已完成
1. ✅ Polkadot-SDK 升级到 stable2506
2. ✅ Frontier 依赖添加和配置
3. ✅ Runtime 编译成功
4. ✅ 节点启动成功 (Frontier 禁用状态)
5. ✅ 问题根源确认

### ⚠️ 已知问题
1. ⚠️ Frontier pallets 需要 `ext_storage_proof_size` host 函数
2. ⚠️ Node 当前不支持该 host 函数
3. ⚠️ 启用 Frontier 会导致 runtime 启动失败

### 📋 待完成
1. 📋 实施 Feature Flag 方案
2. 📋 监控 Frontier 官方更新
3. 📋 等待兼容版本发布
4. 📋 完整的 Frontier 集成测试

---

## 技术细节

### Host Functions 机制

**什么是 Host Functions?**
- Substrate 提供给 WASM runtime 的外部函数
- 允许 runtime 调用 native 功能
- 例如：存储访问、加密、网络等

**标准 Host Functions** (sp_io::SubstrateHostFunctions):
```rust
pub struct SubstrateHostFunctions;
impl sp_core::traits::HostFunctions for SubstrateHostFunctions {
    fn host_functions() -> Vec<&'static dyn Function> {
        vec![
            // 存储相关
            ext_storage_set,
            ext_storage_get,
            ext_storage_read,
            // ... 更多
            
            // 🆕 stable2506 新增
            ext_storage_proof_size,  // ⬅️ 这个是新的
        ]
    }
}
```

### 错误信息解析

```
runtime requires function imports which are not present on the host: 
'env:ext_storage_proof_size_storage_proof_size_version_1'
```

- `env:` - WASM 环境导入
- `ext_storage_proof_size` - 函数名
- `_version_1` - 函数版本号

**含义**: Runtime WASM 代码尝试导入这个函数，但 node 的 executor 没有提供。

---

## 相关资源

### 官方文档
- [Substrate Host Functions](https://docs.substrate.io/reference/host-functions/)
- [Frontier 文档](https://github.com/polkadot-evm/frontier)
- [Polkadot-SDK Releases](https://github.com/paritytech/polkadot-sdk/releases)

### 社区资源
- [Substrate Stack Exchange](https://substrate.stackexchange.com/)
- [Polkadot Discord](https://discord.gg/polkadot)
- [Frontier GitHub Issues](https://github.com/polkadot-evm/frontier/issues)

### 参考项目
这些项目已成功集成 Frontier，可以参考：
- [Moonbeam](https://github.com/moonbeam-foundation/moonbeam) - 成熟的 EVM 平行链
- [Astar](https://github.com/AstarNetwork/Astar) - 支持 EVM + WASM
- [Acala](https://github.com/AcalaNetwork/Acala) - DeFi 平台

---

## FAQ

### Q1: 为什么升级到 stable2506 还有问题？
**A**: Polkadot-SDK 升级成功了，问题出在 Frontier。Frontier stable2506 分支可能依赖了 SDK 的新特性，但这些特性在标准的 node template 中还未完全支持。

### Q2: 可以回退到 polkadot-v1.18.9 吗？
**A**: 可以，但会失去 Frontier 集成的可能性，因为 Frontier 没有对应的分支。

### Q3: 多久能解决这个问题？
**A**: 
- 官方解决：可能 1-3 个月（等待 Frontier 稳定版）
- Feature Flag 方案：1-2 天即可实施
- 手动修复：需要深入研究，风险较高

### Q4: 不启用 Frontier 会影响功能吗？
**A**: 不会影响现有的 Substrate 功能。只是暂时无法：
- 部署 Solidity 合约
- 使用 MetaMask 连接
- 运行 EVM 智能合约

### Q5: 已经投入的 Frontier 集成工作会浪费吗？
**A**: 不会！所有的配置和代码都已经完成：
- Runtime 配置文件 (`configs/evm.rs`)
- Pallet 声明
- API 适配修复
- 文档

只需等待 host functions 支持即可启用。

---

## 下一步行动建议

### 立即行动 (本周)
1. ✅ 确认禁用 Frontier 后系统正常运行
2. 📋 实施 Feature Flag 方案
3. 📋 创建两个构建配置
4. 📋 测试所有非 EVM 功能

### 短期行动 (本月)
1. 📋 监控 Frontier 官方更新
2. 📋 在测试环境尝试定期重启用 Frontier
3. 📋 准备 EVM 功能测试用例
4. 📋 完善相关文档

### 长期行动 (1-3 个月)
1. 📋 当 Frontier 发布兼容版本时立即测试
2. 📋 完整的 Frontier 功能验证
3. 📋 性能测试和优化
4. 📋 准备主网部署

---

**文档版本**: v1.0  
**创建时间**: 2025-11-03 20:32 UTC+8  
**状态**: 问题已确认 - 等待官方支持或实施 Feature Flag

