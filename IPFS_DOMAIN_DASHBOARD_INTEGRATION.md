# IPFS域扫描 Dashboard 集成指南

**日期**: 2025-11-18  
**版本**: v1.0  
**目标**: 前端集成域级监控功能

---

## 📋 快速开始

### 1. 安装依赖

```bash
npm install @polkadot/api @polkadot/api-contract
```

### 2. API 类型定义

创建 `types/ipfs.ts`:

```typescript
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
```

---

## 🔌 API 连接

### 创建 API 实例

```typescript
// hooks/useStardustApi.ts
import { ApiPromise, WsProvider } from '@polkadot/api';
import { useEffect, useState } from 'react';

export function useStardustApi() {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const connect = async () => {
      const provider = new WsProvider('ws://127.0.0.1:9944');
      const apiInstance = await ApiPromise.create({ provider });
      setApi(apiInstance);
      setIsReady(true);
    };

    connect();
  }, []);

  return { api, isReady };
}
```

---

## 📊 查询函数封装

### 创建 API 服务

```typescript
// services/ipfsDomainApi.ts
import { ApiPromise } from '@polkadot/api';
import { DomainStats, DomainWithPriority, DomainCid } from '../types/ipfs';

export class IpfsDomainApi {
  constructor(private api: ApiPromise) {}

  // 查询单个域统计
  async getDomainStats(domain: string): Promise<DomainStats | null> {
    const result = await this.api.query.stardustIpfs.domainHealthStats(domain);
    
    if (result.isNone) {
      return null;
    }

    const stats = result.unwrap();
    return {
      domain: Buffer.from(stats.domain).toString('utf8'),
      totalPins: stats.totalPins.toNumber(),
      totalSizeBytes: stats.totalSizeBytes.toNumber(),
      healthyCount: stats.healthyCount.toNumber(),
      degradedCount: stats.degradedCount.toNumber(),
      criticalCount: stats.criticalCount.toNumber(),
    };
  }

  // 查询所有域统计
  async getAllDomainStats(): Promise<DomainWithPriority[]> {
    const entries = await this.api.query.stardustIpfs.domainHealthStats.entries();
    const result: DomainWithPriority[] = [];

    for (const [key, value] of entries) {
      const domain = key.args[0].toString();
      const stats = value.unwrap();
      
      // 查询优先级
      const priorityResult = await this.api.query.stardustIpfs.domainPriority(domain);
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

    // 按优先级排序
    return result.sort((a, b) => a.priority - b.priority);
  }

  // 查询域的CID列表（分页）
  async getDomainCids(
    domain: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<DomainCid[]> {
    const domainBytes = new Uint8Array(Buffer.from(domain, 'utf8'));
    const result: DomainCid[] = [];

    // 使用 iter_prefix 遍历
    const entries = await this.api.query.stardustIpfs.domainPins.entries(domainBytes);
    
    const sliced = entries.slice(offset, offset + limit);
    
    for (const [key, _] of sliced) {
      const cidHash = key.args[1].toString();
      
      // 获取元数据
      const metaResult = await this.api.query.stardustIpfs.pinMeta(cidHash);
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
  }

  // 设置域优先级（需要Root权限）
  async setDomainPriority(
    domain: string,
    priority: number,
    signer: any
  ): Promise<void> {
    const tx = this.api.tx.stardustIpfs.setDomainPriority(domain, priority);
    await tx.signAndSend(signer);
  }

  // 监听域统计更新事件
  subscribeToStatsUpdates(callback: (stats: DomainStats) => void) {
    return this.api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (this.api.events.stardustIpfs.DomainStatsUpdated.is(event)) {
          const [domain, totalPins, totalSizeBytes, healthyCount, degradedCount, criticalCount] = event.data;
          
          callback({
            domain: Buffer.from(domain).toString('utf8'),
            totalPins: totalPins.toNumber(),
            totalSizeBytes: totalSizeBytes.toNumber(),
            healthyCount: healthyCount.toNumber(),
            degradedCount: degradedCount.toNumber(),
            criticalCount: criticalCount.toNumber(),
          });
        }
      });
    });
  }
}
```

---

## 🛠️ 工具函数

### 格式化工具

