import React, { useState } from 'react';
import { Card, Button, Typography, Alert, Space } from 'antd';
import { WalletOutlined, ReloadOutlined } from '@ant-design/icons';
import { useWallet } from '../../providers/WalletProvider';

const { Title, Text } = Typography;

/**
 * 函数级详细中文注释：认证页面组件
 * - 显示链连接状态
 * - 本地钱包模式：不提供扩展连接与账户选择
 */
const AuthPage: React.FC = () => {
  console.log('AuthPage组件开始渲染');
  
  const { 
    api, 
    isConnected, 
    isLoading, 
    error 
  } = useWallet();
  
  const [connecting] = useState(false);

  /**
   * 函数级详细中文注释：处理钱包连接
   * - 设置连接状态
   * - 调用钱包连接函数
   * - 处理连接错误
   */
  const handleConnectWallet = async () => {};

  console.log('AuthPage渲染状态:', { api: !!api, isConnected, hasError: !!error });

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '414px', 
      margin: '0 auto',
      minHeight: '100vh',
      background: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Card style={{ width: '100%', maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={2} style={{ color: '#1890ff' }}>
            <WalletOutlined /> Memopark
          </Title>
          <Text type="secondary">纪念园区块链应用</Text>
        </div>

        {/* 区块链连接状态 */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <Space>
            <Text type="secondary">区块链状态:</Text>
            {api ? (
              <Text style={{ color: '#52c41a' }}>✅ 已连接</Text>
            ) : (
              <Text style={{ color: '#ff4d4f' }}>❌ 未连接</Text>
            )}
          </Space>
        </div>

        {/* 错误信息显示 */}
        {error && (
          <Alert 
            message="连接提示" 
            description={error} 
            type="warning" 
            style={{ marginBottom: '16px' }}
            showIcon
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={handleConnectWallet}>
                重试
              </Button>
            }
          />
        )}

        {/* 主要内容区域 */}
        {!isConnected ? (
          <div style={{ textAlign: 'center' }}>
            <Button 
              type="primary" 
              size="large"
              icon={<WalletOutlined />}
              onClick={()=>{}}
              loading={connecting}
              style={{ width: '100%', height: '50px' }}
              disabled={!api}
            >
              { !api ? '等待区块链节点连接...' : '本地钱包模式' }
            </Button>
            
            <div style={{ marginTop: '16px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                🔹 本地钱包模式，无需浏览器扩展<br />
                🔹 如果长时间无法连接，请检查区块链节点是否正在运行<br />
                🔹 节点地址：ws://localhost:9944
              </Text>
            </div>
          </div>
        ) : (
          <div>
            <Alert message="🎉 链连接成功！" type="success" style={{ marginBottom: '16px' }} showIcon />

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Button 
                type="primary" 
                size="large" 
                style={{ width: '100%', height: '50px' }}
              >
                🚀 进入应用
              </Button>
            </div>
          </div>
        )}

        {/* 调试信息 */}
        {process.env.NODE_ENV === 'development' && (
          <Card size="small" style={{ marginTop: '16px', background: '#fafafa' }} title="🔧 调试信息">
            <Text style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              • API连接: {api ? '✅ Connected' : '❌ Disconnected'}<br />
              • 账户数量: n/a（本地钱包）<br />
              • 钱包状态: {isConnected ? '✅ Connected' : '❌ Disconnected'}<br />
              • 加载状态: {isLoading ? '⏳ Loading' : '✅ Ready'}<br />
              • 错误状态: {error ? '❌ Has Error' : '✅ No Error'}
            </Text>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default AuthPage;