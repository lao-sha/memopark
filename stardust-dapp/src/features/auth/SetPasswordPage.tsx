import React, { useState } from 'react';
import { Button, Typography, Input, Space, Alert } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone, SafetyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 函数级详细中文注释：设置密码页面组件
 * - 创建钱包流程的第一步：设置加密密码
 * - 展示密码强度提示和安全建议
 * - 要求输入密码和确认密码
 * - 验证密码强度（至少 8 位）
 * - 移动端优先设计，最大宽度 640px 居中
 */
interface SetPasswordPageProps {
  onPasswordSet: (password: string) => void;
  onBack?: () => void;
}

const SetPasswordPage: React.FC<SetPasswordPageProps> = ({
  onPasswordSet,
  onBack
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  /**
   * 函数级详细中文注释：计算密码强度
   * - 长度 < 8: 弱
   * - 长度 >= 8 且包含字母和数字: 中等
   * - 长度 >= 12 且包含大小写字母、数字和特殊字符: 强
   */
  const calculatePasswordStrength = (pwd: string): 'weak' | 'medium' | 'strong' => {
    if (pwd.length < 8) return 'weak';
    
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    
    if (pwd.length >= 12 && hasUpper && hasLower && hasNumber && hasSpecial) {
      return 'strong';
    }
    
    if (pwd.length >= 8 && hasLetter && hasNumber) {
      return 'medium';
    }
    
    return 'weak';
  };

  /**
   * 函数级详细中文注释：处理密码输入
   * - 更新密码状态
   * - 计算密码强度
   * - 清除错误信息
   */
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
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
   * 函数级详细中文注释：验证并提交密码
   * - 验证密码长度（至少 8 位）
   * - 验证两次密码输入一致
   * - 调用回调函数传递密码
   */
  const handleSubmit = () => {
    setError('');
    
    if (!password) {
      setError('请输入密码');
      return;
    }
    
    if (password.length < 8) {
      setError('密码至少需要 8 位字符');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    onPasswordSet(password);
  };

  // 密码强度颜色和文本
  const strengthConfig = {
    weak: { color: '#ff4d4f', text: '弱', width: '33%' },
    medium: { color: '#faad14', text: '中等', width: '66%' },
    strong: { color: '#52c41a', text: '强', width: '100%' },
  };

  const canSubmit = password.length >= 8 && password === confirmPassword;

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
            &lt; 创建钱包
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
          }}
        >
          <LockOutlined style={{ fontSize: '40px', color: '#fff' }} />
        </div>
        <Title level={2} style={{ color: '#1890ff', marginBottom: '8px' }}>
          设置密码
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          密码用于本地加密存储助记词，请务必记住
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

        <Space direction="vertical" style={{ width: '100%' }} size={20}>
          {/* 密码输入 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              密码
            </Text>
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="至少 8 位字符"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
              style={{ borderRadius: '8px' }}
            />
            
            {/* 密码强度指示器 */}
            {password && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    密码强度
                  </Text>
                  <Text
                    style={{
                      fontSize: '12px',
                      color: strengthConfig[passwordStrength].color,
                      fontWeight: 'bold',
                    }}
                  >
                    {strengthConfig[passwordStrength].text}
                  </Text>
                </div>
                <div
                  style={{
                    height: '4px',
                    background: '#f0f0f0',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: strengthConfig[passwordStrength].width,
                      background: strengthConfig[passwordStrength].color,
                      transition: 'all 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}
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
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
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

      {/* 安全提示卡片 */}
      <div
        style={{
          background: '#e6f7ff',
          border: '1px solid #91d5ff',
          padding: '16px',
          borderRadius: '12px',
          marginTop: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <SafetyOutlined
            style={{ fontSize: '20px', color: '#1890ff', marginRight: '12px', marginTop: '2px' }}
          />
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px', color: '#1890ff' }}>
              密码安全建议
            </Text>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#595959' }}>
              <li>至少 8 位字符，建议 12 位以上</li>
              <li>包含大小写字母、数字和特殊字符</li>
              <li>不要使用生日、电话等易猜密码</li>
              <li>不要与其他网站使用相同密码</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 继续按钮 */}
      <Button
        type="primary"
        size="large"
        block
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          marginTop: '24px',
          height: '56px',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '12px',
          background: canSubmit
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : undefined,
          border: 'none',
          boxShadow: canSubmit ? '0 4px 12px rgba(102, 126, 234, 0.3)' : undefined,
        }}
      >
        继续
      </Button>

      {/* 底部提示 */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          密码仅存储在您的设备上，我们无法帮您找回
        </Text>
      </div>
    </div>
  );
};

export default SetPasswordPage;

