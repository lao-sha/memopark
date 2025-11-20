# AI模型训练完整指南 (Week 3-4)

## 概述

本指南说明如何从零开始训练AI交易模型，包括数据下载、处理和模型训练的完整流程。

---

## 前提条件

### 系统要求
- Python 3.10+
- 8GB+ RAM
- （可选）NVIDIA GPU with CUDA（用于加速训练）

### 安装依赖

```bash
cd ai-inference-service
pip install -r requirements.txt
```

---

## 完整训练流程

### 步骤1: 下载历史数据 📥

使用`collect_historical_data.py`脚本从Binance下载历史K线数据。

#### BTC数据（推荐先训练BTC）

```bash
python scripts/collect_historical_data.py \
    --symbol BTC/USDT \
    --days 365 \
    --interval 5m \
    --output data/historical/BTC-USDT_5m_2024.csv \
    --format csv
```

**参数说明**:
- `--symbol`: 交易对（BTC/USDT, ETH/USDT等）
- `--days`: 历史天数（建议365天=1年）
- `--interval`: 时间间隔（5m, 15m, 1h等）
- `--output`: 输出文件路径
- `--format`: 输出格式（csv或parquet）

#### ETH数据（可选）

```bash
python scripts/collect_historical_data.py \
    --symbol ETH/USDT \
    --days 365 \
    --interval 5m \
    --output data/historical/ETH-USDT_5m_2024.csv
```

**预计时间**: 20-30分钟（取决于网络速度和API限速）

**预计数据量**:
- 5分钟K线，1年数据 ≈ 105,120条记录
- CSV文件大小 ≈ 10-20 MB

---

### 步骤2: 准备训练数据 🔧

使用`prepare_training_data.py`脚本处理原始数据，提取特征并生成标签。

```bash
python scripts/prepare_training_data.py \
    --input data/historical/BTC-USDT_5m_2024.csv \
    --output data/processed/BTC_training_data.pkl \
    --threshold 1.0 \
    --forward-window 12 \
    --test-size 0.2 \
    --val-size 0.1
```

**参数说明**:
- `--input`: 原始数据文件
- `--output`: 输出文件路径
- `--threshold`: 标签生成阈值（1.0表示1%）
- `--forward-window`: 前瞻窗口（12个5分钟=1小时）
- `--test-size`: 测试集比例
- `--val-size`: 验证集比例

**该脚本会自动执行**:
1. ✅ 数据加载
2. ✅ 数据清洗（去重、去异常值）
3. ✅ 特征计算（13个技术指标）
4. ✅ 标签生成（BUY/HOLD/SELL）
5. ✅ 数据集划分（训练/验证/测试）
6. ✅ 特征标准化

**预计时间**: 10-15分钟

**输出文件**:
- `data/processed/BTC_training_data.pkl`: 处理好的训练数据
- `data/processed/feature_names.txt`: 特征名称列表

---

### 步骤3: 训练AI模型 🤖

使用`train_models.py`脚本训练LSTM、Transformer和Random Forest模型。

#### 训练所有模型（推荐）

```bash
python scripts/train_models.py \
    --data data/processed/BTC_training_data.pkl \
    --models all \
    --epochs 50 \
    --batch-size 64
```

#### 只训练特定模型

```bash
# 只训练Random Forest（最快）
python scripts/train_models.py \
    --data data/processed/BTC_training_data.pkl \
    --models rf

# 训练LSTM + Random Forest
python scripts/train_models.py \
    --data data/processed/BTC_training_data.pkl \
    --models lstm rf \
    --epochs 30
```

**参数说明**:
- `--data`: 训练数据文件
- `--models`: 要训练的模型（lstm, transformer, rf, all）
- `--epochs`: 训练轮数（默认50）
- `--batch-size`: 批次大小（默认64）

**预计训练时间**:
- **Random Forest**: 5-10分钟（CPU）
- **LSTM**: 30-60分钟（GPU），2-4小时（CPU）
- **Transformer**: 60-120分钟（GPU），4-8小时（CPU）

**输出模型文件**:
- `models/lstm_model.pth`: LSTM模型
- `models/transformer_model.pth`: Transformer模型
- `models/random_forest_model.pkl`: Random Forest模型

---

## 快速开始（一键脚本）

为了方便，可以创建一个一键脚本：

