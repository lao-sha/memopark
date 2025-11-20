import React, { useEffect, useState } from 'react'
import { Card, Switch, Space, Typography, message, InputNumber, Button } from 'antd'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：供奉暂停配置（全局/按域）管理表单
 * - 读取 storage：PausedGlobal / PausedByDomain(domain)
 * - 提供开关：set_pause_global(paused) / set_pause_domain(domain, paused)
 * - 设计为移动端优先，最大宽度 640 居中
 */
const AdminPause: React.FC = () => {
  const [globalPaused, setGlobalPaused] = useState<boolean>(false)
  const [domain, setDomain] = useState<number>(1)
  const [domainPaused, setDomainPaused] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)

  const load = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      const g = await (api.query as any).memoOfferings?.pausedGlobal?.()
      setGlobalPaused(Boolean(g?.toPrimitive?.() ?? g?.isTrue ?? false))
      const d = await (api.query as any).memoOfferings?.pausedByDomain?.(domain)
      setDomainPaused(Boolean(d?.toPrimitive?.() ?? d?.isTrue ?? false))
    } catch (e) { console.warn('load pause failed', e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { (async()=>{ try{ const api = await getApi(); const d = await (api.query as any).memoOfferings?.pausedByDomain?.(domain); setDomainPaused(Boolean(d?.toPrimitive?.() ?? d?.isTrue ?? false)) }catch{}})() }, [domain])

  const setGlobal = async (val: boolean) => {
    try {
      setSaving(true)
      const txHash = await signAndSendLocalFromKeystore('memoOfferings', 'setPauseGlobal', [val])
      message.success(`全局暂停已更新：${val} (${txHash})`)
      setGlobalPaused(val)
    } catch (e: any) { message.error(e?.message || '设置失败'); await load() } finally { setSaving(false) }
  }
  const setDom = async (val: boolean) => {
    try {
      setSaving(true)
      const txHash = await signAndSendLocalFromKeystore('memoOfferings', 'setPauseDomain', [Number(domain), val])
      message.success(`域 ${domain} 暂停已更新：${val} (${txHash})`)
      setDomainPaused(val)
    } catch (e: any) { message.error(e?.message || '设置失败'); await load() } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4} style={{ textAlign: 'left' }}>供奉暂停配置</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card size="small" title="全局暂停">
          <Space>
            <span>PausedGlobal</span>
            <Switch checked={globalPaused} onChange={setGlobal} disabled={loading||saving} />
          </Space>
        </Card>
        <Card size="small" title="按域暂停">
          <Space>
            <span>domain</span>
            <InputNumber min={0} value={domain} onChange={(v)=> setDomain(Math.max(0, Number(v||0)))} disabled={saving} />
            <Switch checked={domainPaused} onChange={setDom} disabled={loading||saving} />
            <Button onClick={load} loading={loading} disabled={saving}>刷新</Button>
          </Space>
        </Card>
      </Space>
    </div>
  )
}

export default AdminPause


