/**
 * 悬赏问答系统服务接口
 *
 * 提供与 pallet-divination-market 中悬赏问答功能的交互接口
 */

import { ApiPromise } from '@polkadot/api';
import type {
  BountyQuestion,
  BountyAnswer,
  BountyVote,
  BountyStatistics,
  DivinationType,
  Specialty,
  RewardDistribution,
  DEFAULT_REWARD_DISTRIBUTION,
} from '../types/divination';
import { uploadToIpfs as uploadFileToIpfs } from '../lib/ipfs';
import { fetchFromIPFS } from './ipfs';

/**
 * 悬赏问答服务类
 */
export class BountyService {
  private api: ApiPromise;

  constructor(api: ApiPromise) {
    this.api = api;
  }

  /**
   * 创建悬赏问题
   * @param account 创建者账户
   * @param divinationType 占卜类型
   * @param resultId 占卜结果ID
   * @param questionText 问题描述文本
   * @param bountyAmount 悬赏金额（DUST）
   * @param deadlineBlocks 截止时间（区块数，从当前开始）
   * @param minAnswers 最少回答数
   * @param maxAnswers 最多回答数
   * @param specialty 指定擅长领域（可选）
   * @param certifiedOnly 是否仅限认证提供者
   * @param allowVoting 是否允许投票
   * @returns Promise<number> 悬赏ID
   */
  async createBounty(
    account: string,
    divinationType: DivinationType,
    resultId: number,
    questionText: string,
    bountyAmount: bigint,
    deadlineBlocks: number,
    minAnswers: number = 1,
    maxAnswers: number = 10,
    specialty?: Specialty,
    certifiedOnly: boolean = false,
    allowVoting: boolean = true
  ): Promise<number> {
    // TODO: 上传问题文本到IPFS获取CID
    const questionCid = await this.uploadToIpfs(questionText);

    const currentBlock = await this.api.query.system.number();
    const deadline = currentBlock.toNumber() + deadlineBlocks;

    // 调用 pallet 创建悬赏
    const tx = this.api.tx.divinationMarket.createBounty(
      divinationType,
      resultId,
      questionCid,
      bountyAmount.toString(),
      deadline,
      minAnswers,
      maxAnswers,
      specialty ?? null,
      certifiedOnly,
      allowVoting
    );

    // TODO: 签名并提交交易
    const result = await this.submitTransaction(account, tx);

    // 从事件中提取悬赏ID
    return this.extractBountyIdFromEvents(result);
  }

  /**
   * 提交悬赏回答
   * @param account 回答者账户
   * @param bountyId 悬赏ID
   * @param answerText 回答内容
   * @returns Promise<number> 回答ID
   */
  async submitBountyAnswer(
    account: string,
    bountyId: number,
    answerText: string
  ): Promise<number> {
    // TODO: 上传回答内容到IPFS获取CID
    const answerCid = await this.uploadToIpfs(answerText);

    const tx = this.api.tx.divinationMarket.submitBountyAnswer(
      bountyId,
      answerCid
    );

    const result = await this.submitTransaction(account, tx);
    return this.extractAnswerIdFromEvents(result);
  }

  /**
   * 为悬赏回答投票
   * @param account 投票者账户
   * @param bountyId 悬赏ID
   * @param answerId 回答ID
   */
  async voteBountyAnswer(
    account: string,
    bountyId: number,
    answerId: number
  ): Promise<void> {
    const tx = this.api.tx.divinationMarket.voteBountyAnswer(
      bountyId,
      answerId
    );

    await this.submitTransaction(account, tx);
  }

  /**
   * 关闭悬赏（停止接受新回答）
   * @param account 创建者账户
   * @param bountyId 悬赏ID
   */
  async closeBounty(account: string, bountyId: number): Promise<void> {
    const tx = this.api.tx.divinationMarket.closeBounty(bountyId);
    await this.submitTransaction(account, tx);
  }

  /**
   * 采纳悬赏答案（选择前三名）
   * @param account 创建者账户
   * @param bountyId 悬赏ID
   * @param firstPlaceId 第一名答案ID
   * @param secondPlaceId 第二名答案ID（可选）
   * @param thirdPlaceId 第三名答案ID（可选）
   */
  async adoptBountyAnswers(
    account: string,
    bountyId: number,
    firstPlaceId: number,
    secondPlaceId?: number,
    thirdPlaceId?: number
  ): Promise<void> {
    const tx = this.api.tx.divinationMarket.adoptBountyAnswers(
      bountyId,
      firstPlaceId,
      secondPlaceId ?? null,
      thirdPlaceId ?? null
    );

    await this.submitTransaction(account, tx);
  }

