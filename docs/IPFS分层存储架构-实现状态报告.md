# IPFS分层存储架构 - 实现状态报告

> **文档版本**: v1.0  
> **创建时间**: 2025-10-26  
> **作者**: Stardust开发团队  
> **状态**: 📊 现状分析 + 🚧 待实施功能

---

## 📊 当前实现状态

### ✅ 已实现的功能（基础运营者管理）

#### 1. 运营者注册与管理

```rust
// ✅ 已实现
pub struct OperatorInfo<T: Config> {
    pub peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
    pub capacity_gib: u32,
    pub endpoint_hash: T::Hash,
    pub cert_fingerprint: Option<T::Hash>,
    pub status: u8, // 0=Active, 1=Suspended, 2=Banned
    pub registered_at: BlockNumberFor<T>,
}

// ✅ 已实现的 Extrinsics
- join_operator()         // 注册为运营者
- update_operator()       // 更新运营者信息
- leave_operator()        // 注销运营者
- pause_operator()        // 暂停服务
- resume_operator()       // 恢复服务
```

#### 2. 运营者监控

```rust
// ✅ 已实现
pub struct OperatorPinHealth<BlockNumber> {
    pub total_pins: u32,
    pub healthy_pins: u32,
    pub failed_pins: u32,
    pub last_check: BlockNumber,
    pub health_score: u8, // 0-100分
}

// ✅ 已实现的功能
- 健康度实时计算
- 容量使用监控
- Pin成功/失败统计
- 自动告警事件
```

#### 3. 智能运营者选择

```rust
// ✅ 已实现
fn select_operators_for_pin(replicas: u32) -> Result<Vec<T::AccountId>, Error<T>> {
    // 筛选：Active + 容量<80% + 非待注销
    // 排序：健康度优先、容量使用率次要
    // 选择：Top N
}
```

#### 4. 数据分层（PinTier）

```rust
// ✅ 已实现
pub enum PinTier {
    Critical,  // 关键数据：5副本
    Standard,  // 标准数据：3副本
    Temporary, // 临时数据：1副本
}
```

---

## 🚧 未实现的功能（Layer 1/Layer 2 分层架构）

### ❌ 缺失1：运营者层级分类

**当前状态**：
```rust
// ❌ 当前没有区分运营者层级
pub struct OperatorInfo<T: Config> {
    // ... 没有 layer 字段
}
```

**需要实现**：
```rust
/// 函数级详细中文注释：运营者层级（新增）
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum OperatorLayer {
    /// Layer 1：核心运营者（项目方）
    /// - 存储100%数据
    /// - 最高优先级
    /// - 最高信任度
    Core,
    
    /// Layer 2：社区运营者
    /// - 选择性存储数据
    /// - 获得链上奖励
    /// - 需要质押更多保证金
    Community,
    
    /// Layer 3：外部网络（Filecoin/Crust）
    /// - 通过桥接接入
    /// - 不直接注册为运营者
    External,
}

/// 函数级详细中文注释：扩展运营者信息，增加层级字段
pub struct OperatorInfo<T: Config> {
    pub peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
    pub capacity_gib: u32,
    pub endpoint_hash: T::Hash,
    pub cert_fingerprint: Option<T::Hash>,
    pub status: u8,
    pub registered_at: BlockNumberFor<T>,
    
    // ⭐ 新增字段
    pub layer: OperatorLayer, // 运营者层级
    pub priority: u8,         // 优先级（0-255，越小越优先）
}
```

---

### ❌ 缺失2：分层存储策略配置

