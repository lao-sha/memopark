import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Form, InputNumber, Button, List, Tag, Typography, Space, message } from 'antd'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：文章列表页（按相册 ID 查询）
 * - 通过 `deceasedMedia.mediaByAlbum(albumId)` 读取媒体 ID 列表，再批量读取 `mediaOf(mediaId)` 详情。
 * - 过滤 `kind=Article(3)`，展示标题/摘要/uri（IPFS CID）。
 * - 由于未生成类型定义，采用 `toHuman()/toJSON()` 方式做兼容解析。
 */
const ArticleListPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [albumId, setAlbumId] = useState<number | null>(null)
  const [items, setItems] = useState<any[]>([])

  const parseMedia = useCallback((raw: any, id: any) => {
    try {
      const human: any = raw?.toHuman?.() || raw?.toJSON?.() || raw
      const kindStr: string = String(human?.kind ?? human?.Kind ?? '')
      const isArticle = /Article/i.test(kindStr) || String(human?.kind?.__kind || '').toLowerCase() === 'article'
      if (!isArticle) return null
      const title = human?.title || human?.Title || ''
      const summary = human?.summary || human?.Summary || ''
      const uri = human?.uri || human?.Uri || ''
      return { id: id?.toString?.() || String(id), title, summary, uri, raw: human }
    } catch {
      return null
    }
  }, [])

  const onQuery = useCallback(async () => {
    if (albumId === null || albumId === undefined) return message.warning('请输入相册ID')
    try {
      setLoading(true)
      const api = await getApi()
      const idsAny: any = await (api.query as any).deceasedMedia.mediaByAlbum(albumId)
      const ids = (idsAny?.toJSON?.() as any[]) || []
      if (!ids.length) {
        setItems([])
        setLoading(false)
        return
      }
      const q: any[] = await (api.query as any).deceasedMedia.mediaOf.multi(ids)
      const parsed = q
        .map((m: any, idx: number) => parseMedia(m, ids[idx]))
        .filter(Boolean)
      setItems(parsed)
      setLoading(false)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '查询失败')
      setLoading(false)
    }
  }, [albumId, parseMedia])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Card title="文章列表（按相册ID）">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Form layout="inline" onFinish={onQuery}>
            <Form.Item label="相册ID">
              <InputNumber min={0} value={albumId as any} onChange={v => setAlbumId((v as any) ?? null)} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>查询</Button>
            </Form.Item>
          </Form>

          <List
            bordered
            dataSource={items}
            locale={{ emptyText: '暂无文章' }}
            renderItem={(it: any) => (
              <List.Item actions={[
                <Button key="open" type="link" onClick={() => {
                  try { localStorage.setItem('mp.lastArticleCid', String(it.uri || '')) } catch {}
                  window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'article-detail' } }))
                }}>查看</Button>
              ]}>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color="blue">Article</Tag>
                      <Typography.Text strong>{String(it.title || '(未填写标题)')}</Typography.Text>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <Typography.Text type="secondary">媒体ID：</Typography.Text>
                        <Typography.Text code>{it.id}</Typography.Text>
                      </div>
                      {it.summary && <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>{String(it.summary)}</Typography.Paragraph>}
                      {it.uri && (
                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                          CID：<Typography.Text code copyable>{String(it.uri)}</Typography.Text>
                        </Typography.Paragraph>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Space>
      </Card>
    </div>
  )
}

export default ArticleListPage


