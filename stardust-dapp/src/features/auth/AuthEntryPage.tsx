import React, { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import WalletWelcomePage from './WalletWelcomePage'
import CreateWalletPage from './CreateWalletPage'
import RestoreWalletPage from './RestoreWalletPage'
import HomePage from '../home/HomePage'
import MyWalletPage from '../profile/MyWalletPage'
import WalletManagePage from '../wallet/WalletManagePage'
import { sessionManager } from '../../lib/sessionManager'
import TransferPage from '../ledger/TransferPage'
import CreateGraveForm from '../grave/CreateGraveForm'
import GraveListPage from '../grave/GraveListPage'
import TreasuryPage from '../treasury/TreasuryPage'
// 已移除：deceasedMedia 模块已整合到 deceased 模块
// import CreateArticleForm from '../deceasedMedia/CreateArticleForm'
// import ArticleListPage from '../deceasedMedia/ArticleListPage'
// import ArticleDetailPage from '../deceasedMedia/ArticleDetailPage'
import FriendsPage from '../deceased/FriendsPage'
import CreateDeceasedForm from '../deceased/CreateDeceasedForm'

/**
 * 函数级详细中文注释：认证入口页面组件
 * - 管理钱包登录、创建、恢复等流程的页面切换
 * - 首次访问显示欢迎页面（welcome），用户可选择创建或恢复钱包
 * - 已有会话则自动跳转到主页（home）
 * - 支持通过 mp.nav 事件在各页面间切换
 */
const AuthEntryPage: React.FC = () => {
  const [active, setActive] = useState<string>('welcome')

  useEffect(() => {
    const s = sessionManager.init()
    if (s) setActive('home')
    const onNav = (e: Event) => {
      const customEvent = e as CustomEvent
      const key = customEvent?.detail?.tab
      if (key) {
        console.log('导航到:', key)
        setActive(key)
      }
    }
    window.addEventListener('mp.nav', onNav as EventListener)
    return () => window.removeEventListener('mp.nav', onNav as EventListener)
  }, [])

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <Tabs
        activeKey={active}
        onChange={setActive}
        destroyOnHidden={true}
        items={[
          { 
            key: 'welcome', 
            label: '欢迎', 
            children: <WalletWelcomePage 
              onCreateWallet={() => setActive('create')} 
              onRestoreWallet={() => setActive('restore')} 
            /> 
          },
          { key: 'restore', label: '恢复钱包', children: <RestoreWalletPage onSuccess={() => setActive('home')} onBack={() => setActive('welcome')} /> },
          { key: 'create', label: '创建钱包', children: <CreateWalletPage onCreated={() => setActive('wallet-manage')} /> },
          { key: 'transfer', label: '转账', children: <TransferPage /> },
          { key: 'create-grave', label: '创建墓地', children: <CreateGraveForm /> },
          { key: 'grave-list', label: '墓地列表', children: <GraveListPage /> },
          // 已移除：文章相关功能已整合到 deceased 模块
          // { key: 'article-new', label: '新建文章', children: <CreateArticleForm /> },
          // { key: 'article-list', label: '文章列表', children: <ArticleListPage /> },
          // { key: 'article-detail', label: '文章详情', children: <ArticleDetailPage /> },
          { key: 'friends', label: '亲友团', children: <FriendsPage /> },
          { key: 'deceased-create', label: '创建逝者', children: <CreateDeceasedForm /> },
          { key: 'treasury', label: '国库', children: <TreasuryPage /> },
          { key: 'home', label: '主页', children: <HomePage onLogout={() => setActive('welcome')} /> },
          { key: 'my-wallet', label: '我的钱包', children: <MyWalletPage /> },
          { key: 'wallet-manage', label: '钱包管理', children: <WalletManagePage /> }
        ]}
      />
    </div>
  )
}

export default AuthEntryPage


