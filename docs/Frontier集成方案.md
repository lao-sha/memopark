# Stardust 项目 Frontier 集成方案

**版本**: v1.0.0  
**日期**: 2025-11-03  
**状态**: 待审核

---

## 一、项目现状分析

### 1.1 当前技术栈

- **Polkadot SDK**: v1.18.9
- **共识机制**: AURA + GRANDPA
- **出块时间**: 6秒
- **账户体系**: Substrate 原生（32字节 SS58 编码）
- **前端**: React 18 + TypeScript + Ant Design 5（Polkadot.js 集成）

### 1.2 现有 Pallet 生态

**核心业务模块**:
- `pallet-memorial` - 纪念馆系统
- `pallet-maker` - 做市商管理
- `pallet-otc-order` - OTC 订单
- `pallet-bridge` - DUST ↔ USDT 桥接
- `pallet-affiliate` - 联盟计酬
- `pallet-credit` - 信用系统

**治理与管理**:
- `pallet-collective` - 委员会治理
- `pallet-identity` - 身份认证
- `pallet-membership` - 会员管理

### 1.3 集成目标

✅ **支持以太坊智能合约**（Solidity/Vyper）  
✅ **兼容以太坊钱包**（MetaMask、WalletConnect）  
✅ **吸引以太坊开发者**社区  
✅ **保持 Substrate 原生功能**不受影响  
✅ **为未来跨链做准备**（Polkadot 生态互操作）

---

## 二、Frontier 架构设计

### 2.1 核心组件配置

```
┌─────────────────────────────────────────────────────┐
│                  Stardust Runtime                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐         ┌──────────────┐          │
│  │   Substrate  │         │   Frontier   │          │
│  │   Pallets    │◄───────►│   Pallets    │          │
│  │              │         │              │          │
│  │ • Memorial   │         │ • EVM        │          │
│  │ • Maker      │         │ • Ethereum   │          │
│  │ • Bridge     │         │ • BaseFee    │          │
│  │ • Affiliate  │         │ • Dynamic    │          │
│  └──────────────┘         └──────────────┘          │
│         │                        │                   │
│         └────────┬───────────────┘                   │
│                  ▼                                   │
│         ┌────────────────┐                           │
│         │  Account Layer │                           │
│         │  32B ↔ 20B     │                           │
│         └────────────────┘                           │
└─────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌────────────────┐      ┌────────────────┐
│  Substrate RPC │      │  Ethereum RPC  │
│  (Polkadot.js) │      │  (Web3/Ethers) │
└────────────────┘      └────────────────┘
```

### 2.2 双重账户映射策略

#### **策略 1: 哈希映射（推荐）**

```rust
// Substrate AccountId (32字节) -> Ethereum Address (20字节)
H160::from_slice(&blake2_256(&account_id)[0..20])

// 优点: 单向映射，安全性高
// 缺点: 无法从 Ethereum 地址反推 Substrate 账户
```

#### **策略 2: 双向绑定**

```rust
// 用户主动绑定 Substrate 账户与 Ethereum 地址
storage AccountToEth: map AccountId => Option<H160>;
storage EthToAccount: map H160 => Option<AccountId>;

// 优点: 灵活可控
// 缺点: 需要额外管理层
```

**建议**: 使用策略 1 + 策略 2 组合：
- 默认使用哈希映射
- 提供可选的显式绑定功能

---

## 三、技术实施方案

### 3.1 依赖添加

#### **工作区 Cargo.toml** (`/home/xiaodong/文档/stardust/Cargo.toml`)

```toml
[workspace.dependencies]
# Frontier Core
pallet-evm = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
pallet-ethereum = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
pallet-base-fee = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
pallet-dynamic-fee = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }

# Frontier Primitives
fp-evm = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
fp-rpc = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }
fp-self-contained = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9", default-features = false }

# Frontier Client (Node 端使用)
fc-consensus = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-db = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-mapping-sync = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-rpc = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-rpc-core = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
fc-storage = { git = "https://github.com/polkadot-evm/frontier.git", branch = "polkadot-v1.18.9" }
```

#### **Runtime Cargo.toml** (`runtime/Cargo.toml`)

```toml
[dependencies]
# Frontier Pallets
pallet-evm = { workspace = true }
pallet-ethereum = { workspace = true }
pallet-base-fee = { workspace = true }
pallet-dynamic-fee = { workspace = true }

# Frontier Primitives
fp-evm = { workspace = true }
fp-rpc = { workspace = true }
fp-self-contained = { workspace = true }

# EVM 工具
evm = { version = "0.41.1", default-features = false, features = ["with-codec"] }

[features]
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

#### **Node Cargo.toml** (`node/Cargo.toml`)

```toml
[dependencies]
# Frontier RPC
fc-consensus = { workspace = true }
fc-db = { workspace = true }
fc-mapping-sync = { workspace = true }
fc-rpc = { workspace = true }
fc-rpc-core = { workspace = true }
fc-storage = { workspace = true }
```

---

### 3.2 Runtime 配置

#### **3.2.1 EVM Pallet 配置**

在 `runtime/src/configs/mod.rs` 新建 `evm.rs`:

```rust
// runtime/src/configs/evm.rs

