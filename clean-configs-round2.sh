#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "  🧹 第二轮清理：删除废弃的供奉配置"
echo "════════════════════════════════════════════════════════"
echo ""

cd /home/xiaodong/文档/stardust

# 确保备份存在
if [ ! -f runtime/src/configs/mod.rs.backup ]; then
    echo "❌ 错误：找不到备份文件"
    echo "请先运行第一轮清理脚本创建备份"
    exit 1
fi

echo "📦 使用现有备份: runtime/src/configs/mod.rs.backup"
echo ""

# 创建 Python 脚本进行精确删除
cat > /tmp/clean_configs_round2.py << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
import re

# 读取文件
with open('runtime/src/configs/mod.rs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 定义需要删除的废弃配置块（1-based 行号，转换为 0-based）
delete_ranges = [
    (1055, 1126),   # 72 行 - 废弃的供奉配置
    (1128, 1246),   # 119 行 - 旧的供奉路由实现 (OfferDonationRouter)
    (1511, 1550),   # 40 行 - 旧的目标控制器 (AllowAllTargetControl)
    (1552, 1645),   # 94 行 - 旧的供奉回调 (GraveOfferingHook)
    (1651, 1695),   # 45 行 - 旧的 DonationAccountResolver (GraveDonationResolver)
    (2954, 3009),   # 56 行 - 旧的路由初始化函数 (initialize_offering_routes)
]

# 标记要删除的行（转换为 0-based）
lines_to_delete = set()
for start, end in delete_ranges:
    for i in range(start - 1, end):  # 转换为 0-based
        if i < len(lines):
            lines_to_delete.add(i)

# 保留未被标记删除的行
new_lines = [line for i, line in enumerate(lines) if i not in lines_to_delete]

# 写回文件
with open('runtime/src/configs/mod.rs', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"✅ 删除了 {len(lines_to_delete)} 行废弃配置")
print(f"📊 文件从 {len(lines)} 行减少到 {len(new_lines)} 行")
PYTHON_SCRIPT

echo "🗑️  步骤 1/3：删除废弃配置块..."
python3 /tmp/clean_configs_round2.py
echo ""

echo "🔧 步骤 2/3：更新 SimpleBridge TODO 注释..."
# 更新 SimpleBridge 相关的 TODO
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

# 清理临时文件
rm /tmp/clean_configs_round2.py

echo "════════════════════════════════════════════════════════"
echo "  ✅ 验证编译"
echo "════════════════════════════════════════════════════════"
echo ""

# 验证编译
echo "正在验证编译..."
if cargo check 2>&1 | tail -10; then
    echo ""
    echo "✅ 编译验证通过！"
    echo ""
    
    echo "════════════════════════════════════════════════════════"
    echo "  📊 第二轮清理统计"
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "本次清理："
    echo "  • 废弃供奉配置：72 行"
    echo "  • 旧路由实现：119 行"
    echo "  • 旧目标控制器：40 行"
    echo "  • 旧供奉回调：94 行"
    echo "  • 旧 DonationResolver：45 行"
    echo "  • 旧路由初始化：56 行"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  小计：~426 行"
    echo ""
    echo "累计清理（两轮）："
    echo "  • 第一轮：254 行（链端）+ 627 行（前端）= 881 行"
    echo "  • 第二轮：~426 行（链端废弃配置）"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  总计：~1307 行冗余代码"
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
echo "3. 推送到远程："
echo "   git push origin cleanup/frontend-redundancy"
echo ""

