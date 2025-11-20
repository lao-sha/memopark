/**
 * useAccountPermissions Hook
 *
 * 功能说明：
 * 1. 检查账户是否拥有Root权限（sudo账户）
 * 2. 检查账户是否是ContentCommittee成员（Instance3）
 * 3. 提供统一的权限查询接口
 *
 * 创建日期：2025-11-09
 */

import { useState, useEffect } from 'react'
import { getApi } from '../lib/polkadot-safe'

/**
 * 函数级详细中文注释：账户权限信息接口
 */
export interface AccountPermissions {
  /** 是否为Root账户（sudo账户） */
  isRoot: boolean
  /** 是否为ContentCommittee成员（Instance3） */
  isContentCommittee: boolean
  /** 是否为任意管理员（Root或Committee） */
  isAdmin: boolean
  /** 权限检查是否正在加载中 */
  loading: boolean
  /** 权限检查错误信息 */
  error: string | null
}

/**
 * 函数级详细中文注释：默认权限状态（无权限）
 */
const DEFAULT_PERMISSIONS: AccountPermissions = {
  isRoot: false,
  isContentCommittee: false,
  isAdmin: false,
  loading: true,
  error: null,
}

/**
 * 函数级详细中文注释：账户权限检查Hook
 *
 * @param account - 要检查的账户地址（可选）
 * @returns 账户的权限信息
 *
 * 使用示例：
 * ```tsx
 * const { isRoot, isAdmin, loading } = useAccountPermissions(account)
 *
 * if (loading) return <Spin />
 * if (isRoot) return <RootPanel />
 * if (isAdmin) return <AdminPanel />
 * return <UserPanel />
 * ```
 */
export function useAccountPermissions(account?: string): AccountPermissions {
  const [permissions, setPermissions] = useState<AccountPermissions>(DEFAULT_PERMISSIONS)

  useEffect(() => {
    // 如果没有账户地址，返回默认无权限状态
    if (!account) {
      setPermissions({
        ...DEFAULT_PERMISSIONS,
        loading: false,
      })
      return
    }

    /**
     * 函数级详细中文注释：异步加载权限信息
     */
    const loadPermissions = async () => {
      setPermissions(prev => ({ ...prev, loading: true, error: null }))

      try {
        const api = await getApi()

        // 1. 检查是否为Root账户（sudo key）
        const sudoKey = await api.query.sudo.key()
        const sudoAddress = sudoKey.toString()
        const isRoot = account === sudoAddress

        // 2. 检查是否为ContentCommittee成员（Instance3）
        let isContentCommittee = false
        try {
          // Instance3 对应 ContentCommittee
          const members = await api.query.contentCommittee.members()
          const memberAddresses = members.map((member: any) => member.toString())
          isContentCommittee = memberAddresses.includes(account)
        } catch (error) {
          console.warn('检查委员会成员失败（可能未配置委员会）:', error)
          // 如果委员会未配置，不影响整体权限检查
        }

        // 3. 计算综合管理员权限
        const isAdmin = isRoot || isContentCommittee

        setPermissions({
          isRoot,
          isContentCommittee,
          isAdmin,
          loading: false,
          error: null,
        })
      } catch (error: any) {
        console.error('加载权限信息失败:', error)
        setPermissions({
          ...DEFAULT_PERMISSIONS,
          loading: false,
          error: error.message || '加载权限信息失败',
        })
      }
    }

    loadPermissions()
  }, [account])

  return permissions
}

/**
 * 函数级详细中文注释：检查账户是否为Root
 *
 * @param account - 要检查的账户地址
 * @returns Promise<boolean> - 是否为Root账户
 *
 * 使用示例：
 * ```tsx
 * const isRoot = await checkIsRoot(account)
 * if (isRoot) {
 *   // 执行Root专属操作
 * }
 * ```
 */
export async function checkIsRoot(account: string): Promise<boolean> {
  try {
    const api = await getApi()
    const sudoKey = await api.query.sudo.key()
    return account === sudoKey.toString()
  } catch (error) {
    console.error('检查Root权限失败:', error)
    return false
  }
}

/**
 * 函数级详细中文注释：检查账户是否为ContentCommittee成员
 *
 * @param account - 要检查的账户地址
 * @returns Promise<boolean> - 是否为委员会成员
 *
 * 使用示例：
 * ```tsx
 * const isMember = await checkIsContentCommittee(account)
 * if (isMember) {
 *   // 执行委员会专属操作
 * }
 * ```
 */
export async function checkIsContentCommittee(account: string): Promise<boolean> {
  try {
    const api = await getApi()
    const members = await api.query.contentCommittee.members()
    const memberAddresses = members.map((member: any) => member.toString())
    return memberAddresses.includes(account)
  } catch (error) {
    console.warn('检查委员会成员失败:', error)
    return false
  }
}

/**
 * 函数级详细中文注释：检查账户是否为管理员（Root或Committee）
 *
 * @param account - 要检查的账户地址
 * @returns Promise<boolean> - 是否为管理员
 *
 * 使用示例：
 * ```tsx
 * const isAdmin = await checkIsAdmin(account)
 * if (!isAdmin) {
 *   message.error('需要管理员权限')
 *   return
 * }
 * ```
 */
export async function checkIsAdmin(account: string): Promise<boolean> {
  const isRoot = await checkIsRoot(account)
  if (isRoot) return true

  const isCommittee = await checkIsContentCommittee(account)
  return isCommittee
}
