# Substrate OCW与DeepSeek AI服务对接指南

## 📋 **概述**

本文档说明如何将Substrate链的Off-Chain Worker (OCW)与DeepSeek混合架构AI推理服务对接，实现自动化交易信号生成。

---

## 🏗️ **完整架构**

```
┌─────────────────────────────────────────────────────────┐
│              Substrate Blockchain                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Runtime (pallet-ai-strategy)                    │  │
│  │  - create_strategy()    创建策略                  │  │
│  │  - record_ai_signal()   记录AI信号                │  │
│  │  - execute_trade()      执行交易                  │  │
│  └──────────────┬───────────────────────────────────┘  │
│                 │                                       │
│  ┌──────────────▼───────────────────────────────────┐  │
│  │  Off-Chain Worker (OCW)                         │  │
│  │  每10个区块执行一次：                             │  │
│  │  1. 获取市场数据                                  │  │
│  │  2. 调用AI服务                                    │  │
│  │  3. 提交签名交易                                  │  │
│  └──────────────┬───────────────────────────────────┘  │
│                 │ HTTP POST                            │
└─────────────────┼───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│          AI Inference Service (FastAPI)                │
│          http://localhost:8000                          │
│                                                         │
│  POST /api/v1/inference                                │
│  {                                                      │
│    "strategy_id": 1,                                   │
│    "market_data": {...},                               │
│    "model_type": "ensemble"                            │
│  }                                                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  HybridInferenceService                        │   │
│  │  - 场景分类                                      │   │
│  │  - 选择模型 (DeepSeek/Local)                    │   │
│  │  - 数据脱敏                                      │   │
│  │  - 缓存管理                                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Response:                                             │
│  {                                                      │
│    "signal": "BUY",                                    │
│    "confidence": 75,                                   │
│    "position_size": 0.3,                               │
│    "stop_loss": 63700.0,                               │
│    "take_profit": 68900.0,                             │
│    "reasoning": "技术指标显示..."                      │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 **已实现的功能**

### **1. OCW核心功能** ✅

**文件**：`pallets/ai-strategy/src/ocw.rs`

- ✅ 定期执行（每10个区块）
- ✅ 获取市场数据
- ✅ 构建完整JSON请求
- ✅ HTTP POST调用AI服务
- ✅ 解析JSON响应
- ✅ 提交签名交易到链上
- ✅ 错误处理和日志

### **2. 数据格式对接** ✅

**请求格式**：匹配FastAPI的`InferenceRequest`模型

```rust
AIInferenceRequest {
    strategy_id: u64,
    symbol: Vec<u8>,               // "BTC-USD"
    current_price: u64,            // 精度6位小数
    prices_1h: Vec<u64>,           // 12个点
    prices_24h: Vec<u64>,          // 288个点
    volumes_24h: Vec<u64>,         // 288个点
    bid_ask_spread: u64,
    funding_rate: Option<i32>,
    model_type: Vec<u8>,           // "ensemble"/"lstm"/etc
    confidence_threshold: u8,      // 0-100
}
```

**响应格式**：

```rust
AIInferenceResponse {
    signal: Vec<u8>,               // "BUY"/"SELL"/"HOLD"
    confidence: u8,                // 0-100
    position_size: u64,
    entry_price: u64,
    stop_loss: Option<u64>,
    take_profit: Option<u64>,
    reasoning: Vec<u8>,
}
```

### **3. JSON序列化/反序列化** ✅

- 手工实现的轻量级JSON编码器（no_std兼容）
- 支持嵌套对象和数组
- 浮点数与整数转换（精度6位小数）
- 简化的JSON解析器

---

## 🚀 **快速启动**

### **Step 1: 启动AI推理服务**

```bash
# 终端1：启动AI服务
cd /home/xiaodong/文档/stardust/ai-inference-service

# 配置环境变量
cp .env-template .env
nano .env  # 填入DEEPSEEK_API_KEY

# 启动Redis（可选）
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 启动服务
./start.sh dev

# 验证服务运行
curl http://localhost:8000/health
```

### **Step 2: 编译Substrate节点**

```bash
# 终端2：编译节点
cd /home/xiaodong/文档/stardust

