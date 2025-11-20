# Pallet AI Strategy

## 📋 概述

`pallet-ai-trader` 是一个AI驱动的交易策略管理模块，实现了完全链上的AI交易策略配置、信号记录和表现跟踪。

本模块与Off-Chain Worker (OCW)配合使用，OCW定期调用外部AI推理服务生成交易信号，并在Hyperliquid DEX上执行交易。

## 🎯 核心功能

### 1. AI策略管理
- ✅ 创建AI增强的交易策略
- ✅ 配置AI模型类型（**DeepSeek**、GPT-4、Transformer、LSTM、Ensemble等）
- ✅ 设置置信度阈值和特征集
- ✅ 配置策略参数（网格、做市、套利等）
- ✅ 设置风控限制（最大仓位、杠杆、止损止盈）
- ✅ 启用/暂停/删除策略
- 🆕 **DeepSeek API 集成** - 通过 OCW 调用 DeepSeek AI 生成交易决策

### 2. AI信号记录
- ✅ 记录AI推理生成的交易信号
- ✅ 存储推理理由（IPFS CID）
- ✅ 存储特征重要性（IPFS CID）
- ✅ 记录风险评分和市场状态
- ✅ 跟踪执行结果

### 3. 表现跟踪
- ✅ 总交易次数
- ✅ 盈亏统计
- ✅ 胜率计算
- ✅ 夏普比率
- ✅ 最大回撤

## 🏗️ 架构设计

### 数据结构

#### AITradingStrategy
AI增强的交易策略配置，包含：
- 基础信息（ID、所有者、名称）
- Hyperliquid配置（账户地址、交易对）
- AI模型配置
- 策略参数
- 风控限制
- 表现指标

#### AISignalRecord
AI推理生成的信号记录，包含：
- 交易信号（BUY/SELL/HOLD/CLOSE）
- 置信度（0-100）
- 交易参数（仓位、价格、止损止盈）
- 推理理由（IPFS CID）
- 特征重要性（IPFS CID）
- 风险评分
- 执行结果

### 存储项

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `AIStrategies` | `StorageMap<u64, AITradingStrategy>` | 策略ID → 策略详情 |
| `UserStrategies` | `StorageMap<AccountId, Vec<u64>>` | 用户 → 策略ID列表 |
| `AISignalHistory` | `StorageDoubleMap<u64, u64, AISignalRecord>` | 策略ID、信号ID → 信号记录 |
| `StrategySignals` | `StorageMap<u64, Vec<u64>>` | 策略ID → 信号ID列表 |

## 📖 可调用函数

### 1. create_ai_strategy

创建AI增强的交易策略。

**参数**:
```rust
pub fn create_ai_strategy(
    origin: OriginFor<T>,
    name: Vec<u8>,                      // 策略名称
    hl_address: Vec<u8>,                // Hyperliquid账户地址
    symbol: Vec<u8>,                    // 交易对符号（如"BTC-USD"）
    ai_config: AIModelConfig<T>,        // AI模型配置
    strategy_type: StrategyType,        // 策略类型
    strategy_params: StrategyParams,    // 策略参数
    risk_limits: RiskLimits,            // 风控限制
) -> DispatchResult
```

