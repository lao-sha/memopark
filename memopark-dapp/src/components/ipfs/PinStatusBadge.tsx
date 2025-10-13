/**
 * PinStatusBadge组件
 * 
 * 功能：显示CID的Pin状态徽章
 * 
 * 使用场景：
 * - 逝者页面显示姓名CID的pin状态
 * - 媒体列表显示每个媒体CID的pin状态
 * - 证据页面显示证据CID的pin状态
 * 
 * 创建时间：2025-10-12
 */

import React from 'react';
import { Badge, Tooltip, Spin } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { usePinStatus } from '@/hooks';
import { PinStatus, PIN_STATUS_NAMES } from '@/types';
import type { BadgeProps } from 'antd';

/**
 * PinStatusBadge组件属性
 */
export interface PinStatusBadgeProps {
  /** CID（十六进制字符串） */
  cid: string | null;
  /** 是否显示副本数 */
  showReplicas?: boolean;
  /** 是否启用轮询 */
  enablePolling?: boolean;
  /** 轮询间隔（毫秒） */
  pollingInterval?: number;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义类名 */
  className?: string;
}

/**
 * PinStatusBadge组件
 * 
 * 显示CID的Pin状态，支持轮询自动更新
 * 
 * @example
 * ```tsx
 * <PinStatusBadge 
 *   cid="0x1234..." 
 *   showReplicas={true}
 *   enablePolling={true}
 * />
 * ```
 */
export const PinStatusBadge: React.FC<PinStatusBadgeProps> = ({
  cid,
  showReplicas = true,
  enablePolling = false,
  pollingInterval = 10000,
  style,
  className,
}) => {
  const { record, loading, error } = usePinStatus({
    cid,
    enablePolling,
    pollingInterval,
    immediate: !!cid,
  });

  // 加载中
  if (loading && !record) {
    return (
      <span style={style} className={className}>
        <Spin size="small" />
      </span>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Tooltip title={`查询失败: ${error}`}>
        <Badge 
          status="default" 
          text="查询失败"
          style={style}
          className={className}
        />
      </Tooltip>
    );
  }

  // 未Pin
  if (!record) {
    return (
      <Tooltip title="该CID尚未提交Pin请求">
        <Badge 
          status="default" 
          text="未Pin"
          style={style}
          className={className}
        />
      </Tooltip>
    );
  }

  // 根据状态选择颜色和图标
  const statusConfig = getStatusConfig(record.status);
  
  // 构建显示文本
  let text = PIN_STATUS_NAMES[record.status];
  if (showReplicas && record.status !== PinStatus.Failed) {
    text += ` (${record.currentReplicas}/${record.targetReplicas})`;
  }

  // 构建Tooltip内容
  const tooltipContent = (
    <div>
      <div><strong>状态：</strong>{PIN_STATUS_NAMES[record.status]}</div>
      <div><strong>副本数：</strong>{record.currentReplicas}/{record.targetReplicas}</div>
      <div><strong>逝者ID：</strong>{record.deceasedId}</div>
      <div><strong>创建时间：</strong>{formatBlockNumber(record.createdAt)}</div>
      {record.updatedAt && (
        <div><strong>更新时间：</strong>{formatBlockNumber(record.updatedAt)}</div>
      )}
      {record.failureReason && (
        <div style={{ color: '#ff4d4f' }}>
          <strong>失败原因：</strong>{record.failureReason}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipContent}>
      <Badge 
        status={statusConfig.badgeStatus}
        text={
          <span style={style} className={className}>
            {statusConfig.icon && <span style={{ marginRight: 4 }}>{statusConfig.icon}</span>}
            {text}
          </span>
        }
      />
    </Tooltip>
  );
};

/**
 * 根据状态获取配置
 */
function getStatusConfig(status: PinStatus): {
  badgeStatus: BadgeProps['status'];
  icon?: React.ReactNode;
} {
  switch (status) {
    case PinStatus.Pending:
      return {
        badgeStatus: 'processing',
        icon: <ClockCircleOutlined />,
      };
    case PinStatus.Active:
      return {
        badgeStatus: 'success',
        icon: <CheckCircleOutlined />,
      };
    case PinStatus.Failed:
      return {
        badgeStatus: 'error',
        icon: <CloseCircleOutlined />,
      };
    case PinStatus.Unknown:
    default:
      return {
        badgeStatus: 'default',
        icon: <QuestionCircleOutlined />,
      };
  }
}

/**
 * 格式化区块号（简化显示）
 */
function formatBlockNumber(blockNumber: number): string {
  if (blockNumber > 1000000) {
    return `#${(blockNumber / 1000000).toFixed(2)}M`;
  } else if (blockNumber > 1000) {
    return `#${(blockNumber / 1000).toFixed(2)}K`;
  }
  return `#${blockNumber}`;
}

/**
 * PinStatusBadge简化版（仅图标）
 */
export const PinStatusIcon: React.FC<Omit<PinStatusBadgeProps, 'showReplicas'>> = (props) => {
  return <PinStatusBadge {...props} showReplicas={false} />;
};

