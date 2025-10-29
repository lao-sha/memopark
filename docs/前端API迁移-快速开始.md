# 🚀 前端API迁移 - 快速开始指南

**📅 日期**: 2025-10-29  
**⏱️ 预计时间**: 10-30分钟  
**🎯 目标**: 将前端从 `pallet-otc-order` 迁移到 `pallet-trading`

---

## 📝 迁移背景（1分钟阅读）

### 为什么要迁移？

**链端架构调整 (Phase 2)**：
- ❌ **旧架构**：3个独立 pallet (`otc-order`, `market-maker`, `simple-bridge`)
- ✅ **新架构**：1个统一 pallet (`trading`)
  - `trading::otc` - OTC 订单功能
  - `trading::maker` - 做市商功能
  - `trading::bridge` - 跨链桥功能

### 前端必须迁移

链端已经移除 `pallet-otc-order`，前端如果不迁移会导致：
- ❌ 无法查询订单数据
- ❌ 无法创建新订单
- ❌ 无法执行任何 OTC 交易

---

## 🎬 一键执行（最快路径）

### 第1步：执行迁移脚本（5-10分钟）

```bash
cd /home/xiaodong/文档/stardust
./前端API迁移-一键执行.sh
```

**脚本会自动完成**：
1. ✅ 创建 Git 备份标签
2. ✅ 统计待迁移 API 引用
3. ✅ 替换所有 Query API
4. ✅ 替换所有 TX API
5. ✅ 替换所有 Event API
6. ✅ 验证替换结果
7. ✅ (可选) 编译验证
8. ✅ (可选) Git 提交

**预期输出**：
```
✅ 所有 API 引用已完全迁移！
📊 迁移统计：
   • 迁移前 API 引用: 73 处
   • 迁移后 API 残留: 0 处
   • 修改文件数: 22 个
```

---

### 第2步：功能测试（10-20分钟）

启动开发环境：

```bash
# 终端1: 启动链节点
cd /home/xiaodong/文档/stardust
./启动所有服务.sh

# 终端2: 启动前端
cd stardust-dapp
npm run dev
```

**快速测试清单**（按优先级）：

#### 🔴 必测（5分钟）
- [ ] 打开 OTC 订单列表页面
- [ ] 查看订单详情
- [ ] 创建新订单

#### 🟡 重要（5分钟）
- [ ] 标记订单已付款
- [ ] 做市商释放 DUST
- [ ] 取消订单

#### 🟢 可选（10分钟）
- [ ] 发起订单争议
- [ ] 创建首购订单
- [ ] 领取免费 DUST

**测试通过标准**：
- ✅ 所有功能可正常使用
- ✅ 无浏览器控制台错误
- ✅ 数据显示正常

---

## 🔍 验证要点

### 编译检查

```bash
cd stardust-dapp
npm run build
```

**期望结果**：
- ✅ 编译成功
- ✅ 无 API 不存在的错误
- ✅ 无类型错误

### 代码检查

```bash
cd stardust-dapp/src

# 检查是否还有残留的 otcOrder 引用
grep -r "api\.query\.otcOrder\." . --include="*.ts" --include="*.tsx"
grep -r "api\.tx\.otcOrder\." . --include="*.ts" --include="*.tsx"
grep -r "api\.events\.otcOrder\." . --include="*.ts" --include="*.tsx"
```

**期望结果**：
```bash
# 应该没有任何输出（表示已完全迁移）
```

---

## ⚠️ 关键函数名变化

迁移过程中，有3个函数名发生了变化（已自动处理）：

| 旧函数名 | 新函数名 | 用途 |
|---------|---------|------|
| `markOrderPaid` | `markPaid` | 标记订单已付款 |
| `releaseOrder` | `releaseDust` | 释放DUST给买家 |
| `claimFreeMemo` | `claimFreeDust` | 领取免费DUST |

**示例**：
```typescript
// ❌ 旧代码
api.tx.otcOrder.markOrderPaid(orderId, txHash, contact)

// ✅ 新代码
api.tx.trading.markPaid(orderId, txHash, contact)
```

---

## 🚨 问题处理

### 问题1: 脚本报错 "残留 X 处未替换"

**原因**：可能有特殊情况的API引用

**解决**：
```bash
# 查看具体位置
cd stardust-dapp/src
grep -rn "api\..*\.otcOrder\." . --include="*.ts" --include="*.tsx"

# 手动修改这些文件
```

---

### 问题2: 编译错误 "Property 'otcOrder' does not exist"

**原因**：有遗漏的API引用

