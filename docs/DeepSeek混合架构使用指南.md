# DeepSeek混合架构使用指南

## 📋 **概述**

AI推理服务已升级为**混合架构v2.0**，结合DeepSeek商业API和本地轻量级模型，实现：

✅ **低成本**：DeepSeek API比自建GPU便宜99%  
✅ **高可靠**：API失败时自动降级到本地模型  
✅ **高性能**：简单场景使用本地模型（50ms），复杂场景调用DeepSeek（1-2s）  
✅ **数据安全**：自动脱敏，不发送敏感信息  
✅ **智能缓存**：Redis缓存减少重复请求  

---

## 🏗️ **架构图**

```
                      ┌─────────────────────────────┐
                      │   Substrate OCW (链上)     │
                      └──────────┬──────────────────┘
                                 │ HTTP POST
                                 ▼
                      ┌─────────────────────────────┐
                      │   FastAPI (AI推理服务)     │
                      │   /api/v1/inference        │
                      └──────────┬──────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ HybridInferenceService  │
                    │    (混合推理服务)        │
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
  ┌───────────────┐    ┌─────────────────┐    ┌───────────────┐
  │ Redis Cache   │    │ ScenarioClassifier│   │ Data Anonymizer│
  │  (缓存层)      │    │  (场景分类器)     │    │  (数据脱敏)     │
  └───────────────┘    └─────────┬─────────┘    └───────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
          ┌──────────────────┐      ┌──────────────────┐
          │  DeepSeek API    │      │  Local Model     │
          │  (复杂场景)       │      │  (简单场景+降级)  │
          │  - GPT推理        │      │  - RSI规则        │
          │  - 多因子分析     │      │  - MACD金叉      │
          └──────────────────┘      └──────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Trading Signal  │
                        │  BUY/SELL/HOLD  │
                        └──────────────────┘
```

---

## 🚀 **快速开始**

### **1. 安装依赖**

```bash
cd /home/xiaodong/文档/stardust/ai-inference-service

# 创建Python虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### **2. 配置环境变量**

```bash
# 复制环境变量模板
cp .env-template .env

# 编辑.env文件，填入你的DeepSeek API密钥
nano .env
```

在`.env`中至少配置：

```bash
# DeepSeek API密钥（必需）
DEEPSEEK_API_KEY=sk-your-actual-key-here

# Redis URL（可选，如果没有Redis会禁用缓存但不影响运行）
REDIS_URL=redis://localhost:6379
```

**获取DeepSeek API密钥：**
1. 访问 https://platform.deepseek.com/
2. 注册账号并登录
3. 创建API密钥
4. 复制密钥到`.env`文件

### **3. 启动Redis（可选但推荐）**

```bash
# Docker方式
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 或使用系统Redis
sudo systemctl start redis
```

### **4. 启动服务**

```bash
# 开发模式（自动重载）
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 生产模式
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### **5. 验证服务**