```typescript
// utils/formatters.ts

// 格式化字节大小
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// 计算健康率
export function calculateHealthRate(stats: DomainStats): number {
  if (stats.totalPins === 0) return 0;
  return (stats.healthyCount / stats.totalPins) * 100;
}

// 获取健康状态颜色
export function getHealthColor(healthRate: number): string {
  if (healthRate >= 95) return 'text-green-600';
  if (healthRate >= 80) return 'text-yellow-600';
  return 'text-red-600';
}

// 获取优先级标签
export function getPriorityLabel(priority: number): string {
  if (priority === 0) return '最高';
  if (priority <= 10) return '次高';
  if (priority <= 50) return '高';
  if (priority <= 100) return '普通';
  return '低';
}

// 获取优先级颜色
export function getPriorityColor(priority: number): string {
  if (priority === 0) return 'bg-red-100 text-red-800';
  if (priority <= 10) return 'bg-orange-100 text-orange-800';
  if (priority <= 50) return 'bg-yellow-100 text-yellow-800';
  if (priority <= 100) return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-800';
}
```

---

## 🎨 React 组件示例

### 1. 域监控面板

```typescript
// components/DomainMonitorPanel.tsx
import React, { useEffect, useState } from 'react';
import { useStardustApi } from '../hooks/useStardustApi';
import { IpfsDomainApi } from '../services/ipfsDomainApi';
import { DomainWithPriority } from '../types/ipfs';
import { formatBytes, calculateHealthRate, getHealthColor, getPriorityLabel } from '../utils/formatters';

export function DomainMonitorPanel() {
  const { api, isReady } = useStardustApi();
  const [domains, setDomains] = useState<DomainWithPriority[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !api) return;

    const loadDomains = async () => {
      const ipfsApi = new IpfsDomainApi(api);
      const data = await ipfsApi.getAllDomainStats();
      setDomains(data);
      setLoading(false);
    };

    loadDomains();
  }, [api, isReady]);

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">IPFS 域级监控面板</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">域名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pin数量</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">存储容量</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">健康率</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">优先级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {domains.map((item) => {
              const healthRate = calculateHealthRate(item.stats);
              return (
                <tr key={item.domain} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{item.domain}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.stats.totalPins.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatBytes(item.stats.totalSizeBytes)}</td>
                  <td className={`px-6 py-4 whitespace-nowrap font-semibold ${getHealthColor(healthRate)}`}>
                    {healthRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(item.priority)}`}>
                      {getPriorityLabel(item.priority)} ({item.priority})
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="text-blue-600 hover:text-blue-800">详情</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 2. 域详情页

```typescript
// components/DomainDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStardustApi } from '../hooks/useStardustApi';
import { IpfsDomainApi } from '../services/ipfsDomainApi';
import { DomainStats, DomainCid } from '../types/ipfs';
import { formatBytes } from '../utils/formatters';

export function DomainDetailPage() {
  const { domain } = useParams<{ domain: string }>();
  const { api, isReady } = useStardustApi();
  const [stats, setStats] = useState<DomainStats | null>(null);
  const [cids, setCids] = useState<DomainCid[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 20;

  useEffect(() => {
    if (!isReady || !api || !domain) return;

    const loadData = async () => {
      const ipfsApi = new IpfsDomainApi(api);
      
      // 加载统计
      const statsData = await ipfsApi.getDomainStats(domain);
      setStats(statsData);
      
      // 加载CID列表
      const cidsData = await ipfsApi.getDomainCids(domain, page * pageSize, pageSize);
      setCids(cidsData);
      
      setLoading(false);
    };

    loadData();
  }, [api, isReady, domain, page]);

  if (loading || !stats) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 统计概览 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold mb-6">域详情: {domain}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">总Pin数</div>
            <div className="text-2xl font-bold">{stats.totalPins.toLocaleString()}</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">存储容量</div>
            <div className="text-2xl font-bold">{formatBytes(stats.totalSizeBytes)}</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">健康状态</div>
            <div className="flex gap-2 mt-2">
              <span className="text-green-600">✓ {stats.healthyCount}</span>
              <span className="text-yellow-600">⚠ {stats.degradedCount}</span>
              <span className="text-red-600">✗ {stats.criticalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CID列表 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">CID 列表</h2>
        
        <div className="space-y-4">
          {cids.map((item) => (
            <div key={item.cidHash} className="border border-gray-200 rounded-lg p-4">
              <div className="font-mono text-sm text-gray-600 mb-2">{item.cidHash}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">副本数:</span>
                  <span className="ml-2 font-semibold">{item.metadata.replicas}</span>
                </div>
                <div>
                  <span className="text-gray-600">大小:</span>
                  <span className="ml-2 font-semibold">{formatBytes(item.metadata.size)}</span>
                </div>
                <div>
                  <span className="text-gray-600">创建时间:</span>
                  <span className="ml-2">{new Date(item.metadata.createdAt * 1000).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">最后活动:</span>
                  <span className="ml-2">{new Date(item.metadata.lastActivity * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 分页 */}
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
          >
            上一页
          </button>
          <span className="px-4 py-2">第 {page + 1} 页</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={cids.length < pageSize}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. 优先级设置组件

```typescript
// components/PrioritySettingModal.tsx
import React, { useState } from 'react';
import { useStardustApi } from '../hooks/useStardustApi';
import { IpfsDomainApi } from '../services/ipfsDomainApi';

