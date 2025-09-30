import React from 'react'
import { Card, Steps, Form, Input, InputNumber, Button, Space, Typography, Alert, Divider, message } from 'antd'

/**
 * 函数级详细中文注释：做市商申请（两步式：先质押 → 再提交资料）
 * 设计目标：
 * 1）先质押 MEMO，生成临时 mmId（链上应由 extrinsic 返回）；
 * 2）在有效期内提交资料（公开 CID、私密 CID、费率与交易对参数等）；
 * 3）本组件仅提供前端最小闭环骨架与校验逻辑，不依赖浏览器扩展，链上调用位置预留。
 * 4）CID 检查遵循项目规则：CID 一律不加密（明文 CID）；私密内容加密，但 CID 指向密文文件的明文 CID。
 */
export default function CreateMarketMakerPage() {
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [current, setCurrent] = React.useState<number>(0)
  const [error, setError] = React.useState<string>('')
  const [mmId, setMmId] = React.useState<string>('')
  const [deadlineSec, setDeadlineSec] = React.useState<number>(0)

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
   * 函数级详细中文注释：提交质押（链上调用占位）
   * - 实际应签名调用 pallet-market-maker::lock_deposit(amount)
   * - 这里生成本地临时 mmId 与截止时间，模拟链上返回，便于联调后续表单
   */
  const onDeposit = async (values: any) => {
    setError('')
    try {
      const amount = Number(values.deposit_amount)
      if (!amount || amount <= 0) throw new Error('请输入有效的质押金额')
      // 占位：模拟链上返回的 mmId 与 24 小时提交窗口
      const now = Math.floor(Date.now() / 1000)
      const fakeId = `mm-${now}-${Math.floor(Math.random() * 1000)}`
      setMmId(fakeId)
      setDeadlineSec(now + 24 * 3600)
      message.success('质押提交成功（占位），请继续提交资料')
      setCurrent(1)
    } catch (e: any) {
      setError(e?.message || '质押失败')
    }
  }

  /**
   * 函数级详细中文注释：提交资料（链上调用占位）
   * - 实际应签名调用 pallet-market-maker::submit_info(mm_id, public_root_cid, private_root_cid, ...)
   * - 仅做本地校验：CID 合法、费率/最小额有效，符合“CID 不加密”与“内容加密但 CID 明文”的规则
   */
  const onSubmitInfo = async (values: any) => {
    setError('')
    try {
      if (!mmId) throw new Error('请先完成质押步骤')
      const { public_root_cid, private_root_cid, fee_bps, min_amount } = values
      if (!isValidCid(public_root_cid)) throw new Error('公开资料 CID 非法或疑似加密（禁止 enc: 前缀）')
      if (!isValidCid(private_root_cid)) throw new Error('私密资料根 CID 非法或疑似加密（禁止 enc: 前缀）')
      const fee = Number(fee_bps)
      if (!(fee >= 0 && fee <= 10000)) throw new Error('费率 bps 超出范围（0~10000）')
      const minAmt = Number(min_amount)
      if (!(minAmt > 0)) throw new Error('最小下单额必须大于 0')
      message.success('资料提交成功（占位），状态：待委员会审核')
    } catch (e: any) {
      setError(e?.message || '提交资料失败')
    }
  }

  const deadlineText = React.useMemo(() => {
    if (!deadlineSec) return ''
    const d = new Date(deadlineSec * 1000)
    return d.toLocaleString()
  }, [deadlineSec])

  return (
    <Card style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={5}>做市商申请（两步式：先质押 → 再提交资料）</Typography.Title>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <Steps size="small" current={current} items={[
        { title: '质押保证金' },
        { title: '提交资料（待审）' },
      ]} />

      <Divider />

      {current === 0 && (
        <Form form={form1} layout="vertical" onFinish={onDeposit} initialValues={{ deposit_amount: 1000 }}>
          <Form.Item label="质押金额（MEMO）" name="deposit_amount" rules={[{ required: true, message: '请输入质押金额' }]}> 
            <InputNumber min={1} precision={2} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message="说明" description="完成质押后，将获得 24 小时提交资料窗口；逾期系统可自动撤回或按规则扣除处理费。" />
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" htmlType="submit" block>签名质押（占位）</Button>
          </Space>
        </Form>
      )}

      {current === 1 && (
        <>
          <Alert type="success" showIcon style={{ marginBottom: 12 }} message={`已质押，mmId=${mmId}`} description={deadlineSec ? `请在 ${deadlineText} 前完成资料提交` : undefined} />
          <Form form={form2} layout="vertical" onFinish={onSubmitInfo}>
            <Form.Item label="公开资料根 CID（public_root_cid）" name="public_root_cid" rules={[{ required: true, message: '请输入公开资料根 CID' }, { validator: (_, v) => isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }]}>
              <Input placeholder="例如 bafy...（mm.json/logo/banner/fee.json 等公开文件根目录 CID）" />
            </Form.Item>
            <Form.Item label="私密资料根 CID（private_root_cid）" name="private_root_cid" rules={[{ required: true, message: '请输入私密资料根 CID' }, { validator: (_, v) => isValidCid(v) ? Promise.resolve() : Promise.reject(new Error('CID 非法或疑似加密')) }]}>
              <Input placeholder="例如 bafy...（private.enc/manifest.json 与 *.enc 文件所在根目录 CID）" />
            </Form.Item>
            <Form.Item label="费率（bps）" name="fee_bps" rules={[{ required: true, message: '请输入费率' }]}>
              <InputNumber min={0} max={10000} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="最小下单额（MEMO）" name="min_amount" rules={[{ required: true, message: '请输入最小下单额' }]}>
              <InputNumber min={0.01} precision={2} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="CID 检查规则" description="CID 一律不加密；私密资料为加密内容文件的明文 CID，禁止使用 enc: 前缀；提交前请确保网关可取回。" />
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit" block>提交资料（占位）</Button>
              <Button onClick={() => setCurrent(0)} block>返回上一步</Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}


