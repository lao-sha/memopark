import React from 'react'
import { 
  Alert, 
  Button, 
  Form, 
  Input, 
  InputNumber, 
  Space, 
  Typography, 
  message, 
  Divider, 
  Modal,
  Card,
  Steps
} from 'antd'
import { 
  ArrowLeftOutlined,
  UserOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  DollarOutlined
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { mapDispatchErrorMessage } from '../../lib/errors'
import './CreateGravePage.css'

const { Title, Paragraph, Text } = Typography
const { Step } = Steps

/**
 * 函数级详细中文注释：创建纪念馆页面（移动端专用）
 * - 专为移动端设计，固定宽度布局
 * - 去除响应式自适应代码，优化触控体验
 * - 与后端 `pallet-memo-grave::create_grave` 对齐
 * - 采用卡片式布局，清晰的信息层次
 * - 保持与项目主题色系统一致
 */
const CreateGravePage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)
  const [maxCidLen, setMaxCidLen] = React.useState<number>(0)
  const [createFee, setCreateFee] = React.useState<string>('0')
  const [tokenSymbol, setTokenSymbol] = React.useState<string>('DUST')
  const [decimals, setDecimals] = React.useState<number>(12)
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [pwdVal, setPwdVal] = React.useState('')
  const [confirmLoading, setConfirmLoading] = React.useState(false)
  const [currentStep, setCurrentStep] = React.useState(0)
  const txCtxRef = React.useRef<{ section: string; args: any[] } | null>(null)

  /**
   * 函数级中文注释：组件挂载时读取链上常量
   * 获取创建费用、最大CID长度、代币符号等信息
   */
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const api = await getApi()
        const sym = (api.registry.chainTokens?.[0] as string) || 'DUST'
        const dec = api.registry.chainDecimals?.[0] ?? 12
        const feeConst: any = (api.consts as any)?.memoGrave?.createFee
        const maxLenConst: any = (api.consts as any)?.memoGrave?.maxCidLen
        const feeStr = feeConst ? feeConst.toString() : '0'
        const maxLen = maxLenConst ? Number(maxLenConst.toString()) : 0
        if (!mounted) return
        setTokenSymbol(sym)
        setDecimals(dec)
        setCreateFee(feeStr)
        setMaxCidLen(maxLen)
      } catch (e) {
        // 忽略：链未连上时仍可渲染表单
      }
    })()
    return () => { mounted = false }
  }, [])

  /**
   * 函数级中文注释：格式化链上最小单位余额
   * 将链上的最小单位转换为可读的代币数量
   */
  const formatAmount = React.useCallback((amount: string, dec: number) => {
    try {
      const num = BigInt(amount)
      const base = BigInt(10) ** BigInt(dec)
      const whole = num / base
      const frac = num % base
      if (frac === 0n) return whole.toString()
      const fracStr = frac.toString().padStart(dec, '0').replace(/0+$/, '')
      return fracStr ? `${whole}.${fracStr}` : whole.toString()
    } catch {
      return '0'
    }
  }, [])

  /**
   * 函数级详细中文注释：提交创建交易
   * 1. 验证表单数据
   * 2. 编码纪念馆名称为字节数组
   * 3. 构建交易参数
   * 4. 打开密码确认弹窗
   */
  const onFinish = React.useCallback(async (values: any) => {
    try {
      setLoading(true)
      setCurrentStep(1) // 进入提交步骤
      
      const parkIdInput = values.park_id
      const namePlain: string = (values.name_plain || '').trim()
      
      if (!namePlain) { 
        setLoading(false)
        setCurrentStep(0)
        return message.warning('请填写纪念馆名称') 
      }
      
      const nameBytes = Array.from(new TextEncoder().encode(namePlain))
      if (maxCidLen && nameBytes.length > maxCidLen) {
        setLoading(false)
        setCurrentStep(0)
        return message.warning(`名称字节长度超限（${nameBytes.length}/${maxCidLen}）`)
      }
      
      const parkIdOpt = (parkIdInput === null || parkIdInput === undefined || parkIdInput === '') 
        ? null 
        : Number(parkIdInput)
      
      // 动态解析 section 名称
      let section = 'memoGrave'
      try {
        const api = await getApi()
        const txRoot: any = api.tx as any
        const candidates = ['memoGrave', 'memo_grave', 'grave', ...Object.keys(txRoot)]
        for (const s of candidates) {
          const m = txRoot[s]
          if (m && typeof m.createGrave === 'function') { 
            section = s
            break 
          }
        }
      } catch {}
      
      const args: any[] = [ parkIdOpt, nameBytes ]
      txCtxRef.current = { section, args }
      setPwdVal('')
      setPwdOpen(true)
    } catch (e: any) {
      setCurrentStep(0)
      const msg = mapDispatchErrorMessage(e, '提交失败')
      if (/未找到本地钱包/.test(msg)) {
        Modal.confirm({
          title: '未发现本地钱包',
          content: '请先创建或导入钱包后再试。',
          okText: '去创建/导入',
          cancelText: '取消',
          onOk: () => { 
            try { 
              window.location.hash = '#/wallet'
            } catch {} 
          }
        })
      } else {
        message.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [form, maxCidLen])

  /**
   * 函数级详细中文注释：确认密码并提交交易
   * 1. 验证密码长度
   * 2. 调用签名并发送交易
   * 3. 处理交易结果
   * 4. 跳转到我的纪念馆页面
   */
  const onConfirmPassword = React.useCallback(async () => {
    if (!txCtxRef.current) { 
      setPwdOpen(false)
      setLoading(false)
      setCurrentStep(0)
      return 
    }
    if (!pwdVal || pwdVal.length < 8) { 
      return message.warning('请输入至少 8 位签名密码') 
    }
    
    const { section, args } = txCtxRef.current
    const key = 'tx-create-grave'
    try {
      setConfirmLoading(true)
      message.loading({ key, content: '正在提交交易…' })
      
      const timeoutId = setTimeout(() => {
        message.loading({ key, content: '连接节点较慢，仍在等待…' })
      }, 8000)
      
      const txHash = await signAndSendLocalWithPassword(section, 'createGrave', args, pwdVal)
      clearTimeout(timeoutId)
      
      message.success({ key, content: `创建成功：${txHash}` })
      setPwdOpen(false)
      form.resetFields()
      setCurrentStep(2) // 完成步骤
      
      try { 
        window.dispatchEvent(new Event('mp.txUpdate')) 
      } catch {}
      
      // 延迟跳转，显示成功状态
      setTimeout(() => {
        try { 
          window.location.hash = '#/grave/my' 
        } catch {}
      }, 2000)
    } catch (e: any) {
      setCurrentStep(0)
      const msg = mapDispatchErrorMessage(e, '提交失败')
      if (/密码|password/i.test(String(e?.message||''))) {
        message.error({ key, content: '密码错误或解密失败，请重试' })
      } else if (/未找到本地钱包/.test(msg)) {
        message.destroy(key)
        Modal.confirm({
          title: '未发现本地钱包',
          content: '请先创建或导入钱包后再试。',
          okText: '去创建/导入',
          cancelText: '取消',
          onOk: () => { 
            try { 
              window.location.hash = '#/wallet'
            } catch {} 
          }
        })
      } else {
        message.error({ key, content: msg })
      }
    } finally {
      setConfirmLoading(false)
      setLoading(false)
    }
  }, [pwdVal, form])

  return (
    <div className="mobile-create-grave-page">
      {/* 顶部导航栏 */}
      <div className="mobile-page-header">
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined style={{ fontSize: 20 }} />} 
          onClick={() => window.history.back()}
          className="mobile-back-button"
        />
        <Title level={4} className="mobile-page-title">创建纪念馆</Title>
        <div style={{ width: 40 }} /> {/* 占位，保持居中 */}
      </div>

      {/* 主要内容区域 */}
      <div className="mobile-page-content">
        {/* 进度指示器 */}
        <Card className="mobile-steps-card">
          <Steps current={currentStep} size="small">
            <Step title="填写信息" icon={<UserOutlined />} />
            <Step title="提交上链" icon={<HomeOutlined />} />
            <Step title="完成" icon={<CheckCircleOutlined />} />
          </Steps>
        </Card>

        {/* 提示信息 */}
        <Alert
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
          message="温馨提示"
          description={
            <div className="alert-content">
              <p>• 纪念馆名称将永久保存在区块链上</p>
              <p>• 可以是个人纪念馆或家族纪念馆</p>
              <p>• 名称提交后无法修改，请仔细核对</p>
            </div>
          }
          className="mobile-alert"
        />
        
        <Alert
          type="warning"
          icon={<DollarOutlined />}
          showIcon
          message="费用说明"
          description={
            <div className="alert-content">
              <p>
                一次性创建费：<Text strong style={{ color: '#B8860B' }}>
                  {formatAmount(createFee, decimals)} {tokenSymbol}
                </Text>
              </p>
              <p>另需支付链上交易费（根据网络状况动态调整）</p>
            </div>
          }
          className="mobile-alert"
        />

        {/* 创建表单 */}
        <Card className="mobile-form-card">
          <Form 
            form={form} 
            layout="vertical" 
            onFinish={onFinish}
          >
            <Form.Item 
              name="park_id" 
              label={<Text strong>园区ID（可选）</Text>}
              extra="留空表示暂不隶属任何园区"
            >
              <InputNumber 
                min={0} 
                style={{ width: '100%' }} 
                placeholder="请输入园区ID（可选）"
                size="large"
              />
            </Form.Item>

            <Form.Item 
              name="name_plain" 
              label={
                <span>
                  <Text strong>纪念馆名称</Text>
                  <Text type="danger"> *</Text>
                </span>
              }
              rules={[
                { required: true, message: '请输入纪念馆名称' },
                { 
                  max: maxCidLen || 100, 
                  message: `名称不能超过 ${maxCidLen || 100} 字节` 
                }
              ]}
              extra={`最多 ${maxCidLen || 100} 字节（约 ${Math.floor((maxCidLen || 100) / 3)} 个中文字符）`}
            >
              <Input 
                placeholder="请输入纪念馆名称（如：张氏纪念馆）" 
                maxLength={maxCidLen || 100}
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                block 
                size="large"
                className="mobile-submit-button"
                disabled={currentStep === 2}
              >
                {loading ? '正在提交...' : currentStep === 2 ? '创建成功' : '创建纪念馆'}
              </Button>
            </Form.Item>

            {/* 快捷入口 */}
            <div className="mobile-quick-link">
              <Button 
                type="link"
                onClick={() => { 
                  try { 
                    window.location.hash = '#/deceased/create' 
                  } catch {} 
                }}
              >
                或者，直接创建逝者档案 →
              </Button>
            </div>
          </Form>
        </Card>

        {/* 密码确认弹窗 */}
        <Modal
          open={pwdOpen}
          title="输入签名密码"
          onCancel={() => { 
            setPwdOpen(false)
            setLoading(false)
            setCurrentStep(0)
          }}
          onOk={onConfirmPassword}
          okText="确认创建"
          cancelText="取消"
          confirmLoading={confirmLoading}
          centered
          className="mobile-password-modal"
        >
          <Paragraph style={{ textAlign: 'center', marginBottom: 16, color: '#708090' }}>
            请输入钱包密码以完成上链交易
          </Paragraph>
          <Input.Password 
            placeholder="至少 8 位密码" 
            value={pwdVal} 
            onChange={e => setPwdVal(e.target.value)}
            size="large"
          />
        </Modal>

        {/* 使用说明 */}
        <Card className="mobile-guide-card">
          <Title level={5} style={{ color: '#2F4F4F', marginBottom: 16, fontSize: 16 }}>
            创建流程
          </Title>
          
          <div className="mobile-guide-steps">
            <div className="mobile-guide-step">
              <div className="mobile-step-number">1</div>
              <div className="mobile-step-content">
                <Text strong style={{ display: 'block', marginBottom: 4 }}>填写信息</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>输入纪念馆名称</Text>
              </div>
            </div>

            <div className="mobile-guide-step">
              <div className="mobile-step-number">2</div>
              <div className="mobile-step-content">
                <Text strong style={{ display: 'block', marginBottom: 4 }}>提交上链</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>输入密码确认</Text>
              </div>
            </div>

            <div className="mobile-guide-step">
              <div className="mobile-step-number">3</div>
              <div className="mobile-step-content">
                <Text strong style={{ display: 'block', marginBottom: 4 }}>获得ID</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>系统分配10位编号</Text>
              </div>
            </div>

            <div className="mobile-guide-step">
              <div className="mobile-step-number">4</div>
              <div className="mobile-step-content">
                <Text strong style={{ display: 'block', marginBottom: 4 }}>添加逝者</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>完善纪念馆内容</Text>
              </div>
            </div>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <div className="mobile-tips-section">
            <Title level={5} style={{ color: '#2F4F4F', marginBottom: 12, fontSize: 15 }}>
              注意事项
            </Title>
            <ul className="mobile-tips-list">
              <li>名称将永久保存在区块链上，提交后无法修改</li>
              <li>可使用个人姓名或家族名称，便于亲友搜索</li>
              <li>创建费用将从账户余额中扣除</li>
              <li>请确保账户余额充足</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default CreateGravePage
