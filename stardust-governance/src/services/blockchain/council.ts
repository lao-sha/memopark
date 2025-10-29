import type { ApiPromise } from '@polkadot/api'

/**
 * 委员会相关服务
 * 参考：Polkadot.js Apps packages/page-council
 */

/**
 * 提案信息接口
 */
export interface ProposalInfo {
  hash: string
  index: number
  threshold: number
  ayes: string[]
  nays: string[]
  end: number
  call: {
    section: string
    method: string
    args: any[]
  } | null
}

/**
 * 获取所有活跃提案
 */
export async function getActiveProposals(api: ApiPromise): Promise<ProposalInfo[]> {
  try {
    // 1. 查询所有提案哈希
    const proposalHashes: any = await api.query.council.proposals()
    const hashesArray = proposalHashes.toJSON() as any[]
    console.log('[Council] 查询到', hashesArray.length, '个提案')

    // 2. 获取每个提案的详细信息
    const proposals: ProposalInfo[] = []

    for (let i = 0; i < hashesArray.length; i++) {
      const hash = proposalHashes[i]
      const hashHex = hash.toHex()

      // 查询投票信息
      const votingOption: any = await api.query.council.voting(hash)

      if (votingOption.isSome) {
        const voting = votingOption.unwrap()
        const votingData = voting.toJSON() as any

        // 查询提案调用内容
        const proposalOption: any = await api.query.council.proposalOf(hash)
        let callInfo = null

        if (proposalOption.isSome) {
          const proposal = proposalOption.unwrap()
          callInfo = {
            section: proposal.section,
            method: proposal.method,
            args: proposal.args.toJSON() as any[]
          }
        }

        proposals.push({
          hash: hashHex,
          index: votingData.index || i,
          threshold: votingData.threshold || 0,
          ayes: votingData.ayes || [],
          nays: votingData.nays || [],
          end: votingData.end || 0,
          call: callInfo
        })
      }
    }

    console.log('[Council] 解析完成', proposals.length, '个提案')
    return proposals

  } catch (e) {
    console.error('[Council] 获取提案失败:', e)
    throw e
  }
}

/**
 * 获取委员会成员列表
 */
export async function getCouncilMembers(api: ApiPromise): Promise<string[]> {
  try {
    const members: any = await api.query.council.members()
    const memberArray = members.toJSON() as any[]
    return memberArray.map((m: any) => m.toString())
  } catch (e) {
    console.error('[Council] 获取成员失败:', e)
    throw e
  }
}

/**
 * 检查地址是否为委员会成员
 */
export async function isCouncilMember(
  api: ApiPromise,
  address: string
): Promise<boolean> {
  try {
    const members = await getCouncilMembers(api)
    return members.includes(address)
  } catch (e) {
    console.error('[Council] 检查成员失败:', e)
    return false
  }
}

/**
 * 创建提案交易
 */
export function createProposeTx(
  api: ApiPromise,
  threshold: number,
  innerCall: any,
  lengthBound: number
) {
  return api.tx.council.propose(threshold, innerCall, lengthBound)
}

/**
 * 创建投票交易
 */
export function createVoteTx(
  api: ApiPromise,
  proposalHash: string,
  index: number,
  approve: boolean
) {
  return api.tx.council.vote(proposalHash, index, approve)
}

/**
 * 创建执行提案交易
 */
export function createCloseTx(
  api: ApiPromise,
  proposalHash: string,
  index: number,
  weightBound: { refTime: number; proofSize: number },
  lengthBound: number
) {
  return api.tx.council.close(proposalHash, index, weightBound, lengthBound)
}

