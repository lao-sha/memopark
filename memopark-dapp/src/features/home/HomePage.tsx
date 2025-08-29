import React from 'react'
import { Tabs, Input, Button, Carousel, Typography, Card, Row, Col, Space } from 'antd'
import { SearchOutlined, CalendarOutlined, EllipsisOutlined, CloseOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：首页（贴合新截图）
 * - 结构：顶部标题/搜索/签到、类目 Tabs、横幅、公告条、主功能卡区（四宫格）、快捷入口（图标行）。
 * - 数据：静态占位，后续替换为链上/索引。
 */
const categories = ['首页', '陵园', '名人馆', '伟人馆', '英雄馆']

const HomePage: React.FC = () => {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 16 }}>
      {/* 顶部：标题/更多 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>陵园</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>

        {/* 搜索 + 签到 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Input placeholder="搜索馆名或人名" prefix={<SearchOutlined />} allowClear style={{ borderRadius: 24 }} />
          <Button shape="circle" icon={<CalendarOutlined />} />
        </div>

        {/* 类目 Tabs */}
        <div style={{ marginTop: 8 }}>
          <Tabs activeKey="首页" items={categories.map((c) => ({ key: c, label: c }))} tabBarGutter={12} size="small" />
        </div>
      </div>

      {/* 横幅轮播 */}
      <div style={{ borderRadius: 12, overflow: 'hidden', margin: '8px 8px 12px' }}>
        <Carousel autoplay dots>
          <div><img src="https://picsum.photos/800/300?random=1" style={{ width: '100%', display: 'block' }} /></div>
          <div><img src="https://picsum.photos/800/300?random=2" style={{ width: '100%', display: 'block' }} /></div>
        </Carousel>
      </div>

      {/* 动态/公告条 */}
      <div style={{ margin: '0 8px 8px', padding: '8px 12px', background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Space>
          <img src="https://picsum.photos/seed/avatar/32" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          <Typography.Text strong>小康</Typography.Text>
          <Typography.Text type="secondary">创建了纪念馆</Typography.Text>
          <Typography.Text type="secondary">4小时前</Typography.Text>
        </Space>
      </div>

      {/* 主功能卡片区（四宫格示意） */}
      <div style={{ padding: '0 8px' }}>
        <Row gutter={[12, 12]}>
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>家族祠堂</Typography.Title>
              <div style={{ color: '#8c8c8c', marginTop: 4 }}>创建家族祠堂供奉先祖</div>
            </Card>
          </Col>
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>追思会</Typography.Title>
              <div style={{ color: '#8c8c8c', marginTop: 4 }}>共同追忆</div>
            </Card>
          </Col>
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>讣告</Typography.Title>
              <div style={{ color: '#8c8c8c', marginTop: 4 }}>永恒追思</div>
            </Card>
          </Col>
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>更多</Typography.Title>
              <div style={{ color: '#8c8c8c', marginTop: 4 }}>查看更多</div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 快捷入口图标行 */}
      <div style={{ margin: '12px 8px 0', background: '#fff', borderRadius: 12, padding: '12px 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Row gutter={[8, 8]} justify="space-between">
          {['思念有音', '心灵树洞', '祈福树', '放河灯'].map((txt) => (
            <Col key={txt} span={6} style={{ textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, margin: '0 auto', borderRadius: 20, background: '#FFF3E0' }} />
              <div style={{ marginTop: 6, fontSize: 12 }}>{txt}</div>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  )
}

export default HomePage


