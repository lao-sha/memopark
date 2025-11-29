import React from 'react'
import { Card, Steps, Form, Input, InputNumber, Button, Space, Typography, Alert, Divider, message, Collapse, Tag, Modal, Descriptions, Spin } from 'antd'
import { InfoCircleOutlined, CheckCircleOutlined, WarningOutlined, CopyOutlined, ArrowLeftOutlined, UnlockOutlined, ReloadOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore, queryFreeBalance } from '../../lib/polkadot-safe'
import { ApiPromise } from '@polkadot/api'
import FileEncryptUpload from '../../components/FileEncryptUpload'
import './CreateMarketMakerPage.css'

/**
 * 函数级详细中文注释：做市商申请（两步式：先质押 → 再提交资料）
 * 设计目标：
 * 1）先质押 DUST，生成 mmId（链上返回）；
 * 2）在有效期内提交资料（公开 CID、私密 CID、费率与交易对参数等）；
 * 3）集成链上调用，不依赖浏览器扩展，使用本地 keystore 签名。
 * 4）CID 检查遵循项目规则：CID 一律不加密（明文 CID）；私密内容加密，但 CID 指向密文文件的明文 CID。
 */
/**
 * 函数级详细中文注释：申请详情数据结构（完整版）
 * - 包含所有可能从链上拉取的字段
 * - 用于自动填充表单
 */
interface ApplicationDetails {
  mmId: number
  owner: string
  deposit: string
  status: string
  publicCid: string
  privateCid: string
  minAmount: string
  createdAt: number
  infoDeadline: number
  reviewDeadline: number
  // 🆕 2025-10-19: 扩展字段（用于自动填充）
  buyPremiumBps?: number
  sellPremiumBps?: number
  tronAddress?: string
  // 🆕 2025-10-21: 收款方式列表（替换epay配置）
  paymentMethods?: string[]
}

/**
 * 函数级详细中文注释：做市商配置信息数据结构
 */
interface MarketMakerConfig {
  minDeposit: string       // 最小质押金额
  minAmount: string        // 最小下单额
  reviewEnabled: boolean   // 审核开关
  isUserApplication: boolean  // 是否为当前用户的申请记录
  applicationStatus?: string  // 申请状态
  applicationMmId?: number    // 做市商 ID
}

