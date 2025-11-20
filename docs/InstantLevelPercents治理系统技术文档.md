# InstantLevelPercents 全民投票治理系统 - 技术实现文档

## 🏗️ 系统架构

### 整体架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端 DApp     │    │   Substrate     │    │   存储层        │
│                 │    │   Runtime       │    │                 │
│ React组件       │◄──►│ pallet-affiliate│◄──►│ 链上存储        │
│ - Dashboard     │    │ - 治理模块      │    │ - 提案数据      │
│ - CreateForm    │    │ - 投票逻辑      │    │ - 投票记录      │
│ - VoteForm      │    │ - 权重计算      │    │ - 历史数据      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 数据流图
```
用户操作 → React组件 → Polkadot.js API → Substrate Runtime → 链上存储
   ↑                                                              ↓
   └──────────── 事件监听 ← 区块事件 ← Runtime Hook ←─────────────┘
```

---

## 🔧 链端实现

### pallet-affiliate 扩展

#### 文件结构
```
pallets/affiliate/src/
├── lib.rs              # 主模块（已扩展）
├── governance.rs       # 治理数据结构和逻辑
└── README.md           # 模块文档
```

#### 核心数据结构

**提案结构 (PercentageAdjustmentProposal)**
```rust
pub struct PercentageAdjustmentProposal<T: Config> {
    pub proposal_id: u64,
    pub proposer: T::AccountId,
    pub title_cid: BoundedVec<u8, ConstU32<64>>,
    pub description_cid: BoundedVec<u8, ConstU32<64>>,
    pub rationale_cid: BoundedVec<u8, ConstU32<64>>,
    pub new_percentages: LevelPercents,
    pub effective_block: BlockNumberFor<T>,
    pub status: ProposalStatus,
    pub is_major: bool,
    pub created_at: BlockNumberFor<T>,
    pub voting_start: Option<BlockNumberFor<T>>,
    pub voting_end: Option<BlockNumberFor<T>>,
}
```

**投票记录 (VoteRecord)**
```rust
pub struct VoteRecord<T: Config> {
    pub proposal_id: u64,
    pub voter: T::AccountId,
    pub vote: Vote,
    pub conviction: Conviction,
    pub voting_power: u64,
    pub timestamp: BlockNumberFor<T>,
}
```

**投票统计 (VoteTally)**
```rust
pub struct VoteTally {
    pub aye_votes: u128,
    pub nay_votes: u128,
    pub abstain_votes: u128,
    pub total_turnout: u128,
}
```

#### 存储项配置

| 存储项 | 类型 | 描述 |
|-------|------|------|
| `NextProposalId` | `u64` | 下一个提案ID |
| `ActiveProposals` | `StorageMap<u64, Proposal>` | 活跃提案 |
| `ProposalDeposits` | `StorageMap<u64, Deposit>` | 提案押金 |
| `ProposalVotes` | `StorageDoubleMap<u64, AccountId, Vote>` | 投票记录 |
| `VoteTally` | `StorageMap<u64, VoteTally>` | 投票统计 |
| `VoteHistory` | `StorageMap<AccountId, Vec<u64>>` | 投票历史 |
| `PercentageHistory` | `StorageValue<Vec<HistoryRecord>>` | 比例变更历史 |
| `GovernancePaused` | `StorageValue<bool>` | 治理暂停状态 |
| `PauseReason` | `StorageValue<BoundedVec<u8, 128>>` | 暂停原因 |
| `ProposalCooldown` | `StorageMap<AccountId, BlockNumber>` | 提案冷却期 |
| `ActiveProposalsByAccount` | `StorageMap<AccountId, Vec<u64>>` | 账户提案列表 |
| `LastProposalBlock` | `StorageMap<AccountId, BlockNumber>` | 最后提案区块 |
| `ReadyForExecution` | `StorageMap<u64, Proposal>` | 待执行提案 |

#### 外部调用函数 (Extrinsics)

