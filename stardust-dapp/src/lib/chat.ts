/**
 * 聊天功能 Polkadot 接口
 * 
 * 功能：
 * - 与链上 pallet-chat 交互
 * - 发送消息、标记已读、删除消息等
 * - 查询消息、会话等
 * - 监听链上事件
 */

import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { ISubmittableResult } from '@polkadot/types/types';
import type {
  Message,
  MessageMeta,
  Session,
  SendMessageParams,
  ChatEvent,
  MessageContent,
} from '../types/chat';
import {
  MessageType,
  MessageStatus,
} from '../types/chat';
import { getApi } from './polkadot';
import { uploadMessageToIpfs, downloadMessageFromIpfs } from './chat-ipfs';
import { encryptMessageContent, decryptMessageContent, getPublicKeyFromAddress } from './chat-crypto';

/**
 * 发送消息
 * 
 * @param params - 发送消息参数
 * @param account - 发送方账户
 * @returns 交易哈希
 */
export async function sendMessage(
  params: SendMessageParams,
  account: any
): Promise<string> {
  try {
    const api = await getApi();
    
    // 1. 获取接收方公钥
    const receiverPublicKey = getPublicKeyFromAddress(params.receiver);
    
    // 2. 加密消息内容
    const encryptedContent = await encryptMessageContent(params.content, receiverPublicKey);
    
    // 3. 上传加密内容到 IPFS
    const { cid } = await uploadMessageToIpfs(encryptedContent);
    
    // 4. 调用链上接口
    const tx = api.tx.chat.sendMessage(
      params.receiver,
      cid,
      params.type,
      params.sessionId || null
    );
    
    // 5. 签名并发送交易
    return new Promise((resolve, reject) => {
      tx.signAndSend(account, (result: ISubmittableResult) => {
        if (result.status.isInBlock) {
          console.log(`消息已打包到区块: ${result.status.asInBlock.toHex()}`);
        } else if (result.status.isFinalized) {
          console.log(`消息已确认: ${result.status.asFinalized.toHex()}`);
          resolve(result.status.asFinalized.toHex());
        } else if (result.status.isInvalid) {
          reject(new Error('交易无效'));
        }
        
        if (result.dispatchError) {
          reject(new Error('交易失败'));
        }
      });
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    throw error;
  }
}

/**
 * 标记消息为已读
 * 
 * @param msgId - 消息ID
 * @param account - 当前账户
 * @returns 交易哈希
 */
export async function markMessageAsRead(
  msgId: number,
  account: any
): Promise<string> {
  try {
    const api = await getApi();
    
    const tx = api.tx.chat.markAsRead(msgId);
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(account, (result: ISubmittableResult) => {
        if (result.status.isFinalized) {
          resolve(result.status.asFinalized.toHex());
        }
        if (result.dispatchError) {
          reject(new Error('标记已读失败'));
        }
      });
    });
  } catch (error) {
    console.error('标记已读失败:', error);
    throw error;
  }
}

/**
 * 删除消息
 * 
 * @param msgId - 消息ID
 * @param account - 当前账户
 * @returns 交易哈希
 */
export async function deleteMessage(
  msgId: number,
  account: any
): Promise<string> {
  try {
    const api = await getApi();
    
    const tx = api.tx.chat.deleteMessage(msgId);
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(account, (result: ISubmittableResult) => {
        if (result.status.isFinalized) {
          resolve(result.status.asFinalized.toHex());
        }
        if (result.dispatchError) {
          reject(new Error('删除消息失败'));
        }
      });
    });
  } catch (error) {
    console.error('删除消息失败:', error);
    throw error;
  }
}

/**
 * 批量标记会话为已读
 * 
 * @param sessionId - 会话ID
 * @param account - 当前账户
 * @returns 交易哈希
 */
export async function markSessionAsRead(
  sessionId: string,
  account: any
): Promise<string> {
  try {
    const api = await getApi();
    
    const tx = api.tx.chat.markSessionAsRead(sessionId);
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(account, (result: ISubmittableResult) => {
        if (result.status.isFinalized) {
          resolve(result.status.asFinalized.toHex());
        }
        if (result.dispatchError) {
          reject(new Error('标记会话已读失败'));
        }
      });
    });
  } catch (error) {
    console.error('标记会话已读失败:', error);
    throw error;
  }
}

