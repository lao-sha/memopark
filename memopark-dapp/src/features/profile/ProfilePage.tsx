import React, { useEffect, useState } from 'react'
import { Card, Typography, Space, Button, Alert, Input, Form, message } from 'antd'
import { getCurrentAddress } from '../../lib/keystore'
import AccountsOverview from '../../components/wallet/AccountsOverview'
import DashboardPage from '../dashboard/DashboardPage'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：个人中心页
 * - 展示当前地址、账户概览与常用入口
 * - 新增“昵称设置”区块：读取/设置 pallet-identity 的 display 字段，支持本地预览与上链保存
 *   1) 读取：query identity.identityOf(current) → Registration.info.display（Data: Raw/...）
 *   2) 预览：输入框实时展示；
 *   3) 保存：tx identity.setIdentity({ display: { Raw: nickname } })；清空用 identity.clearIdentity()
 */
const ProfilePage: React.FC = () => {
  const [addr, setAddr] = useState<string | null>(getCurrentAddress())
  useEffect(() => { setAddr(getCurrentAddress()) }, [])

  // 昵称编辑状态
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [currentDisplay, setCurrentDisplay] = useState<string>('')
  // 推荐码状态
  const [refCode, setRefCode] = useState<string>('')
  const [codeLoading, setCodeLoading] = useState(false)

  // 读取当前昵称（pallet-identity）
  const refreshIdentity = async () => {
    if (!addr) { setCurrentDisplay(''); return }
    try {
      const api = await getApi()
      const raw = await (api.query as any).identity?.identityOf?.(addr)
      if (raw && raw.isSome) {
        const reg = raw.unwrap()
        // 兼容 Data 枚举：Raw/None 等；尽量转为字符串
        const disp = reg.info?.display
        let value = ''
        if (disp) {
          if (disp.isRaw) value = Buffer.from(disp.asRaw.toU8a()).toString('utf8')
          else if (disp.isNone) value = ''
          else if (disp.asBytes) value = Buffer.from(disp.asBytes.toU8a()).toString('utf8')
          else value = String(disp.toString?.() || '')
        }
        setCurrentDisplay(value)
        form.setFieldsValue({ nickname: value })
      } else {
        setCurrentDisplay('')
        form.setFieldsValue({ nickname: '' })
      }
    } catch (e: any) {
      console.warn(e)
    }
  }

  useEffect(() => { refreshIdentity() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr])

  // 读取推荐码（改为 memoReferrals.codeOf）
  const refreshCode = async () => {
    if (!addr) { setRefCode(''); return }
    try {
      setCodeLoading(true)
      const api = await getApi()
      const qroot: any = api.query as any
      const sec = qroot.memoReferrals || qroot.memo_referrals
      const raw = await sec.codeOf(addr)
      if (raw && raw.isSome) {
        const v = raw.unwrap()
        const code = Buffer.from(v.toU8a()).toString('utf8')
        setRefCode(code)
      } else setRefCode('')
    } catch (e:any) { console.warn(e); setRefCode('') } finally { setCodeLoading(false) }
  }

  useEffect(() => { refreshCode() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr])

  // ✅ 已移除 onClaimCode 函数：现在只有年费会员才能申请推荐码，购买会员后自动分配

  const copyShare = async () => {
    try {
      const link = `${window.location.origin}${window.location.pathname}#/ref?code=${refCode}`
      await navigator.clipboard.writeText(link)
      message.success('已复制分享链接')
    } catch { message.error('复制失败') }
  }

  // 保存昵称到链上（identity.setIdentity）
  const onSave = async (v: any) => {
    try {
      if (!addr) return message.warning('请先选择账户')
      const name = String(v.nickname || '').trim()
      if (!name) return message.warning('请输入昵称')
      setLoading(true)
      const args = [{ display: { Raw: name } }]
      const hash = await signAndSendLocalFromKeystore('identity', 'setIdentity', args)
      message.success(`已提交上链：${hash}`)
      setCurrentDisplay(name)
    } catch (e: any) {
      message.error(e?.message || '提交失败')
    } finally { setLoading(false) }
  }

  const onClear = async () => {
    try {
      if (!addr) return message.warning('请先选择账户')
      setLoading(true)
      const hash = await signAndSendLocalFromKeystore('identity', 'clearIdentity', [])
      message.success(`已提交清除：${hash}`)
      setCurrentDisplay('')
      form.setFieldsValue({ nickname: '' })
    } catch (e:any) { message.error(e?.message || '清除失败') } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 12 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, padding: '4px 0' }}>
            <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
          </div>
          <Typography.Title level={4} style={{ margin: 0 }}>个人中心</Typography.Title>
          {!addr && <Alert type="warning" showIcon message="尚未选择当前账户" />}
          {addr && <Typography.Text>当前地址：<Typography.Text code>{addr}</Typography.Text></Typography.Text>}
          <AccountsOverview />
          <Card size="small" title="昵称设置（pallet-identity.display）">
            <Form form={form} layout="vertical" onFinish={onSave}>
              <Form.Item label="当前昵称" style={{ marginBottom: 4 }}>
                <Typography.Text>{currentDisplay || '（未设置）'}</Typography.Text>
              </Form.Item>
              <Form.Item name="nickname" label="新昵称" rules={[{ required: true, message: '请输入昵称' }]}> 
                <Input placeholder="例如：小明" maxLength={64} />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
                <Button danger onClick={onClear} loading={loading}>清除昵称</Button>
                <Button onClick={refreshIdentity} loading={loading}>刷新</Button>
              </Space>
            </Form>
          </Card>
          <Card size="small" title="我的推荐码">
            {refCode
              ? (
                <Space>
                  <Typography.Text code>{refCode}</Typography.Text>
                  <Button onClick={copyShare}>复制分享链接</Button>
                  <Button onClick={refreshCode} loading={codeLoading}>刷新</Button>
                </Space>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert 
                    type="warning" 
                    showIcon 
                    message="✅ 只有年费会员才能申请推荐码" 
                    description="购买年费会员后，系统将自动为您分配推荐码。拥有推荐码后，您可以推荐他人购买会员并获得推荐奖励。"
                  />
                  <Button 
                    type="primary" 
                    onClick={() => {
                      // ✅ 跳转到会员购买页面
                      window.location.hash = '#/membership/purchase'
                    }}
                    block
                  >
                    立即购买会员
                  </Button>
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    💡 提示：购买会员后推荐码会自动生成，无需手动领取
                  </Typography.Text>
                </Space>
              )}
          </Card>
          <Card size="small" title="🏛️ 治理与管理">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Alert
                type="info"
                showIcon
                message="专业治理功能已迁移到 Web 平台"
                description="委员会提案、做市商审批、仲裁管理等专业功能请访问桌面端 Web 治理平台"
              />
              
              <Button
                type="primary"
                block
                size="large"
                onClick={() => {
                  window.open('https://governance.memopark.com', '_blank')
                }}
              >
                🖥️ 打开 Web 治理平台
              </Button>

              <Typography.Text strong style={{ marginTop: 8 }}>快捷入口：</Typography.Text>
              
              <Button
                block
                onClick={() => {
                  window.open('https://governance.memopark.com/content-governance', '_blank')
                }}
              >
                内容治理（审批申诉）
              </Button>
              
              <Button
                block
                onClick={() => {
                  window.open('https://governance.memopark.com/applications', '_blank')
                }}
              >
                做市商审批
              </Button>
              
              <Button
                block
                onClick={() => {
                  window.open('https://governance.memopark.com/committees', '_blank')
                }}
              >
                委员会管理
              </Button>
              
              <Button
                block
                onClick={() => {
                  window.open('https://governance.memopark.com/arbitration', '_blank')
                }}
              >
                仲裁管理
              </Button>

              <Button
                block
                onClick={() => {
                  window.location.hash = '#/gov/appeal'
                }}
              >
                快速提交申诉（移动端）
              </Button>
            </Space>
          </Card>

          <Card size="small" title="做市商与OTC交易" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Typography.Text type="secondary">做市商申请</Typography.Text>
              <Space wrap>
                <Button onClick={()=> { window.location.hash = '#/otc/mm-apply' }}>申请做市商</Button>
              </Space>
              <Typography.Text type="secondary" style={{ marginTop: 8 }}>OTC 交易</Typography.Text>
              <Space wrap>
                <Button type="primary" onClick={()=> { window.location.hash = '#/otc/order' }}>购买 MEMO</Button>
                <Button onClick={()=> { window.location.hash = '#/otc/listing' }}>我的挂单</Button>
                <Button onClick={()=> { window.location.hash = '#/otc/market' }}>交易市场</Button>
              </Space>
            </Space>
          </Card>
          <Card size="small" title="网络与业务数据面板">
            <DashboardPage />
          </Card>
          <Space wrap>
            <Button onClick={() => window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'transfer' } }))}>转账</Button>
            <Button type="primary" onClick={() => window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create-grave' } }))}>创建陵墓</Button>
            <Button onClick={()=> { window.location.hash = '#/grave/my' }}>我的墓地</Button>
            <Button onClick={()=> { window.location.hash = '#/treasury' }}>国库</Button>
            <Button onClick={()=> { window.location.hash = '#/covers' }}>封面库</Button>
            <Button onClick={()=> { window.location.hash = '#/covers/create' }}>创建封面图</Button>
            <Button onClick={()=> { window.location.hash = '#/sacrifice/create' }}>创建祭祀品</Button>
            <Button onClick={()=> { window.location.hash = '#/category/create' }}>创建类目</Button>
            <Button onClick={()=> { window.location.hash = '#/category/create-primary' }}>创建一级类目</Button>
            <Button onClick={()=> { window.location.hash = '#/category/list' }}>类目列表</Button>
            <Button onClick={()=> { window.location.hash = '#/scene/create' }}>创建场景</Button>
          </Space>
        </Space>
      </Card>
    </div>
  )
}

export default ProfilePage


