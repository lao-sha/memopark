/**
 * Trading服务 - 统一交易模块
 * 
 * 函数级详细中文注释：
 * 提供OTC订单、做市商管理、跨链桥接的完整功能，对接 pallet-trading。
 * 整合了原 pallet-otc-order、pallet-trading、pallet-simple-bridge 的核心功能。
 * 
 * @module tradingService
 * @created 2025-10-28
 */

import { ApiPromise } from '@polkadot/api';
import type { Option, u16, u32, u64, u128, Vec, H256 } from '@polkadot/types-codec';
import type { AccountId32, BlockNumber } from '@polkadot/types/interfaces';
import { BN } from '@polkadot/util';

// ==================== 枚举定义 ====================

/**
 * 函数级详细中文注释：做市商申请状态
 */
export enum ApplicationStatus {
  DepositLocked = 'DepositLocked',      // 押金已锁定
  PendingReview = 'PendingReview',      // 待审核
  Active = 'Active',                    // 活跃中
  Paused = 'Paused',                    // 已暂停
  WithdrawalRequested = 'WithdrawalRequested', // 申请提现中
  Withdrawn = 'Withdrawn',              // 已提现
}

/**
 * 函数级详细中文注释：做市商方向
 */
export enum Direction {
  Buy = 'Buy',              // 仅买入
  Sell = 'Sell',            // 仅卖出
  BuyAndSell = 'BuyAndSell', // 双向
}

/**
 * 函数级详细中文注释：OTC订单状态
 */
export enum OrderState {
  Created = 'Created',                  // 已创建
  PaidOrCommitted = 'PaidOrCommitted',  // 已付款/已承诺
  Released = 'Released',                // 已释放
  Disputed = 'Disputed',                // 争议中
  Arbitrating = 'Arbitrating',          // 仲裁中
  Canceled = 'Canceled',                // 已取消
  Refunded = 'Refunded',                // 已退款
  Closed = 'Closed',                    // 已关闭
}

/**
 * 函数级详细中文注释：桥接状态
 */
export enum SwapStatus {
  Pending = 'Pending',      // 待处理
  Completed = 'Completed',  // 已完成
  Reported = 'Reported',    // 已举报
  Refunded = 'Refunded',    // 已退款
}

// ==================== 接口定义 ====================

/**
 * 函数级详细中文注释：做市商申请信息
 */
export interface MakerApplication {
  /** 做市商ID */
  id: number;
  /** 所有者地址 */
  owner: string;
  /** 押金金额（DUST） */
  deposit: string;
  /** 申请状态 */
  status: ApplicationStatus;
  /** 交易方向 */
  direction: Direction;
  /** TRON地址 */
  tronAddress: string;
  /** 买入溢价（basis points，-500 ~ 500） */
  buyPremiumBps: number;
  /** 卖出溢价（basis points，-500 ~ 500） */
  sellPremiumBps: number;
  /** 脱敏后的姓名 */
  maskedFullName: string;
  /** 脱敏后的身份证 */
  maskedIdCard: string;
  /** 脱敏后的生日 */
  maskedBirthday: string;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 更新时间（区块号） */
  updatedAt: number;
  /** 提现请求时间（区块号，可选） */
  withdrawalRequestedAt: number | null;
}

/**
 * 函数级详细中文注释：OTC订单信息
 */
export interface Order {
  /** 订单ID */
  id: number;
  /** 做市商ID */
  makerId: number;
  /** 做市商地址 */
  maker: string;
  /** 买家地址 */
  taker: string;
  /** 价格（USDT，精度6） */
  price: number;
  /** 数量（DUST） */
  qty: string;
  /** 总金额（USDT） */
  amount: number;
  /** 订单状态 */
  state: OrderState;
  /** 做市商TRON地址 */
  makerTronAddress: string;
  /** 付款凭证哈希 */
  paymentCommit: string;
  /** 联系方式哈希 */
  contactCommit: string;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 付款时间（区块号，可选） */
  paidAt: number | null;
  /** 释放时间（区块号，可选） */
  releasedAt: number | null;
  /** 是否为首购订单 */
  isFirstPurchase: boolean;
}

/**
 * 函数级详细中文注释：官方桥接请求
 */