**需要实现**：
```rust
/// 函数级详细中文注释：分层存储策略配置
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct StorageLayerConfig {
    /// Layer 1核心运营者副本数
    pub core_replicas: u32,
    
    /// Layer 2社区运营者副本数
    pub community_replicas: u32,
    
    /// 是否允许Layer 3外部网络
    pub allow_external: bool,
    
    /// 最低要求副本数（如果运营者不足时的降级阈值）
    pub min_total_replicas: u32,
}

/// 函数级详细中文注释：按数据类型和优先级配置分层策略
#[pallet::storage]
#[pallet::getter(fn storage_layer_config)]
pub type StorageLayerConfigs<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    (SubjectType, PinTier), // (数据类型, Pin层级)
    StorageLayerConfig,
    ValueQuery,
>;

impl Default for StorageLayerConfig {
    fn default() -> Self {
        Self {
            core_replicas: 3,        // Layer 1默认3副本
            community_replicas: 2,   // Layer 2默认2副本
            allow_external: false,   // 默认不使用外部网络
            min_total_replicas: 1,   // 最少1副本
        }
    }
}
```

**配置示例**：
```rust
// 证据数据：仅Layer 1，5副本
StorageLayerConfigs::insert(
    (SubjectType::Evidence, PinTier::Critical),
    StorageLayerConfig {
        core_replicas: 5,
        community_replicas: 0,
        allow_external: false,
        min_total_replicas: 3,
    }
);

// 逝者核心信息：Layer 1 + Layer 2
StorageLayerConfigs::insert(
    (SubjectType::Deceased, PinTier::Critical),
    StorageLayerConfig {
        core_replicas: 3,
        community_replicas: 2,
        allow_external: false,
        min_total_replicas: 2,
    }
);

// 供奉品：Layer 1 + Layer 2 + Layer 3
StorageLayerConfigs::insert(
    (SubjectType::Offerings, PinTier::Standard),
    StorageLayerConfig {
        core_replicas: 1,
        community_replicas: 1,
        allow_external: true,
        min_total_replicas: 1,
    }
);
```

---

### ❌ 缺失3：分层运营者选择算法