# 编译（包含OCW功能）
cargo build --release

# 检查编译结果
ls -lh target/release/node-template
```

### **Step 3: 启动Substrate节点**

```bash
# 清理旧数据（可选）
rm -rf /tmp/alice

# 启动节点（开发模式）
./target/release/node-template \
  --dev \
  --tmp \
  --enable-offchain-indexing true \
  --rpc-cors all \
  --rpc-external \
  --rpc-methods=unsafe

# 日志中应该看到：
# 🤖 OCW执行于区块 #10
# 📊 处理策略 #1
# 🌐 调用AI服务: BTC-USD (策略#1)
# ✅ AI信号: "BUY"
```

### **Step 4: 创建测试策略**

```bash
# 终端3：使用polkadot.js或前端创建策略
# 或使用CLI脚本：

node stardust-gov-scripts/governance-cli.js \
  create-ai-strategy \
  --name "BTC趋势跟踪" \
  --symbol "BTC-USD" \
  --model "ensemble"
```

---

## 📊 **数据流详解**

### **1. OCW触发（每10个区块）**

```rust
// pallets/ai-strategy/src/lib.rs
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn offchain_worker(block_number: BlockNumberFor<T>) {
        Self::offchain_worker(block_number);
    }
}
```

### **2. 遍历策略并获取市场数据**

```rust
// pallets/ai-strategy/src/ocw.rs
fn process_all_strategies() -> Result<(), &'static str> {
    for (strategy_id, strategy) in Strategies::<T>::iter() {
        if !strategy.enabled {
            continue;
        }

        // 获取市场数据
        let market_data = Self::fetch_market_data(&strategy.symbol)?;

        // 调用AI服务
        let response = Self::call_ai_inference_service(strategy_id, &strategy)?;

        // 提交信号
        Self::submit_ai_signal(strategy_id, response)?;
    }
}
```

### **3. 构建HTTP请求**

```rust
fn call_ai_inference_service(...) -> Result<AIInferenceResponse, HttpError> {
    // 构建请求
    let request = AIInferenceRequest {
        strategy_id,
        symbol: strategy.symbol.to_vec(),
        current_price: market_data.current_price,
        prices_1h: market_data.prices_1h,
        prices_24h: market_data.prices_24h,
        // ...
    };

    // 序列化为JSON
    let request_body = Self::encode_inference_request(&request)?;

    // 发送HTTP POST
    let response = http::Request::post("http://localhost:8000/api/v1/inference", vec![request_body])
        .add_header("Content-Type", "application/json")
        .send()?;

    // 解析响应
    Self::decode_inference_response(&response.body())?
}
```

### **4. AI服务处理**

```python
# ai-inference-service/app/main.py
@app.post("/api/v1/inference")
async def predict_trade_signal(request: InferenceRequest):
    # 1. 提取特征
    features = feature_engineer.extract_features(...)

    # 2. 调用混合推理服务
    ai_signal = await hybrid_service.get_trading_signal(
        market_data=request.market_data,
        features=features_dict
    )

    # 3. 风险评估
    risk_assessment = risk_manager.assess_risk(...)

    # 4. 返回信号
    return InferenceResponse(
        signal=signal,
        confidence=confidence,
        position_size=risk_assessment.position_size,
        stop_loss=ai_signal["stop_loss"],
        take_profit=ai_signal["take_profit"],
        reasoning=ai_signal["reasoning"]
    )
