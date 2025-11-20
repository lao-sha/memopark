/**
 * 函数级详细中文注释：伟人馆页面
 *
 * 功能特性：
 * - 顶部横幅：数风流人物 江山代有才人出·各领风骚数百年
 * - 伟人纪念馆：展示伟人头像网格（2行3列）
 * - 查看更多纪念馆链接
 * - 历史图片横幅
 * - 纪念馆留言列表
 *
 * 设计复刻自提供的截图
 */

import React, { useState } from 'react'
import { Avatar, Button, Input } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import './GreatPersonHallPage.css'

/**
 * 函数级详细中文注释：伟人接口
 */
interface GreatPerson {
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
 * 函数级详细中文注释：伟人馆页面组件
 */
const GreatPersonHallPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('伟人馆')

  /**
   * 函数级详细中文注释：处理分类点击事件
   */
  const handleCategoryClick = (category: string) => {
    setActiveCategory(category)
    if (category === '首页') {
      window.location.hash = '#/memorial'
    } else if (category === '名人馆') {
      window.location.hash = '#/memorial/celebrity'
    } else if (category === '英雄馆') {
      window.location.hash = '#/memorial/hero'
    } else if (category === '事件馆') {
      window.location.hash = '#/memorial/event'
    } else if (category === '院士馆') {
      window.location.hash = '#/memorial/academician'
    }
  }

  /**
   * 函数级详细中文注释：分类导航数据
   */
  const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆', '事件馆', '院士馆']

  /**
   * 函数级详细中文注释：伟人数据
   */
  const greatPersons: GreatPerson[] = [
    {
      id: 1,
      name: '毛主席',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 2,
      name: '周恩来',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 3,
      name: '邓小平',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 4,
      name: '陈独秀',
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 5,
      name: '朱德',
      avatar: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 6,
      name: '孙中山',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop&crop=face'
    }
  ]

  /**
   * 函数级详细中文注释：纪念馆留言数据
   */
  const messages: Message[] = [
    {
      id: 1,
      user: '刘雅宁',
      time: '11月10日 00:02',
      content: '清酒一杯，盛满了哀思，愿你天堂安康！',
      hallTag: '【祭伟人**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 2,
      user: '刘雅宁',
      time: '11月10日 00:01',
      content: '清酒一杯，盛满了哀思，愿你天堂安康！',
      hallTag: '【祭伟人**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 3,
      user: '刘雅宁',
      time: '11月10日 00:00',
      content: '致敬，缅怀！这盛世已如您所愿，山河无恙，国富民强！',
      hallTag: '纪念伟大**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 4,
      user: '祖泽为乐，感恩永念。',
      time: '11月08日 11:28',
      content: '致敬英雄邓小平',
      hallTag: '【祭伟人**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 5,
      user: '祖泽为乐，感恩永念。',
      time: '11月08日 11:28',
      content: '你走后，一切都在悄悄改变。唯有对你的思念，一生不变！',
      hallTag: '【祭伟人**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    }
  ]

  return (
    <div className="great-person-hall-page">
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

      {/* 顶部横幅 */}
      <div className="great-person-banner">
        <h1 className="banner-title">数风流人物</h1>
        <h2 className="banner-subtitle">江山代有才人出·各领风骚数百年</h2>
      </div>

      <div className="page-content">
        {/* 伟人纪念馆 */}
        <div className="section">
          <h3 className="section-title">伟人纪念馆</h3>
          <div className="great-person-grid">
            {greatPersons.map((person) => (
              <div key={person.id} className="great-person-item">
                <div className="great-person-avatar-wrapper">
                  <img src={person.avatar} alt={person.name} className="great-person-avatar" />
                </div>
                <div className="great-person-name">{person.name}</div>
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

        {/* 历史图片横幅 */}
        <div className="history-banner">
          <img
            src="https://images.unsplash.com/photo-1461344577544-4e5dc9487184?w=800&h=300&fit=crop"
            alt="历史图片"
            className="history-image"
          />
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

export default GreatPersonHallPage
