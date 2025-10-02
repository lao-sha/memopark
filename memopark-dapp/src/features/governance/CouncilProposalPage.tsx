import React from 'react'
import { Card, Tabs, Typography, Alert, Space } from 'antd'
import { FileTextOutlined, PlusOutlined, CheckOutlined } from '@ant-design/icons'
import CreateProposalForm from './components/CreateProposalForm'
import ProposalList from './components/ProposalList'
import MyVotes from './components/MyVotes'

/**
 * 函数级详细中文注释：委员会提案管理页面
 * - 功能：提交提案、查看提案列表、投票、执行提案
 * - 权限：仅委员会成员可提交提案和投票
 * - 布局：移动端优先，最大宽度 640px 居中
 */
export default function CouncilProposalPage() {
  const [activeTab, setActiveTab] = React.useState<string>('list')

  const items = [
    {
      key: 'list',
      label: (
        <span>
          <FileTextOutlined /> 提案列表
        </span>
      ),
      children: <ProposalList />
    },
    {
      key: 'create',
      label: (
        <span>
          <PlusOutlined /> 提交提案
        </span>
      ),
      children: <CreateProposalForm onSuccess={() => setActiveTab('list')} />
    },
    {
      key: 'votes',
      label: (
        <span>
          <CheckOutlined /> 我的投票
        </span>
      ),
      children: <MyVotes />
    }
  ]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>
      <Card>
        <Typography.Title level={4}>委员会提案管理</Typography.Title>
        
        <Alert
          type="info"
          showIcon
          message="委员会治理"
          description="委员会成员可以提交提案，需要 2/3 多数投票通过后执行。当前支持批准/驳回做市商申请。"
          style={{ marginBottom: 16 }}
        />

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
        />
      </Card>
    </div>
  )
}
