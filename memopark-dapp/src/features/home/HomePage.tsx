import React, { useEffect, useState } from 'react'
import { Card, Typography, Alert, Button, Space, List, Avatar } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { sessionManager } from '../../lib/sessionManager'
import AccountsOverview from '../../components/wallet/AccountsOverview'
import CurrentAccountBar from '../../components/wallet/CurrentAccountBar'
import RecentTxList from '../../components/wallet/RecentTxList'
import type { SessionData } from '../../lib/sessionManager'
import { useWallet } from '../../providers/WalletProvider'

const HomePage: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const [session, setSession] = useState<SessionData | null>(null)
  const { isConnected, accounts, selectedAccount } = useWallet()

  useEffect(() => {
    const s = sessionManager.getCurrentSession() || sessionManager.init()
    setSession(s)
  }, [])

  const handleLogout = () => {
    sessionManager.clearSession()
    setSession(null)
    onLogout?.()
  }

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: '0 auto' }}>
      <Card>
        <Typography.Title level={3} style={{ marginBottom: 16 }}>主页</Typography.Title>

        {!session ? (
          <Alert type="warning" showIcon message="未检测到有效会话，请重新登录" style={{ marginBottom: 16 }} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              type="success"
              showIcon
              message="登录成功"
              description={
                <div>
                  <div>
                    <Typography.Text strong>地址：</Typography.Text>
                    <Typography.Text code style={{ wordBreak: 'break-all' }}>{session.address}</Typography.Text>
                  </div>
                  <div>
                    <Typography.Text type="secondary">会话ID：</Typography.Text>
                    <Typography.Text style={{ marginLeft: 8 }}>{session.sessionId}</Typography.Text>
                  </div>
                </div>
              }
            />

            <CurrentAccountBar />
            <Card size="small" title="钱包状态">
              <div style={{ marginBottom: 8 }}>
                <Typography.Text>区块链连接：</Typography.Text>
                <Typography.Text style={{ marginLeft: 8 }}>{isConnected ? '✅ 已连接' : '❌ 未连接'}</Typography.Text>
              </div>
              {selectedAccount && (
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text>当前账户：</Typography.Text>
                  <Typography.Text code style={{ marginLeft: 8 }}>{selectedAccount.address}</Typography.Text>
                </div>
              )}
              {accounts.length > 0 && (
                <List
                  size="small"
                  dataSource={accounts}
                  header={<Typography.Text>账户列表（{accounts.length}）</Typography.Text>}
                  renderItem={(a) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar size="small" icon={<UserOutlined />} />}
                        title={a.meta?.name || '未命名账户'}
                        description={<Typography.Text style={{ fontSize: 12 }}>{a.address}</Typography.Text>}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <AccountsOverview />
            <RecentTxList />

            <Space>
              <Button type="primary" onClick={()=> window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'transfer' } }))}>转账</Button>
              <Button onClick={()=> window.scrollTo({ top: 0, behavior: 'smooth' })}>返回顶部</Button>
              <Button danger onClick={handleLogout}>退出登录</Button>
            </Space>
          </Space>
        )}
      </Card>
    </div>
  )
}

export default HomePage

