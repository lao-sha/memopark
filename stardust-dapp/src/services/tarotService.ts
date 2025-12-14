/**
 * 塔罗牌链端服务
 *
 * 提供与 pallet-tarot 的交互，支持：
 * - 随机抽牌
 * - 时间起卦
 * - 数字起卦
 * - 带切牌的抽牌
 * - 占卜记录查询与管理
 * - AI 解读请求
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type {
  TarotReading,
  DrawnCard,
  SpreadType,
  DivinationMethod,
  CardPosition,
} from '../types/tarot';
import { createTarotCard } from '../types/tarot';

// ==================== 占卜服务 ====================

/**
 * 随机抽牌
 *
 * 使用链上随机数生成牌序，这是最常用的塔罗抽牌方式。
 *
 * @param spreadType - 牌阵类型
 * @param questionHash - 占卜问题的哈希值（32字节，隐私保护）
 * @param isPublic - 是否公开此占卜记录
 * @returns 占卜记录 ID
 */
export async function divineRandom(
  spreadType: SpreadType,
  questionHash: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 tarot pallet 是否存在
  if (!api.tx.tarot || !api.tx.tarot.divineRandom) {
    throw new Error('区块链节点未包含塔罗牌模块（pallet-tarot），请检查节点配置');
  }

  const tx = api.tx.tarot.divineRandom(
    spreadType,
    Array.from(questionHash),
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[tarot.divineRandom] 交易状态:', status.type);

      // 检查调度错误
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        console.log('[tarot.divineRandom] 交易已打包，事件数量:', events.length);
        const event = events.find((e) =>
          e.event.section === 'tarot' && e.event.method === 'ReadingCreated'
        );
        if (event) {
          const readingId = (event.event.data[0] as any).toNumber();
          console.log('[tarot.divineRandom] 抽牌成功，占卜ID:', readingId);
          resolve(readingId);
        } else if (status.isFinalized) {
          console.error('[tarot.divineRandom] 未找到 ReadingCreated 事件');
          reject(new Error('交易成功但未找到占卜创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[tarot.divineRandom] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 时间起卦
 *
 * 使用当前时间戳和区块信息生成牌序。
 *
 * @param spreadType - 牌阵类型
 * @param questionHash - 占卜问题的哈希值
 * @param isPublic - 是否公开
 * @returns 占卜记录 ID
 */
export async function divineByTime(
  spreadType: SpreadType,
  questionHash: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.tarot || !api.tx.tarot.divineByTime) {
    throw new Error('区块链节点未包含塔罗牌模块（pallet-tarot），请检查节点配置');
  }

  const tx = api.tx.tarot.divineByTime(
    spreadType,
    Array.from(questionHash),
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[tarot.divineByTime] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'tarot' && e.event.method === 'ReadingCreated'
        );
        if (event) {
          const readingId = (event.event.data[0] as any).toNumber();
          console.log('[tarot.divineByTime] 抽牌成功，占卜ID:', readingId);
          resolve(readingId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到占卜创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[tarot.divineByTime] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 数字起卦
 *
 * 使用用户提供的数字序列生成牌序。
 *
 * @param numbers - 用户提供的数字列表（1-16个数字）
 * @param spreadType - 牌阵类型
 * @param questionHash - 占卜问题的哈希值
 * @param isPublic - 是否公开
 * @returns 占卜记录 ID
 */
export async function divineByNumbers(
  numbers: number[],
  spreadType: SpreadType,
  questionHash: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.tarot || !api.tx.tarot.divineByNumbers) {
    throw new Error('区块链节点未包含塔罗牌模块（pallet-tarot），请检查节点配置');
  }

  const tx = api.tx.tarot.divineByNumbers(
    numbers,
    spreadType,
    Array.from(questionHash),
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[tarot.divineByNumbers] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'tarot' && e.event.method === 'ReadingCreated'
        );
        if (event) {
          const readingId = (event.event.data[0] as any).toNumber();
          console.log('[tarot.divineByNumbers] 抽牌成功，占卜ID:', readingId);
          resolve(readingId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到占卜创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[tarot.divineByNumbers] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 带切牌的随机抽牌
 *
 * 模拟真实塔罗占卜仪式，包含洗牌和切牌过程。
 *
 * @param spreadType - 牌阵类型
 * @param cutPosition - 切牌位置（1-77），0或null表示随机切牌
 * @param questionHash - 占卜问题的哈希值
 * @param isPublic - 是否公开
 * @returns 占卜记录 ID
 */
export async function divineWithCut(
  spreadType: SpreadType,
  cutPosition: number | null,
  questionHash: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.tarot || !api.tx.tarot.divineWithCut) {
    throw new Error('区块链节点未包含塔罗牌模块（pallet-tarot），请检查节点配置');
  }

  const cutParam = cutPosition !== null && cutPosition > 0
    ? { Some: cutPosition }
    : null;

  const tx = api.tx.tarot.divineWithCut(
    spreadType,
    cutParam,
    Array.from(questionHash),
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[tarot.divineWithCut] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'tarot' && e.event.method === 'ReadingCreated'
        );
        if (event) {
          const readingId = (event.event.data[0] as any).toNumber();
          console.log('[tarot.divineWithCut] 抽牌成功，占卜ID:', readingId);
          resolve(readingId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到占卜创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[tarot.divineWithCut] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 手动指定抽牌
 *
 * 直接指定牌面和正逆位，用于练习或复盘。
 *
 * @param cards - 牌面列表 [(牌ID, 是否逆位), ...]
 * @param spreadType - 牌阵类型
 * @param questionHash - 占卜问题的哈希值
 * @param isPublic - 是否公开
 * @returns 占卜记录 ID
 */
export async function divineManual(
  cards: Array<[number, boolean]>,
  spreadType: SpreadType,
  questionHash: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.tarot || !api.tx.tarot.divineManual) {
    throw new Error('区块链节点未包含塔罗牌模块（pallet-tarot），请检查节点配置');
  }

  const tx = api.tx.tarot.divineManual(
    cards,
    spreadType,
    Array.from(questionHash),
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[tarot.divineManual] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'tarot' && e.event.method === 'ReadingCreated'
        );
        if (event) {
          const readingId = (event.event.data[0] as any).toNumber();
          console.log('[tarot.divineManual] 指定成功，占卜ID:', readingId);
          resolve(readingId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到占卜创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[tarot.divineManual] 交易失败:', error);
      reject(error);
    });
  });
}

// ==================== 占卜记录查询服务 ====================

/**
 * 获取占卜记录详情
 *
 * @param readingId - 占卜记录 ID
 * @returns 占卜记录数据或 null
 */
export async function getReading(readingId: number): Promise<TarotReading | null> {
  const api = await getApi();

  if (!api.query.tarot || !api.query.tarot.readings) {
    console.error('[getReading] tarot pallet 不存在');
    return null;
  }

  console.log('[getReading] 查询占卜 ID:', readingId);
  const result = await api.query.tarot.readings(readingId) as any;

  if (result.isNone) {
    console.log('[getReading] 占卜记录不存在');
    return null;
  }

  try {
    const data = result.unwrap() as any;
    console.log('[getReading] 原始数据:', JSON.stringify(data.toHuman()));

    // 解析抽取的牌
    const cards: DrawnCard[] = data.cards.map((cardData: any, index: number) => ({
      card: createTarotCard(cardData.card.id.toNumber()),
      position: cardData.position.toNumber() as CardPosition,
      spreadPosition: index,
    }));

    // 解析问题哈希
    const questionHashBytes = data.questionHash;
    const questionHash = Array.from(questionHashBytes as any).map((b: any) => b.toString(16).padStart(2, '0')).join('');

    // 解析 AI 解读 CID
    let interpretationCid: string | undefined;
    if (data.interpretationCid && data.interpretationCid.isSome) {
      const cidBytes = data.interpretationCid.unwrap();
      interpretationCid = new TextDecoder().decode(new Uint8Array(cidBytes));
    }

    const reading: TarotReading = {
      id: readingId,
      diviner: data.diviner.toString(),
      spreadType: data.spreadType.toNumber() as SpreadType,
      method: data.method.toNumber() as DivinationMethod,
      cards,
      questionHash,
      blockNumber: data.blockNumber.toNumber(),
      timestamp: data.timestamp.toNumber(),
      interpretationCid,
      isPublic: data.isPublic.isTrue,
    };

    console.log('[getReading] 解析成功:', reading);
    return reading;
  } catch (error) {
    console.error('[getReading] 解析失败:', error);
    return null;
  }
}

/**
 * 获取用户的占卜记录列表
 *
 * @param address - 用户地址
 * @returns 占卜记录 ID 列表
 */
export async function getUserReadings(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.tarot || !api.query.tarot.userReadings) {
    console.error('[getUserReadings] tarot pallet 不存在');
    return [];
  }

  const result = await api.query.tarot.userReadings(address) as any;
  return result.map((id: any) => id.toNumber());
}

/**
 * 获取公开占卜记录列表
 *
 * @returns 公开占卜记录 ID 列表
 */
export async function getPublicReadings(): Promise<number[]> {
  const api = await getApi();

  if (!api.query.tarot || !api.query.tarot.publicReadings) {
    console.error('[getPublicReadings] tarot pallet 不存在');
    return [];
  }

  const result = await api.query.tarot.publicReadings() as any;
  return result.map((id: any) => id.toNumber());
}

/**
 * 获取用户统计数据
 *
 * @param address - 用户地址
 * @returns 用户统计
 */
export async function getUserStats(address: string): Promise<{
  totalReadings: number;
  majorArcanaCount: number;
  reversedCount: number;
  mostFrequentCard: number;
  mostFrequentCount: number;
} | null> {
  const api = await getApi();

  if (!api.query.tarot || !api.query.tarot.divinationStats) {
    return null;
  }

  const result = await api.query.tarot.divinationStats(address) as any;
  if (!result) return null;

  return {
    totalReadings: result.totalReadings.toNumber(),
    majorArcanaCount: result.majorArcanaCount.toNumber(),
    reversedCount: result.reversedCount.toNumber(),
    mostFrequentCard: result.mostFrequentCard.toNumber(),
    mostFrequentCount: result.mostFrequentCount.toNumber(),
  };
}

// ==================== 占卜记录管理服务 ====================

/**
 * 设置占卜记录公开状态
 *
 * @param readingId - 占卜记录 ID
 * @param isPublic - 是否公开
 */
export async function setReadingVisibility(readingId: number, isPublic: boolean): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.tarot || !api.tx.tarot.setReadingVisibility) {
    throw new Error('区块链节点未包含塔罗牌模块（pallet-tarot），请检查节点配置');
  }

  const tx = api.tx.tarot.setReadingVisibility(readingId, isPublic);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        console.log('[setReadingVisibility] 设置成功');
        resolve();
      }
    }).catch((error) => {
      console.error('[setReadingVisibility] 设置失败:', error);
      reject(error);
    });
  });
}

