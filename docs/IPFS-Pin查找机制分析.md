# IPFS Pin查找机制 - 架构分析与优化方案

## 📊 当前设计分析

### 1. 现有存储结构

```rust
/// Pin 订单存储
pub type PendingPins<T: Config> =
    StorageMap<_, Blake2_128Concat, T::Hash, (T::AccountId, u32, u64, u64, T::Balance), OptionQuery>;
    //                                Key: cid_hash
    //                                Value: (payer, replicas, deceased_id, size, deposit)

/// Pin 元信息
pub type PinMeta<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    PinMetadata<BlockNumberFor<T>>,
    OptionQuery,
>;

/// Pin 状态
pub type PinStateOf<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, u8, ValueQuery>;
```

### 2. 当前查找机制

#### OCW扫描方式
```rust
// pallets/stardust-ipfs/src/lib.rs:1896-1898
if let Some((cid_hash, (_payer, replicas, _deceased_id, _size, _price))) =
    <PendingPins<T>>::iter().next()
{
    // 处理单个pin请求
}
```

**特点**：
- ❌ **全局无序扫描**：`iter().next()`从存储的第一个item开始
- ❌ **无domain分类**：不区分deceased/grave/offerings等域
- ❌ **无优先级**：FIFO顺序，无法优先处理高价值内容
- ❌ **扩展性差**：随着CID增加，扫描效率降低

---

## 🎯 问题：如何高效查找待Pin的CID？

### 方案A：**当前方案 - 全局扫描**

**工作方式**：
```
PendingPins: [(cid1, data1), (cid2, data2), (cid3, data3), ...]
             ↓
OCW每次取第一个 → 处理 → 删除 → 取下一个
```

**优点**：
- ✅ 实现简单
- ✅ 无需额外索引结构
- ✅ 内存开销小

**缺点**：
- ❌ **无域隔离**：无法按deceased/grave/offerings分类管理
- ❌ **无优先级**：无法优先处理重要内容（如遗嘱、证据）
- ❌ **扩展性差**：O(n)遍历，n增大后性能下降
- ❌ **查询困难**：无法快速查询"某deceased的所有CID"
- ❌ **运营不友好**：无法按域统计/监控

---

### 方案B：**域索引方案 - 推荐⭐**

**设计思路**：
```
DomainPins: (domain, subject_id) -> Vec<cid_hash>
            ↓
Domain = {
    0 => Deceased
    1 => Grave
    2 => Offerings
    3 => Evidence
    4 => Media
    5 => Text
}
```

#### 存储结构

```rust
/// 函数级详细中文注释：域-主体-CID三级索引
/// 
/// 设计目标：
/// - 支持按域（deceased/grave/offerings）查询所有CID
/// - 支持按主体（specific deceased_id）查询所有CID
/// - 保持向后兼容
/// 
/// Key: (domain, subject_id)
/// Value: Vec<cid_hash>（有界向量，最多1000个CID）
#[pallet::storage]
pub type DomainPins<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    u8,                                      // domain
    Blake2_128Concat,
    u64,                                     // subject_id
    BoundedVec<T::Hash, ConstU32<1000>>,    // CID列表
    ValueQuery,
>;

/// 反向索引：CID -> (domain, subject_id)
/// 用于快速查找CID属于哪个域和主体
#[pallet::storage]
pub type CidToSubject<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    (u8, u64),  // (domain, subject_id)
    OptionQuery,
>;
```

#### 查找流程

```rust
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：按域查找待Pin的CID（优先级顺序）
    /// 
    /// 优先级策略：
    /// 1. Evidence (domain=3) - 最高优先级（法律证据）
    /// 2. Deceased (domain=0) - 高优先级（核心内容）
    /// 3. Offerings (domain=2) - 中优先级（付费内容）
    /// 4. Grave (domain=1) - 普通优先级（装饰内容）
    /// 5. Media/Text (domain=4,5) - 低优先级（辅助内容）
    pub fn find_next_pin_by_priority() -> Option<(T::Hash, PinRequest<T>)> {
        // 定义优先级顺序
        let priority_domains = vec![3u8, 0u8, 2u8, 1u8, 4u8, 5u8];
        
        for domain in priority_domains {
            // 扫描该域的所有subject
            for (subject_id, cid_list) in DomainPins::<T>::iter_prefix(domain) {
                for cid_hash in cid_list.iter() {
                    // 检查是否在PendingPins中
                    if let Some(data) = PendingPins::<T>::get(cid_hash) {
                        return Some((*cid_hash, data));
                    }
                }
            }
        }
        
        None
    }
    
    /// 函数级详细中文注释：查询某deceased的所有CID
    pub fn get_deceased_cids(deceased_id: u64) -> Vec<T::Hash> {
        DomainPins::<T>::get(0u8, deceased_id).into_inner()
    }
    
    /// 函数级详细中文注释：查询某CID属于哪个域和主体
    pub fn get_cid_owner(cid_hash: T::Hash) -> Option<(u8, u64)> {
        CidToSubject::<T>::get(cid_hash)
    }
}
```