**需要实现**：
```rust
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：根据分层策略智能选择运营者
    /// 
    /// 参数：
    /// - subject_type: 数据类型（Deceased/Grave/Evidence等）
    /// - tier: Pin优先级（Critical/Standard/Temporary）
    /// 
    /// 返回：
    /// - Layer 1运营者列表
    /// - Layer 2运营者列表
    /// 
    /// 逻辑：
    /// 1. 获取该数据类型的分层配置
    /// 2. 从Layer 1运营者池中选择N个（按健康度排序）
    /// 3. 从Layer 2运营者池中选择M个（按健康度排序）
    /// 4. 如果运营者不足，自动降级（发出警告事件）
    pub fn select_operators_by_layer(
        subject_type: SubjectType,
        tier: PinTier,
    ) -> Result<LayeredOperatorSelection<T>, Error<T>> {
        // 1. 获取分层配置
        let config = StorageLayerConfigs::<T>::get((subject_type, tier));
        
        // 2. 获取所有可用的Layer 1运营者
        let mut core_operators: Vec<(T::AccountId, OperatorPinHealth<BlockNumberFor<T>>)> = 
            Operators::<T>::iter()
                .filter_map(|(operator, info)| {
                    if info.layer == OperatorLayer::Core 
                        && info.status == 0 // Active
                        && !PendingUnregistrations::<T>::contains_key(&operator)
                    {
                        let stats = OperatorPinStats::<T>::get(&operator);
                        Some((operator, stats))
                    } else {
                        None
                    }
                })
                .collect();
        
        // 3. 按健康度和优先级排序（健康度优先、优先级次要）
        core_operators.sort_by(|a, b| {
            let health_cmp = b.1.health_score.cmp(&a.1.health_score);
            if health_cmp == Ordering::Equal {
                let priority_a = Operators::<T>::get(&a.0).map(|i| i.priority).unwrap_or(255);
                let priority_b = Operators::<T>::get(&b.0).map(|i| i.priority).unwrap_or(255);
                priority_a.cmp(&priority_b)
            } else {
                health_cmp
            }
        });
        
        // 4. 选择Top N个Layer 1运营者
        let selected_core: Vec<T::AccountId> = core_operators
            .into_iter()
            .take(config.core_replicas as usize)
            .map(|(operator, _)| operator)
            .collect();
        
        // 5. 如果Layer 1运营者不足，发出警告
        if selected_core.len() < config.core_replicas as usize {
            Self::deposit_event(Event::CoreOperatorShortage {
                required: config.core_replicas,
                available: selected_core.len() as u32,
            });
        }
        
        // 6. 获取所有可用的Layer 2运营者
        let mut community_operators: Vec<(T::AccountId, OperatorPinHealth<BlockNumberFor<T>>)> = 
            Operators::<T>::iter()
                .filter_map(|(operator, info)| {
                    if info.layer == OperatorLayer::Community
                        && info.status == 0
                        && !PendingUnregistrations::<T>::contains_key(&operator)
                    {
                        let stats = OperatorPinStats::<T>::get(&operator);
                        // 检查容量使用率
                        let capacity_usage = Self::calculate_capacity_usage(&operator);
                        if capacity_usage < 80 {
                            Some((operator, stats))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();
        
        // 7. 排序Layer 2运营者
        community_operators.sort_by(|a, b| {
            b.1.health_score.cmp(&a.1.health_score)
        });
        
        // 8. 选择Top M个Layer 2运营者
        let selected_community: Vec<T::AccountId> = community_operators
            .into_iter()
            .take(config.community_replicas as usize)
            .map(|(operator, _)| operator)
            .collect();
        
        // 9. 如果Layer 2运营者不足，发出警告（但不影响系统运行）
        if selected_community.len() < config.community_replicas as usize {
            Self::deposit_event(Event::CommunityOperatorShortage {
                required: config.community_replicas,
                available: selected_community.len() as u32,
            });
        }
        
        // 10. 检查总副本数是否满足最低要求
        let total_selected = selected_core.len() + selected_community.len();
        ensure!(
            total_selected >= config.min_total_replicas as usize,
            Error::<T>::InsufficientOperators
        );
        
        Ok(LayeredOperatorSelection {
            core_operators: BoundedVec::try_from(selected_core)
                .map_err(|_| Error::<T>::TooManyOperators)?,
            community_operators: BoundedVec::try_from(selected_community)
                .map_err(|_| Error::<T>::TooManyOperators)?,
        })
    }
}

/// 函数级详细中文注释：分层运营者选择结果
#[derive(Clone, Encode, Decode, TypeInfo)]
pub struct LayeredOperatorSelection<T: Config> {
    /// Layer 1核心运营者
    pub core_operators: BoundedVec<T::AccountId, ConstU32<16>>,
    
    /// Layer 2社区运营者
    pub community_operators: BoundedVec<T::AccountId, ConstU32<16>>,
}
```

---

### ❌ 缺失4：分层存储记录

**需要实现**：
```rust
/// 函数级详细中文注释：CID的分层存储记录
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct LayeredPinAssignment<AccountId> {
    /// Layer 1运营者列表
    pub core_operators: BoundedVec<AccountId, ConstU32<8>>,
    
    /// Layer 2运营者列表
    pub community_operators: BoundedVec<AccountId, ConstU32<8>>,
    
    /// 是否使用了Layer 3（外部网络）
    pub external_used: bool,
    
    /// 外部网络类型（如 Filecoin, Crust）
    pub external_network: Option<BoundedVec<u8, ConstU32<32>>>,
}

/// 函数级详细中文注释：存储每个CID的分层Pin分配
#[pallet::storage]
#[pallet::getter(fn layered_pin_assignments)]
pub type LayeredPinAssignments<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash, // CID Hash
    LayeredPinAssignment<T::AccountId>,
    OptionQuery,
>;
```

---

### ❌ 缺失5：分层存储的新增事件

