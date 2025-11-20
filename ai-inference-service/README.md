# AI推理服务 (AI Inference Service)

## 概述

AI推理服务是AI驱动的Substrate-Hyperliquid自动化交易系统的核心组件，负责生成交易信号并提供风险评估。

## 技术栈

- **框架**: FastAPI 0.104+
- **Python**: 3.10+
- **AI模型**: 
  - LSTM (时序预测)
  - Transformer (上下文理解)
  - Random Forest (特征重要性)
  - GPT-4/Claude (可选，高级推理)
- **部署**: Docker + Redis

## 项目结构

```
ai-inference-service/
├── app/
│   ├── main.py                 # FastAPI主应用
│   ├── models/                 # AI模型模块
│   ├── features/               # 特征工程
│   ├── risk/                   # 风险管理
│   ├── explainability/         # 可解释性
│   └── api/                    # API路由
├── models/                     # 训练好的模型文件
├── data/                       # 历史数据
│   └── historical/
├── tests/                      # 单元测试
├── docker/                     # Docker相关
├── requirements.txt            # Python依赖
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 快速开始

### 本地开发

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
python -m app.main

# 服务将在 http://localhost:8000 启动
# API文档: http://localhost:8000/docs
```

### Docker部署

```bash
# 1. 构建镜像
docker-compose build

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f ai-inference
```

## API端点

### 健康检查

```bash
curl http://localhost:8000/health
```

### 交易信号推理

```bash
curl -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": 1,
    "market_data": {
      "symbol": "BTC-USD",
      "current_price": 45000.0,
      "prices_1h": [45000, 45100, ...],
      "prices_24h": [44000, 44100, ...],
      "volumes_24h": [1000, 1100, ...],
      "bid_ask_spread": 0.01,
      "timestamp": 1699000000
    },
    "model_type": "lstm",
    "confidence_threshold": 60
  }'
```

**响应示例:**

```json
{
  "signal": "BUY",
  "confidence": 75,
  "position_size": 1000.0,
  "entry_price": 45000.0,
  "stop_loss": 44100.0,
  "take_profit": 45900.0,
  "reasoning": "基于LSTM预测，未来1小时价格上涨概率75%。市场动量强劲，技术指标看涨。",
  "feature_importance": {
    "price_momentum": 0.35,
    "volume_trend": 0.25,
    "rsi": 0.20,
    "macd": 0.20
  },
  "risk_score": 35,
  "market_condition": "Bullish",
  "models_used": ["lstm", "random_forest"],
  "inference_time_ms": 120,
  "timestamp": 1699000000
}
```

## MVP实现状态（Week 1-2）

✅ **已完成**:
- FastAPI基础框架
- 健康检查端点
- 推理API接口定义
- 简单的RSI策略（占位符）
- Docker配置
- 基础文档

⏳ **待完成**（Week 3-4）:
- 真正的AI模型训练
- 特征工程pipeline
- 风险管理模块
- 可解释性模块
- 历史数据加载
- 模型缓存优化

## 开发路线图

### Week 1-2 (MVP阶段) ✅
- [x] 创建项目结构
- [x] 实现基础API端点
- [x] 简单的交易信号逻辑

### Week 3-4 (AI模型集成)
- [ ] 实现LSTM时序预测模型
- [ ] 实现Transformer模型
- [ ] 实现Random Forest分类器
- [ ] 集成GPT-4/Claude API（可选）
- [ ] 特征工程pipeline

### Week 5-6 (优化与测试)
- [ ] 模型调优
- [ ] 性能优化（缓存、批处理）
- [ ] 单元测试和集成测试
- [ ] 压力测试

## 环境变量配置

参考 `env-template` 文件：

- `ENVIRONMENT`: 运行环境 (development/production)
- `PORT`: 服务端口 (默认8000)
- `MODEL_PATH`: 模型文件路径
- `REDIS_HOST`: Redis缓存地址

## 监控和日志

- **健康检查**: `/health`
- **API文档**: `/docs` (Swagger UI)
- **日志级别**: 通过 `LOG_LEVEL` 环境变量配置

## 注意事项

1. **MVP阶段**: 当前使用简单的RSI策略，仅用于验证架构
2. **AI模型**: Week 3-4将实现真正的深度学习模型
3. **历史数据**: 需要至少1年的市场数据用于训练
4. **API密钥**: GPT-4/Claude需要配置API密钥（可选）

## 测试

```bash
# 运行单元测试
pytest tests/

# 测试推理API
curl -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  --data-binary @tests/fixtures/sample_request.json
```

## 贡献指南

1. Fork本项目
2. 创建特性分支
3. 提交代码
4. 创建Pull Request

## 许可证

MIT License

