# Memopark 治理Web平台 - 完善建议

## 当前状态回顾

### ✅ 已实现功能（80%）

**委员会治理**：
- ✅ Council提案管理
- ✅ 投票和执行
- ✅ 批量投票

**业务治理**：
- ✅ 做市商审批
- ✅ 内容治理/申诉审核
- ✅ 批量审批

**管理功能**：
- ✅ 数据分析
- ✅ 成员管理
- ✅ 仪表盘

---

## 🎯 需要完善的功能

### 一、轨道系统（Tracks）⭐⭐⭐⭐⭐

#### 1.1 什么是轨道系统？

```
OpenGov（Governance v2）引入的多轨道治理：

传统治理：
  所有提案 → 同一套参数（押金、期限、阈值）
  
OpenGov轨道系统：
  不同类型提案 → 不同轨道 → 不同参数

例如：
  Root轨道：
    - 高押金（1000 MEMO）
    - 长准备期（7天）
    - 长决策期（28天）
    - 严格确认期
    
  财库轨道：
    - 中等押金（100 MEMO）
    - 中等准备期（2天）
    - 中等决策期（14天）
    
  内容治理轨道：
    - 低押金（10 MEMO）
    - 短准备期（1天）
    - 短决策期（7天）
```

#### 1.2 Memopark的轨道配置

**从DAPP代码中发现的轨道**：

| Track ID | 名称 | 用途 | 参数特点 |
|----------|------|------|---------|
| 0 | Root | 危险调用（系统级） | 高押金、长时间 |
| 2 | Treasury | 财库支出 | 按里程碑、延迟执行 |
| 20 | Content | 内容治理 | 较温和曲线、快速 |

**建议增加的轨道**：

| Track ID | 名称 | 用途 | 建议参数 |
|----------|------|------|---------|
| 1 | Whitelisted | 白名单调用 | 中等押金 |
| 3 | Medium Spender | 中等支出 | 中等押金 |
| 4 | Big Spender | 大额支出 | 高押金 |
| 10 | Market Maker | 做市商治理 | 专用轨道 |
| 11 | Arbitration | 仲裁裁决 | 专业轨道 |

#### 1.3 需要实现的轨道功能

**优先级**: ⭐⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 轨道元数据查询
src/services/blockchain/tracks.ts
  - getTracks(): 获取所有轨道配置
  - getTrackInfo(trackId): 获取单个轨道详情
  - getTrackParams(trackId): 获取轨道参数

// 2. 轨道选择器组件
src/components/TrackSelector/
  - 轨道列表展示
  - 轨道参数说明
  - 轨道选择

// 3. 按轨道筛选
src/pages/Referenda/
  - 按轨道筛选公投
  - 轨道统计
  - 轨道对比

// 4. 轨道分析
src/pages/Analytics/
  - 各轨道提案数量
  - 各轨道通过率
  - 轨道使用趋势
```

**实现示例**：

```typescript
// src/services/blockchain/tracks.ts
export interface TrackInfo {
  id: number
  name: string
  maxDeciding: number
  decisionDeposit: string
  preparePeriod: number
  decisionPeriod: number
  confirmPeriod: number
  minEnactmentPeriod: number
  minApproval: any  // Curve
  minSupport: any   // Curve
}

export async function getTracks(api: ApiPromise): Promise<TrackInfo[]> {
  const tracks: any = await api.consts.referenda.tracks
  return tracks.toJSON() as TrackInfo[]
}
```

```typescript
// src/components/TrackSelector/index.tsx
export function TrackSelector({ value, onChange }: Props) {
  const tracks = useTracks()
  
  return (
    <Card title="选择治理轨道">
      <Space direction="vertical" style={{ width: '100%' }}>
        {tracks.map(track => (
          <Card
            key={track.id}
            size="small"
            hoverable
            onClick={() => onChange(track.id)}
            style={{
              border: value === track.id ? '2px solid #1890ff' : '1px solid #d9d9d9'
            }}
          >
            <Space direction="vertical">
              <Typography.Text strong>{track.name}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                押金: {formatBalance(track.decisionDeposit)} MEMO
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                决策期: {track.decisionPeriod} 区块
              </Typography.Text>
            </Space>
          </Card>
        ))}
      </Space>
    </Card>
  )
}
```

---

### 二、多委员会支持 ⭐⭐⭐⭐⭐

#### 2.1 当前问题

```
当前只支持单一委员会（Council）

