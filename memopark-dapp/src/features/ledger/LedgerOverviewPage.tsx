import React from 'react'
import { Alert, Card, Statistic, Row, Col, Typography, Tag } from 'antd'
import { query } from '../../lib/graphql'
import { ApiPromise } from '@polkadot/api'
import { getApi } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：台账概览（链上最小统计 + 周活跃判定 + Subsquid 明细）
 * 前端操作方法：
 * - 输入墓位ID，自动读取链上累计次数/金额（通过 runtime storage 或 view 函数）
 * - 周活跃：调用 runtime `pallet-ledger::isCurrentWeekActive`（需要 runtime api 或链上辅助 view）
 * - 最近明细：通过 Subsquid 拉取 offerings 时间线
 */
const LedgerOverviewPage: React.FC = () => {
  const [graveId, setGraveId] = React.useState<string>('1')
  const [totalCount, setTotalCount] = React.useState<string>('0')
  const [totalAmount, setTotalAmount] = React.useState<string>('0')
  const [active, setActive] = React.useState<boolean>(false)
  const [items, setItems] = React.useState<any[]>([])

  const loadOnchain = React.useCallback(async () => {
    const api: ApiPromise = await getApi()
    // 读取 storage：TotalsByGrave / TotalMemoByGrave
    // @ts-ignore
    const count = await (api.query as any).ledger?.totalsByGrave?.(graveId)
    // @ts-ignore
    const amount = await (api.query as any).ledger?.totalMemoByGrave?.(graveId)
    setTotalCount(count?.toString?.() || '0')
    setTotalAmount(amount?.toString?.() || '0')
    // 由于无直接 runtime view 暴露，这里演示性设置为 false；
    // 若已生成 view function，可通过 api.call.<section>.<method>(...) 判断。
    setActive(false)
  }, [graveId])

  const loadSquid = React.useCallback(async () => {
    const data = await query<{ offerings: any[] }>(`query Q($gid:BigInt!){ offerings(where:{domain_eq:1,targetId_eq:$gid}, orderBy:block_DESC, limit:20){ who kindCode amount block } }`, { gid: graveId })
    setItems(data.offerings)
  }, [graveId])

  React.useEffect(()=>{ loadOnchain(); loadSquid() }, [loadOnchain, loadSquid])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>台账概览</Typography.Title>
        <Alert type="info" showIcon message="链上展示累计与活跃判定；明细与趋势来自 Subsquid。" />
      </div>
      <div style={{ padding: 8 }}>
        <input value={graveId} onChange={e=>setGraveId(e.target.value)} placeholder="输入墓位ID" style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
      </div>
      <div style={{ padding: 8 }}>
        <Row gutter={8}>
          <Col span={12}><Card><Statistic title="累计次数" value={totalCount} /></Card></Col>
          <Col span={12}><Card><Statistic title="累计金额" value={totalAmount} /></Card></Col>
        </Row>
        <div style={{ marginTop: 8 }}>
          <Tag color={active? 'green':'default'}>{active? '本周活跃' : '本周不活跃'}</Tag>
        </div>
      </div>
      <div style={{ padding: 8 }}>
        <Card title="最近供奉（Subsquid）">
          {items.map((it, i)=> (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div>who: {it.who}</div>
              <div>kind: {it.kindCode} amount: {String(it.amount||0)}</div>
              <div>block: {String(it.block)}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

export default LedgerOverviewPage


