# Stardust 链与 Hyperliquid DEX 交互方案

## 📋 概述

本文档说明 Stardust 区块链如何与 Hyperliquid 去中心化交易所进行交互，实现自动化 AI 驱动的交易策略。

---

## ❌ 为什么链上不能直接调用 Hyperliquid API？

### Substrate Runtime 的限制

1. **确定性要求**
   - Runtime (链上代码) 必须是完全确定性的
   - 所有验证节点必须得到相同的执行结果
   - 外部 API 调用结果不确定（网络延迟、服务器状态等）

2. **禁止非确定性操作**
   - ❌ 网络 I/O (HTTP 请求)
   - ❌ 文件系统访问
   - ❌ 随机数生成（除非来自 VRF）
   - ❌ 系统时间（除了区块时间戳）

3. **共识破坏风险**
   - 如果允许 HTTP 调用，不同节点可能得到不同响应
   - 导致状态转换不一致
   - 破坏区块链共识

---

## ✅ 可行方案：Off-Chain Worker (OCW)

### 方案架构

```
┌─────────────────────────────────────────────────────────────────┐
│ Stardust 区块链节点                                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Runtime (链上 - 确定性环境)                                │  │
│  │                                                            │  │
│  │  ┌────────────────────┐       ┌─────────────────────┐    │  │
│  │  │ pallet-ai-strategy │       │ 链上存储             │    │  │
│  │  │                     │       │ - AIStrategies      │    │  │
│  │  │ - create_strategy  │◄─────►│ - UserStrategies    │    │  │
│  │  │ - toggle_strategy  │       │ - SignalHistory     │    │  │
│  │  │ - record_signal    │       │                      │    │  │
│  │  └────────────────────┘       └─────────────────────┘    │  │
│  │          ▲                                                 │  │
│  │          │ 无签名交易                                      │  │
│  │          │ (记录AI信号和交易结果)                          │  │
│  └──────────┼─────────────────────────────────────────────────┘  │
│             │                                                    │
│  ┌──────────┴─────────────────────────────────────────────────┐  │
│  │ Off-Chain Worker (OCW - 非确定性环境)                       │  │
│  │                                                             │  │
│  │  每10个区块执行：                                           │  │
│  │  1. 读取活跃策略 ──────────────────────────┐               │  │
│  │  2. 收集市场数据                           │               │  │
│  │  3. 调用AI推理服务 ────┐                   │               │  │
│  │  4. 生成交易信号        │                   │               │  │
│  │  5. 执行Hyperliquid交易 │                   │               │  │
│  │  6. 提交结果到链上 ─────┼───────────────────┘               │  │
│  │                         │                                   │  │
│  └─────────────────────────┼───────────────────────────────────┘  │
│                            │                                      │
└────────────────────────────┼──────────────────────────────────────┘
                             │ HTTP请求
                             │
              ┌──────────────┴─────────────────┐
              │                                 │
              ▼                                 ▼
   ┌─────────────────────┐         ┌──────────────────────┐
   │ AI 推理服务          │         │ Hyperliquid DEX API   │
   │                     │         │                       │
   │ POST /inference     │         │ POST /exchange        │
   │ - 市场数据分析       │         │ - 下单 place_order    │
   │ - 生成交易信号       │         │ - 撤单 cancel_order   │
   │ - 返回置信度         │         │ - 查询 query_info     │
   └─────────────────────┘         └──────────────────────┘
```

---

## 🔄 完整交易流程

### 第一步：用户创建策略（链上）

**操作：** 用户通过前端提交交易

```typescript
// 前端调用
const tx = api.tx.aiStrategy.createAiStrategy(
  "BTC 网格策略",                    // 策略名称
  "0x1234567890abcdef",              // Hyperliquid 账户地址
  "BTC-USD",                          // 交易对
  {
    primaryModel: "Ensemble",         // AI模型
    confidenceThreshold: 60,          // 置信度阈值
    inferenceEndpoint: "https://ai.example.com/inference",
    // ... 其他配置
  },
  "Grid",                             // 策略类型
  {
    gridLowerPrice: 40000000000,      // $40,000
    gridUpperPrice: 50000000000,      // $50,000
    gridLevels: 10,
    // ... 其他参数
  },
  {
    maxPositionSize: 10000000000,     // $10,000
    maxLeverage: 30,                  // 3x
    // ... 风控参数
  }
);

await tx.signAndSend(account);
```

**结果：** 策略存储在链上 `AIStrategies` 中

---

### 第二步：OCW 自动执行（后台，每10个区块）

**OCW 流程：**

