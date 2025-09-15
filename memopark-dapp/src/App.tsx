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
              : hash === '#/browse/category' ? <CategoryBrowse />
              : hash === '#/orders' ? <MyOrders />
              : hash === '#/timeline' ? <OfferingsTimeline />
              : hash === '#/offerings/by-who' ? <OfferingsByWho />
              : hash === '#/grave/create' ? <CreateGraveForm />
              : hash === '#/deceased/create' ? <CreateDeceasedForm />
              : hash === '#/grave/detail' ? <GraveDetailPage />
              : hash === '#/grave/list' ? <GraveListPage />
              : hash === '#/grave/my' ? <MyGravesPage />
              : hash === '#/treasury' ? <TreasuryPage />
              : hash === '#/dashboard' ? <DashboardPage />
              : hash === '#/gov/me' ? <MyGovernancePage />
              : hash === '#/profile' ? <ProfilePage />
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