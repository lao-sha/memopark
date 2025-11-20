import React from 'react'
import { Card, Form, Input, InputNumber, Button, Space, message, Alert, Typography, Select } from 'antd'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：创建类目页面
 * - 支持创建一级类目（parent 为空）与二级类目（填写父类目ID）
 * - 使用 memoSacrifice.createCategory(name, parent?)
 */
const CreateCategoryPage: React.FC = () => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [primaries, setPrimaries] = React.useState<Array<{ id: number; name: string }>>([])

  // 函数级中文注释：加载一级类目列表，用于创建二级类目前选择父类目
  const loadPrimaries = React.useCallback(async () => {
    try {
      const api = await getApi()
      const qroot: any = (api.query as any)
      let q: any = qroot.memoSacrifice || qroot.memo_sacrifice || qroot.sacrifice
      if (!q?.categoryOf?.entries) {
        const fk = Object.keys(qroot).find(k => /memo[_-]?sacrifice|^sacrifice$/i.test(k))
        if (fk) q = qroot[fk]
      }
      let list: Array<{ id: number; name: string; parent?: number; level: number }>
        = []
      // 优先用 entries() 拉取全部
      const hexToBytes = (hex: string): Uint8Array => {
        const h = hex.startsWith('0x') ? hex.slice(2) : hex
        if (h.length % 2 !== 0) return new Uint8Array()
        const out = new Uint8Array(h.length / 2)
        for (let i=0;i<out.length;i++) out[i] = parseInt(h.slice(i*2, i*2+2), 16)
        return out
      }
      try {
        const entries = await q?.categoryOf?.entries?.()
        if (entries && entries.length > 0) {
          for (const [key, val] of entries) {
            const id = Number(key.args[0])
            let name = ''
            let parent: number | undefined = undefined
            let level = 1
            try {
              // 处理 Option 包装
              const opt = val as any
              if (opt && typeof opt.isSome === 'function') {
                if (!opt.isSome) { continue }
              }
              const inner = (opt && typeof opt.unwrap === 'function') ? opt.unwrap() : opt
              const v = inner?.toJSON?.() || inner
              if (Array.isArray(v)) {
                const raw = v[1]
                if (Array.isArray(raw)) name = new TextDecoder().decode(new Uint8Array(raw))
                else if (typeof raw === 'string') name = new TextDecoder().decode(hexToBytes(raw))
                parent = v[2] != null ? Number(v[2]) : undefined
                level = Number(v[3])
              }
            } catch {}
            list.push({ id, name, parent, level })
          }
        }
      } catch (e) { /* 忽略，走兜底 */ }
      // 兜底：若 entries 不可用或返回空，使用 nextCategoryId 逐个查询
      if (list.length === 0 && q?.nextCategoryId && q?.categoryOf) {
        try {
          const next = await q.nextCategoryId().then((x:any)=> x?.toNumber? x.toNumber() : Number(x))
          for (let i=0; i<next; i++) {
            const val = await q.categoryOf(i)
            if (!val || !val.isSome) continue
            let name = ''
            let parent: number | undefined = undefined
            let level = 1
            try {
              const v = (val.unwrap() as any).toJSON?.() || (val.unwrap() as any)
              if (Array.isArray(v)) {
                const raw = v[1]
                if (Array.isArray(raw)) name = new TextDecoder().decode(new Uint8Array(raw))
                else if (typeof raw === 'string') name = new TextDecoder().decode(hexToBytes(raw))
                parent = v[2] != null ? Number(v[2]) : undefined
                level = Number(v[3])
              }
            } catch {}
            list.push({ id: i, name, parent, level })
          }
        } catch (e) { console.warn('fallback load categories error', e) }
      }
      setPrimaries(list.filter(x=> x.level===1).map(x=> ({ id: x.id, name: x.name })))
    } catch (e) { console.warn('load primaries error', e) }
  }, [])

  React.useEffect(()=> { loadPrimaries() }, [loadPrimaries])

  const onSubmit = async (v: any) => {
    setError('')
    try {
      setSubmitting(true)
      const nameBytes = Array.from(new TextEncoder().encode(String(v.name||'')))
      const parent = v.parent==='' || v.parent==null ? null : Number(v.parent)
      const hash = await signAndSendLocalFromKeystore('memoSacrifice','createCategory',[nameBytes, parent])
      message.success('已提交创建类目：'+hash)
      form.resetFields()
    } catch (e:any) { setError(e?.message||'提交失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Card title="创建类目">
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Paragraph type="secondary">不填父类目则创建一级类目；填写父类目ID将创建二级类目。</Typography.Paragraph>
          <Form form={form} layout="vertical" onFinish={onSubmit}>
            <Form.Item name="name" label="类目名" rules={[{ required: true }]}>
              <Input placeholder="请输入类目名称" />
            </Form.Item>
            <Form.Item name="parent" label="选择父类目（留空创建一级类目）">
              <Select allowClear placeholder="选择一级类目作为父类目" options={primaries.map(p=> ({ label: `#${p.id} ${p.name}`, value: p.id }))} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting}>创建</Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default CreateCategoryPage


