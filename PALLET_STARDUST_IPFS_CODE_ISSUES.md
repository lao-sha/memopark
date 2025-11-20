# Pallet Stardust IPFS 代码审查 - 具体问题清单

## 概览

本文档详细列出了代码审查中发现的具体问题、代码位置和修复建议。

---

## P0 - 关键问题（必须修复）

### 1. 配额系统未实现 ⚠️ 高优先级

**问题描述**:
- README.md 文档提到"每个deceased每月100 DUST免费配额"
- Config中定义了`MonthlyPublicFeeQuota`常量
- 但代码中**完全没有配额检查和重置逻辑**

**证据**:
```rust
// Config中定义了配额（lib.rs:363）
type MonthlyPublicFeeQuota: Get<BalanceOf<Self>>;

// README.md中描述的存储项（但实际代码中不存在）
pub type SubjectQuotaUsed<T> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    SubjectType,
    Blake2_128Concat,
    u64,
    (T::Balance, BlockNumberFor<T>),
    ValueQuery,
>;
```

**影响**:
- 用户无法使用免费配额
- 文档与实现严重不一致
- 可能导致用户投诉

**修复建议**:

1. 添加配额存储项:
```rust
/// 主体配额使用记录
/// Key1: SubjectType（Deceased/Grave等）
/// Key2: subject_id
/// Value: (已使用配额, 配额重置时间)
#[pallet::storage]
pub type SubjectQuotaUsed<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    SubjectType,
    Blake2_128Concat,
    u64,
    (BalanceOf<T>, BlockNumberFor<T>),
    ValueQuery,
>;
```

2. 在`request_pin_for_deceased`中添加配额检查（第2610行之前）:
```rust
// 6. 检查并扣除免费配额
let current_block = <frame_system::Pallet<T>>::block_number();
let (mut used_quota, mut reset_at) = SubjectQuotaUsed::<T>::get(
    SubjectType::Deceased,
    subject_id,
);

// 检查是否需要重置配额
if current_block >= reset_at {
    used_quota = BalanceOf::<T>::default();
    reset_at = current_block + T::QuotaResetPeriod::get();
}

let monthly_quota = T::MonthlyPublicFeeQuota::get();
let available_quota = monthly_quota.saturating_sub(used_quota);

// 优先使用免费配额
let (adjusted_fee, quota_used) = if available_quota >= adjusted_fee {
    // 配额充足，完全免费
    (BalanceOf::<T>::default(), adjusted_fee)
} else if available_quota > BalanceOf::<T>::default() {
    // 配额部分覆盖
    (adjusted_fee - available_quota, available_quota)
} else {
    // 配额已用完
    (adjusted_fee, BalanceOf::<T>::default())
};

// 更新配额使用记录
if quota_used > BalanceOf::<T>::default() {
    SubjectQuotaUsed::<T>::insert(
        SubjectType::Deceased,
        subject_id,
        (used_quota.saturating_add(quota_used), reset_at),
    );
}
```

3. 在事件中记录配额使用情况:
```rust
Self::deposit_event(Event::QuotaUsed {
    subject_type: SubjectType::Deceased,
    subject_id,
    amount: quota_used,
    remaining: monthly_quota.saturating_sub(used_quota.saturating_add(quota_used)),
});
```

---

### 2. 宽限期Unpin逻辑缺失 ⚠️ 高优先级

**问题描述**:
- `four_layer_charge`能正确识别宽限期过期（lib.rs:2322）
- 但**没有自动Unpin的机制**
- 宽限期过期后，Pin继续占用运营者存储空间

**证据**:
```rust
// lib.rs:2318-2325
GraceStatus::InGrace { expires_at, .. } => {
    let current_block = <frame_system::Pallet<T>>::block_number();
    if current_block > *expires_at {
        Err(Error::<T>::GraceExpired)  // 仅返回错误，不执行Unpin
    } else {
        Ok(ChargeResult::EnterGrace { expires_at: *expires_at })
    }
},
```

**影响**:
- 存储资源浪费
- 运营者无法及时清理无效Pin
- 可能导致存储容量耗尽

