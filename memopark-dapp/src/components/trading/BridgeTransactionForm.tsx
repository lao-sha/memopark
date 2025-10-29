/**
 * 跨链桥交易表单组件
 * 
 * 功能说明：
 * 1. MEMO → TRON：将MEMO兑换为USDT并发送到TRON地址
 * 2. USDT → MEMO：通过USDT购买MEMO（首购优惠）
 * 3. 动态价格计算（含溢价）
 * 4. 首购资格验证和优惠提示
 * 5. TRON地址验证
 * 6. 交易确认和提交
 * 
 * 创建日期：2025-10-28
 */

import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Form, 
  Input, 
  InputNumber, 
  Button, 
  Space, 
  Typography, 
  Alert, 
  Divider,
  Tabs,
  Tooltip,
  message,
  Statistic,
  Row,
  Col,
} from 'antd'
import { 
  SwapOutlined, 
  ArrowRightOutlined,
  InfoCircleOutlined,
  GiftOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createTradingService,
} from '../../services/tradingService'

const { Text, Title } = Typography

interface BridgeTransactionFormProps {
  /** 当前账户地址 */
  account: string
  /** 交易成功回调 */
  onSuccess?: () => void
}

/**
 * 函数级详细中文注释：TRON地址验证
 */
const validateTronAddress = (address: string): boolean => {
  // TRON地址以 'T' 开头，长度为34
  return /^T[A-Za-z0-9]{33}$/.test(address)
}

/**
 * 函数级详细中文注释：格式化MEMO金额
 */
