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
          const readingId = event.event.data[0].toNumber();
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
          const readingId = event.event.data[0].toNumber();
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
          const readingId = event.event.data[0].toNumber();
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
          const readingId = event.event.data[0].toNumber();
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
          const readingId = event.event.data[0].toNumber();
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
  const result = await api.query.tarot.readings(readingId);

  if (result.isNone) {
    console.log('[getReading] 占卜记录不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[getReading] 原始数据:', JSON.stringify(data.toHuman()));

    // 解析抽取的牌
    const cards: DrawnCard[] = data.cards.map((cardData: any, index: number) => ({
      card: createTarotCard(cardData.card.id.toNumber()),
      position: cardData.position.toNumber() as CardPosition,
      spreadPosition: index,
    }));

    // 解析问题哈希
    const questionHashBytes = data.questionHash;
    const questionHash = Array.from(questionHashBytes).map(b => b.toString(16).padStart(2, '0')).join('');

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

  const result = await api.query.tarot.userReadings(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
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

  const result = await api.query.tarot.publicReadings();
  return result.map((id: { toNumber: () => number }) => id.toNumber());
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

  const result = await api.query.tarot.divinationStats(address);
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