```rust
// pallets/ai-strategy/src/ocw.rs

pub fn offchain_worker(block_number: BlockNumberFor<T>) {
    log::info!("🤖 OCW执行于区块 #{:?}", block_number);

    // 1. 查询所有活跃策略
    for (strategy_id, strategy) in AIStrategies::<T>::iter() {
        if strategy.status != StrategyStatus::Active {
            continue;
        }

        // 2. 收集市场数据（从 Hyperliquid 或其他数据源）
        let market_data = fetch_market_data(&strategy.symbol)?;

        // 3. 调用 AI 推理服务
        let ai_signal = call_ai_inference_service(strategy_id, &strategy, &market_data)?;

        // 4. 检查置信度
        if ai_signal.confidence < strategy.ai_config.confidence_threshold {
            log::info!("置信度不足，跳过: {}%", ai_signal.confidence);
            continue;
        }

        // 5. 执行 Hyperliquid 交易
        let order_result = execute_hyperliquid_trade(&strategy, &ai_signal)?;

        // 6. 提交结果到链上（无签名交易）
        submit_unsigned_tx(strategy_id, ai_signal, order_result);
    }
}
```

---

### 第三步：调用 Hyperliquid API（OCW 中）

**HTTP 请求示例：**

```rust
// pallets/ai-strategy/src/hyperliquid.rs

fn execute_hyperliquid_trade(
    strategy: &AITradingStrategy,
    signal: &AISignalRecord,
) -> Result<Vec<u8>, HttpError> {
    // 1. 构建订单
    let order = HyperliquidOrder {
        symbol: strategy.symbol.clone(),
        order_type: OrderType::Market,
        side: match signal.signal {
            TradeSignal::BUY => OrderSide::Buy,
            TradeSignal::SELL => OrderSide::Sell,
            _ => return Err("Invalid signal"),
        },
        size: signal.position_size,
        price: signal.entry_price.unwrap_or(0),
        leverage: strategy.risk_limits.max_leverage,
        client_order_id: format!("stardust-{}-{}", strategy.strategy_id, signal.signal_id),
    };

    // 2. EIP-712 签名（使用策略的 Hyperliquid 私钥）
    let signature = sign_order_eip712(&order, &strategy.hl_address)?;

    // 3. 构建 HTTP 请求
    let url = format!("{}/exchange", HYPERLIQUID_API_URL);
    let body = serde_json::json!({
        "action": {
            "type": "order",
            "orders": [order],
            "grouping": "na"
        },
        "nonce": get_nonce(),
        "signature": signature,
        "vault_address": null
    });

    // 4. 发送 HTTP POST 请求
    let request = http::Request::post(&url, vec![body.to_string().as_bytes()])
        .add_header("Content-Type", "application/json")
        .deadline(sp_runtime::offchain::timestamp().add(Duration::from_millis(10000)))
        .send()?;

    // 5. 等待响应
    let response = request.wait()?;
    let response_body = response.body().collect::<Vec<u8>>();

    // 6. 解析响应
    log::info!("✅ Hyperliquid订单已提交: {:?}", response_body);
    
    Ok(response_body)
}
```

---

### 第四步：记录结果到链上（无签名交易）

```rust
fn submit_unsigned_tx(
    strategy_id: u64,
    signal: AISignalRecord,
    order_result: Vec<u8>,
) {
    // 构建无签名交易
    let call = Call::record_ai_signal {
        strategy_id,
        signal,
    };

    // 提交到交易池
    let _ = SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into());
    
    log::info!("📝 AI信号已记录到链上");
}
```

---

## 🔐 安全性考虑

### 1. Hyperliquid 私钥管理

**问题：** Hyperliquid 需要 EIP-712 签名，私钥如何安全存储？

**方案A：链上加密存储（当前方案）**
```rust
pub struct AITradingStrategy {
    // ...
    /// Hyperliquid账户地址
    pub hl_address: BoundedVec<u8, ConstU32<42>>,
    
    // 🔴 注意：私钥不存储在链上！
    // 用户需要在本地节点配置 Keystore
}
```

**方案B：使用 OCW Keystore**
```bash
# 在节点启动时，将 Hyperliquid 私钥导入 Keystore
./stardust-node key insert \
  --base-path /tmp/node01 \
  --chain local \
  --scheme Sr25519 \
  --suri "0x..." \
  --key-type aist  # AI Strategy key type
```

**方案C：外部签名服务（推荐）**
```
OCW → 调用外部签名服务 → 签名服务持有私钥 → 返回签名
```

### 2. 防止恶意OCW提交

**问题：** 如何防止恶意节点伪造AI信号？

