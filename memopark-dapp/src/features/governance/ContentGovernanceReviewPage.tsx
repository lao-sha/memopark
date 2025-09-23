import React from 'react'
import { Card, Space, Typography, InputNumber, Button, Alert, Form, Input, message, List, Tag } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：内容治理审查台（Memo Content Governance）
 * - 目标：提供最小可用的审查工作台，便于在移动端快速审批/驳回/清理申诉
 * - 读取：通过 NextId 推断上界；按 id 范围逐个 query Appeals(id) 聚合形成列表
 * - 审批：approve_appeal(id, notice_blocks?)；驳回：reject_appeal(id)
 * - 清理：purge_appeals(start_id, end_id, limit)
 * - 兼容：动态探测 section 名称（memoContentGovernance/memo_content_governance/contentGovernance）与方法名驼峰/下划线
 */
const ContentGovernanceReviewPage: React.FC = () => {
  const [form] = Form.useForm()
  const [list, setList] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const sectionCandidates = ['memoContentGovernance','memo_content_governance','contentGovernance']
  const [queueAt, setQueueAt] = React.useState<number>(0)
  const [dueIds, setDueIds] = React.useState<number[]>([])

  const detectSection = (root: any): any => {
    for (const s of sectionCandidates) { if (root[s]) return { sec: root[s], name: s } }
    return { sec: null, name: '' }
  }

  const loadRange = async () => {
    setError(''); setLoading(true)
    try {
      const v = await form.validateFields()
      const api = await getApi()
      const qroot: any = api.query as any
      const { sec, name } = detectSection(qroot)
      if (!sec) throw new Error('运行时未注册 memo-content-governance')
      const appealsStore = sec.appeals || sec.Appeals
      const nextIdStore = sec.nextId || sec.NextId
      if (!appealsStore) throw new Error('找不到 Appeals 存储项')
      const start: number = v.start_id ?? 0
      const limit: number = v.limit ?? 20
      const end = start + limit - 1
      const rows: any[] = []
      for (let id = start; id <= end; id++) {
        try {
          const val = await appealsStore(id)
          const json = val?.toJSON?.()
          if (json) rows.push({ id, ...json })
        } catch {}
      }
      setList(rows)
    } catch (e:any) { setError(e?.message || '加载失败') }
    finally { setLoading(false) }
  }

  const loadDueAt = async () => {
    try{
      const api = await getApi()
      const qroot: any = api.query as any
      const { sec } = detectSection(qroot)
      if(!sec) throw new Error('运行时未注册 memo-content-governance')
      const call = sec.dueAt || sec.due_at
      if(!call) { setDueIds([]); return }
      const v = await call(queueAt)
      const arr = v?.toJSON?.() as number[] || []
      setDueIds(arr)
    }catch(e){ /* ignore */ }
  }

  const checkTargetExists = async (domain:number, target:number): Promise<boolean> => {
    try{
      const api = await getApi()
      // 简单示例：domain=1 视为墓位，检测 memoGrave.Graves(target) 是否存在
      if(domain===1){
        const q: any = (api.query as any).memoGrave || (api.query as any).memo_grave
        const v = await q?.graves?.(target)
        return !!v && !!v.toJSON?.()
      }
    }catch{}
    return true
  }

  const approve = async () => {
    try {
      const v = await form.validateFields(['approve_id','notice_blocks','domain','target'])
      if(v?.domain!=null && v?.target!=null){
        const ok = await checkTargetExists(Number(v.domain), Number(v.target))
        if(!ok){ message.warning('目标不存在，可能执行失败'); }
      }
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 memo-content-governance')
      const method = sec.approveAppeal || sec.approve_appeal
      if (!method) throw new Error('找不到 approve_appeal 方法')
      const args = [v.approve_id, v.notice_blocks ?? null]
      const h = await signAndSendLocalFromKeystore(name, method.name, args)
      message.success('已提交通过：'+h)
      loadRange()
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  const reject = async () => {
    try {
      const v = await form.validateFields(['reject_id'])
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 memo-content-governance')
      const method = sec.rejectAppeal || sec.reject_appeal
      if (!method) throw new Error('找不到 reject_appeal 方法')
      const h = await signAndSendLocalFromKeystore(name, method.name, [v.reject_id])
      message.success('已提交驳回：'+h)
      loadRange()
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  const purge = async () => {
    try {
      const v = await form.validateFields(['purge_start','purge_end','purge_limit'])
      const api = await getApi()
      const txroot: any = api.tx as any
      const { sec, name } = detectSection(txroot)
      if (!sec) throw new Error('运行时未注册 memo-content-governance')
      const method = sec.purgeAppeals || sec.purge_appeals
      if (!method) throw new Error('找不到 purge_appeals 方法')
      const h = await signAndSendLocalFromKeystore(name, method.name, [v.purge_start, v.purge_end, v.purge_limit])
      message.success('已提交清理：'+h)
      loadRange()
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>内容治理审查台</Typography.Title>
        <Card size="small" title="读取区间">
          <Form form={form} layout="vertical">
            <Space>
              <Form.Item label="start_id" name="start_id" initialValue={0}><InputNumber min={0} /></Form.Item>
              <Form.Item label="limit" name="limit" initialValue={20}><InputNumber min={1} max={200} /></Form.Item>
              <Button onClick={loadRange} loading={loading}>读取</Button>
            </Space>
          </Form>
        </Card>
        <Card size="small" title="审批/驳回">
          <Form form={form} layout="vertical">
            <Space wrap>
              <Form.Item label="approve id" name="approve_id"><InputNumber min={0} /></Form.Item>
              <Form.Item label="notice_blocks(可选)" name="notice_blocks"><InputNumber min={0} /></Form.Item>
              <Button type="primary" onClick={approve}>通过</Button>
              <Form.Item label="reject id" name="reject_id"><InputNumber min={0} /></Form.Item>
              <Button danger onClick={reject}>驳回</Button>
            </Space>
          </Form>
        </Card>
        <Card size="small" title="清理历史">
          <Form form={form} layout="vertical">
            <Space wrap>
              <Form.Item label="start_id" name="purge_start"><InputNumber min={0} /></Form.Item>
              <Form.Item label="end_id" name="purge_end"><InputNumber min={0} /></Form.Item>
              <Form.Item label="limit" name="purge_limit" initialValue={50}><InputNumber min={1} max={500} /></Form.Item>
              <Button onClick={purge}>执行清理</Button>
            </Space>
          </Form>
        </Card>
        <Card size="small" title="到期队列查询">
          <Space>
            <InputNumber min={0} value={queueAt} onChange={v=> setQueueAt(Number(v||0))} />
            <Button onClick={loadDueAt}>读取 due_at</Button>
          </Space>
          {!!dueIds.length && <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(dueIds)}</pre>}
        </Card>
        <Card size="small" title="结果列表">
          <List bordered dataSource={list} renderItem={(it:any)=> (
            <List.Item>
              <Space direction="vertical" style={{ width:'100%' }}>
                <Space>
                  <Tag color="blue">#{it.id}</Tag>
                  <Tag color={it.status===0?'gold':it.status===1?'processing':it.status===2?'red':it.status===3?'default':'green'}>
                    status: {it.status}
                  </Tag>
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  who: {String(it.who)} | domain: {String(it.domain)} | target: {String(it.target)} | action: {String(it.action)}
                </Typography.Text>
              </Space>
            </List.Item>
          )} />
        </Card>
      </Space>
    </div>
  )
}

export default ContentGovernanceReviewPage