  /**
   * 结算悬赏（分发奖励）
   * @param account 任意账户
   * @param bountyId 悬赏ID
   */
  async settleBounty(account: string, bountyId: number): Promise<void> {
    const tx = this.api.tx.divinationMarket.settleBounty(bountyId);
    await this.submitTransaction(account, tx);
  }

  /**
   * 取消悬赏（仅无回答时可用）
   * @param account 创建者账户
   * @param bountyId 悬赏ID
   */
  async cancelBounty(account: string, bountyId: number): Promise<void> {
    const tx = this.api.tx.divinationMarket.cancelBounty(bountyId);
    await this.submitTransaction(account, tx);
  }

  /**
   * 获取悬赏问题详情
   * @param bountyId 悬赏ID
   * @returns Promise<BountyQuestion | null>
   */
  async getBountyQuestion(bountyId: number): Promise<BountyQuestion | null> {
    const bountyOption = await this.api.query.divinationMarket.bountyQuestions(bountyId);

    if (bountyOption.isNone) {
      return null;
    }

    const bounty = bountyOption.unwrap();

    // 下载问题内容
    const questionText = await this.downloadFromIpfs(bounty.questionCid.toUtf8());

    return {
      id: bountyId,
      creator: bounty.creator.toString(),
      divinationType: bounty.divinationType.toNumber(),
      resultId: bounty.resultId.toNumber(),
      questionCid: bounty.questionCid.toUtf8(),
      bountyAmount: bounty.bountyAmount.toBigInt(),
      deadline: bounty.deadline.toNumber(),
      minAnswers: bounty.minAnswers.toNumber(),
      maxAnswers: bounty.maxAnswers.toNumber(),
      specialty: bounty.specialty.isSome ? bounty.specialty.unwrap().toNumber() : undefined,
      certifiedOnly: bounty.certifiedOnly.isTrue,
      allowVoting: bounty.allowVoting.isTrue,
      status: bounty.status.toNumber(),
      answerCount: bounty.answerCount.toNumber(),
      totalVotes: bounty.totalVotes.toNumber(),
      createdAt: bounty.createdAt.toNumber(),
      closedAt: bounty.closedAt.isSome ? bounty.closedAt.unwrap().toNumber() : undefined,
      adoptedAnswerId: bounty.adoptedAnswerId.isSome ? bounty.adoptedAnswerId.unwrap().toNumber() : undefined,
      secondPlaceId: bounty.secondPlaceId.isSome ? bounty.secondPlaceId.unwrap().toNumber() : undefined,
      thirdPlaceId: bounty.thirdPlaceId.isSome ? bounty.thirdPlaceId.unwrap().toNumber() : undefined,
      settledAt: bounty.settledAt.isSome ? bounty.settledAt.unwrap().toNumber() : undefined,
      rewardDistribution: this.parseRewardDistribution(bounty.rewardDistribution) || DEFAULT_REWARD_DISTRIBUTION,
    };
  }

  /**
   * 获取悬赏回答列表
   * @param bountyId 悬赏ID
   * @returns Promise<BountyAnswer[]>
   */
  async getBountyAnswers(bountyId: number): Promise<BountyAnswer[]> {
    // 获取回答ID列表
    const answerIds = await this.api.query.divinationMarket.bountyAnswerIds(bountyId);
    const answers: BountyAnswer[] = [];

    for (const answerId of answerIds.toArray()) {
      const answerOption = await this.api.query.divinationMarket.bountyAnswers(answerId.toNumber());

      if (answerOption.isSome) {
        const answer = answerOption.unwrap();

        answers.push({
          id: answerId.toNumber(),
          bountyId: answer.bountyId.toNumber(),
          answerer: answer.answerer.toString(),
          contentCid: answer.contentCid.toUtf8(),
          status: answer.status.toNumber(),
          votes: answer.votes.toNumber(),
          rewardAmount: answer.rewardAmount.toBigInt(),
          submittedAt: answer.submittedAt.toNumber(),
          isCertified: answer.isCertified.isTrue,
          providerTier: answer.providerTier.isSome ? answer.providerTier.unwrap().toNumber() : undefined,
        });
      }
    }

    return answers;
  }

  /**
   * 获取用户创建的悬赏列表
   * @param account 用户账户
   * @returns Promise<number[]> 悬赏ID列表
   */
  async getUserBounties(account: string): Promise<number[]> {
    const bountyIds = await this.api.query.divinationMarket.userBounties(account);
    return bountyIds.toArray().map(id => id.toNumber());
  }

  /**
   * 获取用户提交的回答列表
   * @param account 用户账户
   * @returns Promise<number[]> 回答ID列表
   */
  async getUserBountyAnswers(account: string): Promise<number[]> {
    const answerIds = await this.api.query.divinationMarket.userBountyAnswers(account);
    return answerIds.toArray().map(id => id.toNumber());
  }

