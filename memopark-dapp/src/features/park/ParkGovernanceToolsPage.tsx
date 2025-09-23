import React from 'react'
import { Card, Space, Typography, InputNumber, Button, Alert, Form, Input, message, Switch } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：园区治理工具
 * - 封装 memo-park 的治理接口：gov_update_park / gov_set_park_admin / gov_set_park_cover / gov_transfer_park
 * - 统一 evidence_cid 输入（明文 CID，确保不加密）
 * - 动态探测 section 名称（memoPark/memo_park/park）与驼峰/下划线方法
 */
const ParkGovernanceToolsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [error, setError] = React.useState('')
  const sectionCandidates = ['memoPark','memo_park','park']

  const detectSection = (root: any): any => {
    for (const s of sectionCandidates) { if (root[s]) return { sec: root[s], name: s } }
    return { sec: null, name: '' }
  }

  const run = async (kind: 'update'|'set_admin'|'set_cover'|'transfer') => {
    try {
      const v = await form.validateFields()
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 memo-park')
      let method: any, args: any[] = []
      if (kind==='update') {
        method = sec.govUpdatePark || sec.gov_update_park
        args = [v.id, v.region_code || null, v.metadata_cid || null, typeof v.active==='boolean'? v.active : null, v.evidence_cid]
      }
      if (kind==='set_admin') {
        method = sec.govSetParkAdmin || sec.gov_set_park_admin
        args = [v.id, v.admin_group ?? null, v.evidence_cid]
      }
      if (kind==='set_cover') {
        method = sec.govSetParkCover || sec.gov_set_park_cover
        args = [v.id, v.cover_cid || null, v.evidence_cid]
      }
      if (kind==='transfer') {
        method = sec.govTransferPark || sec.gov_transfer_park
        args = [v.id, v.new_owner, v.evidence_cid]
      }
      if (!method) throw new Error('找不到方法')
      const h = await signAndSendLocalFromKeystore(name, method.name, args)
      message.success('已提交：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>园区治理工具</Typography.Title>
        <Card size="small" title="参数">
          <Form form={form} layout="vertical">
            <Form.Item label="park id(u64)" name="id" rules={[{ required: true }]}><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
            <Form.Item label="region_code(Bytes 可选)" name="region_code"><Input placeholder="可留空" /></Form.Item>
            <Form.Item label="metadata_cid(CID 可选)" name="metadata_cid"><Input placeholder="可留空" /></Form.Item>
            <Form.Item label="active(bool 可选)" name="active" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item label="admin_group(u64 可选)" name="admin_group"><InputNumber min={0} style={{ width:'100%' }} /></Form.Item>
            <Form.Item label="cover_cid(CID 可选)" name="cover_cid"><Input placeholder="可留空" /></Form.Item>
            <Form.Item label="new_owner(AccountId)" name="new_owner"><Input placeholder="仅用于转让" /></Form.Item>
            <Form.Item label="evidence_cid(CID 明文，不加密)" name="evidence_cid" rules={[{ required: true }]}>
              <Input placeholder="bafy..." />
            </Form.Item>
            <Space wrap>
              <Button type="primary" onClick={()=> run('update')}>治理更新</Button>
              <Button onClick={()=> run('set_admin')}>设置管理员</Button>
              <Button onClick={()=> run('set_cover')}>设置封面</Button>
              <Button onClick={()=> run('transfer')}>治理转让</Button>
            </Space>
          </Form>
        </Card>
      </Space>
    </div>
  )
}

export default ParkGovernanceToolsPage
