import React, { useState, useEffect } from 'react'
import { Card, Avatar, Tag, Empty, Spin } from 'antd'
import {
  HomeOutlined,
  TeamOutlined,
  HeartOutlined,
  ArrowLeftOutlined,
  HeartFilled,
  FireFilled
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import './MyMemorialPage.css'

/**
 * 函数级详细中文注释：我的纪念馆页面
 * - 上方：我创建的纪念馆列表（卡片样式）
 * - 下方：三个入口（创建的馆、亲友团的馆、关注的馆）
 * - 参考云上思念UI设计
 */
const MyMemorialPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [memorials, setMemorials] = useState<any[]>([])

  /**
   * 函数级中文注释：加载我创建的纪念馆列表
   */
  useEffect(() => {
    const loadMemorials = async () => {
      try {
        setLoading(true)
        const api = await getApi()

        // TODO: 从链上加载我创建的纪念馆
        // 暂时使用模拟数据
        const mockData = [
          {
            id: 1,
            name: '林中华',
            avatar: '',
            gender: 'male',
            birthDate: '2024年11月11日',
            deathDate: '逝世1周年',
            likes: 22,
            candles: 8,
            status: 'memorial' // memorial 或 passed
          },
          {
            id: 2,
            name: '妈妈',
            avatar: '',
            gender: 'female',
            birthDate: '1951年11月11日',
            deathDate: '逝辰74周年',
            likes: 49,
            candles: 16,
            status: 'passed'
          },
          {
            id: 3,
            name: '爷爷王自来',
            avatar: 'https://picsum.photos/seed/grandpa/200',
            gender: 'male',
            birthDate: '1932年09月22日',
            deathDate: '逝辰93周年',
            likes: 28,
            candles: 18,
            status: 'passed'
          },
          {
            id: 4,
            name: '陈玉香',
            avatar: 'https://picsum.photos/seed/chen/200',
            gender: 'female',
            birthDate: '1930年09月22日',
            deathDate: '逝辰95周年',
            likes: 82,
            candles: 60,
            status: 'passed'
          },
          {
            id: 5,
            name: '成明德',
            avatar: 'https://picsum.photos/seed/cheng/200',
            gender: 'male',
            birthDate: '1996年11月11日',
            deathDate: '逝世29周年',
            likes: 44,
            candles: 3,
            status: 'memorial'
          }
        ]

        setMemorials(mockData)
      } catch (error) {
        console.error('加载纪念馆失败:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMemorials()
  }, [])

  const handleNavigate = (type: string) => {
    switch (type) {
      case 'created':
        // 跳转到我创建的纪念馆列表
        window.location.hash = '#/memorial/my-created'
        break
      case 'family':
        // 跳转到亲友团的馆
        window.location.hash = '#/memorial/family'
        break
      case 'followed':
        // 跳转到关注的馆
        window.location.hash = '#/memorial/followed'
        break
      default:
        break
    }
  }

  const handleMemorialClick = (id: number) => {
    // 跳转到纪念馆详情页
    window.location.hash = `#/memorial/${id}`
  }

  return (
    <div className="my-memorial-page">
      {/* 顶部导航栏 */}
      <div className="memorial-header">
        <button
          className="back-btn"
          onClick={() => window.history.back()}
        >
          <ArrowLeftOutlined />
        </button>
        <div className="header-title">我的纪念馆</div>
        <div style={{ width: 40 }} />
      </div>

      {/* 主要内容区域 */}
      <div className="memorial-content">
        {/* 三个入口卡片 - 移到上方 */}
        <div className="action-section">
          <div className="memorial-grid">
            {/* 创建的馆 */}
            <Card
              className="memorial-card"
              hoverable
              onClick={() => handleNavigate('created')}
            >
              <div className="card-icon created">
                <HomeOutlined />
              </div>
              <div className="card-title">创建的馆</div>
            </Card>

            {/* 亲友团的馆 */}
            <Card
              className="memorial-card"
              hoverable
              onClick={() => handleNavigate('family')}
            >
              <div className="card-icon family">
                <TeamOutlined />
              </div>
              <div className="card-title">亲友团的馆</div>
            </Card>

            {/* 关注的馆 */}
            <Card
              className="memorial-card"
              hoverable
              onClick={() => handleNavigate('followed')}
            >
              <div className="card-icon followed">
                <HeartOutlined />
              </div>
              <div className="card-title">关注的馆</div>
            </Card>
          </div>
        </div>

        {/* 纪念馆列表 - 移到下方 */}
        <div className="memorial-list-section">
          <div className="section-title">我创建的纪念馆</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#999' }}>加载中...</div>
            </div>
          ) : memorials.length === 0 ? (
            <Empty
              description="暂无纪念馆"
              style={{ padding: 60 }}
            />
          ) : (
            <div className="memorial-list">
              {memorials.map((memorial) => (
                <Card
                  key={memorial.id}
                  className="memorial-item-card"
                  hoverable
                  onClick={() => handleMemorialClick(memorial.id)}
                >
                  <div className="card-content">
                    {/* 左侧头像 */}
                    <Avatar
                      size={64}
                      src={memorial.avatar}
                      icon={!memorial.avatar && <HomeOutlined />}
                      className="memorial-avatar"
                      style={{
                        backgroundColor: memorial.avatar ? 'transparent' : '#d9d9d9'
                      }}
                    />

                    {/* 中间信息 */}
                    <div className="memorial-info">
                      <div className="memorial-name">{memorial.name}</div>
                      <div className="memorial-date-row">
                        <span className="date-badge">
                          <span className="badge-icon">🅰️</span>
                          <span>{memorial.birthDate}</span>
                        </span>
                      </div>
                      <div className="memorial-date-text">{memorial.deathDate}</div>
                      <div className="memorial-stats">
                        <span className="stat-item">
                          <HeartFilled style={{ color: '#ff4d4f' }} />
                          <span>{memorial.likes}</span>
                        </span>
                        <span className="stat-item">
                          <FireFilled style={{ color: '#faad14' }} />
                          <span>{memorial.candles}</span>
                        </span>
                      </div>
                    </div>

                    {/* 右侧标签 */}
                    <div className="memorial-tag">
                      <Tag
                        color={memorial.status === 'memorial' ? 'red' : 'green'}
                        className="status-tag"
                      >
                        {memorial.status === 'memorial' ? '忌日' : '逝辰'}
                      </Tag>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MyMemorialPage
