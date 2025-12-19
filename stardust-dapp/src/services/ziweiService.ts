/**
 * 紫微斗数链端服务
 *
 * 提供与 pallet-ziwei 的交互，支持：
 * - 时间起盘（根据出生时间计算命盘）
 * - 手动指定起盘
 * - 随机起盘
 * - 命盘查询与管理
 * - AI 解读请求
 *
 * 紫微斗数排盘系统包含：
 * - 十四主星（紫微星系6星 + 天府星系8星）
 * - 六吉星、六煞星
 * - 四化飞星
 * - 大运推算
 */

import { getApi, getSignedApi } from '../lib/polkadot';

// ==================== 类型定义 ====================

/**
 * 天干
 */
export enum TianGan {
  Jia = 0,  // 甲
  Yi = 1,   // 乙
  Bing = 2, // 丙
  Ding = 3, // 丁
  Wu = 4,   // 戊
  Ji = 5,   // 己
  Geng = 6, // 庚
  Xin = 7,  // 辛
  Ren = 8,  // 壬
  Gui = 9,  // 癸
}

/**
 * 地支
 */
export enum DiZhi {
  Zi = 0,   // 子
  Chou = 1, // 丑
  Yin = 2,  // 寅
  Mao = 3,  // 卯
  Chen = 4, // 辰
  Si = 5,   // 巳
  Wu = 6,   // 午
  Wei = 7,  // 未
  Shen = 8, // 申
  You = 9,  // 酉
  Xu = 10,  // 戌
  Hai = 11, // 亥
}

/**
 * 性别
 */
export enum Gender {
  Male = 0,   // 男
  Female = 1, // 女
}

/**
 * 五行局
 */
export enum WuXingJu {
  Shui = 0, // 水二局
  Mu = 1,   // 木三局
  Jin = 2,  // 金四局
  Tu = 3,   // 土五局
  Huo = 4,  // 火六局
}

/**
 * 紫微命盘
 */
export interface ZiweiChart {
  id: number;
  creator: string;
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  birthHour: DiZhi;
  gender: Gender;
  isLeapMonth: boolean;
  yearGan: TianGan;
  yearZhi: DiZhi;
  wuXingJu: WuXingJu;
  juShu: number;
  mingGong: number;
  shenGong: number;
  createdAt: number;
  isPublic: boolean;
  aiInterpretationCid?: string;
}

// 常量
export const TIAN_GAN_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const DI_ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const WU_XING_JU_NAMES = ['水二局', '木三局', '金四局', '土五局', '火六局'];
export const GENDER_NAMES = ['男', '女'];
export const SHICHEN_NAMES = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

// ==================== 起盘服务 ====================

/**
 * 时间起盘 - 根据出生时间计算命盘
 *
 * @param lunarYear - 农历年份
 * @param lunarMonth - 农历月份 (1-12)
 * @param lunarDay - 农历日期 (1-30)
 * @param birthHour - 出生时辰
 * @param gender - 性别
 * @param isLeapMonth - 是否闰月
 * @returns 命盘 ID
 */
