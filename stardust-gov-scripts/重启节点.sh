#!/bin/bash

echo "🔄 重启 Memopark 节点"
echo

# 1. 查找并停止旧节点
echo "1️⃣ 停止旧节点..."
OLD_PID=$(ps aux | grep "memopark-node.*--dev" | grep -v grep | awk '{print $2}')

if [ -n "$OLD_PID" ]; then
  echo "   找到节点进程 PID: $OLD_PID"
  kill $OLD_PID
  sleep 2
  
  # 强制杀死（如果还在运行）
  if ps -p $OLD_PID > /dev/null; then
    echo "   强制停止..."
    kill -9 $OLD_PID
  fi
  
  echo "   ✅ 节点已停止"
else
  echo "   ⚠️  未找到运行中的节点"
fi

# 2. 启动新节点
echo
echo "2️⃣ 启动节点（正确配置）..."
echo

cd /home/xiaodong/文档/memopark

# 正确的启动参数：
# --ws-port 9944  ← WebSocket 端口（脚本需要）
# --rpc-port 9933 ← HTTP RPC 端口
./target/release/memopark-node \
  --dev \
  --ws-external \
  --ws-port 9944 \
  --rpc-external \
  --rpc-port 9933 \
  --rpc-cors=all \
  --base-path ./my-chain-state/ \
  > node.log 2>&1 &

NEW_PID=$!

echo "   ✅ 节点已启动"
echo "   PID: $NEW_PID"
echo "   WebSocket: ws://127.0.0.1:9944"
echo "   HTTP RPC: http://127.0.0.1:9933"
echo "   日志文件: /home/xiaodong/文档/memopark/node.log"

# 3. 等待节点就绪
echo
echo "3️⃣ 等待节点就绪..."
sleep 5

# 4. 测试连接
echo
echo "4️⃣ 测试连接..."
cd /home/xiaodong/文档/memopark/memopark-gov-scripts
node test-connection.js

echo
echo "✅ 完成！"
echo
echo "💡 下一步:"
echo "   npm run create-offerings"