但Memopark有多个委员会：
  - Council（主委员会）
  - Technical Committee（技术委员会）
  - Content Committee（内容委员会）Instance3

需要：
  - 切换不同委员会
  - 显示不同委员会的提案
  - 不同委员会的权限检查
```

#### 2.2 实现方案

**优先级**: ⭐⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 委员会选择器
src/components/CommitteeSelector/
  - 委员会下拉菜单
  - 显示当前委员会
  - 切换委员会

// 2. 多委员会服务
src/services/blockchain/collective.ts
  - getCouncilProposals()
  - getTechnicalProposals()
  - getContentCommitteeProposals()

// 3. 通用委员会组件
src/pages/Collective/
  - 支持任意委员会实例
  - 通用的提案列表
  - 通用的投票功能

// 4. 权限适配
  - 不同委员会的成员检查
  - 不同委员会的阈值
```

**实现示例**：

```typescript
// src/hooks/useCollective.ts
export function useCollective(instance: 'council' | 'technicalCommittee' | 'contentCommittee') {
  const { api } = useApi()
  const [proposals, setProposals] = useState([])
  
  useEffect(() => {
    if (!api) return
    
    const pallet = instance === 'council' 
      ? api.query.council
      : instance === 'technicalCommittee'
      ? api.query.technicalCommittee
      : api.query.contentCommittee
    
    const loadProposals = async () => {
      const hashes = await pallet.proposals()
      // 加载提案...
    }
    
    loadProposals()
  }, [api, instance])
  
  return { proposals }
}
```

```typescript
// src/components/CommitteeSelector/index.tsx
export function CommitteeSelector({ value, onChange }: Props) {
  const committees = [
    { key: 'council', name: '主委员会', icon: <TeamOutlined /> },
    { key: 'technicalCommittee', name: '技术委员会', icon: <CodeOutlined /> },
    { key: 'contentCommittee', name: '内容委员会', icon: <SafetyOutlined /> }
  ]
  
  return (
    <Select value={value} onChange={onChange}>
      {committees.map(c => (
        <Select.Option key={c.key} value={c.key}>
          {c.icon} {c.name}
        </Select.Option>
      ))}
    </Select>
  )
}
```

---

### 三、公投管理（Referenda）⭐⭐⭐⭐

#### 3.1 为什么需要？

```
虽然公投投票保留在DAPP（大众参与），
但公投的**审核和管理**需要在Web平台：

委员会/管理员需要：
  - 查看所有公投提案
  - 批量审核Preimage
  - 监控公投进度
  - 数据分析（各轨道公投统计）
  - 取消恶意公投
```

#### 3.2 实现方案

**优先级**: ⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 公投管理页面
src/pages/Referenda/
  - List/index.tsx（公投列表，按轨道分类）
  - Detail/index.tsx（公投详情）
  - Preimages/index.tsx（Preimage管理）

// 2. 功能
  - 查看所有公投
  - 按轨道筛选
  - 按状态筛选（Ongoing/Approved/Rejected）
  - Preimage审核
  - 取消恶意公投（需Root权限）
  - 公投数据统计
```

**页面设计**：

```
公投管理页面:

┌─────────────────────────────────────────┐
│ 公投管理                      [刷新]     │
├─────────────────────────────────────────┤
│ 轨道筛选: [全部▼] [Root] [财库] [内容]  │
│ 状态筛选: [全部▼] [进行中] [已通过]     │
├─────────────────────────────────────────┤
│ ID | 轨道 | 标题 | 进度 | 状态 | 操作   │
│ #5 | 财库 | 支出提案 | 45% | 进行中 | 详情│
│ #4 | 内容 | 删除违规 | 78% | 进行中 | 详情│
│ #3 | Root | 升级链 | 100% | 已通过 | 详情│
└─────────────────────────────────────────┘

公投详情页面:

┌─────────────────────────────────────────┐
│ 公投 #5 详情                             │
├─────────────────────────────────────────┤
│ 轨道: 财库 (Track 2)                    │
│ 状态: 🟢 进行中                         │
│ 投票进度: ████████░░ 78%                │
│                                         │
│ 赞成: 1,234,567 MEMO (45%)             │
│ 反对: 987,654 MEMO (36%)               │
│ 弃权: 523,789 MEMO (19%)               │
│                                         │
│ 决策期倒计时: 5天 12小时                │
│ Preimage: 0xabcd...                    │
│                                         │
│ [查看Preimage] [取消公投(Root)]         │
└─────────────────────────────────────────┘
```

---

### 四、财库管理完善 ⭐⭐⭐⭐

#### 4.1 当前缺失

```
财库是重要的治理模块，需要：
  - 财库余额展示
  - 支出提案管理
  - 支出审批流程
  - 财务报表
  - 预算监控
