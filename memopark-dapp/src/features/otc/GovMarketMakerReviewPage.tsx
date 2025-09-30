import React from 'react'
import { Card, Form, Input, Button, Space, Typography, Alert, Divider, message } from 'antd'

/**
 * 函数级详细中文注释：做市商委员会审核页面（骨架）
 * - 目标：提供最小闭环的前端占位，用于输入 mmId 并展示/核对公开与私密 CID（仅透出字段，不在前端解密私密内容）
 * - 审批按钮仅为占位，真实应签名调用 pallet-market-maker::approve/reject
 * - 公开资料：public_root_cid；私密资料根：private_root_cid（仅用于下载 manifest 与 .enc 文件供委员离线解密）
 */
export default function GovMarketMakerReviewPage() {
  const [form] = Form.useForm()
  const [error, setError] = React.useState<string>('')
  const [data, setData] = React.useState<any>(null)

  /**
   * 函数级详细中文注释：拉取待审申请（占位）
   * - 实际应从 Subsquid 或后端查询接口获取 mmId 对应的申请详情
   */
  const onFetch = async () => {
    setError('')
    setData(null)
    try {
      const mmId = form.getFieldValue('mm_id')
      if (!mmId) throw new Error('请输入 mm_id')
      // 占位数据：模拟返回结构
      setData({
        mm_id: mmId,
        owner: '5F....',
        public_root_cid: 'bafy...public',
        private_root_cid: 'bafy...private',
        fee_bps: 25,
        min_amount: '100.00',
        status: 'PendingReview',
        submitted_at: new Date().toLocaleString(),
      })
    } catch (e: any) {
      setError(e?.message || '获取失败')
    }
  }

  /**
   * 函数级详细中文注释：批准与驳回（占位）
   * - approve：应签名调用 pallet-market-maker::approve(mm_id)
   * - reject：应签名调用 pallet-market-maker::reject(mm_id, slash_bps)
   */
  const onApprove = async () => {
    if (!data) return
    message.success(`已批准（占位）：mm_id=${data.mm_id}`)
  }
  const onReject = async () => {
    if (!data) return
    message.info(`已驳回（占位）：mm_id=${data.mm_id}`)
  }

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={5}>做市商审批（委员会）</Typography.Title>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <Form form={form} layout="vertical" onFinish={onFetch}>
        <Form.Item label="mm_id" name="mm_id" rules={[{ required: true, message: '请输入 mm_id' }]}> 
          <Input placeholder="例如 mm-1727..." />
        </Form.Item>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" htmlType="submit" block>拉取待审申请</Button>
        </Space>
      </Form>

      {data && (
        <>
          <Divider />
          <Typography.Text strong>申请详情</Typography.Text>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, marginTop: 8 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
          <Alert type="warning" showIcon style={{ marginTop: 12 }}
            message="解密提示"
            description="请使用委员私钥离线解包 private_root_cid 下的 private.enc/manifest.json，并核验 .enc 文件哈希与内容后再做决策。" />
          <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
            <Button type="primary" onClick={onApprove} block>批准（占位）</Button>
            <Button danger onClick={onReject} block>驳回（占位）</Button>
          </Space>
        </>
      )}
    </Card>
  )
}


