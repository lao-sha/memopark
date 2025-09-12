import React, { useEffect } from 'react';
import { useGovernanceStore, syncReferendumIdFromHash, listenHashChange } from './store'

/**
 * 函数级详细中文注释：治理首页页面（移动端优先）
 * - 作为治理模块入口，概览进行中/通过/拒绝统计与快捷入口（后续接入数据）
 * - 当前仅提供最小骨架，不依赖路由，确保项目可编译
 */
const GovernanceHomePage: React.FC = () => {
  const setId = useGovernanceStore(s => s.setReferendumId)
  useEffect(() => {
    syncReferendumIdFromHash(setId)
    const off = listenHashChange(setId)
    // 若解析到 id，则自动跳转详情
    if (window.location.hash.startsWith('#gov/')) {
      window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-detail' } }))
    }
    return off
  }, [])
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>治理总览</h2>
      <p style={{ color: '#666' }}>公投概览、我的投票与锁仓、提案入口将显示在此。</p>
    </div>
  );
};

export default GovernanceHomePage;


