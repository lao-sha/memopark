/**
 * 快速下单弹窗组件（通过祭祀品目录）
 * 
 * 功能说明：
 * 1. 智能计算价格（固定价或按周单价×周数）
 * 2. 自动应用VIP 30%折扣
 * 3. 显示原价和折扣后价格对比
 * 4. 支持选择目标（墓地/宠物/公园）
 * 5. 支持添加供奉留言
 * 6. 一键下单并发送交易
 * 
 * 创建日期：2025-10-28
 */

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  Space, 
  Typography, 
  Alert, 
  Spin,
  Tag,
  Divider,
  message,
} from 'antd'
import { 
  CrownOutlined, 
  GiftOutlined, 
  InfoCircleOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createMemorialService, 
  type SacrificeItem,
  type OfferingPriceInfo,
} from '../../services/memorialService'

const { Text, Title, Paragraph } = Typography
const { TextArea } = Input

interface OfferBySacrificeModalProps {
  /** 是否显示弹窗 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 祭祀品信息 */
  sacrifice: SacrificeItem | null
  /** 当前账户地址 */
  account: string
  /** 默认供奉目标：[domain, id] */
  defaultTarget?: [number, number]
  /** 下单成功回调 */
  onSuccess?: () => void
}

/**
 * 函数级详细中文注释：格式化DUST金额
 */
const formatDUST = (amount: string): string => {
  const memo = BigInt(amount) / BigInt(1_000_000)
  return memo.toLocaleString() + ' DUST'
}

/**
 * 函数级详细中文注释：快速下单弹窗组件
 */
