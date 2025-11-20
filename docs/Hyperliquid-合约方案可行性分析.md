# Hyperliquid 合约方案替代私钥的可行性分析

**问题：** 能否用合约的形式替代私钥，实现 Stardust OCW 与 Hyperliquid 的交互？

**日期：** 2025-11-04

---

## 📊 方案对比总表

| 方案 | 可行性 | 安全性 | 实现难度 | 推荐度 |
|------|--------|--------|----------|--------|
| 方案1：API Wallet (代理钱包) | ✅ 完全可行 | ⭐⭐⭐⭐ | 简单 | ⭐⭐⭐⭐⭐ **强烈推荐** |
| 方案2：Hyperliquid 智能合约托管 | ❌ 暂不支持 | ⭐⭐⭐⭐⭐ | - | ⭐ 需等待官方支持 |
| 方案3：以太坊合约托管 + 跨链桥 | ⚠️ 理论可行 | ⭐⭐⭐ | 极高 | ⭐⭐ 不推荐（复杂） |
| 方案4：Account Abstraction (AA) | ⚠️ 需确认支持 | ⭐⭐⭐⭐ | 中等 | ⭐⭐⭐ 未来方向 |

---

## ✅ 方案1：API Wallet（代理钱包）- **强烈推荐**

### 核心思路

根据 Hyperliquid 官方文档，**API Wallets (Agent Wallets)** 机制可以完美解决我们的需求：

```
┌─────────────────────────────────────────────────────────────┐
│ 用户的主账户 (Master Account)                                │
│ - 地址: 0xUser123...                                         │
│ - 资金: $10,000 USDC                                         │
│ - 私钥: 🔐 用户完全控制，不暴露                              │
│                                                               │
│  通过 ApproveAgent 授权 ▼                                    │
└───────────────────────────────────────────────────────────────┘
                        │
                        │ 授权签名权限（可撤销）
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ API Wallet (代理钱包) - 专门为 Stardust 策略创建              │
│ - 地址: 0xAgent456...                                        │
│ - 资金: $0 (不需要资金！)                                    │
│ - 私钥: 存储在 OCW Keystore 或签名服务                       │
│ - 权限: 只能代表主账户交易，无法提取资金                      │
│ - 可撤销: 用户随时可以取消授权                               │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ 签名交易
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ Stardust OCW                                                 │
│ - 使用 API Wallet 私钥签名                                   │
│ - 代表主账户在 Hyperliquid 交易                              │
│ - 即使 API Wallet 私钥泄露，攻击者也无法提取资金              │
└─────────────────────────────────────────────────────────────┘
```

### 工作流程

#### 1️⃣ 用户创建 API Wallet 并授权

```typescript
// 前端操作（一次性设置）

import { ethers } from 'ethers';

// 步骤1: 生成一个新的 API Wallet（离线生成）
const apiWallet = ethers.Wallet.createRandom();
console.log('API Wallet 地址:', apiWallet.address);
console.log('API Wallet 私钥:', apiWallet.privateKey);  // 稍后导入到 OCW

// 步骤2: 用户使用主账户签名授权 API Wallet
const domain = {
  name: 'Hyperliquid',
  version: '1',
  chainId: 42161,  // Arbitrum
  verifyingContract: '0x0000000000000000000000000000000000000000'
};

const types = {
  Agent: [
    { name: 'source', type: 'string' },
    { name: 'connectionId', type: 'bytes32' }
  ]
};

const message = {
  source: 'stardust',  // 可选：命名这个 API Wallet
  connectionId: ethers.utils.keccak256(apiWallet.address)
};

// 用户使用主钱包签名（MetaMask 或其他）
const signature = await userWallet._signTypedData(domain, types, message);

// 步骤3: 提交授权到 Hyperliquid
const approveAgentPayload = {
  action: {
    type: 'approveAgent',
    agentAddress: apiWallet.address,
    agentName: 'Stardust-Strategy-001',  // 可选命名
    nonce: Date.now()
  },
  signature: signature
};

await fetch('https://api.hyperliquid.xyz/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(approveAgentPayload)
});

console.log('✅ API Wallet 已授权！');
```

#### 2️⃣ 将 API Wallet 私钥导入 OCW

```bash
# 方式A: 导入到节点 Keystore
./target/release/stardust-node key insert \
  --base-path /home/user/.stardust \
  --chain dev \
  --scheme Ecdsa \
  --suri "${apiWallet.privateKey}" \
  --key-type hliq

# 方式B: 导入到签名服务
export HL_API_WALLET_KEY="${apiWallet.privateKey}"
```

#### 3️⃣ OCW 使用 API Wallet 签名交易

