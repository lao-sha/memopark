# 玄学服务市场合并设计方案

## 1. 设计目标

将 `#/market` 和 `#/divination/market` 两个页面合并为**单一入口**，提供智能的双模式体验：
- **浏览模式**：用户探索平台、了解大师、对比服务
- **下单模式**：用户已有占卜结果，快速找到解读服务

---

## 2. 核心设计理念

### 2.1 智能模式切换

根据 URL 参数 `resultId` 自动判断用户意图：

```typescript
// 浏览模式：用户在探索市场
#/market

// 下单模式：用户已有占卜结果，需要解读服务
#/market?resultId=123&type=1
```

### 2.2 渐进式引导

- **浏览模式**：展示大师资源 → 引导入驻/占卜
- **下单模式**：快速筛选 → 选择套餐 → 完成下单

### 2.3 统一数据源

- 所有数据从链上 `divinationMarket` pallet 加载
- 删除冗余的服务层封装
- 统一格式化和处理逻辑

---

## 3. 页面结构设计

```
┌─────────────────────────────────────────┐
│ [返回] 🔮 玄学服务市场                    │  ← 顶部标题栏
│ 汇聚各派名师，为您提供专业的命理解读服务   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 【模式指示卡片】                          │
│                                         │
│ 浏览模式：                               │
│   ┌──────────────────────────────────┐ │
│   │ 🌟 成为星尘大师，开启副业之路      │ │
│   │ 已有 X 位大师入驻，月均收入 XXX    │ │
│   │ [立即入驻] [了解详情]              │ │
│   └──────────────────────────────────┘ │
│                                         │
│ 下单模式：                               │
│   ┌──────────────────────────────────┐ │
│   │ ✅ 已选择占卜结果 #123             │ │
│   │ 类型：梅花易数 | 时间：2024-12-18  │ │
│   │ [查看结果详情]                     │ │
│   └──────────────────────────────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 【筛选器】                                │
│ [搜索框: 搜索大师或服务]                  │
│ [全部类型▼] [全部等级▼] [全部领域▼]      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 【内容区 - 根据模式切换】                 │
│                                         │
│ 浏览模式：双Tab视图                      │
│   ┌──────────────────────────────────┐ │
│   │ [大师] [服务套餐]                  │ │
│   │                                   │ │
│   │ ┌─ 大师卡片 ─────────────────┐   │ │
│   │ │ [头像] 张大师 [金牌]          │   │ │
│   │ │ ⭐⭐⭐⭐⭐ 4.9 (156评价)      │   │ │
│   │ │ 完成 320单 | 完成率 98%       │   │ │
│   │ │ 擅长：八字 紫微 奇门           │   │ │
│   │ │ [查看详情] [立即咨询]         │   │ │
│   │ └──────────────────────────┘   │ │
│   └──────────────────────────────────┘ │
│                                         │
│ 下单模式：展开式列表                      │
│   ┌──────────────────────────────────┐ │
│   │ ┌─ 大师卡片（可展开）────────┐   │ │
│   │ │ [头像] 李大师 [接急单]        │   │ │
│   │ │ ⭐⭐⭐⭐ 4.7 | 完成 156单     │   │ │
│   │ │ 擅长：梅花易数、六爻           │   │ │
│   │ │ [▼ 查看套餐 (3)]              │   │ │
│   │ │                               │   │ │
│   │ │ ┌─ 套餐1 ─────────────┐     │   │ │
│   │ │ │ 💬 基础解读 | 80 DUST  │     │   │ │
│   │ │ │ 文字解读 + 1次追问     │     │   │ │
│   │ │ │ [选择此套餐]           │     │   │ │
│   │ │ └───────────────────┘     │   │ │
│   │ └──────────────────────────┘   │ │
│   └──────────────────────────────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 【底部引导卡片】                          │
│                                         │
│ 浏览模式：                               │
│   💡 还没有占卜结果？                     │
│   先选择一种占卜方式，获取结果后再来解读   │
│   [去占卜]                               │
│                                         │
│ 下单模式：                               │
│   💰 提示：支付前请仔细阅读服务说明       │
│   有问题？查看 [服务协议] [退款政策]      │
└─────────────────────────────────────────┘
```

---

## 4. 功能模块设计

### 4.1 模式检测器

```typescript
interface MarketMode {
  isBrowsing: boolean;      // 浏览模式
  isOrdering: boolean;      // 下单模式
  resultId: number | null;  // 占卜结果ID
  divinationType: DivinationType | null;  // 占卜类型
}

function detectMarketMode(hash: string): MarketMode {
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const resultId = params.get('resultId');
  const type = params.get('type');

  return {
    isBrowsing: !resultId,
    isOrdering: !!resultId,
    resultId: resultId ? parseInt(resultId, 10) : null,
    divinationType: type ? parseInt(type, 10) as DivinationType : null,
  };
}
```

