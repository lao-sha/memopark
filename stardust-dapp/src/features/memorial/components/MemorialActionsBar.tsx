/**
 * 纪念馆底部操作栏组件
 * 
 * 功能说明：
 * 1. 提供快捷祭拜操作按钮（献花、蜡烛、敬香、祭品、留言）
 * 2. 固定在底部，移动端友好
 * 3. 点击弹出供奉表单
 * 4. 支持自定义操作项
 * 
 * 创建日期：2025-11-02
 */

import React from 'react'
import { Space, Button, Badge } from 'antd'
import {
  HeartOutlined,
  FireOutlined,
  CoffeeOutlined,
  GiftOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { MemorialColors } from '../../../theme/colors'

export type ActionType = 'flower' | 'candle' | 'incense' | 'offering' | 'message'

interface MemorialActionsBarProps {
  /** 操作回调 */
  onAction: (type: ActionType) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 是否显示留言按钮 */
  showMessage?: boolean
  /** 未读留言数 */
  unreadMessages?: number
}

/**
 * 函数级详细中文注释：操作项配置
 */
interface ActionConfig {
  type: ActionType
  label: string
  icon: React.ReactNode
  color: string
}

/**
 * 函数级详细中文注释：纪念馆底部操作栏组件
 */
export const MemorialActionsBar: React.FC<MemorialActionsBarProps> = ({
  onAction,
  disabled = false,
  showMessage = true,
  unreadMessages = 0,
}) => {
  // 操作项配置
  const actions: ActionConfig[] = [
    {
      type: 'flower',
      label: '献花',
      icon: <HeartOutlined />,
      color: MemorialColors.flower,
    },
    {
      type: 'candle',
      label: '蜡烛',
      icon: <FireOutlined />,
      color: MemorialColors.candle,
    },
    {
      type: 'incense',
      label: '敬香',
      icon: <CoffeeOutlined />,
      color: MemorialColors.incense,
    },
    {
      type: 'offering',
      label: '祭品',
      icon: <GiftOutlined />,
      color: MemorialColors.fruit,
    },
  ]

  // 如果显示留言按钮，添加到操作列表
  if (showMessage) {
    actions.push({
      type: 'message',
      label: '留言',
      icon: <MessageOutlined />,
      color: MemorialColors.secondary,
    })
  }

  /**
   * 函数级详细中文注释：渲染操作按钮
   */
  const renderActionButton = (action: ActionConfig) => {
    const isMessage = action.type === 'message'
    
    const button = (
      <Button
        key={action.type}
        type={isMessage ? 'default' : 'primary'}
        size="large"
        icon={action.icon}
        onClick={() => onAction(action.type)}
        disabled={disabled}
        style={{
          flex: 1,
          height: 50,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 500,
          backgroundColor: isMessage ? '#fff' : action.color,
          borderColor: isMessage ? MemorialColors.border : action.color,
          color: isMessage ? action.color : '#fff',
          boxShadow: isMessage ? 'none' : `0 2px 8px ${action.color}40`,
          transition: 'all 0.3s ease',
        }}
      >
        {action.label}
      </Button>
    )

    // 如果是留言按钮且有未读消息，显示徽章
    if (isMessage && unreadMessages > 0) {
      return (
        <Badge key={action.type} count={unreadMessages} offset={[-10, 8]}>
          {button}
        </Badge>
      )
    }

    return button
  }

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.98) 40%, #fff 100%)',
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${MemorialColors.borderLight}`,
        zIndex: 100,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <Space
        size={8}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        {actions.map(action => renderActionButton(action))}
      </Space>
    </div>
  )
}

