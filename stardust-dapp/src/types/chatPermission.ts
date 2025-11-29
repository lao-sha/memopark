/**
 * 聊天权限系统类型定义
 *
 * 说明：
 * - 与链上 pallet-chat-permission 数据结构对应
 * - 支持场景化多场景共存聊天权限控制
 * - 四层权限判断：黑名单 → 好友 → 场景授权 → 隐私设置
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 */

// ========== 场景类型枚举 ==========

/**
 * 场景类型枚举
 *
 * 定义系统支持的各种聊天场景类型。
 * 业务模块通过场景类型区分不同的聊天授权来源。
 *
 * 对应链上：pallet_chat_permission::types::SceneType
 */
export enum SceneType {
  /** 做市商场景：用户可咨询做市商 */
  MarketMaker = 'MarketMaker',

  /** 订单场景：订单买卖双方 */
  Order = 'Order',

  /** 纪念馆场景：访客可联系管理员 */
  Memorial = 'Memorial',

  /** 群聊场景：群成员之间的聊天 */
  Group = 'Group',

  /** 自定义场景：用于扩展新的业务场景 */
  Custom = 'Custom',
}

/**
 * 场景类型编码映射
 *
 * 用于将前端枚举转换为链上 SCALE 编码格式。
 */
export const SceneTypeCodec: Record<SceneType, number> = {
  [SceneType.MarketMaker]: 0,
  [SceneType.Order]: 1,
  [SceneType.Memorial]: 2,
  [SceneType.Group]: 3,
  [SceneType.Custom]: 4,
}

/**
 * 场景类型显示名称
 */
export const SceneTypeDisplay: Record<SceneType, string> = {
  [SceneType.MarketMaker]: '做市商咨询',
  [SceneType.Order]: '订单沟通',
  [SceneType.Memorial]: '纪念馆访客',
  [SceneType.Group]: '群聊',
  [SceneType.Custom]: '自定义场景',
}

// ========== 场景标识符枚举 ==========

/**
 * 场景标识符类型枚举
 *
 * 用于唯一标识某个具体的业务场景实例。
 *
 * 对应链上：pallet_chat_permission::types::SceneId
 */
export enum SceneIdType {
  /** 无特定 ID（如 MarketMaker 场景） */
  None = 'None',

  /** 数字 ID（订单号、纪念馆ID等） */
  Numeric = 'Numeric',

  /** Hash ID（复杂标识） */
  Hash = 'Hash',
}

/**
 * 场景标识符
 *
 * 用于标识具体的业务场景实例。
 */
export interface SceneId {
  /** 标识符类型 */
  type: SceneIdType
  /** 数字值（当 type 为 Numeric 时有效） */
  numericValue?: bigint | number
  /** Hash值（当 type 为 Hash 时有效，32字节） */
  hashValue?: string
}

/**
 * 创建无标识符的场景ID
 */
export function createNoneSceneId(): SceneId {
  return { type: SceneIdType.None }
}

/**
 * 创建数字类型的场景ID
 */
export function createNumericSceneId(value: bigint | number): SceneId {
  return { type: SceneIdType.Numeric, numericValue: value }
}

/**
 * 创建Hash类型的场景ID
 */
export function createHashSceneId(hash: string): SceneId {
  return { type: SceneIdType.Hash, hashValue: hash }
}

// ========== 聊天权限级别枚举 ==========

/**
 * 聊天权限级别枚举
 *
 * 定义用户的基础聊天权限策略，决定陌生人能否发起聊天。
 *
 * 对应链上：pallet_chat_permission::types::ChatPermissionLevel
 */
export enum ChatPermissionLevel {
  /** 开放：任何人可发起聊天 */
  Open = 'Open',

  /** 仅好友：需要互加好友才能聊天（默认） */
  FriendsOnly = 'FriendsOnly',

  /** 白名单：仅白名单用户可发起聊天 */
  Whitelist = 'Whitelist',

  /** 关闭：不接受任何消息 */
  Closed = 'Closed',
}

/**
 * 权限级别编码映射
 */
