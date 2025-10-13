/**
 * IPFS费用监控Dashboard
 * 
 * 功能：
 * - 显示IPFS池配额使用情况
 * - 显示三重扣款统计（从池/专户/调用者扣款的次数和金额）
 * - 显示配额重置倒计时
 * - 显示运营者托管账户余额
 * - 显示最近的扣费记录
 * 
 * 创建时间：2025-10-12
 */

import React from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Tag, 
  Space, 
  Typography, 
  Table,
  Alert,
  Spin
} from 'antd';
import {
  WalletOutlined,
  BankOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FireOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useStoragePoolAccounts } from '@/hooks';
import { CHAIN_CONSTANTS, CHARGE_SOURCE_NAMES, ChargeSource } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

/**
 * 扣费记录（模拟数据，实际需要从链上事件获取）
 */
interface FeeRecord {
  key: string;
  blockNumber: number;
  timestamp: string;
  source: ChargeSource;
  amount: bigint;
  deceasedId: number;
  caller: string;
}

/**
 * IPFS费用监控Dashboard
 */
export const IpfsFeeDashboard: React.FC = () => {
  const { 
    ipfsPool, 
    operatorEscrow, 
    loading,
    refresh 
  } = useStoragePoolAccounts({
    enablePolling: true,
    pollingInterval: 30000,
  });

  if (loading && !ipfsPool) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!ipfsPool) {
    return (
      <Alert
        message="数据加载失败"
        description="无法获取IPFS池账户信息"
        type="error"
        showIcon
      />
    );
  }

  const quotaPercent = Number((ipfsPool.quotaUsed || 0n) * 100n / (ipfsPool.quotaTotal || 1n));
  const quotaRemaining = ipfsPool.quotaRemaining || 0n;
  const resetInDays = ((ipfsPool.resetInBlocks || 0) * CHAIN_CONSTANTS.BLOCK_TIME_SECONDS) / (24 * 60 * 60);
  
  // 模拟统计数据（实际需要从链上事件统计）
  const stats = getMockStats();

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <FireOutlined /> IPFS存储费用监控
      </Title>

      {/* 第一行：总览卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="IPFS池余额"
              value={formatBalance(ipfsPool.balance)}
              suffix="MEMO"
              prefix={<BankOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="月度配额剩余"
              value={formatBalance(quotaRemaining)}
              suffix="MEMO"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: quotaPercent > 80 ? '#ff4d4f' : '#52c41a' }}
            />
            <Progress 
              percent={quotaPercent}
              status={quotaPercent > 80 ? 'exception' : 'normal'}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="配额重置倒计时"
              value={resetInDays.toFixed(1)}
              suffix="天"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              约 {ipfsPool.resetInBlocks?.toLocaleString()} 个区块
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="运营者托管"
              value={formatBalance(operatorEscrow?.balance || 0n)}
              suffix="MEMO"
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              累计: {formatBalance(operatorEscrow?.totalReceived || 0n)} MEMO
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第二行：配额详情 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="月度配额使用情况" extra={<Tag color="blue">本月</Tag>}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>已使用</Text>
                <Text strong>{formatBalance(ipfsPool.quotaUsed || 0n)} MEMO</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>总配额</Text>
                <Text>{formatBalance(ipfsPool.quotaTotal || 0n)} MEMO</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text>剩余配额</Text>
                <Text type={quotaPercent > 80 ? 'danger' : 'success'} strong>
                  {formatBalance(quotaRemaining)} MEMO
                </Text>
              </div>
              <Progress 
                percent={quotaPercent}
                strokeColor={quotaPercent > 80 ? '#ff4d4f' : '#52c41a'}
                strokeWidth={12}
              />
            </div>

            {quotaPercent > 80 && (
              <Alert
                message="配额即将用尽"
                description={`本月配额已使用${quotaPercent.toFixed(1)}%，剩余${formatBalance(quotaRemaining)} MEMO。配额用尽后将从逝者专户或调用者账户扣款。`}
                type="warning"
                showIcon
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="三重扣款统计" extra={<Tag color="green">本月</Tag>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <BankOutlined style={{ color: '#52c41a' }} />
                  <Text>{CHARGE_SOURCE_NAMES[ChargeSource.IpfsPool]}</Text>
                </Space>
                <Space>
                  <Tag color="success">{stats.poolChargeCount} 次</Tag>
                  <Text strong>{formatBalance(stats.totalFromPool)} MEMO</Text>
                </Space>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <UserOutlined style={{ color: '#1890ff' }} />
                  <Text>{CHARGE_SOURCE_NAMES[ChargeSource.SubjectFunding]}</Text>
                </Space>
                <Space>
                  <Tag color="processing">{stats.subjectChargeCount} 次</Tag>
                  <Text strong>{formatBalance(stats.totalFromSubject)} MEMO</Text>
                </Space>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <WalletOutlined style={{ color: '#faad14' }} />
                  <Text>{CHARGE_SOURCE_NAMES[ChargeSource.Caller]}</Text>
                </Space>
                <Space>
                  <Tag color="warning">{stats.callerChargeCount} 次</Tag>
                  <Text strong>{formatBalance(stats.totalFromCaller)} MEMO</Text>
                </Space>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong>总计</Text>
                  <Space>
                    <Tag>{stats.totalChargeCount} 次</Tag>
                    <Text strong style={{ fontSize: 16 }}>
                      {formatBalance(stats.totalCharged)} MEMO
                    </Text>
                  </Space>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 第三行：最近扣费记录 */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="最近扣费记录" extra={<Tag>最近20条</Tag>}>
            <Table
              dataSource={stats.recentRecords}
              columns={getFeeRecordColumns()}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

/**
 * 扣费记录表格列定义
 */
function getFeeRecordColumns(): ColumnsType<FeeRecord> {
  return [
    {
      title: '区块号',
      dataIndex: 'blockNumber',
      key: 'blockNumber',
      render: (blockNumber: number) => `#${blockNumber.toLocaleString()}`,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
    },
    {
      title: '扣费来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: ChargeSource) => {
        const color = {
          [ChargeSource.IpfsPool]: 'success',
          [ChargeSource.SubjectFunding]: 'processing',
          [ChargeSource.Caller]: 'warning',
          [ChargeSource.Unknown]: 'default',
        }[source];
        return <Tag color={color}>{CHARGE_SOURCE_NAMES[source]}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: bigint) => `${formatBalance(amount)} MEMO`,
      align: 'right',
    },
    {
      title: '逝者ID',
      dataIndex: 'deceasedId',
      key: 'deceasedId',
    },
    {
      title: '调用者',
      dataIndex: 'caller',
      key: 'caller',
      render: (caller: string) => (
        <Text code style={{ fontSize: 12 }}>
          {caller.slice(0, 6)}...{caller.slice(-4)}
        </Text>
      ),
    },
  ];
}

