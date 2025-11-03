/**
 * 纪念馆首页内容组件
 * 
 * 功能说明：
 * 1. 展示概览信息（生平摘要、精选照片、最新留言）
 * 2. 显示重要日期
 * 3. 快速导航到其他标签页
 * 
 * 创建日期：2025-11-02
 */

import React from 'react'
import { Card, Space, Typography, Tag, Image, Row, Col, Button, Empty } from 'antd'
import {
  FileTextOutlined,
  PictureOutlined,
  MessageOutlined,
  CalendarOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { DeceasedInfo } from '../../../services/deceasedService'
import { MemorialColors } from '../../../theme/colors'

const { Title, Paragraph, Text } = Typography

interface HomeSectionProps {
  /** 逝者信息 */
  deceased: DeceasedInfo
  /** 切换到其他标签 */
  onNavigate: (tab: string) => void
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
 * 函数级详细中文注释：计算享年
 */
const calculateAge = (deceased: DeceasedInfo): number => {
  if (deceased.lifeYears !== undefined) return deceased.lifeYears
  const blocksPerYear = 5_256_000
  return Math.floor((deceased.deathDate - deceased.birthDate) / blocksPerYear)
}

/**
 * 函数级详细中文注释：纪念馆首页内容组件
 */
export const HomeSection: React.FC<HomeSectionProps> = ({ deceased, onNavigate }) => {
  const birthDate = formatDate(deceased.birthDate)
  const deathDate = formatDate(deceased.deathDate)
  const age = calculateAge(deceased)

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* 基本信息卡片 */}
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
            <CalendarOutlined style={{ fontSize: 20, color: MemorialColors.primary }} />
            <Title level={4} style={{ margin: 0 }}>
              生命历程
            </Title>
          </div>

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${MemorialColors.primaryBg} 0%, ${MemorialColors.bgSecondary} 100%)`,
                  border: `1px solid ${MemorialColors.borderLight}`,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  出生日期
                </Text>
                <Text strong style={{ fontSize: 14 }}>
                  {birthDate}
                </Text>
              </div>
            </Col>
            <Col span={12}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${MemorialColors.secondaryBg} 0%, ${MemorialColors.bgSecondary} 100%)`,
                  border: `1px solid ${MemorialColors.borderLight}`,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  逝世日期
                </Text>
                <Text strong style={{ fontSize: 14 }}>
                  {deathDate}
                </Text>
              </div>
            </Col>
          </Row>

          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <Tag
              color={MemorialColors.primary}
              style={{
                fontSize: 16,
                padding: '6px 20px',
                borderRadius: 16,
                border: 'none',
              }}
            >
              享年 {age} 岁
            </Tag>
          </div>
        </Space>
      </Card>

      {/* 生平概要卡片 */}
      <Card
        bordered={false}
        title={
          <Space>
            <FileTextOutlined style={{ color: MemorialColors.primary }} />
            <span>生平概要</span>
          </Space>
        }
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => onNavigate('biography')}
            icon={<RightOutlined />}
            iconPosition="end"
          >
            查看详情
          </Button>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '20px' }}
      >
        {deceased.bio ? (
          <Paragraph
            ellipsis={{ rows: 3, expandable: false }}
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              color: MemorialColors.textPrimary,
              marginBottom: 0,
            }}
          >
            {deceased.bio}
          </Paragraph>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无生平简介"
            imageStyle={{ height: 40 }}
          />
        )}
      </Card>

      {/* 精选照片卡片 */}
      <Card
        bordered={false}
        title={
          <Space>
            <PictureOutlined style={{ color: MemorialColors.primary }} />
            <span>精选照片</span>
          </Space>
        }
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => onNavigate('photos')}
            icon={<RightOutlined />}
            iconPosition="end"
          >
            查看更多
          </Button>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '16px' }}
      >
        {deceased.mainImageCid ? (
          <Image
            src={`https://ipfs.io/ipfs/${deceased.mainImageCid}`}
            alt="遗像"
            style={{
              width: '100%',
              maxHeight: 200,
              objectFit: 'cover',
              borderRadius: 8,
            }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无照片"
            imageStyle={{ height: 60 }}
          />
        )}
      </Card>

      {/* 最新留言卡片 */}
      <Card
        bordered={false}
        title={
          <Space>
            <MessageOutlined style={{ color: MemorialColors.primary }} />
            <span>最新留言</span>
          </Space>
        }
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => onNavigate('messages')}
            icon={<RightOutlined />}
            iconPosition="end"
          >
            查看全部
          </Button>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无留言"
          imageStyle={{ height: 40 }}
        >
          <Button
            type="primary"
            onClick={() => onNavigate('messages')}
            style={{
              backgroundColor: MemorialColors.primary,
              borderColor: MemorialColors.primary,
            }}
          >
            写下第一条留言
          </Button>
        </Empty>
      </Card>
    </div>
  )
}

