import { useState, useEffect } from 'react'
import { getApi } from '../lib/polkadot-safe'
import { hexToU8a, stringToU8a, u8aConcat } from '@polkadot/util'
import { blake2AsU8a, encodeAddress } from '@polkadot/util-crypto'

/**
 * 函数级详细中文注释：三重扣款余额检查 Hook
 * 
 * 功能：
 * - 检查 IpfsPoolAccount、SubjectFunding、Caller 三个账户的余额
 * - 计算配额使用情况
 * - 智能判断扣款来源并给出提示
 * 
 * 扣款优先级：
 * 1. IpfsPoolAccount（配额内优先，公共福利）
 * 2. SubjectFunding（逝者专属资金，推荐）
 * 3. Caller（fallback，自费模式）
 * 
 * 返回值：
 * - source: 'pool' | 'subject' | 'caller' | 'insufficient' - 扣款来源
 * - message: string - 智能提示信息
 * - color: string - UI 颜色提示
 * - suggestion: string - 建议操作
 * - showChargeButton: boolean - 是否显示充值按钮
 * - subjectFundingAddress: string - SubjectFunding 地址
 * - balances: { pool, subject, caller } - 三个账户余额
 * - quota: { used, remaining, total } - 配额信息
 */

export interface TripleChargeCheckResult {
  source: 'pool' | 'subject' | 'caller' | 'insufficient'
  message: string
  color: 'green' | 'blue' | 'orange' | 'red'
  suggestion?: string
  showChargeButton: boolean
  subjectFundingAddress: string
  balances: {
    pool: bigint
    subject: bigint
    caller: bigint
  }
  quota: {
    used: bigint
    remaining: bigint
    total: bigint
    resetBlock: bigint
  }
  loading: boolean
  error?: string
}

