# pallet-deceased 性能优化方案

**文档版本**: v1.0  
**创建日期**: 2025-11-18  
**状态**: 设计方案

---

## 一、当前性能问题分析

### 1.1 create_deceased 存储写入分析

**当前一次调用写入的存储项**（基于源码第3524-3696行）：

```rust
pub fn create_deceased(...) -> DispatchResult {
    // 1️⃣ NextDeceasedId::put(next)              - ID自增
    // 2️⃣ DeceasedOf::insert(id, deceased)       - 主记录 ✅ 必须
    // 3️⃣ DeceasedHistory::insert(id, hist)      - 版本历史
    // 4️⃣ VisibilityOf::insert(id, true)         - 可见性标记
    // 5️⃣ DeceasedIdByToken::insert(token, id)   - Token索引 ✅ 必须（去重）
    // 6️⃣ OwnerDepositRecords::insert(id, record) - 押金记录 ✅ 必须
    // 7️⃣ OwnerDepositsByOwner::insert((owner, id), ()) - Owner索引
    // 8️⃣ T::Fungible::hold() - 押金锁定 ✅ 必须
    
    // 总计：8个存储写入 + 1个资金操作
}
```

**存储成本估算**：
- 每个 insert 约 10,000 weight（读写trie开销）
- 总 weight ≈ 80,000 + 资金锁定开销
- 对应 Gas 成本较高

---

### 1.2 必须保留的写入操作

基于业务需求，以下操作**不能延迟**：

| 操作 | 原因 | 是否可延迟 |
|-----|------|-----------|
| **Token去重检查** | 防止重复创建相同逝者 | ❌ 必须立即执行 |
| **押金锁定** | 10 USDT押金必须锁定 | ❌ 必须立即执行 |
| **主记录写入** | 逝者数据核心 | ❌ 必须立即执行 |
| **Token索引** | 用于去重查询 | ❌ 必须立即执行 |
| **押金记录** | 审计和退款依据 | ❌ 必须立即执行 |

**关键约束**：
```rust
// Token去重检查（第3585-3588行）
ensure\!(
    DeceasedIdByToken::<T>::get(&deceased_token).is_none(),
    Error::<T>::DeceasedTokenExists  // 必须在创建前检查
);

// 押金锁定（第3642-3646行）
T::Fungible::hold(
    &T::RuntimeHoldReason::from(crate::HoldReason::DeceasedOwnerDeposit),
    &who,
    deposit_dust,  // 10 USDT对应的DUST，必须立即锁定
)?;
```

---

## 二、方案1：延迟初始化架构（推荐）

### 2.1 核心思想

**将存储写入分为两个阶段**：

#### 阶段1：核心数据写入（Atomic）
- **必须立即执行**的操作
- **保证原子性**：要么全部成功，要么全部失败
- **Gas成本**：降低50%

#### 阶段2：索引与统计延迟写入（Lazy）
- **可以延迟**的索引和统计信息
- **按需初始化**：第一次访问时才创建
- **Gas成本**：分摊到后续操作

---

### 2.2 具体实现方案

#### 步骤1：核心数据写入（原子操作）

