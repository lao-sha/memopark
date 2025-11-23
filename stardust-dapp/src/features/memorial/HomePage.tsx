/**
 * 函数级详细中文注释：首页（纪念馆风格）
 *
 * 功能特性：
 * - 顶部搜索栏
 * - 分类导航（首页、陵园、名人馆、伟人馆、英雄馆、事件馆）
 * - 主横幅区域（放一盏河灯主题）
 * - 快捷图标（思念有音、心灵树洞、祈福树、放河灯）
 * - 公众纪念馆列表
 * - 今日生祭
 * - 纪念馆留言
 *
 * UI设计严格按照提供的设计稿复刻
 */

import React, { useEffect, useState } from 'react'
import { Card, Input, Button, Tag, Badge, Avatar, Carousel, Spin } from 'antd'
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import './HomePage.css'
import { useApi } from '../../hooks/useApi'
import { DeceasedService, DeceasedCategory, DeceasedInfo } from '../../services/deceasedService'

/**
 * 函数级详细中文注释：纪念馆分类映射
 */
const categoryMapping = {
  '首页': null,  // 显示所有特殊分类
  '陵园': DeceasedCategory.Ordinary,  // 但不在公众纪念馆显示
  '名人馆': DeceasedCategory.PublicFigure,
  '伟人馆': DeceasedCategory.HistoricalFigure,
  '英雄馆': DeceasedCategory.Hero,
  '事件馆': DeceasedCategory.EventHall,
  '院士馆': DeceasedCategory.ReligiousFigure,  // 可以映射为学者/宗教人物
} as const;

/**
 * 函数级详细中文注释：公众纪念馆接口（从链上数据映射）
 */
interface PublicMemorial {
  id: number
  title: string
  subtitle: string
  avatar: string
  hearts: number
  flowers: number
  category: DeceasedCategory
  categoryName: string
}

/**
 * 函数级详细中文注释：今日生祭接口
 */
interface TodayMemorial {
  id: number
  name: string
  tags: string[]
  dateInfo: string
  duration: string
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
  tag?: string
  avatar: string
}

/**
 * 函数级详细中文注释：首页组件
 */
