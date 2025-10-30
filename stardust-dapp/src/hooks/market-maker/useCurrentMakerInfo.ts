import { useState, useEffect, useCallback } from 'react';
import { getApi } from '../../lib/polkadot';
import { decodeEpayField } from '../../utils/paymentUtils';

/**
 * 函数级详细中文注释：当前账户做市商信息数据结构
 * 
 * 用于MarketMakerConfigPage和MakerBridgeConfigPage
 * 包含完整的做市商配置信息和首购资金池数据
 */
export interface MarketMakerInfo {
  /** 做市商ID */
  mmId: number;
  /** 所有者地址 */
  owner: string;
  /** 状态（Active/Pending/Rejected等） */
  status: string;
  
  // === EPAY支付配置（用于OTC订单自动支付） ===
  /** EPAY网关地址 */
  epayGateway: string;
  /** EPAY端口 */
  epayPort: number;
  /** EPAY商户ID */
  epayPid: string;
  /** EPAY商户密钥 */
  epayKey: string;
  
  // === 业务配置（用于OTC和Bridge） ===
  /** TRON地址（OTC收款 + Bridge发款） */
  tronAddress: string;
  /** 业务方向（0=Buy, 1=Sell, 2=BuyAndSell） */
  direction: number;
  /** Buy溢价（基点） */
  buyPremiumBps: number;
  /** Sell溢价（基点） */
  sellPremiumBps: number;
  /** 最小交易金额 */
  minAmount: string;
  /** 公开资料CID */
  publicCid: string;
  /** 私有资料CID */
  privateCid: string;
  
  // === 首购资金池（仅限MarketMakerConfigPage使用） ===
  /** 首购资金池总额 */
  firstPurchasePool: string;
  /** 首购资金池已使用 */
  firstPurchaseUsed: string;
  /** 首购资金池已冻结 */
  firstPurchaseFrozen: string;
  /** 已服务用户数 */
  usersServed: number;
}

/**
 * 函数级详细中文注释：useCurrentMakerInfo Hook返回值接口
 */
export interface UseCurrentMakerInfoResult {
  /** 做市商ID（null表示未找到） */
  mmId: number | null;
  /** 做市商详细信息（null表示未找到） */
  makerInfo: MarketMakerInfo | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string;
  /** 重新加载函数 */
  reload: () => void;
}

/**
 * 函数级详细中文注释：useCurrentMakerInfo Hook
 * 
 * 用途：加载当前登录账户的做市商信息
 * 
 * 设计思路：
 * 1. 从localStorage获取当前登录账户地址
 * 2. 查询所有activeMarketMakers
 * 3. 找到owner匹配且status为Active的做市商
 * 4. 返回完整的做市商信息（包括首购资金池）
 * 
 * 适用场景：
 * - MarketMakerConfigPage：做市商配置管理
 * - MakerBridgeConfigPage：做市商跨链桥配置
 * 
 * @param currentAddress - 当前登录账户地址（可选，默认从localStorage读取）
 * @returns {UseCurrentMakerInfoResult} 做市商信息和状态
 * 
 * @example
 * ```tsx
 * const { mmId, makerInfo, loading, error, reload } = useCurrentMakerInfo();
 * 
 * if (loading) return <Spin />;
 * if (error) return <Alert type="error" message={error} />;
 * if (!makerInfo) return <Alert message="您还不是活跃做市商" />;
 * 
 * // 使用做市商信息
 * console.log('做市商ID:', mmId);
 * console.log('首购资金池:', makerInfo.firstPurchasePool);
 * ```
 */
