/// Stardust智能群聊服务 - 区块链交互层
///
/// 处理智能群聊系统与Substrate区块链的所有交互

import { ApiPromise } from '@polkadot/api';
import { getApi } from '../lib/polkadot';
import { signAndSendTxWithPrompt } from '../lib/polkadot-safe';
import sessionSigner from '../lib/session-signer';

/// 群组信息接口
export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  owner: string;
  memberCount: number;
  encryptionMode: 'Military' | 'Business' | 'Selective' | 'Transparent';
  isPublic: boolean;
  createdAt: number;
}

/// 群组消息接口
export interface GroupMessage {
  id: string;
  groupId: string;
  sender: string;
  content: string;
  messageType: 'Text' | 'Image' | 'File' | 'Voice';
  encryptionMode: 'Military' | 'Business' | 'Selective' | 'Transparent';
  timestamp: number;
  tempId?: string;
}

/// 群组成员接口
export interface GroupMember {
  accountId: string;
  nickname?: string;
  role: 'Owner' | 'Admin' | 'Member';
  joinedAt: number;
}

/// 智能聊天服务类
export class SmartChatService {
  private api: ApiPromise | null = null;

  constructor() {
    this.initializeApi();
  }

  /// 初始化API连接
  private async initializeApi(): Promise<void> {
    try {
      this.api = await getApi();
    } catch (error) {
      console.error('智能聊天服务初始化失败:', error);
    }
  }

  /// 确保API已初始化
  private async ensureApi(): Promise<ApiPromise> {
    if (!this.api) {
      await this.initializeApi();
    }
    if (!this.api) {
      throw new Error('区块链API未初始化');
    }
    return this.api;
  }

