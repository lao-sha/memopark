# DUST 跨链桥接方案

## 📋 目录

- [背景与需求](#背景与需求)
- [方案对比](#方案对比)
- [推荐方案：锁定-铸造桥接](#推荐方案锁定-铸造桥接)
- [技术架构](#技术架构)
- [实现细节](#实现细节)
- [安全性分析](#安全性分析)
- [成本分析](#成本分析)
- [部署流程](#部署流程)

---

## 背景与需求

### 问题描述

在 Stardust AI 交易系统中，存在两种 DUST 代币：

1. **Stardust 链原生 DUST**：Substrate 区块链的原生代币
2. **Arbitrum ERC20 DUST**：部署在 Arbitrum 上的 ERC20 代币

### 业务需求

- 用户在 Stardust 链上持有原生 DUST
- AI 交易智能合约（`StardustTradingVault`、`StardustVaultRouter`）部署在 Arbitrum 上
- 需要实现两种 DUST 的自由兑换，保证价值 1:1 锚定

---

## 方案对比

### 方案 1：锁定-铸造（Lock & Mint）✅ **推荐**

| 指标 | 说明 |
|------|------|
| **原理** | Stardust 链锁定原生 DUST → Arbitrum 铸造 ERC20 DUST |
| **优点** | ✅ 总供应量不变<br>✅ 简单可靠<br>✅ 易于审计 |
| **缺点** | ❌ 需要桥接合约<br>❌ 依赖中继服务 |
| **适用场景** | **最适合当前需求** |

### 方案 2：销毁-铸造（Burn & Mint）

| 指标 | 说明 |
|------|------|
| **原理** | Stardust 链销毁原生 DUST → Arbitrum 铸造 ERC20 DUST |
| **优点** | ✅ 无需锁定账户<br>✅ 逻辑简单 |
| **缺点** | ❌ 总供应量波动<br>❌ 不可逆操作<br>❌ 审计困难 |
| **适用场景** | 不推荐（风险较高） |

### 方案 3：Polkadot XCM（跨链消息传递）

| 指标 | 说明 |
|------|------|
| **原理** | 使用 Polkadot 生态的原生跨链协议 |
| **优点** | ✅ Polkadot 原生支持<br>✅ 去中心化 |
| **缺点** | ❌ 需要连接到 Polkadot 中继链<br>❌ 集成复杂<br>❌ Arbitrum 不在 Polkadot 生态 |
| **适用场景** | 不适用（Arbitrum 不支持） |

### 方案 4：第三方桥接协议（LayerZero / Wormhole）

| 指标 | 说明 |
|------|------|
| **原理** | 使用现成的跨链桥接服务 |
| **优点** | ✅ 无需自建基础设施<br>✅ 已经过审计 |
| **缺点** | ❌ 需要支付桥接费用<br>❌ 依赖第三方<br>❌ 集成复杂 |
| **适用场景** | 可作为备选方案 |

---

## 推荐方案：锁定-铸造桥接

### 核心原理

```
┌────────────────────────────────────────────────────────────────┐
│                      锁定-铸造桥接流程                           │
└────────────────────────────────────────────────────────────────┘

【正向流程】Stardust → Arbitrum

  Stardust 链                     中继服务（OCW）              Arbitrum
      │                                │                          │
      │ 1. 用户锁定 100 DUST           │                          │
      ├──────────────────────────────►│                          │
      │                                │                          │
      │ 2. 触发 BridgeRequested 事件   │                          │
      ├──────────────────────────────►│                          │
      │                                │                          │
      │                                │ 3. OCW 监听事件          │
      │                                │                          │
      │                                │ 4. 调用 Arbitrum 合约    │
      │                                ├────────────────────────►│
      │                                │                          │
      │                                │ 5. 铸造 100 ERC20 DUST   │
      │                                │◄────────────────────────┤
      │                                │                          │
      │ 6. 更新状态为 Completed         │                          │
      │◄──────────────────────────────┤                          │


【反向流程】Arbitrum → Stardust

  Arbitrum                       中继服务（OCW）            Stardust 链
      │                                │                          │
      │ 1. 用户销毁 100 ERC20 DUST     │                          │
      ├──────────────────────────────►│                          │
      │                                │                          │
      │ 2. 触发 BridgeBack 事件        │                          │
      ├──────────────────────────────►│                          │
      │                                │                          │
      │                                │ 3. OCW 监听事件          │
      │                                │                          │
      │                                │ 4. 调用 Stardust 解锁    │
      │                                ├────────────────────────►│
      │                                │                          │
      │                                │ 5. 解锁 100 原生 DUST    │
      │                                │◄────────────────────────┤
```

### 为什么选择锁定-铸造？

1. **总供应量恒定**：
   - Stardust 链上锁定的 DUST = Arbitrum 上铸造的 ERC20 DUST
   - 全局 DUST 总量保持不变

2. **可审计性**：
   - 随时可以验证：锁定数量 = 铸造数量
   - 透明度高

3. **可逆性**：
   - 用户可以随时将 ERC20 DUST 兑换回原生 DUST
   - 无损操作

4. **安全性**：
   - 锁定账户受 Substrate 多签控制
   - 铸造权限受 Arbitrum 合约控制

---

## 技术架构

### 三层架构

```
┌───────────────────────────────────────────────────────────────┐
│                       DUST 跨链桥接架构                         │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Stardust 链（Substrate）                           │
├─────────────────────────────────────────────────────────────┤
│  - pallet-dust-bridge: 桥接 Pallet                           │
│  - 锁定账户（多签）: 5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkBz6A │
│  - 功能：                                                     │
│    • bridge_to_arbitrum(amount, eth_address)                │
│    • unlock_from_arbitrum(amount, substrate_address)        │
│    • 事件：BridgeRequested, BridgeCompleted                  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 双向通信
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: 中继服务（Off-Chain Worker / 独立服务）             │
├─────────────────────────────────────────────────────────────┤
│  - 监听 Stardust 链事件（via WebSocket）                      │
│  - 监听 Arbitrum 事件（via JSON-RPC）                         │
│  - 验证跨链请求合法性                                         │
│  - 提交跨链交易到目标链                                       │
│  - 安全机制：                                                 │
│    • 多节点验证                                               │
│    • 阈值签名                                                 │
│    • 重放攻击保护                                             │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 双向通信
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Arbitrum（EVM）                                    │
├─────────────────────────────────────────────────────────────┤
│  - DUSTToken.sol: ERC20 代币合约                             │
│  - DUSTBridge.sol: 桥接合约                                  │
│  - 功能：                                                     │
│    • mint(address to, uint256 amount) [onlyBridge]          │
│    • burnAndBridgeBack(uint256 amount, bytes substrateAddr) │
│    • 事件：BridgeMint, BridgeBack                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 实现细节

### 1. Stardust 链 - pallet-dust-bridge

#### 存储结构

```rust
/// 函数级详细中文注释：桥接锁定账户
#[pallet::storage]
pub type BridgeLockAccount<T: Config> = StorageValue<_, T::AccountId>;

/// 函数级详细中文注释：下一个桥接 ID
#[pallet::storage]
pub type NextBridgeId<T> = StorageValue<_, u64, ValueQuery>;

/// 函数级详细中文注释：桥接请求记录
#[pallet::storage]
pub type BridgeRequests<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // bridge_id
    BridgeRequest<T>,
>;

/// 函数级详细中文注释：桥接请求结构
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone)]
pub struct BridgeRequest<T: Config> {
    /// 桥接 ID
    pub id: u64,
    /// 用户账户（Substrate）
    pub user: T::AccountId,
    /// DUST 数量
    pub amount: BalanceOf<T>,
    /// 目标地址（Arbitrum）
    pub target_address: BoundedVec<u8, ConstU32<42>>,  // 以太坊地址
    /// 状态
    pub status: BridgeStatus,
    /// 创建时间
    pub created_at: BlockNumberFor<T>,
    /// Arbitrum 交易哈希（完成后填充）
    pub arbitrum_tx_hash: Option<BoundedVec<u8, ConstU32<66>>>,
}

/// 函数级详细中文注释：桥接状态
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq)]
pub enum BridgeStatus {
    /// 待处理
    Pending,
    /// 已完成
    Completed,
    /// 失败
    Failed,
}
```

#### 核心接口

```rust
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：桥接到 Arbitrum
    /// 
    /// ## 功能说明
    /// 1. 验证金额大于最小值
    /// 2. 验证以太坊地址格式
    /// 3. 锁定 DUST 到桥接账户
    /// 4. 创建桥接请求
    /// 5. 触发 BridgeRequested 事件
    /// 
    /// ## 参数
    /// - `origin`: 调用者（用户）
    /// - `amount`: DUST 数量
    /// - `eth_address`: Arbitrum 接收地址
    #[pallet::call_index(0)]
    #[pallet::weight(T::WeightInfo::bridge_to_arbitrum())]
    pub fn bridge_to_arbitrum(
        origin: OriginFor<T>,
        amount: BalanceOf<T>,
        eth_address: Vec<u8>,
    ) -> DispatchResult {
        let user = ensure_signed(origin)?;
        
        // 1. 验证最小金额
        ensure!(
            amount >= T::MinBridgeAmount::get(),
            Error::<T>::BelowMinimumAmount
        );
        
        // 2. 验证以太坊地址格式（42字节：0x + 40个十六进制字符）
        let target_addr: BoundedVec<u8, ConstU32<42>> = eth_address
            .try_into()
            .map_err(|_| Error::<T>::InvalidEthAddress)?;
        
        // 3. 锁定 DUST 到桥接账户
        let bridge_account = BridgeLockAccount::<T>::get()
            .ok_or(Error::<T>::BridgeAccountNotSet)?;
        
        T::Currency::transfer(
            &user,
            &bridge_account,
            amount,
            ExistenceRequirement::KeepAlive,
        )?;
        
        // 4. 创建桥接请求
        let bridge_id = NextBridgeId::<T>::get();
        let request = BridgeRequest {
            id: bridge_id,
            user: user.clone(),
            amount,
            target_address: target_addr.clone(),
            status: BridgeStatus::Pending,
            created_at: frame_system::Pallet::<T>::block_number(),
            arbitrum_tx_hash: None,
        };
        
        BridgeRequests::<T>::insert(bridge_id, request);
        NextBridgeId::<T>::put(bridge_id + 1);
        
        // 5. 触发事件（OCW 监听此事件）
        Self::deposit_event(Event::BridgeRequested {
            bridge_id,
            user,
            amount,
            target_address: target_addr,
        });
        
        Ok(())
    }
    
    /// 函数级详细中文注释：从 Arbitrum 解锁
    /// 
    /// ## 功能说明
    /// 1. 验证 Arbitrum 交易哈希
    /// 2. 从桥接账户解锁 DUST
    /// 3. 转账给用户
    /// 
    /// ## 参数
    /// - `origin`: 调用者（OCW 或治理）
    /// - `arbitrum_tx_hash`: Arbitrum 交易哈希
    /// - `substrate_address`: Substrate 接收地址
    /// - `amount`: DUST 数量
    #[pallet::call_index(1)]
    #[pallet::weight(T::WeightInfo::unlock_from_arbitrum())]
    pub fn unlock_from_arbitrum(
        origin: OriginFor<T>,
        arbitrum_tx_hash: Vec<u8>,
        substrate_address: T::AccountId,
        amount: BalanceOf<T>,
    ) -> DispatchResult {
        // 验证调用者（OCW 或治理）
        T::BridgeOrigin::ensure_origin(origin)?;
        
        // 1. 验证交易哈希格式
        let tx_hash: BoundedVec<u8, ConstU32<66>> = arbitrum_tx_hash
            .try_into()
            .map_err(|_| Error::<T>::InvalidTxHash)?;
        
        // 2. 防止重放攻击：检查是否已处理
        ensure!(
            !ProcessedArbitrumTxs::<T>::contains_key(&tx_hash),
            Error::<T>::TxAlreadyProcessed
        );
        
        // 3. 从桥接账户转账给用户
        let bridge_account = BridgeLockAccount::<T>::get()
            .ok_or(Error::<T>::BridgeAccountNotSet)?;
        
        T::Currency::transfer(
            &bridge_account,
            &substrate_address,
            amount,
            ExistenceRequirement::AllowDeath,
        )?;
        
        // 4. 记录已处理的交易
        ProcessedArbitrumTxs::<T>::insert(&tx_hash, ());
        
        // 5. 触发事件
        Self::deposit_event(Event::BridgeUnlocked {
            tx_hash,
            user: substrate_address,
            amount,
        });
        
        Ok(())
    }
}
```

### 2. Arbitrum - 智能合约

#### DUSTToken.sol（ERC20 代币）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title DUSTToken
 * @notice ERC20 DUST 代币合约（Arbitrum）
 * @dev 只有桥接合约可以铸造和销毁
 */
contract DUSTToken is ERC20, AccessControl {
    /// 桥接角色（有权铸造和销毁）
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    constructor() ERC20("Stardust DUST", "DUST") {
        // 部署者成为管理员
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice 铸造 DUST（仅桥接合约）
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _mint(to, amount);
    }
    
    /**
     * @notice 销毁 DUST（仅桥接合约）
     * @param from 销毁地址
     * @param amount 销毁数量
     */
    function burn(address from, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _burn(from, amount);
    }
}
```

#### DUSTBridge.sol（桥接合约）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./DUSTToken.sol";

/**
 * @title DUSTBridge
 * @notice Arbitrum 桥接合约
 * @dev 负责铸造和销毁 ERC20 DUST
 */
contract DUSTBridge is AccessControl, ReentrancyGuard {
    /// 中继角色（有权调用 mint）
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    
    /// DUST 代币合约
    DUSTToken public immutable dustToken;
    
    /// 最小桥接金额（防止粉尘攻击）
    uint256 public minBridgeAmount = 1e18; // 1 DUST
    
    /// 已处理的 Stardust 桥接 ID（防止重放攻击）
    mapping(uint64 => bool) public processedBridgeIds;
    
    /// 事件：铸造 DUST
    event BridgeMint(
        uint64 indexed bridgeId,
        address indexed to,
        uint256 amount
    );
    
    /// 事件：销毁 DUST（桥接回 Stardust）
    event BridgeBack(
        address indexed from,
        uint256 amount,
        bytes substrateAddress
    );
    
    constructor(address _dustToken) {
        dustToken = DUSTToken(_dustToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice 铸造 DUST（仅中继服务调用）
     * @param bridgeId Stardust 桥接 ID
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(
        uint64 bridgeId,
        address to,
        uint256 amount
    ) external onlyRole(RELAYER_ROLE) nonReentrant {
        require(amount >= minBridgeAmount, "Amount too low");
        require(!processedBridgeIds[bridgeId], "Bridge ID already processed");
        
        // 标记已处理
        processedBridgeIds[bridgeId] = true;
        
        // 铸造 DUST
        dustToken.mint(to, amount);
        
        emit BridgeMint(bridgeId, to, amount);
    }
    
    /**
     * @notice 销毁 DUST 并桥接回 Stardust
     * @param amount 销毁数量
     * @param substrateAddress Substrate 接收地址（SS58编码）
     */
    function burnAndBridgeBack(
        uint256 amount,
        bytes calldata substrateAddress
    ) external nonReentrant {
        require(amount >= minBridgeAmount, "Amount too low");
        require(substrateAddress.length == 32, "Invalid Substrate address");
        
        // 销毁用户的 DUST
        dustToken.burn(msg.sender, amount);
        
        emit BridgeBack(msg.sender, amount, substrateAddress);
    }
    
    /**
     * @notice 设置最小桥接金额
     * @param _minAmount 最小金额
     */
    function setMinBridgeAmount(uint256 _minAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minBridgeAmount = _minAmount;
    }
}
```

### 3. 中继服务（Relayer）

#### 实现方式 A：OCW（推荐）

```rust
/// 函数级详细中文注释：OCW 桥接中继服务
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn offchain_worker(block_number: BlockNumberFor<T>) {
        sp_runtime::print("🌉 DUST Bridge OCW 开始执行");
        
        // 1. 监听 Stardust -> Arbitrum 桥接请求
        let _ = Self::process_pending_bridges();
        
        // 2. 监听 Arbitrum -> Stardust 桥接请求
        let _ = Self::process_arbitrum_events();
    }
}

impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：处理待处理的桥接请求
    /// 
    /// 扫描 Pending 状态的桥接请求，调用 Arbitrum 合约铸造 DUST
    fn process_pending_bridges() -> Result<(), ()> {
        // 获取所有 Pending 状态的桥接
        let next_id = NextBridgeId::<T>::get();
        let start_id = if next_id > 100 { next_id - 100 } else { 0 };
        
        for bridge_id in start_id..next_id {
            if let Some(request) = BridgeRequests::<T>::get(bridge_id) {
                if request.status != BridgeStatus::Pending {
                    continue;
                }
                
                // 调用 Arbitrum 合约铸造 DUST
                match Self::call_arbitrum_mint(&request) {
                    Ok(tx_hash) => {
                        // 更新状态为 Completed
                        Self::update_bridge_status(
                            bridge_id,
                            BridgeStatus::Completed,
                            Some(tx_hash),
                        );
                    },
                    Err(e) => {
                        sp_runtime::print("❌ Arbitrum mint 失败");
                        // 可以设置重试机制
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// 函数级详细中文注释：调用 Arbitrum 合约铸造 DUST
    fn call_arbitrum_mint(
        request: &BridgeRequest<T>,
    ) -> Result<Vec<u8>, ()> {
        // 1. 构建 mint() 调用数据
        // function mint(uint64 bridgeId, address to, uint256 amount)
        let mut call_data = Vec::new();
        call_data.extend_from_slice(&hex!("40c10f19")); // mint selector
        // ... 编码参数
        
        // 2. 发送 HTTP 请求到 Arbitrum RPC
        let arbitrum_rpc = "https://arb1.arbitrum.io/rpc";
        let request = http::Request::post(arbitrum_rpc)
            .header("Content-Type", "application/json")
            .body(call_data);
        
        // 3. 等待响应
        let response = http::send(request)
            .map_err(|_| ())?;
        
        // 4. 解析交易哈希
        let tx_hash = Self::parse_tx_hash(response.body())?;
        
        Ok(tx_hash)
    }
    
    /// 函数级详细中文注释：处理 Arbitrum 事件
    /// 
    /// 监听 BridgeBack 事件，解锁 Stardust 链上的 DUST
    fn process_arbitrum_events() -> Result<(), ()> {
        // 1. 查询 Arbitrum 最新区块
        let latest_block = Self::get_arbitrum_latest_block()?;
        
        // 2. 获取 BridgeBack 事件
        let events = Self::get_arbitrum_events(latest_block)?;
        
        // 3. 处理每个事件
        for event in events {
            // 解析事件数据
            let (from, amount, substrate_addr) = Self::parse_bridge_back_event(event)?;
            
            // 提交无签名交易解锁 DUST
            let call = Call::unlock_from_arbitrum {
                arbitrum_tx_hash: event.tx_hash,
                substrate_address: substrate_addr,
                amount,
            };
            
            // 提交交易
            let _ = SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into());
        }
        
        Ok(())
    }
}
```

#### 实现方式 B：独立中继服务（可选）

如果不想使用 OCW，可以开发独立的 Node.js / Rust 中继服务：

```typescript
// relayer.ts
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ethers } from 'ethers';

// Stardust 链配置
const STARDUST_WS = 'ws://127.0.0.1:9944';
const stardustApi = await ApiPromise.create({
  provider: new WsProvider(STARDUST_WS),
});

// Arbitrum 配置
const ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc';
const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
const bridgeContract = new ethers.Contract(
  BRIDGE_ADDRESS,
  BRIDGE_ABI,
  wallet
);

// 监听 Stardust 桥接请求
stardustApi.query.system.events((events) => {
  events.forEach(async ({ event }) => {
    if (event.section === 'dustBridge' && event.method === 'BridgeRequested') {
      const [bridgeId, user, amount, targetAddress] = event.data;
      
      // 调用 Arbitrum 合约铸造 DUST
      const tx = await bridgeContract.mint(
        bridgeId.toString(),
        targetAddress.toString(),
        amount.toString()
      );
      
      await tx.wait();
      console.log(`✅ 铸造成功: ${tx.hash}`);
    }
  });
});

// 监听 Arbitrum BridgeBack 事件
bridgeContract.on('BridgeBack', async (from, amount, substrateAddress) => {
  // 调用 Stardust 解锁
  const tx = await stardustApi.tx.dustBridge.unlockFromArbitrum(
    ethers.utils.hexlify(ethers.utils.randomBytes(32)), // tx hash
    substrateAddress,
    amount.toString()
  );
  
  await tx.signAndSend(relayerAccount);
  console.log(`✅ 解锁成功`);
});
```

---

## 安全性分析

### 1. 桥接账户安全

**问题**：Stardust 链上的锁定账户持有所有桥接的 DUST，如何保证安全？

**解决方案**：多签账户

```rust
/// 设置桥接账户为多签账户
/// 需要 3/5 成员签名才能动用资金
#[pallet::call_index(10)]
pub fn set_bridge_account(
    origin: OriginFor<T>,
    account: T::AccountId,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    
    // 验证是否为多签账户
    ensure!(
        pallet_multisig::Multisigs::<T>::contains_key(&account),
        Error::<T>::NotMultisigAccount
    );
    
    BridgeLockAccount::<T>::put(account);
    Ok(())
}
```

### 2. 中继服务安全

**问题**：中继服务私钥泄露会导致什么？

**影响分析**：
- ✅ **无法盗取锁定的 DUST**（锁定在多签账户）
- ❌ **可以恶意铸造 ERC20 DUST**（中继服务有铸造权限）

**解决方案**：多节点验证 + 阈值签名

```solidity
// DUSTBridge.sol 升级版：多签验证

/// 需要 M/N 个中继节点签名才能铸造
struct MintRequest {
    uint64 bridgeId;
    address to;
    uint256 amount;
    uint8 sigCount;
    mapping(address => bool) signed;
}

mapping(uint64 => MintRequest) public mintRequests;

/// 中继节点签名
function signMint(
    uint64 bridgeId,
    address to,
    uint256 amount
) external onlyRole(RELAYER_ROLE) {
    MintRequest storage req = mintRequests[bridgeId];
    require(!req.signed[msg.sender], "Already signed");
    
    req.signed[msg.sender] = true;
    req.sigCount++;
    
    // 达到阈值（如 3/5）则执行铸造
    if (req.sigCount >= THRESHOLD) {
        dustToken.mint(to, amount);
        emit BridgeMint(bridgeId, to, amount);
    }
}
```

### 3. 重放攻击防护

**Stardust 链**：
```rust
/// 防止同一个 Arbitrum 交易被多次处理
#[pallet::storage]
pub type ProcessedArbitrumTxs<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BoundedVec<u8, ConstU32<66>>,  // Arbitrum tx hash
    (),
>;
```

**Arbitrum 合约**：
```solidity
/// 防止同一个 Stardust 桥接 ID 被多次铸造
mapping(uint64 => bool) public processedBridgeIds;
```

### 4. 金额验证

```rust
/// Stardust 链验证
ensure!(amount >= T::MinBridgeAmount::get(), Error::<T>::BelowMinimumAmount);
ensure!(amount <= T::MaxBridgeAmount::get(), Error::<T>::AboveMaximumAmount);
```

```solidity
// Arbitrum 合约验证
require(amount >= minBridgeAmount, "Amount too low");
require(amount <= maxBridgeAmount, "Amount too high");
```

---

## 成本分析

### Gas 成本

| 操作 | 网络 | Gas 成本 | 折合费用（估算） |
|------|------|----------|-----------------|
| **锁定 DUST** | Stardust | 0.01 DUST | $0.0001 |
| **铸造 ERC20 DUST** | Arbitrum | ~50,000 gas | $0.005（1 gwei） |
| **销毁 ERC20 DUST** | Arbitrum | ~30,000 gas | $0.003（1 gwei） |
| **解锁 DUST** | Stardust | 0.01 DUST | $0.0001 |

**总成本**：
- Stardust → Arbitrum: ~$0.005
- Arbitrum → Stardust: ~$0.003

### 运维成本

- **中继服务器**：$10/月（AWS t3.small）
- **RPC 费用**：免费（公共 RPC）或 $50/月（私有 RPC）
- **人力成本**：1 人维护

---

## 部署流程

### 阶段 1：开发与测试（1-2 周）

1. **开发 pallet-dust-bridge**
   - [ ] 实现核心接口
   - [ ] 编写单元测试
   - [ ] 集成到 runtime

2. **开发 Arbitrum 合约**
   - [ ] 编写 DUSTToken.sol
   - [ ] 编写 DUSTBridge.sol
   - [ ] 编写单元测试（Hardhat）

3. **开发中继服务**
   - [ ] 选择实现方式（OCW 或独立服务）
   - [ ] 实现事件监听
   - [ ] 实现交易提交

4. **测试网部署**
   - [ ] 部署到 Stardust 测试网
   - [ ] 部署到 Arbitrum Sepolia
   - [ ] 端到端测试

### 阶段 2：审计与安全（2-3 周）

1. **代码审计**
   - [ ] Substrate pallet 审计
   - [ ] Solidity 合约审计（推荐：OpenZeppelin, Trail of Bits）

2. **渗透测试**
   - [ ] 重放攻击测试
   - [ ] 金额溢出测试
   - [ ] 权限绕过测试

### 阶段 3：主网部署（1 周）

1. **Arbitrum 主网部署**
   - [ ] 部署 DUSTToken 合约
   - [ ] 部署 DUSTBridge 合约
   - [ ] 授予 BRIDGE_ROLE 权限
   - [ ] 配置多签账户（Gnosis Safe）

2. **Stardust 主网部署**
   - [ ] Runtime 升级（添加 pallet-dust-bridge）
   - [ ] 创建多签桥接账户（5/3 多签）
   - [ ] 启动中继服务

3. **监控与告警**
   - [ ] 设置 Grafana 监控
   - [ ] 配置告警规则（余额不足、交易失败等）

### 阶段 4：运营与维护（持续）

1. **流动性引导**
   - 在 Uniswap 创建 DUST/USDC 流动性池
   - 初始流动性：100,000 DUST + 10,000 USDC

2. **用户教育**
   - 编写桥接教程
   - 制作视频指南

---

## 总结与建议

### ✅ 推荐方案

**锁定-铸造桥接 + OCW 中继服务**

**理由**：
1. **简单可靠**：架构清晰，易于审计
2. **成本低**：无需第三方桥接服务
3. **安全性高**：多签账户 + 多节点验证
4. **自主可控**：完全掌握桥接逻辑

### 📅 实施时间表

| 阶段 | 时间 | 里程碑 |
|------|------|--------|
| **开发与测试** | 第 1-2 周 | 测试网上线 |
| **审计与安全** | 第 3-5 周 | 审计报告 |
| **主网部署** | 第 6 周 | 主网上线 |
| **运营与维护** | 持续 | 流动性引导 |

### 💡 后续优化方向

1. **零知识证明（ZK）桥接**：使用 zkSNARK 提高隐私性
2. **快速终局性**：接入 Polkadot 中继链（如果 Stardust 成为平行链）
3. **多链扩展**：支持桥接到 Ethereum、BSC、Polygon 等

---

## 附录

### A. 参考资料

- [Polkadot XCM 文档](https://wiki.polkadot.network/docs/learn-xcm)
- [LayerZero 白皮书](https://layerzero.network/pdf/LayerZero_Whitepaper_Release.pdf)
- [Wormhole 架构](https://docs.wormhole.com/wormhole/)
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)

### B. 开源桥接项目

- [ChainBridge](https://github.com/ChainSafe/ChainBridge)
- [Snowbridge (Polkadot ↔ Ethereum)](https://github.com/Snowfork/snowbridge)
- [Celer cBridge](https://github.com/celer-network/cBridge-contracts)

---

**文档版本**: v1.0  
**最后更新**: 2025-11-05  
**作者**: Stardust AI 团队

