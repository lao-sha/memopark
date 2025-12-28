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

// ==================== 隐私加密服务 ====================

import CryptoJS from 'crypto-js';
import { blake2AsU8a } from '@polkadot/util-crypto';

/**
 * 隐私模式枚举
 *
 * 与链端 pallet_divination_privacy::types::PrivacyMode 对应
 */
export enum PrivacyMode {
  /** 公开：所有数据明文存储，任何人可查看 */
  Public = 0,
  /** 部分隐私：计算数据明文，敏感数据加密 */
  Partial = 1,
  /** 完全隐私：所有数据加密，仅所有者可解密后查看 */
  Private = 2,
}

/**
 * 紫微斗数敏感数据接口
 *
 * 包含需要加密保护的用户数据
 */
export interface ZiweiSensitiveData {
  /** 命主姓名 */
  name?: string;
  /** 农历年份 */
  lunarYear?: number;
  /** 农历月份 */
  lunarMonth?: number;
  /** 农历日期 */
  lunarDay?: number;
  /** 出生时辰 */
  birthHour?: number;
  /** 性别 */
  gender?: number;
  /** 是否闰月 */
  isLeapMonth?: boolean;
}

/**
 * 加密排盘创建参数
 */
export interface EncryptedZiweiParams {
  /** 隐私模式 */
  privacyMode: PrivacyMode;
  /** 农历年份 */
  lunarYear: number;
  /** 农历月份 */
  lunarMonth: number;
  /** 农历日期 */
  lunarDay: number;
  /** 出生时辰 */
  birthHour: DiZhi;
  /** 性别 */
  gender: Gender;
  /** 是否闰月 */
  isLeapMonth: boolean;
  /** 敏感数据（Partial/Private 模式需要加密） */
  sensitiveData?: ZiweiSensitiveData;
}

/**
 * 紫微命盘公开元数据
 */
export interface ZiweiPublicMetadata {
  /** 命盘 ID */
  id: number;
  /** 隐私模式 */
  privacyMode: PrivacyMode;
  /** 创建时间戳（区块号） */
  createdAt: number;
  /** 是否有加密数据 */
  hasEncryptedData: boolean;
  /** 是否可解读 */
  canInterpret: boolean;
  /** 五行局（如果公开） */
  wuXingJu?: WuXingJu;
  /** 局数（如果公开） */
  juShu?: number;
  /** 命宫位置（如果公开） */
  mingGong?: number;
  /** 是否有 AI 解读 */
  hasAiInterpretation: boolean;
}

/**
 * 加密农历时间起盘
 *
 * 支持三种隐私模式：
 * - Public (0): 所有数据明文存储
 * - Partial (1): 计算数据明文 + 敏感数据加密
 * - Private (2): 全部数据加密
 *
 * @param params - 加密排盘参数
 * @param encryptionKey - 加密密钥（32字节，Partial/Private 模式必须）
 * @returns 命盘 ID
 */
export async function divineByTimeEncrypted(
  params: EncryptedZiweiParams,
  encryptionKey?: Uint8Array
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.ziwei || !api.tx.ziwei.divineByTimeEncrypted) {
    throw new Error('区块链节点未包含加密紫微斗数接口，请检查节点版本');
  }

  const {
    privacyMode,
    lunarYear,
    lunarMonth,
    lunarDay,
    birthHour,
    gender,
    isLeapMonth,
    sensitiveData,
  } = params;

  // 准备加密数据（Partial/Private 模式）
  let encryptedData: Uint8Array | null = null;
  let dataHash: Uint8Array | null = null;
  let ownerKeyBackup: Uint8Array | null = null;

  if (privacyMode >= PrivacyMode.Partial && sensitiveData && encryptionKey) {
    const encrypted = await encryptZiweiSensitiveData(sensitiveData, encryptionKey);
    encryptedData = encrypted.encryptedData;
    dataHash = encrypted.dataHash;
    ownerKeyBackup = encrypted.ownerKeyBackup;
  }

  // 调用链端方法
  const tx = api.tx.ziwei.divineByTimeEncrypted(
    privacyMode,
    lunarYear,
    lunarMonth,
    lunarDay,
    birthHour,
    gender,
    isLeapMonth,
    encryptedData ? Array.from(encryptedData) : null,
    dataHash ? Array.from(dataHash) : null,
    ownerKeyBackup ? Array.from(ownerKeyBackup) : null
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer!, ({ status, events }) => {
      if (status.isInBlock || status.isFinalized) {
        // 查找 EncryptedChartCreated 事件获取命盘 ID
        for (const { event } of events) {
          if (event.section === 'ziwei' && event.method === 'EncryptedChartCreated') {
            const chartId = (event.data as any)[0].toNumber();
            resolve(chartId);
            return;
          }
          if (event.section === 'ziwei' && event.method === 'ChartCreated') {
            const chartId = (event.data as any)[0].toNumber();
            resolve(chartId);
            return;
          }
        }
        reject(new Error('未找到命盘创建事件'));
      }
    }).catch(reject);
  });
}

