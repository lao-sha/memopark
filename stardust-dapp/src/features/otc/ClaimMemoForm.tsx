import React, { useState } from 'react'
import { Button, Card, Form, Input, Typography, message, Select, Alert, Space } from 'antd'
import { GiftOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { authorizeClaim } from '../../lib/otc-adapter'
import { getApi, signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { providerRegistry } from '../../lib/providers'

/**
 * 函数级详细中文注释：首购领取表单组件（支持多提供方选择）
 * 原名: OTC 领取，2025-10-20更名为首购领取以更准确反映业务场景
 * 
 * 🚧 状态：功能升级中（2025-10-29）
 * 原因：链端架构整合（Phase 2），pallet-trading 尚未实现免费首购功能
 * TODO: 等待链端实现 create_first_purchase 接口后恢复
 */
export default function ClaimMemoForm() {
  const [loading, setLoading] = useState(false)
  const [auth, setAuth] = useState<any>(null)
  const [providerId, setProviderId] = useState<string | undefined>(providerRegistry[0]?.id)
  const [form] = Form.useForm()

  // URL 预填：支持从 #/otc/claim?orderId=..&provider=.. 预填
  React.useEffect(() => {
    try {
      const q = new URLSearchParams((location.hash.split('?')[1] || ''))
      const orderId = q.get('orderId') || ''
      const provider = q.get('provider') || ''
      if (orderId) form.setFieldsValue({ orderId })
      if (provider) setProviderId(provider)
    } catch {}
  }, [])

  const onGetAuth = async (values: any) => {
    try {
      setLoading(true)
      const a = await authorizeClaim(values.orderId, values.beneficiary, providerId)
      setAuth(a)
      message.success('已获取领取授权，请继续提交链上交易')
    } catch (e: any) {
      message.error(e?.message || '获取授权失败')
    } finally { setLoading(false) }
  }

  const onClaim = async (values: any) => {
    if (!auth) return message.warning('请先获取授权')
    try {
      setLoading(true)
      await getApi() // 仅确保连接
      const args = [
        auth.issuer_account,
        auth.order_id,
        values.beneficiary,
        auth.amount_memo,
        auth.deadline_block,
        auth.nonce,
        auth.signature,
      ]
      const hash = await signAndSendLocalWithPassword('FirstPurchase', 'claim', args, values.password)  // 原名: OtcClaim
      message.success('领取提交成功，Tx: ' + hash)
    } catch (e: any) {
      message.error(e?.message || '领取提交失败')
    } finally { setLoading(false) }
  }

  return (
    <Card 
      style={{ 
        maxWidth: 640, 
        margin: '0 auto',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题区域 */}
        <div>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            <GiftOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            首购领取 DUST
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
            首次购买或法币入金时使用
          </Typography.Text>
        </div>

        {/* 🚧 功能升级提示 */}
        <Alert
          type="warning"
          icon={<InfoCircleOutlined />}
          message="⚠️ 功能升级中"
          description={
            <div style={{ fontSize: '13px' }}>
              <p style={{ marginBottom: 4 }}>
                <strong>首购免费领取功能正在进行架构升级（Phase 2）</strong>
              </p>
              <p style={{ marginBottom: 4 }}>
                升级原因：链端架构整合，pallet-trading 尚未实现免费首购功能
              </p>
              <p style={{ marginBottom: 0 }}>
                预计上线：请联系技术团队确认具体时间
              </p>
            </div>
          }
          showIcon
          closable
          style={{ marginBottom: 0 }}
        />

        {/* 使用场景说明 */}
        <Alert
          type="info"
          icon={<InfoCircleOutlined />}
          message="使用场景"
          description={
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: '13px' }}>
              <li>✅ 新用户首次购买DUST</li>
              <li>✅ 老用户法币入金（微信/支付宝/银行转账）</li>
              <li>💡 如需出金卖出MEMO，请前往 <a href="#/otc/order">OTC订单</a> 创建卖单</li>
            </ul>
          }
          style={{ marginBottom: 0 }}
        />

        {/* 步骤说明 */}
        <Card 
          size="small" 
          style={{ 
            background: '#fafafa',
            border: '1px solid #e8e8e8'
          }}
        >
          <Space direction="vertical" size={4}>
            <Typography.Text strong style={{ fontSize: '13px' }}>
              领取步骤：
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              1️⃣ 选择做市商并输入订单号
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              2️⃣ 点击"获取授权"验证订单
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              3️⃣ 输入钱包密码并提交链上交易
            </Typography.Text>
          </Space>
        </Card>

        {/* 表单区域 */}
        <Form form={form} layout="vertical" onFinish={onGetAuth}>
        <Form.Item name="provider" label="做市商" initialValue={providerId}>
          <Select onChange={setProviderId} options={providerRegistry.map(p => ({ label: p.name, value: p.id }))} />
        </Form.Item>
        <Form.Item name="orderId" label="订单号" rules={[{ required: true }]}>
          <Input placeholder="输入订单号" allowClear />
        </Form.Item>
        <Form.Item name="beneficiary" label="收款地址" rules={[{ required: true }]}>
          <Input placeholder="Polkadot/Substrate 地址" allowClear />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading} 
            block
            style={{
              height: '48px',
              fontSize: '15px',
              fontWeight: 'bold',
              borderRadius: '8px'
            }}
          >
            {loading ? '获取中...' : '获取授权'}
          </Button>
        </Form.Item>
      </Form>

      {/* 授权成功提示 */}
      {auth && (
        <>
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            message="✅ 授权获取成功"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text style={{ fontSize: '12px' }}>
                  订单号: <Typography.Text code>{auth.order_id}</Typography.Text>
                </Typography.Text>
                <Typography.Text style={{ fontSize: '12px' }}>
                  领取金额: <Typography.Text strong>{auth.amount_memo} DUST</Typography.Text>
                </Typography.Text>
                <Typography.Text style={{ fontSize: '12px' }}>
                  截止区块: {auth.deadline_block}
                </Typography.Text>
              </Space>
            }
            style={{ marginBottom: 0 }}
          />

          <Form layout="vertical" onFinish={onClaim}>
            <Form.Item 
              name="password" 
              label="本地钱包密码" 
              rules={[{ required: true, min: 8 }]}
              style={{ marginBottom: 16 }}
            >
              <Input.Password 
                placeholder="至少 8 位" 
                style={{ height: '40px' }}
              />
            </Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading} 
              block
              style={{
                height: '48px',
                fontSize: '15px',
                fontWeight: 'bold',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
            >
              {loading ? '提交中...' : '🎉 提交链上领取'}
            </Button>
          </Form>
        </>
      )}
      </Space>
    </Card>
  )
}


