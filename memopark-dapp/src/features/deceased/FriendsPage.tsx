import React, { useCallback, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, Space, Typography, Switch, message } from 'antd'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

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

  const ensureId = useCallback(() => {
    if (deceasedId === null || deceasedId === undefined) { message.warning('请输入逝者ID'); return false }
    return true
  }, [deceasedId])

  const call = useCallback(async (method: string, args: any[]) => {
    setLoading(true)
    try {
      await signAndSendLocalFromKeystore('deceased', method, args)
      message.success('已提交交易')
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '交易失败')
    } finally { setLoading(false) }
  }, [])

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
                call('setFriendPolicy', [deceasedId, requireApproval, isPrivate, maxMembers])
              }}>设置策略</Button>
            </Space>

            <Typography.Title level={5} style={{ marginTop: 16 }}>成员操作</Typography.Title>
            <Form.Item label="备注（申请加入可选）">
              <Input placeholder="可选" value={note} onChange={e=>setNote(e.target.value)} />
            </Form.Item>
            <Space wrap>
              <Button loading={loading} onClick={()=>{ if (!ensureId()) return; call('requestJoin', [deceasedId, note || null]) }}>申请加入</Button>
              <Button loading={loading} onClick={()=>{ if (!ensureId()) return; call('leaveFriendGroup', [deceasedId]) }}>退出亲友团</Button>
            </Space>

            <Typography.Title level={5} style={{ marginTop: 16 }}>管理员操作</Typography.Title>
            <Form.Item label="目标账户（SS58）">
              <Input value={target} onChange={e=>setTarget(e.target.value)} placeholder="要审批/移出/改角色的账户" />
            </Form.Item>
            <Space wrap>
              <Button loading={loading} onClick={()=>{ if (!ensureId()||!target) return; call('approveJoin', [deceasedId, target]) }}>审批通过</Button>
              <Button loading={loading} onClick={()=>{ if (!ensureId()||!target) return; call('rejectJoin', [deceasedId, target]) }}>拒绝申请</Button>
              <Button danger loading={loading} onClick={()=>{ if (!ensureId()||!target) return; call('kickFriend', [deceasedId, target]) }}>移出成员</Button>
            </Space>
            <Space wrap style={{ marginTop: 8 }}>
              <span>角色</span>
              <InputNumber min={0} max={2} value={role} onChange={v=>setRole((v as any) ?? 0)} />
              <Button loading={loading} onClick={()=>{ if (!ensureId()||!target) return; call('setFriendRole', [deceasedId, target, role]) }}>设置角色</Button>
            </Space>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default FriendsPage


