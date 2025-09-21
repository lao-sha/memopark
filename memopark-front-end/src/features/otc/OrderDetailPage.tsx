import React from 'react'
import { Alert, Card, Descriptions, Typography, Button, message } from 'antd'
import { query } from '../../lib/graphql'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：订单详情（Subsquid + 直发操作）
 * 前端操作方法：
 * - 输入订单ID，从 Subsquid 拉取快照；
 * - 支持“标记已付”“发起争议”按钮（使用 @polkadot/api 直发）。
 */
const OrderDetailPage: React.FC = () => {
  const [orderId, setOrderId] = React.useState<string>('1')
  const [data, setData] = React.useState<any>(null)

  const load = React.useCallback(async () => {
    const gql = `query Q($id:ID!){ order(id:$id){ id listingId maker taker price qty amount state createdAt expireAt actions(orderBy: block_ASC){ kind block meta } } }`
    const res = await query<{ order: any }>(gql, { id: orderId })
    setData(res.order)
  }, [orderId])

  React.useEffect(()=>{ load() }, [load])

  const markPaid = async () => {
    try {
      // 需要 taker 地址签名，这里示例要求用户输入或从钱包选择（略）
      message.info('请在“我的OTC”页进行标记已付操作（此页预留）。')
    } catch (e:any) { message.error(e?.message||'失败') }
  }
  const dispute = async () => {
    try {
      message.info('请在“仲裁(代付)”页提交或在此页补充实现仲裁直发。')
    } catch (e:any) { message.error(e?.message||'失败') }
  }
  const release = async () => {
    try {
      const owner = prompt('请输入 Maker 地址以签名放行:')
      if(!owner) return
      const tx = await signAndSendLocalFromKeystore('otcOrder','release',[Number(orderId)])
      message.success(`已放行：${tx}`)
    } catch(e:any){ message.error(e?.message||'失败') }
  }
  const refundOnTimeout = async () => {
    try {
      const owner = prompt('请输入地址以提交超时退款:')
      if(!owner) return
      const tx = await signAndSendLocalFromKeystore('otcOrder','refundOnTimeout',[Number(orderId)])
      message.success(`已提交：${tx}`)
    } catch(e:any){ message.error(e?.message||'失败') }
  }
  const revealPayment = async () => {
    try {
      const owner = prompt('输入地址(签名账户)')
      if(!owner) return
      const payload = prompt('输入支付明文(将与 salt 拼接后哈希)')||''
      const salt = prompt('输入 salt (十六进制或任意字符串)')||''
      const tx = await signAndSendLocalFromKeystore('otcOrder','revealPayment',[Number(orderId), new TextEncoder().encode(payload), new TextEncoder().encode(salt)])
      message.success(`已揭示：${tx}`)
    } catch(e:any){ message.error(e?.message||'失败') }
  }
  const revealContact = async () => {
    try {
      const owner = prompt('输入地址(签名账户)')
      if(!owner) return
      const payload = prompt('输入联系方式明文')||''
      const salt = prompt('输入 salt')||''
      const tx = await signAndSendLocalFromKeystore('otcOrder','revealContact',[Number(orderId), new TextEncoder().encode(payload), new TextEncoder().encode(salt)])
      message.success(`已揭示：${tx}`)
    } catch(e:any){ message.error(e?.message||'失败') }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>订单详情</Typography.Title>
        <Alert type="info" showIcon message="数据由 Subsquid 提供；动作使用直发或代付页入口。" />
      </div>
      <div style={{ padding: 8 }}>
        <input value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder="输入订单ID" style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
      </div>
      <div style={{ padding: 8 }}>
        <Card>
          {data ? (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="订单ID">{data.id}</Descriptions.Item>
              <Descriptions.Item label="挂单ID">{String(data.listingId)}</Descriptions.Item>
              <Descriptions.Item label="Maker">{data.maker}</Descriptions.Item>
              <Descriptions.Item label="Taker">{data.taker}</Descriptions.Item>
              <Descriptions.Item label="价格">{String(data.price)}</Descriptions.Item>
              <Descriptions.Item label="数量">{String(data.qty)}</Descriptions.Item>
              <Descriptions.Item label="金额">{String(data.amount)}</Descriptions.Item>
              <Descriptions.Item label="状态">{data.state}</Descriptions.Item>
            </Descriptions>
          ) : '加载中...'}
          {data?.actions?.length ? (
            <div style={{ marginTop: 12 }}>
              <Typography.Title level={5} style={{ marginBottom: 8 }}>时间线</Typography.Title>
              {data.actions.map((a:any,idx:number)=> (
                <div key={idx} style={{ padding:'6px 0', borderBottom:'1px solid #f0f0f0' }}>
                  <div>{a.kind} @ block {a.block}</div>
                  {a.meta && <div style={{ color:'#999' }}>{a.meta}</div>}
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <Button onClick={markPaid}>标记已付</Button>
            <Button onClick={dispute}>发起争议</Button>
            <Button type="primary" onClick={release}>放行(卖家)</Button>
            <Button danger onClick={refundOnTimeout}>超时退款</Button>
            <Button onClick={revealPayment}>揭示支付</Button>
            <Button onClick={revealContact}>揭示联系方式</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default OrderDetailPage


