/**
 * PinStatusIndicator 组件
 * 
 * 功能：显示CID的Pin状态和反馈信息
 * 
 * 特性：
 * - 实时显示pin成功/失败状态
 * - 错误码解释和建议操作
 * - 优雅的动画和图标
 * 
 * 创建时间：2025-10
 */

import React, { useState, useEffect } from 'react';
import { Alert, Badge, Button, Space, Tag, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  InfoCircleOutlined, 
  ReloadOutlined,
  SyncOutlined 
} from '@ant-design/icons';
import { 
  type AutoPinFailedData, 
  type AutoPinSuccessData, 
  AutoPinType,
  getPinErrorMessage, 
  getPinErrorSuggestion,
  getPinTypeName 
} from '@/hooks/useDeceasedEvents';

/**
 * 组件Props
 */
export interface PinStatusIndicatorProps {
  /** 逝者ID */
  deceasedId: number;
  /** Pin成功事件数据 */
  successData?: AutoPinSuccessData;
  /** Pin失败事件数据 */
  failedData?: AutoPinFailedData;
  /** 是否正在pin */
  loading?: boolean;
  /** 是否显示重试按钮 */
  showRetry?: boolean;
  /** 重试回调 */
  onRetry?: (deceasedId: number, pinType: AutoPinType) => void;
}

/**
 * Pin状态指示器组件
 * 
 * @example
 * ```tsx
 * <PinStatusIndicator
 *   deceasedId={123}
 *   successData={successEvent.data}
 * />
 * 
 * <PinStatusIndicator
 *   deceasedId={123}
 *   failedData={failedEvent.data}
 *   showRetry
 *   onRetry={handleRetry}
 * />
 * ```
 */
export const PinStatusIndicator: React.FC<PinStatusIndicatorProps> = ({
  deceasedId,
  successData,
  failedData,
  loading = false,
  showRetry = false,
  onRetry,
}) => {
  const [visible, setVisible] = useState(true);

  // 自动显示，5秒后可关闭
  useEffect(() => {
    if (successData || failedData) {
      setVisible(true);
    }
  }, [successData, failedData]);

  // 处理重试
  const handleRetry = () => {
    if (failedData && onRetry) {
      onRetry(deceasedId, failedData.pinType);
    }
  };

  // 正在pin
  if (loading) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<SyncOutlined spin />}
        message="正在固定到IPFS..."
        description="使用triple-charge机制扣费，请稍候"
      />
    );
  }

  // Pin成功
  if (successData && visible) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message={
          <Space>
            <span>{getPinTypeName(successData.pinType)}已成功固定到IPFS</span>
            <Badge count={3} style={{ backgroundColor: '#52c41a' }} />
          </Space>
        }
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ fontSize: 12, color: '#666' }}>
              CID: {successData.cid.substring(0, 20)}...
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              副本数：3个（默认） · 分布式存储已生效
            </div>
          </Space>
        }
        closable
        onClose={() => setVisible(false)}
        style={{ marginBottom: 12 }}
      />
    );
  }

  // Pin失败
  if (failedData && visible) {
    const errorMessage = getPinErrorMessage(failedData.errorCode);
    const suggestion = getPinErrorSuggestion(failedData.errorCode);

    return (
      <Alert
        type="warning"
        showIcon
        icon={<CloseCircleOutlined />}
        message={
          <Space>
            <span>{getPinTypeName(failedData.pinType)}固定失败</span>
            <Tag color="orange">错误码: {failedData.errorCode}</Tag>
          </Space>
        }
        description={
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <div>
              <strong>错误原因：</strong>{errorMessage}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              <InfoCircleOutlined /> {suggestion}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              CID: {failedData.cid.substring(0, 20)}...
            </div>
            {showRetry && onRetry && (
              <Button 
                size="small" 
                type="primary" 
                icon={<ReloadOutlined />}
                onClick={handleRetry}
              >
                重试固定
              </Button>
            )}
          </Space>
        }
        closable
        onClose={() => setVisible(false)}
        style={{ marginBottom: 12 }}
      />
    );
  }

  return null;
};

/**
 * Pin状态徽章组件（简洁版）
 */
export interface PinStatusBadgeProps {
  /** Pin成功事件数据 */
  successData?: AutoPinSuccessData;
  /** Pin失败事件数据 */
  failedData?: AutoPinFailedData;
  /** 是否正在pin */
  loading?: boolean;
}

export const PinStatusBadge: React.FC<PinStatusBadgeProps> = ({
  successData,
  failedData,
  loading = false,
}) => {
  if (loading) {
    return (
      <Tooltip title="正在固定到IPFS...">
        <Badge status="processing" text="Pin中" />
      </Tooltip>
    );
  }

  if (successData) {
    return (
      <Tooltip title={`已成功固定到IPFS（3个副本）`}>
        <Badge status="success" text="已Pin" />
      </Tooltip>
    );
  }

  if (failedData) {
    const errorMessage = getPinErrorMessage(failedData.errorCode);
    return (
      <Tooltip title={`Pin失败: ${errorMessage}`}>
        <Badge status="error" text="Pin失败" />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="未固定到IPFS">
      <Badge status="default" text="未Pin" />
    </Tooltip>
  );
};

export default PinStatusIndicator;

