#!/bin/bash
# 🔄 前端项目重命名脚本 (memopark → stardust)
# 作者: AI Assistant
# 日期: 2025-10-29
# 用途: 批量重命名前端项目目录和更新相关配置

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
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

# 打印标题
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
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

# 检查当前目录
check_directory() {
    if [ ! -d "/home/xiaodong/文档/memopark" ]; then
        print_error "错误：项目目录不存在"
        exit 1
    fi
    cd /home/xiaodong/文档/memopark
    print_success "当前目录: $(pwd)"
}

# 创建备份
create_backup() {
    print_header "阶段1: 创建备份"
    
    print_info "创建Git提交备份..."
    git add -A
    git commit -m "Checkpoint: 前端重命名前备份" || print_warning "没有需要提交的更改"
    
    print_info "创建Git标签..."
    git tag -a before-frontend-rename -m "备份点: 前端重命名之前" || print_warning "标签可能已存在"
    
    print_success "备份创建完成"
}

# 阶段6.1: 重命名前端目录
rename_frontend_directories() {
    print_header "阶段6.1: 重命名前端目录"
    
    print_info "准备重命名4个前端项目目录..."
    echo "  memopark-dapp        → stardust-dapp"
    echo "  memopark-governance  → stardust-governance"
    echo "  memopark-gov         → stardust-gov"
    echo "  memopark-gov-scripts → stardust-gov-scripts"
    echo ""
    
    confirm_action
    
    # 重命名目录
    if [ -d "memopark-dapp" ]; then
        mv memopark-dapp stardust-dapp
        print_success "重命名: memopark-dapp → stardust-dapp"
    else
        print_warning "目录不存在: memopark-dapp"
    fi
    
    if [ -d "memopark-governance" ]; then
        mv memopark-governance stardust-governance
        print_success "重命名: memopark-governance → stardust-governance"
    else
        print_warning "目录不存在: memopark-governance"
    fi
    
    if [ -d "memopark-gov" ]; then
        mv memopark-gov stardust-gov
        print_success "重命名: memopark-gov → stardust-gov"
    else
        print_warning "目录不存在: memopark-gov"
    fi
    
    if [ -d "memopark-gov-scripts" ]; then
        mv memopark-gov-scripts stardust-gov-scripts
        print_success "重命名: memopark-gov-scripts → stardust-gov-scripts"
    else
        print_warning "目录不存在: memopark-gov-scripts"
    fi
    
    print_success "目录重命名完成"
}

# 阶段6.2: 更新package.json
update_package_json() {
    print_header "阶段6.2: 更新package.json"
    
    print_info "更新stardust-dapp/package.json..."
    if [ -f "stardust-dapp/package.json" ]; then
        sed -i 's/"memopark-dapp"/"stardust-dapp"/g' stardust-dapp/package.json
        sed -i 's/Memopark DApp/Stardust DApp/g' stardust-dapp/package.json
        sed -i 's/Memopark/Stardust/g' stardust-dapp/package.json
        print_success "stardust-dapp/package.json 已更新"
    fi
    
    print_info "更新stardust-governance/package.json..."
    if [ -f "stardust-governance/package.json" ]; then
        sed -i 's/"memopark-governance"/"stardust-governance"/g' stardust-governance/package.json
        sed -i 's/Memopark/Stardust/g' stardust-governance/package.json
        print_success "stardust-governance/package.json 已更新"
    fi
    
    print_info "更新stardust-gov/package.json..."
    if [ -f "stardust-gov/package.json" ]; then
        sed -i 's/"memopark-gov"/"stardust-gov"/g' stardust-gov/package.json
        sed -i 's/Memopark/Stardust/g' stardust-gov/package.json
        print_success "stardust-gov/package.json 已更新"
    fi
    
    print_info "更新stardust-gov-scripts/package.json..."
    if [ -f "stardust-gov-scripts/package.json" ]; then
        sed -i 's/"memopark-gov-scripts"/"stardust-gov-scripts"/g' stardust-gov-scripts/package.json
        sed -i 's/Memopark/Stardust/g' stardust-gov-scripts/package.json
        print_success "stardust-gov-scripts/package.json 已更新"
    fi
    
    print_success "所有package.json已更新"
}

# 阶段6.3: 更新index.html
update_index_html() {
    print_header "阶段6.3: 更新index.html"
    
    print_info "更新stardust-dapp/index.html..."
    if [ -f "stardust-dapp/index.html" ]; then
        sed -i 's/<title>Memopark<\/title>/<title>Stardust<\/title>/g' stardust-dapp/index.html
        sed -i 's/Memopark/Stardust/g' stardust-dapp/index.html
        print_success "stardust-dapp/index.html 已更新"
    fi
    
    print_info "更新stardust-governance/index.html..."
    if [ -f "stardust-governance/index.html" ]; then
        sed -i 's/<title>Memopark<\/title>/<title>Stardust<\/title>/g' stardust-governance/index.html
        sed -i 's/Memopark/Stardust/g' stardust-governance/index.html
        print_success "stardust-governance/index.html 已更新"
    fi
    
    print_info "更新stardust-gov/index.html..."
    if [ -f "stardust-gov/index.html" ]; then
        sed -i 's/<title>Memopark<\/title>/<title>Stardust<\/title>/g' stardust-gov/index.html
        sed -i 's/Memopark/Stardust/g' stardust-gov/index.html
        print_success "stardust-gov/index.html 已更新"
    fi
    
    print_success "所有index.html已更新"
}

