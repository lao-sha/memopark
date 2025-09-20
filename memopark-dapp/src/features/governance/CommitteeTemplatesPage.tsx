import React from 'react'
import { Card, List, Button, Space, Typography, Alert, message } from 'antd'

/**
 * 函数级详细中文注释：委员会审批模板页
 * - 封装常用的 domain/action 组合与说明，便于快速选择
 * - 提供“复制”与“去申诉页”入口（申诉页当前不支持自动填充，需手动粘贴）
 */
const templates: Array<{ key: string; domain: number; action: number; title: string; targetHint: string; desc: string }>= [
  { key: 'grave-transfer', domain: 1, action: 11, title: '墓地：强制转让', targetHint: 'target=墓地ID', desc: '将墓地所有权转移给指定账户（需另在动议里指定新 owner）' },
  { key: 'grave-restrict', domain: 1, action: 12, title: '墓地：设置限制', targetHint: 'target=墓地ID', desc: 'Moderation.restricted=true（临时下线或等待整改）' },
  { key: 'grave-remove', domain: 1, action: 13, title: '墓地：软删除', targetHint: 'target=墓地ID', desc: 'removed=true, restricted=true（严重违规下线）' },
  { key: 'grave-restore', domain: 1, action: 14, title: '墓地：恢复展示', targetHint: 'target=墓地ID', desc: '撤销 removed/restricted，恢复展示' },
  { key: 'deceased-visible', domain: 2, action: 1, title: '逝者：设为可见', targetHint: 'target=逝者ID', desc: '将 Visibility 设为 true' },
  { key: 'deceased-clear-avatar', domain: 2, action: 2, title: '逝者：清空主图', targetHint: 'target=逝者ID', desc: '清空逝者主图 CID' },
  { key: 'text-remove-eulogy', domain: 3, action: 20, title: '文本：移除悼词', targetHint: 'target=文本ID', desc: '治理移除悼词（押金成熟后可退）' },
  { key: 'text-remove', domain: 3, action: 21, title: '文本：强制删除', targetHint: 'target=文本ID', desc: '删除 Message/Article（押金成熟后可退）' },
  { key: 'media-hide', domain: 4, action: 30, title: '媒体：隐藏', targetHint: 'target=媒体ID', desc: '设置媒体隐藏（照片会联动清空逝者主图/相册封面）' },
  { key: 'media-replace-uri', domain: 4, action: 31, title: '媒体：替换URI', targetHint: 'target=媒体ID', desc: '替换媒体 URI（涉敏打码）' },
  { key: 'media-freeze-video', domain: 4, action: 32, title: '视频集：冻结', targetHint: 'target=视频集ID', desc: '冻结视频集，禁止写操作' },
  { key: 'park-transfer', domain: 5, action: 40, title: '园区：转让园区', targetHint: 'target=园区ID', desc: '转让园区所有权（需指定新 owner）' },
  { key: 'park-cover', domain: 5, action: 41, title: '园区：设置封面(事件化)', targetHint: 'target=园区ID', desc: '事件化设置封面 CID（不落存储）' },
  { key: 'offerings-pause', domain: 6, action: 50, title: '供奉：按域暂停', targetHint: 'target=域编码(低8位)', desc: '暂停指定域的供奉（示例 domain=1=墓地）' },
  { key: 'offerings-enable', domain: 6, action: 51, title: '供奉：上/下架模板', targetHint: 'target=kind_code(低8位)', desc: '上/下架供奉模板（当前路由示例固定启用）' },
]

const CommitteeTemplatesPage: React.FC = () => {
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); message.success('已复制到剪贴板') } catch { message.info(text) }
  }
  const goAppeal = () => { try { window.location.hash = '#/gov/appeal' } catch {} }
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Title level={4} style={{ margin: 0 }}>审批模板</Typography.Title>
        <Alert type="info" showIcon message="选择常用动作，复制 domain/action/target 提示后，在“提交申诉”页填写即可。" />
        <Card>
          <List
            itemLayout="vertical"
            dataSource={templates}
            renderItem={(it) => (
              <List.Item key={it.key} actions={[
                <Button size="small" onClick={() => copy(`${it.domain},${it.action}`)}>复制 domain,action</Button>,
                <Button size="small" type="primary" onClick={goAppeal}>去申诉页</Button>
              ]}>
                <List.Item.Meta title={`${it.title}（domain=${it.domain}, action=${it.action}）`} description={it.targetHint} />
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{it.desc}</Typography.Paragraph>
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </div>
  )
}

export default CommitteeTemplatesPage
