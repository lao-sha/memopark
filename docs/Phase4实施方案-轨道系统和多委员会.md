# Phase 4 实施方案：轨道系统+多委员会支持

## 一、方案总览

### 目标
实现OpenGov轨道系统和多委员会支持，使治理平台能够：
1. 支持不同类型的治理提案（不同参数配置）
2. 管理多个委员会（Council、Technical、Content）
3. 按轨道分类展示和管理公投
4. 提供统一的权限控制

### 时间线
- **Week 1**: 轨道系统基础
- **Week 2**: 公投管理
- **Week 3**: 多委员会支持

### 交付成果
- 6个新页面
- 5个新服务模块
- 4个新Hook
- 10+个新组件
- 完整文档

---

## 二、Week 1: 轨道系统基础（详细方案）

### 2.1 轨道服务层

**文件**: `src/services/blockchain/tracks.ts`

**功能**：
```typescript
// 1. 数据结构定义
export interface TrackInfo {
  id: number
  name: string
  maxDeciding: number
  decisionDeposit: string
  preparePeriod: number
  decisionPeriod: number
  confirmPeriod: number
  minEnactmentPeriod: number
  minApproval: any
  minSupport: any
}

// 2. 核心函数
export async function getTracks(api: ApiPromise): Promise<TrackInfo[]>
export function getTrackName(trackId: number): string
export function getTrackColor(trackId: number): string
export function getTrackIcon(trackId: number): ReactNode
export function getTrackRiskLevel(trackId: number): string
```

**实现要点**：
```typescript
// 从链上常量获取轨道配置
const tracksConst = await api.consts.referenda.tracks
const tracksData = tracksConst.toJSON() as any[]

// 解析并格式化
const tracks = tracksData.map(([id, config]) => ({
  id,
  name: getTrackName(id),
  maxDeciding: config.maxDeciding,
  decisionDeposit: config.decisionDeposit,
  // ... 其他字段
}))

// 轨道名称映射
const TRACK_NAMES = {
  0: 'Root',
  1: 'Whitelisted Caller',
  2: 'Treasurer',
  3: 'Medium Spender',
  4: 'Big Spender',
  10: 'Market Maker',
  11: 'Arbitration',
  20: 'Content Governance',
  21: 'Park Management'
}
```

**预计代码量**: 200行

---

### 2.2 轨道Hook

**文件**: `src/hooks/useTracks.ts`

**功能**：
```typescript
export function useTracks() {
  const { api, isReady } = useApi()
  const [tracks, setTracks] = useState<TrackInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    if (!isReady || !api) return
    
    const loadTracks = async () => {
      setLoading(true)
      try {
        const data = await getTracks(api)
        setTracks(data)
      } catch (e) {
        setError(e as Error)
      } finally {
        setLoading(false)
      }
    }
    
    loadTracks()
  }, [api, isReady])
  
  return { tracks, loading, error, reload: loadTracks }
}

// 获取单个轨道
export function useTrack(trackId: number) {
  const { tracks } = useTracks()
  return tracks.find(t => t.id === trackId)
}
```

**预计代码量**: 80行

---

### 2.3 轨道选择器组件

**文件**: `src/components/TrackSelector/index.tsx`

**UI设计**：
```
┌─────────────────────────────────────────┐
│ 选择治理轨道                             │
├─────────────────────────────────────────┤
│ ┌───────────────────────────────────┐   │
│ │ 🔴 Root轨道         [已选择]      │   │
│ │ 系统升级、危险调用                 │   │
│ │ ┌──────┬──────┬──────┬─────────┐ │   │
│ │ │押金   │决策期│确认期│风险等级  │ │   │
│ │ │1000  │28天  │24h  │⭐⭐⭐⭐⭐│ │   │
│ │ └──────┴──────┴──────┴─────────┘ │   │
│ └───────────────────────────────────┘   │
│                                         │
│ ┌───────────────────────────────────┐   │
│ │ 🟢 财库轨道                        │   │
│ │ 资金支出、预算分配                 │   │
│ │ ┌──────┬──────┬──────┬─────────┐ │   │
│ │ │押金   │决策期│确认期│风险等级  │ │   │
│ │ │100   │14天  │12h  │⭐⭐⭐⭐  │ │   │
│ │ └──────┴──────┴──────┴─────────┘ │   │
│ └───────────────────────────────────┘   │
│                                         │
│ ┌───────────────────────────────────┐   │
│ │ 🟡 内容轨道                        │   │
│ │ 内容治理、申诉处理                 │   │
│ │ ┌──────┬──────┬──────┬─────────┐ │   │
│ │ │押金   │决策期│确认期│风险等级  │ │   │
│ │ │10    │3天   │3h   │⭐⭐      │ │   │
│ │ └──────┴──────┴──────┴─────────┘ │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**功能要点**：
```typescript
interface Props {
  value?: number
  onChange?: (trackId: number) => void
  showDetails?: boolean  // 是否显示详细参数
  filter?: (track: TrackInfo) => boolean  // 筛选函数
}

// 使用
<TrackSelector
  value={selectedTrack}
  onChange={setSelectedTrack}
  showDetails={true}
  filter={(track) => track.id !== 0}  // 排除Root轨道
