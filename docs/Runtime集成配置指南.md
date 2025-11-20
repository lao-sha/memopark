# pallet-stardust-ipfs Runtime集成配置指南

> **版本**: v2.0（支持Tier分层配置）  
> **适用**: Stardust Runtime  
> **更新日期**: 2025-10-26

---

## 📋 概览

本指南详细说明如何将优化后的`pallet-stardust-ipfs`集成到Stardust Runtime中。

---

## 🔧 步骤1：更新Runtime Config

### 修改 `runtime/src/lib.rs`

找到`impl pallet_memo_ipfs::Config for Runtime`部分，添加新的配置参数：

```rust
impl pallet_memo_ipfs::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    type FeeCollector = TreasuryAccountId; // 或IpfsPoolAccount
    type GovernanceOrigin = EnsureRoot<AccountId>;
    
    // 现有配置
    type MaxCidHashLen = ConstU32<64>;
    type MaxPeerIdLen = ConstU32<128>;
    type MinOperatorBond = ConstU128<10_000_000_000_000>; // 10 DUST
    type MinCapacityGiB = ConstU32<100>;
    type WeightInfo = ();
    
    // Deceased相关（保持不变）
    type SubjectPalletId = SubjectPalletId;
    type DeceasedDomain = ConstU8<1>;
    type CreatorProvider = DeceasedPallet;
    type OwnerProvider = DeceasedPallet;
    
    // IPFS池与运营者（保持不变）
    type IpfsPoolAccount = IpfsPoolAccountId;
    type OperatorEscrowAccount = OperatorEscrowAccountId;
    type MonthlyPublicFeeQuota = ConstU128<100_000_000_000_000>; // 100 DUST
    type QuotaResetPeriod = ConstU32<403200>; // 28天
    
    // ✅ 新增配置（必须添加）
    type DefaultBillingPeriod = ConstU32<100800>; // 7天（6秒/块 × 100800 = 7天）
}
```

---

## 🎯 步骤2：配置Genesis

### 方法1：使用默认值（推荐）

在`runtime/src/chain_spec.rs`中：

```rust
use pallet_memo_ipfs::GenesisConfig as MemoIpfsConfig;

pub fn testnet_genesis() -> RuntimeGenesisConfig {
    RuntimeGenesisConfig {
        system: SystemConfig::default(),
        balances: BalancesConfig {
            balances: vec![
                // ... 初始余额 ...
            ],
        },
        
        // 其他pallet配置 ...
        
        // ✅ IPFS配置（使用默认值）
        memo_ipfs: MemoIpfsConfig::default(),
    }
}
```

**默认值说明**（来自`pallets/stardust-ipfs/src/types.rs`）：
- **Critical**: 5副本, 7200块(6h巡检), 1.5x费率, 7天宽限期
- **Standard**: 3副本, 28800块(24h巡检), 1.0x费率, 7天宽限期
- **Temporary**: 1副本, 604800块(7d巡检), 0.5x费率, 3天宽限期

---

### 方法2：自定义配置

如需自定义Genesis配置，在`chain_spec.rs`中：

```rust
use pallet_memo_ipfs::{GenesisConfig as MemoIpfsConfig, types::{TierConfig, PinTier}};

pub fn testnet_genesis() -> RuntimeGenesisConfig {
    RuntimeGenesisConfig {
        // ... 其他配置 ...
        
        memo_ipfs: MemoIpfsConfig {
            critical_config: TierConfig {
                replicas: 5,
                health_check_interval: 7200,      // 6小时
                fee_multiplier: 15000,            // 1.5x
                grace_period_blocks: 100800,      // 7天
                enabled: true,
            },
            standard_config: TierConfig {
                replicas: 3,
                health_check_interval: 28800,     // 24小时
                fee_multiplier: 10000,            // 1.0x
                grace_period_blocks: 100800,      // 7天
                enabled: true,
            },
            temporary_config: TierConfig {
                replicas: 1,
                health_check_interval: 604800,    // 7天
                fee_multiplier: 5000,             // 0.5x
                grace_period_blocks: 43200,       // 3天
                enabled: true,
            },
            _phantom: Default::default(),
        },
    }
}
```

---

## 📝 步骤3：编译验证

### 编译检查

```bash
cd runtime
cargo build --release
cargo clippy --all-targets --all-features
```

### 预期输出

```
Compiling stardust-runtime v0.1.0
    Finished release [optimized] target(s) in 5m 30s
```

---

## 🧪 步骤4：运行测试

### 单元测试

