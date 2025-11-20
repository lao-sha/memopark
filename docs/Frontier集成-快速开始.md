# Frontier 集成快速开始指南

本文档提供 Frontier 集成的快速启动步骤，适合开发者快速上手。

---

## 一、前置检查

### 1.1 确认环境

```bash
# 检查 Rust 版本（需要 1.75+）
rustc --version

# 检查 Node.js 版本（需要 18+）
node --version

# 检查可用磁盘空间（至少 50 GB）
df -h

# 检查项目状态
cd /home/xiaodong/文档/stardust
git status
```

### 1.2 创建功能分支

```bash
# 基于 main 分支创建 frontier 集成分支
git checkout -b feature/frontier-integration

# 推送到远程
git push -u origin feature/frontier-integration
```

---

## 二、依赖添加（30 分钟）

### 2.1 修改工作区 Cargo.toml

```bash
# 编辑文件
vim Cargo.toml
```

在 `[workspace.dependencies]` 部分添加：

```toml
# Frontier Core Pallets
pallet-evm = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
pallet-ethereum = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
pallet-base-fee = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
pallet-dynamic-fee = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }

# Frontier Primitives
fp-evm = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
fp-rpc = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
fp-self-contained = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }

# Frontier Client (仅 Node 端需要)
fc-consensus = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-db = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-mapping-sync = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-rpc = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-rpc-core = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-storage = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }

# EVM 核心库
evm = { version = "0.41.1", default-features = false }
```

### 2.2 修改 Runtime Cargo.toml

```bash
vim runtime/Cargo.toml
```

在 `[dependencies]` 添加：

```toml
# Frontier
pallet-evm = { workspace = true }
pallet-ethereum = { workspace = true }
pallet-base-fee = { workspace = true }
pallet-dynamic-fee = { workspace = true }
fp-evm = { workspace = true }
fp-rpc = { workspace = true }
fp-self-contained = { workspace = true }
evm = { version = "0.41.1", default-features = false, features = ["with-codec"] }
```

在 `[features]` 的 `std` 数组添加：

```toml
std = [
    # ... 现有配置 ...
    "pallet-evm/std",
    "pallet-ethereum/std",
    "pallet-base-fee/std",
    "pallet-dynamic-fee/std",
    "fp-evm/std",
    "fp-rpc/std",
    "fp-self-contained/std",
    "evm/std",
]
```

### 2.3 下载依赖

```bash
# 更新 Cargo.lock（首次会较慢，约 10-15 分钟）
cargo update

# 检查依赖
cargo tree | grep frontier
```

---

## 三、Runtime 配置（1 小时）

### 3.1 创建 EVM 配置文件

```bash
# 创建配置目录（如不存在）
mkdir -p runtime/src/configs

# 创建 EVM 配置文件
touch runtime/src/configs/evm.rs
```

**将以下内容复制到 `runtime/src/configs/evm.rs`**:

<details>
<summary>点击展开完整代码（约 200 行）</summary>

```rust
use crate::*;
use frame_support::parameter_types;
use pallet_evm::{EnsureAddressNever, EnsureAddressRoot, HashedAddressMapping};
use sp_core::{H160, U256};
use sp_runtime::{traits::BlakeTwo256, Permill};

// Chain ID 配置
parameter_types! {
    pub const ChainId: u64 = 8888;  // 🔴 主网上线前需修改
}

// Gas 限制配置
parameter_types! {
    pub BlockGasLimit: U256 = U256::from(15_000_000);
    pub WeightPerGas: frame_support::weights::Weight = 
        frame_support::weights::Weight::from_parts(20_000, 0);
    pub GasLimitPovSizeRatio: u64 = 4;
}

// 预编译合约
parameter_types! {
    pub PrecompilesValue: Precompiles = Precompiles;
}

pub struct Precompiles;

impl pallet_evm::PrecompileSet for Precompiles {
    fn execute(&self, handle: &mut impl pallet_evm::PrecompileHandle) 
        -> Option<pallet_evm::PrecompileResult> 
    {
        use pallet_evm::precompiles::*;
        
        match handle.code_address() {
            a if a == H160::from_low_u64_be(1) => Some(ECRecover::execute(handle)),
            a if a == H160::from_low_u64_be(2) => Some(Sha256::execute(handle)),
            a if a == H160::from_low_u64_be(3) => Some(Ripemd160::execute(handle)),
            a if a == H160::from_low_u64_be(4) => Some(Identity::execute(handle)),
            a if a == H160::from_low_u64_be(5) => Some(Modexp::execute(handle)),
            _ => None,
        }
    }

    fn is_precompile(&self, address: H160, _gas: u64) -> pallet_evm::IsPrecompileResult {
        let addr = address.to_low_u64_be();
        pallet_evm::IsPrecompileResult::Answer {
            is_precompile: (1..=9).contains(&addr),
            extra_cost: 0,
        }
    }
}

// EVM Pallet 配置
impl pallet_evm::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type FeeCalculator = BaseFee;
    type GasWeightMapping = pallet_evm::FixedGasWeightMapping<Self>;
    type BlockHashMapping = pallet_ethereum::EthereumBlockHashMapping<Self>;
    type CallOrigin = EnsureAddressRoot<AccountId>;
    type WithdrawOrigin = EnsureAddressNever<AccountId>;
    type AddressMapping = HashedAddressMapping<BlakeTwo256>;
    type Currency = Balances;
    type PrecompilesType = Precompiles;
    type PrecompilesValue = PrecompilesValue;
    type ChainId = ChainId;
    type Runner = pallet_evm::runner::stack::Runner<Self>;
    type OnChargeTransaction = ();
    type FindAuthor = ();
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type BlockGasLimit = BlockGasLimit;
    type WeightPerGas = WeightPerGas;
    type Timestamp = Timestamp;
    type WeightInfo = pallet_evm::weights::SubstrateWeight<Self>;
    type SuicideQuickClearLimit = frame_support::traits::ConstU32<0>;
}

// Ethereum Pallet 配置
impl pallet_ethereum::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StateRoot = pallet_ethereum::IntermediateStateRoot<Self>;
    type PostLogContent = ();
    type ExtraDataLength = frame_support::traits::ConstU32<30>;
}

// BaseFee 配置
pub struct BaseFeeThreshold;

impl pallet_base_fee::BaseFeeThreshold for BaseFeeThreshold {
    fn lower() -> Permill { Permill::from_parts(125_000) }
    fn ideal() -> Permill { Permill::from_parts(500_000) }
    fn upper() -> Permill { Permill::from_parts(875_000) }
}

impl pallet_base_fee::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Threshold = BaseFeeThreshold;
    type DefaultBaseFeePerGas = frame_support::traits::ConstU256<1_000_000_000>;
    type IsActive = ();
}

// DynamicFee 配置
impl pallet_dynamic_fee::Config for Runtime {
    type MinGasPriceBoundDivisor = frame_support::traits::ConstU32<1024>;
}
```

