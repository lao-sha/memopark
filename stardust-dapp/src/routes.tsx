import React from 'react';

// 简单 hash 路由定义与匹配逻辑
export interface RouteItem {
  match: (hash: string) => boolean;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
}

// 动态按需加载（与之前大体量页面解耦，减小初始包）
const lazy = (factory: () => Promise<any>) => React.lazy(factory);

export const routes: RouteItem[] = [
  { match: h => h === '#/home' || h === '#/', component: lazy(() => import('./features/memorial/HomePage')) },  // 🆕 默认首页（纪念馆风格）
  { match: h => h === '#/memorial-browser', component: lazy(() => import('./features/memorial/MemorialEmbeddedPage')) },  // 🆕 纪念馆内嵌浏览器页
  { match: h => h === '#/admin/pause', component: lazy(() => import('./features/offerings/AdminPause')) },
  { match: h => h === '#/admin/category', component: lazy(() => import('./features/offerings/AdminCategory')) },
  { match: h => h === '#/admin/effect', component: lazy(() => import('./features/offerings/AdminEffect')) },
  { match: h => h.startsWith('#/browse/category'), component: lazy(() => import('./features/offerings/OfferingsCatalog')) },
  { match: h => h === '#/orders', component: lazy(() => import('./features/offerings/MyOrders')) },
  { match: h => h === '#/timeline', component: lazy(() => import('./features/offerings/OfferingsTimeline')) },
  { match: h => h === '#/offerings/by-who', component: lazy(() => import('./features/offerings/OfferingsByWho')) },
  { match: h => h === '#/deceased/create', component: lazy(() => import('./features/deceased/CreateDeceasedPage')) },
  { match: h => h === '#/deceased/list', component: lazy(() => import('./features/deceased/DeceasedListPage')) },
  { match: h => h.startsWith('#/deceased/relationships'), component: lazy(() => import('./features/deceased/RelationshipPage')) },
  { match: h => h === '#/memorial', component: lazy(() => import('./features/memorial/HomePage')) },  // 🆕 纪念馆首页（云上思念风格）
  { match: h => h === '#/memorial/celebrity', component: lazy(() => import('./features/memorial/CelebrityHallPage')) },  // 🆕 名人馆页面
  { match: h => h === '#/memorial/great-person', component: lazy(() => import('./features/memorial/GreatPersonHallPage')) },  // 🆕 伟人馆页面
  { match: h => h === '#/memorial/hero', component: lazy(() => import('./features/memorial/HeroHallPage')) },  // 🆕 英雄馆页面
  { match: h => h === '#/memorial/event', component: lazy(() => import('./features/memorial/EventHallPage')) },  // 🆕 事件馆页面
  { match: h => h === '#/memorial/academician', component: lazy(() => import('./features/memorial/AcademicianHallPage')) },  // 🆕 院士馆页面
  { match: h => h === '#/memorial/my', component: lazy(() => import('./features/memorial/MyMemorialPage')) },  // 🆕 我的纪念馆页面
  { match: h => h === '#/memorial/my-created', component: lazy(() => import('./features/memorial/MyCreatedMemorialsPage')) },  // 🆕 我创建的纪念馆列表
  { match: h => h === '#/memorial/family', component: lazy(() => import('./features/memorial/MyCreatedMemorialsPage')) },  // 🆕 亲友团的馆（暂用同一页面）
  { match: h => h === '#/memorial/followed', component: lazy(() => import('./features/memorial/MyCreatedMemorialsPage')) },  // 🆕 关注的馆（暂用同一页面）
  { match: h => h === '#/transfer', component: lazy(() => import('./features/ledger/TransferPage')) },  // 🆕 转账页面
  { match: h => h.startsWith('#/memorial/comprehensive'), component: lazy(() => import('./features/memorial/MemorialComprehensive')) },  // 🆕 纪念馆综合页面（云上思念风格）
  { match: h => h.startsWith('#/memorial/'), component: lazy(() => import('./features/memorial/MemorialHallDetailPage')) },  // 🆕 纪念馆详情页
  { match: h => h === '#/treasury', component: lazy(() => import('./features/treasury/TreasuryPage')) },
  { match: h => h === '#/dashboard', component: lazy(() => import('./features/dashboard/DashboardPage')) },
  { match: h => h === '#/gov/appeal', component: lazy(() => import('./features/governance/SubmitAppealPage')) },
  { match: h => h === '#/gov/affiliate/dashboard', component: lazy(() => import('./features/governance/AffiliateGovernanceDashboard')) },  // 🆕 联盟治理仪表板
  { match: h => h === '#/gov/affiliate/create-proposal', component: lazy(() => import('./features/governance/CreateAffiliateProposal')) },  // 🆕 创建联盟治理提案
  { match: h => h.startsWith('#/gov/affiliate/vote/'), component: lazy(() => import('./features/governance/VoteAffiliateProposal')) },  // 🆕 联盟治理投票
  { match: h => h.startsWith('#/gov/affiliate/proposal/'), component: lazy(() => import('./features/governance/VoteAffiliateProposal')) },  // 🆕 联盟治理提案详情（复用投票页面）
  { match: h => h === '#/category/create', component: lazy(() => import('./features/offerings/CreateCategoryPage')) },
  { match: h => h === '#/identity', component: lazy(() => import('./features/identity/IdentityViewerPage')) },
  { match: h => h === '#/origin', component: lazy(() => import('./features/origin/OriginRestrictionPage')) },
  { match: h => h === '#/affiliate/params', component: lazy(() => import('./features/affiliate/RewardParamsPanel')) },
  { match: h => h === '#/bridge/params', component: lazy(() => import('./features/bridge/BridgeParamsPage')) },
  { match: h => h === '#/bridge/simple', component: lazy(() => import('./features/bridge/SimpleBridgePage')) },
  { match: h => h === '#/category/create-primary', component: lazy(() => import('./features/offerings/CreatePrimaryCategoryPage')) },
  { match: h => h === '#/category/list', component: lazy(() => import('./features/offerings/CategoryListPage')) },
  { match: h => h === '#/sacrifice/create', component: lazy(() => import('./features/offerings/CreateSacrificePage')) },
  { match: h => h === '#/scene/create', component: lazy(() => import('./features/offerings/CreateScenePage')) },
  { match: h => h === '#/bridge/lock', component: lazy(() => import('./features/bridge/BridgeLockPage')) },
  { match: h => h === '#/admin/otc', component: lazy(() => import('./features/otc/AdminOtcSettingsPage')) },
  { match: h => h === '#/otc/order', component: lazy(() => import('./features/otc/CreateOrderPage')) },
  { match: h => h === '#/otc/mm-apply', component: lazy(() => import('./features/otc/CreateMarketMakerPage')) },
  { match: h => h === '#/otc/market-maker-config', component: lazy(() => import('./features/otc/MarketMakerConfigPage')) },
  { match: h => h === '#/otc/bridge-config', component: lazy(() => import('./features/otc/MakerBridgeConfigPage')) },
  { match: h => h === '#/market-maker/center', component: lazy(() => import('./features/market-maker/MarketMakerCenterPage')) },
  { match: h => h === '#/market-maker/credit', component: lazy(() => import('./features/market-maker/MakerCreditDashboard')) },  // 🆕 做市商信用仪表板
  { match: h => h === '#/otc/decrypt', component: lazy(() => import('./features/otc/DecryptFilePage')) },
  { match: h => h === '#/otc/pay-result', component: lazy(() => import('./features/otc/PayResultPage')) },
  { match: h => h === '#/otc/pay-test', component: lazy(() => import('./features/otc/PayCreateTestPage')) },
  { match: h => h === '#/otc/claim', component: lazy(() => import('./features/otc/ClaimMemoForm')) },  // 首购领取（原OTC领取）
  { match: h => h === '#/otc/release', component: lazy(() => import('./features/otc/SellerReleasePage')) },
  // ❌ 已删除冗余路由: /otc/order-free (CreateFreeOrderPage) - 功能由 /first-purchase 替代
  { match: h => h === '#/market-maker/quota', component: lazy(() => import('./features/market-maker/FreeQuotaManagementPage')) },  // 🆕 做市商配额管理
  { match: h => h === '#/first-purchase/pool', component: lazy(() => import('./features/first-purchase/MarketMakerPoolPage')) },
  { match: h => h === '#/first-purchase', component: lazy(() => import('./features/first-purchase/FirstPurchasePage')) },
  { match: h => h === '#/admin/offer-route', component: lazy(() => import('./features/offerings/AdminOfferRoutePage')) },
  { match: h => h === '#/ipfs/pin', component: lazy(() => import('./features/ipfs/DeceasedPinWizard')) },
  { match: h => h === '#/ipfs/usage', component: lazy(() => import('./features/ipfs/UsagePage')) },
  { match: h => h === '#/evidence/linker', component: lazy(() => import('./features/evidence/EvidenceLinkerPage')) },
  { match: h => h === '#/ipfs/billing', component: lazy(() => import('./features/ipfs/BillingAdminPage')) },
  { match: h => h.startsWith('#/ref'), component: lazy(() => import('./features/referrals/ReferralBindPage')) },
  { match: h => h === '#/membership/purchase', component: lazy(() => import('./features/membership/MembershipPurchasePage')) },
  { match: h => h === '#/membership/analytics', component: lazy(() => import('./features/membership/MembershipAnalyticsPage')) },
  { match: h => h === '#/storage-treasury', component: lazy(() => import('./features/storage-treasury/StorageTreasuryDashboard')) },
  { match: h => h === '#/chat/blocked', component: lazy(() => import('./features/chat/BlockedUsersPage')) },  // 🆕 聊天黑名单管理
  { match: h => h === '#/chat/cache', component: lazy(() => import('./features/chat/CacheManagement')) },  // 🆕 聊天缓存管理
  { match: h => h === '#/chat/privacy', component: lazy(() => import('./features/chat/ChatPrivacySettingsPage')) },  // 🆕 聊天隐私设置
  {
    match: h => h === '#/chat' || (h.startsWith('#/chat/') && h !== '#/chat/blocked' && h !== '#/chat/cache' && h !== '#/chat/privacy'),
    component: lazy(() => import('./features/chat/OneOnOneChatPage'))
  },  // 🆕 一对一聊天（支持携带会话ID）
  { match: h => h === '#/smart-chat/demo', component: lazy(() => import('./features/smart-chat/SmartGroupChatPage')) },  // 🆕 聊天演示页面
  { match: h => h.startsWith('#/smart-chat'), component: lazy(() => import('./features/smart-chat/SmartChatApp')) },  // 🆕 Stardust群聊系统
  { match: h => h === '#/ai-trader', component: lazy(() => import('./features/ai-trader/AIStrategyDemo')) },  // 🆕 AI 交易策略
  { match: h => h === '#/profile', component: lazy(() => import('./features/profile/MyWalletPage')) },  // 🆕 我的钱包（个人中心）
  { match: h => h === '#/wallet', component: lazy(() => import('./features/wallet/WalletManagePage')) },  // 🆕 钱包管理
  { match: h => h === '#/wallet/create', component: lazy(() => import('./features/auth/CreateWalletPage')) },  // 🆕 创建钱包（独立路由）
  { match: h => h === '#/wallet/restore', component: lazy(() => import('./features/auth/RestoreWalletPage')) },  // 🆕 导入/恢复钱包（独立路由）
  { match: h => h === '#/contacts', component: lazy(() => import('./features/contacts/ContactsPage')) },  // 🆕 通讯录管理
  // 梅花易数模块
  { match: h => h === '#/meihua', component: lazy(() => import('./features/meihua/DivinationPage')) },  // 🆕 梅花易数起卦页面
  { match: h => h === '#/meihua/list', component: lazy(() => import('./features/meihua/HexagramListPage')) },  // 🆕 我的卦象列表
  { match: h => h === '#/meihua/market', component: lazy(() => import('./features/meihua/MarketplacePage')) },  // 🆕 占卜服务市场
  { match: h => h === '#/meihua/nft', component: lazy(() => import('./features/meihua/NftMarketPage')) },  // 🆕 卦象 NFT 市场
  { match: h => h === '#/meihua/my-nft', component: lazy(() => import('./features/meihua/MyNftPage')) },  // 🆕 我的 NFT 管理
  { match: h => h.startsWith('#/meihua/ai/'), component: lazy(() => import('./features/meihua/AiInterpretationPage')) },  // 🆕 AI 解卦服务
  { match: h => h.startsWith('#/meihua/hexagram/'), component: lazy(() => import('./features/meihua/HexagramDetailPage')) },  // 🆕 卦象详情页

  // 🆕 通用占卜系统（支持多种玄学体系）
  { match: h => h === '#/divination', component: lazy(() => import('./features/divination/DivinationEntryPage')) },  // 占卜入口页面
  { match: h => h === '#/divination/market' || h.startsWith('#/divination/market?'), component: lazy(() => import('./features/divination/DivinationMarketPage')) },  // 通用服务市场
  { match: h => h === '#/divination/nft' || h.startsWith('#/divination/nft?'), component: lazy(() => import('./features/divination/DivinationNftMarketPage')) },  // 通用 NFT 市场
  { match: h => h === '#/divination/my-nft', component: lazy(() => import('./features/divination/MyDivinationNftPage')) },  // 我的占卜 NFT

  // 🆕 八字命理模块
  { match: h => h === '#/bazi', component: lazy(() => import('./features/bazi/BaziPage')) },  // 八字排盘页面
  { match: h => h.startsWith('#/bazi/'), component: lazy(() => import('./features/bazi/BaziDetailPage')) },  // 八字详情页面

  // 🆕 六爻占卜模块
  { match: h => h === '#/liuyao', component: lazy(() => import('./features/liuyao/LiuyaoPage')) },  // 六爻摇卦页面

  // 🆕 紫微斗数模块
  { match: h => h === '#/ziwei', component: lazy(() => import('./features/ziwei/ZiweiPage')) },  // 紫微斗数排盘页面

  // 🆕 奇门遁甲模块
  { match: h => h === '#/qimen', component: lazy(() => import('./features/qimen/QimenPage')) },  // 奇门遁甲排盘页面

  // 🆕 悬赏问答系统（基于占卜结果）
  { match: h => h === '#/bounty', component: lazy(() => import('./features/bounty/BountyListPage')) },  // 悬赏列表页面
  { match: h => h.startsWith('#/bounty/'), component: lazy(() => import('./features/bounty/BountyDetailPage')) },  // 悬赏详情页面
];

// UI 组件展示页仅在开发模式暴露
export const showcaseRoute: RouteItem | null = (import.meta.env && import.meta.env.DEV)
  ? { match: h => h === '#/ui/showcase', component: lazy(() => import('./components/ui/UIShowcase')) }
  : null;

export function resolveRoute(hash: string) {
  if (showcaseRoute && showcaseRoute.match(hash)) return showcaseRoute.component;
  const found = routes.find(r => r.match(hash));
  return found?.component;
}
