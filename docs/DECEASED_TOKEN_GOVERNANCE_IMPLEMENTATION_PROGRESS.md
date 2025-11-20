# Pallet-Deceased Token治理方案 - 实施进度报告

## 📅 实施日期
**2025-11-18（进行中）**

## 🎯 方案概述

**采用方案**：**"3次自主 + 治理扩展"**

**核心设计**：
- Level 1: Owner 自主修改（0-3次）
- Level 2: 治理委员会审批扩展（需投票）

---

## ✅ 已完成工作

### 1. 数据结构添加 ✅

#### 1.1 Deceased 结构体新增字段

**位置**：`lib.rs:385-394`

```rust
pub struct Deceased<T: Config> {
    // ... 现有字段

    /// Token 修改次数（已使用）
    pub token_revision_count: u8,

    /// Token 修改次数上限
    /// - 初始值：3（Owner 自主修改）
    /// - 可通过治理扩展（委员会批准）
    /// - 最大值：10（即使治理批准也有上限）
    pub token_revision_limit: u8,

    // ... 其他字段
}
```

#### 1.2 治理提案数据结构

**位置**：`lib.rs:257-297`

```rust
/// Token修改提案状态
pub enum ProposalStatus {
    Pending,    // 待投票
    Approved,   // 已批准
    Rejected,   // 已拒绝
    Executed,   // 已执行
}

/// Token修改治理提案
pub struct TokenRevisionProposal<T: Config> {
    pub proposal_id: u64,
    pub deceased_id: T::DeceasedId,
    pub applicant: T::AccountId,
    pub additional_revisions: u8,
    pub reason: BoundedVec<u8, T::StringLimit>,
    pub evidence_cids: BoundedVec<BoundedVec<u8, T::TokenLimit>, ConstU32<5>>,
    pub status: ProposalStatus,
    pub submitted_at: BlockNumberFor<T>,
    pub approve_votes: u32,
    pub reject_votes: u32,
}
```

### 2. 存储项添加 ✅

**位置**：`lib.rs:674-699`

```rust
/// Token修改提案存储
#[pallet::storage]
pub type TokenRevisionProposals<T: Config> =
    StorageMap<_, Blake2_128Concat, u64, TokenRevisionProposal<T>, OptionQuery>;

/// 下一个提案ID
#[pallet::storage]
pub type NextProposalId<T: Config> = StorageValue<_, u64, ValueQuery>;

/// 提案投票记录
#[pallet::storage]
pub type ProposalVotes<T: Config> =
    StorageDoubleMap<
        _,
        Blake2_128Concat, u64,           // proposal_id
        Blake2_128Concat, T::AccountId,  // voter
        bool,                            // approve/reject
        OptionQuery
    >;
```

### 3. 配置项添加 ✅

**位置**：`lib.rs:630-640`

```rust
/// 委员会治理起源
type CommitteeOrigin: EnsureOrigin<Self::RuntimeOrigin>;

/// 提案批准阈值
#[pallet::constant]
type ApprovalThreshold: Get<u32>;
```

### 4. 错误类型添加 ✅

**位置**：`lib.rs:1935-1960`

```rust
// Token修改治理相关错误
TokenRevisionLimitExceeded,   // Token修改次数已达上限
ProposalNotFound,             // 提案不存在
InvalidProposalStatus,        // 提案状态不正确
NotCommitteeMember,           // 非委员会成员
AlreadyVoted,                 // 已投票
NotEligibleForExtension,      // 不符合申请资格
```

### 5. 事件添加 ✅

**位置**：`lib.rs:1512-1582`

```rust
// Token修改治理相关事件
TokenRevised { ... },                        // Token被修改
TokenRevisionProposalSubmitted { ... },      // 提交提案
TokenRevisionProposalVoted { ... },          // 委员会投票
TokenRevisionProposalApproved { ... },       // 提案被批准
TokenRevisionProposalRejected { ... },       // 提案被拒绝
TokenRevisionProposalExecuted { ... },       // 提案已执行
```

---

## ⏳ 待完成工作

