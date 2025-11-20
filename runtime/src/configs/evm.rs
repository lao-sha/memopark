// 函数级中文注释：Frontier EVM 配置模块
// 功能：为 Stardust Runtime 配置以太坊虚拟机（EVM）兼容层
// 包含：EVM、Ethereum、BaseFee、DynamicFee 四个 pallet 的配置

use crate::*;
use frame_support::parameter_types;
use pallet_evm::{EnsureAddressNever, EnsureAddressRoot, HashedAddressMapping};
use sp_core::{H160, U256};
use sp_runtime::{traits::BlakeTwo256, Permill};

// EVM Chain ID 配置（测试网使用非标准 Chain ID 避免冲突）
parameter_types! {
	pub const ChainId: u64 = 8888;  // 🔴 TODO: 主网上线前修改
}

// EVM Gas 限制配置
parameter_types! {
	pub BlockGasLimit: U256 = U256::from(15_000_000);
	pub WeightPerGas: frame_support::weights::Weight =
		frame_support::weights::Weight::from_parts(20_000, 0);
	pub GasLimitPovSizeRatio: u64 = 4;
}

// 预编译合约基地址配置
parameter_types! {
	pub PrecompilesValue: Precompiles = Precompiles;
}

/// 函数级中文注释：自定义预编译合约集合
/// - 0x01-0x09: EVM 标准预编译
/// - 0x400-0x4FF: Substrate 桥接预编译（自定义，Phase 2 实现）
pub struct Precompiles;

impl pallet_evm::PrecompileSet for Precompiles {
	/// 函数级中文注释：执行预编译合约调用
	/// - 🔴 stable2506 变更：暂时返回 None，Phase 2 将实现自定义预编译
	/// - EVM 默认内置标准预编译（ECRecover、SHA256 等）无需手动实现
	fn execute(
		&self,
		_handle: &mut impl pallet_evm::PrecompileHandle,
	) -> Option<pallet_evm::PrecompileResult> {
		// TODO Phase 2: 实现自定义预编译合约
		// - 0x400: DUST 余额查询
		// - 0x401: Memorial 操作
		// - 0x402: Maker 操作
		// - 0x403: Bridge 操作
		None
	}

	/// 函数级中文注释：检查地址是否为预编译合约
	/// - 0x01-0x09: EVM 标准预编译（默认支持）
	/// - 0x400-0x4FF: 自定义预编译（待实现）
	fn is_precompile(&self, address: H160, _gas: u64) -> pallet_evm::IsPrecompileResult {
		let addr = address.to_low_u64_be();
		pallet_evm::IsPrecompileResult::Answer {
			// 标准预编译由 EVM 内部处理，自定义预编译待实现
			is_precompile: (0x400..=0x4FF).contains(&addr),
			extra_cost: 0,
		}
	}
}

/// 函数级中文注释：EVM Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent、SuicideQuickClearLimit 已移除
impl pallet_evm::Config for Runtime {
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

	// 🆕 stable2506 新增的关联类型
	/// 函数级中文注释：账户提供者（通过地址映射获取账户）
	type AccountProvider = pallet_evm::FrameSystemAccountProvider<Self>;

	/// 函数级中文注释：合约创建权限过滤器（() = 允许所有地址创建合约）
	type CreateOriginFilter = ();

	/// 函数级中文注释：内部合约创建权限过滤器（() = 允许合约内部创建合约）
	type CreateInnerOriginFilter = ();

	/// 函数级中文注释：合约创建时的回调（暂不处理）
	type OnCreate = ();

	/// 函数级中文注释：Gas 限制与存储增长的比率（防止存储滥用）
	type GasLimitStorageGrowthRatio = frame_support::traits::ConstU64<366>;
}

parameter_types! {
	/// 函数级中文注释：以太坊 State Root（使用中间状态根）
	pub StateRoot: sp_core::H256 = sp_core::H256::zero();
}

/// 函数级中文注释：Ethereum Pallet 配置实现
/// - 🔴 stable2506 API 变更：StateRoot 类型要求变更
impl pallet_ethereum::Config for Runtime {
	type StateRoot = StateRoot;
	type PostLogContent = ();
	type ExtraDataLength = frame_support::traits::ConstU32<30>;
}

/// 函数级中文注释：BaseFee 阈值配置（EIP-1559 支持）
pub struct BaseFeeThreshold;

impl pallet_base_fee::BaseFeeThreshold for BaseFeeThreshold {
	fn lower() -> Permill {
		Permill::from_parts(125_000) // -12.5%
	}
	fn ideal() -> Permill {
		Permill::from_parts(500_000) // 50%
	}
	fn upper() -> Permill {
		Permill::from_parts(875_000) // +12.5%
	}
}

parameter_types! {
	/// 函数级中文注释：默认弹性系数（EIP-1559）
	/// - 200% = Permill::from_parts(200_000)
	pub DefaultElasticity: Permill = Permill::from_parts(200_000);
	/// 函数级中文注释：默认基础费用（1 Gwei）
	pub DefaultBaseFeePerGas: U256 = U256::from(1_000_000_000);
}

/// 函数级中文注释：BaseFee Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent、IsActive 已移除，ConstU256 不存在
impl pallet_base_fee::Config for Runtime {
	type Threshold = BaseFeeThreshold;
	type DefaultBaseFeePerGas = DefaultBaseFeePerGas;
	type DefaultElasticity = DefaultElasticity;
}

parameter_types! {
	/// 函数级中文注释：最小 Gas 价格边界除数
	/// - 用于限制 Gas 价格波动范围
	pub MinGasPriceBoundDivisor: U256 = U256::from(1024);
}

/// 函数级中文注释：DynamicFee Pallet 配置实现（动态费用调整）
impl pallet_dynamic_fee::Config for Runtime {
	// 🔴 stable2506 API 变更：MinGasPriceBoundDivisor 需要 U256 类型
	type MinGasPriceBoundDivisor = MinGasPriceBoundDivisor;
}

