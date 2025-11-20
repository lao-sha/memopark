/**
 * 函数级详细中文注释：供奉品目录浏览（适配 Memorial Pallet 精简版）
 * 
 * 功能：
 * - 从链端获取所有祭祀品（SacrificeItem）
 * - 前端按 category 字段分类
 * - 支持按类别筛选和搜索
 * - 点击供奉品查看详情并购买
 * 
 * 适配说明：
 * - 新的 Memorial pallet 移除了类别索引功能
 * - 使用 memorial.sacrificeOf.entries() 获取所有数据
 * - 在前端进行分类和过滤
 */

import React, { useEffect, useState, useMemo } from 'react'
import { 
  Card, Tabs, List, Tag, Drawer, Form, InputNumber, 
  Button, Alert, message, Image, Spin, Empty, Input, Typography
} from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'

/**
 * 函数级详细中文注释：类别枚举（对应链端）
 */
enum Category {
  Flower = 0,   // 鲜花
  Candle = 1,   // 蜡烛
  Food = 2,     // 食品
  Toy = 3,      // 玩具
  Other = 4,    // 其他
}

/**
 * 函数级详细中文注释：类别信息
 */
const CATEGORY_INFO = {
  [Category.Flower]: { name: '花果', icon: '🌸', color: '#ff69b4' },
  [Category.Candle]: { name: '香烛', icon: '🕯️', color: '#ffa500' },
  [Category.Food]: { name: '酒菜', icon: '🍷', color: '#dc143c' },
  [Category.Toy]: { name: '玩具', icon: '🧸', color: '#4169e1' },
  [Category.Other]: { name: '其他', icon: '✨', color: '#9370db' },
}

/**
 * 函数级详细中文注释：祭祀品接口
 */
interface SacrificeItem {
  id: number
  name: string
  resourceUrl: string
  description: string
  status: number
  isVipExclusive: boolean
  fixedPrice: string | null
  unitPricePerWeek: string | null
  scene: number
  category: Category
}

/**
 * 函数级详细中文注释：供奉品目录组件
 */
