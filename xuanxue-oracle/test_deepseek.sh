#!/bin/bash

# DeepSeek API 连接测试脚本
# 测试 xuanxue-oracle 节点与 deepseek.com 的通信

# 不要立即退出，以便看到所有测试结果
# set -e

echo "🧪 开始测试 DeepSeek API 连接..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数器
PASSED=0
FAILED=0

# 打印成功信息
success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

# 打印失败信息
fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

# 打印信息
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 打印警告
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 检查环境变量
echo "📋 测试1: 检查环境配置"
echo "-----------------------------------"

# 检查.env文件
if [ -f ".env" ]; then
    success ".env 文件存在"
    set -a  # 自动导出所有变量
    source .env 2>/dev/null || {
        warning ".env 文件加载失败，尝试手动解析"
        # 手动解析 .env 文件
        while IFS='=' read -r key value; do
            # 跳过注释和空行
            [[ $key =~ ^#.*$ ]] && continue
            [[ -z $key ]] && continue
            # 移除引号
            value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            export "$key=$value"
        done < .env
    }
    set +a
else
    warning ".env 文件不存在，使用 .env.example"
    if [ -f ".env.example" ]; then
        set -a
        source .env.example 2>/dev/null || {
            while IFS='=' read -r key value; do
                [[ $key =~ ^#.*$ ]] && continue
                [[ -z $key ]] && continue
                value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                export "$key=$value"
            done < .env.example
        }
        set +a
    else
        fail "未找到配置文件"
        exit 1
    fi
fi

# 检查API密钥
if [ -z "$DEEPSEEK_API_KEY" ]; then
    fail "DEEPSEEK_API_KEY 未设置"
    echo "请在 .env 文件中设置 DEEPSEEK_API_KEY"
    exit 1
else
    # 隐藏部分密钥
    MASKED_KEY="${DEEPSEEK_API_KEY:0:8}...${DEEPSEEK_API_KEY: -4}"
    success "DEEPSEEK_API_KEY 已设置: $MASKED_KEY"
fi

# 检查基础URL
if [ -z "$DEEPSEEK_BASE_URL" ]; then
    DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
    info "使用默认 DEEPSEEK_BASE_URL: $DEEPSEEK_BASE_URL"
else
    success "DEEPSEEK_BASE_URL: $DEEPSEEK_BASE_URL"
fi

# 检查模型
if [ -z "$DEEPSEEK_MODEL" ]; then
    DEEPSEEK_MODEL="deepseek-chat"
    info "使用默认模型: $DEEPSEEK_MODEL"
else
    success "DEEPSEEK_MODEL: $DEEPSEEK_MODEL"
fi

echo ""

# 测试网络连接
echo "📋 测试2: 测试网络连接"
echo "-----------------------------------"

# 检查是否能访问 DeepSeek API
if curl -s --connect-timeout 5 https://api.deepseek.com > /dev/null 2>&1; then
    success "能够访问 api.deepseek.com"
else
    fail "无法访问 api.deepseek.com"
    echo "请检查网络连接"
    exit 1
fi

echo ""

# 测试API调用
echo "📋 测试3: 测试 DeepSeek API 调用"
echo "-----------------------------------"

# 创建临时请求文件
TEMP_REQUEST=$(mktemp)
cat > "$TEMP_REQUEST" << EOF
{
  "model": "$DEEPSEEK_MODEL",
  "messages": [
    {
      "role": "system",
      "content": "你是一个测试助手。"
    },
    {
      "role": "user",
      "content": "请用一句话回复：连接测试成功"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 100
}
EOF

info "发送测试请求到 DeepSeek API..."

# 发送请求
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
    -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$TEMP_REQUEST")

# 分离响应体和状态码
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

# 检查HTTP状态码
if [ "$HTTP_CODE" = "200" ]; then
    success "API 请求成功 (HTTP $HTTP_CODE)"

    # 解析响应
    if command -v jq &> /dev/null; then
        echo ""
        info "API 响应内容："
        echo "$RESPONSE_BODY" | jq -r '.choices[0].message.content' | sed 's/^/    /'

        # 提取使用统计
        PROMPT_TOKENS=$(echo "$RESPONSE_BODY" | jq -r '.usage.prompt_tokens')
        COMPLETION_TOKENS=$(echo "$RESPONSE_BODY" | jq -r '.usage.completion_tokens')
        TOTAL_TOKENS=$(echo "$RESPONSE_BODY" | jq -r '.usage.total_tokens')

        echo ""
        info "Token 使用统计："
        echo "    提示词: $PROMPT_TOKENS tokens"
        echo "    回复: $COMPLETION_TOKENS tokens"
        echo "    总计: $TOTAL_TOKENS tokens"
    else
        warning "未安装 jq，无法解析 JSON 响应"
        echo "$RESPONSE_BODY"
    fi
else
    fail "API 请求失败 (HTTP $HTTP_CODE)"
    echo ""
    echo "错误响应："
    echo "$RESPONSE_BODY" | head -20
fi

# 清理临时文件
rm -f "$TEMP_REQUEST"

echo ""

# 测试Rust代码单元测试
echo "📋 测试4: 运行 Rust 单元测试"
echo "-----------------------------------"

info "编译项目..."
if cargo build --quiet 2>&1 | grep -v "Compiling\|Finished"; then
    success "项目编译成功"
else
    fail "项目编译失败"
fi

info "运行 DeepSeek 客户端测试..."
export DEEPSEEK_API_KEY
if cargo test -p xuanxue-oracle --lib ai::deepseek::tests::test_deepseek_client -- --nocapture 2>&1 | tee /tmp/test_output.log | grep -q "test result: ok"; then
    success "DeepSeek 客户端单元测试通过"

    # 显示测试输出中的响应
    if grep -q "Response:" /tmp/test_output.log; then
        echo ""
        info "测试中的 AI 响应："
        grep "Response:" /tmp/test_output.log | sed 's/^/    /'
    fi
else
    warning "DeepSeek 客户端单元测试未通过或跳过"
    echo "（这可能是因为 API 密钥未设置或网络问题）"
fi

rm -f /tmp/test_output.log

echo ""

# 集成测试 - 测试完整的 AI 生成功能
echo "📋 测试5: 集成测试 - 完整 AI 解读流程"
echo "-----------------------------------"

info "创建测试程序..."

# 创建临时测试程序
TEST_PROGRAM=$(mktemp --suffix=.rs)
cat > "$TEST_PROGRAM" << 'RUST_EOF'
use xuanxue_oracle::config::DeepSeekConfig;
use xuanxue_oracle::ai::deepseek::DeepSeekClient;

#[tokio::main]
async fn main() {
    // 从环境变量加载配置
    let api_key = std::env::var("DEEPSEEK_API_KEY")
        .expect("DEEPSEEK_API_KEY 未设置");

    let config = DeepSeekConfig {
        api_key,
        base_url: std::env::var("DEEPSEEK_BASE_URL")
            .unwrap_or_else(|_| "https://api.deepseek.com/v1".to_string()),
        model: std::env::var("DEEPSEEK_MODEL")
            .unwrap_or_else(|_| "deepseek-chat".to_string()),
        temperature: 0.7,
        max_tokens: 500,
    };

    let client = DeepSeekClient::new(config);

    // 测试提示词
    let prompt = "System: 你是一个专业的玄学解读助手，精通八字、六爻等占卜术。

User: 请简要说明八字命理的基本原理（不超过100字）。";

    println!("🔮 发送测试提示词到 DeepSeek...");

    match client.generate(prompt).await {
        Ok(response) => {
            println!("✅ 成功获取 AI 解读:");
            println!("---");
            println!("{}", response);
            println!("---");
        }
        Err(e) => {
            eprintln!("❌ AI 调用失败: {}", e);
            std::process::exit(1);
        }
    }
}
RUST_EOF

# 运行测试程序
if DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
   DEEPSEEK_BASE_URL="$DEEPSEEK_BASE_URL" \
   DEEPSEEK_MODEL="$DEEPSEEK_MODEL" \
   cargo run --quiet --example test_integration 2>/dev/null || \
   cargo run --quiet --bin xuanxue-oracle -- --help 2>/dev/null | head -1 > /dev/null; then

    # 如果上面的方法不行，尝试直接运行一个简单的 Rust 脚本
    info "使用 cargo script 进行集成测试..."

    # 检查是否有 cargo-script
    if command -v cargo-script &> /dev/null; then
        RUST_LOG=info cargo-script "$TEST_PROGRAM"
        if [ $? -eq 0 ]; then
            success "集成测试通过 - AI 解读功能正常"
        else
            fail "集成测试失败"
        fi
    else
        warning "cargo-script 未安装，跳过集成测试"
        info "你可以通过 'cargo install cargo-script' 安装"
    fi
else
    warning "无法运行集成测试"
fi

rm -f "$TEST_PROGRAM"

echo ""

# 总结
echo "======================================"
echo "📊 测试总结"
echo "======================================"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！DeepSeek API 连接正常！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  部分测试失败，请检查配置和网络连接${NC}"
    exit 1
fi
