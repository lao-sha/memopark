# Pallet-Deceased 分类功能完整分析报告

## 执行摘要

pallet-deceased 实现了完整的逝者分类管理系统，包括：
- **7种分类枚举**定义
- **创建逝者时不支持**指定分类（默认为 Ordinary）
- **3个核心管理方法**（申请、批准、拒绝）+ 1个Root强制设置方法
- **完整的押金机制**和治理流程
- **4种事件类型**和8种错误类型

---

## 1. 分类数据结构定义

### 1.1 DeceasedCategory 枚举

**位置**: `/home/xiaodong/文档/stardust/pallets/deceased/src/lib.rs` 第 325-346 行

```rust
pub enum DeceasedCategory {
    /// 普通民众（默认）
    Ordinary = 0,
    /// 历史人物
    HistoricalFigure = 1,
    /// 革命烈士
    Martyr = 2,
    /// 英雄模范
    Hero = 3,
    /// 公众人物
    PublicFigure = 4,
    /// 宗教人物
    ReligiousFigure = 5,
    /// 事件馆
    EventHall = 6,
}

impl Default for DeceasedCategory {
    fn default() -> Self {
        Self::Ordinary
    }
}
```

**关键特性**:
- ✅ 共7种分类（0-6）
- ✅ 实现了 `Default` trait，默认为 `Ordinary`
- ✅ 派生了标准编解码 traits: `Encode`, `Decode`, `Clone`, `Copy`, `PartialEq`, `Eq`, `TypeInfo`, `MaxEncodedLen`, `RuntimeDebug`

---

### 1.2 RequestStatus 枚举

**位置**: 第 348-359 行

```rust
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum RequestStatus {
    /// 待审核
    Pending,
    /// 已批准
    Approved,
    /// 已拒绝
    Rejected,
    /// 已过期
    Expired,
}
```

---

### 1.3 CategoryChangeRequest 结构

**位置**: 第 361-395 行

```rust
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct CategoryChangeRequest<T: Config> {
    /// 申请人账户
    pub applicant: T::AccountId,
    /// 逝者ID
    pub deceased_id: u64,
    /// 当前分类
    pub current_category: DeceasedCategory,
    /// 目标分类
    pub target_category: DeceasedCategory,
    /// 申请理由CID（存储在IPFS，最多64字节）
    pub reason_cid: BoundedVec<u8, ConstU32<64>>,
    /// 证据CID列表（存储在IPFS，最多10个，每个最多64字节）
    pub evidence_cids: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<10>>,
    /// 申请时间（区块号）
    pub submitted_at: BlockNumberFor<T>,
    /// 审核截止时间（区块号）
    pub deadline: BlockNumberFor<T>,
    /// 申请状态
    pub status: RequestStatus,
}
```

**完整的生命周期说明**（第 362-373 行）:
```
1. **Pending**：待审核（委员会投票中）
2. **Approved**：已批准（自动执行分类修改）
3. **Rejected**：已拒绝（申请被驳回）
4. **Expired**：已过期（超过审核期限）

### 押金处理
- 提交申请时冻结押金（10 DUST）
- 批准后：全额退回押金
- 拒绝后：50%退回，50%罚没至国库
- 过期后：全额退回押金
```

---

## 2. 创建逝者方法分析

### 2.1 create_deceased 方法

**位置**: 第 3906-4081 行

```rust
pub fn create_deceased(
    origin: OriginFor<T>,
    name: Vec<u8>,
    gender_code: u8,              // 0=M,1=F,2=B
    name_full_cid: Option<Vec<u8>>,
    birth_ts: Vec<u8>,            // 格式 YYYYMMDD（8位数字）
    death_ts: Vec<u8>,            // 格式 YYYYMMDD（8位数字）
    links: Vec<Vec<u8>>,
) -> DispatchResult
```

**关键发现 - 分类参数**:
- ❌ **不支持在创建时指定分类**
- ✅ 逝者创建时默认分类为 `DeceasedCategory::Ordinary`（第 3971-3989 行）
- ✅ 如需更改分类，必须通过后续的分类申请流程

