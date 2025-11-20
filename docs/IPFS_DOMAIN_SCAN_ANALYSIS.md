# OCW巡检按域扫描和统计功能详细分析

**日期**: 2025-11-18  
**模块**: pallet-stardust-ipfs  
**功能**: OCW域顺序扫描、Pin统计、存储容量统计

---

## 📋 功能概述

### 设计目标

OCW巡检时按**域（Domain）顺序**扫描Pin内容，统计各域的Pin数量和存储容量，实现以下功能：

1. **优先级调度**：按域的重要性顺序巡检（Deceased > Offerings > Evidence）
2. **域级统计**：分别统计各域的Pin数量、存储容量、健康状态
3. **资源优化**：集中处理同一域的CID，提高缓存命中率
4. **监控可视化**：为链上Dashboard提供域级别的监控数据

---

## 🏗️ 核心存储设计

### 1. DomainPins - 域索引存储

```rust
/// 函数级详细中文注释：域级Pin索引（多域扩展）
/// 
/// 设计目标：
/// - 替代全局扫描 PendingPins::iter()
/// - 支持域级别的优先级调度（Deceased优先于OTC）
/// - 便于域级别的批量操作（如暂停某域的扣费）
/// 
/// 存储结构：
/// - Key1: domain（如 b"deceased", b"offerings", b"evidence"）
/// - Key2: cid_hash
/// - Value: ()（标记存在即可）
#[pallet::storage]
pub type DomainPins<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    BoundedVec<u8, ConstU32<32>>,  // domain
    Blake2_128Concat,
    T::Hash,                        // cid_hash
    (),
    OptionQuery,
>;
```

**关键特性**：
- ✅ **双重映射**：domain → cid_hash，支持按域遍历
- ✅ **轻量标记**：Value为()，仅标记存在，不浪费存储
- ✅ **域优先级**：可以按域名顺序迭代

### 2. GlobalHealthStats - 全局统计

```rust
pub struct GlobalHealthStats<BlockNumber> {
    pub total_pins: u64,           // 总Pin数量
    pub total_size_bytes: u64,     // 总存储量（字节）
    pub healthy_count: u64,        // 健康CID数量
    pub degraded_count: u64,       // 降级CID数量
    pub critical_count: u64,       // 危险CID数量
    pub last_full_scan: BlockNumber, // 上次扫描时间
    pub total_repairs: u64,        // 累计修复次数
}
```

**当前实现**：
- ✅ 全局统计（不区分域）
- ❌ **未实现**按域分别统计

---

## 🔍 当前实现分析

### 现有统计逻辑

```rust
// pallets/stardust-ipfs/src/lib.rs:4360
fn update_global_health_stats_impl() {
    let mut stats = GlobalHealthStats::<BlockNumberFor<T>>::default();
    let current_block = <frame_system::Pallet<T>>::block_number();
    
    // ⚠️ 遍历所有Pin，不区分域
    for (cid_hash, meta) in PinMeta::<T>::iter() {
        stats.total_pins = stats.total_pins.saturating_add(1);
        stats.total_size_bytes = stats.total_size_bytes.saturating_add(meta.size);
        
        // 检查健康状态
        if let Some(task) = HealthCheckQueue::<T>::iter()
            .find(|(_, hash, _)| hash == &cid_hash)
            .map(|(_, _, task)| task)
        {
            match task.last_status {
                HealthStatus::Healthy { .. } => {
                    stats.healthy_count = stats.healthy_count.saturating_add(1);
                },
                HealthStatus::Degraded { .. } => {
                    stats.degraded_count = stats.degraded_count.saturating_add(1);
                },
                HealthStatus::Critical { .. } => {
                    stats.critical_count = stats.critical_count.saturating_add(1);
                },
                _ => {},
            }
        }
    }
    
    stats.last_full_scan = current_block;
    HealthCheckStats::<T>::put(stats);
}
```

