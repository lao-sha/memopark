# Grave Migration Backup Manifest

**备份时间**: 2025-11-16 16:08:59
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

```bash
# 恢复 pallet 代码
cp -r backups/pre-grave-migration-20251116_160859/pallet-stardust-grave pallets/

# 恢复 runtime 配置
cp backups/pre-grave-migration-20251116_160859/runtime-configs-mod.rs runtime/src/configs/mod.rs
cp backups/pre-grave-migration-20251116_160859/runtime-lib.rs runtime/src/lib.rs

# 恢复依赖 pallet
cp -r backups/pre-grave-migration-20251116_160859/dependent-pallets/* pallets/

# 恢复前端
cp backups/pre-grave-migration-20251116_160859/frontend-services/graveService.ts stardust-dapp/src/services/
cp -r backups/pre-grave-migration-20251116_160859/frontend-features/grave stardust-dapp/src/features/

# 恢复依赖配置
cp backups/pre-grave-migration-20251116_160859/Cargo.toml .
cp backups/pre-grave-migration-20251116_160859/runtime-Cargo.toml runtime/Cargo.toml

# 重新编译
cargo build --release
```

## 验证

备份完成后，请验证:
- [ ] 所有关键文件已备份
- [ ] 备份目录结构完整
- [ ] 可以使用 git diff 对比备份前后状态

## 注意事项

- 此备份不包含链上数据(需要单独导出)
- 建议在执行迁移前再次确认备份完整性
- 保留此备份至少 90 天