**创建时相关逻辑**（第 3971-3989 行）:
```rust
let deceased = Deceased::<T> {
    owner: who.clone(),
    creator: who.clone(),
    name: name_bv,
    gender,
    name_full_cid: name_full_cid_bv,
    birth_ts: birth_bv,
    death_ts: death_bv,
    main_image_cid: None,
    deceased_token,
    token_revision_count: 0,
    token_revision_limit: 3,
    links: links_bv,
    created: now,
    updated: now,
    version: 1,
};
// 注意：没有初始化 category 字段
```

**注意**: Deceased 结构体本身不包含 category 字段，分类存储在独立的 `CategoryOf` 存储映射中。

---

## 3. 分类存储项定义

### 3.1 CategoryOf 存储映射

**位置**: 第 729-737 行

```rust
#[pallet::storage]
#[pallet::getter(fn category_of)]
pub type CategoryOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,                          // deceased_id
    DeceasedCategory,
    ValueQuery,                   // 默认返回 Ordinary
>;
```

**关键特性**:
- ✅ 使用 `ValueQuery` - 不存在的键返回默认值 `Ordinary`
- ✅ 提供 getter 方法 `category_of(deceased_id)`
- ✅ 使用 Blake2_128Concat 哈希，支持高效查询

### 3.2 CategoryChangeRequests 存储映射

**位置**: 第 742-749 行

```rust
#[pallet::storage]
#[pallet::getter(fn change_requests)]
pub type CategoryChangeRequests<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,                          // request_id
    CategoryChangeRequest<T>,
>;
```

### 3.3 NextRequestId 存储值

**位置**: 第 751-754 行

```rust
#[pallet::storage]
#[pallet::getter(fn next_request_id)]
pub type NextRequestId<T: Config> = StorageValue<_, u64, ValueQuery>;
```

### 3.4 RequestsByUser 索引映射

**位置**: 第 756-766 行

```rust
/// 用户申请历史索引
/// - Key: (applicant, deceased_id)
/// - Value: Vec<request_id>（最多100个）
#[pallet::storage]
pub type RequestsByUser<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    (T::AccountId, u64),          // (applicant, deceased_id)
    BoundedVec<u64, ConstU32<100>>,
    ValueQuery,
>;
```

---

## 4. 分类管理方法

### 4.1 request_category_change - 提交分类修改申请

**位置**: 第 5677-5772 行

```rust
pub fn request_category_change(
    origin: OriginFor<T>,
    deceased_id: u64,
    target_category_code: u8,  // 使用u8代替枚举
    reason_cid: Vec<u8>,       // IPFS CID，最少10字节，最多64字节
    evidence_cids: Vec<Vec<u8>>,  // 最多10个，每个最多64字节
) -> DispatchResult
```

**执行流程** (按代码顺序):

1. **权限检查** (第 5684):
   - 任何签名账户都可以提交申请
   - 无需是逝者owner

2. **参数验证** (第 5686-5728):
   - ✅ 检查逝者是否存在
   - ✅ 将 u8 转换为 `DeceasedCategory`（0-6有效，其他返回 `BadInput` 错误）
   - ✅ 检查目标分类与当前分类是否相同
   - ✅ 验证 reason_cid 长度：10-64 字节
   - ✅ 验证证据 CID 数量：最多10个
   - ✅ 验证每个证据 CID 长度：最多64字节

3. **押金冻结** (第 5730-5732):
   ```rust
   let deposit = 10u128.saturating_mul(1_000_000_000_000u128); // 10 DUST
   T::Currency::reserve(&who, deposit.saturated_into())?;
   ```

4. **申请创建** (第 5735-5749):
   - 生成请求ID：`Self::next_request_id()`
   - 计算截止时间：当前区块号 + 7天（100800区块）
   - 申请状态初始化为 `RequestStatus::Pending`

5. **存储申请** (第 5751-5760):
   - 保存到 `CategoryChangeRequests`
   - 增加 `NextRequestId`
   - 添加用户申请索引到 `RequestsByUser`

6. **事件发送** (第 5762-5769):
   ```rust
   Event::CategoryChangeRequested {
       request_id,
       deceased_id,
       applicant: who,
       from: current_category as u8,
       to: target_category as u8,
   }
   ```

**返回值**: `DispatchResult`

---

### 4.2 force_set_category - Root 强制设置分类

