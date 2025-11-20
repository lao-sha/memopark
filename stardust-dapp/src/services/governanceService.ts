/**
 * 统一治理服务
 *
 * 功能说明：
 * 1. 统一封装所有治理操作接口
 * 2. 自动路由到对应的后端模块
 * 3. 标准化错误处理和状态管理
 * 4. 提供一致的开发体验
 *
 * 创建日期：2025-01-20
 */

import type { ApiPromise } from '@polkadot/api'
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import type { KeyringPair } from '@polkadot/keyring/types'

// ==================== 类型定义 ====================

/**
 * 治理域枚举（与pallet-stardust-appeals保持一致）
 */
export enum GovernanceDomain {
  Deceased = 2,
  Text = 3,
  Media = 4,
  Offerings = 5,
  Park = 6,
  Works = 7,
}

/**
 * 治理操作类型枚举
 */
export enum GovernanceAction {
  Delete = 1,
  Update = 2,
  Hide = 3,
  Restore = 4,
}

/**
 * 治理请求类型
 */
export enum GovernanceRequestType {
  /** 内容申诉（通用） */
  ContentAppeal = 'content_appeal',
  /** 拥有者操作投诉（仅deceased相关） */
  OwnerOperationComplaint = 'owner_operation_complaint',
  /** Text内容投诉 */
  TextComplaint = 'text_complaint',
  /** Media内容投诉 */
  MediaComplaint = 'media_complaint',
  /** 生态提案 */
  EcosystemProposal = 'ecosystem_proposal',
  /** 争议仲裁 */
  DisputeArbitration = 'dispute_arbitration',
}

/**
 * 统一治理状态
 */
export enum UnifiedGovernanceStatus {
  Submitted = 'submitted',
  UnderReview = 'under_review',
  Approved = 'approved',
  Rejected = 'rejected',
  InNoticePeriod = 'in_notice_period',
  Executed = 'executed',
  Revoked = 'revoked',
  Expired = 'expired',
}

/**
 * 治理请求参数（联合类型）
 */
export type GovernanceRequestParams =
  | ContentAppealParams
  | OwnerOperationComplaintParams
  | TextComplaintParams
  | MediaComplaintParams
  | EcosystemProposalParams
  | DisputeArbitrationParams

interface ContentAppealParams {
  type: GovernanceRequestType.ContentAppeal
  domain: GovernanceDomain
  targetId: number | string
  action: GovernanceAction
  reason: string
  evidenceCid?: string
}

interface OwnerOperationComplaintParams {
  type: GovernanceRequestType.OwnerOperationComplaint
  operationId: number | string
  reason: string
  evidenceCid?: string
}

interface TextComplaintParams {
  type: GovernanceRequestType.TextComplaint
  textId: number | string
  reason: string
  evidenceCid?: string
}

interface MediaComplaintParams {
  type: GovernanceRequestType.MediaComplaint
  mediaId?: number | string
  albumId?: number | string
  videoCollectionId?: number | string
  reason: string
  evidenceCid?: string
}

interface EcosystemProposalParams {
  type: GovernanceRequestType.EcosystemProposal
  proposalId: number | string
}

interface DisputeArbitrationParams {
  type: GovernanceRequestType.DisputeArbitration
  disputeId: number | string
}

/**
 * 治理请求响应
 */
export interface GovernanceRequestResponse {
  success: boolean
  requestId?: number | string
  txHash?: string
  error?: string
}

/**
 * 治理状态查询响应
 */
export interface GovernanceStatusResponse {
  requestType: GovernanceRequestType
  status: UnifiedGovernanceStatus
  submitter: string
  createdAt: number // 区块号或时间戳
  updatedAt: number
  metadata?: Record<string, any>
}

// ==================== 服务实现 ====================

/**
 * 统一治理服务类
 *
 * 职责：
 * 1. 统一封装所有治理操作接口
 * 2. 自动路由到对应的后端模块
 * 3. 标准化错误处理和状态管理
 * 4. 提供一致的开发体验
 */
export class GovernanceService {
  private api: ApiPromise

  constructor(api: ApiPromise) {
    this.api = api
  }

  /**
   * 提交治理请求（统一入口）
   *
   * @param params 治理请求参数
   * @param signer 签名账户
   * @returns 治理请求响应
   */
  async submitGovernanceRequest(
    params: GovernanceRequestParams,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    try {
      // 根据请求类型路由到对应的处理函数
      switch (params.type) {
        case GovernanceRequestType.ContentAppeal:
          return await this._submitContentAppeal(params, signer)

        case GovernanceRequestType.OwnerOperationComplaint:
          return await this._submitOwnerOperationComplaint(params, signer)

        case GovernanceRequestType.TextComplaint:
          return await this._submitTextComplaint(params, signer)

        case GovernanceRequestType.MediaComplaint:
          return await this._submitMediaComplaint(params, signer)

        case GovernanceRequestType.EcosystemProposal:
          return await this._submitEcosystemProposal(params, signer)

        case GovernanceRequestType.DisputeArbitration:
          return await this._submitDisputeArbitration(params, signer)

        default:
          throw new Error(`未知的治理请求类型: ${params}`)
      }
    } catch (error: any) {
      console.error('提交治理请求失败:', error)
      return {
        success: false,
        error: error.message || '未知错误',
      }
    }
  }

