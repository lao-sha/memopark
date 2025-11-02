#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "  🔧 Stardust 前端 API 完整修复工具"
echo "════════════════════════════════════════════════════════"
echo ""
echo "开始修复所有 pallet API 调用..."
echo ""

# 定义替换规则
declare -A query_replacements
query_replacements["api.query as any).marketMaker"]="api.query as any).trading"
query_replacements["api.tx.marketMaker"]="api.tx.trading"
query_replacements["api.query.marketMaker"]="api.query.trading"

# 遍历所有 .ts 和 .tsx 文件
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read -r file; do
    modified=false
    
    # 替换 (api.query as any).marketMaker -> trading
    if grep -q "(api\.query as any)\.marketMaker" "$file"; then
        echo "📌 修复 (api.query as any).marketMaker → trading in $file..."
        sed -i 's/(api\.query as any)\.marketMaker/(api.query as any).trading/g' "$file"
        modified=true
    fi
    
    # 替换 api.tx.marketMaker -> trading
    if grep -q "api\.tx\.marketMaker" "$file"; then
        echo "📌 修复 api.tx.marketMaker → trading in $file..."
        sed -i 's/api\.tx\.marketMaker/api.tx.trading/g' "$file"
        modified=true
    fi
    
    # 替换 api.query.marketMaker -> trading
    if grep -q "api\.query\.marketMaker" "$file" 2>/dev/null; then
        echo "📌 修复 api.query.marketMaker → trading in $file..."
        sed -i 's/api\.query\.marketMaker/api.query.trading/g' "$file"
        modified=true
    fi
    
    # 替换错误消息
    if grep -q "pallet-market-maker" "$file"; then
        echo "📝 更新错误消息 in $file..."
        sed -i "s/pallet-market-maker/pallet-trading/g" "$file"
        modified=true
    fi
    
    if [ "$modified" = true ]; then
        echo "   ✅ $file 已修复"
    fi
done

echo ""
echo "✅ API 修复完成！"
echo ""
echo "════════════════════════════════════════════════════════"
echo "  📋 验证修复结果"
echo "════════════════════════════════════════════════════════"
echo ""

# 检查是否还有遗漏
echo "🔍 检查是否还有 marketMaker 引用..."
remaining=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "marketMaker" {} \; | wc -l)

if [ "$remaining" -eq 0 ]; then
    echo "   ✅ 没有遗漏，所有引用已修复"
else
    echo "   ⚠️  还有 $remaining 个文件包含 marketMaker 引用（可能是注释）"
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "marketMaker" {} \; | head -10
fi

echo ""
echo "════════════════════════════════════════════════════════"

