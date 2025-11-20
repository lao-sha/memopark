/**
 * 函数级详细中文注释：事件馆页面
 *
 * 功能特性：
 * - 顶部灰色横幅：历史大事记 铭记历史·不忘初心
 * - 事件纪念馆：列表式布局展示历史事件纪念馆
 * - 查看更多纪念馆链接
 * - 纪念馆留言列表
 *
 * 设计复刻自提供的截图
 */

import React, { useState } from 'react'
import { Avatar, Button, Input } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import './EventHallPage.css'

/**
 * 函数级详细中文注释：事件接口
 */
interface Event {
  id: number
  title: string
  description: string
  avatar: string
  hearts: number
  flowers: number
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
 * 函数级详细中文注释：事件馆页面组件
 */
const EventHallPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('事件馆')

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
    } else if (category === '院士馆') {
      window.location.hash = '#/memorial/academician'
    }
  }

  /**
   * 函数级详细中文注释：分类导航数据
   */
  const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆', '事件馆', '院士馆']

  /**
   * 函数级详细中文注释：事件数据
   */
  const events: Event[] = [
    {
      id: 1,
      title: '今天，一起接英雄回家！"山河记得您，我们记得您"，致敬抗美援朝...',
      description: '1950年10月19日下午5时30分，中国人...',
      avatar: 'https://images.unsplash.com/photo-1569025743873-ea3a9ade89f9?w=200&h=200&fit=crop',
      hearts: 1935,
      flowers: 670
    },
    {
      id: 2,
      title: '【国家公祭日】以国之名，祭奠南京大屠杀遇难同胞：87周年，我们从...',
      description: '1931至1945年中国抗日战争期间，中...',
      avatar: 'https://images.unsplash.com/photo-1461344577544-4e5dc9487184?w=200&h=200&fit=crop',
      hearts: 25269,
      flowers: 9888
    },
    {
      id: 3,
      title: '【沉痛哀悼】吴邦国同志永垂不朽！',
      description: '吴邦国同志1941年7月生，安徽肥东人...',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      hearts: 757,
      flowers: 590
    },
    {
      id: 4,
      title: '【七七事变88周年】今日中国再不是1937的中国',
      description: '1937年7月7日，卢沟桥畔一声枪响，拉...',
      avatar: 'https://images.unsplash.com/photo-1604881991720-f91add269bed?w=200&h=200&fit=crop',
      hearts: 3250,
      flowers: 951
    }
  ]

  /**
   * 函数级详细中文注释：纪念馆留言数据
   */
  const messages: Message[] = [
    {
      id: 1,
      user: '刘雅宁',
      time: '11月10日 00:07',
      content: '南京大屠杀纪念日，前事不忘后事之师，爱中华，强不忘。',
      hallTag: '【国家公**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 2,
      user: '刘雅宁',
      time: '11月10日 00:06',
      content: '清酒一杯，盛满了哀思，愿你天堂安康！',
      hallTag: '今天，一**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 3,
      user: '京强1319',
      time: '10月26日 04:25',
      content: '山河无恙，国泰民安，但那段充满硝烟的历史，我们铭记在心，永不敢忘',
      hallTag: '【七七事**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 4,
      user: '京强1319',
      time: '10月26日 04:25',
      content: '铭记历史，缅怀先烈，珍爱和平，吾辈自强',
      hallTag: '【七七事**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 5,
      user: '明月',
      time: '10月24日 21:36',
      content: '音容笑貌，历历在目；教敦教诲，犹在耳畔；青烟袅袅，遥寄思念。',
      hallTag: '沉痛悼念**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'
    }
  ]

  return (
    <div className="event-hall-page">
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

      {/* 顶部灰色横幅 */}
      <div className="event-banner">
        <div className="banner-decoration">📜</div>
        <div className="banner-content">
          <h1 className="banner-title">历史大事记</h1>
          <h2 className="banner-subtitle">铭记历史·不忘初心</h2>
        </div>
      </div>

      <div className="page-content">
        {/* 事件纪念馆列表 */}
        <div className="section">
          <h3 className="section-title">事件纪念馆</h3>
          <div className="event-list">
            {events.map((event) => (
              <div key={event.id} className="event-item">
                <div className="event-avatar-wrapper">
                  <img src={event.avatar} alt={event.title} className="event-avatar" />
                </div>
                <div className="event-info">
                  <h4 className="event-title">{event.title}</h4>
                  <p className="event-description">{event.description}</p>
                  <div className="event-stats">
                    <span className="hearts">🔥 {event.hearts.toLocaleString()}</span>
                    <span className="flowers">🌼 {event.flowers.toLocaleString()}</span>
                  </div>
                </div>
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

export default EventHallPage
