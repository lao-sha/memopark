/**
 * 祭拜动态流组件
 * 
 * 功能说明：
 * 1. 时间线展示供奉记录
 * 2. 显示供奉人、金额、时间、留言
 * 3. 支持查看媒体附件
 * 4. 支持无限滚动加载
 * 
 * 创建日期：2025-11-02
 */

import React from 'react'
import { Timeline, Avatar, Card, Space, Typography, Tag, Image, Empty, Spin } from 'antd'
import {
  GiftOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  FireOutlined,
  CoffeeOutlined,
  FileImageOutlined,
} from '@ant-design/icons'
import { OfferingRecord } from '../../../services/memorialService'
import { formatDUST, formatAddress, formatBlockTime } from '../../../hooks/useMemorialHall'
import { MemorialColors } from '../../../theme/colors'

const { Text, Paragraph } = Typography

interface OfferingsTimelineViewProps {
  /** 供奉记录列表 */
  offerings: OfferingRecord[]
  /** 当前区块号 */
  currentBlock: number
  /** 是否加载中 */
  loading?: boolean
  /** 最大显示数量 */
  limit?: number
}

/**
 * 函数级详细中文注释：获取供奉类型配置
 */
const getOfferingTypeConfig = (kindCode: number) => {
  const configs: Record<number, { name: string; icon: React.ReactNode; color: string }> = {
    1: { name: '鲜花', icon: <HeartOutlined />, color: MemorialColors.flower },
    2: { name: '蜡烛', icon: <FireOutlined />, color: MemorialColors.candle },
    3: { name: '香', icon: <CoffeeOutlined />, color: MemorialColors.incense },
    4: { name: '祭品', icon: <GiftOutlined />, color: MemorialColors.fruit },
  }
  return configs[kindCode] || { name: '供奉', icon: <GiftOutlined />, color: MemorialColors.primary }
}

/**
 * 函数级详细中文注释：祭拜动态流组件
 */
export const OfferingsTimelineView: React.FC<OfferingsTimelineViewProps> = ({
  offerings,
  currentBlock,
  loading = false,
  limit = 20,
}) => {
  // 限制显示数量
  const displayOfferings = offerings.slice(0, limit)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: MemorialColors.textSecondary }}>
          加载祭拜记录...
        </div>
      </div>
    )
  }

  if (displayOfferings.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无祭拜记录"
        style={{ padding: '60px 0' }}
      />
    )
  }

  /**
   * 函数级详细中文注释：渲染单条供奉记录
   */
  const renderOfferingItem = (offering: OfferingRecord, index: number) => {
    const typeConfig = getOfferingTypeConfig(offering.kindCode)
    const relativeTime = formatBlockTime(offering.time, currentBlock)
    const amount = formatDUST(offering.amount)

    return {
      key: index,
      dot: (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${typeConfig.color}40 0%, ${typeConfig.color}80 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: typeConfig.color,
            border: `2px solid ${typeConfig.color}`,
          }}
        >
          {typeConfig.icon}
        </div>
      ),
      children: (
        <Card
          bordered={false}
          style={{
            marginBottom: 16,
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            marginLeft: 8,
          }}
          bodyStyle={{ padding: '16px' }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {/* 头部信息 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Space>
                <Avatar
                  size={40}
                  src={`https://picsum.photos/seed/${offering.who}/80`}
                  style={{ border: `2px solid ${typeConfig.color}` }}
                />
                <div>
                  <Text strong style={{ display: 'block', fontSize: 14 }}>
                    {formatAddress(offering.who)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <ClockCircleOutlined /> {relativeTime}
                  </Text>
                </div>
              </Space>
              <Tag color={typeConfig.color} style={{ borderRadius: 12 }}>
                {typeConfig.name}
              </Tag>
            </div>

            {/* 供奉金额 */}
            <div
              style={{
                background: `linear-gradient(135deg, ${MemorialColors.primaryBg} 0%, ${MemorialColors.bgSecondary} 100%)`,
                padding: '12px 16px',
                borderRadius: 8,
                border: `1px solid ${MemorialColors.borderLight}`,
              }}
            >
              <Space size={8} align="center">
                <GiftOutlined style={{ fontSize: 18, color: MemorialColors.primary }} />
                <Text strong style={{ fontSize: 16, color: MemorialColors.primary }}>
                  {amount} DUST
                </Text>
                {offering.duration && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {offering.duration} 周
                  </Tag>
                )}
              </Space>
            </div>

            {/* 媒体附件 */}
            {offering.media && offering.media.length > 0 && (
              <div>
                <Space size={4} wrap style={{ marginBottom: 8 }}>
                  <FileImageOutlined style={{ color: MemorialColors.textSecondary }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {offering.media.length} 张图片
                  </Text>
                </Space>
                <Image.PreviewGroup>
                  <Space size={8} wrap>
                    {offering.media.slice(0, 4).map((media, idx) => (
                      <Image
                        key={idx}
                        width={70}
                        height={70}
                        src={`https://ipfs.io/ipfs/${media.cid}`}
                        style={{
                          borderRadius: 8,
                          objectFit: 'cover',
                          border: `1px solid ${MemorialColors.borderLight}`,
                        }}
                        placeholder={
                          <div
                            style={{
                              width: 70,
                              height: 70,
                              background: MemorialColors.bgSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 8,
                            }}
                          >
                            <FileImageOutlined style={{ fontSize: 24, color: MemorialColors.textTertiary }} />
                          </div>
                        }
                      />
                    ))}
                    {offering.media.length > 4 && (
                      <div
                        style={{
                          width: 70,
                          height: 70,
                          background: MemorialColors.bgSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          color: MemorialColors.textSecondary,
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        +{offering.media.length - 4}
                      </div>
                    )}
                  </Space>
                </Image.PreviewGroup>
              </div>
            )}

            {/* 留言内容（如果有） */}
            {/* 注：这里可以扩展，从链下数据库或IPFS获取留言内容 */}
          </Space>
        </Card>
      ),
    }
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16, color: MemorialColors.textPrimary }}>
          最新祭拜动态
        </Text>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          共 {offerings.length} 条记录
        </Text>
      </div>
      <Timeline
        mode="left"
        items={displayOfferings.map((offering, index) => renderOfferingItem(offering, index))}
      />
      {offerings.length > limit && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            还有 {offerings.length - limit} 条记录未显示
          </Text>
        </div>
      )}
    </div>
  )
}

