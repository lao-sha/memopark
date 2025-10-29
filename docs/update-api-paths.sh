#!/bin/bash
# 🔄 API路径更新脚本 (memoAppeals → stardustAppeals)
# 作者: AI Assistant
# 日期: 2025-10-29
# 用途: 更新前端代码中的链上API查询路径
# ⚠️  前提：链端pallet已重命名完成并验证可用

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

# 严格确认
strict_confirm() {
    echo ""
    print_warning "⚠️⚠️⚠️  重要警告  ⚠️⚠️⚠️"
    echo ""
    echo -e "${RED}此脚本会修改API查询路径，必须满足以下前提：${NC}"
    echo ""
    echo "  ✓ 链端pallet-memo-appeals已重命名为pallet-stardust-appeals"
    echo "  ✓ 链端已重新编译并启动"
    echo "  ✓ 已手动测试新API路径可用："
    echo "    api.query.stardustAppeals.appeals(1)"
    echo ""
    print_error "如果链端未就绪，执行此脚本会导致前端无法查询数据！"
    echo ""
    read -p "$(echo -e ${YELLOW}确认所有前提条件已满足？[yes/NO]: ${NC})" response
    
    if [ "$response" != "yes" ]; then
        print_warning "操作已取消"
        echo ""
        print_info "建议："
        echo "  1. 先在链端确认pallet名称"
        echo "  2. 使用Polkadot.js Apps测试API"
        echo "  3. 确认可用后再执行此脚本"
        exit 1
    fi
}

# 检查目录
check_directory() {
    if [ ! -d "/home/xiaodong/文档/memopark/stardust-governance" ]; then
        print_error "错误：stardust-governance目录不存在"
        print_info "提示：请先执行前端目录重命名"
        exit 1
    fi
    
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
    git commit -m "Checkpoint: API路径更新前备份" || print_warning "没有需要提交的更改"
    
    print_info "创建Git标签..."
    git tag -a before-api-path-update -m "备份点: API路径更新之前" || print_warning "标签可能已存在"
    
    print_success "备份创建完成"
}

# 更新治理前端API路径
update_governance_api() {
    print_header "阶段2: 更新治理前端API路径"
    
    cd /home/xiaodong/文档/memopark/stardust-governance/src
    
    print_info "扫描需要修改的文件..."
    local files=$(grep -r "memoAppeals\|memoContentGovernance" . --include="*.ts" --include="*.tsx" -l 2>/dev/null || true)
    
    if [ -z "$files" ]; then
        print_warning "未找到需要修改的文件"
        return
    fi
    
    echo "$files" | while read file; do
        echo "  - $file"
    done
    echo ""
    
    print_info "开始更新..."
    
    # memoAppeals → stardustAppeals
    print_info "更新 memoAppeals → stardustAppeals..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/\.memoAppeals/.stardustAppeals/g' {} \;
    
    # memoContentGovernance → stardustAppeals (如果有)
    print_info "更新 memoContentGovernance → stardustAppeals..."
    find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
      -exec sed -i 's/\.memoContentGovernance/.stardustAppeals/g' {} \;
    
    print_success "治理前端API路径已更新"
}

