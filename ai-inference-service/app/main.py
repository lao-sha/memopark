"""
AI推理服务主入口
提供RESTful API供Substrate OCW调用

v2.0: 混合架构 - DeepSeek API + 本地模型
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uvicorn
from datetime import datetime
import os
import logging

# 导入自定义模块
from app.features.feature_engineer import FeatureEngineer
from app.risk.risk_manager import RiskManager
from app.services.hybrid_inference_service import HybridInferenceService

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 初始化FastAPI
app = FastAPI(
    title="AI Trading Inference Service",
    description="AI驱动的交易信号推理服务 (混合架构: DeepSeek + 本地模型)",
    version="2.0.0"
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
feature_engineer = FeatureEngineer()
risk_manager = RiskManager(
    base_position_size=1000.0,
    max_position_size=10000.0,
    stop_loss_pct=2.0,
    take_profit_pct=5.0
)

# 混合推理服务（延迟初始化）
hybrid_service: Optional[HybridInferenceService] = None

# === 数据模型 ===

class MarketData(BaseModel):
    """市场数据"""
    symbol: str = Field(..., example="BTC-USD")
    current_price: float = Field(..., gt=0)
    prices_1h: List[float] = Field(..., min_length=12)  # 过去1小时，5分钟间隔
    prices_24h: List[float] = Field(..., min_length=288) # 过去24小时，5分钟间隔
    volumes_24h: List[float]
    bid_ask_spread: float
    funding_rate: Optional[float] = None
    timestamp: int


class InferenceRequest(BaseModel):
    """推理请求"""
    strategy_id: int
    market_data: MarketData
    model_type: str = Field(default="lstm", pattern="^(gpt4|claude|transformer|lstm|ensemble)$")
    confidence_threshold: int = Field(default=60, ge=0, le=100)


class InferenceResponse(BaseModel):
    """推理响应"""
    signal: str = Field(..., pattern="^(BUY|SELL|HOLD|CLOSE)$")
    confidence: int = Field(..., ge=0, le=100)
    position_size: float = Field(..., gt=0)
    entry_price: float = Field(..., gt=0)
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    reasoning: str
    feature_importance: Dict[str, float]
    risk_score: int = Field(..., ge=0, le=100)
    market_condition: str
    models_used: List[str]
    inference_time_ms: int
    timestamp: int


# === 生命周期事件 ===

@app.on_event("startup")
async def startup_event():
    """
    应用启动时初始化混合推理服务
    """
    global hybrid_service
    
    # 从环境变量获取配置
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    if not deepseek_api_key:
        logger.warning("⚠️ 未设置DEEPSEEK_API_KEY，将只使用本地模型")
        # 可以选择不初始化混合服务，或使用空key（会一直使用本地模型）
        deepseek_api_key = "dummy-key"
    
    try:
        hybrid_service = HybridInferenceService(
            deepseek_api_key=deepseek_api_key,
            redis_url=redis_url,
            cache_ttl=60,
            enable_anonymization=True,
            fallback_to_local=True
        )
        
        await hybrid_service.initialize()
        logger.info("✅ 混合推理服务初始化成功")
        
    except Exception as e:
        logger.error(f"❌ 混合推理服务初始化失败: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """
    应用关闭时清理资源
    """
    global hybrid_service
    
    if hybrid_service:
        await hybrid_service.close()
        logger.info("✅ 混合推理服务已关闭")


# === API端点 ===

@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "AI Trading Inference Service",
        "version": "2.0.0",
        "architecture": "hybrid (DeepSeek + Local)",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    if hybrid_service:
        health = await hybrid_service.health_check()
        return {
            **health,
            "timestamp": int(datetime.now().timestamp())
        }
    
    return {
        "status": "initializing",
        "timestamp": int(datetime.now().timestamp())
    }


@app.get("/stats")
async def get_statistics():
    """
    获取服务统计信息
    """
    if not hybrid_service:
        raise HTTPException(status_code=503, detail="服务未初始化")
    
    return {
        "stats": hybrid_service.get_stats(),
        "timestamp": int(datetime.now().timestamp())
    }


@app.post("/api/v1/inference", response_model=InferenceResponse)
async def predict_trade_signal(request: InferenceRequest):
    """
    生成交易信号（v2.0混合架构）
    
    核心推理接口，Substrate OCW将调用此端点
    使用混合架构：DeepSeek API + 本地模型
    """
    if not hybrid_service:
        raise HTTPException(status_code=503, detail="混合推理服务未初始化")
    
    try:
        start_time = datetime.now()
        
        # 1. 提取特征
        features = feature_engineer.extract_features(
            current_price=request.market_data.current_price,
            prices_1h=request.market_data.prices_1h,
            prices_24h=request.market_data.prices_24h,
            volumes_24h=request.market_data.volumes_24h,
            bid_ask_spread=request.market_data.bid_ask_spread,
            funding_rate=request.market_data.funding_rate or 0.0
        )
        
        # 2. 准备市场数据
        market_data = {
            "symbol": request.market_data.symbol,
            "price": request.market_data.current_price,
            "change_24h": features.momentum_24h,  # 使用momentum作为24h变化
            "volume_24h": sum(request.market_data.volumes_24h),
            "high_24h": max(request.market_data.prices_24h),
            "low_24h": min(request.market_data.prices_24h),
        }
        
        # 3. 准备技术指标字典
        features_dict = {
            "rsi": features.rsi,
            "macd": features.macd,
            "macd_signal": features.macd_signal,
            "macd_hist": features.macd_histogram,
            "bollinger_position": 0.5,  # 简化，实际需要计算
            "volume_ratio": features.volume_ma_ratio,  # 修复：使用正确的属性名
            "atr_percent": features.price_volatility,
        }
        
        # 4. 调用混合推理服务
        # 可以通过force_model参数强制使用特定模型
        force_model = None
        if request.model_type == "local":
            force_model = "local"
        elif request.model_type in ["gpt4", "claude", "ensemble"]:
            force_model = "complex"  # 使用DeepSeek
        
        ai_signal = await hybrid_service.get_trading_signal(
            market_data=market_data,
            features=features_dict,
            sentiment_data=None,  # TODO: 后续可集成情绪数据
            on_chain_data=None,   # TODO: 后续可集成链上数据
            force_model=force_model
        )
        
        # 5. 风险评估（使用AI信号的置信度）
        signal = ai_signal["signal"]
        confidence = int(ai_signal["confidence"] * 100)  # 转换为百分比
        
        risk_assessment = risk_manager.assess_risk(
            signal=signal,
            confidence=confidence,
            current_price=request.market_data.current_price,
            volatility=features.price_volatility,
            rsi=features.rsi,
            bid_ask_spread=request.market_data.bid_ask_spread
        )
        
        # 6. 判断市场状态
        if features.rsi < 30:
            market_condition = "Oversold"
        elif features.rsi > 70:
            market_condition = "Overbought"
        elif features.price_volatility > 3.0:
            market_condition = "Volatile"
        else:
            market_condition = "Sideways"
        
        # 7. 计算执行时间
        end_time = datetime.now()
        inference_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        # 8. 确定使用的模型
        model_used = ai_signal.get("model", "unknown")
        models_used = [
            "feature_engineer",
            "risk_manager",
            model_used,
            ai_signal.get("metadata", {}).get("complexity", "unknown")
        ]
        
        # 9. 构建响应
        response = InferenceResponse(
            signal=signal,
            confidence=confidence,
            position_size=risk_assessment.position_size,
            entry_price=request.market_data.current_price,
            stop_loss=ai_signal.get("stop_loss") or risk_assessment.stop_loss,
            take_profit=ai_signal.get("take_profit") or risk_assessment.take_profit,
            reasoning=ai_signal.get("reasoning", "AI分析"),
            feature_importance={
                "rsi": 0.35,
                "price_volatility": 0.25,
                "macd": 0.20,
                "momentum_24h": 0.20
            },
            risk_score=risk_assessment.risk_score,
            market_condition=market_condition,
            models_used=models_used,
            inference_time_ms=inference_time_ms,
            timestamp=int(datetime.now().timestamp())
        )
        
        logger.info(
            f"推理完成: {signal} (置信度{confidence}%), "
            f"模型={model_used}, 耗时={inference_time_ms}ms"
        )
        
        return response
        
    except Exception as e:
        logger.error(f"推理失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"推理失败: {str(e)}")


# === 启动服务 ===

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