export async function divineByTime(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  birthHour: DiZhi,
  gender: Gender,
  isLeapMonth: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 ziwei pallet 是否存在
  if (!api.tx.ziwei || !api.tx.ziwei.divineByTime) {
    throw new Error('区块链节点未包含紫微斗数模块（pallet-ziwei），请检查节点配置');
  }

  const tx = api.tx.ziwei.divineByTime(
    lunarYear,
    lunarMonth,
    lunarDay,
    birthHour,
    gender,
    isLeapMonth
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[ziwei.divineByTime] 交易状态:', status.type);

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
          e.event.section === 'ziwei' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[ziwei.divineByTime] 排盘成功，命盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到命盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[ziwei.divineByTime] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 手动指定起盘
 *
 * @param lunarYear - 农历年份
 * @param lunarMonth - 农历月份
 * @param lunarDay - 农历日期
 * @param birthHour - 出生时辰
 * @param gender - 性别
 * @param yearGan - 年干
 * @param yearZhi - 年支
 * @returns 命盘 ID
 */
export async function divineManual(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  birthHour: DiZhi,
  gender: Gender,
  yearGan: TianGan,
  yearZhi: DiZhi
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.ziwei || !api.tx.ziwei.divineManual) {
    throw new Error('区块链节点未包含紫微斗数模块（pallet-ziwei），请检查节点配置');
  }

  const tx = api.tx.ziwei.divineManual(
    lunarYear,
    lunarMonth,
    lunarDay,
    birthHour,
    gender,
    yearGan,
    yearZhi
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[ziwei.divineManual] 交易状态:', status.type);

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
          e.event.section === 'ziwei' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[ziwei.divineManual] 排盘成功，命盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到命盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[ziwei.divineManual] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 随机起盘
 *
 * @returns 命盘 ID
 */
export async function divineRandom(): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.ziwei || !api.tx.ziwei.divineRandom) {
    throw new Error('区块链节点未包含紫微斗数模块（pallet-ziwei），请检查节点配置');
  }

  const tx = api.tx.ziwei.divineRandom();

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[ziwei.divineRandom] 交易状态:', status.type);

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
          e.event.section === 'ziwei' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[ziwei.divineRandom] 排盘成功，命盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到命盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[ziwei.divineRandom] 交易失败:', error);
      reject(error);
    });
  });
}

// ==================== 命盘查询服务 ====================

/**
 * 获取命盘详情
 *
 * @param chartId - 命盘 ID
 * @returns 命盘数据或 null
 */
export async function getChart(chartId: number): Promise<ZiweiChart | null> {
  const api = await getApi();

  if (!api.query.ziwei || !api.query.ziwei.charts) {
    console.error('[getChart] ziwei pallet 不存在');
    return null;
  }

  console.log('[getChart] 查询命盘 ID:', chartId);
  const result = await api.query.ziwei.charts(chartId);

  if (result.isNone) {
    console.log('[getChart] 命盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[getChart] 原始数据:', JSON.stringify(data.toHuman()));

    // 解析 AI 解读 CID
    let aiInterpretationCid: string | undefined;
    if (data.aiInterpretationCid && data.aiInterpretationCid.isSome) {
      const cidBytes = data.aiInterpretationCid.unwrap();
      aiInterpretationCid = new TextDecoder().decode(new Uint8Array(cidBytes));
    }

    // 辅助函数：安全地从Codec或数字中提取数值
    const toNum = (val: any): number => {
      if (typeof val === 'number') return val;
      if (val && typeof val.toNumber === 'function') return val.toNumber();
      if (val && typeof val === 'string') return parseInt(val.replace(/,/g, ''), 10);
      return 0;
    };

    // 辅助函数：安全地从Codec或布尔值中提取布尔值
    const toBool = (val: any): boolean => {
      if (typeof val === 'boolean') return val;
      if (val && typeof val.isTrue === 'boolean') return val.isTrue;
      return false;
    };

    // 辅助函数：从枚举名称字符串或Codec中提取枚举值
    const toEnum = (val: any, enumObj: any): number => {
      if (typeof val === 'number') return val;
      if (val && typeof val.toNumber === 'function') return val.toNumber();
      if (typeof val === 'string') {
        // 尝试匹配枚举名称
        const key = Object.keys(enumObj).find(k => k === val);
        if (key) return enumObj[key];
      }
      return 0;
    };

    // 地支映射（用于解析 birthHour）
    const DiZhiMap: Record<string, DiZhi> = {
      'Zi': DiZhi.Zi, 'Chou': DiZhi.Chou, 'Yin': DiZhi.Yin, 'Mao': DiZhi.Mao,
      'Chen': DiZhi.Chen, 'Si': DiZhi.Si, 'Wu': DiZhi.Wu, 'Wei': DiZhi.Wei,
      'Shen': DiZhi.Shen, 'You': DiZhi.You, 'Xu': DiZhi.Xu, 'Hai': DiZhi.Hai,
    };

    // 天干映射
    const TianGanMap: Record<string, TianGan> = {
      'Jia': TianGan.Jia, 'Yi': TianGan.Yi, 'Bing': TianGan.Bing, 'Ding': TianGan.Ding,
      'Wu': TianGan.Wu, 'Ji': TianGan.Ji, 'Geng': TianGan.Geng, 'Xin': TianGan.Xin,
      'Ren': TianGan.Ren, 'Gui': TianGan.Gui,
    };

    // 性别映射
    const GenderMap: Record<string, Gender> = {
      'Male': Gender.Male,
      'Female': Gender.Female,
    };

    // 五行局映射
    const WuXingJuMap: Record<string, WuXingJu> = {
      'Water': WuXingJu.Shui,
      'Wood': WuXingJu.Mu,
      'Metal': WuXingJu.Jin,
      'Earth': WuXingJu.Tu,
      'Fire': WuXingJu.Huo,
    };

    const parseEnum = (val: any, map: Record<string, number>): number => {
      if (typeof val === 'number') return val;
      if (val && typeof val.toNumber === 'function') return val.toNumber();
      if (typeof val === 'string' && map[val] !== undefined) return map[val];
      return 0;
    };

    const chart: ZiweiChart = {
      id: chartId,
      creator: data.creator.toString(),
      lunarYear: toNum(data.lunarYear),
      lunarMonth: toNum(data.lunarMonth),
      lunarDay: toNum(data.lunarDay),
      birthHour: parseEnum(data.birthHour, DiZhiMap) as DiZhi,
      gender: parseEnum(data.gender, GenderMap) as Gender,
      isLeapMonth: toBool(data.isLeapMonth),
      yearGan: parseEnum(data.yearGan, TianGanMap) as TianGan,
      yearZhi: parseEnum(data.yearZhi, DiZhiMap) as DiZhi,
      wuXingJu: parseEnum(data.wuXingJu, WuXingJuMap) as WuXingJu,
      juShu: toNum(data.juShu),
      mingGong: toNum(data.mingGongPos || data.mingGong),
      shenGong: toNum(data.shenGongPos || data.shenGong),
      createdAt: toNum(data.createdAt || data.timestamp),
      isPublic: toBool(data.isPublic),
      aiInterpretationCid,
    };

    console.log('[getChart] 解析成功:', chart);
    return chart;
  } catch (error) {
    console.error('[getChart] 解析失败:', error);
    return null;
  }
}

