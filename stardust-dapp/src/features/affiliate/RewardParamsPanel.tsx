import React, { useEffect, useState } from 'react'
import { Card, Descriptions, Typography, Space, Alert, Divider, Form, Input, InputNumber, Button, Radio } from 'antd'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：奖励参数面板（只读+Root 演示表单）
 * - 读取链上 memoAffiliate 的存储参数与常量，集中展示给运营/开发查看；
 * - Root 演示表单仅做 UI 展示（不发交易），用于提示 setRewardParams 所需的四个字段；
 * - 后续若需要，可接入 Root 账号执行治理调用。
 */
const RewardParamsPanel: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const affiliate = (api.query as any).memoAffiliate
      if (!affiliate) throw new Error('链上未启用 memoAffiliate')
      const rewardParams = affiliate.rewardParams ? await affiliate.rewardParams() : null
      const constants = (api as any).consts.memoAffiliate
      setData({
        rewardParams: rewardParams?.toHuman() || {},
        MaxHeirsByOperator: constants?.MaxHeirsByOperator?.toHuman(),
        PerLevelAddingMaxPool: constants?.PerLevelAddingMaxPool?.toHuman(),
        maxPoolDepth: constants?.MaxPoolDepth?.toHuman(),
        perLevelNeed: constants?.PerLevelNeed?.toHuman(),
        burnBps: constants?.BurnBps?.toHuman(),
        treasuryBps: constants?.TreasuryBps?.toHuman(),
      })
    } catch (e: any) {
      alert(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 12 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Card title="奖励参数（只读）" loading={loading}>
          <Alert type="info" showIcon message="展示链上 memoAffiliate 的奖励配置（Root 可调）与常量（编译时固定）" />
          <Divider />
          <Typography.Title level={5}>奖励参数（Runtime Storage）</Typography.Title>
          <pre style={{ background: '#f9f9f9', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(data?.rewardParams || {}, null, 2)}
          </pre>
          <Divider />
          <Typography.Title level={5}>常量（编译时）</Typography.Title>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="MaxHeirsByOperator">{data?.MaxHeirsByOperator}</Descriptions.Item>
            <Descriptions.Item label="PerLevelAddingMaxPool">{data?.PerLevelAddingMaxPool}</Descriptions.Item>
            <Descriptions.Item label="MaxPoolDepth">{data?.maxPoolDepth}</Descriptions.Item>
            <Descriptions.Item label="PerLevelNeed">{data?.perLevelNeed}</Descriptions.Item>
            <Descriptions.Item label="BurnBps">{data?.burnBps}</Descriptions.Item>
            <Descriptions.Item label="TreasuryBps">{data?.treasuryBps}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Typography.Title level={5}>Root 演示表单（不提交）</Typography.Title>
          <Form form={form} layout="vertical">
            <Form.Item name="owner" label="Sudo 发起地址(owner)" tooltip="需 Sudo 账户">
              <Input placeholder="5F..." />
            </Form.Item>
            <Form.Item name="budget_source" label="budget_source: Option<AccountId>">
              <Input placeholder="5F... 或留空(null)" />
            </Form.Item>
            <Form.Item name="budget_cap_per_cycle" label="budget_cap_per_cycle: Option<Balance>">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="min_stake_for_reward" label="min_stake_for_reward: Option<Balance>">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="min_qual_actions" label="min_qual_actions: Option<u32>">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Space>
              <Button onClick={load}>刷新</Button>
              <Button type="primary" onClick={async ()=>{
                try{
                  const api = await getApi()
                  const owner = form.getFieldValue('owner')?.trim()
                  if(!owner) throw new Error('请输入 Sudo 账户地址')
                  const call = (api.tx as any).memoAffiliate?.setRewardParams
                  if(!call) throw new Error('链上未找到 memoAffiliate.setRewardParams')
                  const tx = call(
                    form.getFieldValue('budget_source')||null,
                    form.getFieldValue('budget_cap_per_cycle')??null,
                    form.getFieldValue('min_stake_for_reward')??null,
                    form.getFieldValue('min_qual_actions')??null,
                  )
                  // 通过 sudo 提升为 Root 执行
                  const sudo = (api.tx as any).sudo?.sudo
                  if(!sudo) throw new Error('链上未启用 sudo')
                  const hash = await signAndSendLocalFromKeystore('sudo', 'sudo', [tx])
                  // hash 为 inBlock/finalized 区块哈希
                  // 简单回显
                  alert(`已提交：${hash}`)
                }catch(e:any){ alert(e?.message||'提交失败') }
              }}>直发 Root 提交</Button>
            </Space>
          </Form>
        </Card>
      </Space>
    </div>
  )
}

export default RewardParamsPanel

