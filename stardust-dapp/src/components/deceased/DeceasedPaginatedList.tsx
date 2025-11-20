import React from 'react'
import { Alert, Button, List, Space, Tag, Typography, Pagination, Statistic, message } from 'antd'
import { InfoCircleOutlined, WarningOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useDeceasedPagination, type DeceasedItem } from '../../hooks/useDeceasedPagination'

/**
 * 函数级详细中文注释：逝者分页列表组件（支持大集合）
 * 
 * ### 功能
 * - 自动分页加载，每页默认20人
 * - 大集合智能提示（>200人警告，>1000人强提示）
 * - 性能监控与统计
 * - 移动端友好设计
 * 
 * ### 设计理念
 * - **渐进增强**：小集合无感知，大集合自动优化
 * - **用户友好**：明确告知当前状态和性能
 * - **可扩展**：支持自定义渲染和操作
 * 
 * ### 使用场景
 * - 逝者列表页：显示用户创建的所有逝者
 * - 搜索结果页：显示搜索到的逝者
 * - 关系网络页：显示相关逝者
 * 
 * ### 性能考虑
 * - 50人以下：直接渲染，无需分页
 * - 50-200人：分页渲染，性能良好
 * - 200-1000人：分页+提示，性能可接受
 * - >1000人：分页+强提示+统计
 */

export interface DeceasedPaginatedListProps {
  /** 所有逝者数据 */
  allDeceased: DeceasedItem[]
  /** 加载中状态 */
  loading?: boolean
  /** 自定义渲染函数 */
  renderItem?: (item: DeceasedItem) => React.ReactNode
  /** 点击逝者时的回调 */
  onItemClick?: (item: DeceasedItem) => void
  /** 点击"供奉TA"的回调 */
  onOfferingClick?: (deceasedId: number) => void
  /** 每页大小（默认20） */
  pageSize?: number
  /** 是否显示性能统计 */
  showPerformanceStats?: boolean
}