/>
```

**预计代码量**: 150行

---

### 2.4 轨道信息卡片组件

**文件**: `src/components/TrackInfoCard/index.tsx`

**功能**: 紧凑展示单个轨道信息

```typescript
export function TrackInfoCard({ track }: { track: TrackInfo }) {
  return (
    <Card size="small">
      <Space>
        <Tag color={getTrackColor(track.id)}>{track.name}</Tag>
        <Typography.Text type="secondary">
          押金: {formatBalance(track.decisionDeposit)} MEMO
        </Typography.Text>
        <Typography.Text type="secondary">
          决策期: {formatDays(track.decisionPeriod)}
        </Typography.Text>
      </Space>
    </Card>
  )
}
```

**预计代码量**: 80行

---

### 2.5 在现有页面集成轨道

#### 提案列表添加轨道标签

**修改**: `src/pages/Proposals/List/index.tsx`

```typescript
// 添加轨道列
{
  title: '轨道',
  key: 'track',
  width: 120,
  render: (_, record) => {
    // 从proposal call中推断轨道
    const trackId = inferTrackFromCall(record.call)
    return (
      <Tag color={getTrackColor(trackId)}>
        {getTrackName(trackId)}
      </Tag>
    )
  }
}

// 推断轨道的函数
function inferTrackFromCall(call: any): number {
  if (!call) return 0
  
  // 根据调用类型推断轨道
  if (call.section === 'marketMaker') return 10  // Market Maker轨道
  if (call.section === 'memoContentGovernance') return 20  // Content轨道
  if (call.section === 'treasury') return 2  // Treasury轨道
  
  return 0  // 默认Root轨道
}
```

#### 仪表盘添加轨道统计

**修改**: `src/pages/Dashboard/index.tsx`

```typescript
// 添加轨道统计卡片
<Row gutter={16}>
  <Col span={6}>
    <Card title="Root轨道">
      <Statistic value={getReferendaCountByTrack(0)} suffix="个" />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="财库轨道">
      <Statistic value={getReferendaCountByTrack(2)} suffix="个" />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="内容轨道">
      <Statistic value={getReferendaCountByTrack(20)} suffix="个" />
    </Card>
  </Col>
</Row>
```

---

## 三、Week 2: 公投管理（详细方案）

### 3.1 公投服务层

**文件**: `src/services/blockchain/referenda.ts`

**功能**：
```typescript
// 1. 数据结构
export interface ReferendumInfo {
  id: number
  trackId: number
  proposal: any
  submitter: string
  submissionDeposit: string
  decisionDeposit: string
  deciding: {
    since: number
    confirming: number | null
  } | null
  tally: {
    ayes: string
    nays: string
    support: string
  }
  alarm: [number, [number, number]] | null
  inQueue: boolean
}

