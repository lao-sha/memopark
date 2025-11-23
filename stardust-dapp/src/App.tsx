import React from 'react';
import { ConfigProvider, Alert, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import { WalletProvider } from './providers/WalletProvider';
import memorialTheme from './theme/colors';
import AuthEntryPage from './features/auth/AuthEntryPage';
import AdminPause from './features/offerings/AdminPause';
import AdminCategory from './features/offerings/AdminCategory';
import AdminEffect from './features/offerings/AdminEffect';
import CategoryBrowse from './features/offerings/CategoryBrowse';
import MyOrders from './features/offerings/MyOrders';
import OfferingsTimeline from './features/offerings/OfferingsTimeline';
import OfferingsByWho from './features/offerings/OfferingsByWho';
import BottomNav from './components/nav/BottomNav';
import TreasuryPage from './features/treasury/TreasuryPage';
import DashboardPage from './features/dashboard/DashboardPage';
// import CreateDeceasedForm from './features/deceased/CreateDeceasedForm';  // 🗑️ 2025-11-17: 已删除，使用 CreateDeceasedPage
import DeceasedListPage from './features/deceased/DeceasedListPage';
import CreateCategoryPage from './features/offerings/CreateCategoryPage';
import CreatePrimaryCategoryPage from './features/offerings/CreatePrimaryCategoryPage';
import CreateSacrificePage from './features/offerings/CreateSacrificePage';
import CreateScenePage from './features/offerings/CreateScenePage';
import CategoryListPage from './features/offerings/CategoryListPage';
import SubmitAppealPage from './features/governance/SubmitAppealPage';
import BridgeLockPage from './features/bridge/BridgeLockPage';
import AdminOtcSettingsPage from './features/otc/AdminOtcSettingsPage';
import DeceasedPinWizard from './features/ipfs/DeceasedPinWizard';
import AdminOfferRoutePage from './features/offerings/AdminOfferRoutePage';
import ReferralBindPage from './features/referrals/ReferralBindPage';
import BillingAdminPage from './features/ipfs/BillingAdminPage';
import UsagePage from './features/ipfs/UsagePage';
import './App.css';
import { initAutoPinOnce } from './lib/auto-pin';
import SettingsButton from './components/nav/SettingsButton';
import SettingsDrawer from './components/nav/SettingsDrawer';
import { GovernanceUiProvider } from './providers/GovernanceUiProvider';
import EvidenceLinkerPage from './features/evidence/EvidenceLinkerPage';
import IdentityViewerPage from './features/identity/IdentityViewerPage';
import OriginRestrictionPage from './features/origin/OriginRestrictionPage';
import RewardParamsPanel from './features/affiliate/RewardParamsPanel';
import BridgeParamsPage from './features/bridge/BridgeParamsPage';
import ClaimMemoForm from './features/otc/ClaimMemoForm';  // 首购领取（原OTC领取）
import CreateOrderPage from './features/otc/CreateOrderPage';
import PayCreateTestPage from './features/otc/PayCreateTestPage';
import CreateMarketMakerPage from './features/otc/CreateMarketMakerPage';
import PayResultPage from './features/otc/PayResultPage';
import { resolveRoute } from './routes';
import UIShowcase from './components/ui/UIShowcase';

/**
 * 函数级详细中文注释：应用主组件
 * - 提供中文语言环境配置
 * - 包装钱包提供者和认证页面
 * - 安装全局"自动 Pin"监听器，实现内容保存后的无感计费接入
 * - 包裹 GovernanceUiProvider，提供专家/治理模式全局开关与齿轮入口
 * - 配置 React Query 客户端，提供数据缓存和状态管理
 */
const App: React.FC = () => {
  console.log('🚀 App组件开始渲染');

  // 创建 QueryClient 实例
  const [queryClient] = React.useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5分钟
          gcTime: 10 * 60 * 1000,   // 10分钟垃圾回收
          retry: 1,
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: 1,
        },
      },
    })
  );

  try {
    // 安装自动 Pin 监听器（仅一次）
    React.useEffect(() => { initAutoPinOnce() }, [])

    // 监听 hash 变化以触发重渲染
    const [hash, setHash] = React.useState<string>(typeof window !== 'undefined' ? window.location.hash : '');
    React.useEffect(() => {
      const onHash = () => setHash(window.location.hash);
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    return (
      <QueryClientProvider client={queryClient}>
        <ConfigProvider locale={zhCN} theme={memorialTheme}>
          <AntdApp>
            <div className="App">
              <GovernanceUiProvider>
                <WalletProvider>
                  {(() => {
                    const Dynamic = resolveRoute(hash);
                    if (Dynamic) {
                      return (
                        <React.Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#888'}}>加载中...</div>}>
                          <Dynamic />
                        </React.Suspense>
                      );
                    }
                    // 旧墓位相关路由已删除
                    if (hash === '#/evidence/linker') return <EvidenceLinkerPage />; // 仍保留直载页
                    if (hash === '#/otc/claim') return <ClaimMemoForm />;  // 首购领取（兼容路径）
                    return <AuthEntryPage />;
                  })()}
                <BottomNav />
                <SettingsButton />
                <SettingsDrawer />
              </WalletProvider>
            </GovernanceUiProvider>
          </div>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
    );
  } catch (error) {
    console.error('❌ App组件渲染错误:', error);
    return (
      <div style={{ 
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#fff2f0'
      }}>
        <Alert
          message="应用加载失败"
          description={`错误: ${error instanceof Error ? error.message : '未知错误'}`}
          type="error"
          showIcon
        />
      </div>
    );
  }
};

export default App;