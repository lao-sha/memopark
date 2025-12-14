# 前端适配改进 - 八字AI解盘功能

## 📋 改进概述

针对"区块链节点未包含八字命理模块"的问题，对前端进行了全面适配，提供友好的用户体验和错误处理。

## ✨ 新增功能

### 1. 节点状态检测服务 (`nodeStatusService.ts`)

**功能**：
- ✅ 检测区块链节点是否在线
- ✅ 检测 BaziChart pallet 是否可用
- ✅ 提供友好的错误提示和解决方案
- ✅ 生成启动节点的帮助信息

**API**：

```typescript
// 检查节点状态
const status = await checkNodeStatus();
// 返回：{ isOnline, hasBaziChart, error?, userMessage? }

// 检查 BaziChart 是否可用
const available = await checkBaziChartAvailable();

// 获取友好的错误提示
const message = getFriendlyErrorMessage(error);

// 获取启动帮助
const help = getStartNodeHelp();
```

**错误检测覆盖**：
- ❌ 节点未启动 → 提供启动命令
- ❌ 节点版本过旧 → 提供更新指引
- ❌ 缺少 BaziChart pallet → 提供编译指引
- ❌ 钱包未连接 → 提示连接钱包
- ❌ 通用错误 → 显示原始错误信息

### 2. 节点状态检查组件 (`NodeStatusChecker.tsx`)

**功能**：
- ✅ 自动检测节点状态（可配置间隔）
- ✅ 显示实时状态提示（成功/警告/错误）
- ✅ 提供启动指引弹窗
- ✅ 一键复制启动命令
- ✅ 手动重新检查功能

**使用方式**：

```tsx
import NodeStatusChecker from '../components/NodeStatusChecker';

<NodeStatusChecker
  autoCheck={true}           // 自动检查
  checkInterval={10000}      // 10秒检查一次
  onSuccess={() => {}}       // 检查成功回调
/>
```

**界面展示**：

```
┌─────────────────────────────────────┐
│ ✓ 节点状态正常                       │
└─────────────────────────────────────┘
（状态正常时自动隐藏）

┌─────────────────────────────────────┐
│ ⚠ 节点未包含八字命理模块              │
│                                     │
│ 节点未包含八字命理模块，请更新节点版本  │
│                                     │
│ [查看启动指引] [重新检查]             │
└─────────────────────────────────────┘
（状态异常时显示详细信息）
```

**启动指引弹窗**：

```
┌─────────────────────────────────────┐
│ ⚠ 如何启动区块链节点                 │
├─────────────────────────────────────┤
│ 1. 打开新终端窗口                    │
│ 2. 进入项目目录                      │
│ 3. 运行启动脚本                      │
│ 4. 等待节点启动完成（约10秒）         │
│ 5. 刷新此页面                        │
├─────────────────────────────────────┤
│ 启动命令                             │
│ ┌─────────────────────────────────┐ │
│ │ cd /home/xiaodong/文档/stardust │ │
│ │ ./restart-with-bazi.sh          │ │
│ └─────────────────────────────────┘ │
│ （点击复制）                         │
├─────────────────────────────────────┤
│ 提示：节点启动后会自动开始出块...     │
├─────────────────────────────────────┤
│ [我知道了] [重新检查]                │
└─────────────────────────────────────┘
```

### 3. BaziPage 改进

**新增功能**：
- ✅ 集成节点状态检查组件
- ✅ 改进错误提示（使用 Modal 显示详细信息）
- ✅ 友好的错误消息处理

**改进前**：
```typescript
catch (error) {
  message.error(`保存失败: ${error.message}`);
  // 错误信息简短，用户不知道如何解决
}
```

**改进后**：
```typescript
catch (error) {
  const friendlyMessage = getFriendlyErrorMessage(error);
  Modal.error({
    title: '保存失败',
    content: <pre>{friendlyMessage}</pre>,
    width: 500,
  });
  // 显示友好的错误提示和解决方案
}
```

## 🎯 用户体验提升

### 场景1：节点未启动

**改进前**：
```
❌ 保存失败: CONNECTION ERROR
（用户不知道怎么办）
```

**改进后**：
```
⚠️ 区块链节点未启动

请在终端运行以下命令启动节点：
cd /home/xiaodong/文档/stardust
./restart-with-bazi.sh

[查看启动指引] [重新检查]
```

### 场景2：节点版本过旧

**改进前**：
```
❌ 保存失败: 区块链节点未包含八字命理模块（pallet-bazi-chart）
（用户不知道如何更新）
```

**改进后**：
```
⚠️ 节点版本过旧

您的节点不包含八字命理模块，请更新：
1. 停止旧节点
2. 运行: ./restart-with-bazi.sh
3. 或手动编译: cargo build --release -p stardust-node

[查看启动指引] [重新检查]
```

### 场景3：钱包未连接

**改进前**：
```
❌ 保存失败: signer not found
```

**改进后**：
```
⚠️ 请先连接钱包

点击右上角的"连接钱包"按钮
```

## 🔄 自动化特性

### 1. 自动检测节点状态

组件会：
- 页面加载时自动检查
- 每10秒自动重新检查
- 检测到节点恢复后自动隐藏提示

### 2. 智能错误处理

系统会：
- 自动识别错误类型
- 提供针对性的解决方案
- 显示可复制的命令