// 2. 核心函数
export async function getAllReferenda(api: ApiPromise): Promise<ReferendumInfo[]>
export async function getReferendumsByTrack(api: ApiPromise, trackId: number): Promise<ReferendumInfo[]>
export async function getReferendumInfo(api: ApiPromise, refId: number): Promise<ReferendumInfo | null>
export async function getOngoingReferenda(api: ApiPromise): Promise<ReferendumInfo[]>
```

**实现要点**：
```typescript
export async function getAllReferenda(api: ApiPromise): Promise<ReferendumInfo[]> {
  try {
    // 获取公投总数
    const count: any = await api.query.referenda.referendumCount()
    const total = Number(count.toString())
    
    const referenda: ReferendumInfo[] = []
    
    // 遍历查询
    for (let id = 0; id < total; id++) {
      const refOption: any = await api.query.referenda.referendumInfoFor(id)
      
      if (refOption.isSome) {
        const refInfo = refOption.unwrap()
        const refData = refInfo.toJSON() as any
        
        // 解析ongoing状态
        if (refData.ongoing) {
          referenda.push({
            id,
            trackId: refData.ongoing.track,
            proposal: refData.ongoing.proposal,
            submitter: refData.ongoing.submitter,
            // ... 解析其他字段
          })
        }
      }
    }
    
    return referenda
  } catch (e) {
    console.error('[Referenda] 获取失败:', e)
    throw e
  }
}
```

**预计代码量**: 250行

---

### 3.2 公投Hook

**文件**: `src/hooks/useReferenda.ts`

```typescript
export function useReferenda(trackId?: number) {
  const { api, isReady } = useApi()
  const [referenda, setReferenda] = useState<ReferendumInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const loadReferenda = useCallback(async () => {
    if (!isReady || !api) return
    
    setLoading(true)
    setError(null)
    
    try {
      const data = trackId !== undefined
        ? await getReferendumsByTrack(api, trackId)
        : await getAllReferenda(api)
      
      setReferenda(data)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [api, isReady, trackId])
  
  useEffect(() => {
    loadReferenda()
  }, [loadReferenda])
  
  return { referenda, loading, error, reload: loadReferenda }
}
```

**预计代码量**: 100行

---

### 3.3 公投列表页面

**文件**: `src/pages/Referenda/List/index.tsx`

**UI布局**：
```
┌─────────────────────────────────────────────────┐
│                                    [刷新]        │
├──────────┬──────────────────────────────────────┤
│          │ 公投列表                              │
│ 轨道筛选  │ ┌─────────────────────────────────┐ │
│          │ │ 轨道: [全部▼]                    │ │
│ ☑ 全部   │ │ 状态: [进行中▼]                  │ │
│   (15)   │ └─────────────────────────────────┘ │
│          │                                      │
│ Root     │ ID | 轨道 | 标题 | 进度 | 状态 | 操作│
│   (2)    │ #8 | 内容 | 删除XX | 78% | 进行中 |   │
│          │ #7 | 财库 | 支出YY | 65% | 进行中 |   │
│ 财库     │ #6 | Root | 升级ZZ | 100%| 已通过 |   │
│   (5)    │                                      │
│          │ [上一页] [1] [2] [3] [下一页]        │
│ 内容     │                                      │
│   (8)    │                                      │
│          │                                      │
│ 其他     │                                      │
│   (0)    │                                      │
└──────────┴──────────────────────────────────────┘
```

**功能实现**：
```typescript
export default function ReferendaList() {
  const [selectedTrack, setSelectedTrack] = useState<number | undefined>()
  const { tracks } = useTracks()
  const { referenda, loading } = useReferenda(selectedTrack)
  
  return (
    <Row gutter={24}>
      {/* 左侧：轨道筛选 */}
      <Col span={6}>
        <Card title="按轨道筛选">
          <Menu
            selectedKeys={selectedTrack ? [String(selectedTrack)] : ['all']}
            onClick={({ key }) => 
              setSelectedTrack(key === 'all' ? undefined : Number(key))
            }
          >
            <Menu.Item key="all">
              全部轨道 ({referenda.length})
            </Menu.Item>
            {tracks.map(track => (
              <Menu.Item key={track.id}>
                <Space>
                  <Tag color={getTrackColor(track.id)}>
                    {track.name}
                  </Tag>
                  <span>
                    ({referenda.filter(r => r.trackId === track.id).length})
                  </span>
                </Space>
              </Menu.Item>
            ))}
          </Menu>
        </Card>
      </Col>
      
      {/* 右侧：公投列表 */}
      <Col span={18}>
        <Card title="公投列表">
          <Table
            columns={columns}
            dataSource={referenda}
            loading={loading}
            pagination={{ pageSize: 20 }}
          />
        </Card>
      </Col>
    </Row>
  )
}
```

**列配置**：
```typescript
const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 80,
    render: (id) => `#${id}`
  },
  {
    title: '轨道',
    dataIndex: 'trackId',
    width: 150,
    render: (trackId) => (
      <Tag color={getTrackColor(trackId)}>
        {getTrackName(trackId)}
      </Tag>
    )
  },
  {
    title: '提案',
    key: 'proposal',
    render: (_, record) => renderProposal(record.proposal)
  },
  {
    title: '投票进度',
    key: 'tally',
    width: 200,
    render: (_, record) => (
      <div>
        <Progress
          percent={calculateApproval(record.tally)}
          status="active"
        />
        <div style={{ fontSize: 12 }}>
          Aye: {formatBalance(record.tally.ayes)} | 
          Nay: {formatBalance(record.tally.nays)}
        </div>
      </div>
    )
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render: (_, record) => {
      if (record.deciding) {
        return <Tag color="green">进行中</Tag>
      }
      if (record.inQueue) {
        return <Tag color="orange">队列中</Tag>
      }
      return <Tag>准备中</Tag>
    }
  },
  {
    title: '操作',
    key: 'action',
    width: 150,
    render: (_, record) => (
      <Space>
        <Button size="small" onClick={() => navigate(`/referenda/${record.id}`)}>
          查看详情
        </Button>
      </Space>
    )
  }
]
```

**预计代码量**: 350行

---

### 3.4 公投详情页面

**文件**: `src/pages/Referenda/Detail/index.tsx`

**UI设计**：
```
┌─────────────────────────────────────────────┐
│ 公投 #8 详情                                 │
├─────────────────────────────────────────────┤
│ ┌───────────────────────────────────────┐   │
│ │ 基本信息                               │   │
│ │ 轨道: [内容] Content Governance        │   │
│ │ 提案人: 0x1234...5678                  │   │
│ │ 提交押金: 10 MEMO                      │   │
│ │ 决策押金: 10 MEMO                      │   │
│ │ 状态: 🟢 进行中                        │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ ┌───────────────────────────────────────┐   │
│ │ 投票情况                               │   │
│ │ Aye: ████████████░░ 78%               │   │
│ │      1,234,567 MEMO (2,345个账户)     │   │
│ │                                       │   │
│ │ Nay: ███░░░░░░░░░░ 22%               │   │
│ │      345,678 MEMO (567个账户)         │   │
│ │                                       │   │
│ │ Support: 45% (需要 > 30%)             │   │
│ │ Approval: 78% (需要 > 50%)            │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ ┌───────────────────────────────────────┐   │
│ │ 时间线                                 │   │
│ │ 提交时间: 2025-10-01 10:00             │   │
│ │ 决策开始: 2025-10-02 10:00             │   │
│ │ 决策截止: 2025-10-05 10:00 (还剩2天)  │   │
│ │ 确认期: 未开始                         │   │
│ │ 最早执行: 2025-10-06 13:00             │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ ┌───────────────────────────────────────┐   │
│ │ Preimage                               │   │
│ │ Hash: 0xabcd1234...                    │   │
│ │ [查看Preimage内容]                     │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ ┌───────────────────────────────────────┐   │
│ │ 管理操作（仅Root）                     │   │
│ │ [取消公投] [强制通过] [延长投票期]     │   │
│ └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**预计代码量**: 300行

---

## 四、Week 3: 多委员会支持（详细方案）

### 4.1 委员会类型定义

**文件**: `src/types/committee.ts`