export interface SwapRequest {
  /** 请求ID */
  id: number;
  /** 用户地址 */
  user: string;
  /** DUST数量 */
  dustAmount: string;
  /** TRON地址 */
  tronAddress: string;
  /** 是否已完成 */
  completed: boolean;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 完成时间（区块号，可选） */
  completedAt: number | null;
}

/**
 * 函数级详细中文注释：做市商桥接记录
 */
export interface MakerSwapRecord {
  /** 记录ID */
  id: number;
  /** 做市商ID */
  makerId: number;
  /** 用户地址 */
  user: string;
  /** DUST数量 */
  dustAmount: string;
  /** USDT数量（精度6） */
  usdtAmount: number;
  /** 状态 */
  status: SwapStatus;
  /** TRC20交易哈希（可选） */
  trc20TxHash: string | null;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 完成时间（区块号，可选） */
  completedAt: number | null;
  /** 过期时间（区块号） */
  expiresAt: number;
}

/**
 * 函数级详细中文注释：EPAY配置信息
 */
export interface EpayConfig {
  /** EPAY地址 */
  address: string;
  /** 商户ID */
  merchantId: string;
  /** API密钥（脱敏） */
  maskedApiKey: string;
}

// ==================== 核心服务类 ====================

/**
 * 函数级详细中文注释：Trading服务类
 * 提供OTC订单、做市商管理、跨链桥接的完整功能
 */
export class TradingService {
  private api: ApiPromise;

  constructor(api: ApiPromise) {
    this.api = api;
  }

  // ==================== Maker（做市商）查询 ====================

  /**
   * 函数级详细中文注释：查询单个做市商信息
   * @param makerId 做市商ID
   * @returns 做市商信息，不存在则返回null
   */
  async getMaker(makerId: number): Promise<MakerApplication | null> {
    const result = await this.api.query.maker.makerApplications(makerId);
    const option = result as Option<any>;

    if (option.isNone) {
      return null;
    }

    const data = option.unwrap();
    return this.parseMakerApplication(data, makerId);
  }

  /**
   * 函数级详细中文注释：获取下一个做市商ID
   * @returns 下一个可用的做市商ID
   */
  async getNextMakerId(): Promise<number> {
    const result = await this.api.query.maker.nextMakerId();
    return (result as u64).toNumber();
  }

  /**
   * 函数级详细中文注释：批量查询做市商列表
   * @param options 查询选项
   * @returns 做市商列表
   */
  async listMakers(options?: {
    status?: ApplicationStatus;
    direction?: Direction;
    offset?: number;
    limit?: number;
  }): Promise<MakerApplication[]> {
    const nextId = await this.getNextMakerId();
    const allMakers: MakerApplication[] = [];

    const start = options?.offset || 0;
    const end = Math.min(start + (options?.limit || 50), nextId);

    for (let id = start; id < end; id++) {
      const maker = await this.getMaker(id);
      if (!maker) continue;

      // 应用过滤条件
      if (options?.status && maker.status !== options.status) continue;
      if (options?.direction && maker.direction !== options.direction) continue;

      allMakers.push(maker);
    }

    return allMakers;
  }

  /**
   * 函数级详细中文注释：查询账户的做市商ID
   * @param account 账户地址
   * @returns 做市商ID，不存在则返回null
   */
  async getMakerIdByAccount(account: string): Promise<number | null> {
    const result = await this.api.query.maker.accountToMaker(account);
    const option = result as Option<u64>;
    return option.isSome ? option.unwrap().toNumber() : null;
  }

  // ==================== OTC订单查询 ====================

  /**
   * 函数级详细中文注释：查询单个OTC订单
   * @param orderId 订单ID
   * @returns 订单信息，不存在则返回null
   */
  async getOrder(orderId: number): Promise<Order | null> {
    const result = await this.api.query.otcOrder.orders(orderId);
    const option = result as Option<any>;

    if (option.isNone) {
      return null;
    }

    const data = option.unwrap();
    return this.parseOrder(data, orderId);
  }

  /**
   * 函数级详细中文注释：获取下一个订单ID
   * @returns 下一个可用的订单ID
   */
  async getNextOrderId(): Promise<number> {
    const result = await this.api.query.otcOrder.nextOrderId();
    return (result as u64).toNumber();
  }