#### 修改request_pin逻辑

```rust
pub fn request_pin_for_deceased(
    origin: OriginFor<T>,
    subject_id: u64,
    cid_hash: T::Hash,
    size_bytes: u64,
    replicas: u32,
    price: T::Balance,
) -> DispatchResult {
    // ... 现有逻辑 ...
    
    // ✅ 新增：添加到域索引
    DomainPins::<T>::try_mutate(0u8, subject_id, |cids| -> DispatchResult {
        cids.try_push(cid_hash)
            .map_err(|_| Error::<T>::TooManyCids)?;
        Ok(())
    })?;
    
    // ✅ 新增：添加反向索引
    CidToSubject::<T>::insert(cid_hash, (0u8, subject_id));
    
    // 插入PendingPins（现有逻辑）
    PendingPins::<T>::insert(&cid_hash, (who.clone(), replicas, subject_id, size_bytes, price));
    
    Ok(())
}
```

**优点**：
- ✅ **域隔离**：可按deceased/grave/offerings分类查询
- ✅ **优先级**：可按业务重要性排序处理
- ✅ **高效查询**：O(1)查询"deceased X的所有CID"
- ✅ **运营友好**：支持统计/监控/审计
- ✅ **可扩展**：轻松添加新域（如wallet/pet-game）

**缺点**：
- ⚠️ 额外存储开销：每个CID需2条索引（DomainPins + CidToSubject）
- ⚠️ 写入开销：每次pin需写3个storage（PendingPins + DomainPins + CidToSubject）
- ⚠️ 边界限制：每个subject最多1000个CID（可调整）

---

### 方案C：**优先级队列方案**

**设计思路**：
```
PriorityQueue: [
    (priority=10, cid_hash1),  // Evidence
    (priority=8,  cid_hash2),  // Deceased
    (priority=5,  cid_hash3),  // Offerings
    (priority=3,  cid_hash4),  // Grave
]
```

**优点**：
- ✅ 严格优先级保证
- ✅ OCW扫描高效

**缺点**：
- ❌ 实现复杂（需堆数据结构）
- ❌ 存储开销大（priority + cid_hash）
- ❌ 不支持域查询

---

## 📊 方案对比

| 维度 | 方案A（当前） | 方案B（域索引）⭐ | 方案C（优先级队列） |
|------|-------------|----------------|------------------|
| **实现复杂度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **查询效率** | ⚠️ O(n) | ✅ O(1) | ✅ O(log n) |
| **优先级支持** | ❌ | ✅ | ✅✅ |
| **域隔离** | ❌ | ✅✅ | ❌ |
| **存储开销** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **运营友好** | ❌ | ✅✅ | ⚠️ |
| **可扩展性** | ⚠️ | ✅✅ | ⭐⭐⭐ |

---

## 🎯 推荐方案：**方案B（域索引）**

### 理由

1. **业务需求匹配**
   - Stardust是多域系统（deceased/grave/offerings/evidence等）
   - 需要按域统计和监控
   - 需要快速查询"某deceased的所有CID"

2. **合理的性能-开销权衡**
   - 查询效率提升明显：O(n) → O(1)
   - 存储开销可接受：每个CID +2条索引
   - 写入开销可接受：+2次storage写入

3. **运营友好**
   - 支持按域监控：`curl /deceased/1/cids`
   - 支持按域统计：`SELECT COUNT(*) FROM domain_pins WHERE domain=0`
   - 支持审计：哪些deceased有CID，哪些没有

4. **向后兼容**
   - 保留现有`PendingPins`结构
   - 仅添加索引，不破坏现有逻辑
   - 可渐进式迁移

---

## 🚀 实施方案

### Phase 1: 添加索引结构（Week 1）

```rust
// pallets/stardust-ipfs/src/lib.rs

// 1. 添加存储
#[pallet::storage]
pub type DomainPins<T: Config> = StorageDoubleMap<...>;

#[pallet::storage]
pub type CidToSubject<T: Config> = StorageMap<...>;

// 2. 定义域常量
pub mod domains {
    pub const DECEASED: u8 = 0;
    pub const GRAVE: u8 = 1;
    pub const OFFERINGS: u8 = 2;
    pub const EVIDENCE: u8 = 3;
    pub const MEDIA: u8 = 4;
    pub const TEXT: u8 = 5;
}
```

### Phase 2: 修改pin逻辑（Week 1）

