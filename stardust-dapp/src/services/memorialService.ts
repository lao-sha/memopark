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
  /** 供奉人地址 */
  who: string;
  /** 目标（域代码，对象ID）- 例如 domain=0 表示纪念馆 */
  target: [number, number];
  /** 供奉类型代码 */
  kindCode: number;
  /** 供奉金额（DUST） */
  amount: string;
  /** 媒体列表 */
  media: MediaItem[];
  /** 持续时长（周数，可选） */
  duration: number | null;
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

  constructor(api: ApiPromise) {
    this.api = api;
  }

  // ==================== Sacrifice（祭祀品目录）查询 ====================

  /**
   * 函数级详细中文注释：查询单个祭祀品信息
   * @param sacrificeId 祭祀品ID
   * @returns 祭祀品信息，不存在则返回null
   */
  async getSacrifice(sacrificeId: number): Promise<SacrificeItem | null> {
    const result = await this.api.query.memorial.sacrificeOf(sacrificeId);
    const option = result as Option<any>;

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
    const result = await this.api.query.memorial.nextSacrificeId();
    return (result as u64).toNumber();
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
    const result = await this.api.query.memorial.offeringKinds(kindCode);
    const option = result as Option<any>;

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
    const targetKey = `${target[0]}-${target[1]}`;
    const result = await this.api.query.memorial.offeringsOf(targetKey);
    const vec = result as Vec<any>;

    const records: OfferingRecord[] = [];
    const count = Math.min(vec.length, limit);

    for (let i = 0; i < count; i++) {
      const record = this.parseOfferingRecord(vec[i]);
      records.push(record);
    }

    return records;
  }

  /**
   * 函数级详细中文注释：查询账户的供奉记录
   * @param account 账户地址
   * @param limit 返回数量限制（默认50）
   * @returns 供奉记录列表
   */
  async getOfferingsByAccount(account: string, limit = 50): Promise<OfferingRecord[]> {
    const result = await this.api.query.memorial.offeringsByAccount(account);
    const vec = result as Vec<any>;

    const records: OfferingRecord[] = [];
    const count = Math.min(vec.length, limit);

    for (let i = 0; i < count; i++) {
      const record = this.parseOfferingRecord(vec[i]);
      records.push(record);
    }

    return records;
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
  private parseOfferingRecord(data: any): OfferingRecord {
    return {
      who: data.who.toString(),
      target: [data.target[0].toNumber(), data.target[1].toNumber()],
      kindCode: data.kindCode.toNumber(),
      amount: data.amount.toString(),
      media: data.media.map((m: any) => ({ cid: m.cid.toUtf8() })),
      duration: data.duration.isSome ? data.duration.unwrap().toNumber() : null,
      time: data.time.toNumber(),
    };
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

