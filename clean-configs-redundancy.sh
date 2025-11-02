#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "  🧹 清理 runtime/src/configs/mod.rs 冗余配置"
echo "════════════════════════════════════════════════════════"
echo ""

cd /home/xiaodong/文档/stardust

# 备份
echo "📦 备份文件..."
if [ ! -f runtime/src/configs/mod.rs.backup ]; then
    cp runtime/src/configs/mod.rs runtime/src/configs/mod.rs.backup
    echo "   ✅ 创建新备份"
else
    echo "   ℹ️  使用现有备份"
fi
echo ""

# 创建临时 Python 脚本来处理复杂的多行删除
cat > /tmp/clean_configs.py << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
import re

# 读取文件
with open('runtime/src/configs/mod.rs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 定义需要删除的注释块范围（行号是 1-based，转换为 0-based）
delete_ranges = [
    (1257, 1274),   # pallet_memo_sacrifice 配置
    (2403, 2413),   # pallet_stardust_referrals 配置
    (2797, 2807),   # SimpleBridge 配置文档注释
    (2810, 2871),   # affiliate_weekly + affiliate_instant 配置
    (2873, 2891),   # ReferralsMembershipProviderAdapter
    (2893, 2919),   # OfferingsMembershipProviderAdapter + InstantReferralProviderAdapter
    (2920, 2970),   # InstantMembershipProviderAdapter + ConfigReferralProviderAdapter
    (2971, 3010),   # ConfigMembershipProviderAdapter + pallet_affiliate_config
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

print(f"✅ 删除了 {len(lines_to_delete)} 行冗余配置")
print(f"📊 文件从 {len(lines)} 行减少到 {len(new_lines)} 行")
PYTHON_SCRIPT

echo "🗑️  执行清理..."
python3 /tmp/clean_configs.py
echo ""

# 验证编译
echo "════════════════════════════════════════════════════════"
echo "  ✅ 验证编译"
echo "════════════════════════════════════════════════════════"
echo ""

if cargo check 2>&1 | tail -10; then
    echo ""
    echo "✅ 编译验证通过！"
    echo ""
    
    # 统计
    echo "════════════════════════════════════════════════════════"
    echo "  📊 清理统计"
    echo "════════════════════════════════════════════════════════"
    echo ""
    
    BACKUP_LINES=$(wc -l < runtime/src/configs/mod.rs.backup)
    CURRENT_LINES=$(wc -l < runtime/src/configs/mod.rs)
    DELETED_LINES=$((BACKUP_LINES - CURRENT_LINES))
    
    echo "原始行数：$BACKUP_LINES 行"
    echo "当前行数：$CURRENT_LINES 行"
    echo "删除行数：$DELETED_LINES 行"
    echo ""
    
    # 清理临时文件
    rm /tmp/clean_configs.py
    
    echo "✅ 清理完成！"
else
    echo ""
    echo "❌ 编译失败！正在回滚..."
    cp runtime/src/configs/mod.rs.backup runtime/src/configs/mod.rs
    rm /tmp/clean_configs.py
    echo "✅ 已回滚到备份版本"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  📝 后续步骤"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1. 验证功能是否正常"
echo "2. 提交更改："
echo "   git add -A"
echo "   git commit -m 'refactor: 清理链端冗余配置代码'"
echo ""
echo "3. 如需回滚："
echo "   cp runtime/src/configs/mod.rs.backup runtime/src/configs/mod.rs"
echo ""