**需要实现**：
```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 已有事件 ...
    
    /// 函数级详细中文注释：核心运营者不足告警
    CoreOperatorShortage {
        required: u32,
        available: u32,
    },
    
    /// 函数级详细中文注释：社区运营者不足告警（非致命）
    CommunityOperatorShortage {
        required: u32,
        available: u32,
    },
    
    /// 函数级详细中文注释：分层Pin分配完成
    LayeredPinAssigned {
        cid_hash: T::Hash,
        core_operators: BoundedVec<T::AccountId, ConstU32<8>>,
        community_operators: BoundedVec<T::AccountId, ConstU32<8>>,
        external_used: bool,
    },
    
    /// 函数级详细中文注释：分层策略配置更新
    StorageLayerConfigUpdated {
        subject_type: SubjectType,
        tier: PinTier,
        config: StorageLayerConfig,
    },
}
```

---

### ❌ 缺失6：治理接口（配置分层策略）

**需要实现**：
```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    // ... 已有 extrinsics ...
    
    /// 函数级详细中文注释：治理更新分层存储策略
    /// 
    /// 参数：
    /// - origin: 必须是Root
    /// - subject_type: 数据类型
    /// - tier: Pin层级
    /// - config: 分层配置
    /// 
    /// 权限：Root only
    #[pallet::call_index(20)]
    #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
    pub fn set_storage_layer_config(
        origin: OriginFor<T>,
        subject_type: SubjectType,
        tier: PinTier,
        config: StorageLayerConfig,
    ) -> DispatchResult {
        ensure_root(origin)?;
        
        // 验证配置合理性
        ensure!(
            config.min_total_replicas > 0,
            Error::<T>::InvalidConfiguration
        );
        ensure!(
            config.core_replicas >= config.min_total_replicas || 
            config.core_replicas + config.community_replicas >= config.min_total_replicas,
            Error::<T>::InvalidConfiguration
        );
        
        // 更新配置
        StorageLayerConfigs::<T>::insert((subject_type, tier), config.clone());
        
        Self::deposit_event(Event::StorageLayerConfigUpdated {
            subject_type,
            tier,
            config,
        });
        
        Ok(())
    }
    
    /// 函数级详细中文注释：治理设置运营者层级
    /// 
    /// 参数：
    /// - origin: 必须是Root
    /// - operator: 运营者账户
    /// - layer: 新的层级
    /// - priority: 优先级（可选）
    /// 
    /// 权限：Root only
    #[pallet::call_index(21)]
    #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
    pub fn set_operator_layer(
        origin: OriginFor<T>,
        operator: T::AccountId,
        layer: OperatorLayer,
        priority: Option<u8>,
    ) -> DispatchResult {
        ensure_root(origin)?;
        
        // 检查运营者是否存在
        Operators::<T>::try_mutate(&operator, |info_opt| -> DispatchResult {
            let info = info_opt.as_mut().ok_or(Error::<T>::NotOperator)?;
            
            // 更新层级
            info.layer = layer.clone();
            
            // 更新优先级
            if let Some(p) = priority {
                info.priority = p;
            }
            
            Self::deposit_event(Event::OperatorLayerUpdated {
                operator: operator.clone(),
                layer,
                priority: info.priority,
            });
            
            Ok(())
        })
    }
}
```

---

### ❌ 缺失7：修改 `request_pin_for_deceased` 使用分层选择

