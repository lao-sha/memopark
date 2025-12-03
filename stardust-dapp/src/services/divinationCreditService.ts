/**
 * 占卜服务市场信用体系服务
 *
 * 提供服务提供者信用管理的链上交互接口
 * - 信用档案查询和管理
 * - 违规记录管理
 * - 申诉处理
 * - 信用修复任务
 *
 * 注意：此服务针对 pallet-divination-market 中的信用体系，
 * 与 creditService.ts（OTC 交易信用）是不同的系统。
 */

import { ApiPromise } from '@polkadot/api';
import type { InjectedExtension } from '@polkadot/extension-inject/types';
import {
  CreditProfile,
  CreditLevel,
  ViolationRecord,
  ViolationType,
  PenaltyType,
  AppealResult,
  CreditRepairTask,
  RepairTaskType,
  CreditChangeRecord,
  GlobalCreditStats,
  DeductionReason,
  canAcceptOrders,
  canCreatePackages,
  canAnswerBounties,
  getMaxActiveOrders,
} from '../types/divination';

/**
 * 占卜市场信用体系服务类
 *
 * 封装与 pallet-divination-market 信用体系相关的链上交互
 */
export class DivinationCreditService {
  private api: ApiPromise;
  private extension: InjectedExtension | null = null;

  constructor(api: ApiPromise, extension?: InjectedExtension) {
    this.api = api;
    if (extension) {
      this.extension = extension;
    }
  }

  /**
   * 设置签名扩展
   */
  setExtension(extension: InjectedExtension): void {
    this.extension = extension;
  }

  // ==================== 信用档案管理 ====================

  /**
   * 获取提供者信用档案
   *
   * @param account 提供者账户地址
   */
  async getCreditProfile(account: string): Promise<CreditProfile | null> {
    const result = await this.api.query.divinationMarket.creditProfiles(account);

    if (result.isEmpty) {
      return null;
    }

    const data = result.toJSON() as any;
    return this.parseCreditProfile(data);
  }

  /**
   * 初始化信用档案
   *
   * @param signer 签名账户地址
   */
  async initCreditProfile(signer: string): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.initCreditProfile();

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 检查账户是否在黑名单中
   *
   * @param account 账户地址
   */
  async isInBlacklist(account: string): Promise<boolean> {
    const result = await this.api.query.divinationMarket.creditBlacklist(account);
    return !result.isEmpty;
  }

  /**
   * 获取黑名单加入时间
   *
   * @param account 账户地址
   */
  async getBlacklistTime(account: string): Promise<number | null> {
    const result = await this.api.query.divinationMarket.creditBlacklist(account);
    if (result.isEmpty) {
      return null;
    }
    return result.toJSON() as number;
  }

  // ==================== 违规记录管理 ====================

  /**
   * 获取提供者的违规记录
   *
   * @param account 提供者账户地址
   */
  async getViolationRecords(account: string): Promise<ViolationRecord[]> {
    const violationIds = await this.api.query.divinationMarket.providerViolations(account);
    const ids = violationIds.toJSON() as number[];

    if (!ids || ids.length === 0) {
      return [];
    }

    const records: ViolationRecord[] = [];
    for (const id of ids) {
      const result = await this.api.query.divinationMarket.violationRecords(id);
      if (!result.isEmpty) {
        const data = result.toJSON() as any;
        records.push(this.parseViolationRecord(data));
      }
    }

    return records;
  }

  /**
   * 获取单条违规记录
   *
   * @param violationId 违规记录 ID
   */
  async getViolationRecord(violationId: number): Promise<ViolationRecord | null> {
    const result = await this.api.query.divinationMarket.violationRecords(violationId);

    if (result.isEmpty) {
      return null;
    }

    const data = result.toJSON() as any;
    return this.parseViolationRecord(data);
  }

  /**
   * 获取活跃的违规记录（未过期）
   *
   * @param account 提供者账户地址
   */
  async getActiveViolations(account: string): Promise<ViolationRecord[]> {
    const records = await this.getViolationRecords(account);
    return records.filter(r => r.isActive);
  }

  // ==================== 申诉管理 ====================

  /**
   * 申诉违规记录
   *
   * @param violationId 违规记录 ID
   * @param signer 签名账户地址
   */
  async appealViolation(violationId: number, signer: string): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.appealViolation(violationId);

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 获取待处理的申诉
   *
   * @param account 提供者账户地址
   */
  async getPendingAppeals(account: string): Promise<ViolationRecord[]> {
    const records = await this.getViolationRecords(account);
    return records.filter(r => r.isAppealed && r.appealResult === undefined);
  }

