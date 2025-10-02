import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { message } from 'antd'

/**
 * API Context 接口
 */
interface ApiContextProps {
  api: ApiPromise | null
  isReady: boolean
  isConnecting: boolean
  error: Error | null
}

const ApiContext = createContext<ApiContextProps>({
  api: null,
  isReady: false,
  isConnecting: false,
  error: null
})

/**
 * API Provider组件
 * 管理与区块链节点的连接
 * 参考：Polkadot Staking Dashboard 的 API Provider 模式
 */
export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const initApi = async () => {
      if (isConnecting) return

      setIsConnecting(true)
      
      try {
        // 获取 WebSocket URL
        const wsUrl = import.meta.env.VITE_CHAIN_WS || 'ws://127.0.0.1:9944'
        console.log('[API] 正在连接到:', wsUrl)

        // 创建 Provider
        const provider = new WsProvider(wsUrl)

        // 监听连接事件
        provider.on('connected', () => {
          console.log('[API] WebSocket已连接')
        })

        provider.on('disconnected', () => {
          console.log('[API] WebSocket已断开')
          if (isMounted) {
            message.warning('与链节点的连接已断开')
          }
        })

        provider.on('error', (err) => {
          console.error('[API] WebSocket错误:', err)
          if (isMounted) {
            setError(new Error('WebSocket连接错误'))
          }
        })

        // 创建 API 实例
        const apiInstance = await ApiPromise.create({ provider })

        // 等待 API 就绪
        await apiInstance.isReady

        if (isMounted) {
          setApi(apiInstance)
          setIsReady(true)
          setError(null)
          console.log('[API] ✓ API已就绪')
          message.success('成功连接到区块链节点')
        }
      } catch (e) {
        console.error('[API] ✗ 初始化失败:', e)
        if (isMounted) {
          const err = e as Error
          setError(err)
          message.error('连接失败：' + err.message)
        }
      } finally {
        if (isMounted) {
          setIsConnecting(false)
        }
      }
    }

    initApi()

    // 清理函数
    return () => {
      isMounted = false
      if (api) {
        console.log('[API] 断开API连接')
        api.disconnect().catch(console.error)
      }
    }
  }, [])

  return (
    <ApiContext.Provider
      value={{
        api,
        isReady,
        isConnecting,
        error
      }}
    >
      {children}
    </ApiContext.Provider>
  )
}

/**
 * 使用API的Hook
 */
export const useApi = () => {
  const context = useContext(ApiContext)
  if (!context) {
    throw new Error('useApi must be used within ApiProvider')
  }
  return context
}

export default ApiProvider

