import React from 'react'
import { Form, Select, InputNumber, Button, Alert, message, Space, Divider, Card, Modal } from 'antd'
import { getApi } from '../../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../../lib/polkadot-safe'
import { getCurrentAddress } from '../../../lib/keystore'

/**
 * 函数级详细中文注释：创建委员会提案表单
 * - 支持批准/驳回做市商申请
 * - 自动计算提案参数（threshold、length）
 * - 调用 council.propose 提交提案
 */
interface CreateProposalFormProps {
  onSuccess?: () => void
}

export default function CreateProposalForm({ onSuccess }: CreateProposalFormProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)
  const [proposalType, setProposalType] = React.useState<'approve' | 'reject'>('approve')
  const [pendingApplications, setPendingApplications] = React.useState<any[]>([])
  const [loadingApps, setLoadingApps] = React.useState(false)

  /**
   * 函数级中文注释：加载待审申请列表
   */
  const loadPendingApplications = React.useCallback(async () => {
    setLoadingApps(true)
    try {
      const api = await getApi()
      if (!(api.query as any).marketMaker) {
        throw new Error('MarketMaker pallet 未注册')
      }

      const nextId = await (api.query as any).marketMaker.nextId()
      const maxId = Number(nextId.toString())
      
      const pending: any[] = []
      const startId = Math.max(0, maxId - 100)
      
      for (let id = maxId - 1; id >= startId; id--) {
        const appOption = await (api.query as any).marketMaker.applications(id)
        if (appOption.isSome) {
          const app = appOption.unwrap()
          const appData = app.toJSON()
          
          // 检查是否为待审状态
          if (
            appData.status === 'PendingReview' || 
            appData.status === 1 ||
            (typeof appData.status === 'object' && 'PendingReview' in appData.status)
          ) {
            pending.push({
              mm_id: id,
              ...appData
            })
          }
        }
        
        if (pending.length >= 20) break
      }
      
      setPendingApplications(pending)
    } catch (e: any) {
      console.error('加载待审申请失败:', e)
      message.error('加载待审申请失败：' + (e?.message || ''))
    } finally {
      setLoadingApps(false)
    }
  }, [])

  React.useEffect(() => {
    loadPendingApplications()
  }, [loadPendingApplications])

  /**
   * 函数级中文注释：提交提案
   * - 提交前检查提案是否已存在，避免 DuplicateProposal 错误
   */
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)
      
      const api = await getApi()
      const { mmId, slashBps, threshold } = values
      
      // 构造内部调用
      let innerCall
      if (proposalType === 'approve') {
        innerCall = api.tx.marketMaker.approve(mmId)
      } else {
        innerCall = api.tx.marketMaker.reject(mmId, slashBps || 0)
      }
      
      // 计算提案哈希
      const proposalHash = innerCall.method.hash.toHex()
      
      // 检查提案是否已存在
      const existingProposal = await api.query.council.proposalOf(proposalHash)
      if (existingProposal.isSome) {
        setLoading(false)
        message.error({
          content: `该提案已存在！提案哈希: ${proposalHash.slice(0, 10)}...`,
          duration: 5
        })
        
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
                    <p>针对做市商 #{mmId} 的{proposalType === 'approve' ? '批准' : '驳回'}提案已存在。</p>
                    <p style={{ marginTop: 8 }}><strong>提案哈希:</strong></p>
                    <code style={{ wordBreak: 'break-all' }}>{proposalHash}</code>
                    <p style={{ marginTop: 12, color: '#666' }}>
                      请前往"提案列表"查看并投票，无需重复提交。
                    </p>
                  </div>
                }
                style={{ marginTop: 12 }}
              />
            </div>
          )
        })
        return
      }
      
      const proposalLength = innerCall.length
      
      console.log('[提案] 类型:', proposalType)
      console.log('[提案] mmId:', mmId)
      console.log('[提案] threshold:', threshold)
      console.log('[提案] length:', proposalLength)
      console.log('[提案] hash:', proposalHash)
      
      // 提交提案
      message.loading({ content: '正在提交提案...', key: 'proposal', duration: 0 })
      
      const hash = await signAndSendLocalFromKeystore(
        'council',
        'propose',
        [threshold, innerCall, proposalLength]
      )
      
      console.log('[提案] 交易哈希:', hash)
      
      message.success({
        content: '提案已提交！等待其他成员投票',
        key: 'proposal',
        duration: 3
      })
      
      // 计算提案哈希（用于后续投票）
      const proposalHash = innerCall.method.hash.toHex()
      
      // 显示提案信息
      Modal.info({
        title: '提案已提交',
        width: 600,
        content: (
          <div>
            <Alert
              type="success"
              showIcon
              message="提案信息"
              description={
                <div style={{ fontSize: 12 }}>
                  <p><strong>提案哈希:</strong></p>
                  <code style={{ wordBreak: 'break-all' }}>{proposalHash}</code>
                  <p style={{ marginTop: 8 }}><strong>类型:</strong> {proposalType === 'approve' ? '批准' : '驳回'}</p>
                  <p><strong>申请编号:</strong> #{mmId}</p>
                  <p><strong>阈值:</strong> {threshold} 票</p>
                  <p style={{ marginTop: 12, color: '#666' }}>
                    请将提案哈希分享给其他委员会成员进行投票。
                  </p>
                </div>
              }
              style={{ marginTop: 12 }}
            />
          </div>
        )
      })
      
      form.resetFields()
      onSuccess?.()
      
    } catch (e: any) {
      console.error('[提案] 失败:', e)
      
      // 改进错误提示
      let errorMsg = e?.message || ''
      if (errorMsg.includes('DuplicateProposal')) {
        errorMsg = '提案已存在，请勿重复提交。前往"提案列表"查看现有提案。'
      } else if (errorMsg.includes('BadOrigin')) {
        errorMsg = '权限不足，您不是委员会成员。'
      } else if (errorMsg.includes('TooManyProposals')) {
        errorMsg = '提案数量已达上限，请等待现有提案执行完毕。'
      }
      
      message.error({
        content: '提交失败：' + errorMsg,
        key: 'proposal',
        duration: 5
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Alert
        type="warning"
        showIcon
        message="仅限委员会成员"
        description="提交提案需要您是委员会成员。非委员会成员提交会失败（BadOrigin）。"
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          threshold: 2,
          proposalType: 'approve'
        }}
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
          extra={loadingApps ? '加载中...' : `共 ${pendingApplications.length} 个待审申请`}
        >
          <Select
            placeholder="选择待审申请"
            loading={loadingApps}
            showSearch
            optionFilterProp="label"
          >
            {pendingApplications.map(app => (
              <Select.Option key={app.mm_id} value={app.mm_id} label={`#${app.mm_id}`}>
                <div>
                  <div><strong>#{app.mm_id}</strong></div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    申请人: {String(app.owner).slice(0, 10)}...
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
          >
            提交提案
          </Button>
          
          <Button
            onClick={() => loadPendingApplications()}
            loading={loadingApps}
            block
          >
            刷新申请列表
          </Button>
        </Space>
      </Form>
    </div>
  )
}
