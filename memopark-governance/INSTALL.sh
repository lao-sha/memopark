#!/bin/bash
# 快速安装和启动脚本

set -e

echo "🚀 Memopark 治理平台 - 快速安装"
echo "=================================="
echo ""

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  未检测到 pnpm，正在安装..."
    npm install -g pnpm
fi

echo "📦 安装依赖..."
pnpm install

echo ""
echo "✅ 安装完成！"
echo ""
echo "📝 下一步："
echo "   1. 配置环境变量（创建 .env.development）"
echo "   2. 启动开发服务器: pnpm dev"
echo "   3. 构建生产版本: pnpm build"
echo ""
echo "📚 查看完整文档: cat GETTING_STARTED.md"

