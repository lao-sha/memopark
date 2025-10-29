import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Space, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  BarChartOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SafetyOutlined,
  FileProtectOutlined,
  SolutionOutlined,
  ToolOutlined,
  DatabaseOutlined,
  WalletOutlined
} from '@ant-design/icons'
import { useWallet } from '@/contexts/Wallet'
import WalletConnect from '@/components/WalletConnect'
import './index.css'

const { Header, Sider, Content, Footer } = Layout

/**
 * 基础布局组件
 * 包含侧边栏、头部、内容区域
 */
export default function BasicLayout() {
  const [collapsed, setCollapsed] = React.useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { activeAccount, accounts, setActiveAccount } = useWallet()

  // 菜单项
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: '/proposals',
      icon: <FileTextOutlined />,
      label: '提案管理',
      children: [
        { key: '/proposals', label: '提案列表' },
        { key: '/proposals/create', label: '创建提案' }
      ]
    },
    {
      key: '/voting',
      icon: <CheckCircleOutlined />,
      label: '投票管理'
    },
    {
      key: '/applications',
      icon: <FolderOpenOutlined />,
      label: '申请审核'
    },
    {
      key: '/content-governance',
      icon: <SafetyOutlined />,
      label: '内容治理'
    },
    {
      key: '/arbitration',
      icon: <SolutionOutlined />,
      label: '仲裁管理'
    },
    {
      key: '/referenda',
      icon: <FileProtectOutlined />,
      label: '公投管理',
      children: [
        { key: '/referenda', label: '公投列表' },
        { key: '/tracks', label: '轨道配置' }
      ]
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: '数据分析'
    },
    {
      key: '/members',
      icon: <TeamOutlined />,
      label: '成员管理'
    },
    {
      key: '/committees',
      icon: <TeamOutlined />,
      label: '委员会',
      children: [
        { key: '/committees', label: '全部委员会' },
        { key: '/treasury-committee', label: '财务委员会' }
      ]
    },
    {
      key: '/tools',
      icon: <ToolOutlined />,
      label: '治理工具',
      children: [
        { key: '/grave-governance', label: '墓地治理' },
        { key: '/park-governance', label: '陵园治理' },
        { key: '/market-maker-governance', label: '做市商审批' },
        { key: '/market-maker-quick-approval', label: '做市商快速审批' },
        { key: '/market-maker-listing', label: '做市商创建挂单' }
      ]
    },
    {
      key: '/operator-management',
      icon: <DatabaseOutlined />,
      label: '运营者管理'
    },
    {
      key: '/wallet-menu',
      icon: <WalletOutlined />,
      label: '钱包管理',
      children: [
        { key: '/wallet/manage', label: '我的钱包' },
        { key: '/wallet/recover', label: '恢复钱包' }
      ]
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置'
    }
  ]

  // 账户下拉菜单
  const accountMenuItems: any[] = accounts.map((address: string) => ({
    key: address,
    label: (
      <div onClick={() => setActiveAccount(address)}>
        <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>
          {address.slice(0, 10)}...{address.slice(-10)}
        </div>
      </div>
    )
  }))

  accountMenuItems.push(
    { type: 'divider', key: 'divider' },
    {
      key: 'manage-wallets',
      label: '管理钱包',
      icon: <WalletOutlined />,
      onClick: () => navigate('/wallet/manage')
    }
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={256}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0
        }}
      >
        <div className="logo">
          {!collapsed && <span>Memopark 治理平台</span>}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      {/* 主内容区 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 256, transition: 'margin-left 0.2s' }}>
        {/* 头部 */}
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />

          <Space size="large">
            <WalletConnect />
            
            {activeAccount && (
              <Dropdown menu={{ items: accountMenuItems }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar size="small">
                    {accounts.find(a => a.address === activeAccount)?.meta.name?.[0] || 'U'}
                  </Avatar>
                  <span>
                    {accounts.find(a => a.address === activeAccount)?.meta.name || '账户'}
                  </span>
                </Space>
              </Dropdown>
            )}
          </Space>
        </Header>

        {/* 内容 */}
        <Content style={{ margin: '24px', minHeight: 'calc(100vh - 134px)' }}>
          <Outlet />
        </Content>

        {/* 页脚 */}
        <Footer style={{ textAlign: 'center', background: '#fff' }}>
          Memopark Governance Platform ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  )
}