/**
 * 获取用户的命盘列表
 *
 * @param address - 用户地址
 * @returns 命盘 ID 列表
 */
export async function getUserCharts(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.ziwei || !api.query.ziwei.userCharts) {
    console.error('[getUserCharts] ziwei pallet 不存在');
    return [];
  }

  const result = await api.query.ziwei.userCharts(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取公开命盘列表
 *
 * @returns 公开命盘 ID 列表
 */
export async function getPublicCharts(): Promise<number[]> {
  const api = await getApi();

  if (!api.query.ziwei || !api.query.ziwei.publicCharts) {
    console.error('[getPublicCharts] ziwei pallet 不存在');
    return [];
  }

  const result = await api.query.ziwei.publicCharts();
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

// ==================== 命盘管理服务 ====================

/**
 * 设置命盘公开状态
 *
 * @param chartId - 命盘 ID
 * @param isPublic - 是否公开
 */
export async function setChartVisibility(chartId: number, isPublic: boolean): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.ziwei || !api.tx.ziwei.setChartVisibility) {
    throw new Error('区块链节点未包含紫微斗数模块（pallet-ziwei），请检查节点配置');
  }

  const tx = api.tx.ziwei.setChartVisibility(chartId, isPublic);

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
        console.log('[setChartVisibility] 设置成功');
        resolve();
      }
    }).catch((error) => {
      console.error('[setChartVisibility] 设置失败:', error);
      reject(error);
    });
  });
}

// ==================== 批量查询服务 ====================

/**
 * 批量获取命盘详情
 *
 * @param chartIds - 命盘 ID 列表
 * @returns 命盘数据列表
 */
export async function getChartsBatch(chartIds: number[]): Promise<ZiweiChart[]> {
  const results = await Promise.all(chartIds.map((id) => getChart(id)));
  return results.filter((chart): chart is ZiweiChart => chart !== null);
}

/**
 * 获取用户的所有命盘详情
 *
 * @param address - 用户地址
 * @returns 命盘数据列表
 */
export async function getUserChartsWithDetails(address: string): Promise<ZiweiChart[]> {
  const chartIds = await getUserCharts(address);
  return getChartsBatch(chartIds);
}

