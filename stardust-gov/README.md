# Stardust 做市商治理平台

全新的做市商审批与挂单管理前端应用。

## 📋 项目概述

本项目是一个基于 React 18 + TypeScript 5 的 Web 应用，用于：

1. **做市商审批** - Council 成员审批做市商申请
2. **挂单管理** - 做市商创建和管理 OTC 挂单

## 🛠️ 技术栈

- **框架**: React 18 + TypeScript 5
- **UI 库**: Ant Design 5 + Ant Design Charts
- **状态管理**: React Context + Zustand
- **路由**: React Router v6
- **构建工具**: Vite 5
- **区块链**: Polkadot.js API 10
- **钱包**: @polkadot/extension-dapp

## 📦 安装

### 1. 安装依赖

```bash
cd /home/xiaodong/文档/stardust/memopar-gov
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3002` 启动。

### 3. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 🚀 功能说明

### 页面 1：做市商审批 (`/approval`)

**功能**：
- 查看所有待审批的做市商申请
- Council 成员发起批准提案
- Council 成员投票（赞成/反对）
- 达到阈值后执行提案

**使用流程**：
1. 连接 Polkadot 钱包扩展
2. 选择 Council 成员账户
3. 查看申请列表
4. 点击"发起提案"创建批准提案
5. 其他 Council 成员投票
6. 达到 2/3 阈值后点击"执行"

**权限要求**：
- 必须是 Council 成员才能发起提案和投票
- 任何人都可以查看申请列表

---

### 页面 2：挂单管理 (`/listing`)

**功能**：
- 查看当前账户的所有挂单
- 创建新的 OTC 挂单
- 取消活跃的挂单

**使用流程**：
1. 连接 Polkadot 钱包扩展
2. 选择做市商账户（必须是已批准的做市商）
3. 点击"创建挂单"
4. 填写挂单信息：
   - 交易方向（买入/卖出）
   - 价差（基点）
   - 数量范围（最小/最大）
   - 总库存
   - 过期时间（区块号）
   - 是否允许部分成交
5. 提交挂单
6. 查看和管理已创建的挂单

**权限要求**：
- 必须是已批准的做市商
- 账户必须有足够的余额用于交易费和锁定库存

---

## 📁 项目结构

```
memopar-gov/
├── src/
│   ├── main.tsx              # 应用入口
│   ├── App.tsx               # 主应用组件
│   ├── index.css             # 全局样式
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── contexts/
│   │   └── ApiContext.tsx    # API Context（区块链连接）
│   ├── hooks/
│   │   └── useWallet.ts      # 钱包管理 Hook
│   └── pages/
│       ├── MarketMakerApproval/  # 做市商审批页面
│       │   └── index.tsx
│       └── MarketMakerListing/   # 挂单管理页面
│           └── index.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

## 🔗 依赖的链端接口

### pallet-market-maker

- `applications(mmId)` - 查询做市商申请
- `activeMarketMakers(mmId)` - 查询活跃做市商
- `ownerIndex(account)` - 查询账户的做市商 ID
- `approve(mmId)` - 批准做市商申请（需 Council）

### pallet-council (Collective Instance1)

- `members()` - 查询 Council 成员列表
- `propose(threshold, call, lengthBound)` - 发起提案
- `vote(proposalHash, index, approve)` - 投票
- `close(proposalHash, index, weight, lengthBound)` - 执行提案
- `proposalOf(hash)` - 查询提案详情
- `voting(hash)` - 查询投票状态

### pallet-otc-listing

- `listings(listingId)` - 查询挂单详情
- `createListing(...)` - 创建挂单
- `cancelListing(listingId)` - 取消挂单

## 🔧 配置说明

### 链端连接

默认连接到本地节点：`ws://127.0.0.1:9944`

如需修改，编辑 `src/App.tsx`：

```typescript
<ApiProvider endpoint="ws://YOUR_NODE_ADDRESS:9944">
```

### 端口配置

默认端口：`3002`

如需修改，编辑 `vite.config.ts` 或使用环境变量：

```bash
npm run dev -- --port 3003
```

## 📝 开发说明

### 添加新页面

1. 在 `src/pages/` 创建新页面组件
2. 在 `src/App.tsx` 添加路由
3. 在顶部菜单添加导航链接

### 状态管理

- **全局状态**（API 连接）：使用 `ApiContext`
- **局部状态**（钱包）：使用 `Zustand` 的 `useWalletStore`
- **组件状态**：使用 React `useState`

### 类型定义

所有类型定义在 `src/types/index.ts`，包括：
- `MarketMakerApplication` - 做市商申请
- `Listing` - OTC 挂单
- `ProposalVoting` - 提案投票信息

## 🐛 常见问题

### 1. 钱包连接失败

**问题**：提示"未检测到 Polkadot 钱包扩展"

**解决**：
- 安装 [Polkadot.js Extension](https://polkadot.js.org/extension/)
- 在扩展中创建或导入账户
- 刷新页面并重试

### 2. 链端连接失败

**问题**：提示"链端连接失败"

**解决**：
- 确保链端节点在运行：`./target/release/stardust-node --dev --rpc-cors all`
- 检查 WebSocket 地址是否正确
- 检查防火墙设置

### 3. 投票失败 - wasm unreachable

**问题**：投票时出现 `wasm unreachable` 错误

**解决**：
- 检查账户是否已经投过票
- 确认账户有足够余额支付交易费
- 查看浏览器控制台获取详细错误信息

### 4. 创建挂单失败 - 权限不足

**问题**：提示"权限不足"或"不是做市商"

**解决**：
- 确保使用的账户已通过 Council 审批
- 检查账户是否在 `activeMarketMakers` 中
- 等待审批流程完成

### 5. 余额不足

**问题**：交易失败，提示余额不足

**解决**：
- 使用 Alice 账户给 Council 成员转账
- 确保账户有足够余额支付交易费（通常 < 1 MEMO）
- 创建挂单时需要锁定库存，确保余额充足

## 📊 性能优化

### 代码分割

已配置 Vite 自动分割代码为多个 chunk：
- `polkadot` - Polkadot.js 相关库
- `antd` - Ant Design 组件库
- `react-vendor` - React 核心库

### 懒加载

可以使用 React.lazy 懒加载页面组件：

```typescript
const MarketMakerApproval = React.lazy(() => import('./pages/MarketMakerApproval'));
```

## 🔒 安全注意事项

1. **私钥安全**：
   - 永远不要在代码中硬编码私钥或助记词
   - 使用 Polkadot 钱包扩展管理密钥

2. **交易确认**：
   - 所有交易都需要用户在钱包扩展中确认
   - 仔细检查交易参数

3. **权限检查**：
   - 前端已实现权限检查
   - 链端也会验证权限，前端检查只是提升用户体验

## 📚 参考资料

- [Polkadot.js API 文档](https://polkadot.js.org/docs/api)
- [Ant Design 文档](https://ant.design/)
- [React Router 文档](https://reactrouter.com/)
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [Vite 文档](https://vitejs.dev/)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

