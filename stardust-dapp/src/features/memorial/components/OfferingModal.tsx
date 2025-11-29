/**
 * 供奉弹窗组件
 *
 * 功能说明：
 * 1. 复刻"云上思念"风格的祭品选择弹窗
 * 2. 左侧分类导航栏
 * 3. 右侧祭品网格展示
 * 4. 底部合计和供奉按钮
 * 5. 支持多选和数量选择
 *
 * 创建日期：2025-11-26
 */

import React, { useState, useMemo } from 'react'
import { Modal, Button, Badge } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import './OfferingModal.css'

/**
 * 函数级详细中文注释：祭品类型定义
 *
 * sacrificeId: 链上 pallet-memorial 的祭祀品目录ID
 * - 如果未设置，表示该祭品暂未在链上注册
 * - 供奉时优先使用 sacrificeId，若为空则使用默认祭品（id=1）
 */
export interface OfferingItem {
  id: string
  name: string
  price: number
  icon: string
  category: string
  isFree?: boolean
  /** 链上祭祀品目录ID（对应 pallet-memorial SacrificeOf） */
  sacrificeId?: number
}

/**
 * 函数级详细中文注释：已选祭品
 */
interface SelectedOffering {
  item: OfferingItem
  quantity: number
}

interface OfferingModalProps {
  /** 是否显示 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 供奉回调 */
  onOffer: (offerings: SelectedOffering[]) => void
  /** 是否正在提交 */
  loading?: boolean
}

/**
 * 函数级详细中文注释：祭品分类
 */
const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'package', label: '套餐' },
  { key: 'candle', label: '香烛' },
  { key: 'fruit', label: '花果' },
  { key: 'food', label: '酒菜' },
  { key: 'home', label: '家居汽车' },
  { key: 'villa', label: '别墅佣人' },
  { key: 'fashion', label: '服饰名表' },
  { key: 'digital', label: '数码乐器' },
  { key: 'festival', label: '节日' },
  { key: 'pet', label: '玩具宠物' },
  { key: 'sport', label: '运动' },
]

/**
 * 函数级详细中文注释：祭品数据
 *
 * sacrificeId 映射说明：
 * - 链上 pallet-memorial 需要先通过管理员注册祭祀品目录
 * - 此处 sacrificeId 为占位值，实际部署时需与链上目录同步
 * - 默认值 1 对应链上的"通用供奉"祭祀品
 */
