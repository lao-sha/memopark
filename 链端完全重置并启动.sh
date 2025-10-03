#!/bin/bash
# 完全重置并启动链节点（解决所有连接问题）

set -e

cd /home/xiaodong/文档/memopark

echo "=== 完全重置并启动链节点 ==="
echo ""

# 1. 强制停止所有节点进程
echo "步骤 1/5: 停止所有节点进程..."
pkill -9 memopark-node || true
sleep 3
echo "✓ 节点进程已停止"
echo ""

# 2. 清理所有临时数据和缓存
echo "步骤 2/5: 清理数据和缓存..."
rm -rf ./my-chain-state/chains/dev 2>/dev/null || true
rm -f blockchain.log.* 2>/dev/null || true
echo "✓ 数据已清理"
echo ""

# 3. 检查端口是否释放
echo "步骤 3/5: 等待端口释放..."
sleep 2
if netstat -tln 2>/dev/null | grep :9944 > /dev/null; then
  echo "⚠️  端口 9944 仍被占用，再等待 5 秒..."
  sleep 5
fi
echo "✓ 端口已释放"
echo ""

# 4. 增加系统资源限制
echo "步骤 4/5: 优化系统资源限制..."
ulimit -n 65536 2>/dev/null || true
ulimit -s unlimited 2>/dev/null || true
echo "✓ 资源限制已优化"
echo ""

# 5. 启动节点（最简化参数）
echo "步骤 5/5: 启动链节点..."
echo ""
echo "使用参数: --dev --tmp"
echo "RPC 端口: 自动分配（默认 9944）"
echo "模式: 前台运行，实时日志"
echo ""
echo "========================================"
echo "等待节点启动（约 20-30 秒）..."
echo "关键日志："
echo "  - '🔨 Initializing Genesis block' → 初始化创世区块"
echo "  - 'Running JSON-RPC server' → RPC 服务已启动 ✓"
echo "  - '🏆 Imported #1' → 开始出块"
echo ""
echo "⚠️  如果看到 'Ran out of free WASM' → Ctrl+C 停止并重新执行本脚本"
echo "========================================"
echo ""

# 启动节点（前台运行，持续显示日志）
exec ./target/release/memopark-node \
  --dev \
  --tmp \
  --rpc-external \
  --rpc-cors=all \
  --rpc-port 9944

