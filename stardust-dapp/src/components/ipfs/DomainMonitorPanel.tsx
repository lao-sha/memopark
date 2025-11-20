/**
 * IPFS域监控面板组件
 * 
 * 展示所有域的统计信息，包括Pin数量、存储容量、健康率等
 * 
 * @date 2025-11-18
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { IpfsDomainApi } from '../../services/ipfsDomainApi';
import type { DomainWithPriority } from '../../types/ipfs-domain';
import {
  formatBytes,
  calculateHealthRate,
  getHealthColor,
  getPriorityLabel,
  getPriorityColor,
} from '../../utils/ipfsFormatters';

export function DomainMonitorPanel() {
  const api = useApi();
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DomainWithPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;

    const loadDomains = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const ipfsApi = new IpfsDomainApi(api);
        const data = await ipfsApi.getAllDomainStats();
        setDomains(data);
      } catch (err) {
        console.error('Failed to load domain stats:', err);
        setError('加载域统计失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    loadDomains();
    
    // 每30秒刷新一次
    const interval = setInterval(loadDomains, 30000);
    return () => clearInterval(interval);
  }, [api]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载域统计中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
        暂无域统计数据
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">IPFS 域级监控面板</h2>
        <p className="mt-1 text-sm text-gray-600">
          共 {domains.length} 个域 · 总Pin数 {domains.reduce((sum, d) => sum + d.stats.totalPins, 0).toLocaleString()}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                域名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pin数量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                存储容量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                健康率
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                健康分布
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                优先级
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {domains.map((item) => {
              const healthRate = calculateHealthRate(item.stats);
              const stats = item.stats;
              
              return (
                <tr 
                  key={item.domain} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/ipfs/domain/${item.domain}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{item.domain}</div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-semibold">
                      {stats.totalPins.toLocaleString()}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatBytes(stats.totalSizeBytes)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-semibold ${getHealthColor(healthRate)}`}>
                      {healthRate.toFixed(1)}%
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-600" title="健康">
                        ✓ {stats.healthyCount}
                      </span>
                      <span className="text-yellow-600" title="降级">
                        ⚠ {stats.degradedCount}
                      </span>
                      <span className="text-red-600" title="危险">
                        ✗ {stats.criticalCount}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                      {getPriorityLabel(item.priority)} ({item.priority})
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/ipfs/domain/${item.domain}`);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      查看详情 →
                    </button>
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
