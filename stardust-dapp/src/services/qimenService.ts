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
 * @returns 排盘 ID
 */
export async function divineByNumbers(
  numbers: number[],
  yangDun: boolean,
  questionHash?: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineByNumbers) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  const tx = api.tx.qimen.divineByNumbers(
    numbers,
    yangDun,
    Array.from(hash),
    isPublic
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
 * @returns 排盘 ID
 */
export async function divineRandom(
  questionHash?: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineRandom) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  const tx = api.tx.qimen.divineRandom(Array.from(hash), isPublic);

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
 * 手动指定起局
 *
 * 直接指定局数和遁类型。
 *
 * @param juNumber - 局数（1-9）
 * @param yangDun - 是否阳遁
 * @param questionHash - 问题哈希（可选）
 * @param isPublic - 是否公开
 * @returns 排盘 ID
 */
export async function divineManual(
  juNumber: number,
  yangDun: boolean,
  questionHash?: Uint8Array,
  isPublic: boolean = false
): Promise<number> {
  const api = await getSignedApi();

  if (!api.tx.qimen || !api.tx.qimen.divineManual) {
    throw new Error('区块链节点未包含奇门遁甲模块（pallet-qimen），请检查节点配置');
  }

  const hash = questionHash || new Uint8Array(32).fill(0);

  const tx = api.tx.qimen.divineManual(
    juNumber,
    yangDun,
    Array.from(hash),
    isPublic
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

    // 解析 AI 解读 CID
    let aiInterpretationCid: string | undefined;
    if (data.aiInterpretationCid && data.aiInterpretationCid.isSome) {
      const cidBytes = data.aiInterpretationCid.unwrap();
      aiInterpretationCid = new TextDecoder().decode(new Uint8Array(cidBytes));
    }

    const chart: QimenChart = {
      id: chartId,
      creator: data.creator.toString(),
      method: data.method.toNumber(),
      dunType: data.dunType.toNumber() as DunType,
      sanYuan: data.sanYuan.toNumber() as SanYuan,
      juNumber: data.juNumber.toNumber(),
      yearGz: [data.yearGz[0].toNumber(), data.yearGz[1].toNumber()],
      monthGz: [data.monthGz[0].toNumber(), data.monthGz[1].toNumber()],
      dayGz: [data.dayGz[0].toNumber(), data.dayGz[1].toNumber()],
      hourGz: [data.hourGz[0].toNumber(), data.hourGz[1].toNumber()],
      zhiFuXing: data.zhiFuXing.toNumber() as JiuXing,
      zhiShiMen: data.zhiShiMen.toNumber() as BaMen,
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
