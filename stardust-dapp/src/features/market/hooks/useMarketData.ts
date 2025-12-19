/**
 * 市场数据加载 Hook
 *
 * 功能：
 * - 统一从链上 pallet 加载提供者和套餐数据
 * - 计算平台统计信息
 * - 提供数据缓存和错误处理
 */

import { useState, useEffect, useCallback } from 'react';
import { ApiPromise } from '@polkadot/api';
import type { ServiceProvider, ServicePackage } from '../../../types/divination';
import { DivinationType } from '../../../types/divination';

/**
 * 市场数据接口
 */
export interface MarketData {
  providers: ServiceProvider[];
  packages: Map<string, ServicePackage[]>;  // providerAccount -> packages
  loading: boolean;
  error: string | null;
  stats: PlatformStats;
}

/**
 * 平台统计数据
 */
export interface PlatformStats {
  totalProviders: number;
  totalOrders: number;
  avgMonthlyIncome: string;  // 格式化后的月均收入
  activeProviders: number;   // 在线大师数量
}

/**
 * 从链上加载提供者列表
 */
async function loadProvidersFromChain(api: ApiPromise): Promise<ServiceProvider[]> {
  try {
    const entries = await api.query.divinationMarket.providers.entries();
    const providerList: ServiceProvider[] = [];

    for (const [key, value] of entries) {
      const providerData = value.toJSON() as any;
      if (!providerData) continue;

      // 从 StorageKey 提取账户地址
      const accountId = key.args[0].toString();

      // 解码名称和简介（处理十六进制和字节数组）
      const decodeName = (nameData: any): string => {
        if (!nameData) return '未命名大师';

        // 十六进制字符串
        if (typeof nameData === 'string' && nameData.startsWith('0x')) {
          try {
            const hex = nameData.slice(2);
            const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
            const decoded = new TextDecoder().decode(bytes);
            return decoded.trim() || '未命名大师';
          } catch (e) {
            console.error('解码名称失败:', e);
            return '未命名大师';
          }
        }

        // 字节数组
        if (Array.isArray(nameData)) {
          try {
            return new TextDecoder().decode(new Uint8Array(nameData));
          } catch (e) {
            return '未命名大师';
          }
        }

        // 字符串直接返回
        if (typeof nameData === 'string' && nameData.length > 0) {
          return nameData;
        }

        return '未命名大师';
      };

      const decodeBio = (bioData: any): string => {
        if (!bioData) return '暂无简介';

        // 十六进制字符串
        if (typeof bioData === 'string' && bioData.startsWith('0x')) {
          try {
            const hex = bioData.slice(2);
            const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
            const decoded = new TextDecoder().decode(bytes);
            return decoded.trim() || '暂无简介';
          } catch (e) {
            return '暂无简介';
          }
        }

        // 字节数组
        if (Array.isArray(bioData)) {
          try {
            return new TextDecoder().decode(new Uint8Array(bioData));
          } catch (e) {
            return '暂无简介';
          }
        }

        // 字符串直接返回
        if (typeof bioData === 'string' && bioData.length > 0) {
          return bioData;
        }

        return '暂无简介';
      };

      const provider: ServiceProvider = {
        account: accountId,
        name: decodeName(providerData.name),
        bio: decodeBio(providerData.bio),
        avatarCid: providerData.avatarCid,
        tier: providerData.tier,
        isActive: providerData.isActive !== false,
        deposit: BigInt(providerData.deposit || 0),
        registeredAt: providerData.registeredAt || 0,
        totalOrders: providerData.totalOrders || 0,
        completedOrders: providerData.completedOrders || 0,
        cancelledOrders: providerData.cancelledOrders || 0,
        totalRatings: providerData.totalRatings || 0,
        ratingSum: providerData.ratingSum || 0,
        totalEarnings: BigInt(providerData.totalEarnings || 0),
        specialties: providerData.specialties || 0,
        supportedDivinationTypes: providerData.supportedDivinationTypes || 0,
        acceptsUrgent: providerData.acceptsUrgent || false,
        lastActiveAt: providerData.lastActiveAt || 0,
      };

      providerList.push(provider);
    }

    // 按完成订单数倒序排列
    providerList.sort((a, b) => b.completedOrders - a.completedOrders);

    return providerList;
  } catch (error) {
    console.error('从链上加载提供者失败:', error);
    throw error;
  }
}

/**
 * 从链上加载指定提供者的套餐列表
 */