const OfferingsCatalog: React.FC = () => {
  const [allOfferings, setAllOfferings] = useState<SacrificeItem[]>([])
  const [filteredOfferings, setFilteredOfferings] = useState<SacrificeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<SacrificeItem | null>(null)
  const [buying, setBuying] = useState(false)
  const [buyForm] = Form.useForm()
  const wallet = useWallet()

  /**
   * 函数级详细中文注释：从链端加载所有祭祀品
   */
  const loadOfferings = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      
      // 使用 entries() 获取所有祭祀品
      const entries = await api.query.memorial.sacrificeOf.entries()
      
      const offerings: SacrificeItem[] = []
      
      for (const [key, value] of entries) {
        if (value.isSome) {
          const id = key.args[0].toNumber()
          const data = value.unwrap()
          
          // 解码字段
          const name = new TextDecoder().decode(new Uint8Array(data.name.toU8a()))
          const resourceUrl = new TextDecoder().decode(new Uint8Array(data.resourceUrl.toU8a()))
          const description = new TextDecoder().decode(new Uint8Array(data.description.toU8a()))
          
          offerings.push({
            id,
            name,
            resourceUrl,
            description,
            status: data.status.isEnabled ? 0 : (data.status.isDisabled ? 1 : 2),
            isVipExclusive: data.isVipExclusive.toJSON(),
            fixedPrice: data.fixedPrice.isSome ? data.fixedPrice.unwrap().toString() : null,
            unitPricePerWeek: data.unitPricePerWeek.isSome ? data.unitPricePerWeek.unwrap().toString() : null,
            scene: data.scene.toNumber(),
            category: data.category.toNumber() as Category
          })
        }
      }
      
      // 按 ID 排序
      offerings.sort((a, b) => a.id - b.id)
      
      setAllOfferings(offerings)
      setFilteredOfferings(offerings)
      
      console.log(`✅ 加载了 ${offerings.length} 个供奉品`)
      
    } catch (error) {
      console.error('加载供奉品失败:', error)
      message.error('加载供奉品失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOfferings()
  }, [])

  /**
   * 函数级详细中文注释：筛选逻辑
   */
  useEffect(() => {
    let filtered = allOfferings

    // 按类别筛选
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }

    // 按关键词搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword)
      )
    }

    setFilteredOfferings(filtered)
  }, [selectedCategory, searchKeyword, allOfferings])

  /**
   * 函数级详细中文注释：购买供奉品
   */
  const onBuy = async (values: any) => {
    if (!activeItem) return
    
    try {
      setBuying(true)
      
      const domain = Number(values.domain)
      const targetId = Number(values.targetId)
      const duration = values.duration ? Number(values.duration) : null
      
      if (!Number.isFinite(domain) || !Number.isFinite(targetId)) {
        message.error('请输入有效的 domain 和 targetId')
        return
      }
      
      // 调用 offerBySacrifice
      const txHash = await signAndSendLocalFromKeystore(
        'memorial',
        'offerBySacrifice',
        [[domain, targetId], activeItem.id, [], duration]
      )
      
      message.success(`供奉成功！交易哈希: ${txHash.substring(0, 10)}...`)
      setDrawerOpen(false)
      buyForm.resetFields()
      
    } catch (error: any) {
      message.error(error?.message || '供奉失败')
    } finally {
      setBuying(false)
    }
  }

  /**
   * 函数级详细中文注释：格式化价格
   */
  const formatPrice = (item: SacrificeItem): string => {
    if (item.fixedPrice) {
      const dust = Number(item.fixedPrice) / 1_000_000_000_000_000
      return dust === 0 ? '免费' : `${dust.toFixed(2)} DUST`
    }
    if (item.unitPricePerWeek) {
      const dust = Number(item.unitPricePerWeek) / 1_000_000_000_000_000
      return `${dust.toFixed(2)} DUST/周`
    }
    return '未定价'
  }

  /**
   * 函数级详细中文注释：渲染供奉品卡片
   */
  const renderOfferingCard = (item: SacrificeItem) => {
    const catInfo = CATEGORY_INFO[item.category]
    
    return (
      <Card
        hoverable
        onClick={() => { setActiveItem(item); setDrawerOpen(true) }}
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          border: `2px solid ${catInfo.color}20`
        }}
      >
        {/* 图片 */}
        {item.resourceUrl && item.resourceUrl.startsWith('http') && (
          <Image
            src={item.resourceUrl}
            alt={item.name}
            preview={false}
            style={{ width: '100%', height: 150, objectFit: 'cover' }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
        )}
        
        {/* 内容 */}
        <div style={{ padding: 12 }}>
          <div style={{ 
            fontSize: 16, 
            fontWeight: 'bold', 
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>{catInfo.icon}</span>
            <span>{item.name}</span>
            {item.isVipExclusive && <Tag color="gold">VIP</Tag>}
          </div>
          
          <div style={{ 
            fontSize: 14, 
            color: '#666', 
            marginBottom: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {item.description}
          </div>
          
          <div style={{ 
            fontSize: 16, 
            fontWeight: 'bold', 
            color: catInfo.color 
          }}>
            {formatPrice(item)}
          </div>
        </div>
      </Card>
    )
  }

  // 按类别统计
  const categoryStats = useMemo(() => {
    const stats: Record<number, number> = {}
    allOfferings.forEach(item => {
      stats[item.category] = (stats[item.category] || 0) + 1
    })
    return stats
  }, [allOfferings])

  return (
    <div style={{ 
      maxWidth: 1200, 
      margin: '0 auto', 
      padding: 16,
      background: 'var(--color-bg-elevated, #fff)'
    }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        🎁 供奉品目录
      </Typography.Title>

      {/* 搜索框 */}
      <Input
        placeholder="搜索供奉品名称..."
        prefix={<SearchOutlined />}
        value={searchKeyword}
        onChange={e => setSearchKeyword(e.target.value)}
        style={{ marginBottom: 16, borderRadius: 8 }}
        size="large"
      />

      {/* 类别标签页 */}
      <Tabs
        activeKey={selectedCategory.toString()}
        onChange={key => setSelectedCategory(key === 'all' ? 'all' : Number(key))}
        items={[
          {
            key: 'all',
            label: `全部 (${allOfferings.length})`,
          },
          ...Object.entries(CATEGORY_INFO).map(([catId, info]) => ({
            key: catId,
            label: (
              <span>
                {info.icon} {info.name} ({categoryStats[Number(catId)] || 0})
              </span>
            ),
          }))
        ]}
      />

      {/* 供奉品列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666' }}>加载中...</div>
        </div>
      ) : filteredOfferings.length === 0 ? (
        <Empty description="没有找到供奉品" style={{ padding: 60 }} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginTop: 16
        }}>
          {filteredOfferings.map(item => (
            <div key={item.id}>
              {renderOfferingCard(item)}
            </div>
          ))}
        </div>
      )}

      {/* 详情抽屉 */}
      <Drawer
        title={activeItem ? `${activeItem.name} #${activeItem.id}` : '供奉品详情'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
      >
        {activeItem && (
          <div>
            {/* 图片 */}
            {activeItem.resourceUrl && activeItem.resourceUrl.startsWith('http') && (
              <Image
                src={activeItem.resourceUrl}
                alt={activeItem.name}
                style={{ width: '100%', borderRadius: 12, marginBottom: 16 }}
              />
            )}

            {/* 基本信息 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8 }}>
                <b>名称</b>: {activeItem.name}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>描述</b>: {activeItem.description}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>类别</b>: {CATEGORY_INFO[activeItem.category].icon} {CATEGORY_INFO[activeItem.category].name}
              </div>
              <div style={{ marginBottom: 8 }}>
                <b>价格</b>: {formatPrice(activeItem)}
              </div>
              {activeItem.isVipExclusive && (
                <Tag color="gold" style={{ marginTop: 8 }}>VIP 专属</Tag>
              )}
            </div>

            {/* 购买表单 */}
            <div style={{ 
              paddingTop: 16, 
              borderTop: '1px solid var(--color-border-light, #eee)' 
            }}>
              <Typography.Title level={5}>立即供奉</Typography.Title>
              
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={`应付金额: ${formatPrice(activeItem)}`}
              />

              <Form
                form={buyForm}
                layout="vertical"
                onFinish={onBuy}
                initialValues={{ domain: 1 }}
              >
                <Form.Item
                  name="domain"
                  label="Domain (域)"
                  rules={[{ required: true, message: '请输入域' }]}
                >
                  <InputNumber 
                    min={0} 
                    max={255}
                    style={{ width: '100%' }} 
                    placeholder="如: 1=逝者, 2=宠物"
                  />
                </Form.Item>

                <Form.Item
                  name="targetId"
                  label="Target ID (目标ID)"
                  rules={[{ required: true, message: '请输入目标ID' }]}
                >
                  <InputNumber 
                    min={0}
                    style={{ width: '100%' }} 
                    placeholder="纪念对象的ID"
                  />
                </Form.Item>

                {activeItem.unitPricePerWeek && (
                  <Form.Item
                    name="duration"
                    label="时长（周）"
                    rules={[{ required: true, message: '请输入供奉时长' }]}
                  >
                    <InputNumber 
                      min={1}
                      max={52}
                      style={{ width: '100%' }}
                      placeholder="供奉持续周数（1-52）"
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
                      borderColor: 'var(--color-primary, #B8860B)'
                    }}
                  >
                    确认供奉
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default OfferingsCatalog

