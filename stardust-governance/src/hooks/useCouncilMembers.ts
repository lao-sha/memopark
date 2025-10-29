import { useState, useEffect } from 'react'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { getCouncilMembers } from '@/services/blockchain/council'

/**
 * 委员会成员Hook
 * 管理成员列表和权限检查
 */
export function useCouncilMembers() {
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const [members, setMembers] = useState<string[]>([])
  const [isCurrentMember, setIsCurrentMember] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isReady || !api) return

    const loadMembers = async () => {
      setLoading(true)
      try {
        const memberList = await getCouncilMembers(api)
        setMembers(memberList)

        // 检查当前账户是否为成员
        if (activeAccount) {
          const isMember = memberList.includes(activeAccount)
          setIsCurrentMember(isMember)
        } else {
          setIsCurrentMember(false)
        }
      } catch (e) {
        console.error('[useCouncilMembers] 加载失败:', e)
      } finally {
        setLoading(false)
      }
    }

    loadMembers()
  }, [api, isReady, activeAccount])

  return {
    members,
    isCurrentMember,
    loading,
    memberCount: members.length
  }
}

