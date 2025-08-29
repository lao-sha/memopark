import React from 'react'
import { Button, Typography } from 'antd'
import { HomeOutlined, MessageOutlined, ReadOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：逝者纪念馆页面（移动端高保真）
 * - 顶部大图背景 + 居中头像框 + 标题与寄语。
 * - 右侧功能浮条：祭品、留言、生平。
 * - 底部操作：点亮蜡烛统计按钮、创建纪念馆 CTA（可引导到创建页）。
 * - 所有数据为占位，后续可替换为后端/链上内容。
 */
const MemorialHallPage: React.FC = () => {
  const onCreate = () => {
    const tab = document.querySelector('[role="tab"][title="创建纪念馆"]') as HTMLElement | null
    tab?.click()
  }
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', background: '#0A7ACB' }}>
      {/* 顶部背景图 */}
      <div style={{ position: 'relative' }}>
        <img src="https://picsum.photos/seed/sea/800/600" style={{ width: '100%', display: 'block' }} />
        {/* 居中头像框 */}
        <div style={{ position: 'absolute', left: '50%', top: 220, transform: 'translateX(-50%)', width: 140, height: 180, border: '6px solid #fff', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.2)', overflow: 'hidden', background: '#fff' }}>
          <img src="https://picsum.photos/seed/portrait-m/400/600" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {/* 标题与寄语 */}
        <div style={{ position: 'absolute', left: 16, right: 16, top: 420, color: '#fff', textAlign: 'center' }}>
          <Typography.Title level={3} style={{ color: '#fff', margin: 0 }}>女歌手千百惠因病去世，享年62岁</Typography.Title>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.95 }}>“属于我们这一代的咖啡屋随风逝去，当咖啡香散尽，歌声仍在。”</div>
        </div>
      </div>

      {/* 海面大图占位（延续背景） */}
      <div>
        <img src="https://picsum.photos/seed/sea-ship/800/700" style={{ width: '100%', display: 'block' }} />
      </div>

      {/* 右侧悬浮功能条 */}
      <div style={{ position: 'fixed', right: 16, bottom: 120, zIndex: 1000 }}>
        <div style={{ width: 68, height: 68, borderRadius: 34, background: 'linear-gradient(180deg,#FFA94D,#F08C2E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 12 }}>祭品</div>
        <div style={{ width: 68, height: 68, borderRadius: 34, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', marginBottom: 12, boxShadow: '0 6px 16px rgba(0,0,0,0.1)' }}><MessageOutlined /></div>
        <div style={{ width: 68, height: 68, borderRadius: 34, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', boxShadow: '0 6px 16px rgba(0,0,0,0.1)' }}><ReadOutlined /></div>
      </div>

      {/* 底部操作区 */}
      <div style={{ position: 'sticky', bottom: 0, background: 'transparent', padding: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block size="large" style={{ height: 56, borderRadius: 28, background: '#FFB74D', borderColor: '#FFB74D' }}>点亮蜡烛 已有65人点亮</Button>
          <Button block size="large" type="primary" style={{ height: 56, borderRadius: 28 }} onClick={onCreate}>创建纪念馆</Button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, color: '#fff' }}>
          <HomeOutlined /> 返回首页
        </div>
      </div>
    </div>
  )
}

export default MemorialHallPage


