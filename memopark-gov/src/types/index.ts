/**
 * 类型定义文件
 * 函数级中文注释：定义全局类型接口
 */

import type { ApiPromise } from '@polkadot/api';
import type { LocalKeystore } from '@/lib/keystore';

/**
 * 函数级中文注释：API Context 类型
 */
export interface ApiContextType {
  api: ApiPromise | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * 函数级中文注释：钱包 Store 类型
 */
export interface WalletStore {
  accounts: LocalKeystore[];
  currentAccount: LocalKeystore | null;
  balance: string;
  isLoading: boolean;
  error: string | null;
  setAccounts: (accounts: LocalKeystore[]) => void;
  setCurrentAccount: (account: LocalKeystore | null) => void;
  setBalance: (balance: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * 函数级中文注释：做市商申请状态
 */
export type ApplicationStatus = 
  | 'WaitingInfo'      // 等待提交资料
  | 'PendingReview'    // 待审核
  | 'Approved'         // 已批准
  | 'Rejected';        // 已驳回

/**
 * 函数级中文注释：做市商申请信息
 */
export interface MarketMakerApplication {
  mmId: number;
  owner: string;
  deposit: string;
  firstPurchasePool: string;
  status: ApplicationStatus;
  appliedAt: number;
  infoDeadline: number;
  reviewDeadline: number;
  businessCid?: string;
  contactCid?: string;
  
  // 提案信息
  proposalHash?: string;
  proposalIndex?: number;
  threshold?: number;
  ayesCount?: number;
  naysCount?: number;
  hasVoted?: boolean;
  canExecute?: boolean;
}

/**
 * 函数级中文注释：挂单方向
 */
export type Side = 'Buy' | 'Sell';

/**
 * 函数级中文注释：挂单信息
 */
export interface Listing {
  listingId: number;
  maker: string;
  side: Side;
  base: string;
  quote: string;
  pricingSpreadBps: number;
  minQty: string;
  maxQty: string;
  remaining: string;
  partial: boolean;
  createdAt: number;
  expireAt: number;
  priceMin?: string;
  priceMax?: string;
  termsCommit?: string;
  status: 'Active' | 'Cancelled' | 'Expired';
}

/**
 * 函数级中文注释：提案投票信息
 */
export interface ProposalVoting {
  index: number;
  threshold: number;
  ayes: string[];
  nays: string[];
  end: number;
}