// ==================== AI 解读服务 ====================

/**
 * 请求 AI 解读
 *
 * @param readingId - 占卜记录 ID
 */
export async function requestAiInterpretation(readingId: number): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.tarot || !api.tx.tarot.requestAiInterpretation) {
    throw new Error('区块链节点未包含塔罗牌模块（pallet-tarot），请检查节点配置');
  }

  const tx = api.tx.tarot.requestAiInterpretation(readingId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        console.log('[requestAiInterpretation] 请求成功');
        resolve();
      }
    }).catch((error) => {
      console.error('[requestAiInterpretation] 请求失败:', error);
      reject(error);
    });
  });
}

// ==================== 批量查询服务 ====================

/**
 * 批量获取占卜记录详情
 *
 * @param readingIds - 占卜记录 ID 列表
 * @returns 占卜记录数据列表
 */
export async function getReadingsBatch(readingIds: number[]): Promise<TarotReading[]> {
  const results = await Promise.all(readingIds.map((id) => getReading(id)));
  return results.filter((reading): reading is TarotReading => reading !== null);
}

/**
 * 获取用户的所有占卜记录详情
 *
 * @param address - 用户地址
 * @returns 占卜记录数据列表
 */
export async function getUserReadingsWithDetails(address: string): Promise<TarotReading[]> {
  const readingIds = await getUserReadings(address);
  return getReadingsBatch(readingIds);
}

