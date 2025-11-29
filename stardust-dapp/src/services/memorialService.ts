/**
 * Memorial服务 - 统一纪念服务系统
 * 
 * 函数级详细中文注释：
 * 提供祭祀品目录管理和供奉业务功能，对接 pallet-memorial。
 * 整合了原 pallet-memo-offerings 和 pallet-memo-sacrifice 的核心功能。
 * 
 * @module memorialService
 * @created 2025-10-28
 */

import { ApiPromise } from '@polkadot/api';
import type { Option, u8, u32, u64, u128, Vec } from '@polkadot/types-codec';
import type { AccountId32, BlockNumber } from '@polkadot/types/interfaces';
import { BN } from '@polkadot/util';

// ==================== 枚举定义 ====================

/**
 * 函数级详细中文注释：场景类型（方案A - 简化版）
 * - 对应链上的 u8 编码
 *
 * ⚠️ 注意：链端正在重构纪念馆/园区场景，以下枚举仅供前端占位
 */
export enum Scene {
  Memorial = 0,   // 纪念馆场景（默认）
  Pet = 1,        // 宠物场景（未来扩展）
  Park = 2,       // 公园场景（未来扩展）
}

/**
 * 函数级详细中文注释：类目类型
 * - 对应链上的 u8 编码
 */
export enum Category {
  Flower = 0,   // 鲜花
  Candle = 1,   // 蜡烛
  Food = 2,     // 食品
  Toy = 3,      // 玩具
  Other = 4,    // 其他
}

/**
 * 函数级详细中文注释：祭祀品状态
 */
export enum SacrificeStatus {
  Enabled = 'Enabled',    // 已启用
  Disabled = 'Disabled',  // 已禁用
  Hidden = 'Hidden',      // 已隐藏
}

/**
 * 函数级详细中文注释：供奉品类型
 */
export enum OfferingKind {
  Instant = 'Instant',  // 无时长：一次性生效
  Timed = 'Timed',      // 有时长：要求携带时长
}

// ==================== 接口定义 ====================

/**
 * 函数级详细中文注释：祭祀品信息接口
 */
export interface SacrificeItem {
  /** 祭祀品ID */
  id: number;
  /** 名称 */
  name: string;
  /** 资源URL */
  resourceUrl: string;
  /** 描述 */
  description: string;
  /** 状态 */
  status: SacrificeStatus;
  /** 是否VIP专属 */
  isVipExclusive: boolean;
  /** 固定价格（DUST，可选） */
  fixedPrice: string | null;
  /** 按周单价（DUST，可选） */
  unitPricePerWeek: string | null;
  /** 场景代码 */
  scene: Scene;
  /** 类目代码 */
  category: Category;
  /** 创建时间（区块号） */
  created: number;
  /** 更新时间（区块号） */
  updated: number;
}

/**
 * 函数级详细中文注释：供奉品规格接口
 */
export interface OfferingSpec {
  /** 规格代码 */
  kindCode: number;
  /** 规格名称 */
  name: string;
  /** 媒体Schema的CID */
  mediaSchemaCid: string;
  /** 是否启用 */
  enabled: boolean;
  /** 供奉类型 */
  kind: OfferingKind;
  /** 时长范围（仅Timed类型） */
  durationRange?: {
    min: number;
    max: number | null;
    canRenew: boolean;
  };
}

/**
 * 函数级详细中文注释：媒体条目接口
 */
export interface MediaItem {
  /** IPFS CID */
  cid: string;
}

/**
 * 函数级详细中文注释：供奉记录接口（方案A - 简化版）
 *
 * 🔧 破坏式变更：target 保留用于兼容历史数据，但新记录 domain 应始终为 0
 */
