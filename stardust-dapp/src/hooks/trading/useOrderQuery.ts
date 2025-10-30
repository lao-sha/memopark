import { useState, useEffect, useCallback } from 'react';
import { getApi } from '../../lib/polkadot';

/**
 * 函数级详细中文注释：订单数据接口
 */
export interface OrderData {
  /** 订单ID */
  id: number;
  /** 挂单ID */
  listingId: number;
  /** 做市商地址 */
  maker: string;
  /** 买家地址 */
  taker: string;
  /** 价格 */
  price: string;
  /** 数量 */
  qty: string;
  /** 金额 */
  amount: string;
  /** 状态 */
  state: string;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expireAt: number;
  /** 支付承诺哈希 */
  paymentCommit: string;
  /** 联系方式承诺哈希 */
  contactCommit: string;
}

/**
 * 函数级详细中文注释：订单查询选项
 */
export interface UseOrderQueryOptions {
  /** 当前账户地址（用于过滤订单） */
  currentAccount?: string;
  /** 是否启用自动轮询 */
  autoPolling?: boolean;
  /** 轮询间隔（毫秒，默认5000） */
  pollingInterval?: number;
  /** 是否只查询作为taker的订单 */
  takerOnly?: boolean;
  /** 是否只查询作为maker的订单 */
  makerOnly?: boolean;
}

/**
 * 函数级详细中文注释：useOrderQuery Hook返回值接口
 */
export interface UseOrderQueryResult {
  /** 订单列表 */
  orders: OrderData[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string;
  /** 重新加载函数 */
  reload: () => void;
}

/**
 * 函数级详细中文注释：useOrderQuery Hook
 * 
 * 用途：统一管理订单查询和轮询
 * 
 * 设计思路：
 * 1. 查询链上所有订单（otcOrder.orders）
 * 2. 根据当前账户过滤订单（taker或maker）
 * 3. 解析订单数据并排序
 * 4. 支持自动轮询（可选）
 * 
 * 适用场景：
 * - MyOrdersCard：显示当前用户的所有订单
 * - SellerReleasePage：卖家释放MEMO页面
 * - 其他需要订单列表的场景
 * 
 * @param options - 查询选项
 * @returns {UseOrderQueryResult} 订单数据和状态
 * 
 * @example
 * ```tsx
 * // 查询当前用户的所有订单（自动轮询）
 * const { orders, loading, error, reload } = useOrderQuery({
 *   currentAccount: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
 *   autoPolling: true,
 * });
 * 
 * // 只查询作为买家的订单
 * const { orders } = useOrderQuery({
 *   currentAccount: address,
 *   takerOnly: true,
 * });
 * ```
 */
export function useOrderQuery(
  options: UseOrderQueryOptions = {}
): UseOrderQueryResult {
  const {
    currentAccount,
    autoPolling = false,
    pollingInterval = 5000,
    takerOnly = false,
    makerOnly = false,
  } = options;

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [nonce, setNonce] = useState<number>(0); // 用于强制重新加载

  // 重新加载函数
  const reload = useCallback(() => {
    setNonce(prev => prev + 1);
  }, []);

  useEffect(() => {
    /**
     * 函数级详细中文注释：加载订单列表
     * 
     * 执行流程：
     * 1. 连接到链上API
     * 2. 查询otcOrder.orders.entries()
     * 3. 过滤符合条件的订单
     * 4. 解析订单数据
     * 5. 按创建时间倒序排序
     */
    const loadOrders = async () => {
      if (!currentAccount) {
        setOrders([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        const api = await getApi();
        
        // 检查pallet是否存在
        if (!(api.query as any).otcOrder) {
          setError('OTC订单模块尚未在链上注册');
          setLoading(false);
          return;
        }

        // 查询所有订单
        const entries = await (api.query as any).otcOrder.orders.entries();
        
        console.log('[useOrderQuery] 查询到订单条目数:', entries.length);
        
        // 解析并过滤订单
        const myOrders: OrderData[] = [];
        for (const [key, value] of entries) {
          if (value.isSome) {
            const order = value.unwrap();
            const orderData = order.toJSON() as any;
            const orderId = key.args[0].toNumber();
            
            // 地址格式统一处理
            const takerAddress = String(orderData.taker || '').toLowerCase();
            const makerAddress = String(orderData.maker || '').toLowerCase();
            const currentAddr = String(currentAccount || '').toLowerCase();
            
            // 过滤条件
            let shouldInclude = false;
            
            if (takerOnly) {
              // 只查询作为买家的订单
              shouldInclude = takerAddress === currentAddr;
            } else if (makerOnly) {
              // 只查询作为卖家的订单
              shouldInclude = makerAddress === currentAddr;
            } else {
              // 查询所有相关订单（买家或卖家）
              shouldInclude = takerAddress === currentAddr || makerAddress === currentAddr;
            }
            
            if (shouldInclude) {
              // 处理状态枚举
              let stateStr = 'Created';
              if (typeof orderData.state === 'string') {
                stateStr = orderData.state;
              } else if (orderData.state && typeof orderData.state === 'object') {
                const keys = Object.keys(orderData.state);
                if (keys.length > 0) {
                  stateStr = keys[0].charAt(0).toUpperCase() + keys[0].slice(1);
                }
              }
              
              myOrders.push({
                id: orderId,
                listingId: orderData.listingId || 0,
                maker: orderData.maker || '',
                taker: orderData.taker || '',
                price: orderData.price || '0',
                qty: orderData.qty || '0',
                amount: orderData.amount || '0',
                state: stateStr,
                createdAt: orderData.createdAt || 0,
                expireAt: orderData.expireAt || 0,
                paymentCommit: orderData.paymentCommit || '',
                contactCommit: orderData.contactCommit || '',
              });
            }
          }
        }
        
        // 按创建时间倒序排列（最新的在前）
        myOrders.sort((a, b) => b.createdAt - a.createdAt);
        
        setOrders(myOrders);
        
        console.log('[useOrderQuery] 加载到', myOrders.length, '个订单');
      } catch (e: any) {
        console.error('[useOrderQuery] 加载订单失败:', e);
        setError(e?.message || '加载订单列表失败');
      } finally {
        setLoading(false);
      }
    };
    
    // 初始加载
    loadOrders();
    
    // 自动轮询（如果启用）
    if (autoPolling) {
      const interval = setInterval(loadOrders, pollingInterval);
      return () => clearInterval(interval);
    }
  }, [currentAccount, nonce, autoPolling, pollingInterval, takerOnly, makerOnly]); // 依赖项

  return {
    orders,
    loading,
    error,
    reload,
  };
}