// ==================== 解卦服务 ====================

import type {
  ZiweiInterpretation,
  ChartOverallScore,
  PalaceInterpretation,
  PatternInfo,
  SiHuaAnalysis,
  DaXianInterpretation,
  Gong,
  FortuneLevel,
  MingGeLevel,
  PatternType,
} from '../types/ziwei';

/**
 * 获取完整解卦数据
 *
 * 通过 Runtime API 实时计算命盘的完整解卦，包括：
 * - 整体评分
 * - 十二宫解读
 * - 格局识别
 * - 四化分析
 * - 大限解读
 *
 * @param chartId - 命盘 ID
 * @returns 完整解卦数据或 null
 */
export async function getInterpretation(chartId: number): Promise<ZiweiInterpretation | null> {
  const api = await getApi();

  // 检查 Runtime API 是否存在
  if (!api.call || !api.call.ziweiInterpretationApi) {
    console.warn('[getInterpretation] ziweiInterpretationApi 不存在，使用本地计算');
    return calculateInterpretationLocally(chartId);
  }

  try {
    console.log('[getInterpretation] 调用 Runtime API，命盘 ID:', chartId);
    const result = await api.call.ziweiInterpretationApi.getInterpretation(chartId);

    if (result.isNone) {
      console.log('[getInterpretation] 命盘不存在');
      return null;
    }

    const data = result.unwrap();
    return parseInterpretationData(data, chartId);
  } catch (error) {
    console.error('[getInterpretation] Runtime API 调用失败:', error);
    // 降级到本地计算
    return calculateInterpretationLocally(chartId);
  }
}

/**
 * 获取整体评分
 *
 * @param chartId - 命盘 ID
 * @returns 整体评分数据或 null
 */
export async function getOverallScore(chartId: number): Promise<ChartOverallScore | null> {
  const api = await getApi();

  if (!api.call || !api.call.ziweiInterpretationApi) {
    console.warn('[getOverallScore] ziweiInterpretationApi 不存在，使用本地计算');
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.overallScore ?? null;
  }

  try {
    const result = await api.call.ziweiInterpretationApi.getOverallScore(chartId);

    if (result.isNone) {
      return null;
    }

    const data = result.unwrap();
    return parseOverallScoreData(data);
  } catch (error) {
    console.error('[getOverallScore] Runtime API 调用失败:', error);
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.overallScore ?? null;
  }
}

/**
 * 获取单个宫位的解读
 *
 * @param chartId - 命盘 ID
 * @param gongWei - 宫位类型
 * @returns 宫位解读数据或 null
 */
export async function getPalaceInterpretation(
  chartId: number,
  gongWei: Gong
): Promise<PalaceInterpretation | null> {
  const api = await getApi();

  if (!api.call || !api.call.ziweiInterpretationApi) {
    console.warn('[getPalaceInterpretation] 使用本地计算');
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.palaceInterpretations[gongWei] ?? null;
  }

  try {
    const result = await api.call.ziweiInterpretationApi.getPalaceInterpretation(chartId, gongWei);

    if (result.isNone) {
      return null;
    }

    const data = result.unwrap();
    return parsePalaceInterpretationData(data);
  } catch (error) {
    console.error('[getPalaceInterpretation] Runtime API 调用失败:', error);
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.palaceInterpretations[gongWei] ?? null;
  }
}

/**
 * 获取命盘格局列表
 *
 * @param chartId - 命盘 ID
 * @returns 识别到的格局列表
 */
export async function getPatterns(chartId: number): Promise<PatternInfo[]> {
  const api = await getApi();

  if (!api.call || !api.call.ziweiInterpretationApi) {
    console.warn('[getPatterns] 使用本地计算');
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.patterns ?? [];
  }

  try {
    const result = await api.call.ziweiInterpretationApi.getPatterns(chartId);

    if (result.isNone) {
      return [];
    }

    const data = result.unwrap();
    return data.map(parsePatternInfoData);
  } catch (error) {
    console.error('[getPatterns] Runtime API 调用失败:', error);
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.patterns ?? [];
  }
}