  /**
   * 获取悬赏统计信息
   * @returns Promise<BountyStatistics>
   */
  async getBountyStatistics(): Promise<BountyStatistics> {
    // 检查 pallet 是否存在
    if (!this.api.query.divinationMarket?.bountyStatistics) {
      console.warn('divinationMarket.bountyStatistics 未部署到链上');
      return {
        totalBounties: 0,
        activeBounties: 0,
        settledBounties: 0,
        totalAnswers: 0,
        totalBountyAmount: BigInt(0),
        totalRewardsDistributed: BigInt(0),
        totalPlatformFees: BigInt(0),
      };
    }

    const stats = await this.api.query.divinationMarket.bountyStatistics();

    // 检查返回值是否有效
    if (!stats || stats.isEmpty) {
      return {
        totalBounties: 0,
        activeBounties: 0,
        settledBounties: 0,
        totalAnswers: 0,
        totalBountyAmount: BigInt(0),
        totalRewardsDistributed: BigInt(0),
        totalPlatformFees: BigInt(0),
      };
    }

    return {
      totalBounties: stats.totalBounties?.toNumber() ?? 0,
      activeBounties: stats.activeBounties?.toNumber() ?? 0,
      settledBounties: stats.settledBounties?.toNumber() ?? 0,
      totalAnswers: stats.totalAnswers?.toNumber() ?? 0,
      totalBountyAmount: stats.totalBountyAmount?.toBigInt() ?? BigInt(0),
      totalRewardsDistributed: stats.totalRewardsDistributed?.toBigInt() ?? BigInt(0),
      totalPlatformFees: stats.totalPlatformFees?.toBigInt() ?? BigInt(0),
    };
  }

  /**
   * 获取所有悬赏列表（分页）
   * @param offset 偏移量
   * @param limit 限制数量
   * @returns Promise<BountyQuestion[]>
   */
  async getAllBounties(offset: number = 0, limit: number = 20): Promise<BountyQuestion[]> {
    const stats = await this.getBountyStatistics();
    const totalBounties = stats.totalBounties;

    const bounties: BountyQuestion[] = [];
    const startId = Math.max(0, totalBounties - offset - limit);
    const endId = Math.min(totalBounties, totalBounties - offset);

    for (let id = startId; id < endId; id++) {
      const bounty = await this.getBountyQuestion(id);
      if (bounty) {
        bounties.push(bounty);
      }
    }

    return bounties.reverse(); // 最新的在前
  }

  /**
   * 获取活跃悬赏列表
   * @returns Promise<BountyQuestion[]>
   */
  async getActiveBounties(): Promise<BountyQuestion[]> {
    // TODO: 实现更高效的查询方式
    // 目前简单遍历所有悬赏，实际应该通过索引或事件来优化
    const allBounties = await this.getAllBounties(0, 100);
    return allBounties.filter(bounty => bounty.status === 0); // BountyStatus.Open
  }

