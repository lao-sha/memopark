import { useState, useEffect, useCallback } from 'react';
import { getApi } from '../../lib/polkadot';

/**
 * 函数级详细中文注释：价格偏离计算结果接口
 */
export interface PriceDeviationResult {
  /** 最终价格（USDT，精度10^6） */
  finalPrice: number;
  /** 偏离百分比（0-100） */
  deviationPercent: number;
  /** 是否为警告级别（15% < 偏离 <= 20%） */
  isWarning: boolean;
  /** 是否为错误级别（偏离 > 20%） */
  isError: boolean;
}

/**
 * 函数级详细中文注释：usePriceCalculation Hook返回值接口
 */
export interface UsePriceCalculationResult {
  /** 基准价格（USDT，精度10^6） */
  basePrice: number;
  /** 价格加载状态 */
  loadingPrice: boolean;
  /** 计算价格偏离（传入做市商sell溢价，单位：基点bps） */
  calculateDeviation: (sellPremiumBps: number) => PriceDeviationResult;
  /** 重新加载基准价格 */
  reload: () => void;
}

/**
 * 函数级详细中文注释：usePriceCalculation Hook
 * 
 * 用途：统一管理价格计算和偏离检查
 * 
 * 设计思路：
 * 1. 自动加载基准价格（pallet-pricing的市场加权均价）
 * 2. 每30秒自动更新价格
 * 3. 提供calculateDeviation函数计算价格偏离
 * 4. 支持手动reload
 * 
 * 适用场景：
 * - CreateOrderPage：订单创建时的价格偏离检查
 * - BridgeTransactionForm：桥接交易的价格计算
 * - 其他需要价格计算的场景
 * 
 * @returns {UsePriceCalculationResult} 价格数据和计算函数
 * 
 * @example
 * ```tsx
 * const { basePrice, loadingPrice, calculateDeviation } = usePriceCalculation();
 * 
 * if (loadingPrice) return <Spin />;
 * 
 * // 计算价格偏离
 * const maker = marketMakers[0];
 * const { finalPrice, deviationPercent, isWarning, isError } = calculateDeviation(maker.sellPremiumBps);
 * 
 * if (isError) {
 *   alert(`价格偏离过大: ${deviationPercent.toFixed(1)}%`);
 * }
 * ```
 */
export function usePriceCalculation(): UsePriceCalculationResult {
  const [basePrice, setBasePrice] = useState<number>(0);
  const [loadingPrice, setLoadingPrice] = useState<boolean>(true);
  const [nonce, setNonce] = useState<number>(0); // 用于强制重新加载

  // 重新加载函数
  const reload = useCallback(() => {
    setNonce(prev => prev + 1);
  }, []);

  useEffect(() => {
    /**
     * 函数级详细中文注释：加载基准价格
     *
     * 执行流程：
     * 1. 连接到链上API
     * 2. 检查是否退出冷启动（coldStartExited）
     * 3. 如果已退出冷启动，使用otcPriceAggregate计算加权均价
     * 4. 如果仍在冷启动，使用defaultPrice
     * 5. 每30秒自动更新一次
     *
     * 价格精度：10^6（1,000,000 = 1 USDT）
     */
    const loadBasePrice = async () => {
      try {
        const api = await getApi();

        // 检查是否退出冷启动
        const coldStartExited = await (api.query as any).pricing?.coldStartExited?.();
        const hasExitedColdStart = coldStartExited?.isTrue || coldStartExited?.toString() === 'true';

        if (hasExitedColdStart) {
          // 已退出冷启动：使用OTC价格聚合计算加权均价
          const otcAggregate = await (api.query as any).pricing?.otcPriceAggregate?.();
          if (otcAggregate) {
            const aggregateData = otcAggregate.toJSON();
            if (aggregateData.totalDust > 0 && aggregateData.totalUsdt > 0) {
              // 加权均价 = totalUsdt / totalDust（已经是正确精度）
              // totalUsdt 精度 10^6，totalDust 精度 10^12
              // 结果：(usdt * 10^6) / (dust * 10^12) * 10^12 = usdt / dust * 10^6
              const weightedPrice = Math.floor((Number(aggregateData.totalUsdt) * 1_000_000_000_000) / Number(aggregateData.totalDust));
              setBasePrice(weightedPrice);
              console.log('✅ [usePriceCalculation] 加权均价:', (weightedPrice / 1_000_000).toFixed(6), 'USDT/DUST');
              return;
            }
          }
        }

        // 仍在冷启动或无聚合数据：使用默认价格
        const defaultPrice = await (api.query as any).pricing?.defaultPrice?.();
        if (defaultPrice) {
          const priceValue = Number(defaultPrice.toString());
          setBasePrice(priceValue);
          console.log('✅ [usePriceCalculation] 默认价格:', (priceValue / 1_000_000).toFixed(6), 'USDT/DUST (冷启动)');
        } else {
          console.warn('⚠️ [usePriceCalculation] 未获取到价格数据');
        }
      } catch (e: any) {
        console.error('[usePriceCalculation] 加载基准价格失败:', e);
      } finally {
        setLoadingPrice(false);
      }
    };
    
    // 初始加载
    loadBasePrice();
    
    // 定时更新基准价格（每30秒）
    const interval = setInterval(loadBasePrice, 30000);
    
    // 清理定时器
    return () => clearInterval(interval);
  }, [nonce]); // 当nonce改变时重新加载

  /**
   * 函数级详细中文注释：计算价格偏离
   * 
   * 计算公式：
   * - final_price = base_price × (10000 + sell_premium_bps) / 10000
   * - deviation_percent = |final_price - base_price| / base_price × 100
   * 
   * 警告级别：
   * - 正常：deviation <= 15%
   * - 警告：15% < deviation <= 20%
   * - 错误：deviation > 20%
   * 
   * @param sellPremiumBps - 做市商sell溢价（基点，1 bps = 0.01%）
   * @returns {PriceDeviationResult} 价格偏离计算结果
   */
  const calculateDeviation = useCallback((sellPremiumBps: number): PriceDeviationResult => {
    // 如果基准价格未加载，返回默认值
    if (basePrice === 0) {
      return {
        finalPrice: 0,
        deviationPercent: 0,
        isWarning: false,
        isError: false,
      };
    }
    
    // 应用sell溢价计算最终价格
    // final_price = base_price × (10000 + sell_premium_bps) / 10000
    const finalPrice = Math.floor(basePrice * (10000 + sellPremiumBps) / 10000);
    
    // 计算偏离率（百分比）
    const deviationPercent = Math.abs((finalPrice - basePrice) / basePrice * 100);
    
    // 判断警告和错误级别
    // 警告：偏离率 > 15% 且 <= 20%
    const isWarning = deviationPercent > 15 && deviationPercent <= 20;
    
    // 错误：偏离率 > 20%
    const isError = deviationPercent > 20;
    
    console.log('[usePriceCalculation] 价格偏离计算:', {
      basePrice: (basePrice / 1_000_000).toFixed(6),
      sellPremiumBps,
      finalPrice: (finalPrice / 1_000_000).toFixed(6),
      deviationPercent: deviationPercent.toFixed(2) + '%',
      isWarning,
      isError,
    });
    
    return {
      finalPrice,
      deviationPercent,
      isWarning,
      isError,
    };
  }, [basePrice]); // 依赖basePrice，当价格更新时重新创建函数

  return {
    basePrice,
    loadingPrice,
    calculateDeviation,
    reload,
  };
}

