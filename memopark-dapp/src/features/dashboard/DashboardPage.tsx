import React from 'react'
import { Card, Space, Typography, Row, Col, Alert, Button, Tag } from 'antd'
import { getApi } from '../../lib/polkadot'
import { query as gqlQuery, GQL } from '../../lib/graphql'

/**
 * 函数级详细中文注释：区块链数据面板（骨架版，实时三卡片）
 * - 卡片1：网络概况（链名、Best/Finalized 高度、Peers）
 * - 卡片2：性能（近窗口出块间隔估算、每块 Extrinsics 估算）
 * - 卡片3：代币与费用（Symbol/Decimals、存在性余额ED、CreateFee）
 * - 刷新：默认每 5 秒刷新一次；提供手动刷新按钮
 * - 说明：历史趋势/排行榜将通过 Subsquid 接入，后续补充
 */
const DashboardPage: React.FC = () => {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string>('')

  const [chain, setChain] = React.useState<string>('')
  const [best, setBest] = React.useState<number>(0)
  const [finalized, setFinalized] = React.useState<number>(0)
  const [peers, setPeers] = React.useState<number>(0)

  const [avgBlockMs, setAvgBlockMs] = React.useState<number>(0)
  const [avgExtrinsics, setAvgExtrinsics] = React.useState<number>(0)

  const [symbol, setSymbol] = React.useState<string>('')
  const [decimals, setDecimals] = React.useState<number>(12)
  const [existentialDeposit, setExistentialDeposit] = React.useState<string>('0')
  const [createFee, setCreateFee] = React.useState<string>('0')

  // 简单滑窗：记录最近 N 次出块的时间与 extrinsics 数量
  const windowRef = React.useRef<Array<{ time: number; ex: number }>>([])

  // Subsquid 聚合：近30天新增墓地趋势、近7天园区Top5、最近事件时间线、近7天墓地Top5（按最近动作数）
  const [squidError, setSquidError] = React.useState<string>('')
  const [dailyNewGraves, setDailyNewGraves] = React.useState<Array<{ day: string; count: number }>>([])
  const [topParks, setTopParks] = React.useState<Array<{ parkId: number; count: number }>>([])
  const [recentActions, setRecentActions] = React.useState<Array<{ kind: string; graveId?: number; block: number }>>([])
  const [topGraves, setTopGraves] = React.useState<Array<{ id: number; actions: number }>>([])

  /**
   * 函数级中文注释：拉取基础链信息与实时指标
   */
  const fetchOnce = React.useCallback(async () => {
    try {
      setLoading(true); setError('')
      const api = await getApi()
      // 链名/代币信息
      const chainName = await api.rpc.system.chain()
      setChain(chainName.toString())
      const sym = (api.registry.chainTokens?.[0] as string) || ''
      const dec = api.registry.chainDecimals?.[0] ?? 12
      setSymbol(sym); setDecimals(dec)
      // 高度/Finalized/Peers
      const [hdr, finHdr] = await Promise.all([
        api.rpc.chain.getHeader(),
        api.rpc.chain.getFinalizedHead().then(h => api.rpc.chain.getHeader(h))
      ])
      setBest(hdr.number.toNumber())
      setFinalized(finHdr.number.toNumber())
      // peers() 在多数远程节点默认被禁用（Unsafe RPC）。改用安全的 system.health().peers。
      try {
        const health: any = await (api.rpc as any)?.system?.health?.()
        const p = (health && (health.peers?.toNumber?.() ?? Number(health.peers))) || 0
        setPeers(Number.isFinite(p) ? p : 0)
      } catch { setPeers(0) }
      // 性能估算：读取最近块的 extrinsics 数量，并计算时间间隔
      const now = Date.now()
      const blockHash = await api.rpc.chain.getBlockHash(hdr.number.toNumber())
      const block = await api.rpc.chain.getBlock(blockHash)
      const exCount = block.block.extrinsics.length
      const win = windowRef.current
      win.push({ time: now, ex: exCount })
      if (win.length > 10) win.shift()
      if (win.length >= 2) {
        const dt = (win[win.length - 1].time - win[0].time) / (win.length - 1)
        const avgEx = win.reduce((s, i) => s + i.ex, 0) / win.length
        setAvgBlockMs(Math.max(0, Math.round(dt)))
        setAvgExtrinsics(Math.max(0, Math.round(avgEx)))
      }
      // 参数：ED 与 CreateFee
      try {
        const ed: any = (api.consts as any)?.balances?.existentialDeposit
        setExistentialDeposit(ed ? ed.toString() : '0')
      } catch { setExistentialDeposit('0') }
      try {
        const cf: any = (api.consts as any)?.memoGrave?.createFee
        setCreateFee(cf ? cf.toString() : '0')
      } catch { setCreateFee('0') }
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => {
    let timer: any
    fetchOnce()
    timer = setInterval(fetchOnce, 5000)
    return () => { if (timer) clearInterval(timer) }
  }, [fetchOnce])

  /**
   * 函数级中文注释：拉取 Subsquid 数据（存在端点时）
   * - 近30天新墓地：按 Grave.createdAt 聚合
   * - 近7天园区Top：按 parkId 聚合计数
   * - 最近事件时间线：GraveAction 最近 20 条
   * - 近7天墓地 Top：统计最近 100 条动作中每个 grave 的次数
   */
  const fetchSquid = React.useCallback(async () => {
    try {
      setSquidError('')
      if (!GQL.endpoint || GQL.endpoint.includes('example.com')) return
      const nowSec = Math.floor(Date.now() / 1000)
      const since30 = nowSec - 30 * 24 * 3600
      const since7 = nowSec - 7 * 24 * 3600

      // 近30天 Grave.createdAt
      const q1 = `query Graves30($since:Int!,$limit:Int!){
        graves(where:{createdAt_gte:$since}, orderBy: createdAt_ASC, limit:$limit){ id createdAt parkId }
      }`
      const d1 = await gqlQuery<{ graves: Array<{ id: string; createdAt: number; parkId: string | null }> }>(q1, { since: since30, limit: 1000 })
      const dayMap: Record<string, number> = {}
      const parkMap7: Record<string, number> = {}
      d1.graves.forEach(g => {
        const day = new Date(g.createdAt * 1000).toISOString().slice(0, 10)
        dayMap[day] = (dayMap[day] || 0) + 1
        if (g.createdAt >= since7 && g.parkId != null) parkMap7[g.parkId] = (parkMap7[g.parkId] || 0) + 1
      })
      const days: string[] = Array.from({ length: 30 }).map((_, i) => {
        const d = new Date(Date.now() - (29 - i) * 24 * 3600 * 1000)
        return d.toISOString().slice(0, 10)
      })
      setDailyNewGraves(days.map(day => ({ day, count: dayMap[day] || 0 })))
      const topP = Object.entries(parkMap7).map(([k, v]) => ({ parkId: Number(k), count: v as number })).sort((a, b) => b.count - a.count).slice(0, 5)
      setTopParks(topP)

      // 最近事件：GraveAction 最近20；近7天Top graves：在最近100条中统计
      const q2 = `query GraveActs($limitRecent:Int!,$limitTop:Int!){
        graveActions(orderBy: block_DESC, limit:$limitRecent){ kind block grave { id } }
        top: graveActions(orderBy: block_DESC, limit:$limitTop){ kind block grave { id } }
      }`
      const d2 = await gqlQuery<{ graveActions: Array<{ kind: string; block: number; grave: { id: string } | null }>; top: Array<{ kind: string; block: number; grave: { id: string } | null }> }>(q2, { limitRecent: 20, limitTop: 100 })
      setRecentActions(d2.graveActions.map(a => ({ kind: a.kind, block: a.block, graveId: a.grave ? Number(a.grave.id) : undefined })))
      const countByGrave: Record<string, number> = {}
      d2.top.forEach(a => { const gid = a.grave?.id; if (gid) countByGrave[gid] = (countByGrave[gid] || 0) + 1 })
      setTopGraves(Object.entries(countByGrave).map(([k, v]) => ({ id: Number(k), actions: v as number })).sort((a, b) => b.actions - a.actions).slice(0, 5))
    } catch (e: any) {
      setSquidError(e?.message || 'Subsquid 数据源不可用')
    }
  }, [])

  React.useEffect(() => { fetchSquid() }, [fetchSquid])

  /**
   * 函数级中文注释：格式化最小单位金额
   */
  const fmt = React.useCallback((raw: string) => {
    try {
      const n = BigInt(raw || '0')
      const base = BigInt(10) ** BigInt(decimals || 12)
      const whole = n / base
      const frac = n % base
      if (frac === 0n) return `${whole.toString()} ${symbol}`
      const s = (base + frac).toString().slice(1).replace(/0+$/, '')
      return `${whole.toString()}.${s} ${symbol}`
    } catch { return `0 ${symbol}` }
  }, [decimals, symbol])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>数据面板</Typography.Title>
        <Space>
          <Button size="small" onClick={fetchOnce} loading={loading}>刷新</Button>
        </Space>
      </div>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 8 }} />}

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {/* 网络概况 */}
        <Card size="small" title="网络概况">
          <Row gutter={8}>
            <Col span={12}><Typography.Text type="secondary">链名</Typography.Text><div>{chain || '-'}</div></Col>
            <Col span={12}><Typography.Text type="secondary">Peers</Typography.Text><div>{peers}</div></Col>
            <Col span={12}><Typography.Text type="secondary">Best</Typography.Text><div>#{best}</div></Col>
            <Col span={12}><Typography.Text type="secondary">Finalized</Typography.Text><div>#{finalized}</div></Col>
          </Row>
        </Card>

        {/* 性能估算 */}
        <Card size="small" title="性能（估算）">
          <Row gutter={8}>
            <Col span={12}><Typography.Text type="secondary">平均出块间隔</Typography.Text><div>{avgBlockMs ? `${avgBlockMs} ms` : '-'}</div></Col>
            <Col span={12}><Typography.Text type="secondary">每块 Extrinsics（均值）</Typography.Text><div>{avgExtrinsics || '-'}</div></Col>
          </Row>
        </Card>

        {/* 代币与费用 */}
        <Card size="small" title="代币与费用">
          <Row gutter={8}>
            <Col span={12}><Typography.Text type="secondary">Symbol / Decimals</Typography.Text><div>{symbol || '-'} / {decimals}</div></Col>
            <Col span={12}><Typography.Text type="secondary">存在性余额(ED)</Typography.Text><div>{fmt(existentialDeposit)}</div></Col>
            <Col span={24}><Typography.Text type="secondary">创建墓地 CreateFee</Typography.Text><div>{fmt(createFee)}</div></Col>
          </Row>
        </Card>

        {/* 全局链上直连模式，暂时隐藏 Subsquid 相关功能 */}
        {false && (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {squidError && <Alert type="error" showIcon message={squidError} />}

            <Card size="small" title="近30天新增墓地">
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
                {dailyNewGraves.map(d => (
                  <div key={d.day} title={`${d.day}: ${d.count}`} style={{ width: 6, background: '#1677ff', height: Math.min(70, d.count * 6) || 2, opacity: d.count ? 1 : 0.25 }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginTop: 4 }}>
                <span>{dailyNewGraves[0]?.day || ''}</span>
                <span>{dailyNewGraves[dailyNewGraves.length - 1]?.day || ''}</span>
              </div>
            </Card>

            <Row gutter={8}>
              <Col span={12}>
                <Card size="small" title="近7天园区 Top5（新增墓地）">
                  {topParks.length === 0 ? <Typography.Text type="secondary">暂无数据</Typography.Text> : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {topParks.map((p, idx) => (
                        <div key={p.parkId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>#{idx + 1} Park {p.parkId}</span>
                          <Tag color="blue">{p.count}</Tag>
                        </div>
                      ))}
                    </Space>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="近7天墓地 Top5（按最近动作数）">
                  {topGraves.length === 0 ? <Typography.Text type="secondary">暂无数据</Typography.Text> : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {topGraves.map((g, idx) => (
                        <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>#{idx + 1} Grave {g.id}</span>
                          <Tag color="geekblue">{g.actions}</Tag>
                        </div>
                      ))}
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>

            <Card size="small" title="最近事件（GraveActions）">
              {recentActions.length === 0 ? <Typography.Text type="secondary">暂无数据</Typography.Text> : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {recentActions.map((a, i) => (
                    <div key={`${a.block}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{a.kind}{typeof a.graveId === 'number' ? ` · #${a.graveId}` : ''}</span>
                      <span>#{a.block}</span>
                    </div>
                  ))}
                </Space>
              )}
            </Card>
          </Space>
        )}
      </Space>
    </div>
  )
}

export default DashboardPage