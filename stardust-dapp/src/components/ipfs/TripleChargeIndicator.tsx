/**
 * TripleChargeIndicator组件
 * 
 * 功能：显示三重扣款机制的余额和预估扣费来源
 * 
 * 使用场景：
 * - 上传CID前显示扣费预览
 * - 创建逝者/媒体/证据时的费用提示
 * - 充值引导页面
 * 
 * 创建时间：2025-10-12
 */

import React from 'react';
import { Card, Progress, Tag, Statistic, Row, Col, Alert, Space, Tooltip } from 'antd';
import { 
  WalletOutlined, 
  BankOutlined, 
  UserOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTripleChargeCheck } from '@/hooks';
import { ChargeSource, CHARGE_SOURCE_NAMES, CHAIN_CONSTANTS } from '@/types';

/**
 * TripleChargeIndicator组件属性
 */
export interface TripleChargeIndicatorProps {
  /** 逝者ID */
  deceasedId: number;
  /** 调用者账户地址 */
  caller: string;
  /** 预估费用（单位：最小单位） */
  estimatedCost: bigint;
  /** 副本数 */
  replicas?: number;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * TripleChargeIndicator组件
 * 
 * 显示三重扣款机制的余额检查和预估扣费来源
 * 
 * @example
 * ```tsx
 * <TripleChargeIndicator
 *   deceasedId={100}
 *   caller="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
 *   estimatedCost={3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE}
 *   replicas={3}
 *   showDetails={true}
 * />
 * ```
 */
export const TripleChargeIndicator: React.FC<TripleChargeIndicatorProps> = ({
  deceasedId,
  caller,
  estimatedCost,
  replicas = CHAIN_CONSTANTS.DEFAULT_REPLICAS,
  showDetails = true,
  compact = false,
  style,
}) => {
  const { info, loading, predictSource } = useTripleChargeCheck({
    deceasedId,
    caller,
    estimatedCost,
  });

  if (loading || !info) {
    return <Card loading style={style} />;
  }

  const prediction = predictSource();
  const quotaPercent = Number(info.poolQuotaUsed * 100n / info.poolQuotaTotal);
  
  // 检查余额是否充足
  const hasPoolQuota = info.poolQuotaRemaining >= estimatedCost;
  const hasSubjectBalance = info.subjectFundingBalance >= estimatedCost;
  const hasCallerBalance = info.callerBalance >= estimatedCost;
  const canAfford = hasPoolQuota || hasSubjectBalance || hasCallerBalance;

  // 紧凑模式
  if (compact) {
    return (
      <Space direction="vertical" size="small" style={{ width: '100%', ...style }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>扣费来源：</span>
          <Tag color={getSourceColor(prediction.source)}>
            {prediction.displayName}
          </Tag>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>预估费用：</span>
          <strong>{formatBalance(estimatedCost)} DUST</strong>
        </div>
        {!canAfford && (
          <Alert
            message="余额不足"
            description="所有账户余额都不足以支付此费用"
            type="error"
            showIcon
          />
        )}
      </Space>
    );
  }

  // 完整模式
  return (
    <Card 
      title={
        <Space>
          <WalletOutlined />
          扣费预览
          <Tooltip title="根据三重扣款机制，系统会按优先级从不同账户扣款：1️⃣ IPFS公共池（有配额）→ 2️⃣ 逝者专户 → 3️⃣ 您的账户">
            <InfoCircleOutlined style={{ color: '#999', fontSize: 14 }} />
          </Tooltip>
        </Space>
      }
      size="small"
      style={style}
    >
      {/* 预估扣费来源 */}
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Statistic
            title="预估扣费来源"
            value={prediction.displayName}
            prefix={getSourceIcon(prediction.source)}
            valueStyle={{ color: getSourceColor(prediction.source), fontSize: 16 }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="预估费用"
            value={formatBalance(estimatedCost)}
            suffix="DUST"
            valueStyle={{ fontSize: 16 }}
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            {replicas} 副本 × {formatBalance(CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE)} DUST/月
          </div>
        </Col>
      </Row>

      {/* 余额不足警告 */}
      {!canAfford && (
        <Alert
          message="余额不足"
          description="所有账户余额都不足以支付此费用，请先充值"
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginTop: 16 }}
        />
      )}

      {/* 详细信息 */}
      {showDetails && (
        <div style={{ marginTop: 16 }}>
          {/* IPFS公共池 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Space>
                <BankOutlined />
                <span>1️⃣ IPFS公共池</span>
                {hasPoolQuota && <Tag color="success">可用</Tag>}
              </Space>
              <span>{formatBalance(info.poolBalance)} DUST</span>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999', marginBottom: 4 }}>
                <span>月度配额使用</span>
                <span>{formatBalance(info.poolQuotaUsed)} / {formatBalance(info.poolQuotaTotal)} DUST</span>
              </div>
              <Progress 
                percent={quotaPercent}
                status={quotaPercent > 80 ? 'exception' : 'normal'}
                strokeColor={quotaPercent > 80 ? '#ff4d4f' : '#52c41a'}
              />
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                配额剩余：{formatBalance(info.poolQuotaRemaining)} DUST
              </div>
            </div>
          </div>

          {/* 逝者专户 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <UserOutlined />
                <span>2️⃣ 逝者专户</span>
                {hasSubjectBalance && <Tag color="success">可用</Tag>}
              </Space>
              <span>{formatBalance(info.subjectFundingBalance)} DUST</span>
            </div>
          </div>

          {/* 调用者账户 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <WalletOutlined />
                <span>3️⃣ 您的账户</span>
                {hasCallerBalance && <Tag color="success">可用</Tag>}
              </Space>
              <span>{formatBalance(info.callerBalance)} DUST</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

/**
 * 根据扣费来源获取颜色
 */
function getSourceColor(source: ChargeSource): string {
  switch (source) {
    case ChargeSource.IpfsPool:
      return '#52c41a'; // 绿色（最优）
    case ChargeSource.SubjectFunding:
      return '#1890ff'; // 蓝色（次优）
    case ChargeSource.Caller:
      return '#faad14'; // 橙色（兜底）
    default:
      return '#999'; // 灰色（未知）
  }
}

/**
 * 根据扣费来源获取图标
 */
function getSourceIcon(source: ChargeSource): React.ReactNode {
  switch (source) {
    case ChargeSource.IpfsPool:
      return <BankOutlined />;
    case ChargeSource.SubjectFunding:
      return <UserOutlined />;
    case ChargeSource.Caller:
      return <WalletOutlined />;
    default:
      return <InfoCircleOutlined />;
  }
}

/**
 * 格式化余额
 */
function formatBalance(amount: bigint): string {
  const value = Number(amount) / Number(CHAIN_CONSTANTS.UNIT);
  return value.toFixed(2);
}

