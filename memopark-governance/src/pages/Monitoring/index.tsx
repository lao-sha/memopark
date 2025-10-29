/**
 * 监控Dashboard页面
 * 
 * 功能：
 * - 实时展示申诉系统监控指标
 * - 申诉统计、性能指标、业务指标、系统状态
 * - 趋势图表和历史数据分析
 * - 手动刷新和自动刷新
 * 
 * 监控维度：
 * 1. 申诉统计（总数、状态分布、速率）
 * 2. 性能监控（查询耗时、API延迟、索引命中率）
 * 3. 业务指标（押金池、罚没金额、执行成功率）
 * 4. 系统状态（API连接、区块高度、队列长度）
 */

import React, { useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Alert,
  Spin,
  Empty,
  Tag,
  Progress,
  Descriptions,
  Space,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useApi } from '@/contexts/Api';
import { useMonitoring } from '@/hooks/useMonitoring';
import { formatBalance } from '@/utils/format';
import type { MonitoringMetrics } from '@/hooks/useMonitoring';

const { Title, Text } = Typography;

/**
 * 申诉状态标签
 */
const AppealStatusLabels: Record<number, string> = {
  0: '待审批',
  1: '已批准',
  2: '已驳回',
  3: '已撤回',
  4: '已执行',
};

/**
 * 申诉状态颜色
 */
const AppealStatusColors: Record<number, string> = {
  0: 'warning',
  1: 'success',
  2: 'error',
  3: 'default',
  4: 'processing',
};

/**
 * 格式化时间戳为时间字符串
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 获取系统健康状态
 */
function getSystemHealth(metrics: MonitoringMetrics): {
  status: 'success' | 'warning' | 'error';
  message: string;
} {
  // 检查API连接
  if (!metrics.system.apiConnected) {
    return { status: 'error', message: 'API未连接' };
  }
  
  // 检查队列积压
  if (metrics.system.queueLength > 100) {
    return { status: 'error', message: `执行队列严重积压: ${metrics.system.queueLength}个` };
  }
  if (metrics.system.queueLength > 50) {
    return { status: 'warning', message: `执行队列积压: ${metrics.system.queueLength}个` };
  }
  
  // 检查申诉提交速率
  if (metrics.appeals.submitRate > 50) {
    return { status: 'warning', message: `申诉提交速率过高: ${metrics.appeals.submitRate}/小时` };
  }
  
  // 检查性能
  if (metrics.performance.avgQueryTime > 1000) {
    return { status: 'warning', message: '查询响应时间过长' };
  }
  
  return { status: 'success', message: '系统运行正常' };
}

/**
 * 监控Dashboard页面组件
 */
