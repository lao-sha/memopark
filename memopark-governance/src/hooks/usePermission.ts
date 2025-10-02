import { useState, useEffect } from 'react'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import type { CommitteeType } from '@/types/committee'

/**
 * 权限接口
 */
export interface Permission {
  // 委员会成员资格
  isCouncilMember: boolean
  isTechnicalMember: boolean
  isContentMember: boolean

  // Root权限
  isRoot: boolean

  // 操作权限检查函数
  canPropose: (committee: CommitteeType) => boolean
  canVote: (committee: CommitteeType) => boolean
  canExecute: boolean
  canApproveAppeal: boolean
  canCancelReferendum: boolean
}

/**
 * 权限Hook
 * 统一的权限检查系统
 */
export function usePermission(): Permission {
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const [permission, setPermission] = useState<Permission>({
    isCouncilMember: false,
    isTechnicalMember: false,
    isContentMember: false,
    isRoot: false,
    canPropose: () => false,
    canVote: () => false,
    canExecute: false,
    canApproveAppeal: false,
    canCancelReferendum: false
  })

  useEffect(() => {
    if (!isReady || !api || !activeAccount) {
      // 未连接钱包时，所有权限为false
      setPermission({
        isCouncilMember: false,
        isTechnicalMember: false,
        isContentMember: false,
        isRoot: false,
        canPropose: () => false,
        canVote: () => false,
        canExecute: false,
        canApproveAppeal: false,
        canCancelReferendum: false
      })
      return
    }

    const checkPermissions = async () => {
      try {
        // 检查各委员会成员资格
        let isCouncil = false
        let isTech = false
        let isContent = false

        // 检查Council成员
        if ((api.query as any).council) {
          const councilMembers: any = await (api.query as any).council.members()
          const councilArray = councilMembers.toJSON() as any[]
          isCouncil = councilArray.includes(activeAccount)
        }

        // 检查Technical Committee成员
        if ((api.query as any).technicalCommittee) {
          const techMembers: any = await (api.query as any).technicalCommittee.members()
          const techArray = techMembers.toJSON() as any[]
          isTech = techArray.includes(activeAccount)
        }

        // 检查Content Committee成员
        if ((api.query as any).contentCommittee) {
          const contentMembers: any = await (api.query as any).contentCommittee.members()
          const contentArray = contentMembers.toJSON() as any[]
          isContent = contentArray.includes(activeAccount)
        }

        // 检查Root权限（简化实现，实际需要查询sudo）
        const isRoot = false  // TODO: 实际查询sudo.key()

        // 构建权限对象
        setPermission({
          isCouncilMember: isCouncil,
          isTechnicalMember: isTech,
          isContentMember: isContent,
          isRoot,

          canPropose: (committee: CommitteeType) => {
            if (committee === 'council') return isCouncil
            if (committee === 'technicalCommittee') return isTech
            if (committee === 'contentCommittee') return isContent
            return false
          },

          canVote: (committee: CommitteeType) => {
            if (committee === 'council') return isCouncil
            if (committee === 'technicalCommittee') return isTech
            if (committee === 'contentCommittee') return isContent
            return false
          },

          canExecute: true,  // 任何人都可以执行已达阈值的提案

          canApproveAppeal: isContent || isRoot,  // 内容委员会或Root

          canCancelReferendum: isRoot  // 只有Root可以取消公投
        })

        console.log('[Permission] 权限检查完成', {
          isCouncil,
          isTech,
          isContent,
          isRoot
        })

      } catch (e) {
        console.error('[Permission] 权限检查失败:', e)
      }
    }

    checkPermissions()
  }, [api, isReady, activeAccount])

  return permission
}

/**
 * 检查是否为任一委员会成员
 */
export function useIsAnyCommitteeMember(): boolean {
  const permission = usePermission()
  return (
    permission.isCouncilMember ||
    permission.isTechnicalMember ||
    permission.isContentMember
  )
}

/**
 * 获取用户所属的委员会列表
 */
export function useMyCommittees(): CommitteeType[] {
  const permission = usePermission()
  const committees: CommitteeType[] = []

  if (permission.isCouncilMember) committees.push('council')
  if (permission.isTechnicalMember) committees.push('technicalCommittee')
  if (permission.isContentMember) committees.push('contentCommittee')

  return committees
}