const formatMEMO = (amount: number): string => {
  return amount.toLocaleString() + ' MEMO'
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
 * 函数级详细中文注释：跨链桥交易表单组件
 */
export const BridgeTransactionForm: React.FC<BridgeTransactionFormProps> = ({ 
  account,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'memoToTron' | 'usdtToMemo'>('memoToTron')
  
  // 价格数据
  const [basePrice, setBasePrice] = useState<number>(6.5) // USDT/MEMO基准价
  const [sellPremiumBps, setSellPremiumBps] = useState<number>(0) // 卖出溢价
  const [buyPremiumBps, setBuyPremiumBps] = useState<number>(0) // 买入溢价
  const [isFirstPurchaseEligible, setIsFirstPurchaseEligible] = useState<boolean>(false)
  const [firstPurchasePrice, setFirstPurchasePrice] = useState<number>(0)
  
  // 用户输入
  const [dustAmount, setDustAmount] = useState<number>(0)
  const [usdtAmount, setUsdtAmount] = useState<number>(0)

  /**
   * 函数级详细中文注释：加载价格和首购资格
   */
  const loadPriceAndEligibility = async () => {
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      // 查询首购资格（这里简化处理，实际应查询链上数据）
      // TODO: 调用 service.checkFirstPurchaseEligibility(account)
      setIsFirstPurchaseEligible(false)
      
      // 查询当前溢价（从做市商平均值计算，这里简化为固定值）
      setSellPremiumBps(200)  // 2% 溢价
      setBuyPremiumBps(-100)  // -1% 溢价
      
      // 查询首购池价格（如果符合首购资格）
      if (isFirstPurchaseEligible) {
        // TODO: 调用 service.getFirstPurchasePrice()
        setFirstPurchasePrice(basePrice * 0.9) // 假设首购优惠10%
      }
    } catch (error) {
      console.error('加载价格失败:', error)
    }
  }

  useEffect(() => {
    loadPriceAndEligibility()
  }, [account])

  /**
   * 函数级详细中文注释：计算 MEMO → TRON 的实际价格
   */
  const calculateMemoToTronPrice = (): number => {
    // 卖出MEMO：应用卖出溢价
    const premiumRate = sellPremiumBps / 10000
    return basePrice * (1 + premiumRate)
  }

  /**
   * 函数级详细中文注释：计算 USDT → MEMO 的实际价格
   */
  const calculateUsdtToMemoPrice = (): number => {
    // 买入MEMO：如果符合首购，使用首购价；否则应用买入溢价
    if (isFirstPurchaseEligible) {
      return firstPurchasePrice
    }
    
    const premiumRate = buyPremiumBps / 10000
    return basePrice * (1 + premiumRate)
  }

  /**
   * 函数级详细中文注释：MEMO → TRON 转换
   */
  const calculateMemoToUsdt = (memo: number): number => {
    const price = calculateMemoToTronPrice()
    return memo * price
  }

  /**
   * 函数级详细中文注释：USDT → MEMO 转换
   */
  const calculateUsdtToMemo = (usdt: number): number => {
    const price = calculateUsdtToMemoPrice()
    return usdt / price
  }

  /**
   * 函数级详细中文注释：提交 MEMO → TRON 交易
   */
  const handleMemoToTron = async (values: any) => {
    setLoading(true)
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      // 转换数量（MEMO → 最小单位）
      const qtyMinimalUnits = (BigInt(Math.floor(values.dustAmount * 1_000_000))).toString()
      
      const tx = service.buildBridgeMemoToTronTx({
        qty: qtyMinimalUnits,
        tronAddress: values.tronAddress,
      })

      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      await tx.signAndSend(
        account,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isInBlock) {
            message.success('交易已提交，等待区块确认...')
          } else if (status.isFinalized) {
            message.success('兑换成功！USDT将发送到您的TRON地址。')
            setLoading(false)
            form.resetFields()
            setDustAmount(0)
            onSuccess?.()
          }
        }
      )
    } catch (error: any) {
      console.error('MEMO→TRON 失败:', error)
      message.error(error.message || '交易失败')
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：提交 USDT → MEMO 交易
   */
  const handleUsdtToMemo = async (values: any) => {
    setLoading(true)
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      // 转换数量（USDT → 最小单位，假设6位小数）
      const usdtMinimalUnits = (BigInt(Math.floor(values.usdtAmount * 1_000_000))).toString()
      
      const tx = service.buildBridgeUsdtToMemoTx({
        usdtAmount: usdtMinimalUnits,
        paymentCommit: values.paymentCommit,
      })

      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      await tx.signAndSend(
        account,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isInBlock) {
            message.success('交易已提交，等待区块确认...')
          } else if (status.isFinalized) {
            message.success('购买成功！MEMO将发送到您的账户。')
            setLoading(false)
            form.resetFields()
            setUsdtAmount(0)
            onSuccess?.()
          }
        }
      )
    } catch (error: any) {
      console.error('USDT→MEMO 失败:', error)
      message.error(error.message || '交易失败')
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：渲染 MEMO → TRON 表单
   */
  const renderMemoToTronForm = () => {
    const price = calculateMemoToTronPrice()
    const usdtReceive = calculateMemoToUsdt(dustAmount)
    const premium = sellPremiumBps / 100

    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleMemoToTron}
        autoComplete="off"
      >
        {/* 价格信息 */}
        <Alert
          message={
            <Space>
              <Text>当前汇率：</Text>
              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                1 MEMO = {price.toFixed(4)} USDT
              </Text>
              {premium !== 0 && (
                <Tag color={premium > 0 ? 'red' : 'green'}>
                  {premium > 0 ? '+' : ''}{premium.toFixed(2)}%
                </Tag>
              )}
            </Space>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 24 }}
        />

        {/* MEMO数量 */}
        <Form.Item
          label="兑换数量（MEMO）"
          name="dustAmount"
          rules={[
            { required: true, message: '请输入兑换数量' },
            { type: 'number', min: 0.001, message: '数量不能小于0.001' },
          ]}
        >
          <InputNumber
            min={0.001}
            max={1000000}
            step={1}
            precision={6}
            style={{ width: '100%' }}
            placeholder="输入MEMO数量"
            addonAfter="MEMO"
            onChange={(value) => setDustAmount(value || 0)}
          />
        </Form.Item>

        {/* TRON地址 */}
        <Form.Item
          label="接收TRON地址"
          name="tronAddress"
          rules={[
            { required: true, message: '请输入TRON地址' },
            { 
              validator: (_, value) => {
                if (!value || validateTronAddress(value)) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('无效的TRON地址'))
              }
            }
          ]}
          tooltip="输入您的TRON钱包地址（以 'T' 开头）"
        >
          <Input 
            placeholder="T1234...（34位字符）" 
            maxLength={34}
            showCount
          />
        </Form.Item>

        {/* 交易摘要 */}
        {dustAmount > 0 && (
          <div 
            style={{ 
              background: '#f5f5f5', 
              padding: 16, 
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">兑换数量：</Text>
                <Text strong>{formatMEMO(dustAmount)}</Text>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">汇率：</Text>
                <Text>{price.toFixed(4)} USDT/MEMO</Text>
              </div>

              <Divider style={{ margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <SwapOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: 16 }}>预计到账：</Text>
                </Space>
                <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                  {formatUSDT(usdtReceive)}
                </Text>
              </div>
            </Space>
          </div>
        )}

        {/* 提交按钮 */}
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            size="large"
            icon={<SwapOutlined />}
            loading={loading}
          >
            立即兑换
          </Button>
        </Form.Item>

        {/* 温馨提示 */}
        <Alert
          message="温馨提示"
          description={
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>MEMO将从您的账户扣除</li>
              <li>USDT将发送到您指定的TRON地址</li>
              <li>交易不可撤销，请仔细核对地址</li>
            </ul>
          }
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
        />
      </Form>
    )
  }

  /**
   * 函数级详细中文注释：渲染 USDT → MEMO 表单
   */
  const renderUsdtToMemoForm = () => {
    const price = calculateUsdtToMemoPrice()
    const dustReceive = calculateUsdtToMemo(usdtAmount)
    const isFirstPurchase = isFirstPurchaseEligible
    const savingsPercent = isFirstPurchase 
      ? ((1 - firstPurchasePrice / basePrice) * 100).toFixed(1)
      : '0'

    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleUsdtToMemo}
        autoComplete="off"
      >
        {/* 首购优惠提示 */}
        {isFirstPurchase && (
          <Alert
            message={
              <Space>
                <GiftOutlined />
                <Text strong>首购优惠</Text>
              </Space>
            }
            description={
              <Space direction="vertical" size="small">
                <Text>您符合首购资格，享受特惠价格！</Text>
                <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                  1 MEMO = {firstPurchasePrice.toFixed(4)} USDT
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  比市场价优惠 {savingsPercent}%
                </Text>
              </Space>
            }
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 价格信息 */}
        <Alert
          message={
            <Space>
              <Text>当前汇率：</Text>
              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                1 MEMO = {price.toFixed(4)} USDT
              </Text>
              {!isFirstPurchase && buyPremiumBps !== 0 && (
                <Tag color={buyPremiumBps > 0 ? 'red' : 'green'}>
                  {buyPremiumBps > 0 ? '+' : ''}{(buyPremiumBps / 100).toFixed(2)}%
                </Tag>
              )}
            </Space>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 24 }}
        />

        {/* USDT数量 */}
        <Form.Item
          label="支付金额（USDT）"
          name="usdtAmount"
          rules={[
            { required: true, message: '请输入支付金额' },
            { type: 'number', min: 1, message: '金额不能小于1' },
          ]}
        >
          <InputNumber
            min={1}
            max={100000}
            step={10}
            precision={2}
            style={{ width: '100%' }}
            placeholder="输入USDT金额"
            addonAfter="USDT"
            onChange={(value) => setUsdtAmount(value || 0)}
          />
        </Form.Item>

        {/* 付款凭证哈希 */}
        <Form.Item
          label="付款凭证哈希"
          name="paymentCommit"
          rules={[{ required: true, message: '请输入付款凭证哈希' }]}
          tooltip="输入您的USDT付款凭证（如TRON交易哈希）"
        >
          <Input.TextArea
            rows={2}
            placeholder="输入付款凭证哈希值"
            maxLength={200}
            showCount
          />
        </Form.Item>

        {/* 交易摘要 */}
        {usdtAmount > 0 && (
          <div 
            style={{ 
              background: '#f5f5f5', 
              padding: 16, 
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">支付金额：</Text>
                <Text strong>{formatUSDT(usdtAmount)}</Text>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">汇率：</Text>
                <Text>{price.toFixed(4)} USDT/MEMO</Text>
              </div>

              {isFirstPurchase && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">优惠：</Text>
                  <Text style={{ color: '#52c41a' }}>
                    <GiftOutlined /> 首购立省 {savingsPercent}%
                  </Text>
                </div>
              )}

              <Divider style={{ margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <SwapOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: 16 }}>预计到账：</Text>
                </Space>
                <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                  {formatMEMO(dustReceive)}
                </Text>
              </div>
            </Space>
          </div>
        )}

        {/* 提交按钮 */}
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            size="large"
            icon={<CheckCircleOutlined />}
            loading={loading}
          >
            {isFirstPurchase ? '使用首购优惠购买' : '立即购买'}
          </Button>
        </Form.Item>

        {/* 温馨提示 */}
        <Alert
          message="温馨提示"
          description={
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>请先通过TRON网络完成USDT付款</li>
              <li>付款后填写交易哈希作为凭证</li>
              <li>MEMO将在确认后发送到您的账户</li>
              {isFirstPurchase && <li>首购优惠每个账户仅限一次</li>}
            </ul>
          }
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
        />
      </Form>
    )
  }

  return (
    <Card
      style={{ 
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <Title level={4} style={{ marginBottom: 24 }}>
        <Space>
          <SwapOutlined style={{ color: '#1890ff' }} />
          <span>跨链桥交易</span>
        </Space>
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as 'memoToTron' | 'usdtToMemo')
          form.resetFields()
          setDustAmount(0)
          setUsdtAmount(0)
        }}
        items={[
          {
            key: 'memoToTron',
            label: (
              <Space>
                <ArrowRightOutlined />
                <span>MEMO → TRON</span>
              </Space>
            ),
            children: renderMemoToTronForm(),
          },
          {
            key: 'usdtToMemo',
            label: (
              <Space>
                <ArrowRightOutlined />
                <span>USDT → MEMO</span>
                {isFirstPurchaseEligible && (
                  <Tag color="success" icon={<GiftOutlined />}>
                    首购优惠
                  </Tag>
                )}
              </Space>
            ),
            children: renderUsdtToMemoForm(),
          },
        ]}
      />
    </Card>
  )
}

