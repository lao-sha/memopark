import React from 'react'
import { Card, Form, Input, InputNumber, Button, Radio, Space, Select, Typography, Descriptions, Tag, message, Table, Alert, Spin, Divider } from 'antd'
import { ArrowLeftOutlined, ShoppingCartOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { createOrder, getOrderStatus } from '../../lib/otc-adapter'
import { providerRegistry, pickProvider } from '../../lib/providers'
import { getApi } from '../../lib/polkadot'

const { Title, Text } = Typography

/**
 * 函数级详细中文注释：做市商信息接口
 */
interface MarketMaker {
  mmId: number
  owner: string
  feeBps: number
  minAmount: string
  publicCid: string
  deposit: string
}

/**
 * 函数级详细中文注释：OTC 下单页（创建订单 + 二维码 + 轮询状态）
 * - 目标：为用户生成一次性短时有效的订单与支付二维码，引导完成支付；
 * - 实现：显示做市商出价列表 + 金额（法币或 MEMO 二选一）+ 通道，创建订单后展示二维码/链接；
 * - 轮询：每 5 秒查询一次状态，进入 paid_confirmed 后提供"前往领取"入口；
 * - 安全：关键字段均来自服务端返回（memo_amount/expired_at/url 等），前端不做价格计算。
 * - UI风格：与欢迎、创建钱包、恢复钱包页面保持一致
 * - 返回功能：返回"我的钱包"页面
 */
export default function CreateOrderPage({ onBack }: { onBack?: () => void } = {}) {
  /**
   * 函数级中文注释：返回我的钱包页面
   * - 触发 mp.nav 事件切换到"我的钱包" Tab
   * - 清空当前 hash 路由
   */
  const handleBackToWallet = () => {
    if (onBack) {
      onBack()
    } else {
      // 触发导航事件到"我的钱包" Tab
      window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'my-wallet' } }))
      // 清空 hash 路由
      window.location.hash = ''
    }
  }
  const [form] = Form.useForm()
  const [creating, setCreating] = React.useState(false)
  const [providerId, setProviderId] = React.useState<string>(providerRegistry[0]?.id)
  const [order, setOrder] = React.useState<any | null>(null)
  const [status, setStatus] = React.useState<string>('pending')
  const [nowSec, setNowSec] = React.useState<number>(Math.floor(Date.now() / 1000))
  const [marketMakers, setMarketMakers] = React.useState<MarketMaker[]>([])
  const [loadingMM, setLoadingMM] = React.useState<boolean>(true)
  const [mmError, setMmError] = React.useState<string>('')
  const [selectedMaker, setSelectedMaker] = React.useState<MarketMaker | null>(null)

  /**
   * 函数级中文注释：加载链上做市商列表
   * - 查询所有 Active 状态的做市商
   * - 提取费率、最小金额等信息
   * - 按费率降序排列（高费率在前，代表卖出价格更高）
   */
  React.useEffect(() => {
    const loadMarketMakers = async () => {
      try {
        setLoadingMM(true)
        setMmError('')
        
        const api = await getApi()
        
        // 检查 pallet 是否存在
        if (!(api.query as any).marketMaker) {
          setMmError('做市商模块尚未在链上注册')
          setLoadingMM(false)
          return
        }

        // 获取 nextId
        const nextIdRaw = await (api.query as any).marketMaker.nextId()
        const nextId = Number(nextIdRaw.toString())
        
        // 查询所有做市商
        const makers: MarketMaker[] = []
        for (let i = 0; i < nextId; i++) {
          const appOption = await (api.query as any).marketMaker.applications(i)
          if (appOption.isSome) {
            const app = appOption.unwrap()
            const appData = app.toJSON() as any
            
            // 只显示 Active 状态的做市商
            if (appData.status === 'Active') {
              makers.push({
                mmId: i,
                owner: appData.owner || '',
                feeBps: appData.feeBps || 0,
                minAmount: appData.minAmount || '0',
                publicCid: appData.publicCid ? 
                  (Array.isArray(appData.publicCid) ? 
                    new TextDecoder().decode(new Uint8Array(appData.publicCid)) : 
                    appData.publicCid) : '',
                deposit: appData.deposit || '0'
              })
            }
          }
        }
        
        // 按费率降序排序（费率高的做市商意味着用户需要支付更多，所以卖出价更高）
        makers.sort((a, b) => b.feeBps - a.feeBps)
        
        setMarketMakers(makers)
        
        // 如果只有一个做市商，自动选中
        if (makers.length === 1) {
          setSelectedMaker(makers[0])
          message.info('已自动选择唯一的做市商')
        }
      } catch (e: any) {
        console.error('加载做市商列表失败:', e)
        setMmError(e?.message || '加载做市商列表失败')
      } finally {
        setLoadingMM(false)
      }
    }
    
    loadMarketMakers()
  }, [])

  // 倒计时心跳（1s）
  React.useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  // 轮询订单状态（5s）
  React.useEffect(() => {
    if (!order?.order_id) return
    if (['paid_confirmed', 'authorized', 'settled', 'expired', 'failed'].includes(status)) return
    const iv = setInterval(async () => {
      try {
        const s = await getOrderStatus(order.order_id, providerId)
        setStatus(s.status)
      } catch (e) {
        // 忽略短期网络抖动
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [order?.order_id, providerId, status])

  /**
   * 函数级中文注释：提交创建订单
   * - 检查是否选择了做市商
   * - 验证订单金额是否满足做市商的最小金额要求
   * - 根据用户选择（法币金额或 MEMO 数量）构造请求
   * - 将选中的做市商信息附加到订单请求中
   * - 创建成功后保存订单草案并进入轮询
   */
  const onCreate = async (values: any) => {
    try {
      setCreating(true)
      
      // 检查是否选择了做市商
      if (!selectedMaker) {
        message.warning('请先从列表中选择一个做市商')
        setCreating(false)
        return
      }

      // 验证金额是否满足最小要求
      if (values.mode === 'memo') {
        const orderAmount = Number(values.memoAmount)
        const minAmount = Number(BigInt(selectedMaker.minAmount) / BigInt(1e12))
        if (orderAmount < minAmount) {
          message.warning(`订单金额不能低于做市商最小金额：${minAmount} MEMO`)
          setCreating(false)
          return
        }
      }

      const req: any = { 
        providerId, 
        payType: values.payType,
        // 附加选中的做市商信息
        marketMakerId: selectedMaker.mmId,
        marketMakerOwner: selectedMaker.owner,
        marketMakerFeeBps: selectedMaker.feeBps
      }
      
      if (values.mode === 'fiat') req.fiatAmount = String(values.fiatAmount)
      if (values.mode === 'memo') req.memoAmount = String(values.memoAmount)
      
      // returnUrl 便于支付页回跳后直接进入领取页（仅 UX）
      const p = pickProvider(providerId)
      req.returnUrl = `${location.origin}${location.pathname}#/otc/claim?provider=${encodeURIComponent(providerId)}`
      
      const draft = await createOrder(req)
      setOrder(draft)
      setStatus('pending')
      message.success(`订单已创建，请扫码支付（做市商 #${selectedMaker.mmId}）`)
    } catch (e: any) {
      message.error(e?.message || '创建订单失败')
    } finally {
      setCreating(false)
    }
  }

  const remainSec = React.useMemo(() => {
    if (!order?.expired_at) return 0
    return Math.max(0, Number(order.expired_at) - nowSec)
  }, [order?.expired_at, nowSec])

  const paidOk = status === 'paid_confirmed' || status === 'authorized' || status === 'settled'

  const payUrl = order?.url || order?.pay_qr
  const qrImg = payUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payUrl)}` : ''

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
      }}
    >
      {/* 返回按钮 - 固定在左上角 */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px',
        zIndex: 10,
      }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToWallet}
          style={{ 
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          返回我的钱包
        </Button>
      </div>

      {/* 主内容区域 */}
      <div
        style={{
          padding: '60px 20px 20px',
          maxWidth: '640px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >

      {/* 标题区域 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
          }}
        >
          <ShoppingCartOutlined style={{ fontSize: '40px', color: '#fff' }} />
        </div>
        <Title level={2} style={{ color: '#667eea', marginBottom: '8px' }}>
          购买 MEMO
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          选择做市商并完成支付
        </Text>
        <div style={{ marginTop: '12px' }}>
          <Button 
            type="link" 
            onClick={() => window.location.hash = '#/otc/mm-apply'}
            style={{ fontSize: '14px' }}
          >
            申请成为做市商 →
          </Button>
        </div>
      </div>

      {/* 做市商出价列表 */}
      <div
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
        }}
      >
        <Text strong style={{ fontSize: '16px', marginBottom: '16px', display: 'block' }}>
          做市商出价列表
        </Text>
        {loadingMM ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin tip="加载做市商列表中..." />
          </div>
        ) : mmError ? (
          <Alert 
            type="info" 
            showIcon 
            message="暂无做市商数据" 
            description={mmError}
            style={{ marginBottom: 0 }}
          />
        ) : marketMakers.length === 0 ? (
          <Alert 
            type="info" 
            showIcon 
            message="暂无活跃做市商" 
            description="当前没有通过审核的做市商，您可以申请成为做市商。"
            style={{ marginBottom: 0 }}
          />
        ) : (
          <Table<MarketMaker>
            dataSource={marketMakers}
            rowKey="mmId"
            size="small"
            pagination={false}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedMaker ? [selectedMaker.mmId] : [],
              onChange: (_, selectedRows) => {
                setSelectedMaker(selectedRows[0] || null)
              }
            }}
            onRow={(record) => ({
              onClick: () => setSelectedMaker(record),
              style: { cursor: 'pointer' }
            })}
            columns={[
              {
                title: 'ID',
                dataIndex: 'mmId',
                key: 'mmId',
                width: 60,
                render: (id: number) => <Tag color="blue">#{id}</Tag>
              },
              {
                title: '做市商地址',
                dataIndex: 'owner',
                key: 'owner',
                ellipsis: true,
                render: (owner: string) => (
                  <Typography.Text 
                    ellipsis={{ tooltip: owner }} 
                    style={{ maxWidth: 150 }}
                    copyable={{ text: owner }}
                  >
                    {owner.slice(0, 8)}...{owner.slice(-6)}
                  </Typography.Text>
                )
              },
              {
                title: '费率',
                dataIndex: 'feeBps',
                key: 'feeBps',
                width: 100,
                sorter: (a, b) => b.feeBps - a.feeBps,
                defaultSortOrder: 'descend',
                render: (feeBps: number) => (
                  <Tag color={feeBps <= 50 ? 'green' : feeBps <= 100 ? 'orange' : 'red'}>
                    {(feeBps / 100).toFixed(2)}%
                  </Tag>
                )
              },
              {
                title: '最小金额',
                dataIndex: 'minAmount',
                key: 'minAmount',
                width: 120,
                render: (minAmount: string) => {
                  try {
                    // MEMO 使用 12 位小数
                    const amount = BigInt(minAmount) / BigInt(1e12)
                    return `${amount.toString()} MEMO`
                  } catch {
                    return minAmount
                  }
                }
              },
              {
                title: '质押金额',
                dataIndex: 'deposit',
                key: 'deposit',
                width: 120,
                render: (deposit: string) => {
                  try {
                    // MEMO 使用 12 位小数
                    const amount = BigInt(deposit) / BigInt(1e12)
                    return `${amount.toString()} MEMO`
                  } catch {
                    return deposit
                  }
                }
              }
            ]}
          />
        )}
      </div>

      {/* 当前选中的做市商信息 */}
      {selectedMaker && (
        <div
          style={{
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '16px',
            position: 'relative',
          }}
        >
          <Button
            type="text"
            size="small"
            onClick={() => setSelectedMaker(null)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              fontSize: '12px',
              color: '#595959',
            }}
          >
            ✕
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px', marginRight: '8px' }} />
            <Text strong style={{ color: '#52c41a' }}>已选择做市商</Text>
          </div>
          <Space direction="vertical" size="small" style={{ width: '100%', paddingLeft: '24px' }}>
            <div>
              <Text style={{ fontSize: '13px', color: '#595959' }}>做市商 ID：</Text>
              <Tag color="blue">#{selectedMaker.mmId}</Tag>
            </div>
            <div>
              <Text style={{ fontSize: '13px', color: '#595959' }}>费率：</Text>
              <Tag color={selectedMaker.feeBps <= 50 ? 'green' : selectedMaker.feeBps <= 100 ? 'orange' : 'red'}>
                {(selectedMaker.feeBps / 100).toFixed(2)}%
              </Tag>
            </div>
            <div>
              <Text style={{ fontSize: '13px', color: '#595959' }}>最小金额：</Text>
              <Text style={{ fontSize: '13px' }}>
                {(BigInt(selectedMaker.minAmount) / BigInt(1e12)).toString()} MEMO
              </Text>
            </div>
          </Space>
        </div>
      )}

      {/* 订单表单 */}
      <div
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
        }}
      >
      <Form form={form} layout="vertical" onFinish={onCreate} initialValues={{ mode: 'fiat', payType: 'alipay' }}>
        <Form.Item label="计价模式" name="mode">
          <Radio.Group>
            <Radio.Button value="fiat">按法币金额</Radio.Button>
            <Radio.Button value="memo">按 MEMO 数量</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item noStyle shouldUpdate>
          {() => {
            const mode = form.getFieldValue('mode')
            return (
              <>
                {mode === 'fiat' ? (
                  <Form.Item name="fiatAmount" label="法币金额" rules={[{ required: true }]}> 
                    <InputNumber min={1} precision={2} style={{ width: '100%' }} placeholder="输入法币金额" />
                  </Form.Item>
                ) : (
                  <Form.Item name="memoAmount" label="MEMO 数量" rules={[{ required: true }]}> 
                    <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="输入 MEMO 数量" />
                  </Form.Item>
                )}
              </>
            )
          }}
        </Form.Item>

        <Form.Item label="支付方式" name="payType" rules={[{ required: true }]}>
          <Select options={[{ value: 'alipay', label: '支付宝' }, { value: 'wechat', label: '微信支付' }]} />
        </Form.Item>

        {!selectedMaker && (
          <div
            style={{
              background: '#fff7e6',
              border: '1px solid #ffd591',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <Text style={{ fontSize: '13px', color: '#595959' }}>
              ⚠️ 请先从做市商列表中选择一个做市商
            </Text>
          </div>
        )}

        <Button 
          type="primary" 
          htmlType="submit" 
          loading={creating} 
          disabled={!selectedMaker}
          block
          style={{
            height: '56px',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '12px',
            background: selectedMaker && !creating
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : undefined,
            border: 'none',
            boxShadow: selectedMaker && !creating 
              ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
              : undefined,
          }}
        >
          {creating ? '创建中...' : selectedMaker ? `创建订单（做市商 #${selectedMaker.mmId}）` : '请先选择做市商'}
        </Button>
      </Form>
      </div>

      {/* 底部提示文本 */}
      {!order && (
        <div
          style={{
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            padding: '16px',
            borderRadius: '12px',
            marginTop: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <ClockCircleOutlined style={{ color: '#1890ff', fontSize: '16px', marginRight: '8px' }} />
            <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
              温馨提示
            </Text>
          </div>
          <Text style={{ fontSize: '13px', color: '#595959', display: 'block', paddingLeft: '24px' }}>
            支付完成后，请耐心等待做市商确认。确认后，MEMO 将自动到账，请稍等片刻。
          </Text>
        </div>
      )}

      {order && (
        <div
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            marginTop: '16px',
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="订单号">{order.order_id}</Descriptions.Item>
              <Descriptions.Item label="购买MEMO">{order.memo_amount}</Descriptions.Item>
              <Descriptions.Item label="法币金额">{order.fiat_amount}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {paidOk ? <Tag color="green">{status}</Tag> : remainSec > 0 ? <Tag color="blue">{status}</Tag> : <Tag color="red">expired</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="有效期至">{dayjs((order.expired_at || 0) * 1000).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label="剩余时间">{remainSec}s</Descriptions.Item>
            </Descriptions>

            {payUrl && (
              <div style={{ textAlign: 'center' }}>
                {qrImg && <img src={qrImg} alt="支付二维码" style={{ width: 240, height: 240 }} />}
                <div style={{ marginTop: 8 }}>
                  <a href={payUrl} target="_blank" rel="noreferrer">若无法扫码，点击打开支付链接</a>
                </div>
              </div>
            )}

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                disabled={!paidOk} 
                block 
                href={`#/otc/claim?orderId=${encodeURIComponent(order.order_id)}&provider=${encodeURIComponent(providerId)}`}
                style={{
                  height: '56px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  background: paidOk
                    ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                    : undefined,
                  border: 'none',
                  boxShadow: paidOk 
                    ? '0 4px 12px rgba(82, 196, 26, 0.3)' 
                    : undefined,
                }}
              >
                支付已完成，前往领取
              </Button>
            </Space>
          </Space>
        </div>
      )}

      {/* 订单提交后的底部提示 */}
      {order && (
        <div
          style={{
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            padding: '16px',
            borderRadius: '12px',
            marginTop: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <ClockCircleOutlined style={{ color: '#1890ff', fontSize: '16px', marginRight: '8px' }} />
            <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
              等待确认
            </Text>
          </div>
          <Text style={{ fontSize: '13px', color: '#595959', display: 'block', paddingLeft: '24px' }}>
            支付完成后，请耐心等待做市商确认。确认后，MEMO 将自动到账，请稍等片刻。
          </Text>
        </div>
      )}
      </div>
    </div>
  )
}


