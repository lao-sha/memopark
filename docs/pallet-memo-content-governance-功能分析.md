# pallet-memo-content-governance 模块功能分析

## 📋 模块概述

**作用**：第三方申诉 + 押金罚没 + 委员会强制执行（内容域治理）

**核心特性**：
- ✅ 用户提交内容申诉（投诉不当内容）
- ✅ 委员会审批（Root或内容委员会2/3通过）
- ✅ 公示期自动执行
- ✅ 押金罚没机制（防止滥用）
- ✅ 限频控制（防止spam）
- ✅ 失败重试机制
- ✅ 应答自动否决（owner主动响应）

---

## 🏗️ 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户层（任何人）                          │
│  - 提交申诉（submit_appeal）                                 │
│  - 撤回申诉（withdraw_appeal）                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              pallet-memo-content-governance                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  申诉管理                                           │  │
│  │  - Appeals存储（申诉记录）                          │  │
│  │  - 押金冻结/解冻                                    │  │
│  │  - 限频检查（AccountWindows）                       │  │
│  │  - 状态机管理                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  委员会审批                                         │  │
│  │  - approve_appeal（批准）                          │  │
│  │  - reject_appeal（拒绝）                           │  │
│  │  - 公示期设置                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  自动执行引擎                                       │  │
│  │  - on_initialize（每块自动触发）                   │  │
│  │  - QueueByBlock（按块排队）                        │  │
│  │  - 失败重试（RetryCount + NextRetryAt）            │  │
│  │  - 应答自动否决（LastActiveProvider）              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  执行路由（Router trait）                          │  │
│  │  - 根据domain/action路由到目标pallet               │  │
│  │  - 调用gov_*强制接口                               │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  目标Pallet（6个域）                         │
│  - stardust-grave (domain=1)：墓地治理                          │
│  - deceased (domain=2)：逝者治理                            │
│  - deceased-text (domain=3)：文本治理                       │
│  - deceased-media (domain=4)：媒体治理                      │
│  - stardust-park (domain=5)：园区治理                           │
│  - memo-offerings (domain=6)：供奉治理                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 申诉生命周期

### 状态机

```
┌──────────────┐
│   0=提交     │  submit_appeal()
│  (submitted) │  ← 用户提交
└──────┬───────┘
       │
       ├──→ 3=撤回 (withdrawn) ← withdraw_appeal()
       │
       ├──→ 2=驳回 (rejected) ← reject_appeal()
       │
       ▼
┌──────────────┐
│   1=批准     │  approve_appeal()
│  (approved)  │  ← 委员会批准，进入公示期
└──────┬───────┘
       │
       ├──→ 6=自动否决 (auto_dismissed) ← owner应答
       │
       ▼
  【公示期到期】
       │
       ▼
  try_execute()
       │
       ├──→ 4=已执行 (executed) ← 执行成功
       │
       └──→ 5=重试耗尽 (retry_exhausted) ← 达到MaxRetries
```

### 完整流程图

```
用户发现不当内容
    │
    ▼
提交申诉 (submit_appeal)
    │
    ├─ 冻结押金 (Currency::reserve)
    ├─ 限频检查 (AccountWindows)
    ├─ 证据验证 (evidence_cid长度检查)
    └─ 创建申诉记录 (status=0)
    │
    ▼
等待委员会审批
    │
    ├─────────────┬─────────────┐
    │             │             │
    ▼             ▼             ▼
用户撤回      委员会拒绝     委员会批准
(withdraw)    (reject)      (approve)
    │             │             │
    │             │             ├─ 设置execute_at
    │             │             ├─ 写入QueueByBlock
    │             │             ├─ 占位PendingBySubject
    │             │             └─ 初始化重试计数
    │             │             │
    ▼             ▼             ▼
罚没10%      罚没30%        进入公示期
退还90%      退还70%        (NoticeDefaultBlocks)
status=3     status=2            │
    │             │               ▼
    │             │         on_initialize监听
    │             │               │
    │             │               ├─ 检查owner应答?
    │             │               │   └─ Yes → auto_dismiss (status=6)
    │             │               │
    │             │               ▼
    │             │         try_execute(id)
    │             │               │
    │             │               ├─ Router::execute()
    │             │               │
    │             │         ┌─────┴─────┐
    │             │         │           │
    │             │         ▼           ▼
    │             │      成功        失败
    │             │         │           │
    │             │         │           ├─ 未达MaxRetries?
    │             │         │           │   └─ Yes → 重试入队
    │             │         │           │
    │             │         │           └─ No → retry_exhausted
    │             │         │                   (status=5)
    │             │         │
    │             │         ▼
    │             │     status=4
    │             │     退还押金
    │             │     释放占位
    │             │     清理重试
    └─────────────┴─────────────┘
                  │
                  ▼
              申诉完成
```

