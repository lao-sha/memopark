/**
 * 统一金额格式化组件
 *
 * 功能说明：
 * 1. 提供统一的DUST/USDT金额显示格式
 * 2. 自动处理链上数值的缩放转换
 * 3. 支持汇率显示和转换
 * 4. 支持加载状态和错误处理
 *
 * 创建日期：2025-11-22
 */

import React from 'react'
import { Typography, Spin, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

export interface AmountFormatterProps {
  /** DUST金额（链上原始值，已包含1e12缩放） */
  dustAmount?: string | number
  /** USDT金额（整数，无需缩放） */
  usdtAmount?: number
  /** 汇率（链上值，需除以1e6） */
  exchangeRate?: number
  /** 显示模式 */
  mode?: 'dust' | 'usdt' | 'both' | 'auto'
  /** 是否显示汇率信息 */
  showRate?: boolean
  /** 是否加粗显示 */
  strong?: boolean
  /** 是否显示加载状态 */
  loading?: boolean
  /** 错误信息 */
  error?: string
  /** 自定义后缀 */
  suffix?: string
  /** 精度控制 */
  precision?: number
}

/**
 * 函数级详细中文注释：格式化DUST金额（从链上值转换为显示值）
 */
export const formatDustAmount = (
  amount: string | number,
  precision: number = 4
): string => {
  if (!amount) return '0'

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numAmount)) return '0'

  // 链上DUST值需要除以1e12转换为实际值
  const actualAmount = numAmount / 1e12
  return actualAmount.toFixed(precision)
}

/**
 * 函数级详细中文注释：格式化汇率（从链上值转换为显示值）
 */
export const formatExchangeRate = (
  rate: number,
  precision: number = 6
): string => {
  if (!rate) return '0'

  // 链上汇率值需要除以1e6转换为实际汇率
  const actualRate = rate / 1e6
  return actualRate.toFixed(precision)
}

/**
 * 函数级详细中文注释：DUST转USDT计算
 */
export const convertDustToUsdt = (
  dustAmount: string | number,
  exchangeRate: number,
  precision: number = 2
): string => {
  if (!dustAmount || !exchangeRate) return '0'

  const numDust = typeof dustAmount === 'string' ? parseFloat(dustAmount) : dustAmount
  const actualDust = numDust / 1e12
  const actualRate = exchangeRate / 1e6

  return (actualDust * actualRate).toFixed(precision)
}

/**
 * 函数级详细中文注释：金额格式化组件
 */
export const AmountFormatter: React.FC<AmountFormatterProps> = ({
  dustAmount,
  usdtAmount,
  exchangeRate,
  mode = 'auto',
  showRate = false,
  strong = false,
  loading = false,
  error,
  suffix,
  precision = 4
}) => {
  if (loading) {
    return <Spin size="small" style={{ marginRight: 8 }} />
  }

  if (error) {
    return (
      <Text type="danger" title={error}>
        加载失败
      </Text>
    )
  }

  const TextComponent = strong ? (props: any) => <Text strong {...props} /> : Text

  // 自动模式：优先显示USDT，回退到DUST
  const displayMode = mode === 'auto' ? (
    usdtAmount !== undefined ? 'usdt' : 'dust'
  ) : mode

  const renderDustAmount = () => {
    if (!dustAmount) return '0'
    const formatted = formatDustAmount(dustAmount, precision)
    return (
      <TextComponent>
        {formatted} DUST{suffix}
      </TextComponent>
    )
  }

  const renderUsdtAmount = () => {
    if (usdtAmount === undefined) return null
    return (
      <TextComponent>
        {usdtAmount} USDT{suffix}
      </TextComponent>
    )
  }

  const renderBothAmounts = () => {
    const usdtDisplay = usdtAmount !== undefined ? `${usdtAmount} USDT` :
      (dustAmount && exchangeRate ? `≈${convertDustToUsdt(dustAmount, exchangeRate)} USDT` : '')
    const dustDisplay = dustAmount ? formatDustAmount(dustAmount, precision) : '0'

    return (
      <TextComponent>
        {dustDisplay} DUST
        {usdtDisplay && ` (${usdtDisplay})`}
        {suffix}
      </TextComponent>
    )
  }

  const renderRateInfo = () => {
    if (!showRate || !exchangeRate) return null

    return (
      <Tooltip title={`当前汇率：1 DUST = ${formatExchangeRate(exchangeRate)} USDT`}>
        <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
      </Tooltip>
    )
  }

  return (
    <span>
      {displayMode === 'dust' && renderDustAmount()}
      {displayMode === 'usdt' && renderUsdtAmount()}
      {displayMode === 'both' && renderBothAmounts()}
      {renderRateInfo()}
    </span>
  )
}

/**
 * 函数级详细中文注释：简化的DUST金额显示组件
 */
export const DustAmount: React.FC<{
  amount: string | number
  precision?: number
  strong?: boolean
  loading?: boolean
}> = ({ amount, precision = 4, strong = false, loading = false }) => {
  return (
    <AmountFormatter
      dustAmount={amount}
      mode="dust"
      strong={strong}
      loading={loading}
      precision={precision}
    />
  )
}

/**
 * 函数级详细中文注释：简化的USDT金额显示组件
 */
export const UsdtAmount: React.FC<{
  amount: number
  strong?: boolean
  loading?: boolean
}> = ({ amount, strong = false, loading = false }) => {
  return (
    <AmountFormatter
      usdtAmount={amount}
      mode="usdt"
      strong={strong}
      loading={loading}
    />
  )
}

export default AmountFormatter