**1. propose_percentage_adjustment** (call_index: 50)
```rust
#[pallet::weight(T::WeightInfo::propose_percentage_adjustment())]
pub fn propose_percentage_adjustment(
    origin: OriginFor<T>,
    new_percentages: LevelPercents,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    description_cid: BoundedVec<u8, ConstU32<64>>,
    rationale_cid: BoundedVec<u8, ConstU32<64>>,
) -> DispatchResult
```

**2. vote_on_percentage_proposal** (call_index: 51)
```rust
#[pallet::weight(T::WeightInfo::vote_on_percentage_proposal())]
pub fn vote_on_percentage_proposal(
    origin: OriginFor<T>,
    proposal_id: u64,
    vote: u8,  // 0=Aye, 1=Nay, 2=Abstain
    conviction: u8,  // 0-6 conviction level
) -> DispatchResult
```

**3. cancel_proposal** (call_index: 52)
```rust
#[pallet::weight(T::WeightInfo::cancel_proposal())]
pub fn cancel_proposal(
    origin: OriginFor<T>,
    proposal_id: u64,
) -> DispatchResult
```

**4. emergency_pause_governance** (call_index: 60)
```rust
#[pallet::weight(T::WeightInfo::emergency_pause_governance())]
pub fn emergency_pause_governance(
    origin: OriginFor<T>,
    reason: BoundedVec<u8, ConstU32<128>>,
) -> DispatchResult
```

**5. resume_governance** (call_index: 61)
```rust
#[pallet::weight(T::WeightInfo::resume_governance())]
pub fn resume_governance(origin: OriginFor<T>) -> DispatchResult
```

#### 权重计算函数

```rust
/// 计算投票权重
/// 公式：投票权重 = 持币权重 × 70% + 参与权重 × 20% + 贡献权重 × 10%
pub fn calculate_voting_power<T: Config>(
    account: &T::AccountId,
    conviction: Conviction,
) -> Result<u64, DispatchError> {
    let balance_weight = Self::calculate_balance_weight::<T>(account)?;
    let participation_weight = Self::calculate_participation_weight::<T>(account)?;
    let contribution_weight = Self::calculate_contribution_weight::<T>(account)?;

    let base_power = balance_weight * 70 / 100
                   + participation_weight * 20 / 100
                   + contribution_weight * 10 / 100;

    let conviction_multiplier = conviction.multiplier();
    Ok(base_power * conviction_multiplier / 100)
}
```

#### 自动执行钩子

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_finalize(block_number: BlockNumberFor<T>) {
        // 检查待执行提案
        for (proposal_id, proposal) in ReadyForExecution::<T>::iter() {
            if proposal.effective_block <= block_number {
                // 执行提案
                if let Err(e) = Self::execute_percentage_change(&proposal) {
                    log::error!("Failed to execute proposal {}: {:?}", proposal_id, e);
                } else {
                    log::info!("Successfully executed proposal {}", proposal_id);
                    ReadyForExecution::<T>::remove(proposal_id);
                    Self::deposit_event(Event::PercentageAdjustmentExecuted {
                        proposal_id,
                        new_percentages: proposal.new_percentages,
                    });
                }
            }
        }
    }
}
```

#### 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    /// 提案已创建 [proposal_id, proposer, is_major, deposit]
    PercentageAdjustmentProposed {
        proposal_id: u64,
        proposer: T::AccountId,
        is_major: bool,
        deposit: BalanceOf<T>,
    },

    /// 投票已提交 [proposal_id, voter, vote, voting_power]
    VoteCast {
        proposal_id: u64,
        voter: T::AccountId,
        vote: Vote,
        voting_power: u64,
    },

    /// 提案已通过 [proposal_id, effective_block]
    ProposalPassed {
        proposal_id: u64,
        effective_block: BlockNumberFor<T>,
    },

    /// 提案被拒绝 [proposal_id]
    ProposalRejected { proposal_id: u64 },

    /// 提案被取消 [proposal_id, cancelled_by]
    ProposalCancelled {
        proposal_id: u64,
        cancelled_by: T::AccountId,
    },

    /// 比例调整已执行 [proposal_id, new_percentages]
    PercentageAdjustmentExecuted {
        proposal_id: u64,
        new_percentages: LevelPercents,
    },

    /// 治理紧急暂停 [paused_by, reason]
    GovernanceEmergencyPaused {
        paused_by: T::AccountId,
        reason: BoundedVec<u8, ConstU32<128>>,
    },

    /// 治理已恢复 [resumed_by]
    GovernanceResumed { resumed_by: T::AccountId },
}
```

