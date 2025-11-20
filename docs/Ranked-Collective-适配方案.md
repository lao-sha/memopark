# Ranked Collective 功能分析与 Stardust 适配方案

## 一、Ranked Collective 功能概述

### 1.1 核心功能

**Ranked Collective**（分级集体）是 Substrate/Polkadot 官方提供的高级治理模块，主要特点：

#### 分级成员管理
- 成员拥有等级（Rank），0 为最低级
- 支持无限层级和无限成员数
- 成员只能逐级晋升或降级（每次 ±1 级）
- 移除成员时需从当前等级逐级降至 0

#### 加权投票系统
- 不同等级拥有不同投票权重
- 高等级可参与低等级的投票（权限累积）
- 投票权重由 `VoteWeight` 配置项控制
- 支持多种投票策略（简单多数、超级多数等）

#### 与 Referenda 深度集成
- 提供 `Tally` trait 实现，用于投票计数
- `MinRankOfClass` 控制不同等级投票的提案类别
- `VoteWeight` 根据等级和提案类别计算投票权重
- 支持基于等级的提案过滤

#### 性能优化
- 大部分操作 O(1) 时间复杂度
- 唯一例外：`remove_member` 需要遍历等级
- 可以 O(1) 时间从特定等级随机选择成员

#### Origin 权限控制
- `EnsureRank` trait 确保调用者达到特定等级
- 可用于构建基于等级的权限系统
- 支持与其他 Origin 组合使用

---

## 二、Stardust 项目现状

### 2.1 现有治理架构

Stardust 已建立完整的三委员会治理体系：

```rust
// 1. 委员会（Council）- 主要治理
[pallet_index(38)]
pub type Council = pallet_collective<Instance1>;
// 配置：最多50成员，7天投票期，2/3多数通过

// 2. 技术与安全委员会
[pallet_index(39)]
pub type TechnicalCommittee = pallet_collective<Instance2>;
// 配置：最多15成员，3天投票期，用于技术决策

// 3. 内容委员会
[pallet_index(40)]
pub type ContentCommittee = pallet_collective<Instance3>;
// 配置：最多25成员，5天投票期，用于内容审核
```

### 2.2 治理权限分配

当前权限设计遵循 `Root | 委员会 2/3 多数` 原则：

| 业务领域 | 治理权限 | 委员会 |
|---------|---------|--------|
| 内容审核（墓地、逝者、媒体） | Root \| ContentCommittee 2/3 | Instance3 |
| 仲裁裁决 | Root \| ContentCommittee 2/3 | Instance3 |
| 技术升级、参数调整 | Root \| TechnicalCommittee 2/3 | Instance2 |
| 财务治理（国库、费率） | Root \| Council 2/3 | Instance1 |
| 做市商审核 | Root \| Council 2/3 | Instance1 |

### 2.3 专项治理模块

1. **pallet-memo-content-governance**
   - 第三方申诉机制
   - 公示期自动执行
   - 押金罚没机制
   - 与各业务 pallet 的治理接口集成

2. **pallet-arbitration**
   - 统一仲裁中枢
   - 支持多业务域（OTC、订单等）
   - 路由机制分发裁决

3. **pallet-collective**（三实例）
   - 成熟的提案-投票-执行流程
   - 支持 Prime 成员机制
   - 灵活的多数阈值配置

### 2.4 项目特点

- **主网未上线**：允许破坏式调整，无历史包袱
- **业务导向**：核心是纪念园服务，不是链上治理平台
- **低耦合设计**：各 pallet 职责清晰，通过路由解耦
- **会员体系**：已有 pallet-membership，支持分级会员

---

## 三、是否需要使用 Ranked Collective？

### 3.1 ❌ 结论：**暂时不建议使用**

#### 理由1：功能重叠严重

| 需求 | Ranked Collective | 现有方案 | 评估 |
|------|------------------|---------|-----|
| 分层治理 | 等级制 | 三委员会实例 | 现有方案已满足 |
| 投票权分配 | 等级加权 | 委员会多数阈值 | 无需精细化权重 |
| 权限控制 | EnsureRank | Root \| Committee 2/3 | 现有方案更简单 |
| 提案分类 | MinRankOfClass | 不同委员会负责不同领域 | 职责更清晰 |

#### 理由2：项目定位不匹配