**修复建议**:

1. 在OCW中添加定期清理逻辑:
```rust
impl<T: Config> Pallet<T> {
    /// OCW定期清理过期Pin
    pub fn cleanup_expired_pins() {
        let current_block = <frame_system::Pallet<T>>::block_number();
        
        // 遍历所有BillingTask，检查宽限期状态
        for (next_billing, cid_hash, task) in BillingQueue::<T>::iter() {
            if let GraceStatus::InGrace { expires_at, .. } = task.grace_status {
                if current_block > expires_at {
                    // 宽限期已过期，执行Unpin
                    let _ = Self::do_unpin_internal(
                        &cid_hash,
                        UnpinReason::InsufficientFunds,
                    );
                }
            }
        }
    }
    
    /// 内部Unpin实现（不需要权限检查）
    fn do_unpin_internal(
        cid_hash: &T::Hash,
        reason: UnpinReason,
    ) -> DispatchResult {
        // 1. 删除所有相关存储
        PinMeta::<T>::remove(cid_hash);
        PinStateOf::<T>::remove(cid_hash);
        PendingPins::<T>::remove(cid_hash);
        CidToSubject::<T>::remove(cid_hash);
        CidTier::<T>::remove(cid_hash);
        CidRegistry::<T>::remove(cid_hash);
        
        // 2. 从BillingQueue移除
        for (block, _, _) in BillingQueue::<T>::iter() {
            BillingQueue::<T>::remove(block, cid_hash);
        }
        
        // 3. 从HealthCheckQueue移除
        for (block, _, _) in HealthCheckQueue::<T>::iter() {
            HealthCheckQueue::<T>::remove(block, cid_hash);
        }
        
        // 4. 清理运营者分配
        if let Some(operators) = PinAssignments::<T>::take(cid_hash) {
            for operator in operators.iter() {
                // 更新运营者统计
                Self::update_operator_pin_stats(operator, 0, 1)?;
            }
        }
        
        // 5. 清理分层分配
        LayeredPinAssignments::<T>::remove(cid_hash);
        
        // 6. 发出事件
        Self::deposit_event(Event::PinUnpinned {
            cid_hash: *cid_hash,
            reason,
        });
        
        Ok(())
    }
}
```

2. 在`offchain_worker`中调用清理函数（每100个区块清理一次）:
```rust
fn offchain_worker(n: BlockNumberFor<T>) {
    // 每100个区块执行一次清理
    if n % 100u32.into() == 0u32.into() {
        Self::cleanup_expired_pins();
    }
    
    // ... 其他OCW逻辑 ...
}
```

---

### 3. 运营者容量跟踪缺失 ⚠️ 高优先级

**问题描述**:
- `OperatorInfo`只记录声明容量`capacity_gib`（lib.rs:462）
- **没有记录已用容量**
- 无法防止运营者超卖

**证据**:
```rust
// lib.rs:458-469
pub struct OperatorInfo<T: Config> {
    pub peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
    pub capacity_gib: u32,  // 声明容量
    pub endpoint_hash: T::Hash,
    pub cert_fingerprint: Option<T::Hash>,
    pub status: u8,
    pub registered_at: BlockNumberFor<T>,
    pub layer: OperatorLayer,
    pub priority: u8,
    // ❌ 缺少：pub used_capacity_bytes: u64,
}
```

**影响**:
- 运营者可能接受超过容量的Pin请求
- 导致Pin失败率上升
- 影响整体服务质量

**修复建议**:

1. 扩展`OperatorInfo`结构体:
```rust
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OperatorInfo<T: Config> {
    pub peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
    pub capacity_gib: u32,
    pub endpoint_hash: T::Hash,
    pub cert_fingerprint: Option<T::Hash>,
    pub status: u8,
    pub registered_at: BlockNumberFor<T>,
    pub layer: OperatorLayer,
    pub priority: u8,
    pub used_capacity_bytes: u64,  // 新增：已用容量（字节）
}
```

