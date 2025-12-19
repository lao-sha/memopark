import React from 'react'
import { Alert, Button, Card, Flex, Form, Input, Segmented, Space, Statistic, message } from 'antd'
import { usePricing } from '../../hooks/usePricing'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：桥-锁定（报价保护）页面
 * - 展示链上价格、陈旧与暂停标识、费率（bps）
 * - 允许输入锁定 DUST 金额、ETH 地址与最小可得 ETH（支持自动估算+滑点）
 * - 点击提交调用 memoBridge.lockMemoWithProtection
 */
const BridgeLockPage: React.FC = () => {
  const { price, pricingParams, bridgeParams, stale, paused, loading, error, refresh } = usePricing(10000)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)
  const [showWei, setShowWei] = React.useState(false)
  const [txError, setTxError] = React.useState<string | null>(null)

  const decimals = 12
  const nf = new Intl.NumberFormat('zh-CN')

  function calcNet(amount: bigint): bigint {
    const feeBps = BigInt(bridgeParams?.feeBps || 0)
    const fee = (amount * feeBps) / 10000n
    return amount - fee
  }

  function quoteEthOut(net: bigint): bigint {
    if (!price || price.den === 0n) return 0n
    return (net * price.num) / price.den
  }

  async function onEstimateMin() {
    try {
      const amtStr = form.getFieldValue('amount') as string
      if (!amtStr) return
      const raw = BigInt(Math.floor(Number(amtStr) * 10 ** decimals))
      const net = calcNet(raw)
      const q = quoteEthOut(net)
      // 缺省 98% 保护
      const min = (q * 98n) / 100n
      form.setFieldsValue({ minEthOut: min.toString() })
    } catch {}
  }

  async function onSubmit(values: any) {
    try {
      setSubmitting(true)
      setTxError(null)
      const { amount, eth, minEthOut } = values
      const raw = BigInt(Math.floor(Number(amount) * 10 ** decimals))
      const ethBytes = toEthBytes(eth)
      const minOut = BigInt(minEthOut)
      const hash = await signAndSendLocalFromKeystore('memoBridge', 'lockMemoWithProtection', [raw.toString(), Array.from(ethBytes), minOut.toString()])
      console.log('tx hash', hash)
      message.success('提交成功：' + hash)
      form.resetFields()
      refresh()
    } catch (e) {
      console.warn(e)
      const msg = e instanceof Error ? e.message : String(e)
      setTxError(msg)
      message.error('提交失败：' + msg)
    } finally {
      setSubmitting(false)
    }
  }

  function toEthBytes(addr: string): Uint8Array {
    // 简化：去掉 0x 前缀并解析为 20 字节；生产建议用 ethers 校验
    const hex = addr.startsWith('0x') ? addr.slice(2) : addr
    if (hex.length !== 40) throw new Error('ETH 地址长度不合法')
    const out = new Uint8Array(20)
    for (let i = 0; i < 20; i++) {
      out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return out
  }

  return (
    <Flex vertical gap={12} style={{ padding: 12, maxWidth: 414, margin: '0 auto' }}>
      <Card size="small" title="链上价格" loading={loading} extra={<Button size="small" onClick={refresh}>刷新</Button>}>
        <Space wrap>
          <Statistic title="价格分子(num)" value={price ? price.num.toString() : '-'} />
          <Statistic title="价格分母(den)" value={price ? price.den.toString() : '-'} />
          <Statistic title="上次更新(s)" value={price ? Number(price.lastUpdated).toString() : '-'} />
          <Statistic title="陈旧" value={stale ? '是' : '否'} />
          <Statistic title="暂停" value={paused ? '是' : '否'} />
          <Statistic title="费率(bps)" value={bridgeParams?.feeBps ?? 0} />
        </Space>
        {(stale || paused) && <Alert style={{ marginTop: 8 }} type="warning" message={stale ? '价格已陈旧' : '功能暂停'} />}
        {error && (
          <Alert
            style={{ marginTop: 8 }}
            type="error"
            message={error}
            action={<Button size="small" onClick={refresh}>重试</Button>}
          />
        )}
      </Card>

      <Card size="small" title="锁定（报价保护）" extra={<Segmented size="small" value={showWei ? 'wei' : 'ETH'} onChange={(v) => setShowWei(v === 'wei')} options={[{ label: 'ETH', value: 'ETH' }, { label: 'wei', value: 'wei' }]} />}>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label="锁定 DUST 数量" name="amount" rules={[{ required: true, message: '请输入数量' }]}>
            <Input type="number" min={0} placeholder="例如 1.23" onBlur={onEstimateMin} />
          </Form.Item>
          <Form.Item label="ETH 收款地址" name="eth" rules={[{ required: true, message: '请输入 ETH 地址' }]}>
            <Input placeholder="0x 开头 40 位十六进制" />
          </Form.Item>
          <Form.Item label="最小可得 ETH (wei 单位估算)" name="minEthOut" rules={[{ required: true, message: '请输入最小可得' }]}>
            <Input placeholder="建议点击估算按钮后可微调" />
          </Form.Item>
          <Space>
            <Button onClick={onEstimateMin} disabled={loading}>估算</Button>
            <Button onClick={() => quickSet(99)} disabled={loading}>99% 保护</Button>
            <Button onClick={() => quickSet(98)} disabled={loading}>98% 保护</Button>
            <Button type="primary" htmlType="submit" loading={submitting} disabled={paused || stale}>提交锁定</Button>
          </Space>
          {txError && <Alert style={{ marginTop: 8 }} type="error" message={txError} closable onClose={() => setTxError(null)} />}
        </Form>

        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          {renderPreview()}
        </div>
      </Card>
    </Flex>
  )

  function quickSet(pct: 98 | 99) {
    try {
      const amtStr = form.getFieldValue('amount') as string
      if (!amtStr || !price) return
      const raw = BigInt(Math.floor(Number(amtStr) * 10 ** decimals))
      const net = calcNet(raw)
      const q = quoteEthOut(net)
      const min = (q * BigInt(pct)) / 100n
      form.setFieldsValue({ minEthOut: min.toString() })
    } catch {}
  }

  function renderPreview() {
    try {
      const amt = Number(form.getFieldValue('amount') || '0')
      if (!amt || !price) return null
      const raw = BigInt(Math.floor(amt * 10 ** decimals))
      const feeBps = bridgeParams?.feeBps || 0
      const fee = (raw * BigInt(feeBps)) / 10000n
      const net = raw - fee
      const q = quoteEthOut(net)
      const eth = showWei ? q : q / 10n ** 18n
      return `预估：手续费 ${formatDUST(fee)} DUST，净额 ${formatDUST(net)} DUST；预计可得 ${showWei ? nf.format(Number(eth)) + ' wei' : nf.format(Number(eth)) + ' ETH'}`
    } catch { return null }
  }

  function formatDUST(v: bigint): string {
    const d = 10n ** BigInt(decimals)
    const whole = v / d
    const frac = v % d
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
    return fracStr ? `${nf.format(Number(whole))}.${fracStr}` : nf.format(Number(whole))
  }
}

export default BridgeLockPage


