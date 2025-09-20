import React from 'react'
import { Card, Form, Input, InputNumber, Button, Alert, Statistic, Space } from 'antd'
import { fetchContentGovConsts, submitAppeal } from './lib/governance'

/**
 * 函数级详细中文注释：申诉提交页面
 * - 表单字段：domain、action、target、reasonCid、evidenceCid
 * - 显示链上常量：押金、公示期、罚没比例、限频
 * - 提交后返回交易占位哈希（或真实哈希），供用户记录
 */
const SubmitAppealPage: React.FC = () => {
  const [loading, setLoading] = React.useState(false)
  const [txHash, setTxHash] = React.useState<string | null>(null)
  const [consts, setConsts] = React.useState<{ appealDeposit: string; rejectedSlashBps: number; withdrawSlashBps: number; windowBlocks: number; maxPerWindow: number; noticeDefaultBlocks: number } | null>(null)
  React.useEffect(() => { fetchContentGovConsts().then(setConsts).catch(()=>setConsts(null)) }, [])

  const onFinish = async (vals: any) => {
    setLoading(true)
    try {
      const h = await submitAppeal(Number(vals.domain), Number(vals.target), Number(vals.action), String(vals.reasonCid||''), String(vals.evidenceCid||''))
      setTxHash(h)
    } catch (e:any) {
      setTxHash(`提交失败: ${e?.message||e}`)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <h3>提交内容申诉</h3>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {consts && (
          <Card>
            <Space size="large" wrap>
              <Statistic title="申诉押金 (Planck)" value={consts.appealDeposit} />
              <Statistic title="驳回罚没 (bps)" value={consts.rejectedSlashBps} />
              <Statistic title="撤回罚没 (bps)" value={consts.withdrawSlashBps} />
              <Statistic title="默认公示期(块)" value={consts.noticeDefaultBlocks} />
              <Statistic title="限频窗口(块)" value={consts.windowBlocks} />
              <Statistic title="窗口最大次数" value={consts.maxPerWindow} />
            </Space>
          </Card>
        )}
        <Card>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item label="域(domain)" name="domain" rules={[{ required: true, message: '请输入域编码' }]}>
              <InputNumber style={{ width: '100%' }} placeholder="例如 1=墓地 2=逝者 3=文本 4=媒体 5=园区 6=供奉" />
            </Form.Item>
            <Form.Item label="动作(action)" name="action" rules={[{ required: true, message: '请输入动作编码' }]}>
              <InputNumber style={{ width: '100%' }} placeholder="例如 (1,11)=转让墓地 等" />
            </Form.Item>
            <Form.Item label="目标ID(target)" name="target" rules={[{ required: true, message: '请输入目标ID' }]}>
              <InputNumber style={{ width: '100%' }} placeholder="对象ID（如墓地/逝者/文本/媒体的数值ID）" />
            </Form.Item>
            <Form.Item label="理由CID (reason_cid)" name="reasonCid" rules={[{ required: true, message: '请输入理由CID' }]}>
              <Input placeholder="IPFS CID（明文，不加密）" />
            </Form.Item>
            <Form.Item label="证据CID (evidence_cid)" name="evidenceCid" rules={[{ required: true, message: '请输入证据CID' }]}>
              <Input placeholder="IPFS CID（明文，不加密）" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>提交申诉</Button>
            </Form.Item>
          </Form>
          {txHash && <Alert type="info" showIcon message="提交结果" description={txHash} />}
        </Card>
      </Space>
    </div>
  )
}

export default SubmitAppealPage
