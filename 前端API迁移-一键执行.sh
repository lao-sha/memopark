#!/bin/bash

# ============================================================
# 前端API迁移执行脚本：OTC Order → Trading
# ============================================================
# 📅 创建日期: 2025-10-29
# 🎯 目标: 自动化迁移前端API引用
# ⏱️ 预计时间: 5-10分钟
# ============================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="/home/xiaodong/文档/stardust"
FRONTEND_DIR="$PROJECT_ROOT/stardust-dapp"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 显示脚本头部
echo "============================================================"
echo "  🚀 前端API迁移：OTC Order → Trading"
echo "============================================================"
echo ""
echo "📦 迁移范围："
echo "   - Query API: api.query.otcOrder.* → api.query.trading.*"
echo "   - TX API: api.tx.otcOrder.* → api.tx.trading.*"
echo "   - Event API: api.events.otcOrder.* → api.events.trading.*"
echo ""
echo "⚠️  关键函数名变化："
echo "   - markOrderPaid → markPaid"
echo "   - releaseOrder → releaseDust"
echo "   - claimFreeMemo → claimFreeDust"
echo ""
echo "============================================================"
echo ""

# 确认继续
read -p "$(echo -e ${YELLOW}是否继续执行迁移？[y/N]:${NC} )" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warning "迁移已取消"
    exit 0
fi

echo ""
log_info "开始执行迁移..."
echo ""

# ============================================================
# 第1步：创建Git备份
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  第1步：创建Git备份"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_ROOT"

log_info "保存当前工作区状态..."
git add . 2>/dev/null || true
git commit -m "保存当前状态 - OTC API 迁移前 $(date)" 2>/dev/null || log_warning "没有需要提交的更改"

BACKUP_TAG="before-otc-api-migration-$(date +%Y%m%d-%H%M%S)"
log_info "创建备份标签: $BACKUP_TAG"
git tag -a "$BACKUP_TAG" -m "OTC API 迁移前备份 - $(date)" 2>/dev/null || log_warning "标签可能已存在"

log_success "Git备份完成"
echo ""
sleep 1

# ============================================================
# 第2步：统计待迁移文件
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  第2步：统计待迁移文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$FRONTEND_DIR/src"

log_info "扫描 otcOrder API 引用..."

