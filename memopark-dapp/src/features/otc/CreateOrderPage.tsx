import React from 'react'
import { Card, Form, Input, InputNumber, Button, Radio, Space, Select, Typography, Descriptions, Tag, message, Table, Alert, Spin, Divider, Modal } from 'antd'
import { ArrowLeftOutlined, ShoppingCartOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { blake2AsHex } from '@polkadot/util-crypto'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { MyOrdersCard } from './MyOrdersCard'
import { formatTimestamp } from '../../utils/timeFormat'
import { parseChainUsdt, formatPriceDisplay, usdtToCny, formatCny, calculateTotalUsdt, calculateTotalCny } from '../../utils/currencyConverter'

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
 * 函数级详细中文注释：OTC 挂单接口
 * - 做市商创建的买卖挂单
 * - 包含价格、数量、有效期等信息
 */
interface Listing {
  id: number
  maker: string
  side: number  // 0=Buy, 1=Sell
  base: number  // 基础资产ID
  quote: number  // 计价资产ID
  priceUsdt: number  // USDT单价（链上格式，精度10^6）
  pricingSpreadBps: number  // 价差（基点，保留字段）
  priceMin: string | null  // 最低价格
  priceMax: string | null  // 最高价格
  minQty: string  // 最小数量
  maxQty: string  // 最大数量
  total: string  // 总量
  remaining: string  // 剩余量
  partial: boolean  // 是否允许部分成交
  expireAt: number  // 过期区块高度
  active: boolean  // 是否激活
  makerInfo?: MarketMaker  // 关联的做市商信息
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
   * 函数级中文注释：使用钱包上下文获取当前账户和 API
   */
  const { current: currentAccount, api: walletApi } = useWallet()

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
  const [order, setOrder] = React.useState<any | null>(null)
  const [status, setStatus] = React.useState<string>('pending')
  const [nowSec, setNowSec] = React.useState<number>(Math.floor(Date.now() / 1000))
  const [marketMakers, setMarketMakers] = React.useState<MarketMaker[]>([])
  const [loadingMM, setLoadingMM] = React.useState<boolean>(true)
  const [mmError, setMmError] = React.useState<string>('')
  const [selectedMaker, setSelectedMaker] = React.useState<MarketMaker | null>(null)
  const [listings, setListings] = React.useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = React.useState<boolean>(true)
  const [listingsError, setListingsError] = React.useState<string>('')
  const [selectedListing, setSelectedListing] = React.useState<Listing | null>(null)
  const [currentBlockNumber, setCurrentBlockNumber] = React.useState<number>(0)

  /**
   * 函数级中文注释：加载当前区块高度
   * - 用于判断挂单是否过期
   */
  React.useEffect(() => {
    const loadBlockNumber = async () => {
      try {
        const api = await getApi()
        const header = await api.rpc.chain.getHeader()
        setCurrentBlockNumber(header.number.toNumber())
      } catch (e) {
        console.error('加载区块高度失败:', e)
      }
    }
    loadBlockNumber()
    
    // 每10秒更新一次区块高度
    const interval = setInterval(loadBlockNumber, 10000)
    return () => clearInterval(interval)
  }, [])

  /**
   * 函数级中文注释：加载链上做市商列表
   * - ✅ 修复：从 activeMarketMakers 查询已批准的做市商
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

        // ✅ 修复：查询 activeMarketMakers 而不是 applications
        const entries = await (api.query as any).marketMaker.activeMarketMakers.entries()
        
        // 解析所有活跃做市商
        const makers: MarketMaker[] = []
        for (const [key, value] of entries) {
          if (value.isSome) {
            const app = value.unwrap()
            const appData = app.toJSON() as any
            const mmId = key.args[0].toNumber()
            
            makers.push({
              mmId,
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
        
        // 按费率降序排序（费率高的做市商意味着用户需要支付更多，所以卖出价更高）
        makers.sort((a, b) => b.feeBps - a.feeBps)
        
        setMarketMakers(makers)
        
        console.log('✅ 加载到', makers.length, '个活跃做市商')
      } catch (e: any) {
        console.error('加载做市商列表失败:', e)
        setMmError(e?.message || '加载做市商列表失败')
      } finally {
        setLoadingMM(false)
      }
    }
    
    loadMarketMakers()
  }, [])

  /**
   * 函数级中文注释：加载 OTC 挂单列表
   * - 查询所有活跃的挂单
   * - 关联做市商信息
   * - 过滤已过期的挂单
   * - 按剩余量降序排列
   */
  React.useEffect(() => {
    const loadListings = async () => {
      if (marketMakers.length === 0) return  // 等待做市商加载完成
      
      try {
        setLoadingListings(true)
        setListingsError('')
        
        const api = await getApi()
        
        // 检查 pallet 是否存在
        if (!(api.query as any).otcListing) {
          setListingsError('OTC 挂单模块尚未在链上注册')
          setLoadingListings(false)
          return
        }

        // 查询所有挂单
        const entries = await (api.query as any).otcListing.listings.entries()
        
        // 解析所有活跃挂单
        const allListings: Listing[] = []
        for (const [key, value] of entries) {
          if (value.isSome) {
            const listing = value.unwrap()
            const listingData = listing.toJSON() as any
            const listingId = key.args[0].toNumber()
            
            // 只显示激活且未过期的挂单
            if (listingData.active && listingData.expireAt > currentBlockNumber) {
              // 查找关联的做市商信息
              const makerInfo = marketMakers.find(mm => mm.owner === listingData.maker)
              
              allListings.push({
                id: listingId,
                maker: listingData.maker || '',
                side: listingData.side || 0,
                base: listingData.base || 0,
                quote: listingData.quote || 0,
                priceUsdt: listingData.priceUsdt || 0,  // 新增：USDT单价
                pricingSpreadBps: listingData.pricingSpreadBps || 0,
                priceMin: listingData.priceMin || null,
                priceMax: listingData.priceMax || null,
                minQty: listingData.minQty || '0',
                maxQty: listingData.maxQty || '0',
                total: listingData.total || '0',
                remaining: listingData.remaining || '0',
                partial: listingData.partial || false,
                expireAt: listingData.expireAt || 0,
                active: listingData.active || false,
                makerInfo
              })
            }
          }
        }
        
        // 按剩余量降序排序（剩余量多的在前）
        allListings.sort((a, b) => {
          const aRemaining = BigInt(a.remaining)
          const bRemaining = BigInt(b.remaining)
          return aRemaining > bRemaining ? -1 : aRemaining < bRemaining ? 1 : 0
        })
        
        setListings(allListings)
        
        // 如果只有一个挂单，自动选中
        if (allListings.length === 1) {
          setSelectedListing(allListings[0])
          if (allListings[0].makerInfo) {
            setSelectedMaker(allListings[0].makerInfo)
          }
          message.info('已自动选择唯一的挂单')
        }
        
        console.log('✅ 加载到', allListings.length, '个活跃挂单')
      } catch (e: any) {
        console.error('加载挂单列表失败:', e)
        setListingsError(e?.message || '加载挂单列表失败')
      } finally {
        setLoadingListings(false)
      }
    }
    
    loadListings()
  }, [marketMakers, currentBlockNumber])

  // 倒计时心跳（1s）
  React.useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  // 函数级中文注释：轮询链上订单状态（改为直接查询链端）
  React.useEffect(() => {
    if (!order?.order_id) return
    if (['created', 'paid_confirmed', 'authorized', 'settled', 'expired', 'failed'].includes(status)) return
    
    const pollOrderStatus = async () => {
      try {
        const api = await getApi()
        // 从链上查询订单状态
        const orderEntries = await (api.query as any).otcOrder.orders.entries()
        const myOrder = orderEntries.find(([_, o]: any) => {
          if (!o.isSome) return false
          const data = o.unwrap()
          return data.taker.toString() === currentAccount
        })
        
        if (myOrder && myOrder[1].isSome) {
          const orderData = myOrder[1].unwrap()
          const orderState = orderData.state.toString()
          setStatus(orderState)
        }
      } catch (e) {
        console.error('查询订单状态失败:', e)
      }
    }
    
    const iv = setInterval(pollOrderStatus, 5000)
    return () => clearInterval(iv)
  }, [order?.order_id, status, currentAccount])

  /**
   * 函数级中文注释：创建订单（直接链上交互）
   * - 检查当前账户和选中挂单
   * - 验证订单金额是否满足挂单的最小/最大数量要求
   * - 生成支付和联系方式的承诺哈希
   * - 调用链端 otcOrder.openOrder 创建订单
   * - 等待交易上链并更新状态
   */
  const onCreate = async (values: any) => {
    try {
      setCreating(true)
      
      // ✅ 检查当前账户
      if (!currentAccount) {
        message.warning('请先连接钱包')
        setCreating(false)
        return
      }
      
      // ✅ 检查是否选择了挂单
      if (!selectedListing) {
        message.warning('请先从列表中选择一个挂单')
        setCreating(false)
        return
      }

      // ✅ 计算订单数量（MEMO）
      let qty: bigint
      
      if (values.mode === 'memo' && values.memoAmount) {
        qty = BigInt(Math.floor(Number(values.memoAmount) * 1e12))
      } else if (values.mode === 'fiat' && values.fiatAmount) {
        // 如果用户输入法币金额，需要根据挂单价格计算 MEMO 数量
        // 这里简化处理，实际应该从链上预言机或挂单规则获取价格
        message.warning('暂不支持按法币金额下单，请切换为 MEMO 数量模式')
        setCreating(false)
        return
      } else {
        message.warning('请输入订单数量')
        setCreating(false)
        return
      }

      // ✅ 验证订单数量范围
      const minQty = BigInt(selectedListing.minQty)
      const maxQty = BigInt(selectedListing.maxQty)
      const remaining = BigInt(selectedListing.remaining)
      
      if (qty < minQty) {
        message.warning(`订单数量不能低于最小数量：${(Number(minQty) / 1e12).toFixed(4)} MEMO`)
        setCreating(false)
        return
      }
      
      if (qty > maxQty) {
        message.warning(`订单数量不能超过最大数量：${(Number(maxQty) / 1e12).toFixed(4)} MEMO`)
        setCreating(false)
        return
      }
      
      if (qty > remaining) {
        message.warning(`订单数量不能超过剩余库存：${(Number(remaining) / 1e12).toFixed(4)} MEMO`)
        setCreating(false)
        return
      }
      
      // ✅ 生成支付承诺哈希
      const paymentData = {
        payType: values.payType,
        timestamp: Date.now(),
        account: currentAccount
      }
      const paymentCommit = blake2AsHex(JSON.stringify(paymentData))
      
      // ✅ 生成联系方式承诺哈希（如果有的话）
      const contactData = {
        contact: values.contact || '',
        timestamp: Date.now(),
        account: currentAccount
      }
      const contactCommit = blake2AsHex(JSON.stringify(contactData))
      
      console.log('🔍 创建订单参数:', {
        listing_id: selectedListing.id,
        qty: qty.toString(),
        qty_memo: (Number(qty) / 1e12).toFixed(4) + ' MEMO',
        paymentCommit,
        contactCommit,
        挂单详情: {
          id: selectedListing.id,
          active: selectedListing.active,
          remaining: (Number(BigInt(selectedListing.remaining) / BigInt(1e12))).toFixed(4) + ' MEMO',
          minQty: (Number(BigInt(selectedListing.minQty) / BigInt(1e12))).toFixed(4) + ' MEMO',
          maxQty: (Number(BigInt(selectedListing.maxQty) / BigInt(1e12))).toFixed(4) + ' MEMO',
          partial: selectedListing.partial,
          pricingSpreadBps: selectedListing.pricingSpreadBps,
          maker: selectedListing.maker
        }
      })
      
      console.log('📋 完整挂单对象:', selectedListing)
      
      // ✅ 弹出密码输入框（使用 window.prompt 避免 React 组件问题）
      let password: string | null = null
      for (let i = 0; i < 3; i++) {
        const input = window.prompt('🔐 请输入本地钱包密码用于签名：')
        if (input && input.length >= 8) {
          password = input
          break
        }
        if (input === null) {
          throw new Error('用户取消')
        }
        window.alert('密码至少需要 8 位，请重新输入')
      }
      
      if (!password) {
        throw new Error('密码输入失败，已超过最大重试次数')
      }
      
      // ✅ 调用链端创建订单
      // 使用 openOrderWithProtection 方法，由链端自动计算价格
      // 这样可以避免价格源相关的 BadState 错误
      message.loading({ content: '正在创建订单...', key: 'create-order', duration: 0 })
      
      console.log('📤 调用 openOrderWithProtection 方法...')
      
      const txHash = await signAndSendLocalWithPassword(
        'otcOrder',
        'openOrderWithProtection',
        [
          selectedListing.id,           // listing_id
          qty.toString(),                // qty（由链端根据价格源计算金额）
          paymentCommit,                 // payment_commit
          contactCommit,                 // contact_commit
          null,                          // min_accept_price (可选，滑点保护)
          null                           // max_accept_price (可选，滑点保护)
        ],
        password
      )
      
      console.log('✅ 交易哈希:', txHash)
      
      // 等待一小段时间后查询交易事件
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      try {
        const api = await getApi()
        // 查询交易所在的区块
        const signedBlock = await api.rpc.chain.getBlock()
        const apiAt = await api.at(signedBlock.block.header.hash)
        const allRecords: any = await apiAt.query.system.events()
        
        console.log('🔍 查询交易事件...')
        let orderCreated = false
        let orderId = null
        
        allRecords.forEach((record: any) => {
          const { event } = record
          if (event.section === 'otcOrder') {
            console.log(`📌 事件: ${event.section}.${event.method}`, event.data.toHuman())
            
            if (event.method === 'OrderOpened') {
              orderCreated = true
              orderId = event.data[0]?.toString()
              console.log('✅ 订单创建成功！订单ID:', orderId)
            }
          }
          
          // 检查是否有错误事件
          if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
            console.error('❌ 交易执行失败:', event.data.toHuman())
          }
        })
        
        if (orderCreated && orderId) {
          message.success({ 
            content: `订单创建成功！订单ID: ${orderId}`, 
            key: 'create-order',
            duration: 5
          })
        } else {
          message.warning({ 
            content: `交易已上链，但未检测到订单创建事件。请查看控制台。`, 
            key: 'create-order',
            duration: 5
          })
        }
      } catch (err: any) {
        console.error('查询事件失败:', err)
        message.success({ 
          content: `交易哈希：${txHash.slice(0, 10)}...`, 
          key: 'create-order',
          duration: 3
        })
      }
      
      // ✅ 更新 UI 状态
      setOrder({
        order_id: txHash,
        listing_id: selectedListing.id,
        qty: qty.toString(),
        amount: '0', // 由链端计算，前端不需要知道具体金额
        created_at: Date.now()
      })
      setStatus('created')
      
      // ✅ 跳转到订单详情或我的订单页面
      setTimeout(() => {
        message.info('订单已上链，请联系做市商完成支付和交付')
        // 可以在这里导航到订单详情页
      }, 2000)
      
    } catch (e: any) {
      message.error({ 
        content: e?.message || '创建订单失败', 
        key: 'create-order' 
      })
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
          选择挂单并完成支付
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

      {/* ✅ 我的订单卡片 - 显示当前用户的订单列表 */}
      <div style={{ marginBottom: '16px' }}>
        <MyOrdersCard />
      </div>

      {/* ✅ 挂单列表 - 显示可供用户选择的挂单 */}
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
          📋 可用挂单列表
        </Text>
        {loadingListings ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin tip="加载挂单列表中..." />
          </div>
        ) : listingsError ? (
          <Alert 
            type="info" 
            showIcon 
            message="暂无挂单数据" 
            description={listingsError}
            style={{ marginBottom: 0 }}
          />
        ) : listings.length === 0 ? (
          <Alert 
            type="info" 
            showIcon 
            message="暂无可用挂单" 
            description="当前没有活跃的挂单，请等待做市商创建挂单。"
            style={{ marginBottom: 0 }}
          />
        ) : (
          <Table<Listing>
            dataSource={listings}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedListing ? [selectedListing.id] : [],
              onChange: (_, selectedRows) => {
                const listing = selectedRows[0] || null
                setSelectedListing(listing)
                if (listing && listing.makerInfo) {
                  setSelectedMaker(listing.makerInfo)
                }
              }
            }}
            onRow={(record) => ({
              onClick: () => {
                setSelectedListing(record)
                if (record.makerInfo) {
                  setSelectedMaker(record.makerInfo)
                }
              },
              style: { cursor: 'pointer' }
            })}
            scroll={{ x: true }}
            columns={[
              {
                title: '挂单ID',
                dataIndex: 'id',
                key: 'id',
                width: 80,
                fixed: 'left',
                render: (id: number) => <Tag color="blue">#{id}</Tag>
              },
              {
                title: '类型',
                dataIndex: 'side',
                key: 'side',
                width: 80,
                render: (side: number) => (
                  <Tag color={side === 0 ? 'green' : 'orange'}>
                    {side === 0 ? '买入' : '卖出'}
                  </Tag>
                )
              },
              {
                title: 'USDT单价',
                dataIndex: 'priceUsdt',
                key: 'priceUsdt',
                width: 120,
                sorter: (a, b) => a.priceUsdt - b.priceUsdt,
                render: (priceUsdt: number) => {
                  const usdt = parseChainUsdt(priceUsdt)
                  return (
                    <Tag color="blue" style={{ fontSize: '13px' }}>
                      {usdt.toFixed(4)} USDT
                    </Tag>
                  )
                }
              },
              {
                title: '人民币单价',
                dataIndex: 'priceUsdt',
                key: 'priceCny',
                width: 120,
                render: (priceUsdt: number) => {
                  const usdt = parseChainUsdt(priceUsdt)
                  const cny = usdtToCny(usdt)
                  return (
                    <Tag color="green" style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      ¥{cny.toFixed(2)}
                    </Tag>
                  )
                }
              },
              {
                title: '最小数量',
                dataIndex: 'minQty',
                key: 'minQty',
                width: 120,
                render: (minQty: string) => {
                  try {
                    const amount = Number(BigInt(minQty) / BigInt(1e12))
                    return `${amount.toFixed(4)} MEMO`
                  } catch {
                    return minQty
                  }
                }
              },
              {
                title: '最大数量',
                dataIndex: 'maxQty',
                key: 'maxQty',
                width: 120,
                render: (maxQty: string) => {
                  try {
                    const amount = Number(BigInt(maxQty) / BigInt(1e12))
                    return `${amount.toFixed(4)} MEMO`
                  } catch {
                    return maxQty
                  }
                }
              },
              {
                title: '剩余库存',
                dataIndex: 'remaining',
                key: 'remaining',
                width: 120,
                sorter: (a, b) => {
                  const aVal = BigInt(a.remaining)
                  const bVal = BigInt(b.remaining)
                  return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
                },
                render: (remaining: string) => {
                  try {
                    const amount = Number(BigInt(remaining) / BigInt(1e12))
                    return <Text strong>{amount.toFixed(4)} MEMO</Text>
                  } catch {
                    return remaining
                  }
                }
              },
              {
                title: '部分成交',
                dataIndex: 'partial',
                key: 'partial',
                width: 100,
                render: (partial: boolean) => (
                  <Tag color={partial ? 'green' : 'default'}>
                    {partial ? '允许' : '不允许'}
                  </Tag>
                )
              },
              {
                title: '做市商',
                dataIndex: 'makerInfo',
                key: 'maker',
                width: 150,
                ellipsis: true,
                render: (_: any, record: Listing) => record.makerInfo ? (
                  <Space size="small">
                    <Tag color="blue">#{record.makerInfo.mmId}</Tag>
                    <Typography.Text 
                      ellipsis={{ tooltip: record.maker }} 
                      style={{ maxWidth: 80, fontSize: '12px' }}
                    >
                      {record.maker.slice(0, 6)}...{record.maker.slice(-4)}
                    </Typography.Text>
                  </Space>
                ) : (
                  <Typography.Text 
                    ellipsis={{ tooltip: record.maker }} 
                    style={{ maxWidth: 100, fontSize: '12px' }}
                  >
                    {record.maker.slice(0, 6)}...{record.maker.slice(-4)}
                  </Typography.Text>
                )
              },
              {
                title: '过期区块',
                dataIndex: 'expireAt',
                key: 'expireAt',
                width: 120,
                render: (expireAt: number) => {
                  const remaining = expireAt - currentBlockNumber
                  return (
                    <Space direction="vertical" size={0}>
                      <Text style={{ fontSize: '12px' }}>#{expireAt}</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        剩余 {remaining} 块
                      </Text>
                    </Space>
                  )
                }
              }
            ]}
          />
        )}
      </div>

      {/* ✅ 当前选中的挂单信息 */}
      {selectedListing && (
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
            onClick={() => {
              setSelectedListing(null)
              setSelectedMaker(null)
            }}
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px', marginRight: '8px' }} />
            <Text strong style={{ color: '#52c41a' }}>已选择挂单</Text>
          </div>
          <Descriptions column={2} size="small" style={{ paddingLeft: '24px' }}>
            <Descriptions.Item label="挂单 ID">
              <Tag color="blue">#{selectedListing.id}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="交易类型">
              <Tag color={selectedListing.side === 0 ? 'green' : 'orange'}>
                {selectedListing.side === 0 ? '买入' : '卖出'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="价差">
              <Tag color={selectedListing.pricingSpreadBps <= 50 ? 'green' : selectedListing.pricingSpreadBps <= 100 ? 'orange' : 'red'}>
                {(selectedListing.pricingSpreadBps / 100).toFixed(2)}%
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="部分成交">
              <Tag color={selectedListing.partial ? 'green' : 'default'}>
                {selectedListing.partial ? '允许' : '不允许'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最小数量">
              {(Number(BigInt(selectedListing.minQty) / BigInt(1e12))).toFixed(4)} MEMO
            </Descriptions.Item>
            <Descriptions.Item label="最大数量">
              {(Number(BigInt(selectedListing.maxQty) / BigInt(1e12))).toFixed(4)} MEMO
            </Descriptions.Item>
            <Descriptions.Item label="剩余库存" span={2}>
              <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                {(Number(BigInt(selectedListing.remaining) / BigInt(1e12))).toFixed(4)} MEMO
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="当前时间" span={2}>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {formatTimestamp(Date.now())}
              </Text>
            </Descriptions.Item>
            {selectedListing.makerInfo && (
              <>
                <Descriptions.Item label="做市商 ID">
                  <Tag color="blue">#{selectedListing.makerInfo.mmId}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="做市商费率">
                  <Tag color={selectedListing.makerInfo.feeBps <= 50 ? 'green' : selectedListing.makerInfo.feeBps <= 100 ? 'orange' : 'red'}>
                    {(selectedListing.makerInfo.feeBps / 100).toFixed(2)}%
                  </Tag>
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
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

        <Form.Item 
          label="联系方式" 
          name="contact" 
          rules={[
            { required: true, message: '请输入联系方式' },
            { min: 6, message: '联系方式至少6个字符' }
          ]}
          extra="请输入您的联系方式（微信号/QQ/电话等），此信息将被加密存储"
        >
          <Input.TextArea 
            rows={2} 
            placeholder="例如：微信号 wxid_123456 或 QQ 123456789" 
            maxLength={200}
            showCount
          />
        </Form.Item>

        {!selectedListing && (
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
              ⚠️ 请先从挂单列表中选择一个挂单
            </Text>
          </div>
        )}

        {selectedListing && (
          <Alert
            type="info"
            icon={<ClockCircleOutlined />}
            message="订单时效提示"
            description={
              <Space direction="vertical" size={4}>
                <Text style={{ fontSize: '12px' }}>
                  • 订单创建后将在 <Text strong>24小时</Text> 后自动过期
                </Text>
                <Text style={{ fontSize: '12px', color: '#999' }}>
                  • 预计超时时间: {formatTimestamp(Date.now() + 24 * 60 * 60 * 1000)}
                </Text>
                <Text style={{ fontSize: '12px' }}>
                  • 请在过期前完成支付并等待卖家释放MEMO
                </Text>
              </Space>
            }
            style={{ marginBottom: '16px' }}
          />
        )}

        <Button 
          type="primary" 
          htmlType="submit" 
          loading={creating} 
          disabled={!selectedListing}
          block
          style={{
            height: '56px',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '12px',
            background: selectedListing && !creating
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : undefined,
            border: 'none',
            boxShadow: selectedListing && !creating 
              ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
              : undefined,
          }}
        >
          {creating ? '创建中...' : selectedListing ? `创建订单（挂单 #${selectedListing.id}）` : '请先选择挂单'}
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
                href={`#/otc/claim?orderId=${encodeURIComponent(order.order_id)}`}
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


