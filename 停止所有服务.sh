#!/bin/bash
# 停止所有 Stardust 服务

echo "⏸️  停止 Stardust 所有服务..."

# 1. 停止链节点
echo "1️⃣ 停止链节点..."
pkill -f "node-template --dev" && echo "✅ 链节点已停止" || echo "   （未运行）"

# 2. 停止中继服务
echo "2️⃣ 停止中继服务..."
pkill -f "relay-worker.js" && echo "✅ 中继服务已停止" || echo "   （未运行）"

# 3. 停止前端
echo "3️⃣ 停止前端服务..."
pkill -f "vite" && echo "✅ 前端服务已停止" || echo "   （未运行）"

echo ""
echo "✅ 所有服务已停止"

