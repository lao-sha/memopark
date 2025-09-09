import React, { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import LoginPage from './LoginPage'
import CreateWalletPage from './CreateWalletPage'
import HomePage from '../home/HomePage'
import { sessionManager } from '../../lib/sessionManager'
import TransferPage from '../ledger/TransferPage'

const AuthEntryPage: React.FC = () => {
  const [active, setActive] = useState<string>('login')

  useEffect(() => {
    const s = sessionManager.init()
    if (s) setActive('home')
    const onNav = (e: any) => {
      const key = e?.detail?.tab
      if (key) setActive(key)
    }
    window.addEventListener('mp.nav', onNav)
    return () => window.removeEventListener('mp.nav', onNav)
  }, [])

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <Tabs
        activeKey={active}
        onChange={setActive}
        items={[
          { key: 'login', label: '登录', children: <LoginPage onSuccess={() => setActive('home')} onNavigateCreate={() => setActive('create')} /> },
          { key: 'create', label: '创建钱包', children: <CreateWalletPage onCreated={() => setActive('login')} /> },
          { key: 'transfer', label: '转账', children: <TransferPage /> },
          { key: 'home', label: '主页', children: <HomePage onLogout={() => setActive('login')} /> }
        ]}
      />
    </div>
  )
}

export default AuthEntryPage


