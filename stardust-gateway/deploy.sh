#!/bin/bash

# 星尘链 API Gateway 部署脚本

set -e

echo "🚀 开始部署星尘链 API Gateway..."

# 检查环境变量
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在，从示例创建..."
    cp .env.example .env
    echo "📝 请编辑 .env 文件设置 JWT_SECRET 等配置"
    exit 1
fi

# 构建 Docker 镜像
echo "📦 构建 Docker 镜像..."
docker build -t stardust-gateway:latest .

# 停止旧容器
echo "🛑 停止旧容器..."
docker-compose down || true

# 启动服务
echo "▶️  启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 健康检查
echo "🏥 健康检查..."
for i in {1..10}; do
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Gateway 启动成功！"
        docker-compose logs --tail=20 gateway
        exit 0
    fi
    echo "等待中... ($i/10)"
    sleep 2
done

echo "❌ Gateway 启动失败，请查看日志："
docker-compose logs gateway
exit 1
