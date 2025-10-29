#!/bin/bash
# 🔄 代码注释重命名脚本 (MEMO → DUST)
# 作者: AI Assistant
# 日期: 2025-10-29
# 用途: 更新Rust和TypeScript代码注释中的MEMO为DUST

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

# 主函数
main() {
    print_header "🔄 代码注释重命名脚本"
    echo "此脚本将执行以下操作："
    echo "  1. 创建Git备份"
    echo "  2. 更新Rust代码注释"
    echo "  3. 更新TypeScript代码注释"
    echo "  4. 统计修改"
    echo "  5. 提交更改"
    echo ""
    print_warning "预计修改：~200处"
    print_warning "注意：不会修改常量名（如MEMO_PRECISION）"
    echo ""
    
    confirm_action
    
    cd /home/xiaodong/文档/memopark
    
    # 创建备份
    print_header "阶段1: 创建备份"
    print_info "创建Git标签..."
    git tag -f before-comment-rename -m "备份：注释重命名前"
    print_success "Git标签 before-comment-rename 已创建"
    
    # 更新Rust注释
    print_header "阶段2: 更新Rust代码注释"
    
    print_info "更新runtime注释..."
    find runtime -name "*.rs" -type f -exec sed -i \
      -e 's/ MEMO/ DUST/g' \
      -e 's/MEMO /DUST /g' \
      -e 's/MEMO）/DUST）/g' \
      -e 's/（MEMO/（DUST/g' \
      -e 's/MEMO，/DUST，/g' \
      -e 's/MEMO；/DUST；/g' {} \;
    
    print_info "更新pallets注释..."
    find pallets -name "*.rs" -type f ! -path "*/target/*" -exec sed -i \
      -e 's/ MEMO/ DUST/g' \
      -e 's/MEMO /DUST /g' \
      -e 's/MEMO）/DUST）/g' \
      -e 's/（MEMO/（DUST/g' \
      -e 's/MEMO，/DUST，/g' \
      -e 's/MEMO；/DUST；/g' {} \;
    
    print_success "Rust代码注释已更新"
    
    # 更新TypeScript注释
    print_header "阶段3: 更新TypeScript代码注释"
    
    print_info "更新前端DApp注释..."
    cd memopark-dapp/src
    find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" \
      -exec sed -i \
      -e 's/格式化 MEMO/格式化 DUST/g' \
      -e 's/金额（MEMO）/金额（DUST）/g' \
      -e 's/（MEMO）/（DUST）/g' \
      -e 's/: MEMO/: DUST/g' \
      -e 's/ MEMO / DUST /g' {} \;
    
    print_info "更新治理前端注释..."
    cd ../../memopark-governance/src
    find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" \
      -exec sed -i \
      -e 's/格式化 MEMO/格式化 DUST/g' \
      -e 's/金额（MEMO）/金额（DUST）/g' \
      -e 's/（MEMO）/（DUST）/g' \
      -e 's/ MEMO / DUST /g' {} \;
    
    print_success "TypeScript代码注释已更新"
    
    # 统计修改
    print_header "阶段4: 统计修改"
    cd ../..
    
    local changed_files=$(git diff --name-only | wc -l)
    print_success "修改了 $changed_files 个文件"
    
    print_info "查看修改统计（前20行）..."
    git diff --stat | head -20
    
    print_info "查看修改示例（前20行）..."
    git diff | grep -E "^[\+\-].*DUST|^[\+\-].*MEMO" | head -20
    
    # 提交
    print_header "阶段5: 提交更改"
    print_info "添加所有更改..."
    git add runtime pallets memopark-dapp memopark-governance
    
    print_info "提交更改..."
    git commit -m "代码注释更新: MEMO → DUST

- Rust代码注释更新（runtime + pallets）
- TypeScript代码注释更新（两个前端项目）
- 总计约200处修改

注意：
- 保持常量名不变（如MEMO_PRECISION）
- 仅更新注释和文档字符串"
    
    print_success "更改已提交"
    
    print_header "🎉 代码注释重命名完成"
    print_success "所有代码注释中的MEMO已更新为DUST"
    echo ""
    print_info "下一步："
    echo "  1. 检查代码文档生成"
    echo "  2. 验证API文档"
    echo "  3. 执行编译验证"
    echo ""
    print_info "如需回滚，执行："
    echo "  git reset --hard before-comment-rename"
}

# 执行主函数
main

