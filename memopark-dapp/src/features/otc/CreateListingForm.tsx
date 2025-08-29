import React from 'react'
import { Alert, Button, Form, Input, InputNumber, Row, Col, Select, Switch, Typography, message } from 'antd'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：创建挂单（移动端高保真）
 * - 页面结构：顶部标题栏（关闭/标题/更多）+ 顶部提示 + 表单主体 + 底部固定提交按钮。
 * - 表单字段：对应 otc-listing::create_listing（side/base/quote/price/min_qty/max_qty/total/partial/expire_at/terms_commit）。
 * - 交互与兼容：单列优先，小字段按两列栅格排布；底部固定 CTA 便于拇指操作；预留与 forwarder 元交易代付集成入口。
 */
const CreateListingForm: React.FC = () => {
  const [form] = Form.useForm()

  /**
   * 函数级详细中文注释：表单提交处理
   * - 占位实现：先通知成功与打印参数；后续接入 @polkadot/api + forwarder.forward 代付。
   */
  const onFinish = async (values: any) => {
    try {
      // 这里后续接入：构造 RuntimeCall → MetaTx → forwarder.forward 由平台代付
      // 占位提示
      message.success('挂单提交成功（占位）')
      console.log('CreateListing values:', values)
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
        <Alert type="info" showIcon message="由平台代付 Gas（forwarder）" />
      </div>

      {/* 表单主体 */}
      <div style={{ padding: 8 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ side: 0, partial: true }}>
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
              <Button type="primary" htmlType="submit" block size="large">提交挂单</Button>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default CreateListingForm