**位置**: 第 5785-5833 行

```rust
pub fn force_set_category(
    origin: OriginFor<T>,
    deceased_id: u64,
    category_code: u8,
    note_cid: Option<Vec<u8>>,
) -> DispatchResult
```

**权限**: 仅 `ensure_root` 可调用

**执行流程**:
1. ✅ Root 权限检查
2. ✅ 逝者存在性检查
3. ✅ u8 转换为 `DeceasedCategory`
4. ✅ 直接修改 `CategoryOf` 存储
5. ✅ 发送事件 `CategoryForcedChanged`

**关键特点**:
- ⚠️ **绕过申请和投票流程**
- ⚠️ **不需要冻结押金**
- ✅ 可选备注 CID（最多64字节）

---

### 4.3 approve_category_change - 批准申请

**位置**: 第 5844-5883 行

```rust
pub fn approve_category_change(
    origin: OriginFor<T>,
    request_id: u64,
) -> DispatchResult
```

**权限** (第 5848-5850):
```rust
if let Err(_) = T::GovernanceOrigin::ensure_origin(origin.clone()) {
    ensure_root(origin)?;
}
// 即：Root OR GovernanceOrigin
```

**执行流程**:

1. **检索申请** (第 5853-5855):
   - 获取申请记录
   - 申请不存在返回 `RequestNotFound` 错误

2. **状态检查** (第 5857-5861):
   - 申请必须是 `Pending` 状态
   - 否则返回 `RequestNotPending` 错误

3. **执行分类修改** (第 5863-5864):
   ```rust
   CategoryOf::<T>::insert(request.deceased_id, request.target_category);
   ```

4. **押金退还** (第 5866-5868):
   ```rust
   let deposit = 10u128.saturating_mul(1_000_000_000_000u128); // 10 DUST
   T::Currency::unreserve(&request.applicant, deposit.saturated_into());
   ```

5. **申请状态更新** (第 5870-5872):
   - 状态变更为 `Approved`
   - 保存更新后的申请

6. **事件发送** (第 5874-5880):
   ```rust
   Event::CategoryChangeApproved {
       request_id,
       deceased_id: request.deceased_id,
       from: request.current_category as u8,
       to: request.target_category as u8,
   }
   ```

---

### 4.4 reject_category_change - 拒绝申请

**位置**: 第 5899-5949 行

```rust
pub fn reject_category_change(
    origin: OriginFor<T>,
    request_id: u64,
    reason_cid: Vec<u8>,    // IPFS CID，拒绝理由
) -> DispatchResult
```

**权限**: 同 `approve_category_change`（Root OR GovernanceOrigin）

**执行流程**:

1. **检索和状态检查**: 同批准流程

2. **押金处理** (第 5919-5934):
   ```rust
   let full_deposit = 10u128.saturating_mul(1_000_000_000_000u128);
   let half_deposit = full_deposit / 2u128;
   
   // 50%退还给申请人
   T::Currency::unreserve(&request.applicant, half_deposit.saturated_into());
   
   // 取消剩余reserve并转账50%到国库
   T::Currency::unreserve(&request.applicant, half_deposit.saturated_into());
   T::Currency::transfer(
       &request.applicant,
       &T::FeeCollector::get(),
       half_deposit.saturated_into(),
       ExistenceRequirement::AllowDeath,
   )?;
   ```

3. **申请状态更新**: 状态变更为 `Rejected`

4. **事件发送**:
   ```rust
   Event::CategoryChangeRejected {
       request_id,
       deceased_id: request.deceased_id,
       reason_cid: reason_cid_bounded,
   }
   ```

---

## 5. 事件定义

**位置**: 第 928-984 行

### 5.1 CategoryChangeRequested

```rust
CategoryChangeRequested {
    request_id: u64,
    deceased_id: u64,
    applicant: T::AccountId,
    from: u8,      // 当前分类（u8代码）
    to: u8,        // 目标分类（u8代码）
}
```

触发: 调用 `request_category_change` 时

### 5.2 CategoryChangeApproved

```rust
CategoryChangeApproved {
    request_id: u64,
    deceased_id: u64,
    from: u8,      // 原分类（u8代码）
    to: u8,        // 新分类（u8代码）
}
```