### 4.2 统一数据加载

```typescript
// 统一从链上 pallet 加载
async function loadMarketData(api: ApiPromise) {
  // 1. 加载所有提供者
  const providers = await loadProvidersFromChain(api);

  // 2. 加载所有套餐（按需）
  const packages = await loadPackagesFromChain(api);

  // 3. 计算平台统计
  const stats = calculatePlatformStats(providers);

  return { providers, packages, stats };
}
```

### 4.3 智能筛选逻辑

```typescript
// 浏览模式：按大师/服务双维度
interface BrowsingFilters {
  searchText: string;
  divinationType: DivinationType | 'all';
  providerTier: ProviderTier | 'all';
  specialty: Specialty | 'all';
  sortBy: 'rating' | 'orders' | 'price';  // 新增排序
}

// 下单模式：智能推荐
interface OrderingFilters {
  searchText: string;
  resultType: DivinationType;  // 自动从 resultId 获取
  showOnlineOnly: boolean;     // 只看在线大师
  showUrgentOnly: boolean;     // 只看接急单
  priceRange: [number, number]; // 价格区间
}
```

### 4.4 双Tab视图（浏览模式）

```typescript
const BrowsingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'masters' | 'packages'>('masters');

  return (
    <Tabs activeKey={activeTab} onChange={setActiveTab}>
      {/* Tab 1: 按大师浏览 */}
      <Tabs.TabPane tab="🎓 大师" key="masters">
        <MasterGrid providers={filteredProviders} />
      </Tabs.TabPane>

      {/* Tab 2: 按服务浏览 */}
      <Tabs.TabPane tab="📦 服务套餐" key="packages">
        <PackageGrid packages={filteredPackages} />
      </Tabs.TabPane>
    </Tabs>
  );
};
```

### 4.5 展开式列表（下单模式）

```typescript
const OrderingView: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="ordering-list">
      {recommendedProviders.map(provider => (
        <ProviderCard
          key={provider.account}
          provider={provider}
          packages={getMatchedPackages(provider, resultType)}
          expanded={expanded === provider.account}
          onToggle={() => toggleExpanded(provider.account)}
          onSelectPackage={(pkg) => openOrderModal(provider, pkg)}
        />
      ))}
    </div>
  );
};
```

---

## 5. 组件复用设计

### 5.1 统一大师卡片

```typescript
interface UnifiedProviderCardProps {
  provider: ServiceProvider;
  mode: 'browse' | 'order';
  packages?: ServicePackage[];
  expanded?: boolean;
  onViewDetail?: () => void;
  onSelectPackage?: (pkg: ServicePackage) => void;
  onToggleExpand?: () => void;
}

const UnifiedProviderCard: React.FC<UnifiedProviderCardProps> = ({
  provider,
  mode,
  packages = [],
  expanded = false,
  onViewDetail,
  onSelectPackage,
  onToggleExpand,
}) => {
  // 浏览模式：显示"查看详情"按钮
  if (mode === 'browse') {
    return (
      <Card hoverable onClick={onViewDetail}>
        <ProviderBasicInfo provider={provider} />
        <Button type="primary">查看详情</Button>
      </Card>
    );
  }

  // 下单模式：可展开查看套餐
  return (
    <Card>
      <ProviderBasicInfo provider={provider} onClick={onToggleExpand} />
      {expanded && (
        <PackageList
          packages={packages}
          onSelect={onSelectPackage}
        />
      )}
      <Button type="link" onClick={onToggleExpand}>
        {expanded ? '收起' : `查看套餐 (${packages.length})`}
      </Button>
    </Card>
  );
};
```

### 5.2 统一套餐卡片

```typescript
interface UnifiedPackageCardProps {
  pkg: ServicePackage;
  provider?: ServiceProvider;  // 下单模式需要
  mode: 'browse' | 'order';
  onSelect: () => void;
}

const UnifiedPackageCard: React.FC<UnifiedPackageCardProps> = ({
  pkg,
  provider,
  mode,
  onSelect,
}) => {
  return (
    <Card size="small" hoverable onClick={onSelect}>
      <PackageHeader pkg={pkg} />
      <PackageDescription pkg={pkg} />
      <PackagePrice pkg={pkg} />

      {/* 浏览模式：显示提供者信息 */}
      {mode === 'browse' && provider && (
        <ProviderMiniInfo provider={provider} />
      )}

      {/* 下单模式：显示快速下单按钮 */}
      {mode === 'order' && (
        <Button type="primary" size="small" block>
          立即选择
        </Button>
      )}
    </Card>
  );
};
```

