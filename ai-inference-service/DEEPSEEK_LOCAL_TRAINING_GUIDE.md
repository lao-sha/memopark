# DeepSeek本地部署与微调训练指南

## 📋 概述

本指南说明如何：
1. 在本地部署DeepSeek开源模型
2. 对DeepSeek模型进行微调（Fine-tuning）以适应交易场景
3. 集成到AI推理服务中

---

## 🎯 方案选择

### 方案1：使用DeepSeek-Coder（推荐用于交易分析）

DeepSeek-Coder是DeepSeek专门为代码和逻辑推理训练的模型，适合交易信号分析。

**优势**：
- ✅ 逻辑推理能力强
- ✅ 支持代码生成（可用于策略回测）
- ✅ 开源，可本地部署
- ✅ 支持微调

**模型大小**：
- DeepSeek-Coder-1.3B: ~2.6GB（适合16GB显存）
- DeepSeek-Coder-6.7B: ~13GB（适合24GB显存）
- DeepSeek-Coder-33B: ~66GB（需要多卡）

### 方案2：使用DeepSeek-Chat（通用对话）

DeepSeek-Chat是通用对话模型，也可以用于交易分析。

**模型大小**：
- DeepSeek-Chat-1.3B: ~2.6GB
- DeepSeek-Chat-6.7B: ~13GB

---

## 📦 第一步：环境准备

### 1.1 硬件要求

**最低配置**：
- GPU: NVIDIA GPU with 16GB+ VRAM（如RTX 4090, A100）
- RAM: 32GB+
- 存储: 50GB+ 可用空间

**推荐配置**：
- GPU: NVIDIA A100 40GB或更高
- RAM: 64GB+
- 存储: 100GB+ SSD

### 1.2 软件安装

```bash
# 安装CUDA Toolkit（如果还没有）
# 检查CUDA版本
nvidia-smi

# 安装Python 3.10+
python3 --version

# 安装PyTorch（根据CUDA版本）
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# 安装vLLM（用于高效推理）
pip install vllm

# 或使用Transformers（用于微调）
pip install transformers accelerate datasets peft

# 安装DeepSeek相关依赖
pip install deepseek-ai
```

---

## 🚀 第二步：本地部署DeepSeek模型

### 2.1 下载模型

```bash
# 创建模型目录
mkdir -p ai-inference-service/models/deepseek
cd ai-inference-service/models/deepseek

# 使用HuggingFace CLI下载模型（需要先登录）
huggingface-cli login

# 下载DeepSeek-Coder-6.7B（推荐）
huggingface-cli download deepseek-ai/deepseek-coder-6.7b-instruct \
    --local-dir ./deepseek-coder-6.7b \
    --local-dir-use-symlinks False

# 或者下载DeepSeek-Chat-6.7B
huggingface-cli download deepseek-ai/deepseek-chat-6.7b \
    --local-dir ./deepseek-chat-6.7b \
    --local-dir-use-symlinks False
```

### 2.2 使用vLLM部署（推荐，高性能）

创建部署脚本 `ai-inference-service/scripts/deploy_deepseek_local.py`：

