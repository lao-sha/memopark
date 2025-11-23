/**
 * 一对一聊天服务
 *
 * 功能说明：
 * 1. 与pallet-chat交互
 * 2. 消息发送和接收
 * 3. 会话管理
 * 4. 已读/未读状态
 * 5. 用户资料管理
 *
 * 创建日期：2025-11-22
 */

import { ApiPromise } from '@polkadot/api'
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import type { ISubmittableResult } from '@polkadot/types/types'
import { getApi } from '../lib/polkadot-safe'

// ========== 类型定义 ==========

/** 消息类型枚举 */
export enum MessageType {
  Text = 0,
  Image = 1,
  File = 2,
  Voice = 3,
  System = 4
}

/** 用户状态枚举 */
export enum UserStatus {
  Online = 'Online',
  Offline = 'Offline',
  Busy = 'Busy',
  Away = 'Away',
  Invisible = 'Invisible'
}

/** 消息元数据 */
export interface MessageMeta {
  msgId: number
  sender: string
  receiver: string
  senderChatId?: number
  receiverChatId?: number
  contentCid: string
  sessionId: string
  msgType: MessageType
  sentAt: number
  isRead: boolean
  isDeletedBySender: boolean
  isDeletedByReceiver: boolean
  replyTo?: number
}

/** 会话信息 */
export interface SessionInfo {
  sessionId: string
  participants: string[]
  lastMessageId: number
  lastActive: number
  isArchivedByUser1: boolean
  isArchivedByUser2: boolean
  createdAt: number
}

/** 聊天用户资料 */
export interface ChatUserProfile {
  chatUserId: number
  nickname?: string
  avatarCid?: string
  signature?: string
  status: UserStatus
  privacySettings: {
    allowStrangerMessages: boolean
    showOnlineStatus: boolean
    showLastActive: boolean
  }
  createdAt: number
  lastActive: number
}

/** 未读计数 */
export interface UnreadCount {
  sessionId: string
  count: number
}

/** 发送消息参数 */
export interface SendMessageParams {
  receiver: string
  contentCid: string
  msgType: MessageType
  sessionId?: string
}

/** 聊天事件监听器 */
export interface ChatEventListeners {
  onMessageSent?: (event: { msgId: number; sessionId: string; sender: string; receiver: string }) => void
  onMessageRead?: (event: { msgId: number; reader: string }) => void
  onMessageDeleted?: (event: { msgId: number; deleter: string }) => void
  onSessionCreated?: (event: { sessionId: string; participants: string[] }) => void
  onChatUserCreated?: (event: { accountId: string; chatUserId: number }) => void
  onChatUserProfileUpdated?: (event: { chatUserId: number }) => void
}

// ========== 聊天服务类 ==========

export class ChatService {
  private api: ApiPromise

  constructor(api: ApiPromise) {
    this.api = api
  }

  /**
   * 函数级详细中文注释：发送消息
   */
  async sendMessage(
    sender: string,
    params: SendMessageParams
  ): Promise<{ msgId: number; sessionId: string }> {
    const tx = this.api.tx.chat.sendMessage(
      params.receiver,
      params.contentCid,
      params.msgType,
      params.sessionId || null
    )

    return new Promise(async (resolve, reject) => {
      try {
        const { web3FromAddress } = await import('@polkadot/extension-dapp')
        const injector = await web3FromAddress(sender)

        tx.signAndSend(sender, { signer: injector.signer }, (result: ISubmittableResult) => {
          if (result.status.isInBlock) {
            // 查找MessageSent事件
            const event = result.events.find(({ event }) =>
              this.api.events.chat.MessageSent.is(event)
            )

            if (event) {
              const { msgId, sessionId } = event.event.data.toJSON() as any
              resolve({ msgId, sessionId })
            }
          } else if (result.status.isFinalized) {
            // 已完成
          } else if (result.isError) {
            reject(new Error('发送消息失败'))
          }
        }).catch(reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 函数级详细中文注释：标记消息为已读
   */
  buildMarkAsReadTx(msgId: number): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.markAsRead(msgId)
  }

  /**
   * 函数级详细中文注释：批量标记已读
   */
  buildMarkBatchAsReadTx(msgIds: number[]): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.markBatchAsRead(msgIds)
  }

  /**
   * 函数级详细中文注释：标记会话为已读
   */
  buildMarkSessionAsReadTx(sessionId: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.markSessionAsRead(sessionId)
  }

  /**
   * 函数级详细中文注释：删除消息
   */
  buildDeleteMessageTx(msgId: number): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.deleteMessage(msgId)
  }

  /**
   * 函数级详细中文注释：归档会话
   */
  buildArchiveSessionTx(sessionId: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.archiveSession(sessionId)
  }

  /**
   * 函数级详细中文注释：拉黑用户
   */
  buildBlockUserTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.blockUser(targetUser)
  }

  /**
   * 函数级详细中文注释：解除拉黑
   */
  buildUnblockUserTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.unblockUser(targetUser)
  }

  /**
   * 函数级详细中文注释：注册聊天用户
   */
  buildRegisterChatUserTx(nickname?: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.registerChatUser(nickname || null)
  }

