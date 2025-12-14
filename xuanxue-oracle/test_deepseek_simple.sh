#!/bin/bash

# DeepSeek API 简单连接测试
# 快速验证 xuanxue-oracle 与 deepseek.com 的通信

echo "🧪 DeepSeek API 快速连接测试"
echo "========================================"
echo ""

# 加载环境变量
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ 已加载 .env 配置"
elif [ -f ".env.example" ]; then
    export $(grep -v '^#' .env.example | xargs)
    echo "⚠️  使用 .env.example 配置"
else
    echo "❌ 未找到配置文件"
    exit 1
fi

echo ""

# 检查必要的环境变量
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "❌ 错误: DEEPSEEK_API_KEY 未设置"
    echo "请在 .env 文件中设置 DEEPSEEK_API_KEY"
    exit 1
fi

if [ -z "$DEEPSEEK_BASE_URL" ]; then
    DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
fi

if [ -z "$DEEPSEEK_MODEL" ]; then
    DEEPSEEK_MODEL="deepseek-chat"
fi

# 显示配置信息
MASKED_KEY="${DEEPSEEK_API_KEY:0:8}...${DEEPSEEK_API_KEY: -4}"
echo "📋 当前配置:"
echo "  - API Key: $MASKED_KEY"
echo "  - Base URL: $DEEPSEEK_BASE_URL"
echo "  - Model: $DEEPSEEK_MODEL"
echo ""

# 测试1: 网络连接
echo "🌐 测试1: 检查网络连接到 api.deepseek.com..."
if curl -s --connect-timeout 5 https://api.deepseek.com > /dev/null 2>&1; then
    echo "✅ 网络连接正常"
else
    echo "❌ 无法连接到 api.deepseek.com"
    echo "请检查网络或防火墙设置"
    exit 1
fi
echo ""

# 测试2: API 调用
echo "🤖 测试2: 发送测试请求到 DeepSeek API..."

# 创建请求 JSON
REQUEST_JSON=$(cat <<EOF
{
  "model": "$DEEPSEEK_MODEL",
  "messages": [
    {
      "role": "system",
      "content": "你是一个玄学解读助手。"
    },
    {
      "role": "user",
      "content": "请回复：系统正常运行。"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 50
}
EOF
)

# 发送请求
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
    -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_JSON")

# 提取 HTTP 状态码
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo ""

# 检查响应
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API 请求成功 (HTTP $HTTP_CODE)"
    echo ""
    echo "📝 响应内容:"
    echo "-----------------------------------"

    # 尝试使用 Python 解析 JSON（通常系统都有 Python）
    if command -v python3 &> /dev/null; then
        echo "$RESPONSE_BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # 提取回复内容
    content = data['choices'][0]['message']['content']
    print('AI 回复: ' + content)
    print()
    # 提取使用统计
    usage = data['usage']
    print('Token 使用:')
    print(f'  - 输入: {usage[\"prompt_tokens\"]} tokens')
    print(f'  - 输出: {usage[\"completion_tokens\"]} tokens')
    print(f'  - 总计: {usage[\"total_tokens\"]} tokens')
except Exception as e:
    print('解析响应失败:', e)
    print(sys.stdin.read())
" 2>/dev/null || echo "$RESPONSE_BODY"
    else
        echo "$RESPONSE_BODY"
    fi

    echo "-----------------------------------"
    echo ""
    echo "🎉 DeepSeek API 连接测试成功！"
    exit 0
else
    echo "❌ API 请求失败 (HTTP $HTTP_CODE)"
    echo ""
    echo "错误响应:"
    echo "$RESPONSE_BODY" | head -20
    echo ""
    echo "💡 可能的原因:"
    echo "  1. API Key 无效或已过期"
    echo "  2. API 配额已用完"
    echo "  3. 网络连接问题"
    echo "  4. API 服务暂时不可用"
    exit 1
fi