```bash
cd pallets/stardust-ipfs
cargo test --features runtime-benchmarks
```

### Runtime集成测试

```bash
cd ../..
cargo test -p stardust-runtime --features runtime-benchmarks
```

---

## 🎯 步骤5：升级兼容性检查

### Try-Runtime检查

```bash
cargo test --features try-runtime
```

### 存储迁移（如需要）

如果从旧版本升级，需要添加存储迁移逻辑：

```rust
// runtime/src/lib.rs

pub type Executive = frame_executive::Executive<
    Runtime,
    Block,
    frame_system::ChainContext<Runtime>,
    Runtime,
    AllPalletsWithSystem,
    Migrations, // ← 添加迁移
>;

pub struct Migrations;
impl frame_support::traits::OnRuntimeUpgrade for Migrations {
    fn on_runtime_upgrade() -> frame_support::weights::Weight {
        // 初始化新的存储项
        use pallet_memo_ipfs::types::{TierConfig, PinTier};
        
        pallet_memo_ipfs::PinTierConfig::<Runtime>::insert(
            PinTier::Critical,
            TierConfig::critical_default(),
        );
        pallet_memo_ipfs::PinTierConfig::<Runtime>::insert(
            PinTier::Standard,
            TierConfig::default(),
        );
        pallet_memo_ipfs::PinTierConfig::<Runtime>::insert(
            PinTier::Temporary,
            TierConfig::temporary_default(),
        );
        
        // 初始化全局统计
        let zero_block: <Runtime as frame_system::Config>::BlockNumber = 0u32.into();
        pallet_memo_ipfs::HealthCheckStats::<Runtime>::put(
            pallet_memo_ipfs::types::GlobalHealthStats {
                total_pins: 0,
                total_size_bytes: 0,
                healthy_count: 0,
                degraded_count: 0,
                critical_count: 0,
                last_full_scan: zero_block,
                total_repairs: 0,
            }
        );
        
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
}
```

---

## ⚠️ 破坏式修改说明

### 影响的接口

1. **IpfsPinner trait** - 参数签名改变：
```rust
// 旧签名 ❌
fn pin_cid_for_deceased(
    caller: AccountId,
    deceased_id: u64,
    cid: Vec<u8>,
    price: Balance,   // 删除
    replicas: u32,    // 删除
) -> DispatchResult;

// 新签名 ✅
fn pin_cid_for_deceased(
    caller: AccountId,
    deceased_id: u64,
    cid: Vec<u8>,
    tier: Option<PinTier>,  // 新增
) -> DispatchResult;
```

2. **request_pin_for_deceased extrinsic** - 参数签名改变：
```rust
// 旧签名 ❌
pub fn request_pin_for_deceased(
    origin: OriginFor<T>,
    subject_id: u64,
    cid_hash: T::Hash,  // 改为明文CID
    size_bytes: u64,    // 删除
    replicas: u32,      // 删除
    price: T::Balance,  // 删除
) -> DispatchResult

// 新签名 ✅
pub fn request_pin_for_deceased(
    origin: OriginFor<T>,
    subject_id: u64,
    cid: Vec<u8>,              // 明文CID
    tier: Option<PinTier>,     // 分层等级
) -> DispatchResult
```

---

### 需要更新的代码位置

#### 1. 业务Pallet（如pallet-deceased）

找到所有调用`T::IpfsPinner::pin_cid_for_deceased`的地方：

```bash
cd pallets
grep -r "pin_cid_for_deceased" --include="*.rs"
```

修改调用代码：

```rust
// 旧代码 ❌
T::IpfsPinner::pin_cid_for_deceased(
    caller,
    deceased_id,
    cid,
    price,     // 删除
    replicas,  // 删除
)?;

// 新代码 ✅
T::IpfsPinner::pin_cid_for_deceased(
    caller,
    deceased_id,
    cid,
    Some(PinTier::Critical),  // 逝者档案使用Critical
)?;
```

**建议tier选择**：
- `PinTier::Critical` → 逝者核心档案（照片、视频、遗嘱）
- `PinTier::Standard` → 墓位封面、普通供奉品
- `PinTier::Temporary` → OTC聊天记录、临时数据

---

#### 2. Runtime Benchmarks

如果有benchmarking代码，也需要更新：

```rust
// pallets/stardust-ipfs/src/benchmarking.rs
benchmarks! {
    request_pin_for_deceased {
        let caller: T::AccountId = whitelisted_caller();
        let cid = vec![1u8; 46]; // 明文CID
        
    }: _(
        RawOrigin::Signed(caller),
        1u64,
        cid,
        Some(PinTier::Standard) // 新参数
    )
}
```

