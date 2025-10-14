#!/bin/bash

# 首购法币支付网关服务启动脚本

set -e

echo "=========================================="
echo "首购法币支付网关服务启动脚本"
echo "=========================================="
echo ""

# 检查.env文件
if [ ! -f .env ]; then
    echo "❌ 错误: .env文件不存在"
    echo "请先复制配置模板: cp .env.example .env"
    echo "然后编辑配置文件: vim .env"
    exit 1
fi

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装Docker"
    echo "请先安装Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: 未安装Docker Compose"
    echo "请先安装Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 选择启动方式
echo "请选择启动方式："
echo "1) Docker Compose（推荐）"
echo "2) 直接启动（需要先启动Redis）"
read -p "请输入选项 [1-2]: " choice

case $choice in
    1)
        echo ""
        echo "📦 使用Docker Compose启动..."
        echo ""
        
        # 构建镜像
        echo "🔨 构建Docker镜像..."
        docker-compose build
        
        echo ""
        echo "🚀 启动服务..."
        docker-compose up -d
        
        echo ""
        echo "⏳ 等待服务启动（10秒）..."
        sleep 10
        
        echo ""
        echo "🔍 检查服务状态..."
        docker-compose ps
        
        echo ""
        echo "✅ 服务启动成功！"
        echo ""
        echo "📊 查看日志: docker-compose logs -f first-purchase-service"
        echo "🛑 停止服务: docker-compose down"
        echo "🔄 重启服务: docker-compose restart"
        echo ""
        ;;
    
    2)
        echo ""
        echo "📦 直接启动服务..."
        echo ""
        
        # 检查Node.js
        if ! command -v node &> /dev/null; then
            echo "❌ 错误: 未安装Node.js"
            echo "请先安装Node.js >= 18.0.0"
            exit 1
        fi
        
        # 检查Redis
        if ! command -v redis-cli &> /dev/null; then
            echo "⚠️ 警告: 未检测到Redis"
            echo "请确保Redis已启动: docker run -d --name redis -p 6379:6379 redis:7-alpine"
        fi
        
        # 安装依赖
        if [ ! -d "node_modules" ]; then
            echo "📦 安装依赖..."
            npm install
        fi
        
        echo ""
        echo "🚀 启动服务..."
        npm start
        ;;
    
    *)
        echo "❌ 无效的选项"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "服务地址: http://localhost:3100"
echo "健康检查: curl http://localhost:3100/api/first-purchase/health"
echo "=========================================="