---

## 🎨 前端实现

### 组件架构

#### 文件结构
```
stardust-dapp/src/features/governance/
├── AffiliateGovernanceDashboard.tsx    # 治理仪表板
├── CreateAffiliateProposal.tsx         # 创建提案
├── VoteAffiliateProposal.tsx           # 提案投票
└── lib/
    └── governance.ts                   # 工具函数
```

#### 核心组件

**1. AffiliateGovernanceDashboard.tsx**
- **功能**：显示提案列表，状态筛选，投票进度
- **核心钩子**：`useWallet()`, `useState`, `useEffect`
- **关键API**：
  ```typescript
  const entries = await api.query.affiliate.activeProposals.entries();
  const voteTally = await api.query.affiliate.voteTally(proposalId);
  ```

**2. CreateAffiliateProposal.tsx**
- **功能**：创建新的分成比例调整提案
- **表单验证**：比例规则、IPFS CID 格式、押金计算
- **核心逻辑**：
  ```typescript
  const calculateChangeMagnitude = (newPercentages: number[]) => {
    let totalChange = 0;
    for (let i = 0; i < 15; i++) {
      const diff = Math.abs(newPercentages[i] - currentPercentages[i]);
      totalChange += diff;
    }
    return totalChange;
  };
  ```

**3. VoteAffiliateProposal.tsx**
- **功能**：对提案进行投票，支持信念投票
- **投票选项**：Aye(支持)、Nay(反对)、Abstain(弃权)
- **权重计算**：实时显示用户投票权重

#### 路由配置

```typescript
// stardust-dapp/src/routes.tsx
export const routes: RouteItem[] = [
  // ... 现有路由
  {
    match: h => h === '#/gov/affiliate/dashboard',
    component: lazy(() => import('./features/governance/AffiliateGovernanceDashboard'))
  },
  {
    match: h => h === '#/gov/affiliate/create-proposal',
    component: lazy(() => import('./features/governance/CreateAffiliateProposal'))
  },
  {
    match: h => h.startsWith('#/gov/affiliate/vote/'),
    component: lazy(() => import('./features/governance/VoteAffiliateProposal'))
  },
  {
    match: h => h.startsWith('#/gov/affiliate/proposal/'),
    component: lazy(() => import('./features/governance/VoteAffiliateProposal'))
  },
];
```

#### 导航集成

**钱包页面菜单项**
```typescript
// stardust-dapp/src/features/profile/MyWalletPage.tsx
const menuItems: MenuItem[] = [
  // ... 现有菜单项
  {
    icon: <BankOutlined style={{ fontSize: '20px' }} />,
    title: '联盟治理',
    onClick: () => {
      window.location.hash = '#/gov/affiliate/dashboard';
    },
  },
];
```

### 状态管理

#### 本地状态
```typescript
interface ProposalState {
  proposals: Proposal[];
  loading: boolean;
  activeTab: string;
  voteTally: VoteTally | null;
  hasVoted: boolean;
  votingPower: string;
}
```

#### API 抽象层
```typescript
// 提案查询
export const loadProposals = async (): Promise<Proposal[]> => {
  const api = await getApi();
  const entries = await api.query.affiliate.activeProposals.entries();
  return entries.map(([key, proposal]) => transformProposal(key, proposal));
};

// 投票提交
export const submitVote = async (
  proposalId: number,
  vote: number,
  conviction: number,
  password: string
): Promise<string> => {
  return await signAndSendLocalWithPassword(
    'affiliate',
    'voteOnPercentageProposal',
    [proposalId, vote, conviction],
    password
  );
};
```