  /**
   * 函数级详细中文注释：更新用户资料
   */
  buildUpdateChatProfileTx(params: {
    nickname?: string
    avatarCid?: string
    signature?: string
  }): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.updateChatProfile(
      params.nickname || null,
      params.avatarCid || null,
      params.signature || null
    )
  }

  /**
   * 函数级详细中文注释：设置用户状态
   */
  buildSetUserStatusTx(statusCode: number): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.setUserStatus(statusCode)
  }

  /**
   * 函数级详细中文注释：更新隐私设置
   */
  buildUpdatePrivacySettingsTx(settings: {
    allowStrangerMessages: boolean
    showOnlineStatus: boolean
    showLastActive: boolean
  }): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chat.updatePrivacySettings(
      settings.allowStrangerMessages,
      settings.showOnlineStatus,
      settings.showLastActive
    )
  }

  // ========== 查询方法 ==========

  /**
   * 函数级详细中文注释：获取消息详情
   */
  async getMessage(msgId: number): Promise<MessageMeta | null> {
    const result = await this.api.query.chat.messages(msgId)
    if (result.isEmpty) return null

    const data = result.toJSON() as any
    return {
      msgId,
      sender: data.sender,
      receiver: data.receiver,
      senderChatId: data.senderChatId,
      receiverChatId: data.receiverChatId,
      contentCid: data.contentCid,
      sessionId: data.sessionId,
      msgType: data.msgType,
      sentAt: data.sentAt,
      isRead: data.isRead,
      isDeletedBySender: data.isDeletedBySender,
      isDeletedByReceiver: data.isDeletedByReceiver,
      replyTo: data.replyTo
    }
  }

  /**
   * 函数级详细中文注释：获取会话信息
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const result = await this.api.query.chat.sessions(sessionId)
    if (result.isEmpty) return null

    const data = result.toJSON() as any
    return {
      sessionId,
      participants: data.participants,
      lastMessageId: data.lastMessageId,
      lastActive: data.lastActive,
      isArchivedByUser1: data.isArchivedByUser1,
      isArchivedByUser2: data.isArchivedByUser2,
      createdAt: data.createdAt
    }
  }

  /**
   * 函数级详细中文注释：获取会话的所有消息ID
   */
  async getSessionMessages(sessionId: string): Promise<number[]> {
    const entries = await this.api.query.chat.sessionMessages.entries(sessionId)
    return entries.map(([key]) => {
      const msgId = key.args[1].toJSON() as number
      return msgId
    })
  }

  /**
   * 函数级详细中文注释：获取未读计数
   */
  async getUnreadCount(user: string, sessionId: string): Promise<number> {
    const result = await this.api.query.chat.unreadCount([user, sessionId])
    return result.toNumber()
  }

  /**
   * 函数级详细中文注释：获取用户的所有会话
   */
  async getUserSessions(user: string): Promise<SessionInfo[]> {
    const entries = await this.api.query.chat.userSessions.entries(user)
    const sessionIds = entries.map(([key]) => key.args[1].toHex())

    const sessions: SessionInfo[] = []
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId)
      if (session) {
        sessions.push(session)
      }
    }

    return sessions.sort((a, b) => b.lastActive - a.lastActive)
  }

  /**
   * 函数级详细中文注释：获取聊天用户ID
   */
  async getChatUserId(account: string): Promise<number | null> {
    const result = await this.api.query.chat.accountToChatUserId(account)
    if (result.isEmpty) return null
    return result.toNumber()
  }

  /**
   * 函数级详细中文注释：获取聊天用户资料
   */
  async getChatUserProfile(chatUserId: number): Promise<ChatUserProfile | null> {
    const result = await this.api.query.chat.chatUserProfiles(chatUserId)
    if (result.isEmpty) return null

    const data = result.toJSON() as any
    return {
      chatUserId,
      nickname: data.nickname,
      avatarCid: data.avatarCid,
      signature: data.signature,
      status: data.status,
      privacySettings: data.privacySettings,
      createdAt: data.createdAt,
      lastActive: data.lastActive
    }
  }

  /**
   * 函数级详细中文注释：检查是否拉黑
   */
  async isBlocked(blocker: string, blocked: string): Promise<boolean> {
    const result = await this.api.query.chat.blacklist(blocker, blocked)
    return result.isTrue
  }

  /**
   * 函数级详细中文注释：订阅聊天事件
   */
  subscribeToChatEvents(listeners: ChatEventListeners): () => void {
    const unsubscribes: (() => void)[] = []

    // 订阅系统事件
    this.api.query.system.events((events: any[]) => {
      events.forEach((record) => {
        const { event } = record

        // MessageSent事件
        if (this.api.events.chat.MessageSent.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onMessageSent?.({
            msgId: data.msgId,
            sessionId: data.sessionId,
            sender: data.sender,
            receiver: data.receiver
          })
        }

        // MessageRead事件
        if (this.api.events.chat.MessageRead.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onMessageRead?.({
            msgId: data.msgId,
            reader: data.reader
          })
        }

        // MessageDeleted事件
        if (this.api.events.chat.MessageDeleted.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onMessageDeleted?.({
            msgId: data.msgId,
            deleter: data.deleter
          })
        }

        // SessionCreated事件
        if (this.api.events.chat.SessionCreated.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onSessionCreated?.({
            sessionId: data.sessionId,
            participants: data.participants
          })
        }

        // ChatUserCreated事件
        if (this.api.events.chat.ChatUserCreated.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onChatUserCreated?.({
            accountId: data.accountId,
            chatUserId: data.chatUserId
          })
        }

        // ChatUserProfileUpdated事件
        if (this.api.events.chat.ChatUserProfileUpdated.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onChatUserProfileUpdated?.({
            chatUserId: data.chatUserId
          })
        }
      })
    }).then((unsub) => {
      unsubscribes.push(unsub)
    })

    // 返回取消订阅函数
    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }
}

/**
 * 函数级详细中文注释：创建聊天服务实例
 */
export async function createChatService(): Promise<ChatService> {
  const api = await getApi()
  return new ChatService(api)
}

export default ChatService