  // ==================== 信用修复任务 ====================

  /**
   * 申请信用修复任务
   *
   * @param taskType 任务类型
   * @param signer 签名账户地址
   */
  async requestCreditRepair(taskType: RepairTaskType, signer: string): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.requestCreditRepair(taskType);

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 获取提供者的信用修复任务
   *
   * @param account 提供者账户地址
   */
  async getRepairTasks(account: string): Promise<CreditRepairTask[]> {
    const result = await this.api.query.divinationMarket.repairTasks(account);

    if (result.isEmpty) {
      return [];
    }

    const data = result.toJSON() as any[];
    return data.map(task => ({
      id: task.id,
      taskType: task.taskType as RepairTaskType,
      rewardPoints: task.rewardPoints,
      targetValue: task.targetValue,
      currentProgress: task.currentProgress,
      isCompleted: task.isCompleted,
      startedAt: task.startedAt,
      deadline: task.deadline,
      completedAt: task.completedAt,
    }));
  }

  /**
   * 获取活跃的修复任务
   *
   * @param account 提供者账户地址
   */
  async getActiveRepairTasks(account: string): Promise<CreditRepairTask[]> {
    const tasks = await this.getRepairTasks(account);
    return tasks.filter(t => !t.isCompleted);
  }

  // ==================== 信用历史记录 ====================

  /**
   * 获取信用变更历史
   *
   * @param account 提供者账户地址
   */
  async getCreditHistory(account: string): Promise<CreditChangeRecord[]> {
    const result = await this.api.query.divinationMarket.creditHistory(account);

    if (result.isEmpty) {
      return [];
    }

    const data = result.toJSON() as any[];
    return data.map(record => ({
      previousScore: record.previousScore,
      newScore: record.newScore,
      changeAmount: record.changeAmount,
      reason: record.reason,
      description: record.description ? this.hexToString(record.description) : undefined,
      relatedId: record.relatedId,
      changedAt: record.changedAt,
    }));
  }

  // ==================== 全局统计 ====================