const OFFERINGS: OfferingItem[] = [
  // 香烛类（sacrificeId: 1-4）
  { id: 'candle1', name: '蜡烛', price: 0, icon: '🕯️', category: 'candle', isFree: true, sacrificeId: 1 },
  { id: 'incense1', name: '香', price: 0, icon: '🪔', category: 'candle', isFree: true, sacrificeId: 2 },
  { id: 'incense2', name: '檀香', price: 3, icon: '🧧', category: 'candle', sacrificeId: 3 },
  { id: 'candle2', name: '长明灯', price: 5, icon: '🏮', category: 'candle', sacrificeId: 4 },

  // 花果类（sacrificeId: 5-12）
  { id: 'flower1', name: '鲜花', price: 0, icon: '💐', category: 'fruit', isFree: true, sacrificeId: 5 },
  { id: 'flower2', name: '菊花', price: 0, icon: '🌼', category: 'fruit', isFree: true, sacrificeId: 6 },
  { id: 'fruit1', name: '一篮水果', price: 8, icon: '🧺', category: 'fruit', sacrificeId: 7 },
  { id: 'flower3', name: '白百合', price: 3, icon: '🌷', category: 'fruit', sacrificeId: 8 },
  { id: 'flower4', name: '思念玫瑰', price: 3, icon: '🌹', category: 'fruit', sacrificeId: 9 },
  { id: 'flower5', name: '爱永恒', price: 3, icon: '💮', category: 'fruit', sacrificeId: 10 },
  { id: 'flower6', name: '深情追思', price: 3, icon: '🌸', category: 'fruit', sacrificeId: 11 },
  { id: 'flower7', name: '深沉的爱', price: 3, icon: '🌺', category: 'fruit', sacrificeId: 12 },

  // 酒菜类（sacrificeId: 13-22）
  { id: 'food1', name: '菊花茶', price: 3, icon: '🍵', category: 'food', sacrificeId: 13 },
  { id: 'food2', name: '菊花糕', price: 3, icon: '🍰', category: 'food', sacrificeId: 14 },
  { id: 'food3', name: '板栗糕', price: 3, icon: '🧁', category: 'food', sacrificeId: 15 },
  { id: 'food4', name: '桂花糕', price: 3, icon: '🍥', category: 'food', sacrificeId: 16 },
  { id: 'food5', name: '桂花米糕', price: 3, icon: '🍡', category: 'food', sacrificeId: 17 },
  { id: 'food6', name: '重阳糕', price: 3, icon: '🥮', category: 'food', sacrificeId: 18 },
  { id: 'food7', name: '茉英', price: 3, icon: '🍪', category: 'food', sacrificeId: 19 },
  { id: 'food8', name: '酒', price: 5, icon: '🍶', category: 'food', sacrificeId: 20 },
  { id: 'food9', name: '茶', price: 3, icon: '🫖', category: 'food', sacrificeId: 21 },
  { id: 'food10', name: '饺子', price: 5, icon: '🥟', category: 'food', sacrificeId: 22 },

  // 家居汽车类（sacrificeId: 23-26）
  { id: 'home1', name: '豪华轿车', price: 20, icon: '🚗', category: 'home', sacrificeId: 23 },
  { id: 'home2', name: '电视机', price: 10, icon: '📺', category: 'home', sacrificeId: 24 },
  { id: 'home3', name: '冰箱', price: 10, icon: '🧊', category: 'home', sacrificeId: 25 },
  { id: 'home4', name: '空调', price: 10, icon: '❄️', category: 'home', sacrificeId: 26 },

  // 别墅佣人类（sacrificeId: 27-29）
  { id: 'villa1', name: '豪华别墅', price: 50, icon: '🏰', category: 'villa', sacrificeId: 27 },
  { id: 'villa2', name: '佣人', price: 20, icon: '🧑‍🍳', category: 'villa', sacrificeId: 28 },
  { id: 'villa3', name: '保镖', price: 20, icon: '💂', category: 'villa', sacrificeId: 29 },

  // 服饰名表类（sacrificeId: 30-32）
  { id: 'fashion1', name: '西装', price: 10, icon: '🤵', category: 'fashion', sacrificeId: 30 },
  { id: 'fashion2', name: '名表', price: 20, icon: '⌚', category: 'fashion', sacrificeId: 31 },
  { id: 'fashion3', name: '金项链', price: 15, icon: '📿', category: 'fashion', sacrificeId: 32 },

  // 数码乐器类（sacrificeId: 33-35）
  { id: 'digital1', name: '手机', price: 10, icon: '📱', category: 'digital', sacrificeId: 33 },
  { id: 'digital2', name: '电脑', price: 15, icon: '💻', category: 'digital', sacrificeId: 34 },
  { id: 'digital3', name: '古筝', price: 20, icon: '🎸', category: 'digital', sacrificeId: 35 },

  // 节日类（sacrificeId: 36-38）
  { id: 'festival1', name: '月饼', price: 5, icon: '🥮', category: 'festival', sacrificeId: 36 },
  { id: 'festival2', name: '粽子', price: 5, icon: '🍙', category: 'festival', sacrificeId: 37 },
  { id: 'festival3', name: '年糕', price: 5, icon: '🍡', category: 'festival', sacrificeId: 38 },

  // 玩具宠物类（sacrificeId: 39-41）
  { id: 'pet1', name: '小狗', price: 10, icon: '🐕', category: 'pet', sacrificeId: 39 },
  { id: 'pet2', name: '小猫', price: 10, icon: '🐈', category: 'pet', sacrificeId: 40 },
  { id: 'pet3', name: '金鱼', price: 5, icon: '🐟', category: 'pet', sacrificeId: 41 },

  // 运动类（sacrificeId: 42-44）
  { id: 'sport1', name: '高尔夫', price: 15, icon: '⛳', category: 'sport', sacrificeId: 42 },
  { id: 'sport2', name: '麻将', price: 10, icon: '🀄', category: 'sport', sacrificeId: 43 },
  { id: 'sport3', name: '象棋', price: 8, icon: '♟️', category: 'sport', sacrificeId: 44 },

  // 套餐类（sacrificeId: 45-47）
  { id: 'package1', name: '基础套餐', price: 10, icon: '🎁', category: 'package', sacrificeId: 45 },
  { id: 'package2', name: '豪华套餐', price: 30, icon: '🎀', category: 'package', sacrificeId: 46 },
  { id: 'package3', name: '尊贵套餐', price: 88, icon: '👑', category: 'package', sacrificeId: 47 },
]

