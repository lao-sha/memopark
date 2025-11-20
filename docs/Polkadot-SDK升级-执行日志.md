# Polkadot-SDK 升级执行日志

## 升级信息

- **升级日期**: 2025-11-03
- **原版本**: `polkadot-v1.18.9` (tag)
- **目标版本**: `stable2506` (branch)
- **升级原因**: 为集成 Frontier 以太坊兼容层，需要匹配 Frontier 的 stable2506 分支
- **Git 分支**: `upgrade-polkadot-sdk-stable2506`

## 升级范围

### 1. 核心框架依赖
- `polkadot-sdk` 所有 crate（约 40+ 个依赖项）
- 从 `tag = "polkadot-v1.18.9"` → `branch = "stable2506"`

### 2. 新增 Frontier 依赖
- `pallet-evm` - EVM 虚拟机
- `pallet-ethereum` - 以太坊兼容层
- `pallet-base-fee` - EIP-1559 基础费用
- `pallet-dynamic-fee` - 动态费用调整
- `fp-evm`, `fp-rpc`, `fp-self-contained` - Frontier 原语
- `fc-*` - Frontier 客户端组件
- `evm` - EVM 核心库

## 执行步骤

### Phase 1: 依赖版本更新 ✅

#### 1.1 创建 Git 分支
```bash
git checkout -b upgrade-polkadot-sdk-stable2506
```
**状态**: ✅ 完成

#### 1.2 更新根 Cargo.toml
- 替换所有 `tag = "polkadot-v1.18.9"` → `branch = "stable2506"`
- 启用 Frontier 依赖（取消注释）
**状态**: 进行中...

---

## 兼容性变更记录

### Breaking Changes

#### 1. RuntimeEvent API 重大变更 (PR #7229)

**变更内容**：
- `RuntimeEvent` 不再需要在 pallet Config trait 中显式声明
- 自动继承 `frame_system::Config<RuntimeEvent: From<Event<Self>>>`

**旧写法**：
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    // ... other types
}
```

**新写法**：
```rust
#[pallet::config]
pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
    // ... other types (无需声明 RuntimeEvent)
}
```

**影响的 Pallet**：
- ✅ pallet-credit
- ✅ pallet-stardust-grave  
- ✅ pallet-bridge
- ✅ pallet-membership
- ✅ pallet-maker
- ✅ pallet-otc-order

**Runtime 配置变更**：
- 移除所有 `type RuntimeEvent = RuntimeEvent;` 设置
- 这些 pallet 的事件自动绑定到 runtime

### Deprecated APIs

#### 1. 依赖源冲突检测加强

**问题**：Cargo 现在严格检查依赖源的一致性
**解决方案**：
- `pallet-credit/Cargo.toml`: 统一使用 `workspace = true` 引用 `pallet-timestamp`
- 避免在 dependencies 和 dev-dependencies 中使用不同的依赖源

### New Features

#### 1. Frontier 以太坊兼容层集成

**新增依赖**：
- `pallet-evm` v6.0.0-dev - EVM 虚拟机
- `pallet-ethereum` v4.0.0-dev - 以太坊兼容层
- `pallet-base-fee` v1.0.0 - EIP-1559 基础费用
- `pallet-dynamic-fee` v4.0.0-dev - 动态费用调整
- 所有 `fp-*` 和 `fc-*` 原语和客户端组件

**状态**：依赖已启用，配置文件已创建 (`runtime/src/configs/evm.rs`)，暂时注释未集成到 runtime

#### 2. Polkadot-SDK 版本信息

**版本变更**：
- 原版本: `polkadot-v1.18.9` (tag #52f4a08f)
- 新版本: `stable2506` (branch #3c88ea39)

**重要变更**：
- `sp-runtime` v38.0.0 → v42.0.0
- `frame-support` v36.0.0 → v41.0.0
- `frame-system` v36.0.0 → v41.0.0
- 所有 pallet 和原语同步升级到 stable2506

---

## 问题与解决方案

### 问题 1: Frontier 版本兼容性

- **现象**: `error: failed to find branch polkadot-v1.18.9` in Frontier repository
- **原因**: Frontier 仓库没有 `polkadot-v1.18.9` 对应的分支，只有 `stable2506`
- **解决方案**: 升级整个 polkadot-sdk 到 `stable2506` 分支以匹配 Frontier

### 问题 2: pallet-timestamp 依赖源冲突

- **现象**: `Dependency 'pallet-timestamp' has different source paths`
- **原因**: `pallet-credit` 在 dependencies 中使用 git 源，在 dev-dependencies 中使用 workspace 源
- **解决方案**: 统一使用 `workspace = true` 引用依赖

### 问题 3: RuntimeEvent 废弃警告

- **现象**: `use of deprecated constant 'pallet::RuntimeEvent::_w'`
- **原因**: stable2506 重构了 RuntimeEvent API，不再需要显式声明
- **解决方案**: 
  - 修改 pallet Config trait: `pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> { }`
  - 从 runtime 配置中移除 `type RuntimeEvent = RuntimeEvent;`

### 问题 4: Pallet 编译错误

- **现象**: 多个 pallet 报告 "type RuntimeEvent is not a member of trait"
- **原因**: runtime 配置仍在设置已删除的 RuntimeEvent 关联类型
- **解决方案**: 从以下 pallet 的 runtime 配置中移除 RuntimeEvent 设置：
  - pallet-credit
  - pallet-stardust-grave
  - pallet-bridge
  - pallet-membership
  - pallet-maker
  - pallet-otc-order

---

## 验证清单

- [x] 根 Cargo.toml 依赖更新完成
- [x] runtime/Cargo.toml 依赖更新完成
- [x] node/Cargo.toml 依赖更新完成
- [x] 所有 pallet Cargo.toml 检查完成
- [x] Frontier 依赖启用并配置正确
- [x] cargo update 执行成功
- [x] cargo check 通过
- [x] cargo build 通过
- [x] cargo build --release 通过 ✅
- [ ] 节点启动测试通过
- [ ] 基本交易测试通过
- [ ] 前端 API 兼容性测试通过

---

## 回滚方案

如果升级失败，执行以下步骤回滚：

```bash
# 1. 切换回主分支
git checkout main

# 2. 删除升级分支
git branch -D upgrade-polkadot-sdk-stable2506

# 3. 清理构建缓存
cargo clean
rm -rf target/
```

---

## 参考资料

- Polkadot SDK stable2506: https://github.com/paritytech/polkadot-sdk/tree/stable2506
- Frontier stable2506: https://github.com/polkadot-evm/frontier/tree/stable2506
- Frontier 集成方案: ./Frontier集成方案.md
- 版本兼容性报告: ./Frontier集成-Phase1-版本兼容性报告.md

