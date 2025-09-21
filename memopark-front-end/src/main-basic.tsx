import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// 最基础的测试，不使用任何外部库
function BasicApp() {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#333' }}>Memopark 基础测试</h1>
      <p>这是最基础的React组件，不依赖任何外部库</p>
      <button 
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => alert('基础功能正常')}
      >
        测试按钮
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BasicApp />
  </StrictMode>,
)