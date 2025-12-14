/**
 * 大六壬链上服务
 *
 * 提供与 pallet-daliuren 的交互功能：
 * - 时间起课、随机起课、手动起课
 * - 查询式盘数据
 * - 获取解盘结果（核心/完整）
 * - AI解读请求和结果
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type {
  DaLiuRenPan,
  CoreInterpretation,
  FullInterpretation,
  SanChuanAnalysis,
  YingQiAnalysis,
  UserStats,
  GanZhi,
  DivinationMethod,
  KeShiType,
  GeJuType,
  FortuneLevel,
  TrendType,
  OutcomeType,
  WangShuai,
  LiuQin,
  DiZhi,
  TianGan,
  TianJiang,
  YingQiUnit,
  ShiXiangType,
} from '../types/daliuren';
import {
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  parseBoundedVecToString,
} from '../types/daliuren';

// ==================== 类型定义 ====================

/**
 * 时间起课参数
 */
export interface DivineByTimeParams {
  /** 年干支 (天干索引, 地支索引) */
  yearGz: [number, number];
  /** 月干支 */
  monthGz: [number, number];
  /** 日干支 */
  dayGz: [number, number];
  /** 时干支 */
  hourGz: [number, number];
  /** 月将（地支索引 0-11） */
  yueJiang: number;
  /** 占时（地支索引 0-11） */
  zhanShi: number;
  /** 是否昼占 */
  isDay: boolean;
  /** 问题CID（可选） */
  questionCid?: string;
}

/**
 * 随机起课参数
 */
export interface DivineRandomParams {
  /** 日干支 */
  dayGz: [number, number];
  /** 问题CID（可选） */
  questionCid?: string;
}

/**
 * 手动起课参数（与时间起课相同）
 */
export type DivineManualParams = DivineByTimeParams;

// ==================== 链上操作 ====================

/**
 * 时间起课
 *
 * @param params 起课参数
 * @returns 式盘ID
 */
export async function divineByTime(params: DivineByTimeParams): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.daLiuRen || !api.tx.daLiuRen.divineByTime) {
    throw new Error('区块链节点未包含大六壬模块（pallet-daliuren），请检查节点配置');
  }

  const { yearGz, monthGz, dayGz, hourGz, yueJiang, zhanShi, isDay, questionCid } = params;

  // 构建交易
  const tx = api.tx.daLiuRen.divineByTime(
    yearGz,
    monthGz,
    dayGz,
    hourGz,
    yueJiang,
    zhanShi,
    isDay,
    questionCid || null
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[DaLiuRenService] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          try {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
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

      if (status.isInBlock || status.isFinalized) {
        console.log('[DaLiuRenService] 交易已打包，事件数量:', events.length);

        // 查找 PanCreated 事件
        const event = events.find((e) =>
          e.event.section === 'daLiuRen' && e.event.method === 'PanCreated'
        );

        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[DaLiuRenService] 式盘创建成功，ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          console.error('[DaLiuRenService] 所有事件:', events.map(e => `${e.event.section}.${e.event.method}`).join(', '));
          reject(new Error('交易成功但未找到式盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[DaLiuRenService] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 随机起课
 *
 * @param params 起课参数
 * @returns 式盘ID
 */
export async function divineRandom(params: DivineRandomParams): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.daLiuRen || !api.tx.daLiuRen.divineRandom) {
    throw new Error('区块链节点未包含大六壬模块');
  }

  const { dayGz, questionCid } = params;

  const tx = api.tx.daLiuRen.divineRandom(dayGz, questionCid || null);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[DaLiuRenService] 随机起课状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          try {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } catch (e) {
            reject(new Error(dispatchError.toString()));
          }
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'daLiuRen' && e.event.method === 'PanCreated'
        );

        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[DaLiuRenService] 随机起课成功，ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到式盘创建事件'));
        }
      }
    }).catch(reject);
  });
}

/**
 * 手动起课
 *
 * @param params 起课参数
 * @returns 式盘ID
 */
