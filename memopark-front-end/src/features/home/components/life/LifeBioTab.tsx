import React from 'react'
import { Typography, Row, Col, Card } from 'antd'

/**
 * 函数级详细中文注释：生平故事 - 二级页面「生平」Tab
 * - 展示人物标题/摘要卡片、生平简介段落以及纪念视频预览块。
 * - 所有数据为占位，后续可替换为后端/链上真实数据；保持移动端优先样式。
 */
const LifeBioTab: React.FC = () => {
  return (
    <div>
      {/* 标题摘要卡片 */}
      <div style={{ margin: '8px', background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Row gutter={12}>
          <Col span={6}>
            <Card cover={<img src="https://picsum.photos/seed/bw/300/300" style={{ height: 96, objectFit: 'cover' }} />} bodyStyle={{ display: 'none' }} />
          </Col>
          <Col span={18}>
            <Typography.Title level={5} style={{ margin: 0 }}>【祭英烈】王伟烈士牺牲23周年祭，81192，我们从未忘却。</Typography.Title>
            <div style={{ color: '#666', marginTop: 8 }}>祖籍：浙江省湖州市</div>
            <div style={{ display: 'flex', gap: 12, color: '#8c8c8c', marginTop: 8 }}>
              <span>1986-04-06</span>
              <span>—</span>
              <span>2001-04-01</span>
            </div>
          </Col>
        </Row>
      </div>

      {/* 生平简介 */}
      <div style={{ margin: '8px', background: '#fff', borderRadius: 12, padding: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>生平简介</Typography.Title>
        <Typography.Paragraph style={{ marginTop: 8, fontSize: 14, color: '#333', lineHeight: 1.8 }}>
          王伟（1968年4月6日—2001年4月1日），浙江省湖州市人，中国海军航空兵飞行员，烈士。2001年4月1日8时55分，美国海军EP-3型侦察机在中国海南岛东南方向的中国专属经济区上空，与王伟驾驶的歼-8Ⅱ战斗机发生碰撞，王伟跳伞后失踪……
        </Typography.Paragraph>
      </div>

      {/* 纪念视频预览 */}
      <div style={{ margin: '8px', background: '#fff', borderRadius: 12, padding: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>纪念视频</Typography.Title>
        <div style={{ position: 'relative', marginTop: 12, width: '100%', height: 200, borderRadius: 8, overflow: 'hidden' }}>
          <img src="https://picsum.photos/seed/video-81192/800/450" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ marginTop: 8, color: '#333' }}>王伟牺牲20周年！你若记得81192，他便不悔…</div>
      </div>
    </div>
  )
}

export default LifeBioTab