---

## 💾 数据结构

### 核心存储

#### 1. Appeals - 申诉记录

```rust
pub struct Appeal<AccountId, Balance, BlockNumber> {
    pub who: AccountId,              // 申诉人
    pub domain: u8,                  // 域编码（1-6）
    pub target: u64,                 // 目标ID
    pub action: u8,                  // 动作编码
    pub reason_cid: Vec<u8>,         // 理由CID（IPFS）
    pub evidence_cid: Vec<u8>,       // 证据CID（IPFS）
    pub deposit: Balance,            // 押金金额
    pub status: u8,                  // 状态（0-6）
    pub execute_at: Option<BlockNumber>,    // 执行块高
    pub approved_at: Option<BlockNumber>,   // 批准块高
    pub new_owner: Option<AccountId>,       // 新owner（仅domain=2,action=4）
}

// 存储映射
Appeals: AppealId -> Appeal
NextId: u64  // 自增ID
```

**状态码说明**：
- `0 = submitted`：已提交，等待审批
- `1 = approved`：已批准，进入公示期
- `2 = rejected`：已拒绝
- `3 = withdrawn`：已撤回
- `4 = executed`：已执行成功
- `5 = retry_exhausted`：重试耗尽
- `6 = auto_dismissed`：自动否决（owner应答）

#### 2. AccountWindows - 限频窗口

```rust
pub struct WindowInfo<BlockNumber> {
    pub window_start: BlockNumber,   // 窗口起始块
    pub count: u32,                  // 窗口内已提交次数
}

AccountWindows: AccountId -> WindowInfo
```

**限频机制**：
- 滑动窗口：`WindowBlocks`（如7天=100,800块）
- 窗口内最大次数：`MaxPerWindow`（如10次）
- 防止spam攻击

#### 3. QueueByBlock - 执行队列

```rust
QueueByBlock: BlockNumber -> BoundedVec<AppealId, MaxExecPerBlock>
```

**执行机制**：
- 按块维度组织待执行申诉
- `on_initialize(n)` 仅处理当前块的队列
- 每块最多执行 `MaxExecPerBlock` 条（DoS防护）
- 处理后清空队列

#### 4. PendingBySubject - 并发控制

```rust
PendingBySubject: (domain, target) -> AppealId
```

**串行化保证**：
- 同一主体同时只能有一个"已批准"申诉
- 防止竞态条件
- 批准时检查占位，存在则返回 `AlreadyPending`

#### 5. RetryCount & NextRetryAt - 重试管理

```rust
RetryCount: AppealId -> u8              // 已重试次数
NextRetryAt: AppealId -> BlockNumber    // 下次重试块高
```

**重试机制**：
- 最大重试次数：`MaxRetries`（如3次）
- 退避策略：第k次延迟 = `RetryBackoffBlocks × k`
- 达到上限后标记 `retry_exhausted`

---

## 🎯 功能模块详解

### 1. 提交申诉（submit_appeal）

**接口**：
```rust
pub fn submit_appeal(
    origin: OriginFor<T>,
    domain: u8,             // 域编码
    target: u64,            // 目标ID
    action: u8,             // 动作编码
    reason_cid: Vec<u8>,    // 理由CID（可选）
    evidence_cid: Vec<u8>,  // 证据CID（必填）
) -> DispatchResult
```

