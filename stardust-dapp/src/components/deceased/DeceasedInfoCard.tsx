/**
 * 逝者信息卡片组件
 * 
 * 功能说明：
 * 1. 展示逝者基本信息
 * 2. 显示主图和生平简介
 * 3. Pin状态指示器
 * 4. 生命周期时间轴
 * 5. 所有权信息
 * 6. 快捷操作（编辑/转移/删除）
 * 
 * 创建日期：2025-10-28
 */

import React, { useState } from 'react'
import { Card, Space, Typography, Tag, Avatar, Badge, Tooltip, Row, Col, Button, Modal, message } from 'antd'
import { 
  UserOutlined, 
  CalendarOutlined,
  EditOutlined,
  DeleteOutlined,
  SwapOutlined,
  PushpinOutlined,
  HeartOutlined,
  ManOutlined,
  WomanOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createDeceasedService, 
  type DeceasedInfo,
  Gender,
  PinStatus,
} from '../../services/deceasedService'

const { Text, Title, Paragraph } = Typography

interface DeceasedInfoCardProps {
  /** 逝者信息 */
  deceased: DeceasedInfo
  /** 当前用户地址 */
  currentAccount?: string
  /** 刷新回调 */
  onRefresh?: () => void
  /** 编辑回调 */
  onEdit?: (deceased: DeceasedInfo) => void
  /** 是否显示详细信息 */
  detailed?: boolean
}

/**
 * 函数级详细中文注释：Pin状态配置
 */
const pinStatusConfig = {
  [PinStatus.Unpinned]: { label: '未固定', color: 'default', icon: '○' },
  [PinStatus.Pinning]: { label: '固定中', color: 'processing', icon: '⟳' },
  [PinStatus.Pinned]: { label: '已固定', color: 'success', icon: '✓' },
  [PinStatus.PinFailed]: { label: '固定失败', color: 'error', icon: '✗' },
}

/**
 * 函数级详细中文注释：性别图标配置
 */
const genderConfig = {
  [Gender.Male]: { label: '男', icon: <ManOutlined />, color: '#1890ff' },
  [Gender.Female]: { label: '女', icon: <WomanOutlined />, color: '#eb2f96' },
  [Gender.Other]: { label: '其他', icon: <UserOutlined />, color: '#999' },
}

/**
 * 函数级详细中文注释：格式化日期（区块号 → 日期字符串）
 */
