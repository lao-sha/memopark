/**
 * 函数级详细中文注释：钱包连接 UI 组件（治理平台专用，导航栏版本）
 * - 显示当前连接的账户地址和余额（简洁版）
 * - 高度与导航栏对齐（64px）
 * - 提示用户恢复钱包（治理平台不支持创建钱包）
 */
import React from 'react'
import { Button, Typography, Space, Tooltip, Divider } from 'antd'
import { WalletOutlined, ReloadOutlined, ImportOutlined } from '@ant-design/icons'
import { useWallet } from '../../contexts/Wallet'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

export const WalletConnect: React.FC = () => {
  const { activeAccount, balance, isConnected, refreshBalance } = useWallet()
  const navigate = useNavigate()

  // 未连接状态：提示用户恢复钱包
  if (!isConnected) {
    return (
      <Space>
        <Button 
          type="primary"
          icon={<ImportOutlined />}
          onClick={() => navigate('/wallet/recover')}
        >
          恢复钱包
        </Button>
      </Space>
    )
  }

  // 已连接状态：显示账户信息（简洁版）
  return (
    <Space 
      split={<Divider type="vertical" />}
      style={{ 
        height: 64, 
        display: 'flex', 
        alignItems: 'center',
        padding: '0 16px',
        backgroundColor: '#f5f5f5',
        borderRadius: 4
      }}
    >
      <WalletOutlined style={{ fontSize: 18, color: '#1890ff' }} />
      
      {/* 地址 */}
      <Tooltip title={activeAccount}>
        <Text 
          code 
          style={{ fontSize: 12, fontFamily: 'monospace' }}
          copyable={{ text: activeAccount || '' }}
        >
          {activeAccount?.slice(0, 6)}...{activeAccount?.slice(-4)}
        </Text>
      </Tooltip>

      {/* 余额 */}
      <div style={{ textAlign: 'right' }}>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.2 }}>
          可用余额：
        </Text>
        <Text strong style={{ fontSize: 14, color: '#1890ff', display: 'block', lineHeight: 1.4 }}>
          {balance} DUST
        </Text>
      </div>

      {/* 刷新按钮 */}
      <Tooltip title="刷新余额">
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => refreshBalance()}
          type="text"
        />
      </Tooltip>
    </Space>
  )
}

export default WalletConnect
