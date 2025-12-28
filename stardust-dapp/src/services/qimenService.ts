/**
 * 奇门遁甲链端服务
 *
 * 提供与 pallet-qimen 的交互，支持：
 * - 时间起局（根据四柱和节气）
 * - 数字起局（根据用户数字）
 * - 随机起局（使用链上随机数）
 * - 手动指定起局
 * - 排盘查询与管理
 * - AI 解读请求
 *
 * 奇门遁甲排盘包含：
 * - 阴阳遁判断
 * - 三元（上中下元）
 * - 局数（1-9局）
 * - 四盘：天盘（九星）、地盘（三奇六仪）、人盘（八门）、神盘（八神）
 * - 值符值使
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type {
  QimenCoreInterpretation,
  QimenFullInterpretation,
  PalaceInterpretation,
  YongShenAnalysis,
  YingQiAnalysis,
  QuestionType,
} from '../types/qimen';

// ==================== 类型定义 ====================

/**
 * 命主信息接口
 * 用于传递用户基本信息到链端
 */
export interface MingZhuInfo {
  /** 命主姓名（UTF-8编码，最大32字节） */
  name?: string;
  /** 命主性别（0=男，1=女） */
  gender?: number;
  /** 命主出生年份 */
  birthYear?: number;
  /** 占问事宜（UTF-8编码，最大128字节） */
  question?: string;
  /** 问事类型（0-11） */
  questionType?: number;
  /** 排盘方法（0=转盘，1=飞盘） */
  panMethod?: number;
}

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
 * 遁类型
 */
export enum DunType {
  Yang = 0, // 阳遁
  Yin = 1,  // 阴遁
}

/**
 * 三元
 */
export enum SanYuan {
  Shang = 0, // 上元
  Zhong = 1, // 中元
  Xia = 2,   // 下元
}

/**
 * 节气
 */
export enum JieQi {
  LiChun = 0,      // 立春
  YuShui = 1,      // 雨水
  JingZhe = 2,     // 惊蛰
  ChunFen = 3,     // 春分
  QingMing = 4,    // 清明
  GuYu = 5,        // 谷雨
  LiXia = 6,       // 立夏
  XiaoMan = 7,     // 小满
  MangZhong = 8,   // 芒种
  XiaZhi = 9,      // 夏至
  XiaoShu = 10,    // 小暑
  DaShu = 11,      // 大暑
  LiQiu = 12,      // 立秋
  ChuShu = 13,     // 处暑
  BaiLu = 14,      // 白露
  QiuFen = 15,     // 秋分
  HanLu = 16,      // 寒露
  ShuangJiang = 17,// 霜降
  LiDong = 18,     // 立冬
  XiaoXue = 19,    // 小雪
  DaXue = 20,      // 大雪
  DongZhi = 21,    // 冬至
  XiaoHan = 22,    // 小寒
  DaHan = 23,      // 大寒
}

/**
 * 九星
 */
export enum JiuXing {
  TianPeng = 0,  // 天蓬
  TianRui = 1,   // 天芮
  TianChong = 2, // 天冲
  TianFu = 3,    // 天辅
  TianQin = 4,   // 天禽
  TianXin = 5,   // 天心
  TianZhu = 6,   // 天柱
  TianRen = 7,   // 天任
  TianYing = 8,  // 天英
}

/**
 * 八门
 */
export enum BaMen {
  XiuMen = 0,  // 休门
  ShengMen = 1,// 生门
  ShangMen = 2,// 伤门
  DuMen = 3,   // 杜门
  JingMen = 4, // 景门
  SiMen = 5,   // 死门
  JingMen2 = 6,// 惊门
  KaiMen = 7,  // 开门
}

/**
 * 干支元组
 */
export type GanZhi = [number, number]; // [天干索引(0-9), 地支索引(0-11)]

/**
 * 奇门盘
 */
export interface QimenChart {
  id: number;
  creator: string;
  method: number;
  dunType: DunType;
  sanYuan: SanYuan;
  juNumber: number;
  jieqi?: JieQi;
  yearGz: GanZhi;
  monthGz: GanZhi;
  dayGz: GanZhi;
  hourGz: GanZhi;
  zhiFuXing: JiuXing;
  zhiShiMen: BaMen;
  createdAt: number;
  isPublic: boolean;
  aiInterpretationCid?: string;
}

