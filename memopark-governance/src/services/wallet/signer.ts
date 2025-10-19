/**
 * 函数级详细中文注释：钱包签名服务 - 使用本地 Keystore
 * - 不依赖浏览器扩展
 * - 使用 Modal 请求密码输入
 * - 使用本地 sr25519 签名
 */
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import { message, Modal, Input } from 'antd'
import { signAndSendWithLocalKeystore } from '../../lib/polkadot'
import React from 'react'

/**
 * 签名选项
 */
export interface SignOptions {
  onSuccess?: (blockHash: string) => void
  onError?: (error: Error) => void
  onInBlock?: (blockHash: string) => void
  onFinalized?: (blockHash: string) => void
}

/**
 * 函数级详细中文注释：签名并发送交易
 * - 弹窗请求用户输入密码
 * - 使用本地 keystore 签名
 * - 等待交易最终确认
 * 
 * @param address - 账户地址（保留参数兼容性）
 * @param tx - 待签名的交易
 * @param options - 回调选项
 * @returns 区块哈希
 */
export async function signAndSend(
  address: string,  // 显式指定用于签名的地址
  tx: SubmittableExtrinsic<'promise'>,
  options?: SignOptions
): Promise<string> {
  try {
    console.log('[签名] 开始签名交易...')

    // 弹窗请求密码
    const password = await requestPassword()
    if (!password) {
      throw new Error('未输入密码')
    }

    // 显示加载提示
    message.loading({ content: '正在签名并发送交易...', key: 'sign', duration: 0 })

    // 签名并发送
    const blockHash = await signAndSendWithLocalKeystore(address, tx, password)

    // 成功
    message.success({ content: '交易已提交！', key: 'sign', duration: 3 })
    
    // 触发回调
    options?.onSuccess?.(blockHash)
    options?.onFinalized?.(blockHash)

    return blockHash
  } catch (e) {
    const error = e as Error
    console.error('[签名] 失败:', error)
    
    // 显示错误
    message.error({ content: '签名失败：' + error.message, key: 'sign', duration: 5 })
    
    // 触发错误回调
    options?.onError?.(error)
    
    throw error
  }
}

/**
 * 函数级详细中文注释：请求用户输入密码
 * - 使用 Ant Design Modal
 * - 返回 Promise<string | null>
 * - 用户取消返回 null
 */
function requestPassword(): Promise<string | null> {
  return new Promise((resolve) => {
    let inputValue = ''
    let inputElement: any = null

    const handleOk = () => {
      if (inputValue.length >= 8) {
        resolve(inputValue)
      } else {
        message.error('密码至少8位')
        resolve(null)
      }
    }

    const handleCancel = () => {
      resolve(null)
    }

    const modal = Modal.confirm({
      title: '输入钱包密码',
      icon: null,
      width: 400,
      content: React.createElement(
        'div',
        { style: { marginTop: 16 } },
        [
          React.createElement(
            'p',
            { key: 'hint', style: { marginBottom: 12, color: '#666' } },
            '请输入本地钱包密码以完成签名：'
          ),
          React.createElement(Input.Password, {
            key: 'input',
            ref: (el: any) => {
              inputElement = el
            },
            placeholder: '密码（至少8位）',
            size: 'large',
            onChange: (e: any) => {
              inputValue = e.target.value
            },
            onPressEnter: () => {
              modal.destroy()
              handleOk()
            },
            autoFocus: true
          })
        ]
      ),
      okText: '确认签名',
      cancelText: '取消',
      onOk: () => {
        handleOk()
      },
      onCancel: () => {
        handleCancel()
      }
    })

    // 自动聚焦输入框
    setTimeout(() => {
      if (inputElement && inputElement.focus) {
        inputElement.focus()
      }
    }, 100)
  })
}

/**
 * 函数级详细中文注释：批量签名发送
 * - 使用 utility.batchAll 打包多个交易
 * - 原子性：全部成功或全部失败
 */
export async function signAndSendBatch(
  api: any,
  address: string,
  calls: SubmittableExtrinsic<'promise'>[],
  options?: SignOptions
): Promise<string> {
  try {
    console.log('[批量签名] 开始打包', calls.length, '个交易')
    
    const batchTx = api.tx.utility.batchAll(calls)
    
    return await signAndSend(address, batchTx, options)
  } catch (e) {
    const error = e as Error
    console.error('[批量签名] 失败:', error)
    throw error
  }
}