```rust
pub fn create_deceased(...) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // ========== 阶段1：核心写入（不可延迟） ==========
    
    // 1. 生成ID和Token
    let id = NextDeceasedId::<T>::get();
    NextDeceasedId::<T>::put(id + 1);
    let deceased_token = Self::build_deceased_token(...);
    
    // 2. Token去重检查 ✅ 必须
    ensure\!(
        DeceasedIdByToken::<T>::get(&deceased_token).is_none(),
        Error::<T>::DeceasedTokenExists
    );
    
    // 3. 计算并锁定押金 ✅ 必须
    let deposit_usdt = 10u32;  // 基础10 USDT
    let deposit_dust = Self::convert_usdt_to_dust(deposit_usdt)?;
    
    T::Fungible::hold(
        &T::RuntimeHoldReason::from(HoldReason::DeceasedOwnerDeposit),
        &who,
        deposit_dust,
    )?;
    
    // 4. 写入主记录 ✅ 必须
    let deceased = Deceased::<T> { /* ... */ };
    DeceasedOf::<T>::insert(id, deceased);
    
    // 5. 写入Token索引 ✅ 必须（用于去重）
    DeceasedIdByToken::<T>::insert(&deceased_token, id);
    
    // 6. 写入押金记录 ✅ 必须（审计依据）
    let deposit_record = OwnerDepositRecord {
        owner: who.clone(),
        deceased_id: id,
        initial_deposit_usdt: deposit_usdt,
        initial_deposit_dust: deposit_dust,
        locked_at: now,
        status: DepositStatus::Active,
        // 新增：标记索引未初始化
        indexes_initialized: false,  // 🆕 延迟初始化标记
    };
    OwnerDepositRecords::<T>::insert(id, deposit_record);
    
    // ========== 阶段2：延迟写入（标记为未初始化） ==========
    // ❌ 不立即写入以下索引：
    // - OwnerDepositsByOwner
    // - DeceasedHistory
    // - VisibilityOf（使用默认值true）
    // - OperationsByOwner
    // - OperationsByDeceased
    
    // 发出事件
    Self::deposit_event(Event::DeceasedCreated(id, who));
    
    Ok(())  // ✅ 仅6个存储写入（减少3个）
}
```

**优化效果**：
- **前**：8个存储写入
- **后**：6个存储写入
- **减少**：25% 存储操作
- **Gas节省**：约30%

---

#### 步骤2：延迟索引初始化（按需触发）

**方式A：读取时自动初始化**

```rust
// Helper函数：确保索引已初始化
fn ensure_indexes_initialized(deceased_id: u64) -> DispatchResult {
    if let Some(mut record) = OwnerDepositRecords::<T>::get(deceased_id) {
        if \!record.indexes_initialized {
            // 🆕 第一次访问时初始化索引
            
            // 1. 初始化Owner索引
            OwnerDepositsByOwner::<T>::insert(
                (record.owner.clone(), deceased_id), 
                ()
            );
            
            // 2. 初始化可见性（默认true）
            if VisibilityOf::<T>::get(deceased_id).is_none() {
                VisibilityOf::<T>::insert(deceased_id, true);
            }
            
            // 3. 初始化版本历史
            if \!DeceasedHistory::<T>::contains_key(deceased_id) {
                let dec = DeceasedOf::<T>::get(deceased_id)
                    .ok_or(Error::<T>::DeceasedNotFound)?;
                let hist = vec\![VersionEntry {
                    version: 1,
                    editor: record.owner.clone(),
                    at: dec.created,
                }];
                DeceasedHistory::<T>::insert(
                    deceased_id, 
                    BoundedVec::try_from(hist).unwrap()
                );
            }
            
            // 4. 标记已初始化
            record.indexes_initialized = true;
            OwnerDepositRecords::<T>::insert(deceased_id, record);
        }
    }
    Ok(())
}

// 在需要索引的操作中调用
pub fn get_deceased_by_owner(who: T::AccountId) -> Vec<u64> {
    // 遍历所有押金记录（这种查询不常用）
    OwnerDepositRecords::<T>::iter()
        .filter_map(|(deceased_id, record)| {
            if record.owner == who {
                // 🆕 确保索引已初始化
                let _ = Self::ensure_indexes_initialized(deceased_id);
                Some(deceased_id)
            } else {
                None
            }
        })
        .collect()
}
```

