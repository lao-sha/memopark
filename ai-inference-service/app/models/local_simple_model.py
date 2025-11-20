"""
本地轻量级交易信号模型
用于快速响应和降级备份

功能：
1. 基于规则的快速信号生成
2. 不依赖外部API
3. 低延迟（<50ms）
4. 适用于简单明确的市场场景
"""

import logging
from typing import Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


class LocalSimpleModel:
    """
    本地轻量级模型
    
    基于成熟的技术指标组合快速生成交易信号：
    - RSI超买超卖
    - MACD金叉死叉
    - 布林带突破
    - 成交量确认
    """
    
    def __init__(self):
        """初始化本地模型"""
        self.stats = {
            "total_predictions": 0,
            "signals_distribution": {
                "BUY": 0,
                "SELL": 0,
                "HOLD": 0
            }
        }
    
    def predict(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        生成交易信号
        
        Args:
            market_data: 市场数据
            features: 技术指标特征
            
        Returns:
            交易信号字典
        """
        self.stats["total_predictions"] += 1
        
        # 提取关键指标
        rsi = features.get('rsi', 50)
        macd = features.get('macd', 0)
        macd_signal = features.get('macd_signal', 0)
        bb_position = features.get('bollinger_position', 0.5)  # 0-1，价格在布林带的位置
        volume_ratio = features.get('volume_ratio', 1.0)  # 当前成交量/平均成交量
        
        # 决策逻辑
        signal, confidence, reasoning = self._make_decision(
            rsi, macd, macd_signal, bb_position, volume_ratio
        )
        
        # 计算仓位大小
        position_size = self._calculate_position_size(confidence)
        
        # 计算止损止盈
        current_price = market_data.get('price', 0)
        stop_loss, take_profit = self._calculate_risk_levels(
            signal, current_price, confidence
        )
        
        # 更新统计
        self.stats["signals_distribution"][signal] += 1
        
        result = {
            "signal": signal,
            "confidence": confidence,
            "position_size": position_size,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "reasoning": reasoning,
            "model": "local_simple"  # 标记为本地模型
        }
        
        logger.info(
            f"本地模型预测: signal={signal}, "
            f"confidence={confidence:.2f}, "
            f"reasoning={reasoning[:50]}..."
        )
        
        return result
    
    def _make_decision(
        self,
        rsi: float,
        macd: float,
        macd_signal: float,
        bb_position: float,
        volume_ratio: float
    ) -> tuple[str, float, str]:
        """
        核心决策逻辑
        
        Returns:
            (signal, confidence, reasoning)
        """
        signals = []
        reasons = []
        
        # === 规则1：RSI超买超卖 ===
        if rsi > 70:
            signals.append("SELL")
            reasons.append(f"RSI超买({rsi:.1f})")
        elif rsi < 30:
            signals.append("BUY")
            reasons.append(f"RSI超卖({rsi:.1f})")
        
        # === 规则2：MACD金叉死叉 ===
        macd_diff = macd - macd_signal
        if macd > 0 and macd > macd_signal:
            signals.append("BUY")
            reasons.append("MACD金叉")
        elif macd < 0 and macd < macd_signal:
            signals.append("SELL")
            reasons.append("MACD死叉")
        
        # === 规则3：布林带突破 ===
        if bb_position > 0.9:
            signals.append("SELL")
            reasons.append("触及布林带上轨")
        elif bb_position < 0.1:
            signals.append("BUY")
            reasons.append("触及布林带下轨")
        
        # === 规则4：成交量确认 ===
        volume_confirmed = volume_ratio > 1.5
        if volume_confirmed:
            reasons.append(f"成交量放大({volume_ratio:.1f}x)")
        
        # === 综合判断 ===
        if not signals:
            return "HOLD", 0.5, "无明确信号，持仓观望"
        
        # 统计信号方向
        buy_count = signals.count("BUY")
        sell_count = signals.count("SELL")
        
        if buy_count > sell_count:
            final_signal = "BUY"
            base_confidence = 0.6 + (buy_count - sell_count) * 0.1
        elif sell_count > buy_count:
            final_signal = "SELL"
            base_confidence = 0.6 + (sell_count - buy_count) * 0.1
        else:
            final_signal = "HOLD"
            base_confidence = 0.5
        
        # 成交量确认提升置信度
        if volume_confirmed and final_signal != "HOLD":
            base_confidence = min(0.9, base_confidence + 0.1)
        
        # 极端RSI提升置信度
        if (rsi > 80 or rsi < 20) and final_signal != "HOLD":
            base_confidence = min(0.95, base_confidence + 0.15)
        
        confidence = min(0.95, max(0.5, base_confidence))
        reasoning = "本地模型: " + ", ".join(reasons)
        
        return final_signal, confidence, reasoning
    
    def _calculate_position_size(self, confidence: float) -> float:
        """
        根据置信度计算建议仓位
        
        Args:
            confidence: 信号置信度
            
        Returns:
            建议仓位比例 (0-1)
        """
        # 置信度越高，仓位越大，但最大不超过50%
        if confidence < 0.6:
            return 0.1  # 低置信度，小仓位试探
        elif confidence < 0.7:
            return 0.2
        elif confidence < 0.8:
            return 0.3
        else:
            return 0.5  # 高置信度，最大50%仓位
    
    def _calculate_risk_levels(
        self,
        signal: str,
        current_price: float,
        confidence: float
    ) -> tuple[float, float]:
        """
        计算止损止盈位
        
        Args:
            signal: 交易信号
            current_price: 当前价格
            confidence: 置信度
            
        Returns:
            (stop_loss, take_profit)
        """
        if signal == "HOLD" or current_price == 0:
            return 0, 0
        
        # 根据置信度调整风险回报比
        if confidence >= 0.8:
            # 高置信度：风险回报比 1:3
            risk_ratio = 0.02  # 2%止损
            reward_ratio = 0.06  # 6%止盈
        elif confidence >= 0.7:
            # 中等置信度：风险回报比 1:2
            risk_ratio = 0.03  # 3%止损
            reward_ratio = 0.06  # 6%止盈
        else:
            # 低置信度：风险回报比 1:1.5
            risk_ratio = 0.03  # 3%止损
            reward_ratio = 0.045  # 4.5%止盈
        
        if signal == "BUY":
            stop_loss = current_price * (1 - risk_ratio)
            take_profit = current_price * (1 + reward_ratio)
        else:  # SELL
            stop_loss = current_price * (1 + risk_ratio)
            take_profit = current_price * (1 - reward_ratio)
        
        return round(stop_loss, 2), round(take_profit, 2)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取模型统计信息
        
        Returns:
            统计信息字典
        """
        return {
            "model": "local_simple",
            "total_predictions": self.stats["total_predictions"],
            "signals_distribution": self.stats["signals_distribution"]
        }


class ScenarioClassifier:
    """
    市场场景分类器
    
    判断当前市场场景是简单还是复杂，决定使用哪个模型：
    - 简单场景：使用本地模型（快速）
    - 复杂场景：使用DeepSeek（准确）
    """
    
    @staticmethod
    def classify(
        market_data: Dict[str, Any],
        features: Dict[str, float]
    ) -> tuple[str, str]:
        """
        分类市场场景
        
        Args:
            market_data: 市场数据
            features: 技术指标
            
        Returns:
            (complexity, reason)
            complexity: "simple" 或 "complex"
            reason: 分类原因
        """
        rsi = features.get('rsi', 50)
        volume_ratio = features.get('volume_ratio', 1.0)
        volatility = features.get('atr_percent', 1.0)  # ATR百分比，波动率指标
        
        # === 简单场景识别 ===
        
        # 场景1：极端RSI + 放量
        if (rsi > 80 or rsi < 20) and volume_ratio > 2:
            return "simple", f"极端RSI({rsi:.1f})且成交量放大({volume_ratio:.1f}x)"
        
        # 场景2：低波动震荡市但有明确信号
        if 30 < rsi < 70 and volatility < 1.0:
            if rsi > 65 or rsi < 35:
                return "simple", f"低波动震荡市({volatility:.1f}%)且RSI明确"
        
        # === 复杂场景识别 ===
        
        # 场景3：高波动市场
        if volatility > 3.0:
            return "complex", f"高波动市场({volatility:.1f}%)"
        
        # 场景4：震荡区间（RSI中性）
        if 45 < rsi < 55:
            return "complex", f"震荡区间(RSI={rsi:.1f})"
        
        # 场景5：信号冲突（需要更复杂的判断）
        macd = features.get('macd', 0)
        macd_signal = features.get('macd_signal', 0)
        
        # RSI和MACD方向不一致
        rsi_bullish = rsi < 40
        rsi_bearish = rsi > 60
        macd_bullish = macd > macd_signal and macd > 0
        macd_bearish = macd < macd_signal and macd < 0
        
        if (rsi_bullish and macd_bearish) or (rsi_bearish and macd_bullish):
            return "complex", "技术指标信号冲突"
        
        # 默认：中等复杂度，使用本地模型
        return "simple", "标准市场条件"