```python
"""
DeepSeek本地部署脚本
使用vLLM进行高效推理
"""
import argparse
from vllm import LLM, SamplingParams

def deploy_deepseek(
    model_path: str = "./models/deepseek/deepseek-coder-6.7b",
    tensor_parallel_size: int = 1,
    gpu_memory_utilization: float = 0.9
):
    """
    部署DeepSeek模型
    
    Args:
        model_path: 模型路径
        tensor_parallel_size: 并行GPU数量
        gpu_memory_utilization: GPU内存使用率
    """
    print(f"🚀 加载DeepSeek模型: {model_path}")
    
    # 初始化LLM
    llm = LLM(
        model=model_path,
        tensor_parallel_size=tensor_parallel_size,
        gpu_memory_utilization=gpu_memory_utilization,
        trust_remote_code=True
    )
    
    print("✅ 模型加载完成！")
    
    # 测试推理
    sampling_params = SamplingParams(
        temperature=0.7,
        top_p=0.95,
        max_tokens=512
    )
    
    prompt = """你是一个专业的加密货币量化交易AI助手。请分析以下市场数据并给出交易建议。

当前价格: $65,000
24h涨跌: +2.5%
24h成交量: $1.2B
RSI: 65.3
MACD: 正信号

请给出交易建议（BUY/SELL/HOLD）并说明理由。"""
    
    print("\n📊 测试推理...")
    outputs = llm.generate([prompt], sampling_params)
    
    for output in outputs:
        print(f"\n回答:\n{output.outputs[0].text}")
    
    return llm

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", type=str, 
                       default="./models/deepseek/deepseek-coder-6.7b")
    parser.add_argument("--tensor-parallel-size", type=int, default=1)
    parser.add_argument("--gpu-memory-utilization", type=float, default=0.9)
    
    args = parser.parse_args()
    
    deploy_deepseek(
        model_path=args.model_path,
        tensor_parallel_size=args.tensor_parallel_size,
        gpu_memory_utilization=args.gpu_memory_utilization
    )
```

运行部署：
```bash
python scripts/deploy_deepseek_local.py \
    --model-path ./models/deepseek/deepseek-coder-6.7b \
    --tensor-parallel-size 1
```

### 2.3 使用Transformers部署（简单方式）

创建 `ai-inference-service/app/clients/deepseek_local_client.py`：

```python
"""
DeepSeek本地客户端
使用Transformers库加载和推理
"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from typing import Dict, Any, Optional
import logging

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
        
        logger.info(f"🚀 加载DeepSeek模型: {model_path}")
        
        # 加载tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_path,
            trust_remote_code=True
        )
        
        # 加载模型
        from transformers import BitsAndBytesConfig
        
        if load_in_4bit:
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16
            )
        elif load_in_8bit:
            quantization_config = BitsAndBytesConfig(load_in_8bit=True)
        else:
            quantization_config = None
        
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            trust_remote_code=True,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            device_map="auto" if self.device == "cuda" else None,
            quantization_config=quantization_config
        )
        
        if self.device == "cpu":
            self.model = self.model.to(self.device)
        
        self.model.eval()
        logger.info("✅ 模型加载完成！")
    
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
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        # 解码响应
        response_text = self.tokenizer.decode(
            outputs[0][inputs['input_ids'].shape[1]:],
            skip_special_tokens=True
        )
        
        # 解析响应
        result = self._parse_response(response_text)
        
        return result
    
    def _build_analysis_prompt(
        self,
        market_data: Dict[str, Any],
        features: Dict[str, float],
        sentiment_data: Optional[Dict[str, Any]],
        on_chain_data: Optional[Dict[str, Any]]
    ) -> str:
        """构建分析提示词"""
        prompt = f"""你是一个专业的加密货币量化交易AI助手。基于以下数据，给出交易建议。

## 市场数据
- 交易对: {market_data.get('symbol', 'UNKNOWN')}
- 当前价格: ${market_data.get('current_price', 0):.2f}
- 24h涨跌: {market_data.get('change_24h', 0):.2f}%
- 24h成交量: ${market_data.get('volume_24h', 0):,.0f}
- 24h最高: ${market_data.get('high_24h', 0):.2f}
- 24h最低: ${market_data.get('low_24h', 0):.2f}

## 技术指标
"""
        
        for key, value in features.items():
            if isinstance(value, (int, float)):
                prompt += f"- {key}: {value:.2f}\n"
        
        if sentiment_data:
            prompt += f"\n## 市场情绪\n"
            prompt += f"- 恐惧贪婪指数: {sentiment_data.get('fear_greed_index', 50)}\n"
        
        if on_chain_data:
            prompt += f"\n## 链上数据\n"
            prompt += f"- 交易所流入: ${on_chain_data.get('exchange_inflow', 0):,.0f}\n"
        
        prompt += """
## 任务要求
请综合分析以上所有数据，给出交易建议。注意：
1. 考虑多个时间周期
2. 识别关键支撑位和阻力位
3. 评估市场情绪和资金流向
4. 给出清晰的风险控制建议

## 输出格式
请以JSON格式返回，包含以下字段：
{
    "signal": "BUY" 或 "SELL" 或 "HOLD",
    "confidence": 0.0到1.0的数字,
    "position_size": 0.0到1.0的数字,
    "stop_loss": 止损价格,
    "take_profit": 止盈价格,
    "reasoning": "详细的分析理由"
}

请确保返回有效的JSON格式。
"""
        return prompt
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """解析响应"""
        import json
        import re
        
        # 尝试提取JSON
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                return result
            except:
                pass
        
        # 如果提取失败，返回默认值
        return {
            "signal": "HOLD",
            "confidence": 0.5,
            "position_size": 0.0,
            "stop_loss": None,
            "take_profit": None,
            "reasoning": response_text
        }
```

