# OTC交易系统快速参考指南

## 核心执行流程

### 1. 标准订单流程
```
买家创建订单 → 支付确认 → 做市商释放 → 订单完成
  create_order()  mark_paid()  release_dust()  [信用+2]
       ↓
    状态流转:
    Created → PaidOrCommitted → Released
```

### 2. 争议流程
```
提交证据 → 发起仲裁 → 治理裁决 → 资金分配
commit()  dispute_with_evidence_id()  arbitrate()
                          ↓
              Decision::Release (胜诉)
              Decision::Refund (败诉)
              Decision::Partial (部分)
```

### 3. 信用变化
```
订单完成      → +2分
超时未支付    → -10分  
争议败诉      → -20分
```

---

## 关键数据结构速查

### OrderState (订单状态)
| 代码 | 状态 | 说明 |
|------|------|------|
| 0 | Created | 等待付款 (1小时超时) |
| 1 | PaidOrCommitted | 买家已付款 |
| 2 | Released | DUST已释放 |
| 3 | Refunded | 已退款 |
| 4 | Canceled | 已取消 |
| 5 | Disputed | 争议中 |
| 6 | Closed | 已关闭 |
| 7 | Expired | 已过期 |

### CreditLevel (信用等级)
| 等级 | 分数 | 保证金折扣 |
|------|------|----------|
| Diamond | 950-1000 | 50% |
| Platinum | 900-949 | 30% |
| Gold | 850-899 | 20% |
| Silver | 820-849 | 10% |
| Bronze | 800-819 | 0% |

### ServiceStatus (服务状态)
| 状态 | 分数范围 | 说明 |
|------|---------|------|
| Active | ≥800 | 正常服务 |
| Warning | 750-799 | 警告状态 |
| Suspended | <750 | 服务暂停 |

---

## 关键函数签名

### OTC Order Pallet

```rust
// 标准订单
create_order(
    maker_id: u64,
    dust_amount: Balance,
    payment_commit: H256,
    contact_commit: H256,
) -> Result<u64, Error>

mark_paid(order_id: u64, tron_tx_hash: Option<[u8; 32]>) -> Result

release_dust(order_id: u64) -> Result

dispute_order(order_id: u64) -> Result

cancel_order(order_id: u64) -> Result

// 首购订单
create_first_purchase(
    maker_id: u64,
    payment_commit: H256,
    contact_commit: H256,
) -> Result<u64, Error>

// 仲裁裁决接收
apply_arbitration_decision(
    order_id: u64,
    decision: Decision
) -> Result

// 权限检查
can_dispute_order(who: &AccountId, order_id: u64) -> bool
```

### Arbitration Pallet

```rust
// 发起争议
dispute(
    domain: [u8; 8],
    id: u64,
    evidence: Vec<CID>,
) -> Result

dispute_with_evidence_id(
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> Result

// 追加证据
append_evidence_id(
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> Result

// 执行裁决 (治理权限)
arbitrate(
    domain: [u8; 8],
    id: u64,
    decision_code: u8,      // 0=Release, 1=Refund, 2=Partial
    bps: Option<u16>,       // 仅Partial使用
) -> Result

// 双向押金争议
dispute_with_two_way_deposit(
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> Result

// 应诉方应诉
respond_to_dispute(
    domain: [u8; 8],
    id: u64,
    counter_evidence_id: u64,
) -> Result
```

### Evidence Pallet

```rust
// 提交公开证据
commit(
    domain: u8,
    target_id: u64,
    imgs: Vec<CID>,
    vids: Vec<CID>,
    docs: Vec<CID>,
    memo: Option<String>,
) -> Result<u64, Error>  // 返回Evidence ID

// 提交承诺哈希
commit_hash(
    ns: [u8; 8],
    subject_id: u64,
    commit: H256,
    memo: Option<String>,
) -> Result<u64, Error>

// 链接已存在的证据
link(domain: u8, target_id: u64, id: u64) -> Result

// 按命名空间链接
link_by_ns(
    ns: [u8; 8],
    subject_id: u64,
    id: u64,
) -> Result
```

### Credit Pallet

```rust
// 记录订单完成
record_maker_order_completed(
    maker_id: u64,
    order_id: u64,
    response_time_seconds: u32,
) -> Result

// 记录订单超时
record_maker_order_timeout(
    maker_id: u64,
    order_id: u64,
) -> Result

// 记录争议结果
record_maker_dispute_result(
    maker_id: u64,
    order_id: u64,
    maker_win: bool,
) -> Result
```