**调用时机**：
```rust
// OCW中每24小时执行一次（7200个块）
if current_block % 7200u32.into() == Zero::zero() {
    Self::update_global_health_stats_impl();
}
```

---

## 🎯 按域扫描的设计方案

### 方案1：域优先级扫描（推荐）✅

#### 实现逻辑

```rust
fn update_domain_health_stats_impl() {
    let current_block = <frame_system::Pallet<T>>::block_number();
    
    // 定义域优先级顺序
    let priority_domains = vec![
        b"deceased".to_vec(),    // 最高优先级：逝者档案
        b"offerings".to_vec(),   // 次高优先级：供奉品
        b"evidence".to_vec(),    // 高优先级：证据数据
        b"otc".to_vec(),         // 普通优先级：OTC订单
    ];
    
    // 按域顺序扫描
    for domain_bytes in priority_domains.iter() {
        if let Ok(domain) = BoundedVec::try_from(domain_bytes.clone()) {
            let mut domain_stats = DomainStats {
                domain: domain.clone(),
                total_pins: 0,
                total_size_bytes: 0,
                healthy_count: 0,
                degraded_count: 0,
                critical_count: 0,
            };
            
            // ✅ 按域遍历CID（利用DomainPins索引）
            for (cid_hash, _) in DomainPins::<T>::iter_prefix(&domain) {
                // 统计Pin数量
                domain_stats.total_pins += 1;
                
                // 获取存储大小
                if let Some(meta) = PinMeta::<T>::get(&cid_hash) {
                    domain_stats.total_size_bytes += meta.size;
                }
                
                // 检查健康状态
                if let Some(task) = HealthCheckQueue::<T>::iter()
                    .find(|(_, hash, _)| hash == &cid_hash)
                    .map(|(_, _, task)| task)
                {
                    match task.last_status {
                        HealthStatus::Healthy { .. } => {
                            domain_stats.healthy_count += 1;
                        },
                        HealthStatus::Degraded { .. } => {
                            domain_stats.degraded_count += 1;
                        },
                        HealthStatus::Critical { .. } => {
                            domain_stats.critical_count += 1;
                        },
                        _ => {},
                    }
                }
            }
            
            // 存储域统计
            DomainHealthStats::<T>::insert(&domain, domain_stats.clone());
            
            // 发送域统计事件
            Self::deposit_event(Event::DomainStatsUpdated {
                domain,
                total_pins: domain_stats.total_pins,
                total_size_bytes: domain_stats.total_size_bytes,
                healthy_count: domain_stats.healthy_count,
                degraded_count: domain_stats.degraded_count,
                critical_count: domain_stats.critical_count,
            });
        }
    }
}
```

#### 优势分析

1. **优先级调度** ✅
   - Deceased域优先扫描，确保关键数据最先检查
   - 可动态调整域优先级

2. **缓存友好** ✅
   - 连续访问同一域的CID，提高缓存命中率
   - 减少存储I/O次数

3. **可监控性** ✅
   - 每个域独立的统计数据
   - 便于Dashboard展示域级别健康状况

4. **可扩展性** ✅
   - 新增域只需添加到priority_domains列表
   - 支持治理动态调整优先级

---

## 📊 新增存储项

### 1. DomainHealthStats - 域健康统计

```rust
/// 函数级详细中文注释：域级别健康统计
/// 
/// 记录每个域的Pin数量、存储容量、健康状态等统计信息
/// 
/// Key: domain（如 b"deceased", b"offerings"）
/// Value: DomainStats
#[pallet::storage]
pub type DomainHealthStats<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BoundedVec<u8, ConstU32<32>>,  // domain
    DomainStats,
    OptionQuery,
>;

/// 域统计数据结构
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct DomainStats {
    /// 域名
    pub domain: BoundedVec<u8, ConstU32<32>>,
    /// 总Pin数量
    pub total_pins: u64,
    /// 总存储量（字节）
    pub total_size_bytes: u64,
    /// 健康CID数量
    pub healthy_count: u64,
    /// 降级CID数量
    pub degraded_count: u64,
    /// 危险CID数量
    pub critical_count: u64,
}
```