/**
 * 获取四化飞星分析
 *
 * @param chartId - 命盘 ID
 * @returns 四化分析数据或 null
 */
export async function getSiHuaAnalysis(chartId: number): Promise<SiHuaAnalysis | null> {
  const api = await getApi();

  if (!api.call || !api.call.ziweiInterpretationApi) {
    console.warn('[getSiHuaAnalysis] 使用本地计算');
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.siHuaAnalysis ?? null;
  }

  try {
    const result = await api.call.ziweiInterpretationApi.getSiHuaAnalysis(chartId);

    if (result.isNone) {
      return null;
    }

    const data = result.unwrap();
    return parseSiHuaAnalysisData(data);
  } catch (error) {
    console.error('[getSiHuaAnalysis] Runtime API 调用失败:', error);
    const interp = await calculateInterpretationLocally(chartId);
    return interp?.siHuaAnalysis ?? null;
  }
}

/**
 * 获取指定大限的解读
 *
 * @param chartId - 命盘 ID
 * @param daXianIndex - 大限序号（1-12）
 * @returns 大限解读数据或 null
 */
export async function getDaXianInterpretation(
  chartId: number,
  daXianIndex: number
): Promise<DaXianInterpretation | null> {
  const api = await getApi();

  if (!api.call || !api.call.ziweiInterpretationApi) {
    console.warn('[getDaXianInterpretation] 使用本地计算');
    const interp = await calculateInterpretationLocally(chartId);
    if (!interp) return null;
    const idx = daXianIndex - 1;
    return idx >= 0 && idx < 12 ? interp.daXianInterpretations[idx] : null;
  }

  try {
    const result = await api.call.ziweiInterpretationApi.getDaXianInterpretation(chartId, daXianIndex);

    if (result.isNone) {
      return null;
    }

    const data = result.unwrap();
    return parseDaXianInterpretationData(data);
  } catch (error) {
    console.error('[getDaXianInterpretation] Runtime API 调用失败:', error);
    const interp = await calculateInterpretationLocally(chartId);
    if (!interp) return null;
    const idx = daXianIndex - 1;
    return idx >= 0 && idx < 12 ? interp.daXianInterpretations[idx] : null;
  }
}

/**
 * 根据年龄获取当前大限
 *
 * @param chartId - 命盘 ID
 * @param age - 当前年龄
 * @returns 当前大限解读
 */
export async function getCurrentDaXian(
  chartId: number,
  age: number
): Promise<DaXianInterpretation | null> {
  const api = await getApi();

  if (!api.call || !api.call.ziweiInterpretationApi) {
    console.warn('[getCurrentDaXian] 使用本地计算');
    const interp = await calculateInterpretationLocally(chartId);
    if (!interp) return null;
    // 根据年龄找到对应大限
    return interp.daXianInterpretations.find(
      d => age >= d.startAge && age <= d.endAge
    ) ?? null;
  }

  try {
    const result = await api.call.ziweiInterpretationApi.getCurrentDaXian(chartId, age);

    if (result.isNone) {
      return null;
    }

    return parseDaXianInterpretationData(result.unwrap());
  } catch (error) {
    console.error('[getCurrentDaXian] Runtime API 调用失败:', error);
    const interp = await calculateInterpretationLocally(chartId);
    if (!interp) return null;
    return interp.daXianInterpretations.find(
      d => age >= d.startAge && age <= d.endAge
    ) ?? null;
  }
}

// ==================== 数据解析辅助函数 ====================

/**
 * 解析完整解卦数据
 */
function parseInterpretationData(data: unknown, chartId: number): ZiweiInterpretation {
  const d = data as Record<string, unknown>;

  return {
    chartId,
    overallScore: parseOverallScoreData(d.overallScore),
    palaceInterpretations: (d.palaceInterpretations as unknown[]).map(parsePalaceInterpretationData),
    patterns: (d.patterns as unknown[]).map(parsePatternInfoData),
    siHuaAnalysis: parseSiHuaAnalysisData(d.siHuaAnalysis),
    daXianInterpretations: (d.daXianInterpretations as unknown[]).map(parseDaXianInterpretationData),
    wuXingDistribution: d.wuXingDistribution as [number, number, number, number, number],
    mingZhuStar: (d.mingZhuStar as { toNumber?: () => number })?.toNumber?.() ?? (d.mingZhuStar as number),
    shenZhuStar: (d.shenZhuStar as { toNumber?: () => number })?.toNumber?.() ?? (d.shenZhuStar as number),
  };
}

