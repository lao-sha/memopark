import React from 'react'
import { Card, Button, Space, Alert, Typography } from 'antd'

/**
 * 函数级详细中文注释：内容委员会页面（动议/投票占位，移动端优先）
 * - 展示 ContentCommittee（collective Instance3）说明、进入动议/投票入口（后续接入链上数据）
 * - 当前提供最小可运行骨架与路由承载，便于逐步完善
 */
const ContentCommitteePage: React.FC = () => {
  const goAppeal = () => { try { window.location.hash = '#/gov/appeal' } catch {} }
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Title level={4} style={{ margin: 0 }}>内容委员会</Typography.Title>
        <Alert showIcon type="info" message="该页面用于发起/查看内容委员会动议与投票（Instance3）。后续将接入链上数据与签名流程。" />
        <Card title="提交申诉" size="small" extra={<Button type="primary" onClick={goAppeal}>去提交</Button>}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            任何账户均可提交内容申诉（押金+公示期）。委员会通过后将按路由执行强制动作。
          </Typography.Paragraph>
        </Card>
        <Card title="发起动议" size="small" extra={<Button type="primary" disabled>发起（占位）</Button>}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            说明：未来支持创建动议、上传预映像、设置阈值等。当前为占位，不提交交易。
          </Typography.Paragraph>
        </Card>
        <Card title="投票列表" size="small" extra={<Button disabled>刷新（占位）</Button>}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            说明：未来展示进行中/已通过/已拒绝的内容委员会动议，可在此投票。
          </Typography.Paragraph>
        </Card>
      </Space>
    </div>
  )
}

export default ContentCommitteePage