### UI/UX 设计

#### 响应式设计
- **移动端优先**：最大宽度 640px
- **触控友好**：按钮大小 ≥44px
- **清晰层级**：卡片式布局，视觉分组

#### 视觉反馈
- **加载状态**：Spin 组件
- **成功/错误**：message 提示
- **实时数据**：Progress 进度条
- **状态标签**：Tag 颜色编码

#### 交互流程
```
1. 用户进入治理仪表板
   ├── 查看提案列表
   ├── 筛选状态（全部/讨论中/投票中/已通过/已拒绝）
   └── 选择操作（查看详情/立即投票/创建提案）

2. 创建提案流程
   ├── 加载当前比例
   ├── 输入新比例（实时验证）
   ├── 填写 IPFS CID
   ├── 确认押金金额
   └── 签名提交

3. 投票流程
   ├── 查看提案详情
   ├── 选择投票选项
   ├── 选择信念投票等级
   ├── 查看投票权重预览
   └── 签名提交投票
```

---

## 🔐 安全设计

### 权限控制

#### 链端权限
- **提案创建**：任何账户（需支付押金）
- **投票权限**：任何有余额的账户
- **紧急暂停**：Root 权限
- **比例修改**：仅通过 `execute_percentage_change()` 函数

#### 前端权限
- **钱包连接**：所有治理功能需要钱包连接
- **余额检查**：创建提案前检查押金余额
- **重复投票**：链端防止，前端显示状态

### 安全措施

#### 输入验证
```typescript
// 比例验证
const validatePercentages = (percentages: number[]): string | null => {
  const total = percentages.reduce((sum, p) => sum + p, 0);
  if (total < 50 || total > 99) {
    return '比例总和必须在 50% 到 99% 之间';
  }

  if (percentages[0] === 0 || percentages[1] === 0 || percentages[2] === 0) {
    return '前3层比例不能为0';
  }

  for (let i = 1; i < 5; i++) {
    if (percentages[i] > percentages[i - 1]) {
      return '前5层比例应该递减';
    }
  }

  return null;
};
```

#### 防重放攻击
```rust
// 链端防重放
ensure!(!ProposalVotes::<T>::contains_key(proposal_id, &voter), Error::<T>::AlreadyVoted);
ProposalVotes::<T>::insert(proposal_id, &voter, vote_record);
```

#### IPFS 内容验证
```typescript
// CID 格式验证
const validateIPFSCID = (cid: string): boolean => {
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52,})$/.test(cid);
};
```

### 错误处理

#### 链端错误码
```rust
#[pallet::error]
pub enum Error<T> {
    InvalidPercentageLength,    // 比例数组长度错误
    PercentageTooHigh,         // 单层比例过高
    CriticalLayerZero,         // 关键层为0
    TotalPercentageTooLow,     // 总比例过低
    TotalPercentageTooHigh,    // 总比例过高
    NonDecreasingPercentage,   // 前5层非递减
    FirstLayerTooHigh,         // 第一层过高
    InsufficientBalance,       // 余额不足
    ProposalNotFound,          // 提案不存在
    VotingNotActive,           // 投票未开始
    AlreadyVoted,              // 重复投票
    NotProposer,               // 非提案人
    CannotCancelAfterVoting,   // 投票后无法取消
    TooManyActiveProposals,    // 提案过多
    ProposalTooFrequent,       // 提案过于频繁
    InCooldownPeriod,          // 冷却期内
    InsufficientAuthority,     // 权限不足
}
```

#### 前端错误处理
```typescript
try {
  const result = await submitProposal(proposalData);
  message.success('提案创建成功！');
} catch (error: any) {
  console.error('创建提案失败:', error);

  // 解析链端错误
  if (error.message?.includes('InsufficientBalance')) {
    message.error('余额不足，请确保有足够的DUST支付押金');
  } else if (error.message?.includes('TotalPercentageTooHigh')) {
    message.error('比例总和过高，请调整到99%以下');
  } else {
    message.error(`创建提案失败: ${error.message || '未知错误'}`);
  }
}
```