---

## 6. 华易网风格应用

### 6.1 配色方案

```css
/* 市场页面专用配色（华易网风格） */
:root {
  /* 主色调 - 珊瑚红 */
  --market-primary: #D9685A;
  --market-primary-light: #E88B7F;
  --market-primary-dark: #C94338;

  /* 背景色 - 米黄卷轴 */
  --market-bg-main: #F5F1E8;
  --market-bg-card: #FFFFFF;
  --market-bg-gradient: linear-gradient(180deg, #F5F1E8 0%, #FFFFFF 100%);

  /* 文字色 - 墨色系 */
  --market-text-primary: #5C4033;
  --market-text-secondary: #8B7355;
  --market-text-hint: #A69784;

  /* 装饰色 - 金色 */
  --market-gold: #D4AF37;
  --market-border: #E8DCC4;

  /* 功能色 */
  --market-success: #87d068;
  --market-warning: #faad14;
  --market-error: #ff4d4f;
}
```

### 6.2 卡片样式

```css
/* 大师卡片 - 卷轴风格 */
.unified-provider-card {
  background: var(--market-bg-card);
  border: 2px solid var(--market-border);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(92, 64, 51, 0.08);
  transition: all 0.3s ease;
}

.unified-provider-card:hover {
  border-color: var(--market-primary);
  box-shadow: 0 4px 16px rgba(217, 104, 90, 0.15);
  transform: translateY(-2px);
}

/* 招募横幅 - 渐变卷轴 */
.recruitment-banner {
  background: linear-gradient(135deg,
    var(--market-primary) 0%,
    var(--market-primary-dark) 100%
  );
  border: 3px solid var(--market-gold);
  border-radius: 16px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.recruitment-banner::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 200px;
  height: 200px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

/* 标签样式 - 印章风格 */
.master-tier-tag {
  background: var(--market-gold);
  color: var(--market-text-primary);
  border: 2px solid var(--market-primary-dark);
  border-radius: 4px;
  font-weight: 600;
  padding: 2px 8px;
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}
```

---

## 7. 路由配置更新

### 7.1 删除冗余路由

```typescript
// routes.tsx - 删除这行
// { match: h => h === '#/divination/market', component: lazy(() => import('./features/divination/DivinationMarketPage')) },
```

### 7.2 统一路由规则

```typescript
// routes.tsx - 保留唯一入口
{
  match: h => h === '#/market' || h.startsWith('#/market?'),
  component: lazy(() => import('./features/market/MarketPage'))
},
```

### 7.3 跳转链接更新

```typescript
// 所有跳转到服务市场的链接统一改为：

// DivinationEntryPage.tsx
<Button onClick={() => window.location.hash = '#/market'}>
  🏪 玄学服务市场
</Button>

// 占卜结果页（带参数）
<Button onClick={() => {
  const resultId = currentResult.id;
  const type = DivinationType.Meihua;
  window.location.hash = `#/market?resultId=${resultId}&type=${type}`;
}}>
  🔮 找大师解读
</Button>
```

---

## 8. 文件结构调整

```
stardust-dapp/src/features/market/
├── MarketPage.tsx                    // 统一的市场页面（主文件）
├── MarketPage.css                    // 华易网风格样式
├── components/
│   ├── UnifiedProviderCard.tsx       // 统一大师卡片
│   ├── UnifiedPackageCard.tsx        // 统一套餐卡片
│   ├── BrowsingView.tsx              // 浏览模式视图
│   ├── OrderingView.tsx              // 下单模式视图
│   ├── RecruitmentBanner.tsx         // 招募横幅
│   ├── ResultIndicator.tsx           // 结果指示器
│   ├── MarketFilters.tsx             // 筛选器组件
│   └── OrderConfirmModal.tsx         // 下单确认弹窗
├── hooks/
│   ├── useMarketMode.ts              // 模式检测 hook
│   ├── useMarketData.ts              // 数据加载 hook
│   └── useMarketFilters.ts           // 筛选逻辑 hook
└── utils/
    ├── marketHelpers.ts              // 工具函数
    └── marketConstants.ts            // 常量定义

