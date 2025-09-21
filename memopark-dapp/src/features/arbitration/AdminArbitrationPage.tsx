import React from 'react'
import { Button, Card, Flex, Input, List, Modal, Space, Tag, message, Alert } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'

/**
 * 函数级详细中文注释：仲裁管理页（管理员/委员会专用）
 * - 功能：
 *   1) 列表展示仲裁登记案件（arbitration.disputed.entries）。
 *   2) 执行裁决：放行(0)/退款(1)/部分放行(2,bps)。
 * - 安全：
 *   - 链上已由 `pallet-arbitration` 的 DecisionOrigin 校验（Root | 内容委员会阈值）。
 *   - 前端仅提供操作入口，普通账户调用将因 BadOrigin 失败。
 */
const AdminArbitrationPage: React.FC = () => {
  const wallet = useWallet()
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<Array<{ domainHex: string; domainAscii: string; domainBytes: number[]; id: number; evidenceIds: number[] }>>([])
  const [filter, setFilter] = React.useState('')
  const [isMember, setIsMember] = React.useState<boolean>(false)

  /**
   * 函数级详细中文注释：将 8 字节域常量转换为可读字符串（尽量显示 ASCII，不可见字符退回 hex）。
   */
  function toAscii(bytes: Uint8Array): string {
    try {
      const s = String.fromCharCode(...Array.from(bytes))
      // 简单可见性判定：ASCII 32..126
      if ([...s].every(c => {
        const code = c.charCodeAt(0)
        return code >= 32 && code <= 126
      })) return s
      return ''
    } catch { return '' }
  }

  /**
   * 函数级详细中文注释：将 u8a 转十六进制（不依赖 Node Buffer）。
   */
  function u8aToHex(bytes: Uint8Array): string {
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return '0x' + hex
  }

  /**
   * 函数级详细中文注释：读取内容委员会成员列表并判断当前账户是否为成员。
   * - 约定运行时已将 Instance3 命名为 contentCollective。
   */
  const loadCommittee = React.useCallback(async () => {
    try {
      const api = await getApi()
      if (!wallet.current) { setIsMember(false); return }
      const q = (api.query as any).contentCollective?.members
      if (!q) { setIsMember(false); return }
      const members = await q()
      const list: string[] = (members?.toJSON?.() as string[]) || []
      setIsMember(list.some(x => x === wallet.current))
    } catch { setIsMember(false) }
  }, [wallet.current])

  /**
   * 函数级详细中文注释：加载仲裁登记列表，并补充 evidenceIds 快照用于审计。
   */
  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const entries = await (api.query as any).arbitration.disputed.entries()
      const out: Array<{ domainHex: string; domainAscii: string; domainBytes: number[]; id: number; evidenceIds: number[] }> = []
      for (const [key] of entries) {
        // key.args: [domain([u8;8]), id(u64)]
        const domain = key.args[0].toU8a() as Uint8Array
        const id = Number(key.args[1].toString())
        const hex = u8aToHex(domain)
        const ascii = toAscii(domain) || '(non-ascii)'
        let evidenceIds: number[] = []
        try {
          const e = await (api.query as any).arbitration.evidenceIds(domain, id)
          evidenceIds = (e?.toJSON?.() as number[]) || []
        } catch {}
        out.push({ domainHex: hex, domainAscii: ascii, domainBytes: Array.from(domain), id, evidenceIds })
      }
      setItems(out)
    } catch (e: any) {
      console.warn(e)
      message.error(e?.message || '读取仲裁列表失败')
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load(); loadCommittee() }, [load, loadCommittee])

  /**
   * 函数级详细中文注释：执行裁决（0=放行/1=退款/2=部分放行）。
   * - 对于部分放行，弹窗输入 bps（万分比）。
   */
  async function onDecide(rec: { domainBytes: number[]; id: number }, code: 0 | 1 | 2) {
    try {
      let bps: number | null = null
      if (code === 2) {
        const { value } = await new Promise<{ value?: string }>((resolve) => {
          let inputVal = ''
          Modal.confirm({
            title: '部分放行（输入万分比 bps）',
            content: (
              <Input type="number" placeholder="例如 5000 表示 50%" onChange={e => { inputVal = e.target.value }} />
            ),
            onOk: () => resolve({ value: inputVal }),
            onCancel: () => resolve({})
          })
        })
        if (!value) return
        bps = Number(value)
        if (!(bps >= 1 && bps <= 9999)) { message.error('bps 需在 1..9999'); return }
      }
      const api = await getApi()
      const args = [new Uint8Array(rec.domainBytes), rec.id, code, bps ?? null]
      const txHash = await wallet.signAndSendLocal('arbitration', 'arbitrate', args)
      message.success(`已上链：${txHash}`)
      load()
    } catch (e: any) {
      console.warn(e)
      message.error(e?.message || '裁决提交失败（请确认为内容委员会成员或 Root）')
    }
  }

  /**
   * 函数级详细中文注释：普通用户“追加证据ID”入口。
   * - 仅当用户为当事人（maker/taker）时展示。
   */
  async function onAppendEvidence(rec: { domainAscii: string; domainBytes: number[]; id: number }) {
    try {
      const api = await getApi()
      // 校验当事人：仅对 OTC 订单域做校验
      if (rec.domainAscii.trim() === 'otc_ord_') {
        const ord = await (api.query as any).otcOrder.orders(rec.id)
        if (ord.isSome) {
          const o = ord.unwrap()
          const maker = o.maker.toString()
          const taker = o.taker.toString()
          const me = wallet.current
          if (!me || (me !== maker && me !== taker)) { message.error('您不是本案当事人'); return }
        }
      }
      let inputVal = ''
      const { value } = await new Promise<{ value?: string }>((resolve) => {
        Modal.confirm({
          title: '追加证据 ID',
          content: (<Input placeholder="evidence_id (数字)" onChange={e=>{ inputVal = e.target.value }} />),
          onOk: () => resolve({ value: inputVal }),
          onCancel: () => resolve({})
        })
      })
      if (!value) return
      const eid = Number(value)
      if (!(eid >= 0)) { message.error('evidence_id 非法'); return }
      const args = [new Uint8Array(rec.domainBytes), rec.id, eid]
      const txHash = await wallet.signAndSendLocal('arbitration', 'appendEvidenceId', args)
      message.success(`已上链：${txHash}`)
      load()
    } catch (e:any) {
      console.warn(e)
      message.error(e?.message || '追加证据失败')
    }
  }

  const filteredAll = items.filter(it => !filter || it.domainHex.includes(filter) || String(it.id).includes(filter) || it.domainAscii.includes(filter))
  const [userItems, setUserItems] = React.useState<typeof filteredAll>([])

  React.useEffect(() => {
    (async () => {
      try {
        if (!wallet.current) { setUserItems([]); return }
        const api = await getApi()
        const out: typeof filteredAll = []
        for (const it of filteredAll) {
          if (it.domainAscii.trim() === 'otc_ord_') {
            const ord = await (api.query as any).otcOrder.orders(it.id)
            if (ord.isSome) {
              const o = ord.unwrap()
              const maker = o.maker.toString()
              const taker = o.taker.toString()
              if (wallet.current === maker || wallet.current === taker) out.push(it)
            }
          }
        }
        setUserItems(out)
      } catch { setUserItems([]) }
    })()
  }, [filteredAll, wallet.current])

  return (
    <Flex vertical gap={8} style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
      <Space style={{ width: '100%' }} direction="vertical">
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>{isMember ? '仲裁管理（内容委员会）' : '我的申诉（仅展示“申诉中”案件）'}</div>
          <Space>
            <Input placeholder="过滤 domain/id" value={filter} onChange={e=>setFilter(e.target.value)} allowClear style={{ width: 180 }} />
            <Button onClick={load} loading={loading} size="small">刷新</Button>
          </Space>
        </Space>

        {!isMember && (
          <Alert type="info" showIcon message="您不是内容委员会成员，仅可查看与您相关的申诉，并追加证据。" />
        )}

        <Card size="small" loading={loading}>
          <List
            dataSource={isMember ? filteredAll : userItems}
            renderItem={(it) => (
              <List.Item
                actions={isMember ? [
                  <Button key="rel" type="primary" size="small" onClick={()=>onDecide(it, 0)}>放行</Button>,
                  <Button key="ref" danger size="small" onClick={()=>onDecide(it, 1)}>退款</Button>,
                  <Button key="par" size="small" onClick={()=>onDecide(it, 2)}>部分放行</Button>,
                ] : [
                  <Button key="add" size="small" onClick={()=>onAppendEvidence(it)}>追加证据ID</Button>
                ]}
              >
                <List.Item.Meta
                  title={<Space wrap>
                    <Tag>{it.domainAscii}</Tag>
                    <Tag color="blue">{it.domainHex}</Tag>
                    <Tag color="purple">ID: {it.id}</Tag>
                  </Space>}
                  description={<div style={{ fontSize: 12 }}>
                    证据IDs：{it.evidenceIds.length ? it.evidenceIds.join(', ') : '无'}
                  </div>}
                />
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </Flex>
  )
}

export default AdminArbitrationPage


