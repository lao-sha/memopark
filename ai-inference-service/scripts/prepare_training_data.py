#!/usr/bin/env python3
"""
准备训练数据脚本
包含数据清洗、特征计算、标签生成和数据集划分
"""

import argparse
import pandas as pd
import numpy as np
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))

from app.features.feature_engineer import FeatureEngineer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle


def load_historical_data(file_path: str) -> pd.DataFrame:
    """
    加载历史数据
    
    Args:
        file_path: 数据文件路径
        
    Returns:
        DataFrame
    """
    print(f"📥 加载数据: {file_path}")
    
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.parquet'):
        df = pd.read_parquet(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {file_path}")
    
    # 确保timestamp列是datetime类型
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # 按时间排序
    df = df.sort_values('timestamp')
    
    print(f"✅ 数据已加载: {len(df)} 条记录")
    print(f"   时间范围: {df['timestamp'].min()} → {df['timestamp'].max()}")
    
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    清洗数据
    """
    print("\n🧹 清洗数据...")
    
    original_count = len(df)
    
    # 1. 去除重复
    df = df.drop_duplicates(subset=['timestamp'])
    
    # 2. 去除缺失值
    df = df.dropna()
    
    # 3. 验证OHLC关系
    df = df[
        (df['low'] <= df['open']) &
        (df['low'] <= df['close']) &
        (df['high'] >= df['open']) &
        (df['high'] >= df['close']) &
        (df['volume'] >= 0)
    ]
    
    # 4. 去除异常值（基于3sigma规则）
    for col in ['open', 'high', 'low', 'close']:
        mean = df[col].mean()
        std = df[col].std()
        df = df[(df[col] >= mean - 3*std) & (df[col] <= mean + 3*std)]
    
    print(f"✅ 清洗完成: {original_count} → {len(df)} 条记录")
    
    return df


def calculate_features(df: pd.DataFrame) -> tuple:
    """
    计算特征
    
    Returns:
        (features_list, timestamps)
    """
    print("\n🔧 计算特征...")
    
    engineer = FeatureEngineer()
    features_list = []
    timestamps = []
    
    # 需要至少24小时的数据（288个5分钟K线）
    window_size = 288
    
    for i in range(window_size, len(df)):
        if i % 1000 == 0:
            print(f"   进度: {i}/{len(df)}")
        
        try:
            prices_24h = df['close'].iloc[i-window_size:i].tolist()
            prices_1h = df['close'].iloc[i-12:i].tolist()  # 12个5分钟K线 = 1小时
            volumes_24h = df['volume'].iloc[i-window_size:i].tolist()
            current_price = df['close'].iloc[i]
            
            # 计算特征
            features = engineer.extract_features(
                current_price=current_price,
                prices_1h=prices_1h,
                prices_24h=prices_24h,
                volumes_24h=volumes_24h,
                bid_ask_spread=0.01,  # 假设值
                funding_rate=0.0
            )
            
            # 转换为数组
            feature_array = engineer.to_array(features)
            features_list.append(feature_array)
            timestamps.append(df['timestamp'].iloc[i])
            
        except Exception as e:
            print(f"   ⚠️  第{i}行特征计算失败: {e}")
            continue
    
    print(f"✅ 特征计算完成: {len(features_list)} 个样本")
    
    return np.array(features_list), timestamps


def generate_labels(
    df: pd.DataFrame,
    start_idx: int = 288,
    forward_window: int = 12,
    threshold: float = 1.0
) -> np.ndarray:
    """
    生成训练标签
    
    Args:
        df: 原始数据
        start_idx: 开始索引
        forward_window: 前瞻窗口（默认12个5分钟=1小时）
        threshold: 涨跌阈值（默认1%）
        
    Returns:
        标签数组 (0: BUY, 1: HOLD, 2: SELL)
    """
    print(f"\n🏷️  生成训练标签...")
    print(f"   前瞻窗口: {forward_window} (约{forward_window*5}分钟)")
    print(f"   涨跌阈值: {threshold}%")
    
    labels = []
    
    for i in range(start_idx, len(df) - forward_window):
        if i % 1000 == 0:
            print(f"   进度: {i - start_idx}/{len(df) - start_idx - forward_window}")
        
        current_price = df['close'].iloc[i]
        future_price = df['close'].iloc[i + forward_window]
        
        change_pct = (future_price - current_price) / current_price * 100
        
        if change_pct > threshold:
            labels.append(0)  # BUY
        elif change_pct < -threshold:
            labels.append(2)  # SELL
        else:
            labels.append(1)  # HOLD
    
    labels = np.array(labels)
    
    # 统计标签分布
    buy_count = np.sum(labels == 0)
    hold_count = np.sum(labels == 1)
    sell_count = np.sum(labels == 2)
    total = len(labels)
    
    print(f"✅ 标签生成完成: {total} 个样本")
    print(f"   BUY:  {buy_count} ({buy_count/total*100:.1f}%)")
    print(f"   HOLD: {hold_count} ({hold_count/total*100:.1f}%)")
    print(f"   SELL: {sell_count} ({sell_count/total*100:.1f}%)")
    
    return labels


def split_dataset(
    features: np.ndarray,
    labels: np.ndarray,
    timestamps: list,
    test_size: float = 0.2,
    val_size: float = 0.1
) -> dict:
    """
    划分数据集
    
    Args:
        features: 特征矩阵
        labels: 标签向量
        timestamps: 时间戳列表
        test_size: 测试集比例
        val_size: 验证集比例
        
    Returns:
        包含train/val/test数据的字典
    """
    print(f"\n📊 划分数据集...")
    print(f"   测试集: {test_size*100}%")
    print(f"   验证集: {val_size*100}%")
    print(f"   训练集: {(1-test_size-val_size)*100}%")
    
    # 先划分出测试集
    X_temp, X_test, y_temp, y_test, ts_temp, ts_test = train_test_split(
        features, labels, timestamps,
        test_size=test_size,
        shuffle=False  # 时序数据不打乱
    )
    
    # 再从剩余数据中划分验证集
    val_ratio = val_size / (1 - test_size)
    X_train, X_val, y_train, y_val, ts_train, ts_val = train_test_split(
        X_temp, y_temp, ts_temp,
        test_size=val_ratio,
        shuffle=False
    )
    
    # 标准化特征
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"✅ 数据集划分完成:")
    print(f"   训练集: {len(X_train)} 样本")
    print(f"   验证集: {len(X_val)} 样本")
    print(f"   测试集: {len(X_test)} 样本")
    
    return {
        'X_train': X_train_scaled,
        'y_train': y_train,
        'ts_train': ts_train,
        'X_val': X_val_scaled,
        'y_val': y_val,
        'ts_val': ts_val,
        'X_test': X_test_scaled,
        'y_test': y_test,
        'ts_test': ts_test,
        'scaler': scaler,
        'feature_names': FeatureEngineer().get_feature_names()
    }


def save_processed_data(dataset: dict, output_path: str):
    """
    保存处理好的数据
    """
    print(f"\n💾 保存处理数据: {output_path}")
    
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'wb') as f:
        pickle.dump(dataset, f)
    
    print(f"✅ 数据已保存")
    
    # 保存feature_names单独文件（方便查看）
    feature_names_file = output_file.parent / 'feature_names.txt'
    with open(feature_names_file, 'w') as f:
        for i, name in enumerate(dataset['feature_names']):
            f.write(f"{i+1}. {name}\n")
    
    print(f"   特征名称已保存到: {feature_names_file}")


def main():
    parser = argparse.ArgumentParser(description='准备AI模型训练数据')
    
    parser.add_argument(
        '--input',
        type=str,
        required=True,
        help='输入数据文件（CSV或Parquet）'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        default='data/processed/training_data.pkl',
        help='输出文件路径（默认：data/processed/training_data.pkl）'
    )
    
    parser.add_argument(
        '--threshold',
        type=float,
        default=1.0,
        help='标签生成阈值（百分比，默认1.0）'
    )
    
    parser.add_argument(
        '--forward-window',
        type=int,
        default=12,
        help='前瞻窗口大小（5分钟K线数量，默认12=1小时）'
    )
    
    parser.add_argument(
        '--test-size',
        type=float,
        default=0.2,
        help='测试集比例（默认0.2）'
    )
    
    parser.add_argument(
        '--val-size',
        type=float,
        default=0.1,
        help='验证集比例（默认0.1）'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🚀 AI交易系统 - 数据准备Pipeline")
    print("=" * 60)
    
    # 1. 加载数据
    df = load_historical_data(args.input)
    
    # 2. 清洗数据
    df = clean_data(df)
    
    # 3. 计算特征
    features, timestamps = calculate_features(df)
    
    # 4. 生成标签
    labels = generate_labels(
        df,
        start_idx=288,
        forward_window=args.forward_window,
        threshold=args.threshold
    )
    
    # 确保特征和标签数量一致
    min_len = min(len(features), len(labels), len(timestamps))
    features = features[:min_len]
    labels = labels[:min_len]
    timestamps = timestamps[:min_len]
    
    # 5. 划分数据集
    dataset = split_dataset(
        features,
        labels,
        timestamps,
        test_size=args.test_size,
        val_size=args.val_size
    )
    
    # 6. 保存数据
    save_processed_data(dataset, args.output)
    
    print("\n" + "=" * 60)
    print("✨ 数据准备完成！")
    print("=" * 60)
    print(f"\n下一步: 使用 python scripts/train_models.py --data {args.output} 训练模型")


if __name__ == "__main__":
    main()

