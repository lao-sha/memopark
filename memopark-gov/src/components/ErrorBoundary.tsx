/**
 * 错误边界组件
 * 函数级中文注释：捕获并优雅处理 React 组件树中的 JavaScript 错误
 */

import React from 'react';
import { Button, Typography, Space, Alert } from 'antd';
import { ReloadOutlined, BugOutlined, HomeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 函数级中文注释：错误边界组件接口
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

/**
 * 函数级中文注释：错误回退组件接口
 */
interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  showDetails?: boolean;
}

/**
 * 函数级中文注释：默认错误回退组件
 */
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  showDetails = false
}) => (
  <div style={{
    padding: '40px 20px',
    textAlign: 'center',
    backgroundColor: '#fafafa',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <div style={{
      backgroundColor: '#fff',
      padding: '32px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      maxWidth: '500px',
      width: '100%'
    }}>
      <div style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }}>
        <BugOutlined />
      </div>

      <Title level={3} style={{ color: '#262626', marginBottom: '8px' }}>
        页面出现错误
      </Title>

      <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
        抱歉，页面在加载过程中遇到了意外错误。请尝试刷新页面或联系技术支持。
      </Text>

      {showDetails && (
        <Alert
          message="错误详情"
          description={
            <div style={{ textAlign: 'left' }}>
              <div><strong>错误信息:</strong> {error.message}</div>
              <div><strong>错误堆栈:</strong></div>
              <pre style={{
                backgroundColor: '#f6f8fa',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12px',
                marginTop: '8px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {error.stack}
              </pre>
            </div>
          }
          type="error"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      <Space>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={resetError}
        >
          重试
        </Button>
        <Button
          icon={<HomeOutlined />}
          onClick={() => window.location.href = '/#/wallet'}
        >
          返回首页
        </Button>
      </Space>
    </div>
  </div>
);

/**
 * 函数级中文注释：错误边界类组件
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 更新 state 使下一次渲染将显示降级后的 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误信息
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);

    // 调用错误处理回调
    this.props.onError?.(error, errorInfo);

    // 更新 state 包含错误信息
    this.setState({
      error,
      errorInfo
    });

    // 上报错误到监控系统（如果有的话）
    this.reportError(error, errorInfo);
  }

  /**
   * 函数级中文注释：上报错误到监控系统
   */
  private reportError = (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      // 这里可以集成错误监控服务，如 Sentry
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // 发送到错误收集服务（示例）
      console.log('上报错误:', errorReport);

      // 如果有 Sentry 或其他错误监控服务：
      // Sentry.captureException(error, { extra: errorReport });
    } catch (reportError) {
      console.error('上报错误失败:', reportError);
    }
  };

  /**
   * 函数级中文注释：重置错误状态
   */
  private resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 函数级中文注释：错误边界状态接口
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * 函数级中文注释：错误边界钩子（用于函数组件）
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
};

/**
 * 函数级中文注释：异步错误处理包装器
 */
export const withAsyncErrorHandler = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('异步操作失败:', error);
      throw error;
    }
  };
};

/**
 * 函数级中文注释：页面级错误边界包装器
 */
export const PageErrorBoundary: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error('页面错误:', error, errorInfo);
    }}
    showDetails={process.env.NODE_ENV === 'development'}
  >
    {children}
  </ErrorBoundary>
);

/**
 * 函数级中文注释：组件级错误边界包装器
 */
export const ComponentErrorBoundary: React.FC<{
  children: React.ReactNode;
  name?: string;
}> = ({ children, name = 'Component' }) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error(`${name} 错误:`, error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);
