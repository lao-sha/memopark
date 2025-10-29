import React, { useEffect, useState } from 'react'
import { Card, Typography, Alert, Button, Space, List, Avatar, Carousel, Row, Col } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { UserOutlined } from '@ant-design/icons'
import { sessionManager } from '../../lib/sessionManager'
import AccountsOverview from '../../components/wallet/AccountsOverview'
import CurrentAccountBar from '../../components/wallet/CurrentAccountBar'
import RecentTxList from '../../components/wallet/RecentTxList'
import type { SessionData } from '../../lib/sessionManager'
import { useWallet } from '../../providers/WalletProvider'
import HotGravesList from '../../components/discovery/HotGravesList'
import RecentOfferingsTimeline from '../../components/discovery/RecentOfferingsTimeline'
import QuickActions from '../../components/home/QuickActions'

const HomePage: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const [session, setSession] = useState<SessionData | null>(null)
  const { isConnected, accounts, selectedAccount } = useWallet()
  // 轮播：从 memoGrave.carousel() 读取并前端过滤时间窗
  const [slides, setSlides] = useState<Array<{ img: string; title: string; link?: string; target?: { d: number; id: number } }>>([])
  const [gw] = useState<string>(()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })

  useEffect(() => {
    const loadCarousel = async () => {
      try {
        const api = await getApi()
        const qroot: any = (api.query as any)
        let q: any = qroot.memo_grave || qroot.memoGrave || qroot.grave
        if (!q) { const fk = Object.keys(qroot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k)); if (fk) q = qroot[fk] }
        if (!q?.carousel) return
        const v = await q.carousel()
        const now = await (api.query.system?.number?.() || { toNumber: ()=> 0 })
        const nowBlock = Number((now as any).toNumber ? (now as any).toNumber() : 0)
        const decoded: Array<{ img: string; title: string; link?: string; target?: { d: number; id: number }, start?: number|null, end?: number|null }> = []
        try {
          const vec: any[] = (v.toJSON?.() as any[]) || []
          for (const item of vec) {
            try {
              const img = new TextDecoder().decode(new Uint8Array(item.img_cid || item.imgCid))
              const title = new TextDecoder().decode(new Uint8Array(item.title))
              let link: string | undefined
              if (item.link) link = new TextDecoder().decode(new Uint8Array(item.link))
              const target = item.target ? { d: Number(item.target[0] || item.target.d || 0), id: Number(item.target[1] || item.target.id || 0) } : undefined
              const start = item.start_block != null ? Number(item.start_block) : (item.startBlock != null ? Number(item.startBlock) : null)
              const end = item.end_block != null ? Number(item.end_block) : (item.endBlock != null ? Number(item.endBlock) : null)
              if ((start == null || nowBlock >= start) && (end == null || nowBlock <= end)) decoded.push({ img, title, link, target, start, end })
            } catch {}
          }
        } catch {}
        setSlides(decoded)
      } catch {}
    }
    loadCarousel()
  }, [])

  useEffect(() => {
    const s = sessionManager.getCurrentSession() || sessionManager.init()
    setSession(s)
  }, [])

  /**
   * 函数级详细中文注释：跳转到“创建墓地”哈希路由入口
   * - 与 Tab 导航共存：Tab 方式走 `AuthEntryPage` 内部标签切换；哈希路由方式直达 `#/grave/create`
   * - 便于从外部分享或深链至创建页
   */
  const goCreateGraveRoute = () => {
    try { window.location.hash = '#/grave/create' } catch { /* 忽略 */ }
  }

  const handleLogout = () => {
    sessionManager.clearSession()
    setSession(null)
    onLogout?.()
  }

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: '0 auto' }}>
      <Card>
        {/* 首页轮播图 */}
        {slides.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Carousel autoplay dots style={{ borderRadius: 12, overflow: 'hidden' }}>
              {slides.map((s, i)=> (
                <div key={i} onClick={()=> {
                  try {
                    if (s.target) {
                      if (s.target.d === 1) { window.location.hash = `#/grave/detail?id=${s.target.id}`; return }
                      if (s.target.d === 2) { window.location.hash = `#/deceased/detail?id=${s.target.id}`; return }
                      if (s.target.d === 3) { window.location.hash = `#/browse/category?domain=1&target=${s.target.id}`; return }
                    }
                    if (s.link) { window.location.href = s.link }
                  } catch {}
                }}>
                  <div style={{ position:'relative', width:'100%', height: 180, background:'#000' }}>
                    <img src={`${gw}/ipfs/${String(s.img).replace(/^ipfs:\/\//i,'')}`} alt={s.title} style={{ width:'100%', height:'100%', objectFit:'cover', opacity: 0.92 }} />
                    <div style={{ position:'absolute', left: 8, bottom: 8, color:'#fff', textShadow:'0 1px 2px rgba(0,0,0,0.6)' }}>{s.title}</div>
                  </div>
                </div>
              ))}
            </Carousel>
          </div>
        )}
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

            <CurrentAccountBar />
            
            {/* 快捷操作 */}
            <QuickActions />
            
            {/* 发现和推荐 */}
            <HotGravesList />
            <RecentOfferingsTimeline />
            
            <AccountsOverview />
            
            <RecentTxList />

            <Space>
              <Button type="primary" onClick={()=> window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'transfer' } }))}>转账</Button>
              <Button onClick={()=> window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create-grave' } }))}>创建墓地</Button>
              <Button onClick={goCreateGraveRoute}>创建墓地（路由）</Button>
              <Button onClick={()=> window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-home' } }))}>治理</Button>
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

