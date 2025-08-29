import { Tabs, ConfigProvider } from 'antd'
import HomePage from './features/home/HomePage'
import ParksPage from './features/home/ParksPage'
import CelebritiesPage from './features/home/CelebritiesPage'
import GreatsPage from './features/home/GreatsPage'
import CreateListingForm from './features/otc/CreateListingForm'
import OpenOrderForm from './features/otc/OpenOrderForm'
import CreateMemorialForm from './features/memorial/CreateMemorialForm'
import LifeStoryPage from './features/home/LifeStoryPage'
import MemorialHallPage from './features/memorial/MemorialHallPage'
import AuthPage from './features/auth/AuthPage'
import './App.css'

/**
 * 函数级详细中文注释：应用根组件
 * - 集成首页（新样式）与陵园页（原首页）、创建挂单、吃单下单。
 * - 采用 Ant Design Tabs 作为简单的页面切换。
 */
function App() {
  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#2F80ED', borderRadius: 8 } }}
    >
      <div style={{ padding: 16 }}>
        <Tabs
          defaultActiveKey="home"
          items={[
            { key: 'home', label: '首页', children: <HomePage /> },
            { key: 'auth', label: '登录/注册', children: <AuthPage /> },
            { key: 'parks', label: '陵园', children: <ParksPage /> },
            { key: 'celebs', label: '名人馆', children: <CelebritiesPage /> },
            { key: 'greats', label: '伟人馆', children: <GreatsPage /> },
            { key: 'hall', label: '逝者纪念馆', children: <MemorialHallPage /> },
            { key: 'life', label: '生平故事', children: <LifeStoryPage /> },
            { key: 'memorial', label: '创建纪念馆', children: <CreateMemorialForm /> },
            { key: 'listing', label: '创建挂单', children: <CreateListingForm /> },
            { key: 'order', label: '吃单下单', children: <OpenOrderForm /> },
          ]}
        />
      </div>
    </ConfigProvider>
  )
}

export default App