export function useTripleChargeCheck(
  deceasedId: number | null,
  callerAddress: string | null,
  amount: bigint | null
): TripleChargeCheckResult {
  const [result, setResult] = useState<TripleChargeCheckResult>({
    source: 'insufficient',
    message: '正在检查余额...',
    color: 'blue',
    showChargeButton: false,
    subjectFundingAddress: '',
    balances: {
      pool: 0n,
      subject: 0n,
      caller: 0n,
    },
    quota: {
      used: 0n,
      remaining: 0n,
      total: 0n,
      resetBlock: 0n,
    },
    loading: true,
  })

  useEffect(() => {
    if (!deceasedId || !callerAddress || !amount) {
      setResult(prev => ({
        ...prev,
        loading: false,
        message: '请填写完整信息',
        color: 'blue',
      }))
      return
    }

    let cancelled = false

    async function check() {
      try {
        const api = await getApi()
        
        // ========================================
        // 步骤 1: 获取配置和地址
        // ========================================
        
        const consts: any = (api.consts as any)
        const sec = ['memoIpfs', 'memo_ipfs', 'ipfs'].find(s => consts[s]) || 'memoIpfs'
        
        // IpfsPoolAccount 地址
        const poolPalletIdHex = consts[sec]?.ipfsPoolPalletId?.toString?.() || ''
        const poolPalletIdU8a = poolPalletIdHex && poolPalletIdHex.startsWith('0x')
          ? hexToU8a(poolPalletIdHex)
          : stringToU8a('py/ipfs+')
        const poolData = u8aConcat(stringToU8a('modl'), poolPalletIdU8a, new Uint8Array(24).fill(0))
        const poolHash = blake2AsU8a(poolData, 256)
        const poolAddress = encodeAddress(poolHash, 42)
        
        // SubjectFunding 地址
        const pidHex = consts[sec]?.subjectPalletId?.toString?.() || ''
        const domain = consts[sec]?.deceasedDomain?.toNumber?.() ?? 1
        const pidU8a = pidHex && pidHex.startsWith('0x') ? hexToU8a(pidHex) : stringToU8a('ipfs/sub')
        const domU8a = api.createType('u8', domain).toU8a()
        const sidU8a = api.createType('u64', deceasedId).toU8a()
        const subjectData = u8aConcat(stringToU8a('modl'), pidU8a, domU8a, sidU8a)
        const subjectHash = blake2AsU8a(subjectData, 256)
        const subjectAddress = encodeAddress(subjectHash, 42)
        
        // ========================================
        // 步骤 2: 查询余额
        // ========================================
        
        const [poolBalanceData, subjectBalanceData, callerBalanceData] = await Promise.all([
          api.query.system.account(poolAddress),
          api.query.system.account(subjectAddress),
          api.query.system.account(callerAddress),
        ])
        
        const poolBalance = BigInt(poolBalanceData.data.free.toString())
        const subjectBalance = BigInt(subjectBalanceData.data.free.toString())
        const callerBalance = BigInt(callerBalanceData.data.free.toString())
        
        // ========================================
        // 步骤 3: 查询配额
        // ========================================
        
        const monthlyQuota = BigInt(consts[sec]?.monthlyPublicFeeQuota?.toString?.() || '100000000000000') // 100 DUST
        
        const query: any = api.query
        const quotaData = await query[sec]?.publicFeeQuotaUsage?.(deceasedId)
        
        let usedQuota = 0n
        let resetBlock = 0n
        
        if (quotaData && !quotaData.isEmpty) {
          const tuple = quotaData.toJSON() as [string, number]
          usedQuota = BigInt(tuple[0] || 0)
          resetBlock = BigInt(tuple[1] || 0)
        }
        
        const remainingQuota = monthlyQuota > usedQuota ? monthlyQuota - usedQuota : 0n
        
        if (cancelled) return
        
        // ========================================
        // 步骤 4: 判断扣款来源并生成提示
        // ========================================
        
        const amountBig = BigInt(amount)
        
        // 判断 1: IpfsPool（配额内 + 余额充足）
        if (remainingQuota >= amountBig && poolBalance >= amountBig) {
          setResult({
            source: 'pool',
            message: '✅ 本次 pin 将使用公共配额（免费）',
            color: 'green',
            suggestion: `剩余配额：${formatMEMO(remainingQuota)}，本次消耗：${formatMEMO(amountBig)}`,
            showChargeButton: false,
            subjectFundingAddress: subjectAddress,
            balances: {
              pool: poolBalance,
              subject: subjectBalance,
              caller: callerBalance,
            },
            quota: {
              used: usedQuota,
              remaining: remainingQuota,
              total: monthlyQuota,
              resetBlock,
            },
            loading: false,
          })
          return
        }
        
        // 判断 2: SubjectFunding（余额充足）
        if (subjectBalance >= amountBig) {
          setResult({
            source: 'subject',
            message: '💰 本次 pin 将从逝者专属资金扣款',
            color: 'blue',
            suggestion: remainingQuota < amountBig
              ? `配额不足（剩余：${formatMEMO(remainingQuota)}），将使用专属资金`
              : `公共池余额不足，将使用专属资金`,
            showChargeButton: false,
            subjectFundingAddress: subjectAddress,
            balances: {
              pool: poolBalance,
              subject: subjectBalance,
              caller: callerBalance,
            },
            quota: {
              used: usedQuota,
              remaining: remainingQuota,
              total: monthlyQuota,
              resetBlock,
            },
            loading: false,
          })
          return
        }
        
        // 判断 3: Caller（fallback，自费）
        if (callerBalance >= amountBig) {
          setResult({
            source: 'caller',
            message: '⚠️ 本次 pin 将从您的账户扣款（自费）',
            color: 'orange',
            suggestion: '💡 建议充值到逝者专属资金账户，可享受配额优惠',
            showChargeButton: true,
            subjectFundingAddress: subjectAddress,
            balances: {
              pool: poolBalance,
              subject: subjectBalance,
              caller: callerBalance,
            },
            quota: {
              used: usedQuota,
              remaining: remainingQuota,
              total: monthlyQuota,
              resetBlock,
            },
            loading: false,
          })
          return
        }
        
        // 判断 4: 所有账户都不足
        setResult({
          source: 'insufficient',
          message: '❌ 余额不足，无法完成 pin 请求',
          color: 'red',
          suggestion: `需要 ${formatMEMO(amountBig)}，但所有账户余额都不足`,
          showChargeButton: true,
          subjectFundingAddress: subjectAddress,
          balances: {
            pool: poolBalance,
            subject: subjectBalance,
            caller: callerBalance,
          },
          quota: {
            used: usedQuota,
            remaining: remainingQuota,
            total: monthlyQuota,
            resetBlock,
          },
          loading: false,
        })
      } catch (e: any) {
        if (cancelled) return
        setResult(prev => ({
          ...prev,
          loading: false,
          error: e?.message || '查询失败',
          message: '⚠️ 余额查询失败',
          color: 'red',
        }))
      }
    }

    check()

    return () => {
      cancelled = true
    }
  }, [deceasedId, callerAddress, amount])

  return result
}

/**
 * 函数级中文注释：格式化 DUST 金额
 * 
 * 将最小单位转换为 DUST（除以 10^12）
 */
function formatMEMO(amount: bigint): string {
  const UNIT = 1000000000000n // 10^12
  const whole = amount / UNIT
  const frac = amount % UNIT
  if (frac === 0n) {
    return `${whole} DUST`
  }
  const fracStr = frac.toString().padStart(12, '0').slice(0, 4) // 保留 4 位小数
  return `${whole}.${fracStr} DUST`
}

