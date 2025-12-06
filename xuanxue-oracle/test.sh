#!/bin/bash
# 自动化测试运行脚本

set -e

echo "🧪 Xuanxue Oracle 自动化测试套件"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# 函数: 运行测试
run_test() {
    local test_name=$1
    local test_command=$2
    local required=$3  # "required" or "optional"

    echo -e "${YELLOW}► 运行: $test_name${NC}"

    if eval "$test_command" > /tmp/test_output.log 2>&1; then
        echo -e "${GREEN}✓ 通过: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        if [ "$required" == "required" ]; then
            echo -e "${RED}✗ 失败: $test_name${NC}"
            echo "错误信息:"
            cat /tmp/test_output.log
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        else
            echo -e "${YELLOW}⊘ 跳过: $test_name (可选测试,依赖服务未运行)${NC}"
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            return 0
        fi
    fi
}

# 1. 编译检查
echo "📦 第1步: 编译检查"
echo "---"
run_test "Cargo编译" "cargo check --all-targets" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# 2. 单元测试
echo "🔬 第2步: 单元测试"
echo "---"
run_test "配置模块" "cargo test config_tests -- --nocapture" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

run_test "类型转换" "cargo test types_tests -- --nocapture" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

run_test "错误处理" "cargo test error_tests -- --nocapture" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# 3. 集成测试 (不需要外部服务)
echo "🔗 第3步: 集成测试 (基础)"
echo "---"
run_test "配置加载" "cargo test test_config_loading -- --nocapture" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

run_test "Prompt模板加载" "cargo test test_prompt_template_loading -- --nocapture" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

run_test "Prompt占位符替换" "cargo test test_prompt_placeholder_replacement -- --nocapture" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# 4. 外部服务测试 (可选)
echo "🌐 第4步: 外部服务测试 (可选)"
echo "---"

# 检查区块链节点
if curl -s -m 2 http://localhost:9944 > /dev/null 2>&1; then
    echo "✓ 检测到区块链节点运行中"
    run_test "Oracle初始化" "cargo test test_oracle_initialization --ignored -- --nocapture" "optional"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo "⊘ 区块链节点未运行,跳过相关测试"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi

# 检查IPFS
if curl -s -m 2 http://localhost:5001/api/v0/version > /dev/null 2>&1; then
    echo "✓ 检测到IPFS节点运行中"
    run_test "IPFS上传" "cargo test test_ipfs_local_upload --ignored -- --nocapture" "optional"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo "⊘ IPFS节点未运行,跳过相关测试"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi

# 检查DeepSeek API
if [ -n "$DEEPSEEK_API_KEY" ]; then
    echo "✓ 检测到DeepSeek API Key"
    run_test "DeepSeek服务" "cargo test test_deepseek_service --ignored -- --nocapture" "optional"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo "⊘ DeepSeek API Key未配置,跳过AI测试"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi
echo ""

# 5. 性能测试
echo "⚡ 第5步: 性能测试"
echo "---"
run_test "Prompt构建性能" "cargo test test_prompt_building_performance -- --nocapture" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# 6. 代码质量检查
echo "📊 第6步: 代码质量检查"
echo "---"
run_test "Clippy检查" "cargo clippy -- -D warnings" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

run_test "格式检查" "cargo fmt -- --check" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# 7. 文档测试
echo "📚 第7步: 文档测试"
echo "---"
run_test "文档生成" "cargo doc --no-deps" "required"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# 生成测试报告
echo "================================"
echo "📋 测试报告"
echo "================================"
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}✓ 通过: $PASSED_TESTS${NC}"
echo -e "${RED}✗ 失败: $FAILED_TESTS${NC}"
echo -e "${YELLOW}⊘ 跳过: $SKIPPED_TESTS${NC}"
echo ""

# 计算通过率
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "通过率: $PASS_RATE%"
else
    PASS_RATE=0
fi

echo ""

# 生成徽章
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有必需测试通过!${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
