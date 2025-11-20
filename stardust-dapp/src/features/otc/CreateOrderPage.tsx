import React from 'react'
import { Card, Form, Input, InputNumber, Button, Radio, Space, Select, Typography, Descriptions, Tag, message, Table, Alert, Spin, Divider, Modal } from 'antd'
import { ArrowLeftOutlined, ShoppingCartOutlined, CheckCircleOutlined, ClockCircleOutlined, DollarOutlined, StarOutlined, UserOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { blake2AsHex } from '@polkadot/util-crypto'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { MyOrdersCard } from './MyOrdersCard'
import MakerContactCard from './MakerContactCard'
import { formatTimestamp } from '../../utils/timeFormat'
import { parseChainUsdt, formatPriceDisplay, usdtToCny, formatCny, calculateTotalUsdt, calculateTotalCny } from '../../utils/currencyConverter'
import CryptoJS from 'crypto-js'  // 🆕 用于EPAY支付签名
import { MakerCreditBadge } from '../../components/MakerCreditBadge'  // 🆕 2025-10-22：做市商信用徽章
import { getOrCreateChatSession } from '../../lib/chat'  // 🆕 2025-10-22：聊天功能集成
import { useMarketMakers } from '../../hooks/market-maker'  // 🆕 2025-10-29 Phase 2：使用共享Hook
import type { MarketMaker } from './types/order.types'  // 🆕 2025-10-29 Phase 2：使用统一类型定义
import { usePriceCalculation } from '../../hooks/trading'  // 🆕 2025-10-30 Phase 2：使用价格计算Hook
import './CreateOrderPage.css'

const { Title, Text } = Typography

/**
 * 函数级详细中文注释：OTC 挂单接口
 * - 做市商创建的买卖挂单
 * - 包含价格、数量、有效期等信息
 * 
 * ⚠️ 注意：此接口已废弃，仅保留用于向后兼容
 * 🆕 2025-10-29 Phase 2：MarketMaker类型已移至types/order.types.ts
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
 * 函数级详细中文注释：OTC 下单页（创建订单，统一青绿色UI风格）
 * - 功能：创建 DUST 购买订单，支持首购和常规订单
 * - 设计：移动端优先，统一青绿色 #5DBAAA 主题风格，与底部导航栏保持一致
 * - 订单流程：选择做市商 → 填写订单信息 → 创建链上订单 → 联系做市商完成交易
 * - 价格保护：基于 pallet-pricing 的市场加权均价进行偏离度检查（±20% 限制）
 * - 集成功能：聊天系统、信用评级、实时价格计算
 */
export default function CreateOrderPage({ onBack }: { onBack?: () => void } = {}) {
  /**
   * 函数级中文注释：使用钱包上下文获取当前账户和 API
   */
  const { currentAccount, api: walletApi } = useWallet()

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

  // 基础状态
  const [form] = Form.useForm()
  const [creating, setCreating] = React.useState(false)
  const [order, setOrder] = React.useState<any | null>(null)
  const [status, setStatus] = React.useState<string>('pending')
  const [nowSec, setNowSec] = React.useState<number>(Math.floor(Date.now() / 1000))

  // 🆕 订单类型选择（首购 vs 常规订单）
  const [orderType, setOrderType] = React.useState<'first_purchase' | 'regular'>('first_purchase')

  // 🆕 2025-10-29 Phase 2：使用共享Hook加载做市商列表
  const { marketMakers, loading: loadingMM, error: mmError } = useMarketMakers()

  const [selectedMaker, setSelectedMaker] = React.useState<MarketMaker | null>(null)
  const [currentBlockNumber, setCurrentBlockNumber] = React.useState<number>(0)

  // 🆕 2025-10-30 Phase 2：使用价格计算Hook替代本地state
  const { basePrice, loadingPrice, calculateDeviation } = usePriceCalculation()

  /**
   * 函数级中文注释：加载基准价格（pallet-pricing 市场加权均价）
   * 
   * ✅ 2025-10-30 Phase 2：已移除，改用usePriceCalculation共享Hook
   * - Hook位置: hooks/trading/usePriceCalculation.ts
   * - 自动加载基准价格
   * - 每30秒自动更新
   * - 提供calculateDeviation函数
   * 
   * 旧代码已删除（26行），减少重复代码
   */
  // React.useEffect(() => { ... }, [])  // ❌ 已删除，使用usePriceCalculation Hook替代

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
   * 
   * ✅ 2025-10-29 Phase 2：已移除，改用useMarketMakers共享Hook
   * - Hook位置: hooks/market-maker/useMarketMakers.ts
   * - 自动加载所有活跃做市商
   * - 自动解码EPAY字段
   * - 自动按sell溢价排序
   * 
   * 旧代码已删除（63行），减少重复代码
   */
  // React.useEffect(() => { ... }, [])  // ❌ 已删除，使用useMarketMakers Hook替代

  /**
   * 🆕 2025-10-20：移除加载 OTC 挂单列表的逻辑
   * - 不再使用挂单机制，订单直接从做市商创建
   */
  // React.useEffect(() => {
  //   const loadListings = async () => {
  //     if (marketMakers.length === 0) return
  //     
  //     try {
  //       setLoadingListings(true)
  //       setListingsError('')
  //       
  //       const api = await getApi()
  //       
  //       if (!(api.query as any).otcListing) {
  //         setListingsError('OTC 挂单模块尚未在链上注册')
  //         setLoadingListings(false)
  //         return
  //       }
  //
  //       const entries = await (api.query as any).otcListing.listings.entries()
  //       
  //       const allListings: Listing[] = []
  //       for (const [key, value] of entries) {
  //         if (value.isSome) {
  //           const listing = value.unwrap()
  //           const listingData = listing.toJSON() as any
  //           const listingId = key.args[0].toNumber()
  //           
  //           if (listingData.active && listingData.expireAt > currentBlockNumber) {
  //             const makerInfo = marketMakers.find(mm => mm.owner === listingData.maker)
  //             
  //             allListings.push({
  //               id: listingId,
  //               maker: listingData.maker || '',
  //               side: listingData.side || 0,
  //               base: listingData.base || 0,
  //               quote: listingData.quote || 0,
  //               priceUsdt: listingData.priceUsdt || 0,
  //               pricingSpreadBps: listingData.pricingSpreadBps || 0,
  //               priceMin: listingData.priceMin || null,
  //               priceMax: listingData.priceMax || null,
  //               minQty: listingData.minQty || '0',
  //               maxQty: listingData.maxQty || '0',
  //               total: listingData.total || '0',
  //               remaining: listingData.remaining || '0',
  //               partial: listingData.partial || false,
  //               expireAt: listingData.expireAt || 0,
  //               active: listingData.active || false,
  //               makerInfo
  //             })
  //           }
  //         }
  //       }
  //       
  //       allListings.sort((a, b) => {
  //         const aRemaining = BigInt(a.remaining)
  //         const bRemaining = BigInt(b.remaining)
  //         return aRemaining > bRemaining ? -1 : aRemaining < bRemaining ? 1 : 0
  //       })
  //       
  //       setListings(allListings)
  //       
  //       if (allListings.length === 1) {
  //         setSelectedListing(allListings[0])
  //         if (allListings[0].makerInfo) {
  //           setSelectedMaker(allListings[0].makerInfo)
  //         }
  //         message.info('已自动选择唯一的挂单')
  //       }
  //       
  //       console.log('✅ 加载到', allListings.length, '个活跃挂单')
  //     } catch (e: any) {
  //       console.error('加载挂单列表失败:', e)
  //       setListingsError(e?.message || '加载挂单列表失败')
  //     } finally {
  //       setLoadingListings(false)
  //     }
  //   }
  //   
  //   loadListings()
  // }, [marketMakers, currentBlockNumber])

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
   * 函数级中文注释：计算价格偏离率和最终价格
   * 
   * ✅ 2025-10-30 Phase 2：简化为调用usePriceCalculation Hook的calculateDeviation函数
   * - Hook位置: hooks/trading/usePriceCalculation.ts
   * - 旧代码删除（23行），减少重复逻辑
   * 
   * @param makerId - 做市商ID
   * @returns 价格偏离计算结果
   */
  const calculatePriceDeviation = (makerId: number): { finalPrice: number; deviationPercent: number; isWarning: boolean; isError: boolean } => {
    const maker = marketMakers.find(m => m.mmId === makerId)
    if (!maker) {
      return { finalPrice: 0, deviationPercent: 0, isWarning: false, isError: false }
    }
    
    // 使用Hook的calculateDeviation函数
    return calculateDeviation(maker.sellPremiumBps)
  }

  /**
   * 函数级中文注释：创建订单（支持首购和常规订单）
   * - 检查当前账户和选中做市商
   * - 根据订单类型验证金额要求（首购固定$10，常规$20-$200）
   * - 生成支付和联系方式的承诺哈希
   * - 调用对应的链端方法：create_first_purchase_order 或 open_order_with_protection
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

      // 检查是否选择了做市商
      if (!selectedMaker) {
        message.warning('请先从列表中选择一个做市商')
        setCreating(false)
        return
      }

      // 根据订单类型计算订单数量（DUST）
      let qty: bigint

      if (orderType === 'first_purchase') {
        // 首购订单：固定$10，根据当前价格计算DUST数量
        if (basePrice === 0) {
          message.warning('价格数据尚未加载完成，请稍后再试')
          setCreating(false)
          return
        }

        const { finalPrice } = calculateDeviation(selectedMaker.sellPremiumBps)
        const usdAmount = 10 // 固定$10
        const dustAmount = (usdAmount * 1_000_000) / finalPrice // 计算需要的DUST数量
        qty = BigInt(Math.floor(dustAmount * 1e12))
      } else {
        // 常规订单：按DUST数量
        if (!values.dustAmount) {
          message.warning('请输入 DUST 数量')
          setCreating(false)
          return
        }
        qty = BigInt(Math.floor(Number(values.dustAmount) * 1e12))
      }

      // 验证订单数量是否满足做市商最小要求
      const qtyBigInt = BigInt(qty)
      const minAmountBigInt = BigInt(selectedMaker.minAmount)

      if (qtyBigInt < minAmountBigInt) {
        const minAmountMemo = (Number(minAmountBigInt) / 1e12).toFixed(4)
        message.warning(`订单数量不能低于做市商最小数量：${minAmountMemo} DUST`)
        setCreating(false)
        return
      }

      // 价格偏离检查
      if (selectedMaker && basePrice > 0) {
        const { deviationPercent, isWarning, isError } = calculateDeviation(selectedMaker.sellPremiumBps)

        // 严格阻止超限订单
        if (isError) {
          message.error({
            content: `价格偏离过大（${deviationPercent.toFixed(1)}%），超过20%限制！链端将拒绝此订单，请选择其他做市商。`,
            duration: 8
          })
          setCreating(false)
          return
        }

        // 警告级别：需要用户确认
        if (isWarning) {
          const { finalPrice } = calculateDeviation(selectedMaker.sellPremiumBps)
          const confirmed = window.confirm(
            `⚠️ 价格偏离警告\n\n` +
            `• 基准价格：${(basePrice / 1_000_000).toFixed(6)} USDT/DUST\n` +
            `• 做市商溢价：${selectedMaker.sellPremiumBps > 0 ? '+' : ''}${(selectedMaker.sellPremiumBps / 100).toFixed(2)}%\n` +
            `• 最终订单价格：${(finalPrice / 1_000_000).toFixed(6)} USDT/DUST\n` +
            `• 价格偏离：${deviationPercent.toFixed(2)}%\n\n` +
            `价格偏离较大（接近20%限制），是否继续创建订单？\n\n` +
            `💡 建议：选择价格偏离更小的做市商可获得更优惠的价格。`
          )

          if (!confirmed) {
            message.info('已取消订单创建')
            setCreating(false)
            return
          }
        }
      }

      // 生成承诺哈希
      const paymentData = {
        payType: values.payType || 'contact_required',
        timestamp: Date.now(),
        account: currentAccount.address
      }
      const paymentCommit = blake2AsHex(JSON.stringify(paymentData))

      const contactData = {
        contact: values.contact || '',
        timestamp: Date.now(),
        account: currentAccount.address
      }
      const contactCommit = blake2AsHex(JSON.stringify(contactData))

      console.log('🔍 创建订单参数:', {
        orderType,
        maker_id: selectedMaker.mmId,
        qty: qty.toString(),
        qty_memo: (Number(qty) / 1e12).toFixed(4) + ' DUST',
        paymentCommit,
        contactCommit,
        做市商详情: {
          mmId: selectedMaker.mmId,
          owner: selectedMaker.owner,
          sellPremiumBps: selectedMaker.sellPremiumBps,
          minAmount: (Number(BigInt(selectedMaker.minAmount) / BigInt(1e12))).toFixed(4) + ' DUST',
          deposit: (Number(BigInt(selectedMaker.deposit) / BigInt(1e12))).toFixed(4) + ' DUST'
        }
      })

      // 弹出密码输入框
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

      // 调用对应的链端方法
      message.loading({ content: '正在创建订单...', key: 'create-order', duration: 0 })

      let txHash: string
      if (orderType === 'first_purchase') {
        console.log('📤 调用 create_first_purchase_order 方法')

        txHash = await signAndSendLocalWithPassword(
          'otcOrder',
          'createFirstPurchaseOrder',
          [
            selectedMaker.mmId,           // maker_id
            contactCommit,                // contact_commit
            paymentCommit,                // payment_commit
            null,                         // min_accept_price (可选)
            null                          // max_accept_price (可选)
          ],
          password
        )
      } else {
        console.log('📤 调用 openOrderWithProtection 方法')

        txHash = await signAndSendLocalWithPassword(
          'otcOrder',
          'openOrderWithProtection',
          [
            selectedMaker.mmId,           // maker_id
            qty.toString(),               // qty
            paymentCommit,                // payment_commit
            contactCommit,                // contact_commit
            null,                         // min_accept_price (可选)
            null                          // max_accept_price (可选)
          ],
          password
        )
      }

      console.log('✅ 交易哈希:', txHash)

      // 等待交易事件
      await new Promise(resolve => setTimeout(resolve, 2000))

      try {
        const api = await getApi()
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

            if (event.method === 'OrderOpened' || event.method === 'FirstPurchaseOrderCreated') {
              orderCreated = true
              orderId = event.data[0]?.toString()
              console.log('✅ 订单创建成功！订单ID:', orderId)
            }
          }

          if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
            console.error('❌ 交易执行失败:', event.data.toHuman())
          }
        })

        if (orderCreated && orderId) {
          message.success({
            content: `${orderType === 'first_purchase' ? '首购' : '常规'}订单创建成功！订单ID: ${orderId}`,
            key: 'create-order',
            duration: 3
          })

          // 订单创建成功后自动打开聊天窗口
          if (selectedMaker && currentAccount) {
            try {
              console.log('💬 订单创建成功，准备打开聊天窗口...')
              const sessionId = await getOrCreateChatSession(
                currentAccount.address,
                selectedMaker.owner
              )

              // 显示提示消息
              Modal.info({
                title: '订单创建成功',
                content: (
                  <div>
                    <p>✅ 订单ID: {orderId}</p>
                    <p>📋 请联系做市商获取完整收款信息</p>
                    <p>💡 点击"打开聊天"按钮与做市商沟通</p>
                  </div>
                ),
                okText: '打开聊天',
                onOk: () => {
                  window.location.hash = `#/chat/${sessionId}`
                },
              })
            } catch (error) {
              console.error('打开聊天窗口失败:', error)
            }
          }
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

      // 更新UI状态
      setOrder({
        order_id: txHash,
        maker_id: selectedMaker.mmId,
        maker_name: selectedMaker.owner,
        qty: qty.toString(),
        amount: '0',
        created_at: Date.now()
      })
      setStatus('created')

      // 跳转提示
      setTimeout(() => {
        message.info(`${orderType === 'first_purchase' ? '首购' : '常规'}订单已上链，请联系做市商完成支付和交付`)
      }, 2000)

    } catch (e: any) {
      console.error('创建订单失败:', e)

      // 优化错误提示
      let errorMsg = '创建订单失败'
      let duration = 5

      const errorStr = e?.message || e?.toString() || ''

      if (errorStr.includes('PriceDeviationTooLarge') || errorStr.includes('价格偏离')) {
        errorMsg = '⛔ 价格偏离过大：订单价格超出允许范围（±20%），请选择其他做市商或等待市场价格调整'
        duration = 10
      } else if (errorStr.includes('InvalidBasePrice') || errorStr.includes('基准价格')) {
        errorMsg = '📊 市场价格暂不可用，请稍后再试（系统正在收集价格数据）'
        duration = 8
      } else if (errorStr.includes('InsufficientBalance') || errorStr.includes('余额不足')) {
        errorMsg = '💰 账户余额不足，请充值后再试'
        duration = 6
      } else if (errorStr.includes('NotFound') || errorStr.includes('不存在')) {
        errorMsg = '❌ 挂单不存在或已失效，请刷新页面重新选择'
        duration = 6
      } else if (errorStr.includes('FirstPurchaseAlreadyExists')) {
        errorMsg = '⚠️ 您已有首购订单，每个账户仅限购买一次首购订单'
        duration = 8
      } else {
        errorMsg = e?.message || '创建订单失败，请稍后重试'
      }

      message.error({
        content: errorMsg,
        key: 'create-order',
        duration
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
    <div className="create-order-page">
      {/* 顶部导航栏（统一青绿色风格） */}
      <div className="order-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToWallet}
          className="back-button"
        >
          返回
        </Button>
        <div className="page-title">DUST 购买</div>
        <div style={{ width: 40 }} />
      </div>

      {/* 主要内容区域 */}
      <div className="order-content">
        {/* 页面标题区域 */}
        <div className="page-title-section">
          <div className="title-icon">
            <ShoppingCartOutlined style={{ fontSize: '32px', color: '#fff' }} />
          </div>
          <div className="page-main-title">购买 DUST</div>
          <div className="page-subtitle">选择订单类型，联系做市商完成交易</div>
          <Button
            type="link"
            onClick={() => window.location.hash = '#/otc/mm-apply'}
            className="become-maker-link"
          >
            申请成为做市商 →
          </Button>
        </div>

        {/* 我的订单卡片 */}
        <div style={{ marginBottom: '16px' }}>
          <MyOrdersCard />
        </div>

        {/* 订单类型选择 */}
        <div className="order-type-card">
          <div className="section-title">
            <InfoCircleOutlined style={{ marginRight: '8px', color: '#5DBAAA' }} />
            选择订单类型
          </div>
          <div className="order-type-options">
            <div
              className={`order-type-option ${orderType === 'first_purchase' ? 'active' : ''}`}
              onClick={() => setOrderType('first_purchase')}
            >
              <StarOutlined className="option-icon" />
              <div className="option-title">首购订单</div>
              <div className="option-desc">固定 $10 USD<br/>新用户专享优惠</div>
            </div>
            <div
              className={`order-type-option ${orderType === 'regular' ? 'active' : ''}`}
              onClick={() => setOrderType('regular')}
            >
              <DollarOutlined className="option-icon" />
              <div className="option-title">常规订单</div>
              <div className="option-desc">$20-$200 USD<br/>灵活金额选择</div>
            </div>
          </div>
          {orderType === 'first_purchase' && (
            <div className="form-hint">
              💡 首购订单固定金额 $10 USD，享受新用户优惠价格，每个账户限购一次
            </div>
          )}
          {orderType === 'regular' && (
            <div className="form-hint">
              💰 常规订单支持 $20-$200 USD 范围，根据市场价格计算 DUST 数量
            </div>
          )}
        </div>

        {/* 做市商选择 */}
        <div className="maker-selection-card">
          <div className="section-title">
            <UserOutlined style={{ marginRight: '8px', color: '#5DBAAA' }} />
            选择做市商
          </div>
          {loadingMM ? (
            <div className="loading-tip">
              <Spin tip="加载做市商列表中..." />
            </div>
          ) : mmError ? (
            <Alert
              type="error"
              showIcon
              message="加载失败"
              description={mmError}
            />
          ) : marketMakers.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              message="暂无可用做市商"
              description="当前没有活跃的做市商，请稍后再试"
            />
          ) : (
            <>
              <Select
                value={selectedMaker?.mmId}
                onChange={(mmId) => {
                  const maker = marketMakers.find(m => m.mmId === mmId)
                  setSelectedMaker(maker || null)
                }}
                placeholder="请选择做市商"
                className="maker-select"
                size="large"
              >
                {marketMakers.map(maker => (
                  <Select.Option key={maker.mmId} value={maker.mmId}>
                    <div className="maker-option">
                      <div className="maker-info">
                        <Tag color="blue">#{maker.mmId}</Tag>
                        <span>{maker.owner.substring(0, 10)}...{maker.owner.substring(maker.owner.length - 6)}</span>
                      </div>
                      <div className="maker-tags">
                        <MakerCreditBadge makerId={maker.mmId} detailed={false} showLink={false} />
                        <Tag color={maker.sellPremiumBps > 0 ? 'orange' : maker.sellPremiumBps < 0 ? 'green' : 'default'}>
                          溢价: {maker.sellPremiumBps > 0 ? '+' : ''}{(maker.sellPremiumBps / 100).toFixed(2)}%
                        </Tag>
                      </div>
                    </div>
                  </Select.Option>
                ))}
              </Select>

              {/* 做市商详细信息 */}
              {selectedMaker && (
                <div className="maker-details">
                  <div className="maker-details-title">
                    📊 做市商信息
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <MakerCreditBadge makerId={selectedMaker.mmId} detailed={true} showLink={true} />
                  </div>

                  {basePrice > 0 && !loadingPrice ? (
                    <>
                      <div className="price-info-grid">
                        <div className="price-item">
                          <div className="price-item-label">基准价格</div>
                          <div className="price-item-value">
                            {(basePrice / 1_000_000).toFixed(6)} USDT/DUST
                          </div>
                        </div>
                        <div className="price-item">
                          <div className="price-item-label">做市商溢价</div>
                          <div className="price-item-value">
                            {selectedMaker.sellPremiumBps > 0 ? '+' : ''}{(selectedMaker.sellPremiumBps / 100).toFixed(2)}%
                          </div>
                        </div>
                        <div className="price-item">
                          <div className="price-item-label">最终订单价格</div>
                          <div className="price-item-value highlight">
                            {(() => {
                              const { finalPrice } = calculateDeviation(selectedMaker.sellPremiumBps)
                              return (finalPrice / 1_000_000).toFixed(6)
                            })()} USDT/DUST
                          </div>
                        </div>
                        <div className="price-item">
                          <div className="price-item-label">最小金额</div>
                          <div className="price-item-value">
                            {(Number(BigInt(selectedMaker.minAmount) / BigInt(1e12))).toFixed(4)} DUST
                          </div>
                        </div>
                      </div>

                      {/* 价格偏离警告 */}
                      {(() => {
                        const { deviationPercent, isWarning, isError } = calculateDeviation(selectedMaker.sellPremiumBps)
                        if (isError) {
                          return (
                            <div className="price-warning">
                              <Alert
                                message="⛔ 价格偏离过大"
                                description={`当前价格偏离基准价 ${deviationPercent.toFixed(2)}%，超过20%限制，无法创建订单`}
                                type="error"
                                showIcon
                              />
                            </div>
                          )
                        }
                        if (isWarning) {
                          return (
                            <div className="price-warning">
                              <Alert
                                message="⚠️ 价格偏离警告"
                                description={`当前价格偏离基准价 ${deviationPercent.toFixed(2)}%，接近20%限制，请谨慎操作`}
                                type="warning"
                                showIcon
                              />
                            </div>
                          )
                        }
                        if (deviationPercent > 0) {
                          return (
                            <div className="price-warning">
                              <Alert
                                message="✅ 价格正常"
                                description={`当前价格偏离基准价 ${deviationPercent.toFixed(2)}%，在合理范围内`}
                                type="success"
                                showIcon
                              />
                            </div>
                          )
                        }
                        return null
                      })()}
                    </>
                  ) : loadingPrice ? (
                    <Alert
                      message="正在加载价格..."
                      type="info"
                      showIcon
                    />
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>


        {/* 订单表单 */}
        <div className="order-form-card">
          <div className="section-title">
            💰 订单信息
          </div>
          <Form
            form={form}
            layout="vertical"
            onFinish={onCreate}
            initialValues={{
              mode: orderType === 'first_purchase' ? 'fiat' : 'memo',
              payType: 'alipay',
              fiatAmount: orderType === 'first_purchase' ? 10 : undefined
            }}
          >
            {/* 订单金额输入 */}
            {orderType === 'first_purchase' ? (
              <Form.Item label="订单金额" name="fiatAmount">
                <div className="amount-input-container">
                  <InputNumber
                    value={10}
                    disabled
                    className="amount-input"
                    controls={false}
                  />
                  <div className="amount-suffix">USD</div>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  首购订单固定金额，享受新用户专享优惠
                </div>
              </Form.Item>
            ) : (
              <Form.Item
                label="DUST 数量"
                name="dustAmount"
                rules={[{ required: true, message: '请输入 DUST 数量' }]}
              >
                <div className="amount-input-container">
                  <InputNumber
                    min={1}
                    precision={0}
                    placeholder="输入 DUST 数量"
                    className="amount-input"
                    controls={false}
                  />
                  <div className="amount-suffix">DUST</div>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  常规订单支持 $20-$200 USD 范围
                </div>
              </Form.Item>
            )}

            <Form.Item
              label="联系方式"
              name="contact"
              rules={[
                { required: true, message: '请输入联系方式' },
                { min: 6, message: '联系方式至少6个字符' }
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="例如：微信号 wxid_123456 或 QQ 123456789"
                maxLength={200}
                showCount
                className="contact-textarea"
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', lineHeight: '1.5' }}>
                💡 请输入您的联系方式（微信号/QQ/电话等），此信息将被加密存储，仅做市商可见
              </div>
            </Form.Item>

            {/* 做市商选择提示 */}
            {!selectedMaker && (
              <div className="form-hint" style={{ background: '#fff7e6', borderColor: '#ffd591' }}>
                ⚠️ 请先选择一个做市商
              </div>
            )}

            {/* 订单时效提示 */}
            {selectedMaker && (
              <div className="form-hint">
                ⏱️ 订单创建后将在 24小时 后自动过期，请在过期前完成支付并等待做市商释放 DUST
              </div>
            )}

            <Button
              type="primary"
              htmlType="submit"
              loading={creating}
              disabled={!selectedMaker}
              block
              className="submit-button"
              icon={<CheckCircleOutlined />}
            >
              {creating ? '创建中...' : selectedMaker ?
                (orderType === 'first_purchase' ? '创建首购订单' : `创建订单（做市商 #${selectedMaker.mmId}）`) :
                '请先选择做市商'
              }
            </Button>
          </Form>
        </div>

        {/* 🆕 联系做市商交易卡片（仅在选中做市商后显示） */}
        {selectedMaker && (
          <MakerContactCard
            selectedMaker={selectedMaker}
            orderStatus={order ? 'created' : 'pending'}
            orderId={order?.order_id}
            showFullInfo={true}
          />
        )}

        {/* 温馨提示 */}
        {!order && (
          <div className="tips-card">
            <div className="tips-header">
              <InfoCircleOutlined style={{ fontSize: '16px', color: '#5DBAAA' }} />
              <div className="tips-title">温馨提示</div>
            </div>
            <div className="tips-content">
              <div style={{ marginBottom: '8px' }}>
                🔗 <strong>交易流程：</strong>创建订单 → 联系做市商 → 确认收款信息 → 完成支付 → 做市商释放 DUST
              </div>
              <div style={{ marginBottom: '8px' }}>
                💬 <strong>沟通建议：</strong>创建订单后系统会自动打开聊天窗口，建议通过聊天功能与做市商沟通
              </div>
              <div>
                🛡️ <strong>安全提醒：</strong>仅通过官方聊天功能交流，切勿私下转账或透露钱包私钥
              </div>
            </div>
          </div>
        )}

        {/* 订单详情（创建成功后显示） */}
        {order && (
          <>
            {/* 🆕 订单创建成功后显示联系做市商卡片 */}
            {selectedMaker && (
              <MakerContactCard
                selectedMaker={selectedMaker}
                orderStatus="created"
                orderId={order.order_id}
                showFullInfo={true}
              />
            )}

            <div className="order-details-card">
            <div className={status === 'created' ? 'order-status-pending' : 'order-status-success'}>
              <CheckCircleOutlined style={{ fontSize: '20px', marginRight: '8px', color: status === 'created' ? '#1890ff' : '#52c41a' }} />
              <span style={{ fontSize: '16px', fontWeight: '600' }}>
                {status === 'created' ? '订单创建成功' : '订单已完成'}
              </span>
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="订单号">{order.order_id}</Descriptions.Item>
              <Descriptions.Item label="做市商">#{order.maker_id} - {order.maker_name?.substring(0, 20)}...</Descriptions.Item>
              <Descriptions.Item label="DUST数量">{(Number(order.qty) / 1e12).toFixed(4)} DUST</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={status === 'created' ? 'blue' : 'green'}>{status}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <div className="tips-card" style={{ marginTop: '16px' }}>
              <div className="tips-header">
                <ClockCircleOutlined style={{ fontSize: '16px', color: '#5DBAAA' }} />
                <div className="tips-title">下一步</div>
              </div>
              <div className="tips-content">
                订单已成功提交到区块链。请通过聊天功能联系做市商获取收款信息，完成支付后做市商会释放 DUST 到您的账户。
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * 🆕 2025-10-20：EPAY支付相关辅助函数
 */

/**
 * 解码EPAY字段（处理十六进制字符串）
 * 
 * ⚠️ 注意：此函数已废弃，请使用utils/paymentUtils.ts中的版本
 * 🆕 2025-10-29 Phase 2：保留此定义以避免破坏现有代码，后续清理时可删除
 */
const decodeEpayField = (field: any): string => {
  if (!field) return ''
  if (typeof field === 'string' && !field.startsWith('0x')) {
    return field
  }
  if (typeof field === 'string' && field.startsWith('0x')) {
    try {
      const hex = field.slice(2)
      const byteArray: number[] = []
      for (let i = 0; i < hex.length; i += 2) {
        byteArray.push(parseInt(hex.substr(i, 2), 16))
      }
      return new TextDecoder().decode(new Uint8Array(byteArray))
    } catch (e) {
      console.warn('解码EPAY字段失败:', field, e)
      return ''
    }
  }
  return ''
}

/**
 * 生成唯一的商户订单号
 * 格式：MM + 年月日时分秒 + 随机数
 */
const generateMerchantOrderNo = (): string => {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
                   (now.getMonth() + 1).toString().padStart(2, '0') +
                   now.getDate().toString().padStart(2, '0') +
                   now.getHours().toString().padStart(2, '0') +
                   now.getMinutes().toString().padStart(2, '0') +
                   now.getSeconds().toString().padStart(2, '0')

  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `MM${timestamp}${random}`
}

/**
 * 生成EPAY支付签名（MD5）
 */
const generatePaymentSignature = (params: any, secretKey: string): string => {
  // 1. 过滤掉不需要签名的字段
  const { sign, ...paramsToSign } = params

  // 2. 按键名升序排列
  const sortedKeys = Object.keys(paramsToSign).sort()

  // 3. 构造签名字符串
  let signString = ''
  sortedKeys.forEach(key => {
    if (paramsToSign[key] !== undefined && paramsToSign[key] !== null && paramsToSign[key] !== '') {
      signString += `${key}=${paramsToSign[key]}&`
    }
  })

  // 4. 添加商户密钥
  signString += `key=${secretKey}`

  // 5. 计算MD5哈希（小写）
  const hash = CryptoJS.MD5(signString).toString().toLowerCase()

  console.log('🔐 支付签名:', {
    signString: signString,
    hash: hash,
    secretKey: secretKey.substring(0, 4) + '***' // 只显示前4位
  })

  return hash
}

/**
 * 获取客户端IP地址
 */
const getClientIP = async (): Promise<string> => {
  try {
    // 尝试通过第三方服务获取IP
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip || '127.0.0.1'
  } catch (error) {
    console.warn('获取IP地址失败，使用默认值:', error)
    return '127.0.0.1'
  }
}

/**
 * 检测设备类型
 */
const detectDeviceType = (): string => {
  const userAgent = navigator.userAgent.toLowerCase()
  if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
    return 'mobile'
  }
  return 'pc'
}

// ========== 以下废弃函数已删除（引用未定义变量且未被调用） ==========
// - calculateOrderAmount()
// - calculateOrderPrice()
// - getBasePrice()
// - initiatePaymentRequest()
// - showManualPaymentInfo()

