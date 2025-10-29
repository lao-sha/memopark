import { mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/keyring'

/**
 * 函数级详细中文注释：派生地址
 * - 基于 sr25519 从助记词派生地址
 * - 返回地址字符串
 */
export async function deriveAddressFromMnemonic(mnemonic: string): Promise<string> {
  await cryptoWaitReady()
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromMnemonic(mnemonic)  // ✅ 修复：使用 addFromMnemonic 而不是 addFromUri
  return pair.address
}

/**
 * 函数级详细中文注释：生成本地钱包（助记词+地址）
 * - 使用安全随机生成助记词
 * - 立即派生地址用于 UI 展示
 */
export async function generateLocalWallet(): Promise<{ mnemonic: string; address: string }> {
  const mnemonic = mnemonicGenerate()
  const address = await deriveAddressFromMnemonic(mnemonic)
  return { mnemonic, address }
}

/**
 * 函数级详细中文注释：使用 PBKDF2 + AES-GCM 加密明文
 * - password：用户口令
 * - data：待加密明文（如助记词）
 * - 返回 base64 编码的密文、盐、iv，便于本地存储
 */
export async function encryptWithPassword(password: string, data: string): Promise<{ ciphertext: string; salt: string; iv: string }> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data)))
  return { ciphertext: btoa(String.fromCharCode(...ciphertext)), salt: btoa(String.fromCharCode(...salt)), iv: btoa(String.fromCharCode(...iv)) }
}

/**
 * 函数级详细中文注释：使用 PBKDF2 + AES-GCM 解密
 * - 返回解密后的明文字符串
 */
export async function decryptWithPassword(password: string, payload: { ciphertext: string; salt: string; iv: string }): Promise<string> {
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  const salt = Uint8Array.from(atob(payload.salt), c => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0))
  const data = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return dec.decode(plain)
}

/**
 * 函数级详细中文注释：保存本地 keystore
 * - 不上传后端，仅保存在浏览器 localStorage
 * - 返回保存的键名，便于后续读取
 */
export function saveLocalKeystore(value: { address: string; ciphertext: string; salt: string; iv: string; createdAt: number }) {
  const key = 'mp.keystore'
  localStorage.setItem(key, JSON.stringify(value))
  return key
}

/**
 * 函数级详细中文注释：读取本地 keystore
 * - 如果不存在，返回 null
 */