export interface OfferingRecord {
  /** 供奉记录ID */
  id?: number;
  /** 供奉人地址 */
  who: string;
  /** 目标（域代码，对象ID）- 例如 domain=0 表示纪念馆 */
  target: [number, number];
  /** 目标类型（链上TargetType枚举值） */
  targetType?: number;
  /** 目标ID */
  targetId?: number;
  /** 祭祀品ID */
  sacrificeId?: number;
  /** 供奉类型代码 */
  kindCode: number;
  /** 供奉金额（DUST） */
  amount: string;
  /** 媒体列表 */
  media: MediaItem[];
  /** 持续时长（周数，可选） */
  duration: number | null;
  /** 供奉数量 */
  quantity?: number;
  /** 供奉状态 */
  status?: string;
  /** 到期区块号 */
  expiryBlock?: number | null;
  /** 是否自动续费 */
  autoRenew?: boolean;
  /** 供奉时间（区块号） */
  time: number;
}

/**
 * 函数级详细中文注释：简化分账配置接口
 */
export interface SimpleRoute {
  /** 目标账户分成百分比（默认80%） */
  subjectPercent: number;
  /** 平台分成百分比（默认20%） */
  platformPercent: number;
}

/**
 * 函数级详细中文注释：供奉价格计算结果
 */
export interface OfferingPriceInfo {
  /** 原价（DUST） */
  originalPrice: string;
  /** 实付价格（应用VIP折扣后） */
  finalPrice: string;
  /** VIP折扣比例（0-100，0表示无折扣） */
  discountPercent: number;
  /** 是否为VIP */
  isVip: boolean;
}

// ==================== 核心服务类 ====================

/**
 * 函数级详细中文注释：Memorial服务类
 * 提供祭祀品目录管理和供奉业务的完整功能
 */
export class MemorialService {
  private api: ApiPromise;
  private static textDecoder: TextDecoder | null = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  constructor(api: ApiPromise) {
    this.api = api;
  }

  private resolveMemorialQuerySection(): any | null {
    const root: any = this.api.query || {}
    return root.memorial || root.memoOfferings || root.memo_offerings || null
  }

  private ensureMemorialQuery(method: string): any {
    const section = this.resolveMemorialQuerySection()
    if (!section) {
      throw new Error(`链上未启用 memorial/memoOfferings 查询模块，无法执行 ${method}`)
    }
    return section
  }

  // ==================== Sacrifice（祭祀品目录）查询 ====================

  /**
   * 函数级详细中文注释：查询单个祭祀品信息
   * @param sacrificeId 祭祀品ID
   * @returns 祭祀品信息，不存在则返回null
   */
  async getSacrifice(sacrificeId: number): Promise<SacrificeItem | null> {
    const memorialQuery = this.ensureMemorialQuery('getSacrifice')
    if (!memorialQuery.sacrificeOf) {
      throw new Error('当前链未提供 sacrificeOf 查询接口')
    }
    const result = await memorialQuery.sacrificeOf(sacrificeId)
    const option = result as Option<any>

    if (option.isNone) {
      return null;
    }

    const data = option.unwrap();
    return this.parseSacrificeItem(data);
  }

  /**
   * 函数级详细中文注释：获取下一个祭祀品ID
   * @returns 下一个可用的祭祀品ID
   */
  async getNextSacrificeId(): Promise<number> {
    const memorialQuery = this.ensureMemorialQuery('getNextSacrificeId')
    if (!memorialQuery.nextSacrificeId) {
      throw new Error('当前链未提供 nextSacrificeId 查询接口')
    }
    const result = await memorialQuery.nextSacrificeId()
    return (result as u64).toNumber()
  }

  /**
   * 函数级详细中文注释：批量查询祭祀品列表
   * @param options 查询选项
   * @returns 祭祀品列表
   */
  async listSacrifices(options?: {
    scene?: Scene;
    category?: Category;
    status?: SacrificeStatus;
    isVipExclusive?: boolean;
    offset?: number;
    limit?: number;
  }): Promise<SacrificeItem[]> {
    const nextId = await this.getNextSacrificeId();
    const allItems: SacrificeItem[] = [];

    // 遍历所有祭祀品ID
    const start = options?.offset || 0;
    const end = Math.min(start + (options?.limit || 50), nextId);

    for (let id = start; id < end; id++) {
      const item = await this.getSacrifice(id);
      if (!item) continue;

      // 应用过滤条件
      if (options?.scene !== undefined && item.scene !== options.scene) continue;
      if (options?.category !== undefined && item.category !== options.category) continue;
      if (options?.status && item.status !== options.status) continue;
      if (options?.isVipExclusive !== undefined && item.isVipExclusive !== options.isVipExclusive) continue;

      allItems.push(item);
    }

    return allItems;
  }

