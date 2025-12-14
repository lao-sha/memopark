#!/bin/bash

# 一键重启区块链节点（包含 BaziChart pallet）

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Stardust 节点重启脚本${NC}"
echo -e "${BLUE}   (包含 BaziChart Pallet)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 停止旧节点
echo -e "${YELLOW}[1/4] 停止旧节点...${NC}"
pkill -9 stardust-node || true
sleep 2
echo -e "${GREEN}✓ 旧节点已停止${NC}"
echo ""

# 2. 检查是否需要编译
echo -e "${YELLOW}[2/4] 检查编译状态...${NC}"
NEED_BUILD=false

if [ ! -f "target/release/stardust-node" ]; then
    echo -e "${YELLOW}  节点二进制不存在，需要编译${NC}"
    NEED_BUILD=true
else
    # 检查 runtime 是否最新
    RUNTIME_MODIFIED=$(find runtime -name "*.rs" -o -name "Cargo.toml" | xargs stat -c %Y | sort -n | tail -1)
    NODE_MODIFIED=$(stat -c %Y target/release/stardust-node)

    if [ "$RUNTIME_MODIFIED" -gt "$NODE_MODIFIED" ]; then
        echo -e "${YELLOW}  Runtime 有更新，需要重新编译${NC}"
        NEED_BUILD=true
    else
        echo -e "${GREEN}  节点二进制已是最新${NC}"
    fi
fi

# 3. 编译（如果需要）
if [ "$NEED_BUILD" = true ]; then
    echo -e "${YELLOW}[3/4] 编译节点（这可能需要几分钟）...${NC}"

    # 先编译 runtime
    echo -e "${BLUE}  编译 runtime...${NC}"
    cargo build --release -p stardust-runtime

    # 再编译节点
    echo -e "${BLUE}  编译节点...${NC}"
    cargo build --release -p stardust-node

    echo -e "${GREEN}✓ 编译完成${NC}"
else
    echo -e "${YELLOW}[3/4] 跳过编译${NC}"
fi
echo ""

# 4. 询问是否清除链数据
echo -e "${YELLOW}[4/4] 是否清除旧的链数据?${NC}"
echo -e "  ${YELLOW}警告: 清除链数据会删除所有历史记录${NC}"
read -p "清除链数据? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}  清除链数据...${NC}"
    ./target/release/stardust-node purge-chain --dev -y
    echo -e "${GREEN}✓ 链数据已清除${NC}"
else
    echo -e "${BLUE}  保留现有链数据${NC}"
fi
echo ""

# 5. 启动节点
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   启动节点${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}RPC 端口: ws://127.0.0.1:9944${NC}"
echo -e "${YELLOW}按 Ctrl+C 停止节点${NC}"
echo ""

# 启动节点（带有有用的参数）
./target/release/stardust-node --dev \
    --rpc-external \
    --rpc-port 9944 \
    --rpc-cors=all \
    --tmp
