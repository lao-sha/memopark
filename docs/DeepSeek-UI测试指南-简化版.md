# DeepSeek AI 策略 - UI 测试指南（简化版）

## 📋 准备信息

- **节点地址**: `ws://127.0.0.1:9944` ✅
- **测试账户助记词**: `satoshi sure behave certain impulse ski slight track century kitchen clutch story`
- **账户地址**: `5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4`
- **DeepSeek API Key**: `sk-6b158668334e4512990806a3a800b845`

---

## 🌐 第一步：打开 Polkadot.js Apps

**点击以下链接直接打开（推荐）:**

```
https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944#/explorer
```

或者手动操作：
1. 打开浏览器访问: https://polkadot.js.org/apps/
2. 点击左上角网络图标
3. 在底部"Development"中选择"Local Node"
4. 或手动输入: `ws://127.0.0.1:9944`

**验证连接成功**：左上角应显示 "Development" 和绿色的圆点 🟢

---

## 👤 第二步：导入测试账户

1. 点击顶部 **"Accounts"**
2. 点击 **"Add account"**
3. 选择 **"Restore JSON"** 或 **"From seed phrase"**
4. 输入助记词:
   ```
   satoshi sure behave certain impulse ski slight track century kitchen clutch story
   ```
5. 点击 **"Next"**
6. 设置名称: `DeepSeek Test`
7. 设置密码（可选，例如: `123456`）
8. 点击 **"Add the account with the supplied seed"**

**验证**: 应该看到地址 `5CrDBE...rHUW4`，余额很大（测试账户）

---

## 📝 第三步：创建 DeepSeek 策略

### 3.1 打开交易界面

1. 点击顶部 **"Developer"** → **"Extrinsics"**
2. 选择账户: `DeepSeek Test`
3. 选择 module: **`aiStrategy`**
4. 选择 call: **`createAiStrategy(...)`**

### 3.2 填写参数（按顺序）

#### 📌 name (策略名称)
```
DeepSeek BTC Strategy
```

#### 📌 hl_address (Hyperliquid地址)
```
0x1234567890abcdef12345678
```

#### 📌 symbol (交易对)
```
BTC-USD
```

#### 📌 ai_config (AI配置) - **关键部分** ⭐

展开后逐个填写：

1. **primaryModel**: 下拉选择 → **`DeepSeek`** ✨ (这是新添加的!)
2. **fallbackModel**: 选择 `Some` → 下拉选择 → `LSTM`
3. **inferenceEndpoint**: 
   ```
   https://api.deepseek.com/chat/completions
   ```
4. **apiKeyHash** (32字节数组): 
   ```
   0x0000000000000000000000000000000000000000000000000000000000000000
   ```
5. **confidenceThreshold**: `70`
6. **featuresEnabled**: 
   - 点击 **"Add item"** → 选择 `TechnicalIndicators`
   - 再点 **"Add item"** → 选择 `MarketMicrostructure`
   - 再点 **"Add item"** → 选择 `SocialSentiment`
7. **inferenceTimeoutSecs**: `30`
8. **maxRetries**: `2`
9. **modelVersion**: 
   ```
   deepseek-chat
   ```

#### 📌 strategy_type (策略类型)
下拉选择: **`Grid`**

#### 📌 strategy_params (策略参数)

展开后填写（只填写网格相关的，其他选 None）:

1. **gridLowerPrice**: `Some` → `40000000000`
2. **gridUpperPrice**: `Some` → `50000000000`
3. **gridLevels**: `Some` → `10`
4. **gridOrderSize**: `Some` → `1000000000`
5. **mmSpreadBps**: `None`
6. **mmOrderSize**: `None`
7. **mmDepthLevels**: `None`
8. **arbMinProfitBps**: `None`
9. **arbMaxSlippageBps**: `None`
10. **dcaIntervalBlocks**: `None`
11. **dcaAmountPerOrder**: `None`

#### 📌 risk_limits (风控限制)

1. **maxPositionSize**: `10000000000`
2. **maxLeverage**: `30` (实际是3.0x，链上除以10)
3. **stopLossPrice**: `Some` → `39000000000`
4. **takeProfitPrice**: `Some` → `51000000000`
5. **maxTradesPerDay**: `20`
6. **maxDailyLoss**: `1000000000`

### 3.3 提交交易

1. 检查所有参数
2. 点击右下角 **"Submit Transaction"**
3. 输入密码（如果设置了）
4. 点击 **"Sign and Submit"**

**预期结果**：
- 页面右上角会显示交易通知
- 显示事件: `aiStrategy.AIStrategyCreated`
- 策略ID应该是 `0` (第一个策略)

---

## 🔍 第四步：查询策略详情

### 方法一：通过 Chain State 查询

1. 点击 **"Developer"** → **"Chain state"**
2. 选择: **`aiStrategy`** → **`aIStrategies(u64): Option<...>`**
3. 输入策略ID: `0`
4. 点击 **"+"** 按钮

**应该看到**：
```
{
  strategyId: 0
  owner: 5CrDBE...
  name: DeepSeek BTC Strategy
  symbol: BTC-USD
  aiConfig: {
    primaryModel: DeepSeek  ← 验证这个！
    ...
  }
  status: Active
  ...
}
```

### 方法二：通过 Explorer 查看事件

1. 点击 **"Network"** → **"Explorer"**
2. 查看 "recent events"
3. 找到 `aiStrategy.AIStrategyCreated` 事件

---

## 👂 第五步：监听 AI 信号事件

保持在 **Explorer** 页面，等待 OCW 执行（每 10 个区块）

**预期事件**：
- `system.ExtrinsicSuccess` - 交易成功
- `aiStrategy.AIStrategyCreated` - 策略创建
- `aiStrategy.AISignalGenerated` - AI信号生成（OCW执行后）
- `aiStrategy.TradeExecuted` - 交易执行（如果满足条件）

**等待时间**: 约 1 分钟（10个区块 × 6秒）

---

## 📸 关键截图位置

建议截图保存：
1. ✅ DeepSeek 在 primaryModel 下拉列表中
2. ✅ 策略创建成功的事件
3. ✅ 查询到的策略详情（特别是 aiConfig.primaryModel: DeepSeek）
4. ✅ AI 信号生成事件（如果有）

---

## 🐛 常见问题

### Q1: 看不到 DeepSeek 选项
**A**: 确认浏览器已刷新，清除缓存后重试

### Q2: 交易失败 "Codec error"
**A**: 确认参数格式正确，特别是 Option 类型的字段

### Q3: 连接失败
**A**: 确认节点正在运行:
```bash
ps aux | grep stardust-node
```

### Q4: 没有看到 AI 信号事件
**A**: 
- OCW 每 10 个区块执行一次
- 需要等待约 1 分钟
- 查看节点日志: `grep "🤖" <日志文件>`

---

## 🎯 测试成功标准

- ✅ 能在 UI 中选择 `DeepSeek` 模型类型
- ✅ 策略创建成功
- ✅ 查询到的策略 `primaryModel` 为 `DeepSeek`
- ✅ 策略状态为 `Active`

---

## 💡 下一步

测试成功后，可以：
1. 测试暂停/恢复策略
2. 查看性能指标
3. 测试更新策略参数
4. 测试删除策略

---

*UI 测试指南 - 2025-11-04*

