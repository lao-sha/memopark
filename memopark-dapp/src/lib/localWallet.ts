/**
 * 函数级详细中文注释：
 * createLocalWallet
 * - 功能：生成本地助记词与地址（sr25519），用于首次使用时无浏览器扩展账户的场景；
 * - 安全：仅在浏览器内存/本地存储保存明文助记词极不安全；生产必须提示用户离线保存，不自动持久化；
 * - 返回：{ mnemonic, address }；
 */
import { mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/keyring'

export async function createLocalWallet(): Promise<{ mnemonic: string; address: string }>{
  await cryptoWaitReady()
  const mnemonic = mnemonicGenerate(12)
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromMnemonic(mnemonic)
  return { mnemonic, address: pair.address }
}


