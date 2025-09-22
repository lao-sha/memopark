import React from 'react'
import { SettingOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：右上角齿轮按钮（悬浮）
 * - 点击后发出全局事件 `mp.openSettings`
 * - 移动端优先，放置右上角，不遮挡主 CTA
 */
const SettingsButton: React.FC = () => {
  const onClick = () => { try { window.dispatchEvent(new Event('mp.openSettings')) } catch {} }
  return (
    <button onClick={onClick} aria-label="设置" style={{
      position: 'fixed', right: 12, top: 12, zIndex: 1000,
      width: 36, height: 36, borderRadius: 18, border: '1px solid #eee', background: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      <SettingOutlined />
    </button>
  )
}

export default SettingsButton
