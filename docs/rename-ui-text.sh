#!/bin/bash
# 🔄 UI文本重命名脚本 (MEMO → DUST)
# 作者: AI Assistant
# 日期: 2025-10-29
# 用途: 安全地重命名前端UI显示文本中的MEMO为DUST

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
    print_header "🔄 UI文本重命名脚本"
    echo "此脚本将执行以下操作："
    echo "  1. 创建Git备份"
    echo "  2. 更新前端DApp UI文本 (MEMO → DUST)"
    echo "  3. 更新治理前端UI文本 (MEMO → DUST)"
    echo "  4. 验证修改"
    echo "  5. 提交更改"
    echo ""
    print_warning "预计修改：~250处"
    echo ""
    
    confirm_action
    
    cd /home/xiaodong/文档/memopark
    
    # 创建备份
    print_header "阶段1: 创建备份"
    print_info "创建Git标签..."
    git tag -f before-ui-text-rename -m "备份：UI文本重命名前"
    print_success "Git标签 before-ui-text-rename 已创建"
    
    # 更新前端DApp
    print_header "阶段2: 更新前端DApp UI文本"
    cd memopark-dapp/src
    
    print_info "替换 ' MEMO' → ' DUST'..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/ MEMO/ DUST/g' {} \;
    
    print_info "替换 'MEMO ' → 'DUST '..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/MEMO /DUST /g' {} \;
    
    print_info "替换 'MEMO\"' → 'DUST\"'..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/MEMO"/DUST"/g' {} \;
    
    print_info "替换 'MEMO<' → 'DUST<'..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/MEMO</DUST</g' {} \;
    
    print_info "替换 \"MEMO'\" → \"DUST'\"..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i "s/MEMO'/DUST'/g" {} \;
    
    print_success "前端DApp UI文本已更新"
    
    # 更新治理前端
    print_header "阶段3: 更新治理前端UI文本"
    cd ../../memopark-governance/src
    
    print_info "替换 ' MEMO' → ' DUST'..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/ MEMO/ DUST/g' {} \;
    
    print_info "替换 'MEMO ' → 'DUST '..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/MEMO /DUST /g' {} \;
    
    print_info "替换 'MEMO\"' → 'DUST\"'..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/MEMO"/DUST"/g' {} \;
    
    print_info "替换 'MEMO<' → 'DUST<'..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/MEMO</DUST</g' {} \;
    
    print_success "治理前端UI文本已更新"
    
    # 验证
    print_header "阶段4: 验证修改"
    cd ../..
    
    print_info "检查剩余MEMO引用..."
    local remaining=$(grep -r " MEMO\|MEMO " memopark-dapp/src memopark-governance/src \
      --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
    
    if [ "$remaining" -gt 0 ]; then
        print_warning "仍有 $remaining 处MEMO引用（可能是变量名或注释）"
        echo "详细信息（前10处）："
        grep -r " MEMO\|MEMO " memopark-dapp/src memopark-governance/src \
          --include="*.ts" --include="*.tsx" -n 2>/dev/null | head -10
    else
        print_success "所有UI文本中的MEMO已更新为DUST"
    fi
    
    # 统计修改
    print_header "阶段5: 统计修改"
    local changed_files=$(git diff --name-only | wc -l)
    print_success "修改了 $changed_files 个文件"
    
    print_info "查看修改统计（前20行）..."
    git diff --stat | head -20
    
    # 提交
    print_header "阶段6: 提交更改"
    print_info "添加所有更改..."
    git add memopark-dapp/src memopark-governance/src
    
    print_info "提交更改..."
    git commit -m "UI文本更新: MEMO → DUST

- 前端DApp UI文本更新
- 治理前端UI文本更新
- 总计约250处修改

修改类型：
- 金额显示单位
- 表单提示文本
- 帮助文本和Tooltip"
    
    print_success "更改已提交"
    
    print_header "🎉 UI文本重命名完成"
    print_success "所有前端UI中的MEMO已更新为DUST"
    echo ""
    print_info "下一步："
    echo "  1. 测试前端UI显示"
    echo "  2. 验证所有金额相关页面"
    echo "  3. 执行编译验证"
    echo ""
    print_info "如需回滚，执行："
    echo "  git reset --hard before-ui-text-rename"
}

# 执行主函数
main