export default function CreateMarketMakerPage() {
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [current, setCurrent] = React.useState<number>(0)
  const [error, setError] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  const [mmId, setMmId] = React.useState<number | null>(null)
  const [deadlineSec, setDeadlineSec] = React.useState<number>(0)
  const [api, setApi] = React.useState<ApiPromise | null>(null)
  const [appDetails, setAppDetails] = React.useState<ApplicationDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = React.useState<boolean>(false)
  const [config, setConfig] = React.useState<MarketMakerConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = React.useState<boolean>(false)

  /**
   * 函数级详细中文注释：自动验证缓存有效性
   * - 页面加载时从链上查询真实数据
   * - 对比 localStorage 缓存，如果不一致则自动清除缓存
   * - 如果链上无数据但缓存有数据，也自动清除缓存
   * - 避免用户使用过期或错误的缓存数据
   */
  React.useEffect(() => {
    if (!api) return

    const autoValidateCache = async () => {
      const currentAddress = localStorage.getItem('mp.current')
      if (!currentAddress) {
        console.log('⚠️ [自动验证] 未找到当前账户地址')
        return
      }

      // 从 localStorage 读取缓存
      const savedMmId = localStorage.getItem('mm_apply_id')
      const savedDeadline = localStorage.getItem('mm_apply_deadline')
      const savedStep = localStorage.getItem('mm_apply_step')

      console.group('🔍 [自动验证缓存]')
      console.log('缓存 mmId:', savedMmId)
      console.log('缓存 deadline:', savedDeadline)
      console.log('缓存 step:', savedStep)

      try {
        // 从链上查询真实的 mmId（使用正确的存储项 accountToMaker）
        const ownerIndexOpt = await (api.query as any).maker?.accountToMaker(currentAddress)
        
        if (ownerIndexOpt && ownerIndexOpt.isSome) {
          // 链上有申请记录
          const chainMmId = Number(ownerIndexOpt.unwrap().toString())
          console.log('链上 mmId:', chainMmId)

          // 验证缓存是否与链上一致
          if (savedMmId && Number(savedMmId) === chainMmId) {
            console.log('✅ 缓存有效，使用缓存数据')
            // 缓存有效，使用缓存
            const id = parseInt(savedMmId, 10)
            const deadline = parseInt(savedDeadline || '0', 10)
            const step = parseInt(savedStep || '0', 10)

            // 检查是否过期（超过 25 小时清除）
            const now = Math.floor(Date.now() / 1000)
            if (deadline > now) {
              setMmId(id)
              setDeadlineSec(deadline)
              setCurrent(step)
              console.log('✅ 缓存未过期，已恢复进度')
            } else {
              console.log('⚠️ 缓存已过期，但链上数据仍然有效，使用链上数据')
              // 缓存过期但链上数据仍有效，清除缓存使用链上数据
              localStorage.removeItem('mm_apply_id')
              localStorage.removeItem('mm_apply_deadline')
              localStorage.removeItem('mm_apply_step')
              setMmId(chainMmId)
              message.info('检测到缓存已过期，已使用最新链上数据', 3)
            }
          } else {
            console.log('⚠️ 缓存无效（mmId 不一致），自动清除缓存，使用链上数据')
            // 缓存无效，清除缓存并使用链上数据
            localStorage.removeItem('mm_apply_id')
            localStorage.removeItem('mm_apply_deadline')
            localStorage.removeItem('mm_apply_step')

            setMmId(chainMmId)
            setDeadlineSec(0)
            setCurrent(0)

            message.warning('检测到缓存数据与链上不一致，已自动清除缓存并使用最新链上数据', 4)
          }
        } else {
          // 链上没有申请记录
          console.log('ℹ️ 链上无申请记录')

          if (savedMmId) {
            console.log('⚠️ 链上无数据但有缓存，自动清除无效缓存')
            // 链上没有数据但缓存有，清除缓存
            localStorage.removeItem('mm_apply_id')
            localStorage.removeItem('mm_apply_deadline')
            localStorage.removeItem('mm_apply_step')

            setMmId(null)
            setDeadlineSec(0)
            setCurrent(0)
            setAppDetails(null)

            message.warning('检测到无效缓存（链上无对应申请），已自动清除', 3)
          } else {
            console.log('✅ 链上无数据，缓存也无数据，正常（首次申请）')
          }
        }
      } catch (e) {
        console.error('❌ [自动验证] 查询失败:', e)
        // 查询失败时，仍然尝试使用缓存（降级策略）
        if (savedMmId && savedDeadline && savedStep) {
          console.log('⚠️ 查询失败，降级使用缓存数据')
          const id = parseInt(savedMmId, 10)
          const deadline = parseInt(savedDeadline, 10)
          const step = parseInt(savedStep, 10)

          const now = Math.floor(Date.now() / 1000)
          if (deadline > now) {
            setMmId(id)
            setDeadlineSec(deadline)
            setCurrent(step)
            console.log('⚠️ 使用缓存数据（链上查询失败）')
          }
        }
      } finally {
        console.groupEnd()
      }
    }

    autoValidateCache()
  }, [api])

  /**
   * 函数级详细中文注释：初始化 API 连接
   */
  React.useEffect(() => {
    const initApi = async () => {
      try {
        const apiInstance = await getApi()
        setApi(apiInstance)
      } catch (e: any) {
        setError('API 连接失败：' + (e?.message || ''))
      }
    }
    initApi()
  }, [])

  /**
   * 函数级详细中文注释：加载当前账户的做市商申请情况
   * - 查询当前账户是否已有做市商申请记录
   * - 如果有，显示实际申请详情（质押金额、费率、最小下单额、审核状态）
   * - 如果没有，显示系统默认配置要求
   */
  const loadMarketMakerConfig = React.useCallback(async () => {
    if (!api) return

    try {
      setLoadingConfig(true)

      // 检查 pallet 是否存在
      if (!(api.query as any).maker) {
        console.warn('pallet-maker 不存在')
        return
      }

      // 获取当前登录账户地址
      const currentAddress = localStorage.getItem('mp.current')
      
      console.log('[配置] 检查登录状态，当前地址:', currentAddress)
      
      if (!currentAddress) {
        console.warn('[配置] 未找到当前登录账户，显示系统默认配置')
        // 显示默认配置
        const consts = (api.consts as any).marketMaker
        const minDeposit = consts?.minDeposit ? consts.minDeposit.toString() : '1000000000000000'
        
        setConfig({
          minDeposit,
          minAmount: '100000000000000',
          reviewEnabled: true,
          isUserApplication: false
        })
        setLoadingConfig(false)
        return
      }

      // 查询当前账户的所有做市商申请
      let userApplication: any = null
      let userMmId: number | null = null
      
      try {
        // 查询 NextId 以确定需要检查的范围
        const nextIdRaw = await (api.query as any).maker.nextMakerId()
        const nextId = Number(nextIdRaw.toString())
        
        console.log('[配置] 当前 NextId:', nextId, '当前地址:', currentAddress)
        
        // 遍历查询所有申请记录，找到属于当前账户的申请
        for (let id = 0; id < nextId; id++) {
          const appOption = await (api.query as any).maker.makerApplications(id)
          
          if (appOption.isSome) {
            const app = appOption.unwrap()
            const appData = app.toJSON() as any
            
            // 检查是否属于当前账户
            if (appData.owner && appData.owner.toLowerCase() === currentAddress.toLowerCase()) {
              userApplication = appData
              userMmId = id
              console.log('[配置] 找到当前账户的申请记录:', id, appData)
              break
            }
          }
        }
      } catch (queryError: any) {
        console.warn('[配置] 查询申请记录失败:', queryError)
      }

      // 如果找到当前账户的申请，显示申请详情
      if (userApplication) {
        // 解析状态（处理 Substrate 枚举返回的各种格式）
        const rawStatus = userApplication.status
        let parsedStatus = 'Unknown'
        if (typeof rawStatus === 'string') {
          const lower = rawStatus.toLowerCase()
          if (lower === 'depositlocked') parsedStatus = 'DepositLocked'
          else if (lower === 'pendingreview') parsedStatus = 'PendingReview'
          else if (lower === 'active') parsedStatus = 'Active'
          else if (lower === 'rejected') parsedStatus = 'Rejected'
          else if (lower === 'cancelled') parsedStatus = 'Cancelled'
          else if (lower === 'expired') parsedStatus = 'Expired'
          else parsedStatus = rawStatus
        } else if (typeof rawStatus === 'object' && rawStatus !== null) {
          const keys = Object.keys(rawStatus)
          if (keys.length > 0) {
            const key = keys[0].toLowerCase()
            if (key === 'depositlocked') parsedStatus = 'DepositLocked'
            else if (key === 'pendingreview') parsedStatus = 'PendingReview'
            else if (key === 'active') parsedStatus = 'Active'
            else if (key === 'rejected') parsedStatus = 'Rejected'
            else if (key === 'cancelled') parsedStatus = 'Cancelled'
            else if (key === 'expired') parsedStatus = 'Expired'
            else parsedStatus = keys[0]
          }
        }

        console.log('[配置] 原始状态:', rawStatus, '解析后状态:', parsedStatus)

        const configData: MarketMakerConfig = {
          minDeposit: userApplication.deposit || '0',
          minAmount: userApplication.minAmount || '0',
          reviewEnabled: true,
          isUserApplication: true,
          applicationStatus: parsedStatus,
          applicationMmId: userMmId !== null ? userMmId : undefined
        }

        setConfig(configData)

        // 如果用户已有申请，自动加载详情并跳转到步骤2
        if (userMmId !== null && parsedStatus === 'DepositLocked') {
          setMmId(userMmId)
          setDeadlineSec(userApplication.infoDeadline || 0)
          setCurrent(1)
          
          // 保存到 localStorage
          localStorage.setItem('mm_apply_id', String(userMmId))
          localStorage.setItem('mm_apply_deadline', String(userApplication.infoDeadline || 0))
          localStorage.setItem('mm_apply_step', '1')
          
          message.info('检测到您有未完成的做市商申请，已自动恢复')
        }
        
        console.log('[配置] 当前账户申请情况:', configData)
      } else {
        // 没有申请记录，显示系统默认配置
        const consts = (api.consts as any).marketMaker
        const minDeposit = consts?.minDeposit ? consts.minDeposit.toString() : '1000000000000000'
        
        const configData: MarketMakerConfig = {
          minDeposit,
          minAmount: '100000000000000',
          reviewEnabled: true,
          isUserApplication: false
        }
        
        setConfig(configData)
        console.log('[配置] 使用系统默认配置:', configData)
      }
      
    } catch (e: any) {
      console.error('[配置] 加载失败:', e)
      // 使用默认配置
      setConfig({
        minDeposit: '1000000000000000',
        minAmount: '100000000000000',
        reviewEnabled: true,
        isUserApplication: false
      })
    } finally {
      setLoadingConfig(false)
    }
  }, [api])

  /**
   * 函数级详细中文注释：当 API 连接成功后，加载配置信息
   */
  React.useEffect(() => {
    if (api) {
      loadMarketMakerConfig()
    }
  }, [api, loadMarketMakerConfig])

  /**
   * 函数级详细中文注释：加载申请详情（完整版）
   * - 从链上查询指定 mmId 的申请详情
   * - 包含质押信息和所有提交的资料信息
   * - 解析所有字段用于自动填充表单
   */
  const loadApplicationDetails = React.useCallback(async (id: number) => {
    if (!api) return

    try {
      setLoadingDetails(true)

      // 检查 pallet 是否存在
      if (!(api.query as any).maker) {
        console.warn('pallet-maker 不存在')
        return
      }

      // 查询申请详情
      const appOption = await (api.query as any).maker.makerApplications(id)
      
      if (appOption.isSome) {
        const app = appOption.unwrap()
        const appData = app.toJSON() as any
        
        console.group('📋 [加载申请详情] 完整数据')
        console.log('原始数据:', appData)
        
        // 辅助函数：解码字节数组或十六进制字符串为明文字符串
        const decodeBytes = (bytes: any, fieldName: string): string => {
          if (!bytes) return ''
          try {
            // 🔹 情况1：普通字符串（不是0x开头）
            if (typeof bytes === 'string' && !bytes.startsWith('0x')) {
              console.log(`✅ ${fieldName} (已是字符串):`, bytes)
              return bytes
            }
            
            // 🔹 情况2：十六进制字符串（0x开头）→ 需要解码
            if (typeof bytes === 'string' && bytes.startsWith('0x')) {
              const hex = bytes.slice(2) // 去除 '0x' 前缀
              const byteArray: number[] = []
              
              // 将十六进制字符串转换为字节数组
              for (let i = 0; i < hex.length; i += 2) {
                byteArray.push(parseInt(hex.substr(i, 2), 16))
              }
              
              // 解码为 UTF-8 字符串
              const decoded = new TextDecoder().decode(new Uint8Array(byteArray))
              console.log(`✅ 解码 ${fieldName} (从十六进制):`, decoded)
              return decoded
            }
            
            // 🔹 情况3：字节数组
            if (Array.isArray(bytes) && bytes.length > 0) {
              const decoded = new TextDecoder().decode(new Uint8Array(bytes))
              console.log(`✅ 解码 ${fieldName} (从数组):`, decoded)
              return decoded
            }
          } catch (e) {
            console.warn(`⚠️ 解码 ${fieldName} 失败:`, e)
          }
          return ''
        }
        
        // 解析 CID（从 Uint8Array 转字符串）
        const publicCid = decodeBytes(appData.publicCid, 'publicCid')
        const privateCid = decodeBytes(appData.privateCid, 'privateCid')
        
        // 🆕 解析 TRON 地址
        const tronAddress = decodeBytes(appData.tronAddress, 'tronAddress')
        
        // 🆕 2025-10-21: 解析收款方式列表
        const paymentMethods: string[] = []
        if (appData.paymentMethods && Array.isArray(appData.paymentMethods)) {
          for (const methodBytes of appData.paymentMethods) {
            const methodStr = decodeBytes(methodBytes, 'paymentMethod')
            if (methodStr) {
              paymentMethods.push(methodStr)
            }
          }
        }

        // 🆕 解析状态（处理 Substrate 枚举返回的各种格式）
        const rawStatus = appData.status
        let parsedStatus = 'Unknown'
        if (typeof rawStatus === 'string') {
          const lower = rawStatus.toLowerCase()
          if (lower === 'depositlocked') parsedStatus = 'DepositLocked'
          else if (lower === 'pendingreview') parsedStatus = 'PendingReview'
          else if (lower === 'active') parsedStatus = 'Active'
          else if (lower === 'rejected') parsedStatus = 'Rejected'
          else if (lower === 'cancelled') parsedStatus = 'Cancelled'
          else if (lower === 'expired') parsedStatus = 'Expired'
          else parsedStatus = rawStatus
        } else if (typeof rawStatus === 'object' && rawStatus !== null) {
          const keys = Object.keys(rawStatus)
          if (keys.length > 0) {
            const key = keys[0].toLowerCase()
            if (key === 'depositlocked') parsedStatus = 'DepositLocked'
            else if (key === 'pendingreview') parsedStatus = 'PendingReview'
            else if (key === 'active') parsedStatus = 'Active'
            else if (key === 'rejected') parsedStatus = 'Rejected'
            else if (key === 'cancelled') parsedStatus = 'Cancelled'
            else if (key === 'expired') parsedStatus = 'Expired'
            else parsedStatus = keys[0]
          }
        }
        console.log('🔍 [状态解析] 原始:', rawStatus, '解析后:', parsedStatus)

        const details: ApplicationDetails = {
          mmId: id,
          owner: appData.owner || '',
          deposit: appData.deposit || '0',
          status: parsedStatus,
          publicCid,
          privateCid,
          minAmount: appData.minAmount || '0',
          createdAt: appData.createdAt || 0,
          infoDeadline: appData.infoDeadline || 0,
          reviewDeadline: appData.reviewDeadline || 0,
          // 🆕 扩展字段
          buyPremiumBps: appData.buyPremiumBps,
          sellPremiumBps: appData.sellPremiumBps,
          tronAddress: tronAddress || undefined,
          // 🆕 2025-10-21: 收款方式列表
          paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
        }
        
        console.log('✅ 解析后的完整详情:', details)
        console.groupEnd()
        
        setAppDetails(details)
      } else {
        console.warn('[查询] 申请不存在:', id)
        setAppDetails(null)
      }
    } catch (e: any) {
      console.error('[查询] 加载详情失败:', e)
    } finally {
      setLoadingDetails(false)
    }
  }, [api])

  /**
   * 函数级详细中文注释：当 mmId 或 API 变化时，加载详情
   */
  React.useEffect(() => {
    if (mmId !== null && api) {
      loadApplicationDetails(mmId)
    }
  }, [mmId, api, loadApplicationDetails])

  /**
   * 函数级详细中文注释：自动填充已提交的信息到表单（优化版）
   * - 当检测到用户有未完成的申请时（DepositLocked 状态）
   * - 直接从 appDetails 读取所有字段并自动填充到表单
   * - 提高用户交互友好度，避免重复输入
   * - 所有字段已在 loadApplicationDetails 中统一解析
   */
  React.useEffect(() => {
    if (!appDetails || !form2) return
    
    console.group('🔄 [自动填充] 检查已提交信息')
    console.log('申请状态:', appDetails.status)

    // 只有在 DepositLocked 或 PendingReview 状态时才自动填充
    if (appDetails.status === 'DepositLocked' || appDetails.status === 'PendingReview') {
      const fieldsToFill: any = {}
      let fieldCount = 0

      // 🔹 公开资料 CID
      if (appDetails.publicCid && appDetails.publicCid.length > 0) {
        fieldsToFill.public_root_cid = appDetails.publicCid
        fieldCount++
        console.log('✅ 填充 public_root_cid:', appDetails.publicCid.substring(0, 30) + '...')
      }

      // 🔹 私密资料 CID
      if (appDetails.privateCid && appDetails.privateCid.length > 0) {
        fieldsToFill.private_root_cid = appDetails.privateCid
        fieldCount++
        console.log('✅ 填充 private_root_cid:', appDetails.privateCid.substring(0, 30) + '...')
      }

      // 🔹 最小下单额
      if (appDetails.minAmount && BigInt(appDetails.minAmount) > 0n) {
        const minAmountMemo = Number(BigInt(appDetails.minAmount) / BigInt(1e12))
        fieldsToFill.min_amount = minAmountMemo
        fieldCount++
        console.log('✅ 填充 min_amount:', minAmountMemo, 'DUST')
      }

      // 🔹 Buy溢价（注意：0也是有效值，需要填充）
      if (appDetails.buyPremiumBps !== undefined && appDetails.buyPremiumBps !== null) {
        fieldsToFill.buy_premium_bps = Number(appDetails.buyPremiumBps)
        fieldCount++
        console.log('✅ 填充 buy_premium_bps:', appDetails.buyPremiumBps, 'bps', `(${(appDetails.buyPremiumBps / 100).toFixed(2)}%)`)
      } else {
        // 首次申请时，设置默认值0
        fieldsToFill.buy_premium_bps = 0
        console.log('ℹ️ Buy溢价未设置，使用默认值 0 bps')
      }

      // 🔹 Sell溢价（注意：0也是有效值，需要填充）
      if (appDetails.sellPremiumBps !== undefined && appDetails.sellPremiumBps !== null) {
        fieldsToFill.sell_premium_bps = Number(appDetails.sellPremiumBps)
        fieldCount++
        console.log('✅ 填充 sell_premium_bps:', appDetails.sellPremiumBps, 'bps', `(${(appDetails.sellPremiumBps / 100).toFixed(2)}%)`)
      } else {
        // 首次申请时，设置默认值0
        fieldsToFill.sell_premium_bps = 0
        console.log('ℹ️ Sell溢价未设置，使用默认值 0 bps')
      }

      // 🔹 TRON 地址
      if (appDetails.tronAddress && appDetails.tronAddress.length === 34 && appDetails.tronAddress.startsWith('T')) {
        fieldsToFill.tron_address = appDetails.tronAddress
        fieldCount++
        console.log('✅ 填充 tron_address:', appDetails.tronAddress)
      }

      // 🔹 Epay 商户ID
      if (appDetails.epayPid && appDetails.epayPid.length > 0) {
        fieldsToFill.epay_pid = appDetails.epayPid
        fieldCount++
        console.log('✅ 填充 epay_pid:', appDetails.epayPid)
      }

      // 🔹 Epay 商户密钥（🆕 应用户要求，也进行回填）
      if (appDetails.epayKey && appDetails.epayKey.length > 0) {
        fieldsToFill.epay_key = appDetails.epayKey
        fieldCount++
        console.log('✅ 填充 epay_key:', appDetails.epayKey.substring(0, 4) + '***（已脱敏显示）')
      }

      // 🔹 首购资金池
      if (appDetails.firstPurchasePool && BigInt(appDetails.firstPurchasePool) > 0n) {
        const poolMemo = Number(BigInt(appDetails.firstPurchasePool) / BigInt(1e12))
        if (poolMemo > 0) {
          fieldsToFill.first_purchase_pool = poolMemo
          fieldCount++
          console.log('✅ 填充 first_purchase_pool:', poolMemo, 'DUST')
        }
      }

      // 填充表单
      if (fieldCount > 0) {
        form2.setFieldsValue(fieldsToFill)
        message.success({
          content: `✅ 已自动填充 ${fieldCount} 个字段到表单`,
          duration: 3,
          key: 'autofill'
        })
        console.log(`📋 [自动填充] 完整字段列表 (${fieldCount}个):`, fieldsToFill)
      } else {
        console.log('ℹ️ 链上无已提交的数据，跳过自动填充')
      }
    } else {
      console.log('ℹ️ 状态不是 DepositLocked 或 PendingReview，跳过自动填充')
    }

    console.groupEnd()
  }, [appDetails, form2])

  /**
   * 函数级详细中文注释：解析 Substrate 枚举状态
   * - 处理 toJSON() 返回的各种格式：字符串 "Active"、对象 {active: null}、大写 "ACTIVE" 等
   * - 统一返回标准字符串格式：DepositLocked, PendingReview, Active, Rejected, Cancelled, Expired
   */
  function parseApplicationStatus(status: any): string {
    if (!status) return 'Unknown'

    // 情况1：已经是字符串
    if (typeof status === 'string') {
      // 标准化处理
      const lower = status.toLowerCase()
      if (lower === 'depositlocked') return 'DepositLocked'
      if (lower === 'pendingreview') return 'PendingReview'
      if (lower === 'active') return 'Active'
      if (lower === 'rejected') return 'Rejected'
      if (lower === 'cancelled') return 'Cancelled'
      if (lower === 'expired') return 'Expired'
      return status
    }

    // 情况2：对象形式 {Active: null} 或 {active: null}
    if (typeof status === 'object') {
      const keys = Object.keys(status)
      if (keys.length > 0) {
        const key = keys[0].toLowerCase()
        if (key === 'depositlocked') return 'DepositLocked'
        if (key === 'pendingreview') return 'PendingReview'
        if (key === 'active') return 'Active'
        if (key === 'rejected') return 'Rejected'
        if (key === 'cancelled') return 'Cancelled'
        if (key === 'expired') return 'Expired'
        return keys[0]
      }
    }

    return 'Unknown'
  }

  /**
   * 函数级详细中文注释：CID 合法性校验
   * - CID 必须为 IPFS CID v0/v1 的常见形式（base58btc 或 base32），不可带 enc: 前缀
   * - 只校验格式与长度，不下行取回；私密内容加密但 CID 仍为明文
   */
  function isValidCid(cid?: string): boolean {
    if (!cid || typeof cid !== 'string') return false
    if (/^enc:/i.test(cid)) return false
    // 简单格式校验：base32(小写字母与数字) 或 base58btc（大小写字母与数字，排除 0OIl）
    const base32ok = /^[a-z0-9]{46,}|bafy[a-z0-9]{10,}$/i.test(cid)
    const base58ok = /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(cid)
    return base32ok || base58ok
  }

  /**
   * 函数级详细中文注释：格式化 DUST 金额（12 位小数）
   * - 使用 BigInt 避免 JavaScript number 精度问题
   * - 返回整数字符串，供 Polkadot.js 使用
   */
  function formatDustAmount(amount: number): string {
    if (!amount || amount <= 0) return '0'
    try {
      // 🔧 修复大数精度丢失问题
      // DUST 使用 12 位小数：1 DUST = 1,000,000,000,000
      // ❌ 错误：BigInt(Math.floor(amount * Math.pow(10, 12))) - 当 amount 很大时会精度丢失
      // ✅ 正确：先转 BigInt 再乘法，避免 JavaScript Number 精度问题
      const decimals = 12
      const amountInt = Math.floor(amount)  // 整数部分
      const amountDec = Math.floor((amount - amountInt) * Math.pow(10, decimals))  // 小数部分
      const raw = BigInt(amountInt) * BigInt(10 ** decimals) + BigInt(amountDec)
      return raw.toString()
    } catch (e) {
      console.error('formatDustAmount error:', e)
      return '0'
    }
  }

  /**
   * 函数级详细中文注释：提交质押（链上调用）
   * - 签名调用 pallet-maker::lock_deposit(amount)
   * - 监听事件获取 mmId 和截止时间
   */
  const onDeposit = async (values: any) => {
    if (!api) {
      setError('API 未初始化，请刷新页面')
      return
    }

    setError('')
    setLoading(true)

    try {
      const amount = Number(values.deposit_amount)
      if (!amount || amount <= 0) throw new Error('请输入有效的质押金额')

      // 检查 pallet 是否已注册
      if (!(api.query as any).maker) {
        throw new Error('pallet-maker 尚未在 runtime 中注册，请联系管理员')
      }

      // 格式化金额（DUST 使用 12 位小数）
      const depositAmount = formatDustAmount(amount)

      console.log('[质押] 原始金额:', amount)
      console.log('[质押] API 可用:', !!api)
      console.log('[质押] maker pallet 存在:', !!(api.query as any).maker)

      message.loading({ content: '正在签名并提交质押...', key: 'deposit', duration: 0 })

      // 签名并发送交易（链端 lockDeposit 不需要参数，质押金额由链端配置决定）
      const hash = await signAndSendLocalFromKeystore('maker', 'lockDeposit', [])

      message.success({ content: `质押提交成功！交易哈希: ${hash}`, key: 'deposit', duration: 3 })

      // 等待事件并解析 mmId（简化版：等待区块确认）
      // 生产环境应监听链上事件获取真实 mmId
      await new Promise(resolve => setTimeout(resolve, 3000))

      try {
        // 查询最新的 mmId（从 NextId 获取）
        const nextIdRaw = await (api.query as any).maker.nextMakerId()
        const nextId = Number(nextIdRaw.toString())
        
        console.log('[质押] NextId:', nextId)
        
        // NextId 至少应该是 1（因为刚提交了一笔）
        if (nextId < 1) {
          throw new Error('NextId 异常（小于 1），链上状态可能未更新，请稍后查询')
        }
        
        // 最新申请的 ID 是 nextId - 1
        const latestMmId = nextId - 1
        
        console.log('[质押] 最新 mmId:', latestMmId)
        
        // 双重检查：确保 mmId >= 0
        if (latestMmId < 0) {
          throw new Error('mmId 计算为负数，链上数据异常')
        }
        
        // 查询申请详情以验证（传递正整数）
        if (true) {
          const appOption = await (api.query as any).maker.makerApplications(latestMmId)
          
          if (appOption.isSome) {
            const app = appOption.unwrap()
            const appData = app.toJSON()
            
            console.log('[质押] 申请详情:', appData)
            
            // 设置 mmId 和截止时间
            setMmId(latestMmId)
            setDeadlineSec((appData as any).infoDeadline || 0)
            
            // 持久化到 localStorage
            localStorage.setItem('mm_apply_id', String(latestMmId))
            localStorage.setItem('mm_apply_deadline', String((appData as any).infoDeadline || 0))
            localStorage.setItem('mm_apply_step', '1')
            
            message.success('质押成功！请继续提交资料')
            setCurrent(1)
          } else {
            // 申请不存在，可能是查询太快，使用临时方案
            console.warn('[质押] 申请详情查询为空，使用临时 mmId')
            const tmpDeadline = Math.floor(Date.now() / 1000) + 86400
            setMmId(latestMmId)
            setDeadlineSec(tmpDeadline) // 24小时后
            
            // 持久化到 localStorage
            localStorage.setItem('mm_apply_id', String(latestMmId))
            localStorage.setItem('mm_apply_deadline', String(tmpDeadline))
            localStorage.setItem('mm_apply_step', '1')
            
            message.success('质押成功！请继续提交资料')
            setCurrent(1)
          }
        } else {
          throw new Error('maker_id 计算错误，请刷新页面后重试')
        }
      } catch (queryError: any) {
        console.error('[质押] 查询 mmId 失败:', queryError)
        
        // ❌ 不再使用 fallback ID，因为会导致 NotFound 错误
        // 改为：尝试通过 OwnerIndex 查询真实的 mmId
        try {
          const currentAddress = localStorage.getItem('mp.current')
          if (currentAddress) {
            const ownerIndexOpt = await (api.query as any).maker.accountToMaker(currentAddress)
            
            if (ownerIndexOpt.isSome) {
              const realMmId = Number(ownerIndexOpt.unwrap().toString())
              console.log('[质押] 通过 AccountToMaker 找到 mmId:', realMmId)
              
              // 查询申请详情
              const appOption = await (api.query as any).maker.makerApplications(realMmId)
              if (appOption.isSome) {
                const app = appOption.unwrap()
                const appData = app.toJSON()
                
                setMmId(realMmId)
                setDeadlineSec((appData as any).infoDeadline || 0)
                
                localStorage.setItem('mm_apply_id', String(realMmId))
                localStorage.setItem('mm_apply_deadline', String((appData as any).infoDeadline || 0))
                localStorage.setItem('mm_apply_step', '1')
                
                message.success('质押成功！mmId 已恢复，请继续提交资料')
                setCurrent(1)
                return
              }
            }
          }
        } catch (ownerQueryError: any) {
          console.error('[质押] 通过 OwnerIndex 查询失败:', ownerQueryError)
        }
        
        // 如果所有查询都失败，提示用户重试
        message.error({
          content: '质押可能成功，但无法查询 mmId。请刷新页面并检查链上状态，或联系技术支持。',
          key: 'deposit',
          duration: 10
        })
        
        Modal.error({
          title: '无法查询申请ID',
          content: (
            <div>
              <p>质押交易已提交（交易哈希: {hash}），但无法查询生成的做市商ID。</p>
              <p><strong>请按以下步骤操作：</strong></p>
              <ol>
                <li>刷新页面</li>
                <li>打开浏览器控制台（F12）</li>
                <li>执行以下命令查询您的 mmId：</li>
              </ol>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 12 }}>
{`const api = await getApi()
const current = localStorage.getItem('mp.current')
const opt = await api.query.maker.accountToMaker(current)
if (opt.isSome) {
  const mmId = opt.unwrap().toNumber()
  console.log('您的 mmId:', mmId)
  localStorage.setItem('mm_apply_id', String(mmId))
  location.reload()
}`}
              </pre>
              <p>如果仍无法解决，请联系技术支持并提供交易哈希。</p>
            </div>
          ),
          width: 600
        })
      }

    } catch (e: any) {
      console.error('质押失败:', e)
      message.error({ content: '质押失败：' + (e?.message || '未知错误'), key: 'deposit', duration: 5 })
      setError(e?.message || '质押失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：提交资料（链上调用）
   * - 签名调用 pallet-maker::submit_info(real_name, id_card_number, birthday, tron_address, wechat_id, epay_no?, epay_key?)
   * - 链端需要 7 个参数（最后2个可选）
   */
  const onSubmitInfo = async (values: any) => {
    if (!api) {
      setError('API 未初始化，请刷新页面')
      return
    }

    setError('')
    setLoading(true)

    try {
      console.log('[提交资料] 表单值:', values)

      const {
        real_name,
        id_card_number,
        birthday,
        tron_address,
        wechat_id,
        epay_no,
        epay_key,
      } = values

      // ===== 1. 本地校验 =====
      if (!real_name || real_name.trim() === '') {
        throw new Error('请输入真实姓名')
      }

      if (!id_card_number || id_card_number.trim() === '') {
        throw new Error('请输入身份证号')
      }

      if (!birthday || birthday.trim() === '') {
        throw new Error('请输入生日')
      }

      // 验证TRON地址
      if (!tron_address || tron_address.trim().length !== 34 || !tron_address.trim().startsWith('T')) {
        throw new Error('TRON地址格式无效（必须34字符，以T开头）')
      }

      if (!wechat_id || wechat_id.trim() === '') {
        throw new Error('请输入微信号')
      }

      // ===== 2. 格式化参数（转为字节数组）=====
      const realNameBytes = Array.from(new TextEncoder().encode(real_name.trim()))
      const idCardBytes = Array.from(new TextEncoder().encode(id_card_number.trim()))
      const birthdayBytes = Array.from(new TextEncoder().encode(birthday.trim()))
      const tronAddressBytes = Array.from(new TextEncoder().encode(tron_address.trim()))
      const wechatIdBytes = Array.from(new TextEncoder().encode(wechat_id.trim()))

      // 可选参数
      const epayNoParam = epay_no && epay_no.trim() !== ''
        ? Array.from(new TextEncoder().encode(epay_no.trim()))
        : null
      const epayKeyParam = epay_key && epay_key.trim() !== ''
        ? Array.from(new TextEncoder().encode(epay_key.trim()))
        : null

      // 🔍 调试日志
      console.group('📤 [submitInfo] 提交参数')
      console.log('real_name:', real_name.trim())
      console.log('id_card_number:', id_card_number.trim().substring(0, 6) + '****')
      console.log('birthday:', birthday.trim())
      console.log('tron_address:', tron_address.trim())
      console.log('wechat_id:', wechat_id.trim())
      console.log('epay_no:', epay_no ? '已填写' : '未填写')
      console.log('epay_key:', epay_key ? '已填写' : '未填写')
      console.groupEnd()

      message.loading({ content: '正在签名并提交资料...', key: 'submit', duration: 0 })

      // ===== 3. 签名并发送交易 =====
      const hash = await signAndSendLocalFromKeystore('maker', 'submitInfo', [
        realNameBytes,      // real_name
        idCardBytes,        // id_card_number
        birthdayBytes,      // birthday
        tronAddressBytes,   // tron_address
        wechatIdBytes,      // wechat_id
        epayNoParam,        // epay_no (可选)
        epayKeyParam,       // epay_key (可选)
      ])

      message.success({
        content: `✅ 资料提交成功！交易哈希: ${hash}`,
        key: 'submit',
        duration: 5
      })

      // ✅ Phase 4: 显示审核员通知信息
      Modal.success({
        title: '✅ 申请已提交，审核员已收到通知',
        content: (
          <div style={{ marginTop: 16 }}>
            <p><strong>📬 您的申请已进入审核流程：</strong></p>
            <p>• 审核员已收到您的申请通知（链上事件：InfoSubmitted）</p>
            <p>• 审核员可查看您提交的私密资料（private_cid）</p>
            <p>• 预计审核时间：1-3个工作日</p>
            <p style={{ marginTop: 12, color: '#fa8c16' }}>
              <strong>💡 温馨提示：</strong>审核员可能会通过聊天功能联系您，请注意查看消息通知
            </p>
            <p style={{ marginTop: 8, color: '#52c41a' }}>
              <strong>🔒 隐私保护：</strong>您的姓名和身份证号已自动脱敏，链上仅存储脱敏后的信息
            </p>
          </div>
        ),
        okText: '知道了',
        width: 520
      })

      // 等待区块确认后重新加载详情
      await new Promise(resolve => setTimeout(resolve, 3000))
      if (mmId !== null) {
        await loadApplicationDetails(mmId)
      }

      // 清空表单
      form2.resetFields()

      // 清除 localStorage 中的申请状态
      localStorage.removeItem('mm_apply_id')
      localStorage.removeItem('mm_apply_deadline')
      localStorage.removeItem('mm_apply_step')

      // 显示成功提示
      Modal.success({
        title: '申请已提交',
        content: (
          <div>
            <p><strong>mmId:</strong> {mmId}</p>
            <p><strong>状态:</strong> 待委员会审核</p>
            <p>请等待委员会审核您的申请。审核通过后，您将成为正式做市商。</p>
            <Alert type="info" showIcon message="后续步骤" description={
              <>
                <p>1. 委员会将审查您提交的公开和私密资料</p>
                <p>2. 审核通过后，您的状态将变更为 Active</p>
                <p>3. 您可以在审核页面（#/gov/mm-review）中查看进度</p>
              </>
            } style={{ marginTop: 12 }} />
          </div>
        ),
        onOk: () => {
          // 重置状态
          setCurrent(0)
          setMmId(null)
          setDeadlineSec(0)
          form1.resetFields()
        }
      })

    } catch (e: any) {
      console.error('提交资料失败:', e)
      message.error({ content: '提交资料失败：' + (e?.message || '未知错误'), key: 'submit', duration: 5 })
      setError(e?.message || '提交资料失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：更新申请资料（链上调用）
   * - 签名调用 pallet-maker::update_info(maker_id, public_cid?, private_cid?, buy_premium_bps?, sell_premium_bps?, min_amount?, epay_gateway?, epay_port?, epay_pid?, epay_key?, first_purchase_pool?)
   * - 支持部分更新：只更新用户修改的字段，未修改的字段传 null
   * - 允许在 DepositLocked 或 PendingReview 状态下调用
   */
  const onUpdateInfo = async (values: any) => {
    if (!api) {
      setError('API 未初始化，请刷新页面')
      return
    }

    setError('')
    setLoading(true)

    try {
      // 检查 mmId
      if (mmId === null || mmId === undefined) {
        throw new Error('无效的申请编号（mmId）')
      }
      
      // 检查是否至少修改了一个字段
      const hasChanges = values.public_root_cid || values.private_root_cid || 
                        values.min_amount !== undefined ||
                        values.buy_premium_bps !== undefined || values.sell_premium_bps !== undefined ||  // 🆕 2025-10-20：溢价字段
                        values.epay_gateway || values.epay_port !== undefined ||
                        values.epay_pid || values.epay_key || values.first_purchase_pool !== undefined
      
      if (!hasChanges) {
        message.warning('请至少修改一个字段')
        setLoading(false)
        return
      }
      
      console.log('[更新资料] mmId:', mmId)
      console.log('[更新资料] 表单值:', values)

      // 构造参数（Option 类型：null 表示不修改，有值表示修改）
      let publicCidParam = null
      let privateCidParam = null
      let buyPremiumBpsParam = null   // 🆕 2025-10-20：Buy溢价参数
      let sellPremiumBpsParam = null  // 🆕 2025-10-20：Sell溢价参数
      let minAmountParam = null
      let epayPidParam = null
      let epayKeyParam = null
      let firstPurchasePoolParam = null

      // 公开资料 CID（如果提供）
      if (values.public_root_cid) {
        if (!isValidCid(values.public_root_cid)) {
          throw new Error('公开资料 CID 非法或疑似加密（禁止 enc: 前缀）')
        }
        publicCidParam = Array.from(new TextEncoder().encode(values.public_root_cid))
      }

      // 私密资料 CID（如果提供）
      if (values.private_root_cid) {
        if (!isValidCid(values.private_root_cid)) {
          throw new Error('私密资料根 CID 非法或疑似加密（禁止 enc: 前缀）')
        }
        privateCidParam = Array.from(new TextEncoder().encode(values.private_root_cid))
      }

      // 🆕 2025-10-20：Buy溢价（如果提供）
      if (values.buy_premium_bps !== undefined && values.buy_premium_bps !== null && values.buy_premium_bps !== '') {
        const premium = Number(values.buy_premium_bps)
        if (!(premium >= -500 && premium <= 500)) {
          throw new Error('Buy溢价超出范围（-500 ~ 500 bps）')
        }
        buyPremiumBpsParam = premium
        console.log('[更新] Buy溢价:', premium, 'bps')
      }

      // 🆕 2025-10-20：Sell溢价（如果提供）
      if (values.sell_premium_bps !== undefined && values.sell_premium_bps !== null && values.sell_premium_bps !== '') {
        const premium = Number(values.sell_premium_bps)
        if (!(premium >= -500 && premium <= 500)) {
          throw new Error('Sell溢价超出范围（-500 ~ 500 bps）')
        }
        sellPremiumBpsParam = premium
        console.log('[更新] Sell溢价:', premium, 'bps')
      }

      // 最小下单额（如果提供）
      if (values.min_amount !== undefined && values.min_amount !== null && values.min_amount !== '') {
        const minAmt = Number(values.min_amount)
        if (!(minAmt > 0)) {
          throw new Error('最小下单额必须大于 0')
        }
        minAmountParam = formatDustAmount(minAmt)
      }

      // 🆕 epay 商户ID（如果提供）
      if (values.epay_pid && values.epay_pid.trim() !== '') {
        if (values.epay_pid.trim().length > 64) {
          throw new Error('epay 商户ID超过 64 字节限制')
        }
        epayPidParam = Array.from(new TextEncoder().encode(values.epay_pid.trim()))
      }

      // 🆕 epay 商户密钥（如果提供）
      if (values.epay_key && values.epay_key.trim() !== '') {
        if (values.epay_key.trim().length > 64) {
          throw new Error('epay 商户密钥超过 64 字节限制')
        }
        epayKeyParam = Array.from(new TextEncoder().encode(values.epay_key.trim()))
      }

      // 🆕 首购资金池（如果提供）
      if (values.first_purchase_pool !== undefined && values.first_purchase_pool !== null && values.first_purchase_pool !== '') {
        const pool = Number(values.first_purchase_pool)
        if (!(pool > 0)) {
          throw new Error('首购资金池必须大于 0')
        }
        firstPurchasePoolParam = formatDustAmount(pool)
      }

      message.loading({ content: '正在签名并更新资料...', key: 'update', duration: 0 })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('maker', 'updateInfo', [
        mmId,
        publicCidParam,
        privateCidParam,
        buyPremiumBpsParam,   // 🆕 2025-10-20：Buy溢价
        sellPremiumBpsParam,  // 🆕 2025-10-20：Sell溢价
        minAmountParam,
        epayPidParam,
        epayKeyParam,
        firstPurchasePoolParam
      ])

      message.success({
        content: `资料更新成功！交易哈希: ${hash}`,
        key: 'update',
        duration: 5
      })

      // 等待区块确认后重新加载详情
      await new Promise(resolve => setTimeout(resolve, 3000))
      if (mmId !== null) {
        await loadApplicationDetails(mmId)
      }

      // 清空表单
      form2.resetFields()

      message.success('申请资料已更新，等待委员会审核')

    } catch (e: any) {
      console.error('更新资料失败:', e)
      message.error({ content: '更新资料失败：' + (e?.message || '未知错误'), key: 'update', duration: 5 })
      setError(e?.message || '更新资料失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：格式化截止时间
   */
  const deadlineText = React.useMemo(() => {
    if (!deadlineSec) return ''
    const d = new Date(deadlineSec * 1000)
    return d.toLocaleString('zh-CN')
  }, [deadlineSec])

  /**
   * 函数级详细中文注释：计算剩余时间
   */
  const remainingTime = React.useMemo(() => {
    if (!deadlineSec) return ''
    const now = Math.floor(Date.now() / 1000)
    const diff = deadlineSec - now
    if (diff <= 0) return '已过期'
    
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    return `${hours} 小时 ${minutes} 分钟`
  }, [deadlineSec])

  /**
   * 函数级详细中文注释：返回到购买DUST页面
   */
  const handleBackToOrder = () => {
    try {
      window.location.hash = '#/otc/order'
    } catch (e) {
      console.error('导航失败:', e)
    }
  }

  /**
   * 函数级详细中文注释：清除缓存并重新从链上拉取数据
   * - 清除 localStorage 中的缓存数据
   * - 重置页面状态
   * - 重新从链上查询最新数据
   */
  const handleClearCacheAndRefresh = async () => {
    try {
      // 清除 localStorage 缓存
      localStorage.removeItem('mm_apply_id')
      localStorage.removeItem('mm_apply_deadline')
      localStorage.removeItem('mm_apply_step')
      
      // 重置页面状态
      setMmId(null)
      setDeadlineSec(0)
      setCurrent(0)
      setAppDetails(null)
      setError('')
      
      // 清空表单
      form1.resetFields()
      form2.resetFields()
      
      message.success('缓存已清除，正在从链上拉取最新数据...')
      
      // 重新加载配置和申请数据
      if (api) {
        await loadMarketMakerConfig()
        
        // 检查是否有当前用户的申请
        const currentAddress = localStorage.getItem('mp.current')
        if (currentAddress) {
          try {
            const ownerIndexOpt = await (api.query as any).maker.accountToMaker(currentAddress)
            if (ownerIndexOpt.isSome) {
              const realMmId = Number(ownerIndexOpt.unwrap().toString())
              console.log('[重新加载] 找到 mmId:', realMmId)
              
              // 加载申请详情
              await loadApplicationDetails(realMmId)
              
              setMmId(realMmId)
              
              // 判断当前步骤
              if (appDetails && appDetails.status === 'DepositLocked') {
                setCurrent(1)
                message.info('已恢复到第二步：提交资料')
              } else {
                setCurrent(0)
                message.info('已加载最新链上数据')
              }
            } else {
              message.info('当前账户没有待处理的申请，从头开始')
            }
          } catch (e) {
            console.error('[重新加载] 查询失败:', e)
          }
        }
      }
    } catch (e: any) {
      console.error('清除缓存失败:', e)
      message.error('清除缓存失败：' + (e?.message || ''))
    }
  }

  return (
    <div className="create-market-maker-page">
      {/* 顶部导航栏（统一青绿色风格） */}
      <div className="mm-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToOrder}
          className="back-button"
        >
          返回购买DUST
        </Button>
        <div className="page-title">做市商申请</div>
        <Button
          type="primary"
          icon={<UnlockOutlined />}
          onClick={() => window.location.hash = '#/otc/decrypt'}
          className="decrypt-button"
          size="small"
        >
          委员会解密工具
        </Button>
      </div>

      {/* 主要内容区域 */}
      <div className="mm-content">
        <Card
          className="mm-main-card"
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={handleClearCacheAndRefresh}
              size="small"
              type="link"
              className="mm-refresh-button"
            >
              清除缓存并刷新
            </Button>
          }
        >
          <Typography.Title level={5} className="mm-text-primary">
            做市商申请（两步式：先质押 → 再提交资料）
          </Typography.Title>

          {!api && (
            <Alert type="info" showIcon message="正在连接链上节点..." className="mm-alert info" />
          )}

          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              className="mm-alert error"
              closable
              onClose={() => setError('')}
            />
          )}

          <Steps
            size="small"
            current={current}
            className="mm-steps"
            items={[
              {
                title: '质押保证金',
                icon: current > 0 ? <CheckCircleOutlined /> : undefined
              },
              {
                title: '提交资料（待审）',
                icon: current === 1 ? <InfoCircleOutlined /> : undefined
              },
            ]}
          />

          <Divider className="mm-divider" />

          {/* 步骤 1：质押保证金 */}
          {current === 0 && (
            <>
              <Form
                form={form1}
                layout="vertical"
                onFinish={onDeposit}
                initialValues={{ deposit_amount: 1000 }}
                className="mm-form"
              >
                <Form.Item
                  label="质押金额（DUST）"
                  name="deposit_amount"
                  rules={[
                    { required: true, message: '请输入质押金额' },
                    { type: 'number', min: config ? Number(BigInt(config.minDeposit) / BigInt(1e12)) : 1, message: `质押金额必须大于等于 ${config ? (BigInt(config.minDeposit) / BigInt(1e12)).toString() : '1000'} DUST` }
                  ]}
                  extra={config ? `最低质押金额：${(BigInt(config.minDeposit) / BigInt(1e12)).toString()} DUST（链上配置）` : '最低质押金额：1000 DUST（链上配置）'}
                >
                  <InputNumber
                    min={config ? Number(BigInt(config.minDeposit) / BigInt(1e12)) : 1}
                    precision={2}
                    step={100}
                    style={{ width: '100%' }}
                    placeholder={config ? `最少 ${(BigInt(config.minDeposit) / BigInt(1e12)).toString()} DUST` : '请输入质押金额'}
                    disabled={loading}
                  />
                </Form.Item>


                {/* 配置信息展示 */}
                {loadingConfig && (
                  <Card size="small" className="mm-loading">
                    <Spin tip="正在加载配置信息..." />
                  </Card>
                )}

                {config && (
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography.Text strong className="mm-text-primary">
                          {config.isUserApplication ? '您的做市商申请情况' : '做市商申请要求'}
                        </Typography.Text>
                        {config.isUserApplication && config.applicationMmId !== undefined && (
                          <Tag color="blue" className="mm-tag status-tag">做市商 ID: {config.applicationMmId}</Tag>
                        )}
                      </div>
                    }
                    size="small"
                    className={`mm-config-card ${config.isUserApplication ? 'user-application' : ''}`}
                  >
                    <Descriptions column={2} size="small" bordered className="mm-descriptions">
                      <Descriptions.Item label={config.isUserApplication ? '已质押金额' : '最小质押金额'}>
                        <Typography.Text strong className={config.isUserApplication ? 'mm-text-success' : 'mm-text-accent'}>
                          {(BigInt(config.minDeposit) / BigInt(1e12)).toString()} DUST
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label={config.isUserApplication ? '设置最小下单额' : '最小下单额'}>
                        <Typography.Text className="mm-text-primary">
                          {config.minAmount !== '0'
                            ? `${(BigInt(config.minAmount) / BigInt(1e12)).toString()} DUST`
                            : '未设置'
                          }
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="申请状态">
                        {config.isUserApplication && config.applicationStatus ? (
                          <Tag
                            color={
                              config.applicationStatus === 'DepositLocked' ? 'orange' :
                              config.applicationStatus === 'PendingReview' ? 'blue' :
                              config.applicationStatus === 'Active' ? 'green' :
                              config.applicationStatus === 'Rejected' ? 'red' : 'default'
                            }
                            className="mm-tag status-tag"
                          >
                            {config.applicationStatus === 'DepositLocked' ? '已质押' :
                             config.applicationStatus === 'PendingReview' ? '审核中' :
                             config.applicationStatus === 'Active' ? '已激活' :
                             config.applicationStatus === 'Rejected' ? '已驳回' :
                             config.applicationStatus}
                          </Tag>
                        ) : (
                          <Tag
                            color={config.reviewEnabled ? 'green' : 'orange'}
                            className="mm-tag status-tag"
                          >
                            {config.reviewEnabled ? '需要审核' : '无需审核'}
                          </Tag>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                    {config.isUserApplication && (
                      <Alert
                        type="info"
                        showIcon
                        message="您已有申请记录"
                        className="mm-alert info"
                        description={
                          config.applicationStatus === 'DepositLocked'
                            ? '您已完成质押，请继续提交资料'
                            : config.applicationStatus === 'PendingReview'
                            ? '您的申请正在审核中，请耐心等待'
                            : config.applicationStatus === 'Active'
                            ? '恭喜！您已成为做市商'
                            : '请查看申请详情'
                        }
                      />
                    )}

                    {/* 🆕 做市商配置管理入口（仅 Active 状态显示） */}
                    {config.isUserApplication && config.applicationStatus === 'Active' && (
                      <Card className="mm-management-card">
                        <div className="mm-management-title">
                          ⚙️ 做市商配置管理
                        </div>
                        <div className="mm-management-desc">
                          您可以随时更新您的做市商配置，包括 Epay 配置和业务参数
                        </div>
                        <Space size="middle" wrap>
                          <Button
                            type="primary"
                            onClick={() => window.location.hash = '#/otc/market-maker-config'}
                            className="mm-config-button"
                          >
                            ⚙️ Epay 配置管理
                          </Button>
                          <Button
                            type="primary"
                            onClick={() => window.location.hash = '#/otc/bridge-config'}
                            className="mm-business-button"
                          >
                            💰 业务配置管理
                          </Button>
                        </Space>
                        <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                          💡 <strong>Epay配置</strong>：更新支付网关、商户ID、密钥等<br/>
                          💡 <strong>业务配置</strong>：更新溢价、最小额、TRON地址、资料CID等
                        </div>
                      </Card>
                    )}
                  </Card>
                )}

                <Collapse
                  className="mm-collapse"
                  items={[{
                    key: '1',
                    label: '资料准备要求（点击展开）',
                    children: (
                      <div className="mm-text-secondary">
                        <Typography.Title level={5} style={{ fontSize: 14, marginTop: 0 }} className="mm-text-primary">
                          <WarningOutlined /> 提交前请准备好以下资料
                        </Typography.Title>

                        <Typography.Paragraph strong className="mm-text-primary">1. 公开资料（public_root_cid）</Typography.Paragraph>
                        <ul style={{ paddingLeft: 20, margin: 0 }}>
                          <li>公司/个人介绍（mm.json）</li>
                          <li>Logo 图标</li>
                          <li>Banner 横幅</li>
                          <li>费率说明（fee.json）</li>
                          <li>支持的交易对列表</li>
                        </ul>

                        <Typography.Paragraph strong style={{ marginTop: 12 }} className="mm-text-primary">2. 私密资料（private_root_cid）</Typography.Paragraph>
                        <ul style={{ paddingLeft: 20, margin: 0 }}>
                          <li>营业执照（加密存储，CID 明文）</li>
                          <li>身份证明文件（加密）</li>
                          <li>资金证明（加密）</li>
                          <li>联系方式（加密）</li>
                          <li>manifest.json（记录加密文件清单）</li>
                        </ul>

                        <Alert type="warning" showIcon className="mm-alert warning" message={
                          <>
                            <strong>CID 规则：</strong>
                            <p style={{ margin: '4px 0 0 0' }}>• CID 一律不加密（明文 IPFS CID）</p>
                            <p style={{ margin: '4px 0 0 0' }}>• 禁止使用 enc: 前缀</p>
                            <p style={{ margin: '4px 0 0 0' }}>• 私密内容使用文件加密，CID 指向密文文件的明文 CID</p>
                          </>
                        } />
                      </div>
                    )
                  }]}
                />

                <Space direction="vertical" className="mm-space">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    disabled={!api}
                    block
                    className="mm-submit-button"
                  >
                    {loading ? '正在签名...' : '签名质押'}
                  </Button>
                </Space>
              </Form>

              <Alert
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                className="mm-alert info"
                message="质押说明"
                description={
                  <>
                    <p>• 完成质押后，将获得 <strong>24 小时</strong>提交资料窗口</p>
                    <p>• 逾期未提交资料，系统可自动撤回或按规则扣除处理费</p>
                    <p>• 质押金额将被锁定，直到申请被批准或驳回</p>
                    <p>• 申请通过后，质押转为长期保证金</p>
                  </>
                }
              />
            </>
          )}

          {/* 步骤 2：提交资料 */}
          {current === 1 && (
            <>
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                className="mm-alert success"
                message={
                  <div>
                    <strong>质押成功！mmId = {mmId !== null ? mmId : '加载中...'}</strong>
                    {deadlineSec && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <Tag color="orange" className="mm-tag">剩余时间：{remainingTime}</Tag>
                        <span style={{ marginLeft: 8 }}>截止时间：{deadlineText}</span>
                      </div>
                    )}
                  </div>
                }
              />

              {mmId === null && (
                <Alert
                  type="warning"
                  showIcon
                  className="mm-alert warning"
                  message="mmId 加载中"
                  description="正在从链上获取申请编号，请稍候..."
                />
              )}

              {/* 已质押详情 */}
              {loadingDetails && (
                <Card className="mm-loading">
                  <Spin tip="正在加载申请详情..." />
                </Card>
              )}

              {appDetails && (
                <Card
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography.Text strong className="mm-text-primary">已质押详情</Typography.Text>
                      <Tag
                        color={
                          appDetails.status === 'DepositLocked' ? 'orange' :
                          appDetails.status === 'PendingReview' ? 'blue' :
                          appDetails.status === 'Active' ? 'green' : 'default'
                        }
                        className="mm-tag status-tag"
                      >
                        {appDetails.status}
                      </Tag>
                    </div>
                  }
                  size="small"
                  className="mm-config-card"
                >
                  <Descriptions column={1} size="small" bordered className="mm-descriptions">
                    <Descriptions.Item label="做市商 ID">{appDetails.mmId}</Descriptions.Item>
                    <Descriptions.Item label="申请人地址">
                      <Typography.Text
                        copyable={{ text: appDetails.owner, icon: <CopyOutlined className="mm-copy-button" /> }}
                        ellipsis={{ tooltip: appDetails.owner }}
                        style={{ maxWidth: 400 }}
                      >
                        {appDetails.owner}
                      </Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="质押金额">
                      {(BigInt(appDetails.deposit) / BigInt(1e12)).toString()} DUST
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {new Date(appDetails.createdAt * 1000).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                    <Descriptions.Item label="资料提交截止">
                      {new Date(appDetails.infoDeadline * 1000).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                  </Descriptions>

                  {/* 如果已提交资料，显示资料详情 */}
                  {appDetails.publicCid && appDetails.status === 'PendingReview' && (
                    <>
                      <Divider style={{ margin: '12px 0' }}>已提交资料详情</Divider>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="公开资料 CID">
                          <Typography.Text 
                            copyable={{ text: appDetails.publicCid, icon: <CopyOutlined /> }}
                            ellipsis={{ tooltip: appDetails.publicCid }}
                            style={{ maxWidth: 400, fontSize: 12 }}
                          >
                            {appDetails.publicCid}
                          </Typography.Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="私密资料 CID">
                          <Typography.Text 
                            copyable={{ text: appDetails.privateCid, icon: <CopyOutlined /> }}
                            ellipsis={{ tooltip: appDetails.privateCid }}
                            style={{ maxWidth: 400, fontSize: 12 }}
                          >
                            {appDetails.privateCid}
                          </Typography.Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="最小下单额">
                          {(BigInt(appDetails.minAmount) / BigInt(1e12)).toString()} DUST
                        </Descriptions.Item>
                        <Descriptions.Item label="审核截止时间">
                          {new Date(appDetails.reviewDeadline * 1000).toLocaleString('zh-CN')}
                        </Descriptions.Item>
                      </Descriptions>
                      <Alert 
                        type="info" 
                        showIcon 
                        message="资料已提交，等待委员会审核" 
                        style={{ marginTop: 12 }}
                      />
                    </>
                  )}
                </Card>
              )}

              {/* 判断是否为更新模式 */}
              {appDetails && appDetails.publicCid && (
                <Alert 
                  type="success" 
                  showIcon 
                  style={{ marginBottom: 12 }} 
                  message="修改模式" 
                  description="您可以修改已提交的资料。只需填写需要修改的字段，留空的字段将保持不变。"
                />
              )}

              {/* 🆕 自动填充提示（完整版） */}
              {appDetails && appDetails.status === 'DepositLocked' && (
                <Alert 
                  type="info" 
                  showIcon 
                  icon={<CheckCircleOutlined />}
                  style={{ marginBottom: 12 }} 
                  message="💡 智能填充" 
                  description={
                    <>
                      <p style={{ margin: 0, marginBottom: 8 }}>
                        <strong>已从链上自动加载您之前提交的信息：</strong>
                      </p>
                      <ul style={{ paddingLeft: 20, margin: 0, columnCount: 2, columnGap: '16px' }}>
                        {appDetails.publicCid && <li style={{ breakInside: 'avoid' }}>✅ 公开资料 CID</li>}
                        {appDetails.privateCid && <li style={{ breakInside: 'avoid' }}>✅ 私密资料 CID</li>}
                        {appDetails.minAmount && BigInt(appDetails.minAmount) > 0n && <li style={{ breakInside: 'avoid' }}>✅ 最小下单额（{(BigInt(appDetails.minAmount) / BigInt(1e12)).toString()} DUST）</li>}
                        {(appDetails.buyPremiumBps !== undefined && appDetails.buyPremiumBps !== null) ? <li style={{ breakInside: 'avoid' }}>✅ Buy溢价（{(appDetails.buyPremiumBps / 100).toFixed(2)}%）</li> : <li style={{ breakInside: 'avoid', color: '#999' }}>⚪ Buy溢价（默认0%）</li>}
                        {(appDetails.sellPremiumBps !== undefined && appDetails.sellPremiumBps !== null) ? <li style={{ breakInside: 'avoid' }}>✅ Sell溢价（{(appDetails.sellPremiumBps / 100).toFixed(2)}%）</li> : <li style={{ breakInside: 'avoid', color: '#999' }}>⚪ Sell溢价（默认0%）</li>}
                        {appDetails.tronAddress && <li style={{ breakInside: 'avoid' }}>✅ TRON地址（{appDetails.tronAddress.substring(0, 10)}...）</li>}
                        {appDetails.epayPid && <li style={{ breakInside: 'avoid' }}>✅ Epay商户ID</li>}
                        {appDetails.epayKey && appDetails.epayKey.length > 0 && <li style={{ breakInside: 'avoid' }}>✅ Epay商户密钥</li>}
                        {appDetails.firstPurchasePool && BigInt(appDetails.firstPurchasePool) > 0n && <li style={{ breakInside: 'avoid' }}>✅ 首购资金池（{(BigInt(appDetails.firstPurchasePool) / BigInt(1e12)).toString()} DUST）</li>}
                      </ul>
                      <p style={{ margin: '8px 0 0 0', color: '#1890ff', fontWeight: 'bold' }}>
                        {!appDetails.tronAddress || !appDetails.epayPid
                          ? '⚠️ 请补充缺失的字段（特别是TRON地址、Epay商户ID、商户密钥），然后提交完整资料'
                          : '请检查所有信息是否正确，然后提交资料'}
                      </p>
                    </>
                  }
                />
              )}

              {/* 文件加密上传工具 */}
              <Collapse 
                items={[{
                  key: '1',
                  label: '🔐 私密文件加密上传工具（点击展开）',
                  children: (
                    <FileEncryptUpload
                      title="私密文件加密上传"
                      description="使用此工具加密您的私密文件（营业执照、身份证等）并上传到 IPFS，获取私密资料根 CID"
                      onCidGenerated={(cid) => {
                        // 自动填充到表单
                        form2.setFieldsValue({ private_root_cid: cid })
                        message.success('CID 已自动填充到下方表单')
                      }}
                    />
                  )
                }]}
                style={{ marginBottom: 16 }}
              />

              <Form
                form={form2}
                layout="vertical"
                onFinish={onSubmitInfo}
              >
                <Divider orientation="left">📋 基本信息</Divider>

                <Form.Item
                  label="真实姓名"
                  name="real_name"
                  rules={[
                    { required: true, message: '请输入真实姓名' },
                    { max: 64, message: '姓名不能超过64字符' }
                  ]}
                  extra="将用于身份验证和订单交易"
                >
                  <Input
                    placeholder="请输入真实姓名"
                    disabled={loading}
                    maxLength={64}
                  />
                </Form.Item>

                <Form.Item
                  label="身份证号"
                  name="id_card_number"
                  rules={[
                    { required: true, message: '请输入身份证号' },
                    { pattern: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/, message: '请输入有效的18位身份证号' }
                  ]}
                  extra="用于身份验证，链上将脱敏存储"
                >
                  <Input
                    placeholder="请输入18位身份证号"
                    disabled={loading}
                    maxLength={18}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>

                <Form.Item
                  label="生日"
                  name="birthday"
                  rules={[
                    { required: true, message: '请输入生日' },
                    { pattern: /^\d{4}-\d{2}-\d{2}$/, message: '请使用 YYYY-MM-DD 格式' }
                  ]}
                  extra="格式：YYYY-MM-DD，例如：1990-01-15"
                >
                  <Input
                    placeholder="例如：1990-01-15"
                    disabled={loading}
                    maxLength={10}
                  />
                </Form.Item>

                <Divider orientation="left">📱 联系方式</Divider>

                <Form.Item
                  label="微信号"
                  name="wechat_id"
                  rules={[
                    { required: true, message: '请输入微信号' },
                    { max: 64, message: '微信号不能超过64字符' }
                  ]}
                  extra="用于与买家沟通和处理订单问题"
                >
                  <Input
                    placeholder="请输入微信号"
                    disabled={loading}
                    maxLength={64}
                  />
                </Form.Item>

                <Divider orientation="left">🔐 TRON地址配置</Divider>

                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="📌 统一TRON地址说明"
                  description={
                    <>
                      <p><strong>用途：</strong>此TRON地址将用于所有USDT业务</p>
                      <p>• <strong>OTC订单</strong>：买家向此地址转账USDT购买DUST</p>
                      <p>• <strong>Bridge订单</strong>：您从此地址向买家发送USDT</p>
                      <p>• <strong>格式要求</strong>：34字符，以'T'开头的TRON主网地址</p>
                    </>
                  }
                />

                <Form.Item
                  label="TRON地址"
                  name="tron_address"
                  rules={[
                    { required: true, message: '请输入TRON地址' },
                    {
                      validator: (_, value) => {
                        if (!value || value.trim() === '') {
                          return Promise.reject(new Error('TRON地址不能为空'))
                        }
                        if (value.trim().length !== 34) {
                          return Promise.reject(new Error('TRON地址必须为34字符'))
                        }
                        if (!value.trim().startsWith('T')) {
                          return Promise.reject(new Error('TRON主网地址必须以T开头'))
                        }
                        return Promise.resolve()
                      }
                    }
                  ]}
                  extra="您的TRON主网地址（OTC收款 + Bridge发款），34字符，以'T'开头"
                >
                  <Input
                    placeholder="例如：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"
                    disabled={loading}
                    maxLength={34}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>

                <Divider orientation="left">💳 EPAY配置（可选）</Divider>

                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="📌 EPAY配置说明"
                  description="EPAY配置为可选项，如果您有EPAY商户账号可以填写，用于自动化支付处理。"
                />

                <Form.Item
                  label="EPAY商户号"
                  name="epay_no"
                  extra="可选，如有EPAY商户账号请填写"
                >
                  <Input
                    placeholder="可选，例如：1234567"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item
                  label="EPAY密钥"
                  name="epay_key"
                  extra="可选，EPAY商户密钥"
                >
                  <Input.Password
                    placeholder="可选，EPAY商户密钥"
                    disabled={loading}
                  />
                </Form.Item>

                <Space direction="vertical" className="mm-space" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    disabled={!api}
                    block
                    size="large"
                    className="mm-submit-button"
                  >
                    {loading ? '正在签名...' : '提交资料'}
                  </Button>
                  <Button
                    onClick={() => setCurrent(0)}
                    disabled={loading}
                    block
                    className="mm-secondary-button"
                  >
                    返回上一步
                  </Button>
                </Space>
              </Form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}