import { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Select,
  InputNumber,
  Button,
  Alert,
  Space,
  Divider,
  Modal,
  message,
  Descriptions
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { useCouncilMembers } from '@/hooks/useCouncilMembers'
import { signAndSend } from '@/services/wallet/signer'
import { createProposeTx } from '@/services/blockchain/council'
import { getPendingApplications, type Application } from '@/services/blockchain/marketMaker'
import { formatAddress } from '@/utils/format'

/**
 * 创建提案页面
 * 参考：Polkadot.js Apps packages/page-council/src/Overview/Propose.tsx
 */
export default function CreateProposal() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const { isCurrentMember } = useCouncilMembers()

  const [loading, setLoading] = useState(false)
  const [proposalType, setProposalType] = useState<'approve' | 'reject'>('approve')
  const [pendingApplications, setPendingApplications] = useState<Application[]>([])
  const [loadingApps, setLoadingApps] = useState(false)

  /**
   * 加载待审申请列表
   */
  useEffect(() => {
    if (!isReady || !api) return

    const loadApps = async () => {
      setLoadingApps(true)
      try {
        const apps = await getPendingApplications(api)
        setPendingApplications(apps)
      } catch (e: any) {
        console.error('加载申请失败:', e)
        message.error('加载申请失败：' + (e?.message || ''))
      } finally {
        setLoadingApps(false)
      }
    }

    loadApps()
  }, [api, isReady])

  /**
   * 提交提案
   */
  const handleSubmit = async (values: any) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (!isCurrentMember) {
      message.error('您不是委员会成员，无权提交提案')
      return
    }

    try {
      setLoading(true)

      const { mmId, slashBps, threshold } = values

      // 构造内部调用
      let innerCall
      if (proposalType === 'approve') {
        innerCall = (api.tx as any).marketMaker.approve(mmId)
      } else {
        innerCall = (api.tx as any).marketMaker.reject(mmId, slashBps || 0)
      }

      // 计算提案哈希
      const proposalHash = innerCall.method.hash.toHex()
      console.log('[提案] 类型:', proposalType)
      console.log('[提案] mmId:', mmId)
      console.log('[提案] 阈值:', threshold)
      console.log('[提案] 哈希:', proposalHash)

      // 检查提案是否已存在
      const existingProposal: any = await api.query.council.proposalOf(proposalHash)
      if (existingProposal.isSome) {
        setLoading(false)
        Modal.warning({
          title: '提案已存在',
          width: 600,
          content: (
            <div>
              <Alert
                type="warning"
                showIcon
                message="重复提案"
                description={
                  <div style={{ fontSize: 12 }}>
                    <p>
                      针对做市商 #{mmId} 的
                      {proposalType === 'approve' ? '批准' : '驳回'}提案已存在。
                    </p>
                    <p style={{ marginTop: 8 }}>
                      <strong>提案哈希:</strong>
                    </p>
                    <code style={{ wordBreak: 'break-all' }}>{proposalHash}</code>
                    <p style={{ marginTop: 12, color: '#666' }}>
                      请前往"提案列表"查看并投票，无需重复提交。
                    </p>
                  </div>
                }
              />
            </div>
          )
        })
        return
      }

      const proposalLength = innerCall.length

      // 创建提案交易
      const tx = createProposeTx(api, threshold, innerCall, proposalLength)

      message.loading({ content: '正在提交提案...', key: 'propose', duration: 0 })

      await signAndSend(activeAccount, tx, {
        onSuccess: () => {
          message.success({
            content: '提案已提交！等待其他成员投票',
            key: 'propose',
            duration: 3
          })

          // 显示提案信息
          Modal.success({
            title: '提案已提交',
            width: 600,
            content: (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="提案哈希">
                  <code style={{ wordBreak: 'break-all' }}>{proposalHash}</code>
                </Descriptions.Item>
                <Descriptions.Item label="类型">
                  {proposalType === 'approve' ? '批准' : '驳回'}
                </Descriptions.Item>
                <Descriptions.Item label="申请编号">#{mmId}</Descriptions.Item>
                <Descriptions.Item label="投票阈值">{threshold} 票</Descriptions.Item>
              </Descriptions>
            ),
            onOk: () => navigate('/proposals')
          })

          form.resetFields()
        },
        onError: (error) => {
          message.error({
            content: '提交失败：' + error.message,
            key: 'propose',
            duration: 5
          })
        }
      })
    } catch (e: any) {
      console.error('[提案] 失败:', e)
      message.error({
        content: '提交失败：' + (e?.message || ''),
        key: 'propose',
        duration: 5
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="创建提案">
      {!isCurrentMember && (
        <Alert
          message="权限不足"
          description="只有委员会成员才能提交提案。"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!activeAccount && (
        <Alert
          message="请先连接钱包"
          description="您需要连接钱包才能提交提案。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          threshold: 2,
          proposalType: 'approve'
        }}
        disabled={!isCurrentMember || !activeAccount}
      >
        <Form.Item
          label="提案类型"
          name="proposalType"
          rules={[{ required: true, message: '请选择提案类型' }]}
        >
          <Select onChange={(val) => setProposalType(val as any)}>
            <Select.Option value="approve">批准做市商申请</Select.Option>
            <Select.Option value="reject">驳回做市商申请</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="申请编号"
          name="mmId"
          rules={[{ required: true, message: '请选择申请' }]}
          extra={
            loadingApps
              ? '加载中...'
              : `共 ${pendingApplications.length} 个待审申请`
          }
        >
          <Select
            placeholder="选择待审申请"
            loading={loadingApps}
            showSearch
            optionFilterProp="label"
          >
            {pendingApplications.map((app) => (
              <Select.Option key={app.mm_id} value={app.mm_id} label={`#${app.mm_id}`}>
                <div>
                  <div>
                    <strong>#{app.mm_id}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    申请人: {formatAddress(app.owner)}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    费率: {app.fee_bps} bps
                  </div>
                </div>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {proposalType === 'reject' && (
          <Form.Item
            label="扣罚比例 (bps)"
            name="slashBps"
            rules={[
              { required: true, message: '请输入扣罚比例' },
              { type: 'number', min: 0, max: 10000, message: '范围：0-10000 bps' }
            ]}
            extra="100 bps = 1%，例如 1000 = 扣除 10% 押金"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={10000}
              step={100}
              placeholder="输入 0-10000"
            />
          </Form.Item>
        )}

        <Form.Item
          label="投票阈值"
          name="threshold"
          rules={[{ required: true, message: '请输入投票阈值' }]}
          extra="需要多少票才能通过（推荐：委员会总人数的 2/3）"
        >
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={100}
            placeholder="例如：2"
          />
        </Form.Item>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
            disabled={!isCurrentMember || !activeAccount}
          >
            提交提案
          </Button>

          <Button onClick={() => navigate('/proposals')} block>
            返回提案列表
          </Button>
        </Space>
      </Form>
    </Card>
  )
}
