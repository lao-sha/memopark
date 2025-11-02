#!/bin/bash

# ===================================================================
# 前端 Pallet API 调用自动修复脚本
# 
# 功能：批量替换旧 Pallet API 调用为新的整合后 API
# 作者：Stardust 开发团队
# 日期：2025-11-02
# ===================================================================

set -e

echo "════════════════════════════════════════════════════════"
echo "  🔧 Stardust 前端 Pallet API 修复工具"
echo "════════════════════════════════════════════════════════"
echo ""

# 检查是否在正确的目录
if [ ! -d "src" ]; then
    echo "❌ 错误：请在 stardust-dapp 根目录下运行此脚本"
    exit 1
fi

# 备份提示
echo "⚠️  建议：请先提交当前更改或创建备份"
echo ""
read -p "是否继续？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

echo ""
echo "开始修复..."
echo ""

# 统计修复数量
TOTAL_FIXED=0

# ===================================================================
# 1. marketMaker → trading
# ===================================================================
echo "📌 [1/11] 修复 marketMaker → trading..."
COUNT=$(grep -r "api\.query\.marketMaker\|api\.tx\.marketMaker" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.marketMaker/api.query.trading/g; \
         s/api\.tx\.marketMaker/api.tx.trading/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 2. otcOrder → trading
# ===================================================================
echo "📌 [2/11] 修复 otcOrder → trading..."
COUNT=$(grep -r "api\.query\.otcOrder\|api\.tx\.otcOrder" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.otcOrder/api.query.trading/g; \
         s/api\.tx\.otcOrder/api.tx.trading/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 3. simpleBridge → trading
# ===================================================================
echo "📌 [3/11] 修复 simpleBridge → trading..."
COUNT=$(grep -r "api\.query\.simpleBridge\|api\.tx\.simpleBridge" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.simpleBridge/api.query.trading/g; \
         s/api\.tx\.simpleBridge/api.tx.trading/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 4. memoOfferings → memorial
# ===================================================================
echo "📌 [4/11] 修复 memoOfferings → memorial..."
COUNT=$(grep -r "api\.query\.memoOfferings\|api\.tx\.memoOfferings" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.memoOfferings/api.query.memorial/g; \
         s/api\.tx\.memoOfferings/api.tx.memorial/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 5. memoSacrifice → memorial
# ===================================================================
echo "📌 [5/11] 修复 memoSacrifice → memorial..."
COUNT=$(grep -r "api\.query\.memoSacrifice\|api\.tx\.memoSacrifice" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.memoSacrifice/api.query.memorial/g; \
         s/api\.tx\.memoSacrifice/api.tx.memorial/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 6. deceasedMedia → deceased
# ===================================================================
echo "📌 [6/11] 修复 deceasedMedia → deceased..."
COUNT=$(grep -r "api\.query\.deceasedMedia\|api\.tx\.deceasedMedia" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.deceasedMedia/api.query.deceased/g; \
         s/api\.tx\.deceasedMedia/api.tx.deceased/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 7. deceasedText → deceased
# ===================================================================
echo "📌 [7/11] 修复 deceasedText → deceased..."
COUNT=$(grep -r "api\.query\.deceasedText\|api\.tx\.deceasedText" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.deceasedText/api.query.deceased/g; \
         s/api\.tx\.deceasedText/api.tx.deceased/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 8. affiliateWeekly → affiliate
# ===================================================================
echo "📌 [8/11] 修复 affiliateWeekly → affiliate..."
COUNT=$(grep -r "api\.query\.affiliateWeekly\|api\.tx\.affiliateWeekly" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.affiliateWeekly/api.query.affiliate/g; \
         s/api\.tx\.affiliateWeekly/api.tx.affiliate/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 9. affiliateConfig → affiliate
# ===================================================================
echo "📌 [9/11] 修复 affiliateConfig → affiliate..."
COUNT=$(grep -r "api\.query\.affiliateConfig\|api\.tx\.affiliateConfig" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.affiliateConfig/api.query.affiliate/g; \
         s/api\.tx\.affiliateConfig/api.tx.affiliate/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 10. affiliateInstant → affiliate
# ===================================================================
echo "📌 [10/11] 修复 affiliateInstant → affiliate..."
COUNT=$(grep -r "api\.query\.affiliateInstant\|api\.tx\.affiliateInstant" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.affiliateInstant/api.query.affiliate/g; \
         s/api\.tx\.affiliateInstant/api.tx.affiliate/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 11. memoReferrals → stardustReferrals
# ===================================================================
echo "📌 [11/11] 修复 memoReferrals → stardustReferrals..."
COUNT=$(grep -r "api\.query\.memoReferrals\|api\.tx\.memoReferrals" src/ \
    --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$COUNT" -gt 0 ]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
        's/api\.query\.memoReferrals/api.query.stardustReferrals/g; \
         s/api\.tx\.memoReferrals/api.tx.stardustReferrals/g' {} +
    echo "   ✅ 修复 $COUNT 处引用"
    TOTAL_FIXED=$((TOTAL_FIXED + COUNT))
else
    echo "   ✓ 无需修复"
fi

# ===================================================================
# 总结
# ===================================================================
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ 修复完成！"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 修复统计："
echo "   - 总共修复: $TOTAL_FIXED 处引用"
echo ""
echo "📋 后续步骤："
echo "   1. 查看修改: git diff src/"
echo "   2. 测试功能: npm run dev"
echo "   3. 提交更改: git add src/ && git commit -m 'fix: 更新 Pallet API 调用'"
echo ""
echo "⚠️  重要提示："
echo "   - 请手动测试以下关键功能："
echo "     • 做市商申请和审核"
echo "     • OTC 订单创建和管理"
echo "     • 免费配额查询"
echo "     • 桥接服务"
echo "     • 供奉功能"
echo ""

