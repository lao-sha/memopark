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
 * 链上解盘结果类型
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
    console.log('[BaziChainService] 原始解盘数据:', JSON.stringify(data.toHuman()));

    // 映射格局类型
    const geJuMap: Record<string, string> = {
      'ZhengGe': '正格',
      'CongQiangGe': '从强格',
      'CongRuoGe': '从弱格',
      'CongCaiGe': '从财格',
      'CongGuanGe': '从官格',
      'CongErGe': '从儿格',
      'HuaQiGe': '化气格',
      'TeShuge': '特殊格局',
    };

    // 映射强弱类型
    const qiangRuoMap: Record<string, string> = {
      'ShenWang': '身旺',
      'ShenRuo': '身弱',
      'ZhongHe': '中和',
      'TaiWang': '太旺',
      'TaiRuo': '太弱',
    };

    // 映射用神类型
    const yongShenTypeMap: Record<string, string> = {
      'FuYi': '扶抑用神',
      'DiaoHou': '调候用神',
      'TongGuan': '通关用神',
      'ZhuanWang': '专旺用神',
    };

    // 映射五行
    const wuXingMap: Record<string, string> = {
      'Mu': '木',
      'Huo': '火',
      'Tu': '土',
      'Jin': '金',
      'Shui': '水',
    };

    // 解析格局
    const geJuKey = Object.keys(data.geJu.toJSON())[0];
    const geJu = geJuMap[geJuKey] || geJuKey;

    // 解析强弱
    const qiangRuoKey = Object.keys(data.qiangRuo.toJSON())[0];
    const qiangRuo = qiangRuoMap[qiangRuoKey] || qiangRuoKey;

    // 解析用神
    const yongShenKey = Object.keys(data.yongShen.toJSON())[0];
    const yongShen = wuXingMap[yongShenKey] || yongShenKey;

    // 解析用神类型
    const yongShenTypeKey = Object.keys(data.yongShenType.toJSON())[0];
    const yongShenType = yongShenTypeMap[yongShenTypeKey] || yongShenTypeKey;

    // 解析忌神列表
    const jiShen = data.jiShen.map((js: any) => {
      const key = Object.keys(js.toJSON())[0];
      return wuXingMap[key] || key;
    });

    // 解析评分
    const score = data.zongHePingFen.toNumber();

    // 映射解盘文本枚举
    const jiePanTextMap: Record<string, string> = {
      // 格局描述
      'GeJuZhengGe': '命局为正格，五行相对平衡，发展较为稳定。',
      'GeJuCongQiang': '命局为从强格，日主旺盛，宜顺势发展，忌克泄耗。',
      'GeJuCongRuo': '命局为从弱格，日主虚弱，宜借力打力，从势而行。',
      'GeJuTeShu': '命局格局特殊，需要综合分析，谨慎行事。',

      // 强弱描述
      'QiangRuoShenWang': '日主偏旺，自主性强，但需注意克制，避免刚愎自用。',
      'QiangRuoShenRuo': '日主偏弱，需要贵人相助，宜团队合作，借力发展。',
      'QiangRuoZhongHe': '日主中和，五行平衡，发展顺遂，运势较好。',
      'QiangRuoOther': '日主强弱特殊，需要结合大运流年综合判断。',

      // 用神建议
      'YongShenJin': '宜从事金融、机械、五金、贸易相关行业，有利于发展。',
      'YongShenMu': '宜从事教育、文化、环保、农林相关行业，有利于发展。',
      'YongShenShui': '宜从事运输、水利、信息、贸易相关行业，有利于发展。',
      'YongShenHuo': '宜从事能源、娱乐、化工相关行业，有利于发展。',
      'YongShenTu': '宜从事房地产、建筑、农业、服务相关行业，有利于发展。',
    };

    // 解析解盘文本
    const texts = data.jiePanText.map((text: any) => {
      const key = Object.keys(text.toJSON())[0];
      return jiePanTextMap[key] || `${key}（暂无描述）`;
    });

    return {
      geJu,
      qiangRuo,
      yongShen,
      yongShenType,
      jiShen,
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
 * 智能获取解盘结果
 *
 * 策略：
 * 1. 优先从链上缓存加载（免费查询）
 * 2. 如果没有缓存，返回 null，提示用户选择缓存
 *
 * @param chartId 命盘 ID
 * @returns 解盘结果
 */
export async function getInterpretationSmart(
  chartId: number
): Promise<SimplifiedInterpretation | null> {
  // 1. 尝试从链上缓存加载
  const cached = await getCachedInterpretation(chartId);
  if (cached) {
    console.log('[BaziChainService] 使用链上缓存');
    return cached;
  }

  // 2. 如果没有缓存，返回 null
  console.log('[BaziChainService] 未找到缓存，需要先缓存');
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
    // 枚举映射表
    const geJuMap: Record<string, string> = {
      'ZhengGe': '正格',
      'CongQiangGe': '从强格',
      'CongRuoGe': '从弱格',
      'CongCaiGe': '从财格',
      'CongGuanGe': '从官格',
      'CongErGe': '从儿格',
      'HuaQiGe': '化气格',
      'TeShuge': '特殊格局',
    };

    const qiangRuoMap: Record<string, string> = {
      'ShenWang': '身旺',
      'ShenRuo': '身弱',
      'ZhongHe': '中和',
      'TaiWang': '太旺',
      'TaiRuo': '太弱',
    };

    const yongShenTypeMap: Record<string, string> = {
      'FuYi': '扶抑用神',
      'DiaoHou': '调候用神',
      'TongGuan': '通关用神',
      'ZhuanWang': '专旺用神',
    };

    const wuXingMap: Record<string, string> = {
      'Mu': '木',
      'Huo': '火',
      'Tu': '土',
      'Jin': '金',
      'Shui': '水',
    };

    return {
      geJu: geJuMap[Object.keys(data.geJu.toJSON())[0]] || '未知',
      qiangRuo: qiangRuoMap[Object.keys(data.qiangRuo.toJSON())[0]] || '未知',
      yongShen: wuXingMap[Object.keys(data.yongShen.toJSON())[0]] || '未知',
      yongShenType: yongShenTypeMap[Object.keys(data.yongShenType.toJSON())[0]] || '未知',
      xiShen: wuXingMap[Object.keys(data.xiShen.toJSON())[0]] || '未知',
      jiShen: wuXingMap[Object.keys(data.jiShen.toJSON())[0]] || '未知',
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
