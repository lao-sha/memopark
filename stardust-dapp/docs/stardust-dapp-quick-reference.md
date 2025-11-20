# Stardust DApp 快速参考指南

## 目录导航

### 关键文件位置

| 用途 | 位置 | 说明 |
|------|------|------|
| **应用入口** | `src/main.tsx` | React 应用启动 |
| **根组件** | `src/App.tsx` | 全局配置、Provider 包装 |
| **路由定义** | `src/routes.tsx` | 所有路由声明（80+ 条） |
| **样式主题** | `src/theme/` | Ant Design 主题配置 |
| **类型定义** | `src/types/` | 全局 TypeScript 类型 |
| **工具函数** | `src/utils/` | 加密、格式化等工具 |

### 模块导航

| 功能 | 路径 | 文件数 | 关键文件 |
|------|------|--------|---------|
| **纪念馆管理** | `src/features/grave/` | 17 | GraveDetailPage, MyGravesPage |
| **聊天系统** | `src/features/chat/` | 21 | ChatPage, ChatWindow |
| **OTC交易** | `src/features/otc/` | 18 | CreateOrderPage, MarketMakerConfigPage |
| **供奉商品** | `src/features/offerings/` | 15 | OfferingsCatalog, MyOrders |
| **钱包认证** | `src/features/auth/` | 9 | AuthPage, CreateWalletPage |
| **重用组件** | `src/components/` | 18 分类 | OfferingsList, DeceasedInfoCard |
| **业务服务** | `src/services/` | 9 个服务 | memorialService, tradingService |
| **核心库** | `src/lib/` | 27 个文件 | polkadot-safe, keystore, chat-* |
| **自定义Hook** | `src/hooks/` | 20+ 个 | useWallet, useBalance, useMemorialHall |

---

## 快速开始

### 1. 开发环境建立

```bash
# 克隆项目
cd stardust-dapp
npm install

# 启动 Substrate 节点（在另一个终端）
cd ..
./target/release/solochain-template-node --dev

# 启动开发服务器
cd stardust-dapp
npm run dev
# 浏览器: http://localhost:5173
```

### 2. 基本操作

```bash
# 代码检查
npm run lint

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

---

## 核心API速查

### 区块链连接 (`lib/polkadot-safe.ts`)

```typescript
// 获取 API 实例
const api = await getApi();

// 查询余额
const balance = await queryFreeBalance(address);

// 本地签名并发送
const txHash = await signAndSendLocal(section, method, args);

// 通过代理发送（可选代付）
const txHash = await sendViaForwarder(namespace, section, method, args);

// 断开连接
await disconnectApi();
```

### 钱包管理 (`lib/keystore.ts`)

```typescript
// 生成新钱包
const { mnemonic, address } = await generateLocalWallet();

// 加密保存
const encrypted = await encryptWithPassword(password, mnemonic);
saveLocalKeystore({...encrypted, address, createdAt: Date.now()});

// 恢复钱包
const keystore = loadLocalKeystore();
const mnemonic = await decryptWithPassword(password, keystore);
const address = await deriveAddressFromMnemonic(mnemonic);
```

### 会话管理 (`lib/sessionManager.ts`)

```typescript
const sessionManager = SessionManager.getInstance();

// 初始化会话
const session = sessionManager.init();

// 创建新会话
sessionManager.createSession(address);

// 获取当前会话
const current = sessionManager.getCurrentSession();

// 检查过期
if (sessionManager.isExpired(session)) {
  sessionManager.clearSession();
}
```

### 钱包上下文 (`providers/WalletProvider.tsx`)

```typescript
const { 
  api,                    // ApiPromise 实例
  accounts,              // 所有本地账户
  selectedAccount,       // 当前选中账户
  current,               // 当前地址字符串
  isConnected,           // 是否已连接
  isLoading,             // 加载状态
  signAndSend,           // 签名并发送
  sendViaForwarder       // 代理发送
} = useWallet();
```

### 供奉服务 (`services/memorialService.ts`)

```typescript
const service = createMemorialService(api);

// 查询祭祀品
const sacrifices = await service.querySacrifices();

// 创建供奉
await service.createOffering(api, {
  graveId: 123,
  deceasedId: 456,
  sacrificeId: 1,
  duration: null,
  isVip: false
});

