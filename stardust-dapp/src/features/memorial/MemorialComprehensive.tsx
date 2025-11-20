/**
 * 函数级详细中文注释：纪念馆综合页面（严格按照云上思念UI设计）
 * 
 * 设计参考: https://m.yssn.cn/wap/index/pc_index.html
 * 
 * 严格按照云上思念的UI设计，包括：
 * 1. 顶部导航栏（搜索、签到）
 * 2. 逝者信息区（照片、姓名、生卒年）
 * 3. 统计信息（祭拜次数、蜡烛数、距忌日/生辰天数）
 * 4. 最近动态时间线
 * 5. 快捷操作按钮
 * 6. 供奉品分类标签（横向滚动）
 * 7. 供奉品网格（3列）
 * 8. 底部固定操作栏（4个按钮）
 */

import React, { useState, useEffect } from 'react'
import { 
  Card, Button, Tag, Image, Empty, message, Spin, Input, List, Avatar
} from 'antd'
import {
  SearchOutlined, FireOutlined, GiftOutlined, MessageOutlined, 
  UserOutlined, CalendarOutlined, HeartOutlined
} from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { getApi } from '../../lib/polkadot'
import './MemorialComprehensive.css'

/**
 * 函数级详细中文注释：类别配置（按照云上思念的分类）
 */
const CATEGORIES = [
  { id: 'all', name: '全部', icon: '📦' },
  { id: 'package', name: '套餐', icon: '🎁' },
  { id: 'candle', name: '香烛', icon: '🕯️' },
  { id: 'flower', name: '花果', icon: '🌸' },
  { id: 'food', name: '酒菜', icon: '🍷' },
  { id: 'home', name: '家居汽车', icon: '🏠' },
  { id: 'villa', name: '别墅佣人', icon: '🏰' },
  { id: 'fashion', name: '服饰名表', icon: '👔' },
  { id: 'digital', name: '数码乐器', icon: '📱' },
  { id: 'festival', name: '节日', icon: '🎉' },
  { id: 'toy', name: '玩具宠物', icon: '🧸' },
  { id: 'sports', name: '运动', icon: '⚽' },
]

/**
 * 函数级详细中文注释：纪念馆综合页面组件
 */
