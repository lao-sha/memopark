import React from 'react'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { useGovernanceUi } from '../../providers/GovernanceUiProvider'

/**
 * 函数级详细中文注释：治理入口按钮（对象旁的小图标）
 * - 读取 GovernanceUi 开关决定是否显示
 * - 支持 hoverOnly/长按触发显示
 * - 点击跳转到申诉创建页并自动预填 domain/target/action
 */
const AppealEntry: React.FC<{ domain: number; targetId: number; actionHint?: string; referrer?: string }> = ({ domain, targetId, actionHint, referrer }) => {
  const gov = useGovernanceUi()
  const [visible, setVisible] = React.useState(!gov.hoverOnly)
  React.useEffect(()=>{ setVisible(!gov.hoverOnly) }, [gov.hoverOnly])
  if (!gov.showEntries) return null

  const onClick = () => {
    const params = new URLSearchParams()
    params.set('domain', String(domain))
    params.set('target', String(targetId))
    if (actionHint) params.set('action', actionHint)
    if (referrer) params.set('ref', referrer)
    try { window.location.hash = `#/gov/appeal?${params.toString()}` } catch {}
  }

  const triggerProps = gov.hoverOnly ? {
    onMouseEnter: ()=> setVisible(true),
    onMouseLeave: ()=> setVisible(false),
    onTouchStart: ()=> setVisible(true),
    onTouchEnd: ()=> setVisible(false),
  } : {}

  return (
    <span {...triggerProps} style={{ display: 'inline-flex', marginLeft: 6 }}>
      {visible && (
        <Tooltip title="发起申诉">
          <button onClick={onClick} aria-label="申诉" style={{
            width: 24, height: 24, borderRadius: 12, border: '1px solid #eee', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          </button>
        </Tooltip>
      )}
    </span>
  )
}

export default AppealEntry
