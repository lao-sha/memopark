import React, { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Space, Typography, message } from 'antd'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { cryptoWaitReady, blake2AsU8a } from '@polkadot/util-crypto'
import { mapDispatchErrorMessage } from '../../lib/errors'

/**
 * 函数级详细中文注释：追忆文章创建表单
 * - 仅支持将“文章 JSON”作为 IPFS CID 写入 `uri`，同时在链上保存 `content_hash`（blake2-256）。
 * - 允许用户直接粘贴 CID 与 JSON 正文（前端计算哈希）；也可手工粘贴 `content_hash`。
 * - extrinsic（已迁移）：`deceasedText.setArticle(deceased_id, cid, title?, summary?)`。
 * - 费用提示：创建费 + 交易费 + 可退押金（由运行时参数决定）。
 */
const CreateArticleForm: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [pwd, setPwd] = useState('')
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
   * 函数级中文注释：将字符串编码为 UTF-8 字节数组（Array<number>）。
   * - 与链上 BoundedVec<u8> 参数对齐，避免 Uint8Array 在 JSON 序列化时的兼容性问题。
   */
  const strToBytes = useCallback((s: string): number[] => Array.from(new TextEncoder().encode(String(s || ''))), [])

  /**
   * 函数级中文注释：将 0x 开头 32 字节十六进制转为 Array<number>（长度 32）。
   * - 若输入非法则返回 null，以便上层校验并提示。
   */
  const hex32ToBytes = useCallback((hex: string): number[] | null => {
    try {
      const v = String(hex || '')
      if (!/^0x[0-9a-fA-F]{64}$/.test(v)) return null
      const out: number[] = []
      for (let i = 2; i < v.length; i += 2) {
        out.push(parseInt(v.slice(i, i + 2), 16))
      }
      if (out.length !== 32) return null
      return out
    } catch { return null }
  }, [])

  /**
   * 函数级中文注释：提交交易，调用 deceasedText.setArticle 生成文章记录
   */
  const onFinish = useCallback(async (values: any) => {
    try {
      setLoading(true)
      const {
        deceasedId,
        uriCid,
        title,
        summary,
        contentJson,
        contentHashHex,
      } = values

      if (!pwd || pwd.length < 8) { setLoading(false); return message.warning('请输入至少 8 位签名密码') }
      // 校验逝者ID
      if (deceasedId === null || deceasedId === undefined || isNaN(Number(deceasedId)) || Number(deceasedId) < 0) {
        setLoading(false); return message.warning('请输入有效的逝者ID')
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

      // 统一参数字节化：uri/title/summary 走 UTF-8 字节数组
      const did = Number(deceasedId)
      const args: any[] = [did, strToBytes(String(uriCid)), title? strToBytes(String(title)) : null, summary? strToBytes(String(summary)) : null]
      await signAndSendLocalWithPassword('deceasedText','setArticle', args, pwd)
      message.success('已提交文章创建交易')
    } catch (e: any) {
      console.error(e)
      message.error(mapDispatchErrorMessage(e, '提交失败'))
    } finally {
      setLoading(false)
    }
  }, [computeHash, computedHash, pwd, hex32ToBytes, strToBytes])

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
            <Form.Item label="签名密码" required>
              <Input.Password placeholder="至少 8 位" value={pwd} onChange={e=> setPwd(e.target.value)} />
            </Form.Item>
            <Form.Item name="deceasedId" label="逝者ID" rules={[{ required: true, message: '请输入逝者ID' }]}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="例如 1" />
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

            {/* 文章排序由前端列表决定，此处不再提供 orderIndex */}

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