export function loadLocalKeystore(): { address: string; ciphertext: string; salt: string; iv: string; createdAt: number } | null {
  const text = localStorage.getItem('mp.keystore')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * 函数级详细中文注释：导出 keystore JSON（下载文件）
 * - 将当前 localStorage 中的 keystore 内容以文件下载，便于备份/迁移
 */
export function exportKeystoreJson(filename: string = 'memopark-keystore.json'): boolean {
  const ks = loadLocalKeystore()
  if (!ks) return false
  const blob = new Blob([JSON.stringify(ks, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

/**
 * 函数级详细中文注释：导入 keystore JSON（从文件）
 * - 读取用户选择的 JSON 文件，验证必要字段后写入 localStorage
 */
export async function importKeystoreJson(file: File): Promise<boolean> {
  const text = await file.text()
  try {
    const data = JSON.parse(text)
    if (!data || !data.ciphertext || !data.salt || !data.iv) return false
    // 允许缺省 address/createdAt（旧格式），运行时可重新推导 address
    const normalized = {
      address: data.address || '',
      ciphertext: String(data.ciphertext),
      salt: String(data.salt),
      iv: String(data.iv),
      createdAt: Number(data.createdAt || Date.now())
    }
    saveLocalKeystore(normalized)
    upsertKeystore(normalized)
    return true
  } catch {
    return false
  }
}

/**
 * 函数级详细中文注释：多账户管理 - 读取/写入/删除
 * - 使用 key: 'mp.keystores' 存放数组，每项为加密 keystore
 * - 使用 key: 'mp.current' 存放当前选中地址
 */
export type LocalKeystore = { address: string; ciphertext: string; salt: string; iv: string; createdAt: number }

export function loadAllKeystores(): LocalKeystore[] {
  try {
    const txt = localStorage.getItem('mp.keystores')
    const list = txt ? JSON.parse(txt) : []
    if (Array.isArray(list)) return list
    return []
  } catch { return [] }
}

/**
 * 函数级详细中文注释：读取/保存地址别名映射
 * - 使用 key: 'mp.aliases' 存储 { [address]: alias }
 * - 别名仅本地生效，便于用户识别
 */
export function loadAliases(): Record<string, string> {
  try {
    const txt = localStorage.getItem('mp.aliases')
    const obj = txt ? JSON.parse(txt) : {}
    return obj && typeof obj === 'object' ? obj : {}
  } catch { return {} }
}

export function setAlias(address: string, alias: string): void {
  const m = loadAliases()
  if (alias) m[address] = alias
  else delete m[address]
  localStorage.setItem('mp.aliases', JSON.stringify(m))
}

export function getAlias(address: string): string {
  const m = loadAliases()
  return m[address] || ''
}

export function upsertKeystore(entry: LocalKeystore): void {
  const list = loadAllKeystores()
  const i = list.findIndex(x => x.address === entry.address)
  if (i >= 0) list[i] = entry
  else list.push(entry)
  localStorage.setItem('mp.keystores', JSON.stringify(list))
  // 同步单账户存储（兼容旧逻辑）
  saveLocalKeystore(entry)
  try { window.dispatchEvent(new Event('mp.accountsUpdate')) } catch {}
}

export function removeKeystore(address: string): void {
  const list = loadAllKeystores().filter(x => x.address !== address)
  localStorage.setItem('mp.keystores', JSON.stringify(list))
  // 删除别名
  const aliases = loadAliases()
  if (aliases[address]) {
    delete aliases[address]
    localStorage.setItem('mp.aliases', JSON.stringify(aliases))
  }
  // 若旧版单账户存储与该地址匹配，一并清除，避免被迁移逻辑重新写回
  try {
    const legacy = loadLocalKeystore()
    if (legacy && legacy.address === address) {
      localStorage.removeItem('mp.keystore')
    }
  } catch {}
  const cur = getCurrentAddress()
  if (cur === address) setCurrentAddress(list[0]?.address || '')
  try { window.dispatchEvent(new Event('mp.accountsUpdate')) } catch {}
}

export function getCurrentAddress(): string | null {
  return localStorage.getItem('mp.current') || null
}

export function setCurrentAddress(address: string): void {
  if (address) localStorage.setItem('mp.current', address)
  else localStorage.removeItem('mp.current')
  try { window.dispatchEvent(new Event('mp.accountsUpdate')) } catch {}
}

/**
 * 函数级详细中文注释：迁移单账户存储到多账户存储
 * - 若存在旧键 'mp.keystore' 且 'mp.keystores' 为空，则将旧值插入列表并设置当前地址
 */
export function migrateSingleToMulti(): void {
  try {
    const list = loadAllKeystores()
    if (list.length > 0) return
    const legacy = loadLocalKeystore()
    if (legacy && legacy.ciphertext && legacy.iv && legacy.salt) {
      upsertKeystore(legacy)
      if (legacy.address) setCurrentAddress(legacy.address)
    }
  } catch {}
}

/**
 * 函数级详细中文注释：按地址导出 keystore JSON
 */
export function exportKeystoreJsonForAddress(address: string, filename?: string): boolean {
  const list = loadAllKeystores()
  const ks = list.find(x => x.address === address)
  if (!ks) return false
  const blob = new Blob([JSON.stringify(ks, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `memopark-keystore-${address.slice(0,6)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

/**
 * 函数级详细中文注释：按地址读取 keystore（多账户列表）
 */
export function loadKeystoreByAddress(address: string | null | undefined): LocalKeystore | null {
  if (!address) return null
  const list = loadAllKeystores()
  const found = list.find(x => x.address === address)
  return found || null
}

/**
 * 函数级详细中文注释：读取“当前账户”的 keystore
 * - 优先从 mp.keystores 中按 mp.current 查找
 * - 兼容单账户存储 mp.keystore
 */
export function loadCurrentKeystore(): LocalKeystore | null {
  const cur = getCurrentAddress()
  const byCur = loadKeystoreByAddress(cur)
  if (byCur) return byCur
  const legacy = loadLocalKeystore()
  return legacy as any
}