- **Stardust**：纪念园服务平台
  - 核心业务：墓地管理、逝者纪念、供奉、OTC交易
  - 治理重点：内容审核、争议仲裁、参数调整
  - 用户群体：普通用户为主，治理参与度有限

- **Ranked Collective 适用场景**：
  - 大规模去中心化治理平台（如 Polkadot）
  - 需要精细化权限分级的 DAO
  - 高度活跃的社区治理参与

#### 理由3：增加系统复杂度

**开发成本：**
- 需要设计等级体系（多少层级？每级权重？）
- 需要定义晋升/降级标准
- 需要实现等级管理接口
- 需要迁移现有治理逻辑

**运营成本：**
- 需要额外的治理流程（晋升/降级投票）
- 需要培训委员会成员
- 需要编写详细文档

**用户成本：**
- 增加治理参与门槛
- 难以理解等级体系
- 降低治理透明度

#### 理由4：维护成本高

- **前端集成**：需要显示等级、投票权重、晋升记录
- **索引支持**：Subsquid 需要索引等级变更事件
- **测试覆盖**：需要测试各等级的权限边界
- **文档维护**：需要持续更新治理文档

### 3.2 ✅ 但保留未来可能性

虽然当前不建议使用，但以下场景可以考虑引入：

#### 场景1：社区规模扩大后的治理升级

**触发条件：**
- 委员会成员超过 50 人
- 治理提案数量激增（每周 >20 个）
- 需要更精细的权限分配

**适用方式：**
- 将 ContentCommittee 升级为 Ranked Collective
- 初级审核员（Rank 0-2）：处理日常申诉
- 高级审核员（Rank 3-5）：处理复杂案件
- 资深理事（Rank 6+）：参与规则制定

#### 场景2：专业技能分级

**触发条件：**
- 需要根据专业能力分配任务
- 需要激励长期贡献者

**适用方式：**
```rust
// 内容审核分级
Rank 0: 见习审核员（只能投票，不能提案）
Rank 1-2: 初级审核员（可处理简单申诉）
Rank 3-4: 中级审核员（可处理复杂案件）
Rank 5-6: 高级审核员（可制定审核标准）
Rank 7+: 首席审核官（可修改治理规则）
```

#### 场景3：与 OpenGov 完整集成

**触发条件：**
- Stardust 成为 Polkadot 平行链
- 需要与 Polkadot 治理体系对接
- 需要实现 Fellowship 机制

**适用方式：**
- 使用 Ranked Collective 作为 Fellowship 实现
- 与 Polkadot 的 Referenda 集成
- 实现跨链治理提案

---

## 四、Stardust 适配方案设计（备用）

如果未来确实需要使用 Ranked Collective，以下是三种渐进式适配方案：

### 方案A：内容审核分级体系（推荐）

#### 适用场景
- 内容审核工作量大
- 需要激励优秀审核员
- 需要建立审核员成长路径

#### 等级设计

```rust
// 内容审核员等级体系
pub enum ContentModeratorRank {
    Probation = 0,      // 见习期（3个月）
    Junior = 1,         // 初级审核员
    Intermediate = 2,   // 中级审核员
    Senior = 3,         // 高级审核员
    Expert = 4,         // 专家审核员
    Lead = 5,           // 首席审核官
}
```

#### 权限分配

| 等级 | 投票权重 | 可处理案件类型 | 提案权限 |
|------|---------|--------------|---------|
| Rank 0 | 1 | 无（仅观察学习） | ❌ |
| Rank 1 | 2 | 简单申诉（明显违规） | ✅ 提交处理建议 |
| Rank 2 | 4 | 一般申诉（需判断） | ✅ 提案处理方案 |
| Rank 3 | 8 | 复杂申诉（争议大） | ✅ 提案修改审核标准 |
| Rank 4 | 16 | 重大争议案件 | ✅ 提案修改治理规则 |
| Rank 5 | 32 | 所有案件 + 制度设计 | ✅ 提案修改治理架构 |

#### 晋升标准

