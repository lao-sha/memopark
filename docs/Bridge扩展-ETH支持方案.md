# Bridge 扩展：添加 ETH 支持方案

## 背景

### 现状
- ✅ 已实现：DUST ↔ USDT (Tron) 桥接
- 📋 需求：添加 DUST ↔ ETH (Ethereum) 桥接

### 目标
在现有 Bridge Pallet 基础上，扩展支持多种外部资产，包括 ETH。

---

## 技术方案

### 方案 1: 扩展现有 Bridge Pallet ⭐️ (推荐)

**优点**：
- 复用现有的 Maker 托管机制
- 复用 OCW 验证逻辑
- 复用仲裁机制
- 代码维护成本低

**缺点**：
- 需要重构现有代码结构
- 需要兼容旧数据

#### 实现步骤

##### Step 1: 扩展数据结构

```rust
// pallets/bridge/src/lib.rs

/// 函数级中文注释：支持的外部资产类型
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum BridgeAsset {
    /// Tron 网络的 USDT
    TronUSDT,
    /// 以太坊的 ETH
    EthereumETH,
    /// 以太坊的 USDT (ERC20)
    EthereumUSDT,
    // 未来扩展...
}

/// 函数级中文注释：外部地址类型（支持多链）
#[derive(Encode, Decode, TypeInfo, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum ExternalAddress {
    /// Tron 地址 (Base58, 34 字节)
    Tron(BoundedVec<u8, ConstU32<34>>),
    /// 以太坊地址 (20 字节)
    Ethereum(H160),
}

impl MaxEncodedLen for ExternalAddress {
    fn max_encoded_len() -> usize {
        // 1 byte for enum variant + max(34, 20) bytes for address
        1 + 34
    }
}

/// 函数级中文注释：统一的兑换请求结构
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
#[scale_info(skip_type_params(T))]
pub struct UnifiedSwapRequest<T: Config> {
    pub id: u64,
    pub user: T::AccountId,
    pub dust_amount: BalanceOf<T>,
    pub asset_type: BridgeAsset,           // 🆕 资产类型
    pub external_address: ExternalAddress,  // 🆕 统一的外部地址
    pub external_amount: u128,             // 🆕 外部资产数量（wei/satoshi等）
    pub status: SwapStatus,
    pub created_at: BlockNumberFor<T>,
    pub timeout_at: BlockNumberFor<T>,
}
```

##### Step 2: 扩展 Maker 配置

```rust
/// 函数级中文注释：Maker 支持的资产配置
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone)]
pub struct MakerAssetConfig {
    /// 资产类型
    pub asset: BridgeAsset,
    /// 外部地址（用于接收/发送）
    pub external_address: ExternalAddress,
    /// 是否激活
    pub is_active: bool,
    /// 最小兑换额度
    pub min_amount: u128,
    /// 最大兑换额度
    pub max_amount: u128,
}

// 存储：Maker 支持的资产列表
#[pallet::storage]
pub type MakerAssets<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat, u64,              // maker_id
    Blake2_128Concat, BridgeAsset,      // asset_type
    MakerAssetConfig,
>;
```

