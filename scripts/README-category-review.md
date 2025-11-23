# 逝者分类交互式审核脚本使用说明

## 📋 功能概述

**脚本名称**: `review-recent-deceased-categories.js`

**核心功能**:
- ✅ Root账户查询最近N天创建的逝者（默认10天）
- ✅ 逐个展示逝者详细信息（姓名、性别、生平、当前分类等）
- ✅ 交互式人工审核和分类选择
- ✅ 使用sudo权限强制更新分类（绕过治理流程）
- ✅ 二次确认机制防止误操作
- ✅ 自动记录审核日志（JSON格式）
- ✅ 实时统计审核进度

---

## 🚀 快速开始

### 1. 前置条件

确保已安装依赖：
```bash
cd /home/xiaodong/文档/stardust
npm install  # 安装 @polkadot/api 等依赖
```

确保节点正在运行：
```bash
# 终端1：启动开发链
./target/release/solochain-template-node --dev

# 终端2：运行审核脚本
node scripts/review-recent-deceased-categories.js
```

### 2. 基本使用

**默认审核最近10天**：
```bash
node scripts/review-recent-deceased-categories.js
```

**自定义审核天数**（例如最近7天）：
```bash
node scripts/review-recent-deceased-categories.js 7
```

**审核最近30天**：
```bash
node scripts/review-recent-deceased-categories.js 30
```

---

## 🎯 使用流程

### 步骤1：启动脚本

```bash
$ node scripts/review-recent-deceased-categories.js

🚀 逝者分类交互式审核系统
================================================================================
📅 审核范围: 最近 10 天

🔗 正在连接到 Substrate 节点...
✅ 已连接到链: Development
   运行时版本: 101
👤 使用账户: Alice (5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY)
   (确保此账户拥有 sudo 权限)

🔍 正在查询最近 10 天创建的逝者...
📊 区块范围: 125000 -> 139400 (当前)
   (约 10.0 天)
✅ 找到 15 个最近创建的逝者

📊 开始审核 15 个逝者...
```

### 步骤2：查看逝者信息

脚本会逐个显示逝者详情：

```
[1/15]
================================================================================
📋 逝者ID: 10025
────────────────────────────────────────────────────────────────────────────────
姓名: 张三
性别: 男
生日: 1990/1/15
忌日: 2024/11/13
生平简介: 优秀的工程师，热爱技术和创新
当前分类: 普通民众 (Ordinary)
所有者: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
创建者: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
================================================================================
```

### 步骤3：选择分类

系统会显示所有可用分类：

```
📝 可选分类：
  [0] 普通民众 (Ordinary) - 默认分类，普通逝者
  [1] 历史人物 (HistoricalFigure) - 对历史有重大影响的人物
  [2] 革命烈士 (Martyr) - 为革命事业牺牲的英雄
  [3] 英雄模范 (Hero) - 各行业的杰出代表和模范人物
  [4] 公众人物 (PublicFigure) - 社会知名人士、明星、学者等
  [5] 宗教人物 (ReligiousFigure) - 宗教领袖或重要宗教人物
  [6] 事件馆 (EventHall) - 重大历史事件纪念
  [s] 跳过此逝者
  [q] 退出审核

请选择新分类 (输入编号/s/q): _
```

**输入选项**：
- `0-6`: 选择对应的分类
- `s`: 跳过当前逝者，继续下一个
- `q`: 退出整个审核流程

### 步骤4：确认变更

如果选择了新分类，系统会要求二次确认：

```
⚠️  确认变更：
   逝者ID: 10025
   旧分类: 普通民众
   新分类: 英雄模范
是否确认？(y/n): y
```

### 步骤5：输入变更理由（可选）

```
变更理由 (可选，直接回车跳过): 该逝者为抗疫医护人员，应归类为英雄模范
```

### 步骤6：执行更新

```
🔧 正在使用sudo权限更新分类...
✅ 交易已打包到区块: 0x1234...
✅ 交易已最终确认: 0x1234...
✅ 分类更新成功！
📄 审核日志已保存到: /home/xiaodong/文档/stardust/logs/category-review-2025-11-23.json
```

### 步骤7：完成审核

所有逝者审核完成后，显示统计信息：

```
================================================================================
📊 审核统计：
   总数: 15
   已审核: 15
   已更新: 8
   已跳过: 7
   失败: 0
================================================================================
✅ 审核完成！日志已保存到: /home/xiaodong/文档/stardust/logs/category-review-2025-11-23.json
```

---

## 📊 审核日志格式

日志文件位置：`logs/category-review-YYYY-MM-DD.json`

示例内容：
```json
[
  {
    "deceasedId": 10025,
    "fullName": "张三",
    "oldCategory": 0,
    "newCategory": 3,
    "reason": "该逝者为抗疫医护人员，应归类为英雄模范",
    "blockHash": "0x1234567890abcdef...",
    "reviewer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "timestamp": "2025-11-23T10:30:45.123Z"
  },
  {
    "deceasedId": 10026,
    "fullName": "李四",
    "oldCategory": 0,
    "newCategory": 1,
    "reason": "著名历史学家",
    "blockHash": "0xabcdef1234567890...",
    "reviewer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "timestamp": "2025-11-23T10:32:10.456Z"
  }
]
```

