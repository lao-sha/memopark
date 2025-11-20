/**
 * 创建OTC订单弹窗组件
 * 
 * 功能说明：
 * 1. 选择做市商
 * 2. 输入购买数量
 * 3. 输入联系方式（哈希）
 * 4. 自动计算总金额和单价
 * 5. 显示做市商溢价信息
 * 6. 一键创建订单
 * 
 * 创建日期：2025-10-28
 */

import React, { useState, useEffect } from 'react'
import { 
  Modal, 
  Form, 
  Select, 
  InputNumber, 
  Input, 
  Space, 
  Typography, 
  Alert, 
  Divider,
  Tag,
  Spin,
  message,
} from 'antd'
import { 
  InfoCircleOutlined, 
  DollarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createTradingService, 
  type MakerApplication,
  ApplicationStatus,
  Direction,
} from '../../services/tradingService'

const { Text } = Typography

interface CreateOTCOrderModalProps {
  /** 是否显示弹窗 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 当前账户地址 */
  account: string
  /** 创建成功回调 */
  onSuccess?: () => void
}

/**
 * 函数级详细中文注释：格式化DUST金额
 */
const formatDUST = (amount: string | number): string => {
  const memo = typeof amount === 'string' 
    ? BigInt(amount) / BigInt(1_000_000)
    : BigInt(Math.floor(amount * 1_000_000)) / BigInt(1_000_000)
  return memo.toLocaleString() + ' DUST'
}

/**
 * 函数级详细中文注释：格式化USDT金额
 */
const formatUSDT = (amount: number): string => {
  return amount.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) + ' USDT'
}

/**
 * 函数级详细中文注释：创建OTC订单弹窗组件
 */
