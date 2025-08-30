import React, { useEffect, useState } from 'react'
import { Card, List, Typography } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'

/**
 * 函数级详细中文注释：基金审计最小看板
 * - 读取事件与存储：展示 `AnnualReports`（year -> hash）。
 * - 作为示例，仅拉取最近若干年（0..=2100 范围过滤有值）。
 */
export default function EndowmentAuditPage() {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [items, setItems] = useState<Array<{ year: number; hash: string }>>([])

  useEffect(() => {
    (async () => {
      const provider = new WsProvider('ws://127.0.0.1:9944')
      const api = await ApiPromise.create({ provider })
      setApi(api)
      const list: Array<{ year: number; hash: string }> = []
      for (let y = 2000; y <= 2100; y++) {
        // pallet 名小写 + storage 名：annualReports
        const opt = await (api.query as any).memoEndowment.annualReports(y)
        if (opt.isSome) {
          list.push({ year: y, hash: opt.unwrap().toHex() })
        }
      }
      setItems(list.reverse())
    })()
  }, [])

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={4}>基金年度审计报告</Typography.Title>
      <List
        dataSource={items}
        renderItem={(it) => (
          <List.Item>
            <List.Item.Meta title={`${it.year} 年`} description={<code>{it.hash}</code>} />
          </List.Item>
        )}
      />
      {items.length === 0 && <Typography.Paragraph>暂无数据</Typography.Paragraph>}
    </Card>
  )
}


