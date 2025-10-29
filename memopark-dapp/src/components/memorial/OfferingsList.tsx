/**
 * 供奉记录列表组件
 * 
 * 功能说明：
 * 1. 展示供奉记录列表（按目标或按账户）
 * 2. 显示供奉人、金额、时间等信息
 * 3. 支持查看供奉媒体（图片/视频）
 * 4. 支持续费和取消操作
 * 5. 支持时间线视图和列表视图切换
 * 
 * 创建日期：2025-10-28
 */

import React, { useEffect, useState } from 'react'
import { 
  List, 
  Card, 
  Space, 
  Typography, 
  Tag, 
  Button, 
  Empty, 
  Spin,
  Image,
  Tooltip,
  message,
  Modal,
} from 'antd'
import { 
  GiftOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  FileImageOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createMemorialService, 
  type OfferingRecord,
} from '../../services/memorialService'

const { Text } = Typography

interface OfferingsListProps {
  /** 查询类型 */
  queryType: 'target' | 'account'
  /** 目标（域代码，对象ID）- queryType=target时必填 */
  target?: [number, number]
  /** 账户地址 - queryType=account时必填 */
  account?: string
  /** 是否显示操作按钮 */
  showActions?: boolean
  /** 当前用户地址（用于权限判断） */
  currentAccount?: string
  /** 数量限制 */
  limit?: number
}

/**
 * 函数级详细中文注释：格式化MEMO金额
 */
const formatDUST = (amount: string): string => {
  const memo = BigInt(amount) / BigInt(1_000_000)
  return memo.toLocaleString() + ' DUST'
}

/**
 * 函数级详细中文注释：格式化地址（显示前6后4）
 */