export async function divineManual(params: DivineManualParams): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.daLiuRen || !api.tx.daLiuRen.divineManual) {
    throw new Error('区块链节点未包含大六壬模块');
  }

  const { yearGz, monthGz, dayGz, hourGz, yueJiang, zhanShi, isDay, questionCid } = params;

  const tx = api.tx.daLiuRen.divineManual(
    yearGz,
    monthGz,
    dayGz,
    hourGz,
    yueJiang,
    zhanShi,
    isDay,
    questionCid || null
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[DaLiuRenService] 手动起课状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          try {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } catch (e) {
            reject(new Error(dispatchError.toString()));
          }
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'daLiuRen' && e.event.method === 'PanCreated'
        );

        if (event) {
          const panId = event.event.data[0].toNumber();
          console.log('[DaLiuRenService] 手动起课成功，ID:', panId);
          resolve(panId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到式盘创建事件'));
        }
      }
    }).catch(reject);
  });
}

/**
 * 设置式盘可见性
 *
 * @param panId 式盘ID
 * @param isPublic 是否公开
 */
export async function setPanVisibility(panId: number, isPublic: boolean): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.daLiuRen || !api.tx.daLiuRen.setPanVisibility) {
    throw new Error('区块链节点未包含大六壬模块');
  }

  const tx = api.tx.daLiuRen.setPanVisibility(panId, isPublic);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        console.log('[DaLiuRenService] 可见性设置成功');
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== 查询函数 ====================

/**
 * 获取式盘详情
 *
 * @param panId 式盘ID
 * @returns 式盘数据或null
 */
export async function getPan(panId: number): Promise<DaLiuRenPan | null> {
  const api = await getApi();

  if (!api.query.daLiuRen || !api.query.daLiuRen.pans) {
    console.error('[DaLiuRenService] daLiuRen pallet 不存在');
    return null;
  }

  console.log('[DaLiuRenService] 查询式盘 ID:', panId);
  const result = await api.query.daLiuRen.pans(panId);

  if (result.isNone) {
    console.log('[DaLiuRenService] 式盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    return parsePanData(panId, data);
  } catch (error) {
    console.error('[DaLiuRenService] 解析式盘失败:', error);
    return null;
  }
}

/**
 * 获取用户的式盘列表
 *
 * @param address 用户地址
 * @returns 式盘ID列表
 */
export async function getUserPanIds(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.daLiuRen || !api.query.daLiuRen.userPans) {
    console.error('[DaLiuRenService] daLiuRen pallet 不存在');
    return [];
  }

  const entries = await api.query.daLiuRen.userPans.entries(address);
  const panIds: number[] = [];

  for (const [key, value] of entries) {
    if (value.isTrue) {
      const panId = key.args[1].toNumber();
      panIds.push(panId);
    }
  }

  return panIds.sort((a, b) => b - a); // 按ID降序
}

/**
 * 获取用户的式盘列表（含详情）
 *
 * @param address 用户地址
 * @returns 式盘列表
 */
export async function getUserPans(address: string): Promise<DaLiuRenPan[]> {
  const panIds = await getUserPanIds(address);
  const pans: DaLiuRenPan[] = [];

  for (const panId of panIds) {
    const pan = await getPan(panId);
    if (pan) {
      pans.push(pan);
    }
  }

  return pans;
}

/**
 * 获取用户统计数据
 *
 * @param address 用户地址
 * @returns 统计数据
 */
export async function getUserStats(address: string): Promise<UserStats> {
  const api = await getApi();

  if (!api.query.daLiuRen || !api.query.daLiuRen.userStatsStorage) {
    return { totalPans: 0, aiInterpretations: 0, firstPanBlock: 0 };
  }

  const result = await api.query.daLiuRen.userStatsStorage(address);
  const data = result.toJSON() as { totalPans?: number; aiInterpretations?: number; firstPanBlock?: number } | null;

  return {
    totalPans: data?.totalPans ?? 0,
    aiInterpretations: data?.aiInterpretations ?? 0,
    firstPanBlock: data?.firstPanBlock ?? 0,
  };
}

/**
 * 获取公开的式盘列表
 *
 * @param limit 数量限制
 * @returns 式盘列表
 */
export async function getPublicPans(limit: number = 20): Promise<DaLiuRenPan[]> {
  const api = await getApi();

  if (!api.query.daLiuRen || !api.query.daLiuRen.publicPans) {
    return [];
  }

  const entries = await api.query.daLiuRen.publicPans.entries();
  const pans: DaLiuRenPan[] = [];

  for (const [key] of entries) {
    if (pans.length >= limit) break;
    const panId = key.args[0].toNumber();
    const pan = await getPan(panId);
    if (pan) {
      pans.push(pan);
    }
  }

  return pans.sort((a, b) => b.createdAt - a.createdAt);
}

// ==================== 解盘查询（Runtime API） ====================