**需要修改**：
```rust
#[pallet::call_index(0)]
#[pallet::weight(T::DbWeight::get().reads_writes(10, 10))]
pub fn request_pin_for_deceased(
    origin: OriginFor<T>,
    deceased_id: u64,
    cid: Vec<u8>,
    tier: Option<PinTier>,
) -> DispatchResult {
    let caller = ensure_signed(origin)?;
    
    // ... 前面的验证逻辑 ...
    
    // ⭐ 修改：使用分层运营者选择
    let selection = Self::select_operators_by_layer(
        SubjectType::Deceased,
        tier_to_use,
    )?;
    
    // 合并Layer 1和Layer 2运营者
    let mut all_operators = selection.core_operators.to_vec();
    all_operators.extend(selection.community_operators.to_vec());
    
    // 转换为BoundedVec
    let operators_bounded = BoundedVec::try_from(all_operators)
        .map_err(|_| Error::<T>::TooManyOperators)?;
    
    // 更新统计（分别统计Layer 1和Layer 2）
    for operator in selection.core_operators.iter() {
        Self::update_operator_pin_stats(operator, 1, 0)?;
        Self::check_operator_capacity_warning(operator);
        
        // 计算容量使用率
        let capacity_percent = Self::calculate_capacity_usage(operator);
        
        Self::deposit_event(Event::PinAssignedToOperator {
            operator: operator.clone(),
            cid_hash,
            current_pins: OperatorPinStats::<T>::get(operator).total_pins,
            capacity_usage_percent: capacity_percent,
        });
    }
    
    for operator in selection.community_operators.iter() {
        Self::update_operator_pin_stats(operator, 1, 0)?;
        Self::check_operator_capacity_warning(operator);
        
        let capacity_percent = Self::calculate_capacity_usage(operator);
        
        Self::deposit_event(Event::PinAssignedToOperator {
            operator: operator.clone(),
            cid_hash,
            current_pins: OperatorPinStats::<T>::get(operator).total_pins,
            capacity_usage_percent: capacity_percent,
        });
    }
    
    // ⭐ 新增：记录分层Pin分配
    LayeredPinAssignments::<T>::insert(
        &cid_hash,
        LayeredPinAssignment {
            core_operators: selection.core_operators.clone(),
            community_operators: selection.community_operators.clone(),
            external_used: false, // 暂时不支持Layer 3
            external_network: None,
        },
    );
    
    // 发出分层Pin分配事件
    Self::deposit_event(Event::LayeredPinAssigned {
        cid_hash,
        core_operators: selection.core_operators,
        community_operators: selection.community_operators,
        external_used: false,
    });
    
    // ... 后续逻辑 ...
}
```

---

## 📈 实施优先级

### P0（必需，立即实施）

**预计工作量**：3-5天

| 任务 | 工作量 | 说明 |
|------|--------|------|
| ✅ 1. 添加 `OperatorLayer` 枚举 | 0.5天 | 定义 Core/Community/External |
| ✅ 2. 扩展 `OperatorInfo` 结构 | 0.5天 | 添加 layer 和 priority 字段 |
| ✅ 3. 实现 `StorageLayerConfig` | 1天 | 定义分层策略配置 |
| ✅ 4. 实现 `select_operators_by_layer()` | 2天 | 核心分层选择算法 |
| ✅ 5. 修改 `request_pin_for_deceased()` | 1天 | 集成分层选择 |

**交付物**：
- ✅ Layer 1/Layer 2运营者分类
- ✅ 智能分层运营者选择
- ✅ 分层Pin分配记录
- ✅ 编译通过，无错误

---

### P1（推荐，短期实施）

**预计工作量**：2-3天

| 任务 | 工作量 | 说明 |
|------|--------|------|
| ⏳ 6. 治理接口 `set_storage_layer_config()` | 0.5天 | 动态调整分层策略 |
| ⏳ 7. 治理接口 `set_operator_layer()` | 0.5天 | 手动调整运营者层级 |
| ⏳ 8. 分层统计和监控 | 1天 | Layer 1/2分别统计 |
| ⏳ 9. RPC接口扩展 | 1天 | 返回分层信息 |

**交付物**：
- ⏳ 治理可动态调整分层策略
- ⏳ 分层统计数据
- ⏳ 前端可查询分层信息

---

### P2（可选，长期规划）

**预计工作量**：4-6周

