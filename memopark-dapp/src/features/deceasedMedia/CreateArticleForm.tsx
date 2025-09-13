import React, { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Space, Typography, message } from 'antd'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { cryptoWaitReady, blake2AsU8a } from '@polkadot/util-crypto'
import { mapDispatchErrorMessage } from '../../lib/errors'

/**
 * 函数级详细中文注释：追忆文章创建表单
 * - 仅支持将“文章 JSON”作为 IPFS CID 写入 `uri`，同时在链上保存 `content_hash`（blake2-256）。
 * - 允许用户直接粘贴 CID 与 JSON 正文（前端计算哈希）；也可手工粘贴 `content_hash`。
 * - extrinsic：`deceasedData.addMedia(album_id, kind=3(Article), uri, None, content_hash, title?, summary?, None, None, None, order_index?)`。
 * - 费用提示：创建费 + 交易费 + 可退押金（由运行时参数决定）。
 */
const CreateArticleForm: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [computedHash, setComputedHash] = useState<string>('')

  /**
   * 函数级中文注释：将 Uint8Array 转十六进制（0x 开头）
   */
  const u8aToHex = useCallback((u8: Uint8Array) => {
    const hex = Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('')
    return '0x' + hex
  }, [])

  /**
   * 函数级中文注释：计算 blake2-256 哈希（对标准化 JSON 字符串）
   */
  const computeHash = useCallback(async (jsonText: string) => {
    await cryptoWaitReady()
    try {
      const normalized = JSON.stringify(JSON.parse(jsonText))
      const u8 = new TextEncoder().encode(normalized)
      const digest = blake2AsU8a(u8, 256)
      const hex = u8aToHex(digest)
      setComputedHash(hex)
      message.success('已计算 content_hash')
    } catch (e: any) {
      console.error(e)
      message.error('JSON 解析或哈希计算失败')
    }
  }, [u8aToHex])

  /**
   * 函数级中文注释：提交交易，调用 deceasedData.addMedia 生成文章媒体
   */
  const onFinish = useCallback(async (values: any) => {
    try {
      setLoading(true)
      const {
        albumId,
        uriCid,
        title,
        summary,
        orderIndex,
        contentJson,
        contentHashHex,
      } = values

      // 表单校验：albumId
      if (albumId === null || albumId === undefined || isNaN(Number(albumId)) || Number(albumId) < 0) {
        setLoading(false); return message.warning('相册ID需为非负数字')
      }
      // 表单校验：CID（宽松，仅非空且长度校验）
      if (!uriCid || String(uriCid).length < 10) { setLoading(false); return message.warning('请输入有效的 IPFS CID') }
      // 表单校验：content_hash 或 JSON
      if ((!contentJson || !contentJson.trim()) && !(contentHashHex && /^0x[0-9a-fA-F]{64}$/.test(contentHashHex))) {
        setLoading(false); return message.warning('请提供 JSON 正文以计算哈希，或手动填写 0x 开头的 32 字节 content_hash')
      }
      if (title && String(title).length > 200) { setLoading(false); return message.warning('标题过长（≤200）') }
      if (summary && String(summary).length > 500) { setLoading(false); return message.warning('摘要过长（≤500）') }

      let hashHex: string | null = null
      if (contentJson && contentJson.trim().length > 0) {
        await computeHash(contentJson)
        hashHex = computedHash || null
      } else if (contentHashHex && /^0x[0-9a-fA-F]{64}$/.test(contentHashHex)) {
        hashHex = contentHashHex
      }

      if (!hashHex) { setLoading(false); return message.warning('content_hash 生成失败，请检查 JSON') }

      const args: any[] = [
        Number(albumId),
        3, // kind = Article
        String(uriCid),
        null, // thumbnail_uri
        hashHex, // content_hash: Option<H256>
        title ? String(title) : null,
        summary ? String(summary) : null,
        null, // duration_secs
        null, // width
        null, // height
        typeof orderIndex === 'number' ? Number(orderIndex) : null,
      ]

      await signAndSendLocalFromKeystore('deceasedData','addMedia', args)
      message.success('已提交文章创建交易')
    } catch (e: any) {
      console.error(e)
      message.error(mapDispatchErrorMessage(e, '提交失败'))
    } finally {
      setLoading(false)
    }
  }, [computeHash, computedHash])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card title="创建追忆文章">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message="费用提示"
            description="本操作将产生：创建费 + 交易费 + 可退押金（成熟期 1 年，期间有投诉将暂停可退）。"
          />

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="albumId" label="相册ID" rules={[{ required: true, message: '请输入相册ID（仅相册 owner 可添加）' }]}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="例如 0" />
            </Form.Item>

            <Form.Item name="title" label="标题">
              <Input maxLength={200} placeholder="文章标题（可选）" />
            </Form.Item>

            <Form.Item name="summary" label="摘要">
              <Input.TextArea rows={2} maxLength={500} placeholder="文章摘要（可选）" />
            </Form.Item>

            <Form.Item name="contentJson" label="正文 JSON">
              <Input.TextArea rows={6} placeholder="可粘贴文章 JSON 正文（前端将标准化并计算 blake2-256）" />
            </Form.Item>

            <Space>
              <Button onClick={() => {
                const form = (document.querySelector('form') as any)?.__ANT_FORM_INTERNAL__?.name
              }} style={{ display: 'none' }} />
            </Space>

            <Form.Item name="contentHashHex" label="content_hash（备用，0x...）">
              <Input placeholder="若未提供正文 JSON，可手工填入 0x 开头 32 字节哈希" />
            </Form.Item>

            <Form.Item name="uriCid" label="IPFS CID（正文 JSON 的 CID）" rules={[{ required: true, message: '请输入 IPFS CID' }]}>
              <Input placeholder="例如 bafy..." />
            </Form.Item>

            <Form.Item name="orderIndex" label="排序号">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="可选" />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={loading} block>提交文章</Button>
            {computedHash && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                已计算 content_hash：<Typography.Text code copyable>{computedHash}</Typography.Text>
              </Typography.Paragraph>
            )}
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default CreateArticleForm


