# 📊 第二轮重命名 - 执行清单

**📅 日期**: 2025-10-29  
**🎯 目标**: 全面重命名项目中所有"MEMO"和"stardust"字样  
**✅ 状态**: **方案就绪，待执行**

---

## 🏆 扫描结果

### 统计数据
| 类型 | MEMO出现 | stardust出现 | 总计 |
|------|---------|-------------|------|
| Rust源码 | 265 | 170 | 435 |
| TypeScript/TSX | 366 | 32 | 398 |
| Markdown文档 | 2027 | 1311 | 3338 |
| 配置文件 | 102 | 28 | 130 |
| **总计** | **2760** | **1541** | **4301** |

### 主要分布
- **UI显示文本**: ~250处（前端，用户可见）
- **代码注释**: ~200处（Rust + TypeScript）
- **Package配置**: ~10处（package.json + Cargo.toml）
- **文档内容**: ~3000处（README + 使用说明）

---

## 📁 已创建的工具

### 自动化脚本（3个）

#### 1. rename-ui-text.sh ⭐️ 高优先级
- **功能**: 更新前端UI显示文本 (MEMO → DUST)
- **范围**: ~250处
- **风险**: 🟢 低
- **时间**: 5分钟
- **可立即执行**: ✅

#### 2. rename-code-comments.sh 🟡 中优先级
- **功能**: 更新代码注释 (MEMO → DUST)
- **范围**: ~200处
- **风险**: 🟢 低
- **时间**: 5分钟
- **可立即执行**: ✅

#### 3. update-package-configs.sh 🟡 中优先级
- **功能**: 更新Package配置 (stardust → stardust)
- **范围**: ~10处
- **风险**: 🟡 中
- **时间**: 3分钟
- **需要测试**: ⚠️

### 文档（1份）

#### 第二轮重命名方案-MEMO和stardust全面分析.md
- **内容**: 完整的分析和修改方案
- **章节**: 6类修改，4阶段方案
- **页数**: ~1400行

---

## 🎯 执行路线图

### 推荐执行顺序（渐进式）⭐️

```
阶段A: UI文本重命名（立即可做）
   ↓
   编译验证 + UI测试
   ↓
阶段B: Package配置更新（UI完成后）
   ↓
   构建验证 + 功能测试
   ↓
阶段C: 代码注释更新（可选）
   ↓
   文档检查
   ↓
阶段D: 批量文档更新（最后）
```

---

## 🚀 快速开始

### 选项A: 立即执行UI文本更新（推荐）⭐️⭐️⭐️⭐️⭐️

**目的**: 更新用户可见的所有"MEMO"显示文本

**步骤**:
```bash
cd /home/xiaodong/文档/stardust

# 执行UI文本重命名
./docs/rename-ui-text.sh

# 编译验证
cd stardust-dapp
npm run build
```

**测试清单**:
- [ ] Bridge页面：金额单位显示为"DUST"
- [ ] OTC页面：金额单位显示为"DUST"
- [ ] 所有表单：输入提示显示"DUST"
- [ ] 余额显示：单位显示为"DUST"

**预期结果**: 
- ✅ 所有UI中的"MEMO"改为"DUST"
- ✅ 编译通过
- ⚠️ 可能有项目原有错误（与重命名无关）

---

### 选项B: 完整执行（三步走）

**第1步: UI文本**
```bash
./docs/rename-ui-text.sh
# 测试UI显示
```

**第2步: Package配置**
```bash
./docs/update-package-configs.sh
# 验证构建
```

**第3步: 代码注释**
```bash
./docs/rename-code-comments.sh
# 检查文档
```

---

### 选项C: 分阶段执行（保守）

**今天**: UI文本重命名
- 执行 `rename-ui-text.sh`
- 测试1-2天

**明天**: Package配置更新
- 执行 `update-package-configs.sh`
- 验证构建流程

**后续**: 代码注释更新
- 执行 `rename-code-comments.sh`
- 时间充裕时执行

---

## 📋 详细修改范围

### 阶段A: UI文本重命名

**修改内容**:
```typescript
// 修改前
<Text>{amount} MEMO</Text>
<Input suffix="MEMO" />
return `${value} MEMO`

// 修改后
<Text>{amount} DUST</Text>
<Input suffix="DUST" />
return `${value} DUST`
```

**影响文件**:
- `stardust-dapp/src/**/*.tsx` - ~200处
- `stardust-governance/src/**/*.tsx` - ~50处

**修改点**: ~250处

---

### 阶段B: Package配置更新

**修改内容**:
```json
// package.json
{
  "name": "stardust-dapp",  → "stardust-dapp"
  "repository": "stardust.git"  → "stardust.git"
}
```

**影响文件**:
- `stardust-dapp/package.json`
- `stardust-governance/package.json`
- `stardust-gov/package.json`
- `Cargo.toml`

**修改点**: ~10处

---

### 阶段C: 代码注释更新

**修改内容**:
```rust
// Rust注释
/// 最高押金上限：单次押金不超过 100,000 MEMO
// → 改为
/// 最高押金上限：单次押金不超过 100,000 DUST
```

