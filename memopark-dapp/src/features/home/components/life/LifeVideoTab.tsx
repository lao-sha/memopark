import React, { useState } from 'react'
import { Typography, Space, Input, Button, message } from 'antd'
import { PlayCircleFilled } from '@ant-design/icons'
import { submitPinForDeceased } from '../../../../lib/ipfs-billing'

/**
 * 函数级详细中文注释：生平故事 - 二级页面「纪念视频」Tab
 * - 展示一个主打纪念视频；底部提供“提交 CID 进入计费”的示例表单
 * - 实际项目中应在视频保存/上传成功后自动调用该接口
 */
const LifeVideoTab: React.FC = () => {
  const [playing, setPlaying] = useState<boolean>(false)
  const [subjectId, setSubjectId] = useState<string>('')
  const [cid, setCid] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // 占位视频数据（可替换为真实资源）
  const cover = 'https://picsum.photos/seed/video81192/800/450'
  const title = '王伟牺牲20周年！ 你若记得81192，他便不悔…'
  const src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

  const onSubmit = async () => {
    try {
      const sid = Number(subjectId)
      if (!sid) return message.warning('请输入有效的 subject_id')
      const c = cid.trim(); if (!c) return message.warning('请输入 CID')
      setSubmitting(true)
      const tx = await submitPinForDeceased(sid, c, 0, 1, '0')
      message.success(`已提交 Pin 请求：${tx}`)
      setCid('')
    } catch (e:any) { message.error(e?.message || '提交失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ margin: '8px', background: '#fff', borderRadius: 12, padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>纪念视频</Typography.Title>
      <div style={{ position: 'relative', marginTop: 12, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        {playing ? (
          <video src={src} controls autoPlay style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div onClick={() => setPlaying(true)} style={{ cursor: 'pointer' }}>
            <img src={cover} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
            <PlayCircleFilled style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 64, color: 'rgba(255,255,255,0.95)' }} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, color: '#333' }}>{title}</div>
      <Typography.Paragraph style={{ textAlign: 'center', color: '#A0A0A0', marginTop: 24 }}>
        没有更多数据了
      </Typography.Paragraph>

      <div style={{ marginTop: 8 }}>
        <Typography.Text strong>提交 CID 进入计费（示例）</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="subject_id" value={subjectId} onChange={e=> setSubjectId(e.target.value)} style={{ width: 120 }} />
            <Input placeholder="CID 明文" value={cid} onChange={e=> setCid(e.target.value)} />
            <Button type="primary" onClick={onSubmit} loading={submitting}>提交</Button>
          </Space.Compact>
          <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>统一从 (domain=1, subject_id) 主题资金账户扣费</div>
        </div>
      </div>
    </div>
  )
}

export default LifeVideoTab