  // ==================== Offerings（供奉业务）查询 ====================

  /**
   * 函数级详细中文注释：查询供奉品规格
   * @param kindCode 规格代码
   * @returns 供奉品规格，不存在则返回null
   */
  async getOfferingKind(kindCode: number): Promise<OfferingSpec | null> {
    const memorialQuery = this.ensureMemorialQuery('getOfferingKind')
    if (!memorialQuery.offeringKinds) {
      throw new Error('当前链未提供 offeringKinds 查询接口')
    }
    const result = await memorialQuery.offeringKinds(kindCode)
    const option = result as Option<any>

    if (option.isNone) {
      return null;
    }

    const data = option.unwrap();
    return this.parseOfferingSpec(data);
  }

  /**
   * 函数级详细中文注释：查询目标的供奉记录（兼容方案A）
   *
   * 🔧 方案A适配：仍支持 target 参数以兼容查询历史数据
   *
   * @param target 目标（域代码，对象ID）- 新数据 domain 应为 0
   * @param limit 返回数量限制（默认50）
   * @returns 供奉记录列表
   */
  async getOfferingsForTarget(target: [number, number], limit = 50): Promise<OfferingRecord[]> {
    const memorialQuery = this.ensureMemorialQuery('getOfferingsForTarget')
    const supportsOfferingsOf = typeof memorialQuery.offeringsOf === 'function'
    const supportsOfferingRecords =
      typeof memorialQuery.offeringsByTarget === 'function' &&
      typeof memorialQuery.offeringRecords === 'function'
    const supportsFullScan =
      typeof memorialQuery.offeringRecords === 'function' &&
      typeof memorialQuery.nextOfferingId === 'function'

    // 兼容旧版 pallet：直接返回 Vec<OfferingRecord>
    if (supportsOfferingsOf) {
      const targetKey = `${target[0]}-${target[1]}`
      const result = await memorialQuery.offeringsOf(targetKey)
      const vec = result as Vec<any>

      const records: OfferingRecord[] = []
      const count = Math.min(vec.length, limit)

      for (let i = 0; i < count; i++) {
        const record = this.parseOfferingRecord(vec[i])
        records.push(record)
      }

      return records
    }

    // 兼容新版 pallet：先查 ID 列表，再逐条拉取记录
    if (supportsOfferingRecords) {
      const result = await memorialQuery.offeringsByTarget(target)
      const ids = result as Vec<any>
      if (ids.length === 0) {
        return []
      }

      const count = Math.min(ids.length, limit)

      const queries = []
      for (let i = 0; i < count; i++) {
        queries.push(memorialQuery.offeringRecords(ids[i]))
      }

      const recordResults = await Promise.all(queries)
      const records: OfferingRecord[] = []

      for (const rawRecord of recordResults) {
        const option = rawRecord as Option<any>
        let data: any = rawRecord

        if (typeof option?.isSome === 'boolean') {
          if (option.isNone) {
            continue
          }
          data = option.unwrap()
        }

        if (!data) continue
        records.push(this.parseOfferingRecord(data))
      }

      return records
    }

    if (supportsFullScan) {
      const nextIdRaw = await memorialQuery.nextOfferingId()
      const nextId = typeof nextIdRaw?.toNumber === 'function' ? nextIdRaw.toNumber() : 0
      if (!nextId) {
        return []
      }

      const records: OfferingRecord[] = []
      for (let id = nextId - 1; id >= 0 && records.length < limit; id--) {
        const record = await this.fetchOfferingRecord(memorialQuery, id)
        if (!record) continue
        if (record.target[0] === target[0] && record.target[1] === target[1]) {
          records.push(record)
        }
      }

      return records
    }

    console.warn(
      '[MemorialService] 当前链未提供 offeringsOf/offeringsByTarget 查询接口，返回空的供奉记录列表',
      { target }
    );
    return [];
  }

