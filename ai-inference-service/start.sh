#!/bin/bash
#
# AI推理服务启动脚本
# DeepSeek混合架构 v2.0
#

set -e

echo "======================================"
echo "  AI推理服务 - DeepSeek混合架构"
echo "  版本: v2.0.0"
echo "======================================"
echo ""

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到Python3"
    exit 1
fi

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔧 激活虚拟环境..."
source venv/bin/activate

# 安装/更新依赖
echo "📥 检查依赖..."
pip install -q -r requirements.txt

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到.env文件"
    echo "📝 从模板创建.env..."
    cp .env-template .env
    echo ""
    echo "⚠️  请编辑 .env 文件，填入你的 DEEPSEEK_API_KEY"
    echo "   获取地址: https://platform.deepseek.com/"
    echo ""
    read -p "是否现在编辑.env? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
fi

# 检查DeepSeek API密钥
source .env
if [ -z "$DEEPSEEK_API_KEY" ] || [ "$DEEPSEEK_API_KEY" = "your_deepseek_api_key_here" ]; then
    echo "⚠️  警告: 未配置有效的DEEPSEEK_API_KEY"
    echo "   服务将只使用本地模型（无AI分析）"
    echo ""
    read -p "继续启动? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查Redis（可选）
if ! redis-cli ping &> /dev/null; then
    echo "⚠️  警告: Redis未运行，缓存功能将禁用"
    echo "   建议启动Redis: docker run -d -p 6379:6379 redis:7-alpine"
    echo ""
fi

# 启动服务
echo ""
echo "🚀 启动AI推理服务..."
echo "   地址: http://0.0.0.0:8000"
echo "   文档: http://0.0.0.0:8000/docs"
echo "   健康检查: http://0.0.0.0:8000/health"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 根据参数选择模式
if [ "$1" = "dev" ] || [ "$1" = "development" ]; then
    echo "🔧 开发模式（自动重载）"
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
elif [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    echo "🏭 生产模式（4 workers）"
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
else
    echo "💻 标准模式"
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
fi

