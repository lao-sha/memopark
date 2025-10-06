import React from 'react'
import { Card, Steps, Form, Input, InputNumber, Button, Space, Typography, Alert, Divider, message, Collapse, Tag, Modal, Descriptions, Spin } from 'antd'
import { InfoCircleOutlined, CheckCircleOutlined, WarningOutlined, CopyOutlined, ArrowLeftOutlined, UnlockOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { ApiPromise } from '@polkadot/api'
import FileEncryptUpload from '../../components/FileEncryptUpload'

/**
 * 函数级详细中文注释：做市商申请（两步式：先质押 → 再提交资料）
 * 设计目标：
 * 1）先质押 MEMO，生成 mmId（链上返回）；
 * 2）在有效期内提交资料（公开 CID、私密 CID、费率与交易对参数等）；
 * 3）集成链上调用，不依赖浏览器扩展，使用本地 keystore 签名。
 * 4）CID 检查遵循项目规则：CID 一律不加密（明文 CID）；私密内容加密，但 CID 指向密文文件的明文 CID。
 */
/**
 * 函数级详细中文注释：申请详情数据结构
 */
interface ApplicationDetails {
  mmId: number
  owner: string
  deposit: string
  status: string
  publicCid: string
  privateCid: string
  feeBps: number
  minAmount: string
  createdAt: number
  infoDeadline: number
  reviewDeadline: number
}

/**
 * 函数级详细中文注释：做市商配置信息数据结构
 */
interface MarketMakerConfig {
  minDeposit: string       // 最小质押金额
  maxFeeBps: number        // 最大费率（bps）
  minFeeBps: number        // 最小费率（bps）
  minAmount: string        // 最小下单额
  reviewEnabled: boolean   // 审核开关
  isUserApplication: boolean  // 是否为当前用户的申请记录
  applicationStatus?: string  // 申请状态
  applicationFeeBps?: number  // 用户设置的费率
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
   * 函数级详细中文注释：从 localStorage 恢复申请状态
   * - 用于页面刷新后恢复进度
   */
  React.useEffect(() => {
    const savedMmId = localStorage.getItem('mm_apply_id')
    const savedDeadline = localStorage.getItem('mm_apply_deadline')
    const savedStep = localStorage.getItem('mm_apply_step')
    
    if (savedMmId && savedDeadline && savedStep) {
      const id = parseInt(savedMmId, 10)
      const deadline = parseInt(savedDeadline, 10)
      const step = parseInt(savedStep, 10)
      
      console.log('[恢复] mmId:', id, 'deadline:', deadline, 'step:', step)
      
      // 检查是否过期（超过 25 小时清除）
      const now = Math.floor(Date.now() / 1000)
      if (deadline > now) {
        setMmId(id)
        setDeadlineSec(deadline)
        setCurrent(step)
        message.info('已恢复上次申请进度')
      } else {
        // 清除过期数据
        localStorage.removeItem('mm_apply_id')
        localStorage.removeItem('mm_apply_deadline')
        localStorage.removeItem('mm_apply_step')
      }
    }
  }, [])

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
      if (!(api.query as any).marketMaker) {
        console.warn('pallet-market-maker 不存在')
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
          maxFeeBps: 10000,
          minFeeBps: 0,
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
        const nextIdRaw = await (api.query as any).marketMaker.nextId()
        const nextId = Number(nextIdRaw.toString())
        
        console.log('[配置] 当前 NextId:', nextId, '当前地址:', currentAddress)
        
        // 遍历查询所有申请记录，找到属于当前账户的申请
        for (let id = 0; id < nextId; id++) {
          const appOption = await (api.query as any).marketMaker.applications(id)
          
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
        const configData: MarketMakerConfig = {
          minDeposit: userApplication.deposit || '0',
          maxFeeBps: 10000,
          minFeeBps: 0,
          minAmount: userApplication.minAmount || '0',
          reviewEnabled: true,
          isUserApplication: true,
          applicationStatus: userApplication.status || 'Unknown',
          applicationFeeBps: userApplication.feeBps || 0,
          applicationMmId: userMmId || undefined
        }
        
        setConfig(configData)
        
        // 如果用户已有申请，自动加载详情并跳转到步骤2
        if (userMmId !== null && userApplication.status === 'DepositLocked') {
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
          maxFeeBps: 10000,
          minFeeBps: 0,
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
        maxFeeBps: 10000,
        minFeeBps: 0,
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
   * 函数级详细中文注释：加载申请详情
   * - 从链上查询指定 mmId 的申请详情
   * - 包含质押信息和提交资料信息
   */
  const loadApplicationDetails = React.useCallback(async (id: number) => {
    if (!api) return
    
    try {
      setLoadingDetails(true)
      
      // 检查 pallet 是否存在
      if (!(api.query as any).marketMaker) {
        console.warn('pallet-market-maker 不存在')
        return
      }

      // 查询申请详情
      const appOption = await (api.query as any).marketMaker.applications(id)
      
      if (appOption.isSome) {
        const app = appOption.unwrap()
        const appData = app.toJSON() as any
        
        // 解析 CID（从 Uint8Array 转字符串）
        const publicCid = appData.publicCid ? 
          (Array.isArray(appData.publicCid) ? 
            new TextDecoder().decode(new Uint8Array(appData.publicCid)) : 
            appData.publicCid) : ''
        
        const privateCid = appData.privateCid ? 
          (Array.isArray(appData.privateCid) ? 
            new TextDecoder().decode(new Uint8Array(appData.privateCid)) : 
            appData.privateCid) : ''
        
        const details: ApplicationDetails = {
          mmId: id,
          owner: appData.owner || '',
          deposit: appData.deposit || '0',
          status: appData.status || 'Unknown',
          publicCid,
          privateCid,
          feeBps: appData.feeBps || 0,
          minAmount: appData.minAmount || '0',
          createdAt: appData.createdAt || 0,
          infoDeadline: appData.infoDeadline || 0,
          reviewDeadline: appData.reviewDeadline || 0,
        }
        
        setAppDetails(details)
        console.log('[查询] 申请详情:', details)
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
   * 函数级详细中文注释：格式化 MEMO 金额（12 位小数）
   * - 使用 BigInt 避免 JavaScript number 精度问题
   * - 返回整数字符串，供 Polkadot.js 使用
   */
  function formatMemoAmount(amount: number): string {
    if (!amount || amount <= 0) return '0'
    try {
      // 使用 BigInt 避免精度丢失
      // MEMO 使用 12 位小数：1 MEMO = 1,000,000,000,000
      const decimals = 12
      const raw = BigInt(Math.floor(amount * Math.pow(10, decimals)))
      return raw.toString()
    } catch (e) {
      console.error('formatMemoAmount error:', e)
      return '0'
    }
  }

  /**
   * 函数级详细中文注释：提交质押（链上调用）
   * - 签名调用 pallet-market-maker::lock_deposit(amount)
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
      if (!(api.query as any).marketMaker) {
        throw new Error('pallet-market-maker 尚未在 runtime 中注册，请联系管理员')
      }

      // 格式化金额（MEMO 使用 12 位小数）
      const depositAmount = formatMemoAmount(amount)
      
      console.log('[质押] 原始金额:', amount)
      console.log('[质押] 格式化后:', depositAmount)
      console.log('[质押] API 可用:', !!api)
      console.log('[质押] marketMaker pallet 存在:', !!(api.query as any).marketMaker)

      message.loading({ content: '正在签名并提交质押...', key: 'deposit', duration: 0 })

      // 签名并发送交易（注意：Rust 蛇形命名在 JS 中转为驼峰）
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'lockDeposit', [depositAmount])

      message.success({ content: `质押提交成功！交易哈希: ${hash}`, key: 'deposit', duration: 3 })

      // 等待事件并解析 mmId（简化版：等待区块确认）
      // 生产环境应监听链上事件获取真实 mmId
      await new Promise(resolve => setTimeout(resolve, 3000))

      try {
        // 查询最新的 mmId（从 NextId 获取）
        const nextIdRaw = await (api.query as any).marketMaker.nextId()
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
          const appOption = await (api.query as any).marketMaker.applications(latestMmId)
          
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
          throw new Error('mm_id 计算错误，请刷新页面后重试')
        }
      } catch (queryError: any) {
        console.error('[质押] 查询 mmId 失败:', queryError)
        // 即使查询失败，也允许用户继续（使用占位 ID）
        const fallbackId = Math.floor(Date.now() / 1000) % 100000
        const tmpDeadline = Math.floor(Date.now() / 1000) + 86400
        
        setMmId(fallbackId)
        setDeadlineSec(tmpDeadline)
        
        // 持久化到 localStorage
        localStorage.setItem('mm_apply_id', String(fallbackId))
        localStorage.setItem('mm_apply_deadline', String(tmpDeadline))
        localStorage.setItem('mm_apply_step', '1')
        
        message.warning('质押成功但无法查询详情，请手动记录交易哈希并联系客服')
        setCurrent(1)
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
   * - 签名调用 pallet-market-maker::submit_info(mm_id, public_root_cid, private_root_cid, fee_bps, min_amount)
   * - 本地校验：CID 合法、费率/最小额有效
   */
  const onSubmitInfo = async (values: any) => {
    if (!api) {
      setError('API 未初始化，请刷新页面')
      return
    }

    setError('')
    setLoading(true)

    try {
      // 修复：mmId 可以是 0，使用 === null 检查
      if (mmId === null || mmId === undefined) {
        throw new Error('请先完成质押步骤（mmId 无效）')
      }
      
      console.log('[提交资料] mmId:', mmId)
      console.log('[提交资料] mmId 类型:', typeof mmId)
      console.log('[提交资料] 表单值:', values)

      const { public_root_cid, private_root_cid, fee_bps, min_amount } = values

      // 本地校验
      if (!isValidCid(public_root_cid)) throw new Error('公开资料 CID 非法或疑似加密（禁止 enc: 前缀）')
      if (!isValidCid(private_root_cid)) throw new Error('私密资料根 CID 非法或疑似加密（禁止 enc: 前缀）')

      const fee = Number(fee_bps)
      if (!(fee >= 0 && fee <= 10000)) throw new Error('费率 bps 超出范围（0~10000）')

      const minAmt = Number(min_amount)
      if (!(minAmt > 0)) throw new Error('最小下单额必须大于 0')

      // 格式化参数
      const publicCid = Array.from(new TextEncoder().encode(public_root_cid))
      const privateCid = Array.from(new TextEncoder().encode(private_root_cid))
      const minAmountFormatted = formatMemoAmount(minAmt)

      message.loading({ content: '正在签名并提交资料...', key: 'submit', duration: 0 })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'submitInfo', [
        mmId,
        publicCid,
        privateCid,
        fee,
        minAmountFormatted
      ])

      message.success({
        content: `资料提交成功！交易哈希: ${hash}`,
        key: 'submit',
        duration: 5
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
   * - 签名调用 pallet-market-maker::update_info(mm_id, public_cid?, private_cid?, fee_bps?, min_amount?)
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
                        values.fee_bps !== undefined || values.min_amount !== undefined
      
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
      let feeBpsParam = null
      let minAmountParam = null

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

      // 费率（如果提供）
      if (values.fee_bps !== undefined && values.fee_bps !== null && values.fee_bps !== '') {
        const fee = Number(values.fee_bps)
        if (!(fee >= 0 && fee <= 10000)) {
          throw new Error('费率 bps 超出范围（0~10000）')
        }
        feeBpsParam = fee
      }

      // 最小下单额（如果提供）
      if (values.min_amount !== undefined && values.min_amount !== null && values.min_amount !== '') {
        const minAmt = Number(values.min_amount)
        if (!(minAmt > 0)) {
          throw new Error('最小下单额必须大于 0')
        }
        minAmountParam = formatMemoAmount(minAmt)
      }

      message.loading({ content: '正在签名并更新资料...', key: 'update', duration: 0 })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'updateInfo', [
        mmId,
        publicCidParam,
        privateCidParam,
        feeBpsParam,
        minAmountParam
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
   * 函数级详细中文注释：返回到购买MEMO页面
   */
  const handleBackToOrder = () => {
    try {
      window.location.hash = '#/otc/order'
    } catch (e) {
      console.error('导航失败:', e)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
      }}
    >
      {/* 顶部操作按钮 */}
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
          onClick={handleBackToOrder}
          style={{ 
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          返回购买MEMO
        </Button>
      </div>
      
      {/* 解密工具按钮 - 固定在右上角（委员会专用） */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px',
        zIndex: 10,
      }}>
        <Button
          type="primary"
          icon={<UnlockOutlined />}
          onClick={() => window.location.hash = '#/otc/decrypt'}
          style={{ 
            padding: '4px 12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
          }}
        >
          委员会解密工具
        </Button>
      </div>

      {/* 主内容区域 */}
      <div
        style={{
          padding: '60px 20px 20px',
          maxWidth: '640px',
          margin: '0 auto',
        }}
      >
        <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Typography.Title level={5}>做市商申请（两步式：先质押 → 再提交资料）</Typography.Title>

          {!api && (
            <Alert type="info" showIcon message="正在连接链上节点..." style={{ marginBottom: 12 }} />
          )}

          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} closable onClose={() => setError('')} />}

          <Steps size="small" current={current} items={[
            { 
              title: '质押保证金',
              icon: current > 0 ? <CheckCircleOutlined /> : undefined
            },
            { 
              title: '提交资料（待审）',
              icon: current === 1 ? <InfoCircleOutlined /> : undefined
            },
          ]} />

          <Divider />

          {/* 步骤 1：质押保证金 */}
          {current === 0 && (
            <>
              <Form form={form1} layout="vertical" onFinish={onDeposit} initialValues={{ deposit_amount: 1000 }}>
                <Form.Item 
                  label="质押金额（MEMO）" 
                  name="deposit_amount" 
                  rules={[
                    { required: true, message: '请输入质押金额' },
                    { type: 'number', min: config ? Number(BigInt(config.minDeposit) / BigInt(1e12)) : 1, message: `质押金额必须大于等于 ${config ? (BigInt(config.minDeposit) / BigInt(1e12)).toString() : '1000'} MEMO` }
                  ]}
                  extra={config ? `最低质押金额：${(BigInt(config.minDeposit) / BigInt(1e12)).toString()} MEMO（链上配置）` : '最低质押金额：1000 MEMO（链上配置）'}
                > 
                  <InputNumber 
                    min={config ? Number(BigInt(config.minDeposit) / BigInt(1e12)) : 1} 
                    precision={2} 
                    step={100} 
                    style={{ width: '100%' }}
                    placeholder={config ? `最少 ${(BigInt(config.minDeposit) / BigInt(1e12)).toString()} MEMO` : '请输入质押金额'}
                    disabled={loading}
                  />
                </Form.Item>

                {/* 配置信息展示 */}
                {loadingConfig && (
                  <Card size="small" style={{ marginBottom: 12 }}>
                    <Spin tip="正在加载配置信息..." />
                  </Card>
                )}

                {config && (
                  <Card 
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography.Text strong>
                          {config.isUserApplication ? '您的做市商申请情况' : '做市商申请要求'}
                        </Typography.Text>
                        {config.isUserApplication && config.applicationMmId !== undefined && (
                          <Tag color="blue">做市商 ID: {config.applicationMmId}</Tag>
                        )}
                      </div>
                    }
                    size="small" 
                    style={{ 
                      marginBottom: 12, 
                      background: config.isUserApplication ? '#e6f7ff' : '#fafafa',
                      border: config.isUserApplication ? '1px solid #91d5ff' : undefined
                    }}
                  >
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label={config.isUserApplication ? '已质押金额' : '最小质押金额'}>
                        <Typography.Text strong style={{ color: config.isUserApplication ? '#52c41a' : '#1890ff' }}>
                          {(BigInt(config.minDeposit) / BigInt(1e12)).toString()} MEMO
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label={config.isUserApplication ? '设置费率' : '费率范围'}>
                        <Typography.Text>
                          {config.isUserApplication && config.applicationFeeBps !== undefined
                            ? `${(config.applicationFeeBps / 100).toFixed(2)}% (${config.applicationFeeBps} bps)`
                            : `${config.minFeeBps / 100}% - ${config.maxFeeBps / 100}%`
                          }
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label={config.isUserApplication ? '设置最小下单额' : '最小下单额'}>
                        <Typography.Text>
                          {config.minAmount !== '0' 
                            ? `${(BigInt(config.minAmount) / BigInt(1e12)).toString()} MEMO`
                            : '未设置'
                          }
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="申请状态">
                        {config.isUserApplication && config.applicationStatus ? (
                          <Tag color={
                            config.applicationStatus === 'DepositLocked' ? 'orange' :
                            config.applicationStatus === 'PendingReview' ? 'blue' :
                            config.applicationStatus === 'Active' ? 'green' :
                            config.applicationStatus === 'Rejected' ? 'red' : 'default'
                          }>
                            {config.applicationStatus === 'DepositLocked' ? '已质押' :
                             config.applicationStatus === 'PendingReview' ? '审核中' :
                             config.applicationStatus === 'Active' ? '已激活' :
                             config.applicationStatus === 'Rejected' ? '已驳回' :
                             config.applicationStatus}
                          </Tag>
                        ) : (
                          <Tag color={config.reviewEnabled ? 'green' : 'orange'}>
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
                        description={
                          config.applicationStatus === 'DepositLocked' 
                            ? '您已完成质押，请继续提交资料' 
                            : config.applicationStatus === 'PendingReview'
                            ? '您的申请正在审核中，请耐心等待'
                            : config.applicationStatus === 'Active'
                            ? '恭喜！您已成为做市商'
                            : '请查看申请详情'
                        }
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </Card>
                )}

                <Collapse
                  items={[{
                    key: '1',
                    label: '资料准备要求（点击展开）',
                    children: (
                      <div style={{ fontSize: 13 }}>
                        <Typography.Title level={5} style={{ fontSize: 14, marginTop: 0 }}>
                          <WarningOutlined /> 提交前请准备好以下资料
                        </Typography.Title>
                        
                        <Typography.Paragraph strong>1. 公开资料（public_root_cid）</Typography.Paragraph>
                        <ul style={{ paddingLeft: 20, margin: 0 }}>
                          <li>公司/个人介绍（mm.json）</li>
                          <li>Logo 图标</li>
                          <li>Banner 横幅</li>
                          <li>费率说明（fee.json）</li>
                          <li>支持的交易对列表</li>
                        </ul>

                        <Typography.Paragraph strong style={{ marginTop: 12 }}>2. 私密资料（private_root_cid）</Typography.Paragraph>
                        <ul style={{ paddingLeft: 20, margin: 0 }}>
                          <li>营业执照（加密存储，CID 明文）</li>
                          <li>身份证明文件（加密）</li>
                          <li>资金证明（加密）</li>
                          <li>联系方式（加密）</li>
                          <li>manifest.json（记录加密文件清单）</li>
                        </ul>

                        <Alert type="warning" showIcon style={{ marginTop: 12, fontSize: 12 }} message={
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
                  style={{ marginBottom: 12 }}
                />

                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    disabled={!api}
                    block
                  >
                    {loading ? '正在签名...' : '签名质押'}
                  </Button>
                </Space>
              </Form>

              <Alert 
                type="info" 
                showIcon 
                icon={<InfoCircleOutlined />}
                style={{ marginTop: 12 }} 
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
                style={{ marginBottom: 12 }} 
                message={
                  <div>
                    <strong>质押成功！mmId = {mmId !== null ? mmId : '加载中...'}</strong>
                    {deadlineSec && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <Tag color="orange">剩余时间：{remainingTime}</Tag>
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
                  style={{ marginBottom: 12 }} 
                  message="mmId 加载中"
                  description="正在从链上获取申请编号，请稍候..."
                />
              )}

              {/* 已质押详情 */}
              {loadingDetails && (
                <Card style={{ marginBottom: 12 }} size="small">
                  <Spin tip="正在加载申请详情..." />
                </Card>
              )}

              {appDetails && (
                <Card 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography.Text strong>已质押详情</Typography.Text>
                      <Tag color={
                        appDetails.status === 'DepositLocked' ? 'orange' :
                        appDetails.status === 'PendingReview' ? 'blue' :
                        appDetails.status === 'Active' ? 'green' : 'default'
                      }>
                        {appDetails.status}
                      </Tag>
                    </div>
                  }
                  size="small" 
                  style={{ marginBottom: 12 }}
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="做市商 ID">{appDetails.mmId}</Descriptions.Item>
                    <Descriptions.Item label="申请人地址">
                      <Typography.Text 
                        copyable={{ text: appDetails.owner, icon: <CopyOutlined /> }}
                        ellipsis={{ tooltip: appDetails.owner }}
                        style={{ maxWidth: 400 }}
                      >
                        {appDetails.owner}
                      </Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="质押金额">
                      {(BigInt(appDetails.deposit) / BigInt(1e12)).toString()} MEMO
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
                        <Descriptions.Item label="费率">
                          {(appDetails.feeBps / 100).toFixed(2)}% ({appDetails.feeBps} bps)
                        </Descriptions.Item>
                        <Descriptions.Item label="最小下单额">
                          {(BigInt(appDetails.minAmount) / BigInt(1e12)).toString()} MEMO
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
                onFinish={appDetails && appDetails.publicCid ? onUpdateInfo : onSubmitInfo}
              >
                <Form.Item 
                  label="公开资料根 CID（public_root_cid）" 
                  name="public_root_cid" 
                  rules={
                    appDetails && appDetails.publicCid 
                      ? [{ validator: (_, v) => !v || isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }]
                      : [
                          { required: true, message: '请输入公开资料根 CID' }, 
                          { validator: (_, v) => isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }
                        ]
                  }
                  extra={
                    appDetails && appDetails.publicCid 
                      ? `当前值：${appDetails.publicCid.substring(0, 20)}...（留空则不修改）`
                      : "例如 bafy... 格式，包含 mm.json/logo/banner/fee.json 等公开文件"
                  }
                >
                  <Input.TextArea 
                    placeholder={
                      appDetails && appDetails.publicCid 
                        ? "留空则不修改当前 CID"
                        : "例如 bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
                    }
                    rows={2}
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item 
                  label="私密资料根 CID（private_root_cid）" 
                  name="private_root_cid" 
                  rules={
                    appDetails && appDetails.privateCid
                      ? [{ validator: (_, v) => !v || isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }]
                      : [
                          { required: true, message: '请输入私密资料根 CID' }, 
                          { validator: (_, v) => isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }
                        ]
                  }
                  extra={
                    appDetails && appDetails.privateCid
                      ? `当前值：${appDetails.privateCid.substring(0, 20)}...（留空则不修改）`
                      : "例如 bafy... 格式，包含 private.enc/manifest.json 与 *.enc 文件"
                  }
                >
                  <Input.TextArea 
                    placeholder={
                      appDetails && appDetails.privateCid
                        ? "留空则不修改当前 CID"
                        : "例如 bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
                    }
                    rows={2}
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item 
                  label="费率（bps）" 
                  name="fee_bps" 
                  rules={
                    appDetails && appDetails.feeBps !== undefined
                      ? [{ type: 'number', min: 0, max: 10000, message: '费率范围：0-10000 bps' }]
                      : [
                          { required: true, message: '请输入费率' },
                          { type: 'number', min: 0, max: 10000, message: '费率范围：0-10000 bps' }
                        ]
                  }
                  extra={
                    appDetails && appDetails.feeBps !== undefined
                      ? `当前值：${(appDetails.feeBps / 100).toFixed(2)}% (${appDetails.feeBps} bps)（留空则不修改）`
                      : "1 bps = 0.01%，例如 25 bps = 0.25%"
                  }
                >
                  <InputNumber 
                    min={0} 
                    max={10000} 
                    step={1} 
                    style={{ width: '100%' }}
                    placeholder={
                      appDetails && appDetails.feeBps !== undefined
                        ? `当前 ${appDetails.feeBps} bps`
                        : "例如 25（即 0.25%）"
                    }
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item 
                  label="最小下单额（MEMO）" 
                  name="min_amount" 
                  rules={
                    appDetails && appDetails.minAmount
                      ? [{ type: 'number', min: 0.01, message: '最小下单额必须大于 0' }]
                      : [
                          { required: true, message: '请输入最小下单额' },
                          { type: 'number', min: 0.01, message: '最小下单额必须大于 0' }
                        ]
                  }
                  extra={
                    appDetails && appDetails.minAmount
                      ? `当前值：${(BigInt(appDetails.minAmount) / BigInt(1e12)).toString()} MEMO（留空则不修改）`
                      : "用户单笔交易的最小金额限制"
                  }
                >
                  <InputNumber 
                    min={0.01} 
                    precision={2} 
                    step={10} 
                    style={{ width: '100%' }}
                    placeholder={
                      appDetails && appDetails.minAmount
                        ? `当前 ${(BigInt(appDetails.minAmount) / BigInt(1e12)).toString()} MEMO`
                        : "例如 100.00"
                    }
                    disabled={loading}
                  />
                </Form.Item>

                <Alert 
                  type="warning" 
                  showIcon 
                  style={{ marginBottom: 12 }} 
                  message="CID 检查规则" 
                  description={
                    <>
                      <p>• CID 一律不加密，必须是有效的 IPFS CID（v0 或 v1）</p>
                      <p>• 私密资料为加密内容文件的明文 CID，禁止使用 enc: 前缀</p>
                      <p>• 提交前请确保 IPFS 网关可以取回文件</p>
                      <p>• 委员会将下载并验证您提交的资料</p>
                      {appDetails && appDetails.publicCid && (
                        <p style={{ color: '#1890ff', fontWeight: 'bold' }}>
                          • 修改模式：只填写需要修改的字段，其他字段留空则保持不变
                        </p>
                      )}
                    </>
                  }
                />

                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    disabled={!api || mmId === null}
                    block
                    size="large"
                  >
                    {loading 
                      ? '正在签名...' 
                      : mmId === null 
                      ? 'mmId 加载中...' 
                      : appDetails && appDetails.publicCid 
                      ? '更新资料' 
                      : '提交资料'
                    }
                  </Button>
                  <Button 
                    onClick={() => setCurrent(0)} 
                    disabled={loading}
                    block
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