/**
 * 获取公开占卜记录详情（分页）
 *
 * @param page - 页码（从 0 开始）
 * @param pageSize - 每页数量
 * @returns 占卜记录数据列表和总数
 */
export async function getPublicReadingsWithDetails(
  page: number = 0,
  pageSize: number = 10
): Promise<{ readings: TarotReading[]; total: number }> {
  const allIds = await getPublicReadings();
  const total = allIds.length;
  const start = page * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageIds = allIds.slice(start, end);
  const readings = await getReadingsBatch(pageIds);
  return { readings, total };
}

// ==================== 辅助函数 ====================

/**
 * 生成问题哈希（SHA-256）
 *
 * @param question - 占卜问题
 * @returns 32字节哈希值
 */
export async function hashQuestion(question: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(question);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * 快速占卜（随机抽牌 + 自动生成问题哈希）
 *
 * @param question - 占卜问题
 * @param spreadType - 牌阵类型
 * @param isPublic - 是否公开
 * @returns 占卜记录 ID
 */
export async function quickDivine(
  question: string,
  spreadType: SpreadType,
  isPublic: boolean = false
): Promise<number> {
  const questionHash = await hashQuestion(question);
  return divineRandom(spreadType, questionHash, isPublic);
}

// ==================== Runtime API 解卦查询服务（免费） ====================

import type {
  TarotCoreInterpretation,
  TarotFullInterpretation,
  SpreadEnergyAnalysis,
  TimelineAnalysis,
  CardInterpretation,
  CardRelationship,
  InterpretationTextType,
  INTERPRETATION_TEXT_MAP,
} from '../types/tarot';

/**
 * 获取核心解卦结果
 *
 * 基于占卜记录生成核心解卦数据，约 30 bytes。
 * 此接口使用 Runtime API，完全免费（无 Gas 费用）。
 *
 * 返回数据包括：
 * - 总体能量等级 (0-100)
 * - 主导元素（火/水/风/土/灵性）
 * - 吉凶倾向（大吉到凶五级）
 * - 逆位比例
 * - 大阿卡纳/宫廷牌/数字牌统计
 * - 能量指数（行动/情感/思维/物质/灵性/稳定/变化）
 * - 综合评分和可信度
 *
 * @param readingId - 塔罗牌占卜记录 ID
 * @returns 核心解卦结果，如果记录不存在返回 null
 */
export async function getCoreInterpretation(
  readingId: number
): Promise<TarotCoreInterpretation | null> {
  try {
    const api = await getApi();

    // 检查 Runtime API 是否存在
    if (!api.call.tarotApi || !api.call.tarotApi.getCoreInterpretation) {
      console.error('[getCoreInterpretation] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.getCoreInterpretation(readingId) as any;

    if (result.isNone) {
      console.warn(`[getCoreInterpretation] 占卜记录 ${readingId} 不存在`);
      return null;
    }

    const interpretation = result.unwrap().toJSON() as TarotCoreInterpretation;
    console.log('[getCoreInterpretation] 解卦成功:', interpretation);
    return interpretation;
  } catch (error) {
    console.error('[getCoreInterpretation] 获取核心解卦失败:', error);
    return null;
  }
}

/**
 * 获取完整解卦结果
 *
 * 返回包含所有分析的完整解卦：
 * - core: 核心指标
 * - spreadEnergy: 牌阵能量分析（过去/现在/未来/内在/外在能量）
 * - cardAnalyses: 各牌分析（可选）
 * - cardRelationships: 牌间关系分析（可选）
 * - timelineAnalysis: 时间线分析（可选）
 *
 * @param readingId - 塔罗牌占卜记录 ID
 * @returns 完整解卦结果，如果记录不存在返回 null
 */
export async function getFullInterpretation(
  readingId: number
): Promise<TarotFullInterpretation | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.getFullInterpretation) {
      console.error('[getFullInterpretation] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.getFullInterpretation(readingId) as any;

    if (result.isNone) {
      console.warn(`[getFullInterpretation] 占卜记录 ${readingId} 不存在`);
      return null;
    }

    const interpretation = result.unwrap().toJSON() as TarotFullInterpretation;
    console.log('[getFullInterpretation] 完整解卦成功');
    return interpretation;
  } catch (error) {
    console.error('[getFullInterpretation] 获取完整解卦失败:', error);
    return null;
  }
}

/**
 * 获取解读文本索引列表
 *
 * 返回适用于当前占卜的解读文本类型列表。
 * 前端可使用 INTERPRETATION_TEXT_MAP 将索引转换为对应的中文描述。
 *
 * 文本类型包括：
 * - 能量描述（高/中/低/波动）
 * - 元素主导描述（火/水/风/土/灵性/均衡）
 * - 吉凶判断（大吉到凶）
 * - 特殊组合（愚者+世界/多大阿/同花色连号/全逆位/全正位）
 * - 行动建议（积极行动/观望/内省/求助等）
 * - 能量指数高亮
 *
 * @param readingId - 塔罗牌占卜记录 ID
 * @returns 解读文本索引列表，如果记录不存在返回 null
 */
export async function getInterpretationTexts(
  readingId: number
): Promise<InterpretationTextType[] | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.getInterpretationTexts) {
      console.error('[getInterpretationTexts] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.getInterpretationTexts(readingId) as any;

    if (result.isNone) {
      console.warn(`[getInterpretationTexts] 占卜记录 ${readingId} 不存在`);
      return null;
    }

    const texts = result.unwrap().toJSON() as InterpretationTextType[];
    console.log('[getInterpretationTexts] 获取成功:', texts);
    return texts;
  } catch (error) {
    console.error('[getInterpretationTexts] 获取解读文本失败:', error);
    return null;
  }
}

/**
 * 生成 AI 解读提示词上下文
 *
 * 返回结构化的上下文信息，用于 AI 解读服务。
 * 包含牌阵类型、主导元素、能量状态、吉凶倾向、各牌信息、特殊组合等。
 *
 * @param readingId - 塔罗牌占卜记录 ID
 * @returns AI 提示词上下文（UTF-8 字符串），如果记录不存在返回 null
 */
export async function generateAiPromptContext(readingId: number): Promise<string | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.generateAiPromptContext) {
      console.error('[generateAiPromptContext] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.generateAiPromptContext(readingId) as any;

    if (result.isNone) {
      console.warn(`[generateAiPromptContext] 占卜记录 ${readingId} 不存在`);
      return null;
    }

    const contextBytes = result.unwrap();
    const context = new TextDecoder().decode(new Uint8Array(contextBytes));
    console.log('[generateAiPromptContext] 生成成功');
    return context;
  } catch (error) {
    console.error('[generateAiPromptContext] 生成 AI 上下文失败:', error);
    return null;
  }
}