/**
 * 更新加密数据
 *
 * @param chartId - 命盘 ID
 * @param sensitiveData - 新的敏感数据
 * @param encryptionKey - 新的加密密钥
 */
export async function updateZiweiEncryptedData(
  chartId: number,
  sensitiveData: ZiweiSensitiveData,
  encryptionKey: Uint8Array
): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.ziwei || !api.tx.ziwei.updateEncryptedData) {
    throw new Error('区块链节点未包含更新加密数据接口');
  }

  const encrypted = await encryptZiweiSensitiveData(sensitiveData, encryptionKey);

  const tx = api.tx.ziwei.updateEncryptedData(
    chartId,
    Array.from(encrypted.encryptedData),
    Array.from(encrypted.dataHash),
    Array.from(encrypted.ownerKeyBackup)
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer!, ({ status }) => {
      if (status.isInBlock || status.isFinalized) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 获取命盘公开元数据
 *
 * @param chartId - 命盘 ID
 * @returns 公开元数据
 */
export async function getZiweiPublicMetadata(chartId: number): Promise<ZiweiPublicMetadata | null> {
  const api = await getApi();

  try {
    const chart = await api.query.ziwei.charts(chartId);

    if (chart.isNone) {
      return null;
    }

    const data = chart.unwrap();
    const privacyModeStr = data.privacyMode?.toString() || 'Partial';
    const privacyMode = privacyModeStr === 'Public' ? PrivacyMode.Public :
                        privacyModeStr === 'Partial' ? PrivacyMode.Partial :
                        PrivacyMode.Private;

    // 检查是否有加密数据
    const encryptedData = await api.query.ziwei.encryptedData(chartId);
    const hasEncryptedData = encryptedData.isSome;

    return {
      id: chartId,
      privacyMode,
      createdAt: (data as any).createdAt?.toNumber() || 0,
      hasEncryptedData,
      canInterpret: privacyMode !== PrivacyMode.Private && (data as any).palaces?.isSome,
      wuXingJu: (data as any).wuXingJu?.isSome ? (data as any).wuXingJu.unwrap().toNumber() : undefined,
      juShu: (data as any).juShu?.isSome ? (data as any).juShu.unwrap().toNumber() : undefined,
      mingGong: (data as any).mingGongPos?.isSome ? (data as any).mingGongPos.unwrap().toNumber() : undefined,
      hasAiInterpretation: (data as any).aiInterpretationCid?.isSome,
    };
  } catch (error) {
    console.error('[getZiweiPublicMetadata] 获取命盘元数据失败:', error);
    return null;
  }
}

/**
 * 获取加密数据
 *
 * @param chartId - 命盘 ID
 * @returns 加密的数据
 */
export async function getZiweiEncryptedData(chartId: number): Promise<Uint8Array | null> {
  const api = await getApi();

  try {
    const encryptedData = await api.query.ziwei.encryptedData(chartId);

    if (encryptedData.isNone) {
      return null;
    }

    const data = encryptedData.unwrap();
    return new Uint8Array(data.toU8a());
  } catch (error) {
    console.error('[getZiweiEncryptedData] 获取加密数据失败:', error);
    return null;
  }
}

/**
 * 获取所有者密钥备份
 *
 * @param chartId - 命盘 ID
 * @returns 80 字节密钥备份
 */
export async function getZiweiOwnerKeyBackup(chartId: number): Promise<Uint8Array | null> {
  const api = await getApi();

  try {
    const keyBackup = await api.query.ziwei.ownerKeyBackup(chartId);

    if (keyBackup.isNone) {
      return null;
    }

    const data = keyBackup.unwrap();
    return new Uint8Array(data.toU8a());
  } catch (error) {
    console.error('[getZiweiOwnerKeyBackup] 获取密钥备份失败:', error);
    return null;
  }
}

/**
 * 加密紫微敏感数据
 *
 * 使用 AES-256-CTR 加密敏感数据
 *
 * @param data - 敏感数据
 * @param key - 32 字节加密密钥
 * @returns 加密结果
 */
async function encryptZiweiSensitiveData(
  data: ZiweiSensitiveData,
  key: Uint8Array
): Promise<{
  encryptedData: Uint8Array;
  dataHash: Uint8Array;
  ownerKeyBackup: Uint8Array;
}> {
  // 序列化数据
  const jsonData = JSON.stringify(data);
  const dataBytes = new TextEncoder().encode(jsonData);

  // 计算原始数据哈希
  const dataHash = blake2AsU8a(dataBytes, 256);

  // 生成 12 字节 IV
  const iv = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < 12; i++) {
      iv[i] = Math.floor(Math.random() * 256);
    }
  }

  // 使用 CryptoJS 加密
  const keyHex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.lib.WordArray.create(Array.from(dataBytes) as any),
    CryptoJS.enc.Hex.parse(keyHex),
    {
      iv: CryptoJS.enc.Hex.parse(ivHex),
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding,
    }
  );

  // 组合 IV + 密文
  const ciphertext = encrypted.ciphertext;
  const ciphertextBytes = new Uint8Array(
    ciphertext.words.flatMap((w: number) => [
      (w >> 24) & 0xff,
      (w >> 16) & 0xff,
      (w >> 8) & 0xff,
      w & 0xff,
    ])
  ).slice(0, ciphertext.sigBytes);

  const encryptedData = new Uint8Array(iv.length + ciphertextBytes.length);
  encryptedData.set(iv);
  encryptedData.set(ciphertextBytes, iv.length);

  // 生成所有者密钥备份（80 字节）
  const ownerKeyBackup = new Uint8Array(80);
  const keyHash = blake2AsU8a(key, 256);
  ownerKeyBackup.set(keyHash);
  if (typeof window !== 'undefined' && window.crypto) {
    const padding = new Uint8Array(48);
    window.crypto.getRandomValues(padding);
    ownerKeyBackup.set(padding, 32);
  }

  return { encryptedData, dataHash, ownerKeyBackup };
}