### 3. 无侵入式设计

- 节点正常时：不显示任何提示
- 节点异常时：在页面顶部显示友好提示
- 不阻塞用户其他操作

## 📱 界面展示

### 正常状态
```
┌─────────────────────────────────────┐
│ 八字命理 · 排盘                      │
├─────────────────────────────────────┤
│ [正常使用，无提示]                   │
└─────────────────────────────────────┘
```

### 异常状态
```
┌─────────────────────────────────────┐
│ ⚠ 节点未包含八字命理模块              │
│ 节点未包含八字命理模块，请更新节点版本  │
│ [查看启动指引] [重新检查]             │
├─────────────────────────────────────┤
│ 八字命理 · 排盘                      │
├─────────────────────────────────────┤
│ [继续使用其他功能]                   │
└─────────────────────────────────────┘
```

## 🛠️ 技术实现

### 文件结构

```
stardust-dapp/src/
├── services/
│   └── nodeStatusService.ts        # 节点状态检测服务
├── components/
│   └── NodeStatusChecker.tsx       # 节点状态检查组件
└── features/
    └── bazi/
        └── BaziPage.tsx            # 八字排盘页面（已集成）
```

### 依赖关系

```
BaziPage.tsx
  ├── NodeStatusChecker.tsx
  │   └── nodeStatusService.ts
  └── getFriendlyErrorMessage()
      └── nodeStatusService.ts
```

### 核心逻辑

```typescript
// 1. 检查节点状态
const status = await checkNodeStatus();

// 2. 根据状态显示不同UI
if (!status.isOnline) {
  // 显示"节点未启动"警告
} else if (!status.hasBaziChart) {
  // 显示"缺少模块"警告
} else {
  // 不显示任何提示
}

// 3. 捕获错误并友好提示
try {
  await saveBaziToChain(params);
} catch (error) {
  const message = getFriendlyErrorMessage(error);
  Modal.error({ content: message });
}
```

## 📊 改进对比

| 项目 | 改进前 | 改进后 |
|------|--------|--------|
| 错误提示 | 简短的技术错误 | 友好的用户提示 |
| 解决方案 | 无 | 提供详细步骤 |
| 自动检测 | 无 | 每10秒自动检查 |
| 启动指引 | 无 | 弹窗显示步骤 |
| 命令复制 | 手动复制 | 一键复制 |
| 重新检查 | 需刷新页面 | 点击按钮即可 |

## 🎨 样式定制

组件支持 Ant Design 主题定制：

```css
/* 成功状态 - 绿色 */
.ant-alert-success { ... }

/* 警告状态 - 黄色 */
.ant-alert-warning { ... }

/* 错误状态 - 红色 */
.ant-alert-error { ... }

/* 信息状态 - 蓝色 */
.ant-alert-info { ... }
```

## 🔧 配置选项

### NodeStatusChecker 组件

```typescript
interface NodeStatusCheckerProps {
  /** 检查成功后的回调 */
  onSuccess?: () => void;

  /** 是否自动检查（默认 true） */
  autoCheck?: boolean;

  /** 检查间隔（毫秒，默认 5000） */
  checkInterval?: number;
}
```

### 使用示例

```tsx
// 基础用法
<NodeStatusChecker />

// 自定义配置
<NodeStatusChecker
  autoCheck={true}
  checkInterval={10000}
  onSuccess={() => console.log('节点正常')}
/>

// 只显示，不自动检查
<NodeStatusChecker autoCheck={false} />
```

## 🚀 部署建议

1. **开发环境**：
   - 保持自动检查开启
   - 检查间隔：10秒
   - 显示详细错误信息

2. **生产环境**：
   - 可以关闭自动检查
   - 仅在操作失败时显示错误
   - 提供更通用的解决方案

## 📝 测试场景

### 1. 节点未启动
```bash
# 停止节点
pkill stardust-node

# 访问页面
# 应该看到"节点未启动"警告
```

### 2. 节点版本过旧
```bash
# 启动旧版本节点（不包含 BaziChart）
# 访问页面
# 应该看到"缺少模块"警告
```

### 3. 节点恢复
```bash
# 启动新版本节点
./restart-with-bazi.sh

# 等待10秒
# 页面应自动隐藏警告
```

## 💡 最佳实践

1. **始终检查节点状态**：
   - 在关键操作前检查节点
   - 提供明确的错误提示

2. **友好的错误消息**：
   - 使用 `getFriendlyErrorMessage()` 处理所有错误
   - 避免显示技术性错误信息

3. **提供解决方案**：
   - 每个错误都应该有对应的解决步骤
   - 提供可复制的命令

4. **自动化检测**：
   - 使用 `autoCheck` 自动检测状态
   - 避免让用户手动刷新

## 🎯 未来优化

1. **WebSocket 通知**：
   - 实时推送节点状态变化
   - 减少轮询频率

2. **多语言支持**：
   - 支持中英文切换
   - 国际化错误提示

3. **高级诊断**：
   - 检测节点版本号
   - 显示 runtime 版本信息

4. **一键修复**：
   - 点击按钮自动执行修复脚本
   - 实时显示修复进度

---

**创建时间**: 2025-12-07
**版本**: v1.0
**状态**: ✅ 已完成并测试
