import React from 'react'
import { Card, Steps, Form, Input, InputNumber, Button, Space, Typography, Alert, Divider, message, Collapse, Tag, Modal } from 'antd'
import { InfoCircleOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { ApiPromise } from '@polkadot/api'

/**
 * 函数级详细中文注释：做市商申请（两步式：先质押 → 再提交资料）
 * 设计目标：
 * 1）先质押 MEMO，生成 mmId（链上返回）；
 * 2）在有效期内提交资料（公开 CID、私密 CID、费率与交易对参数等）；
 * 3）集成链上调用，不依赖浏览器扩展，使用本地 keystore 签名。
 * 4）CID 检查遵循项目规则：CID 一律不加密（明文 CID）；私密内容加密，但 CID 指向密文文件的明文 CID。
 */
export default function CreateMarketMakerPage() {
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [current, setCurrent] = React.useState<number>(0)
  const [error, setError] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  const [mmId, setMmId] = React.useState<number | null>(null)
  const [deadlineSec, setDeadlineSec] = React.useState<number>(0)
  const [api, setApi] = React.useState<ApiPromise | null>(null)

  /**
   * 函数级详细中文注释：从 localStorage 恢复申请状态
   * - 用于页面刷新后恢复进度
   */
  React.useEffect(() => {
    const savedMmId = localStorage.getItem('mm_apply_id')
    const savedDeadline = localStorage.getItem('mm_apply_deadline')
    const savedStep = localStorage.getItem('mm_apply_step')
    
    if (savedMmId && savedDeadline && savedStep) {
      const id = parseInt(savedMmId, 10)
      const deadline = parseInt(savedDeadline, 10)
      const step = parseInt(savedStep, 10)
      
      console.log('[恢复] mmId:', id, 'deadline:', deadline, 'step:', step)
      
      // 检查是否过期（超过 25 小时清除）
      const now = Math.floor(Date.now() / 1000)
      if (deadline > now) {
        setMmId(id)
        setDeadlineSec(deadline)
        setCurrent(step)
        message.info('已恢复上次申请进度')
      } else {
        // 清除过期数据
        localStorage.removeItem('mm_apply_id')
        localStorage.removeItem('mm_apply_deadline')
        localStorage.removeItem('mm_apply_step')
      }
    }
  }, [])

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
   * 函数级详细中文注释：CID 合法性校验
   * - CID 必须为 IPFS CID v0/v1 的常见形式（base58btc 或 base32），不可带 enc: 前缀
   * - 只校验格式与长度，不下行取回；私密内容加密但 CID 仍为明文
   */
  function isValidCid(cid?: string): boolean {
    if (!cid || typeof cid !== 'string') return false
    if (/^enc:/i.test(cid)) return false
    // 简单格式校验：base32(小写字母与数字) 或 base58btc（大小写字母与数字，排除 0OIl）
    const base32ok = /^[a-z0-9]{46,}|bafy[a-z0-9]{10,}$/i.test(cid)
    const base58ok = /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(cid)
    return base32ok || base58ok
  }

  /**
   * 函数级详细中文注释：格式化 MEMO 金额（12 位小数）
   * - 使用 BigInt 避免 JavaScript number 精度问题
   * - 返回整数字符串，供 Polkadot.js 使用
   */
  function formatMemoAmount(amount: number): string {
    if (!amount || amount <= 0) return '0'
    try {
      // 使用 BigInt 避免精度丢失
      // MEMO 使用 12 位小数：1 MEMO = 1,000,000,000,000
      const decimals = 12
      const raw = BigInt(Math.floor(amount * Math.pow(10, decimals)))
      return raw.toString()
    } catch (e) {
      console.error('formatMemoAmount error:', e)
      return '0'
    }
  }

  /**
   * 函数级详细中文注释：提交质押（链上调用）
   * - 签名调用 pallet-market-maker::lock_deposit(amount)
   * - 监听事件获取 mmId 和截止时间
   */
  const onDeposit = async (values: any) => {
    if (!api) {
      setError('API 未初始化，请刷新页面')
      return
    }

    setError('')
    setLoading(true)

    try {
      const amount = Number(values.deposit_amount)
      if (!amount || amount <= 0) throw new Error('请输入有效的质押金额')

      // 检查 pallet 是否已注册
      if (!(api.query as any).marketMaker) {
        throw new Error('pallet-market-maker 尚未在 runtime 中注册，请联系管理员')
      }

      // 格式化金额（MEMO 使用 12 位小数）
      const depositAmount = formatMemoAmount(amount)
      
      console.log('[质押] 原始金额:', amount)
      console.log('[质押] 格式化后:', depositAmount)
      console.log('[质押] API 可用:', !!api)
      console.log('[质押] marketMaker pallet 存在:', !!(api.query as any).marketMaker)

      message.loading({ content: '正在签名并提交质押...', key: 'deposit', duration: 0 })

      // 签名并发送交易（注意：Rust 蛇形命名在 JS 中转为驼峰）
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'lockDeposit', [depositAmount])

      message.success({ content: `质押提交成功！交易哈希: ${hash}`, key: 'deposit', duration: 3 })

      // 等待事件并解析 mmId（简化版：等待区块确认）
      // 生产环境应监听链上事件获取真实 mmId
      await new Promise(resolve => setTimeout(resolve, 3000))

      try {
        // 查询最新的 mmId（从 NextId 获取）
        const nextIdRaw = await (api.query as any).marketMaker.nextId()
        const nextId = Number(nextIdRaw.toString())
        
        console.log('[质押] NextId:', nextId)
        
        // NextId 至少应该是 1（因为刚提交了一笔）
        if (nextId < 1) {
          throw new Error('NextId 异常（小于 1），链上状态可能未更新，请稍后查询')
        }
        
        // 最新申请的 ID 是 nextId - 1
        const latestMmId = nextId - 1
        
        console.log('[质押] 最新 mmId:', latestMmId)
        
        // 双重检查：确保 mmId >= 0
        if (latestMmId < 0) {
          throw new Error('mmId 计算为负数，链上数据异常')
        }
        
        // 查询申请详情以验证（传递正整数）
        if (true) {
          const appOption = await (api.query as any).marketMaker.applications(latestMmId)
          
          if (appOption.isSome) {
            const app = appOption.unwrap()
            const appData = app.toJSON()
            
            console.log('[质押] 申请详情:', appData)
            
            // 设置 mmId 和截止时间
            setMmId(latestMmId)
            setDeadlineSec((appData as any).infoDeadline || 0)
            
            // 持久化到 localStorage
            localStorage.setItem('mm_apply_id', String(latestMmId))
            localStorage.setItem('mm_apply_deadline', String((appData as any).infoDeadline || 0))
            localStorage.setItem('mm_apply_step', '1')
            
            message.success('质押成功！请继续提交资料')
            setCurrent(1)
          } else {
            // 申请不存在，可能是查询太快，使用临时方案
            console.warn('[质押] 申请详情查询为空，使用临时 mmId')
            const tmpDeadline = Math.floor(Date.now() / 1000) + 86400
            setMmId(latestMmId)
            setDeadlineSec(tmpDeadline) // 24小时后
            
            // 持久化到 localStorage
            localStorage.setItem('mm_apply_id', String(latestMmId))
            localStorage.setItem('mm_apply_deadline', String(tmpDeadline))
            localStorage.setItem('mm_apply_step', '1')
            
            message.success('质押成功！请继续提交资料')
            setCurrent(1)
          }
        } else {
          throw new Error('mm_id 计算错误，请刷新页面后重试')
        }
      } catch (queryError: any) {
        console.error('[质押] 查询 mmId 失败:', queryError)
        // 即使查询失败，也允许用户继续（使用占位 ID）
        const fallbackId = Math.floor(Date.now() / 1000) % 100000
        const tmpDeadline = Math.floor(Date.now() / 1000) + 86400
        
        setMmId(fallbackId)
        setDeadlineSec(tmpDeadline)
        
        // 持久化到 localStorage
        localStorage.setItem('mm_apply_id', String(fallbackId))
        localStorage.setItem('mm_apply_deadline', String(tmpDeadline))
        localStorage.setItem('mm_apply_step', '1')
        
        message.warning('质押成功但无法查询详情，请手动记录交易哈希并联系客服')
        setCurrent(1)
      }

    } catch (e: any) {
      console.error('质押失败:', e)
      message.error({ content: '质押失败：' + (e?.message || '未知错误'), key: 'deposit', duration: 5 })
      setError(e?.message || '质押失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：提交资料（链上调用）
   * - 签名调用 pallet-market-maker::submit_info(mm_id, public_root_cid, private_root_cid, fee_bps, min_amount)
   * - 本地校验：CID 合法、费率/最小额有效
   */
  const onSubmitInfo = async (values: any) => {
    if (!api) {
      setError('API 未初始化，请刷新页面')
      return
    }

    setError('')
    setLoading(true)

    try {
      // 修复：mmId 可以是 0，使用 === null 检查
      if (mmId === null || mmId === undefined) {
        throw new Error('请先完成质押步骤（mmId 无效）')
      }
      
      console.log('[提交资料] mmId:', mmId)
      console.log('[提交资料] mmId 类型:', typeof mmId)
      console.log('[提交资料] 表单值:', values)

      const { public_root_cid, private_root_cid, fee_bps, min_amount } = values

      // 本地校验
      if (!isValidCid(public_root_cid)) throw new Error('公开资料 CID 非法或疑似加密（禁止 enc: 前缀）')
      if (!isValidCid(private_root_cid)) throw new Error('私密资料根 CID 非法或疑似加密（禁止 enc: 前缀）')

      const fee = Number(fee_bps)
      if (!(fee >= 0 && fee <= 10000)) throw new Error('费率 bps 超出范围（0~10000）')

      const minAmt = Number(min_amount)
      if (!(minAmt > 0)) throw new Error('最小下单额必须大于 0')

      // 格式化参数
      const publicCid = Array.from(new TextEncoder().encode(public_root_cid))
      const privateCid = Array.from(new TextEncoder().encode(private_root_cid))
      const minAmountFormatted = formatMemoAmount(minAmt)

      message.loading({ content: '正在签名并提交资料...', key: 'submit', duration: 0 })

      // 签名并发送交易
      const hash = await signAndSendLocalFromKeystore('marketMaker', 'submitInfo', [
        mmId,
        publicCid,
        privateCid,
        fee,
        minAmountFormatted
      ])

      message.success({
        content: `资料提交成功！交易哈希: ${hash}`,
        key: 'submit',
        duration: 5
      })

      // 清空表单
      form2.resetFields()

      // 清除 localStorage 中的申请状态
      localStorage.removeItem('mm_apply_id')
      localStorage.removeItem('mm_apply_deadline')
      localStorage.removeItem('mm_apply_step')

      // 显示成功提示
      Modal.success({
        title: '申请已提交',
        content: (
          <div>
            <p><strong>mmId:</strong> {mmId}</p>
            <p><strong>状态:</strong> 待委员会审核</p>
            <p>请等待委员会审核您的申请。审核通过后，您将成为正式做市商。</p>
            <Alert type="info" showIcon message="后续步骤" description={
              <>
                <p>1. 委员会将审查您提交的公开和私密资料</p>
                <p>2. 审核通过后，您的状态将变更为 Active</p>
                <p>3. 您可以在审核页面（#/gov/mm-review）中查看进度</p>
              </>
            } style={{ marginTop: 12 }} />
          </div>
        ),
        onOk: () => {
          // 重置状态
          setCurrent(0)
          setMmId(null)
          setDeadlineSec(0)
          form1.resetFields()
        }
      })

    } catch (e: any) {
      console.error('提交资料失败:', e)
      message.error({ content: '提交资料失败：' + (e?.message || '未知错误'), key: 'submit', duration: 5 })
      setError(e?.message || '提交资料失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：格式化截止时间
   */
  const deadlineText = React.useMemo(() => {
    if (!deadlineSec) return ''
    const d = new Date(deadlineSec * 1000)
    return d.toLocaleString('zh-CN')
  }, [deadlineSec])

  /**
   * 函数级详细中文注释：计算剩余时间
   */
  const remainingTime = React.useMemo(() => {
    if (!deadlineSec) return ''
    const now = Math.floor(Date.now() / 1000)
    const diff = deadlineSec - now
    if (diff <= 0) return '已过期'
    
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    return `${hours} 小时 ${minutes} 分钟`
  }, [deadlineSec])

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={5}>做市商申请（两步式：先质押 → 再提交资料）</Typography.Title>

      {!api && (
        <Alert type="info" showIcon message="正在连接链上节点..." style={{ marginBottom: 12 }} />
      )}

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} closable onClose={() => setError('')} />}

      <Steps size="small" current={current} items={[
        { 
          title: '质押保证金',
          icon: current > 0 ? <CheckCircleOutlined /> : undefined
        },
        { 
          title: '提交资料（待审）',
          icon: current === 1 ? <InfoCircleOutlined /> : undefined
        },
      ]} />

      <Divider />

      {/* 步骤 1：质押保证金 */}
      {current === 0 && (
        <>
          <Form form={form1} layout="vertical" onFinish={onDeposit} initialValues={{ deposit_amount: 1000 }}>
            <Form.Item 
              label="质押金额（MEMO）" 
              name="deposit_amount" 
              rules={[
                { required: true, message: '请输入质押金额' },
                { type: 'number', min: 1, message: '质押金额必须大于 0' }
              ]}
              extra="最低质押金额：1000 MEMO（链上配置）"
            > 
              <InputNumber 
                min={1} 
                precision={2} 
                step={100} 
                style={{ width: '100%' }}
                placeholder="请输入质押金额"
                disabled={loading}
              />
            </Form.Item>

            <Alert 
              type="info" 
              showIcon 
              icon={<InfoCircleOutlined />}
              style={{ marginBottom: 12 }} 
              message="质押说明" 
              description={
                <>
                  <p>• 完成质押后，将获得 <strong>24 小时</strong>提交资料窗口</p>
                  <p>• 逾期未提交资料，系统可自动撤回或按规则扣除处理费</p>
                  <p>• 质押金额将被锁定，直到申请被批准或驳回</p>
                  <p>• 申请通过后，质押转为长期保证金</p>
                </>
              }
            />

            <Collapse
              items={[{
                key: '1',
                label: '资料准备要求（点击展开）',
                children: (
                  <div style={{ fontSize: 13 }}>
                    <Typography.Title level={5} style={{ fontSize: 14, marginTop: 0 }}>
                      <WarningOutlined /> 提交前请准备好以下资料
                    </Typography.Title>
                    
                    <Typography.Paragraph strong>1. 公开资料（public_root_cid）</Typography.Paragraph>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>公司/个人介绍（mm.json）</li>
                      <li>Logo 图标</li>
                      <li>Banner 横幅</li>
                      <li>费率说明（fee.json）</li>
                      <li>支持的交易对列表</li>
                    </ul>

                    <Typography.Paragraph strong style={{ marginTop: 12 }}>2. 私密资料（private_root_cid）</Typography.Paragraph>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>营业执照（加密存储，CID 明文）</li>
                      <li>身份证明文件（加密）</li>
                      <li>资金证明（加密）</li>
                      <li>联系方式（加密）</li>
                      <li>manifest.json（记录加密文件清单）</li>
                    </ul>

                    <Alert type="warning" showIcon style={{ marginTop: 12, fontSize: 12 }} message={
                      <>
                        <strong>CID 规则：</strong>
                        <p style={{ margin: '4px 0 0 0' }}>• CID 一律不加密（明文 IPFS CID）</p>
                        <p style={{ margin: '4px 0 0 0' }}>• 禁止使用 enc: 前缀</p>
                        <p style={{ margin: '4px 0 0 0' }}>• 私密内容使用文件加密，CID 指向密文文件的明文 CID</p>
                      </>
                    } />
                  </div>
                )
              }]}
              style={{ marginBottom: 12 }}
            />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                disabled={!api}
                block
              >
                {loading ? '正在签名...' : '签名质押'}
              </Button>
            </Space>
          </Form>
        </>
      )}

      {/* 步骤 2：提交资料 */}
      {current === 1 && (
        <>
          <Alert 
            type="success" 
            showIcon 
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 12 }} 
            message={
              <div>
                <strong>质押成功！mmId = {mmId !== null ? mmId : '加载中...'}</strong>
                {deadlineSec && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <Tag color="orange">剩余时间：{remainingTime}</Tag>
                    <span style={{ marginLeft: 8 }}>截止时间：{deadlineText}</span>
                  </div>
                )}
              </div>
            }
          />

          {mmId === null && (
            <Alert 
              type="warning" 
              showIcon 
              style={{ marginBottom: 12 }} 
              message="mmId 加载中"
              description="正在从链上获取申请编号，请稍候..."
            />
          )}

          <Form form={form2} layout="vertical" onFinish={onSubmitInfo}>
            <Form.Item 
              label="公开资料根 CID（public_root_cid）" 
              name="public_root_cid" 
              rules={[
                { required: true, message: '请输入公开资料根 CID' }, 
                { validator: (_, v) => isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }
              ]}
              extra="例如 bafy... 格式，包含 mm.json/logo/banner/fee.json 等公开文件"
            >
              <Input.TextArea 
                placeholder="例如 bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" 
                rows={2}
                disabled={loading}
              />
            </Form.Item>

            <Form.Item 
              label="私密资料根 CID（private_root_cid）" 
              name="private_root_cid" 
              rules={[
                { required: true, message: '请输入私密资料根 CID' }, 
                { validator: (_, v) => isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }
              ]}
              extra="例如 bafy... 格式，包含 private.enc/manifest.json 与 *.enc 文件"
            >
              <Input.TextArea 
                placeholder="例如 bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" 
                rows={2}
                disabled={loading}
              />
            </Form.Item>

            <Form.Item 
              label="费率（bps）" 
              name="fee_bps" 
              rules={[
                { required: true, message: '请输入费率' },
                { type: 'number', min: 0, max: 10000, message: '费率范围：0-10000 bps' }
              ]}
              extra="1 bps = 0.01%，例如 25 bps = 0.25%"
            >
              <InputNumber 
                min={0} 
                max={10000} 
                step={1} 
                style={{ width: '100%' }}
                placeholder="例如 25（即 0.25%）"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item 
              label="最小下单额（MEMO）" 
              name="min_amount" 
              rules={[
                { required: true, message: '请输入最小下单额' },
                { type: 'number', min: 0.01, message: '最小下单额必须大于 0' }
              ]}
              extra="用户单笔交易的最小金额限制"
            >
              <InputNumber 
                min={0.01} 
                precision={2} 
                step={10} 
                style={{ width: '100%' }}
                placeholder="例如 100.00"
                disabled={loading}
              />
            </Form.Item>

            <Alert 
              type="warning" 
              showIcon 
              style={{ marginBottom: 12 }} 
              message="CID 检查规则" 
              description={
                <>
                  <p>• CID 一律不加密，必须是有效的 IPFS CID（v0 或 v1）</p>
                  <p>• 私密资料为加密内容文件的明文 CID，禁止使用 enc: 前缀</p>
                  <p>• 提交前请确保 IPFS 网关可以取回文件</p>
                  <p>• 委员会将下载并验证您提交的资料</p>
                </>
              }
            />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                disabled={!api || mmId === null}
                block
                size="large"
              >
                {loading ? '正在签名...' : mmId === null ? 'mmId 加载中...' : '提交资料'}
              </Button>
              <Button 
                onClick={() => setCurrent(0)} 
                disabled={loading}
                block
              >
                返回上一步
              </Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}