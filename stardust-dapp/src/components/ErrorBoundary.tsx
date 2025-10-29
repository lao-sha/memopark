import React from 'react'
import { Alert } from 'antd'

/**
 * 函数级详细中文注释：全局错误边界组件
 * - 捕获子树渲染期间发生的运行时错误，避免整页空白
 * - 在页面内展示友好的错误提示与详细信息，便于快速定位
 */
type ErrorBoundaryState = { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    // 记录错误以便调试
    console.error('[ErrorBoundary] 捕获到错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <Alert
            message="页面运行时错误"
            description={this.state.message}
            type="error"
            showIcon
          />
        </div>
      )
    }
    return this.props.children as React.ReactElement
  }
}

export default ErrorBoundary


