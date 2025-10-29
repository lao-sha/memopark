import React, { useCallback, useEffect, useState } from 'react'
import { Card, Form, Input, InputNumber, Select, Button, message } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：成员声明与逝者关系的最小表单
 * - 输入：grave_id, deceased_id, 关系 code, 备注，可选账户地址
 * - 提交：调用 memoGrave.declareKinship
 */
export default function KinshipForm() {
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
      await signAndSendLocalFromKeystore('memoGrave','declareKinship',[v.graveId, v.deceasedId, v.code, note])
      message.success('已提交'); setLoading(false)
    } catch (e: any) { console.error(e); message.error(e?.message || '提交失败'); setLoading(false) }
  }, [api, account])

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="签名账户地址" required>
          <Input value={account} onChange={e => setAccount(e.target.value)} placeholder="SS58 地址" />
        </Form.Item>
        <Form.Item name="graveId" label="GraveId" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="deceasedId" label="DeceasedId" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="code" label="关系（KinshipCode）" rules={[{ required: true }]}>
          <Select options={[
            { value: 1, label: '父亲 Father' },
            { value: 2, label: '母亲 Mother' },
            { value: 3, label: '儿子 Son' },
            { value: 4, label: '女儿 Daughter' },
            { value: 5, label: '哥哥 OlderBrother' },
            { value: 6, label: '弟弟 YoungerBrother' },
            { value: 7, label: '姐姐 OlderSister' },
            { value: 8, label: '妹妹 YoungerSister' },
            { value: 9, label: '配偶 Spouse' },
            { value: 12, label: '亲属 Relative' },
            { value: 13, label: '朋友 Friend' },
          ]} />
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input placeholder="可选" maxLength={128} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>提交关系声明</Button>
      </Form>
    </Card>
  )
}


