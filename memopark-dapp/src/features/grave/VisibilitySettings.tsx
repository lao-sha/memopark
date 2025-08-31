import React, { useCallback, useState } from 'react'
import { Button, Form, InputNumber, Switch, message, Input, Card } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { web3Enable, web3FromAddress } from '@polkadot/extension-dapp'

/**
 * 函数级详细中文注释：可见性设置最小实现页面
 * - 作用：调用 memoGrave.setVisibility(graveId, public_offering, public_guestbook, public_sweep, public_follow)
 * - 适用：墓主/园区管理员才能成功执行；普通用户调用将被链上拒绝
 * - 隐私与安全：不涉及明文个人隐私数据；仅写入策略位到链上
 */
export default function VisibilitySettings() {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)

  const ensureApi = useCallback(async () => {
    if (api) return api
    const provider = new WsProvider('ws://127.0.0.1:9944')
    const apiNew = await ApiPromise.create({ provider })
    await web3Enable('memopark-dapp')
    setApi(apiNew)
    return apiNew
  }, [api])

  const onSubmit = useCallback(async (v: any) => {
    const api = await ensureApi()
    if (!account) return message.warning('请输入签名账户')
    try {
      setLoading(true)
      const injector = await web3FromAddress(account)
      const tx = (api.tx as any).memoGrave.setVisibility(
        Number(v.graveId),
        Boolean(v.public_offering),
        Boolean(v.public_guestbook),
        Boolean(v.public_sweep),
        Boolean(v.public_follow),
      )
      const unsub = await tx.signAndSend(account, { signer: injector.signer }, ({ status, dispatchError }: any) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule)
            message.error(`${decoded.section}.${decoded.name}`)
          } else message.error(dispatchError.toString())
          setLoading(false); unsub()
        }
        if (status.isFinalized) { message.success('策略已更新'); setLoading(false); unsub() }
      })
    } catch (e: any) { console.error(e); message.error(e?.message || '提交失败'); setLoading(false) }
  }, [ensureApi, account])

  return (
    <Card title='纪念馆可见性设置' style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <Input placeholder='签名账户地址' value={account} onChange={e => setAccount(e.target.value)} />
      </div>
      <Form layout='vertical' onFinish={onSubmit} initialValues={{ graveId: 1, public_offering: true, public_guestbook: false, public_sweep: false, public_follow: true }}>
        <Form.Item name='graveId' label='Grave ID' rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name='public_offering' label='公开供奉'>
          <Switch />
        </Form.Item>
        <Form.Item name='public_guestbook' label='公开留言'>
          <Switch />
        </Form.Item>
        <Form.Item name='public_sweep' label='公开扫墓'>
          <Switch />
        </Form.Item>
        <Form.Item name='public_follow' label='公开关注'>
          <Switch />
        </Form.Item>
        <Button type='primary' htmlType='submit' loading={loading} block>保存</Button>
      </Form>
    </Card>
  )
}