use crate::*;
use frame_support::{
    parameter_types,
    traits::{FindAuthor, OnFinalize, OnInitialize},
};
use pallet_evm::{
    AddressMapping, EnsureAddressNever, EnsureAddressRoot, HashedAddressMapping,
};
use sp_core::{H160, U256};
use sp_runtime::traits::BlakeTwo256;

/// 函数级中文注释：EVM Chain ID 配置
/// - 测试网建议使用非标准 Chain ID（避免与主流网络冲突）
/// - 主网需要在 https://chainlist.org 注册
parameter_types! {
    pub const ChainId: u64 = 8888;  // 🔴 TODO: 主网上线前修改
}

/// 函数级中文注释：EVM Gas 限制配置
/// - BlockGasLimit: 单个区块最大 Gas（15M = 约 300 笔简单转账）
/// - WeightPerGas: Substrate Weight 到 EVM Gas 的转换比例
parameter_types! {
    pub BlockGasLimit: U256 = U256::from(15_000_000);
    pub WeightPerGas: frame_support::weights::Weight = 
        frame_support::weights::Weight::from_parts(20_000, 0);
    pub GasLimitPovSizeRatio: u64 = 4;
}

/// 函数级中文注释：预编译合约基地址
/// - 0x01-0x09: EVM 标准预编译
/// - 0x400-0x4FF: Substrate 桥接预编译（自定义）
parameter_types! {
    pub PrecompilesValue: Precompiles = Precompiles::new();
}

/// 函数级中文注释：自定义预编译合约集合
pub struct Precompiles;

impl Precompiles {
    pub fn new() -> Self {
        Self
    }
}

impl pallet_evm::PrecompileSet for Precompiles {
    /// 函数级中文注释：执行预编译合约调用
    fn execute(&self, handle: &mut impl pallet_evm::PrecompileHandle) -> Option<pallet_evm::PrecompileResult> {
        match handle.code_address() {
            // 标准预编译 (0x01-0x09)
            a if a == H160::from_low_u64_be(1) => Some(pallet_evm::precompiles::ECRecover::execute(handle)),
            a if a == H160::from_low_u64_be(2) => Some(pallet_evm::precompiles::Sha256::execute(handle)),
            a if a == H160::from_low_u64_be(3) => Some(pallet_evm::precompiles::Ripemd160::execute(handle)),
            a if a == H160::from_low_u64_be(4) => Some(pallet_evm::precompiles::Identity::execute(handle)),
            a if a == H160::from_low_u64_be(5) => Some(pallet_evm::precompiles::Modexp::execute(handle)),
            
            // 🆕 自定义预编译: DUST 余额查询 (0x400)
            // a if a == H160::from_low_u64_be(0x400) => Some(DustPallet::execute(handle)),
            
            // 🆕 自定义预编译: Memorial 操作 (0x401)
            // a if a == H160::from_low_u64_be(0x401) => Some(MemorialPallet::execute(handle)),
            
            _ => None,
        }
    }

    /// 函数级中文注释：检查地址是否为预编译合约
    fn is_precompile(&self, address: H160, _gas: u64) -> pallet_evm::IsPrecompileResult {
        let addr = address.to_low_u64_be();
        pallet_evm::IsPrecompileResult::Answer {
            is_precompile: (1..=9).contains(&addr) || (0x400..=0x4FF).contains(&addr),
            extra_cost: 0,
        }
    }
}

/// 函数级中文注释：EVM Pallet 配置实现
impl pallet_evm::Config for Runtime {
    /// 函数级中文注释：EVM 事件类型
    type RuntimeEvent = RuntimeEvent;
    
    /// 函数级中文注释：费用计算器（使用 BaseFee pallet）
    type FeeCalculator = BaseFee;
    
    /// 函数级中文注释：Gas 到 Weight 的映射
    type GasWeightMapping = pallet_evm::FixedGasWeightMapping<Self>;
    
    /// 函数级中文注释：区块哈希映射（EVM 的 BLOCKHASH 操作码支持）
    type BlockHashMapping = pallet_ethereum::EthereumBlockHashMapping<Self>;
    
    /// 函数级中文注释：调用来源检查（Root 权限）
    type CallOrigin = EnsureAddressRoot<AccountId>;
    
    /// 函数级中文注释：提款权限（禁止任何提款）
    type WithdrawOrigin = EnsureAddressNever<AccountId>;
    
    /// 函数级中文注释：地址映射（Substrate 32B ↔ Ethereum 20B）
    type AddressMapping = HashedAddressMapping<BlakeTwo256>;
    
    /// 函数级中文注释：货币系统（使用 DUST 作为 Gas 费代币）
    type Currency = Balances;
    
    /// 函数级中文注释：预编译合约集合
    type PrecompilesType = Precompiles;
    type PrecompilesValue = PrecompilesValue;
    
    /// 函数级中文注释：Chain ID
    type ChainId = ChainId;
    
    /// 函数级中文注释：EVM 执行引擎
    type Runner = pallet_evm::runner::stack::Runner<Self>;
    
    /// 函数级中文注释：交易费用扣除处理
    type OnChargeTransaction = ();
    