**解决方案：**
1. **无签名交易验证**
   ```rust
   #[pallet::validate_unsigned]
   impl<T: Config> ValidateUnsigned for Pallet<T> {
       fn validate_unsigned(call: &Self::Call) -> TransactionValidity {
           match call {
               Call::record_ai_signal { strategy_id, signal } => {
                   // 验证信号的合法性
                   // - 策略是否存在
                   // - 置信度是否达标
                   // - OCW签名验证
                   Ok(ValidTransaction::default())
               }
               _ => InvalidTransaction::Call.into(),
           }
       }
   }
   ```

2. **OCW 签名**
   - 使用 `AuthorityId` 签名
   - 只接受授权节点的提交

---

## 🚀 部署流程

### 1. 启动 Stardust 节点

```bash
./target/release/stardust-node \
  --dev \
  --rpc-external \
  --rpc-port 9944 \
  --rpc-cors=all \
  --enable-offchain-indexing true
```

### 2. 部署 AI 推理服务

```bash
cd ai-inference-service
python main.py
# 服务运行在 http://localhost:8000
```

### 3. 配置 Hyperliquid API 密钥

```bash
# 方式1：环境变量
export HYPERLIQUID_PRIVATE_KEY="0x..."

# 方式2：Keystore导入
./stardust-node key insert \
  --suri "0x..." \
  --key-type aist
```

### 4. 创建 AI 策略（通过前端或测试脚本）

```bash
node test-ai-strategy.js
```

### 5. 监控 OCW 日志

```bash
tail -f /tmp/stardust-node.log | grep "🤖 OCW"
```

**预期输出：**
```
🤖 OCW执行于区块 #10
📊 处理策略 #0
✅ AI信号: BUY
💰 Hyperliquid订单已提交: order_id=1234
📝 AI信号已记录到链上
```

---

## 📊 监控与查询

### 查询策略状态

```typescript
// 查询策略详情
const strategy = await api.query.aiStrategy.aIStrategies(0);
console.log(strategy.toHuman());

// 查询AI信号历史
const signals = await api.query.aiStrategy.strategySignals(0);
for (const signalId of signals) {
  const signal = await api.query.aiStrategy.aISignalHistory(0, signalId);
  console.log(signal.toHuman());
}
```

### 监听事件

```typescript
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (event.section === 'aiStrategy') {
      if (event.method === 'AISignalGenerated') {
        const [strategyId, signalId, signal, confidence] = event.data;
        console.log(`🤖 AI信号: ${signal} (${confidence}%)`);
      }
      
      if (event.method === 'TradeExecuted') {
        const [strategyId, signalId, orderId] = event.data;
        console.log(`💰 交易执行: ${orderId}`);
      }
    }
  });
});
```

---

## 🔧 故障排查

### 问题1：OCW 不执行

**检查：**
```bash
# 查看节点日志
tail -f /tmp/stardust-node.log | grep "OCW"

# 应该看到：
# 🤖 OCW started at block 10
# 🤖 OCW执行于区块 #10
```

**解决：**
- 确保区块正在生成
- 检查策略状态是否为 Active
- 查看区块号是否为10的倍数

### 问题2：Hyperliquid API 调用失败

**检查：**
```bash
# 测试 Hyperliquid API
curl -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type":"metaAndAssetCtxs"}'
```

**常见错误：**
- `Network timeout` - 网络问题
- `Invalid signature` - EIP-712签名错误
- `Insufficient margin` - 保证金不足

### 问题3：无签名交易被拒绝

**检查：**
- 验证 `validate_unsigned` 逻辑
- 确保 OCW `AuthorityId` 已配置
- 查看节点日志中的错误信息

---

## 📚 相关文档

- [AI Strategy Pallet README](../pallets/ai-strategy/README.md)
- [AI驱动的Substrate-Hyperliquid自动化交易系统综合方案](./AI驱动的Substrate-Hyperliquid自动化交易系统综合方案.md)
- [AI推理服务实现方案](./AI推理服务实现方案.md)
- [Hyperliquid API 文档](https://hyperliquid.gitbook.io/hyperliquid-docs/)
- [Substrate OCW 官方文档](https://docs.substrate.io/learn/offchain-operations/)

---

## 🎯 总结

**核心要点：**
1. ❌ 链上 Runtime **不能**直接调用 Hyperliquid API
2. ✅ 使用 **Off-Chain Worker (OCW)** 在链下调用 HTTP API
3. ✅ OCW 通过**无签名交易**将结果记录回链上
4. ✅ 保证链上数据的**确定性**和**共识安全**

**优势：**
- 🔒 链上数据完全确定性，保证共识
- 🤖 OCW 自动化执行，无需人工干预
- 📊 完整的链上审计追踪
- 🚀 去中心化的策略执行

---

*文档更新时间: 2025-11-04*