```rust
// 晋升条件（示例）
pub struct PromotionCriteria {
    // Rank 0 → 1
    probation_period: 90 * DAYS,          // 见习期3个月
    min_votes_cast: 50,                    // 至少参与50次投票
    
    // Rank 1 → 2
    junior_period: 180 * DAYS,             // 初级阶段6个月
    min_cases_handled: 100,                // 处理100个案件
    approval_rate: Percent::from_percent(80), // 决策准确率80%+
    
    // Rank 2 → 3
    intermediate_period: 360 * DAYS,       // 中级阶段1年
    min_complex_cases: 50,                 // 处理50个复杂案件
    approval_rate: Percent::from_percent(85), // 决策准确率85%+
    
    // Rank 3 → 4
    senior_period: 720 * DAYS,             // 高级阶段2年
    min_disputed_cases: 30,                // 处理30个重大争议
    community_endorsement: 10,             // 10名成员推荐
    
    // Rank 4 → 5
    expert_period: 1080 * DAYS,            // 专家阶段3年
    leadership_contribution: true,         // 领导力贡献
    governance_proposals: 5,               // 至少5个治理提案通过
}
```

#### Runtime 配置

```rust
// ranked_collective 配置（内容审核）
parameter_types! {
    pub const ContentRankedMotionDuration: BlockNumber = 5 * DAYS;
    pub const ContentRankedMaxProposals: u32 = 50;
    pub const ContentRankedMaxMembers: u32 = 100;
}

type ContentRankedCollective = pallet_ranked_collective::Instance1;

impl pallet_ranked_collective::Config<ContentRankedCollective> for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_ranked_collective::weights::SubstrateWeight<Runtime>;
    
    // 等级与投票权重映射
    type VoteWeight = ContentVoteWeight;
    
    // 等级与提案类别映射
    type MinRankOfClass = ContentMinRank;
    
    // 投票系统（Referenda）
    type Polls = ContentReferenda;
    
    // 成员管理权限
    type AddOrigin = frame_system::EnsureRoot<AccountId>; // 仅 Root 可添加成员
    type PromoteOrigin = ContentPromoteOrigin;              // 高一级成员可提议晋升
    type DemoteOrigin = ContentDemoteOrigin;                // 高两级成员可提议降级
    type RemoveOrigin = frame_system::EnsureRoot<AccountId>; // 仅 Root 可移除成员
    type ExchangeOrigin = frame_system::EnsureRoot<AccountId>; // 仅 Root 可交换等级
    
    // 成员互换处理器（可选）
    type MemberSwappedHandler = ();
}

// 投票权重实现
pub struct ContentVoteWeight;
impl Convert<(u16, u32), u32> for ContentVoteWeight {
    fn convert((rank, _class): (u16, u32)) -> u32 {
        // 权重 = 2^rank
        2u32.saturating_pow(rank as u32)
    }
}

// 等级要求实现
pub struct ContentMinRank;
impl Convert<u32, u16> for ContentMinRank {
    fn convert(class: u32) -> u16 {
        match class {
            0 => 1,  // 简单申诉：Rank 1+
            1 => 2,  // 一般申诉：Rank 2+
            2 => 3,  // 复杂申诉：Rank 3+
            3 => 4,  // 重大争议：Rank 4+
            4 => 5,  // 制度设计：Rank 5
            _ => u16::MAX,
        }
    }
}

// 晋升权限：高一级成员提议
pub struct ContentPromoteOrigin;
impl EnsureOrigin<RuntimeOrigin> for ContentPromoteOrigin {
    type Success = (AccountId, u16); // (提议人, 目标等级)
    
    fn try_origin(o: RuntimeOrigin) -> Result<Self::Success, RuntimeOrigin> {
        let who = frame_system::ensure_signed(o.clone())?;
        
        // 获取提议人等级
        let promoter_rank = RankedCollective::rank_of(&who)?;
        
        // TODO: 从调用参数中获取目标等级
        let target_rank = 1; // 示例
        
        // 必须比目标等级高至少1级
        if promoter_rank > target_rank {
            Ok((who, target_rank))
        } else {
            Err(o)
        }
    }
}
```

#### 与现有系统集成

```rust
// memo-content-governance 集成
impl pallet_memo_content_governance::Config for Runtime {
    // ... 其他配置 ...
    
    // 审批起源：Root | ContentRankedCollective Rank 3+
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_ranked_collective::EnsureRank<
            Runtime,
            ContentRankedCollective,
            3, // 最低 Rank 3
        >,
    >;
}

// 仲裁裁决集成
impl pallet_arbitration::Config for Runtime {
    // ... 其他配置 ...
    
    // 裁决起源：Root | ContentRankedCollective Rank 4+
    type DecisionOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_ranked_collective::EnsureRank<
            Runtime,
            ContentRankedCollective,
            4, // 最低 Rank 4
        >,
    >;
}
```