**执行流程**：
```
1. 签名验证 (ensure_signed)
    ↓
2. 限频检查 (touch_window)
    - 滑动窗口检查
    - 计数+1
    ↓
3. 证据验证
    - evidence_cid 非空
    - 长度 ≥ MinEvidenceCidLen
    - reason_cid（若有）长度 ≥ MinReasonCidLen
    ↓
4. 计算押金
    - 优先：AppealDepositPolicy::calc_deposit()（动态）
    - 回退：AppealDeposit（固定）
    ↓
5. 冻结押金 (Currency::reserve)
    ↓
6. 创建申诉记录
    - 分配ID (NextId++)
    - status = 0 (submitted)
    - 存入 Appeals
    ↓
7. 发出事件
    AppealSubmitted(id, who, domain, target, deposit)
```

**防护机制**：
- ✅ 限频防spam
- ✅ 证据必填
- ✅ 押金防滥用
- ✅ 长度校验

**使用示例**：
```typescript
// 申诉逝者主图不当
await api.tx.memoContentGovernance.submitAppeal(
  2,        // domain: deceased
  123,      // target: deceased_id
  2,        // action: gov_set_main_image(None)
  reasonCid,
  evidenceCid
).signAndSend(user);
```

---

### 2. 委员会审批（approve_appeal / reject_appeal）

#### 批准申诉

**接口**：
```rust
pub fn approve_appeal(
    origin: OriginFor<T>,
    id: u64,
    notice_blocks: Option<BlockNumber>,  // 公示期（可选）
) -> DispatchResult
```

**权限**：Root 或 内容委员会2/3

**执行流程**：
```
1. 治理权限验证 (GovernanceOrigin)
    ↓
2. 获取申诉记录
    - 检查status=0 (submitted)
    ↓
3. 并发检查
    - 检查 PendingBySubject[(domain,target)]
    - 若已存在 → 返回 AlreadyPending
    ↓
4. 更新状态
    - status = 1 (approved)
    - execute_at = now + notice_blocks
    - approved_at = now
    ↓
5. 入队执行
    - QueueByBlock[execute_at].push(id)
    - 队列满 → 返回 QueueFull
    ↓
6. 占位与初始化
    - PendingBySubject[(domain,target)] = id
    - RetryCount[id] = 0
    ↓
7. 发出事件
    AppealApproved(id, execute_at)
```

**并发控制**：
- ✅ 同一主体同时只能有一个"已批准"申诉
- ✅ 防止竞态条件
- ✅ 保证状态一致性

#### 拒绝申诉

**接口**：
```rust
pub fn reject_appeal(
    origin: OriginFor<T>,
    id: u64,
) -> DispatchResult
```

**执行流程**：
```
1. 治理权限验证
    ↓
2. 获取申诉记录 (status=0)
    ↓
3. 更新状态 (status=2)
    ↓
4. 处理押金
    - 解冻 (Currency::unreserve)
    - 计算罚没 (RejectedSlashBps)
    - 转账到国库 (TreasuryAccount)
    ↓
5. 清理占位（若有）
    - PendingBySubject.remove()
    - RetryCount.remove()
    - NextRetryAt.remove()
    ↓
6. 发出事件
    AppealRejected(id, slash_bps, slashed)
```

**罚没比例**：
- 默认：`RejectedSlashBps = 3000`（30%）
- 建议改为：`1000`（10%）

---

### 3. 撤回申诉（withdraw_appeal）

**接口**：
```rust
pub fn withdraw_appeal(
    origin: OriginFor<T>,
    id: u64,
) -> DispatchResult
```

**权限**：仅申诉人本人

**执行流程**：
```
1. 签名验证
    ↓
2. 权限检查 (a.who == who)
    ↓
3. 状态检查 (status=0)
    ↓
4. 更新状态 (status=3)
    ↓
5. 处理押金
    - 解冻
    - 计算罚没 (WithdrawSlashBps)
    - 转账到国库
    ↓
6. 清理占位
    ↓
7. 发出事件
    AppealWithdrawn(id, slash_bps, slashed)
```

**使用场景**：
- 用户发现提交错误
- 双方线下达成和解
- 不想继续申诉

---

### 4. 自动执行（on_initialize）

