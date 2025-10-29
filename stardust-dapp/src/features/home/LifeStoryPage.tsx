import React, { useState } from 'react'
import { Tabs, Typography } from 'antd'
import { EllipsisOutlined, CloseOutlined, FireOutlined, HomeOutlined } from '@ant-design/icons'
import LifeBioTab from './components/life/LifeBioTab'
import LifeAlbumTab from './components/life/LifeAlbumTab'
import LifeVideoTab from './components/life/LifeVideoTab'
import LifeArticleTab from './components/life/LifeArticleTab'

/**
 * 函数级详细中文注释：生平故事页面（贴合示例图的移动端高保真）
 * - 顶部白色标题栏；下方为二级 Tabs（高亮“生平”）。
 * - 文字导语（左）+“查看全部”（右）。
 * - 纪念视频卡片：大预览图 + 居中播放图标 + 下方标题说明。
 * - 回忆相册：三列图片网格 + 右上“查看全部”。
 * - 追忆文章：标题 + 右上“查看全部”。
 * - 右侧悬浮操作：供奉（橙色）、返回首页（灰）。
 */
const subTabs = ['生平', '回忆相册', '纪念视频', '追忆文章']

// 预览期的相册/文章演示数据已转移至独立 Tab 组件，避免重复定义。

const LifeStoryPage: React.FC = () => {
  const [active, setActive] = useState<string>('生平')
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 80 }}>
      {/* 顶部栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>生平故事</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      {/* 二级 Tabs */}
      <div style={{ padding: '0 8px' }}>
        <Tabs
          activeKey={active}
          onChange={(k) => setActive(k)}
          tabBarGutter={12}
          size="small"
          items={subTabs.map((t) => ({ key: t, label: t }))}
        />
      </div>

      {/* 按活动 Tab 渲染内容 */}
      {active === '生平' && (
        <LifeBioTab />
      )}
      {active === '回忆相册' && (
        <div style={{ marginTop: 12 }}>
          <LifeAlbumTab />
        </div>
      )}
      {active === '纪念视频' && (
        <LifeVideoTab />
      )}
      {active === '追忆文章' && (
        <LifeArticleTab />
      )}

      {/* 下方旧的预览区块移除，改为按 Tab 渲染 */}

      {/* 右侧悬浮操作 */}
      <div style={{ position: 'fixed', right: 16, bottom: 96, zIndex: 1000 }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: 'linear-gradient(180deg,#FFA94D,#F08C2E)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.15)', marginBottom: 12 }}>
          <FireOutlined style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: '#EDEDED', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}>
          <HomeOutlined style={{ fontSize: 26, color: '#7a7a7a' }} />
        </div>
      </div>
    </div>
  )
}

export default LifeStoryPage