const formatDate = (blockNumber: number): string => {
  // 假设6秒/块，估算日期
  const timestamp = Date.now() - (Date.now() / 1000 - blockNumber * 6) * 1000
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

/**
 * 函数级详细中文注释：格式化地址（显示前6后4）
 */
const formatAddress = (address: string): string => {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * 函数级详细中文注释：逝者信息卡片组件
 */
export const DeceasedInfoCard: React.FC<DeceasedInfoCardProps> = ({ 
  deceased, 
  currentAccount,
  onRefresh,
  onEdit,
  detailed = true,
}) => {
  const [loading, setLoading] = useState(false)
  
  const isOwner = currentAccount === deceased.owner
  const isCreator = currentAccount === deceased.creator
  const genderInfo = genderConfig[deceased.gender]

  /**
   * 函数级详细中文注释：删除逝者
   */
  const handleDelete = async () => {
    if (!isCreator) {
      message.error('仅创建者可以删除')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除逝者"${deceased.fullName}"吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const api = await getApi()
          const service = createDeceasedService(api)
          
          const tx = service.buildDeleteDeceasedTx(deceased.id)

          const { web3FromAddress } = await import('@polkadot/extension-dapp')
          const injector = await web3FromAddress(currentAccount!)

          await tx.signAndSend(
            currentAccount!,
            { signer: injector.signer },
            ({ status }) => {
              if (status.isFinalized) {
                message.success('删除成功')
                onRefresh?.()
              }
            }
          )
        } catch (error: any) {
          message.error(error.message || '删除失败')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  /**
   * 函数级详细中文注释：渲染Pin状态指示器
   */
  const renderPinStatus = (status: PinStatus, label: string) => {
    const config = pinStatusConfig[status]
    return (
      <Tooltip title={`${label}: ${config.label}`}>
        <Badge 
          status={config.color as any} 
          text={config.icon}
        />
      </Tooltip>
    )
  }

  /**
   * 函数级详细中文注释：渲染操作按钮
   */
  const renderActions = () => {
    if (!currentAccount) return null

    const actions: React.ReactNode[] = []

    if (isOwner) {
      actions.push(
        <Button
          key="edit"
          type="primary"
          icon={<EditOutlined />}
          onClick={() => onEdit?.(deceased)}
          loading={loading}
        >
          编辑
        </Button>
      )
    }

    if (isCreator) {
      actions.push(
        <Button
          key="delete"
          danger
          icon={<DeleteOutlined />}
          onClick={handleDelete}
          loading={loading}
        >
          删除
        </Button>
      )
    }

    return actions.length > 0 ? (
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Space>{actions}</Space>
      </div>
    ) : null
  }

  return (
    <Card
      style={{ 
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
      cover={
        deceased.mainImageCid && (
          <div style={{ position: 'relative' }}>
            <img
              alt={deceased.fullName}
              src={`https://ipfs.io/ipfs/${deceased.mainImageCid}`}
              style={{ 
                width: '100%', 
                height: 300, 
                objectFit: 'cover',
                borderRadius: '12px 12px 0 0',
              }}
            />
            {renderPinStatus(deceased.mainImagePinStatus, '主图')}
          </div>
        )
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 头部：姓名和性别 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Avatar 
              size={48} 
              icon={genderInfo.icon} 
              style={{ backgroundColor: genderInfo.color }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {deceased.fullName}
                {renderPinStatus(deceased.fullNamePinStatus, '姓名')}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {deceased.id}
              </Text>
            </div>
          </Space>
          <Tag color={genderInfo.color} icon={genderInfo.icon}>
            {genderInfo.label}
          </Tag>
        </div>

        {/* 生命周期 */}
        <div style={{ 
          background: '#f5f5f5', 
          padding: 16, 
          borderRadius: 8,
        }}>
          <Row gutter={16}>
            <Col span={12}>
              <Space direction="vertical" size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>出生日期</Text>
                <Text strong>
                  <CalendarOutlined /> {formatDate(deceased.birthDate)}
                </Text>
              </Space>
            </Col>
            <Col span={12}>
              <Space direction="vertical" size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>逝世日期</Text>
                <Text strong>
                  <HeartOutlined /> {formatDate(deceased.deathDate)}
                </Text>
              </Space>
            </Col>
          </Row>
          {deceased.lifeYears !== undefined && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <Tag color="purple" style={{ fontSize: 14 }}>
                享年 {deceased.lifeYears} 岁
              </Tag>
            </div>
          )}
        </div>

        {/* 生平简介 */}
        {detailed && deceased.bio && (
          <div>
            <Space>
              <Text strong>生平简介</Text>
              {renderPinStatus(deceased.bioPinStatus, '简介')}
            </Space>
            <Paragraph 
              style={{ marginTop: 8 }}
              ellipsis={{ rows: 3, expandable: true }}
            >
              {deceased.bio}
            </Paragraph>
          </div>
        )}

        {/* 所有权信息 */}
        {detailed && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Space>
                <UserOutlined style={{ color: '#999' }} />
                <Text type="secondary">所有者：</Text>
                <Tooltip title={deceased.owner}>
                  <Text>{formatAddress(deceased.owner)}</Text>
                </Tooltip>
                {isOwner && <Tag color="green">我</Tag>}
              </Space>
            </div>
            <div>
              <Space>
                <UserOutlined style={{ color: '#999' }} />
                <Text type="secondary">创建者：</Text>
                <Tooltip title={deceased.creator}>
                  <Text>{formatAddress(deceased.creator)}</Text>
                </Tooltip>
                {isCreator && <Tag color="blue">我</Tag>}
              </Space>
            </div>
          </Space>
        )}

        {/* 时间信息 */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <Space size="large" wrap>
            <Tooltip title={`区块 #${deceased.createdAt}`}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CalendarOutlined /> 创建于: {formatDate(deceased.createdAt)}
              </Text>
            </Tooltip>
            <Tooltip title={`区块 #${deceased.updatedAt}`}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                更新于: {formatDate(deceased.updatedAt)}
              </Text>
            </Tooltip>
          </Space>
        </div>

        {/* 操作按钮 */}
        {renderActions()}
      </Space>
    </Card>
  )
}

