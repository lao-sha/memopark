#!/usr/bin/env python3
"""
AI模型训练脚本
训练LSTM、Transformer和Random Forest模型
"""

import argparse
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pickle
import torch
from torch.utils.data import TensorDataset, DataLoader
import numpy as np

from app.models.lstm_model import LSTMModelManager
from app.models.transformer_model import TransformerModelManager
from app.models.random_forest_model import RandomForestModelManager


def load_processed_data(data_path: str) -> dict:
    """
    加载处理好的数据
    
    Args:
        data_path: 数据文件路径
        
    Returns:
        数据字典
    """
    print(f"📥 加载训练数据: {data_path}")
    
    with open(data_path, 'rb') as f:
        dataset = pickle.load(f)
    
    print(f"✅ 数据已加载:")
    print(f"   训练集: {len(dataset['X_train'])} 样本")
    print(f"   验证集: {len(dataset['X_val'])} 样本")
    print(f"   测试集: {len(dataset['X_test'])} 样本")
    print(f"   特征数: {dataset['X_train'].shape[1]}")
    
    return dataset


def create_sequences(X: np.ndarray, y: np.ndarray, sequence_length: int = 12) -> tuple:
    """
    创建时序序列（用于LSTM和Transformer）
    
    Args:
        X: 特征矩阵
        y: 标签向量
        sequence_length: 序列长度
        
    Returns:
        (X_sequences, y_sequences)
    """
    X_seq = []
    y_seq = []
    
    for i in range(len(X) - sequence_length):
        X_seq.append(X[i:i+sequence_length])
        y_seq.append(y[i+sequence_length])
    
    return np.array(X_seq), np.array(y_seq)


def train_lstm(dataset: dict, epochs: int = 50, batch_size: int = 64):
    """
    训练LSTM模型
    
    Args:
        dataset: 数据集
        epochs: 训练轮数
        batch_size: 批次大小
    """
    print("\n" + "=" * 60)
    print("🤖 训练LSTM模型")
    print("=" * 60)
    
    # 创建序列
    print("\n创建时序序列...")
    X_train_seq, y_train_seq = create_sequences(dataset['X_train'], dataset['y_train'], sequence_length=12)
    X_val_seq, y_val_seq = create_sequences(dataset['X_val'], dataset['y_val'], sequence_length=12)
    
    print(f"训练序列: {X_train_seq.shape}")
    print(f"验证序列: {X_val_seq.shape}")
    
    # 转换为PyTorch张量
    train_dataset = TensorDataset(
        torch.FloatTensor(X_train_seq),
        torch.LongTensor(y_train_seq)
    )
    val_dataset = TensorDataset(
        torch.FloatTensor(X_val_seq),
        torch.LongTensor(y_val_seq)
    )
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    # 初始化模型管理器
    manager = LSTMModelManager(model_path="models/lstm_model.pth")
    manager.scaler = dataset['scaler']  # 设置scaler
    
    # 训练
    manager.train_model(
        train_loader=train_loader,
        val_loader=val_loader,
        num_epochs=epochs,
        learning_rate=0.001
    )
    
    print("\n✅ LSTM模型训练完成")


def train_transformer(dataset: dict, epochs: int = 50, batch_size: int = 32):
    """
    训练Transformer模型
    
    Args:
        dataset: 数据集
        epochs: 训练轮数
        batch_size: 批次大小
    """
    print("\n" + "=" * 60)
    print("🤖 训练Transformer模型")
    print("=" * 60)
    
    # 创建序列（Transformer使用更长的序列）
    print("\n创建时序序列...")
    X_train_seq, y_train_seq = create_sequences(dataset['X_train'], dataset['y_train'], sequence_length=24)
    X_val_seq, y_val_seq = create_sequences(dataset['X_val'], dataset['y_val'], sequence_length=24)
    
    print(f"训练序列: {X_train_seq.shape}")
    print(f"验证序列: {X_val_seq.shape}")
    
    # 转换为PyTorch张量
    train_dataset = TensorDataset(
        torch.FloatTensor(X_train_seq),
        torch.LongTensor(y_train_seq)
    )
    val_dataset = TensorDataset(
        torch.FloatTensor(X_val_seq),
        torch.LongTensor(y_val_seq)
    )
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    # 初始化模型管理器
    manager = TransformerModelManager(model_path="models/transformer_model.pth")
    manager.scaler = dataset['scaler']
    
    # 训练
    manager.train_model(
        train_loader=train_loader,
        val_loader=val_loader,
        num_epochs=epochs,
        learning_rate=0.0001
    )
    
    print("\n✅ Transformer模型训练完成")