2. 在Pin成功后更新容量:
```rust
// 在 mark_pinned 函数中添加（lib.rs:3098附近）
pub fn mark_pinned(
    origin: OriginFor<T>,
    cid_hash: T::Hash,
    actual_size: Option<u64>,
) -> DispatchResult {
    let operator = ensure_signed(origin)?;
    
    // ... 现有逻辑 ...
    
    // 更新运营者已用容量
    if let Some(size) = actual_size {
        Operators::<T>::mutate(&operator, |info_opt| {
            if let Some(info) = info_opt {
                info.used_capacity_bytes = info.used_capacity_bytes.saturating_add(size);
                
                // 检查是否超过容量限制
                let capacity_bytes = (info.capacity_gib as u64) * 1024 * 1024 * 1024;
                if info.used_capacity_bytes > capacity_bytes {
                    Self::deposit_event(Event::OperatorCapacityExceeded {
                        operator: operator.clone(),
                        used: info.used_capacity_bytes,
                        total: capacity_bytes,
                    });
                }
            }
        });
        
        // 更新Pin元信息的实际大小
        PinMeta::<T>::mutate(&cid_hash, |meta_opt| {
            if let Some(meta) = meta_opt {
                meta.size = size;
            }
        });
    }
    
    Ok(())
}
```

3. 在运营者选择算法中考虑容量使用率（lib.rs:2050附近）:
```rust
pub fn select_operators_by_layer(
    subject_type: SubjectType,
    tier: PinTier,
) -> Result<LayeredOperatorSelection<T::AccountId>, Error<T>> {
    // ... 现有逻辑 ...
    
    // 8. 按容量使用率排序（使用率低的优先）
    let mut sorted_core = active_core.into_iter()
        .filter_map(|(op, info)| {
            let capacity_bytes = (info.capacity_gib as u64) * 1024 * 1024 * 1024;
            let usage_percent = if capacity_bytes > 0 {
                (info.used_capacity_bytes * 100) / capacity_bytes
            } else {
                100
            };
            
            // 只选择容量使用率 < 90% 的运营者
            if usage_percent < 90 {
                Some((op, info, usage_percent))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    
    // 按使用率升序排序
    sorted_core.sort_by_key(|(_, _, usage)| *usage);
    
    // ... 选择逻辑 ...
}
```

---

## P1 - 重要问题（上线后3个月内修复）

### 4. 缺少反向索引 ⚠️ 性能问题

**问题描述**:
- 无法高效查询"某个deceased的所有Pin"
- 无法高效查询"某个运营者的所有Pin"
- 前端Dashboard需要遍历所有Pin

**影响**:
- RPC查询性能差
- 前端加载慢
- 无法实现分页

**修复建议**:

1. 添加反向索引存储项:
```rust
/// Deceased维度的Pin索引
/// Key1: subject_id（deceased_id）
/// Key2: cid_hash
/// Value: ()（仅作为集合使用）
#[pallet::storage]
pub type DeceasedPins<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    u64,                    // deceased_id
    Blake2_128Concat,
    T::Hash,                // cid_hash
    (),
    ValueQuery,
>;

/// 运营者维度的Pin索引
/// Key1: operator
/// Key2: cid_hash
/// Value: ()
#[pallet::storage]
pub type OperatorPins<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::AccountId,           // operator
    Blake2_128Concat,
    T::Hash,                // cid_hash
    (),
    ValueQuery,
>;
```

2. 在Pin请求时更新索引:
```rust
// 在 request_pin_for_deceased 中添加（第2770行附近）
DeceasedPins::<T>::insert(subject_id, &cid_hash, ());

// 在分配运营者时更新（第2648-2677行）
for operator in selection.core_operators.iter() {
    OperatorPins::<T>::insert(operator, &cid_hash, ());
    // ... 其他逻辑 ...
}
```

3. 在Unpin时清理索引:
```rust
fn do_unpin_internal(cid_hash: &T::Hash, reason: UnpinReason) -> DispatchResult {
    // 清理deceased索引
    if let Some((_, subject_id)) = PinSubjectOf::<T>::take(cid_hash) {
        DeceasedPins::<T>::remove(subject_id, cid_hash);
    }
    
    // 清理运营者索引
    if let Some(operators) = PinAssignments::<T>::take(cid_hash) {
        for operator in operators.iter() {
            OperatorPins::<T>::remove(operator, cid_hash);
        }
    }
    
    // ... 其他清理逻辑 ...
}
```

