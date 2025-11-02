#!/bin/bash

# ===================================================================
# 前端清理 - 快速验证脚本
# ===================================================================

echo "════════════════════════════════════════════════════════"
echo "  🧪 Stardust 前端清理 - 快速验证"
echo "════════════════════════════════════════════════════════"
echo ""

# 检查服务器状态
echo "📡 检查开发服务器..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200"; then
    echo "   ✅ 服务器运行正常 (HTTP 200)"
else
    echo "   ❌ 服务器未响应"
    echo "   请先启动: npm run dev"
    exit 1
fi

echo ""
echo "🔍 检查关键文件修复状态..."

# 检查修复的文件
FILES=(
    "src/services/freeQuotaService.ts"
    "src/utils/committeeEncryption.ts"
    "src/features/otc/CreateMarketMakerPage.tsx"
    "src/features/bridge/MakerBridgeDashboard.tsx"
)

for file in "${FILES[@]}"; do
    if grep -q "api\.query\.trading" "$file" 2>/dev/null; then
        echo "   ✅ $file - 已使用 trading API"
    elif grep -q "api\.query\.marketMaker\|api\.query\.otcOrder\|api\.query\.simpleBridge" "$file" 2>/dev/null; then
        echo "   ❌ $file - 仍在使用旧 API"
    else
        echo "   ⚠️  $file - 无法验证"
    fi
done

echo ""
echo "🗑️  检查冗余模块删除..."
if [ ! -d "src/features/deceasedMedia" ]; then
    echo "   ✅ deceasedMedia 模块已删除"
else
    echo "   ❌ deceasedMedia 模块仍然存在"
fi

echo ""
echo "📚 检查文档整理..."
DOC_COUNT=$(ls docs/archived/*.md 2>/dev/null | wc -l)
echo "   ✅ 已归档 $DOC_COUNT 个文档到 docs/archived/"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  📋 测试清单"
echo "════════════════════════════════════════════════════════"
echo ""
echo "请在浏览器中测试以下页面："
echo ""
echo "1. 🔴 做市商申请（最重要）"
echo "   http://localhost:5173/#/otc/mm-apply"
echo "   - 检查页面加载"
echo "   - 打开浏览器控制台（F12）"
echo "   - 确保无 'marketMaker is not defined' 错误"
echo ""
echo "2. 🔴 免费配额显示"
echo "   http://localhost:5173/#/market-maker/quota"
echo "   - 检查配额数据显示"
echo ""
echo "3. 🔴 OTC 订单创建"
echo "   http://localhost:5173/#/otc/order"
echo "   - 检查订单创建流程"
echo ""
echo "4. 🟡 桥接服务"
echo "   http://localhost:5173/#/bridge/simple"
echo "   - 检查桥接数据显示"
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ 如果所有测试通过"
echo "════════════════════════════════════════════════════════"
echo ""
echo "推送到远程："
echo "  git push origin cleanup/frontend-redundancy"
echo ""
echo "创建 Pull Request，合并到 main 分支。"
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ❌ 如果发现问题"
echo "════════════════════════════════════════════════════════"
echo ""
echo "快速回滚："
echo "  git reset --hard HEAD~1"
echo ""
echo "查看日志："
echo "  tail -f /tmp/stardust-dapp-dev.log"
echo ""
echo "完整测试指南："
echo "  cat 开始测试.md"
echo ""