##### Step 3: 扩展可调用函数

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：用户发起 DUST → 外部资产兑换（多资产版本）
    #[pallet::weight(T::WeightInfo::request_swap())]
    pub fn request_swap_v2(
        origin: OriginFor<T>,
        maker_id: u64,
        dust_amount: BalanceOf<T>,
        asset_type: BridgeAsset,         // 🆕 指定资产类型
        external_address: ExternalAddress,  // 🆕 外部地址
    ) -> DispatchResult {
        let user = ensure_signed(origin)?;
        
        // 1. 验证 Maker 支持该资产
        ensure!(
            Self::maker_supports_asset(maker_id, &asset_type),
            Error::<T>::AssetNotSupported
        );
        
        // 2. 根据资产类型获取汇率
        let external_amount = match asset_type {
            BridgeAsset::TronUSDT => {
                // DUST → USDT 汇率计算
                Self::calculate_usdt_amount(dust_amount)
            },
            BridgeAsset::EthereumETH => {
                // DUST → ETH 汇率计算
                Self::calculate_eth_amount(dust_amount)
            },
            _ => return Err(Error::<T>::UnsupportedAsset.into()),
        };
        
        // 3. 托管 DUST
        T::Escrow::lock_funds(&user, dust_amount)?;
        
        // 4. 创建兑换请求
        let swap_id = Self::next_swap_id();
        let request = UnifiedSwapRequest {
            id: swap_id,
            user: user.clone(),
            dust_amount,
            asset_type,
            external_address,
            external_amount,
            status: SwapStatus::Pending,
            created_at: <frame_system::Pallet<T>>::block_number(),
            timeout_at: <frame_system::Pallet<T>>::block_number() + T::SwapTimeout::get(),
        };
        
        SwapRequests::<T>::insert(swap_id, request);
        
        Self::deposit_event(Event::SwapRequested {
            swap_id,
            user,
            asset_type,
            dust_amount,
            external_amount,
        });
        
        Ok(())
    }
    
    /// 函数级中文注释：Maker 确认已发送外部资产
    #[pallet::weight(T::WeightInfo::confirm_swap())]
    pub fn confirm_swap_v2(
        origin: OriginFor<T>,
        swap_id: u64,
        tx_hash: BoundedVec<u8, ConstU32<66>>,  // 支持不同链的交易哈希格式
    ) -> DispatchResult {
        let maker = ensure_signed(origin)?;
        
        let mut request = SwapRequests::<T>::get(swap_id)
            .ok_or(Error::<T>::SwapNotFound)?;
        
        // 验证 Maker 权限...
        
        // 等待 OCW 验证交易
        request.status = SwapStatus::PendingVerification;
        SwapRequests::<T>::insert(swap_id, request.clone());
        
        // 触发 OCW 验证
        Self::trigger_ocw_verification(swap_id, request.asset_type, tx_hash);
        
        Ok(())
    }
}
```

##### Step 4: OCW 多链验证

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn offchain_worker(block_number: BlockNumberFor<T>) {
        log::info!("🔗 Bridge OCW 开始工作，区块 #{:?}", block_number);
        
        // 获取待验证的兑换请求
        let pending_swaps = Self::get_pending_verifications();
        
        for (swap_id, request) in pending_swaps {
            match request.asset_type {
                BridgeAsset::TronUSDT => {
                    // 验证 Tron 交易
                    Self::verify_tron_transaction(swap_id, &request);
                },
                BridgeAsset::EthereumETH => {
                    // 🆕 验证以太坊交易
                    Self::verify_ethereum_transaction(swap_id, &request);
                },
                _ => {
                    log::warn!("不支持的资产类型验证: {:?}", request.asset_type);
                }
            }
        }
    }
}

/// 函数级中文注释：验证以太坊交易
fn verify_ethereum_transaction(swap_id: u64, request: &UnifiedSwapRequest<T>) {
    // 1. 获取以太坊 RPC 端点
    let rpc_url = Self::get_ethereum_rpc_url();
    
    // 2. 查询交易详情
    let tx_result = Self::fetch_ethereum_tx(rpc_url, &request.tx_hash);
    
    match tx_result {
        Ok(tx) => {
            // 3. 验证交易参数
            let valid = Self::validate_eth_transaction(
                &tx,
                &request.external_address,
                request.external_amount,
            );
            
            if valid {
                // 4. 提交验证结果（通过）
                Self::submit_verification_result(swap_id, true);
            } else {
                // 验证失败
                Self::submit_verification_result(swap_id, false);
            }
        },
        Err(e) => {
            log::error!("获取以太坊交易失败: {:?}", e);
        }
    }
}

/// 函数级中文注释：获取以太坊交易详情
fn fetch_ethereum_tx(rpc_url: &str, tx_hash: &[u8]) -> Result<EthTransaction, &'static str> {
    // 使用 HTTP 请求查询以太坊节点
    let request = http::Request::get(&format!(
        "{}",
        rpc_url
    ))
    .body(vec![/* JSON-RPC payload */])
    .send()
    .map_err(|_| "HTTP 请求失败")?;
    
    let response = request
        .wait()
        .map_err(|_| "等待响应失败")?;
    
    if response.code != 200 {
        return Err("HTTP 状态码错误");
    }
    
    // 解析 JSON-RPC 响应
    let body = response.body().collect::<Vec<u8>>();
    let tx: EthTransaction = Self::parse_eth_tx_response(&body)?;
    
    Ok(tx)
}
```

##### Step 5: 配置 Runtime

```rust
// runtime/src/configs/mod.rs

impl pallet_bridge::Config for Runtime {
    type Currency = Balances;
    type Escrow = pallet_escrow::Pallet<Runtime>;
    type MakerPallet = MakerPalletImpl;
    type GovernanceOrigin = frame_system::EnsureSigned<AccountId>;
    
    // 🆕 多链配置
    type SupportedAssets = SupportedBridgeAssets;
    type TronRpcUrl = TronRpcUrl;
    type EthereumRpcUrl = EthereumRpcUrl;  // 🆕 以太坊 RPC
    
    type SwapTimeout = ConstU32<7200>;  // 2小时超时
    type WeightInfo = ();
}

parameter_types! {
    pub const TronRpcUrl: &'static str = "https://api.trongrid.io";
    pub const EthereumRpcUrl: &'static str = "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY";  // 🆕
}
```

