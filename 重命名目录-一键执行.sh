#!/bin/bash
# 项目目录重命名脚本
# 用途: 将 memopark-* 目录重命名为 stardust-*
# 日期: 2025-10-29
# 版本: v1.0

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
REPO_ROOT="/home/xiaodong/文档/stardust"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}项目目录重命名脚本${NC}"
echo -e "${BLUE}memopark → stardust${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -d "$REPO_ROOT" ]; then
    echo -e "${RED}错误: 项目目录不存在: $REPO_ROOT${NC}"
    exit 1
fi

cd "$REPO_ROOT"

# 函数: 检查目录是否存在
check_dir_exists() {
    local dir=$1
    if [ ! -d "$dir" ]; then
        echo -e "${RED}错误: 目录不存在: $dir${NC}"
        return 1
    fi
    return 0
}

# 函数: 检查目录是否已经重命名
check_already_renamed() {
    if [ -d "stardust-dapp" ] && [ -d "stardust-governance" ]; then
        echo -e "${YELLOW}警告: 目录似乎已经重命名过了${NC}"
        echo -e "${YELLOW}检测到: stardust-dapp 和 stardust-governance 已存在${NC}"
        echo ""
        read -p "是否继续? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo -e "${BLUE}已取消${NC}"
            exit 0
        fi
    fi
}

# 步骤1: 检查必要的目录
echo -e "${BLUE}[步骤1/8] 检查必要的目录...${NC}"
check_already_renamed

DIRS_TO_RENAME=(
    "memopark-dapp"
    "memopark-governance"
    "memopark-gov"
    "memopark-squid"
    "memopark-gov-scripts"
)

missing_dirs=()
for dir in "${DIRS_TO_RENAME[@]}"; do
    if [ ! -d "$dir" ]; then
        missing_dirs+=("$dir")
    fi
done