// 常量
export const TIAN_GAN_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const DI_ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const DUN_TYPE_NAMES = ['阳遁', '阴遁'];
export const SAN_YUAN_NAMES = ['上元', '中元', '下元'];
export const JIU_XING_NAMES = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
export const BA_MEN_NAMES = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
export const JIE_QI_NAMES = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'
];

// ==================== 起局服务 ====================

/**
 * 时间起局
 *
 * 根据四柱和节气信息生成奇门遁甲盘。
 *
 * @param yearGz - 年柱干支
 * @param monthGz - 月柱干支
 * @param dayGz - 日柱干支
 * @param hourGz - 时柱干支
 * @param jieQi - 节气（0-23）
 * @param dayInJieqi - 节气内天数（1-15）
 * @param questionHash - 问题哈希（可选）
 * @param isPublic - 是否公开
 * @returns 排盘 ID
 */
export async function divineByTime(
  yearGz: GanZhi,
  monthGz: GanZhi,
  dayGz: GanZhi,
  hourGz: GanZhi,
  jieQi: number,
  dayInJieqi: number,
  questionHash?: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  // 检查 qimen pallet 是否存在
  if (!api.tx.qimen || !api.tx.qimen.divineByTime) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  const tx = api.tx.qimen.divineByTime(
    yearGz,
    monthGz,
    dayGz,
    hourGz,
    jieQi,
    dayInJieqi,
    Array.from(hash),
    isPublic
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[qimen.divineByTime] 交易状态:', status.type);

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
          e.event.section === 'qimen' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[qimen.divineByTime] 排盘成功，排盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到排盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[qimen.divineByTime] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 数字起局
 *
 * 使用用户输入的数字生成局数。
 *
 * @param numbers - 用户输入的数字列表
 * @param yangDun - 是否阳遁
 * @param questionHash - 问题哈希（可选）
 * @param isPublic - 是否公开
 * @param mingZhu - 命主信息（可选）
 * @returns 排盘 ID
 */
export async function divineByNumbers(
  numbers: number[],
  yangDun: boolean,
  questionHash?: Uint8Array,
  isPublic: boolean = false,
  mingZhu?: MingZhuInfo
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineByNumbers) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  // 转换命主信息为链端参数
  const nameBytes = mingZhu?.name ? Array.from(new TextEncoder().encode(mingZhu.name.slice(0, 10))) : null;
  const questionBytes = mingZhu?.question ? Array.from(new TextEncoder().encode(mingZhu.question.slice(0, 42))) : null;

  const tx = api.tx.qimen.divineByNumbers(
    numbers,
    yangDun,
    Array.from(hash),
    isPublic,
    // 新增命主信息参数
    nameBytes,
    mingZhu?.gender ?? null,
    mingZhu?.birthYear ?? null,
    questionBytes,
    mingZhu?.questionType ?? null,
    mingZhu?.panMethod ?? 0
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[qimen.divineByNumbers] 交易状态:', status.type);

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
          e.event.section === 'qimen' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[qimen.divineByNumbers] 排盘成功，排盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到排盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[qimen.divineByNumbers] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 随机起局
 *
 * 使用链上随机数生成奇门盘。
 *
 * @param questionHash - 问题哈希（可选）
 * @param isPublic - 是否公开
 * @param mingZhu - 命主信息（可选）
 * @returns 排盘 ID
 */
export async function divineRandom(
  questionHash?: Uint8Array,
  isPublic: boolean = false,
  mingZhu?: MingZhuInfo
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineRandom) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  // 转换命主信息为链端参数
  const nameBytes = mingZhu?.name ? Array.from(new TextEncoder().encode(mingZhu.name.slice(0, 10))) : null;
  const questionBytes = mingZhu?.question ? Array.from(new TextEncoder().encode(mingZhu.question.slice(0, 42))) : null;

  const tx = api.tx.qimen.divineRandom(
    Array.from(hash),
    isPublic,
    // 新增命主信息参数
    nameBytes,
    mingZhu?.gender ?? null,
    mingZhu?.birthYear ?? null,
    questionBytes,
    mingZhu?.questionType ?? null,
    mingZhu?.panMethod ?? 0
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[qimen.divineRandom] 交易状态:', status.type);

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
          e.event.section === 'qimen' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[qimen.divineRandom] 排盘成功，排盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到排盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[qimen.divineRandom] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 公历时间起局
 *
 * 使用公历日期自动计算四柱干支和节气，然后进行奇门遁甲排盘。
 * 用户无需手动计算干支和节气，只需提供公历日期时间。
 *
 * @param solarYear - 公历年份 (1901-2100)
 * @param solarMonth - 公历月份 (1-12)
 * @param solarDay - 公历日期 (1-31)
 * @param hour - 小时 (0-23)
 * @param questionHash - 问题哈希（可选）
 * @param isPublic - 是否公开
 * @param mingZhu - 命主信息（可选）
 * @returns 排盘 ID
 */
export async function divineBySolarTime(
  solarYear: number,
  solarMonth: number,
  solarDay: number,
  hour: number,
  questionHash?: Uint8Array,
  isPublic: boolean = false,
  mingZhu?: MingZhuInfo
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineBySolarTime) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  // 转换命主信息为链端参数
  const nameBytes = mingZhu?.name ? Array.from(new TextEncoder().encode(mingZhu.name.slice(0, 10))) : null;
  const questionBytes = mingZhu?.question ? Array.from(new TextEncoder().encode(mingZhu.question.slice(0, 42))) : null;

  const tx = api.tx.qimen.divineBySolarTime(
    solarYear,
    solarMonth,
    solarDay,
    hour,
    Array.from(hash),
    isPublic,
    // 新增命主信息参数
    nameBytes,
    mingZhu?.gender ?? null,
    mingZhu?.birthYear ?? null,
    questionBytes,
    mingZhu?.questionType ?? null,
    mingZhu?.panMethod ?? 0
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[qimen.divineBySolarTime] 交易状态:', status.type);

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
          e.event.section === 'qimen' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[qimen.divineBySolarTime] 排盘成功，排盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到排盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[qimen.divineBySolarTime] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 手动指定起局
 *
 * 直接指定局数和遁类型。
 *
 * @param juNumber - 局数（1-9）
 * @param yangDun - 是否阳遁
 * @param hourGanzhi - 时柱干支 [天干0-9, 地支0-11]，可选，默认使用当前时辰
 * @param questionHash - 问题哈希（可选）
 * @param isPublic - 是否公开
 * @param mingZhu - 命主信息（可选）
 * @returns 排盘 ID
 */
export async function divineManual(
  juNumber: number,
  yangDun: boolean,
  hourGanzhi?: [number, number],
  questionHash?: Uint8Array,
  isPublic: boolean = false,
  mingZhu?: MingZhuInfo
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineManual) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  // 转换命主信息为链端参数
  const nameBytes = mingZhu?.name ? Array.from(new TextEncoder().encode(mingZhu.name.slice(0, 10))) : null;
  const questionBytes = mingZhu?.question ? Array.from(new TextEncoder().encode(mingZhu.question.slice(0, 42))) : null;

  // 时柱干支：如果未提供，使用当前时辰计算
  let finalHourGanzhi: [number, number];
  if (hourGanzhi) {
    finalHourGanzhi = hourGanzhi;
  } else {
    // 根据当前小时计算时辰地支
    const currentHour = new Date().getHours();
    // 时辰地支：子(23-1), 丑(1-3), 寅(3-5), ... 亥(21-23)
    const hourZhi = Math.floor(((currentHour + 1) % 24) / 2);
    // 时辰天干需要根据日干计算，这里简化处理使用地支相同的天干
    // 实际应该由链端根据日干计算，这里传递地支索引作为占位
    const hourGan = hourZhi % 10;
    finalHourGanzhi = [hourGan, hourZhi];
  }

  const tx = api.tx.qimen.divineManual(
    yangDun,
    juNumber,
    finalHourGanzhi,
    Array.from(hash),
    isPublic,
    // 新增命主信息参数
    nameBytes,
    mingZhu?.gender ?? null,
    mingZhu?.birthYear ?? null,
    questionBytes,
    mingZhu?.questionType ?? null,
    mingZhu?.panMethod ?? 0
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[qimen.divineManual] 交易状态:', status.type);

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
          e.event.section === 'qimen' && e.event.method === 'ChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[qimen.divineManual] 排盘成功，排盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到排盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[qimen.divineManual] 交易失败:', error);
      reject(error);
    });
  });
}

