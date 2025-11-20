"""
数据脱敏模块
确保发送给第三方API的数据不包含敏感信息

功能：
1. 移除账户相关信息
2. 移除具体交易对（可选）
3. 只保留必要的技术指标
4. 添加噪声混淆（可选）
"""

import logging
from typing import Dict, Any
import random

logger = logging.getLogger(__name__)


class DataAnonymizer:
    """数据脱敏器"""
    
    def __init__(self, add_noise: bool = False, noise_level: float = 0.01):
        """
        初始化数据脱敏器
        
        Args:
            add_noise: 是否添加噪声
            noise_level: 噪声水平（0-1），默认1%
        """
        self.add_noise = add_noise
        self.noise_level = noise_level
    
    def anonymize_request(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float],
        sentiment_data: Dict[str, Any] = None,
        on_chain_data: Dict[str, Any] = None
    ) -> tuple[Dict, Dict, Dict, Dict]:
        """
        脱敏请求数据
        
        Args:
            market_data: 市场数据
            features: 技术指标
            sentiment_data: 情绪数据
            on_chain_data: 链上数据
            
        Returns:
            (脱敏后的market_data, features, sentiment_data, on_chain_data)
        """
        # 脱敏市场数据
        safe_market = self._anonymize_market_data(market_data)
        
        # 脱敏特征数据
        safe_features = self._anonymize_features(features)
        
        # 脱敏情绪数据
        safe_sentiment = self._anonymize_sentiment(sentiment_data) if sentiment_data else None
        
        # 脱敏链上数据
        safe_onchain = self._anonymize_onchain(on_chain_data) if on_chain_data else None
        
        logger.debug("数据脱敏完成")
        
        return safe_market, safe_features, safe_sentiment, safe_onchain
    
    def _anonymize_market_data(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        脱敏市场数据
        
        移除敏感信息：
        - ❌ 具体交易对名称（可选保留）
        - ✅ 保留价格和成交量（数值相对变化）
        """
        safe_data = {
            # 保留交易对（如果需要完全匿名，可以移除或泛化为"CRYPTO/USDT"）
            "symbol": market_data.get("symbol", "CRYPTO/USDT"),
            
            # 保留价格相关数据
            "price": market_data.get("price", 0),
            "change_24h": market_data.get("change_24h", 0),
            "high_24h": market_data.get("high_24h", 0),
            "low_24h": market_data.get("low_24h", 0),
            
            # 保留成交量（相对值）
            "volume_24h": market_data.get("volume_24h", 0),
        }
        
        # 可选：添加噪声
        if self.add_noise:
            safe_data = self._add_noise_to_dict(safe_data, exclude=['symbol'])
        
        return safe_data
    
    def _anonymize_features(self, features: Dict[str, float]) -> Dict[str, float]:
        """
        脱敏技术指标特征
        
        只保留技术分析必需的指标，移除可能暴露策略的自定义特征
        """
        # 允许的标准技术指标列表
        allowed_features = {
            # 趋势指标
            'sma_20', 'sma_50', 'sma_200',
            'ema_12', 'ema_26',
            'macd', 'macd_signal', 'macd_hist',
            
            # 动量指标
            'rsi', 'rsi_6', 'rsi_14', 'rsi_24',
            'stoch_k', 'stoch_d',
            'cci',
            
            # 波动率指标
            'bollinger_upper', 'bollinger_middle', 'bollinger_lower',
            'bollinger_position',
            'atr', 'atr_percent',
            
            # 成交量指标
            'volume_sma', 'volume_ratio',
            'obv',
            'mfi',
            
            # 其他标准指标
            'adx',
            'williams_r',
        }
        
        # 过滤只保留允许的特征
        safe_features = {
            k: v for k, v in features.items()
            if k in allowed_features
        }
        
        # 可选：添加噪声
        if self.add_noise:
            safe_features = self._add_noise_to_dict(safe_features)
        
        logger.debug(
            f"特征过滤: {len(features)} -> {len(safe_features)} "
            f"(移除了{len(features) - len(safe_features)}个自定义特征)"
        )
        
        return safe_features
    
    def _anonymize_sentiment(self, sentiment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        脱敏情绪数据
        
        只保留公开的情绪指标
        """
        if not sentiment_data:
            return {}
        
        safe_sentiment = {}
        
        # 允许的情绪指标
        if 'fear_greed_index' in sentiment_data:
            safe_sentiment['fear_greed_index'] = sentiment_data['fear_greed_index']
        
        if 'social_sentiment' in sentiment_data:
            safe_sentiment['social_sentiment'] = sentiment_data['social_sentiment']
        
        return safe_sentiment
    
    def _anonymize_onchain(self, on_chain_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        脱敏链上数据
        
        只保留公开的链上指标，移除可能关联到特定账户的信息
        """
        if not on_chain_data:
            return {}
        
        safe_onchain = {}
        
        # 允许的公开链上指标
        allowed_metrics = [
            'exchange_inflow',
            'exchange_outflow',
            'active_addresses',
            'transaction_count',
            'whale_ratio',
        ]
        
        for metric in allowed_metrics:
            if metric in on_chain_data:
                safe_onchain[metric] = on_chain_data[metric]
        
        return safe_onchain
    
    def _add_noise_to_dict(
        self, 
        data: Dict[str, Any], 
        exclude: list = None
    ) -> Dict[str, Any]:
        """
        向字典中的数值添加随机噪声
        
        Args:
            data: 数据字典
            exclude: 排除的键列表
            
        Returns:
            添加噪声后的数据
        """
        exclude = exclude or []
        noisy_data = {}
        
        for key, value in data.items():
            if key in exclude:
                noisy_data[key] = value
            elif isinstance(value, (int, float)):
                # 添加 ±noise_level 的随机噪声
                noise = random.uniform(-self.noise_level, self.noise_level)
                noisy_data[key] = value * (1 + noise)
            else:
                noisy_data[key] = value
        
        return noisy_data


class SensitiveDataValidator:
    """
    敏感数据验证器
    
    检查数据中是否包含不应该发送的敏感信息
    """
    
    # 敏感字段黑名单
    SENSITIVE_FIELDS = {
        'account_id',
        'user_id',
        'wallet_address',
        'balance',
        'total_balance',
        'available_balance',
        'position_size',
        'total_position',
        'pnl',
        'profit',
        'loss',
        'api_key',
        'secret_key',
        'private_key',
    }
    
    @classmethod
    def validate(cls, data: Dict[str, Any]) -> tuple[bool, list]:
        """
        验证数据是否安全
        
        Args:
            data: 待验证的数据
            
        Returns:
            (is_safe, found_sensitive_fields)
        """
        found_sensitive = []
        
        def check_dict(d: Dict, path: str = ""):
            for key, value in d.items():
                current_path = f"{path}.{key}" if path else key
                
                # 检查键名
                if key.lower() in cls.SENSITIVE_FIELDS:
                    found_sensitive.append(current_path)
                
                # 递归检查嵌套字典
                if isinstance(value, dict):
                    check_dict(value, current_path)
        
        check_dict(data)
        
        is_safe = len(found_sensitive) == 0
        
        if not is_safe:
            logger.warning(f"发现敏感字段: {found_sensitive}")
        
        return is_safe, found_sensitive