触发: 调用 `approve_category_change` 时

### 5.3 CategoryChangeRejected

```rust
CategoryChangeRejected {
    request_id: u64,
    deceased_id: u64,
    reason_cid: BoundedVec<u8, ConstU32<64>>,
}
```

触发: 调用 `reject_category_change` 时

### 5.4 CategoryForcedChanged

```rust
CategoryForcedChanged {
    deceased_id: u64,
    from: u8,                              // 原分类（u8代码）
    to: u8,                                // 新分类（u8代码）
    note_cid: Option<BoundedVec<u8, ConstU32<64>>>,
}
```

触发: 调用 `force_set_category` 时

---

## 6. 错误定义

**位置**: 第 1693-1709 行

```rust
// =================== 分类系统：错误 ===================

/// 申请不存在
RequestNotFound,

/// 申请不是待审核状态
RequestNotPending,

/// 目标分类与当前分类相同
SameCategory,

/// 理由CID太长（超过64字节）
ReasonCidTooLong,

/// 理由CID太短（少于10字节）
ReasonCidTooShort,

/// 证据CID太长（超过64字节）
EvidenceCidTooLong,

/// 证据数量过多（超过10个）
TooManyEvidences,

/// 申请历史数量过多（超过100个）
TooManyRequests,
```

---

## 7. Config 配置要求

**位置**: 第 467-614 行

### 7.1 必须配置的相关项

```rust
pub trait Config: frame_system::Config {
    /// 治理权限来源（用于批准/拒绝申请）
    type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    
    /// 费用收集器账户（罚没押金的目标）
    type FeeCollector: Get<Self::AccountId>;
    
    /// 货币系统（用于冻结和退还押金）
    type Currency: ReservableCurrency<Self::AccountId>;
}
```

### 7.2 关键常量

- **申请押金**: 10 DUST (1,000,000,000,000 最小单位)
- **推却期限**: 7天 (100,800 区块，按6秒/区块计算)
- **申请历史限制**: 最多100个
- **证据数量限制**: 最多10个
- **CID 长度限制**: 最多64字节

---

## 8. 权限控制详解

### 8.1 创建分类申请

| 操作 | 权限要求 | 说明 |
|-----|--------|------|
| 提交申请 | **任何签名账户** | 不限制申请人 |
| 修改分类 | 取决于申请是否被批准 | 无权限无法直接修改 |

### 8.2 管理分类申请

| 操作 | 权限要求 | 说明 |
|-----|--------|------|
| 批准申请 | **Root 或 GovernanceOrigin** | 需要治理权限 |
| 拒绝申请 | **Root 或 GovernanceOrigin** | 需要治理权限 |
| 强制修改 | **Root** | 绕过申请流程 |

### 8.3 权限检查代码模式

```rust
// 标准治理权限检查
if let Err(_) = T::GovernanceOrigin::ensure_origin(origin.clone()) {
    ensure_root(origin)?;
}
// 结果：Root OR GovernanceOrigin
```

---

## 9. 分类流程时序

```
时刻1: 用户提交申请 (request_category_change)
      |
      ├─ 冻结10 DUST押金
      ├─ 创建CategoryChangeRequest (status=Pending)
      ├─ 保存到CategoryChangeRequests存储
      └─ 发送 CategoryChangeRequested 事件

      [等待7天...区块号流转...]

时刻2: 治理委员会投票
      |
      ├─ 方案A: 批准 (approve_category_change)
      │   ├─ 修改 CategoryOf[deceased_id] = target_category
      │   ├─ 退还全部10 DUST押金
      │   ├─ 申请状态 = Approved
      │   └─ 发送 CategoryChangeApproved 事件
      │
      └─ 方案B: 拒绝 (reject_category_change)
          ├─ 申请状态 = Rejected
          ├─ 退还50% (5 DUST) 给申请人
          ├─ 罚没50% (5 DUST) 到国库
          └─ 发送 CategoryChangeRejected 事件
```

---

## 10. 数据完整性检查

### 10.1 分类一致性

