import React from 'react'

/**
 * 函数级详细中文注释：治理 UI 全局上下文（专家/治理模式）
 * - 提供是否显示对象旁治理入口（申诉/恢复）等全局开关
 * - 通过 localStorage 持久化，刷新后仍然生效
 */
export type GovernanceUiState = {
  showEntries: boolean
  hoverOnly: boolean
  showRestoreShortcut: boolean
  setShowEntries: (v: boolean)=>void
  setHoverOnly: (v: boolean)=>void
  setShowRestoreShortcut: (v: boolean)=>void
}

const Ctx = React.createContext<GovernanceUiState | null>(null)

const LS_SHOW = 'mp.governance.showEntries'
const LS_HOVER = 'mp.governance.hoverOnly'
const LS_RESTORE = 'mp.governance.showRestoreEntry'

export const GovernanceUiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showEntries, setShowEntries] = React.useState<boolean>(() => { try { return localStorage.getItem(LS_SHOW) === 'true' } catch { return false } })
  const [hoverOnly, setHoverOnly] = React.useState<boolean>(() => { try { return localStorage.getItem(LS_HOVER) === 'true' } catch { return false } })
  const [showRestoreShortcut, setShowRestoreShortcut] = React.useState<boolean>(() => { try { return localStorage.getItem(LS_RESTORE) === 'true' } catch { return false } })

  const setShowEntriesWrapped = (v: boolean) => { try { localStorage.setItem(LS_SHOW, String(v)) } catch {}; setShowEntries(v) }
  const setHoverOnlyWrapped = (v: boolean) => { try { localStorage.setItem(LS_HOVER, String(v)) } catch {}; setHoverOnly(v) }
  const setShowRestoreShortcutWrapped = (v: boolean) => { try { localStorage.setItem(LS_RESTORE, String(v)) } catch {}; setShowRestoreShortcut(v) }

  const value: GovernanceUiState = {
    showEntries,
    hoverOnly,
    showRestoreShortcut,
    setShowEntries: setShowEntriesWrapped,
    setHoverOnly: setHoverOnlyWrapped,
    setShowRestoreShortcut: setShowRestoreShortcutWrapped,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGovernanceUi() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('GovernanceUiProvider missing')
  return v
}