**核心逻辑**：
```rust
fn on_initialize(n: BlockNumber) -> Weight {
    // 1. 获取本块待执行队列
    if let Some(queue) = QueueByBlock[n] {
        let mut handled = 0;
        
        // 2. 逐个执行
        while let Some(id) = queue.pop() {
            let _ = Self::try_execute(id);
            handled += 1;
            
            // 3. 限额保护
            if handled >= MaxExecPerBlock {
                break;
            }
        }
        
        // 4. 清空队列
        QueueByBlock.remove(n);
    }
    
    // 5. 返回权重
    WeightInfo::on_initialize(handled)
}
```

**try_execute 执行流程**：

```
获取申诉记录 (status=1)
    ↓
检查：应答自动否决
    - 仅domain=2 (deceased)
    - LastActiveProvider::last_active_of()
    - 若 approved_at < last_active <= execute_at
    - 则：status=6, 退押金, 释放占位
    ↓
调用 Router::execute(domain, target, action)
    │
    ├─ 成功 ─→ status=4
    │         退押金
    │         释放占位
    │         清理重试
    │         Event: AppealExecuted
    │
    └─ 失败 ─→ Event: AppealExecuteFailed(code)
              │
              ├─ 未达MaxRetries?
              │   └─ Yes → 计算下次重试块高
              │           入队 QueueByBlock
              │           RetryCount++
              │           Event: AppealRetryScheduled
              │
              └─ No → status=5
                      退押金
                      释放占位
                      清理重试
                      Event: AppealRetryExhausted
```

**DoS防护**：
- ✅ 每块最多执行 `MaxExecPerBlock` 条
- ✅ 按块队列，不会累积
- ✅ 权重计算合理

---

### 5. 应答自动否决（Auto Dismiss）

**设计目的**：
- 给owner主动响应的机会
- 在公示期内，若owner主动修正问题，则自动否决申诉

**触发条件**：
1. 申诉处于"已批准"状态（status=1）
2. 仅对 `domain=2` (deceased) 生效
3. `LastActiveProvider::last_active_of(2, deceased_id)` 返回活跃块高
4. 满足：`approved_at < last_active <= execute_at`

**执行逻辑**：
```rust
// 在 try_execute 开始前检查
if domain == 2 {
    if let Some(last_active) = LastActiveProvider::last_active_of(2, target) {
        if last_active > approved_at && last_active <= execute_at {
            // owner在公示期内有活跃操作，视为应答
            status = 6 (auto_dismissed)
            Currency::unreserve(&who, deposit)  // 退还押金
            PendingBySubject::remove()
            RetryCount::remove()
            NextRetryAt::remove()
            Event: AppealAutoDismissed(id)
            return Ok(())
        }
    }
}
```

**示例场景**：
```
1. 用户A申诉：逝者B的主图不当
    ↓
2. 委员会批准，进入3天公示期
    ↓
3. 逝者owner在公示期内主动修改主图
    ↓
4. 系统检测到owner活跃操作
    ↓
5. 自动否决申诉，退还押金
    ↓
6. 避免不必要的强制执行
```

---

### 6. 失败重试机制

**重试策略**：

| 重试次数 | 延迟时间 | 说明 |
|---------|---------|------|
| 1 | RetryBackoffBlocks × 1 | 首次重试 |
| 2 | RetryBackoffBlocks × 2 | 第二次重试 |
| 3 | RetryBackoffBlocks × 3 | 第三次重试 |
| MaxRetries | - | 达到上限，放弃 |

**示例**（RetryBackoffBlocks=100）：

```
执行失败（块高 1000）
    ↓
重试1：块高 1100 (+100)
    ↓ 失败
重试2：块高 1300 (+200)
    ↓ 失败
重试3：块高 1600 (+300)
    ↓ 失败
放弃：status=5 (retry_exhausted)
      退还押金
```

**为什么需要重试**：
- 执行失败可能是临时性的（如余额不足）
- 给系统自愈的机会
- 避免因暂时性错误导致押金损失

---

### 7. 执行路由（Router）

**Trait定义**：
```rust
pub trait AppealRouter<AccountId> {
    fn execute(
        who: &AccountId,
        domain: u8,
        target: u64,
        action: u8
    ) -> DispatchResult;
}
```