  /// 创建群组
  async createGroup(
    address: string,
    name: string,
    description?: string,
    encryptionMode: 'Military' | 'Business' | 'Selective' | 'Transparent' = 'Business',
    isPublic: boolean = false
  ): Promise<string> {
    try {
      console.log('创建群组开始，参数:', { address, name, description, encryptionMode, isPublic });
      const api = await this.ensureApi();
      console.log('API已初始化');

      // 转换加密模式为 u8
      const encryptionModeMap = {
        Military: 0,
        Business: 1,
        Selective: 2,
        Transparent: 3,
      };
      const encryptionModeU8 = encryptionModeMap[encryptionMode];

      const tx = api.tx.smartGroupChat.createGroup(
        Array.from(new TextEncoder().encode(name)),
        description ? Array.from(new TextEncoder().encode(description)) : null,
        encryptionModeU8,
        isPublic
      );

      return new Promise(async (resolve, reject) => {
        try {
          const hash = await signAndSendTxWithPrompt(tx, address);

          // 等待交易上链并查找事件
          const unsub = await api.rpc.chain.subscribeFinalizedHeads(async (header) => {
            const blockHash = await api.rpc.chain.getBlockHash(header.number);
            const events = await api.query.system.events.at(blockHash);

            const groupCreatedEvent = events.find(
              ({ event }) => event.section === 'smartGroupChat' && event.method === 'GroupCreated'
            );

            if (groupCreatedEvent) {
              const [, groupId] = groupCreatedEvent.event.data;
              unsub();
              resolve(groupId.toString());
            }
          });

          // 30秒超时（等待区块确认需要更长时间）
          setTimeout(() => {
            unsub();
            reject(new Error('群组创建超时'));
          }, 30000);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('创建群组失败:', error);
      throw error;
    }
  }

  /// 发送群组消息 (支持乐观更新)
  async sendGroupMessage(
    signer: KeyringPair,
    groupId: string,
    content: string,
    messageType: 'Text' | 'Image' | 'File' | 'Voice' = 'Text',
    tempId?: string,
    forceEncryptionMode?: 'Military' | 'Business' | 'Selective' | 'Transparent'
  ): Promise<string> {
    try {
      const api = await this.ensureApi();

      // 转换 messageType 为 u8
      const messageTypeMap = {
        Text: 0,
        Image: 1,
        File: 2,
        Voice: 3,
      };
      const messageTypeU8 = messageTypeMap[messageType];

      // 注意：链上函数只需要3个参数 (group_id, content, message_type)
      // tempId 和 forceEncryptionMode 目前不被链上支持
      console.log('tempId (前端标识):', tempId);
      console.log('forceEncryptionMode (前端选项):', forceEncryptionMode);

      const tx = api.tx.smartGroupChat.sendGroupMessage(
        parseInt(groupId),
        Array.from(new TextEncoder().encode(content)),
        messageTypeU8
      );

      return new Promise((resolve, reject) => {
        tx.signAndSend(signer, ({ status, events }) => {
          if (status.isInBlock) {
            // 查找消息发送事件
            const messageSentEvent = events.find(
              ({ event }) => event.section === 'smartGroupChat' && event.method === 'GroupMessageSent'
            );

            if (messageSentEvent) {
              const [, , messageId] = messageSentEvent.event.data;
              resolve(messageId.toString());
            } else {
              reject(new Error('消息发送事件未找到'));
            }
          } else if (status.isError) {
            reject(new Error('消息发送交易失败'));
          }
        }).catch(reject);
      });
    } catch (error) {
      console.error('发送群组消息失败:', error);
      throw error;
    }
  }

  /// 发送群组消息 (使用地址签名，支持乐观更新)
  async sendGroupMessageWithAddress(
    address: string,
    groupId: string,
    content: string,
    messageType: 'Text' | 'Image' | 'File' | 'Voice' = 'Text',
    tempId?: string,
    forceEncryptionMode?: 'Military' | 'Business' | 'Selective' | 'Transparent'
  ): Promise<string> {
    try {
      const api = await this.ensureApi();

      // 转换 messageType 为 u8
      const messageTypeMap = {
        Text: 0,
        Image: 1,
        File: 2,
        Voice: 3,
      };
      const messageTypeU8 = messageTypeMap[messageType];

      // 注意：链上函数只需要3个参数 (group_id, content, message_type)
      // tempId 和 forceEncryptionMode 目前不被支持
      const tx = api.tx.smartGroupChat.sendGroupMessage(
        parseInt(groupId),
        Array.from(new TextEncoder().encode(content)),
        messageTypeU8
      );

      // 使用会话签名管理器（自动处理密码输入和会话管理）
      console.log('使用会话签名发送消息...');
      console.log('tempId (前端使用):', tempId);
      console.log('forceEncryptionMode (前端使用):', forceEncryptionMode);

      const hash = await sessionSigner.signAndSendTx(tx);

      // 返回基于时间戳的消息ID（临时方案）
      // 注意：这个ID只是前端使用，链上会生成真实的消息ID
      return `msg_${Date.now()}`;

    } catch (error) {
      console.error('发送群组消息失败:', error);
      throw error;
    }
  }

  /// 加入群组
  async joinGroup(
    address: string,
    groupId: string
  ): Promise<void> {
    try {
      const api = await this.ensureApi();

      const tx = api.tx.smartGroupChat.joinGroup(
        parseInt(groupId)
      );

      await signAndSendTxWithPrompt(tx, address);
    } catch (error) {
      console.error('加入群组失败:', error);
      throw error;
    }
  }

  /// 离开群组
  async leaveGroup(
    address: string,
    groupId: string
  ): Promise<void> {
    try {
      const api = await this.ensureApi();

      const tx = api.tx.smartGroupChat.leaveGroup(parseInt(groupId));

      await signAndSendTxWithPrompt(tx, address);
    } catch (error) {
      console.error('离开群组失败:', error);
      throw error;
    }
  }

  /// 更新群组加密模式
  async updateGroupEncryption(
    signer: KeyringPair,
    groupId: string,
    newEncryptionMode: 'Military' | 'Business' | 'Selective' | 'Transparent'
  ): Promise<void> {
    try {
      const api = await this.ensureApi();

      const tx = api.tx.smartGroupChat.updateGroupEncryption(
        parseInt(groupId),
        newEncryptionMode
      );

      return new Promise((resolve, reject) => {
        tx.signAndSend(signer, ({ status, events }) => {
          if (status.isInBlock) {
            // 查找加密模式更新事件
            const encryptionUpdatedEvent = events.find(
              ({ event }) => event.section === 'smartGroupChat' && event.method === 'GroupEncryptionUpdated'
            );

            if (encryptionUpdatedEvent) {
              resolve();
            } else {
              reject(new Error('加密模式更新事件未找到'));
            }
          } else if (status.isError) {
            reject(new Error('更新加密模式交易失败'));
          }
        }).catch(reject);
      });
    } catch (error) {
      console.error('更新群组加密模式失败:', error);
      throw error;
    }
  }

  /// 获取群组信息
  async getGroupInfo(groupId: string): Promise<GroupInfo | null> {
    try {
      const api = await this.ensureApi();

      const result = await api.query.smartGroupChat.groups(parseInt(groupId));

      if (result.isSome) {
        const groupData = result.unwrap();
        return {
          id: groupId,
          name: new TextDecoder().decode(Uint8Array.from(groupData.name)),
          description: groupData.description.isSome
            ? new TextDecoder().decode(Uint8Array.from(groupData.description.unwrap()))
            : undefined,
          owner: groupData.owner.toString(),
          memberCount: groupData.memberCount.toNumber(),
          encryptionMode: groupData.encryptionMode.type as any,
          isPublic: groupData.isPublic.isTrue,
          createdAt: groupData.createdAt.toNumber(),
        };
      }

      return null;
    } catch (error) {
      console.error('获取群组信息失败:', error);
      throw error;
    }
  }

  /// 获取群组消息历史
  async getGroupMessages(
    groupId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<GroupMessage[]> {
    try {
      const api = await this.ensureApi();

      // 获取群组的所有消息
      const messages: GroupMessage[] = [];

      // 查询消息存储
      const messageEntries = await api.query.smartGroupChat.groupMessages.entries(parseInt(groupId));

      // MessageType 映射：数字 -> 字符串
      const messageTypeMap: { [key: number]: 'Text' | 'Image' | 'File' | 'Voice' } = {
        0: 'Text',
        1: 'Image',
        2: 'File',
        3: 'Voice',
      };

      for (const [key, messageOpt] of messageEntries) {
        if (messageOpt.isSome) {
          const messageData = messageOpt.unwrap();
          const messageId = key.args[1].toString();

          // 安全获取 messageType
          let messageType: 'Text' | 'Image' | 'File' | 'Voice' = 'Text';
          try {
            // messageData.messageType 可能是枚举对象或数字
            if (messageData.messageType) {
              if (typeof messageData.messageType.toNumber === 'function') {
                messageType = messageTypeMap[messageData.messageType.toNumber()] || 'Text';
              } else if (messageData.messageType.type) {
                messageType = messageData.messageType.type as any;
              } else if (messageData.messageType.isText) {
                messageType = 'Text';
              } else if (messageData.messageType.isImage) {
                messageType = 'Image';
              } else if (messageData.messageType.isFile) {
                messageType = 'File';
              } else if (messageData.messageType.isVoice) {
                messageType = 'Voice';
              }
            }
          } catch (e) {
            console.warn('解析 messageType 失败:', e);
          }

          messages.push({
            id: messageId,
            groupId: groupId,
            sender: messageData.sender.toString(),
            content: new TextDecoder().decode(Uint8Array.from(messageData.content)),
            messageType: messageType,
            encryptionMode: 'Business', // 链上结构无此字段，使用默认值
            timestamp: messageData.timestamp.toNumber(),
            // tempId 字段链上结构不存在，不传递
          });
        }
      }

      // 按时间戳排序并分页（升序，旧消息在前）
      messages.sort((a, b) => a.timestamp - b.timestamp);
      return messages.slice(offset, offset + limit);
    } catch (error) {
      console.error('获取群组消息失败:', error);
      throw error;
    }
  }

  /// 获取群组成员列表
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const api = await this.ensureApi();

      const members: GroupMember[] = [];

      // 查询群组成员存储
      const memberEntries = await api.query.smartGroupChat.groupMembers.entries(parseInt(groupId));

      for (const [key, memberOpt] of memberEntries) {
        if (memberOpt.isSome) {
          const memberData = memberOpt.unwrap();
          const accountId = key.args[1].toString();

          members.push({
            accountId: accountId,
            nickname: memberData.nickname.isSome
              ? new TextDecoder().decode(Uint8Array.from(memberData.nickname.unwrap()))
              : undefined,
            role: memberData.role.type as any,
            joinedAt: memberData.joinedAt.toNumber(),
          });
        }
      }

      // 按加入时间排序
      members.sort((a, b) => a.joinedAt - b.joinedAt);
      return members;
    } catch (error) {
      console.error('获取群组成员失败:', error);
      throw error;
    }
  }

  /// 获取用户参与的群组列表
  async getUserGroups(accountId: string): Promise<GroupInfo[]> {
    try {
      const api = await this.ensureApi();

      const groups: GroupInfo[] = [];

      // 获取用户作为成员的所有群组
      const memberEntries = await api.query.smartGroupChat.groupMembers.entries();

      const userGroupIds = new Set<string>();

      for (const [key, memberOpt] of memberEntries) {
        if (memberOpt.isSome) {
          const groupId = key.args[0].toString();
          const memberAccountId = key.args[1].toString();

          if (memberAccountId === accountId) {
            userGroupIds.add(groupId);
          }
        }
      }

      // 获取每个群组的详细信息
      for (const groupId of userGroupIds) {
        const groupInfo = await this.getGroupInfo(groupId);
        if (groupInfo) {
          groups.push(groupInfo);
        }
      }

      // 按创建时间倒序排列
      groups.sort((a, b) => b.createdAt - a.createdAt);
      return groups;
    } catch (error) {
      console.error('获取用户群组列表失败:', error);
      throw error;
    }
  }

  /// 解散群组 (仅群主)
  async disbandGroup(
    signer: KeyringPair,
    groupId: string
  ): Promise<void> {
    try {
      const api = await this.ensureApi();

      const tx = api.tx.smartGroupChat.disbandGroup(parseInt(groupId));

      return new Promise((resolve, reject) => {
        tx.signAndSend(signer, ({ status, events }) => {
          if (status.isInBlock) {
            // 查找群组解散事件
            const groupDisbandedEvent = events.find(
              ({ event }) => event.section === 'smartGroupChat' && event.method === 'GroupDisbanded'
            );

            if (groupDisbandedEvent) {
              resolve();
            } else {
              reject(new Error('群组解散事件未找到'));
            }
          } else if (status.isError) {
            reject(new Error('解散群组交易失败'));
          }
        }).catch(reject);
      });
    } catch (error) {
      console.error('解散群组失败:', error);
      throw error;
    }
  }

  /// 监听群组事件
  subscribeToGroupEvents(
    groupId: string,
    onMessage: (message: GroupMessage) => void,
    onMemberJoined: (member: GroupMember) => void,
    onMemberLeft: (accountId: string) => void,
    onEncryptionUpdated: (encryptionMode: string) => void
  ): () => void {
    let unsubscribe: () => void = () => {};

    this.ensureApi().then(api => {
      api.query.system.events((events) => {
        events.forEach(({ event }) => {
          if (event.section === 'smartGroupChat') {
            const eventGroupId = event.data[0]?.toString();

            // 只处理指定群组的事件
            if (eventGroupId !== groupId) return;

            switch (event.method) {
              case 'GroupMessageSent':
                // 处理新消息事件
                this.getGroupMessages(groupId, 1, 0).then(messages => {
                  if (messages.length > 0) {
                    onMessage(messages[0]);
                  }
                }).catch(console.error);
                break;

              case 'MemberJoined':
                // 处理成员加入事件
                const joinedAccountId = event.data[1]?.toString();
                if (joinedAccountId) {
                  this.getGroupMembers(groupId).then(members => {
                    const member = members.find(m => m.accountId === joinedAccountId);
                    if (member) {
                      onMemberJoined(member);
                    }
                  }).catch(console.error);
                }
                break;

              case 'MemberLeft':
                // 处理成员离开事件
                const leftAccountId = event.data[1]?.toString();
                if (leftAccountId) {
                  onMemberLeft(leftAccountId);
                }
                break;

              case 'GroupEncryptionUpdated':
                // 处理加密模式更新事件
                const newEncryptionMode = event.data[2]?.toString();
                if (newEncryptionMode) {
                  onEncryptionUpdated(newEncryptionMode);
                }
                break;
            }
          }
        });
      }).then(unsub => {
        unsubscribe = unsub;
      }).catch(console.error);
    });

    // 返回取消订阅函数
    return () => unsubscribe();
  }
}

/// 单例实例
export const smartChatService = new SmartChatService();

/// 导出默认实例
export default smartChatService;