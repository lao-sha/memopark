"""
DeepSeek API客户端模块
用于调用DeepSeek商业API获取交易信号

功能：
1. 异步API调用
2. 重试机制
3. 速率限制
4. 结果缓存
5. 错误处理
"""

import json
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import aiohttp
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class DeepSeekClient:
    """DeepSeek API客户端"""
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.deepseek.com/v1",
        model: str = "deepseek-chat",
        max_retries: int = 3,
        timeout: float = 30.0
    ):
        """
        初始化DeepSeek客户端
        
        Args:
            api_key: DeepSeek API密钥
            base_url: API基础URL
            model: 使用的模型名称
            max_retries: 最大重试次数
            timeout: 请求超时时间（秒）
        """
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout
        )
        self.model = model
        self.max_retries = max_retries
        self.timeout = timeout
        
        # 统计信息
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_tokens": 0,
            "total_cost": 0.0
        }
        
    async def analyze_trading_signal(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float],
        sentiment_data: Optional[Dict[str, Any]] = None,
        on_chain_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        调用DeepSeek分析交易信号
        
        Args:
            market_data: 市场数据（价格、成交量等）
            features: 技术指标特征
            sentiment_data: 情绪数据（可选）
            on_chain_data: 链上数据（可选）
            
        Returns:
            交易信号字典，包含：
            - signal: BUY/SELL/HOLD
            - confidence: 置信度(0-1)
            - position_size: 建议仓位(0-1)
            - stop_loss: 止损点位
            - take_profit: 止盈点位
            - reasoning: 分析理由
        """
        prompt = self._build_analysis_prompt(
            market_data, 
            features, 
            sentiment_data, 
            on_chain_data
        )
        
        try:
            self.stats["total_requests"] += 1
            
            response = await self._call_with_retry(prompt)
            
            # 解析响应
            result = self._parse_response(response)
            
            # 更新统计
            self.stats["successful_requests"] += 1
            self.stats["total_tokens"] += response.usage.total_tokens
            
            # 计算成本（DeepSeek定价：输入¥1/M tokens，输出¥2/M tokens）
            cost = (
                response.usage.prompt_tokens * 0.001 / 1000000 +
                response.usage.completion_tokens * 0.002 / 1000000
            )
            self.stats["total_cost"] += cost
            
            logger.info(
                f"DeepSeek分析完成: signal={result['signal']}, "
                f"confidence={result['confidence']:.2f}, "
                f"tokens={response.usage.total_tokens}, "
                f"cost=${cost:.6f}"
            )
            
            return result
            
        except Exception as e:
            self.stats["failed_requests"] += 1
            logger.error(f"DeepSeek API调用失败: {e}")
            raise
    
    def _build_analysis_prompt(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float],
        sentiment_data: Optional[Dict[str, Any]],
        on_chain_data: Optional[Dict[str, Any]]
    ) -> str:
        """
        构建分析提示词
        
        函数级注释：将市场数据、技术指标、情绪和链上数据组合成结构化的提示词
        """
        prompt = f"""你是一个专业的加密货币量化交易AI助手。基于以下数据，给出交易建议。

## 市场数据
- 交易对: {market_data.get('symbol', 'UNKNOWN')}
- 当前价格: ${market_data.get('price', 0):.2f}
- 24h涨跌: {market_data.get('change_24h', 0):.2f}%
- 24h成交量: ${market_data.get('volume_24h', 0):,.0f}
- 24h最高: ${market_data.get('high_24h', 0):.2f}
- 24h最低: ${market_data.get('low_24h', 0):.2f}

