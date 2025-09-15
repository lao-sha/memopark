import React from 'react'
import { Modal } from 'antd'
import { HomeOutlined, CrownOutlined, UserOutlined, PlusCircleOutlined, UnorderedListOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：底部固定导航栏（移动端5按钮）
 * - 入口：主页、创建陵墓、国库、我的治理、个人中心
 * - 事件：优先触发 mp.nav 切换 `AuthEntryPage` 内部 Tab；同时回退到哈希路由
 * - 样式：固定于底部，最大宽度 640px 居中
 */
const BottomNav: React.FC = () => {
  const [active, setActive] = React.useState<string>('home')
  const [current, setCurrent] = React.useState<string | null>(null)

  /**
   * 函数级中文注释：根据 hash 推断激活项
   */
  const computeActiveByHash = React.useCallback(() => {
    const h = window.location.hash || ''
    if (h === '#/' || h === '' ) return 'home'
    if (h.startsWith('#/grave/create')) return 'create-grave'
    if (h.startsWith('#/grave/list')) return 'grave-list'
    if (h.startsWith('#/gov/me')) return 'gov-me'
    if (h.startsWith('#/profile')) return 'profile'
    return 'home'
  }, [])

  React.useEffect(() => {
    setActive(computeActiveByHash())
    try { setCurrent(localStorage.getItem('mp.current') || null) } catch {}
    const onHash = () => setActive(computeActiveByHash())
    const onTab = (e: any) => { if (e?.detail?.tab) setActive(e.detail.tab) }
    const onAddr = () => { try { setCurrent(localStorage.getItem('mp.current') || null) } catch {} }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('mp.nav', onTab as any)
    window.addEventListener('storage', onAddr)
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('mp.nav', onTab as any); window.removeEventListener('storage', onAddr) }
  }, [computeActiveByHash])
  /**
   * 函数级中文注释：导航跳转（Tab 与 Hash 双通道）
   * - tabKey：AuthEntryPage 内部 Tabs 的 key
   * - hash：当处于 Hash 路由场景时的回退跳转
   */
  const go = (tabKey: string, hash?: string) => {
    // 未登录拦截：创建陵墓/我的治理/个人中心需要地址
    const needAddr = tabKey === 'create-grave' || tabKey === 'gov-me' || tabKey === 'profile'
    const addr = current || (typeof window !== 'undefined' ? localStorage.getItem('mp.current') : null)
    if (needAddr && !addr) {
      const inst = Modal.confirm({
        title: '需要钱包',
        content: (
          <div>
            <div style={{ marginBottom: 8 }}>请先登录或创建本地钱包后再继续。</div>
            <div>
              <a onClick={() => { try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'login' } })) } catch {}; inst.destroy(); }}>去登录</a>
            </div>
          </div>
        ),
        okText: '去创建钱包',
        cancelText: '继续浏览',
        onOk: () => { try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } })) } catch {} },
        onCancel: () => {}
      })
      return
    }
    try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: tabKey } })) } catch {}
    if (hash) { try { window.location.hash = hash } catch {} }
  }

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderTop: '1px solid #eee', padding: '6px 8px calc(6px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => go('home', '#/')} style={{ ...btnStyle, ...(active==='home'?btnActiveStyle:undefined) }}>
            <HomeOutlined />
            <span style={txtStyle}>主页</span>
          </button>
          <button onClick={() => go('create-grave', '#/grave/create')} style={{ ...btnStyle, ...(active==='create-grave'?btnActiveStyle:undefined) }}>
            <PlusCircleOutlined />
            <span style={txtStyle}>创建陵墓</span>
          </button>
          <button onClick={() => go('grave-list', '#/grave/list')} style={{ ...btnStyle, ...(active==='grave-list'?btnActiveStyle:undefined) }}>
            <UnorderedListOutlined />
            <span style={txtStyle}>墓地列表</span>
          </button>
          <button onClick={() => go('gov-me', '#/gov/me')} style={{ ...btnStyle, ...(active==='gov-me'?btnActiveStyle:undefined) }}>
            <CrownOutlined />
            <span style={txtStyle}>我的治理</span>
          </button>
          <button onClick={() => go('profile', '#/profile')} style={{ ...btnStyle, ...(active==='profile'?btnActiveStyle:undefined) }}>
            <UserOutlined />
            <span style={txtStyle}>个人中心</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 函数级中文注释：按钮样式（无边框、竖向布局）
 */
const btnStyle: React.CSSProperties = {
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  width: '20%',
  padding: '6px 0',
  color: '#333',
}

/**
 * 函数级中文注释：按钮文字样式
 */
const txtStyle: React.CSSProperties = { fontSize: 11 }

/**
 * 函数级中文注释：激活态样式（主色）
 */
const btnActiveStyle: React.CSSProperties = { color: '#1677ff' }

export default BottomNav


