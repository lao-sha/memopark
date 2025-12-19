#!/bin/bash

# API Gateway 快速测试脚本

BASE_URL="http://localhost:8080"

echo "🧪 测试星尘链 API Gateway"
echo "================================"

# 1. 健康检查
echo -e "\n1️⃣  健康检查"
curl -s $BASE_URL/health | jq '.'

# 2. 版本信息
echo -e "\n2️⃣  版本信息"
curl -s $BASE_URL/version | jq '.'

# 3. 最新区块
echo -e "\n3️⃣  查询最新区块"
curl -s $BASE_URL/api/v1/chain/block/latest | jq '.'

# 4. Runtime 版本
echo -e "\n4️⃣  Runtime 版本"
curl -s $BASE_URL/api/v1/chain/runtime/version | jq '.'

# 5. 测试需要认证的接口（应该返回 401）
echo -e "\n5️⃣  测试认证中间件（预期 401）"
curl -s $BASE_URL/api/v1/divination/xiaoliuren \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"year":2024,"month":12,"day":15,"hour":14,"question":"测试"}' | jq '.'

echo -e "\n✅ 测试完成！"
