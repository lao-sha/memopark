import React, { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import LoginPage from './LoginPage'
import CreateWalletPage from './CreateWalletPage'
import HomePage from '../home/HomePage'
import { sessionManager } from '../../lib/sessionManager'
import TransferPage from '../ledger/TransferPage'
import CreateGraveForm from '../grave/CreateGraveForm'
import GraveListPage from '../grave/GraveListPage'
import GovernanceHomePage from '../governance/GovernanceHomePage'
import ReferendaListPage from '../governance/ReferendaListPage'
import ReferendumDetailPage from '../governance/ReferendumDetailPage'
import NewProposalPage from '../governance/NewProposalPage'
import MyGovernancePage from '../governance/MyGovernancePage'
import TreasuryPage from '../treasury/TreasuryPage'
import CreateArticleForm from '../deceasedMedia/CreateArticleForm'

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
          { key: 'create-grave', label: '创建墓地', children: <CreateGraveForm /> },
          { key: 'grave-list', label: '墓地列表', children: <GraveListPage /> },
          { key: 'gov-home', label: '治理', children: <GovernanceHomePage /> },
          { key: 'gov-list', label: '公投列表', children: <ReferendaListPage /> },
          { key: 'gov-detail', label: '公投详情', children: <ReferendumDetailPage /> },
          { key: 'gov-new', label: '发起提案', children: <NewProposalPage /> },
          { key: 'gov-me', label: '我的治理', children: <MyGovernancePage /> },
          { key: 'article-new', label: '新建文章', children: <CreateArticleForm /> },
          { key: 'treasury', label: '国库', children: <TreasuryPage /> },
          { key: 'home', label: '主页', children: <HomePage onLogout={() => setActive('login')} /> }
        ]}
      />
    </div>
  )
}

export default AuthEntryPage