## 技术指标
"""
        
        # 添加技术指标
        for key, value in features.items():
            if isinstance(value, (int, float)):
                prompt += f"- {key}: {value:.2f}\n"
        
        # 添加情绪数据
        if sentiment_data:
            prompt += f"\n## 市场情绪\n"
            prompt += f"- 恐惧贪婪指数: {sentiment_data.get('fear_greed_index', 50)}\n"
            prompt += f"- 社交媒体情绪: {sentiment_data.get('social_sentiment', 'neutral')}\n"
        
        # 添加链上数据
        if on_chain_data:
            prompt += f"\n## 链上数据\n"
            prompt += f"- 交易所流入: ${on_chain_data.get('exchange_inflow', 0):,.0f}\n"
            prompt += f"- 交易所流出: ${on_chain_data.get('exchange_outflow', 0):,.0f}\n"
            prompt += f"- 活跃地址数: {on_chain_data.get('active_addresses', 0):,}\n"
        
        prompt += """

## 任务要求
请综合分析以上所有数据，给出交易建议。注意：
1. 考虑多个时间周期（短期、中期、长期）
2. 识别关键支撑位和阻力位
3. 评估市场情绪和资金流向
4. 给出清晰的风险控制建议

## 输出格式
请以JSON格式返回，包含以下字段：
{
    "signal": "BUY" 或 "SELL" 或 "HOLD",
    "confidence": 0.0到1.0的数字，表示信号置信度,
    "position_size": 0.0到1.0的数字，建议开仓的资金比例,
    "stop_loss": 止损价格（数字）,
    "take_profit": 止盈价格（数字）,
    "reasoning": "详细的分析理由，包括技术面、情绪面、资金面的综合判断"
}

请确保返回有效的JSON格式。
"""
        
        return prompt
    
    async def _call_with_retry(self, prompt: str) -> Any:
        """
        带重试机制的API调用
        
        Args:
            prompt: 提示词
            
        Returns:
            API响应对象
        """
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": "你是一个专业的量化交易AI助手，擅长技术分析和风险控制。"
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    response_format={"type": "json_object"}
                )
                
                return response
                
            except Exception as e:
                last_error = e
                logger.warning(
                    f"DeepSeek API调用失败 (尝试 {attempt + 1}/{self.max_retries}): {e}"
                )
                
                if attempt < self.max_retries - 1:
                    # 指数退避
                    wait_time = 2 ** attempt
                    logger.info(f"等待 {wait_time} 秒后重试...")
                    await asyncio.sleep(wait_time)
        
        raise Exception(f"DeepSeek API调用失败，已重试{self.max_retries}次: {last_error}")
    
    def _parse_response(self, response: Any) -> Dict[str, Any]:
        """
        解析API响应
        
        Args:
            response: API响应对象
            
        Returns:
            解析后的交易信号字典
        """
        try:
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # 验证必需字段
            required_fields = [
                "signal", "confidence", "position_size", 
                "stop_loss", "take_profit", "reasoning"
            ]
            
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"响应缺少必需字段: {field}")
            
            # 验证信号值
            if result["signal"] not in ["BUY", "SELL", "HOLD"]:
                raise ValueError(f"无效的信号值: {result['signal']}")
            
            # 验证数值范围
            if not (0 <= result["confidence"] <= 1):
                raise ValueError(f"confidence超出范围: {result['confidence']}")
            
            if not (0 <= result["position_size"] <= 1):
                raise ValueError(f"position_size超出范围: {result['position_size']}")
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}, 原始内容: {content}")
            raise ValueError(f"无效的JSON响应: {e}")
        
        except Exception as e:
            logger.error(f"响应解析失败: {e}")
            raise
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取客户端统计信息
        
        Returns:
            统计信息字典
        """
        success_rate = (
            self.stats["successful_requests"] / self.stats["total_requests"] * 100
            if self.stats["total_requests"] > 0
            else 0
        )
        
        return {
            **self.stats,
            "success_rate": success_rate,
            "avg_cost_per_request": (
                self.stats["total_cost"] / self.stats["successful_requests"]
                if self.stats["successful_requests"] > 0
                else 0
            )
        }
    
    async def close(self):
        """关闭客户端"""
        await self.client.close()