export const PermissionLevelCodec: Record<ChatPermissionLevel, number> = {
  [ChatPermissionLevel.Open]: 0,
  [ChatPermissionLevel.FriendsOnly]: 1,
  [ChatPermissionLevel.Whitelist]: 2,
  [ChatPermissionLevel.Closed]: 3,
}

/**
 * 权限级别显示名称
 */
export const PermissionLevelDisplay: Record<ChatPermissionLevel, string> = {
  [ChatPermissionLevel.Open]: '公开',
  [ChatPermissionLevel.FriendsOnly]: '仅好友',
  [ChatPermissionLevel.Whitelist]: '白名单',
  [ChatPermissionLevel.Closed]: '关闭',
}

/**
 * 权限级别描述
 */
export const PermissionLevelDescription: Record<ChatPermissionLevel, string> = {
  [ChatPermissionLevel.Open]: '任何人都可以给您发消息',
  [ChatPermissionLevel.FriendsOnly]: '只有互相加为好友的用户才能聊天',
  [ChatPermissionLevel.Whitelist]: '只有白名单中的用户可以发消息',
  [ChatPermissionLevel.Closed]: '不接受任何新消息',
}

// ========== 权限检查结果枚举 ==========

/**
 * 权限检查结果类型枚举
 *
 * 对应链上：pallet_chat_permission::types::PermissionResult
 */
export enum PermissionResultType {
  /** 允许（开放模式） */
  Allowed = 'Allowed',

  /** 允许（好友关系） */
  AllowedByFriendship = 'AllowedByFriendship',

  /** 允许（有场景授权） */
  AllowedByScene = 'AllowedByScene',

  /** 拒绝：已被屏蔽 */
  DeniedBlocked = 'DeniedBlocked',

  /** 拒绝：需要好友关系 */
  DeniedRequiresFriend = 'DeniedRequiresFriend',

  /** 拒绝：不在白名单 */
  DeniedNotInWhitelist = 'DeniedNotInWhitelist',

  /** 拒绝：对方已关闭聊天 */
  DeniedClosed = 'DeniedClosed',
}

/**
 * 权限检查结果
 */
export interface PermissionResult {
  /** 结果类型 */
  type: PermissionResultType
  /** 有效的场景类型列表（当 type 为 AllowedByScene 时有效） */
  allowedScenes?: SceneType[]
}

/**
 * 判断权限结果是否允许聊天
 */
export function isPermissionAllowed(result: PermissionResult): boolean {
  return (
    result.type === PermissionResultType.Allowed ||
    result.type === PermissionResultType.AllowedByFriendship ||
    result.type === PermissionResultType.AllowedByScene
  )
}

/**
 * 获取权限拒绝原因的显示文本
 */
export function getPermissionDeniedReason(result: PermissionResult): string {
  switch (result.type) {
    case PermissionResultType.DeniedBlocked:
      return '您已被对方拉黑'
    case PermissionResultType.DeniedRequiresFriend:
      return '需要先添加好友'
    case PermissionResultType.DeniedNotInWhitelist:
      return '您不在对方白名单中'
    case PermissionResultType.DeniedClosed:
      return '对方已关闭聊天功能'
    default:
      return ''
  }
}

// ========== 场景授权相关类型 ==========

/**
 * 场景授权信息
 *
 * 记录两个用户之间某个场景的聊天授权详情。
 *
 * 对应链上：pallet_chat_permission::types::SceneAuthorizationInfo
 */
export interface SceneAuthorizationInfo {
  /** 场景类型 */
  sceneType: SceneType
  /** 场景标识 */
  sceneId: SceneId
  /** 是否已过期 */
  isExpired: boolean
  /** 过期时间（区块号，可选） */
  expiresAt?: number
  /** 元数据（字节数组，用于前端解析显示） */
  metadata: Uint8Array | string
}

/**
 * 完整的场景授权结构（内部使用）
 *
 * 对应链上：pallet_chat_permission::types::SceneAuthorization
 */
export interface SceneAuthorization {
  /** 场景类型 */
  sceneType: SceneType
  /** 场景标识 */
  sceneId: SceneId
  /** 授权来源 pallet 标识（8字节） */
  sourcePallet: string
  /** 授权时间（区块号） */
  grantedAt: number
  /** 过期时间（区块号，可选） */
  expiresAt?: number
  /** 元数据（最大128字节） */
  metadata: Uint8Array | string
}