/**
 * 获取核心解盘结果
 *
 * 通过 Runtime API 实时计算，免费、快速
 *
 * @param panId 式盘ID
 * @returns 核心解盘结果或null
 */
export async function getCoreInterpretation(panId: number): Promise<CoreInterpretation | null> {
  const api = await getApi();

  try {
    console.log(`[DaLiuRenService] 获取核心解盘: panId=${panId}`);

    // 检查 Runtime API 是否可用
    if (!api.call?.daLiuRenApi?.getCoreInterpretation) {
      console.log('[DaLiuRenService] Runtime API 不可用');
      return null;
    }

    const result = await api.call.daLiuRenApi.getCoreInterpretation(panId);

    if (!result || result.isNone) {
      console.log('[DaLiuRenService] 解盘结果不存在');
      return null;
    }

    const data = result.unwrap();
    console.log('[DaLiuRenService] 核心解盘数据:', JSON.stringify(data.toJSON()));

    return parseCoreInterpretation(data);
  } catch (error) {
    console.error('[DaLiuRenService] 获取核心解盘失败:', error);
    return null;
  }
}

/**
 * 获取完整解盘结果
 *
 * 通过 Runtime API 实时计算
 *
 * @param panId 式盘ID
 * @param shiXiangType 占问类型（可选）
 * @returns 完整解盘结果或null
 */
export async function getFullInterpretation(
  panId: number,
  shiXiangType?: ShiXiangType
): Promise<FullInterpretation | null> {
  const api = await getApi();

  try {
    console.log(`[DaLiuRenService] 获取完整解盘: panId=${panId}`);

    if (!api.call?.daLiuRenApi?.getFullInterpretation) {
      console.log('[DaLiuRenService] Runtime API 不可用');
      return null;
    }

    const result = await api.call.daLiuRenApi.getFullInterpretation(
      panId,
      shiXiangType ?? null
    );

    if (!result || result.isNone) {
      console.log('[DaLiuRenService] 完整解盘不存在');
      return null;
    }

    const data = result.unwrap();
    console.log('[DaLiuRenService] 完整解盘数据:', JSON.stringify(data.toJSON()));

    return parseFullInterpretation(data);
  } catch (error) {
    console.error('[DaLiuRenService] 获取完整解盘失败:', error);
    return null;
  }
}

/**
 * 获取三传分析
 *
 * @param panId 式盘ID
 * @returns 三传分析或null
 */
export async function getSanChuanAnalysis(panId: number): Promise<SanChuanAnalysis | null> {
  const api = await getApi();

  try {
    if (!api.call?.daLiuRenApi?.getSanChuanAnalysis) {
      return null;
    }

    const result = await api.call.daLiuRenApi.getSanChuanAnalysis(panId);

    if (!result || result.isNone) {
      return null;
    }

    const data = result.unwrap();
    return parseSanChuanAnalysis(data);
  } catch (error) {
    console.error('[DaLiuRenService] 获取三传分析失败:', error);
    return null;
  }
}

/**
 * 获取应期分析
 *
 * @param panId 式盘ID
 * @param shiXiangType 占问类型（可选）
 * @returns 应期分析或null
 */
export async function getYingQiAnalysis(
  panId: number,
  shiXiangType?: ShiXiangType
): Promise<YingQiAnalysis | null> {
  const api = await getApi();

  try {
    if (!api.call?.daLiuRenApi?.getYingQiAnalysis) {
      return null;
    }

    const result = await api.call.daLiuRenApi.getYingQiAnalysis(
      panId,
      shiXiangType ?? null
    );

    if (!result || result.isNone) {
      return null;
    }

    const data = result.unwrap();
    return parseYingQiAnalysis(data);
  } catch (error) {
    console.error('[DaLiuRenService] 获取应期分析失败:', error);
    return null;
  }
}

/**
 * 智能获取解盘（推荐使用）
 *
 * 优先使用 Runtime API，若不可用则返回 null
 *
 * @param panId 式盘ID
 * @param shiXiangType 占问类型（可选）
 * @returns 完整解盘结果或null
 */