```bash
#!/bin/bash
# quick_train.sh - 一键训练脚本

echo "🚀 开始AI模型训练Pipeline"

# 1. 下载数据
echo "\n📥 步骤1: 下载BTC历史数据..."
python scripts/collect_historical_data.py \
    --symbol BTC/USDT \
    --days 365 \
    --interval 5m \
    --output data/historical/BTC-USDT_5m_2024.csv

# 2. 准备数据
echo "\n🔧 步骤2: 准备训练数据..."
python scripts/prepare_training_data.py \
    --input data/historical/BTC-USDT_5m_2024.csv \
    --output data/processed/BTC_training_data.pkl

# 3. 训练模型
echo "\n🤖 步骤3: 训练AI模型..."
python scripts/train_models.py \
    --data data/processed/BTC_training_data.pkl \
    --models all \
    --epochs 50

echo "\n✨ 训练完成！"
```

使用方法：
```bash
chmod +x quick_train.sh
./quick_train.sh
```

---

## 验证模型

### 启动AI推理服务

```bash
cd ai-inference-service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 测试推理接口

```bash
curl -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": 1,
    "market_data": {
      "symbol": "BTC-USD",
      "current_price": 45000.0,
      "prices_1h": [45000, 45050, 45100, 45080, 45120, 45150, 45180, 45200, 45180, 45210, 45250, 45280],
      "prices_24h": [44000, 44050, ...],
      "volumes_24h": [1000, 1100, ...],
      "bid_ask_spread": 0.01,
      "timestamp": 1699000000
    },
    "model_type": "ensemble",
    "confidence_threshold": 60
  }'
```

---

## 训练指标解读

### LSTM/Transformer指标

训练过程中会显示：
```
Epoch [10/50] Train Loss: 0.8234 | Val Loss: 0.8567 | Accuracy: 52.34%
```

- **Train Loss**: 训练损失（越低越好）
- **Val Loss**: 验证损失（越低越好，如果远高于Train Loss说明过拟合）
- **Accuracy**: 准确率（随机猜测≈33%，>50%表示有效）

**目标指标**:
- Val Loss < 0.7
- Accuracy > 55%

### Random Forest指标

```
训练集评估:
  accuracy: 0.6542
  precision: 0.6321
  recall: 0.6542
  f1_score: 0.6418

验证集评估:
  accuracy: 0.5823
  precision: 0.5654
  recall: 0.5823
  f1_score: 0.5712
```

- **Accuracy**: 整体准确率
- **Precision**: 精确率（预测为正例的准确性）
- **Recall**: 召回率（实际正例被预测出的比例）
- **F1-Score**: Precision和Recall的调和平均

**目标指标**:
- Accuracy > 0.55
- F1-Score > 0.50

---

## 常见问题

### Q1: 内存不足

**症状**: `MemoryError` 或进程被杀

**解决方案**:
1. 减少数据量（`--days 180`）
2. 减少batch_size（`--batch-size 32`）
3. 使用Parquet格式（更节省内存）

### Q2: 训练太慢

**症状**: 训练1个epoch需要很长时间

**解决方案**:
1. 减少epochs（`--epochs 20`）
2. 使用GPU加速
3. 先只训练Random Forest（最快）
4. 减少数据量

### Q3: 准确率太低

**症状**: Accuracy < 40%

**可能原因**:
1. 数据质量问题
2. 标签生成阈值不合适
3. 模型参数需要调优

**解决方案**:
1. 检查数据是否正确
2. 调整`--threshold`（试试0.5或1.5）
3. 调整`--forward-window`（试试6或24）

### Q4: 模型过拟合

**症状**: Train Loss很低，但Val Loss很高

**解决方案**:
1. 增加dropout（修改模型代码）
2. 减少模型复杂度
3. 增加训练数据
4. 使用数据增强

---

## 进阶配置

### 自定义特征

编辑`app/features/feature_engineer.py`添加新特征：

```python
def extract_features(...):
    # 添加你的自定义特征
    custom_feature = ...
    
    return FeatureSet(
        # ... 原有特征
        custom_feature=custom_feature
    )
```

### 调整模型架构

编辑模型文件修改网络结构：

```python
# app/models/lstm_model.py
class LSTMPricePredictor(nn.Module):
    def __init__(self, hidden_size=256, num_layers=3, ...):  # 增大hidden_size
        ...
```

---

## 性能优化建议

### 1. 使用GPU加速

确保安装CUDA版本的PyTorch：
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 2. 使用混合精度训练

修改训练代码使用`torch.cuda.amp`

### 3. 并行处理

使用`DataLoader`的`num_workers`参数：
```python
DataLoader(..., num_workers=4)
```

### 4. 模型缓存

训练好的模型会自动保存，下次可以直接加载使用。

---

## 下一步

模型训练完成后：

1. ✅ 启动AI推理服务
2. ✅ 集成到Substrate OCW（链下工作者）
3. ✅ 部署到生产环境
4. ✅ 监控模型表现
5. ✅ 定期重新训练（每周/每月）

参考：`docs/AI交易系统实施指南.md` 的 Week 5-6 任务清单

---

**祝训练顺利！🚀**