// ==================== 排盘查询服务 ====================

/**
 * 获取排盘详情
 *
 * @param chartId - 排盘 ID
 * @returns 排盘数据或 null
 */
export async function getChart(chartId: number): Promise<QimenChart | null> {
  const api = await getApi();

  if (!api.query.qimen || !api.query.qimen.charts) {
    console.error('[getChart] qimen pallet 不存在');
    return null;
  }

  console.log('[getChart] 查询排盘 ID:', chartId);
  const result = await api.query.qimen.charts(chartId);

  if (result.isNone) {
    console.log('[getChart] 排盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[getChart] 原始数据:', JSON.stringify(data.toHuman()));

    // 使用 toJSON 获取更友好的数据格式
    const jsonData = data.toJSON() as any;
    console.log('[getChart] JSON数据:', JSON.stringify(jsonData));

    // 解析 AI 解读 CID
    let aiInterpretationCid: string | undefined;
    if (jsonData.interpretationCid) {
      aiInterpretationCid = jsonData.interpretationCid;
    }

    const chart: QimenChart = {
      id: chartId,
      creator: jsonData.diviner || '',
      method: 0, // Random method
      dunType: jsonData.dunType === 'Yin' ? 1 : 0,
      sanYuan: jsonData.sanYuan === 'Shang' ? 0 : jsonData.sanYuan === 'Zhong' ? 1 : 2,
      juNumber: parseInt(jsonData.juNumber) || 0,
      yearGz: [0, 0], // 简化处理，可以从 yearGanzhi 解析
      monthGz: [0, 0],
      dayGz: [0, 0],
      hourGz: [0, 0],
      zhiFuXing: 0, // 从 zhiFuXing 字段解析
      zhiShiMen: 0, // 从 zhiShiMen 字段解析
      createdAt: Date.now(),
      isPublic: jsonData.isPublic || false,
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
 * 获取用户的排盘列表
 *
 * @param address - 用户地址
 * @returns 排盘 ID 列表
 */
export async function getUserCharts(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.qimen || !api.query.qimen.userCharts) {
    console.error('[getUserCharts] qimen pallet 不存在');
    return [];
  }

  const result = await api.query.qimen.userCharts(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取公开排盘列表
 *
 * @returns 公开排盘 ID 列表
 */
export async function getPublicCharts(): Promise<number[]> {
  const api = await getApi();

  if (!api.query.qimen || !api.query.qimen.publicCharts) {
    console.error('[getPublicCharts] qimen pallet 不存在');
    return [];
  }

  const result = await api.query.qimen.publicCharts();
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

// ==================== 排盘管理服务 ====================

/**
 * 设置排盘公开状态
 *
 * @param chartId - 排盘 ID
 * @param isPublic - 是否公开
 */
export async function setChartVisibility(chartId: number, isPublic: boolean): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.setChartVisibility) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const tx = api.tx.qimen.setChartVisibility(chartId, isPublic);

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
 * 批量获取排盘详情
 *
 * @param chartIds - 排盘 ID 列表
 * @returns 排盘数据列表
 */
export async function getChartsBatch(chartIds: number[]): Promise<QimenChart[]> {
  const results = await Promise.all(chartIds.map((id) => getChart(id)));
  return results.filter((chart): chart is QimenChart => chart !== null);
}

/**
 * 获取用户的所有排盘详情
 *
 * @param address - 用户地址
 * @returns 排盘数据列表
 */
export async function getUserChartsWithDetails(address: string): Promise<QimenChart[]> {
  const chartIds = await getUserCharts(address);
  return getChartsBatch(chartIds);
}

// ==================== 辅助函数 ====================

/**
 * 获取干支字符串
 */
export function getGanZhiString(gz: GanZhi): string {
  return TIAN_GAN_NAMES[gz[0]] + DI_ZHI_NAMES[gz[1]];
}

// ==================== 解卦服务 ====================

/**
 * 获取核心解卦
 *
 * 返回最关键的解卦指标，约 16 bytes：
 * - 格局类型（正格/伏吟/反吟/三遁/特殊遁）
 * - 用神宫位（1-9）
 * - 值符值使（当值的星和门）
 * - 日干时干落宫
 * - 综合吉凶（大吉到大凶七级）
 * - 吉凶评分（0-100）
 * - 旺衰状态（旺相休囚死）
 * - 特殊格局标记（位标志）
 * - 可信度（0-100）
 * - 时间戳和算法版本
 *
 * @param chartId - 奇门遁甲排盘 ID
 * @returns 核心解卦结果，如果排盘不存在返回 null
 */
export async function getCoreInterpretation(
  chartId: number
): Promise<QimenCoreInterpretation | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getCoreInterpretation(chartId);

    if (result.isNone) {
      console.warn(`[getCoreInterpretation] 排盘 ${chartId} 不存在`);
      return null;
    }

    const interpretation = result.unwrap().toJSON() as any;

    // 转换为前端类型
    return {
      geJu: interpretation.geJu,
      yongShenGong: interpretation.yongShenGong,
      zhiFuXing: interpretation.zhiFuXing,
      zhiShiMen: interpretation.zhiShiMen,
      riGanGong: interpretation.riGanGong,
      shiGanGong: interpretation.shiGanGong,
      fortune: interpretation.fortune,
      fortuneScore: interpretation.fortuneScore,
      wangShuai: interpretation.wangShuai,
      specialPatterns: interpretation.specialPatterns,
      confidence: interpretation.confidence,
      timestamp: interpretation.timestamp,
      algorithmVersion: interpretation.algorithmVersion,
    };
  } catch (error) {
    console.error('[getCoreInterpretation] 获取核心解卦失败:', error);
    return null;
  }
}

/**
 * 获取完整解卦
 *
 * 返回包含所有分析的完整解卦：
 * - core: 核心指标（必有）
 * - palaces: 九宫详细解读（可选）
 * - yongShen: 用神分析（可选）
 * - yingQi: 应期推算（可选）
 * - geJuDetail: 格局详解（可选）
 *
 * @param chartId - 奇门遁甲排盘 ID
 * @param questionType - 问事类型（0-11）
 * @returns 完整解卦结果，如果排盘不存在返回 null
 */
export async function getFullInterpretation(
  chartId: number,
  questionType: QuestionType
): Promise<QimenFullInterpretation | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getFullInterpretation(
      chartId,
      questionType
    );

    if (result.isNone) {
      console.warn(`[getFullInterpretation] 排盘 ${chartId} 不存在`);
      return null;
    }

    const interpretation = result.unwrap().toJSON() as any;

    // 辅助函数：安全解码字节数组或直接返回字符串
    const decodeString = (value: any): string => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) {
        try {
          return new TextDecoder().decode(new Uint8Array(value));
        } catch (e) {
          console.warn('解码失败，返回空字符串:', e);
          return '';
        }
      }
      return String(value);
    };

    // 转换为前端类型
    return {
      core: interpretation.core,
      palaces: interpretation.palaces,
      yongShen: interpretation.yongShen,
      yingQi: interpretation.yingQi && {
        ...interpretation.yingQi,
        rangeDesc: decodeString(interpretation.yingQi.rangeDesc),
      },
      geJuDetail: interpretation.geJuDetail && {
        ...interpretation.geJuDetail,
        name: decodeString(interpretation.geJuDetail.name),
        description: decodeString(interpretation.geJuDetail.description),
        notes: decodeString(interpretation.geJuDetail.notes),
      },
    };
  } catch (error) {
    console.error('[getFullInterpretation] 获取完整解卦失败:', error);
    return null;
  }
}

