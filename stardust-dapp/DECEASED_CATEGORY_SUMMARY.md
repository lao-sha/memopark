# Pallet-Deceased 分类功能快速参考

## 快速概览

```
┌─────────────────────────────────────────────────────┐
│         Pallet-Deceased 分类管理系统                  │
├─────────────────────────────────────────────────────┤
│                                                       │
│  分类枚举 (7种)                                      │
│  ├─ Ordinary (0)          - 普通民众【默认】        │
│  ├─ HistoricalFigure (1)  - 历史人物                │
│  ├─ Martyr (2)            - 革命烈士                │
│  ├─ Hero (3)              - 英雄模范                │
│  ├─ PublicFigure (4)      - 公众人物                │
│  ├─ ReligiousFigure (5)   - 宗教人物                │
│  └─ EventHall (6)         - 事件馆                  │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## 创建时分类处理

```
┌──────────────────┐
│ create_deceased  │
└────────┬─────────┘
         │
         ├─ 逝者初始分类：Ordinary
         │  （存储在 CategoryOf[deceased_id]）
         │
         └─ 无法在创建时指定分类
            （必须通过申请流程修改）
```

---

## 分类申请流程

```
                    创建时
                      │
                      ▼
                  Ordinary【默认】
                      │
                      │  (request_category_change)
                      │  需要：10 DUST 押金
                      ▼
              ┌──────────────┐
              │  Pending     │  待审核(7天)
              └──────────────┘
                   │         │
        (approve)  │         │  (reject)
                   ▼         ▼
            ┌───────────┐ ┌──────────┐
            │ Approved  │ │ Rejected │
            └───────────┘ └──────────┘
                   │            │
                   │            │
           目标分类  ├─ 5 DUST(返)
           已执行      └─ 5 DUST(罚)
```

---

## 核心方法速查表

### 1. 提交分类修改申请

**方法**: `request_category_change`

```rust
// 参数
deceased_id: u64                    // 逝者ID
target_category_code: u8            // 目标分类(0-6)
reason_cid: Vec<u8>                 // 申请理由(10-64字节)
evidence_cids: Vec<Vec<u8>>         // 证据CID(最多10个,各最多64字节)

// 费用
冻结: 10 DUST

// 权限
任何签名账户

// 结果
✅ 成功: CategoryChangeRequested 事件
❌ 失败: BadInput, SameCategory, ReasonCidTooShort等
```

---

### 2. 批准申请

**方法**: `approve_category_change`

```rust
// 参数
request_id: u64                     // 申请ID

// 权限
Root 或 GovernanceOrigin

// 操作
1. 检查申请状态 = Pending
2. 修改 CategoryOf[deceased_id] = target_category
3. 退还全部 10 DUST 押金
4. 申请状态 = Approved

// 事件
CategoryChangeApproved {
    request_id, deceased_id, from, to
}
```

---

### 3. 拒绝申请

**方法**: `reject_category_change`

```rust
// 参数
request_id: u64                     // 申请ID
reason_cid: Vec<u8>                 // 拒绝理由CID

// 权限
Root 或 GovernanceOrigin

// 操作
1. 检查申请状态 = Pending
2. 申请状态 = Rejected
3. 退还 5 DUST 给申请人
4. 罚没 5 DUST 到国库

// 事件
CategoryChangeRejected {
    request_id, deceased_id, reason_cid
}
```

---

### 4. 强制修改分类

**方法**: `force_set_category`

```rust
// 参数
deceased_id: u64                    // 逝者ID
category_code: u8                   // 新分类(0-6)
note_cid: Option<Vec<u8>>          // 修改备注(可选)

// 权限
仅 Root

// 操作
1. 检查逝者存在
2. 直接修改 CategoryOf[deceased_id]
3. 绕过申请和投票流程

// 事件
CategoryForcedChanged {
    deceased_id, from, to, note_cid
}
```

---

## 存储结构

```
┌─────────────────────────────────────┐
│  CategoryOf (存储映射)               │
├─────────────────────────────────────┤
│ Key: deceased_id (u64)              │
│ Value: DeceasedCategory             │
│ 特点: ValueQuery → 默认 Ordinary    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ CategoryChangeRequests (存储映射)    │
├─────────────────────────────────────┤
│ Key: request_id (u64)               │
│ Value: CategoryChangeRequest {      │
│   applicant, deceased_id,           │
│   current_category, target_category,│
│   reason_cid, evidence_cids,        │
│   submitted_at, deadline, status    │
│ }                                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ RequestsByUser (索引映射)             │
├─────────────────────────────────────┤
│ Key: (applicant, deceased_id)       │
│ Value: Vec<request_id> (最多100)   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ NextRequestId (存储值)               │
├─────────────────────────────────────┤
│ Value: u64 (下一个申请ID)            │
└─────────────────────────────────────┘
```

---

## 错误速查

| 错误 | 含义 | 触发条件 |
|-----|------|--------|
| `DeceasedNotFound` | 逝者不存在 | deceased_id 无效 |
| `SameCategory` | 分类相同 | target_category = current_category |
| `ReasonCidTooShort` | 理由CID过短 | reason_cid.len() < 10 |
| `ReasonCidTooLong` | 理由CID过长 | reason_cid.len() > 64 |
| `EvidenceCidTooLong` | 证据CID过长 | evidence_cid.len() > 64 |
| `TooManyEvidences` | 证据过多 | evidence_cids.len() > 10 |
| `RequestNotFound` | 申请不存在 | request_id 无效 |
| `RequestNotPending` | 申请非待审核 | status != Pending |
| `TooManyRequests` | 用户申请过多 | 同一逝者超过100个申请 |
| `BadInput` | 输入无效 | category_code 不在 0-6 范围 |

---

## 事件速查

```
CategoryChangeRequested
├─ 触发: request_category_change 成功
├─ 参数: request_id, deceased_id, applicant, from, to
└─ 用途: 记录申请提交

