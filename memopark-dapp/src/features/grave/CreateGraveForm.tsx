import React from 'react'
import { Alert, Button, Form, Input, InputNumber, Space, Typography, message, Divider, Modal } from 'antd'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore, signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { mapDispatchErrorMessage } from '../../lib/errors'

/**
 * 函数级详细中文注释：创建墓地表单（支持可选园区，名称使用明文字节上链）
 * - 与后端 `pallet-memo-grave::create_grave(park_id?: Option<u64>, name: BoundedVec<u8>)` 对齐
 * - 名称使用明文（UTF-8 编码）直接作为字节写入链上 `name`
 * - 费用：展示 `CreateFee`（一次性协议费）与交易费提示
 * - 提醒：名称为公开数据，请勿填写敏感隐私
 */
const CreateGraveForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)
  const [maxCidLen, setMaxCidLen] = React.useState<number>(0)
  const [createFee, setCreateFee] = React.useState<string>('0')
  const [tokenSymbol, setTokenSymbol] = React.useState<string>('MEMO')
  const [decimals, setDecimals] = React.useState<number>(12)
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [pwdVal, setPwdVal] = React.useState('')
  const [confirmLoading, setConfirmLoading] = React.useState(false)
  const txCtxRef = React.useRef<{ section: string; args: any[] } | null>(null)

  /**
   * 函数级中文注释：组件挂载时读取链上常量（MaxCidLen、CreateFee）与代币精度信息
   */
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const api = await getApi()
        const sym = (api.registry.chainTokens?.[0] as string) || 'MEMO'
        const dec = api.registry.chainDecimals?.[0] ?? 12
        const feeConst: any = (api.consts as any)?.memoGrave?.createFee
        const maxLenConst: any = (api.consts as any)?.memoGrave?.maxCidLen
        const feeStr = feeConst ? feeConst.toString() : '0'
        const maxLen = maxLenConst ? Number(maxLenConst.toString()) : 0
        if (!mounted) return
        setTokenSymbol(sym)
        setDecimals(dec)
        setCreateFee(feeStr)
        setMaxCidLen(maxLen)
      } catch (e) {
        // 忽略：链未连上时仍可渲染表单
      }
    })()
    return () => { mounted = false }
  }, [])

  /**
   * 函数级中文注释：格式化链上最小单位余额为人类可读字符串
   */
  const formatAmount = React.useCallback((amount: string, dec: number) => {
    try {
      const num = BigInt(amount)
      const base = BigInt(10) ** BigInt(dec)
      const whole = num / base
      const frac = num % base
      if (frac === 0n) return whole.toString()
      const fracStr = frac.toString().padStart(dec, '0').replace(/0+$/, '')
      return fracStr ? `${whole}.${fracStr}` : whole.toString()
    } catch {
      return '0'
    }
  }, [])

  /**
   * 函数级详细中文注释：提交创建交易（名称明文）
   * - 校验 park_id (可选) 与 name_plain（必填，按 UTF-8 字节长度 ≤ MaxCidLen）
   * - 使用本地 keystore 进行 sr25519 签名并提交 `memoGrave.createGrave`
   * - 交互优化：采用本地弹窗采集密码，避免浏览器拦截；签名成功后引导跳转“我的墓地”。
   */
  const onFinish = React.useCallback(async (values: any) => {
    try {
      setLoading(true)
      const parkIdInput = values.park_id
      const namePlain: string = (values.name_plain || '').trim()
      if (!namePlain) { setLoading(false); return message.warning('请填写名称（明文）') }
      const nameBytes = Array.from(new TextEncoder().encode(namePlain))
      if (maxCidLen && nameBytes.length > maxCidLen) {
        setLoading(false)
        return message.warning(`名称字节长度超限（${nameBytes.length}/${maxCidLen}）`)
      }
      const parkIdOpt = (parkIdInput === null || parkIdInput === undefined || parkIdInput === '') ? null : Number(parkIdInput)
      // 动态解析 section 名称，兼容 memoGrave/memo_grave/grave
      let section = 'memoGrave'
      try {
        const api = await getApi()
        const txRoot: any = api.tx as any
        const candidates = ['memoGrave', 'memo_grave', 'grave', ...Object.keys(txRoot)]
        for (const s of candidates) {
          const m = txRoot[s]
          if (m && typeof m.createGrave === 'function') { section = s; break }
        }
      } catch {}
      const args: any[] = [ parkIdOpt, nameBytes ]
      // 打开密码弹窗，避免浏览器拦截 prompt 导致“无反馈”
      txCtxRef.current = { section, args }
      setPwdVal('')
      setPwdOpen(true)
    } catch (e: any) {
      // 边界提示优化：
      // - 无本地钱包：提示跳转创建钱包页
      // - 网络/节点断开：提示检查节点或重试
      const msg = mapDispatchErrorMessage(e, '提交失败')
      if (/未找到本地钱包/.test(msg)) {
        Modal.confirm({
          title: '未发现本地钱包',
          content: '请先创建或导入钱包后再试。',
          okText: '去创建/导入',
          cancelText: '取消',
          onOk: () => { try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } })) } catch {} }
        })
      } else {
        message.error(msg)
      }
    } finally {
      // 关闭 loading 在密码确认流程结束后处理
    }
  }, [form, maxCidLen])

  const onConfirmPassword = React.useCallback(async () => {
    if (!txCtxRef.current) { setPwdOpen(false); setLoading(false); return }
    if (!pwdVal || pwdVal.length < 8) { return message.warning('请输入至少 8 位签名密码') }
    const { section, args } = txCtxRef.current
    const key = 'tx-create-grave'
    try {
      setConfirmLoading(true)
      message.loading({ key, content: '正在提交交易…' })
      const timeoutId = setTimeout(() => {
        message.loading({ key, content: '连接节点较慢，仍在等待…' })
      }, 8000)
      const txHash = await signAndSendLocalWithPassword(section, 'createGrave', args, pwdVal)
      clearTimeout(timeoutId)
      message.success({ key, content: `已提交创建墓地：${txHash}` })
      setPwdOpen(false)
      form.resetFields()
      try { window.dispatchEvent(new Event('mp.txUpdate')) } catch {}
      // 成功后自动跳转“我的墓地”，便于继续下一步操作
      try { setTimeout(() => { window.location.hash = '#/grave/my' }, 500) } catch {}
    } catch (e: any) {
      const msg = mapDispatchErrorMessage(e, '提交失败')
      if (/密码|password/i.test(String(e?.message||''))) {
        message.error({ key, content: '密码错误或解密失败，请重试' })
      } else if (/未找到本地钱包/.test(msg)) {
        message.destroy(key)
        Modal.confirm({
          title: '未发现本地钱包',
          content: '请先创建或导入钱包后再试。',
          okText: '去创建/导入',
          cancelText: '取消',
          onOk: () => { try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } })) } catch {} }
        })
      } else {
        message.error({ key, content: msg })
      }
    } finally {
      setConfirmLoading(false)
      setLoading(false)
    }
  }, [pwdVal, form])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {/* 顶部标题栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
          <Typography.Title level={4} style={{ margin: 0 }}>创建墓地</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message="提示"
            description="名称为公开数据，前端将以 UTF-8 明文字节直接上链，请勿填写敏感隐私。"
          />
          <Alert
            type="warning"
            showIcon
            message="费用提示"
            description={`将收取一次性创建费 ${formatAmount(createFee, decimals)} ${tokenSymbol}（以及链上交易费）`}
          />
        </Space>

        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 12 }}>
          <Form.Item name="park_id" label="园区ID（可选）">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="留空表示暂不隶属园区" />
          </Form.Item>
          <Form.Item name="name_plain" label={`名称（明文，UTF-8 ≤ ${maxCidLen || '未知'} 字节）`} rules={[{ required: true, message: '请填写名称（明文）' }]}>
            <Input placeholder="请输入墓地名称（明文）" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">创建墓地</Button>
          {/* 入口：创建逝者（放在“创建墓地”按钮下方） */}
          <div style={{ marginTop: 12 }}>
            <Button block onClick={() => { try { window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'deceased-create' } })) } catch {}; try { window.location.hash = '#/deceased/create' } catch {} }}>创建逝者</Button>
          </div>
        </Form>

        <Modal
          open={pwdOpen}
          title="输入签名密码"
          onCancel={()=> { setPwdOpen(false); setLoading(false) }}
          onOk={onConfirmPassword}
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
          1) 名称使用明文，前端按 UTF-8 编码直接上链；2) 可选填写园区 ID；
          3) 提交后将扣除一次性创建费与交易费；4) 创建成功会自动分配 10 位数字 Slug，供分享与查询使用。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          小贴士：若提示“创建费扣款失败”，请检查余额是否足够且账户不低于存在性余额（ED）。
        </Typography.Paragraph>
      </div>
    </div>
  )
}

export default CreateGraveForm
