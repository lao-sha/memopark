# IPFS Pin健康巡检周期设计

## 🎯 核心问题

**PIN需要周期性巡检保证不丢失，多大的周期合适？**

---

## 📊 IPFS Pin机制原理

### 1. Pin vs 普通存储

```
普通IPFS内容：
- 由垃圾回收(GC)管理
- 闲置一段时间后可能被删除
- 不保证持久性

Pin内容：
- 永久保护，不会被GC删除
- 需要定期验证仍然存在
- 保证持久性
```

### 2. Pin状态机

```rust
pub enum PinState {
    Requested = 0,   // 已请求，等待处理
    Pinning = 1,     // 正在pin中
    Pinned = 2,      // 已pin（正常状态）
    Degraded = 3,    // 降级（副本数不足或欠费）
    Failed = 4,      // Pin失败
    Expired = 5,     // 已过期（宽限期结束）
}
```

### 3. 可能的失败场景

| 场景 | 原因 | 概率 | 影响 |
|-----|------|------|------|
| **运营者节点宕机** | 硬件故障、网络断开 | 中 | 副本数减少 |
| **磁盘损坏** | 物理损坏、坏道 | 低 | 数据丢失 |
| **运营者退出** | 主动下线、余额不足 | 低 | 副本数减少 |
| **IPFS集群故障** | 软件bug、配置错误 | 低 | Pin状态异常 |
| **网络分区** | 网络故障、DDoS攻击 | 中 | 暂时不可访问 |

---

## 🔍 巡检周期分析

### 方案A: **24小时巡检**（推荐⭐）

#### 设计参数

```rust
// runtime/src/lib.rs 或 pallet配置

parameter_types! {
    // 健康巡检周期: 24小时 = 14,400 区块（6秒/区块）
    pub const HealthCheckPeriod: BlockNumber = 14_400;
    
    // 每区块最大巡检数量（防止区块过载）
    pub const MaxProbesPerBlock: u32 = 5;
    
    // 副本数阈值：低于此值触发警告
    pub const MinReplicasThreshold: u32 = 2;
    
    // 自动修复：副本数不足时自动补充
    pub const AutoRepairEnabled: bool = true;
}
```

