/**
 * 聊天功能类型定义
 * 
 * 说明：
 * - 与链上 pallet-chat 数据结构对应
 * - 支持端到端加密的消息传输
 * - IPFS 存储加密内容，链上存储元数据
 */

/**
 * 消息类型枚举
 * 对应链上 MessageType
 */
export enum MessageType {
  /** 文本消息 */
  Text = 0,
  /** 图片消息 */
  Image = 1,
  /** 文件消息 */
  File = 2,
  /** 语音消息 */
  Voice = 3,
  /** 系统消息 */
  System = 4,
}

/**
 * 消息状态枚举
 */
export enum MessageStatus {
  /** 发送中 */
  Sending = 'sending',
  /** 已发送 */
  Sent = 'sent',
  /** 已送达 */
  Delivered = 'delivered',
  /** 已读 */
  Read = 'read',
  /** 发送失败 */
  Failed = 'failed',
}

/**
 * 消息元数据（链上存储）
 */
export interface MessageMeta {
  /** 消息ID */
  id: number;
  /** 发送方地址 */
  sender: string;
  /** 接收方地址 */
  receiver: string;
  /** IPFS CID（加密内容） */
  contentCid: string;
  /** 会话ID */
  sessionId: string;
  /** 消息类型 */
  msgType: MessageType;
  /** 发送时间（区块高度） */
  sentAt: number;
  /** 是否已读 */
  isRead: boolean;
  /** 是否已删除 */
  isDeleted: boolean;
}

/**
 * 消息内容（IPFS存储，加密）
 */
export interface MessageContent {
  /** 文本内容（Text类型） */
  text?: string;
  /** 图片URL（Image类型） */
  imageUrl?: string;
  /** 文件URL（File类型） */
  fileUrl?: string;
  /** 文件名 */
  fileName?: string;
  /** 文件大小（字节） */
  fileSize?: number;
  /** 语音URL（Voice类型） */
  voiceUrl?: string;
  /** 语音时长（秒） */
  voiceDuration?: number;
  /** 系统消息内容（System类型） */
  systemMsg?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 完整消息（前端使用）
 */
export interface Message {
  /** 消息ID */
  id: number;
  /** 发送方地址 */
  sender: string;
  /** 接收方地址 */
  receiver: string;
  /** 消息类型 */
  type: MessageType;
  /** 消息内容（已解密） */
  content: MessageContent;
  /** 发送时间 */
  timestamp: number;
  /** 消息状态 */
  status: MessageStatus;
  /** 是否已读 */
  isRead: boolean;
  /** 是否已删除 */
  isDeleted: boolean;
  /** 是否是我发送的 */
  isMine: boolean;
}

/**
 * 会话信息
 */
export interface Session {
  /** 会话ID */
  id: string;
  /** 参与者列表 */
  participants: string[];
  /** 最后一条消息ID */
  lastMessageId: number;
  /** 最后活跃时间 */
  lastActive: number;
  /** 创建时间 */
  createdAt: number;
  /** 是否归档 */
  isArchived: boolean;
  /** 未读消息数 */
  unreadCount: number;
  /** 对方信息 */
  otherUser?: {
    address: string;
    name?: string;
    avatar?: string;
  };
  /** 最后一条消息预览 */
  lastMessage?: {
    content: string;
    timestamp: number;
    isMine: boolean;
  };
}

/**
 * 发送消息参数
 */
export interface SendMessageParams {
  /** 接收方地址 */
  receiver: string;
  /** 消息内容 */
  content: MessageContent;
  /** 消息类型 */
  type: MessageType;
  /** 会话ID（可选） */
  sessionId?: string;
}

/**
 * 加密消息参数
 */
export interface EncryptMessageParams {
  /** 消息内容 */
  content: MessageContent;
  /** 接收方公钥 */
  receiverPublicKey: string;
}

/**
 * 解密消息参数
 */
export interface DecryptMessageParams {
  /** 加密的消息内容 */
  encryptedContent: string;
  /** 我的私钥 */
  myPrivateKey: string;
}

/**
 * IPFS上传结果
 */
export interface IpfsUploadResult {
  /** CID */
  cid: string;
  /** 文件大小 */
  size: number;
  /** 上传时间 */
  timestamp: number;
}

/**
 * 聊天事件
 */
export interface ChatEvent {
  /** 事件类型 */
  type: 'MessageSent' | 'MessageRead' | 'MessageDeleted' | 'SessionCreated' | 'SessionMarkedAsRead';
  /** 事件数据 */
  data: {
    msgId?: number;
    sessionId?: string;
    sender?: string;
    receiver?: string;
    reader?: string;
    deleter?: string;
    user?: string;
    participants?: string[];
  };
}

