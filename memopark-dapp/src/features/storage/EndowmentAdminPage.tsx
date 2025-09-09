import React, { useCallback, useState } from 'react'
import { Card, Tabs, Form, Input, InputNumber, Button, Switch, message } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：基金会治理与风控最小管理页（仅 Root 测试环境用）
 * - 设置暂停、SLA 阈值、陈旧度、年度预算、黑名单、代理收款、本金→收益划转
 * - 安全：该页仅用于演示；生产请通过治理流程而非前端直调
 */
export default function EndowmentAdminPage() {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)

  const ensureApi = useCallback(async () => {
    if (api) return api
    const provider = new WsProvider('ws://127.0.0.1:9944')
    const apiNew = await ApiPromise.create({ provider })
    setApi(apiNew)
    return apiNew
  }, [api])

  const signSend = useCallback(async (tx: any) => {
    await ensureApi()
    if (!account) { message.warning('请输入 Root 账户'); throw new Error('no account') }
    setLoading(true)
    try {
      await signAndSendLocalFromKeystore(tx.section, tx.method, tx.args)
      message.success('已上链')
    } catch (e: any) {
      console.error(e); message.error(e?.message || '提交失败')
    } finally { setLoading(false) }
  }, [ensureApi, account])

  return (
    <Card title='基金会治理/风控（演示）' style={{ maxWidth: 640, margin: '0 auto' }}>
      <Input placeholder='Root 签名账户地址' value={account} onChange={e => setAccount(e.target.value)} style={{ marginBottom: 12 }} />
      <Tabs
        items={[
          {
            key: 'pause', label: '暂停/恢复', children: (
              <Form layout='vertical' onFinish={async (v) => {
                const api = await ensureApi();
                const tx = (api.tx as any).memoEndowment.setPaused(Boolean(v.on))
                await signSend(tx)
              }}>
                <Form.Item name='on' label='暂停' initialValue={false}><Switch /></Form.Item>
                <Button type='primary' htmlType='submit' loading={loading} block>提交</Button>
              </Form>
            )
          },
          {
            key: 'sla', label: 'SLA/陈旧度', children: (
              <Form layout='vertical' onFinish={async (v) => {
                const api = await ensureApi();
                const tx1 = (api.tx as any).memoEndowment.setMinSla(Number(v.minSlaParts || 0))
                await signSend(tx1)
                const tx2 = (api.tx as any).memoEndowment.setMaxSlaStaleBlocks(Number(v.maxStale || 0))
                await signSend(tx2)
              }}>
                <Form.Item name='minSlaParts' label='最低 SLA（Permill parts，0..1_000_000）' initialValue={0}>
                  <InputNumber min={0} max={1_000_000} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name='maxStale' label='最长未上报区块数' initialValue={0}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Button type='primary' htmlType='submit' loading={loading} block>提交</Button>
              </Form>
            )
          },
          {
            key: 'annual', label: '年度预算', children: (
              <Form layout='vertical' onFinish={async (v) => {
                const api = await ensureApi();
                const tx = (api.tx as any).memoEndowment.setAnnualBudget(Number(v.year), BigInt(v.maxBudget))
                await signSend(tx)
              }}>
                <Form.Item name='year' label='年度' rules={[{ required: true }]} initialValue={2025}><InputNumber min={2024} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name='maxBudget' label='年度预算上限（最小单位）' rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Button type='primary' htmlType='submit' loading={loading} block>提交</Button>
              </Form>
            )
          },
          {
            key: 'schedule', label: '定时结算', children: (
              <Form layout='vertical' onFinish={async (v) => {
                const api = await ensureApi();
                const id = (v.id || 'endowment-epoch').toString()
                const when = Number(v.when)
                const period = Number(v.period || 0)
                const count = Number(v.count || 0)
                const budget = BigInt(v.budget)
                const call = (api.tx as any).memoEndowment.closeEpochAndPay(budget)
                const maybePeriodic = period > 0 && count > 0 ? { frequency: period, repeat: count } : null
                const tx = (api.tx as any).scheduler.scheduleNamed(id, when, maybePeriodic, 127, call)
                await signSend(tx)
              }}>
                <Form.Item name='id' label='任务 ID' initialValue='endowment-epoch'><Input /></Form.Item>
                <Form.Item name='when' label='起始区块' rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name='period' label='周期（区块）' initialValue={0}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name='count' label='次数' initialValue={0}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name='budget' label='单次预算（最小单位）' rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Button type='primary' htmlType='submit' loading={loading} block>安排任务</Button>
              </Form>
            )
          },
          {
            key: 'blacklist', label: '黑名单', children: (
              <Form layout='vertical' onFinish={async (v) => {
                const api = await ensureApi();
                const tx = (api.tx as any).memoEndowment.setBlacklist(v.operator, Boolean(v.on))
                await signSend(tx)
              }}>
                <Form.Item name='operator' label='运营者账户' rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name='on' label='加入黑名单' initialValue={true}><Switch /></Form.Item>
                <Button type='primary' htmlType='submit' loading={loading} block>提交</Button>
              </Form>
            )
          },
          {
            key: 'recipient', label: '代理收款', children: (
              <Form layout='vertical' onFinish={async (v) => {
                const api = await ensureApi();
                const tx = (api.tx as any).memoEndowment.setPayoutRecipient(v.operator, v.recipient || null)
                await signSend(tx)
              }}>
                <Form.Item name='operator' label='运营者账户' rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name='recipient' label='代理收款账户（留空为删除）'><Input /></Form.Item>
                <Button type='primary' htmlType='submit' loading={loading} block>提交</Button>
              </Form>
            )
          },
          {
            key: 'funds', label: '本金→收益', children: (
              <Form layout='vertical' onFinish={async (v) => {
                const api = await ensureApi();
                const tx = (api.tx as any).memoEndowment.transferPrincipalToYield(BigInt(v.amount))
                await signSend(tx)
              }}>
                <Form.Item name='amount' label='划转金额（最小单位）' rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Button type='primary' htmlType='submit' loading={loading} block>提交</Button>
              </Form>
            )
          },
        ]}
      />
    </Card>
  )
}


