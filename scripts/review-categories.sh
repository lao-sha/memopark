#!/bin/bash

# 逝者分类审核脚本 - 快速启动器
# 使用方法: ./scripts/review-categories.sh [days]

echo "🚀 逝者分类交互式审核系统"
echo "========================================"
echo ""

# 检查节点是否运行
if ! nc -z 127.0.0.1 9944 2>/dev/null; then
    echo "❌ 错误: Substrate节点未运行"
    echo "   请先启动节点: ./target/release/solochain-template-node --dev"
    exit 1
fi

# 检查依赖
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js未安装"
    exit 1
fi

# 获取天数参数（默认10天）
DAYS=${1:-10}

echo "✅ 节点已运行"
echo "📅 审核范围: 最近 $DAYS 天"
echo ""
echo "按 Ctrl+C 可随时退出"
echo "========================================"
echo ""

# 运行审核脚本
node "$(dirname "$0")/review-recent-deceased-categories.js" "$DAYS"