```

#### 4.2 实现方案

**优先级**: ⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 财库页面
src/pages/Treasury/
  - Overview/index.tsx（财库总览）
  - Proposals/index.tsx（支出提案）
  - Bounties/index.tsx（赏金管理）
  - Tips/index.tsx（小费管理）

// 2. 功能
  - 财库余额实时显示
  - 支出提案列表
  - 提案审批
  - 支出历史
  - 财务图表（收入/支出趋势）
  - 预算管理
```

**页面设计**：

```
财库管理页面:

┌─────────────────────────────────────────┐
│ 财库管理                                 │
├─────────────────────────────────────────┤
│ ┌────────┬────────┬────────┬─────────┐  │
│ │余额    │本月收入│本月支出│可用余额  │  │
│ │1.2M    │150K   │80K    │1.12M    │  │
│ └────────┴────────┴────────┴─────────┘  │
│                                         │
│ [支出提案] [赏金] [小费]                 │
│                                         │
│ 待审批支出:                              │
│ #12 | 开发奖励 | 50K MEMO | [审批]     │
│ #11 | 营销费用 | 30K MEMO | [审批]     │
│                                         │
│ [收入/支出趋势图]                        │
└─────────────────────────────────────────┘
```

---

### 五、不同治理类型的UI适配 ⭐⭐⭐⭐

#### 5.1 治理类型分类

```
Memopark的治理类型：

1. 委员会治理（Collective-based）
   - Council提案
   - Technical Committee提案
   - Content Committee提案
   特点：委员会投票，2/3阈值

2. 公投治理（Referenda-based）
   - Root轨道
   - Treasury轨道
   - Content轨道
   特点：代币投票，信念锁定

3. 业务治理（Custom）
   - 做市商审批
   - 内容申诉
   - 仲裁裁决
   特点：专业审核，特定流程

4. 财务治理（Treasury-based）
   - 支出提案
   - 赏金管理
   - 小费提案
   特点：资金管理，审计追踪
```

#### 5.2 UI适配需求

**不同治理类型需要不同的UI**：

**委员会治理UI**（已实现✅）：
```
- 表格展示提案
- 投票进度条（赞成/反对/阈值）
- 批量投票按钮
- 成员投票记录
```

**公投治理UI**（待实现⏳）：
```
- 按轨道分类
- 信念投票显示（1x-6x）
- 锁定期显示
- Aye/Nay票数和百分比
- 决策期/确认期倒计时
- Support/Approval曲线图
```

**财库治理UI**（待实现⏳）：
```
- 财库余额仪表盘
- 支出金额柱状图
- 收支趋势折线图
- 受益人列表
- 审批流程时间线
```

**业务治理UI**（部分实现✅）：
```
- 业务数据展示（已实现）
- 批量审批（已实现）
- 特定字段展示（CID、押金等）
- 业务流程追踪（待完善）
```

---

### 六、权限系统完善 ⭐⭐⭐⭐

#### 6.1 当前权限检查

```typescript
// 简单的成员检查
const { isCurrentMember } = useCouncilMembers()

// 问题：
❌ 只支持单一委员会
❌ 不支持角色分级
❌ 不支持操作级权限
```

#### 6.2 完善方案

**优先级**: ⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 多维度权限检查
src/hooks/usePermission.ts

export interface Permission {
  isCouncilMember: boolean
  isTechnicalMember: boolean
  isContentMember: boolean
  isRoot: boolean
  canPropose: boolean
  canVote: boolean
  canExecute: boolean
  canApprove: boolean
}

export function usePermission(): Permission {
  // 检查多个委员会
  // 检查操作权限
  // 返回完整权限对象
}

// 2. 权限组件
src/components/PermissionGuard/

<PermissionGuard require="councilMember">
  <CreateProposalButton />
</PermissionGuard>

<PermissionGuard require={['councilMember', 'technicalMember']}>
  <VoteButton />
</PermissionGuard>

// 3. 权限提示
当权限不足时：
  - 显示清晰提示
  - 说明所需权限
  - 提供解决方案
```

---

### 七、批量操作扩展 ⭐⭐⭐⭐

#### 7.1 当前批量操作

```
已实现：
  ✅ 批量投票（委员会提案）
  ✅ 批量审批（申诉）