---

## 🎓 第三步：微调（Fine-tuning）训练

### 3.1 准备训练数据

创建微调数据集 `ai-inference-service/scripts/prepare_deepseek_training_data.py`：

```python
"""
准备DeepSeek微调训练数据
将交易历史数据转换为对话格式
"""
import json
import pandas as pd
from typing import List, Dict
import argparse


def create_training_examples(
    historical_data_path: str,
    output_path: str,
    num_examples: int = 10000
):
    """
    创建微调训练样本
    
    格式：
    {
        "messages": [
            {
                "role": "system",
                "content": "你是一个专业的加密货币量化交易AI助手..."
            },
            {
                "role": "user",
                "content": "市场数据和技术指标..."
            },
            {
                "role": "assistant",
                "content": "{\"signal\": \"BUY\", ...}"
            }
        ]
    }
    """
    # 加载历史数据
    df = pd.read_csv(historical_data_path)
    
    examples = []
    
    for i in range(min(num_examples, len(df) - 100)):
        # 获取当前数据点
        current = df.iloc[i]
        
        # 构建用户输入（市场数据和技术指标）
        user_prompt = f"""请分析以下市场数据并给出交易建议。

当前价格: ${current['close']:.2f}
24h涨跌: {((current['close'] / df.iloc[max(0, i-288)]['close'] - 1) * 100):.2f}%
24h成交量: ${current.get('volume', 0):,.0f}
RSI: {current.get('rsi', 50):.2f}
MACD: {current.get('macd', 0):.2f}
"""
        
        # 构建助手回复（基于未来价格变动）
        future_price = df.iloc[min(i + 12, len(df) - 1)]['close']
        price_change = (future_price / current['close'] - 1) * 100
        
        if price_change > 1.0:
            signal = "BUY"
            confidence = min(0.9, 0.5 + abs(price_change) / 10)
        elif price_change < -1.0:
            signal = "SELL"
            confidence = min(0.9, 0.5 + abs(price_change) / 10)
        else:
            signal = "HOLD"
            confidence = 0.5
        
        assistant_response = json.dumps({
            "signal": signal,
            "confidence": confidence,
            "position_size": min(0.3, abs(price_change) / 5),
            "stop_loss": current['close'] * 0.98 if signal == "BUY" else None,
            "take_profit": current['close'] * 1.02 if signal == "BUY" else None,
            "reasoning": f"基于技术分析，预测价格将{'上涨' if price_change > 0 else '下跌'} {abs(price_change):.2f}%"
        })
        
        examples.append({
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个专业的加密货币量化交易AI助手，擅长技术分析和风险控制。"
                },
                {
                    "role": "user",
                    "content": user_prompt
                },
                {
                    "role": "assistant",
                    "content": assistant_response
                }
            ]
        })
    
    # 保存为JSONL格式
    with open(output_path, 'w', encoding='utf-8') as f:
        for example in examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')
    
    print(f"✅ 已创建 {len(examples)} 个训练样本，保存到: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--historical-data", type=str, required=True,
                       help="历史数据CSV文件路径")
    parser.add_argument("--output", type=str, required=True,
                       help="输出JSONL文件路径")
    parser.add_argument("--num-examples", type=int, default=10000,
                       help="训练样本数量")
    
    args = parser.parse_args()
    
    create_training_examples(
        args.historical_data,
        args.output,
        args.num_examples
    )
```