**解决**：
1. 查看错误提示的文件和行号
2. 手动将 `otcOrder` 改为 `trading`
3. 重新编译

---

### 问题3: 运行时错误 "Cannot read property of undefined"

**原因**：可能有条件检查代码

**解决**：
```typescript
// ❌ 错误代码
if (api.query.otcOrder) {  // otcOrder 已不存在
  // ...
}

// ✅ 正确代码
if (api.query.trading) {
  // ...
}
```

---

### 问题4: 测试失败 - 功能不可用

**可能原因**：
1. 链节点未启动或版本不匹配
2. 前端缓存未清除
3. API 迁移不完整

**解决步骤**：
```bash
# 1. 重启链节点
cd /home/xiaodong/文档/stardust
./停止所有服务.sh
./启动所有服务.sh

# 2. 清除前端缓存
cd stardust-dapp
rm -rf node_modules/.vite
rm -rf dist
npm run dev

# 3. 检查 API 完整性
cd src
grep -r "otcOrder" . --include="*.ts" --include="*.tsx"
```

---

## 🔙 回滚方案

如果迁移后出现严重问题，可以快速回滚：

```bash
cd /home/xiaodong/文档/stardust

# 查看备份标签
git tag -l "before-otc-api*"

# 回滚到迁移前（例如）
git reset --hard before-otc-api-migration-20251029-140000

# 重启前端
cd stardust-dapp
npm run dev
```

**注意**：回滚后需要重新迁移

---

## 📊 成功标准

迁移成功需要满足：

### 编译层面
- ✅ TypeScript 编译通过
- ✅ 无 API 不存在错误
- ✅ 无类型错误

### 代码层面
- ✅ 无残留的 `api.query.otcOrder.*` 引用
- ✅ 无残留的 `api.tx.otcOrder.*` 引用
- ✅ 无残留的 `api.events.otcOrder.*` 引用

### 功能层面
- ✅ OTC 订单列表正常显示
- ✅ 创建订单功能正常
- ✅ 付款标记功能正常
- ✅ 释放 DUST 功能正常
- ✅ 取消订单功能正常
- ✅ 争议功能正常

---

## 📚 相关文档

### 详细文档
- **完整迁移方案**: `docs/前端API迁移-OtcOrder到Trading.md`
  - API 映射对照表
  - 详细测试清单
  - 常见问题解答

### 链端文档
- **Trading Pallet**: `pallets/trading/README.md`
- **OTC 模块源码**: `pallets/trading/src/otc.rs`
- **Runtime 配置**: `runtime/src/configs/mod.rs`

---

## ⏱️ 时间估算

| 任务 | 预计时间 | 说明 |
|------|---------|------|
| 阅读文档 | 1-2 分钟 | 本快速指南 |
| 执行脚本 | 5-10 分钟 | 自动化迁移 |
| 编译验证 | 2-3 分钟 | 可选 |
| 功能测试 | 10-20 分钟 | 核心功能 |
| **总计** | **18-35 分钟** | 含测试 |

---

## 🎯 执行检查清单

迁移完成后，检查以下项目：

### 迁移执行
- [ ] 脚本执行成功
- [ ] Git 备份已创建
- [ ] 所有 API 引用已替换

### 编译验证
- [ ] TypeScript 编译通过
- [ ] 无新的编译错误
- [ ] 无 API 相关警告

### 功能测试
- [ ] OTC 订单列表可访问
- [ ] 创建订单功能正常
- [ ] 订单详情显示正常
- [ ] 付款标记功能正常
- [ ] 释放 DUST 功能正常

### 代码审查
- [ ] 无残留的 `otcOrder` API 引用
- [ ] 函数名已正确更新
- [ ] 事件监听已更新

### Git 管理
- [ ] 更改已提交
- [ ] 备份标签已创建
- [ ] 完成标签已创建

---

## 📞 需要帮助？

### 查看脚本输出
脚本会提供详细的进度信息和错误提示

### 查看编译日志
```bash
# 如果选择了编译验证
cat /tmp/otc-api-migration-build.log
```

### 手动检查修改
```bash
cd /home/xiaodong/文档/stardust
git diff stardust-dapp/src
```

---

**🚀 准备好了吗？执行第1步开始迁移！**

```bash
cd /home/xiaodong/文档/stardust
./前端API迁移-一键执行.sh
```

---

**📅 创建时间**: 2025-10-29  
**✍️ 创建者**: AI Assistant  
**🔄 版本**: v1.0  
**📦 状态**: ✅ 就绪