**Runtime实现**（伪代码）：
```rust
impl AppealRouter<AccountId> for Router {
    fn execute(who, domain, target, action) -> DispatchResult {
        match (domain, action) {
            // 墓地域
            (1, 10) => MemoGrave::clear_cover_via_governance(target, evidence),
            (1, 11) => MemoGrave::gov_transfer_grave(target, new_owner, evidence),
            (1, 12) => MemoGrave::gov_set_restricted(target, true, code, evidence),
            (1, 13) => MemoGrave::gov_remove_grave(target, code, evidence),
            (1, 14) => MemoGrave::gov_restore_grave(target, evidence),
            
            // 逝者域
            (2, 1) => Deceased::gov_set_visibility(target, true, evidence),
            (2, 2) => Deceased::gov_set_main_image(target, None, evidence),
            (2, 3) => Deceased::gov_set_main_image(target, Some(default_cid), evidence),
            (2, 4) => Deceased::gov_transfer_owner(target, new_owner, evidence),
            
            // 文本域
            (3, 20) => DeceasedText::gov_remove_eulogy(target, evidence),
            (3, 21) => DeceasedText::gov_remove_text(target, evidence),
            (3, 22) => DeceasedText::gov_edit_text(target, cid, evidence),
            (3, 23) => DeceasedText::gov_set_life(target, cid, evidence),
            
            // 媒体域
            (4, 30) => DeceasedMedia::gov_set_media_hidden(target, true, evidence),
            (4, 31) => DeceasedMedia::gov_replace_media_uri(target, new_uri, evidence),
            (4, 32) => DeceasedMedia::gov_freeze_video_collection(target, true, evidence),
            
            // 园区域
            (5, 40) => StarDust::gov_transfer_park(target, new_owner, evidence),
            (5, 41) => StarDust::gov_set_park_cover(target, cid, evidence),
            
            // 供奉域
            (6, 50) => MemoOfferings::gov_set_pause_domain(target_domain, true, evidence),
            (6, 51) => MemoOfferings::gov_set_offering_enabled(target, enabled, evidence),
            
            _ => Err(DispatchError::BadOrigin),
        }
    }
}
```

**路由码表**：见README第75-100行

---

## 🔒 安全机制

### 1. 权限控制

| 操作 | 权限要求 | 说明 |
|-----|---------|------|
| `submit_appeal` | 任何签名账户 | 用户提交 |
| `withdraw_appeal` | 申诉人本人 | 仅申诉人可撤回 |
| `approve_appeal` | Root \| 内容委员会2/3 | 治理决策 |
| `reject_appeal` | Root \| 内容委员会2/3 | 治理决策 |
| `purge_appeals` | Root \| 内容委员会2/3 | 清理历史 |

### 2. 限频保护

```rust
// 滑动窗口
WindowBlocks = 100,800块（约7天）
MaxPerWindow = 10次

// 检查逻辑
if now - window_start >= WindowBlocks {
    // 新窗口
    window_start = now
    count = 0
}
ensure!(count < MaxPerWindow, RateLimited)
count += 1
```

**防止spam攻击**

### 3. 押金机制

| 场景 | 押金处理 | 说明 |
|-----|---------|------|
| **提交** | 冻结押金 | 防止滥用 |
| **批准+执行成功** | 全额退还 | 鼓励合理申诉 |
| **拒绝** | 罚没30%，退还70% | 惩罚无效申诉 |
| **撤回** | 罚没30%，退还70% | 防止随意撤回 |
| **重试耗尽** | 全额退还 | 不怪罪申诉人 |
| **自动否决** | 全额退还 | owner主动响应 |

### 4. 并发控制

```rust
// 同一主体同时只能有一个"已批准"申诉
PendingBySubject: (domain, target) -> AppealId

// 批准时检查
ensure!(
    PendingBySubject::get((domain, target)).is_none(),
    AlreadyPending
)
```

**防止竞态条件**

### 5. DoS防护

```rust
// 每块最多执行条数
MaxExecPerBlock = 10

// on_initialize
let mut handled = 0;
while let Some(id) = queue.pop() {
    if handled >= MaxExecPerBlock {
        break;
    }
    try_execute(id);
    handled += 1;
}
```

**防止单块执行过多申诉导致阻塞**

### 6. 证据要求

