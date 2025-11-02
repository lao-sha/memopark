#!/bin/bash
# 简化版 API 修复脚本

set -e
cd "$(dirname "$0")"

echo "🔧 开始修复 Pallet API 调用..."
echo ""

# 1. marketMaker → trading
echo "📌 修复 marketMaker → trading..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.marketMaker/api.query.trading/g' {} +
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.tx\.marketMaker/api.tx.trading/g' {} +

# 2. otcOrder → trading
echo "📌 修复 otcOrder → trading..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.otcOrder/api.query.trading/g' {} +
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.tx\.otcOrder/api.tx.trading/g' {} +

# 3. simpleBridge → trading
echo "📌 修复 simpleBridge → trading..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.simpleBridge/api.query.trading/g' {} +
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.tx\.simpleBridge/api.tx.trading/g' {} +

# 4. memoOfferings → memorial
echo "📌 修复 memoOfferings → memorial..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.memoOfferings/api.query.memorial/g' {} +
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.tx\.memoOfferings/api.tx.memorial/g' {} +

# 5. memoSacrifice → memorial
echo "📌 修复 memoSacrifice → memorial..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.memoSacrifice/api.query.memorial/g' {} +
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.tx\.memoSacrifice/api.tx.memorial/g' {} +

# 6. deceasedMedia → deceased
echo "📌 修复 deceasedMedia → deceased..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.deceasedMedia/api.query.deceased/g' {} +
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.tx\.deceasedMedia/api.tx.deceased/g' {} +

# 7. deceasedText → deceased
echo "📌 修复 deceasedText → deceased..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.deceasedText/api.query.deceased/g' {} +
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.tx\.deceasedText/api.tx.deceased/g' {} +

echo ""
echo "✅ API 修复完成！"
echo ""

