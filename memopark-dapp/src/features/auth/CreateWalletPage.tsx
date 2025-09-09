import React, { useState } from 'react'
import { Card, Typography, Input, Button, Switch, Checkbox, Space, Alert } from 'antd'
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { generateLocalWallet, encryptWithPassword, saveLocalKeystore, exportKeystoreJson, importKeystoreJson, upsertKeystore, setCurrentAddress } from '../../lib/keystore'

/**
 * 函数级详细中文注释：创建钱包页面
 * - 显示“口令信息（助记词）”与密码输入
 * - 支持“面容/指纹登录”开关（占位逻辑，可后续接入 WebAuthn）
 * - 勾选条款后可创建，创建时本地加密助记词并保存到 localStorage
 */
const CreateWalletPage: React.FC<{ onCreated?: (address: string) => void }> = ({ onCreated }) => {
  const [mnemonic, setMnemonic] = useState<string>('')
  const [derivedAddress, setDerivedAddress] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [biometric, setBiometric] = useState<boolean>(true)
  const [agree, setAgree] = useState<boolean>(true)
  const [creating, setCreating] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const handleGenerate = async () => {
    try {
      setError('')
      const w = await generateLocalWallet()
      setMnemonic(w.mnemonic)
      setDerivedAddress(w.address)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCreate = async () => {
    try {
      setCreating(true)
      setError('')
      if (!mnemonic) throw new Error('请先生成口令信息（助记词）')
      if (!password || password.length < 8) throw new Error('密码至少 8 位')

      const enc = await encryptWithPassword(password, mnemonic)
      const payload = { address: derivedAddress || 'pending', ...enc, createdAt: Date.now() }
      saveLocalKeystore(payload)
      upsertKeystore(payload)
      if (derivedAddress) setCurrentAddress(derivedAddress)
      // UI 友好提示
      alert('本地钱包已创建并加密保存。请妥善备份助记词！')
      if (derivedAddress) {
        onCreated?.(derivedAddress)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <Card>
        <Typography.Title level={4} style={{ marginBottom: 16 }}>创建新钱包</Typography.Title>
        {error && (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />
        )}
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Typography.Text strong>口令信息</Typography.Text>
            <Input.Password
              placeholder="点击右侧图标生成口令信息"
              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              value={mnemonic}
              readOnly
              onClick={handleGenerate}
            />
            <div style={{ marginTop: 8 }}>
              <Button size="small" onClick={handleGenerate}>生成助记词</Button>
            </div>
          </div>

          {derivedAddress && (
            <Alert type="success" showIcon message={`地址：${derivedAddress}`} />
          )}

          <div>
            <Typography.Text strong>密码</Typography.Text>
            <Input.Password
              placeholder="至少 8 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <Space>
              <Typography.Text strong>使用面容/指纹登录？</Typography.Text>
              <Switch checked={biometric} onChange={setBiometric} />
            </Space>
          </div>

          <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)}>
            我同意 加密货币钱包 条款和条件
          </Checkbox>

          <Button type="primary" block size="large" onClick={handleCreate} disabled={!agree || !mnemonic || password.length < 8} loading={creating}>
            创建
          </Button>
          {derivedAddress && (
            <Button block size="large" onClick={() => onCreated?.(derivedAddress)}>
              去登录
            </Button>
          )}
          <div>
            <Space>
              <Button onClick={() => {
                if (!exportKeystoreJson()) setError('未发现本地 keystore，无法导出')
              }}>导出JSON</Button>
              <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e)=>{
                const f = e.target.files?.[0]
                if (f) {
                  const ok = await importKeystoreJson(f)
                  if (!ok) setError('导入失败：文件格式不正确')
                }
                e.currentTarget.value = ''
              }} />
              <Button onClick={()=> fileInputRef.current?.click()}>导入JSON</Button>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default CreateWalletPage


