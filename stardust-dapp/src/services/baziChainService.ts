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
  if (!api.tx.baziChart || !api.tx.baziChart.createChart) {
    throw new Error('区块链节点未包含八字命理模块（pallet-bazi-chart），请检查节点配置');
  }

  const { year, month, day, hour, gender, isPublic = false, dataCid } = params;

  // 构建交易
  const dataCidBytes = dataCid
    ? { Some: Array.from(new TextEncoder().encode(dataCid)) }
    : { None: null };

  const tx = api.tx.baziChart.createChart(
    year,
    month,
    day,
    hour,
    gender,
    isPublic,
    dataCidBytes
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
          e.event.section === 'baziChart' && e.event.method === 'ChartCreated'
        );

        if (event) {
          const chartId = event.event.data[0].toNumber();
          console.log('[BaziChainService] 八字命盘创建成功，ID:', chartId);
          resolve(chartId);
        } else if (status.isFinalized) {
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
  if (!api.query.baziChart || !api.query.baziChart.charts) {
    console.error('[BaziChainService] baziChart pallet 不存在');
    return null;
  }

  console.log('[BaziChainService] 查询命盘 ID:', chartId);
  const result = await api.query.baziChart.charts(chartId);

  if (result.isNone) {
    console.log('[BaziChainService] 命盘不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[BaziChainService] 原始数据:', JSON.stringify(data.toHuman()));

    return {
      id: chartId,
      creator: data.creator.toString(),
      birthYear: data.birthYear.toNumber(),
      birthMonth: data.birthMonth.toNumber(),
      birthDay: data.birthDay.toNumber(),
      birthHour: data.birthHour.toNumber(),
      gender: data.gender.toNumber(),
      isPublic: data.isPublic.isTrue,
      dataCid: data.dataCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.dataCid.unwrap().toU8a()))
        : undefined,
      createdAt: data.createdAt.toNumber(),
      status: data.status.toNumber(),
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
 * 归档八字命盘
 *
 * @param chartId 命盘ID
 */
export async function archiveBaziChart(chartId: number): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.baziChart || !api.tx.baziChart.archiveChart) {
    throw new Error('区块链节点未包含八字命理模块');
  }

  const tx = api.tx.baziChart.archiveChart(chartId);

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
        console.log('[BaziChainService] 命盘已归档:', chartId);
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 更新八字命盘的IPFS数据CID
 *
 * @param chartId 命盘ID
 * @param dataCid 新的IPFS CID
 */
export async function updateBaziChartData(chartId: number, dataCid: string): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.baziChart || !api.tx.baziChart.updateDataCid) {
    throw new Error('区块链节点未包含八字命理模块');
  }

  const dataCidBytes = Array.from(new TextEncoder().encode(dataCid));
  const tx = api.tx.baziChart.updateDataCid(chartId, dataCidBytes);

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
        console.log('[BaziChainService] 数据CID已更新:', chartId, dataCid);
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 设置命盘公开/私有状态
 *
 * @param chartId 命盘ID
 * @param isPublic 是否公开
 */
export async function setBaziChartVisibility(chartId: number, isPublic: boolean): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.baziChart || !api.tx.baziChart.setVisibility) {
    throw new Error('区块链节点未包含八字命理模块');
  }

  const tx = api.tx.baziChart.setVisibility(chartId, isPublic);

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
        console.log('[BaziChainService] 可见性已更新:', chartId, isPublic);
        resolve();
      }
    }).catch(reject);
  });
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

  if (!api.query.baziChart || !api.query.baziChart.charts) {
    return [];
  }

  const entries = await api.query.baziChart.charts.entries();
  const charts: OnChainBaziChart[] = [];

  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 只返回公开的命盘
    if (!data.isPublic.isTrue) continue;

    const chartId = key.args[0].toNumber();
    charts.push({
      id: chartId,
      creator: data.creator.toString(),
      birthYear: data.birthYear.toNumber(),
      birthMonth: data.birthMonth.toNumber(),
      birthDay: data.birthDay.toNumber(),
      birthHour: data.birthHour.toNumber(),
      gender: data.gender.toNumber(),
      isPublic: true,
      dataCid: data.dataCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.dataCid.unwrap().toU8a()))
        : undefined,
      createdAt: data.createdAt.toNumber(),
      status: data.status.toNumber(),
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