```rust
// pallets/ai-strategy/src/ocw.rs

impl<T: Config> Pallet<T> {
    fn execute_hyperliquid_trade(
        strategy: &AITradingStrategy<T::AccountId, T::Moment>,
        signal: &AISignalRecord,
    ) -> Result<Vec<u8>, &'static str> {
        // 1. 获取 API Wallet 的地址（从策略配置读取）
        let api_wallet_address = &strategy.api_wallet_address;
        
        // 2. 构建订单（注意：账户使用主账户地址）
        let order = HyperliquidOrder {
            user: strategy.hl_address.clone(),  // 🔑 主账户地址
            // ... 其他订单参数
        };
        
        // 3. 使用 API Wallet 私钥签名（从 Keystore 获取）
        let signature = Self::sign_with_api_wallet(api_wallet_address, &order)?;
        
        // 4. 提交到 Hyperliquid
        let payload = json!({
            "action": {
                "type": "order",
                "orders": [order],
                "grouping": "na"
            },
            "nonce": Self::get_nonce(),
            "signature": signature,
            "vault_address": null  // 非 vault 用户为 null
        });
        
        Self::send_to_hyperliquid(&payload)
    }
}
```

#### 4️⃣ 用户随时可以撤销授权

```typescript
// 用户撤销 API Wallet 授权
const revokePayload = {
  action: {
    type: 'approveAgent',
    agentAddress: apiWallet.address,
    agentName: null,  // 设为 null 表示撤销
    nonce: Date.now()
  },
  signature: await userWallet.sign(...)
};

// 提交后，API Wallet 立即失效
```

### 安全性分析

| 安全问题 | API Wallet 方案的保护 |
|---------|---------------------|
| **私钥泄露** | ✅ 即使 API Wallet 私钥泄露，攻击者也**无法提取资金**（只能交易） |
| **资金安全** | ✅ 资金始终在主账户，API Wallet 余额为 $0 |
| **权限控制** | ✅ 用户可以随时撤销授权 |
| **审计追踪** | ✅ 所有交易都有链上记录，可追溯到 API Wallet |
| **最坏情况** | ⚠️ 攻击者可以用泄露的 API Wallet 进行恶意交易（但无法提款） |

### 风险限制措施

虽然 API Wallet 私钥泄露不会导致资金被盗，但可能导致恶意交易。我们可以在 Stardust 链上增加额外的风控：

```rust
// pallets/ai-strategy/src/lib.rs

pub struct RiskLimits {
    /// 每日最大交易次数
    pub max_daily_trades: u32,
    /// 每笔最大交易金额
    pub max_trade_size: u64,
    /// 允许的交易对白名单
    pub allowed_symbols: BoundedVec<Vec<u8>, ConstU32<10>>,
    /// 最大持仓时间（秒）
    pub max_position_duration: u32,
}

impl<T: Config> Pallet<T> {
    fn validate_trade_limits(
        strategy_id: u64,
        trade_size: u64,
    ) -> Result<(), Error<T>> {
        let strategy = AIStrategies::<T>::get(strategy_id)
            .ok_or(Error::<T>::StrategyNotFound)?;
        
        // 检查每日交易次数
        let today_trades = Self::get_daily_trade_count(strategy_id);
        ensure!(
            today_trades < strategy.risk_limits.max_daily_trades,
            Error::<T>::DailyTradeLimitExceeded
        );
        
        // 检查交易金额
        ensure!(
            trade_size <= strategy.risk_limits.max_trade_size,
            Error::<T>::TradeSizeLimitExceeded
        );
        
        Ok(())
    }
}
```

### 优势总结

✅ **无需主账户私钥**：主账户私钥完全由用户控制，永不暴露  
✅ **资金安全**：即使 API Wallet 私钥泄露，资金仍安全  
✅ **官方支持**：Hyperliquid 原生机制，无需额外开发  
✅ **易于撤销**：用户随时可以取消授权  
✅ **多策略隔离**：每个策略可以用不同的 API Wallet  
✅ **符合最佳实践**：Hyperliquid 官方推荐用于自动化交易  

### 实现难度

🟢 **简单**
- 前端增加 "生成 API Wallet" 和 "授权" 功能
- 链上类型增加 `api_wallet_address` 字段
- OCW 使用 API Wallet 签名（与之前方案类似）

---

## ❌ 方案2：Hyperliquid 智能合约托管

### 理想方案

```solidity
// 假设 Hyperliquid 支持智能合约（目前不支持）
contract StardustTradingVault {
    mapping(address => Strategy) public strategies;
    
    struct Strategy {
        address owner;
        uint256 maxTradeSize;
        bool enabled;
    }
    
    // 用户存入资金
    function deposit() external payable {
        // 资金锁定在合约中
    }
    
    // OCW 调用（无需私钥）
    function executeTrade(
        uint256 strategyId,
        bytes calldata aiSignal,
        bytes calldata oracleProof
    ) external {
        // 合约自动验证并执行交易
        // 通过 Hyperliquid 的合约接口下单
    }
}
```

### 现状分析

❌ **Hyperliquid 当前不支持智能合约**
- Hyperliquid 是订单簿 DEX，专注于高性能交易
- 目前没有发现智能合约部署功能
- 所有交易必须通过 EIP-712 签名

⚠️ **未来可能性**
- Hyperliquid 可能在未来版本支持合约
- 需要关注官方路线图更新

---

