/**
 * 函数级详细中文注释：伟人馆页面
 *
 * 功能特性：
 * - 顶部横幅：数风流人物 江山代有才人出·各领风骚数百年
 * - 伟人纪念馆：展示伟人头像网格（从链上查询 HistoricalFigure 分类）
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
import './GreatPersonHallPage.css'

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
  const { api } = usePolkadotApi()
  const [activeCategory, setActiveCategory] = useState('伟人馆')
  const [greatPersons, setGreatPersons] = useState<DeceasedInfo[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 函数级详细中文注释：加载伟人数据（HistoricalFigure 分类）
   */
  useEffect(() => {
    const loadGreatPersons = async () => {
      if (!api) return
      setLoading(true)
      try {
        const service = new DeceasedService(api)
        const data = await service.getDeceasedByCategory(DeceasedCategory.HistoricalFigure, 0, 20)
        setGreatPersons(data)
      } catch (error) {
        console.error('加载伟人馆数据失败:', error)
      }
      setLoading(false)
    }
    loadGreatPersons()
  }, [api])

  /**
   * 函数级详细中文注释：处理点击人物卡片，跳转到纪念馆详情页
   */
  const handlePersonClick = (person: DeceasedInfo) => {
    window.location.hash = `#/memorial/${person.id}`
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="加载中..." />
            </div>
          ) : greatPersons.length === 0 ? (
            <Empty description="暂无伟人纪念馆" />
          ) : (
            <div className="great-person-grid">
              {greatPersons.map((person) => (
                <div
                  key={person.id}
                  className="great-person-item"
                  onClick={() => handlePersonClick(person)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="great-person-avatar-wrapper">
                    <img
                      src={getAvatarUrl(person.mainImageCid)}
                      alt={person.name}
                      className="great-person-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
                      }}
                    />
                  </div>
                  <div className="great-person-name">{person.name}</div>
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

export default GreatPersonHallPage
