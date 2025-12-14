/**
 * 梅花易数服务
 *
 * 提供与 pallet-meihua、pallet-meihua-ai、pallet-meihua-market 的交互
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type {
  Hexagram,
  DivinationMethod,
  InterpretationType,
  InterpretationRequest,
  InterpretationResult,
  ServiceProvider,
  ServicePackage,
  MarketOrder,
  ServiceType,
  HexagramNft,
  NftCollection,
  NftOffer,
  NftTradeHistory,
  NftRarity,
  HexagramDetail,
  FullDivinationDetail,
} from '../types/meihua';
import { parseBoundedVecToString } from '../types/meihua';

// ==================== 起卦服务 ====================

/**
 * 时间起卦
 *
 * 使用当前区块时间戳转换为农历，按照梅花易数传统公式计算卦象。
 *
 * @param questionHash - 可选的问题哈希（32字节），用于隐私保护记录占卜问题
 * @param isPublic - 是否公开此卦象，默认为 false
 * @param gender - 性别（0: 未指定, 1: 男, 2: 女），默认为 0
 * @param category - 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他），默认为 0
 */
export async function divineByTime(
  questionHash?: Uint8Array,
  isPublic: boolean = false,
  gender: number = 0,
  category: number = 0
): Promise<number> {
  const api = await getSignedApi();

  // 检查 meihua pallet 是否存在
  if (!api.tx.meihua || !api.tx.meihua.divineByTime) {
    throw new Error('区块链节点未包含梅花易数模块（pallet-meihua），请检查节点配置');
  }

  // 如果未提供问题哈希，使用全零数组
  const hash = questionHash || new Uint8Array(32).fill(0);
  const tx = api.tx.meihua.divineByTime(Array.from(hash), isPublic, gender, category);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[divineByTime] 交易状态:', status.type);

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
        console.log('[divineByTime] 交易已打包，事件数量:', events.length);
        const event = events.find((e) =>
          e.event.section === 'meihua' && e.event.method === 'HexagramCreated'
        );
        if (event) {
          const hexagramId = event.event.data[0].toNumber();
          console.log('[divineByTime] 起卦成功，卦象ID:', hexagramId);
          resolve(hexagramId);
        } else if (status.isFinalized) {
          // 如果最终确认后仍未找到事件，则报错
          console.error('[divineByTime] 未找到 HexagramCreated 事件');
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[divineByTime] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 数字起卦
 *
 * 使用两个数字进行起卦，配合当前时辰计算动爻。
 * 注意：pallet 使用 num1 计算上卦，num2 计算下卦，动爻由当前时辰自动计算。
 *
 * @param num1 - 第一个数字（用于上卦）
 * @param num2 - 第二个数字（用于下卦）
 * @param questionHash - 可选的问题哈希（32字节）
 * @param isPublic - 是否公开此卦象，默认为 false
 * @param gender - 性别（0: 未指定, 1: 男, 2: 女），默认为 0
 * @param category - 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他），默认为 0
 */
export async function divineByNumbers(
  num1: number,
  num2: number,
  questionHash?: Uint8Array,
  isPublic: boolean = false,
  gender: number = 0,
  category: number = 0
): Promise<number> {
  const api = await getSignedApi();

  // 检查 meihua pallet 是否存在
  if (!api.tx.meihua || !api.tx.meihua.divineByNumbers) {
    throw new Error('区块链节点未包含梅花易数模块（pallet-meihua），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);
  const tx = api.tx.meihua.divineByNumbers(num1, num2, Array.from(hash), isPublic, gender, category);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[divineByNumbers] 交易状态:', status.type);

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
          e.event.section === 'meihua' && e.event.method === 'HexagramCreated'
        );
        if (event) {
          const hexagramId = event.event.data[0].toNumber();
          console.log('[divineByNumbers] 起卦成功，卦象ID:', hexagramId);
          resolve(hexagramId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[divineByNumbers] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 文字起卦
 *
 * 将输入文字哈希后作为 question_hash，使用随机起卦方式生成卦象。
 * 注意：pallet 没有专门的 divineByText 方法，这里通过将文字哈希后调用随机起卦实现。
 *
 * @param text - 占卜问题文本
 * @param isPublic - 是否公开此卦象，默认为 false
 * @param gender - 性别（0: 未指定, 1: 男, 2: 女），默认为 0
 * @param category - 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他），默认为 0
 */
export async function divineByText(
  text: string,
  isPublic: boolean = false,
  gender: number = 0,
  category: number = 0
): Promise<number> {
  const api = await getSignedApi();

  // 检查 meihua pallet 是否存在
  if (!api.tx.meihua || !api.tx.meihua.divineRandom) {
    throw new Error('区块链节点未包含梅花易数模块（pallet-meihua），请检查节点配置');
  }

  // 使用 SubtleCrypto 计算文本的 SHA-256 哈希作为 question_hash
  const textBytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', textBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // 调用随机起卦，将问题文本的哈希作为 question_hash
  const tx = api.tx.meihua.divineRandom(hashArray, isPublic, gender, category);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[divineByText] 交易状态:', status.type);

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
          e.event.section === 'meihua' && e.event.method === 'HexagramCreated'
        );
        if (event) {
          const hexagramId = event.event.data[0].toNumber();
          console.log('[divineByText] 起卦成功，卦象ID:', hexagramId);
          resolve(hexagramId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[divineByText] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 随机起卦
 *
 * 使用链上随机数生成卦象，适合无特定数字时使用。
 *
 * @param questionHash - 可选的问题哈希（32字节）
 * @param isPublic - 是否公开此卦象，默认为 false
 * @param gender - 性别（0: 未指定, 1: 男, 2: 女），默认为 0
 * @param category - 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他），默认为 0
 */
export async function divineRandom(
  questionHash?: Uint8Array,
  isPublic: boolean = false,
  gender: number = 0,
  category: number = 0
): Promise<number> {
  const api = await getSignedApi();

  // 检查 meihua pallet 是否存在
  if (!api.tx.meihua || !api.tx.meihua.divineRandom) {
    throw new Error('区块链节点未包含梅花易数模块（pallet-meihua），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);
  const tx = api.tx.meihua.divineRandom(Array.from(hash), isPublic, gender, category);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[divineRandom] 交易状态:', status.type);

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
          e.event.section === 'meihua' && e.event.method === 'HexagramCreated'
        );
        if (event) {
          const hexagramId = event.event.data[0].toNumber();
          console.log('[divineRandom] 起卦成功，卦象ID:', hexagramId);
          resolve(hexagramId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[divineRandom] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 将 pallet 的 Bagua 枚举值(1-8)转换为前端 Trigram 枚举值(0-7)
 *
 * Pallet Bagua: Qian=1, Dui=2, Li=3, Zhen=4, Xun=5, Kan=6, Gen=7, Kun=8
 * Frontend Trigram: Qian=0, Dui=1, Li=2, Zhen=3, Xun=4, Kan=5, Gen=6, Kun=7
 */
function baguaToTrigram(baguaValue: number): number {
  // Pallet 值从 1 开始，前端从 0 开始
  return baguaValue - 1;
}

/**
 * 八卦对应的五行（用于计算体用五行）
 *
 * 乾(0)、兑(1) -> 金(3)
 * 离(2) -> 火(1)
 * 震(3)、巽(4) -> 木(0)
 * 坎(5) -> 水(4)
 * 艮(6)、坤(7) -> 土(2)
 */
function getTrigramWuxing(trigram: number): number {
  const wuxingMap: Record<number, number> = {
    0: 3, // 乾 -> 金
    1: 3, // 兑 -> 金
    2: 1, // 离 -> 火
    3: 0, // 震 -> 木
    4: 0, // 巽 -> 木
    5: 4, // 坎 -> 水
    6: 2, // 艮 -> 土
    7: 2, // 坤 -> 土
  };
  return wuxingMap[trigram] ?? 2;
}

/**
 * 获取卦象详情
 *
 * Pallet 存储的是 FullDivination 结构，包含：
 * - ben_gua: 本卦（含 shang_gua, xia_gua, dong_yao, ti_is_shang 等）
 * - bian_gua: 变卦 (shang_gua, xia_gua)
 * - hu_gua: 互卦
 * - ben_gua_relation: 本卦体用关系
 * - bian_gua_relation: 变卦体用关系
 * - fortune: 吉凶
 */
export async function getHexagram(hexagramId: number): Promise<Hexagram | null> {
  const api = await getApi();

  // 检查 meihua pallet 是否存在
  if (!api.query.meihua || !api.query.meihua.hexagrams) {
    console.error('[getHexagram] meihua pallet 不存在');
    return null;
  }

  console.log('[getHexagram] 查询卦象 ID:', hexagramId);
  const result = await api.query.meihua.hexagrams(hexagramId);

  if (result.isNone) {
    console.log('[getHexagram] 卦象不存在');
    return null;
  }

  try {
    const fullDivination = result.unwrap();
    console.log('[getHexagram] 原始数据:', JSON.stringify(fullDivination.toHuman()));

    // 解析 FullDivination 结构
    const benGua = fullDivination.benGua;
    const bianGua = fullDivination.bianGua;

    // 从 ben_gua 提取基本信息
    const shangGuaBagua = benGua.shangGua.bagua.toNumber();
    const xiaGuaBagua = benGua.xiaGua.bagua.toNumber();
    const dongYao = benGua.dongYao.toNumber();
    const tiIsShang = benGua.tiIsShang.isTrue;

    // 转换为前端 Trigram 值
    const upperTrigram = baguaToTrigram(shangGuaBagua);
    const lowerTrigram = baguaToTrigram(xiaGuaBagua);

    // 解析变卦
    const bianShangBagua = bianGua[0].bagua.toNumber();
    const bianXiaBagua = bianGua[1].bagua.toNumber();
    const changedUpperTrigram = baguaToTrigram(bianShangBagua);
    const changedLowerTrigram = baguaToTrigram(bianXiaBagua);

    // 确定体卦和用卦
    const bodyTrigram = tiIsShang ? upperTrigram : lowerTrigram;
    const functionTrigram = tiIsShang ? lowerTrigram : upperTrigram;

    // 计算体用五行
    const bodyWuxing = getTrigramWuxing(bodyTrigram);
    const functionWuxing = getTrigramWuxing(functionTrigram);

    // 解析时间戳并转换为农历（简化处理，使用 timestamp）
    const timestamp = benGua.timestamp.toNumber();
    const divinationDate = new Date(timestamp * 1000);

    // 简化的农历计算（实际应用中应使用完整的农历转换库）
    // 这里暂时使用公历值作为占位
    const lunarYear = divinationDate.getFullYear();
    const lunarMonth = divinationDate.getMonth() + 1;
    const lunarDay = divinationDate.getDate();
    const lunarHour = Math.floor(divinationDate.getHours() / 2) % 12;

    // 解析 question_hash
    let questionHash: string | undefined;
    const qHash = benGua.questionHash;
    if (qHash && Array.isArray(qHash)) {
      const hashArray = qHash.map((b: { toNumber?: () => number }) =>
        typeof b === 'number' ? b : b.toNumber?.() ?? 0
      );
      if (hashArray.some((b: number) => b !== 0)) {
        questionHash = '0x' + hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('');
      }
    }

    const hexagram: Hexagram = {
      id: hexagramId,
      creator: benGua.diviner.toString(),
      method: benGua.method.toNumber?.() ?? benGua.method.type ?? 0,
      upperTrigram,
      lowerTrigram,
      changedUpperTrigram,
      changedLowerTrigram,
      changingLine: dongYao,
      bodyTrigram,
      functionTrigram,
      bodyWuxing,
      functionWuxing,
      divinationTime: timestamp * 1000, // 转换为毫秒
      lunarYear,
      lunarMonth,
      lunarDay,
      lunarHour,
      questionHash,
      status: 0, // Pallet 中没有 status 字段，默认为 Active
      createdAt: benGua.blockNumber.toNumber(),
    };

    console.log('[getHexagram] 解析成功:', hexagram);
    return hexagram;
  } catch (error) {
    console.error('[getHexagram] 解析失败:', error);
    return null;
  }
}

/**
 * 获取用户的卦象列表
 */
export async function getUserHexagrams(address: string): Promise<number[]> {
  const api = await getApi();
  const result = await api.query.meihua.userHexagrams(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 归档卦象
 */
export async function archiveHexagram(hexagramId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihua.archiveHexagram(hexagramId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== AI 解卦服务 ====================

/**
 * 请求 AI 解卦
 */
export async function requestAiInterpretation(
  hexagramId: number,
  interpretationType: InterpretationType,
  contextHash?: string
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaAi.requestInterpretation(
    hexagramId,
    interpretationType,
    contextHash ? { Some: contextHash } : { None: null }
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'meihuaAi' && e.event.method === 'InterpretationRequested'
        );
        if (event) {
          const requestId = event.event.data[0].toNumber();
          resolve(requestId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取 AI 解读请求
 */
export async function getInterpretationRequest(
  requestId: number
): Promise<InterpretationRequest | null> {
  const api = await getApi();
  const result = await api.query.meihuaAi.requests(requestId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: requestId,
    hexagramId: data.hexagramId.toNumber(),
    requester: data.requester.toString(),
    interpretationType: data.interpretationType.toNumber(),
    status: data.status.toNumber(),
    feePaid: data.feePaid.toBigInt(),
    createdAt: data.createdAt.toNumber(),
    oracleNode: data.oracleNode.isSome ? data.oracleNode.unwrap().toString() : undefined,
    completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : undefined,
  };
}

/**
 * 获取 AI 解读结果
 */
export async function getInterpretationResult(
  requestId: number
): Promise<InterpretationResult | null> {
  const api = await getApi();
  const result = await api.query.meihuaAi.results(requestId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    requestId,
    contentCid: new TextDecoder().decode(new Uint8Array(data.contentCid.toU8a())),
    summaryCid: data.summaryCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.summaryCid.unwrap().toU8a()))
      : undefined,
    oracle: data.oracle.toString(),
    submittedAt: data.submittedAt.toNumber(),
    qualityScore: data.qualityScore.isSome ? data.qualityScore.unwrap().toNumber() : undefined,
    userRating: data.userRating.isSome ? data.userRating.unwrap().toNumber() : undefined,
    modelVersion: new TextDecoder().decode(new Uint8Array(data.modelVersion.toU8a())),
    language: new TextDecoder().decode(new Uint8Array(data.language.toU8a())),
  };
}

/**
 * 评价 AI 解读
 */
export async function rateInterpretation(requestId: number, rating: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaAi.rateResult(requestId, rating);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== 服务市场 ====================

/**
 * 获取服务提供者列表
 */
export async function getServiceProviders(): Promise<ServiceProvider[]> {
  const api = await getApi();
  const entries = await api.query.meihuaMarket.providers.entries();

  return entries.map(([, value]) => {
    const data = value.unwrap();
    return {
      account: data.account.toString(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      bio: new TextDecoder().decode(new Uint8Array(data.bio.toU8a())),
      avatarCid: data.avatarCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.avatarCid.unwrap().toU8a()))
        : undefined,
      tier: data.tier.toNumber(),
      isActive: data.status.toNumber() === 1,
      deposit: data.deposit.toBigInt(),
      totalOrders: data.totalOrders.toNumber(),
      completedOrders: data.completedOrders.toNumber(),
      totalRatings: data.totalRatings.toNumber(),
      ratingSum: data.ratingSum.toNumber(),
      totalEarnings: data.totalEarnings.toBigInt(),
      specialties: data.specialties.toNumber(),
      acceptsUrgent: data.acceptsUrgent.isTrue,
      lastActiveAt: data.lastActiveAt.toNumber(),
    };
  });
}

/**
 * 获取服务提供者详情
 */
export async function getServiceProvider(address: string): Promise<ServiceProvider | null> {
  const api = await getApi();
  const result = await api.query.meihuaMarket.providers(address);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    account: data.account.toString(),
    name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
    bio: new TextDecoder().decode(new Uint8Array(data.bio.toU8a())),
    avatarCid: data.avatarCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.avatarCid.unwrap().toU8a()))
      : undefined,
    tier: data.tier.toNumber(),
    isActive: data.status.toNumber() === 1,
    deposit: data.deposit.toBigInt(),
    totalOrders: data.totalOrders.toNumber(),
    completedOrders: data.completedOrders.toNumber(),
    totalRatings: data.totalRatings.toNumber(),
    ratingSum: data.ratingSum.toNumber(),
    totalEarnings: data.totalEarnings.toBigInt(),
    specialties: data.specialties.toNumber(),
    acceptsUrgent: data.acceptsUrgent.isTrue,
    lastActiveAt: data.lastActiveAt.toNumber(),
  };
}

/**
 * 获取提供者的服务套餐
 */
export async function getProviderPackages(providerAddress: string): Promise<ServicePackage[]> {
  const api = await getApi();
  const entries = await api.query.meihuaMarket.packages.entries(providerAddress);

  return entries.map(([key, value]) => {
    const packageId = key.args[1].toNumber();
    const data = value.unwrap();
    return {
      id: packageId,
      serviceType: data.serviceType.toNumber(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      description: new TextDecoder().decode(new Uint8Array(data.description.toU8a())),
      price: data.price.toBigInt(),
      duration: data.duration.toNumber(),
      followUpCount: data.followUpCount.toNumber(),
      urgentAvailable: data.urgentAvailable.isTrue,
      urgentSurcharge: data.urgentSurcharge.toNumber(),
      isActive: data.isActive.isTrue,
      salesCount: data.salesCount.toNumber(),
    };
  });
}

/**
 * 创建市场订单
 */
export async function createMarketOrder(
  providerAddress: string,
  hexagramId: number,
  packageId: number,
  questionCid: string,
  isUrgent: boolean
): Promise<number> {
  const api = await getSignedApi();
  const questionBytes = new TextEncoder().encode(questionCid);
  const tx = api.tx.meihuaMarket.createOrder(
    providerAddress,
    hexagramId,
    packageId,
    Array.from(questionBytes),
    isUrgent
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'meihuaMarket' && e.event.method === 'OrderCreated'
        );
        if (event) {
          const orderId = event.event.data[0].toNumber();
          resolve(orderId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取订单详情
 */
export async function getMarketOrder(orderId: number): Promise<MarketOrder | null> {
  const api = await getApi();
  const result = await api.query.meihuaMarket.orders(orderId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: orderId,
    customer: data.customer.toString(),
    provider: data.provider.toString(),
    hexagramId: data.hexagramId.toNumber(),
    packageId: data.packageId.toNumber(),
    amount: data.amount.toBigInt(),
    platformFee: data.platformFee.toBigInt(),
    isUrgent: data.isUrgent.isTrue,
    status: data.status.toNumber(),
    questionCid: new TextDecoder().decode(new Uint8Array(data.questionCid.toU8a())),
    answerCid: data.answerCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.answerCid.unwrap().toU8a()))
      : undefined,
    createdAt: data.createdAt.toNumber(),
    paidAt: data.paidAt.isSome ? data.paidAt.unwrap().toNumber() : undefined,
    acceptedAt: data.acceptedAt.isSome ? data.acceptedAt.unwrap().toNumber() : undefined,
    completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : undefined,
    followUpsRemaining: data.followUpsRemaining.toNumber(),
    rating: data.rating.isSome ? data.rating.unwrap().toNumber() : undefined,
    reviewCid: data.reviewCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.reviewCid.unwrap().toU8a()))
      : undefined,
  };
}

/**
 * 获取用户的订单列表
 */
export async function getCustomerOrders(address: string): Promise<number[]> {
  const api = await getApi();
  const result = await api.query.meihuaMarket.customerOrders(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 提交评价
 */
export async function submitReview(
  orderId: number,
  overallRating: number,
  accuracyRating: number,
  attitudeRating: number,
  responseRating: number,
  contentCid?: string,
  isAnonymous: boolean = false
): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaMarket.submitReview(
    orderId,
    overallRating,
    accuracyRating,
    attitudeRating,
    responseRating,
    contentCid ? { Some: Array.from(new TextEncoder().encode(contentCid)) } : { None: null },
    isAnonymous
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 取消订单
 */
export async function cancelOrder(orderId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaMarket.cancelOrder(orderId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== 注册服务提供者 ====================

/**
 * 注册成为服务提供者
 */
export async function registerProvider(
  name: string,
  bio: string,
  specialties: number
): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaMarket.registerProvider(
    Array.from(new TextEncoder().encode(name)),
    Array.from(new TextEncoder().encode(bio)),
    specialties
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 创建服务套餐
 */
export async function createPackage(
  serviceType: ServiceType,
  name: string,
  description: string,
  price: bigint,
  duration: number,
  followUpCount: number,
  urgentAvailable: boolean,
  urgentSurcharge: number
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaMarket.createPackage(
    serviceType,
    Array.from(new TextEncoder().encode(name)),
    Array.from(new TextEncoder().encode(description)),
    price.toString(),
    duration,
    followUpCount,
    urgentAvailable,
    urgentSurcharge
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'meihuaMarket' && e.event.method === 'PackageCreated'
        );
        if (event) {
          const packageId = event.event.data[1].toNumber();
          resolve(packageId);
        }
      }
    }).catch(reject);
  });
}

// ==================== NFT 服务 ====================

/**
 * 铸造卦象 NFT
 * @param hexagramId 卦象 ID
 * @param name NFT 名称
 * @param metadataCid IPFS 元数据 CID
 * @param royaltyRate 版税比例（万分比，如 500 = 5%）
 */
export async function mintNft(
  hexagramId: number,
  name: string,
  metadataCid: string,
  royaltyRate: number
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.mint(
    hexagramId,
    Array.from(new TextEncoder().encode(name)),
    Array.from(new TextEncoder().encode(metadataCid)),
    royaltyRate
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'meihuaNft' && e.event.method === 'NftMinted'
        );
        if (event) {
          const nftId = event.event.data[0].toNumber();
          resolve(nftId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取 NFT 详情
 */
export async function getNft(nftId: number): Promise<HexagramNft | null> {
  const api = await getApi();
  const result = await api.query.meihuaNft.nfts(nftId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: nftId,
    hexagramId: data.hexagramId.toNumber(),
    owner: data.owner.toString(),
    creator: data.creator.toString(),
    name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
    metadataCid: new TextDecoder().decode(new Uint8Array(data.metadataCid.toU8a())),
    imageCid: data.imageCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.imageCid.unwrap().toU8a()))
      : undefined,
    rarity: data.rarity.toNumber() as NftRarity,
    royaltyRate: data.royaltyRate.toNumber(),
    mintedAt: data.mintedAt.toNumber(),
    isListed: data.isListed.isTrue,
    listPrice: data.listPrice.isSome ? data.listPrice.unwrap().toBigInt() : undefined,
    transferCount: data.transferCount.toNumber(),
  };
}

/**
 * 获取用户的 NFT 列表
 */
export async function getUserNfts(address: string): Promise<number[]> {
  const api = await getApi();
  const result = await api.query.meihuaNft.userNfts(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取已上架的 NFT 列表
 */
export async function getListedNfts(): Promise<HexagramNft[]> {
  const api = await getApi();
  const entries = await api.query.meihuaNft.nfts.entries();

  const listedNfts: HexagramNft[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();
    if (!data.isListed.isTrue) continue;

    const nftId = key.args[0].toNumber();
    listedNfts.push({
      id: nftId,
      hexagramId: data.hexagramId.toNumber(),
      owner: data.owner.toString(),
      creator: data.creator.toString(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      metadataCid: new TextDecoder().decode(new Uint8Array(data.metadataCid.toU8a())),
      imageCid: data.imageCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.imageCid.unwrap().toU8a()))
        : undefined,
      rarity: data.rarity.toNumber() as NftRarity,
      royaltyRate: data.royaltyRate.toNumber(),
      mintedAt: data.mintedAt.toNumber(),
      isListed: true,
      listPrice: data.listPrice.isSome ? data.listPrice.unwrap().toBigInt() : undefined,
      transferCount: data.transferCount.toNumber(),
    });
  }

  return listedNfts;
}

/**
 * 上架 NFT
 * @param nftId NFT ID
 * @param price 价格
 */
export async function listNft(nftId: number, price: bigint): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.list(nftId, price.toString());

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 下架 NFT
 */
export async function cancelNftListing(nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.cancelListing(nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 购买上架的 NFT
 */
export async function buyNft(nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.buy(nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 转移 NFT
 */
export async function transferNft(nftId: number, to: string): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.transfer(nftId, to);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 对 NFT 出价
 */
export async function makeNftOffer(nftId: number, amount: bigint): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.makeOffer(nftId, amount.toString());

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'meihuaNft' && e.event.method === 'OfferMade'
        );
        if (event) {
          const offerId = event.event.data[0].toNumber();
          resolve(offerId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 取消 NFT 出价
 */
export async function cancelNftOffer(offerId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.cancelOffer(offerId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 接受 NFT 出价
 */
export async function acceptNftOffer(offerId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.acceptOffer(offerId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 获取 NFT 的出价列表
 */
export async function getNftOffers(nftId: number): Promise<NftOffer[]> {
  const api = await getApi();
  const entries = await api.query.meihuaNft.offers.entries();

  const offers: NftOffer[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();
    if (data.nftId.toNumber() !== nftId) continue;

    const offerId = key.args[0].toNumber();
    offers.push({
      id: offerId,
      nftId: data.nftId.toNumber(),
      bidder: data.bidder.toString(),
      amount: data.amount.toBigInt(),
      expiresAt: data.expiresAt.toNumber(),
      createdAt: data.createdAt.toNumber(),
    });
  }

  return offers;
}

/**
 * 获取 NFT 交易历史
 */
export async function getNftTradeHistory(nftId: number): Promise<NftTradeHistory[]> {
  const api = await getApi();
  const result = await api.query.meihuaNft.tradeHistory(nftId);

  if (!result || result.length === 0) return [];

  return result.map((item: any) => ({
    nftId,
    seller: item.seller.toString(),
    buyer: item.buyer.toString(),
    price: item.price.toBigInt(),
    tradedAt: item.tradedAt.toNumber(),
  }));
}

/**
 * 创建 NFT 收藏集
 */
export async function createNftCollection(
  name: string,
  descriptionCid?: string,
  coverCid?: string
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.createCollection(
    Array.from(new TextEncoder().encode(name)),
    descriptionCid ? { Some: Array.from(new TextEncoder().encode(descriptionCid)) } : { None: null },
    coverCid ? { Some: Array.from(new TextEncoder().encode(coverCid)) } : { None: null }
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'meihuaNft' && e.event.method === 'CollectionCreated'
        );
        if (event) {
          const collectionId = event.event.data[0].toNumber();
          resolve(collectionId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取收藏集详情
 */
export async function getNftCollection(collectionId: number): Promise<NftCollection | null> {
  const api = await getApi();
  const result = await api.query.meihuaNft.collections(collectionId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: collectionId,
    owner: data.owner.toString(),
    name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
    descriptionCid: data.descriptionCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.descriptionCid.unwrap().toU8a()))
      : undefined,
    coverCid: data.coverCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.coverCid.unwrap().toU8a()))
      : undefined,
    nftCount: data.nftCount.toNumber(),
    createdAt: data.createdAt.toNumber(),
  };
}

/**
 * 获取用户的收藏集列表
 */
export async function getUserCollections(address: string): Promise<number[]> {
  const api = await getApi();
  const result = await api.query.meihuaNft.userCollections(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 添加 NFT 到收藏集
 */
export async function addNftToCollection(collectionId: number, nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.addToCollection(collectionId, nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 从收藏集移除 NFT
 */
export async function removeNftFromCollection(collectionId: number, nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.meihuaNft.removeFromCollection(collectionId, nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== 完整排盘详情 API ====================

/**
 * 解析 HexagramDetail 原始数据
 *
 * 将 Pallet 返回的 HexagramDetail 结构转换为前端可用的格式
 *
 * @param raw - Pallet 返回的原始数据
 * @returns 解析后的 HexagramDetail
 */
function parseHexagramDetail(raw: Record<string, unknown>): HexagramDetail {
  return {
    name: parseBoundedVecToString(raw.name),
    shangGuaName: parseBoundedVecToString(raw.shangGuaName || raw.shang_gua_name),
    xiaGuaName: parseBoundedVecToString(raw.xiaGuaName || raw.xia_gua_name),
    shangGuaSymbol: parseBoundedVecToString(raw.shangGuaSymbol || raw.shang_gua_symbol),
    xiaGuaSymbol: parseBoundedVecToString(raw.xiaGuaSymbol || raw.xia_gua_symbol),
    shangGuaWuxing: parseBoundedVecToString(raw.shangGuaWuxing || raw.shang_gua_wuxing),
    xiaGuaWuxing: parseBoundedVecToString(raw.xiaGuaWuxing || raw.xia_gua_wuxing),
    guaci: parseBoundedVecToString(raw.guaci),
    dongYaoName: parseBoundedVecToString(raw.dongYaoName || raw.dong_yao_name),
    dongYaoMing: parseBoundedVecToString(raw.dongYaoMing || raw.dong_yao_ming),
    dongYaoCi: parseBoundedVecToString(raw.dongYaoCi || raw.dong_yao_ci),
    tiyongName: parseBoundedVecToString(raw.tiyongName || raw.tiyong_name),
    fortuneName: parseBoundedVecToString(raw.fortuneName || raw.fortune_name),
  };
}

/**
 * 获取卦象完整详细信息
 *
 * 调用 Pallet 的 get_hexagram_detail runtime API 获取完整排盘信息
 * 包含：本卦、变卦、互卦、错卦、综卦、伏卦的详细信息及体用解读
 *
 * @param hexagramId - 卦象 ID
 * @returns 完整排盘详细信息，如果卦象不存在则返回 null
 */
export async function getHexagramDetail(hexagramId: number): Promise<FullDivinationDetail | null> {
  const api = await getApi();

  // 检查 meihua pallet 是否存在
  if (!api.call || !api.call.meihua || !api.call.meihua.getHexagramDetail) {
    console.warn('[getHexagramDetail] meihua runtime API 不存在，尝试使用替代方法');

    // 如果 runtime API 不可用，尝试通过 RPC 调用 state.call
    try {
      const result = await api.rpc.state.call(
        'MeihuaApi_get_hexagram_detail',
        api.createType('u64', hexagramId).toHex()
      );

      if (!result || result.isEmpty) {
        console.log('[getHexagramDetail] 卦象不存在');
        return null;
      }

      // 解码返回数据
      const decoded = api.createType('Option<FullDivinationDetail>', result);
      if (decoded.isNone) {
        return null;
      }

      const data = decoded.unwrap().toJSON() as Record<string, unknown>;
      return parseFullDivinationDetail(data);
    } catch (rpcError) {
      console.warn('[getHexagramDetail] RPC 调用失败:', rpcError);
      // 继续尝试手动计算
    }
  } else {
    // 使用 runtime API
    try {
      const result = await api.call.meihua.getHexagramDetail(hexagramId) as { isNone?: boolean; unwrap?: () => { toJSON: () => Record<string, unknown> } } | null;

      if (!result || (result as { isNone?: boolean }).isNone) {
        console.log('[getHexagramDetail] 卦象不存在');
        return null;
      }

      const data = (result as { unwrap: () => { toJSON: () => Record<string, unknown> } }).unwrap().toJSON() as Record<string, unknown>;
      return parseFullDivinationDetail(data);
    } catch (apiError) {
      console.warn('[getHexagramDetail] Runtime API 调用失败:', apiError);
    }
  }

  return null;
}

/**
 * 解析 FullDivinationDetail 原始数据
 *
 * @param data - Pallet 返回的原始数据
 * @returns 解析后的 FullDivinationDetail
 */
function parseFullDivinationDetail(data: Record<string, unknown>): FullDivinationDetail {
  return {
    benGua: parseHexagramDetail((data.benGua || data.ben_gua || {}) as Record<string, unknown>),
    bianGua: parseHexagramDetail((data.bianGua || data.bian_gua || {}) as Record<string, unknown>),
    huGua: parseHexagramDetail((data.huGua || data.hu_gua || {}) as Record<string, unknown>),
    cuoGua: parseHexagramDetail((data.cuoGua || data.cuo_gua || {}) as Record<string, unknown>),
    zongGua: parseHexagramDetail((data.zongGua || data.zong_gua || {}) as Record<string, unknown>),
    fuGua: parseHexagramDetail((data.fuGua || data.fu_gua || {}) as Record<string, unknown>),
    tiyongInterpretation: parseBoundedVecToString(data.tiyongInterpretation || data.tiyong_interpretation),
  };
}

/**
 * 计算卦象详细信息（不需要存储）
 *
 * 调用 Pallet 的 calculate_hexagram_detail API 根据卦数直接计算详情
 *
 * @param shangGuaNum - 上卦数（1-8）
 * @param xiaGuaNum - 下卦数（1-8）
 * @param dongYao - 动爻（1-6）
 * @returns 完整排盘详细信息
 */
export async function calculateHexagramDetail(
  shangGuaNum: number,
  xiaGuaNum: number,
  dongYao: number
): Promise<FullDivinationDetail | null> {
  const api = await getApi();

  // 检查 meihua pallet 是否存在
  if (!api.call || !api.call.meihua || !api.call.meihua.calculateHexagramDetail) {
    console.warn('[calculateHexagramDetail] meihua runtime API 不存在，尝试使用 RPC');

    try {
      // 构建参数
      const params = api.createType('(u8, u8, u8)', [shangGuaNum, xiaGuaNum, dongYao]);

      const result = await api.rpc.state.call(
        'MeihuaApi_calculate_hexagram_detail',
        params.toHex()
      );

      if (!result || result.isEmpty) {
        console.log('[calculateHexagramDetail] 计算失败');
        return null;
      }

      const decoded = api.createType('FullDivinationDetail', result);
      const data = decoded.toJSON() as Record<string, unknown>;
      return parseFullDivinationDetail(data);
    } catch (rpcError) {
      console.warn('[calculateHexagramDetail] RPC 调用失败:', rpcError);
      return null;
    }
  }

  try {
    const result = await api.call.meihua.calculateHexagramDetail(
      shangGuaNum,
      xiaGuaNum,
      dongYao
    );

    const data = result.toJSON() as Record<string, unknown>;
    return parseFullDivinationDetail(data);
  } catch (apiError) {
    console.warn('[calculateHexagramDetail] Runtime API 调用失败:', apiError);
    return null;
  }
}

// ==================== 解卦数据查询 API ====================

/**
 * 获取卦象的解卦数据
 *
 * 查询链上存储的解卦核心数据，包括：
 * - 基础信息（时间、农历、起卦方式、性别、类别）
 * - 卦象核心数据（上卦、下卦、动爻、体用）
 * - 体用分析（五行、关系、旺衰、吉凶）
 * - 应期推算（应期数、喜神、忌神）
 * - 辅助卦象（变卦、互卦、错卦、综卦、伏卦）
 *
 * @param hexagramId - 卦象 ID
 * @returns 解卦数据，如果不存在则返回 null
 */
export async function getInterpretationData(hexagramId: number): Promise<any | null> {
  const api = await getApi();

  // 检查 meihua pallet 是否存在
  if (!api.query.meihua || !api.query.meihua.interpretations) {
    console.error('[getInterpretationData] meihua pallet 不存在或未包含 interpretations 存储');
    return null;
  }

  console.log('[getInterpretationData] 查询解卦数据 ID:', hexagramId);
  const result = await api.query.meihua.interpretations(hexagramId);

  if (result.isNone) {
    console.log('[getInterpretationData] 解卦数据不存在');
    return null;
  }

  try {
    const interpretationData = result.unwrap();
    console.log('[getInterpretationData] 原始数据:', JSON.stringify(interpretationData.toHuman()));

    // 转换为 JSON 格式
    const data = interpretationData.toJSON() as Record<string, unknown>;

    return data;
  } catch (error) {
    console.error('[getInterpretationData] 解析失败:', error);
    return null;
  }
}

/**
 * 获取 AI 解读结果
 *
 * 查询链上存储的 AI 解读摘要，包括：
 * - 卦象 ID
 * - 解读内容的 IPFS CID
 * - 解读摘要（链上存储）
 * - 吉凶评分
 * - 可信度评分
 * - 提交时间戳
 * - AI 模型版本
 *
 * @param hexagramId - 卦象 ID
 * @returns AI 解读结果，如果不存在则返回 null
 */
export async function getAiInterpretationResult(hexagramId: number): Promise<any | null> {
  const api = await getApi();

  // 检查 meihua pallet 是否存在
  if (!api.query.meihua || !api.query.meihua.aiInterpretations) {
    console.error('[getAiInterpretationResult] meihua pallet 不存在或未包含 aiInterpretations 存储');
    return null;
  }

  console.log('[getAiInterpretationResult] 查询 AI 解读 ID:', hexagramId);
  const result = await api.query.meihua.aiInterpretations(hexagramId);

  if (result.isNone) {
    console.log('[getAiInterpretationResult] AI 解读不存在');
    return null;
  }

  try {
    const aiInterpretation = result.unwrap();
    console.log('[getAiInterpretationResult] 原始数据:', JSON.stringify(aiInterpretation.toHuman()));

    // 解析数据
    const data = aiInterpretation.toJSON() as Record<string, unknown>;

    return {
      hexagramId: data.hexagramId || hexagramId,
      interpretationCid: parseBoundedVecToString(data.interpretationCid),
      summary: parseBoundedVecToString(data.summary),
      fortuneScore: data.fortuneScore || 50,
      confidenceScore: data.confidenceScore || 50,
      submitTimestamp: data.submitTimestamp || 0,
      modelVersion: parseBoundedVecToString(data.modelVersion),
    };
  } catch (error) {
    console.error('[getAiInterpretationResult] 解析失败:', error);
    return null;
  }
}