def train_random_forest(dataset: dict):
    """
    训练Random Forest模型
    
    Args:
        dataset: 数据集
    """
    print("\n" + "=" * 60)
    print("🤖 训练Random Forest模型")
    print("=" * 60)
    
    # 初始化模型管理器
    manager = RandomForestModelManager(model_path="models/random_forest_model.pkl")
    
    # 训练
    metrics = manager.train_model(
        X_train=dataset['X_train'],
        y_train=dataset['y_train'],
        X_val=dataset['X_val'],
        y_val=dataset['y_val'],
        feature_names=dataset['feature_names']
    )
    
    print("\n✅ Random Forest模型训练完成")
    
    return metrics


def evaluate_on_test_set(dataset: dict):
    """
    在测试集上评估所有模型
    
    Args:
        dataset: 数据集
    """
    print("\n" + "=" * 60)
    print("📊 测试集评估")
    print("=" * 60)
    
    from sklearn.metrics import accuracy_score, classification_report
    
    X_test = dataset['X_test']
    y_test = dataset['y_test']
    
    # 1. Random Forest评估
    print("\n1️⃣  Random Forest:")
    rf_manager = RandomForestModelManager(model_path="models/random_forest_model.pkl")
    
    try:
        rf_preds = []
        for x in X_test:
            signal, confidence, _ = rf_manager.predict(x)
            signal_map = {"BUY": 0, "HOLD": 1, "SELL": 2}
            rf_preds.append(signal_map[signal])
        
        rf_accuracy = accuracy_score(y_test, rf_preds)
        print(f"   准确率: {rf_accuracy:.4f}")
        print("\n   分类报告:")
        print(classification_report(y_test, rf_preds, target_names=['BUY', 'HOLD', 'SELL']))
    except Exception as e:
        print(f"   ❌ 评估失败: {e}")
    
    # 2. LSTM评估（需要创建序列）
    print("\n2️⃣  LSTM:")
    lstm_manager = LSTMModelManager(model_path="models/lstm_model.pth")
    
    try:
        # 由于LSTM需要序列，这里简化评估
        print("   需要时序序列，跳过单独评估")
    except Exception as e:
        print(f"   ❌ 评估失败: {e}")
    
    # 3. Transformer评估
    print("\n3️⃣  Transformer:")
    transformer_manager = TransformerModelManager(model_path="models/transformer_model.pth")
    
    try:
        print("   需要时序序列，跳过单独评估")
    except Exception as e:
        print(f"   ❌ 评估失败: {e}")


def main():
    parser = argparse.ArgumentParser(description='训练AI交易模型')
    
    parser.add_argument(
        '--data',
        type=str,
        required=True,
        help='训练数据文件路径（.pkl）'
    )
    
    parser.add_argument(
        '--models',
        type=str,
        nargs='+',
        default=['lstm', 'transformer', 'rf'],
        choices=['lstm', 'transformer', 'rf', 'all'],
        help='要训练的模型（默认：全部）'
    )
    
    parser.add_argument(
        '--epochs',
        type=int,
        default=50,
        help='训练轮数（默认50）'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=64,
        help='批次大小（默认64）'
    )
    
    parser.add_argument(
        '--skip-evaluation',
        action='store_true',
        help='跳过测试集评估'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🚀 AI交易系统 - 模型训练")
    print("=" * 60)
    
    # 加载数据
    dataset = load_processed_data(args.data)
    
    # 确定要训练的模型
    if 'all' in args.models:
        models_to_train = ['lstm', 'transformer', 'rf']
    else:
        models_to_train = args.models
    
    print(f"\n将训练以下模型: {', '.join(models_to_train)}")
    
    # 训练模型
    if 'lstm' in models_to_train:
        train_lstm(dataset, epochs=args.epochs, batch_size=args.batch_size)
    
    if 'transformer' in models_to_train:
        train_transformer(dataset, epochs=args.epochs, batch_size=args.batch_size // 2)
    
    if 'rf' in models_to_train:
        train_random_forest(dataset)
    
    # 测试集评估
    if not args.skip_evaluation:
        evaluate_on_test_set(dataset)
    
    print("\n" + "=" * 60)
    print("✨ 模型训练完成！")
    print("=" * 60)
    print("\n下一步: 使用 uvicorn app.main:app 启动AI推理服务")


if __name__ == "__main__":
    main()

