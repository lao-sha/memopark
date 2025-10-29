import { Card, Alert } from 'antd'
import { useParams } from 'react-router-dom'

export default function ProposalDetail() {
  const { id } = useParams()

  return (
    <Card title={`提案详情 #${id}`}>
      <Alert
        message="功能开发中"
        description="提案详情功能正在开发中"
        type="info"
        showIcon
      />
    </Card>
  )
}

