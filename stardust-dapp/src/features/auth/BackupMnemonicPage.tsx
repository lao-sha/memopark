import React, { useState } from 'react';
import { Button, Typography, Space, message, Alert } from 'antd';
import { CopyOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * 函数级详细中文注释：备份助记词页面组件
 * - 在用户创建钱包后显示，展示生成的助记词
 * - 要求用户抄写并妥善保管助记词
 * - 提供复制功能，方便用户备份
 * - 强调助记词的重要性和安全提示
 * - 移动端优先设计，最大宽度 640px 居中
 */
interface BackupMnemonicPageProps {
  mnemonic: string;
  address: string;
  onBackupComplete: () => void;
  onBack?: () => void;
}

const BackupMnemonicPage: React.FC<BackupMnemonicPageProps> = ({
  mnemonic,
  address,
  onBackupComplete,
  onBack
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  /**
   * 函数级详细中文注释：处理复制助记词
   * - 将助记词复制到剪贴板
   * - 显示复制成功提示
   * - 更新复制状态图标
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      message.success('助记词已复制到剪贴板');
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      message.error('复制失败，请手动选择复制');
    }
  };

  /**
   * 函数级详细中文注释：处理备份完成
   * - 确认用户已备份助记词
   * - 调用回调函数进入下一步
   */
  const handleConfirm = () => {
    if (!confirmed) {
      message.warning('请先确认您已安全备份助记词');
      return;
    }
    onBackupComplete();
  };

  // 将助记词分割成单词数组
  const words = mnemonic.trim().split(/\s+/);

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '414px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fff7e6 0%, #ffffff 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* 返回按钮 */}
      {onBack && (
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <Button type="text" onClick={onBack}>
            &lt; 创建钱包
          </Button>
        </div>
      )}

      {/* 标题区域 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2} style={{ color: '#fa8c16', marginBottom: '8px' }}>
          创建成功
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          请备份钱包助记词，在任何情况下，它是恢复资产的唯一方式。
        </Text>
      </div>

      {/* 成功图标 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(24, 144, 255, 0.3)',
            animation: 'scaleIn 0.5s ease-out',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              fontSize: '60px',
              color: '#fff',
              lineHeight: 1,
            }}
          >
            👌
          </div>
        </div>
        <style>
          {`
            @keyframes scaleIn {
              0% {
                transform: scale(0);
                opacity: 0;
              }
              50% {
                transform: scale(1.1);
              }
              100% {
                transform: scale(1);
                opacity: 1;
              }
            }
          `}
        </style>
      </div>

      {/* 钱包地址 */}
      <div
        style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #e8e8e8',
        }}
      >
        <Text type="secondary" style={{ fontSize: '12px' }}>
          钱包地址
        </Text>
        <Paragraph
          copyable
          style={{
            marginTop: '8px',
            marginBottom: 0,
            fontFamily: 'monospace',
            fontSize: '12px',
            wordBreak: 'break-all',
          }}
        >
          {address}
        </Paragraph>
      </div>

      {/* 安全警告 */}
      <Alert
        icon={<WarningOutlined />}
        type="warning"
        showIcon
        style={{ marginBottom: '24px', borderRadius: '12px' }}
        message={
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              安全提示
            </Text>
            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '12px' }}>
              <li>助记词是恢复钱包的唯一凭证</li>
              <li>请抄写在纸上，妥善保管</li>
              <li>不要截图、拍照或发送给他人</li>
              <li>谨防诈骗，官方不会索要助记词</li>
            </ul>
          </div>
        }
      />

      {/* 助记词展示区域 */}
      <div
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '2px dashed #fa8c16',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <Text strong style={{ fontSize: '16px' }}>
            助记词
          </Text>
          <Button
            type="link"
            icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
            style={{ color: copied ? '#52c41a' : '#1890ff' }}
          >
            {copied ? '已复制' : '复制'}
          </Button>
        </div>

        {/* 助记词网格 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
          }}
        >
          {words.map((word, index) => (
            <div
              key={index}
              style={{
                background: '#fafafa',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e8e8e8',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '24px',
                  height: '24px',
                  background: '#1890ff',
                  color: '#fff',
                  borderRadius: '50%',
                  textAlign: 'center',
                  lineHeight: '24px',
                  fontSize: '12px',
                  marginRight: '8px',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  wordBreak: 'break-all',
                }}
              >
                {word}
              </span>
            </div>
          ))}
        </div>

        {/* 复制提示 */}
        <Text
          type="secondary"
          style={{
            display: 'block',
            marginTop: '16px',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          {address.substring(0, 30)}...
        </Text>
      </div>

      {/* 确认备份 */}
      <div
        style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #e8e8e8',
          cursor: 'pointer',
        }}
        onClick={() => setConfirmed(!confirmed)}
      >
        <Space>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: confirmed ? '2px solid #1890ff' : '2px solid #d9d9d9',
              background: confirmed ? '#1890ff' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
            }}
          >
            {confirmed && (
              <CheckCircleOutlined style={{ color: '#fff', fontSize: '12px' }} />
            )}
          </div>
          <Text style={{ fontSize: '14px' }}>
            我已安全备份助记词，了解丢失助记词将无法恢复资产
          </Text>
        </Space>
      </div>

      {/* 备份钱包按钮 */}
      <Button
        type="primary"
        size="large"
        block
        onClick={handleConfirm}
        disabled={!confirmed}
        style={{
          height: '56px',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '12px',
          background: confirmed
            ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
            : undefined,
          border: 'none',
          boxShadow: confirmed ? '0 4px 12px rgba(24, 144, 255, 0.3)' : undefined,
        }}
      >
        备份钱包
      </Button>

      {/* 底部提示 */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          备份完成后，请前往登录页面使用密码登录
        </Text>
      </div>
    </div>
  );
};

export default BackupMnemonicPage;