    /// 函数级中文注释：区块作者查找（用于 coinbase）
    type FindAuthor = ();
    
    /// 函数级中文注释：Gas 限制配置
    type GasLimitPovSizeRatio = GasLimitPovSizeRatio;
    type BlockGasLimit = BlockGasLimit;
    type WeightPerGas = WeightPerGas;
    
    /// 函数级中文注释：Timestamp 提供者
    type Timestamp = Timestamp;
    
    /// 函数级中文注释：权重信息
    type WeightInfo = pallet_evm::weights::SubstrateWeight<Self>;
    
    /// 函数级中文注释：SuicideQuickClearLimit（合约自毁清理限制）
    type SuicideQuickClearLimit = frame_support::traits::ConstU32<0>;
}

/// 函数级中文注释：Ethereum Pallet 配置实现
impl pallet_ethereum::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StateRoot = pallet_ethereum::IntermediateStateRoot<Self>;
    type PostLogContent = ();
    type ExtraDataLength = frame_support::traits::ConstU32<30>;
}

/// 函数级中文注释：BaseFee Pallet 配置（EIP-1559 支持）
pub struct BaseFeeThreshold;
impl pallet_base_fee::BaseFeeThreshold for BaseFeeThreshold {
    fn lower() -> sp_runtime::Permill {
        sp_runtime::Permill::from_parts(125_000)  // -12.5%
    }
    fn ideal() -> sp_runtime::Permill {
        sp_runtime::Permill::from_parts(500_000)  // 50%
    }
    fn upper() -> sp_runtime::Permill {
        sp_runtime::Permill::from_parts(875_000)  // +12.5%
    }
}

impl pallet_base_fee::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Threshold = BaseFeeThreshold;
    type DefaultBaseFeePerGas = frame_support::traits::ConstU256<1_000_000_000>;  // 1 Gwei
    type IsActive = ();
}

/// 函数级中文注释：DynamicFee Pallet 配置（动态费用调整）
impl pallet_dynamic_fee::Config for Runtime {
    type MinGasPriceBoundDivisor = frame_support::traits::ConstU32<1024>;
}
```

#### **3.2.2 Runtime 主配置集成**

修改 `runtime/src/lib.rs`:

```rust
// runtime/src/lib.rs

// 在文件顶部添加
use fp_rpc::TransactionStatus;

// 在 construct_runtime! 宏中添加（建议 index 从 100 开始）
#[runtime::pallet_index(100)]
pub type EVM = pallet_evm;

#[runtime::pallet_index(101)]
pub type Ethereum = pallet_ethereum;

#[runtime::pallet_index(102)]
pub type BaseFee = pallet_base_fee;

#[runtime::pallet_index(103)]
pub type DynamicFee = pallet_dynamic_fee;

// 在 configs module 中引入
pub mod configs {
    pub mod system;
    pub mod assets;
    pub mod evm;  // 🆕 新增
    // ... 其他配置
}

// 使用配置
pub use configs::evm::*;
```

#### **3.2.3 交易扩展修改**

更新 `TxExtension` 以支持以太坊交易：

```rust
// runtime/src/lib.rs

/// 函数级中文注释：支持以太坊自包含交易的扩展
pub type TxExtension = (
    frame_system::CheckNonZeroSender<Runtime>,
    frame_system::CheckSpecVersion<Runtime>,
    frame_system::CheckTxVersion<Runtime>,
    frame_system::CheckGenesis<Runtime>,
    frame_system::CheckEra<Runtime>,
    frame_system::CheckNonce<Runtime>,
    frame_system::CheckWeight<Runtime>,
    pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
    frame_metadata_hash_extension::CheckMetadataHash<Runtime>,
    frame_system::WeightReclaim<Runtime>,
);

/// 函数级中文注释：以太坊交易转换器
pub struct TransactionConverter;

impl fp_rpc::ConvertTransaction<UncheckedExtrinsic> for TransactionConverter {
    fn convert_transaction(&self, transaction: pallet_ethereum::Transaction) -> UncheckedExtrinsic {
        UncheckedExtrinsic::new_unsigned(
            pallet_ethereum::Call::<Runtime>::transact { transaction }.into(),
        )
    }
}
```

---

### 3.3 Node 端配置

#### **3.3.1 RPC 扩展**

修改 `node/src/rpc.rs`（如不存在则创建）:

```rust
// node/src/rpc.rs

use std::sync::Arc;
use jsonrpsee::RpcModule;
use sc_client_api::BlockchainEvents;
use sc_transaction_pool_api::TransactionPool;
use sp_api::ProvideRuntimeApi;
use sp_block_builder::BlockBuilder;
use sp_blockchain::{HeaderBackend, HeaderMetadata};
use solochain_template_runtime::{opaque::Block, AccountId, Balance, Hash, Nonce};