```rust
// 证据必填
ensure!(!evidence_cid.is_empty(), EvidenceRequired)

// 最小长度
ensure!(
    evidence_cid.len() >= MinEvidenceCidLen,
    EvidenceTooShort
)

// 理由（可选）最小长度
if !reason_cid.is_empty() {
    ensure!(
        reason_cid.len() >= MinReasonCidLen,
        ReasonTooShort
    )
}
```

**防止空证据或无效证据**

---

## 📊 只读接口

### 1. 获取申诉详情

```rust
pub fn appeal_of(id: u64) -> Option<Appeal>
```

**用途**：前端/索引查询申诉明细

### 2. 按账户过滤

```rust
pub fn list_by_account(
    who: &AccountId,
    status: Option<u8>,
    start_id: u64,
    limit: u32
) -> Vec<u64>
```

**用途**：查询某账户的申诉列表

**示例**：
```typescript
// 查询user的所有已批准申诉
const appeals = await api.query.memoContentGovernance
  .listByAccount(user, 1, 0, 100);
```

### 3. 按状态范围过滤

```rust
pub fn list_by_status_range(
    status_min: u8,
    status_max: u8,
    start_id: u64,
    limit: u32
) -> Vec<u64>
```

**用途**：查询特定状态范围的申诉

**示例**：
```typescript
// 查询所有待审批申诉（status=0）
const pending = await api.query.memoContentGovernance
  .listByStatusRange(0, 0, 0, 100);
```

### 4. 按到期区间过滤

```rust
pub fn list_due_between(
    from: BlockNumber,
    to: BlockNumber,
    start_id: u64,
    limit: u32
) -> Vec<u64>
```

**用途**：查询即将到期的申诉

### 5. 队列查询

```rust
pub fn queue_len_at(block: BlockNumber) -> u32
pub fn due_at(block: BlockNumber) -> Vec<u64>
```

**用途**：监控执行队列状态

---

## 🎭 事件列表

### 申诉提交/撤回/审批

| 事件 | 参数 | 说明 |
|-----|------|------|
| `AppealSubmitted` | `(id, who, domain, target, deposit)` | 申诉已提交 |
| `AppealWithdrawn` | `(id, slash_bps, slashed)` | 申诉已撤回 |
| `AppealApproved` | `(id, execute_at)` | 申诉已批准 |
| `AppealRejected` | `(id, slash_bps, slashed)` | 申诉已拒绝 |

### 执行相关

| 事件 | 参数 | 说明 |
|-----|------|------|
| `AppealExecuted` | `(id)` | 申诉已执行成功 |
| `AppealExecuteFailed` | `(id, error_code)` | 申诉执行失败 |
| `AppealRetryScheduled` | `(id, attempt, at_block)` | 已安排重试 |
| `AppealRetryExhausted` | `(id, attempts)` | 重试已耗尽 |
| `AppealAutoDismissed` | `(id)` | 自动否决（owner应答） |

### 管理相关

| 事件 | 参数 | 说明 |
|-----|------|------|
| `AppealsPurged` | `(start_id, end_id, removed)` | 已清理历史申诉 |

---

## ⚙️ 配置参数

### Runtime配置示例

```rust
impl pallet_memo_content_governance::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    
    // 押金配置
    type AppealDeposit = ConstU128<{ 100 * UNIT }>;  // 固定100 DUST
    type AppealDepositPolicy = DynamicDepositPolicy; // 或动态策略
    
    // 罚没比例（建议调整）
    type RejectedSlashBps = ConstU16<3000>;  // 30% → 建议改为1000（10%）
    type WithdrawSlashBps = ConstU16<3000>;  // 30% → 建议改为1000（10%）
    
    // 限频配置
    type WindowBlocks = ConstU32<100_800>;   // 7天
    type MaxPerWindow = ConstU32<10>;        // 10次/7天
    
    // 公示期
    type NoticeDefaultBlocks = ConstU32<43_200>;  // 3天
    
    // 执行配置
    type MaxExecPerBlock = ConstU32<10>;     // 每块最多10条
    type MaxRetries = ConstU8<3>;            // 最多重试3次
    type RetryBackoffBlocks = ConstU32<100>; // 退避100块
    
    // 证据长度
    type MinEvidenceCidLen = ConstU32<46>;   // IPFS CID最小长度
    type MinReasonCidLen = ConstU32<46>;
    
    // 其他
    type TreasuryAccount = TreasuryAccount;
    type Router = AppealRouter;
    type GovernanceOrigin = EitherOfDiverse<
        EnsureRoot<AccountId>,
        ContentCommitteeAtLeast2of3
    >;
    type LastActiveProvider = DeceasedLastActiveProvider;
    type WeightInfo = ();
    type MaxListLen = ConstU32<1000>;
}
```

