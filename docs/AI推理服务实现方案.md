# AI推理服务实现方案

> 编写时间：2025-11-04  
> 版本：v1.0  
> 父文档：AI驱动的Substrate-Hyperliquid自动化交易系统综合方案

---

## 1️⃣ 服务架构

### 1.1 技术栈

```python
# 核心依赖
fastapi==0.104.0          # Web框架
uvicorn==0.24.0           # ASGI服务器
pydantic==2.5.0           # 数据验证
torch==2.1.0              # 深度学习框架
transformers==4.35.0      # Hugging Face模型
openai==1.3.0             # OpenAI API
anthropic==0.7.0          # Claude API
scikit-learn==1.3.0       # 传统机器学习
ta==0.11.0                # 技术指标计算
pandas==2.1.0             # 数据处理
numpy==1.24.0             # 数值计算
redis==5.0.0              # 缓存
aiohttp==3.9.0            # 异步HTTP
```

### 1.2 服务结构

```
ai-inference-service/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI应用入口
│   ├── config.py                  # 配置管理
│   ├── models/                    # AI模型
│   │   ├── __init__.py
│   │   ├── gpt4_analyzer.py      # GPT-4分析器
│   │   ├── claude_analyzer.py    # Claude分析器
│   │   ├── transformer_model.py  # Transformer模型
│   │   ├── lstm_model.py         # LSTM模型
│   │   ├── random_forest.py      # 随机森林
│   │   └── ensemble.py           # 集成模型
│   ├── features/                  # 特征工程
│   │   ├── __init__.py
│   │   ├── technical.py          # 技术指标
│   │   ├── sentiment.py          # 情绪分析
│   │   ├── onchain.py            # 链上数据
│   │   └── macro.py              # 宏观指标
│   ├── data/                      # 数据处理
│   │   ├── __init__.py
│   │   ├── collectors.py         # 数据收集器
│   │   ├── preprocessors.py      # 数据预处理
│   │   └── cache.py              # 缓存管理
│   ├── risk/                      # 风险管理
│   │   ├── __init__.py
│   │   ├── risk_assessor.py      # 风险评估
│   │   └── position_sizer.py     # 仓位计算
│   ├── explainability/            # 可解释性
│   │   ├── __init__.py
│   │   ├── shap_explainer.py     # SHAP解释器
│   │   └── attention_viz.py      # 注意力可视化
│   └── api/                       # API端点
│       ├── __init__.py
│       ├── inference.py          # 推理接口
│       ├── health.py             # 健康检查
│       └── metrics.py            # 性能指标
├── models/                        # 模型文件
│   ├── transformer_v1.pth
│   ├── lstm_v1.pth
│   └── rf_v1.pkl
├── data/                          # 数据文件
│   └── historical/
├── tests/                         # 测试
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## 2️⃣ 核心代码实现

### 2.1 主应用 (main.py)

```python
"""
AI推理服务主入口
提供RESTful API供Substrate OCW调用
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uvicorn
from datetime import datetime

from app.models.ensemble import EnsembleModel
from app.features.technical import TechnicalFeatures
from app.features.sentiment import SentimentFeatures
from app.risk.risk_assessor import RiskAssessor
from app.data.cache import CacheManager
from app.config import settings

# 初始化FastAPI
app = FastAPI(
    title="AI Trading Inference Service",
    description="AI驱动的交易信号推理服务",
    version="1.0.0"
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化全局组件
ensemble_model = EnsembleModel()
technical_features = TechnicalFeatures()
sentiment_features = SentimentFeatures()
risk_assessor = RiskAssessor()
cache_manager = CacheManager()


# === 数据模型 ===

class MarketData(BaseModel):
    """市场数据"""
    symbol: str = Field(..., example="BTC-USD")
    current_price: float = Field(..., gt=0)
    prices_1h: List[float] = Field(..., min_items=12)  # 过去1小时，5分钟间隔
    prices_24h: List[float] = Field(..., min_items=288) # 过去24小时，5分钟间隔
    volumes_24h: List[float]
    bid_ask_spread: float
    order_book_depth: Dict[str, List[List[float]]] # {"bids": [[price, size]], "asks": []}
    funding_rate: Optional[float] = None
    timestamp: int


class OnChainData(BaseModel):
    """链上数据"""
    large_transfers: List[Dict] = Field(default_factory=list)
    exchange_inflow: float = Field(default=0.0)
    exchange_outflow: float = Field(default=0.0)
    active_addresses: int = Field(default=0)
    gas_price: float = Field(default=0.0)


class SentimentData(BaseModel):
    """情绪数据"""
    twitter_sentiment: float = Field(default=0.0, ge=-1.0, le=1.0)
    reddit_sentiment: float = Field(default=0.0, ge=-1.0, le=1.0)
    fear_greed_index: int = Field(default=50, ge=0, le=100)
    social_volume: int = Field(default=0)


class AccountState(BaseModel):
    """账户状态"""
    total_position_size: float = Field(default=0.0)
    margin: float = Field(default=0.0)
    unrealized_pnl: float = Field(default=0.0)
    available_balance: float


class InferenceRequest(BaseModel):
    """推理请求"""
    strategy_id: int
    market_data: MarketData
    onchain_data: Optional[OnChainData] = None
    sentiment_data: Optional[SentimentData] = None
    account_state: AccountState
    
    # AI配置
    model_type: str = Field(default="ensemble", pattern="^(gpt4|claude|transformer|lstm|ensemble)$")
    confidence_threshold: int = Field(default=60, ge=0, le=100)
    features_enabled: List[str] = Field(
        default=["technical", "sentiment", "onchain", "macro"]
    )


class InferenceResponse(BaseModel):
    """推理响应"""
    signal: str = Field(..., pattern="^(BUY|SELL|HOLD|CLOSE)$")
    confidence: int = Field(..., ge=0, le=100)
    position_size: float = Field(..., gt=0)
    entry_price: float = Field(..., gt=0)
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    
    # 可解释性
    reasoning: str = Field(..., description="自然语言解释")
    feature_importance: Dict[str, float] = Field(
        ..., 
        description="特征重要性分数"
    )
    
    # 风险评估
    risk_score: int = Field(..., ge=0, le=100)
    market_condition: str = Field(..., pattern="^(Bullish|Bearish|Sideways|HighVolatility|LowLiquidity|Uncertain)$")
    
    # 模型信息
    models_used: List[str]
    model_votes: Dict[str, str] = Field(
        ..., 
        description="各模型的投票结果"
    )
    
    # 元数据
    inference_time_ms: int
    timestamp: int


# === API端点 ===

@app.post("/api/v1/inference", response_model=InferenceResponse)
async def predict_trade_signal(request: InferenceRequest):
    """
    生成交易信号
    
    核心推理接口，Substrate OCW将调用此端点
    """
    try:
        start_time = datetime.now()
        
        # 1. 检查缓存
        cache_key = f"inference:{request.strategy_id}:{request.market_data.symbol}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            return cached_result
        
        # 2. 特征工程
        features = await _extract_features(request)
        
        # 3. AI推理
        if request.model_type == "ensemble":
            signal_result = await ensemble_model.predict(features)
        elif request.model_type == "gpt4":
            from app.models.gpt4_analyzer import GPT4Analyzer
            gpt4 = GPT4Analyzer()
            signal_result = await gpt4.analyze(features)
        elif request.model_type == "transformer":
            from app.models.transformer_model import TransformerModel
            transformer = TransformerModel()
            signal_result = await transformer.predict(features)
        elif request.model_type == "lstm":
            from app.models.lstm_model import LSTMModel
            lstm = LSTMModel()
            signal_result = await lstm.predict(features)
        else:
            raise HTTPException(status_code=400, detail="不支持的模型类型")
        
        # 4. 风险评估
        risk_assessment = risk_assessor.assess(
            signal_result,
            request.market_data,
            request.account_state
        )
        
        # 5. 仓位计算
        from app.risk.position_sizer import PositionSizer
        position_sizer = PositionSizer()
        position_size = position_sizer.calculate(
            signal_result["signal"],
            signal_result["confidence"],
            risk_assessment["risk_score"],
            request.account_state.available_balance,
            request.market_data.current_price
        )
        
        # 6. 计算止损止盈
        stop_loss, take_profit = _calculate_stop_loss_take_profit(
            signal_result["signal"],
            request.market_data.current_price,
            risk_assessment
        )
        
        # 7. 构建响应
        end_time = datetime.now()
        inference_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        response = InferenceResponse(
            signal=signal_result["signal"],
            confidence=signal_result["confidence"],
            position_size=position_size,
            entry_price=request.market_data.current_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            reasoning=signal_result["reasoning"],
            feature_importance=signal_result["feature_importance"],
            risk_score=risk_assessment["risk_score"],
            market_condition=risk_assessment["market_condition"],
            models_used=signal_result["models_used"],
            model_votes=signal_result["model_votes"],
            inference_time_ms=inference_time_ms,
            timestamp=int(datetime.now().timestamp())
        )
        
        # 8. 缓存结果（30秒）
        cache_manager.set(cache_key, response, ttl=30)
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"推理失败: {str(e)}")


async def _extract_features(request: InferenceRequest) -> Dict:
    """
    提取特征
    """
    features = {}
    
    # 技术指标
    if "technical" in request.features_enabled:
        features["technical"] = technical_features.extract(
            request.market_data.prices_24h,
            request.market_data.volumes_24h,
            request.market_data.current_price
        )
    
    # 情绪指标
    if "sentiment" in request.features_enabled and request.sentiment_data:
        features["sentiment"] = sentiment_features.extract(
            request.sentiment_data
        )
    
    # 链上指标
    if "onchain" in request.features_enabled and request.onchain_data:
        from app.features.onchain import OnChainFeatures
        onchain_features = OnChainFeatures()
        features["onchain"] = onchain_features.extract(
            request.onchain_data
        )
    
    # 宏观指标
    if "macro" in request.features_enabled:
        from app.features.macro import MacroFeatures
        macro_features = MacroFeatures()
        features["macro"] = await macro_features.extract(
            request.market_data.symbol
        )
    
    # 市场微观结构
    features["microstructure"] = {
        "bid_ask_spread": request.market_data.bid_ask_spread,
        "order_book_imbalance": _calculate_order_book_imbalance(
            request.market_data.order_book_depth
        ),
        "funding_rate": request.market_data.funding_rate or 0.0
    }
    
    return features


def _calculate_order_book_imbalance(depth: Dict) -> float:
    """计算订单簿失衡"""
    bids_volume = sum([order[1] for order in depth.get("bids", [])])
    asks_volume = sum([order[1] for order in depth.get("asks", [])])
    
    if bids_volume + asks_volume == 0:
        return 0.0
    
    return (bids_volume - asks_volume) / (bids_volume + asks_volume)


def _calculate_stop_loss_take_profit(
    signal: str,
    entry_price: float,
    risk_assessment: Dict
) -> tuple:
    """
    计算止损止盈价格
    
    基于ATR和风险评分动态调整
    """
    atr = risk_assessment.get("atr", entry_price * 0.02)
    risk_score = risk_assessment["risk_score"]
    
    # 风险越高，止损越紧
    stop_loss_multiplier = 2.0 if risk_score < 50 else 1.5
    take_profit_multiplier = 3.0 if risk_score < 50 else 2.0
    
    if signal == "BUY":
        stop_loss = entry_price - (atr * stop_loss_multiplier)
        take_profit = entry_price + (atr * take_profit_multiplier)
    elif signal == "SELL":
        stop_loss = entry_price + (atr * stop_loss_multiplier)
        take_profit = entry_price - (atr * take_profit_multiplier)
    else:
        stop_loss = None
        take_profit = None
    
    return stop_loss, take_profit


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": int(datetime.now().timestamp()),
        "models_loaded": ensemble_model.is_loaded(),
        "cache_connected": cache_manager.is_connected()
    }


@app.get("/metrics")
async def get_metrics():
    """性能指标"""
    return {
        "total_inferences": cache_manager.get_counter("total_inferences"),
        "avg_inference_time_ms": cache_manager.get_avg("inference_time_ms"),
        "cache_hit_rate": cache_manager.get_hit_rate(),
        "active_strategies": cache_manager.get_counter("active_strategies")
    }


# === 启动服务 ===

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=4
    )
```

### 2.2 集成模型 (ensemble.py)

```python
"""
集成模型
组合多个AI模型的预测结果
"""

import torch
import asyncio
from typing import Dict, List
import logging

from app.models.gpt4_analyzer import GPT4Analyzer
from app.models.transformer_model import TransformerModel
from app.models.lstm_model import LSTMModel
from app.models.random_forest import RandomForestModel

logger = logging.getLogger(__name__)


class EnsembleModel:
    """
    集成模型
    
    组成：
    1. GPT-4 (基本面分析、新闻事件) - 权重35%
    2. Transformer (技术分析) - 权重30%
    3. LSTM (短期动量) - 权重20%
    4. Random Forest (风险评估) - 权重15%
    """
    
    def __init__(self):
        # 初始化子模型
        self.gpt4 = GPT4Analyzer()
        self.transformer = TransformerModel()
        self.lstm = LSTMModel()
        self.rf = RandomForestModel()
        
        # 模型权重
        self.weights = {
            "gpt4": 0.35,
            "transformer": 0.30,
            "lstm": 0.20,
            "rf": 0.15
        }
        
        # 信号映射
        self.signal_map = {
            "BUY": 1.0,
            "SELL": -1.0,
            "HOLD": 0.0,
            "CLOSE": -0.5
        }
        
        self._loaded = False
    
    def is_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._loaded
    
    async def load_models(self):
        """加载所有模型"""
        logger.info("开始加载模型...")
        
        await asyncio.gather(
            self.transformer.load(),
            self.lstm.load(),
            self.rf.load()
        )
        
        self._loaded = True
        logger.info("所有模型加载完成")
    
    async def predict(self, features: Dict) -> Dict:
        """
        集成预测
        
        参数:
            features: 特征字典
        
        返回:
            包含信号、置信度、推理等信息的字典
        """
        try:
            # 并行调用所有模型
            results = await asyncio.gather(
                self._predict_gpt4(features),
                self._predict_transformer(features),
                self._predict_lstm(features),
                self._predict_rf(features),
                return_exceptions=True
            )
            
            gpt4_result, transformer_result, lstm_result, rf_result = results
            
            # 处理异常
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"模型 {i} 预测失败: {str(result)}")
                    # 使用默认值
                    results[i] = {
                        "signal": "HOLD",
                        "confidence": 0,
                        "reasoning": "模型异常"
                    }
            
            # 加权投票
            final_signal, final_confidence = self._weighted_voting({
                "gpt4": gpt4_result,
                "transformer": transformer_result,
                "lstm": lstm_result,
                "rf": rf_result
            })
            
            # 生成综合推理
            reasoning = self._generate_ensemble_reasoning({
                "gpt4": gpt4_result,
                "transformer": transformer_result,
                "lstm": lstm_result,
                "rf": rf_result
            }, final_signal, final_confidence)
            
            # 特征重要性
            feature_importance = self._calculate_feature_importance(features)
            
            return {
                "signal": final_signal,
                "confidence": final_confidence,
                "reasoning": reasoning,
                "feature_importance": feature_importance,
                "models_used": ["gpt4", "transformer", "lstm", "random_forest"],
                "model_votes": {
                    "gpt4": gpt4_result["signal"],
                    "transformer": transformer_result["signal"],
                    "lstm": lstm_result["signal"],
                    "random_forest": rf_result["signal"]
                }
            }
            
        except Exception as e:
            logger.error(f"集成预测失败: {str(e)}")
            # 返回保守的HOLD信号
            return {
                "signal": "HOLD",
                "confidence": 0,
                "reasoning": f"集成预测失败: {str(e)}",
                "feature_importance": {},
                "models_used": [],
                "model_votes": {}
            }
    
    async def _predict_gpt4(self, features: Dict) -> Dict:
        """GPT-4预测"""
        return await self.gpt4.analyze(features)
    
    async def _predict_transformer(self, features: Dict) -> Dict:
        """Transformer预测"""
        return await self.transformer.predict(features)
    
    async def _predict_lstm(self, features: Dict) -> Dict:
        """LSTM预测"""
        return await self.lstm.predict(features)
    
    async def _predict_rf(self, features: Dict) -> Dict:
        """Random Forest预测"""
        return await self.rf.predict(features)
    
    def _weighted_voting(self, model_results: Dict) -> tuple:
        """
        加权投票
        
        返回: (final_signal, final_confidence)
        """
        # 将信号转为数值
        weighted_sum = 0.0
        confidence_sum = 0.0
        
        for model_name, result in model_results.items():
            signal_value = self.signal_map.get(result["signal"], 0.0)
            confidence = result["confidence"] / 100.0
            weight = self.weights[model_name]
            
            weighted_sum += signal_value * confidence * weight
            confidence_sum += confidence * weight
        
        # 转换回信号
        if weighted_sum > 0.3:
            final_signal = "BUY"
        elif weighted_sum < -0.3:
            final_signal = "SELL"
        else:
            final_signal = "HOLD"
        
        # 最终置信度
        final_confidence = int(abs(weighted_sum / confidence_sum) * 100) if confidence_sum > 0 else 0
        final_confidence = min(100, max(0, final_confidence))
        
        return final_signal, final_confidence
    
    def _generate_ensemble_reasoning(
        self,
        model_results: Dict,
        final_signal: str,
        final_confidence: int
    ) -> str:
        """
        生成综合推理说明
        """
        # 统计模型投票
        buy_votes = sum(1 for r in model_results.values() if r["signal"] == "BUY")
        sell_votes = sum(1 for r in model_results.values() if r["signal"] == "SELL")
        hold_votes = sum(1 for r in model_results.values() if r["signal"] == "HOLD")
        
        reasoning = f"集成模型分析结果：最终信号【{final_signal}】，置信度{final_confidence}%。\n\n"
        reasoning += f"模型投票统计：BUY({buy_votes}票)，SELL({sell_votes}票)，HOLD({hold_votes}票)。\n\n"
        
        # 各模型观点
        reasoning += "各模型观点：\n"
        for model_name, result in model_results.items():
            reasoning += f"- {model_name.upper()}: {result['signal']} (置信度{result['confidence']}%)\n"
            if "reasoning" in result and result["reasoning"]:
                reasoning += f"  理由: {result['reasoning'][:100]}...\n"
        
        return reasoning
    
    def _calculate_feature_importance(self, features: Dict) -> Dict[str, float]:
        """
        计算特征重要性
        
        使用Random Forest的feature_importances_
        """
        importance = {}
        
        # 从技术指标中提取
        if "technical" in features:
            for key, value in features["technical"].items():
                importance[f"tech_{key}"] = abs(value) / 100.0  # 归一化
        
        # 从情绪数据中提取
        if "sentiment" in features:
            for key, value in features["sentiment"].items():
                importance[f"sentiment_{key}"] = abs(value)
        
        # 归一化
        total = sum(importance.values())
        if total > 0:
            importance = {k: v/total for k, v in importance.items()}
        
        # 返回前10个最重要的特征
        sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)
        return dict(sorted_importance[:10])
```

---

## 3️⃣ Docker部署

### 3.1 Dockerfile

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app/ ./app/
COPY models/ ./models/

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动服务
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 3.2 docker-compose.yml

```yaml
version: '3.8'

services:
  ai-inference:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
      - DEBUG=false
    volumes:
      - ./models:/app/models
      - ./data:/app/data
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
  
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

volumes:
  redis_data:
  prometheus_data:
```

---

## 4️⃣ 性能优化

### 4.1 缓存策略

```python
"""
缓存管理
使用Redis缓存推理结果和市场数据
"""

import redis
import json
from typing import Optional, Any
from datetime import timedelta

class CacheManager:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url, decode_responses=True)
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        data = self.redis.get(key)
        if data:
            return json.loads(data)
        return None
    
    def set(self, key: str, value: Any, ttl: int = 30):
        """设置缓存，默认30秒过期"""
        self.redis.setex(
            key,
            timedelta(seconds=ttl),
            json.dumps(value, default=str)
        )
    
    def is_connected(self) -> bool:
        """检查Redis连接"""
        try:
            self.redis.ping()
            return True
        except:
            return False
```

### 4.2 批量推理

```python
async def batch_inference(requests: List[InferenceRequest]) -> List[InferenceResponse]:
    """
    批量推理
    提高吞吐量
    """
    tasks = [predict_trade_signal(req) for req in requests]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

---

## 5️⃣ 监控和日志

### 5.1 Prometheus指标

```python
from prometheus_client import Counter, Histogram, Gauge

# 推理计数
inference_counter = Counter(
    'ai_inference_total',
    'Total number of inferences',
    ['model_type', 'signal']
)

# 推理延迟
inference_duration = Histogram(
    'ai_inference_duration_seconds',
    'Inference duration in seconds',
    ['model_type']
)

# 活跃策略数
active_strategies = Gauge(
    'ai_active_strategies',
    'Number of active strategies'
)
```

---

*文档编写: AI助手*  
*日期: 2025-11-04*

