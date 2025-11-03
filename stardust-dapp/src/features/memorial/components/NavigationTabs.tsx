/**
 * 纪念馆导航标签页组件
 * 
 * 功能说明：
 * 1. 提供多个标签页切换（首页、生平、相册、留言、家谱）
 * 2. 支持移动端横向滚动
 * 3. 高亮当前激活标签
 * 4. 支持自适应布局
 * 
 * 创建日期：2025-11-02
 */

import React from 'react'
import { Tabs } from 'antd'
import {
  HomeOutlined,
  FileTextOutlined,
  PictureOutlined,
  MessageOutlined,
  TeamOutlined,
  GiftOutlined,
} from '@ant-design/icons'
import { MemorialColors } from '../../../theme/colors'

export type TabKey = 'home' | 'biography' | 'photos' | 'messages' | 'family' | 'offerings'

interface NavigationTabsProps {
  /** 当前激活的标签 */
  activeTab: TabKey
  /** 标签切换回调 */
  onChange: (key: TabKey) => void
  /** 是否显示家谱标签 */
  showFamily?: boolean
  /** 是否显示供品标签 */
  showOfferings?: boolean
}

/**
 * 函数级详细中文注释：纪念馆导航标签页组件
 */
export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onChange,
  showFamily = true,
  showOfferings = true,
}) => {
  // 标签页配置
  const tabs = [
    {
      key: 'home' as TabKey,
      label: (
        <span>
          <HomeOutlined />
          <span style={{ marginLeft: 6 }}>首页</span>
        </span>
      ),
    },
    {
      key: 'biography' as TabKey,
      label: (
        <span>
          <FileTextOutlined />
          <span style={{ marginLeft: 6 }}>生平</span>
        </span>
      ),
    },
    {
      key: 'photos' as TabKey,
      label: (
        <span>
          <PictureOutlined />
          <span style={{ marginLeft: 6 }}>相册</span>
        </span>
      ),
    },
    {
      key: 'messages' as TabKey,
      label: (
        <span>
          <MessageOutlined />
          <span style={{ marginLeft: 6 }}>留言</span>
        </span>
      ),
    },
  ]

  // 可选标签
  if (showFamily) {
    tabs.push({
      key: 'family' as TabKey,
      label: (
        <span>
          <TeamOutlined />
          <span style={{ marginLeft: 6 }}>家谱</span>
        </span>
      ),
    })
  }

  if (showOfferings) {
    tabs.push({
      key: 'offerings' as TabKey,
      label: (
        <span>
          <GiftOutlined />
          <span style={{ marginLeft: 6 }}>供品</span>
        </span>
      ),
    })
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => onChange(key as TabKey)}
        items={tabs}
        centered={false}
        size="large"
        style={{
          margin: 0,
          padding: '0 12px',
        }}
        tabBarStyle={{
          margin: 0,
          borderBottom: `2px solid ${MemorialColors.borderLight}`,
        }}
        tabBarGutter={16}
      />
    </div>
  )
}

