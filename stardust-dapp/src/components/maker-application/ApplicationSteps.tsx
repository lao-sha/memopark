/**
 * 做市商申请步骤指示器组件
 * 
 * 功能级详细中文注释：
 * 1. 显示做市商申请的三个步骤
 * 2. 高亮当前步骤
 * 3. 提供清晰的步骤说明
 * 
 * 创建日期: 2025-10-29
 * 来源: 从CreateMarketMakerPage.tsx中提取
 */

import React from 'react';
import { Steps } from 'antd';
import { 
  LockOutlined, 
  FileTextOutlined, 
  ClockCircleOutlined 
} from '@ant-design/icons';
import { ApplicationStep } from '../../features/otc/types/marketMaker.types';

/**
 * 函数级详细中文注释：组件Props接口
 */
interface ApplicationStepsProps {
  /** 当前步骤索引 (0-2) */
  current: ApplicationStep;
  /** 可选的自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 函数级详细中文注释：申请步骤指示器组件
 * 
 * @param current - 当前步骤 (0: 质押, 1: 提交资料, 2: 审核)
 * @param style - 可选的自定义样式
 * 
 * @example
 * ```tsx
 * <ApplicationSteps current={ApplicationStep.Deposit} />
 * ```
 */
export const ApplicationSteps: React.FC<ApplicationStepsProps> = ({ 
  current,
  style 
}) => {
  /**
   * 函数级详细中文注释：步骤配置
   * 
   * 定义三个申请步骤的标题、描述和图标
   */
  const steps = [
    {
      title: '质押 DUST',
      description: '质押最低金额，获取做市商ID',
      icon: <LockOutlined />,
    },
    {
      title: '提交资料',
      description: '上传证件，填写费率配置',
      icon: <FileTextOutlined />,
    },
    {
      title: '等待审核',
      description: '治理委员会审核通过后激活',
      icon: <ClockCircleOutlined />,
    },
  ];

  return (
    <Steps 
      current={current} 
      items={steps}
      style={{ 
        marginBottom: 24,
        ...style 
      }}
    />
  );
};

/**
 * 默认导出
 */
export default ApplicationSteps;