---

## 📊 性能优化

### 链端优化

#### 存储优化
- **BoundedVec**：限制 IPFS CID 长度（64字节）
- **索引设计**：账户索引、状态索引避免全量扫描
- **清理机制**：定期清理历史数据

#### 计算优化
```rust
// 权重计算缓存
#[pallet::storage]
pub type VotingPowerCache<T: Config> = StorageMap<
    _, Blake2_128Concat, T::AccountId,
    (u64, BlockNumberFor<T>)  // (power, computed_at_block)
>;

pub fn get_cached_voting_power<T: Config>(
    account: &T::AccountId
) -> Option<u64> {
    if let Some((power, block)) = VotingPowerCache::<T>::get(account) {
        let current_block = frame_system::Pallet::<T>::block_number();
        // 缓存1小时(600区块)有效
        if current_block.saturating_sub(block) < 600u32.into() {
            return Some(power);
        }
    }
    None
}
```

### 前端优化

#### 组件优化
```typescript
// React.memo 优化重渲染
export const ProposalCard = React.memo<ProposalCardProps>(({ proposal, onVote }) => {
  return (
    <Card onClick={() => onVote(proposal.id)}>
      <ProposalInfo proposal={proposal} />
      <VoteProgress tally={proposal.voteTally} />
    </Card>
  );
});

// useMemo 优化计算
const filteredProposals = useMemo(() => {
  if (activeTab === 'all') return proposals;
  return proposals.filter(p => tabStatusMap[activeTab]?.includes(p.status));
}, [proposals, activeTab]);
```

#### 加载优化
```typescript
// 懒加载组件
const AffiliateGovernanceDashboard = lazy(() =>
  import('./features/governance/AffiliateGovernanceDashboard')
);

// 分页加载
const [page, setPage] = useState(1);
const pageSize = 10;
const paginatedProposals = proposals.slice(
  (page - 1) * pageSize,
  page * pageSize
);
```

#### 数据缓存
```typescript
// React Query 缓存
export const useProposals = () => {
  return useQuery({
    queryKey: ['proposals'],
    queryFn: loadProposals,
    staleTime: 30000,  // 30秒缓存
    refetchInterval: 60000,  // 1分钟自动刷新
  });
};
```

---

## 🧪 测试策略

### 单元测试

#### 链端测试
```rust
// pallets/affiliate/src/tests.rs
#[test]
fn propose_percentage_adjustment_works() {
    new_test_ext().execute_with(|| {
        let new_percentages = vec![25, 20, 15, 10, 8, 6, 4, 3, 3, 2, 1, 1, 1, 1, 1];

        assert_ok!(Affiliate::propose_percentage_adjustment(
            Origin::signed(1),
            new_percentages.clone(),
            b"title_cid".to_vec().try_into().unwrap(),
            b"desc_cid".to_vec().try_into().unwrap(),
            b"rationale_cid".to_vec().try_into().unwrap(),
        ));

        assert_eq!(NextProposalId::<Test>::get(), 1);
        assert!(ActiveProposals::<Test>::contains_key(0));
    });
}

#[test]
fn vote_on_proposal_works() {
    new_test_ext().execute_with(|| {
        // 创建提案
        create_test_proposal();

        // 投票
        assert_ok!(Affiliate::vote_on_percentage_proposal(
            Origin::signed(2),
            0, // proposal_id
            0, // vote: Aye
            0, // conviction: None
        ));

        let tally = VoteTally::<Test>::get(0).unwrap();
        assert!(tally.aye_votes > 0);
    });
}
```

