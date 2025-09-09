/**
 * 函数级详细中文注释：本地交易历史工具
 * - 仅在前端本地存储 tx hash 与简单元信息，避免隐私泄露
 * - 提供 append/load/clear API，并在新增时广播 'mp.txUpdate' 事件
 */

export type TxRecord = {
  hash: string
  section?: string
  method?: string
  args?: any
  timestamp: number
  from?: string
}

const KEY = 'mp.txhistory'

export function loadTxHistory(): TxRecord[] {
  try {
    const t = localStorage.getItem(KEY)
    const arr = t ? JSON.parse(t) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export function appendTx(rec: TxRecord): void {
  const list = loadTxHistory()
  list.unshift(rec)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)))
  window.dispatchEvent(new Event('mp.txUpdate'))
}

export function clearTxHistory(): void {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event('mp.txUpdate'))
}