---

## 域标识 (Namespace)

| 域名 | 8字节常量 | 用途 |
|------|----------|------|
| OTC订单 | `b"otc_ordr"` | OTC交易订单 |
| SimpleBridge | `b"bridg_sw"` | 简单桥接兑换 |
| KYC | `b"kyc_____"` | 身份验证证据 |

---

## 存储结构速查

### OTC Order Storage
- `Orders[u64]` → 订单详情
- `BuyerOrders[AccountId]` → 买家订单列表
- `MakerOrders[u64]` → 做市商订单列表
- `HasFirstPurchased[AccountId]` → 首购标记
- `MakerFirstPurchaseCount[u64]` → 首购计数

### Arbitration Storage
- `Disputed[(domain, id)]` → 争议登记
- `EvidenceIds[(domain, id)]` → 证据ID列表
- `TwoWayDeposits[(domain, id)]` → 双向押金记录

### Evidence Storage
- `Evidences[u64]` → 证据记录
- `EvidenceByTarget[(domain, target_id), id]` → 目标证据索引
- `EvidenceByNs[(ns, subject_id), id]` → 命名空间证据索引

### Credit Storage
- `MakerCredits[u64]` → 做市商信用记录
- `MakerRatings[(maker_id, order_id)]` → 买家评分

---

## 常见错误处理

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `OrderNotFound` | 订单ID不存在 | 检查订单ID是否正确 |
| `InvalidOrderStatus` | 订单状态不匹配 | 确认订单处于正确状态 |
| `NotAuthorized` | 权限不足 | 验证调用者身份 |
| `MakerNotActive` | 做市商已禁用 | 联系做市商恢复 |
| `AlreadyDisputed` | 争议已登记 | 不能重复发起争议 |
| `RateLimited` | 限频触发 | 等待窗口期过期后重试 |
| `TooManyForSubject` | 超过配额 | 等待或选择其他目标 |

---

## 参数配置值

### OrderTimeout (订单超时)
```
值: 3_600_000 (毫秒)
说明: 1小时
场景: 买家未支付时自动取消
```

### EvidenceWindow (证据窗口)
```
值: 86_400_000 (毫秒)
说明: 24小时
场景: 争议后必须在此窗口内提交证据
```

### FirstPurchaseUsdValue (首购固定价值)
```
值: 10_000_000 (10 USD, 精度10^6)
说明: 固定美元价值
场景: 首购订单金额固定
```

### FirstPurchaseRange (首购DUST范围)
```
最小: 1_000_000_000_000 (1 DUST)
最大: 1_000_000_000_000_000 (1000 DUST)
场景: 防止异常汇率导致滑点
```

### MaxFirstPurchaseOrdersPerMaker
```
值: 5 (个)
说明: 每个做市商同时接收的首购订单上限
场景: 防止做市商被首购订单冲击
```

### 信用分配置
```
初始分数:        820分
完成奖励:        +2分
超时惩罚:        -10分
败诉惩罚:        -20分
警告阈值:        800分
暂停阈值:        750分
```

### 双向押金配置
```
押金比例:        15% (DepositRatioBps = 1500)
应诉期限:        7天
罚没比例(Release): 30% (发起方)
罚没比例(Refund): 30% (应诉方)
罚没比例(Partial): 50% (双方)
```

---

## 实战操作流程

### 创建并完成订单

```
步骤1: 买家发起
  api.tx.otcOrder.createOrder(
    makerId = 1,
    dustAmount = 100,
    paymentCommit = hash(payment_proof),
    contactCommit = hash(contact_info)
  )
  → 返回 OrderId #123

步骤2: 买家支付
  api.tx.otcOrder.markPaid(
    orderId = 123,
    tronTxHash = [TRON交易哈希]  // 可选
  )

步骤3: 做市商释放
  api.tx.otcOrder.releaseDust(
    orderId = 123
  )
  → 订单完成，做市商信用+2

步骤4: 买家收到DUST
  api.query.balances.account(buyerAccount)
  → DUST已增加
```

### 发起争议并仲裁

