# 为什么使用 USDC 和 stUSDC？

**问题：** 在 Stardust AI 交易系统中，为什么选择 USDC 和 stUSDC 而不是其他代币？

**日期：** 2025-11-04

---

## 📋 快速回答

### USDC (USD Coin)

```
USDC 是什么？
├─ 美元稳定币（1 USDC = 1 USD）
├─ 由 Circle 发行
├─ 完全由美元储备支持
└─ 最广泛使用的稳定币之一
```

**为什么用 USDC？**
- ✅ **Hyperliquid 唯一支持的货币** ⭐ 最重要原因
- ✅ 价格稳定（不会像 BTC、ETH 那样波动）
- ✅ 流动性最好（交易所、DEX 都支持）
- ✅ 用户熟悉（标准的加密货币交易货币）

### stUSDC (Stardust USDC)

```
stUSDC 是什么？
├─ Stardust 金库的份额代币
├─ 类似于银行存款凭证
├─ 价值随 AI 策略盈亏变动
└─ 可以自由转让和交易
```

**为什么用 stUSDC？**
- ✅ 代表用户在金库中的份额
- ✅ 自动反映 AI 交易盈亏
- ✅ 可以在 DEX 上自由交易（退出通道）
- ✅ 标准 ERC20 代币（兼容性好）

---

## 🔍 详细解释

### 第一部分：为什么必须用 USDC？

#### 1. Hyperliquid 的技术限制

根据 **Hyperliquid 官方文档**：

```
Hyperliquid Bridge（官方桥接合约）：
地址: 0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7

存款流程：
"The user sends native USDC to the bridge, 
and it is credited to the account that sent it 
in less than 1 minute."

关键：只支持 USDC！
```

**官方桥接代码：**
```solidity
// https://github.com/hyperliquid-dex/contracts/blob/master/Bridge2.sol

contract Bridge2 {
    IERC20 public immutable USDC;  // 🔑 硬编码为 USDC
    
    function deposit(uint256 amount) external {
        // 只能存入 USDC
        USDC.transferFrom(msg.sender, address(this), amount);
        // ...
    }
}
```

**结论：** Hyperliquid 在架构层面**只支持 USDC**，我们无法选择其他代币。

#### 2. Hyperliquid 交易结算货币

```
在 Hyperliquid 上交易：
├─ 保证金：USDC
├─ 盈亏结算：USDC
├─ 手续费支付：USDC
└─ 账户余额：USDC

交易示例：
用户账户有 10,000 USDC
├─ 开多 BTC，使用保证金 5,000 USDC
├─ BTC 上涨 10%
└─ 盈利 500 USDC → 账户余额变为 10,500 USDC
```

**所有操作都是 USDC 计价！**

#### 3. 为什么不用其他稳定币？

| 稳定币 | Hyperliquid 支持？ | 说明 |
|--------|------------------|------|
| **USDC** | ✅ 支持 | 唯一官方支持 |
| USDT | ❌ 不支持 | Tether 发行，流动性虽大但 HL 不支持 |
| DAI | ❌ 不支持 | MakerDAO 发行的去中心化稳定币 |
| BUSD | ❌ 不支持 | Binance 发行（已停止） |

**官方文档明确说明：**
> "The minimum deposit amount is 5 USDC. If you send an amount less than this, it will not be credited and be lost forever."

只接受 USDC，发送其他代币会**永久丢失**！⚠️

---

### 第二部分：为什么设计 stUSDC？

#### 问题：为什么不直接给用户 USDC？

假设没有 stUSDC，直接管理 USDC：

```
❌ 问题1：份额计算复杂

用户 A 存入 10,000 USDC（第1天）
用户 B 存入 10,000 USDC（第10天，金库已盈利 10%）

问题：B 应该获得多少份额？
- 如果按 USDC 数量：不公平（A 承担了前期风险）
- 如果按百分比：需要复杂的链上计算

✅ stUSDC 方案：
- A 获得 10,000 stUSDC（净值 1.0）
- B 获得 9,091 stUSDC（净值 1.1）
- 自动公平分配！
```

```
❌ 问题2：盈亏分配困难

金库总资产 100,000 USDC，AI 盈利 10,000 USDC
用户 A 持有 60% 份额
用户 B 持有 40% 份额

问题：如何分配盈利？
- 需要遍历所有用户
- 需要记录每个用户的存入时间
- 需要计算每个用户的加权平均成本

✅ stUSDC 方案：
- 净值从 1.0 涨到 1.1
- A 的 60,000 stUSDC 自动值 66,000 USDC
- B 的 40,000 stUSDC 自动值 44,000 USDC
- 无需任何计算！
```

