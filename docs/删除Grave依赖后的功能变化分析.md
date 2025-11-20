# 删除 Grave 依赖后的功能变化分析

> **目标**：全面分析删除 `pallet-stardust-grave` 依赖后，各功能模块的功能变化、影响和替代方案

---

## 📋 目录

1. [功能变化概览](#1-功能变化概览)
2. [pallet-deceased 功能变化](#2-pallet-deceased-功能变化)
3. [pallet-memorial 功能变化](#3-pallet-memorial-功能变化)
4. [pallet-stardust-pet 功能变化](#4-pallet-stardust-pet-功能变化)
5. [pallet-ledger 功能变化](#5-pallet-ledger-功能变化)
6. [Runtime 功能变化](#6-runtime-功能变化)
7. [治理功能变化](#7-治理功能变化)
8. [前端功能变化](#8-前端功能变化)
9. [功能替代方案](#9-功能替代方案)
10. [功能变化影响评估](#10-功能变化影响评估)

---

## 1. 功能变化概览

### 1.1 功能变化统计

| 模块 | 功能丢失 | 功能重构 | 功能保留 | 影响程度 |
|------|---------|---------|---------|---------|
| **pallet-deceased** | 3 个 | 8 个 | 15+ 个 | ⭐⭐⭐⭐⭐ |
| **pallet-memorial** | 2 个 | 3 个 | 10+ 个 | ⭐⭐⭐⭐ |
| **pallet-stardust-pet** | 0 个 | 2 个 | 10+ 个 | ⭐⭐⭐ |
| **pallet-ledger** | 0 个 | 全部 | 0 个 | ⭐⭐⭐⭐ |
| **Runtime** | 1 个 | 6 个 | 0 个 | ⭐⭐⭐⭐⭐ |
| **治理功能** | 5 个 | 0 个 | 0 个 | ⭐⭐⭐⭐ |

### 1.2 功能变化分类

**完全丢失的功能**（需要替代方案）：
- 墓位管理功能（创建、更新、删除墓位）
- 墓位权限管理（管理员、成员）
- 墓位准入策略（OwnerOnly、Public、Whitelist）
- 墓位安葬记录（Interments）
- 墓位主逝者（PrimaryDeceased）
- 墓位供奉统计（按墓位统计）
- 墓位治理功能（5个治理接口）

**需要重构的功能**（功能保留但实现方式改变）：
- 逝者创建（不再需要关联墓位）
- 逝者迁移（不再需要墓位迁移）
- 供奉目标（从墓位改为逝者/宠物）
- 供奉分账（从墓主改为逝者owner）
- 供奉统计（从墓位维度改为逝者维度）
- 权限检查（从墓位权限改为逝者权限）

**完全保留的功能**（不受影响）：
- 逝者基本信息管理（创建、更新、删除）
- 逝者拥有权管理（转让、治理转让）
- 逝者关系管理（添加、删除、更新关系）
- 逝者作品管理（上传、更新、删除作品）
- 逝者媒体管理（相册、视频、文本）
- 宠物基本信息管理（创建、更新、删除）
- 宠物拥有权管理（转让、治理转让）

---

## 2. pallet-deceased 功能变化

### 2.1 功能变化总览

| 功能类型 | 变化类型 | 影响程度 | 替代方案 |
|---------|---------|---------|---------|
| **逝者创建** | 重构 | ⭐⭐⭐⭐⭐ | 移除grave_id参数，直接创建 |
| **逝者迁移** | 重构 | ⭐⭐⭐⭐⭐ | 改为逝者拥有权转让 |
| **逝者关系管理** | 重构 | ⭐⭐⭐ | 改为基于逝者owner权限 |
| **逝者查询** | 重构 | ⭐⭐⭐ | 移除按墓位查询 |
| **数据结构** | 重构 | ⭐⭐⭐⭐⭐ | 移除grave_id字段和DeceasedByGrave存储 |

### 2.2 详细功能变化

#### 2.2.1 创建逝者（`create_deceased`）

**当前功能**：
- 创建逝者记录
- 必须指定 `grave_id`
- 检查墓位存在性和权限
- 自动记录安葬到墓位
- 自动更新墓位的主逝者

**删除 Grave 后的变化**：
- ✅ **功能保留**：创建逝者记录
- ❌ **功能丢失**：墓位关联、安葬记录、主逝者设置
- 🔄 **功能重构**：移除 `grave_id` 参数，移除权限检查

**新功能设计**：
```rust
// 旧接口（需要删除）
pub fn create_deceased(
    origin: OriginFor<T>,
    grave_id: T::GraveId,  // ❌ 删除
    name: BoundedVec<u8, T::StringLimit>,
    // ... 其他参数
) -> DispatchResult

// 新接口（重构后）
pub fn create_deceased(
    origin: OriginFor<T>,
    name: BoundedVec<u8, T::StringLimit>,
    // ... 其他参数（移除grave_id）
) -> DispatchResult
```

**影响分析**：
- **正面影响**：简化创建流程，降低使用门槛
- **负面影响**：失去墓位组织能力，无法按墓位管理逝者
- **替代方案**：使用逝者关系（亲属关系）组织逝者

#### 2.2.2 迁移逝者（`transfer_deceased`）

**当前功能**：
- 将逝者从一个墓位迁移到另一个墓位
- 检查目标墓位存在性和准入策略
- 记录起掘和安葬操作
- 更新墓位的安葬记录

**删除 Grave 后的变化**：
- ❌ **功能丢失**：墓位迁移功能完全丢失
- 🔄 **功能重构**：改为逝者拥有权转让（`transfer_deceased_owner`）

**新功能设计**：
```rust
// 旧接口（需要删除）
pub fn transfer_deceased(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    new_grave: T::GraveId,  // ❌ 删除
) -> DispatchResult

// 新接口（使用现有功能）
pub fn transfer_deceased_owner(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    new_owner: T::AccountId,  // ✅ 保留
) -> DispatchResult
```

**影响分析**：
- **正面影响**：简化迁移逻辑，直接转让拥有权
- **负面影响**：失去墓位组织能力，无法按墓位迁移
- **替代方案**：通过拥有权转让实现管理权转移

#### 2.2.3 关系管理（`add_relation`, `remove_relation` 等）

**当前功能**：
- 添加、删除、更新逝者关系
- 通过逝者的 `grave_id` 检查权限
- 需要墓位管理员权限

**删除 Grave 后的变化**：
- ✅ **功能保留**：关系管理功能完全保留
- 🔄 **功能重构**：改为基于逝者owner权限

**新功能设计**：
```rust
// 旧权限检查（需要删除）
T::GraveProvider::can_attach(&who, deceased.grave_id)?;

// 新权限检查（重构后）
ensure!(deceased.owner == who, Error::<T>::NotOwner);
```

**影响分析**：
- **正面影响**：权限检查更简单直接
- **负面影响**：失去墓位管理员权限（需要单独授权）
- **替代方案**：通过逝者owner授权实现管理员功能

#### 2.2.4 逝者查询

**当前功能**：
- 按逝者ID查询
- 按墓位ID查询（`DeceasedByGrave`）
- 按owner查询
- 按姓名查询

**删除 Grave 后的变化**：
- ✅ **功能保留**：按ID、owner、姓名查询
- ❌ **功能丢失**：按墓位查询

**新功能设计**：
```rust
// 旧存储（需要删除）
DeceasedByGrave<T>: StorageMap<GraveId, Vec<DeceasedId>>

// 新查询方式（替代方案）
// 通过逝者关系查询相关逝者
DeceasedRelations<T>: StorageDoubleMap<DeceasedId, RelationType, DeceasedId>
```

**影响分析**：
- **正面影响**：查询逻辑更简单
- **负面影响**：失去按墓位组织查询的能力
- **替代方案**：通过逝者关系（亲属关系）组织查询

#### 2.2.5 数据结构变化

**当前数据结构**：
```rust
pub struct Deceased<T: Config> {
    pub id: T::DeceasedId,
    pub owner: T::AccountId,
    pub grave_id: T::GraveId,  // ❌ 需要删除
    pub name: BoundedVec<u8, T::StringLimit>,
    // ... 其他字段
}
```

**新数据结构**：
```rust
pub struct Deceased<T: Config> {
    pub id: T::DeceasedId,
    pub owner: T::AccountId,
    // ❌ 移除 grave_id
    pub name: BoundedVec<u8, T::StringLimit>,
    // ... 其他字段
}
```

**存储项变化**：
- ❌ **删除**：`DeceasedByGrave<T>` - 按墓位索引逝者
- ✅ **保留**：`Deceased<T>` - 逝者基本信息
- ✅ **保留**：`DeceasedByOwner<T>` - 按owner索引逝者
- ✅ **保留**：`DeceasedByName<T>` - 按姓名索引逝者

---

## 3. pallet-memorial 功能变化

### 3.1 功能变化总览

| 功能类型 | 变化类型 | 影响程度 | 替代方案 |
|---------|---------|---------|---------|
| **供奉下单** | 重构 | ⭐⭐⭐⭐⭐ | 改为针对逝者/宠物 |
| **供奉分账** | 重构 | ⭐⭐⭐⭐ | 改为逝者owner分账 |
| **供奉查询** | 重构 | ⭐⭐⭐ | 改为按逝者/宠物查询 |
| **数据结构** | 重构 | ⭐⭐⭐⭐ | 移除grave_id字段 |

### 3.2 详细功能变化

#### 3.2.1 供奉下单（`offer`）

**当前功能**：
- 针对墓位进行供奉
- 检查墓位存在性和权限
- 获取墓主进行分账
- 记录供奉到墓位

**删除 Grave 后的变化**：
- 🔄 **功能重构**：改为针对逝者/宠物进行供奉
- 🔄 **功能重构**：改为检查逝者/宠物存在性和权限
- 🔄 **功能重构**：改为获取逝者owner进行分账

**新功能设计**：
```rust
// 旧接口（需要重构）
pub fn offer(
    origin: OriginFor<T>,
    grave_id: u64,  // ❌ 改为 target_type + target_id
    sacrifice_id: u64,
    // ... 其他参数
) -> DispatchResult

// 新接口（重构后）
pub fn offer(
    origin: OriginFor<T>,
    target_type: u8,  // 0=逝者, 1=宠物, 2=其他
    target_id: u64,   // 逝者ID或宠物ID
    sacrifice_id: u64,
    // ... 其他参数
) -> DispatchResult
```

**影响分析**：
- **正面影响**：更灵活的供奉目标，支持多类型目标
- **负面影响**：失去墓位级供奉统计
- **替代方案**：通过逝者关系聚合统计

#### 3.2.2 供奉分账（`transfer_with_simple_route`）

**当前功能**：
- 获取墓主账户
- 将资金分账给墓主
- 支持联盟分账

**删除 Grave 后的变化**：
- 🔄 **功能重构**：改为获取逝者/宠物owner
- 🔄 **功能重构**：改为分账给逝者/宠物owner

**新功能设计**：
```rust
// 旧分账逻辑（需要重构）
let grave_owner = T::GraveProvider::owner_of(grave_id)?;
// 分账给 grave_owner

// 新分账逻辑（重构后）
let target_owner = match target_type {
    0 => T::DeceasedProvider::owner_of(target_id)?,  // 逝者owner
    1 => T::PetProvider::owner_of(target_id)?,        // 宠物owner
    _ => return Err(Error::<T>::InvalidTarget),
};
// 分账给 target_owner
```

**影响分析**：
- **正面影响**：分账逻辑更直接，减少中间层
- **负面影响**：失去墓位级分账聚合
- **替代方案**：通过逝者关系聚合分账

#### 3.2.3 供奉查询

**当前功能**：
- 按供奉ID查询
- 按墓位查询（`OfferingsByGrave`）
- 按用户查询
- 按时间查询

**删除 Grave 后的变化**：
- ✅ **功能保留**：按ID、用户、时间查询
- ❌ **功能丢失**：按墓位查询

**新功能设计**：
```rust
// 旧存储（需要删除）
OfferingsByGrave<T>: StorageMap<GraveId, Vec<OfferingId>>

// 新存储（重构后）
OfferingsByTarget<T>: StorageDoubleMap<TargetType, TargetId, Vec<OfferingId>>
```

**影响分析**：
- **正面影响**：查询逻辑更通用，支持多类型目标
- **负面影响**：失去墓位级查询聚合
- **替代方案**：通过逝者关系聚合查询

#### 3.2.4 数据结构变化

**当前数据结构**：
```rust
pub struct OfferingRecord<T: Config> {
    pub id: u64,
    pub who: T::AccountId,
    pub grave_id: u64,  // ❌ 需要删除
    pub sacrifice_id: u64,
    // ... 其他字段
}
```

**新数据结构**：
```rust
pub struct OfferingRecord<T: Config> {
    pub id: u64,
    pub who: T::AccountId,
    pub target_type: u8,  // 0=逝者, 1=宠物, 2=其他
    pub target_id: u64,    // 逝者ID或宠物ID
    pub sacrifice_id: u64,
    // ... 其他字段
}
```

**存储项变化**：
- ❌ **删除**：`OfferingsByGrave<T>` - 按墓位索引供奉
- ✅ **新增**：`OfferingsByTarget<T>` - 按目标类型和ID索引供奉
- ✅ **保留**：`OfferingRecords<T>` - 供奉记录
- ✅ **保留**：`OfferingsByUser<T>` - 按用户索引供奉

---

## 4. pallet-stardust-pet 功能变化

### 4.1 功能变化总览

| 功能类型 | 变化类型 | 影响程度 | 替代方案 |
|---------|---------|---------|---------|
| **宠物创建** | 重构 | ⭐⭐⭐ | 移除grave_id参数（可选） |
| **宠物更新** | 重构 | ⭐⭐ | 移除grave_id字段更新 |
| **数据结构** | 重构 | ⭐⭐ | 移除grave_id字段（可选） |

### 4.2 详细功能变化

#### 4.2.1 创建宠物（`create_pet`）

**当前功能**：
- 创建宠物记录
- 可选指定 `grave_id`（关联到墓位）
- 如果指定 `grave_id`，检查墓位存在性和权限

**删除 Grave 后的变化**：
- ✅ **功能保留**：创建宠物记录
- ❌ **功能丢失**：墓位关联功能
- 🔄 **功能重构**：移除 `grave_id` 参数

**新功能设计**：
```rust
// 旧接口（需要重构）
pub fn create_pet(
    origin: OriginFor<T>,
    name: BoundedVec<u8, T::StringLimit>,
    grave_id: Option<u64>,  // ❌ 删除
    // ... 其他参数
) -> DispatchResult

// 新接口（重构后）
pub fn create_pet(
    origin: OriginFor<T>,
    name: BoundedVec<u8, T::StringLimit>,
    // ... 其他参数（移除grave_id）
) -> DispatchResult
```

**影响分析**：
- **正面影响**：简化创建流程
- **负面影响**：失去宠物与墓位的关联
- **替代方案**：通过宠物关系（如"宠物属于某逝者"）实现关联

#### 4.2.2 数据结构变化

**当前数据结构**：
```rust
pub struct Pet<T: Config> {
    pub id: T::PetId,
    pub owner: T::AccountId,
    pub grave_id: Option<T::GraveId>,  // ❌ 需要删除
    pub name: BoundedVec<u8, T::StringLimit>,
    // ... 其他字段
}
```

**新数据结构**：
```rust
pub struct Pet<T: Config> {
    pub id: T::PetId,
    pub owner: T::AccountId,
    // ❌ 移除 grave_id
    pub name: BoundedVec<u8, T::StringLimit>,
    // ... 其他字段
}
```

**影响分析**：
- **正面影响**：数据结构更简洁
- **负面影响**：失去宠物与墓位的直接关联
- **替代方案**：通过宠物关系实现间接关联

---

## 5. pallet-ledger 功能变化

### 5.1 功能变化总览

| 功能类型 | 变化类型 | 影响程度 | 替代方案 |
|---------|---------|---------|---------|
| **供奉统计** | 重构 | ⭐⭐⭐⭐ | 改为按逝者/宠物统计 |
| **周活跃标记** | 重构 | ⭐⭐⭐⭐ | 改为按逝者/宠物标记 |
| **数据结构** | 重构 | ⭐⭐⭐⭐ | 移除grave_id维度 |

### 5.2 详细功能变化

#### 5.2.1 供奉统计

**当前功能**：
- 按墓位累计供奉次数（`TotalsByGrave`）
- 按墓位累计供奉金额（`TotalMemoByGrave`）
- 按墓位去重（`DedupKeys`）

**删除 Grave 后的变化**：
- 🔄 **功能重构**：改为按逝者/宠物统计
- 🔄 **功能重构**：改为多维度统计

**新功能设计**：
```rust
// 旧存储（需要删除）
TotalsByGrave<T>: StorageMap<GraveId, u64>
TotalMemoByGrave<T>: StorageMap<GraveId, Balance>

// 新存储（重构后）
TotalsByTarget<T>: StorageDoubleMap<TargetType, TargetId, u64>
TotalMemoByTarget<T>: StorageDoubleMap<TargetType, TargetId, Balance>
```

**影响分析**：
- **正面影响**：统计更精确，直接到目标
- **负面影响**：失去墓位级统计聚合
- **替代方案**：通过逝者关系聚合统计

#### 5.2.2 周活跃标记

**当前功能**：
- 按墓位标记周活跃（`WeeklyActive`）
- 按墓位查询周活跃状态

**删除 Grave 后的变化**：
- 🔄 **功能重构**：改为按逝者/宠物标记
- 🔄 **功能重构**：改为多维度标记

**新功能设计**：
```rust
// 旧存储（需要删除）
WeeklyActive<T>: StorageMap<(GraveId, AccountId, u64), ()>

// 新存储（重构后）
WeeklyActive<T>: StorageMap<(TargetType, TargetId, AccountId, u64), ()>
```

**影响分析**：
- **正面影响**：标记更精确，直接到目标
- **负面影响**：失去墓位级活跃聚合
- **替代方案**：通过逝者关系聚合活跃

#### 5.2.3 接口变化

**当前接口**：
```rust
pub fn record_from_hook_with_amount(
    grave_id: T::GraveId,  // ❌ 改为 target_type + target_id
    who: T::AccountId,
    kind_code: u8,
    amount: Option<T::Balance>,
    memo: Option<Vec<u8>>,
    tx_key: Option<H256>,
)

pub fn mark_weekly_active(
    grave_id: T::GraveId,  // ❌ 改为 target_type + target_id
    who: T::AccountId,
    start_block: BlockNumberFor<T>,
    duration_weeks: Option<u32>,
)
```

**新接口设计**：
```rust
pub fn record_from_hook_with_amount(
    target_type: u8,      // 0=逝者, 1=宠物
    target_id: u64,       // 逝者ID或宠物ID
    who: T::AccountId,
    kind_code: u8,
    amount: Option<T::Balance>,
    memo: Option<Vec<u8>>,
    tx_key: Option<H256>,
)

pub fn mark_weekly_active(
    target_type: u8,      // 0=逝者, 1=宠物
    target_id: u64,       // 逝者ID或宠物ID
    who: T::AccountId,
    start_block: BlockNumberFor<T>,
    duration_weeks: Option<u32>,
)
```

---

## 6. Runtime 功能变化

### 6.1 功能变化总览

| 功能类型 | 变化类型 | 影响程度 | 替代方案 |
|---------|---------|---------|---------|
| **Pallet 注册** | 删除 | ⭐⭐⭐⭐⭐ | 移除pallet注册 |
| **Config 配置** | 删除 | ⭐⭐⭐⭐⭐ | 移除config配置 |
| **适配器实现** | 删除 | ⭐⭐⭐⭐ | 移除适配器实现 |

### 6.2 详细功能变化

#### 6.2.1 Pallet 注册

**当前功能**：
```rust
pub type Grave = pallet_stardust_grave;
```

**删除 Grave 后的变化**：
- ❌ **功能丢失**：完全移除pallet注册

**新设计**：
```rust
// 完全移除
// pub type Grave = pallet_stardust_grave;  // ❌ 删除
```

#### 6.2.2 Config 配置

**当前功能**：
```rust
impl pallet_stardust_grave::Config for Runtime {
    type WeightInfo = ...;
    type MaxCidLen = ...;
    // ... 30+ 个配置项
}
```

**删除 Grave 后的变化**：
- ❌ **功能丢失**：完全移除config配置

**新设计**：
```rust
// 完全移除
// impl pallet_stardust_grave::Config for Runtime { ... }  // ❌ 删除
```

#### 6.2.3 适配器实现

**当前适配器**：
1. `GraveProviderAdapter` - 实现 `GraveInspector` trait
2. `MemorialTargetControl` - 实现 `TargetControl` trait
3. `MemorialGraveProvider` - 实现 `GraveProvider` trait
4. `DeceasedTokenAdapter` - 实现 `DeceasedTokenAccess` trait
5. `NoopIntermentHook` - 实现 `OnIntermentCommitted` trait
6. `RootOnlyParkAdmin` - 实现 `ParkAdminOrigin` trait

**删除 Grave 后的变化**：
- ❌ **功能丢失**：`GraveProviderAdapter`、`MemorialTargetControl`、`MemorialGraveProvider` 完全移除
- ✅ **功能保留**：`DeceasedTokenAdapter` 可以保留（读取Deceased的token）
- ✅ **功能保留**：`NoopIntermentHook` 可以保留（空实现）
- ✅ **功能保留**：`RootOnlyParkAdmin` 可以保留（权限检查）

**新设计**：
```rust
// ❌ 删除
// impl pallet_deceased::GraveInspector<AccountId, u64> for GraveProviderAdapter { ... }
// impl pallet_memorial::TargetControl<RuntimeOrigin, AccountId> for MemorialTargetControl { ... }
// impl pallet_memorial::GraveProvider<AccountId> for MemorialGraveProvider { ... }

// ✅ 保留（如果需要）
impl pallet_stardust_grave::pallet::DeceasedTokenAccess<GraveMaxCidLen> for DeceasedTokenAdapter { ... }
impl pallet_stardust_grave::pallet::OnIntermentCommitted for NoopIntermentHook { ... }
impl pallet_stardust_grave::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin { ... }
```

---

## 7. 治理功能变化

### 7.1 功能变化总览

| 治理调用 | 当前功能 | 变化类型 | 影响程度 |
|---------|---------|---------|---------|
| `(1, 10)` | `clear_cover_via_governance` | 删除 | ⭐⭐⭐ |
| `(1, 11)` | `gov_transfer_grave` | 删除 | ⭐⭐⭐⭐ |
| `(1, 12)` | `gov_set_restricted` | 删除 | ⭐⭐⭐ |
| `(1, 13)` | `gov_remove_grave` | 删除 | ⭐⭐⭐⭐ |
| `(1, 14)` | `gov_restore_grave` | 删除 | ⭐⭐⭐ |

### 7.2 详细功能变化

#### 7.2.1 清除封面（`clear_cover_via_governance`）

**当前功能**：
- 治理清除墓位封面
- 用于内容治理

**删除 Grave 后的变化**：
- ❌ **功能丢失**：完全移除

**替代方案**：
- 如果需要，可以在逝者/宠物层面实现类似功能

#### 7.2.2 治理转让墓位（`gov_transfer_grave`）

**当前功能**：
- 治理强制转让墓位拥有权
- 用于纠纷处理

**删除 Grave 后的变化**：
- ❌ **功能丢失**：完全移除

**替代方案**：
- 使用 `gov_transfer_deceased` 或 `gov_transfer_pet` 实现类似功能

#### 7.2.3 设置限制（`gov_set_restricted`）

**当前功能**：
- 治理设置墓位限制状态
- 用于内容治理

**删除 Grave 后的变化**：
- ❌ **功能丢失**：完全移除

**替代方案**：
- 如果需要，可以在逝者/宠物层面实现类似功能

#### 7.2.4 删除墓位（`gov_remove_grave`）

**当前功能**：
- 治理软删除墓位
- 用于内容治理

**删除 Grave 后的变化**：
- ❌ **功能丢失**：完全移除

**替代方案**：
- 使用 `gov_remove_deceased` 或 `gov_remove_pet` 实现类似功能

#### 7.2.5 恢复墓位（`gov_restore_grave`）

**当前功能**：
- 治理恢复已删除的墓位
- 用于内容治理

**删除 Grave 后的变化**：
- ❌ **功能丢失**：完全移除

**替代方案**：
- 使用 `gov_restore_deceased` 或 `gov_restore_pet` 实现类似功能

---

## 8. 前端功能变化

### 8.1 功能变化总览

| 功能类型 | 变化类型 | 影响程度 | 替代方案 |
|---------|---------|---------|---------|
| **墓位管理页面** | 删除 | ⭐⭐⭐⭐⭐ | 移除所有墓位相关页面 |
| **墓位详情页面** | 删除 | ⭐⭐⭐⭐⭐ | 改为逝者详情页面 |
| **供奉目标选择** | 重构 | ⭐⭐⭐⭐ | 改为选择逝者/宠物 |
| **统计展示** | 重构 | ⭐⭐⭐ | 改为按逝者/宠物统计 |

### 8.2 详细功能变化

#### 8.2.1 墓位管理页面

**当前功能**：
- 创建墓位页面
- 更新墓位页面
- 墓位列表页面
- 墓位详情页面
- 墓位设置页面

**删除 Grave 后的变化**：
- ❌ **功能丢失**：所有墓位管理页面完全移除

**替代方案**：
- 使用逝者管理页面替代
- 使用宠物管理页面替代

#### 8.2.2 供奉目标选择

**当前功能**：
- 选择墓位作为供奉目标
- 显示墓位信息
- 检查墓位权限

**删除 Grave 后的变化**：
- 🔄 **功能重构**：改为选择逝者/宠物作为供奉目标
- 🔄 **功能重构**：显示逝者/宠物信息
- 🔄 **功能重构**：检查逝者/宠物权限

**新功能设计**：
```typescript
// 旧组件（需要重构）
<GraveSelector 
  graveId={graveId}
  onSelect={(graveId) => {...}}
/>

// 新组件（重构后）
<TargetSelector 
  targetType={targetType}  // 'deceased' | 'pet'
  targetId={targetId}
  onSelect={(type, id) => {...}}
/>
```

#### 8.2.3 统计展示

**当前功能**：
- 按墓位统计供奉次数
- 按墓位统计供奉金额
- 按墓位显示周活跃

**删除 Grave 后的变化**：
- 🔄 **功能重构**：改为按逝者/宠物统计
- 🔄 **功能重构**：改为多维度统计展示

---

## 9. 功能替代方案

### 9.1 墓位组织功能替代

**当前功能**：通过墓位组织多个逝者

**替代方案1：逝者关系**
- 使用逝者关系（亲属关系）组织逝者
- 例如：父子关系、夫妻关系、兄弟姐妹关系
- 优点：更灵活，支持复杂关系
- 缺点：需要手动建立关系

**替代方案2：逝者分组**
- 使用逝者分组功能组织逝者
- 例如：家庭分组、家族分组
- 优点：简单直接
- 缺点：需要新增分组功能

**推荐方案**：使用逝者关系（已有功能，无需新增）

### 9.2 墓位权限功能替代

**当前功能**：墓位管理员、成员权限

**替代方案1：逝者授权**
- 逝者owner可以授权其他账户管理逝者
- 优点：权限更精确
- 缺点：需要为每个逝者单独授权

**替代方案2：关系权限**
- 通过逝者关系自动获得权限
- 例如：父子关系自动获得管理权限
- 优点：自动权限管理
- 缺点：关系权限逻辑复杂

**推荐方案**：使用逝者授权（需要新增授权功能）

### 9.3 墓位准入策略替代

**当前功能**：OwnerOnly、Public、Whitelist

**替代方案1：逝者可见性**
- 逝者可以设置可见性（公开/私有）
- 优点：简单直接
- 缺点：功能较简单

**替代方案2：逝者白名单**
- 逝者可以设置白名单
- 优点：支持精细控制
- 缺点：需要新增白名单功能

**推荐方案**：使用逝者可见性（简单实现）或白名单（完整实现）

### 9.4 墓位统计功能替代

**当前功能**：按墓位统计供奉次数、金额、周活跃

**替代方案1：按逝者统计**
- 直接按逝者统计
- 优点：统计更精确
- 缺点：失去墓位级聚合

**替代方案2：关系聚合统计**
- 通过逝者关系聚合统计
- 例如：统计所有亲属的供奉
- 优点：支持灵活聚合
- 缺点：需要关系查询

**推荐方案**：使用按逝者统计 + 关系聚合统计（需要新增聚合功能）

### 9.5 墓位分账功能替代

**当前功能**：供奉资金分账给墓主

**替代方案1：直接分账给逝者owner**
- 供奉资金直接分账给逝者owner
- 优点：分账更直接
- 缺点：失去墓位级聚合分账

**替代方案2：关系聚合分账**
- 通过逝者关系聚合分账
- 例如：分账给所有亲属
- 优点：支持灵活分账
- 缺点：需要关系查询

**推荐方案**：使用直接分账给逝者owner（简单实现）

---

## 10. 功能变化影响评估

### 10.1 影响程度分级

| 影响程度 | 定义 | 模块数量 | 处理优先级 |
|---------|------|---------|-----------|
| **⭐⭐⭐⭐⭐ 严重** | 核心功能丢失，需要重大重构 | 2 个 | P0 |
| **⭐⭐⭐⭐ 较高** | 重要功能丢失，需要重构 | 2 个 | P1 |
| **⭐⭐⭐ 中等** | 次要功能丢失，需要调整 | 2 个 | P2 |
| **⭐⭐ 较低** | 边缘功能丢失，影响较小 | 0 个 | P3 |

### 10.2 各模块影响评估

#### 10.2.1 pallet-deceased（⭐⭐⭐⭐⭐ 严重）

**影响分析**：
- **核心功能变化**：逝者创建、迁移功能需要重构
- **数据结构变化**：移除 `grave_id` 字段和 `DeceasedByGrave` 存储
- **查询功能变化**：移除按墓位查询功能
- **权限功能变化**：从墓位权限改为逝者owner权限

**处理优先级**：P0（最高优先级）

**处理方案**：
1. 移除 `grave_id` 字段和相关存储
2. 重构 `create_deceased` 接口（移除grave_id参数）
3. 删除 `transfer_deceased` 接口（使用 `transfer_deceased_owner` 替代）
4. 重构关系管理接口（改为基于逝者owner权限）
5. 移除 `DeceasedByGrave` 存储和相关查询

#### 10.2.2 pallet-memorial（⭐⭐⭐⭐ 较高）

**影响分析**：
- **核心功能变化**：供奉目标从墓位改为逝者/宠物
- **数据结构变化**：移除 `grave_id` 字段，改为 `target_type` + `target_id`
- **分账功能变化**：从墓主分账改为逝者/宠物owner分账
- **查询功能变化**：移除按墓位查询功能

**处理优先级**：P1（高优先级）

**处理方案**：
1. 重构 `offer` 接口（改为target_type + target_id）
2. 重构分账逻辑（改为获取逝者/宠物owner）
3. 重构存储项（改为多维度索引）
4. 重构查询接口（改为按目标查询）

#### 10.2.3 pallet-ledger（⭐⭐⭐⭐ 较高）

**影响分析**：
- **核心功能变化**：所有统计功能从墓位维度改为逝者/宠物维度
- **数据结构变化**：所有存储项从 `GraveId` 改为 `TargetType` + `TargetId`
- **接口变化**：所有接口参数从 `grave_id` 改为 `target_type` + `target_id`

**处理优先级**：P1（高优先级）

**处理方案**：
1. 重构所有存储项（改为多维度）
2. 重构所有接口（改为target_type + target_id）
3. 更新Hook调用（改为传递target_type + target_id）

#### 10.2.4 pallet-stardust-pet（⭐⭐⭐ 中等）

**影响分析**：
- **次要功能变化**：移除可选的 `grave_id` 关联
- **数据结构变化**：移除 `grave_id` 字段
- **接口变化**：移除 `grave_id` 参数

**处理优先级**：P2（中优先级）

**处理方案**：
1. 移除 `grave_id` 字段
2. 重构 `create_pet` 接口（移除grave_id参数）
3. 重构 `update_pet` 接口（移除grave_id更新）

#### 10.2.5 Runtime（⭐⭐⭐⭐⭐ 严重）

**影响分析**：
- **核心功能变化**：移除pallet注册和配置
- **适配器变化**：移除3个适配器实现
- **治理变化**：移除5个治理调用

**处理优先级**：P0（最高优先级）

**处理方案**：
1. 移除pallet注册
2. 移除config配置
3. 移除相关适配器实现
4. 移除治理调用

#### 10.2.6 治理功能（⭐⭐⭐⭐ 较高）

**影响分析**：
- **核心功能变化**：移除5个墓位治理接口
- **功能替代**：可以使用逝者/宠物治理接口替代

**处理优先级**：P1（高优先级）

**处理方案**：
1. 移除5个治理调用
2. 使用现有的逝者/宠物治理接口替代

### 10.3 功能变化总结

**完全丢失的功能**（需要替代方案）：
1. 墓位管理功能（创建、更新、删除墓位）
2. 墓位权限管理（管理员、成员）
3. 墓位准入策略（OwnerOnly、Public、Whitelist）
4. 墓位安葬记录（Interments）
5. 墓位主逝者（PrimaryDeceased）
6. 墓位级供奉统计
7. 墓位治理功能（5个治理接口）

**需要重构的功能**（功能保留但实现方式改变）：
1. 逝者创建（移除grave_id参数）
2. 逝者迁移（改为拥有权转让）
3. 供奉目标（从墓位改为逝者/宠物）
4. 供奉分账（从墓主改为逝者/宠物owner）
5. 供奉统计（从墓位维度改为逝者/宠物维度）
6. 权限检查（从墓位权限改为逝者/宠物权限）

**完全保留的功能**（不受影响）：
1. 逝者基本信息管理
2. 逝者拥有权管理
3. 逝者关系管理
4. 逝者作品管理
5. 逝者媒体管理
6. 宠物基本信息管理
7. 宠物拥有权管理

### 10.4 迁移建议

**阶段1：准备阶段**（1-2周）
1. 分析所有依赖关系
2. 设计替代方案
3. 编写迁移计划
4. 准备测试用例

**阶段2：重构阶段**（4-6周）
1. 重构 `pallet-deceased`（P0）
2. 重构 `pallet-memorial`（P1）
3. 重构 `pallet-ledger`（P1）
4. 重构 `pallet-stardust-pet`（P2）

**阶段3：清理阶段**（1-2周）
1. 移除 Runtime 配置
2. 移除治理调用
3. 清理相关代码

**阶段4：测试阶段**（2-3周）
1. 单元测试
2. 集成测试
3. 端到端测试
4. 性能测试

**阶段5：部署阶段**（1周）
1. 数据迁移（如果需要）
2. 部署新版本
3. 监控和回滚准备

---

**文档版本**：v1.0.0  
**最后更新**：2025-01-XX  
**维护者**：Stardust 开发团队