#### 前端适配

**审核员仪表板：**
```typescript
// 审核员信息
interface ModeratorInfo {
  account: string;
  rank: number;
  rankName: string;
  votingPower: number;
  casesHandled: number;
  approvalRate: number;
  joinedAt: number;
  nextPromotionEligible: number;
}

// 显示等级徽章
const RankBadge = ({ rank }: { rank: number }) => {
  const config = {
    0: { name: '见习审核员', color: 'gray', icon: '🎓' },
    1: { name: '初级审核员', color: 'green', icon: '✅' },
    2: { name: '中级审核员', color: 'blue', icon: '⭐' },
    3: { name: '高级审核员', color: 'purple', icon: '🏆' },
    4: { name: '专家审核员', color: 'gold', icon: '👑' },
    5: { name: '首席审核官', color: 'red', icon: '🔥' },
  };
  
  const { name, color, icon } = config[rank];
  
  return (
    <Badge color={color}>
      {icon} {name} (Rank {rank})
    </Badge>
  );
};

// 晋升进度条
const PromotionProgress = ({ account }: { account: string }) => {
  const [progress, setProgress] = useState(null);
  
  useEffect(() => {
    const fetchProgress = async () => {
      const rank = await api.query.rankedCollective.members(account);
      const stats = await api.query.rankedCollective.memberStats(account);
      
      const criteria = getPromotionCriteria(rank);
      const currentProgress = {
        time: stats.timeInRank / criteria.requiredTime,
        cases: stats.casesHandled / criteria.minCases,
        approvalRate: stats.approvalRate / criteria.minApprovalRate,
      };
      
      setProgress(currentProgress);
    };
    
    fetchProgress();
  }, [account]);
  
  return (
    <div>
      <h3>晋升进度</h3>
      <Progress percent={progress.time * 100} label="任职时间" />
      <Progress percent={progress.cases * 100} label="案件处理" />
      <Progress percent={progress.approvalRate * 100} label="准确率" />
    </div>
  );
};
```

---

### 方案B：技术贡献者分级（备选）

#### 适用场景
- 需要激励开源贡献者
- 需要根据技术能力分配审核权限
- 需要建立技术专家委员会

#### 等级设计

```rust
pub enum TechnicalRank {
    Contributor = 0,       // 贡献者
    Maintainer = 1,        // 维护者
    CoreDeveloper = 2,     // 核心开发者
    Architect = 3,         // 架构师
    TechnicalLead = 4,     // 技术主管
}
```

#### 晋升标准

| 等级 | 贡献要求 | 投票权 | 可审核提案类型 |
|------|---------|-------|--------------|
| Rank 0 | 提交 PR 被合并 | 1 | 普通功能提案 |
| Rank 1 | 10+ PR 合并 | 2 | 功能提案 + Bug修复 |
| Rank 2 | 50+ PR + 1年贡献 | 4 | Runtime 升级 |
| Rank 3 | 100+ PR + 2年 + 重大功能 | 8 | 架构变更 |
| Rank 4 | 多年贡献 + 社区认可 | 16 | 所有技术提案 |

---

### 方案C：混合治理（最灵活）

#### 架构设计

```
┌─────────────────────────────────────────────────┐
│           Ranked Fellowship (核心)              │
│  Rank 0-2: 普通成员                              │
│  Rank 3-5: 专业委员                              │
│  Rank 6+:  理事会                                │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌───────▼────────┐
│ Technical Team │  │ Content Team   │
│  (Instance2)   │  │  (Instance3)   │
└────────────────┘  └────────────────┘
```

#### 权限矩阵

| 操作 | Root | Rank 6+ | Rank 3-5 | Technical | Content |
|------|------|---------|---------|-----------|---------|
| 内容审核 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 参数调整 | ✅ | ✅ | ✅ | ✅ | ❌ |
| Runtime 升级 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 治理规则修改 | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 五、迁移路径（如需引入）

### 阶段1：准备期（1-2个月）

**任务清单：**
- [ ] 设计等级体系和权限矩阵
- [ ] 编写晋升/降级标准文档
- [ ] 开发 Runtime 配置代码
- [ ] 编写单元测试和集成测试
- [ ] 准备前端组件（等级徽章、晋升进度等）