---

## 🚀 使用示例

### 前端集成

#### 1. 提交申诉

```typescript
import { ApiPromise } from '@polkadot/api';

// 申诉逝者主图不当
async function submitAppeal(
  api: ApiPromise,
  signer: KeyringPair,
  deceasedId: number,
  evidenceCid: string,
  reasonCid: string
) {
  const tx = api.tx.memoContentGovernance.submitAppeal(
    2,          // domain: deceased
    deceasedId, // target
    2,          // action: gov_set_main_image(None) - 清空主图
    reasonCid,
    evidenceCid
  );
  
  // 获取押金金额
  const deposit = await api.consts.memoContentGovernance.appealDeposit;
  
  // 确认对话框
  const confirmed = await confirm(
    `确认提交申诉？\n` +
    `押金：${deposit.toHuman()}\n` +
    `- 批准：全额退还\n` +
    `- 拒绝：罚没30%\n` +
    `- 撤回：罚没30%`
  );
  
  if (!confirmed) return;
  
  // 提交
  const unsub = await tx.signAndSend(signer, ({ status, events }) => {
    if (status.isInBlock) {
      // 查找事件
      events.forEach(({ event }) => {
        if (event.section === 'memoContentGovernance') {
          if (event.method === 'AppealSubmitted') {
            const [id, who, domain, target, deposit] = event.data;
            console.log(`申诉已提交：ID=${id}`);
            // 跳转到申诉详情页
            router.push(`/appeals/${id}`);
          }
        }
      });
      unsub();
    }
  });
}
```

#### 2. 委员会审批

```typescript
// 批准申诉
async function approveAppeal(
  api: ApiPromise,
  committeeSigner: KeyringPair,
  appealId: number,
  noticeBlocks?: number
) {
  const tx = api.tx.memoContentGovernance.approveAppeal(
    appealId,
    noticeBlocks || null  // 使用默认公示期
  );
  
  await tx.signAndSend(committeeSigner, ({ status }) => {
    if (status.isInBlock) {
      message.success(`申诉 #${appealId} 已批准，进入公示期`);
    }
  });
}

// 拒绝申诉
async function rejectAppeal(
  api: ApiPromise,
  committeeSigner: KeyringPair,
  appealId: number
) {
  const tx = api.tx.memoContentGovernance.rejectAppeal(appealId);
  
  await tx.signAndSend(committeeSigner, ({ status }) => {
    if (status.isInBlock) {
      message.info(`申诉 #${appealId} 已拒绝`);
    }
  });
}
```

#### 3. 查询申诉列表

```typescript
// 查询我的申诉
async function queryMyAppeals(
  api: ApiPromise,
  account: string
) {
  const appealIds = await api.query.memoContentGovernance
    .listByAccount(account, null, 0, 100);
  
  const appeals = await Promise.all(
    appealIds.map(id => 
      api.query.memoContentGovernance.appealOf(id)
    )
  );
  
  return appeals.map((appeal, i) => ({
    id: appealIds[i],
    ...appeal.toJSON()
  }));
}