### Step 1: 修改 create_deceased 函数

**任务**：初始化新字段

```rust
let deceased = Deceased::<T> {
    owner: who.clone(),
    creator: who.clone(),
    // ... 其他字段
    deceased_token,
    token_revision_count: 0,      // 初始化为0
    token_revision_limit: 3,      // 初始化为3
    // ... 其他字段
};
```

**预计时间**：5分钟

### Step 2: 修改 update_deceased 函数

**任务**：添加次数限制检查和token更新逻辑

```rust
pub fn update_deceased(...) -> DispatchResult {
    let who = ensure_signed(origin)?;

    DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
        let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
        ensure!(d.owner == who, Error::<T>::NotAuthorized);

        // 检查是否修改影响token的字段
        let will_affect_token = name.is_some()
            || birth_ts.is_some()
            || death_ts.is_some();

        if will_affect_token {
            // 检查修改次数限制
            ensure!(
                d.token_revision_count < d.token_revision_limit,
                Error::<T>::TokenRevisionLimitExceeded
            );
        }

        let old_token = d.deceased_token.clone();

        // 更新字段
        if let Some(n) = name {
            d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?;
        }
        // ... 更新其他字段

        // 重新生成token
        if will_affect_token {
            let new_token = Self::build_deceased_token(
                &d.gender, &d.birth_ts, &d.death_ts, &d.name
            );

            if new_token != old_token {
                // 唯一性检查
                if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) {
                    ensure!(existing_id == id, Error::<T>::DeceasedTokenExists);
                }

                // 更新索引
                DeceasedIdByToken::<T>::remove(&old_token);
                DeceasedIdByToken::<T>::insert(&new_token, id);

                // 更新token和计数
                d.deceased_token = new_token.clone();
                d.token_revision_count = d.token_revision_count.saturating_add(1);

                // 发出事件
                Self::deposit_event(Event::TokenRevised {
                    deceased_id: id,
                    old_token,
                    new_token,
                    revision_count: d.token_revision_count,
                });
            }
        }

        Ok(())
    })
}
```

**预计时间**：15分钟

### Step 3: 修改 gov_update_profile 函数

**任务**：与 update_deceased 类似的修改

**预计时间**：15分钟

### Step 4: 实现提案提交接口

**任务**：Owner 发起治理提案

```rust
/// 函数级中文注释：提交Token修改次数扩展提案
///
/// ### 权限
/// - 必须是 deceased 的 owner
/// - 必须已用完当前的修改次数
///
/// ### 参数
/// - deceased_id: 逝者ID
/// - additional_revisions: 申请的额外修改次数（1-3次）
/// - reason: 申请理由
/// - evidence_cids: 证据材料CID列表（最多5个）
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::submit_token_revision_proposal())]
pub fn submit_token_revision_proposal(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    additional_revisions: u8,
    reason: Vec<u8>,
    evidence_cids: Vec<Vec<u8>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 验证是 owner
    let deceased = DeceasedOf::<T>::get(deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    ensure!(deceased.owner == who, Error::<T>::NotAuthorized);

    // 验证已用完修改次数
    ensure!(
        deceased.token_revision_count >= deceased.token_revision_limit,
        Error::<T>::NotEligibleForExtension
    );

    // 验证额外次数合理（1-3次）
    ensure!(
        additional_revisions > 0 && additional_revisions <= 3,
        Error::<T>::BadInput
    );

    // 转换理由和证据
    let reason_bv = BoundedVec::try_from(reason)
        .map_err(|_| Error::<T>::BadInput)?;

    let evidence_bv = evidence_cids.into_iter()
        .map(|cid| BoundedVec::try_from(cid))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| Error::<T>::BadInput)?;
    let evidence_bv = BoundedVec::try_from(evidence_bv)
        .map_err(|_| Error::<T>::TooManyEvidences)?;

    // 生成提案ID
    let proposal_id = NextProposalId::<T>::get();
    NextProposalId::<T>::put(proposal_id.saturating_add(1));

    // 创建提案
    let proposal = TokenRevisionProposal {
        proposal_id,
        deceased_id,
        applicant: who.clone(),
        additional_revisions,
        reason: reason_bv,
        evidence_cids: evidence_bv,
        status: ProposalStatus::Pending,
        submitted_at: <frame_system::Pallet<T>>::block_number(),
        approve_votes: 0,
        reject_votes: 0,
    };

    // 存储提案
    TokenRevisionProposals::<T>::insert(proposal_id, proposal);

    // 发出事件
    Self::deposit_event(Event::TokenRevisionProposalSubmitted {
        proposal_id,
        deceased_id,
        applicant: who,
        additional_revisions,
    });

    Ok(())
}
```

