"""
特征工程模块
从原始市场数据提取AI特征
"""

from typing import List, Dict
import numpy as np
from dataclasses import dataclass


@dataclass
class FeatureSet:
    """特征集合"""
    # 价格特征
    price_change_1h: float
    price_change_24h: float
    price_volatility: float
    
    # 技术指标
    rsi: float
    macd: float
    macd_signal: float
    macd_histogram: float
    
    # 动量指标
    momentum_1h: float
    momentum_24h: float
    
    # 成交量特征
    volume_change_1h: float
    volume_ma_ratio: float
    
    # 市场微观结构
    bid_ask_spread: float
    
    # 可选：资金费率（永续合约）
    funding_rate: float = 0.0


class FeatureEngineer:
    """
    特征工程器
    负责从原始市场数据中提取AI模型所需的特征
    """
    
    def __init__(self):
        """初始化特征工程器"""
        pass
    
    def extract_features(
        self,
        current_price: float,
        prices_1h: List[float],
        prices_24h: List[float],
        volumes_24h: List[float],
        bid_ask_spread: float,
        funding_rate: float = 0.0
    ) -> FeatureSet:
        """
        提取所有特征
        
        Args:
            current_price: 当前价格
            prices_1h: 过去1小时的价格序列（5分钟间隔，12个点）
            prices_24h: 过去24小时的价格序列（5分钟间隔，288个点）
            volumes_24h: 过去24小时的成交量序列
            bid_ask_spread: 买卖价差
            funding_rate: 资金费率（可选）
            
        Returns:
            FeatureSet: 提取的特征集合
        """
        # 价格变化率
        price_change_1h = self._calculate_price_change(prices_1h)
        price_change_24h = self._calculate_price_change(prices_24h)
        
        # 价格波动率
        price_volatility = self._calculate_volatility(prices_24h)
        
        # RSI
        rsi = self._calculate_rsi(prices_24h, period=14)
        
        # MACD
        macd, macd_signal, macd_histogram = self._calculate_macd(prices_24h)
        
        # 动量
        momentum_1h = self._calculate_momentum(prices_1h, period=min(6, len(prices_1h)))
        momentum_24h = self._calculate_momentum(prices_24h, period=20)
        
        # 成交量特征
        volume_change_1h = self._calculate_volume_change(volumes_24h, lookback_1h=12)
        volume_ma_ratio = self._calculate_volume_ma_ratio(volumes_24h, period=20)
        
        return FeatureSet(
            price_change_1h=price_change_1h,
            price_change_24h=price_change_24h,
            price_volatility=price_volatility,
            rsi=rsi,
            macd=macd,
            macd_signal=macd_signal,
            macd_histogram=macd_histogram,
            momentum_1h=momentum_1h,
            momentum_24h=momentum_24h,
            volume_change_1h=volume_change_1h,
            volume_ma_ratio=volume_ma_ratio,
            bid_ask_spread=bid_ask_spread,
            funding_rate=funding_rate
        )
    
    def _calculate_price_change(self, prices: List[float]) -> float:
        """计算价格变化率"""
        if len(prices) < 2:
            return 0.0
        return (prices[-1] - prices[0]) / prices[0] * 100
    
    def _calculate_volatility(self, prices: List[float], window: int = 20) -> float:
        """计算波动率（标准差）"""
        if len(prices) < window:
            window = len(prices)
        
        recent_prices = prices[-window:]
        returns = [(recent_prices[i] - recent_prices[i-1]) / recent_prices[i-1] 
                   for i in range(1, len(recent_prices))]
        
        if not returns:
            return 0.0
        
        return float(np.std(returns) * 100)
    
    def _calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """
        计算RSI指标
        
        RSI = 100 - (100 / (1 + RS))
        RS = 平均涨幅 / 平均跌幅
        """
        if len(prices) < period + 1:
            return 50.0  # 默认中性值
        
        # 计算价格变化
        deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        
        # 分离涨跌
        gains = [d if d > 0 else 0 for d in deltas]
        losses = [-d if d < 0 else 0 for d in deltas]
        
        # 计算平均涨跌
        avg_gain = sum(gains[-period:]) / period
        avg_loss = sum(losses[-period:]) / period
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return float(rsi)
    
    def _calculate_ema(self, prices: List[float], period: int) -> float:
        """计算指数移动平均（EMA）"""
        if len(prices) < period:
            return float(np.mean(prices))
        
        multiplier = 2 / (period + 1)
        ema = prices[0]
        
        for price in prices[1:]:
            ema = (price - ema) * multiplier + ema
        
        return float(ema)
    
    def _calculate_macd(
        self,
        prices: List[float],
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9
    ) -> tuple:
        """
        计算MACD指标
        
        Returns:
            (macd, signal, histogram)
        """
        if len(prices) < slow_period:
            return 0.0, 0.0, 0.0
        
        # 计算快速和慢速EMA
        ema_fast = self._calculate_ema(prices, fast_period)
        ema_slow = self._calculate_ema(prices, slow_period)
        
        # MACD线
        macd = ema_fast - ema_slow
        
        # 信号线（MACD的EMA）
        # 简化实现：使用最近的MACD值
        signal = macd * 0.9  # 简化
        
        # 柱状图
        histogram = macd - signal
        
        return float(macd), float(signal), float(histogram)
    
    def _calculate_momentum(self, prices: List[float], period: int) -> float:
        """计算动量指标"""
        if len(prices) < period + 1:
            return 0.0
        
        return (prices[-1] - prices[-period]) / prices[-period] * 100
    
    def _calculate_volume_change(self, volumes: List[float], lookback_1h: int = 12) -> float:
        """计算1小时成交量变化率"""
        if len(volumes) < lookback_1h * 2:
            return 0.0
        
        recent_vol = sum(volumes[-lookback_1h:])
        previous_vol = sum(volumes[-lookback_1h*2:-lookback_1h])
        
        if previous_vol == 0:
            return 0.0
        
        return (recent_vol - previous_vol) / previous_vol * 100
    
    def _calculate_volume_ma_ratio(self, volumes: List[float], period: int = 20) -> float:
        """计算当前成交量与移动平均的比率"""
        if len(volumes) < period:
            period = len(volumes)
        
        if period == 0:
            return 1.0
        
        ma = sum(volumes[-period:]) / period
        current = volumes[-1]
        
        if ma == 0:
            return 1.0
        
        return current / ma
    
    def to_array(self, features: FeatureSet) -> np.ndarray:
        """
        将特征集合转换为numpy数组（用于模型输入）
        
        Args:
            features: 特征集合
            
        Returns:
            numpy数组
        """
        return np.array([
            features.price_change_1h,
            features.price_change_24h,
            features.price_volatility,
            features.rsi,
            features.macd,
            features.macd_signal,
            features.macd_histogram,
            features.momentum_1h,
            features.momentum_24h,
            features.volume_change_1h,
            features.volume_ma_ratio,
            features.bid_ask_spread,
            features.funding_rate
        ])
    
    def get_feature_names(self) -> List[str]:
        """获取特征名称列表"""
        return [
            "price_change_1h",
            "price_change_24h",
            "price_volatility",
            "rsi",
            "macd",
            "macd_signal",
            "macd_histogram",
            "momentum_1h",
            "momentum_24h",
            "volume_change_1h",
            "volume_ma_ratio",
            "bid_ask_spread",
            "funding_rate"
        ]

