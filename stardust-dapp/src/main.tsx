import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'antd/dist/reset.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

// 标记到全局，立即执行，防止后备加载被触发
;(window as any).__memopark_main_loaded__ = true

// 防止重复创建 root
if (!(window as any).__memopark_root__) {
  // 调试：在 React 渲染前更新占位文案
  try {
    const el = document.getElementById('root')
    if (el && el.firstElementChild) {
      el.firstElementChild.textContent = 'main.tsx 已加载，准备挂载 React…'
    }
  } catch (e) {
    console.error('[main.tsx] pre-mount error', e)
  }

  const root = createRoot(document.getElementById('root')!)
  ;(window as any).__memopark_root__ = root
  
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
} else {
  console.log('[main.tsx] Root already exists, skipping createRoot')
}
