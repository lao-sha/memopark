/**
 * 函数级详细中文注释：英雄馆页面
 *
 * 功能特性：
 * - 顶部橙色横幅：纪念先烈 缅怀英雄
 * - 英雄纪念馆：列表式布局展示英雄纪念馆
 * - 查看更多纪念馆链接
 * - 历史图片横幅
 * - 纪念馆留言列表
 *
 * 设计复刻自提供的截图
 */

import React, { useState } from 'react'
import { Avatar, Button, Input } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import './HeroHallPage.css'

/**
 * 函数级详细中文注释：英雄接口
 */
interface Hero {
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
 * 函数级详细中文注释：英雄馆页面组件
 */
const HeroHallPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('英雄馆')

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
   * 函数级详细中文注释：英雄数据
   */
  const heroes: Hero[] = [
    {
      id: 1,
      title: '缅怀革命烈士，铭记历史',
      description: '一代人又一代人的长征路，几十年前的...',
      avatar: 'https://images.unsplash.com/photo-1569025743873-ea3a9ade89f9?w=200&h=200&fit=crop',
      hearts: 648642,
      flowers: 657613
    },
    {
      id: 2,
      title: '王伟',
      description: '王伟（1968年4月6日—2001年4月1日）...',
      avatar: 'https://images.unsplash.com/photo-1541752171745-4176eee47556?w=200&h=200&fit=crop',
      hearts: 18864,
      flowers: 9640
    },
    {
      id: 3,
      title: '致敬抗疫英雄',
      description: '2020年的春节，一场突如其来的疫情，...',
      avatar: 'https://images.unsplash.com/photo-1604881991720-f91add269bed?w=200&h=200&fit=crop',
      hearts: 125438,
      flowers: 56361
    },
    {
      id: 4,
      title: '陈乔年',
      description: '陈独秀次子，青年革命家，法国勤工俭...',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      hearts: 4986,
      flowers: 3147
    }
  ]

  /**
   * 函数级详细中文注释：纪念馆留言数据
   */
  const messages: Message[] = [
    {
      id: 1,
      user: '刘雅宁',
      time: '11月09日 23:59',
      content: '干秋伟业，山河为答，当以吾辈之青春，护盛世之中华！',
      hallTag: '缅怀革命**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 2,
      user: '程霄2561788',
      time: '11月08日 22:22',
      content: '你把青春融进祖国的山河，我用行动礼赞不朽的丰碑！',
      hallTag: '缅怀革命**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 3,
      user: '程霄2561788',
      time: '11月08日 22:21',
      content: '你们的功勋，祖国和人民没有忘记！你们的牺牲，我们永远铭记！英魂不逝，浩气长存！',
      hallTag: '缅怀革命**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 4,
      user: '程霄2561788',
      time: '11月08日 22:20',
      content: '铭记历史，缅怀先烈，人民不会忘记！',
      hallTag: '缅怀革命**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 5,
      user: '祖泽为乐，感恩永念。',
      time: '11月08日 11:22',
      content: '青山埋忠骨，山河念英魂。你们永远活在我们心里！',
      hallTag: '缅怀革命**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'
    }
  ]

  return (
    <div className="hero-hall-page">
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

      {/* 顶部橙色横幅 */}
      <div className="hero-banner">
        <div className="banner-soldiers">
          <div className="soldier">🎖️</div>
          <div className="soldier">🎖️</div>
          <div className="soldier">🎖️</div>
        </div>
        <div className="banner-content">
          <h1 className="banner-title">纪念先烈</h1>
          <h2 className="banner-subtitle">缅怀英雄</h2>
        </div>
      </div>

      <div className="page-content">
        {/* 英雄纪念馆列表 */}
        <div className="section">
          <h3 className="section-title">英雄纪念馆</h3>
          <div className="hero-list">
            {heroes.map((hero) => (
              <div key={hero.id} className="hero-item">
                <div className="hero-avatar-wrapper">
                  <img src={hero.avatar} alt={hero.title} className="hero-avatar" />
                </div>
                <div className="hero-info">
                  <h4 className="hero-title">{hero.title}</h4>
                  <p className="hero-description">{hero.description}</p>
                  <div className="hero-stats">
                    <span className="hearts">🔥 {hero.hearts.toLocaleString()}</span>
                    <span className="flowers">🌼 {hero.flowers.toLocaleString()}</span>
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

export default HeroHallPage
