import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, Typography, Alert, Space, Divider, message, Modal } from 'antd'
import { getApi } from '../../lib/polkadot'
import { getCurrentAddress } from '../../lib/keystore'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：创建墓地（Grave）表单
 * - 依赖 memoGrave.createGrave(park_id: u32, kind: u8, visibility_bits: u32, slug: Vec<u8>)
 * - 仅演示：slug 从 name 简单生成（小写+连字符），visibility 由复选框合并位
 */
const CreateGraveForm: React.FC = () => {
  const [decimals, setDecimals] = useState<number>(12)
  const [symbol, setSymbol] = useState<string>('UNIT')
  const [error, setError] = useState<string>('')
  const [hash, setHash] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  useEffect(()=>{ (async()=>{ try{ const api = await getApi(); setDecimals(api.registry.chainDecimals?.[0]??12); setSymbol((api.registry.chainTokens?.[0] as string)||'UNIT') }catch{}})() },[])

  const pwdOpenRef = useRef<{ resolve?: (v: string)=>void; reject?: (e: any)=>void }>({})
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdVal, setPwdVal] = useState('')
  const waitPassword = () => new Promise<string>((resolve, reject) => { pwdOpenRef.current.resolve=resolve; pwdOpenRef.current.reject=reject; setPwdVal(''); setPwdOpen(true) })

  // 允许中文：按照 UTF-8 字节长度限制截断，不做 ASCII 转换
  const MAX_SLUG_BYTES = 10
  const encodeUtf8BytesLimited = (text: string, limit: number): number[] => {
    const enc = new TextEncoder()
    const out: number[] = []
    let used = 0
    for (const ch of text.trim()) {
      const bytes = Array.from(enc.encode(ch))
      if (used + bytes.length > limit) break
      out.push(...bytes)
      used += bytes.length
    }
    return out
  }

  const onSubmit = async (v: any) => {
    setError(''); setHash(''); setSubmitting(true)
    try{
      const parkId = Number(v.park_id || 0)
      const kind = Number(v.kind || 0)
      const vis = Number(v.visibility || 0)
      const name = String(v.name || '')
      const slug = encodeUtf8BytesLimited(name, MAX_SLUG_BYTES)
      if (slug.length === 0) throw new Error('请填写名称')
      // 动态解析 section：兼容 runtime 重命名（例如 MemoGrave -> Grave）
      const api = await getApi()
      const sections = Object.keys((api.tx as any) || {})
      const candidates = ['memoGrave','grave','memo_grave']
      let section: string | null = null
      for (const s of [...candidates, ...sections]) {
        const mod = (api.tx as any)[s]
        if (mod && typeof mod.createGrave === 'function') { section = s; break }
      }
      if (!section) {
        console.error('未找到包含 createGrave 的模块。可用模块：', sections)
        throw new Error('链上未找到 memoGrave.createGrave（或 Grave.createGrave）。请确认 runtime 导出的模块名。')
      }
      const pwd = await waitPassword()
      const txHash = await signAndSendLocalWithPassword(section,'createGrave',[parkId, kind, vis, slug], pwd)
      setHash(txHash)
      message.success('已提交创建墓地')
      form.resetFields()
      window.dispatchEvent(new Event('mp.refreshBalances'))
    }catch(e:any){
      if (e?.message === 'USER_CANCELLED') message.info('已取消签名')
      else setError(e?.message || '提交失败')
    }finally{ setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="创建墓地">
        {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}
        {hash && <Alert type="success" showIcon style={{ marginBottom: 12 }} message={`已提交：${hash}`} />}
        <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ kind: 0, visibility: 0 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="逝者姓名或墓地标题" />
          </Form.Item>
          <Form.Item label="园区ID(可选)" name="park_id">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="类型(kind)" name="kind">
            <InputNumber min={0} max={255} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="可见性(位掩码)" name="visibility" tooltip="按位组合，如 1=访客可留言, 2=访客可供奉...">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>创建墓地</Button>
          </Space>
        </Form>
        <Modal
          open={pwdOpen}
          onCancel={()=>{ setPwdOpen(false); pwdOpenRef.current.reject?.(new Error('USER_CANCELLED')) }}
          onOk={()=>{ if (!pwdVal || pwdVal.length<8){ message.error('密码不足 8 位'); return } setPwdOpen(false); pwdOpenRef.current.resolve?.(pwdVal) }}
          okText="签名"
          cancelText="取消"
          title="输入签名密码"
          centered
        >
          <Input.Password placeholder="至少 8 位" value={pwdVal} onChange={e=> setPwdVal(e.target.value)} />
        </Modal>
        <Divider />
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          提示：名称支持中文。slug 将由名称按 UTF-8 编码并在 {MAX_SLUG_BYTES} 字节处安全截断；可见性位用于前端/索引层策略展示，链上按位存储。
        </Typography.Paragraph>
      </Card>
    </div>
  )
}

export default CreateGraveForm