---

## 📊 配置参数说明

### DefaultBillingPeriod（扣费周期）

| 值 | 块数 | 实际时长 | 说明 |
|---|------|----------|------|
| 14400 | 14400 | 24小时 | 高频扣费，适合测试 |
| 100800 | 100800 | 7天 | **推荐生产配置** |
| 403200 | 403200 | 28天 | 月度扣费 |

计算公式：`块数 = 秒数 ÷ 块时间（6秒）`

---

### TierConfig参数

#### replicas（副本数）

| 值 | 说明 | 成本 | 可靠性 |
|---|------|------|--------|
| 1 | 单副本 | 低 | 低 |
| 3 | 标准配置 | 中 | 中 |
| 5 | 高可靠 | 高 | 高 |
| 7+ | 极高可靠 | 极高 | 极高 |

#### health_check_interval（巡检周期）

| 值 | 实际时长 | 适用场景 |
|---|----------|----------|
| 7200 | 6小时 | Critical数据 |
| 28800 | 24小时 | Standard数据（推荐） |
| 604800 | 7天 | Temporary数据 |

#### fee_multiplier（费率系数）

基数：10000 = 1.0x

| 值 | 实际费率 | 说明 |
|---|----------|------|
| 5000 | 0.5x | Temporary（50%折扣） |
| 10000 | 1.0x | Standard（标准费率） |
| 15000 | 1.5x | Critical（50%溢价） |
| 20000 | 2.0x | 超Critical（100%溢价） |

---

## 🚀 部署流程

### 1. 测试网部署

```bash
# 编译WASM
cd runtime
cargo build --release --features on-chain-release-build

# 复制WASM到链节点
cp target/release/wbuild/stardust-runtime/stardust_runtime.compact.compressed.wasm \
   /path/to/node/data/wasm/

# 重启节点
systemctl restart stardust-node
```

---

### 2. 提交Runtime升级提案

```javascript
// 使用Polkadot.js Apps
const wasmCode = fs.readFileSync('stardust_runtime.compact.compressed.wasm');

api.tx.sudo.sudoUncheckedWeight(
    api.tx.system.setCode(wasmCode),
    { refTime: 1_000_000_000, proofSize: 1_000_000 }
).signAndSend(sudoAccount, (result) => {
    console.log(`Status: ${result.status}`);
});
```

---

### 3. 升级后验证

```javascript
// 验证tier配置
const criticalConfig = await api.query.memoIpfs.pinTierConfig('Critical');
console.log('Critical config:', criticalConfig.toHuman());

// 验证全局统计
const healthStats = await api.query.memoIpfs.healthCheckStats();
console.log('Health stats:', healthStats.toHuman());

// 验证DefaultBillingPeriod
// （通过Metadata查看）
const metadata = await api.rpc.state.getMetadata();
// 查找memoIpfs.DefaultBillingPeriod常量
```

---

## 🔍 故障排查

### 问题1：编译错误 `DefaultBillingPeriod not found`

**原因**：未在runtime中添加新配置参数

**解决**：
```rust
impl pallet_memo_ipfs::Config for Runtime {
    // ...
    type DefaultBillingPeriod = ConstU32<100800>; // 添加这一行
}
```

---

### 问题2：Genesis构建失败

**原因**：Genesis配置类型不匹配

**解决**：使用`MemoIpfsConfig::default()`或正确初始化所有字段

---

### 问题3：旧代码调用失败

**原因**：使用了旧的API签名

**解决**：按照本文档更新所有调用代码

---

## 📚 相关文档

- [IPFS-Pallet优化改造方案.md](./IPFS-Pallet优化改造方案.md) - 完整设计方案
- [IPFS-Pallet优化-完成总结.md](./IPFS-Pallet优化-完成总结.md) - 实施总结
- [前端API适配指南.md](./前端API适配指南.md) - 前端调用说明

---

## ✅ 检查清单

部署前请确认：

- [ ] Runtime Config中添加了`DefaultBillingPeriod`
- [ ] Genesis配置已正确初始化
- [ ] 所有业务pallet中的调用已更新
- [ ] Benchmarking代码已更新（如有）
- [ ] 编译通过（无warning）
- [ ] 单元测试全部通过
- [ ] Runtime集成测试通过
- [ ] Try-runtime检查通过（如有升级）
- [ ] 测试网部署验证通过

---

**文档生成时间**：2025-10-26  
**维护者**：Stardust开发团队  
**版本**：v2.0

