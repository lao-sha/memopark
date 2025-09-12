import React, { useEffect, useState } from 'react'
import { Card, Typography, Input, Button, Alert, Space } from 'antd'
import { decryptWithPassword, loadLocalKeystore } from '../../lib/keystore'
import { deriveAddressFromMnemonic } from '../../lib/keystore'
import { sessionManager } from '../../lib/sessionManager'
import { useWallet } from '../../providers/WalletProvider'
import { exportKeystoreJson, importKeystoreJson, loadAllKeystores, setCurrentAddress, getCurrentAddress, exportKeystoreJsonForAddress } from '../../lib/keystore'
import { encryptWithPassword, upsertKeystore } from '../../lib/keystore'
import { mnemonicValidate } from '@polkadot/util-crypto'
import { queryFreeBalance } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：登录页
 * - 本地钱包登录（助记词+密码，keystore 本地加密存储）
 * - 可选：检测浏览器扩展并给出引导（已默认隐藏）
 */
const LoginPage: React.FC<{ onSuccess?: (address: string) => void; onNavigateCreate?: () => void }> = ({ onSuccess, onNavigateCreate }) => {
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [address, setAddress] = useState<string>('')
  // 本地钱包模式：不使用浏览器扩展

  const { current } = useWallet(); void current

  // const mismatch = !!(address && current && current !== address)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [keystores, setKeystores] = useState<{ address: string; createdAt: number }[]>([])
  const [currentAddr, setCurrentAddr] = useState<string | null>(getCurrentAddress())
  const [balance, setBalance] = useState<string>('')
  // 助记词登录相关状态
  const [mnemonic, setMnemonic] = useState<string>('')
  const [newPwd, setNewPwd] = useState<string>('')
  const [confirmPwd, setConfirmPwd] = useState<string>('')

  useEffect(()=>{
    const list = loadAllKeystores().map(x=>({ address: x.address, createdAt: x.createdAt }))
    setKeystores(list)
    if (!currentAddr && list[0]?.address) {
      setCurrentAddress(list[0].address)
      setCurrentAddr(list[0].address)
    }
  },[])

  useEffect(()=>{
    ;(async()=>{
      try{
        const addr = currentAddr || address
        if (!addr) { setBalance(''); return }
        const b = await queryFreeBalance(addr)
        setBalance(`${b.formatted} ${b.symbol}`)
      }catch{ setBalance('') }
    })()
  },[currentAddr, address])

  const handleLogin = async () => {
    try {
      setError('')
      setLoading(true)

      const ks = loadLocalKeystore()
      if (!ks) throw new Error('未发现本地钱包，请先创建钱包')
      if (!password || password.length < 8) throw new Error('请输入至少 8 位密码')

      const mnemonic = await decryptWithPassword(password, ks)
      const addr = await deriveAddressFromMnemonic(mnemonic)
      setAddress(addr)

      // 本地钱包模式：不依赖浏览器扩展

      let session = await sessionManager.createSession(addr)
      if (!session) {
        const allowDev = (import.meta as any)?.env?.DEV || (import.meta as any)?.env?.VITE_ALLOW_DEV_SESSION === '1'
        if (allowDev) {
          try {
            session = sessionManager.forceCreateDevSession(addr)
          } catch (e) {
            // ignore and fallthrough to error
          }
        }
        if (!session) {
          const extra = allowDev ? '（已尝试开发回退仍失败）' : ''
          throw new Error('会话建立失败，请稍后重试' + extra)
        }
      }

      onSuccess?.(addr)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：使用“助记词 + 口令”登录（并导入本地 keystore）
   * - 校验助记词格式与口令长度（≥8）和一致性
   * - 通过助记词派生地址，使用口令加密助记词后保存到本地 keystore（多账户列表）
   * - 设置当前地址并创建会话
   */
  const handleMnemonicLogin = async () => {
    try {
      setError('')
      setLoading(true)
      const words = mnemonic.trim()
      if (!words || words.split(/\s+/).length < 12) throw new Error('请输入有效助记词（至少 12 个词）')
      if (!mnemonicValidate(words)) throw new Error('助记词校验失败，请确认无拼写错误')
      if (!newPwd || newPwd.length < 8) throw new Error('请输入至少 8 位口令')
      if (newPwd !== confirmPwd) throw new Error('两次输入的口令不一致')

      const addr = await deriveAddressFromMnemonic(words)
      const enc = await encryptWithPassword(newPwd, words)
      const entry = { address: addr, ciphertext: enc.ciphertext, salt: enc.salt, iv: enc.iv, createdAt: Date.now() }
      upsertKeystore(entry)
      setCurrentAddress(addr)
      setCurrentAddr(addr)
      setAddress(addr)

      let session = await sessionManager.createSession(addr)
      if (!session) {
        const allowDev = (import.meta as any)?.env?.DEV || (import.meta as any)?.env?.VITE_ALLOW_DEV_SESSION === '1'
        if (allowDev) {
          try { session = sessionManager.forceCreateDevSession(addr) } catch {}
        }
        if (!session) throw new Error('会话建立失败，请稍后重试')
      }
      onSuccess?.(addr)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：检测浏览器扩展与账户
   * - 调用 web3Enable 探测注入的扩展；统计账户数量
   * - 未检测到扩展：提示安装链接与重试
   * - 有扩展但无账户：提示在扩展创建/导入账户
   */
  // 不检测扩展

  // 首屏自动检测一次
  // 默认不自动检测扩展：聚焦本地钱包登录

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <Card>
  <Typography.Title level={4} style={{ marginBottom: 12 }}>登录钱包</Typography.Title>
        {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />}
        {(keystores.length > 0 || currentAddr) && (
          <Card size="small" style={{ marginBottom: 12 }} title="本地账户">
            <Space direction="vertical" style={{ width:'100%' }}>
              <div>
                <Typography.Text type="secondary">当前账户：</Typography.Text>
                <Typography.Text code style={{ marginLeft: 8 }}>{currentAddr || '-'}</Typography.Text>
                {balance && <Typography.Text style={{ marginLeft: 8 }}>余额：{balance}</Typography.Text>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {keystores.map((it)=> (
                  <Button key={it.address} size="small" type={currentAddr===it.address?'primary':'default'} onClick={()=>{ setCurrentAddress(it.address); setCurrentAddr(it.address); }}>
                    {it.address.slice(0,6)}…{it.address.slice(-4)}
                  </Button>
                ))}
              </div>
            </Space>
          </Card>
        )}
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Typography.Text strong>钱包密码</Typography.Text>
            <Input.Password
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {address && (
            <Alert type="success" showIcon message={`地址：${address}`} />
          )}

          <Button type="primary" block size="large" onClick={handleLogin} loading={loading}>
            登录
          </Button>

          <Card size="small" title="使用助记词 + 口令登录 / 导入" style={{ marginTop: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Typography.Text>助记词</Typography.Text>
                <Input.TextArea rows={3} placeholder="输入 12/24 词助记词" value={mnemonic} onChange={e=>setMnemonic(e.target.value)} />
              </div>
              <div>
                <Typography.Text>设置口令（用于本地加密）</Typography.Text>
                <Input.Password placeholder="至少 8 位" value={newPwd} onChange={e=>setNewPwd(e.target.value)} />
              </div>
              <div>
                <Typography.Text>确认口令</Typography.Text>
                <Input.Password placeholder="再次输入口令" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)} />
              </div>
              <Button type="primary" onClick={handleMnemonicLogin} loading={loading}>用助记词登录</Button>
            </Space>
          </Card>
          <div>
            <Space size={8}>
              <Typography.Text type="secondary">没有账户？</Typography.Text>
              <Button type="link" size="small" onClick={onNavigateCreate}>创建本地钱包</Button>
              <Button size="small" onClick={() => {
                const target = currentAddr || address
                if (target) { exportKeystoreJsonForAddress(target) }
                else if (!exportKeystoreJson()) setError('未发现本地 keystore，无法导出')
              }}>导出JSON</Button>
              <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e)=>{
                const f = e.target.files?.[0]
                if (f) {
                  const ok = await importKeystoreJson(f)
                  if (!ok) setError('导入失败：文件格式不正确')
                }
                e.currentTarget.value = ''
              }} />
              <Button size="small" onClick={()=> fileInputRef.current?.click()}>导入JSON</Button>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default LoginPage


