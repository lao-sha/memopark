/**
 * IPFS自动Pin功能相关的TypeScript类型定义
 * 
 * 功能范围：
 * - Pin状态查询和显示
 * - 三重扣款机制（Pool→Subject→Caller）
 * - 存储费用统计和监控
 * - 池账户余额查询
 * 
 * 创建时间：2025-10-12
 */

// ============= Pin状态相关类型 =============

/**
 * Pin状态枚举
 */
export enum PinStatus {
  /** 等待pin：已提交请求，等待OCW处理 */
  Pending = 'pending',
  /** 活跃pin：已成功pin到IPFS，正在维护副本 */
  Active = 'active',
  /** Pin失败：所有尝试都失败 */
  Failed = 'failed',
  /** 未知状态：链上查询不到该CID */
  Unknown = 'unknown',
}

/**
 * Pin记录详情
 */
export interface PinRecord {
  /** IPFS CID（十六进制字符串） */
  cid: string;
  /** 当前状态 */
  status: PinStatus;
  /** 当前副本数 */
  currentReplicas: number;
  /** 目标副本数 */
  targetReplicas: number;
  /** 关联的逝者ID */
  deceasedId: number;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 最后更新时间（区块号，可选） */
  updatedAt?: number;
  /** 失败原因（如果状态为Failed，可选） */
  failureReason?: string;
}

/**
 * CID类型（用于分类显示）
 */
export enum CidType {
  /** 逝者姓名 */
  DeceasedName = 'deceased_name',
  /** 逝者主图 */
  DeceasedMainImage = 'deceased_main_image',
  /** 媒体文件（Photo/Video/Audio） */
  Media = 'media',
  /** 媒体缩略图 */
  MediaThumbnail = 'media_thumbnail',
  /** 文章 */
  TextArticle = 'text_article',
  /** 留言 */
  TextMessage = 'text_message',
  /** 生平 */
  TextLife = 'text_life',
  /** 悼词 */
  TextEulogy = 'text_eulogy',
  /** 证据图片 */
  EvidenceImage = 'evidence_image',
  /** 证据视频 */
  EvidenceVideo = 'evidence_video',
  /** 证据文档 */
  EvidenceDocument = 'evidence_document',
  /** 纪念馆音频 */
  MemorialAudio = 'memorial_audio',
}

/**
 * 带类型标识的Pin记录
 */
export interface TypedPinRecord extends PinRecord {
  /** CID类型 */
  cidType: CidType;
  /** 类型显示名称（中文） */
  typeDisplayName: string;
}

// ============= 三重扣款机制相关类型 =============

/**
 * 扣费来源
 */
export enum ChargeSource {
  /** 从IPFS公共池扣款 */
  IpfsPool = 'ipfs_pool',
  /** 从逝者专户（SubjectFunding）扣款 */
  SubjectFunding = 'subject_funding',
  /** 从调用者账户扣款（兜底） */
  Caller = 'caller',
  /** 未知来源 */
  Unknown = 'unknown',
}

/**
 * 三重扣款信息
 */
export interface TripleChargeInfo {
  /** IPFS池账户余额（单位：最小单位） */
  poolBalance: bigint;
  /** IPFS池本月已使用配额（单位：最小单位） */
  poolQuotaUsed: bigint;
  /** IPFS池月度总配额（单位：最小单位） */
  poolQuotaTotal: bigint;
  /** IPFS池剩余配额（单位：最小单位） */
  poolQuotaRemaining: bigint;
  /** 逝者专户余额（单位：最小单位） */
  subjectFundingBalance: bigint;
  /** 调用者账户余额（单位：最小单位） */
  callerBalance: bigint;
  /** 预估的扣费来源 */
  likelySource: ChargeSource;
  /** 预估的存储费用（单位：最小单位） */
  estimatedCost: bigint;
  /** 配额重置剩余区块数 */
  quotaResetInBlocks: number;
  /** 配额重置预计时间（Unix时间戳，毫秒） */
  quotaResetEta: number;
}

/**
 * 扣费结果
 */
export interface ChargeResult {
  /** 是否成功 */
  success: boolean;
  /** 实际扣费来源 */
  actualSource: ChargeSource;
  /** 实际扣费金额（单位：最小单位） */
  actualAmount: bigint;
  /** 交易哈希（如果成功） */
  txHash?: string;
  /** 错误信息（如果失败） */
  error?: string;
}

// ============= 存储费用统计相关类型 =============