#### 前端测试
```typescript
// stardust-dapp/src/__tests__/governance.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateAffiliateProposal from '../features/governance/CreateAffiliateProposal';

describe('CreateAffiliateProposal', () => {
  test('validates percentage input correctly', async () => {
    render(<CreateAffiliateProposal />);

    // 输入无效比例
    const layer1Input = screen.getByLabelText('L1');
    fireEvent.change(layer1Input, { target: { value: '101' } });

    await waitFor(() => {
      expect(screen.getByText('比例必须在0-100之间')).toBeInTheDocument();
    });
  });

  test('calculates deposit amount correctly', async () => {
    render(<CreateAffiliateProposal />);

    // 输入微调比例
    fillPercentageInputs([28, 16, 11, 8, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2]);

    await waitFor(() => {
      expect(screen.getByText('微调提案 - 需要押金: 1,000 DUST')).toBeInTheDocument();
    });
  });
});
```

### 集成测试

#### 端到端测试脚本
```javascript
// test-governance-flow.js
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

async function testGovernanceFlow() {
  console.log('🧪 开始端到端治理流程测试...');

  // 连接本地节点
  const provider = new WsProvider('ws://localhost:9944');
  const api = await ApiPromise.create({ provider });

  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const bob = keyring.addFromUri('//Bob');

  try {
    // 1. 创建提案
    console.log('1. 创建测试提案...');
    const newPercentages = [25, 20, 15, 10, 8, 6, 4, 3, 3, 2, 1, 1, 1, 1, 1];
    const proposeTx = api.tx.affiliate.proposePercentageAdjustment(
      newPercentages,
      'QmTestTitle123...',
      'QmTestDescription456...',
      'QmTestRationale789...'
    );

    const proposeResult = await proposeTx.signAndSend(alice);
    console.log('✅ 提案创建成功:', proposeResult.toHex());

    // 2. 查询提案
    console.log('2. 查询提案状态...');
    const proposal = await api.query.affiliate.activeProposals(0);
    console.log('✅ 提案查询成功:', proposal.toHuman());

    // 3. 投票
    console.log('3. 进行投票...');
    const voteTx = api.tx.affiliate.voteOnPercentageProposal(0, 0, 0);
    const voteResult = await voteTx.signAndSend(bob);
    console.log('✅ 投票成功:', voteResult.toHex());

    // 4. 查询投票统计
    console.log('4. 查询投票统计...');
    const tally = await api.query.affiliate.voteTally(0);
    console.log('✅ 投票统计:', tally.toHuman());

    console.log('🎉 端到端测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await api.disconnect();
  }
}

testGovernanceFlow();
```

---

## 📈 监控和日志

### 链端监控

#### 事件监控
```rust
// 关键事件日志
log::info!(
    "Proposal {} created by {:?}, type: {}, deposit: {}",
    proposal_id,
    proposer,
    if is_major { "Major" } else { "Minor" },
    deposit
);

log::warn!(
    "Proposal {} voting ended with low turnout: {}",
    proposal_id,
    tally.total_turnout
);
```

#### 性能指标
```rust
// 链端 Prometheus 指标
frame_support::runtime_print!(
    "Governance metrics - Active proposals: {}, Total votes: {}, Cache hits: {}",
    ActiveProposals::<T>::iter().count(),
    VoteTally::<T>::iter().count(),
    cache_hits
);
```

### 前端监控

#### 用户行为分析
```typescript
// 埋点统计
export const trackGovernanceEvent = (event: string, data?: any) => {
  if (typeof gtag !== 'undefined') {
    gtag('event', event, {
      event_category: 'governance',
      event_label: data?.proposalId || 'unknown',
      custom_parameter: data,
    });
  }

  console.log(`[Analytics] Governance ${event}:`, data);
};

// 使用示例
trackGovernanceEvent('proposal_created', { proposalId, type: 'major' });
trackGovernanceEvent('vote_submitted', { proposalId, vote: 'aye', conviction: 3 });
```