// ========== 隐私设置相关类型 ==========

/**
 * 隐私设置摘要
 *
 * 用于前端显示用户的隐私设置概要。
 *
 * 对应链上：pallet_chat_permission::types::PrivacySettingsSummary
 */
export interface PrivacySettingsSummary {
  /** 权限级别 */
  permissionLevel: ChatPermissionLevel
  /** 黑名单数量 */
  blockListCount: number
  /** 白名单数量 */
  whitelistCount: number
  /** 拒绝的场景类型列表 */
  rejectedSceneTypes: SceneType[]
}

/**
 * 完整隐私设置
 */
export interface PrivacySettings {
  /** 权限级别 */
  permissionLevel: ChatPermissionLevel
  /** 黑名单地址列表 */
  blockList: string[]
  /** 白名单地址列表 */
  whitelist: string[]
  /** 拒绝的场景类型列表 */
  rejectedSceneTypes: SceneType[]
  /** 最后更新区块号 */
  updatedAt: number
}

// ========== 好友关系类型 ==========

/**
 * 好友关系状态
 */
export enum FriendshipStatus {
  /** 非好友 */
  NotFriends = 'NotFriends',
  /** 我发送了请求（等待对方确认） */
  PendingSent = 'PendingSent',
  /** 收到请求（等待我确认） */
  PendingReceived = 'PendingReceived',
  /** 已是好友 */
  Friends = 'Friends',
}

/**
 * 好友信息
 */
export interface FriendInfo {
  /** 好友地址 */
  address: string
  /** 添加时间 */
  addedAt: number
  /** 昵称（可选） */
  nickname?: string
  /** 头像CID（可选） */
  avatarCid?: string
}

// ========== 事件类型 ==========

/**
 * 聊天权限事件类型
 */
export enum ChatPermissionEventType {
  /** 场景授权已授予 */
  SceneAuthorizationGranted = 'SceneAuthorizationGranted',
  /** 场景授权已撤销 */
  SceneAuthorizationRevoked = 'SceneAuthorizationRevoked',
  /** 好友关系已更新 */
  FriendshipUpdated = 'FriendshipUpdated',
  /** 隐私设置已更新 */
  PrivacySettingsUpdated = 'PrivacySettingsUpdated',
  /** 用户已被加入黑名单 */
  UserBlocked = 'UserBlocked',
  /** 用户已从黑名单移除 */
  UserUnblocked = 'UserUnblocked',
  /** 用户已添加到白名单 */
  UserWhitelisted = 'UserWhitelisted',
  /** 用户已从白名单移除 */
  UserRemovedFromWhitelist = 'UserRemovedFromWhitelist',
}

/**
 * 聊天权限事件数据
 */
export interface ChatPermissionEvent {
  /** 事件类型 */
  type: ChatPermissionEventType
  /** 事件数据 */
  data: {
    /** 用户1地址 */
    user1?: string
    /** 用户2地址 */
    user2?: string
    /** 场景类型 */
    sceneType?: SceneType
    /** 场景ID */
    sceneId?: SceneId
    /** 目标用户 */
    targetUser?: string
  }
}

// ========== 查询参数类型 ==========

/**
 * 授予场景授权参数
 */
export interface GrantSceneParams {
  /** 用户1地址 */
  user1: string
  /** 用户2地址 */
  user2: string
  /** 场景类型 */
  sceneType: SceneType
  /** 场景ID */
  sceneId: SceneId
  /** 过期区块数（可选，从当前区块开始计算） */
  expiresInBlocks?: number
  /** 元数据（可选） */
  metadata?: string
}

/**
 * 撤销场景授权参数
 */
export interface RevokeSceneParams {
  /** 用户1地址 */
  user1: string
  /** 用户2地址 */
  user2: string
  /** 场景类型 */
  sceneType: SceneType
  /** 场景ID */
  sceneId: SceneId
}

/**
 * 更新隐私设置参数
 */