/**
 * 存储费用统计
 */
export interface StorageFeeStats {
  /** 本月从池账户扣款总额（单位：最小单位） */
  totalFromPool: bigint;
  /** 本月从逝者专户扣款总额（单位：最小单位） */
  totalFromSubject: bigint;
  /** 本月从调用者账户扣款总额（单位：最小单位） */
  totalFromCaller: bigint;
  /** 本月总扣款额（单位：最小单位） */
  totalCharged: bigint;
  /** 本月从池账户扣款次数 */
  poolChargeCount: number;
  /** 本月从逝者专户扣款次数 */
  subjectChargeCount: number;
  /** 本月从调用者账户扣款次数 */
  callerChargeCount: number;
  /** 总扣款次数 */
  totalChargeCount: number;
  /** 配额重置剩余区块数 */
  poolResetInBlocks: number;
  /** 配额重置预计时间（Unix时间戳，毫秒） */
  poolResetEta: number;
}

/**
 * 单次扣费记录
 */
export interface ChargeFeeRecord {
  /** 区块号 */
  blockNumber: number;
  /** 区块时间戳 */
  timestamp: number;
  /** 扣费来源 */
  source: ChargeSource;
  /** 扣费金额（单位：最小单位） */
  amount: bigint;
  /** 逝者ID */
  deceasedId: number;
  /** 关联的CID */
  cid: string;
  /** 调用者账户 */
  caller: string;
  /** 交易哈希 */
  txHash: string;
}

// ============= 池账户相关类型 =============

/**
 * 存储池类型
 */
export enum StoragePoolType {
  /** IPFS存储池 */
  Ipfs = 'ipfs',
  /** Arweave存储池 */
  Arweave = 'arweave',
  /** 节点维护池 */
  NodeMaintenance = 'node_maintenance',
}

/**
 * 存储池账户信息
 */
export interface StoragePoolAccount {
  /** 池类型 */
  poolType: StoragePoolType;
  /** 池账户地址（SS58格式） */
  address: string;
  /** 当前余额（单位：最小单位） */
  balance: bigint;
  /** 本月已使用配额（单位：最小单位，仅IPFS） */
  quotaUsed?: bigint;
  /** 月度总配额（单位：最小单位，仅IPFS） */
  quotaTotal?: bigint;
  /** 剩余配额（单位：最小单位，仅IPFS） */
  quotaRemaining?: bigint;
  /** 配额重置剩余区块数（仅IPFS） */
  resetInBlocks?: number;
  /** 配额重置预计时间（Unix时间戳，毫秒，仅IPFS） */
  resetEta?: number;
  /** 显示名称（中文） */
  displayName: string;
}

/**
 * 运营者托管账户信息
 */
export interface OperatorEscrowAccount {
  /** 托管账户地址（SS58格式） */
  address: string;
  /** 当前余额（单位：最小单位） */
  balance: bigint;
  /** 累计收款总额（单位：最小单位） */
  totalReceived: bigint;
  /** 显示名称（中文） */
  displayName: string;
}

// ============= 存储路由相关类型 =============

/**
 * 存储路由条目
 */
export interface StorageRouteEntry {
  /** 路由类型（0=Burn, 1=SpecificAccount） */
  kind: number;
  /** 目标账户（如果kind=1） */
  account?: string;
  /** 分配比例（百分比，0-100） */
  share: number;
  /** 显示名称（中文） */
  displayName: string;
}

/**
 * 存储路由表
 */
export interface StorageRouteTable {
  /** 路由条目列表 */
  entries: StorageRouteEntry[];
  /** 最后更新时间（Unix时间戳，毫秒） */
  lastUpdated: number;
  /** 最后更新的区块号 */
  lastUpdatedBlock: number;
}

// ============= API响应类型 =============

/**
 * Pin状态查询响应
 */