### 2. DomainPriority - 域优先级配置

```rust
/// 函数级详细中文注释：域优先级配置（治理可调）
/// 
/// 定义各域的巡检优先级，数值越小优先级越高
/// 
/// Key: domain
/// Value: priority（0-255，0为最高优先级）
#[pallet::storage]
pub type DomainPriority<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BoundedVec<u8, ConstU32<32>>,
    u8,
    ValueQuery,  // 默认返回255（最低优先级）
>;
```

**初始化配置**：
```rust
// Genesis配置或治理设置
DomainPriority::insert(b"deceased".to_vec(), 0);   // 最高优先级
DomainPriority::insert(b"offerings".to_vec(), 10);
DomainPriority::insert(b"evidence".to_vec(), 20);
DomainPriority::insert(b"otc".to_vec(), 100);      // 较低优先级
```

---

## 🔄 完整工作流程

### OCW执行流程

```
每个区块执行 offchain_worker()
    ↓
【任务1】处理待Pin队列（PendingPins）
    ├─ 分配运营者
    ├─ 提交Pin请求
    └─ 更新状态
    ↓
【任务2】巡检现有Pin（PinStateOf）
    ├─ 检查副本健康状态
    ├─ 标记降级/修复
    └─ 更新运营者统计
    ↓
【任务3】按域统计（每24小时）⭐ 新增
    ├─ 按优先级顺序遍历域
    │   ├─ deceased（优先级0）
    │   ├─ offerings（优先级10）
    │   ├─ evidence（优先级20）
    │   └─ otc（优先级100）
    │
    ├─ 对每个域：
    │   ├─ 使用 DomainPins::iter_prefix(domain)
    │   ├─ 统计 total_pins、total_size_bytes
    │   ├─ 统计 healthy/degraded/critical count
    │   └─ 存储到 DomainHealthStats
    │
    └─ 发送 DomainStatsUpdated 事件
    ↓
【任务4】周期扣费（on_finalize）
    └─ 处理到期扣费任务
```

---

## 📈 性能优化

### 1. 使用前缀迭代器

```rust
// ✅ 高效：只遍历特定域的CID
for (cid_hash, _) in DomainPins::<T>::iter_prefix(&domain) {
    // 处理该域的CID
}

// ❌ 低效：遍历所有CID再过滤
for (domain, cid_hash, _) in DomainPins::<T>::iter() {
    if domain == target_domain {
        // 处理CID
    }
}
```

### 2. 批量处理限制

```rust
// 限制每次扫描的CID数量，避免阻塞
const MAX_CIDS_PER_DOMAIN: u32 = 1000;

let mut count = 0;
for (cid_hash, _) in DomainPins::<T>::iter_prefix(&domain) {
    if count >= MAX_CIDS_PER_DOMAIN {
        break;  // 下次继续
    }
    // 处理CID
    count += 1;
}
```

### 3. 增量更新

```rust
// 不每次都全量扫描，而是增量更新
if let Some(mut stats) = DomainHealthStats::<T>::get(&domain) {
    // 只更新变化的部分
    stats.total_pins += 1;
    stats.total_size_bytes += size;
    DomainHealthStats::<T>::insert(&domain, stats);
}
```

---

## 🎨 Dashboard展示

### 域级监控面板

