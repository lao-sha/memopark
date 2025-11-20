import React, { useEffect, useState } from 'react'
import { Card, Form, InputNumber, Select, Button, Space, Typography, message } from 'antd'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：目录效果管理（设置/清除）
 * - set_effect(id, Some((consumable, target_domain, effect_kind, effect_value, cooldown_secs, inventory_mint)))
 * - set_effect(id, None) → 清除
 */
const AdminEffect: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState<any>(null)

  const fetchEffect = async (id: number) => {
    try {
      const api = await getApi()
      const v = await (api.query as any).memoSacrifice?.effectOf?.(id)
      setCurrent(v?.toJSON?.() ?? null)
    } catch {}
  }

  const onFinish = async (v:any) => {
    try {
      if (!Number.isFinite(Number(v.id))) { return message.error('目录项ID必须为数字') }
      setSubmitting(true)
      const id = Number(v.id)
      if (v.clear === true) {
        const tx = await signAndSendLocalFromKeystore('memoSacrifice', 'setEffect', [id, null])
        message.success(`已清除效果 (${tx})`)
        setCurrent(null)
        return
      }
      if (v.domain==null || v.kind==null) { return message.error('请填写目标域与效果种类') }
      const tuple = [Boolean(v.consumable), Number(v.domain), Number(v.kind), Number(v.value||0), Number(v.cooldown||0), Boolean(v.mint)]
      const tx = await signAndSendLocalFromKeystore('memoSacrifice', 'setEffect', [id, tuple])
      message.success(`已设置效果 (${tx})`)
      await fetchEffect(id)
    } catch (e:any) { message.error(e?.message || '提交失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4} style={{ textAlign: 'left' }}>目录效果管理</Typography.Title>
      <Card size="small">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="id" label="目录项ID(u64)" rules={[{ required: true, message: '必填' }]}>
            <InputNumber min={0} style={{ width: '100%' }} onChange={(v)=>{ if(v!=null) fetchEffect(Number(v)) }} disabled={submitting} />
          </Form.Item>
          <Space align="start" style={{ display: 'flex', width: '100%' }}>
            <Form.Item name="consumable" label="一次性" initialValue={true}><Select options={[{value:true,label:'true'},{value:false,label:'false'}]} disabled={submitting} /></Form.Item>
            <Form.Item name="domain" label="目标域" rules={[{ required: true, message: '必填' }]}><InputNumber min={0} disabled={submitting} /></Form.Item>
            <Form.Item name="kind" label="效果种类" rules={[{ required: true, message: '必填' }]}><InputNumber min={0} disabled={submitting} /></Form.Item>
            <Form.Item name="value" label="效果值"><InputNumber disabled={submitting} /></Form.Item>
            <Form.Item name="cooldown" label="冷却(秒/块)"><InputNumber min={0} disabled={submitting} /></Form.Item>
            <Form.Item name="mint" label="入库偏好" initialValue={false}><Select options={[{value:true,label:'true'},{value:false,label:'false'}]} disabled={submitting} /></Form.Item>
          </Space>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>设置</Button>
            <Button danger onClick={()=>{ const id = Number(form.getFieldValue('id')); if(Number.isFinite(id)) onFinish({ id, clear: true }) }} disabled={submitting}>清除</Button>
          </Space>
        </Form>
      </Card>
      <div style={{ marginTop: 12, textAlign: 'left' }}>当前效果：{current? JSON.stringify(current) : '无'}</div>
    </div>
  )
}

export default AdminEffect