#### 巡检逻辑

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_finalize(n: BlockNumberFor<T>) {
        // 1. 每24小时巡检一次（14,400区块）
        if n % T::HealthCheckPeriod::get() != 0u32.into() {
            return;
        }
        
        // 2. 批量巡检（限制数量）
        let limit = T::MaxProbesPerBlock::get();
        let mut checked = 0u32;
        
        // 3. 按优先级扫描（优先检查重要内容）
        for domain in [EVIDENCE, DECEASED, OFFERINGS, GRAVE] {
            for (subject_id, cid_list) in DomainPins::<T>::iter_prefix(domain) {
                for cid_hash in cid_list.iter() {
                    if checked >= limit { break; }
                    
                    // 触发OCW巡检
                    Self::trigger_health_check(*cid_hash);
                    checked += 1;
                }
            }
        }
        
        Self::deposit_event(Event::HealthCheckTriggered {
            block: n,
            checked_count: checked,
        });
    }
}
```

#### OCW巡检实现

```rust
fn offchain_worker(n: BlockNumberFor<T>) {
    // 读取待巡检队列
    let check_queue = sp_io::offchain::local_storage_get(
        StorageKind::PERSISTENT,
        b"/memo/ipfs/health_check_queue"
    );
    
    if let Some(cid_list) = check_queue {
        for cid_hash in cid_list {
            // 1. 查询ipfs-cluster状态
            // GET /pins/{cid}/status
            let status_response = Self::query_pin_status(&cid_hash);
            
            match status_response {
                Ok(status) => {
                    // 2. 解析副本数
                    let actual_replicas = status.replicas;
                    let expected_replicas = PinMeta::<T>::get(&cid_hash).replicas;
                    
                    // 3. 检查健康状态
                    if actual_replicas >= expected_replicas {
                        // 健康：更新最后巡检时间
                        Self::update_health_status(&cid_hash, HealthStatus::Healthy);
                    } else if actual_replicas >= T::MinReplicasThreshold::get() {
                        // 降级：副本数不足但仍可用
                        Self::update_health_status(&cid_hash, HealthStatus::Degraded);
                        
                        // 4. 自动修复（如果启用）
                        if T::AutoRepairEnabled::get() {
                            Self::trigger_auto_repair(&cid_hash, expected_replicas - actual_replicas);
                        }
                    } else {
                        // 危险：副本数严重不足
                        Self::update_health_status(&cid_hash, HealthStatus::Critical);
                        Self::trigger_emergency_repair(&cid_hash);
                    }
                }
                Err(_) => {
                    // 巡检失败：标记为未知状态
                    Self::update_health_status(&cid_hash, HealthStatus::Unknown);
                }
            }
        }
    }
}
```

**优点**：
- ✅ **平衡性好**：既不过于频繁，也不过于松懈
- ✅ **性能开销小**：每天一次，对链性能影响小
- ✅ **及时发现问题**：24小时内发现并修复
- ✅ **运营者友好**：有充足时间修复问题

**缺点**：
- ⚠️ **延迟较大**：最坏情况下24小时才发现问题

---

### 方案B: **6小时巡检**（积极）

```rust
parameter_types! {
    // 6小时 = 3,600 区块
    pub const HealthCheckPeriod: BlockNumber = 3_600;
}
```

**优点**：
- ✅ 更快发现问题
- ✅ 更高的可用性保证

**缺点**：
- ❌ OCW负载增加4倍
- ❌ 网络流量增加4倍
- ❌ 对运营者要求更高

---

### 方案C: **7天巡检**（保守）

```rust
parameter_types! {
    // 7天 = 100,800 区块
    pub const HealthCheckPeriod: BlockNumber = 100_800;
}
```

**优点**：
- ✅ 性能开销最小

**缺点**：
- ❌ 延迟太大，问题可能严重化
- ❌ 用户体验差

---

## 📊 周期对比分析

| 周期 | 区块数 | 性能开销 | 发现速度 | 推荐度 |
|-----|--------|---------|---------|--------|
| **1小时** | 600 | 很高 | 很快 | ⭐ |
| **6小时** | 3,600 | 高 | 快 | ⭐⭐⭐ |
| **24小时** | 14,400 | 中 | 适中 | ⭐⭐⭐⭐⭐ |
| **3天** | 43,200 | 低 | 慢 | ⭐⭐ |
| **7天** | 100,800 | 很低 | 很慢 | ⭐ |

---

## 🎯 业界实践参考

### IPFS Cluster

```json
{
  "health_check_interval": "24h",  // 默认24小时
  "replication_factor_min": 2,
  "replication_factor_max": 3
}
```

### Filecoin

```
- WindowPoSt（时空证明）: 24小时窗口
- WinningPoSt（获胜证明）: 每个epoch（30秒）
- 扇区健康检查: 每天
```

### 传统云存储（AWS S3、阿里云OSS）

```
- 自动健康检查: 持续后台运行
- 数据完整性校验: 定期（内部机制，不公开）
- 副本数监控: 实时
```

---

## 💡 推荐方案

### **方案A变种: 24小时巡检 + 分层优先级**（最优⭐）

#### 设计思路

**不同类型的内容采用不同的巡检周期**：

```rust
/// 函数级详细中文注释：分层巡检周期配置
/// 
/// 设计理念：
/// - Level 0（临时文件）: 7天巡检，低优先级
/// - Level 1（一般文件）: 3天巡检，中优先级
/// - Level 2（重要文件）: 24小时巡检，高优先级
/// - Level 3（关键文件）: 6小时巡检，最高优先级
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum ContentLevel {
    /// Level 0: 临时文件（如头像、普通照片）
    /// 巡检周期: 7天
    Temporary = 0,
    
    /// Level 1: 一般文件（如供奉品、墓位装饰）
    /// 巡检周期: 3天
    Normal = 1,
    
    /// Level 2: 重要文件（如deceased主档、遗嘱）
    /// 巡检周期: 24小时
    Important = 2,
    
    /// Level 3: 关键文件（如法律证据、公证文件）
    /// 巡检周期: 6小时
    Critical = 3,
}

parameter_types! {
    // Level 0: 7天 = 100,800 区块
    pub const Level0CheckPeriod: BlockNumber = 100_800;
    
    // Level 1: 3天 = 43,200 区块
    pub const Level1CheckPeriod: BlockNumber = 43_200;
    
    // Level 2: 24小时 = 14,400 区块
    pub const Level2CheckPeriod: BlockNumber = 14_400;
    
    // Level 3: 6小时 = 3,600 区块
    pub const Level3CheckPeriod: BlockNumber = 3_600;
}
```

#### 存储结构

```rust
/// Pin级别映射
#[pallet::storage]
pub type PinLevel<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    ContentLevel,
    ValueQuery,  // 默认: Normal
>;

/// 最后巡检时间
#[pallet::storage]
pub type LastHealthCheck<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    BlockNumberFor<T>,
    OptionQuery,
>;

