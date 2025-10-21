#!/bin/bash
# 首购中继服务启动脚本

cd "$(dirname "$0")"

echo "🚀 启动首购中继服务..."

# 检查依赖
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install
fi

# 检查配置
if [ ! -f ".env" ]; then
  echo "⚠️  未找到 .env 文件，创建默认配置..."
  cat > .env << 'EOF'
WS_ENDPOINT=ws://127.0.0.1:9944
MAKER_SEED=//Alice
POLL_INTERVAL=30000
LOG_LEVEL=info
EOF
  echo "✅ 已创建 .env 文件，请根据需要修改"
fi

# 启动服务
echo "✅ 启动中继服务..."
node scripts/relay-worker.js