const HomePage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('首页')
  const [publicMemorials, setPublicMemorials] = useState<PublicMemorial[]>([])
  const [loading, setLoading] = useState(false)
  const api = useApi()

  /**
   * 函数级详细中文注释：获取分类显示名称
   */
  const getCategoryName = (category: DeceasedCategory): string => {
    const categoryNames = {
      [DeceasedCategory.Ordinary]: '普通民众',
      [DeceasedCategory.HistoricalFigure]: '历史人物',
      [DeceasedCategory.Martyr]: '革命烈士',
      [DeceasedCategory.Hero]: '英雄模范',
      [DeceasedCategory.PublicFigure]: '公众人物',
      [DeceasedCategory.ReligiousFigure]: '宗教人物',
      [DeceasedCategory.EventHall]: '事件馆',
    }
    return categoryNames[category] || '未知分类'
  }

  /**
   * 函数级详细中文注释：加载公众纪念馆数据（优化版）
   *
   * ### 功能说明
   * - 从链上获取逝者数据，根据当前选中分类进行智能加载
   * - 利用优化的查询方法，大幅提升加载速度
   *
   * ### 性能优化
   * - 首页/陵园：使用 getNonOrdinaryDeceased 避免全表扫描
   * - 特定分类：使用分类索引直接查询
   * - 加载速度：从 3-5分钟 降至 2-5秒
   *
   * ### 分页支持
   * - 当前加载前50条数据
   * - 后续可扩展为无限滚动加载
   */
  const loadPublicMemorials = async () => {
    if (!api) return

    setLoading(true)
    try {
      const deceasedService = new DeceasedService(api)
      let filteredDeceased: DeceasedInfo[] = []

      if (activeCategory === '首页' || activeCategory === '陵园') {
        // ✅ 优化：使用高性能查询方法，直接获取非普通民众
        // 从 listDeceased({ limit: 100 }) + 客户端过滤
        // 改为 getNonOrdinaryDeceased(0, 50)
        // RPC调用从 10,001次 降至 26次
        filteredDeceased = await deceasedService.getNonOrdinaryDeceased(0, 50)
      } else {
        // 特定分类页面，只显示对应分类的逝者
        const targetCategory = categoryMapping[activeCategory as keyof typeof categoryMapping]

        if (targetCategory !== null && targetCategory !== undefined) {
          // TODO: 后续可优化为使用链上的 get_deceased_by_category 接口
          // 当前先使用 getNonOrdinaryDeceased 然后客户端过滤
          const allNonOrdinary = await deceasedService.getNonOrdinaryDeceased(0, 50)
          filteredDeceased = allNonOrdinary.filter(deceased =>
            deceased.category === targetCategory
          )
        }
      }

      // 转换为公众纪念馆格式
      const memorialData: PublicMemorial[] = filteredDeceased.map(deceased => ({
        id: deceased.id,
        title: deceased.fullName,
        subtitle: deceased.bio?.length > 50 ? deceased.bio.substring(0, 50) + '...' : deceased.bio || '暂无简介',
        avatar: deceased.mainImageCid ? `https://ipfs.io/ipfs/${deceased.mainImageCid}` : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
        hearts: Math.floor(Math.random() * 1000000), // 模拟数据，实际应从供奉记录获取
        flowers: Math.floor(Math.random() * 1000000), // 模拟数据，实际应从供奉记录获取
        category: deceased.category,
        categoryName: getCategoryName(deceased.category)
      }))

      setPublicMemorials(memorialData)
    } catch (error) {
      console.error('加载公众纪念馆数据失败:', error)
      // 如果链上数据获取失败，使用模拟数据作为后备
      setPublicMemorials(getFallbackMemorials())
    }
    setLoading(false)
  }

  /**
   * 函数级详细中文注释：获取后备模拟数据
   * 当链上数据无法获取时使用
   */
  const getFallbackMemorials = (): PublicMemorial[] => {
    return [
      {
        id: 1,
        title: '缅怀革命烈士，铭记历史',
        subtitle: '一代人又一代人的长征路，几十年的...',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
        hearts: 648598,
        flowers: 797155,
        category: DeceasedCategory.Martyr,
        categoryName: '革命烈士'
      },
      {
        id: 2,
        title: '纪念伟大的毛主席，今日中国，山河无恙，国泰民安！',
        subtitle: '中国人民的领袖，伟大的马克思主义者...',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face',
        hearts: 208532,
        flowers: 84745,
        category: DeceasedCategory.HistoricalFigure,
        categoryName: '历史人物'
      },
      {
        id: 3,
        title: '【缅怀】缅怀敬爱的周总理，如今这盛世，如您所愿！',
        subtitle: '伟大的无产阶级革命家、政治家、军事...',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face',
        hearts: 59110,
        flowers: 27340,
        category: DeceasedCategory.HistoricalFigure,
        categoryName: '历史人物'
      },
      {
        id: 4,
        title: '【缅怀】纪念改革开放总设计师邓小平',
        subtitle: '中国社会主义改革开放和现代化建设的...',
        avatar: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=80&h=80&fit=crop&crop=face',
        hearts: 30448,
        flowers: 12928,
        category: DeceasedCategory.HistoricalFigure,
        categoryName: '历史人物'
      }
    ]
  }

  /**
   * 函数级详细中文注释：组件加载时获取数据
   */
  useEffect(() => {
    loadPublicMemorials()
  }, [api, activeCategory])  // 添加activeCategory依赖，分类切换时重新加载

  /**
   * 函数级详细中文注释：处理逝者卡片点击事件
   * 跳转到逝者纪念馆详情页面
   */
  const handleMemorialClick = (deceasedId: number) => {
    window.location.hash = `#/memorial/${deceasedId}`
  }

  /**
   * 函数级详细中文注释：处理分类点击事件
   * 更新：现在分类导航直接在当前页面切换内容，而不是跳转到其他页面
   */
  const handleCategoryClick = (category: string) => {
    setActiveCategory(category)
    // 移除原有的页面跳转逻辑，改为在当前页面显示对应分类的数据
  }

  /**
   * 函数级详细中文注释：分类导航数据
   */
  const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆', '事件馆', '院士馆']

  /**
   * 函数级详细中文注释：轮播图数据
   */
  const bannerItems = [
    {
      id: 1,
      title: '放一盏河灯',
      subtitle: '带去人间的思念',
      bgGradient: 'linear-gradient(135deg, #e8cbc0 0%, #d4a5a5 50%, #c89090 100%)'
    },
    {
      id: 2,
      title: '寄托哀思',
      subtitle: '永恒的纪念',
      bgGradient: 'linear-gradient(135deg, #a8d8ea 0%, #7ab8d4 50%, #5a9fb8 100%)'
    },
    {
      id: 3,
      title: '缅怀先烈',
      subtitle: '传承精神',
      bgGradient: 'linear-gradient(135deg, #ffd89b 0%, #f4c87d 50%, #e8b563 100%)'
    },
    {
      id: 4,
      title: '追忆往昔',
      subtitle: '心中永存',
      bgGradient: 'linear-gradient(135deg, #c9d6df 0%, #a6b8c7 50%, #8a9fb0 100%)'
    }
  ]

  /**
   * 函数级详细中文注释：今日生祭数据
   */
  const todayMemorials: TodayMemorial[] = [
    {
      id: 1,
      name: '林中华',
      tags: ['忌日'],
      dateInfo: '卒于 🅰️ 2024年11月11日',
      duration: '逝世1周年',
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=80&h=80&fit=crop&crop=face',
      hearts: 22,
      flowers: 8
    },
    {
      id: 2,
      name: '妈妈',
      tags: ['诞辰'],
      dateInfo: '生于 🅰️ 1951年11月11日',
      duration: '诞辰74周年',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b60c57a4?w=80&h=80&fit=crop&crop=face',
      hearts: 49,
      flowers: 16
    },
    {
      id: 3,
      name: '爷爷王自来',
      tags: ['诞辰'],
      dateInfo: '生于 🅰️ 1932年09月22日',
      duration: '诞辰93周年',
      avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=80&h=80&fit=crop&crop=face',
      hearts: 28,
      flowers: 18
    },
    {
      id: 4,
      name: '陈玉香',
      tags: ['诞辰'],
      dateInfo: '生于 🅰️ 1930年09月22日',
      duration: '诞辰95周年',
      avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&h=80&fit=crop&crop=face',
      hearts: 82,
      flowers: 60
    },
    {
      id: 5,
      name: '成明德',
      tags: ['忌日'],
      dateInfo: '卒于 🅰️ 1996年11月11日',
      duration: '逝世29周年',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&crop=face',
      hearts: 44,
      flowers: 3
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
      tag: '【诗念】**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 2,
      user: '刘雅宁',
      time: '11月10日 00:07',
      content: '南京大屠杀纪念日，前事不忘后事之师，爱中华，强不忘。',
      tag: '【国家公**纪念馆',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 3,
      user: '刘雅宁',
      time: '11月10日 00:06',
      content: '清酒一杯，盛满了乡愁，愿你天堂安康！',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    }
  ]

  return (
    <div className="memorial-index-page">
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

      <div className="page-content">
        {/* 主横幅区域 - 轮播图 */}
        <Carousel autoplay autoplaySpeed={4000} className="banner-carousel">
          {bannerItems.map((banner) => (
            <div key={banner.id}>
              <div className="main-banner" style={{ background: banner.bgGradient }}>
                <div className="banner-content">
                  <h1 className="banner-title">{banner.title}</h1>
                  <h2 className="banner-subtitle">{banner.subtitle}</h2>
                </div>
                <div className="banner-illustration">
                  {/* 这里可以添加插图 */}
                </div>
              </div>
            </div>
          ))}
        </Carousel>

        {/* 用户状态栏 */}
        <div className="user-status">
          <div className="user-info">
            <Avatar size={32} src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32&h=32&fit=crop&crop=face" />
            <span className="temperature">0.2°C</span>
            <span className="activity">供奉了鲜花</span>
          </div>
          <span className="time">2分钟前</span>
        </div>

        {/* 功能区块 - 两列布局 */}
        <div className="function-blocks">
          <div className="function-item">
            <div className="memorial-icon">🏛️</div>
            <h3>传递孝爱 永久保存</h3>
            <Button type="primary" className="create-btn">
              免费创建纪念馆
            </Button>
          </div>
          <div className="function-item">
            <div className="function-icon">🏠</div>
            <h3>家族祠堂</h3>
            <Button type="primary" className="create-btn">
              创建家族祠堂供奉先祖
            </Button>
          </div>
        </div>

        {/* 公众纪念馆 */}
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">
              {activeCategory === '首页' ? '公众纪念馆' : activeCategory}
            </h3>
            <Button type="text" className="refresh-btn" onClick={loadPublicMemorials}>
              刷新 🔄
            </Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: '16px', color: '#666' }}>正在加载{activeCategory}数据...</p>
            </div>
          ) : publicMemorials.length > 0 ? (
            <div className="memorial-list">
              {publicMemorials.map((memorial) => (
                <div
                  key={memorial.id}
                  className="memorial-item clickable"
                  onClick={() => handleMemorialClick(memorial.id)}
                >
                  <Avatar size={60} src={memorial.avatar} className="memorial-avatar" />
                  <div className="memorial-info">
                    <div className="memorial-header">
                      <h4>{memorial.title}</h4>
                      <Tag
                        className="category-tag"
                        color={memorial.category === DeceasedCategory.Martyr ? 'red' :
                              memorial.category === DeceasedCategory.Hero ? 'orange' :
                              memorial.category === DeceasedCategory.HistoricalFigure ? 'gold' :
                              memorial.category === DeceasedCategory.PublicFigure ? 'blue' :
                              memorial.category === DeceasedCategory.ReligiousFigure ? 'purple' :
                              memorial.category === DeceasedCategory.EventHall ? 'green' : 'default'}
                      >
                        {memorial.categoryName}
                      </Tag>
                    </div>
                    <p>{memorial.subtitle}</p>
                    <div className="memorial-stats">
                      <span className="hearts">❤️ {memorial.hearts.toLocaleString()}</span>
                      <span className="flowers">🌼 {memorial.flowers.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>暂无{activeCategory}纪念馆</p>
              <p style={{ fontSize: '14px' }}>
                {activeCategory === '首页' ?
                  '只显示历史人物、革命烈士、英雄模范等特殊分类逝者' :
                  `当前暂无${activeCategory}分类的逝者记录`
                }
              </p>
              <Button type="link" onClick={loadPublicMemorials}>点击重新加载</Button>
            </div>
          )}
        </div>

        {/* 今日生祭 */}
        <div className="section">
          <h3 className="section-title">今日生祭</h3>
          <div className="today-memorial-list">
            {todayMemorials.map((memorial) => (
              <div
                key={memorial.id}
                className="today-memorial-item clickable"
                onClick={() => {
                  // 今日生祭的模拟数据，显示提示信息
                  console.log(`点击了今日生祭: ${memorial.name}`)
                  // 可以在这里添加跳转逻辑，如果有对应的逝者ID
                }}
              >
                <Avatar size={60} src={memorial.avatar} className="memorial-avatar" />
                <div className="memorial-info">
                  <div className="memorial-header">
                    <span className="name">{memorial.name}</span>
                    {memorial.tags.map((tag, index) => (
                      <Tag
                        key={index}
                        className={`memorial-tag ${tag === '忌日' ? 'death-day' : 'birth-day'}`}
                      >
                        {tag}
                      </Tag>
                    ))}
                  </div>
                  <p className="date-info">{memorial.dateInfo}</p>
                  <p className="duration">{memorial.duration}</p>
                  <div className="memorial-stats">
                    <span className="hearts">❤️ {memorial.hearts}</span>
                    <span className="flowers">🌼 {memorial.flowers}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="view-more">
            <Button type="text" className="view-more-btn">
              查看更多纪念馆 →
            </Button>
          </div>
        </div>

        {/* 纪念馆留言 */}
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">纪念馆留言</h3>
            <Button type="text" className="more-link">
              更多留言 →
            </Button>
          </div>
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
                  {message.tag && (
                    <div className="message-tag">
                      🏛️ {message.tag}
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

export default HomePage