CategoryChangeApproved
├─ 触发: approve_category_change 成功
├─ 参数: request_id, deceased_id, from, to
└─ 用途: 记录申请批准

CategoryChangeRejected
├─ 触发: reject_category_change 成功
├─ 参数: request_id, deceased_id, reason_cid
└─ 用途: 记录申请拒绝

CategoryForcedChanged
├─ 触发: force_set_category 成功
├─ 参数: deceased_id, from, to, note_cid
└─ 用途: 记录Root强制修改
```

---

## 权限矩阵

```
┌──────────────────────┬────────┬──────┬───────┬─────────┐
│ 操作                  │ 签名账户│ Root │ 治理权│ 押金要求│
├──────────────────────┼────────┼──────┼───────┼─────────┤
│ request              │  ✅    │ ❌  │ ❌   │ 10 DUST │
│ approve              │  ❌    │ ✅  │ ✅   │ 无      │
│ reject               │  ❌    │ ✅  │ ✅   │ 无      │
│ force_set            │  ❌    │ ✅  │ ❌   │ 无      │
└──────────────────────┴────────┴──────┴───────┴─────────┘
```

---

## 前端集成清单

### 申请提交前检查

- [ ] 逝者ID有效
- [ ] 当前分类 != 目标分类
- [ ] reasonCid 长度 10-64 字节
- [ ] evidenceCids 数量 <= 10 个
- [ ] 每个 evidenceCid 长度 <= 64 字节
- [ ] 用户余额 >= 10 DUST
- [ ] 用户已有申请数 < 100 个

### 申请查询

```typescript
// 获取用户申请历史
const requests = RequestsByUser.get((applicant, deceased_id))

// 获取申请详情
const request = CategoryChangeRequests.get(request_id)

// 获取当前分类
const category = CategoryOf.get(deceased_id)
```

### 事件监听

```typescript
// 申请提交事件
on('CategoryChangeRequested', (event) => {
  // 显示申请成功提示
  // 更新UI显示申请状态
})

// 申请批准事件
on('CategoryChangeApproved', (event) => {
  // 更新分类显示
  // 显示批准通知
})

// 申请拒绝事件
on('CategoryChangeRejected', (event) => {
  // 显示拒绝原因
  // 退款提示
})
```

---

## 常见问题

### Q1: 创建逝者时能否指定分类？
A: 不能。所有逝者初始分类为 Ordinary，必须通过申请流程修改。

### Q2: 申请押金如何处理？
A: 
- 批准: 全额退还 (10 DUST)
- 拒绝: 50% 退还 (5 DUST)，50% 罚没至国库 (5 DUST)

### Q3: 申请审核期限多长？
A: 7天 (100,800 区块，按 6 秒/区块)

### Q4: Root 可以强制修改分类吗？
A: 可以。通过 force_set_category 绕过申请流程。

### Q5: 同一个逝者可以有多少个申请？
A: 最多 100 个申请历史记录。

### Q6: 是否支持自动过期处理？
A: 当前不支持。申请过期状态需要手动处理或链下监控。

---

## 关键设计决策

### 1. 分类独立存储
✅ 优点: 分类可独立演变，不影响其他属性
❌ 缺点: 需要额外查询获取分类信息

### 2. 申请押金制度
✅ 优点: 防止恶意申请，保护国库
❌ 缺点: 增加用户成本，可能降低申请积极性

### 3. 治理权限
✅ 优点: 民主决策，防止滥用
❌ 缺点: 申请处理可能延迟

### 4. Root 强制权限
✅ 优点: 应急机制，处理特殊情况
❌ 缺点: 容易滥用，需要严格管理

---

## 源代码位置

| 内容 | 位置 |
|-----|------|
| 枚举定义 | lib.rs: 325-346 |
| 申请结构体 | lib.rs: 361-395 |
| 存储定义 | lib.rs: 729-766 |
| 申请方法 | lib.rs: 5677-5772 |
| 批准方法 | lib.rs: 5844-5883 |
| 拒绝方法 | lib.rs: 5899-5949 |
| 强制方法 | lib.rs: 5785-5833 |
| 事件定义 | lib.rs: 928-984 |
| 错误定义 | lib.rs: 1693-1709 |

---

## 相关配置 (runtime/src/configs/mod.rs)

```rust
// 治理权限来源
impl deceased::Config for Runtime {
    type GovernanceOrigin = /* 具体实现 */;
    type FeeCollector = /* 收费账户 */;
    type Currency = Balances;
}
```

