import React from 'react'
import { Card, Tabs, InputNumber, Space, Typography, Button, message, Alert } from 'antd'
import { TeamOutlined, UnorderedListOutlined, ApartmentOutlined } from '@ant-design/icons'
import RelationshipList from '../../components/deceased/RelationshipList'
import RelationshipGraph from '../../components/deceased/RelationshipGraph'

/**
 * 函数级详细中文注释：家族关系管理页面
 * 
 * ### 功能
 * - 查看家族关系列表
 * - 查看家族关系图谱
 * - 切换不同展示模式
 * 
 * ### 设计理念
 * - **多视图展示**：列表视图、图谱视图
 * - **交互友好**：点击查看详情、跳转
 * - **移动端友好**：响应式设计
 * 
 * ### 使用场景
 * - 独立页面：家族关系管理
 * - 嵌入组件：逝者详情页的关系标签页
 */

const RelationshipPage: React.FC = () => {
  const [deceasedId, setDeceasedId] = React.useState<number | null>(null)
  const [activeTab, setActiveTab] = React.useState<string>('list')

  // 从 URL 参数读取 deceasedId
  React.useEffect(() => {
    try {
      const h = window.location.hash || ''
      const qIdx = h.indexOf('?')
      if (qIdx >= 0) {
        const qs = new URLSearchParams(h.slice(qIdx + 1))
        const v = qs.get('id') || qs.get('deceasedId')
        if (v != null && v !== '') {
          const n = Number(v)
          if (!Number.isNaN(n)) setDeceasedId(n)
        }
      }
    } catch {}
  }, [])

  // 点击逝者跳转
  const handleDeceasedClick = React.useCallback((id: number) => {
    try {
      window.location.hash = `#/deceased/${id}`
    } catch {
      message.info(`逝者 ID: ${id}`)
    }
  }, [])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      {/* 顶部栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <TeamOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              家族关系
            </Typography.Title>
          </Space>
          <Space>
            <Typography.Text>逝者ID：</Typography.Text>
            <InputNumber
              min={0}
              value={deceasedId as any}
              onChange={(v) => setDeceasedId((v as any) ?? null)}
              placeholder="输入逝者ID"
              style={{ width: 150 }}
            />
            <Button
              type="primary"
              disabled={deceasedId == null}
              onClick={() => {
                if (deceasedId != null) {
                  window.location.hash = `#/deceased/relationships?id=${deceasedId}`
                  window.location.reload()
                }
              }}
            >
              查询
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 提示信息 */}
      {deceasedId == null && (
        <Alert
          type="info"
          showIcon
          message="请输入逝者ID"
          description="输入逝者ID后，可以查看该逝者的家族关系列表和图谱。"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 关系展示 */}
      {deceasedId != null && (
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'list',
                label: (
                  <span>
                    <UnorderedListOutlined />
                    列表视图
                  </span>
                ),
                children: (
                  <RelationshipList
                    deceasedId={deceasedId}
                    onDeceasedClick={handleDeceasedClick}
                    showDetails={true}
                    groupByKind={true}
                  />
                ),
              },
              {
                key: 'graph',
                label: (
                  <span>
                    <ApartmentOutlined />
                    图谱视图
                  </span>
                ),
                children: (
                  <RelationshipGraph
                    rootDeceasedId={deceasedId}
                    maxDepth={3}
                    onNodeClick={handleDeceasedClick}
                    height={600}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  )
}

export default RelationshipPage

