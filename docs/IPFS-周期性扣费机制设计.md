# IPFS周期性扣费机制 - 设计与优化方案

## 📊 当前设计分析

### 1. 两种自动调用机制

#### 机制A: Offchain Worker (OCW) - Pin请求处理

```rust
// pallets/stardust-ipfs/src/lib.rs:1884
fn offchain_worker(_n: BlockNumberFor<T>) {
    // 每个区块自动运行（由Substrate框架调用）
    
    // 1. 读取ipfs-cluster配置
    let endpoint = sp_io::offchain::local_storage_get(...);
    let token = sp_io::offchain::local_storage_get(...);
    
    // 2. 扫描待处理的Pin请求
    if let Some((cid_hash, (payer, replicas, deceased_id, size, price))) =
        <PendingPins<T>>::iter().next()
    {
        // 3. 选择运营者
        let selected = Self::select_operators_by_weight(replicas, &[]);
        
        // 4. 发送HTTP请求到ipfs-cluster
        // POST /pins { cid, allocations: [operator_peer_ids] }
        
        // 5. 提交上链交易（unsigned with signed payload）
        // mark_pinned() 或 mark_pin_failed()
    }
}
```

**特点**：
- ✅ **自动触发**：每个区块运行一次
- ✅ **无需支付Gas**：OCW不消耗链上资源（HTTP调用在链外）
- ✅ **异步处理**：不阻塞区块生产
- ⚠️ **不处理扣费**：仅处理Pin请求，不涉及周期性计费

---

#### 机制B: charge_due - 周期性扣费

```rust
// pallets/stardust-ipfs/src/lib.rs:1345
#[pallet::call_index(11)]
pub fn charge_due(origin: OriginFor<T>, limit: u32) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;  // ❌ 需要治理权限
    ensure!(!BillingPaused::<T>::get(), Error::<T>::BadStatus);
    
    let now = <frame_system::Pallet<T>>::block_number();
    let mut left = core::cmp::min(limit, MaxChargePerBlock::<T>::get());
    
    // 遍历到期队列，扣费
    while left > 0 {
        if let Some(cid_hash) = DueQueue::<T>::iter_keys().next() {
            let due_block = DueQueue::<T>::get(&cid_hash);
            if due_block <= now {
                // 执行扣费逻辑
                Self::try_charge_one(&cid_hash)?;
                left -= 1;
            }
        } else {
            break;
        }
    }
    
    Ok(())
}
```

**特点**：
- ❌ **手动调用**：需要治理账户主动调用
- ❌ **需要支付Gas**：调用者支付交易费用
- ⚠️ **可能延迟**：如果没人调用，扣费会延迟
- ✅ **批量处理**：支持limit参数，一次处理多个

---

## 🎯 核心问题

### 问题1: 谁来调用 charge_due？

**现状**：需要治理账户手动调用

**问题**：
- ❌ 依赖人工操作，可能遗忘
- ❌ 治理账户需要持续持有Gas费用
- ❌ 无法保证及时性（可能延迟数天）

---

### 问题2: 费用谁兜底？

**当前设计**：
```rust
// triple-charge机制（request_pin时预扣）
fn triple_charge_storage_fee(caller, subject_id, price) -> Result<ChargeSource> {
    // 1. 尝试从 IpfsPoolAccount 扣款（公共池）
    if Self::try_charge_from_pool(price).is_ok() {
        return Ok(ChargeSource::Pool);
    }
    
    // 2. 尝试从 SubjectFunding(deceased_id) 扣款
    if Self::try_charge_from_subject(subject_id, price).is_ok() {
        return Ok(ChargeSource::Subject);
    }
    
    // 3. 从 caller 扣款（兜底）
    Currency::transfer(&caller, &operator_escrow, price, KeepAlive)?;
    Ok(ChargeSource::Caller)
}
```

**问题**：
- ✅ **一次性扣费**：request_pin时预扣一次性费用
- ❌ **无周期性兜底**：后续月度扣费失败怎么办？
- ❌ **无宽限期**：余额不足立即失败

---

### 问题3: 费用不足如何处理？

**当前设计**：无明确机制

**可能后果**：
- CID被标记为"过期"
- 运营者停止Pin服务
- 用户数据丢失

---

## 🚀 优化方案

### 方案A: **Hooks自动触发 + 多层兜底**（推荐⭐）