**示例**:
```rust
// AI配置
let ai_config = AIModelConfig {
    primary_model: ModelType::Ensemble,
    fallback_model: Some(ModelType::LSTM),
    inference_endpoint: "https://ai.example.com/inference".into(),
    api_key_hash: hash_api_key("your_api_key"),
    confidence_threshold: 60,  // 只执行置信度≥60%的信号
    features_enabled: vec![
        Feature::TechnicalIndicators,
        Feature::MarketMicrostructure,
        Feature::SocialSentiment,
    ],
    inference_timeout_secs: 10,
    max_retries: 3,
    model_version: "v1.0".into(),
};

// 策略参数（网格交易）
let strategy_params = StrategyParams {
    grid_lower_price: Some(40_000_000_000),  // $40,000
    grid_upper_price: Some(50_000_000_000),  // $50,000
    grid_levels: Some(10),
    grid_order_size: Some(1_000_000_000),    // $1,000
    ..Default::default()
};

// 风控限制
let risk_limits = RiskLimits {
    max_position_size: 10_000_000_000,  // $10,000
    max_leverage: 30,                    // 3x
    stop_loss_price: Some(39_000_000_000),
    take_profit_price: Some(51_000_000_000),
    max_trades_per_day: 50,
    max_daily_loss: 1_000_000_000,       // $1,000
};

// 创建策略
AIStrategy::create_ai_strategy(
    RuntimeOrigin::signed(account),
    b"My AI Grid Strategy".to_vec(),
    b"0x1234...".to_vec(),
    b"BTC-USD".to_vec(),
    ai_config,
    StrategyType::Grid,
    strategy_params,
    risk_limits,
)?;
```

**事件**: `AIStrategyCreated`

### 2. toggle_strategy

启用或暂停策略。

**参数**:
```rust
pub fn toggle_strategy(
    origin: OriginFor<T>,
    strategy_id: u64,    // 策略ID
    enabled: bool,       // true=启用, false=暂停
) -> DispatchResult
```

**示例**:
```rust
// 暂停策略
AIStrategy::toggle_strategy(
    RuntimeOrigin::signed(account),
    strategy_id,
    false,  // 暂停
)?;

// 重新启用
AIStrategy::toggle_strategy(
    RuntimeOrigin::signed(account),
    strategy_id,
    true,  // 启用
)?;
```

**事件**: `StrategyStatusUpdated`

### 3. update_ai_config

更新AI模型配置。

**参数**:
```rust
pub fn update_ai_config(
    origin: OriginFor<T>,
    strategy_id: u64,
    new_config: AIModelConfig<T>,
) -> DispatchResult
```

**示例**:
```rust
// 更新为GPT-4模型
let new_config = AIModelConfig {
    primary_model: ModelType::GPT4,
    confidence_threshold: 70,  // 提高阈值
    ..old_config
};

AIStrategy::update_ai_config(
    RuntimeOrigin::signed(account),
    strategy_id,
    new_config,
)?;
```

**事件**: `AIConfigUpdated`

### 4. remove_strategy

删除策略。

**参数**:
```rust
pub fn remove_strategy(
    origin: OriginFor<T>,
    strategy_id: u64,
) -> DispatchResult
```

**示例**:
```rust
AIStrategy::remove_strategy(
    RuntimeOrigin::signed(account),
    strategy_id,
)?;
```

**事件**: `StrategyRemoved`

### 5. record_ai_signal

记录AI信号（由OCW调用，无签名交易）。

**参数**:
```rust
pub fn record_ai_signal(
    origin: OriginFor<T>,
    strategy_id: u64,
    signal: AISignalRecord<T::Moment>,
) -> DispatchResult
```

**注意**: 此函数只能通过无签名交易调用，通常由OCW使用。

**事件**: `AISignalGenerated`

## 🔍 查询函数

### get_active_strategies

获取所有活跃的策略（供OCW使用）。

```rust
pub fn get_active_strategies() -> Vec<AITradingStrategy<T::AccountId, T::Moment>>
```

### get_user_strategies

获取用户的所有策略。

```rust
pub fn get_user_strategies(
    account: &T::AccountId
) -> Vec<AITradingStrategy<T::AccountId, T::Moment>>
```

### get_recent_signals

获取策略的最近N条信号。

```rust
pub fn get_recent_signals(
    strategy_id: u64,
    limit: u32,
) -> Vec<AISignalRecord<T::Moment>>
```

## 📊 事件