  /**
   * 查询治理状态（统一入口）
   *
   * @param requestType 请求类型
   * @param requestId 请求ID
   * @returns 治理状态响应
   */
  async getGovernanceStatus(
    requestType: GovernanceRequestType,
    requestId: number | string
  ): Promise<GovernanceStatusResponse | null> {
    try {
      switch (requestType) {
        case GovernanceRequestType.ContentAppeal:
          return await this._getContentAppealStatus(requestId)

        case GovernanceRequestType.OwnerOperationComplaint:
          return await this._getOwnerOperationComplaintStatus(requestId)

        case GovernanceRequestType.TextComplaint:
          return await this._getTextComplaintStatus(requestId)

        case GovernanceRequestType.MediaComplaint:
          return await this._getMediaComplaintStatus(requestId)

        default:
          throw new Error(`未知的治理请求类型: ${requestType}`)
      }
    } catch (error) {
      console.error('查询治理状态失败:', error)
      return null
    }
  }

  /**
   * 获取用户所有治理请求
   *
   * @param account 用户账户地址
   * @param filterType 可选的类型过滤
   * @returns 治理请求列表
   */
  async getUserGovernanceRequests(
    account: string,
    filterType?: GovernanceRequestType
  ): Promise<GovernanceStatusResponse[]> {
    // 从各个模块聚合用户的治理请求
    const requests: GovernanceStatusResponse[] = []

    try {
      // 1. 查询 pallet-stardust-appeals 中的申诉
      if (!filterType || filterType === GovernanceRequestType.ContentAppeal) {
        const appeals = await this._getUserAppeals(account)
        requests.push(...appeals)
      }

      // 2. 查询 pallet-deceased 中的投诉
      if (
        !filterType ||
        filterType === GovernanceRequestType.TextComplaint ||
        filterType === GovernanceRequestType.MediaComplaint
      ) {
        const complaints = await this._getUserDeceasedComplaints(account)
        requests.push(...complaints)
      }

      // 3. 查询其他治理模块（democracy、arbitration等）
      // ... 根据需要扩展

      return requests
    } catch (error) {
      console.error('获取用户治理请求失败:', error)
      return []
    }
  }

  // ==================== 私有实现方法 ====================

  /**
   * 提交内容申诉（通用申诉机制）
   * 路由到：pallet-stardust-appeals::submit_appeal
   */
  private async _submitContentAppeal(
    params: ContentAppealParams,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    const tx = this.api.tx.stardustAppeals.submitAppeal(
      params.domain,
      params.targetId,
      params.action,
      params.reason,
      params.evidenceCid || null
    )

    return await this._sendTransaction(tx, signer)
  }

  /**
   * 提交拥有者操作投诉
   * 路由到：pallet-deceased::complain_owner_operation
   */
  private async _submitOwnerOperationComplaint(
    params: OwnerOperationComplaintParams,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    const tx = this.api.tx.deceased.complainOwnerOperation(
      params.operationId,
      params.reason,
      params.evidenceCid || null
    )

    return await this._sendTransaction(tx, signer)
  }

  /**
   * 提交Text内容投诉
   * 路由到：pallet-deceased::complain_text
   */
  private async _submitTextComplaint(
    params: TextComplaintParams,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    const tx = this.api.tx.deceased.complainText(
      params.textId,
      params.reason,
      params.evidenceCid || null
    )

    return await this._sendTransaction(tx, signer)
  }

  /**
   * 提交Media内容投诉
   * 路由到：pallet-deceased::complain_media
   */
  private async _submitMediaComplaint(
    params: MediaComplaintParams,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    const tx = this.api.tx.deceased.complainMedia(
      params.mediaId || null,
      params.albumId || null,
      params.videoCollectionId || null,
      params.reason,
      params.evidenceCid || null
    )

    return await this._sendTransaction(tx, signer)
  }

  /**
   * 提交生态提案
   * 路由到：pallet-democracy::propose
   */
  private async _submitEcosystemProposal(
    params: EcosystemProposalParams,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    // 实现生态提案提交逻辑
    throw new Error('生态提案功能待实现')
  }

  /**
   * 提交争议仲裁
   * 路由到：pallet-arbitration::submit_dispute
   */
  private async _submitDisputeArbitration(
    params: DisputeArbitrationParams,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    // 实现仲裁提交逻辑
    throw new Error('仲裁功能待实现')
  }