const MemorialComprehensive: React.FC = () => {
  const params = useParams<{ id: string }>()
  const memorialId = params.id ? Number(params.id) : null

  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [offerings, setOfferings] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [deceasedInfo, setDeceasedInfo] = useState({
    name: '陈书元 & 索长琴',
    birthYear: 1921,
    deathYear: 1980,
    avatar: ''
  })
  const [stats, setStats] = useState({
    offeringCount: 14,
    candleCount: 3,
    daysToDeathAnniversary: 56,
    daysToBirthday: 346
  })

  /**
   * 函数级详细中文注释：加载纪念馆数据
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const api = await getApi()

        // 加载供奉品列表
        const sacrificeEntries = await api.query.memorial.sacrificeOf.entries()
        const sacrificeList: any[] = []

        for (const [key, value] of sacrificeEntries) {
          if (value.isSome) {
            const id = key.args[0].toNumber()
            const data = value.unwrap()

            sacrificeList.push({
              id,
              name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
              resourceUrl: new TextDecoder().decode(new Uint8Array(data.resourceUrl.toU8a())),
              description: new TextDecoder().decode(new Uint8Array(data.description.toU8a())),
              fixedPrice: data.fixedPrice.isSome ? data.fixedPrice.unwrap().toString() : null,
              unitPricePerWeek: data.unitPricePerWeek.isSome ? data.unitPricePerWeek.unwrap().toString() : null,
              category: data.category.toNumber(),
              isVipExclusive: data.isVipExclusive.toJSON()
            })
          }
        }

        setOfferings(sacrificeList)

        // TODO: 加载最近动态
        setRecentActivities([
          { user: '其宁', action: '供奉了鲜花', time: '2分钟前' },
          { user: '其宁', action: '点亮了蜡烛', time: '2分钟前' },
          { user: '摩羯', action: '给墓园擦墓碑了', time: '13分钟前' },
        ])

      } catch (error) {
        console.error('加载数据失败:', error)
        message.error('加载数据失败')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [memorialId])

  /**
   * 函数级详细中文注释：筛选供奉品
   */
  const filteredOfferings = offerings.filter(item => {
    if (selectedCategory === 'all') return true
    // TODO: 实现类别映射
    return true
  })

  /**
   * 函数级详细中文注释：格式化价格
   */
  const formatPrice = (item: any): string => {
    if (item.fixedPrice) {
      const dust = Number(item.fixedPrice) / 1_000_000_000_000_000
      return dust === 0 ? '免费' : `${dust}元`
    }
    if (item.unitPricePerWeek) {
      const dust = Number(item.unitPricePerWeek) / 1_000_000_000_000_000
      return `${dust}元/周`
    }
    return '未定价'
  }

  /**
   * 函数级详细中文注释：点亮蜡烛
   */
  const handleLightCandle = () => {
    message.info('点亮蜡烛功能开发中...')
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, background: '#F5F5DC', minHeight: '100vh' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#666' }}>加载中...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5DC',
      paddingBottom: 80
    }}>
      {/* 顶部导航栏（云上思念风格） */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#fff',
        padding: '10px 16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <Input
          placeholder="搜索馆名或人名"
          prefix={<SearchOutlined style={{ color: '#999' }} />}
          style={{
            flex: 1,
            borderRadius: 20,
            background: '#f5f5f5',
            border: 'none'
          }}
        />
        <Button type="text" size="small" style={{ color: '#666' }}>
          签到
        </Button>
      </div>

      {/* 逝者信息区（云上思念风格） */}
      <div style={{ 
        background: '#fff', 
        padding: '20px 16px',
        marginTop: 8,
        textAlign: 'center'
      }}>
        {/* 逝者照片 */}
        {deceasedInfo.avatar && (
          <Avatar
            src={deceasedInfo.avatar}
            size={80}
            style={{ marginBottom: 12 }}
          />
        )}

        {/* 逝者姓名 */}
        <div style={{ 
          fontSize: 22, 
          fontWeight: 'bold', 
          marginBottom: 8,
          color: '#333'
        }}>
          {deceasedInfo.name}
        </div>

        {/* 生卒年 */}
        <div style={{ 
          color: '#999', 
          fontSize: 14,
          marginBottom: 16
        }}>
          {deceasedInfo.birthYear}-{deceasedInfo.deathYear}
        </div>

        {/* 统计信息 */}
        <div style={{ 
          margin: '16px 0',
          fontSize: 13,
          color: '#666',
          lineHeight: 2
        }}>
          <div>他们中最久的已经离开我们{new Date().getFullYear() - deceasedInfo.deathYear}年了</div>
          <div>亲友们已祭拜{stats.offeringCount}次，已点亮蜡烛{stats.candleCount}次</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 14 }} />
            <span>距忌日还有{stats.daysToDeathAnniversary}天，距生辰还有{stats.daysToBirthday}天</span>
          </div>
        </div>

        {/* 点亮蜡烛按钮 */}
        <Button 
          type="primary"
          icon={<FireOutlined />}
          onClick={handleLightCandle}
          style={{
            background: 'linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)',
            border: 'none',
            borderRadius: 20,
            height: 44,
            padding: '0 32px',
            marginTop: 12
          }}
        >
          点亮蜡烛
        </Button>
        <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
          已点亮{stats.candleCount}支蜡烛
        </div>
      </div>

      {/* 最近动态（云上思念风格） */}
      {recentActivities.length > 0 && (
        <div style={{
          background: '#fff',
          padding: 16,
          marginTop: 8
        }}>
          <div style={{ 
            fontSize: 16, 
            fontWeight: 'bold', 
            marginBottom: 12,
            color: '#333'
          }}>
            最近动态
          </div>
          
          <List
            dataSource={recentActivities}
            renderItem={(item, idx) => (
              <List.Item style={{ 
                padding: '8px 0',
                borderBottom: idx < recentActivities.length - 1 ? '1px solid #f0f0f0' : 'none'
              }}>
                <div style={{ fontSize: 14, width: '100%' }}>
                  <span style={{ fontWeight: 500, color: '#333' }}>{item.user}</span>
                  <span style={{ margin: '0 8px', color: '#666' }}>{item.action}</span>
                  <span style={{ color: '#999', float: 'right' }}>{item.time}</span>
                </div>
              </List.Item>
            )}
          />
        </div>
      )}

      {/* 快捷操作（云上思念风格） */}
      <div style={{
        background: '#fff',
        padding: '12px 16px',
        marginTop: 8,
        display: 'flex',
        gap: 12
      }}>
        <Button 
          style={{ 
            flex: 1, 
            borderRadius: 8,
            height: 40,
            borderColor: '#d9d9d9'
          }}
        >
          自动供奉
        </Button>
        <Button 
          style={{ 
            flex: 1, 
            borderRadius: 8,
            height: 40,
            borderColor: '#d9d9d9'
          }}
        >
          祈福祭品
        </Button>
      </div>

      {/* 供奉品分类标签（云上思念风格 - 横向滚动） */}
      <div style={{
        background: '#fff',
        padding: '12px 0',
        marginTop: 8,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch'
      }}>
        <div style={{ 
          display: 'inline-flex',
          gap: 8,
          padding: '0 16px'
        }}>
          {CATEGORIES.map(cat => (
            <Tag
              key={cat.id}
              color={selectedCategory === cat.id ? '#B8860B' : 'default'}
              style={{
                cursor: 'pointer',
                padding: '6px 16px',
                fontSize: 14,
                borderRadius: 20,
                border: selectedCategory === cat.id ? 'none' : '1px solid #d9d9d9',
                margin: 0,
                whiteSpace: 'nowrap'
              }}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.icon} {cat.name}
            </Tag>
          ))}
        </div>
      </div>

      {/* 供奉品网格（云上思念风格 - 3列） */}
      <div style={{
        background: '#fff',
        padding: 12,
        marginTop: 8
      }}>
        {filteredOfferings.length === 0 ? (
          <Empty 
            description="暂无供奉品" 
            style={{ padding: 40 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8
          }}>
            {filteredOfferings.map((item: any) => (
              <Card
                key={item.id}
                hoverable
                bodyStyle={{ padding: 8 }}
                style={{
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                  overflow: 'hidden'
                }}
              >
                {/* 供奉品图片 */}
                {item.resourceUrl && item.resourceUrl.startsWith('http') && (
                  <Image
                    src={item.resourceUrl}
                    alt={item.name}
                    preview={false}
                    style={{
                      width: '100%',
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: 4,
                      marginBottom: 8
                    }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                )}

                {/* 供奉品信息 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#333'
                  }}>
                    {item.name}
                  </div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#B8860B'
                  }}>
                    {formatPrice(item)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 底部固定操作栏（云上思念风格） */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1px solid #eee',
        display: 'flex',
        padding: '8px 0',
        zIndex: 100,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
      }}>
        <Button 
          type="text" 
          style={{ 
            flex: 1, 
            height: 60, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#DC143C'
          }}
          onClick={handleLightCandle}
        >
          <FireOutlined style={{ fontSize: 24 }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>点亮蜡烛</div>
        </Button>
        <Button 
          type="text" 
          style={{ 
            flex: 1, 
            height: 60, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#B8860B'
          }}
        >
          <GiftOutlined style={{ fontSize: 24 }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>祭品</div>
        </Button>
        <Button 
          type="text" 
          style={{ 
            flex: 1, 
            height: 60, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#2F4F4F'
          }}
        >
          <MessageOutlined style={{ fontSize: 24 }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>留言</div>
        </Button>
        <Button 
          type="text" 
          style={{ 
            flex: 1, 
            height: 60, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#2F4F4F'
          }}
        >
          <UserOutlined style={{ fontSize: 24 }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>生平</div>
        </Button>
      </div>

      {/* 底部留白 */}
      <div style={{ height: 80 }} />
    </div>
  )
}

export default MemorialComprehensive
