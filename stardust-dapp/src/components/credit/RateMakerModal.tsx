/**
 * 评价做市商模态框组件
 * 
 * 功能说明：
 * 1. 买家评价做市商服务质量（1-5星）
 * 2. 选择评价标签（最多5个）
 * 3. 提交评价到链上
 * 4. 影响做市商信用分
 * 
 * 创建日期：2025-10-28
 */

import React, { useState } from 'react'
import { Modal, Rate, Tag, Space, message, Alert } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { getRatingTagName } from '../../services/creditService'
import { useWallet } from '../../providers/WalletProvider'

interface RateMakerModalProps {
  /** 是否显示 */
  visible: boolean
  /** 做市商ID */
  makerId: number
  /** 订单ID */
  orderId: number
  /** 做市商名称 */
  makerName?: string
  /** 关闭回调 */
  onClose: () => void
  /** 评价成功回调 */
  onSuccess?: () => void
}

// 评价标签列表
const RATING_TAGS = [
  { code: 0, name: '快速释放', positive: true },
  { code: 1, name: '沟通良好', positive: true },
  { code: 2, name: '价格合理', positive: true },
  { code: 3, name: '释放慢', positive: false },
  { code: 4, name: '沟通差', positive: false },
  { code: 5, name: '不回应', positive: false },
]

/**
 * 函数级详细中文注释：评价做市商模态框组件
 */
export const RateMakerModal: React.FC<RateMakerModalProps> = ({
  visible,
  makerId,
  orderId,
  makerName,
  onClose,
  onSuccess,
}) => {
  const { currentAccount } = useWallet()
  const [stars, setStars] = useState<number>(5)
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  /**
   * 函数级详细中文注释：切换标签选择
   */
  const toggleTag = (tagCode: number) => {
    if (selectedTags.includes(tagCode)) {
      setSelectedTags(selectedTags.filter(t => t !== tagCode))
    } else {
      if (selectedTags.length >= 5) {
        message.warning('最多只能选择5个标签')
        return
      }
      setSelectedTags([...selectedTags, tagCode])
    }
  }

  /**
   * 函数级详细中文注释：提交评价
   */
  const handleSubmit = async () => {
    if (!currentAccount) {
      message.error('请先连接钱包')
      return
    }

    if (stars < 1 || stars > 5) {
      message.error('请选择评分（1-5星）')
      return
    }

    try {
      setSubmitting(true)
      const api = await getApi()

      // 构建交易
      const tx = api.tx.credit.rateMaker(
        makerId,
        orderId,
        stars,
        selectedTags
      )

      // 签名并发送
      await tx.signAndSend(currentAccount.address, ({ status, events }) => {
        if (status.isInBlock) {
          console.log(`评价交易已打包到区块: ${status.asInBlock}`)
        }

        if (status.isFinalized) {
          const success = events.some(({ event }) => 
            api.events.system.ExtrinsicSuccess.is(event)
          )

          if (success) {
            message.success('评价提交成功！')
            onSuccess?.()
            onClose()
          } else {
            message.error('评价提交失败')
          }
          
          setSubmitting(false)
        }
      })
    } catch (error: any) {
      console.error('评价做市商失败:', error)
      message.error(error.message || '评价提交失败')
      setSubmitting(false)
    }
  }

  /**
   * 函数级详细中文注释：重置状态
   */
  const handleClose = () => {
    if (!submitting) {
      setStars(5)
      setSelectedTags([])
      onClose()
    }
  }

  // 计算信用分影响
  const getCreditImpact = (stars: number): string => {
    switch (stars) {
      case 5:
        return '+5分'
      case 4:
        return '+2分'
      case 3:
        return '0分'
      case 2:
      case 1:
        return '-5分'
      default:
        return '0分'
    }
  }

  return (
    <Modal
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>评价做市商</div>
          {makerName && (
            <div style={{ fontSize: 12, fontWeight: 'normal', color: '#999', marginTop: 4 }}>
              {makerName} (ID: {makerId})
            </div>
          )}
        </div>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleClose}
      confirmLoading={submitting}
      okText="提交评价"
      cancelText="取消"
      width={500}
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* 评分说明 */}
        <Alert
          message="您的评价将影响做市商信用分"
          description="公正的评价有助于提升平台服务质量，也能让其他买家做出更好的选择。"
          type="info"
          showIcon
        />

        {/* 星级评分 */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 'bold' }}>服务评分</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
              信用分影响：
              <span style={{ 
                fontWeight: 'bold', 
                color: getCreditImpact(stars).startsWith('+') ? '#52c41a' : 
                       getCreditImpact(stars).startsWith('-') ? '#ff4d4f' : '#999'
              }}>
                {getCreditImpact(stars)}
              </span>
            </span>
          </div>
          <Rate 
            value={stars} 
            onChange={setStars}
            style={{ fontSize: 32 }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            {stars === 5 && '非常满意 - 服务优质，强烈推荐'}
            {stars === 4 && '比较满意 - 服务良好，值得推荐'}
            {stars === 3 && '一般 - 服务中规中矩'}
            {stars === 2 && '不太满意 - 服务有待改进'}
            {stars === 1 && '非常不满意 - 服务质量差'}
          </div>
        </div>

        {/* 评价标签 */}
        <div>
          <div style={{ marginBottom: 12, fontWeight: 'bold' }}>
            评价标签
            <span style={{ fontSize: 12, fontWeight: 'normal', color: '#999', marginLeft: 8 }}>
              (最多5个，可选)
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {RATING_TAGS.map(tag => {
              const selected = selectedTags.includes(tag.code)
              return (
                <Tag
                  key={tag.code}
                  color={selected ? (tag.positive ? 'green' : 'red') : 'default'}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 12px',
                    fontSize: 13,
                    border: selected ? 'none' : '1px solid #d9d9d9',
                  }}
                  onClick={() => toggleTag(tag.code)}
                >
                  {tag.positive && selected && '✓ '}
                  {!tag.positive && selected && '✗ '}
                  {tag.name}
                </Tag>
              )
            })}
          </div>
        </div>

        {/* 温馨提示 */}
        <div style={{
          background: '#f5f5f5',
          padding: '12px',
          borderRadius: '8px',
          fontSize: 12,
          color: '#666',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>📌 评价须知：</div>
          <div>• 每个订单只能评价一次，提交后无法修改</div>
          <div>• 评价将公开记录在链上，请客观真实</div>
          <div>• 恶意评价可能会影响您自己的信用</div>
        </div>
      </Space>
    </Modal>
  )
}

export default RateMakerModal

