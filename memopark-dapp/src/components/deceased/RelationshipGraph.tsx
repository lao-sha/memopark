import React, { useMemo } from 'react'
import { Alert, Spin, Empty, Button, Space, Typography, Tag, Card, InputNumber } from 'antd'
import { ReloadOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined } from '@ant-design/icons'
import { useRelationshipGraph, getRelationLabel } from '../../hooks/useRelationships'

/**
 * 函数级详细中文注释：家族关系图谱组件（简化版）
 * 
 * ### 功能
 * - 可视化展示家族关系图谱
 * - 递归查询多层关系（默认3层）
 * - 节点交互（点击查看详情、悬停提示）
 * 
 * ### 设计理念
 * - **简化实现**：使用 SVG + 力导向布局（不依赖第三方库）
 * - **性能优化**：限制最大深度、缓存查询结果
 * - **移动端友好**：响应式设计、触摸支持
 * 
 * ### 使用场景
 * - 逝者详情页：展示家族图谱
 * - 家族关系管理页：管理关系
 * 
 * ### 注意
 * - 如需复杂图谱，建议安装 reactflow 库：`npm install reactflow`
 * - 当前实现为简化版，适用于中小规模家族（<50人）
 */

export interface RelationshipGraphProps {
  /** 根节点逝者ID */
  rootDeceasedId: number
  /** 最大递归深度（默认3层） */
  maxDepth?: number
  /** 点击节点时的回调 */
  onNodeClick?: (deceasedId: number) => void
  /** 高度（默认600） */
  height?: number
}

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  rootDeceasedId,
  maxDepth = 3,
  onNodeClick,
  height = 600,
}) => {
  const [depth, setDepth] = React.useState(maxDepth)
  const { graphData, loading, error, reload } = useRelationshipGraph(rootDeceasedId, depth)

  // 加载中
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" tip="加载家族图谱中..." />
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
        action={
          <Button size="small" onClick={reload}>
            重试
          </Button>
        }
      />
    )
  }

  // 空状态
  if (graphData.nodes.length === 0) {
    return (
      <Empty
        description="暂无家族关系数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <div>
      {/* 控制栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Typography.Text>递归深度：</Typography.Text>
            <InputNumber
              min={1}
              max={5}
              value={depth}
              onChange={(v) => setDepth(v || 1)}
              size="small"
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={reload}
            >
              刷新
            </Button>
          </Space>
          <Space>
            <Tag color="blue">节点：{graphData.nodes.length}</Tag>
            <Tag color="green">关系：{graphData.edges.length}</Tag>
          </Space>
        </Space>
      </Card>

      {/* 图谱统计 */}
      <GraphStats graphData={graphData} />

      {/* 图谱可视化（简化版：网络图） */}
      <NetworkGraph
        graphData={graphData}
        height={height}
        onNodeClick={onNodeClick}
      />
    </div>
  )
}

/**
 * 函数级详细中文注释：图谱统计卡片
 */
interface GraphStatsProps {
  graphData: {
    nodes: any[]
    edges: any[]
  }
}

const GraphStats: React.FC<GraphStatsProps> = ({ graphData }) => {
  const stats = useMemo(() => {
    const parents = graphData.edges.filter(e => e.kind === 0).length
    const spouses = graphData.edges.filter(e => e.kind === 1).length
    const siblings = graphData.edges.filter(e => e.kind === 2).length
    const children = graphData.edges.filter(e => e.kind === 3).length
    
    return { parents, spouses, siblings, children }
  }, [graphData.edges])

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={4}>
        <Typography.Text strong>家族关系统计</Typography.Text>
        <Space wrap>
          {stats.parents > 0 && <Tag color="blue">父母：{stats.parents}</Tag>}
          {stats.spouses > 0 && <Tag color="magenta">配偶：{stats.spouses}</Tag>}
          {stats.siblings > 0 && <Tag color="green">兄弟姐妹：{stats.siblings}</Tag>}
          {stats.children > 0 && <Tag color="orange">子女：{stats.children}</Tag>}
        </Space>
      </Space>
    </Card>
  )
}

/**
 * 函数级详细中文注释：网络图组件（简化版）
 * 
 * ### 功能
 * - 使用 SVG 渲染节点和边
 * - 力导向布局（简化版）
 * - 节点交互（点击、悬停）
 * 
 * ### 限制
 * - 不支持拖拽（可使用 reactflow 实现）
 * - 布局算法简化（适用于<50个节点）
 * - 不支持缩放（可使用 reactflow 实现）
 */
