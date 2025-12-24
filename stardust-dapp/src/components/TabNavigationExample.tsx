/**
 * TabNavigation 组件使用示例
 *
 * 展示如何在页面中使用标签导航栏组件
 */

import React, { useState } from 'react';
import { TabNavigation, TabItem } from './TabNavigation';

// 定义标签列表
const tabs: TabItem[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'chart', label: '基本排盘' },
  { key: 'advanced', label: '专业细盘' },
  { key: 'notes', label: '断事笔记' },
];

/**
 * 使用示例页面
 */
export const TabNavigationExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('basic');

  return (
    <div>
      {/* 顶部导航栏（如果有） */}
      <div style={{ height: '50px', backgroundColor: '#fff' }}>
        {/* 这里是顶部导航栏内容 */}
      </div>

      {/* 标签导航栏 */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        top={50}
      />

      {/* 内容占位区域 */}
      <div style={{ height: '56px' }}></div>

      {/* 内容区域 */}
      <div style={{ padding: '16px' }}>
        {activeTab === 'basic' && <div>基本信息内容</div>}
        {activeTab === 'chart' && <div>基本排盘内容</div>}
        {activeTab === 'advanced' && <div>专业细盘内容</div>}
        {activeTab === 'notes' && <div>断事笔记内容</div>}
      </div>
    </div>
  );
};

export default TabNavigationExample;