**方式B：批量初始化（后台任务）**

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_idle(n: BlockNumberFor<T>, remaining_weight: Weight) -> Weight {
        // 每100个区块运行一次
        if n % 100u32.into() \!= 0u32.into() {
            return Weight::zero();
        }
        
        let mut used_weight = Weight::zero();
        let max_initializations = 10; // 每次最多初始化10个
        let mut count = 0;
        
        // 查找未初始化的记录
        for (deceased_id, record) in OwnerDepositRecords::<T>::iter() {
            if count >= max_initializations {
                break;
            }
            if remaining_weight.saturating_sub(used_weight).ref_time() < 50_000 {
                break;
            }
            
            if \!record.indexes_initialized {
                if Self::initialize_indexes_for(deceased_id).is_ok() {
                    count += 1;
                    used_weight += Weight::from_parts(30_000, 0);
                }
            }
        }
        
        used_weight
    }
}
```

---

### 2.3 兼容性处理

**迁移旧数据**：

```rust
// 存储版本管理
const STORAGE_VERSION: StorageVersion = StorageVersion::new(2);

#[pallet::storage_version(STORAGE_VERSION)]
pub struct Pallet<T>(_);

// 迁移函数
pub mod migrations {
    use super::*;
    
    pub fn migrate_v1_to_v2<T: Config>() -> Weight {
        let mut weight = Weight::zero();
        
        // 为所有旧记录标记为"已初始化"（因为旧数据已经有索引）
        for (deceased_id, mut record) in OwnerDepositRecords::<T>::iter() {
            if record.indexes_initialized.is_none() {
                record.indexes_initialized = Some(true);
                OwnerDepositRecords::<T>::insert(deceased_id, record);
                weight += Weight::from_parts(10_000, 0);
            }
        }
        
        weight
    }
}
```

---

### 2.4 方案优缺点分析

| 维度 | 优势 | 劣势 |
|-----|------|------|
| **Gas成本** | ✅ create时减少30% | ⚠️ 首次查询时增加10% |
| **用户体验** | ✅ 创建速度更快 | ⚠️ 首次查询略慢 |
| **复杂度** | ⚠️ 需要额外的初始化逻辑 | ❌ 增加代码维护成本 |
| **数据一致性** | ✅ Token去重和押金锁定保持原子性 | ✅ 无风险 |
| **迁移成本** | ⚠️ 需要存储版本迁移 | ⚠️ 中等 |

---

## 三、方案2：存储合并优化（补充方案）

### 3.1 合并冗余索引

**问题**：当前有多个索引存储同一信息

```rust
// 当前：5个索引存储
OwnerDepositRecords          // deceased_id => OwnerDepositRecord
OwnerDepositsByOwner         // (owner, deceased_id) => ()
OperationsByOwner            // (owner, operation_id) => ()
OperationsByDeceased         // (deceased_id, operation_id) => ()
ComplaintsByOperation        // (operation_id, complaint_id) => ()
```

**优化**：保留核心索引，删除低频索引

```rust
// 优化后：仅保留3个
OwnerDepositRecords          // deceased_id => OwnerDepositRecord（含owner）
OwnerDepositsByOwner         // ❌ 删除，改用OwnerDepositRecords遍历
OperationsByDeceased         // (deceased_id, operation_id) => ()
```

**查询优化**：

```rust
// 旧方式：通过索引快速查询
pub fn get_deposits_by_owner(who: AccountId) -> Vec<u64> {
    OwnerDepositsByOwner::<T>::iter_prefix(who)
        .map(|((_, deceased_id), _)| deceased_id)
        .collect()
}

