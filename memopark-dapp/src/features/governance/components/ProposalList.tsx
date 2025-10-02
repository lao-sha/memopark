import React from 'react'
import { List, Card, Tag, Button, Space, Typography, Alert, Spin, message, Modal, InputNumber, Descriptions, Progress } from 'antd'
import { ReloadOutlined, CheckOutlined, CloseOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { getApi } from '../../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../../lib/polkadot-safe'
import { getCurrentAddress } from '../../../lib/keystore'

/**
 * 函数级详细中文注释：委员会提案列表组件
 * - 显示所有活跃提案
 * - 支持投票（赞成/反对）
 * - 支持执行已通过的提案
 */
export default function ProposalList() {
  const [proposals, setProposals] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedProposal, setSelectedProposal] = React.useState<any>(null)
  const [api, setApi] = React.useState<any>(null)

  /**
   * 函数级中文注释：初始化 API
   */
  React.useEffect(() => {
    const initApi = async () => {
      const apiInstance = await getApi()
      setApi(apiInstance)
    }
    initApi()
  }, [])

  /**
   * 函数级中文注释：加载提案列表
   */
  const loadProposals = React.useCallback(async () => {
    if (!api) return
    
    setLoading(true)
    try {
      // 查询所有提案哈希
      const proposalHashes = await api.query.council.proposals()
      console.log('[提案列表] 提案数量:', proposalHashes.length)
      
      const proposalList: any[] = []
      
      for (let i = 0; i < proposalHashes.length; i++) {
        const hash = proposalHashes[i]
        const hashHex = hash.toHex()
        
        // 查询提案详情
        const votingOption = await api.query.council.voting(hash)
        
        if (votingOption.isSome) {
          const voting = votingOption.unwrap().toJSON()
          
          // 查询提案调用内容
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
          
          proposalList.push({
            index: voting.index || i,
            hash: hashHex,
            threshold: voting.threshold,
            ayes: voting.ayes || [],
            nays: voting.nays || [],
            end: voting.end,
            call: callInfo
          })
        }
      }
      
      console.log('[提案列表] 加载完成:', proposalList.length, '个提案')
      setProposals(proposalList)
      
      if (proposalList.length === 0) {
        message.info('当前没有活跃提案')
      }
      
    } catch (e: any) {
      console.error('加载提案失败:', e)
      message.error('加载失败：' + (e?.message || ''))
    } finally {
      setLoading(false)
    }
  }, [api])

  React.useEffect(() => {
    if (api) {
      loadProposals()
    }
  }, [api, loadProposals])

  /**
   * 函数级中文注释：投票
   */
  const handleVote = async (proposal: any, approve: boolean) => {
    try {
      Modal.confirm({
        title: approve ? '投赞成票' : '投反对票',
        content: `确定对提案 #${proposal.index} 投${approve ? '赞成' : '反对'}票吗？`,
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          try {
            message.loading({ content: '正在提交投票...', key: 'vote', duration: 0 })
            
            const hash = await signAndSendLocalFromKeystore(
              'council',
              'vote',
              [proposal.hash, proposal.index, approve]
            )
            
            console.log('[投票] 交易哈希:', hash)
            
            message.success({
              content: `投票成功！已投${approve ? '赞成' : '反对'}票`,
              key: 'vote',
              duration: 3
            })
            
            // 刷新列表
            setTimeout(() => loadProposals(), 3000)
            
          } catch (e: any) {
            console.error('[投票] 失败:', e)
            message.error({
              content: '投票失败：' + (e?.message || ''),
              key: 'vote',
              duration: 5
            })
          }
        }
      })
    } catch (e: any) {
      message.error('操作失败：' + (e?.message || ''))
    }
  }

  /**
   * 函数级中文注释：执行提案
   */
  const handleExecute = async (proposal: any) => {
    try {
      Modal.confirm({
        title: '执行提案',
        content: `确定执行提案 #${proposal.index} 吗？提案已达到投票阈值。`,
        okText: '确认执行',
        cancelText: '取消',
        onOk: async () => {
          try {
            message.loading({ content: '正在执行提案...', key: 'execute', duration: 0 })
            
            // weight bound 和 length bound
            const weightBound = {
              refTime: 1_000_000_000,
              proofSize: 1000
            }
            const lengthBound = 1000
            
            const hash = await signAndSendLocalFromKeystore(
              'council',
              'close',
              [proposal.hash, proposal.index, weightBound, lengthBound]
            )
            
            console.log('[执行] 交易哈希:', hash)
            
            message.success({
              content: '提案执行成功！',
              key: 'execute',
              duration: 3
            })
            
            // 刷新列表
            setTimeout(() => loadProposals(), 3000)
            
          } catch (e: any) {
            console.error('[执行] 失败:', e)
            message.error({
              content: '执行失败：' + (e?.message || ''),
              key: 'execute',
              duration: 5
            })
          }
        }
      })
    } catch (e: any) {
      message.error('操作失败：' + (e?.message || ''))
    }
  }

  /**
   * 函数级中文注释：渲染提案调用信息
   */
  const renderCallInfo = (call: any) => {
    if (!call) return <Tag>未知调用</Tag>
    
    const { section, method, args } = call
    
    if (section === 'marketMaker' && method === 'approve') {
      return (
        <Space>
          <Tag color="green">批准做市商</Tag>
          <span>#{args[0]}</span>
        </Space>
      )
    }
    
    if (section === 'marketMaker' && method === 'reject') {
      return (
        <Space>
          <Tag color="red">驳回做市商</Tag>
          <span>#{args[0]}</span>
          <Tag>{args[1]} bps</Tag>
        </Space>
      )
    }
    
    return (
      <Space>
        <Tag>{section}.{method}</Tag>
      </Space>
    )
  }

  /**
   * 函数级中文注释：计算投票进度
   */
  const getVoteProgress = (proposal: any) => {
    const ayesCount = proposal.ayes.length
    const naysCount = proposal.nays.length
    const total = ayesCount + naysCount
    const threshold = proposal.threshold
    
    const ayesPercent = total > 0 ? (ayesCount / threshold) * 100 : 0
    
    return {
      ayesCount,
      naysCount,
      total,
      threshold,
      ayesPercent: Math.min(ayesPercent, 100),
      canExecute: ayesCount >= threshold
    }
  }

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={loadProposals}
          loading={loading}
          block
        >
          刷新提案列表
        </Button>
      </Space>

      {!api && (
        <Alert type="info" showIcon message="正在连接链上节点..." style={{ marginBottom: 12 }} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="加载提案列表..." />
        </div>
      ) : (
        <List
          dataSource={proposals}
          locale={{ emptyText: '暂无活跃提案' }}
          renderItem={(proposal) => {
            const progress = getVoteProgress(proposal)
            const currentUser = getCurrentAddress()
            const hasVoted = proposal.ayes.includes(currentUser) || proposal.nays.includes(currentUser)
            const votedAye = proposal.ayes.includes(currentUser)
            
            return (
              <Card
                key={proposal.hash}
                style={{ marginBottom: 16 }}
                title={
                  <Space>
                    <Typography.Text strong>提案 #{proposal.index}</Typography.Text>
                    {progress.canExecute && <Tag color="success">可执行</Tag>}
                    {hasVoted && (
                      <Tag color={votedAye ? 'green' : 'red'}>
                        已投{votedAye ? '赞成' : '反对'}
                      </Tag>
                    )}
                  </Space>
                }
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="调用">
                    {renderCallInfo(proposal.call)}
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="提案哈希">
                    <Typography.Text
                      code
                      copyable
                      style={{ fontSize: 11, wordBreak: 'break-all' }}
                    >
                      {proposal.hash}
                    </Typography.Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="投票进度">
                    <div>
                      <Progress
                        percent={progress.ayesPercent}
                        status={progress.canExecute ? 'success' : 'active'}
                        format={() => `${progress.ayesCount}/${progress.threshold}`}
                      />
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <Space split="|">
                          <span style={{ color: '#52c41a' }}>赞成: {progress.ayesCount}</span>
                          <span style={{ color: '#ff4d4f' }}>反对: {progress.naysCount}</span>
                          <span>阈值: {progress.threshold}</span>
                        </Space>
                      </div>
                    </div>
                  </Descriptions.Item>
                </Descriptions>

                <Space style={{ marginTop: 16, width: '100%' }} direction="vertical">
                  {!hasVoted && (
                    <Space style={{ width: '100%' }}>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleVote(proposal, true)}
                        style={{ flex: 1 }}
                      >
                        赞成
                      </Button>
                      <Button
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => handleVote(proposal, false)}
                        style={{ flex: 1 }}
                      >
                        反对
                      </Button>
                    </Space>
                  )}
                  
                  {progress.canExecute && (
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={() => handleExecute(proposal)}
                      block
                      style={{ background: '#722ed1' }}
                    >
                      执行提案
                    </Button>
                  )}
                  
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setSelectedProposal(proposal)}
                  >
                    查看详情
                  </Button>
                </Space>
              </Card>
            )
          }}
        />
      )}

      {/* 提案详情弹窗 */}
      <Modal
        title={`提案 #${selectedProposal?.index} 详情`}
        open={!!selectedProposal}
        onCancel={() => setSelectedProposal(null)}
        footer={null}
        width={600}
      >
        {selectedProposal && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="提案哈希">
              <Typography.Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
                {selectedProposal.hash}
              </Typography.Text>
            </Descriptions.Item>
            
            <Descriptions.Item label="调用">
              {renderCallInfo(selectedProposal.call)}
            </Descriptions.Item>
            
            <Descriptions.Item label="阈值">
              {selectedProposal.threshold} 票
            </Descriptions.Item>
            
            <Descriptions.Item label="赞成票">
              {selectedProposal.ayes.length} 票
              {selectedProposal.ayes.length > 0 && (
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {selectedProposal.ayes.map((addr: string, i: number) => (
                    <div key={i}>{addr}</div>
                  ))}
                </div>
              )}
            </Descriptions.Item>
            
            <Descriptions.Item label="反对票">
              {selectedProposal.nays.length} 票
              {selectedProposal.nays.length > 0 && (
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {selectedProposal.nays.map((addr: string, i: number) => (
                    <div key={i}>{addr}</div>
                  ))}
                </div>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
