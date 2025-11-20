import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { Card, Descriptions, InputNumber, Button, Space, message } from 'antd'

/**
 * 函数级详细中文注释：纪念馆可见性与关注信息查看面板
 * - 读取链上 `memoGrave.visibilityPolicyOf(graveId)` 与 `memoGrave.followersOf(graveId)`
 * - 展示四个公开策略位（供奉/留言/扫墓/关注）与当前关注者数量
 * - 仅查询读取，不涉及任何隐私信息或资金安全
 * - 适配移动端（最大宽度 640px 居中）
 */
export default function PolicyViewer() {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [graveId, setGraveId] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [policy, setPolicy] = useState<any | null>(null)
  const [followersCount, setFollowersCount] = useState<number>(0)

  const ensureApi = useCallback(async () => {
    if (api) return api
    const provider = new WsProvider('ws://127.0.0.1:9944')
    const apiNew = await ApiPromise.create({ provider })
    setApi(apiNew)
    return apiNew
  }, [api])

  const load = useCallback(async (id: number) => {
    const api = await ensureApi()
    try {
      setLoading(true)
      const p = await (api.query as any).memoGrave.visibilityPolicyOf(id)
      const f = await (api.query as any).memoGrave.followersOf(id)
      setPolicy(p?.toJSON?.() ?? p)
      setFollowersCount(Array.isArray(f) ? f.length : (f?.length?.toNumber?.() ?? (f?.length ?? 0)))
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '查询失败')
    } finally {
      setLoading(false)
    }
  }, [ensureApi])

  useEffect(() => { load(graveId) }, [])

  const items = useMemo(() => ([
    { key: 'po', label: '公开供奉', children: String(!!policy?.publicOffering || !!policy?.public_offering) },
    { key: 'pg', label: '公开留言', children: String(!!policy?.publicGuestbook || !!policy?.public_guestbook) },
    { key: 'ps', label: '公开扫墓', children: String(!!policy?.publicSweep || !!policy?.public_sweep) },
    { key: 'pf', label: '公开关注', children: String(!!policy?.publicFollow || !!policy?.public_follow) },
    { key: 'fc', label: '关注人数', children: followersCount },
  ]), [policy, followersCount])

  return (
    <Card title='纪念馆策略/关注' style={{ maxWidth: 480, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <span>Grave ID:</span>
        <InputNumber min={0} value={graveId} onChange={(v) => setGraveId(Number(v))} />
        <Button type='primary' onClick={() => load(graveId)} loading={loading}>查询</Button>
      </Space>
      <Descriptions column={1} bordered items={items as any} />
    </Card>
  )
}


