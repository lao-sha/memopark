#!/bin/bash

# ============================================================================
# Xuanxue Oracle - DeepSeek API 集成测试脚本
#
# 功能：全面测试 xuanxue-oracle 节点与 deepseek.com 的通信
# 作者：Stardust Team
# 版本：1.0.0
# ============================================================================

set -euo pipefail  # 严格模式：遇错退出、未定义变量报错、管道错误传播

# ============================================================================
# 颜色和样式定义
# ============================================================================
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# ============================================================================
# 全局变量
# ============================================================================
PASSED=0
FAILED=0
WARNINGS=0
TOTAL_TESTS=0
START_TIME=$(date +%s)

# 测试结果日志
LOG_FILE="/tmp/oracle_test_$(date +%Y%m%d_%H%M%S).log"

# ============================================================================
# 辅助函数
# ============================================================================

# 打印标题
print_header() {
    echo ""
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 打印章节
print_section() {
    echo ""
    echo -e "${BOLD}${MAGENTA}▶ 测试 $1: $2${NC}"
    echo -e "${MAGENTA}────────────────────────────────────────────${NC}"
    ((TOTAL_TESTS++))
}

# 打印成功信息
success() {
    echo -e "${GREEN}  ✅ $1${NC}"
    echo "[SUCCESS] $1" >> "$LOG_FILE"
    ((PASSED++))
}

# 打印失败信息
fail() {
    echo -e "${RED}  ❌ $1${NC}"
    echo "[FAILED] $1" >> "$LOG_FILE"
    ((FAILED++))
}

# 打印警告信息
warning() {
    echo -e "${YELLOW}  ⚠️  $1${NC}"
    echo "[WARNING] $1" >> "$LOG_FILE"
    ((WARNINGS++))
}

# 打印信息
info() {
    echo -e "${BLUE}  ℹ️  $1${NC}"
    echo "[INFO] $1" >> "$LOG_FILE"
}

# 打印详细信息
detail() {
    echo -e "${CYAN}     → $1${NC}"
}

# 进度指示器
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while ps -p $pid > /dev/null 2>&1; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# ============================================================================
# 测试函数
# ============================================================================

# 测试1: 环境配置检查
test_environment() {
    print_section "1" "环境配置检查"

    # 检查 .env 文件
    if [ -f ".env" ]; then
        success ".env 文件存在"
        ENV_FILE=".env"
    elif [ -f ".env.example" ]; then
        warning "使用 .env.example 文件（建议创建 .env 文件）"
        ENV_FILE=".env.example"
    else
        fail "未找到配置文件"
        return 1
    fi

    # 加载环境变量
    set -a
    source "$ENV_FILE" 2>/dev/null || {
        warning "标准加载失败，使用手动解析"
        while IFS='=' read -r key value; do
            [[ $key =~ ^#.*$ ]] && continue
            [[ -z $key ]] && continue
            value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            export "$key=$value"
        done < "$ENV_FILE"
    }
    set +a

    # 验证必需的环境变量
    local required_vars=("DEEPSEEK_API_KEY" "CHAIN_WS_ENDPOINT")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            fail "$var 未设置"
            return 1
        else
            if [ "$var" = "DEEPSEEK_API_KEY" ]; then
                local masked="${!var:0:8}...${!var: -4}"
                success "$var 已设置: $masked"
            else
                success "$var 已设置: ${!var}"
            fi
        fi
    done

    # 设置默认值
    export DEEPSEEK_BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com/v1}"
    export DEEPSEEK_MODEL="${DEEPSEEK_MODEL:-deepseek-chat}"

    info "Base URL: $DEEPSEEK_BASE_URL"
    info "Model: $DEEPSEEK_MODEL"

    # 检查 Rust 工具链
    if command -v cargo &> /dev/null; then
        local rust_version=$(cargo --version | awk '{print $2}')
        success "Cargo 已安装: $rust_version"
    else
        fail "未安装 Cargo"
        return 1
    fi

    return 0
}

# 测试2: 网络连接测试
test_network_connectivity() {
    print_section "2" "网络连接测试"

    # 测试 DNS 解析
    info "测试 DNS 解析..."
    if host api.deepseek.com &> /dev/null; then
        success "DNS 解析正常"
    else
        warning "DNS 解析失败，但可能仍可连接"
    fi

    # 测试 HTTPS 连接
    info "测试 HTTPS 连接..."
    if timeout 10 curl -s --connect-timeout 5 https://api.deepseek.com > /dev/null 2>&1; then
        success "HTTPS 连接正常"
    else
        fail "无法连接到 api.deepseek.com"
        detail "请检查网络连接和防火墙设置"
        return 1
    fi

    # 测试延迟
    info "测试网络延迟..."
    local start_time=$(date +%s%N)
    curl -s --connect-timeout 5 https://api.deepseek.com > /dev/null 2>&1
    local end_time=$(date +%s%N)
    local latency=$(( (end_time - start_time) / 1000000 ))

    if [ $latency -lt 500 ]; then
        success "网络延迟: ${latency}ms (优秀)"
    elif [ $latency -lt 1000 ]; then
        success "网络延迟: ${latency}ms (良好)"
    elif [ $latency -lt 2000 ]; then
        warning "网络延迟: ${latency}ms (一般)"
    else
        warning "网络延迟: ${latency}ms (较慢)"
    fi

    return 0
}

# 测试3: API 基础功能测试
test_api_basic() {
    print_section "3" "DeepSeek API 基础功能测试"

    # 创建测试请求
    local test_request=$(cat <<EOF
{
  "model": "$DEEPSEEK_MODEL",
  "messages": [
    {
      "role": "system",
      "content": "你是一个测试助手，请简洁回答。"
    },
    {
      "role": "user",
      "content": "请回复：测试成功"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 50
}
EOF
)

    info "发送 API 请求..."

    # 发送请求并记录时间
    local request_start=$(date +%s%N)
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
        -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$test_request" 2>&1)
    local request_end=$(date +%s%N)
    local request_time=$(( (request_end - request_start) / 1000000 ))

    # 提取状态码和响应体
    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    local response_body=$(echo "$response" | sed '/HTTP_CODE:/d')

    # 验证响应
    if [ "$http_code" = "200" ]; then
        success "API 请求成功 (HTTP $http_code, 耗时: ${request_time}ms)"

        # 解析 JSON 响应
        if command -v python3 &> /dev/null; then
            local parse_result=$(echo "$response_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    content = data['choices'][0]['message']['content']
    usage = data['usage']
    print(f'CONTENT:{content}')
    print(f'PROMPT_TOKENS:{usage[\"prompt_tokens\"]}')
    print(f'COMPLETION_TOKENS:{usage[\"completion_tokens\"]}')
    print(f'TOTAL_TOKENS:{usage[\"total_tokens\"]}')
except Exception as e:
    print(f'ERROR:{e}')
" 2>&1)

            if echo "$parse_result" | grep -q "CONTENT:"; then
                local ai_content=$(echo "$parse_result" | grep "CONTENT:" | cut -d: -f2-)
                local prompt_tokens=$(echo "$parse_result" | grep "PROMPT_TOKENS:" | cut -d: -f2)
                local completion_tokens=$(echo "$parse_result" | grep "COMPLETION_TOKENS:" | cut -d: -f2)
                local total_tokens=$(echo "$parse_result" | grep "TOTAL_TOKENS:" | cut -d: -f2)

                success "AI 响应内容获取成功"
                detail "回复: $ai_content"
                detail "Token 使用: 输入=$prompt_tokens, 输出=$completion_tokens, 总计=$total_tokens"
            else
                warning "无法解析 API 响应"
                detail "$(echo "$parse_result" | grep "ERROR:" | cut -d: -f2-)"
            fi
        else
            warning "未安装 Python3，跳过响应解析"
        fi
    else
        fail "API 请求失败 (HTTP $http_code)"
        detail "$(echo "$response_body" | head -5)"
        return 1
    fi

    return 0
}

# 测试4: API 错误处理测试
test_api_error_handling() {
    print_section "4" "DeepSeek API 错误处理测试"

    # 测试无效的 API Key
    info "测试无效的 API Key..."
    local invalid_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
        -H "Authorization: Bearer invalid_key_test" \
        -H "Content-Type: application/json" \
        -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}' 2>&1)

    local invalid_http_code=$(echo "$invalid_response" | grep "HTTP_CODE:" | cut -d: -f2)

    if [ "$invalid_http_code" = "401" ] || [ "$invalid_http_code" = "403" ]; then
        success "正确处理无效 API Key (HTTP $invalid_http_code)"
    else
        warning "未预期的响应码: $invalid_http_code"
    fi

    # 测试空请求
    info "测试空请求处理..."
    local empty_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
        -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{}' 2>&1)

    local empty_http_code=$(echo "$empty_response" | grep "HTTP_CODE:" | cut -d: -f2)

    if [ "$empty_http_code" = "400" ] || [ "$empty_http_code" = "422" ]; then
        success "正确处理空请求 (HTTP $empty_http_code)"
    else
        warning "未预期的响应码: $empty_http_code"
    fi

    return 0
}

# 测试5: Rust 代码编译测试
test_rust_compilation() {
    print_section "5" "Rust 代码编译测试"

    info "开始编译项目..."

    # 编译项目（静默模式）
    if cargo build --quiet 2>&1 | tee /tmp/build_output.log | grep -qE "(error|failed)"; then
        fail "项目编译失败"
        detail "查看日志: /tmp/build_output.log"
        return 1
    else
        success "项目编译成功"

        # 检查二进制文件
        if [ -f "target/debug/xuanxue-oracle" ]; then
            local binary_size=$(du -h target/debug/xuanxue-oracle | cut -f1)
            detail "二进制文件大小: $binary_size"
        fi
    fi

    rm -f /tmp/build_output.log
    return 0
}

# 测试6: Rust 单元测试
test_rust_unit_tests() {
    print_section "6" "Rust 单元测试"

    info "运行 DeepSeek 客户端单元测试..."

    export DEEPSEEK_API_KEY
    export DEEPSEEK_BASE_URL
    export DEEPSEEK_MODEL

    # 运行测试并捕获输出
    local test_output=$(cargo test -p xuanxue-oracle --lib ai::deepseek::tests::test_deepseek_client -- --nocapture 2>&1)

    if echo "$test_output" | grep -q "test result: ok"; then
        success "DeepSeek 客户端单元测试通过"

        # 提取 AI 响应
        if echo "$test_output" | grep -q "Response:"; then
            local ai_response=$(echo "$test_output" | grep "Response:" | sed 's/.*Response: //')
            detail "AI 测试响应: $ai_response"
        fi
    elif echo "$test_output" | grep -q "test result: FAILED"; then
        fail "DeepSeek 客户端单元测试失败"
        detail "$(echo "$test_output" | grep -A5 "failures:")"
        return 1
    else
        warning "单元测试被跳过（可能因为环境变量未设置）"
    fi

    return 0
}

# 测试7: 玄学解读场景测试
test_divination_scenarios() {
    print_section "7" "玄学解读场景测试"

    # 测试场景列表
    local scenarios=(
        "八字:请解读一个甲子日出生的人的性格特点"
        "六爻:解释六爻占卜中的用神和忌神"
        "梅花易数:说明梅花易数的起卦方法"
    )

    for scenario in "${scenarios[@]}"; do
        local divination_type=$(echo "$scenario" | cut -d: -f1)
        local question=$(echo "$scenario" | cut -d: -f2-)

        info "测试场景: $divination_type"

        local divination_request=$(cat <<EOF
{
  "model": "$DEEPSEEK_MODEL",
  "messages": [
    {
      "role": "system",
      "content": "你是一个专业的玄学解读助手，精通${divination_type}。请用专业且简洁的语言回答。"
    },
    {
      "role": "user",
      "content": "$question"
    }
  ],
  "temperature": 0.8,
  "max_tokens": 300
}
EOF
)

        local scenario_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
            -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$divination_request" 2>&1)

        local scenario_http_code=$(echo "$scenario_response" | grep "HTTP_CODE:" | cut -d: -f2)

        if [ "$scenario_http_code" = "200" ]; then
            success "$divination_type 场景测试通过"

            # 解析并显示响应摘要
            if command -v python3 &> /dev/null; then
                local scenario_content=$(echo "$scenario_response" | sed '/HTTP_CODE:/d' | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    content = data['choices'][0]['message']['content']
    # 只显示前100个字符
    if len(content) > 100:
        print(content[:100] + '...')
    else:
        print(content)
except:
    pass
" 2>/dev/null)
                if [ -n "$scenario_content" ]; then
                    detail "响应摘要: $scenario_content"
                fi
            fi
        else
            warning "$divination_type 场景测试失败 (HTTP $scenario_http_code)"
        fi

        # 避免请求过快
        sleep 1
    done

    return 0
}

# 测试8: 性能压力测试
test_performance() {
    print_section "8" "性能和并发测试"

    info "执行并发请求测试（5个请求）..."

    local concurrent_requests=5
    local pids=()
    local success_count=0

    # 创建临时目录存储结果
    local temp_dir=$(mktemp -d)

    # 并发发送请求
    for i in $(seq 1 $concurrent_requests); do
        (
            local start=$(date +%s%N)
            local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
                -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
                -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
                -H "Content-Type: application/json" \
                -d "{\"model\":\"$DEEPSEEK_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"测试请求$i\"}],\"max_tokens\":20}" 2>&1)
            local end=$(date +%s%N)
            local duration=$(( (end - start) / 1000000 ))

            local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)

            echo "REQUEST_$i:$http_code:$duration" > "$temp_dir/result_$i"
        ) &
        pids+=($!)
    done

    # 等待所有请求完成
    for pid in "${pids[@]}"; do
        wait $pid
    done

    # 分析结果
    local total_time=0
    for i in $(seq 1 $concurrent_requests); do
        if [ -f "$temp_dir/result_$i" ]; then
            local result=$(cat "$temp_dir/result_$i")
            local http_code=$(echo "$result" | cut -d: -f2)
            local duration=$(echo "$result" | cut -d: -f3)

            if [ "$http_code" = "200" ]; then
                ((success_count++))
                total_time=$((total_time + duration))
            fi
        fi
    done

    # 清理临时文件
    rm -rf "$temp_dir"

    if [ $success_count -eq $concurrent_requests ]; then
        local avg_time=$((total_time / concurrent_requests))
        success "并发测试全部成功 ($success_count/$concurrent_requests)"
        detail "平均响应时间: ${avg_time}ms"
    else
        warning "部分并发请求失败 ($success_count/$concurrent_requests 成功)"
    fi

    return 0
}

# 测试9: 知识库集成测试
test_knowledge_base() {
    print_section "9" "知识库集成测试"

    # 检查知识库目录
    if [ -d "knowledge" ]; then
        success "知识库目录存在"

        # 统计知识库文件
        local json_count=$(find knowledge -name "*.json" 2>/dev/null | wc -l)
        info "找到 $json_count 个知识库文件"

        # 验证关键文件
        local key_files=("knowledge/bazi/basics/tiangan.json" "knowledge/bazi/basics/dizhi.json")
        for file in "${key_files[@]}"; do
            if [ -f "$file" ]; then
                success "关键文件存在: $(basename $file)"
            else
                warning "缺少关键文件: $file"
            fi
        done
    else
        warning "知识库目录不存在，但不影响 API 测试"
    fi

    return 0
}

# 测试10: 端到端集成测试
test_end_to_end() {
    print_section "10" "端到端集成测试"

    info "模拟完整的占卜解读流程..."

    # 创建一个真实的占卜请求
    local e2e_request=$(cat <<'EOF'
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "你是一个专业的八字命理解读助手。请根据以下八字信息，提供详细的命理解读。\n\n解读要求：\n1. 分析日主五行强弱\n2. 判断格局类型\n3. 找出用神和忌神\n4. 给出性格特点分析\n5. 提供大运流年建议"
    },
    {
      "role": "user",
      "content": "八字信息：\n年柱：甲子（木水）\n月柱：丙寅（火木）\n日柱：戊辰（土土）\n时柱：壬戌（水土）\n\n请提供详细的命理解读（控制在200字以内）。"
    }
  ],
  "temperature": 0.8,
  "max_tokens": 500
}
EOF
)

    local e2e_start=$(date +%s%N)
    local e2e_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        -X POST "$DEEPSEEK_BASE_URL/chat/completions" \
        -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$e2e_request" 2>&1)
    local e2e_end=$(date +%s%N)
    local e2e_time=$(( (e2e_end - e2e_start) / 1000000 ))

    local e2e_http_code=$(echo "$e2e_response" | grep "HTTP_CODE:" | cut -d: -f2)

    if [ "$e2e_http_code" = "200" ]; then
        success "端到端测试成功 (耗时: ${e2e_time}ms)"

        # 解析并显示完整响应
        if command -v python3 &> /dev/null; then
            echo ""
            detail "AI 解读内容："
            echo -e "${CYAN}────────────────────────────────────────────${NC}"
            echo "$e2e_response" | sed '/HTTP_CODE:/d' | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    content = data['choices'][0]['message']['content']
    # 按行打印，每行添加缩进
    for line in content.split('\n'):
        print('     ' + line)
    print()
    # 显示使用统计
    usage = data['usage']
    print(f'     Token 统计: 输入={usage[\"prompt_tokens\"]}, 输出={usage[\"completion_tokens\"]}, 总计={usage[\"total_tokens\"]}')
except Exception as e:
    print(f'     解析失败: {e}')
" 2>/dev/null
            echo -e "${CYAN}────────────────────────────────────────────${NC}"
        fi
    else
        fail "端到端测试失败 (HTTP $e2e_http_code)"
        return 1
    fi

    return 0
}