export async function getInterpretation(
  panId: number,
  shiXiangType?: ShiXiangType
): Promise<FullInterpretation | null> {
  // 优先尝试完整解盘
  const fullResult = await getFullInterpretation(panId, shiXiangType);
  if (fullResult) {
    return fullResult;
  }

  // 回退到核心解盘
  const coreResult = await getCoreInterpretation(panId);
  if (coreResult) {
    // 包装为完整解盘格式
    return {
      core: coreResult,
      sanChuanAnalysis: await getSanChuanAnalysis(panId) ?? createDefaultSanChuanAnalysis(),
      siKeAnalysis: createDefaultSiKeAnalysis(),
      tianJiangAnalysis: createDefaultTianJiangAnalysis(),
      shenShaAnalysis: createDefaultShenShaAnalysis(),
      yingQiAnalysis: await getYingQiAnalysis(panId, shiXiangType) ?? createDefaultYingQiAnalysis(),
    };
  }

  return null;
}

// ==================== 解析函数 ====================

/**
 * 解析式盘数据
 */
function parsePanData(panId: number, data: any): DaLiuRenPan {
  return {
    id: panId,
    creator: data.creator.toString(),
    createdAt: data.createdAt.toNumber(),
    method: data.method.toNumber() as DivinationMethod,
    questionCid: data.questionCid?.isSome ? parseBoundedVecToString(data.questionCid.unwrap()) : undefined,
    yearGz: parseGanZhi(data.yearGz),
    monthGz: parseGanZhi(data.monthGz),
    dayGz: parseGanZhi(data.dayGz),
    hourGz: parseGanZhi(data.hourGz),
    yueJiang: parseEnum(data.yueJiang) as DiZhi,
    zhanShi: parseEnum(data.zhanShi) as DiZhi,
    isDay: data.isDay.isTrue,
    tianPan: { positions: data.tianPan.positions.map((p: any) => parseEnum(p) as DiZhi) },
    tianJiangPan: { positions: data.tianJiangPan.positions.map((j: any) => parseEnum(j) as TianJiang) },
    siKe: parseSiKe(data.siKe),
    sanChuan: parseSanChuan(data.sanChuan),
    keShiType: parseEnum(data.keShiType) as KeShiType,
    geJuType: parseEnum(data.geJuType) as GeJuType,
    xunKong: [parseEnum(data.xunKong[0]) as DiZhi, parseEnum(data.xunKong[1]) as DiZhi],
    isPublic: data.isPublic.isTrue,
    aiInterpretationCid: data.aiInterpretationCid?.isSome
      ? parseBoundedVecToString(data.aiInterpretationCid.unwrap())
      : undefined,
  };
}

/**
 * 解析干支
 */
function parseGanZhi(data: any): GanZhi {
  return {
    tianGan: parseEnum(data[0]) as TianGan,
    diZhi: parseEnum(data[1]) as DiZhi,
  };
}

/**
 * 解析四课
 */
function parseSiKe(data: any): any {
  return {
    ke1: parseKe(data.ke1),
    ke2: parseKe(data.ke2),
    ke3: parseKe(data.ke3),
    ke4: parseKe(data.ke4),
  };
}

/**
 * 解析单课
 */
function parseKe(data: any): any {
  return {
    shang: parseEnum(data.shang) as DiZhi,
    xia: parseEnum(data.xia) as DiZhi,
    jiang: parseEnum(data.jiang) as TianJiang,
  };
}

/**
 * 解析三传
 */
function parseSanChuan(data: any): any {
  return {
    chu: parseEnum(data.chu) as DiZhi,
    zhong: parseEnum(data.zhong) as DiZhi,
    mo: parseEnum(data.mo) as DiZhi,
    chuJiang: parseEnum(data.chuJiang) as TianJiang,
    zhongJiang: parseEnum(data.zhongJiang) as TianJiang,
    moJiang: parseEnum(data.moJiang) as TianJiang,
    chuQin: parseEnum(data.chuQin) as LiuQin,
    zhongQin: parseEnum(data.zhongQin) as LiuQin,
    moQin: parseEnum(data.moQin) as LiuQin,
  };
}

/**
 * 解析枚举值
 */
function parseEnum(value: any): number {
  if (value === null || value === undefined) return 0;
  const jsonValue = typeof value.toJSON === 'function' ? value.toJSON() : value;
  if (typeof jsonValue === 'number') return jsonValue;
  if (typeof jsonValue === 'object' && jsonValue !== null) {
    // 枚举对象格式如 { Zi: null }
    const keys = Object.keys(jsonValue);
    if (keys.length > 0) {
      // 需要根据枚举名称转换为索引
      return 0; // 简化处理，实际需要映射
    }
  }
  return 0;
}

/**
 * 解析核心解盘
 */
