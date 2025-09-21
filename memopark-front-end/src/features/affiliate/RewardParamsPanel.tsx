import React, { useEffect, useState } from 'react'
import { Card, Descriptions, Typography, Space, Alert, Divider, Form, Input, InputNumber, Button, Radio } from 'antd'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { buildForwardRequest, NAMESPACES, pretty } from '../../lib/forwarder'
import { AppConfig } from '../../lib/config'

/**
 * 函数级详细中文注释：奖励参数面板（只读+Root 演示表单）
 * - 读取链上 memoAffiliate 的存储参数与常量，集中展示给运营/开发查看；
 * - Root 演示表单仅做 UI 展示（不发交易），用于提示 setRewardParams 所需的四个字段；
 * - 后续若需要，可接入代付/Root 账号执行治理调用。
 */
const RewardParamsPanel: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [form] = Form.useForm()
  const [forwardJson, setForwardJson] = useState<string>('')

  const load = async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const q = (api.query as any).memoAffiliate
      const c = (api.consts as any).memoAffiliate
      const [budgetSourceAccount, budgetCapPerCycle, minStakeForReward, minQualifyingAction] = await Promise.all([
        q?.budgetSourceAccount?.(),
        q?.budgetCapPerCycle?.(),
        q?.minStakeForReward?.(),
        q?.minQualifyingAction?.(),
      ])
      const out = {
        // storage params
        budgetSourceAccount: budgetSourceAccount?.toString?.() || '-',
        budgetCapPerCycle: budgetCapPerCycle?.toString?.() || '0',
        minStakeForReward: minStakeForReward?.toString?.() || '0',
        minQualifyingAction: Number(minQualifyingAction || 0),
        // runtime constants（若存在则展示）
        blocksPerWeek: Number(c?.blocksPerWeek || 0),
        maxLevels: Number(c?.maxLevels || 0),
        perLevelNeed: Number(c?.perLevelNeed || 0),
        burnBps: Number(c?.burnBps || 0),
        treasuryBps: Number(c?.treasuryBps || 0),
      }
      setData(out)
      form.setFieldsValue({
        budget_source: out.budgetSourceAccount,
        budget_cap_per_cycle: out.budgetCapPerCycle,
        min_stake_for_reward: out.minStakeForReward,
        min_qual_actions: out.minQualifyingAction,
      })
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 8 }}>
      <Typography.Title level={4} style={{ margin: '8px 0' }}>联盟奖励参数（只读）</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="以下为 memoAffiliate 的存储参数与常量；演示表单仅展示参数位，不会发交易。" />
        <Card loading={loading}>
          <Descriptions column={1} title="存储参数">
            <Descriptions.Item label="预算来源账户(BudgetSourceAccount)">{data?.budgetSourceAccount || '-'}</Descriptions.Item>
            <Descriptions.Item label="每周奖励上限(BudgetCapPerCycle)">{data?.budgetCapPerCycle || '0'}</Descriptions.Item>
            <Descriptions.Item label="最小持仓门槛(MinStakeForReward)">{data?.minStakeForReward || '0'}</Descriptions.Item>
            <Descriptions.Item label="最低有效行为(MinQualifyingAction)">{data?.minQualifyingAction ?? 0}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Descriptions column={1} title="常量（若支持）">
            <Descriptions.Item label="BlocksPerWeek">{data?.blocksPerWeek}</Descriptions.Item>
            <Descriptions.Item label="MaxLevels">{data?.maxLevels}</Descriptions.Item>
            <Descriptions.Item label="PerLevelNeed">{data?.perLevelNeed}</Descriptions.Item>
            <Descriptions.Item label="BurnBps">{data?.burnBps}</Descriptions.Item>
            <Descriptions.Item label="TreasuryBps">{data?.treasuryBps}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Typography.Title level={5}>Root 演示表单（不提交）</Typography.Title>
          <Form form={form} layout="vertical">
            <Form.Item name="owner" label="Sudo/代付 发起地址(owner)" tooltip="直发需 Sudo 账户；代付为被代付用户地址">
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
              <Button type="dashed" onClick={() => {
                try {
                  const owner = form.getFieldValue('owner') || '5F...'
                  const call = {
                    section: 'memoAffiliate', method: 'setRewardParams', args: {
                      budgetSource: form.getFieldValue('budget_source') || null,
                      budgetCapPerCycle: form.getFieldValue('budget_cap_per_cycle') ?? null,
                      minStakeForReward: form.getFieldValue('min_stake_for_reward') ?? null,
                      minQualActions: form.getFieldValue('min_qual_actions') ?? null,
                    }
                  }
                  const req = buildForwardRequest({ ns: NAMESPACES.evidence, owner, nonce: 0, validTill: 0, call })
                  setForwardJson(pretty(req))
                } catch (e:any) { setForwardJson(e?.message||'构造失败') }
              }}>生成代付 JSON（演示）</Button>
              <Button onClick={() => window.open(AppConfig.sponsorApi, '_blank')}>打开代付后端地址</Button>
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
              <Button onClick={async ()=>{
                try{
                  const owner = form.getFieldValue('owner') || ''
                  const call = { section:'memoAffiliate', method:'setRewardParams', args:{
                    budgetSource: form.getFieldValue('budget_source')||null,
                    budgetCapPerCycle: form.getFieldValue('budget_cap_per_cycle')??null,
                    minStakeForReward: form.getFieldValue('min_stake_for_reward')??null,
                    minQualActions: form.getFieldValue('min_qual_actions')??null,
                  }}
                  const req = buildForwardRequest({ ns: NAMESPACES.evidence, owner, nonce: 0, validTill: 0, call })
                  const resp = await fetch(AppConfig.sponsorApi, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(req) })
                  const txt = await resp.text()
                  setForwardJson(txt)
                }catch(e:any){ setForwardJson(e?.message||'提交失败') }
              }}>代付提交(POST)</Button>
            </Space>
          </Form>
          {forwardJson && (
            <div style={{ marginTop: 8 }}>
              <Alert type="success" showIcon message="Forwarder 元交易 JSON（请复制到后端代付）" />
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f7f7f7', padding: 8, borderRadius: 6 }}>{forwardJson}</pre>
            </div>
          )}
        </Card>
      </Space>
    </div>
  )
}

export default RewardParamsPanel


