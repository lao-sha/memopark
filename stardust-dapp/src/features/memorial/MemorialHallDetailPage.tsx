/**
 * 逝者纪念馆主页面组件
 *
 * 功能说明：
 * 1. 展示逝者纪念馆完整内容
 * 2. 集成封面、导航标签、统计卡片、动态流等所有模块
 * 3. 支持祭拜操作（献花、蜡烛、敬香、祭品、留言）
 * 4. 移动端优先，响应式设计
 * 5. 路由参数：#/memorial/{deceasedId}
 *
 * 创建日期：2025-11-02
 * 修改日期：2025-11-26 - 添加云上思念风格封面
 */

import React, { useState, useEffect } from 'react'
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import { Spin, message, Button } from 'antd'
import { HeaderBanner } from './components/HeaderBanner'
import { NavigationTabs, TabKey } from './components/NavigationTabs'
import { StatisticsCards } from './components/StatisticsCards'
import { OfferingsTimelineView } from './components/OfferingsTimelineView'
import { MemorialActionsBar, ActionType } from './components/MemorialActionsBar'
import { HomeSection } from './components/HomeSection'
import { BiographySection } from './components/BiographySection'
import { PhotoGallerySection } from './components/PhotoGallerySection'
import { MessageBoardSection } from './components/MessageBoardSection'
import { OfferingModal } from './components/OfferingModal'
import { DeceasedInfo } from '../../services/deceasedService'
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

  // 状态管理
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [currentBlock, setCurrentBlock] = useState(0)
  const [offeringModalVisible, setOfferingModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 数据获取
  const { deceased, loading: deceasedLoading, error: deceasedError } = useDeceasedInfo(deceasedId)

// 供奉目标配置说明：
  //
  // targetType 定义（pallet-memorial TargetType 枚举）：
  // - 0 = Deceased（逝者）
  // - 1 = Pet（宠物）
  // - 2 = Memorial（纪念馆）
  // - 3 = Event（事件）
  //
  // 当前实现：
  // - 此页面展示的是逝者（Deceased）纪念馆
  // - target = [0, deceasedId] 表示向 ID 为 deceasedId 的逝者供奉
  const target: [number, number] | undefined = deceasedId ? [0, deceasedId] : undefined
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
        title: `${deceased?.name}的纪念馆`,
        text: `缅怀${deceased?.name}`,
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

    // 打开供奉弹窗
    setOfferingModalVisible(true)
  }

  /**
   * 函数级详细中文注释：处理供奉提交
   *
   * 实现流程：
   * 1. 检查钱包连接状态
   * 2. 构建供奉交易（单个或批量）
   * 3. 签名并提交到链上
   * 4. 等待交易确认
   * 5. 显示结果反馈
   */
  const handleOfferSubmit = async (offerings: any[]) => {
    if (!account || !deceased) {
      message.error('请先连接钱包')
      return
    }

    if (!deceasedId) {
      message.error('无效的纪念馆ID')
      return
    }

    setSubmitting(true)
    const messageKey = 'offering'
    try {
      const api = await getApi()
      const service = createMemorialService(api)

      // 计算总价（用于显示）
      const totalPrice = offerings.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0)
      const totalQuantity = offerings.reduce((sum, { quantity }) => sum + quantity, 0)

      // 构建供奉交易列表
      // targetType: 0 = Deceased（逝者）
      const offeringParams = offerings.map(({ item, quantity }) => ({
        sacrificeId: item.sacrificeId || 1, // 默认使用通用祭品ID
        quantity: quantity,
        media: [], // 暂无媒体附件
        durationWeeks: undefined, // 一次性供奉，无需时长
      }))

      const submitExtrinsic = async (tx: SubmittableExtrinsic<'promise'>) => {
        await new Promise<void>((resolve, reject) => {
          let unsub: (() => void) | undefined
          tx
            .signAndSend(
              account.address,
              { signer: account.signer as any },
              ({ status, dispatchError }) => {
                if (status.isInBlock) {
                  if (dispatchError) {
                    let errorMsg = '供奉失败'
                    if (dispatchError.isModule) {
                      const decoded = api.registry.findMetaError(dispatchError.asModule)
                      errorMsg = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`
                    } else {
                      errorMsg = dispatchError.toString()
                    }
                    unsub?.()
                    reject(new Error(errorMsg))
                    return
                  }
                  unsub?.()
                  resolve()
                } else if (status.isFinalized) {
                  console.log('供奉交易已最终确认:', status.asFinalized.toString())
                }
              }
            )
            .then(unsubHandler => {
              unsub = unsubHandler
            })
            .catch(reject)
        })
      }

      const supportsBatch = service.supportsBatchOffer()
      if (offeringParams.length > 1 && !supportsBatch) {
        message.warning('当前链暂未启用批量供奉，请分多次提交不同祭品')
        return
      }

      let tx: SubmittableExtrinsic<'promise'>
      if (supportsBatch) {
        tx = service.buildBatchOfferTx(offeringParams, 0, deceasedId)
      } else {
        const single = offeringParams[0]
        tx = service.buildOfferToTargetTx({
          targetType: 0,
          targetId: deceasedId,
          sacrificeId: single.sacrificeId,
          quantity: single.quantity,
          media: single.media,
          durationWeeks: single.durationWeeks,
        })
      }

      message.loading({ content: '正在提交供奉交易...', key: messageKey })
      await submitExtrinsic(tx)

      message.success({
        content: `供奉成功！共供奉 ${offerings.length} 种祭品（${totalQuantity}件），合计 ${totalPrice} DUST`,
        key: messageKey,
        duration: 3,
      })
      setOfferingModalVisible(false)
    } catch (error: any) {
      console.error('供奉失败:', error)
      message.error({ content: error.message || '供奉失败，请重试', key: messageKey })
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
            currentAccount={account?.address}
            canUpload={account?.address === deceased.owner}
          />
        )
      case 'messages':
        return <MessageBoardSection deceasedId={deceased.id} currentAccount={account?.address} />
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
        maxWidth: 414,
        margin: '0 auto',
        minHeight: '100vh',
        background: MemorialColors.bgPrimary,
      }}
    >
      {/* 头部横幅 */}
      <HeaderBanner
        deceased={deceased}
        currentAccount={account?.address}
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

      {/* 供奉弹窗 */}
      <OfferingModal
        open={offeringModalVisible}
        onClose={() => setOfferingModalVisible(false)}
        onOffer={handleOfferSubmit}
        loading={submitting}
      />
    </div>
  )
}

export default MemorialHallDetailPage