  /**
   * 函数级详细中文注释：查询账户的供奉记录
   * @param account 账户地址
   * @param limit 返回数量限制（默认50）
   * @returns 供奉记录列表
   */
  async getOfferingsByAccount(account: string, limit = 50): Promise<OfferingRecord[]> {
    const memorialQuery = this.ensureMemorialQuery('getOfferingsByAccount')
    if (typeof memorialQuery.offeringsByAccount === 'function') {
      const result = await memorialQuery.offeringsByAccount(account)
      const vec = result as Vec<any>

      const records: OfferingRecord[] = []
      const count = Math.min(vec.length, limit)

      for (let i = 0; i < count; i++) {
        const record = this.parseOfferingRecord(vec[i])
        records.push(record)
      }

      return records
    }

    if (typeof memorialQuery.offeringsByUser === 'function' && typeof memorialQuery.offeringRecords === 'function') {
      const idsResult = await memorialQuery.offeringsByUser(account)
      const idsVec = idsResult as Vec<any>
      if (idsVec.length === 0) {
        return []
      }

      const idNumbers = idsVec.map(id => (typeof id?.toNumber === 'function' ? id.toNumber() : Number(id))).filter(id => Number.isFinite(id))
      if (idNumbers.length === 0) {
        return []
      }

      const sliced = idNumbers.slice(-limit).reverse()
      const records: OfferingRecord[] = []

      for (const id of sliced) {
        const record = await this.fetchOfferingRecord(memorialQuery, id)
        if (record) {
          records.push(record)
        }
      }

      return records
    }

    throw new Error('当前链未提供 offeringsByAccount/offeringsByUser 查询接口')
  }

  /**
   * 函数级详细中文注释：计算供奉价格（通过祭祀品目录下单）
   * @param sacrificeId 祭祀品ID
   * @param weeks 持续周数（按周计费时必填）
   * @param account 用户地址（用于检查VIP状态）
   * @returns 价格信息
   */
  async calculateOfferingPrice(
    sacrificeId: number,
    weeks: number | null,
    account: string
  ): Promise<OfferingPriceInfo> {
    const sacrifice = await this.getSacrifice(sacrificeId);
    if (!sacrifice) {
      throw new Error(`祭祀品 #${sacrificeId} 不存在`);
    }

    // 计算原价
    let originalPrice: BN;
    if (sacrifice.fixedPrice) {
      originalPrice = new BN(sacrifice.fixedPrice);
    } else if (sacrifice.unitPricePerWeek && weeks) {
      const unitPrice = new BN(sacrifice.unitPricePerWeek);
      originalPrice = unitPrice.muln(weeks);
    } else {
      throw new Error('定价信息不足：需要固定价格或按周单价');
    }

    // 检查VIP状态
    const isVip = await this.checkMembershipStatus(account);
    let finalPrice = originalPrice;
    let discountPercent = 0;

    if (isVip) {
      // 应用30%折扣（用户支付70%）
      discountPercent = 30;
      finalPrice = originalPrice.muln(70).divn(100);
    }

    return {
      originalPrice: originalPrice.toString(),
      finalPrice: finalPrice.toString(),
      discountPercent,
      isVip,
    };
  }

  /**
   * 函数级详细中文注释：检查账户的VIP会员状态
   * @param account 账户地址
   * @returns 是否为有效VIP会员
   */
  async checkMembershipStatus(account: string): Promise<boolean> {
    try {
      // 调用 pallet-membership 的查询
      const result = await this.api.query.membership.members(account);
      const option = result as Option<any>;
      return option.isSome;
    } catch (error) {
      console.warn('检查VIP状态失败:', error);
      return false;
    }
  }

  // ==================== 交易构建（用户端）====================

  /**
   * 函数级详细中文注释：构建自定义供奉交易
   * @param params 供奉参数
   * @returns Polkadot.js 交易对象
   */
  buildOfferTx(params: {
    target: [number, number];
    kindCode: number;
    media: MediaItem[];
    duration: number | null;
  }) {
    return this.api.tx.memorial.offer(
      params.target,
      params.kindCode,
      params.media.map(m => ({ cid: m.cid })),
      params.duration
    );
  }

