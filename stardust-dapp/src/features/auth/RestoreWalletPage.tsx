import React, { useState } from 'react';
import { Button, Typography, Input, Space, Alert } from 'antd';
import { LockOutlined, SafetyOutlined, KeyOutlined } from '@ant-design/icons';
import { deriveAddressFromMnemonic, encryptWithPassword, upsertKeystore, setCurrentAddress } from '../../lib/keystore';
import { sessionManager } from '../../lib/sessionManager';
import { mnemonicValidate } from '@polkadot/util-crypto';

const { Title, Text } = Typography;

/**
 * 函数级详细中文注释：恢复钱包页面组件
 * - 使用助记词恢复钱包（原登录页面的简化版）
 * - 输入 12/24 词助记词
 * - 设置本地加密密码
 * - 导入钱包并登录
 * - 移动端优先设计，最大宽度 640px 居中
 */
interface RestoreWalletPageProps {
  onSuccess?: (address: string) => void;
  onBack?: () => void;
}

const RestoreWalletPage: React.FC<RestoreWalletPageProps> = ({
  onSuccess,
  onBack
}) => {
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');

  /**
   * 函数级详细中文注释：处理助记词输入
   * - 更新助记词状态
   * - 清除错误信息
   */
  const handleMnemonicChange = (value: string) => {
    setMnemonic(value);
    setError('');
  };

  /**
   * 函数级详细中文注释：处理密码输入
   * - 更新密码状态
   * - 清除错误信息
   */
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError('');
  };

  /**
   * 函数级详细中文注释：处理确认密码输入
   * - 更新确认密码状态
   * - 清除错误信息
   */
  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setError('');
  };

  /**
   * 函数级详细中文注释：恢复钱包
   * - 验证助记词格式（12/24 词）
   * - 验证密码长度和一致性
   * - 通过助记词派生地址
   * - 加密并保存到本地 keystore
   * - 创建会话并登录
   */
  const handleRestore = async () => {
    try {
      setError('');
      setLoading(true);

      // 验证助记词
      const words = mnemonic.trim();
      if (!words) {
        throw new Error('请输入助记词');
      }

      const wordCount = words.split(/\s+/).length;
      if (wordCount < 12) {
        throw new Error('请输入有效助记词（至少 12 个词）');
      }

      if (!mnemonicValidate(words)) {
        throw new Error('助记词校验失败，请确认无拼写错误');
      }

      // 验证密码
      if (!password) {
        throw new Error('请输入密码');
      }

      if (password.length < 8) {
        throw new Error('密码至少需要 8 位字符');
      }

      if (password !== confirmPassword) {
        throw new Error('两次输入的密码不一致');
      }

      // 派生地址
      const addr = await deriveAddressFromMnemonic(words);
      setAddress(addr);

      // 加密并保存
      const enc = await encryptWithPassword(password, words);
      const entry = {
        address: addr,
        ciphertext: enc.ciphertext,
        salt: enc.salt,
        iv: enc.iv,
        createdAt: Date.now()
      };
      upsertKeystore(entry);
      setCurrentAddress(addr);

      // 创建会话
      let session = await sessionManager.createSession(addr);
      if (!session) {
        const allowDev = (import.meta as any)?.env?.DEV || 
                        (import.meta as any)?.env?.VITE_ALLOW_DEV_SESSION === '1';
        if (allowDev) {
          try {
            session = sessionManager.forceCreateDevSession(addr);
          } catch {}
        }
        if (!session) {
          throw new Error('会话建立失败，请稍后重试');
        }
      }

      // 成功回调
      onSuccess?.(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = 
    mnemonic.trim().split(/\s+/).length >= 12 && 
    password.length >= 8 && 
    password === confirmPassword;

  // 调试日志：打印表单状态
  React.useEffect(() => {
    console.log('🔍 表单状态:', {
      mnemonicWords: mnemonic.trim().split(/\s+/).length,
      passwordLength: password.length,
      confirmPasswordLength: confirmPassword.length,
      passwordMatch: password === confirmPassword,
      canSubmit
    });
  }, [mnemonic, password, confirmPassword, canSubmit]);

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '480px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* 返回按钮 */}
      {onBack && (
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <Button type="text" onClick={onBack}>
            &lt; 恢复钱包
          </Button>
        </div>
      )}

      {/* 标题区域 */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(82, 196, 26, 0.3)',
          }}
        >
          <KeyOutlined style={{ fontSize: '40px', color: '#fff' }} />
        </div>
        <Title level={2} style={{ color: '#52c41a', marginBottom: '8px' }}>
          恢复钱包
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          使用助记词恢复您的钱包
        </Text>
      </div>

      {/* 表单区域 */}
      <div
        style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            style={{ marginBottom: '20px' }}
          />
        )}

        {address && (
          <Alert
            type="success"
            showIcon
            message="钱包地址已生成"
            description={address}
            style={{ marginBottom: '20px' }}
          />
        )}

        <Space direction="vertical" style={{ width: '100%' }} size={20}>
          {/* 助记词输入 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              助记词
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="请输入 12 或 24 个助记词，用空格分隔"
              value={mnemonic}
              onChange={(e) => handleMnemonicChange(e.target.value)}
              style={{ borderRadius: '8px' }}
            />
            <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
              助记词通常是 12 或 24 个英文单词
            </Text>
          </div>

          {/* 密码输入 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              设置密码
            </Text>
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="至少 8 位字符"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              style={{ borderRadius: '8px' }}
            />
            <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
              密码用于本地加密存储助记词
            </Text>
          </div>

          {/* 确认密码输入 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              确认密码
            </Text>
            <Input.Password
              size="large"
              prefix={<SafetyOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              style={{ borderRadius: '8px' }}
            />
            {/* 密码匹配提示 */}
            {confirmPassword && (
              <div style={{ marginTop: '8px' }}>
                {password === confirmPassword ? (
                  <Text style={{ fontSize: '12px', color: '#52c41a' }}>
                    ✓ 密码匹配
                  </Text>
                ) : (
                  <Text style={{ fontSize: '12px', color: '#ff4d4f' }}>
                    ✗ 密码不匹配
                  </Text>
                )}
              </div>
            )}
          </div>
        </Space>
      </div>

      {/* 安全提示 */}
      <div
        style={{
          background: '#fff7e6',
          border: '1px solid #ffd591',
          padding: '16px',
          borderRadius: '12px',
          marginTop: '20px',
        }}
      >
        <Text style={{ fontSize: '12px', color: '#595959' }}>
          ⚠️ 安全提示：助记词是恢复钱包的唯一凭证，请确保您的助记词是正确的。
          恢复后，钱包将被加密保存在本地设备上。
        </Text>
      </div>

      {/* 恢复按钮 */}
      <Button
        type="primary"
        size="large"
        block
        onClick={handleRestore}
        loading={loading}
        disabled={!canSubmit}
        style={{
          marginTop: '24px',
          height: '56px',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '12px',
          background: canSubmit && !loading
            ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
            : undefined,
          border: 'none',
          boxShadow: canSubmit && !loading 
            ? '0 4px 12px rgba(82, 196, 26, 0.3)' 
            : undefined,
        }}
      >
        {loading ? '恢复中...' : '恢复钱包'}
      </Button>

      {/* 底部提示 */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          恢复成功后，您可以使用密码登录钱包
        </Text>
      </div>
    </div>
  );
};

export default RestoreWalletPage;

