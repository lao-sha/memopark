import React from 'react';

// 简单 hash 路由定义与匹配逻辑
export interface RouteItem {
  match: (hash: string) => boolean;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
}

// 动态按需加载（与之前大体量页面解耦，减小初始包）
const lazy = (factory: () => Promise<any>) => React.lazy(factory);

export const routes: RouteItem[] = [
  { match: h => h === '#/admin/pause', component: lazy(() => import('./features/offerings/AdminPause')) },
  { match: h => h === '#/admin/category', component: lazy(() => import('./features/offerings/AdminCategory')) },
  { match: h => h === '#/admin/effect', component: lazy(() => import('./features/offerings/AdminEffect')) },
  { match: h => h.startsWith('#/browse/category'), component: lazy(() => import('./features/offerings/CategoryBrowse')) },
  { match: h => h === '#/orders', component: lazy(() => import('./features/offerings/MyOrders')) },
  { match: h => h === '#/timeline', component: lazy(() => import('./features/offerings/OfferingsTimeline')) },
  { match: h => h === '#/offerings/by-who', component: lazy(() => import('./features/offerings/OfferingsByWho')) },
  { match: h => h === '#/grave/create', component: lazy(() => import('./features/grave/CreateGraveForm')) },
  { match: h => h === '#/deceased/create', component: lazy(() => import('./features/deceased/CreateDeceasedForm')) },
  { match: h => h.startsWith('#/grave/detail'), component: lazy(() => import('./features/grave/GraveDetailPage')) },
  { match: h => h === '#/deceased/list', component: lazy(() => import('./features/deceased/DeceasedListPage')) },
  { match: h => h === '#/grave/my', component: lazy(() => import('./features/grave/MyGravesPage')) },
  { match: h => h === '#/treasury', component: lazy(() => import('./features/treasury/TreasuryPage')) },
  { match: h => h === '#/dashboard', component: lazy(() => import('./features/dashboard/DashboardPage')) },
  { match: h => h === '#/gov/appeal', component: lazy(() => import('./features/governance/SubmitAppealPage')) },
  { match: h => h === '#/profile', component: lazy(() => import('./features/profile/ProfilePage')) },
  { match: h => h === '#/covers', component: lazy(() => import('./features/grave/CoverOptionsPage')) },
  { match: h => h === '#/covers/create', component: lazy(() => import('./features/grave/CreateCoverOptionPage')) },
  { match: h => h === '#/grave/audio', component: lazy(() => import('./features/grave/GraveAudioPicker')) },
  { match: h => h === '#/carousel/editor', component: lazy(() => import('./features/grave/CarouselEditorPage')) },
  { match: h => h === '#/category/create', component: lazy(() => import('./features/offerings/CreateCategoryPage')) },
  { match: h => h === '#/identity', component: lazy(() => import('./features/identity/IdentityViewerPage')) },
  { match: h => h === '#/origin', component: lazy(() => import('./features/origin/OriginRestrictionPage')) },
  { match: h => h === '#/affiliate/params', component: lazy(() => import('./features/affiliate/RewardParamsPanel')) },
  { match: h => h === '#/bridge/params', component: lazy(() => import('./features/bridge/BridgeParamsPage')) },
  { match: h => h === '#/category/create-primary', component: lazy(() => import('./features/offerings/CreatePrimaryCategoryPage')) },
  { match: h => h === '#/category/list', component: lazy(() => import('./features/offerings/CategoryListPage')) },
  { match: h => h === '#/sacrifice/create', component: lazy(() => import('./features/offerings/CreateSacrificePage')) },
  { match: h => h === '#/scene/create', component: lazy(() => import('./features/offerings/CreateScenePage')) },
  { match: h => h === '#/bridge/lock', component: lazy(() => import('./features/bridge/BridgeLockPage')) },
  { match: h => h === '#/ledger/cleanup', component: lazy(() => import('./features/ledger/LedgerCleanupPage')) },
  { match: h => h === '#/admin/otc', component: lazy(() => import('./features/otc/AdminOtcSettingsPage')) },
  { match: h => h === '#/otc/order', component: lazy(() => import('./features/otc/CreateOrderPage')) },
  { match: h => h === '#/otc/mm-apply', component: lazy(() => import('./features/otc/CreateMarketMakerPage')) },
  { match: h => h === '#/otc/decrypt', component: lazy(() => import('./features/otc/DecryptFilePage')) },
  { match: h => h === '#/otc/pay-result', component: lazy(() => import('./features/otc/PayResultPage')) },
  { match: h => h === '#/otc/pay-test', component: lazy(() => import('./features/otc/PayCreateTestPage')) },
  { match: h => h === '#/otc/claim', component: lazy(() => import('./features/otc/ClaimMemoForm')) },
  { match: h => h === '#/admin/offer-route', component: lazy(() => import('./features/offerings/AdminOfferRoutePage')) },
  { match: h => h === '#/ipfs/pin', component: lazy(() => import('./features/ipfs/DeceasedPinWizard')) },
  { match: h => h === '#/ipfs/usage', component: lazy(() => import('./features/ipfs/UsagePage')) },
  { match: h => h === '#/evidence/linker', component: lazy(() => import('./features/evidence/EvidenceLinkerPage')) },
  { match: h => h === '#/fee-guard', component: lazy(() => import('./features/fee-guard/FeeGuardAdminPage')) },
  { match: h => h === '#/forwarder/session', component: lazy(() => import('./features/forwarder/ForwarderSessionPage')) },
  { match: h => h === '#/ipfs/billing', component: lazy(() => import('./features/ipfs/BillingAdminPage')) },
  { match: h => h.startsWith('#/ref'), component: lazy(() => import('./features/referrals/ReferralBindPage')) },
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