## ⚠️ 方案3：以太坊合约托管 + 跨链桥

### 架构

```
用户 → 以太坊合约存入资金 
         ↓
    跨链桥锁定 USDC
         ↓
    Hyperliquid 铸造资金
         ↓
    预言机验证交易信号
         ↓
    Hyperliquid Vault 执行交易
```

### 问题

❌ **复杂度极高**
- 需要开发跨链桥合约
- 需要可信预言机验证 Stardust 链上的 AI 信号
- 延迟高（以太坊确认 + 跨链 + Hyperliquid 执行）

❌ **安全风险**
- 跨链桥是黑客主要攻击目标
- 预言机可能被操纵

💰 **成本高**
- 以太坊 Gas 费
- 跨链桥手续费

**结论：** 不推荐，收益远小于风险和成本

---

## ⚠️ 方案4：Account Abstraction (账户抽象)

### 核心思路

使用 ERC-4337 账户抽象，将私钥管理委托给智能合约钱包。

```
用户的 AA 钱包 (Smart Contract Wallet)
    ├── 无需私钥
    ├── 规则：只允许来自 Stardust OCW 的交易
    └── 验证：检查 OCW 签名 + AI 策略规则
```

### 可行性

⚠️ **需要确认 Hyperliquid 是否支持 ERC-4337**
- Hyperliquid 基于 Arbitrum，理论上可能支持
- 官方文档未提及 AA 支持
- 需要进一步调研

🔍 **调研方向**
- 查看 Hyperliquid 是否有 Bundler 节点
- 测试 UserOperation 是否能被接受
- 联系 Hyperliquid 官方确认

---

## 🎯 最终推荐方案

### 短期（立即实施）：API Wallet 方案

**理由：**
1. ✅ 完全符合我们的需求（无需暴露主账户私钥）
2. ✅ Hyperliquid 官方原生支持
3. ✅ 实现简单，风险可控
4. ✅ 符合官方最佳实践

**实施步骤：**
1. 修改 `AITradingStrategy` 结构，增加 `api_wallet_address` 字段
2. 前端增加 "生成并授权 API Wallet" 功能
3. OCW 使用 API Wallet 签名（保持现有架构）
4. 增加链上风控限制

### 中期（跟进观察）：Account Abstraction

**待确认：**
- Hyperliquid 是否支持 ERC-4337
- 性能和成本如何

### 长期（关注发展）：Hyperliquid 智能合约

**等待：**
- Hyperliquid 官方推出合约功能
- 届时可以完全去私钥化

---

## 📋 实施清单

### 阶段1：数据结构修改

```rust
// pallets/ai-strategy/src/types.rs

pub struct AITradingStrategy<AccountId, Moment> {
    // 现有字段...
    
    /// ✨ 新增：API Wallet 地址（代理钱包）
    /// 用于代表主账户签名交易
    /// 用户可以随时在 Hyperliquid 撤销授权
    pub api_wallet_address: BoundedVec<u8, ConstU32<42>>,
    
    /// 主账户地址（资金所在地址）
    pub hl_address: BoundedVec<u8, ConstU32<42>>,
}
```

### 阶段2：前端增强

```typescript
// stardust-dapp/src/components/CreateStrategyForm.tsx

// 新增步骤1：生成 API Wallet
const handleGenerateApiWallet = async () => {
  const wallet = ethers.Wallet.createRandom();
  
  setApiWallet({
    address: wallet.address,
    privateKey: wallet.privateKey
  });
  
  message.success('API Wallet 已生成！请保存私钥并授权。');
};

// 新增步骤2：授权 API Wallet
const handleApproveApiWallet = async () => {
  // 构建 EIP-712 签名
  // 提交到 Hyperliquid
  // 显示授权状态
};
```

### 阶段3：OCW 适配

```rust
// pallets/ai-strategy/src/ocw.rs

// 修改签名逻辑，使用 API Wallet 代替主账户
fn sign_order(
    api_wallet_address: &[u8],  // 签名者：API Wallet
    user_address: &[u8],         // 账户：主账户
    order: &Order,
) -> Result<Signature, Error> {
    // 从 Keystore 获取 API Wallet 私钥
    // 签名订单（代表主账户）
}
```

---

## 📚 参考资料

- [Hyperliquid API Wallets 文档](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets)
- [Hyperliquid 签名指南](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing)
- [ERC-4337 账户抽象](https://eips.ethereum.org/EIPS/eip-4337)
- [Hyperliquid Python SDK](https://github.com/hyperliquid-dex/hyperliquid-python-sdk)

---

## 🎉 结论

**API Wallet 方案完美解决了"不暴露私钥"的需求！**

✅ 用户主账户私钥完全由用户控制  
✅ OCW 只使用低权限的 API Wallet  
✅ 即使 API Wallet 泄露，资金仍安全  
✅ Hyperliquid 官方原生支持，无需额外开发  

**这就是我们要找的"合约"方案的最佳替代！**

---

*文档创建时间: 2025-11-04*
*作者: Stardust Team*

