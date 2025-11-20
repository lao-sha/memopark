/**
 * 函数级详细中文注释：名人馆页面
 *
 * 功能特性：
 * - 顶部横幅：星星会陨落 但信仰永不暗淡
 * - 名人纪念馆：展示名人头像网格
 * - 查看更多纪念馆链接
 * - 纪念馆留言列表
 *
 * 设计复刻自提供的截图
 */

import React, { useState } from 'react'
import { Avatar, Button, Input } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import './CelebrityHallPage.css'

/**
 * 函数级详细中文注释：名人接口
 */
interface Celebrity {
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
 * 函数级详细中文注释：名人馆页面组件
 */
const CelebrityHallPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('名人馆')

  /**
   * 函数级详细中文注释：处理分类点击事件
   */
  const handleCategoryClick = (category: string) => {
    setActiveCategory(category)
    if (category === '首页') {
      window.location.hash = '#/memorial'
    } else if (category === '伟人馆') {
      window.location.hash = '#/memorial/great-person'
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
   * 函数级详细中文注释：名人数据
   */
  const celebrities: Celebrity[] = [
    {
      id: 1,
      name: '袁隆平',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 2,
      name: '张国荣',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 3,
      name: '琼瑶',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b60c57a4?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 4,
      name: '吴寿友',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 5,
      name: '宗庆后',
      avatar: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 6,
      name: '李玟',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 7,
      name: '二月河',
      avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 8,
      name: '余光中',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop&crop=face'
    },
    {
      id: 9,
      name: '吴玉章',
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=200&h=200&fit=crop&crop=face'
    }
  ]

  /**
   * 函数级详细中文注释：纪念馆留言数据
   */
  const messages: Message[] = [
    {
      id: 1,
      user: '刘雅宁',
      time: '11月10日 00:08',
      content: '一路走好，永远怀念',
      hallTag: '【悼念】**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 2,
      user: '刘雅宁',
      time: '11月10日 00:05',
      content: '又逢阳春三月，每每这时候，脑海里总是会自然而然的出现哥哥的身影。',
      hallTag: '【4.1**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 3,
      user: '刘雅宁',
      time: '11月10日 00:03',
      content: '院士的伟大，不是只言片语可以表达。 我们要珍惜粮食的每一粒米饭，坚定不移的走下去的路，这才是对袁隆平院士的最大的缅怀。之所以伟大，是因为他用了一生的时间给予了我们全国人民美好的生活。一辈一饭，当思来处不易半丝半缕，恒念物力为艰。',
      hallTag: '纪念杂**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 4,
      user: '周冬梅',
      time: '11月06日 15:50',
      content: '一路走好，永远怀念',
      hallTag: '【悼念】**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 5,
      user: '没有了',
      time: '11月01日 18:40',
      content: '一路走好天堂没有病痛。',
      hallTag: '香港著名**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'
    }
  ]

  return (
    <div className="celebrity-hall-page">
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
      <div className="celebrity-banner">
        <div className="banner-stars">⭐</div>
        <h1 className="banner-title">星星会陨落</h1>
        <h2 className="banner-subtitle">但信仰永不暗淡</h2>
      </div>

      <div className="page-content">
        {/* 名人纪念馆 */}
        <div className="section">
          <h3 className="section-title">名人纪念馆</h3>
          <div className="celebrity-grid">
            {celebrities.map((celebrity) => (
              <div key={celebrity.id} className="celebrity-item">
                <div className="celebrity-avatar-wrapper">
                  <img src={celebrity.avatar} alt={celebrity.name} className="celebrity-avatar" />
                </div>
                <div className="celebrity-name">{celebrity.name}</div>
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

export default CelebrityHallPage