/// 函数级中文注释：扩展 RPC 模块（包含 Substrate 和 Ethereum RPC）
pub fn create_full<C, P>(
    deps: FullDeps<C, P>,
) -> Result<RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + HeaderMetadata<Block, Error = sp_blockchain::Error>
        + BlockchainEvents<Block>
        + Send
        + Sync
        + 'static,
    C::Api: substrate_frame_rpc_system::AccountNonceApi<Block, AccountId, Nonce>,
    C::Api: pallet_transaction_payment_rpc::TransactionPaymentRuntimeApi<Block, Balance>,
    C::Api: BlockBuilder<Block>,
    C::Api: fp_rpc::EthereumRuntimeRPCApi<Block>,  // 🆕 Ethereum RPC API
    P: TransactionPool + 'static,
{
    let mut module = RpcModule::new(());
    let FullDeps { client, pool, deny_unsafe } = deps;

    // 标准 Substrate RPC
    module.merge(substrate_frame_rpc_system::System::new(client.clone(), pool.clone()).into_rpc())?;
    module.merge(pallet_transaction_payment_rpc::TransactionPayment::new(client.clone()).into_rpc())?;

    // 🆕 Ethereum RPC
    module.merge(fc_rpc::EthApi::new(
        client.clone(),
        pool.clone(),
        Default::default(),  // EthConfig
        deps.overrides.clone(),
        deps.backend.clone(),
        deps.is_authority,
        deps.block_data_cache.clone(),
        deps.fee_history_cache.clone(),
        deps.fee_history_limit,
        deps.execute_gas_limit_multiplier,
        deps.forced_parent_hashes,
    ).into_rpc())?;

    // 🆕 Net RPC
    module.merge(fc_rpc::NetApi::new(
        client.clone(),
        deps.network.clone(),
        true,  // peer_count_as_hex
    ).into_rpc())?;

    // 🆕 Web3 RPC
    module.merge(fc_rpc::Web3Api::new(client).into_rpc())?;

    Ok(module)
}

/// 函数级中文注释：RPC 依赖项
pub struct FullDeps<C, P> {
    pub client: Arc<C>,
    pub pool: Arc<P>,
    pub deny_unsafe: sc_rpc::DenyUnsafe,
    
    // 🆕 Frontier 依赖
    pub is_authority: bool,
    pub network: Arc<sc_network::NetworkService<Block, Hash>>,
    pub overrides: Arc<fc_rpc::OverrideHandle<Block>>,
    pub backend: Arc<fc_db::Backend<Block>>,
    pub block_data_cache: Arc<fc_rpc::EthBlockDataCacheTask<Block>>,
    pub fee_history_cache: Arc<fc_rpc::EthFeeHistoryCache>,
    pub fee_history_limit: u64,
    pub execute_gas_limit_multiplier: u64,
    pub forced_parent_hashes: Option<Arc<Vec<(H256, H256)>>>,
}
```

#### **3.3.2 Service 集成**

修改 `node/src/service.rs`:

```rust
// node/src/service.rs

use fc_consensus::FrontierBlockImport;
use fc_rpc::{OverrideHandle, StorageOverride};
use fc_rpc_core::types::{FeeHistoryCache, FeeHistoryCacheLimit, FilterPool};

/// 函数级中文注释：创建完整节点服务（支持 Frontier）
pub fn new_full(config: Configuration) -> Result<TaskManager, ServiceError> {
    // ... 现有代码 ...

    // 🆕 Frontier 后端初始化
    let frontier_backend = Arc::new(fc_db::Backend::open(
        Arc::clone(&client),
        &config.database,
        &db_config_dir(config),
    )?);

    // 🆕 Frontier 区块导入包装
    let frontier_block_import = FrontierBlockImport::new(
        grandpa_block_import.clone(),
        client.clone(),
        frontier_backend.clone(),
    );

    // 🆕 Fee History Cache
    let fee_history_cache = Arc::new(std::sync::Mutex::new(FeeHistoryCache::new(
        FeeHistoryCacheLimit::default(),
    )));

    // 🆕 Filter Pool
    let filter_pool = Arc::new(std::sync::Mutex::new(FilterPool::new()));

    // 🆕 Override Handle
    let overrides = Arc::new(OverrideHandle {
        schemas: fc_storage::overrides_handle(client.clone()),
        fallback: Box::new(StorageOverride::new(client.clone())),
    });

    // 启动 RPC
    let rpc_extensions_builder = {
        let client = client.clone();
        let pool = transaction_pool.clone();
        let network = network.clone();
        let frontier_backend = frontier_backend.clone();

        Box::new(move |deny_unsafe, _| {
            let deps = crate::rpc::FullDeps {
                client: client.clone(),
                pool: pool.clone(),
                deny_unsafe,
                is_authority: config.role.is_authority(),
                network: network.clone(),
                overrides: overrides.clone(),
                backend: frontier_backend.clone(),
                block_data_cache: Default::default(),
                fee_history_cache: fee_history_cache.clone(),
                fee_history_limit: 2048,
                execute_gas_limit_multiplier: 10,
                forced_parent_hashes: None,
            };

            crate::rpc::create_full(deps).map_err(Into::into)
        })
    };

    // 🆕 启动 Frontier 映射同步任务
    task_manager.spawn_essential_handle().spawn(
        "frontier-mapping-sync-worker",
        None,
        fc_mapping_sync::MappingSyncWorker::new(
            client.import_notification_stream(),
            Duration::new(6, 0),
            client.clone(),
            backend.clone(),
            frontier_backend.clone(),
            3,
            0,
            fc_mapping_sync::SyncStrategy::Normal,
        )
        .for_each(|()| futures::future::ready(())),
    );

    Ok(task_manager)
}
```

---

### 3.4 预编译合约开发（Substrate ↔ EVM 桥接）

#### **3.4.1 DUST 余额查询预编译**

创建 `runtime/src/precompiles/dust_balance.rs`:

```rust
// runtime/src/precompiles/dust_balance.rs

