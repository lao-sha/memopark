/**
 * 做市商管理中心页面
 * 
 * 功能说明：
 * 1. 做市商业务统一管理入口
 * 2. 提供 4 个主要功能：申请、Epay配置、业务配置、Bridge面板
 * 3. 提供 4 个快速入口：Bridge列表、交换、投诉、OTC订单
 * 4. 美观的渐变背景设计
 * 5. 响应式布局，移动端友好
 * 
 * 创建日期：2025-10-20
 */

import React, { useEffect, useState } from 'react'
import { Card, Typography, Alert, Button, Space, Row, Col } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'

const { Title, Text, Paragraph } = Typography

/**
 * 做市商管理中心页面组件
 */
const MarketMakerCenterPage: React.FC = () => {
  const { selectedAccount } = useWallet()
  const [makerStatus, setMakerStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * 函数级详细中文注释：加载用户的做市商状态
   * - 查询链上 pallet-market-maker 的 Applications
   * - 解析状态：Pending、DepositLocked、UnderReview、Active、Rejected
   * - 根据状态显示不同的提示和功能
   */
  useEffect(() => {
    const loadMakerStatus = async () => {
      if (!selectedAccount) {
        setLoading(false)
        return
      }

      try {
        const api = await getApi()
        const qroot: any = api.query
        const marketMakerQuery = qroot.marketMaker || qroot.market_maker
        
        if (!marketMakerQuery?.applications) {
          console.log('做市商查询接口不存在')
          setLoading(false)
          return
        }

        const appData = await marketMakerQuery.applications(selectedAccount.address)
        
        // 检查是否有数据
        if (!appData || appData.isEmpty) {
          console.log('该地址没有做市商申请')
          setMakerStatus(null)
          setLoading(false)
          return
        }

        const appJson: any = appData.toJSON()

        if (appJson && appJson.status) {
          const status = Object.keys(appJson.status)[0]
          console.log('做市商状态:', status)
          setMakerStatus(status)
        } else {
          console.log('无法解析做市商状态')
          setMakerStatus(null)
        }
      } catch (error) {
        console.error('加载做市商状态失败:', error)
        // 出错时显示为未申请状态
        setMakerStatus(null)
      } finally {
        setLoading(false)
      }
    }

    loadMakerStatus()
  }, [selectedAccount])

  /**
   * 函数级详细中文注释：获取状态显示信息
   * - 根据做市商状态返回对应的文字、颜色、描述
   */
  const getStatusInfo = () => {
    switch (makerStatus) {
      case 'Active':
        return { text: '活跃', color: 'success', desc: '您的做市商已激活，可以正常开展业务' }
      case 'UnderReview':
        return { text: '审核中', color: 'processing', desc: '委员会正在审核您的申请' }
      case 'DepositLocked':
        return { text: '已质押', color: 'warning', desc: '已完成质押，请提交完整资料' }
      case 'Pending':
        return { text: '待质押', color: 'default', desc: '请先质押 1,000,000 DUST' }
      case 'Rejected':
        return { text: '已拒绝', color: 'error', desc: '您的申请未通过审核' }
      default:
        return { text: '未申请', color: 'default', desc: '您还不是做市商，请先申请' }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: '0 auto' }}>
      <Card>
        {/* 页面标题 */}
        <div style={{ marginBottom: 24 }}>
          <Space>
            <Button 
              onClick={() => window.location.hash = '#/'}
            >
              ← 返回主页
            </Button>
          </Space>
          <Title level={2} style={{ marginTop: 16, marginBottom: 8 }}>
            💼 做市商管理中心
          </Title>
          <Paragraph type="secondary">
            统一管理 OTC/Bridge 做市商业务，配置参数，查看订单状态
          </Paragraph>
        </div>

        {/* 用户状态卡片 */}
        {selectedAccount && (
          <Card 
            size="small" 
            style={{ marginBottom: 16, background: '#f0f2f5' }}
            loading={loading}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>当前账户：</Text>
                <Text code style={{ marginLeft: 8 }}>{selectedAccount.address}</Text>
              </div>
              <div>
                <Text strong>做市商状态：</Text>
                <Alert
                  type={statusInfo.color as any}
                  message={statusInfo.text}
                  description={statusInfo.desc}
                  style={{ marginTop: 8 }}
                />
              </div>
            </Space>
          </Card>
        )}

        {/* 主功能面板 */}
        <Card 
          title="📋 核心功能" 
          style={{ 
            marginBottom: 16,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none'
          }}
          headStyle={{ 
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.2)'
          }}
          bodyStyle={{ padding: '16px' }}
        >
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={12} md={6}>
              <Button 
                block 
                size="large"
                style={{ 
                  height: '80px',
                  background: '#fff',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#667eea'
                }}
                onClick={() => window.location.hash = '#/otc/mm-apply'}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>📝</div>
                <div>做市商申请</div>
              </Button>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Button 
                block 
                size="large"
                style={{ 
                  height: '80px',
                  background: '#fff',
                  border: '2px solid #764ba2',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#764ba2'
                }}
                onClick={() => window.location.hash = '#/otc/market-maker-config'}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚙️</div>
                <div>Epay 配置</div>
              </Button>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Button 
                block 
                size="large"
                style={{ 
                  height: '80px',
                  background: '#fff',
                  border: '2px solid #f093fb',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#f093fb'
                }}
                onClick={() => window.location.hash = '#/otc/bridge-config'}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>💰</div>
                <div>业务配置</div>
              </Button>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Button 
                block 
                size="large"
                style={{ 
                  height: '80px',
                  background: '#fff',
                  border: '2px solid #4facfe',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#4facfe'
                }}
                onClick={() => window.location.hash = '#/bridge/maker-dashboard'}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>📊</div>
                <div>Bridge 面板</div>
              </Button>
            </Col>
          </Row>
        </Card>

        {/* 🆕 2025-10-22：信用管理面板 */}
        <Card 
          title="💳 信用管理" 
          style={{ 
            marginBottom: 16,
            background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
            border: 'none'
          }}
          headStyle={{ 
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.2)'
          }}
          bodyStyle={{ padding: '16px' }}
        >
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Button 
                block 
                size="large"
                style={{ 
                  height: '80px',
                  background: '#fff',
                  border: '2px solid #00d9ff',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#00d9ff'
                }}
                onClick={() => window.location.hash = '#/market-maker/credit'}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>💎</div>
                <div>信用仪表板</div>
              </Button>
            </Col>
            <Col xs={24} sm={12}>
              <Button 
                block 
                size="large"
                style={{ 
                  height: '80px',
                  background: '#fff',
                  border: '2px solid #52c41a',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#52c41a'
                }}
                onClick={() => window.location.hash = '#/market-maker/quota'}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎁</div>
                <div>免费配额管理</div>
              </Button>
            </Col>
          </Row>
        </Card>

        {/* 快速入口 */}
        <Card title="⚡ 快速入口" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[8, 8]}>
            <Col xs={12} sm={6}>
              <Button 
                block
                onClick={() => window.location.hash = '#/bridge/maker-list'}
              >
                📋 Bridge 列表
              </Button>
            </Col>
            <Col xs={12} sm={6}>
              <Button 
                block
                onClick={() => window.location.hash = '#/bridge/maker-swap'}
              >
                🔄 Bridge 交换
              </Button>
            </Col>
            <Col xs={12} sm={6}>
              <Button 
                block
                onClick={() => window.location.hash = '#/bridge/maker-complaint'}
              >
                ⚠️ 投诉管理
              </Button>
            </Col>
            <Col xs={12} sm={6}>
              <Button 
                block
                onClick={() => window.location.hash = '#/otc/order'}
              >
                🛒 OTC 订单
              </Button>
            </Col>
          </Row>
        </Card>

        {/* 使用指南 */}
        <Card title="📖 使用指南" size="small">
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div>
              <Text strong>1. 新做市商申请流程：</Text>
              <Paragraph style={{ marginLeft: 16, marginBottom: 8 }}>
                点击"做市商申请" → 质押 1,000,000 DUST → 提交资料 → 等待审批 → Active 状态
              </Paragraph>
            </div>
            <div>
              <Text strong>2. Epay 配置：</Text>
              <Paragraph style={{ marginLeft: 16, marginBottom: 8 }}>
                做市商通过后，配置 Epay 商户号和密钥，用于 OTC 订单的首购验证
              </Paragraph>
            </div>
            <div>
              <Text strong>3. 业务配置：</Text>
              <Paragraph style={{ marginLeft: 16, marginBottom: 8 }}>
                调整 Buy/Sell 溢价、业务方向（Buy/Sell/BuyAndSell）、最小订单金额、TRON 地址
              </Paragraph>
            </div>
            <div>
              <Text strong>4. Bridge 面板：</Text>
              <Paragraph style={{ marginLeft: 16, marginBottom: 8 }}>
                监控 Bridge 订单状态、查看统计数据、管理投诉
              </Paragraph>
            </div>
            <div>
              <Text strong>🆕 5. 信用仪表板：</Text>
              <Paragraph style={{ marginLeft: 16, marginBottom: 8 }}>
                查看信用评分、等级、违约历史、风险分衰减进度、服务状态
              </Paragraph>
            </div>
            <div>
              <Text strong>🆕 6. 免费配额管理：</Text>
              <Paragraph style={{ marginLeft: 16, marginBottom: 8 }}>
                设置新买家免费订单次数、授予特定买家额外配额、查看代付统计
              </Paragraph>
            </div>
          </Space>
        </Card>
      </Card>
    </div>
  )
}

export default MarketMakerCenterPage

