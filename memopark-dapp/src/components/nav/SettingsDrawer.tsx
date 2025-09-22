import React from 'react'
import { Drawer, Space, Switch, Typography } from 'antd'
import { useGovernanceUi } from '../../providers/GovernanceUiProvider'

/**
 * 函数级详细中文注释：设置抽屉（专家/治理模式开关）
 * - 主开关：显示治理入口（对象旁申诉/恢复）
 * - 子开关：仅长按/悬停显示、显示恢复构建器快捷入口
 */
const SettingsDrawer: React.FC = () => {
  const [open, setOpen] = React.useState(false)
  const gov = useGovernanceUi()
  React.useEffect(()=>{
    const onOpen = () => setOpen(true)
    window.addEventListener('mp.openSettings', onOpen)
    return () => window.removeEventListener('mp.openSettings', onOpen)
  }, [])
  return (
    <Drawer open={open} onClose={()=> setOpen(false)} title="设置" placement="right" width={320}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Typography.Text>显示治理入口（申诉/恢复）</Typography.Text>
          <Switch checked={gov.showEntries} onChange={gov.setShowEntries} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Typography.Text>仅长按/悬停时显示入口</Typography.Text>
          <Switch checked={gov.hoverOnly} onChange={gov.setHoverOnly} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Typography.Text>显示“恢复旧版本构建器”快捷入口</Typography.Text>
          <Switch checked={gov.showRestoreShortcut} onChange={gov.setShowRestoreShortcut} />
        </div>
      </Space>
    </Drawer>
  )
}

export default SettingsDrawer
