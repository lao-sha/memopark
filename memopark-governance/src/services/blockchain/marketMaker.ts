import type { ApiPromise } from '@polkadot/api'

/**
 * 做市商相关服务
 */

/**
 * 申请信息接口
 */
export interface Application {
  mm_id: number
  owner: string
  deposit: string
  status: string
  public_cid: string
  private_cid: string
  fee_bps: number
  min_amount: string
  created_at: number
  info_deadline: number
  review_deadline: number
}

/**
 * 获取待审核的申请列表
 */
export async function getPendingApplications(api: ApiPromise): Promise<Application[]> {
  try {
    // 检查 pallet 是否存在
    if (!(api.query as any).marketMaker) {
      throw new Error('MarketMaker pallet 未注册')
    }

    // 获取下一个ID
    const nextId = await (api.query as any).marketMaker.nextId()
    const maxId = Number(nextId.toString())

    const pending: Application[] = []
    const startId = Math.max(0, maxId - 100) // 查询最近100个

    for (let id = maxId - 1; id >= startId; id--) {
      const appOption = await (api.query as any).marketMaker.applications(id)

      if (appOption.isSome) {
        const app = appOption.unwrap()
        const appData = app.toJSON() as any

        // 检查是否为待审状态
        const isPending =
          appData.status === 'PendingReview' ||
          appData.status === 1 ||
          (typeof appData.status === 'object' && 'pendingReview' in appData.status)

        if (isPending) {
          pending.push({
            mm_id: id,
            owner: appData.owner,
            deposit: appData.deposit,
            status: 'PendingReview',
            public_cid: appData.publicCid || appData.public_cid || '',
            private_cid: appData.privateCid || appData.private_cid || '',
            fee_bps: appData.feeBps || appData.fee_bps || 0,
            min_amount: appData.minAmount || appData.min_amount || '0',
            created_at: appData.createdAt || appData.created_at || 0,
            info_deadline: appData.infoDeadline || appData.info_deadline || 0,
            review_deadline: appData.reviewDeadline || appData.review_deadline || 0
          })
        }
      }

      if (pending.length >= 50) break // 最多返回50个
    }

    console.log('[MarketMaker] 查询到', pending.length, '个待审申请')
    return pending

  } catch (e) {
    console.error('[MarketMaker] 获取申请失败:', e)
    throw e
  }
}

/**
 * 获取已批准的做市商列表
 */
export async function getApprovedApplications(api: ApiPromise): Promise<Application[]> {
  try {
    if (!(api.query as any).marketMaker) {
      throw new Error('MarketMaker pallet 未注册')
    }

    const nextId = await (api.query as any).marketMaker.nextId()
    const maxId = Number(nextId.toString())

    const approved: Application[] = []
    const startId = Math.max(0, maxId - 100)

    for (let id = maxId - 1; id >= startId; id--) {
      const appOption = await (api.query as any).marketMaker.applications(id)

      if (appOption.isSome) {
        const app = appOption.unwrap()
        const appData = app.toJSON() as any

        const isActive =
          appData.status === 'Active' ||
          appData.status === 3 ||
          (typeof appData.status === 'object' && 'active' in appData.status)

        if (isActive) {
          approved.push({
            mm_id: id,
            owner: appData.owner,
            deposit: appData.deposit,
            status: 'Active',
            public_cid: appData.publicCid || appData.public_cid || '',
            private_cid: appData.privateCid || appData.private_cid || '',
            fee_bps: appData.feeBps || appData.fee_bps || 0,
            min_amount: appData.minAmount || appData.min_amount || '0',
            created_at: appData.createdAt || appData.created_at || 0,
            info_deadline: appData.infoDeadline || appData.info_deadline || 0,
            review_deadline: appData.reviewDeadline || appData.review_deadline || 0
          })
        }
      }

      if (approved.length >= 50) break
    }

    console.log('[MarketMaker] 查询到', approved.length, '个已批准做市商')
    return approved

  } catch (e) {
    console.error('[MarketMaker] 获取申请失败:', e)
    throw e
  }
}

/**
 * 获取单个申请详情
 */
export async function getApplication(
  api: ApiPromise,
  mmId: number
): Promise<Application | null> {
  try {
    if (!(api.query as any).marketMaker) {
      throw new Error('MarketMaker pallet 未注册')
    }

    const appOption = await (api.query as any).marketMaker.applications(mmId)

    if (appOption.isNone) {
      return null
    }

    const app = appOption.unwrap()
    const appData = app.toJSON() as any

    return {
      mm_id: mmId,
      owner: appData.owner,
      deposit: appData.deposit,
      status: appData.status,
      public_cid: appData.publicCid || appData.public_cid || '',
      private_cid: appData.privateCid || appData.private_cid || '',
      fee_bps: appData.feeBps || appData.fee_bps || 0,
      min_amount: appData.minAmount || appData.min_amount || '0',
      created_at: appData.createdAt || appData.created_at || 0,
      info_deadline: appData.infoDeadline || appData.info_deadline || 0,
      review_deadline: appData.reviewDeadline || appData.review_deadline || 0
    }

  } catch (e) {
    console.error('[MarketMaker] 获取申请失败:', e)
    throw e
  }
}