# 统计各类API引用
QUERY_COUNT=$(grep -r "api\.query\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
TX_COUNT=$(grep -r "api\.tx\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
EVENT_COUNT=$(grep -r "api\.events\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
TOTAL_COUNT=$((QUERY_COUNT + TX_COUNT + EVENT_COUNT))

echo "   Query API: $QUERY_COUNT 处"
echo "   TX API: $TX_COUNT 处"
echo "   Event API: $EVENT_COUNT 处"
echo "   ────────────────"
echo "   总计: $TOTAL_COUNT 处"
echo ""

if [ "$TOTAL_COUNT" -eq 0 ]; then
    log_success "没有找到需要迁移的API引用，可能已经迁移完成"
    exit 0
fi

log_info "找到 $TOTAL_COUNT 处需要迁移的API引用"
echo ""
sleep 1

# ============================================================
# 第3步：执行API替换
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  第3步：执行API替换"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 3.1 替换 Query API
log_info "替换 Query API (api.query.otcOrder.* → api.query.trading.*)"
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.otcOrder\./api.query.trading./g' {} +

# 验证
REMAINING_QUERY=$(grep -r "api\.query\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
if [ "$REMAINING_QUERY" -eq 0 ]; then
    log_success "Query API 替换完成 ($QUERY_COUNT → 0)"
else
    log_warning "Query API 还有 $REMAINING_QUERY 处未替换"
fi
echo ""
sleep 1

# 3.2 替换 Transaction API (通用函数)
log_info "替换 TX API (通用函数)..."
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/api\.tx\.otcOrder\.createOrder/api.tx.trading.createOrder/g' \
  -e 's/api\.tx\.otcOrder\.cancelOrder/api.tx.trading.cancelOrder/g' \
  -e 's/api\.tx\.otcOrder\.disputeOrder/api.tx.trading.disputeOrder/g' \
  -e 's/api\.tx\.otcOrder\.createFirstPurchase/api.tx.trading.createFirstPurchase/g' \
  {} +
log_success "通用 TX API 替换完成"
echo ""
sleep 1

# 3.3 替换有名称变化的函数
log_info "替换 TX API (函数名变化)..."

# markOrderPaid → markPaid
log_info "  • markOrderPaid → markPaid"
MARK_PAID_BEFORE=$(grep -r "api\.tx\.otcOrder\.markOrderPaid" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.tx\.otcOrder\.markOrderPaid/api.tx.trading.markPaid/g' {} +
MARK_PAID_AFTER=$(grep -r "api\.tx\.otcOrder\.markOrderPaid" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
log_success "    替换 $MARK_PAID_BEFORE 处 → 剩余 $MARK_PAID_AFTER 处"

# releaseOrder → releaseDust
log_info "  • releaseOrder → releaseDust"
RELEASE_BEFORE=$(grep -r "api\.tx\.otcOrder\.releaseOrder" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.tx\.otcOrder\.releaseOrder/api.tx.trading.releaseDust/g' {} +
RELEASE_AFTER=$(grep -r "api\.tx\.otcOrder\.releaseOrder" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
log_success "    替换 $RELEASE_BEFORE 处 → 剩余 $RELEASE_AFTER 处"

# claimFreeMemo → claimFreeDust
log_info "  • claimFreeMemo → claimFreeDust"
CLAIM_BEFORE=$(grep -r "api\.tx\.otcOrder\.claimFreeMemo" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.tx\.otcOrder\.claimFreeMemo/api.tx.trading.claimFreeDust/g' {} +
CLAIM_AFTER=$(grep -r "api\.tx\.otcOrder\.claimFreeMemo" . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
log_success "    替换 $CLAIM_BEFORE 处 → 剩余 $CLAIM_AFTER 处"

echo ""
sleep 1

# 3.4 替换 Event API
log_info "替换 Event API (api.events.otcOrder.* → api.events.trading.*)"
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.events\.otcOrder\./api.events.trading./g' {} +

REMAINING_EVENT=$(grep -r "api\.events\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
if [ "$REMAINING_EVENT" -eq 0 ]; then
    log_success "Event API 替换完成 ($EVENT_COUNT → 0)"
else
    log_warning "Event API 还有 $REMAINING_EVENT 处未替换"
fi
echo ""
sleep 1

# ============================================================
# 第4步：验证替换结果
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  第4步：验证替换结果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

log_info "检查残留的 otcOrder API 引用..."

FINAL_QUERY=$(grep -r "api\.query\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
FINAL_TX=$(grep -r "api\.tx\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
FINAL_EVENT=$(grep -r "api\.events\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
FINAL_TOTAL=$((FINAL_QUERY + FINAL_TX + FINAL_EVENT))

echo "   Query API 残留: $FINAL_QUERY 处"
echo "   TX API 残留: $FINAL_TX 处"
echo "   Event API 残留: $FINAL_EVENT 处"
echo "   ────────────────"
echo "   总计残留: $FINAL_TOTAL 处"
echo ""

if [ "$FINAL_TOTAL" -eq 0 ]; then
    log_success "✅ 所有 API 引用已完全迁移！"
else
    log_warning "⚠️ 还有 $FINAL_TOTAL 处 API 引用需要手动检查"
    echo ""
    log_info "残留引用详情："
    grep -rn "api\.\(query\|tx\|events\)\.otcOrder\." . --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
fi

echo ""
sleep 1

# ============================================================
# 第5步：检查修改的文件
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  第5步：检查修改的文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_ROOT"

log_info "查看修改的文件..."
MODIFIED_FILES=$(git diff --name-only stardust-dapp/src | wc -l)

if [ "$MODIFIED_FILES" -eq 0 ]; then
    log_warning "没有检测到文件修改"
else
    echo "修改的文件 ($MODIFIED_FILES 个):"
    git diff --name-only stardust-dapp/src | head -20
    
    if [ "$MODIFIED_FILES" -gt 20 ]; then
        echo "... 还有 $((MODIFIED_FILES - 20)) 个文件"
    fi
fi

echo ""
sleep 1

# ============================================================
# 第6步：编译验证
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  第6步：编译验证（可选）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "$(echo -e ${YELLOW}是否执行编译验证？[y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$FRONTEND_DIR"
    
    log_info "清除缓存..."
    rm -rf node_modules/.vite 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    
    log_info "开始编译..."
    if npm run build 2>&1 | tee /tmp/otc-api-migration-build.log; then
        log_success "✅ 编译成功！"
    else
        log_error "❌ 编译失败，请检查日志: /tmp/otc-api-migration-build.log"
        echo ""
        log_info "最后20行错误信息："
        tail -20 /tmp/otc-api-migration-build.log
        exit 1
    fi
else
    log_warning "跳过编译验证"
fi

echo ""
sleep 1

# ============================================================
# 第7步：提交更改
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  第7步：提交更改"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_ROOT"

read -p "$(echo -e ${YELLOW}是否提交Git更改？[y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "提交更改..."
    
    git add stardust-dapp/
    git commit -m "重构: 前端API迁移 otcOrder → trading

- 迁移所有 query API 到 trading pallet
- 迁移所有 tx API 到 trading pallet  
- 更新函数名: markOrderPaid → markPaid
- 更新函数名: releaseOrder → releaseDust
- 更新函数名: claimFreeMemo → claimFreeDust
- 更新所有 event API 引用

统计数据:
- Query API: $QUERY_COUNT 处
- TX API: $TX_COUNT 处
- Event API: $EVENT_COUNT 处
- 总计: $TOTAL_COUNT 处
- 修改文件: $MODIFIED_FILES 个

Ref: Phase 2 架构整合 - pallet-otc-order 已整合到 pallet-trading
"
    
    AFTER_TAG="after-otc-api-migration-$(date +%Y%m%d-%H%M%S)"
    git tag -a "$AFTER_TAG" -m "OTC API 迁移完成 - $(date)"
    
    log_success "Git提交完成"
    log_info "备份标签: $BACKUP_TAG"
    log_info "完成标签: $AFTER_TAG"
else
    log_warning "跳过Git提交（稍后可手动提交）"
fi

echo ""
sleep 1

# ============================================================
# 完成总结
# ============================================================
echo ""
echo "============================================================"
echo "  ✅ 前端API迁移完成！"
echo "============================================================"
echo ""
echo "📊 迁移统计："
echo "   • 迁移前 API 引用: $TOTAL_COUNT 处"
echo "   • 迁移后 API 残留: $FINAL_TOTAL 处"
echo "   • 修改文件数: $MODIFIED_FILES 个"
echo ""
echo "🔧 下一步操作："
echo "   1. 启动开发环境测试功能"
echo "   2. 执行功能测试清单"
echo "   3. 确认所有 OTC 功能正常"
echo ""
echo "📝 相关文档："
echo "   • 迁移方案: docs/前端API迁移-OtcOrder到Trading.md"
echo "   • 测试清单: docs/前端API迁移-OtcOrder到Trading.md (第5步)"
echo ""
echo "🔙 回滚方案 (如有问题)："
echo "   git reset --hard $BACKUP_TAG"
echo ""
echo "============================================================"
echo ""

log_success "迁移脚本执行完成！"