use fp_evm::{
    Context, ExitError, ExitSucceed, PrecompileFailure, PrecompileHandle, PrecompileOutput,
    PrecompileResult,
};
use pallet_evm::AddressMapping;
use sp_core::{H160, U256};
use sp_std::marker::PhantomData;

/// 函数级中文注释：DUST 余额查询预编译合约（地址 0x400）
/// 
/// Solidity 接口：
/// ```solidity
/// interface DustBalance {
///     function balanceOf(address account) external view returns (uint256);
/// }
/// ```
pub struct DustBalancePrecompile<Runtime>(PhantomData<Runtime>);

impl<Runtime> pallet_evm::Precompile for DustBalancePrecompile<Runtime>
where
    Runtime: pallet_evm::Config + pallet_balances::Config,
    Runtime::AccountId: From<[u8; 32]>,
{
    /// 函数级中文注释：执行预编译调用
    fn execute(handle: &mut impl PrecompileHandle) -> PrecompileResult {
        // 检查函数选择器 (balanceOf: 0x70a08231)
        let input = handle.input();
        if input.len() < 4 {
            return Err(PrecompileFailure::Error {
                exit_status: ExitError::Other("invalid input".into()),
            });
        }

        let selector = &input[0..4];
        match selector {
            // balanceOf(address)
            [0x70, 0xa0, 0x82, 0x31] => {
                if input.len() != 36 {
                    return Err(PrecompileFailure::Error {
                        exit_status: ExitError::Other("invalid address".into()),
                    });
                }

                // 解析 Ethereum 地址
                let eth_address = H160::from_slice(&input[16..36]);

                // 转换为 Substrate AccountId
                let substrate_account = Runtime::AddressMapping::into_account_id(eth_address);

                // 查询余额
                let balance = pallet_balances::Pallet::<Runtime>::free_balance(&substrate_account);

                // 转换为 U256 并返回
                let balance_u256 = U256::from(balance.saturated_into::<u128>());
                let mut output = [0u8; 32];
                balance_u256.to_big_endian(&mut output);

                Ok(PrecompileOutput {
                    exit_status: ExitSucceed::Returned,
                    output: output.to_vec(),
                })
            }
            _ => Err(PrecompileFailure::Error {
                exit_status: ExitError::Other("unknown function".into()),
            }),
        }
    }
}
```

#### **3.4.2 Memorial 操作预编译**

创建 `runtime/src/precompiles/memorial.rs`:

```rust
// runtime/src/precompiles/memorial.rs

/// 函数级中文注释：Memorial 纪念馆操作预编译合约（地址 0x401）
/// 
/// Solidity 接口：
/// ```solidity
/// interface Memorial {
///     function createMemorial(string memory name, string memory ipfsCid) external returns (uint64);
///     function getMemorial(uint64 memorialId) external view returns (string memory, string memory);
/// }
/// ```
pub struct MemorialPrecompile<Runtime>(PhantomData<Runtime>);

impl<Runtime> pallet_evm::Precompile for MemorialPrecompile<Runtime>
where
    Runtime: pallet_evm::Config + pallet_memorial::Config,
{
    fn execute(handle: &mut impl PrecompileHandle) -> PrecompileResult {
        let input = handle.input();
        let selector = &input[0..4];

        match selector {
            // createMemorial(string,string)
            [0xXX, 0xXX, 0xXX, 0xXX] => {
                // TODO: 实现创建逻辑
                unimplemented!()
            }
            // getMemorial(uint64)
            [0xYY, 0xYY, 0xYY, 0xYY] => {
                // TODO: 实现查询逻辑
                unimplemented!()
            }
            _ => Err(PrecompileFailure::Error {
                exit_status: ExitError::Other("unknown function".into()),
            }),
        }
    }
}
```

---

## 四、前端集成方案

### 4.1 双钱包支持策略

#### **方案架构**

```typescript
// stardust-dapp/src/features/evm/EVMWalletProvider.tsx

import { ethers } from 'ethers';
import { useEffect, useState } from 'react';

interface EVMWallet {
  address: string;
  signer: ethers.Signer;
  provider: ethers.providers.Web3Provider;
}

export const EVMWalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [evmWallet, setEvmWallet] = useState<EVMWallet | null>(null);

  const connectMetaMask = async () => {
    if (typeof window.ethereum !== 'undefined') {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      setEvmWallet({ address, signer, provider });
    } else {
      throw new Error('MetaMask 未安装');
    }
  };

  const connectWalletConnect = async () => {
    // TODO: WalletConnect v2 集成
  };

  return (
    <EVMWalletContext.Provider value={{ evmWallet, connectMetaMask, connectWalletConnect }}>
      {children}
    </EVMWalletContext.Provider>
  );
};
```

### 4.2 合约交互示例

#### **4.2.1 部署 Solidity 合约**

```typescript
// stardust-dapp/src/features/evm/ContractDeploy.tsx

