/**
 * 函数级详细中文注释：Wallet Context - 使用本地 Keystore
 * - 不依赖浏览器扩展
 * - 从 localStorage 读取加密的 keystore
 * - 与 memopark-dapp 共享同一套账户体系
 */
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react'
import { message } from 'antd'
import { 
  loadLocalKeystore,
  getCurrentAddress,
  setCurrentAddress,
  loadAllKeystores
} from '../../lib/keystore'
import { queryBalance } from '../../lib/polkadot'

/**
 * Wallet Context 接口
 */
interface WalletContextProps {
  accounts: string[]  // 账户地址列表
  activeAccount: string | null  // 当前选中的账户
  balance: string  // 当前账户余额（格式化后）
  isConnected: boolean  // 是否已连接（即是否有 keystore）
  setActiveAccount: (address: string) => void
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextProps | null>(null)

/**
 * 函数级详细中文注释：Wallet Provider组件
 * - 管理本地 keystore 钱包
 * - 与用户端共享 localStorage
 * - 支持跨标签页同步
 */
export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<string[]>([])
  const [activeAccount, setActiveAccountState] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>('0.0000')
  const [isConnected, setIsConnected] = useState(false)

  /**
   * 函数级详细中文注释：初始化钱包
   * - 加载本地 keystore
   * - 加载当前选中的账户
   * - 查询余额
   */
  const initWallet = useCallback(() => {
    try {
      console.log('[钱包] 初始化...')

      // 加载所有账户
      const allKeystores = loadAllKeystores()
      const allAccounts = allKeystores.map(ks => ks.address)
      
      if (allAccounts.length > 0) {
        console.log('[钱包] 找到', allAccounts.length, '个账户')
        setAccounts(allAccounts)
        setIsConnected(true)

        // 加载当前选中的账户
        const currentAddr = getCurrentAddress()
        if (currentAddr && allAccounts.includes(currentAddr)) {
          console.log('[钱包] 当前账户:', currentAddr)
          setActiveAccountState(currentAddr)
          // 异步加载余额
          refreshBalanceInternal(currentAddr).catch(console.error)
        } else {
          // 默认选中第一个账户
          console.log('[钱包] 默认选中第一个账户')
          setActiveAccountState(allAccounts[0])
          refreshBalanceInternal(allAccounts[0]).catch(console.error)
        }
      } else {
        console.log('[钱包] 未找到本地 keystore')
        setIsConnected(false)
      }
    } catch (e) {
      console.error('[钱包] 初始化失败:', e)
      setIsConnected(false)
    }
  }, [])

  /**
   * 函数级详细中文注释：初始化和监听存储变化
   */
  useEffect(() => {
    initWallet()

    // 监听 storage 事件（跨标签页同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mp.keystores' || e.key === 'mp.current' || e.key === 'mp.keystore') {
        console.log('[钱包] 检测到 keystore 变化，重新加载')
        initWallet()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [initWallet])

  /**
   * 函数级详细中文注释：刷新余额（内部方法）
   */
  const refreshBalanceInternal = async (address: string) => {
    try {
      const balanceData = await queryBalance(address)
      const formatted = formatBalance(balanceData.free, 12)
      setBalance(formatted)
      console.log('[钱包] 余额:', formatted, 'MEMO')
    } catch (e) {
      console.error('[钱包] 查询余额失败:', e)
      // 失败时不显示错误，保持旧值
    }
  }

  /**
   * 函数级详细中文注释：刷新余额（公开方法）
   */
  const refreshBalance = useCallback(async () => {
    if (activeAccount) {
      await refreshBalanceInternal(activeAccount)
    }
  }, [activeAccount])

  /**
   * 函数级详细中文注释：切换账户
   */
  const setActiveAccount = useCallback((address: string) => {
    try {
      setCurrentAddress(address)
      setActiveAccountState(address)
      refreshBalanceInternal(address).catch(console.error)
      message.success('账户已切换')
      console.log('[钱包] 切换到:', address)
    } catch (e) {
      console.error('[钱包] 切换账户失败:', e)
      message.error('切换账户失败：' + (e as Error).message)
    }
  }, [])

  return (
    <WalletContext.Provider
      value={{
        accounts,
        activeAccount,
        balance,
        isConnected,
        setActiveAccount,
        refreshBalance
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

/**
 * 函数级详细中文注释：使用钱包的Hook
 */
export const useWallet = () => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}

export default WalletProvider

/**
 * 函数级详细中文注释：格式化余额
 * - 12位小数，显示前4位
 */
function formatBalance(amount: string, decimals: number = 12): string {
  try {
    const value = BigInt(amount)
    const divisor = BigInt(10 ** decimals)
    const intPart = value / divisor
    const decPart = value % divisor
    const decStr = decPart.toString().padStart(decimals, '0').slice(0, 4)
    return `${intPart}.${decStr}`
  } catch (e) {
    console.error('[格式化] 余额格式化失败:', e)
    return '0.0000'
  }
}