const DeceasedPaginatedList: React.FC<DeceasedPaginatedListProps> = ({
  allDeceased,
  loading = false,
  renderItem,
  onItemClick,
  onOfferingClick,
  pageSize = 20,
  showPerformanceStats = true,
}) => {
  const pagination = useDeceasedPagination(allDeceased, {
    pageSize,
    showSizeChanger: true,
    showQuickJumper: true,
  })

  const {
    currentPageData,
    total,
    isLargeCollection,
    isVeryLargeCollection,
    performanceLevel,
    loadTime,
    paginationConfig,
  } = pagination

  // 默认渲染函数
  const defaultRenderItem = React.useCallback((it: DeceasedItem) => (
    <List.Item 
      onClick={() => onItemClick?.(it)} 
      style={{ cursor: onItemClick ? 'pointer' : 'default' }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Typography.Text strong>#{it.id}</Typography.Text>
          {it.name && <Tag color="green">{it.name}</Tag>}
          {it.nameBadge && <Tag>{it.nameBadge}</Tag>}
          {it.gender && <Tag color="blue">{it.gender}</Tag>}
          {onOfferingClick && (
            <Button 
              size="small" 
              onClick={(e) => {
                e.stopPropagation()
                onOfferingClick(it.id)
              }}
            >
              供奉TA
            </Button>
          )}
        </Space>
        <div style={{ fontSize: 12, color: '#666' }}>
          {it.birth && <span style={{ marginRight: 12 }}>出生：{it.birth}</span>}
          {it.death && <span>离世：{it.death}</span>}
        </div>
        {it.token && (
          <div>
            <Typography.Text type="secondary">Token：</Typography.Text>
            <Typography.Text code>{it.token}</Typography.Text>
          </div>
        )}
        {it.links && it.links.length > 0 && (
          <div>
            <Typography.Text type="secondary">链接：</Typography.Text>
            <Space wrap>
              {it.links.map((u, idx) => (
                <Typography.Text key={idx} code>{u}</Typography.Text>
              ))}
            </Space>
          </div>
        )}
      </Space>
    </List.Item>
  ), [onItemClick, onOfferingClick])

  // 性能提示卡片
  const renderPerformanceAlert = () => {
    if (!showPerformanceStats || total === 0) return null

    // 超大集合强提示
    if (isVeryLargeCollection) {
      return (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 12 }}
          message={`超大集合：${total} 位逝者`}
          description={
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <div>
                <ThunderboltOutlined style={{ marginRight: 4 }} />
                已启用分页加载优化，当前显示第 {paginationConfig.current} 页（每页 {paginationConfig.pageSize} 人）
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                • 纪念墓/公墓支持无限容量
                <br />
                • 性能等级：
                {performanceLevel === 'excellent' && ' ⭐⭐⭐⭐⭐ 优秀'}
                {performanceLevel === 'good' && ' ⭐⭐⭐⭐ 良好'}
                {performanceLevel === 'acceptable' && ' ⭐⭐⭐ 可接受'}
                {performanceLevel === 'slow' && ' ⭐⭐ 较慢，建议使用分页'}
                <br />
                • 加载时间：{loadTime}ms
              </div>
            </Space>
          }
        />
      )
    }

    // 大集合提示
    if (isLargeCollection) {
      return (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 12 }}
          message={`家族墓：${total} 位逝者`}
          description={
            <div>
              已启用分页加载，当前第 {paginationConfig.current} 页（每页 {paginationConfig.pageSize} 人），性能等级：{performanceLevel === 'excellent' ? '⭐⭐⭐⭐⭐' : performanceLevel === 'good' ? '⭐⭐⭐⭐' : '⭐⭐⭐'}
            </div>
          }
        />
      )
    }

    // 正常集合，无需提示
    return null
  }

  // 统计卡片
  const renderStatsCard = () => {
    if (!showPerformanceStats || !isLargeCollection) return null

    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        padding: '12px 0', 
        marginBottom: 12,
        background: '#fafafa',
        borderRadius: 8,
      }}>
        <Statistic 
          title="总人数" 
          value={total} 
          suffix="位"
          valueStyle={{ fontSize: 20, color: '#1890ff' }}
        />
        <Statistic 
          title="总页数" 
          value={pagination.totalPages} 
          suffix="页"
          valueStyle={{ fontSize: 20, color: '#52c41a' }}
        />
        <Statistic 
          title="当前页" 
          value={paginationConfig.current} 
          suffix={`/${pagination.totalPages}`}
          valueStyle={{ fontSize: 20, color: '#fa8c16' }}
        />
      </div>
    )
  }

  // 空状态
  if (!loading && total === 0) {
    return (
      <Alert
        type="info"
        showIcon
        message="暂无逝者"
        description="还没有逝者信息，请先创建逝者。"
      />
    )
  }

  return (
    <div>
      {/* 性能提示 */}
      {renderPerformanceAlert()}

      {/* 统计卡片 */}
      {renderStatsCard()}

      {/* 逝者列表 */}
      <List
        bordered
        loading={loading}
        dataSource={currentPageData}
        locale={{ emptyText: '暂无逝者' }}
        renderItem={renderItem || defaultRenderItem}
        footer={
          total > pageSize ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Pagination
                {...paginationConfig}
                size="small"
                style={{ display: 'inline-block' }}
              />
            </div>
          ) : null
        }
      />

      {/* 调试信息（开发模式） */}
      {process.env.NODE_ENV === 'development' && showPerformanceStats && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="开发模式 - 性能调试"
          description={
            <Space direction="vertical" size={2}>
              <div>总人数：{total}</div>
              <div>当前页：{paginationConfig.current}/{pagination.totalPages}</div>
              <div>每页大小：{paginationConfig.pageSize}</div>
              <div>当前页数据：{currentPageData.length} 条</div>
              <div>性能等级：{performanceLevel}</div>
              <div>加载时间：{loadTime}ms</div>
              <div>是否大集合：{isLargeCollection ? '是' : '否'}</div>
              <div>是否超大集合：{isVeryLargeCollection ? '是' : '否'}</div>
            </Space>
          }
        />
      )}
    </div>
  )
}

export default DeceasedPaginatedList