  /**
   * 函数级详细中文注释：批量查询订单列表
   * @param options 查询选项
   * @returns 订单列表
   */
  async listOrders(options?: {
    state?: OrderState;
    maker?: string;
    taker?: string;
    offset?: number;
    limit?: number;
  }): Promise<Order[]> {
    const nextId = await this.getNextOrderId();
    const allOrders: Order[] = [];

    const start = options?.offset || 0;
    const end = Math.min(start + (options?.limit || 50), nextId);

    for (let id = start; id < end; id++) {
      const order = await this.getOrder(id);
      if (!order) continue;

      // 应用过滤条件
      if (options?.state && order.state !== options.state) continue;
      if (options?.maker && order.maker !== options.maker) continue;
      if (options?.taker && order.taker !== options.taker) continue;

      allOrders.push(order);
    }

    return allOrders;
  }

  // ==================== Bridge（桥接）查询 ====================

  /**
   * 函数级详细中文注释：查询官方桥接请求
   * @param requestId 请求ID
   * @returns 桥接请求，不存在则返回null
   */
  async getSwapRequest(requestId: number): Promise<SwapRequest | null> {
    const result = await this.api.query.bridge.swapRequests(requestId);
    const option = result as Option<any>;

    if (option.isNone) {
      return null;
    }

    const data = option.unwrap();
    return this.parseSwapRequest(data, requestId);
  }

  /**
   * 函数级详细中文注释：查询做市商桥接记录
   * @param recordId 记录ID
   * @returns 桥接记录，不存在则返回null
   */
  async getMakerSwapRecord(recordId: number): Promise<MakerSwapRecord | null> {
    const result = await this.api.query.bridge.makerSwaps(recordId);
    const option = result as Option<any>;

    if (option.isNone) {
      return null;
    }

    const data = option.unwrap();
    return this.parseMakerSwapRecord(data, recordId);
  }

  // ==================== Maker交易构建 ====================

  /**
   * 函数级详细中文注释：构建锁定押金交易
   * @param deposit 押金金额（DUST）
   * @returns Polkadot.js 交易对象
   */
  buildLockDepositTx(deposit: string) {
    return this.api.tx.maker.lockDeposit(deposit);
  }

  /**
   * 函数级详细中文注释：构建提交资料交易
   * @param params 资料参数
   * @returns Polkadot.js 交易对象
   */
  buildSubmitInfoTx(params: {
    direction: Direction;
    tronAddress: string;
    buyPremiumBps: number;
    sellPremiumBps: number;
    fullName: string;
    idCard: string;
    birthday: string;
    epayAddress?: string;
    epayMerchantId?: string;
    epayApiKey?: string;
  }) {
    return this.api.tx.maker.submitInfo(
      params.direction,
      params.tronAddress,
      params.buyPremiumBps,
      params.sellPremiumBps,
      params.fullName,
      params.idCard,
      params.birthday,
      params.epayAddress || null,
      params.epayMerchantId || null,
      params.epayApiKey || null
    );
  }

  /**
   * 函数级详细中文注释：构建审批做市商交易（管理员）
   * @param makerId 做市商ID
   * @returns Polkadot.js 交易对象
   */
  buildApproveMakerTx(makerId: number) {
    return this.api.tx.maker.approveMaker(makerId);
  }

  /**
   * 函数级详细中文注释：构建驳回做市商交易（管理员）
   * @param makerId 做市商ID
   * @returns Polkadot.js 交易对象
   */
  buildRejectMakerTx(makerId: number) {
    return this.api.tx.maker.rejectMaker(makerId);
  }

  /**
   * 函数级详细中文注释：构建申请提现交易
   * @returns Polkadot.js 交易对象
   */
  buildRequestWithdrawalTx() {
    return this.api.tx.maker.requestWithdrawal();
  }

  /**
   * 函数级详细中文注释：构建执行提现交易
   * @returns Polkadot.js 交易对象
   */
  buildExecuteWithdrawalTx() {
    return this.api.tx.maker.executeWithdrawal();
  }

  /**
   * 函数级详细中文注释：构建暂停服务交易
   * @returns Polkadot.js 交易对象
   */
  buildPauseServiceTx() {
    return this.api.tx.maker.cancelMaker();
  }

  /**
   * 函数级详细中文注释：构建恢复服务交易
   * @returns Polkadot.js 交易对象
   */
  buildResumeServiceTx() {
    return this.api.tx.maker.cancelMaker();
  }

  // ==================== OTC交易构建 ====================

