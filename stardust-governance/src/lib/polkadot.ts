/**
 * 函数级详细中文注释：Polkadot API 连接和签名服务
 * - 使用本地 keystore 签名，不依赖浏览器扩展
 * - 与 memopark-dapp 保持一致
 */
import { ApiPromise, WsProvider } from '@polkadot/api'
import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { decryptWithPassword, loadKeystoreByAddress } from './keystore'
import type { SubmittableExtrinsic } from '@polkadot/api/types'

let api: ApiPromise | null = null
let isConnecting = false

/**
 * 函数级详细中文注释：获取全局 API 实例
 */
export async function getApi(): Promise<ApiPromise> {
  if (api && api.isConnected) return api
  
  if (isConnecting) {
    while (isConnecting) {
      await new Promise(r => setTimeout(r, 100))
    }
    if (api && api.isConnected) return api
  }

  try {
    isConnecting = true
    const endpoint = import.meta.env.VITE_CHAIN_WS || 'ws://127.0.0.1:9944'
    console.log('[API] 正在连接:', endpoint)

    const provider = new WsProvider(endpoint, 1000)
    
    const connectPromise = ApiPromise.create({
      provider,
      throwOnConnect: true,
      noInitWarn: true
    })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('连接超时（30秒）')), 30000)
    )

    api = await Promise.race([connectPromise, timeout])

    api.on('disconnected', () => {
      console.warn('[API] 连接已断开，下次调用将重连')
      api = null
    })

    api.on('error', (error) => {
      console.error('[API] 错误:', error)
    })

    console.log('[API] 连接成功')
    return api
  } catch (error) {
    console.error('[API] 连接失败:', error)
    throw error instanceof Error ? error : new Error('连接失败')
  } finally {
    isConnecting = false
  }
}

/**
 * 函数级详细中文注释：使用本地 keystore 签名并发送交易
 */
export async function signAndSendWithLocalKeystore(
  address: string,
  tx: SubmittableExtrinsic<'promise'>,
  password: string
): Promise<string> {
  try {
    const ks = loadKeystoreByAddress(address)
    if (!ks) {
      throw new Error('未找到指定地址的钱包，请在“钱包管理”中恢复该地址')
    }

    const mnemonic = await decryptWithPassword(password, ks)

    await cryptoWaitReady()
    const keyring = new Keyring({ type: 'sr25519' })
    const pair = keyring.addFromMnemonic(mnemonic)  // ✅ 使用助记词派生签名密钥

    if (pair.address !== address) {
      throw new Error(
        `地址不匹配：目标账户是 ${address.slice(0, 10)}...，` +
        `但 keystore 解密出的是 ${pair.address.slice(0, 10)}...`
      )
    }

    const hash = await new Promise<string>((resolve, reject) => {
      tx.signAndSend(pair, ({ status, dispatchError }: any) => {
        console.log('[交易状态]', status.type)

        if (status.isInBlock) {
          console.log('✓ 交易已打包进区块:', status.asInBlock.toHex())
        }

        if (status.isFinalized) {
          console.log('✓ 交易已最终确认:', status.asFinalized.toHex())

          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = (tx.registry as any).findMetaError(dispatchError.asModule)
              const { docs, name, section } = decoded
              reject(new Error(`${section}.${name}: ${docs.join(' ')}`))
            } else {
              reject(new Error(dispatchError.toString()))
            }
          } else {
            resolve(status.asFinalized.toHex())
          }
        }
      }).catch(reject)
    })

    return hash
  } catch (error) {
    console.error('[签名] 失败:', error)
    throw error instanceof Error ? error : new Error(String(error))
  }
}

/**
 * 函数级详细中文注释：查询账户余额
 */
export async function queryBalance(address: string): Promise<{
  free: string
  reserved: string
  frozen: string
  total: string
}> {
  try {
    const api = await getApi()
    const accountInfo: any = await api.query.system.account(address)
    
    return {
      free: accountInfo.data.free.toString(),
      reserved: accountInfo.data.reserved.toString(),
      frozen: accountInfo.data.frozen.toString(),
      total: accountInfo.data.free.add(accountInfo.data.reserved).toString()
    }
  } catch (error) {
    console.error('[查询余额] 失败:', error)
    throw error
  }
}

/**
 * 函数级详细中文注释：格式化余额
 */
export function formatBalance(amount: string | bigint, decimals: number = 12): string {
  const value = BigInt(amount)
  const divisor = BigInt(10 ** decimals)
  const intPart = value / divisor
  const decPart = value % divisor
  
  const decStr = decPart.toString().padStart(decimals, '0').slice(0, 4)
  return `${intPart}.${decStr}`
}

