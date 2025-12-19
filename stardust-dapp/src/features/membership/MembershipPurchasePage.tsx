import React, { useEffect, useState } from 'react'
import { Card, Form, Radio, Input, Button, Space, Typography, Alert, message, Divider, FloatButton } from 'antd'
import { CrownOutlined, StarOutlined, TrophyOutlined, RocketOutlined, ArrowLeftOutlined, CommentOutlined } from '@ant-design/icons'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { getCurrentAddress } from '../../lib/keystore'
import FeedbackModal from '../../components/feedback/FeedbackModal'
import DynamicPriceDisplay from '../../components/membership/DynamicPriceDisplay'
import { MEMBERSHIP_LEVELS, formatDustAmount } from '../../utils/membershipPricing'

const { Title, Text, Paragraph } = Typography

/**
 * 函数级详细中文注释：年费会员购买页面组件
 *
 * 功能：
 * - 展示四种会员等级：Year1/Year3/Year5/Year10
 * - 🆕 2025-11-10：显示固定 USDT 价格 + 动态 DUST 数量
 * - 🆕 实时查询 DUST 市场价格并计算所需数量
 * - 输入推荐码购买会员
 * - 自动验证推荐码有效性
 * - 购买成功后自动分配推荐码
 * - 数据埋点：记录用户行为
 */
