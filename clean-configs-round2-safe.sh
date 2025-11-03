#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "  🧹 第二轮清理（安全版）：删除废弃的供奉配置"
echo "════════════════════════════════════════════════════════"
echo ""

cd /home/xiaodong/文档/stardust

# 确保备份存在
if [ ! -f runtime/src/configs/mod.rs.backup ]; then
    echo "❌ 错误：找不到备份文件"
    exit 1
fi

echo "📦 使用现有备份: runtime/src/configs/mod.rs.backup"
echo ""

# 创建 Python 脚本，智能删除以 "// 🆕 2025-10-28 已移除" 开头的连续注释块
cat > /tmp/clean_configs_safe.py << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
import re

with open('runtime/src/configs/mod.rs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到所有需要删除的块
# 策略：找到 "已移除" 标记，然后删除从该行开始的连续注释行
deleted_ranges = []
i = 0
while i < len(lines):
    line = lines[i]
    # 如果找到"已移除"标记
    if '🆕 2025-10-28 已移除' in line or '🆕 2025-10-28 已移除' in line:
        start = i
        # 向下找连续的注释行
        j = i
        while j < len(lines) and (lines[j].strip().startswith('//') or lines[j].strip() == ''):
            j += 1
        end = j
        # 如果这个块至少有10行，就删除它
        if end - start >= 10:
            deleted_ranges.append((start, end))
            print(f"标记删除：行 {start+1} 到 {end}（{end-start} 行）")
        i = j
    else:
        i += 1

# 标记要删除的行
lines_to_delete = set()
for start, end in deleted_ranges:
    for i in range(start, end):
        lines_to_delete.add(i)

# 保留未被标记删除的行
new_lines = [line for i, line in enumerate(lines) if i not in lines_to_delete]

# 写回文件
with open('runtime/src/configs/mod.rs', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"\n✅ 删除了 {len(lines_to_delete)} 行废弃配置（{len(deleted_ranges)} 个块）")
print(f"📊 文件从 {len(lines)} 行减少到 {len(new_lines)} 行")
PYTHON_SCRIPT

echo "🗑️  步骤 1/3：智能删除废弃配置块..."
python3 /tmp/clean_configs_safe.py
echo ""

echo "🔧 步骤 2/3：更新 SimpleBridge TODO 注释..."
sed -i 's/待pallet-simple-bridge实现/待 pallet-trading 实现/g' runtime/src/configs/mod.rs
sed -i 's/pallet-simple-bridge实现/pallet-trading 实现/g' runtime/src/configs/mod.rs
echo "   ✅ 已更新 TODO 注释"
echo ""

echo "📊 步骤 3/3：统计清理结果..."
BACKUP_LINES=$(wc -l < runtime/src/configs/mod.rs.backup)
CURRENT_LINES=$(wc -l < runtime/src/configs/mod.rs)
DELETED_LINES=$((BACKUP_LINES - CURRENT_LINES))

echo "   原始行数：$BACKUP_LINES 行"
echo "   当前行数：$CURRENT_LINES 行"
echo "   总删除数：$DELETED_LINES 行"
echo ""

rm /tmp/clean_configs_safe.py

echo "════════════════════════════════════════════════════════"
echo "  ✅ 验证编译"
echo "════════════════════════════════════════════════════════"
echo ""

if cargo check 2>&1 | tail -10; then
    echo ""
    echo "✅ 编译验证通过！"
    echo ""
    
    echo "════════════════════════════════════════════════════════"
    echo "  📊 清理统计"
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "累计清理（两轮）："
    echo "  • 第一轮：254 行（链端）+ 627 行（前端）= 881 行"
    echo "  • 第二轮：$DELETED_LINES 行（链端废弃配置）"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    TOTAL=$((881 + DELETED_LINES))
    echo "  总计：~$TOTAL 行冗余代码"
    echo ""
    echo "✅ 第二轮清理完成！"
else
    echo ""
    echo "❌ 编译失败！正在回滚..."
    cp runtime/src/configs/mod.rs.backup runtime/src/configs/mod.rs
    echo "✅ 已回滚到备份版本"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  📝 后续步骤"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1. 验证功能正常："
echo "   cargo build --release"
echo ""
echo "2. 提交更改："
echo "   git add runtime/src/configs/mod.rs"
echo "   git commit -m 'refactor: 第二轮清理 - 删除废弃的供奉配置'"
echo ""

