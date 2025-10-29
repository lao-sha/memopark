import { Routes, Route, Navigate } from 'react-router-dom'
import BasicLayout from './layouts/BasicLayout'
import BlankLayout from './layouts/BlankLayout'
import Dashboard from './pages/Dashboard'
import ProposalList from './pages/Proposals/List'
import ProposalDetail from './pages/Proposals/Detail'
import CreateProposal from './pages/Proposals/Create'
import Applications from './pages/Applications'
import Voting from './pages/Voting'
import Analytics from './pages/Analytics'
import Members from './pages/Members'
import ContentGovernance from './pages/ContentGovernance'
import TracksPage from './pages/Tracks'
import ReferendaList from './pages/Referenda/List'
import ReferendumDetail from './pages/Referenda/Detail'
import CommitteesPage from './pages/Committees'
import ArbitrationPage from './pages/Arbitration'
import GraveGovernancePage from './pages/GraveGovernance'
import ParkGovernancePage from './pages/ParkGovernance'
import OperatorManagement from './pages/OperatorManagement'
import MarketMakerGovernance from './pages/MarketMakerGovernance'
import MarketMakerQuickApproval from './pages/MarketMakerQuickApproval'
import MarketMakerListing from './pages/MarketMakerListing'
import TreasuryCommittee from './pages/TreasuryCommittee'
import RecoverWallet from './pages/Wallet/Recover'
import ManageWallet from './pages/Wallet/Manage'
import MonitoringPage from './pages/Monitoring'
import QueueManager from './components/Operations/QueueManager'
import DataExporter from './components/Operations/DataExporter'
import AppealStatistics from './components/Analytics/AppealStatistics'

/**
 * 主应用组件
 * 配置路由和布局
 */
function App() {
  return (
    <Routes>
      {/* 空白布局（登录页、钱包管理等） */}
      <Route path="/login" element={<BlankLayout />}>
        <Route index element={<div>登录页（待实现）</div>} />
      </Route>

      {/* 钱包恢复（独立页面，不需要创建钱包功能） */}
      <Route path="/wallet/recover" element={<RecoverWallet />} />

      {/* 主布局 */}
      <Route path="/" element={<BasicLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* 提案管理 */}
        <Route path="proposals">
          <Route index element={<ProposalList />} />
          <Route path=":id" element={<ProposalDetail />} />
          <Route path="create" element={<CreateProposal />} />
        </Route>

        {/* 投票管理 */}
        <Route path="voting">
          <Route index element={<Voting />} />
        </Route>

        {/* 申请审核 */}
        <Route path="applications">
          <Route index element={<Applications />} />
        </Route>

        {/* 内容治理 */}
        <Route path="content-governance">
          <Route index element={<ContentGovernance />} />
        </Route>

        {/* 数据分析 */}
        <Route path="analytics">
          <Route index element={<Analytics />} />
        </Route>

        {/* 成员管理 */}
        <Route path="members">
          <Route index element={<Members />} />
        </Route>

        {/* 公投管理 */}
        <Route path="referenda">
          <Route index element={<ReferendaList />} />
          <Route path=":id" element={<ReferendumDetail />} />
        </Route>

        {/* 委员会管理 */}
        <Route path="committees">
          <Route index element={<CommitteesPage />} />
        </Route>

        {/* 财务委员会 */}
        <Route path="treasury-committee">
          <Route index element={<TreasuryCommittee />} />
        </Route>

        {/* 仲裁管理 */}
        <Route path="arbitration">
          <Route index element={<ArbitrationPage />} />
        </Route>

        {/* 墓地治理 */}
        <Route path="grave-governance">
          <Route index element={<GraveGovernancePage />} />
        </Route>

        {/* 陵园治理 */}
        <Route path="park-governance">
          <Route index element={<ParkGovernancePage />} />
        </Route>

        {/* 轨道配置 */}
        <Route path="tracks">
          <Route index element={<TracksPage />} />
        </Route>

        {/* 运营者管理 */}
        <Route path="operator-management">
          <Route index element={<OperatorManagement />} />
        </Route>

        {/* 做市商治理审批 */}
        <Route path="market-maker-governance">
          <Route index element={<MarketMakerGovernance />} />
        </Route>

        {/* 做市商快速审批 */}
        <Route path="market-maker-quick-approval">
          <Route index element={<MarketMakerQuickApproval />} />
        </Route>

        {/* 做市商创建挂单 */}
        <Route path="market-maker-listing">
          <Route index element={<MarketMakerListing />} />
        </Route>

        {/* 钱包管理（在主布局中） */}
        <Route path="wallet/manage" element={<ManageWallet />} />

        {/* 监控Dashboard */}
        <Route path="monitoring">
          <Route index element={<MonitoringPage />} />
        </Route>

        {/* 运维工具 */}
        <Route path="operations">
          <Route path="queue-manager" element={<QueueManager />} />
          <Route path="data-exporter" element={<DataExporter />} />
        </Route>

        {/* 数据分析 */}
        <Route path="analytics-appeals">
          <Route index element={<AppealStatistics />} />
        </Route>

        {/* 设置 */}
        <Route path="settings">
          <Route index element={<div>设置（待实现）</div>} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<div>404 页面未找到</div>} />
    </Routes>
  )
}

export default App

