import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import './index.css'

// 临时简化App组件用于测试
function TestApp() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Memopark 测试页面</h1>
      <p>如果你看到这个页面，说明基础React组件正常工作</p>
      <button onClick={() => alert('点击测试')}>测试按钮</button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TestApp />
  </StrictMode>,
)