function parseCoreInterpretation(data: any): CoreInterpretation {
  return {
    keShiType: parseEnum(data.keShiType) as KeShiType,
    geJuType: parseEnum(data.geJuType) as GeJuType,
    fortune: parseEnum(data.fortune) as FortuneLevel,
    trend: parseEnum(data.trend) as TrendType,
    outcome: parseEnum(data.outcome) as OutcomeType,
    primaryLeiShen: parseEnum(data.primaryLeiShen) as DiZhi,
    primaryWangShuai: parseEnum(data.primaryWangShuai) as WangShuai,
    primaryLiuQin: parseEnum(data.primaryLiuQin) as LiuQin,
    primaryJiangJi: data.primaryJiangJi?.isTrue ?? false,
    yingQiNum: data.yingQiNum?.toNumber?.() ?? 0,
    yingQiUnit: parseEnum(data.yingQiUnit) as YingQiUnit,
    secondaryYingQi: parseEnum(data.secondaryYingQi) as DiZhi,
    yingQiConfidence: data.yingQiConfidence?.toNumber?.() ?? 0,
    score: data.score?.toNumber?.() ?? 0,
    confidence: data.confidence?.toNumber?.() ?? 0,
    timestamp: data.timestamp?.toNumber?.() ?? 0,
  };
}

/**
 * 解析完整解盘
 */
function parseFullInterpretation(data: any): FullInterpretation {
  return {
    core: parseCoreInterpretation(data.core),
    sanChuanAnalysis: parseSanChuanAnalysis(data.sanChuanAnalysis),
    siKeAnalysis: parseSiKeAnalysis(data.siKeAnalysis),
    tianJiangAnalysis: parseTianJiangAnalysis(data.tianJiangAnalysis),
    shenShaAnalysis: parseShenShaAnalysis(data.shenShaAnalysis),
    yingQiAnalysis: parseYingQiAnalysis(data.yingQiAnalysis),
    shiXiangHints: data.shiXiangHints?.isSome
      ? parseShiXiangHints(data.shiXiangHints.unwrap())
      : undefined,
  };
}

/**
 * 解析三传分析
 */
function parseSanChuanAnalysis(data: any): SanChuanAnalysis {
  return {
    chuWangShuai: parseEnum(data.chuWangShuai) as WangShuai,
    chuJiangJi: data.chuJiangJi?.isTrue ?? false,
    chuKong: data.chuKong?.isTrue ?? false,
    zhongWangShuai: parseEnum(data.zhongWangShuai) as WangShuai,
    zhongJiangJi: data.zhongJiangJi?.isTrue ?? false,
    zhongKong: data.zhongKong?.isTrue ?? false,
    moWangShuai: parseEnum(data.moWangShuai) as WangShuai,
    moJiangJi: data.moJiangJi?.isTrue ?? false,
    moKong: data.moKong?.isTrue ?? false,
    diSheng: data.diSheng?.isTrue ?? false,
    diKe: data.diKe?.isTrue ?? false,
    lianRu: data.lianRu?.isTrue ?? false,
  };
}

/**
 * 解析四课分析
 */
function parseSiKeAnalysis(data: any): any {
  return {
    riGanYouZhu: data.riGanYouZhu?.isTrue ?? false,
    ganYangWangShuai: parseEnum(data.ganYangWangShuai) as WangShuai,
    riZhiYouSheng: data.riZhiYouSheng?.isTrue ?? false,
    zhiYangWangShuai: parseEnum(data.zhiYangWangShuai) as WangShuai,
    shangKeXiaCount: data.shangKeXiaCount?.toNumber?.() ?? 0,
    xiaKeShangCount: data.xiaKeShangCount?.toNumber?.() ?? 0,
    ganZhiHe: data.ganZhiHe?.isTrue ?? false,
    ganZhiChong: data.ganZhiChong?.isTrue ?? false,
  };
}

/**
 * 解析天将分析
 */
function parseTianJiangAnalysis(data: any): any {
  return {
    guiRenLin: parseEnum(data.guiRenLin) as DiZhi,
    guiRenKong: data.guiRenKong?.isTrue ?? false,
    guiRenMu: data.guiRenMu?.isTrue ?? false,
    qingLongLin: parseEnum(data.qingLongLin) as DiZhi,
    baiHuLin: parseEnum(data.baiHuLin) as DiZhi,
    jiJiangCount: data.jiJiangCount?.toNumber?.() ?? 0,
    xiongJiangCount: data.xiongJiangCount?.toNumber?.() ?? 0,
    sanChuanJiJiang: data.sanChuanJiJiang?.toNumber?.() ?? 0,
  };
}

