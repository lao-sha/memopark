# 历史数据收集指南

## 概述

AI模型训练需要至少1年的历史市场数据。本指南说明如何收集和处理历史数据。

## 数据要求

### 时间范围
- **最少**: 1年（用于基础训练）
- **推荐**: 2-3年（用于更好的模型性能）
- **理想**: 5年+（用于全面的市场周期覆盖）

### 时间粒度
- **主要**: 5分钟K线（用于日内交易）
- **辅助**: 1小时K线（用于趋势分析）
- **可选**: 1分钟K线（用于高频策略）

### 数据字段

必须字段：
- `timestamp`: 时间戳
- `open`: 开盘价
- `high`: 最高价
- `low`: 最低价
- `close`: 收盘价
- `volume`: 成交量
- `symbol`: 交易对（如 BTC-USD）

可选字段：
- `bid`: 买一价
- `ask`: 卖一价
- `funding_rate`: 资金费率（永续合约）
- `open_interest`: 持仓量

## 数据源

### 1. Hyperliquid API

```python
import requests
import pandas as pd
from datetime import datetime, timedelta

def fetch_hyperliquid_data(symbol="BTC-USD", days=365):
    """
    从Hyperliquid获取历史数据
    """
    end_time = int(datetime.now().timestamp() * 1000)
    start_time = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
    
    url = "https://api.hyperliquid.xyz/info"
    params = {
        "type": "candleSnapshot",
        "req": {
            "coin": symbol.split("-")[0],
            "interval": "5m",
            "startTime": start_time,
            "endTime": end_time
        }
    }
    
    response = requests.post(url, json=params)
    data = response.json()
    
    # 转换为DataFrame
    df = pd.DataFrame(data)
    df['timestamp'] = pd.to_datetime(df['t'], unit='ms')
    
    return df
```

### 2. Binance API（替代方案）

```python
import ccxt

def fetch_binance_data(symbol="BTC/USDT", days=365):
    """
    从Binance获取历史数据
    """
    exchange = ccxt.binance()
    
    since = exchange.parse8601((datetime.now() - timedelta(days=days)).isoformat())
    
    ohlcv = exchange.fetch_ohlcv(
        symbol,
        timeframe='5m',
        since=since,
        limit=1000
    )
    
    df = pd.DataFrame(
        ohlcv,
        columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
    )
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    
    return df
```

### 3. CoinGecko API（免费）

```python
from pycoingecko import CoinGeckoAPI

def fetch_coingecko_data(coin_id="bitcoin", days=365):
    """
    从CoinGecko获取历史数据（较低频率）
    """
    cg = CoinGeckoAPI()
    
    data = cg.get_coin_market_chart_by_id(
        id=coin_id,
        vs_currency='usd',
        days=days
    )
    
    df = pd.DataFrame(data['prices'], columns=['timestamp', 'price'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    
    return df
```

## 数据收集脚本

参考 `scripts/collect_historical_data.py`

## 数据处理Pipeline

### 1. 数据清洗

```python
def clean_data(df):
    """清洗原始数据"""
    # 去除重复
    df = df.drop_duplicates(subset=['timestamp'])
    
    # 填充缺失值
    df = df.fillna(method='ffill')
    
    # 去除异常值（基于3sigma规则）
    for col in ['open', 'high', 'low', 'close']:
        mean = df[col].mean()
        std = df[col].std()
        df = df[(df[col] >= mean - 3*std) & (df[col] <= mean + 3*std)]
    
    return df
```

### 2. 特征计算

```python
from app.features.feature_engineer import FeatureEngineer

def add_features(df):
    """添加技术指标特征"""
    engineer = FeatureEngineer()
    
    features_list = []
    
    for i in range(288, len(df)):  # 需要至少24小时数据
        prices_24h = df['close'].iloc[i-288:i].tolist()
        prices_1h = df['close'].iloc[i-12:i].tolist()
        volumes_24h = df['volume'].iloc[i-288:i].tolist()
        
        features = engineer.extract_features(
            current_price=df['close'].iloc[i],
            prices_1h=prices_1h,
            prices_24h=prices_24h,
            volumes_24h=volumes_24h,
            bid_ask_spread=0.01,  # 假设值
            funding_rate=0.0
        )
        
        features_list.append(features)
    
    return features_list
```

### 3. 标签生成（用于监督学习）

```python
def generate_labels(df, forward_window=12):
    """
    生成训练标签
    
    标签定义：
    - BUY (1): 未来价格上涨 > 1%
    - SELL (-1): 未来价格下跌 > 1%
    - HOLD (0): 价格波动 < 1%
    """
    labels = []
    
    for i in range(len(df) - forward_window):
        current_price = df['close'].iloc[i]
        future_price = df['close'].iloc[i + forward_window]
        
        change_pct = (future_price - current_price) / current_price * 100
        
        if change_pct > 1.0:
            labels.append(1)  # BUY
        elif change_pct < -1.0:
            labels.append(-1)  # SELL
        else:
            labels.append(0)  # HOLD
    
    return labels
```

## 数据存储

### CSV格式（推荐）

```python
# 保存
df.to_csv('data/historical/BTC-USD_5m_2023.csv', index=False)

# 加载
df = pd.read_csv('data/historical/BTC-USD_5m_2023.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])
```

### Parquet格式（高效）

```python
# 保存（压缩）
df.to_parquet('data/historical/BTC-USD_5m_2023.parquet', compression='gzip')

# 加载
df = pd.read_parquet('data/historical/BTC-USD_5m_2023.parquet')
```

## 快速开始

### 步骤1：收集数据

```bash
cd ai-inference-service
python scripts/collect_historical_data.py --symbol BTC-USD --days 365 --interval 5m
```

### 步骤2：验证数据

```bash
python scripts/validate_data.py --input data/historical/BTC-USD_5m_2023.csv
```

### 步骤3：生成特征和标签

```bash
python scripts/prepare_training_data.py \
    --input data/historical/BTC-USD_5m_2023.csv \
    --output data/processed/BTC-USD_features.parquet
```

## 数据质量检查清单

- [ ] 时间范围覆盖至少1年
- [ ] 没有缺失的时间点
- [ ] 价格和成交量在合理范围内
- [ ] 没有重复数据
- [ ] 时间戳正确排序
- [ ] OHLC关系正确（low ≤ open/close ≤ high）
- [ ] 成交量 ≥ 0

## 预计数据量

- **5分钟K线，1年**: 约 105,120 条记录
- **1小时K线，3年**: 约 26,280 条记录
- **CSV文件大小**: 约 10-50 MB/年（取决于字段数）
- **Parquet文件大小**: 约 2-10 MB/年（压缩后）

## 注意事项

1. **API限制**: 大多数交易所有API调用频率限制，需要分批请求
2. **数据回填**: 某些交易所可能不提供完整历史数据
3. **数据质量**: 不同数据源的数据质量可能不同，需要交叉验证
4. **存储空间**: 多年多交易对数据可能占用较大空间

## 推荐工具

- **CCXT**: 统一的加密货币交易所API库
- **pandas**: 数据处理
- **ta-lib**: 技术指标计算（C扩展，性能优）
- **pandas-ta**: 纯Python技术指标库（易用）

## 下一步

数据收集完成后，参考 `docs/AI推理服务实现方案.md` 进行模型训练。

