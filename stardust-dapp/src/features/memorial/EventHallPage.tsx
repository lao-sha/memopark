/**
 * 函数级详细中文注释：事件馆页面
 *
 * 功能特性：
 * - 顶部灰色横幅：历史大事记 铭记历史·不忘初心
 * - 事件纪念馆：列表式布局展示历史事件纪念馆（从链上查询 EventHall 分类）
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
import './EventHallPage.css'

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
  const { api } = usePolkadotApi()
  const [activeCategory, setActiveCategory] = useState('事件馆')
  const [events, setEvents] = useState<DeceasedInfo[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 函数级详细中文注释：加载事件数据（EventHall 分类）
   */
  useEffect(() => {
    const loadEvents = async () => {
      if (!api) return
      setLoading(true)
      try {
        const service = new DeceasedService(api)
        const data = await service.getDeceasedByCategory(DeceasedCategory.EventHall, 0, 20)
        setEvents(data)
      } catch (error) {
        console.error('加载事件馆数据失败:', error)
      }
      setLoading(false)
    }
    loadEvents()
  }, [api])

  /**
   * 函数级详细中文注释：处理点击事件卡片，跳转到纪念馆详情页
   */
  const handleEventClick = (event: DeceasedInfo) => {
    window.location.hash = `#/memorial/${event.id}`
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="加载中..." />
            </div>
          ) : events.length === 0 ? (
            <Empty description="暂无事件纪念馆" />
          ) : (
            <div className="event-list">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="event-item"
                  onClick={() => handleEventClick(event)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="event-avatar-wrapper">
                    <img
                      src={getAvatarUrl(event.mainImageCid)}
                      alt={event.name}
                      className="event-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1569025743873-ea3a9ade89f9?w=200&h=200&fit=crop'
                      }}
                    />
                  </div>
                  <div className="event-info">
                    <h4 className="event-title">{event.name}</h4>
                    <p className="event-description">
                      {event.deathTs
                        ? `发生于 ${event.deathTs.slice(0, 4)}年`
                        : '历史事件纪念'}
                    </p>
                    <div className="event-stats">
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
