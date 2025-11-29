/**
 * 聊天权限守卫组件
 *
 * 功能说明：
 * 1. 在发起聊天前检查权限
 * 2. 显示权限状态和拒绝原因
 * 3. 提供添加好友/解除拉黑等操作入口
 * 4. 支持自定义渲染被拒绝时的UI
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 */

import React, { useMemo } from 'react'
import { Result, Button, Tag, Spin, Typography, Space } from 'antd'
import {
  CheckCircleOutlined,
  StopOutlined,
  UserAddOutlined,
  LockOutlined,
  TeamOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useChatPermission, useAddFriend } from '../../hooks/useChatPermission'
import {
  PermissionResultType,
  SceneType,
  SceneTypeDisplay,
  isPermissionAllowed,
  getPermissionDeniedReason,
} from '../../types/chatPermission'
import './PermissionGuard.css'

const { Text, Paragraph } = Typography

// ========== 类型定义 ==========

interface PermissionGuardProps {
  /** 目标用户地址 */
  targetUser: string
  /** 子元素（权限通过时渲染） */
  children: React.ReactNode
  /** 自定义被拒绝时的渲染 */
  renderDenied?: (reason: string, resultType: PermissionResultType) => React.ReactNode
  /** 是否显示加载状态 */
  showLoading?: boolean
  /** 是否紧凑模式 */
  compact?: boolean
  /** 权限检查完成回调 */
  onPermissionChecked?: (isAllowed: boolean, resultType: PermissionResultType) => void
}

// ========== 权限状态图标映射 ==========

const permissionIconMap: Record<PermissionResultType, React.ReactNode> = {
  [PermissionResultType.Allowed]: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  [PermissionResultType.AllowedByFriendship]: <TeamOutlined style={{ color: '#1890ff' }} />,
  [PermissionResultType.AllowedByScene]: <SafetyOutlined style={{ color: '#722ed1' }} />,
  [PermissionResultType.DeniedBlocked]: <StopOutlined style={{ color: '#ff4d4f' }} />,
  [PermissionResultType.DeniedRequiresFriend]: <UserAddOutlined style={{ color: '#faad14' }} />,
  [PermissionResultType.DeniedNotInWhitelist]: <LockOutlined style={{ color: '#fa8c16' }} />,
  [PermissionResultType.DeniedClosed]: <ExclamationCircleOutlined style={{ color: '#999' }} />,
}

// ========== 主组件 ==========

