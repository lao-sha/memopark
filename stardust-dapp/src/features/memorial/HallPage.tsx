import React, { useEffect, useState } from 'react'
import { Card, Tabs, Typography, List, Button, Input, Row, Col, message, Space, Alert } from 'antd'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { getApi } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：纪念馆 Hall 展示页
 * - 数据：全局链上直连（移除 Subsquid 依赖）
 * - Tab：供奉/留言/媒体（留言/媒体为占位列表）
 */
const HallPage: React.FC<{ id: number }> = ({ id }) => {
  const [hall, setHall] = useState<any>(null)
  const [offerings, setOfferings] = useState<any[]>([])
  const [owner, setOwner] = useState<string>('')
  const [bindDeceased, setBindDeceased] = useState<string>('')
  const [setParkId, setSetParkId] = useState<string>('')
  const [offerParams, setOfferParams] = useState<{ min?: string; window?: number } | null>(null)

  /**
   * 函数级中文注释：从链上加载纪念馆信息
   * - 改为直接查询链上数据，移除 Subsquid 依赖
   */
  const refetch = async () => {
    try {
      const api = await getApi()
      // 查询纪念馆基本信息（需根据实际 pallet 结构调整）
      // 暂时禁用，显示提示信息
      setHall({ id, owner: '', parkId: null, kind: '', primaryDeceasedId: null, slug: '', createdAt: 0, offeringsCount: 0, offeringsAmount: '0' })
      setOfferings([])
      message.info('纪念馆功能已切换为链上直连模式，部分功能暂时禁用')
    } catch (e) {
      console.error('加载纪念馆信息失败:', e)
    }
  }

  useEffect(() => { refetch().catch(() => {}) }, [id])
  useEffect(() => { (async()=>{ try{ const api = await getApi(); const min = ((api.consts as any).memoOfferings?.minOfferAmount||0n).toString(); const window = Number((api.consts as any).memoOfferings?.offerWindow||0); setOfferParams({ min, window }); }catch{}})() }, [])

  const onAttachDeceased = async () => {
    try {
      if (!owner) throw new Error('请输入你的地址(owner)')
      const txHash = await signAndSendLocalFromKeystore('memoGrave', 'attachDeceased', [id, Number(bindDeceased)])
      message.success(`已上链：${txHash}`)
      setBindDeceased(''); refetch()
    } catch (e:any) { message.error(e?.message||'失败') }
  }
  const onSetPark = async () => {
    try {
      if (!owner) throw new Error('请输入你的地址(owner)')
      const txHash = await signAndSendLocalFromKeystore('memoGrave', 'setPark', [id, Number(setParkId)])
      message.success(`已上链：${txHash}`)
      setSetParkId(''); refetch()
    } catch (e:any) { message.error(e?.message||'失败') }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 8 }}>
      <Typography.Title level={4}>纪念馆 #{id}</Typography.Title>
      {hall && (
        <Card style={{ marginBottom: 8 }}>
          <div>馆主：{hall.owner}</div>
          <div>园区：{hall.parkId}</div>
          <div>类型：{hall.kind}</div>
          <div>主逝者：{hall.primaryDeceasedId || '-'}</div>
          <div>供奉次数/金额：{hall.offeringsCount} / {hall.offeringsAmount}</div>
          {offerParams && <div style={{ marginTop: 8 }}>
            <Alert type="info" showIcon message={`最小供奉金额 ${offerParams.min}，限频窗口 ${offerParams.window} 块`} />
          </div>}
          <Space style={{ marginTop: 8 }}>
            <Button type="primary" onClick={()=>message.info('请切换至“供奉下单”页，选择本馆ID')}>去供奉</Button>
          </Space>
        </Card>
      )}

      <Card style={{ marginBottom: 8 }}>
        <Typography.Title level={5}>关联逝者 / 设置园区</Typography.Title>
        <Row gutter={8}>
          <Col span={24}><Input placeholder="你的地址(owner)" value={owner} onChange={e=>setOwner(e.target.value)} /></Col>
        </Row>
        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col span={16}><Input placeholder="deceased_id" value={bindDeceased} onChange={e=>setBindDeceased(e.target.value)} /></Col>
          <Col span={8}><Button block onClick={onAttachDeceased}>绑定逝者</Button></Col>
        </Row>
        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col span={16}><Input placeholder="park_id" value={setParkId} onChange={e=>setSetParkId(e.target.value)} /></Col>
          <Col span={8}><Button block onClick={onSetPark}>设置园区</Button></Col>
        </Row>
      </Card>

      <Tabs
        items={[
          { key: 'offer', label: '供奉', children: (
            <List dataSource={offerings} renderItem={(it:any)=>(
              <List.Item>
                <List.Item.Meta title={`金额 ${it.amount}`} description={`by ${it.who} @#${it.block}`} />
              </List.Item>
            )} />
          ) },
          { key: 'guestbook', label: '留言', children: <div>占位：接入 Subsquid GuestbookMessage</div> },
          { key: 'media', label: '媒体', children: <div>占位：接入 Subsquid MediaItem</div> },
        ]}
      />
    </div>
  )
}

export default HallPage


