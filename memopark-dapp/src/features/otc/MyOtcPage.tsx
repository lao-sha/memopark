import React from 'react'
import { Alert, Tabs, List, Skeleton, Button, Tag, Typography, message } from 'antd'
import { query } from '../../lib/graphql'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：我的OTC（Subsquid + 链上操作）
 * 前端操作方法：
 * - 进入页面自动按 `owner` 过滤（从钱包地址或输入框获取，示例简化为本地状态）
 * - 取消挂单/标记已付：点击按钮后走 @polkadot/api 直发（示例留空，接前文 polkadot.ts）
 */
const MyOtcPage: React.FC = () => {
  const [addr, setAddr] = React.useState<string>('')
  const [tab, setTab] = React.useState<'listings'|'orders'>('listings')
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!addr) return
    setLoading(true)
    try {
      if (tab === 'listings') {
        const data = await query<{ listings: any[] }>(`query Q($maker:String!){ listings(where:{maker_eq:$maker}, orderBy: createdAt_DESC, limit: 50){ id base quote price total remaining partial expireAt active } }`, { maker: addr })
        setItems(data.listings)
      } else {
        const data = await query<{ orders: any[] }>(`query Q($taker:String!){ orders(where:{taker_eq:$taker}, orderBy: createdAt_DESC, limit: 50){ id listingId price qty amount state createdAt expireAt } }`, { taker: addr })
        setItems(data.orders)
      }
    } finally { setLoading(false) }
  }, [addr, tab])

  React.useEffect(() => { load() }, [load])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>我的OTC</Typography.Title>
        <Alert type="info" showIcon message="数据由 Subsquid 提供；链上操作如取消/标记已付通过钱包直发。" />
      </div>
      <div style={{ padding: 8 }}>
        <input placeholder="输入你的地址" value={addr} onChange={e=>setAddr(e.target.value)} style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
      </div>
      <div style={{ padding: 8 }}>
        <Tabs activeKey={tab} onChange={k=>setTab(k as any)} items={[
          { key:'listings', label:'我的挂单', children: loading? <Skeleton active/> : (
            <List dataSource={items} renderItem={(it:any)=> (
              <List.Item actions={[<Button key="cancel" size="small" onClick={async()=>{
                try{
                  if(!addr) throw new Error('请先填写地址')
                  const tx = await signAndSendLocalFromKeystore('otcListing','cancelListing',[Number(it.id)])
                  message.success(`已提交取消：${tx}`)
                }catch(e:any){ message.error(e?.message||'失败') }
              }}>取消挂单</Button>] }>
                <List.Item.Meta
                  title={`#${it.id} ${it.base}/${it.quote} 价格 ${String(it.price)}`}
                  description={<>
                    <Tag color={it.active?'green':'default'}>{it.active?'在售':'已下架'}</Tag>
                    <Tag>总量 {String(it.total)}</Tag>
                    <Tag>剩余 {String(it.remaining)}</Tag>
                    <Tag>{it.partial?'可部分成交':'不可部分成交'}</Tag>
                  </>}
                />
              </List.Item>
            )}/>
          ) },
          { key:'orders', label:'我的订单', children: loading? <Skeleton active/> : (
            <List dataSource={items} renderItem={(it:any)=> (
              <List.Item actions={[
                <Button key="paid" size="small" onClick={async()=>{
                try{
                  if(!addr) throw new Error('请先填写地址')
                  const tx = await signAndSendLocalFromKeystore('otcOrder','markPaid',[Number(it.id)])
                  message.success(`已标记：${tx}`)
                }catch(e:any){ message.error(e?.message||'失败') }
              }}>标记已付</Button>,
              <Button key="release" size="small" type="primary" onClick={async()=>{
                try{
                  if(!addr) throw new Error('请先填写地址')
                  const tx = await signAndSendLocalFromKeystore('otcOrder','release',[Number(it.id)])
                  message.success(`已放行：${tx}`)
                }catch(e:any){ message.error(e?.message||'失败') }
              }}>放行(卖家)</Button>,
              <Button key="timeout" size="small" danger onClick={async()=>{
                try{
                  if(!addr) throw new Error('请先填写地址')
                  const tx = await signAndSendLocalFromKeystore('otcOrder','refundOnTimeout',[Number(it.id)])
                  message.success(`已提交：${tx}`)
                }catch(e:any){ message.error(e?.message||'失败') }
              }}>超时退款</Button>,
              <Button key="revealPay" size="small" onClick={async()=>{
                try{
                  if(!addr) throw new Error('请先填写地址')
                  const payload = prompt('输入支付明文')||''
                  const salt = prompt('输入 salt')||''
                  const tx = await signAndSendLocalFromKeystore('otcOrder','revealPayment',[Number(it.id), new TextEncoder().encode(payload), new TextEncoder().encode(salt)])
                  message.success(`已揭示支付：${tx}`)
                }catch(e:any){ message.error(e?.message||'失败') }
              }}>揭示支付</Button>,
              <Button key="revealContact" size="small" onClick={async()=>{
                try{
                  if(!addr) throw new Error('请先填写地址')
                  const payload = prompt('输入联系方式明文')||''
                  const salt = prompt('输入 salt')||''
                  const tx = await signAndSendLocalFromKeystore('otcOrder','revealContact',[Number(it.id), new TextEncoder().encode(payload), new TextEncoder().encode(salt)])
                  message.success(`已揭示联系方式：${tx}`)
                }catch(e:any){ message.error(e?.message||'失败') }
              }}>揭示联系方式</Button>,
              <Button key="dispute" size="small" onClick={async()=>{
                try{
                  if(!addr) throw new Error('请先填写地址')
                  const tx = await signAndSendLocalFromKeystore('otcOrder','markDisputed',[Number(it.id)])
                  message.success(`已发起：${tx}`)
                }catch(e:any){ message.error(e?.message||'失败') }
              }}>发起争议</Button>
            ] }>
                <List.Item.Meta
                  title={`订单 #${it.id} 挂单 ${String(it.listingId)} 金额 ${String(it.amount)}`}
                  description={<>
                    <Tag>数量 {String(it.qty)}</Tag>
                    <Tag color="blue">状态 {it.state}</Tag>
                  </>}
                />
              </List.Item>
            )}/>
          ) }
        ]}/>
      </div>
    </div>
  )
}

export default MyOtcPage