  /**
   * 函数级详细中文注释：构建向目标供奉交易
   * 调用 pallet-memorial 的 offer_to_target 方法
   *
   * @param params 供奉参数
   * @param params.targetType 目标类型（0=Deceased, 1=Pet, 2=Memorial, 3=Event）
   * @param params.targetId 目标ID
   * @param params.sacrificeId 祭祀品ID（链上注册的祭品目录ID）
   * @param params.quantity 数量
   * @param params.media 媒体资源（可选的IPFS CID列表）
   * @param params.durationWeeks 订阅周期（周数，订阅类商品必填）
   * @returns Polkadot.js 交易对象
   */
  buildOfferToTargetTx(params: {
    targetType: number;
    targetId: number;
    sacrificeId: number;
    quantity: number;
    media?: string[];
    durationWeeks?: number;
  }) {
    // 将媒体数据转为字节数组（UTF-8编码）
    const mediaBytes = (params.media || []).map(cid =>
      Array.from(new TextEncoder().encode(cid))
    );

    return this.api.tx.memorial.offerToTarget(
      params.targetType,
      params.targetId,
      params.sacrificeId,
      params.quantity,
      mediaBytes,
      params.durationWeeks ?? null
    );
  }

  /**
   * 函数级详细中文注释：批量构建供奉交易
   * 当用户选择多种祭品时，使用批量交易一次提交
   *
   * @param offerings 供奉项目列表
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @returns Polkadot.js 批量交易对象
   */
  buildBatchOfferTx(
    offerings: Array<{
      sacrificeId: number;
      quantity: number;
      media?: string[];
      durationWeeks?: number;
    }>,
    targetType: number,
    targetId: number
  ) {
    const txs = offerings.map(offering =>
      this.buildOfferToTargetTx({
        targetType,
        targetId,
        sacrificeId: offering.sacrificeId,
        quantity: offering.quantity,
        media: offering.media,
        durationWeeks: offering.durationWeeks,
      })
    );

    // 如果只有一个交易，直接返回；否则尝试使用 utility 的批量接口
    if (txs.length === 1) {
      return txs[0];
    }

    const utilityTx = (this.api.tx as any)?.utility;

    if (typeof utilityTx?.batchAll === 'function') {
      return utilityTx.batchAll(txs);
    }

    if (typeof utilityTx?.batch === 'function') {
      return utilityTx.batch(txs);
    }

    throw new Error('当前链未启用 utility.batch/batchAll，无法一次性提交多笔供奉');
  }

  /**
   * 函数级详细中文注释：检测链端是否支持批量供奉交易
   */
  supportsBatchOffer(): boolean {
    const utilityTx = (this.api.tx as any)?.utility;
    return typeof utilityTx?.batchAll === 'function' || typeof utilityTx?.batch === 'function';
  }

  /**
   * 函数级详细中文注释：构建通过目录下单交易
   * @param params 下单参数
   * @returns Polkadot.js 交易对象
   */
  buildOfferBySacrificeTx(params: {
    target: [number, number];
    sacrificeId: number;
    media: MediaItem[];
    weeks: number | null;
  }) {
    return this.api.tx.memorial.offerBySacrifice(
      params.target,
      params.sacrificeId,
      params.media.map(m => ({ cid: m.cid })),
      params.weeks
    );
  }

  /**
   * 函数级详细中文注释：构建续费供奉交易
   * @param params 续费参数
   * @returns Polkadot.js 交易对象
   */
  buildRenewOfferingTx(params: {
    target: [number, number];
    offeringId: number;
    additionalWeeks: number;
  }) {
    return this.api.tx.memorial.renewOffering(
      params.target,
      params.offeringId,
      params.additionalWeeks
    );
  }

  /**
   * 函数级详细中文注释：构建取消供奉交易
   * @param params 取消参数
   * @returns Polkadot.js 交易对象
   */
  buildCancelOfferingTx(params: {
    target: [number, number];
    offeringId: number;
  }) {
    return this.api.tx.memorial.cancelOffering(
      params.target,
      params.offeringId
    );
  }