/**
 * 解析神煞分析
 */
function parseShenShaAnalysis(data: any): any {
  return {
    jiShenSha: (data.jiShenSha || []).map((s: any) => parseEnum(s)),
    xiongShenSha: (data.xiongShenSha || []).map((s: any) => parseEnum(s)),
    yiMaRuChuan: data.yiMaRuChuan?.isTrue ?? false,
    tianLuoDiWang: data.tianLuoDiWang?.isTrue ?? false,
    liuHaiRuChuan: data.liuHaiRuChuan?.isTrue ?? false,
    sanXingRuChuan: data.sanXingRuChuan?.isTrue ?? false,
  };
}

/**
 * 解析应期分析
 */
function parseYingQiAnalysis(data: any): YingQiAnalysis {
  return {
    primary: parseYingQiResult(data.primary),
    secondary: data.secondary?.isSome ? parseYingQiResult(data.secondary.unwrap()) : undefined,
    special: data.special?.isSome ? parseYingQiResult(data.special.unwrap()) : undefined,
    suggestionIndex: data.suggestionIndex?.toNumber?.() ?? 0,
  };
}

/**
 * 解析应期结果
 */
function parseYingQiResult(data: any): any {
  return {
    num: data.num?.toNumber?.() ?? 0,
    unit: parseEnum(data.unit),
    zhi: parseEnum(data.zhi),
    method: parseEnum(data.method),
  };
}

/**
 * 解析事象断语
 */
function parseShiXiangHints(data: any): any {
  return {
    shiXiangType: parseEnum(data.shiXiangType),
    primaryHintIndex: data.primaryHintIndex?.toNumber?.() ?? 0,
    secondaryHints: (data.secondaryHints || []).map((h: any) => h.toNumber?.() ?? 0),
    cautionIndex: data.cautionIndex?.isSome ? data.cautionIndex.unwrap().toNumber() : undefined,
  };
}

// ==================== 默认值函数 ====================

function createDefaultSanChuanAnalysis(): SanChuanAnalysis {
  return {
    chuWangShuai: 0,
    chuJiangJi: false,
    chuKong: false,
    zhongWangShuai: 0,
    zhongJiangJi: false,
    zhongKong: false,
    moWangShuai: 0,
    moJiangJi: false,
    moKong: false,
    diSheng: false,
    diKe: false,
    lianRu: false,
  };
}

function createDefaultSiKeAnalysis(): any {
  return {
    riGanYouZhu: false,
    ganYangWangShuai: 0,
    riZhiYouSheng: false,
    zhiYangWangShuai: 0,
    shangKeXiaCount: 0,
    xiaKeShangCount: 0,
    ganZhiHe: false,
    ganZhiChong: false,
  };
}

function createDefaultTianJiangAnalysis(): any {
  return {
    guiRenLin: 0,
    guiRenKong: false,
    guiRenMu: false,
    qingLongLin: 0,
    baiHuLin: 0,
    jiJiangCount: 0,
    xiongJiangCount: 0,
    sanChuanJiJiang: 0,
  };
}

function createDefaultShenShaAnalysis(): any {
  return {
    jiShenSha: [],
    xiongShenSha: [],
    yiMaRuChuan: false,
    tianLuoDiWang: false,
    liuHaiRuChuan: false,
    sanXingRuChuan: false,
  };
}

function createDefaultYingQiAnalysis(): YingQiAnalysis {
  return {
    primary: { num: 0, unit: 0, zhi: 0, method: 0 },
    suggestionIndex: 0,
  };
}

// ==================== 辅助函数 ====================

/**
 * 获取式盘总数
 */
export async function getPanCount(): Promise<number> {
  const api = await getApi();

  if (!api.query.daLiuRen || !api.query.daLiuRen.nextPanId) {
    return 0;
  }

  const nextId = await api.query.daLiuRen.nextPanId();
  return nextId.toNumber();
}

/**
 * 检查用户是否是式盘创建者
 */
export async function isPanOwner(panId: number, userAddress: string): Promise<boolean> {
  const pan = await getPan(panId);
  return pan !== null && pan.creator === userAddress;
}

/**
 * 格式化干支显示
 */
export function formatGanZhi(gz: GanZhi): string {
  return TIAN_GAN_NAMES[gz.tianGan] + DI_ZHI_NAMES[gz.diZhi];
}
