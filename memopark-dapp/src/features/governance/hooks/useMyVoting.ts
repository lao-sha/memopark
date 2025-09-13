import { useEffect, useState } from 'react'
import { getApi } from '../../../lib/polkadot-safe'
import { fetchMyVoting, fetchMyProposals } from '../lib/governance'

/**
 * 函数级详细中文注释：我的治理信息 Hook（占位实现）
 * - 返回我投过的票、锁仓与可解锁项摘要；当前为模拟数据
 */
export interface MyVoteItem { referendumId: number; track: number; aye: boolean; conviction: number; amount: string }
export interface MyLockItem { until: number; amount: string }
export interface MyProposalItem { id: number; title: string; track: number; status: 'Deciding' | 'Approved' | 'Rejected' | 'Cancelled' | 'TimedOut'; submittedAt?: number; referendumId?: number }

export function useMyVoting(address?: string) {
  const [loading, setLoading] = useState(!!address)
  const [error, setError] = useState<string | null>(null)
  const [votes, setVotes] = useState<MyVoteItem[]>([])
  const [locks, setLocks] = useState<MyLockItem[]>([])

  useEffect(() => {
    if (!address) return
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { votes, locks } = await fetchMyVoting(address)
        setVotes(votes)
        setLocks(locks)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [address])

  return { loading, error, votes, locks }
}

/**
 * 函数级详细中文注释：查询“我发起的提案” Hook（占位）
 * - 优先读取本地历史中 referenda.submit 由我发起的记录
 * - 回退显示最近链上项作为占位
 */
export function useMyProposals(address?: string) {
  const [loading, setLoading] = useState(!!address)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<MyProposalItem[]>([])

  useEffect(() => {
    if (!address) return
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await fetchMyProposals(address as string)
        setItems(list)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
    // 监听本地交易历史更新，自动刷新“我的提案”
    function onTxUpdate() {
      fetchMyProposals(address as string).then(setItems).catch(()=>{})
    }
    window.addEventListener('mp.txUpdate', onTxUpdate)
    return () => window.removeEventListener('mp.txUpdate', onTxUpdate)
  }, [address])

  return { loading, error, items }
}