// 删除这个文件夹
// ❌ stardust-dapp/src/features/divination/DivinationMarketPage.tsx
```

---

## 9. 实现优先级

### Phase 1: 基础合并（核心功能）
1. ✅ 创建统一的 `MarketPage.tsx`
2. ✅ 实现模式检测逻辑 `useMarketMode`
3. ✅ 统一数据加载 `useMarketData`
4. ✅ 创建 `UnifiedProviderCard` 组件
5. ✅ 创建 `UnifiedPackageCard` 组件

### Phase 2: 视图切换（用户体验）
1. ✅ 实现 `BrowsingView`（双Tab）
2. ✅ 实现 `OrderingView`（展开列表）
3. ✅ 创建 `RecruitmentBanner` 组件
4. ✅ 创建 `ResultIndicator` 组件
5. ✅ 更新底部引导逻辑

### Phase 3: 样式优化（华易网风格）
1. ✅ 应用华易网配色方案
2. ✅ 设计卷轴风格卡片
3. ✅ 设计印章风格标签
4. ✅ 优化移动端适配
5. ✅ 添加动画过渡效果

### Phase 4: 路由清理（代码优化）
1. ✅ 删除 `DivinationMarketPage.tsx`
2. ✅ 更新路由配置
3. ✅ 更新所有跳转链接
4. ✅ 测试所有入口场景
5. ✅ 清理冗余代码

---

## 10. 测试场景

### 10.1 浏览模式测试
- [ ] 直接访问 `#/market`
- [ ] 从占卜入口页跳转
- [ ] 搜索大师/服务
- [ ] 切换筛选器（类型/等级/领域）
- [ ] 切换 Tab（大师/服务）
- [ ] 点击查看大师详情
- [ ] 点击招募横幅（入驻/了解详情）

### 10.2 下单模式测试
- [ ] 从占卜结果页跳转（带 `resultId`）
- [ ] 验证结果指示器显示
- [ ] 筛选匹配的套餐
- [ ] 展开/收起大师卡片
- [ ] 选择套餐 → 打开下单弹窗
- [ ] 填写问题描述
- [ ] 选择加急服务
- [ ] 完成下单流程

### 10.3 边界场景测试
- [ ] 无 `resultId` 时点击"选择套餐" → 提示先占卜
- [ ] 有 `resultId` 但无匹配大师 → 显示空状态
- [ ] 网络错误 → 显示错误提示
- [ ] 大师下线 → 显示"休息中"标签
- [ ] 链上数据加载失败 → 降级到模拟数据

---

## 11. 性能优化

### 11.1 数据加载优化
```typescript
// 懒加载套餐数据（仅在展开时加载）
const loadPackagesLazy = async (providerAccount: string) => {
  if (packagesCache.has(providerAccount)) {
    return packagesCache.get(providerAccount);
  }

  const packages = await loadPackagesFromChain(api, providerAccount);
  packagesCache.set(providerAccount, packages);
  return packages;
};
```

### 11.2 虚拟滚动
```typescript
// 大师列表过多时启用虚拟滚动
import { FixedSizeList as List } from 'react-window';

const VirtualizedProviderList: React.FC = ({ providers }) => (
  <List
    height={600}
    itemCount={providers.length}
    itemSize={180}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <UnifiedProviderCard provider={providers[index]} />
      </div>
    )}
  </List>
);
```

### 11.3 缓存策略
```typescript
// 5分钟缓存提供者列表
const CACHE_TTL = 5 * 60 * 1000;

const cachedProviders = useMemo(() => {
  const cached = localStorage.getItem('market_providers_cache');
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp > CACHE_TTL) return null;

  return data;
}, []);
```

---

## 12. 总结

### 12.1 核心优势
- ✅ **单一入口**：统一用户心智模型
- ✅ **智能切换**：根据场景自动适配
- ✅ **组件复用**：减少代码冗余
- ✅ **风格统一**：应用华易网配色
- ✅ **性能优化**：懒加载 + 缓存

### 12.2 用户体验提升
- 🎯 浏览模式：发现大师 → 了解服务 → 产生兴趣
- 🎯 下单模式：快速筛选 → 对比套餐 → 完成下单
- 🎯 无缝切换：从浏览到下单，一站式体验

### 12.3 技术债务清理
- ❌ 删除冗余页面（DivinationMarketPage）
- ❌ 统一数据源（链上 pallet）
- ❌ 简化路由配置
- ✅ 提升代码可维护性

---

## 13. 下一步行动

1. **Review 设计方案**：确认是否符合产品需求
2. **创建开发任务**：分解为可执行的小任务
3. **实现 Phase 1**：完成基础合并和核心功能
4. **迭代优化**：逐步实现 Phase 2-4
5. **测试验收**：覆盖所有测试场景

---

**设计完成时间**: 2025-01-18
**预计开发周期**: 3-5 天（分阶段实施）
**负责人**: Claude Code
**审核人**: @xiaodong
