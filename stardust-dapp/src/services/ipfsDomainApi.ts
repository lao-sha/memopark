/**
 * IPFS域级监控API服务
 * 
 * 提供域统计查询、CID列表查询、优先级设置等功能
 * 
 * @date 2025-11-18
 */

import { ApiPromise } from '@polkadot/api';
import type { Option, u64, u8 } from '@polkadot/types';
import type { Codec } from '@polkadot/types/types';
import type { DomainStats, DomainWithPriority, DomainCid } from '../types/ipfs-domain';

export class IpfsDomainApi {
  constructor(private api: ApiPromise) {}

  /**
   * 查询单个域的统计信息
   * @param domain 域名（如 "deceased"）
   * @returns 域统计信息，如果不存在返回null
   */
  async getDomainStats(domain: string): Promise<DomainStats | null> {
    try {
      const result = await this.api.query.stardustIpfs.domainHealthStats(domain) as Option<any>;
      
      if (result.isNone) {
        return null;
      }

      const stats = result.unwrap();
      return {
        domain: Buffer.from(stats.domain.toU8a()).toString('utf8'),
        totalPins: (stats.totalPins as u64).toNumber(),
        totalSizeBytes: (stats.totalSizeBytes as u64).toNumber(),
        healthyCount: (stats.healthyCount as u64).toNumber(),
        degradedCount: (stats.degradedCount as u64).toNumber(),
        criticalCount: (stats.criticalCount as u64).toNumber(),
      };
    } catch (error) {
      console.error(`Error fetching stats for domain ${domain}:`, error);
      return null;
    }
  }

  /**
   * 查询所有域的统计信息（按优先级排序）
   * @returns 所有域的统计列表
   */
  async getAllDomainStats(): Promise<DomainWithPriority[]> {
    try {
      const entries = await this.api.query.stardustIpfs.domainHealthStats.entries();
      const result: DomainWithPriority[] = [];

      for (const [key, value] of entries) {
        const domainBytes = key.args[0];
        const domain = Buffer.from(domainBytes.toU8a()).toString('utf8');
        const stats = (value as Option<any>).unwrap();
        
        // 查询优先级
        const priorityResult = await this.api.query.stardustIpfs.domainPriority(domainBytes) as u8;
        const priority = priorityResult.toNumber();

        result.push({
          domain,
          stats: {
            domain,
            totalPins: stats.totalPins.toNumber(),
            totalSizeBytes: stats.totalSizeBytes.toNumber(),
            healthyCount: stats.healthyCount.toNumber(),
            degradedCount: stats.degradedCount.toNumber(),
            criticalCount: stats.criticalCount.toNumber(),
          },
          priority,
        });
      }

      // 按优先级排序（优先级越小越靠前）
      return result.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      console.error('Error fetching all domain stats:', error);
      return [];
    }
  }

  /**
   * 查询域的CID列表（分页）
   * @param domain 域名
   * @param offset 偏移量
   * @param limit 每页数量（最大100）
   * @returns CID列表
   */
  async getDomainCids(
    domain: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<DomainCid[]> {
    try {
      const domainBytes = new Uint8Array(Buffer.from(domain, 'utf8'));
      const result: DomainCid[] = [];

      // 获取所有entries
      const entries = await this.api.query.stardustIpfs.domainPins.entries(domainBytes);
      
      // 分页
      const sliced = entries.slice(offset, offset + Math.min(limit, 100));
      
      for (const [key, _] of sliced) {
        const cidHash = key.args[1].toHex();
        
        // 获取元数据
        const metaResult = await this.api.query.stardustIpfs.pinMeta(cidHash) as Option<any>;
        if (metaResult.isSome) {
          const meta = metaResult.unwrap();
          result.push({
            cidHash,
            metadata: {
              replicas: meta.replicas.toNumber(),
              size: meta.size.toNumber(),
              createdAt: meta.createdAt.toNumber(),
              lastActivity: meta.lastActivity.toNumber(),
            },
          });
        }
      }

      return result;
    } catch (error) {
      console.error(`Error fetching CIDs for domain ${domain}:`, error);
      return [];
    }
  }

  /**
   * 设置域优先级（需要Root权限）
   * @param domain 域名
   * @param priority 优先级（0-255）
   * @param signer 签名账户
   */
  async setDomainPriority(
    domain: string,
    priority: number,
    signer: any
  ): Promise<void> {
    const tx = this.api.tx.stardustIpfs.setDomainPriority(domain, priority);
    await tx.signAndSend(signer);
  }

  /**
   * 监听域统计更新事件
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribeToStatsUpdates(callback: (stats: DomainStats) => void) {
    return this.api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (this.api.events.stardustIpfs.DomainStatsUpdated.is(event)) {
          const data = event.data as any;
          const domain = Buffer.from(data[0]).toString('utf8');
          
          callback({
            domain,
            totalPins: data[1].toNumber(),
            totalSizeBytes: data[2].toNumber(),
            healthyCount: data[3].toNumber(),
            degradedCount: data[4].toNumber(),
            criticalCount: data[5].toNumber(),
          });
        }
      });
    });
  }

  /**
   * 监听优先级设置事件
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribeToPriorityUpdates(callback: (domain: string, priority: number) => void) {
    return this.api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (this.api.events.stardustIpfs.DomainPrioritySet.is(event)) {
          const data = event.data as any;
          const domain = Buffer.from(data[0]).toString('utf8');
          const priority = data[1].toNumber();
          callback(domain, priority);
        }
      });
    });
  }
}
