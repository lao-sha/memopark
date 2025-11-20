# Git 提交指南 - pallet-trading 重构

## 概述

本指南提供 pallet-trading 重构后的推荐 Git 提交策略。

---

## 推荐提交顺序

### 阶段1：提交新模块代码

```bash
# 添加新的独立 pallets
git add pallets/maker/
git add pallets/otc-order/
git add pallets/bridge/
git add pallets/trading-common/

git commit -m "feat: 新增独立 trading 模块

- pallet-maker: 做市商生命周期管理
- pallet-otc-order: OTC订单管理（含首购）
- pallet-bridge: DUST ↔ USDT 跨链桥接
- pallet-trading-common: 共享工具库（mask、validation）

详细说明:
- 做市商模块：完整实现申请、审批、提现流程
- OTC模块：基础架构完成，待实现业务逻辑
- Bridge模块：基础架构完成，待实现业务逻辑
- 工具库：纯Rust crate，数据脱敏和验证函数

参考: docs/pallet-trading重构方案.md"
```

### 阶段2：更新统一接口层

```bash
# 更新 pallet-trading 为统一接口层
git add pallets/trading/

git commit -m "refactor: 重构 pallet-trading 为统一接口层

- 移除所有业务逻辑
- 重新导出各独立模块的类型和调用
- 提供聚合查询API（TradingApi trait）
- 保持向后兼容性

向后兼容:
- 前端可通过统一接口层访问所有功能
- 逐步迁移到直接使用独立模块

参考: pallets/trading/README.md"
```

### 阶段3：更新 Runtime 配置

```bash
# 更新 Runtime 集成
git add runtime/

git commit -m "feat: 集成新 trading 模块到 Runtime

Runtime 配置:
- 新增 pallet-maker 配置
- 新增 pallet-otc-order 配置
- 新增 pallet-bridge 配置
- 更新 construct_runtime! 宏

技术细节:
- PricingProviderImpl: 临时实现（待对接 pallet-pricing）
- CreditWrapper: 占位实现（待完善 pallet-credit）
- ArbitrationRouter: 临时返回false（待实现仲裁逻辑）

参考: docs/pallet-trading重构-测试验证报告.md"
```

### 阶段4：更新 Workspace 配置

```bash
# 更新 Cargo workspace
git add Cargo.toml

git commit -m "chore: 更新 workspace 成员

新增成员:
- pallets/maker
- pallets/otc-order
- pallets/bridge
- pallets/trading-common

保留:
- pallets/trading (作为统一接口层)"
```

### 阶段5：前端适配

```bash
# 前端服务层适配
git add stardust-dapp/src/services/

git commit -m "refactor: 适配前端服务层到新 trading 架构

tradingService.ts:
- api.query.trading -> api.query.{maker|otcOrder|bridge}
- api.tx.trading -> api.tx.{maker|otcOrder|bridge}

freeQuotaService.ts:
- 首购查询迁移到 pallet-otc-order
- 首购逻辑调整为一次性模式

committeeEncryption.ts:
- 密钥分片功能标记为待实现

参考: docs/前端API迁移指南-pallet-trading重构.md"

# 前端页面适配
git add stardust-dapp/src/features/otc/CreateMarketMakerPage.tsx
git add stardust-dapp/src/features/bridge/SimpleBridgePage.tsx

git commit -m "refactor: 适配前端页面到新 trading 架构

CreateMarketMakerPage.tsx:
- api.query.trading -> api.query.maker
- 做市商申请流程更新

SimpleBridgePage.tsx:
- api.tx.trading.swap -> api.tx.bridge.swap
- 事件监听更新

待适配: 6个页面（见迁移指南）"
```

### 阶段6：归档旧代码

```bash
# 归档旧代码和备份文件
git add archived-pallets/trading-old-2025-11-03/
git add archived-pallets/runtime-backups-2025-11-03/
git add archived-pallets/frontend-backups-2025-11-03/

git commit -m "chore: 归档重构前的旧代码

归档内容:
1. trading-old-2025-11-03/ (188KB)
   - 旧的 maker.rs, otc.rs, bridge.rs, common.rs
   - 旧的 benchmarking.rs, mock.rs, tests.rs, weights.rs
   - 备份文件和临时文件

2. runtime-backups-2025-11-03/ (208KB)
   - Runtime 配置备份文件
   - Workspace 配置备份

3. frontend-backups-2025-11-03/ (16KB)
   - 前端代码备份文件

保留期限: 6个月（至2026-05-03）
归档说明: 各目录包含 ARCHIVED.md

参考: docs/代码清理报告-pallet-trading重构.md"
```

### 阶段7：文档提交

```bash
# 提交重构文档
git add docs/pallet-trading重构方案.md
git add docs/pallet-trading编译现状与建议.md
git add docs/前端API迁移指南-pallet-trading重构.md
git add docs/pallet-trading重构-测试验证报告.md
git add docs/代码清理报告-pallet-trading重构.md
git add docs/代码清理完成总结.md
git add docs/Git提交指南-pallet-trading重构.md

git commit -m "docs: 添加 pallet-trading 重构完整文档

文档清单:
1. pallet-trading重构方案.md - 详细重构方案
2. pallet-trading编译现状与建议.md - 编译错误分析
3. 前端API迁移指南-pallet-trading重构.md - API迁移对照表
4. pallet-trading重构-测试验证报告.md - 完整测试报告
5. 代码清理报告-pallet-trading重构.md - 清理详情
6. 代码清理完成总结.md - 清理总结
7. Git提交指南-pallet-trading重构.md - 本文档

文档覆盖:
- 重构方案和实施过程
- 编译验证和测试结果
- 前端适配指南
- 代码清理和归档
- Git 提交建议"
```

