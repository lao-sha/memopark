/**
 * 函数级详细中文注释：院士馆页面
 *
 * 功能特性：
 * - 顶部深蓝色星空横幅：在科技强国的路上 让我们谨记这些国之脊梁
 * - 陨落的院士：3列网格布局展示院士（从链上查询 ReligiousFigure 分类）
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
import './AcademicianHallPage.css'

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
  const { api } = usePolkadotApi()
  const [activeCategory, setActiveCategory] = useState('院士馆')
  const [academicians, setAcademicians] = useState<DeceasedInfo[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 函数级详细中文注释：加载院士数据（ReligiousFigure 分类映射为院士）
   */
  useEffect(() => {
    const loadAcademicians = async () => {
      if (!api) return
      setLoading(true)
      try {
        const service = new DeceasedService(api)
        // 院士馆映射到 ReligiousFigure 分类（可以映射为学者/宗教人物）
        const data = await service.getDeceasedByCategory(DeceasedCategory.ReligiousFigure, 0, 20)
        setAcademicians(data)
      } catch (error) {
        console.error('加载院士馆数据失败:', error)
      }
      setLoading(false)
    }
    loadAcademicians()
  }, [api])

  /**
   * 函数级详细中文注释：处理点击院士卡片，跳转到纪念馆详情页
   */
  const handleAcademicianClick = (academician: DeceasedInfo) => {
    window.location.hash = `#/memorial/${academician.id}`
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="加载中..." />
            </div>
          ) : academicians.length === 0 ? (
            <Empty description="暂无院士纪念馆" />
          ) : (
            <div className="academician-grid">
              {academicians.map((academician) => (
                <div
                  key={academician.id}
                  className="academician-item"
                  onClick={() => handleAcademicianClick(academician)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="academician-avatar-wrapper">
                    <img
                      src={getAvatarUrl(academician.mainImageCid)}
                      alt={academician.name}
                      className="academician-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
                      }}
                    />
                  </div>
                  <div className="academician-name">{academician.name}</div>
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

export default AcademicianHallPage
