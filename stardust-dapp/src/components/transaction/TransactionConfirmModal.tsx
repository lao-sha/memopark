import React, { useState } from 'react'
import { Modal, Typography, Card, Descriptions, Input, Button, Space, Spin, message } from 'antd'
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：交易确认Modal组件
 * - 替代window.prompt，提供专业的Web3交易确认体验
 * - 显示交易详情、Gas费预览、密码输入
 * - 签名进度显示和成功动画
 * - 支持取消操作
 */

export interface TransactionInfo {
  title: string              // 交易标题，如"供奉蜡烛"
  description: string        // 交易描述，如"为 张三 供奉蜡烛1周"
  icon?: string             // 可选图标，如"🕯️"
  amount?: string           // 金额，如"10 DUST"
  gasFee?: string           // Gas费，如"0.001 DUST"
  total?: string            // 总计，如"10.001 DUST"
  target?: string           // 目标地址或ID
  metadata?: Record<string, any>  // 额外元数据
}

interface Props {
  open: boolean
  onCancel: () => void
  onConfirm: (password: string) => Promise<string>  // 返回交易hash
  transaction: TransactionInfo
}

/**
 * 交易确认Modal
 */
export const TransactionConfirmModal: React.FC<Props> = ({
  open,
  onCancel,
  onConfirm,
  transaction
}) => {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'signing' | 'success'>('input')
  const [txHash, setTxHash] = useState<string>('')
  const [error, setError] = useState<string>('')

  /**
   * 确认签名
   */
  const handleConfirm = async () => {
    if (!password || password.length < 8) {
      message.warning('请输入至少 8 位密码')
      return
    }

    setLoading(true)
    setStep('signing')
    setError('')

    try {
      const hash = await onConfirm(password)
      setTxHash(hash)
      setStep('success')
      
      // 2秒后自动关闭
      setTimeout(() => {
        handleClose()
      }, 3000)
    } catch (e: any) {
      const errorMsg = e?.message || '签名失败'
      setError(errorMsg)
      message.error(errorMsg)
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 关闭Modal并重置状态
   */
  const handleClose = () => {
    setPassword('')
    setStep('input')
    setTxHash('')
    setError('')
    onCancel()
  }

  /**
   * 阻止签名中关闭
   */
  const handleCancel = () => {
    if (step === 'signing') {
      message.warning('签名进行中，请稍候...')
      return
    }
    handleClose()
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      closable={step !== 'signing'}
      maskClosable={step !== 'signing'}
      centered
      width={440}
      styles={{
        body: { padding: '24px 24px 16px' }
      }}
    >
      {/* Step 1: 输入密码 */}
      {step === 'input' && (
        <div>
          {/* 标题 */}
          <Typography.Title 
            level={4} 
            style={{ 
              textAlign: 'center', 
              marginBottom: 24,
              color: 'var(--color-text-primary)'
            }}
          >
            {transaction.icon && <span style={{ marginRight: 8 }}>{transaction.icon}</span>}
            确认{transaction.title}
          </Typography.Title>

          {/* 交易详情卡片 */}
          <Card 
            size="small" 
            style={{ 
              background: 'var(--color-primary-bg)',
              border: '1px solid var(--color-primary-light)',
              marginBottom: 20,
              borderRadius: 'var(--radius-md)'
            }}
          >
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--color-text-secondary)' }}>操作</span>}
              >
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  {transaction.description}
                </strong>
              </Descriptions.Item>
              
              {transaction.amount && (
                <Descriptions.Item 
                  label={<span style={{ color: 'var(--color-text-secondary)' }}>金额</span>}
                >
                  <strong style={{ 
                    color: 'var(--color-primary)', 
                    fontSize: 18,
                    fontWeight: 600
                  }}>
                    {transaction.amount}
                  </strong>
                </Descriptions.Item>
              )}
              
              {transaction.gasFee && (
                <Descriptions.Item 
                  label={<span style={{ color: 'var(--color-text-secondary)' }}>预计Gas费</span>}
                >
                  <span style={{ color: 'var(--color-text-tertiary)' }}>
                    {transaction.gasFee}
                  </span>
                </Descriptions.Item>
              )}
              
              {transaction.total && (
                <Descriptions.Item 
                  label={<span style={{ color: 'var(--color-text-secondary)' }}>总计</span>}
                >
                  <strong style={{ color: 'var(--color-text-primary)', fontSize: 16 }}>
                    {transaction.total}
                  </strong>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 密码输入 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              marginBottom: 8, 
              color: 'var(--color-text-secondary)',
              fontSize: 14
            }}>
              钱包密码
            </div>
            <Input.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码以签名"
              size="large"
              autoFocus
              onPressEnter={handleConfirm}
              style={{
                borderRadius: 'var(--radius-md)'
              }}
            />
            {error && (
              <div style={{ 
                marginTop: 8, 
                color: 'var(--color-error)',
                fontSize: 12
              }}>
                {error}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Button
              type="primary"
              block
              size="large"
              onClick={handleConfirm}
              loading={loading}
              style={{
                height: 48,
                borderRadius: 'var(--radius-md)',
                fontSize: 16,
                fontWeight: 600
              }}
            >
              确认签名
            </Button>
            <Button 
              block 
              size="large"
              onClick={handleClose}
              style={{
                borderRadius: 'var(--radius-md)'
              }}
            >
              取消
            </Button>
          </Space>
        </div>
      )}

      {/* Step 2: 签名进行中 */}
      {step === 'signing' && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin 
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            size="large" 
          />
          <div style={{ 
            marginTop: 32, 
            fontSize: 16, 
            color: 'var(--color-text-primary)',
            fontWeight: 500
          }}>
            正在签名并提交到链上...
          </div>
          <div style={{ 
            marginTop: 12, 
            fontSize: 14, 
            color: 'var(--color-text-tertiary)'
          }}>
            请稍候，预计需要 8-12 秒
          </div>
          <div style={{ 
            marginTop: 20, 
            fontSize: 12, 
            color: 'var(--color-text-tertiary)',
            fontStyle: 'italic'
          }}>
            💡 请勿关闭此窗口
          </div>
        </div>
      )}

      {/* Step 3: 成功 */}
      {step === 'success' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-success) 0%, #73d13d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)'
          }}>
            <CheckCircleOutlined style={{ 
              fontSize: 48, 
              color: '#fff'
            }} />
          </div>
          
          <Typography.Title 
            level={4} 
            style={{ 
              margin: '0 0 12px',
              color: 'var(--color-text-primary)'
            }}
          >
            {transaction.icon && <span style={{ marginRight: 8 }}>{transaction.icon}</span>}
            {transaction.title}成功
          </Typography.Title>
          
          <div style={{ 
            fontSize: 14, 
            color: 'var(--color-text-secondary)',
            marginBottom: 20
          }}>
            🙏 您的心意已送达
          </div>

          {txHash && (
            <Card 
              size="small" 
              style={{ 
                background: 'var(--color-bg-secondary)',
                marginTop: 16,
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                交易哈希
              </div>
              <div style={{ 
                fontSize: 11, 
                fontFamily: 'monospace',
                color: 'var(--color-text-secondary)',
                wordBreak: 'break-all',
                lineHeight: 1.6
              }}>
                {txHash}
              </div>
            </Card>
          )}

          <div style={{ 
            marginTop: 24, 
            fontSize: 12, 
            color: 'var(--color-text-tertiary)',
            fontStyle: 'italic'
          }}>
            此窗口将在 3 秒后自动关闭
          </div>
        </div>
      )}
    </Modal>
  )
}

export default TransactionConfirmModal

