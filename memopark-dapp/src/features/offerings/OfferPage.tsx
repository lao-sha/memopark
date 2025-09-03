import React, { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Typography, message, Space } from 'antd'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'
import { getApi, signAndSend } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'

/**
 * 函数级详细中文注释：供奉下单（链上直发）
 * 前端操作方法：
 * - 填写 target=(domain,id)、kind、amount、duration、media(CID+commit 可选)
 * - 点击提交后用浏览器插件签名直发
 */
const OfferPage: React.FC = () => {
  const wallet = useWallet()
  const [form] = Form.useForm()
  const [params, setParams] = useState<{ min?: string; window?: number; max?: number } | null>(null)
  useEffect(() => { (async()=>{ try{ const api = await getApi(); const min = ((api.consts as any).memoOfferings?.minOfferAmount||0n).toString(); const window = Number((api.consts as any).memoOfferings?.offerWindow||0); const max = Number((api.consts as any).memoOfferings?.offerMaxInWindow||0); setParams({ min, window, max }); }catch{}})() }, [])
  const [pricing, setPricing] = useState<{ fixed?: string|null; unit?: string|null } | null>(null)
  const loadPricing = async (kind: number) => {
    try{
      const api = await getApi()
      const fp = await (api.query as any).memoOfferings?.fixedPriceOf?.(kind)
      const up = await (api.query as any).memoOfferings?.unitPricePerWeekOf?.(kind)
      setPricing({ fixed: fp?.isSome? fp.unwrap().toString() : null, unit: up?.isSome? up.unwrap().toString() : null })
    }catch{}
  }
  const onFinish = async (v:any) => {
    try {
      const address = v.owner?.trim() || wallet.current
      if (!address) throw new Error('缺少地址(owner) 或未连接钱包')
      const api = await getApi()
      const media = [] as any[]
      const args = [
        [Number(v.domain), Number(v.target_id)],
        Number(v.kind_code),
        v.amount? BigInt(v.amount) : null,
        media,
        v.duration? Number(v.duration) : null,
      ] as any[]
      const txHash = await signAndSend(address, 'memoOfferings', 'offer', args)
      message.success(`已上链：${txHash}`)
      form.resetFields()
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 88 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>供奉下单</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>
      <div style={{ padding: '8px 8px 0' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="info" showIcon message="此页采用链上直发；高频明细/排行由 Subsquid 查询。" />
          {params && <Alert type="warning" showIcon message={`最小供奉金额 ${params.min}；限频窗口 ${params.window} 块, 最多 ${params.max} 次`} />}
        </Space>
      </div>
      <div style={{ padding: 8 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ domain: 1 }}>
          <Form.Item name="owner" label="你的地址(owner)" rules={[{ required: true }]}>
            <Input placeholder="5F..." size="large" />
          </Form.Item>
          <Form.Item name="domain" label="domain(u8)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Form.Item name="target_id" label="target_id(u64)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Form.Item name="kind_code" label="kind_code(u8)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" onChange={(v)=>{ if(v!=null) loadPricing(Number(v)) }} />
          </Form.Item>
          <Form.Item name="amount" label="金额(amount, 可选)" >
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Form.Item name="duration" label="时长(周, Timed 可选)" >
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>
          {pricing && (
            <Alert type="info" showIcon message={`定价：${pricing.fixed?`固定 ${pricing.fixed}`:''}${pricing.unit?` 每周 ${pricing.unit}`:''}` || '该规格未设置定价'} />
          )}
          <Form.Item>
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #eee', padding: '8px 12px 16px', zIndex: 1000 }}>
              <Button type="primary" htmlType="submit" block size="large">提交</Button>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default OfferPage


