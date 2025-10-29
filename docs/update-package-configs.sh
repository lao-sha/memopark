#!/bin/bash
# 🔄 Package配置更新脚本 (memopark → stardust)
# 作者: AI Assistant
# 日期: 2025-10-29
# 用途: 更新各项目的package.json和Cargo.toml配置

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
    print_header "🔄 Package配置更新脚本"
    echo "此脚本将执行以下操作："
    echo "  1. 创建Git备份"
    echo "  2. 更新前端DApp package.json"
    echo "  3. 更新治理前端 package.json"
    echo "  4. 更新根 Cargo.toml"
    echo "  5. 验证修改"
    echo "  6. 提交更改"
    echo ""
    print_warning "⚠️  重要提示："
    echo "  - 此操作会修改package名称"
    echo "  - 可能影响构建流程"
    echo "  - 建议修改后执行编译验证"
    echo ""
    
    confirm_action
    
    cd /home/xiaodong/文档/memopark
    
    # 创建备份
    print_header "阶段1: 创建备份"
    print_info "创建Git标签..."
    git tag -f before-package-rename -m "备份：Package配置更新前"
    print_success "Git标签 before-package-rename 已创建"
    
    # 更新前端DApp package.json
    print_header "阶段2: 更新前端DApp配置"
    
    if [ -f "memopark-dapp/package.json" ]; then
        print_info "备份原文件..."
        cp memopark-dapp/package.json memopark-dapp/package.json.bak
        
        print_info "更新package name..."
        sed -i 's/"name": "memopark-dapp"/"name": "stardust-dapp"/' memopark-dapp/package.json
        
        print_info "更新description..."
        sed -i 's/Memopark DApp/Stardust DApp/' memopark-dapp/package.json
        sed -i 's/memopark DApp/stardust DApp/' memopark-dapp/package.json
        
        print_info "更新repository URL..."
        sed -i 's/memopark\.git/stardust.git/' memopark-dapp/package.json
        
        print_success "前端DApp配置已更新"
    else
        print_warning "未找到 memopark-dapp/package.json"
    fi
    
    # 更新治理前端 package.json
    print_header "阶段3: 更新治理前端配置"
    
    if [ -f "memopark-governance/package.json" ]; then
        print_info "备份原文件..."
        cp memopark-governance/package.json memopark-governance/package.json.bak
        
        print_info "更新package name..."
        sed -i 's/"name": "memopark-governance"/"name": "stardust-governance"/' memopark-governance/package.json
        
        print_info "更新description..."
        sed -i 's/Memopark/Stardust/' memopark-governance/package.json
        sed -i 's/memopark/stardust/' memopark-governance/package.json
        
        print_info "更新repository URL..."
        sed -i 's/memopark\.git/stardust.git/' memopark-governance/package.json
        
        print_success "治理前端配置已更新"
    else
        print_warning "未找到 memopark-governance/package.json"
    fi
    
    # 更新memopark-gov package.json
    if [ -f "memopark-gov/package.json" ]; then
        print_info "更新memopark-gov配置..."
        cp memopark-gov/package.json memopark-gov/package.json.bak
        sed -i 's/"name": "memopark-gov"/"name": "stardust-gov"/' memopark-gov/package.json
        sed -i 's/Memopark/Stardust/' memopark-gov/package.json
        sed -i 's/memopark\.git/stardust.git/' memopark-gov/package.json
        print_success "memopark-gov配置已更新"
    fi
    
    # 更新根 Cargo.toml
    print_header "阶段4: 更新根Cargo.toml"
    
    if [ -f "Cargo.toml" ]; then
        print_info "备份原文件..."
        cp Cargo.toml Cargo.toml.bak
        
        print_info "更新repository URL..."
        sed -i 's|repository = "https://github.com/lao-sha/memopark.git"|repository = "https://github.com/lao-sha/stardust.git"|' Cargo.toml
        
        print_success "根Cargo.toml已更新"
    else
        print_error "未找到 Cargo.toml"
    fi
    
    # 验证修改
    print_header "阶段5: 验证修改"
    
    print_info "检查修改内容..."
    echo ""
    echo "📋 前端DApp package.json:"
    if [ -f "memopark-dapp/package.json" ]; then
        grep -E "\"name\"|\"description\"|\"url\"" memopark-dapp/package.json | head -5
    fi
    
    echo ""
    echo "📋 治理前端 package.json:"
    if [ -f "memopark-governance/package.json" ]; then
        grep -E "\"name\"|\"description\"|\"url\"" memopark-governance/package.json | head -5
    fi
    
    echo ""
    echo "📋 根 Cargo.toml:"
    if [ -f "Cargo.toml" ]; then
        grep "repository" Cargo.toml | head -3
    fi
    
    # 统计修改
    print_header "阶段6: 统计修改"
    local changed_files=$(git diff --name-only | wc -l)
    print_success "修改了 $changed_files 个文件"
    
    print_info "查看修改详情..."
    git diff --stat
    
    # 提交
    print_header "阶段7: 提交更改"
    
    print_info "是否立即提交更改？"
    print_warning "建议先验证配置文件正确性"
    
    read -p "$(echo -e ${YELLOW}立即提交？[y/N]: ${NC})" -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "添加所有更改..."
        git add memopark-dapp/package.json memopark-governance/package.json Cargo.toml
        [ -f "memopark-gov/package.json" ] && git add memopark-gov/package.json
        
        print_info "提交更改..."
        git commit -m "配置更新: memopark → stardust

- 前端DApp package.json
  - name: memopark-dapp → stardust-dapp
  - repository: memopark.git → stardust.git
  
- 治理前端 package.json
  - name: memopark-governance → stardust-governance
  - repository: memopark.git → stardust.git
  
- 根 Cargo.toml
  - repository URL 已更新

注意：
- 编译产物名称将自动更新
- 需要重新运行 npm install（可选）"
        
        print_success "更改已提交"
    else
        print_warning "未提交更改"
        print_info "您可以稍后手动提交："
        echo "  git add <files>"
        echo "  git commit -m \"配置更新\""
    fi
    
    print_header "🎉 Package配置更新完成"
    print_success "所有配置文件已更新"
    echo ""
    print_info "下一步："
    echo "  1. 验证前端编译："
    echo "     cd memopark-dapp && npm run build"
    echo "  2. 验证链端编译："
    echo "     cargo build --release"
    echo "  3. 检查生成的二进制文件名称"
    echo ""
    print_info "备份文件位置："
    echo "  - memopark-dapp/package.json.bak"
    echo "  - memopark-governance/package.json.bak"
    echo "  - Cargo.toml.bak"
    echo ""
    print_info "如需回滚，执行："
    echo "  git reset --hard before-package-rename"
    echo "  或手动恢复备份文件"
}

# 执行主函数
main

