#!/bin/bash

echo "🚀 运行所有集成测试"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# 检查节点是否运行
echo -e "${YELLOW}检查节点连接...${NC}"
if ! curl -s http://127.0.0.1:9944 > /dev/null 2>&1; then
    echo -e "${RED}❌ 节点未运行！${NC}"
    echo "请先启动节点:"
    echo "  cd /home/xiaodong/文档/memopark"
    echo "  ./target/release/memopark-node --dev --tmp"
    exit 1
fi
echo -e "${GREEN}✅ 节点已连接${NC}"

# 测试1
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}运行测试1: OTC订单创建${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if node 01-otc-create-order.js; then
    ((PASSED++))
    echo -e "${GREEN}✅ 测试1通过${NC}"
else
    ((FAILED++))
    echo -e "${RED}❌ 测试1失败${NC}"
fi

# 测试2
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}运行测试2: IPFS Pin请求${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if node 02-ipfs-pin-request.js; then
    ((PASSED++))
    echo -e "${GREEN}✅ 测试2通过${NC}"
else
    ((FAILED++))
    echo -e "${RED}❌ 测试2失败${NC}"
fi

# 测试3
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}运行测试3: 供奉品创建${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if node 03-offerings-create.js; then
    ((PASSED++))
    echo -e "${GREEN}✅ 测试3通过${NC}"
else
    ((FAILED++))
    echo -e "${RED}❌ 测试3失败${NC}"
fi

# 总结
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}测试总结${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo -e "${YELLOW}========================================${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有测试失败${NC}"
    exit 1
fi

