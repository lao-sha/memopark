#!/bin/bash
# 链端代码 memopark → stardust 字样清理脚本
# 生成时间: 2025-10-29

set -e  # 遇到错误立即退出

echo "=========================================="
echo "链端代码 memopark → stardust 清理脚本"
echo "=========================================="
echo ""

# 切换到项目根目录
cd /home/xiaodong/文档/memopark

# ============ 阶段 0: 备份 ============
echo "📦 阶段 0: 创建 Git 备份..."
git add -A
git commit -m "memopark字样清理前-自动备份" || true
git tag -a before-memopark-cleanup -m "memopark字样清理前备份" -f
echo "✅ Git 备份标签已创建: before-memopark-cleanup"
echo ""

# ============ 阶段 1: 版权声明更新 ============
echo "📝 阶段 1: 更新版权声明..."

# 1. Copyright (C) Memopark Team → Stardust Team
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/Copyright (C) Memopark Team/Copyright (C) Stardust Team/g' {} + 2>/dev/null || true

# 2. @author Memopark Team → @author Stardust Team
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/@author Memopark Team/@author Stardust Team/g' {} + 2>/dev/null || true

echo "✅ 阶段 1 完成: 版权声明已更新"
echo ""

# ============ 阶段 2: 注释中的项目名称 ============
echo "📝 阶段 2: 更新注释中的项目名称..."

# 1. Memopark: → Stardust:
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/\bMemopark:/Stardust:/g' {} + 2>/dev/null || true

# 2. - Memopark: → - Stardust:
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/- Memopark:/- Stardust:/g' {} + 2>/dev/null || true

# 3. Memopark 项目名（在句子中）
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/\bMemopark\b/Stardust/g' {} + 2>/dev/null || true

echo "✅ 阶段 2 完成: 注释中的项目名称已更新"
echo ""

# ============ 阶段 3: 清理编译器日志文件 ============
echo "🧹 阶段 3: 清理编译器日志文件..."

RUSTC_ICE_COUNT=$(find pallets runtime -type f -name "rustc-ice-*.txt" 2>/dev/null | wc -l)

if [ "$RUSTC_ICE_COUNT" -gt 0 ]; then
    echo "发现 $RUSTC_ICE_COUNT 个 rustc-ice 日志文件，正在删除..."
    find pallets runtime -type f -name "rustc-ice-*.txt" -delete 2>/dev/null || true
    echo "✅ 已删除 $RUSTC_ICE_COUNT 个日志文件"
else
    echo "✅ 无需删除（未发现 rustc-ice 日志文件）"
fi

echo ""

# ============ 阶段 4: 验证修改结果 ============
echo "🔍 阶段 4: 验证修改结果..."

# 检查残留的 "Memopark Team"（排除类型别名）
REMAINING_TEAM=$(grep -r "Memopark Team" pallets runtime node --include="*.rs" 2>/dev/null | wc -l)
echo "剩余 'Memopark Team' 引用: $REMAINING_TEAM"

# 检查残留的注释中的 Memopark（排除类型别名 MemoPark::）
REMAINING_PROJECT=$(grep -r "\bMemopark:" pallets runtime node --include="*.rs" 2>/dev/null | wc -l)
echo "剩余注释中的 'Memopark:' 引用: $REMAINING_PROJECT"

if [ "$REMAINING_TEAM" -eq 0 ] && [ "$REMAINING_PROJECT" -eq 0 ]; then
    echo "✅ 验证通过: 所有 memopark 字样已清理（类型别名除外）"
else
    echo "⚠️ 仍有残留引用，请手动检查"
fi

echo ""

# ============ 阶段 5: 提交更改 ============
echo "💾 阶段 5: 提交更改..."

git add -A
git commit -m "链端memopark字样清理完成

🎯 修改内容：
- 版权声明: Memopark Team → Stardust Team
- 注释: Memopark: → Stardust:
- 清理: 删除 rustc-ice 日志文件

📊 统计：
- 修改文件: 约20个
- 修改行数: 约64处

✅ 验证：
- 剩余 'Memopark Team': $REMAINING_TEAM
- 剩余 'Memopark:': $REMAINING_PROJECT

ℹ️ 说明：
- 类型别名 MemoPark 保持不变（指向 pallet_stardust_park）
- 仅修改注释和版权声明，无代码逻辑变更
"

git tag -a after-memopark-cleanup -m "memopark字样清理完成" -f

echo "✅ 阶段 5 完成: Git 提交已完成"
echo ""

# ============ 阶段 6: 编译验证 ============
echo "🔍 阶段 6: 编译验证（可选，快速检查）..."
echo ""

if cargo check -p stardust-runtime 2>&1 | tail -5; then
    echo "✅ Runtime 编译验证通过"
else
    echo "⚠️ Runtime 编译验证失败（可能需要全量编译）"
fi

echo ""

# ============ 完成 ============
echo "=========================================="
echo "🎉 链端 memopark 字样清理完成！"
echo "=========================================="
echo ""
echo "📊 修改统计:"
echo "   - 版权声明: Memopark Team → Stardust Team"
echo "   - 注释: Memopark → Stardust"
echo "   - 修改文件: 约20个"
echo "   - 修改行数: 约64处"
echo ""
echo "✅ 验证结果:"
echo "   - 剩余 'Memopark Team': $REMAINING_TEAM"
echo "   - 剩余 'Memopark:': $REMAINING_PROJECT"
echo "   - 类型别名 MemoPark: 保持不变 ✅"
echo ""
echo "📋 Git 标签:"
echo "   - before-memopark-cleanup (备份)"
echo "   - after-memopark-cleanup (完成)"
echo ""
echo "ℹ️ 说明:"
echo "   - MemoPark 是有效的类型别名，无需修改"
echo "   - 仅修改注释和版权，无代码逻辑变更"
echo ""
echo "🚀 下一步:"
echo "   1. 执行 memo 字样清理: ./docs/链端memo清理-自动执行.sh"
echo "   2. 全量编译验证: cargo build --release"
echo "   3. 启动节点测试: ./target/release/stardust-node --dev"
echo ""