```typescript
/**
 * 委员会类型
 */
export type CommitteeType = 
  | 'council'              // 主委员会
  | 'technicalCommittee'   // 技术委员会
  | 'contentCommittee'     // 内容委员会

/**
 * 委员会配置
 */
export interface CommitteeConfig {
  key: CommitteeType
  name: string
  nameEn: string
  icon: ReactNode
  palletName: string
  description: string
  color: string
  defaultThreshold: number
}

/**
 * 委员会配置列表
 */
export const COMMITTEES: CommitteeConfig[] = [
  {
    key: 'council',
    name: '主委员会',
    nameEn: 'Council',
    icon: <TeamOutlined />,
    palletName: 'council',
    description: '负责整体治理决策、做市商审批等',
    color: 'blue',
    defaultThreshold: 2
  },
  {
    key: 'technicalCommittee',
    name: '技术委员会',
    nameEn: 'Technical Committee',
    icon: <CodeOutlined />,
    palletName: 'technicalCommittee',
    description: '负责技术升级、紧急修复、链参数调整',
    color: 'purple',
    defaultThreshold: 2
  },
  {
    key: 'contentCommittee',
    name: '内容委员会',
    nameEn: 'Content Committee',
    icon: <SafetyOutlined />,
    palletName: 'contentCommittee',
    description: '负责内容审核、申诉处理、违规处理',
    color: 'orange',
    defaultThreshold: 2
  }
]

/**
 * 根据key获取配置
 */
export function getCommitteeConfig(key: CommitteeType): CommitteeConfig {
  return COMMITTEES.find(c => c.key === key)!
}
```

**预计代码量**: 80行

---

### 4.2 通用委员会Hook

**文件**: `src/hooks/useCollective.ts`

```typescript
/**
 * 通用委员会Hook
 * 支持任意委员会实例
 */
export function useCollective(committeeType: CommitteeType) {
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const [proposals, setProposals] = useState<ProposalInfo[]>([])
  const [members, setMembers] = useState<string[]>([])
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const config = getCommitteeConfig(committeeType)
  
  useEffect(() => {
    if (!isReady || !api) return
    
    const loadData = async () => {
      setLoading(true)
      try {
        // 根据委员会类型选择pallet
        const pallet = (api.query as any)[config.palletName]
        
        // 查询提案
        const hashes: any = await pallet.proposals()
        const hashArray = hashes.toJSON() as any[]
        
        const proposalData: ProposalInfo[] = []
        
        for (let i = 0; i < hashArray.length; i++) {
          const hash = hashes[i]
          const voting: any = await pallet.voting(hash)
          
          if (voting.isSome) {
            const votingData = voting.unwrap().toJSON() as any
            const proposalOption: any = await pallet.proposalOf(hash)
            
            let callInfo = null
            if (proposalOption.isSome) {
              const proposal = proposalOption.unwrap()
              callInfo = {
                section: proposal.section,
                method: proposal.method,
                args: proposal.args.toJSON()
              }
            }
            
            proposalData.push({
              hash: hash.toHex(),
              index: votingData.index || i,
              threshold: votingData.threshold,
              ayes: votingData.ayes || [],
              nays: votingData.nays || [],
              end: votingData.end,
              call: callInfo
            })
          }
        }
        
        setProposals(proposalData)
        
        // 查询成员
        const memberList: any = await pallet.members()
        const memberArray = memberList.toJSON() as any[]
        setMembers(memberArray)
        
        // 检查当前账户是否为成员
        if (activeAccount) {
          setIsMember(memberArray.includes(activeAccount))
        }
        
      } catch (e) {
        console.error(`[${config.name}] 加载失败:`, e)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [api, isReady, committeeType, activeAccount])
  
  return {
    proposals,
    members,
    isMember,
    loading,
    config
  }
}
```

**预计代码量**: 150行

---

### 4.3 委员会切换器组件

**文件**: `src/components/CommitteeSwitch/index.tsx`

**UI设计**：
```
┌─────────────────────────────────────────┐
│ 选择委员会                               │
├─────────────────────────────────────────┤
│ [👥 主委员会] [💻 技术委员会] [🛡️ 内容委员会]│
└─────────────────────────────────────────┘
```

**实现**：
```typescript
import { Segmented } from 'antd'
import { COMMITTEES, type CommitteeType } from '@/types/committee'

interface Props {
  value: CommitteeType
  onChange: (type: CommitteeType) => void
}

export function CommitteeSwitch({ value, onChange }: Props) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={COMMITTEES.map(c => ({
        label: (
          <Space>
            {c.icon}
            <span>{c.name}</span>
          </Space>
        ),
        value: c.key
      }))}
      block
      size="large"
    />
  )
}
```

**预计代码量**: 60行

---

### 4.4 通用委员会页面

**文件**: `src/pages/Committees/index.tsx`