// 新方式：遍历主存储（低频操作可接受）
pub fn get_deposits_by_owner(who: AccountId) -> Vec<u64> {
    OwnerDepositRecords::<T>::iter()
        .filter_map(|(deceased_id, record)| {
            if record.owner == who {
                Some(deceased_id)
            } else {
                None
            }
        })
        .collect()
}
```

**适用场景**：
- ✅ 按owner查询不是高频操作
- ✅ 可接受遍历开销（假设单用户<1000个逝者）
- ✅ 减少写入成本更重要

---

### 3.2 使用BTreeMap优化批量查询

**问题**：多次单独查询效率低

```rust
// 当前：批量查询需要N次存储读取
pub fn get_multiple_deceased(ids: Vec<u64>) -> Vec<Deceased<T>> {
    ids.into_iter()
        .filter_map(|id| DeceasedOf::<T>::get(id))  // N次读取
        .collect()
}
```

**优化**：使用缓存或批量读取

```rust
// Substrate不直接支持批量读取，但可以优化查询策略
pub fn get_multiple_deceased_optimized(ids: Vec<u64>) -> Vec<(u64, Deceased<T>)> {
    // 使用iter()一次性遍历（适用于ids数量较少的情况）
    if ids.len() < 10 {
        // 少量查询：逐个读取
        ids.into_iter()
            .filter_map(|id| DeceasedOf::<T>::get(id).map(|d| (id, d)))
            .collect()
    } else {
        // 大量查询：过滤遍历（当ids > 总数/2时更高效）
        DeceasedOf::<T>::iter()
            .filter(|(id, _)| ids.contains(id))
            .collect()
    }
}
```

---

## 四、方案3：Token检查优化

### 4.1 当前Token去重机制

```rust
// 步骤1：构建token（第3583行）
let deceased_token = Self::build_deceased_token(&gender, &birth_bv, &death_bv, &name_bv);

// 步骤2：去重检查（第3585-3588行）
ensure\!(
    DeceasedIdByToken::<T>::get(&deceased_token).is_none(),
    Error::<T>::DeceasedTokenExists
);

