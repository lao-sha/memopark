/**
 * 墓园视图组件
 *
 * 功能说明：
 * 1. 复刻"云上思念"风格的3D墓园场景
 * 2. 展示墓碑、蜡烛、香炉、花卉等元素
 * 3. 底部操作栏（擦墓碑、除草、祭品、跪拜、鞠躬）
 * 4. 支持祭品展示和互动
 *
 * 创建日期：2025-11-26
 */

import React, { useState } from 'react'
import { Button, message } from 'antd'
import {
  ArrowLeftOutlined,
  HomeOutlined,
  ShareAltOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { DeceasedInfo } from '../../../services/deceasedService'
import './GraveyardView.css'

interface GraveyardViewProps {
  /** 逝者信息 */
  deceased: DeceasedInfo
  /** 返回回调 */
  onBack?: () => void
  /** 回首页 */
  onHome?: () => void
  /** 加入亲友团 */
  onJoinFamily?: () => void
  /** 分享 */
  onShare?: () => void
  /** 打开祭品弹窗 */
  onOpenOffering?: () => void
  /** 切换到纪念馆 */
  onSwitchToMemorial?: () => void
}

/**
 * 函数级详细中文注释：格式化年份显示
 */
const formatYearRange = (birthTs: string, deathTs: string): string => {
  if (!birthTs || !deathTs) return ''
  const birthYear = birthTs.slice(0, 4)
  const deathYear = deathTs.slice(0, 4)
  return `${birthYear}-${deathYear}`
}

/**
 * 函数级详细中文注释：墓园视图组件
 */
export const GraveyardView: React.FC<GraveyardViewProps> = ({
  deceased,
  onBack,
  onHome,
  onJoinFamily,
  onShare,
  onOpenOffering,
  onSwitchToMemorial,
}) => {
  const [isKneeling, setIsKneeling] = useState(false)
  const [isBowing, setIsBowing] = useState(false)

  /**
   * 函数级详细中文注释：擦墓碑
   */
  const handleCleanTombstone = () => {
    message.success('已擦拭墓碑，愿逝者安息')
  }

  /**
   * 函数级详细中文注释：除草
   */
  const handleRemoveGrass = () => {
    message.success('已清除杂草，墓园整洁如新')
  }

  /**
   * 函数级详细中文注释：跪拜
   */
  const handleKneel = () => {
    setIsKneeling(true)
    message.success('跪拜祭奠，表达哀思')
    setTimeout(() => setIsKneeling(false), 2000)
  }

  /**
   * 函数级详细中文注释：鞠躬
   */
  const handleBow = () => {
    setIsBowing(true)
    message.success('鞠躬致敬，缅怀先人')
    setTimeout(() => setIsBowing(false), 1500)
  }

  return (
    <div className="graveyard-view">
      {/* 顶部导航栏 */}
      <div className="graveyard-header">
        <div className="header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="header-btn"
          />
          <Button
            type="text"
            icon={<HomeOutlined />}
            onClick={onHome}
            className="header-btn"
          />
          <Button
            type="primary"
            size="small"
            onClick={onJoinFamily}
            className="join-family-btn"
          >
            加入亲友团
          </Button>
          <span className="level-badge">🔷 普通馆</span>
        </div>
        <div className="header-right">
          <Button type="text" className="header-btn" onClick={() => {}}>
            ↩️
          </Button>
          <Button type="text" icon={<ShareAltOutlined />} onClick={onShare} className="header-btn" />
          <Button type="text" icon={<MenuOutlined />} className="header-btn" />
        </div>
      </div>

      {/* 纪念馆/墓园切换标签 */}
      <div className="graveyard-tabs">
        <span className="tab" onClick={onSwitchToMemorial}>纪念馆</span>
        <span className="tab-separator">·</span>
        <span className="tab active">墓园</span>
      </div>

      {/* 墓园场景 */}
      <div className="graveyard-scene">
        {/* 山景背景 */}
        <div className="mountain-bg" />

        {/* 右上角寒衣节烧包 */}
        <div className="special-offering">
          <div className="special-icon">🔥</div>
          <div className="special-text">寒衣节烧包</div>
        </div>

        {/* 墓碑区域 */}
        <div className="tombstone-area">
          {/* 左侧牌位 */}
          <div className="memorial-tablet left">
            <div className="tablet-content">
              <div className="tablet-title">牢记礼仪李之本</div>
            </div>
            <div className="tablet-count">0</div>
          </div>

          {/* 中央墓碑 */}
          <div className="main-tombstone">
            <div className="tombstone-top">永远怀念</div>
            <div className="tombstone-photo">
              {deceased.mainImageCid ? (
                <img
                  src={`https://ipfs.io/ipfs/${deceased.mainImageCid}`}
                  alt={deceased.name}
                  className="deceased-photo"
                />
              ) : (
                <div className="photo-placeholder">
                  {deceased.name?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div className="tombstone-name">
              {deceased.name?.split('').map((char, i) => (
                <span key={i}>{char}</span>
              ))}
            </div>
          </div>

          {/* 右侧牌位 */}
          <div className="memorial-tablet right">
            <div className="tablet-content">
              <div className="tablet-title">莫忘恩以德而恕</div>
            </div>
            <div className="tablet-count">0</div>
          </div>
        </div>

        {/* 香炉和蜡烛 */}
        <div className="offerings-row">
          <div className="candle-holder left">
            <div className="candle">🕯️</div>
            <div className="candle-flame" />
          </div>
          <div className="incense-burner">
            <div className="burner-icon">🪔</div>
          </div>
          <div className="candle-holder right">
            <div className="candle">🕯️</div>
            <div className="candle-flame" />
          </div>
        </div>

        {/* 墓台 */}
        <div className="tomb-platform" />

        {/* 花卉装饰 */}
        <div className="flowers-decoration">
          <div className="flower-pot left">💐</div>
          <div className="grass-row">
            {[...Array(8)].map((_, i) => (
              <span key={i} className="grass">🌿</span>
            ))}
          </div>
          <div className="flower-pot right">💐</div>
        </div>

        {/* 地面 */}
        <div className="ground-tiles" />
      </div>

      {/* 底部操作栏 */}
      <div className="graveyard-actions">
        <div className="action-item" onClick={handleCleanTombstone}>
          <div className="action-icon">🧹</div>
          <div className="action-text">擦墓碑</div>
        </div>
        <div className="action-item" onClick={handleRemoveGrass}>
          <div className="action-icon">🌾</div>
          <div className="action-text">除草</div>
        </div>
        <div className="action-item center" onClick={onOpenOffering}>
          <div className="action-icon-bg">🎁</div>
          <div className="action-text">祭品</div>
        </div>
        <div className={`action-item ${isKneeling ? 'active' : ''}`} onClick={handleKneel}>
          <div className="action-icon">🧎</div>
          <div className="action-text">跪拜</div>
        </div>
        <div className={`action-item ${isBowing ? 'active' : ''}`} onClick={handleBow}>
          <div className="action-icon">🙇</div>
          <div className="action-text">鞠躬</div>
        </div>
      </div>
    </div>
  )
}

export default GraveyardView
