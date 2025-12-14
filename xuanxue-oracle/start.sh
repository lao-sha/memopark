#!/bin/bash

# Oracle节点启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Xuanxue Oracle Node Starter${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查.env文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found, creating from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env file with your configuration before running!${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
fi

# 加载环境变量（忽略注释和空行）
while IFS= read -r line; do
  # 跳过注释行和空行
  [[ $line =~ ^[[:space:]]*# ]] && continue
  [[ -z $line ]] && continue
  # 删除行内注释
  line=$(echo "$line" | sed 's/\s*#.*$//')
  # 跳过处理后的空行
  [[ -z $line ]] && continue
  # 导出变量
  export "$line"
done < .env

# 检查必要的环境变量
if [ -z "$DEEPSEEK_API_KEY" ] || [ "$DEEPSEEK_API_KEY" == "your_deepseek_api_key_here" ]; then
    echo -e "${RED}❌ DEEPSEEK_API_KEY not configured in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration loaded${NC}"

# 检查是否已编译
if [ ! -f "../target/release/xuanxue-oracle" ]; then
    echo -e "${YELLOW}📦 Building project (this may take a while)...${NC}"
    cargo build --release
    echo -e "${GREEN}✅ Build complete${NC}"
fi

# 创建数据目录
mkdir -p data/cache
echo -e "${GREEN}✅ Data directory ready${NC}"

# 启动节点
echo ""
echo -e "${GREEN}🚀 Starting Oracle Node...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# 使用release版本运行
../target/release/xuanxue-oracle
