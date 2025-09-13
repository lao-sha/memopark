import React, { useCallback, useState } from 'react'
import { Button, Flex, Modal, Form, InputNumber, Select, message, Input } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { mapDispatchErrorMessage } from '../../lib/errors'

/**
 * 函数级详细中文注释：纪念馆动作栏（花圈/蜡烛/清香/供品/扫墓）最小实现
 * - 供奉：调用 memoOfferings.offer((1,graveId), kind_code, amount, [], duration?)
 * - 扫墓：调用 graveGuestbook.sweep(graveId, null)
 * - 关注：调用 memoGrave.follow(graveId)
 * - 取消关注：调用 memoGrave.unfollow(graveId)
 */
export default function ActionsBar({ graveId }: { graveId: number }) {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [account, setAccount] = useState('')
  const [openOffer, setOpenOffer] = useState(false)
  const [openSweep, setOpenSweep] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingFollow, setLoadingFollow] = useState(false)

  const ensureApi = useCallback(async () => {
    if (api) return api
    const provider = new WsProvider('ws://127.0.0.1:9944')
    const apiNew = await ApiPromise.create({ provider })
    setApi(apiNew)
    return apiNew
  }, [api])

  const onOffer = useCallback(async (v: any) => {
    const api = await ensureApi()
    if (!account) return message.warning('请输入签名账户')
    try {
      setLoading(true)
      const target = [1, graveId]
      const amount = BigInt(v.amount)
      const duration = v.kind === 12 || v.kind === 13 ? Number(v.duration || 1) : null
      await signAndSendLocalFromKeystore('memoOfferings','offer',[target, v.kind, amount, [], duration])
      message.success('供奉已上链'); setLoading(false); setOpenOffer(false)
    } catch (e: any) { console.error(e); message.error(mapDispatchErrorMessage(e, '提交失败')); setLoading(false) }
  }, [ensureApi, account, graveId])

  const onSweep = useCallback(async () => {
    const api = await ensureApi()
    if (!account) return message.warning('请输入签名账户')
    try {
      setLoading(true)
      await signAndSendLocalFromKeystore('memoGraveGuestbook','sweep',[graveId, null])
      message.success('已记录扫墓'); setLoading(false); setOpenSweep(false)
    } catch (e: any) { console.error(e); message.error(mapDispatchErrorMessage(e, '提交失败')); setLoading(false) }
  }, [ensureApi, account, graveId])

  /**
   * 函数级详细中文注释：关注纪念馆
   * - 若开启 public_follow，则任意签名账户可关注；否则需成员
   */
  const onFollow = useCallback(async () => {
    // 方案B：墓位关注已停用，提示用户前往“亲友团”（以逝者为主体）
    message.info('墓位关注已停用，请前往“亲友团”在逝者下加入。')
    window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'friends' } }))
  }, [])

  /**
   * 函数级详细中文注释：取消关注纪念馆
   */
  const onUnfollow = useCallback(async () => {
    message.info('墓位关注已停用，无需取消；请使用“亲友团”管理关系。')
  }, [])

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Input placeholder='签名账户地址' value={account} onChange={e => setAccount(e.target.value)} style={{ width: '100%' }} />
      <Flex gap={8}>
        <Button onClick={() => setOpenOffer(true)}>供奉</Button>
        <Button onClick={() => setOpenSweep(true)}>扫墓</Button>
        <Button onClick={onFollow} loading={loadingFollow}>亲友团</Button>
      </Flex>
      <Modal open={openOffer} onCancel={() => setOpenOffer(false)} onOk={() => {}} footer={null} title='供奉'>
        <Form layout='vertical' onFinish={onOffer}>
          <Form.Item name='kind' label='供奉项' initialValue={11} rules={[{ required: true }]}>
            <Select options={[
              { value: 11, label: '花圈 WREATH' },
              { value: 12, label: '蜡烛 CANDLE' },
              { value: 13, label: '清香 INCENSE' },
              { value: 14, label: '果品 FRUIT' },
              { value: 19, label: '自定义 CUSTOM' },
            ]} />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => (getFieldValue('kind') === 12 || getFieldValue('kind') === 13) ? (
              <Form.Item name='duration' label='时长（周）' initialValue={1}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            ) : null}
          </Form.Item>
          <Form.Item name='amount' label='金额（最小单位）' rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Button type='primary' htmlType='submit' loading={loading} block>确认供奉</Button>
        </Form>
      </Modal>
      <Modal open={openSweep} onCancel={() => setOpenSweep(false)} onOk={onSweep} confirmLoading={loading} title='扫墓'>
        <p>记录一次清扫/维护（免费，受限频）。</p>
      </Modal>
    </div>
  )
}


