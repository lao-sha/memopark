/**
 * 纪念馆统计卡片组件
 * 
 * 功能说明：
 * 1. 展示关键统计数据（访问量、祭拜数、留言数等）
 * 2. 支持数字动画效果
 * 3. 响应式网格布局
 * 4. 图标+数字+标签展示
 * 
 * 创建日期：2025-11-02
 */

import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Space } from 'antd'
import {
  EyeOutlined,
  GiftOutlined,
  MessageOutlined,
  HeartOutlined,
  FireOutlined,
  CoffeeOutlined,
} from '@ant-design/icons'
import { MemorialStatistics } from '../../../hooks/useMemorialHall'
import { MemorialColors } from '../../../theme/colors'

interface StatisticsCardsProps {
  /** 统计数据 */
  statistics: MemorialStatistics
  /** 是否加载中 */
  loading?: boolean
}

/**
 * 函数级详细中文注释：统计项配置
 */
interface StatItemConfig {
  key: keyof MemorialStatistics
  label: string
  icon: React.ReactNode
  color: string
  formatter?: (value: any) => string
}

/**
 * 函数级详细中文注释：统计卡片组件
 */
export const StatisticsCards: React.FC<StatisticsCardsProps> = ({
  statistics,
  loading = false,
}) => {
  const [animatedStats, setAnimatedStats] = useState(statistics)

  // 数字动画效果
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedStats(statistics)
    }, 100)
    return () => clearTimeout(timer)
  }, [statistics])

  // 统计项配置
  const statItems: StatItemConfig[] = [
    {
      key: 'visitCount',
      label: '访问量',
      icon: <EyeOutlined />,
      color: MemorialColors.info,
    },
    {
      key: 'totalOffers',
      label: '祭拜数',
      icon: <GiftOutlined />,
      color: MemorialColors.primary,
    },
    {
      key: 'messageCount',
      label: '留言数',
      icon: <MessageOutlined />,
      color: MemorialColors.secondary,
    },
    {
      key: 'flowerCount',
      label: '鲜花',
      icon: <HeartOutlined />,
      color: MemorialColors.flower,
    },
    {
      key: 'candleCount',
      label: '蜡烛',
      icon: <FireOutlined />,
      color: MemorialColors.candle,
    },
    {
      key: 'incenseCount',
      label: '香',
      icon: <CoffeeOutlined />,
      color: MemorialColors.incense,
    },
  ]

  // 主要统计（前3个）
  const mainStats = statItems.slice(0, 3)
  // 次要统计（后3个）
  const secondaryStats = statItems.slice(3)

  /**
   * 函数级详细中文注释：渲染统计项
   */
  const renderStatItem = (config: StatItemConfig, span: number = 8) => {
    const value = animatedStats[config.key]
    const displayValue = typeof value === 'string' ? parseInt(value) || 0 : value

    return (
      <Col span={span} key={config.key}>
        <div
          style={{
            textAlign: 'center',
            padding: '16px 8px',
            borderRadius: 8,
            background: `linear-gradient(135deg, ${config.color}10 0%, ${config.color}20 100%)`,
            transition: 'all 0.3s ease',
          }}
        >
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ fontSize: 24, color: config.color }}>
              {config.icon}
            </div>
            <Statistic
              value={displayValue}
              valueStyle={{
                fontSize: 20,
                fontWeight: 600,
                color: MemorialColors.textPrimary,
              }}
              loading={loading}
            />
            <div
              style={{
                fontSize: 12,
                color: MemorialColors.textSecondary,
                marginTop: 4,
              }}
            >
              {config.label}
            </div>
          </Space>
        </div>
      </Col>
    )
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* 主要统计卡片 */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '12px' }}
      >
        <Row gutter={[12, 12]}>
          {mainStats.map(config => renderStatItem(config, 8))}
        </Row>
      </Card>

      {/* 次要统计卡片（祭品详情） */}
      <Card
        bordered={false}
        title={
          <span style={{ fontSize: 14, color: MemorialColors.textSecondary }}>
            祭品统计
          </span>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
        bodyStyle={{ padding: '12px' }}
        headStyle={{
          borderBottom: `1px solid ${MemorialColors.borderLight}`,
          minHeight: 40,
          padding: '8px 16px',
        }}
      >
        <Row gutter={[12, 12]}>
          {secondaryStats.map(config => renderStatItem(config, 8))}
        </Row>
      </Card>
    </div>
  )
}