  /**
   * 查询内容申诉状态
   */
  private async _getContentAppealStatus(
    appealId: number | string
  ): Promise<GovernanceStatusResponse | null> {
    const appeal = await this.api.query.stardustAppeals.appeals(appealId)
    if (appeal.isNone) return null

    const data = appeal.unwrap()
    return {
      requestType: GovernanceRequestType.ContentAppeal,
      status: this._mapAppealStatus(data.status.toString()),
      submitter: data.submitter.toString(),
      createdAt: data.createdAt.toNumber(),
      updatedAt: data.updatedAt?.toNumber() || data.createdAt.toNumber(),
      metadata: {
        domain: data.domain.toNumber(),
        targetId: data.targetId.toString(),
        action: data.action.toNumber(),
      },
    }
  }

  /**
   * 查询拥有者操作投诉状态
   */
  private async _getOwnerOperationComplaintStatus(
    operationId: number | string
  ): Promise<GovernanceStatusResponse | null> {
    // 实现查询逻辑
    throw new Error('待实现')
  }

  /**
   * 查询Text投诉状态
   */
  private async _getTextComplaintStatus(
    textId: number | string
  ): Promise<GovernanceStatusResponse | null> {
    const complaint = await this.api.query.deceased.textComplaints(textId)
    if (complaint.isNone) return null

    const data = complaint.unwrap()
    return {
      requestType: GovernanceRequestType.TextComplaint,
      status: this._mapComplaintStatus(data.status.toString()),
      submitter: data.complainant.toString(),
      createdAt: data.created.toNumber(),
      updatedAt: data.created.toNumber(),
      metadata: {
        textId: textId.toString(),
        deposit: data.deposit.toString(),
      },
    }
  }

  /**
   * 查询Media投诉状态
   */
  private async _getMediaComplaintStatus(
    mediaId: number | string
  ): Promise<GovernanceStatusResponse | null> {
    const complaint = await this.api.query.deceased.mediaComplaints(mediaId)
    if (complaint.isNone) return null

    const data = complaint.unwrap()
    return {
      requestType: GovernanceRequestType.MediaComplaint,
      status: this._mapComplaintStatus(data.status.toString()),
      submitter: data.complainant.toString(),
      createdAt: data.created.toNumber(),
      updatedAt: data.created.toNumber(),
      metadata: {
        mediaId: mediaId.toString(),
        deposit: data.deposit.toString(),
      },
    }
  }

  /**
   * 获取用户的申诉记录
   */
  private async _getUserAppeals(account: string): Promise<GovernanceStatusResponse[]> {
    // 实现查询逻辑（需要通过链上索引或事件监听）
    // TODO: 这里需要通过Subsquid或事件历史来查询
    return []
  }

  /**
   * 获取用户的deceased模块投诉记录
   */
  private async _getUserDeceasedComplaints(account: string): Promise<GovernanceStatusResponse[]> {
    // 实现查询逻辑
    // TODO: 这里需要通过Subsquid或事件历史来查询
    return []
  }

  /**
   * 发送交易通用方法
   */
  private async _sendTransaction(
    tx: SubmittableExtrinsic<'promise'>,
    signer: KeyringPair
  ): Promise<GovernanceRequestResponse> {
    return new Promise((resolve) => {
      tx.signAndSend(signer, ({ status, events }) => {
        if (status.isInBlock || status.isFinalized) {
          const success = !events.some(({ event }) =>
            this.api.events.system.ExtrinsicFailed.is(event)
          )

          resolve({
            success,
            txHash: status.asInBlock?.toString() || status.asFinalized?.toString() || '',
            error: success ? undefined : '交易执行失败',
          })
        }
      }).catch((error) => {
        resolve({
          success: false,
          error: error.message,
        })
      })
    })
  }

  /**
   * 映射申诉状态到统一状态
   */
  private _mapAppealStatus(status: string): UnifiedGovernanceStatus {
    const statusMap: Record<string, UnifiedGovernanceStatus> = {
      Submitted: UnifiedGovernanceStatus.Submitted,
      Approved: UnifiedGovernanceStatus.Approved,
      Rejected: UnifiedGovernanceStatus.Rejected,
      InNoticePeriod: UnifiedGovernanceStatus.InNoticePeriod,
      Executed: UnifiedGovernanceStatus.Executed,
      Revoked: UnifiedGovernanceStatus.Revoked,
    }
    return statusMap[status] || UnifiedGovernanceStatus.Submitted
  }

  /**
   * 映射投诉状态到统一状态
   */
  private _mapComplaintStatus(status: string): UnifiedGovernanceStatus {
    const statusMap: Record<string, UnifiedGovernanceStatus> = {
      Pending: UnifiedGovernanceStatus.UnderReview,
      Resolved: UnifiedGovernanceStatus.Executed,
    }
    return statusMap[status] || UnifiedGovernanceStatus.Submitted
  }
}
