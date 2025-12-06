/**
 * 小六壬链端服务
 *
 * 提供与 pallet-xiaoliuren 的交互，支持：
 * - 时间起课（农历月日时）
 * - 时刻分起课（时辰、刻、分）
 * - 数字起课（活数起课法）
 * - 多位数字起课（如车牌、手机号）
 * - 三数字起课（递推法）
 * - 随机起课（链上随机数）
 * - 手动指定起课
 * - 课盘查询与管理
 * - AI 解读请求
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type {
  LiuGong,
  DivinationMethod,
  SanGong,
  XiaoLiuRenPan,
} from '../types/xiaoliuren';

// ==================== 起课服务 ====================

/**
 * 时间起课
 *
 * 使用农历月日时起课，这是最传统的小六壬起课方法。
 * 算法：
 * 1. 月宫：从大安起正月，顺数至所求月份
 * 2. 日宫：从月宫起初一，顺数至所求日期
 * 3. 时宫：从日宫起子时，顺数至所求时辰
 *
 * @param lunarMonth - 农历月份（1-12）
 * @param lunarDay - 农历日期（1-30）
 * @param hour - 当前小时（0-23，用于计算时辰）
 * @param questionCid - 占卜问题的 IPFS CID（可选，隐私保护）
 * @param isPublic - 是否公开此课盘
 * @returns 课盘 ID
 */
