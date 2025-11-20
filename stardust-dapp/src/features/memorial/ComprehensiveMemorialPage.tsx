/**
 * 函数级详细中文注释：纪念馆综合页面（参考云上思念设计）
 * 
 * 功能：
 * - 展示逝者基本信息和照片
 * - 供奉记录时间线
 * - 供奉品分类浏览和购买
 * - 快捷操作（点亮蜡烛、留言、查看生平）
 * - 统计信息（祭拜次数、距忌日/生辰天数）
 * 
 * 设计参考：
 * - 云上思念网站 (https://m.yssn.cn)
 * - 移动端优先，响应式设计
 * - 纪念主题色彩方案
 */

import React, { useEffect, useState } from 'react'
import { 
  Card, Tabs, Button, Tag, Image, Spin, Empty, message,
  Drawer, Form, InputNumber, Modal, Input
} from 'antd'
import {
  FireOutlined, GiftOutlined, MessageOutlined, 
  UserOutlined, HeartOutlined, CalendarOutlined
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'
import { useParams } from 'react-router-dom'

/**
 * 函数级详细中文注释：类别信息
 */
const CATEGORIES = [
  { code: 'all', name: '全部', icon: '📦' },
  { code: 'package', name: '套餐', icon: '🎁' },
  { code: 'candle', name: '香烛', icon: '🕯️' },
  { code: 'flower', name: '花果', icon: '🌸' },
  { code: 'food', name: '酒菜', icon: '🍷' },
  { code: 'home', name: '家居汽车', icon: '🏠' },
  { code: 'villa', name: '别墅佣人', icon: '🏰' },
  { code: 'fashion', name: '服饰名表', icon: '👔' },
  { code: 'digital', name: '数码乐器', icon: '📱' },
  { code: 'festival', name: '节日', icon: '🎉' },
  { code: 'toy', name: '玩具宠物', icon: '🧸' },
  { code: 'sports', name: '运动', icon: '⚽' },
]

/**
 * 函数级详细中文注释：链端类别映射
 */
const CHAIN_CATEGORY_MAP: Record<string, number> = {
  'flower': 0,   // 鲜花
  'candle': 1,   // 蜡烛
  'food': 2,     // 食品
  'toy': 3,      // 玩具
  'package': 4,  // 套餐
  'home': 4,
  'villa': 4,
  'fashion': 4,
  'digital': 4,
  'festival': 2,
  'sports': 3,
}

interface DeceasedInfo {
  name: string
  birthYear?: number
  deathYear?: number
  avatar?: string
}

interface OfferingRecord {
  who: string
  time: number
  sacrificeName: string
  amount: string
}

interface SacrificeItem {
  id: number
  name: string
  resourceUrl: string
  description: string
  fixedPrice: string | null
  unitPricePerWeek: string | null
  category: number
  isVipExclusive: boolean
}

/**
 * 函数级详细中文注释：纪念馆综合页面组件
 */
const ComprehensiveMemorialPage: React.FC = () => {
  const params = useParams<{ id: string }>()
  const memorialId = params.id ? Number(params.id) : null
  
  const [deceased, setDeceased] = useState<DeceasedInfo[]>([])
  const [offerings, setOfferings] = useState<SacrificeItem[]>([])
  const [recentOfferings, setRecentOfferings] = useState<OfferingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [candleCount, setCandleCount] = useState(0)
  const [offeringCount, setOfferingCount] = useState(0)
  
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SacrificeItem | null>(null)
  const [buyForm] = Form.useForm()
  const [buying, setBuying] = useState(false)
  
  const wallet = useWallet()

  /**
   * 函数级详细中文注释：加载纪念馆数据
   */
  const loadMemorialData = async () => {
    try {
      setLoading(true)
      const api = await getApi()

      // TODO: 加载逝者信息（从纪念馆关联的逝者）
      // 暂时使用模拟数据
      setDeceased([
        { name: '逝者姓名', birthYear: 1950, deathYear: 2020 }
      ])

      // 加载供奉品列表
      const sacrificeEntries = await api.query.memorial.sacrificeOf.entries()
      const sacrificeList: SacrificeItem[] = []

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

      // TODO: 加载供奉记录
      // 暂时使用空数组
      setRecentOfferings([])

      // TODO: 加载统计数据
      setCandleCount(0)
      setOfferingCount(0)

    } catch (error) {
      console.error('加载数据失败:', error)
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMemorialData()
  }, [memorialId])

  /**
   * 函数级详细中文注释：筛选供奉品
   */
  const filteredOfferings = offerings.filter(item => {
    if (selectedCategory === 'all') return true
    const categoryCode = CHAIN_CATEGORY_MAP[selectedCategory]
    return item.category === categoryCode
  })

  /**
   * 函数级详细中文注释：格式化价格
   */
  const formatPrice = (item: SacrificeItem): string => {
    if (item.fixedPrice) {
      const dust = Number(item.fixedPrice) / 1_000_000_000_000_000
      return dust === 0 ? '免费' : `${dust}元`
    }
    if (item.unitPricePerWeek) {
      const dust = Number(item.unitPricePerWeek) / 1_000_000_000_000_000
      return `${dust}元`
    }
    return '未定价'
  }

  /**
   * 函数级详细中文注释：购买供奉品
   */
  const handleBuy = async (values: any) => {
    if (!selectedItem) return

    try {
      setBuying(true)

      const domain = Number(values.domain || 1)
      const targetId = Number(values.targetId || memorialId)
      const duration = values.duration ? Number(values.duration) : null

      await signAndSendLocalFromKeystore(
        'memorial',
        'offerBySacrifice',
        [[domain, targetId], selectedItem.id, [], duration]
      )

      message.success('供奉成功！')
      setDrawerOpen(false)
      buyForm.resetFields()
      
      // 刷新数据
      await loadMemorialData()

    } catch (error: any) {
      message.error(error?.message || '供奉失败')
    } finally {
      setBuying(false)
    }
  }

  /**
   * 函数级详细中文注释：点亮蜡烛
   */
  const handleLightCandle = async () => {
    try {
      // TODO: 实现点亮蜡烛功能
      message.info('点亮蜡烛功能开发中...')
    } catch (error: any) {
      message.error(error?.message || '点亮蜡烛失败')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#666' }}>加载中...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg, #F5F5DC)',
      paddingBottom: 80
    }}>
      {/* 顶部操作栏 */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#fff',
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--color-primary, #B8860B)' }}>
          纪念馆
        </div>
        <Button type="text" size="small">
          加入亲友团
        </Button>
      </div>

      {/* 逝者信息区 */}
      <div style={{ 
        background: '#fff', 
        padding: 16,
        borderBottom: '8px solid var(--color-bg, #F5F5DC)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
            {deceased.map(d => d.name).join(' & ')}
          </div>
          
          {deceased.map((d, idx) => (
            <div key={idx} style={{ 
              display: 'inline-block',
              margin: '0 16px',
              color: '#666',
              fontSize: 14
            }}>
              {d.birthYear}-{d.deathYear}
            </div>
          ))}

          {/* 统计信息 */}
          <div style={{ 
            margin: '16px 0',
            fontSize: 14,
            color: '#666',
            lineHeight: 1.8
          }}>
            <div>已离开我们 {deceased[0]?.deathYear ? new Date().getFullYear() - deceased[0].deathYear : 0} 年</div>
            <div>亲友们已祭拜 {offeringCount} 次，已点亮蜡烛 {candleCount} 次</div>
            <div><CalendarOutlined /> 距忌日还有 ? 天，距生辰还有 ? 天</div>
          </div>

          {/* 快捷操作 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 16
          }}>
            <Button 
              type="primary"
              icon={<FireOutlined />}
              onClick={handleLightCandle}
              style={{
                background: 'linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)',
                border: 'none',
                borderRadius: 8
              }}
            >
              点亮蜡烛
            </Button>
            <div style={{ fontSize: 12, color: '#999', alignSelf: 'center' }}>
              已点亮{candleCount}支蜡烛
            </div>
          </div>
        </div>
      </div>

      {/* 最近供奉时间线 */}
      {recentOfferings.length > 0 && (
        <div style={{
          background: '#fff',
          padding: 16,
          borderBottom: '8px solid var(--color-bg, #F5F5DC)'
        }}>
          <div style={{ 
            fontSize: 16, 
            fontWeight: 'bold', 
            marginBottom: 12,
            color: 'var(--color-primary, #B8860B)'
          }}>
            <HeartOutlined /> 最近供奉
          </div>
          
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {recentOfferings.map((record, idx) => (
              <div key={idx} style={{
                padding: '8px 0',
                borderBottom: idx < recentOfferings.length - 1 ? '1px solid #f0f0f0' : 'none',
                fontSize: 14
              }}>
                <span style={{ fontWeight: 500 }}>{record.who}</span>
                <span style={{ margin: '0 8px', color: '#999' }}>供奉了</span>
                <span style={{ color: 'var(--color-primary, #B8860B)' }}>{record.sacrificeName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 自动供奉和祈福入口 */}
      <div style={{
        background: '#fff',
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        borderBottom: '8px solid var(--color-bg, #F5F5DC)'
      }}>
        <Button style={{ flex: 1, borderRadius: 8 }}>
          自动供奉
        </Button>
        <Button style={{ flex: 1, borderRadius: 8 }}>
          祈福祭品
        </Button>
      </div>

      {/* 供奉品分类浏览 */}
      <div style={{ background: '#fff', padding: '12px 0' }}>
        {/* 类别标签滚动 */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '0 16px 12px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          {CATEGORIES.map(cat => (
            <Tag
              key={cat.code}
              color={selectedCategory === cat.code ? 'var(--color-primary, #B8860B)' : 'default'}
              style={{
                cursor: 'pointer',
                padding: '4px 12px',
                fontSize: 14,
                borderRadius: 16,
                border: selectedCategory === cat.code ? 'none' : '1px solid #d9d9d9'
              }}
              onClick={() => setSelectedCategory(cat.code)}
            >
              {cat.icon} {cat.name}
            </Tag>
          ))}
        </div>

        {/* 供奉品网格 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          padding: '0 8px'
        }}>
          {filteredOfferings.map(item => (
            <Card
              key={item.id}
              hoverable
              onClick={() => {
                setSelectedItem(item)
                setDrawerOpen(true)
              }}
              bodyStyle={{ padding: 8 }}
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #f0f0f0'
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
                    borderRadius: 4
                  }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                />
              )}

              {/* 供奉品信息 */}
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.name}
                </div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: 'var(--color-primary, #B8860B)'
                }}>
                  {formatPrice(item)}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 空状态 */}
        {filteredOfferings.length === 0 && (
          <Empty 
            description="暂无供奉品" 
            style={{ padding: 40 }}
          />
        )}
      </div>

      {/* 底部固定操作栏 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1px solid #eee',
        display: 'flex',
        padding: '8px 0',
        zIndex: 100
      }}>
        <Button 
          type="text" 
          style={{ flex: 1, height: 60, flexDirection: 'column' }}
          onClick={handleLightCandle}
        >
          <FireOutlined style={{ fontSize: 24, color: 'var(--color-accent, #DC143C)' }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>蜡烛</div>
        </Button>
        <Button 
          type="text" 
          style={{ flex: 1, height: 60, flexDirection: 'column' }}
        >
          <GiftOutlined style={{ fontSize: 24, color: 'var(--color-primary, #B8860B)' }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>祭品</div>
        </Button>
        <Button 
          type="text" 
          style={{ flex: 1, height: 60, flexDirection: 'column' }}
        >
          <MessageOutlined style={{ fontSize: 24, color: 'var(--color-secondary, #2F4F4F)' }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>留言</div>
        </Button>
        <Button 
          type="text" 
          style={{ flex: 1, height: 60, flexDirection: 'column' }}
        >
          <UserOutlined style={{ fontSize: 24, color: 'var(--color-secondary, #2F4F4F)' }} />
          <div style={{ fontSize: 12, marginTop: 4 }}>生平</div>
        </Button>
      </div>

      {/* 购买抽屉 */}
      <Drawer
        title={selectedItem?.name}
        placement="bottom"
        height="80%"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedItem && (
          <div>
            {/* 供奉品详情 */}
            {selectedItem.resourceUrl && selectedItem.resourceUrl.startsWith('http') && (
              <Image
                src={selectedItem.resourceUrl}
                alt={selectedItem.name}
                style={{ width: '100%', borderRadius: 12, marginBottom: 16 }}
              />
            )}

            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <b>名称</b>: {selectedItem.name}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>描述</b>: {selectedItem.description}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>价格</b>: {formatPrice(selectedItem)}
              </div>
              {selectedItem.isVipExclusive && (
                <Tag color="gold">VIP 专属</Tag>
              )}
            </Card>

            {/* 购买表单 */}
            <Form
              form={buyForm}
              layout="vertical"
              onFinish={handleBuy}
              initialValues={{ domain: 1, targetId: memorialId }}
            >
              <Form.Item
                name="domain"
                label="Domain (域)"
                rules={[{ required: true }]}
              >
                <InputNumber 
                  min={0} 
                  max={255}
                  style={{ width: '100%' }}
                  placeholder="1=逝者, 2=宠物"
                />
              </Form.Item>

              <Form.Item
                name="targetId"
                label="Target ID (目标ID)"
                rules={[{ required: true }]}
              >
                <InputNumber 
                  min={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              {selectedItem.unitPricePerWeek && (
                <Form.Item
                  name="duration"
                  label="时长（周）"
                  rules={[{ required: true }]}
                >
                  <InputNumber 
                    min={1}
                    max={52}
                    style={{ width: '100%' }}
                    placeholder="1-52周"
                  />
                </Form.Item>
              )}

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={buying}
                  block
                  size="large"
                  style={{
                    borderRadius: 8,
                    background: 'var(--color-primary, #B8860B)',
                    border: 'none',
                    height: 48
                  }}
                >
                  供奉
                </Button>
              </Form.Item>
            </Form>

            {/* 合计金额 */}
            <div style={{
              position: 'sticky',
              bottom: 0,
              background: '#fff',
              padding: '16px 0',
              borderTop: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ color: '#999' }}>合计：</span>
                <span style={{ 
                  fontSize: 20, 
                  fontWeight: 'bold',
                  color: 'var(--color-accent, #DC143C)'
                }}>
                  {formatPrice(selectedItem)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default ComprehensiveMemorialPage

