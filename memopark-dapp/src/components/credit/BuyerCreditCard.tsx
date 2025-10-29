/**
 * 买家信用卡片组件
 * 
 * 功能说明：
 * 1. 显示买家信用等级和风险分
 * 2. 显示交易限额和今日已用额度
 * 3. 显示订单统计和信任度
 * 4. 支持链接到完整信用仪表板
 * 
 * 创建日期：2025-10-28
 */

import React, { useEffect, useState } from 'react'
import { Card, Tag, Progress, Space, Typography, Spin, Tooltip, Row, Col } from 'antd'
import { 
  CrownOutlined, 
  TrophyOutlined, 
  RiseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  getBuyerCreditDetail, 
  getBuyerLevelInfo,
  type BuyerCreditDetail 
} from '../../services/creditService'

const { Text, Title } = Typography

interface BuyerCreditCardProps {
  /** 买家账户地址 */
  account: string
  /** 是否显示详细信息 */
  detailed?: boolean
  /** 是否显示链接 */
  showLink?: boolean
}

/**
 * 函数级详细中文注释：买家信用卡片组件
 */
export const BuyerCreditCard: React.FC<BuyerCreditCardProps> = ({ 
  account, 
  detailed = true,
  showLink = false
}) => {
  const [creditDetail, setCreditDetail] = useState<BuyerCreditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentBlock, setCurrentBlock] = useState(0)

  useEffect(() => {
    const loadCredit = async () => {
      try {
        setLoading(true)
        const api = await getApi()
        
        // 获取当前区块号
        const header = await api.rpc.chain.getHeader()
        const blockNumber = header.number.toNumber()
        setCurrentBlock(blockNumber)
        
        const detail = await getBuyerCreditDetail(api, account, blockNumber)
        setCreditDetail(detail)
      } catch (e) {
        console.error('加载买家信用失败:', e)
      } finally {
        setLoading(false)
      }
    }

    loadCredit()
  }, [account])

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#999' }}>加载信用信息...</div>
        </div>
      </Card>
    )
  }

  if (!creditDetail) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <WarningOutlined style={{ fontSize: 48, color: '#faad14' }} />
          <div style={{ marginTop: 16, color: '#999' }}>
            暂无信用记录
            <div style={{ fontSize: 12, marginTop: 8 }}>
              完成首次订单后将建立信用档案
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const { credit, singleLimit, dailyLimit, todayUsed, trustBreakdown } = creditDetail
  const levelInfo = getBuyerLevelInfo(credit.level)
  
  // 计算信用分（风险分越低，信用分越高）
  const creditScore = 1000 - credit.riskScore
  const trustScore = (trustBreakdown.asset + trustBreakdown.age + trustBreakdown.activity + trustBreakdown.social + trustBreakdown.identity)

  // 计算今日额度使用率
  const dailyUsageRate = dailyLimit > 0 ? Math.min(100, (todayUsed / dailyLimit) * 100) : 0

  return (
    <Card
      style={{
        borderRadius: '12px',
        overflow: 'hidden',
      }}
      bodyStyle={{ padding: 0 }}
    >
      {/* 顶部等级标题栏 */}
      <div 
        style={{
          background: levelInfo.bgColor,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <TrophyOutlined style={{ fontSize: 24, color: '#fff' }} />
          <div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
              {levelInfo.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
              {levelInfo.desc}
            </div>
          </div>
        </Space>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fff', fontSize: 14 }}>信用分</div>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>
            {creditScore}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ padding: '20px' }}>
        {/* 风险分条 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>风险评分</Text>
            <Text style={{ color: credit.riskScore > 600 ? '#ff4d4f' : '#52c41a' }}>
              {credit.riskScore} / 1000
            </Text>
          </div>
          <Progress 
            percent={Math.round((credit.riskScore / 1000) * 100)} 
            strokeColor={
              credit.riskScore > 800 ? '#ff4d4f' : 
              credit.riskScore > 600 ? '#faad14' :
              credit.riskScore > 400 ? '#1890ff' : '#52c41a'
            }
            showInfo={false}
          />
          <Text style={{ fontSize: 11, color: '#999' }}>
            风险分越低，信用越好
          </Text>
        </div>

        {/* 交易限额 */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>交易限额</Text>
          <Row gutter={12}>
            <Col span={12}>
              <div style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>单笔限额</div>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}>
                  ${singleLimit.toLocaleString()}
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>每日限额</div>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a' }}>
                  {dailyLimit > 0 ? `$${dailyLimit.toLocaleString()}` : '无限制'}
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* 今日已用额度 */}
        {dailyLimit > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text strong>今日已用</Text>
              <Text>${todayUsed.toLocaleString()} / ${dailyLimit.toLocaleString()}</Text>
            </div>
            <Progress 
              percent={Math.round(dailyUsageRate)} 
              strokeColor={dailyUsageRate > 80 ? '#ff4d4f' : '#1890ff'}
              showInfo={false}
            />
          </div>
        )}

        {/* 统计数据 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
          padding: '16px 0',
          borderTop: '1px solid #f0f0f0',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
              {credit.completedOrders}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>完成订单</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4d4f' }}>
              {credit.defaultCount}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>违约次数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
              {trustScore}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>信任度</div>
          </div>
        </div>

        {/* 查看详情按钮 */}
        {showLink && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a 
              href={`#/profile/credit`}
              onClick={(e) => {
                e.preventDefault()
                window.location.hash = '#/profile/credit'
              }}
              style={{ fontSize: 12 }}
            >
              查看完整信用报告 →
            </a>
          </div>
        )}
      </div>
    </Card>
  )
}

export default BuyerCreditCard