```

### **5. OCW提交签名交易**

```rust
fn submit_ai_signal(strategy_id: u64, response: AIInferenceResponse) -> Result<(), &'static str> {
    // 获取签名者
    let signer = Signer::<T, T::AuthorityId>::all_accounts();

    // 构建AI信号
    let ai_signal = AITradeSignal {
        signal: TradeSignal::Buy,  // 从response.signal解析
        confidence: response.confidence,
        position_size: response.position_size.into(),
        entry_price: response.entry_price.into(),
        stop_loss: response.stop_loss.map(|v| v.into()),
        take_profit: response.take_profit.map(|v| v.into()),
        reasoning: BoundedVec::try_from(response.reasoning).unwrap_or_default(),
        timestamp: <pallet_timestamp::Pallet<T>>::get(),
    };

    // 提交交易
    signer.send_signed_transaction(|_account| {
        Call::record_ai_signal {
            strategy_id,
            signal: ai_signal.clone(),
        }
    });
}
```

### **6. 链上状态更新**

```rust
// pallets/ai-strategy/src/lib.rs
#[pallet::call]
impl<T: Config> Pallet<T> {
    pub fn record_ai_signal(
        origin: OriginFor<T>,
        strategy_id: u64,
        signal: AITradeSignal<T::Moment>,
    ) -> DispatchResult {
        // 验证签名
        let who = ensure_signed(origin)?;

        // 存储信号
        AISignals::<T>::insert(strategy_id, signal.clone());

        // 触发事件
        Self::deposit_event(Event::AISignalReceived {
            strategy_id,
            signal: signal.signal,
            confidence: signal.confidence,
        });

        Ok(())
    }
}
```

---

## 🧪 **测试流程**

### **1. 单元测试**

```bash
# 测试OCW JSON编码
cargo test -p pallet-ai-strategy test_encode_u64_array

# 测试OCW JSON解析
cargo test -p pallet-ai-strategy test_extract_json_string

# 测试AI服务
cd ai-inference-service
pytest tests/test_hybrid_service.py
```

### **2. 集成测试**

```bash
# 启动完整环境
docker-compose up -d

# 或手动启动各组件：
# 终端1: AI服务
cd ai-inference-service && ./start.sh

# 终端2: Substrate节点
./target/release/node-template --dev --tmp

# 终端3: 观察日志
tail -f /tmp/alice/chains/dev/offchain_worker.log
```

### **3. 模拟测试**

```bash
# 使用curl模拟OCW请求
curl -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": 1,
    "market_data": {
      "symbol": "BTC-USD",
      "current_price": 65000.0,
      "prices_1h": [64800, 64850, 64900, 64950, 65000, 65050, 65100, 65150, 65200, 65150, 65100, 65000],
      "prices_24h": ['$(python3 -c "import json; print(','.join([str(65000 + i*10) for i in range(288)]))")'],
      "volumes_24h": ['$(python3 -c "import json; print(','.join(['1000000' for i in range(288)]))")'],
      "bid_ask_spread": 5.0,
      "funding_rate": 0.0001,
      "timestamp": '$(date +%s)'
    },
    "model_type": "ensemble",
    "confidence_threshold": 60
  }'

# 预期响应：
# {
#   "signal": "BUY",
#   "confidence": 75,
#   "position_size": 0.3,
#   ...
# }
```

---

## 🔍 **调试指南**

### **问题1：OCW没有执行**

**症状**：日志中没有看到"🤖 OCW执行于区块"

**排查**：

```bash
# 1. 检查节点是否启用OCW
./target/release/node-template --help | grep offchain

# 2. 确认策略存在且已启用
# 使用polkadot.js Apps查看链上状态
# Developer -> Chain State -> aiStrategy -> strategies

# 3. 检查区块高度
# OCW每10个区块执行一次，确保已过区块#10
```

### **问题2：HTTP请求失败**

**症状**：日志显示"❌ HTTP请求发送失败"

**排查**：

```bash
# 1. 确认AI服务运行
curl http://localhost:8000/health

# 2. 检查网络连接
ping localhost

# 3. 查看AI服务日志
cd ai-inference-service
tail -f logs/app.log

# 4. 测试手动请求
curl -X POST http://localhost:8000/api/v1/inference -d '{...}'
```

### **问题3：JSON解析失败**

**症状**：日志显示"❌ 响应不是有效的UTF-8"

**排查**：

```rust
// 在ocw.rs中添加调试日志
log::debug!("Raw response: {:?}", body);

// 重新编译并查看完整响应
cargo build --release && ./target/release/node-template --dev
```

### **问题4：签名交易提交失败**

**症状**：日志显示"❌ 没有可用的签名者"

**排查**：

```bash
# 1. 确认OCW密钥已插入
# 在节点启动时应该看到密钥生成日志

