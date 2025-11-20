import React from 'react'
import { Card, Form, Input, InputNumber, Button, message, Alert, Spin, Descriptions, Tag, Space, Typography, Divider, Modal, Tabs } from 'antd'
import { SettingOutlined, SaveOutlined, ReloadOutlined, ArrowLeftOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { ApiPromise } from '@polkadot/api'
import { useCurrentMakerInfo, type MarketMakerInfo } from '../../hooks/market-maker'  // 🆕 2025-10-30 Phase 2：使用共享Hook

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

/**
 * 函数级详细中文注释：做市商桥接服务配置管理页面
 * 设计目标：
 * 1）提供桥接服务配置管理（TRON地址、最大兑换额、手续费率）
 * 2）支持重新启用已禁用的桥接服务
 * 3）提供业务配置管理（资料CID、OTC费率、最小下单额）
 * 4）统一的配置管理入口，提升用户体验
 */

/**
 * 函数级详细中文注释：做市商信息数据结构
 * 
 * ✅ 2025-10-30 Phase 2：此接口已移至hooks/market-maker/useCurrentMakerInfo.ts
 * 现在从共享Hook导入，避免重复定义
 */
// interface MarketMakerInfo { ... }  // ❌ 已删除，使用hooks/market-maker导出的版本

/**
 * 函数级详细中文注释：桥接服务配置数据结构
 */
interface BridgeServiceConfig {
  makerAccount: string
  tronAddress: string
  maxSwapAmount: number
  feeRateBps: number
  enabled: boolean
  totalSwaps: number
  totalVolume: string
  successCount: number
  avgTimeSeconds: number
  deposit: string
}

/**
 * 函数级详细中文注释：解析字节数组为字符串
 * 
 * ✅ 2025-10-30 Phase 2：此函数已废弃
 * - 已移至utils/paymentUtils.ts（decodeEpayField）
 * - 删除重复代码
 * - Hook自动调用decodeEpayField解析字段
 */
// function bytesToString(bytes: any): string { ... }  // ❌ 已删除

export default function MakerBridgeConfigPage() {
  const [bridgeForm] = Form.useForm()
  const [infoForm] = Form.useForm()
  const [loading, setLoading] = React.useState<boolean>(false)
  const [loadingBridge, setLoadingBridge] = React.useState<boolean>(false)
  const [api, setApi] = React.useState<ApiPromise | null>(null)
  const [bridgeService, setBridgeService] = React.useState<BridgeServiceConfig | null>(null)
  const [localError, setLocalError] = React.useState<string>('')  // 本地错误信息（用于操作失败时显示）
  
  // 🆕 2025-10-30 Phase 2：使用共享Hook加载当前账户的做市商信息
  const { 
    mmId, 
    makerInfo: marketMakerInfo, 
    loading: loadingMaker, 
    error: hookError,  // Hook的错误信息（用于加载做市商信息失败时显示）
    reload: reloadMakerInfo 
  } = useCurrentMakerInfo()
  
  // 合并加载状态和错误信息
  const loadingData = loadingMaker || loadingBridge
  const error = localError || hookError

  /**
   * 函数级详细中文注释：初始化 API 连接
   */
  React.useEffect(() => {
    const initApi = async () => {
      try {
        const apiInstance = await getApi()
        setApi(apiInstance)
      } catch (e: any) {
        setLocalError('API 连接失败：' + (e?.message || ''))
      }
    }
    initApi()
  }, [])

  /**
   * 函数级详细中文注释：填充业务配置表单
   * 🆕 2025-10-30 Phase 2：当做市商信息加载完成后自动填充表单
   */
  React.useEffect(() => {
    if (marketMakerInfo) {
      infoForm.setFieldsValue({
        tron_address: marketMakerInfo.tronAddress,
        public_cid: marketMakerInfo.publicCid,
        private_cid: marketMakerInfo.privateCid,
        buy_premium_bps: marketMakerInfo.buyPremiumBps,
        sell_premium_bps: marketMakerInfo.sellPremiumBps,
        min_amount: Number(BigInt(marketMakerInfo.minAmount) / BigInt(1e12)),
      })
      console.log('[桥接配置] 做市商信息已填充表单:', marketMakerInfo)
    }
  }, [marketMakerInfo, infoForm])

  /**
   * 函数级详细中文注释：加载桥接服务配置
   * 
   * ✅ 2025-10-30 Phase 2：简化此函数，仅加载桥接服务配置
   * - 做市商信息加载已移至useCurrentMakerInfo Hook
   * - 旧代码删除（~100行），减少重复代码
   */
  const loadBridgeService = React.useCallback(async () => {
    if (!api || !mmId) return
    
    try {
      setLoadingBridge(true)
      setLocalError('')
      
      // 查询桥接服务配置
      const bridgeData = await (api.query as any).trading.bridgeServices(mmId)
      
      if (bridgeData.isSome) {
        const bridge = bridgeData.unwrap().toJSON() as any
        
        // 使用decodeEpayField解析TRON地址（保持一致性）
        // 注意：bridgeService的tronAddress可能需要单独解析
        let tronAddr = ''
        if (bridge.tronAddress) {
          if (typeof bridge.tronAddress === 'string' && !bridge.tronAddress.startsWith('0x')) {
            tronAddr = bridge.tronAddress
          } else if (Array.isArray(bridge.tronAddress)) {
            tronAddr = new TextDecoder().decode(new Uint8Array(bridge.tronAddress))
          } else if (typeof bridge.tronAddress === 'string' && bridge.tronAddress.startsWith('0x')) {
            const hex = bridge.tronAddress.slice(2)
            const byteArray: number[] = []
            for (let i = 0; i < hex.length; i += 2) {
              byteArray.push(parseInt(hex.substr(i, 2), 16))
            }
            tronAddr = new TextDecoder().decode(new Uint8Array(byteArray))
          }
        }
        
        const serviceConfig: BridgeServiceConfig = {
          makerAccount: bridge.makerAccount || '',
          tronAddress: tronAddr,
          maxSwapAmount: bridge.maxSwapAmount || 0,
          feeRateBps: bridge.feeRateBps || 0,
          enabled: bridge.enabled || false,
          totalSwaps: bridge.totalSwaps || 0,
          totalVolume: bridge.totalVolume || '0',
          successCount: bridge.successCount || 0,
          avgTimeSeconds: bridge.avgTimeSeconds || 0,
          deposit: bridge.deposit || '0',
        }
        
        setBridgeService(serviceConfig)
        
        // 填充桥接服务配置表单
        bridgeForm.setFieldsValue({
          tron_address: serviceConfig.tronAddress,
          max_swap_amount: serviceConfig.maxSwapAmount / 1e6, // 转换为 USDT
          fee_rate_bps: serviceConfig.feeRateBps,
        })
        
        console.log('[桥接配置] 桥接服务配置已加载:', serviceConfig)
      } else {
        setBridgeService(null)
        console.log('[桥接配置] 桥接服务未启用')
      }
      
    } catch (e: any) {
      console.error('[桥接配置] 加载桥接服务失败:', e)
      setLocalError('加载桥接服务失败：' + (e?.message || '未知错误'))
    } finally {
      setLoadingBridge(false)
    }
  }, [api, mmId, bridgeForm])

  /**
   * 函数级详细中文注释：当做市商ID可用后，加载桥接服务配置
   */
  React.useEffect(() => {
    if (mmId) {
      loadBridgeService()
    }
  }, [mmId, loadBridgeService])

  /**
   * 函数级详细中文注释：重新加载所有数据（做市商信息 + 桥接服务配置）
   * 🆕 2025-10-30 Phase 2：统一的reload函数，替代原来的loadMakerData
   */
  const reloadAll = React.useCallback(async () => {
    await Promise.all([
      reloadMakerInfo(),  // Hook提供的reload函数
      loadBridgeService()  // 桥接服务配置reload
    ])
  }, [reloadMakerInfo, loadBridgeService])

  /**
   * 函数级详细中文注释：更新桥接服务配置
   */
  const onUpdateBridgeService = async (values: any) => {
    if (!api || !marketMakerInfo) {
      message.error('API 未初始化或做市商信息未加载')
      return
    }

    if (!bridgeService) {
      message.error('桥接服务未启用，请先启用桥接服务')
      return
    }

    setLocalError('')
    setLoading(true)

    try {
      // 构造参数（Option 类型）
      let tronAddressParam = null
      let maxSwapAmountParam = null
      let feeRateBpsParam = null

      // TRON 地址（如果提供且与当前值不同）
      if (values.tron_address && values.tron_address.trim() !== '' && values.tron_address !== bridgeService.tronAddress) {
        tronAddressParam = Array.from(new TextEncoder().encode(values.tron_address.trim()))
      }

      // 最大兑换额（如果提供且与当前值不同）
      if (values.max_swap_amount !== undefined && values.max_swap_amount !== null) {
        const maxSwapAmountUsdt = Number(values.max_swap_amount)
        const maxSwapAmountValue = Math.floor(maxSwapAmountUsdt * 1e6) // 转换为精度 10^6
        if (maxSwapAmountValue !== bridgeService.maxSwapAmount) {
          maxSwapAmountParam = maxSwapAmountValue
        }
      }

      // 手续费率（如果提供且与当前值不同）
      if (values.fee_rate_bps !== undefined && values.fee_rate_bps !== null && values.fee_rate_bps !== '' && values.fee_rate_bps !== bridgeService.feeRateBps) {
        feeRateBpsParam = Number(values.fee_rate_bps)
      }

      // 检查是否有实际变化
      if (!tronAddressParam && !maxSwapAmountParam && !feeRateBpsParam) {
        message.warning('没有检测到配置变更')
        setLoading(false)
        return
      }

      message.loading({ content: '正在签名并更新桥接服务配置...', key: 'update', duration: 0 })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'updateBridgeService', [
        marketMakerInfo.mmId,
        tronAddressParam,
        maxSwapAmountParam,
        feeRateBpsParam
      ])

      message.success({
        content: `桥接服务配置更新成功！交易哈希: ${hash}`,
        key: 'update',
        duration: 5
      })

      // 等待区块确认后重新加载信息
      await new Promise(resolve => setTimeout(resolve, 3000))
      await reloadAll()

    } catch (e: any) {
      console.error('更新桥接服务配置失败:', e)
      message.error({ content: '更新桥接服务配置失败：' + (e?.message || '未知错误'), key: 'update', duration: 5 })
      setLocalError(e?.message || '更新桥接服务配置失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：重新启用桥接服务
   */
  const onReEnableBridgeService = async () => {
    if (!api || !marketMakerInfo) {
      message.error('API 未初始化或做市商信息未加载')
      return
    }

    if (!bridgeService) {
      message.error('桥接服务不存在，请先启用桥接服务')
      return
    }

    if (bridgeService.enabled) {
      message.warning('桥接服务已启用，无需重新启用')
      return
    }

    Modal.confirm({
      title: '确认重新启用桥接服务？',
      content: '重新启用后，用户将可以选择您进行桥接服务。',
      okText: '确认启用',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          message.loading({ content: '正在签名并重新启用桥接服务...', key: 'enable', duration: 0 })

          const hash = await signAndSendLocalFromKeystore('marketMaker', 'reEnableBridgeService', [
            marketMakerInfo.mmId
          ])

          message.success({
            content: `桥接服务重新启用成功！交易哈希: ${hash}`,
            key: 'enable',
            duration: 5
          })

          await new Promise(resolve => setTimeout(resolve, 3000))
          await reloadAll()

        } catch (e: any) {
          console.error('重新启用桥接服务失败:', e)
          message.error({ content: '重新启用桥接服务失败：' + (e?.message || '未知错误'), key: 'enable', duration: 5 })
        } finally {
          setLoading(false)
        }
      }
    })
  }

  /**
   * 函数级详细中文注释：禁用桥接服务
   */
  const onDisableBridgeService = async () => {
    if (!api || !marketMakerInfo) {
      message.error('API 未初始化或做市商信息未加载')
      return
    }

    if (!bridgeService) {
      message.error('桥接服务不存在')
      return
    }

    if (!bridgeService.enabled) {
      message.warning('桥接服务已禁用')
      return
    }

    Modal.confirm({
      title: '确认禁用桥接服务？',
      content: '禁用后，用户将无法选择您进行桥接服务。已有的订单不受影响，但不会接收新订单。',
      okText: '确认禁用',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          message.loading({ content: '正在签名并禁用桥接服务...', key: 'disable', duration: 0 })

          const hash = await signAndSendLocalFromKeystore('marketMaker', 'disableBridgeService', [
            marketMakerInfo.mmId
          ])

          message.success({
            content: `桥接服务已禁用！交易哈希: ${hash}`,
            key: 'disable',
            duration: 5
          })

          await new Promise(resolve => setTimeout(resolve, 3000))
          await reloadAll()

        } catch (e: any) {
          console.error('禁用桥接服务失败:', e)
          message.error({ content: '禁用桥接服务失败：' + (e?.message || '未知错误'), key: 'disable', duration: 5 })
        } finally {
          setLoading(false)
        }
      }
    })
  }

  /**
   * 函数级详细中文注释：更新做市商业务配置
   */
  const onUpdateMakerInfo = async (values: any) => {
    if (!api || !marketMakerInfo) {
      message.error('API 未初始化或做市商信息未加载')
      return
    }

    setLocalError('')
    setLoading(true)

    try {
      // 构造参数（Option 类型）
      let publicCidParam = null
      let privateCidParam = null
      let buyPremiumBpsParam = null  // 🆕 2025-10-19：Buy溢价参数
      let sellPremiumBpsParam = null // 🆕 2025-10-19：Sell溢价参数
      let minAmountParam = null
      let tronAddressParam = null     // 🆕 2025-10-19：TRON地址参数

      // 🆕 2025-10-19：TRON地址
      if (values.tron_address && values.tron_address.trim() !== '' && values.tron_address.trim() !== marketMakerInfo.tronAddress) {
        const tronAddr = values.tron_address.trim()
        // 验证TRON地址格式
        if (tronAddr.length !== 34 || !tronAddr.startsWith('T')) {
          message.error('TRON地址格式无效（必须34字符，以T开头）')
          setLoading(false)
          return
        }
        tronAddressParam = Array.from(new TextEncoder().encode(tronAddr))
      }

      // 公开资料 CID
      if (values.public_cid && values.public_cid.trim() !== '' && values.public_cid !== marketMakerInfo.publicCid) {
        publicCidParam = Array.from(new TextEncoder().encode(values.public_cid.trim()))
      }

      // 私密资料 CID
      if (values.private_cid && values.private_cid.trim() !== '' && values.private_cid !== marketMakerInfo.privateCid) {
        privateCidParam = Array.from(new TextEncoder().encode(values.private_cid.trim()))
      }


      // 🆕 2025-10-19：Buy溢价
      if (values.buy_premium_bps !== undefined && values.buy_premium_bps !== null && values.buy_premium_bps !== '' && values.buy_premium_bps !== marketMakerInfo.buyPremiumBps) {
        const buyPremium = Number(values.buy_premium_bps)
        if (buyPremium < -500 || buyPremium > 500) {
          message.error('Buy溢价超出范围（-500 ~ 500 bps）')
          setLoading(false)
          return
        }
        buyPremiumBpsParam = buyPremium
      }

      // 🆕 2025-10-19：Sell溢价
      if (values.sell_premium_bps !== undefined && values.sell_premium_bps !== null && values.sell_premium_bps !== '' && values.sell_premium_bps !== marketMakerInfo.sellPremiumBps) {
        const sellPremium = Number(values.sell_premium_bps)
        if (sellPremium < -500 || sellPremium > 500) {
          message.error('Sell溢价超出范围（-500 ~ 500 bps）')
          setLoading(false)
          return
        }
        sellPremiumBpsParam = sellPremium
      }

      // 最小下单额
      if (values.min_amount !== undefined && values.min_amount !== null && values.min_amount !== '') {
        const minAmountMemo = BigInt(Math.floor(values.min_amount * 1e12))
        if (minAmountMemo.toString() !== marketMakerInfo.minAmount) {
          minAmountParam = minAmountMemo.toString()
        }
      }

      // 检查是否有实际变化
      if (!publicCidParam && !privateCidParam && !buyPremiumBpsParam && !sellPremiumBpsParam && !minAmountParam && !tronAddressParam) {
        message.warning('没有检测到配置变更')
        setLoading(false)
        return
      }

      message.loading({ content: '正在签名并更新业务配置...', key: 'update', duration: 0 })

      // 签名并发送交易（🆕 2025-10-19：添加溢价参数和TRON地址参数）
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'updateMakerInfo', [
        marketMakerInfo.        mmId,
        publicCidParam,
        privateCidParam,
        buyPremiumBpsParam,   // 🆕 2025-10-19：Buy溢价
        sellPremiumBpsParam,  // 🆕 2025-10-19：Sell溢价
        minAmountParam,
        tronAddressParam      // 🆕 2025-10-19：TRON地址
      ])

      message.success({
        content: `业务配置更新成功！交易哈希: ${hash}`,
        key: 'update',
        duration: 5
      })

      // 等待区块确认后重新加载信息
      await new Promise(resolve => setTimeout(resolve, 3000))
      await reloadAll()

    } catch (e: any) {
      console.error('更新业务配置失败:', e)
      message.error({ content: '更新业务配置失败：' + (e?.message || '未知错误'), key: 'update', duration: 5 })
      setLocalError(e?.message || '更新业务配置失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 🆕 2025-10-19：更新做市商业务方向
   */
  const onUpdateDirection = async (newDirection: number) => {
    if (!api || !marketMakerInfo) {
      message.error('API 未初始化或做市商信息未加载')
      return
    }

    if (newDirection === marketMakerInfo.direction) {
      message.warning('新方向与当前方向相同，无需更新')
      return
    }

    setLocalError('')
    setLoading(true)

    try {
      const directionNames = ['仅买入（Bridge）', '仅卖出（OTC）', '双向（OTC + Bridge）']
      
      message.loading({ 
        content: `正在更新业务方向为：${directionNames[newDirection]}...`, 
        key: 'direction', 
        duration: 0 
      })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'updateDirection', [
        marketMakerInfo.mmId,
        newDirection
      ])

      message.success({
        content: `业务方向更新成功！新方向：${directionNames[newDirection]}。交易哈希: ${hash}`,
        key: 'direction',
        duration: 5
      })

      // 等待区块确认后重新加载信息
      await new Promise(resolve => setTimeout(resolve, 3000))
      await reloadAll()

    } catch (e: any) {
      console.error('更新业务方向失败:', e)
      message.error({ content: '更新业务方向失败：' + (e?.message || '未知错误'), key: 'direction', duration: 5 })
      setLocalError(e?.message || '更新业务方向失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：返回到做市商列表
   */
  const handleBack = () => {
    window.location.hash = '#/otc/create-mm'
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
        padding: '60px 20px 20px',
      }}
    >
      {/* 返回按钮 */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px',
        zIndex: 10,
      }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          style={{ 
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          返回
        </Button>
      </div>

      {/* 主内容区域 */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Title level={4}>
            <SettingOutlined /> 做市商配置管理中心
          </Title>

          {!api && (
            <Alert type="info" showIcon message="正在连接链上节点..." style={{ marginBottom: 12 }} />
          )}

          {error && (
            <Alert 
              type="error" 
              showIcon 
              message={error} 
              style={{ marginBottom: 12 }} 
              closable 
              onClose={() => setLocalError('')} 
            />
          )}

          {loadingData && (
            <Spin tip="正在加载做市商信息...">
              <div style={{ minHeight: 400 }} />
            </Spin>
          )}

          {!loadingData && marketMakerInfo && (
            <>
              {/* 做市商基础信息 */}
              <Card 
                title={
                  <Space>
                    <Text strong>做市商信息</Text>
                    <Tag color="green">{marketMakerInfo.status}</Tag>
                    <Tag color="blue">做市商 ID: {marketMakerInfo.mmId}</Tag>
                  </Space>
                }
                size="small" 
                style={{ marginBottom: 16 }}
                extra={
                  <Button 
                    type="text" 
                    icon={<ReloadOutlined />} 
                    onClick={reloadAll}
                    loading={loadingData}
                    size="small"
                  >
                    刷新
                  </Button>
                }
              >
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="账户地址" span={2}>
                    <Text copyable={{ text: marketMakerInfo.owner }} ellipsis style={{ maxWidth: 480 }}>
                      {marketMakerInfo.owner}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="业务方向">
                    {marketMakerInfo.direction === 0 && (
                      <Space>
                        <Tag color="green">🟢 仅买入</Tag>
                        <Text type="secondary">仅Bridge（购买MEMO，支付USDT）</Text>
                      </Space>
                    )}
                    {marketMakerInfo.direction === 1 && (
                      <Space>
                        <Tag color="red">🔴 仅卖出</Tag>
                        <Text type="secondary">仅OTC（出售MEMO，收取USDT）</Text>
                      </Space>
                    )}
                    {marketMakerInfo.direction === 2 && (
                      <Space>
                        <Tag color="orange">🟡 双向</Tag>
                        <Text type="secondary">OTC + Bridge</Text>
                      </Space>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="操作">
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={() => {
                        Modal.confirm({
                          title: '更新业务方向',
                          content: (
                            <div style={{ marginTop: 16 }}>
                              <p>选择新的业务方向：</p>
                              <div id="direction-selector" />
                            </div>
                          ),
                          onOk: async () => {
                            const selectedDirection = (window as any).__selectedDirection
                            if (selectedDirection !== undefined && selectedDirection !== marketMakerInfo.direction) {
                              await onUpdateDirection(selectedDirection)
                            }
                          },
                          okText: '确认更新',
                          cancelText: '取消',
                        })
                        
                        // 动态插入方向选择器
                        setTimeout(() => {
                          const container = document.getElementById('direction-selector')
                          if (container) {
                            const directionNames = ['仅买入（Bridge）', '仅卖出（OTC）', '双向（OTC + Bridge）']
                            const directionColors = ['green', 'red', 'orange']
                            
                            container.innerHTML = directionNames.map((name, index) => `
                              <div style="margin: 8px 0; padding: 8px; border: 1px solid #d9d9d9; border-radius: 4px; cursor: pointer;" 
                                   onclick="(window).__selectedDirection = ${index}; document.querySelectorAll('.direction-option').forEach(el => el.style.background = ''); this.style.background = '#e6f7ff';"
                                   class="direction-option ${index === marketMakerInfo.direction ? 'selected' : ''}">
                                <span style="display: inline-block; padding: 2px 8px; background: ${directionColors[index]}; color: white; border-radius: 4px; margin-right: 8px;">${name}</span>
                              </div>
                            `).join('')
                            
                            // 设置默认选中
                            ;(window as any).__selectedDirection = marketMakerInfo.direction
                          }
                        }, 100)
                      }}
                    >
                      修改方向
                    </Button>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Tabs defaultActiveKey="bridge">
                {/* 桥接服务配置 */}
                <TabPane tab="桥接服务配置" key="bridge">
                  {bridgeService ? (
                    <>
                      {/* 当前桥接服务状态 */}
                      <Card 
                        title="当前桥接服务状态" 
                        size="small" 
                        style={{ marginBottom: 16 }}
                      >
                        <Descriptions column={2} size="small" bordered>
                          <Descriptions.Item label="服务状态">
                            {bridgeService.enabled ? (
                              <Tag color="success" icon={<CheckCircleOutlined />}>已启用</Tag>
                            ) : (
                              <Tag color="error" icon={<StopOutlined />}>已禁用</Tag>
                            )}
                          </Descriptions.Item>
                          <Descriptions.Item label="做市商账户">
                            <Text copyable ellipsis style={{ maxWidth: 300 }}>
                              {bridgeService.makerAccount}
                            </Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="TRON 地址">
                            <Text copyable>{bridgeService.tronAddress}</Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="最大兑换额">
                            {(bridgeService.maxSwapAmount / 1e6).toFixed(2)} USDT
                          </Descriptions.Item>
                          <Descriptions.Item label="手续费率">
                            {(bridgeService.feeRateBps / 100).toFixed(2)}%
                          </Descriptions.Item>
                          <Descriptions.Item label="累计兑换笔数">
                            {bridgeService.totalSwaps}
                          </Descriptions.Item>
                          <Descriptions.Item label="累计交易量">
                            {(BigInt(bridgeService.totalVolume) / BigInt(1e12)).toString()} DUST
                          </Descriptions.Item>
                          <Descriptions.Item label="成功兑换数">
                            {bridgeService.successCount}
                          </Descriptions.Item>
                          <Descriptions.Item label="平均完成时间">
                            {bridgeService.avgTimeSeconds} 秒
                          </Descriptions.Item>
                          <Descriptions.Item label="押金额度">
                            {(BigInt(bridgeService.deposit) / BigInt(1e12)).toString()} DUST
                          </Descriptions.Item>
                        </Descriptions>

                        <Space style={{ marginTop: 16 }}>
                          {bridgeService.enabled ? (
                            <Button 
                              danger
                              onClick={onDisableBridgeService}
                              loading={loading}
                              disabled={!api}
                            >
                              禁用桥接服务
                            </Button>
                          ) : (
                            <Button 
                              type="primary"
                              icon={<CheckCircleOutlined />}
                              onClick={onReEnableBridgeService}
                              loading={loading}
                              disabled={!api}
                            >
                              重新启用桥接服务
                            </Button>
                          )}
                        </Space>
                      </Card>

                      <Divider />

                      {/* 桥接服务配置更新表单 */}
                      <Form 
                        form={bridgeForm} 
                        layout="vertical" 
                        onFinish={onUpdateBridgeService}
                      >
                        <Alert 
                          type="info" 
                          showIcon 
                          style={{ marginBottom: 16 }} 
                          message="配置更新说明" 
                          description="只填写需要修改的字段，其他字段留空则保持不变。增加最大兑换额可能需要追加押金。"
                        />

                        <Form.Item 
                          label="TRON 地址" 
                          name="tron_address" 
                          extra={`当前值：${bridgeService.tronAddress}（留空则不修改）`}
                        >
                          <Input 
                            placeholder="例如：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"
                            disabled={loading}
                          />
                        </Form.Item>

                        <Form.Item 
                          label="最大兑换额（USDT）" 
                          name="max_swap_amount" 
                          rules={[
                            { type: 'number', min: 0, message: '最大兑换额必须大于 0' }
                          ]}
                          extra={`当前值：${(bridgeService.maxSwapAmount / 1e6).toFixed(2)} USDT（留空则不修改）`}
                        >
                          <InputNumber 
                            min={0}
                            precision={2}
                            style={{ width: '100%' }}
                            placeholder="例如：1000.00"
                            disabled={loading}
                          />
                        </Form.Item>

                        <Form.Item 
                          label="手续费率（bps，万分比）" 
                          name="fee_rate_bps" 
                          rules={[
                            { type: 'number', min: 5, max: 500, message: '手续费率范围：5-500 bps（0.05%-5%）' }
                          ]}
                          extra={`当前值：${bridgeService.feeRateBps} bps = ${(bridgeService.feeRateBps / 100).toFixed(2)}%（留空则不修改）`}
                        >
                          <InputNumber 
                            min={5}
                            max={500}
                            precision={0}
                            style={{ width: '100%' }}
                            placeholder="例如：10（= 0.1%）"
                            disabled={loading}
                          />
                        </Form.Item>

                        <Button 
                          type="primary" 
                          htmlType="submit" 
                          icon={<SaveOutlined />}
                          loading={loading}
                          disabled={!api}
                          block
                          size="large"
                        >
                          {loading ? '正在签名...' : '更新桥接服务配置'}
                        </Button>
                      </Form>

                      <Alert 
                        type="warning" 
                        showIcon 
                        style={{ marginTop: 16 }} 
                        message="安全提示" 
                        description={
                          <>
                            <p>• TRON 地址更换：热钱包升级时可更新</p>
                            <p>• 最大兑换额：增加额度需要追加押金（押金 = 最大额度 × 100 DUST）</p>
                            <p>• 手续费率：调整费率需在 5-500 bps 范围内（0.05%-5%）</p>
                            <p>• 配置更新后立即生效，请确保配置正确</p>
                          </>
                        }
                      />
                    </>
                  ) : (
                    <Alert 
                      type="warning" 
                      showIcon 
                      message="桥接服务未启用" 
                      description="您尚未启用桥接服务。请先在做市商申请页面启用桥接服务。"
                    />
                  )}
                </TabPane>

                {/* 业务配置 */}
                <TabPane tab="业务配置" key="info">
                  <Form 
                    form={infoForm} 
                    layout="vertical" 
                    onFinish={onUpdateMakerInfo}
                  >
                    <Alert 
                      type="info" 
                      showIcon 
                      style={{ marginBottom: 16 }} 
                      message="配置更新说明" 
                      description="只填写需要修改的字段，其他字段留空则保持不变。"
                    />

                    <Form.Item 
                      label="公开资料 CID" 
                      name="public_cid" 
                      extra={`当前值：${marketMakerInfo.publicCid || '未配置'}（留空则不修改）`}
                    >
                      <Input 
                        placeholder="例如：QmXXXXXXXXXXXXXXXXXXXXX"
                        disabled={loading}
                      />
                    </Form.Item>

                    <Form.Item 
                      label="私密资料 CID" 
                      name="private_cid" 
                      extra={`当前值：${marketMakerInfo.privateCid || '未配置'}（留空则不修改）`}
                    >
                      <Input 
                        placeholder="例如：QmYYYYYYYYYYYYYYYYYYYY"
                        disabled={loading}
                      />
                    </Form.Item>

                    <Divider>🆕 溢价定价配置</Divider>
                    <Alert 
                      type="info" 
                      showIcon 
                      style={{ marginBottom: 16 }}
                      message="溢价定价机制说明"
                      description={
                        <div style={{ fontSize: '12px' }}>
                          <p style={{ margin: '4px 0' }}><strong>基准价</strong>：由pallet-pricing提供的市场加权均价</p>
                          <p style={{ margin: '4px 0' }}><strong>Buy溢价（Bridge）</strong>：做市商购买MEMO的溢价，通常为负数（低于基准价）</p>
                          <p style={{ margin: '4px 0' }}><strong>Sell溢价（OTC）</strong>：做市商出售MEMO的溢价，通常为正数（高于基准价）</p>
                          <p style={{ margin: '4px 0', fontStyle: 'italic' }}>示例：基准价0.01 USDT，Buy溢价-200 bps (-2%) → 买价0.0098 USDT</p>
                        </div>
                      }
                    />

                    <Form.Item 
                      label="Buy溢价（Bridge，bps）" 
                      name="buy_premium_bps" 
                      rules={[
                        { type: 'number', min: -500, max: 500, message: '溢价范围：-500 ~ 500 bps (-5% ~ +5%)' }
                      ]}
                      extra={`当前值：${marketMakerInfo.buyPremiumBps} bps = ${(marketMakerInfo.buyPremiumBps / 100).toFixed(2)}%（留空则不修改）`}
                    >
                      <InputNumber 
                        min={-500}
                        max={500}
                        step={10}
                        precision={0}
                        style={{ width: '100%' }}
                        placeholder="例如：-200（-2%折价买入）"
                        disabled={loading}
                      />
                    </Form.Item>

                    <Form.Item 
                      label="Sell溢价（OTC，bps）" 
                      name="sell_premium_bps" 
                      rules={[
                        { type: 'number', min: -500, max: 500, message: '溢价范围：-500 ~ 500 bps (-5% ~ +5%)' }
                      ]}
                      extra={`当前值：${marketMakerInfo.sellPremiumBps} bps = ${(marketMakerInfo.sellPremiumBps / 100).toFixed(2)}%（留空则不修改）`}
                    >
                      <InputNumber 
                        min={-500}
                        max={500}
                        step={10}
                        precision={0}
                        style={{ width: '100%' }}
                        placeholder="例如：+200（+2%溢价卖出）"
                        disabled={loading}
                      />
                    </Form.Item>

                    <Form.Item 
                      label="TRON地址" 
                      name="tron_address" 
                      rules={[
                        { 
                          validator: (_, value) => {
                            if (!value || value.trim() === '') {
                              return Promise.resolve() // 留空表示不修改
                            }
                            if (value.trim().length !== 34) {
                              return Promise.reject(new Error('TRON地址必须为34字符'))
                            }
                            if (!value.trim().startsWith('T')) {
                              return Promise.reject(new Error('TRON主网地址必须以T开头'))
                            }
                            const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{34}$/
                            if (!base58Regex.test(value.trim())) {
                              return Promise.reject(new Error('TRON地址包含非法字符（Base58编码）'))
                            }
                            return Promise.resolve()
                          }
                        }
                      ]}
                      extra={`当前值：${marketMakerInfo.tronAddress || '未设置'}（OTC收款 + Bridge发款，留空则不修改）`}
                    >
                      <Input 
                        placeholder="例如：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"
                        disabled={loading}
                        maxLength={34}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Form.Item>

                    <Form.Item 
                      label="最小下单额（DUST）" 
                      name="min_amount" 
                      rules={[
                        { type: 'number', min: 0, message: '最小下单额必须大于 0' }
                      ]}
                      extra={`当前值：${(BigInt(marketMakerInfo.minAmount) / BigInt(1e12)).toString()} DUST（留空则不修改）`}
                    >
                      <InputNumber 
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        placeholder="例如：100.00"
                        disabled={loading}
                      />
                    </Form.Item>

                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      icon={<SaveOutlined />}
                      loading={loading}
                      disabled={!api}
                      block
                      size="large"
                    >
                      {loading ? '正在签名...' : '更新业务配置'}
                    </Button>
                  </Form>

                  <Alert 
                    type="warning" 
                    showIcon 
                    style={{ marginTop: 16 }} 
                    message="安全提示" 
                    description={
                      <>
                        <p>• 公开资料 CID：用于展示给用户的服务条款、介绍等</p>
                        <p>• 私密资料 CID：用于治理审核的敏感信息</p>
                        <p>• OTC 费率：调整费率需在 10-1000 bps 范围内（0.1%-10%）</p>
                        <p>• Buy溢价：做市商购买MEMO的溢价，通常设为负值（折价买入，-500 ~ 500 bps）</p>
                        <p>• Sell溢价：做市商出售MEMO的溢价，通常设为正值（溢价卖出，-500 ~ 500 bps）</p>
                        <p>• 最小下单额：设置用户最小下单金额，用于业务策略调整</p>
                        <p>• 配置更新后立即生效，请确保配置正确</p>
                      </>
                    }
                  />
                </TabPane>
              </Tabs>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