### 3.2 使用LoRA微调（推荐）

LoRA（Low-Rank Adaptation）是一种参数高效的微调方法，只需要训练少量参数。

创建 `ai-inference-service/scripts/finetune_deepseek_lora.py`：

```python
"""
DeepSeek LoRA微调脚本
使用PEFT库进行参数高效微调
"""
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import load_dataset
import argparse


def setup_model_and_tokenizer(model_path: str):
    """设置模型和tokenizer"""
    print(f"🚀 加载模型: {model_path}")
    
    tokenizer = AutoTokenizer.from_pretrained(
        model_path,
        trust_remote_code=True
    )
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        trust_remote_code=True,
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    return model, tokenizer


def setup_lora(model):
    """设置LoRA配置"""
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,  # LoRA rank
        lora_alpha=32,  # LoRA alpha
        lora_dropout=0.1,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"]  # 注意力层
    )
    
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    return model


def prepare_dataset(jsonl_path: str, tokenizer):
    """准备数据集"""
    dataset = load_dataset("json", data_files=jsonl_path, split="train")
    
    def tokenize_function(examples):
        # 将对话格式转换为模型输入格式
        text = tokenizer.apply_chat_template(
            examples["messages"],
            tokenize=False,
            add_generation_prompt=False
        )
        return tokenizer(text, truncation=True, max_length=2048)
    
    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=False,
        remove_columns=dataset.column_names
    )
    
    return tokenized_dataset


def train(
    model_path: str,
    train_data_path: str,
    output_dir: str,
    num_epochs: int = 3,
    batch_size: int = 4,
    learning_rate: float = 2e-4
):
    """训练函数"""
    # 设置模型和tokenizer
    model, tokenizer = setup_model_and_tokenizer(model_path)
    
    # 设置LoRA
    model = setup_lora(model)
    
    # 准备数据集
    dataset = prepare_dataset(train_data_path, tokenizer)
    
    # 训练参数
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=num_epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=4,
        learning_rate=learning_rate,
        fp16=True,
        logging_steps=10,
        save_steps=100,
        save_total_limit=3,
        warmup_steps=100,
        report_to="tensorboard"
    )
    
    # 数据整理器
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # 训练器
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        data_collator=data_collator
    )
    
    # 开始训练
    print("🚀 开始训练...")
    trainer.train()
    
    # 保存模型
    trainer.save_model()
    print(f"✅ 模型已保存到: {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", type=str, required=True,
                       help="基础模型路径")
    parser.add_argument("--train-data", type=str, required=True,
                       help="训练数据JSONL文件路径")
    parser.add_argument("--output-dir", type=str, required=True,
                       help="输出目录")
    parser.add_argument("--epochs", type=int, default=3,
                       help="训练轮数")
    parser.add_argument("--batch-size", type=int, default=4,
                       help="批次大小")
    parser.add_argument("--learning-rate", type=float, default=2e-4,
                       help="学习率")
    
    args = parser.parse_args()
    
    train(
        model_path=args.model_path,
        train_data_path=args.train_data,
        output_dir=args.output_dir,
        num_epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate
    )
```

### 3.3 执行微调训练

```bash
# 1. 准备训练数据
python scripts/prepare_deepseek_training_data.py \
    --historical-data data/processed/BTC_training_data.pkl \
    --output data/deepseek_training.jsonl \
    --num-examples 10000

# 2. 执行LoRA微调
python scripts/finetune_deepseek_lora.py \
    --model-path ./models/deepseek/deepseek-coder-6.7b \
    --train-data data/deepseek_training.jsonl \
    --output-dir ./models/deepseek/deepseek-coder-6.7b-finetuned \
    --epochs 3 \
    --batch-size 4 \
    --learning-rate 2e-4
```

