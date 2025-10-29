/**
 * 做市商信用徽章组件
 * 
 * 功能说明：
 * 1. 简洁展示做市商信用信息
 * 2. 信用等级图标和颜色
 * 3. 信用分和服务状态
 * 4. 支持链接到完整信用仪表板
 * 
 * 创建日期：2025-10-22
 */

import React, { useEffect, useState } from 'react'
import { Tag, Spin, Typography, Space, Tooltip } from 'antd'
import { getApi } from '../lib/polkadot-safe'
import { getCreditRecord, getLevelInfo, getStatusInfo, type CreditRecord } from '../services/makerCreditService'

const { Text } = Typography

/**
 * 函数级详细中文注释：做市商信用徽章组件Props
 */
interface MakerCreditBadgeProps {
  /** 做市商ID */
  makerId: number
  /** 是否显示详细信息 */
  detailed?: boolean
  /** 是否显示链接 */
  showLink?: boolean
}

/**
 * 函数级详细中文注释：做市商信用徽章组件
 */
export const MakerCreditBadge: React.FC<MakerCreditBadgeProps> = ({ 
  makerId, 
  detailed = false,
  showLink = false
}) => {
  const [credit, setCredit] = useState<CreditRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * 函数级详细中文注释：加载信用记录
   */
  useEffect(() => {
    const loadCredit = async () => {
      try {
        setLoading(true)
        const api = await getApi()
        const creditData = await getCreditRecord(api, makerId)
        setCredit(creditData)
        setError(null)
      } catch (e) {
        console.error('加载做市商信用失败:', e)
        setError('加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadCredit()
  }, [makerId])

  // 加载中
  if (loading) {
    return <Spin size="small" />
  }

  // 加载失败
  if (error || !credit) {
    return (
      <Tag color="default">
        信用: 未知
      </Tag>
    )
  }

  const levelInfo = getLevelInfo(credit.level)
  const statusInfo = getStatusInfo(credit.serviceStatus)

  // 简洁模式（仅显示等级徽章）
  if (!detailed) {
    return (
      <Tooltip 
        title={
          <div>
            <div>信用等级: {levelInfo.name}</div>
            <div>信用分: {credit.creditScore}</div>
            <div>服务状态: {statusInfo.name}</div>
            {showLink && (
              <div style={{ marginTop: 4, fontSize: 11 }}>
                点击查看详情 →
              </div>
            )}
          </div>
        }
      >
        {showLink ? (
          <a 
            href={`#/market-maker/credit?makerId=${makerId}`}
            onClick={(e) => {
              e.preventDefault()
              window.location.hash = `#/market-maker/credit?makerId=${makerId}`
            }}
          >
            <Tag 
              style={{ 
                background: levelInfo.bgColor,
                color: '#fff',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {levelInfo.name}
            </Tag>
          </a>
        ) : (
          <Tag 
            style={{ 
              background: levelInfo.bgColor,
              color: '#fff',
              border: 'none',
              fontWeight: 'bold'
            }}
          >
            {levelInfo.name}
          </Tag>
        )}
      </Tooltip>
    )
  }

  // 详细模式
  return (
    <div 
      style={{ 
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #d9d9d9'
      }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {/* 信用等级 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 12 }}>信用等级</Text>
          {showLink ? (
            <a 
              href={`#/market-maker/credit?makerId=${makerId}`}
              onClick={(e) => {
                e.preventDefault()
                window.location.hash = `#/market-maker/credit?makerId=${makerId}`
              }}
            >
              <Tag 
                style={{ 
                  background: levelInfo.bgColor,
                  color: '#fff',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: 11
                }}
              >
                {levelInfo.name} →
              </Tag>
            </a>
          ) : (
            <Tag 
              style={{ 
                background: levelInfo.bgColor,
                color: '#fff',
                border: 'none',
                fontWeight: 'bold',
                fontSize: 11
              }}
            >
              {levelInfo.name}
            </Tag>
          )}
        </div>

        {/* 信用分 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#666' }}>信用分</Text>
          <Text strong style={{ fontSize: 12, color: levelInfo.color }}>
            {credit.creditScore} / 1000
          </Text>
        </div>

        {/* 服务状态 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#666' }}>服务状态</Text>
          <Tag 
            color={statusInfo.color as any} 
            style={{ 
              fontSize: 11,
              padding: '0 4px',
              lineHeight: '18px'
            }}
          >
            {statusInfo.name}
          </Tag>
        </div>

        {/* 统计数据 */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          marginTop: '4px',
          paddingTop: '8px',
          borderTop: '1px solid #d9d9d9'
        }}>
          <div>
            <Text style={{ fontSize: 10, color: '#999', display: 'block' }}>订单数</Text>
            <Text strong style={{ fontSize: 11 }}>{credit.totalOrders}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 10, color: '#999', display: 'block' }}>违约次数</Text>
            <Text strong style={{ fontSize: 11, color: credit.timeoutDefaults + credit.disputeLosses > 0 ? '#ff4d4f' : '#52c41a' }}>
              {credit.timeoutDefaults + credit.disputeLosses}
            </Text>
          </div>
        </div>
      </Space>
    </div>
  )
}

export default MakerCreditBadge

