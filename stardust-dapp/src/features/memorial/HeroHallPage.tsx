/**
 * 函数级详细中文注释：英雄馆页面
 *
 * 功能特性：
 * - 顶部橙色横幅：纪念先烈 缅怀英雄
 * - 英雄纪念馆：列表式布局展示英雄纪念馆（从链上查询 Hero 分类）
 * - 查看更多纪念馆链接
 * - 历史图片横幅
 * - 纪念馆留言列表
 *
 * 设计复刻自提供的截图
 */

import React, { useState, useEffect } from 'react'
import { Avatar, Button, Input, Spin, Empty } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import { usePolkadotApi } from '../../hooks/usePolkadotApi'
import { DeceasedService, DeceasedCategory, type DeceasedInfo } from '../../services/deceasedService'
import './HeroHallPage.css'

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
  const { api } = usePolkadotApi()
  const [activeCategory, setActiveCategory] = useState('英雄馆')
  const [heroes, setHeroes] = useState<DeceasedInfo[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 函数级详细中文注释：加载英雄数据（Hero 分类）
   */
  useEffect(() => {
    const loadHeroes = async () => {
      if (!api) return
      setLoading(true)
      try {
        const service = new DeceasedService(api)
        const data = await service.getDeceasedByCategory(DeceasedCategory.Hero, 0, 20)
        setHeroes(data)
      } catch (error) {
        console.error('加载英雄馆数据失败:', error)
      }
      setLoading(false)
    }
    loadHeroes()
  }, [api])

  /**
   * 函数级详细中文注释：处理点击英雄卡片，跳转到纪念馆详情页
   */
  const handleHeroClick = (hero: DeceasedInfo) => {
    window.location.hash = `#/memorial/${hero.id}`
  }

  /**
   * 函数级详细中文注释：处理分类点击事件
   */
  const handleCategoryClick = (category: string) => {
    const routes: Record<string, string> = {
      '首页': '#/memorial',
      '陵园': '#/memorial',
      '名人馆': '#/memorial/celebrity',
      '伟人馆': '#/memorial/great-person',
      '英雄馆': '#/memorial/hero',
      '事件馆': '#/memorial/event',
      '院士馆': '#/memorial/academician'
    }
    const targetRoute = routes[category]
    if (targetRoute && window.location.hash !== targetRoute) {
      window.location.hash = targetRoute
    }
  }

  /**
   * 函数级详细中文注释：分类导航数据
   */
  const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆', '事件馆', '院士馆']

  /**
   * 函数级详细中文注释：获取头像URL
   */
  const getAvatarUrl = (cid: string) => {
    if (!cid) return 'https://images.unsplash.com/photo-1569025743873-ea3a9ade89f9?w=200&h=200&fit=crop'
    return `https://ipfs.io/ipfs/${cid}`
  }

  /**
   * 函数级详细中文注释：纪念馆留言数据（暂用模拟数据）
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="加载中..." />
            </div>
          ) : heroes.length === 0 ? (
            <Empty description="暂无英雄纪念馆" />
          ) : (
            <div className="hero-list">
              {heroes.map((hero) => (
                <div
                  key={hero.id}
                  className="hero-item"
                  onClick={() => handleHeroClick(hero)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="hero-avatar-wrapper">
                    <img
                      src={getAvatarUrl(hero.mainImageCid)}
                      alt={hero.name}
                      className="hero-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1569025743873-ea3a9ade89f9?w=200&h=200&fit=crop'
                      }}
                    />
                  </div>
                  <div className="hero-info">
                    <h4 className="hero-title">{hero.name}</h4>
                    <p className="hero-description">
                      {hero.birthTs && hero.deathTs
                        ? `${hero.birthTs.slice(0, 4)}年 - ${hero.deathTs.slice(0, 4)}年`
                        : '英雄事迹永载史册'}
                    </p>
                    <div className="hero-stats">
                      <span className="hearts">🔥 0</span>
                      <span className="flowers">🌼 0</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
