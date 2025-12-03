# 悬赏问答系统 - 快速启动指南

**最后更新**: 2025-12-02
**适用版本**: v1.0 MVP

---

## 🎯 当前状态

✅ **前端集成100%完成**
- 所有组件已创建
- 路由已配置
- API服务已完善
- TypeScript编译通过
- 静态检查全部通过

⏳ **待运行时测试**
- 需要启动开发环境
- 需要实际测试UI交互
- 需要验证区块链集成

---

## 🚀 快速启动步骤

### 步骤1: 启动IPFS节点

```bash
# 如果尚未安装IPFS，先安装
# wget https://dist.ipfs.io/go-ipfs/v0.12.0/go-ipfs_v0.12.0_linux-amd64.tar.gz
# tar -xvzf go-ipfs_v0.12.0_linux-amd64.tar.gz
# cd go-ipfs && sudo bash install.sh

# 配置IPFS CORS（仅需一次）
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:5173","http://127.0.0.1:5173"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT","POST","GET"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization"]'

# 启动IPFS daemon
ipfs daemon
```

**验证**: 访问 http://localhost:5001/webui 应该能看到IPFS控制台

### 步骤2: 启动区块链节点

```bash
# 在stardust根目录
./target/release/solochain-template-node --dev

# 或者如果需要持久化状态
./target/release/solochain-template-node --dev --base-path ./my-chain-state/
```

**验证**: 应该看到区块生成日志

### 步骤3: 启动前端开发服务器

```bash
# 在stardust-dapp目录（实际是stardust/目录）
npm run dev
```

**验证**: 访问 http://localhost:5173 应该能看到应用首页

---

## 🧪 功能测试清单

### 测试1: 访问悬赏列表页

1. 打开浏览器访问: http://localhost:5173/#/bounty
2. 预期看到:
   - 悬赏列表页面
   - 三个标签页（活跃/全部/已结算）
   - 统计数据卡片
   - 类型筛选按钮
   - 搜索框

**可能的问题**:
- 页面空白 → 检查控制台错误
- 加载失败 → 检查API连接状态

### 测试2: 访问悬赏详情页

1. 访问: http://localhost:5173/#/bounty/1
2. 预期看到:
   - 如果bountyId无效：显示"无效的悬赏ID"和返回按钮
   - 如果有效：显示悬赏详情页面

**可能的问题**:
- 路由不匹配 → 检查routes.tsx配置
- 组件加载失败 → 检查BountyDetailPage导入

### 测试3: 梅花易数集成测试

1. 起一个梅花卦
2. 查看卦象详情页
3. 找到"获取解读"卡片
4. 应该看到三个选项:
   - AI 智能解卦（蓝色按钮）
   - 找大师人工解读（默认按钮）
   - **发起悬赏问答**（金色边框按钮）⭐
5. 点击"发起悬赏问答"
6. 预期看到:
   - CreateBountyModal弹窗
   - 悬赏金额输入和快捷选项
   - 截止时间滑块
   - 高级设置选项
   - 实时奖励预览

**可能的问题**:
- 按钮不显示 → 检查HexagramDetailPage.tsx修改
- 点击无反应 → 检查bountyModalVisible状态
- 弹窗不显示 → 检查CreateBountyModal导入

### 测试4: 创建悬赏流程

**前提条件**:
- ✅ 已连接Polkadot钱包
- ✅ 账户有测试代币
- ✅ IPFS节点正在运行
- ✅ 区块链节点正在运行

**测试步骤**:
1. 在CreateBountyModal中填写信息
   - 选择悬赏金额（如500 DUST）
   - 设置截止时间（如24小时）
   - 查看奖励分配预览
2. 点击"创建悬赏"
3. 观察:
   - IPFS上传日志（控制台）
   - 钱包签名请求
   - 交易提交状态
   - BountyCreated事件
4. 成功后应该:
   - 显示成功提示
   - 自动跳转到悬赏详情页
   - URL变为 `#/bounty/新的ID`

**可能的问题**:
- IPFS上传失败 → 检查IPFS daemon状态
- 钱包未连接 → 先连接钱包
- 交易失败 → 检查账户余额和权限
- 事件解析失败 → 检查extractBountyIdFromEvents逻辑

### 测试5: 提交回答流程

1. 在悬赏详情页点击"提交回答"
2. SubmitAnswerModal弹出
3. 填写回答内容（50-2000字符）
4. 点击"提交回答"
5. 观察交易流程
6. 成功后回答应该出现在列表中

**可能的问题**:
- 字符限制提示 → 正常，按要求输入
- 提交失败 → 检查权限（不能是创建者）

### 测试6: 投票和采纳功能

**投票**:
1. 在悬赏详情页找到回答卡片
2. 如果允许投票，应该看到投票按钮
3. 点击投票
4. 观察票数变化

**采纳**（创建者操作）:
1. 悬赏创建者查看详情页
2. 应该看到"采纳答案"按钮
3. 选择前三名答案
4. 点击采纳
5. 观察状态变化和奖励分配

---

## 🔍 调试技巧