# 2. 手动插入密钥（开发模式）
curl http://localhost:9933 -H "Content-Type:application/json;charset=utf-8" -d '{
  "jsonrpc":"2.0",
  "id":1,
  "method":"author_insertKey",
  "params": [
    "aist",
    "//Alice",
    "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"
  ]
}'
```

---

## 📈 **监控和日志**

### **Substrate节点日志**

```bash
# 查看OCW日志
tail -f /tmp/alice/chains/dev/offchain_worker.log | grep "🤖\|📊\|🌐\|✅\|❌"

# 关键日志标记：
# 🤖 OCW started at block
# 📊 处理策略 #1
# 🌐 调用AI服务
# ✅ AI信号
# ❌ 错误信息
```

### **AI服务日志**

```bash
# 查看推理日志
tail -f ai-inference-service/logs/app.log

# 查看统计
curl http://localhost:8000/stats
```

### **链上事件**

```bash
# 监听事件（使用polkadot.js）
import { ApiPromise, WsProvider } from '@polkadot/api';

const provider = new WsProvider('ws://localhost:9944');
const api = await ApiPromise.create({ provider });

api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'aiStrategy') {
      console.log('Event:', event.method, event.data.toHuman());
    }
  });
});
```

---

## 🎯 **性能优化**

### **1. 减少HTTP延迟**

```rust
// 增加超时时间
.deadline(sp_io::offchain::timestamp().add(Duration::from_millis(30000)))

// 启用HTTP连接池（需修改runtime配置）
```

### **2. 优化市场数据获取**

```rust
// 缓存市场数据（避免重复获取）
use sp_runtime::offchain::storage::StorageValueRef;

let storage = StorageValueRef::persistent(b"market_data_cache");
if let Some(cached) = storage.get::<MarketData>() {
    // 使用缓存
}
```

### **3. 并行处理策略**

```rust
// TODO: 使用异步并行处理多个策略
// Substrate OCW目前不支持async/await，需等待未来版本
```

---

## 🔄 **迁移到生产环境**

### **1. 修改AI服务URL**

```rust
// 从硬编码改为链上配置
// pallets/ai-strategy/src/types.rs
pub struct AIServiceConfig {
    pub endpoint: BoundedVec<u8, ConstU32<256>>,
    pub api_key: Option<BoundedVec<u8, ConstU32<64>>>,
}

// 从链上读取配置
let config = AIServiceConfigs::<T>::get().unwrap_or_default();
let ai_service_url = config.endpoint.as_slice();
```

### **2. 实现真实市场数据获取**

```rust
// 调用Hyperliquid API
fn fetch_market_data(symbol: &[u8]) -> Result<MarketData, HttpError> {
    let url = b"https://api.hyperliquid.xyz/info";
    let request_body = format!(r#"{{"type":"l2Book","coin":"{}"}}"#, 
        sp_std::str::from_utf8(symbol).unwrap_or("BTC"));

    let response = http::Request::post(url, vec![request_body.into_bytes()])
        .send()?
        .wait()?;

    // 解析Hyperliquid响应
    parse_hyperliquid_response(&response.body())
}
```

### **3. 添加API认证**

```rust
// 添加API密钥
.add_header("Authorization", format!("Bearer {}", api_key).as_str())
```

---

## 📚 **参考资料**

1. **Substrate OCW文档**  
   https://docs.substrate.io/reference/how-to-guides/offchain-workers/

2. **FastAPI文档**  
   https://fastapi.tiangolo.com/

3. **DeepSeek API文档**  
   https://platform.deepseek.com/api-docs

4. **Polkadot.js API**  
   https://polkadot.js.org/docs/api

---

## ✅ **完成状态**

- [x] OCW核心实现
- [x] HTTP请求/响应
- [x] JSON编码/解码
- [x] 市场数据模拟
- [x] 签名交易提交
- [x] 错误处理
- [x] 单元测试
- [ ] 集成测试（待实施）
- [ ] 生产环境配置（待实施）
- [ ] 真实市场数据接入（待实施）

---

**版本**：v1.0.0  
**更新日期**：2025-11-04  
**状态**：✅ MVP完成，可测试

