/**
 * 纪念馆封面组件
 *
 * 功能说明：
 * 1. 复刻"云上思念"风格的纪念馆封面
 * 2. 支持单人/双人墓园展示
 * 3. 显示祭拜统计和忌日倒计时
 * 4. 右侧祭品栏
 * 5. 底部操作按钮（点亮蜡烛、创建纪念馆）
 *
 * 创建日期：2025-11-26
 */

import React, { useMemo } from 'react'
import { Button, Space } from 'antd'
import {
  ArrowLeftOutlined,
  HomeOutlined,
  ShareAltOutlined,
  DownloadOutlined,
  MenuOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { DeceasedInfo } from '../../../services/deceasedService'
import './MemorialCover.css'
import { buildIpfsUrl } from '../../../utils/ipfsUrl'

interface MemorialCoverProps {
  /** 逝者信息（支持1-2人） */
  deceasedList: DeceasedInfo[]
  /** 祭拜统计 */
  statistics?: {
    totalVisits: number
    totalCandles: number
    daysUntilAnniversary?: number
    daysUntilBirthday?: number
  }
  /** 滚动公告文字 */
  announcement?: string
  /** 返回回调 */
  onBack?: () => void
  /** 回首页 */
  onHome?: () => void
  /** 加入亲友团 */
  onJoinFamily?: () => void
  /** 分享 */
  onShare?: () => void
  /** 点蜡烛 */
  onLightCandle?: () => void
  /** 创建纪念馆 */
  onCreateMemorial?: () => void
  /** 祭品操作 */
  onOffering?: (type: 'pagoda' | 'tower' | 'incense' | 'candle' | 'flower' | 'lantern') => void
  /** 留言 */
  onMessage?: () => void
  /** 生平 */
  onBiography?: () => void
  /** 祭品 */
  onOfferingMenu?: () => void
  /** 切换到墓园 */
  onSwitchToGraveyard?: () => void
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
 * 函数级详细中文注释：计算离世年数
 */
const calculateYearsSinceDeath = (deathTs: string): number => {
  if (!deathTs || deathTs.length !== 8) return 0
  const deathYear = parseInt(deathTs.slice(0, 4), 10)
  const currentYear = new Date().getFullYear()
  return currentYear - deathYear
}

/**
 * 函数级详细中文注释：计算忌日倒计时
 */
const calculateDaysUntilAnniversary = (deathTs: string): number => {
  if (!deathTs || deathTs.length !== 8) return 0
  const month = parseInt(deathTs.slice(4, 6), 10)
  const day = parseInt(deathTs.slice(6, 8), 10)

  const now = new Date()
  const thisYear = now.getFullYear()
  let anniversary = new Date(thisYear, month - 1, day)

  if (anniversary < now) {
    anniversary = new Date(thisYear + 1, month - 1, day)
  }

  const diff = anniversary.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * 函数级详细中文注释：计算生辰倒计时
 */
const calculateDaysUntilBirthday = (birthTs: string): number => {
  if (!birthTs || birthTs.length !== 8) return 0
  const month = parseInt(birthTs.slice(4, 6), 10)
  const day = parseInt(birthTs.slice(6, 8), 10)

  const now = new Date()
  const thisYear = now.getFullYear()
  let birthday = new Date(thisYear, month - 1, day)

  if (birthday < now) {
    birthday = new Date(thisYear + 1, month - 1, day)
  }

  const diff = birthday.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * 函数级详细中文注释：格式化数字（添加千分位）
 */
const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}

/**
 * 函数级详细中文注释：纪念馆封面组件
 */
export const MemorialCover: React.FC<MemorialCoverProps> = ({
  deceasedList,
  statistics,
  announcement = '以为贤惠，善良的好妈妈，妈妈今天是你的忌日，愿你在天堂一切安好...',
  onBack,
  onHome,
  onJoinFamily,
  onShare,
  onLightCandle,
  onCreateMemorial,
  onOffering,
  onMessage,
  onBiography,
  onOfferingMenu,
  onSwitchToGraveyard,
}) => {
  // 计算统计数据
  const stats = useMemo(() => {
    const firstDeceased = deceasedList[0]
    const yearsSinceDeath = firstDeceased ? calculateYearsSinceDeath(firstDeceased.deathTs) : 0
    const daysUntilAnniversary = firstDeceased ? calculateDaysUntilAnniversary(firstDeceased.deathTs) : 0
    const daysUntilBirthday = firstDeceased ? calculateDaysUntilBirthday(firstDeceased.birthTs) : 0

    return {
      yearsSinceDeath,
      daysUntilAnniversary,
      daysUntilBirthday,
      totalVisits: statistics?.totalVisits ?? 856,
      totalCandles: statistics?.totalCandles ?? 83,
    }
  }, [deceasedList, statistics])

  return (
    <div className="memorial-cover">
      {/* 顶部导航栏 */}
      <div className="memorial-cover-header">
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
          <span className="premium-badge">🏆 高级馆</span>
        </div>
        <div className="header-right">
          <Button type="text" icon={<DownloadOutlined />} className="header-btn" />
          <Button type="text" icon={<ShareAltOutlined />} onClick={onShare} className="header-btn" />
          <Button type="text" icon={<MenuOutlined />} className="header-btn" />
        </div>
      </div>

      {/* 滚动公告 */}
      <div className="memorial-cover-announcement">
        <div className="announcement-text">{announcement}</div>
      </div>

      {/* 纪念馆/墓园切换标签 */}
      <div className="memorial-cover-tabs">
        <span className="tab active">纪念馆</span>
        <span className="tab-separator">·</span>
        <span className="tab" onClick={onSwitchToGraveyard}>墓园</span>
      </div>

      {/* 左侧装饰 */}
      <div className="memorial-cover-left-decor">
        <div className="decor-item upgrade-btn">
          <span className="decor-icon">🏛️</span>
          <span className="decor-text">升级纪念馆</span>
        </div>
        <div className="decor-item mourning-btn">
          <span className="decor-icon">🎗️</span>
          <span className="decor-text">冥寿恩亲</span>
        </div>
      </div>

      {/* 中央头像区域 */}
      <div className="memorial-cover-portraits">
        {deceasedList.map((deceased) => {
          const portraitUrl = buildIpfsUrl(deceased.mainImageCid)

          return (
            <div key={deceased.id} className="portrait-item">
              <div className="portrait-frame">
                {portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt={deceased.name}
                    className="portrait-image"
                  />
                ) : (
                  <div className="portrait-placeholder">
                    {deceased.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div className="portrait-name">{deceased.name}</div>
              <div className="portrait-years">
                {formatYearRange(deceased.birthTs, deceased.deathTs)}
              </div>
            </div>
          )
        })}
      </div>

      {/* 统计信息 */}
      <div className="memorial-cover-stats">
        <div className="stats-line">
          他们中最久的已经离开我们{stats.yearsSinceDeath}年了
        </div>
        <div className="stats-line">
          亲友们已祭拜{formatNumber(stats.totalVisits)}次，已点亮蜡烛{formatNumber(stats.totalCandles)}次
        </div>
        <div className="stats-line">
          距忌日还有{stats.daysUntilAnniversary}天，距生辰还有{stats.daysUntilBirthday}天
        </div>
      </div>

      {/* 右侧祭品栏 */}
      <div className="memorial-cover-offerings">
        <div className="offering-item" onClick={() => onOffering?.('pagoda')}>
          <div className="offering-icon pagoda">🗼</div>
          <div className="offering-count">0</div>
        </div>
        <div className="offering-item" onClick={() => onOffering?.('tower')}>
          <div className="offering-icon tower">🏯</div>
          <div className="offering-count">0</div>
        </div>
        <div className="offering-item" onClick={() => onOffering?.('incense')}>
          <div className="offering-icon incense">🕯️</div>
          <div className="offering-count">0</div>
        </div>
        <div className="offering-item active" onClick={() => onOffering?.('candle')}>
          <div className="offering-icon candle">🕯️</div>
          <div className="offering-count">1</div>
        </div>
        <div className="offering-item" onClick={() => onOffering?.('flower')}>
          <div className="offering-icon flower">🌸</div>
          <div className="offering-count">0</div>
        </div>
        <div className="offering-item" onClick={() => onOffering?.('lantern')}>
          <div className="offering-icon lantern">🏮</div>
          <div className="offering-count">0</div>
        </div>
      </div>

      {/* 右侧功能按钮 */}
      <div className="memorial-cover-actions">
        <div className="action-item" onClick={onOfferingMenu}>
          <div className="action-icon">🌺</div>
          <div className="action-text">祭品</div>
        </div>
        <div className="action-item" onClick={onMessage}>
          <div className="action-icon">💬</div>
          <div className="action-text">留言</div>
        </div>
        <div className="action-item" onClick={onBiography}>
          <div className="action-icon">📜</div>
          <div className="action-text">生平</div>
        </div>
      </div>

      {/* 最近祭拜记录 */}
      <div className="memorial-cover-recent">
        <div className="recent-item">
          <div className="recent-avatar">👤</div>
          <div className="recent-info">
            <span className="recent-name">老高</span>
            <span className="recent-badge">🌟</span>
          </div>
          <div className="recent-action">供奉了深沉的爱</div>
        </div>
        <div className="recent-item">
          <div className="recent-avatar">👤</div>
          <div className="recent-info">
            <span className="recent-name">老高</span>
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="memorial-cover-footer">
        <Button
          className="footer-btn candle-btn"
          onClick={onLightCandle}
        >
          <span className="btn-icon">📁</span>
          <div className="btn-content">
            <div className="btn-title">点亮蜡烛</div>
            <div className="btn-subtitle">已点亮{stats.totalCandles}支蜡烛</div>
          </div>
        </Button>
        <Button
          className="footer-btn create-btn"
          type="primary"
          onClick={onCreateMemorial}
        >
          <span className="btn-icon">🏛️</span>
          <div className="btn-content">
            <div className="btn-title">创建纪念馆</div>
            <div className="btn-subtitle">为已逝亲人建馆</div>
          </div>
        </Button>
      </div>

      {/* 火焰动画背景 */}
      <div className="memorial-cover-flames">
        <div className="flame flame-1">🔥</div>
        <div className="flame flame-2">🔥</div>
      </div>
    </div>
  )
}

export default MemorialCover
