# pallet-trading 旧代码归档

## 归档日期
2025-11-03

## 归档原因
`pallet-trading` 已完成模块化重构，拆分为以下独立模块：
- **pallet-maker**: 做市商生命周期管理
- **pallet-otc-order**: OTC订单管理（含首购）
- **pallet-bridge**: DUST ↔ USDT 桥接
- **pallet-trading-common**: 共享工具库
- **pallet-trading**: 统一接口层（新实现）

## 归档内容

### 备份文件
- `Cargo.toml.backup` - 旧的 Cargo 配置备份
- `lib.rs.backup.2025-11-03` - 旧的主文件备份
- `lib_new.rs` - 临时文件

### 旧模块文件
- `maker.rs` - 做市商模块（已迁移到 `pallet-maker`）
- `otc.rs` - OTC订单模块（已迁移到 `pallet-otc-order`）
- `bridge.rs` - 桥接模块（已迁移到 `pallet-bridge`）
- `common.rs` - 共享工具（已迁移到 `pallet-trading-common`）

### 清理脚本
- `otc_cleanup.rs` - OTC模块清理脚本
- `bridge_cleanup.rs` - Bridge模块清理脚本

### 测试和辅助文件
- `benchmarking.rs` - 旧的性能基准测试
- `mock.rs` - 旧的测试 mock
- `tests.rs` - 旧的单元测试
- `types.rs` - 旧的类型定义
- `weights.rs` - 旧的权重计算（新架构各模块有独立的 weights）

## 代码迁移对照

| 旧文件 | 新位置 | 说明 |
|--------|--------|------|
| `maker.rs` | `pallets/maker/src/lib.rs` | 做市商管理 |
| `otc.rs` | `pallets/otc-order/src/lib.rs` | OTC订单管理 |
| `bridge.rs` | `pallets/bridge/src/lib.rs` | 跨链桥接 |
| `common.rs` | `pallets/trading-common/src/` | 工具函数（mask.rs, validation.rs） |
| `types.rs` | 各独立 pallet 的 `lib.rs` | 类型定义分散到各模块 |

## 新架构优势

1. **模块化**: 每个模块职责清晰，独立维护
2. **可复用**: `trading-common` 提供通用工具
3. **可测试**: 每个模块可独立测试
4. **向后兼容**: 保留统一接口层 `pallet-trading`
5. **编译速度**: 增量编译更快

## 如何恢复旧代码（紧急情况）

如需回退到旧版本：

1. 停止使用新的独立 pallets
2. 从本归档目录恢复文件到 `pallets/trading/src/`
3. 恢复 `Cargo.toml.backup` 为 `Cargo.toml`
4. 在 `runtime/src/lib.rs` 中注释新 pallets，恢复旧 `Trading`
5. 重新编译 Runtime

## 相关文档

- `docs/pallet-trading重构方案.md` - 详细重构方案
- `docs/前端API迁移指南-pallet-trading重构.md` - API迁移指南
- `docs/pallet-trading重构-测试验证报告.md` - 测试报告

## 备注

⚠️ **重要**: 此归档仅供参考和紧急恢复使用。新开发应使用重构后的独立模块。

---

**归档人**: AI Assistant  
**审核人**: 待项目负责人确认  
**归档目录**: `archived-pallets/trading-old-2025-11-03/`