/// 健康状态
#[pallet::storage]
pub type HealthStatus<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    PinHealthStatus,
    ValueQuery,
>;

#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum PinHealthStatus {
    Healthy = 0,      // 健康：副本数充足
    Degraded = 1,     // 降级：副本数不足但可用
    Critical = 2,     // 危险：副本数严重不足
    Unknown = 3,      // 未知：巡检失败
}
```

#### 分层巡检逻辑

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_finalize(n: BlockNumberFor<T>) {
        // 1. 每小时检查一次（600区块）
        if n % 600u32.into() != 0u32.into() {
            return;
        }
        
        let now = <frame_system::Pallet<T>>::block_number();
        let limit = T::MaxProbesPerBlock::get();
        let mut checked = 0u32;
        
        // 2. 按级别扫描
        for (cid_hash, level) in PinLevel::<T>::iter() {
            if checked >= limit { break; }
            
            // 获取该级别的巡检周期
            let check_period = match level {
                ContentLevel::Temporary => T::Level0CheckPeriod::get(),
                ContentLevel::Normal => T::Level1CheckPeriod::get(),
                ContentLevel::Important => T::Level2CheckPeriod::get(),
                ContentLevel::Critical => T::Level3CheckPeriod::get(),
            };
            
            // 检查是否到期
            if let Some(last_check) = LastHealthCheck::<T>::get(&cid_hash) {
                let elapsed = now.saturating_sub(last_check);
                if elapsed >= check_period {
                    // 触发巡检
                    Self::trigger_health_check(&cid_hash);
                    checked += 1;
                }
            } else {
                // 首次巡检
                Self::trigger_health_check(&cid_hash);
                checked += 1;
            }
        }
    }
}
```

#### 自动分级规则

```rust
/// 函数级详细中文注释：根据内容类型自动分配级别
/// 
/// 规则：
/// - Evidence（证据）→ Critical (Level 3)
/// - Deceased主档 → Important (Level 2)
/// - Offerings（供奉品）→ Normal (Level 1)
/// - Grave装饰 → Temporary (Level 0)
pub fn assign_content_level(domain: u8, subject_type: &str) -> ContentLevel {
    match (domain, subject_type) {
        // 证据类 → 关键级别
        (EVIDENCE, _) => ContentLevel::Critical,
        
        // deceased主档、遗嘱 → 重要级别
        (DECEASED, "profile") | (DECEASED, "will") => ContentLevel::Important,
        
        // 供奉品 → 一般级别
        (OFFERINGS, _) => ContentLevel::Normal,
        
        // 墓位装饰、头像 → 临时级别
        (GRAVE, _) | (DECEASED, "avatar") => ContentLevel::Temporary,
        
        // 默认 → 一般级别
        _ => ContentLevel::Normal,
    }
}

/// 在 request_pin 时自动分配
pub fn request_pin_for_deceased(
    origin: OriginFor<T>,
    subject_id: u64,
    cid_hash: T::Hash,
    content_type: Vec<u8>,  // "profile", "avatar", "will", etc.
    size_bytes: u64,
    replicas: u32,
    price: T::Balance,
) -> DispatchResult {
    // ... 现有逻辑 ...
    
    // ✅ 自动分配级别
    let level = Self::assign_content_level(
        T::DeceasedDomain::get(),
        core::str::from_utf8(&content_type).unwrap_or("unknown")
    );
    PinLevel::<T>::insert(&cid_hash, level);
    
    // 初始化巡检时间
    let now = <frame_system::Pallet<T>>::block_number();
    LastHealthCheck::<T>::insert(&cid_hash, now);
    
    Ok(())
}
```

---

## 📈 性能估算

### 场景：10,000个CID

#### 方案1: 统一24小时巡检

```
每天巡检次数: 10,000次
每区块平均巡检: 10,000 / 14,400 ≈ 0.7次
OCW负载: 低
```

#### 方案2: 分层巡检

```
Level 0 (40%): 4,000个CID，7天巡检 → 571次/天
Level 1 (30%): 3,000个CID，3天巡检 → 1,000次/天
Level 2 (25%): 2,500个CID，24小时巡检 → 2,500次/天
Level 3 (5%):  500个CID，6小时巡检 → 2,000次/天

总计: 6,071次/天
每区块平均: 6,071 / 14,400 ≈ 0.42次
OCW负载: 降低40%
```

**结论**：分层巡检显著降低性能开销！

---

## 🎯 最终推荐

### **24小时巡检 + 分层优先级**

