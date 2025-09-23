import React from 'react'
import { Card, Space, Typography, InputNumber, Button, Alert, Form, Input, message, Switch } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：墓位治理工具
 * - 封装 memo-grave 的治理接口：gov_transfer_grave / gov_remove_grave / gov_restore_grave / gov_set_restricted
 * - 统一 evidence_cid 输入（明文 CID，确保不加密）
 * - 动态探测 section 名称（memoGrave/memo_grave/grave）与驼峰/下划线方法
 */
const GraveGovernanceToolsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [error, setError] = React.useState('')
  const sectionCandidates = ['memoGrave','memo_grave','grave']

  const detectSection = (root: any): any => {
    for (const s of sectionCandidates) { if (root[s]) return { sec: root[s], name: s } }
    return { sec: null, name: '' }
  }

  const run = async (kind: 'transfer'|'remove'|'restore'|'restrict') => {
    try {
      const v = await form.validateFields()
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 memo-grave')
      let method: any, args: any[] = []
      if (kind==='transfer') { method = sec.govTransferGrave || sec.gov_transfer_grave; args = [v.id, v.new_owner, v.evidence_cid] }
      if (kind==='remove') { method = sec.govRemoveGrave || sec.gov_remove_grave; args = [v.id, v.reason_code, v.evidence_cid] }
      if (kind==='restore') { method = sec.govRestoreGrave || sec.gov_restore_grave; args = [v.id, v.evidence_cid] }
      if (kind==='restrict') { method = sec.govSetRestricted || sec.gov_set_restricted; args = [v.id, !!v.on, v.reason_code, v.evidence_cid] }
      if (!method) throw new Error('找不到方法')
      const h = await signAndSendLocalFromKeystore(name, method.name, args)
      message.success('已提交：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>墓位治理工具</Typography.Title>
        <Card size="small" title="参数">
          <Form form={form} layout="vertical">
            <Form.Item label="grave id(u64)" name="id" rules={[{ required: true }]}><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
            <Form.Item label="new_owner(AccountId)" name="new_owner"><Input placeholder="仅用于转让" /></Form.Item>
            <Form.Item label="reason_code(u8)" name="reason_code"><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
            <Form.Item label="evidence_cid(CID 明文，不加密)" name="evidence_cid" rules={[{ required: true }]}>
              <Input placeholder="bafy..." />
            </Form.Item>
            <Form.Item label="受限开关" name="on" valuePropName="checked"><Switch /></Form.Item>
            <Space wrap>
              <Button type="primary" onClick={()=> run('transfer')}>治理转让</Button>
              <Button danger onClick={()=> run('remove')}>治理移除</Button>
              <Button onClick={()=> run('restore')}>治理恢复</Button>
              <Button onClick={()=> run('restrict')}>设置受限</Button>
            </Space>
          </Form>
        </Card>
      </Space>
    </div>
  )
}

export default GraveGovernanceToolsPage