  private async fetchOfferingRecord(memorialQuery: any, id: number): Promise<OfferingRecord | null> {
    if (typeof memorialQuery.offeringRecords !== 'function') {
      return null
    }
    const rawResult = await memorialQuery.offeringRecords(id)
    const option = rawResult as Option<any>
    let data: any = rawResult

    if (typeof option?.isSome === 'boolean') {
      if (option.isNone) {
        return null
      }
      data = option.unwrap()
    }

    if (!data) {
      return null
    }

    return this.parseOfferingRecord(data, id)
  }

  // ==================== 交易构建（管理员端）====================

  /**
   * 函数级详细中文注释：构建创建祭祀品交易
   * @param params 祭祀品参数
   * @returns Polkadot.js 交易对象
   */
  buildCreateSacrificeTx(params: {
    name: string;
    resourceUrl: string;
    description: string;
    isVipExclusive: boolean;
    fixedPrice: string | null;
    unitPricePerWeek: string | null;
    scene: Scene;
    category: Category;
  }) {
    return this.api.tx.memorial.createSacrifice(
      params.name,
      params.resourceUrl,
      params.description,
      params.isVipExclusive,
      params.fixedPrice,
      params.unitPricePerWeek,
      params.scene,
      params.category
    );
  }

  /**
   * 函数级详细中文注释：构建更新祭祀品交易
   * @param params 更新参数
   * @returns Polkadot.js 交易对象
   */
  buildUpdateSacrificeTx(params: {
    id: number;
    name?: string;
    resourceUrl?: string;
    description?: string;
    isVipExclusive?: boolean;
    fixedPrice?: string | null;
    unitPricePerWeek?: string | null;
    scene?: Scene;
    category?: Category;
  }) {
    return this.api.tx.memorial.updateSacrifice(
      params.id,
      params.name || null,
      params.resourceUrl || null,
      params.description || null,
      params.isVipExclusive ?? null,
      params.fixedPrice === undefined ? null : params.fixedPrice,
      params.unitPricePerWeek === undefined ? null : params.unitPricePerWeek,
      params.scene ?? null,
      params.category ?? null
    );
  }

  /**
   * 函数级详细中文注释：构建设置祭祀品状态交易
   * @param params 状态参数
   * @returns Polkadot.js 交易对象
   */
  buildSetSacrificeStatusTx(params: {
    id: number;
    status: SacrificeStatus;
  }) {
    return this.api.tx.memorial.setSacrificeStatus(
      params.id,
      params.status
    );
  }

  /**
   * 函数级详细中文注释：构建设置供奉规格交易
   * @param params 规格参数
   * @returns Polkadot.js 交易对象
   */
  buildSetOfferingKindTx(params: {
    kindCode: number;
    name: string;
    mediaSchemaCid: string;
    kind: OfferingKind;
    durationRange?: { min: number; max: number | null; canRenew: boolean };
  }) {
    const kindData = params.kind === OfferingKind.Instant
      ? { Instant: null }
      : {
          Timed: {
            min: params.durationRange!.min,
            max: params.durationRange!.max,
            canRenew: params.durationRange!.canRenew,
          },
        };

    return this.api.tx.memorial.setOfferingKind(
      params.kindCode,
      params.name,
      params.mediaSchemaCid,
      kindData
    );
  }

  /**
   * 函数级详细中文注释：构建切换供奉规格启用状态交易
   * @param params 切换参数
   * @returns Polkadot.js 交易对象
   */
  buildToggleOfferingKindTx(params: {
    kindCode: number;
    enabled: boolean;
  }) {
    return this.api.tx.memorial.toggleOfferingKind(
      params.kindCode,
      params.enabled
    );
  }

  /**
   * 函数级详细中文注释：构建设置全局分账路由交易
   * @param route 分账配置
   * @returns Polkadot.js 交易对象
   */
  buildSetGlobalRouteTx(route: SimpleRoute) {
    return this.api.tx.memorial.setGlobalRoute(route);
  }