```typescript
// TypeScript注释
/**
 * 函数级中文注释：格式化 MEMO 金额
 */
// → 改为
/**
 * 函数级中文注释：格式化 DUST 金额
 */
```

**影响文件**:
- Rust: `runtime/`, `pallets/` - ~130处
- TypeScript: `stardust-dapp/`, `stardust-governance/` - ~70处

**修改点**: ~200处

---

## ✅ 质量保证

### 安全机制

**Git备份**:
- `before-ui-text-rename` - UI文本重命名前
- `before-package-rename` - Package配置更新前
- `before-comment-rename` - 注释重命名前

**回滚方案**:
```bash
# 回滚UI文本修改
git reset --hard before-ui-text-rename

# 回滚Package配置
git reset --hard before-package-rename

# 回滚注释修改
git reset --hard before-comment-rename
```

---

### 测试计划

#### UI测试
- [ ] Bridge页面显示
- [ ] OTC页面显示
- [ ] 余额显示
- [ ] 表单提示
- [ ] 错误消息

#### 构建测试
- [ ] 前端编译
- [ ] 链端编译
- [ ] 生成的文件名

#### 功能测试
- [ ] 交易功能
- [ ] 查询功能
- [ ] API调用

---

## 🚨 重要决策

### 决策1: 常量名不重命名 ✅

**决定**: 保持 `MEMO_PRECISION` 等常量名不变

**理由**:
- 避免破坏性修改
- 降低风险
- 常量名不影响用户体验

---

### 决策2: Chain Spec延后 ✅

**决定**: Runtime元数据和Chain Spec在Phase 3处理

**理由**:
- 高风险（可能导致链不兼容）
- 需要充分测试
- 需要团队决策

---

### 决策3: Git历史不修改 ✅

**决定**: 历史提交消息保持不变

**理由**:
- 不应修改Git历史
- 历史记录仅供参考
- 修改历史会影响所有克隆

---

## 📊 对比第一轮

### 第一轮重命名（已完成）✅
- **变量名**: memoAmount → dustAmount (~60处)
- **API路径**: memoAppeals → stardustAppeals (~41处)
- **提交**: 2次，20个文件，222行

### 第二轮重命名（待执行）⏳
- **UI文本**: MEMO → DUST (~250处)
- **代码注释**: MEMO → DUST (~200处)
- **Package配置**: stardust → stardust (~10处)
- **文档**: 可选（~3000处）

### 总计
| 项目 | 第一轮 | 第二轮 | 总计 |
|------|--------|--------|------|
| 修改点 | ~101 | ~460 | ~561 |
| 修改文件 | 20 | ~90 | ~110 |
| 修改行数 | 222 | ~500 | ~722 |

---

## 🎯 成功标准

### 技术标准
- [ ] 所有UI中的"MEMO"改为"DUST"
- [ ] 所有代码注释中的"MEMO"改为"DUST"
- [ ] Package名称更新
- [ ] 编译通过
- [ ] 功能测试通过

### 业务标准
- [ ] 用户看到的所有文本显示"DUST"
- [ ] 开发文档中使用"DUST"
- [ ] 配置文件中使用"stardust"

---

## 📞 相关文档

### 第一轮重命名
- `docs/变量重命名方案-memo变量分析.md`
- `docs/变量重命名-执行完成报告.md`
- `docs/API路径更新-完成报告.md`
- `RENAME_COMPLETE_SUMMARY.md`

### 第二轮重命名
- `docs/第二轮重命名方案-MEMO和stardust全面分析.md`
- `docs/rename-ui-text.sh`
- `docs/rename-code-comments.sh`
- `docs/update-package-configs.sh`

---

## 💡 执行建议

### 建议1: 先执行UI文本 ⭐️

**原因**:
- 用户可见
- 风险最低
- 收益最高
- 立即可做

**执行**:
```bash
cd /home/xiaodong/文档/stardust
./docs/rename-ui-text.sh
```

---

### 建议2: 分阶段测试

**策略**:
1. 执行一个脚本
2. 编译验证
3. 功能测试
4. 确认无误后继续下一个

**优点**:
- 问题容易定位
- 回滚成本低
- 风险可控

---

### 建议3: 保留文档更新到最后

**原因**:
- 影响小
- 优先级低
- 可分批进行

---

## 🎊 总结

### 第二轮重命名准备就绪！

**✅ 已完成**:
- 全面扫描和分析（4301处引用）
- 详细方案设计（6类修改，4阶段）
- 3个自动化脚本（可立即执行）
- 完整文档（1400行）

**⏳ 待执行**:
- UI文本重命名（~250处，5分钟）
- Package配置更新（~10处，3分钟）
- 代码注释更新（~200处，5分钟）

**🎯 预计总时间**: 15-30分钟（执行） + 1-2小时（测试）

---

**🚀 下一步：执行 `./docs/rename-ui-text.sh` 开始第二轮重命名！**

---

**📅 清单生成时间**: 2025-10-29  
**✍️ 创建者**: AI Assistant  
**🔄 版本**: v1.0  
**📦 状态**: ✅ 就绪，可立即执行
