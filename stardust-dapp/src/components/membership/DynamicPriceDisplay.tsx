import React, { useEffect, useState } from 'react'
import { Card, Typography, Space, Tooltip, Spin, Tag, Alert } from 'antd'
import { DollarOutlined, ThunderboltOutlined, SyncOutlined, InfoCircleOutlined } from '@ant-design/icons'
import {
  getDustMarketPrice,
  calculateRequiredDust,
  formatDustAmount,
  formatUsdtPrice,
  formatDustPriceToUsdt,
  calculatePriceChange,
  isValidMarketPrice,
  MEMBERSHIP_USDT_PRICES
} from '../../utils/membershipPricing'

const { Text } = Typography

interface DynamicPriceDisplayProps {
  levelId: number
  levelColor: string
  compact?: boolean
  showMarketPrice?: boolean
  onPriceUpdate?: (dustAmount: number, dustPrice: number) => void
}

/**
 * 函数级详细中文注释：动态价格显示组件
 *
 * 功能：
 * - 显示固定 USDT 价格
 * - 实时查询并显示动态 DUST 数量
 * - 显示 DUST 市场价格
 * - 价格变化提示
 * - 自动刷新价格（每30秒）
 *
 * 🆕 2025-11-10：支持 USDT 固定定价 + DUST 动态计算
 */
const DynamicPriceDisplay: React.FC<DynamicPriceDisplayProps> = ({
  levelId,
  levelColor,
  compact = false,
  showMarketPrice = true,
  onPriceUpdate
}) => {
  const [loading, setLoading] = useState(true)
  const [dustMarketPrice, setDustMarketPrice] = useState<number>(100) // 默认 0.0001 USDT/DUST
  const [requiredDust, setRequiredDust] = useState<number>(0)
  const [lastDustPrice, setLastDustPrice] = useState<number>(100)
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)

  const usdtPrice = MEMBERSHIP_USDT_PRICES[levelId as keyof typeof MEMBERSHIP_USDT_PRICES]

  /**
   * 获取并更新价格
   */
  const fetchPrice = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // 1. 获取 DUST 市场价格
      const marketPrice = await getDustMarketPrice()

      // 2. 计算所需 DUST
      const dust = calculateRequiredDust(levelId, marketPrice)

      // 3. 计算价格变化
      const change = calculatePriceChange(lastDustPrice, marketPrice)

      // 4. 更新状态
      setDustMarketPrice(marketPrice)
      setRequiredDust(dust)
      setPriceChangePercent(change)

      if (!isRefresh) {
        setLastDustPrice(marketPrice)
      }

      // 5. 回调通知父组件
      if (onPriceUpdate) {
        onPriceUpdate(dust, marketPrice)
      }

    } catch (e) {
      console.error('获取价格失败', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  /**
   * 初始加载价格
   */
  useEffect(() => {
    fetchPrice()
  }, [levelId])

  /**
   * 自动刷新价格（每30秒）
   */
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPrice(true)
    }, 30000) // 30秒刷新一次

    return () => clearInterval(interval)
  }, [levelId, lastDustPrice])

  /**
   * 手动刷新
   */
  const handleRefresh = () => {
    setLastDustPrice(dustMarketPrice)
    fetchPrice(true)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <Spin tip="正在获取实时价格..." />
      </div>
    )
  }

  // 紧凑模式显示
  if (compact) {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text strong style={{ fontSize: '20px', color: levelColor }}>
            {formatUsdtPrice(usdtPrice)}
          </Text>
          <Tag color="blue">USDT</Tag>
          {refreshing && <SyncOutlined spin style={{ fontSize: '12px' }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            ≈ {formatDustAmount(requiredDust)} DUST
          </Text>
          <Tooltip title="点击刷新价格">
            <SyncOutlined
              onClick={handleRefresh}
              style={{
                fontSize: '12px',
                cursor: 'pointer',
                color: '#1890ff'
              }}
            />
          </Tooltip>
        </div>
      </Space>
    )
  }

  // 完整模式显示
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* 固定 USDT 价格 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <DollarOutlined style={{ fontSize: '18px', color: levelColor }} />
          <Text strong>固定价格：</Text>
        </Space>
        <Space>
          <Text strong style={{ fontSize: '24px', color: levelColor }}>
            {formatUsdtPrice(usdtPrice)}
          </Text>
          <Tag color="blue">USDT</Tag>
        </Space>
      </div>

      {/* 动态 DUST 数量 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <ThunderboltOutlined style={{ fontSize: '18px', color: '#faad14' }} />
          <Text strong>需要支付：</Text>
          {refreshing && <Spin size="small" />}
        </Space>
        <Space>
          <Text strong style={{ fontSize: '20px' }}>
            {formatDustAmount(requiredDust)}
          </Text>
          <Text type="secondary">DUST</Text>
          <Tooltip title="点击刷新价格">
            <SyncOutlined
              onClick={handleRefresh}
              style={{
                fontSize: '14px',
                cursor: 'pointer',
                color: '#1890ff'
              }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* DUST 市场价格 */}
      {showMarketPrice && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <InfoCircleOutlined style={{ fontSize: '14px', color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              DUST市场价格：
            </Text>
          </Space>
          <Space>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {formatDustPriceToUsdt(dustMarketPrice).toFixed(6)} USDT
            </Text>
            {priceChangePercent !== 0 && (
              <Tag
                color={priceChangePercent > 0 ? 'green' : 'red'}
                style={{ fontSize: '10px', padding: '0 4px' }}
              >
                {priceChangePercent > 0 ? '+' : ''}
                {priceChangePercent.toFixed(2)}%
              </Tag>
            )}
          </Space>
        </div>
      )}

      {/* 价格有效性警告 */}
      {!isValidMarketPrice(dustMarketPrice) && (
        <Alert
          type="warning"
          message="市场价格异常"
          description="当前 DUST 市场价格可能不准确，建议稍后再试或联系客服"
          showIcon
          style={{ fontSize: '12px' }}
        />
      )}

      {/* 价格说明 */}
      <div style={{
        background: '#f5f5f5',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <Space direction="vertical" size={2}>
          <div>💡 价格说明：</div>
          <div>• USDT 价格固定不变</div>
          <div>• DUST 数量根据市场价格实时计算</div>
          <div>• 每30秒自动更新一次</div>
          <div>• 最终价格以交易时为准</div>
        </Space>
      </div>
    </Space>
  )
}

export default DynamicPriceDisplay
