import React, { useState } from 'react'
import { Button, Form, Input, Upload, Row, Col, Switch, Typography, Checkbox, message, Alert, Space, Modal } from 'antd'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { UploadOutlined, CloseOutlined, EllipsisOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：创建纪念馆（移动端高保真）
 * - 结构：顶部标题栏、头像上传、基础信息（姓名/生日/逝世日）、证明材料上传、协议勾选、底部大号提交按钮。
 * - 安全：仅前端占位，不上传真实隐私；后续接入后台/链上前请做脱敏与加密。
 */
const CreateMemorialForm: React.FC = () => {
  const [form] = Form.useForm()

  /**
   * 函数级详细中文注释：提交处理
   * - 当前占位：提示成功并打印参数。
   */
  const onFinish = async (values: any) => {
    try {
      const owner = values.owner?.trim()
      if (!owner) throw new Error('请输入你的地址(owner)')
      // 1) 可选：先创建 deceased（此处省略，保留扩展点）
      // 2) 直接创建 Hall(kind=Person=0)
      const meta = new TextEncoder().encode(JSON.stringify({ name: values.name || '' }))
      const api = await getApi()
      const cid = Array.from(meta) // 简化演示：直接用 JSON bytes；实际应使用 IPFS CID 字节
      const args = [ Number(values.park_id || 0), 0, 1, cid ]
      const txHash = await signAndSendLocalFromKeystore('memoGrave', 'createHall', args)
      message.success(`已上链：${txHash}`)
      form.resetFields()
    } catch (e: any) {
      // 函数级详细中文注释：捕获并识别来自链上的模块错误（尤其是 DeceasedTokenExists），给出引导。
      const errText = String(e?.message || e || '')
      const isDeceasedTokenExists = /DeceasedTokenExists/i.test(errText)
      const isOwnerImmutable = /OwnerImmutable/i.test(errText)
      if (isDeceasedTokenExists) {
        Modal.confirm({
          title: '该逝者已存在',
          content: '是否申请加入亲友团（族谱关系）或关注该逝者？也可联系墓主发起迁移到你的墓位。',
          okText: '申请加入亲友团',
          cancelText: '关闭',
          onOk: () => {
            try {
              window.location.hash = '#grave/relation-proposal'
              window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'grave-relation' } }))
            } catch {}
          },
        })
      } else if (isOwnerImmutable) {
        Modal.info({
          title: '所有权不可更换',
          content: '所有权不可更换，如需协作，请申请加入亲友团或联系墓主进行迁移。',
          okText: '我知道了',
        })
      } else {
        message.error(e?.message || '提交失败')
      }
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left', paddingBottom: 96 }}>
      {/* 顶部标题栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CloseOutlined style={{ fontSize: 18, color: '#333' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>创建纪念馆</Typography.Title>
          <EllipsisOutlined style={{ fontSize: 20, color: '#333' }} />
        </div>
      </div>

      {/* 头像上传 */}
      <div style={{ textAlign: 'center', padding: '16px 0', background: 'linear-gradient(180deg,#FFF6ED, #FFFFFF)' }}>
        <div style={{ width: 120, height: 160, margin: '0 auto 8px', borderRadius: 12, border: '1px dashed #f0a05f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0a05f' }}>
          点击上传头像
        </div>
      </div>

      {/* 表单主体 */}
      <div style={{ padding: 12 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ solar_birth: true, solar_death: true, agree: true }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="将创建纪念馆(Hall)，支持平台代付（可选）" />
            <Alert type="warning" showIcon message="重要提示：逝者一经创建不可删除。若需调整，请使用“迁移至新墓位(transfer_deceased)”或加入亲友团（通过逝者关系功能）。" />
          </Space>
          <Form.Item name="owner" label="你的地址(owner)" rules={[{ required: true }]}>
            <Input placeholder="5F..." size="large" />
          </Form.Item>
          <Form.Item name="park_id" label="园区ID(可选)" >
            <Input placeholder="无则留空或填0" size="large" />
          </Form.Item>
          <Form.Item name="name" label="逝者姓名" rules={[{ required: true, message: '请填写姓名' }]}>
            <Input size="large" placeholder="请输入" />
          </Form.Item>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item label="出生日期">
                <Row gutter={8}>
                  <Col span={10}><Switch checkedChildren="公历" unCheckedChildren="农历" defaultChecked /></Col>
                  <Col span={14}><Input placeholder="YYYY-MM-DD" /></Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="逝世日期">
                <Row gutter={8}>
                  <Col span={10}><Switch checkedChildren="公历" unCheckedChildren="农历" defaultChecked /></Col>
                  <Col span={14}><Input placeholder="YYYY-MM-DD" /></Col>
                </Row>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="逝者证明" extra="请上传逝者的身份证明或死亡证明">
            <Upload beforeUpload={() => false} multiple>
              <Button icon={<UploadOutlined />}>上传证明</Button>
            </Upload>
          </Form.Item>

          {/* 手机号/验证码已按需求移除 */}

          <Form.Item name="agree" valuePropName="checked">
            <Checkbox>阅读并同意《平台服务协议》</Checkbox>
          </Form.Item>

          {/* 底部固定提交 */}
          <Form.Item noStyle>
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #eee', padding: '8px 12px 16px', zIndex: 1000 }}>
              <Button type="primary" htmlType="submit" block size="large" style={{ background: '#f09a3e', borderColor: '#f09a3e' }}>快速建馆</Button>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default CreateMemorialForm