  /**
   * 根据占卜类型获取悬赏列表
   * @param divinationType 占卜类型
   * @returns Promise<BountyQuestion[]>
   */
  async getBountiesByDivinationType(divinationType: DivinationType): Promise<BountyQuestion[]> {
    const allBounties = await this.getAllBounties(0, 100);
    return allBounties.filter(bounty => bounty.divinationType === divinationType);
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 上传内容到IPFS
   * @param content 内容文本
   * @returns Promise<string> IPFS CID
   */
  private async uploadToIpfs(content: string): Promise<string> {
    try {
      // 将文本转换为File对象
      const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
      const file = new File([blob], 'content.txt', { type: 'text/plain' });

      // 上传到IPFS
      const cid = await uploadFileToIpfs(file);
      return cid;
    } catch (error) {
      console.error('IPFS上传失败:', error);
      throw new Error(`上传内容到IPFS失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从IPFS下载内容
   * @param cid IPFS CID
   * @returns Promise<string> 内容文本
   */
  private async downloadFromIpfs(cid: string): Promise<string> {
    try {
      // 从IPFS网关获取内容
      const content = await fetchFromIPFS(cid);
      return content;
    } catch (error) {
      console.error('IPFS下载失败:', error);
      throw new Error(`从IPFS下载内容失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 提交交易
   * @param account 签名账户（暂未使用，使用api.signer）
   * @param tx 交易对象
   * @returns Promise<any> 交易结果（包含事件）
   */
  private async submitTransaction(account: string, tx: any): Promise<any> {
    return new Promise((resolve, reject) => {
      tx.signAndSend(this.api.signer, ({ status, events, dispatchError }: any) => {
        console.log('[BountyService] 交易状态:', status.type);

        // 检查调度错误
        if (dispatchError) {
          if (dispatchError.isModule) {
            try {
              const decoded = this.api.registry.findMetaError(dispatchError.asModule);
              const { docs, name, section } = decoded;
              reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
            } catch (e) {
              reject(new Error(dispatchError.toString()));
            }
          } else {
            reject(new Error(dispatchError.toString()));
          }
          return;
        }

        // 交易已打包或已确认
        if (status.isInBlock || status.isFinalized) {
          console.log('[BountyService] 交易已打包，事件数量:', events.length);
          resolve({ status, events });
        }
      }).catch((error: any) => {
        console.error('[BountyService] 交易签名或发送失败:', error);
        reject(new Error(`交易失败: ${error.message || error}`));
      });
    });
  }

  /**
   * 从事件中提取悬赏ID
   * @param result 交易结果
   * @returns number 悬赏ID
   */
  private extractBountyIdFromEvents(result: any): number {
    try {
      const { events } = result;

      // 查找 BountyCreated 事件
      const event = events.find((e: any) =>
        e.event.section === 'divinationMarket' && e.event.method === 'BountyCreated'
      );

      if (event) {
        // 第一个参数应该是悬赏ID
        const bountyId = event.event.data[0].toNumber();
        console.log('[BountyService] 提取到悬赏ID:', bountyId);
        return bountyId;
      }

      throw new Error('未找到 BountyCreated 事件');
    } catch (error) {
      console.error('[BountyService] 提取悬赏ID失败:', error);
      throw new Error(`无法提取悬赏ID: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从事件中提取回答ID
   * @param result 交易结果
   * @returns number 回答ID
   */
  private extractAnswerIdFromEvents(result: any): number {
    try {
      const { events } = result;

      // 查找 AnswerSubmitted 事件
      const event = events.find((e: any) =>
        e.event.section === 'divinationMarket' && e.event.method === 'AnswerSubmitted'
      );

      if (event) {
        // 第二个参数应该是回答ID（第一个是bountyId）
        const answerId = event.event.data[1].toNumber();
        console.log('[BountyService] 提取到回答ID:', answerId);
        return answerId;
      }

      throw new Error('未找到 AnswerSubmitted 事件');
    } catch (error) {
      console.error('[BountyService] 提取回答ID失败:', error);
      throw new Error(`无法提取回答ID: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解析奖励分配配置
   * @param raw 原始数据
   * @returns RewardDistribution | null
   */
  private parseRewardDistribution(raw: any): RewardDistribution | null {
    try {
      return {
        firstPlace: raw.firstPlace.toNumber(),
        secondPlace: raw.secondPlace.toNumber(),
        thirdPlace: raw.thirdPlace.toNumber(),
        platformFee: raw.platformFee.toNumber(),
        participationPool: raw.participationPool.toNumber(),
      };
    } catch {
      return null;
    }
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建悬赏服务实例
 * @param api Polkadot API实例
 * @returns BountyService
 */
export function createBountyService(api: ApiPromise): BountyService {
  return new BountyService(api);
}

// ==================== 导出的辅助函数 ====================

/**
 * 获取悬赏问题详情
 * @param bountyId 悬赏ID
 * @returns Promise<BountyQuestion | null>
 */
export async function getBountyQuestion(bountyId: number): Promise<BountyQuestion | null> {
  // TODO: 获取全局API实例
  const api = null as any; // 临时处理
  const service = createBountyService(api);
  return service.getBountyQuestion(bountyId);
}

/**
 * 获取活跃悬赏列表
 * @returns Promise<BountyQuestion[]>
 */
export async function getActiveBounties(): Promise<BountyQuestion[]> {
  // TODO: 获取全局API实例
  const api = null as any; // 临时处理
  const service = createBountyService(api);
  return service.getActiveBounties();
}

/**
 * 创建悬赏问题
 * @param params 创建参数
 * @returns Promise<number> 悬赏ID
 */
export async function createBounty(params: {
  account: string;
  divinationType: DivinationType;
  resultId: number;
  questionText: string;
  bountyAmount: bigint;
  deadlineBlocks: number;
  minAnswers?: number;
  maxAnswers?: number;
  specialty?: Specialty;
  certifiedOnly?: boolean;
  allowVoting?: boolean;
}): Promise<number> {
  // TODO: 获取全局API实例
  const api = null as any; // 临时处理
  const service = createBountyService(api);

  return service.createBounty(
    params.account,
    params.divinationType,
    params.resultId,
    params.questionText,
    params.bountyAmount,
    params.deadlineBlocks,
    params.minAnswers,
    params.maxAnswers,
    params.specialty,
    params.certifiedOnly,
    params.allowVoting
  );
}