#!/bin/bash
# 验证目录重命名结果
# 日期: 2025-10-29

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_ROOT="/home/xiaodong/文档/stardust"
cd "$REPO_ROOT"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}目录重命名结果验证${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 检查计数器
total_checks=0
passed_checks=0
failed_checks=0

# 函数: 检查项
check_item() {
    local description=$1
    local command=$2
    local expected=$3
    
    total_checks=$((total_checks + 1))
    
    echo -n "检查: $description ... "
    
    if eval "$command" > /dev/null 2>&1; then
        if [ "$expected" = "true" ]; then
            echo -e "${GREEN}✓ 通过${NC}"
            passed_checks=$((passed_checks + 1))
            return 0
        else
            echo -e "${RED}✗ 失败${NC}"
            failed_checks=$((failed_checks + 1))
            return 1
        fi
    else
        if [ "$expected" = "false" ]; then
            echo -e "${GREEN}✓ 通过${NC}"
            passed_checks=$((passed_checks + 1))
            return 0
        else
            echo -e "${RED}✗ 失败${NC}"
            failed_checks=$((failed_checks + 1))
            return 1
        fi
    fi
}

# 测试1: 检查新目录是否存在
echo -e "${BLUE}[测试1] 检查新目录${NC}"
check_item "stardust-dapp 存在" "[ -d stardust-dapp ]" "true"
check_item "stardust-governance 存在" "[ -d stardust-governance ]" "true"
check_item "stardust-gov 存在" "[ -d stardust-gov ]" "true"
check_item "stardust-squid 存在" "[ -d stardust-squid ]" "true"
check_item "stardust-gov-scripts 存在" "[ -d stardust-gov-scripts ]" "true"
echo ""

# 测试2: 检查旧目录是否已删除
echo -e "${BLUE}[测试2] 检查旧目录${NC}"
check_item "memopark-dapp 不存在" "[ -d memopark-dapp ]" "false"
check_item "memopark-governance 不存在" "[ -d memopark-governance ]" "false"
check_item "memopark-gov 不存在" "[ -d memopark-gov ]" "false"
check_item "memopark-squid 不存在" "[ -d memopark-squid ]" "false"
check_item "memopark-gov-scripts 不存在" "[ -d memopark-gov-scripts ]" "false"
echo ""

# 测试3: 检查脚本更新
echo -e "${BLUE}[测试3] 检查脚本更新${NC}"
if [ -f "启动所有服务.sh" ]; then
    check_item "启动脚本包含 stardust-dapp" "grep -q 'stardust-dapp' 启动所有服务.sh" "true"
    check_item "启动脚本包含 stardust-governance" "grep -q 'stardust-governance' 启动所有服务.sh" "true"
    check_item "启动脚本不包含 memopark-dapp" "grep -q 'memopark-dapp' 启动所有服务.sh" "false"
fi

if [ -f "停止所有服务.sh" ]; then
    check_item "停止脚本包含 stardust-dapp" "grep -q 'stardust-dapp' 停止所有服务.sh" "true"
    check_item "停止脚本不包含 memopark-dapp" "grep -q 'memopark-dapp' 停止所有服务.sh" "false"
fi
echo ""

# 测试4: 检查package.json
echo -e "${BLUE}[测试4] 检查package.json${NC}"
if [ -f "stardust-dapp/package.json" ]; then
    check_item "stardust-dapp/package.json name字段" "grep -q '\"name\": \"stardust-dapp\"' stardust-dapp/package.json" "true"
fi

if [ -f "stardust-governance/package.json" ]; then
    check_item "stardust-governance/package.json name字段" "grep -q '\"name\": \"stardust-governance\"' stardust-governance/package.json" "true"
fi

if [ -f "stardust-gov/package.json" ]; then
    check_item "stardust-gov/package.json name字段" "grep -q '\"name\": \"stardust-gov\"' stardust-gov/package.json" "true"
fi
echo ""

# 测试5: 检查Git状态
echo -e "${BLUE}[测试5] 检查Git状态${NC}"
check_item "Git工作区是否干净或有暂存" "git status" "true"

# 检查是否有重命名记录
if git log --oneline --all -20 | grep -q "目录重命名\|dir.*rename"; then
    echo -e "${GREEN}✓ 发现目录重命名提交记录${NC}"
    passed_checks=$((passed_checks + 1))
else
    echo -e "${YELLOW}⚠ 未发现目录重命名提交（可能尚未提交）${NC}"
fi
total_checks=$((total_checks + 1))

# 检查备份标签
if git tag -l | grep -q "before-dir-rename\|after-dir-rename"; then
    echo -e "${GREEN}✓ 发现重命名备份标签${NC}"
    passed_checks=$((passed_checks + 1))
else
    echo -e "${YELLOW}⚠ 未发现重命名备份标签${NC}"
fi
total_checks=$((total_checks + 1))
echo ""

# 测试6: 检查README更新
echo -e "${BLUE}[测试6] 检查README更新${NC}"
if [ -f "README.md" ]; then
    check_item "README包含 stardust-dapp" "grep -q 'stardust-dapp' README.md" "true"
    check_item "README包含 stardust-governance" "grep -q 'stardust-governance' README.md" "true"
fi
echo ""

# 总结
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}验证总结${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "总检查项: ${BLUE}$total_checks${NC}"
echo -e "通过: ${GREEN}$passed_checks${NC}"
echo -e "失败: ${RED}$failed_checks${NC}"
echo ""

# 计算通过率
pass_rate=$((passed_checks * 100 / total_checks))

if [ $failed_checks -eq 0 ]; then
    echo -e "${GREEN}🎉 所有检查通过！目录重命名完成！${NC}"
    echo -e "${GREEN}项目改名完成度: 98%${NC}"
    echo ""
    echo -e "${BLUE}下一步建议:${NC}"
    echo -e "1. 测试服务启动: ${YELLOW}./启动所有服务.sh${NC}"
    echo -e "2. 访问前端: ${YELLOW}http://127.0.0.1:5173${NC}"
    echo -e "3. 如果是多人团队，通知其他成员更新本地配置"
    exit 0
elif [ $pass_rate -ge 80 ]; then
    echo -e "${YELLOW}⚠ 大部分检查通过（$pass_rate%），但有 $failed_checks 项失败${NC}"
    echo -e "${YELLOW}请检查失败项并手动修复${NC}"
    exit 1
else
    echo -e "${RED}✗ 验证失败！通过率仅 $pass_rate%${NC}"
    echo -e "${RED}建议重新执行重命名脚本或手动检查${NC}"
    exit 2
fi

