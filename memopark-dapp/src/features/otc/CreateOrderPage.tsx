import React from 'react'
import { Card, Form, Input, InputNumber, Button, Radio, Space, Select, Typography, Descriptions, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { createOrder, getOrderStatus } from '../../lib/otc-adapter'
import { providerRegistry, pickProvider } from '../../lib/providers'

/**
 * 函数级详细中文注释：OTC 下单页（创建订单 + 二维码 + 轮询状态）
 * - 目标：为用户生成一次性短时有效的订单与支付二维码，引导完成支付；
 * - 实现：选择做市商 + 金额（法币或 MEMO 二选一）+ 通道，创建订单后展示二维码/链接；
 * - 轮询：每 5 秒查询一次状态，进入 paid_confirmed 后提供“前往领取”入口；
 * - 安全：关键字段均来自服务端返回（memo_amount/expired_at/url 等），前端不做价格计算。
 */
export default function CreateOrderPage() {
  const [form] = Form.useForm()
  const [creating, setCreating] = React.useState(false)
  const [providerId, setProviderId] = React.useState<string>(providerRegistry[0]?.id)
  const [order, setOrder] = React.useState<any | null>(null)
  const [status, setStatus] = React.useState<string>('pending')
  const [nowSec, setNowSec] = React.useState<number>(Math.floor(Date.now() / 1000))

  // 倒计时心跳（1s）
  React.useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  // 轮询订单状态（5s）
  React.useEffect(() => {
    if (!order?.order_id) return
    if (['paid_confirmed', 'authorized', 'settled', 'expired', 'failed'].includes(status)) return
    const iv = setInterval(async () => {
      try {
        const s = await getOrderStatus(order.order_id, providerId)
        setStatus(s.status)
      } catch (e) {
        // 忽略短期网络抖动
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [order?.order_id, providerId, status])

  /**
   * 函数级中文注释：提交创建订单
   * - 根据用户选择（法币金额或 MEMO 数量）构造请求；
   * - 创建成功后保存订单草案并进入轮询；
   */
  const onCreate = async (values: any) => {
    try {
      setCreating(true)
      const req: any = { providerId, payType: values.payType }
      if (values.mode === 'fiat') req.fiatAmount = String(values.fiatAmount)
      if (values.mode === 'memo') req.memoAmount = String(values.memoAmount)
      // returnUrl 便于支付页回跳后直接进入领取页（仅 UX）
      const p = pickProvider(providerId)
      req.returnUrl = `${location.origin}${location.pathname}#/otc/claim?provider=${encodeURIComponent(providerId)}`
      const draft = await createOrder(req)
      setOrder(draft)
      setStatus('pending')
      message.success('订单已创建，请扫码支付')
    } catch (e: any) {
      message.error(e?.message || '创建订单失败')
    } finally {
      setCreating(false)
    }
  }

  const remainSec = React.useMemo(() => {
    if (!order?.expired_at) return 0
    return Math.max(0, Number(order.expired_at) - nowSec)
  }, [order?.expired_at, nowSec])

  const paidOk = status === 'paid_confirmed' || status === 'authorized' || status === 'settled'

  const payUrl = order?.url || order?.pay_qr
  const qrImg = payUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payUrl)}` : ''

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={5}>购买 MEMO</Typography.Title>
      <Form form={form} layout="vertical" onFinish={onCreate} initialValues={{ mode: 'fiat', payType: 'alipay' }}>
        <Form.Item label="做市商" name="provider" initialValue={providerId}>
          <Select onChange={setProviderId} options={providerRegistry.map(p => ({ label: p.name, value: p.id }))} />
        </Form.Item>

        <Form.Item label="计价模式" name="mode">
          <Radio.Group>
            <Radio.Button value="fiat">按法币金额</Radio.Button>
            <Radio.Button value="memo">按 MEMO 数量</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item noStyle shouldUpdate>
          {() => {
            const mode = form.getFieldValue('mode')
            return (
              <>
                {mode === 'fiat' ? (
                  <Form.Item name="fiatAmount" label="法币金额" rules={[{ required: true }]}> 
                    <InputNumber min={1} precision={2} style={{ width: '100%' }} placeholder="输入法币金额" />
                  </Form.Item>
                ) : (
                  <Form.Item name="memoAmount" label="MEMO 数量" rules={[{ required: true }]}> 
                    <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="输入 MEMO 数量" />
                  </Form.Item>
                )}
              </>
            )
          }}
        </Form.Item>

        <Form.Item label="支付方式" name="payType" rules={[{ required: true }]}>
          <Select options={[{ value: 'alipay', label: '支付宝' }, { value: 'wechat', label: '微信支付' }]} />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={creating} block>创建订单</Button>
      </Form>

      {order && (
        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="订单号">{order.order_id}</Descriptions.Item>
              <Descriptions.Item label="购买MEMO">{order.memo_amount}</Descriptions.Item>
              <Descriptions.Item label="法币金额">{order.fiat_amount}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {paidOk ? <Tag color="green">{status}</Tag> : remainSec > 0 ? <Tag color="blue">{status}</Tag> : <Tag color="red">expired</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="有效期至">{dayjs((order.expired_at || 0) * 1000).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label="剩余时间">{remainSec}s</Descriptions.Item>
            </Descriptions>

            {payUrl && (
              <div style={{ textAlign: 'center' }}>
                {qrImg && <img src={qrImg} alt="支付二维码" style={{ width: 240, height: 240 }} />}
                <div style={{ marginTop: 8 }}>
                  <a href={payUrl} target="_blank" rel="noreferrer">若无法扫码，点击打开支付链接</a>
                </div>
              </div>
            )}

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" disabled={!paidOk} block href={`#/otc/claim?orderId=${encodeURIComponent(order.order_id)}&provider=${encodeURIComponent(providerId)}`}>
                支付已完成，前往领取
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </Card>
  )
}