```rust
// runtime/src/lib.rs

parameter_types! {
    // 分层巡检周期
    pub const Level0CheckPeriod: BlockNumber = 100_800;  // 7天
    pub const Level1CheckPeriod: BlockNumber = 43_200;   // 3天
    pub const Level2CheckPeriod: BlockNumber = 14_400;   // 24小时（默认）
    pub const Level3CheckPeriod: BlockNumber = 3_600;    // 6小时
    
    // 性能限制
    pub const MaxProbesPerBlock: u32 = 5;
    
    // 健康阈值
    pub const MinReplicasThreshold: u32 = 2;
    
    // 自动修复
    pub const AutoRepairEnabled: bool = true;
}

impl pallet_memo_ipfs::Config for Runtime {
    // ... 现有配置 ...
    
    type Level0CheckPeriod = Level0CheckPeriod;
    type Level1CheckPeriod = Level1CheckPeriod;
    type Level2CheckPeriod = Level2CheckPeriod;
    type Level3CheckPeriod = Level3CheckPeriod;
    type MaxProbesPerBlock = MaxProbesPerBlock;
    type MinReplicasThreshold = MinReplicasThreshold;
    type AutoRepairEnabled = ConstBool<true>;
}
```

---

## 📊 综合评估

| 维度 | 统一24小时 | 分层巡检 | 评分 |
|-----|-----------|---------|------|
| **性能开销** | 中 | 低 | ⭐⭐⭐⭐⭐ |
| **问题发现速度** | 适中 | 关键内容快 | ⭐⭐⭐⭐⭐ |
| **灵活性** | 低 | 高 | ⭐⭐⭐⭐⭐ |
| **用户体验** | 一般 | 优秀 | ⭐⭐⭐⭐⭐ |
| **实现复杂度** | 简单 | 中等 | ⭐⭐⭐⭐ |
| **运营成本** | 中 | 低 | ⭐⭐⭐⭐⭐ |

---

## ✅ 实施建议

### Phase 4 Week 3 实施

**Day 1: 基础巡检**
- 添加存储结构（LastHealthCheck, HealthStatus）
- 实现统一24小时巡检逻辑
- OCW健康检查API调用

**Day 2: 分层机制**
- 添加PinLevel存储
- 实现自动分级逻辑
- 集成到request_pin

**Day 3: 自动修复**
- 实现副本数检查
- 实现自动补充副本
- 紧急修复机制

**Day 4: 测试优化**
- 单元测试
- 集成测试
- 性能测试

---

## 📝 关键配置

### 推荐配置（生产环境）

```rust
// 分层巡检周期（平衡性能与可靠性）
Level 0（临时）: 7天   // 头像、普通照片
Level 1（一般）: 3天   // 供奉品、墓位装饰
Level 2（重要）: 24小时 // deceased主档、遗嘱
Level 3（关键）: 6小时  // 法律证据、公证文件

// 性能限制
MaxProbesPerBlock: 5     // 每区块最多巡检5个CID

// 健康阈值
MinReplicasThreshold: 2  // 最少2个副本才算健康

// 自动修复
AutoRepairEnabled: true  // 启用自动修复
```

### 激进配置（高可用场景）

```rust
Level 0: 3天
Level 1: 24小时
Level 2: 6小时
Level 3: 1小时

MaxProbesPerBlock: 10
MinReplicasThreshold: 3
AutoRepairEnabled: true
```

### 保守配置（低成本场景）

```rust
Level 0: 30天
Level 1: 7天
Level 2: 3天
Level 3: 24小时

MaxProbesPerBlock: 3
MinReplicasThreshold: 1
AutoRepairEnabled: false
```

---

## 🎯 总结

### 核心答案

**PIN需要周期性巡检，推荐周期：**

1. **默认（Level 2）: 24小时**
   - 适用于大多数内容
   - 平衡性能和可靠性
   - 业界标准

2. **分层优化：**
   - Level 0（临时）: 7天
   - Level 1（一般）: 3天
   - Level 2（重要）: 24小时 ⭐
   - Level 3（关键）: 6小时

3. **自动修复：**
   - 副本数不足自动补充
   - 降级状态自动修复
   - 紧急情况立即响应

### 合理性分析

| 因素 | 24小时巡检 | 评分 |
|-----|-----------|------|
| **技术可行性** | 完全可行 | ⭐⭐⭐⭐⭐ |
| **性能开销** | 可接受 | ⭐⭐⭐⭐ |
| **用户体验** | 良好 | ⭐⭐⭐⭐⭐ |
| **运营成本** | 低 | ⭐⭐⭐⭐⭐ |
| **业界实践** | 标准 | ⭐⭐⭐⭐⭐ |

**推荐立即实施：24小时巡检 + 分层优先级机制！** 🚀