**风险评估：**
- 设计复杂度高，需要多次评审
- 与现有治理模块的集成需要充分测试

### 阶段2：试点期（3-6个月）

**任务清单：**
- [ ] 在测试网部署 Ranked Collective
- [ ] 选拔第一批审核员（20-30人）
- [ ] 进行为期3个月的试运行
- [ ] 收集反馈并优化规则
- [ ] 完善前端交互和文档

**关键指标：**
- 审核员参与度 > 80%
- 提案平均通过时间 < 3天
- 用户满意度 > 4.0/5.0

### 阶段3：正式上线（第7个月）

**任务清单：**
- [ ] 主网部署 Ranked Collective
- [ ] 迁移现有 ContentCommittee 成员
- [ ] 举办线上培训会
- [ ] 发布官方公告和教程
- [ ] 监控运行状态和性能

**回滚方案：**
- 保留原有 pallet-collective 实例作为备用
- 设置 2周观察期，如有问题立即回滚
- 准备紧急治理提案机制

### 阶段4：持续优化（长期）

**任务清单：**
- 每季度审查等级体系合理性
- 根据社区反馈调整晋升标准
- 开发更多自动化工具（如自动晋升提议）
- 与 Polkadot OpenGov 对接（如成为平行链）

---

## 六、技术实现细节

### 6.1 存储结构

```rust
// pallet-ranked-collective 核心存储
#[pallet::storage]
pub type Members<T: Config<I>, I: 'static = ()> = 
    StorageMap<_, Twox64Concat, T::AccountId, MemberRecord>;

#[derive(Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct MemberRecord {
    rank: Rank, // u16
}

#[pallet::storage]
pub type MemberCount<T: Config<I>, I: 'static = ()> = 
    StorageMap<_, Twox64Concat, Rank, MemberIndex>;

#[pallet::storage]
pub type IdToIndex<T: Config<I>, I: 'static = ()> = 
    StorageMap<_, Twox64Concat, (Rank, T::AccountId), MemberIndex>;

#[pallet::storage]
pub type IndexToId<T: Config<I>, I: 'static = ()> = 
    StorageMap<_, Twox64Concat, (Rank, MemberIndex), T::AccountId>;
```

### 6.2 核心接口

```rust
// 可调用函数（Dispatchable）
pub trait Pallet<T: Config<I>, I: 'static = ()> {
    /// 添加成员（初始 Rank 0）
    #[pallet::weight(T::WeightInfo::add_member())]
    pub fn add_member(origin: OriginFor<T>, who: AccountIdLookupOf<T>) 
        -> DispatchResult;
    
    /// 晋升成员（Rank + 1）
    #[pallet::weight(T::WeightInfo::promote_member())]
    pub fn promote_member(origin: OriginFor<T>, who: AccountIdLookupOf<T>) 
        -> DispatchResult;
    
    /// 降级成员（Rank - 1）
    #[pallet::weight(T::WeightInfo::demote_member())]
    pub fn demote_member(origin: OriginFor<T>, who: AccountIdLookupOf<T>) 
        -> DispatchResult;
    
    /// 移除成员（从当前 Rank 逐级降至 0 并删除）
    #[pallet::weight(T::WeightInfo::remove_member(...))]
    pub fn remove_member(
        origin: OriginFor<T>, 
        who: AccountIdLookupOf<T>, 
        min_rank: Rank
    ) -> DispatchResultWithPostInfo;
    
    /// 投票（针对 Referenda 提案）
    #[pallet::weight(T::WeightInfo::vote())]
    pub fn vote(
        origin: OriginFor<T>,
        poll: PollIndexOf<T, I>,
        aye: bool,
    ) -> DispatchResult;
}

// 只读接口（Runtime API）
pub trait RankedMembers<AccountId> {
    /// 获取成员等级
    fn rank_of(who: &AccountId) -> Option<Rank>;
    
    /// 获取某等级的成员数
    fn member_count(rank: Rank) -> MemberIndex;
    
    /// 获取某等级的所有成员
    fn members_at_rank(rank: Rank) -> Vec<AccountId>;
    
    /// 获取≥某等级的所有成员
    fn members_above_rank(min_rank: Rank) -> Vec<AccountId>;
}
```

