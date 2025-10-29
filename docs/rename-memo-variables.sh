#!/bin/bash
# 🔄 前端变量重命名脚本 (memo → dust)
# 作者: AI Assistant
# 日期: 2025-10-29
# 用途: 安全地重命名前端代码中的memo相关变量

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 确认操作
confirm_action() {
    read -p "$(echo -e ${YELLOW}是否继续？[y/N]: ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "操作已取消"
        exit 1
    fi
}

# 检查目录
check_directory() {
    if [ ! -d "/home/xiaodong/文档/memopark/stardust-dapp" ]; then
        print_error "错误：stardust-dapp目录不存在"
        print_info "提示：请先执行前端目录重命名"
        exit 1
    fi
}

# 创建备份
create_backup() {
    print_header "阶段1: 创建备份"
    
    cd /home/xiaodong/文档/memopark
    
    print_info "创建Git备份..."
    git add -A
    git commit -m "Checkpoint: 变量重命名前备份" || print_warning "没有需要提交的更改"
    
    print_info "创建Git标签..."
    git tag -a before-variable-rename -m "备份点: 变量重命名之前" || print_warning "标签可能已存在"
    
    print_success "备份创建完成"
}

# 阶段1: 重命名基础变量
rename_basic_variables() {
    print_header "阶段2: 重命名基础变量"
    
    cd /home/xiaodong/文档/memopark/stardust-dapp/src
    
    print_info "开始重命名以下变量："
    echo "  - memoAmount      → dustAmount"
    echo "  - setMemoAmount   → setDustAmount"
    echo "  - memoReceive     → dustReceive"
    echo ""
    
    confirm_action
    
    # memoAmount → dustAmount
    print_info "重命名 memoAmount..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/\bmemoAmount\b/dustAmount/g' {} \;
    print_success "memoAmount → dustAmount 完成"
    
    # setMemoAmount → setDustAmount
    print_info "重命名 setMemoAmount..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/\bsetMemoAmount\b/setDustAmount/g' {} \;
    print_success "setMemoAmount → setDustAmount 完成"
    
    # memoReceive → dustReceive
    print_info "重命名 memoReceive..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/\bmemoReceive\b/dustReceive/g' {} \;
    print_success "memoReceive → dustReceive 完成"
    
    print_success "基础变量重命名完成"
}

# 阶段2: 重命名函数名
rename_functions() {
    print_header "阶段3: 重命名函数名"
    
    cd /home/xiaodong/文档/memopark/stardust-dapp/src
    
    print_info "开始重命名以下函数："
    echo "  - formatMemoAmount → formatDustAmount"
    echo "  - formatMemo       → formatDust"
    echo ""
    
    confirm_action
    
    # formatMemoAmount → formatDustAmount
    print_info "重命名 formatMemoAmount..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/\bformatMemoAmount\b/formatDustAmount/g' {} \;
    print_success "formatMemoAmount → formatDustAmount 完成"
    
    # formatMemo → formatDust (注意：不影响useMemo)
    print_info "重命名 formatMemo..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/\bformatMemo\b/formatDust/g' {} \;
    print_success "formatMemo → formatDust 完成"
    
    print_success "函数名重命名完成"
}

# 验证React Hook未被误改
verify_react_hooks() {
    print_header "阶段4: 验证React Hook"
    
    cd /home/xiaodong/文档/memopark/stardust-dapp/src
    
    print_info "检查useMemo是否被误改为useDust..."
    
    if grep -r "useDust" . --include="*.tsx" --include="*.ts" 2>/dev/null; then
        print_error "错误：React Hook被误改！"
        echo ""
        print_info "请手动修复以下文件中的 useDust → useMemo："
        grep -r "useDust" . --include="*.tsx" --include="*.ts" -l
        exit 1
    else
        print_success "React Hook完好，未被误改"
    fi
    
    print_info "检查其他React Hook..."
    if grep -r "useCallbackDust\|useEffectDust\|useStateDust" . --include="*.tsx" --include="*.ts" 2>/dev/null; then
        print_error "发现其他被误改的React Hook！"
        exit 1
    else
        print_success "所有React Hook正常"
    fi
}

# 统计修改
count_changes() {
    print_header "阶段5: 统计修改"
    
    cd /home/xiaodong/文档/memopark
    
    print_info "统计修改的文件数..."
    local changed_files=$(git diff --name-only | wc -l)
    print_success "修改了 $changed_files 个文件"
    
    print_info "查看主要修改..."
    git diff --stat | head -20
}

# 提交更改
commit_changes() {
    print_header "阶段6: 提交更改"
    
    cd /home/xiaodong/文档/memopark
    
    print_info "添加所有更改..."
    git add -A
    
    print_info "提交更改..."
    git commit -m "变量重命名: memo相关变量改为dust (memoAmount→dustAmount等)"
    
    print_success "更改已提交"
}

# 编译验证
verify_build() {
    print_header "阶段7: 编译验证（可选）"
    
    print_info "是否执行编译验证？"
    print_warning "注意：编译可能需要5-10分钟"
    
    read -p "$(echo -e ${YELLOW}执行编译验证？[y/N]: ${NC})" -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd /home/xiaodong/文档/memopark/stardust-dapp
        
        print_info "执行npm run build..."
        if npm run build; then
            print_success "编译成功！"
        else
            print_error "编译失败，请检查错误信息"
            print_info "可以执行以下命令回滚："
            echo "  git reset --hard before-variable-rename"
            exit 1
        fi
    else
        print_warning "跳过编译验证"
    fi
}

# 主函数
main() {
    print_header "🔄 前端变量重命名脚本"
    echo "此脚本将执行以下操作："
    echo "  1. 创建Git备份"
    echo "  2. 重命名基础变量 (memoAmount等)"
    echo "  3. 重命名函数名 (formatMemoAmount等)"
    echo "  4. 验证React Hook未被误改"
    echo "  5. 统计修改"
    echo "  6. 提交更改"
    echo "  7. 编译验证（可选）"
    echo ""
    print_warning "重要提示："
    echo "  - 此操作会修改大量文件"
    echo "  - 不会修改API路径（需要链端就绪后单独执行）"
    echo "  - 可以随时按Ctrl+C取消"
    echo ""
    
    confirm_action
    
    check_directory
    create_backup
    rename_basic_variables
    rename_functions
    verify_react_hooks
    count_changes
    commit_changes
    verify_build
    
    print_header "🎉 变量重命名完成"
    print_success "所有memo相关变量已重命名为dust"
    echo ""
    print_info "下一步："
    echo "  1. 手动测试关键功能"
    echo "  2. 确认链端API就绪后，执行API路径更新脚本"
    echo "  3. 完整功能测试"
    echo ""
    print_info "如需回滚，执行："
    echo "  git reset --hard before-variable-rename"
}

# 执行主函数
main