# 更新主前端价格API
update_dapp_pricing_api() {
    print_header "阶段3: 更新主前端价格API"
    
    cd /home/xiaodong/文档/memopark/stardust-dapp/src
    
    print_info "检查是否需要更新价格API..."
    local has_price_api=$(grep -r "getMemoMarketPriceWeighted" . --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    if [ -z "$has_price_api" ]; then
        print_warning "未找到getMemoMarketPriceWeighted，可能已更新或不存在"
        return
    fi
    
    print_info "找到价格API引用："
    echo "$has_price_api" | head -5
    echo ""
    
    print_warning "注意：需要确认链端pricing pallet是否重命名了此函数"
    read -p "$(echo -e ${YELLOW}确认要更新价格API？[y/N]: ${NC})" -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "更新 getMemoMarketPriceWeighted → getDustMarketPriceWeighted..."
        find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" \
          -exec sed -i 's/getMemoMarketPriceWeighted/getDustMarketPriceWeighted/g' {} \;
        print_success "价格API已更新"
    else
        print_warning "跳过价格API更新"
    fi
}

# 更新主前端其他memo API
update_dapp_other_api() {
    print_header "阶段4: 更新主前端其他API"
    
    cd /home/xiaodong/文档/memopark/stardust-dapp/src
    
    print_info "检查其他memo相关API..."
    
    # 检查是否有其他memo相关的API调用
    local other_apis=$(grep -r "\.memo[A-Z][a-zA-Z]*" . --include="*.ts" --include="*.tsx" | \
      grep -E "api\.query\.|api\.tx\." | \
      grep -v "\.memoAmount" | \
      grep -v "\.memoReceive" | \
      head -10 || true)
    
    if [ -z "$other_apis" ]; then
        print_success "未发现其他需要更新的API"
        return
    fi
    
    print_warning "发现其他可能需要更新的API："
    echo "$other_apis"
    echo ""
    print_info "请手动检查这些API是否需要更新"
}

# 验证修改
verify_changes() {
    print_header "阶段5: 验证修改"
    
    cd /home/xiaodong/文档/memopark
    
    print_info "检查是否还有遗漏的memoAppeals..."
    local remaining=$(grep -r "\.memoAppeals\|\.memoContentGovernance" \
      stardust-governance/src stardust-dapp/src \
      --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    if [ -n "$remaining" ]; then
        print_warning "发现未更新的引用："
        echo "$remaining"
        echo ""
        print_info "这可能是正常的（如注释中的引用），请手动检查"
    else
        print_success "所有API路径已更新"
    fi
}

# 统计修改
count_changes() {
    print_header "阶段6: 统计修改"
    
    cd /home/xiaodong/文档/memopark
    
    print_info "统计修改的文件数..."
    local changed_files=$(git diff --name-only | wc -l)
    print_success "修改了 $changed_files 个文件"
    
    print_info "查看主要修改..."
    git diff --stat | head -20
    
    echo ""
    print_info "查看详细修改（前20行）..."
    git diff | grep -A 2 -B 2 "stardustAppeals\|getDustMarketPrice" | head -20
}

# 提交更改
commit_changes() {
    print_header "阶段7: 提交更改"
    
    cd /home/xiaodong/文档/memopark
    
    print_info "是否提交更改？"
    print_warning "建议先手动测试API可用性"
    
    read -p "$(echo -e ${YELLOW}立即提交更改？[y/N]: ${NC})" -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "添加所有更改..."
        git add -A
        
        print_info "提交更改..."
        git commit -m "API路径更新: memoAppeals→stardustAppeals, 价格API更新"
        
        print_success "更改已提交"
    else
        print_warning "未提交更改"
        print_info "您可以稍后手动提交："
        echo "  git add -A"
        echo "  git commit -m \"API路径更新\""
    fi
}

# 生成测试指南
generate_test_guide() {
    print_header "阶段8: 生成测试指南"
    
    cat > /home/xiaodong/文档/memopark/API-TEST-GUIDE.md << 'EOF'
# 🧪 API路径更新 - 测试指南

**📅 日期**: 2025-10-29  
**🎯 目标**: 验证新的API路径是否正常工作

---

## 🔍 测试前检查

### 1. 链端确认
```bash
# 确认节点正在运行
ps aux | grep stardust-node

# 确认WebSocket端口
netstat -an | grep 9944
```

### 2. 使用Polkadot.js Apps测试
1. 打开 https://polkadot.js.org/apps/
2. 连接到本地节点 `ws://127.0.0.1:9944`
3. 测试新API:
   - Developer → Chain State
   - 选择 `stardustAppeals`
   - 调用 `appeals(id)` 查看是否正常

---

## 📋 前端功能测试清单

### 治理前端测试

#### 测试1: 申诉列表查询
- [ ] 打开治理前端
- [ ] 进入"申诉管理"页面
- [ ] 确认申诉列表正常加载
- [ ] 检查控制台无API错误

#### 测试2: 申诉详情查询
- [ ] 点击任意申诉项
- [ ] 确认详情页正常显示
- [ ] 验证所有字段正确

#### 测试3: 按状态筛选
- [ ] 使用状态筛选器
- [ ] 确认筛选结果正确
- [ ] 检查API调用正常

### 主前端测试

#### 测试4: 价格查询
- [ ] 打开OTC订单页面
- [ ] 确认市场价格正常显示
- [ ] 创建订单时价格计算正确

#### 测试5: 桥接功能
- [ ] 打开Bridge页面
- [ ] 确认价格显示正常
- [ ] 计算预估金额正确

---

## 🚨 常见问题排查

### 问题1: API调用失败
**症状**: 控制台显示 `query.stardustAppeals is undefined`

**解决**:
```typescript
// 检查链端pallet名称是否正确
// 可能仍然是 memoAppeals，需要回滚
git reset --hard before-api-path-update
```

### 问题2: 价格API不存在
**症状**: `getDustMarketPriceWeighted is not a function`

**解决**:
```bash
# 回滚价格API修改
cd stardust-dapp/src
git checkout -- features/monitoring/PriceDashboard.tsx
git checkout -- features/otc/CreateListingForm.tsx
```

### 问题3: 部分功能正常,部分失败
**原因**: 可能有遗漏的API路径未更新

**排查**:
```bash
# 搜索剩余的memoAppeals引用
cd stardust-governance/src
grep -r "memoAppeals" . --include="*.ts" --include="*.tsx"
```

---

## ✅ 测试通过标准

- [ ] 所有申诉查询功能正常
- [ ] 价格显示正确
- [ ] 无API错误
- [ ] 无控制台警告
- [ ] 所有交易流程正常

---

## 🔄 回滚步骤（如果测试失败）

```bash
cd /home/xiaodong/文档/memopark

# 回滚所有API路径修改
git reset --hard before-api-path-update

# 验证回滚成功
git log --oneline -3

# 重新启动前端
cd stardust-dapp
npm run dev
```

---

**📝 测试记录**:
- 测试人员: __________
- 测试时间: __________
- 测试结果: [ ] 通过 / [ ] 失败
- 问题描述: __________
EOF

    print_success "测试指南已生成: API-TEST-GUIDE.md"
}

# 主函数
main() {
    print_header "🔄 API路径更新脚本"
    echo "此脚本将执行以下操作："
    echo "  1. 创建Git备份"
    echo "  2. 更新治理前端API路径 (memoAppeals → stardustAppeals)"
    echo "  3. 更新主前端价格API (可选)"
    echo "  4. 检查其他需要更新的API"
    echo "  5. 验证修改"
    echo "  6. 统计修改"
    echo "  7. 提交更改（可选）"
    echo "  8. 生成测试指南"
    echo ""
    
    strict_confirm
    check_directory
    create_backup
    update_governance_api
    update_dapp_pricing_api
    update_dapp_other_api
    verify_changes
    count_changes
    commit_changes
    generate_test_guide
    
    print_header "🎉 API路径更新完成"
    print_success "前端API路径已更新"
    echo ""
    print_warning "⚠️  重要：立即进行功能测试"
    print_info "测试指南: API-TEST-GUIDE.md"
    echo ""
    print_info "测试步骤："
    echo "  1. 启动链端节点"
    echo "  2. 启动前端"
    echo "  3. 测试所有涉及API的功能"
    echo "  4. 查看控制台是否有错误"
    echo ""
    print_info "如果测试失败，立即回滚："
    echo "  git reset --hard before-api-path-update"
}

# 执行主函数
main

