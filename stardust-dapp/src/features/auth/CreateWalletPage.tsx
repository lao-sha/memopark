import React, { useState } from 'react'
import { Card, Typography, Input, Button, Switch, Checkbox, Space, Alert } from 'antd'
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { generateLocalWallet, encryptWithPassword, saveLocalKeystore, exportKeystoreJson, importKeystoreJson, upsertKeystore, setCurrentAddress } from '../../lib/keystore'
import BackupMnemonicPage from './BackupMnemonicPage'
import SetPasswordPage from './SetPasswordPage'
import WalletCreatedPage from './WalletCreatedPage'
import VerifyMnemonicPage from './VerifyMnemonicPage'

/**
 * 函数级详细中文注释：创建钱包页面（协调器）
 * - 分五步骤创建钱包：设置密码 → 创建成功 → 备份助记词 → 验证助记词 → 完成
 * - 第一步：SetPasswordPage - 设置加密密码
 * - 第二步：WalletCreatedPage - 显示创建成功
 * - 第三步：BackupMnemonicPage - 展示并备份助记词
 * - 第四步：VerifyMnemonicPage - 验证助记词（NEW）
 * - 第五步：保存钱包并跳转登录
 * - 管理整个创建流程的状态和步骤切换
 */
const CreateWalletPage: React.FC<{ onCreated?: (address: string) => void }> = ({ onCreated }) => {
  const [mnemonic, setMnemonic] = useState<string>('')
  const [derivedAddress, setDerivedAddress] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [creating, setCreating] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [currentStep, setCurrentStep] = useState<'password' | 'created' | 'backup' | 'verify'>('password')
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  /**
   * 函数级详细中文注释：生成助记词
   * - 调用 generateLocalWallet 生成助记词和地址
   * - 保存助记词和地址到状态
   * - 捕获并显示错误信息
   */
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

  /**
   * 函数级详细中文注释：处理密码设置完成
   * - 保存用户设置的密码
   * - 生成助记词和地址
   * - 进入创建成功页面
   */
  const handlePasswordSet = async (pwd: string) => {
    try {
      setCreating(true)
      setError('')
      setPassword(pwd)

      // 生成助记词
      const w = await generateLocalWallet()
      setMnemonic(w.mnemonic)
      setDerivedAddress(w.address)
      
      // 进入创建成功页面
      setCurrentStep('created')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  /**
   * 函数级详细中文注释：处理继续备份操作
   * - 从创建成功页面进入备份助记词页面
   */
  const handleContinueToBackup = () => {
    setCurrentStep('backup')
  }

  /**
   * 函数级详细中文注释：处理备份完成
   * - 从备份助记词页面进入验证助记词页面
   */
  const handleBackupComplete = () => {
    setCurrentStep('verify')
  }

  /**
   * 函数级详细中文注释：处理验证成功并保存钱包
   * - 用密码加密助记词
   * - 保存到本地 keystore
   * - 设置为当前地址
   * - 调用回调进入登录页面，或跳转到钱包管理页面
   */
  const handleVerifySuccess = async () => {
    try {
      setCreating(true)
      setError('')
      if (!mnemonic) throw new Error('助记词丢失，请重新创建')
      if (!password) throw new Error('密码丢失，请重新创建')

      const enc = await encryptWithPassword(password, mnemonic)
      const payload = { address: derivedAddress || 'pending', ...enc, createdAt: Date.now() }
      saveLocalKeystore(payload)
      upsertKeystore(payload)
      if (derivedAddress) setCurrentAddress(derivedAddress)

      if (derivedAddress) {
        if (onCreated) {
          onCreated(derivedAddress)
        } else {
          // 独立路由访问时，跳转到钱包管理页面
          window.location.hash = '#/wallet'
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  // 步骤1：设置密码页面
  if (currentStep === 'password') {
    return (
      <SetPasswordPage
        onPasswordSet={handlePasswordSet}
        onBack={() => {
          if (onCreated) {
            onCreated('')
          } else {
            // 独立路由访问时，返回钱包管理页面
            window.location.hash = '#/wallet'
          }
        }}
      />
    )
  }

  // 步骤2：创建成功页面
  if (currentStep === 'created' && derivedAddress) {
    return (
      <WalletCreatedPage
        onContinue={handleContinueToBackup}
        walletAddress={derivedAddress}
      />
    )
  }

  // 步骤3：备份助记词页面
  if (currentStep === 'backup' && mnemonic && derivedAddress) {
    return (
      <BackupMnemonicPage
        mnemonic={mnemonic}
        address={derivedAddress}
        onBackupComplete={handleBackupComplete}
        onBack={() => setCurrentStep('created')}
      />
    )
  }

  // 步骤4：验证助记词页面
  if (currentStep === 'verify' && mnemonic) {
    return (
      <VerifyMnemonicPage
        mnemonic={mnemonic}
        onVerifySuccess={handleVerifySuccess}
        onBack={() => setCurrentStep('backup')}
      />
    )
  }

  // 默认：显示错误页面（不应该到达这里）
  return (
    <div style={{ padding: 16, maxWidth: 414, margin: '0 auto' }}>
      <Card>
        <Alert type="error" showIcon message="页面加载异常，请刷新重试" />
      </Card>
    </div>
  )
}

export default CreateWalletPage