export const OfferBySacrificeModal: React.FC<OfferBySacrificeModalProps> = ({
  open,
  onClose,
  sacrifice,
  account,
  defaultTarget,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [priceInfo, setPriceInfo] = useState<OfferingPriceInfo | null>(null)
  const [weeks, setWeeks] = useState<number | null>(null)
  const [calculating, setCalculating] = useState(false)
  const fallbackTarget = useMemo<[number, number]>(() => defaultTarget ?? [0, 0], [defaultTarget])

  /**
   * 函数级详细中文注释：计算价格
   */
  const calculatePrice = async (weekValue: number | null) => {
    if (!sacrifice || !account) return

    setCalculating(true)
    try {
      const api = await getApi()
      const service = createMemorialService(api)
      
      const info = await service.calculateOfferingPrice(
        sacrifice.id,
        weekValue,
        account
      )
      
      setPriceInfo(info)
    } catch (error: any) {
      console.error('价格计算失败:', error)
      message.error(error.message || '价格计算失败')
    } finally {
      setCalculating(false)
    }
  }

  /**
   * 函数级详细中文注释：监听周数变化，重新计算价格
   */
  useEffect(() => {
    if (sacrifice && account) {
      calculatePrice(weeks)
    }
  }, [sacrifice, account, weeks])

  /**
   * 函数级详细中文注释：表单初始化
   */
  useEffect(() => {
    if (open && sacrifice) {
      form.setFieldsValue({
        target: fallbackTarget,
        memo: '',
        weeks: sacrifice.unitPricePerWeek ? 1 : null,
      })

      // 初始化周数
      if (sacrifice.unitPricePerWeek) {
        setWeeks(1)
      } else {
        setWeeks(null)
      }
    }
  }, [open, sacrifice, fallbackTarget, form])

  /**
   * 函数级详细中文注释：提交表单
   */
  const handleSubmit = async (values: any) => {
    if (!sacrifice || !priceInfo) {
      message.error('价格信息尚未加载')
      return
    }

    setLoading(true)
    try {
      const api = await getApi()
      const service = createMemorialService(api)

      const target = values.target as [number, number] | undefined
      if (!target || target.length !== 2) {
        throw new Error('请选择供奉目标')
      }

      // 构建供奉交易
      const tx = service.buildOfferBySacrificeTx({
        target,
        sacrificeId: sacrifice.id,
        media: [],  // 🔧 方案A适配：新增媒体列表字段
        weeks: values.weeks || null,
      })

      // 获取当前账户的injector
      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      // 发送交易
      await tx.signAndSend(
        account, 
        { signer: injector.signer },
        ({ status, events }) => {
          if (status.isInBlock) {
            message.success('供奉已提交，等待区块确认...')
          } else if (status.isFinalized) {
            message.success('供奉成功！')
            setLoading(false)
            onSuccess?.()
            onClose()
          }
        }
      )
    } catch (error: any) {
      console.error('供奉失败:', error)
      message.error(error.message || '供奉失败')
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：渲染价格摘要
   */
  const renderPriceSummary = () => {
    if (calculating) {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            正在计算价格...
          </Text>
        </div>
      )
    }

    if (!priceInfo) {
      return null
    }

    return (
      <div 
        style={{ 
          background: '#f5f5f5', 
          padding: 16, 
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* 原价 */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">原价：</Text>
            <Text 
              strong 
              style={{ 
                fontSize: 16,
                textDecoration: priceInfo.isVip ? 'line-through' : 'none',
                color: priceInfo.isVip ? '#999' : '#000',
              }}
            >
              {formatDUST(priceInfo.originalPrice)}
            </Text>
          </div>

          {/* VIP折扣 */}
          {priceInfo.isVip && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="success">
                  <CrownOutlined /> VIP折扣（{priceInfo.discountPercent}%）：
                </Text>
                <Text type="success" strong>
                  -{formatDUST(
                    (BigInt(priceInfo.originalPrice) - BigInt(priceInfo.finalPrice)).toString()
                  )}
                </Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
            </>
          )}

          {/* 实付价格 */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 16 }}>
              实付金额：
            </Text>
            <Text 
              strong 
              style={{ 
                fontSize: 20, 
                color: '#1890ff',
              }}
            >
              {formatDUST(priceInfo.finalPrice)}
            </Text>
          </div>
        </Space>
      </div>
    )
  }

  if (!sacrifice) return null

  return (
    <Modal
      title={
        <Space>
          <GiftOutlined style={{ fontSize: 20 }} />
          <span>快速供奉 - {sacrifice.name}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="确认供奉"
      cancelText="取消"
      width={600}
      style={{ top: 40 }}
    >
      {/* VIP专属提示 */}
      {sacrifice.isVipExclusive && (
        <Alert
          message="VIP专属祭祀品"
          description="此祭祀品为VIP会员专属，您将享受30%折扣优惠"
          type="success"
          icon={<CrownOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 价格摘要 */}
      {renderPriceSummary()}

      {/* 表单 */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
        initialValues={{ target: fallbackTarget }}
      >
        {/* 目标选择 */}
        <Form.Item
          label="供奉目标"
          name="target"
          rules={[{ required: true, message: '请选择供奉目标' }]}
          tooltip="选择要供奉的对象（域代码，对象ID）"
        >
          <Space>
            <InputNumber placeholder="域代码" style={{ width: 120 }} />
            <InputNumber placeholder="对象ID" style={{ width: 200 }} />
          </Space>
        </Form.Item>

        {/* 持续周数（仅按周计费时显示） */}
        {sacrifice.unitPricePerWeek && (
          <Form.Item
            label="持续周数"
            name="weeks"
            rules={[
              { required: true, message: '请输入持续周数' },
              { type: 'number', min: 1, message: '周数不能小于1' },
            ]}
            tooltip={`按周单价：${formatDUST(sacrifice.unitPricePerWeek)}/周`}
          >
            <InputNumber
              min={1}
              max={52}
              style={{ width: '100%' }}
              placeholder="输入供奉持续的周数"
              onChange={(value) => setWeeks(value)}
              addonAfter="周"
            />
          </Form.Item>
        )}

        {/* 供奉留言 */}
        <Form.Item
          label="供奉留言"
          name="memo"
          tooltip="可选：添加您的供奉留言（最多200字）"
        >
          <TextArea
            rows={4}
            maxLength={200}
            placeholder="在此输入您的供奉留言..."
            showCount
          />
        </Form.Item>

        {/* 温馨提示 */}
        <Alert
          message="温馨提示"
          description={
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>供奉将从您的账户余额中扣除相应金额</li>
              <li>供奉记录将永久保存在区块链上</li>
              {sacrifice.unitPricePerWeek && (
                <li>按周计费的供奉到期后可续费</li>
              )}
              {priceInfo?.isVip && (
                <li>您的VIP会员身份已为您节省 {priceInfo.discountPercent}% 费用</li>
              )}
            </ul>
          }
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
          style={{ marginTop: 16 }}
        />
      </Form>
    </Modal>
  )
}

