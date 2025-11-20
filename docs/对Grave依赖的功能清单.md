# 对 Grave 依赖的功能清单

> **目标**：全面列出 Stardust 项目中所有依赖 `pallet-stardust-grave` 的功能模块、接口、存储项等

---

## 📋 目录

1. [依赖概览](#1-依赖概览)
2. [Pallet 级别依赖](#2-pallet-级别依赖)
3. [接口级别依赖](#3-接口级别依赖)
4. [存储项依赖](#4-存储项依赖)
5. [Trait 依赖](#5-trait-依赖)
6. [Runtime 配置依赖](#6-runtime-配置依赖)
7. [治理功能依赖](#7-治理功能依赖)
8. [前端功能依赖](#8-前端功能依赖)
9. [依赖关系图](#9-依赖关系图)

---

## 1. 依赖概览

### 1.1 依赖统计

| 依赖类型 | 数量 | 影响程度 |
|---------|------|---------|
| **直接依赖的 Pallet** | 3 个 | ⭐⭐⭐⭐⭐ |
| **接口依赖** | 20+ 个 | ⭐⭐⭐⭐⭐ |
| **存储项依赖** | 15+ 个 | ⭐⭐⭐⭐ |
| **Trait 依赖** | 5 个 | ⭐⭐⭐⭐ |
| **Runtime 配置** | 1 个 | ⭐⭐⭐⭐⭐ |
| **治理功能** | 4 个 | ⭐⭐⭐⭐ |

### 1.2 依赖分类

**核心依赖**（必须）：
- `pallet-deceased`：通过 `GraveInspector` trait
- `pallet-memorial`：通过 `TargetControl` 和 `GraveProvider` trait
- `pallet-stardust-pet`：通过 `GraveInspector` trait
- Runtime：直接注册和配置

**间接依赖**（可选）：
- `pallet-ledger`：可能使用 Grave 相关功能
- 前端：使用 Grave 相关接口

---

## 2. Pallet 级别依赖

### 2.1 pallet-deceased（⭐⭐⭐⭐⭐ 严重依赖）

#### 依赖方式
- **Trait**：`GraveInspector<AccountId, GraveId>`
- **配置**：`type GraveProvider: GraveInspector<Self::AccountId, Self::GraveId>`

#### 依赖的功能

**1. 创建逝者（`create_deceased`）**
- **依赖接口**：`grave_exists(grave_id)` - 检查墓位是否存在
- **依赖接口**：`can_attach(who, grave_id)` - 检查权限
- **依赖接口**：`record_interment(...)` - 记录安葬
- **依赖存储**：`Graves` - 读取墓位信息
- **依赖存储**：`GraveAdmins` - 读取管理员列表
- **依赖存储**：`Interments` - 写入安葬记录
- **依赖存储**：`PrimaryDeceasedOf` - 更新主逝者

**2. 更新逝者（`update_deceased`）**
- **无直接依赖**（仅检查逝者owner权限）

**3. 删除逝者（`remove_deceased`）**
- **无直接依赖**（仅检查逝者owner权限）

**4. 迁移逝者（`transfer_deceased`）**
- **依赖接口**：`grave_exists(new_grave)` - 检查目标墓位存在
- **依赖接口**：`check_admission_policy(who, new_grave)` - 检查准入策略
- **依赖接口**：`record_exhumation(old_grave, deceased_id)` - 记录起掘
- **依赖接口**：`record_interment(new_grave, deceased_id, ...)` - 记录安葬
- **依赖存储**：`Graves` - 读取墓位信息
- **依赖存储**：`AdmissionPolicyOf` - 读取准入策略
- **依赖存储**：`AdmissionWhitelist` - 读取准入白名单
- **依赖存储**：`Interments` - 更新安葬记录

**5. 转让拥有权（`transfer_deceased_owner`）**
- **无直接依赖**（仅检查逝者owner权限）

**6. 治理转让（`gov_transfer_deceased`）**
- **依赖接口**：`grave_exists(new_grave)` - 检查目标墓位存在
- **依赖接口**：`record_exhumation(old_grave, deceased_id)` - 记录起掘
- **依赖接口**：`record_interment(new_grave, deceased_id, ...)` - 记录安葬

**7. 关系管理（`add_relation`, `remove_relation` 等）**
- **依赖接口**：`can_attach(who, grave_id)` - 检查权限（通过逝者的grave_id）

**8. 数据结构**
- **依赖字段**：`Deceased.grave_id: T::GraveId` - 逝者所属墓位
- **依赖存储**：`DeceasedByGrave` - 墓位到逝者列表的索引

#### 依赖的 Trait 方法

| 方法 | 用途 | 调用位置 |
|------|------|---------|
| `grave_exists(grave_id)` | 检查墓位是否存在 | `create_deceased`, `transfer_deceased`, `gov_transfer_deceased` |
| `can_attach(who, grave_id)` | 检查权限 | `create_deceased`, `add_relation`, `remove_relation` 等 |
| `owner_of(grave_id)` | 获取墓主（可选） | 未来可能使用 |
| `record_interment(...)` | 记录安葬 | `create_deceased`, `transfer_deceased` |
| `record_exhumation(...)` | 记录起掘 | `transfer_deceased` |
| `check_admission_policy(who, grave_id)` | 检查准入策略 | `transfer_deceased` |

### 2.2 pallet-memorial（⭐⭐⭐⭐ 较高依赖）

#### 依赖方式
- **Trait**：`TargetControl<Origin, AccountId>` - 目标访问控制
- **Trait**：`GraveProvider<AccountId>` - 获取墓位所有者
- **配置**：`type TargetControl: TargetControl<Self::RuntimeOrigin, Self::AccountId>`
- **配置**：`type GraveProvider: GraveProvider<Self::AccountId>`

#### 依赖的功能

**1. 供奉下单（`offer`）**
- **依赖接口**：`TargetControl::exists(grave_id)` - 检查墓位存在
- **依赖接口**：`TargetControl::ensure_allowed(origin, grave_id)` - 检查权限
- **依赖接口**：`GraveProvider::owner_of(grave_id)` - 获取墓主（用于分账）
- **依赖存储**：`Graves` - 读取墓位信息
- **依赖存储**：`GraveAdmins` - 读取管理员列表
- **依赖存储**：`Members` - 读取成员列表（如果墓位有成员限制）

**2. 分账逻辑（`transfer_with_simple_route`）**
- **依赖接口**：`GraveProvider::owner_of(grave_id)` - 获取墓主
- **依赖存储**：`Graves` - 读取墓位信息

**3. 供奉记录**
- **依赖字段**：`OfferingRecord.grave_id: u64` - 供奉目标墓位
- **依赖存储**：`OfferingsByGrave` - 按墓位索引供奉记录

**4. 回调处理（`OnOfferingCommitted`）**
- **依赖接口**：`on_offering(grave_id, ...)` - 供奉回调
- **依赖存储**：`DeceasedByGrave` - 获取墓位中的逝者列表（用于统计）

#### 依赖的 Trait 方法

| 方法 | 用途 | 调用位置 |
|------|------|---------|
| `TargetControl::exists(grave_id)` | 检查墓位存在 | `offer` |
| `TargetControl::ensure_allowed(origin, grave_id)` | 检查权限 | `offer` |
| `GraveProvider::owner_of(grave_id)` | 获取墓主 | `transfer_with_simple_route` |

### 2.3 pallet-stardust-pet（⭐⭐⭐ 中等依赖）

#### 依赖方式
- **Trait**：`GraveInspector<AccountId, GraveId>`
- **配置**：`type GraveInspector: GraveInspector<Self::AccountId, Self::GraveId>`

#### 依赖的功能

**1. 创建宠物（`create_pet`）**
- **依赖接口**：`grave_exists(grave_id)` - 检查墓位存在（如果指定grave_id）
- **依赖接口**：`can_attach(who, grave_id)` - 检查权限（如果指定grave_id）
- **依赖存储**：`Graves` - 读取墓位信息
- **依赖存储**：`GraveAdmins` - 读取管理员列表

**2. 更新宠物（`update_pet`）**
- **依赖接口**：`can_attach(who, grave_id)` - 检查权限（如果修改grave_id）

**3. 数据结构**
- **依赖字段**：`Pet.grave_id: Option<u64>` - 宠物所属墓位（可选）

#### 依赖的 Trait 方法

| 方法 | 用途 | 调用位置 |
|------|------|---------|
| `grave_exists(grave_id)` | 检查墓位存在 | `create_pet`（如果指定grave_id） |
| `can_attach(who, grave_id)` | 检查权限 | `create_pet`, `update_pet`（如果指定grave_id） |

### 2.4 pallet-ledger（⭐⭐ 较低依赖）

#### 依赖方式
- **可能依赖**：通过 Grave ID 进行供奉统计

#### 依赖的功能

**1. 供奉统计**
- **可能依赖**：`grave_id` 用于统计墓位的供奉记录
- **依赖存储**：可能使用 `OfferingsByGrave`（通过 memorial pallet）

---

## 3. 接口级别依赖

### 3.1 pallet-deceased 接口依赖

| 接口 | 依赖的 Grave 功能 | 依赖程度 |
|------|------------------|---------|
| `create_deceased` | `grave_exists`, `can_attach`, `record_interment` | ⭐⭐⭐⭐⭐ |
| `transfer_deceased` | `grave_exists`, `check_admission_policy`, `record_exhumation`, `record_interment` | ⭐⭐⭐⭐⭐ |
| `gov_transfer_deceased` | `grave_exists`, `record_exhumation`, `record_interment` | ⭐⭐⭐⭐ |
| `add_relation` | `can_attach`（通过逝者的grave_id） | ⭐⭐⭐ |
| `remove_relation` | `can_attach`（通过逝者的grave_id） | ⭐⭐⭐ |
| `update_relation` | `can_attach`（通过逝者的grave_id） | ⭐⭐⭐ |
| `approve_relation` | `can_attach`（通过逝者的grave_id） | ⭐⭐⭐ |
| `reject_relation` | `can_attach`（通过逝者的grave_id） | ⭐⭐⭐ |

### 3.2 pallet-memorial 接口依赖

| 接口 | 依赖的 Grave 功能 | 依赖程度 |
|------|------------------|---------|
| `offer` | `TargetControl::exists`, `TargetControl::ensure_allowed`, `GraveProvider::owner_of` | ⭐⭐⭐⭐⭐ |
| `get_offerings_by_grave` | `OfferingsByGrave` 存储 | ⭐⭐⭐ |

### 3.3 pallet-stardust-pet 接口依赖

| 接口 | 依赖的 Grave 功能 | 依赖程度 |
|------|------------------|---------|
| `create_pet` | `grave_exists`, `can_attach`（如果指定grave_id） | ⭐⭐⭐ |
| `update_pet` | `can_attach`（如果修改grave_id） | ⭐⭐⭐ |

---

## 4. 存储项依赖

### 4.1 直接读取的存储项

| 存储项 | 读取位置 | 用途 |
|--------|---------|------|
| `Graves` | `pallet-deceased`, `pallet-memorial`, `pallet-stardust-pet` | 读取墓位信息 |
| `GraveAdmins` | `pallet-deceased`, `pallet-stardust-pet` | 读取管理员列表 |
| `Interments` | `pallet-deceased`（通过record_interment） | 读取/写入安葬记录 |
| `PrimaryDeceasedOf` | `pallet-deceased`（通过record_interment） | 读取/写入主逝者 |
| `AdmissionPolicyOf` | `pallet-deceased`（通过check_admission_policy） | 读取准入策略 |
| `AdmissionWhitelist` | `pallet-deceased`（通过check_admission_policy） | 读取准入白名单 |
| `Members` | `pallet-memorial`（可能） | 读取成员列表 |
| `DeceasedByGrave` | `pallet-memorial`（回调中） | 读取墓位中的逝者列表 |

### 4.2 间接依赖的存储项

| 存储项 | 依赖位置 | 用途 |
|--------|---------|------|
| `GravesByPark` | 可能用于查询 | 按园区查询墓位 |
| `SlugOf` | 可能用于查询 | 通过Slug查询墓位 |
| `GraveBySlug` | 可能用于查询 | 通过Slug查询墓位 |

---

## 5. Trait 依赖

### 5.1 GraveInspector Trait

**定义位置**：`pallets/deceased/src/lib.rs`

**实现位置**：`runtime/src/configs/mod.rs` - `GraveProviderAdapter`

**依赖的 Grave 功能**：
- `Graves::contains_key(grave_id)` - 检查墓位存在
- `Graves::get(grave_id)` - 读取墓位信息
- `GraveAdmins::get(grave_id)` - 读取管理员列表
- `ParkAdminOrigin::ensure(pid, origin)` - 检查园区管理员权限
- `Pallet::do_inter_internal(...)` - 内部安葬函数
- `Pallet::do_exhume_internal(...)` - 内部起掘函数
- `Pallet::check_admission_policy(who, grave_id)` - 检查准入策略

**使用位置**：
- `pallet-deceased`：通过 `type GraveProvider: GraveInspector`
- `pallet-stardust-pet`：通过 `type GraveInspector: GraveInspector`

### 5.2 TargetControl Trait

**定义位置**：`pallets/memorial/src/types.rs`

**实现位置**：`runtime/src/configs/mod.rs` - `MemorialTargetControl`

**依赖的 Grave 功能**：
- `Graves::contains_key(grave_id)` - 检查墓位存在
- `Graves::get(grave_id)` - 读取墓位信息
- `GraveAdmins::get(grave_id)` - 读取管理员列表

**使用位置**：
- `pallet-memorial`：通过 `type TargetControl: TargetControl`

### 5.3 GraveProvider Trait

**定义位置**：`pallets/memorial/src/types.rs`

**实现位置**：`runtime/src/configs/mod.rs` - `MemorialGraveProvider`

**依赖的 Grave 功能**：
- `Graves::get(grave_id).map(|g| g.owner)` - 获取墓主

**使用位置**：
- `pallet-memorial`：通过 `type GraveProvider: GraveProvider`

### 5.4 DeceasedTokenAccess Trait

**定义位置**：`pallets/stardust-grave/src/lib.rs`

**实现位置**：`runtime/src/configs/mod.rs` - `DeceasedTokenAdapter`

**依赖的 Grave 功能**：
- 无（此 Trait 由 Grave 定义，但实现时读取 Deceased 的 token）

**使用位置**：
- `pallet-stardust-grave`：通过 `type DeceasedTokenProvider: DeceasedTokenAccess`

### 5.5 OnIntermentCommitted Trait

**定义位置**：`pallets/stardust-grave/src/lib.rs`

**实现位置**：`runtime/src/configs/mod.rs` - `NoopIntermentHook`

**依赖的 Grave 功能**：
- 无（此 Trait 由 Grave 定义，用于回调）

**使用位置**：
- `pallet-stardust-grave`：通过 `type OnInterment: OnIntermentCommitted`

### 5.6 ParkAdminOrigin Trait

**定义位置**：`pallets/stardust-grave/src/lib.rs`

**实现位置**：`runtime/src/configs/mod.rs` - `RootOnlyParkAdmin`

**依赖的 Grave 功能**：
- 无（此 Trait 由 Grave 定义，用于权限检查）

**使用位置**：
- `pallet-stardust-grave`：通过 `type ParkAdmin: ParkAdminOrigin`
- `pallet-deceased`：通过 `GraveInspector::can_attach` 间接使用

---

## 6. Runtime 配置依赖

### 6.1 Pallet 注册

**位置**：`runtime/src/lib.rs`

```rust
pub type Grave = pallet_stardust_grave;
```

**依赖内容**：
- 直接注册 `pallet-stardust-grave` pallet
- 提供 `Grave::Call`, `Grave::Event` 等类型

### 6.2 Pallet 配置

**位置**：`runtime/src/configs/mod.rs`

**配置项**：
```rust
impl pallet_stardust_grave::Config for Runtime {
    type WeightInfo = pallet_stardust_grave::weights::TestWeights;
    type MaxCidLen = GraveMaxCidLen;
    type MaxPerPark = GraveMaxPerPark;
    type MaxIntermentsPerGrave = GraveMaxIntermentsPerGrave;
    type OnInterment = NoopIntermentHook;
    type ParkAdmin = RootOnlyParkAdmin;
    type MaxIdsPerName = GraveMaxIdsPerName;
    type MaxComplaintsPerGrave = GraveMaxComplaints;
    type MaxAdminsPerGrave = GraveMaxAdmins;
    type MaxFollowers = GraveMaxFollowers;
    type SlugLen = GraveSlugLen;
    type GovernanceOrigin = EitherOfDiverse<...>;
    type DeceasedTokenProvider = DeceasedTokenAdapter;
    type FollowCooldownBlocks = GraveFollowCooldownBlocks;
    type Currency = Balances;
    type FollowDeposit = GraveFollowDeposit;
    type CreateFee = GraveCreateFee;
    type FeeCollector = TreasuryAccount;
    type MaxCoverOptions = GraveMaxCoverOptions;
    type MaxAudioOptions = GraveMaxCoverOptions;
    type MaxPrivateAudioOptions = GraveMaxCoverOptions;
    type MaxAudioPlaylistLen = GraveMaxCoverOptions;
    type MaxCarouselItems = GraveMaxCarouselItems;
    type MaxTitleLen = GraveMaxTitleLen;
    type MaxLinkLen = GraveMaxLinkLen;
    type IpfsPinner = StardustIpfs;
    type Balance = Balance;
    type DefaultStoragePrice = GraveDefaultStoragePrice;
}
```

### 6.3 适配器实现

**位置**：`runtime/src/configs/mod.rs`

**适配器**：
1. `GraveProviderAdapter` - 实现 `GraveInspector` trait
2. `MemorialTargetControl` - 实现 `TargetControl` trait
3. `MemorialGraveProvider` - 实现 `GraveProvider` trait
4. `DeceasedTokenAdapter` - 实现 `DeceasedTokenAccess` trait
5. `NoopIntermentHook` - 实现 `OnIntermentCommitted` trait
6. `RootOnlyParkAdmin` - 实现 `ParkAdminOrigin` trait

---

## 7. 治理功能依赖

### 7.1 治理调用

**位置**：`runtime/src/configs/mod.rs` - `construct_runtime!` 中的治理调用

**依赖的 Grave 接口**：

| 治理调用 | Grave 接口 | 用途 |
|---------|-----------|------|
| `(1, 10)` | `clear_cover_via_governance` | 治理清除封面 |
| `(1, 11)` | `gov_transfer_grave` | 治理转让墓位 |
| `(1, 12)` | `gov_set_restricted` | 治理设置限制 |
| `(1, 13)` | `gov_remove_grave` | 治理删除墓位 |
| `(1, 14)` | `gov_restore_grave` | 治理恢复墓位 |

**调用方式**：
```rust
(1, 10) => pallet_stardust_grave::pallet::Pallet::<Runtime>::clear_cover_via_governance(
    origin, grave_id
),
(1, 11) => pallet_stardust_grave::pallet::Pallet::<Runtime>::gov_transfer_grave(
    origin, grave_id, new_owner
),
// ... 其他治理调用
```

---

## 8. 前端功能依赖

### 8.1 前端接口依赖

**可能依赖的接口**（需要前端代码确认）：
- `create_grave` - 创建墓位
- `update_grave` - 更新墓位
- `transfer_grave` - 转让墓位
- `set_cover` - 设置封面
- `set_audio` - 设置音频
- `follow` - 关注墓位
- `unfollow` - 取消关注
- `add_admin` - 添加管理员
- `set_policy` - 设置策略
- `set_admission_policy` - 设置准入策略
- 其他 Grave 相关接口

---

## 9. 依赖关系图

### 9.1 完整依赖关系

```
pallet-stardust-grave (核心)
    │
    ├── Runtime
    │   ├── Pallet 注册
    │   ├── Config 配置
    │   └── 适配器实现
    │       ├── GraveProviderAdapter (GraveInspector)
    │       ├── MemorialTargetControl (TargetControl)
    │       ├── MemorialGraveProvider (GraveProvider)
    │       ├── DeceasedTokenAdapter (DeceasedTokenAccess)
    │       ├── NoopIntermentHook (OnIntermentCommitted)
    │       └── RootOnlyParkAdmin (ParkAdminOrigin)
    │
    ├── pallet-deceased (严重依赖)
    │   ├── GraveInspector trait
    │   ├── create_deceased → grave_exists, can_attach, record_interment
    │   ├── transfer_deceased → grave_exists, check_admission_policy, record_exhumation, record_interment
    │   ├── add_relation → can_attach
    │   └── Deceased.grave_id 字段
    │
    ├── pallet-memorial (较高依赖)
    │   ├── TargetControl trait
    │   ├── GraveProvider trait
    │   ├── offer → exists, ensure_allowed, owner_of
    │   ├── transfer_with_simple_route → owner_of
    │   └── OfferingRecord.grave_id 字段
    │
    ├── pallet-stardust-pet (中等依赖)
    │   ├── GraveInspector trait
    │   ├── create_pet → grave_exists, can_attach
    │   └── Pet.grave_id 字段
    │
    ├── pallet-ledger (较低依赖)
    │   └── 可能使用 grave_id 进行统计
    │
    └── 治理功能
        ├── clear_cover_via_governance
        ├── gov_transfer_grave
        ├── gov_set_restricted
        ├── gov_remove_grave
        └── gov_restore_grave
```

### 9.2 依赖强度分类

#### 核心依赖（必须存在）

1. **pallet-deceased**
   - 依赖强度：⭐⭐⭐⭐⭐
   - 依赖原因：逝者必须关联到 Grave
   - 影响：如果删除 Grave，需要重构整个逝者管理逻辑

2. **pallet-memorial**
   - 依赖强度：⭐⭐⭐⭐
   - 依赖原因：供奉需要 Grave 作为目标
   - 影响：如果删除 Grave，需要重构供奉目标系统

3. **Runtime 配置**
   - 依赖强度：⭐⭐⭐⭐⭐
   - 依赖原因：直接注册和配置 Grave pallet
   - 影响：如果删除 Grave，需要移除注册和配置

#### 次要依赖（可以替代）

1. **pallet-stardust-pet**
   - 依赖强度：⭐⭐⭐
   - 依赖原因：Pet 可以关联到 Grave（可选）
   - 影响：如果删除 Grave，Pet 可以不关联 Grave

2. **pallet-ledger**
   - 依赖强度：⭐⭐
   - 依赖原因：可能使用 Grave 进行统计
   - 影响：如果删除 Grave，可以使用其他方式统计

---

## 10. 详细依赖清单

### 10.1 pallet-deceased 详细依赖

#### 数据结构依赖

| 数据结构 | 依赖字段 | 用途 |
|---------|---------|------|
| `Deceased<T>` | `grave_id: T::GraveId` | 逝者所属墓位 |
| `DeceasedByGrave` | `GraveId -> Vec<DeceasedId>` | 墓位到逝者列表索引 |

#### 接口依赖

| 接口 | 依赖的 Grave 功能 | 调用链 |
|------|------------------|--------|
| `create_deceased` | `grave_exists`, `can_attach`, `record_interment` | `create_deceased` → `GraveInspector::grave_exists` → `Graves::contains_key`<br>`create_deceased` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get`<br>`create_deceased` → `GraveInspector::record_interment` → `Pallet::do_inter_internal` |
| `transfer_deceased` | `grave_exists`, `check_admission_policy`, `record_exhumation`, `record_interment` | `transfer_deceased` → `GraveInspector::grave_exists` → `Graves::contains_key`<br>`transfer_deceased` → `GraveInspector::check_admission_policy` → `Pallet::check_admission_policy`<br>`transfer_deceased` → `GraveInspector::record_exhumation` → `Pallet::do_exhume_internal`<br>`transfer_deceased` → `GraveInspector::record_interment` → `Pallet::do_inter_internal` |
| `add_relation` | `can_attach` | `add_relation` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get` |
| `remove_relation` | `can_attach` | `remove_relation` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get` |
| `update_relation` | `can_attach` | `update_relation` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get` |
| `approve_relation` | `can_attach` | `approve_relation` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get` |
| `reject_relation` | `can_attach` | `reject_relation` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get` |

#### 存储项依赖

| 存储项 | 读取位置 | 写入位置 | 用途 |
|--------|---------|---------|------|
| `Graves` | `GraveInspector::can_attach` | - | 读取墓位信息 |
| `GraveAdmins` | `GraveInspector::can_attach` | - | 读取管理员列表 |
| `Interments` | - | `GraveInspector::record_interment` | 写入安葬记录 |
| `PrimaryDeceasedOf` | - | `GraveInspector::record_interment` | 更新主逝者 |
| `AdmissionPolicyOf` | `GraveInspector::check_admission_policy` | - | 读取准入策略 |
| `AdmissionWhitelist` | `GraveInspector::check_admission_policy` | - | 读取准入白名单 |

### 10.2 pallet-memorial 详细依赖

#### 数据结构依赖

| 数据结构 | 依赖字段 | 用途 |
|---------|---------|------|
| `OfferingRecord<T>` | `grave_id: u64` | 供奉目标墓位 |
| `OfferingsByGrave` | `GraveId -> Vec<OfferingId>` | 按墓位索引供奉记录 |

#### 接口依赖

| 接口 | 依赖的 Grave 功能 | 调用链 |
|------|------------------|--------|
| `offer` | `TargetControl::exists`, `TargetControl::ensure_allowed`, `GraveProvider::owner_of` | `offer` → `TargetControl::exists` → `Graves::contains_key`<br>`offer` → `TargetControl::ensure_allowed` → `Graves::get`, `GraveAdmins::get`<br>`offer` → `GraveProvider::owner_of` → `Graves::get` |
| `transfer_with_simple_route` | `GraveProvider::owner_of` | `transfer_with_simple_route` → `GraveProvider::owner_of` → `Graves::get` |
| `get_offerings_by_grave` | `OfferingsByGrave` | 直接读取 `OfferingsByGrave` 存储 |

#### 存储项依赖

| 存储项 | 读取位置 | 写入位置 | 用途 |
|--------|---------|---------|------|
| `Graves` | `TargetControl::exists`, `TargetControl::ensure_allowed`, `GraveProvider::owner_of` | - | 读取墓位信息 |
| `GraveAdmins` | `TargetControl::ensure_allowed` | - | 读取管理员列表 |
| `Members` | `TargetControl::ensure_allowed`（可能） | - | 读取成员列表 |
| `OfferingsByGrave` | `get_offerings_by_grave` | `offer` | 按墓位索引供奉记录 |

### 10.3 pallet-stardust-pet 详细依赖

#### 数据结构依赖

| 数据结构 | 依赖字段 | 用途 |
|---------|---------|------|
| `Pet<T>` | `grave_id: Option<u64>` | 宠物所属墓位（可选） |

#### 接口依赖

| 接口 | 依赖的 Grave 功能 | 调用链 |
|------|------------------|--------|
| `create_pet` | `grave_exists`, `can_attach`（如果指定grave_id） | `create_pet` → `GraveInspector::grave_exists` → `Graves::contains_key`<br>`create_pet` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get` |
| `update_pet` | `can_attach`（如果修改grave_id） | `update_pet` → `GraveInspector::can_attach` → `Graves::get`, `GraveAdmins::get` |

#### 存储项依赖

| 存储项 | 读取位置 | 写入位置 | 用途 |
|--------|---------|---------|------|
| `Graves` | `GraveInspector::grave_exists`, `GraveInspector::can_attach` | - | 读取墓位信息 |
| `GraveAdmins` | `GraveInspector::can_attach` | - | 读取管理员列表 |

### 10.4 Runtime 详细依赖

#### Pallet 注册

```rust
// runtime/src/lib.rs
pub type Grave = pallet_stardust_grave;

// construct_runtime! 中
pub type Grave = pallet_stardust_grave;
```

#### Config 配置

```rust
// runtime/src/configs/mod.rs
impl pallet_stardust_grave::Config for Runtime {
    // 所有配置项都依赖 Grave pallet
}
```

#### 适配器实现

| 适配器 | 实现的 Trait | 依赖的 Grave 功能 |
|--------|------------|------------------|
| `GraveProviderAdapter` | `GraveInspector` | `Graves`, `GraveAdmins`, `Pallet::do_inter_internal`, `Pallet::do_exhume_internal`, `Pallet::check_admission_policy` |
| `MemorialTargetControl` | `TargetControl` | `Graves`, `GraveAdmins` |
| `MemorialGraveProvider` | `GraveProvider` | `Graves` |
| `DeceasedTokenAdapter` | `DeceasedTokenAccess` | 无（读取 Deceased 的 token） |
| `NoopIntermentHook` | `OnIntermentCommitted` | 无（空实现） |
| `RootOnlyParkAdmin` | `ParkAdminOrigin` | 无（权限检查） |

### 10.5 治理功能详细依赖

| 治理调用 | Grave 接口 | 参数 | 用途 |
|---------|-----------|------|------|
| `(1, 10)` | `clear_cover_via_governance` | `origin, grave_id` | 治理清除封面 |
| `(1, 11)` | `gov_transfer_grave` | `origin, grave_id, new_owner` | 治理转让墓位 |
| `(1, 12)` | `gov_set_restricted` | `origin, grave_id, restricted, reason_code` | 治理设置限制 |
| `(1, 13)` | `gov_remove_grave` | `origin, grave_id, reason_code` | 治理删除墓位 |
| `(1, 14)` | `gov_restore_grave` | `origin, grave_id` | 治理恢复墓位 |

---

## 11. 依赖影响分析

### 11.1 如果删除 Grave 的影响

#### 影响1：pallet-deceased 需要重构 ⚠️⚠️⚠️

**影响内容**：
- 需要移除 `Deceased.grave_id` 字段
- 需要移除 `DeceasedByGrave` 存储
- 需要重构 `create_deceased` 接口
- 需要重构 `transfer_deceased` 接口
- 需要移除 `GraveInspector` trait 依赖

**影响程度**：⭐⭐⭐⭐⭐（严重）

#### 影响2：pallet-memorial 需要重构 ⚠️⚠️⚠️

**影响内容**：
- 需要重构 `TargetControl` trait（支持多目标类型）
- 需要重构 `GraveProvider` trait（支持多目标类型）
- 需要重构 `offer` 接口（支持多目标类型）
- 需要重构分账逻辑（支持多目标类型）
- 需要移除 `OfferingsByGrave` 存储（或改为多维度索引）

**影响程度**：⭐⭐⭐⭐（较高）

#### 影响3：pallet-stardust-pet 需要调整 ⚠️⚠️

**影响内容**：
- 需要移除 `Pet.grave_id` 字段（或改为可选）
- 需要移除 `GraveInspector` trait 依赖
- 需要调整 `create_pet` 接口

**影响程度**：⭐⭐⭐（中等）

#### 影响4：Runtime 需要重构 ⚠️⚠️⚠️

**影响内容**：
- 需要移除 `pallet-stardust-grave` 注册
- 需要移除 `pallet-stardust-grave` 配置
- 需要重构所有适配器实现
- 需要移除治理调用

**影响程度**：⭐⭐⭐⭐⭐（严重）

---

## 12. 总结

### 12.1 核心依赖

**必须处理的依赖**：
1. **pallet-deceased**：严重依赖 Grave，需要重构
2. **pallet-memorial**：较高依赖 Grave，需要重构
3. **Runtime**：直接注册和配置，需要移除

**可以保留的依赖**：
1. **pallet-stardust-pet**：中等依赖，可以调整为可选

### 12.2 依赖统计

| 依赖类型 | 数量 | 处理难度 |
|---------|------|---------|
| **Pallet 依赖** | 3 个 | 高 |
| **接口依赖** | 20+ 个 | 高 |
| **存储项依赖** | 15+ 个 | 中 |
| **Trait 依赖** | 5 个 | 中 |
| **Runtime 配置** | 1 个 | 高 |
| **治理功能** | 4 个 | 中 |

### 12.3 建议

1. **优先处理**：pallet-deceased 和 pallet-memorial 的依赖
2. **分阶段处理**：先重构接口，再迁移数据
3. **保持兼容**：确保旧接口继续工作
4. **充分测试**：覆盖所有依赖场景

---

**文档版本**：v1.0.0  
**最后更新**：2025-01-XX  
**维护者**：Stardust 开发团队

