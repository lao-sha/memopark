import React from 'react'
import { Alert, Button, Form, Input, InputNumber, Tabs, Typography, message, Space } from 'antd'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'
import { buildForwardRequest, NAMESPACES, pretty } from '../../lib/forwarder'
import { AppConfig } from '../../lib/config'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'

/**
 * 函数级详细中文注释：证据提交（支持代付元交易导出）
 * - 模式：
 *   1) 生成元交易 JSON（推荐）：复制给平台赞助者后端，由其代付执行；
 *   2) 直发（可选，未来支持）：前端自行调用 api.tx.evidence.* 直接上链。
 * - 字段：与 pallet-evidence::commit/commit_hash/link/link_by_ns/unlink/unlink_by_ns 映射。
 */
const SubmitEvidencePage: React.FC = () => {
  const wallet = useWallet()
  const [form] = Form.useForm()
  const [output, setOutput] = React.useState('')

  const onExport = async (values: any) => {
    try {
      const owner = values.owner?.trim()
      const ns = NAMESPACES.evidence
      const nonce = Number(values.nonce || 0)
      const validTill = Number(values.valid_till || 0)
      if (nonce < 0) throw new Error('nonce 必须为非负整数')
      if (validTill <= 0) throw new Error('validTill 应为未来区块高度，避免过期')
      const call = {
        section: 'evidence',
        method: values.method,
        args: {
          domain: values.domain,
          target_id: values.target_id,
          imgs: values.imgs ? String(values.imgs).split(',').map((x: string) => x.trim()) : [],
          vids: values.vids ? String(values.vids).split(',').map((x: string) => x.trim()) : [],
          docs: values.docs ? String(values.docs).split(',').map((x: string) => x.trim()) : [],
          memo: values.memo || null,
          ns: values.ns || null,
          subject_id: values.subject_id || null,
          id: values.id || null,
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
      const api = await getApi()
      const address = values.owner?.trim() || wallet.current
      if (!address) throw new Error('缺少地址(owner) 或未连接钱包')
      const method = values.method
      if (method === 'commit') {
        const args = [values.domain, values.target_id, [], [], [], values.memo || null]
        const txHash = await wallet.signAndSendLocal('evidence', 'commit', args)
        message.success(`已上链：${txHash}`)
      } else if (method === 'commitHash') {
        const args = [values.ns, values.subject_id, values.commit, values.memo || null]
        const txHash = await wallet.signAndSendLocal('evidence', 'commitHash', args)
        message.success(`已上链：${txHash}`)
      }
    } catch (e: any) {
      message.error(e?.message || '上链失败')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 88 }}>
      {/* 顶部标题栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>提交证据（代付）</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      <div style={{ padding: '8px 8px 0' }}>
        <Alert type="info" showIcon message="提交证据到链上，请连接钱包后直接发送交易" />
      </div>

      <div style={{ padding: 8 }}>
        <Tabs
          items={[
            {
              key: 'commit',
              label: 'commit',
              children: (
                <Form form={form} layout="vertical" onFinish={onDirectSend}>
                  <Form.Item name="domain" label="domain(u8)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="target_id" label="target_id(u64)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="imgs" label="imgs(CID,逗号分隔)" >
                    <Input placeholder="cid1,cid2" size="large" />
                  </Form.Item>
                  <Form.Item name="vids" label="vids(CID,逗号分隔)">
                    <Input placeholder="cid1,cid2" size="large" />
                  </Form.Item>
                  <Form.Item name="docs" label="docs(CID,逗号分隔)">
                    <Input placeholder="cid1,cid2" size="large" />
                  </Form.Item>
                  <Form.Item name="memo" label="memo(Bytes，可选)">
                    <Input placeholder="备注" size="large" />
                  </Form.Item>
                  <Form.Item name="method" initialValue="commit" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block size="large">提交证据上链</Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'commit_hash',
              label: 'commit_hash',
              children: (
                <Form layout="vertical" onFinish={(values) => {
                  values.method = 'commitHash'
                  onDirectSend(values)
                }}>
                  <Form.Item name="ns" label="命名空间([u8;8])" rules={[{ required: true }]}>
                    <Input placeholder="evid___ " size="large" />
                  </Form.Item>
                  <Form.Item name="subject_id" label="subject_id(u64)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                  <Form.Item name="commit" label="commit(H256 hex)" rules={[{ required: true }]}>
                    <Input placeholder="0x..." size="large" />
                  </Form.Item>
                  <Form.Item name="memo" label="memo(Bytes，可选)">
                    <Input placeholder="备注" size="large" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block size="large">提交证据上链</Button>
                  </Form.Item>
                </Form>
              )
            }
          ]}
        />
      </div>
    </div>
  )
}

export default SubmitEvidencePage


