#!/bin/bash
# 链节点启动脚本 - 支持数据持久化模式

cd /home/xiaodong/文档/memopark

echo "=== Memopark 链节点启动 ==="
echo ""
echo "请选择启动模式:"
echo "  1) 临时模式 (--tmp) - 数据不保留,重启后清空"
echo "  2) 持久化模式 (--base-path) - 保留链上数据"
echo ""
read -p "请输入选择 [1/2] (默认: 1): " mode
mode=${mode:-1}

# 停止旧节点
if pgrep -f memopark-node > /dev/null; then
  echo ""
  echo "正在停止旧节点..."
  pkill -9 memopark-node || true
  sleep 3
  echo "✓ 旧节点已停止"
fi

echo ""

if [ "$mode" = "2" ]; then
  # 持久化模式
  BASE_PATH="./my-chain-state"
  echo "启动配置（持久化模式）："
  echo "  - 数据目录: $BASE_PATH"
  echo "  - RPC端口: 9944"
  echo "  - RPC访问: 允许外部访问"
  echo "  - CORS: 允许所有源"
  echo ""
  echo "提示："
  echo "  - Ctrl+C 停止节点"
  echo "  - 数据保存在 $BASE_PATH/"
  echo "  - 重启后数据保留"
  echo "======================================"
  echo ""
  
  # 创建数据目录
  mkdir -p "$BASE_PATH"
  
  # 持久化启动
  exec ./target/release/memopark-node \
    --dev \
    --rpc-external \
    --rpc-port 9944 \
    --rpc-cors=all \
    --base-path "$BASE_PATH"
else
  # 临时模式
  echo "启动配置（临时模式）："
  echo "  - 参数: --dev --tmp"
  echo "  - 端口: 自动分配（通常 9944）"
  echo "  - 模式: 前台运行，实时日志"
  echo ""
  echo "提示："
  echo "  - Ctrl+C 停止节点"
  echo "  - 重启后数据清空"
  echo "======================================"
  echo ""
  
  # 临时模式启动
  exec ./target/release/memopark-node --dev --tmp
fi