# ============================================================================
# 生成测试报告
# ============================================================================
generate_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))

    print_header "测试报告"

    echo -e "${BOLD}测试统计：${NC}"
    echo "  • 测试项目数: $TOTAL_TESTS"
    echo -e "  • ${GREEN}通过: $PASSED${NC}"
    echo -e "  • ${RED}失败: $FAILED${NC}"
    echo -e "  • ${YELLOW}警告: $WARNINGS${NC}"
    echo "  • 总耗时: ${duration}s"
    echo ""

    echo -e "${BOLD}环境信息：${NC}"
    echo "  • API Endpoint: $DEEPSEEK_BASE_URL"
    echo "  • Model: $DEEPSEEK_MODEL"
    echo "  • Rust Version: $(cargo --version | awk '{print $2}')"
    echo "  • 测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""

    echo -e "${BOLD}日志文件：${NC}"
    echo "  • $LOG_FILE"
    echo ""

    # 计算成功率
    local total_checks=$((PASSED + FAILED))
    if [ $total_checks -gt 0 ]; then
        local success_rate=$(( PASSED * 100 / total_checks ))
        echo -e "${BOLD}成功率：${success_rate}%${NC}"
        echo ""

        if [ $success_rate -ge 90 ]; then
            echo -e "${GREEN}${BOLD}🎉 测试评级: 优秀${NC}"
            echo -e "${GREEN}   xuanxue-oracle 节点与 DeepSeek API 通信正常！${NC}"
        elif [ $success_rate -ge 70 ]; then
            echo -e "${YELLOW}${BOLD}✓ 测试评级: 良好${NC}"
            echo -e "${YELLOW}   大部分功能正常，但存在一些问题需要关注${NC}"
        else
            echo -e "${RED}${BOLD}⚠ 测试评级: 需要改进${NC}"
            echo -e "${RED}   请检查失败的测试项并修复问题${NC}"
        fi
    fi

    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================================================
# 主函数
# ============================================================================
main() {
    # 打印欢迎信息
    clear
    print_header "🔮 Xuanxue Oracle - DeepSeek API 集成测试"

    echo -e "${CYAN}本测试将全面验证 xuanxue-oracle 节点与 deepseek.com 的通信${NC}"
    echo -e "${CYAN}测试内容包括：环境配置、网络连接、API调用、Rust集成等${NC}"
    echo ""

    # 初始化日志
    echo "===== Xuanxue Oracle Test Log =====" > "$LOG_FILE"
    echo "Test started at: $(date)" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"

    # 执行测试（即使某些测试失败也继续执行）
    test_environment || true
    test_network_connectivity || true
    test_api_basic || true
    test_api_error_handling || true
    test_rust_compilation || true
    test_rust_unit_tests || true
    test_divination_scenarios || true
    test_performance || true
    test_knowledge_base || true
    test_end_to_end || true

    # 生成测试报告
    generate_report

    # 返回退出码
    if [ $FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# ============================================================================
# 脚本入口
# ============================================================================
main "$@"
