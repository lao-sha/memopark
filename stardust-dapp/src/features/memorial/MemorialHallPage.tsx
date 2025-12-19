import React from 'react'
import { Button, Typography, Avatar, List, Card, Space, Tag, Divider } from 'antd'
import { HomeOutlined, ShareAltOutlined, MoreOutlined, HeartOutlined } from '@ant-design/icons'
// ActionsBar 已删除，旧墓位功能已移除

/**
 * 函数级详细中文注释：逝者纪念馆页面（移动端新视觉，还原参考图布局）
 * - 头部：返回、关注、分享、更多；左侧加入亲友团；右侧纵向动作菜单（花圈/蜡烛/敬香/扫墓/祭品）。
 * - 主视图：墓碑背景 + 居中头像与碑名/生卒信息；左侧蜡烛剩余时间演示。
 * - 统计卡片：花圈/蜡烛/敬香累计数。
 * - 动态列表：“为逝者做以下祭拜”流水，采用 emoji 图标模拟。
 * - 底部：调用链上动作栏 `ActionsBar`（供奉/扫墓等）；保持 640px 内移动端优先。
 */
const MemorialHallPage: React.FC = () => {
  const onCreate = () => {
    const tab = document.querySelector('[role="tab"][title="创建纪念馆"]') as HTMLElement | null
    tab?.click()
  }

  // 演示数据：供动态列表与统计使用
  const stats = [
    { label: '花圈', value: '13.9万' },
    { label: '蜡烛', value: '14.1万' },
    { label: '敬香', value: '14.1万' },
  ]
  const feed = new Array(12).fill(0).map((_, i) => ({
    id: i + 1,
    name: ['念成','思…','永思','吴…','辉','铭','大…','曾…','…','木子','永…','@…'][i % 12],
    date: '2025-08-31',
    content: [
      '莲花灯 金元宝 孔明灯 龙眼 金山银山 发!',
      '白菊花 酱板鸭 锅包肉 酱肘子 扫墓 敬香',
      '纸钱 金元宝 金山银山 别墅 百万冥币 花',
      '扫墓 米饭 饺子 可乐 牛奶 奶茶 咖啡 斋',
      '发财香 别墅 百万冥币 橙子 草莓 波萝 钻',
      '敬香 蜡烛 花圈',
    ][i % 6],
  }))

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', textAlign: 'left', background: '#f7f1e6' }}>
      {/* 顶部背景 + 交互条 */}
      <div style={{ position: 'relative' }}>
        <img src="https://picsum.photos/seed/park-forest/1200/800" style={{ width: '100%', display: 'block' }} />
        {/* 顶部操作 */}
        <div style={{ position: 'absolute', left: 8, right: 8, top: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Button size="small" shape="round">返回</Button>
          </Space>
          <Space size={8}>
            <Button size="small" shape="round" icon={<HeartOutlined />}>关注</Button>
            <Button size="small" shape="round" icon={<ShareAltOutlined />}>分享</Button>
            <Button size="small" shape="round" icon={<MoreOutlined />}>更多</Button>
          </Space>
        </div>
        {/* 左侧“加入亲友团”与头像列 */}
        <div style={{ position: 'absolute', left: 10, top: 80 }}>
          <Avatar.Group maxCount={3} maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
            <Avatar src="https://picsum.photos/seed/a/80" />
            <Avatar src="https://picsum.photos/seed/b/80" />
            <Avatar src="https://picsum.photos/seed/c/80" />
            <Avatar>+9</Avatar>
          </Avatar.Group>
          <div style={{ marginTop: 8 }}>
            <Tag color="blue">加入亲友团</Tag>
          </div>
        </div>
        {/* 墓碑与头像 */}
        <div style={{ position: 'absolute', left: '50%', top: 170, transform: 'translateX(-50%)', width: 280, textAlign: 'center' }}>
          <div style={{ width: 180, height: 220, border: '6px solid #3f3f3f', borderRadius: 8, margin: '0 auto', background: '#222' }}>
            <img src="https://picsum.photos/seed/portrait/600/800" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <Typography.Title level={3} style={{ color: '#fff', marginTop: 12 }}>张鹏</Typography.Title>
          <div style={{ color: '#fff', opacity: 0.9 }}>1986~2008</div>
        </div>
        {/* 右侧纵向动作菜单（示意） */}
        <div style={{ position: 'absolute', right: 12, top: 120, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {['花圈','蜡烛','敬香','扫墓','祭品'].map((t, idx) => (
            <Button key={idx} size="large" shape="round" style={{ width: 88 }}>{t}</Button>
          ))}
        </div>
        {/* 左侧蜡烛剩余（演示） */}
        <div style={{ position: 'absolute', left: 14, bottom: 30, color: '#333', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.8)', padding: '6px 10px', borderRadius: 12 }}>12天6时</div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ padding: 12 }}>
        <Card bodyStyle={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: '#a07b2a' }}>{s.label}</div>
                <div style={{ fontWeight: 600, fontSize: 18 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 动态列表 */}
      <div style={{ padding: '0 12px 80px' }}>
        <List
          dataSource={feed}
          renderItem={(item) => (
            <List.Item style={{ alignItems: 'flex-start' }}>
              <List.Item.Meta
                avatar={<Avatar src={`https://picsum.photos/seed/u${item.id}/80`} />}
                title={`${item.date}为逝者做以下祭拜`}
                description={<span>{item.content}</span>}
              />
            </List.Item>
          )}
        />
      </div>

      {/* 底部创建 CTA */}
      <div style={{ position: 'sticky', bottom: 0, padding: 12, background: 'linear-gradient(180deg,rgba(247,241,230,0.2),#f7f1e6 40%, #f7f1e6)' }}>
        {/* ActionsBar 已删除，旧墓位功能已移除 */}
        <Button block type="primary" style={{ height: 48, borderRadius: 8 }} onClick={onCreate}>创建纪念馆</Button>
        <div style={{ textAlign: 'center', marginTop: 8, color: '#8c6d3b' }}>
          <HomeOutlined /> 返回首页
        </div>
      </div>
    </div>
  )
}

export default MemorialHallPage