const MembershipPurchasePage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [currentAddr, setCurrentAddr] = useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<number>(0) // 0=Year1, 1=Year3, 2=Year5, 3=Year10
  const [referralCodeValid, setReferralCodeValid] = useState<boolean | null>(null)
  const [referrerAccount, setReferrerAccount] = useState<string>('')
  const [feedbackVisible, setFeedbackVisible] = useState(false)

  // 🆕 2025-11-10：动态价格状态
  const [currentDustAmount, setCurrentDustAmount] = useState<number>(0)
  const [currentDustPrice, setCurrentDustPrice] = useState<number>(100)

  useEffect(() => {
    const addr = getCurrentAddress()
    setCurrentAddr(addr)
    // 数据埋点：页面访问
    logEvent('membership_page_view', { address: addr })
  }, [])

  /**
   * 函数级中文注释：数据埋点函数
   * - 记录用户行为到 localStorage
   * - 后续可扩展到服务器端收集
   */
  const logEvent = (eventName: string, data: Record<string, any>) => {
    try {
      const events = JSON.parse(localStorage.getItem('mp_analytics') || '[]')
      events.push({
        event: eventName,
        timestamp: new Date().toISOString(),
        data
      })
      // 只保留最近1000条记录
      if (events.length > 1000) {
        events.splice(0, events.length - 1000)
      }
      localStorage.setItem('mp_analytics', JSON.stringify(events))
    } catch (e) {
      console.warn('数据埋点失败', e)
    }
  }

  /**
   * 函数级中文注释：验证推荐码
   * - 通过链上 affiliate.codeToAccount 查询推荐人
   * - 验证推荐人是否为有效会员
   * 
   * 🆕 2025-10-30 迁移: 从 memoReferrals.ownerOfCode 迁移到 affiliate.codeToAccount
   */
  const validateReferralCode = async (code: string) => {
    if (!code || code.length !== 8) {
      setReferralCodeValid(null)
      setReferrerAccount('')
      return
    }

    try {
      const api = await getApi()
      const qroot: any = api.query as any
      const sec = qroot.affiliate
      
      if (!sec || !sec.codeToAccount) {
        setReferralCodeValid(false)
        setReferrerAccount('')
        message.error('affiliate pallet 未找到，请确认链端配置')
        return
      }
      
      // 查询推荐码对应的账户
      const bytes = new TextEncoder().encode(code.toUpperCase())
      const raw = await sec.codeToAccount(bytes)
      
      if (!raw || raw.isNone) {
        setReferralCodeValid(false)
        setReferrerAccount('')
        message.error('推荐码不存在')
        return
      }

      const account = raw.unwrap().toString()
      setReferrerAccount(account)

      // 验证推荐人是否为有效会员
      const membershipSec = qroot.membership
      const memberRaw = await membershipSec.memberships(account)
      
      if (!memberRaw || memberRaw.isNone) {
        setReferralCodeValid(false)
        message.error('推荐人不是有效会员')
        return
      }

      const memberData = memberRaw.unwrap()
      const currentBlock = await api.query.system.number()
      const validUntil = Number(memberData.validUntil.toString())
      const current = Number(currentBlock.toString())

      if (current > validUntil) {
        setReferralCodeValid(false)
        message.error('推荐人会员已过期')
        return
      }

      setReferralCodeValid(true)
      message.success('推荐码有效！')
    } catch (e: any) {
      console.error(e)
      setReferralCodeValid(false)
      message.error('推荐码验证失败：' + (e.message || '未知错误'))
    }
  }

  /**
   * 函数级中文注释：购买会员
   * - 调用链上 membership.purchaseMembership
   * - 参数：level_id, referral_code
   * - 购买成功后自动分配推荐码
   */
  const onPurchase = async (values: any) => {
    if (!currentAddr) {
      message.error('请先选择账户')
      return
    }

    if (!referralCodeValid) {
      message.error('请输入有效的推荐码')
      return
    }

    try {
      setLoading(true)

      // 数据埋点：购买尝试
      logEvent('membership_purchase_attempt', {
        level: selectedLevel,
        referralCode: values.referralCode,
        address: currentAddr
      })

      const referralCodeBytes = new TextEncoder().encode(values.referralCode.toUpperCase())
      const args = [selectedLevel, Array.from(referralCodeBytes)]

      const hash = await signAndSendLocalFromKeystore('membership', 'purchaseMembership', args)
      
      message.success(`购买成功！交易哈希：${hash}`)
      
      // 数据埋点：购买成功
      logEvent('membership_purchase_success', {
        level: selectedLevel,
        txHash: hash,
        address: currentAddr
      })

      // 延迟跳转到个人中心查看推荐码
      setTimeout(() => {
        window.location.hash = '#/profile'
      }, 2000)

    } catch (e: any) {
      console.error(e)
      message.error('购买失败：' + (e.message || '未知错误'))
      
      // 数据埋点：购买失败
      logEvent('membership_purchase_fail', {
        level: selectedLevel,
        error: e.message,
        address: currentAddr
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * 🆕 2025-11-10：价格更新回调
   */
  const handlePriceUpdate = (dustAmount: number, dustPrice: number) => {
    setCurrentDustAmount(dustAmount)
    setCurrentDustPrice(dustPrice)
  }

  const currentLevel = MEMBERSHIP_LEVELS[selectedLevel]

  // 会员等级图标配置
  const levelIcons = [
    <StarOutlined style={{ fontSize: '32px', color: MEMBERSHIP_LEVELS[0].color }} />,
    <CrownOutlined style={{ fontSize: '32px', color: MEMBERSHIP_LEVELS[1].color }} />,
    <TrophyOutlined style={{ fontSize: '32px', color: MEMBERSHIP_LEVELS[2].color }} />,
    <RocketOutlined style={{ fontSize: '32px', color: MEMBERSHIP_LEVELS[3].color }} />
  ]

  return (
    <div style={{ padding: '60px 20px 80px', maxWidth: '414px', margin: '0 auto' }}>
      {/* 返回按钮 */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => window.history.back()}
        style={{ marginBottom: '16px' }}
      >
        返回
      </Button>

      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2} style={{ color: '#B2955D', marginBottom: '8px' }}>
          购买年费会员
        </Title>
        <Text type="secondary">
          获得推荐码，推荐他人赚取佣金，享受专属权益
        </Text>
      </div>

      {/* 🆕 2025-11-10：USDT 定价说明 */}
      <Alert
        type="info"
        showIcon
        message="全新 USDT 定价"
        description={
          <Space direction="vertical" size={4}>
            <div>• 固定 USDT 价格，价格透明稳定</div>
            <div>• DUST 数量根据市场价格实时计算</div>
            <div>• 自动刷新，最终以交易时价格为准</div>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      />

      {/* 会员等级选择 */}
      <Card title="选择会员等级" style={{ marginBottom: '24px' }}>
        <Radio.Group
          value={selectedLevel}
          onChange={(e) => {
            setSelectedLevel(e.target.value)
            logEvent('membership_level_select', { level: e.target.value })
          }}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {MEMBERSHIP_LEVELS.map((level, index) => (
              <Card
                key={level.id}
                hoverable
                onClick={() => setSelectedLevel(level.id)}
                style={{
                  border: selectedLevel === level.id ? `2px solid ${level.color}` : '1px solid #d9d9d9',
                  background: selectedLevel === level.id ? level.bgColor : '#fff'
                }}
              >
                <Radio value={level.id} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>{levelIcons[index]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: level.color }}>
                        {level.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                        {level.description}
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                        {/* 🆕 2025-11-10：显示 USDT 固定价格 */}
                        价格: <Text strong style={{ fontSize: '16px', color: level.color }}>${level.usdtPrice} USDT</Text>
                        {' '}|{' '}
                        基础代数: <Text strong>{level.baseGenerations}代</Text>
                        {' '}|{' '}
                        有效期: <Text strong>{level.years}年</Text>
                      </div>
                    </div>
                  </div>
                </Radio>
              </Card>
            ))}
          </Space>
        </Radio.Group>
      </Card>

      {/* 购买表单 */}
      <Card title="填写购买信息">
        <Form form={form} layout="vertical" onFinish={onPurchase}>
          <Alert
            type="info"
            showIcon
            message="购买须知"
            description={
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>购买会员需要提供有效的推荐码</li>
                <li>购买成功后将自动为您分配推荐码</li>
                <li>推荐码可用于推荐他人购买会员并获得奖励</li>
                <li>每推荐1人，您的推荐代数+1（最多15代）</li>
              </ul>
            }
            style={{ marginBottom: '24px' }}
          />

          <Form.Item
            label="推荐码"
            name="referralCode"
            rules={[
              { required: true, message: '请输入推荐码' },
              { len: 8, message: '推荐码必须是8位字符' }
            ]}
            validateStatus={
              referralCodeValid === null ? undefined : (referralCodeValid ? 'success' : 'error')
            }
            hasFeedback
          >
            <Input
              placeholder="输入8位推荐码"
              maxLength={8}
              onChange={(e) => {
                const code = e.target.value.toUpperCase()
                form.setFieldsValue({ referralCode: code })
                if (code.length === 8) {
                  validateReferralCode(code)
                } else {
                  setReferralCodeValid(null)
                  setReferrerAccount('')
                }
              }}
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>

          {referrerAccount && referralCodeValid && (
            <Alert
              type="success"
              showIcon
              message="推荐人账户"
              description={<Text copyable code>{referrerAccount}</Text>}
              style={{ marginBottom: '16px' }}
            />
          )}

          <Divider />

          {/* 🆕 2025-11-10：动态价格显示 */}
          <div style={{ marginBottom: '24px' }}>
            <Title level={4}>购买摘要</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>会员等级：</Text>
                <Text strong style={{ color: currentLevel.color }}>{currentLevel.name}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>基础代数：</Text>
                <Text strong>{currentLevel.baseGenerations}代</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>有效期：</Text>
                <Text strong>{currentLevel.years}年</Text>
              </div>
            </Space>

            {/* 动态价格组件 */}
            <Divider style={{ margin: '16px 0' }} />
            <DynamicPriceDisplay
              levelId={selectedLevel}
              levelColor={currentLevel.color}
              showMarketPrice={true}
              onPriceUpdate={handlePriceUpdate}
            />
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={!referralCodeValid}
              block
              size="large"
              style={{ height: '48px', fontSize: '16px' }}
            >
              {loading ? '购买中...' : `支付 ${formatDustAmount(currentDustAmount)} DUST`}
            </Button>
          </Form.Item>

          <Alert
            type="warning"
            showIcon
            message="注意"
            description="购买会员后资金将转入联盟托管账户用于推荐奖励分配，请确认信息无误后再提交。"
          />
        </Form>
      </Card>

      {/* 会员权益说明 */}
      <Card title="会员权益" style={{ marginTop: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>✅ <Text strong>推荐奖励：</Text>获得专属推荐码，推荐他人购买会员赚取佣金</div>
          <div>✅ <Text strong>代数增长：</Text>每推荐1人，推荐代数+1（最多15代）</div>
          <div>✅ <Text strong>消费折扣：</Text>供奉等消费享受2折优惠（可治理调整）</div>
          <div>✅ <Text strong>治理权益：</Text>参与社区治理，享有提案和投票权</div>
          <div>✅ <Text strong>专属服务：</Text>优先客服支持，专属活动参与权</div>
        </Space>
      </Card>

      {/* 浮动反馈按钮 */}
      <FloatButton
        icon={<CommentOutlined />}
        type="primary"
        onClick={() => setFeedbackVisible(true)}
        tooltip="反馈建议"
      />

      {/* 反馈模态框 */}
      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        context="membership_purchase"
      />
    </div>
  )
}

export default MembershipPurchasePage