export const CreateOTCOrderModal: React.FC<CreateOTCOrderModalProps> = ({ 
  open, 
  onClose, 
  account,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [makers, setMakers] = useState<MakerApplication[]>([])
  const [loadingMakers, setLoadingMakers] = useState(false)
  const [selectedMaker, setSelectedMaker] = useState<MakerApplication | null>(null)
  const [qty, setQty] = useState<number>(0)
  const [basePrice, setBasePrice] = useState<number>(6.5) // USDT/MEMO基准价

  /**
   * 函数级详细中文注释：加载可用的做市商列表
   */
  const loadMakers = async () => {
    setLoadingMakers(true)
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      // 查询所有活跃的做市商
      const allMakers = await service.listMakers({
        status: ApplicationStatus.Active,
        direction: Direction.Sell, // 只显示卖出方向的做市商
        limit: 100,
      })
      
      setMakers(allMakers)
    } catch (error) {
      console.error('加载做市商失败:', error)
      message.error('加载做市商列表失败')
    } finally {
      setLoadingMakers(false)
    }
  }

  /**
   * 函数级详细中文注释：监听弹窗打开，加载做市商
   */
  useEffect(() => {
    if (open) {
      loadMakers()
      form.resetFields()
      setSelectedMaker(null)
      setQty(0)
    }
  }, [open, form])

  /**
   * 函数级详细中文注释：计算实际价格（应用溢价）
   */
  const calculatePrice = (): number => {
    if (!selectedMaker) return basePrice
    
    // sellPremiumBps: -500 ~ 500 (basis points)
    // 实际价格 = 基准价 * (1 + premium_bps / 10000)
    const premiumRate = selectedMaker.sellPremiumBps / 10000
    return basePrice * (1 + premiumRate)
  }

  /**
   * 函数级详细中文注释：计算总金额
   */
  const calculateTotal = (): number => {
    const price = calculatePrice()
    return price * qty
  }

  /**
   * 函数级详细中文注释：提交表单
   */
  const handleSubmit = async (values: any) => {
    if (!selectedMaker) {
      message.error('请选择做市商')
      return
    }

    setLoading(true)
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      // 转换数量（DUST -> 最小单位）
      const qtyMinimalUnits = (BigInt(Math.floor(values.qty * 1_000_000))).toString()
      
      const tx = service.buildCreateOrderTx({
        makerId: selectedMaker.id,
        qty: qtyMinimalUnits,
        contactCommit: values.contactCommit,
      })

      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      await tx.signAndSend(
        account,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isInBlock) {
            message.success('订单已提交，等待区块确认...')
          } else if (status.isFinalized) {
            message.success('订单创建成功！')
            setLoading(false)
            onSuccess?.()
            onClose()
          }
        }
      )
    } catch (error: any) {
      console.error('创建订单失败:', error)
      message.error(error.message || '创建订单失败')
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：渲染价格信息
   */
  const renderPriceInfo = () => {
    if (!selectedMaker || qty === 0) return null

    const price = calculatePrice()
    const total = calculateTotal()
    const premium = selectedMaker.sellPremiumBps / 100 // 转换为百分比

    return (
      <div 
        style={{ 
          background: '#f5f5f5', 
          padding: 16, 
          borderRadius: 8,
          marginTop: 16,
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">基准价：</Text>
            <Text>{basePrice.toFixed(4)} USDT/DUST</Text>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">溢价：</Text>
            <Text style={{ color: premium > 0 ? '#ff4d4f' : '#52c41a' }}>
              {premium > 0 ? '+' : ''}{premium.toFixed(2)}%
            </Text>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong>实际单价：</Text>
            <Text strong style={{ fontSize: 16 }}>
              {price.toFixed(4)} USDT/DUST
            </Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong>购买数量：</Text>
            <Text strong style={{ fontSize: 16 }}>
              {qty.toLocaleString()} DUST
            </Text>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 16 }}>应付总额：</Text>
            <Text strong style={{ fontSize: 20, color: '#1890ff' }}>
              {formatUSDT(total)}
            </Text>
          </div>
        </Space>
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <DollarOutlined style={{ fontSize: 20 }} />
          <span>创建OTC订单</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="创建订单"
      cancelText="取消"
      width={600}
      style={{ top: 40 }}
    >
      {loadingMakers ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
          <div style={{ marginTop: 16, color: '#999' }}>加载做市商列表...</div>
        </div>
      ) : (
        <>
          <Alert
            message="OTC场外交易"
            description="通过做市商购买MEMO，需要链下完成USDT付款。请确保选择信誉良好的做市商。"
            type="info"
            icon={<InfoCircleOutlined />}
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
          >
            {/* 选择做市商 */}
            <Form.Item
              label="选择做市商"
              name="makerId"
              rules={[{ required: true, message: '请选择做市商' }]}
            >
              <Select
                placeholder="选择一个做市商"
                onChange={(value) => {
                  const maker = makers.find(m => m.id === value)
                  setSelectedMaker(maker || null)
                }}
                options={makers.map(maker => ({
                  value: maker.id,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Space>
                        <UserOutlined />
                        <span>{maker.maskedFullName}</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          (ID: {maker.id})
                        </Text>
                      </Space>
                      <Tag color={maker.sellPremiumBps > 0 ? 'red' : 'green'}>
                        {maker.sellPremiumBps > 0 ? '+' : ''}
                        {(maker.sellPremiumBps / 100).toFixed(2)}%
                      </Tag>
                    </div>
                  ),
                }))}
                disabled={makers.length === 0}
                notFoundContent={
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Text type="secondary">暂无可用做市商</Text>
                  </div>
                }
              />
            </Form.Item>

            {/* 购买数量 */}
            <Form.Item
              label="购买数量（DUST）"
              name="qty"
              rules={[
                { required: true, message: '请输入购买数量' },
                { type: 'number', min: 0.001, message: '数量不能小于0.001' },
              ]}
            >
              <InputNumber
                min={0.001}
                max={100000}
                step={1}
                precision={6}
                style={{ width: '100%' }}
                placeholder="输入购买数量"
                addonAfter="DUST"
                onChange={(value) => setQty(value || 0)}
              />
            </Form.Item>

            {/* 联系方式哈希 */}
            <Form.Item
              label="联系方式哈希"
              name="contactCommit"
              rules={[{ required: true, message: '请输入联系方式哈希' }]}
              tooltip="输入您的联系方式（如微信、电话）的哈希值，用于做市商联系您完成链下付款"
            >
              <Input.TextArea
                rows={2}
                placeholder="输入联系方式的哈希值（如：0x1234...）"
                maxLength={200}
                showCount
              />
            </Form.Item>

            {/* 价格摘要 */}
            {renderPriceInfo()}

            {/* 温馨提示 */}
            <Alert
              message="温馨提示"
              description={
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  <li>订单创建后，请在规定时间内完成USDT付款</li>
                  <li>付款后及时标记"已付款"，提供付款凭证</li>
                  <li>做市商确认收款后会释放MEMO到您的账户</li>
                  <li>如有争议，可以发起仲裁</li>
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Form>
        </>
      )}
    </Modal>
  )
}