const formatAddress = (address: string): string => {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * 函数级详细中文注释：格式化区块号为相对时间
 */
const formatBlockTime = (blockNumber: number, currentBlock: number): string => {
  const blockDiff = currentBlock - blockNumber
  const minutes = Math.floor(blockDiff * 6 / 60) // 假设6秒/块
  
  if (minutes < 60) {
    return `${minutes} 分钟前`
  } else if (minutes < 1440) {
    return `${Math.floor(minutes / 60)} 小时前`
  } else {
    return `${Math.floor(minutes / 1440)} 天前`
  }
}

/**
 * 函数级详细中文注释：供奉记录列表组件
 */
export const OfferingsList: React.FC<OfferingsListProps> = ({ 
  queryType,
  target,
  account,
  showActions = false,
  currentAccount,
  limit = 50,
}) => {
  const [offerings, setOfferings] = useState<OfferingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentBlock, setCurrentBlock] = useState(0)
  const [processing, setProcessing] = useState<number | null>(null)

  /**
   * 函数级详细中文注释：加载供奉记录
   */
  const loadOfferings = async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const service = createMemorialService(api)
      
      // 获取当前区块号
      const header = await api.rpc.chain.getHeader()
      setCurrentBlock(header.number.toNumber())
      
      // 根据查询类型获取记录
      let records: OfferingRecord[]
      if (queryType === 'target' && target) {
        records = await service.getOfferingsForTarget(target, limit)
      } else if (queryType === 'account' && account) {
        records = await service.getOfferingsByAccount(account, limit)
      } else {
        records = []
      }
      
      setOfferings(records)
    } catch (error) {
      console.error('加载供奉记录失败:', error)
      message.error('加载供奉记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOfferings()
  }, [queryType, target, account, limit])

  /**
   * 函数级详细中文注释：续费供奉
   */
  const handleRenew = async (offering: OfferingRecord, offeringId: number) => {
    if (!currentAccount) {
      message.warning('请先连接钱包')
      return
    }

    Modal.confirm({
      title: '续费供奉',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>是否续费此供奉？</p>
          <p>续费周数：<strong>1周</strong></p>
          <p style={{ color: '#999', fontSize: 12 }}>
            注：续费金额将根据原供奉规格计算
          </p>
        </div>
      ),
      okText: '确认续费',
      cancelText: '取消',
      onOk: async () => {
        setProcessing(offeringId)
        try {
          const api = await getApi()
          const service = createMemorialService(api)
          
          const tx = service.buildRenewOfferingTx({
            target: offering.target,
            offeringId,
            additionalWeeks: 1,
          })

          const { web3FromAddress } = await import('@polkadot/extension-dapp')
          const injector = await web3FromAddress(currentAccount)

          await tx.signAndSend(
            currentAccount,
            { signer: injector.signer },
            ({ status }) => {
              if (status.isFinalized) {
                message.success('续费成功！')
                loadOfferings()
              }
            }
          )
        } catch (error: any) {
          message.error(error.message || '续费失败')
        } finally {
          setProcessing(null)
        }
      },
    })
  }

  /**
   * 函数级详细中文注释：取消供奉
   */
  const handleCancel = async (offering: OfferingRecord, offeringId: number) => {
    if (!currentAccount) {
      message.warning('请先连接钱包')
      return
    }

    Modal.confirm({
      title: '取消供奉',
      icon: <ExclamationCircleOutlined />,
      content: '确定要取消此供奉吗？此操作不可撤销。',
      okText: '确认取消',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        setProcessing(offeringId)
        try {
          const api = await getApi()
          const service = createMemorialService(api)
          
          const tx = service.buildCancelOfferingTx({
            target: offering.target,
            offeringId,
          })

          const { web3FromAddress } = await import('@polkadot/extension-dapp')
          const injector = await web3FromAddress(currentAccount)

          await tx.signAndSend(
            currentAccount,
            { signer: injector.signer },
            ({ status }) => {
              if (status.isFinalized) {
                message.success('取消成功！')
                loadOfferings()
              }
            }
          )
        } catch (error: any) {
          message.error(error.message || '取消失败')
        } finally {
          setProcessing(null)
        }
      },
    })
  }

  /**
   * 函数级详细中文注释：渲染供奉卡片
   */
  const renderOfferingItem = (offering: OfferingRecord, index: number) => {
    const canManage = showActions && currentAccount === offering.who

    return (
      <List.Item key={index}>
        <Card
          style={{ 
            width: '100%',
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 头部信息 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <GiftOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <div>
                  <Text strong style={{ fontSize: 16 }}>
                    {formatMEMO(offering.amount)}
                  </Text>
                  {offering.duration && (
                    <Tag color="blue" style={{ marginLeft: 8 }}>
                      {offering.duration} 周
                    </Tag>
                  )}
                </div>
              </Space>
              <Tooltip title={`区块 #${offering.time}`}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> {formatBlockTime(offering.time, currentBlock)}
                </Text>
              </Tooltip>
            </div>

            {/* 供奉人信息 */}
            <div>
              <Space size="small">
                <UserOutlined style={{ color: '#999' }} />
                <Tooltip title={offering.who}>
                  <Text type="secondary">
                    {formatAddress(offering.who)}
                  </Text>
                </Tooltip>
              </Space>
              {queryType === 'target' && (
                <Tag color="green" style={{ marginLeft: 8 }}>
                  类型 #{offering.kindCode}
                </Tag>
              )}
              {queryType === 'account' && (
                <Tag color="purple" style={{ marginLeft: 8 }}>
                  目标: {offering.target[0]}-{offering.target[1]}
                </Tag>
              )}
            </div>

            {/* 媒体预览 */}
            {offering.media.length > 0 && (
              <div>
                <Space size="small" wrap>
                  <FileImageOutlined style={{ color: '#999' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {offering.media.length} 个媒体文件
                  </Text>
                  <Image.PreviewGroup>
                    {offering.media.slice(0, 3).map((media, idx) => (
                      <Image
                        key={idx}
                        width={60}
                        height={60}
                        src={`https://ipfs.io/ipfs/${media.cid}`}
                        style={{ borderRadius: 4, objectFit: 'cover' }}
                        placeholder={
                          <div 
                            style={{ 
                              width: 60, 
                              height: 60, 
                              background: '#f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FileImageOutlined style={{ fontSize: 24, color: '#999' }} />
                          </div>
                        }
                      />
                    ))}
                  </Image.PreviewGroup>
                  {offering.media.length > 3 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      +{offering.media.length - 3} 更多
                    </Text>
                  )}
                </Space>
              </div>
            )}

            {/* 操作按钮 */}
            {canManage && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Space>
                  {offering.duration && (
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={processing === index}
                      onClick={() => handleRenew(offering, index)}
                    >
                      续费
                    </Button>
                  )}
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={processing === index}
                    onClick={() => handleCancel(offering, index)}
                  >
                    取消
                  </Button>
                </Space>
              </div>
            )}
          </Space>
        </Card>
      </List.Item>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#999' }}>加载供奉记录...</div>
      </div>
    )
  }

  if (offerings.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无供奉记录"
        style={{ padding: '60px 0' }}
      />
    )
  }

  return (
    <List
      dataSource={offerings}
      renderItem={renderOfferingItem}
      pagination={
        offerings.length > 10
          ? {
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条记录`,
            }
          : false
      }
    />
  )
}

