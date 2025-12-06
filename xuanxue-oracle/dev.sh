#!/bin/bash

# 开发模式启动脚本

set -e

echo "🔧 Starting Oracle Node in development mode..."

# 加载环境变量
export $(cat .env | xargs) 2>/dev/null || true

# 检查IPFS
if ! command -v ipfs &> /dev/null; then
    echo "⚠️  IPFS not found. Please install IPFS or configure Pinata in .env"
fi

# 运行开发版本
RUST_LOG=debug cargo run
