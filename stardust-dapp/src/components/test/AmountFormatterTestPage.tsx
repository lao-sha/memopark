/**
 * 金额格式化测试页面
 *
 * 功能说明：
 * 1. 测试AmountFormatter组件的各种显示模式
 * 2. 测试汇率查询和押金计算Hook
 * 3. 验证USDT/DUST转换逻辑
 * 4. 演示动态押金显示效果
 *
 * 创建日期：2025-11-22
 */

import React, { useState } from 'react'
import {
  Card,
  Space,
  Typography,
  Button,
  Input,
  Row,
  Col,
  Divider,
  Alert,
  Tag,
  Tooltip,
  Spin
} from 'antd'
import {
  ReloadOutlined,
  InfoCircleOutlined,
  ExperimentOutlined
} from '@ant-design/icons'

import { AmountFormatter, DustAmount, UsdtAmount } from '../common/AmountFormatter'
import { useExchangeRate, useDustToUsdt, useUsdtToDust } from '../../hooks/useExchangeRate'
import { useCategoryChangeDeposit, useCreateDeceasedDeposit } from '../../hooks/useDepositInfo'

const { Title, Text, Paragraph } = Typography

/**
 * 函数级详细中文注释：金额格式化测试页面组件
 */
export const AmountFormatterTestPage: React.FC = () => {
  const [testDustAmount, setTestDustAmount] = useState<string>('10000000000000') // 10 DUST (链上值)
  const [testUsdtAmount, setTestUsdtAmount] = useState<number>(10)

  // 汇率查询测试
  const {
    exchangeRate,
    rawRate,
    actualRate,
    isLoading: isRateLoading,
    isError: isRateError,
    refreshRate,
    lastUpdated
  } = useExchangeRate()

  // 货币转换测试
  const { usdtAmount, isCalculating: isDustToUsdtCalculating } = useDustToUsdt(testDustAmount)
  const { dustAmount, isCalculating: isUsdtToDustCalculating } = useUsdtToDust(testUsdtAmount)

  // 押金查询测试
  const {
    depositInfo: categoryDeposit,
    isLoading: isCategoryDepositLoading,
    isError: isCategoryDepositError,
    refetch: refetchCategoryDeposit
  } = useCategoryChangeDeposit()

  const {
    depositInfo: createDeposit,
    isLoading: isCreateDepositLoading,
    isError: isCreateDepositError,
    refetch: refetchCreateDeposit
  } = useCreateDeceasedDeposit('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'Medium') // Alice账户

  const handleRefreshAll = () => {
    refreshRate()
    refetchCategoryDeposit()
    refetchCreateDeposit()
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <Title level={2}>
          <ExperimentOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
          金额格式化组件测试页面
        </Title>
        <Paragraph type="secondary">
          测试汇率查询、押金计算和金额格式化组件的功能
        </Paragraph>
      </div>

      {/* 汇率信息卡片 */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            当前汇率信息
            <Button
              type="text"
              icon={<ReloadOutlined />}
              size="small"
              loading={isRateLoading}
              onClick={refreshRate}
            >
              刷新
            </Button>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small" title="原始汇率值">
              {isRateLoading ? (
                <Spin size="small" />
              ) : isRateError ? (
                <Text type="danger">查询失败</Text>
              ) : (
                <Text strong>{rawRate?.toLocaleString() || 'N/A'}</Text>
              )}
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                (链上值，scaled by 1e6)
              </Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="实际汇率">
              {isRateLoading ? (
                <Spin size="small" />
              ) : isRateError ? (
                <Text type="danger">查询失败</Text>
              ) : (
                <Text strong>{actualRate?.toFixed(6) || 'N/A'} USDT/DUST</Text>
              )}
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                (显示值)
              </Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="更新时间">
              {lastUpdated ? (
                <Text>{new Date(lastUpdated).toLocaleTimeString()}</Text>
              ) : (
                <Text type="secondary">未知</Text>
              )}
              <br />
              <Tag color={isRateError ? 'red' : exchangeRate?.isCached ? 'orange' : 'green'}>
                {isRateError ? '错误' : exchangeRate?.isCached ? '缓存' : '实时'}
              </Tag>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 押金信息卡片 */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            押金信息测试
            <Button
              type="text"
              icon={<ReloadOutlined />}
              size="small"
              loading={isCategoryDepositLoading || isCreateDepositLoading}
              onClick={handleRefreshAll}
            >
              刷新全部
            </Button>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card size="small" title="分类修改申请押金" type="inner">
              {isCategoryDepositLoading ? (
                <Spin size="small" />
              ) : isCategoryDepositError ? (
                <Alert message="查询失败" type="error" showIcon size="small" />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>USDT金额: </Text>
                    <UsdtAmount amount={categoryDeposit?.usdtAmount || 0} strong />
                  </div>
                  <div>
                    <Text strong>DUST金额: </Text>
                    <DustAmount amount={categoryDeposit?.dustAmount || '0'} strong />
                  </div>
                  <div>
                    <Text strong>完整显示: </Text>
                    <AmountFormatter
                      dustAmount={categoryDeposit?.dustAmount}
                      usdtAmount={categoryDeposit?.usdtAmount}
                      exchangeRate={categoryDeposit?.exchangeRate}
                      mode="both"
                      showRate
                      strong
                    />
                  </div>
                  {categoryDeposit?.isEstimate && (
                    <Tag color="orange">预估值</Tag>
                  )}
                </Space>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="创建逝者押金 (Medium)" type="inner">
              {isCreateDepositLoading ? (
                <Spin size="small" />
              ) : isCreateDepositError ? (
                <Alert message="查询失败" type="error" showIcon size="small" />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>USDT金额: </Text>
                    <UsdtAmount amount={createDeposit?.usdtAmount || 0} strong />
                  </div>
                  <div>
                    <Text strong>DUST金额: </Text>
                    <DustAmount amount={createDeposit?.dustAmount || '0'} strong />
                  </div>
                  <div>
                    <Text strong>完整显示: </Text>
                    <AmountFormatter
                      dustAmount={createDeposit?.dustAmount}
                      usdtAmount={createDeposit?.usdtAmount}
                      exchangeRate={createDeposit?.exchangeRate}
                      mode="both"
                      showRate
                      strong
                    />
                  </div>
                  {createDeposit?.isEstimate && (
                    <Tag color="orange">预估值</Tag>
                  )}
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 货币转换测试 */}
      <Card
        title={
          <Space>
            <ExperimentOutlined />
            货币转换测试
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={[24, 16]}>
          <Col span={12}>
            <Card size="small" title="DUST → USDT" type="inner">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>输入DUST数量 (链上值):</Text>
                  <Input
                    value={testDustAmount}
                    onChange={(e) => setTestDustAmount(e.target.value)}
                    placeholder="输入链上DUST数值"
                    style={{ marginTop: '8px' }}
                  />
                </div>
                <Divider />
                <div>
                  <Text strong>转换结果:</Text>
                  <br />
                  <Space direction="vertical" style={{ marginTop: '8px' }}>
                    <div>
                      <Text>DUST显示值: </Text>
                      <DustAmount amount={testDustAmount} strong />
                    </div>
                    <div>
                      <Text>USDT等值: </Text>
                      {isDustToUsdtCalculating ? (
                        <Spin size="small" />
                      ) : (
                        <UsdtAmount amount={usdtAmount || 0} strong />
                      )}
                    </div>
                    <div>
                      <Text>完整显示: </Text>
                      <AmountFormatter
                        dustAmount={testDustAmount}
                        exchangeRate={rawRate}
                        mode="both"
                        showRate
                        loading={isDustToUsdtCalculating}
                        strong
                      />
                    </div>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="USDT → DUST" type="inner">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>输入USDT数量:</Text>
                  <Input
                    type="number"
                    value={testUsdtAmount}
                    onChange={(e) => setTestUsdtAmount(Number(e.target.value))}
                    placeholder="输入USDT数值"
                    style={{ marginTop: '8px' }}
                  />
                </div>
                <Divider />
                <div>
                  <Text strong>转换结果:</Text>
                  <br />
                  <Space direction="vertical" style={{ marginTop: '8px' }}>
                    <div>
                      <Text>USDT输入值: </Text>
                      <UsdtAmount amount={testUsdtAmount} strong />
                    </div>
                    <div>
                      <Text>DUST等值: </Text>
                      {isUsdtToDustCalculating ? (
                        <Spin size="small" />
                      ) : (
                        <DustAmount amount={dustAmount || '0'} strong />
                      )}
                    </div>
                    <div>
                      <Text>链上值: </Text>
                      {isUsdtToDustCalculating ? (
                        <Spin size="small" />
                      ) : (
                        <Text code>{dustAmount || '0'}</Text>
                      )}
                    </div>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 显示模式测试 */}
      <Card
        title={
          <Space>
            <ExperimentOutlined />
            AmountFormatter 显示模式测试
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card size="small" title="DUST模式" type="inner">
              <AmountFormatter
                dustAmount="5000000000000"
                mode="dust"
                strong
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="USDT模式" type="inner">
              <AmountFormatter
                usdtAmount={25}
                mode="usdt"
                strong
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="双币种模式" type="inner">
              <AmountFormatter
                dustAmount="5000000000000"
                usdtAmount={25}
                exchangeRate={rawRate}
                mode="both"
                strong
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="自动模式+汇率" type="inner">
              <AmountFormatter
                dustAmount="5000000000000"
                exchangeRate={rawRate}
                mode="auto"
                showRate
                strong
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        <Alert
          message="组件功能说明"
          description={
            <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
              <li><Text strong>DUST金额:</Text> 自动除以1e12转换为显示值</li>
              <li><Text strong>汇率显示:</Text> 自动除以1e6显示实际汇率</li>
              <li><Text strong>动态计算:</Text> 根据实时汇率计算USDT等值</li>
              <li><Text strong>错误处理:</Text> 查询失败时显示默认值或错误信息</li>
              <li><Text strong>加载状态:</Text> 查询期间显示loading状态</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginTop: '16px' }}
        />
      </Card>
    </div>
  )
}

export default AmountFormatterTestPage