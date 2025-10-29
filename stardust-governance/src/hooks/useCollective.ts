import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { getCommitteeConfig, type CommitteeType } from '@/types/committee'
import type { ProposalInfo } from '@/services/blockchain/council'

/**
 * 通用委员会Hook
 * 支持任意委员会实例（Council、Technical、Content）
 */
export function useCollective(committeeType: CommitteeType) {
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const [proposals, setProposals] = useState<ProposalInfo[]>([])
  const [members, setMembers] = useState<string[]>([])
  const [prime, setPrime] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const config = getCommitteeConfig(committeeType)

  /**
   * 加载委员会数据
   */
  const loadData = useCallback(async () => {
    if (!isReady || !api) {
      console.log(`[${config.name}] API未就绪`)
      return
    }

    // 检查pallet是否存在
    if (!(api.query as any)[config.palletName]) {
      console.warn(`[${config.name}] Pallet未配置`)
      setProposals([])
      setMembers([])
      setPrime(null)
      setIsMember(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const pallet = (api.query as any)[config.palletName]

      // 查询提案
      const hashes: any = await pallet.proposals()
      const hashArray = hashes.toJSON() as any[]

      const proposalData: ProposalInfo[] = []

      for (let i = 0; i < hashArray.length; i++) {
        const hash = hashes[i]
        const voting: any = await pallet.voting(hash)

        if (voting.isSome) {
          const votingInfo = voting.unwrap().toJSON() as any
          const proposalOption: any = await pallet.proposalOf(hash)

          let callInfo = null
          if (proposalOption.isSome) {
            const proposal = proposalOption.unwrap()
            callInfo = {
              section: proposal.section,
              method: proposal.method,
              args: proposal.args.toJSON()
            }
          }

          proposalData.push({
            hash: hash.toHex(),
            index: votingInfo.index || i,
            threshold: votingInfo.threshold || 0,
            ayes: votingInfo.ayes || [],
            nays: votingInfo.nays || [],
            end: votingInfo.end || 0,
            call: callInfo
          })
        }
      }

      setProposals(proposalData)
      console.log(`[${config.name}] 查询到 ${proposalData.length} 个提案`)

      // 查询成员
      const memberList: any = await pallet.members()
      const memberArray = memberList.toJSON() as any[]
      setMembers(memberArray)
      console.log(`[${config.name}] 查询到 ${memberArray.length} 个成员`)

      // 查询Prime成员
      try {
        const primeOption: any = await pallet.prime()
        if (primeOption && primeOption.isSome) {
          const primeAddr = primeOption.unwrap().toString()
          setPrime(primeAddr)
        } else {
          setPrime(null)
        }
      } catch (e) {
        // Prime可能不存在
        setPrime(null)
      }

      // 检查当前账户是否为成员
      if (activeAccount) {
        setIsMember(memberArray.includes(activeAccount))
      } else {
        setIsMember(false)
      }

    } catch (e) {
      const error = e as Error
      console.error(`[${config.name}] 加载失败:`, error)
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [api, isReady, committeeType, activeAccount, config])

  /**
   * 初始加载
   */
  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    proposals,
    members,
    prime,
    isMember,
    loading,
    error,
    config,
    reload: loadData,
    memberCount: members.length,
    proposalCount: proposals.length
  }
}

/**
 * 获取所有委员会的汇总数据
 */
export function useAllCollectives() {
  const council = useCollective('council')
  const technical = useCollective('technicalCommittee')
  const content = useCollective('contentCommittee')

  return {
    council,
    technical,
    content,
    totalMembers: council.memberCount + technical.memberCount + content.memberCount,
    totalProposals: council.proposalCount + technical.proposalCount + content.proposalCount,
    loading: council.loading || technical.loading || content.loading
  }
}