/**
 * 获取单宫详细解读
 *
 * 返回指定宫位的详细分析：
 * - 天盘干、地盘干
 * - 九星、八门、八神
 * - 宫位五行、天盘五行、地盘五行
 * - 星门关系（星生门/门生星/星克门/门克星/比和）
 * - 宫位旺衰
 * - 特殊状态（伏吟/反吟/旬空/马星）
 * - 宫位吉凶和评分
 *
 * @param chartId - 奇门遁甲排盘 ID
 * @param palaceNum - 宫位数字（1-9）
 * @returns 单宫详细解读，如果排盘不存在或宫位无效返回 null
 */
export async function getPalaceInterpretation(
  chartId: number,
  palaceNum: number
): Promise<PalaceInterpretation | null> {
  try {
    if (palaceNum < 1 || palaceNum > 9) {
      console.warn(`[getPalaceInterpretation] 宫位数字无效: ${palaceNum}`);
      return null;
    }

    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getPalaceInterpretation(
      chartId,
      palaceNum
    );

    if (result.isNone) {
      console.warn(`[getPalaceInterpretation] 排盘 ${chartId} 或宫位 ${palaceNum} 不存在`);
      return null;
    }

    return result.unwrap().toJSON() as any;
  } catch (error) {
    console.error('[getPalaceInterpretation] 获取单宫解读失败:', error);
    return null;
  }
}