缺少：
  ❌ 批量执行提案
  ❌ 批量批准支出
  ❌ 批量分配赏金
  ❌ 智能批量（按条件筛选后批量操作）
```

#### 7.2 扩展方案

**优先级**: ⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 智能批量选择
src/components/SmartBatchSelector/

功能：
  - 按条件筛选（类型、金额、时间）
  - 预览选中项
  - 批量操作
  - 操作确认

示例：
  "选择所有小于100 MEMO的支出提案"
  → 自动勾选符合条件的提案
  → 批量批准
  → 1次签名完成

// 2. 批量操作模板
  - 保存常用批量操作
  - 一键应用模板
  - 操作历史回溯
```

---

### 八、数据分析增强 ⭐⭐⭐⭐

#### 8.1 当前分析功能

```
已实现：
  ✅ 提案类型分布（饼图）
  ✅ 提案状态分布（饼图）
  ✅ 成员活跃度（柱状图）

缺少：
  ❌ 时间趋势分析
  ❌ 轨道对比分析
  ❌ 通过率统计
  ❌ 资金流向分析
  ❌ 预测分析
```

#### 8.2 增强方案

**优先级**: ⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 趋势分析
src/pages/Analytics/Trends/

图表：
  - 提案数量趋势（折线图）
  - 通过率趋势（折线图）
  - 参与率趋势（折线图）
  - 资金支出趋势（面积图）

// 2. 对比分析
  - 不同轨道对比
  - 不同委员会对比
  - 不同时期对比

// 3. 预测分析
  - 基于历史数据预测
  - 异常检测
  - 趋势预警

// 4. 导出报告
  - Excel导出
  - PDF报告生成
  - 自定义报表
```

**图表示例**：

```typescript
import { Line, Area, Radar } from '@ant-design/charts'

// 提案数量趋势
<Line
  data={monthlyProposals}
  xField="month"
  yField="count"
  seriesField="type"
/>

// 资金支出趋势
<Area
  data={treasurySpending}
  xField="date"
  yField="amount"
  smooth
/>

// 轨道雷达图
<Radar
  data={trackStats}
  xField="track"
  yField="count"
/>
```

---

### 九、通知系统 ⭐⭐⭐

#### 9.1 需求

```
委员会成员需要及时知道：
  - 新提案提交
  - 投票达到阈值
  - 公示期即将结束
  - 需要处理的任务
```

#### 9.2 实现方案

**优先级**: ⭐⭐⭐

**功能需求**：

```typescript
// 1. 浏览器通知
src/services/notification/browser.ts

功能：
  - 新提案通知
  - 投票提醒
  - 任务提醒
  - 桌面通知

// 2. 邮件通知（需后端）
  - 每日摘要
  - 重要事件通知
  - 周报月报

// 3. WebSocket实时推送
  - 链上事件监听
  - 实时推送新提案
  - 实时更新进度

// 4. 通知中心
src/components/NotificationCenter/

显示：
  - 未读通知列表
  - 通知历史
  - 通知设置
```

---

### 十、导出功能 ⭐⭐⭐

#### 10.1 需求

```
管理员需要：
  - 导出提案列表（Excel）
  - 导出成员统计（Excel）
  - 导出财务报表（PDF）
  - 导出审计日志（CSV）
```

#### 10.2 实现方案

**优先级**: ⭐⭐⭐

**功能需求**：

```typescript
// 1. Excel导出
import * as XLSX from 'xlsx'