#### 核心设计

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    /// 函数级详细中文注释：在区块结尾自动处理到期扣费
    /// 
    /// 设计思路：
    /// - 使用 on_finalize 而非 on_initialize，避免影响区块开始的权重计算
    /// - 限制每区块处理数量（MaxChargePerBlock），避免区块过载
    /// - 费用由系统自动处理，无需人工干预
    fn on_finalize(n: BlockNumberFor<T>) {
        // 1. 检查是否暂停
        if BillingPaused::<T>::get() {
            return;
        }
        
        // 2. 批量处理到期项（限制数量）
        let limit = MaxChargePerBlock::<T>::get(); // 默认: 10
        let mut processed = 0u32;
        
        for cid_hash in DueQueue::<T>::iter_keys() {
            if processed >= limit {
                break;
            }
            
            let due_block = DueQueue::<T>::get(&cid_hash);
            if due_block <= n {
                // 执行扣费（带兜底机制）
                let _ = Self::charge_with_fallback(&cid_hash);
                processed += 1;
            }
        }
        
        // 3. 记录统计
        ChargedThisBlock::<T>::put(processed);
    }
}
```

#### 多层兜底机制

```rust
/// 函数级详细中文注释：带兜底机制的扣费流程
/// 
/// 层级优先级：
/// 1. SubjectFunding (deceased资金账户) - 优先
/// 2. IpfsPoolAccount (公共池) - 第二优先
/// 3. OperatorEscrowAccount (运营者托管) - 垫付兜底
/// 4. 宽限期 (GracePeriod) - 最后防线
fn charge_with_fallback(cid_hash: &T::Hash) -> DispatchResult {
    let meta = PinMeta::<T>::get(cid_hash).ok_or(Error::<T>::CidNotFound)?;
    let (payer, _replicas, subject_id, _size, monthly_price) = 
        PendingPins::<T>::get(cid_hash).ok_or(Error::<T>::OrderNotFound)?;
    
    // 计算月度费用
    let charge_amount = monthly_price;
    let operator_escrow = T::OperatorEscrowAccount::get();
    
    // 尝试扣费（四层兜底）
    let charge_result = 
        // Layer 1: SubjectFunding (deceased资金账户)
        Self::try_charge_from_subject_funding(subject_id, charge_amount)
        .or_else(|_| {
            // Layer 2: IpfsPoolAccount (公共池)
            Self::try_charge_from_pool(charge_amount)
        })
        .or_else(|_| {
            // Layer 3: OperatorEscrow垫付（临时兜底）
            Self::try_charge_from_operator_escrow(charge_amount)
        });
    
    match charge_result {
        Ok(charge_source) => {
            // 扣费成功，更新下次扣费时间
            let next_due = <frame_system::Pallet<T>>::block_number()
                .saturating_add(T::MonthlyBillingPeriod::get());
            
            DueQueue::<T>::insert(cid_hash, next_due);
            
            // 记录扣费事件
            Self::deposit_event(Event::ChargeDueSucceeded {
                cid_hash: *cid_hash,
                amount: charge_amount,
                source: charge_source,
                next_due,
            });
            
            Ok(())
        }
        Err(_) => {
            // Layer 4: 进入宽限期（Grace Period）
            Self::enter_grace_period(cid_hash)
        }
    }
}

/// 函数级详细中文注释：进入宽限期
/// 
/// 机制：
/// - 给予7天宽限期（约1,000,800区块）
/// - 期间CID仍然Pin，但标记为"欠费"
/// - 宽限期结束后自动unpin
fn enter_grace_period(cid_hash: &T::Hash) -> DispatchResult {
    let grace_end = <frame_system::Pallet<T>>::block_number()
        .saturating_add(T::GracePeriodBlocks::get()); // 默认: 1,000,800 blocks ≈ 7天
    
    // 标记为宽限期
    GracePeriodQueue::<T>::insert(cid_hash, grace_end);
    
    // 更新状态：Pinned → Degraded (欠费)
    PinStateOf::<T>::insert(cid_hash, 3u8); // 3 = Degraded
    
    // 发送警告事件
    Self::deposit_event(Event::GracePeriodStarted {
        cid_hash: *cid_hash,
        grace_end,
        reason: b"insufficient_balance".to_vec(),
    });
    
    Ok(())
}