# 阶段6.4: 批量替换前端代码中的显示文本
update_frontend_code() {
    print_header "阶段6.4: 更新前端代码显示文本"
    
    print_warning "注意：这将批量替换UI显示文本中的项目名称和代币名称"
    print_warning "API变量名会保持不变（如memoAmount）以避免破坏性更改"
    echo ""
    confirm_action
    
    # stardust-dapp
    print_info "更新stardust-dapp源代码..."
    if [ -d "stardust-dapp/src" ]; then
        find stardust-dapp/src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/纪念园/星尘宇宙/g'
        find stardust-dapp/src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO代币/DUST代币/g'
        # 注意：保留API变量名（如memoAmount）不变
        print_success "stardust-dapp源代码已更新"
    fi
    
    # stardust-governance
    print_info "更新stardust-governance源代码..."
    if [ -d "stardust-governance/src" ]; then
        find stardust-governance/src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/Memopark/Stardust/g'
        find stardust-governance/src -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/MEMO/DUST/g'
        print_success "stardust-governance源代码已更新"
    fi
    
    print_success "前端代码更新完成"
}

# 阶段6.5: 更新README文件
update_readme_files() {
    print_header "阶段6.5: 更新README文件"
    
    print_info "批量更新所有README.md..."
    find stardust-dapp stardust-governance stardust-gov stardust-gov-scripts -name "README.md" 2>/dev/null | while read file; do
        sed -i 's/Memopark/Stardust/g' "$file"
        sed -i 's/memopark/stardust/g' "$file"
        sed -i 's/MEMO/DUST/g' "$file"
        print_success "已更新: $file"
    done
    
    print_success "所有README文件已更新"
}

# 提交更改
commit_changes() {
    print_header "提交前端重命名更改"
    
    print_info "添加所有更改到Git..."
    git add -A
    
    print_info "提交更改..."
    git commit -m "阶段6完成: 前端项目重命名 (memopark→stardust)"
    
    print_success "前端重命名已提交"
}

# 验证更改
verify_changes() {
    print_header "验证更改"
    
    print_info "检查重命名的目录..."
    [ -d "stardust-dapp" ] && print_success "✓ stardust-dapp 存在" || print_error "✗ stardust-dapp 不存在"
    [ -d "stardust-governance" ] && print_success "✓ stardust-governance 存在" || print_warning "✗ stardust-governance 不存在"
    [ -d "stardust-gov" ] && print_success "✓ stardust-gov 存在" || print_warning "✗ stardust-gov 不存在"
    [ -d "stardust-gov-scripts" ] && print_success "✓ stardust-gov-scripts 存在" || print_warning "✗ stardust-gov-scripts 不存在"
    
    print_info "检查旧目录是否还存在..."
    [ ! -d "memopark-dapp" ] && print_success "✓ memopark-dapp 已删除" || print_warning "✗ memopark-dapp 仍存在"
    [ ! -d "memopark-governance" ] && print_success "✓ memopark-governance 已删除" || print_warning "✗ memopark-governance 仍存在"
    
    print_success "验证完成"
}

# 主函数
main() {
    print_header "🔄 前端项目重命名脚本"
    echo "此脚本将执行以下操作："
    echo "  1. 创建Git备份"
    echo "  2. 重命名4个前端项目目录"
    echo "  3. 更新package.json"
    echo "  4. 更新index.html"
    echo "  5. 批量替换前端代码显示文本"
    echo "  6. 更新README文件"
    echo "  7. 提交更改"
    echo "  8. 验证更改"
    echo ""
    print_warning "重要提示："
    echo "  - 此操作会修改大量文件"
    echo "  - 建议在执行前确保已有完整备份"
    echo "  - 可以随时按Ctrl+C取消"
    echo ""
    
    confirm_action
    
    check_directory
    create_backup
    rename_frontend_directories
    update_package_json
    update_index_html
    update_frontend_code
    update_readme_files
    commit_changes
    verify_changes
    
    print_header "🎉 前端重命名完成"
    print_success "所有前端项目已成功重命名为stardust"
    echo ""
    print_info "下一步："
    echo "  1. 运行 npm install 重新安装依赖"
    echo "  2. 运行 npm run build 验证前端编译"
    echo "  3. 继续执行后续重命名阶段"
    echo ""
    print_info "如需回滚，执行："
    echo "  git reset --hard before-frontend-rename"
}

# 执行主函数
main

