/**
 * 操作进度指示组件
 * 函数级中文注释：提供清晰的操作进度反馈，提升用户体验
 */

import React from 'react';
import { Progress, Card, Space, Typography } from 'antd';

const { Text } = Typography;

/**
 * 函数级中文注释：操作步骤接口
 */
interface OperationStep {
  title: string;
  description?: string;
  status: 'wait' | 'process' | 'finish' | 'error';
  icon?: React.ReactNode;
}

/**
 * 函数级中文注释：操作进度配置接口
 */
interface ProgressConfig {
  steps: OperationStep[];
  current: number;
  percent?: number;
  showPercentage?: boolean;
  size?: 'default' | 'small';
  direction?: 'horizontal' | 'vertical';
}

/**
 * 函数级中文注释：通用进度指示组件
 */
export const OperationProgress: React.FC<{
  steps: string[];
  currentStep: number;
  status?: 'normal' | 'error' | 'success';
  showPercentage?: boolean;
  size?: 'small' | 'default' | 'large';
}> = ({
  steps,
  currentStep,
  status = 'normal',
  showPercentage = true,
  size = 'default'
}) => {
  const percent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: '8px' }}>
        <Text type="secondary">
          {steps[currentStep]} ({currentStep + 1}/{steps.length})
        </Text>
      </div>
      {showPercentage && (
        <Progress
          percent={percent}
          size={size === 'small' ? 6 : size === 'large' ? 12 : 8}
          status={status === 'error' ? 'exception' : status === 'success' ? 'success' : 'normal'}
          showInfo={false}
          strokeColor={
            status === 'error' ? '#ff4d4f' :
            status === 'success' ? '#52c41a' : '#1890ff'
          }
        />
      )}
    </div>
  );
};

/**
 * 函数级中文注释：步骤式进度指示组件（暂时禁用）
 */
export const StepProgress: React.FC<ProgressConfig> = ({
  steps,
  current,
  showPercentage = true,
  size = 'default',
  direction = 'horizontal'
}) => {
  // 使用参数避免警告
  void steps;
  void current;
  void showPercentage;
  void size;
  void direction;
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <div>步骤式进度指示（待实现）</div>
    </Card>
  );
};

/**
 * 函数级中文注释：内联进度指示组件
 */
export const InlineProgress: React.FC<{
  steps: string[];
  currentStep: number;
  status?: 'normal' | 'error' | 'success';
  compact?: boolean;
}> = ({
  steps,
  currentStep,
  status = 'normal',
  compact = false
}) => {
  const percent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <Space size="small" style={{ width: '100%', justifyContent: 'center' }}>
      <Text type="secondary" style={{ fontSize: compact ? '12px' : '14px' }}>
        {steps[currentStep]}
      </Text>
      <div style={{ minWidth: compact ? '60px' : '80px' }}>
        <Progress
          percent={percent}
          size={compact ? 4 : 6}
          status={status === 'error' ? 'exception' : status === 'success' ? 'success' : 'normal'}
          showInfo={false}
          strokeColor={
            status === 'error' ? '#ff4d4f' :
            status === 'success' ? '#52c41a' : '#1890ff'
          }
        />
      </div>
      <Text type="secondary" style={{ fontSize: compact ? '12px' : '14px' }}>
        {currentStep + 1}/{steps.length}
      </Text>
    </Space>
  );
};

/**
 * 函数级中文注释：操作进度钩子
 */
export const useOperationProgress = (
  steps: string[],
  onComplete?: () => void,
  onError?: (error: Error) => void
) => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [status, setStatus] = React.useState<'normal' | 'error' | 'success'>('normal');

  const nextStep = React.useCallback(() => {
    setCurrentStep(prev => {
      const next = prev + 1;
      if (next >= steps.length) {
        setStatus('success');
        onComplete?.();
        return prev; // 不超过最大步数
      }
      return next;
    });
  }, [steps.length, onComplete]);

  const setError = React.useCallback((error: Error) => {
    setStatus('error');
    onError?.(error);
  }, [onError]);

  const reset = React.useCallback(() => {
    setCurrentStep(0);
    setStatus('normal');
  }, []);

  const jumpToStep = React.useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps.length]);

  return {
    currentStep,
    status,
    nextStep,
    setError,
    reset,
    jumpToStep,
    isComplete: currentStep >= steps.length - 1 && status === 'success',
    isError: status === 'error',
    progress: Math.round(((currentStep + 1) / steps.length) * 100)
  };
};

/**
 * 函数级中文注释：预定义的操作步骤配置
 */
export const OPERATION_STEPS = {
  VOTE: ['验证权限', '检查余额', '构建交易', '签名发送', '等待确认'],
  PROPOSE: ['验证身份', '构建提案', '检查费用', '签名发送', '等待上链'],
  EXECUTE: ['检查阈值', '验证状态', '构建交易', '签名发送', '等待执行'],
  TRANSFER: ['验证地址', '检查余额', '构建转账', '签名发送', '等待确认']
} as const;
