/**
 * 函数级详细中文注释：院士馆页面
 *
 * 功能特性：
 * - 顶部深蓝色星空横幅：在科技强国的路上 让我们谨记这些国之脊梁
 * - 陨落的院士：3列网格布局展示院士
 * - 查看更多纪念馆链接
 * - 纪念馆留言列表
 *
 * 设计复刻自提供的截图
 */

import React, { useState } from 'react'
import { Avatar, Button, Input } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import './AcademicianHallPage.css'

/**
 * 函数级详细中文注释：院士接口
 */
interface Academician {
  id: number
  name: string
  avatar: string
}

/**
 * 函数级详细中文注释：留言接口
 */
interface Message {
  id: number
  user: string
  time: string
  content: string
  hallTag?: string
  avatar: string
}

/**
 * 函数级详细中文注释：院士馆页面组件
 */
const AcademicianHallPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('院士馆')

  /**
   * 函数级详细中文注释：处理分类点击事件
   */
  const handleCategoryClick = (category: string) => {
    setActiveCategory(category)
    if (category === '首页') {
      window.location.hash = '#/memorial'
    } else if (category === '名人馆') {
      window.location.hash = '#/memorial/celebrity'
    } else if (category === '伟人馆') {
      window.location.hash = '#/memorial/great-person'
    } else if (category === '英雄馆') {
      window.location.hash = '#/memorial/hero'
    } else if (category === '事件馆') {
      window.location.hash = '#/memorial/event'
    }
  }

  /**
   * 函数级详细中文注释：分类导航数据
   */
  const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆', '事件馆', '院士馆']

  /**
   * 函数级详细中文注释：院士数据
   */
  const academicians: Academician[] = [
    {
      id: 1,
      name: '钱学森',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 2,
      name: '黄旭华',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 3,
      name: '吴孟超',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 4,
      name: '郭永怀',
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 5,
      name: '任新民',
      avatar: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 6,
      name: '陈省身',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 7,
      name: '吴有训',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 8,
      name: '师昌绪',
      avatar: 'https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 9,
      name: '徐光宪',
      avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=200&h=200&fit=crop&crop=face'
    }
  ]

  /**
   * 函数级详细中文注释：纪念馆留言数据
   */
  const messages: Message[] = [
    {
      id: 1,
      user: '刘雅宁',
      time: '11月10日 00:04',
      content: '致敬黄老，一路走好！',
      hallTag: '【沉痛悼**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 2,
      user: '刘雅宁',
      time: '11月10日 00:04',
      content: '清酒一杯，盛满了哀思，愿你天堂安康！',
      hallTag: '【致敬】**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 3,
      user: '偏意仁兔',
      time: '10月18日 16:08',
      content: '致敬。',
      hallTag: '【致敬】**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 4,
      user: '杨成',
      time: '10月06日 07:49',
      content: '永远怀念！',
      hallTag: '【沉痛悼**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 5,
      user: '刘雅宁',
      time: '09月28日 14:13',
      content: '送别！致敬黄爷爷！永远都不会忘记您，谢谢您为中国所做的贡献，我们会一直铭记您！',
      hallTag: '【沉痛悼**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    }
  ]

  return (
    <div className="academician-hall-page">
      {/* 顶部搜索栏 */}
      <div className="header-search">
        <div className="search-container">
          <Input
            prefix={<SearchOutlined style={{ color: '#fff' }} />}
            placeholder="搜索馆名或人名"
            className="search-input"
          />
          <CalendarOutlined className="calendar-icon" />
        </div>
      </div>

      {/* 分类导航 */}
      <div className="category-nav">
        {categories.map((category) => (
          <div
            key={category}
            className={`category-item ${activeCategory === category ? 'active' : ''}`}
            onClick={() => handleCategoryClick(category)}
          >
            {category}
            {activeCategory === category && <div className="category-underline" />}
          </div>
        ))}
      </div>

      {/* 顶部深蓝色星空横幅 */}
      <div className="academician-banner">
        <h1 className="banner-title">在科技强国的路上</h1>
        <h2 className="banner-subtitle">让我们谨记这些国之脊梁</h2>
      </div>

      <div className="page-content">
        {/* 陨落的院士 */}
        <div className="section">
          <h3 className="section-title">陨落的院士</h3>
          <div className="academician-grid">
            {academicians.map((academician) => (
              <div key={academician.id} className="academician-item">
                <div className="academician-avatar-wrapper">
                  <img src={academician.avatar} alt={academician.name} className="academician-avatar" />
                </div>
                <div className="academician-name">{academician.name}</div>
              </div>
            ))}
          </div>

          {/* 查看更多链接 */}
          <div className="view-more-section">
            <Button type="text" className="view-more-btn">
              查看更多纪念馆 →
            </Button>
          </div>
        </div>

        {/* 纪念馆留言 */}
        <div className="section">
          <h3 className="section-title">纪念馆留言</h3>
          <div className="message-list">
            {messages.map((message) => (
              <div key={message.id} className="message-item">
                <Avatar size={40} src={message.avatar} className="user-avatar" />
                <div className="message-content">
                  <div className="message-header">
                    <span className="username">{message.user}</span>
                    <span className="time">{message.time}</span>
                  </div>
                  <p className="message-text">{message.content}</p>
                  {message.hallTag && (
                    <div className="message-tag">
                      🏛️ {message.hallTag}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部间距 */}
        <div className="bottom-spacing" />
      </div>
    </div>
  )
}

export default AcademicianHallPage
