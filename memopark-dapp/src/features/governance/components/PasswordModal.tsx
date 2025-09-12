import React, { useState, useEffect } from 'react'
import { Modal, Input } from 'antd'

/**
 * 函数级详细中文注释：密码输入弹窗组件
 * - 用于在提交投票/提案/解锁前采集本地钱包密码（≥8位）
 * - onOk 返回密码字符串；内部做最小校验并给出错误提示
 */
interface Props {
  open: boolean
  title?: string
  message?: string
  onOk: (password: string) => void
  onCancel: () => void
}

const PasswordModal: React.FC<Props> = ({ open, title = '输入钱包密码', message, onOk, onCancel }) => {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setPwd(''); setError(null) }
  }, [open])

  function handleOk() {
    if (!pwd || pwd.length < 8) { setError('密码至少 8 位'); return }
    setError(null)
    onOk(pwd)
  }

  return (
    <Modal open={open} title={title} onOk={handleOk} onCancel={onCancel} okText="确认" cancelText="取消" centered>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {message && <div style={{ fontSize: 12, color: '#b45309', background: '#fff7ed', border: '1px solid #fde68a', padding: 8, borderRadius: 6 }}>{message}</div>}
        <Input.Password value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="请输入至少 8 位密码" />
        {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      </div>
    </Modal>
  )
}

export default PasswordModal