/**
 * 函数级详细中文注释：供奉弹窗组件
 */
export const OfferingModal: React.FC<OfferingModalProps> = ({
  open,
  onClose,
  onOffer,
  loading = false,
}) => {
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedOffering>>(new Map())

  /**
   * 函数级详细中文注释：根据分类过滤祭品
   */
  const filteredOfferings = useMemo(() => {
    if (activeCategory === 'all') {
      return OFFERINGS
    }
    return OFFERINGS.filter(item => item.category === activeCategory)
  }, [activeCategory])

  /**
   * 函数级详细中文注释：计算总价
   */
  const totalPrice = useMemo(() => {
    let total = 0
    selectedItems.forEach(({ item, quantity }) => {
      total += item.price * quantity
    })
    return total
  }, [selectedItems])

  /**
   * 函数级详细中文注释：选择/取消选择祭品
   */
  const handleItemClick = (item: OfferingItem) => {
    const newSelected = new Map(selectedItems)
    if (newSelected.has(item.id)) {
      // 如果已选择，增加数量
      const current = newSelected.get(item.id)!
      newSelected.set(item.id, { item, quantity: current.quantity + 1 })
    } else {
      // 如果未选择，添加
      newSelected.set(item.id, { item, quantity: 1 })
    }
    setSelectedItems(newSelected)
  }

  /**
   * 函数级详细中文注释：减少祭品数量
   */
  const handleItemDecrease = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation()
    const newSelected = new Map(selectedItems)
    const current = newSelected.get(itemId)
    if (current) {
      if (current.quantity <= 1) {
        newSelected.delete(itemId)
      } else {
        newSelected.set(itemId, { ...current, quantity: current.quantity - 1 })
      }
    }
    setSelectedItems(newSelected)
  }

  /**
   * 函数级详细中文注释：提交供奉
   */
  const handleOffer = () => {
    const offerings = Array.from(selectedItems.values())
    if (offerings.length === 0) {
      return
    }
    onOffer(offerings)
  }

  /**
   * 函数级详细中文注释：关闭弹窗时重置状态
   */
  const handleClose = () => {
    setSelectedItems(new Map())
    setActiveCategory('all')
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      closable={false}
      width={420}
      centered
      className="offering-modal"
      styles={{ body: { padding: 0 } }}
    >
      <div className="offering-modal-container">
        {/* 头部 */}
        <div className="offering-modal-header">
          <Button
            type="text"
            className="auto-offer-btn"
            style={{ color: '#ff9500' }}
          >
            自动供奉
          </Button>
          <span className="offering-modal-title">祈福祭品</span>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleClose}
            className="close-btn"
          />
        </div>

        {/* 主体内容 */}
        <div className="offering-modal-body">
          {/* 左侧分类 */}
          <div className="offering-categories">
            {CATEGORIES.map(cat => (
              <div
                key={cat.key}
                className={`category-item ${activeCategory === cat.key ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                {cat.label}
              </div>
            ))}
          </div>

          {/* 右侧祭品网格 */}
          <div className="offering-grid-container">
            {/* 广告横幅 */}
            <div className="offering-banner">
              <span>购买祭品套餐更优惠 &gt;&gt;</span>
            </div>

            {/* 祭品网格 */}
            <div className="offering-grid">
              {filteredOfferings.map(item => {
                const selected = selectedItems.get(item.id)
                return (
                  <div
                    key={item.id}
                    className={`offering-item ${selected ? 'selected' : ''}`}
                    onClick={() => handleItemClick(item)}
                  >
                    {selected && selected.quantity > 0 && (
                      <Badge
                        count={selected.quantity}
                        className="offering-badge"
                        onClick={(e) => handleItemDecrease(e as any, item.id)}
                      />
                    )}
                    <div className="offering-icon">{item.icon}</div>
                    <div className="offering-name">{item.name}</div>
                    <div className={`offering-price ${item.isFree ? 'free' : ''}`}>
                      {item.isFree ? '免费' : `${item.price}元`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="offering-modal-footer">
          <div className="discount-link">
            思念币抵扣 &gt;
          </div>
          <div className="total-section">
            <span className="total-label">合计：</span>
            <span className="total-price">{totalPrice.toFixed(2)}元</span>
          </div>
          <Button
            type="primary"
            className="offer-btn"
            onClick={handleOffer}
            loading={loading}
            disabled={selectedItems.size === 0}
          >
            供奉
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default OfferingModal