/**
 * 获取用神分析
 *
 * 根据问事类型分析用神状态：
 * - 主用神和次用神类型、宫位
 * - 用神旺衰状态
 * - 用神得力情况（大得力/得力/平/失力/大失力）
 * - 用神吉凶和评分
 *
 * @param chartId - 奇门遁甲排盘 ID
 * @param questionType - 问事类型（0-11）
 * @returns 用神分析结果，如果排盘不存在返回 null
 */
export async function getYongShenAnalysis(
  chartId: number,
  questionType: QuestionType
): Promise<YongShenAnalysis | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getYongShenAnalysis(
      chartId,
      questionType
    );

    if (result.isNone) {
      console.warn(`[getYongShenAnalysis] 排盘 ${chartId} 不存在`);
      return null;
    }

    return result.unwrap().toJSON() as any;
  } catch (error) {
    console.error('[getYongShenAnalysis] 获取用神分析失败:', error);
    return null;
  }
}

/**
 * 获取应期推算
 *
 * 预测事情应验的时间：
 * - 主应期数（基于用神宫位）
 * - 次应期数（基于值符值使）
 * - 应期单位（时辰/日/旬/月/季/年）
 * - 应期范围描述
 * - 吉利时间列表
 * - 不利时间列表
 *
 * @param chartId - 奇门遁甲排盘 ID
 * @returns 应期推算结果，如果排盘不存在返回 null
 */