/**
 * 格式化余额
 */
function formatBalance(amount: bigint): string {
  const value = Number(amount) / Number(CHAIN_CONSTANTS.UNIT);
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 获取模拟统计数据
 * 
 * ⚠️ 实际实现需要：
 * 1. 监听链上事件：ChargedFromIpfsPool, ChargedFromSubjectFunding, ChargedFromCaller
 * 2. 统计本月的扣费次数和金额
 * 3. 存储到本地或后端数据库
 */
function getMockStats() {
  const now = Date.now();
  
  // 模拟最近的扣费记录
  const recentRecords: FeeRecord[] = Array.from({ length: 20 }, (_, i) => ({
    key: `record-${i}`,
    blockNumber: 1234567 - i * 100,
    timestamp: new Date(now - i * 3600000).toLocaleString('zh-CN'),
    source: [ChargeSource.IpfsPool, ChargeSource.SubjectFunding, ChargeSource.Caller][i % 3],
    amount: BigInt(Math.floor(Math.random() * 5 + 1)) * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE,
    deceasedId: 100 + Math.floor(Math.random() * 50),
    caller: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  }));

  // 统计
  const totalFromPool = 45n * CHAIN_CONSTANTS.UNIT;
  const totalFromSubject = 20n * CHAIN_CONSTANTS.UNIT;
  const totalFromCaller = 5n * CHAIN_CONSTANTS.UNIT;

  return {
    totalFromPool,
    totalFromSubject,
    totalFromCaller,
    totalCharged: totalFromPool + totalFromSubject + totalFromCaller,
    poolChargeCount: 25,
    subjectChargeCount: 10,
    callerChargeCount: 3,
    totalChargeCount: 38,
    recentRecords,
  };
}

export default IpfsFeeDashboard;