// 查询待审批申诉（委员会页面）
async function queryPendingAppeals(api: ApiPromise) {
  const appealIds = await api.query.memoContentGovernance
    .listByStatusRange(0, 0, 0, 100);  // status=0 (submitted)
  
  // ... 同上
}
```

#### 4. 监听事件

```typescript
// 订阅申诉事件
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (event.section === 'memoContentGovernance') {
      switch (event.method) {
        case 'AppealSubmitted':
          const [id, who, domain, target, deposit] = event.data;
          notification.info({
            message: '新申诉提交',
            description: `ID: ${id}, 域: ${domain}, 目标: ${target}`
          });
          break;
          
        case 'AppealApproved':
          const [id, executeAt] = event.data;
          notification.success({
            message: '申诉已批准',
            description: `ID: ${id}, 执行块高: ${executeAt}`
          });
          break;
          
        case 'AppealExecuted':
          notification.success({
            message: '申诉已执行',
            description: `ID: ${event.data[0]}`
          });
          break;
          
        case 'AppealAutoDismissed':
          notification.info({
            message: '申诉自动否决',
            description: `owner已主动响应，ID: ${event.data[0]}`
          });
          break;
      }
    }
  });
});
```

---

## 📈 优化建议

### 1. 押金策略优化

**当前问题**：
- 固定押金（100 DUST），价值波动大
- 不同域/动作的风险不同，应差异化

**建议方案**：
- ✅ 实施动态押金（详见"申诉押金改进需求-可行性分析.md"）
- ✅ 押金=10美元等值MEMO（根据pallet-pricing）
- ✅ 罚没比例从30%降到10%

### 2. 公示期优化

**当前问题**：
- 固定3天公示期，可能过长或过短

**建议方案**：
- 低风险操作：1天
- 中风险操作：3天（默认）
- 高风险操作：7天
- 按domain/action差异化配置

### 3. 重试策略优化

**当前问题**：
- 固定退避策略，可能不够灵活

**建议方案**：
- 指数退避：delay = base × 2^(attempt-1)
- 首次快速重试，后续逐步延长
- 不同错误类型差异化处理

### 4. 批量操作

**新增需求**：
- `batch_approve_appeals(ids[])`：批量批准
- `batch_reject_appeals(ids[])`：批量拒绝
- 提高委员会效率

---

## 🐛 已知限制

### 1. 存储成本

**问题**：
- 所有申诉永久存储
- 随时间增长，存储膨胀

**缓解**：
- ✅ 已实现 `purge_appeals` 清理历史
- 建议定期清理已完成申诉

### 2. 只读查询性能

**问题**：
- `list_by_account` 等接口遍历全部申诉
- 数据量大时性能差

**缓解**：
- 前端/Subsquid建立索引
- 链上仅保留核心存储

### 3. 路由耦合

**问题**：
- Router需要在runtime实现
- 新增domain/action需要修改runtime

**缓解**：
- 保持低耦合设计
- 路由逻辑清晰分层

---

## ✅ 总结

### 核心价值

1. **去中心化治理**
   - 用户可提交申诉
   - 委员会民主决策
   - 公示期透明公开

2. **经济激励**
   - 押金防止滥用
   - 罚没惩罚恶意
   - 退款鼓励合理申诉

3. **自动化执行**
   - 公示期到期自动执行
   - 失败自动重试
   - owner应答自动否决

4. **安全保障**
   - 限频防spam
   - 并发控制防竞态
   - DoS防护

### 模块特色

| 特性 | 说明 | 优势 |
|-----|------|------|
| **双轨制审批** | 用户提交+委员会审批 | 平衡效率与公正 |
| **公示期机制** | 批准后进入公示期 | 给各方反应时间 |
| **自动执行** | on_initialize自动触发 | 无需手动干预 |
| **失败重试** | 最多3次自动重试 | 提高成功率 |
| **应答否决** | owner主动响应可自动否决 | 鼓励主动解决 |
| **并发控制** | 同主体串行化 | 防止竞态条件 |
| **动态押金** | 支持按域/动作差异化 | 灵活可扩展 |

### 适用场景

✅ **内容审核**：不当内容申诉
✅ **权利保护**：侵权/盗用申诉
✅ **争议仲裁**：用户间纠纷
✅ **失钥救济**：owner私钥丢失
✅ **合规管理**：违规内容处理

---

## 📚 相关文档

- [pallet-memo-content-governance README](../pallets/memo-content-governance/README.md)
- [申诉押金改进需求-可行性分析](./申诉押金改进需求-可行性分析.md)
- [通过投诉可更改字段分析报告](./通过投诉可更改字段分析报告.md)
- [治理路由码表](../pallets/memo-content-governance/README.md#路由码表)

---

*功能分析文档 | 生成时间：2025-10-25*
*模块版本：v1.0*
*作者：MemoMart Development Team*

