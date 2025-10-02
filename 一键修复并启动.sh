#!/bin/bash
# 一键修复并启动前端（包含所有必要的环境变量）

cd /home/xiaodong/文档/memopark/memopark-dapp

echo "=== 一键修复并启动前端 ==="
echo ""
echo "✓ 代码已修复: WsProvider 自动连接已启用"
echo "✓ 环境变量已设置:"
echo "  - VITE_WS=ws://127.0.0.1:9944"
echo "  - VITE_ALLOW_DEV_SESSION=1"
echo ""
echo "正在启动前端..."
echo "访问地址: http://127.0.0.1:5173"
echo "按 Ctrl+C 停止"
echo "======================================"
echo ""

# 使用环境变量启动
VITE_WS=ws://127.0.0.1:9944 VITE_ALLOW_DEV_SESSION=1 npm run dev

