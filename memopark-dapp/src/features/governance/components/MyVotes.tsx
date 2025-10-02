import React from 'react'
import { List, Card, Tag, Typography, Alert, Spin, Empty, Statistic, Row, Col, Space } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { getApi } from '../../../lib/polkadot'
import { getCurrentAddress } from '../../../lib/keystore'

/**
 * 函数级详细中文注释：我的投票记录组件
 * - 显示当前用户在所有提案中的投票记录
 * - 统计赞成/反对票数
 */
export default function MyVotes() {
  const [myVotes, setMyVotes] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [stats, setStats] = React.useState({ ayes: 0, nays: 0, total: 0 })

  /**
   * 函数级中文注释：加载我的投票记录
   */
  const loadMyVotes = React.useCallback(async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const currentUser = getCurrentAddress()
      
      if (!currentUser) {
        throw new Error('请先连接钱包')
      }
      
      // 查询所有提案
      const proposalHashes = await api.query.council.proposals()
      
      const votes: any[] = []
      let ayesCount = 0
      let naysCount = 0
      
      for (let i = 0; i < proposalHashes.length; i++) {
        const hash = proposalHashes[i]
        const hashHex = hash.toHex()
        
        const votingOption = await api.query.council.voting(hash)
        
        if (votingOption.isSome) {
          const voting = votingOption.unwrap().toJSON()
          
          const ayes = voting.ayes || []
          const nays = voting.nays || []
          
          const votedAye = ayes.includes(currentUser)
          const votedNay = nays.includes(currentUser)
          
          if (votedAye || votedNay) {
            // 查询调用内容
            const proposalOption = await api.query.council.proposalOf(hash)
            let callInfo = null
            
            if (proposalOption.isSome) {
              const call = proposalOption.unwrap()
              callInfo = {
                section: call.section,
                method: call.method,
                args: call.args.toJSON()
              }
            }
            
            votes.push({
              index: voting.index || i,
              hash: hashHex,
              votedAye,
              votedNay,
              call: callInfo,
              threshold: voting.threshold,
              ayesCount: ayes.length,
              naysCount: nays.length
            })
            
            if (votedAye) ayesCount++
            if (votedNay) naysCount++
          }
        }
      }
      
      setMyVotes(votes)
      setStats({
        ayes: ayesCount,
        nays: naysCount,
        total: ayesCount + naysCount
      })
      
    } catch (e: any) {
      console.error('加载投票记录失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadMyVotes()
  }, [loadMyVotes])

  /**
   * 函数级中文注释：渲染调用信息
   */
  const renderCallInfo = (call: any) => {
    if (!call) return <Tag>未知调用</Tag>
    
    const { section, method, args } = call
    
    if (section === 'marketMaker' && method === 'approve') {
      return (
        <span>
          <Tag color="green">批准</Tag>
          做市商 #{args[0]}
        </span>
      )
    }
    
    if (section === 'marketMaker' && method === 'reject') {
      return (
        <span>
          <Tag color="red">驳回</Tag>
          做市商 #{args[0]} (扣{args[1]} bps)
        </span>
      )
    }
    
    return <Tag>{section}.{method}</Tag>
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="加载投票记录..." />
      </div>
    )
  }

  if (!getCurrentAddress()) {
    return (
      <Alert
        type="warning"
        showIcon
        message="未连接钱包"
        description="请先连接钱包查看您的投票记录"
      />
    )
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="总投票"
              value={stats.total}
              suffix="票"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="赞成"
              value={stats.ayes}
              suffix="票"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="反对"
              value={stats.nays}
              suffix="票"
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* 投票记录列表 */}
      {myVotes.length === 0 ? (
        <Empty description="暂无投票记录" />
      ) : (
        <List
          dataSource={myVotes}
          renderItem={(vote) => (
            <Card
              key={vote.hash}
              style={{ marginBottom: 12 }}
              size="small"
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Space>
                    <Typography.Text strong>提案 #{vote.index}</Typography.Text>
                    {vote.votedAye && (
                      <Tag color="success" icon={<CheckOutlined />}>赞成</Tag>
                    )}
                    {vote.votedNay && (
                      <Tag color="error" icon={<CloseOutlined />}>反对</Tag>
                    )}
                  </Space>
                </div>
                
                <div>
                  {renderCallInfo(vote.call)}
                </div>
                
                <div style={{ fontSize: 12, color: '#666' }}>
                  当前进度: {vote.ayesCount}/{vote.threshold} 
                  {vote.ayesCount >= vote.threshold && (
                    <Tag color="success" style={{ marginLeft: 8 }}>已达阈值</Tag>
                  )}
                </div>
                
                <Typography.Text
                  code
                  copyable
                  style={{ fontSize: 10, wordBreak: 'break-all' }}
                >
                  {vote.hash}
                </Typography.Text>
              </Space>
            </Card>
          )}
        />
      )}
    </div>
  )
}
