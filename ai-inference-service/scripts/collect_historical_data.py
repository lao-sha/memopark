#!/usr/bin/env python3
"""
历史数据收集脚本
从交易所API收集历史K线数据
"""

import argparse
import ccxt
import pandas as pd
from datetime import datetime, timedelta
import time
from pathlib import Path


def fetch_data_from_binance(symbol: str, days: int, interval: str = '5m'):
    """
    从Binance获取历史数据
    
    Args:
        symbol: 交易对（如 BTC/USDT）
        days: 历史天数
        interval: 时间间隔（5m, 15m, 1h, 1d）
    
    Returns:
        DataFrame
    """
    print(f"从Binance获取 {symbol} 最近 {days} 天的 {interval} 数据...")
    
    exchange = ccxt.binance({
        'enableRateLimit': True,
    })
    
    # 计算起始时间
    since = exchange.parse8601(
        (datetime.now() - timedelta(days=days)).isoformat()
    )
    
    all_ohlcv = []
    
    # 分批获取数据（Binance限制每次1000条）
    while since < exchange.milliseconds():
        try:
            ohlcv = exchange.fetch_ohlcv(
                symbol,
                timeframe=interval,
                since=since,
                limit=1000
            )
            
            if not ohlcv:
                break
            
            all_ohlcv.extend(ohlcv)
            
            # 更新起始时间
            since = ohlcv[-1][0] + 1
            
            print(f"已获取 {len(all_ohlcv)} 条记录...")
            
            # 避免触发限速
            time.sleep(exchange.rateLimit / 1000)
            
        except Exception as e:
            print(f"获取数据时出错: {e}")
            break
    
    # 转换为DataFrame
    df = pd.DataFrame(
        all_ohlcv,
        columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
    )
    
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df['symbol'] = symbol.replace('/', '-')
    
    print(f"✅ 成功获取 {len(df)} 条记录")
    
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    清洗数据
    """
    print("清洗数据...")
    
    original_count = len(df)
    
    # 去除重复
    df = df.drop_duplicates(subset=['timestamp'])
    
    # 按时间排序
    df = df.sort_values('timestamp')
    
    # 去除缺失值
    df = df.dropna()
    
    # 验证OHLC关系
    df = df[
        (df['low'] <= df['open']) &
        (df['low'] <= df['close']) &
        (df['high'] >= df['open']) &
        (df['high'] >= df['close']) &
        (df['volume'] >= 0)
    ]
    
    print(f"清洗完成：{original_count} → {len(df)} 条记录")
    
    return df


def save_data(df: pd.DataFrame, output_path: str, format: str = 'csv'):
    """
    保存数据
    """
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    if format == 'csv':
        df.to_csv(output_file, index=False)
        print(f"✅ 数据已保存到: {output_file}")
    
    elif format == 'parquet':
        df.to_parquet(output_file, compression='gzip', index=False)
        print(f"✅ 数据已保存到: {output_file} (Parquet压缩)")
    
    # 打印统计信息
    print("\n数据统计:")
    print(f"  时间范围: {df['timestamp'].min()} → {df['timestamp'].max()}")
    print(f"  总条数: {len(df)}")
    print(f"  交易对: {df['symbol'].iloc[0]}")
    print(f"  价格范围: ${df['close'].min():.2f} - ${df['close'].max():.2f}")
    print(f"  平均成交量: {df['volume'].mean():.2f}")


def main():
    parser = argparse.ArgumentParser(description='收集历史市场数据')
    
    parser.add_argument(
        '--symbol',
        type=str,
        default='BTC/USDT',
        help='交易对（如 BTC/USDT, ETH/USDT）'
    )
    
    parser.add_argument(
        '--days',
        type=int,
        default=365,
        help='历史天数（默认365天）'
    )
    
    parser.add_argument(
        '--interval',
        type=str,
        default='5m',
        choices=['1m', '5m', '15m', '1h', '4h', '1d'],
        help='时间间隔（默认5分钟）'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='输出文件路径（默认：data/historical/{symbol}_{interval}_{year}.csv）'
    )
    
    parser.add_argument(
        '--format',
        type=str,
        default='csv',
        choices=['csv', 'parquet'],
        help='输出格式（默认csv）'
    )
    
    args = parser.parse_args()
    
    # 1. 获取数据
    df = fetch_data_from_binance(
        symbol=args.symbol,
        days=args.days,
        interval=args.interval
    )
    
    # 2. 清洗数据
    df = clean_data(df)
    
    # 3. 保存数据
    if args.output is None:
        symbol_clean = args.symbol.replace('/', '-')
        year = datetime.now().year
        ext = 'csv' if args.format == 'csv' else 'parquet'
        args.output = f"data/historical/{symbol_clean}_{args.interval}_{year}.{ext}"
    
    save_data(df, args.output, args.format)
    
    print("\n✨ 数据收集完成！")
    print(f"下一步: python scripts/prepare_training_data.py --input {args.output}")


if __name__ == "__main__":
    main()