---

## 一键批量提交（可选）

如果希望一次性提交所有变更：

```bash
git add pallets/maker/ \
        pallets/otc-order/ \
        pallets/bridge/ \
        pallets/trading-common/ \
        pallets/trading/ \
        runtime/ \
        Cargo.toml \
        stardust-dapp/src/ \
        archived-pallets/ \
        docs/

git commit -m "feat: pallet-trading 模块化重构完成

重构概述:
将单体 pallet-trading 拆分为 4 个独立模块 + 1 个统一接口层

新增模块:
- pallet-maker: 做市商生命周期管理（470行）
- pallet-otc-order: OTC订单管理（564行，架构完成）
- pallet-bridge: 跨链桥接（470行，架构完成）
- pallet-trading-common: 共享工具库（150行）
- pallet-trading: 统一接口层（200行，向后兼容）

Runtime 集成:
- 完整配置 3 个新 pallet
- 更新 construct_runtime! 宏
- 所有编译验证通过

前端适配:
- 核心服务层完整迁移
- 5 个页面组件已适配
- 6 个页面待适配

代码清理:
- 归档 19 个旧文件和备份（412KB）
- 创建 3 个归档目录
- 主代码库完全清理

文档齐全:
- 7 个重构文档
- 4 个 pallet README
- 3 个归档说明

测试验证:
- ✅ Runtime 编译成功（13.68秒）
- ✅ 所有 pallet 编译成功
- ✅ 完整 workspace 编译成功（14.26秒）

参考文档:
- docs/pallet-trading重构方案.md
- docs/pallet-trading重构-测试验证报告.md
- docs/代码清理完成总结.md

后续工作:
- 实现 pallet-otc-order 业务逻辑
- 实现 pallet-bridge 业务逻辑
- 完成剩余 6 个前端页面适配
- 编写单元测试和集成测试"
```

---

## 提交注意事项

### 1. 提交前检查

```bash
# 检查编译
cargo check --workspace

# 检查格式（可选）
cargo fmt --check

# 检查 lints（可选）
cargo clippy --workspace

# 检查 Git 状态
git status
```

### 2. 提交信息规范

遵循 Conventional Commits 规范：

- `feat:` - 新功能
- `refactor:` - 重构
- `chore:` - 工具/配置变更
- `docs:` - 文档更新
- `test:` - 测试相关
- `fix:` - Bug 修复

### 3. 提交描述

好的提交描述应包含：
- ✅ 简洁的标题（< 50字符）
- ✅ 详细的正文说明
- ✅ 相关文档引用
- ✅ 待办事项提醒

### 4. 分支管理

建议：
- 创建新分支 `feature/trading-refactor`
- 所有提交在该分支完成
- 通过 PR 合并到主分支
- PR 需经代码审查

---

## 提交后验证

### 1. 本地验证

```bash
# 查看提交历史
git log --oneline -10

# 查看变更统计
git diff --stat main..feature/trading-refactor

# 查看具体变更
git diff main..feature/trading-refactor -- pallets/
```

### 2. CI/CD 验证

如有 CI/CD 流水线：
- ✅ 编译检查通过
- ✅ 单元测试通过（待实现）
- ✅ 集成测试通过（待实现）
- ✅ 代码规范检查通过

### 3. 人工审查

代码审查要点：
- ✅ 架构设计合理性
- ✅ 代码质量和规范
- ✅ 文档完整性
- ✅ 向后兼容性
- ✅ 性能影响评估

---

## 分支合并建议

### 合并到主分支

```bash
# 1. 更新主分支
git checkout main
git pull origin main

# 2. 切回特性分支
git checkout feature/trading-refactor

# 3. 变基到最新主分支
git rebase main

# 4. 解决冲突（如有）
# ... 解决冲突 ...
git rebase --continue

# 5. 推送到远程
git push origin feature/trading-refactor --force-with-lease

# 6. 创建 Pull Request
# 在 GitHub/GitLab 上创建 PR

# 7. 代码审查通过后合并
# 使用 Squash and Merge 或 Rebase and Merge
```

### 合并策略

**推荐**: Squash and Merge
- 优点：保持主分支历史清晰
- 缺点：丢失详细提交历史

**可选**: Rebase and Merge
- 优点：保留所有提交历史
- 缺点：主分支历史可能复杂

---

## 紧急回滚方案

如发现严重问题需要回滚：

### 方法1：Git Revert

```bash
# 撤销最后一次合并
git revert -m 1 <merge-commit-hash>

# 推送回滚
git push origin main
```

### 方法2：恢复归档

```bash
# 从归档恢复旧代码
cp -r archived-pallets/trading-old-2025-11-03/* \
   pallets/trading/src/

# 恢复 Runtime 配置
cp archived-pallets/runtime-backups-2025-11-03/lib.rs.backup \
   runtime/src/lib.rs

# 重新编译
cargo check --workspace

# 提交回滚
git add .
git commit -m "revert: 紧急回滚 pallet-trading 重构

原因: [具体问题描述]
恢复: 从归档恢复旧代码
状态: 已验证编译通过"
```

---

## 总结

### 提交检查清单

提交前确认：
- [ ] 所有代码编译通过
- [ ] 归档完整且有说明文档
- [ ] 文档齐全且准确
- [ ] 提交信息规范且清晰
- [ ] 分支管理正确
- [ ] 已本地验证变更

### 推荐流程

1. ✅ 按阶段分批提交（推荐）
2. ✅ 每次提交都编译验证
3. ✅ 提交信息清晰规范
4. ✅ 通过 PR 合并主分支
5. ✅ 代码审查后再合并

---

**文档版本**: v1.0  
**最后更新**: 2025-11-03  
**作者**: AI Assistant

