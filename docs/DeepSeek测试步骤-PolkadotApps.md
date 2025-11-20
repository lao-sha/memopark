# 通过 Polkadot.js Apps 测试 DeepSeek AI 策略

## 📋 准备工作

✅ DeepSeek API Key: `sk-6b158668334e4512990806a3a800b845`  
✅ 节点已启动: `ws://127.0.0.1:9944`  
✅ DeepSeek 模型类型已添加（编码：`0x02`）

---

## 🌐 第一步：打开 Polkadot.js Apps

### 方法一：使用在线版本
1. 打开浏览器访问: https://polkadot.js.org/apps/
2. 点击左上角的网络选择器
3. 选择 "Development" → "Local Node"
4. 或手动输入: `ws://127.0.0.1:9944`
5. 等待连接成功

### 方法二：使用本地版本
```bash
# 如果需要安装
git clone https://github.com/polkadot-js/apps.git
cd apps
yarn install
yarn start
```

---

## 👤 第二步：导入测试账户

1. 点击顶部导航 "Accounts"
2. 点击 "Add account" → "Import account"
3. 输入助记词:
   ```
   satoshi sure behave certain impulse ski slight track century kitchen clutch story
   ```
4. 输入账户名称: `DeepSeek Test Account`
5. 设置密码（可选）
6. 点击 "Save"

✅ 账户地址应该是: `5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4`

---

## 📝 第三步：创建 DeepSeek AI 策略

1. 点击顶部导航 "Developer" → "Extrinsics"
2. 选择账户: `DeepSeek Test Account`
3. 选择 pallet: `aiStrategy`
4. 选择 extrinsic: `createAiStrategy(...)`

### 参数设置

#### 1. name (策略名称)
```
DeepSeek BTC Strategy
```

#### 2. hl_address (Hyperliquid 地址)
```
0x1234567890abcdef12345678
```

#### 3. symbol (交易对)
```
BTC-USD
```

#### 4. ai_config (AI 配置)

点击展开，填写以下字段：

- **primaryModel**: 选择 `DeepSeek` ✨
- **fallbackModel**: 选择 `Some` → `LSTM`
- **inferenceEndpoint**: 
  ```
  https://api.deepseek.com/chat/completions
  ```
- **apiKeyHash**: 
  ```
  0x0000000000000000000000000000000000000000000000000000000000000000
  ```
  （注：实际应该是真实的API Key哈希，这里用零值演示）

- **confidenceThreshold**: `70`
- **featuresEnabled**: 
  - 点击 "Add item"
  - 选择 `TechnicalIndicators`
  - 再点击 "Add item"
  - 选择 `MarketMicrostructure`
  - 再点击 "Add item"
  - 选择 `SocialSentiment`

- **inferenceTimeoutSecs**: `30`
- **maxRetries**: `2`
- **modelVersion**: `deepseek-chat`

#### 5. strategy_type (策略类型)
选择: `Grid`

#### 6. strategy_params (策略参数)

- **gridLowerPrice**: `Some` → `40000000000` (40,000 USD)
- **gridUpperPrice**: `Some` → `50000000000` (50,000 USD)
- **gridLevels**: `Some` → `10`
- **gridOrderSize**: `Some` → `1000000000` (1,000 USD)
- **mmSpreadBps**: `None`
- **mmOrderSize**: `None`
- **mmDepthLevels**: `None`
- **arbMinProfitBps**: `None`
- **arbMaxSlippageBps**: `None`
- **dcaIntervalBlocks**: `None`
- **dcaAmountPerOrder**: `None`

#### 7. risk_limits (风控限制)

- **maxPositionSize**: `10000000000` (10,000 USD)
- **maxLeverage**: `30` (表示 3.0x，除以10)
- **stopLossPrice**: `Some` → `39000000000` (39,000 USD)
- **takeProfitPrice**: `Some` → `51000000000` (51,000 USD)
- **maxTradesPerDay**: `20`
- **maxDailyLoss**: `1000000000` (1,000 USD)

---

## ✅ 第四步：提交交易

1. 检查所有参数是否正确
2. 点击右下角的 "Submit Transaction"
3. 如果设置了密码，输入密码
4. 等待交易确认

### 预期结果

在页面顶部会显示：
```
✅ aiStrategy.AIStrategyCreated
   策略ID: 0
   所有者: 5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4
```

---

## 🔍 第五步：查询策略

1. 点击顶部导航 "Developer" → "Chain state"
2. 选择 state query: `aiStrategy`
3. 选择 storage: `aIStrategies(u64): Option<AITradingStrategy>`
4. 输入策略ID: `0`
5. 点击 "+" 按钮

### 查看结果

应该显示策略的完整信息，包括：
- ✅ `ai_config.primaryModel: DeepSeek`
- ✅ `status: Active`
- ✅ `symbol: BTC-USD`
- ✅ 等等

---

## 👂 第六步：监听 AI 信号事件

1. 点击顶部导航 "Network" → "Explorer"
2. 切换到 "Recent Events" 标签
3. 等待 OCW 执行（每 10 个区块）

### 预期事件

当 OCW 执行时，你应该看到：
- `aiStrategy.AISignalGenerated`
  - 策略ID: 0
  - 交易信号: BUY/SELL/HOLD
  - 置信度: XX%
  
- `aiStrategy.TradeExecuted` (如果执行了交易)
  - 策略ID: 0
  - 订单ID: xxx

---

## 🎥 截图保存位置

建议在以下关键步骤截图：
1. 创建策略时的参数配置
2. 交易成功的事件
3. 查询到的策略详情
4. AI 信号生成事件

---

## 🐛 故障排查

### 问题 1: 连接失败
- 确认节点正在运行: `ps aux | grep stardust-node`
- 检查端口: `netstat -tuln | grep 9944`

### 问题 2: 交易失败
- 检查账户余额是否充足
- 查看浏览器控制台的详细错误信息
- 检查节点日志

### 问题 3: 看不到 DeepSeek 选项
- 确认已重新编译并重启节点
- 刷新 Polkadot.js Apps 页面
- 清除浏览器缓存

---

## 💡 后续操作

策略创建成功后：
1. 等待 OCW 自动执行（每 10 个区块）
2. 监控 AI 信号生成事件
3. 查看性能指标
4. 测试暂停/恢复策略

---

*测试文档 - 2025-11-04*

