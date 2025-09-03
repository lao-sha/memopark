import { Tabs, ConfigProvider, Button, Space, Typography } from 'antd'
import { useWallet } from './providers/WalletProvider'
import { TxQueueDrawer } from './components/TxQueueDrawer'
import HomePage from './features/home/HomePage'
import ParksPage from './features/home/ParksPage'
import CelebritiesPage from './features/home/CelebritiesPage'
import GreatsPage from './features/home/GreatsPage'
import CreateListingForm from './features/otc/CreateListingForm'
import OpenOrderForm from './features/otc/OpenOrderForm'
import CreateMemorialForm from './features/memorial/CreateMemorialForm'
import HallPage from './features/memorial/HallPage'
import SubmitEvidencePage from './features/evidence/SubmitEvidencePage'
import ArbitrationPage from './features/arbitration/ArbitrationPage'
import LifeStoryPage from './features/home/LifeStoryPage'
import MemorialHallPage from './features/memorial/MemorialHallPage'
import AuthPage from './features/auth/AuthPage'
import RequestPinForm from './features/storage/RequestPinForm'
import EndowmentAuditPage from './features/storage/EndowmentAuditPage'
import EndowmentAdminPage from './features/storage/EndowmentAdminPage'
import KinshipForm from './features/grave/KinshipForm'
import RelationProposalForm from './features/grave/RelationProposalForm'
import ActionsBar from './features/grave/ActionsBar'
import VisibilitySettings from './features/grave/VisibilitySettings'
import PolicyViewer from './features/grave/PolicyViewer'
import TopGravesPage from './features/ledger/TopGravesPage'
import MyOtcPage from './features/otc/MyOtcPage'
import CasesPage from './features/arbitration/CasesPage'
import ArbDashboardPage from './features/arbitration/ArbDashboardPage'
import NotificationCenterPage from './features/notifications/NotificationCenterPage'
import GuestbookPage from './features/guestbook/GuestbookPage'
import LedgerOverviewPage from './features/ledger/LedgerOverviewPage'
import OfferPage from './features/offerings/OfferPage'
import OrderDetailPage from './features/otc/OrderDetailPage'
import RewardParamsPanel from './features/affiliate/RewardParamsPanel'
import './App.css'

/**
 * 函数级详细中文注释：应用根组件
 * - 集成首页（新样式）与陵园页（原首页）、创建挂单、吃单下单。
 * - 采用 Ant Design Tabs 作为简单的页面切换。
 */
function App() {
  const wallet = useWallet()
  const [open, setOpen] = useState(false) as any
  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#2F80ED', borderRadius: 8 } }}
    >
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>Memopark</Typography.Title>
          <Space>
            <Button size="small" onClick={()=>setOpen(true)}>交易队列</Button>
            {wallet.connected ? (
              <Button onClick={()=>wallet.disconnect()} size="small">已连接 · {wallet.current?.slice(0,6)}...{wallet.current?.slice(-4)}</Button>
            ) : (
              <Button type="primary" size="small" onClick={()=>wallet.connect()}>连接钱包</Button>
            )}
          </Space>
        </div>
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
            { key: 'hall', label: '纪念馆详情', children: <HallPage id={1} /> },
            { key: 'listing', label: '创建挂单', children: <CreateListingForm /> },
            { key: 'order', label: '吃单下单', children: <OpenOrderForm /> },
            { key: 'ipfs', label: '存储下单', children: <RequestPinForm /> },
            { key: 'evidence', label: '证据提交(代付)', children: <SubmitEvidencePage /> },
            { key: 'arbitration', label: '仲裁(代付)', children: <ArbitrationPage /> },
            { key: 'top', label: '排行榜', children: <TopGravesPage /> },
            { key: 'ledger', label: '台账概览', children: <LedgerOverviewPage /> },
            { key: 'offer', label: '供奉下单', children: <OfferPage /> },
            { key: 'my-otc', label: '我的OTC', children: <MyOtcPage /> },
            { key: 'order-detail', label: '订单详情', children: <OrderDetailPage /> },
            { key: 'cases', label: '仲裁列表', children: <CasesPage /> },
            { key: 'arb-dash', label: '仲裁仪表盘', children: <ArbDashboardPage /> },
            { key: 'notify', label: '通知中心', children: <NotificationCenterPage /> },
            { key: 'guestbook', label: '留言板', children: <GuestbookPage /> },
            { key: 'audit', label: '基金审计', children: <EndowmentAuditPage /> },
            { key: 'endow-admin', label: '基金治理(演示)', children: <EndowmentAdminPage /> },
            { key: 'reward-params', label: '奖励参数', children: <RewardParamsPanel /> },
            { key: 'kinship', label: '声明亲属关系', children: <KinshipForm /> },
            { key: 'rel-propose', label: '关系申请', children: <RelationProposalForm /> },
            { key: 'actions', label: '纪念动作栏', children: <ActionsBar graveId={1} /> },
            { key: 'visibility', label: '可见性设置', children: <VisibilitySettings /> },
            { key: 'policy', label: '策略/关注查看', children: <PolicyViewer /> },
          ]}
        />
      </div>
      <TxQueueDrawer open={open} onClose={()=>setOpen(false)} items={wallet.queue as any} />
    </ConfigProvider>
  )
}

export default App