  /**
   * 函数级详细中文注释：构建创建订单交易
   * @param params 订单参数
   * @returns Polkadot.js 交易对象
   */
  buildCreateOrderTx(params: {
    makerId: number;
    qty: string;
    contactCommit: string;
  }) {
    return this.api.tx.otcOrder.createOrder(
      params.makerId,
      params.qty,
      params.contactCommit
    );
  }

  /**
   * 函数级详细中文注释：构建标记已付款交易
   * @param params 付款参数
   * @returns Polkadot.js 交易对象
   */
  buildMarkPaidTx(params: {
    orderId: number;
    paymentCommit: string;
  }) {
    return this.api.tx.otcOrder.markPaid(
      params.orderId,
      params.paymentCommit
    );
  }

  /**
   * 函数级详细中文注释：构建释放DUST交易
   * @param orderId 订单ID
   * @returns Polkadot.js 交易对象
   */
  buildReleaseMemoTx(orderId: number) {
    return this.api.tx.otcOrder.releaseDust(orderId);
  }

  /**
   * 函数级详细中文注释：构建取消订单交易
   * @param orderId 订单ID
   * @returns Polkadot.js 交易对象
   */
  buildCancelOrderTx(orderId: number) {
    return this.api.tx.otcOrder.cancelOrder(orderId);
  }

  /**
   * 函数级详细中文注释：构建发起争议交易
   * @param orderId 订单ID
   * @returns Polkadot.js 交易对象
   */
  buildDisputeOrderTx(orderId: number) {
    return this.api.tx.otcOrder.disputeOrder(orderId);
  }

  // ==================== Bridge交易构建 ====================

  /**
   * 函数级详细中文注释：构建官方桥接交易
   * @param params 桥接参数
   * @returns Polkadot.js 交易对象
   */
  buildSwapTx(params: {
    dustAmount: string;
    tronAddress: string;
  }) {
    return this.api.tx.bridge.swap(
      params.dustAmount,
      params.tronAddress
    );
  }

  /**
   * 函数级详细中文注释：构建完成官方桥接交易（管理员）
   * @param requestId 请求ID
   * @returns Polkadot.js 交易对象
   */
  buildCompleteSwapTx(requestId: number) {
    return this.api.tx.bridge.completeSwap(requestId);
  }

  /**
   * 函数级详细中文注释：构建做市商桥接交易
   * @param params 桥接参数
   * @returns Polkadot.js 交易对象
   */
  buildMakerSwapTx(params: {
    makerId: number;
    dustAmount: string;
    tronAddress: string;
  }) {
    return this.api.tx.bridge.makerSwap(
      params.makerId,
      params.dustAmount,
      params.tronAddress
    );
  }

  /**
   * 函数级详细中文注释：构建做市商标记完成交易
   * @param params 完成参数
   * @returns Polkadot.js 交易对象
   */
  buildMarkSwapCompleteTx(params: {
    recordId: number;
    trc20TxHash: string;
  }) {
    return this.api.tx.bridge.markSwapComplete(
      params.recordId,
      params.trc20TxHash
    );
  }

  /**
   * 函数级详细中文注释：构建举报桥接交易
   * @param recordId 记录ID
   * @returns Polkadot.js 交易对象
   */
  buildReportSwapTx(recordId: number) {
    return this.api.tx.bridge.reportSwap(recordId);
  }

  // ==================== 辅助解析方法 ====================

  /**
   * 函数级详细中文注释：解析做市商数据
   */
  private parseMakerApplication(data: any, id: number): MakerApplication {
    return {
      id,
      owner: data.owner.toString(),
      deposit: data.deposit.toString(),
      status: this.parseApplicationStatus(data.status),
      direction: this.parseDirection(data.direction),
      tronAddress: data.tronAddress.toHex(),
      buyPremiumBps: data.buyPremiumBps.toNumber(),
      sellPremiumBps: data.sellPremiumBps.toNumber(),
      maskedFullName: data.maskedFullName.toUtf8(),
      maskedIdCard: data.maskedIdCard.toUtf8(),
      maskedBirthday: data.maskedBirthday.toUtf8(),
      createdAt: data.createdAt.toNumber(),
      updatedAt: data.updatedAt.toNumber(),
      withdrawalRequestedAt: data.withdrawalRequestedAt.isSome
        ? data.withdrawalRequestedAt.unwrap().toNumber()
        : null,
    };
  }