---

## 🔧 高级功能

### 1. 批量审核策略

**场景1：新上线系统，需审核所有历史数据**
```bash
# 审核最近90天（全部历史数据）
node scripts/review-recent-deceased-categories.js 90
```

**场景2：日常维护，每天审核新增**
```bash
# 设置定时任务，每天审核昨天新增
crontab -e
# 每天凌晨2点运行
0 2 * * * cd /home/xiaodong/文档/stardust && node scripts/review-recent-deceased-categories.js 1
```

### 2. 快捷键说明

| 按键 | 功能 | 说明 |
|------|------|------|
| `0-6` | 选择分类 | 输入数字选择对应分类 |
| `s` | 跳过 | 保持当前分类不变，继续下一个 |
| `q` | 退出 | 立即停止审核，保存已完成的记录 |
| `y` | 确认 | 确认分类变更 |
| `n` | 取消 | 取消分类变更，返回选择菜单 |

### 3. 错误处理

**如果交易失败**：
- 脚本会显示详细错误信息
- 询问是否继续审核其他逝者
- 失败的记录不会保存到日志

**常见错误**：
- `BadOrigin`: Alice账户没有sudo权限
- `DeceasedNotFound`: 逝者ID不存在
- `BadInput`: 分类代码无效

---

## ⚠️ 注意事项

### 1. 权限要求

- ⚠️ **必须使用拥有sudo权限的账户**（默认为Alice）
- 脚本使用 `sudo.sudo(deceased.forceSetCategory())` 强制更新分类
- 绕过正常的治理审批流程

### 2. 区块时间计算

- 假设出块时间为 **6秒/块**
- 1天 = 14,400个区块
- 10天 = 144,000个区块
- 如果实际出块时间不同，查询范围可能不准确

### 3. 数据查询限制

- 脚本使用 `DeceasedCreationTime` 索引查询
- 每100个区块为单位查询（优化RPC调用）
- 如果区块范围太大，查询可能耗时较长

### 4. 分类变更影响

修改分类会影响：
- ✅ 公众纪念馆显示（非Ordinary分类会显示）
- ✅ 分类索引 `DeceasedByCategory`
- ✅ 前端分类筛选结果
- ❌ 不影响已有的治理提案（如果存在）

### 5. 审核建议

**分类标准参考**：

| 分类 | 适用对象 | 审核要点 |
|------|---------|---------|
| **Ordinary** | 普通民众 | 默认分类，无特殊社会影响 |
| **HistoricalFigure** | 历史人物 | 对国家/社会历史有重大影响 |
| **Martyr** | 革命烈士 | 为革命事业牺牲的英雄 |
| **Hero** | 英雄模范 | 行业模范、抗疫英雄、见义勇为等 |
| **PublicFigure** | 公众人物 | 明星、学者、企业家等知名人士 |
| **ReligiousFigure** | 宗教人物 | 宗教领袖或重要宗教人物 |
| **EventHall** | 事件馆 | 重大历史事件纪念（而非个人） |

---

## 🐛 故障排查

### 问题1：无法连接到节点

```
❌ 错误: WebSocket connection failed
```

**解决方案**：
1. 确认节点是否运行：`ps aux | grep solochain-template-node`
2. 检查端口是否正确：默认 `ws://127.0.0.1:9944`
3. 修改脚本中的 `WsProvider` 地址

### 问题2：没有查询到逝者

```
✅ 找到 0 个最近创建的逝者
```

**可能原因**：
1. 最近N天内确实没有新建逝者
2. `DeceasedCreationTime` 索引未维护（检查 pallet 代码）
3. 区块时间计算偏差太大

**解决方案**：
- 增大查询天数：`node scripts/review-recent-deceased-categories.js 30`
- 检查链上是否有逝者数据：`api.query.deceased.deceasedOf.entries()`

### 问题3：sudo权限错误

```
❌ 错误: sudo.RequireSudo: Sender must be the Sudo account
```

**解决方案**：
1. 确认当前账户是sudo账户：`api.query.sudo.key()`
2. 修改脚本使用正确的账户（默认Alice）
3. 开发链中Alice是默认sudo账户

---

## 📚 相关文档

- **Pallet源码**: `pallets/deceased/src/lib.rs`
- **分类枚举定义**: `pallets/deceased/src/lib.rs:338` (`DeceasedCategory`)
- **强制设置分类函数**: `pallets/deceased/src/lib.rs:6440` (`forceSetCategory`)
- **分类索引存储**: `pallets/deceased/src/lib.rs:780` (`DeceasedByCategory`)
- **创建时间索引**: `pallets/deceased/src/lib.rs:788` (`DeceasedCreationTime`)

---

## 🔄 更新历史

- **2025-11-23**: 初始版本
  - 基础交互式审核功能
  - 支持最近N天查询
  - 自动日志记录
  - 二次确认机制

---

## 📞 技术支持

如有问题或建议，请联系开发团队或提交Issue。
