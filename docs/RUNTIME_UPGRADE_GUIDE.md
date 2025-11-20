# 链上 Runtime 升级指南

## 概述

本文档说明如何对 Stardust 区块链进行链上 runtime 代码升级（forkless upgrade）。

## 当前 Runtime 版本

- **spec_version**: 102
- **spec_name**: stardust-runtime
- **编译时间**: 2025-11-19

## 升级步骤

### 1. 编译新的 Runtime

```bash
# 编译 runtime wasm
cargo build --release -p stardust-runtime

# 检查编译结果
ls -lh target/release/wbuild/stardust-runtime/stardust_runtime.compact.compressed.wasm
```

### 2. 验证版本号

确保在 `runtime/src/lib.rs` 中 `spec_version` 已递增：

```rust
pub const VERSION: RuntimeVersion = RuntimeVersion {
    spec_version: 102,  // ⬅️ 升级时必须递增
    // ...
};
```

### 3. 执行升级

#### 方法一：使用自动化脚本（推荐）

```bash
# 确保节点正在运行
./target/release/solochain-template-node --dev

# 运行升级脚本
node scripts/upgrade-runtime.js
```

#### 方法二：通过 Polkadot-JS Apps 界面

1. 打开 https://polkadot.js.org/apps/
2. 连接到本地节点：`ws://localhost:9944`
3. 进入 **Developer → Extrinsics**
4. 选择 **sudo** pallet
5. 调用 `sudo(sudoUncheckedWeight(call, weight))`
6. 内部选择 **system.setCode(code)**
7. 上传 `stardust_runtime.compact.compressed.wasm` 文件
8. weight 填写 `0`
9. 提交交易

### 4. 验证升级

```bash
# 方法1: 查看日志
# 应该看到 "Runtime version upgraded" 消息

# 方法2: 查询新版本
# 在 Polkadot-JS Apps 中: Developer → Chain state → runtimeVersion()
```

## 升级注意事项

### ✅ 升级前检查清单

- [ ] `spec_version` 已递增
- [ ] 代码编译通过：`cargo build --release`
- [ ] 测试通过：`cargo test --workspace`
- [ ] 已备份链状态（可选）
- [ ] 了解存储迁移需求（如有）

### ⚠️ 重要提示

1. **spec_version 必须递增**
   - 节点通过 `spec_version` 识别新 runtime
   - 如果不递增，节点会拒绝升级

2. **存储迁移**
   - 如果修改了存储结构，必须提供迁移逻辑
   - 使用 `frame_support::migrations`

3. **无需重启节点**
   - Substrate 支持热升级
   - 升级后节点会自动切换到新 runtime

4. **开发环境 vs 生产环境**
   - 开发环境：使用 sudo 直接升级
   - 生产环境：应通过链上治理投票升级

## 存储迁移示例

如果修改了存储结构，需要添加迁移代码：

```rust
// runtime/src/lib.rs

pub mod migrations {
    use super::*;
    use frame_support::traits::OnRuntimeUpgrade;

    pub struct MigrateToV103;
    impl OnRuntimeUpgrade for MigrateToV103 {
        fn on_runtime_upgrade() -> Weight {
            // 迁移逻辑
            log::info!("🔄 执行存储迁移: V102 -> V103");

            // 返回消耗的 weight
            Weight::zero()
        }
    }
}

// 在 Executive 中使用
pub type Executive = frame_executive::Executive<
    Runtime,
    Block,
    frame_system::ChainContext<Runtime>,
    Runtime,
    AllPalletsWithSystem,
    migrations::MigrateToV103, // ⬅️ 添加迁移
>;
```

## 回滚方案

如果升级后出现问题：

1. **立即回滚**（开发环境）
   ```bash
   # 编译旧版本
   git checkout <old-commit>
   cargo build --release -p stardust-runtime

   # 再次升级（回到旧版本）
   node scripts/upgrade-runtime.js
   ```

2. **清除链状态重启**（最后手段）
   ```bash
   ./target/release/solochain-template-node purge-chain --dev
   ./target/release/solochain-template-node --dev
   ```

## 升级历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 102 | 2025-11-19 | 修复 pallet-affiliate、pallet-membership 类型兼容性 |
| 101 | 之前 | 基础版本 |

## 常见问题

### Q: 升级后节点崩溃？
A: 检查存储迁移是否正确，回滚到旧版本

### Q: 如何查看当前 runtime 版本？
A:
```javascript
const version = await api.rpc.state.getRuntimeVersion();
console.log(version.specVersion.toNumber());
```

### Q: 能否跳过版本升级？
A: 不建议。应该按顺序升级，确保存储迁移正确执行

## 相关链接

- [Substrate Runtime 升级文档](https://docs.substrate.io/build/upgrade/)
- [Polkadot-JS Apps](https://polkadot.js.org/apps/)
