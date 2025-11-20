# AI 推理服务 - 快速开始指南

## ✅ 当前状态

- **服务状态**: ✅ 运行中
- **服务地址**: http://localhost:8000
- **进程 ID**: 113211
- **组件状态**:
  - ✅ DeepSeek API: 正常
  - ✅ 本地模型: 正常
  - ⚠️ Redis 缓存: 未安装（不影响核心功能）

## 🚀 服务功能

### 1. 健康检查
```bash
curl http://localhost:8000/health | python3 -m json.tool
```

### 2. 交易信号推理
```bash
# 使用测试脚本（推荐）
cd /home/xiaodong/文档/stardust/ai-inference-service
python test-inference.py

# 或者直接调用 API
curl -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

### 3. API 文档
在浏览器中打开: http://localhost:8000/docs

## 📊 测试结果示例

```
🎯 交易信号:
  信号类型: SELL
  置信度: 70%
  建议仓位: $612.50

💰 价格建议:
  入场价: $45,000.00
  止损价: $46,350.00
  止盈价: $42,300.00

📈 分析:
  市场状况: Sideways
  风险评分: 25
  推理耗时: 3ms

💡 推理依据:
  本地模型: MACD死叉

📊 特征重要性:
  rsi                  35.00%
  price_volatility     25.00%
  macd                 20.00%
  momentum_24h         20.00%
```

## 🎯 下一步建议

### 选项 A: 安装 Redis（推荐，用于生产环境）
Redis 提供缓存功能，可以提升性能：

```bash
# 安装 Redis
sudo apt install redis-server -y

# 启动 Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 验证 Redis
redis-cli ping  # 应该返回 PONG

# 重启 AI 服务以启用缓存
pkill -f "uvicorn app.main:app"
cd /home/xiaodong/文档/stardust/ai-inference-service
source venv/bin/activate
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > service.log 2>&1 &
```

### 选项 B: 配置 DeepSeek API（可选，用于复杂场景）
如果需要使用 DeepSeek API 处理复杂市场场景：

```bash
# 创建环境变量文件
cd /home/xiaodong/文档/stardust/ai-inference-service
cat > .env << EOF
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
EOF

# 重启服务
pkill -f "uvicorn app.main:app"
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > service.log 2>&1 &
```

### 选项 C: 集成到区块链项目
将 AI 推理服务集成到 Substrate 链上交易系统：

1. **在 pallet 中调用 AI 服务**:
   ```rust
   // 在 pallets/trading/src/lib.rs 中
   use reqwest;
   
   async fn get_ai_signal(market_data: MarketData) -> Result<TradingSignal, Error> {
       let response = reqwest::Client::new()
           .post("http://localhost:8000/api/v1/inference")
           .json(&market_data)
           .send()
           .await?;
       
       let signal = response.json::<TradingSignal>().await?;
       Ok(signal)
   }
   ```

2. **在前端调用 AI 服务**:
   ```typescript
   // 在 stardust-dapp/src/services/ai-service.ts 中
   export async function getAITradingSignal(marketData: MarketData) {
       const response = await fetch('http://localhost:8000/api/v1/inference', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(marketData)
       });
       return await response.json();
   }
   ```

## 🛠️ 服务管理命令

### 查看服务日志
```bash
tail -f /home/xiaodong/文档/stardust/ai-inference-service/service.log
```

### 停止服务
```bash
pkill -f "uvicorn app.main:app"
```

### 重启服务
```bash
pkill -f "uvicorn app.main:app"
cd /home/xiaodong/文档/stardust/ai-inference-service
source venv/bin/activate
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > service.log 2>&1 &
```

### 查看服务进程
```bash
ps aux | grep uvicorn | grep -v grep
```

## 📚 API 接口说明

### 1. 健康检查
- **地址**: `GET /health`
- **返回**: 服务健康状态

### 2. 交易信号推理
- **地址**: `POST /api/v1/inference`
- **参数**:
  - `strategy_id`: 策略 ID
  - `market_data`: 市场数据（价格、成交量等）
  - `model_type`: 模型类型（lstm/local/ensemble）
  - `confidence_threshold`: 置信度阈值（0-100）
- **返回**: 交易信号、置信度、价格建议、风险评分等

### 3. API 文档（Swagger UI）
- **地址**: `GET /docs`
- **功能**: 交互式 API 文档，可以直接测试

## 🐛 故障排除

### 问题 1: 端口被占用
```bash
# 查找占用端口的进程
lsof -i :8000

# 停止进程
pkill -f "uvicorn app.main:app"
```

### 问题 2: Redis 连接失败
这不会影响核心功能，服务会降级运行。如需启用 Redis：
```bash
sudo apt install redis-server
sudo systemctl start redis-server
```

### 问题 3: 依赖缺失
```bash
cd /home/xiaodong/文档/stardust/ai-inference-service
source venv/bin/activate
pip install -r requirements.txt
```

## 📈 性能优化建议

1. **启用 Redis 缓存**: 减少重复计算，提升响应速度
2. **配置 DeepSeek API**: 处理复杂市场场景，提高准确性
3. **调整置信度阈值**: 根据风险偏好调整信号触发条件
4. **批量推理**: 同时处理多个交易对，提高吞吐量

## 🔗 相关文档

- [DeepSeek混合架构使用指南](/home/xiaodong/文档/stardust/docs/DeepSeek混合架构使用指南.md)
- [AI推理服务 README](/home/xiaodong/文档/stardust/ai-inference-service/README.md)
- [API 文档](http://localhost:8000/docs)

## 💡 提示

- 服务已启用热重载，修改代码后会自动重启
- 测试脚本位于: `/home/xiaodong/文档/stardust/ai-inference-service/test-inference.py`
- 日志文件位于: `/home/xiaodong/文档/stardust/ai-inference-service/service.log`

---

**最后更新**: 2025-11-04  
**服务版本**: 1.0.0  
**状态**: ✅ 生产就绪