**预计时间**：20分钟

### Step 5: 实现委员会投票接口

**任务**：委员会成员投票

```rust
/// 函数级中文注释：对Token修改提案投票
///
/// ### 权限
/// - 必须是委员会成员
/// - 每个提案只能投票一次
///
/// ### 参数
/// - proposal_id: 提案ID
/// - approve: 是否批准（true=批准，false=拒绝）
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::vote_token_revision_proposal())]
pub fn vote_token_revision_proposal(
    origin: OriginFor<T>,
    proposal_id: u64,
    approve: bool,
) -> DispatchResult {
    let who = ensure_signed(origin.clone())?;

    // 验证是委员会成员
    T::CommitteeOrigin::ensure_origin(origin)
        .map_err(|_| Error::<T>::NotCommitteeMember)?;

    // 获取提案
    let mut proposal = TokenRevisionProposals::<T>::get(proposal_id)
        .ok_or(Error::<T>::ProposalNotFound)?;

    // 验证提案状态
    ensure!(
        proposal.status == ProposalStatus::Pending,
        Error::<T>::InvalidProposalStatus
    );

    // 检查是否已投票
    ensure!(
        !ProposalVotes::<T>::contains_key(proposal_id, &who),
        Error::<T>::AlreadyVoted
    );

    // 记录投票
    ProposalVotes::<T>::insert(proposal_id, &who, approve);

    // 更新计数
    if approve {
        proposal.approve_votes = proposal.approve_votes.saturating_add(1);
    } else {
        proposal.reject_votes = proposal.reject_votes.saturating_add(1);
    }

    // 发出投票事件
    Self::deposit_event(Event::TokenRevisionProposalVoted {
        proposal_id,
        voter: who,
        approve,
    });

    // 检查是否达到批准阈值
    let threshold = T::ApprovalThreshold::get();
    if proposal.approve_votes >= threshold {
        // 批准
        proposal.status = ProposalStatus::Approved;

        Self::deposit_event(Event::TokenRevisionProposalApproved {
            proposal_id,
            deceased_id: proposal.deceased_id,
            approve_votes: proposal.approve_votes,
            reject_votes: proposal.reject_votes,
        });

        // 自动执行
        Self::execute_token_revision_proposal(&proposal)?;
    } else {
        // 计算总投票数判断是否应该拒绝
        let total_votes = proposal.approve_votes + proposal.reject_votes;
        let committee_size = T::ApprovalThreshold::get() * 2; // 假设阈值是51%

        if total_votes >= committee_size && proposal.approve_votes < threshold {
            // 拒绝
            proposal.status = ProposalStatus::Rejected;

            Self::deposit_event(Event::TokenRevisionProposalRejected {
                proposal_id,
                deceased_id: proposal.deceased_id,
                approve_votes: proposal.approve_votes,
                reject_votes: proposal.reject_votes,
            });
        }
    }

    // 更新提案
    TokenRevisionProposals::<T>::insert(proposal_id, proposal);

    Ok(())
}
```

**预计时间**：25分钟

### Step 6: 实现提案执行辅助函数

**任务**：执行已批准的提案

