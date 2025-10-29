/**
 * 函数级详细中文注释：
 * handshakeWithBackend - 本地签名开发版本
 * - 功能：使用本地 keystore 对挑战签名，供开发/测试环境建立会话；
 * - 安全：生产环境请使用浏览器扩展签名；本地签名仅限开发方便。
 */
import { AppConfig } from './config'
import { SecureHttpClient } from './secureHttpClient'
import { decryptWithPassword, loadLocalKeystore } from './keystore'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/keyring'

export interface HandshakeResult {
  sessionId?: string
  allowances?: any
  error?: string // 规范化错误码
  detail?: any   // 额外调试信息（不显示给终端用户）
}

export async function handshakeWithBackend(address: string): Promise<HandshakeResult | null> {
  try {
    console.log('[handshake] start', { address, backend: AppConfig.backendUrl })
    const challengeUrl = `${AppConfig.backendUrl}/challenge?address=${encodeURIComponent(address)}`
    const challengeResponse = await SecureHttpClient.request(
      challengeUrl,
      {
        method: 'GET',
        requireAuth: false,
        csrfProtection: false
      }
    )
    if (!challengeResponse) {
      console.warn('[handshake] challengeResponse null')
      return { error: 'NETWORK_UNREACHABLE' }
    }
    console.log('[handshake] challenge status', challengeResponse.status)
    if (!challengeResponse.ok) {
      console.warn('[handshake] challenge not ok', challengeResponse.status)
      return { error: 'CHALLENGE_HTTP_' + challengeResponse.status }
    }
    const challenge = await challengeResponse.json().catch((e: any) => { console.warn('[handshake] challenge json parse fail', e); return null })
    console.log('[handshake] challenge json', challenge)
    if (!challenge?.message) {
      console.warn('[handshake] no challenge.message')
      return { error: 'BAD_CHALLENGE_FORMAT', detail: challenge }
    }

    // 使用本地 keystore 进行开发签名
    const ks = loadLocalKeystore()
    if (!ks) return { error: 'NO_LOCAL_KEYSTORE' }
    const pwd = window.prompt('请输入本地钱包密码以签名后端挑战：') || ''
    if (!pwd || pwd.length < 8) return { error: 'SIGN_REJECTED' }
    const mnemonic = await decryptWithPassword(pwd, ks)
    await cryptoWaitReady()
    const keyring = new Keyring({ type: 'sr25519' })
    const pair = keyring.addFromUri(mnemonic)
    if (pair.address !== address) {
      console.warn('[handshake] 地址与本地 keystore 不一致，将以 keystore 地址为准')
      address = pair.address as any
    }
    const messageU8 = new TextEncoder().encode(challenge.message)
    const signatureU8 = pair.sign(messageU8)
    const signature = '0x' + Buffer.from(signatureU8).toString('hex')

    const verifyUrl = `${AppConfig.backendUrl}/verify`
    const verificationData = await SecureHttpClient.post(
      verifyUrl,
      {
        address,
        signature,
        challengeId: challenge.id,
        timestamp: Date.now()
      },
      false
    )
    console.log('[handshake] verify result', verificationData)
    if (!verificationData?.sessionId) {
      console.warn('[handshake] no sessionId in verify result')
      return { error: 'VERIFY_FAILED', detail: verificationData }
    }
    return { sessionId: verificationData.sessionId, allowances: verificationData.allowances }
  } catch (error) {
    console.error('安全握手失败:', error)
    return { error: 'UNEXPECTED_ERROR', detail: String(error) }
  }
}


