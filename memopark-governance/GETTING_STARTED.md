# Memopark 治理平台 - 快速开始指南

## 项目状态

✅ **基础架构已完成**：
- ✅ 项目结构
- ✅ 核心配置（Vite, TypeScript, ESLint）
- ✅ API Provider（区块链连接）
- ✅ Wallet Provider（钱包连接）
- ✅ 基础布局（侧边栏、头部、内容区）
- ✅ 仪表盘页面
- ⏳ 提案管理（待完善）
- ⏳ 投票功能（待实现）
- ⏳ 数据分析（待实现）

## 安装步骤

### 1. 安装依赖

```bash
cd /home/xiaodong/文档/memopark/memopark-governance
pnpm install
```

如果没有安装 pnpm：
```bash
npm install -g pnpm
```

### 2. 配置环境变量

创建 `.env.development` 文件：

```env
# 区块链节点 WebSocket URL
VITE_CHAIN_WS=ws://127.0.0.1:9944

# 应用标题
VITE_APP_TITLE=Memopark 治理平台

# API 超时时间（毫秒）
VITE_API_TIMEOUT=30000
```

### 3. 启动开发服务器

```bash
pnpm dev
```

服务器将在 http://localhost:3000 启动

### 4. 安装钱包扩展

在浏览器中安装以下任一扩展：

- **Polkadot.js Extension**: https://polkadot.js.org/extension/
- **SubWallet**: https://www.subwallet.app/
- **Talisman**: https://talisman.xyz/

### 5. 连接钱包

1. 打开应用 http://localhost:3000
2. 点击右上角 "连接钱包" 按钮
3. 在扩展弹窗中授权应用访问
4. 选择要使用的账户

## 构建生产版本

### 构建

```bash
pnpm build
```

构建产物在 `dist/` 目录

### 预览构建结果

```bash
pnpm preview
```

### 类型检查

```bash
pnpm type-check
```

### 代码检查

```bash
pnpm lint
```

## 项目结构说明

```
memopark-governance/
├── src/
│   ├── contexts/              # React Context
│   │   ├── Api/              # 区块链 API 连接
│   │   └── Wallet/           # 钱包管理
│   │
│   ├── layouts/              # 布局组件
│   │   ├── BasicLayout/     # 主布局（带侧边栏）
│   │   └── BlankLayout/     # 空白布局
│   │
│   ├── pages/               # 页面组件
│   │   ├── Dashboard/       # 仪表盘
│   │   └── Proposals/       # 提案管理
│   │       ├── List/        # 列表页
│   │       ├── Detail/      # 详情页
│   │       └── Create/      # 创建页
│   │
│   ├── components/          # 通用组件
│   │   └── WalletConnect/  # 钱包连接按钮
│   │
│   ├── App.tsx             # 应用根组件（路由配置）
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式
│
├── index.html              # HTML 模板
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
└── package.json            # 依赖配置
```

## 核心功能说明

### 1. API Provider

位置：`src/contexts/Api/index.tsx`

功能：
- 连接到 Substrate 区块链节点
- 管理 WebSocket 连接状态
- 提供全局 API 实例

使用：
```typescript
import { useApi } from '@/contexts/Api'

function MyComponent() {
  const { api, isReady, error } = useApi()
  
  if (!isReady) return <div>连接中...</div>
  if (error) return <div>错误: {error.message}</div>
  
  // 使用 api 进行链上查询
}
```

### 2. Wallet Provider

位置：`src/contexts/Wallet/index.tsx`

功能：
- 连接浏览器扩展钱包
- 管理账户列表
- 提供当前活跃账户

使用：
```typescript
import { useWallet } from '@/contexts/Wallet'

function MyComponent() {
  const { accounts, activeAccount, connectWallet } = useWallet()
  
  return (
    <button onClick={connectWallet}>
      连接钱包
    </button>
  )
}
```

### 3. 基础布局

位置：`src/layouts/BasicLayout/index.tsx`

功能：
- 侧边栏导航
- 头部（钱包连接、账户切换）
- 内容区域
- 页脚

### 4. 路由配置

位置：`src/App.tsx`

已配置的路由：
- `/` → 重定向到 `/dashboard`
- `/dashboard` → 仪表盘
- `/proposals` → 提案列表
- `/proposals/:id` → 提案详情
- `/proposals/create` → 创建提案
- `/voting` → 投票管理（待实现）
- `/applications` → 申请审核（待实现）
- `/analytics` → 数据分析（待实现）
- `/members` → 成员管理（待实现）
- `/settings` → 设置（待实现）

## 下一步开发

### Phase 1: 完善提案管理（优先）

文件：`src/pages/Proposals/List/index.tsx`

需要实现：
1. 从链上查询所有提案
2. 提案列表展示（表格）
3. 筛选和搜索功能
4. 投票进度显示
5. 批量操作

参考代码：
```typescript
import { useApi } from '@/contexts/Api'

export default function ProposalList() {
  const { api, isReady } = useApi()
  const [proposals, setProposals] = useState([])

  useEffect(() => {
    if (!isReady || !api) return

    const loadProposals = async () => {
      // 查询提案哈希列表
      const hashes = await api.query.council.proposals()
      
      // 查询每个提案的详细信息
      const proposalData = await Promise.all(
        hashes.map(async (hash) => {
          const voting = await api.query.council.voting(hash)
          const proposal = await api.query.council.proposalOf(hash)
          
          return {
            hash: hash.toHex(),
            voting: voting.unwrap().toJSON(),
            proposal: proposal.unwrap()
          }
        })
      )
      
      setProposals(proposalData)
    }

    loadProposals()
  }, [api, isReady])

  return (
    // 渲染提案列表
  )
}
```

### Phase 2: 实现创建提案

文件：`src/pages/Proposals/Create/index.tsx`

需要实现：
1. 表单：选择提案类型（批准/驳回）
2. 选择申请编号
3. 设置投票阈值
4. 提交提案到链上

### Phase 3: 投票功能

创建：`src/pages/Voting/index.tsx`

需要实现：
1. 我的投票记录
2. 批量投票
3. 投票历史

### Phase 4: 数据分析

创建：`src/pages/Analytics/index.tsx`

需要实现：
1. 提案统计图表
2. 投票趋势分析
3. 成员活跃度

## 常见问题

### Q1: 连接失败怎么办？

确保链节点正在运行：
```bash
cd /home/xiaodong/文档/memopark
./start-node.sh
```

### Q2: 钱包连接失败？

1. 确认已安装浏览器扩展
2. 刷新页面重试
3. 检查扩展是否授权应用

### Q3: TypeScript 报错？

运行类型检查：
```bash
pnpm type-check
```

### Q4: 如何添加新页面？

1. 在 `src/pages/` 创建新目录
2. 创建 `index.tsx` 文件
3. 在 `src/App.tsx` 添加路由
4. 在 `src/layouts/BasicLayout/index.tsx` 添加菜单项

## 参考资料

### 官方文档
- Polkadot.js API: https://polkadot.js.org/docs/api
- Ant Design: https://ant.design/components/overview-cn
- React Router: https://reactrouter.com/

### 参考项目
- Polkadot.js Apps: https://github.com/polkadot-js/apps
  - 查看 `packages/page-council/` 了解治理实现
- Staking Dashboard: https://github.com/paritytech/polkadot-staking-dashboard
  - 参考架构和Context设计

## 获取帮助

- 查看代码注释
- 参考 `/home/xiaodong/文档/memopark/docs/` 目录下的文档
- 查看现有DAPP实现：`/home/xiaodong/文档/memopark/memopark-dapp/`

---

**祝开发顺利！** 🚀