/**
 * 检查占卜记录是否存在
 *
 * 快速检查记录是否存在，无需获取完整数据。
 *
 * @param readingId - 占卜记录 ID
 * @returns 是否存在
 */
export async function readingExists(readingId: number): Promise<boolean> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.readingExists) {
      // 降级到存储查询
      const reading = await getReading(readingId);
      return reading !== null;
    }

    const result = await api.call.tarotApi.readingExists(readingId) as any;
    return result.isTrue;
  } catch (error) {
    console.error('[readingExists] 检查失败:', error);
    return false;
  }
}

/**
 * 获取占卜记录创建者
 *
 * @param readingId - 占卜记录 ID
 * @returns 创建者地址，如果不存在返回 null
 */
export async function getReadingOwner(readingId: number): Promise<string | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.getReadingOwner) {
      // 降级到存储查询
      const reading = await getReading(readingId);
      return reading?.diviner || null;
    }

    const result = await api.call.tarotApi.getReadingOwner(readingId) as any;

    if (result.isNone) {
      return null;
    }

    return result.unwrap().toString();
  } catch (error) {
    console.error('[getReadingOwner] 获取失败:', error);
    return null;
  }
}

/**
 * 批量获取核心解卦结果
 *
 * 使用 Runtime API 的批量接口，比单个查询更高效。
 *
 * @param readingIds - 占卜记录 ID 列表
 * @returns 解卦结果列表
 */