export async function divineByTime(
  lunarMonth: number,
  lunarDay: number,
  hour: number,
  questionCid?: string,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.divineByTime) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  // 构建问题 CID 参数
  const questionCidParam = questionCid
    ? { Some: Array.from(new TextEncoder().encode(questionCid)) }
    : null;

  const tx = api.tx.xiaoliuren.divineByTime(
    lunarMonth,
    lunarDay,
    hour,
    questionCidParam,
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[xiaoliuren.divineByTime] 交易状态:', status.type);

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
        console.log('[xiaoliuren.divineByTime] 交易已打包，事件数量:', events.length);
        const event = events.find((e) =>
          e.event.section === 'xiaoliuren' && e.event.method === 'PanCreated'
        );
        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[xiaoliuren.divineByTime] 起课成功，课盘ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          console.error('[xiaoliuren.divineByTime] 未找到 PanCreated 事件');
          reject(new Error('交易成功但未找到课盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[xiaoliuren.divineByTime] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 数字起课（活数起课法）
 *
 * 使用三个数字进行起课，适合即兴占卜。
 * 算法：
 * - 月宫 = (x - 1) % 6
 * - 日宫 = (x + y - 2) % 6
 * - 时宫 = (x + y + z - 3) % 6
 *
 * @param x - 第一个数字（≥1）
 * @param y - 第二个数字（≥1）
 * @param z - 第三个数字（≥1）
 * @param questionCid - 问题 CID（可选）
 * @param isPublic - 是否公开
 * @returns 课盘 ID
 */
export async function divineByNumber(
  x: number,
  y: number,
  z: number,
  questionCid?: string,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.divineByNumber) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  // 构建问题 CID 参数
  const questionCidParam = questionCid
    ? { Some: Array.from(new TextEncoder().encode(questionCid)) }
    : null;

  const tx = api.tx.xiaoliuren.divineByNumber(
    x,
    y,
    z,
    questionCidParam,
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[xiaoliuren.divineByNumber] 交易状态:', status.type);

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
          e.event.section === 'xiaoliuren' && e.event.method === 'PanCreated'
        );
        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[xiaoliuren.divineByNumber] 起课成功，课盘ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到课盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[xiaoliuren.divineByNumber] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 随机起课
 *
 * 使用链上随机数生成课盘，适合无特定数字时使用。
 *
 * @param questionCid - 问题 CID（可选）
 * @param isPublic - 是否公开
 * @returns 课盘 ID
 */
export async function divineRandom(
  questionCid?: string,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.divineRandom) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  // 构建问题 CID 参数
  const questionCidParam = questionCid
    ? { Some: Array.from(new TextEncoder().encode(questionCid)) }
    : null;

  const tx = api.tx.xiaoliuren.divineRandom(questionCidParam, isPublic);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[xiaoliuren.divineRandom] 交易状态:', status.type);

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
          e.event.section === 'xiaoliuren' && e.event.method === 'PanCreated'
        );
        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[xiaoliuren.divineRandom] 起课成功，课盘ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到课盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[xiaoliuren.divineRandom] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 手动指定起课
 *
 * 直接指定三宫结果，用于已知课盘的记录。
 *
 * @param yueIndex - 月宫索引（0-5，对应大安到空亡）
 * @param riIndex - 日宫索引（0-5）
 * @param shiIndex - 时宫索引（0-5）
 * @param questionCid - 问题 CID（可选）
 * @param isPublic - 是否公开
 * @returns 课盘 ID
 */
export async function divineManual(
  yueIndex: number,
  riIndex: number,
  shiIndex: number,
  questionCid?: string,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.divineManual) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  // 构建问题 CID 参数
  const questionCidParam = questionCid
    ? { Some: Array.from(new TextEncoder().encode(questionCid)) }
    : null;

  const tx = api.tx.xiaoliuren.divineManual(
    yueIndex,
    riIndex,
    shiIndex,
    questionCidParam,
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[xiaoliuren.divineManual] 交易状态:', status.type);

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
          e.event.section === 'xiaoliuren' && e.event.method === 'PanCreated'
        );
        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[xiaoliuren.divineManual] 起课成功，课盘ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到课盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[xiaoliuren.divineManual] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 时刻分起课（道家流派）
 *
 * 使用时辰、刻、分进行起课，这是道家小六壬的特色起课方法。
 * 算法：
 * 1. 时辰值：根据小时计算时辰（1-12）
 * 2. 刻值：每个时辰分为8刻，计算当前刻数（1-8）
 * 3. 分值：取分钟数除以15的余数（1-15）
 *
 * @param hour - 当前小时（0-23）
 * @param minute - 当前分钟（0-59）
 * @param questionCid - 问题 CID（可选）
 * @param isPublic - 是否公开
 * @returns 课盘 ID
 */
export async function divineByHourKe(
  hour: number,
  minute: number,
  questionCid?: string,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.divineByHourKe) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  // 构建问题 CID 参数
  const questionCidParam = questionCid
    ? { Some: Array.from(new TextEncoder().encode(questionCid)) }
    : null;

  const tx = api.tx.xiaoliuren.divineByHourKe(
    hour,
    minute,
    questionCidParam,
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[xiaoliuren.divineByHourKe] 交易状态:', status.type);

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
          e.event.section === 'xiaoliuren' && e.event.method === 'PanCreated'
        );
        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[xiaoliuren.divineByHourKe] 起课成功，课盘ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到课盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[xiaoliuren.divineByHourKe] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 多位数字起课（活数起课法扩展）
 *
 * 输入一个多位数字，将各位数字相加求和后进行起课。
 * 适用于看到手机号、车牌号等数字时起课。
 *
 * @param digits - 多位数字（如 1436 表示看到时间 14:36）
 * @param questionCid - 问题 CID（可选）
 * @param isPublic - 是否公开
 * @returns 课盘 ID
 */
export async function divineByDigits(
  digits: number,
  questionCid?: string,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.divineByDigits) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  // 构建问题 CID 参数
  const questionCidParam = questionCid
    ? { Some: Array.from(new TextEncoder().encode(questionCid)) }
    : null;

  const tx = api.tx.xiaoliuren.divineByDigits(
    digits,
    questionCidParam,
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[xiaoliuren.divineByDigits] 交易状态:', status.type);

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
          e.event.section === 'xiaoliuren' && e.event.method === 'PanCreated'
        );
        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[xiaoliuren.divineByDigits] 起课成功，课盘ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到课盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[xiaoliuren.divineByDigits] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 三数字起课（活数起课法标准版）
 *
 * 使用三个任意大小的数字进行起课，数字可以是任意正整数。
 * 采用递推法计算：
 * - 月宫 = num1 对应的六神
 * - 日宫 = 从月宫起，前进 num2 步
 * - 时宫 = 从日宫起，前进 num3 步
 *
 * @param num1 - 第一个数字（≥1）
 * @param num2 - 第二个数字（≥1）
 * @param num3 - 第三个数字（≥1）
 * @param questionCid - 问题 CID（可选）
 * @param isPublic - 是否公开
 * @returns 课盘 ID
 */
export async function divineByThreeNumbers(
  num1: number,
  num2: number,
  num3: number,
  questionCid?: string,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.divineByThreeNumbers) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  // 构建问题 CID 参数
  const questionCidParam = questionCid
    ? { Some: Array.from(new TextEncoder().encode(questionCid)) }
    : null;

  const tx = api.tx.xiaoliuren.divineByThreeNumbers(
    num1,
    num2,
    num3,
    questionCidParam,
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[xiaoliuren.divineByThreeNumbers] 交易状态:', status.type);

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
          e.event.section === 'xiaoliuren' && e.event.method === 'PanCreated'
        );
        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[xiaoliuren.divineByThreeNumbers] 起课成功，课盘ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到课盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[xiaoliuren.divineByThreeNumbers] 交易失败:', error);
      reject(error);
    });
  });
}

