import React from 'react'
import { Row, Col, Card, Typography } from 'antd'

/**
 * 函数级详细中文注释：生平故事 - 二级页面「回忆相册」Tab
 * - 三列缩略图 + 追加一张大图；底部“没有更多数据了”提示。
 * - 占位数据，可替换为后端/链上返回值；移动端优先，方图裁切。
 */
const images: string[] = [
  'https://picsum.photos/seed/memo0/600/600',
  'https://picsum.photos/seed/memo1/600/600',
  'https://picsum.photos/seed/memo2/600/600',
  'https://picsum.photos/seed/memo3/900/600',
]

const LifeAlbumTab: React.FC = () => {
  return (
    <div style={{ padding: '0 8px' }}>
      <Row gutter={[12, 12]}>
        {images.slice(0, 3).map((src, idx) => (
          <Col span={8} key={idx}>
            <Card
              hoverable
              cover={<img src={src} style={{ height: 110, objectFit: 'cover' }} />}
              bodyStyle={{ display: 'none' }}
              style={{ borderRadius: 12 }}
            />
          </Col>
        ))}
      </Row>
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24}>
          <Card
            hoverable
            cover={<img src={images[3]} style={{ height: 160, objectFit: 'cover' }} />}
            bodyStyle={{ display: 'none' }}
            style={{ borderRadius: 12 }}
          />
        </Col>
      </Row>
      <Typography.Paragraph style={{ textAlign: 'center', color: '#A0A0A0', marginTop: 24 }}>
        没有更多数据了
      </Typography.Paragraph>
    </div>
  )
}

export default LifeAlbumTab


