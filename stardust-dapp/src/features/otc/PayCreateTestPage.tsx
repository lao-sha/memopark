import React from 'react'
import { Card, Form, Input, InputNumber, Button, Space, Typography, Alert, Image, Divider, Select, message, Switch } from 'antd'

/**
 * 函数级详细中文注释：支付创建与查询测试页（免签 Header 鉴权版，含轮询与状态文案）
 * - 新增：
 *   1）自动轮询查询，默认每 3 秒查询一次，最多 60 次（约 3 分钟）或直至支付完成
 *   2）状态中文文案映射，便于非技术人员理解：0未支付/1已支付/其他状态原样显示
 *   3）展示并提供复制 trade_no/out_trade_no，便于追查与对账
 *   4）前端 out_trade_no 正则校验，与后端保持一致 /^[a-zA-Z0-9._-|]+$/
 */
export default function PayCreateTestPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string>('')
  const [respJson, setRespJson] = React.useState<any>(null)
  const [qrSrc, setQrSrc] = React.useState<string>('')
  const [reqUrl, setReqUrl] = React.useState<string>('')
  const [reqMethod, setReqMethod] = React.useState<string>('')
  const [reqHeaders, setReqHeaders] = React.useState<Record<string, string>>({})
  const [reqBody, setReqBody] = React.useState<any>(null)
  const [reqCurl, setReqCurl] = React.useState<string>('')
  const [lastOutTradeNo, setLastOutTradeNo] = React.useState<string>('')
  const [lastTradeNo, setLastTradeNo] = React.useState<string>('')
  const [queryResp, setQueryResp] = React.useState<any>(null)
  const [polling, setPolling] = React.useState<boolean>(false)
  const pollingRef = React.useRef<{ timer?: number; count: number }>({ count: 0 })
  const [pollIntervalSec, setPollIntervalSec] = React.useState<number>(3)
  const [pollMaxTimes, setPollMaxTimes] = React.useState<number>(60)
  const [autoRedirect, setAutoRedirect] = React.useState<boolean>(false)

  function extractQrImageFromResponse(data: any): string {
    if (!data || typeof data !== 'object') return ''
    const base64 = data.qr_base64 || data.qrcode_base64 || data.qrcode_img
    if (typeof base64 === 'string' && base64.length > 0) {
      const prefixed = base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`
      return prefixed
    }
    const urlLike = data.qrcode || data.payurl || data.urlscheme || data.qr || data.pay_qr || data.code_url || data.qr_link || data.url || data.pay_info || data?.data?.pay_info
    if (typeof urlLike === 'string' && urlLike.length > 0) {
      const text = urlLike
      return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}`
    }
    return ''
  }

  function statusText(v: any): string {
    const n = Number(v)
    if (Number.isNaN(n)) return String(v ?? '')
    if (n === 0) return '未支付'
    if (n === 1) return '已支付'
    return `状态:${n}`
  }

  function validateOutTradeNo(v?: string): boolean {
    if (!v) return true
    return /^[a-zA-Z0-9._-|]+$/.test(v)
  }

  const onCreate = async (values: any) => {
    setError('')
    setRespJson(null)
    setQrSrc('')
    setQueryResp(null)
    stopPolling()
    setLoading(true)
    try {
      const amountYuan = Number(values.money || 1)
      const nowSec = Math.floor(Date.now() / 1000)
      const outTradeNo = `mp${nowSec}${Math.floor(Math.random() * 1000)}`

      const payload: Record<string, any> = {
        type: String(values.type || 'alipay'),
        out_trade_no: outTradeNo,
        name: values.name || 'VIP会员',
        money: amountYuan.toFixed(2),
        clientip: values.clientip || '127.0.0.1',
        device: values.device || 'pc',
        param: values.param || '',
      }
      setLastOutTradeNo(outTradeNo)

      const url = '/mapi.php'
      const method = 'POST'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${import.meta.env.VITE_EPAY_API_TOKEN || 'demo-token'}`,
        'X-Timestamp': String(Math.floor(Date.now() / 1000)),
        'X-Nonce': `${crypto.getRandomValues(new Uint32Array(4)).join('')}`,
        'Idempotency-Key': outTradeNo,
      }
      setReqUrl(url)
      setReqMethod(method)
      setReqHeaders(headers)
      setReqBody(payload)
      const curl = `curl -i -X ${method} '${url}' \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -H 'Authorization: ${headers['Authorization']}' \
  -H 'X-Timestamp: ${headers['X-Timestamp']}' \
  -H 'X-Nonce: ${headers['X-Nonce']}' \
  -H 'Idempotency-Key: ${headers['Idempotency-Key']}' \
  --data '${JSON.stringify(payload).replace(/'/g, "'\\''")}'`
      setReqCurl(curl)

      const resp = await fetch(url, { method, headers, body: JSON.stringify(payload), credentials: 'omit', mode: 'cors' })
      const text = await resp.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      setRespJson(data)

      if (!resp.ok) throw new Error(`HTTP_${resp.status}: ${resp.statusText}`)
      if (data && typeof data === 'object' && 'code' in data && Number(data.code) !== 1) {
        throw new Error(`服务端错误 code=${data.code}${data.msg ? `: ${data.msg}` : ''}`)
      }

      setLastTradeNo(data.trade_no || '')
      const img = extractQrImageFromResponse(data)
      if (!img) throw new Error('未在返回中发现二维码信息（qrcode/payurl/urlscheme/qr/url/pay_info）')
      setQrSrc(img)

      // 自动开始轮询
      startPolling()
    } catch (e: any) {
      setError(e?.message || '创建订单失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：查询订单
   * - 通过 /epay/api.php?act=order_simple 进行免签查询（Header 鉴权）
   * - 支持使用上一次下单生成的 out_trade_no 直接查询，也可手动输入 out_trade_no 或 trade_no
   */
  const onQuery = async (): Promise<any | null> => {
    setError('')
    try {
      const formOut = form.getFieldValue('query_out_trade_no')
      const formTrade = form.getFieldValue('query_trade_no')
      if (formOut && !validateOutTradeNo(formOut)) {
        throw new Error('out_trade_no 格式不正确，应仅包含字母/数字/._-|')
      }
      const out_trade_no = formOut || lastOutTradeNo
      const trade_no = formTrade || lastTradeNo
      if (!out_trade_no && !trade_no) throw new Error('请先创建订单，或填写 out_trade_no / trade_no 再查询')
      const url = '/epay/api.php?act=order_simple'
      const method = 'POST'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': `Bearer ${import.meta.env.VITE_EPAY_API_TOKEN || 'demo-token'}`,
        'X-Timestamp': String(Math.floor(Date.now() / 1000)),
        'X-Nonce': `${crypto.getRandomValues(new Uint32Array(4)).join('')}`,
      }
      const body = trade_no ? { trade_no } : { out_trade_no }
      const resp = await fetch(url, { method, headers, body: JSON.stringify(body) })
      const text = await resp.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      setQueryResp(data)
      if (data && typeof data === 'object' && data.trade_no && !lastTradeNo) setLastTradeNo(data.trade_no)
      if (!resp.ok) throw new Error(`HTTP_${resp.status}: ${resp.statusText}`)
      if (data && typeof data === 'object' && 'code' in data && Number(data.code) !== 1) {
        throw new Error(`查询失败 code=${data.code}${data.msg ? `: ${data.msg}` : ''}`)
      }
      // 返回数据给轮询控制
      return data
    } catch (e: any) {
      setError(e?.message || '查询订单失败')
      return null
    }
  }

  /**
   * 函数级详细中文注释：启动自动轮询
   * - 使用配置项 pollIntervalSec 与 pollMaxTimes 控制频率与次数
   * - 每次 tick 内部调用 onQuery 并依据返回判断是否已支付
   * - 已支付时如开启 autoRedirect，则跳转到 DEFAULT_RETURN_URL（前端 env 配置）
   */
  function startPolling() {
    if (pollingRef.current.timer) return
    setPolling(true)
    pollingRef.current.count = 0
    const tick = async () => {
      pollingRef.current.count += 1
      const data = await onQuery()
      const paid = Number(data?.status) === 1
      if (paid) {
        setPolling(false)
        message.success('订单已支付')
        if (autoRedirect) {
          const target = String(import.meta.env.VITE_DEFAULT_RETURN_URL || location.origin)
          // 延迟 600ms 给用户提示完成
          setTimeout(() => { location.href = target }, 600)
        }
        return
      }
      if (pollingRef.current.count >= Math.max(1, pollMaxTimes)) {
        setPolling(false)
        message.info('查询结束：超过最大轮询次数')
        return
      }
      // 下次查询
      pollingRef.current.timer = window.setTimeout(tick, Math.max(1000, pollIntervalSec * 1000))
    }
    pollingRef.current.timer = window.setTimeout(tick, Math.max(1000, pollIntervalSec * 1000))
  }

  function stopPolling() {
    setPolling(false)
    if (pollingRef.current.timer) {
      window.clearTimeout(pollingRef.current.timer)
      pollingRef.current.timer = undefined
    }
    pollingRef.current.count = 0
  }

  React.useEffect(() => () => stopPolling(), [])

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); message.success('已复制到剪贴板') } catch {}
  }

  return (
    <Card style={{ maxWidth: 414, margin: '0 auto' }}>
      <Typography.Title level={5}>支付创建与查询测试（免签 Header 鉴权）</Typography.Title>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <Form form={form} layout="vertical" onFinish={onCreate} initialValues={{ type: 'alipay', name: 'VIP会员', money: 1, clientip: '127.0.0.1', device: 'pc' }}>
        <Form.Item label="支付方式(type)" name="type" rules={[{ required: true }]}> 
          <Select options={[{ value: 'alipay', label: '支付宝' }, { value: 'wxpay', label: '微信' }]} />
        </Form.Item>
        <Form.Item label="商品名称(name)" name="name" rules={[{ required: true }]}> 
          <Input placeholder="VIP会员" />
        </Form.Item>
        <Form.Item label="金额（元，money）" name="money" rules={[{ required: true }]}> 
          <InputNumber min={0.01} precision={2} step={0.01} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="用户IP(clientip)" name="clientip" rules={[{ required: true }]}> 
          <Input placeholder="127.0.0.1" />
        </Form.Item>
        <Form.Item label="设备(device)" name="device"> 
          <Select allowClear options={[{ value: 'pc', label: 'pc' }, { value: 'mobile', label: 'mobile' }, { value: 'qq', label: 'qq' }, { value: 'wechat', label: 'wechat' }, { value: 'alipay', label: 'alipay' }, { value: 'jump', label: 'jump' }]} />
        </Form.Item>
        <Form.Item label="扩展参数(param)" name="param">
          <Input placeholder="可留空" />
        </Form.Item>

        {/* 手动查询参数输入区（可选） */}
        <Divider />
        <Form.Item label="手动查询 out_trade_no" name="query_out_trade_no" rules={[{ validator: (_, v) => validateOutTradeNo(v) ? Promise.resolve() : Promise.reject(new Error('仅允许字母/数字/._-|')) }]}>
          <Input placeholder="优先使用 trade_no；若无则使用此处 out_trade_no" />
        </Form.Item>
        <Form.Item label="手动查询 trade_no" name="query_trade_no">
          <Input placeholder="如果你已拿到系统订单号 trade_no，建议优先使用此项" />
        </Form.Item>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <InputNumber
              addonBefore="轮询间隔(秒)"
              min={1}
              max={30}
              value={pollIntervalSec}
              onChange={(v) => setPollIntervalSec(Number(v) || 3)}
            />
            <InputNumber
              addonBefore="最大次数"
              min={1}
              max={200}
              value={pollMaxTimes}
              onChange={(v) => setPollMaxTimes(Number(v) || 60)}
            />
            <Space>
              <Typography.Text>支付成功后自动跳转</Typography.Text>
              <Switch checked={autoRedirect} onChange={setAutoRedirect} />
            </Space>
          </Space>
          <Button type="primary" htmlType="submit" loading={loading} block>
            一键创建订单
          </Button>
          <Button onClick={onQuery} loading={polling} block>
            {polling ? '查询中...' : '查询订单（可自动轮询）'}
          </Button>
        </Space>
      </Form>

      {/* 订单关键信息与复制 */}
      {(lastOutTradeNo || lastTradeNo) && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {lastTradeNo && (
              <Space>
                <Typography.Text>trade_no: {lastTradeNo}</Typography.Text>
                <Button size="small" onClick={() => copy(lastTradeNo)}>复制</Button>
              </Space>
            )}
            {lastOutTradeNo && (
              <Space>
                <Typography.Text>out_trade_no: {lastOutTradeNo}</Typography.Text>
                <Button size="small" onClick={() => copy(lastOutTradeNo)}>复制</Button>
              </Space>
            )}
          </Space>
        </Card>
      )}

      {qrSrc && (
        <Card style={{ marginTop: 16 }}>
          <Typography.Text>请使用支付 App 扫码支付：</Typography.Text>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Image src={qrSrc} width={240} height={240} alt="支付二维码" />
          </div>
          {respJson?.payurl && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <a href={String(respJson.payurl)} target="_blank" rel="noreferrer">直接打开支付链接</a>
            </div>
          )}
        </Card>
      )}

      <Divider />
      {queryResp && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Typography.Text strong>查询返回（调试用）</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text>订单状态：{statusText(queryResp.status)}</Typography.Text>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, marginTop: 8 }}>
            {JSON.stringify(queryResp, null, 2)}
          </pre>
        </Card>
      )}
      {respJson && (
        <Card size="small">
          <Typography.Text strong>返回原文（调试用）</Typography.Text>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, marginTop: 8 }}>
            {JSON.stringify(respJson, null, 2)}
          </pre>
        </Card>
      )}

      {(reqUrl || reqMethod || reqBody) && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Typography.Text strong>请求明细（调试用）</Typography.Text>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, marginTop: 8 }}>
{`URL: ${reqUrl}
METHOD: ${reqMethod}
HEADERS: ${JSON.stringify(reqHeaders, null, 2)}
BODY: ${JSON.stringify(reqBody, null, 2)}

# 可复制的 curl
${reqCurl}`}
          </pre>
        </Card>
      )}
    </Card>
  )
}