export function exportToExcel(data: any[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// 2. PDF导出
import jsPDF from 'jspdf'

export function exportToPDF(content: string, filename: string) {
  const doc = new jsPDF()
  doc.text(content, 10, 10)
  doc.save(`${filename}.pdf`)
}

// 3. CSV导出
export function exportToCSV(data: any[], filename: string) {
  const csv = data.map(row => Object.values(row).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
}

// 4. 报表生成
  - 月度治理报告
  - 成员考核报告
  - 财务审计报告
```

---

### 十一、高级筛选和搜索 ⭐⭐⭐

#### 11.1 当前筛选

```
基础：
  - Tab切换（状态筛选）
  - 简单列表显示

缺少：
  ❌ 多条件组合筛选
  ❌ 时间范围筛选
  ❌ 金额范围筛选
  ❌ 关键字搜索
  ❌ 保存筛选条件
```

#### 11.2 实现方案

**优先级**: ⭐⭐⭐

**功能需求**：

```typescript
// 1. 高级筛选面板
src/components/AdvancedFilter/

功能：
  - 多条件组合
  - 时间范围选择
  - 金额范围输入
  - 状态多选
  - 轨道多选
  - 关键字搜索

// 2. 筛选条件保存
  - 保存常用筛选
  - 快速应用
  - 筛选模板

// 3. 搜索功能
  - 提案ID搜索
  - 提案人搜索
  - CID搜索
  - 全文搜索
```

**UI设计**：

```
高级筛选:

┌─────────────────────────────────────────┐
│ 高级筛选                      [重置]    │
├─────────────────────────────────────────┤
│ 时间范围: [2025-10-01] 至 [2025-10-31] │
│ 金额范围: [0] 至 [10000] MEMO          │
│ 状态: ☑待审 ☑已批准 ☐已驳回            │
│ 轨道: ☑Root ☑财库 ☑内容                │
│ 关键字: [搜索...]                       │
│                                         │
│ [应用筛选] [保存为模板]                  │
└─────────────────────────────────────────┘
```

---

### 十二、仲裁管理 ⭐⭐⭐⭐

#### 12.1 需求分析

```
仲裁是重要的争议解决机制：
  - 用户发起争议
  - 仲裁员裁决
  - 资金分配

需要专业的仲裁管理界面
```

#### 12.2 实现方案

**优先级**: ⭐⭐⭐⭐

**功能需求**：

```typescript
// 1. 仲裁页面
src/pages/Arbitration/
  - Cases/index.tsx（案件列表）
  - CaseDetail/index.tsx（案件详情）
  - Decisions/index.tsx（裁决历史）

// 2. 功能
  - 争议案件列表
  - 案件详情查看
  - 证据管理
  - 裁决操作（全额退款/部分退款/全额赔付）
  - 资金分配
  - 裁决历史
  - 仲裁员统计
```

---

### 十三、性能优化 ⭐⭐⭐

#### 13.1 当前性能问题

```
数据查询：
  - 遍历查询（Applications, Appeals）
  - 大数据量时慢

长列表：
  - 没有虚拟滚动
  - 渲染性能问题

缓存：
  - 没有数据缓存
  - 重复查询
```

#### 13.2 优化方案

**优先级**: ⭐⭐⭐

**功能需求**：

```typescript
// 1. 虚拟滚动
import { VirtualTable } from '@ant-design/pro-components'

<VirtualTable
  dataSource={largeDataset}
  scroll={{ y: 800 }}
/>

// 2. 数据缓存
import { useQuery } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['proposals'],
  queryFn: loadProposals,
  staleTime: 60000  // 1分钟缓存
})

// 3. 分页加载
  - 按需加载数据
  - 无限滚动
  - 减少初始加载时间

// 4. Subsquid集成
  - 索引历史数据
  - 快速查询
  - 高级搜索
```

---

## 📋 完善优先级总览

### 第一优先级（必须实现）⭐⭐⭐⭐⭐

| 功能 | 理由 | 工时 |
|------|------|------|
| **轨道系统** | OpenGov核心，必不可少 | 2周 |
| **多委员会支持** | 有3个委员会，必须支持 | 1周 |

### 第二优先级（强烈建议）⭐⭐⭐⭐

| 功能 | 理由 | 工时 |
|------|------|------|
| **公投管理** | 审核和监控需要 | 2周 |
| **财库管理** | 资金管理重要 | 2周 |
| **仲裁管理** | 争议解决关键 | 2周 |
| **权限系统** | 安全和体验 | 1周 |

### 第三优先级（建议实现）⭐⭐⭐

| 功能 | 理由 | 工时 |
|------|------|------|
| **通知系统** | 提升及时性 | 1周 |
| **导出功能** | 报表需求 | 1周 |
| **高级筛选** | 提升查找效率 | 1周 |
| **性能优化** | 大数据量支持 | 1周 |

---

## 🎯 实施建议

### Phase 4: 轨道系统+多委员会（3周）

**Week 1: 轨道系统基础**
```typescript
创建：
  - src/services/blockchain/tracks.ts
  - src/hooks/useTracks.ts
  - src/components/TrackSelector/

功能：
  - 查询轨道配置
  - 轨道参数展示
  - 轨道选择器
```

**Week 2: 公投管理**
```typescript
创建：
  - src/pages/Referenda/List/
  - src/pages/Referenda/Detail/
  
功能：
  - 按轨道展示公投
  - 公投详情
  - Preimage查看
```

**Week 3: 多委员会支持**
```typescript
修改：
  - 通用化委员会组件
  - 委员会切换器
  - 权限系统升级

功能：
  - 支持3个委员会
  - 统一的提案管理
  - 委员会间切换
```

### Phase 5: 财库+仲裁（4周）

**Week 1-2: 财库管理**
```typescript
创建：
  - src/pages/Treasury/
  - src/services/blockchain/treasury.ts

功能：
  - 财库余额
  - 支出提案
  - 赏金管理
  - 小费管理
  - 财务报表
```

**Week 3-4: 仲裁管理**
```typescript
创建：
  - src/pages/Arbitration/
  - src/services/blockchain/arbitration.ts

功能：
  - 案件列表
  - 裁决操作
  - 资金分配
  - 裁决历史
```

### Phase 6: 优化增强（2周）

```
功能：
  - 通知系统
  - 导出功能
  - 高级筛选
  - 性能优化
  - Subsquid集成
```

---

## 📊 完整功能路线图

```
当前进度: 80%

已完成 ✅:
  - 委员会提案管理
  - 做市商审批
  - 内容治理
  - 投票管理
  - 数据分析
  - 成员管理

Phase 4（3周）⭐⭐⭐⭐⭐:
  - 轨道系统
  - 多委员会支持
  - 公投管理

Phase 5（4周）⭐⭐⭐⭐:
  - 财库管理
  - 仲裁管理

Phase 6（2周）⭐⭐⭐:
  - 通知系统
  - 导出功能
  - 高级筛选
  - 性能优化

最终完成度: 100%
预计总工时: 9周
```

---

## 🎯 立即可做的改进

### 快速优化（1天内）

1. **添加轨道标签**（当前可做）
```typescript
// 在提案列表显示轨道信息
<Tag color="purple">Root轨道</Tag>
<Tag color="green">财库轨道</Tag>
<Tag color="blue">内容轨道</Tag>
```

2. **添加委员会标识**
```typescript
// 显示提案来自哪个委员会
<Tag icon={<TeamOutlined />}>主委员会</Tag>
<Tag icon={<SafetyOutlined />}>内容委员会</Tag>
```

3. **添加操作日志**
```typescript
// 记录所有操作
审批记录:
  - 2025-10-02 14:30 - Alice批准了申诉#45
  - 2025-10-02 14:25 - Bob驳回了申诉#44
```

---

## 💡 关键建议

### 核心建议

1. **优先实现轨道系统** ⭐⭐⭐⭐⭐
   - 这是OpenGov的基础
   - 影响公投、财库等多个模块
   - 必须先实现

2. **支持多委员会** ⭐⭐⭐⭐⭐
   - 项目有3个委员会
   - 通用化当前实现
   - 提升复用性

3. **添加公投审核** ⭐⭐⭐⭐
   - 虽然投票在DAPP
   - 但审核需要在Web
   - 批量审核Preimage

4. **完善权限系统** ⭐⭐⭐⭐
   - 多角色支持
   - 细粒度权限
   - 更好的安全性

---

## 总结

### ✅ 当前已完成（80%）

**核心功能**：
- ✅ 委员会治理（单一Council）
- ✅ 业务治理（做市商、内容）
- ✅ 批量操作（投票、审批）
- ✅ 数据分析（基础）

### ⏳ 需要完善（20%）

**关键缺失**：
1. ⏳ 轨道系统（OpenGov核心）
2. ⏳ 多委员会支持
3. ⏳ 公投管理（审核侧）
4. ⏳ 财库管理
5. ⏳ 仲裁管理

**功能增强**：
6. ⏳ 权限系统完善
7. ⏳ 通知系统
8. ⏳ 导出功能
9. ⏳ 高级筛选
10. ⏳ 性能优化

---

## 建议实施顺序

### 立即实施（Phase 4）

**Week 1-3: 轨道系统+多委员会**
- ⭐⭐⭐⭐⭐ 轨道元数据查询
- ⭐⭐⭐⭐⭐ 轨道选择器
- ⭐⭐⭐⭐⭐ 多委员会支持
- ⭐⭐⭐⭐ 公投审核页面

理由：这是基础设施，必须先完善

---

**您的观察非常准确！轨道系统确实是需要优先完善的核心功能。**

**下一步建议**: 实施Phase 4（轨道系统+多委员会支持）

**预计工时**: 3周  
**优先级**: ⭐⭐⭐⭐⭐ 最高

