import React from 'react'
import { Card, Space, Typography, Input, Button, List, message, Alert } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：FeeGuard 管理页
 * - 提供 mark_fee_only / unmark_fee_only 操作
 * - 只读展示 is_fee_only 与 list_fee_only（若运行时暴露）
 * - 账号输入支持单个地址；批量导入可后续扩展
 */
const FeeGuardAdminPage: React.FC = () => {
  const [addr, setAddr] = React.useState('')
  const [list, setList] = React.useState<string[]>([])
  const [checking, setChecking] = React.useState('')
  const [isFeeOnly, setIsFeeOnly] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState('')

  const sectionCandidates = ['feeGuard','fee_guard','feeguard']

  const loadList = React.useCallback(async ()=>{
    setError('')
    try {
      const api = await getApi()
      const qroot: any = api.query as any
      let q: any
      for (const s of sectionCandidates) { if (qroot[s]) { q = qroot[s]; break } }
      if (!q) throw new Error('运行时未注册 FeeGuard')
      if (q.listFeeOnly) {
        const v = await q.listFeeOnly()
        const arr: string[] = (v.toJSON?.() as any[])?.map(x=> String(x)) || []
        setList(arr)
      } else {
        setList([])
      }
    } catch (e:any) { setError(e?.message || '加载失败') }
  }, [])

  const checkOne = React.useCallback(async (who: string)=>{
    setChecking(who)
    setIsFeeOnly(null)
    try {
      const api = await getApi()
      const qroot: any = api.query as any
      let q: any
      for (const s of sectionCandidates) { if (qroot[s]) { q = qroot[s]; break } }
      if (!q) throw new Error('运行时未注册 FeeGuard')
      if (q.isFeeOnly) {
        const v = await q.isFeeOnly(who)
        setIsFeeOnly(Boolean(v.toJSON?.()))
      } else {
        setIsFeeOnly(null)
      }
    } catch (e:any) { message.error(e?.message || '查询失败') }
    finally { setChecking('') }
  }, [])

  const doMark = async (on: boolean) => {
    try {
      if (!addr) { message.warning('请输入地址'); return }
      const api = await getApi()
      const txroot: any = api.tx as any
      let section: any
      for (const s of sectionCandidates) { if (txroot[s]) { section = txroot[s]; break } }
      if (!section) throw new Error('运行时未注册 FeeGuard')
      const method = on ? (section.markFeeOnly || section.mark_fee_only) : (section.unmarkFeeOnly || section.unmark_fee_only)
      if (!method) throw new Error('找不到方法')
      const h = await signAndSendLocalFromKeystore(section === txroot.feeGuard ? 'feeGuard' : Object.keys(txroot).find(k=> txroot[k]===section)!, method.name, [addr])
      message.success((on?'标记成功 ':'取消成功 ')+h)
      loadList(); checkOne(addr)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  React.useEffect(()=> { loadList() }, [loadList])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="FeeGuard 管理">
        <Space direction="vertical" style={{ width:'100%' }} size={8}>
          {error && <Alert type="error" showIcon message={error} />}
          <Typography.Text>仅手续费账户保护：仅允许用于支付交易手续费，禁止资金转出（除交易费）。</Typography.Text>
          <Space.Compact style={{ width:'100%' }}>
            <Input placeholder="账户地址" value={addr} onChange={e=> setAddr(e.target.value)} />
            <Button onClick={()=> checkOne(addr)} loading={checking===addr}>查询</Button>
            <Button type="primary" onClick={()=> doMark(true)}>标记</Button>
            <Button danger onClick={()=> doMark(false)}>取消</Button>
          </Space.Compact>
          {isFeeOnly!=null && <Alert type={isFeeOnly?'success':'warning'} showIcon message={isFeeOnly?'该账户为 fee-only':'该账户非 fee-only'} />}
          <Typography.Title level={5} style={{ marginTop: 12 }}>当前 fee-only 列表</Typography.Title>
          <List bordered dataSource={list} renderItem={(a)=> (
            <List.Item actions={[<Button size="small" onClick={()=> setAddr(a)}>填入</Button>]}>
              <Typography.Text code style={{ fontSize: 12 }}>{a}</Typography.Text>
            </List.Item>
          )} />
        </Space>
      </Card>
    </div>
  )
}

export default FeeGuardAdminPage


