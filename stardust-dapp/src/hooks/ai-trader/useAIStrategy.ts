/**
 * AI策略管理Hook
 * 提供与pallet-ai-strategy交互的所有功能
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../useApi';
import { useAccount } from '../useAccount';
import type { ApiPromise } from '@polkadot/api';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';

// ===== 类型定义 =====

export type AIModel = 'GPT4' | 'Claude' | 'Transformer' | 'LSTM' | 'Ensemble';
export type StrategyType = 'Grid' | 'MarketMaking' | 'Arbitrage' | 'AI' | 'DCA';
export type TradeSignal = 'Buy' | 'Sell' | 'Hold' | 'Close';

export interface AIModelConfig {
  model: AIModel;
  confidence_threshold: number;
  features: string[];
  endpoint: string;
}

export interface RiskControl {
  max_position_size: string;
  max_leverage: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_daily_trades: number;
  max_daily_loss: string;
}

export interface AIStrategy {
  strategy_id: number;
  owner: string;
  name: string;
  symbol: string;
  ai_model: AIModel;
  strategy_type: StrategyType;
  enabled: boolean;
  model_config: AIModelConfig;
  risk_control: RiskControl;
  created_at: string;
  updated_at: string;
}

export interface AITradeSignal {
  signal: TradeSignal;
  confidence: number;
  position_size: string;
  entry_price: string;
  stop_loss?: string;
  take_profit?: string;
  reasoning: string;
  feature_importance: Record<string, number>;
  timestamp: string;
}

export interface PerformanceMetrics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: string;
  win_rate: number;
  sharpe_ratio: number;
  max_drawdown: number;
}

// ===== Hook实现 =====

export const useAIStrategy = () => {
  const { api } = useApi();
  const account = useAccount();
  
  const [strategies, setStrategies] = useState<AIStrategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载用户的所有策略
   */
  const loadStrategies = useCallback(async () => {
    if (!api || !account) return;

    setLoading(true);
    setError(null);

    try {
      // 查询用户策略ID列表
      const strategyIds = await api.query.aiTrader.userStrategies(account.address);
      
      if (!strategyIds || strategyIds.isEmpty) {
        setStrategies([]);
        return;
      }

      // 加载每个策略的详细信息
      const strategyPromises = strategyIds.toJSON().map(async (id: number) => {
        const strategyData = await api.query.aiTrader.strategies(id);
        
        if (strategyData.isNone) return null;

        const strategy = strategyData.unwrap();
        
        return {
          strategy_id: id,
          owner: strategy.owner.toString(),
          name: strategy.name.toHuman(),
          symbol: strategy.symbol.toHuman(),
          ai_model: strategy.ai_model.type,
          strategy_type: strategy.strategy_type.type,
          enabled: strategy.enabled.valueOf(),
          model_config: {
            model: strategy.ai_model.type,
            confidence_threshold: strategy.ai_model.confidence_threshold.toNumber(),
            features: strategy.ai_model.features.toJSON(),
            endpoint: strategy.ai_model.endpoint.toHuman(),
          },
          risk_control: {
            max_position_size: strategy.risk_control.max_position_size.toString(),
            max_leverage: strategy.risk_control.max_leverage.toNumber(),
            stop_loss_pct: strategy.risk_control.stop_loss_pct.toNumber(),
            take_profit_pct: strategy.risk_control.take_profit_pct.toNumber(),
            max_daily_trades: strategy.risk_control.max_daily_trades.toNumber(),
            max_daily_loss: strategy.risk_control.max_daily_loss.toString(),
          },
          created_at: strategy.created_at.toString(),
          updated_at: strategy.updated_at.toString(),
        } as AIStrategy;
      });

      const loadedStrategies = (await Promise.all(strategyPromises)).filter(Boolean) as AIStrategy[];
      setStrategies(loadedStrategies);

    } catch (err: any) {
      console.error('加载策略失败:', err);
      setError(err.message || '加载策略失败');
    } finally {
      setLoading(false);
    }
  }, [api, account]);

  /**
   * 创建新策略
   */
  const createStrategy = useCallback(async (
    name: string,
    symbol: string,
    aiModel: AIModel,
    strategyType: StrategyType,
    modelConfig: AIModelConfig,
    riskControl: RiskControl
  ) => {
    if (!api || !account) {
      throw new Error('API或账户未初始化');
    }

    try {
      // 调用pallet的create_strategy extrinsic
      const tx = api.tx.aiTrader.createStrategy(
        name,
        symbol,
        { [aiModel]: null }, // 枚举类型
        { [strategyType]: null },
        {
          model: { [modelConfig.model]: null },
          confidence_threshold: modelConfig.confidence_threshold,
          features: modelConfig.features,
          endpoint: modelConfig.endpoint,
        },
        riskControl
      );

      // 签名并发送交易
      return new Promise((resolve, reject) => {
        tx.signAndSend(account.address, ({ status, events }) => {
          if (status.isInBlock) {
            console.log(`交易已打包到区块: ${status.asInBlock}`);
          }

          if (status.isFinalized) {
            console.log(`交易已完成: ${status.asFinalized}`);
            
            // 检查事件
            events.forEach(({ event }) => {
              if (api.events.system.ExtrinsicSuccess.is(event)) {
                resolve(status.asFinalized.toString());
              } else if (api.events.system.ExtrinsicFailed.is(event)) {
                reject(new Error('交易失败'));
              }
            });
          }
        }).catch(reject);
      });
    } catch (err: any) {
      console.error('创建策略失败:', err);
      throw err;
    }
  }, [api, account]);

  /**
   * 启用策略
   */
  const enableStrategy = useCallback(async (strategyId: number) => {
    if (!api || !account) {
      throw new Error('API或账户未初始化');
    }

    try {
      const tx = api.tx.aiTrader.enableStrategy(strategyId);
      
      return new Promise((resolve, reject) => {
        tx.signAndSend(account.address, ({ status }) => {
          if (status.isFinalized) {
            resolve(status.asFinalized.toString());
            loadStrategies(); // 重新加载
          }
        }).catch(reject);
      });
    } catch (err: any) {
      console.error('启用策略失败:', err);
      throw err;
    }
  }, [api, account, loadStrategies]);

  /**
   * 禁用策略
   */
  const disableStrategy = useCallback(async (strategyId: number) => {
    if (!api || !account) {
      throw new Error('API或账户未初始化');
    }

    try {
      const tx = api.tx.aiTrader.disableStrategy(strategyId);
      
      return new Promise((resolve, reject) => {
        tx.signAndSend(account.address, ({ status }) => {
          if (status.isFinalized) {
            resolve(status.asFinalized.toString());
            loadStrategies(); // 重新加载
          }
        }).catch(reject);
      });
    } catch (err: any) {
      console.error('禁用策略失败:', err);
      throw err;
    }
  }, [api, account, loadStrategies]);

  /**
   * 查询策略的AI信号历史
   */
  const getSignalHistory = useCallback(async (strategyId: number, limit: number = 10) => {
    if (!api) return [];

    try {
      // 获取信号ID列表
      const signalIds = await api.query.aiTrader.strategySignals(strategyId);
      
      if (!signalIds || signalIds.isEmpty) {
        return [];
      }

      // 获取最近的N条信号
      const ids = signalIds.toJSON().slice(-limit);
      
      const signalPromises = ids.map(async (signalId: number) => {
        const signalData = await api.query.aiTrader.signalRecords(strategyId, signalId);
        
        if (signalData.isNone) return null;

        const signal = signalData.unwrap();
        
        return {
          signal: signal.signal.type,
          confidence: signal.confidence.toNumber(),
          position_size: signal.position_size.toString(),
          entry_price: signal.entry_price.toString(),
          stop_loss: signal.stop_loss.isSome ? signal.stop_loss.unwrap().toString() : undefined,
          take_profit: signal.take_profit.isSome ? signal.take_profit.unwrap().toString() : undefined,
          reasoning: signal.reasoning.toHuman(),
          feature_importance: signal.feature_importance.toJSON(),
          timestamp: signal.timestamp.toString(),
        } as AITradeSignal;
      });

      return (await Promise.all(signalPromises)).filter(Boolean) as AITradeSignal[];
    } catch (err: any) {
      console.error('查询信号历史失败:', err);
      return [];
    }
  }, [api]);

  /**
   * 查询策略表现指标
   */
  const getPerformanceMetrics = useCallback(async (strategyId: number): Promise<PerformanceMetrics | null> => {
    if (!api) return null;

    try {
      const metricsData = await api.query.aiTrader.strategyPerformance(strategyId);
      
      if (metricsData.isNone) {
        return null;
      }

      const metrics = metricsData.unwrap();
      
      return {
        total_trades: metrics.total_trades.toNumber(),
        winning_trades: metrics.winning_trades.toNumber(),
        losing_trades: metrics.losing_trades.toNumber(),
        total_pnl: metrics.total_pnl.toString(),
        win_rate: metrics.win_rate.toNumber(),
        sharpe_ratio: metrics.sharpe_ratio.toNumber(),
        max_drawdown: metrics.max_drawdown.toNumber(),
      };
    } catch (err: any) {
      console.error('查询表现指标失败:', err);
      return null;
    }
  }, [api]);

  // 组件加载时自动加载策略
  useEffect(() => {
    if (api && account) {
      loadStrategies();
    }
  }, [api, account, loadStrategies]);

  return {
    strategies,
    loading,
    error,
    loadStrategies,
    createStrategy,
    enableStrategy,
    disableStrategy,
    getSignalHistory,
    getPerformanceMetrics,
  };
};