---

## ETH 价格获取方案

### 方案 A: OCW 从 DEX 获取价格 ⭐️

```rust
/// 函数级中文注释：从 Uniswap 等 DEX 获取 DUST/ETH 汇率
fn fetch_dust_eth_rate() -> Result<u128, &'static str> {
    // 1. 查询 Uniswap V3 DUST/ETH 池子
    let pool_address = H160::from_slice(&[/* pool address */]);
    
    // 2. 调用 slot0() 获取当前价格
    let price = Self::query_uniswap_price(pool_address)?;
    
    // 3. 返回汇率 (以 wei 为单位)
    Ok(price)
}
```

### 方案 B: 使用 Chainlink 预言机

```rust
/// 函数级中文注释：从 Chainlink 获取 ETH/USD 价格
fn fetch_eth_usd_price() -> Result<u128, &'static str> {
    let chainlink_feed = H160::from_slice(&[/* Chainlink ETH/USD feed */]);
    let price = Self::query_chainlink_feed(chainlink_feed)?;
    Ok(price)
}

/// 函数级中文注释：计算 DUST → ETH 数量
fn calculate_eth_amount(dust_amount: BalanceOf<T>) -> u128 {
    // 1. 获取 DUST/USD 价格
    let dust_usd = Self::get_dust_usd_price();
    
    // 2. 获取 ETH/USD 价格
    let eth_usd = Self::fetch_eth_usd_price().unwrap_or(3000_00000000);  // 默认 $3000
    
    // 3. 计算 DUST → ETH
    // ETH_amount = DUST_amount * (DUST_USD / ETH_USD)
    let eth_amount = dust_amount
        .saturating_mul(dust_usd.into())
        .saturating_div(eth_usd.into());
    
    eth_amount.saturated_into()
}
```

---

## 关键技术点

### 1. 以太坊地址兼容性

```rust
use sp_core::H160;

// Ethereum 地址 = 20 字节
pub type EthereumAddress = H160;

// 与 Frontier EVM 地址可以共用类型
impl From<EthereumAddress> for ExternalAddress {
    fn from(addr: EthereumAddress) -> Self {
        ExternalAddress::Ethereum(addr)
    }
}
```

### 2. 交易验证策略

**Tron 验证** (现有):
```rust
// 查询 Tron API
GET https://api.trongrid.io/v1/transactions/{tx_hash}
```

**Ethereum 验证** (新增):
```rust
// JSON-RPC 查询
POST https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
{
  "jsonrpc": "2.0",
  "method": "eth_getTransactionByHash",
  "params": ["0x..."],
  "id": 1
}

// 验证点：
// 1. to_address == 用户指定的地址
// 2. value >= 预期的 ETH 数量
// 3. 交易已确认（confirmations >= 12）
```

### 3. Gas 费处理

**场景**: 用户需要 ETH 发送交易，但手续费也是 ETH

**解决方案**:
```rust
/// 用户兑换时，自动扣除 Gas 费
pub fn calculate_eth_with_gas(
    dust_amount: BalanceOf<T>,
    estimated_gas: u128,  // wei
) -> (u128, u128) {
    let total_eth = Self::calculate_eth_amount(dust_amount);
    
    // 预留 Gas 费（比如 0.001 ETH = 1e15 wei）
    let gas_reserve = estimated_gas.max(1_000_000_000_000_000);  // 0.001 ETH
    
    let user_receives = total_eth.saturating_sub(gas_reserve);
    
    (user_receives, gas_reserve)
}
```

---

## 安全考虑

### 1. 多签控制

```rust
/// 大额兑换需要多签确认
#[pallet::weight(T::WeightInfo::approve_large_swap())]
pub fn approve_large_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    
    let request = SwapRequests::<T>::get(swap_id)
        .ok_or(Error::<T>::SwapNotFound)?;
    
    // 大额阈值：> 10 ETH
    if request.external_amount > 10_000_000_000_000_000_000 {
        // 需要多签批准
        Self::require_multisig_approval(swap_id)?;
    }
    
    Ok(())
}
```

### 2. 速率限制