  /**
   * 函数级详细中文注释：构建设置按域分账路由交易
   * @param domain 域代码
   * @param route 分账配置
   * @returns Polkadot.js 交易对象
   */
  buildSetDomainRouteTx(domain: number, route: SimpleRoute) {
    return this.api.tx.memorial.setDomainRoute(domain, route);
  }

  // ==================== 辅助解析方法 ====================

  /**
   * 函数级详细中文注释：解析祭祀品数据
   */
  private parseSacrificeItem(data: any): SacrificeItem {
    return {
      id: data.id.toNumber(),
      name: data.name.toUtf8(),
      resourceUrl: data.resourceUrl.toUtf8(),
      description: data.description.toUtf8(),
      status: this.parseSacrificeStatus(data.status),
      isVipExclusive: data.isVipExclusive.isTrue,
      fixedPrice: data.fixedPrice.isSome ? data.fixedPrice.unwrap().toString() : null,
      unitPricePerWeek: data.unitPricePerWeek.isSome
        ? data.unitPricePerWeek.unwrap().toString()
        : null,
      scene: data.scene.toNumber() as Scene,
      category: data.category.toNumber() as Category,
      created: data.created.toNumber(),
      updated: data.updated.toNumber(),
    };
  }

  /**
   * 函数级详细中文注释：解析祭祀品状态
   */
  private parseSacrificeStatus(status: any): SacrificeStatus {
    if (status.isEnabled) return SacrificeStatus.Enabled;
    if (status.isDisabled) return SacrificeStatus.Disabled;
    if (status.isHidden) return SacrificeStatus.Hidden;
    return SacrificeStatus.Disabled;
  }

  /**
   * 函数级详细中文注释：解析供奉品规格
   */
  private parseOfferingSpec(data: any): OfferingSpec {
    const spec: OfferingSpec = {
      kindCode: data.kindCode.toNumber(),
      name: data.name.toUtf8(),
      mediaSchemaCid: data.mediaSchemaCid.toUtf8(),
      enabled: data.enabled.isTrue,
      kind: data.kind.isInstant ? OfferingKind.Instant : OfferingKind.Timed,
    };

    if (data.kind.isTimed) {
      const timed = data.kind.asTimed;
      spec.durationRange = {
        min: timed.min.toNumber(),
        max: timed.max.isSome ? timed.max.unwrap().toNumber() : null,
        canRenew: timed.canRenew.isTrue,
      };
    }

    return spec;
  }

  /**
   * 函数级详细中文注释：解析供奉记录
   */
  private parseOfferingRecord(data: any, offeringId?: number): OfferingRecord {
    const who = data.who?.toString ? data.who.toString() : String(data.who ?? '')

    const targetTypeEnum = data.targetType || data.target_type
    const targetType = this.parseTargetType(targetTypeEnum)
    const targetId = this.extractNumber(data.targetId ?? data.target_id) ?? 0

    const legacyTarget: [number, number] | null = Array.isArray(data.target)
      ? [
          this.extractNumber(data.target[0]) ?? 0,
          this.extractNumber(data.target[1]) ?? 0,
        ]
      : null

    const target: [number, number] = legacyTarget || [targetType ?? 0, targetId]

    const sacrificeId =
      this.extractNumber(data.sacrificeId ?? data.sacrifice_id) ??
      this.extractNumber(data.kindCode ?? data.kind_code) ??
      0

    const amountRaw = data.amount
    const amount = typeof amountRaw?.toString === 'function' ? amountRaw.toString() : String(amountRaw ?? '0')

    const mediaItems: MediaItem[] = Array.isArray(data.media)
      ? data.media.map((m: any) => ({ cid: this.decodeCid(m?.cid) })).filter(m => !!m.cid)
      : []

    const duration = this.extractDuration(data)
    const blockTime = this.extractNumber(data.time) ?? 0
    const quantity = this.extractNumber(data.quantity)
    const status = this.parseOfferingStatus(data.status)
    const expiryBlock = this.extractOptionNumber(data.expiryBlock ?? data.expiry_block)
    const autoRenew = this.extractBoolean(data.autoRenew ?? data.auto_renew)

    return {
      id: offeringId,
      who,
      target,
      targetType,
      targetId,
      sacrificeId: sacrificeId || undefined,
      kindCode: sacrificeId,
      amount,
      media: mediaItems,
      duration,
      time: blockTime,
      quantity: quantity ?? undefined,
      status,
      expiryBlock,
      autoRenew,
    }
  }

