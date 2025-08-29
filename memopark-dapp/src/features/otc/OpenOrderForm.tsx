import React from 'react'
import { Alert, Button, Form, Input, InputNumber, Row, Col, Typography, message } from 'antd'
import { CloseOutlined, EllipsisOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：吃单下单（移动端高保真）
 * - 页面结构：顶部标题栏 + 顶部提示 + 表单主体 + 底部固定提交按钮。
 * - 字段映射：otc-order::open_order（listing_id/price/qty/amount/payment_commit/contact_commit）。
 * - 交互：单列优先，小字段并列；底部固定 CTA 便于拇指操作。
 */
const OpenOrderForm: React.FC = () => {
  const [form] = Form.useForm()

  /**
   * 函数级详细中文注释：表单提交处理（占位）
   * - 未来：构造 RuntimeCall → MetaTx → forwarder.forward（平台代付）
   */
  const onFinish = async (values: any) => {
    try {
      message.success('创建订单成功（占位）')
      console.log('OpenOrder values:', values)
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
          <Typography.Title level={4} style={{ margin: 0 }}>吃单下单</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      {/* 顶部提示 */}
      <div style={{ padding: '8px 8px 0' }}>
        <Alert type="info" showIcon message="由平台代付 Gas（forwarder）" />
      </div>

      {/* 表单主体 */}
      <div style={{ padding: 8 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="listing_id" label="挂单ID(listing_id)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="price" label="价格(price)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="qty" label="数量(qty)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="amount" label="总价(amount)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Form.Item name="payment_commit" label="支付承诺(H256 hex)" rules={[{ required: true }]}>
            <Input placeholder="0x..." size="large" />
          </Form.Item>
          <Form.Item name="contact_commit" label="联系方式承诺(H256 hex)" rules={[{ required: true }]}>
            <Input placeholder="0x..." size="large" />
          </Form.Item>

          {/* 底部固定提交按钮 */}
          <Form.Item noStyle>
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #eee', padding: '8px 12px 16px', zIndex: 1000 }}>
              <Button type="primary" htmlType="submit" block size="large">提交订单</Button>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default OpenOrderForm


