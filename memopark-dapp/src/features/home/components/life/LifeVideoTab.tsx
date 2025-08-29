import React, { useState } from 'react'
import { Typography } from 'antd'
import { PlayCircleFilled } from '@ant-design/icons'

/**
 * 函数级详细中文注释：生平故事 - 二级页面「纪念视频」Tab
 * - 展示一个主打纪念视频：封面图 + 播放图标覆盖；点击后切换为内联 HTML5 video 播放。
 * - 数据为占位，后续可替换为后端/链上链接；保持移动端优先，宽度自适应，圆角样式。
 */
const LifeVideoTab: React.FC = () => {
  const [playing, setPlaying] = useState<boolean>(false)

  // 占位视频数据（可替换为真实资源）
  const cover = 'https://picsum.photos/seed/video81192/800/450'
  const title = '王伟牺牲20周年！ 你若记得81192，他便不悔…'
  const src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

  return (
    <div style={{ margin: '8px', background: '#fff', borderRadius: 12, padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>纪念视频</Typography.Title>
      <div style={{ position: 'relative', marginTop: 12, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        {playing ? (
          <video src={src} controls autoPlay style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div onClick={() => setPlaying(true)} style={{ cursor: 'pointer' }}>
            <img src={cover} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
            <PlayCircleFilled style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 64, color: 'rgba(255,255,255,0.95)' }} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, color: '#333' }}>{title}</div>
      <Typography.Paragraph style={{ textAlign: 'center', color: '#A0A0A0', marginTop: 24 }}>
        没有更多数据了
      </Typography.Paragraph>
    </div>
  )
}

export default LifeVideoTab


