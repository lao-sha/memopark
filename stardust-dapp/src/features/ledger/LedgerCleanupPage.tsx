import React from 'react'
import { Card, Space, Typography, InputNumber, Button, Alert, Form, Input, message } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：Ledger 清理面板
 * - 提供 purge_weeks 与 purge_weeks_by_range 两种清理方式
 * - 需要指定 grave_id、who、周编号参数与 limit；移动端优先布局
 * - 兼容 section 名称（ledger/pallet_ledger/graveLedger/memoLedger）与方法名驼峰/下划线
 */
const LedgerCleanupPage: React.FC = () => {
  const [form] = Form.useForm()
  const [error, setError] = React.useState('')
  const sectionCandidates = ['ledger','pallet_ledger','graveLedger','memoLedger']

  const detectSection = (root: any): any => {
    for (const s of sectionCandidates) { if (root[s]) return { sec: root[s], name: s } }
    return { sec: null, name: '' }
  }

  const purgeWeeks = async () => {
    try {
      const v = await form.validateFields(['grave_id','who','before_week','limit'])
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 Ledger')
      const method = sec.purgeWeeks || sec.purge_weeks
      if (!method) throw new Error('找不到 purge_weeks 方法')
      const args = [v.grave_id, v.who, v.before_week, v.limit]
      const h = await signAndSendLocalFromKeystore(name, method.name, args)
      message.success('已提交按 before_week 清理：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  const purgeRange = async () => {
    try {
      const v = await form.validateFields(['grave_id','who','start_week','end_week','limit2'])
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 Ledger')
      const method = sec.purgeWeeksByRange || sec.purge_weeks_by_range
      if (!method) throw new Error('找不到 purge_weeks_by_range 方法')
      const args = [v.grave_id, v.who, v.start_week, v.end_week, v.limit2]
      const h = await signAndSendLocalFromKeystore(name, method.name, args)
      message.success('已提交按区间清理：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>Ledger 清理</Typography.Title>
        <Card size="small" title="按 before_week 清理">
          <Form form={form} layout="vertical">
            <Form.Item label="grave_id (u64)" name="grave_id" rules={[{ required: true }]}><InputNumber style={{ width:'100%' }} min={0} /></Form.Item>
            <Form.Item label="who (AccountId)" name="who" rules={[{ required: true }]}><Input placeholder="账户地址" /></Form.Item>
            <Form.Item label="before_week (u32)" name="before_week" rules={[{ required: true }]}><InputNumber style={{ width:'100%' }} min={0} /></Form.Item>
            <Form.Item label="limit (u32)" name="limit" initialValue={50}><InputNumber style={{ width:'100%' }} min={1} max={1000} /></Form.Item>
            <Button type="primary" onClick={purgeWeeks}>提交</Button>
          </Form>
        </Card>
        <Card size="small" title="按区间清理 [start,end)">
          <Form form={form} layout="vertical">
            <Form.Item label="grave_id (u64)" name="grave_id" rules={[{ required: true }]}><InputNumber style={{ width:'100%' }} min={0} /></Form.Item>
            <Form.Item label="who (AccountId)" name="who" rules={[{ required: true }]}><Input placeholder="账户地址" /></Form.Item>
            <Form.Item label="start_week (u32)" name="start_week" rules={[{ required: true }]}><InputNumber style={{ width:'100%' }} min={0} /></Form.Item>
            <Form.Item label="end_week (u32)" name="end_week" rules={[{ required: true }]}><InputNumber style={{ width:'100%' }} min={0} /></Form.Item>
            <Form.Item label="limit (u32)" name="limit2" initialValue={50}><InputNumber style={{ width:'100%' }} min={1} max={1000} /></Form.Item>
            <Button onClick={purgeRange}>提交</Button>
          </Form>
        </Card>
      </Space>
    </div>
  )
}

export default LedgerCleanupPage
