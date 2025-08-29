import React from 'react'
import { Tabs, Input, Button, Typography, Row, Col, Card, Carousel } from 'antd'
import { SearchOutlined, CalendarOutlined, EllipsisOutlined, CloseOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：伟人馆页面（移动端）
 * - 结构：顶部标题/搜索/签到、分类 Tabs（高亮“伟人馆”）、主题轮播横幅、六宫格伟人卡片、查看更多按钮。
 * - 数据：静态占位，后续接入链上/索引服务。
 */
const categories = ['陵园', '名人馆', '伟人馆', '英雄馆', '事件馆']

const slides = [
  { id: 1, img: 'https://picsum.photos/seed/great1/800/280', title: '数风流人物', subtitle: '江山代有才人出' },
  { id: 2, img: 'https://picsum.photos/seed/great2/800/280', title: '各领风骚', subtitle: '数百年' },
]

/**
 * 函数级详细中文注释：顶部轮播 Banner（含回退）
 * - 与名人馆轮播一致：自动播放、文字覆盖层、图片加载失败回退。
 */
const BannerCarousel: React.FC = () => {
  return (
    <div style={{ margin: '8px', borderRadius: 12, overflow: 'hidden' }}>
      <Carousel autoplay dots>
        {slides.map((s) => (
          <div key={s.id}>
            <div style={{ position: 'relative', width: '100%', height: 180, background: '#000' }}>
              <img
                src={s.img}
                alt={s.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
                onError={(e: any) => { e.currentTarget.style.display = 'none' }}
              />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%)' }} />
              <div style={{ position: 'absolute', left: 16, bottom: 16, color: '#fff' }}>
                <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>{s.title}</Typography.Title>
                <Typography.Text>{s.subtitle}</Typography.Text>
              </div>
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  )
}

const figures = [
  { id: 1, name: '毛主席', img: 'https://picsum.photos/seed/m1/400/400' },
  { id: 2, name: '周恩来', img: 'https://picsum.photos/seed/m2/400/400' },
  { id: 3, name: '邓小平', img: 'https://picsum.photos/seed/m3/400/400' },
  { id: 4, name: '陈独秀', img: 'https://picsum.photos/seed/m4/400/400' },
  { id: 5, name: '朱德', img: 'https://picsum.photos/seed/m5/400/400' },
  { id: 6, name: '孙中山', img: 'https://picsum.photos/seed/m6/400/400' },
]

const GreatsPage: React.FC = () => {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 16 }}>
      {/* 顶部栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>伟人馆</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Input placeholder="搜索馆名或人名" prefix={<SearchOutlined />} allowClear style={{ borderRadius: 24 }} />
          <Button shape="circle" icon={<CalendarOutlined />} />
        </div>
        <div style={{ marginTop: 8 }}>
          <Tabs activeKey="伟人馆" items={categories.map((c) => ({ key: c, label: c }))} tabBarGutter={12} size="small" />
        </div>
      </div>

      {/* 主题轮播 */}
      <BannerCarousel />

      {/* 伟人卡片六宫格 */}
      <div style={{ margin: '8px', background: '#fff', borderRadius: 12, padding: '12px' }}>
        <Typography.Title level={5} style={{ margin: '0 0 12px' }}>伟人纪念馆</Typography.Title>
        <Row gutter={[12, 20]}>
          {figures.map((p) => (
            <Col span={8} key={p.id} style={{ textAlign: 'center' }}>
              <Card
                hoverable
                cover={<img src={p.img} alt={p.name} style={{ width: '100%', height: 100, objectFit: 'cover' }} />}
                bodyStyle={{ padding: 8 }}
                style={{ borderRadius: 12 }}
              >
                <div style={{ fontWeight: 600 }}>{p.name}</div>
              </Card>
            </Col>
          ))}
        </Row>

        <div style={{ marginTop: 12, background: '#f7f7f7', borderRadius: 10, textAlign: 'center', padding: '12px 0', color: '#666' }}>
          查看更多纪念馆 ＞
        </div>
      </div>
    </div>
  )
}

export default GreatsPage