/// 函数级详细中文注释：处理宽限期到期项
/// 
/// 在 on_finalize 中调用，自动unpin到期项
fn process_grace_period_expired(n: BlockNumberFor<T>) {
    let limit = 5u32; // 每区块最多处理5个宽限期到期
    let mut processed = 0u32;
    
    for (cid_hash, grace_end) in GracePeriodQueue::<T>::iter() {
        if processed >= limit {
            break;
        }
        
        if grace_end <= n {
            // 宽限期已过，自动unpin
            let _ = Self::auto_unpin(&cid_hash);
            GracePeriodQueue::<T>::remove(&cid_hash);
            processed += 1;
            
            Self::deposit_event(Event::AutoUnpinned {
                cid_hash,
                reason: b"grace_period_expired".to_vec(),
            });
        }
    }
}
```

#### 新增存储

```rust
/// 每区块最大扣费数量（防止区块过载）
#[pallet::storage]
pub type MaxChargePerBlock<T: Config> = StorageValue<_, u32, ValueQuery>; // 默认: 10

/// 本区块已处理的扣费数量（统计用）
#[pallet::storage]
pub type ChargedThisBlock<T: Config> = StorageValue<_, u32, ValueQuery>;

/// 宽限期队列：cid_hash -> 宽限期结束区块号
#[pallet::storage]
pub type GracePeriodQueue<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    BlockNumberFor<T>,
    OptionQuery,
>;

/// 月度计费周期（区块数）
#[pallet::constant]
type MonthlyBillingPeriod: Get<BlockNumberFor<Self>>; // 默认: 403,200 blocks ≈ 28天

/// 宽限期（区块数）
#[pallet::constant]
type GracePeriodBlocks: Get<BlockNumberFor<Self>>; // 默认: 1,000,800 blocks ≈ 7天
```

#### 新增事件

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    /// 扣费成功
    ChargeDueSucceeded {
        cid_hash: T::Hash,
        amount: BalanceOf<T>,
        source: ChargeSource, // Pool | SubjectFunding | OperatorEscrow
        next_due: BlockNumberFor<T>,
    },
    
    /// 进入宽限期
    GracePeriodStarted {
        cid_hash: T::Hash,
        grace_end: BlockNumberFor<T>,
        reason: Vec<u8>,
    },
    
    /// 自动unpin（宽限期到期）
    AutoUnpinned {
        cid_hash: T::Hash,
        reason: Vec<u8>,
    },
    
    /// 运营者托管账户垫付（需要后续补偿）
    OperatorEscrowAdvanced {
        cid_hash: T::Hash,
        amount: BalanceOf<T>,
        subject_id: u64,
    },
}

/// 扣费来源
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum ChargeSource {
    Pool,              // IpfsPoolAccount
    SubjectFunding,    // SubjectFunding(deceased_id)
    OperatorEscrow,    // OperatorEscrowAccount垫付
}
```

---

### 方案B: **OCW定期触发 + 无Gas费用**

#### 设计思路

```rust
fn offchain_worker(n: BlockNumberFor<T>) {
    // 1. 每100个区块检查一次（避免每区块都运行）
    if n % 100u32.into() != 0u32.into() {
        return;
    }
    
    // 2. 扫描到期队列
    let due_items = Self::scan_due_queue(10); // 最多10个
    
    // 3. 对每个到期项，提交 unsigned transaction
    for (cid_hash, due_block) in due_items {
        if due_block <= n {
            // 提交unsigned tx: charge_due_single(cid_hash)
            let call = Call::charge_due_single { cid_hash };
            let _ = SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into());
        }
    }
}

/// 单个CID扣费（由OCW unsigned tx调用）
#[pallet::call_index(12)]
#[pallet::weight(10_000)]
pub fn charge_due_single(
    origin: OriginFor<T>,
    cid_hash: T::Hash,
) -> DispatchResult {
    ensure_none(origin)?; // 仅允许unsigned
    
    // 验证签名（使用OCW KeyType）
    // ... ValidateUnsigned 验证 ...
    
    // 执行扣费
    Self::charge_with_fallback(&cid_hash)?;
    
    Ok(())
}
```

**优点**：
- ✅ 无需治理账户
- ✅ 无需支付Gas（unsigned tx）
- ✅ 定期自动触发

**缺点**：
- ⚠️ 实现复杂（需要ValidateUnsigned）
- ⚠️ 需要OCW key配置

---

## 📊 方案对比