export interface PinStatusResponse {
  /** 是否成功 */
  success: boolean;
  /** Pin记录（如果找到） */
  data?: PinRecord;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 三重扣款信息查询响应
 */
export interface TripleChargeInfoResponse {
  /** 是否成功 */
  success: boolean;
  /** 三重扣款信息（如果成功） */
  data?: TripleChargeInfo;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 存储费用统计查询响应
 */
export interface StorageFeeStatsResponse {
  /** 是否成功 */
  success: boolean;
  /** 费用统计（如果成功） */
  data?: StorageFeeStats;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 存储池账户查询响应
 */
export interface StoragePoolAccountsResponse {
  /** 是否成功 */
  success: boolean;
  /** 存储池账户列表（如果成功） */
  data?: StoragePoolAccount[];
  /** 运营者托管账户（如果成功） */
  operatorEscrow?: OperatorEscrowAccount;
  /** 错误信息（如果失败） */
  error?: string;
}

// ============= 辅助类型 =============

/**
 * 账户地址信息
 */
export interface AccountInfo {
  /** 账户地址（SS58格式） */
  address: string;
  /** 余额（单位：最小单位） */
  balance: bigint;
  /** 显示名称（可选） */
  displayName?: string;
}

/**
 * 逝者专户（SubjectFunding）地址派生参数
 */
export interface SubjectFundingDerivation {
  /** 域标识（1=逝者，2=纪念馆/园区等） */
  domain: number;
  /** 主体ID（deceased_id, memorial_id 等） */
  subjectId: number;
}

/**
 * 格式化选项
 */
export interface FormatOptions {
  /** 是否显示单位（如 DUST） */
  showUnit?: boolean;
  /** 小数位数 */
  decimals?: number;
  /** 是否使用千分位分隔符 */
  useGrouping?: boolean;
}

// ============= 常量定义 =============

/**
 * 链上常量
 */
export const CHAIN_CONSTANTS = {
  /** DUST代币精度（10^12） */
  UNIT: 1_000_000_000_000n,
  /** 月度公共费用配额（100 DUST） */
  MONTHLY_PUBLIC_FEE_QUOTA: 100n * 1_000_000_000_000n,
  /** 配额重置周期（28天，以6秒/块计算） */
  QUOTA_RESET_PERIOD_BLOCKS: 100_800 * 4,
  /** 默认存储单价（1 DUST/副本/月） */
  DEFAULT_STORAGE_PRICE: 1n * 1_000_000_000_000n,
  /** 默认副本数 */
  DEFAULT_REPLICAS: 3,
  /** 平均出块时间（秒） */
  BLOCK_TIME_SECONDS: 6,
} as const;

/**
 * 池账户地址（SS58格式，链特定）
 */
export const POOL_ADDRESSES = {
  /** IPFS存储池 */
  IPFS_POOL: '5EYCAe5jLbHcAAMKvLFSXgCTbPrLgBJusvPwfKcaKzuf5X5e',
  /** Arweave存储池 */
  ARWEAVE_POOL: '5EYCAe5jLbHcAAMKvLFiXeqNMkGNkTxX8Zrt8K5MLdSwvD9g',
  /** 节点维护池 */
  NODE_MAINTENANCE_POOL: '5EYCAe5jLbHcAAMKvLFiXCvJn4fX7vXwMqWq8cXvD4fXBqqW',
  /** 运营者托管 */
  OPERATOR_ESCROW: '5EYCAe5jLbHcAAMKvLFSXgCTbPrLgBJusvPwfKcaKzuf5Oph',
} as const;

/**
 * CID类型显示名称映射
 */
export const CID_TYPE_NAMES: Record<CidType, string> = {
  [CidType.DeceasedName]: '逝者姓名',
  [CidType.DeceasedMainImage]: '逝者主图',
  [CidType.Media]: '媒体文件',
  [CidType.MediaThumbnail]: '媒体缩略图',
  [CidType.TextArticle]: '文章',
  [CidType.TextMessage]: '留言',
  [CidType.TextLife]: '生平',
  [CidType.TextEulogy]: '悼词',
  [CidType.EvidenceImage]: '证据图片',
  [CidType.EvidenceVideo]: '证据视频',
  [CidType.EvidenceDocument]: '证据文档',
  [CidType.MemorialAudio]: '纪念馆音频',
};

/**
 * 扣费来源显示名称映射
 */
export const CHARGE_SOURCE_NAMES: Record<ChargeSource, string> = {
  [ChargeSource.IpfsPool]: 'IPFS公共池',
  [ChargeSource.SubjectFunding]: '逝者专户',
  [ChargeSource.Caller]: '调用者账户',
  [ChargeSource.Unknown]: '未知来源',
};

/**
 * Pin状态显示名称映射
 */
export const PIN_STATUS_NAMES: Record<PinStatus, string> = {
  [PinStatus.Pending]: '等待Pin',
  [PinStatus.Active]: '已Pin',
  [PinStatus.Failed]: 'Pin失败',
  [PinStatus.Unknown]: '未知状态',
};

