import React from 'react'
import { Alert, Button, Card, Divider, Form, Input, InputNumber, Space, Typography, message, Statistic } from 'antd'
import SubjectAccountAddress from '../../components/SubjectAccountAddress'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { blake2AsU8a, encodeAddress } from '@polkadot/util-crypto'
import { u8aConcat, hexToU8a, stringToU8a } from '@polkadot/util'

/**
 * 函数级详细中文注释：逝者存储 Pin 向导（两步法，弱耦合）
 * - 步骤1（资金准备）：展示派生“主题资金账户”推导规则与充值提示（不链上派生，不读取余额）
 * - 步骤2（提交 Pin）：优先调用 memoIpfs.requestPinForDeceased(subject_id, ...)；若不存在则回退 memoIpfs.requestPin(...)
 * - 说明：链上仅存 cid_hash（明文 CID 不上链），遵循“CID 不加密”的项目规则；OCW 负责 hash↔CID 本地映射
 */
const DeceasedPinWizard: React.FC = () => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)
  const [section, setSection] = React.useState<string>('memoIpfs')
  const [hasForDeceased, setHasForDeceased] = React.useState(false)
  const [balance, setBalance] = React.useState<bigint | null>(null)
  const [billing, setBilling] = React.useState<{ next: bigint, unit: bigint, state: number } | null>(null)
  const [estimateWeeks, setEstimateWeeks] = React.useState<number | null>(null)
  const [derivedAddr, setDerivedAddr] = React.useState<string>('')
  const [computedAddr, setComputedAddr] = React.useState<string>('')
  const [topupAmount, setTopupAmount] = React.useState<string>('')
  const refreshTimer = React.useRef<any>(null)

  React.useEffect(() => {
    (async () => {
      try {
        const api = await getApi()
        const txRoot: any = api.tx as any
        // 动态解析 section 名称：memoIpfs/memo_ipfs/ipfs
        const candidates = ['memoIpfs', 'memo_ipfs', 'ipfs', ...Object.keys(txRoot)]
        let picked = 'memoIpfs'
        for (const s of candidates) {
          if (txRoot[s]) { picked = s; break }
        }
        setSection(picked)
        setHasForDeceased(Boolean(txRoot[picked]?.requestPinForDeceased))
      } catch {}
    })()
  }, [])

  function toCidHashHex(cidPlain: string): string {
    // 函数级中文注释：最小占位实现——用 hex 表示；生产应由后端/OCW 提供 CID→hash 规则
    const enc = new TextEncoder().encode(String(cidPlain||''))
    const hex = Array.from(enc).map(b=>b.toString(16).padStart(2,'0')).join('')
    return '0x' + hex.slice(0, 64) // 截断占位，避免超长
  }

  async function onSubmit(v: any) {
    try {
      setSubmitting(true)
      const subjectId = Number(v.subject_id)
      const cidPlain = String(v.cid_plain||'').trim()
      if (!cidPlain) { setSubmitting(false); return message.warning('请输入明文 CID') }
      const size = Number(v.size_bytes||0)
      const replicas = Number(v.replicas||1)
      const price = String(v.price||'0')
      const cidHash = toCidHashHex(cidPlain)
      const args = hasForDeceased
        ? [subjectId, cidHash, size, replicas, price]
        : [cidHash, size, replicas, price]
      const method = hasForDeceased ? 'requestPinForDeceased' : 'requestPin'
      const txHash = await signAndSendLocalFromKeystore(section, method, args)
      message.success(`已提交 Pin 请求：${txHash}`)
      form.resetFields()
    } catch (e: any) {
      message.error(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 解析 URL subjectId 预填
  React.useEffect(() => {
    try {
      const u = new URL(window.location.href)
      const id = u.hash.split('?')[1]?.split('&').map(kv => kv.split('='))?.find(p=>p[0]==='subjectId')?.[1]
      if (id) form.setFieldsValue({ subject_id: Number(id) })
    } catch {}
  }, [form])

  // 根据 (domain=1, subject_id) 计算派生地址（与链上 PalletId 一致）
  React.useEffect(() => {
    (async () => {
      try {
        const api = await getApi()
        const subjectId = Number(form.getFieldValue('subject_id') || 0)
        if (!subjectId) { setComputedAddr(''); return }
        // 读取 PalletId 与逝者域常量
        const consts: any = (api.consts as any)
        const sec = ['memoIpfs','memo_ipfs','ipfs'].find(s => consts[s]) || 'memoIpfs'
        const pidHex = consts[sec]?.subjectPalletId?.toString?.() || ''
        const domain = consts[sec]?.deceasedDomain?.toNumber?.() ?? 1
        const pidU8a = pidHex && pidHex.startsWith('0x') ? hexToU8a(pidHex) : new Uint8Array(8)
        const domU8a = api.createType('u8', domain).toU8a()
        const sidU8a = api.createType('u64', subjectId).toU8a()
        const data = u8aConcat(stringToU8a('modl'), pidU8a, domU8a, sidU8a)
        const hash = blake2AsU8a(data, 256)
        const ss58 = encodeAddress(hash, api.registry.chainSS58 || 42)
        setComputedAddr(ss58)
      } catch { setComputedAddr('') }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.getFieldValue('subject_id')])

  async function refreshBilling() {
    try {
      const api = await getApi()
      // 读取派生资金账户余额（用户粘贴地址）
      if (derivedAddr) {
        const acc = await (api.query as any).system.account(derivedAddr)
        if (acc && acc.data) setBalance(BigInt(acc.data.free.toString()))
      } else {
        setBalance(null)
      }
      // 读取链上计费参数，用于预估
      const qroot: any = (api.query as any)
      const sec = ['memoIpfs','memo_ipfs','ipfs'].find(s => qroot[s]) || 'memoIpfs'
      const price = await qroot[sec]?.pricePerGiBWeek?.()
      const period = await qroot[sec]?.billingPeriodBlocks?.()
      if (price && period) {
        // 预估：按 1GiB×1副本 单周成本（仅作展示，实际与 size/replicas 有关）
        const unit = BigInt(price.toString())
        setEstimateWeeks(balance != null ? Math.floor(Number((balance as bigint) / unit)) : null)
      }
      // 读取当前 CID 的计费状态
      const cidPlain = String(form.getFieldValue('cid_plain')||'').trim()
      if (cidPlain) {
        const cidHash = toCidHashHex(cidPlain)
        const bill = await qroot[sec]?.pinBilling?.(cidHash)
        if (bill && bill.isSome) {
          const v = bill.unwrap()
          setBilling({ next: BigInt(v[0].toString()), unit: BigInt(v[1].toString()), state: Number(v[2].toString()) })
        } else {
          setBilling(null)
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 地址或 CID 改变时自动刷新（防抖）
  React.useEffect(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => { refreshBilling() }, 500)
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedAddr, form.getFieldValue('cid_plain')])

  async function copyAddr() {
    try { await navigator.clipboard.writeText(derivedAddr); message.success('已复制派生地址') } catch { message.error('复制失败') }
  }

  async function onTopup() {
    try {
      if (!derivedAddr) return message.warning('请先输入派生资金账户地址')
      const amt = topupAmount.trim()
      if (!amt || Number(amt) <= 0) return message.warning('请输入有效的充值金额(最小单位)')
      const hash = await signAndSendLocalFromKeystore('balances', 'transfer', [derivedAddr, amt])
      message.success(`已提交充值：${hash}`)
      setTopupAmount('')
      setTimeout(() => refreshBilling(), 1000)
    } catch (e: any) { message.error(e?.message || '充值失败') }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>逝者存储（Pin 向导）</Typography.Title>
      {/* 函数级中文注释：顶部提示——展示当前链上模块与接口，给用户快速确认路径 */}
      <Alert
        type="success"
        showIcon
        message={<div>当前链上模块：<b>{section}</b>；调用接口：<b>{hasForDeceased? 'requestPinForDeceased(subject_id, cid_hash, size, replicas, price)':'requestPin(cid_hash, size, replicas, price)'}</b></div>}
        description={<div style={{ fontSize: 12 }}>
          <div>使用提示：</div>
          <div>1) 优先使用“主题资金账户”两步法：先为派生账户充值，再提交 Pin（支持自动计算与一键套用地址）。</div>
          <div>2) 若链上暂不支持主体扣费接口，将回退为从当前账户一次性扣费的 requestPin。</div>
          <div>3) 链上仅存 cid_hash（明文 CID 不上链），OCW 负责与集群交互与巡检。</div>
        </div>}
        style={{ marginBottom: 12 }}
      />
      <Card size="small" title="步骤一：资金准备（主题资金账户）">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="请向派生的主题资金账户充值预算（建议 ≥ 存在性余额 ED）"
            description={
              <div style={{ fontSize: 12 }}>
                <div>派生规则（说明）：subject_account = PalletId.into_sub_account((domain:u8, subject_id:u64))，逝者域 domain=1</div>
                <div>说明：该地址与创建者/拥有者变更无关，稳定不变。您也可以在下方输入派生地址以查询余额。</div>
              </div>
            }
          />
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="粘贴派生资金账户地址" value={derivedAddr} onChange={(e) => setDerivedAddr(e.target.value.trim())} />
            <Button onClick={copyAddr} disabled={!derivedAddr}>复制</Button>
          </Space.Compact>
          <div style={{ fontSize: 12, color: '#666' }}>或：输入 subject_id 后使用下方组件自动计算并一键套用</div>
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber placeholder="subject_id" min={0} style={{ width: 200 }} value={form.getFieldValue('subject_id')} onChange={(v)=>form.setFieldsValue({ subject_id: v })} />
          </Space.Compact>
          <SubjectAccountAddress subjectId={Number(form.getFieldValue('subject_id')||0)} onApply={(addr)=>{ setDerivedAddr(addr); message.success('已套用派生地址') }} />
          <Space wrap>
            <Button size="small" onClick={refreshBilling}>刷新</Button>
            {balance != null && <Statistic title="账户余额(最小单位)" value={balance.toString()} />}
          </Space>
          <Space.Compact style={{ width: 360 }}>
            <Input placeholder="充值金额(最小单位)" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
            <Button type="primary" onClick={onTopup} disabled={!derivedAddr}>充值</Button>
          </Space.Compact>
        </Space>
      </Card>

      <Divider />

      <Card size="small" title="步骤二：提交 Pin（扣费）">
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label="逝者ID(subject_id)" name="subject_id" rules={[{ required: false }]}> 
            <InputNumber min={0} style={{ width: '100%' }} placeholder="若不填写，将从当前账户扣费（回退模式）" />
          </Form.Item>
          <Form.Item label="CID 明文" name="cid_plain" rules={[{ required: true, message: '请输入 CID' }]}>
            <Input placeholder="ipfs://... 或 CID 字符串" />
          </Form.Item>
          <Form.Item label="大小(bytes)" name="size_bytes" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="副本数(replicas)" name="replicas" initialValue={1}>
            <InputNumber min={1} max={8} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="一次性价格(最小单位)" name="price" rules={[{ required: true, message: '请输入价格(最小单位)' }]}>
            <Input placeholder="例如 1000000000000" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>提交 Pin</Button>
            <span style={{ fontSize: 12, color: '#666' }}>当前模块：{section}，接口：{hasForDeceased? 'requestPinForDeceased': 'requestPin'}</span>
          </Space>
        </Form>
        {billing && (
          <div style={{ marginTop: 12 }}>
            <Space wrap>
              <Statistic title="下次扣费区块" value={billing.next.toString()} />
              <Statistic title="单价快照(最小单位/ GiB·周)" value={billing.unit.toString()} />
              <Statistic title="状态" value={billing.state===0?'Active':billing.state===1?'Grace':'Expired'} />
              {estimateWeeks!=null && <Statistic title="余额可覆盖(周)" value={estimateWeeks} />}
            </Space>
          </div>
        )}
      </Card>
    </div>
  )
}

export default DeceasedPinWizard
