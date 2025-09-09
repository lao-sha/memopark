import React, { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Row, Col, Select, Switch, Typography, message, Space, Tag } from 'antd'
import { signAndSend } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：创建挂单（移动端高保真）
 * - 页面结构：顶部标题栏（关闭/标题/更多）+ 顶部提示 + 表单主体 + 底部固定提交按钮。
 * - 表单字段：对应 otc-listing::create_listing（side/base/quote/price/min_qty/max_qty/total/partial/expire_at/terms_commit）。
 * - 交互与兼容：单列优先，小字段按两列栅格排布；底部固定 CTA 便于拇指操作；预留与 forwarder 元交易代付集成入口。
 */
const CreateListingForm: React.FC = () => {
  const wallet = useWallet()
  const [form] = Form.useForm()
  const [consts, setConsts] = useState<{ requireKyc?: boolean; createWindow?: number; createMax?: number; listingFee?: string; listingBond?: string } | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const api = await getApi()
        const requireKyc = (api.consts as any).otcListing?.requireKyc as boolean
        const createWindow = Number((api.consts as any).otcListing?.createWindow || 0)
        const createMax = Number((api.consts as any).otcListing?.createMaxInWindow || 0)
        const listingFee = ((api.consts as any).otcListing?.listingFee || 0n).toString()
        const listingBond = ((api.consts as any).otcListing?.listingBond || 0n).toString()
        setConsts({ requireKyc, createWindow, createMax, listingFee, listingBond })
      } catch {}
    })()
  }, [])

  /**
   * 函数级详细中文注释：表单提交处理
   * - 占位实现：先通知成功与打印参数；后续接入 @polkadot/api + forwarder.forward 代付。
   */
  const onFinish = async (values: any) => {
    try {
      // 前端操作方法：
      // - 直发：使用浏览器扩展签名执行 memoOtcListing.createListing
      // - 代付：可复用 forwarder 元交易工具（此处默认直发）
      const owner = values.owner?.trim() || wallet.current
      if (!owner) throw new Error('请输入你的地址(owner) 或连接钱包')
      // 基本前端校验：每笔最小/最大数量与总量关系
      if (Number(values.min_qty) <= 0 || Number(values.max_qty) <= 0) throw new Error('每笔数量上下限需大于 0')
      if (Number(values.min_qty) > Number(values.max_qty)) throw new Error('每笔最小数量不能大于最大数量')
      if (Number(values.total) < Number(values.min_qty)) throw new Error('总量不能小于每笔最小数量')

      const args = [
        Number(values.side),
        Number(values.base),
        Number(values.quote),
        BigInt(values.price),
        BigInt(values.min_qty),
        BigInt(values.max_qty),
        BigInt(values.total),
        Boolean(values.partial),
        Number(values.expire_at),
        null,
      ]
      const txHash = await wallet.signAndSendLocal('otcListing', 'createListing', args)
      message.success(`已上链：${txHash}`)
      form.resetFields()
    } catch (e: any) {
      message.error(e?.message || '提交失败')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 88 }}>
      {/* 顶部标题栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>创建挂单</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      {/* 顶部提示 */}
      <div style={{ padding: '8px 8px 0' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="info" showIcon message="由平台代付 Gas（forwarder）" />
          {consts && (
            <Alert
              type="warning"
              showIcon
              message={<span>
                KYC{consts.requireKyc ? '已启用' : '未启用'}；创建限频窗口 {consts.createWindow} 块，最多 {consts.createMax} 次；
                上架费 {consts.listingFee}，保证金 {consts.listingBond}
              </span>}
            />
          )}
        </Space>
      </div>

      {/* 表单主体 */}
      <div style={{ padding: 8 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ side: 0, partial: true }}>
          <Form.Item name="owner" label="你的地址(owner)" rules={[{ required: true }]}>
            <Input placeholder="5F..." size="large" />
          </Form.Item>
          <Form.Item name="side" label="方向(买=0/卖=1)" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '买入(0)', value: 0 },
                { label: '卖出(1)', value: 1 },
              ]}
              size="large"
            />
          </Form.Item>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="base" label="基础资产(base, u32)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quote" label="计价资产(quote, u32)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="price" label="价格(price)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="min_qty" label="最小数量(min_qty)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_qty" label="最大数量(max_qty)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="total" label="总量(total)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="partial" valuePropName="checked" label="允许部分成交(partial)">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expire_at" label="过期区块高度(expire_at)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="terms_commit" label="条款承诺(可选, Bytes/Hex)">
            <Input placeholder="可填加密 CID 的 hex 承诺" size="large" />
          </Form.Item>

          {/* 底部固定提交按钮（放在表单内部，便于触发校验/提交） */}
          <Form.Item noStyle>
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #eee', padding: '8px 12px 16px', zIndex: 1000 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" htmlType="submit" block size="large">直发提交</Button>
                <Button onClick={()=>{
                  form.validateFields().then(async (values:any)=>{
                    const owner = values.owner?.trim() || wallet.current
                    if(!owner) throw new Error('请输入你的地址(owner) 或连接钱包')
                    const args = [
                      Number(values.side), Number(values.base), Number(values.quote), BigInt(values.price), BigInt(values.min_qty), BigInt(values.max_qty), BigInt(values.total), Boolean(values.partial), Number(values.expire_at), null
                    ]
                    const hash = await wallet.sendViaForwarder('otcListing' as any, 'otcListing', 'createListing', args)
                    message.success(`已提交代付：${hash}`)
                  }).catch(()=>{})
                }} block size="large">代付提交</Button>
              </Space>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default CreateListingForm