### 6.3 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config<I>, I: 'static = ()> {
    /// 成员已添加
    MemberAdded { who: T::AccountId },
    
    /// 成员已晋升
    RankChanged { who: T::AccountId, old_rank: Rank, new_rank: Rank },
    
    /// 成员已移除
    MemberRemoved { who: T::AccountId, rank: Rank },
    
    /// 成员已投票
    Voted { who: T::AccountId, poll: PollIndexOf<T, I>, vote: VoteRecord, tally: TallyOf<T, I> },
    
    /// 成员交换了等级
    MembersExchanged { who: T::AccountId, other: T::AccountId },
}
```

### 6.4 权限检查实现

```rust
// EnsureRank Origin 实现
pub struct EnsureRank<T, I, const MIN_RANK: u16>(PhantomData<(T, I)>);

impl<T: Config<I>, I: 'static, const MIN_RANK: u16> EnsureOrigin<T::RuntimeOrigin> 
    for EnsureRank<T, I, MIN_RANK> 
{
    type Success = T::AccountId;
    
    fn try_origin(o: T::RuntimeOrigin) -> Result<Self::Success, T::RuntimeOrigin> {
        let who = frame_system::ensure_signed(o.clone())?;
        
        match Pallet::<T, I>::rank_of(&who) {
            Some(rank) if rank >= MIN_RANK => Ok(who),
            _ => Err(o),
        }
    }
}

// 使用示例
type EnsureRank3 = pallet_ranked_collective::EnsureRank<Runtime, ContentRankedCollective, 3>;

impl pallet_memo_content_governance::Config for Runtime {
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        EnsureRank3,
    >;
}
```

---

## 七、成本效益分析

### 7.1 开发成本

| 项目 | 工作量（人天） | 说明 |
|------|--------------|------|
| Runtime 配置 | 5-7 | 配置 pallet-ranked-collective |
| 权限集成 | 7-10 | 修改各 pallet 的 Origin 配置 |
| 单元测试 | 5-7 | 测试等级变更、投票、权限 |
| 集成测试 | 10-15 | 测试与现有治理模块的交互 |
| 前端开发 | 15-20 | 审核员仪表板、等级显示、晋升流程 |
| 文档编写 | 5-7 | 用户手册、治理规则、API 文档 |
| **总计** | **47-66** | **约 10-13 周（2-3 个月）** |

### 7.2 运营成本

| 项目 | 时间成本（人/周） | 说明 |
|------|-----------------|------|
| 成员招募 | 2-3 | 审核、面试、培训 |
| 晋升评审 | 1-2 | 每月审核晋升申请 |
| 争议处理 | 1-2 | 处理晋升/降级争议 |
| 规则优化 | 1-2 | 每季度调整规则 |
| **月度成本** | **5-9** | **约 20-30% 管理员精力** |

### 7.3 收益预期

#### 短期收益（6个月内）
- ✅ 提升审核员积极性（明确成长路径）
- ✅ 提高决策效率（权限分级，减少等待）
- ✅ 降低 Root 依赖（分散权力）

#### 中期收益（6-18个月）
- ✅ 建立专业审核团队
- ✅ 提升治理透明度和公信力
- ✅ 吸引更多社区贡献者

#### 长期收益（18个月+）
- ✅ 完善去中心化治理体系
- ✅ 为成为 Polkadot 平行链做准备
- ✅ 形成可持续的社区自治机制

### 7.4 风险评估

| 风险 | 影响 | 可能性 | 缓解措施 |
|------|------|-------|---------|
| 等级设计不合理 | 高 | 中 | 小范围试点，快速迭代 |
| 晋升标准争议 | 中 | 高 | 制定明确规则，定期公示 |
| 系统复杂度增加 | 高 | 高 | 分阶段引入，保留回滚方案 |
| 用户理解成本高 | 中 | 中 | 加强文档和培训 |
| 前端开发延期 | 低 | 中 | 预留缓冲时间 |

---

## 八、建议与总结

### 8.1 当前建议

❌ **不建议立即引入 Ranked Collective**

**核心理由：**
1. **功能重叠**：现有三委员会体系已满足治理需求
2. **项目定位**：Stardust 是业务平台，非治理平台
3. **成本过高**：开发、运营、维护成本显著
4. **时机未到**：社区规模和治理复杂度尚未达到阈值

### 8.2 观察指标

考虑引入 Ranked Collective 的触发条件：

#### 量化指标
- 委员会成员数 > 50 人
- 月度治理提案 > 20 个
- 内容申诉案件 > 100 件/月
- 委员会投票参与率 < 60%

#### 定性指标
- 出现明显的权限分配不合理问题
- 委员会成员反馈需要更精细的分级
- 社区强烈要求建立成长激励机制
- Stardust 计划成为 Polkadot 平行链

### 8.3 渐进式路径

如果未来需要引入，建议采用以下渐进式路径：

```
阶段1（现状）：三委员会体系
    ↓
