import React from 'react'
import { Modal } from 'antd'
import { HomeOutlined, TeamOutlined, WalletOutlined, MessageOutlined, TrophyOutlined } from '@ant-design/icons'

  /**
   * 函数级详细中文注释：底部固定导航栏（移动端5按钮）
   * - 入口：首页、聊天、悬赏问答、大师解读、我的钱包
   * - 事件：优先触发 mp.nav 切换 `AuthEntryPage` 内部 Tab；同时回退到哈希路由
   * - 样式：固定于底部，最大宽度 414px 居中（与页面宽度一致）
   * - 隐藏：在进入群聊详情页面时自动隐藏
   */
const BottomNav: React.FC = () => {
  const [active, setActive] = React.useState<string>('home')
  const [current, setCurrent] = React.useState<string | null>(null)
  const [hidden, setHidden] = React.useState<boolean>(false)

  /**
   * 函数级中文注释：根据 hash 推断激活项
   * - 纪念馆首页（#/memorial 或 #/ 或 #/home）对应 home
   * - 聊天页面（#/chat）对应 chat
   * - 悬赏问答页面（#/bounty）对应 bounty
   * - 大师解读页面（#/market）对应 master
   */
  const computeActiveByHash = React.useCallback(() => {
    const h = window.location.hash || ''
    if (h === '#/' || h === '' || h === '#/home' || h === '#/memorial') return 'home'
    if (h.startsWith('#/chat') || h.startsWith('#/smart-chat')) return 'chat'
    if (h.startsWith('#/bounty')) return 'bounty'
    if (h.startsWith('#/market')) return 'master'
    if (h.startsWith('#/contacts')) return 'contacts'
    return 'home'
  }, [])

  React.useEffect(() => {
    setActive(computeActiveByHash())
    try { setCurrent(localStorage.getItem('mp.current') || null) } catch {}
    const onHash = () => setActive(computeActiveByHash())
    const onTab = (e: any) => { if (e?.detail?.tab) setActive(e.detail.tab) }
    const onAddr = () => { try { setCurrent(localStorage.getItem('mp.current') || null) } catch {} }
    // 监听导航栏隐藏/显示事件
    const onHideNav = (e: any) => { setHidden(e?.detail?.hidden ?? false) }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('mp.nav', onTab as any)
    window.addEventListener('storage', onAddr)
    window.addEventListener('mp.nav.visibility', onHideNav as any)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('mp.nav', onTab as any)
      window.removeEventListener('storage', onAddr)
      window.removeEventListener('mp.nav.visibility', onHideNav as any)
    }
  }, [computeActiveByHash])
  /**
   * 函数级中文注释：导航跳转（Tab 与 Hash 双通道）
   * - tabKey：AuthEntryPage 内部 Tabs 的 key
   * - hash：当处于 Hash 路由场景时的回退跳转
   * - 防止重复触发：如果当前已经在目标 tab，不重复触发
   */
  const go = (tabKey: string, hash?: string) => {
    // 防止重复触发：如果当前已经在目标 tab，直接返回
    if (active === tabKey) {
      console.log('已在目标页面，忽略导航:', tabKey)
      return
    }

    // 函数级中文注释：未登录拦截配置
    // - 创建纪念馆、我的钱包、我的纪念需要地址
    // - 首页（home）无需登录，所有人可查看纪念馆
    // - 智能聊天无需登录
    const needAddr = tabKey === 'my-wallet' || tabKey === 'my-memorial'
    const addr = current || (typeof window !== 'undefined' ? localStorage.getItem('mp.current') : null)
    if (needAddr && !addr) {
      const inst = Modal.confirm({
        title: '需要钱包',
        content: (
          <div>
            <div style={{ marginBottom: 8 }}>请先登录或创建本地钱包后再继续。</div>
            <div>
              <a 
                style={{ color: '#1890ff', cursor: 'pointer' }}
                onClick={() => { 
                  console.log('点击"去登录"，触发 mp.nav 事件: restore');
                  try { 
                    window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'restore' } })); 
                    console.log('mp.nav 事件已触发: restore');
                  } catch (e) {
                    console.error('触发 mp.nav 失败:', e);
                  }
                  inst.destroy(); 
                }}>
                去登录
              </a>
            </div>
          </div>
        ),
        okText: '去创建钱包',
        cancelText: '继续浏览',
        onOk: () => { 
          console.log('点击"去创建钱包"，触发 mp.nav 事件: create');
          try { 
            window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } })); 
            console.log('mp.nav 事件已触发: create');
          } catch (e) {
            console.error('触发 mp.nav 失败:', e);
          }
        },
        onCancel: () => {
          console.log('用户点击"继续浏览"');
        }
      })
      return
    }

    // 触发导航事件
    try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: tabKey } })) } catch {}
    
    // 如果指定了 hash，则设置 hash；否则清空 hash（避免冲突）
    if (hash) { 
      try { window.location.hash = hash } catch {} 
    } else {
      // 清空 hash，避免 hash 路由与 Tab 导航冲突
      try { window.location.hash = '' } catch {}
    }
  }

  // 如果导航栏被隐藏，则不渲染
  if (hidden) {
    return null
  }

  return (
    <>
      {/* 底部导航栏 */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
        <div style={{
          maxWidth: 414,
          margin: '0 auto',
          background: '#fff',
          borderTop: '1px solid #E5E5E5',
          boxShadow: '0 -2px 12px rgba(178, 149, 93, 0.08)',
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
            gap: 0,
            alignItems: 'center'
          }}>
            <button onClick={() => go('home', '#/')} style={{ ...btnStyle, ...(active==='home'?btnActiveHomeStyle:undefined) }}>
              <HomeOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>首页</span>
            </button>

            <button onClick={() => go('chat', '#/smart-chat')} style={{ ...btnStyle, ...(active==='chat'?btnActiveChatStyle:undefined) }}>
              <MessageOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>聊天</span>
            </button>

            <button onClick={() => go('bounty', '#/bounty')} style={{ ...btnStyle, ...(active==='bounty'?btnActiveDivinationStyle:undefined) }}>
              <TrophyOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>悬赏问答</span>
            </button>

            <button onClick={() => go('master', '#/market')} style={{ ...btnStyle, ...(active==='master'?btnActiveMasterStyle:undefined) }}>
              <TeamOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>大师解读</span>
            </button>

            <button onClick={() => go('my-wallet', '#/profile')} style={{ ...btnStyle, ...(active==='my-wallet'?btnActiveWalletStyle:undefined) }}>
              <WalletOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>我的钱包</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * 函数级中文注释：按钮样式（无边框、竖向布局）
 * 移动端优化：触控目标足够大，颜色统一主题色
 */
const btnStyle: React.CSSProperties = {
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: '100%',
  padding: '8px 0',
  color: '#708090',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  minHeight: 56
}

/**
 * 函数级中文注释：按钮文字样式
 */
const txtStyle: React.CSSProperties = { 
  fontSize: 12,
  fontWeight: 500
}

/**
 * 函数级中文注释：激活态样式（统一金棕色）
 * 参考问真排盘风格：金棕色 #B2955D
 */
const btnActiveStyle: React.CSSProperties = {
  color: '#B2955D',
  fontWeight: 600
}

/**
 * 函数级中文注释：首页激活态样式（金棕色）
 */
const btnActiveHomeStyle: React.CSSProperties = {
  color: '#B2955D',
  fontWeight: 600
}

/**
 * 函数级中文注释：聊天激活态样式（金棕色）
 */
const btnActiveChatStyle: React.CSSProperties = {
  color: '#B2955D',
  fontWeight: 600
}

/**
 * 函数级中文注释：太极玄鉴激活态样式（金棕色）
 */
const btnActiveDivinationStyle: React.CSSProperties = {
  color: '#B2955D',
  fontWeight: 600
}

/**
 * 函数级中文注释：大师解读激活态样式（金棕色）
 */
const btnActiveMasterStyle: React.CSSProperties = {
  color: '#B2955D',
  fontWeight: 600
}

/**
 * 函数级中文注释：钱包激活态样式（金棕色）
 */
const btnActiveWalletStyle: React.CSSProperties = {
  color: '#B2955D',
  fontWeight: 600
}

export default BottomNav


