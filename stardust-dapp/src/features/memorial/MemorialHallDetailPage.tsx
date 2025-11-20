/**
 * 逝者纪念馆主页面组件
 * 
 * 功能说明：
 * 1. 展示逝者纪念馆完整内容
 * 2. 集成头部横幅、导航标签、统计卡片、动态流等所有模块
 * 3. 支持祭拜操作（献花、蜡烛、敬香、祭品、留言）
 * 4. 移动端优先，响应式设计
 * 5. 路由参数：#/memorial/{deceasedId}
 * 
 * 创建日期：2025-11-02
 */

import React, { useState, useEffect } from 'react'
import { Spin, message, Modal, Form, Input, InputNumber, Space, Button } from 'antd'
import { HeaderBanner } from './components/HeaderBanner'
import { NavigationTabs, TabKey } from './components/NavigationTabs'
import { StatisticsCards } from './components/StatisticsCards'
import { OfferingsTimelineView } from './components/OfferingsTimelineView'
import { MemorialActionsBar, ActionType } from './components/MemorialActionsBar'
import { HomeSection } from './components/HomeSection'
import { BiographySection } from './components/BiographySection'
import { PhotoGallerySection } from './components/PhotoGallerySection'
import { MessageBoardSection } from './components/MessageBoardSection'
import {
  useDeceasedInfo,
  useOfferingsData,
  useMemorialStatistics,
} from '../../hooks/useMemorialHall'
import { useAccount } from '../../hooks/useAccount'
import { getApi } from '../../lib/polkadot-safe'
import { createMemorialService } from '../../services/memorialService'
import { MemorialColors } from '../../theme/colors'

/**
 * 函数级详细中文注释：供奉表单数据类型
 */
interface OfferingFormData {
  kindCode: number
  amount: number
  duration?: number
  message?: string
}

/**
 * 函数级详细中文注释：纪念馆主页面组件
 */
