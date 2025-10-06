import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Form, Input, InputNumber, Button, Typography, Alert, Space, message, Modal } from 'antd'
import { ArrowLeftOutlined, SwapOutlined, WalletOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { getCurrentAddress } from '../../lib/keystore'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'

const { Text } = Typography

/**
 * 函数级详细中文注释：转账页面（本地签名）
 * - 统一 UI 风格，与"我的钱包"页面保持一致
 * - 移动端优先设计，最大宽度 640px 居中
 * - 紫色渐变主题色
 * - 读取链上 tokenSymbol/decimals 用于金额格式化
 * - 表单项：收款地址、金额（人类单位）
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

  useEffect(() => {
    const cur = getCurrentAddress()
    if (cur) {
      form.setFieldsValue({ from: cur })
    }
  }, [])

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

  /**
   * 函数级详细中文注释：转换人类单位到最小单位
   */
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

  /**
   * 函数级详细中文注释：估算手续费
   */
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
    } catch {
      return '-'
    }
  }

  /**
   * 函数级详细中文注释：转换最小单位到人类单位
   */
  const planckToHuman = (amt: bigint): string => {
    const base = BigInt(Math.pow(10, decimals))
    const whole = amt / base
    const frac = amt % base
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
    return fracStr ? `${whole}.${fracStr}` : `${whole}`
  }

  const pwdOpenRef = useRef<{ resolve?: (v: string) => void; reject?: (e: any) => void }>({})
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdVal, setPwdVal] = useState('')

  /**
   * 函数级详细中文注释：等待用户输入密码
   */
  const waitPassword = () =>
    new Promise<string>((resolve, reject) => {
      pwdOpenRef.current.resolve = resolve
      pwdOpenRef.current.reject = reject
      setPwdVal('')
      setPwdOpen(true)
    })

  /**
   * 函数级详细中文注释：提交转账
   */
  const onSubmit = async (v: any) => {
    setError('')
    setHash('')
    setSubmitting(true)
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
        const mustLeft = feeWithBuffer || 0n
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
      message.success('转账成功')
      // 通知余额刷新
      window.dispatchEvent(new Event('mp.refreshBalances'))
      form.resetFields(['amount', 'dest'])
    } catch (e: any) {
      if (e?.message === 'USER_CANCELLED') {
        message.info('已取消签名')
      } else setError(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        minHeight: '100vh',
        background: '#f5f5f5',
        paddingBottom: '20px',
      }}
    >
      {/* 顶部标题栏 */}
      <div
        style={{
          background: '#fff',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            color: '#262626',
          }}
        >
          <ArrowLeftOutlined />
        </button>
        <Text strong style={{ fontSize: '18px' }}>
          转账
        </Text>
      </div>

      {/* 余额卡片 */}
      <div style={{ padding: '16px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            padding: '24px',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
            marginBottom: '16px',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <Text style={{ fontSize: '14px', color: '#fff', opacity: 0.8 }}>可用余额</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
            <Text strong style={{ fontSize: '32px', color: '#fff' }}>
              {planckToHuman(availablePlanck > 0n ? availablePlanck : freePlanck)}
            </Text>
            <Text style={{ fontSize: '18px', color: '#fff', opacity: 0.9 }}>{symbol}</Text>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              opacity: 0.8,
            }}
          >
            <Text style={{ color: '#fff' }}>总余额: {planckToHuman(freePlanck)} {symbol}</Text>
            <Text style={{ color: '#fff' }}>手续费: {planckToHuman(estFeePlanck)} {symbol}</Text>
          </div>
        </div>
      </div>

      {/* 转账表单 */}
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          {error && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: '16px', borderRadius: '8px' }}
              message={error}
              closable
              onClose={() => setError('')}
            />
          )}
          {hash && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: '16px', borderRadius: '8px' }}
              message={
                <div>
                  <Text strong>转账成功</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    {hash}
                  </Text>
                </div>
              }
              closable
              onClose={() => setHash('')}
            />
          )}

          <Form form={form} layout="vertical" onFinish={onSubmit}>
            {/* 付款地址 */}
            <Form.Item label={<Text strong>付款地址</Text>} name="from">
              <Input
                placeholder="当前地址（自动填充）"
                disabled
                style={{
                  borderRadius: '8px',
                  background: '#f5f5f5',
                  border: 'none',
                }}
              />
            </Form.Item>

            {/* 收款地址 */}
            <Form.Item
              label={<Text strong>收款地址</Text>}
              name="dest"
              rules={[{ required: true, message: '请输入收款地址' }]}
            >
              <Input
                placeholder="请输入收款地址（5F...）"
                style={{
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '14px',
                }}
              />
            </Form.Item>

            {/* 转账金额 */}
            <Form.Item
              label={<Text strong>转账金额</Text>}
              name="amount"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  min={0}
                  step={0.0001}
                  style={{
                    width: '100%',
                    borderRadius: '8px 0 0 8px',
                    height: '48px',
                    fontSize: '16px',
                  }}
                  placeholder={`请输入 ${symbol} 数量`}
                  controls={false}
                />
                <Button
                  onClick={() => {
                    const baseAvail = availablePlanck > 0n ? availablePlanck : freePlanck
                    const feeBuffer = (estFeePlanck * FEE_BUFFER_PCT) / 100n
                    const feeWithBuffer = estFeePlanck + feeBuffer
                    const available = allowDeath
                      ? baseAvail - (feeWithBuffer || 0n)
                      : baseAvail - edPlanck - (feeWithBuffer || 0n)
                    const human = available > 0n ? parseFloat(planckToHuman(available)) : 0
                    form.setFieldsValue({ amount: human })
                  }}
                  style={{
                    borderRadius: '0 8px 8px 0',
                    height: '48px',
                    background: '#667eea',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 500,
                  }}
                >
                  最大
                </Button>
              </Space.Compact>
            </Form.Item>

            {/* 提交按钮 */}
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={submitting}
              disabled={!wallet}
              icon={<SwapOutlined />}
              style={{
                borderRadius: '12px',
                height: '48px',
                fontSize: '16px',
                fontWeight: 500,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                marginTop: '8px',
              }}
            >
              {submitting ? '提交中...' : '确认转账'}
            </Button>
          </Form>

          {/* 提示信息 */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '8px',
            }}
          >
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              💡 提示：转账会保留账户存活余额（ED），避免账户被删除
            </Text>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
              📊 存活余额（ED）: {planckToHuman(edPlanck)} {symbol}
            </Text>
          </div>
        </div>
      </div>

      {/* 密码输入弹窗 */}
      <Modal
        open={pwdOpen}
        onCancel={() => {
          setPwdOpen(false)
          pwdOpenRef.current.reject?.(new Error('USER_CANCELLED'))
        }}
        onOk={() => {
          if (!pwdVal || pwdVal.length < 8) {
            message.error('密码不足 8 位')
            return
          }
          setPwdOpen(false)
          pwdOpenRef.current.resolve?.(pwdVal)
        }}
        okText="确认签名"
        cancelText="取消"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WalletOutlined style={{ color: '#667eea' }} />
            <span>输入钱包密码</span>
          </div>
        }
        centered
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          },
        }}
      >
        <div style={{ padding: '12px 0' }}>
          <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: '12px' }}>
            请输入钱包密码以签名此交易
          </Text>
          <Input.Password
            placeholder="至少 8 位密码"
            value={pwdVal}
            onChange={(e) => setPwdVal(e.target.value)}
            style={{ borderRadius: '8px', padding: '12px' }}
            onPressEnter={() => {
              if (pwdVal && pwdVal.length >= 8) {
                setPwdOpen(false)
                pwdOpenRef.current.resolve?.(pwdVal)
              }
            }}
          />
        </div>
      </Modal>
    </div>
  )
}

export default TransferPage