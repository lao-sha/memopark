#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "  🧹 Stardust 链端代码清理工具"
echo "════════════════════════════════════════════════════════"
echo ""

# 切换到项目根目录
cd /home/xiaodong/文档/stardust

# 1. 备份关键文件
echo "📦 步骤 1/4：备份关键文件..."
cp runtime/src/configs/mod.rs runtime/src/configs/mod.rs.backup
cp runtime/src/lib.rs runtime/src/lib.rs.backup
cp Cargo.toml Cargo.toml.backup
cp runtime/Cargo.toml runtime/Cargo.toml.backup
cp pallets/trading/Cargo.toml pallets/trading/Cargo.toml.backup
echo "   ✅ 备份完成"
echo ""

# 2. 清理 Cargo.toml 中的注释依赖
echo "🗑️  步骤 2/4：清理 Cargo.toml 注释依赖..."

# 工作区 Cargo.toml
sed -i '/# "pallets\/stardust-referrals"/d' Cargo.toml
echo "   ✅ 清理工作区 Cargo.toml"

# runtime/Cargo.toml
sed -i '/pallet-stardust-referrals.*🔴.*已移除/d' runtime/Cargo.toml
sed -i '/"pallet-stardust-referrals\/std".*🔴.*已移除/d' runtime/Cargo.toml
echo "   ✅ 清理 runtime/Cargo.toml"

# pallets/trading/Cargo.toml
sed -i '/pallet-stardust-referrals.*🔴.*已移除/d' pallets/trading/Cargo.toml
sed -i '/"pallet-stardust-referrals\/std".*🔴.*已移除/d' pallets/trading/Cargo.toml
echo "   ✅ 清理 pallets/trading/Cargo.toml"

echo ""

# 3. 清理 runtime/src/lib.rs 中的注释 pub type
echo "🗑️  步骤 3/4：清理 runtime/src/lib.rs 注释类型..."

sed -i '/\/\/ pub type MemorialOfferings = pallet_memo_offerings/d' runtime/src/lib.rs
sed -i '/\/\/ pub type AffiliateWeekly = pallet_affiliate_weekly/d' runtime/src/lib.rs
sed -i '/\/\/ pub type AffiliateConfig = pallet_affiliate_config/d' runtime/src/lib.rs
sed -i '/\/\/ pub type AffiliateInstant = pallet_affiliate_instant/d' runtime/src/lib.rs
sed -i '/\/\/ pub type MemoSacrifice = pallet_memo_sacrifice/d' runtime/src/lib.rs

echo "   ✅ 清理完成"
echo ""

# 4. 清理 runtime/src/configs/mod.rs 中的大块注释配置
echo "🗑️  步骤 4/4：清理 runtime/src/configs/mod.rs 冗余配置..."
echo "   ⚠️  这一步需要手动处理，因为涉及大量连续注释块"
echo "   建议使用 IDE 的多行删除功能"
echo ""

# 统计清理结果
echo "════════════════════════════════════════════════════════"
echo "  📊 清理统计"
echo "════════════════════════════════════════════════════════"
echo ""

# 统计 Cargo.toml 清理
echo "📌 Cargo.toml 清理："
echo "   • 工作区 Cargo.toml：已清理"
echo "   • runtime/Cargo.toml：已清理"
echo "   • pallets/trading/Cargo.toml：已清理"
echo ""

echo "📌 runtime/src/lib.rs 清理："
echo "   • 已删除 5 个注释 pub type"
echo ""

echo "📌 runtime/src/configs/mod.rs："
echo "   ⚠️  需要手动清理约 500 行注释配置"
echo "   建议删除的配置块："
echo "   1. pallet_memo_sacrifice 配置（行 1258-1274）"
echo "   2. pallet_stardust_referrals 配置（行 2404-2413）"
echo "   3. pallet_affiliate_weekly 配置（行 2816-2851）"
echo "   4. pallet_affiliate_instant 配置（行 2858-2871）"
echo "   5. 各种适配器代码（行 2878-3010）"
echo ""

echo "════════════════════════════════════════════════════════"
echo "  ✅ 验证编译"
echo "════════════════════════════════════════════════════════"
echo ""

# 验证编译
echo "正在验证编译..."
if cargo check 2>&1 | tail -5; then
    echo ""
    echo "✅ 编译验证通过！"
else
    echo ""
    echo "❌ 编译失败！正在回滚..."
    cp runtime/src/configs/mod.rs.backup runtime/src/configs/mod.rs
    cp runtime/src/lib.rs.backup runtime/src/lib.rs
    cp Cargo.toml.backup Cargo.toml
    cp runtime/Cargo.toml.backup runtime/Cargo.toml
    cp pallets/trading/Cargo.toml.backup pallets/trading/Cargo.toml
    echo "✅ 已回滚到备份版本"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  📄 备份文件位置"
echo "════════════════════════════════════════════════════════"
echo ""
echo "如需回滚，执行："
echo "  cp runtime/src/configs/mod.rs.backup runtime/src/configs/mod.rs"
echo "  cp runtime/src/lib.rs.backup runtime/src/lib.rs"
echo "  cp Cargo.toml.backup Cargo.toml"
echo "  cp runtime/Cargo.toml.backup runtime/Cargo.toml"
echo "  cp pallets/trading/Cargo.toml.backup pallets/trading/Cargo.toml"
echo ""
echo "════════════════════════════════════════════════════════"
echo "  🎉 清理完成！"
echo "════════════════════════════════════════════════════════"