const MemorialHallDetailPage: React.FC = () => {
  /**
   * 函数级详细中文注释：根据 hash 路径解析纪念馆 ID
   */
  const parseDeceasedId = () => {
    const hash = window.location.hash
    const match = hash.match(/^#\/memorial\/(\d+)/)
    if (!match) {
      return undefined
    }
    const parsed = Number.parseInt(match[1], 10)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  const [deceasedId, setDeceasedId] = useState<number | undefined>(parseDeceasedId())
  const account = useAccount()
  const [form] = Form.useForm()

  // 状态管理
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [currentBlock, setCurrentBlock] = useState(0)
  const [offeringModalVisible, setOfferingModalVisible] = useState(false)
  const [selectedActionType, setSelectedActionType] = useState<ActionType>()
  const [submitting, setSubmitting] = useState(false)

  // 数据获取
  const { deceased, loading: deceasedLoading, error: deceasedError } = useDeceasedInfo(deceasedId)

// ⚠️ TODO（方案A适配）：供奉功能需要迁移到纪念馆页面
  //
  // 当前问题：
// - 方案A要求供奉必须针对纪念馆，domain=0
// - 此页面展示的是逝者（Deceased）纪念馆，没有 memorialId
  // - 旧代码使用 domain=1（已废弃，原为Deceased，现为Pet）
  //
  // 解决方案：
// 1. 推荐：查询逝者关联的纪念馆 ID，使用纪念馆进行供奉
// 2. 或者：将供奉功能迁移到纪念馆详情页
// 3. 临时：禁用此页面的供奉功能，引导用户到纪念馆页面
  //
  // 当前实现（临时兼容）：
  // - 暂时保留旧的 target 定义，但供奉功能可能不可用
// - 建议用户访问纪念馆页面进行供奉
const target: [number, number] | undefined = deceasedId ? [0, deceasedId] : undefined // 🔧 临时：domain=0（纪念馆）
  const { offerings, loading: offeringsLoading } = useOfferingsData(target, 50)
  const statistics = useMemorialStatistics(deceasedId, offerings)

  // 获取当前区块号
  useEffect(() => {
    const loadCurrentBlock = async () => {
      try {
        const api = await getApi()
        const header = await api.rpc.chain.getHeader()

        // 安全检查：确保 header 和 header.number 存在
        if (header && header.number && typeof header.number.toNumber === 'function') {
          setCurrentBlock(header.number.toNumber())
        } else {
          console.warn('区块头信息格式异常:', header)
          setCurrentBlock(0)  // 设置默认值
        }
      } catch (error) {
        console.error('获取当前区块号失败:', error)
        setCurrentBlock(0)  // 设置默认值
      }
    }
    loadCurrentBlock()
  }, [])

  useEffect(() => {
    /**
     * 函数级详细中文注释：监听 hash 变化以更新纪念馆 ID
     */
    const handleHashChange = () => {
      setDeceasedId(parseDeceasedId())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  /**
   * 函数级详细中文注释：处理返回
   */
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.hash = '#/memorial'
    }
  }

  /**
   * 函数级详细中文注释：处理分享
   */
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${deceased?.fullName}的纪念馆`,
        text: `缅怀${deceased?.fullName}`,
        url: window.location.href,
      }).catch(() => {
        // 用户取消分享
      })
    } else {
      // 复制链接到剪贴板
      navigator.clipboard.writeText(window.location.href)
      message.success('链接已复制到剪贴板')
    }
  }

  /**
   * 函数级详细中文注释：处理编辑
   */
  const handleEdit = () => {
    message.info('编辑功能开发中')
    // TODO: 跳转到编辑页面
  }

  /**
   * 函数级详细中文注释：处理设置
   */
  const handleSettings = () => {
    message.info('设置功能开发中')
    // TODO: 打开设置弹窗
  }

  /**
   * 函数级详细中文注释：处理加入亲友团
   */
  const handleJoinFamily = () => {
    message.info('加入亲友团功能开发中')
    // TODO: 实现加入亲友团逻辑
  }

  /**
   * 函数级详细中文注释：获取供奉类型代码
   */
  const getKindCodeByAction = (action: ActionType): number => {
    const mapping: Record<ActionType, number> = {
      flower: 1,
      candle: 2,
      incense: 3,
      offering: 4,
      message: 0, // 留言不需要kindCode
    }
    return mapping[action]
  }

  /**
   * 函数级详细中文注释：处理快捷操作
   */
  const handleAction = (action: ActionType) => {
    if (action === 'message') {
      setActiveTab('messages')
      return
    }

    if (!account) {
      message.warning('请先连接钱包')
      return
    }

    setSelectedActionType(action)
    form.setFieldsValue({
      kindCode: getKindCodeByAction(action),
      amount: 10, // 默认金额
      duration: action === 'candle' ? 1 : undefined, // 蜡烛默认1周
    })
    setOfferingModalVisible(true)
  }

  /**
   * 函数级详细中文注释：提交供奉
   *
   * ⚠️ TODO（方案A适配）：此功能需要重构
   * - 方案A要求供奉必须传入纪念馆 ID，而不是 target
   * - 当前页面基于 deceasedId，需要先查询关联的纪念馆 ID
   * - 建议将此功能迁移到纪念馆详情页
   */
  const handleSubmitOffering = async () => {
    if (!account || !deceased || !target) {
      message.error('当前页面不支持供奉功能，请访问纪念馆页面进行供奉')
      return
    }

    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const api = await getApi()
      const service = createMemorialService(api)

      // ⚠️ TODO（方案A适配）：需要改为传入纪念馆 ID
      // 当前实现可能不可用，需要从 deceased 查询关联的纪念馆 ID
      //
      // 临时方案（可能不工作）：
      // const memorialId = target[1]
      // const tx = service.buildOfferTx({
      //   memorialId,
      //   kindCode: values.kindCode,
      //   media: [],
      //   duration: values.duration,
      // })

      message.warning('供奉功能暂时不可用，请访问纪念馆页面进行供奉')
      setOfferingModalVisible(false)

      // 旧的实现（已禁用）
      // const tx = service.buildOfferTx({
      //   target,
      //   kindCode: values.kindCode,
      //   amount: values.amount * 1_000_000,
      //   media: [],
      //   duration: values.duration,
      // })
      //
      // const { web3FromAddress } = await import('@polkadot/extension-dapp')
      // const injector = await web3FromAddress(account)
      //
      // await tx.signAndSend(
      //   account,
      //   { signer: injector.signer },
      //   ({ status, events }) => {
      //     if (status.isFinalized) {
      //       message.success('供奉成功！')
      //       setOfferingModalVisible(false)
      //       form.resetFields()
      //       window.location.reload()
      //     }
      //   }
      // )
    } catch (error: any) {
      console.error('供奉失败:', error)
      message.error(error.message || '供奉失败')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 函数级详细中文注释：渲染标签页内容
   */
  const renderTabContent = () => {
    if (!deceased) return null

    switch (activeTab) {
      case 'home':
        return <HomeSection deceased={deceased} onNavigate={(tab) => setActiveTab(tab as TabKey)} />
      case 'biography':
        return <BiographySection deceased={deceased} />
      case 'photos':
        return (
          <PhotoGallerySection
            deceased={deceased}
            currentAccount={account}
            canUpload={account === deceased.owner}
          />
        )
      case 'messages':
        return <MessageBoardSection deceasedId={deceased.id} currentAccount={account} />
      case 'family':
        return <div style={{ padding: 20, textAlign: 'center' }}>家谱功能开发中</div>
      case 'offerings':
        return (
          <OfferingsTimelineView
            offerings={offerings}
            currentBlock={currentBlock}
            loading={offeringsLoading}
            limit={20}
          />
        )
      default:
        return null
    }
  }

  // 加载中状态
  if (deceasedLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Spin size="large" />
        <div style={{ color: MemorialColors.textSecondary }}>加载纪念馆数据...</div>
      </div>
    )
  }

  // 错误状态
  if (deceasedError || !deceased) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: 16,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 48 }}>😢</div>
        <div style={{ fontSize: 18, color: MemorialColors.textPrimary }}>
          {deceasedError || '未找到纪念馆'}
        </div>
        <Button type="primary" onClick={handleBack}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100vh',
        background: MemorialColors.bgPrimary,
      }}
    >
      {/* 头部横幅 */}
      <HeaderBanner
        deceased={deceased}
        currentAccount={account}
        onBack={handleBack}
        onShare={handleShare}
        onEdit={handleEdit}
        onSettings={handleSettings}
        onJoinFamily={handleJoinFamily}
      />

      {/* 导航标签页 */}
      <NavigationTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        showFamily={false}
        showOfferings={true}
      />

      {/* 统计卡片（仅首页显示） */}
      {activeTab === 'home' && (
        <StatisticsCards statistics={statistics} loading={offeringsLoading} />
      )}

      {/* 标签页内容 */}
      {renderTabContent()}

      {/* 底部操作栏 */}
      <MemorialActionsBar
        onAction={handleAction}
        disabled={!account}
        showMessage={true}
        unreadMessages={0}
      />

      {/* 供奉表单Modal */}
      <Modal
        title={`${selectedActionType === 'flower' ? '献花' : selectedActionType === 'candle' ? '点蜡烛' : selectedActionType === 'incense' ? '敬香' : '供祭品'}`}
        open={offeringModalVisible}
        onCancel={() => {
          setOfferingModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        width={400}
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitOffering}
          style={{ marginTop: 20 }}
        >
          <Form.Item name="kindCode" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            label="供奉金额"
            name="amount"
            rules={[{ required: true, message: '请输入供奉金额' }]}
          >
            <InputNumber
              min={1}
              max={10000}
              style={{ width: '100%' }}
              addonAfter="DUST"
              placeholder="请输入金额"
            />
          </Form.Item>

          {selectedActionType === 'candle' && (
            <Form.Item
              label="持续时长"
              name="duration"
              rules={[{ required: true, message: '请输入持续时长' }]}
            >
              <InputNumber
                min={1}
                max={52}
                style={{ width: '100%' }}
                addonAfter="周"
                placeholder="请输入周数"
              />
            </Form.Item>
          )}

          <Form.Item label="留言" name="message">
            <Input.TextArea rows={3} placeholder="写下您的祝福与思念..." maxLength={200} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setOfferingModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{
                  backgroundColor: MemorialColors.primary,
                  borderColor: MemorialColors.primary,
                }}
              >
                确认供奉
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MemorialHallDetailPage