import { ethers } from 'ethers';
import { useEVMWallet } from './EVMWalletProvider';

const SimpleStorageABI = [
  "function set(uint256 value) public",
  "function get() public view returns (uint256)"
];

const SimpleStorageBytecode = "0x608060405234801561001057600080fd5b50...";

export const ContractDeploy = () => {
  const { evmWallet } = useEVMWallet();

  const deployContract = async () => {
    if (!evmWallet) return;

    const factory = new ethers.ContractFactory(
      SimpleStorageABI,
      SimpleStorageBytecode,
      evmWallet.signer
    );

    const contract = await factory.deploy();
    await contract.deployed();

    console.log('合约地址:', contract.address);
    return contract.address;
  };

  return (
    <Button onClick={deployContract}>部署 SimpleStorage 合约</Button>
  );
};
```

#### **4.2.2 调用预编译合约（DUST 余额查询）**

```typescript
// stardust-dapp/src/features/evm/DustBalance.tsx

const DUST_BALANCE_ADDRESS = '0x0000000000000000000000000000000000000400';
const DUST_BALANCE_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

export const DustBalance = () => {
  const { evmWallet } = useEVMWallet();
  const [balance, setBalance] = useState<string>('0');

  const queryBalance = async (address: string) => {
    if (!evmWallet) return;

    const contract = new ethers.Contract(
      DUST_BALANCE_ADDRESS,
      DUST_BALANCE_ABI,
      evmWallet.provider
    );

    const bal = await contract.balanceOf(address);
    setBalance(ethers.utils.formatUnits(bal, 12)); // DUST decimals = 12
  };

  return (
    <div>
      <Input placeholder="输入以太坊地址" onBlur={(e) => queryBalance(e.target.value)} />
      <p>DUST 余额: {balance}</p>
    </div>
  );
};
```

### 4.3 账户转换工具

```typescript
// stardust-dapp/src/utils/accountConverter.ts

import { blake2AsHex } from '@polkadot/util-crypto';
import { ethers } from 'ethers';

/**
 * 函数级中文注释：Substrate AccountId 转 Ethereum Address
 * @param accountId - 32字节 SS58 地址
 * @returns 20字节以太坊地址
 */
export function substrateToEthereum(accountId: string): string {
  const hash = blake2AsHex(accountId, 256);
  return `0x${hash.slice(2, 42)}`; // 取前 20 字节
}

/**
 * 函数级中文注释：Ethereum Address 转 Substrate AccountId（需要链上绑定）
 */
export async function ethereumToSubstrate(
  ethAddress: string,
  api: any
): Promise<string | null> {
  // 查询链上绑定关系
  const binding = await api.query.evmAccounts.ethToSubstrate(ethAddress);
  return binding.isSome ? binding.unwrap().toString() : null;
}
```

---

## 五、测试验证方案

### 5.1 编译测试

```bash
# 1. 编译 Runtime
cd /home/xiaodong/文档/stardust
cargo build --release --package stardust-runtime

# 2. 编译 Node
cargo build --release --package stardust-node

# 3. 检查 WASM
ls -lh target/release/wbuild/stardust-runtime/stardust_runtime.compact.compressed.wasm
```

### 5.2 本地节点启动

```bash
# 启动开发节点
./target/release/stardust-node --dev --tmp \
  --rpc-port 9944 \
  --rpc-cors all \
  --rpc-methods=unsafe \
  --eth-http-port 8545 \
  --eth-ws-port 8546

# 验证 RPC 可用性
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# 预期返回: {"jsonrpc":"2.0","result":"0x22b8","id":1}  (8888 in hex)
```

### 5.3 MetaMask 配置

```
网络名称: Stardust EVM (Dev)
RPC URL: http://localhost:8545
Chain ID: 8888
货币符号: DUST
区块浏览器: (暂无)
```

### 5.4 智能合约测试

#### **测试合约**: SimpleStorage.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private value;

    event ValueChanged(uint256 newValue);

    function set(uint256 _value) public {
        value = _value;
        emit ValueChanged(_value);
    }

    function get() public view returns (uint256) {
        return value;
    }
}
```

#### **部署脚本** (Hardhat)

```javascript
// scripts/deploy-simple-storage.js

const hre = require("hardhat");

async function main() {
  const SimpleStorage = await hre.ethers.getContractFactory("SimpleStorage");
  const contract = await SimpleStorage.deploy();
  await contract.deployed();

  console.log("SimpleStorage deployed to:", contract.address);

  // 测试写入
  const tx = await contract.set(42);
  await tx.wait();
  console.log("Value set to 42");

  // 测试读取
  const value = await contract.get();
  console.log("Value retrieved:", value.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## 六、安全审计要点

### 6.1 EVM 特定风险

#### **⚠️ 重入攻击**
```rust
// 预编译合约必须防止重入
impl Precompile for MyPrecompile {
    fn execute(handle: &mut impl PrecompileHandle) -> PrecompileResult {
        // 🔴 在状态修改前检查
        handle.record_cost(GasCost::Low)?;
        
        // 执行业务逻辑...
        Ok(PrecompileOutput { ... })
    }
}
```

#### **⚠️ Gas 耗尽攻击**
```rust
// 设置合理的 Gas 限制
parameter_types! {
    pub BlockGasLimit: U256 = U256::from(15_000_000);
    pub MaxCodeSize: u32 = 24 * 1024;  // 24 KB
}
```

#### **⚠️ 整数溢出**
```rust
// 使用 checked_* 系列方法
let new_balance = old_balance
    .checked_add(amount)
    .ok_or(Error::<T>::Overflow)?;
