import React, { useState } from 'react'
import { Button, Card, Form, Input, Typography } from 'antd'

/**
 * 函数级详细中文注释：DApp 登录注册页面（移动端）
 * - 两个主动作：创建新钱包（注册）/ 使用口令登录（已有账号）。
 * - 仅做前端占位与校验，后续可对接“托管私钥”网关：注册时请求创建托管账户并返回口令；登录时校验口令并返回会话 token。
 */
const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [form] = Form.useForm()

  /**
   * 函数级详细中文注释：提交处理（占位）
   * - 注册：采集昵称/手机号(可选)，生成随机助记词（此处不实现），展示“保存口令”提示。
   * - 登录：采集口令，调用后端校验换取会话。
   */
  const onFinish = async (values: any) => {
    if (mode === 'register') {
      // TODO: 对接后端创建托管账户
      alert('注册成功（占位）。请妥善保存生成的口令。')
    } else {
      // TODO: 对接后端登录
      alert('登录成功（占位）。')
    }
    console.log('auth submit:', mode, values)
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '16px 12px' }}>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <img src="https://picsum.photos/seed/wallet/240/180" style={{ width: 180, height: 135, objectFit: 'cover' }} />
        <Typography.Title level={3} style={{ marginTop: 16, color: '#16a34a' }}>钱包设置</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
          创建新的电子钱包或使用口令登录（如果已有账户）
        </Typography.Paragraph>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Button block type={mode === 'register' ? 'primary' : 'default'} size="large" onClick={() => setMode('register')}>创建一个新钱包</Button>
        <Button block type={mode === 'login' ? 'primary' : 'default'} size="large" onClick={() => setMode('login')}>使用口令登录</Button>
      </div>

      <Card style={{ marginTop: 16 }}>
        {mode === 'register' ? (
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
              <Input placeholder="用于展示的昵称" />
            </Form.Item>
            <Form.Item name="phone" label="手机号（可选）">
              <Input placeholder="便于找回与通知（可选）" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large">创建钱包（生成口令）</Button>
            </Form.Item>
          </Form>
        ) : (
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item name="passphrase" label="登录口令" rules={[{ required: true, message: '请输入口令' }]}>
              <Input.Password placeholder="请输入后端发放的登录口令" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large">登录</Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  )
}

export default AuthPage


