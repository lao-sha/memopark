#!/bin/bash
# AI 推理服务测试脚本

echo "=========================================="
echo "  AI 推理服务测试"
echo "=========================================="
echo ""

# 1. 健康检查
echo "1️⃣  健康检查..."
curl -s http://localhost:8000/health | python3 -m json.tool
echo ""
echo ""

# 2. 测试交易信号推理
echo "2️⃣  测试交易信号推理 (BTC-USD)..."
curl -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": 1,
    "market_data": {
      "symbol": "BTC-USD",
      "current_price": 45000.0,
      "prices_1h": [45000, 45100, 45050, 45200, 45150],
      "prices_24h": [44000, 44100, 44300, 44500, 44800, 45000],
      "volumes_24h": [1000, 1100, 1050, 1200, 1150, 1300],
      "bid_ask_spread": 0.01,
      "timestamp": 1699000000
    },
    "model_type": "lstm",
    "confidence_threshold": 60
  }' | python3 -m json.tool

echo ""
echo ""
echo "✅ 测试完成！"
echo ""
echo "📖 更多信息请访问: http://localhost:8000/docs"

