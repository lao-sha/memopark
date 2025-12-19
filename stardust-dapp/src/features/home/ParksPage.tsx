import React from 'react'
import { Tabs, Input, Button, Carousel, Typography, Card, Row, Col } from 'antd'
import { SearchOutlined, CalendarOutlined, HomeOutlined, UserOutlined, PlusCircleFilled, EllipsisOutlined, CloseOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：陵园页面（由原 HomePage 重命名）
 * - 结构：顶部标题/操作、搜索+签到、类目 Tabs、横幅、两列陵园卡片、底部导航、中间创建按钮。
 * - 数据：静态占位，后续可接入链上/索引。
 */
const parks = [
  { id: 1, name: '泰山长安人文纪念园', phone: '18554191299', img: 'https://picsum.photos/id/1018/600/400' },
  { id: 2, name: '福禄园公墓', phone: '057584567205', img: 'https://picsum.photos/id/1025/600/400' },
  { id: 3, name: '遂川县缅仪馆', phone: '6324044', img: 'https://picsum.photos/id/1040/600/400' },
  { id: 4, name: '中原海葬纪念园', phone: '18742538873', img: 'https://picsum.photos/id/1039/600/400' },
]

const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆']

const ParksPage: React.FC = () => {
  const onCreate = () => {
    // 简单方式：尝试点击“创建纪念馆”Tab
    const tab = document.querySelector('[role="tab"][title="创建纪念馆"]') as HTMLElement | null
    tab?.click()
  }
  return (
    <div style={{ maxWidth: 414, margin: '0 auto', textAlign: 'left', paddingBottom: 96 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>陵园</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Input placeholder="搜索馆名或人名" prefix={<SearchOutlined />} allowClear style={{ borderRadius: 24 }} />
          <Button shape="circle" icon={<CalendarOutlined />} />
        </div>
        <div style={{ marginTop: 8 }}>
          <Tabs activeKey="陵园" items={categories.map((c) => ({ key: c, label: c }))} tabBarGutter={12} size="small" />
        </div>
      </div>

      <div style={{ borderRadius: 12, overflow: 'hidden', margin: '8px 8px 12px' }}>
        <Carousel autoplay dots>
          <div><img src="https://picsum.photos/800/300?random=1" style={{ width: '100%', display: 'block' }} /></div>
          <div><img src="https://picsum.photos/800/300?random=2" style={{ width: '100%', display: 'block' }} /></div>
        </Carousel>
      </div>

      <Typography.Title level={5} style={{ margin: '8px 12px' }}>陵园</Typography.Title>

      <div style={{ padding: '0 8px' }}>
        <Row gutter={[12, 12]}>
          {parks.map((p) => (
            <Col xs={12} key={p.id}>
              <Card
                hoverable
                cover={<img src={p.img} alt={p.name} style={{ height: 120, objectFit: 'cover' }} />}
                bodyStyle={{ padding: 12 }}
                style={{ borderRadius: 12 }}
              >
                <Typography.Text strong>{p.name}</Typography.Text>
                <div style={{ color: '#8c8c8c', marginTop: 4 }}>{p.phone}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button size="small" shape="round">预约</Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 56, background: '#fff', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ textAlign: 'center', color: '#2F80ED' }}>
          <HomeOutlined />
          <div style={{ fontSize: 12 }}>首页</div>
        </div>
        <div style={{ width: 64 }} />
        <div style={{ textAlign: 'center' }}>
          <UserOutlined />
          <div style={{ fontSize: 12 }}>我的</div>
        </div>
      </div>

      <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 1001, textAlign: 'center' }}>
        <PlusCircleFilled onClick={onCreate} style={{ fontSize: 64, color: '#2F80ED', background: '#fff', borderRadius: '50%' }} />
        <div style={{ fontSize: 12, marginTop: 4, color: '#333' }}>创建纪念馆</div>
      </div>
    </div>
  )
}

export default ParksPage


