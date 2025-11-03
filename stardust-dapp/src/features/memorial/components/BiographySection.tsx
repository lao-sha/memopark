/**
 * 生平简介组件
 * 
 * 功能说明：
 * 1. 展示逝者完整生平简介
 * 2. 显示重要事件时间轴
 * 3. 支持折叠展开
 * 4. 响应式布局
 * 
 * 创建日期：2025-11-02
 */

import React, { useState } from 'react'
import { Card, Typography, Timeline, Space, Button, Empty } from 'antd'
import {
  FileTextOutlined,
  CalendarOutlined,
  TrophyOutlined,
  HeartOutlined,
} from '@ant-design/icons'
import { DeceasedInfo } from '../../../services/deceasedService'
import { MemorialColors } from '../../../theme/colors'

const { Title, Paragraph, Text } = Typography

interface BiographySectionProps {
  /** 逝者信息 */
  deceased: DeceasedInfo
}

/**
 * 函数级详细中文注释：格式化日期
 */
const formatDate = (blockNumber: number): string => {
  const estimatedDate = new Date(Date.now() - (Date.now() / 1000 - blockNumber * 6) * 1000)
  return estimatedDate.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

/**
 * 函数级详细中文注释：生平简介组件
 */
export const BiographySection: React.FC<BiographySectionProps> = ({ deceased }) => {
  const [expanded, setExpanded] = useState(false)

  // 模拟重要事件时间轴（实际应从IPFS或链下数据库获取）
  const lifeEvents = [
    {
      date: formatDate(deceased.birthDate),
      title: '出生',
      description: `生于 ${formatDate(deceased.birthDate)}`,
      icon: <HeartOutlined />,
      color: MemorialColors.flower,
    },
    // 可以添加更多事件
    {
      date: formatDate(deceased.deathDate),
      title: '逝世',
      description: `逝于 ${formatDate(deceased.deathDate)}`,
      icon: <HeartOutlined />,
      color: MemorialColors.textSecondary,
    },
  ]

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* 生平简介卡片 */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ fontSize: 20, color: MemorialColors.primary }} />
            <Title level={4} style={{ margin: 0 }}>
              生平简介
            </Title>
          </div>

          {deceased.bio ? (
            <>
              <Paragraph
                ellipsis={
                  expanded
                    ? false
                    : {
                        rows: 5,
                        expandable: false,
                      }
                }
                style={{
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: MemorialColors.textPrimary,
                  marginBottom: 0,
                }}
              >
                {deceased.bio}
              </Paragraph>
              {deceased.bio.length > 200 && (
                <Button
                  type="link"
                  onClick={() => setExpanded(!expanded)}
                  style={{ padding: 0, height: 'auto' }}
                >
                  {expanded ? '收起' : '展开全部'}
                </Button>
              )}
            </>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无生平简介"
              style={{ margin: '20px 0' }}
            />
          )}
        </Space>
      </Card>

      {/* 重要事件时间轴 */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 20, color: MemorialColors.primary }} />
            <Title level={4} style={{ margin: 0 }}>
              生命历程
            </Title>
          </div>

          <Timeline
            mode="left"
            items={lifeEvents.map(event => ({
              dot: (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${event.color}40 0%, ${event.color}80 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: event.color,
                    border: `2px solid ${event.color}`,
                  }}
                >
                  {event.icon}
                </div>
              ),
              children: (
                <div style={{ marginLeft: 8 }}>
                  <Text strong style={{ fontSize: 15 }}>
                    {event.title}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {event.description}
                  </Text>
                </div>
              ),
            }))}
          />
        </Space>
      </Card>
    </div>
  )
}

