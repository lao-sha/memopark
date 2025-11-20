#!/bin/bash
#
# OCW与AI服务集成测试脚本
# 测试完整的端到端流程
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  OCW-AI服务集成测试${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 项目根目录
PROJECT_ROOT="/home/xiaodong/文档/stardust"
cd "$PROJECT_ROOT"

# ========================================
# Step 1: 检查AI服务
# ========================================
echo -e "${YELLOW}[1/6] 检查AI推理服务...${NC}"

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ AI服务运行正常${NC}"
    
    # 显示服务信息
    VERSION=$(curl -s http://localhost:8000/ | jq -r '.version')
    ARCH=$(curl -s http://localhost:8000/ | jq -r '.architecture')
    echo -e "   版本: ${VERSION}"
    echo -e "   架构: ${ARCH}"
else
    echo -e "${RED}❌ AI服务未运行${NC}"
    echo -e "${YELLOW}   请先启动AI服务:${NC}"
    echo -e "   cd ai-inference-service && ./start.sh dev"
    exit 1
fi

echo ""

# ========================================
# Step 2: 测试AI服务推理接口
# ========================================
echo -e "${YELLOW}[2/6] 测试AI推理接口...${NC}"

# 生成测试请求
cat > /tmp/test_inference_request.json <<EOF
{
  "strategy_id": 1,
  "market_data": {
    "symbol": "BTC-USD",
    "current_price": 65000.0,
    "prices_1h": [64800, 64850, 64900, 64950, 65000, 65050, 65100, 65150, 65200, 65150, 65100, 65000],
    "prices_24h": $(python3 -c "print('[' + ','.join([str(65000 + i*10) for i in range(288)]) + ']')"),
    "volumes_24h": $(python3 -c "print('[' + ','.join(['1000000' for i in range(288)]) + ']')"),
    "bid_ask_spread": 5.0,
    "funding_rate": 0.0001,
    "timestamp": $(date +%s)
  },
  "model_type": "ensemble",
  "confidence_threshold": 60
}
EOF

# 调用推理接口
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/inference \
  -H "Content-Type: application/json" \
  -d @/tmp/test_inference_request.json)

# 检查响应
if echo "$RESPONSE" | jq -e '.signal' > /dev/null 2>&1; then
    SIGNAL=$(echo "$RESPONSE" | jq -r '.signal')
    CONFIDENCE=$(echo "$RESPONSE" | jq -r '.confidence')
    POSITION_SIZE=$(echo "$RESPONSE" | jq -r '.position_size')
    MODEL=$(echo "$RESPONSE" | jq -r '.models_used[-2]')
    
    echo -e "${GREEN}✅ AI推理成功${NC}"
    echo -e "   信号: ${SIGNAL}"
    echo -e "   置信度: ${CONFIDENCE}%"
    echo -e "   建议仓位: ${POSITION_SIZE}"
    echo -e "   使用模型: ${MODEL}"
else
    echo -e "${RED}❌ AI推理失败${NC}"
    echo -e "   响应: $RESPONSE"
    exit 1
fi

echo ""

# ========================================
# Step 3: 检查Substrate节点
# ========================================
echo -e "${YELLOW}[3/6] 检查Substrate节点...${NC}"

if curl -s -H "Content-Type: application/json" \
  -d '{"id":1,"jsonrpc":"2.0","method":"system_health","params":[]}' \
  http://localhost:9933 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Substrate节点运行正常${NC}"
    
    # 获取节点信息
    CHAIN=$(curl -s -H "Content-Type: application/json" \
      -d '{"id":1,"jsonrpc":"2.0","method":"system_chain","params":[]}' \
      http://localhost:9933 | jq -r '.result')
    
    BLOCK=$(curl -s -H "Content-Type: application/json" \
      -d '{"id":1,"jsonrpc":"2.0","method":"chain_getHeader","params":[]}' \
      http://localhost:9933 | jq -r '.result.number')
    
    echo -e "   链: ${CHAIN}"
    echo -e "   当前区块: ${BLOCK}"
else
    echo -e "${RED}❌ Substrate节点未运行${NC}"
    echo -e "${YELLOW}   请先启动节点:${NC}"
    echo -e "   ./target/release/node-template --dev --tmp"
    exit 1
fi

echo ""

# ========================================
# Step 4: 检查OCW密钥
# ========================================
echo -e "${YELLOW}[4/6] 检查OCW密钥...${NC}"

# 尝试插入Alice的密钥（开发模式）
INSERT_RESULT=$(curl -s -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"author_insertKey",
    "params": [
      "aist",
      "//Alice",
      "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"
    ]
  }' \
  http://localhost:9933 | jq -r '.result')

if [ "$INSERT_RESULT" = "null" ]; then
    echo -e "${GREEN}✅ OCW密钥已配置${NC}"
else
    echo -e "${YELLOW}⚠️  OCW密钥插入: ${INSERT_RESULT}${NC}"
fi

echo ""

# ========================================
# Step 5: 创建测试策略
# ========================================
echo -e "${YELLOW}[5/6] 创建测试策略...${NC}"

echo -e "${BLUE}   说明：需要手动在前端或polkadot.js创建策略${NC}"
echo -e "   1. 打开 polkadot.js Apps: https://polkadot.js.org/apps/"
echo -e "   2. 连接到 ws://localhost:9944"
echo -e "   3. 导航到 Developer -> Extrinsics"
echo -e "   4. 选择 aiStrategy -> createStrategy"
echo -e "   5. 填入参数："
echo -e "      - name: \"BTC趋势跟踪\""
echo -e "      - symbol: \"BTC-USD\""
echo -e "      - modelType: Ensemble"
echo -e "      - enabled: true"
echo -e ""
read -p "   策略已创建？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  跳过策略测试${NC}"
    echo ""
else
    echo -e "${GREEN}✅ 策略已创建${NC}"
    echo ""
fi

# ========================================
# Step 6: 等待OCW执行
# ========================================
echo -e "${YELLOW}[6/6] 等待OCW执行...${NC}"

echo -e "${BLUE}   OCW会在区块高度为10的倍数时执行${NC}"
echo -e "   当前区块: ${BLOCK}"

# 计算下次执行时间
NEXT_BLOCK=$((($BLOCK / 10 + 1) * 10))
BLOCKS_TO_WAIT=$(($NEXT_BLOCK - $BLOCK))

echo -e "   下次执行: 区块 #${NEXT_BLOCK} (还需等待 ${BLOCKS_TO_WAIT} 个区块)"
echo ""

echo -e "${BLUE}   监控OCW日志：${NC}"
echo -e "   tail -f /tmp/alice/chains/dev/offchain_worker.log | grep \"🤖\\|📊\\|🌐\\|✅\\|❌\""
echo ""

echo -e "${BLUE}   预期日志：${NC}"
echo -e "   🤖 OCW执行于区块 #${NEXT_BLOCK}"
echo -e "   📊 处理策略 #1"
echo -e "   📈 获取市场数据: BTC-USD"
echo -e "   🌐 调用AI服务: BTC-USD (策略#1)"
echo -e "   ✅ AI信号: \"BUY\""
echo -e "   ✅ 信号已提交"
echo ""

# ========================================
# 测试完成
# ========================================
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  测试准备完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

echo -e "${BLUE}下一步：${NC}"
echo -e "1. 监控节点日志查看OCW执行"
echo -e "2. 查看AI服务统计: curl http://localhost:8000/stats"
echo -e "3. 查询链上AI信号: Developer -> Chain State -> aiStrategy -> aiSignals"
echo ""

echo -e "${YELLOW}故障排除：${NC}"
echo -e "- AI服务日志: tail -f ai-inference-service/logs/app.log"
echo -e "- 节点日志: tail -f /tmp/alice/chains/dev/node.log"
echo -e "- OCW日志: tail -f /tmp/alice/chains/dev/offchain_worker.log"
echo ""

# 清理临时文件
rm -f /tmp/test_inference_request.json

echo -e "${GREEN}✅ 测试脚本执行完成${NC}"