  private parseTargetType(targetType: any): number | undefined {
    if (!targetType) return undefined
    if (typeof targetType.toNumber === 'function') {
      return targetType.toNumber()
    }
    if (typeof targetType === 'number') {
      return targetType
    }
    if (typeof targetType?.type === 'string') {
      return this.mapTargetTypeString(targetType.type)
    }
    const mapping: Record<string, number> = {
      isDeceased: 0,
      isPet: 1,
      isMemorial: 2,
      isEvent: 3,
    }
    for (const key of Object.keys(mapping)) {
      if (targetType[key]) {
        return mapping[key]
      }
    }
    return undefined
  }

  private mapTargetTypeString(type: string): number | undefined {
    const normalized = type.toLowerCase()
    switch (normalized) {
      case 'deceased':
        return 0
      case 'pet':
        return 1
      case 'memorial':
        return 2
      case 'event':
        return 3
      default:
        return undefined
    }
  }

  private extractDuration(data: any): number | null {
    if (data.duration && typeof data.duration.isSome === 'boolean') {
      return data.duration.isSome ? data.duration.unwrap().toNumber() : null
    }
    const durationWeeks = data.durationWeeks ?? data.duration_weeks
    if (durationWeeks && typeof durationWeeks.toNumber === 'function') {
      return durationWeeks.toNumber()
    }
    if (typeof durationWeeks === 'number') {
      return durationWeeks
    }
    return null
  }

  private extractNumber(value: any): number | undefined {
    if (typeof value?.toNumber === 'function') {
      return value.toNumber()
    }
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'bigint') {
      return Number(value)
    }
    return undefined
  }

  private extractOptionNumber(value: any): number | null {
    if (!value && value !== 0) {
      return null
    }
    if (typeof value?.isSome === 'boolean') {
      return value.isSome ? this.extractNumber(value.unwrap()) ?? null : null
    }
    const num = this.extractNumber(value)
    return typeof num === 'number' ? num : null
  }

  private extractBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value
    }
    if (value?.isTrue === true) {
      return true
    }
    if (value?.isFalse === true) {
      return false
    }
    if (typeof value?.toJSON === 'function') {
      const json = value.toJSON()
      if (typeof json === 'boolean') {
        return json
      }
    }
    return false
  }

  private decodeCid(cidField: any): string {
    if (!cidField) {
      return ''
    }
    if (typeof cidField.toUtf8 === 'function') {
      return cidField.toUtf8()
    }
    if (Array.isArray(cidField)) {
      return MemorialService.textDecoder
        ? MemorialService.textDecoder.decode(new Uint8Array(cidField))
        : ''
    }
    if (cidField instanceof Uint8Array) {
      return MemorialService.textDecoder ? MemorialService.textDecoder.decode(cidField) : ''
    }
    return String(cidField)
  }

  private parseOfferingStatus(status: any): string | undefined {
    if (!status) {
      return undefined
    }
    if (typeof status === 'string') {
      return status
    }
    if (typeof status.type === 'string') {
      return status.type
    }
    const mapping: Record<string, string> = {
      isCompleted: 'Completed',
      isActive: 'Active',
      isExpired: 'Expired',
      isSuspended: 'Suspended',
      isCancelled: 'Cancelled',
      isProcessing: 'Processing',
    }
    for (const key of Object.keys(mapping)) {
      if (status[key]) {
        return mapping[key]
      }
    }
    if (typeof status.toString === 'function') {
      return status.toString()
    }
    return undefined
  }
}

/**
 * 函数级详细中文注释：创建Memorial服务实例
 * @param api Polkadot.js API实例
 * @returns Memorial服务实例
 */
export function createMemorialService(api: ApiPromise): MemorialService {
  return new MemorialService(api);
}