// ==================== 课盘查询服务 ====================

/**
 * 获取课盘详情
 *
 * @param panId - 课盘 ID
 * @returns 课盘数据或 null
 */
export async function getPan(panId: number): Promise<XiaoLiuRenPan | null> {
  const api = await getApi();

  // 检查 xiaoliuren pallet 是否存在
  if (!api.query.xiaoliuren || !api.query.xiaoliuren.pans) {
    console.error('[getPan] xiaoliuren pallet 不存在');
    return null;
  }

  console.log('[getPan] 查询课盘 ID:', panId);
  const result = await api.query.xiaoliuren.pans(panId);

  if (result.isNone) {
    console.log('[getPan] 课盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[getPan] 原始数据:', JSON.stringify(data.toHuman()));

    // 解析三宫数据
    const sanGongData = data.sanGong;
    const sanGong: SanGong = {
      yueGong: sanGongData.yueGong.toNumber() as LiuGong,
      riGong: sanGongData.riGong.toNumber() as LiuGong,
      shiGong: sanGongData.shiGong.toNumber() as LiuGong,
    };

    // 解析问题 CID
    let questionCid: string | undefined;
    if (data.questionCid && data.questionCid.isSome) {
      const cidBytes = data.questionCid.unwrap();
      questionCid = new TextDecoder().decode(new Uint8Array(cidBytes));
    }

    // 解析 AI 解读 CID
    let aiInterpretationCid: string | undefined;
    if (data.aiInterpretationCid && data.aiInterpretationCid.isSome) {
      const cidBytes = data.aiInterpretationCid.unwrap();
      aiInterpretationCid = new TextDecoder().decode(new Uint8Array(cidBytes));
    }

    const pan: XiaoLiuRenPan = {
      id: panId,
      creator: data.creator.toString(),
      method: data.method.toNumber() as DivinationMethod,
      param1: data.param1.toNumber(),
      param2: data.param2.toNumber(),
      param3: data.param3.toNumber(),
      sanGong,
      createdAt: data.createdAt.toNumber(),
      isPublic: data.isPublic.isTrue,
      questionCid,
      aiInterpretationCid,
      lunarMonth: data.lunarMonth.isSome ? data.lunarMonth.unwrap().toNumber() : undefined,
      lunarDay: data.lunarDay.isSome ? data.lunarDay.unwrap().toNumber() : undefined,
      shiChen: data.shiChen.isSome ? data.shiChen.unwrap().toNumber() : undefined,
    };

    console.log('[getPan] 解析成功:', pan);
    return pan;
  } catch (error) {
    console.error('[getPan] 解析失败:', error);
    return null;
  }
}

