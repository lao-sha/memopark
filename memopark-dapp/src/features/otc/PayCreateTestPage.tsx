import React from 'react'
import { Card, Form, Input, InputNumber, Button, Space, Typography, Alert, Image, Divider, Select } from 'antd'
import CryptoJS from 'crypto-js'

/**
 * 函数级详细中文注释：支付创建测试页（仅用于联通性验证）
 * - 目标：向后端 `http://111.170.145.41/mapi.php` 发起创建支付订单请求，支付方式为支付宝，金额默认 1 元，返回二维码展示。
 * - 按 epay 文档（仓内 doc.inc.php）组装参数：pid/type/out_trade_no/notify_url/return_url/name/money/clientip/(device/param)
 * - 签名：MD5，将所有参与参数按 ASCII 升序拼接为 "a=b&c=d"，末尾直接拼接商户密钥 KEY，再 MD5 小写，sign_type=MD5；sign、sign_type、空值不参与签名。
 * - 设计：移动端优先，单卡片布局；支持一键创建与自定义金额；展示原始返回 JSON 便于排错；二维码优先使用服务端返回链接/图片，如无则回退到在线二维码生成服务生成。
 * - 安全：此页面仅用于开发/测试联通性，不涉及链上资金操作；请求为跨域 HTTP 请求，需后端正确设置 CORS。
 * - 兼容：尝试解析常见返回字段（qr、qrcode、pay_qr、code_url、url、qr_base64、qrcode_img）。
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
  const [stringToSign, setStringToSign] = React.useState<string>('')

  /**
   * 函数级中文注释：从服务端返回中抽取二维码展示源
   * - 优先使用可直接作为 <img src> 的 base64 图片字段（qr_base64/qrcode_img）
   * - 其次使用 URL 字段（qr/qrcode/pay_qr/code_url/url/qr_link），并通过在线二维码服务生成图片
   */
  function extractQrImageFromResponse(data: any): string {
    if (!data || typeof data !== 'object') return ''
    // base64 图片
    const base64 = data.qr_base64 || data.qrcode_base64 || data.qrcode_img
    if (typeof base64 === 'string' && base64.length > 0) {
      const prefixed = base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`
      return prefixed
    }
    // 文本/链接 → 在线二维码
    const urlLike = data.qrcode || data.payurl || data.urlscheme || data.qr || data.pay_qr || data.code_url || data.qr_link || data.url || data.pay_info || data?.data?.pay_info
    if (typeof urlLike === 'string' && urlLike.length > 0) {
      const text = urlLike
      return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}`
    }
    return ''
  }

  /**
   * 函数级中文注释：发起创建订单请求
   * - 构造最小请求体：支付方式固定为支付宝（alipay），金额默认为 1 元（可在表单中调整）
   * - 使用浏览器 fetch 发起 POST 请求；设置 JSON 头与 X-Requested-With，credentials 省略避免同源限制
   * - 成功：展示二维码与完整返回 JSON；失败：展示错误文案
   */
  const onCreate = async (values: any) => {
    setError('')
    setRespJson(null)
    setQrSrc('')
    setLoading(true)
    try {
      const amountYuan = Number(values.money || 1)
      const nowSec = Math.floor(Date.now() / 1000)
      const outTradeNo = `mp${nowSec}${Math.floor(Math.random() * 1000)}`
      const pid = Number(values.pid || 1000)
      const merchantKey = String(values.merchantKey || '')

      // 组装参与签名的参数（空值不参与）
      const unsigned: Record<string, string> = {
        pid: String(pid),
        type: String(values.type || 'alipay'),
        out_trade_no: outTradeNo,
        notify_url: values.notify_url || `${location.origin}/api/notify/mock`,
        return_url: values.return_url || `${location.origin}${location.pathname}#/otc/pay-test`,
        name: values.name || 'VIP会员',
        money: amountYuan.toFixed(2),
        clientip: values.clientip || '127.0.0.1',
        ...(values.device ? { device: String(values.device) } : {}),
        ...(values.param ? { param: String(values.param) } : {}),
      }

      // 计算 MD5 签名（按 ASCII 升序，拼接 a=b&c=d，然后 + KEY 再 MD5 小写）
      const entries = Object.entries(unsigned).filter(([, v]) => v !== '' && v !== undefined && v !== null)
      entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      const canonical = entries.map(([k, v]) => `${k}=${v}`).join('&')
      setStringToSign(canonical + '+KEY(已隐藏)')
      if (!merchantKey) throw new Error('缺少商户密钥，用于本地生成签名')
      const sign = CryptoJS.MD5(canonical + merchantKey).toString()

      const payload: Record<string, any> = {
        ...unsigned,
        sign,
        sign_type: 'MD5',
      }

      // 记录并展示完整请求数据（URL、方法、头、体与 curl）
      // 默认走后端签名代理，避免在前端接触商户密钥与跨域问题
      const url = '/proxy/epay/create'
      const method = 'POST'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      }
      setReqUrl(url)
      setReqMethod(method)
      setReqHeaders(headers)
      setReqBody(payload)
      const curl = `curl -i -X ${method} '${url}' -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' --data '${JSON.stringify(payload).replace(/'/g, "'\\''")}'`
      setReqCurl(curl)

      const resp = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
        credentials: 'omit',
        mode: 'cors',
      })

      const text = await resp.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      setRespJson(data)

      if (!resp.ok) {
        throw new Error(`HTTP_${resp.status}: ${resp.statusText}`)
      }
      // epay 文档：code===1 表示成功
      if (data && typeof data === 'object' && 'code' in data && Number(data.code) !== 1) {
        setError(`服务端错误 code=${data.code}${data.msg ? `: ${data.msg}` : ''}`)
      }

      const img = extractQrImageFromResponse(data)
      if (!img) {
        throw new Error('未在返回中发现二维码信息，请检查服务端返回字段（qr/qrcode/code_url/url/qr_base64）')
      }
      setQrSrc(img)
    } catch (e: any) {
      setError(e?.message || '创建订单失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={5}>支付创建测试（支付宝 · 1 元）</Typography.Title>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <Form form={form} layout="vertical" onFinish={onCreate} initialValues={{ pid: 1000, type: 'alipay', name: 'VIP会员', money: 1, clientip: '127.0.0.1', device: 'pc' }}>
        <Form.Item label="商户ID(pid)" name="pid" rules={[{ required: true, message: '请输入商户ID' }]}>
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="商户密钥(KEY)" name="merchantKey" rules={[{ required: true, message: '请输入商户密钥（仅本地签名测试）' }]}>
          <Input.Password placeholder="仅用于本地签名测试，请勿在生产环境暴露" />
        </Form.Item>
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

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" htmlType="submit" loading={loading} block>
            一键创建支付宝订单（1 元）
          </Button>
        </Space>
      </Form>

      {qrSrc && (
        <Card style={{ marginTop: 16 }}>
          <Typography.Text>请使用支付宝扫码支付：</Typography.Text>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Image src={qrSrc} width={240} height={240} alt="支付二维码" />
          </div>
          {respJson?.pay_info && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <a href={String(respJson.pay_info)} target="_blank" rel="noreferrer">直接打开支付链接</a>
            </div>
          )}
        </Card>
      )}

      <Divider />
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
        提示：此页为联通性测试页，直接访问远端支付创建接口。若浏览器控制台提示 CORS/预检失败，请在后端允许跨域：
        <br />Access-Control-Allow-Origin: 当前前端来源（如 http://127.0.0.1:5173）
        <br />Access-Control-Allow-Methods: GET,POST,OPTIONS
        <br />Access-Control-Allow-Headers: Content-Type, X-Requested-With
      </Typography.Paragraph>

      {respJson && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Typography.Text strong>返回原文（调试用）</Typography.Text>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, marginTop: 8 }}>
            {JSON.stringify(respJson, null, 2)}
          </pre>
        </Card>
      )}

      {/* 请求明细（URL/方法/头/体/curl） */}
      {(reqUrl || reqMethod || reqBody) && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Typography.Text strong>请求明细（调试用）</Typography.Text>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, marginTop: 8 }}>
{`URL: ${reqUrl}\nMETHOD: ${reqMethod}\nHEADERS: ${JSON.stringify(reqHeaders, null, 2)}\nBODY: ${JSON.stringify(reqBody, null, 2)}\nSIGN_STRING(no-key): ${stringToSign}\n\n# 可复制的 curl\n${reqCurl}`}
          </pre>
        </Card>
      )}
    </Card>
  )
}


