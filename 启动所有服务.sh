#!/bin/bash
# Memopark 完整服务启动脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 启动 Memopark 所有服务..."
echo "项目目录: $PROJECT_ROOT"
echo ""

# 检查是否已编译
if [ ! -f "target/release/node-template" ]; then
  echo "❌ 未找到编译后的节点程序"
  echo "请先运行: cargo build --release"
  exit 1
fi

# 1. 启动链节点
echo "1️⃣ 启动链节点..."
if pgrep -f "node-template --dev" > /dev/null; then
  echo "⚠️  链节点已在运行"
else
  ./target/release/node-template \
    --dev \
    --tmp \
    --rpc-port 9944 \
    --rpc-cors all \
    --rpc-methods Unsafe \
    > node.log 2>&1 &
  
  echo "✅ 链节点已启动（PID: $!）"
  echo "   日志: $PROJECT_ROOT/node.log"
  
  # 等待节点启动
  echo "   等待节点就绪..."
  sleep 5
fi

# 2. 启动首购中继服务
echo ""
echo "2️⃣ 启动首购中继服务..."
cd first-purchase-service

if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install > /dev/null 2>&1
fi

if pgrep -f "relay-worker.js" > /dev/null; then
  echo "⚠️  中继服务已在运行"
else
  node scripts/relay-worker.js > ../relay.log 2>&1 &
  echo "✅ 中继服务已启动（PID: $!）"
  echo "   日志: $PROJECT_ROOT/relay.log"
fi

cd ..

# 3. 启动前端（可选）
echo ""
echo "3️⃣ 启动前端开发服务器..."
cd memopark-dapp

if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install > /dev/null 2>&1
fi

if lsof -i:5173 > /dev/null 2>&1; then
  echo "⚠️  前端服务已在运行"
else
  npm run dev > ../frontend.log 2>&1 &
  echo "✅ 前端服务已启动"
  echo "   访问: http://127.0.0.1:5173"
  echo "   首购页面: http://127.0.0.1:5173/#/otc/claim"
  echo "   日志: $PROJECT_ROOT/frontend.log"
fi

cd ..

# 总结
echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📋 服务列表:"
echo "   1. 链节点:     http://127.0.0.1:9944"
echo "   2. 中继服务:   运行中"
echo "   3. 前端:       http://127.0.0.1:5173"
echo ""
echo "📝 日志文件:"
echo "   - node.log     (链节点)"
echo "   - relay.log    (中继服务)"
echo "   - frontend.log (前端)"
echo ""
echo "⏸️  停止所有服务: ./停止所有服务.sh"
echo ""

