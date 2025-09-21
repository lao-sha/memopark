import React, { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Row, Col, Typography, message, Space } from 'antd'
import { signAndSend } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { usePricing } from '../../hooks/usePricing'

/**
 * 函数级详细中文注释：吃单下单（移动端高保真）
 * - 页面结构：顶部标题栏 + 顶部提示 + 表单主体 + 底部固定提交按钮。
 * - 字段映射：otc-order::open_order（listing_id/price/qty/amount/payment_commit/contact_commit）。
 * - 交互：单列优先，小字段并列；底部固定 CTA 便于拇指操作。
 */
const OpenOrderForm: React.FC = () => {
  const wallet = useWallet()
  const [form] = Form.useForm()
  const [consts, setConsts] = useState<{ openWindow?: number; openMax?: number; paidWindow?: number; paidMax?: number } | null>(null)
  const { price, stale } = usePricing(10000)
  const [spreadBps, setSpreadBps] = useState<number | null>(null)
  const [estPrice, setEstPrice] = useState<bigint | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const api = await getApi()
        const openWindow = Number((api.consts as any).otcOrder?.openWindow || 0)
        const openMax = Number((api.consts as any).otcOrder?.openMaxInWindow || 0)
        const paidWindow = Number((api.consts as any).otcOrder?.paidWindow || 0)
        const paidMax = Number((api.consts as any).otcOrder?.paidMaxInWindow || 0)
        setConsts({ openWindow, openMax, paidWindow, paidMax })
      } catch {}
    })()
  }, [])

  // 当 listing_id 或链上价变化时，尝试读取该挂单的 spread_bps 并计算预计成交价
  useEffect(() => {
    const loadListing = async () => {
      try {
        const id = form.getFieldValue('listing_id')
        if (id === undefined || id === null || id === '') return
        const api = await getApi()
        const listing: any = await (api.query as any).otcListing.listings(id)
        const j = listing?.toJSON?.() as any
        const bps = Number(j?.pricing_spread_bps ?? j?.pricingSpreadBps ?? 0)
        setSpreadBps(Number.isFinite(bps) ? bps : null)
      } catch { setSpreadBps(null) }
    }
    loadListing()
  }, [form.getFieldValue('listing_id')])

  useEffect(() => {
    // 估算价格：base = floor(num/den)，exec = base * (1 + bps/10000)
    try {
      if (!price || !spreadBps && spreadBps !== 0) { setEstPrice(null); return }
      const num = BigInt(price.num.toString())
      const den = BigInt(price.den.toString() || '1')
      if (den === 0n) { setEstPrice(null); return }
      const base = num / den
      const exec = base + (base * BigInt(spreadBps!)) / 10000n
      setEstPrice(exec)
    } catch { setEstPrice(null) }
  }, [price, spreadBps])

  /**
   * 函数级详细中文注释：表单提交处理（占位）
   * - 未来：构造 RuntimeCall → MetaTx → forwarder.forward（平台代付）
   */
  const onFinish = async (values: any) => {
    try {
      // 前端操作方法：
      // - 直发：使用浏览器扩展签名执行 otcOrder.openOrder
      const owner = values.owner?.trim() || wallet.current
      if (!owner) throw new Error('请输入你的地址(owner) 或连接钱包')
      // 基本前端校验：数量与金额正数
      if (Number(values.qty) <= 0) throw new Error('数量需大于 0')
      if (Number(values.amount) <= 0) throw new Error('总价需大于 0')
      if (stale) throw new Error('链上价格已陈旧，请稍后重试')
      // 滑点保护：若用户填写 min/max 可接受价，与预计价比较
      if (estPrice !== null) {
        const minAcc = values.min_accept_price !== undefined && values.min_accept_price !== null && values.min_accept_price !== '' ? BigInt(values.min_accept_price) : null
        const maxAcc = values.max_accept_price !== undefined && values.max_accept_price !== null && values.max_accept_price !== '' ? BigInt(values.max_accept_price) : null
        if (minAcc !== null && estPrice < minAcc) throw new Error(`预计成交价 ${estPrice.toString()} 低于你的最小可接受价 ${minAcc.toString()}`)
        if (maxAcc !== null && estPrice > maxAcc) throw new Error(`预计成交价 ${estPrice.toString()} 高于你的最大可接受价 ${maxAcc.toString()}`)
      }
      const args = [
        Number(values.listing_id),
        BigInt(values.price),
        BigInt(values.qty),
        BigInt(values.amount),
        values.payment_commit,
        values.contact_commit,
      ]
      const txHash = await wallet.signAndSendLocal('otcOrder', 'openOrder', args)
      message.success(`已上链：${txHash}`)
      form.resetFields()
    } catch (e: any) {
      message.error(e?.message || '提交失败')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 88 }}>
      {/* 顶部标题栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>吃单下单</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      {/* 顶部提示 */}
      <div style={{ padding: '8px 8px 0' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="info" showIcon message="由平台代付 Gas（forwarder）" />
          {consts && (
            <Alert
              type="warning"
              showIcon
              message={<span>
                吃单限频：{consts.openWindow} 块窗口最多 {consts.openMax} 次；标记支付限频：{consts.paidWindow} 块最多 {consts.paidMax} 次
              </span>}
            />
          )}
        </Space>
      </div>

      {/* 表单主体 */}
      <div style={{ padding: 8 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="owner" label="你的地址(owner)" rules={[{ required: true }]}>
            <Input placeholder="5F..." size="large" />
          </Form.Item>
          <Form.Item name="listing_id" label="挂单ID(listing_id)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="price" label="价格(price)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="qty" label="数量(qty)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>
          {price && (
            <Alert 
              type={stale? 'warning':'info'} 
              showIcon 
              message={`链上价 ${price.num.toString()}/${price.den.toString()}（${stale?'已陈旧':'有效'}）`} 
              description={spreadBps !== null && estPrice !== null ? `预计成交价（含 spread ${spreadBps}bps）：${estPrice.toString()}` : undefined}
            />
          )}

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="min_accept_price" label="最小可接受价(可选)">
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_accept_price" label="最大可接受价(可选)">
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="amount" label="总价(amount)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Form.Item name="payment_commit" label="支付承诺(H256 hex)" rules={[{ required: true }]}>
            <Input placeholder="0x..." size="large" />
          </Form.Item>
          <Form.Item name="contact_commit" label="联系方式承诺(H256 hex)" rules={[{ required: true }]}>
            <Input placeholder="0x..." size="large" />
          </Form.Item>

          {/* 底部固定提交按钮 */}
          <Form.Item noStyle>
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #eee', padding: '8px 12px 16px', zIndex: 1000 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" htmlType="submit" block size="large" disabled={stale}>直发提交</Button>
                <Button onClick={()=>{
                  form.validateFields().then(async (values:any)=>{
                    const owner = values.owner?.trim() || wallet.current
                    if(!owner) throw new Error('请输入你的地址(owner) 或连接钱包')
                    const args = [ Number(values.listing_id), BigInt(values.price), BigInt(values.qty), BigInt(values.amount), values.payment_commit, values.contact_commit ]
                    const hash = await wallet.sendViaForwarder('otcOrder' as any, 'otcOrder', 'openOrder', args)
                    message.success(`已提交代付：${hash}`)
                  }).catch(()=>{})
                }} block size="large">代付提交</Button>
              </Space>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default OpenOrderForm


