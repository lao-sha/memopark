import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { web3Enable, web3Accounts, web3AccountsSubscribe } from '@polkadot/extension-dapp'
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types'
import { message } from 'antd'

/**
 * Wallet Context 接口
 */
interface WalletContextProps {
  accounts: InjectedAccountWithMeta[]
  activeAccount: string | null
  isConnected: boolean
  connectWallet: () => Promise<void>
  setActiveAccount: (address: string) => void
  disconnect: () => void
}

const WalletContext = createContext<WalletContextProps | null>(null)

/**
 * Wallet Provider组件
 * 管理浏览器扩展钱包的连接
 * 参考：Polkadot Staking Dashboard 的 Connect Provider
 */
export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([])
  const [activeAccount, setActiveAccount] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  /**
   * 连接钱包扩展
   */
  const connectWallet = useCallback(async () => {
    try {
      console.log('[钱包] 请求连接扩展...')

      // 1. 请求扩展权限
      const extensions = await web3Enable('Memopark Governance')

      if (extensions.length === 0) {
        // 未安装扩展
        message.error({
          content: '未检测到钱包扩展，请安装 Polkadot.js Extension 或 SubWallet',
          duration: 5
        })
        console.log('[钱包] ✗ 未检测到扩展')
        return
      }

      console.log('[钱包] ✓ 检测到', extensions.length, '个扩展')

      // 2. 获取账户列表
      const allAccounts = await web3Accounts()

      if (allAccounts.length === 0) {
        message.warning('扩展中没有账户，请先创建或导入账户')
        console.log('[钱包] ✗ 没有可用账户')
        return
      }

      console.log('[钱包] ✓ 获取到', allAccounts.length, '个账户')
      setAccounts(allAccounts)

      // 3. 自动选择第一个账户
      setActiveAccount(allAccounts[0].address)
      setIsConnected(true)

      message.success('钱包连接成功！')

      // 4. 订阅账户变化
      web3AccountsSubscribe((accounts) => {
        console.log('[钱包] 账户列表更新:', accounts.length)
        setAccounts(accounts)

        // 如果当前选中的账户不在新列表中，自动切换
        if (accounts.length > 0) {
          const currentExists = accounts.some(acc => acc.address === activeAccount)
          if (!currentExists) {
            setActiveAccount(accounts[0].address)
          }
        } else {
          setActiveAccount(null)
          setIsConnected(false)
        }
      })

    } catch (e) {
      const error = e as Error
      console.error('[钱包] ✗ 连接失败:', error)
      message.error('连接失败：' + error.message)
    }
  }, [activeAccount])

  /**
   * 断开钱包连接
   */
  const disconnect = useCallback(() => {
    setAccounts([])
    setActiveAccount(null)
    setIsConnected(false)
    message.info('已断开钱包连接')
    console.log('[钱包] 已断开连接')
  }, [])

  return (
    <WalletContext.Provider
      value={{
        accounts,
        activeAccount,
        isConnected,
        connectWallet,
        setActiveAccount,
        disconnect
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

/**
 * 使用钱包的Hook
 */
export const useWallet = () => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}

export default WalletProvider

