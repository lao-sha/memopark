/**
 * 函数级详细中文注释：名人馆页面
 *
 * 功能特性：
 * - 顶部横幅：星星会陨落 但信仰永不暗淡
 * - 名人纪念馆：展示名人头像网格（从链上查询 PublicFigure 分类）
 * - 查看更多纪念馆链接
 * - 纪念馆留言列表
 *
 * 设计复刻自提供的截图
 */

import React, { useState, useEffect } from 'react'
import { Avatar, Button, Input, Spin, Empty } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import { usePolkadotApi } from '../../hooks/usePolkadotApi'
import { DeceasedService, DeceasedCategory, type DeceasedInfo } from '../../services/deceasedService'
import './CelebrityHallPage.css'

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
  const { api } = usePolkadotApi()
  const [activeCategory, setActiveCategory] = useState('名人馆')
  const [celebrities, setCelebrities] = useState<DeceasedInfo[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 函数级详细中文注释：加载名人数据（PublicFigure 分类）
   */
  useEffect(() => {
    const loadCelebrities = async () => {
      if (!api) return
      setLoading(true)
      try {
        const service = new DeceasedService(api)
        const data = await service.getDeceasedByCategory(DeceasedCategory.PublicFigure, 0, 20)
        setCelebrities(data)
      } catch (error) {
        console.error('加载名人馆数据失败:', error)
      }
      setLoading(false)
    }
    loadCelebrities()
  }, [api])

  /**
   * 函数级详细中文注释：处理点击人物卡片，跳转到纪念馆详情页
   */
  const handleCelebrityClick = (celebrity: DeceasedInfo) => {
    window.location.hash = `#/memorial/${celebrity.id}`
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
    if (!cid) return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
    return `https://ipfs.io/ipfs/${cid}`
  }

  /**
   * 函数级详细中文注释：纪念馆留言数据（暂用模拟数据）
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
      content: '院士的伟大，不是只言片语可以表达。 我们要珍惜粮食的每一粒米饭，坚定不移的走下去的路，这才是对袁隆平院士的最大的缅怀。',
      hallTag: '纪念杂**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="加载中..." />
            </div>
          ) : celebrities.length === 0 ? (
            <Empty description="暂无名人纪念馆" />
          ) : (
            <div className="celebrity-grid">
              {celebrities.map((celebrity) => (
                <div
                  key={celebrity.id}
                  className="celebrity-item"
                  onClick={() => handleCelebrityClick(celebrity)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="celebrity-avatar-wrapper">
                    <img
                      src={getAvatarUrl(celebrity.mainImageCid)}
                      alt={celebrity.name}
                      className="celebrity-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
                      }}
                    />
                  </div>
                  <div className="celebrity-name">{celebrity.name}</div>
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