export async function batchGetCoreInterpretations(
  readingIds: number[]
): Promise<Array<{ id: number; interpretation: TarotCoreInterpretation | null }>> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.batchGetCoreInterpretations) {
      // 降级到单个查询
      console.log('[batchGetCoreInterpretations] 批量 API 不存在，降级到单个查询');
      const results = await Promise.all(
        readingIds.map(async (id) => ({
          id,
          interpretation: await getCoreInterpretation(id),
        }))
      );
      return results;
    }

    const result = await api.call.tarotApi.batchGetCoreInterpretations(readingIds) as any;
    const batchResult = result.toJSON() as Array<[number, TarotCoreInterpretation | null]>;

    return batchResult.map(([id, interp]) => ({
      id,
      interpretation: interp,
    }));
  } catch (error) {
    console.error('[batchGetCoreInterpretations] 批量获取失败:', error);
    // 降级到单个查询
    const results = await Promise.all(
      readingIds.map(async (id) => ({
        id,
        interpretation: await getCoreInterpretation(id),
      }))
    );
    return results;
  }
}

/**
 * 分析单张牌在特定牌阵位置的含义
 *
 * 用于前端展示单张牌的详细信息，包括位置权重和能量强度。
 *
 * @param cardId - 牌 ID (0-77)
 * @param isReversed - 是否逆位
 * @param spreadType - 牌阵类型
 * @param position - 牌阵位置
 * @returns 牌位分析结果
 */