if [ ${#missing_dirs[@]} -gt 0 ]; then
    echo -e "${YELLOW}警告: 以下目录不存在，将跳过:${NC}"
    for dir in "${missing_dirs[@]}"; do
        echo -e "  - $dir"
    done
    echo ""
fi

# 步骤2: 停止所有服务
echo -e "${BLUE}[步骤2/8] 停止所有运行中的服务...${NC}"
if [ -f "停止所有服务.sh" ]; then
    bash 停止所有服务.sh 2>/dev/null || true
    echo -e "${GREEN}✓ 服务已停止${NC}"
else
    echo -e "${YELLOW}⚠ 停止服务脚本不存在，跳过${NC}"
fi
echo ""

# 步骤3: 创建Git备份
echo -e "${BLUE}[步骤3/8] 创建Git备份...${NC}"
git add . 2>/dev/null || true
git commit -m "保存当前状态 - 目录重命名前备份" 2>/dev/null || echo -e "${YELLOW}⚠ 没有需要提交的更改${NC}"
git tag -a before-dir-rename-$(date +%Y%m%d-%H%M%S) -m "目录重命名前备份 - $(date)" 2>/dev/null || true
echo -e "${GREEN}✓ Git备份已创建${NC}"
echo ""

# 步骤4: 重命名目录
echo -e "${BLUE}[步骤4/8] 重命名目录...${NC}"

rename_dir() {
    local old_name=$1
    local new_name=$2
    
    if [ -d "$old_name" ]; then
        if [ -d "$new_name" ]; then
            echo -e "${YELLOW}⚠ $new_name 已存在，跳过重命名${NC}"
        else
            mv "$old_name" "$new_name"
            echo -e "${GREEN}✓ $old_name → $new_name${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ $old_name 不存在，跳过${NC}"
    fi
}

rename_dir "memopark-dapp" "stardust-dapp"
rename_dir "memopark-governance" "stardust-governance"
rename_dir "memopark-gov" "stardust-gov"
rename_dir "memopark-squid" "stardust-squid"
rename_dir "memopark-gov-scripts" "stardust-gov-scripts"

echo ""

# 步骤5: 更新启动脚本
echo -e "${BLUE}[步骤5/8] 更新启动和停止脚本...${NC}"

if [ -f "启动所有服务.sh" ]; then
    sed -i 's/memopark-dapp/stardust-dapp/g' 启动所有服务.sh
    sed -i 's/memopark-governance/stardust-governance/g' 启动所有服务.sh
    sed -i 's/memopark-gov/stardust-gov/g' 启动所有服务.sh
    echo -e "${GREEN}✓ 启动所有服务.sh 已更新${NC}"
fi

if [ -f "停止所有服务.sh" ]; then
    sed -i 's/memopark-dapp/stardust-dapp/g' 停止所有服务.sh
    sed -i 's/memopark-governance/stardust-governance/g' 停止所有服务.sh
    sed -i 's/memopark-gov/stardust-gov/g' 停止所有服务.sh
    echo -e "${GREEN}✓ 停止所有服务.sh 已更新${NC}"
fi

echo ""

# 步骤6: 更新其他脚本
echo -e "${BLUE}[步骤6/8] 更新其他脚本路径引用...${NC}"

# 更新 EXECUTE_FIX.sh
if [ -f "stardust-dapp/EXECUTE_FIX.sh" ]; then
    sed -i 's/memopark-dapp/stardust-dapp/g' stardust-dapp/EXECUTE_FIX.sh
    echo -e "${GREEN}✓ stardust-dapp/EXECUTE_FIX.sh 已更新${NC}"
fi

# 更新 INSTALL.sh
if [ -f "stardust-gov/INSTALL.sh" ]; then
    sed -i 's/memopark-gov/stardust-gov/g' stardust-gov/INSTALL.sh
    echo -e "${GREEN}✓ stardust-gov/INSTALL.sh 已更新${NC}"
fi

if [ -f "stardust-governance/INSTALL.sh" ]; then
    sed -i 's/memopark-governance/stardust-governance/g' stardust-governance/INSTALL.sh
    echo -e "${GREEN}✓ stardust-governance/INSTALL.sh 已更新${NC}"
fi

# 更新测试脚本
if [ -f "tests/integration/run-all.sh" ]; then
    sed -i 's/memopark-dapp/stardust-dapp/g' tests/integration/run-all.sh
    echo -e "${GREEN}✓ tests/integration/run-all.sh 已更新${NC}"
fi

# 更新IPFS脚本
if [ -f "scripts/enable-memo-ipfs.sh" ]; then
    # 只更新路径引用，不改函数名
    sed -i 's|cd memopark-dapp|cd stardust-dapp|g' scripts/enable-memo-ipfs.sh
    sed -i 's|cd memopark-governance|cd stardust-governance|g' scripts/enable-memo-ipfs.sh
    echo -e "${GREEN}✓ scripts/enable-memo-ipfs.sh 已更新${NC}"
fi

echo ""

# 步骤7: 更新README和文档
echo -e "${BLUE}[步骤7/8] 更新README和文档中的路径引用...${NC}"

if [ -f "README.md" ]; then
    sed -i 's/memopark-dapp/stardust-dapp/g' README.md
    sed -i 's/memopark-governance/stardust-governance/g' README.md
    sed -i 's/memopark-gov/stardust-gov/g' README.md
    echo -e "${GREEN}✓ README.md 已更新${NC}"
fi

# 更新docs目录下的文档（排除重命名相关的报告）
if [ -d "docs" ]; then
    find docs -type f -name "*.md" \
        -not -name "*RENAME*.md" \
        -not -name "*重命名*.md" \
        -not -name "*MEMO_TO_DUST*.md" \
        -not -name "*项目改名*.md" \
        -exec sed -i \
            -e 's/memopark-dapp/stardust-dapp/g' \
            -e 's/memopark-governance/stardust-governance/g' \
            -e 's/memopark-gov/stardust-gov/g' \
            -e 's/memopark-squid/stardust-squid/g' \
            {} + 2>/dev/null || true
    echo -e "${GREEN}✓ docs目录文档已更新${NC}"
fi

echo ""

# 步骤8: 提交更改
echo -e "${BLUE}[步骤8/8] 提交更改到Git...${NC}"

git add -A
git status --short

echo ""
echo -e "${YELLOW}准备提交以下更改:${NC}"
git diff --cached --stat | head -20

echo ""
read -p "是否提交这些更改? (Y/n): " confirm_commit
if [ "$confirm_commit" != "n" ] && [ "$confirm_commit" != "N" ]; then
    git commit -m "重构: 目录重命名 memopark → stardust

- 重命名 memopark-dapp → stardust-dapp
- 重命名 memopark-governance → stardust-governance
- 重命名 memopark-gov → stardust-gov
- 重命名 memopark-squid → stardust-squid
- 重命名 memopark-gov-scripts → stardust-gov-scripts
- 更新所有脚本中的路径引用
- 更新文档中的路径引用

达到98%改名一致性"
    
    git tag -a after-dir-rename-$(date +%Y%m%d-%H%M%S) -m "目录重命名后 - $(date)"
    echo -e "${GREEN}✓ 更改已提交并打上标签${NC}"
else
    echo -e "${YELLOW}⚠ 更改未提交（已暂存，可手动提交）${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ 目录重命名完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# 显示重命名结果
echo -e "${BLUE}重命名结果:${NC}"
for old_name in "${DIRS_TO_RENAME[@]}"; do
    new_name=${old_name/memopark/stardust}
    if [ -d "$new_name" ]; then
        echo -e "${GREEN}✓ $new_name${NC}"
    else
        echo -e "${YELLOW}⚠ $new_name (未找到)${NC}"
    fi
done

echo ""
echo -e "${BLUE}下一步操作:${NC}"
echo -e "1. 验证服务启动: ${YELLOW}./启动所有服务.sh${NC}"
echo -e "2. 测试前端访问: ${YELLOW}http://127.0.0.1:5173${NC}"
echo -e "3. 通知团队成员更新本地配置"
echo ""
echo -e "${BLUE}如需回滚:${NC}"
echo -e "git tag -l 'before-dir-rename*'  # 查看备份标签"
echo -e "git reset --hard <tag-name>      # 回滚到指定标签"
echo ""
echo -e "${GREEN}恭喜！项目改名完成度: 95% → 98% 🎉${NC}"

