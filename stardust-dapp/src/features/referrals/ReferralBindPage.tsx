import React, { useEffect, useMemo, useState } from 'react'
import { Card, Space, Typography, Input, Button, Alert, message } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { getCurrentAddress } from '../../lib/keystore'

/**
 * 函数级详细中文注释：推荐绑定落地页
 * - 解析 URL 中的 code 查询参数或手动输入的推荐码（8 位大写 HEX）
 * - 通过链上 `affiliate.codeToAccount(code_bytes)` 解析对应 sponsor 账户
 * - 如当前账户未绑定，则调用 `affiliate.bindWithCode(code_bytes)` 完成一次性绑定
 * - 绑定成功后引导回个人中心或展示成功提示
 * 
 * 🆕 2025-10-30 迁移: 从 pallet-stardust-referrals 迁移到 pallet-affiliate
 */
const ReferralBindPage: React.FC = () => {
  const [code, setCode] = useState<string>('')
  const [sponsor, setSponsor] = useState<string>('')
  const [current, setCurrent] = useState<string | null>(getCurrentAddress())
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'resolved' | 'bound'>('idle')
  const [error, setError] = useState<string>('')

  // 解析 hash 中的推荐码参数
  useEffect(() => {
    try {
      const h = window.location.hash || ''
      const qIdx = h.indexOf('?')
      if (qIdx >= 0) {
        const qs = new URLSearchParams(h.slice(qIdx + 1))
        const c = (qs.get('code') || '').trim()
        if (c) setCode(c)
      }
    } catch {}
  }, [])

  // 读取当前账户 Sponsor 绑定状态
  // 🆕 2025-10-30 迁移: 使用 affiliate.sponsorOf 替代 memoReferrals.sponsorOf
  const refreshBound = async (addr: string) => {
    try {
      const api = await getApi()
      const qroot: any = api.query as any
      const sec = qroot.affiliate
      if (!sec) {
        console.warn('affiliate pallet 未找到')
        return
      }
      const raw = await sec.sponsorOf(addr)
      if (raw && raw.isSome) {
        setStatus('bound')
      } else {
        if (status !== 'resolved') setStatus('idle')
      }
    } catch (e) {
      console.error('查询推荐人绑定状态失败:', e)
    }
  }

  useEffect(() => { if (current) refreshBound(current) }, [current])

  const normalizedCode = useMemo(() => (code || '').toUpperCase().replace(/[^0-9A-F]/g, ''), [code])

  // 🆕 2025-10-30 迁移: 使用 affiliate.codeToAccount 替代 memoReferrals.ownerOfCode
  const onResolve = async () => {
    try {
      setError('')
      setLoading(true)
      if (!normalizedCode || normalizedCode.length !== 8) throw new Error('请输入 8 位大写十六进制推荐码')
      const api = await getApi()
      const qroot: any = api.query as any
      const sec = qroot.affiliate
      if (!sec) {
        throw new Error('affiliate pallet 未找到，请确认链端配置')
      }
      const bytes = new TextEncoder().encode(normalizedCode)
      const raw = await sec.codeToAccount(bytes)
      if (!raw || raw.isNone) throw new Error('未找到该推荐码对应的上家')
      const who = raw.unwrap().toString()
      setSponsor(who)
      setStatus('resolved')
      message.success('已解析上家账户')
    } catch (e: any) {
      setError(e?.message || '解析失败')
      setSponsor('')
      setStatus('idle')
    } finally { setLoading(false) }
  }

  // 🆕 2025-10-30 迁移: 使用 affiliate.bindWithCode 替代 memoReferrals.bindSponsor
  const onBind = async () => {
    try {
      if (!current) return message.warning('请先选择账户')
      if (!sponsor) return message.warning('请先解析上家')
      if (!normalizedCode) return message.warning('推荐码不能为空')
      setLoading(true)
      const codeBytes = new TextEncoder().encode(normalizedCode)
      const hash = await signAndSendLocalFromKeystore('affiliate', 'bindWithCode', [codeBytes])
      message.success(`绑定已提交：${hash}`)
      setStatus('bound')
    } catch (e: any) {
      message.error(e?.message || '绑定失败')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 12, maxWidth: 414, margin: '0 auto' }}>
      <Card size="small" title="按码绑定上家（一次性）">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text>当前账户：<Typography.Text code>{current || '（未选择）'}</Typography.Text></Typography.Text>
          <Input
            value={code}
            onChange={(e)=> setCode(e.target.value)}
            placeholder="输入 8 位大写 HEX 推荐码"
            maxLength={8}
            disabled={status === 'bound'}
          />
          <Space>
            <Button onClick={onResolve} disabled={!code || status==='bound'} loading={loading}>解析上家</Button>
            <Button type="primary" onClick={onBind} disabled={!sponsor || status==='bound'} loading={loading}>绑定上家</Button>
            <Button onClick={()=> window.location.hash = '#/profile'}>返回个人中心</Button>
          </Space>
          {sponsor && <Alert type="success" showIcon message={<span>解析到上家：<Typography.Text code>{sponsor}</Typography.Text></span>} />}
          {status === 'bound' && <Alert type="info" showIcon message="您已绑定过上家，无法重复绑定" />}
          {error && <Alert type="error" showIcon message={error} closable onClose={()=> setError('')} />}
        </Space>
      </Card>
    </div>
  )
}

export default ReferralBindPage


