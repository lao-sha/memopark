#!/bin/bash
# 一键安装和启动脚本

set -e

echo "=================================================="
echo "🚀 Memopark 做市商治理平台 - 安装脚本"
echo "=================================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低（当前: $NODE_VERSION），需要 18+"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo ""
echo "✅ 依赖安装完成"
echo ""

# 启动开发服务器
echo "🚀 启动开发服务器..."
echo ""
echo "=================================================="
echo "访问地址: http://localhost:3002"
echo "=================================================="
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

npm run dev

