/**
 * AI策略模块导出
 * 
 * 函数级详细中文注释：
 * 统一导出 AI 推理相关的所有组件和工具。
 * 
 * @module ai-trader
 * @created 2025-11-04
 */

export { AITradingPanel } from './AITradingPanel';
export { AIStrategyDemo } from './AIStrategyDemo';

// 导出类型（如果需要）
export type { InferenceResult, MarketData, TradingSignal, MarketCondition } from '../../services/aiInferenceService';