```bash
# 健康检查
curl http://localhost:8000/health

# 查看统计
curl http://localhost:8000/stats

# 测试推理（需要发送完整请求）
curl -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

---

## 🔧 **工作原理**

### **1. 场景自动分类**

服务会自动分析市场场景复杂度：

#### **简单场景 → 本地模型**
- RSI极端值（>80或<20）+ 放量
- 低波动震荡市但RSI明确
- **优势**：响应快（<50ms），无成本

#### **复杂场景 → DeepSeek API**
- 高波动市场（>3%）
- 震荡区间（RSI 45-55）
- 技术指标信号冲突
- **优势**：AI分析，准确度高

### **2. 数据脱敏**

发送给DeepSeek的数据会自动脱敏：

✅ **保留**：
- 标准技术指标（RSI、MACD、布林带等）
- 价格相对变化
- 成交量比例

❌ **移除**：
- 账户余额
- 持仓信息
- 钱包地址
- 自定义策略特征

### **3. 自动降级**

```python
连续失败3次 → 自动切换到本地模型
DeepSeek恢复 → 自动切回DeepSeek
```

### **4. 智能缓存**

- 相同市场状态的信号缓存60秒
- 避免重复计算和API调用
- 缓存失败不影响服务可用性

---

## 📊 **API接口**

### **POST /api/v1/inference**

生成交易信号

**请求示例：**

```json
{
  "strategy_id": 1,
  "market_data": {
    "symbol": "BTC-USD",
    "current_price": 65000.0,
    "prices_1h": [64800, 64850, ...], // 12个价格点
    "prices_24h": [63000, 63100, ...], // 288个价格点
    "volumes_24h": [1000000, 1100000, ...],
    "bid_ask_spread": 5.0,
    "funding_rate": 0.0001,
    "timestamp": 1730000000
  },
  "model_type": "ensemble", // 或 "local" 强制使用本地模型
  "confidence_threshold": 60
}
```

**响应示例：**

```json
{
  "signal": "BUY",
  "confidence": 75,
  "position_size": 0.3,
  "entry_price": 65000.0,
  "stop_loss": 63700.0,
  "take_profit": 68900.0,
  "reasoning": "技术指标显示超卖反弹机会：RSI=28（超卖）、MACD金叉形成、成交量放大2.3倍确认...",
  "feature_importance": {...},
  "risk_score": 35,
  "market_condition": "Oversold",
  "models_used": ["feature_engineer", "risk_manager", "deepseek", "complex"],
  "inference_time_ms": 1250,
  "timestamp": 1730000100
}
```

### **GET /health**

健康检查

```json
{
  "status": "healthy",
  "components": {
    "redis": "healthy",
    "deepseek": "healthy",
    "local_model": "healthy"
  },
  "timestamp": 1730000000
}
```

### **GET /stats**

服务统计

```json
{
  "stats": {
    "total_requests": 1000,
    "cache_hits": 250,
    "deepseek_calls": 500,
    "local_calls": 250,
    "fallback_calls": 0,
    "errors": 0,
    "cache_hit_rate": 25.0,
    "deepseek_usage_rate": 50.0,
    "local_usage_rate": 25.0,
    "consecutive_failures": 0,
    "deepseek_stats": {
      "total_cost": 0.25,  // 美元
      "total_tokens": 125000
    }
  }
}
```

---

## 💰 **成本分析**

### **DeepSeek定价（2025年）**

| 项目 | 价格 |
|------|------|
| 输入tokens | ¥1 / 百万tokens |
| 输出tokens | ¥2 / 百万tokens |

### **实际成本估算**

假设每天1000次请求：

```
平均每次请求：
- 输入：500 tokens
- 输出：200 tokens

每天成本 = (500×1 + 200×2) × 1000 / 1000000
         = ¥0.9/天
         ≈ $0.13/天
         ≈ $4/月
```

**对比自建GPU：**
- 自建成本：$6600-13100/月
- DeepSeek成本：$4-40/月（取决于请求量）
- **节省：99%+**

---

## 🛡️ **安全最佳实践**

### **1. API密钥保护**

```bash
# ❌ 不要
export DEEPSEEK_API_KEY=sk-xxx  # 明文环境变量

# ✅ 推荐
# 使用.env文件（不要提交到git）
echo ".env" >> .gitignore
```

### **2. 数据脱敏验证**

服务会自动检查敏感字段：

```python
# 黑名单字段
SENSITIVE_FIELDS = {
    'account_id', 'user_id', 'wallet_address',
    'balance', 'position_size', 'pnl',
    'api_key', 'secret_key', 'private_key'
}
```

如果检测到敏感字段，请求会被拒绝。

### **3. 生产环境配置**

```bash
# .env生产配置
ENABLE_ANONYMIZATION=true
FALLBACK_TO_LOCAL=true
LOG_LEVEL=WARNING
CORS_ORIGINS=https://your-frontend-domain.com
```

---

## 🐛 **故障排除**

### **问题1：DeepSeek连续失败**

**症状**：日志显示"DeepSeek连续失败X次，自动降级"

**原因**：
- API密钥无效
- 网络连接问题
- API配额用尽

**解决**：
```bash
# 检查API密钥
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"

