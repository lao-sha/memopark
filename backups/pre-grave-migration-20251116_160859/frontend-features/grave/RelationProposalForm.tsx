import React, { useCallback, useEffect, useState } from 'react'
import { Card, Form, Input, InputNumber, Select, Button, message, Alert } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：逝者关系绑定的最小申请表单
 * - 输入：from_deceased_id, to_deceased_id, kind, note，可选账户地址
 * - 提交：调用 deceased.proposeRelation
 */
export default function RelationProposalForm() {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const provider = new WsProvider('ws://127.0.0.1:9944')
      const api = await ApiPromise.create({ provider })
      setApi(api)
    })()
  }, [])

  const onFinish = useCallback(async (v: any) => {
    if (!api) return
    if (!account) return message.warning('请输入签名账户')
    try {
      setLoading(true)
      const note = v.note ? Array.from(new TextEncoder().encode(v.note)) : null
      await signAndSendLocalFromKeystore('deceased','proposeRelation',[v.fromId, v.toId, v.kind, note])
      message.success('已提交'); setLoading(false)
    } catch (e: any) { console.error(e); message.error(e?.message || '提交失败'); setLoading(false) }
  }, [api, account])

  return (
    <Card style={{ maxWidth: 480, margin: '0 auto' }}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message="亲友团申请：当检测到同样的 deceased_token 已存在时，可在此发起族谱绑定，加入对方的亲友团。" />
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="签名账户地址" required>
          <Input value={account} onChange={e => setAccount(e.target.value)} placeholder="SS58 地址" />
        </Form.Item>
        <Form.Item name="fromId" label="From DeceasedId" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="toId" label="To DeceasedId" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="kind" label="关系类型" rules={[{ required: true }]}>
          <Select options={[
            { value: 0, label: 'ParentOf（有向）' },
            { value: 1, label: 'SpouseOf（无向）' },
            { value: 2, label: 'SiblingOf（无向）' },
            { value: 3, label: 'Other' },
          ]} />
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input placeholder="可选" maxLength={128} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>提交关系申请</Button>
      </Form>
    </Card>
  )
}


