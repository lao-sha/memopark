/**
 * 函数级详细中文注释：恢复钱包页面（网页端）
 * - 输入助记词
 * - 设置密码
 * - 加密保存到 localStorage
 */
import React, { useState } from 'react'
import { Card, Button, Input, Steps, Alert, Space, Typography, message, Row, Col } from 'antd'
import { 
  ImportOutlined, 
  SafetyOutlined, 
  CheckCircleOutlined 
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { 
  deriveAddressFromMnemonic,
  encryptWithPassword, 
  upsertKeystore,
  setCurrentAddress 
} from '../../../lib/keystore'

const { Title, Text } = Typography
const { TextArea } = Input

export const RecoverWallet: React.FC = () => {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [mnemonic, setMnemonic] = useState('')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  /**
   * 步骤 1：验证助记词
   */
  const handleVerify = async () => {
    const mnemonicTrimmed = mnemonic.trim()
    
    if (!mnemonicTrimmed) {
      message.error('请输入助记词')
      return
    }

    // 验证助记词格式（12个单词）
    const words = mnemonicTrimmed.split(/\s+/)
    if (words.length !== 12) {
      message.error('助记词应该是 12 个单词')
      return
    }

    setLoading(true)
    try {
      // 派生地址验证助记词有效性
      const addr = await deriveAddressFromMnemonic(mnemonicTrimmed)
      setAddress(addr)
      setMnemonic(mnemonicTrimmed)
      message.success('助记词验证成功！')
      setCurrent(1)
    } catch (e: any) {
      message.error('助记词无效：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 步骤 2：设置密码并保存
   */
  const handleRecover = async () => {
    if (!password || password.length < 8) {
      message.error('密码至少需要 8 位')
      return
    }
    if (password !== confirmPassword) {
      message.error('两次密码不一致')
      return
    }

    setLoading(true)
    try {
      // 加密助记词
      const encrypted = await encryptWithPassword(password, mnemonic)

      // 保存到 localStorage
      upsertKeystore({
        address,
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        iv: encrypted.iv,
        createdAt: Date.now()
      })

      // 设置为当前账户
      setCurrentAddress(address)

      message.success('钱包恢复成功！')
      
      // 跳转到首页
      setTimeout(() => {
        navigate('/')
      }, 1000)
    } catch (e: any) {
      message.error('恢复失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24}>
        <Col xs={24} lg={16} xl={14}>
          <Card>
            <Title level={2}>
              <ImportOutlined /> 恢复钱包
            </Title>

            <Steps
              current={current}
              items={[
                { title: '输入助记词', icon: <ImportOutlined /> },
                { title: '设置密码', icon: <SafetyOutlined /> }
              ]}
              style={{ marginBottom: 32 }}
            />

        {/* 步骤 1：输入助记词 */}
        {current === 0 && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="治理平台钱包恢复"
              description="请使用在 memopark-dapp 中创建的助记词恢复钱包。治理平台与用户端共享账户数据，使用相同的助记词可恢复相同的地址。"
              type="info"
              showIcon
            />

            <div>
              <Text strong>助记词（12个单词）：</Text>
              <TextArea
                rows={4}
                placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <Alert
              message="安全提示"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>请确保在安全的环境中输入助记词</li>
                  <li>助记词不会上传到服务器</li>
                  <li>输入错误的助记词会生成不同的地址</li>
                </ul>
              }
              type="warning"
            />

            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={handleVerify}
              disabled={!mnemonic.trim()}
            >
              验证并继续
            </Button>
          </Space>
        )}

        {/* 步骤 2：设置密码 */}
        {current === 1 && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="钱包地址"
              description={
                <div>
                  <Text>恢复的地址：</Text>
                  <br />
                  <Text code copyable style={{ fontSize: 12 }}>
                    {address}
                  </Text>
                </div>
              }
              type="success"
              showIcon
            />

            <Alert
              message="设置密码"
              description="设置一个新密码来加密存储助记词。每次签名交易时需要输入密码。"
              type="info"
              showIcon
            />

            <div>
              <Text strong>输入密码：</Text>
              <Input.Password
                size="large"
                placeholder="至少 8 位密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={() => {
                  if (password === confirmPassword) {
                    handleRecover()
                  }
                }}
              />
            </div>

            <div>
              <Text strong>确认密码：</Text>
              <Input.Password
                size="large"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onPressEnter={handleRecover}
              />
            </div>

            <Space>
              <Button onClick={() => setCurrent(0)}>
                上一步
              </Button>
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleRecover}
                disabled={!password || password.length < 8 || password !== confirmPassword}
                icon={<CheckCircleOutlined />}
              >
                恢复钱包
              </Button>
            </Space>
          </Space>
        )}
          </Card>
        </Col>

        {/* 右侧提示栏 */}
        <Col xs={24} lg={8} xl={10}>
          <Card title="📋 治理平台钱包说明" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="为什么使用恢复而非创建？"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li><strong>职责分离：</strong>治理平台专注于治理功能</li>
                    <li><strong>安全考虑：</strong>钱包创建在用户端完成</li>
                    <li><strong>账户共享：</strong>与 memopark-dapp 共享账户</li>
                    <li><strong>简化流程：</strong>减少重复操作</li>
                  </ul>
                }
                type="info"
              />
              <Alert
                message="恢复步骤"
                description={
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    <li>输入在用户端创建的助记词</li>
                    <li>系统验证并派生地址</li>
                    <li>设置治理平台专用密码</li>
                    <li>完成后即可使用治理功能</li>
                  </ol>
                }
                type="success"
              />
            </Space>
          </Card>

          <Card title="🔐 安全提示">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="助记词验证"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li><strong>必须是12个单词：</strong>用空格分隔</li>
                    <li><strong>顺序不能错：</strong>单词顺序必须正确</li>
                    <li><strong>注意大小写：</strong>通常是小写英文</li>
                    <li><strong>安全环境：</strong>确保无人旁观或录像</li>
                  </ul>
                }
                type="warning"
              />
              
              <Alert
                message="密码设置"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>可以设置与原密码不同的新密码</li>
                    <li>密码至少8位</li>
                    <li>密码仅在本地使用</li>
                    <li>忘记密码可再次用助记词恢复</li>
                  </ul>
                }
                type="success"
              />

              <Alert
                message="常见问题"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li><strong>Q:</strong> 输入助记词后地址不对？</li>
                    <li><strong>A:</strong> 请检查单词顺序和拼写</li>
                    <li><strong>Q:</strong> 可以多次恢复吗？</li>
                    <li><strong>A:</strong> 可以，相同助记词生成相同地址</li>
                  </ul>
                }
                type="info"
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default RecoverWallet

