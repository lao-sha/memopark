/**
 * 场景标签栏组件
 *
 * 功能说明：
 * 1. 显示当前用户与目标用户之间的所有有效场景授权
 * 2. 支持切换不同场景类型
 * 3. 显示场景过期状态
 * 4. 点击场景可查看详情
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 */

import React, { useMemo } from 'react'
import { Tag, Tooltip, Badge, Empty, Spin } from 'antd'
import {
  ShopOutlined,
  FileTextOutlined,
  HeartOutlined,
  TeamOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useSceneAuthorizations } from '../../hooks/useChatPermission'
import {
  SceneType,
  SceneTypeDisplay,
  SceneAuthorizationInfo,
} from '../../types/chatPermission'
import './SceneTabBar.css'

// ========== 类型定义 ==========

interface SceneTabBarProps {
  /** 目标用户地址 */
  targetUser: string
  /** 当前选中的场景类型 */
  selectedSceneType?: SceneType
  /** 场景类型切换回调 */
  onSceneSelect?: (sceneType: SceneType, scene: SceneAuthorizationInfo) => void
  /** 是否显示全部场景标签 */
  showAllTab?: boolean
  /** 自定义类名 */
  className?: string
}

// ========== 场景图标映射 ==========

const sceneIconMap: Record<SceneType, React.ReactNode> = {
  [SceneType.MarketMaker]: <ShopOutlined />,
  [SceneType.Order]: <FileTextOutlined />,
  [SceneType.Memorial]: <HeartOutlined />,
  [SceneType.Group]: <TeamOutlined />,
  [SceneType.Custom]: <AppstoreOutlined />,
}

// ========== 场景颜色映射 ==========

const sceneColorMap: Record<SceneType, string> = {
  [SceneType.MarketMaker]: '#1890ff',
  [SceneType.Order]: '#52c41a',
  [SceneType.Memorial]: '#eb2f96',
  [SceneType.Group]: '#722ed1',
  [SceneType.Custom]: '#fa8c16',
}

// ========== 主组件 ==========

/**
 * 函数级详细中文注释：场景标签栏组件
 *
 * ### 功能
 * 显示当前用户与目标用户之间的所有有效场景授权，支持切换查看。
 *
 * ### 使用示例
 * ```tsx
 * <SceneTabBar
 *   targetUser="5GrwvaEF..."
 *   selectedSceneType={SceneType.Order}
 *   onSceneSelect={(type, scene) => handleSceneChange(type, scene)}
 * />
 * ```
 */
export const SceneTabBar: React.FC<SceneTabBarProps> = ({
  targetUser,
  selectedSceneType,
  onSceneSelect,
  showAllTab = false,
  className = '',
}) => {
  // 获取场景授权列表
  const { data: scenes, isLoading, error } = useSceneAuthorizations(targetUser)

  // 按场景类型分组
  const groupedScenes = useMemo(() => {
    if (!scenes || scenes.length === 0) return new Map<SceneType, SceneAuthorizationInfo[]>()

    const grouped = new Map<SceneType, SceneAuthorizationInfo[]>()
    scenes.forEach((scene) => {
      if (!scene.isExpired) {
        const existing = grouped.get(scene.sceneType) || []
        existing.push(scene)
        grouped.set(scene.sceneType, existing)
      }
    })
    return grouped
  }, [scenes])

  // 获取场景数量
  const sceneCount = useMemo(() => {
    let count = 0
    groupedScenes.forEach((items) => {
      count += items.length
    })
    return count
  }, [groupedScenes])

  // 渲染场景标签
  const renderSceneTag = (sceneType: SceneType, sceneList: SceneAuthorizationInfo[]) => {
    const isSelected = selectedSceneType === sceneType
    const icon = sceneIconMap[sceneType]
    const color = sceneColorMap[sceneType]
    const displayText = SceneTypeDisplay[sceneType]
    const firstScene = sceneList[0]

    // 检查是否有即将过期的场景
    const hasExpiringSoon = sceneList.some(
      (s) => s.expiresAt && s.expiresAt > 0
    )

    return (
      <Tooltip
        key={sceneType}
        title={
          <div className="scene-tooltip">
            <div className="scene-tooltip-title">{displayText}</div>
            <div className="scene-tooltip-count">
              共 {sceneList.length} 个有效授权
            </div>
            {hasExpiringSoon && (
              <div className="scene-tooltip-expiry">
                <ClockCircleOutlined /> 部分授权有时效限制
              </div>
            )}
          </div>
        }
      >
        <Tag
          className={`scene-tag ${isSelected ? 'scene-tag-selected' : ''}`}
          color={isSelected ? color : undefined}
          onClick={() => onSceneSelect?.(sceneType, firstScene)}
          style={{
            cursor: 'pointer',
            borderColor: isSelected ? color : undefined,
          }}
        >
          <span className="scene-tag-icon">{icon}</span>
          <span className="scene-tag-text">{displayText}</span>
          {sceneList.length > 1 && (
            <Badge
              count={sceneList.length}
              size="small"
              style={{
                backgroundColor: isSelected ? '#fff' : color,
                color: isSelected ? color : '#fff',
                marginLeft: 4,
              }}
            />
          )}
        </Tag>
      </Tooltip>
    )
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className={`scene-tab-bar scene-tab-bar-loading ${className}`}>
        <Spin size="small" />
        <span className="loading-text">加载场景授权...</span>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={`scene-tab-bar scene-tab-bar-error ${className}`}>
        <span className="error-text">加载失败</span>
      </div>
    )
  }

  // 无授权场景
  if (sceneCount === 0) {
    return (
      <div className={`scene-tab-bar scene-tab-bar-empty ${className}`}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无场景授权"
          className="scene-empty"
        />
      </div>
    )
  }

  return (
    <div className={`scene-tab-bar ${className}`}>
      <div className="scene-tab-bar-inner">
        {/* 全部标签 */}
        {showAllTab && (
          <Tag
            className={`scene-tag ${!selectedSceneType ? 'scene-tag-selected' : ''}`}
            color={!selectedSceneType ? '#666' : undefined}
            onClick={() => onSceneSelect?.(undefined as any, undefined as any)}
            style={{ cursor: 'pointer' }}
          >
            <AppstoreOutlined />
            <span className="scene-tag-text">全部</span>
            <Badge count={sceneCount} size="small" style={{ marginLeft: 4 }} />
          </Tag>
        )}

        {/* 场景类型标签 */}
        {Array.from(groupedScenes.entries()).map(([sceneType, sceneList]) =>
          renderSceneTag(sceneType, sceneList)
        )}
      </div>
    </div>
  )
}

export default SceneTabBar
