/**
 * 函数级详细中文注释：@polkadot/api 连接助手
 * - 提供全局惰性连接与简单的 extrinsic 发送函数（非代付直发）。
 */
import { ApiPromise, WsProvider } from '@polkadot/api'
import { web3Enable, web3FromAddress } from '@polkadot/extension-dapp'
import { AppConfig } from './config'

let api: ApiPromise | null = null

export async function getApi(): Promise<ApiPromise> {
  if (api && api.isConnected) return api
  const provider = new WsProvider(AppConfig.wsEndpoint)
  api = await ApiPromise.create({ provider })
  return api
}

/**
 * 函数级中文注释：使用浏览器扩展签名并发送交易（非代付直发）。
 * - address：签名账户
 * - section/method/args：调用描述
 */
export async function signAndSend(address: string, section: string, method: string, args: any[]): Promise<string> {
  await web3Enable('memopark-dapp')
  const injector = await web3FromAddress(address)
  const api = await getApi()
  // @ts-ignore
  const call = (api.tx as any)[section]?.[method]
  if (!call) throw new Error(`未知调用: ${section}.${method}`)
  const tx = call(...args)
  return new Promise((resolve, reject) => {
    tx.signAndSend(address, { signer: injector.signer }, ({ status, dispatchError }) => {
      if (dispatchError) {
        reject(dispatchError.toString())
      } else if (status.isInBlock || status.isFinalized) {
        resolve(status.asInBlock?.toString() || status.asFinalized?.toString())
      }
    }).catch(reject)
  })
}


