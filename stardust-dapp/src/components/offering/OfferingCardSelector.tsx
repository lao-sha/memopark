import React from 'react'
import { Card, Typography } from 'antd'

/**
 * 函数级详细中文注释：供奉卡片选择器组件
 * - 使用卡片式UI替代下拉选择，更直观美观
 * - 每个供品显示图标、名称、描述、价格
 * - 点击卡片选择供品
 */

export interface OfferingItem {
  id: number          // kind code
  name: string        // 供品名称
  icon: string        // Emoji图标
  description: string // 描述
  price: number       // 单价（MEMO）
  unit: string        // 单位（周、份、束等）
  duration?: boolean  // 是否需要时长
  color: string       // 主题色
}

/**
 * 预设供品列表
 */
export const OFFERINGS: OfferingItem[] = [
  {
    id: 11,
    name: '鲜花',
    icon: '🌸',
    description: '表达思念与敬意',
    price: 5,
    unit: '束',
    duration: false,
    color: 'var(--color-flower)'
  },
  {
    id: 12,
    name: '蜡烛',
    icon: '🕯️',
    description: '照亮前行的路',
    price: 10,
    unit: '周',
    duration: true,
    color: 'var(--color-candle)'
  },
  {
    id: 13,
    name: '清香',
    icon: '🪔',
    description: '传递心愿与祝福',
    price: 8,
    unit: '周',
    duration: true,
    color: 'var(--color-incense)'
  },
  {
    id: 14,
    name: '果品',
    icon: '🍎',
    description: '供养与回馈',
    price: 15,
    unit: '份',
    duration: false,
    color: 'var(--color-fruit)'
  },
  {
    id: 19,
    name: '自定义',
    icon: '✨',
    description: '表达您的心意',
    price: 0,
    unit: '份',
    duration: false,
    color: 'var(--color-primary)'
  }
]

interface SelectorProps {
  onSelect: (item: OfferingItem) => void
  selectedId?: number
}

/**
 * 供奉卡片选择器
 */
export const OfferingCardSelector: React.FC<SelectorProps> = ({ 
  onSelect, 
  selectedId 
}) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
      padding: '16px 0'
    }}>
      {OFFERINGS.map((item) => {
        const isSelected = selectedId === item.id
        
        return (
          <Card
            key={item.id}
            hoverable
            onClick={() => onSelect(item)}
            style={{
              borderRadius: 'var(--radius-lg)',
              border: isSelected 
                ? `2px solid ${item.color}` 
                : '2px solid var(--color-border-light)',
              background: isSelected
                ? `linear-gradient(135deg, ${item.color}15, ${item.color}05)`
                : 'var(--color-bg-elevated)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: isSelected 
                ? 'var(--shadow-md)' 
                : 'var(--shadow-sm)'
            }}
            bodyStyle={{ padding: 16 }}
          >
            {/* 选中标记 */}
            {isSelected && (
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold'
              }}>
                ✓
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              {/* 图标 */}
              <div style={{ 
                fontSize: 48, 
                marginBottom: 8,
                filter: isSelected ? 'none' : 'grayscale(0.3)'
              }}>
                {item.icon}
              </div>

              {/* 名称 */}
              <div style={{
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 4,
                color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)'
              }}>
                {item.name}
              </div>

              {/* 描述 */}
              <div style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                marginBottom: 12,
                minHeight: 34,
                lineHeight: 1.4
              }}>
                {item.description}
              </div>

              {/* 价格 */}
              {item.price > 0 ? (
                <div style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                }}>
                  {item.price} DUST/{item.unit}
                </div>
              ) : (
                <div style={{
                  fontSize: 14,
                  color: 'var(--color-text-tertiary)'
                }}>
                  自定义金额
                </div>
              )}

              {/* 时长标记 */}
              {item.duration && (
                <div style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: 'var(--color-text-tertiary)',
                  fontStyle: 'italic'
                }}>
                  ⏱️ 需选择时长
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/**
 * 根据kind code获取供品信息
 */
export const getOfferingById = (id: number): OfferingItem | undefined => {
  return OFFERINGS.find(item => item.id === id)
}

/**
 * 根据kind code获取供品名称
 */
export const getOfferingName = (id: number): string => {
  const item = getOfferingById(id)
  return item ? item.name : `供品 #${id}`
}

/**
 * 根据kind code获取供品图标
 */
export const getOfferingIcon = (id: number): string => {
  const item = getOfferingById(id)
  return item ? item.icon : '✨'
}

export default OfferingCardSelector