4. 提供RPC查询接口:
```rust
// 在 impl<T: Config> Pallet<T> 中添加
/// 查询deceased的所有Pin（分页）
pub fn get_deceased_pins(
    deceased_id: u64,
    offset: u32,
    limit: u32,
) -> Vec<(T::Hash, PinMetadata<BlockNumberFor<T>>)> {
    DeceasedPins::<T>::iter_prefix(deceased_id)
        .skip(offset as usize)
        .take(limit as usize)
        .filter_map(|(cid_hash, _)| {
            PinMeta::<T>::get(&cid_hash).map(|meta| (cid_hash, meta))
        })
        .collect()
}

/// 查询运营者的所有Pin（分页）
pub fn get_operator_pins(
    operator: T::AccountId,
    offset: u32,
    limit: u32,
) -> Vec<(T::Hash, PinMetadata<BlockNumberFor<T>>)> {
    OperatorPins::<T>::iter_prefix(&operator)
        .skip(offset as usize)
        .take(limit as usize)
        .filter_map(|(cid_hash, _)| {
            PinMeta::<T>::get(&cid_hash).map(|meta| (cid_hash, meta))
        })
        .collect()
}
```

---

### 5. OCW HTTP请求缺乏重试机制 ⚠️ 稳定性问题

**问题描述**:
- 当前HTTP请求失败直接返回错误（lib.rs:4469）
- 网络抖动可能导致误判
- 没有指数退避策略

**证据**:
```rust
// lib.rs:4461-4478
fn http_get_bytes(endpoint: &str, token: &Option<String>, path: &str) -> Option<Vec<u8>> {
    let url = alloc::format!("{}{}", endpoint, path);
    let mut req = http::Request::get(&url);
    if let Some(t) = token.as_ref() {
        req = req.add_header("Authorization", &alloc::format!("Bearer {}", t));
    }
    let timeout = sp_io::offchain::timestamp()
        .add(sp_runtime::offchain::Duration::from_millis(3_000));
    let pending = req.deadline(timeout).send().ok()?;
    let resp = pending.try_wait(timeout).ok()?.ok()?;  // ❌ 失败直接返回None
    let code: u16 = resp.code;
    if (200..300).contains(&code) {
        Some(resp.body().collect::<Vec<u8>>())
    } else {
        None
    }
}
```

**修复建议**:

```rust
/// 带重试的HTTP GET请求
fn http_get_bytes_with_retry(
    endpoint: &str,
    token: &Option<String>,
    path: &str,
    max_retries: u8,
) -> Option<Vec<u8>> {
    let mut retries = 0;
    let mut backoff_ms = 1000u64; // 初始1秒
    
    while retries < max_retries {
        let url = alloc::format!("{}{}", endpoint, path);
        let mut req = http::Request::get(&url);
        
        if let Some(t) = token.as_ref() {
            req = req.add_header("Authorization", &alloc::format!("Bearer {}", t));
        }
        
        // 超时时间随重试次数增加
        let timeout = sp_io::offchain::timestamp()
            .add(sp_runtime::offchain::Duration::from_millis(3_000 + backoff_ms));
        
        match req.deadline(timeout).send() {
            Ok(pending) => {
                match pending.try_wait(timeout) {
                    Ok(Ok(resp)) => {
                        let code: u16 = resp.code;
                        if (200..300).contains(&code) {
                            return Some(resp.body().collect::<Vec<u8>>());
                        } else if code >= 500 {
                            // 5xx错误可重试
                            retries += 1;
                        } else {
                            // 4xx错误不重试
                            return None;
                        }
                    },
                    _ => {
                        retries += 1;
                    }
                }
            },
            Err(_) => {
                retries += 1;
            }
        }
        
        // 指数退避
        if retries < max_retries {
            // OCW中不能sleep，但可以记录下次重试时间
            backoff_ms = backoff_ms.saturating_mul(2).min(30_000); // 最多30秒
        }
    }
    
    None
}
```