```
步骤1: 提交证据
  api.tx.evidence.commit(
    domain = 2,           // Deceased
    targetId = 123,
    imgs = ['QmImage1', 'QmImage2'],
    vids = [],
    docs = [],
    memo = null
  )
  → 返回 EvidenceId #456

步骤2: 发起争议
  api.tx.arbitration.disputeWithEvidenceId(
    domain = b"otc_ordr",
    id = 123,
    evidenceId = 456
  )
  → 订单状态→Disputed

步骤3: 做市商应诉并提交反驳证据
  api.tx.evidence.commit(
    domain = 2,
    targetId = 123,
    imgs = ['QmProof1'],
    vids = [],
    docs = [],
    memo = null
  )
  → 返回 EvidenceId #789
  
  api.tx.arbitration.appendEvidenceId(
    domain = b"otc_ordr",
    id = 123,
    evidenceId = 789
  )

步骤4: 治理委员会裁决
  api.tx.arbitration.arbitrate(
    domain = b"otc_ordr",
    id = 123,
    decisionCode = 0,     // 0=Release, 1=Refund, 2=Partial
    bps = null
  )
  
  若选择Release:
    → DUST给做市商
    → 做市商信用不变
  
  若选择Refund:
    → DUST给买家
    → 做市商信用-20
```

### 首购订单

```
步骤1: 检查是否首购
  api.query.otcOrder.hasFirstPurchased(buyerAccount)
  → false (未首购)

步骤2: 创建首购订单
  api.tx.otcOrder.createFirstPurchase(
    makerId = 1,
    paymentCommit = hash(...),
    contactCommit = hash(...)
  )
  → OrderId #124, is_first_purchase=true
  → 金额固定为10 USD
  → DUST数量自动计算

步骤3: 完成首购
  [同步骤2-3: markPaid + releaseDust]
  → HasFirstPurchased[buyer] = true (永久标记)
  → 买家无法再次首购

步骤4: 验证
  api.query.otcOrder.hasFirstPurchased(buyerAccount)
  → true
```

---

## 故障排查

### 订单创建失败

```
检查清单:
[ ] 做市商存在且激活？ (MakerInterface::is_maker_active)
[ ] 定价服务可用？ (Pricing::get_dust_to_usd_rate)
[ ] 做市商余额充足？
[ ] 买家账户有效且有签名权？
[ ] Hash值格式正确？ (32字节)
```

### 争议登记失败

```
检查清单:
[ ] 订单状态是否为PaidOrCommitted？
[ ] 调用者是买家或做市商？ (Router.can_dispute)
[ ] 争议是否已被登记？ (防重复)
[ ] Evidence ID存在？
```

### 仲裁裁决失败

```
检查清单:
[ ] 调用者是否有治理权限？ (DecisionOrigin)
[ ] 争议是否已登记？
[ ] Domain是否被Router支持？
[ ] 订单金额是否足够分配？
```

---

## 监控指标

### 关键KPI
- 日活订单数
- 平均订单完成时间
- 争议率 (争议订单/总订单)
- 做市商胜诉率
- 信用扣分频率

### 警告指标
- 做市商信用<800分 (即将暂停)
- 争议率>5% (异常高)
- 超时率>10% (服务质量差)
- 同一对手重复争议 (可能故意)

---

## 相关文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| OTC Order pallet | `pallets/otc-order/src/lib.rs` | 核心订单逻辑 |
| Arbitration pallet | `pallets/arbitration/src/lib.rs` | 仲裁系统 |
| Evidence pallet | `pallets/evidence/src/lib.rs` | 证据管理 |
| Credit pallet | `pallets/credit/src/lib.rs` | 信用系统 |
| Runtime配置 | `runtime/src/configs/mod.rs` | Router实现 |
| README | `pallets/otc-order/README.md` | 详细文档 |

---

## 进阶话题

### 双向押金机制 (TODO)

```
当前状态: 部分实现
计划特性:
  - 发起方: 锁定订单金额×15%
  - 应诉方: 锁定相同金额
  - 罚没: Release 30%, Refund 30%, Partial 50%
  - 国库: 接收罚没资金

好处:
  - 增加虚假诉讼成本
  - 激励认真应诉
  - 公平的资金分配
```

### 部分裁决 (TODO)

```
当前状态: 存根实现 (作为Refund处理)
计划实现:
  - Decision::Partial(5000) = 50% Release, 50% Refund
  - 适用于双方都有过错的情况
  - 灵活的bps值 (0-10000)
```

### 自动清理机制

```
已实现:
  - TRON交易哈希队列清理 (10000个限制)
  - 过期订单自动标记
  
待实现:
  - 过期争议自动关闭
  - 历史数据存档
```

