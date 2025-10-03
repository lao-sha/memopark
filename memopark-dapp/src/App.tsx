import React from 'react';
import { ConfigProvider, Alert } from 'antd';
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
import ProfilePage from './features/profile/ProfilePage';
import GraveListPage from './features/grave/GraveListPage';
import MyGravesPage from './features/grave/MyGravesPage';
import DashboardPage from './features/dashboard/DashboardPage';
import CreateGraveForm from './features/grave/CreateGraveForm';
import GraveDetailPage from './features/grave/GraveDetailPage';
import CreateDeceasedForm from './features/deceased/CreateDeceasedForm';
import DeceasedListPage from './features/deceased/DeceasedListPage';
import CoverOptionsPage from './features/grave/CoverOptionsPage';
import CreateCoverOptionPage from './features/grave/CreateCoverOptionPage';
import GraveAudioPicker from './features/grave/GraveAudioPicker';
import CarouselEditorPage from './features/grave/CarouselEditorPage';
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
import FeeGuardAdminPage from './features/fee-guard/FeeGuardAdminPage';
import ForwarderSessionPage from './features/forwarder/ForwarderSessionPage';
import BillingAdminPage from './features/ipfs/BillingAdminPage';
import UsagePage from './features/ipfs/UsagePage';
import './App.css';
import { initAutoPinOnce } from './lib/auto-pin';
import SettingsButton from './components/nav/SettingsButton';
import SettingsDrawer from './components/nav/SettingsDrawer';
import { GovernanceUiProvider } from './providers/GovernanceUiProvider';
import LedgerCleanupPage from './features/ledger/LedgerCleanupPage';
import EvidenceLinkerPage from './features/evidence/EvidenceLinkerPage';
import IdentityViewerPage from './features/identity/IdentityViewerPage';
import OriginRestrictionPage from './features/origin/OriginRestrictionPage';
import RewardParamsPanel from './features/affiliate/RewardParamsPanel';
import BridgeParamsPage from './features/bridge/BridgeParamsPage';
import ClaimMemoForm from './features/otc/ClaimMemoForm';
import CreateOrderPage from './features/otc/CreateOrderPage';
import PayCreateTestPage from './features/otc/PayCreateTestPage';
import CreateMarketMakerPage from './features/otc/CreateMarketMakerPage';
import PayResultPage from './features/otc/PayResultPage';

/**
 * 函数级详细中文注释：应用主组件
 * - 提供中文语言环境配置
 * - 包装钱包提供者和认证页面
 * - 安装全局“自动 Pin”监听器，实现内容保存后的无感计费接入
 * - 包裹 GovernanceUiProvider，提供专家/治理模式全局开关与齿轮入口
 */
const App: React.FC = () => {
  console.log('🚀 App组件开始渲染');

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
      <ConfigProvider locale={zhCN} theme={memorialTheme}>
        <div className="App">
          <GovernanceUiProvider>
            <WalletProvider>
              {hash === '#/admin/pause' ? <AdminPause />
                : hash === '#/admin/category' ? <AdminCategory />
                : hash === '#/admin/effect' ? <AdminEffect />
                : hash.startsWith('#/browse/category') ? <CategoryBrowse />
                : hash === '#/orders' ? <MyOrders />
                : hash === '#/timeline' ? <OfferingsTimeline />
                : hash === '#/offerings/by-who' ? <OfferingsByWho />
                : hash === '#/grave/create' ? <CreateGraveForm />
                : hash === '#/deceased/create' ? <CreateDeceasedForm />
                : hash.startsWith('#/grave/detail') ? <GraveDetailPage />
                : hash === '#/deceased/list' ? <DeceasedListPage />
                : hash === '#/grave/my' ? <MyGravesPage />
                : hash === '#/treasury' ? <TreasuryPage />
                : hash === '#/dashboard' ? <DashboardPage />
                : hash === '#/gov/appeal' ? <SubmitAppealPage />
                : hash === '#/profile' ? <ProfilePage />
                : hash === '#/covers' ? <CoverOptionsPage />
                : hash === '#/covers/create' ? <CreateCoverOptionPage />
                : hash === '#/grave/audio' ? <GraveAudioPicker />
                : hash === '#/carousel/editor' ? <CarouselEditorPage />
                : hash === '#/category/create' ? <CreateCategoryPage />
                : hash === '#/identity' ? <IdentityViewerPage />
                : hash === '#/origin' ? <OriginRestrictionPage />
                : hash === '#/affiliate/params' ? <RewardParamsPanel />
                : hash === '#/bridge/params' ? <BridgeParamsPage />
                : hash === '#/category/create-primary' ? <CreatePrimaryCategoryPage />
                : hash === '#/category/list' ? <CategoryListPage />
                : hash === '#/sacrifice/create' ? <CreateSacrificePage />
                : hash === '#/scene/create' ? <CreateScenePage />
                : hash === '#/bridge/lock' ? <BridgeLockPage />
                : hash === '#/ledger/cleanup' ? <LedgerCleanupPage />
                : hash === '#/admin/otc' ? <AdminOtcSettingsPage />
                : hash === '#/otc/order' ? <CreateOrderPage />
                : hash === '#/otc/mm-apply' ? <CreateMarketMakerPage />
                : hash === '#/otc/pay-result' ? <PayResultPage />
                : hash === '#/otc/pay-test' ? <PayCreateTestPage />
                : hash === '#/otc/claim' ? <ClaimMemoForm />
                : hash === '#/admin/offer-route' ? <AdminOfferRoutePage />
                : hash === '#/ipfs/pin' ? <DeceasedPinWizard />
                : hash === '#/ipfs/usage' ? <UsagePage />
                : hash === '#/evidence/linker' ? <EvidenceLinkerPage />
                : hash === '#/fee-guard' ? <FeeGuardAdminPage />
                : hash === '#/forwarder/session' ? <ForwarderSessionPage />
                : hash === '#/ipfs/billing' ? <BillingAdminPage />
                : hash.startsWith('#/ref') ? <ReferralBindPage />
                : <AuthEntryPage />}
              <BottomNav />
              <SettingsButton />
              <SettingsDrawer />
            </WalletProvider>
          </GovernanceUiProvider>
        </div>
      </ConfigProvider>
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