| 维度 | 现状 | 方案A (Hooks) | 方案B (OCW) |
|-----|------|--------------|------------|
| **自动化** | ❌ 手动 | ✅✅ 全自动 | ✅✅ 全自动 |
| **Gas费用** | ❌ 需要 | ⚠️ 链上消耗 | ✅ 无Gas |
| **实时性** | ❌ 延迟 | ✅✅ 每区块 | ✅ 定期 |
| **实现复杂度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **权重管理** | 无 | ⚠️ 需要限制 | ✅ OCW无限制 |
| **兜底机制** | ❌ 无 | ✅✅ 四层 | ✅✅ 四层 |
| **宽限期** | ❌ 无 | ✅✅ 7天 | ✅✅ 7天 |

---

## 🎯 推荐方案：**方案A (Hooks + 多层兜底)**

### 理由

1. **完全自动化**
   - 无需人工干预
   - 无需治理账户持续持有Gas
   - 保证扣费及时性

2. **四层兜底机制**
   - Layer 1: SubjectFunding（优先）
   - Layer 2: IpfsPoolAccount（公共补贴）
   - Layer 3: OperatorEscrow（临时垫付）
   - Layer 4: GracePeriod（7天宽限）

3. **用户友好**
   - 7天宽限期，用户有充足时间补充余额
   - 明确的Event通知（前端可监听）
   - 避免数据突然丢失

4. **权重可控**
   - MaxChargePerBlock限制（默认10个/区块）
   - 避免区块过载
   - 可治理调整

5. **运营友好**
   - OperatorEscrow垫付机制，保证服务连续性
   - 后续可从deceased补偿运营者
   - 统计数据完整（ChargedThisBlock）

---

## 🚀 实施方案

### Phase 1: 添加存储和常量（Week 2 Day 1上午）

```rust
// 1. 新增存储
pub type MaxChargePerBlock<T> = StorageValue<_, u32, ValueQuery>;
pub type ChargedThisBlock<T> = StorageValue<_, u32, ValueQuery>;
pub type GracePeriodQueue<T> = StorageMap<...>;

// 2. 新增常量
#[pallet::constant]
type MonthlyBillingPeriod: Get<BlockNumberFor<Self>>; // 403,200 blocks

#[pallet::constant]
type GracePeriodBlocks: Get<BlockNumberFor<Self>>; // 1,000,800 blocks

// 3. 新增事件
pub enum Event<T> {
    ChargeDueSucceeded { ... },
    GracePeriodStarted { ... },
    AutoUnpinned { ... },
    OperatorEscrowAdvanced { ... },
}
```

### Phase 2: 实现扣费逻辑（Week 2 Day 1下午）

```rust
// 1. charge_with_fallback
fn charge_with_fallback(cid_hash: &T::Hash) -> DispatchResult { ... }

// 2. enter_grace_period
fn enter_grace_period(cid_hash: &T::Hash) -> DispatchResult { ... }

// 3. process_grace_period_expired
fn process_grace_period_expired(n: BlockNumberFor<T>) { ... }

// 4. try_charge_from_operator_escrow
fn try_charge_from_operator_escrow(amount: BalanceOf<T>) -> DispatchResult { ... }
```

### Phase 3: 集成Hooks（Week 2 Day 2上午）

```rust
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_finalize(n: BlockNumberFor<T>) {
        // 1. 处理到期扣费
        let limit = MaxChargePerBlock::<T>::get();
        let mut processed = 0u32;
        
        for cid_hash in DueQueue::<T>::iter_keys() {
            if processed >= limit { break; }
            let due_block = DueQueue::<T>::get(&cid_hash);
            if due_block <= n {
                let _ = Self::charge_with_fallback(&cid_hash);
                processed += 1;
            }
        }
        
        ChargedThisBlock::<T>::put(processed);
        
        // 2. 处理宽限期到期
        Self::process_grace_period_expired(n);
    }
}
```

### Phase 4: Runtime集成（Week 2 Day 2下午）

```rust
// runtime/src/lib.rs

parameter_types! {
    pub const MonthlyBillingPeriod: BlockNumber = 403_200; // 28天
    pub const GracePeriodBlocks: BlockNumber = 1_000_800;  // 7天
}

impl pallet_memo_ipfs::Config for Runtime {
    // ... 现有配置 ...
    
    type MonthlyBillingPeriod = MonthlyBillingPeriod;
    type GracePeriodBlocks = GracePeriodBlocks;
}
```

### Phase 5: 测试验证（Week 2 Day 3）