```

### 6.2 DUST 资金安全

#### **规则 7 合规检查**

1. **EVM 账户与 DUST 余额隔离**
   ```rust
   // ✅ 推荐: 使用独立的 EVM Balances
   impl pallet_evm::Config for Runtime {
       type Currency = EvmBalances;  // 专用余额系统
   }
   
   // ❌ 不推荐: 直接使用主 Balances
   // type Currency = Balances;
   ```

2. **预编译合约权限限制**
   ```rust
   // 只允许查询，不允许转账
   fn balanceOf(...) -> u128 {  // ✅ 只读操作
       pallet_balances::Pallet::<T>::free_balance(...)
   }
   
   fn transfer(...) {  // ❌ 禁止转账操作
       return Err("Unauthorized");
   }
   ```

3. **Gas 费用回流检查**
   ```rust
   // 确保 Gas 费用进入正确账户
   impl pallet_evm::Config for Runtime {
       type OnChargeTransaction = EVMCurrencyAdapter<Balances, Treasury>;
   }
   ```

### 6.3 代码审计清单

- [ ] 所有预编译合约实现 `record_cost()`
- [ ] 测试 EVM ↔ Substrate 余额转换边界情况
- [ ] 验证 Gas 价格设置合理性（不低于 1 Gwei）
- [ ] 测试合约自毁后的存储清理
- [ ] 检查 BLOCKHASH 操作码在分叉场景下的表现
- [ ] 验证以太坊签名与 Substrate 签名不会互相干扰

---

## 七、分阶段实施计划

### Phase 1: 基础集成（2周）

**目标**: 完成 Frontier 核心组件集成

- [ ] **Week 1**:
  - [ ] 添加 Frontier 依赖到 workspace/runtime/node
  - [ ] 配置 `pallet-evm` 和 `pallet-ethereum`
  - [ ] 配置 `pallet-base-fee` (EIP-1559 支持)
  - [ ] 更新 `construct_runtime!` 宏
  - [ ] 编译通过

- [ ] **Week 2**:
  - [ ] 集成 Frontier RPC 到 Node
  - [ ] 配置 `FrontierBlockImport`
  - [ ] 启动 Mapping Sync Worker
  - [ ] 本地节点启动成功
  - [ ] MetaMask 连接测试

**验收标准**:
✅ 节点正常启动  
✅ `eth_chainId` RPC 调用成功  
✅ MetaMask 可连接并显示余额

---

### Phase 2: 预编译合约开发（3周）

**目标**: 实现 Substrate Pallet 与 EVM 的桥接

- [ ] **Week 3**:
  - [ ] 实现 `DustBalancePrecompile` (0x400)
  - [ ] 编写单元测试
  - [ ] 前端集成测试

- [ ] **Week 4**:
  - [ ] 实现 `MemorialPrecompile` (0x401)
    - [ ] `createMemorial()`
    - [ ] `getMemorial()`
  - [ ] 实现 `MakerPrecompile` (0x402)
    - [ ] `listOrder()`
    - [ ] `cancelOrder()`

- [ ] **Week 5**:
  - [ ] 实现 `BridgePrecompile` (0x403) - DUST ↔ USDT
  - [ ] 安全审计
  - [ ] 性能测试

**验收标准**:
✅ 预编译合约通过单元测试  
✅ Gas 消耗在合理范围内  
✅ 前端可通过 Ethers.js 调用

---

### Phase 3: 前端双钱包支持（2周）

**目标**: 前端同时支持 Polkadot.js 和 MetaMask

- [ ] **Week 6**:
  - [ ] 实现 `EVMWalletProvider`
  - [ ] MetaMask 连接流程
  - [ ] WalletConnect v2 集成
  - [ ] 账户转换工具

- [ ] **Week 7**:
  - [ ] 合约交互组件
  - [ ] 交易历史查询（混合 Substrate + EVM 交易）
  - [ ] Gas 费估算
  - [ ] UI/UX 优化

**验收标准**:
✅ 用户可同时使用两种钱包  
✅ 交易流程顺畅  
✅ 错误提示清晰

---

### Phase 4: 生态工具集成（2周）

**目标**: 集成以太坊开发者工具链

- [ ] **Week 8**:
  - [ ] Hardhat 配置
  - [ ] Remix IDE 兼容性测试
  - [ ] Truffle 配置（可选）

- [ ] **Week 9**:
  - [ ] 区块浏览器适配（Blockscout）
  - [ ] Subquery/Subsquid 索引 EVM 事件
  - [ ] 开发者文档编写

**验收标准**:
✅ 可通过 Hardhat 部署合约  
✅ Remix 可连接并调试  
✅ 区块浏览器显示 EVM 交易

---

### Phase 5: 测试与优化（1周）

**目标**: 全面测试和性能优化

- [ ] **Week 10**:
  - [ ] 压力测试（高并发 EVM 交易）
  - [ ] 安全审计报告
  - [ ] Gas 费优化
  - [ ] 存储裁剪测试
  - [ ] 文档完善

**验收标准**:
✅ TPS 达到预期  
✅ 无严重安全漏洞  
✅ 文档覆盖所有功能

---

## 八、风险评估与缓解措施

### 8.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Frontier 版本不兼容 | 高 | 中 | 使用 Moonbeam 验证过的版本，参考其配置 |
| EVM 性能瓶颈 | 中 | 高 | 设置合理 Gas 限制，监控 TPS |
| 预编译合约 Bug | 高 | 中 | 编写详细单元测试，第三方审计 |
| 账户映射冲突 | 中 | 低 | 使用成熟的 `HashedAddressMapping` |
| Gas 费设置不当 | 低 | 中 | 参考以太坊主网，动态调整 |

### 8.2 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 用户学习成本高 | 中 | 高 | 提供详细教程，双钱包智能切换 |
| 两套账户系统混乱 | 中 | 中 | 统一余额显示，自动绑定提示 |
| 前端复杂度增加 | 低 | 高 | 组件化设计，抽象钱包接口 |
| DUST 流动性分散 | 低 | 中 | 提供 EVM ↔ Substrate 桥接工具 |

### 8.3 安全风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 预编译合约重入攻击 | 高 | 低 | 严格检查调用栈，禁止外部调用 |
| Gas 耗尽 DoS | 中 | 中 | 设置 `SuicideQuickClearLimit`，限制单次调用 |
| 私钥泄漏（MetaMask） | 高 | 低 | 教育用户，推荐硬件钱包 |
| 恶意合约部署 | 中 | 中 | 初期可限制合约部署权限 |

---

## 九、成本估算

### 9.1 开发成本

- **人力**: 2 名全栈工程师 × 10 周 = 20 人周
- **审计**: 第三方安全审计（可选）= 5-10 万元
- **测试**: 服务器、测试网 Gas 费 = 1 万元

### 9.2 维护成本

- **依赖更新**: 跟随 Frontier 版本升级（每季度）
- **Bug 修复**: 预留 10% 工时用于修复
- **文档维护**: 每次更新同步文档

### 9.3 基础设施成本

- **RPC 节点**: 增加 EVM 状态存储约 +30% 磁盘空间
- **区块浏览器**: Blockscout 部署（4 GB RAM, 2 核 CPU）
- **备份**: EVM 状态需要独立备份策略

---

## 十、附录

### 10.1 参考项目

- **Moonbeam**: https://github.com/moonbeam-foundation/moonbeam
  - 最成熟的 Frontier 集成案例
  - 支持完整的 EVM 预编译合约

- **Astar**: https://github.com/AstarNetwork/Astar
  - 混合 Wasm + EVM 架构
  - Polkadot 平行链

- **Acala**: https://github.com/AcalaNetwork/Acala
  - DeFi 专用预编译合约
  - EVM+ 增强功能

### 10.2 官方文档

- Frontier GitHub: https://github.com/polkadot-evm/frontier
- Substrate Docs: https://docs.substrate.io
- Ethereum JSON-RPC: https://ethereum.org/en/developers/docs/apis/json-rpc/

### 10.3 工具链

- **Hardhat**: https://hardhat.org/
- **Remix**: https://remix.ethereum.org/
- **Blockscout**: https://github.com/blockscout/blockscout
- **MetaMask**: https://metamask.io/

---

## 十一、决策建议

### 🟢 **建议立即启动 Phase 1** 的情况：

1. ✅ 计划在 6 个月内上线主网
2. ✅ 需要吸引以太坊开发者生态
3. ✅ 有专职团队负责 EVM 集成
4. ✅ 预算充足（审计 + 测试）

### 🟡 **建议延后** 的情况：

1. ⚠️ 当前 Substrate 功能尚未稳定
2. ⚠️ 团队规模 < 3 人
3. ⚠️ 主网上线时间 > 1 年
4. ⚠️ 目标用户主要在 Polkadot 生态

### 🔴 **不建议集成** 的情况：

1. ❌ 不需要智能合约功能
2. ❌ 只面向企业客户（非公开网络）
3. ❌ 性能要求极致（EVM 有 overhead）
4. ❌ 预算不足以支持长期维护

---

## 十二、下一步行动

### 立即行动（本周内）:

1. [ ] 团队评审本方案
2. [ ] 确定是否启动 Frontier 集成
3. [ ] 分配开发人员
4. [ ] 创建 GitHub Milestone

### 短期行动（2 周内）:

1. [ ] 创建 `frontier-integration` 分支
2. [ ] 搭建本地测试环境
3. [ ] 完成 Phase 1 第一周任务

### 中期行动（1 个月内）:

1. [ ] 完成基础集成
2. [ ] 编写预编译合约
3. [ ] 前端原型开发

---

**文档维护者**: Cursor AI  
**审核人**: [待填写]  
**最后更新**: 2025-11-03