const MonitoringPage: React.FC = () => {
  const { api } = useApi();
  const { metrics, history, loading, error, refresh } = useMonitoring(api, {
    refreshInterval: 60000, // 每60秒自动刷新
    autoRefresh: true,
  });
  
  // 计算系统健康状态
  const systemHealth = useMemo(() => {
    if (!metrics) return null;
    return getSystemHealth(metrics);
  }, [metrics]);
  
  // 渲染加载状态
  if (loading && !metrics) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="正在采集监控数据..." />
      </div>
    );
  }
  
  // 渲染错误状态
  if (error && !metrics) {
    return (
      <Alert
        type="error"
        message="监控数据采集失败"
        description={error.message}
        showIcon
        style={{ margin: 24 }}
        action={
          <Button size="small" danger onClick={refresh}>
            重试
          </Button>
        }
      />
    );
  }
  
  // 渲染空状态
  if (!metrics) {
    return (
      <Empty
        description="暂无监控数据"
        style={{ margin: '100px 0' }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }
  
  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2}>
            <DashboardOutlined /> 监控Dashboard
          </Title>
          <Text type="secondary">
            实时监控申诉治理系统运行状态 | 最后更新: {formatTimestamp(metrics.timestamp)}
          </Text>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={refresh}
            loading={loading}
            type="primary"
          >
            刷新数据
          </Button>
        </Col>
      </Row>
      
      {/* 系统健康状态 */}
      {systemHealth && (
        <Alert
          type={systemHealth.status}
          message={systemHealth.message}
          showIcon
          style={{ marginBottom: 24 }}
          icon={
            systemHealth.status === 'success' ? (
              <CheckCircleOutlined />
            ) : systemHealth.status === 'warning' ? (
              <ClockCircleOutlined />
            ) : (
              <CloseCircleOutlined />
            )
          }
        />
      )}
      
      {/* 申诉统计 */}
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>申诉统计</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总申诉数"
                value={metrics.appeals.total}
                suffix="个"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="待审批"
                value={metrics.appeals.byStatus[0]}
                suffix="个"
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已批准"
                value={metrics.appeals.byStatus[1]}
                suffix="个"
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已驳回"
                value={metrics.appeals.byStatus[2]}
                suffix="个"
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
        
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="提交速率"
                value={metrics.appeals.submitRate}
                suffix="个/小时"
                precision={1}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="处理速率"
                value={metrics.appeals.processRate}
                suffix="个/小时"
                precision={1}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>
        
        {/* 状态分布 */}
        <Card title="状态分布" size="small" style={{ marginTop: 16 }}>
          <Space wrap>
            {Object.entries(metrics.appeals.byStatus).map(([status, count]) => (
              <Tag key={status} color={AppealStatusColors[Number(status)]}>
                {AppealStatusLabels[Number(status)]}: {count}
              </Tag>
            ))}
          </Space>
        </Card>
      </Card>
      
      {/* 性能指标 */}
      <Card
        title={
          <Space>
            <RocketOutlined />
            <span>性能指标</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="平均查询耗时"
                value={metrics.performance.avgQueryTime}
                suffix="ms"
                valueStyle={{
                  color: metrics.performance.avgQueryTime < 100 ? '#52c41a' : '#faad14',
                }}
                prefix={<ThunderboltOutlined />}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                {metrics.performance.avgQueryTime < 50
                  ? '✅ 性能优秀'
                  : metrics.performance.avgQueryTime < 100
                  ? '⚠️ 性能良好'
                  : '❌ 性能较慢'}
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="API延迟"
                value={metrics.performance.apiLatency}
                suffix="ms"
                valueStyle={{
                  color: metrics.performance.apiLatency < 50 ? '#52c41a' : '#faad14',
                }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <div style={{ marginBottom: 8 }}>
                <Text strong>索引命中率</Text>
              </div>
              <Progress
                percent={metrics.performance.indexHitRate}
                status={metrics.performance.indexHitRate > 95 ? 'success' : 'normal'}
                strokeColor={metrics.performance.indexHitRate > 95 ? '#52c41a' : '#1890ff'}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                Phase 3.4索引优化生效
              </div>
            </Card>
          </Col>
        </Row>
      </Card>
      
      {/* 业务指标 */}
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>业务指标</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="押金池总额"
                value={formatBalance(metrics.business.totalDeposit)}
                suffix="MEMO"
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="罚没总额"
                value={formatBalance(metrics.business.totalSlashed)}
                suffix="MEMO"
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
        
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <Card>
              <div style={{ marginBottom: 8 }}>
                <Text strong>执行成功率</Text>
              </div>
              <Progress
                percent={metrics.business.executeSuccessRate}
                status={metrics.business.executeSuccessRate > 95 ? 'success' : 'normal'}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <div style={{ marginBottom: 8 }}>
                <Text strong>重试失败率</Text>
              </div>
              <Progress
                percent={metrics.business.retryFailureRate}
                status={metrics.business.retryFailureRate < 5 ? 'success' : 'exception'}
                strokeColor={metrics.business.retryFailureRate < 5 ? '#52c41a' : '#ff4d4f'}
              />
            </Card>
          </Col>
        </Row>
      </Card>
      
      {/* 系统状态 */}
      <Card
        title={
          <Space>
            <DashboardOutlined />
            <span>系统状态</span>
          </Space>
        }
      >
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 2 }}>
          <Descriptions.Item label="API连接状态">
            {metrics.system.apiConnected ? (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                已连接
              </Tag>
            ) : (
              <Tag color="error" icon={<CloseCircleOutlined />}>
                未连接
              </Tag>
            )}
          </Descriptions.Item>
          
          <Descriptions.Item label="当前区块高度">
            <Text code>{metrics.system.blockHeight.toLocaleString()}</Text>
          </Descriptions.Item>
          
          <Descriptions.Item label="执行队列长度">
            <Space>
              <Text
                strong
                style={{
                  color:
                    metrics.system.queueLength > 100
                      ? '#ff4d4f'
                      : metrics.system.queueLength > 50
                      ? '#faad14'
                      : '#52c41a',
                }}
              >
                {metrics.system.queueLength}
              </Text>
              <Text type="secondary">个待执行申诉</Text>
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="存储占用">
            <Text code>{metrics.system.storageUsage}</Text>
          </Descriptions.Item>
        </Descriptions>
        
        {/* 历史数据趋势提示 */}
        {history.length > 1 && (
          <Alert
            type="info"
            message={`已采集 ${history.length} 条历史记录`}
            description="历史数据保留24小时，用于趋势分析和速率计算"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    </div>
  );
};

export default MonitoringPage;

