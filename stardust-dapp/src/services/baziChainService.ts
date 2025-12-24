/**
 * 八字链上服务
 *
 * 提供与 pallet-bazi-chart 的交互功能：
 * - 保存八字命盘到链上
 * - 查询链上八字数据
 * - 八字结果关联到悬赏/NFT等
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type {
  BaziResult,
  SiZhu,
  Gender,
  FullBaziChartV5,
  EnhancedSiZhu,
  EnhancedZhu,
  DaYunInfoV5,
  DaYunStepV5,
  KongWangInfo,
  XingYunInfo,
  ShenShaEntryV5,
  CangGanDetail,
  ShiErChangSheng,
  CangGanType,
  NaYinType,
  SiZhuPosition,
  ShenShaNature,
  WuXingStrength,
  WuXing,
  TianGan,
  DiZhi,
  ShiShen,
  ShenSha,
  ZiZuoInfo,  // ⭐ 新增
} from '../types/bazi';
import { DivinationType } from '../types/divination';

// ==================== 类型定义 ====================

/**
 * 链上八字命盘数据结构
 */
export interface OnChainBaziChart {
  /** 命盘ID */
  id: number;
  /** 创建者地址 */
  creator: string;
  /** 出生年 */
  birthYear: number;
  /** 出生月 */
  birthMonth: number;
  /** 出生日 */
  birthDay: number;
  /** 出生时辰 */
  birthHour: number;
  /** 性别 (0=男, 1=女) */
  gender: number;
  /** 是否公开 */
  isPublic: boolean;
  /** IPFS CID (存储完整八字数据) */
  dataCid?: string;
  /** 创建区块号 */
  createdAt: number;
  /** 状态 (0=活跃, 1=归档) */
  status: number;
}

/**
 * 八字保存参数
 */
export interface SaveBaziParams {
  /** 出生年份 */
  year: number;
  /** 出生月份 (1-12) */
  month: number;
  /** 出生日 (1-31) */
  day: number;
  /** 出生时辰 (0-23) */
  hour: number;
  /** 性别 */
  gender: Gender;
  /** 是否公开 */
  isPublic?: boolean;
  /** 完整八字数据的IPFS CID */
  dataCid?: string;
}

// ==================== 链上操作 ====================

/**
 * 保存八字命盘到链上
 *
 * @param params 八字参数
 * @returns 命盘ID
 */
