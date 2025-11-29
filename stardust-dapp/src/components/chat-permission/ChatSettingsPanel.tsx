/**
 * 聊天隐私设置面板
 *
 * 功能说明：
 * 1. 显示当前隐私设置摘要
 * 2. 设置权限级别（公开/仅好友/白名单/关闭）
 * 3. 管理黑名单/白名单
 * 4. 设置拒绝的场景类型
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 */

import React, { useState } from 'react'
import {
  Card,
  Radio,
  Switch,
  List,
  Avatar,
  Button,
  Empty,
  Spin,
  Typography,
  Space,
  Tag,
  Divider,
  Modal,
  Input,
  message,
} from 'antd'
import {
  GlobalOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  StopOutlined,
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  UserOutlined,
  ShopOutlined,
  FileTextOutlined,
  HeartOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import {
  usePrivacySettings,
  useSetPermissionLevel,
  useBlockUser,
  useUnblockUser,
  useAddToWhitelist,
  useRemoveFromWhitelist,
  useSetRejectedSceneTypes,
} from '../../hooks/useChatPermission'
import {
  ChatPermissionLevel,
  PermissionLevelDisplay,
  PermissionLevelDescription,
  SceneType,
  SceneTypeDisplay,
} from '../../types/chatPermission'
import './ChatSettingsPanel.css'

const { Text, Title, Paragraph } = Typography

// ========== 类型定义 ==========

interface ChatSettingsPanelProps {
  /** 自定义类名 */
  className?: string
  /** 是否紧凑模式 */
  compact?: boolean
}

// ========== 权限级别图标映射 ==========

const permissionLevelIconMap: Record<ChatPermissionLevel, React.ReactNode> = {
  [ChatPermissionLevel.Open]: <GlobalOutlined />,
  [ChatPermissionLevel.FriendsOnly]: <TeamOutlined />,
  [ChatPermissionLevel.Whitelist]: <UnorderedListOutlined />,
  [ChatPermissionLevel.Closed]: <StopOutlined />,
}

// ========== 场景类型图标映射 ==========

const sceneTypeIconMap: Record<SceneType, React.ReactNode> = {
  [SceneType.MarketMaker]: <ShopOutlined />,
  [SceneType.Order]: <FileTextOutlined />,
  [SceneType.Memorial]: <HeartOutlined />,
  [SceneType.Group]: <TeamOutlined />,
  [SceneType.Custom]: <AppstoreOutlined />,
}

// ========== 主组件 ==========

/**
 * 函数级详细中文注释：聊天隐私设置面板组件
 *
 * ### 功能
 * 提供完整的聊天隐私设置管理界面。
 *
 * ### 使用示例
 * ```tsx
 * <ChatSettingsPanel />
 * ```
 */
export const ChatSettingsPanel: React.FC<ChatSettingsPanelProps> = ({
  className = '',
  compact = false,
}) => {
  // 状态
  const [showAddWhitelistModal, setShowAddWhitelistModal] = useState(false)
  const [newWhitelistAddress, setNewWhitelistAddress] = useState('')

  // 获取隐私设置
  const { data: privacySettings, isLoading, error } = usePrivacySettings()

  // Mutations
  const setPermissionLevelMutation = useSetPermissionLevel()
  const blockUserMutation = useBlockUser()
  const unblockUserMutation = useUnblockUser()
  const addToWhitelistMutation = useAddToWhitelist()
  const removeFromWhitelistMutation = useRemoveFromWhitelist()
  const setRejectedSceneTypesMutation = useSetRejectedSceneTypes()

  // 处理权限级别变更
  const handlePermissionLevelChange = async (level: ChatPermissionLevel) => {
    try {
      await setPermissionLevelMutation.mutateAsync(level)
    } catch (error) {
      console.error('设置权限级别失败:', error)
    }
  }

  // 处理场景类型拒绝设置变更
  const handleSceneTypeToggle = async (sceneType: SceneType, rejected: boolean) => {
    if (!privacySettings) return

    const currentRejected = privacySettings.rejectedSceneTypes || []
    let newRejected: SceneType[]

    if (rejected) {
      // 添加到拒绝列表
      newRejected = [...currentRejected, sceneType]
    } else {
      // 从拒绝列表移除
      newRejected = currentRejected.filter((t) => t !== sceneType)
    }

    try {
      await setRejectedSceneTypesMutation.mutateAsync(newRejected)
    } catch (error) {
      console.error('设置拒绝场景类型失败:', error)
    }
  }

  // 处理添加白名单
  const handleAddToWhitelist = async () => {
    if (!newWhitelistAddress.trim()) {
      message.error('请输入地址')
      return
    }

    try {
      await addToWhitelistMutation.mutateAsync(newWhitelistAddress.trim())
      setNewWhitelistAddress('')
      setShowAddWhitelistModal(false)
    } catch (error) {
      console.error('添加白名单失败:', error)
    }
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className={`chat-settings-panel chat-settings-loading ${className}`}>
        <Spin size="large" />
        <Text type="secondary">加载隐私设置...</Text>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={`chat-settings-panel chat-settings-error ${className}`}>
        <Empty description="加载失败" />
      </div>
    )
  }

  // 未设置
  if (!privacySettings) {
    return (
      <div className={`chat-settings-panel ${className}`}>
        <Empty description="暂无隐私设置" />
      </div>
    )
  }

  return (
    <div className={`chat-settings-panel ${compact ? 'compact' : ''} ${className}`}>
      {/* 权限级别设置 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>聊天权限级别</span>
          </Space>
        }
        className="settings-card"
        size={compact ? 'small' : 'default'}
      >
        <Radio.Group
          value={privacySettings.permissionLevel}
          onChange={(e) => handlePermissionLevelChange(e.target.value)}
          className="permission-level-group"
        >
          <Space direction="vertical" className="permission-level-options">
            {Object.values(ChatPermissionLevel).map((level) => (
              <Radio key={level} value={level} className="permission-level-option">
                <div className="permission-level-content">
                  <Space>
                    {permissionLevelIconMap[level]}
                    <span className="permission-level-name">
                      {PermissionLevelDisplay[level]}
                    </span>
                  </Space>
                  <Text type="secondary" className="permission-level-desc">
                    {PermissionLevelDescription[level]}
                  </Text>
                </div>
              </Radio>
            ))}
          </Space>
        </Radio.Group>

        {setPermissionLevelMutation.isPending && (
          <div className="mutation-loading">
            <Spin size="small" />
            <Text type="secondary">保存中...</Text>
          </div>
        )}
      </Card>

      <Divider />

      {/* 场景授权设置 */}
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>场景授权接受</span>
          </Space>
        }
        className="settings-card"
        size={compact ? 'small' : 'default'}
      >
        <Paragraph type="secondary" className="scene-setting-hint">
          关闭的场景类型将不接受该类场景的聊天授权
        </Paragraph>

        <List
          className="scene-type-list"
          dataSource={Object.values(SceneType)}
          renderItem={(sceneType) => {
            const isRejected = privacySettings.rejectedSceneTypes?.includes(sceneType)
            return (
              <List.Item
                key={sceneType}
                className="scene-type-item"
                actions={[
                  <Switch
                    key="switch"
                    checked={!isRejected}
                    onChange={(checked) => handleSceneTypeToggle(sceneType, !checked)}
                    loading={setRejectedSceneTypesMutation.isPending}
                  />,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={sceneTypeIconMap[sceneType]}
                      style={{ backgroundColor: isRejected ? '#f5f5f5' : '#e6f7ff' }}
                    />
                  }
                  title={SceneTypeDisplay[sceneType]}
                  description={isRejected ? '已拒绝' : '接受授权'}
                />
              </List.Item>
            )
          }}
        />
      </Card>

      <Divider />

      {/* 黑名单/白名单统计 */}
      <Card
        title={
          <Space>
            <UnorderedListOutlined />
            <span>名单管理</span>
          </Space>
        }
        className="settings-card"
        size={compact ? 'small' : 'default'}
      >
        <div className="list-stats">
          <div className="list-stat-item">
            <div className="stat-icon blacklist">
              <StopOutlined />
            </div>
            <div className="stat-content">
              <div className="stat-value">{privacySettings.blockListCount}</div>
              <div className="stat-label">黑名单</div>
            </div>
          </div>

          <div className="list-stat-item">
            <div className="stat-icon whitelist">
              <UnorderedListOutlined />
            </div>
            <div className="stat-content">
              <div className="stat-value">{privacySettings.whitelistCount}</div>
              <div className="stat-label">白名单</div>
            </div>
          </div>
        </div>

        {/* 白名单模式下显示添加按钮 */}
        {privacySettings.permissionLevel === ChatPermissionLevel.Whitelist && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            onClick={() => setShowAddWhitelistModal(true)}
            className="add-whitelist-btn"
          >
            添加白名单用户
          </Button>
        )}
      </Card>

      {/* 添加白名单弹窗 */}
      <Modal
        title="添加白名单用户"
        open={showAddWhitelistModal}
        onOk={handleAddToWhitelist}
        onCancel={() => {
          setShowAddWhitelistModal(false)
          setNewWhitelistAddress('')
        }}
        confirmLoading={addToWhitelistMutation.isPending}
        okText="添加"
        cancelText="取消"
      >
        <Input
          placeholder="请输入用户地址"
          value={newWhitelistAddress}
          onChange={(e) => setNewWhitelistAddress(e.target.value)}
          prefix={<UserOutlined />}
        />
      </Modal>
    </div>
  )
}

export default ChatSettingsPanel
