/**
 * 八字链上服务
 *
 * 提供与 pallet-bazi-chart 的交互功能：
 * - 保存八字命盘到链上
 * - 查询链上八字数据
 * - 八字结果关联到悬赏/NFT等
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type { BaziResult, SiZhu, Gender } from '../types/bazi';
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
  // 注意：实际 pallet 签名是 create_bazi_chart(year, month, day, hour, minute, gender, zishi_mode)
  const minute = 0; // 默认分钟为0
  const zishiMode = 1; // 0=传统派, 1=现代派（默认使用现代派）

  const tx = api.tx.baziChart.createBaziChart(
    year,
    month,
    day,
    hour,
    minute,
    gender,
    zishiMode
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
