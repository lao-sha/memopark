import React from 'react';
import { Button, Typography } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 函数级详细中文注释：钱包创建成功页面组件
 * - 在设置密码后、备份助记词前显示
 * - 展示创建成功的视觉反馈
 * - 提示用户下一步操作（备份钱包）
 * - 参考设计：OK 手势 + 创建成功提示 + 备份钱包按钮
 * - 移动端优先设计，最大宽度 640px 居中
 */
interface WalletCreatedPageProps {
  onContinue: () => void;
  walletAddress?: string;
}

const WalletCreatedPage: React.FC<WalletCreatedPageProps> = ({
  onContinue,
  walletAddress
}) => {
  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '480px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fff7e6 0%, #ffffff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 顶部链接提示 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Text type="secondary" style={{ fontSize: '12px', color: '#bfbfbf' }}>
          https://www.memopark.com/wallet/create
        </Text>
      </div>

      {/* 成功手势图标 */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div
          style={{
            width: '160px',
            height: '160px',
            margin: '0 auto',
            position: 'relative',
            animation: 'bounceIn 0.6s ease-out',
          }}
        >
          {/* 手臂 */}
          <div
            style={{
              width: '80px',
              height: '100px',
              background: 'linear-gradient(180deg, #5B8FF9 0%, #4E7CDB 100%)',
              position: 'absolute',
              bottom: '0',
              left: '50%',
              transform: 'translateX(-50%)',
              borderRadius: '0 0 40px 40px',
            }}
          >
            {/* 袖口 */}
            <div
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                height: '16px',
                background: '#4169E1',
                borderRadius: '8px 8px 0 0',
              }}
            />
          </div>

          {/* 手掌 */}
          <div
            style={{
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #FFD4A8 0%, #FFBE8E 100%)',
              borderRadius: '50% 50% 50% 0',
              position: 'absolute',
              top: '0',
              left: '50%',
              transform: 'translateX(-50%) rotate(-20deg)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* 拇指 */}
            <div
              style={{
                width: '28px',
                height: '45px',
                background: 'linear-gradient(135deg, #FFD4A8 0%, #FFBE8E 100%)',
                borderRadius: '14px',
                position: 'absolute',
                bottom: '12px',
                left: '-8px',
                transform: 'rotate(-30deg)',
              }}
            />

            {/* 食指 */}
            <div
              style={{
                width: '24px',
                height: '50px',
                background: 'linear-gradient(135deg, #FFD4A8 0%, #FFBE8E 100%)',
                borderRadius: '12px',
                position: 'absolute',
                top: '-25px',
                left: '20px',
                transform: 'rotate(10deg)',
              }}
            />

            {/* OK 圆圈 */}
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '4px solid #FFD4A8',
                borderRadius: '50%',
                position: 'absolute',
                top: '15px',
                left: '18px',
                background: 'transparent',
              }}
            />
          </div>
        </div>

        <style>
          {`
            @keyframes bounceIn {
              0% {
                transform: scale(0) translateY(50px);
                opacity: 0;
              }
              50% {
                transform: scale(1.15) translateY(-10px);
              }
              70% {
                transform: scale(0.95) translateY(5px);
              }
              100% {
                transform: scale(1) translateY(0);
                opacity: 1;
              }
            }
          `}
        </style>
      </div>

      {/* 创建成功标题 */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <Title level={2} style={{ color: '#fa8c16', marginBottom: '12px', fontSize: '28px' }}>
          创建成功
        </Title>
        <Text type="secondary" style={{ fontSize: '14px', display: 'block', lineHeight: '1.6' }}>
          请备份钱包助记词，在任何情况下，它是恢复资产的唯一方式。
        </Text>
      </div>

      {/* 钱包地址显示（可选） */}
      {walletAddress && (
        <div
          style={{
            background: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '32px',
            border: '1px solid #e8e8e8',
            maxWidth: '90%',
          }}
        >
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
            钱包地址
          </Text>
          <Text
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              color: '#262626',
            }}
          >
            {walletAddress}
          </Text>
        </div>
      )}

      {/* 备份钱包按钮 */}
      <div style={{ width: '100%', maxWidth: '400px', marginBottom: '24px' }}>
        <Button
          type="primary"
          size="large"
          block
          onClick={onContinue}
          icon={<CheckCircleOutlined />}
          style={{
            height: '56px',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '28px',
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            border: 'none',
            boxShadow: '0 4px 16px rgba(24, 144, 255, 0.4)',
          }}
        >
          备份钱包
        </Button>
      </div>

      {/* 底部提示 */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.8' }}>
          点击"备份钱包"查看并保存您的助记词
          <br />
          助记词是恢复钱包的唯一凭证，请妥善保管
        </Text>
      </div>
    </div>
  );
};

export default WalletCreatedPage;

