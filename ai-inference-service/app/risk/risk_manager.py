"""
风险管理模块
负责风险评分、仓位计算和止损止盈设置
"""

from typing import Tuple, Optional
from dataclasses import dataclass
import numpy as np


@dataclass
class RiskAssessment:
    """风险评估结果"""
    risk_score: int  # 0-100，数值越高风险越大
    position_size: float  # 建议仓位大小（USD）
    stop_loss: Optional[float]  # 止损价格
    take_profit: Optional[float]  # 止盈价格
    risk_factors: dict  # 风险因子详情


class RiskManager:
    """
    风险管理器
    基于市场条件和AI信号评估风险并计算仓位
    """
    
    def __init__(
        self,
        base_position_size: float = 1000.0,
        max_position_size: float = 10000.0,
        stop_loss_pct: float = 2.0,  # 止损百分比
        take_profit_pct: float = 5.0  # 止盈百分比
    ):
        """
        初始化风险管理器
        
        Args:
            base_position_size: 基础仓位大小（USD）
            max_position_size: 最大仓位大小（USD）
            stop_loss_pct: 止损百分比
            take_profit_pct: 止盈百分比
        """
        self.base_position_size = base_position_size
        self.max_position_size = max_position_size
        self.stop_loss_pct = stop_loss_pct
        self.take_profit_pct = take_profit_pct
    
    def assess_risk(
        self,
        signal: str,
        confidence: int,
        current_price: float,
        volatility: float,
        rsi: float,
        bid_ask_spread: float
    ) -> RiskAssessment:
        """
        综合评估风险并给出建议
        
        Args:
            signal: 交易信号 (BUY/SELL/HOLD/CLOSE)
            confidence: AI信号置信度 (0-100)
            current_price: 当前价格
            volatility: 价格波动率
            rsi: RSI指标
            bid_ask_spread: 买卖价差
            
        Returns:
            RiskAssessment: 风险评估结果
        """
        # 计算各项风险因子
        volatility_risk = self._calculate_volatility_risk(volatility)
        confidence_risk = self._calculate_confidence_risk(confidence)
        rsi_risk = self._calculate_rsi_risk(rsi, signal)
        spread_risk = self._calculate_spread_risk(bid_ask_spread, current_price)
        
        # 综合风险分数（0-100，越高越危险）
        risk_score = int(np.mean([
            volatility_risk,
            confidence_risk,
            rsi_risk,
            spread_risk
        ]))
        
        # 根据风险调整仓位
        position_size = self._calculate_position_size(risk_score, confidence)
        
        # 计算止损止盈
        stop_loss, take_profit = self._calculate_stop_loss_take_profit(
            signal, current_price, volatility
        )
        
        # 风险因子详情
        risk_factors = {
            "volatility_risk": volatility_risk,
            "confidence_risk": confidence_risk,
            "rsi_risk": rsi_risk,
            "spread_risk": spread_risk
        }
        
        return RiskAssessment(
            risk_score=risk_score,
            position_size=position_size,
            stop_loss=stop_loss,
            take_profit=take_profit,
            risk_factors=risk_factors
        )
    
    def _calculate_volatility_risk(self, volatility: float) -> int:
        """
        计算波动率风险（0-100）
        
        波动率越高，风险越大
        """
        # 波动率阈值
        if volatility < 1.0:
            return 20  # 低波动
        elif volatility < 3.0:
            return 40  # 中等波动
        elif volatility < 5.0:
            return 60  # 高波动
        else:
            return 80  # 极高波动
    
    def _calculate_confidence_risk(self, confidence: int) -> int:
        """
        计算置信度风险（0-100）
        
        置信度越低，风险越大
        """
        return 100 - confidence
    
    def _calculate_rsi_risk(self, rsi: float, signal: str) -> int:
        """
        计算RSI风险（0-100）
        
        检查RSI是否与信号方向一致
        """
        if signal == "BUY":
            # 买入信号但RSI超买
            if rsi > 70:
                return 70  # 高风险
            elif rsi > 60:
                return 40
            else:
                return 20  # 低风险
        
        elif signal == "SELL":
            # 卖出信号但RSI超卖
            if rsi < 30:
                return 70  # 高风险
            elif rsi < 40:
                return 40
            else:
                return 20  # 低风险
        
        return 30  # HOLD/CLOSE信号
    
    def _calculate_spread_risk(self, spread: float, price: float) -> int:
        """
        计算买卖价差风险（0-100）
        
        价差越大，交易成本越高，风险越大
        """
        spread_pct = (spread / price) * 100
        
        if spread_pct < 0.05:
            return 10  # 极低价差
        elif spread_pct < 0.1:
            return 20
        elif spread_pct < 0.2:
            return 40
        else:
            return 60  # 高价差
    
    def _calculate_position_size(self, risk_score: int, confidence: int) -> float:
        """
        根据风险分数和置信度计算仓位大小
        
        风险越高、置信度越低，仓位越小
        """
        # 基础乘数：基于置信度
        confidence_multiplier = confidence / 100.0
        
        # 风险折扣：风险越高折扣越大
        risk_discount = 1.0 - (risk_score / 100.0) * 0.5
        
        # 计算仓位
        position = self.base_position_size * confidence_multiplier * risk_discount
        
        # 限制在最小和最大范围内
        position = max(100.0, min(position, self.max_position_size))
        
        return round(position, 2)
    
    def _calculate_stop_loss_take_profit(
        self,
        signal: str,
        current_price: float,
        volatility: float
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        计算止损和止盈价格
        
        Args:
            signal: 交易信号
            current_price: 当前价格
            volatility: 波动率
            
        Returns:
            (stop_loss, take_profit)
        """
        if signal == "HOLD" or signal == "CLOSE":
            return None, None
        
        # 根据波动率调整止损止盈距离
        volatility_multiplier = max(1.0, min(volatility / 2.0, 3.0))
        
        adjusted_sl_pct = self.stop_loss_pct * volatility_multiplier
        adjusted_tp_pct = self.take_profit_pct * volatility_multiplier
        
        if signal == "BUY":
            # 买入：止损在下方，止盈在上方
            stop_loss = current_price * (1 - adjusted_sl_pct / 100)
            take_profit = current_price * (1 + adjusted_tp_pct / 100)
        
        elif signal == "SELL":
            # 卖出（做空）：止损在上方，止盈在下方
            stop_loss = current_price * (1 + adjusted_sl_pct / 100)
            take_profit = current_price * (1 - adjusted_tp_pct / 100)
        
        else:
            return None, None
        
        return round(stop_loss, 2), round(take_profit, 2)
    
    def validate_trade(
        self,
        signal: str,
        position_size: float,
        current_balance: float,
        max_leverage: float = 3.0
    ) -> Tuple[bool, str]:
        """
        验证交易是否符合风控规则
        
        Args:
            signal: 交易信号
            position_size: 仓位大小
            current_balance: 当前账户余额
            max_leverage: 最大杠杆倍数
            
        Returns:
            (is_valid, reason)
        """
        # 检查仓位是否超过最大值
        if position_size > self.max_position_size:
            return False, f"仓位超过最大限制 ({self.max_position_size})"
        
        # 检查杠杆是否超限
        required_margin = position_size / max_leverage
        if required_margin > current_balance:
            return False, f"保证金不足（需要 {required_margin}，可用 {current_balance}）"
        
        # 检查信号有效性
        valid_signals = ["BUY", "SELL", "HOLD", "CLOSE"]
        if signal not in valid_signals:
            return False, f"无效信号 ({signal})"
        
        return True, "通过风控检查"

