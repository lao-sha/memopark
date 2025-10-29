/**
 * 骨架屏组件
 * 函数级中文注释：提供优雅的加载占位符，提升用户体验
 */

import React from 'react';
import { Skeleton, Card, Row, Col, Space } from 'antd';

/**
 * 函数级中文注释：通用骨架屏组件
 */
export const LoadingSkeleton: React.FC<{
  rows?: number;
  avatar?: boolean;
  title?: boolean;
  paragraph?: boolean;
  active?: boolean;
}> = ({
  rows = 3,
  avatar = false,
  title = true,
  paragraph = true,
  active = true
}) => (
  <div style={{ padding: '16px 0' }}>
    {Array.from({ length: rows }).map((_, index) => (
      <Card key={index} style={{ marginBottom: 16 }}>
        <Skeleton
          loading={true}
          avatar={avatar}
          title={title}
          paragraph={{ rows: paragraph ? 2 : 0 }}
          active={active}
        />
      </Card>
    ))}
  </div>
);

/**
 * 函数级中文注释：表格骨架屏组件
 */
export const TableSkeleton: React.FC<{
  columns?: number;
  rows?: number;
  showHeader?: boolean;
}> = ({
  columns = 6,
  rows = 5,
  showHeader = true
}) => (
  <div style={{ padding: '16px 0' }}>
    {showHeader && (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Col key={index} span={24 / columns}>
            <Skeleton.Input
              style={{ width: '100%' }}
              active={true}
              size="small"
            />
          </Col>
        ))}
      </Row>
    )}

    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Row key={rowIndex} gutter={16} style={{ marginBottom: 12 }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Col key={colIndex} span={24 / columns}>
            <Skeleton.Input
              style={{ width: '100%' }}
              active={true}
              size="small"
            />
          </Col>
        ))}
      </Row>
    ))}
  </div>
);

/**
 * 函数级中文注释：统计卡片骨架屏组件
 */
export const StatsSkeleton: React.FC<{
  count?: number;
}> = ({ count = 4 }) => (
  <Row gutter={16} style={{ marginBottom: 24 }}>
    {Array.from({ length: count }).map((_, index) => (
      <Col key={index} span={24 / count}>
        <Card>
          <Skeleton active={true} paragraph={false}>
            <div style={{ height: '60px' }} />
          </Skeleton>
        </Card>
      </Col>
    ))}
  </Row>
);

/**
 * 函数级中文注释：按钮骨架屏组件
 */
export const ButtonSkeleton: React.FC<{
  count?: number;
  size?: 'small' | 'default' | 'large';
}> = ({
  count = 3,
  size = 'default'
}) => (
  <Space>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton.Button
        key={index}
        active={true}
        size={size}
        shape="round"
      />
    ))}
  </Space>
);

/**
 * 函数级中文注释：页面级骨架屏组件
 */
export const PageSkeleton: React.FC = () => (
  <div style={{ padding: 24 }}>
    {/* 统计区域骨架屏 */}
    <StatsSkeleton count={4} />

    {/* 操作区域骨架屏 */}
    <Card style={{ marginBottom: 24 }}>
      <Skeleton active={true} paragraph={{ rows: 1 }}>
        <div style={{ height: '40px' }} />
      </Skeleton>
    </Card>

    {/* 表格骨架屏 */}
    <Card>
      <TableSkeleton columns={6} rows={8} />
    </Card>
  </div>
);

/**
 * 函数级中文注释：自定义骨架屏钩子
 */
export const useSkeletonLoading = (
  loading: boolean,
  skeletonComponent: React.ReactNode,
  contentComponent: React.ReactNode
) => {
  return loading ? skeletonComponent : contentComponent;
};

/**
 * 函数级中文注释：渐进式骨架屏组件
 */
export const ProgressiveSkeleton: React.FC<{
  steps: Array<{
    component: React.ReactNode;
    delay: number;
  }>;
  loading: boolean;
}> = ({ steps, loading }) => {
  const [currentStep, setCurrentStep] = React.useState(0);

  React.useEffect(() => {
    if (!loading) {
      setCurrentStep(0);
      return;
    }

    const timers: NodeJS.Timeout[] = [];

    steps.forEach((step, index) => {
      const timer = setTimeout(() => {
        setCurrentStep(index);
      }, step.delay);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [loading, steps]);

  if (!loading) {
    return <>{steps[steps.length - 1]?.component}</>;
  }

  return <>{steps[currentStep]?.component}</>;
};