阶段2（6-12个月）：将 ContentCommittee 升级为 Ranked Collective（试点）
    ↓
阶段3（12-24个月）：扩展到 TechnicalCommittee（如有需要）
    ↓
阶段4（24个月+）：建立统一的 Fellowship 体系（对接 Polkadot）
```

### 8.4 替代方案

在引入 Ranked Collective 之前，可以先尝试这些低成本方案：

#### 方案1：增强现有 pallet-collective
- 引入 Prime 成员机制（已支持）
- 设置不同的多数阈值（已支持）
- 增加委员会实例数量（如添加财务委员会）

#### 方案2：基于 pallet-membership 的简化分级
```rust
pub enum MemberTier {
    Standard,   // 标准会员
    Premium,    // 高级会员
    Council,    // 理事会成员
}

// 在 pallet-collective 中根据 tier 过滤成员
```

#### 方案3：链下治理 + 链上执行
- 使用 Snapshot（链下投票）
- 委员会根据链下投票结果执行链上提案
- 降低链上治理复杂度

---

## 九、附录

### A. 相关文档

- [Polkadot Fellowship 设计](https://github.com/polkadot-fellows/RFCs/blob/main/text/0000-polkadot-fellowship.md)
- [pallet-ranked-collective 源码](https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame/ranked-collective)
- [pallet-referenda 文档](https://paritytech.github.io/substrate/master/pallet_referenda/index.html)

### B. 术语表

| 术语 | 解释 |
|------|------|
| Rank | 成员等级（u16 类型，0 为最低） |
| Tally | 投票计数系统 |
| Poll | Referenda 提案 |
| Class | 提案类别（与 Rank 映射） |
| VoteWeight | 投票权重计算函数 |
| MinRankOfClass | 提案类别的最低等级要求 |
| Fellowship | 类似行业协会的专业人士集体 |

### C. FAQ

**Q1: Ranked Collective 与 pallet-collective 有什么区别？**

A: 主要区别：
- pallet-collective：扁平结构，所有成员权重相同
- pallet-ranked-collective：分层结构，等级越高权重越大

**Q2: 可以同时使用两者吗？**

A: 可以。实际上 Polkadot 就同时使用了 Council（pallet-collective）和 Fellowship（pallet-ranked-collective）。

**Q3: 晋升/降级需要投票吗？**

A: 取决于配置：
- `PromoteOrigin` 控制谁可以提议晋升
- 可以配置为：Root、高等级成员、或通过 Referenda 投票

**Q4: 如何防止权力集中？**

A: 建议措施：
- 设置合理的晋升标准和时间要求
- 限制最高等级人数（如 Rank 5 最多 5 人）
- 定期审查高等级成员表现
- 建立弹劾机制

**Q5: 等级会过期吗？**

A: pallet 本身不支持自动降级，但可以通过以下方式实现：
- Hook：监听成员活跃度，自动提议降级
- 定期审查：委员会投票决定是否降级不活跃成员

---

## 十、结论

**Ranked Collective** 是一个强大的分层治理工具，但**不适合 Stardust 当前阶段**。

**当前建议：**
- ✅ 继续使用现有三委员会体系
- ✅ 优化委员会成员招募和培训
- ✅ 完善治理流程文档
- ✅ 监控治理指标，观察是否需要升级

**未来规划：**
- 📅 当社区规模扩大到一定阈值时重新评估
- 📅 优先考虑将 ContentCommittee 升级为 Ranked Collective
- 📅 为成为 Polkadot 平行链预留技术方案

**核心原则：**
> **治理架构应该服务于业务需求，而非增加系统复杂度。**
> **在没有明确痛点之前，保持简单是最佳选择。**

---

**编写日期**：2025-10-23  
**版本**：v1.0  
**状态**：待审核

