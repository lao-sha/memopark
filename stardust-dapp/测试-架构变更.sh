#!/bin/bash
# 测试架构变更后的功能
# 2025-11-08

echo "========================================"
echo "  架构变更测试脚本"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
TOTAL=0
PASSED=0
FAILED=0

test_result() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# 测试1: 检查文件是否存在
echo "测试 1: 检查修改的文件"
if [ -f "src/lib/sessionManager.ts" ] && \
   [ -f "src/lib/backend.ts" ] && \
   [ -f "src/lib/config.ts" ] && \
   [ -f ".env" ]; then
    test_result 0 "所有核心文件存在"
else
    test_result 1 "缺少核心文件"
fi

# 测试2: 检查backend.ts是否标记为废弃
echo "测试 2: 检查 backend.ts 废弃标记"
if grep -q "废弃文件通知" src/lib/backend.ts; then
    test_result 0 "backend.ts 已正确标记为废弃"
else
    test_result 1 "backend.ts 未标记为废弃"
fi

# 测试3: 检查sessionManager.ts是否移除后端依赖
echo "测试 3: 检查 sessionManager.ts"
if ! grep -q "import.*handshakeWithBackend.*from.*backend" src/lib/sessionManager.ts; then
    test_result 0 "sessionManager.ts 已移除后端导入"
else
    test_result 1 "sessionManager.ts 仍然导入后端"
fi

# 测试4: 检查config.ts是否移除backendUrl（排除注释）
echo "测试 4: 检查 config.ts"
if ! grep "backendUrl:" src/lib/config.ts | grep -v "^[[:space:]]*//"; then
    test_result 0 "config.ts 已移除 backendUrl 配置"
else
    test_result 1 "config.ts 仍包含活跃的 backendUrl"
fi

# 测试5: 检查.env配置
echo "测试 5: 检查 .env 配置"
if ! grep -q "^VITE_BACKEND=" .env && \
   ! grep -q "^VITE_ALLOW_DEV_SESSION=" .env; then
    test_result 0 ".env 已移除后端配置"
else
    test_result 1 ".env 仍包含后端配置"
fi

# 测试6: TypeScript语法检查
echo "测试 6: TypeScript 语法检查"
if command -v npx &> /dev/null; then
    if npx tsc --noEmit --project tsconfig.json 2>&1 | grep -q "error TS"; then
        test_result 1 "TypeScript 存在语法错误"
    else
        test_result 0 "TypeScript 语法正确"
    fi
else
    echo -e "${YELLOW}⚠️  SKIP${NC}: npx 命令不可用，跳过语法检查"
    echo ""
fi

# 测试7: 检查文档
echo "测试 7: 检查文档"
if [ -f "../docs/架构变更-移除自定义后端.md" ] && \
   [ -f "架构变更说明.md" ]; then
    test_result 0 "文档已创建"
else
    test_result 1 "文档缺失"
fi

# 测试8: 检查是否有残留的后端引用（排除backend.ts本身）
echo "测试 8: 检查代码中的后端引用"
BACKEND_REFS=$(grep -r "handshakeWithBackend" src/ --include="*.ts" --include="*.tsx" | \
                grep -v "src/lib/backend.ts" | \
                grep -v "废弃" | \
                grep -v "已废弃" | \
                wc -l)
if [ "$BACKEND_REFS" -eq 0 ]; then
    test_result 0 "没有发现活跃的后端引用"
else
    test_result 1 "发现 $BACKEND_REFS 处活跃的后端引用"
    echo "提示: 运行 grep -r 'handshakeWithBackend' src/ --include='*.ts' --include='*.tsx' 查看详情"
fi

# 测试总结
echo "========================================"
echo "  测试总结"
echo "========================================"
echo -e "总计: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    echo ""
    echo "下一步："
    echo "1. 重启前端服务器: ./重启开发服务器.sh"
    echo "2. 访问 http://localhost:5173"
    echo "3. 测试登录功能"
    exit 0
else
    echo -e "${RED}⚠️  部分测试失败，请检查上述错误${NC}"
    exit 1
fi

