import React, { useCallback, useState } from 'react'
import { Button, Flex, Modal, Form, InputNumber, message, Typography } from 'antd'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { mapDispatchErrorMessage } from '../../lib/errors'
import TransactionConfirmModal, { type TransactionInfo } from '../../components/transaction/TransactionConfirmModal'
import OfferingCardSelector, { OFFERINGS, type OfferingItem } from '../../components/offering/OfferingCardSelector'

/**
 * 函数级详细中文注释：纪念馆动作栏（供奉/扫墓）重构版
 * - 使用新的TransactionConfirmModal替代window.prompt
 * - 使用卡片式供品选择器替代下拉框
 * - 优化交互流程和视觉呈现
 */
export default function ActionsBar({ graveId }: { graveId: number }) {
  const [openOffer, setOpenOffer] = useState(false)
  const [selectedOffering, setSelectedOffering] = useState<OfferingItem | null>(null)
  const [duration, setDuration] = useState<number>(1)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [pendingTx, setPendingTx] = useState<TransactionInfo | null>(null)
  const [confirmHandler, setConfirmHandler] = useState<((pwd: string) => Promise<string>) | null>(null)

  /**
   * 打开供奉选择Modal
   */
  const handleOpenOffer = () => {
    setOpenOffer(true)
    setSelectedOffering(null)
    setDuration(1)
    setCustomAmount('')
  }

  /**
   * 选择供品
   */
  const handleSelectOffering = (item: OfferingItem) => {
    setSelectedOffering(item)
  }

  /**
   * 计算总金额
   */
  const calculateAmount = (): string => {
    if (!selectedOffering) return '0'
    if (selectedOffering.id === 19) {
      // 自定义供品
      return customAmount || '0'
    }
    if (selectedOffering.duration) {
      return String(selectedOffering.price * duration)
    }
    return String(selectedOffering.price)
  }

  /**
   * 确认供奉
   */
  const handleConfirmOffer = () => {
    if (!selectedOffering) {
      message.warning('请选择供品')
      return
    }

    if (selectedOffering.id === 19 && (!customAmount || Number(customAmount) <= 0)) {
      message.warning('请输入自定义金额')
      return
    }

    const amount = calculateAmount()
    const amountBigInt = BigInt(Number(amount) * 1e12) // 转换为最小单位

    // 构建交易信息
    const txInfo: TransactionInfo = {
      title: `供奉${selectedOffering.name}`,
      description: `为墓地 #${graveId} 供奉${selectedOffering.name}${selectedOffering.duration ? ` ${duration}${selectedOffering.unit}` : ''}`,
      icon: selectedOffering.icon,
      amount: `${amount} MEMO`,
      gasFee: '~0.001 MEMO',
      total: `${(Number(amount) + 0.001).toFixed(3)} MEMO`,
      target: `墓地 #${graveId}`,
      metadata: {
        graveId,
        kind: selectedOffering.id,
        duration: selectedOffering.duration ? duration : null
      }
    }

    // 设置交易执行函数
    const executeHandler = async (password: string): Promise<string> => {
      const target = [1, graveId] // domain=1, targetId=graveId
      const durationArg = selectedOffering.duration ? duration : null
      
      const hash = await signAndSendLocalWithPassword(
        'memoOfferings',
        'offer',
        [target, selectedOffering.id, amountBigInt.toString(), [], durationArg],
        password
      )
      
      return hash
    }

    setPendingTx(txInfo)
    setConfirmHandler(() => executeHandler)
    setConfirmModalOpen(true)
    setOpenOffer(false)
  }

  /**
   * 扫墓功能
   */
  const handleSweep = () => {
    const txInfo: TransactionInfo = {
      title: '记录扫墓',
      description: `为墓地 #${graveId} 记录一次扫墓`,
      icon: '🧹',
      metadata: { graveId }
    }

    const executeHandler = async (password: string): Promise<string> => {
      const hash = await signAndSendLocalWithPassword(
        'memoGraveGuestbook',
        'sweep',
        [graveId, null],
        password
      )
      return hash
    }

    setPendingTx(txInfo)
    setConfirmHandler(() => executeHandler)
    setConfirmModalOpen(true)
  }

  return (
    <div>
      {/* 操作按钮 */}
      <Flex gap={8} wrap="wrap">
        <Button 
          type="primary"
          size="large"
          onClick={handleOpenOffer}
          style={{
            flex: 1,
            minWidth: 120,
            height: 48,
            borderRadius: 'var(--radius-md)',
            fontSize: 16,
            fontWeight: 600
          }}
        >
          🌸 供奉
        </Button>
        <Button 
          size="large"
          onClick={handleSweep}
          style={{
            flex: 1,
            minWidth: 120,
            height: 48,
            borderRadius: 'var(--radius-md)',
            fontSize: 16
          }}
        >
          🧹 扫墓
        </Button>
      </Flex>

      {/* 供奉选择Modal */}
      <Modal
        open={openOffer}
        onCancel={() => setOpenOffer(false)}
        footer={null}
        title={
          <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }}>
            🕯️ 选择供品
          </div>
        }
        width={500}
        styles={{
          body: { padding: '0 24px 24px' }
        }}
      >
        {/* 供品卡片选择器 */}
        <OfferingCardSelector 
          onSelect={handleSelectOffering}
          selectedId={selectedOffering?.id}
        />

        {/* 选中供品后显示配置 */}
        {selectedOffering && (
          <div style={{ 
            marginTop: 16, 
            padding: 16, 
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
              已选择：{selectedOffering.icon} {selectedOffering.name}
            </Typography.Text>

            {/* 时长选择 */}
            {selectedOffering.duration && (
              <Form.Item label="时长" style={{ marginBottom: 12 }}>
                <InputNumber
                  min={1}
                  max={52}
                  value={duration}
                  onChange={(val) => setDuration(Number(val) || 1)}
                  addonAfter={selectedOffering.unit}
                  style={{ width: '100%' }}
                  size="large"
                />
              </Form.Item>
            )}

            {/* 自定义金额 */}
            {selectedOffering.id === 19 && (
              <Form.Item label="金额" style={{ marginBottom: 12 }}>
                <InputNumber
                  min={0.001}
                  step={0.1}
                  value={customAmount ? Number(customAmount) : undefined}
                  onChange={(val) => setCustomAmount(String(val || ''))}
                  addonAfter="MEMO"
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="输入金额"
                />
              </Form.Item>
            )}

            {/* 金额预览 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderTop: '1px dashed var(--color-divider)',
              marginTop: 12
            }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                总计
              </span>
              <span style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: 'var(--color-primary)'
              }}>
                {calculateAmount()} MEMO
              </span>
            </div>

            {/* 确认按钮 */}
            <Button
              type="primary"
              block
              size="large"
              onClick={handleConfirmOffer}
              style={{
                marginTop: 16,
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 'var(--radius-md)'
              }}
            >
              确认供奉
            </Button>
          </div>
        )}
      </Modal>

      {/* 交易确认Modal */}
      {confirmHandler && pendingTx && (
        <TransactionConfirmModal
          open={confirmModalOpen}
          onCancel={() => {
            setConfirmModalOpen(false)
            setPendingTx(null)
            setConfirmHandler(null)
          }}
          transaction={pendingTx}
          onConfirm={confirmHandler}
        />
      )}
    </div>
  )
}
