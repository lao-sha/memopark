#!/bin/bash
# 完整系统备份脚本
# 用于 grave 迁移前的数据保护

set -e

BACKUP_DIR="backups/pre-grave-migration-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔄 开始完整系统备份..."
echo "备份目录: $BACKUP_DIR"

# 1. 备份 pallet-stardust-grave 完整代码
echo "📦 备份 pallet-stardust-grave 代码..."
if [ -d "pallets/stardust-grave" ]; then
    cp -r pallets/stardust-grave "$BACKUP_DIR/pallet-stardust-grave"
    echo "✅ 已备份 pallet-stardust-grave"
else
    echo "⚠️  pallets/stardust-grave 目录不存在"
fi

# 2. 备份 runtime 配置
echo "📦 备份 runtime 配置..."
if [ -f "runtime/src/configs/mod.rs" ]; then
    cp runtime/src/configs/mod.rs "$BACKUP_DIR/runtime-configs-mod.rs"
    echo "✅ 已备份 runtime/src/configs/mod.rs"
fi

if [ -f "runtime/src/lib.rs" ]; then
    cp runtime/src/lib.rs "$BACKUP_DIR/runtime-lib.rs"
    echo "✅ 已备份 runtime/src/lib.rs"
fi

# 3. 备份依赖 pallet 代码
echo "📦 备份依赖 pallet..."
DEPENDENT_PALLETS=(
    "deceased"
    "memorial"
    "ledger"
    "stardust-ipfs"
    "stardust-appeals"
)

for pallet in "${DEPENDENT_PALLETS[@]}"; do
    if [ -d "pallets/$pallet" ]; then
        mkdir -p "$BACKUP_DIR/dependent-pallets"
        cp -r "pallets/$pallet" "$BACKUP_DIR/dependent-pallets/"
        echo "✅ 已备份 pallet-$pallet"
    fi
done

# 4. 备份前端关键文件
echo "📦 备份前端关键文件..."
if [ -d "stardust-dapp/src" ]; then
    # 备份 grave 相关服务
    if [ -f "stardust-dapp/src/services/graveService.ts" ]; then
        mkdir -p "$BACKUP_DIR/frontend-services"
        cp stardust-dapp/src/services/graveService.ts "$BACKUP_DIR/frontend-services/"
        echo "✅ 已备份 graveService.ts"
    fi

    # 备份 grave 相关功能目录
    if [ -d "stardust-dapp/src/features/grave" ]; then
        mkdir -p "$BACKUP_DIR/frontend-features"
        cp -r stardust-dapp/src/features/grave "$BACKUP_DIR/frontend-features/"
        echo "✅ 已备份 grave 功能组件"
    fi
fi

# 5. 备份 Cargo.toml 依赖配置
echo "📦 备份依赖配置..."
if [ -f "Cargo.toml" ]; then
    cp Cargo.toml "$BACKUP_DIR/Cargo.toml"
    echo "✅ 已备份 Cargo.toml"
fi

if [ -f "runtime/Cargo.toml" ]; then
    cp runtime/Cargo.toml "$BACKUP_DIR/runtime-Cargo.toml"
    echo "✅ 已备份 runtime/Cargo.toml"
fi

# 6. 创建备份清单
echo "📋 生成备份清单..."
cat > "$BACKUP_DIR/BACKUP_MANIFEST.md" << EOF
# Grave Migration Backup Manifest

**备份时间**: $(date '+%Y-%m-%d %H:%M:%S')
**备份目的**: grave 功能迁移前的系统完整备份

## 备份内容

### 1. Pallet 代码
- pallet-stardust-grave (完整)
- pallet-deceased (依赖备份)
- pallet-memorial (依赖备份)
- pallet-ledger (依赖备份)
- pallet-stardust-ipfs (依赖备份)
- pallet-stardust-appeals (依赖备份)

### 2. Runtime 配置
- runtime/src/configs/mod.rs
- runtime/src/lib.rs

### 3. 前端代码
- stardust-dapp/src/services/graveService.ts
- stardust-dapp/src/features/grave/

### 4. 依赖配置
- Cargo.toml (workspace)
- runtime/Cargo.toml

## 恢复方法

如需回滚到此备份状态:

\`\`\`bash
# 恢复 pallet 代码
cp -r $BACKUP_DIR/pallet-stardust-grave pallets/

# 恢复 runtime 配置
cp $BACKUP_DIR/runtime-configs-mod.rs runtime/src/configs/mod.rs
cp $BACKUP_DIR/runtime-lib.rs runtime/src/lib.rs

# 恢复依赖 pallet
cp -r $BACKUP_DIR/dependent-pallets/* pallets/

# 恢复前端
cp $BACKUP_DIR/frontend-services/graveService.ts stardust-dapp/src/services/
cp -r $BACKUP_DIR/frontend-features/grave stardust-dapp/src/features/

# 恢复依赖配置
cp $BACKUP_DIR/Cargo.toml .
cp $BACKUP_DIR/runtime-Cargo.toml runtime/Cargo.toml

# 重新编译
cargo build --release
\`\`\`

## 验证

备份完成后，请验证:
- [ ] 所有关键文件已备份
- [ ] 备份目录结构完整
- [ ] 可以使用 git diff 对比备份前后状态

## 注意事项

- 此备份不包含链上数据(需要单独导出)
- 建议在执行迁移前再次确认备份完整性
- 保留此备份至少 90 天
EOF

echo "✅ 备份清单已生成: $BACKUP_DIR/BACKUP_MANIFEST.md"

# 7. 显示备份统计
echo ""
echo "📊 备份统计:"
echo "-------------------"
du -sh "$BACKUP_DIR"
echo "文件总数: $(find "$BACKUP_DIR" -type f | wc -l)"
echo ""
echo "✅ 系统备份完成!"
echo "备份位置: $BACKUP_DIR"
echo ""
echo "下一步: 创建新 pallet 脚手架"
echo "  - pallet-memorial-space"
echo "  - pallet-social"
