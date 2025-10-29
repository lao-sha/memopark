/**
 * 做市商申请相关类型定义
 * 
 * 创建日期: 2025-10-29
 * 目的: 
 * 1. 将类型定义从CreateMarketMakerPage.tsx中提取
 * 2. 提供统一的类型管理
 * 3. 为未来组件拆分做准备
 */

/**
 * 函数级详细中文注释：申请详情数据结构（完整版）
 * - 包含所有可能从链上拉取的字段
 * - 用于自动填充表单
 */
export interface ApplicationDetails {
  /** 做市商ID */
  mmId: number;
  /** 所有者地址 */
  owner: string;
  /** 质押金额 */
  deposit: string;
  /** 申请状态 */
  status: string;
  /** 公开资料CID */
  publicCid: string;
  /** 私密资料CID */
  privateCid: string;
  /** 最小下单金额 */
  minAmount: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 资料提交截止时间 */
  infoDeadline: number;
  /** 审核截止时间 */
  reviewDeadline: number;
  
  // 🆕 2025-10-19: 扩展字段（用于自动填充）
  /** 买入溢价（基点） */
  buyPremiumBps?: number;
  /** 卖出溢价（基点） */
  sellPremiumBps?: number;
  /** TRON地址 */
  tronAddress?: string;
  
  // 🆕 2025-10-21: 收款方式列表（替换epay配置）
  /** 收款方式配置 */
  paymentMethods?: string[];
}

/**
 * 函数级详细中文注释：做市商配置信息数据结构
 */
export interface MarketMakerConfig {
  /** 最小质押金额 */
  minDeposit: string;
  /** 最小下单额 */
  minAmount: string;
  /** 审核开关 */
  reviewEnabled: boolean;
  /** 是否为当前用户的申请记录 */
  isUserApplication: boolean;
  /** 申请状态 */
  applicationStatus?: string;
  /** 做市商ID */
  applicationMmId?: number;
}

/**
 * 函数级详细中文注释：申请步骤枚举
 * 
 * 用于标识做市商申请的当前阶段
 */
export enum ApplicationStep {
  /** 步骤0：质押DUST，获取mmId */
  Deposit = 0,
  /** 步骤1：提交资料（证件、费率配置等） */
  Submit = 1,
  /** 步骤2：等待审核 */
  Review = 2,
}

/**
 * 函数级详细中文注释：申请状态枚举
 * 
 * 对应链上的ApplicationStatus
 */
export enum ApplicationStatus {
  /** 待提交资料 */
  Pending = 'Pending',
  /** 已提交，待审核 */
  Submitted = 'Submitted',
  /** 审核通过 */
  Approved = 'Approved',
  /** 审核拒绝 */
  Rejected = 'Rejected',
  /** 已激活（可以开始做市） */
  Active = 'Active',
  /** 已暂停 */
  Paused = 'Paused',
}

/**
 * 函数级详细中文注释：质押表单数据
 */
export interface DepositFormData {
  /** 质押金额（DUST） */
  amount: string;
}

/**
 * 函数级详细中文注释：资料提交表单数据
 */
export interface SubmissionFormData {
  /** 真实姓名 */
  realName: string;
  /** TRON地址 */
  tronAddress: string;
  /** 买入溢价（基点，0-10000） */
  buyPremiumBps: number;
  /** 卖出溢价（基点，0-10000） */
  sellPremiumBps: number;
  /** 最小下单金额（USDT） */
  minAmount: string;
  /** 公开资料CID */
  publicCid: string;
  /** 私密资料CID */
  privateCid: string;
  /** 收款方式列表 */
  paymentMethods: string[];
}

/**
 * 函数级详细中文注释：缓存数据结构
 * 
 * 用于localStorage存储申请进度
 */
export interface ApplicationCache {
  /** 做市商ID */
  mmId: number;
  /** 当前步骤 */
  step: ApplicationStep;
  /** 截止时间戳 */
  deadline: number;
  /** 缓存时间戳 */
  cachedAt: number;
}