**UI设计**：
```
┌─────────────────────────────────────────────┐
│ 委员会管理                                   │
├─────────────────────────────────────────────┤
│ [👥 主委员会] [💻 技术委员会] [🛡️ 内容委员会] │
├─────────────────────────────────────────────┤
│                                             │
│ 当前委员会: 主委员会 (Council)               │
│ 描述: 负责整体治理决策、做市商审批等          │
│ 成员数: 7人 | 默认阈值: 2/3                  │
│                                             │
│ ┌─────────────────────────────────────┐     │
│ │ [提案列表] [创建提案] [我的投票]     │     │
│ └─────────────────────────────────────┘     │
│                                             │
│ 提案列表:                                    │
│ ID | 调用 | 进度 | 状态 | 操作              │
│ #5 | approve(MM#3) | 2/2 | 可执行 | 执行    │
│ #4 | reject(MM#2)  | 1/2 | 投票中 | 投票    │
│                                             │
│ ┌─────────────────────────────────────┐     │
│ │ 成员列表                             │     │
│ │ 👤 Alice   | 投票: 15 | 参与率: 100% │     │
│ │ 👤 Bob     | 投票: 12 | 参与率: 80%  │     │
│ │ 👤 Charlie | 投票: 8  | 参与率: 53%  │     │
│ └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

**实现**：
```typescript
export default function CommitteesPage() {
  const [currentCommittee, setCurrentCommittee] = useState<CommitteeType>('council')
  const { proposals, members, isMember, loading, config } = useCollective(currentCommittee)
  const [activeTab, setActiveTab] = useState('proposals')
  
  return (
    <div>
      <Card>
        {/* 委员会切换器 */}
        <CommitteeSwitch
          value={currentCommittee}
          onChange={setCurrentCommittee}
        />
        
        {/* 委员会信息 */}
        <Descriptions column={3} style={{ marginTop: 16 }}>
          <Descriptions.Item label="名称">
            {config.name}
          </Descriptions.Item>
          <Descriptions.Item label="成员数">
            {members.length} 人
          </Descriptions.Item>
          <Descriptions.Item label="默认阈值">
            {config.defaultThreshold}/{members.length}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>
            {config.description}
          </Descriptions.Item>
        </Descriptions>
        
        {/* Tab切换 */}
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="提案列表" key="proposals">
            <ProposalListGeneric
              proposals={proposals}
              committeeType={currentCommittee}
              loading={loading}
            />
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="创建提案" key="create">
            <CreateProposalGeneric
              committeeType={currentCommittee}
              isMember={isMember}
            />
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="成员管理" key="members">
            <MemberListGeneric
              members={members}
              proposals={proposals}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
```

**预计代码量**: 250行

---

### 4.5 权限系统升级

**文件**: `src/hooks/usePermission.ts`

```typescript
/**
 * 完整权限系统
 */
export interface Permission {
  // 委员会成员
  isCouncilMember: boolean
  isTechnicalMember: boolean
  isContentMember: boolean
  
  // Root权限
  isRoot: boolean
  isSudo: boolean
  
  // 操作权限
  canPropose: (committee: CommitteeType) => boolean
  canVote: (committee: CommitteeType) => boolean
  canExecute: boolean
  canApprove: (domain: string) => boolean
  
  // 轨道权限
  canUseTrack: (trackId: number) => boolean
  canCancelReferendum: boolean
}

export function usePermission(): Permission {
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const [permission, setPermission] = useState<Permission>({
    isCouncilMember: false,
    isTechnicalMember: false,
    isContentMember: false,
    isRoot: false,
    isSudo: false,
    canPropose: () => false,
    canVote: () => false,
    canExecute: false,
    canApprove: () => false,
    canUseTrack: () => false,
    canCancelReferendum: false
  })
  
  useEffect(() => {
    if (!isReady || !api || !activeAccount) return
    
    const checkPermissions = async () => {
      // 检查各委员会成员资格
      const councilMembers: any = await api.query.council.members()
      const isCouncil = councilMembers.toJSON().includes(activeAccount)
      
      const techMembers: any = await api.query.technicalCommittee.members()
      const isTech = techMembers.toJSON().includes(activeAccount)
      
      const contentMembers: any = await api.query.contentCommittee.members()
      const isContent = contentMembers.toJSON().includes(activeAccount)
      
      // 检查Root权限（这里简化，实际需要查询sudo）
      const isRoot = false  // 需要实际查询
      
      setPermission({
        isCouncilMember: isCouncil,
        isTechnicalMember: isTech,
        isContentMember: isContent,
        isRoot,
        isSudo: isRoot,
        
        canPropose: (committee) => {
          if (committee === 'council') return isCouncil
          if (committee === 'technicalCommittee') return isTech
          if (committee === 'contentCommittee') return isContent
          return false
        },
        
        canVote: (committee) => {
          if (committee === 'council') return isCouncil
          if (committee === 'technicalCommittee') return isTech
          if (committee === 'contentCommittee') return isContent
          return false
        },
        
        canExecute: true,  // 任何人都可以执行已达阈值的提案
        
        canApprove: (domain) => {
          // 内容相关需要内容委员会权限
          if (domain === 'content') return isContent
          // 其他可能需要主委员会
          return isCouncil || isRoot
        },
        
        canUseTrack: (trackId) => {
          // Root轨道需要Root权限
          if (trackId === 0) return isRoot
          // 内容轨道需要内容委员会
          if (trackId === 20) return isContent
          // 其他轨道任何人都可以
          return true
        },
        
        canCancelReferendum: isRoot
      })
    }
    
    checkPermissions()
  }, [api, isReady, activeAccount])
  
  return permission
}
```

**预计代码量**: 180行

---

## 五、目录结构调整

### 新增文件结构

```
memopark-governance/src/
├── types/
│   └── committee.ts                    # ← 新增
│
├── services/blockchain/
│   ├── council.ts                      # 已有
│   ├── marketMaker.ts                  # 已有
│   ├── contentGovernance.ts            # 已有
│   ├── tracks.ts                       # ← 新增
│   ├── referenda.ts                    # ← 新增
│   └── collective.ts                   # ← 新增（通用）
│
├── hooks/
│   ├── useProposals.ts                 # 已有
│   ├── useCouncilMembers.ts            # 已有
│   ├── useAppeals.ts                   # 已有
│   ├── useTracks.ts                    # ← 新增
│   ├── useReferenda.ts                 # ← 新增
│   ├── useCollective.ts                # ← 新增
│   └── usePermission.ts                # ← 新增
│
├── components/
│   ├── WalletConnect/                  # 已有
│   ├── TrackSelector/                  # ← 新增
│   ├── TrackInfoCard/                  # ← 新增
│   ├── CommitteeSwitch/                # ← 新增
│   ├── ProposalListGeneric/            # ← 新增
│   └── PermissionGuard/                # ← 新增
│
├── pages/
│   ├── Dashboard/                      # 已有
│   ├── Proposals/                      # 已有
│   ├── Voting/                         # 已有
│   ├── Applications/                   # 已有
│   ├── ContentGovernance/              # 已有
│   ├── Analytics/                      # 已有
│   ├── Members/                        # 已有
│   ├── Referenda/                      # ← 新增
│   │   ├── List/
│   │   └── Detail/
│   ├── Committees/                     # ← 新增
│   │   └── index.tsx
│   └── Tracks/                         # ← 新增
│       └── index.tsx
```

---

## 六、实施步骤

### Step 1: 创建轨道系统（Week 1, Day 1-3）

```bash
# Day 1: 轨道服务层
创建文件:
  - src/services/blockchain/tracks.ts
  - src/hooks/useTracks.ts

功能:
  - 查询轨道配置
  - 轨道名称/颜色/图标映射
  - 轨道Hook

验证:
  - 能正确查询所有轨道
  - 数据格式正确
```

```bash
# Day 2: 轨道选择器组件
创建文件:
  - src/components/TrackSelector/index.tsx
  - src/components/TrackInfoCard/index.tsx

功能:
  - 轨道选择UI
  - 轨道信息展示
  - 轨道参数说明

验证:
  - UI显示正常
  - 选择功能正常
  - 参数展示完整
```

```bash
# Day 3: 集成到现有页面
修改文件:
  - src/pages/Dashboard/index.tsx（添加轨道统计）
  - src/pages/Proposals/List/index.tsx（添加轨道标签）
  - src/pages/Analytics/index.tsx（添加轨道分析）

验证:
  - 仪表盘显示轨道统计
  - 提案列表显示轨道标签
  - 数据分析包含轨道维度
```

### Step 2: 公投管理（Week 2, Day 4-8）

```bash
# Day 4-5: 公投服务层和Hook
创建文件:
  - src/services/blockchain/referenda.ts
  - src/hooks/useReferenda.ts

功能:
  - 查询所有公投
  - 按轨道筛选
  - 公投详情查询

验证:
  - 能查询所有公投
  - 轨道筛选正常
  - 数据完整
```

```bash
# Day 6-7: 公投列表页面
创建文件:
  - src/pages/Referenda/List/index.tsx

功能:
  - 左侧轨道筛选
  - 右侧公投表格
  - 投票进度展示
  - 状态筛选

验证:
  - 按轨道筛选正常
  - 表格显示完整
  - 进度计算正确
```

```bash
# Day 8: 公投详情页面
创建文件:
  - src/pages/Referenda/Detail/index.tsx

功能:
  - 基本信息展示
  - 投票情况展示
  - 时间线展示
  - Preimage查看
  - 管理操作（Root）

验证:
  - 详情显示完整
  - Preimage可查看
  - Root操作正常（如果有权限）
```

### Step 3: 多委员会支持（Week 3, Day 9-13）

```bash
# Day 9: 委员会类型定义
创建文件:
  - src/types/committee.ts

功能:
  - 委员会类型枚举
  - 委员会配置
  - 辅助函数

验证:
  - 类型定义正确
  - 配置完整
```

```bash
# Day 10-11: 通用委员会Hook和服务
创建文件:
  - src/hooks/useCollective.ts
  - src/hooks/usePermission.ts

功能:
  - 通用委员会数据查询
  - 权限检查
  - 成员管理

验证:
  - 支持3个委员会
  - 权限检查正确
  - 数据查询正常
```

```bash
# Day 12: 委员会切换器
创建文件:
  - src/components/CommitteeSwitch/index.tsx
  - src/pages/Committees/index.tsx

功能:
  - 委员会切换UI
  - 通用委员会页面
  - 提案列表
  - 成员列表

验证:
  - 切换功能正常
  - 不同委员会数据独立
  - UI显示正确
```

```bash
# Day 13: 集成和优化
修改文件:
  - src/layouts/BasicLayout/index.tsx（添加委员会菜单）
  - src/App.tsx（添加路由）
  - src/pages/Dashboard/index.tsx（添加委员会统计）

验证:
  - 路由正常
  - 菜单显示正常
  - 整体功能联通
```

---

## 七、文件清单和代码量估算

### 新增文件（23个）

| 类别 | 文件 | 代码量 |
|------|------|--------|
| **服务层** | tracks.ts | 200 |
| | referenda.ts | 250 |
| | collective.ts | 180 |
| **类型定义** | committee.ts | 80 |
| **Hooks** | useTracks.ts | 80 |
| | useReferenda.ts | 100 |
| | useCollective.ts | 150 |
| | usePermission.ts | 180 |
| **组件** | TrackSelector/ | 150 |
| | TrackInfoCard/ | 80 |
| | CommitteeSwitch/ | 60 |
| | ProposalListGeneric/ | 200 |
| | PermissionGuard/ | 50 |
| **页面** | Referenda/List/ | 350 |
| | Referenda/Detail/ | 300 |
| | Committees/ | 250 |
| | Tracks/ | 180 |
| **总计** | **17个** | **~2840行** |

### 修改文件（8个）

| 文件 | 修改内容 | 新增代码 |
|------|---------|---------|
| Dashboard/index.tsx | 轨道统计 | +100 |
| Proposals/List/index.tsx | 轨道标签 | +50 |
| Analytics/index.tsx | 轨道分析 | +150 |
| Members/index.tsx | 委员会筛选 | +80 |
| App.tsx | 新路由 | +30 |
| BasicLayout/index.tsx | 新菜单 | +40 |
| **总计** | | **+450行** |

### Phase 4 总代码量

```
新增代码: ~3290行
新增文件: 17个
修改文件: 8个
预计总代码: ~7041行（当前3751 + 3290）
```

---

## 八、测试计划

### 8.1 轨道系统测试

```bash
# 测试用例

TC1: 查询轨道配置
  - 能查询所有轨道
  - 轨道参数正确
  - 轨道名称显示

TC2: 轨道选择器
  - 可以选择轨道
  - 显示轨道参数
  - 选中状态正确

TC3: 轨道筛选
  - 按轨道筛选公投
  - 筛选结果正确
  - 计数准确

TC4: 轨道标签
  - 提案显示对应轨道
  - 颜色正确
  - 图标正确
```

### 8.2 多委员会测试

```bash
# 测试用例

TC5: 委员会切换
  - 可以切换3个委员会
  - 数据独立加载
  - 状态正确切换

TC6: 权限检查
  - 正确识别成员资格
  - 操作按钮正确显示/禁用
  - 错误提示友好

TC7: 通用功能
  - 提案列表正常
  - 投票功能正常
  - 执行功能正常

TC8: 跨委员会
  - 可以查看不同委员会的提案
  - 数据不混淆
  - 统计正确
```

---

## 九、性能考虑

### 9.1 数据查询优化

```typescript
// 问题：查询所有公投可能很慢

// 优化方案1：分页查询
export async function getReferendaPaged(
  api: ApiPromise,
  page: number,
  pageSize: number
): Promise<ReferendumInfo[]> {
  const start = page * pageSize
  const end = start + pageSize
  
  const referenda = []
  for (let id = start; id < end; id++) {
    // 查询单个公投
  }
  
  return referenda
}

// 优化方案2：缓存
import { useQuery } from '@tanstack/react-query'

export function useReferenda(trackId?: number) {
  return useQuery({
    queryKey: ['referenda', trackId],
    queryFn: () => loadReferenda(trackId),
    staleTime: 60000,  // 1分钟缓存
    cacheTime: 300000  // 5分钟缓存
  })
}

// 优化方案3：Subsquid（长期）
// 使用索引器查询历史数据
```

### 9.2 渲染优化

```typescript
// 使用虚拟滚动
import { VirtualTable } from '@ant-design/pro-components'

<VirtualTable
  dataSource={largeReferendaList}
  scroll={{ y: 800 }}
  pagination={false}
/>
```

---

## 十、UI/UX设计规范

### 10.1 轨道颜色规范

```typescript
export const TRACK_COLORS = {
  0: '#ff4d4f',   // Root - 红色（危险）
  1: '#ff7a45',   // Whitelisted - 橙红
  2: '#52c41a',   // Treasury - 绿色（财务）
  3: '#1890ff',   // Medium Spender - 蓝色
  4: '#2f54eb',   // Big Spender - 深蓝
  10: '#722ed1',  // Market Maker - 紫色
  11: '#eb2f96',  // Arbitration - 品红
  20: '#faad14',  // Content - 金色
  21: '#a0d911'   // Park - 青柠
}
```

### 10.2 委员会图标规范

```typescript
export const COMMITTEE_ICONS = {
  council: <TeamOutlined />,
  technicalCommittee: <CodeOutlined />,
  contentCommittee: <SafetyOutlined />
}
```

### 10.3 状态标签规范

```typescript
// 公投状态
Ongoing: <Tag color="green">进行中</Tag>
Approved: <Tag color="blue">已通过</Tag>
Rejected: <Tag color="red">已拒绝</Tag>
Cancelled: <Tag color="default">已取消</Tag>
TimedOut: <Tag color="orange">已超时</Tag>

// 投票阶段
Preparing: <Tag color="cyan">准备期</Tag>
Deciding: <Tag color="green">决策期</Tag>
Confirming: <Tag color="blue">确认期</Tag>
```

---

## 十一、路由配置

### 新增路由

```typescript
// src/App.tsx

// 轨道和公投
<Route path="referenda">
  <Route index element={<ReferendaList />} />
  <Route path=":id" element={<ReferendumDetail />} />
</Route>

<Route path="tracks">
  <Route index element={<TracksList />} />
</Route>

// 委员会管理
<Route path="committees">
  <Route index element={<CommitteesPage />} />
  <Route path=":type" element={<CommitteePage />} />
</Route>
```

### 菜单配置

```typescript
// src/layouts/BasicLayout/index.tsx

const menuItems = [
  // ... 现有菜单
  
  {
    key: '/referenda',
    icon: <FileProtectOutlined />,
    label: '公投管理',
    children: [
      { key: '/referenda', label: '公投列表' },
      { key: '/tracks', label: '轨道配置' }
    ]
  },
  
  {
    key: '/committees',
    icon: <TeamOutlined />,
    label: '委员会',
    children: [
      { key: '/committees', label: '全部委员会' },
      { key: '/committees/council', label: '主委员会' },
      { key: '/committees/technical', label: '技术委员会' },
      { key: '/committees/content', label: '内容委员会' }
    ]
  }
]
```

---

## 十二、开发顺序（详细）

### Day 1-3: 轨道系统

```bash
Day 1 上午: 轨道服务层
  ✓ 创建 tracks.ts
  ✓ 实现 getTracks()
  ✓ 实现辅助函数
  ✓ 测试查询

Day 1 下午: 轨道Hook
  ✓ 创建 useTracks.ts
  ✓ 实现数据加载
  ✓ 错误处理
  ✓ 测试Hook

Day 2 上午: 轨道选择器
  ✓ 创建 TrackSelector组件
  ✓ UI实现
  ✓ 交互逻辑
  ✓ 样式调整

Day 2 下午: 轨道信息卡片
  ✓ 创建 TrackInfoCard组件
  ✓ 紧凑展示设计
  ✓ 参数格式化

Day 3: 集成到现有页面
  ✓ Dashboard添加轨道统计
  ✓ Proposals添加轨道标签
  ✓ Analytics添加轨道分析
  ✓ 测试整体功能
```

### Day 4-8: 公投管理

```bash
Day 4 上午: 公投服务层
  ✓ 创建 referenda.ts
  ✓ 实现数据查询
  ✓ 数据解析

Day 4 下午: 公投Hook
  ✓ 创建 useReferenda.ts
  ✓ 缓存策略
  ✓ 错误处理

Day 5: Preimage服务
  ✓ Preimage查询
  ✓ Preimage解析
  ✓ Preimage展示

Day 6-7: 公投列表页面
  ✓ 布局实现（左右分栏）
  ✓ 轨道筛选菜单
  ✓ 公投表格
  ✓ 投票进度展示
  ✓ 状态标签

Day 8: 公投详情页面
  ✓ 详情信息展示
  ✓ 投票数据可视化
  ✓ 时间线组件
  ✓ Preimage查看器
  ✓ Root操作（取消公投等）
```

### Day 9-13: 多委员会

```bash
Day 9: 委员会类型系统
  ✓ 创建 committee.ts
  ✓ 委员会配置
  ✓ 类型定义

Day 10: 通用委员会Hook
  ✓ 创建 useCollective.ts
  ✓ 支持多个实例
  ✓ 数据查询

Day 11: 权限系统
  ✓ 创建 usePermission.ts
  ✓ 多维度权限检查
  ✓ 权限守卫组件

Day 12: 委员会切换器
  ✓ 创建 CommitteeSwitch
  ✓ 通用委员会页面
  ✓ 提案和成员展示

Day 13: 集成和测试
  ✓ 添加菜单和路由
  ✓ 整体功能测试
  ✓ 优化和修复
  ✓ 文档编写
```

---

## 十三、验收标准

### 功能验收

- [ ] 能查询所有轨道配置
- [ ] 轨道选择器功能正常
- [ ] 公投能按轨道筛选
- [ ] 公投详情显示完整
- [ ] 能切换3个委员会
- [ ] 不同委员会的提案独立
- [ ] 权限检查正确
- [ ] 批量操作支持所有委员会

### 性能验收

- [ ] 首页加载 < 3秒
- [ ] 页面切换 < 500ms
- [ ] 数据查询 < 5秒
- [ ] 无内存泄漏

### 质量验收

- [ ] TypeScript 0错误
- [ ] ESLint 0警告
- [ ] 构建成功
- [ ] 所有功能有文档
- [ ] 代码有注释

---

## 十四、风险评估和缓解

### 风险1：轨道配置不存在

**风险**: 链上可能没有配置referenda pallet

**缓解**:
```typescript
// 优雅降级
try {
  const tracks = await api.consts.referenda.tracks
} catch (e) {
  console.warn('Referenda pallet未配置，使用默认轨道')
  return DEFAULT_TRACKS
}
```

### 风险2：委员会实例不存在

**风险**: technicalCommittee或contentCommittee可能未配置

**缓解**:
```typescript
// 动态检测
const availableCommittees = COMMITTEES.filter(c => {
  return (api.query as any)[c.palletName] !== undefined
})

// 只显示可用的委员会
```

### 风险3：数据量大导致查询慢

**缓解**:
```typescript
// 1. 分页查询
// 2. 缓存策略
// 3. 懒加载
// 4. 虚拟滚动
```

---

## 十五、成功指标

### 功能指标

- ✅ 支持9+个轨道
- ✅ 支持3个委员会
- ✅ 按轨道筛选公投
- ✅ 跨委员会数据对比
- ✅ 完整的权限系统

### 效率指标

- 查询轨道: < 1秒
- 切换委员会: < 500ms
- 加载公投列表: < 3秒
- 批量操作: 1次签名

### 质量指标

- 代码覆盖率: > 80%
- TypeScript类型覆盖: 100%
- 文档完整性: 100%

---

## 十六、交付物清单

### Week 1 交付

- [ ] 轨道服务层（tracks.ts）
- [ ] 轨道Hook（useTracks.ts）
- [ ] 轨道选择器组件
- [ ] 轨道信息卡片
- [ ] 现有页面集成轨道

### Week 2 交付

- [ ] 公投服务层（referenda.ts）
- [ ] 公投Hook（useReferenda.ts）
- [ ] 公投列表页面
- [ ] 公投详情页面
- [ ] Preimage查看器

### Week 3 交付

- [ ] 委员会类型系统
- [ ] 通用委员会Hook
- [ ] 权限系统
- [ ] 委员会切换器
- [ ] 通用委员会页面
- [ ] 完整文档

---

## 十七、总结

### Phase 4 关键成果

**完成后将拥有**：
1. ✅ 完整的轨道系统（9+轨道）
2. ✅ 多委员会支持（3个委员会）
3. ✅ 公投管理（审核侧）
4. ✅ 统一的权限系统
5. ✅ 按轨道分类的数据分析

**项目完成度**：
- 当前：80%
- Phase 4后：90%

**代码量**：
- 当前：3751行
- Phase 4后：7041行

**功能完整性**：
- 核心治理：100%
- 轨道系统：100%
- 多委员会：100%
- 公投管理：80%（审核侧）
- 财库管理：待Phase 5

---

## 建议

**立即启动Phase 4开发**

理由：
1. ✅ 轨道系统是OpenGov基础
2. ✅ 多委员会是项目实际需求
3. ✅ 技术方案成熟
4. ✅ 风险可控
5. ✅ 投资回报高

**开始时间**: 建议本周开始  
**预期完成**: 3周后  
**下一阶段**: Phase 5（财库+仲裁）

---

**准备好了吗？我们可以立即开始Week 1的开发！** 🚀

