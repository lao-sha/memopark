import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Form, Input, InputNumber, Button, Typography, Alert, Space, message, Modal } from 'antd'
import { ArrowLeftOutlined, SwapOutlined, WalletOutlined, SendOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { getCurrentAddress } from '../../lib/keystore'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import './TransferPage.css'

const { Text } = Typography

/**
 * 函数级详细中文注释：转账页面（统一青绿色UI风格）
 * - 设计：移动端优先，统一青绿色 #5DBAAA 主题风格，与底部导航栏保持一致
 * - 功能：DUST 代币转账，本地签名，余额实时显示
 * - 安全：使用 balances.transferKeepAlive，防止把发送账户 ED 清空
 * - 体验：智能手续费估算，一键填入最大金额，实时余额刷新
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
    <div className="transfer-page">
      {/* 顶部导航栏（统一青绿色风格） */}
      <div className="transfer-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => window.history.back()}
          className="back-button"
        >
          返回
        </Button>
        <div className="page-title">DUST 转账</div>
        <div style={{ width: 40 }} />
      </div>

      {/* 主要内容区域 */}
      <div className="transfer-content">
        {/* 余额卡片（青绿色主题） */}
        <div className="balance-card">
          <div className="balance-label">可用余额</div>
          <div className="balance-amount">
            <div className="balance-value">
              {planckToHuman(availablePlanck > 0n ? availablePlanck : freePlanck)}
            </div>
            <div className="balance-symbol">{symbol}</div>
          </div>
          <div className="balance-details">
            <div className="balance-detail-item">
              <WalletOutlined style={{ fontSize: '12px' }} />
              <span>总余额: {planckToHuman(freePlanck)} {symbol}</span>
            </div>
            <div className="balance-detail-item">
              <SendOutlined style={{ fontSize: '12px' }} />
              <span>预估费用: {planckToHuman(estFeePlanck)} {symbol}</span>
            </div>
          </div>
        </div>

        {/* 转账表单卡片 */}
        <div className="transfer-form-card">
          <div className="form-section-title">
            <SwapOutlined style={{ color: '#5DBAAA' }} />
            转账信息
          </div>

          {/* 错误和成功提示 */}
          {error && (
            <Alert
              type="error"
              showIcon
              className="alert-error"
              message={error}
              closable
              onClose={() => setError('')}
            />
          )}
          {hash && (
            <Alert
              type="success"
              showIcon
              className="alert-success"
              message={
                <div>
                  <Text strong>转账成功</Text>
                  <div className="success-hash">
                    交易哈希: {hash}
                  </div>
                </div>
              }
              closable
              onClose={() => setHash('')}
            />
          )}

          <Form form={form} layout="vertical" onFinish={onSubmit}>
            {/* 付款地址 */}
            <Form.Item label={<div className="form-label">付款地址</div>} name="from">
              <Input
                placeholder="当前地址（自动填充）"
                disabled
                className="address-input from-input"
              />
            </Form.Item>

            {/* 收款地址 */}
            <Form.Item
              label={<div className="form-label">收款地址</div>}
              name="dest"
              rules={[{ required: true, message: '请输入收款地址' }]}
            >
              <Input
                placeholder="请输入收款地址（5F...）"
                className="address-input"
              />
            </Form.Item>

            {/* 转账金额 */}
            <Form.Item
              label={<div className="form-label">转账金额</div>}
              name="amount"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <div className="amount-input-group">
                <InputNumber
                  min={0}
                  step={0.0001}
                  className="amount-input"
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
                  className="max-button"
                >
                  最大
                </Button>
              </div>
            </Form.Item>

            {/* 手续费显示 */}
            {estFeePlanck > 0n && (
              <div className="fee-display">
                <span className="fee-label">预估手续费</span>
                <span className="fee-value">{planckToHuman(estFeePlanck)} {symbol}</span>
              </div>
            )}

            {/* 提交按钮 */}
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={submitting}
              disabled={!wallet}
              icon={<SwapOutlined />}
              className="submit-button"
            >
              {submitting ? '提交中...' : '确认转账'}
            </Button>
          </Form>

          {/* 提示信息 */}
          <div className="tips-card">
            <div className="tips-item">
              <InfoCircleOutlined className="tips-icon" />
              <span>转账会保留账户存活余额（ED），避免账户被删除</span>
            </div>
            <div className="tips-item">
              <WalletOutlined className="tips-icon" />
              <span>存活余额（ED）: {planckToHuman(edPlanck)} {symbol}</span>
            </div>
            <div className="tips-item">
              <SendOutlined className="tips-icon" />
              <span>手续费已包含 {FEE_BUFFER_PCT}% 安全余量</span>
            </div>
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
          <div>
            <WalletOutlined style={{ color: '#5DBAAA', marginRight: '8px' }} />
            <span>输入钱包密码</span>
          </div>
        }
        centered
        className="password-modal"
        okButtonProps={{
          className: 'password-ok-btn'
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
            className="password-input"
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