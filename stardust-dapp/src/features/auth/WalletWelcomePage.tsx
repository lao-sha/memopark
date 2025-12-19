import React from 'react';
import { Button, Typography, Space } from 'antd';
import { WalletOutlined, PlusCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 函数级详细中文注释：钱包欢迎页面组件
 * - 作为钱包登录的第一步展示页面
 * - 展示应用特色与主要功能介绍
 * - 提供创建钱包和恢复钱包两个主要入口
 * - 移动端优先设计，最大宽度 640px 居中
 * - 恢复钱包：使用助记词恢复已有钱包
 */
interface WalletWelcomePageProps {
  onCreateWallet?: () => void;
  onRestoreWallet?: () => void;  // 跳转到恢复钱包页面
}

const WalletWelcomePage: React.FC<WalletWelcomePageProps> = ({
  onCreateWallet,
  onRestoreWallet
}) => {
  /**
   * 函数级详细中文注释：处理创建钱包点击
   * - 优先使用 props 回调（在 AuthEntryPage 内部使用）
   * - 如果没有回调，则跳转到独立的创建钱包路由
   */
  const handleCreateWallet = () => {
    console.log('点击创建钱包');
    if (onCreateWallet) {
      onCreateWallet();
    } else {
      // 独立访问时，跳转到创建钱包路由
      window.location.hash = '#/wallet/create';
    }
  };

  /**
   * 函数级详细中文注释：处理恢复钱包点击
   * - 优先使用 props 回调（在 AuthEntryPage 内部使用）
   * - 如果没有回调，则跳转到独立的恢复钱包路由
   */
  const handleRestoreWallet = () => {
    console.log('点击恢复钱包');
    if (onRestoreWallet) {
      onRestoreWallet();
    } else {
      // 独立访问时，跳转到恢复钱包路由
      window.location.hash = '#/wallet/restore';
    }
  };
  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '414px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 主标题区域 */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <Title level={2} style={{ color: '#1890ff', marginBottom: '8px' }}>
          丰富的链上支持
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          Memopark 支持 Substrate 及主流区块链，高效安全快速便捷
        </Text>
      </div>

      {/* 可视化图标展示区域 */}
      <div
        style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          marginBottom: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 中心主图标 - 手持钱包 */}
        <div
          style={{
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(238, 90, 111, 0.3)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <WalletOutlined style={{ fontSize: '80px', color: '#ffffff' }} />
        </div>

        {/* 环绕的代币图标 */}
        {/* 左上角 - Bitcoin 风格 */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f7931a 0%, #f5a623 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
            animation: 'float 3s ease-in-out infinite',
          }}
        >
          <span style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>₿</span>
        </div>

        {/* 右上角 - DUST 代币 */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #B2955D 0%, #9A7D4A 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            animation: 'float 3s ease-in-out infinite 0.5s',
          }}
        >
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>M</span>
        </div>

        {/* 左下角 - Polkadot 风格 */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '30px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e6007a 0%, #c4005a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(230, 0, 122, 0.3)',
            animation: 'float 3s ease-in-out infinite 1s',
          }}
        >
          <span style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>●</span>
        </div>

        {/* 右下角 - Ethereum 风格 */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #627eea 0%, #4e5ee4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(98, 126, 234, 0.3)',
            animation: 'float 3s ease-in-out infinite 1.5s',
          }}
        >
          <span style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>◆</span>
        </div>

        <style>
          {`
            @keyframes float {
              0%, 100% {
                transform: translateY(0px);
              }
              50% {
                transform: translateY(-10px);
              }
            }
          `}
        </style>
      </div>

      {/* 操作按钮区域 */}
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 创建钱包按钮 */}
          <Button
            type="primary"
            size="large"
            block
            icon={<PlusCircleOutlined />}
            onClick={handleCreateWallet}
            style={{
              height: '56px',
              fontSize: '16px',
              fontWeight: 'bold',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #B2955D 0%, #9A7D4A 100%)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            }}
          >
            创建钱包
          </Button>

          {/* 恢复钱包按钮 */}
          <Button
            size="large"
            block
            icon={<ReloadOutlined />}
            onClick={handleRestoreWallet}
            style={{
              height: '56px',
              fontSize: '16px',
              fontWeight: 'bold',
              borderRadius: '12px',
              background: '#ffffff',
              border: '2px solid #d9d9d9',
              color: '#595959',
            }}
          >
            恢复钱包
          </Button>
        </Space>
      </div>

      {/* 底部提示文本 */}
      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          创建或恢复钱包即表示您同意
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          <a href="#" style={{ color: '#1890ff' }}>用户协议</a> 和 <a href="#" style={{ color: '#1890ff' }}>隐私政策</a>
        </Text>
      </div>
    </div>
  );
};

export default WalletWelcomePage;