| 事件 | 参数 | 说明 |
|------|------|------|
| `AIStrategyCreated` | strategy_id, owner, ai_model, strategy_type | AI策略已创建 |
| `StrategyStatusUpdated` | strategy_id, status | 策略状态已更新 |
| `AIConfigUpdated` | strategy_id, new_model | AI配置已更新 |
| `AISignalGenerated` | strategy_id, signal_id, signal, confidence | AI信号已生成 |
| `TradeExecuted` | strategy_id, signal_id, order_id | 交易已执行 |
| `PerformanceUpdated` | strategy_id, total_pnl | 策略表现已更新 |
| `StrategyRemoved` | strategy_id | 策略已删除 |

## ⚠️ 错误

| 错误 | 说明 |
|------|------|
| `StrategyNotFound` | 策略不存在 |
| `NotOwner` | 无权限 |
| `StrategyNotActive` | 策略未激活 |
| `InvalidName` | 无效的名称 |
| `InvalidAddress` | 无效的地址 |
| `InvalidSymbol` | 无效的交易对符号 |
| `InvalidEndpoint` | 无效的推理端点 |
| `ConfidenceThresholdTooLow` | 置信度阈值过低（最小50%）|
| `TooManyStrategies` | 策略数量超限（每用户最多100个）|
| `SignalNotFound` | 信号不存在 |
| `SignalHistoryFull` | 信号历史已满（每策略最多1000条）|

## 🔗 与其他模块的集成

### 1. pallet-stardust-ipfs

用于存储AI推理详情：
- 推理理由（自然语言解释）
- 特征重要性（JSON格式）
- 策略描述

### 2. Off-Chain Worker

OCW负责：
1. 定期查询活跃策略
2. 收集市场数据、链上数据、情绪数据
3. 调用AI推理服务
4. 验证AI信号
5. 执行交易（Hyperliquid API）
6. 记录结果到链上

## 🧪 测试

运行单元测试：

```bash
cargo test -p pallet-ai-trader
```

运行基准测试：

```bash
cargo test -p pallet-ai-trader --features runtime-benchmarks
```

## 📝 使用示例

### 前端集成示例

```typescript
import { ApiPromise } from '@polkadot/api';

// 1. 创建AI策略
const createStrategy = async (api: ApiPromise, account: string) => {
  const tx = api.tx.aiStrategy.createAiStrategy(
    "My AI Strategy",                    // name
    "0x1234567890abcdef",                // hl_address
    "BTC-USD",                            // symbol
    {
      primaryModel: "Ensemble",
      fallbackModel: "LSTM",
      inferenceEndpoint: "https://ai.example.com/inference",
      apiKeyHash: "...",
      confidenceThreshold: 60,
      featuresEnabled: ["TechnicalIndicators", "SocialSentiment"],
      inferenceTimeoutSecs: 10,
      maxRetries: 3,
      modelVersion: "v1.0",
    },
    "Grid",                               // strategy_type
    {
      gridLowerPrice: "40000000000",
      gridUpperPrice: "50000000000",
      gridLevels: 10,
      gridOrderSize: "1000000000",
    },
    {
      maxPositionSize: "10000000000",
      maxLeverage: 30,
      maxTradesPerDay: 50,
      maxDailyLoss: "1000000000",
    }
  );
  
  await tx.signAndSend(account);
};

// 2. 查询用户策略
const getUserStrategies = async (api: ApiPromise, account: string) => {
  const strategyIds = await api.query.aiStrategy.userStrategies(account);
  const strategies = await Promise.all(
    strategyIds.map((id: number) => 
      api.query.aiStrategy.strategies(id)
    )
  );
  return strategies;
};

// 3. 查询AI信号历史
const getSignalHistory = async (api: ApiPromise, strategyId: number) => {
  const signalIds = await api.query.aiStrategy.strategySignals(strategyId);
  const signals = await Promise.all(
    signalIds.map((signalId: number) => 
      api.query.aiStrategy.signalHistory(strategyId, signalId)
    )
  );
  return signals;
};

// 4. 监听AI信号事件
const subscribeToSignals = (api: ApiPromise, callback: Function) => {
  api.query.system.events((events) => {
    events.forEach((record) => {
      const { event } = record;
      if (event.section === 'aiStrategy' && event.method === 'AISignalGenerated') {
        const [strategyId, signalId, signal, confidence] = event.data;
        callback({ strategyId, signalId, signal, confidence });
      }
    });
  });
};
```

