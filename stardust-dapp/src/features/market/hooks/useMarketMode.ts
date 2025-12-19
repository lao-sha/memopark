/**
 * 市场模式检测 Hook
 *
 * 功能：
 * - 根据 URL 参数自动判断用户意图
 * - 浏览模式：探索大师、对比服务
 * - 下单模式：已有占卜结果，快速下单
 */

import { useState, useEffect } from 'react';
import { DivinationType } from '../../../types/divination';

/**
 * 市场模式定义
 */
export interface MarketMode {
  isBrowsing: boolean;      // 浏览模式
  isOrdering: boolean;      // 下单模式
  resultId: number | null;  // 占卜结果ID
  divinationType: DivinationType | null;  // 占卜类型
}

/**
 * 从 URL hash 中提取参数
 */
function parseHashParams(hash: string): URLSearchParams {
  const queryString = hash.split('?')[1] || '';
  return new URLSearchParams(queryString);
}

/**
 * 检测市场模式
 */
function detectMarketMode(hash: string): MarketMode {
  const params = parseHashParams(hash);
  const resultIdStr = params.get('resultId');
  const typeStr = params.get('type');

  const resultId = resultIdStr ? parseInt(resultIdStr, 10) : null;
  const divinationType = typeStr ? parseInt(typeStr, 10) as DivinationType : null;

  return {
    isBrowsing: !resultId,
    isOrdering: !!resultId,
    resultId,
    divinationType,
  };
}

/**
 * 市场模式 Hook
 *
 * @returns {MarketMode} 当前市场模式
 *
 * @example
 * // 浏览模式
 * const mode = useMarketMode(); // { isBrowsing: true, isOrdering: false, resultId: null, divinationType: null }
 *
 * // 下单模式
 * // URL: #/market?resultId=123&type=1
 * const mode = useMarketMode(); // { isBrowsing: false, isOrdering: true, resultId: 123, divinationType: 1 }
 */
export function useMarketMode(): MarketMode {
  const [mode, setMode] = useState<MarketMode>(() =>
    detectMarketMode(window.location.hash)
  );

  useEffect(() => {
    const handleHashChange = () => {
      setMode(detectMarketMode(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return mode;
}

/**
 * 生成市场页面 URL
 *
 * @param resultId 占卜结果ID（可选）
 * @param divinationType 占卜类型（可选）
 * @returns 完整的 hash URL
 *
 * @example
 * generateMarketUrl() // "#/market"
 * generateMarketUrl(123, DivinationType.Meihua) // "#/market?resultId=123&type=0"
 */
export function generateMarketUrl(
  resultId?: number,
  divinationType?: DivinationType
): string {
  if (!resultId) {
    return '#/market';
  }

  const params = new URLSearchParams();
  params.set('resultId', String(resultId));
  if (divinationType !== undefined) {
    params.set('type', String(divinationType));
  }

  return `#/market?${params.toString()}`;
}

/**
 * 导航到市场页面
 *
 * @param resultId 占卜结果ID（可选）
 * @param divinationType 占卜类型（可选）
 *
 * @example
 * navigateToMarket(); // 浏览模式
 * navigateToMarket(123, DivinationType.Meihua); // 下单模式
 */
export function navigateToMarket(
  resultId?: number,
  divinationType?: DivinationType
): void {
  window.location.hash = generateMarketUrl(resultId, divinationType);
}
