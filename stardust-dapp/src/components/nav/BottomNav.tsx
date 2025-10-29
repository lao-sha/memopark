import React from 'react'
import { Modal } from 'antd'
import { HomeOutlined, TeamOutlined, WalletOutlined, PlusCircleOutlined, UnorderedListOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：底部固定导航栏（移动端5按钮）
 * - 入口：主页、我的墓地、创建墓地（FAB）、逝者列表、我的钱包
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
    if (h.startsWith('#/grave/my')) return 'grave-my'
    if (h.startsWith('#/deceased/list')) return 'deceased-list'
    if (h.startsWith('#/profile')) return 'my-wallet'
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
   * - 防止重复触发：如果当前已经在目标 tab，不重复触发
   */
  const go = (tabKey: string, hash?: string) => {
    // 防止重复触发：如果当前已经在目标 tab，直接返回
    if (active === tabKey) {
      console.log('已在目标页面，忽略导航:', tabKey)
      return
    }

    // 未登录拦截：创建陵墓/我的墓地/我的钱包需要地址
    const needAddr = tabKey === 'create-grave' || tabKey === 'grave-my' || tabKey === 'my-wallet'
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

  return (
    <>
      {/* 底部导航栏 */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
        <div style={{ 
          maxWidth: 640, 
          margin: '0 auto', 
          background: 'var(--color-bg-elevated)', 
          borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))'
        }}>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 64px 1fr 1fr',
            gap: 0,
            alignItems: 'center'
          }}>
            <button onClick={() => go('home', '#/')} style={{ ...btnStyle, ...(active==='home'?btnActiveStyle:undefined) }}>
              <HomeOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>首页</span>
            </button>
            
            <button onClick={() => go('grave-my', '#/grave/my')} style={{ ...btnStyle, ...(active==='grave-my'?btnActiveStyle:undefined) }}>
              <UnorderedListOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>墓地</span>
            </button>
            
            {/* FAB中心大按钮（占位，不计入grid流） */}
            <div />
            
            <button onClick={() => go('deceased-list', '#/deceased/list')} style={{ ...btnStyle, ...(active==='deceased-list'?btnActiveStyle:undefined) }}>
              <TeamOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>逝者</span>
            </button>
            
            <button onClick={() => go('my-wallet')} style={{ ...btnStyle, ...(active==='my-wallet'?btnActiveStyle:undefined) }}>
              <WalletOutlined style={{ fontSize: 22 }} />
              <span style={txtStyle}>我的钱包</span>
            </button>
          </div>
        </div>
      </div>

      {/* FAB浮动创建按钮 */}
      <div style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(28px + env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        zIndex: 1001
      }}>
        <button
          onClick={() => {
            // 显示创建菜单
            const needAddr = !current
            if (needAddr) {
              Modal.confirm({
                title: '需要钱包',
                content: '请先登录或创建本地钱包后再创建墓地',
                okText: '去创建钱包',
                cancelText: '取消',
                onOk: () => { 
                  try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } })) } catch {} 
                }
              })
              return
            }
            // 直接跳转创建墓地
            go('create-grave', '#/grave/create')
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
            color: 'var(--color-text-inverse)',
            fontSize: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-lg)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(184, 134, 11, 0.25)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
          }}
        >
          <PlusCircleOutlined />
        </button>
      </div>
    </>
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