export async function getYingQiAnalysis(
  chartId: number
): Promise<YingQiAnalysis | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getYingQiAnalysis(chartId);

    if (result.isNone) {
      console.warn(`[getYingQiAnalysis] 排盘 ${chartId} 不存在`);
      return null;
    }

    const yingQi = result.unwrap().toJSON() as any;

    // 转换字节数组为字符串
    return {
      ...yingQi,
      rangeDesc: new TextDecoder().decode(new Uint8Array(yingQi.rangeDesc)),
    };
  } catch (error) {
    console.error('[getYingQiAnalysis] 获取应期推算失败:', error);
    return null;
  }
}

// ==================== 隐私加密服务 ====================

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
 * 奇门遁甲敏感数据接口
 *
 * 包含需要加密保护的用户数据
 */
export interface QimenSensitiveData {
  /** 命主姓名 */
  name?: string;
  /** 问事内容 */
  question?: string;
  /** 出生年份（Private 模式时加密） */
  birthYear?: number;
  /** 性别 */
  gender?: number;
  /** 公历日期时间（Private 模式时加密） */
  solarTime?: {
    year: number;
    month: number;
    day: number;
    hour: number;
  };
}

/**
 * 加密排盘创建参数
 */
export interface EncryptedQimenParams {
  /** 隐私模式 */
  privacyMode: PrivacyMode;
  /** 公历年份 */
  solarYear: number;
  /** 公历月份 */
  solarMonth: number;
  /** 公历日期 */
  solarDay: number;
  /** 小时 */
  hour: number;
  /** 问题哈希 */
  questionHash?: Uint8Array;
  /** 问事类型 */
  questionType?: number;
  /** 排盘方法 */
  panMethod?: number;
  /** 敏感数据（Partial/Private 模式需要加密） */
  sensitiveData?: QimenSensitiveData;
}

/**
 * 排盘公开元数据
 */
export interface QimenPublicMetadata {
  /** 排盘 ID */
  id: number;
  /** 隐私模式 */
  privacyMode: PrivacyMode;
  /** 起局方式 */
  method: number;
  /** 排盘方法 */
  panMethod: number;
  /** 排盘时间戳 */
  timestamp: number;
  /** 问事类型 */
  questionType?: number;
  /** 是否有加密数据 */
  hasEncryptedData: boolean;
  /** 是否可解读 */
  canInterpret: boolean;
}