```rust
// Deceased 结构体中没有category字段
pub struct Deceased<T: Config> {
    // ... other fields ...
    // ❌ 没有 category 字段
}

// 分类存储在独立的映射中
pub type CategoryOf<T: Config> = StorageMap<_, _, u64, DeceasedCategory, ValueQuery>;

// 这种设计的优点：
// ✅ 分类可以独立管理和演变
// ✅ 支持零成本的分类查询
// ✅ 不影响逝者的其他属性
```

### 10.2 申请生命周期确保

- ✅ 申请ID序列保证唯一性
- ✅ 状态机确保申请不会重复处理
- ✅ RequestsByUser 索引确保快速查询用户申请历史
- ✅ 7天截止期限确保及时决策

---

## 11. 集成点和依赖

### 11.1 外部依赖

| 依赖 | 用途 | 调用点 |
|-----|------|--------|
| `T::GovernanceOrigin` | 权限检查 | approve/reject_category_change |
| `T::Currency` | 押金管理 | request/approve/reject_category_change |
| `T::FeeCollector` | 罚没账户 | reject_category_change |

### 11.2 内部依赖

- ✅ 逝者存在性检查 (DeceasedOf 存储)
- ✅ 申请历史索引 (RequestsByUser 存储)
- ✅ 下一个ID生成 (NextRequestId 存储)

---

## 12. 关键发现和建议

### 12.1 关键发现

1. ✅ **分类系统完整**: 包含定义、申请、审核、执行的完整流程
2. ✅ **创建时不设置分类**: 所有逝者初始分类为 Ordinary
3. ✅ **独立存储设计**: 分类存储独立于 Deceased 结构，支持灵活扩展
4. ✅ **完整的押金机制**: 10 DUST 申请押金，50%罚没政策
5. ✅ **治理集成**: Root 和 GovernanceOrigin 双权限支持
6. ✅ **充分的验证**: CID 长度、分类有效性、状态机检查

### 12.2 优化建议

1. **事件优化**: 考虑在 Approved 事件中也包含 applicant，便于追踪
2. **超时处理**: 当前没有自动过期处理，建议添加超时清理机制
3. **查询优化**: 可以添加 `get_user_requests()` 公开方法，便于前端查询
4. **权限细粒度**: 考虑添加委员会成员验证，增加民主性

### 12.3 前端集成建议

1. **申请提交**:
   ```typescript
   // 需要验证：
   - reasonCid 长度 10-64 字节
   - evidenceCids 数量 0-10 个
   - 每个 evidenceCid 长度 0-64 字节
   - 用户有足够的 10 DUST 余额
   ```

2. **申请查询**:
   ```typescript
   // 获取用户申请历史：遍历 RequestsByUser 存储
   // 显示申请状态和截止时间
   // 计算剩余审核时间
   ```

3. **分类显示**:
   ```typescript
   // 使用 category_of(deceased_id) 查询当前分类
   // 缓存分类值以优化性能
   ```

---

## 13. 完整方法调用权限矩阵

| 方法 | 需要签名 | 需要Root | 需要治理权限 | 需要Owner | 需要押金 |
|-----|--------|---------|----------|---------|---------|
| request_category_change | ✅ | ❌ | ❌ | ❌ | ✅ (10 DUST) |
| approve_category_change | ❌ | ✅ | ✅ | ❌ | ❌ |
| reject_category_change | ❌ | ✅ | ✅ | ❌ | ❌ |
| force_set_category | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## 14. 总结

### 实现完整性评分

| 方面 | 评分 | 说明 |
|-----|-----|------|
| 分类定义 | ⭐⭐⭐⭐⭐ | 7种分类完整，枚举清晰 |
| 创建支持 | ⭐⭐⭐ | 不支持创建时指定，仅支持后续申请 |
| 管理方法 | ⭐⭐⭐⭐⭐ | 4个方法全覆盖 (申请、批准、拒绝、强制) |
| 权限控制 | ⭐⭐⭐⭐⭐ | 多层权限检查，安全性高 |
| 事件系统 | ⭐⭐⭐⭐ | 4种事件覆盖全流程 |
| 错误处理 | ⭐⭐⭐⭐ | 8种错误精准定义 |
| 文档完整 | ⭐⭐⭐⭐ | README 明确记录分类系统 |
| **总体** | ⭐⭐⭐⭐⭐ | **高度完整的生产级实现** |

