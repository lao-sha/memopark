#!/bin/bash
# 链节点启动脚本（最简化版本 - 解决 WASM 实例耗尽）

cd /home/xiaodong/文档/memopark

echo "=== Memopark 链节点启动（最简化模式） ==="

# 停止旧节点
if pgrep -f memopark-node > /dev/null; then
  echo "正在停止旧节点..."
  pkill -9 memopark-node || true
  sleep 3
  echo "✓ 旧节点已停止"
fi

echo ""
echo "启动配置："
echo "  - 参数: --dev --tmp（仅使用必要参数）"
echo "  - 端口: 自动分配（通常 9944）"
echo "  - 模式: 前台运行，实时日志"
echo ""
echo "提示："
echo "  - Ctrl+C 停止节点"
echo "  - 重启后数据清空（--tmp 模式）"
echo "======================================"
echo ""

# 前台启动（仅使用 --dev --tmp，最稳定）
exec ./target/release/memopark-node --dev --tmp