export function useCurrentMakerInfo(
  currentAddress?: string
): UseCurrentMakerInfoResult {
  const [mmId, setMmId] = useState<number | null>(null);
  const [makerInfo, setMakerInfo] = useState<MarketMakerInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [nonce, setNonce] = useState<number>(0); // 用于强制重新加载

  // 重新加载函数
  const reload = useCallback(() => {
    setNonce(prev => prev + 1);
  }, []);

  useEffect(() => {
    /**
     * 函数级详细中文注释：加载当前账户的做市商信息
     * 
     * 执行流程：
     * 1. 获取当前账户地址（参数 > localStorage）
     * 2. 检查pallet-market-maker是否存在
     * 3. 查询所有activeMarketMakers
     * 4. 遍历找到owner匹配且status为Active的做市商
     * 5. 解析并返回完整信息
     */
    const loadCurrentMakerInfo = async () => {
      setLoading(true);
      setError('');

      try {
        // 1. 获取当前账户地址
        const address = currentAddress || localStorage.getItem('mp.current');
        
        console.log('[useCurrentMakerInfo] 检查登录状态，当前地址:', address);
        
        if (!address) {
          setError('未找到当前登录账户，请先登录');
          setLoading(false);
          return;
        }

        // 2. 连接API
        const api = await getApi();

        // 3. 检查pallet是否存在
        if (!(api.query as any).marketMaker) {
          setError('pallet-market-maker 不存在');
          setLoading(false);
          return;
        }

        // 4. 查询所有活跃做市商
        const entries = await (api.query as any).marketMaker.activeMarketMakers.entries();
        
        let foundMmId: number | null = null;
        let foundApp: any = null;
        
        // 5. 遍历查找当前账户的做市商
        for (const [key, value] of entries) {
          if (value.isSome) {
            const id = key.args[0].toNumber();
            const app = value.unwrap();
            const appData = app.toJSON() as any;
            
            // 检查是否属于当前账户且状态为Active
            if (
              appData.owner &&
              appData.owner.toLowerCase() === address.toLowerCase() &&
              appData.status === 'Active'
            ) {
              foundMmId = id;
              foundApp = appData;
              console.log('[useCurrentMakerInfo] 找到当前账户的做市商记录:', id, appData);
              break;
            }
          }
        }
        
        // 6. 检查是否找到
        if (foundMmId === null || !foundApp) {
          setError('您不是已激活的做市商，或者您的申请尚未通过审核');
          setMmId(null);
          setMakerInfo(null);
          setLoading(false);
          return;
        }

        // 7. 解析做市商信息（完整字段）
        const info: MarketMakerInfo = {
          mmId: foundMmId,
          owner: foundApp.owner || '',
          status: foundApp.status || 'Unknown',
          
          // EPAY支付配置
          epayGateway: decodeEpayField(foundApp.epayGateway),
          epayPort: foundApp.epayPort || 0,
          epayPid: decodeEpayField(foundApp.epayPid),
          epayKey: decodeEpayField(foundApp.epayKey),
          
          // 业务配置
          tronAddress: decodeEpayField(foundApp.tronAddress) || '',
          direction: foundApp.direction !== undefined ? Number(foundApp.direction) : 2,
          buyPremiumBps: foundApp.buyPremiumBps !== undefined ? Number(foundApp.buyPremiumBps) : 0,
          sellPremiumBps: foundApp.sellPremiumBps !== undefined ? Number(foundApp.sellPremiumBps) : 0,
          minAmount: foundApp.minAmount || '0',
          publicCid: decodeEpayField(foundApp.publicCid) || '',
          privateCid: decodeEpayField(foundApp.privateCid) || '',
          
          // 首购资金池
          firstPurchasePool: foundApp.firstPurchasePool || '0',
          firstPurchaseUsed: foundApp.firstPurchaseUsed || '0',
          firstPurchaseFrozen: foundApp.firstPurchaseFrozen || '0',
          usersServed: foundApp.usersServed || 0,
        };
        
        setMmId(foundMmId);
        setMakerInfo(info);
        
        console.log('[useCurrentMakerInfo] 做市商信息已加载:', info);
        
      } catch (e: any) {
        console.error('[useCurrentMakerInfo] 加载失败:', e);
        setError('加载做市商信息失败：' + (e?.message || '未知错误'));
        setMmId(null);
        setMakerInfo(null);
      } finally {
        setLoading(false);
      }
    };

    loadCurrentMakerInfo();
  }, [currentAddress, nonce]); // 当地址或nonce改变时重新加载

  return {
    mmId,
    makerInfo,
    loading,
    error,
    reload,
  };
}