/**
 * 查询消息元数据
 * 
 * @param msgId - 消息ID
 * @returns 消息元数据
 */
export async function queryMessageMeta(msgId: number): Promise<MessageMeta | null> {
  try {
    const api = await getApi();
    
    const result = await api.query.chat.messages(msgId);
    
    if (result.isNone) {
      return null;
    }
    
    const meta = result.unwrap();
    
    return {
      id: msgId,
      sender: meta.sender.toString(),
      receiver: meta.receiver.toString(),
      contentCid: meta.contentCid.toUtf8(),
      sessionId: meta.sessionId.toHex(),
      msgType: meta.msgType.toNumber() as MessageType,
      sentAt: meta.sentAt.toNumber(),
      isRead: meta.isRead.toPrimitive() as boolean,
      isDeleted: meta.isDeleted.toPrimitive() as boolean,
    };
  } catch (error) {
    console.error('查询消息失败:', error);
    return null;
  }
}

/**
 * 查询完整消息（包含解密的内容）
 * 
 * @param msgId - 消息ID
 * @param myPrivateKey - 我的私钥（用于解密）
 * @param myAddress - 我的地址
 * @returns 完整消息
 */
export async function queryMessage(
  msgId: number,
  myPrivateKey: string,
  myAddress: string
): Promise<Message | null> {
  try {
    // 1. 查询消息元数据
    const meta = await queryMessageMeta(msgId);
    if (!meta) {
      return null;
    }
    
    // 2. 从 IPFS 下载加密内容
    const encryptedContent = await downloadMessageFromIpfs(meta.contentCid);
    
    // 3. 解密消息内容
    const content = await decryptMessageContent(encryptedContent, myPrivateKey);
    
    // 4. 构造完整消息对象
    return {
      id: meta.id,
      sender: meta.sender,
      receiver: meta.receiver,
      type: meta.msgType,
      content,
      timestamp: content.timestamp,
      status: meta.isRead ? MessageStatus.Read : MessageStatus.Delivered,
      isRead: meta.isRead,
      isDeleted: meta.isDeleted,
      isMine: meta.sender === myAddress,
    };
  } catch (error) {
    console.error('查询完整消息失败:', error);
    return null;
  }
}

/**
 * 查询会话信息
 * 
 * @param sessionId - 会话ID
 * @returns 会话信息
 */
export async function querySession(sessionId: string): Promise<Session | null> {
  try {
    const api = await getApi();
    
    const result = await api.query.chat.sessions(sessionId);
    
    if (result.isNone) {
      return null;
    }
    
    const session = result.unwrap();
    
    return {
      id: sessionId,
      participants: session.participants.map((p: any) => p.toString()),
      lastMessageId: session.lastMessageId.toNumber(),
      lastActive: session.lastActive.toNumber(),
      createdAt: session.createdAt.toNumber(),
      isArchived: session.isArchived.toPrimitive() as boolean,
      unreadCount: 0, // 需要另外查询
    };
  } catch (error) {
    console.error('查询会话失败:', error);
    return null;
  }
}

/**
 * 查询用户的所有会话
 * 
 * @param address - 用户地址
 * @returns 会话ID列表
 */
export async function queryUserSessions(address: string): Promise<string[]> {
  try {
    const api = await getApi();
    
    const result = await api.query.chat.userSessions(address);
    
    return result.map((sessionId: any) => sessionId.toHex());
  } catch (error) {
    console.error('查询用户会话失败:', error);
    return [];
  }
}

/**
 * 查询会话的消息列表
 * 
 * @param sessionId - 会话ID
 * @returns 消息ID列表
 */
export async function querySessionMessages(sessionId: string): Promise<number[]> {
  try {
    const api = await getApi();
    
    const result = await api.query.chat.sessionMessages(sessionId);
    
    return result.map((msgId: any) => msgId.toNumber());
  } catch (error) {
    console.error('查询会话消息失败:', error);
    return [];
  }
}

/**
 * 查询未读消息数
 * 
 * @param address - 用户地址
 * @param sessionId - 会话ID
 * @returns 未读消息数
 */
export async function queryUnreadCount(
  address: string,
  sessionId: string
): Promise<number> {
  try {
    const api = await getApi();
    
    const result = await api.query.chat.unreadCount([address, sessionId]);
    
    return result.toNumber();
  } catch (error) {
    console.error('查询未读数失败:', error);
    return 0;
  }
}

