import React from 'react'
import { Card, List, Button, Space, Typography, Alert, Divider, message, Modal, InputNumber, Descriptions, Tag, Spin, Segmented } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { ApiPromise } from '@polkadot/api'

/**
 * 函数级详细中文注释：做市商委员会审核页面（完整版）
 * - 目标：展示待审列表 + 点击查看详情 + 批准/驳回操作
 * - 数据来源：直接从链上 Applications 存储查询 PendingReview 状态的申请
 * - 审批操作：签名调用 pallet-market-maker::approve/reject
 * - 符合项目规范：函数级中文注释、移动端优先、不依赖浏览器扩展
 */
export default function GovMarketMakerReviewPage() {
  const [loading, setLoading] = React.useState<boolean>(false)
  const [viewMode, setViewMode] = React.useState<string>('pending')
  const [pendingList, setPendingList] = React.useState<any[]>([])
  const [approvedList, setApprovedList] = React.useState<any[]>([])
  const [selectedApp, setSelectedApp] = React.useState<any>(null)
  const [error, setError] = React.useState<string>('')
  const [api, setApi] = React.useState<ApiPromise | null>(null)

  /**
   * 函数级详细中文注释：初始化 API 连接
   */
  React.useEffect(() => {
    const initApi = async () => {
      try {
        const apiInstance = await getApi()
        setApi(apiInstance)
      } catch (e: any) {
        setError('API 连接失败：' + (e?.message || ''))
      }
    }
    initApi()
  }, [])

  /**
   * 函数级详细中文注释：检查申请是否为待审状态
   * - 支持多种可能的序列化格式（字符串、对象、数字）
   */
  const isPendingReview = (status: any): boolean => {
    // 1. 字符串形式（大驼峰）
    if (status === 'PendingReview') return true
    
    // 2. 字符串形式（小驼峰）
    if (status === 'pendingReview') return true
    
    // 3. 对象形式（大驼峰键）
    if (typeof status === 'object' && status !== null) {
      if ('PendingReview' in status) return true
      if ('pendingReview' in status) return true
    }
    
    // 4. 数字形式（枚举索引）
    // ApplicationStatus: DepositLocked=0, PendingReview=1, Active=2, ...
    if (status === 1) return true
    
    return false
  }

  /**
   * 函数级详细中文注释：检查申请是否为已批准状态
   * - 支持多种可能的序列化格式（字符串、对象、数字）
   */
  const isActive = (status: any): boolean => {
    // 1. 字符串形式（大驼峰）
    if (status === 'Active') return true
    
    // 2. 字符串形式（小驼峰）
    if (status === 'active') return true
    
    // 3. 对象形式（大驼峰键）
    if (typeof status === 'object' && status !== null) {
      if ('Active' in status) return true
      if ('active' in status) return true
    }
    
    // 4. 数字形式（枚举索引）
    // ApplicationStatus: DepositLocked=0, PendingReview=1, Active=2, ...
    if (status === 2) return true
    
    return false
  }

  /**
   * 函数级详细中文注释：从链上查询所有待审申请
   * - 遍历 Applications 存储，筛选 status === PendingReview 的申请
   * - 限制查询数量避免长时间阻塞（最多查询最近 100 个 ID）
   */
  const loadPendingApplications = React.useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError('')
    try {
      // 检查 pallet 是否已注册
      if (!(api.query as any).marketMaker) {
        throw new Error('pallet-market-maker 尚未在 runtime 中注册，请先完成 runtime 集成')
      }
      
      // 获取下一个可用 ID
      const nextId = await (api.query as any).marketMaker.nextId()
      const maxId = Number(nextId.toString())
      
      console.log('[审核页] 开始查询，NextId:', maxId)
      
      const pending: any[] = []
      // 从最新的 ID 开始倒序查询，最多查询 100 个
      const startId = Math.max(0, maxId - 100)
      
      for (let id = maxId - 1; id >= startId; id--) {
        const appOption = await (api.query as any).marketMaker.applications(id)
        if (appOption.isSome) {
          const app = appOption.unwrap()
          const appData = app.toJSON()
          
          // 添加调试日志
          console.log(`[审核页] ID=${id}, status=`, appData.status, '类型:', typeof appData.status)
          
          // 使用增强的状态检查函数
          if (isPendingReview(appData.status)) {
            console.log(`[审核页] ✓ ID=${id} 是待审状态，加入列表`)
            pending.push({
              mm_id: id,
              ...appData
            })
          } else {
            console.log(`[审核页] ✗ ID=${id} 非待审状态，跳过`)
          }
        }
        
        // 如果已经找到 20 个待审申请，停止查询
        if (pending.length >= 20) break
      }
      
      console.log('[审核页] 查询完成，找到', pending.length, '个待审申请')
      
      setPendingList(pending)
      if (pending.length === 0 && viewMode === 'pending') {
        message.info('当前没有待审申请')
      } else if (viewMode === 'pending') {
        message.success(`找到 ${pending.length} 个待审申请`)
      }
    } catch (e: any) {
      console.error('加载待审申请失败:', e)
      setError('加载失败：' + (e?.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }, [api, viewMode])

  /**
   * 函数级详细中文注释：从链上查询所有已批准的做市商
   * - 遍历 Applications 存储，筛选 status === Active 的申请
   * - 限制查询数量避免长时间阻塞（最多查询最近 100 个 ID）
   */
  const loadApprovedApplications = React.useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError('')
    try {
      // 检查 pallet 是否已注册
      if (!(api.query as any).marketMaker) {
        throw new Error('pallet-market-maker 尚未在 runtime 中注册，请先完成 runtime 集成')
      }
      
      // 获取下一个可用 ID
      const nextId = await (api.query as any).marketMaker.nextId()
      const maxId = Number(nextId.toString())
      
      console.log('[审核页] 开始查询已批准做市商，NextId:', maxId)
      
      const approved: any[] = []
      // 从最新的 ID 开始倒序查询，最多查询 100 个
      const startId = Math.max(0, maxId - 100)
      
      for (let id = maxId - 1; id >= startId; id--) {
        const appOption = await (api.query as any).marketMaker.applications(id)
        if (appOption.isSome) {
          const app = appOption.unwrap()
          const appData = app.toJSON()
          
          // 添加调试日志
          console.log(`[审核页-已批准] ID=${id}, status=`, appData.status)
          
          // 使用 isActive 函数筛选
          if (isActive(appData.status)) {
            console.log(`[审核页-已批准] ✓ ID=${id} 是 Active 状态，加入列表`)
            approved.push({
              mm_id: id,
              ...appData
            })
          }
        }
        
        // 如果已经找到 50 个已批准做市商，停止查询
        if (approved.length >= 50) break
      }
      
      console.log('[审核页-已批准] 查询完成，找到', approved.length, '个已批准做市商')
      
      setApprovedList(approved)
      if (approved.length === 0 && viewMode === 'approved') {
        message.info('当前没有已批准的做市商')
      } else if (viewMode === 'approved') {
        message.success(`找到 ${approved.length} 个已批准做市商`)
      }
    } catch (e: any) {
      console.error('加载已批准做市商失败:', e)
      setError('加载失败：' + (e?.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }, [api, viewMode])

  /**
   * 函数级详细中文注释：初始加载和视图切换时加载对应数据
   */
  React.useEffect(() => {
    if (api) {
      if (viewMode === 'pending') {
        loadPendingApplications()
      } else if (viewMode === 'approved') {
        loadApprovedApplications()
      }
    }
  }, [api, viewMode, loadPendingApplications, loadApprovedApplications])

  /**
   * 函数级详细中文注释：批准申请
   * - 调用 pallet-market-maker::approve(mm_id)
   * - 需要委员会权限（当前使用 ensure_root，生产环境需改为委员会集体签名）
   * - 交易函数已优化为等待区块确认后返回，无需额外轮询
   */
  const handleApprove = async (mmId: number) => {
    try {
      Modal.confirm({
        title: '确认批准',
        content: `确定批准做市商申请 #${mmId} 吗？批准后押金将转为长期质押，做市商状态变为 Active。`,
        okText: '确认批准',
        cancelText: '取消',
        onOk: async () => {
          try {
            message.loading({ content: '正在签名并提交交易...', key: 'approve', duration: 0 })
            
            // 函数级中文注释：调用批准接口，等待交易确认（signAndSend 已优化为等待区块确认）
            const hash = await signAndSendLocalFromKeystore('marketMaker', 'approve', [mmId])
            
            console.log('[批准] 交易已确认，区块哈希:', hash)
            console.log('[批准] mmId:', mmId)
            
            message.loading({ content: '交易已确认，正在刷新列表...', key: 'approve', duration: 0 })
            
            // 函数级中文注释：交易已确认，立即清除选中状态
            setSelectedApp(null)
            
            // 函数级中文注释：刷新两个列表（待审和已批准）
            await loadPendingApplications()
            await loadApprovedApplications()
            
            message.success({ 
              content: `批准成功！区块哈希: ${hash.slice(0, 10)}...`, 
              key: 'approve', 
              duration: 3 
            })
            
          } catch (e: any) {
            console.error('[批准] 失败:', e)
            const errMsg = e?.message || String(e)
            
            // 函数级中文注释：检测 BadOrigin 错误，给出委员会提案引导
            if (errMsg.includes('BadOrigin') || errMsg.includes('bad origin')) {
              Modal.error({
                title: '权限不足',
                width: 600,
                content: (
                  <div>
                    <Alert 
                      type="warning" 
                      showIcon 
                      message="需要通过委员会提案流程"
                      description={
                        <div>
                          <p>委员会成员不能直接批准，需要通过集体投票：</p>
                          <ol style={{ paddingLeft: 20, marginTop: 8 }}>
                            <li><strong>提交提案</strong>：任一委员会成员提交批准提案</li>
                            <li><strong>成员投票</strong>：其他委员会成员投票赞成/反对</li>
                            <li><strong>达到阈值</strong>：2/3 多数通过后自动执行</li>
                          </ol>
                          <p style={{ marginTop: 12 }}>
                            <strong>Root/Sudo 账户</strong>可直接批准（紧急通道）。
                          </p>
                          <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                            详细流程请查看 pallets/market-maker/README.md 的"治理机制"章节。
                          </p>
                        </div>
                      }
                      style={{ marginBottom: 12 }}
                    />
                  </div>
                )
              })
            } else {
              message.error({ content: '批准失败：' + errMsg, key: 'approve', duration: 5 })
            }
          }
        }
      })
    } catch (e: any) {
      message.error('操作失败：' + (e?.message || ''))
    }
  }

  /**
   * 函数级详细中文注释：驳回申请
   * - 调用 pallet-market-maker::reject(mm_id, slash_bps)
   * - 弹出输入框让用户输入扣罚比例（0-10000 bps，即 0%-100%）
   * - 交易函数已优化为等待区块确认后返回，无需额外轮询
   */
  const handleReject = async (mmId: number) => {
    let slashBps = 0
    
    Modal.confirm({
      title: '驳回申请',
      content: (
        <div>
          <Alert 
            type="warning" 
            showIcon 
            message="扣罚比例" 
            description="请输入扣罚比例（单位：bps，100 bps = 1%）。例如：1000 表示扣除质押金的 10%，余额退还申请人。"
            style={{ marginBottom: 12 }}
          />
          <InputNumber 
            min={0} 
            max={10000} 
            defaultValue={0}
            step={100}
            style={{ width: '100%' }}
            placeholder="输入扣罚比例（0-10000）"
            onChange={(val) => { slashBps = val || 0 }}
          />
        </div>
      ),
      okText: '确认驳回',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          message.loading({ content: '正在签名并提交交易...', key: 'reject', duration: 0 })
          
          // 函数级中文注释：调用驳回接口，等待交易确认
          const hash = await signAndSendLocalFromKeystore('marketMaker', 'reject', [mmId, slashBps])
          
          console.log('[驳回] 交易已确认，区块哈希:', hash)
          console.log('[驳回] mmId:', mmId, 'slashBps:', slashBps)
          
          message.loading({ content: '交易已确认，正在刷新列表...', key: 'reject', duration: 0 })
          
          // 函数级中文注释：交易已确认，立即清除选中状态
          setSelectedApp(null)
          
          // 函数级中文注释：刷新待审列表
          await loadPendingApplications()
          
          message.success({ 
            content: `驳回成功！扣罚比例: ${slashBps} bps (${(slashBps/100).toFixed(2)}%)`, 
            key: 'reject', 
            duration: 3 
          })
        } catch (e: any) {
          console.error('[驳回] 失败:', e)
          const errMsg = e?.message || String(e)
          
          // 函数级中文注释：检测 BadOrigin 错误，给出委员会提案引导
          if (errMsg.includes('BadOrigin') || errMsg.includes('bad origin')) {
            Modal.error({
              title: '权限不足',
              width: 600,
              content: (
                <div>
                  <Alert 
                    type="warning" 
                    showIcon 
                    message="需要通过委员会提案流程"
                    description={
                      <div>
                        <p>委员会成员不能直接驳回，需要通过集体投票：</p>
                        <ol style={{ paddingLeft: 20, marginTop: 8 }}>
                          <li><strong>提交提案</strong>：任一委员会成员提交驳回提案（需指定扣罚比例）</li>
                          <li><strong>成员投票</strong>：其他委员会成员投票赞成/反对</li>
                          <li><strong>达到阈值</strong>：2/3 多数通过后自动执行</li>
                        </ol>
                        <p style={{ marginTop: 12 }}>
                          <strong>Root/Sudo 账户</strong>可直接驳回（紧急通道）。
                        </p>
                        <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                          详细流程请查看 pallets/market-maker/README.md 的"治理机制"章节。
                        </p>
                      </div>
                    }
                    style={{ marginBottom: 12 }}
                  />
                </div>
              )
            })
          } else {
            message.error({ content: '驳回失败：' + errMsg, key: 'reject', duration: 5 })
          }
        }
      }
    })
  }

  /**
   * 函数级详细中文注释：复制到剪贴板
   */
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`${label} 已复制到剪贴板`)
    }).catch(() => {
      message.error('复制失败，请手动复制')
    })
  }

  /**
   * 函数级详细中文注释：格式化时间戳（秒）
   */
  const formatTimestamp = (ts: number): string => {
    if (!ts) return '-'
    return new Date(ts * 1000).toLocaleString('zh-CN')
  }

  /**
   * 函数级详细中文注释：格式化余额（假设 12 位小数）
   */
  const formatBalance = (balance: any): string => {
    if (!balance) return '0'
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    return (num / 1e12).toFixed(2) + ' MEMO'
  }

  /**
   * 函数级详细中文注释：格式化 CID（截断显示）
   */
  const formatCid = (cid: any): string => {
    if (!cid) return '-'
    // CID 可能是 BoundedVec<u8> 的 JSON 表示，需要转换
    if (Array.isArray(cid)) {
      const cidStr = new TextDecoder().decode(new Uint8Array(cid))
      return cidStr
    }
    const cidStr = String(cid)
    if (cidStr.length > 20) {
      return cidStr.slice(0, 10) + '...' + cidStr.slice(-6)
    }
    return cidStr
  }

  /**
   * 函数级详细中文注释：获取完整 CID 字符串
   */
  const getFullCid = (cid: any): string => {
    if (!cid) return ''
    if (Array.isArray(cid)) {
      return new TextDecoder().decode(new Uint8Array(cid))
    }
    return String(cid)
  }

  /**
   * 函数级详细中文注释：切换视图模式时清除选中项
   */
  const handleViewModeChange = (value: string) => {
    setViewMode(value)
    setSelectedApp(null)
  }

  /**
   * 函数级详细中文注释：刷新当前视图的数据
   */
  const handleRefresh = () => {
    if (viewMode === 'pending') {
      loadPendingApplications()
    } else if (viewMode === 'approved') {
      loadApprovedApplications()
    }
  }

  // 根据视图模式选择要显示的列表
  const currentList = viewMode === 'pending' ? pendingList : approvedList

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={5}>做市商审批（委员会）</Typography.Title>
      
      <Alert 
        type="info" 
        showIcon 
        icon={<InfoCircleOutlined />}
        message="治理说明" 
        description={
          <div style={{ fontSize: 12 }}>
            <p style={{ margin: 0 }}>批准/驳回需要通过<strong>委员会 2/3 多数投票</strong>或 <strong>Root 直接调用</strong>。</p>
            <p style={{ margin: '4px 0 0 0' }}>
              委员会成员请使用 <a href="#/gov/council-proposals" style={{ fontWeight: 'bold' }}>委员会提案管理</a> 提交提案和投票。
            </p>
          </div>
        }
        style={{ marginBottom: 12 }}
      />
      
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      {!api && (
        <Alert type="info" showIcon message="正在连接链上节点..." style={{ marginBottom: 12 }} />
      )}

      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Segmented
          value={viewMode}
          onChange={handleViewModeChange}
          options={[
            {
              label: (
                <span>
                  <Tag color="orange" style={{ marginRight: 4 }}>待审核</Tag>
                  {pendingList.length > 0 && <span>({pendingList.length})</span>}
                </span>
              ),
              value: 'pending',
            },
            {
              label: (
                <span>
                  <Tag color="green" style={{ marginRight: 4 }}>已审核</Tag>
                  {approvedList.length > 0 && <span>({approvedList.length})</span>}
                </span>
              ),
              value: 'approved',
            },
          ]}
          block
        />

        <Button 
          type="primary" 
          icon={<ReloadOutlined />}
          onClick={handleRefresh} 
          loading={loading}
          block
        >
          {viewMode === 'pending' ? '刷新待审列表' : '刷新已批准列表'}
        </Button>
      </Space>

      <Divider orientation="left">
        {viewMode === 'pending' ? `待审申请列表（${pendingList.length}）` : `已批准做市商（${approvedList.length}）`}
      </Divider>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin tip={viewMode === 'pending' ? '正在加载待审申请...' : '正在加载已批准做市商...'} />
        </div>
      ) : (
        <List
          dataSource={currentList}
          locale={{ emptyText: viewMode === 'pending' ? '暂无待审申请' : '暂无已批准做市商' }}
          renderItem={(item) => (
            <List.Item
              key={item.mm_id}
              style={{ 
                cursor: 'pointer',
                background: selectedApp?.mm_id === item.mm_id ? '#f0f5ff' : 'white',
                padding: 12,
                marginBottom: 8,
                borderRadius: 4,
                border: selectedApp?.mm_id === item.mm_id ? '1px solid #1890ff' : '1px solid #f0f0f0'
              }}
              onClick={() => setSelectedApp(item)}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Typography.Text strong>#{item.mm_id}</Typography.Text>
                    {viewMode === 'pending' ? (
                      <Tag color="orange">待审核</Tag>
                    ) : (
                      <Tag color="green">已批准</Tag>
                    )}
        </Space>
                }
                description={
                  <div>
                    <div>申请人: {String(item.owner).slice(0, 10)}...{String(item.owner).slice(-6)}</div>
                    <div>质押: {formatBalance(item.deposit)}</div>
                    <div>费率: {item.fee_bps} bps ({(item.fee_bps / 100).toFixed(2)}%)</div>
                    {viewMode === 'pending' ? (
                      <div>提交时间: {formatTimestamp(item.created_at)}</div>
                    ) : (
                      <div>批准时间: {formatTimestamp(item.created_at)}</div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {selectedApp && (
        <>
          <Divider orientation="left">申请详情</Divider>
          
          <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="申请编号">
              <Typography.Text strong>#{selectedApp.mm_id}</Typography.Text>
            </Descriptions.Item>
            
            <Descriptions.Item label="申请人地址">
              <Space>
                <Typography.Text copyable>{selectedApp.owner}</Typography.Text>
              </Space>
            </Descriptions.Item>
            
            <Descriptions.Item label="质押金额">
              <Typography.Text strong>{formatBalance(selectedApp.deposit)}</Typography.Text>
            </Descriptions.Item>
            
            <Descriptions.Item label="费率">
              {selectedApp.fee_bps} bps ({(selectedApp.fee_bps / 100).toFixed(2)}%)
            </Descriptions.Item>
            
            <Descriptions.Item label="最小下单额">
              {formatBalance(selectedApp.min_amount)}
            </Descriptions.Item>
            
            <Descriptions.Item label="公开资料 CID">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {formatCid(selectedApp.public_cid)}
                </Typography.Text>
                <Space>
                  <Button 
                    size="small" 
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(getFullCid(selectedApp.public_cid), '公开 CID')}
                  >
                    复制完整 CID
                  </Button>
                  <Button 
                    size="small" 
                    type="link"
                    href={`https://ipfs.io/ipfs/${getFullCid(selectedApp.public_cid)}`}
                    target="_blank"
                  >
                    在 IPFS 查看
                  </Button>
                </Space>
              </Space>
            </Descriptions.Item>
            
            <Descriptions.Item label="私密资料根 CID">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {formatCid(selectedApp.private_cid)}
                </Typography.Text>
                <Space>
                  <Button 
                    size="small" 
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(getFullCid(selectedApp.private_cid), '私密 CID')}
                  >
                    复制完整 CID
                  </Button>
                  <Button 
                    size="small" 
                    type="link"
                    href={`https://ipfs.io/ipfs/${getFullCid(selectedApp.private_cid)}`}
                    target="_blank"
                  >
                    在 IPFS 查看
                  </Button>
                </Space>
              </Space>
            </Descriptions.Item>
            
            <Descriptions.Item label="质押时间">
              {formatTimestamp(selectedApp.created_at)}
            </Descriptions.Item>
            
            <Descriptions.Item label="资料提交截止">
              {formatTimestamp(selectedApp.info_deadline)}
            </Descriptions.Item>
            
            <Descriptions.Item label="审核截止">
              {formatTimestamp(selectedApp.review_deadline)}
            </Descriptions.Item>
            
            <Descriptions.Item label="状态">
              {viewMode === 'pending' ? (
                <Tag color="orange">待审核</Tag>
              ) : (
                <Tag color="green">已批准 ✓</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          {viewMode === 'pending' && (
            <>
              <Alert 
                type="warning" 
                showIcon 
                style={{ marginBottom: 16 }}
            message="解密提示"
                description={
                  <div>
                    <p>请务必完成以下步骤后再审批：</p>
                    <ol style={{ paddingLeft: 20, margin: 0 }}>
                      <li>通过 IPFS 网关下载私密资料根 CID 下的 manifest.json 和 *.enc 文件</li>
                      <li>使用委员会私钥离线解密 .enc 文件</li>
                      <li>核验解密后的内容哈希与 manifest 中的记录是否一致</li>
                      <li>审查申请人的资质、合规性和业务能力</li>
                      <li>确认公开资料（费率、交易对等）符合平台规范</li>
                    </ol>
                  </div>
                }
              />

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(selectedApp.mm_id)}
                  block
                  size="large"
                >
                  批准申请
                </Button>
                <Button 
                  danger 
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleReject(selectedApp.mm_id)}
                  block
                  size="large"
                >
                  驳回申请
                </Button>
          </Space>
            </>
          )}

          {viewMode === 'approved' && (
            <Alert 
              type="success" 
              showIcon 
              style={{ marginBottom: 16 }}
              message="已批准做市商"
              description={
                <div>
                  <p>该做市商已通过审核，可以正常接单。</p>
                  <p>• 质押金额已转为长期保证金</p>
                  <p>• 做市商状态：Active（激活）</p>
                  <p>• 可在 OTC 订单系统中看到该做市商</p>
                </div>
              }
            />
          )}
        </>
      )}
    </Card>
  )
}