| 任务 | 工作量 | 说明 |
|------|--------|------|
| ⏳ 10. Layer 3外部网络集成（Filecoin） | 2周 | 跨链桥接 |
| ⏳ 11. Layer 3外部网络集成（Crust） | 2周 | 跨链桥接 |
| ⏳ 12. 自动化迁移机制 | 1周 | Layer 1/2之间自动迁移 |
| ⏳ 13. 成本优化算法 | 1周 | 智能选择最优存储层 |

---

## 🎯 实施建议

### 立即执行（今天开始）

**目标**：完成P0任务，实现Layer 1/Layer 2基础架构

**步骤**：

1. **创建新类型（1小时）**
   - 在 `pallets/stardust-ipfs/src/types.rs` 添加 `OperatorLayer`
   - 在 `pallets/stardust-ipfs/src/types.rs` 添加 `StorageLayerConfig`
   - 在 `pallets/stardust-ipfs/src/types.rs` 添加 `LayeredPinAssignment`
   - 在 `pallets/stardust-ipfs/src/types.rs` 添加 `LayeredOperatorSelection`

2. **修改存储结构（2小时）**
   - 在 `pallets/stardust-ipfs/src/lib.rs` 扩展 `OperatorInfo`
   - 添加 `StorageLayerConfigs` 存储
   - 添加 `LayeredPinAssignments` 存储

3. **实现核心算法（1天）**
   - 实现 `select_operators_by_layer()`
   - 添加分层统计辅助函数

4. **集成到现有流程（1天）**
   - 修改 `request_pin_for_deceased()`
   - 修改 `pin_cid_for_grave()`
   - 添加新的事件

5. **测试验证（1天）**
   - 编译验证
   - 单元测试
   - 集成测试

---

### 数据迁移策略

**现有运营者的层级分配**：

```rust
// 在 GenesisConfig 或 Runtime Migration 中执行
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：迁移现有运营者到Layer 1（默认）
    pub fn migrate_existing_operators() -> Weight {
        let mut weight = Weight::zero();
        
        Operators::<T>::translate(|_operator, old_info: OldOperatorInfo<T>| {
            weight = weight.saturating_add(T::DbWeight::get().reads_writes(1, 1));
            
            Some(OperatorInfo {
                peer_id: old_info.peer_id,
                capacity_gib: old_info.capacity_gib,
                endpoint_hash: old_info.endpoint_hash,
                cert_fingerprint: old_info.cert_fingerprint,
                status: old_info.status,
                registered_at: old_info.registered_at,
                
                // ⭐ 默认分配到Layer 1（核心）
                layer: OperatorLayer::Core,
                priority: 128, // 中等优先级
            })
        });
        
        weight
    }
}
```

**建议**：
- ✅ 现有运营者默认分配到 **Layer 1（核心）**
- ✅ 治理可后续手动调整到 Layer 2
- ✅ 新注册的运营者默认为 **Layer 2（社区）**

---

## 📊 总结

### 当前状态

```
✅ 已实现（70%基础功能）：
   ├─ 运营者注册/管理
   ├─ 运营者监控/统计
   ├─ 智能运营者选择
   ├─ 数据分层（PinTier）
   └─ 健康检查与自动修复

❌ 未实现（30%分层架构）：
   ├─ 运营者层级分类（Core/Community）
   ├─ 分层存储策略配置
   ├─ 分层运营者选择算法
   ├─ 分层Pin分配记录
   ├─ 分层治理接口
   └─ Layer 3外部网络集成
```

### 下一步

**立即执行**：
1. ✅ 实施P0任务（3-5天）
2. ✅ 完成Layer 1/Layer 2基础架构
3. ✅ 编译测试验证

**短期规划**：
- ⏳ 实施P1任务（2-3天）
- ⏳ 治理接口和监控

**长期规划**：
- ⏳ Layer 3外部网络集成（4-6周）

---

<div align="center">

**当前实现进度：70%**

**Layer 1/Layer 2分层架构：待实施（P0优先级）**

**预计完成时间：3-5天**

</div>

