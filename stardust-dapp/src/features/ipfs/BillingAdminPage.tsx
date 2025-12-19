import React from 'react'
import { Card, Space, Typography, InputNumber, Button, Alert, Form, Switch, message } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：IPFS 计费参数面板
 * - set_billing_params 部分更新：仅提交变更项
 * - charge_due(limit) 手动触发当期扣费处理
 * - 只读展示当前参数（可后续补充完整读取）
 */
const BillingAdminPage: React.FC = () => {
  const [form] = Form.useForm()
  const [limit, setLimit] = React.useState<number>(50)
  const [error, setError] = React.useState('')
  const sectionCandidates = ['memoIpfs','memo_ipfs','ipfs']

  const submitParams = async () => {
    try {
      const v = await form.validateFields()
      const api = await getApi()
      const txroot: any = api.tx as any
      let section: any
      for (const s of sectionCandidates) { if (txroot[s]) { section = txroot[s]; break } }
      if (!section) throw new Error('运行时未注册 memo-ipfs')
      const method = section.setBillingParams || section.set_billing_params
      if (!method) throw new Error('找不到 set_billing_params 方法')
      const args = [
        v.price_per_gib_week ?? null,
        v.period_blocks ?? null,
        v.grace_blocks ?? null,
        v.max_charge_per_block ?? null,
        v.subject_min_reserve ?? null,
        typeof v.paused === 'boolean' ? v.paused : null,
      ]
      const h = await signAndSendLocalFromKeystore(Object.keys(txroot).find(k=> txroot[k]===section)!, method.name, args)
      message.success('已提交参数更新：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  const runCharge = async () => {
    try {
      const api = await getApi()
      const txroot: any = api.tx as any
      let section: any
      for (const s of sectionCandidates) { if (txroot[s]) { section = txroot[s]; break } }
      if (!section) throw new Error('运行时未注册 memo-ipfs')
      const method = section.chargeDue || section.charge_due
      if (!method) throw new Error('找不到 charge_due 方法')
      const h = await signAndSendLocalFromKeystore(Object.keys(txroot).find(k=> txroot[k]===section)!, method.name, [limit])
      message.success('已提交扣费执行：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Card title="IPFS 计费参数">
        <Space direction="vertical" style={{ width:'100%' }} size={8}>
          {error && <Alert type="error" showIcon message={error} />}          
          <Form form={form} layout="vertical">
            <Form.Item label="price_per_gib_week (u128)" name="price_per_gib_week"><InputNumber style={{ width:'100%' }} min={1} /></Form.Item>
            <Form.Item label="period_blocks (u32)" name="period_blocks"><InputNumber style={{ width:'100%' }} min={1} /></Form.Item>
            <Form.Item label="grace_blocks (u32)" name="grace_blocks"><InputNumber style={{ width:'100%' }} min={1} /></Form.Item>
            <Form.Item label="max_charge_per_block (u32)" name="max_charge_per_block"><InputNumber style={{ width:'100%' }} min={1} /></Form.Item>
            <Form.Item label="subject_min_reserve (Balance)" name="subject_min_reserve"><InputNumber style={{ width:'100%' }} min={0} /></Form.Item>
            <Form.Item label="paused (bool)" name="paused" valuePropName="checked"><Switch /></Form.Item>
            <Space>
              <Button type="primary" onClick={submitParams}>提交参数</Button>
              <Space>
                <Typography.Text>charge_due limit</Typography.Text>
                <InputNumber min={1} max={500} value={limit} onChange={(v)=> setLimit((v as number)||0)} />
                <Button onClick={runCharge}>执行扣费</Button>
              </Space>
            </Space>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default BillingAdminPage


