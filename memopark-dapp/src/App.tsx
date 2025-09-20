import React from 'react';
import { ConfigProvider, Alert } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { WalletProvider } from './providers/WalletProvider';
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
import MyGovernancePage from './features/governance/MyGovernancePage';
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
import CreateCategoryPage from './features/offerings/CreateCategoryPage';
import CreatePrimaryCategoryPage from './features/offerings/CreatePrimaryCategoryPage';
import CreateSacrificePage from './features/offerings/CreateSacrificePage';
import CreateScenePage from './features/offerings/CreateScenePage';
import CategoryListPage from './features/offerings/CategoryListPage';
import GovTicketPage from './features/governance/GovTicketPage';
import ContentCommitteePage from './features/governance/ContentCommitteePage';
import SubmitAppealPage from './features/governance/SubmitAppealPage';
import CommitteeTemplatesPage from './features/governance/CommitteeTemplatesPage';
import './App.css';

/**
 * 函数级详细中文注释：应用主组件
 * - 提供中文语言环境配置
 * - 包装钱包提供者和认证页面
 * - 确保应用能正常渲染
 */
const App: React.FC = () => {
  console.log('🚀 App组件开始渲染');

  try {
    // 监听 hash 变化以触发重渲染
    const [hash, setHash] = React.useState<string>(typeof window !== 'undefined' ? window.location.hash : '');
    React.useEffect(() => {
      const onHash = () => setHash(window.location.hash);
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    return (
      <ConfigProvider locale={zhCN}>
        <div className="App">
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
              : hash === '#/gov/ticket' ? <GovTicketPage />
              : hash === '#/gov/me' ? <MyGovernancePage />
              : hash === '#/gov/content' ? <ContentCommitteePage />
              : hash === '#/gov/appeal' ? <SubmitAppealPage />
              : hash === '#/gov/templates' ? <CommitteeTemplatesPage />
              : hash === '#/profile' ? <ProfilePage />
              : hash === '#/covers' ? <CoverOptionsPage />
              : hash === '#/covers/create' ? <CreateCoverOptionPage />
              : hash === '#/category/create' ? <CreateCategoryPage />
              : hash === '#/category/create-primary' ? <CreatePrimaryCategoryPage />
              : hash === '#/category/list' ? <CategoryListPage />
              : hash === '#/sacrifice/create' ? <CreateSacrificePage />
              : hash === '#/scene/create' ? <CreateScenePage />
              : <AuthEntryPage />}
            <BottomNav />
          </WalletProvider>
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