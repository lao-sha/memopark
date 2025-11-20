/**
 * AI推理服务 - 前端客户端
 * 
 * 函数级详细中文注释：
 * 对接 AI 推理服务 API，提供交易信号生成、市场分析等AI功能。
 * 支持本地模型和 DeepSeek 混合推理架构。
 * 
 * @module aiInferenceService
 * @created 2025-11-04
 */

// ==================== 类型定义 ====================

/**
 * 函数级详细中文注释：市场数据输入
 */
export interface MarketData {
  /** 交易对符号（如 BTC-USD） */
  symbol: string;
  /** 当前价格 */
  current_price: number;
  /** 1小时价格序列（至少12个点，每5分钟） */
  prices_1h: number[];
  /** 24小时价格序列（至少288个点，每5分钟） */
  prices_24h: number[];
  /** 24小时成交量序列 */
  volumes_24h: number[];
  /** 买卖价差 */
  bid_ask_spread: number;
  /** 资金费率（可选） */
  funding_rate?: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 函数级详细中文注释：推理请求参数
 */
export interface InferenceRequest {
  /** 策略ID */
  strategy_id: number;
  /** 市场数据 */
  market_data: MarketData;
  /** 模型类型（lstm/local/ensemble） */
  model_type?: string;
  /** 置信度阈值（0-100） */
  confidence_threshold?: number;
}

/**
 * 函数级详细中文注释：交易信号
 */
export type TradingSignal = 'BUY' | 'SELL' | 'HOLD';

/**
 * 函数级详细中文注释：市场状况
 */
export type MarketCondition = 'Bullish' | 'Bearish' | 'Sideways' | 'Volatile';

/**
 * 函数级详细中文注释：推理结果
 */
export interface InferenceResult {
  /** 交易信号 */
  signal: TradingSignal;
  /** 置信度（0-100） */
  confidence: number;
  /** 建议仓位大小 */
  position_size: number;
  /** 入场价格 */
  entry_price: number;
  /** 止损价格 */
  stop_loss: number;
  /** 止盈价格 */
  take_profit: number;
  /** 推理依据 */
  reasoning: string;
  /** 特征重要性 */
  feature_importance: Record<string, number>;
  /** 风险评分（0-100） */
  risk_score: number;
  /** 市场状况 */
  market_condition: MarketCondition;
  /** 使用的模型 */
  models_used: string[];
  /** 推理耗时（毫秒） */
  inference_time_ms: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 函数级详细中文注释：服务健康状态
 */
export interface HealthStatus {
  /** 总体状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 各组件状态 */
  components: {
    redis: string;
    deepseek: string;
    local_model: string;
  };
  /** 时间戳 */
  timestamp: number;
}

// ==================== 核心服务类 ====================

/**
 * 函数级详细中文注释：AI推理服务类
 * 提供与 AI 推理服务的所有交互功能
 */
export class AIInferenceService {
  private baseURL: string;
  private timeout: number;

  /**
   * 函数级详细中文注释：构造函数
   * @param baseURL AI推理服务地址（默认 http://localhost:8000）
   * @param timeout 请求超时时间（毫秒，默认30000）
   */
  constructor(baseURL: string = 'http://localhost:8000', timeout: number = 30000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  /**
   * 函数级详细中文注释：健康检查
   * @returns 服务健康状态
   */
  async checkHealth(): Promise<HealthStatus> {
    const response = await this.request<HealthStatus>('/health', {
      method: 'GET',
    });
    return response;
  }

  /**
   * 函数级详细中文注释：获取交易信号
   * @param request 推理请求参数
   * @returns 推理结果
   */
  async getTradingSignal(request: InferenceRequest): Promise<InferenceResult> {
    const response = await this.request<InferenceResult>('/api/v1/inference', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response;
  }

  /**
   * 函数级详细中文注释：生成模拟市场数据（用于测试）
   * @param symbol 交易对
   * @param basePrice 基础价格
   * @returns 市场数据
   */
  generateMockMarketData(symbol: string, basePrice: number): MarketData {
    const now = Math.floor(Date.now() / 1000);
    const volatility = 0.02; // 2% 波动率

    // 生成1小时数据（12个点）
    const prices_1h: number[] = [];
    let price = basePrice;
    for (let i = 0; i < 12; i++) {
      const change = price * (Math.random() - 0.5) * volatility;
      price = price + change;
      prices_1h.push(parseFloat(price.toFixed(2)));
    }

    // 生成24小时数据（288个点）
    const prices_24h: number[] = [];
    price = basePrice * 0.98; // 从较低价格开始
    for (let i = 0; i < 288; i++) {
      const change = price * (Math.random() - 0.5) * volatility;
      price = price + change;
      prices_24h.push(parseFloat(price.toFixed(2)));
    }

    // 生成成交量数据
    const baseVolume = 1000;
    const volumes_24h: number[] = [];
    for (let i = 0; i < 288; i++) {
      const volume = baseVolume * (0.8 + Math.random() * 0.4);
      volumes_24h.push(parseFloat(volume.toFixed(2)));
    }

    return {
      symbol,
      current_price: basePrice,
      prices_1h,
      prices_24h,
      volumes_24h,
      bid_ask_spread: 0.01,
      funding_rate: 0.0001,
      timestamp: now,
    };
  }

  /**
   * 函数级详细中文注释：从实时价格生成市场数据
   * @param symbol 交易对
   * @param currentPrice 当前价格
   * @param historicalPrices 历史价格数组（按时间倒序）
   * @param volumes 历史成交量数组
   * @returns 市场数据
   */
  prepareMarketData(
    symbol: string,
    currentPrice: number,
    historicalPrices: number[],
    volumes: number[]
  ): MarketData {
    const now = Math.floor(Date.now() / 1000);

    // 确保数据长度足够
    const prices_1h = historicalPrices.slice(0, 12);
    const prices_24h = historicalPrices.slice(0, 288);
    const volumes_24h = volumes.slice(0, 288);

    // 如果数据不足，用模拟数据填充
    while (prices_1h.length < 12) {
      prices_1h.push(currentPrice * (1 + (Math.random() - 0.5) * 0.01));
    }
    while (prices_24h.length < 288) {
      prices_24h.push(currentPrice * (1 + (Math.random() - 0.5) * 0.02));
    }
    while (volumes_24h.length < 288) {
      volumes_24h.push(1000 * (0.8 + Math.random() * 0.4));
    }

    return {
      symbol,
      current_price: currentPrice,
      prices_1h,
      prices_24h,
      volumes_24h,
      bid_ask_spread: 0.01,
      timestamp: now,
    };
  }

  /**
   * 函数级详细中文注释：通用请求方法
   */
  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `请求失败: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('AI推理服务请求超时');
        }
        throw new Error(`AI推理服务错误: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * 函数级详细中文注释：创建 AI 推理服务单例
 */
let aiServiceInstance: AIInferenceService | null = null;

/**
 * 函数级详细中文注释：获取 AI 推理服务实例
 * @param baseURL 服务地址
 * @returns AI推理服务实例
 */
export function getAIInferenceService(baseURL?: string): AIInferenceService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIInferenceService(baseURL);
  }
  return aiServiceInstance;
}

/**
 * 函数级详细中文注释：重置服务实例（用于测试）
 */
export function resetAIServiceInstance(): void {
  aiServiceInstance = null;
}

// 导出默认实例
export default getAIInferenceService();