// 查询订单
const orders = await service.queryOfferings(address);
```

### OTC服务 (`services/tradingService.ts`)

```typescript
const service = createTradingService(api);

// 创建 OTC 订单
await service.createOtcOrder(api, {
  orderId: 1,
  price: '1000000000000',
  maker: makerAddress
});

// 申请做市商
await service.applyMarketMaker(api, {
  deposit: '5000000000000',
  direction: 'BuyAndSell'
});

// 查询做市商状态
const makers = await service.getMarketMakers();
```

### 聊天功能 (`lib/chat-*.ts`)

```typescript
// 加密消息
const encrypted = await encryptMessage(plaintext, recipientPublicKey);

// 解密消息
const plaintext = await decryptMessage(encrypted, recipientPrivateKey);

// 消息缓存
const cache = ChatCache.getInstance();
await cache.saveMessage(message);
const history = await cache.getMessages(sessionId);

// IPFS 上传
const cid = await uploadToChatIPFS(file);
```

---

## 路由快速参考

### 主要路由

| 路由 | 对应组件 | 用途 |
|------|---------|------|
| `#/home` | ModernHomePage | 首页 |
| `#/grave/list` | GraveListPage | 公开纪念馆列表 |
| `#/grave/my` | MyGravesPage | 个人纪念馆 |
| `#/grave/create` | CreateGravePage | 创建纪念馆 |
| `#/grave/detail?id=X` | GraveDetailPage | 纪念馆详情 |
| `#/deceased/create` | CreateDeceasedPage | 添加逝者 |
| `#/offerings/by-who` | OfferingsByWho | 供奉统计 |
| `#/otc/order` | CreateOrderPage | 创建OTC订单 |
| `#/chat` | ChatPage | 聊天 |
| `#/wallet` | WalletManagePage | 钱包管理 |
| `#/admin/category` | AdminCategory | 管理类目 |
| `#/gov/appeal` | SubmitAppealPage | 提交投诉 |

---

## 常见任务

### 任务 1: 添加新的功能页面

1. **创建页面目录**
   ```bash
   mkdir src/features/myfeature/
   ```

2. **创建主页面组件**
   ```typescript
   // src/features/myfeature/MyFeaturePage.tsx
   import React from 'react';
   import { useWallet } from '../../providers/WalletProvider';
   
   const MyFeaturePage: React.FC = () => {
     const { current, api } = useWallet();
     
     return <div>My Feature</div>;
   };
   
   export default MyFeaturePage;
   ```

3. **添加路由**
   ```typescript
   // src/routes.tsx
   { match: h => h === '#/myfeature', 
     component: lazy(() => import('./features/myfeature/MyFeaturePage')) },
   ```

4. **添加导航菜单**
   ```typescript
   // src/components/nav/BottomNav.tsx - 在菜单数据中添加条目
   ```

### 任务 2: 调用链上功能

```typescript
import { useWallet } from '@/providers/WalletProvider';
import { createMemorialService } from '@/services/memorialService';

const MyComponent = () => {
  const { api, signAndSendLocal, current } = useWallet();
  const [loading, setLoading] = React.useState(false);

  const handleCreateOffering = async () => {
    if (!api || !current) return;
    
    try {
      setLoading(true);
      const service = createMemorialService(api);
      
      // 调用服务
      const result = await service.createOffering(api, {
        graveId: 1,
        sacrificeId: 1,
        deceasedId: 2,
        duration: null,
        isVip: false,
        who: 'anonymous'
      });
      
      console.log('创建成功:', result);
    } catch (error) {
      console.error('创建失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return <button onClick={handleCreateOffering}>创建供奉</button>;
};
```

### 任务 3: 加密和存储数据

```typescript
import { encryptWithPassword, decryptWithPassword } from '@/lib/keystore';
import { uploadToIpfs } from '@/lib/ipfs';

// 加密文本
const encrypted = await encryptWithPassword(password, plaintext);
localStorage.setItem('encrypted-data', JSON.stringify(encrypted));

// 解密文本
const stored = JSON.parse(localStorage.getItem('encrypted-data') || '{}');
const plaintext = await decryptWithPassword(password, stored);

// 上传到 IPFS
const file = new File([content], 'file.txt');
const cid = await uploadToIpfs(file);
console.log('IPFS CID:', cid);
```