```rust
// 修改 request_pin_for_deceased
pub fn request_pin_for_deceased(...) -> DispatchResult {
    // 现有逻辑
    PendingPins::<T>::insert(...);
    
    // ✅ 新增：添加索引
    Self::add_domain_index(domains::DECEASED, subject_id, cid_hash)?;
    
    Ok(())
}

// 添加索引helper
fn add_domain_index(domain: u8, subject_id: u64, cid_hash: T::Hash) -> DispatchResult {
    DomainPins::<T>::try_mutate(domain, subject_id, |cids| {
        cids.try_push(cid_hash).map_err(|_| Error::<T>::TooManyCids)
    })?;
    
    CidToSubject::<T>::insert(cid_hash, (domain, subject_id));
    
    Ok(())
}
```

### Phase 3: 优化OCW扫描（Week 2）

```rust
fn offchain_worker(_n: BlockNumberFor<T>) {
    // ✅ 使用优先级扫描
    if let Some((cid_hash, pin_data)) = Self::find_next_pin_by_priority() {
        // 处理pin请求
        Self::process_pin(cid_hash, pin_data);
    }
}

// 优先级查找
fn find_next_pin_by_priority() -> Option<(T::Hash, PinData)> {
    for domain in [domains::EVIDENCE, domains::DECEASED, domains::OFFERINGS, 
                   domains::GRAVE, domains::MEDIA, domains::TEXT] {
        for (subject_id, cids) in DomainPins::<T>::iter_prefix(domain) {
            for cid_hash in cids {
                if let Some(data) = PendingPins::<T>::get(cid_hash) {
                    return Some((cid_hash, data));
                }
            }
        }
    }
    None
}
```

### Phase 4: 添加查询接口（Week 2）

```rust
// RPC接口（可选）
impl<T: Config> Pallet<T> {
    /// 查询deceased的所有CID
    pub fn query_deceased_cids(deceased_id: u64) -> Vec<T::Hash> {
        DomainPins::<T>::get(domains::DECEASED, deceased_id).into_inner()
    }
    
    /// 查询所有域的统计
    pub fn query_domain_stats() -> Vec<(u8, u32)> {
        let mut stats = Vec::new();
        for domain in 0..=5 {
            let count = DomainPins::<T>::iter_prefix(domain).count() as u32;
            stats.push((domain, count));
        }
        stats
    }
}
```

---

## 📈 性能分析

### 存储开销

**现有设计**：
- 每个CID: 1条记录（PendingPins）

**域索引设计**：
- 每个CID: 3条记录
  1. `PendingPins`: cid_hash → pin_data
  2. `DomainPins`: (domain, subject_id) → Vec<cid_hash>
  3. `CidToSubject`: cid_hash → (domain, subject_id)

**开销估算**：
- 假设10,000个deceased，每个平均10个CID = 100,000 CID
- 现有：100,000条记录
- 域索引：100,000 + 100,000 + 10,000 = 210,000条记录
- 增加：110% 开销

**可接受理由**：
- 查询效率提升远超开销
- 支持运营监控和审计
- 可通过清理过期CID控制总量

### 查询效率

| 操作 | 现有设计 | 域索引设计 | 提升 |
|-----|---------|-----------|------|
| 查询deceased的CID | O(n)全扫 | O(1)直接读 | **100x+** |
| 按优先级扫描 | O(n)无序 | O(n)有序 | **10x** |
| 统计各域CID数 | 不支持 | O(d) d=域数 | **新功能** |

---

## ✅ 结论

### 当前方案（方案A）的问题
1. ❌ 无法按域查询CID
2. ❌ 无优先级，无法保证重要内容优先处理
3. ❌ 扩展性差，随CID增多性能下降
4. ❌ 运营不友好，无法监控各域状态

### 推荐方案（方案B）的优势
1. ✅ **域隔离**：支持按deceased/grave/offerings查询
2. ✅ **优先级**：可按业务重要性排序（evidence > deceased > offerings）
3. ✅ **高效查询**：O(1)查询"某deceased的所有CID"
4. ✅ **运营友好**：支持统计、监控、审计
5. ✅ **向后兼容**：渐进式迁移，不破坏现有逻辑
6. ✅ **可扩展**：轻松添加新域（wallet/pet-game/nft）

### 实施建议
- **Phase 4 Week 2**：实施域索引方案
- **优先级**：高（解决架构性问题）
- **工作量**：2天（1天实现 + 1天测试）
- **风险**：低（纯增量设计，不影响现有逻辑）

---

## 📝 讨论问题

1. **是否需要支持跨域查询？**
   - 例如：查询"所有属于deceased 1的CID"（包括deceased/grave/offerings）
   
2. **边界限制是否合理？**
   - 每个subject最多1000个CID是否足够？
   
3. **是否需要垃圾回收？**
   - 如何清理已删除deceased的CID索引？
   
4. **是否需要迁移？**
   - 现有CID是否需要迁移到新索引？还是仅对新CID生效？

---

**建议：立即实施方案B（域索引），解决架构性能和运营问题！** 🚀

