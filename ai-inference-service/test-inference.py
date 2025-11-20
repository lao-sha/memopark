#!/usr/bin/env python3
"""
AI 推理服务测试脚本
功能：生成符合要求的市场数据并测试推理 API
"""

import requests
import json
import random
from datetime import datetime

def generate_price_series(base_price, length, volatility=0.02):
    """生成价格序列
    
    参数：
        base_price: 基础价格
        length: 数据点数量
        volatility: 波动率
    
    返回：
        价格列表
    """
    prices = [base_price]
    for _ in range(length - 1):
        change = prices[-1] * random.uniform(-volatility, volatility)
        prices.append(round(prices[-1] + change, 2))
    return prices

def generate_volume_series(base_volume, length):
    """生成交易量序列"""
    volumes = []
    for _ in range(length):
        volumes.append(round(base_volume * random.uniform(0.8, 1.2), 2))
    return volumes

def test_health_check():
    """测试健康检查接口"""
    print("=" * 60)
    print("🏥 健康检查")
    print("=" * 60)
    
    try:
        response = requests.get("http://localhost:8000/health")
        data = response.json()
        
        print(f"状态: {data['status']}")
        print("\n组件状态:")
        for component, status in data['components'].items():
            icon = "✅" if "healthy" in status.lower() else "⚠️"
            print(f"  {icon} {component}: {status}")
        
        return True
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_inference():
    """测试交易信号推理接口"""
    print("\n" + "=" * 60)
    print("🤖 交易信号推理测试")
    print("=" * 60)
    
    # 生成测试数据
    base_price = 45000.0
    prices_1h = generate_price_series(base_price, 12)  # 1小时，每5分钟
    prices_24h = generate_price_series(base_price - 1000, 288)  # 24小时，每5分钟
    volumes_24h = generate_volume_series(1000, 288)
    
    request_data = {
        "strategy_id": 1,
        "market_data": {
            "symbol": "BTC-USD",
            "current_price": base_price,
            "prices_1h": prices_1h,
            "prices_24h": prices_24h,
            "volumes_24h": volumes_24h,
            "bid_ask_spread": 0.01,
            "timestamp": int(datetime.now().timestamp())
        },
        "model_type": "lstm",
        "confidence_threshold": 60
    }
    
    print(f"\n📊 测试数据:")
    print(f"  交易对: BTC-USD")
    print(f"  当前价格: ${base_price:,.2f}")
    print(f"  1小时数据点: {len(prices_1h)}")
    print(f"  24小时数据点: {len(prices_24h)}")
    print(f"  置信度阈值: 60%")
    
    try:
        print(f"\n⏳ 发送推理请求...")
        response = requests.post(
            "http://localhost:8000/api/v1/inference",
            json=request_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n✅ 推理成功!")
            print(f"\n🎯 交易信号:")
            print(f"  信号类型: {result.get('signal', 'N/A')}")
            print(f"  置信度: {result.get('confidence', 0)}%")
            print(f"  建议仓位: ${result.get('position_size', 0):,.2f}")
            
            print(f"\n💰 价格建议:")
            print(f"  入场价: ${result.get('entry_price', 0):,.2f}")
            print(f"  止损价: ${result.get('stop_loss', 0):,.2f}")
            print(f"  止盈价: ${result.get('take_profit', 0):,.2f}")
            
            print(f"\n📈 分析:")
            print(f"  市场状况: {result.get('market_condition', 'N/A')}")
            print(f"  风险评分: {result.get('risk_score', 0)}")
            print(f"  推理耗时: {result.get('inference_time_ms', 0)}ms")
            
            if 'reasoning' in result:
                print(f"\n💡 推理依据:")
                print(f"  {result['reasoning']}")
            
            if 'feature_importance' in result and result['feature_importance']:
                print(f"\n📊 特征重要性:")
                for feature, importance in result['feature_importance'].items():
                    bar = "█" * int(importance * 20)
                    print(f"  {feature:20s} {bar} {importance:.2%}")
            
            return True
        else:
            print(f"\n❌ 请求失败 (状态码: {response.status_code})")
            print(f"错误详情: {response.text}")
            return False
            
    except requests.Timeout:
        print(f"\n⏰ 请求超时")
        return False
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return False

def main():
    """主函数"""
    print("\n" + "🚀" * 30)
    print("   AI 推理服务 - 功能测试")
    print("🚀" * 30 + "\n")
    
    # 1. 健康检查
    if not test_health_check():
        print("\n⚠️  服务未正常运行，请检查服务状态")
        return
    
    # 2. 推理测试
    test_inference()
    
    print("\n" + "=" * 60)
    print("📖 更多 API 文档: http://localhost:8000/docs")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()