### 任务 4: 处理会话

```typescript
import { sessionManager } from '@/lib/sessionManager';

// 初始化会话
const session = sessionManager.init();

// 创建新会话
const newSession = sessionManager.createSession(userAddress);

// 检查会话有效性
const isValid = !sessionManager.isExpired(session);

// 获取当前会话
const current = sessionManager.getCurrentSession();

// 清理会话
sessionManager.clearSession();
```

---

## 性能优化检查清单

- [ ] 大列表使用 `react-window` 虚拟滚动
- [ ] 图片使用懒加载
- [ ] 长组件拆分成小组件
- [ ] 避免在组件内定义函数（使用 `useCallback`）
- [ ] 使用 React.memo 优化不必要的重渲染
- [ ] 避免在 useEffect 中创建新对象
- [ ] 及时清理 useEffect 的副作用（如事件监听器）

---

## 调试技巧

### 查看区块链连接状态

```typescript
// 在浏览器控制台
const { api } = window.__WALLET_CONTEXT__ // 需要在 App.tsx 中导出
console.log('API 连接:', api?.isConnected);
console.log('链信息:', await api?.rpc.system.chain());
```

### 查看本地存储

```javascript
// localStorage
console.log(JSON.parse(localStorage.getItem('mp.keystore')));
console.log(JSON.parse(localStorage.getItem('session.data')));

// IndexedDB
const db = await indexedDB.databases();
console.log('数据库列表:', db);
```

### 监控交易

```typescript
// 在 polkadot-safe.ts 中添加日志
console.log('[交易]', {
  section,
  method,
  args,
  address: keystore.address,
  timestamp: new Date().toISOString()
});
```

---

## 常见问题

### Q: 如何添加新的环境变量？

A: 在 `.env` 文件中添加，并在 `src/lib/config.ts` 中使用
```typescript
export const AppConfig = {
  myVar: (import.meta as any)?.env?.VITE_MY_VAR || 'default',
}
```

### Q: 如何处理 IPFS 上传失败？

A: 检查 IPFS 节点是否运行，并在代码中添加重试逻辑
```typescript
const retryUpload = async (file: File, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await uploadToIpfs(file);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};
```

### Q: 如何调试聊天消息加密？

A: 在 chat-crypto.ts 中添加日志
```typescript
const encrypted = await encryptMessage(msg);
console.log('明文:', msg);
console.log('密文:', encrypted);
const decrypted = await decryptMessage(encrypted);
console.log('解密:', decrypted);
```

### Q: 如何查看交易历史？

A: localStorage 中的 `offeringsOrders` 和 `txHistory`
```javascript
JSON.parse(localStorage.getItem('offeringsOrders'));
JSON.parse(localStorage.getItem('txHistory'));
```

---

## 技术栈速查

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.1 | UI 框架 |
| TypeScript | 5.8.3 | 类型系统 |
| Vite | 7.1.4 | 构建工具 |
| Ant Design | 5.27.1 | UI 组件库 |
| @polkadot/api | 16.4.6 | 区块链交互 |
| Zustand | 5.0.8 | 状态管理 |
| axios | 1.12.2 | HTTP 客户端 |
| ipfs-http-client | 60.0.1 | IPFS 上传 |
| react-window | 2.2.3 | 虚拟滚动 |
| idb | 8.0.3 | IndexedDB 封装 |

---

## 文件大小参考

期望的生产包大小（分包后）：
- React chunk: ~200KB
- Ant Design chunk: ~400KB
- Polkadot chunk: ~300KB
- Main chunk: ~150-200KB
- 总体: ~1.0-1.2MB (未压缩)

gzip 压缩后应该 <400KB

---

## 项目维护

### 定期任务
- 每周检查依赖更新: `npm outdated`
- 每月运行安全审计: `npm audit`
- 每季度更新主要依赖
- 持续优化包大小

### 代码质量
- 运行 eslint: `npm run lint`
- TypeScript 类型检查: `npx tsc --noEmit`
- 添加单元测试（推荐）
- 进行代码审查

---

**最后更新**: 2025-11-09
**适用版本**: upgrade-polkadot-sdk-stable2506 分支