```rust
/// 函数级中文注释：执行Token修改提案（内部函数）
///
/// ### 功能
/// - 扩展deceased的token_revision_limit
/// - 发出执行事件
/// - 更新提案状态为Executed
fn execute_token_revision_proposal(
    proposal: &TokenRevisionProposal<T>
) -> DispatchResult {
    // 验证提案已批准
    ensure!(
        proposal.status == ProposalStatus::Approved,
        Error::<T>::InvalidProposalStatus
    );

    // 扩展修改次数上限
    DeceasedOf::<T>::try_mutate(proposal.deceased_id, |maybe_d| -> DispatchResult {
        let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;

        let old_limit = d.token_revision_limit;

        // 增加额外次数，但不超过最大值10
        let new_limit = d.token_revision_limit
            .saturating_add(proposal.additional_revisions)
            .min(10);

        d.token_revision_limit = new_limit;

        // 发出执行事件
        Self::deposit_event(Event::TokenRevisionProposalExecuted {
            proposal_id: proposal.proposal_id,
            deceased_id: proposal.deceased_id,
            old_limit,
            new_limit,
        });

        Ok(())
    })?;

    // 更新提案状态
    TokenRevisionProposals::<T>::mutate(proposal.proposal_id, |p| {
        if let Some(proposal) = p {
            proposal.status = ProposalStatus::Executed;
        }
    });

    Ok(())
}
```

**预计时间**：10分钟

### Step 7: 编译验证

```bash
cargo check -p pallet-deceased
cargo test -p pallet-deceased
```

**预计时间**：10分钟

### Step 8: Runtime 配置

在 `runtime/src/lib.rs` 中配置新的类型：

```rust
impl pallet_deceased::Config for Runtime {
    // ... 现有配置

    type CommitteeOrigin = EnsureRoot<AccountId>; // 或使用 pallet_collective
    type ApprovalThreshold = ConstU32<3>; // 5人委员会，3票通过
}
```

**预计时间**：5分钟

---

## 📊 总体进度

| 阶段 | 任务 | 状态 | 预计时间 |
|------|------|------|---------|
| **Phase 1** | 数据结构 | ✅ 完成 | - |
| **Phase 2** | 存储项 | ✅ 完成 | - |
| **Phase 3** | 配置项 | ✅ 完成 | - |
| **Phase 4** | 错误/事件 | ✅ 完成 | - |
| **Phase 5** | create_deceased | ⏳ 待完成 | 5分钟 |
| **Phase 6** | update_deceased | ⏳ 待完成 | 15分钟 |
| **Phase 7** | gov_update_profile | ⏳ 待完成 | 15分钟 |
| **Phase 8** | 提案提交 | ⏳ 待完成 | 20分钟 |
| **Phase 9** | 委员会投票 | ⏳ 待完成 | 25分钟 |
| **Phase 10** | 提案执行 | ⏳ 待完成 | 10分钟 |
| **Phase 11** | 编译验证 | ⏳ 待完成 | 10分钟 |
| **Phase 12** | Runtime配置 | ⏳ 待完成 | 5分钟 |
| **总计** | | **45%** | **剩余2小时** |

---

## 🎯 下一步行动

### 选项 A：继续当前会话
- 优点：上下文连续
- 缺点：token预算有限

### 选项 B：新会话继续
- 优点：完整的token预算
- 缺点：需要重新加载上下文

### 选项 C：手动实施
- 优点：完全掌控
- 缺点：需要手动编写代码

**建议**：使用选项 B（新会话），因为：
1. 剩余工作量较大（约2小时）
2. 需要充足的token预算
3. 已有完整的实施方案文档

---

## 📞 项目信息

**实施状态**：⏳ **45% 完成**
**已完成**：数据结构、存储、配置、错误、事件
**待完成**：extrinsic函数实现、编译验证、Runtime配置

**方案文档**：
- `DECEASED_TOKEN_IMMUTABILITY_PLAN.md` - 设计方案
- `DECEASED_TOKEN_DESIGN_ANALYSIS.md` - 设计分析
- 本文档 - 实施进度

**代码位置**：`pallets/deceased/src/lib.rs`

---

**📅 进度更新日期**：2025-11-18
**执行人**：Claude Code Assistant
**文档版本**：v1.0

---

**🎯 基础架构已就绪，剩余工作为函数实现！**
