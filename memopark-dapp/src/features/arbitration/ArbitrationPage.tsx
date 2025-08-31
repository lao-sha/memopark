import React from 'react'
import { Alert, Button, Form, Input, InputNumber, Tabs, Typography, message, Space } from 'antd'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'
import { buildForwardRequest, NAMESPACES, pretty } from '../../lib/forwarder'
import { AppConfig } from '../../lib/config'
import { signAndSend } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：仲裁（代付元交易导出）
 * - 提供 dispute/arbitrate 两类操作的元交易 JSON 生成。
 */
const ArbitrationPage: React.FC = () => {
  const [output, setOutput] = React.useState('')

  const onExport = async (values: any) => {
    try {
      const owner = values.owner?.trim()
      const ns = NAMESPACES.arbitration
      const nonce = Number(values.nonce || 0)
      const validTill = Number(values.valid_till || 0)
      const call = {
        section: 'arbitration',
        method: values.method,
        args: {
          domain: values.domain,
          id: values.id,
          evidence: values.evidence ? String(values.evidence).split(',').map((x: string) => x.trim()) : [],
          decision_code: values.decision_code,
          bps: values.bps,
        },
      }
      const req = buildForwardRequest({ ns, owner, call, nonce, validTill })
      setOutput(pretty(req))
      message.success('已生成代付元交易 JSON，可复制')
    } catch (e: any) {
      message.error(e?.message || '生成失败')
    }
  }

  const onSubmitSponsor = async () => {
    try {
      if (!output) throw new Error('请先生成代付 JSON')
      const res = await fetch(AppConfig.sponsorApi, { method: 'POST', headers: { 'content-type': 'application/json' }, body: output })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '提交失败')
      message.success(`提交成功：${data?.txHash || '已受理'}`)
    } catch (e: any) {
      message.error(e?.message || '提交失败')
    }
  }

  const onDirectSend = async (values: any) => {
    try {
      const address = values.owner?.trim()
      if (!address) throw new Error('缺少地址(owner)')
      if (values.method === 'dispute') {
        const args = [values.domain, values.id, []]
        const txHash = await signAndSend(address, 'arbitration', 'dispute', args)
        message.success(`已上链：${txHash}`)
      } else if (values.method === 'arbitrate') {
        const args = [values.domain, values.id, values.decision_code, values.bps || null]
        const txHash = await signAndSend(address, 'arbitration', 'arbitrate', args)
        message.success(`已上链：${txHash}`)
      }
    } catch (e: any) {
      message.error(e?.message || '上链失败')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 88 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>仲裁（代付）</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      <div style={{ padding: '8px 8px 0' }}>
        <Alert type="info" showIcon message="建议使用平台代付：前端生成 MetaTx JSON，平台后端签名并上链" />
      </div>

      <div style={{ padding: 8 }}>
        <Tabs
          items={[
            {
              key: 'dispute',
              label: 'dispute',
              children: (
                <Form layout="vertical" onFinish={onExport}>
                  <Form.Item name="owner" label="你的地址(owner)" rules={[{ required: true }]}>
                    <Input placeholder="5F..." size="large" />
                  </Form.Item>
                  <Form.Item name="nonce" label="nonce(重放保护)" initialValue={0}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="valid_till" label="validTill(过期高度)" initialValue={0}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="domain" label="domain(u8)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="id" label="业务ID(u64)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="evidence" label="证据(CID,逗号分隔)">
                    <Input placeholder="cid1,cid2" size="large" />
                  </Form.Item>
                  <Form.Item name="method" initialValue="dispute" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button type="primary" htmlType="submit" block size="large">生成代付 JSON</Button>
                      <Button onClick={onSubmitSponsor} block size="large">一键提交平台代付</Button>
                      <Button onClick={() => (document.querySelector('#dispute-form-submit') as HTMLButtonElement)?.click()} block size="large" disabled>直接上链(非代付)</Button>
                    </Space>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'arbitrate',
              label: 'arbitrate',
              children: (
                <Form layout="vertical" onFinish={onExport}>
                  <Form.Item name="owner" label="你的地址(owner)" rules={[{ required: true }]}>
                    <Input placeholder="5F..." size="large" />
                  </Form.Item>
                  <Form.Item name="nonce" label="nonce(重放保护)" initialValue={0}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="valid_till" label="validTill(过期高度)" initialValue={0}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="domain" label="domain(u8)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="id" label="业务ID(u64)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="decision_code" label="决策(0放行/1退款/2部分)" rules={[{ required: true }]}>
                    <InputNumber min={0} max={2} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="bps" label="bps(可选)">
                    <InputNumber min={0} max={10_000} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="method" initialValue="arbitrate" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button type="primary" htmlType="submit" block size="large">生成代付 JSON</Button>
                      <Button onClick={onSubmitSponsor} block size="large">一键提交平台代付</Button>
                      <Button onClick={() => (document.querySelector('#arbitrate-form-submit') as HTMLButtonElement)?.click()} block size="large" disabled>直接上链(非代付)</Button>
                    </Space>
                  </Form.Item>
                </Form>
              )
            }
          ]}
        />

        {/* 输出区 */}
        <Input.TextArea rows={10} value={output} readOnly style={{ fontFamily: 'monospace' }} />
      </div>
    </div>
  )
}

export default ArbitrationPage