```
❌ 问题3：退出困难

用户想退出，但金库资金在 Hyperliquid 交易
如何赎回 USDC？
- 需要从 Hyperliquid 提现（3-4 分钟）
- 需要等待清算持仓
- 用户体验差

✅ stUSDC 方案：
- 用户直接在 Uniswap 兑换 stUSDC → USDC
- 无需等待
- 即时退出！
```

#### stUSDC 的设计灵感

这个设计来自传统金融和 DeFi 的成功案例：

| 项目 | 份额代币 | 基础资产 |
|------|---------|---------|
| **Aave** | aUSDC | USDC（借贷池） |
| **Compound** | cUSDC | USDC（借贷池） |
| **Yearn** | yvUSDC | USDC（收益策略） |
| **Stardust** | **stUSDC** | **USDC（AI交易金库）** ✅ |

**标准的 DeFi 模式！**

---

## 🏗️ 完整资金流

### 架构图

```
用户视角：

步骤1: 存入 USDC
用户持有 USDC (Arbitrum)
    ↓ 授权 + 存入
StardustVault 合约
    ↓ 铸造
用户获得 stUSDC（价值 = 存入的 USDC）

步骤2: AI 交易（自动）
StardustVault 通过桥接发送 USDC 到 Hyperliquid
    ↓
Hyperliquid 执行 AI 策略交易
    ├─ 开多 BTC
    ├─ 做空 ETH
    └─ 网格交易 SOL
    ↓ 盈利
Hyperliquid 账户余额增加
    ↓
OCW 更新 Vault 净值
    ↓
stUSDC 净值上涨（1.0 → 1.1）

步骤3: 用户退出
用户持有 stUSDC（净值 1.1）
    ↓ 在 Uniswap 兑换
获得 USDC（包含盈利）
```

### 具体例子

```typescript
// 用户 Alice 的完整流程

// === 第1天：存入 ===
Alice 持有: 10,000 USDC

await usdc.approve(vaultAddress, 10000e6);
await vault.deposit(10000e6);

Alice 获得: 10,000 stUSDC（净值 1.0）
金库总资产: 10,000 USDC

// === 第10天：AI 盈利 10% ===
金库在 Hyperliquid 交易盈利 1,000 USDC
金库总资产: 11,000 USDC
stUSDC 净值: 11,000 / 10,000 = 1.1

Alice 持有: 10,000 stUSDC
Alice 资产价值: 10,000 × 1.1 = 11,000 USDC

// === 第20天：Alice 退出 ===
await stUsdc.approve(uniswapRouter, 10000e18);
await uniswap.swap(
    10000e18,  // 卖出 10,000 stUSDC
    10900e6    // 预期获得 ~10,900 USDC（扣除 0.3% 手续费）
);

Alice 最终获得: 10,900 USDC
Alice 净利润: 900 USDC (9%)
```

---

## 🤔 常见疑问

### Q1: 为什么不用 ETH 或 BTC？

**答：**
1. ❌ Hyperliquid 不支持（只支持 USDC）
2. ❌ 价格波动大（用户难以计算收益）
3. ❌ 不适合做账户单位

```
假设用 ETH：

用户存入 10 ETH（当时 $2000/ETH = $20,000）
AI 策略盈利 10%（以 USDC 计）
金库总价值 $22,000

问题：用户应该获得多少 ETH？
- 如果 ETH 涨到 $2500：22,000 / 2500 = 8.8 ETH ❓
- 用户会困惑：我存了 10 ETH，为什么只能取 8.8？

结论：稳定币才适合做计价单位！
```

### Q2: 为什么不用 DUST 作为基础资产？

**答：**
1. ❌ Hyperliquid 不支持 DUST
2. ❌ DUST 价格波动，难以计算收益
3. ✅ 但我们提供了 DUST 兑换入口（见 DUST 兑换方案）

```
推荐的方案（已设计）：

用户流程：
DUST → (自动兑换) → USDC → 存入 Vault → 获得 stUSDC
  ↑                                              ↓
  └─────────── (自动兑换) ← 取出 stUSDC ←────────┘

用户只接触 DUST，中间的 USDC 转换对用户透明！
```

### Q3: stUSDC 和 USDC 有什么区别？

| 特性 | USDC | stUSDC |
|------|------|--------|
| **价格** | 固定 $1 | ⚠️ 浮动（跟随金库净值） |
| **发行方** | Circle | Stardust Vault 合约 |
| **用途** | 交易、支付 | 代表金库份额 |
| **流动性** | ✅ 极高 | ⚠️ 取决于 Uniswap 池深度 |
| **风险** | ✅ 低（美元支持） | ⚠️ 中（取决于 AI 策略） |

**类比：**
- USDC = 现金
- stUSDC = 基金份额凭证

### Q4: stUSDC 会不会低于面值（<1 USDC）？

**答：** 有可能！取决于 AI 策略表现。

