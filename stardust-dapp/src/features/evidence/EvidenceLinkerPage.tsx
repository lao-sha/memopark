import React from 'react'
import { Card, Space, Typography, InputNumber, Button, Alert, Form, Input, message, Tabs } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：Evidence 链接器
 * - link(domain,target_id,id) / unlink(domain,target_id,id)
 * - link_by_ns(ns,subject_id,id) / unlink_by_ns(ns,subject_id,id)
 * - 适配运行时 section 命名（evidence/pallet_evidence/memoEvidence）与驼峰/下划线方法
 */
const EvidenceLinkerPage: React.FC = () => {
  const [form] = Form.useForm()
  const [error, setError] = React.useState('')
  const sectionCandidates = ['evidence','pallet_evidence','memoEvidence']

  const detectSection = (root: any): any => {
    for (const s of sectionCandidates) { if (root[s]) return { sec: root[s], name: s } }
    return { sec: null, name: '' }
  }

  const send = async (kind: 'link'|'unlink'|'link_by_ns'|'unlink_by_ns') => {
    try {
      const v = await form.validateFields()
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 evidence')
      let method: any
      if (kind==='link') method = sec.link || sec.link
      if (kind==='unlink') method = sec.unlink || sec.unlink
      if (kind==='link_by_ns') method = sec.linkByNs || sec.link_by_ns
      if (kind==='unlink_by_ns') method = sec.unlinkByNs || sec.unlink_by_ns
      if (!method) throw new Error('找不到方法')
      let args: any[] = []
      if (kind==='link' || kind==='unlink') { args = [v.domain, v.target_id, v.id] }
      else { args = [v.ns, v.subject_id, v.id] }
      const h = await signAndSendLocalFromKeystore(name, method.name, args)
      message.success('已提交：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>Evidence 链接器</Typography.Title>
        <Card size="small">
          <Tabs
            items={[
              {
                key: 'by-id', label: '按目标链接',
                children: (
                  <Form form={form} layout="vertical">
                    <Form.Item label="domain(u8)" name="domain" rules={[{ required: true }]}><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
                    <Form.Item label="target_id(u64)" name="target_id" rules={[{ required: true }]}><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
                    <Form.Item label="evidence id(u64)" name="id" rules={[{ required: true }]}><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
                    <Space>
                      <Button type="primary" onClick={()=> send('link')}>link</Button>
                      <Button danger onClick={()=> send('unlink')}>unlink</Button>
                    </Space>
                  </Form>
                )
              },
              {
                key: 'by-ns', label: '按命名空间链接',
                children: (
                  <Form form={form} layout="vertical">
                    <Form.Item label="ns([u8;8] hex或字符串)" name="ns" rules={[{ required: true }]}>
                      <Input placeholder="例如: 0x656e... 或 8字节字符串" />
                    </Form.Item>
                    <Form.Item label="subject_id(u64)" name="subject_id" rules={[{ required: true }]}><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
                    <Form.Item label="evidence id(u64)" name="id" rules={[{ required: true }]}><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
                    <Space>
                      <Button type="primary" onClick={()=> send('link_by_ns')}>link_by_ns</Button>
                      <Button danger onClick={()=> send('unlink_by_ns')}>unlink_by_ns</Button>
                    </Space>
                  </Form>
                )
              }
            ]}
          />
        </Card>
      </Space>
    </div>
  )
}

export default EvidenceLinkerPage