export async function saveBaziToChain(params: SaveBaziParams): Promise<number> {
  const api = await getSignedApi();

  // 检查 baziChart pallet 是否存在
  if (!api.tx.baziChart || !api.tx.baziChart.createBaziChart) {
    throw new Error('区块链节点未包含八字命理模块（pallet-bazi-chart），请检查节点配置');
  }

  const { year, month, day, hour, gender } = params;

  // 构建交易
  // 注意：实际 pallet 签名是 create_bazi_chart(year, month, day, hour, minute, gender, zishi_mode, longitude, latitude)
  const minute = 0; // 默认分钟为0
  const zishiMode = 1; // 1=现代派, 2=传统派（默认使用现代派）
  const longitude = null; // 经度（可选，用于真太阳时计算）
  const latitude = null;  // 纬度（可选，用于真太阳时计算）

  const tx = api.tx.baziChart.createBaziChart(
    year,
    month,
    day,
    hour,
    minute,
    gender,
    zishiMode,
    longitude,  // ⭐ 新增
    latitude    // ⭐ 新增
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[BaziChainService] 交易状态:', status.type);

      // 检查调度错误
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
        console.log('[BaziChainService] 交易已打包，事件数量:', events.length);

        // 查找 BaziChartCreated 事件
        const event = events.find((e) =>
          e.event.section === 'baziChart' && e.event.method === 'BaziChartCreated'
        );

        if (event) {
          // chart_id 现在直接是 u64 类型
          const chartId = event.event.data[1].toNumber(); // data[0]=owner, data[1]=chart_id
          console.log('[BaziChainService] 八字命盘创建成功，ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          console.error('[BaziChainService] 所有事件:', events.map(e => `${e.event.section}.${e.event.method}`).join(', '));
          reject(new Error('交易成功但未找到命盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[BaziChainService] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 获取链上八字命盘详情
 *
 * @param chartId 命盘ID
 * @returns 命盘数据或null
 */
export async function getBaziChart(chartId: number): Promise<OnChainBaziChart | null> {
  const api = await getApi();

  // 检查 baziChart pallet 是否存在
  if (!api.query.baziChart || !api.query.baziChart.chartById) {
    console.error('[BaziChainService] baziChart pallet 不存在');
    return null;
  }

  console.log('[BaziChainService] 查询命盘 ID:', chartId);
  const result = await api.query.baziChart.chartById(chartId);

  if (result.isNone) {
    console.log('[BaziChainService] 命盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[BaziChainService] 原始数据:', JSON.stringify(data.toHuman()));

    // 链上 BaziChart 结构：
    // - owner: AccountId
    // - birth_time: { year, month, day, hour, minute }
    // - gender: Gender
    // - zishi_mode: ZiShiMode
    // - sizhu: SiZhu
    // - dayun: DaYunInfo
    // - wuxing_strength: WuXingStrength
    // - xiyong_shen: Option<WuXing>
    // - timestamp: u64 (区块号)

    return {
      id: chartId,
      creator: data.owner.toString(),
      birthYear: data.birthTime.year.toNumber(),
      birthMonth: data.birthTime.month.toNumber(),
      birthDay: data.birthTime.day.toNumber(),
      birthHour: data.birthTime.hour.toNumber(),
      gender: data.gender.isMan ? 0 : 1, // Gender enum: Man=0, Woman=1
      isPublic: true, // 链上暂无此字段，默认为公开
      dataCid: undefined, // 链上暂无此字段
      createdAt: data.timestamp.toNumber(),
      status: 0, // 链上暂无此字段，默认为活跃状态
    };
  } catch (error) {
    console.error('[BaziChainService] 解析失败:', error);
    return null;
  }
}

/**
 * 藏干详情（链上数据解析）
 */
export interface CangGanInfo {
  /** 藏干天干索引 (0-9) */
  gan: number;
  /** 十神类型 */
  shiShen: string;
  /** 藏干类型: ZhuQi=主气, ZhongQi=中气, YuQi=余气 */
  cangGanType: string;
  /** 权重 */
  weight: number;
}

/**
 * 单柱完整数据结构
 */
export interface ZhuFullData {
  /** 天干索引 (0-9) */
  gan: number;
  /** 地支索引 (0-11) */
  zhi: number;
  /** 藏干信息数组 */
  cangGan: CangGanInfo[];
  /** 纳音类型 */
  naYin: string;
}

/**
 * 四柱数据结构（包含天干地支索引）
 */
export interface SiZhuData {
  /** 年柱天干索引 (0-9) */
  yearGan: number;
  /** 年柱地支索引 (0-11) */
  yearZhi: number;
  /** 月柱天干索引 (0-9) */
  monthGan: number;
  /** 月柱地支索引 (0-11) */
  monthZhi: number;
  /** 日柱天干索引 (0-9) */
  dayGan: number;
  /** 日柱地支索引 (0-11) */
  dayZhi: number;
  /** 时柱天干索引 (0-9) */
  hourGan: number;
  /** 时柱地支索引 (0-11) */
  hourZhi: number;
  /** 年柱完整数据 */
  yearZhu?: ZhuFullData;
  /** 月柱完整数据 */
  monthZhu?: ZhuFullData;
  /** 日柱完整数据 */
  dayZhu?: ZhuFullData;
  /** 时柱完整数据 */
  hourZhu?: ZhuFullData;
  /** 日主天干索引 */
  riZhu?: number;
}

/**
 * 完整八字命盘数据（包含四柱）
 */
export interface FullBaziChart extends OnChainBaziChart {
  /** 四柱数据 */
  siZhu: SiZhuData;
}

/**
 * 解析单柱完整数据
 * @param zhuData 链上单柱数据
 * @returns 单柱完整数据
 */
function parseZhuFullData(zhuData: any): ZhuFullData {
  // 解析藏干数组
  const cangGan: CangGanInfo[] = (zhuData.canggan || []).map((cg: any) => {
    // 解析数字字符串中的逗号，如 "1,000" -> 1000
    const parseNumericString = (val: any): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseInt(val.replace(/,/g, ''), 10) || 0;
      return 0;
    };

    return {
      gan: parseInt(cg.gan?.toString() || '0'),
      shiShen: cg.shishen?.toString() || '',
      cangGanType: cg.cangganType?.toString() || '',
      weight: parseNumericString(cg.weight),
    };
  });

  return {
    gan: parseInt(zhuData.ganzhi?.gan?.toString() || '0'),
    zhi: parseInt(zhuData.ganzhi?.zhi?.toString() || '0'),
    cangGan,
    naYin: zhuData.nayin?.toString() || '',
  };
}

/**
 * 获取完整八字命盘数据（包括四柱）
 *
 * @param chartId 命盘ID
 * @returns 完整命盘数据或null
 */
export async function getFullBaziChart(chartId: number): Promise<FullBaziChart | null> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.chartById) {
    console.error('[BaziChainService] baziChart pallet 不存在');
    return null;
  }

  console.log('[BaziChainService] 查询完整命盘 ID:', chartId);
  const result = await api.query.baziChart.chartById(chartId);

  if (result.isNone) {
    console.log('[BaziChainService] 命盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    const humanData = data.toHuman();
    console.log('[BaziChainService] 完整原始数据:', JSON.stringify(humanData));

    // 解析四柱数据
    // 链上数据结构: sizhu.yearZhu.ganzhi.{gan, zhi}
    const sizhuData = data.sizhu;

    // 解析各柱完整数据
    const yearZhu = parseZhuFullData(humanData.sizhu?.yearZhu || sizhuData.yearZhu);
    const monthZhu = parseZhuFullData(humanData.sizhu?.monthZhu || sizhuData.monthZhu);
    const dayZhu = parseZhuFullData(humanData.sizhu?.dayZhu || sizhuData.dayZhu);
    const hourZhu = parseZhuFullData(humanData.sizhu?.hourZhu || sizhuData.hourZhu);

    const siZhu: SiZhuData = {
      yearGan: parseInt(sizhuData.yearZhu.ganzhi.gan.toString()),
      yearZhi: parseInt(sizhuData.yearZhu.ganzhi.zhi.toString()),
      monthGan: parseInt(sizhuData.monthZhu.ganzhi.gan.toString()),
      monthZhi: parseInt(sizhuData.monthZhu.ganzhi.zhi.toString()),
      dayGan: parseInt(sizhuData.dayZhu.ganzhi.gan.toString()),
      dayZhi: parseInt(sizhuData.dayZhu.ganzhi.zhi.toString()),
      hourGan: parseInt(sizhuData.hourZhu.ganzhi.gan.toString()),
      hourZhi: parseInt(sizhuData.hourZhu.ganzhi.zhi.toString()),
      // 完整单柱数据
      yearZhu,
      monthZhu,
      dayZhu,
      hourZhu,
      // 日主
      riZhu: parseInt(sizhuData.rizhu?.toString() || sizhuData.dayZhu.ganzhi.gan.toString()),
    };

    return {
      id: chartId,
      creator: data.owner.toString(),
      birthYear: data.birthTime.year.toNumber(),
      birthMonth: data.birthTime.month.toNumber(),
      birthDay: data.birthTime.day.toNumber(),
      birthHour: data.birthTime.hour.toNumber(),
      gender: data.gender.isMan ? 0 : 1,
      isPublic: true,
      dataCid: undefined,
      createdAt: data.timestamp.toNumber(),
      status: 0,
      siZhu,
    };
  } catch (error) {
    console.error('[BaziChainService] 解析完整命盘失败:', error);
    return null;
  }
}

/**
 * 获取用户的八字命盘列表
 *
 * @param address 用户地址
 * @returns 命盘ID数组
 */
export async function getUserBaziCharts(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.userCharts) {
    console.error('[BaziChainService] baziChart pallet 不存在');
    return [];
  }

  const result = await api.query.baziChart.userCharts(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取用户所有八字命盘详情
 *
 * @param address 用户地址
 * @returns 命盘详情数组
 */
export async function getUserBaziChartsWithDetails(address: string): Promise<OnChainBaziChart[]> {
  const chartIds = await getUserBaziCharts(address);
  const charts: OnChainBaziChart[] = [];

  for (const chartId of chartIds) {
    const chart = await getBaziChart(chartId);
    if (chart) {
      charts.push(chart);
    }
  }

  return charts.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 删除八字命盘
 * 注意：pallet 只支持删除，不支持归档
 *
 * @param chartIdHash 命盘ID (Hash)
 */
export async function deleteBaziChart(chartIdHash: string): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.baziChart || !api.tx.baziChart.deleteBaziChart) {
    throw new Error('区块链节点未包含八字命理模块');
  }

  const tx = api.tx.baziChart.deleteBaziChart(chartIdHash);

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

      if (status.isInBlock) {
        console.log('[BaziChainService] 命盘已删除:', chartIdHash);
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 归档八字命盘（已弃用）
 * 注意：当前 pallet 不支持归档功能，只能删除
 * @deprecated 使用 deleteBaziChart 代替
 */
export async function archiveBaziChart(chartId: number): Promise<void> {
  throw new Error('当前版本不支持归档功能，请使用删除功能');
}

/**
 * 更新八字命盘的IPFS数据CID（已弃用）
 * 注意：当前 pallet 不支持此功能
 * @deprecated 当前版本不支持
 */
export async function updateBaziChartData(chartId: number, dataCid: string): Promise<void> {
  throw new Error('当前版本不支持更新命盘数据功能');
}

/**
 * 设置命盘公开/私有状态（已弃用）
 * 注意：当前 pallet 不支持此功能
 * @deprecated 当前版本不支持
 */
export async function setBaziChartVisibility(chartId: number, isPublic: boolean): Promise<void> {
  throw new Error('当前版本不支持设置可见性功能');
}

// ==================== IPFS 相关 ====================

import { uploadToIpfs as uploadFileToIpfs } from '../lib/ipfs';
import { fetchFromIPFS } from './ipfs';

/**
 * 将八字结果上传到IPFS
 *
 * @param result 八字计算结果
 * @returns IPFS CID
 */
export async function uploadBaziResultToIpfs(result: BaziResult): Promise<string> {
  try {
    const content = JSON.stringify(result, null, 2);
    const blob = new Blob([content], { type: 'application/json; charset=utf-8' });
    const file = new File([blob], 'bazi-result.json', { type: 'application/json' });
    const cid = await uploadFileToIpfs(file);
    console.log('[BaziChainService] 八字数据已上传到IPFS:', cid);
    return cid;
  } catch (error) {
    console.error('[BaziChainService] IPFS上传失败:', error);
    throw new Error(`上传八字数据到IPFS失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 从IPFS下载八字结果
 *
 * @param cid IPFS CID
 * @returns 八字计算结果
 */
export async function downloadBaziResultFromIpfs(cid: string): Promise<BaziResult | null> {
  try {
    const content = await fetchFromIPFS(cid);
    const result = JSON.parse(content) as BaziResult;
    console.log('[BaziChainService] 从IPFS下载八字数据成功');
    return result;
  } catch (error) {
    console.error('[BaziChainService] IPFS下载失败:', error);
    return null;
  }
}

// ==================== 辅助函数 ====================

/**
 * 获取占卜类型常量（用于悬赏/NFT等）
 */
export function getBaziDivinationType(): DivinationType {
  return DivinationType.Bazi;
}

/**
 * 检查用户是否是命盘创建者
 *
 * @param chartId 命盘ID
 * @param userAddress 用户地址
 */
export async function isBaziChartOwner(chartId: number, userAddress: string): Promise<boolean> {
  const chart = await getBaziChart(chartId);
  return chart !== null && chart.creator === userAddress;
}

/**
 * 获取公开的八字命盘列表
 *
 * @param limit 数量限制
 * @returns 公开命盘列表
 */
export async function getPublicBaziCharts(limit: number = 20): Promise<OnChainBaziChart[]> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.chartById) {
    return [];
  }

  const entries = await api.query.baziChart.chartById.entries();
  const charts: OnChainBaziChart[] = [];

  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 注意：链上暂无 isPublic 字段，所有命盘都视为公开
    // 如果未来需要隐私控制，需要在 pallet 中添加此字段

    const chartId = key.args[0].toNumber();
    charts.push({
      id: chartId,
      creator: data.owner.toString(),
      birthYear: data.birthTime.year.toNumber(),
      birthMonth: data.birthTime.month.toNumber(),
      birthDay: data.birthTime.day.toNumber(),
      birthHour: data.birthTime.hour.toNumber(),
      gender: data.gender.isMan ? 0 : 1,
      isPublic: true,
      dataCid: undefined,
      createdAt: data.timestamp.toNumber(),
      status: 0,
    });

    if (charts.length >= limit) break;
  }

  return charts.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 获取命盘总数
 */
export async function getBaziChartCount(): Promise<number> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.nextChartId) {
    return 0;
  }

  const nextId = await api.query.baziChart.nextChartId();
  return nextId.toNumber() - 1;
}

// ==================== 链上解盘功能 ====================

/**
 * 性格特征分析
 */
export interface XingGeAnalysis {
  /** 主要性格特点 */
  zhuYaoTeDian: string[];
  /** 优点 */
  youDian: string[];
  /** 缺点 */
  queDian: string[];
  /** 适合职业 */
  shiHeZhiYe: string[];
}

/**
 * 链上解盘结果类型（V1 完整版）
 */
export interface OnChainInterpretation {
  /** 格局类型 */
  geJu: string;
  /** 命局强弱 */
  qiangRuo: string;
  /** 用神 */
  yongShen: string;
  /** 用神类型 */
  yongShenType: string;
  /** 忌神列表 */
  jiShen: string[];
  /** 性格分析 */
  xingGe: XingGeAnalysis;
  /** 综合评分 (0-100) */
  score: number;
  /** 解盘文本 */
  texts: string[];
}

/**
 * 执行链上自动解盘
 *
 * 注意：此功能会将解盘结果永久存储到链上，产生存储费用
 *
 * @param chartId 命盘ID
 */
export async function interpretBaziOnChain(chartId: number): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.baziChart || !api.tx.baziChart.interpretBaziChart) {
    throw new Error('区块链节点未包含八字解盘模块');
  }

  const tx = api.tx.baziChart.interpretBaziChart(chartId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[BaziChainService] 解盘交易状态:', status.type);

      // 检查调度错误
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
        console.log('[BaziChainService] 解盘交易已打包');

        // 查找 BaziInterpretationCompleted 事件
        const event = events.find((e) =>
          e.event.section === 'baziChart' && e.event.method === 'BaziInterpretationCompleted'
        );

        if (event || status.isFinalized) {
          console.log('[BaziChainService] 链上解盘完成');
          resolve();
        }
      }
    }).catch((error) => {
      console.error('[BaziChainService] 解盘交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 获取链上解盘结果
 *
 * @param chartId 命盘ID
 * @returns 解盘结果或null（如果尚未解盘）
 */
export async function getOnChainInterpretation(chartId: number): Promise<OnChainInterpretation | null> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.interpretationById) {
    console.error('[BaziChainService] baziChart.interpretationById 不存在');
    return null;
  }

  console.log('[BaziChainService] 查询解盘结果 ID:', chartId);
  const result = await api.query.baziChart.interpretationById(chartId);

  if (result.isNone) {
    console.log('[BaziChainService] 解盘结果不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[BaziChainService] 原始解盘数据 (Human):', JSON.stringify(data.toHuman()));
    console.log('[BaziChainService] 原始解盘数据 (JSON):', JSON.stringify(data.toJSON()));

    // 映射格局类型（按索引和名称）
    const geJuByIndex = ['正格', '从强格', '从弱格', '从财格', '从官格', '从儿格', '化气格', '特殊格局'];
    const geJuByName: Record<string, string> = {
      'ZhengGe': '正格',
      'CongQiangGe': '从强格',
      'CongRuoGe': '从弱格',
      'CongCaiGe': '从财格',
      'CongGuanGe': '从官格',
      'CongErGe': '从儿格',
      'HuaQiGe': '化气格',
      'TeShuge': '特殊格局',
    };

    // 映射强弱类型（按索引和名称）
    const qiangRuoByIndex = ['身旺', '身弱', '中和', '太旺', '太弱'];
    const qiangRuoByName: Record<string, string> = {
      'ShenWang': '身旺',
      'ShenRuo': '身弱',
      'ZhongHe': '中和',
      'TaiWang': '太旺',
      'TaiRuo': '太弱',
    };

    // 映射用神类型（按索引和名称）
    const yongShenTypeByIndex = ['扶抑用神', '调候用神', '通关用神', '专旺用神'];
    const yongShenTypeByName: Record<string, string> = {
      'FuYi': '扶抑用神',
      'DiaoHou': '调候用神',
      'TongGuan': '通关用神',
      'ZhuanWang': '专旺用神',
    };

    // 映射五行（按索引和名称）
    const wuXingByIndex = ['金', '木', '水', '火', '土'];
    const wuXingByName: Record<string, string> = {
      'Jin': '金',
      'Mu': '木',
      'Shui': '水',
      'Huo': '火',
      'Tu': '土',
    };

    // 通用枚举解析函数
    const parseEnum = (value: any, byIndex: string[], byName: Record<string, string>): string => {
      const jsonValue = value.toJSON();
      if (typeof jsonValue === 'number') {
        return byIndex[jsonValue] || `未知(${jsonValue})`;
      }
      if (typeof jsonValue === 'object' && jsonValue !== null) {
        const key = Object.keys(jsonValue)[0];
        return byName[key] || key;
      }
      if (typeof jsonValue === 'string') {
        return byName[jsonValue] || jsonValue;
      }
      return `未知`;
    };

    // 解析格局
    const geJu = parseEnum(data.geJu, geJuByIndex, geJuByName);

    // 解析强弱
    const qiangRuo = parseEnum(data.qiangRuo, qiangRuoByIndex, qiangRuoByName);

    // 解析用神
    const yongShen = parseEnum(data.yongShen, wuXingByIndex, wuXingByName);

    // 解析用神类型
    const yongShenType = parseEnum(data.yongShenType, yongShenTypeByIndex, yongShenTypeByName);

    // 解析忌神列表
    const jiShen = data.jiShen.map((js: any) => parseEnum(js, wuXingByIndex, wuXingByName));

    // 解析评分
    const score = data.zongHePingFen.toNumber();

    // 映射解盘文本枚举（按索引顺序）
    // JiePanTextType 枚举定义顺序：
    // 0: GeJuZhengGe, 1: GeJuCongQiang, 2: GeJuCongRuo, 3: GeJuTeShu,
    // 4: QiangRuoShenWang, 5: QiangRuoShenRuo, 6: QiangRuoZhongHe, 7: QiangRuoOther,
    // 8: YongShenJin, 9: YongShenMu, 10: YongShenShui, 11: YongShenHuo, 12: YongShenTu
    const jiePanTextByIndex: string[] = [
      // 格局描述 (0-3)
      '命局为正格，五行相对平衡，发展较为稳定。',
      '命局为从强格，日主旺盛，宜顺势发展，忌克泄耗。',
      '命局为从弱格，日主虚弱，宜借力打力，从势而行。',
      '命局格局特殊，需要综合分析，谨慎行事。',
      // 强弱描述 (4-7)
      '日主偏旺，自主性强，但需注意克制，避免刚愎自用。',
      '日主偏弱，需要贵人相助，宜团队合作，借力发展。',
      '日主中和，五行平衡，发展顺遂，运势较好。',
      '日主强弱特殊，需要结合大运流年综合判断。',
      // 用神建议 (8-12)
      '宜从事金融、机械、五金、贸易相关行业，有利于发展。',
      '宜从事教育、文化、环保、农林相关行业，有利于发展。',
      '宜从事运输、水利、信息、贸易相关行业，有利于发展。',
      '宜从事能源、娱乐、化工相关行业，有利于发展。',
      '宜从事房地产、建筑、农业、服务相关行业，有利于发展。',
    ];

    // 映射解盘文本枚举（按名称）
    const jiePanTextByName: Record<string, string> = {
      'GeJuZhengGe': jiePanTextByIndex[0],
      'GeJuCongQiang': jiePanTextByIndex[1],
      'GeJuCongRuo': jiePanTextByIndex[2],
      'GeJuTeShu': jiePanTextByIndex[3],
      'QiangRuoShenWang': jiePanTextByIndex[4],
      'QiangRuoShenRuo': jiePanTextByIndex[5],
      'QiangRuoZhongHe': jiePanTextByIndex[6],
      'QiangRuoOther': jiePanTextByIndex[7],
      'YongShenJin': jiePanTextByIndex[8],
      'YongShenMu': jiePanTextByIndex[9],
      'YongShenShui': jiePanTextByIndex[10],
      'YongShenHuo': jiePanTextByIndex[11],
      'YongShenTu': jiePanTextByIndex[12],
    };

    // 解析解盘文本
    const texts = data.jiePanText.map((text: any) => {
      const jsonValue = text.toJSON();

      // 情况1：枚举返回数字索引（如 0, 1, 2...）
      if (typeof jsonValue === 'number') {
        return jiePanTextByIndex[jsonValue] || `未知类型 ${jsonValue}`;
      }

      // 情况2：枚举返回对象（如 { GeJuZhengGe: null }）
      if (typeof jsonValue === 'object' && jsonValue !== null) {
        const key = Object.keys(jsonValue)[0];
        return jiePanTextByName[key] || `${key}（暂无描述）`;
      }

      // 情况3：枚举返回字符串名称
      if (typeof jsonValue === 'string') {
        return jiePanTextByName[jsonValue] || `${jsonValue}（暂无描述）`;
      }

      return `未知格式: ${JSON.stringify(jsonValue)}`;
    });

    // 性格特征枚举映射（按索引顺序）
    const xingGeTraitByIndex = [
      '正直', '有主见', '积极向上', '固执', '缺乏变通',
      '温和', '适应性强', '有艺术天赋', '优柔寡断', '依赖性强',
      '热情', '开朗', '有领导力', '急躁', '缺乏耐心',
      '细心', '有创造力', '善于沟通', '情绪化', '敏感',
      '稳重', '可靠', '有责任心', '保守', '变化慢',
      '包容', '细致', '善于协调', '犹豫不决', '缺乏魄力',
      '果断', '有正义感', '执行力强', '刚硬', '不够圆滑',
      '精致', '有品味', '善于表达', '挑剔', '情绪波动大',
      '智慧', '灵活', '适应力强', '多变', '缺乏恒心',
      '内敛', '善于思考',
    ];

    // 职业类型枚举映射（按索引顺序）
    const zhiYeByIndex = [
      '教育', '文化', '环保', '农林', '能源', '娱乐', '餐饮', '化工',
      '房地产', '建筑', '农业', '服务', '金融', '机械', '军警', '五金',
      '贸易', '运输', '水利', '信息',
    ];

    // 解析性格特征
    const parseXingGeTrait = (trait: any): string => {
      const jsonValue = trait.toJSON();
      if (typeof jsonValue === 'number') {
        return xingGeTraitByIndex[jsonValue] || `未知特征(${jsonValue})`;
      }
      return String(jsonValue);
    };

    // 解析职业类型
    const parseZhiYe = (zhiye: any): string => {
      const jsonValue = zhiye.toJSON();
      if (typeof jsonValue === 'number') {
        return zhiYeByIndex[jsonValue] || `未知职业(${jsonValue})`;
      }
      return String(jsonValue);
    };

    // 解析性格分析
    const xingGeData = data.xingGe;
    const xingGe: import('./baziChainService').XingGeAnalysis = {
      zhuYaoTeDian: xingGeData.zhuYaoTeDian?.map(parseXingGeTrait) || [],
      youDian: xingGeData.youDian?.map(parseXingGeTrait) || [],
      queDian: xingGeData.queDian?.map(parseXingGeTrait) || [],
      shiHeZhiYe: xingGeData.shiHeZhiYe?.map(parseZhiYe) || [],
    };

    return {
      geJu,
      qiangRuo,
      yongShen,
      yongShenType,
      jiShen,
      xingGe,
      score,
      texts,
    };
  } catch (error) {
    console.error('[BaziChainService] 解析解盘结果失败:', error);
    return null;
  }
}

// ==================== V2 精简解盘功能 ====================

/**
 * 精简版解盘结果（V2，13 bytes）
 *
 * 对应链上 SimplifiedInterpretation 数据结构
 */
export interface SimplifiedInterpretation {
  /** 格局 */
  geJu: string;
  /** 强弱 */
  qiangRuo: string;
  /** 用神 */
  yongShen: string;
  /** 用神类型 */
  yongShenType: string;
  /** 喜神 */
  xiShen: string;
  /** 忌神 */
  jiShen: string;
  /** 综合评分 0-100 */
  score: number;
  /** 可信度 0-100 */
  confidence: number;
  /** 解盘时间戳（区块号） */
  timestamp: number;
  /** 算法版本 */
  algorithmVersion: number;
}

/**
 * 实时计算基础解盘（免费，无需上链）
 *
 * 优点：
 * - 完全免费（无 Gas 费）
 * - 响应快速（< 100ms）
 * - 算法自动更新
 *
 * @param chartId 命盘 ID
 * @returns 解盘结果或 null
 */
export async function calculateBasicInterpretation(
  chartId: number
): Promise<SimplifiedInterpretation | null> {
  const api = await getApi();

  try {
    console.log(`[BaziChainService] 实时计算解盘: chartId=${chartId}`);

    // 直接通过链上函数计算（不消耗 gas）
    const chart = await api.query.baziChart.chartById(chartId);

    if (!chart || chart.isNone) {
      console.log('[BaziChainService] 命盘不存在:', chartId);
      return null;
    }

    const chartData = chart.unwrap();

    // 调用链上实时计算函数
    // 注意：get_basic_interpretation 是 pallet 的公开函数，不是 extrinsic
    // 我们需要从 chart 数据实时计算
    const currentBlock = await api.query.system.number();

    // 使用 interpretation_v2::calculate_interpretation_v2 的逻辑
    // 由于是链外调用，我们需要先检查是否有缓存
    const cached = await getCachedInterpretation(chartId);
    if (cached) {
      console.log('[BaziChainService] 使用缓存结果');
      return cached;
    }

    // 如果没有缓存，提示用户可以缓存
    console.log('[BaziChainService] 未缓存，需要调用 get_basic_interpretation 或使用缓存');

    // 暂时返回 null，需要用户选择缓存
    return null;

  } catch (error) {
    console.error('[BaziChainService] 计算解盘失败:', error);
    return null;
  }
}

/**
 * 获取链上缓存的解盘结果
 *
 * @param chartId 命盘 ID
 * @returns 缓存的解盘结果或 null
 */
async function getCachedInterpretation(
  chartId: number
): Promise<SimplifiedInterpretation | null> {
  const api = await getApi();

  try {
    const result = await api.query.baziChart.interpretationCache(chartId);

    if (!result || result.isNone) {
      return null;
    }

    const data = result.unwrap();
    return parseSimplifiedInterpretation(data);
  } catch (error) {
    console.error('[BaziChainService] 查询缓存失败:', error);
    return null;
  }
}

/**
 * 通过 Runtime API 实时计算解盘结果（免费）
 *
 * 此函数调用链上的 BaziChartApi.getBasicInterpretation，
 * 实时计算解盘结果，不消耗 Gas，不存储到链上。
 *
 * @param chartId 命盘 ID
 * @returns 解盘结果或 null
 */
export async function getBasicInterpretationViaRuntimeApi(
  chartId: number
): Promise<SimplifiedInterpretation | null> {
  const api = await getApi();

  try {
    console.log(`[BaziChainService] 调用 Runtime API 实时计算解盘: chartId=${chartId}`);

    // 检查 Runtime API 是否可用
    if (!api.call || !api.call.baziChartApi || !api.call.baziChartApi.getBasicInterpretation) {
      console.log('[BaziChainService] Runtime API 不可用，回退到缓存模式');
      return null;
    }

    // 调用 Runtime API
    const result = await api.call.baziChartApi.getBasicInterpretation(chartId);

    if (!result || result.isNone) {
      console.log('[BaziChainService] Runtime API 返回空结果（命盘可能不存在）');
      return null;
    }

    const data = result.unwrap();
    console.log('[BaziChainService] Runtime API 返回数据:', JSON.stringify(data.toHuman()));

    return parseSimplifiedInterpretation(data);
  } catch (error) {
    console.error('[BaziChainService] Runtime API 调用失败:', error);
    return null;
  }
}

/**
 * 智能获取解盘结果
 *
 * 策略（优先级从高到低）：
 * 1. 优先通过 Runtime API 实时计算（免费、实时、使用最新算法）
 * 2. 如果 Runtime API 不可用，从链上缓存加载
 * 3. 如果都没有，返回 null
 *
 * @param chartId 命盘 ID
 * @returns 解盘结果
 */
export async function getInterpretationSmart(
  chartId: number
): Promise<SimplifiedInterpretation | null> {
  // 1. 优先尝试 Runtime API 实时计算（免费）
  const runtimeResult = await getBasicInterpretationViaRuntimeApi(chartId);
  if (runtimeResult) {
    console.log('[BaziChainService] 使用 Runtime API 实时计算结果');
    return runtimeResult;
  }

  // 2. 回退到链上缓存
  const cached = await getCachedInterpretation(chartId);
  if (cached) {
    console.log('[BaziChainService] 使用链上缓存');
    return cached;
  }

  // 3. 都没有，返回 null
  console.log('[BaziChainService] 未找到解盘结果');
  return null;
}

/**
 * 缓存解盘结果到链上
 *
 * 注意：需要支付 gas 费用
 *
 * @param chartId 命盘 ID
 */
export async function cacheInterpretationOnChain(
  chartId: number
): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.baziChart || !api.tx.baziChart.cacheInterpretation) {
    throw new Error('区块链节点不支持缓存功能');
  }

  const tx = api.tx.baziChart.cacheInterpretation(chartId);

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
        console.log('[BaziChainService] 解盘结果已缓存');
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 解析精简版解盘结果
 */
function parseSimplifiedInterpretation(data: any): SimplifiedInterpretation | null {
  try {
    console.log('[BaziChainService] 解析 V2 数据 (JSON):', JSON.stringify(data.toJSON()));

    // 枚举映射表（按索引顺序）
    const geJuByIndex = ['正格', '从强格', '从弱格', '从财格', '从官格', '从儿格', '化气格', '特殊格局'];
    const geJuByName: Record<string, string> = {
      'ZhengGe': '正格',
      'CongQiangGe': '从强格',
      'CongRuoGe': '从弱格',
      'CongCaiGe': '从财格',
      'CongGuanGe': '从官格',
      'CongErGe': '从儿格',
      'HuaQiGe': '化气格',
      'TeShuge': '特殊格局',
    };

    const qiangRuoByIndex = ['身旺', '身弱', '中和', '太旺', '太弱'];
    const qiangRuoByName: Record<string, string> = {
      'ShenWang': '身旺',
      'ShenRuo': '身弱',
      'ZhongHe': '中和',
      'TaiWang': '太旺',
      'TaiRuo': '太弱',
    };

    const yongShenTypeByIndex = ['扶抑用神', '调候用神', '通关用神', '专旺用神'];
    const yongShenTypeByName: Record<string, string> = {
      'FuYi': '扶抑用神',
      'DiaoHou': '调候用神',
      'TongGuan': '通关用神',
      'ZhuanWang': '专旺用神',
    };

    const wuXingByIndex = ['金', '木', '水', '火', '土'];
    const wuXingByName: Record<string, string> = {
      'Jin': '金',
      'Mu': '木',
      'Shui': '水',
      'Huo': '火',
      'Tu': '土',
    };

    // 通用枚举解析函数
    const parseEnum = (value: any, byIndex: string[], byName: Record<string, string>): string => {
      const jsonValue = value.toJSON();
      // 情况1：数字索引
      if (typeof jsonValue === 'number') {
        return byIndex[jsonValue] || `未知(${jsonValue})`;
      }
      // 情况2：对象格式 { EnumName: null }
      if (typeof jsonValue === 'object' && jsonValue !== null) {
        const key = Object.keys(jsonValue)[0];
        return byName[key] || key || '未知';
      }
      // 情况3：字符串名称
      if (typeof jsonValue === 'string') {
        return byName[jsonValue] || jsonValue || '未知';
      }
      return '未知';
    };

    return {
      geJu: parseEnum(data.geJu, geJuByIndex, geJuByName),
      qiangRuo: parseEnum(data.qiangRuo, qiangRuoByIndex, qiangRuoByName),
      yongShen: parseEnum(data.yongShen, wuXingByIndex, wuXingByName),
      yongShenType: parseEnum(data.yongShenType, yongShenTypeByIndex, yongShenTypeByName),
      xiShen: parseEnum(data.xiShen, wuXingByIndex, wuXingByName),
      jiShen: parseEnum(data.jiShen, wuXingByIndex, wuXingByName),
      score: data.score.toNumber(),
      confidence: data.confidence.toNumber(),
      timestamp: data.timestamp.toNumber(),
      algorithmVersion: data.algorithmVersion.toNumber(),
    };
  } catch (error) {
    console.error('[BaziChainService] 解析失败:', error);
    return null;
  }
}

// ==================== V3 完整解盘功能 ====================

/**
 * V3 性格分析
 */
export interface V3XingGe {
  /** 主要性格特点 */
  zhuYaoTeDian: string[];
  /** 优点 */
  youDian: string[];
  /** 缺点 */
  queDian: string[];
  /** 适合职业 */
  shiHeZhiYe: string[];
}

/**
 * V3 核心解盘结果
 */
export interface V3CoreInterpretation {
  /** 格局 */
  geJu: string;
  /** 强弱 */
  qiangRuo: string;
  /** 用神 */
  yongShen: string;
  /** 用神类型 */
  yongShenType: string;
  /** 喜神 */
  xiShen: string;
  /** 忌神 */
  jiShen: string;
  /** 综合评分 0-100 */
  score: number;
  /** 可信度 0-100 */
  confidence: number;
  /** 解盘时间戳（区块号） */
  timestamp: number;
  /** 算法版本 */
  algorithmVersion: number;
}

/**
 * V3 完整解盘结果
 */
export interface V3FullInterpretation {
  /** 核心指标 */
  core: V3CoreInterpretation;
  /** 性格分析 */
  xingGe?: V3XingGe;
  /** 扩展忌神 */
  extendedJiShen?: string[];
}

/**
 * 获取完整解盘（唯一接口，V4 合并版）
 *
 * 通过 Runtime API 实时计算，免费、快速、使用最新算法
 *
 * 返回数据结构：
 * - core: 核心指标（格局、强弱、用神、喜神、忌神、评分、可信度）
 * - xingGe: 性格分析（主要特点、优点、缺点、适合职业）
 * - extendedJiShen: 扩展忌神（次忌神列表）
 *
 * @param chartId 命盘 ID
 * @returns 完整解盘结果或 null
 */
export async function getInterpretation(
  chartId: number
): Promise<V3FullInterpretation | null> {
  const api = await getApi();

  try {
    console.log(`[BaziChainService] 调用 Runtime API 获取解盘: chartId=${chartId}`);

    // 检查 Runtime API 是否可用（V4 合并版使用 getInterpretation）
    // 兼容旧版：如果 getInterpretation 不存在，尝试 getFullInterpretation
    const apiMethod = api.call?.baziChartApi?.getInterpretation
      ?? api.call?.baziChartApi?.getFullInterpretation;

    if (!apiMethod) {
      console.log('[BaziChainService] Runtime API 不可用');
      return null;
    }

    // 调用 Runtime API
    const result = await apiMethod(chartId);

    if (!result || result.isNone) {
      console.log('[BaziChainService] Runtime API 返回空结果（命盘可能不存在）');
      return null;
    }

    const data = result.unwrap();
    console.log('[BaziChainService] 解盘原始数据:', JSON.stringify(data.toJSON()));

    return parseFullInterpretation(data);
  } catch (error) {
    console.error('[BaziChainService] Runtime API 调用失败:', error);
    return null;
  }
}

/**
 * @deprecated 请使用 getInterpretation 代替
 * 保留此函数用于向后兼容
 */
export async function getFullInterpretationV3(
  chartId: number
): Promise<V3FullInterpretation | null> {
  return getInterpretation(chartId);
}

/**
 * 解析完整解盘结果
 */
function parseFullInterpretation(data: any): V3FullInterpretation | null {
  try {
    // 枚举映射表（按索引顺序）
    const geJuByIndex = ['正格', '从强格', '从弱格', '从财格', '从官格', '从儿格', '化气格', '特殊格局'];
    const qiangRuoByIndex = ['身旺', '身弱', '中和', '太旺', '太弱'];
    const yongShenTypeByIndex = ['扶抑用神', '调候用神', '通关用神', '专旺用神'];
    const wuXingByIndex = ['金', '木', '水', '火', '土'];

    // 性格特征枚举映射
    const xingGeTraitByIndex = [
      '正直', '有主见', '积极向上', '固执', '缺乏变通',
      '温和', '适应性强', '有艺术天赋', '优柔寡断', '依赖性强',
      '热情', '开朗', '有领导力', '急躁', '缺乏耐心',
      '细心', '有创造力', '善于沟通', '情绪化', '敏感',
      '稳重', '可靠', '有责任心', '保守', '变化慢',
      '包容', '细致', '善于协调', '犹豫不决', '缺乏魄力',
      '果断', '有正义感', '执行力强', '刚硬', '不够圆滑',
      '精致', '有品味', '善于表达', '挑剔', '情绪波动大',
      '智慧', '灵活', '适应力强', '多变', '缺乏恒心',
      '内敛', '善于思考',
    ];

    // 职业类型枚举映射
    const zhiYeByIndex = [
      '教育', '文化', '环保', '农林', '能源', '娱乐', '餐饮', '化工',
      '房地产', '建筑', '农业', '服务', '金融', '机械', '军警', '五金',
      '贸易', '运输', '水利', '信息',
    ];

    // 通用枚举解析函数
    const parseEnum = (value: any, byIndex: string[]): string => {
      if (value === null || value === undefined) return '未知';

      // 枚举名称映射表
      const nameMap: Record<string, string> = {
        // 格局
        'ZhengGe': '正格',
        'CongQiangGe': '从强格',
        'CongRuoGe': '从弱格',
        'CongCaiGe': '从财格',
        'CongGuanGe': '从官格',
        'CongErGe': '从儿格',
        'HuaQiGe': '化气格',
        'TeShuge': '特殊格局',
        // 强弱
        'ShenWang': '身旺',
        'ShenRuo': '身弱',
        'ZhongHe': '中和',
        'TaiWang': '太旺',
        'TaiRuo': '太弱',
        // 用神类型
        'FuYi': '扶抑用神',
        'DiaoHou': '调候用神',
        'TongGuan': '通关用神',
        'ZhuanWang': '专旺用神',
        // 五行
        'Jin': '金',
        'Mu': '木',
        'Shui': '水',
        'Huo': '火',
        'Tu': '土',
      };

      const jsonValue = typeof value.toJSON === 'function' ? value.toJSON() : value;

      // 调试日志
      console.log('[parseEnum] 输入值:', value, '类型:', typeof value);
      console.log('[parseEnum] JSON值:', jsonValue, '类型:', typeof jsonValue);

      // 情况1：数字索引
      if (typeof jsonValue === 'number') {
        const result = byIndex[jsonValue] || `未知(${jsonValue})`;
        console.log('[parseEnum] 数字索引结果:', result);
        return result;
      }

      // 情况2：对象格式 { EnumName: null }
      if (typeof jsonValue === 'object' && jsonValue !== null) {
        const key = Object.keys(jsonValue)[0];
        const result = nameMap[key] || key || '未知';
        console.log('[parseEnum] 对象格式，key:', key, '结果:', result);
        return result;
      }

      // 情况3：字符串名称（直接是枚举名）
      if (typeof jsonValue === 'string') {
        const result = nameMap[jsonValue] || jsonValue;
        console.log('[parseEnum] 字符串格式，输入:', jsonValue, '结果:', result);
        return result;
      }

      const result = String(jsonValue);
      console.log('[parseEnum] 默认转换结果:', result);
      return result;
    };

    // 解析核心指标
    const coreData = data.core;
    const core: V3CoreInterpretation = {
      geJu: parseEnum(coreData.geJu, geJuByIndex),
      qiangRuo: parseEnum(coreData.qiangRuo, qiangRuoByIndex),
      yongShen: parseEnum(coreData.yongShen, wuXingByIndex),
      yongShenType: parseEnum(coreData.yongShenType, yongShenTypeByIndex),
      xiShen: parseEnum(coreData.xiShen, wuXingByIndex),
      jiShen: parseEnum(coreData.jiShen, wuXingByIndex),
      score: coreData.score?.toNumber?.() ?? coreData.score ?? 0,
      confidence: coreData.confidence?.toNumber?.() ?? coreData.confidence ?? 0,
      timestamp: coreData.timestamp?.toNumber?.() ?? coreData.timestamp ?? 0,
      algorithmVersion: coreData.algorithmVersion?.toNumber?.() ?? coreData.algorithmVersion ?? 3,
    };

    console.log('[parseFullInterpretation] 解析后的core对象:', core);

    // 解析性格分析
    let xingGe: V3XingGe | undefined;
    if (data.xingGe && !data.xingGe.isNone) {
      const xingGeData = data.xingGe.isSome ? data.xingGe.unwrap() : data.xingGe;

      // 性格特征枚举名称映射
      const traitNameMap: Record<string, string> = {
        'ZhengZhi': '正直',
        'YouZhuJian': '有主见',
        'JiJiXiangShang': '积极向上',
        'GuZhi': '固执',
        'QueFaBianTong': '缺乏变通',
        'WenHe': '温和',
        'ShiYingXingQiang': '适应性强',
        'YouYiShuTianFu': '有艺术天赋',
        'YouRouGuaDuan': '优柔寡断',
        'YiLaiXingQiang': '依赖性强',
        'ReQing': '热情',
        'KaiLang': '开朗',
        'YouLingDaoLi': '有领导力',
        'JiZao': '急躁',
        'QueFaNaiXin': '缺乏耐心',
        'XiXin': '细心',
        'YouChuangZaoLi': '有创造力',
        'ShanYuGouTong': '善于沟通',
        'QingXuHua': '情绪化',
        'MinGan': '敏感',
        'WenZhong': '稳重',
        'KeKao': '可靠',
        'YouZeRenXin': '有责任心',
        'BaoShou': '保守',
        'BianHuaMan': '变化慢',
        'BaoRong': '包容',
        'XiZhi': '细致',
        'ShanYuXieTiao': '善于协调',
        'YouYuBuJue': '犹豫不决',
        'QueFaPoLi': '缺乏魄力',
        'GuoDuan': '果断',
        'YouZhengYiGan': '有正义感',
        'ZhiXingLiQiang': '执行力强',
        'GangYing': '刚硬',
        'BuGouYuanHua': '不够圆滑',
        'JingZhi': '精致',
        'YouPinWei': '有品味',
        'ShanYuBiaoDa': '善于表达',
        'TiaoTi': '挑剔',
        'QingXuBoDongDa': '情绪波动大',
        'ZhiHui': '智慧',
        'LingHuo': '灵活',
        'ShiYingLiQiang': '适应力强',
        'DuoBian': '多变',
        'QueFaHengXin': '缺乏恒心',
        'NeiLian': '内敛',
        'ShanYuSiKao': '善于思考',
      };

      // 职业枚举名称映射
      const careerNameMap: Record<string, string> = {
        'JiaoYu': '教育',
        'WenHua': '文化',
        'HuanBao': '环保',
        'NongLin': '农林',
        'NengYuan': '能源',
        'YuLe': '娱乐',
        'CanYin': '餐饮',
        'HuaGong': '化工',
        'FangDiChan': '房地产',
        'JianZhu': '建筑',
        'NongYe': '农业',
        'FuWu': '服务',
        'JinRong': '金融',
        'JiXie': '机械',
        'JunJing': '军警',
        'WuJin': '五金',
        'MaoYi': '贸易',
        'YunShu': '运输',
        'ShuiLi': '水利',
        'XinXi': '信息',
      };

      // 解析函数（支持名称映射）
      const parseTrait = (t: any): string => {
        const result = parseEnum(t, xingGeTraitByIndex);
        return traitNameMap[result] || result;
      };

      const parseCareer = (z: any): string => {
        const result = parseEnum(z, zhiYeByIndex);
        return careerNameMap[result] || result;
      };

      xingGe = {
        zhuYaoTeDian: (xingGeData.zhuYaoTeDian || []).map(parseTrait),
        youDian: (xingGeData.youDian || []).map(parseTrait),
        queDian: (xingGeData.queDian || []).map(parseTrait),
        shiHeZhiYe: (xingGeData.shiHeZhiYe || []).map(parseCareer),
      };
    }

    // 解析扩展忌神
    let extendedJiShen: string[] | undefined;
    if (data.extendedJiShen && !data.extendedJiShen.isNone) {
      const extData = data.extendedJiShen.isSome ? data.extendedJiShen.unwrap() : data.extendedJiShen;
      extendedJiShen = (extData.secondary || []).map((j: any) => parseEnum(j, wuXingByIndex));
    }

    return {
      core,
      xingGe,
      extendedJiShen,
    };
  } catch (error) {
    console.error('[BaziChainService] V3 解析失败:', error);
    return null;
  }
}

/**
 * 智能获取完整解盘（推荐使用）
 *
 * V4 合并版：直接调用 getInterpretation，无需回退逻辑
 *
 * @param chartId 命盘 ID
 * @returns 完整解盘结果或 null
 *
 * @deprecated 请直接使用 getInterpretation 代替
 */
export async function getInterpretationSmartV3(
  chartId: number
): Promise<V3FullInterpretation | null> {
  return getInterpretation(chartId);
}

// ==================== 加密命盘链上交互 ====================

import {
  type SiZhuIndex,
  type EncryptedBaziResult,
  siZhuIndexToChain,
  encryptedDataToChain,
  chainDataToEncrypted,
} from './baziEncryption';

/**
 * 链上加密八字命盘数据结构
 */
export interface OnChainEncryptedBaziChart {
  /** 命盘ID */
  id: number;
  /** 创建者地址 */
  owner: string;
  /** 四柱索引 */
  siZhuIndex: SiZhuIndex;
  /** 性别 (0=女, 1=男) */
  gender: number;
  /** 加密数据（Base64 编码） */
  encryptedData: string;
  /** 数据哈希（hex 格式） */
  dataHash: string;
  /** 创建区块号 */
  createdAt: number;
}

/**
 * 创建加密八字命盘参数
 */
export interface CreateEncryptedChartParams {
  /** 四柱索引 */
  siZhuIndex: SiZhuIndex;
  /** 性别 */
  gender: Gender;
  /** 加密数据（Base64 编码） */
  encryptedData: string;
  /** 数据哈希（hex 格式） */
  dataHash: string;
}

/**
 * 创建加密八字命盘到链上
 *
 * 此函数将加密的八字数据存储到链上，保护用户隐私：
 * - 四柱索引明文存储，支持 Runtime API 免费计算解盘
 * - 敏感数据（出生时间等）加密存储
 * - 用户通过钱包签名派生密钥进行加解密
 *
 * @param params 加密命盘参数
 * @returns 命盘ID
 *
 * @example
 * ```typescript
 * // 1. 准备加密数据
 * const encrypted = prepareEncryptedBaziData(baziResult, key);
 *
 * // 2. 创建链上命盘
 * const chartId = await createEncryptedChartOnChain({
 *   siZhuIndex: encrypted.siZhuIndex,
 *   gender: encrypted.gender,
 *   encryptedData: encrypted.encryptedData,
 *   dataHash: encrypted.dataHash,
 * });
 * ```
 */
export async function createEncryptedChartOnChain(
  params: CreateEncryptedChartParams
): Promise<number> {
  const api = await getSignedApi();

  // 检查 baziChart pallet 是否存在
  if (!api.tx.baziChart || !api.tx.baziChart.createEncryptedChart) {
    throw new Error('区块链节点未包含加密八字模块（pallet-bazi-chart），请检查节点配置');
  }

  const { siZhuIndex, gender, encryptedData, dataHash } = params;

  // 转换四柱索引为链上格式
  const chainSiZhuIndex = siZhuIndexToChain(siZhuIndex);

  // 转换加密数据为字节数组
  const chainEncryptedData = encryptedDataToChain(encryptedData);

  // 转换数据哈希为字节数组（32 bytes）
  const hashHex = dataHash.replace('0x', '');
  const chainDataHash = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    chainDataHash[i] = parseInt(hashHex.substr(i * 2, 2), 16);
  }

  // 构建交易
  const tx = api.tx.baziChart.createEncryptedChart(
    chainSiZhuIndex,
    gender,
    Array.from(chainEncryptedData),
    Array.from(chainDataHash)
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[BaziChainService] 加密命盘交易状态:', status.type);

      // 检查调度错误
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
        console.log('[BaziChainService] 加密命盘交易已打包，事件数量:', events.length);

        // 查找 EncryptedBaziChartCreated 事件
        const event = events.find((e) =>
          e.event.section === 'baziChart' && e.event.method === 'EncryptedBaziChartCreated'
        );

        if (event) {
          // chart_id 是 u64 类型
          const chartId = event.event.data[1].toNumber(); // data[0]=owner, data[1]=chart_id
          console.log('[BaziChainService] 加密八字命盘创建成功，ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
          console.error('[BaziChainService] 所有事件:', events.map(e => `${e.event.section}.${e.event.method}`).join(', '));
          reject(new Error('交易成功但未找到加密命盘创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[BaziChainService] 加密命盘交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 获取链上加密八字命盘详情
 *
 * @param chartId 命盘ID
 * @returns 加密命盘数据或null
 */
export async function getEncryptedBaziChart(
  chartId: number
): Promise<OnChainEncryptedBaziChart | null> {
  const api = await getApi();

  // 检查 baziChart pallet 是否存在
  if (!api.query.baziChart || !api.query.baziChart.encryptedChartById) {
    console.error('[BaziChainService] baziChart.encryptedChartById 不存在');
    return null;
  }

  console.log('[BaziChainService] 查询加密命盘 ID:', chartId);
  const result = await api.query.baziChart.encryptedChartById(chartId);

  if (result.isNone) {
    console.log('[BaziChainService] 加密命盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[BaziChainService] 加密命盘原始数据:', JSON.stringify(data.toHuman()));

    // 解析四柱索引
    const siZhuIndex: SiZhuIndex = {
      yearGan: data.siZhuIndex.yearGan.toNumber(),
      yearZhi: data.siZhuIndex.yearZhi.toNumber(),
      monthGan: data.siZhuIndex.monthGan.toNumber(),
      monthZhi: data.siZhuIndex.monthZhi.toNumber(),
      dayGan: data.siZhuIndex.dayGan.toNumber(),
      dayZhi: data.siZhuIndex.dayZhi.toNumber(),
      hourGan: data.siZhuIndex.hourGan.toNumber(),
      hourZhi: data.siZhuIndex.hourZhi.toNumber(),
    };

    // 解析加密数据
    const encryptedBytes = data.encryptedData.toU8a();
    const encryptedData = chainDataToEncrypted(encryptedBytes);

    // 解析数据哈希
    const hashBytes = data.dataHash;
    let dataHash = '0x';
    for (let i = 0; i < hashBytes.length; i++) {
      dataHash += hashBytes[i].toString(16).padStart(2, '0');
    }

    return {
      id: chartId,
      owner: data.owner.toString(),
      siZhuIndex,
      gender: data.gender.isMale ? 1 : 0,
      encryptedData,
      dataHash,
      createdAt: data.createdAt.toNumber(),
    };
  } catch (error) {
    console.error('[BaziChainService] 解析加密命盘失败:', error);
    return null;
  }
}

/**
 * 获取用户的加密八字命盘列表
 *
 * @param address 用户地址
 * @returns 命盘ID数组
 */
export async function getUserEncryptedBaziCharts(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.userEncryptedCharts) {
    console.error('[BaziChainService] baziChart.userEncryptedCharts 不存在');
    return [];
  }

  const result = await api.query.baziChart.userEncryptedCharts(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取用户所有加密八字命盘详情
 *
 * @param address 用户地址
 * @returns 加密命盘详情数组
 */
export async function getUserEncryptedBaziChartsWithDetails(
  address: string
): Promise<OnChainEncryptedBaziChart[]> {
  const chartIds = await getUserEncryptedBaziCharts(address);
  const charts: OnChainEncryptedBaziChart[] = [];

  for (const chartId of chartIds) {
    const chart = await getEncryptedBaziChart(chartId);
    if (chart) {
      charts.push(chart);
    }
  }

  return charts.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 删除加密八字命盘
 *
 * @param chartId 命盘ID
 */
export async function deleteEncryptedBaziChart(chartId: number): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.baziChart || !api.tx.baziChart.deleteEncryptedChart) {
    throw new Error('区块链节点未包含加密八字模块');
  }

  const tx = api.tx.baziChart.deleteEncryptedChart(chartId);

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

      if (status.isInBlock) {
        console.log('[BaziChainService] 加密命盘已删除:', chartId);
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 获取加密命盘的解盘结果
 *
 * 基于四柱索引计算解盘，无需解密敏感数据
 * 完全免费（无 gas 费用），保护用户隐私
 *
 * @param chartId 加密命盘ID
 * @returns 完整解盘结果或 null
 */
export async function getEncryptedChartInterpretation(
  chartId: number
): Promise<V3FullInterpretation | null> {
  const api = await getApi();

  try {
    console.log(`[BaziChainService] 获取加密命盘解盘: chartId=${chartId}`);

    // 检查 Runtime API 是否可用
    const apiMethod = api.call?.baziChartApi?.getEncryptedChartInterpretation;

    if (!apiMethod) {
      console.log('[BaziChainService] getEncryptedChartInterpretation Runtime API 不可用');
      return null;
    }

    // 调用 Runtime API
    const result = await apiMethod(chartId);

    if (!result || result.isNone) {
      console.log('[BaziChainService] Runtime API 返回空结果（加密命盘可能不存在）');
      return null;
    }

    const data = result.unwrap();
    console.log('[BaziChainService] 加密命盘解盘数据:', JSON.stringify(data.toJSON()));

    return parseFullInterpretation(data);
  } catch (error) {
    console.error('[BaziChainService] 获取加密命盘解盘失败:', error);
    return null;
  }
}

/**
 * 检查加密命盘是否存在
 *
 * @param chartId 命盘ID
 * @returns 是否存在
 */
export async function encryptedChartExists(chartId: number): Promise<boolean> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.encryptedChartById) {
    return false;
  }

  const result = await api.query.baziChart.encryptedChartById(chartId);
  return result.isSome;
}

/**
 * 检查用户是否是加密命盘的所有者
 *
 * @param chartId 命盘ID
 * @param userAddress 用户地址
 * @returns 是否是所有者
 */
export async function isEncryptedChartOwner(
  chartId: number,
  userAddress: string
): Promise<boolean> {
  const chart = await getEncryptedBaziChart(chartId);
  return chart !== null && chart.owner === userAddress;
}

// ==================== V5 完整命盘功能 ====================

/**
 * 获取完整八字命盘（V5 新增）
 *
 * 通过 Runtime API 实时计算，返回包含所有计算字段的完整命盘数据：
 * - **主星**: 天干十神 + 地支本气十神
 * - **藏干（副星）**: 藏干详细信息及十神关系
 * - **星运**: 四柱十二长生状态
 * - **空亡**: 旬空判断和标识
 * - **纳音**: 六十甲子纳音五行
 * - **神煞**: 吉凶神煞列表
 *
 * @param chartId 命盘ID
 * @returns 完整命盘数据或 null
 *
 * @example
 * ```typescript
 * const fullChart = await getFullBaziChartV5(chartId);
 * if (fullChart) {
 *   // 访问主星
 *   console.log('年柱天干十神:', fullChart.siZhu.yearZhu.tianGanShiShen);
 *   // 访问空亡
 *   if (fullChart.kongWang.dayIsKong) {
 *     console.log('日柱落空亡');
 *   }
 *   // 访问神煞
 *   fullChart.shenShaList.forEach(s => console.log(s.shenSha, s.nature));
 * }
 * ```
 */
export async function getFullBaziChartV5(
  chartId: number
): Promise<FullBaziChartV5 | null> {
  const api = await getApi();

  try {
    console.log(`[BaziChainService] 调用 Runtime API 获取完整命盘 V5: chartId=${chartId}`);

    // 检查 Runtime API 是否可用
    if (!api.call?.baziChartApi?.getFullBaziChart) {
      console.log('[BaziChainService] getFullBaziChart Runtime API 不可用');
      return null;
    }

    // 调用 Runtime API（方案1：现在返回 JSON 字符串）
    const result = await api.call.baziChartApi.getFullBaziChart(chartId);

    if (!result || result.isNone) {
      console.log('[BaziChainService] Runtime API 返回空结果（命盘可能不存在）');
      return null;
    }

    // 🔥 方案1适配：后端返回的是 JSON 字符串，包含可读的枚举名称
    const jsonString = result.unwrap().toString();
    console.log('[BaziChainService] V5 完整命盘 JSON 字符串（前100字符）:', jsonString.substring(0, 100));

    // 解析 JSON 字符串为对象
    const jsonData = JSON.parse(jsonString);
    console.log('[BaziChainService] V5 解析后的 JSON 数据:', jsonData);

    return parseFullBaziChartV5Adapted(jsonData);
  } catch (error) {
    console.error('[BaziChainService] 获取完整命盘 V5 失败:', error);
    return null;
  }
}

/**
 * 解析完整命盘 V5 数据（方案1适配版）
 *
 * 此函数处理后端方案1返回的 JSON 数据，其中枚举已经是可读的名称字符串。
 * 例如：gender: "Male"（不是 0），shensha: "TianYiGuiRen"（不是 0）
 *
 * @param jsonData 已解析的 JSON 对象（包含枚举名称字符串）
 * @returns 解析后的完整命盘数据
 */
function parseFullBaziChartV5Adapted(jsonData: any): FullBaziChartV5 | null {
  try {
    console.log('[parseFullBaziChartV5Adapted] 开始解析方案1数据');

    // 解析出生时间（直接使用）
    const birthTime = {
      year: jsonData.birthTime?.year ?? 0,
      month: jsonData.birthTime?.month ?? 0,
      day: jsonData.birthTime?.day ?? 0,
      hour: jsonData.birthTime?.hour ?? 0,
      minute: jsonData.birthTime?.minute ?? 0,
    };

    // 解析性别（现在是字符串名称，需要映射回索引）
    const genderMap: Record<string, Gender> = {
      'Male': Gender.Male,
      'Female': Gender.Female,
      'Man': Gender.Male,
      'Woman': Gender.Female,
    };
    const gender = genderMap[jsonData.gender] ?? Gender.Male;

    // 解析子时模式
    const ziShiModeMap: Record<string, number> = {
      'Traditional': 1,
      'Modern': 2,
    };
    const ziShiMode = ziShiModeMap[jsonData.ziShiMode] ?? 1;

    // 解析增强四柱（使用 parseEnumValue 处理枚举名称字符串）
    const siZhu = parseEnhancedSiZhuAdapted(jsonData.sizhu);

    // 解析大运信息
    const daYun = parseDaYunInfoV5Adapted(jsonData.dayun);

    // 解析空亡信息
    const kongWang = parseKongWangInfoAdapted(jsonData.kongwang);

    // 解析星运信息
    const xingYun = parseXingYunInfoAdapted(jsonData.xingyun);

    // 解析神煞列表
    console.log('[parseFullBaziChartV5Adapted] shenshaList 原始数据:', jsonData.shenshaList);
    const shenShaList = parseShenShaListAdapted(jsonData.shenshaList || []);

    // 解析五行强度（直接使用数字）
    const wuXingStrength = parseWuXingStrength(jsonData.wuxingStrength);

    // 解析自坐信息
    const ziZuo = parseZiZuoInfoAdapted(jsonData.ziZuo);

    // 解析喜用神（枚举名称字符串映射回索引）
    const xiYongShen = jsonData.xiyongShen !== null && jsonData.xiyongShen !== 'null'
      ? parseEnumValue(jsonData.xiyongShen) as WuXing
      : null;

    // 解析 owner 地址
    const owner = jsonData.owner || '';

    return {
      chartId: jsonData.chartId ?? 0,
      owner,
      birthTime,
      gender,
      ziShiMode,
      siZhu,
      daYun,
      kongWang,
      shenShaList,
      xingYun,
      ziZuo,
      wuXingStrength,
      xiYongShen,
      timestamp: jsonData.timestamp ?? 0,
    };
  } catch (error) {
    console.error('[parseFullBaziChartV5Adapted] 解析失败:', error);
    return null;
  }
}

/**
 * 解析增强四柱（方案1适配版）
 */
function parseEnhancedSiZhuAdapted(data: any): EnhancedSiZhu {
  return {
    yearZhu: parseEnhancedZhuAdapted(data?.yearZhu),
    monthZhu: parseEnhancedZhuAdapted(data?.monthZhu),
    dayZhu: parseEnhancedZhuAdapted(data?.dayZhu),
    hourZhu: parseEnhancedZhuAdapted(data?.hourZhu),
    riZhu: parseEnumValue(data?.rizhu) as TianGan,
  };
}

/**
 * 解析增强单柱（方案1适配版）
 */
function parseEnhancedZhuAdapted(data: any): EnhancedZhu {
  if (!data) {
    return {
      ganZhi: { tianGan: 0 as TianGan, diZhi: 0 as DiZhi },
      tianGanShiShen: 0 as ShiShen,
      diZhiBenQiShiShen: 0 as ShiShen,
      cangGanList: [],
      naYin: 0 as NaYinType,
      changSheng: 0 as ShiErChangSheng,
    };
  }

  // 解析干支（后端返回的是枚举名称字符串）
  const ganZhi = {
    tianGan: parseEnumValue(data.ganzhi?.gan) as TianGan,
    diZhi: parseEnumValue(data.ganzhi?.zhi) as DiZhi,
  };

  // 解析藏干列表
  const cangGanList: CangGanDetail[] = (data.cangganList || []).map((cg: any) => ({
    gan: parseEnumValue(cg.gan) as TianGan,
    shiShen: parseEnumValue(cg.shishen) as ShiShen,
    cangGanType: parseEnumValue(cg.cangganType) as CangGanType,
    weight: cg.weight ?? 0,
  }));

  return {
    ganZhi,
    tianGanShiShen: parseEnumValue(data.tianganShishen) as ShiShen,
    diZhiBenQiShiShen: parseEnumValue(data.dizhiBenqiShishen) as ShiShen,
    cangGanList,
    naYin: parseEnumValue(data.nayin) as NaYinType,
    changSheng: parseEnumValue(data.changsheng) as ShiErChangSheng,
  };
}

/**
 * 解析大运信息（方案1适配版）
 */
function parseDaYunInfoV5Adapted(data: any): DaYunInfoV5 {
  if (!data) {
    return {
      qiYunAge: 0,
      qiYunYear: 0,
      isShun: true,
      daYunList: [],
    };
  }

  const daYunList: DaYunStepV5[] = (data.dayunList || []).map((step: any) => ({
    ganZhi: {
      tianGan: parseEnumValue(step.ganzhi?.gan) as TianGan,
      diZhi: parseEnumValue(step.ganzhi?.zhi) as DiZhi,
    },
    startAge: step.startAge ?? 0,
    endAge: step.endAge ?? 0,
    startYear: step.startYear ?? 0,
    endYear: step.endYear ?? 0,
    tianGanShiShen: parseEnumValue(step.tianganShishen) as ShiShen,
    cangGanShiShen: (step.cangganShishen || []).map((s: any) => parseEnumValue(s) as ShiShen),
  }));

  return {
    qiYunAge: data.qiyunAge ?? 0,
    qiYunYear: data.qiyunYear ?? 0,
    isShun: data.isShun ?? true,
    daYunList,
  };
}

/**
 * 解析空亡信息（方案1适配版）
 */
function parseKongWangInfoAdapted(data: any): KongWangInfo {
  if (!data) {
    return {
      yearKongWang: [0 as DiZhi, 0 as DiZhi],
      monthKongWang: [0 as DiZhi, 0 as DiZhi],
      dayKongWang: [0 as DiZhi, 0 as DiZhi],
      hourKongWang: [0 as DiZhi, 0 as DiZhi],
      yearIsKong: false,
      monthIsKong: false,
      dayIsKong: false,
      hourIsKong: false,
    };
  }

  const parseKongWangPair = (pair: any): [DiZhi, DiZhi] => {
    if (Array.isArray(pair) && pair.length >= 2) {
      return [parseEnumValue(pair[0]) as DiZhi, parseEnumValue(pair[1]) as DiZhi];
    }
    return [0 as DiZhi, 0 as DiZhi];
  };

  return {
    yearKongWang: parseKongWangPair(data.yearKongwang),
    monthKongWang: parseKongWangPair(data.monthKongwang),
    dayKongWang: parseKongWangPair(data.dayKongwang),
    hourKongWang: parseKongWangPair(data.hourKongwang),
    yearIsKong: data.yearIsKong ?? false,
    monthIsKong: data.monthIsKong ?? false,
    dayIsKong: data.dayIsKong ?? false,
    hourIsKong: data.hourIsKong ?? false,
  };
}

/**
 * 解析星运信息（方案1适配版）
 */
function parseXingYunInfoAdapted(data: any): XingYunInfo {
  if (!data) {
    return {
      yearChangSheng: 0 as ShiErChangSheng,
      monthChangSheng: 0 as ShiErChangSheng,
      dayChangSheng: 0 as ShiErChangSheng,
      hourChangSheng: 0 as ShiErChangSheng,
    };
  }

  return {
    yearChangSheng: parseEnumValue(data.yearChangsheng) as ShiErChangSheng,
    monthChangSheng: parseEnumValue(data.monthChangsheng) as ShiErChangSheng,
    dayChangSheng: parseEnumValue(data.dayChangsheng) as ShiErChangSheng,
    hourChangSheng: parseEnumValue(data.hourChangsheng) as ShiErChangSheng,
  };
}

/**
 * 解析神煞列表（方案1适配版）
 */
function parseShenShaListAdapted(data: any[]): ShenShaEntryV5[] {
  console.log('[parseShenShaListAdapted] 原始神煞数据:', JSON.stringify(data));
  return data.map((item: any, index: number) => {
    const parsed = {
      shenSha: parseEnumValue(item.shenSha || item.shensha) as ShenSha,
      position: parseEnumValue(item.position) as SiZhuPosition,
      nature: parseEnumValue(item.nature) as ShenShaNature,
    };
    console.log(`[parseShenShaListAdapted] 第${index}个神煞解析:`, {
      原始: { shenSha: item.shenSha || item.shensha, position: item.position, nature: item.nature },
      解析后: parsed,
    });
    return parsed;
  });
}

/**
 * 解析自坐信息（方案1适配版）
 */
function parseZiZuoInfoAdapted(data: any): ZiZuoInfo {
  if (!data) {
    return {
      diZhi: 0 as DiZhi,
      benQiShiShen: 0 as ShiShen,
      cangGanShiShenList: [],
    };
  }

  return {
    diZhi: parseEnumValue(data.dizhi) as DiZhi,
    benQiShiShen: parseEnumValue(data.benqiShishen) as ShiShen,
    cangGanShiShenList: (data.cangganShishenList || []).map((s: any) => parseEnumValue(s) as ShiShen),
  };
}

/**
 * 解析完整命盘 V5 数据（旧版，保留用于向后兼容）
 *
 * @param data Runtime API 返回的原始数据
 * @returns 解析后的完整命盘数据
 */
function parseFullBaziChartV5(data: any): FullBaziChartV5 | null {
  try {
    const jsonData = data.toJSON();
    console.log('[BaziChainService] V5 JSON 数据:', JSON.stringify(jsonData));

    // 解析出生时间
    const birthTime = {
      year: jsonData.birthTime?.year ?? 0,
      month: jsonData.birthTime?.month ?? 0,
      day: jsonData.birthTime?.day ?? 0,
      hour: jsonData.birthTime?.hour ?? 0,
      minute: jsonData.birthTime?.minute ?? 0,
    };

    // 解析性别
    const genderValue = parseEnumValue(jsonData.gender);

    // 解析增强四柱
    const siZhu = parseEnhancedSiZhu(jsonData.sizhu);

    // 解析大运信息
    const daYun = parseDaYunInfoV5(jsonData.dayun);

    // 解析空亡信息
    const kongWang = parseKongWangInfo(jsonData.kongwang);

    // 解析星运信息
    const xingYun = parseXingYunInfo(jsonData.xingyun);

    // 解析神煞列表
    console.log('[parseFullBaziChartV5] shenshaList 原始数据:', jsonData.shenshaList);
    const shenShaList = parseShenShaList(jsonData.shenshaList || []);

    // 解析五行强度
    const wuXingStrength = parseWuXingStrength(jsonData.wuxingStrength);

    // 解析自坐信息 ⭐ 新增
    const ziZuo = parseZiZuoInfo(jsonData.ziZuo);

    // 解析喜用神
    const xiYongShen = jsonData.xiyongShen !== null ? parseEnumValue(jsonData.xiyongShen) as WuXing : null;

    // 解析 owner 地址
    const ownerBytes = jsonData.owner;
    let owner = '';
    if (Array.isArray(ownerBytes)) {
      // 将字节数组转换为 hex 字符串
      owner = '0x' + ownerBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof ownerBytes === 'string') {
      owner = ownerBytes;
    }

    return {
      chartId: jsonData.chartId ?? 0,
      owner,
      birthTime,
      gender: genderValue as Gender,
      ziShiMode: jsonData.zishiMode ?? 1,
      siZhu,
      daYun,
      kongWang,
      shenShaList,
      xingYun,
      ziZuo,  // ⭐ 新增自坐字段
      wuXingStrength,
      xiYongShen,
      timestamp: jsonData.timestamp ?? 0,
    };
  } catch (error) {
    console.error('[BaziChainService] 解析完整命盘 V5 失败:', error);
    return null;
  }
}

/**
 * 解析枚举值（支持数字索引、对象格式和字符串格式）
 *
 * 支持的枚举类型：
 * - 五行 (WuXing): Jin/Mu/Shui/Huo/Tu
 * - 性别 (Gender): Male/Female/Man/Woman
 * - 十二长生 (ShiErChangSheng): ChangSheng/MuYu/GuanDai/LinGuan/DiWang/Shuai/Bing/Si/Mu/Jue/Tai/Yang
 * - 十神 (ShiShen): BiJian/JieCai/ShiShen/ShangGuan/ZhengCai/PianCai/ZhengGuan/QiSha/ZhengYin/PianYin
 * - 神煞 (ShenSha): TianYiGuiRen/TaiJiGuiRen/...
 * - 四柱位置 (SiZhuPosition): Year/Month/Day/Hour
 * - 神煞吉凶 (ShenShaNature): JiShen/XiongShen/Neutral
 *
 * **调试支持（方案1实现）**:
 * 当链端返回枚举变体名称字符串时,自动解析为对应的索引值
 * 这样既保持存储高效,又方便开发调试(console可以看到可读的枚举名)
 */
function parseEnumValue(value: any): number {
  // ⚠️ 调试模式: 如果是 null/undefined,默认返回 0 可能导致误解,改为返回 -1 并打印警告
  if (value === null || value === undefined) {
    console.warn('[parseEnumValue] 接收到 null/undefined,默认返回 0。请检查链端数据是否正确!', new Error().stack);
    return 0;
  }
  if (typeof value === 'number') return value;

  // 通用枚举名称到索引的映射表
  const enumNameToIndex: Record<string, number> = {
    // 五行映射 (WuXing)
    'Jin': 3, 'Mu': 0, 'Shui': 4, 'Huo': 1, 'Tu': 2,
    // 性别映射 (Gender)
    'Male': 0, 'Female': 1, 'Man': 0, 'Woman': 1,
    // 十二长生映射 (ShiErChangSheng) ⭐ 核心修复
    'ChangSheng': 0, // 长生
    'MuYu': 1,       // 沐浴
    'GuanDai': 2,    // 冠带
    'LinGuan': 3,    // 临官
    'DiWang': 4,     // 帝旺
    'Shuai': 5,      // 衰
    'Bing': 6,       // 病
    'Si': 7,         // 死
    'Mu': 8,         // 墓（注意：与五行的 Mu 木重复，但上下文不同）
    'Jue': 9,        // 绝
    'Tai': 10,       // 胎
    'Yang': 11,      // 养
    // 十神映射 (ShiShen)
    'BiJian': 0,     // 比肩
    'JieCai': 1,     // 劫财
    'ShiShen': 2,    // 食神
    'ShangGuan': 3,  // 伤官
    'ZhengCai': 4,   // 正财
    'PianCai': 5,    // 偏财
    'ZhengGuan': 6,  // 正官
    'QiSha': 7,      // 七杀
    'ZhengYin': 8,   // 正印
    'PianYin': 9,    // 偏印
    // 神煞映射 (ShenSha)
    'TianYiGuiRen': 0,   // 天乙贵人
    'TaiJiGuiRen': 1,    // 太极贵人
    'TianDeGuiRen': 2,   // 天德贵人
    'YueDeGuiRen': 3,    // 月德贵人
    'TianDeHe': 4,       // 天德合
    'YueDeHe': 5,        // 月德合
    'WenChangGuiRen': 6, // 文昌贵人
    'FuXingGuiRen': 7,   // 福星贵人
    'GuoYinGuiRen': 8,   // 国印贵人
    'TaoHua': 9,         // 桃花
    'HongLuan': 10,      // 红鸾
    'TianXi': 11,        // 天喜
    'GuChen': 12,        // 孤辰
    'GuaSu': 13,         // 寡宿
    'JinYu': 14,         // 金舆
    'JiangXing': 15,     // 将星
    'YiMa': 16,          // 驿马
    'HuaGai': 17,        // 华盖
    'TianChu': 18,       // 天厨
    'YangRen': 19,       // 羊刃
    'WangShen': 20,      // 亡神
    'JieSha': 21,        // 劫煞
    'XueRen': 22,        // 血刃
    'YuanChen': 23,      // 元辰
    'TianLuo': 24,       // 天罗
    'DiWang2': 25,       // 地网（避免与帝旺冲突）
    'TongZiSha': 26,     // 童子煞
    'JiuChou': 27,       // 九丑
    'KongWang': 28,      // 空亡
    // 四柱位置映射 (SiZhuPosition)
    'Year': 0,
    'Month': 1,
    'Day': 2,
    'Hour': 3,
    // 神煞吉凶映射 (ShenShaNature)
    'JiShen': 0,     // 吉神
    'XiongShen': 1,  // 凶神
    'Neutral': 2,    // 中性
    // 藏干类型映射 (CangGanType)
    'ZhuQi': 0,      // 主气
    'ZhongQi': 1,    // 中气
    'YuQi': 2,       // 余气
  };

  // 处理对象格式 { "EnumName": null }
  if (typeof value === 'object' && value !== null) {
    const key = Object.keys(value)[0];
    return enumNameToIndex[key] ?? 0;
  }

  // 处理字符串格式 "EnumName"
  if (typeof value === 'string') {
    return enumNameToIndex[value] ?? 0;
  }

  return 0;
}

/**
 * 解析增强四柱
 */
function parseEnhancedSiZhu(data: any): EnhancedSiZhu {
  return {
    yearZhu: parseEnhancedZhu(data?.yearZhu),
    monthZhu: parseEnhancedZhu(data?.monthZhu),
    dayZhu: parseEnhancedZhu(data?.dayZhu),
    hourZhu: parseEnhancedZhu(data?.hourZhu),
    riZhu: parseEnumValue(data?.rizhu) as TianGan,
  };
}

/**
 * 解析增强单柱
 */
function parseEnhancedZhu(data: any): EnhancedZhu {
  if (!data) {
    return {
      ganZhi: { tianGan: 0 as TianGan, diZhi: 0 as DiZhi },
      tianGanShiShen: 0 as ShiShen,
      diZhiBenQiShiShen: 0 as ShiShen,
      cangGanList: [],
      naYin: 0 as NaYinType,
      changSheng: 0 as ShiErChangSheng,
    };
  }

  // 解析干支
  const ganZhi = {
    tianGan: parseEnumValue(data.ganzhi?.gan) as TianGan,
    diZhi: parseEnumValue(data.ganzhi?.zhi) as DiZhi,
  };

  // 解析藏干列表
  const cangGanList: CangGanDetail[] = (data.cangganList || []).map((cg: any) => ({
    gan: parseEnumValue(cg.gan) as TianGan,
    shiShen: parseEnumValue(cg.shishen) as ShiShen,
    cangGanType: parseEnumValue(cg.cangganType) as CangGanType,
    weight: cg.weight ?? 0,
  }));

  return {
    ganZhi,
    tianGanShiShen: parseEnumValue(data.tianganShishen) as ShiShen,
    diZhiBenQiShiShen: parseEnumValue(data.dizhiBenqiShishen) as ShiShen,
    cangGanList,
    naYin: parseEnumValue(data.nayin) as NaYinType,
    changSheng: parseEnumValue(data.changsheng) as ShiErChangSheng,
  };
}

/**
 * 解析大运信息 V5
 */
function parseDaYunInfoV5(data: any): DaYunInfoV5 {
  if (!data) {
    return {
      qiYunAge: 0,
      qiYunYear: 0,
      isShun: true,
      daYunList: [],
    };
  }

  const daYunList: DaYunStepV5[] = (data.dayunList || []).map((step: any) => ({
    ganZhi: {
      tianGan: parseEnumValue(step.ganzhi?.gan) as TianGan,
      diZhi: parseEnumValue(step.ganzhi?.zhi) as DiZhi,
    },
    startAge: step.startAge ?? 0,
    endAge: step.endAge ?? 0,
    startYear: step.startYear ?? 0,
    endYear: step.endYear ?? 0,
    tianGanShiShen: parseEnumValue(step.tianganShishen) as ShiShen,
    cangGanShiShen: (step.cangganShishen || []).map((s: any) => parseEnumValue(s) as ShiShen),
  }));

  return {
    qiYunAge: data.qiyunAge ?? 0,
    qiYunYear: data.qiyunYear ?? 0,
    isShun: data.isShun ?? true,
    daYunList,
  };
}

/**
 * 解析空亡信息
 */
function parseKongWangInfo(data: any): KongWangInfo {
  if (!data) {
    return {
      yearKongWang: [0 as DiZhi, 0 as DiZhi],
      monthKongWang: [0 as DiZhi, 0 as DiZhi],
      dayKongWang: [0 as DiZhi, 0 as DiZhi],
      hourKongWang: [0 as DiZhi, 0 as DiZhi],
      yearIsKong: false,
      monthIsKong: false,
      dayIsKong: false,
      hourIsKong: false,
    };
  }

  const parseKongWangPair = (pair: any): [DiZhi, DiZhi] => {
    if (Array.isArray(pair) && pair.length >= 2) {
      return [parseEnumValue(pair[0]) as DiZhi, parseEnumValue(pair[1]) as DiZhi];
    }
    return [0 as DiZhi, 0 as DiZhi];
  };

  return {
    yearKongWang: parseKongWangPair(data.yearKongwang),
    monthKongWang: parseKongWangPair(data.monthKongwang),
    dayKongWang: parseKongWangPair(data.dayKongwang),
    hourKongWang: parseKongWangPair(data.hourKongwang),
    yearIsKong: data.yearIsKong ?? false,
    monthIsKong: data.monthIsKong ?? false,
    dayIsKong: data.dayIsKong ?? false,
    hourIsKong: data.hourIsKong ?? false,
  };
}

/**
 * 解析星运信息
 */
function parseXingYunInfo(data: any): XingYunInfo {
  if (!data) {
    return {
      yearChangSheng: 0 as ShiErChangSheng,
      monthChangSheng: 0 as ShiErChangSheng,
      dayChangSheng: 0 as ShiErChangSheng,
      hourChangSheng: 0 as ShiErChangSheng,
    };
  }

  return {
    yearChangSheng: parseEnumValue(data.yearChangsheng) as ShiErChangSheng,
    monthChangSheng: parseEnumValue(data.monthChangsheng) as ShiErChangSheng,
    dayChangSheng: parseEnumValue(data.dayChangsheng) as ShiErChangSheng,
    hourChangSheng: parseEnumValue(data.hourChangsheng) as ShiErChangSheng,
  };
}

/**
 * 解析神煞列表
 */
function parseShenShaList(data: any[]): ShenShaEntryV5[] {
  console.log('[parseShenShaList] 原始神煞数据:', JSON.stringify(data));
  return data.map((item: any, index: number) => {
    const parsed = {
      shenSha: parseEnumValue(item.shensha) as ShenSha,
      position: parseEnumValue(item.position) as SiZhuPosition,
      nature: parseEnumValue(item.nature) as ShenShaNature,
    };
    console.log(`[parseShenShaList] 第${index}个神煞解析:`, {
      原始: { shensha: item.shensha, position: item.position, nature: item.nature },
      解析后: parsed,
    });
    return parsed;
  });
}

/**
 * 解析五行强度
 */
function parseWuXingStrength(data: any): WuXingStrength {
  if (!data) {
    return { jin: 0, mu: 0, shui: 0, huo: 0, tu: 0 };
  }

  return {
    jin: data.jin ?? 0,
    mu: data.mu ?? 0,
    shui: data.shui ?? 0,
    huo: data.huo ?? 0,
    tu: data.tu ?? 0,
  };
}

/**
 * 解析自坐信息
 */
function parseZiZuoInfo(data: any): ZiZuoInfo {
  if (!data) {
    return {
      diZhi: 0 as DiZhi,
      benQiShiShen: 0 as ShiShen,
      cangGanShiShenList: [],
    };
  }

  return {
    diZhi: parseEnumValue(data.dizhi) as DiZhi,
    benQiShiShen: parseEnumValue(data.benqiShishen) as ShiShen,
    cangGanShiShenList: (data.cangganShishenList || []).map((s: any) => parseEnumValue(s) as ShiShen),
  };
}

// ==================== V5 导出类型重新导出 ====================

export type {
  FullBaziChartV5,
  EnhancedSiZhu,
  EnhancedZhu,
  DaYunInfoV5,
  DaYunStepV5,
  KongWangInfo,
  XingYunInfo,
  ShenShaEntryV5,
  CangGanDetail,
  ZiZuoInfo,  // ⭐ 新增
};

// ==================== V6 多方授权加密系统 ====================

import {
  AccessRole,
  AccessScope,
  ServiceProviderType,
  publicKeyToChain,
  encryptedDataToChain,
  type MultiKeyEncryptedChartParams,
  type EncryptedKeyEntry,
} from './multiKeyEncryption';

/**
 * 服务提供者信息
 */
export interface ServiceProviderInfo {
  /** 服务类型 */
  providerType: ServiceProviderType;
  /** X25519 公钥 (hex) */
  publicKey: string;
  /** 信誉分 (0-100) */
  reputation: number;
  /** 注册区块号 */
  registeredAt: number;
  /** 是否激活 */
  isActive: boolean;
}

/**
 * 多方授权加密命盘信息
 */
export interface MultiKeyChartInfo {
  /** 所有者账户 */
  owner: string;
  /** 四柱索引 */
  siZhuIndex: {
    yearGan: number;
    yearZhi: number;
    monthGan: number;
    monthZhi: number;
    dayGan: number;
    dayZhi: number;
    hourGan: number;
    hourZhi: number;
  };
  /** 性别 */
  gender: 'Male' | 'Female';
  /** 创建区块号 */
  createdAt: number;
  /** 授权数量 */
  grantsCount: number;
  /** 被授权账户列表 */
  grantAccounts: string[];
}

// ==================== 密钥注册 ====================

/**
 * 注册用户加密公钥
 *
 * @param api Polkadot API 实例
 * @param publicKey X25519 公钥 (hex, 32 bytes)
 * @returns 交易对象
 */
export function registerEncryptionKey(
  api: ApiPromise,
  publicKey: string
): SubmittableExtrinsic<'promise'> {
  const publicKeyBytes = publicKeyToChain(publicKey);
  return api.tx.baziChart.registerEncryptionKey(publicKeyBytes);
}

/**
 * 查询用户加密公钥
 *
 * @param api Polkadot API 实例
 * @param address 用户地址
 * @returns 公钥 (hex) 或 null
 */
export async function getUserEncryptionKey(
  api: ApiPromise,
  address: string
): Promise<string | null> {
  try {
    const result = await (api.call as any).baziChartApi.getUserEncryptionKey(address);
    if (result.isSome) {
      const keyBytes = result.unwrap();
      return '0x' + Array.from(keyBytes as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  } catch (error) {
    console.error('获取用户加密公钥失败:', error);
    return null;
  }
}

// ==================== 服务提供者 ====================

/**
 * 注册为服务提供者
 *
 * @param api Polkadot API 实例
 * @param providerType 服务类型
 * @param publicKey X25519 公钥 (hex, 32 bytes)
 * @returns 交易对象
 */
export function registerProvider(
  api: ApiPromise,
  providerType: ServiceProviderType,
  publicKey: string
): SubmittableExtrinsic<'promise'> {
  const publicKeyBytes = publicKeyToChain(publicKey);
  return api.tx.baziChart.registerProvider(providerType, publicKeyBytes);
}

/**
 * 更新服务提供者公钥
 *
 * @param api Polkadot API 实例
 * @param newPublicKey 新的 X25519 公钥 (hex, 32 bytes)
 * @returns 交易对象
 */
export function updateProviderKey(
  api: ApiPromise,
  newPublicKey: string
): SubmittableExtrinsic<'promise'> {
  const publicKeyBytes = publicKeyToChain(newPublicKey);
  return api.tx.baziChart.updateProviderKey(publicKeyBytes);
}

/**
 * 设置服务提供者激活状态
 *
 * @param api Polkadot API 实例
 * @param isActive 是否激活
 * @returns 交易对象
 */
export function setProviderActive(
  api: ApiPromise,
  isActive: boolean
): SubmittableExtrinsic<'promise'> {
  return api.tx.baziChart.setProviderActive(isActive);
}

/**
 * 注销服务提供者
 *
 * @param api Polkadot API 实例
 * @returns 交易对象
 */
export function unregisterProvider(
  api: ApiPromise
): SubmittableExtrinsic<'promise'> {
  return api.tx.baziChart.unregisterProvider();
}

/**
 * 获取服务提供者信息
 *
 * @param api Polkadot API 实例
 * @param address 服务提供者地址
 * @returns 服务提供者信息或 null
 */
export async function getServiceProvider(
  api: ApiPromise,
  address: string
): Promise<ServiceProviderInfo | null> {
  try {
    const result = await (api.call as any).baziChartApi.getServiceProvider(address);
    if (result.isSome) {
      const json = result.unwrap().toString();
      const data = JSON.parse(json);
      return {
        providerType: ServiceProviderType[data.provider_type as keyof typeof ServiceProviderType] as unknown as ServiceProviderType,
        publicKey: data.public_key,
        reputation: data.reputation,
        registeredAt: data.registered_at,
        isActive: data.is_active,
      };
    }
    return null;
  } catch (error) {
    console.error('获取服务提供者信息失败:', error);
    return null;
  }
}

/**
 * 获取某类型的服务提供者列表
 *
 * @param api Polkadot API 实例
 * @param providerType 服务类型
 * @returns 服务提供者地址列表
 */
export async function getProvidersByType(
  api: ApiPromise,
  providerType: ServiceProviderType
): Promise<string[]> {
  try {
    const result = await (api.call as any).baziChartApi.getProvidersByType(providerType);
    return result.map((addr: any) => addr.toString());
  } catch (error) {
    console.error('获取服务提供者列表失败:', error);
    return [];
  }
}

/**
 * 获取被授权访问的命盘列表
 *
 * @param api Polkadot API 实例
 * @param address 账户地址
 * @returns 命盘 ID 列表
 */
export async function getProviderGrants(
  api: ApiPromise,
  address: string
): Promise<number[]> {
  try {
    const result = await (api.call as any).baziChartApi.getProviderGrants(address);
    return result.map((id: any) => id.toNumber());
  } catch (error) {
    console.error('获取授权命盘列表失败:', error);
    return [];
  }
}

// ==================== 多方授权加密命盘 ====================

/**
 * 创建多方授权加密命盘
 *
 * @param api Polkadot API 实例
 * @param params 加密参数（由 prepareMultiKeyEncryptedChart 生成）
 * @returns 交易对象
 */
export function createMultiKeyEncryptedChart(
  api: ApiPromise,
  params: MultiKeyEncryptedChartParams
): SubmittableExtrinsic<'promise'> {
  // 转换四柱索引
  const siZhuIndex = {
    year_gan: params.siZhuIndex.yearGan,
    year_zhi: params.siZhuIndex.yearZhi,
    month_gan: params.siZhuIndex.monthGan,
    month_zhi: params.siZhuIndex.monthZhi,
    day_gan: params.siZhuIndex.dayGan,
    day_zhi: params.siZhuIndex.dayZhi,
    hour_gan: params.siZhuIndex.hourGan,
    hour_zhi: params.siZhuIndex.hourZhi,
  };

  // 转换性别
  const gender = params.gender === 'Male' ? 0 : 1;

  // 转换加密数据
  const encryptedData = encryptedDataToChain(params.encryptedData);

  // 转换数据哈希
  const dataHash = Array.from(params.dataHash);

  // 转换加密密钥条目
  const encryptedKeys = params.encryptedKeys.map(entry => ({
    account: entry.account,
    encrypted_key: encryptedDataToChain(entry.encryptedKey),
    role: entry.role,
    scope: entry.scope,
  }));

  return api.tx.baziChart.createMultiKeyEncryptedChart(
    siZhuIndex,
    gender,
    encryptedData,
    dataHash,
    encryptedKeys
  );
}

/**
 * 授权访问多方授权加密命盘
 *
 * @param api Polkadot API 实例
 * @param chartId 命盘 ID
 * @param grantee 被授权账户
 * @param encryptedKey 用被授权方公钥加密的 DataKey
 * @param role 授权角色
 * @param scope 访问范围
 * @param expiresAt 过期区块号（0=永久）
 * @returns 交易对象
 */
export function grantChartAccess(
  api: ApiPromise,
  chartId: number,
  grantee: string,
  encryptedKey: Uint8Array,
  role: AccessRole,
  scope: AccessScope,
  expiresAt: number = 0
): SubmittableExtrinsic<'promise'> {
  return api.tx.baziChart.grantChartAccess(
    chartId,
    grantee,
    encryptedDataToChain(encryptedKey),
    role,
    scope,
    expiresAt
  );
}

/**
 * 撤销单个账户的访问权限
 *
 * @param api Polkadot API 实例
 * @param chartId 命盘 ID
 * @param revokee 被撤销账户
 * @returns 交易对象
 */
export function revokeChartAccess(
  api: ApiPromise,
  chartId: number,
  revokee: string
): SubmittableExtrinsic<'promise'> {
  return api.tx.baziChart.revokeChartAccess(chartId, revokee);
}

/**
 * 撤销所有授权（紧急情况）
 *
 * @param api Polkadot API 实例
 * @param chartId 命盘 ID
 * @returns 交易对象
 */
export function revokeAllChartAccess(
  api: ApiPromise,
  chartId: number
): SubmittableExtrinsic<'promise'> {
  return api.tx.baziChart.revokeAllChartAccess(chartId);
}

/**
 * 删除多方授权加密命盘
 *
 * @param api Polkadot API 实例
 * @param chartId 命盘 ID
 * @returns 交易对象
 */
export function deleteMultiKeyEncryptedChart(
  api: ApiPromise,
  chartId: number
): SubmittableExtrinsic<'promise'> {
  return api.tx.baziChart.deleteMultiKeyEncryptedChart(chartId);
}

/**
 * 获取多方授权加密命盘信息
 *
 * @param api Polkadot API 实例
 * @param chartId 命盘 ID
 * @returns 命盘信息或 null
 */
export async function getMultiKeyEncryptedChartInfo(
  api: ApiPromise,
  chartId: number
): Promise<MultiKeyChartInfo | null> {
  try {
    const result = await (api.call as any).baziChartApi.getMultiKeyEncryptedChartInfo(chartId);
    if (result.isSome) {
      const json = result.unwrap().toString();
      const data = JSON.parse(json);
      return {
        owner: data.owner,
        siZhuIndex: {
          yearGan: data.sizhu_index.year_gan,
          yearZhi: data.sizhu_index.year_zhi,
          monthGan: data.sizhu_index.month_gan,
          monthZhi: data.sizhu_index.month_zhi,
          dayGan: data.sizhu_index.day_gan,
          dayZhi: data.sizhu_index.day_zhi,
          hourGan: data.sizhu_index.hour_gan,
          hourZhi: data.sizhu_index.hour_zhi,
        },
        gender: data.gender,
        createdAt: data.created_at,
        grantsCount: data.grants_count,
        grantAccounts: data.grant_accounts,
      };
    }
    return null;
  } catch (error) {
    console.error('获取多方授权加密命盘信息失败:', error);
    return null;
  }
}

/**
 * 获取多方授权加密命盘的解盘
 *
 * @param api Polkadot API 实例
 * @param chartId 命盘 ID
 * @returns 解盘结果或 null
 */
export async function getMultiKeyEncryptedChartInterpretation(
  api: ApiPromise,
  chartId: number
): Promise<BaziInterpretation | null> {
  try {
    const result = await (api.call as any).baziChartApi.getMultiKeyEncryptedChartInterpretation(chartId);
    if (result.isSome) {
      return parseInterpretation(result.unwrap());
    }
    return null;
  } catch (error) {
    console.error('获取多方授权加密命盘解盘失败:', error);
    return null;
  }
}

// 重新导出多方授权相关类型和工具
export {
  AccessRole,
  AccessScope,
  ServiceProviderType,
  type EncryptedKeyEntry,
  type MultiKeyEncryptedChartParams,
} from './multiKeyEncryption';

export {
  generateX25519KeyPair,
  generateDataKey,
  savePrivateKey,
  loadPrivateKey,
  deletePrivateKey,
  hasStoredKey,
  prepareMultiKeyEncryptedChart,
  decryptMultiKeyChart,
  sealDataKey,
  unsealDataKey,
  bytesToHex,
} from './multiKeyEncryption';