/**
 * 解析整体评分数据
 */
function parseOverallScoreData(data: unknown): ChartOverallScore {
  const d = data as Record<string, unknown>;
  const toNum = (v: unknown) => (v as { toNumber?: () => number })?.toNumber?.() ?? (v as number);

  return {
    overallScore: toNum(d.overallScore),
    mingGeLevel: toNum(d.mingGeLevel) as MingGeLevel,
    wealthIndex: toNum(d.wealthIndex),
    careerIndex: toNum(d.careerIndex),
    relationshipIndex: toNum(d.relationshipIndex),
    healthIndex: toNum(d.healthIndex),
    fortuneIndex: toNum(d.fortuneIndex),
  };
}

/**
 * 解析宫位解读数据
 */
function parsePalaceInterpretationData(data: unknown): PalaceInterpretation {
  const d = data as Record<string, unknown>;
  const toNum = (v: unknown) => (v as { toNumber?: () => number })?.toNumber?.() ?? (v as number);

  return {
    gongWei: toNum(d.gongWei) as Gong,
    score: toNum(d.score),
    fortuneLevel: toNum(d.fortuneLevel) as FortuneLevel,
    starStrength: toNum(d.starStrength),
    siHuaImpact: toNum(d.siHuaImpact),
    liuJiCount: toNum(d.liuJiCount),
    liuShaCount: toNum(d.liuShaCount),
    keywords: d.keywords as [number, number, number],
    factors: toNum(d.factors),
  };
}

/**
 * 解析格局信息数据
 */
function parsePatternInfoData(data: unknown): PatternInfo {
  const d = data as Record<string, unknown>;
  const toNum = (v: unknown) => (v as { toNumber?: () => number })?.toNumber?.() ?? (v as number);
  const toBool = (v: unknown) => (v as { isTrue?: boolean })?.isTrue ?? (v as boolean);

  return {
    patternType: toNum(d.patternType) as PatternType,
    strength: toNum(d.strength),
    isValid: toBool(d.isValid),
    isAuspicious: toBool(d.isAuspicious),
    score: toNum(d.score),
    keyPalaces: d.keyPalaces as [number, number, number],
  };
}

/**
 * 解析四化分析数据
 */
function parseSiHuaAnalysisData(data: unknown): SiHuaAnalysis {
  const d = data as Record<string, unknown>;
  const toNum = (v: unknown) => (v as { toNumber?: () => number })?.toNumber?.() ?? (v as number);

  return {
    shengNianSiHua: (d.shengNianSiHua as unknown[]).map(toNum) as [number, number, number, number],
    mingGongFeiRu: (d.mingGongFeiRu as unknown[]).map(toNum) as [number, number, number, number],
    caiBoFeiRu: (d.caiBoFeiRu as unknown[]).map(toNum) as [number, number, number, number],
    guanLuFeiRu: (d.guanLuFeiRu as unknown[]).map(toNum) as [number, number, number, number],
    fuQiFeiRu: (d.fuQiFeiRu as unknown[]).map(toNum) as [number, number, number, number],
    ziHuaPalaces: toNum(d.ziHuaPalaces),
    huaJiChongPo: toNum(d.huaJiChongPo),
  };
}

/**
 * 解析大限解读数据
 */
function parseDaXianInterpretationData(data: unknown): DaXianInterpretation {
  const d = data as Record<string, unknown>;
  const toNum = (v: unknown) => (v as { toNumber?: () => number })?.toNumber?.() ?? (v as number);

  return {
    index: toNum(d.index),
    startAge: toNum(d.startAge),
    endAge: toNum(d.endAge),
    gongIndex: toNum(d.gongIndex),
    score: toNum(d.score),
    fortuneLevel: toNum(d.fortuneLevel) as FortuneLevel,
    siHuaFeiRu: (d.siHuaFeiRu as unknown[]).map(toNum) as [number, number, number, number],
    keywords: d.keywords as [number, number, number],
  };
}

