import React from 'react'
import { Card, Space, Typography, Row, Col, Alert, Button, Tag } from 'antd'
import { getApi } from '../../lib/polkadot'

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
      // 旧墓位功能已删除，createFee 不再可用
      setCreateFee('0')
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
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
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
      </Space>
    </div>
  )
}

export default DashboardPage