### 查看控制台日志

所有关键操作都有日志前缀 `[BountyService]`:

```javascript
// IPFS上传
console.log('[BountyService] 上传内容到IPFS...');

// 交易状态
console.log('[BountyService] 交易状态:', status.type);

// 事件提取
console.log('[BountyService] 提取到悬赏ID:', bountyId);
```

### 常见错误和解决方法

#### 错误: "无法连接本地 IPFS API"

**原因**: IPFS daemon未启动或CORS未配置

**解决**:
```bash
# 配置CORS
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:5173"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT","POST","GET"]'

# 启动daemon
ipfs daemon
```

#### 错误: "Transaction submission not implemented"

**原因**: api.signer未初始化

**解决**: 确保:
1. Polkadot钱包已安装并授权
2. API实例正确创建
3. Signer正确注入到API

#### 错误: "未找到 BountyCreated 事件"

**原因**:
- 交易失败
- Pallet名称或事件名称不匹配
- 事件索引错误

**解决**: 检查:
1. 后端Pallet名称是否为 `divinationMarket`
2. 事件名称是否为 `BountyCreated`
3. 事件数据索引是否正确（data[0]）

---

## 📊 开发者工具

### React DevTools

安装并使用React DevTools查看组件状态:
- CreateBountyModal的表单状态
- BountyDetailPage的数据加载状态
- Modal的visible状态

### Polkadot.js Apps

访问 https://polkadot.js.org/apps/ 连接本地节点:
- 查看链状态
- 手动调用extrinsics
- 查看事件日志
- 检查存储数据

### 浏览器Network面板

查看:
- IPFS API请求 (http://127.0.0.1:5001/api/v0/add)
- WebSocket连接状态 (ws://localhost:9944)
- 其他API调用

---

## 📝 下一步开发

### 立即可做

1. **运行时测试** (今天)
   - 启动环境
   - 测试所有功能点
   - 记录问题

2. **问题修复** (今天)
   - 修复运行时发现的bug
   - 优化用户体验
   - 完善错误提示

### 短期计划

3. **八字系统集成** (1-2天)
   - 在BaziDetailPage添加悬赏入口
   - 测试八字类型悬赏

4. **Subsquid开发** (3-5天)
   - 设计数据模型
   - 实现事件监听
   - 创建查询API

5. **功能增强** (1周)
   - 采纳答案选择器
   - 用户历史记录
   - 搜索优化

---

## 🆘 获取帮助

### 文档参考

- **设计文档**: `docs/悬赏问答混合模式设计文档.md`
- **实现进度**: `docs/bounty-implementation-progress.md`
- **测试报告**: `docs/bounty-test-report.md`
- **前端总结**: `docs/bounty-frontend-implementation-summary.md`
- **验收清单**: `docs/bounty-system-acceptance-checklist.md`
- **集成报告**: `docs/bounty-integration-test-report.md`
- **完成总结**: `docs/bounty-integration-complete-summary.md`

### 代码位置

- **前端组件**: `src/features/bounty/`
- **API服务**: `src/services/bountyService.ts`
- **类型定义**: `src/types/divination.ts`
- **路由配置**: `src/routes.tsx`
- **梅花集成**: `src/features/meihua/HexagramDetailPage.tsx`

### 后端Pallet

- **位置**: `pallets/divination-market/src/lib.rs`
- **测试**: `pallets/divination-market/src/tests.rs`
- **类型**: `pallets/divination-market/src/types.rs`

---

## ✅ 检查清单

使用此清单确认环境准备就绪：

**环境准备**:
- [ ] IPFS已安装
- [ ] IPFS CORS已配置
- [ ] IPFS daemon正在运行
- [ ] 区块链节点已编译
- [ ] 区块链节点正在运行（--dev模式）
- [ ] 前端依赖已安装（npm install）
- [ ] 前端开发服务器正在运行

**钱包准备**:
- [ ] Polkadot.js扩展已安装
- [ ] 测试账户已创建（如Alice）
- [ ] 账户已授权给应用
- [ ] 账户有测试代币

**代码确认**:
- [ ] TypeScript编译通过
- [ ] 路由配置正确
- [ ] 梅花页面已集成
- [ ] IPFS服务已实现
- [ ] 钱包签名已实现

**测试准备**:
- [ ] 已创建至少一个梅花卦象
- [ ] 知道如何访问悬赏列表页
- [ ] 知道如何查看悬赏详情
- [ ] 了解完整的业务流程

---

## 🎉 准备就绪！

如果所有检查项都已完成，你现在可以开始测试悬赏问答系统了！

**快速开始命令**:
```bash
# 终端1: IPFS
ipfs daemon

# 终端2: 区块链
cd /home/xiaodong/文档/stardust
./target/release/solochain-template-node --dev

# 终端3: 前端
cd /home/xiaodong/文档/stardust
npm run dev

# 浏览器:
# http://localhost:5173/#/bounty
```

祝测试顺利！🚀

---

**文档版本**: v1.0
**最后更新**: 2025-12-02
**维护团队**: Stardust开发团队
