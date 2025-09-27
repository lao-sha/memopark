import React, { useState } from 'react'
import { Button, Card, Form, Input, Typography, message, Select } from 'antd'
import { authorizeClaim } from '../../lib/otc-adapter'
import { getApi, signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { providerRegistry } from '../../lib/providers'

/**
 * 函数级详细中文注释：OTC 领取表单组件（支持多提供方选择）
 */
export default function ClaimMemoForm() {
  const [loading, setLoading] = useState(false)
  const [auth, setAuth] = useState<any>(null)
  const [providerId, setProviderId] = useState<string | undefined>(providerRegistry[0]?.id)
  const [form] = Form.useForm()

  // URL 预填：支持从 #/otc/claim?orderId=..&provider=.. 预填
  React.useEffect(() => {
    try {
      const q = new URLSearchParams((location.hash.split('?')[1] || ''))
      const orderId = q.get('orderId') || ''
      const provider = q.get('provider') || ''
      if (orderId) form.setFieldsValue({ orderId })
      if (provider) setProviderId(provider)
    } catch {}
  }, [])

  const onGetAuth = async (values: any) => {
    try {
      setLoading(true)
      const a = await authorizeClaim(values.orderId, values.beneficiary, providerId)
      setAuth(a)
      message.success('已获取领取授权，请继续提交链上交易')
    } catch (e: any) {
      message.error(e?.message || '获取授权失败')
    } finally { setLoading(false) }
  }

  const onClaim = async (values: any) => {
    if (!auth) return message.warning('请先获取授权')
    try {
      setLoading(true)
      await getApi() // 仅确保连接
      const args = [
        auth.issuer_account,
        auth.order_id,
        values.beneficiary,
        auth.amount_memo,
        auth.deadline_block,
        auth.nonce,
        auth.signature,
      ]
      const hash = await signAndSendLocalWithPassword('OtcClaim', 'claim', args, values.password)
      message.success('领取提交成功，Tx: ' + hash)
    } catch (e: any) {
      message.error(e?.message || '领取提交失败')
    } finally { setLoading(false) }
  }

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={5}>领取 MEMO</Typography.Title>
      <Form form={form} layout="vertical" onFinish={onGetAuth}>
        <Form.Item name="provider" label="做市商" initialValue={providerId}>
          <Select onChange={setProviderId} options={providerRegistry.map(p => ({ label: p.name, value: p.id }))} />
        </Form.Item>
        <Form.Item name="orderId" label="订单号" rules={[{ required: true }]}>
          <Input placeholder="输入订单号" allowClear />
        </Form.Item>
        <Form.Item name="beneficiary" label="收款地址" rules={[{ required: true }]}>
          <Input placeholder="Polkadot/Substrate 地址" allowClear />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>获取授权</Button>
        </Form.Item>
      </Form>

      {auth && (
        <Form layout="vertical" onFinish={onClaim}>
          <Form.Item name="password" label="本地钱包密码" rules={[{ required: true, min: 8 }]}>
            <Input.Password placeholder="至少 8 位" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>提交链上领取</Button>
        </Form>
      )}
    </Card>
  )
}


