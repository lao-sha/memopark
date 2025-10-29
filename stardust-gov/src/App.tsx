/**
 * 主应用组件
 * 函数级中文注释：应用入口，配置路由和布局
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Layout, Menu, Typography, Space } from 'antd';
import {
  CheckCircleOutlined,
  UnorderedListOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import { ApiProvider } from './contexts/ApiContext';
import MarketMakerApproval from './pages/MarketMakerApproval';
import MarketMakerListing from './pages/MarketMakerListing';
import WalletManage from './pages/WalletManage';
import { clearAllCache } from './lib/cacheManager';
import { ErrorBoundary } from './components/ErrorBoundary';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

/**
 * 函数级中文注释：主应用组件
 */
const App: React.FC = () => {
  const [current, setCurrent] = React.useState('approval');

  // 应用启动时清理缓存
  React.useEffect(() => {
    console.log('🚀 应用启动，清理缓存...');

    // 使用缓存管理器清理缓存
    clearAllCache();

    console.log('✅ 应用启动时缓存清理完成');
  }, []);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('应用级别错误:', error, errorInfo);
        // 这里可以集成错误监控服务
      }}
      showDetails={process.env.NODE_ENV === 'development'}
    >
      <ApiProvider endpoint="ws://127.0.0.1:9944">
        <BrowserRouter>
          <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', alignItems: 'center', background: '#001529' }}>
              <Title level={3} style={{ color: '#fff', margin: 0, marginRight: 40 }}>
                🏛️ Memopark 做市商治理
              </Title>

              <Menu
                theme="dark"
                mode="horizontal"
                selectedKeys={[current]}
                onClick={(e) => setCurrent(e.key)}
                style={{ flex: 1, minWidth: 0 }}
              >
                <Menu.Item key="wallet" icon={<GithubOutlined />}>
                  <Link to="/wallet">钱包管理</Link>
                </Menu.Item>
                <Menu.Item key="approval" icon={<CheckCircleOutlined />}>
                  <Link to="/approval">做市商审批</Link>
                </Menu.Item>
                <Menu.Item key="listing" icon={<UnorderedListOutlined />}>
                  <Link to="/listing">挂单管理</Link>
                </Menu.Item>
              </Menu>

              <Space style={{ color: '#fff' }}>
                <a
                  href="https://github.com/memopark"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#fff' }}
                >
                  <GithubOutlined style={{ fontSize: 20 }} />
                </a>
              </Space>
            </Header>

            <Content style={{ padding: '0 50px', marginTop: 20 }}>
              <ErrorBoundary
                onError={(error, errorInfo) => {
                  console.error('路由级别错误:', error, errorInfo);
                }}
              >
                <Routes>
                  <Route path="/" element={<Navigate to="/wallet" replace />} />
                  <Route path="/wallet" element={<WalletManage />} />
                  <Route path="/approval" element={<MarketMakerApproval />} />
                  <Route path="/listing" element={<MarketMakerListing />} />
                </Routes>
              </ErrorBoundary>
            </Content>

            <Footer style={{ textAlign: 'center' }}>
              Memopark ©{new Date().getFullYear()} - 做市商治理平台
            </Footer>
          </Layout>
        </BrowserRouter>
      </ApiProvider>
    </ErrorBoundary>
  );
};

export default App;