</details>

### 3.2 修改 Runtime 主文件

```bash
vim runtime/src/lib.rs
```

**在文件顶部添加 import**:

```rust
// 在 extern crate alloc; 之后添加
use fp_rpc::TransactionStatus;
```

**在 `pub mod configs` 中添加**:

```rust
pub mod configs {
    pub mod system;
    pub mod assets;
    pub mod evm;  // 🆕 新增
    // ... 其他模块
}

// 使用 EVM 配置
pub use configs::evm::*;
```

**在 `construct_runtime!` 宏中添加**:

```rust
#[runtime::pallet_index(100)]
pub type EVM = pallet_evm;

#[runtime::pallet_index(101)]
pub type Ethereum = pallet_ethereum;

#[runtime::pallet_index(102)]
pub type BaseFee = pallet_base_fee;

#[runtime::pallet_index(103)]
pub type DynamicFee = pallet_dynamic_fee;
```

### 3.3 编译测试

```bash
# 清理缓存（可选）
cargo clean

# 检查配置
cargo check --release -p stardust-runtime

# 完整编译（预计 20-40 分钟）
cargo build --release -p stardust-runtime
```

**预期输出**:

```
   Compiling pallet-evm v6.0.0
   Compiling pallet-ethereum v4.0.0
   Compiling pallet-base-fee v1.0.0
   ...
   Finished release [optimized] target(s) in 28m 34s
```

---

## 四、Node 端配置（30 分钟）

### 4.1 修改 Node Cargo.toml

```bash
vim node/Cargo.toml
```

在 `[dependencies]` 添加：

```toml
# Frontier Client
fc-consensus = { workspace = true }
fc-db = { workspace = true }
fc-mapping-sync = { workspace = true }
fc-rpc = { workspace = true }
fc-rpc-core = { workspace = true }
fc-storage = { workspace = true }

# EVM 工具
ethers = "2.0"
```

### 4.2 编译 Node

```bash
cargo build --release -p stardust-node
```

---

## 五、启动测试（15 分钟）

### 5.1 启动开发节点

```bash
# 清理旧数据
rm -rf /tmp/stardust-dev

# 启动节点
./target/release/stardust-node \
  --dev \
  --tmp \
  --rpc-port 9944 \
  --rpc-cors all \
  --rpc-methods=unsafe
```

### 5.2 验证 Substrate RPC

```bash
# 测试 Substrate RPC
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"system_name",
    "params":[],
    "id":1
  }'

# 预期返回: {"jsonrpc":"2.0","result":"stardust-node","id":1}
```

### 5.3 连接 Polkadot.js Apps

1. 打开 https://polkadot.js.org/apps/
2. 连接到 `ws://localhost:9944`
3. 检查 Developer > Chain State > EVM
4. 应该看到 `EVM` pallet 已启用

---

## 六、常见问题排查

### 问题 1: 编译失败 - "no method named `execute` found"

**原因**: 预编译合约接口不匹配

**解决**:

```bash
# 检查 Frontier 版本
cargo tree | grep frontier

# 确保使用 polkadot-v1.18.9 分支
```

### 问题 2: 节点启动失败 - "missing pallet EVM"

**原因**: Runtime 未正确编译

**解决**:

```bash
# 强制重新编译 Runtime
cargo clean -p stardust-runtime
cargo build --release -p stardust-runtime

# 检查 WASM
ls target/release/wbuild/stardust-runtime/
```

### 问题 3: RPC 调用失败 - "Method not found"

**原因**: EVM RPC 未启动

**解决**: 当前阶段正常，Phase 2 会添加 EVM RPC

---

## 七、下一步

✅ **完成 Phase 1 基础集成**

接下来可以选择：

1. **Phase 2**: 开发预编译合约
2. **Phase 3**: 前端集成 MetaMask
3. **测试**: 部署测试合约

---

## 八、回滚方案

如遇到严重问题，可回滚到集成前：

```bash
# 切换回主分支
git checkout main

# 删除功能分支
git branch -D feature/frontier-integration

# 重新开始
git checkout -b feature/frontier-integration-v2
```

---

**需要帮助？**

- 查看完整方案: `docs/Frontier集成方案.md`
- GitHub Issues: [项目地址]
- 联系团队: [团队联系方式]