/**
 * 函数级详细中文注释：聊天权限守卫组件
 *
 * ### 功能
 * 在发起聊天前检查权限，根据权限状态显示相应UI。
 *
 * ### 使用示例
 * ```tsx
 * <PermissionGuard targetUser={targetAddress}>
 *   <ChatWindow />
 * </PermissionGuard>
 * ```
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  targetUser,
  children,
  renderDenied,
  showLoading = true,
  compact = false,
  onPermissionChecked,
}) => {
  // 获取权限检查结果
  const { data: permission, isLoading, error } = useChatPermission(targetUser)

  // 添加好友 mutation
  const addFriendMutation = useAddFriend()

  // 计算权限状态
  const permissionStatus = useMemo(() => {
    if (!permission) return null

    const isAllowed = permission.isAllowed
    const resultType = permission.result.type

    // 通知父组件权限检查结果
    onPermissionChecked?.(isAllowed, resultType)

    return {
      isAllowed,
      resultType,
      deniedReason: permission.deniedReason || getPermissionDeniedReason(permission.result),
      activeScenes: permission.activeScenes,
      receiverPrivacy: permission.receiverPrivacy,
    }
  }, [permission, onPermissionChecked])

  // 处理添加好友
  const handleAddFriend = async () => {
    try {
      await addFriendMutation.mutateAsync(targetUser)
    } catch (error) {
      console.error('添加好友失败:', error)
    }
  }

  // 加载状态
  if (isLoading && showLoading) {
    return (
      <div className={`permission-guard permission-guard-loading ${compact ? 'compact' : ''}`}>
        <Spin size={compact ? 'small' : 'default'} />
        {!compact && <Text type="secondary">检查聊天权限...</Text>}
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={`permission-guard permission-guard-error ${compact ? 'compact' : ''}`}>
        <Result
          status="warning"
          title={compact ? undefined : '权限检查失败'}
          subTitle={compact ? '检查失败' : '无法获取聊天权限状态，请稍后重试'}
          extra={
            !compact && (
              <Button type="primary" onClick={() => window.location.reload()}>
                刷新页面
              </Button>
            )
          }
        />
      </div>
    )
  }

  // 无权限数据
  if (!permissionStatus) {
    return null
  }

  // 权限通过 - 渲染子元素
  if (permissionStatus.isAllowed) {
    return (
      <>
        {/* 可选：显示权限状态指示器 */}
        {compact && permissionStatus.resultType !== PermissionResultType.Allowed && (
          <div className="permission-indicator">
            {permissionIconMap[permissionStatus.resultType]}
            {permissionStatus.resultType === PermissionResultType.AllowedByFriendship && (
              <Tag color="blue" className="permission-tag">好友</Tag>
            )}
            {permissionStatus.resultType === PermissionResultType.AllowedByScene && (
              <Tag color="purple" className="permission-tag">
                {permissionStatus.activeScenes?.[0]
                  ? SceneTypeDisplay[permissionStatus.activeScenes[0]]
                  : '场景授权'}
              </Tag>
            )}
          </div>
        )}
        {children}
      </>
    )
  }

  // 权限被拒绝 - 自定义渲染
  if (renderDenied) {
    return (
      <>
        {renderDenied(permissionStatus.deniedReason, permissionStatus.resultType)}
      </>
    )
  }

  // 权限被拒绝 - 默认渲染
  return (
    <div className={`permission-guard permission-guard-denied ${compact ? 'compact' : ''}`}>
      {compact ? (
        // 紧凑模式
        <div className="permission-denied-compact">
          {permissionIconMap[permissionStatus.resultType]}
          <Text type="secondary">{permissionStatus.deniedReason}</Text>
          {permissionStatus.resultType === PermissionResultType.DeniedRequiresFriend && (
            <Button
              type="link"
              size="small"
              icon={<UserAddOutlined />}
              onClick={handleAddFriend}
              loading={addFriendMutation.isPending}
            >
              添加好友
            </Button>
          )}
        </div>
      ) : (
        // 完整模式
        <Result
          icon={permissionIconMap[permissionStatus.resultType]}
          title="无法发送消息"
          subTitle={permissionStatus.deniedReason}
          extra={
            <Space direction="vertical" align="center">
              {/* 需要添加好友 */}
              {permissionStatus.resultType === PermissionResultType.DeniedRequiresFriend && (
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={handleAddFriend}
                  loading={addFriendMutation.isPending}
                >
                  添加好友
                </Button>
              )}

              {/* 被拉黑 */}
              {permissionStatus.resultType === PermissionResultType.DeniedBlocked && (
                <Paragraph type="secondary" className="permission-hint">
                  您已被对方加入黑名单，无法发送消息
                </Paragraph>
              )}

              {/* 不在白名单 */}
              {permissionStatus.resultType === PermissionResultType.DeniedNotInWhitelist && (
                <Paragraph type="secondary" className="permission-hint">
                  对方设置了白名单模式，只有白名单用户可以发送消息
                </Paragraph>
              )}

              {/* 对方关闭聊天 */}
              {permissionStatus.resultType === PermissionResultType.DeniedClosed && (
                <Paragraph type="secondary" className="permission-hint">
                  对方已关闭聊天功能，暂时无法联系
                </Paragraph>
              )}

              {/* 显示对方隐私设置级别 */}
              {permissionStatus.receiverPrivacy && (
                <div className="receiver-privacy-info">
                  <Text type="secondary" className="privacy-label">
                    对方隐私设置：
                  </Text>
                  <Tag>{permissionStatus.receiverPrivacy.permissionLevel}</Tag>
                </div>
              )}
            </Space>
          }
        />
      )}
    </div>
  )
}

// ========== 权限状态显示组件 ==========

interface PermissionStatusBadgeProps {
  /** 目标用户地址 */
  targetUser: string
  /** 是否只显示图标 */
  iconOnly?: boolean
}

/**
 * 函数级详细中文注释：权限状态徽章组件
 *
 * ### 功能
 * 简洁显示当前用户与目标用户的聊天权限状态。
 */
export const PermissionStatusBadge: React.FC<PermissionStatusBadgeProps> = ({
  targetUser,
  iconOnly = false,
}) => {
  const { data: permission, isLoading } = useChatPermission(targetUser)

  if (isLoading) {
    return <Spin size="small" />
  }

  if (!permission) {
    return null
  }

  const icon = permissionIconMap[permission.result.type]
  const isAllowed = permission.isAllowed

  if (iconOnly) {
    return <span className="permission-status-icon">{icon}</span>
  }

  return (
    <Tag
      color={isAllowed ? 'success' : 'error'}
      icon={icon}
      className="permission-status-badge"
    >
      {isAllowed ? '可聊天' : '不可聊天'}
    </Tag>
  )
}

export default PermissionGuard