## 📚 相关文档

- [AI驱动的Substrate-Hyperliquid自动化交易系统综合方案](../../docs/AI驱动的Substrate-Hyperliquid自动化交易系统综合方案.md)
- [AI推理服务实现方案](../../docs/AI推理服务实现方案.md)
- [AI交易系统前端设计方案](../../docs/AI交易系统前端设计方案.md)

## 🤖 AI模型训练说明

### 本地模型训练流程

本项目支持训练本地AI模型（LSTM、Transformer、Random Forest），用于交易信号生成。

#### 1. 训练步骤

**步骤1：下载历史数据**
```bash
cd ai-inference-service
python scripts/collect_historical_data.py \
    --symbol BTC/USDT \
    --days 365 \
    --interval 5m \
    --output data/historical/BTC-USDT_5m_2024.csv
```

**步骤2：准备训练数据**
```bash
python scripts/prepare_training_data.py \
    --input data/historical/BTC-USDT_5m_2024.csv \
    --output data/processed/BTC_training_data.pkl \
    --threshold 1.0 \
    --forward-window 12
```

**步骤3：训练模型**
```bash
# 训练所有模型
python scripts/train_models.py \
    --data data/processed/BTC_training_data.pkl \
    --models all \
    --epochs 50 \
    --batch-size 64

# 只训练特定模型
python scripts/train_models.py \
    --data data/processed/BTC_training_data.pkl \
    --models lstm rf  # 只训练LSTM和Random Forest
```

#### 2. 训练参数说明

- **数据量**：建议至少1年历史数据（365天）
- **时间间隔**：5分钟K线数据
- **标签阈值**：1.0（表示价格变动1%才生成标签）
- **前瞻窗口**：12个5分钟（1小时）
- **训练轮数**：50轮（可根据情况调整）

#### 3. 训练时间估算

- **Random Forest**：5-10分钟（CPU）
- **LSTM**：30-60分钟（GPU），2-4小时（CPU）
- **Transformer**：60-120分钟（GPU），4-8小时（CPU）

#### 4. 训练输出

训练完成后，模型文件保存在：
- `models/lstm_model.pth` - LSTM模型
- `models/transformer_model.pth` - Transformer模型
- `models/random_forest_model.pkl` - Random Forest模型

详细训练指南请参考：`ai-inference-service/TRAINING_GUIDE.md`

### DeepSeek远程API使用说明

#### DeepSeek是什么？

DeepSeek是一个**已经训练好的大语言模型**，由DeepSeek公司提供。我们**不需要训练DeepSeek**，只需要通过API调用它来获取交易信号。

#### DeepSeek工作方式

1. **DeepSeek模型已经训练完成**
   - DeepSeek模型由DeepSeek公司在大规模数据上预训练
   - 我们不需要训练，只需要使用它的推理能力

2. **如何调用DeepSeek**

```python
# 在 ai-inference-service/app/clients/deepseek_client.py 中
class DeepSeekClient:
    async def analyze_trading_signal(
        self,
        market_data: Dict[str, Any],      # 市场数据
        features: Dict[str, float],       # 技术指标
        sentiment_data: Optional[Dict],    # 情绪数据
        on_chain_data: Optional[Dict]     # 链上数据
    ) -> Dict[str, Any]:
        # 构建提示词（Prompt）
        prompt = self._build_analysis_prompt(...)
        
        # 调用DeepSeek API
        response = await self.client.chat.completions.create(
            model="deepseek-chat",
            messages=[...],
            temperature=0.7
        )
        
        # 解析响应，返回交易信号
        return self._parse_response(response)
```

3. **调用流程**

```
链上OCW → AI推理服务 → DeepSeek API
              ↓
        构建提示词（包含市场数据、技术指标等）
              ↓
        DeepSeek模型推理
              ↓
        返回交易信号（BUY/SELL/HOLD）
```

