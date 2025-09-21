import { create } from 'zustand'

/**
 * 函数级详细中文注释：治理全局状态（Zustand）
 * - 保存当前选中的公投ID，便于列表与详情页之间解耦传参
 * - 通过 setReferendumId 更新，传入 undefined 可清空
 */
export interface GovernanceState {
  currentReferendumId?: number
  setReferendumId: (id?: number) => void
}

export const useGovernanceStore = create<GovernanceState>((set) => ({
  currentReferendumId: undefined,
  setReferendumId: (id?: number) => set({ currentReferendumId: id })
}))

/**
 * 函数级详细中文注释：从 URL 哈希同步公投ID
 * - 约定格式：#gov/{id}
 * - 提供初始化函数与监听函数，供页面在挂载时调用
 */
export function syncReferendumIdFromHash(setId: (id?: number) => void) {
  try {
    const m = window.location.hash.match(/#gov\/(\d+)/)
    if (m && m[1]) {
      const id = parseInt(m[1])
      if (!Number.isNaN(id)) setId(id)
    }
  } catch {}
}

export function listenHashChange(setId: (id?: number) => void) {
  function onHash() {
    syncReferendumIdFromHash(setId)
  }
  window.addEventListener('hashchange', onHash)
  return () => window.removeEventListener('hashchange', onHash)
}