interface Props {
  domain: string;
  currentPriority: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PrioritySettingModal({ domain, currentPriority, onClose, onSuccess }: Props) {
  const { api, isReady } = useStardustApi();
  const [priority, setPriority] = useState(currentPriority);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!api || !isReady) return;

    setLoading(true);
    try {
      const ipfsApi = new IpfsDomainApi(api);
      // 需要Root权限的账户
      const signer = /* 获取签名账户 */;
      await ipfsApi.setDomainPriority(domain, priority, signer);
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('设置优先级失败:', error);
      alert('设置失败，请确保拥有Root权限');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">设置域优先级</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            域名: <span className="font-mono">{domain}</span>
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            优先级 (0-255，0为最高)
          </label>
          <input
            type="number"
            min="0"
            max="255"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            推荐值: 0(最高), 10(次高), 20(高), 100(普通)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? '处理中...' : '确认'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 📱 完整Dashboard示例

```typescript
// pages/IpfsDashboard.tsx
import React from 'react';
import { DomainMonitorPanel } from '../components/DomainMonitorPanel';
import { Routes, Route } from 'react-router-dom';
import { DomainDetailPage } from '../components/DomainDetailPage';

export function IpfsDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">IPFS 域监控系统</h1>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<DomainMonitorPanel />} />
          <Route path="/domain/:domain" element={<DomainDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

---

## 🔔 实时更新

### 使用WebSocket订阅

```typescript
// hooks/useDomainStatsSubscription.ts
import { useEffect, useState } from 'react';
import { useStardustApi } from './useStardustApi';
import { IpfsDomainApi } from '../services/ipfsDomainApi';
import { DomainStats } from '../types/ipfs';

export function useDomainStatsSubscription() {
  const { api, isReady } = useStardustApi();
  const [latestUpdate, setLatestUpdate] = useState<DomainStats | null>(null);

  useEffect(() => {
    if (!isReady || !api) return;

    const ipfsApi = new IpfsDomainApi(api);
    const unsubscribe = ipfsApi.subscribeToStatsUpdates((stats) => {
      setLatestUpdate(stats);
      console.log('域统计更新:', stats);
    });

    return () => {
      unsubscribe();
    };
  }, [api, isReady]);

  return latestUpdate;
}
```

---

## 📦 完整项目结构

```
src/
├── components/
│   ├── DomainMonitorPanel.tsx
│   ├── DomainDetailPage.tsx
│   └── PrioritySettingModal.tsx
├── hooks/
│   ├── useStardustApi.ts
│   └── useDomainStatsSubscription.ts
├── services/
│   └── ipfsDomainApi.ts
├── types/
│   └── ipfs.ts
├── utils/
│   └── formatters.ts
└── pages/
    └── IpfsDashboard.tsx
```

---

## ✅ 集成检查清单

- [ ] 安装 @polkadot/api 依赖
- [ ] 创建类型定义
- [ ] 实现API服务层
- [ ] 创建工具函数
- [ ] 实现域监控面板组件
- [ ] 实现域详情页组件
- [ ] 添加优先级设置功能
- [ ] 集成实时更新
- [ ] 添加错误处理
- [ ] 添加加载状态
- [ ] 测试所有功能

---

**集成完成！** 🎉 现在你可以在Dashboard中监控所有域的IPFS统计了！