```rust
#[test]
fn test_auto_charge_with_fallback() {
    new_test_ext().execute_with(|| {
        // 1. 创建pin请求
        assert_ok!(MemoIpfs::request_pin_for_deceased(...));
        
        // 2. 前进到扣费时间
        run_to_block(403_200);
        
        // 3. 验证自动扣费
        assert_eq!(ChargedThisBlock::<Test>::get(), 1);
        
        // 4. 验证SubjectFunding余额减少
        let subject_funding = derive_subject_funding_account(0, deceased_id);
        assert_eq!(Balances::free_balance(&subject_funding), ...);
    });
}

#[test]
fn test_grace_period_mechanism() {
    new_test_ext().execute_with(|| {
        // 1. 创建pin，SubjectFunding余额不足
        assert_ok!(MemoIpfs::request_pin_for_deceased(...));
        
        // 2. 前进到扣费时间（余额不足）
        run_to_block(403_200);
        
        // 3. 验证进入宽限期
        assert!(GracePeriodQueue::<Test>::contains_key(&cid_hash));
        assert_eq!(PinStateOf::<Test>::get(&cid_hash), 3); // Degraded
        
        // 4. 前进到宽限期结束
        run_to_block(403_200 + 1_000_800);
        
        // 5. 验证自动unpin
        assert!(!PinMeta::<Test>::contains_key(&cid_hash));
        assert!(!GracePeriodQueue::<Test>::contains_key(&cid_hash));
    });
}
```

---

## ✅ 决策要点

### 核心问题回答

1. **如何按周期自动调用？**
   - ✅ 使用 `on_finalize` Hook
   - ✅ 每个区块自动检查到期项
   - ✅ MaxChargePerBlock限制处理数量（默认10个/区块）

2. **谁来调用？**
   - ✅ Substrate框架自动调用Hook
   - ✅ 无需人工干预
   - ✅ 无需治理账户

3. **费用谁兜底？**
   - ✅ Layer 1: SubjectFunding（deceased资金账户，优先）
   - ✅ Layer 2: IpfsPoolAccount（公共池，补贴）
   - ✅ Layer 3: OperatorEscrowAccount（运营者垫付，临时）
   - ✅ Layer 4: GracePeriod（7天宽限，最后防线）

4. **费用不足如何处理？**
   - ✅ 进入7天宽限期
   - ✅ CID标记为"Degraded"（欠费）
   - ✅ Event通知用户补充余额
   - ✅ 宽限期结束自动unpin

---

## 📝 配置示例

### runtime/src/lib.rs

```rust
parameter_types! {
    // 月度计费周期: 28天 = 403,200区块（6秒/区块）
    pub const MonthlyBillingPeriod: BlockNumber = 403_200;
    
    // 宽限期: 7天 = 1,000,800区块
    pub const GracePeriodBlocks: BlockNumber = 1_000_800;
    
    // 每区块最大扣费数量（防止区块过载）
    pub const MaxChargePerBlock: u32 = 10;
}

impl pallet_memo_ipfs::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    // ... 其他配置 ...
    
    // ✅ 新增：计费配置
    type MonthlyBillingPeriod = MonthlyBillingPeriod;
    type GracePeriodBlocks = GracePeriodBlocks;
}

// 在genesis config中初始化
impl pallet_memo_ipfs::GenesisConfig<Runtime> {
    pub fn default() -> Self {
        Self {
            max_charge_per_block: 10,
            // ...
        }
    }
}
```

---

## 🎯 总结

### 合理性分析

| 维度 | 评分 | 说明 |
|-----|------|------|
| **自动化** | ⭐⭐⭐⭐⭐ | 完全自动，无需人工干预 |
| **可靠性** | ⭐⭐⭐⭐⭐ | 四层兜底，保证服务连续性 |
| **用户友好** | ⭐⭐⭐⭐⭐ | 7天宽限期，Event通知 |
| **性能** | ⭐⭐⭐⭐ | 限制每区块处理数量 |
| **实现复杂度** | ⭐⭐⭐ | 中等（2天实现） |
| **安全性** | ⭐⭐⭐⭐⭐ | 权重限制，防止攻击 |

### 实施建议

- **时间**：Phase 4 Week 2 实施（2-3天）
- **优先级**：高（解决核心业务逻辑）
- **风险**：低（纯增量设计）
- **测试**：完整单元测试 + 集成测试

---

**推荐立即实施方案A（Hooks + 多层兜底），彻底解决周期性扣费问题！** 🚀