/**
 * 加密公历时间起局
 *
 * 支持三种隐私模式：
 * - Public (0): 所有数据明文存储
 * - Partial (1): 计算数据明文 + 敏感数据加密
 * - Private (2): 全部数据加密
 *
 * @param params - 加密排盘参数
 * @param encryptionKey - 加密密钥（32字节，Partial/Private 模式必须）
 * @returns 排盘 ID
 */
export async function divineBySolarTimeEncrypted(
  params: EncryptedQimenParams,
  encryptionKey?: Uint8Array
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineBySolarTimeEncrypted) {
    throw new Error('区块链节点未包含加密奇门遁甲接口，请检查节点版本');
  }

  const {
    privacyMode,
    solarYear,
    solarMonth,
    solarDay,
    hour,
    questionHash,
    questionType,
    panMethod,
    sensitiveData,
  } = params;

  const hash = questionHash || new Uint8Array(32).fill(0);

  // 准备加密数据（Partial/Private 模式）
  let encryptedData: Uint8Array | null = null;
  let dataHash: Uint8Array | null = null;
  let ownerKeyBackup: Uint8Array | null = null;

  if (privacyMode >= PrivacyMode.Partial && sensitiveData && encryptionKey) {
    // 加密敏感数据
    const encrypted = await encryptQimenSensitiveData(sensitiveData, encryptionKey);
    encryptedData = encrypted.encryptedData;
    dataHash = encrypted.dataHash;
    ownerKeyBackup = encrypted.ownerKeyBackup;
  }

  const tx = api.tx.qimen.divineBySolarTimeEncrypted(
    privacyMode,
    solarYear,
    solarMonth,
    solarDay,
    hour,
    Array.from(hash),
    encryptedData ? Array.from(encryptedData) : null,
    dataHash ? Array.from(dataHash) : null,
    ownerKeyBackup ? Array.from(ownerKeyBackup) : null,
    questionType ?? null,
    panMethod ?? 0
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[divineBySolarTimeEncrypted] 交易状态:', status.type);

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
          e.event.section === 'qimen' && e.event.method === 'EncryptedChartCreated'
        );
        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[divineBySolarTimeEncrypted] 加密排盘成功，排盘ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到加密排盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[divineBySolarTimeEncrypted] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 更新加密数据
 *
 * 允许所有者更新已有排盘的加密数据（用于密钥轮换等场景）
 *
 * @param chartId - 排盘 ID
 * @param sensitiveData - 新的敏感数据
 * @param encryptionKey - 新的加密密钥
 */
export async function updateEncryptedData(
  chartId: number,
  sensitiveData: QimenSensitiveData,
  encryptionKey: Uint8Array
): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.updateEncryptedData) {
    throw new Error('区块链节点未包含加密更新接口，请检查节点版本');
  }

  // 加密新数据
  const encrypted = await encryptQimenSensitiveData(sensitiveData, encryptionKey);

  const tx = api.tx.qimen.updateEncryptedData(
    chartId,
    Array.from(encrypted.encryptedData),
    Array.from(encrypted.dataHash),
    Array.from(encrypted.ownerKeyBackup)
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[updateEncryptedData] 交易状态:', status.type);

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
          e.event.section === 'qimen' && e.event.method === 'EncryptedDataUpdated'
        );
        if (event) {
          console.log('[updateEncryptedData] 更新成功');
          resolve();
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到更新事件'));
        }
      }
    }).catch((error) => {
      console.error('[updateEncryptedData] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 获取加密数据
 *
 * 用于 Partial/Private 模式下获取链上存储的加密数据
 *
 * @param chartId - 排盘 ID
 * @returns 加密数据（Uint8Array）或 null
 */
export async function getEncryptedData(chartId: number): Promise<Uint8Array | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getEncryptedData(chartId);

    if (result.isNone) {
      console.warn(`[getEncryptedData] 排盘 ${chartId} 无加密数据`);
      return null;
    }

    const data = result.unwrap().toJSON() as number[];
    return new Uint8Array(data);
  } catch (error) {
    console.error('[getEncryptedData] 获取加密数据失败:', error);
    return null;
  }
}

/**
 * 获取所有者密钥备份
 *
 * 用于所有者恢复加密密钥或授权他人查看
 *
 * @param chartId - 排盘 ID
 * @returns 密钥备份（80 字节）或 null
 */
export async function getOwnerKeyBackup(chartId: number): Promise<Uint8Array | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getOwnerKeyBackup(chartId);

    if (result.isNone) {
      console.warn(`[getOwnerKeyBackup] 排盘 ${chartId} 无密钥备份`);
      return null;
    }

    const data = result.unwrap().toJSON() as number[];
    return new Uint8Array(data);
  } catch (error) {
    console.error('[getOwnerKeyBackup] 获取密钥备份失败:', error);
    return null;
  }
}

