/**
 * AI推理 Hook
 * 
 * 函数级详细中文注释：
 * 提供便捷的 AI 推理服务调用方法，包含状态管理、错误处理和自动重试。
 * 
 * @module useAIInference
 * @created 2025-11-04
 */

import { useState, useCallback } from 'react';
import {
  getAIInferenceService,
  type InferenceRequest,
  type InferenceResult,
  type HealthStatus,
  type MarketData,
} from '../services/aiInferenceService';

/**
 * 函数级详细中文注释：AI推理 Hook 状态
 */
interface UseAIInferenceState {
  /** 推理结果 */
  result: InferenceResult | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 服务健康状态 */
  health: HealthStatus | null;
}

/**
 * 函数级详细中文注释：AI推理 Hook
 * @param serviceURL AI服务地址（可选，默认 localhost:8000）
 * @returns Hook 状态和操作方法
 */
export function useAIInference(serviceURL?: string) {
  const aiService = getAIInferenceService(serviceURL);

  const [state, setState] = useState<UseAIInferenceState>({
    result: null,
    loading: false,
    error: null,
    health: null,
  });

  /**
   * 函数级详细中文注释：检查服务健康状态
   */
  const checkHealth = useCallback(async () => {
    try {
      const health = await aiService.checkHealth();
      setState((prev) => ({ ...prev, health, error: null }));
      return health;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'AI服务连接失败';
      setState((prev) => ({ ...prev, error: errorMsg, health: null }));
      throw error;
    }
  }, [aiService]);

  /**
   * 函数级详细中文注释：获取交易信号
   * @param request 推理请求
   * @returns 推理结果
   */
  const getTradingSignal = useCallback(
    async (request: InferenceRequest): Promise<InferenceResult> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await aiService.getTradingSignal(request);
        setState((prev) => ({
          ...prev,
          result,
          loading: false,
          error: null,
        }));
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '推理失败';
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }));
        throw error;
      }
    },
    [aiService]
  );

  /**
   * 函数级详细中文注释：获取交易信号（使用模拟数据）
   * @param symbol 交易对
   * @param basePrice 基础价格
   * @param strategyId 策略ID
   * @returns 推理结果
   */
  const getTradingSignalWithMockData = useCallback(
    async (
      symbol: string,
      basePrice: number,
      strategyId: number = 1
    ): Promise<InferenceResult> => {
      const mockData = aiService.generateMockMarketData(symbol, basePrice);
      
      const request: InferenceRequest = {
        strategy_id: strategyId,
        market_data: mockData,
        model_type: 'lstm',
        confidence_threshold: 60,
      };

      return getTradingSignal(request);
    },
    [aiService, getTradingSignal]
  );

  /**
   * 函数级详细中文注释：使用真实市场数据获取交易信号
   * @param marketData 市场数据
   * @param strategyId 策略ID
   * @param modelType 模型类型
   * @param confidenceThreshold 置信度阈值
   * @returns 推理结果
   */
  const getTradingSignalWithMarketData = useCallback(
    async (
      marketData: MarketData,
      strategyId: number = 1,
      modelType: string = 'lstm',
      confidenceThreshold: number = 60
    ): Promise<InferenceResult> => {
      const request: InferenceRequest = {
        strategy_id: strategyId,
        market_data: marketData,
        model_type: modelType,
        confidence_threshold: confidenceThreshold,
      };

      return getTradingSignal(request);
    },
    [getTradingSignal]
  );

  /**
   * 函数级详细中文注释：清除错误
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * 函数级详细中文注释：清除结果
   */
  const clearResult = useCallback(() => {
    setState((prev) => ({ ...prev, result: null }));
  }, []);

  /**
   * 函数级详细中文注释：重置状态
   */
  const reset = useCallback(() => {
    setState({
      result: null,
      loading: false,
      error: null,
      health: null,
    });
  }, []);

  return {
    // 状态
    result: state.result,
    loading: state.loading,
    error: state.error,
    health: state.health,
    
    // 操作方法
    checkHealth,
    getTradingSignal,
    getTradingSignalWithMockData,
    getTradingSignalWithMarketData,
    clearError,
    clearResult,
    reset,
    
    // 辅助方法
    generateMockData: aiService.generateMockMarketData.bind(aiService),
    prepareMarketData: aiService.prepareMarketData.bind(aiService),
  };
}

