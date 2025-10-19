import React, { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Row, Col, Select, Switch, Typography, message, Space, Tag, Modal, Card, Statistic } from 'antd'
import { signAndSend } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { CloseOutlined, EllipsisOutlined, InfoCircleOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useKyc } from '../../hooks/useKyc'

/**
 * 函数级详细中文注释：创建挂单（v2.0 动态定价版本）
 * - 核心改进：
 *   1. 使用 USDT 单价直接定价（price_usdt），替代 spread_bps
 *   2. 实时显示市场均价和允许的价格范围（±20%）
 *   3. 价格偏离告警：当输入价格超出允许范围时显示警告
 *   4. 冷启动保护：市场价格为 0 时允许自由定价
 * - 页面结构：顶部标题栏 + 市场价格卡片 + 表单主体 + 底部固定提交按钮。
 * - 交互与兼容：单列优先，小字段按两列栅格排布；底部固定 CTA 便于拇指操作。
 */
const CreateListingForm: React.FC = () => {
  const wallet = useWallet()
  const [form] = Form.useForm()
  const [consts, setConsts] = useState<{ requireKyc?: boolean; createWindow?: number; createMax?: number; listingFee?: string; listingBond?: string; maxSpread?: number; } | null>(null)
  const [marketPrice, setMarketPrice] = useState<number>(0) // 市场均价（USDT，精度 10^6）
  const [maxDeviation, setMaxDeviation] = useState<number>(2000) // 最大偏离（万分比，默认 2000 = 20%）
  const [priceUsdt, setPriceUsdt] = useState<number>(0) // 用户输入的价格
  const [priceStatus, setPriceStatus] = useState<'ok' | 'warning' | 'error'>('ok')
  const { current } = wallet
  const { loading: kycLoading, verified } = useKyc(current)

  // 函数级中文注释：计算允许的价格范围
  const getPriceRange = () => {
    if (marketPrice === 0 || maxDeviation === 0) {
      return { min: 0, max: 0, enabled: false }
    }
    const min = Math.floor(marketPrice * (10000 - maxDeviation) / 10000)
    const max = Math.ceil(marketPrice * (10000 + maxDeviation) / 10000)
    return { min, max, enabled: true }
  }

  // 函数级中文注释：计算价格偏离度
  const getDeviation = (price: number) => {
    if (marketPrice === 0) return 0
    return ((price - marketPrice) / marketPrice * 100)
  }

  useEffect(() => {
    (async () => {
      try {
        const api = await getApi()
        const requireKyc = (api.consts as any).otcListing?.requireKyc as boolean
        const createWindow = Number((api.consts as any).otcListing?.createWindow || 0)
        const createMax = Number((api.consts as any).otcListing?.createMaxInWindow || 0)
        const listingFee = ((api.consts as any).otcListing?.listingFee || 0n).toString()
        const listingBond = ((api.consts as any).otcListing?.listingBond || 0n).toString()
        const maxSpread = Number((api.consts as any).otcListing?.maxSpreadBps || 0)
        setConsts({ requireKyc, createWindow, createMax, listingFee, listingBond, maxSpread })

        // 函数级中文注释：查询市场均价和最大偏离
        const marketPriceRaw = await api.query.pricing.getMemoMarketPriceWeighted()
        const marketPriceNum = Number(marketPriceRaw.toString())
        setMarketPrice(marketPriceNum)

        const maxDeviationRaw = await api.query.otcListing.maxPriceDeviation()
        const maxDeviationNum = Number(maxDeviationRaw.toString())
        setMaxDeviation(maxDeviationNum)
        
        // 函数级中文注释：如果市场价格可用，设置默认价格为市场价
        if (marketPriceNum > 0) {
          form.setFieldsValue({ price_usdt: marketPriceNum })
          setPriceUsdt(marketPriceNum)
        }
      } catch (e) {
        console.error('Failed to load market data:', e)
      }
    })()
  }, [form])

  // 函数级中文注释：监听价格输入，实时检查偏离度
  useEffect(() => {
    if (priceUsdt === 0) {
      setPriceStatus('ok')
      return
    }

    const range = getPriceRange()
    if (!range.enabled) {
      // 冷启动状态，允许自由定价
      setPriceStatus('ok')
      return
    }

    if (priceUsdt < range.min || priceUsdt > range.max) {
      setPriceStatus('error')
    } else {
      const deviation = Math.abs(getDeviation(priceUsdt))
      if (deviation > 10) {
        setPriceStatus('warning')
      } else {
        setPriceStatus('ok')
      }
    }
  }, [priceUsdt, marketPrice, maxDeviation])

  /**
   * 函数级详细中文注释：表单提交处理
   * - 参数顺序：side, base, quote, price_usdt, pricing_spread_bps, min_qty, max_qty, total, partial, expire_at, price_min, price_max, terms_commit
   */
  const onFinish = async (values: any) => {
    try {
      const owner = values.owner?.trim() || wallet.current
      if (!owner) throw new Error('请输入你的地址(owner) 或连接钱包')

      // 基本前端校验
      if (Number(values.min_qty) <= 0 || Number(values.max_qty) <= 0) throw new Error('每笔数量上下限需大于 0')
      if (Number(values.min_qty) > Number(values.max_qty)) throw new Error('每笔最小数量不能大于最大数量')
      if (Number(values.total) < Number(values.min_qty)) throw new Error('总量不能小于每笔最小数量')

      // 函数级中文注释：价格偏离检查（前端二次确认）
      const range = getPriceRange()
      if (range.enabled && (values.price_usdt < range.min || values.price_usdt > range.max)) {
        const deviation = getDeviation(values.price_usdt).toFixed(2)
        const confirmed = await new Promise((resolve) => {
          Modal.confirm({
            title: '价格偏离警告',
            content: (
              <div>
                <p>你的挂单价格偏离市场均价 <strong>{deviation}%</strong>，超出允许范围 (±{maxDeviation / 100}%)。</p>
                <p>市场均价：<strong>{(marketPrice / 1_000_000).toFixed(6)} USDT</strong></p>
                <p>你的价格：<strong>{(values.price_usdt / 1_000_000).toFixed(6)} USDT</strong></p>
                <p>允许范围：<strong>{(range.min / 1_000_000).toFixed(6)} - {(range.max / 1_000_000).toFixed(6)} USDT</strong></p>
                <p style={{ color: '#ff4d4f', marginTop: 12 }}>⚠️ 链上交易将被拒绝，请调整价格后重试。</p>
              </div>
            ),
            okText: '调整价格',
            cancelText: '仍然提交',
            onOk: () => resolve(false),
            onCancel: () => resolve(true),
          })
        })
        
        if (!confirmed) {
          return
        }
      }

      // 函数级中文注释：参数顺序必须与链上接口一致
      // create_listing(side, base, quote, price_usdt, pricing_spread_bps, min_qty, max_qty, total, partial, expire_at, price_min, price_max, terms_commit)
      const args = [
        Number(values.side),                  // side
        Number(values.base || 0),             // base
        Number(values.quote || 0),            // quote
        BigInt(values.price_usdt),            // price_usdt (USDT单价，精度 10^6)
        0,                                    // pricing_spread_bps (保留字段，传 0)
        BigInt(values.min_qty * 1e12),        // min_qty (MEMO最小单位)
        BigInt(values.max_qty * 1e12),        // max_qty (MEMO最小单位)
        BigInt(values.total * 1e12),          // total (MEMO最小单位)
        Boolean(values.partial),              // partial
        Number(values.expire_at),             // expire_at
        values.price_min ? BigInt(values.price_min * 1e12) : null, // price_min (可选)
        values.price_max ? BigInt(values.price_max * 1e12) : null, // price_max (可选)
        null,                                 // terms_commit (可选)
      ]
      
      const txHash = await wallet.signAndSendLocal('otcListing', 'createListing', args)
      message.success(`挂单创建成功：${txHash}`)
      form.resetFields()
      
      // 函数级中文注释：重新查询市场价格，刷新显示
      const api = await getApi()
      const marketPriceRaw = await api.query.pricing.getMemoMarketPriceWeighted()
      setMarketPrice(Number(marketPriceRaw.toString()))
    } catch (e: any) {
      console.error('Create listing failed:', e)
      message.error(e?.message || '提交失败')
    }
  }

  const range = getPriceRange()
  const deviation = priceUsdt > 0 ? getDeviation(priceUsdt) : 0

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 88 }}>
      {/* 顶部标题栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} onClick={() => window.history.back()} />
          <Typography.Title level={4} style={{ margin: 0 }}>创建挂单</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      {/* 市场价格卡片（v2.0 新增） */}
      <div style={{ padding: '8px 8px 0' }}>
        <Card size="small" style={{ marginBottom: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Text strong>市场均价</Typography.Text>
              {marketPrice > 0 ? (
                <Tag color="green">
                  {(marketPrice / 1_000_000).toFixed(6)} USDT/MEMO
                </Tag>
              ) : (
                <Tag color="orange">冷启动状态</Tag>
              )}
            </div>
            
            {range.enabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  允许范围 (±{maxDeviation / 100}%)
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {(range.min / 1_000_000).toFixed(6)} - {(range.max / 1_000_000).toFixed(6)} USDT
                </Typography.Text>
              </div>
            )}
            
            {marketPrice === 0 && (
              <Alert
                type="info"
                showIcon
                message="当前处于冷启动状态，市场价格尚未形成，可自由定价。"
                style={{ fontSize: 12 }}
              />
            )}
          </Space>
        </Card>
      </div>

      {/* 顶部提示 */}
      <div style={{ padding: '0 8px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {!kycLoading && consts?.requireKyc && !verified && (
            <Alert
              type="warning"
              showIcon
              message={<span>你尚未通过 KYC，无法创建挂单。请前往身份页完成实名判定（KnownGood / Reasonable）。</span>}
              action={<Button size="small" onClick={()=>{ window.location.hash = '#/profile' }}>去身份页</Button>}
            />
          )}
          {consts && (
            <Alert
              type="info"
              showIcon
              message={<span style={{ fontSize: 12 }}>
                仅允许发布卖单；创建限频窗口 {consts.createWindow} 块，最多 {consts.createMax} 次；
                上架费 {(BigInt(consts.listingFee) / BigInt(1e12)).toString()} MEMO，保证金 {(BigInt(consts.listingBond) / BigInt(1e12)).toString()} MEMO
              </span>}
            />
          )}
        </Space>
      </div>

      {/* 表单主体 */}
      <div style={{ padding: 8 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ side: 1, partial: true, base: 0, quote: 0 }}>
          <Form.Item name="owner" label="你的地址" rules={[{ required: true }]}>
            <Input placeholder={wallet.current || "5F..."} size="large" />
          </Form.Item>
          
          <Form.Item name="side" label="方向" rules={[{ required: true }]}> 
            <Select 
              options={[{ label: '卖出 MEMO', value: 1 }]} 
              size="large" 
              disabled
            />
          </Form.Item>

          {/* 价格输入（v2.0 核心改进） */}
          <Form.Item 
            name="price_usdt" 
            label={
              <Space>
                <span>挂单价格（USDT/MEMO）</span>
                {priceStatus === 'ok' && priceUsdt > 0 && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                {priceStatus === 'warning' && <WarningOutlined style={{ color: '#faad14' }} />}
                {priceStatus === 'error' && <WarningOutlined style={{ color: '#ff4d4f' }} />}
              </Space>
            }
            rules={[
              { required: true, message: '请输入挂单价格' },
              { 
                validator: (_, value) => {
                  if (!value || value <= 0) {
                    return Promise.reject('价格必须大于 0')
                  }
                  if (value < 10_000 || value > 100_000_000) {
                    return Promise.reject('价格范围：0.01 - 100 USDT')
                  }
                  return Promise.resolve()
                }
              }
            ]}
            help={
              priceUsdt > 0 && marketPrice > 0 ? (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>你的价格：{(priceUsdt / 1_000_000).toFixed(6)} USDT</span>
                    <span style={{ color: deviation > 0 ? '#f5222d' : '#52c41a' }}>
                      {deviation > 0 ? '+' : ''}{deviation.toFixed(2)}%
                    </span>
                  </div>
                  {priceStatus === 'error' && (
                    <Alert
                      type="error"
                      showIcon
                      message={`价格偏离超出允许范围 (±${maxDeviation / 100}%)，链上交易将被拒绝！`}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    />
                  )}
                  {priceStatus === 'warning' && (
                    <Alert
                      type="warning"
                      showIcon
                      message={`价格偏离较大 (${deviation.toFixed(2)}%)，建议调整至市场均价附近。`}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    />
                  )}
                </Space>
              ) : marketPrice === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  冷启动状态，可自由定价。建议参考其他交易所价格。
                </Typography.Text>
              ) : null
            }
          >
            <InputNumber 
              min={10_000} 
              max={100_000_000}
              step={10_000}
              style={{ width: '100%' }} 
              size="large"
              placeholder="例如：500000 (0.5 USDT)"
              onChange={(value) => setPriceUsdt(Number(value) || 0)}
              addonBefore="精度 10^6"
              addonAfter={
                priceUsdt > 0 ? (
                  <Typography.Text>{(priceUsdt / 1_000_000).toFixed(6)} USDT</Typography.Text>
                ) : null
              }
            />
          </Form.Item>

          {/* 快捷价格按钮（v2.0 新增） */}
          {marketPrice > 0 && (
            <Form.Item label=" " colon={false}>
              <Space wrap>
                <Button 
                  size="small" 
                  onClick={() => {
                    const price = Math.floor(marketPrice * 0.95)
                    form.setFieldsValue({ price_usdt: price })
                    setPriceUsdt(price)
                  }}
                >
                  市价 -5%
                </Button>
                <Button 
                  size="small" 
                  onClick={() => {
                    form.setFieldsValue({ price_usdt: marketPrice })
                    setPriceUsdt(marketPrice)
                  }}
                >
                  市价
                </Button>
                <Button 
                  size="small" 
                  onClick={() => {
                    const price = Math.ceil(marketPrice * 1.05)
                    form.setFieldsValue({ price_usdt: price })
                    setPriceUsdt(price)
                  }}
                >
                  市价 +5%
                </Button>
                <Button 
                  size="small" 
                  onClick={() => {
                    const price = Math.ceil(marketPrice * 1.1)
                    form.setFieldsValue({ price_usdt: price })
                    setPriceUsdt(price)
                  }}
                >
                  市价 +10%
                </Button>
              </Space>
            </Form.Item>
          )}

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="min_qty" label="每笔最小数量 (MEMO)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="1000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_qty" label="每笔最大数量 (MEMO)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="5000" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="total" label="挂单总量 (MEMO)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="10000" />
          </Form.Item>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="price_min" label="价带下限 (可选, MEMO)" >
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price_max" label="价带上限 (可选, MEMO)">
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="partial" valuePropName="checked" label="允许部分成交">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expire_at" label="过期区块高度" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          {/* 底部固定提交按钮 */}
          <Form.Item noStyle>
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #eee', padding: '8px 12px 16px', zIndex: 1000 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  block 
                  size="large" 
                  disabled={!!consts?.requireKyc && !verified}
                  danger={priceStatus === 'error'}
                >
                  {priceStatus === 'error' ? '价格超出范围，无法提交' : '创建挂单'}
                </Button>
                {consts?.requireKyc && !verified && (
                  <Button onClick={()=>{ window.location.hash = '#/profile' }} block size="large">去身份页完成 KYC</Button>
                )}
              </Space>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default CreateListingForm