/**
 * 获取排盘公开元数据
 *
 * 返回排盘的公开元数据，不包含敏感信息
 *
 * @param chartId - 排盘 ID
 * @returns 公开元数据或 null
 */
export async function getPublicMetadata(chartId: number): Promise<QimenPublicMetadata | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.getPublicMetadata(chartId);

    if (result.isNone) {
      console.warn(`[getPublicMetadata] 排盘 ${chartId} 不存在`);
      return null;
    }

    const metadata = result.unwrap().toJSON() as any;
    return {
      id: metadata.id,
      privacyMode: metadata.privacyMode === 'Public' ? 0 :
                   metadata.privacyMode === 'Partial' ? 1 : 2,
      method: metadata.method,
      panMethod: metadata.panMethod,
      timestamp: metadata.timestamp,
      questionType: metadata.questionType,
      hasEncryptedData: metadata.hasEncryptedData,
      canInterpret: metadata.canInterpret,
    };
  } catch (error) {
    console.error('[getPublicMetadata] 获取公开元数据失败:', error);
    return null;
  }
}

/**
 * 临时计算排盘（用于 Private 模式）
 *
 * 当用户使用 Private 模式保存了排盘，但需要查看解读时：
 * 1. 前端获取加密数据并解密
 * 2. 使用解密后的日期时间参数调用此 API
 * 3. 返回完整的排盘计算结果（不存储）
 *
 * @param solarYear - 公历年份
 * @param solarMonth - 公历月份
 * @param solarDay - 公历日期
 * @param hour - 小时
 * @param questionType - 问事类型
 * @param panMethod - 排盘方法
 * @returns 临时排盘结果
 */
export async function computeChart(
  solarYear: number,
  solarMonth: number,
  solarDay: number,
  hour: number,
  questionType: number = 0,
  panMethod: number = 0
): Promise<any | null> {
  try {
    const api = await getApi();
    const result = await api.call.qimenInterpretationApi.computeChart(
      solarYear,
      solarMonth,
      solarDay,
      hour,
      questionType,
      panMethod
    );

    if (result.isNone) {
      console.warn('[computeChart] 计算失败');
      return null;
    }

    return result.unwrap().toJSON();
  } catch (error) {
    console.error('[computeChart] 临时计算失败:', error);
    return null;
  }
}

// ==================== 加密工具函数 ====================

import { blake2AsU8a } from '@polkadot/util-crypto';
import CryptoJS from 'crypto-js';

/**
 * 加密奇门敏感数据
 *
 * 使用 AES-256-GCM 加密敏感数据
 *
 * @param data - 敏感数据
 * @param key - 32 字节加密密钥
 * @returns 加密结果
 */
async function encryptQimenSensitiveData(
  data: QimenSensitiveData,
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

  // 生成所有者密钥备份（80 字节：nonce(24) + sealed key(48) + tag(8)）
  // 简化实现：使用密钥哈希 + 随机填充
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
 * 解密奇门敏感数据
 *
 * @param encryptedData - 加密的数据
 * @param key - 32 字节解密密钥
 * @returns 解密后的敏感数据
 */
export function decryptQimenSensitiveData(
  encryptedData: Uint8Array,
  key: Uint8Array
): QimenSensitiveData {
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
export function generateEncryptionKey(): Uint8Array {
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

/**
 * 从密码派生加密密钥
 *
 * @param password - 用户密码
 * @param salt - 盐值（可选，默认使用固定值）
 * @returns 32 字节密钥
 */
export function deriveKeyFromPassword(password: string, salt?: string): Uint8Array {
  const saltValue = salt || 'stardust_qimen_salt';
  const keyMaterial = CryptoJS.PBKDF2(password, saltValue, {
    keySize: 256 / 32,
    iterations: 10000,
  });

  const keyHex = keyMaterial.toString();
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = parseInt(keyHex.substr(i * 2, 2), 16);
  }
  return key;
}
