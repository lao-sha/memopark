import React from 'react'
import { Card, Form, Input, InputNumber, Button, Alert, Spin, Descriptions, Tag, Space, Typography, Divider, App } from 'antd'
import { SettingOutlined, SaveOutlined, ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { ApiPromise } from '@polkadot/api'

const { Title, Text } = Typography

/**
 * 函数级详细中文注释：做市商配置管理页面
 * 设计目标：
 * 1）仅供 Active 状态的做市商使用，用于更新 epay 配置
 * 2）调用 pallet-market-maker::update_epay_config(maker_id, epay_gateway?, epay_port?, epay_pid?, epay_key?)
 * 3）支持部分更新：只更新用户修改的字段
 * 4）首购资金池使用 deposit_to_first_purchase_pool 接口（单独调用）
 */

/**
 * 函数级详细中文注释：做市商信息数据结构
 */
interface MarketMakerInfo {
  mmId: number
  owner: string
  status: string
  epayGateway: string
  epayPort: number
  epayPid: string
  epayKey: string
  firstPurchasePool: string
  firstPurchaseUsed: string
  firstPurchaseFrozen: string
  usersServed: number
}

/**
 * 函数级详细中文注释：格式化 DUST 金额（12 位小数）
 */
function formatDustAmount(amount: number): string {
  if (!amount || amount <= 0) return '0'
  try {
    const decimals = 12
    const raw = BigInt(Math.floor(amount * Math.pow(10, decimals)))
    return raw.toString()
  } catch (e) {
    console.error('formatDustAmount error:', e)
    return '0'
  }
}

/**
 * 函数级详细中文注释：解析字节数组或十六进制字符串为明文字符串
 * - 支持三种输入格式：
 *   1. 数组：[102, 100, 103, ...] → 直接解码
 *   2. 十六进制字符串：'0x6664677366677364666773646667' → 先转数组再解码
 *   3. 普通字符串：直接返回
 */
function bytesToString(bytes: any): string {
  if (!bytes) return ''
  
  // 🔹 情况1：已经是普通字符串（不是0x开头）
  if (typeof bytes === 'string' && !bytes.startsWith('0x')) {
    return bytes
  }
  
  // 🔹 情况2：十六进制字符串（0x开头）
  if (typeof bytes === 'string' && bytes.startsWith('0x')) {
    try {
      const hex = bytes.slice(2) // 去除 '0x' 前缀
      const byteArray: number[] = []
      
      // 将十六进制字符串转换为字节数组
      for (let i = 0; i < hex.length; i += 2) {
        byteArray.push(parseInt(hex.substr(i, 2), 16))
      }
      
      // 解码为 UTF-8 字符串
      return new TextDecoder().decode(new Uint8Array(byteArray))
    } catch (e) {
      console.error('十六进制字符串解码失败:', bytes, e)
      return ''
    }
  }
  
  // 🔹 情况3：字节数组
  if (Array.isArray(bytes)) {
    try {
      return new TextDecoder().decode(new Uint8Array(bytes))
    } catch (e) {
      console.error('字节数组解码失败:', bytes, e)
      return ''
    }
  }
  
  return ''
}

export default function MarketMakerConfigPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState<boolean>(false)
  const [loadingInfo, setLoadingInfo] = React.useState<boolean>(false)
  const [api, setApi] = React.useState<ApiPromise | null>(null)
  const [marketMakerInfo, setMarketMakerInfo] = React.useState<MarketMakerInfo | null>(null)
  const [error, setError] = React.useState<string>('')

  /**
   * 函数级详细中文注释：初始化 API 连接
   */
  React.useEffect(() => {
    const initApi = async () => {
      try {
        const apiInstance = await getApi()
        setApi(apiInstance)
      } catch (e: any) {
        setError('API 连接失败：' + (e?.message || ''))
      }
    }
    initApi()
  }, [])

  /**
   * 函数级详细中文注释：加载当前账户的做市商信息
   * - 查询当前账户是否为激活的做市商
   * - 如果是，加载配置信息并填充表单
   */
  const loadMarketMakerInfo = React.useCallback(async () => {
    if (!api) return
    
    try {
      setLoadingInfo(true)
      setError('')
      
      // 检查 pallet 是否存在
      if (!(api.query as any).marketMaker) {
        setError('pallet-market-maker 不存在')
        return
      }

      // 获取当前登录账户地址
      const currentAddress = localStorage.getItem('mp.current')
      
      console.log('[配置管理] 检查登录状态，当前地址:', currentAddress)
      
      if (!currentAddress) {
        setError('未找到当前登录账户，请先登录')
        return
      }

      // 查询 ActiveMarketMakers 找到当前账户的做市商ID
      const entries = await (api.query as any).marketMaker.activeMarketMakers.entries()
      
      let foundMmId: number | null = null
      let foundApp: any = null
      
      for (const [key, value] of entries) {
        const mmId = key.args[0].toNumber()
        const app = value.toJSON() as any
        
        // 检查是否属于当前账户且状态为 Active
        if (app.owner && app.owner.toLowerCase() === currentAddress.toLowerCase() && app.status === 'Active') {
          foundMmId = mmId
          foundApp = app
          console.log('[配置管理] 找到当前账户的做市商记录:', mmId, app)
          break
        }
      }
      
      if (foundMmId === null || !foundApp) {
        setError('您不是已激活的做市商，或者您的申请尚未通过审核')
        return
      }

      // 解析数据
      const info: MarketMakerInfo = {
        mmId: foundMmId,
        owner: foundApp.owner || '',
        status: foundApp.status || 'Unknown',
        epayGateway: bytesToString(foundApp.epayGateway),
        epayPort: foundApp.epayPort || 0,
        epayPid: bytesToString(foundApp.epayPid),
        epayKey: bytesToString(foundApp.epayKey),
        firstPurchasePool: foundApp.firstPurchasePool || '0',
        firstPurchaseUsed: foundApp.firstPurchaseUsed || '0',
        firstPurchaseFrozen: foundApp.firstPurchaseFrozen || '0',
        usersServed: foundApp.usersServed || 0,
      }
      
      setMarketMakerInfo(info)
      
      // 填充表单默认值（用于显示当前配置）
      form.setFieldsValue({
        epay_gateway: info.epayGateway,
        epay_port: info.epayPort,
        epay_pid: info.epayPid,
        epay_key: info.epayKey, // 🆕 2025-10-20：明文显示密钥
      })
      
      console.log('[配置管理] 做市商信息已加载:', info)
      
    } catch (e: any) {
      console.error('[配置管理] 加载失败:', e)
      setError('加载做市商信息失败：' + (e?.message || '未知错误'))
    } finally {
      setLoadingInfo(false)
    }
  }, [api, form])

  /**
   * 函数级详细中文注释：当 API 连接成功后，加载配置信息
   */
  React.useEffect(() => {
    if (api) {
      loadMarketMakerInfo()
    }
  }, [api, loadMarketMakerInfo])

  /**
   * 函数级详细中文注释：提交 epay 配置更新（链上调用）
   * - 签名调用 pallet-market-maker::update_epay_config(maker_id, epay_gateway?, epay_port?, epay_pid?, epay_key?)
   * - 支持部分更新：只更新用户修改的字段，未修改的字段传 null
   */
  const onUpdateConfig = async (values: any) => {
    if (!api || !marketMakerInfo) {
      setError('API 未初始化或做市商信息未加载')
      return
    }

    setError('')
    setLoading(true)

    try {
      console.log('[更新配置] mmId:', marketMakerInfo.mmId)
      console.log('[更新配置] 表单值:', values)

      // 检查是否至少修改了一个字段
      const hasChanges = values.epay_gateway || values.epay_port !== undefined ||
                        values.epay_pid || values.epay_key
      
      if (!hasChanges) {
        message.warning('请至少修改一个字段')
        setLoading(false)
        return
      }

      // 构造参数（Option 类型：null 表示不修改，有值表示修改）
      let epayGatewayParam = null
      let epayPortParam = null
      let epayPidParam = null
      let epayKeyParam = null

      // epay 网关地址（如果提供且与当前值不同）
      if (values.epay_gateway && values.epay_gateway.trim() !== '' && values.epay_gateway !== marketMakerInfo.epayGateway) {
        epayGatewayParam = Array.from(new TextEncoder().encode(values.epay_gateway.trim()))
      }

      // epay 端口（如果提供且与当前值不同）
      if (values.epay_port !== undefined && values.epay_port !== null && values.epay_port !== '' && values.epay_port !== marketMakerInfo.epayPort) {
        const port = Number(values.epay_port)
        if (!(port > 0 && port <= 65535)) {
          throw new Error('epay 端口范围：1-65535')
        }
        epayPortParam = port
      }

      // epay 商户ID（如果提供且与当前值不同）
      if (values.epay_pid && values.epay_pid.trim() !== '' && values.epay_pid !== marketMakerInfo.epayPid) {
        epayPidParam = Array.from(new TextEncoder().encode(values.epay_pid.trim()))
      }

      // epay 商户密钥（如果提供且与当前值不同）
      if (values.epay_key && values.epay_key.trim() !== '' && values.epay_key !== marketMakerInfo.epayKey) {
        epayKeyParam = Array.from(new TextEncoder().encode(values.epay_key.trim()))
      }

      // 再次检查是否有实际变化
      if (!epayGatewayParam && !epayPortParam && !epayPidParam && !epayKeyParam) {
        message.warning('没有检测到配置变更')
        setLoading(false)
        return
      }

      message.loading({ content: '正在签名并更新配置...', key: 'update', duration: 0 })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'updateEpayConfig', [
        marketMakerInfo.mmId,
        epayGatewayParam,
        epayPortParam,
        epayPidParam,
        epayKeyParam
      ])

      message.success({
        content: `配置更新成功！交易哈希: ${hash}`,
        key: 'update',
        duration: 5
      })

      // 等待区块确认后重新加载信息
      await new Promise(resolve => setTimeout(resolve, 3000))
      await loadMarketMakerInfo()
      
      // 🆕 2025-10-20：保留密钥明文显示，不清空字段（已在 loadMarketMakerInfo 中自动填充）

    } catch (e: any) {
      console.error('更新配置失败:', e)
      message.error({ content: '更新配置失败：' + (e?.message || '未知错误'), key: 'update', duration: 5 })
      setError(e?.message || '更新配置失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：向首购资金池充值（链上调用）
   * - 签名调用 pallet-market-maker::deposit_to_first_purchase_pool(maker_id, amount)
   */
  const onDepositToPool = async () => {
    if (!api || !marketMakerInfo) {
      setError('API 未初始化或做市商信息未加载')
      return
    }

    const amountInput = window.prompt('请输入要充值的金额（MEMO）：', '1000.00')
    if (!amountInput) return

    const amount = Number(amountInput)
    if (!(amount > 0)) {
      message.error('充值金额必须大于 0')
      return
    }

    setError('')
    setLoading(true)

    try {
      const amountFormatted = formatDustAmount(amount)
      
      message.loading({ content: '正在签名并充值...', key: 'deposit', duration: 0 })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'depositToFirstPurchasePool', [
        marketMakerInfo.mmId,
        amountFormatted
      ])

      message.success({
        content: `充值成功！交易哈希: ${hash}`,
        key: 'deposit',
        duration: 5
      })

      // 等待区块确认后重新加载信息
      await new Promise(resolve => setTimeout(resolve, 3000))
      await loadMarketMakerInfo()

    } catch (e: any) {
      console.error('充值失败:', e)
      message.error({ content: '充值失败：' + (e?.message || '未知错误'), key: 'deposit', duration: 5 })
      setError(e?.message || '充值失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：返回到做市商申请页面
   */
  const handleBack = () => {
    try {
      window.location.hash = '#/otc/create-mm'
    } catch (e) {
      console.error('导航失败:', e)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
        padding: '60px 20px 20px',
      }}
    >
      {/* 返回按钮 - 固定在左上角 */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px',
        zIndex: 10,
      }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          style={{ 
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          返回做市商申请
        </Button>
      </div>

      {/* 主内容区域 */}
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Title level={4}>
            <SettingOutlined /> 做市商 Epay 配置管理
          </Title>

          {!api && (
            <Alert type="info" showIcon message="正在连接链上节点..." style={{ marginBottom: 12 }} />
          )}

          {error && (
            <Alert 
              type="error" 
              showIcon 
              message={error} 
              style={{ marginBottom: 12 }} 
              closable 
              onClose={() => setError('')} 
            />
          )}

          {loadingInfo && (
            <Spin tip="正在加载做市商信息...">
              <div style={{ minHeight: 200 }} />
            </Spin>
          )}

          {!loadingInfo && marketMakerInfo && (
            <>
              {/* 当前信息展示 */}
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text strong>当前做市商信息</Text>
                    <Space>
                      <Tag color="green">{marketMakerInfo.status}</Tag>
                      <Tag color="blue">做市商 ID: {marketMakerInfo.mmId}</Tag>
                    </Space>
                  </div>
                }
                size="small" 
                style={{ marginBottom: 16 }}
                extra={
                  <Button 
                    type="text" 
                    icon={<ReloadOutlined />} 
                    onClick={loadMarketMakerInfo}
                    loading={loadingInfo}
                    size="small"
                  >
                    刷新
                  </Button>
                }
              >
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="做市商 ID">{marketMakerInfo.mmId}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color="green">{marketMakerInfo.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="账户地址" span={2}>
                    <Text copyable={{ text: marketMakerInfo.owner }} ellipsis style={{ maxWidth: 500 }}>
                      {marketMakerInfo.owner}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Epay 网关">{marketMakerInfo.epayGateway || '未配置'}</Descriptions.Item>
                  <Descriptions.Item label="Epay 端口">{marketMakerInfo.epayPort || '未配置'}</Descriptions.Item>
                  <Descriptions.Item label="Epay 商户ID">{marketMakerInfo.epayPid || '未配置'}</Descriptions.Item>
                  <Descriptions.Item label="Epay 商户密钥">
                    <Text copyable>{marketMakerInfo.epayKey || '未配置'}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="已服务用户数">{marketMakerInfo.usersServed}</Descriptions.Item>
                </Descriptions>

                <Divider style={{ margin: '16px 0' }}>首购资金池状态</Divider>

                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="资金池总额">
                    <Text strong style={{ color: '#52c41a' }}>
                      {(BigInt(marketMakerInfo.firstPurchasePool) / BigInt(1e12)).toString()} DUST
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="已使用金额">
                    <Text strong style={{ color: '#1890ff' }}>
                      {(BigInt(marketMakerInfo.firstPurchaseUsed) / BigInt(1e12)).toString()} DUST
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="冻结金额">
                    <Text strong style={{ color: '#faad14' }}>
                      {(BigInt(marketMakerInfo.firstPurchaseFrozen) / BigInt(1e12)).toString()} DUST
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="可用金额">
                    <Text strong style={{ color: '#52c41a' }}>
                      {(
                        (BigInt(marketMakerInfo.firstPurchasePool) - 
                         BigInt(marketMakerInfo.firstPurchaseUsed) - 
                         BigInt(marketMakerInfo.firstPurchaseFrozen)) / BigInt(1e12)
                      ).toString()} DUST
                    </Text>
                  </Descriptions.Item>
                </Descriptions>

                <Space style={{ marginTop: 16 }}>
                  <Button 
                    type="primary" 
                    onClick={onDepositToPool}
                    loading={loading}
                    disabled={!api}
                  >
                    充值首购资金池
                  </Button>
                  <Button 
                    onClick={() => window.location.hash = '#/first-purchase/pool'}
                  >
                    管理资金池
                  </Button>
                </Space>
              </Card>

              <Divider />

              {/* 配置更新表单 */}
              <Form 
                form={form} 
                layout="vertical" 
                onFinish={onUpdateConfig}
              >
                <Alert 
                  type="info" 
                  showIcon 
                  style={{ marginBottom: 16 }} 
                  message="部分更新说明" 
                  description="只填写需要修改的字段，其他字段留空则保持不变。密钥字段每次都需要重新输入（安全考虑）。"
                />

                <Form.Item 
                  label="Epay 支付网关地址" 
                  name="epay_gateway" 
                  extra={`当前值：${marketMakerInfo.epayGateway || '未配置'}（留空则不修改）`}
                >
                  <Input 
                    placeholder="例如：http://111.170.145.41"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item 
                  label="Epay 支付网关端口" 
                  name="epay_port" 
                  rules={[
                    { type: 'number', min: 1, max: 65535, message: '端口范围：1-65535' }
                  ]}
                  extra={`当前值：${marketMakerInfo.epayPort || '未配置'}（留空则不修改）`}
                >
                  <InputNumber 
                    min={1}
                    max={65535}
                    precision={0}
                    style={{ width: '100%' }}
                    placeholder="例如：80"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item 
                  label="Epay 商户ID (PID)" 
                  name="epay_pid" 
                  extra={`当前值：${marketMakerInfo.epayPid || '未配置'}（留空则不修改）`}
                >
                  <Input 
                    placeholder="例如：123456"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item 
                  label="Epay 商户密钥" 
                  name="epay_key" 
                  extra="明文显示当前密钥，可直接修改（留空则不修改）"
                >
                  <Input 
                    placeholder="请输入新的商户密钥（不修改则留空）"
                    disabled={loading}
                  />
                </Form.Item>

                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    icon={<SaveOutlined />}
                    loading={loading}
                    disabled={!api}
                    block
                    size="large"
                  >
                    {loading ? '正在签名...' : '保存配置'}
                  </Button>
                </Space>
              </Form>

              <Alert 
                type="warning" 
                showIcon 
                style={{ marginTop: 16 }} 
                message="安全提示" 
                description={
                  <>
                    <p>• 修改配置后将立即生效，请确保配置正确</p>
                    <p>• 商户密钥将被加密存储在链上，仅用于支付验签</p>
                    <p>• 首购资金池充值后将由 pallet 自动管理，不可提取</p>
                  </>
                }
              />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

