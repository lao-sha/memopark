/**
 * 生平故事页（云上思念布局）
 */

import React, { useMemo } from 'react'
import { PlayCircleFilled } from '@ant-design/icons'
import './BiographySection.css'
import { DeceasedInfo } from '../../../services/deceasedService'
import { buildIpfsUrl } from '../../../utils/ipfsUrl'

interface BiographySectionProps {
  deceased: DeceasedInfo
}

const DEFAULT_PHOTOS = [
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&sat=-55',
  'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1475700268786-1dcff90b0f88?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1473247034197-1a9e7ed1c143?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=600&auto=format&fit=crop',
]

const tabs = ['生平', '回忆相册', '纪念视频', '追忆文章']

export const BiographySection: React.FC<BiographySectionProps> = ({ deceased }) => {
  const mainImageUrl = buildIpfsUrl(deceased.mainImageCid)
  const avatar =
    mainImageUrl || 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&auto=format&fit=crop'

  const albumPhotos = useMemo(() => {
    if (!mainImageUrl) return DEFAULT_PHOTOS
    return Array.from({ length: 6 }, () => mainImageUrl)
  }, [mainImageUrl])

  const birth = formatDate(deceased.birthTs)
  const death = formatDate(deceased.deathTs)

  return (
    <div className="bio-wrapper">
      <div className="bio-tabs">
        {tabs.map(tab => (
          <div key={tab} className={`bio-tab ${tab === '生平' ? 'active' : ''}`}>
            {tab}
          </div>
        ))}
      </div>

      <section className="bio-section">
        <div className="bio-text">
          {generateBioText(deceased.name)}
        </div>
      </section>

      <section className="bio-section">
        <div className="bio-section-header">
          <span>纪念视频</span>
          <span className="bio-link">查看全部</span>
        </div>
        <div className="bio-video-card">
          <img src={avatar} alt="纪念视频" />
          <PlayCircleFilled className="bio-video-play" />
          <div className="bio-video-title">百年致敬·{deceased.name}</div>
          <div className="bio-video-desc">{birth} - {death}</div>
        </div>
      </section>

      <section className="bio-section">
        <div className="bio-section-header">
          <span>回忆相册</span>
          <span className="bio-link">查看全部</span>
        </div>
        <div className="bio-album-grid">
          {albumPhotos.map((photo, idx) => (
            <div key={idx} className="bio-album-thumb">
              <img src={photo} alt={`相册-${idx}`} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const formatDate = (ts: string | undefined): string => {
  if (!ts || ts.length !== 8) return '未知'
  const y = ts.slice(0, 4)
  const m = ts.slice(4, 6)
  const d = ts.slice(6, 8)
  return `${y}.${m}.${d}`
}

const generateBioText = (name: string) =>
  `世界著名科学家、空气动力学家、${name}被誉为“中国航天之父”和“火箭之王”。他的一生献给祖国的航天事业，创造了无数传奇。`

export default BiographySection
