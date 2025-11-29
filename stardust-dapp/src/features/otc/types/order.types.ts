/**
 * 函数级详细中文注释：订单相关类型定义
 * 
 * 本文件包含CreateOrderPage及相关组件使用的所有类型定义。
 * 
 * @module OrderTypes
 * @created 2025-10-29
 * @refactor Day 3优化 - 从CreateOrderPage.tsx提取
 */

/**
 * 函数级详细中文注释：做市商信息接口
 *
 * 从链上makerApplications存储查询得到的做市商详细信息。
 * 包含费率、EPAY配置、TRON地址等完整字段。
 */
export interface MarketMaker {
  mmId: number                // 做市商ID（链上唯一标识）
  owner: string               // 做市商账户地址
  sellPremiumBps: number      // Sell溢价（基点，10000=100%）
  minAmount: string           // 最小订单金额（DUST，最小单位1e12精度）
  publicCid: string           // 公开信息CID（IPFS）
  deposit: string             // 保证金（DUST，最小单位1e12精度）

  // 🆕 2025-10-20：EPAY支付配置（用于自动支付）
  epayGateway: string         // EPAY网关地址
  epayPort: number            // EPAY端口
  epayPid: string             // EPAY商户ID
  epayKey: string             // EPAY商户密钥

  // 🆕 2025-10-20：TRON地址（用于手动支付显示）
  tronAddress?: string        // TRON收款地址（可选）
}

/**
 * 函数级详细中文注释：OTC 挂单接口
 * 
 * ⚠️ 注意：此类型已废弃，仅保留用于向后兼容
 * 
 * - 做市商创建的买卖挂单
 * - 包含价格、数量、有效期等信息
 * - 🆕 2025-10-20：已移除挂单机制，订单直接从做市商创建
 */
export interface Listing {
  id: number                  // 挂单ID
  maker: string               // 做市商地址
  side: number                // 交易方向（0=Buy, 1=Sell）
  base: number                // 基础资产ID
  quote: number               // 计价资产ID
  priceUsdt: number           // USDT单价（链上格式，精度10^6）
  pricingSpreadBps: number    // 价差（基点，保留字段）
  priceMin: string | null     // 最低价格
  priceMax: string | null     // 最高价格
  minQty: string              // 最小数量
  maxQty: string              // 最大数量
  total: string               // 总量
  remaining: string           // 剩余量
  partial: boolean            // 是否允许部分成交
  expireAt: number            // 过期区块高度
  active: boolean             // 是否激活
  makerInfo?: MarketMaker     // 关联的做市商信息
}

/**
 * 函数级详细中文注释：订单信息接口
 * 
 * 订单创建后的完整信息，包含订单ID、做市商信息、金额等。
 */
export interface Order {
  order_id: string            // 订单ID（交易哈希或链上ID）
  maker_id: number            // 做市商ID
  maker_name: string          // 做市商账户地址
  qty: string                 // 订单数量（DUST，最小单位）
  amount: string              // 订单金额（USDT，最小单位）
  created_at: number          // 创建时间（毫秒时间戳）
  memo_amount?: string        // DUST数量（显示用）
  fiat_amount?: string        // 法币金额（显示用）
  expired_at?: number         // 过期时间（秒时间戳）
  url?: string                // 支付链接
  pay_qr?: string             // 支付二维码数据
}

/**
 * 函数级详细中文注释：价格偏离计算结果
 * 
 * 计算订单价格相对基准价格的偏离情况，用于风险提示。
 */
export interface PriceDeviationResult {
  finalPrice: number          // 最终价格（USDT，精度10^6）
  deviationPercent: number    // 偏离率（百分比，如15表示15%）
  isWarning: boolean          // 是否警告级别（15-20%）
  isError: boolean            // 是否错误级别（>20%）
}

/**
 * 函数级详细中文注释：订单表单数据
 * 
 * 用户在订单创建表单中输入的数据。
 */
export interface OrderFormData {
  mode: 'fiat' | 'memo'       // 计价模式（法币金额 or DUST数量）
  fiatAmount?: number         // 法币金额（人民币）
  dustAmount?: number         // DUST数量
  payType: 'alipay' | 'wechat' // 支付方式
  contact: string             // 联系方式（微信/QQ/电话等）
}

/**
 * 函数级详细中文注释：订单状态枚举
 * 
 * 订单在生命周期中的各种状态。
 */
export enum OrderStatus {
  Created = 'created',                // 已创建
  Pending = 'pending',                // 待支付
  PaidConfirmed = 'paid_confirmed',   // 支付已确认
  Authorized = 'authorized',          // 已授权
  Settled = 'settled',                // 已结算
  Expired = 'expired',                // 已过期
  Failed = 'failed',                  // 失败
}

/**
 * 函数级详细中文注释：支付方式枚举
 * 
 * 支持的支付方式类型。
 */
export enum PaymentType {
  Alipay = 'alipay',          // 支付宝
  Wechat = 'wechat',          // 微信支付
  Bank = 'bank',              // 银行卡
  USDT = 'usdt',              // USDT加密货币
}

/**
 * 函数级详细中文注释：计价模式枚举
 * 
 * 订单创建时的计价模式。
 */
export enum PricingMode {
  Fiat = 'fiat',              // 按法币金额计价
  Memo = 'memo',              // 按DUST数量计价
}

