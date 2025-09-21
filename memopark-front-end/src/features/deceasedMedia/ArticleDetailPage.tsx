import React, { useCallback, useEffect, useState } from 'react'
import { Card, Form, Input, Button, Typography, Space, Alert, message } from 'antd'

/**
 * 函数级详细中文注释：文章详情页
 * - 支持手动输入 IPFS CID 或从 localStorage 读取上次选择的 CID（键：mp.lastArticleCid）。
 * - 通过公共网关拉取 JSON（可替换为自建网关），渲染 title/summary/body_markdown。
 * - 不引入额外渲染库，body_markdown 以等宽预格式显示；后续可替换为 Markdown 渲染器。
 */
const ArticleDetailPage: React.FC = () => {
  const [cid, setCid] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any | null>(null)

  useEffect(() => {
    const last = localStorage.getItem('mp.lastArticleCid')
    if (last && !cid) setCid(last)
  }, [cid])

  /**
   * 函数级中文注释：拉取 IPFS JSON（使用公共网关），并保存到状态
   */
  const fetchJson = useCallback(async () => {
    if (!cid) return message.warning('请输入 IPFS CID')
    try {
      setLoading(true)
      // 网关可替换为平台自建：如 https://ipfs.memopark/gateway/ipfs/
      const url = `https://ipfs.io/ipfs/${encodeURIComponent(cid)}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`网关返回 ${resp.status}`)
      const json = await resp.json()
      setData(json)
      localStorage.setItem('mp.lastArticleCid', cid)
      setLoading(false)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '拉取失败')
      setLoading(false)
    }
  }, [cid])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Card title="文章详情（IPFS）">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message="提示" description="输入文章正文 JSON 的 IPFS CID，点击加载查看。" />

          <Form layout="inline" onFinish={fetchJson}>
            <Form.Item label="CID" style={{ flex: 1 }}>
              <Input value={cid} onChange={e=>setCid(e.target.value)} placeholder="例如 bafy..." style={{ width: 480 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>加载</Button>
            </Form.Item>
          </Form>

          {data && (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {data.title && <Typography.Title level={4} style={{ marginBottom: 8 }}>{String(data.title)}</Typography.Title>}
              {data.summary && <Typography.Paragraph type="secondary">{String(data.summary)}</Typography.Paragraph>}
              {data.body_markdown && (
                <Card size="small" title="正文（Markdown 原文）">
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{String(data.body_markdown)}</pre>
                </Card>
              )}
            </Space>
          )}
        </Space>
      </Card>
    </div>
  )
}

export default ArticleDetailPage


