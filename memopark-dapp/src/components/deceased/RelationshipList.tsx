import React from 'react'
import { List, Tag, Typography, Avatar, Space, Alert, Spin, Empty, Button } from 'antd'
import { UserOutlined, ManOutlined, WomanOutlined } from '@ant-design/icons'
import { useRelationships, useDeceasedDetail, getRelationLabel } from '../../hooks/useRelationships'

/**
 * 函数级详细中文注释：家族关系列表组件
 * 
 * ### 功能
 * - 显示某个逝者的所有家族关系
 * - 点击关联逝者查看详情
 * - 按关系类型分组展示
 * 
 * ### 设计理念
 * - **简单直观**：列表展示，易于浏览
 * - **交互友好**：点击跳转、悬停提示
 * - **性能优化**：懒加载、批量查询
 * 
 * ### 使用场景
 * - 逝者详情页：展示家族关系
 * - 家族关系管理页：管理关系
 */

export interface RelationshipListProps {
  /** 逝者ID */
  deceasedId: number
  /** 点击关联逝者时的回调 */
  onDeceasedClick?: (deceasedId: number) => void
  /** 是否显示详细信息 */
  showDetails?: boolean
  /** 是否按类型分组 */
  groupByKind?: boolean
}

const RelationshipList: React.FC<RelationshipListProps> = ({
  deceasedId,
  onDeceasedClick,
  showDetails = true,
  groupByKind = false,
}) => {
  const { relationships, loading, error } = useRelationships(deceasedId)

  // 按关系类型分组
  const groupedRelationships = React.useMemo(() => {
    if (!groupByKind) return { all: relationships }
    
    const groups: Record<string, typeof relationships> = {
      parents: [],
      spouses: [],
      siblings: [],
      children: [],
      others: [],
    }
    
    relationships.forEach(rel => {
      switch (rel.kind) {
        case 0:
          groups.parents.push(rel)
          break
        case 1:
          groups.spouses.push(rel)
          break
        case 2:
          groups.siblings.push(rel)
          break
        case 3:
          groups.children.push(rel)
          break
        default:
          groups.others.push(rel)
      }
    })
    
    return groups
  }, [relationships, groupByKind])

  // 加载中
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="加载家族关系中..." />
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="加载失败"
        description={error}
        style={{ marginBottom: 16 }}
      />
    )
  }

  // 空状态
  if (relationships.length === 0) {
    return (
      <Empty
        description="暂无家族关系"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  // 渲染单个关系项
  const renderRelationItem = (rel: typeof relationships[0]) => (
    <RelationItem
      key={`${rel.from}-${rel.to}`}
      relationship={rel}
      onClick={() => onDeceasedClick?.(rel.to)}
      showDetails={showDetails}
    />
  )

  // 不分组：直接渲染列表
  if (!groupByKind) {
    return (
      <List
        bordered
        dataSource={relationships}
        renderItem={renderRelationItem}
        locale={{ emptyText: '暂无家族关系' }}
      />
    )
  }

  // 分组：按关系类型展示
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {/* 父母 */}
      {groupedRelationships.parents.length > 0 && (
        <div>
          <Typography.Title level={5}>👨‍👩 父母（{groupedRelationships.parents.length}）</Typography.Title>
          <List
            bordered
            size="small"
            dataSource={groupedRelationships.parents}
            renderItem={renderRelationItem}
          />
        </div>
      )}

      {/* 配偶 */}
      {groupedRelationships.spouses.length > 0 && (
        <div>
          <Typography.Title level={5}>💑 配偶（{groupedRelationships.spouses.length}）</Typography.Title>
          <List
            bordered
            size="small"
            dataSource={groupedRelationships.spouses}
            renderItem={renderRelationItem}
          />
        </div>
      )}

      {/* 兄弟姐妹 */}
      {groupedRelationships.siblings.length > 0 && (
        <div>
          <Typography.Title level={5}>👫 兄弟姐妹（{groupedRelationships.siblings.length}）</Typography.Title>
          <List
            bordered
            size="small"
            dataSource={groupedRelationships.siblings}
            renderItem={renderRelationItem}
          />
        </div>
      )}

      {/* 子女 */}
      {groupedRelationships.children.length > 0 && (
        <div>
          <Typography.Title level={5}>👶 子女（{groupedRelationships.children.length}）</Typography.Title>
          <List
            bordered
            size="small"
            dataSource={groupedRelationships.children}
            renderItem={renderRelationItem}
          />
        </div>
      )}

      {/* 其他 */}
      {groupedRelationships.others.length > 0 && (
        <div>
          <Typography.Title level={5}>❓ 其他（{groupedRelationships.others.length}）</Typography.Title>
          <List
            bordered
            size="small"
            dataSource={groupedRelationships.others}
            renderItem={renderRelationItem}
          />
        </div>
      )}
    </Space>
  )
}

/**
 * 函数级详细中文注释：关系项组件
 */
interface RelationItemProps {
  relationship: {
    from: number
    to: number
    kind: number
    kindLabel: string
    note?: string
  }
  onClick?: () => void
  showDetails?: boolean
}

const RelationItem: React.FC<RelationItemProps> = ({ relationship, onClick, showDetails }) => {
  const { deceased, loading } = useDeceasedDetail(relationship.to)

  // 获取性别图标
  const getGenderIcon = (gender?: string) => {
    if (gender === '男') return <ManOutlined style={{ color: '#1890ff' }} />
    if (gender === '女') return <WomanOutlined style={{ color: '#eb2f96' }} />
    return <UserOutlined />
  }

  // 获取关系标签颜色
  const getKindColor = (kind: number) => {
    switch (kind) {
      case 0: return 'blue'
      case 1: return 'magenta'
      case 2: return 'green'
      case 3: return 'orange'
      default: return 'default'
    }
  }

  return (
    <List.Item
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      actions={[
        <Button key="view" type="link" size="small" onClick={onClick}>
          查看详情
        </Button>
      ]}
    >
      <List.Item.Meta
        avatar={
          loading ? (
            <Avatar icon={<UserOutlined />} />
          ) : deceased?.mainImageCid ? (
            <Avatar src={`https://ipfs.io/ipfs/${deceased.mainImageCid.replace(/^ipfs:\/\//i, '')}`} />
          ) : (
            <Avatar icon={getGenderIcon(deceased?.gender)} />
          )
        }
        title={
          <Space>
            <Typography.Text strong>
              {deceased?.name || `逝者 #${relationship.to}`}
            </Typography.Text>
            <Tag color={getKindColor(relationship.kind)}>
              {relationship.kindLabel}
            </Tag>
            {deceased?.gender && (
              <Tag>{deceased.gender}</Tag>
            )}
          </Space>
        }
        description={
          showDetails && (
            <Space direction="vertical" size={2}>
              {deceased?.birth && deceased?.death && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {deceased.birth} - {deceased.death}
                </Typography.Text>
              )}
              {relationship.note && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  备注：{relationship.note}
                </Typography.Text>
              )}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                ID：{relationship.to}
              </Typography.Text>
            </Space>
          )
        }
      />
    </List.Item>
  )
}

export default RelationshipList