  /**
   * 获取全局信用统计
   */
  async getGlobalCreditStats(): Promise<GlobalCreditStats> {
    const result = await this.api.query.divinationMarket.creditStatistics();

    if (result.isEmpty) {
      return {
        totalProviders: 0,
        excellentCount: 0,
        goodCount: 0,
        fairCount: 0,
        warningCount: 0,
        poorCount: 0,
        badCount: 0,
        blacklistedCount: 0,
        averageScore: 0,
        weeklyViolations: 0,
      };
    }

    const data = result.toJSON() as any;
    return {
      totalProviders: data.totalProviders,
      excellentCount: data.excellentCount,
      goodCount: data.goodCount,
      fairCount: data.fairCount,
      warningCount: data.warningCount,
      poorCount: data.poorCount,
      badCount: data.badCount,
      blacklistedCount: data.blacklistedCount,
      averageScore: data.averageScore,
      weeklyViolations: data.weeklyViolations,
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 将十六进制字符串转换为普通字符串
   */
  private hexToString(hex: string): string {
    if (!hex || hex === '0x') return '';
    const hexStr = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = [];
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes.push(parseInt(hexStr.substr(i, 2), 16));
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  /**
   * 解析信用档案数据
   */
  private parseCreditProfile(data: any): CreditProfile {
    return {
      score: data.score,
      level: data.level as CreditLevel,
      highestScore: data.highestScore,
      lowestScore: data.lowestScore,
      serviceQualityScore: data.serviceQualityScore,
      avgOverallRating: data.avgOverallRating,
      avgAccuracyRating: data.avgAccuracyRating,
      avgAttitudeRating: data.avgAttitudeRating,
      avgResponseRating: data.avgResponseRating,
      fiveStarCount: data.fiveStarCount,
      oneStarCount: data.oneStarCount,
      behaviorScore: data.behaviorScore,
      violationCount: data.violationCount,
      warningCount: data.warningCount,
      complaintCount: data.complaintCount,
      complaintUpheldCount: data.complaintUpheldCount,
      activeViolations: data.activeViolations,
      fulfillmentScore: data.fulfillmentScore,
      completionRate: data.completionRate,
      onTimeRate: data.onTimeRate,
      cancellationRate: data.cancellationRate,
      timeoutCount: data.timeoutCount,
      activeCancelCount: data.activeCancelCount,
      avgResponseBlocks: data.avgResponseBlocks,
      bonusScore: data.bonusScore,
      bountyAdoptionCount: data.bountyAdoptionCount,
      certificationCount: data.certificationCount,
      consecutivePositiveDays: data.consecutivePositiveDays,
      isVerified: data.isVerified,
      hasDeposit: data.hasDeposit,
      totalDeductions: data.totalDeductions,
      lastDeductionReason: data.lastDeductionReason as DeductionReason | undefined,
      lastDeductionAt: data.lastDeductionAt,
      totalOrders: data.totalOrders,
      completedOrders: data.completedOrders,
      totalReviews: data.totalReviews,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastEvaluatedAt: data.lastEvaluatedAt,
    };
  }

  /**
   * 解析违规记录数据
   */
  private parseViolationRecord(data: any): ViolationRecord {
    return {
      id: data.id,
      provider: data.provider,
      violationType: data.violationType as ViolationType,
      reason: this.hexToString(data.reason),
      relatedOrderId: data.relatedOrderId,
      deductionPoints: data.deductionPoints,
      penalty: data.penalty as PenaltyType,
      penaltyDuration: data.penaltyDuration,
      isAppealed: data.isAppealed,
      appealResult: data.appealResult as AppealResult | undefined,
      recordedAt: data.recordedAt,
      expiresAt: data.expiresAt,
      isActive: data.isActive,
    };
  }

  // ==================== 便捷查询方法 ====================

  /**
   * 获取信用权限摘要
   *
   * @param account 提供者账户地址
   */
  async getCreditPermissions(account: string): Promise<{
    canAcceptOrders: boolean;
    canCreatePackages: boolean;
    canAnswerBounties: boolean;
    maxActiveOrders: number;
    level: CreditLevel;
    score: number;
  } | null> {
    const profile = await this.getCreditProfile(account);
    if (!profile) {
      return null;
    }

    return {
      canAcceptOrders: canAcceptOrders(profile.level),
      canCreatePackages: canCreatePackages(profile.level),
      canAnswerBounties: canAnswerBounties(profile.level),
      maxActiveOrders: getMaxActiveOrders(profile.level),
      level: profile.level,
      score: profile.score,
    };
  }

  /**
   * 获取信用评分摘要
   *
   * @param account 提供者账户地址
   */
  async getCreditSummary(account: string): Promise<{
    score: number;
    level: CreditLevel;
    serviceQuality: number;
    behavior: number;
    fulfillment: number;
    bonus: number;
    totalDeductions: number;
    violationCount: number;
    activeViolations: number;
  } | null> {
    const profile = await this.getCreditProfile(account);
    if (!profile) {
      return null;
    }

    return {
      score: profile.score,
      level: profile.level,
      serviceQuality: profile.serviceQualityScore,
      behavior: profile.behaviorScore,
      fulfillment: profile.fulfillmentScore,
      bonus: profile.bonusScore,
      totalDeductions: profile.totalDeductions,
      violationCount: profile.violationCount,
      activeViolations: profile.activeViolations,
    };
  }

  /**
   * 检查是否需要信用修复
   *
   * @param account 提供者账户地址
   */
  async needsCreditRepair(account: string): Promise<boolean> {
    const profile = await this.getCreditProfile(account);
    if (!profile) {
      return false;
    }
    return profile.score < 750;
  }

  /**
   * 获取信用等级分布统计
   */
  async getCreditDistribution(): Promise<{
    level: CreditLevel;
    count: number;
    percentage: number;
  }[]> {
    const stats = await this.getGlobalCreditStats();
    const total = stats.totalProviders || 1;

    return [
      {
        level: CreditLevel.Excellent,
        count: stats.excellentCount,
        percentage: (stats.excellentCount / total) * 100,
      },
      {
        level: CreditLevel.Good,
        count: stats.goodCount,
        percentage: (stats.goodCount / total) * 100,
      },
      {
        level: CreditLevel.Fair,
        count: stats.fairCount,
        percentage: (stats.fairCount / total) * 100,
      },
      {
        level: CreditLevel.Warning,
        count: stats.warningCount,
        percentage: (stats.warningCount / total) * 100,
      },
      {
        level: CreditLevel.Poor,
        count: stats.poorCount,
        percentage: (stats.poorCount / total) * 100,
      },
      {
        level: CreditLevel.Bad,
        count: stats.badCount,
        percentage: (stats.badCount / total) * 100,
      },
    ];
  }
}

/**
 * 创建占卜市场信用体系服务实例
 */
export function createDivinationCreditService(
  api: ApiPromise,
  extension?: InjectedExtension
): DivinationCreditService {
  return new DivinationCreditService(api, extension);
}
