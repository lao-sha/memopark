import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'antd/dist/reset.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

// 调试：在 React 渲染前更新占位文案，确认模块已执行
try {
  const el = document.getElementById('root')
  if (el && el.firstElementChild) {
    el.firstElementChild.textContent = 'main.tsx 已加载，准备挂载 React…'
  }
  // 标记到全局以便排查
  ;(window as any).__memopark_main_loaded__ = true
} catch (e) {
  console.error('[main.tsx] pre-mount error', e)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
