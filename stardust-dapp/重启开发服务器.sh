#!/bin/bash
# 重启 Stardust DApp 开发服务器
# 用途：应用新的环境变量配置

echo "========================================"
echo "  Stardust DApp 开发服务器重启脚本"
echo "========================================"
echo ""

# 检查 .env 文件
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
    echo "配置内容:"
    cat .env | grep -v "^#" | grep -v "^$"
    echo ""
else
    echo "❌ .env 文件不存在！"
    echo "请先创建 .env 文件"
    exit 1
fi

# 检查是否有进程在运行
echo "🔍 检查当前运行的开发服务器..."
PID=$(lsof -ti:5173 2>/dev/null)

if [ -n "$PID" ]; then
    echo "⚠️  发现运行中的服务器 (PID: $PID)"
    echo "正在停止..."
    kill $PID 2>/dev/null
    sleep 2
    
    # 确认是否已停止
    if lsof -ti:5173 >/dev/null 2>&1; then
        echo "❌ 服务器未能正常停止，尝试强制终止..."
        kill -9 $PID 2>/dev/null
        sleep 1
    fi
    echo "✅ 旧服务器已停止"
else
    echo "ℹ️  没有检测到运行中的服务器"
fi

# 启动新服务器
echo ""
echo "🚀 启动新的开发服务器..."
echo "提示: 按 Ctrl+C 可以停止服务器"
echo "========================================"
echo ""

npm run dev

