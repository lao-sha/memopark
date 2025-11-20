/**
 * IPFS域级监控类型定义
 * 
 * @date 2025-11-18
 */

export interface DomainStats {
  domain: string;
  totalPins: number;
  totalSizeBytes: number;
  healthyCount: number;
  degradedCount: number;
  criticalCount: number;
}

export interface DomainWithPriority {
  domain: string;
  stats: DomainStats;
  priority: number;
}

export interface PinMetadata {
  replicas: number;
  size: number;
  createdAt: number;
  lastActivity: number;
}

export interface DomainCid {
  cidHash: string;
  metadata: PinMetadata;
}

export interface DomainPriorityUpdate {
  domain: string;
  priority: number;
}