// 步骤3：写入索引（第3620-3622行）
DeceasedIdByToken::<T>::insert(d.deceased_token, id);
```

**问题**：Token构建包含哈希计算，成本较高

---

### 4.2 优化方案：Token预计算

```rust
// 前端提前计算token并传入
pub fn create_deceased_with_token(
    origin: OriginFor<T>,
    deceased_token_precomputed: Vec<u8>,  // 🆕 前端预计算
    name: Vec<u8>,
    gender_code: u8,
    birth_ts: Vec<u8>,
    death_ts: Vec<u8>,
    ...
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 验证：前端计算的token是否正确
    let expected_token = Self::build_deceased_token(...);
    ensure\!(
        deceased_token_precomputed == expected_token.into_inner(),
        Error::<T>::InvalidToken
    );
    
    // 后续逻辑复用precomputed token，避免重复计算
    let deceased_token = BoundedVec::try_from(deceased_token_precomputed)?;
    
    // Token去重检查
    ensure\!(
        DeceasedIdByToken::<T>::get(&deceased_token).is_none(),
        Error::<T>::DeceasedTokenExists
    );
    
    // ... 其余逻辑 ...
}
```

**优势**：
- ✅ 节省链上哈希计算成本（~5,000 weight）
- ✅ 前端可缓存token计算结果
- ⚠️ 需要前端实现相同的token生成逻辑

---

## 五、综合优化方案（推荐组合）

### 5.1 最佳实践组合

结合以上方案，推荐实施顺序：

**Phase 1（短期，2周）**：
1. ✅ 实施**方案2**：删除低频索引（OwnerDepositsByOwner等）
2. ✅ 优化**DeceasedHistory**为延迟初始化
3. ✅ 优化**VisibilityOf**使用默认值（减少1次写入）

**预期收益**：
- 减少3个存储写入（OwnerDepositsByOwner、DeceasedHistory、VisibilityOf）
- Gas成本降低30%
- 无兼容性问题

---

**Phase 2（中期，1月）**：
1. ✅ 实施**方案1**：完整的延迟初始化架构
2. ✅ 添加后台初始化任务（on_idle）
3. ✅ 存储版本迁移

**预期收益**：
- 减少5个存储写入
- Gas成本降低50%
- 需要存储迁移

---

**Phase 3（长期，3月）**：
1. ✅ 实施**方案3**：Token预计算（可选）
2. ✅ 批量查询优化
3. ✅ 前端SDK集成

**预期收益**：
- Gas成本再降低10%
- 前端体验提升

---

### 5.2 实施代码示例（Phase 1）

```rust
pub fn create_deceased(...) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // ========== 核心写入（保留） ==========
    
    // 1. ID自增
    let id = NextDeceasedId::<T>::get();
    NextDeceasedId::<T>::put(id + 1);
    
    // 2. 构建token并去重检查
    let deceased_token = Self::build_deceased_token(...);
    ensure\!(
        DeceasedIdByToken::<T>::get(&deceased_token).is_none(),
        Error::<T>::DeceasedTokenExists
    );
    
    // 3. 锁定10 USDT押金
    let deposit_usdt = 10u32;
    let deposit_dust = Self::convert_usdt_to_dust(deposit_usdt)?;
    T::Fungible::hold(
        &T::RuntimeHoldReason::from(HoldReason::DeceasedOwnerDeposit),
        &who,
        deposit_dust,
    )?;
    
    // 4. 写入主记录
    let deceased = Deceased::<T> { /* ... */ };
    DeceasedOf::<T>::insert(id, deceased);
    
    // 5. 写入Token索引（去重依赖）
    DeceasedIdByToken::<T>::insert(&deceased_token, id);
    
    // 6. 写入押金记录（审计依赖）
    let deposit_record = OwnerDepositRecord {
        owner: who.clone(),
        deceased_id: id,
        initial_deposit_usdt: deposit_usdt,
        locked_at: now,
        status: DepositStatus::Active,
    };
    OwnerDepositRecords::<T>::insert(id, deposit_record);
    
    // ========== 延迟初始化（Phase 1优化） ==========
    
    // ❌ 删除：OwnerDepositsByOwner（改用遍历查询）
    // ❌ 删除：DeceasedHistory（首次update时初始化）
    // ❌ 删除：VisibilityOf（使用None=默认true）
    
    // ✅ 仅6个存储写入（减少3个，Gas节省30%）
    
    Self::deposit_event(Event::DeceasedCreated(id, who));
    Ok(())
}
```

---

## 六、性能对比总结

| 方案 | 存储写入数 | Gas成本 | 实施难度 | 推荐优先级 |
|-----|----------|---------|---------|-----------|
| **当前实现** | 8次 | 100% | - | - |
| **Phase 1优化** | 5次 | 70% | ⭐ 简单 | ⭐⭐⭐⭐⭐ |
| **Phase 2优化** | 3次 | 50% | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐ |
| **Phase 3优化** | 3次 | 45% | ⭐⭐⭐⭐ 复杂 | ⭐⭐⭐ |

---

## 七、风险评估

| 风险项 | 影响 | 缓解措施 |
|-------|------|---------|
| 延迟初始化导致数据不一致 | 中 | 使用atomic标记，确保幂等性 |
| 迁移旧数据失败 | 高 | 充分测试，提供回滚方案 |
| 查询性能下降 | 低 | 仅影响低频操作，可接受 |
| Token去重失效 | 高 | ✅ 保持原子性，不受影响 |
| 押金锁定失败 | 高 | ✅ 保持原子性，不受影响 |

---

## 八、结论

### 推荐方案

**立即实施Phase 1优化**（2周内）：
- 删除3个低频索引
- Gas成本降低30%
- 无兼容性风险
- 保持Token去重和押金锁定的原子性

### 核心保证

✅ **Token去重机制完整性**：
- DeceasedIdByToken索引保持原子写入
- 创建前必须检查，创建后立即写入索引
- 不受延迟初始化影响

✅ **押金锁定安全性**：
- 10 USDT押金锁定保持原子性
- hold操作在主记录写入前完成
- 失败自动回滚，无资金风险

---

**文档状态**: ✅ 可实施  
**预期收益**: Gas成本降低30-50%  
**风险等级**: 低