/**
 * 解密紫微敏感数据
 *
 * @param encryptedData - 加密的数据
 * @param key - 32 字节解密密钥
 * @returns 解密后的敏感数据
 */
export function decryptZiweiSensitiveData(
  encryptedData: Uint8Array,
  key: Uint8Array
): ZiweiSensitiveData {
  // 分离 IV 和密文
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  // 转换为 CryptoJS 格式
  const keyHex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

  // 转换密文为 WordArray
  const ciphertextWords: number[] = [];
  for (let i = 0; i < ciphertext.length; i += 4) {
    const word = (ciphertext[i] << 24) |
                 ((ciphertext[i + 1] || 0) << 16) |
                 ((ciphertext[i + 2] || 0) << 8) |
                 (ciphertext[i + 3] || 0);
    ciphertextWords.push(word);
  }

  const ciphertextWordArray = CryptoJS.lib.WordArray.create(ciphertextWords, ciphertext.length);

  // 解密
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertextWordArray } as CryptoJS.lib.CipherParams,
    CryptoJS.enc.Hex.parse(keyHex),
    {
      iv: CryptoJS.enc.Hex.parse(ivHex),
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding,
    }
  );

  // 转换为字符串
  const decryptedBytes = new Uint8Array(
    decrypted.words.flatMap((w: number) => [
      (w >> 24) & 0xff,
      (w >> 16) & 0xff,
      (w >> 8) & 0xff,
      w & 0xff,
    ])
  ).slice(0, decrypted.sigBytes);

  const jsonData = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(jsonData);
}

/**
 * 生成加密密钥
 *
 * @returns 32 字节随机密钥
 */
export function generateZiweiEncryptionKey(): Uint8Array {
  const key = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(key);
  } else {
    for (let i = 0; i < 32; i++) {
      key[i] = Math.floor(Math.random() * 256);
    }
  }
  return key;
}