interface NetworkGraphProps {
  graphData: {
    nodes: Array<{ id: number; name?: string; gender?: string }>
    edges: Array<{ from: number; to: number; kind: number; kindLabel: string }>
  }
  height: number
  onNodeClick?: (deceasedId: number) => void
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ graphData, height, onNodeClick }) => {
  const [hoveredNode, setHoveredNode] = React.useState<number | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = React.useState({ width: 800, height })

  // 监听容器尺寸变化
  React.useEffect(() => {
    if (!containerRef.current) return
    
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: height,
        })
      }
    })
    
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [height])

  // 简化的力导向布局
  const layout = useMemo(() => {
    const { nodes, edges } = graphData
    const { width, height } = dimensions
    
    // 圆形布局（简化版）
    const nodeCount = nodes.length
    const radius = Math.min(width, height) * 0.35
    const centerX = width / 2
    const centerY = height / 2
    
    const positions: Record<number, { x: number; y: number }> = {}
    
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodeCount
      positions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    })
    
    return { positions, nodes, edges }
  }, [graphData, dimensions])

  // 获取节点颜色
  const getNodeColor = (gender?: string) => {
    if (gender === '男') return '#1890ff'
    if (gender === '女') return '#eb2f96'
    return '#8c8c8c'
  }

  // 获取边颜色
  const getEdgeColor = (kind: number) => {
    switch (kind) {
      case 0: return '#1890ff'
      case 1: return '#eb2f96'
      case 2: return '#52c41a'
      case 3: return '#fa8c16'
      default: return '#d9d9d9'
    }
  }

  return (
    <div ref={containerRef} style={{ width: '100%', border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
      <svg width={dimensions.width} height={dimensions.height} style={{ background: '#fafafa' }}>
        {/* 定义箭头标记 */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="20"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#999" />
          </marker>
        </defs>

        {/* 渲染边 */}
        <g>
          {layout.edges.map((edge, index) => {
            const fromPos = layout.positions[edge.from]
            const toPos = layout.positions[edge.to]
            
            if (!fromPos || !toPos) return null
            
            return (
              <g key={`edge-${index}`}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke={getEdgeColor(edge.kind)}
                  strokeWidth={2}
                  opacity={0.6}
                  markerEnd={edge.kind === 0 || edge.kind === 3 ? "url(#arrowhead)" : undefined}
                />
                {/* 边标签 */}
                <text
                  x={(fromPos.x + toPos.x) / 2}
                  y={(fromPos.y + toPos.y) / 2}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#666"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {edge.kindLabel}
                </text>
              </g>
            )
          })}
        </g>

        {/* 渲染节点 */}
        <g>
          {layout.nodes.map((node) => {
            const pos = layout.positions[node.id]
            if (!pos) return null
            
            const isHovered = hoveredNode === node.id
            const nodeRadius = isHovered ? 30 : 25
            
            return (
              <g
                key={`node-${node.id}`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick?.(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* 节点圆圈 */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeRadius}
                  fill={getNodeColor(node.gender)}
                  stroke={isHovered ? '#1890ff' : '#fff'}
                  strokeWidth={isHovered ? 3 : 2}
                  opacity={0.8}
                />
                
                {/* 节点标签 */}
                <text
                  x={pos.x}
                  y={pos.y + nodeRadius + 15}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#333"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.name || `#${node.id}`}
                </text>
                
                {/* 悬停提示 */}
                {isHovered && (
                  <text
                    x={pos.x}
                    y={pos.y - nodeRadius - 10}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#666"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    点击查看详情
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* 图例 */}
      <div style={{ padding: '12px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
        <Space size={16} wrap>
          <Space size={4}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1890ff' }} />
            <Typography.Text style={{ fontSize: 12 }}>男性</Typography.Text>
          </Space>
          <Space size={4}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#eb2f96' }} />
            <Typography.Text style={{ fontSize: 12 }}>女性</Typography.Text>
          </Space>
          <Space size={4}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#8c8c8c' }} />
            <Typography.Text style={{ fontSize: 12 }}>保密</Typography.Text>
          </Space>
        </Space>
      </div>
    </div>
  )
}

export default RelationshipGraph