---

### 6. 分层存储记录不完整 ⚠️ 审计问题

**问题描述**:
- 虽然有`LayeredPinAssignments`存储项（lib.rs:2684）
- 但在OCW健康检查和费用分配时**未使用分层信息**
- 无法验证Core/Community运营者是否正确履行职责

**修复建议**:

1. 在费用分配时考虑Layer权重:
```rust
pub fn distribute_to_pin_operators(
    cid_hash: &T::Hash,
    total_amount: BalanceOf<T>,
) -> DispatchResult {
    // 使用分层分配信息
    let layered_assignment = LayeredPinAssignments::<T>::get(cid_hash)
        .ok_or(Error::<T>::NoOperatorsAssigned)?;
    
    let core_count = layered_assignment.core_operators.len();
    let community_count = layered_assignment.community_operators.len();
    
    if core_count + community_count == 0 {
        return Err(Error::<T>::NoOperatorsAssigned.into());
    }
    
    // Core Layer权重2x，Community Layer权重1x
    let total_weight = (core_count * 2 + community_count) as u128;
    
    // 分配给Core运营者（2x权重）
    for operator in layered_assignment.core_operators.iter() {
        let reward = total_amount.saturating_mul(2u32.into()) * (10000u32 / total_weight as u32).into() / 10000u32.into();
        OperatorRewards::<T>::mutate(operator, |balance| {
            *balance = balance.saturating_add(reward);
        });
    }
    
    // 分配给Community运营者（1x权重）
    for operator in layered_assignment.community_operators.iter() {
        let reward = total_amount * (10000u32 / total_weight as u32).into() / 10000u32.into();
        OperatorRewards::<T>::mutate(operator, |balance| {
            *balance = balance.saturating_add(reward);
        });
    }
    
    Ok(())
}
```

---

## P2 - 优化建议（长期）

### 7. 费用计算缺少基础费率常量

**问题描述**:
- 代码中估算文件大小的方式过于简化（lib.rs:2608）
- 没有明确的基础费率常量

**当前代码**:
```rust
// lib.rs:2608
let size_bytes = cid.len() as u64 * 1024; // ❌ 假设平均1KB/字符，不准确
```

**建议**:
```rust
// 在Config中添加
#[pallet::constant]
type BasePinCostPerGiB: Get<Self::Balance>;

// 在函数中使用
let base_cost_per_gib = T::BasePinCostPerGiB::get();
let size_gib = size_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
let base_fee = (base_cost_per_gib.saturated_into::<u128>() as f64 * size_gib) as u128;
```

---

### 8. 状态机使用u8而非枚举

**问题描述**:
- `PinStateOf`使用`u8`存储状态（lib.rs:425）
- 易出错，不类型安全

**建议**:
```rust
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq)]
pub enum PinState {
    Requested = 0,
    Pinning = 1,
    Pinned = 2,
    Degraded = 3,
    Failed = 4,
}

#[pallet::storage]
pub type PinStateOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    PinState,  // 使用枚举而非u8
    ValueQuery,
>;
```

---

## 总结

### 严重性分类

- **P0 (关键)**: 3个问题，必须在上线前修复
  1. 配额系统未实现
  2. 宽限期Unpin逻辑缺失
  3. 运营者容量跟踪缺失

- **P1 (重要)**: 3个问题，影响性能和稳定性
  4. 缺少反向索引
  5. OCW HTTP请求缺乏重试
  6. 分层存储记录不完整

- **P2 (优化)**: 2个问题，长期改进
  7. 费用计算缺少基础费率
  8. 状态机使用u8而非枚举

### 工作量估算

- P0修复: 约4-6个工作日
- P1修复: 约3-5个工作日
- P2优化: 约2-3个工作日

**总计**: 约9-14个工作日（1.5-2周）

---

**文档版本**: v1.0  
**创建日期**: 2025-11-18  
**审查人**: Cascade AI