// ==================== 本地解卦计算（降级方案）====================

import {
  FORTUNE_LEVEL_NAMES,
  MING_GE_LEVEL_NAMES,
  PATTERN_NAMES,
  PATTERN_DESCRIPTIONS,
  MING_GONG_KEYWORDS,
  CAI_BO_KEYWORDS,
  GUAN_LU_KEYWORDS,
  getFortuneLevel as getFortuneLevelFromScore,
} from '../types/ziwei';

/**
 * 本地计算解卦（当 Runtime API 不可用时的降级方案）
 *
 * 此函数提供简化的本地解卦计算，用于开发测试或 API 不可用时
 *
 * @param chartId - 命盘 ID
 * @returns 解卦数据或 null
 */
async function calculateInterpretationLocally(chartId: number): Promise<ZiweiInterpretation | null> {
  // 获取命盘数据
  const chart = await getChart(chartId);
  if (!chart) {
    return null;
  }

  console.log('[calculateInterpretationLocally] 本地计算命盘解卦:', chartId);

  // 生成简化的十二宫解读
  const palaceInterpretations: PalaceInterpretation[] = [];
  const palaceScores: number[] = [];

  for (let i = 0; i < 12; i++) {
    // 简化评分：基于命宫位置和宫位索引
    const baseScore = 50;
    const mingGongBonus = i === chart.mingGong ? 15 : 0;
    const shenGongBonus = i === chart.shenGong ? 10 : 0;
    const juBonus = chart.juShu * 2;
    const score = Math.min(100, Math.max(0, baseScore + mingGongBonus + shenGongBonus + juBonus + Math.floor(Math.random() * 20) - 10));

    palaceScores.push(score);

    palaceInterpretations.push({
      gongWei: i as Gong,
      score,
      fortuneLevel: getFortuneLevelFromScore(score),
      starStrength: 50 + Math.floor(Math.random() * 30),
      siHuaImpact: Math.floor(Math.random() * 20) - 10,
      liuJiCount: Math.floor(Math.random() * 3),
      liuShaCount: Math.floor(Math.random() * 2),
      keywords: [
        Math.floor(Math.random() * 20),
        20 + Math.floor(Math.random() * 20),
        40 + Math.floor(Math.random() * 20),
      ] as [number, number, number],
      factors: Math.floor(Math.random() * 128),
    });
  }

  // 生成简化的格局列表
  const patterns: PatternInfo[] = [];

  // 随机生成 1-3 个格局
  const patternCount = 1 + Math.floor(Math.random() * 3);
  const usedTypes = new Set<number>();

  for (let i = 0; i < patternCount; i++) {
    let patternType: number;
    do {
      patternType = Math.floor(Math.random() * 32);
    } while (usedTypes.has(patternType));
    usedTypes.add(patternType);

    const isAuspicious = patternType <= 21;
    const strength = 50 + Math.floor(Math.random() * 50);

    patterns.push({
      patternType: patternType as PatternType,
      strength,
      isValid: true,
      isAuspicious,
      score: isAuspicious ? Math.floor(strength / 3) : -Math.floor(strength / 4),
      keyPalaces: [
        chart.mingGong,
        (chart.mingGong + 4) % 12,
        (chart.mingGong + 8) % 12,
      ] as [number, number, number],
    });
  }

  // 计算整体评分
  const mingScore = palaceScores[chart.mingGong];
  const caiBoPos = (chart.mingGong + 8) % 12;
  const guanLuPos = (chart.mingGong + 4) % 12;
  const fuQiPos = (chart.mingGong + 10) % 12;

  const caiScore = palaceScores[caiBoPos];
  const guanScore = palaceScores[guanLuPos];
  const fuScore = palaceScores[fuQiPos];

  const otherScores = palaceScores.filter((_, i) =>
    i !== chart.mingGong && i !== caiBoPos && i !== guanLuPos && i !== fuQiPos
  );
  const otherAvg = otherScores.reduce((a, b) => a + b, 0) / otherScores.length;

  const overallScore = Math.floor(
    mingScore * 0.4 + caiScore * 0.15 + guanScore * 0.15 + fuScore * 0.15 + otherAvg * 0.15
  );

  // 计算命格等级
  const patternBonus = patterns.reduce((sum, p) => sum + p.score, 0);
  const adjustedScore = Math.max(0, Math.min(120, overallScore + patternBonus / 5));

  let mingGeLevel: MingGeLevel;
  if (adjustedScore >= 100) mingGeLevel = 0; // DiWang
  else if (adjustedScore >= 90) mingGeLevel = 1; // JiGui
  else if (adjustedScore >= 80) mingGeLevel = 2; // DaGui
  else if (adjustedScore >= 70) mingGeLevel = 3; // ZhongGui
  else if (adjustedScore >= 55) mingGeLevel = 4; // XiaoGui
  else mingGeLevel = 5; // Putong

  // 生成四化分析
  const siHuaAnalysis: SiHuaAnalysis = {
    shengNianSiHua: [
      chart.yearGan * 2 % 18,
      (chart.yearGan * 2 + 1) % 18,
      (chart.yearGan * 2 + 2) % 18,
      (chart.yearGan * 2 + 3) % 18,
    ] as [number, number, number, number],
    mingGongFeiRu: [
      (chart.mingGong + 2) % 12,
      (chart.mingGong + 5) % 12,
      (chart.mingGong + 7) % 12,
      (chart.mingGong + 9) % 12,
    ] as [number, number, number, number],
    caiBoFeiRu: [caiBoPos, (caiBoPos + 3) % 12, (caiBoPos + 6) % 12, (caiBoPos + 9) % 12],
    guanLuFeiRu: [guanLuPos, (guanLuPos + 3) % 12, (guanLuPos + 6) % 12, (guanLuPos + 9) % 12],
    fuQiFeiRu: [fuQiPos, (fuQiPos + 3) % 12, (fuQiPos + 6) % 12, (fuQiPos + 9) % 12],
    ziHuaPalaces: Math.floor(Math.random() * 4096),
    huaJiChongPo: Math.floor(Math.random() * 4096),
  };

  // 生成大限解读
  const daXianInterpretations: DaXianInterpretation[] = [];
  const qiYunAge = chart.juShu;

  for (let i = 0; i < 12; i++) {
    const gongIndex = (chart.mingGong + i) % 12;
    const startAge = qiYunAge + i * 10;
    const endAge = startAge + 9;
    const score = palaceScores[gongIndex];

    daXianInterpretations.push({
      index: i + 1,
      startAge,
      endAge,
      gongIndex,
      score,
      fortuneLevel: getFortuneLevelFromScore(score),
      siHuaFeiRu: [
        (gongIndex + 2) % 12,
        (gongIndex + 5) % 12,
        (gongIndex + 7) % 12,
        (gongIndex + 9) % 12,
      ] as [number, number, number, number],
      keywords: [
        60 + Math.floor(i / 3),
        64 + Math.floor(score / 25),
        68 + Math.floor(score / 35),
      ] as [number, number, number],
    });
  }

  // 简化的五行分布
  const wuXingDistribution: [number, number, number, number, number] = [
    15 + Math.floor(Math.random() * 10),
    15 + Math.floor(Math.random() * 10),
    15 + Math.floor(Math.random() * 10),
    15 + Math.floor(Math.random() * 10),
    15 + Math.floor(Math.random() * 10),
  ];
  // 归一化
  const total = wuXingDistribution.reduce((a, b) => a + b, 0);
  wuXingDistribution.forEach((_, i) => {
    wuXingDistribution[i] = Math.floor(wuXingDistribution[i] * 100 / total);
  });

  return {
    chartId,
    overallScore: {
      overallScore,
      mingGeLevel,
      wealthIndex: caiScore,
      careerIndex: guanScore,
      relationshipIndex: fuScore,
      healthIndex: palaceScores[(chart.mingGong + 7) % 12],
      fortuneIndex: palaceScores[(chart.mingGong + 2) % 12],
    },
    palaceInterpretations,
    patterns,
    siHuaAnalysis,
    daXianInterpretations,
    wuXingDistribution,
    mingZhuStar: chart.mingGong % 14,
    shenZhuStar: chart.shenGong % 14,
  };
}