async function loadPackagesFromChain(
  api: ApiPromise,
  providerAccount: string
): Promise<ServicePackage[]> {
  try {
    const entries = await api.query.divinationMarket.packages.entries(providerAccount);
    const packageList: ServicePackage[] = [];

    for (const [key, value] of entries) {
      const packageData = value.toJSON() as any;
      if (!packageData) continue;

      // 从 StorageKey 提取套餐ID
      const packageId = key.args[1].toNumber();

      const pkg: ServicePackage = {
        id: packageId,
        divinationType: packageData.divinationType as DivinationType,
        serviceType: packageData.serviceType,
        name: packageData.name || '未命名套餐',
        description: packageData.description || '',
        price: BigInt(packageData.price || 0),
        duration: packageData.duration || 0,
        followUpCount: packageData.followUpCount || 0,
        urgentAvailable: packageData.urgentAvailable || false,
        urgentSurcharge: packageData.urgentSurcharge || 0,
        isActive: packageData.isActive !== false,
        salesCount: packageData.salesCount || 0,
      };

      if (pkg.isActive) {
        packageList.push(pkg);
      }
    }

    return packageList;
  } catch (error) {
    console.error('从链上加载套餐失败:', error);
    return [];
  }
}

/**
 * 计算平台统计数据
 */
function calculatePlatformStats(providers: ServiceProvider[]): PlatformStats {
  const totalProviders = providers.length;
  const activeProviders = providers.filter(p => p.isActive).length;

  let totalOrders = 0;
  let totalEarnings = BigInt(0);

  for (const provider of providers) {
    totalOrders += provider.totalOrders;
    totalEarnings += provider.totalEarnings;
  }

  // 计算月均收入（假设运营6个月）
  const avgMonthlyIncome = totalProviders > 0
    ? (Number(totalEarnings) / 1e12 / totalProviders / 6).toFixed(0)
    : '0';

  return {
    totalProviders,
    totalOrders,
    avgMonthlyIncome,
    activeProviders,
  };
}

/**
 * 市场数据 Hook
 *
 * @param api Polkadot API 实例
 * @param divinationType 占卜类型筛选（可选）
 * @returns 市场数据和加载状态
 *
 * @example
 * const { providers, packages, loading, error, stats } = useMarketData(api);
 */
export function useMarketData(
  api: ApiPromise | null,
  divinationType?: DivinationType | null
): MarketData {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [packages, setPackages] = useState<Map<string, ServicePackage[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats>({
    totalProviders: 0,
    totalOrders: 0,
    avgMonthlyIncome: '0',
    activeProviders: 0,
  });

  /**
   * 加载市场数据
   */
  const loadMarketData = useCallback(async () => {
    if (!api) return;

    setLoading(true);
    setError(null);

    try {
      // 1. 加载所有提供者
      const providerList = await loadProvidersFromChain(api);

      // 2. 根据占卜类型筛选（如果指定）
      const filteredProviders = divinationType !== null && divinationType !== undefined
        ? providerList.filter(p => {
            // 检查提供者是否支持该占卜类型
            const supportedTypes = p.supportedDivinationTypes;
            return (supportedTypes & (1 << divinationType)) !== 0;
          })
        : providerList;

      setProviders(filteredProviders);

      // 3. 加载每个提供者的套餐（懒加载优化）
      // 只加载前10个提供者的套餐，其他按需加载
      const packagesMap = new Map<string, ServicePackage[]>();
      const topProviders = filteredProviders.slice(0, 10);

      await Promise.all(
        topProviders.map(async (p) => {
          const pkgs = await loadPackagesFromChain(api, p.account);
          packagesMap.set(p.account, pkgs);
        })
      );

      setPackages(packagesMap);

      // 4. 计算统计数据
      const platformStats = calculatePlatformStats(providerList);
      setStats(platformStats);

      console.log(`✅ 已加载 ${filteredProviders.length} 位服务提供者`);
    } catch (err: any) {
      console.error('加载市场数据失败:', err);
      setError(err.message || '加载数据失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [api, divinationType]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  /**
   * 懒加载指定提供者的套餐
   */
  const loadProviderPackages = useCallback(
    async (providerAccount: string) => {
      if (!api) return;
      if (packages.has(providerAccount)) return; // 已加载

      try {
        const pkgs = await loadPackagesFromChain(api, providerAccount);
        setPackages(prev => new Map(prev).set(providerAccount, pkgs));
      } catch (err) {
        console.error(`加载提供者 ${providerAccount} 的套餐失败:`, err);
      }
    },
    [api, packages]
  );

  return {
    providers,
    packages,
    loading,
    error,
    stats,
  };
}
