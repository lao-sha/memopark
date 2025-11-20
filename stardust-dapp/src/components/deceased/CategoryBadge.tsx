/**
 * 逝者分类标签组件
 *
 * 功能说明：
 * 1. 显示逝者的分类标签
 * 2. 根据不同分类显示不同的颜色和图标
 * 3. 支持点击事件（可选）
 *
 * 创建日期：2025-11-09
 */

import React from 'react'
import { Tag } from 'antd'
import type { TagProps } from 'antd'
import {
  UserOutlined,
  BookOutlined,
  TrophyOutlined,
  FireOutlined,
  StarOutlined,
  HeartOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { DeceasedCategory } from '../../services/deceasedService'

interface CategoryBadgeProps {
  /** 分类类型 */
  category: DeceasedCategory
  /** 是否显示图标 */
  showIcon?: boolean
  /** 点击事件 */
  onClick?: () => void
  /** 自定义样式 */
  style?: React.CSSProperties
}

/**
 * 函数级详细中文注释：获取分类配置信息
 */
const getCategoryConfig = (category: DeceasedCategory) => {
  const configs: Record<DeceasedCategory, {
    label: string
    color: TagProps['color']
    icon: React.ReactNode
  }> = {
    [DeceasedCategory.Ordinary]: {
      label: '普通民众',
      color: 'default',
      icon: <UserOutlined />,
    },
    [DeceasedCategory.HistoricalFigure]: {
      label: '历史人物',
      color: 'blue',
      icon: <BookOutlined />,
    },
    [DeceasedCategory.Martyr]: {
      label: '革命烈士',
      color: 'red',
      icon: <FireOutlined />,
    },
    [DeceasedCategory.Hero]: {
      label: '英雄模范',
      color: 'gold',
      icon: <TrophyOutlined />,
    },
    [DeceasedCategory.PublicFigure]: {
      label: '公众人物',
      color: 'purple',
      icon: <StarOutlined />,
    },
    [DeceasedCategory.ReligiousFigure]: {
      label: '宗教人物',
      color: 'cyan',
      icon: <HeartOutlined />,
    },
    [DeceasedCategory.EventHall]: {
      label: '事件馆',
      color: 'orange',
      icon: <HomeOutlined />,
    },
  }

  return configs[category] || configs[DeceasedCategory.Ordinary]
}

/**
 * 函数级详细中文注释：分类标签组件
 */
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  showIcon = true,
  onClick,
  style,
}) => {
  const config = getCategoryConfig(category)

  return (
    <Tag
      color={config.color}
      icon={showIcon ? config.icon : undefined}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
    >
      {config.label}
    </Tag>
  )
}

/**
 * 函数级详细中文注释：获取分类标签文本（无图标）
 */
export const getCategoryLabel = (category: DeceasedCategory): string => {
  const config = getCategoryConfig(category)
  return config.label
}

/**
 * 函数级详细中文注释：获取分类颜色
 */
export const getCategoryColor = (category: DeceasedCategory): string => {
  const config = getCategoryConfig(category)
  return config.color as string
}
