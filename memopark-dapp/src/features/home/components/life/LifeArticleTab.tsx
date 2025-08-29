import React from 'react'
import { Typography } from 'antd'

/**
 * 函数级详细中文注释：生平故事 - 二级页面「追忆文章」Tab
 * - 文章列表：标题 + 摘要 + 日期；底部“没有更多数据了”。
 * - 数据为占位，后续可替换为后端/链上分页接口。
 */
const articles = [
  { title: '泪目！烈士王伟墓前有人送来航母模型，你若记…', excerpt: '今年4月1日，是烈士王伟牺牲20周年。陵园工作人员…', date: '2021-03-31' },
  { title: '见字如面｜“海空卫士”王伟，您看到了吗？20年…', excerpt: '81192，一个每年4月1日，总会被提起的数字，这…', date: '2021-03-31' },
  { title: '4月1日不只是愚人节，81192不只是一串数字…', excerpt: '4月1日，本该是一个因愚人节而轻松欢乐或为张…', date: '2021-03-31' },
]

const LifeArticleTab: React.FC = () => {
  const openAll = () => {}
  return (
    <div>
      <div style={{ margin: '16px 8px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>追忆文章</Typography.Title>
        <span style={{ color: '#8c8c8c' }} onClick={openAll}>查看全部</span>
      </div>
      <div style={{ margin: '0 8px', background: '#fff', borderRadius: 12 }}>
        {articles.map((a, i) => (
          <div key={i} style={{ padding: '12px 12px', borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#333', lineHeight: 1.6 }}>{a.title}</div>
            <div style={{ color: '#666', marginTop: 6 }}>{a.excerpt}</div>
            <div style={{ color: '#9b9b9b', marginTop: 6 }}>{a.date}</div>
          </div>
        ))}
      </div>
      <Typography.Paragraph style={{ textAlign: 'center', color: '#A0A0A0', marginTop: 24 }}>
        没有更多数据了
      </Typography.Paragraph>
    </div>
  )
}

export default LifeArticleTab


