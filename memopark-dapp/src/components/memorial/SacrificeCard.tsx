/**
 * 祭祀品卡片组件
 * 
 * 功能说明：
 * 1. 展示祭祀品的图片、名称、描述
 * 2. 显示价格信息（固定价或按周单价）
 * 3. 显示场景和类目标签
 * 4. 支持VIP专属标识
 * 5. 支持快速下单按钮
 * 
 * 创建日期：2025-10-28
 */

import React from 'react'
import { Card, Tag, Space, Typography, Button, Tooltip } from 'antd'
import { 
  CrownOutlined, 
  ShoppingCartOutlined,
  FireOutlined,
  HeartOutlined,
  CoffeeOutlined,
  GiftOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import type { SacrificeItem, Scene, Category } from '../../services/memorialService'

const { Text, Title, Paragraph } = Typography

interface SacrificeCardProps {
  /** 祭祀品信息 */
  sacrifice: SacrificeItem
  /** 是否显示下单按钮 */
  showOrderButton?: boolean
  /** 下单回调 */
  onOrder?: (sacrifice: SacrificeItem) => void
  /** 是否显示管理按钮 */
  showManageButtons?: boolean
  /** 编辑回调 */
  onEdit?: (sacrifice: SacrificeItem) => void
  /** 是否为VIP用户 */
  isVip?: boolean
}

/**
 * 函数级详细中文注释：场景标签配置
 */
const sceneConfig = {
  0: { label: '墓地', color: 'blue', icon: <FireOutlined /> },      // Grave
  1: { label: '宠物', color: 'green', icon: <HeartOutlined /> },     // Pet
  2: { label: '公园', color: 'cyan', icon: <AppstoreOutlined /> },   // Park
  3: { label: '纪念馆', color: 'purple', icon: <CrownOutlined /> },  // Memorial
}

/**
 * 函数级详细中文注释：类目标签配置
 */
const categoryConfig = {
  0: { label: '鲜花', color: 'pink' },      // Flower
  1: { label: '蜡烛', color: 'orange' },    // Candle
  2: { label: '食品', color: 'gold' },      // Food
  3: { label: '玩具', color: 'purple' },    // Toy
  4: { label: '其他', color: 'default' },   // Other
}

/**
 * 函数级详细中文注释：格式化MEMO金额
 * @param amount MEMO最小单位金额
 * @returns 格式化后的字符串
 */
const formatMEMO = (amount: string): string => {
  const memo = BigInt(amount) / BigInt(1_000_000)
  return memo.toLocaleString() + ' MEMO'
}

/**
 * 函数级详细中文注释：祭祀品卡片组件
 */
export const SacrificeCard: React.FC<SacrificeCardProps> = ({ 
  sacrifice, 
  showOrderButton = false,
  onOrder,
  showManageButtons = false,
  onEdit,
  isVip = false,
}) => {
  const scene = sceneConfig[sacrifice.scene]
  const category = categoryConfig[sacrifice.category]

  /**
   * 函数级详细中文注释：渲染价格信息
   */
  const renderPrice = () => {
    if (sacrifice.fixedPrice && sacrifice.unitPricePerWeek) {
      // 两种价格都有
      return (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">固定价：</Text>
            <Text strong style={{ fontSize: 16, marginLeft: 8 }}>
              {formatMEMO(sacrifice.fixedPrice)}
            </Text>
          </div>
          <div>
            <Text type="secondary">按周：</Text>
            <Text strong style={{ fontSize: 16, marginLeft: 8 }}>
              {formatMEMO(sacrifice.unitPricePerWeek)}/周
            </Text>
          </div>
        </Space>
      )
    } else if (sacrifice.fixedPrice) {
      // 仅固定价
      return (
        <div>
          <Text type="secondary">价格：</Text>
          <Text strong style={{ fontSize: 18, marginLeft: 8, color: '#1890ff' }}>
            {formatMEMO(sacrifice.fixedPrice)}
          </Text>
        </div>
      )
    } else if (sacrifice.unitPricePerWeek) {
      // 仅按周单价
      return (
        <div>
          <Text type="secondary">价格：</Text>
          <Text strong style={{ fontSize: 18, marginLeft: 8, color: '#1890ff' }}>
            {formatMEMO(sacrifice.unitPricePerWeek)}/周
          </Text>
        </div>
      )
    } else {
      return <Text type="secondary">价格未设置</Text>
    }
  }

  /**
   * 函数级详细中文注释：计算VIP折扣后价格
   */
  const renderVipPrice = () => {
    if (!isVip || !sacrifice.isVipExclusive) return null

    const calculateDiscount = (price: string) => {
      const original = BigInt(price)
      const discounted = (original * BigInt(70)) / BigInt(100)
      return discounted.toString()
    }

    if (sacrifice.fixedPrice) {
      return (
        <Tooltip title="VIP专属30%折扣">
          <Text type="success" style={{ fontSize: 14 }}>
            <CrownOutlined /> VIP价: {formatMEMO(calculateDiscount(sacrifice.fixedPrice))}
          </Text>
        </Tooltip>
      )
    } else if (sacrifice.unitPricePerWeek) {
      return (
        <Tooltip title="VIP专属30%折扣">
          <Text type="success" style={{ fontSize: 14 }}>
            <CrownOutlined /> VIP价: {formatMEMO(calculateDiscount(sacrifice.unitPricePerWeek))}/周
          </Text>
        </Tooltip>
      )
    }

    return null
  }

  return (
    <Card
      hoverable={showOrderButton}
      style={{ 
        borderRadius: 12,
        overflow: 'hidden',
        opacity: sacrifice.status === 'Enabled' ? 1 : 0.6,
      }}
      cover={
        <div
          style={{
            height: 200,
            background: `linear-gradient(135deg, ${scene?.color || '#ccc'} 0%, #f0f0f0 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {sacrifice.resourceUrl ? (
            <img 
              src={sacrifice.resourceUrl} 
              alt={sacrifice.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <GiftOutlined style={{ fontSize: 64, color: '#fff' }} />
          )}
          
          {/* VIP专属标识 */}
          {sacrifice.isVipExclusive && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                padding: '4px 12px',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <CrownOutlined style={{ color: '#fff', marginRight: 4 }} />
              <Text strong style={{ color: '#fff', fontSize: 12 }}>
                VIP专属
              </Text>
            </div>
          )}

          {/* 状态标识 */}
          {sacrifice.status !== 'Enabled' && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
              }}
            >
              <Tag color={sacrifice.status === 'Disabled' ? 'default' : 'warning'}>
                {sacrifice.status === 'Disabled' ? '已禁用' : '已隐藏'}
              </Tag>
            </div>
          )}
        </div>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 标题和标签 */}
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            {sacrifice.name}
          </Title>
          <Space size="small">
            <Tag color={scene?.color} icon={scene?.icon}>
              {scene?.label}
            </Tag>
            <Tag color={category?.color}>
              {category?.label}
            </Tag>
          </Space>
        </div>

        {/* 描述 */}
        {sacrifice.description && (
          <Paragraph 
            ellipsis={{ rows: 2 }} 
            style={{ marginBottom: 0, color: '#666' }}
          >
            {sacrifice.description}
          </Paragraph>
        )}

        {/* 价格信息 */}
        <div style={{ 
          background: '#f5f5f5', 
          padding: '12px 16px', 
          borderRadius: 8 
        }}>
          {renderPrice()}
          {renderVipPrice()}
        </div>

        {/* 操作按钮 */}
        {showOrderButton && sacrifice.status === 'Enabled' && (
          <Button 
            type="primary" 
            block 
            icon={<ShoppingCartOutlined />}
            onClick={() => onOrder?.(sacrifice)}
            style={{
              borderRadius: 8,
              height: 40,
              fontSize: 16,
            }}
          >
            立即供奉
          </Button>
        )}

        {showManageButtons && (
          <Space style={{ width: '100%' }}>
            <Button 
              block 
              onClick={() => onEdit?.(sacrifice)}
            >
              编辑
            </Button>
          </Space>
        )}

        {/* 元信息 */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <Space size="large">
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: #{sacrifice.id}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              创建于: 区块 {sacrifice.created.toLocaleString()}
            </Text>
          </Space>
        </div>
      </Space>
    </Card>
  )
}

