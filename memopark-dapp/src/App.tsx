import React from 'react';
import { ConfigProvider, Alert } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { WalletProvider } from './providers/WalletProvider';
import AuthEntryPage from './features/auth/AuthEntryPage';
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
    return (
      <ConfigProvider locale={zhCN}>
        <div className="App">
          <WalletProvider>
            <AuthEntryPage />
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