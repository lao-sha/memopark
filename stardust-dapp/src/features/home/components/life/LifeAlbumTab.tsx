import React from 'react'
import { Row, Col, Card, Typography, Space, Input, Button, message } from 'antd'
import { submitPinForDeceased } from '../../../../lib/ipfs-billing'

/**
 * 函数级详细中文注释：生平故事 - 二级页面「回忆相册」Tab
 * - 展示相册占位图；底部提供一个“提交 CID 进入计费”的小表单，演示统一扣费入口
 * - 实际项目中应在“上传成功/保存成功”后自动调用该接口
 */
const images: string[] = [
  'https://picsum.photos/seed/memo0/600/600',
  'https://picsum.photos/seed/memo1/600/600',
  'https://picsum.photos/seed/memo2/600/600',
  'https://picsum.photos/seed/memo3/900/600',
]

const LifeAlbumTab: React.FC = () => {
  const [subjectId, setSubjectId] = React.useState<string>('')
  const [cid, setCid] = React.useState<string>('')
  const [submitting, setSubmitting] = React.useState(false)

  const onSubmit = async () => {
    try {
      const sid = Number(subjectId)
      if (!sid) return message.warning('请输入有效的 subject_id')
      const c = cid.trim()
      if (!c) return message.warning('请输入 CID')
      setSubmitting(true)
      const tx = await submitPinForDeceased(sid, c, 0, 1, '0')
      message.success(`已提交 Pin 请求：${tx}`)
      setCid('')
    } catch (e:any) { message.error(e?.message || '提交失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ padding: '0 8px' }}>
      <Row gutter={[12, 12]}>
        {images.slice(0, 3).map((src, idx) => (
          <Col span={8} key={idx}>
            <Card
              hoverable
              cover={<img src={src} style={{ height: 110, objectFit: 'cover' }} />}
              bodyStyle={{ display: 'none' }}
              style={{ borderRadius: 12 }}
            />
          </Col>
        ))}
      </Row>
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24}>
          <Card
            hoverable
            cover={<img src={images[3]} style={{ height: 160, objectFit: 'cover' }} />}
            bodyStyle={{ display: 'none' }}
            style={{ borderRadius: 12 }}
          />
        </Col>
      </Row>
      <Typography.Paragraph style={{ textAlign: 'center', color: '#A0A0A0', marginTop: 24 }}>
        没有更多数据了
      </Typography.Paragraph>

      <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 12 }}>
        <Typography.Text strong>提交 CID 进入计费（示例）</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="subject_id" value={subjectId} onChange={e=> setSubjectId(e.target.value)} style={{ width: 120 }} />
            <Input placeholder="CID 明文" value={cid} onChange={e=> setCid(e.target.value)} />
            <Button type="primary" loading={submitting} onClick={onSubmit}>提交</Button>
          </Space.Compact>
          <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>统一从 (domain=1, subject_id) 主题资金账户扣费</div>
        </div>
      </div>
    </div>
  )
}

export default LifeAlbumTab


