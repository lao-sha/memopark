"""
DeepSeek本地客户端
使用Transformers库加载和推理本地DeepSeek模型
"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from typing import Dict, Any, Optional
import logging
import json
import re

logger = logging.getLogger(__name__)


class DeepSeekLocalClient:
    """DeepSeek本地部署客户端"""
    
    def __init__(
        self,
        model_path: str = "./models/deepseek/deepseek-coder-6.7b",
        device: str = "cuda",
        load_in_8bit: bool = False,
        load_in_4bit: bool = False
    ):
        """
        初始化本地DeepSeek客户端
        
        Args:
            model_path: 模型路径
            device: 设备（cuda/cpu）
            load_in_8bit: 是否使用8位量化（节省显存）
            load_in_4bit: 是否使用4位量化（更节省显存）
        """
        self.model_path = model_path
        self.device = device if torch.cuda.is_available() else "cpu"
        
        logger.info(f"🚀 加载DeepSeek本地模型: {model_path}")
        
        # 加载tokenizer
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                trust_remote_code=True
            )
        except Exception as e:
            logger.error(f"❌ Tokenizer加载失败: {e}")
            raise
        
        # 设置pad_token
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # 加载模型
        try:
            if load_in_4bit or load_in_8bit:
                from transformers import BitsAndBytesConfig
                
                if load_in_4bit:
                    quantization_config = BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_compute_dtype=torch.float16
                    )
                else:
                    quantization_config = BitsAndBytesConfig(load_in_8bit=True)
                
                self.model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    trust_remote_code=True,
                    quantization_config=quantization_config,
                    device_map="auto" if self.device == "cuda" else None
                )
            else:
                self.model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    trust_remote_code=True,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                    device_map="auto" if self.device == "cuda" else None
                )
            
            if self.device == "cpu":
                self.model = self.model.to(self.device)
            
            self.model.eval()
            logger.info("✅ DeepSeek本地模型加载完成！")
            
        except Exception as e:
            logger.error(f"❌ 模型加载失败: {e}")
            raise
        
        # 统计信息
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
        }
    
    def analyze_trading_signal(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float],
        sentiment_data: Optional[Dict[str, Any]] = None,
        on_chain_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        分析交易信号
        
        Args:
            market_data: 市场数据
            features: 技术指标
            sentiment_data: 情绪数据
            on_chain_data: 链上数据
            
        Returns:
            交易信号字典
        """
        self.stats["total_requests"] += 1
        
        try:
            # 构建提示词
            prompt = self._build_analysis_prompt(
                market_data, features, sentiment_data, on_chain_data
            )
            
            # 编码输入
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=2048
            ).to(self.device)
            
            # 生成响应
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=512,
                    temperature=0.7,
                    top_p=0.95,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                    eos_token_id=self.tokenizer.eos_token_id
                )
            
            # 解码响应
            response_text = self.tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:],
                skip_special_tokens=True
            )
            
            # 解析响应
            result = self._parse_response(response_text)
            
            self.stats["successful_requests"] += 1
            logger.info(
                f"DeepSeek本地分析完成: signal={result['signal']}, "
                f"confidence={result['confidence']:.2f}"
            )
            
            return result
            
        except Exception as e:
            self.stats["failed_requests"] += 1
            logger.error(f"DeepSeek本地推理失败: {e}")
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
- 当前价格: ${market_data.get('current_price', market_data.get('price', 0)):.2f}
- 24h涨跌: {market_data.get('change_24h', 0):.2f}%
- 24h成交量: ${market_data.get('volume_24h', market_data.get('volume', 0)):,.0f}
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
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """
        解析响应
        
        函数级注释：从模型响应中提取JSON格式的交易信号
        """
        # 尝试提取JSON
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                
                # 验证必需字段
                required_fields = [
                    "signal", "confidence", "position_size", 
                    "stop_loss", "take_profit", "reasoning"
                ]
                
                for field in required_fields:
                    if field not in result:
                        if field in ["stop_loss", "take_profit"]:
                            result[field] = None
                        else:
                            raise ValueError(f"响应缺少必需字段: {field}")
                
                # 验证信号值
                if result["signal"] not in ["BUY", "SELL", "HOLD"]:
                    logger.warning(f"无效的信号值: {result['signal']}，使用HOLD")
                    result["signal"] = "HOLD"
                
                # 验证数值范围
                if not (0 <= result["confidence"] <= 1):
                    result["confidence"] = max(0.0, min(1.0, result["confidence"]))
                
                if not (0 <= result["position_size"] <= 1):
                    result["position_size"] = max(0.0, min(1.0, result["position_size"]))
                
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"JSON解析失败: {e}")
        
        # 如果解析失败，返回默认值
        logger.warning("无法解析响应，返回默认HOLD信号")
        return {
            "signal": "HOLD",
            "confidence": 0.5,
            "position_size": 0.0,
            "stop_loss": None,
            "take_profit": None,
            "reasoning": response_text[:500] if response_text else "无法解析AI响应"
        }
    
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
            "model_path": self.model_path,
            "device": self.device
        }
    
    def close(self):
        """关闭客户端，释放资源"""
        # 清理GPU内存
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("DeepSeek本地客户端已关闭")