/**
 * 获取用户的课盘列表
 *
 * @param address - 用户地址
 * @returns 课盘 ID 列表
 */
export async function getUserPans(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.xiaoliuren || !api.query.xiaoliuren.userPans) {
    console.error('[getUserPans] xiaoliuren pallet 不存在');
    return [];
  }

  const result = await api.query.xiaoliuren.userPans(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取公开课盘列表
 *
 * @returns 公开课盘 ID 列表
 */
export async function getPublicPans(): Promise<number[]> {
  const api = await getApi();

  if (!api.query.xiaoliuren || !api.query.xiaoliuren.publicPans) {
    console.error('[getPublicPans] xiaoliuren pallet 不存在');
    return [];
  }

  const result = await api.query.xiaoliuren.publicPans();
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取用户统计数据
 *
 * @param address - 用户地址
 * @returns 用户统计
 */
export async function getUserStats(address: string): Promise<{
  totalPans: number;
  aiInterpretations: number;
  firstPanBlock: number;
} | null> {
  const api = await getApi();

  if (!api.query.xiaoliuren || !api.query.xiaoliuren.userStats) {
    return null;
  }

  const result = await api.query.xiaoliuren.userStats(address);
  if (!result) return null;

  return {
    totalPans: result.totalPans.toNumber(),
    aiInterpretations: result.aiInterpretations.toNumber(),
    firstPanBlock: result.firstPanBlock.toNumber(),
  };
}

// ==================== 课盘管理服务 ====================

/**
 * 设置课盘公开状态
 *
 * @param panId - 课盘 ID
 * @param isPublic - 是否公开
 */
export async function setPanVisibility(panId: number, isPublic: boolean): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.setPanVisibility) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  const tx = api.tx.xiaoliuren.setPanVisibility(panId, isPublic);

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
        console.log('[setPanVisibility] 设置成功');
        resolve();
      }
    }).catch((error) => {
      console.error('[setPanVisibility] 设置失败:', error);
      reject(error);
    });
  });
}

// ==================== AI 解读服务（已废弃，使用 pallet-divination-ai） ====================

/**
 * 请求 AI 解读
 *
 * @deprecated 请使用 pallet_divination_ai::request_interpretation
 * @param panId - 课盘 ID
 */
export async function requestAiInterpretation(panId: number): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.xiaoliuren || !api.tx.xiaoliuren.requestAiInterpretation) {
    throw new Error('区块链节点未包含小六壬模块（pallet-xiaoliuren），请检查节点配置');
  }

  const tx = api.tx.xiaoliuren.requestAiInterpretation(panId);

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
 * 批量获取课盘详情
 *
 * @param panIds - 课盘 ID 列表
 * @returns 课盘数据列表
 */
export async function getPansBatch(panIds: number[]): Promise<XiaoLiuRenPan[]> {
  const results = await Promise.all(panIds.map((id) => getPan(id)));
  return results.filter((pan): pan is XiaoLiuRenPan => pan !== null);
}

/**
 * 获取用户的所有课盘详情
 *
 * @param address - 用户地址
 * @returns 课盘数据列表
 */
export async function getUserPansWithDetails(address: string): Promise<XiaoLiuRenPan[]> {
  const panIds = await getUserPans(address);
  return getPansBatch(panIds);
}

/**
 * 获取公开课盘详情（分页）
 *
 * @param page - 页码（从 0 开始）
 * @param pageSize - 每页数量
 * @returns 课盘数据列表和总数
 */
export async function getPublicPansWithDetails(
  page: number = 0,
  pageSize: number = 10
): Promise<{ pans: XiaoLiuRenPan[]; total: number }> {
  const allIds = await getPublicPans();
  const total = allIds.length;
  const start = page * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageIds = allIds.slice(start, end);
  const pans = await getPansBatch(pageIds);
  return { pans, total };
}
