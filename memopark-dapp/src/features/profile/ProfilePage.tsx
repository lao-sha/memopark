import React, { useEffect, useState } from 'react'
import { Card, Typography, Space, Button, Alert } from 'antd'
import { getCurrentAddress } from '../../lib/keystore'
import AccountsOverview from '../../components/wallet/AccountsOverview'
import DashboardPage from '../dashboard/DashboardPage'

/**
 * 函数级详细中文注释：个人中心页
 * - 展示当前地址、账户概览与常用入口
 */
const ProfilePage: React.FC = () => {
  const [addr, setAddr] = useState<string | null>(getCurrentAddress())
  useEffect(() => { setAddr(getCurrentAddress()) }, [])

  return (
    <div style={{ padding: 12 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, padding: '4px 0' }}>
            <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
          </div>
          <Typography.Title level={4} style={{ margin: 0 }}>个人中心</Typography.Title>
          {!addr && <Alert type="warning" showIcon message="尚未选择当前账户" />}
          {addr && <Typography.Text>当前地址：<Typography.Text code>{addr}</Typography.Text></Typography.Text>}
          <AccountsOverview />
          <Card size="small" title="网络与业务数据面板">
            <DashboardPage />
          </Card>
          <Space>
            <Button onClick={() => window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'transfer' } }))}>转账</Button>
            <Button type="primary" onClick={() => window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create-grave' } }))}>创建陵墓</Button>
            <Button onClick={()=> { window.location.hash = '#/grave/my' }}>我的墓地</Button>
            <Button onClick={()=> { window.location.hash = '#/treasury' }}>国库</Button>
            <Button onClick={()=> { window.location.hash = '#/covers' }}>封面库</Button>
            <Button onClick={()=> { window.location.hash = '#/covers/create' }}>创建封面图</Button>
            <Button onClick={()=> { window.location.hash = '#/sacrifice/create' }}>创建祭祀品</Button>
            <Button onClick={()=> { window.location.hash = '#/category/create' }}>创建类目</Button>
            <Button onClick={()=> { window.location.hash = '#/category/create-primary' }}>创建一级类目</Button>
            <Button onClick={()=> { window.location.hash = '#/category/list' }}>类目列表</Button>
            <Button onClick={()=> { window.location.hash = '#/scene/create' }}>创建场景</Button>
          </Space>
        </Space>
      </Card>
    </div>
  )
}

export default ProfilePage


