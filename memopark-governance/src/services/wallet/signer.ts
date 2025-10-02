import { web3FromAddress } from '@polkadot/extension-dapp'
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import { message } from 'antd'

/**
 * 钱包签名服务
 * 参考：Polkadot Staking Dashboard 签名模式
 */

export interface SignOptions {
  onSuccess?: (blockHash: string) => void
  onError?: (error: Error) => void
  onInBlock?: (blockHash: string) => void
  onFinalized?: (blockHash: string) => void
}

/**
 * 签名并发送交易
 */
export async function signAndSend(
  address: string,
  tx: SubmittableExtrinsic<'promise'>,
  options?: SignOptions
): Promise<string> {
  try {
    console.log('[签名] 开始签名交易...')

    // 获取签名器
    const injector = await web3FromAddress(address)

    return new Promise((resolve, reject) => {
      let unsub: () => void

      tx.signAndSend(
        address,
        { signer: injector.signer },
        (result) => {
          console.log('[交易状态]', result.status.type)

          if (result.status.isInBlock) {
            const blockHash = result.status.asInBlock.toHex()
            console.log('✓ 交易已打包进区块:', blockHash)
            options?.onInBlock?.(blockHash)
          }

          if (result.status.isFinalized) {
            const blockHash = result.status.asFinalized.toHex()
            console.log('✓ 交易已最终确认:', blockHash)

            // 检查交易结果
            const success = result.events.some(
              ({ event }) =>
                event.section === 'system' && event.method === 'ExtrinsicSuccess'
            )

            if (success) {
              console.log('✓ 交易执行成功')
              options?.onSuccess?.(blockHash)
              options?.onFinalized?.(blockHash)
              resolve(blockHash)
            } else {
              // 查找错误
              const errorEvent = result.events.find(
                ({ event }) =>
                  event.section === 'system' && event.method === 'ExtrinsicFailed'
              )

              let errorMsg = '交易执行失败'
              if (errorEvent) {
                const errorData = errorEvent.event.data.toString()
                errorMsg = `交易失败: ${errorData}`
              }

              const error = new Error(errorMsg)
              console.error('✗ 交易失败:', errorMsg)
              options?.onError?.(error)
              reject(error)
            }

            if (unsub) unsub()
          }

          if (result.isError) {
            const error = new Error('交易错误')
            console.error('✗ 交易错误')
            options?.onError?.(error)
            reject(error)
            if (unsub) unsub()
          }
        }
      )
        .then((unsubscribe) => {
          unsub = unsubscribe
        })
        .catch((error) => {
          console.error('[签名] 签名失败:', error)
          reject(error)
        })
    })

  } catch (e) {
    const error = e as Error
    console.error('[签名] 失败:', error)
    message.error('签名失败：' + error.message)
    throw error
  }
}

/**
 * 批量签名发送
 */
export async function signAndSendBatch(
  api: any,
  address: string,
  calls: SubmittableExtrinsic<'promise'>[],
  options?: SignOptions
): Promise<string> {
  try {
    const batchTx = api.tx.utility.batchAll(calls)
    return await signAndSend(address, batchTx, options)
  } catch (e) {
    const error = e as Error
    console.error('[批量签名] 失败:', error)
    throw error
  }
}