```
┌─────────────────────────────────────────────────────────┐
│  IPFS 域级监控面板                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  域名        Pin数量   存储容量   健康率   优先级        │
│  ─────────  ────────  ────────  ──────  ──────         │
│  deceased    12,345    50.2 GB    98%     最高          │
│  offerings    8,567    32.1 GB    95%     次高          │
│  evidence     3,421    15.6 GB    99%     高            │
│  otc          1,234     5.2 GB    92%     普通          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  健康状态分布（deceased域）                              │
│  ─────────────────────────────────                      │
│  ● 健康: 12,100 (98%)  █████████████████████░░          │
│  ● 降级:    200 (1.6%) █░░░░░░░░░░░░░░░░░░░░░          │
│  ● 危险:     45 (0.4%) ░░░░░░░░░░░░░░░░░░░░░░          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 查询API

```rust
// RPC方法：查询域统计
pub fn get_domain_stats(domain: Vec<u8>) -> Option<DomainStats>;

// RPC方法：查询所有域统计（按优先级排序）
pub fn get_all_domain_stats() -> Vec<(Vec<u8>, DomainStats, u8)>;
// 返回：(domain, stats, priority)

// RPC方法：查询域的具体CID列表（分页）
pub fn get_domain_cids(
    domain: Vec<u8>,
    offset: u32,
    limit: u32,
) -> Vec<(Hash, PinMetadata)>;
```

---

## 🛠️ 实现步骤

### Phase 1: 基础域统计（1-2天）

1. **添加存储项**
   - [ ] `DomainHealthStats<T>` 
   - [ ] `DomainPriority<T>`

2. **实现统计函数**
   - [ ] `update_domain_health_stats_impl()`
   - [ ] 使用 `iter_prefix` 遍历域

3. **集成到OCW**
   - [ ] 在 `offchain_worker` 中调用
   - [ ] 每24小时执行一次

### Phase 2: 优先级调度（1天）

1. **实现优先级排序**
   - [ ] 按 `DomainPriority` 排序域列表
   - [ ] 高优先级域优先巡检

2. **添加治理接口**
   - [ ] `set_domain_priority(domain, priority)` extrinsic
   - [ ] Root权限控制

### Phase 3: 性能优化（1天）

1. **批量处理**
   - [ ] 限制每次扫描的CID数量
   - [ ] 实现断点续传

2. **增量更新**
   - [ ] 只更新变化的统计数据
   - [ ] 缓存上次扫描位置

### Phase 4: RPC和Dashboard（1-2天）

1. **RPC接口**
   - [ ] `get_domain_stats`
   - [ ] `get_all_domain_stats`
   - [ ] `get_domain_cids`

2. **前端集成**
   - [ ] 域级监控面板
   - [ ] 健康状态图表
   - [ ] 告警通知

---

## 📝 代码示例

### 完整实现示例

```rust
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：按域统计Pin健康状态
    /// 
    /// 功能：
    /// - 按优先级顺序遍历各域
    /// - 统计每个域的Pin数量、存储容量、健康状态
    /// - 更新域级统计数据
    /// 
    /// 调用时机：
    /// - OCW中每24小时执行一次
    /// 
    /// 性能：
    /// - 使用 iter_prefix 优化遍历
    /// - 批量处理限制，防止阻塞
    fn update_domain_health_stats_impl() {
        let current_block = <frame_system::Pallet<T>>::block_number();
        
        // 1. 获取所有已注册的域
        let mut domains_with_priority: Vec<(BoundedVec<u8, ConstU32<32>>, u8)> = Vec::new();
        
        // 遍历 DomainPins 获取所有域名
        let mut seen_domains = sp_std::collections::btree_set::BTreeSet::new();
        for (domain, _, _) in DomainPins::<T>::iter() {
            if seen_domains.insert(domain.clone()) {
                let priority = DomainPriority::<T>::get(&domain);
                domains_with_priority.push((domain, priority));
            }
        }
        
        // 2. 按优先级排序（数值越小优先级越高）
        domains_with_priority.sort_by_key(|(_domain, priority)| *priority);
        
        // 3. 按域顺序统计
        for (domain, _priority) in domains_with_priority.iter() {
            let mut domain_stats = DomainStats {
                domain: domain.clone(),
                total_pins: 0,
                total_size_bytes: 0,
                healthy_count: 0,
                degraded_count: 0,
                critical_count: 0,
            };
            
            let mut cid_count = 0u32;
            const MAX_CIDS: u32 = 1000;  // 批量限制
            
            // 使用前缀迭代器高效遍历
            for (cid_hash, _) in DomainPins::<T>::iter_prefix(domain) {
                if cid_count >= MAX_CIDS {
                    break;  // 限制处理数量
                }
                
                domain_stats.total_pins += 1;
                
                // 获取Pin元信息
                if let Some(meta) = PinMeta::<T>::get(&cid_hash) {
                    domain_stats.total_size_bytes += meta.size;
                }
                
                // 检查健康状态
                let mut found_health = false;
                for (_, hash, task) in HealthCheckQueue::<T>::iter() {
                    if hash == cid_hash {
                        match task.last_status {
                            HealthStatus::Healthy { .. } => {
                                domain_stats.healthy_count += 1;
                            },
                            HealthStatus::Degraded { .. } => {
                                domain_stats.degraded_count += 1;
                            },
                            HealthStatus::Critical { .. } => {
                                domain_stats.critical_count += 1;
                            },
                            _ => {},
                        }
                        found_health = true;
                        break;
                    }
                }
                
                // 未找到健康检查记录，默认为健康
                if !found_health {
                    domain_stats.healthy_count += 1;
                }
                
                cid_count += 1;
            }
            
            // 4. 存储统计结果
            DomainHealthStats::<T>::insert(domain, domain_stats.clone());
            
            // 5. 发送事件
            Self::deposit_event(Event::DomainStatsUpdated {
                domain: domain.clone(),
                total_pins: domain_stats.total_pins,
                total_size_bytes: domain_stats.total_size_bytes,
                healthy_count: domain_stats.healthy_count,
                degraded_count: domain_stats.degraded_count,
                critical_count: domain_stats.critical_count,
            });
        }
        
        // 6. 更新全局统计（汇总所有域）
        let mut global_stats = GlobalHealthStats::<BlockNumberFor<T>>::default();
        for (_domain, stats) in DomainHealthStats::<T>::iter() {
            global_stats.total_pins += stats.total_pins;
            global_stats.total_size_bytes += stats.total_size_bytes;
            global_stats.healthy_count += stats.healthy_count;
            global_stats.degraded_count += stats.degraded_count;
            global_stats.critical_count += stats.critical_count;
        }
        global_stats.last_full_scan = current_block;
        HealthCheckStats::<T>::put(global_stats);
    }
}
```

---

## 🎯 总结

### 当前状态

✅ **已实现**：
- `DomainPins` 存储结构（支持按域索引）
- 全局健康统计（`GlobalHealthStats`）
- OCW基础巡检逻辑

❌ **未实现**：
- 按域分别统计
- 域优先级调度
- 域级健康监控面板

### 实现价值

1. **优先级保障** 🎯
   - 关键数据（deceased）优先巡检
   - 确保重要内容的高可用性

2. **监控可视化** 📊
   - 域级别的健康状况展示
   - 便于快速定位问题域

3. **性能优化** ⚡
   - 利用域索引减少扫描范围
   - 批量处理提高效率

4. **治理灵活** ⚙️
   - 可动态调整域优先级
   - 支持新域快速接入

### 建议优先级

**P0（核心功能）**：
- [ ] 实现 `update_domain_health_stats_impl()`
- [ ] 添加 `DomainHealthStats` 存储
- [ ] 集成到OCW

**P1（增强功能）**：
- [ ] 域优先级配置和治理
- [ ] RPC查询接口

**P2（优化和UI）**：
- [ ] 性能优化（批量、增量）
- [ ] Dashboard前端集成

---

**最后更新**: 2025-11-18  
**状态**: 📋 设计完成，待实现