```
情况1: AI 策略盈利 10%
└─ stUSDC 净值 = 1.1 USDC ✅ 高于面值

情况2: AI 策略亏损 5%
└─ stUSDC 净值 = 0.95 USDC ⚠️ 低于面值

情况3: AI 策略大幅亏损 50%
└─ stUSDC 净值 = 0.5 USDC 💀 大幅低于面值

风险提示：
用户存入前需要理解：stUSDC 不是稳定币，价值会波动！
```

---

## 🆚 其他可能的设计对比

### 设计A：直接用 USDC（无份额代币）

```solidity
contract VaultWithoutShares {
    mapping(address => uint256) public deposits;  // 用户存款
    
    function deposit(uint256 amount) external {
        deposits[msg.sender] += amount;
    }
    
    function withdraw() external {
        // ❌ 问题：如何计算用户应得的 USDC？
        // 需要复杂的加权平均算法
    }
}
```

**缺点：**
- ❌ 无法公平分配盈亏
- ❌ 退出需要等待流动性
- ❌ 无法在 DEX 交易

### 设计B：用 NFT 代表份额

```solidity
contract VaultWithNFT {
    // 每个用户持有一个 NFT，记录存入信息
    struct Position {
        uint256 usdcAmount;
        uint256 timestamp;
    }
    
    mapping(uint256 => Position) public positions;
}
```

**缺点：**
- ❌ 无法分割（用户不能部分退出）
- ❌ DEX 流动性差（NFT 难以定价）
- ❌ Gas 费高

### 设计C：用 stUSDC（我们的方案）✅

```solidity
contract VaultWithShares is ERC20 {
    function deposit(uint256 usdcAmount) external {
        uint256 shares = calculateShares(usdcAmount);
        _mint(msg.sender, shares);
    }
    
    function getSharePrice() external view returns (uint256) {
        return totalNetAssetValue / totalSupply();
    }
}
```

**优点：**
- ✅ 自动公平分配
- ✅ 可在 DEX 交易
- ✅ 标准 ERC20（兼容性好）
- ✅ 可分割（灵活退出）

---

## 📊 Uniswap 流动性池

### 为什么需要 stUSDC/USDC 池？

```
问题：用户想退出，但...

方案1: 直接从 Vault 提取 USDC
├─ 需要从 Hyperliquid 提现（3-4 分钟）
├─ 需要清算持仓
├─ 可能需要等待队列
└─ ❌ 用户体验差

方案2: 在 Uniswap 兑换 stUSDC → USDC ✅
├─ 即时完成（几秒钟）
├─ 无需等待
├─ 24/7 可用
└─ ✅ 用户体验好
```

### 流动性池设计

```
Uniswap V3 池: stUSDC / USDC
├─ 初始流动性: 100,000 stUSDC + 100,000 USDC
├─ 手续费: 0.3%
├─ 价格区间: 0.95 - 1.05（紧密跟随净值）
└─ LP 奖励: 从利润中分配

用户退出：
1. 用户在 Uniswap 卖出 stUSDC
2. 获得 USDC（扣除 0.3% 手续费）
3. 即时到账
```

---

## 🎯 总结

### USDC 的原因

| 原因 | 重要性 |
|------|--------|
| Hyperliquid 唯一支持 | ⭐⭐⭐⭐⭐ 决定性 |
| 价格稳定 | ⭐⭐⭐⭐ 重要 |
| 流动性最好 | ⭐⭐⭐⭐ 重要 |
| 用户熟悉 | ⭐⭐⭐ 次要 |

**结论：没得选，必须用 USDC！**

### stUSDC 的原因

| 原因 | 重要性 |
|------|--------|
| 公平分配盈亏 | ⭐⭐⭐⭐⭐ 核心功能 |
| 即时退出通道 | ⭐⭐⭐⭐⭐ 用户体验 |
| DEX 可交易 | ⭐⭐⭐⭐ 流动性 |
| 标准 ERC20 | ⭐⭐⭐ 兼容性 |

**结论：最优方案，行业标准！**

---

## 💡 关键要点

```
记住这3点：

1. USDC = Hyperliquid 要求（无法改变）
   └─ 这是外部约束

2. stUSDC = 份额代币（我们的设计）
   ├─ 代表用户在金库中的份额
   ├─ 净值随 AI 策略波动
   └─ 可在 DEX 交易退出

3. DUST 兑换 = 用户友好（我们的增强）
   ├─ 用户只需持有 DUST
   ├─ Router 自动完成 DUST ↔ USDC 兑换
   └─ 对用户透明
```

---

## 📚 相关文档

- [Hyperliquid Bridge 官方文档](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/bridge2)
- [以太坊合约资金池方案](./以太坊合约-资金池方案.md)
- [DUST 代币兑换方案](./DUST代币兑换方案分析.md)

---

*文档创建时间: 2025-11-04*  
*作者: Stardust Team*

