import React, { useEffect, useMemo, useState } from 'react'
import { Card, Select, Typography, Space, List, Tag, Drawer, Form, InputNumber, Checkbox, Button, Alert, message } from 'antd'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'

/**
 * 函数级详细中文注释：用户端二级类目浏览
 * - 读取一级类目与其子类目
 * - 展示二级类目下的目录项 id 列表（使用 SacrificesBySecondary 索引）
 */
const CategoryBrowse: React.FC = () => {
  const [cats, setCats] = useState<Array<{ id: number; name: string; level: number }>>([])
  const [children, setChildren] = useState<Record<number, number[]>>({})
  const [secondary, setSecondary] = useState<number | null>(null)
  const [items, setItems] = useState<number[]>([])
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [buying, setBuying] = useState<boolean>(false)
  const [buyForm] = Form.useForm()
  const wallet = useWallet()
  const [exclusiveOk, setExclusiveOk] = useState<boolean>(true)
  const [computedPrice, setComputedPrice] = useState<number | null>(null)

  const loadCats = async () => {
    try {
      const api = await getApi()
      const entries = await (api.query as any).memoSacrifice?.categoryOf?.entries?.()
      const list: Array<{ id: number; name: string; level: number; parent?: number }> = []
      for (const [key, val] of entries) {
        const id = Number(key.args[0])
        const v = (val as any).toJSON?.() || (val as any)
        const name = Array.isArray(v) ? new TextDecoder().decode(new Uint8Array(v[1])) : ''
        const parent = Array.isArray(v) && v[2] != null ? Number(v[2]) : undefined
        const level = Array.isArray(v) ? Number(v[3]) : 1
        list.push({ id, name, level, parent })
      }
      setCats(list)
      const ch: Record<number, number[]> = {}
      for (const c of list.filter(x=>x.level===1)) {
        const v = await (api.query as any).memoSacrifice?.childrenByCategory?.(c.id)
        const arr = (v as any)?.toJSON?.() as number[] | undefined
        ch[c.id] = Array.isArray(arr)? arr.map(Number) : []
      }
      setChildren(ch)
    } catch {}
  }
  useEffect(() => { loadCats() }, [])

  const secondaries = useMemo(()=> Object.values(children).flat().map(id=> cats.find(c=>c.id===id)).filter(Boolean) as any[], [children, cats])

  const loadItems = async (sec: number) => {
    try {
      const api = await getApi()
      const v = await (api.query as any).memoSacrifice?.sacrificesBySecondary?.(sec)
      const arr = (v as any)?.toJSON?.() as number[] | undefined
      setItems(Array.isArray(arr)? arr.map(Number) : [])
    } catch {}
  }

  useEffect(() => { if (secondary!=null) loadItems(secondary) }, [secondary])

  const loadDetail = async (id: number) => {
    try {
      setLoading(true)
      const api = await getApi()
      const s = await (api.query as any).memoSacrifice?.sacrificeOf?.(id)
      const e = await (api.query as any).memoSacrifice?.effectOf?.(id)
      const sv = (s as any)?.toJSON?.()
      const ev = (e as any)?.toJSON?.()
      const decode = (u8arr?: any) => {
        try { return u8arr? new TextDecoder().decode(new Uint8Array(u8arr)) : '' } catch { return '' }
      }
      const parsed = sv ? {
        id,
        name: decode(sv.name),
        resourceUrl: decode(sv.resource_url),
        description: decode(sv.description),
        status: sv.status,
        vip: Boolean(sv.is_vip_exclusive),
        fixedPrice: sv.fixed_price ?? null,
        unitPricePerWeek: sv.unit_price_per_week ?? null,
        primaryCategoryId: sv.primary_category_id ?? null,
        secondaryCategoryId: sv.secondary_category_id ?? null,
        exclusive: Array.isArray(sv.exclusive_subjects)? sv.exclusive_subjects.map((x:any)=> [Number(x[0]), Number(x[1])]) : [],
      } : null
      setDetail({ spec: parsed, effect: ev || null })
    } catch (e) { setDetail(null) } finally { setLoading(false) }
  }

  useEffect(() => { if (open && activeId!=null) loadDetail(activeId) }, [open, activeId])

  /**
   * 函数级中文注释：URL 预填参数（hash 或 search）
   * - 支持：sacrifice（目录项ID）、domain、target
   * - 命中后自动打开详情抽屉并回填表单
   */
  useEffect(() => {
    try {
      const parse = (s: string) => {
        const qIdx = s.indexOf('?'); if (qIdx<0) return new URLSearchParams()
        return new URLSearchParams(s.slice(qIdx+1))
      }
      const params = new URLSearchParams(window.location.search)
      const hparams = parse(window.location.hash||'')
      const get = (k: string) => params.get(k) || hparams.get(k)
      const sac = get('sacrifice') || get('item')
      const dom = get('domain')
      const tgt = get('target') || get('targetId')
      if (sac) { const id = Number(sac); if (Number.isFinite(id)) { setActiveId(id); setOpen(true) } }
      const patch: any = {}
      if (dom!=null && dom!=='') patch.domain = Number(dom)
      if (tgt!=null && tgt!=='') patch.targetId = Number(tgt)
      if (Object.keys(patch).length>0) buyForm.setFieldsValue(patch)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onBuy = async (v:any) => {
    try {
      if (activeId == null) return
      const domain = Number(v.domain)
      const targetId = Number(v.targetId)
      if (!Number.isFinite(domain) || !Number.isFinite(targetId)) return message.error('请输入有效的 domain / targetId')
      // 未命中专属限制禁止提交
      if (!exclusiveOk) return message.warning('未命中专属限制，无法提交')
      setBuying(true)
      const media: any[] = []
      const duration = v.duration==='' || v.duration==null ? null : Number(v.duration)
      const isVip = Boolean(v.isVip)
      const txHash = await signAndSendLocalFromKeystore('memoOfferings', 'offerBySacrifice', [[domain, targetId], Number(activeId), media, duration, isVip])
      message.success(`已提交购买 (${txHash})`)
      try {
        const rec = { ts: Date.now(), who: wallet.current, sacrificeId: activeId, domain, targetId, duration, isVip, txHash, confirmed: false }
        const key = 'offeringsOrders'
        const arr = JSON.parse(localStorage.getItem(key) || '[]')
        arr.unshift(rec)
        localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)))
        // 订阅若干区块内的事件，标记 confirmed
        const api = await getApi()
        let count = 0
        const unsub = await (api.rpc as any).chain.subscribeFinalizedHeads(async (head:any) => {
          try {
            count++
            const events = await (api.query as any).system.events()
            for (const ev of events) {
              const sect = ev.event.section;
              const method = ev.event.method;
              if (sect === 'memoOfferings' && method === 'OfferingCommittedBySacrifice') {
                const args:any = ev.event.data
                const sac = Number(args[2])
                const who = String(args[3])
                if (sac === activeId && (!wallet.current || who === wallet.current)) {
                  const raw = JSON.parse(localStorage.getItem(key) || '[]')
                  const idx = raw.findIndex((r:any)=> r.txHash === txHash)
                  if (idx >= 0) { raw[idx].confirmed = true; localStorage.setItem(key, JSON.stringify(raw)); message.success('购买已上链确认') }
                  if (unsub) unsub()
                  break
                }
              }
            }
            if (count > 10 && unsub) { unsub() }
          } catch {}
        })
        // eslint-disable-next-line @typescript-eslint/no-empty-function
      } catch {}
      buyForm.resetFields()
    } catch (e:any) { message.error(e?.message || '购买失败') } finally { setBuying(false) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4} style={{ textAlign: 'left' }}>二级类目浏览</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card size="small">
          <div style={{ textAlign: 'left', marginBottom: 8 }}>选择二级类目</div>
          <Select
            value={secondary as any}
            onChange={(v)=> setSecondary(Number(v))}
            options={secondaries.map((s:any)=> ({ value: s.id, label: `${s.name} #${s.id}` }))}
            style={{ width: '100%' }}
            placeholder="请选择"
          />
        </Card>
        <Card size="small" title="目录项">
          <List
            dataSource={items}
            renderItem={(id)=> (
              <List.Item>
                <Space onClick={()=>{ setActiveId(id); setOpen(true) }} style={{ cursor: 'pointer' }}>
                  <Tag color="blue">#{id}</Tag>
                  <span>目录项</span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Space>
      <Drawer open={open} onClose={()=> setOpen(false)} title={`目录项 #${activeId ?? ''}`} placement="bottom" height={'80%'}>
        <div style={{ textAlign: 'left' }}>
          {loading ? '加载中…' : (
            detail? (
              <div>
                <div style={{ marginBottom: 6 }}><b>名称</b>：{detail.spec?.name || '-'}</div>
                <div style={{ marginBottom: 6 }}><b>资源</b>：{detail.spec?.resourceUrl || '-'}</div>
                <div style={{ marginBottom: 6 }}><b>描述</b>：{detail.spec?.description || '-'}</div>
                <div style={{ marginBottom: 6 }}><b>定价</b>：{detail.spec?.fixedPrice!=null? `固定 ${detail.spec.fixedPrice}` : (detail.spec?.unitPricePerWeek!=null? `每周 ${detail.spec.unitPricePerWeek}` : '未设置')}</div>
                <div style={{ marginBottom: 6 }}><b>类目</b>：P#{detail.spec?.primaryCategoryId ?? '-'} / S#{detail.spec?.secondaryCategoryId ?? '-'}</div>
                <div style={{ marginBottom: 6 }}><b>VIP</b>：{detail.spec?.vip? '是' : '否'}</div>
                <div style={{ marginTop: 12 }}>
                  <b>效果元数据</b>：{detail.effect? JSON.stringify(detail.effect) : '无'}
                </div>
                <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px dashed #eee' }}>
                  <Typography.Title level={5}>立即购买</Typography.Title>
                  <Alert type="info" showIcon style={{ marginBottom: 8 }} message={detail.spec?.fixedPrice!=null ? `应付金额：${detail.spec.fixedPrice}` : (detail.spec?.unitPricePerWeek!=null ? 'Timed 规格需填写“时长(周)”，应付=单价×时长' : '未设置定价，将按链上最小金额校验')} />
                  {Array.isArray(detail.spec?.exclusive) && detail.spec.exclusive.length>0 && (
                    <Alert type={exclusiveOk? 'success':'warning'} showIcon style={{ marginBottom: 8 }}
                      message={exclusiveOk? '当前目标命中专属限制' : '未命中专属限制，链上将拒绝'}
                      description={`专属目标: ${detail.spec.exclusive.map((x:any)=>`(${x[0]},${x[1]})`).join(' , ')}`} />
                  )}
                  <Form form={buyForm} layout="vertical" onFinish={onBuy} initialValues={{ domain: 1, isVip: false }}>
                    <Space style={{ display: 'flex', flexWrap: 'wrap' }}>
                      <Form.Item name="domain" label="domain(u8)" rules={[{ required: true }]}>
                        <InputNumber min={0} style={{ width: 120 }} onChange={(v)=>{
                          const dom = Number(v||0)
                          const tid = Number(buyForm.getFieldValue('targetId'))
                          const ex = detail?.spec?.exclusive || []
                          setExclusiveOk(ex.length===0 || ex.some((p:any)=> p[0]===dom && p[1]===tid))
                          // 价格动态：固定价保持不变；按周价依赖 duration
                          const unit = detail?.spec?.unitPricePerWeek
                          if (detail?.spec?.fixedPrice!=null) setComputedPrice(Number(detail.spec.fixedPrice))
                          else if (unit!=null) {
                            const dur = Number(buyForm.getFieldValue('duration')||0)
                            setComputedPrice(dur>0? Number(unit)*dur : null)
                          } else setComputedPrice(null)
                        }} />
                      </Form.Item>
                      <Form.Item name="targetId" label="target_id(u64)" rules={[{ required: true }]}>
                        <InputNumber min={0} style={{ width: 180 }} onChange={(v)=>{
                          const dom = Number(buyForm.getFieldValue('domain'))
                          const tid = Number(v||0)
                          const ex = detail?.spec?.exclusive || []
                          setExclusiveOk(ex.length===0 || ex.some((p:any)=> p[0]===dom && p[1]===tid))
                          const unit = detail?.spec?.unitPricePerWeek
                          if (detail?.spec?.fixedPrice!=null) setComputedPrice(Number(detail.spec.fixedPrice))
                          else if (unit!=null) {
                            const dur = Number(buyForm.getFieldValue('duration')||0)
                            setComputedPrice(dur>0? Number(unit)*dur : null)
                          } else setComputedPrice(null)
                        }} />
                      </Form.Item>
                      {detail.spec?.unitPricePerWeek!=null && (
                        <Form.Item name="duration" label="时长(周)" rules={[{ required: true, message: '必填' }]}>
                          <InputNumber min={1} style={{ width: 140 }} onChange={(v)=>{
                            const unit = detail?.spec?.unitPricePerWeek
                            const dur = Number(v||0)
                            setComputedPrice(unit!=null && dur>0 ? Number(unit)*dur : null)
                          }} />
                        </Form.Item>
                      )}
                      <Form.Item name="isVip" valuePropName="checked" label="VIP">
                        <Checkbox />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={buying} disabled={!exclusiveOk}>提交购买</Button>
                      </Form.Item>
                    </Space>
                  </Form>
                  {computedPrice!=null && (
                    <div style={{ marginTop: 8, color: '#333' }}>预计应付金额：<b>{computedPrice}</b></div>
                  )}
                </div>
              </div>
            ) : '未找到详情'
          )}
        </div>
      </Drawer>
    </div>
  )
}

export default CategoryBrowse


