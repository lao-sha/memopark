import React from 'react'
import { Card, Typography, Alert, Button, Space } from 'antd'

/**
 * 函数级详细中文注释：支付成功页（只读查单版）
 * - 从 URL 读取 trade_no 或 out_trade_no 与只读票据 vt
 * - 调用后端只读查询（占位：沿用 order_simple；未来可接入 order_view）
 * - 不暴露后端鉴权密钥；实际联调推荐使用代理自动注入或只读票据接口
 */
export default function PayResultPage() {
  const [error, setError] = React.useState<string>('')
  const [data, setData] = React.useState<any>(null)
  const search = typeof window !== 'undefined' ? window.location.search : ''

  async function fetchOrder() {
    setError('')
    setData(null)
    try {
      const usp = new URLSearchParams(search)
      const trade_no = usp.get('trade_no') || ''
      const out_trade_no = usp.get('out_trade_no') || ''
      const vt = usp.get('vt') || ''
      if (!trade_no && !out_trade_no) throw new Error('缺少 trade_no 或 out_trade_no')
      if (!vt) throw new Error('缺少只读票据 vt，请从收银台回跳链接进入')
      // 只调用只读接口 order_view（带 vt 免鉴权），不在浏览器附带任何鉴权密钥
      const urlView = '/epay/api.php?act=order_view'
      const bodyView = trade_no ? { trade_no, vt } : { out_trade_no, vt }
      const headersView: Record<string, string> = { 'Content-Type': 'application/json;charset=UTF-8' }
      const resp = await fetch(urlView, { method: 'POST', headers: headersView, body: JSON.stringify(bodyView) })
      const text = await resp.text()
      let d: any = null
      try { d = JSON.parse(text) } catch { d = { raw: text } }
      if (!resp.ok) throw new Error(`HTTP_${resp.status}: ${resp.statusText}`)
      if (d && typeof d === 'object' && 'code' in d && Number(d.code) !== 1) {
        throw new Error(`查询失败 code=${d.code}${d.msg ? `: ${d.msg}` : ''}`)
      }
      setData(d)
    } catch (e: any) {
      setError(e?.message || '查询失败')
    }
  }

  React.useEffect(() => { fetchOrder() }, [])

  function statusText(v: any): string {
    const n = Number(v)
    if (Number.isNaN(n)) return String(v ?? '')
    if (n === 0) return '未支付'
    if (n === 1) return '已支付'
    return `状态:${n}`
  }

  return (
    <Card style={{ maxWidth: 480, margin: '0 auto' }}>
      <Typography.Title level={5}>支付结果</Typography.Title>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {data && (
        <>
          <Alert type={Number(data.status) === 1 ? 'success' : 'info'} showIcon
            message={`状态：${statusText(data.status)}`}
            description={`订单：${data.trade_no || data.out_trade_no || ''} 金额：${data.money || ''}`}
            style={{ marginBottom: 12 }}
          />
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </>
      )}
      <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
        <Button onClick={fetchOrder} block>刷新</Button>
        <Button type="primary" href="#/otc/mm-apply" block>返回做市商申请</Button>
      </Space>
    </Card>
  )
}


