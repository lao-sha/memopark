import React, { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, message } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：存储下单最小实现表单
 * - 允许用户输入 `cid_hash`（十六进制 H256）、大小（字节）、副本数、一次性价格（MEMO 单位的最小单位）。
 * - 使用本地 keystore 签名并发送，调用 `memoIpfs.requestPin` extrinsic。
 * - 仅作 MVP 示例：未做价格预估/校验，cid_hash 也未在前端计算。
 */
export default function RequestPinForm() {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [account, setAccount] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const init = useCallback(async () => {
    const provider = new WsProvider('ws://127.0.0.1:9944')
    const api = await ApiPromise.create({ provider })
    setApi(api)
  }, [])

  useEffect(() => { init() }, [init])

  const onFinish = useCallback(async (values: any) => {
    if (!api) return
    if (!account) return message.warning('请先输入签名账户地址（SS58）')
    try {
      setLoading(true)
      const { cidHashHex, sizeBytes, replicas, price } = values
      const cidHash = cidHashHex
      await signAndSendLocalFromKeystore('memoIpfs','requestPin',[cidHash, sizeBytes, replicas, price])
      message.success('已提交交易')
      setLoading(false)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '提交失败')
      setLoading(false)
    }
  }, [api, account])

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="签名账户地址（SS58）" required>
          <Input placeholder="请输入你的账户地址" value={account} onChange={e => setAccount(e.target.value)} />
        </Form.Item>
        <Form.Item name="cidHashHex" label="cid_hash（0x 开头 H256）" rules={[{ required: true }]}>
          <Input placeholder="例如 0x1234..." />
        </Form.Item>
        <Form.Item name="sizeBytes" label="大小（字节）" initialValue={1024} rules={[{ required: true }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="replicas" label="副本数" initialValue={3} rules={[{ required: true }]}>
          <InputNumber min={1} max={9} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="price" label="一次性价格（最小单位）" initialValue={1000000000000} rules={[{ required: true }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>提交存储订单</Button>
      </Form>
    </Card>
  )
}


