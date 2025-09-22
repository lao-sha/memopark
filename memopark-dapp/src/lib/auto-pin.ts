import { submitPinForDeceased } from './ipfs-billing'

/**
 * 函数级详细中文注释：全局“自动 Pin”初始化
 * - 监听 window 上的 CustomEvent<'mp.contentSaved'> 事件，payload 携带 subjectId/cid/size/replicas/price
 * - 收到后自动调用 submitPinForDeceased，将该 CID 纳入 (domain=1, subject_id) 的统一计费
 * - 幂等：同一会话内避免对同一 (subjectId,cid) 重复提交
 * - 开关：localStorage('mp.autoPin.enabled') === 'false' 则禁用
 */
export function initAutoPinOnce(): void {
  if (typeof window === 'undefined') return
  const KEY = '__mp_auto_pin_installed__'
  if ((window as any)[KEY]) return
  ;(window as any)[KEY] = true

  const processed = new Set<string>()
  const handler = async (ev: Event) => {
    try {
      const enabled = (() => { try { return localStorage.getItem('mp.autoPin.enabled') !== 'false' } catch { return true } })()
      if (!enabled) return
      const e = ev as CustomEvent<{ subjectId: number; cid: string; sizeBytes?: number; replicas?: number; price?: string }>
      const sid = Number(e.detail?.subjectId)
      const cid = String(e.detail?.cid || '').trim()
      if (!sid || !cid) return
      const key = `${sid}::${cid}`
      if (processed.has(key)) return
      processed.add(key)
      const size = Number(e.detail?.sizeBytes || 0)
      const replicas = Number(e.detail?.replicas || 1)
      const price = String(e.detail?.price || '0')
      await submitPinForDeceased(sid, cid, size, replicas, price)
      // 可选：派发完成事件，便于页面提示
      try { window.dispatchEvent(new CustomEvent('mp.contentPinned', { detail: { subjectId: sid, cid } })) } catch {}
    } catch {}
  }
  window.addEventListener('mp.contentSaved', handler as EventListener)
}

/**
 * 函数级详细中文注释：便捷派发函数——在“上传/保存成功”后调用即可
 * - subjectId：逝者ID；cid：明文 CID；其余参数可选
 */
export function notifyContentSaved(subjectId: number, cid: string, opts?: { sizeBytes?: number; replicas?: number; price?: string }) {
  try {
    const detail = { subjectId, cid, sizeBytes: opts?.sizeBytes, replicas: opts?.replicas, price: opts?.price }
    window.dispatchEvent(new CustomEvent('mp.contentSaved', { detail }))
  } catch {}
}