export interface UpdatePrivacySettingsParams {
  /** 新的权限级别（可选） */
  permissionLevel?: ChatPermissionLevel
  /** 要添加到黑名单的用户列表（可选） */
  addToBlockList?: string[]
  /** 要从黑名单移除的用户列表（可选） */
  removeFromBlockList?: string[]
  /** 要添加到白名单的用户列表（可选） */
  addToWhitelist?: string[]
  /** 要从白名单移除的用户列表（可选） */
  removeFromWhitelist?: string[]
  /** 要拒绝的场景类型列表（可选） */
  rejectSceneTypes?: SceneType[]
  /** 要允许的场景类型列表（可选） */
  allowSceneTypes?: SceneType[]
}

// ========== 工具类型 ==========

/**
 * 场景元数据解析结果
 */
export interface ParsedSceneMetadata {
  /** 订单金额（对于 Order 场景） */
  orderAmount?: string
  /** 订单状态（对于 Order 场景） */
  orderStatus?: string
  /** 纪念馆名称（对于 Memorial 场景） */
  memorialName?: string
  /** 群聊名称（对于 Group 场景） */
  groupName?: string
  /** 自定义标签（对于 Custom 场景） */
  customLabel?: string
  /** 原始数据 */
  raw: string
}

/**
 * 解析场景元数据
 *
 * @param metadata 元数据字节数组或字符串
 * @param sceneType 场景类型
 * @returns 解析后的元数据对象
 */
export function parseSceneMetadata(
  metadata: Uint8Array | string,
  sceneType: SceneType
): ParsedSceneMetadata {
  // 将 Uint8Array 转换为字符串
  const rawString =
    typeof metadata === 'string'
      ? metadata
      : new TextDecoder().decode(metadata)

  const result: ParsedSceneMetadata = { raw: rawString }

  try {
    // 尝试解析为 JSON
    const parsed = JSON.parse(rawString)

    switch (sceneType) {
      case SceneType.Order:
        result.orderAmount = parsed.amount
        result.orderStatus = parsed.status
        break
      case SceneType.Memorial:
        result.memorialName = parsed.name
        break
      case SceneType.Group:
        result.groupName = parsed.name
        break
      case SceneType.Custom:
        result.customLabel = parsed.label
        break
    }
  } catch {
    // 如果不是 JSON，直接使用原始字符串
    switch (sceneType) {
      case SceneType.Order:
        result.orderStatus = rawString
        break
      case SceneType.Memorial:
        result.memorialName = rawString
        break
      case SceneType.Group:
        result.groupName = rawString
        break
      case SceneType.Custom:
        result.customLabel = rawString
        break
    }
  }

  return result
}

/**
 * 用户对信息（用于双向存储的 key）
 *
 * 注意：用户对始终按地址字典序排序，确保一致性
 */
export interface UserPair {
  /** 字典序较小的用户地址 */
  user1: string
  /** 字典序较大的用户地址 */
  user2: string
}

/**
 * 创建排序后的用户对
 *
 * @param addressA 用户A地址
 * @param addressB 用户B地址
 * @returns 排序后的用户对
 */
export function createUserPair(addressA: string, addressB: string): UserPair {
  if (addressA < addressB) {
    return { user1: addressA, user2: addressB }
  }
  return { user1: addressB, user2: addressA }
}

// ========== 常量定义 ==========

/**
 * 源 Pallet 标识符常量
 */
export const SourcePalletIds = {
  /** OTC 订单 pallet */
  OTC_ORDER: 'otc_ordr',
  /** 做市商 pallet */
  MAKER: 'maker___',
  /** 纪念馆 pallet */
  MEMORIAL: 'memorial',
  /** 群聊 pallet */
  GROUP: 'group___',
} as const

/**
 * 默认场景授权过期时间（区块数）
 * 7 天 = 7 * 24 * 60 * 60 / 6 ≈ 100800 区块
 */
export const DEFAULT_SCENE_EXPIRY_BLOCKS = 100800

/**
 * 订单场景授权过期时间（区块数）
 * 30 天 = 30 * 24 * 60 * 60 / 6 ≈ 432000 区块
 */
export const ORDER_SCENE_EXPIRY_BLOCKS = 432000

/**
 * 永久授权标识
 */
export const PERMANENT_AUTHORIZATION = null