  /**
   * 函数级详细中文注释：解析订单数据
   */
  private parseOrder(data: any, id: number): Order {
    return {
      id,
      makerId: data.makerId.toNumber(),
      maker: data.maker.toString(),
      taker: data.taker.toString(),
      price: data.price.toNumber() / 1_000_000, // 转换为USDT（精度6）
      qty: data.qty.toString(),
      amount: data.amount.toNumber() / 1_000_000, // 转换为USDT
      state: this.parseOrderState(data.state),
      makerTronAddress: data.makerTronAddress.toHex(),
      paymentCommit: data.paymentCommit.toHex(),
      contactCommit: data.contactCommit.toHex(),
      createdAt: data.createdAt.toNumber(),
      paidAt: data.paidAt.isSome ? data.paidAt.unwrap().toNumber() : null,
      releasedAt: data.releasedAt.isSome ? data.releasedAt.unwrap().toNumber() : null,
      isFirstPurchase: data.isFirstPurchase.isTrue,
    };
  }

  /**
   * 函数级详细中文注释：解析官方桥接请求
   */
  private parseSwapRequest(data: any, id: number): SwapRequest {
    return {
      id,
      user: data.user.toString(),
      dustAmount: data.dustAmount.toString(),
      tronAddress: data.tronAddress.toHex(),
      completed: data.completed.isTrue,
      createdAt: data.createdAt.toNumber(),
      completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : null,
    };
  }

  /**
   * 函数级详细中文注释：解析做市商桥接记录
   */
  private parseMakerSwapRecord(data: any, id: number): MakerSwapRecord {
    return {
      id,
      makerId: data.makerId.toNumber(),
      user: data.user.toString(),
      dustAmount: data.dustAmount.toString(),
      usdtAmount: data.usdtAmount.toNumber() / 1_000_000,
      status: this.parseSwapStatus(data.status),
      trc20TxHash: data.trc20TxHash.isSome ? data.trc20TxHash.unwrap().toHex() : null,
      createdAt: data.createdAt.toNumber(),
      completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : null,
      expiresAt: data.expiresAt.toNumber(),
    };
  }

  /**
   * 函数级详细中文注释：解析申请状态
   */
  private parseApplicationStatus(status: any): ApplicationStatus {
    if (status.isDepositLocked) return ApplicationStatus.DepositLocked;
    if (status.isPendingReview) return ApplicationStatus.PendingReview;
    if (status.isActive) return ApplicationStatus.Active;
    if (status.isPaused) return ApplicationStatus.Paused;
    if (status.isWithdrawalRequested) return ApplicationStatus.WithdrawalRequested;
    if (status.isWithdrawn) return ApplicationStatus.Withdrawn;
    return ApplicationStatus.DepositLocked;
  }

  /**
   * 函数级详细中文注释：解析交易方向
   */
  private parseDirection(direction: any): Direction {
    if (direction.isBuy) return Direction.Buy;
    if (direction.isSell) return Direction.Sell;
    if (direction.isBuyAndSell) return Direction.BuyAndSell;
    return Direction.Buy;
  }

  /**
   * 函数级详细中文注释：解析订单状态
   */
  private parseOrderState(state: any): OrderState {
    if (state.isCreated) return OrderState.Created;
    if (state.isPaidOrCommitted) return OrderState.PaidOrCommitted;
    if (state.isReleased) return OrderState.Released;
    if (state.isDisputed) return OrderState.Disputed;
    if (state.isArbitrating) return OrderState.Arbitrating;
    if (state.isCanceled) return OrderState.Canceled;
    if (state.isRefunded) return OrderState.Refunded;
    if (state.isClosed) return OrderState.Closed;
    return OrderState.Created;
  }

  /**
   * 函数级详细中文注释：解析桥接状态
   */
  private parseSwapStatus(status: any): SwapStatus {
    if (status.isPending) return SwapStatus.Pending;
    if (status.isCompleted) return SwapStatus.Completed;
    if (status.isReported) return SwapStatus.Reported;
    if (status.isRefunded) return SwapStatus.Refunded;
    return SwapStatus.Pending;
  }
}

/**
 * 函数级详细中文注释：创建Trading服务实例
 * @param api Polkadot.js API实例
 * @returns Trading服务实例
 */
export function createTradingService(api: ApiPromise): TradingService {
  return new TradingService(api);
}

