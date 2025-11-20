# 删除 pallet-stardust-grave 详细方案

> **目标**：安全、完整地删除 `pallet-stardust-grave`，将其功能迁移到其他 pallet 或新设计

---

## 📋 目录

1. [现状分析](#1-现状分析)
2. [依赖关系分析](#2-依赖关系分析)
3. [功能清单](#3-功能清单)
4. [迁移策略](#4-迁移策略)
5. [详细执行步骤](#5-详细执行步骤)
6. [风险评估](#6-风险评估)
7. [回滚方案](#7-回滚方案)
8. [测试计划](#8-测试计划)
9. [时间规划](#9-时间规划)

---

## 1. 现状分析

### 1.1 pallet-stardust-grave 概述

**位置**：`pallets/stardust-grave/`

**核心功能**：
- 墓位（Grave）管理：创建、更新、删除、转让
- 安葬/起掘记录（Interments）
- 墓位权限管理（owner、admin、park admin）
- 准入策略（OwnerOnly、Public、Whitelist）
- 元数据管理（封面、音频、轮播图）
- 关注系统
- 成员管理
- 亲属关系管理

**代码规模**：
- 主文件：`src/lib.rs`（约 3200+ 行）
- 测试文件：`src/tests.rs`、`src/tests_primary_deceased.rs`
- Mock 文件：`src/mock.rs`
- 权重文件：`src/weights.rs`
- Benchmark 文件：`src/benchmarking.rs`

### 1.2 删除原因分析

**潜在原因**：
1. **功能重复**：与其他 pallet 功能重叠
2. **架构重构**：需要重新设计墓位管理机制
3. **简化系统**：减少 pallet 数量，降低复杂度
4. **性能优化**：合并功能到其他 pallet 提升性能

**⚠️ 重要**：删除前必须明确删除原因，确保不会影响现有功能

---

## 2. 依赖关系分析

### 2.1 直接依赖 pallet-stardust-grave 的模块

#### 2.1.1 pallet-deceased

**依赖方式**：通过 `GraveInspector` trait

**使用场景**：
- `create_deceased`：检查墓位存在和权限
- `transfer_deceased`：检查目标墓位准入策略
- `record_interment`：记录安葬操作
- `record_exhumation`：记录起掘操作

**关键接口**：
```rust
pub trait GraveInspector<AccountId, GraveId> {
    fn grave_exists(grave_id: GraveId) -> bool;
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool;
    fn owner_of(grave_id: GraveId) -> Option<AccountId>;
    fn record_interment(grave_id: GraveId, deceased_id: u64, slot: Option<u16>, note_cid: Option<BoundedVec<u8, MaxCidLen>>) -> DispatchResult;
    fn record_exhumation(grave_id: GraveId, deceased_id: u64) -> DispatchResult;
    fn check_admission_policy(who: &AccountId, grave_id: GraveId) -> DispatchResult;
}
```

**影响程度**：⭐⭐⭐⭐⭐（严重）

#### 2.1.2 pallet-memorial

**依赖方式**：通过 `GraveProvider` trait

**使用场景**：
- `offer_by_sacrifice`：获取墓位所有者，用于分账

**关键接口**：
```rust
pub trait GraveProvider<AccountId> {
    fn owner_of(grave_id: u64) -> Option<AccountId>;
}
```

**影响程度**：⭐⭐⭐（中等）

#### 2.1.3 pallet-stardust-pet

**依赖方式**：通过 `GraveInspector` trait

**使用场景**：
- 宠物与墓位的关联检查

**影响程度**：⭐⭐（较低）

#### 2.1.4 Runtime 配置

**依赖方式**：直接注册 pallet

**位置**：
- `runtime/src/lib.rs`：注册 pallet
- `runtime/src/configs/mod.rs`：实现 `GraveProviderAdapter`

**影响程度**：⭐⭐⭐⭐⭐（严重）

### 2.2 依赖关系图

```
pallet-stardust-grave
    │
    ├── pallet-deceased (GraveInspector trait)
    │   └── 核心依赖：创建逝者、迁移逝者、安葬记录
    │
    ├── pallet-memorial (GraveProvider trait)
    │   └── 核心依赖：获取墓位所有者（分账）
    │
    ├── pallet-stardust-pet (GraveInspector trait)
    │   └── 次要依赖：宠物关联检查
    │
    └── Runtime
        ├── 注册 pallet
        ├── 实现 GraveProviderAdapter
        └── 治理调用（gov_transfer_grave, gov_remove_grave 等）
```

---

## 3. 功能清单

### 3.1 存储项清单

| 存储项 | 类型 | 用途 | 迁移目标 |
|--------|------|------|---------|
| `NextGraveId` | `StorageValue<u64>` | 下一个墓位ID | 迁移到新 pallet |
| `Graves` | `StorageMap<u64, Grave>` | 墓位主数据 | 迁移到新 pallet |
| `GravesByPark` | `StorageMap<u64, BoundedVec<u64>>` | 园区墓位索引 | 迁移到新 pallet |
| `Interments` | `StorageMap<u64, BoundedVec<IntermentRecord>>` | 安葬记录 | 迁移到新 pallet |
| `PrimaryDeceasedOf` | `StorageMap<u64, u64>` | 主逝者索引 | 迁移到新 pallet |
| `AdmissionPolicyOf` | `StorageMap<u64, GraveAdmissionPolicy>` | 准入策略 | 迁移到新 pallet |
| `AdmissionWhitelistOf` | `StorageDoubleMap<u64, AccountId, ()>` | 准入白名单 | 迁移到新 pallet |
| `GraveAdmins` | `StorageMap<u64, BoundedVec<AccountId>>` | 管理员列表 | 迁移到新 pallet |
| `JoinPolicyOf` | `StorageMap<u64, u8>` | 加入策略 | 迁移到新 pallet |
| `Members` | `StorageDoubleMap<u64, AccountId, ()>` | 成员列表 | 迁移到新 pallet |
| `PendingApplications` | `StorageDoubleMap<u64, AccountId, BlockNumber>` | 待审批申请 | 迁移到新 pallet |
| `KinshipOf` | `StorageDoubleMap<u64, DeceasedId, AccountId, KinshipCode>` | 亲属关系 | 迁移到新 pallet |
| `KinshipPolicyOf` | `StorageMap<u64, u8>` | 亲属关系策略 | 迁移到新 pallet |
| `FollowersOf` | `StorageDoubleMap<u64, AccountId, BlockNumber>` | 关注者列表 | 迁移到新 pallet |
| `FollowingOf` | `StorageDoubleMap<AccountId, u64, BlockNumber>` | 关注列表 | 迁移到新 pallet |
| `FollowCooldownOf` | `StorageDoubleMap<u64, AccountId, BlockNumber>` | 关注冷却时间 | 迁移到新 pallet |
| `GraveMetaOf` | `StorageMap<u64, GraveMeta>` | 墓位元数据 | 迁移到新 pallet |
| `CoverOf` | `StorageMap<u64, BoundedVec<u8>>` | 封面CID | 迁移到新 pallet |
| `CoverOptions` | `StorageValue<BoundedVec<BoundedVec<u8>>>` | 公共封面目录 | 迁移到新 pallet |
| `AudioOf` | `StorageMap<u64, BoundedVec<u8>>` | 音频CID | 迁移到新 pallet |
| `AudioOptions` | `StorageValue<BoundedVec<BoundedVec<u8>>>` | 公共音频目录 | 迁移到新 pallet |
| `PrivateAudioOptionsOf` | `StorageMap<u64, BoundedVec<BoundedVec<u8>>>` | 私有音频候选 | 迁移到新 pallet |
| `AudioPlaylistOf` | `StorageMap<u64, BoundedVec<BoundedVec<u8>>>` | 播放列表 | 迁移到新 pallet |
| `SlugOf` | `StorageMap<u64, BoundedVec<u8>>` | Slug索引 | 迁移到新 pallet |
| `GraveBySlug` | `StorageMap<BoundedVec<u8>, u64>` | Slug反向索引 | 迁移到新 pallet |
| `CarouselItems` | `StorageValue<BoundedVec<CarouselItem>>` | 轮播图列表 | 迁移到新 pallet |

**总计**：约 25 个存储项

### 3.2 接口清单

#### 3.2.1 核心管理接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `create_grave` | 创建墓位 | 用户 | 迁移到新 pallet |
| `update_grave` | 更新墓位 | 墓主/管理员 | 迁移到新 pallet |
| `transfer_grave` | 转让墓位 | 墓主 | 迁移到新 pallet |
| `remove_grave` | 删除墓位 | 墓主/治理 | 迁移到新 pallet |
| `set_park` | 设置所属园区 | 墓主/园区管理员 | 迁移到新 pallet |

#### 3.2.2 安葬管理接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `inter` | 安葬逝者 | 墓主/管理员 | 迁移到新 pallet |
| `exhume` | 起掘逝者 | 墓主/管理员 | 迁移到新 pallet |
| `set_primary_deceased` | 设置主逝者 | 墓主/管理员 | 迁移到新 pallet |

#### 3.2.3 权限管理接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `add_admin` | 添加管理员 | 墓主/园区管理员 | 迁移到新 pallet |
| `remove_admin` | 移除管理员 | 墓主/园区管理员 | 迁移到新 pallet |
| `set_policy` | 设置加入策略 | 墓主/园区管理员 | 迁移到新 pallet |
| `set_admission_policy` | 设置准入策略 | 墓主/园区管理员 | 迁移到新 pallet |
| `add_to_admission_whitelist` | 添加到准入白名单 | 墓主/园区管理员 | 迁移到新 pallet |
| `remove_from_admission_whitelist` | 从准入白名单移除 | 墓主/园区管理员 | 迁移到新 pallet |

#### 3.2.4 成员管理接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `join_open` | 公开加入 | 用户 | 迁移到新 pallet |
| `apply_join` | 申请加入 | 用户 | 迁移到新 pallet |
| `approve_member` | 批准成员 | 墓主/园区管理员 | 迁移到新 pallet |
| `reject_member` | 拒绝成员 | 墓主/园区管理员 | 迁移到新 pallet |

#### 3.2.5 关注系统接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `follow` | 关注墓位 | 用户 | 迁移到新 pallet |
| `unfollow` | 取消关注 | 用户 | 迁移到新 pallet |

#### 3.2.6 亲属关系接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `declare_kinship` | 声明亲属关系 | 用户 | 迁移到新 pallet |
| `approve_kinship` | 批准亲属关系 | 墓主/管理员 | 迁移到新 pallet |
| `reject_kinship` | 拒绝亲属关系 | 墓主/管理员 | 迁移到新 pallet |
| `update_kinship` | 更新亲属关系 | 墓主/管理员 | 迁移到新 pallet |
| `remove_kinship` | 移除亲属关系 | 墓主/管理员 | 迁移到新 pallet |
| `set_kinship_policy` | 设置亲属关系策略 | 墓主/园区管理员 | 迁移到新 pallet |

#### 3.2.7 元数据管理接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `set_cover` | 设置封面 | 墓主 | 迁移到新 pallet |
| `clear_cover` | 清除封面 | 墓主 | 迁移到新 pallet |
| `set_audio` | 设置音频 | 墓主 | 迁移到新 pallet |
| `clear_audio` | 清除音频 | 墓主 | 迁移到新 pallet |
| `set_meta` | 设置元数据 | 墓主/管理员 | 迁移到新 pallet |

#### 3.2.8 治理接口

| 接口 | 功能 | 调用者 | 迁移目标 |
|------|------|--------|---------|
| `gov_transfer_grave` | 治理转让墓位 | 治理 | 迁移到新 pallet |
| `gov_set_restricted` | 治理设置限制 | 治理 | 迁移到新 pallet |
| `gov_remove_grave` | 治理删除墓位 | 治理 | 迁移到新 pallet |
| `gov_restore_grave` | 治理恢复墓位 | 治理 | 迁移到新 pallet |
| `clear_cover_via_governance` | 治理清除封面 | 治理 | 迁移到新 pallet |
| `set_audio_via_governance` | 治理设置音频 | 治理 | 迁移到新 pallet |

**总计**：约 40+ 个接口

### 3.3 Trait 清单

| Trait | 用途 | 实现者 | 迁移目标 |
|-------|------|--------|---------|
| `OnIntermentCommitted` | 安葬回调 | Runtime | 迁移到新 pallet |
| `ParkAdminOrigin` | 园区管理员权限 | Runtime | 迁移到新 pallet |
| `DeceasedTokenAccess` | 逝者令牌访问 | Runtime | 迁移到新 pallet |

### 3.4 事件清单

**总计**：约 30+ 个事件类型

### 3.5 错误类型清单

**总计**：约 20+ 个错误类型

---

## 4. 迁移策略

### 4.1 策略选择

#### 方案A：迁移到 pallet-deceased（推荐）

**优点**：
- 墓位和逝者关系紧密，逻辑上更合理
- 减少 pallet 数量
- 降低跨 pallet 调用成本

**缺点**：
- `pallet-deceased` 已经很大，可能进一步膨胀
- 需要重构 `pallet-deceased` 的架构

**适用场景**：如果墓位和逝者关系是核心业务逻辑

#### 方案B：创建新 pallet（如 pallet-grave）

**优点**：
- 保持功能独立
- 不影响现有 pallet
- 可以重新设计架构

**缺点**：
- 需要创建新 pallet
- 需要迁移所有数据
- 需要更新所有依赖

**适用场景**：如果需要重新设计墓位管理机制

#### 方案C：拆分到多个 pallet

**优点**：
- 功能更细分
- 降低单个 pallet 复杂度

**缺点**：
- 增加 pallet 数量
- 增加跨 pallet 调用

**适用场景**：如果墓位功能可以明显拆分（如元数据、关注系统等）

### 4.2 推荐方案：方案A（迁移到 pallet-deceased）

**理由**：
1. 墓位和逝者关系是核心业务逻辑
2. 减少 pallet 数量，降低系统复杂度
3. 降低跨 pallet 调用成本

**实施步骤**：
1. 在 `pallet-deceased` 中创建 `grave` 子模块
2. 迁移所有存储项、接口、事件、错误类型
3. 更新 `GraveInspector` trait 实现
4. 更新 Runtime 配置
5. 更新所有依赖

---

## 5. 详细执行步骤

### 5.1 阶段一：准备工作（1-2周）

#### 步骤1.1：创建迁移分支

```bash
git checkout -b feature/remove-pallet-stardust-grave
```

#### 步骤1.2：备份当前代码

```bash
# 备份 pallet-stardust-grave
cp -r pallets/stardust-grave pallets/stardust-grave.backup

# 备份 runtime 配置
cp runtime/src/configs/mod.rs runtime/src/configs/mod.rs.backup
```

#### 步骤1.3：分析数据依赖

**任务**：
1. 导出所有存储项数据（使用 `substrate-storage-exporter`）
2. 分析数据量和使用频率
3. 确定迁移优先级

**工具**：
```bash
# 使用 substrate-storage-exporter 导出数据
substrate-storage-exporter --url ws://localhost:9944 --output grave_data.json
```

#### 步骤1.4：创建迁移文档

**文档内容**：
- 存储项映射表
- 接口映射表
- 事件映射表
- 错误类型映射表
- 测试用例清单

### 5.2 阶段二：功能迁移（3-4周）

#### 步骤2.1：在 pallet-deceased 中创建 grave 子模块

**目录结构**：
```
pallets/deceased/src/
├── lib.rs
├── grave/
│   ├── mod.rs          # 主模块
│   ├── storage.rs      # 存储项定义
│   ├── calls.rs        # 接口实现
│   ├── events.rs       # 事件定义
│   ├── errors.rs       # 错误类型定义
│   ├── traits.rs       # Trait 定义
│   └── types.rs        # 类型定义
```

#### 步骤2.2：迁移存储项

**任务**：
1. 在 `grave/storage.rs` 中定义所有存储项
2. 保持存储键不变（确保数据兼容）
3. 添加存储版本管理

**示例**：
```rust
// pallets/deceased/src/grave/storage.rs
#[pallet::storage]
pub type NextGraveId<T: Config> = StorageValue<_, u64, ValueQuery>;

#[pallet::storage]
pub type Graves<T: Config> = StorageMap<_, Blake2_128Concat, u64, Grave<T>, OptionQuery>;
// ... 其他存储项
```

#### 步骤2.3：迁移接口

**任务**：
1. 在 `grave/calls.rs` 中实现所有接口
2. 保持接口签名不变（确保前端兼容）
3. 更新权限检查逻辑

**注意事项**：
- 保持 `call_index` 不变（如果可能）
- 保持事件结构不变
- 保持错误类型不变

#### 步骤2.4：迁移 Trait

**任务**：
1. 在 `grave/traits.rs` 中定义所有 Trait
2. 更新 `GraveInspector` trait 实现
3. 更新 Runtime 适配器

#### 步骤2.5：更新 pallet-deceased 主模块

**任务**：
1. 在 `lib.rs` 中引入 `grave` 模块
2. 合并存储项到主 pallet
3. 合并接口到主 pallet
4. 合并事件到主 pallet
5. 合并错误类型到主 pallet

### 5.3 阶段三：更新依赖（2-3周）

#### 步骤3.1：更新 pallet-deceased

**任务**：
1. 更新 `GraveInspector` trait 实现（从外部调用改为内部调用）
2. 移除对 `pallet-stardust-grave` 的依赖
3. 更新测试用例

#### 步骤3.2：更新 pallet-memorial

**任务**：
1. 更新 `GraveProvider` trait 实现
2. 从 `pallet-deceased` 获取墓位所有者
3. 更新测试用例

#### 步骤3.3：更新 pallet-stardust-pet

**任务**：
1. 更新 `GraveInspector` trait 实现
2. 从 `pallet-deceased` 检查墓位
3. 更新测试用例

#### 步骤3.4：更新 Runtime

**任务**：
1. 移除 `pallet-stardust-grave` 注册
2. 更新 `GraveProviderAdapter` 实现
3. 更新治理调用
4. 更新 Cargo.toml

**关键代码**：
```rust
// runtime/src/lib.rs
// 移除
// pub type Grave = pallet_stardust_grave;

// runtime/src/configs/mod.rs
// 更新 GraveProviderAdapter
impl pallet_deceased::GraveInspector<AccountId, u64> for GraveProviderAdapter {
    fn grave_exists(grave_id: u64) -> bool {
        // 从 pallet-deceased 读取
        pallet_deceased::pallet::Graves::<Runtime>::contains_key(grave_id)
    }
    // ... 其他方法
}
```

### 5.4 阶段四：数据迁移（1-2周）

#### 步骤4.1：创建数据迁移脚本

**任务**：
1. 编写 Substrate 迁移（Migration）
2. 从 `pallet-stardust-grave` 读取数据
3. 写入 `pallet-deceased` 新存储

**示例**：
```rust
// runtime/src/migrations/migrate_grave_to_deceased.rs
pub struct MigrateGraveToDeceased<T>(sp_std::marker::PhantomData<T>);

impl<T: Config> OnRuntimeUpgrade for MigrateGraveToDeceased<T> {
    fn on_runtime_upgrade() -> Weight {
        // 1. 读取所有存储项
        // 2. 写入新存储
        // 3. 验证数据完整性
    }
}
```

#### 步骤4.2：执行数据迁移

**任务**：
1. 在测试网测试迁移脚本
2. 验证数据完整性
3. 在主网执行迁移

#### 步骤4.3：清理旧数据

**任务**：
1. 确认新数据正常
2. 清理 `pallet-stardust-grave` 存储项
3. 释放存储空间

### 5.5 阶段五：删除旧代码（1周）

#### 步骤5.1：删除 pallet-stardust-grave

**任务**：
1. 删除 `pallets/stardust-grave/` 目录
2. 从 `Cargo.toml` 移除依赖
3. 从 `runtime/Cargo.toml` 移除依赖

#### 步骤5.2：清理引用

**任务**：
1. 搜索所有对 `pallet-stardust-grave` 的引用
2. 清理注释和文档
3. 更新 README

#### 步骤5.3：更新文档

**任务**：
1. 更新架构文档
2. 更新 API 文档
3. 更新迁移指南

### 5.6 阶段六：测试与验证（2-3周）

#### 步骤6.1：单元测试

**任务**：
1. 更新所有单元测试
2. 确保测试通过
3. 覆盖率达到要求

#### 步骤6.2：集成测试

**任务**：
1. 测试所有依赖 pallet
2. 测试 Runtime 集成
3. 测试治理功能

#### 步骤6.3：端到端测试

**任务**：
1. 测试完整业务流程
2. 测试数据迁移
3. 测试性能

#### 步骤6.4：主网测试

**任务**：
1. 在测试网部署
2. 运行完整测试套件
3. 监控性能指标

---

## 6. 风险评估

### 6.1 高风险项（⭐⭐⭐⭐⭐）

#### 风险1：数据丢失

**描述**：迁移过程中可能丢失数据

**影响**：严重

**缓解措施**：
1. 完整备份所有存储项
2. 使用事务确保原子性
3. 验证数据完整性
4. 保留回滚方案

#### 风险2：功能中断

**描述**：迁移期间功能可能中断

**影响**：严重

**缓解措施**：
1. 在测试网充分测试
2. 使用维护模式
3. 准备快速回滚方案

#### 风险3：性能下降

**描述**：迁移后性能可能下降

**影响**：中等

**缓解措施**：
1. 性能基准测试
2. 优化存储访问
3. 监控性能指标

### 6.2 中风险项（⭐⭐⭐）

#### 风险4：前端不兼容

**描述**：前端可能依赖旧的接口

**影响**：中等

**缓解措施**：
1. 保持接口签名不变
2. 提供兼容层
3. 更新前端代码

#### 风险5：测试不充分

**描述**：测试可能不覆盖所有场景

**影响**：中等

**缓解措施**：
1. 完整的测试用例
2. 代码审查
3. 主网前充分测试

### 6.3 低风险项（⭐⭐）

#### 风险6：文档不完整

**描述**：文档可能不完整

**影响**：较低

**缓解措施**：
1. 及时更新文档
2. 代码注释完善
3. 迁移指南详细

---

## 7. 回滚方案

### 7.1 回滚条件

**触发条件**：
1. 数据迁移失败
2. 功能异常
3. 性能严重下降
4. 安全漏洞

### 7.2 回滚步骤

#### 步骤1：停止新版本

```bash
# 停止节点
systemctl stop stardust-node
```

#### 步骤2：恢复旧代码

```bash
# 切换到旧版本
git checkout <old-version-tag>

# 重新编译
cargo build --release
```

#### 步骤3：恢复数据

```bash
# 从备份恢复数据
substrate-storage-importer --url ws://localhost:9944 --input grave_data_backup.json
```

#### 步骤4：重启节点

```bash
# 启动节点
systemctl start stardust-node
```

#### 步骤5：验证恢复

```bash
# 验证数据完整性
substrate-storage-validator --url ws://localhost:9944
```

### 7.3 回滚时间窗口

**建议**：保留 7-14 天的回滚窗口

---

## 8. 测试计划

### 8.1 单元测试

**覆盖范围**：
- 所有存储项操作
- 所有接口逻辑
- 所有错误处理

**目标**：覆盖率 > 90%

### 8.2 集成测试

**测试场景**：
1. `pallet-deceased` 与 `pallet-memorial` 集成
2. `pallet-deceased` 与 `pallet-stardust-pet` 集成
3. Runtime 集成测试

### 8.3 端到端测试

**测试场景**：
1. 创建墓位 → 创建逝者 → 安葬
2. 迁移逝者
3. 供奉分账
4. 治理操作

### 8.4 性能测试

**测试指标**：
- 接口响应时间
- 存储访问性能
- 区块处理时间

**目标**：性能不低于当前版本

### 8.5 主网测试

**测试步骤**：
1. 在测试网部署
2. 运行完整测试套件
3. 监控 7 天
4. 确认无问题后部署主网

---

## 9. 时间规划

### 9.1 总体时间线

| 阶段 | 任务 | 时间 | 负责人 |
|------|------|------|--------|
| **阶段一** | 准备工作 | 1-2周 | 开发团队 |
| **阶段二** | 功能迁移 | 3-4周 | 开发团队 |
| **阶段三** | 更新依赖 | 2-3周 | 开发团队 |
| **阶段四** | 数据迁移 | 1-2周 | 开发团队 + 运维 |
| **阶段五** | 删除旧代码 | 1周 | 开发团队 |
| **阶段六** | 测试与验证 | 2-3周 | 开发团队 + QA |
| **总计** | | **10-15周** | |

### 9.2 关键里程碑

| 里程碑 | 时间 | 验收标准 |
|--------|------|---------|
| **M1：功能迁移完成** | 第4-6周 | 所有功能已迁移，单元测试通过 |
| **M2：依赖更新完成** | 第6-9周 | 所有依赖已更新，集成测试通过 |
| **M3：数据迁移完成** | 第7-11周 | 数据迁移成功，数据完整性验证通过 |
| **M4：测试完成** | 第10-15周 | 所有测试通过，性能达标 |
| **M5：主网部署** | 第15周+ | 主网部署成功，运行稳定 |

### 9.3 资源需求

**人员**：
- 开发人员：2-3 人
- QA 人员：1-2 人
- 运维人员：1 人

**工具**：
- Substrate 开发环境
- 测试网环境
- 监控工具
- 数据备份工具

---

## 10. 总结

### 10.1 关键成功因素

1. **充分准备**：完整的数据备份和迁移计划
2. **逐步迁移**：分阶段执行，降低风险
3. **充分测试**：覆盖所有场景
4. **快速响应**：准备回滚方案

### 10.2 注意事项

1. **数据安全**：确保数据不丢失
2. **功能兼容**：保持接口兼容性
3. **性能监控**：持续监控性能指标
4. **文档更新**：及时更新文档

### 10.3 后续优化

1. **性能优化**：优化存储访问
2. **功能增强**：基于新架构增强功能
3. **代码清理**：清理冗余代码
4. **文档完善**：完善文档和注释

---

**文档版本**：v1.0.0  
**最后更新**：2025-01-XX  
**维护者**：Stardust 开发团队