4. **配置DeepSeek API密钥**

```bash
# 在 .env 文件中设置
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

获取API密钥：https://platform.deepseek.com/

#### DeepSeek vs 本地模型对比

| 特性 | DeepSeek API | 本地模型（LSTM/Transformer） |
|------|-------------|---------------------------|
| **训练** | 无需训练（已预训练） | 需要本地训练 |
| **成本** | 按API调用付费 | 免费（硬件成本） |
| **准确度** | 高（大模型能力强） | 中等（需大量数据训练） |
| **延迟** | 网络延迟（100-500ms） | 本地推理（<10ms） |
| **离线** | 需要网络 | 可离线运行 |
| **适用场景** | 复杂市场分析 | 简单场景、高频交易 |

#### 混合架构设计

本项目采用**混合架构**，结合两者优势：

```python
# ai-inference-service/app/services/hybrid_inference_service.py

class HybridInferenceService:
    async def get_trading_signal(...):
        # 1. 场景分类
        complexity = ScenarioClassifier.classify(...)
        
        if complexity == "simple":
            # 简单场景：使用本地模型（快速、免费）
            return await self._call_local_model(...)
        else:
            # 复杂场景：使用DeepSeek（准确、智能）
            return await self._call_deepseek_with_fallback(...)
```

**优势**：
- ✅ 简单场景使用本地模型，降低成本和延迟
- ✅ 复杂场景使用DeepSeek，提高准确度
- ✅ 自动降级：DeepSeek失败时切换到本地模型
- ✅ 缓存机制：减少重复调用

#### 总结

- **本地模型**：需要训练，使用历史数据训练LSTM/Transformer/Random Forest
- **DeepSeek**：无需训练，直接调用API，模型已由DeepSeek公司训练好

两者结合使用，实现最佳效果！

## 🤖 DeepSeek AI 集成

### 概述

本模块已集成 **DeepSeek AI** (`https://api.deepseek.com`)，通过 Off-Chain Worker (OCW) 调用 DeepSeek API 生成智能交易决策。

### 优势

- ✅ **无需训练** - 直接使用 DeepSeek 的预训练模型
- ✅ **高质量推理** - DeepSeek 具有强大的推理和分析能力
- ✅ **自然语言理解** - 可以理解复杂的市场描述
- ✅ **实时决策** - 根据最新市场数据生成交易信号
- ✅ **成本低廉** - 每次调用成本约 $0.0001

### 使用流程

1. **获取 DeepSeek API Key**
   - 访问 https://platform.deepseek.com/
   - 注册并创建 API Key

2. **配置节点**
   ```bash
   export DEEPSEEK_API_KEY="sk-your-api-key"
   ./target/release/stardust-node --dev
   ```

3. **创建策略时指定 DeepSeek**
   ```javascript
   const aiConfig = {
     primaryModel: 'DeepSeek',
     inferenceEndpoint: 'https://api.deepseek.com/chat/completions',
     confidenceThreshold: 70,
     // ...
   };
   ```

4. **OCW 自动调用**
   - 每 10 个区块执行一次
   - 调用 DeepSeek API 分析市场
   - 解析 AI 响应并执行交易
   - 记录结果到链上

### 详细文档

- [DeepSeek AI 交易决策集成方案](../../docs/DeepSeek-AI交易决策集成方案.md)
- [DeepSeek 快速开始指南](../../docs/DeepSeek-快速开始.md)

### 示例

参见项目根目录的 `test-deepseek-strategy.js`

---

## 🔮 未来计划

- [ ] 支持更多AI模型类型
- [ ] 实现策略回测功能
- [ ] 支持策略组合（Portfolio）
- [ ] 实现社交跟单功能
- [ ] 支持跨DEX套利
- [ ] 策略NFT化和交易市场

## 📄 许可证

MIT License

---

*文档更新时间: 2025-11-04*

