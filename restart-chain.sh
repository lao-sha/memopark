#!/bin/bash
echo "🔄 重新编译和重启链..."
echo ""

# 1. 停止正在运行的链
echo "1️⃣  停止现有链进程..."
pkill -f node-template
sleep 2

# 2. 重新编译 runtime
echo "2️⃣  重新编译 runtime..."
cargo build --release --package stardust-runtime

# 3. 清理链状态
echo "3️⃣  清理链状态..."
./target/release/node-template purge-chain --dev -y

# 4. 启动链
echo "4️⃣  启动开发链..."
./target/release/node-template --dev &

echo ""
echo "✅ 链已重启！等待几秒让链初始化..."
sleep 5

echo "🔍 验证 Alice 余额..."
cd scripts
node check-balance.js