#### 错误监控
```typescript
// 错误上报
export const reportGovernanceError = (error: Error, context: any) => {
  console.error('[Governance Error]', error, context);

  // 发送错误报告
  if (process.env.NODE_ENV === 'production') {
    errorReporting.captureException(error, {
      tags: { category: 'governance' },
      extra: context,
    });
  }
};
```

---

## 🚀 部署指南

### 开发环境

#### 启动链端
```bash
# 编译节点
cargo build --release

# 启动开发链（清空数据）
./target/release/solochain-template-node --dev --tmp

# 启动开发链（保持数据）
./target/release/solochain-template-node --dev --base-path ./dev-chain-data/
```

#### 启动前端
```bash
cd stardust-dapp

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问: http://localhost:5173
```

### 生产环境

#### 链端部署
```bash
# 生产编译
CARGO_NET_OFFLINE=true cargo build --release

# 生成链规格
./target/release/solochain-template-node build-spec --chain=stardust-mainnet > stardust-mainnet.json

# 启动验证者节点
./target/release/solochain-template-node \
  --chain=stardust-mainnet.json \
  --validator \
  --base-path ./mainnet-data \
  --name="MainnetValidator" \
  --port 30333 \
  --rpc-port 9933 \
  --ws-port 9944 \
  --rpc-cors all \
  --unsafe-rpc-external \
  --unsafe-ws-external
```

#### 前端部署
```bash
# 生产构建
npm run build

# 部署到静态服务器
cp -r dist/* /var/www/stardust-dapp/

# Nginx 配置
server {
    listen 80;
    server_name governance.dustapps.net;
    root /var/www/stardust-dapp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker 部署

#### Dockerfile
```dockerfile
# 链端 Dockerfile
FROM ubuntu:20.04
COPY target/release/solochain-template-node /usr/local/bin/
EXPOSE 9933 9944 30333
CMD ["solochain-template-node", "--validator"]

# 前端 Dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

#### Docker Compose
```yaml
version: '3.8'
services:
  stardust-node:
    build: .
    ports:
      - "9933:9933"
      - "9944:9944"
      - "30333:30333"
    volumes:
      - ./chain-data:/data
    command: [
      "solochain-template-node",
      "--validator",
      "--base-path=/data",
      "--rpc-cors=all"
    ]

  stardust-dapp:
    build: ./stardust-dapp
    ports:
      - "80:80"
    depends_on:
      - stardust-node
```

---

## 📞 维护和支持

### 常见问题

#### Q: 提案创建失败，提示"InsufficientBalance"
A: 检查账户余额是否足够支付押金（微调提案1000 DUST，重大提案10000 DUST）

#### Q: 投票时提示"AlreadyVoted"
A: 每个账户只能对同一提案投票一次，无法修改投票

#### Q: 页面显示"提案不存在"
A: 提案可能已执行或被取消，请返回仪表板查看最新状态

#### Q: IPFS CID 格式错误
A: 确保CID格式正确，支持 Qm... (v0) 或 bafy... (v1) 格式

### 故障排除

#### 链端问题
```bash
# 查看节点日志
tail -f /var/log/stardust-node.log

# 检查存储状态
./target/release/solochain-template-node \
  --dev --tmp --rpc-methods=unsafe \
  --rpc-cors=all --log=runtime=debug
```

#### 前端问题
```bash
# 查看浏览器控制台
# Chrome DevTools > Console

# 检查网络请求
# Chrome DevTools > Network

# 清除缓存
localStorage.clear();
location.reload();
```

### 升级指南

#### 链端升级
```bash
# 备份数据
cp -r ./chain-data ./chain-data.backup

# 编译新版本
git pull origin main
cargo build --release

# 停止旧节点，启动新节点
systemctl stop stardust-node
systemctl start stardust-node
```

#### 前端升级
```bash
# 更新代码
git pull origin main
npm install

# 构建部署
npm run build
cp -r dist/* /var/www/stardust-dapp/
```

---

**文档版本**: v1.0.0
**创建日期**: 2025-11-12
**最后更新**: 2025-11-12
**维护者**: Stardust 开发团队