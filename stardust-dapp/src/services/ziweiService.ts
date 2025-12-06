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

    const chart: ZiweiChart = {
      id: chartId,
      creator: data.creator.toString(),
      lunarYear: data.lunarYear.toNumber(),
      lunarMonth: data.lunarMonth.toNumber(),
      lunarDay: data.lunarDay.toNumber(),
      birthHour: data.birthHour.toNumber() as DiZhi,
      gender: data.gender.toNumber() as Gender,
      isLeapMonth: data.isLeapMonth.isTrue,
      yearGan: data.yearGan.toNumber() as TianGan,
      yearZhi: data.yearZhi.toNumber() as DiZhi,
      wuXingJu: data.wuXingJu.toNumber() as WuXingJu,
      juShu: data.juShu.toNumber(),
      mingGong: data.mingGong.toNumber(),
      shenGong: data.shenGong.toNumber(),
      createdAt: data.createdAt.toNumber(),
      isPublic: data.isPublic.isTrue,
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
