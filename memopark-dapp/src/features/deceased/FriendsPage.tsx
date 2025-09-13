import React, { useCallback, useEffect, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, Space, Typography, Switch, message, List, Tag } from 'antd'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：逝者亲友团管理页（最小可用版）
 * - 仅基于 extrinsic 直连：setFriendPolicy / requestJoin / approveJoin / rejectJoin / leaveFriendGroup / kickFriend / setFriendRole
 * - 以 deceased_id 为维度管理；角色：0=Member 1=Core 2=Admin
 */
const FriendsPage: React.FC = () => {
  const [deceasedId, setDeceasedId] = useState<number | null>(null)
  const [requireApproval, setRequireApproval] = useState(true)
  const [isPrivate, setIsPrivate] = useState(false)
  const [maxMembers, setMaxMembers] = useState<number>(256)
  const [note, setNote] = useState('')
  const [target, setTarget] = useState('')
  const [role, setRole] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<Array<{ who: string; when: string }>>([])
  const [members, setMembers] = useState<Array<{ who: string; role: string; since: string; note?: string }>>([])

  const ensureId = useCallback(() => {
    if (deceasedId === null || deceasedId === undefined) { message.warning('请输入逝者ID'); return false }
    return true
  }, [deceasedId])

  const call = useCallback(async (method: string, args: any[]) => {
    setLoading(true)
    try {
      await signAndSendLocalFromKeystore('deceased', method, args)
      message.success('已提交交易')
      // 交易提交后尝试刷新列表
      setTimeout(() => { void refresh() }, 1200)
    } catch (e: any) {
      console.error(e)
      // 错误码中文映射（尽力而为）
      const msg = String(e?.message || '')
      const map: Record<string,string> = {
        NotAuthorized: '无权限操作（仅管理员/owner 可执行）',
        DeceasedNotFound: '逝者不存在',
        FriendAlreadyMember: '已是亲友成员',
        FriendNotMember: '该账户不是亲友成员',
        FriendPendingExists: '已存在待审批申请',
        FriendNoPending: '未找到待审批申请',
        FriendTooMany: '成员数量达到上限',
        BadInput: '输入不合法（长度/数量越界）'
      }
      const hit = Object.keys(map).find(k => msg.includes(k))
      message.error(hit ? map[hit] : (e?.message || '交易失败'))
    } finally { setLoading(false) }
  }, [])

  /**
   * 函数级中文注释：刷新待审批与成员列表
   * - FriendJoinRequests: DeceasedId -> BoundedVec<(AccountId, BlockNumber)>
   * - FriendsOf: (DeceasedId, AccountId) -> FriendRecord { role, since, note }
   */
  const refresh = useCallback(async () => {
    if (!ensureId()) return
    try {
      const api = await getApi()
      const did = deceasedId as number
      // 读取待审批
      const reqAny: any = await (api.query as any).deceased.friendJoinRequests(did)
      const req = (reqAny?.toJSON?.() as any[]) || []
      setPending(req.map((x: any) => ({ who: String(x[0]), when: String(x[1]) })))
      // 读取成员列表：通过 double map 的前缀 keys(did)
      const keys: any[] = await (api.query as any).deceased.friendsOf.keys(did)
      const accounts: string[] = keys.map((k: any) => {
        try { return String(k.args?.[1]?.toString?.() || k.toHuman?.()) } catch { return '' }
      }).filter(Boolean)
      if (accounts.length) {
        const vals: any[] = await (api.query as any).deceased.friendsOf.multi(accounts.map(a => [did, a]))
        const items = vals.map((v: any, i: number) => {
          const h: any = v?.toHuman?.() || v?.toJSON?.() || {}
          const role = String(h?.role || 'Member')
          const since = String(h?.since || '')
          const note = String(h?.note || '')
          return { who: accounts[i], role, since, note }
        })
        setMembers(items)
      } else {
        setMembers([])
      }
    } catch (e) {
      console.error(e)
    }
  }, [deceasedId, ensureId])

  useEffect(() => { if (deceasedId !== null) { void refresh() } }, [deceasedId])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Card title="逝者亲友团（最小实现）">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Form layout="vertical">
            <Form.Item label="逝者ID">
              <InputNumber min={0} value={deceasedId as any} onChange={v=>setDeceasedId((v as any) ?? null)} style={{ width: '100%' }} />
            </Form.Item>

            <Typography.Title level={5}>策略设置</Typography.Title>
            <Space align="center" wrap>
              <span>审批加入</span><Switch checked={requireApproval} onChange={setRequireApproval} />
              <span>私密</span><Switch checked={isPrivate} onChange={setIsPrivate} />
              <span>上限</span><InputNumber min={1} value={maxMembers} onChange={v=>setMaxMembers((v as any) ?? 1)} />
              <Button type="primary" loading={loading} onClick={()=>{
                if (!ensureId()) return
                if (typeof maxMembers !== 'number' || maxMembers < 1 || maxMembers > 100000) return message.warning('上限需为 1~100000 的数字')
                call('setFriendPolicy', [deceasedId, requireApproval, isPrivate, maxMembers])
              }}>设置策略</Button>
            </Space>

            <Typography.Title level={5} style={{ marginTop: 16 }}>成员操作</Typography.Title>
            <Form.Item label="备注（申请加入可选）">
              <Input placeholder="可选" value={note} onChange={e=>setNote(e.target.value)} />
            </Form.Item>
            <Space wrap>
              <Button loading={loading} onClick={()=>{ if (!ensureId()) return; if (note.length > 256) return message.warning('备注过长'); call('requestJoin', [deceasedId, note || null]) }}>申请加入</Button>
              <Button loading={loading} onClick={()=>{ if (!ensureId()) return; call('leaveFriendGroup', [deceasedId]) }}>退出亲友团</Button>
            </Space>

            <Typography.Title level={5} style={{ marginTop: 16 }}>管理员操作</Typography.Title>
            <Form.Item label="目标账户（SS58）">
              <Input value={target} onChange={e=>setTarget(e.target.value)} placeholder="要审批/移出/改角色的账户" />
            </Form.Item>
            <Space wrap>
              <Button loading={loading} onClick={()=>{ if (!ensureId()) return; if (!/^\w{40,64}$/i.test(target)) return message.warning('目标账户格式不正确'); call('approveJoin', [deceasedId, target]) }}>审批通过</Button>
              <Button loading={loading} onClick={()=>{ if (!ensureId()) return; if (!/^\w{40,64}$/i.test(target)) return message.warning('目标账户格式不正确'); call('rejectJoin', [deceasedId, target]) }}>拒绝申请</Button>
              <Button danger loading={loading} onClick={()=>{ if (!ensureId()) return; if (!/^\w{40,64}$/i.test(target)) return message.warning('目标账户格式不正确'); call('kickFriend', [deceasedId, target]) }}>移出成员</Button>
            </Space>
            <Space wrap style={{ marginTop: 8 }}>
              <span>角色</span>
              <InputNumber min={0} max={2} value={role} onChange={v=>setRole((v as any) ?? 0)} />
              <Button loading={loading} onClick={()=>{ if (!ensureId()) return; if (!/^\w{40,64}$/i.test(target)) return message.warning('目标账户格式不正确'); if (typeof role!=='number'|| role<0||role>2) return message.warning('角色需为 0~2'); call('setFriendRole', [deceasedId, target, role]) }}>设置角色</Button>
            </Space>
          </Form>
          <Space>
            <Button onClick={()=>refresh()} loading={loading}>刷新列表</Button>
          </Space>

          <Typography.Title level={5} style={{ marginTop: 16 }}>待审批</Typography.Title>
          <List bordered dataSource={pending} locale={{ emptyText: '暂无待审批' }} renderItem={(it) => (
            <List.Item actions={[
              <Button key="ok" size="small" onClick={()=>{ if (!ensureId()) return; call('approveJoin', [deceasedId, it.who]) }}>通过</Button>,
              <Button key="no" size="small" danger onClick={()=>{ if (!ensureId()) return; call('rejectJoin', [deceasedId, it.who]) }}>拒绝</Button>
            ]}>
              <List.Item.Meta title={<Space><Tag color="gold">申请</Tag><Typography.Text code>{it.who}</Typography.Text></Space>} description={`申请于区块：${it.when}`} />
            </List.Item>
          )} />

          <Typography.Title level={5} style={{ marginTop: 16 }}>成员</Typography.Title>
          <List bordered dataSource={members} locale={{ emptyText: '暂无成员' }} renderItem={(it) => (
            <List.Item actions={[
              <Button key="kick" size="small" danger onClick={()=>{ if (!ensureId()) return; call('kickFriend', [deceasedId, it.who]) }}>移出</Button>
            ]}>
              <List.Item.Meta title={<Space><Tag color="blue">{it.role}</Tag><Typography.Text code>{it.who}</Typography.Text></Space>} description={`加入于区块：${it.since}${it.note? ' ｜ 备注：'+it.note : ''}`} />
            </List.Item>
          )} />
        </Space>
      </Card>
    </div>
  )
}

export default FriendsPage