/**
 * 监听聊天事件
 * 
 * @param callback - 事件回调函数
 * @returns 取消监听函数
 */
export async function subscribeChatEvents(
  callback: (event: ChatEvent) => void
): Promise<() => void> {
  try {
    const api = await getApi();
    
    const unsub = await api.query.system.events((events: any[]) => {
      events.forEach(({ event }) => {
        if (api.events.chat.MessageSent.is(event)) {
          const [msgId, sessionId, sender, receiver] = event.data;
          callback({
            type: 'MessageSent',
            data: {
              msgId: msgId.toNumber(),
              sessionId: sessionId.toHex(),
              sender: sender.toString(),
              receiver: receiver.toString(),
            },
          });
        } else if (api.events.chat.MessageRead.is(event)) {
          const [msgId, reader] = event.data;
          callback({
            type: 'MessageRead',
            data: {
              msgId: msgId.toNumber(),
              reader: reader.toString(),
            },
          });
        } else if (api.events.chat.MessageDeleted.is(event)) {
          const [msgId, deleter] = event.data;
          callback({
            type: 'MessageDeleted',
            data: {
              msgId: msgId.toNumber(),
              deleter: deleter.toString(),
            },
          });
        } else if (api.events.chat.SessionCreated.is(event)) {
          const [sessionId, participants] = event.data;
          callback({
            type: 'SessionCreated',
            data: {
              sessionId: sessionId.toHex(),
              participants: participants.map((p: any) => p.toString()),
            },
          });
        } else if (api.events.chat.SessionMarkedAsRead.is(event)) {
          const [sessionId, user] = event.data;
          callback({
            type: 'SessionMarkedAsRead',
            data: {
              sessionId: sessionId.toHex(),
              user: user.toString(),
            },
          });
        }
      });
    });
    
    return unsub as () => void;
  } catch (error) {
    console.error('监听事件失败:', error);
    return () => {};
  }
}

/**
 * 🆕 2025-10-22：获取或创建聊天会话
 * 
 * 功能：
 * - 检查是否已存在与指定用户的会话
 * - 如果存在，返回会话ID
 * - 如果不存在，创建新会话并返回会话ID
 * 
 * @param myAddress - 我的地址
 * @param otherAddress - 对方地址（做市商或买家）
 * @returns 会话ID（hex格式）
 */
export async function getOrCreateChatSession(
  myAddress: string,
  otherAddress: string
): Promise<string> {
  try {
    const api = await getApi();
    
    // 1. 查询我的所有会话
    const mySessions = await queryUserSessions(myAddress);
    
    // 2. 查找是否已存在与对方的会话
    for (const session of mySessions) {
      if (session.participants.includes(otherAddress)) {
        console.log('找到已存在的会话:', session.id);
        return session.id;
      }
    }
    
    // 3. 不存在会话，需要创建
    // 注意：会话会在第一次发送消息时自动创建
    // 这里返回一个预期的会话ID（基于两个地址的哈希）
    const participants = [myAddress, otherAddress].sort();
    const sessionHash = api.registry.hash(participants.join(''));
    
    console.log('将创建新会话，预期ID:', sessionHash.toHex());
    return sessionHash.toHex();
  } catch (error) {
    console.error('获取或创建会话失败:', error);
    throw error;
  }
}

/**
 * 🆕 2025-10-22：发送系统消息
 * 
 * 用于订单创建、状态变更等自动提示
 * 
 * @param sessionId - 会话ID
 * @param systemText - 系统消息文本
 * @param account - 发送方账户
 * @param relatedOrderId - 关联的订单ID（可选）
 */
export async function sendSystemMessage(
  sessionId: string,
  systemText: string,
  account: any,
  relatedOrderId?: number
): Promise<void> {
  try {
    const content: MessageContent = {
      type: MessageType.System,
      text: systemText,
      timestamp: Date.now(),
      metadata: relatedOrderId ? { orderId: relatedOrderId } : undefined,
    };
    
    // 发送消息（使用System类型）
    await sendMessage(
      {
        receiver: account.address, // 系统消息可以发给自己
        content,
        type: MessageType.System,
        sessionId,
      },
      account
    );
  } catch (error) {
    console.error('发送系统消息失败:', error);
  }
}