export async function analyzeCardInSpread(
  cardId: number,
  isReversed: boolean,
  spreadType: number,
  position: number
): Promise<CardInterpretation | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.analyzeCardInSpread) {
      console.error('[analyzeCardInSpread] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.analyzeCardInSpread(
      cardId,
      isReversed,
      spreadType,
      position
    ) as any;

    if (result.isNone) {
      return null;
    }

    return result.unwrap().toJSON() as CardInterpretation;
  } catch (error) {
    console.error('[analyzeCardInSpread] 分析失败:', error);
    return null;
  }
}

/**
 * 分析两张牌之间的关系
 *
 * 用于展示牌阵中相邻牌或关键牌之间的能量互动。
 *
 * @param card1Id - 第一张牌 ID
 * @param card2Id - 第二张牌 ID
 * @returns 牌间关系分析
 */
export async function analyzeCardRelationship(
  card1Id: number,
  card2Id: number
): Promise<CardRelationship | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.analyzeCardRelationship) {
      console.error('[analyzeCardRelationship] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.analyzeCardRelationship(card1Id, card2Id) as any;

    if (result.isNone) {
      return null;
    }

    return result.unwrap().toJSON() as CardRelationship;
  } catch (error) {
    console.error('[analyzeCardRelationship] 分析失败:', error);
    return null;
  }
}

/**
 * 获取牌阵能量分析
 *
 * 返回牌阵的时间维度能量分布和内外能量对比。
 *
 * @param readingId - 占卜记录 ID
 * @returns 牌阵能量分析
 */
export async function getSpreadEnergy(readingId: number): Promise<SpreadEnergyAnalysis | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.getSpreadEnergy) {
      console.error('[getSpreadEnergy] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.getSpreadEnergy(readingId) as any;

    if (result.isNone) {
      return null;
    }

    return result.unwrap().toJSON() as SpreadEnergyAnalysis;
  } catch (error) {
    console.error('[getSpreadEnergy] 获取失败:', error);
    return null;
  }
}

/**
 * 获取时间线分析
 *
 * 基于牌阵能量推断过去、现在、未来的趋势。
 *
 * @param readingId - 占卜记录 ID
 * @returns 时间线分析
 */
export async function getTimelineAnalysis(readingId: number): Promise<TimelineAnalysis | null> {
  try {
    const api = await getApi();

    if (!api.call.tarotApi || !api.call.tarotApi.getTimelineAnalysis) {
      console.error('[getTimelineAnalysis] tarotApi Runtime API 不存在');
      return null;
    }

    const result = await api.call.tarotApi.getTimelineAnalysis(readingId) as any;

    if (result.isNone) {
      return null;
    }

    return result.unwrap().toJSON() as TimelineAnalysis;
  } catch (error) {
    console.error('[getTimelineAnalysis] 获取失败:', error);
    return null;
  }
}

// ==================== 综合解读服务 ====================

/**
 * 获取占卜记录的完整解读数据
 *
 * 一次性获取占卜记录和解卦数据，用于详情页展示。
 *
 * @param readingId - 占卜记录 ID
 * @returns 完整的占卜和解卦数据
 */
export async function getReadingWithInterpretation(readingId: number): Promise<{
  reading: TarotReading | null;
  core: TarotCoreInterpretation | null;
  texts: InterpretationTextType[] | null;
  spreadEnergy: SpreadEnergyAnalysis | null;
  timeline: TimelineAnalysis | null;
}> {
  // 并行获取所有数据
  const [reading, core, texts, spreadEnergy, timeline] = await Promise.all([
    getReading(readingId),
    getCoreInterpretation(readingId),
    getInterpretationTexts(readingId),
    getSpreadEnergy(readingId),
    getTimelineAnalysis(readingId),
  ]);

  return { reading, core, texts, spreadEnergy, timeline };
}

/**
 * 将解读文本索引转换为中文描述
 *
 * @param textTypes - 解读文本索引列表
 * @returns 中文描述列表
 */
export function convertInterpretationTextsToStrings(
  textTypes: InterpretationTextType[]
): string[] {
  // 动态导入 INTERPRETATION_TEXT_MAP
  const { INTERPRETATION_TEXT_MAP: textMap } = require('../types/tarot');
  return textTypes
    .map((type) => textMap[type])
    .filter((text): text is string => text !== undefined);
}
