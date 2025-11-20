"""
混合AI推理服务
结合DeepSeek API和本地模型，提供高效可靠的交易信号生成

架构：
1. DeepSeek API：处理复杂市场场景
2. 本地模型：处理简单场景和降级备份
3. Redis缓存：减少重复计算
4. 自动降级：API失败时切换到本地模型
"""

import logging
import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import redis.asyncio as redis

from ..clients.deepseek_client import DeepSeekClient
from ..models.local_simple_model import LocalSimpleModel, ScenarioClassifier
from ..utils.data_anonymizer import DataAnonymizer, SensitiveDataValidator

logger = logging.getLogger(__name__)


class HybridInferenceService:
    """混合推理服务"""
    
    def __init__(
        self,
        deepseek_api_key: str,
        redis_url: str = "redis://localhost:6379",
        cache_ttl: int = 60,
        enable_anonymization: bool = True,
        fallback_to_local: bool = True
    ):
        """
        初始化混合推理服务
        
        Args:
            deepseek_api_key: DeepSeek API密钥
            redis_url: Redis连接URL
            cache_ttl: 缓存有效期（秒）
            enable_anonymization: 是否启用数据脱敏
            fallback_to_local: API失败时是否降级到本地模型
        """
        # DeepSeek客户端
        self.deepseek = DeepSeekClient(api_key=deepseek_api_key)
        
        # 本地模型
        self.local_model = LocalSimpleModel()
        
        # 数据脱敏器
        self.anonymizer = DataAnonymizer(add_noise=False) if enable_anonymization else None
        
        # Redis缓存
        self.redis_client: Optional[redis.Redis] = None
        self.redis_url = redis_url
        self.cache_ttl = cache_ttl
        
        # 配置
        self.enable_anonymization = enable_anonymization
        self.fallback_to_local = fallback_to_local
        
        # 统计信息
        self.stats = {
            "total_requests": 0,
            "cache_hits": 0,
            "deepseek_calls": 0,
            "local_calls": 0,
            "fallback_calls": 0,
            "errors": 0,
        }
        
        # 连续失败计数（用于自动降级）
        self.consecutive_failures = 0
        self.max_failures_before_fallback = 3
    
    async def initialize(self):
        """初始化异步资源"""
        try:
            self.redis_client = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            logger.info("Redis连接成功")
        except Exception as e:
            logger.warning(f"Redis连接失败，缓存功能将不可用: {e}")
            self.redis_client = None
    
    async def get_trading_signal(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float],
        sentiment_data: Optional[Dict[str, Any]] = None,
        on_chain_data: Optional[Dict[str, Any]] = None,
        force_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取交易信号（主入口）
        
        Args:
            market_data: 市场数据
            features: 技术指标特征
            sentiment_data: 情绪数据（可选）
            on_chain_data: 链上数据（可选）
            force_model: 强制使用指定模型 ("deepseek" 或 "local")
            
        Returns:
            交易信号字典
        """
        self.stats["total_requests"] += 1
        start_time = datetime.now()
        
        try:
            # Step 1: 检查缓存
            cache_key = self._generate_cache_key(market_data, features)
            cached_result = await self._get_from_cache(cache_key)
            
            if cached_result:
                self.stats["cache_hits"] += 1
                logger.info("✅ 缓存命中")
                return cached_result
            
            # Step 2: 场景分类（除非强制指定模型）
            if force_model:
                complexity = force_model
                reason = f"强制使用{force_model}模型"
            else:
                complexity, reason = ScenarioClassifier.classify(market_data, features)
            
            logger.info(f"📊 场景分类: {complexity} - {reason}")
            
            # Step 3: 根据场景选择模型
            if complexity == "simple" or force_model == "local":
                # 简单场景：使用本地模型
                result = await self._call_local_model(market_data, features)
                
            else:
                # 复杂场景：使用DeepSeek
                result = await self._call_deepseek_with_fallback(
                    market_data, features, sentiment_data, on_chain_data
                )
            
            # Step 4: 缓存结果
            await self._save_to_cache(cache_key, result)
            
            # 添加元数据
            result["metadata"] = {
                "complexity": complexity,
                "classification_reason": reason,
                "response_time_ms": (datetime.now() - start_time).total_seconds() * 1000,
                "cached": False
            }
            
            return result
            
        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"推理服务错误: {e}", exc_info=True)
            
            # 最终降级到本地模型
            if self.fallback_to_local:
                logger.warning("⚠️ 最终降级到本地模型")
                return await self._call_local_model(market_data, features)
            
            raise
    
    async def _call_deepseek_with_fallback(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float],
        sentiment_data: Optional[Dict[str, Any]],
        on_chain_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        调用DeepSeek，失败时自动降级
        
        Args:
            market_data: 市场数据
            features: 技术指标
            sentiment_data: 情绪数据
            on_chain_data: 链上数据
            
        Returns:
            交易信号
        """
        # 检查是否需要自动降级
        if self.consecutive_failures >= self.max_failures_before_fallback:
            logger.warning(
                f"⚠️ DeepSeek连续失败{self.consecutive_failures}次，"
                f"自动降级到本地模型"
            )
            self.stats["fallback_calls"] += 1
            return await self._call_local_model(market_data, features)
        
        try:
            # 数据脱敏
            if self.enable_anonymization:
                safe_market, safe_features, safe_sentiment, safe_onchain = \
                    self.anonymizer.anonymize_request(
                        market_data, features, sentiment_data, on_chain_data
                    )
                
                # 验证数据安全性
                all_data = {
                    **safe_market,
                    **safe_features,
                    **(safe_sentiment or {}),
                    **(safe_onchain or {})
                }
                
                is_safe, sensitive_fields = SensitiveDataValidator.validate(all_data)
                
                if not is_safe:
                    logger.error(f"❌ 发现敏感字段: {sensitive_fields}，拒绝发送")
                    raise ValueError(f"数据包含敏感字段: {sensitive_fields}")
            else:
                safe_market = market_data
                safe_features = features
                safe_sentiment = sentiment_data
                safe_onchain = on_chain_data
            
            # 调用DeepSeek
            logger.info("🤖 调用DeepSeek API...")
            result = await self.deepseek.analyze_trading_signal(
                market_data=safe_market,
                features=safe_features,
                sentiment_data=safe_sentiment,
                on_chain_data=safe_onchain
            )
            
            # 成功，重置失败计数
            self.consecutive_failures = 0
            self.stats["deepseek_calls"] += 1
            
            return result
            
        except Exception as e:
            logger.error(f"DeepSeek调用失败: {e}")
            self.consecutive_failures += 1
            
            # 降级到本地模型
            if self.fallback_to_local:
                logger.warning("⚠️ 降级到本地模型")
                self.stats["fallback_calls"] += 1
                return await self._call_local_model(market_data, features)
            
            raise
    
    async def _call_local_model(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        调用本地模型
        
        Args:
            market_data: 市场数据
            features: 技术指标
            
        Returns:
            交易信号
        """
        logger.info("🏠 使用本地模型...")
        self.stats["local_calls"] += 1
        
        result = self.local_model.predict(market_data, features)
        return result
    
    def _generate_cache_key(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float]
    ) -> str:
        """
        生成缓存键
        
        基于市场数据和特征的哈希值，确保相同输入返回相同结果
        
        Args:
            market_data: 市场数据
            features: 技术指标
            
        Returns:
            缓存键字符串
        """
        # 创建确定性的数据表示
        cache_data = {
            "symbol": market_data.get("symbol"),
            "price": round(market_data.get("price", 0), 2),
            "features": {k: round(v, 2) for k, v in sorted(features.items())}
        }
        
        # 生成哈希
        data_str = json.dumps(cache_data, sort_keys=True)
        hash_value = hashlib.md5(data_str.encode()).hexdigest()
        
        return f"ai_signal:{hash_value}"
    
    async def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        从缓存获取结果
        
        Args:
            cache_key: 缓存键
            
        Returns:
            缓存的结果，如果不存在则返回None
        """
        if not self.redis_client:
            return None
        
        try:
            cached = await self.redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"缓存读取失败: {e}")
        
        return None
    
    async def _save_to_cache(self, cache_key: str, result: Dict[str, Any]):
        """
        保存结果到缓存
        
        Args:
            cache_key: 缓存键
            result: 结果数据
        """
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(result)
            )
        except Exception as e:
            logger.warning(f"缓存写入失败: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取服务统计信息
        
        Returns:
            统计信息字典
        """
        total = self.stats["total_requests"]
        
        return {
            **self.stats,
            "cache_hit_rate": (
                self.stats["cache_hits"] / total * 100 if total > 0 else 0
            ),
            "deepseek_usage_rate": (
                self.stats["deepseek_calls"] / total * 100 if total > 0 else 0
            ),
            "local_usage_rate": (
                self.stats["local_calls"] / total * 100 if total > 0 else 0
            ),
            "fallback_rate": (
                self.stats["fallback_calls"] / total * 100 if total > 0 else 0
            ),
            "error_rate": (
                self.stats["errors"] / total * 100 if total > 0 else 0
            ),
            "consecutive_failures": self.consecutive_failures,
            "deepseek_stats": self.deepseek.get_stats(),
            "local_model_stats": self.local_model.get_stats()
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """
        健康检查
        
        Returns:
            健康状态字典
        """
        health = {
            "status": "healthy",
            "components": {}
        }
        
        # 检查Redis
        if self.redis_client:
            try:
                await self.redis_client.ping()
                health["components"]["redis"] = "healthy"
            except Exception as e:
                health["components"]["redis"] = f"unhealthy: {e}"
                health["status"] = "degraded"
        else:
            health["components"]["redis"] = "disabled"
        
        # 检查DeepSeek
        if self.consecutive_failures >= self.max_failures_before_fallback:
            health["components"]["deepseek"] = "degraded (using fallback)"
            health["status"] = "degraded"
        else:
            health["components"]["deepseek"] = "healthy"
        
        # 本地模型始终可用
        health["components"]["local_model"] = "healthy"
        
        return health
    
    async def close(self):
        """关闭服务，释放资源"""
        if self.redis_client:
            await self.redis_client.close()
        
        await self.deepseek.close()
        
        logger.info("混合推理服务已关闭")