**训练时间估算**：
- DeepSeek-Coder-6.7B + LoRA: 6-12小时（单卡A100）
- DeepSeek-Coder-1.3B + LoRA: 2-4小时（单卡RTX 4090）

---

## 🔧 第四步：集成到AI推理服务

### 4.1 修改DeepSeek客户端支持本地模型

更新 `ai-inference-service/app/clients/deepseek_client.py`，添加本地模型支持：

```python
# 在DeepSeekClient类中添加
def __init__(
    self,
    api_key: Optional[str] = None,  # 可选，如果使用本地模型
    local_model_path: Optional[str] = None,  # 本地模型路径
    use_local: bool = False,  # 是否使用本地模型
    ...
):
    if use_local and local_model_path:
        # 使用本地模型
        from .deepseek_local_client import DeepSeekLocalClient
        self.local_client = DeepSeekLocalClient(local_model_path)
        self.use_local = True
    else:
        # 使用API
        self.client = AsyncOpenAI(...)
        self.use_local = False
```

### 4.2 更新环境配置

在 `.env` 文件中添加：

```bash
# DeepSeek配置
DEEPSEEK_USE_LOCAL=true
DEEPSEEK_LOCAL_MODEL_PATH=./models/deepseek/deepseek-coder-6.7b-finetuned
DEEPSEEK_API_KEY=your_api_key_here  # 备用
```

### 4.3 更新混合推理服务

修改 `hybrid_inference_service.py`，支持本地DeepSeek：

```python
# 在初始化时检查是否使用本地模型
if os.getenv("DEEPSEEK_USE_LOCAL", "false").lower() == "true":
    from ..clients.deepseek_local_client import DeepSeekLocalClient
    self.deepseek = DeepSeekLocalClient(
        model_path=os.getenv("DEEPSEEK_LOCAL_MODEL_PATH")
    )
else:
    self.deepseek = DeepSeekClient(api_key=deepseek_api_key)
```

---

## 📊 性能对比

| 方案 | 延迟 | 成本 | 准确度 | 隐私 |
|------|------|------|--------|------|
| **DeepSeek API** | 100-500ms | 按调用付费 | 高 | 数据上传云端 |
| **本地DeepSeek（原始）** | 50-200ms | 硬件成本 | 高 | 完全本地 |
| **本地DeepSeek（微调）** | 50-200ms | 硬件成本 | 更高 | 完全本地 |

---

## 🎯 推荐方案

### 开发/测试环境
- 使用DeepSeek API（快速开始）

### 生产环境（数据敏感）
- 使用本地DeepSeek + LoRA微调
- 优势：数据隐私 + 针对交易场景优化

### 混合方案
- 简单场景：本地模型
- 复杂场景：本地DeepSeek（微调后）
- 降级：DeepSeek API

---

## 🚀 快速开始

```bash
# 1. 下载模型
cd ai-inference-service
huggingface-cli download deepseek-ai/deepseek-coder-6.7b-instruct \
    --local-dir ./models/deepseek/deepseek-coder-6.7b

# 2. 准备训练数据
python scripts/prepare_deepseek_training_data.py \
    --historical-data data/historical/BTC-USDT_5m_2024.csv \
    --output data/deepseek_training.jsonl

# 3. 微调训练（可选）
python scripts/finetune_deepseek_lora.py \
    --model-path ./models/deepseek/deepseek-coder-6.7b \
    --train-data data/deepseek_training.jsonl \
    --output-dir ./models/deepseek/deepseek-coder-6.7b-finetuned

# 4. 配置环境变量
echo "DEEPSEEK_USE_LOCAL=true" >> .env
echo "DEEPSEEK_LOCAL_MODEL_PATH=./models/deepseek/deepseek-coder-6.7b-finetuned" >> .env

# 5. 启动服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 📚 参考资料

- [DeepSeek GitHub](https://github.com/deepseek-ai)
- [DeepSeek模型HuggingFace](https://huggingface.co/deepseek-ai)
- [vLLM文档](https://docs.vllm.ai/)
- [PEFT文档](https://huggingface.co/docs/peft/)

---

**祝训练顺利！🚀**