# 查看服务统计
curl http://localhost:8000/stats
```

### **问题2：Redis连接失败**

**症状**：日志显示"Redis连接失败，缓存功能将不可用"

**影响**：服务仍可正常运行，但没有缓存

**解决**：
```bash
# 启动Redis
docker start redis

# 或修改.env禁用Redis
# 注释掉 REDIS_URL
```

### **问题3：推理速度慢**

**排查**：
```bash
# 查看统计，确认使用的模型
curl http://localhost:8000/stats

# 查看响应中的 inference_time_ms
```

**优化**：
- 启用Redis缓存
- 增加缓存TTL
- 调整场景分类策略（更多使用本地模型）

---

## 📈 **监控和优化**

### **关键指标**

通过 `/stats` 端点监控：

1. **缓存命中率**：理想 >30%
2. **DeepSeek使用率**：根据预算控制
3. **降级率**：应接近0%
4. **错误率**：应 <1%
5. **平均成本**：根据请求量调整

### **优化建议**

1. **提高缓存命中率**
   ```bash
   # 增加缓存TTL
   CACHE_TTL=300  # 5分钟
   ```

2. **控制DeepSeek成本**
   ```python
   # 调整场景分类，更多使用本地模型
   # 修改 app/models/local_simple_model.py
   # ScenarioClassifier.classify()
   ```

3. **启用请求去重**
   ```python
   # 相同策略ID在N秒内只请求一次
   ```

---

## 🔄 **从旧版本迁移**

如果你之前使用的是Week 3-4的纯本地模型版本：

### **1. 更新代码**

```bash
cd /home/xiaodong/文档/stardust/ai-inference-service
git pull  # 如果使用git
```

### **2. 安装新依赖**

```bash
pip install openai==1.14.0 cryptography==42.0.0
```

### **3. 配置环境变量**

```bash
cp .env-template .env
# 编辑 .env 添加 DEEPSEEK_API_KEY
```

### **4. 重启服务**

```bash
# 停止旧服务
pkill -f "uvicorn app.main:app"

# 启动新服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### **5. 验证**

```bash
# 检查版本
curl http://localhost:8000/ | jq .version
# 应返回 "2.0.0"

# 查看统计，确认混合架构生效
curl http://localhost:8000/stats
```

---

## 📝 **开发和测试**

### **本地开发**

```bash
# 只使用本地模型（不需要DeepSeek API）
export DEEPSEEK_API_KEY=dummy-key

# 启动服务
python -m uvicorn app.main:app --reload

# 所有请求会自动降级到本地模型
```

### **单元测试**

```bash
# 测试本地模型
python -m pytest tests/test_local_model.py

# 测试数据脱敏
python -m pytest tests/test_anonymizer.py

# 测试混合服务
python -m pytest tests/test_hybrid_service.py
```

### **性能测试**

```bash
# 使用wrk压测
wrk -t4 -c100 -d30s -s test_inference.lua http://localhost:8000/api/v1/inference
```

---

## 🎯 **下一步**

- [ ] 集成更多AI服务（Claude、Gemini）
- [ ] 实现A/B测试框架
- [ ] 添加模型性能对比
- [ ] 集成情绪数据源
- [ ] 集成链上数据源
- [ ] 实现Prompt工程优化
- [ ] 添加模型微调接口

---

## 📞 **支持**

遇到问题？

1. 查看日志：`tail -f logs/app.log`
2. 查看统计：`curl http://localhost:8000/stats`
3. 查看健康：`curl http://localhost:8000/health`

---

**版本**：v2.0.0  
**更新日期**：2025-11-04  
**架构**：DeepSeek API + 本地模型混合架构