```rust
/// 每个 Maker 的日兑换限额
#[pallet::storage]
pub type DailySwapLimit<T: Config> = StorageMap<
    _,
    Blake2_128Concat, 
    (u64, BridgeAsset),  // (maker_id, asset_type)
    u128,                 // 今日已兑换额度
>;

/// 检查限额
fn check_daily_limit(
    maker_id: u64,
    asset_type: &BridgeAsset,
    amount: u128,
) -> DispatchResult {
    let today_used = DailySwapLimit::<T>::get((maker_id, asset_type))
        .unwrap_or(0);
    
    let limit = T::DailyLimit::get();
    
    ensure!(
        today_used + amount <= limit,
        Error::<T>::DailyLimitExceeded
    );
    
    Ok(())
}
```

### 3. 滑点保护

```rust
/// 用户可设置最大滑点
pub fn request_swap_with_slippage(
    origin: OriginFor<T>,
    maker_id: u64,
    dust_amount: BalanceOf<T>,
    asset_type: BridgeAsset,
    external_address: ExternalAddress,
    min_external_amount: u128,  // 🆕 最小接收量
) -> DispatchResult {
    // 计算实际兑换量
    let actual_amount = Self::calculate_external_amount(dust_amount, &asset_type);
    
    // 滑点检查
    ensure!(
        actual_amount >= min_external_amount,
        Error::<T>::SlippageTooHigh
    );
    
    // 继续处理...
    Ok(())
}
```

---

## 实施计划

### Phase 1: 基础架构重构 (1-2 周)
- [ ] 数据结构扩展（BridgeAsset, ExternalAddress）
- [ ] 存储迁移脚本
- [ ] 向后兼容测试

### Phase 2: ETH 支持实现 (2-3 周)
- [ ] 以太坊 OCW 集成
- [ ] 交易验证逻辑
- [ ] 价格获取机制

### Phase 3: 测试与优化 (1-2 周)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 压力测试

### Phase 4: 主网部署 (1 周)
- [ ] 审计
- [ ] 逐步开放（白名单 → 公开）
- [ ] 监控告警

**总计**: 5-8 周

---

## 替代方案

### 方案 2: 使用第三方桥接服务

**优点**: 快速集成，无需自己维护基础设施
**缺点**: 中心化风险，手续费较高

**推荐服务**:
- Wormhole
- LayerZero
- Axelar

### 方案 3: XCM (如果接入 Polkadot)

如果 Stardust 计划成为 Polkadot 平行链：

```rust
// 通过 XCM 与 Moonbeam (EVM 平行链) 通信
// Moonbeam 有原生 ETH 桥接
xcm::send_xcm(
    Location::new(1, [Parachain(2004)]),  // Moonbeam
    Xcm(vec![/* 兑换指令 */]),
)?;
```

---

## 成本估算

### 开发成本
- 开发人员: 1-2 人
- 时间: 5-8 周
- 成本: 约 $20,000 - $40,000

### 运营成本
- 以太坊 RPC: $100-500/月 (Alchemy/Infura)
- OCW 服务器: $50-100/月
- 预留 Gas 池: 1-5 ETH ($3,000-$15,000)

### 总计
- 初期投入: $23,150 - $55,600
- 月度运营: $150-600

---

## FAQ

### Q1: 为什么不直接用 Frontier 实现？
**A**: Frontier 只提供 EVM 兼容层，不提供跨链通信。在 Frontier EVM 中运行的合约使用的是 DUST，不是真实的 ETH。

### Q2: 如何保证 Maker 诚信？
**A**: 
1. 保证金机制（沿用现有设计）
2. OCW 自动验证交易
3. 用户可举报 + 仲裁机制
4. 信用评分系统

### Q3: 如果以太坊交易费太高怎么办？
**A**: 
1. 支持 L2（Arbitrum, Optimism）
2. 批量处理小额兑换
3. 动态调整最小兑换额度

### Q4: 与 Frontier EVM 有什么关系？
**A**: 
- **Frontier**: 让 Stardust 支持运行以太坊智能合约
- **Bridge**: 让 DUST 与外部 ETH 互换
- **两者独立**，但可以协同：
  ```
  用户通过 Bridge 兑换 ETH → 使用 ETH 在以太坊主网
  用户在 Frontier EVM 中用 DUST 作为 Gas 部署合约
  ```

---

## 参考资料

- [Moonbeam Bridge](https://github.com/moonbeam-foundation/moonbeam/tree/master/pallets/ethereum-xcm)
- [Snowbridge](https://github.com/Snowfork/snowbridge)
- [以太坊 JSON-RPC 文档](https://ethereum.org/en/developers/docs/apis/json-rpc/)
- [Uniswap V3 价格获取](https://docs.uniswap.org/contracts/v3/guides/oracle/integration)

---

**文档版本**: v1.0  
**创建时间**: 2025-11-03  
**状态**: 设计方案 - 待评审

