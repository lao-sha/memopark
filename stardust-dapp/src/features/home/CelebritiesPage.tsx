import React from 'react'
import { Tabs, Input, Button, Typography, Row, Col, Card, Carousel } from 'antd'
import { SearchOutlined, CalendarOutlined, EllipsisOutlined, CloseOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：名人馆页面（移动端）
 * - 结构：顶部标题/搜索/签到、分类 Tabs（高亮“名人馆”）、主题轮播横幅、九宫格名人卡片。
 * - 数据：静态占位，后续接入链上/索引服务；不暴露敏感信息。
 */
const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆']

const people = [
  { id: 1, name: '袁隆平', img: 'https://picsum.photos/id/1005/400/400' },
  { id: 2, name: '张国荣', img: 'https://picsum.photos/id/1001/400/400' },
  { id: 3, name: '琼瑶', img: 'https://picsum.photos/id/1011/400/400' },
  { id: 4, name: '吴尊友', img: 'https://picsum.photos/id/1012/400/400' },
  { id: 5, name: '宗庆后', img: 'https://picsum.photos/id/1013/400/400' },
  { id: 6, name: '李玟', img: 'https://picsum.photos/id/1014/400/400' },
  { id: 7, name: '阿来', img: 'https://picsum.photos/id/1015/400/400' },
  { id: 8, name: '叶嘉莹', img: 'https://picsum.photos/id/1016/400/400' },
  { id: 9, name: '朱德', img: 'https://picsum.photos/id/1018/400/400' },
]

/**
 * 函数级详细中文注释：名人馆页顶部轮播组件
 * - 使用 antd Carousel 自动播放；每一页包含背景图与文案覆盖层，保证可读性。
 * - 提供 onError 回退，避免图片加载失败导致空白。
 */
const slides = [
  { id: 1, img: 'https://picsum.photos/seed/celebs1/800/280', title: '星星会陨落', subtitle: '但信仰永不暗淡' },
  { id: 2, img: 'https://picsum.photos/seed/celebs2/800/280', title: '致敬与纪念', subtitle: '传递光与爱' },
  { id: 3, img: 'https://picsum.photos/seed/celebs3/800/280', title: '文化长存', subtitle: '记忆延续' },
]

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

const CelebritiesPage: React.FC = () => {
  return (
    <div style={{ maxWidth: 414, margin: '0 auto', textAlign: 'left', paddingBottom: 16 }}>
      {/* 顶部栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 8px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#333' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>名人馆</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Input placeholder="搜索馆名或人名" prefix={<SearchOutlined />} allowClear style={{ borderRadius: 24 }} />
          <Button shape="circle" icon={<CalendarOutlined />} />
        </div>
        <div style={{ marginTop: 8 }}>
          <Tabs activeKey="名人馆" items={categories.map((c) => ({ key: c, label: c }))} tabBarGutter={12} size="small" />
        </div>
      </div>

      {/* 主题轮播 */}
      <BannerCarousel />

      {/* 名人九宫格 */}
      <div style={{ margin: '8px', background: '#fff', borderRadius: 12, padding: '12px' }}>
        <Typography.Title level={5} style={{ margin: '0 0 12px' }}>名人纪念馆</Typography.Title>
        <Row gutter={[12, 20]}>
          {people.map((p) => (
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
      </div>
    </div>
  )
}

export default CelebritiesPage


