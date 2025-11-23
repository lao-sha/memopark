import React, { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import WalletWelcomePage from './WalletWelcomePage'
import CreateWalletPage from './CreateWalletPage'
import RestoreWalletPage from './RestoreWalletPage'
import HomePage from '../memorial/HomePage'
import MyWalletPage from '../profile/MyWalletPage'
import WalletManagePage from '../wallet/WalletManagePage'
import { sessionManager } from '../../lib/sessionManager'
import TransferPage from '../ledger/TransferPage'
// 旧墓位相关功能已删除
import TreasuryPage from '../treasury/TreasuryPage'
// 已移除：deceasedMedia 模块已整合到 deceased 模块
// import CreateArticleForm from '../deceasedMedia/CreateArticleForm'
// import ArticleListPage from '../deceasedMedia/ArticleListPage'
// import ArticleDetailPage from '../deceasedMedia/ArticleDetailPage'
import FriendsPage from '../deceased/FriendsPage'
// import CreateDeceasedForm from '../deceased/CreateDeceasedForm' // 已删除，使用 CreateDeceasedPage

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

    if (s) {
      console.log('已有会话，检查当前路由...');

      // 检查URL是否包含特殊参数，如果有则不强制跳转
      const hash = window.location.hash;
      const hasSpecialParams = hash.includes('?') && (
        hash.includes('groupId=') ||  // 群聊参数
        hash.includes('deceasedId=') || // 纪念馆参数
        hash.includes('transferTo=') || // 转账参数
        hash.includes('inviteCode=')    // 邀请码参数
      );

      if (hasSpecialParams) {
        console.log('检测到特殊URL参数，保持当前路由:', hash);
        // 不强制跳转到home，让路由系统自然处理
      } else {
        console.log('无特殊参数，跳转到 home');
        setActive('home');
      }
    } else {
      console.log('无会话，显示欢迎页面');
    }
    
    const onNav = (e: Event) => {
      const customEvent = e as CustomEvent
      const key = customEvent?.detail?.tab
      console.log('AuthEntryPage 收到 mp.nav 事件:', key);
      if (key) {
        console.log('切换到 tab:', key);
        setActive(key)
      } else {
        console.warn('mp.nav 事件没有 tab 参数');
      }
    }
    window.addEventListener('mp.nav', onNav as EventListener)
    console.log('AuthEntryPage 已注册 mp.nav 事件监听');
    
    return () => {
      window.removeEventListener('mp.nav', onNav as EventListener)
      console.log('AuthEntryPage 已移除 mp.nav 事件监听');
    }
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
          // 已移除：文章相关功能已整合到 deceased 模块
          // { key: 'article-new', label: '新建文章', children: <CreateArticleForm /> },
          // { key: 'article-list', label: '文章列表', children: <ArticleListPage /> },
          // { key: 'article-detail', label: '文章详情', children: <ArticleDetailPage /> },
          { key: 'friends', label: '亲友团', children: <FriendsPage /> },
          // { key: 'deceased-create', label: '创建逝者', children: <CreateDeceasedForm /> }, // 已删除，新版通过路由访问
          { key: 'treasury', label: '国库', children: <TreasuryPage /> },
          { key: 'home', label: '主页', children: <HomePage /> },
          // { key: 'home-old', label: '主页(旧)', children: <HomePage onLogout={() => setActive('welcome')} /> }, // 已删除
          { key: 'my-wallet', label: '我的钱包', children: <MyWalletPage /> },
          { key: 'wallet-manage', label: '钱包管理', children: <WalletManagePage /> }
        ]}
      />
    </div>
  )
}

export default AuthEntryPage


