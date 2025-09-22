import React from 'react'
import { Alert, Button, Card, Divider, Form, Input, InputNumber, Space, Typography, message, Switch } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：恢复逝者旧版本（治理构建器，最小可用）
 * - 输入 DeceasedId 与旧值字段、证据CID，生成 utility.batchAll([...]) 预映像
 * - 通过 collective.Instance3 提案（2/3 门槛）来执行原子恢复
 * - 说明：索引侧自动回填旧值留作后续增强；当前以手动输入为主，保证最小落地
 */
const RestoreDeceasedBuilder: React.FC = () => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)

  const onSubmit = async (v: any) => {
    try {
      setSubmitting(true)
      const api = await getApi()
      // 构造 calls：止血(可选) → 恢复 → 解冻
      const ev = String(v.evidence_cid||'').trim()
      const id = Number(v.deceased_id)
      if (!id) { setSubmitting(false); return message.warning('请输入有效的 DeceasedId') }
      if (!ev) { setSubmitting(false); return message.warning('请输入 evidence_cid') }

      // 动态 section 解析
      const tx: any = api.tx as any
      const secDeceased = Object.keys(tx).find(k=>/deceased$/i.test(k) || /^deceased$/i.test(k))!
      const secUtil = Object.keys(tx).find(k=>/utility/i.test(k))!
      const secCollective = Object.keys(tx).find(k=>/collective/i.test(k))!

      const calls: any[] = []
      // 止血（可选）
      if (v.hide_first) calls.push(tx[secDeceased].govSetVisibility(id, false, ev))
      // 恢复基础信息（仅填的字段会生效）
      const name = v.name? Array.from(new TextEncoder().encode(String(v.name))): null
      const badge = v.name_badge? Array.from(new TextEncoder().encode(String(v.name_badge))): null
      const nameCid = v.name_full_cid? Array.from(new TextEncoder().encode(String(v.name_full_cid))): null
      const birth = v.birth_ts? Array.from(new TextEncoder().encode(String(v.birth_ts))): null
      const death = v.death_ts? Array.from(new TextEncoder().encode(String(v.death_ts))): null
      const links: number[][] | null = v.links ? String(v.links).split('\n').map((s:string)=> Array.from(new TextEncoder().encode(s.trim()))).filter((a:number[])=>a.length>0) : null
      const gender = v.gender_code != null ? Number(v.gender_code) : null
      if (name || badge || gender!=null || nameCid || birth || death || links) {
        calls.push(tx[secDeceased].govUpdateProfile(id, name, badge, gender, nameCid? nameCid: null, birth? birth: null, death? death: null, links, ev))
      }
      // 主图
      if (v.main_image_cid != null && String(v.main_image_cid).trim() !== '') {
        const mic = Array.from(new TextEncoder().encode(String(v.main_image_cid)))
        calls.push(tx[secDeceased].govSetMainImage(id, mic, ev))
      }
      // 解冻展示
      if (v.restore_public) calls.push(tx[secDeceased].govSetVisibility(id, true, ev))

      if (calls.length === 0) { setSubmitting(false); return message.warning('没有可提交的恢复操作') }

      // batchAll 打包
      const batched = tx[secUtil].batchAll(calls)
      // 提交到内容委员会（Instance3），2/3 阈值
      const threshold = 2
      const lengthBound = 100_000
      const hash = await signAndSendLocalFromKeystore(secCollective, 'propose', [threshold, batched, lengthBound])
      message.success(`已提交动议：${hash}`)
      form.resetFields()
    } catch (e:any) {
      message.error(e?.message || '提交失败')
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>恢复逝者旧版本（治理构建器）</Typography.Title>
      <Alert type="info" showIcon message="说明" description="输入旧版本字段与 evidence_cid，系统将构造 batchAll 并通过内容委员会（Instance3，2/3）发起动议。" />
      <Card size="small" style={{ marginTop: 12 }}>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label="DeceasedId" name="deceased_id" rules={[{ required: true, message: '必填' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="evidence_cid（明文CID）" name="evidence_cid" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="ipfs:// 或 CID" />
          </Form.Item>
          <Divider>基础信息（任填其一即可）</Divider>
          <Form.Item label="name" name="name"><Input /></Form.Item>
          <Form.Item label="name_badge" name="name_badge"><Input /></Form.Item>
          <Form.Item label="gender_code (0/1/2)" name="gender_code"><InputNumber min={0} max={2} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="name_full_cid" name="name_full_cid"><Input /></Form.Item>
          <Form.Item label="birth_ts (YYYYMMDD)" name="birth_ts"><Input maxLength={8} /></Form.Item>
          <Form.Item label="death_ts (YYYYMMDD)" name="death_ts"><Input maxLength={8} /></Form.Item>
          <Form.Item label="links（每行一个）" name="links"><Input.TextArea rows={4} placeholder="https://...\nipfs://..." /></Form.Item>
          <Divider>主图</Divider>
          <Form.Item label="main_image_cid（留空则不变）" name="main_image_cid"><Input /></Form.Item>
          <Divider>流程控制</Divider>
          <Form.Item name="hide_first" valuePropName="checked" initialValue={true} label="先临时隐藏（止血）">
            <Switch />
          </Form.Item>
          <Form.Item name="restore_public" valuePropName="checked" initialValue={true} label="恢复后重新公开">
            <Switch />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>提交动议（batchAll）</Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}

export default RestoreDeceasedBuilder
