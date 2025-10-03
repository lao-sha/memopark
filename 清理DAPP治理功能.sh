#!/bin/bash

###############################################################################
# 清理 memopark-dapp 治理功能脚本
# 目标：删除与 memopark-governance 重叠的治理功能，避免维护两套代码
# 作者：Cursor AI
# 日期：2025-10-03
###############################################################################

set -e

echo "=================================="
echo "DAPP 治理功能清理脚本"
echo "=================================="
echo ""

# 切换到项目根目录
cd "$(dirname "$0")"
DAPP_DIR="./memopark-dapp"

if [ ! -d "$DAPP_DIR" ]; then
    echo "❌ 错误：未找到 memopark-dapp 目录"
    exit 1
fi

echo "📁 工作目录：$DAPP_DIR"
echo ""

# 步骤1：备份
echo "步骤1：创建备份分支..."
git checkout -b backup-dapp-governance-cleanup-$(date +%Y%m%d-%H%M%S) || {
    echo "⚠️  警告：Git分支创建失败，继续执行..."
}
git add .
git commit -m "备份：清理DAPP治理功能前的快照" || {
    echo "⚠️  警告：Git提交失败（可能没有变更），继续执行..."
}
echo "✅ 备份完成"
echo ""

# 步骤2：删除文件
echo "步骤2：删除治理相关文件..."

# 2.1 删除公投相关（Legacy）
echo "  🗑️  删除公投相关文件（Legacy）..."
rm -f "$DAPP_DIR/src/features/governance/GovernanceHomePage.tsx"
rm -f "$DAPP_DIR/src/features/governance/ReferendaListPage.tsx"
rm -f "$DAPP_DIR/src/features/governance/ReferendumDetailPage.tsx"
rm -f "$DAPP_DIR/src/features/governance/NewProposalPage.tsx"
rm -f "$DAPP_DIR/src/features/governance/store.ts"
rm -f "$DAPP_DIR/src/features/governance/SubmitCategoryReferendumPage.tsx"
rm -f "$DAPP_DIR/src/features/governance/hooks/useReferenda.ts"
rm -f "$DAPP_DIR/src/features/governance/hooks/usePreimage.ts"
rm -f "$DAPP_DIR/src/features/governance/hooks/useTracks.ts"
rm -f "$DAPP_DIR/src/features/governance/hooks/useMyVoting.ts"
rm -f "$DAPP_DIR/src/hooks/useReferendumStatus.ts"
rm -f "$DAPP_DIR/src/hooks/useEffectSetEvents.ts"

# 2.2 删除委员会提案组件
echo "  🗑️  删除委员会提案组件..."
rm -f "$DAPP_DIR/src/features/governance/CouncilProposalPage.tsx"
rm -rf "$DAPP_DIR/src/features/governance/components/"

# 2.3 删除做市商审核
echo "  🗑️  删除做市商审核页..."
rm -f "$DAPP_DIR/src/features/otc/GovMarketMakerReviewPage.tsx"

# 2.4 删除内容治理审查
echo "  🗑️  删除内容治理审查页..."
rm -f "$DAPP_DIR/src/features/governance/ContentGovernanceReviewPage.tsx"
rm -f "$DAPP_DIR/src/features/governance/ContentCommitteePage.tsx"
rm -f "$DAPP_DIR/src/features/governance/GovTicketPage.tsx"
rm -f "$DAPP_DIR/src/features/governance/CommitteeTemplatesPage.tsx"

# 2.5 删除恢复逝者构建器
echo "  🗑️  删除恢复逝者构建器..."
rm -f "$DAPP_DIR/src/features/governance/RestoreDeceasedBuilder.tsx"

# 2.6 删除仲裁管理
echo "  🗑️  删除仲裁管理模块..."
rm -rf "$DAPP_DIR/src/features/arbitration/"

# 2.7 删除墓地/园区治理工具
echo "  🗑️  删除墓地/园区治理工具..."
rm -f "$DAPP_DIR/src/features/grave/GraveGovernanceToolsPage.tsx"
rm -f "$DAPP_DIR/src/features/park/ParkGovernanceToolsPage.tsx"

echo "✅ 文件删除完成"
echo ""

# 步骤3：统计
echo "步骤3：统计删除结果..."
DELETED_COUNT=$(git status --short | grep -c "^ D" || echo "0")
echo "  📊 已删除文件数：$DELETED_COUNT"
echo ""

# 步骤4：提示后续操作
echo "=================================="
echo "✅ 清理完成！"
echo "=================================="
echo ""
echo "📝 后续手动操作清单："
echo ""
echo "1️⃣  修改 src/App.tsx："
echo "   - 删除已删除文件的导入语句"
echo "   - 删除对应的路由映射"
echo "   - 保留 SubmitAppealPage 和 MyGovernancePage"
echo ""
echo "2️⃣  修改 src/features/governance/lib/governance.ts："
echo "   - 删除不再使用的函数（referenda、preimage相关）"
echo "   - 保留 fetchContentGovConsts、submitAppeal、fetchMyVoting 等"
echo "   - 约删除 700 行代码"
echo ""
echo "3️⃣  修改 src/components/nav/BottomNav.tsx："
echo "   - 删除'内容委员会'按钮"
echo "   - 替换为'我的墓地'按钮"
echo ""
echo "4️⃣  改造保留的页面："
echo "   - SubmitAppealPage：添加跳转到Web平台的链接"
echo "   - MyGovernancePage：添加引导提示和跳转按钮"
echo "   - AppealEntry：修改跳转目标为 governance 平台"
echo ""
echo "5️⃣  添加引导入口："
echo "   - HomePage：添加'Web治理平台'卡片"
echo "   - ProfilePage：添加治理快捷入口"
echo ""
echo "6️⃣  测试验证："
echo "   - 运行 npm run build"
echo "   - 检查编译错误"
echo "   - 修复 linter 错误"
echo "   - 功能测试（供奉、创建墓地等核心功能）"
echo ""
echo "7️⃣  提交变更："
echo "   git add ."
echo "   git commit -m \"重构：删除DAPP治理功能，迁移到Web治理平台\""
echo ""
echo "=================================="
echo "📖 详细方案请查看："
echo "   docs/治理功能重叠分析与清理方案.md"
echo "=================================="

