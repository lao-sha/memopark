import React from 'react'
import { Alert, Button, Form, Input, Modal, Radio, Space, Typography, message, Divider, Select } from 'antd'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { mapDispatchErrorMessage } from '../../lib/errors'
import { useWallet } from '../../providers/WalletProvider'
import { getApi } from '../../lib/polkadot-safe'
import { useDeceasedEvents } from '../../hooks/useDeceasedEvents'
import { PinStatusIndicator } from '../../components/deceased/PinStatusIndicator'

/**
 * 函数级详细中文注释：创建逝者表单（挂接到指定墓位）
 * - 对应后端 `pallet-deceased::create_deceased(grave_id, name, gender_code, name_full_cid?, birth_ts, death_ts, links[])`
 * - name/birth_ts/death_ts/links 等提交为字节数组（Array<number>），与链上 Vec<u8> 对齐
 * - 性别：0=男，1=女，2=保密（默认）
 * - 出生与离世日期格式：YYYYMMDD（8位数字），前端进行强校验
 * - 错误处理：结合错误映射，提示无权限/墓位不存在/已达上限/输入不合法/重复 token 等
 * - 成功后：广播 mp.txUpdate 并跳转“我的墓地”方便继续后续操作
 */
const CreateDeceasedForm: React.FC = () => {
  const [form] = Form.useForm()
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [pwdVal, setPwdVal] = React.useState('')
  const [confirmLoading, setConfirmLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const { current } = useWallet()
  const [graveLoading, setGraveLoading] = React.useState(false)
  const [graveErr, setGraveErr] = React.useState('')
  const [myGraves, setMyGraves] = React.useState<Array<{ id: number; name?: string; slug?: string }>>([])
  
  // 事件监听
  const { events, getEventsByDeceasedId } = useDeceasedEvents(true)
  const [latestDeceasedId, setLatestDeceasedId] = React.useState<number | null>(null)
  const [pinStatusShown, setPinStatusShown] = React.useState(false)

  // 事务上下文：在校验通过后暂存参数，待输入密码确认再提交
  const txRef = React.useRef<{ args: any[] } | null>(null)

  /**
   * 函数级详细中文注释：首次渲染时预填墓位ID
   * - 从 localStorage('mp.deceased.graveId') 读取 grave_id 并 setFieldsValue 预填
   * - 仅用于预填，不在此处清除；在提交成功后再移除该键，避免用户返回时丢失上下文
   */
  React.useEffect(() => {
    try {
      const v = localStorage.getItem('mp.deceased.graveId')
      if (v != null && v !== '') {
        const n = Number(v)
        if (!Number.isNaN(n)) {
          form.setFieldsValue({ grave_id: n })
        }
      }
    } catch {}
  }, [form])

  /**
   * 函数级详细中文注释：加载当前账户拥有的墓地列表（供下拉选择）
   * - 动态适配 section 名称：memo_grave/memoGrave/grave
   * - 读取 nextGraveId 与 graves 存储，按 owner==current 过滤
   */
  const loadMyGraves = React.useCallback(async (owner: string) => {
    setGraveLoading(true); setGraveErr('')
    try {
      const api = await getApi()
      const queryRoot: any = (api.query as any)
      let q: any = queryRoot.memo_grave || queryRoot.memoGrave || queryRoot.grave
      if (!q) {
        const foundKey = Object.keys(queryRoot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k))
        if (foundKey) q = queryRoot[foundKey]
      }
      if (!q?.nextGraveId || !q?.graves) throw new Error('运行时未启用 memo_grave 或元数据缺失')
      const nextId = await q.nextGraveId().then((x:any)=>x?.toNumber? x.toNumber(): 0)
      const ids = Array.from({ length: nextId }).map((_,i)=>i)
      const all = await Promise.all(ids.map(async (id)=>{
        try{
          const gOpt = await q.graves(id)
          if (!gOpt || !gOpt.isSome) return null
          const g = gOpt.unwrap()
          const ownerStr = g.owner?.toString?.() || String(g.owner)
          if (ownerStr !== owner) return null
          let name: string | undefined = undefined
          try { const nmU8 = g.name?.toU8a ? g.name.toU8a() : (g.name?.toJSON ? new Uint8Array(g.name.toJSON()) : undefined); if (nmU8) name = new TextDecoder().decode(nmU8) } catch {}
          let slug: string | undefined = undefined
          try { const sOpt = await (q.slugOf? q.slugOf(id): null); if (sOpt && sOpt.isSome) { const u8 = (sOpt.unwrap() as any).toU8a ? (sOpt.unwrap() as any).toU8a() : new Uint8Array([]); slug = new TextDecoder().decode(u8) } } catch {}
          return { id, name, slug }
        } catch { return null }
      }))
      const list = (all.filter(Boolean) as any[])
      setMyGraves(list)
      // 若本地预填的 id 不在列表中，保留为表单值但不追加 option（避免误导）
    } catch (e:any) {
      setGraveErr(e?.message || '墓地列表加载失败')
      setMyGraves([])
    } finally { setGraveLoading(false) }
  }, [])

  React.useEffect(()=>{ if (current) loadMyGraves(current) }, [current, loadMyGraves])

  /**
   * 函数级中文注释：将字符串转换为字节数组（Array<number>）
   */
  const toBytes = React.useCallback((s: string): number[] => Array.from(new TextEncoder().encode(String(s || ''))), [])

  /**
   * 函数级中文注释：将徽标规范化为仅含 A-Z 的大写字母
   */
  // name_badge 已移除

  /**
   * 函数级中文注释：校验 YYYYMMDD（8 位数字）
   */
  const isYYYYMMDD = React.useCallback((s: string): boolean => /^(\d{8})$/.test(String(s || '')), [])

  /**
   * 函数级详细中文注释：提交前校验并弹出密码框
   * - 校验必填项与日期格式
   * - 组装为链上需要的字节数组参数
   */
  const onFinish = React.useCallback(async (v: any) => {
    try {
      setSubmitting(true)
      const gid = Number(v.grave_id)
      if (!gid && gid !== 0) { setSubmitting(false); return message.warning('请填写墓位ID') }
      const name = String(v.name || '').trim()
      if (!name) { setSubmitting(false); return message.warning('请填写姓名') }
      const gender = Number(v.gender_code ?? 2)
      const birth = String(v.birth_ts || '')
      const death = String(v.death_ts || '')
      if (!isYYYYMMDD(birth)) { setSubmitting(false); return message.error('出生日期需为YYYYMMDD') }
      if (!isYYYYMMDD(death)) { setSubmitting(false); return message.error('离世日期需为YYYYMMDD') }
      const links: string[] = Array.isArray(v.links) ? v.links.filter((s: string)=> String(s||'').trim()!=='') : []

      const args: any[] = [
        gid,
        toBytes(name),
        gender,
        v.name_full_cid ? toBytes(String(v.name_full_cid||'')) : null,
        toBytes(birth),
        toBytes(death),
        links.map(toBytes)
      ]
      txRef.current = { args }
      setPwdVal('')
      setPwdOpen(true)
    } catch (e: any) {
      message.error(mapDispatchErrorMessage(e, '提交失败'))
    } finally {
      // 结束在确认密码流程统一处理 loading
    }
  }, [toBytes, isYYYYMMDD])

  /**
   * 函数级中文注释：监听创建成功后的事件
   */
  React.useEffect(() => {
    if (!latestDeceasedId || pinStatusShown) return

    const deceasedEvents = getEventsByDeceasedId(latestDeceasedId)
    
    // 检查是否有AutoPinSuccess或AutoPinFailed事件
    const hasAutoPin = deceasedEvents.some(e => 
      e.event === 'AutoPinSuccess' || e.event === 'AutoPinFailed'
    )

    if (hasAutoPin) {
      setPinStatusShown(true)
    }
  }, [events, latestDeceasedId, getEventsByDeceasedId, pinStatusShown])

  /**
   * 函数级中文注释：确认密码并提交交易
   */
  const onConfirm = React.useCallback(async () => {
    if (!txRef.current) { setPwdOpen(false); setSubmitting(false); return }
    if (!pwdVal || pwdVal.length < 8) { return message.warning('请输入至少 8 位签名密码') }
    const key = 'tx-create-deceased'
    try {
      setConfirmLoading(true)
      setPinStatusShown(false) // 重置pin状态显示
      message.loading({ key, content: '正在提交交易…' })
      const timer = setTimeout(()=> message.loading({ key, content: '连接节点较慢，仍在等待…' }), 8000)
      const txHash = await signAndSendLocalWithPassword('deceased', 'createDeceased', txRef.current.args, pwdVal)
      clearTimeout(timer)
      message.success({ key, content: `已提交创建逝者：${txHash}` })
      setPwdOpen(false)
      
      // 等待事件并显示pin状态（延迟3秒后再跳转）
      message.info({ key: 'waiting-events', content: '正在检测IPFS固定状态...' })
      
      // 监听DeceasedCreated事件以获取新的deceased_id
      const checkEvents = setInterval(() => {
        const createdEvent = events.find(e => e.event === 'DeceasedCreated')
        if (createdEvent) {
          setLatestDeceasedId(createdEvent.deceasedId)
          message.destroy('waiting-events')
          clearInterval(checkEvents)
        }
      }, 500)
      
      // 3秒后清理定时器并跳转
      setTimeout(() => {
        clearInterval(checkEvents)
        message.destroy('waiting-events')
        form.resetFields()
        try { localStorage.removeItem('mp.deceased.graveId') } catch {}
        try { window.dispatchEvent(new Event('mp.txUpdate')) } catch {}
        // 延迟跳转，让用户看到pin状态
        setTimeout(()=> { window.location.hash = '#/grave/my' }, 2000)
      }, 3000)
      
    } catch (e: any) {
      const raw = String(e?.message || '')
      const mapped = mapDispatchErrorMessage(e, '提交失败')
      if (/未找到本地钱包/.test(mapped)) {
        message.destroy(key)
        Modal.confirm({
          title: '未发现本地钱包',
          content: '请先创建或导入钱包后再试。',
          okText: '去创建/导入',
          cancelText: '取消',
          onOk: () => { try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } })) } catch {} }
        })
      } else if (/密码|password/i.test(raw)) {
        message.error({ key, content: '密码错误或解密失败，请重试' })
      } else {
        message.error({ key, content: mapped })
      }
    } finally {
      setConfirmLoading(false)
      setSubmitting(false)
    }
  }, [pwdVal, form, events])

  const onNameChange = () => {}

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'left', paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
          <Typography.Title level={4} style={{ margin: 0 }}>创建逝者</Typography.Title>
          <span />
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message="提示" description="姓名与日期将用于生成逝者唯一 token；请确保信息准确。完整姓名建议通过链下CID提供。" />
        </Space>

        {/* Pin状态指示器 */}
        {latestDeceasedId && (() => {
          const deceasedEvents = getEventsByDeceasedId(latestDeceasedId)
          const pinSuccess = deceasedEvents.find(e => e.event === 'AutoPinSuccess')
          const pinFailed = deceasedEvents.find(e => e.event === 'AutoPinFailed')
          
          if (pinSuccess || pinFailed) {
            return (
              <div style={{ marginTop: 12 }}>
                <PinStatusIndicator
                  deceasedId={latestDeceasedId}
                  successData={pinSuccess?.data}
                  failedData={pinFailed?.data}
                  showRetry={false}
                />
              </div>
            )
          }
          return null
        })()}

        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 12 }}>
          <Form.Item label={
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>墓位ID</span>
              <Button size="small" onClick={()=> current && loadMyGraves(current)} loading={graveLoading}>刷新</Button>
            </div>
          } name="grave_id" rules={[{ required: true, message: '请选择墓位' }]}> 
            <Select
              showSearch
              placeholder={current? '请选择我的墓位' : '请先选择或创建钱包地址'}
              optionFilterProp="label"
              options={myGraves.map(g=> ({ value: g.id, label: `#${g.id}${g.name? ' · '+g.name: ''}${g.slug? ' · '+g.slug: ''}` }))}
              onChange={(val)=> form.setFieldsValue({ grave_id: val })}
              disabled={!current}
            />
          </Form.Item>
          {graveErr && <Alert type="error" showIcon message={graveErr} style={{ marginTop: -8, marginBottom: 8 }} />}
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请填写姓名' }]}>
            <Input placeholder="请输入姓名" onChange={onNameChange} />
          </Form.Item>
          {/* name_badge 字段已移除 */}
          <Form.Item label="性别" name="gender_code" initialValue={2}>
            <Radio.Group>
              <Radio value={0}>男</Radio>
              <Radio value={1}>女</Radio>
              <Radio value={2}>保密</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="出生日期 (YYYYMMDD)" name="birth_ts" rules={[{ required: true, message: '请填写出生日期' }, { validator:(_,v)=> isYYYYMMDD(String(v||''))? Promise.resolve(): Promise.reject('格式需为YYYYMMDD') }]}>
            <Input placeholder="例如：19811224" maxLength={8} />
          </Form.Item>
          <Form.Item label="离世日期 (YYYYMMDD)" name="death_ts" rules={[{ required: true, message: '请填写离世日期' }, { validator:(_,v)=> isYYYYMMDD(String(v||''))? Promise.resolve(): Promise.reject('格式需为YYYYMMDD') }]}>
            <Input placeholder="例如：20250901" maxLength={8} />
          </Form.Item>
          <Form.Item label="完整姓名链下CID（可选）" name="name_full_cid">
            <Input placeholder="IPFS/HTTPS 标识（可选）" />
          </Form.Item>
          <Form.List name="links">
            {(fields, { add, remove }) => (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: '#666' }}>外部链接（可选，最多 8 条）</label>
                  <Button size="small" onClick={()=> { if (fields.length < 8) add(); else message.warning('最多 8 条') }}>添加</Button>
                </div>
                {fields.map(field => (
                  <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <Form.Item {...field} name={field.name} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="https:// 或 ipfs://" />
                    </Form.Item>
                    <Button danger size="small" onClick={()=> remove(field.name)}>删除</Button>
                  </div>
                ))}
              </div>
            )}
          </Form.List>

          <Button type="primary" htmlType="submit" loading={submitting} block size="large">创建逝者</Button>
        </Form>

        <Modal
          open={pwdOpen}
          title="输入签名密码"
          onCancel={()=> { setPwdOpen(false); setSubmitting(false) }}
          onOk={onConfirm}
          okText="签名并提交"
          cancelText="取消"
          confirmLoading={confirmLoading}
          centered
        >
          <Input.Password placeholder="至少 8 位" value={pwdVal} onChange={e=> setPwdVal(e.target.value)} />
        </Modal>

        <Divider />
        <Typography.Title level={5} style={{ marginTop: 0 }}>使用说明</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
          1) 出生/离世日期需为 YYYYMMDD；2) 完整姓名建议链下存储，填入 CID；
          3) 与墓位关联需具备墓主/管理员权限；4) 若提示“已达上限”，请迁移或清理后再试。
        </Typography.Paragraph>
      </div>
    </div>
  )
}

export default CreateDeceasedForm


