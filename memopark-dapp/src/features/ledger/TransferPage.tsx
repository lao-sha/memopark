import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, Typography, Alert, Space, Divider, message } from 'antd'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { getCurrentAddress } from '../../lib/keystore'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { Modal } from 'antd'

/**
 * 函数级详细中文注释：转账页面（本地签名）
 * - 读取链上 tokenSymbol/decimals 用于金额格式化
 * - 表单项：收款地址、金额（人类单位）、可选 memo
 * - 使用 balances.transferKeepAlive，防止把发送账户 ED 清空
 * - 成功后回显 tx hash；错误显示在 Alert 中
 */
const TransferPage: React.FC = () => {
  const wallet = useWallet()
  const [decimals, setDecimals] = useState<number>(12)
  const [symbol, setSymbol] = useState<string>('UNIT')
  const [freePlanck, setFreePlanck] = useState<bigint>(0n)
  const [availablePlanck, setAvailablePlanck] = useState<bigint>(0n)
  const [edPlanck, setEdPlanck] = useState<bigint>(0n)
  const [estFeePlanck, setEstFeePlanck] = useState<bigint>(0n)
  const [allowDeath, setAllowDeath] = useState<boolean>(false)
  const FEE_BUFFER_PCT = 5n // 手续费安全余量 5%
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>('')
  const [hash, setHash] = useState<string>('')
  const [form] = Form.useForm()
  useEffect(()=>{
    const cur = getCurrentAddress()
    if (cur) {
      form.setFieldsValue({ from: cur })
    }
  },[])

  useEffect(() => {
    ;(async () => {
      try {
        const api = await getApi()
        setDecimals(api.registry.chainDecimals?.[0] ?? 12)
        setSymbol((api.registry.chainTokens?.[0] as string) || 'UNIT')
        const addr = getCurrentAddress()
        if (addr) {
          try {
            const d = await (api.derive as any)?.balances?.all(addr)
            if (d) {
              const free = d.freeBalance?.toString?.() || '0'
              const avail = d.availableBalance?.toString?.() || free
              setFreePlanck(BigInt(free))
              setAvailablePlanck(BigInt(avail))
            } else {
              const acc: any = await api.query.system.account(addr)
              const free = acc?.data?.free?.toString?.() || '0'
              setFreePlanck(BigInt(free))
              setAvailablePlanck(BigInt(free))
            }
          } catch {
            const acc: any = await api.query.system.account(addr)
            const free = acc?.data?.free?.toString?.() || '0'
            setFreePlanck(BigInt(free))
            setAvailablePlanck(BigInt(free))
          }
        }
        const ed = (api.consts as any)?.balances?.existentialDeposit?.toString?.() || '0'
        setEdPlanck(BigInt(ed))
      } catch {}
    })()
  }, [])

  const toPlanck = (amount: number) => {
    try {
      const base = BigInt(Math.pow(10, decimals))
      const whole = BigInt(Math.floor(amount))
      const frac = BigInt(Math.round((amount - Math.floor(amount)) * Math.pow(10, Math.min(decimals, 6))))
      const fracScale = BigInt(Math.pow(10, Math.min(decimals, 6)))
      return whole * base + (frac * base) / fracScale
    } catch {
      return 0n
    }
  }

  const estimateFee = async (dest: string, amount: bigint): Promise<string> => {
    try {
      const api = await getApi()
      const tx = allowDeath ? (api.tx as any).balances.transferAllowDeath(dest, amount) : (api.tx as any).balances.transferKeepAlive(dest, amount)
      const info = await tx.paymentInfo(getCurrentAddress() || undefined)
      const fee = info?.partialFee?.toString?.() || '0'
      const base = BigInt(Math.pow(10, decimals))
      const num = BigInt(fee)
      setEstFeePlanck(num)
      const whole = num / base
      const frac = num % base
      const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
      return fracStr ? `${whole}.${fracStr} ${symbol}` : `${whole} ${symbol}`
    } catch { return '-' }
  }

  const planckToHuman = (amt: bigint): string => {
    const base = BigInt(Math.pow(10, decimals))
    const whole = amt / base
    const frac = amt % base
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
    return fracStr ? `${whole}.${fracStr}` : `${whole}`
  }

  const pwdOpenRef = useRef<{ resolve?: (v: string)=>void; reject?: (e: any)=>void }>({})
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdVal, setPwdVal] = useState('')

  const waitPassword = () => new Promise<string>((resolve, reject) => {
    pwdOpenRef.current.resolve = resolve
    pwdOpenRef.current.reject = reject
    setPwdVal('')
    setPwdOpen(true)
  })

  const onSubmit = async (v: any) => {
    setError(''); setHash(''); setSubmitting(true)
    try {
      const dest = String(v.dest || '').trim()
      const amtHuman = Number(v.amount)
      if (!dest) throw new Error('请输入收款地址')
      if (!Number.isFinite(amtHuman) || amtHuman <= 0) throw new Error('请输入合法金额')
      const value = toPlanck(amtHuman)
      const feeText = await estimateFee(dest, value)
      if (feeText && feeText !== '-') message.info(`预计手续费：${feeText}`)
      const feeBuffer = (estFeePlanck * FEE_BUFFER_PCT) / 100n
      const feeWithBuffer = estFeePlanck + feeBuffer
      if (!allowDeath) {
        const available = (availablePlanck > 0n ? availablePlanck : freePlanck) - edPlanck - (feeWithBuffer || 0n)
        if (available <= 0n || value > available) {
          setError(`余额不足：可用约 ${planckToHuman(available > 0n ? available : 0n)} ${symbol}`)
          return
        }
      } else {
        const mustLeft = (feeWithBuffer || 0n)
        const possible = (availablePlanck > 0n ? availablePlanck : freePlanck) - mustLeft
        if (possible <= 0n || value > possible) {
          setError(`余额不足以支付手续费，最多可转约 ${planckToHuman(possible > 0n ? possible : 0n)} ${symbol}`)
          return
        }
      }
      const pwd = await waitPassword()
      const method = allowDeath ? 'transferAllowDeath' : 'transferKeepAlive'
      const txHash = await signAndSendLocalWithPassword('balances', method, [dest, value], pwd)
      setHash(txHash)
      message.success('已提交')
      // 通知余额刷新
      window.dispatchEvent(new Event('mp.refreshBalances'))
      form.resetFields(['amount'])
    } catch (e: any) {
      if (e?.message === 'USER_CANCELLED') { message.info('已取消签名'); }
      else setError(e?.message || '提交失败')
    } finally { setSubmitting(false) }
  }

  const header = useMemo(() => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>转账</Typography.Title>
      <Typography.Text type="secondary">{symbol} · {decimals} decimals</Typography.Text>
    </div>
  ), [symbol, decimals])

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 12 }}>
      <Card title={header}>
        {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}
        {hash && <Alert type="success" showIcon style={{ marginBottom: 12 }} message={`已提交：${hash}`} />}
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label="付款地址" name="from">
            <Input placeholder="当前地址（自动填充）" disabled />
          </Form.Item>
          <Form.Item label="收款地址" name="dest" rules={[{ required: true, message: '请输入收款地址' }]}> 
            <Input placeholder="5F..." size="large" />
          </Form.Item>
          <Form.Item label={`金额（${symbol}）`} name="amount" rules={[{ required: true, message: '请输入金额' }]}>
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber min={0} step={0.0001} style={{ width: '100%' }} size="large" placeholder={`例如 1.23`} />
              <Button onClick={()=>{
                const baseAvail = (availablePlanck > 0n ? availablePlanck : freePlanck)
                const feeBuffer = (estFeePlanck * FEE_BUFFER_PCT) / 100n
                const feeWithBuffer = estFeePlanck + feeBuffer
                const available = allowDeath ? (baseAvail - (feeWithBuffer || 0n)) : (baseAvail - edPlanck - (feeWithBuffer || 0n))
                const human = available > 0n ? parseFloat(planckToHuman(available)) : 0
                form.setFieldsValue({ amount: human })
              }}>最大</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="选项">
            <Space>
              <Button type={allowDeath ? 'primary' : 'default'} onClick={()=> setAllowDeath(!allowDeath)}>
                {allowDeath ? '允许账户死亡：开' : '允许账户死亡：关'}
              </Button>
            </Space>
          </Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting} disabled={!wallet}>
              提交转账（KeepAlive）
            </Button>
          </Space>
        </Form>
        <Modal
          open={pwdOpen}
          onCancel={()=>{ setPwdOpen(false); pwdOpenRef.current.reject?.(new Error('USER_CANCELLED')) }}
          onOk={()=>{
            if (!pwdVal || pwdVal.length < 8) { message.error('密码不足 8 位'); return }
            setPwdOpen(false)
            pwdOpenRef.current.resolve?.(pwdVal)
          }}
          okText="签名"
          cancelText="取消"
          title="输入签名密码"
          centered
        >
          <Input.Password placeholder="至少 8 位" value={pwdVal} onChange={e=> setPwdVal(e.target.value)} />
        </Modal>
        <Divider />
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          提示：KeepAlive 会保留发送账户的存活余额（ED），避免误删账户。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          余额：{planckToHuman(freePlanck)} {symbol} · ED：{planckToHuman(edPlanck)} {symbol} · 预计手续费：{planckToHuman(estFeePlanck)} {symbol}
        </Typography.Paragraph>
      </Card>
    </div>
  )
}

export default TransferPage


