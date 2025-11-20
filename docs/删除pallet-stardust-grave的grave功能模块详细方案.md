# 删除 pallet-stardust-grave 的 Grave 功能模块详细方案

> **目标**：彻底删除 `pallet-stardust-grave` 中的 Grave 核心功能模块，保留或迁移其他功能模块

---

## 📋 目录

1. [功能模块分析](#1-功能模块分析)
2. [删除范围定义](#2-删除范围定义)
3. [依赖关系分析](#3-依赖关系分析)
4. [迁移策略](#4-迁移策略)
5. [详细删除步骤](#5-详细删除步骤)
6. [数据迁移方案](#6-数据迁移方案)
7. [接口兼容性处理](#7-接口兼容性处理)
8. [测试计划](#8-测试计划)
9. [风险评估](#9-风险评估)
10. [时间规划](#10-时间规划)

---

## 1. 功能模块分析

### 1.1 pallet-stardust-grave 功能模块清单

#### 模块A：Grave 核心管理（⚠️ 需要删除）

| 功能 | 接口 | 存储项 | 状态 |
|------|------|--------|------|
| 墓位创建 | `create_grave` | `NextGraveId`, `Graves` | 删除 |
| 墓位更新 | `update_grave` | `Graves` | 删除 |
| 墓位转让 | `transfer_grave` | `Graves` | 删除 |
| 墓位删除 | `remove_grave`, `gov_remove_grave` | `Graves`, `ModerationOf` | 删除 |
| 园区管理 | `set_park` | `Graves`, `GravesByPark` | 删除 |
| 安葬管理 | `inter`, `do_inter_internal` | `Interments`, `PrimaryDeceasedOf` | 删除 |
| 起掘管理 | `exhume`, `do_exhume_internal` | `Interments`, `PrimaryDeceasedOf` | 删除 |
| 主逝者管理 | `set_primary_deceased` | `PrimaryDeceasedOf` | 删除 |
| 准入策略 | `set_admission_policy`, `add_to_admission_whitelist`, `remove_from_admission_whitelist` | `AdmissionPolicyOf`, `AdmissionWhitelist` | 删除 |
| 元数据管理 | `set_meta` | `GraveMetaOf` | 删除 |
| 名称哈希 | `set_name_hash`, `clear_name_hash` | `NameIndex` | 删除 |
| 治理操作 | `gov_transfer_grave`, `gov_set_restricted`, `gov_restore_grave` | `Graves`, `ModerationOf` | 删除 |

**总计**：约 15 个接口，10+ 个存储项

#### 模块B：权限与成员管理（❓ 需要评估）

| 功能 | 接口 | 存储项 | 状态 |
|------|------|--------|------|
| 管理员管理 | `add_admin`, `remove_admin` | `GraveAdmins` | 评估 |
| 加入策略 | `set_policy` | `JoinPolicyOf` | 评估 |
| 成员管理 | `join_open`, `apply_join`, `approve_member`, `reject_member` | `Members`, `PendingApplications` | 评估 |
| 可见性控制 | `set_visibility` | `Graves.is_public` | 评估 |

**评估标准**：
- 如果这些功能与 Grave 强绑定 → 删除
- 如果这些功能可以独立使用 → 保留或迁移

#### 模块C：关注系统（❓ 需要评估）

| 功能 | 接口 | 存储项 | 状态 |
|------|------|--------|------|
| 关注/取关 | `follow`, `unfollow` | `FollowersOf`, `IsFollower`, `LastFollowAction` | 评估 |
| 关注押金 | 押金机制 | `LegacyFollowRefunds` | 评估 |
| 黑名单 | 黑名单机制 | `BannedFollowers` | 评估 |

**评估标准**：
- 如果关注系统依赖 Grave → 删除
- 如果关注系统可以独立 → 保留或迁移到其他 pallet

#### 模块D：内容管理（❓ 需要评估）

| 功能 | 接口 | 存储项 | 状态 |
|------|------|--------|------|
| 封面管理 | `set_cover`, `clear_cover`, `set_cover_via_governance`, `add_cover_option`, `remove_cover_option`, `set_cover_from_option` | `CoverCidOf`, `CoverOptions` | 评估 |
| 音频管理 | `set_audio`, `clear_audio`, `set_audio_via_governance`, `add_audio_option`, `remove_audio_option`, `set_audio_from_option`, `add_private_audio_option`, `remove_private_audio_option`, `set_audio_playlist` | `AudioCidOf`, `AudioOptions`, `PrivateAudioOptionsOf`, `AudioPlaylistOf` | 评估 |
| 轮播图管理 | `set_carousel` | `Carousel` | 评估 |

**评估标准**：
- 如果内容管理依赖 Grave → 删除
- 如果内容管理可以独立 → 保留或迁移到其他 pallet

#### 模块E：亲属关系管理（❓ 需要评估）

| 功能 | 接口 | 存储项 | 状态 |
|------|------|--------|------|
| 亲属关系 | `declare_kinship`, `approve_kinship`, `reject_kinship`, `update_kinship`, `remove_kinship` | `KinshipOf`, `KinshipIndexByMember` | 评估 |
| 亲属策略 | `set_kinship_policy` | `KinshipPolicyOf` | 评估 |

**评估标准**：
- 如果亲属关系依赖 Grave → 删除
- 如果亲属关系可以独立 → 保留或迁移到其他 pallet

#### 模块F：投诉与审核（❓ 需要评估）

| 功能 | 接口 | 存储项 | 状态 |
|------|------|--------|------|
| 投诉系统 | `complain` | `ComplaintsByGrave` | 评估 |
| 审核系统 | `restrict` | `ModerationOf` | 评估 |

**评估标准**：
- 如果投诉/审核依赖 Grave → 删除
- 如果投诉/审核可以独立 → 保留或迁移到其他 pallet

#### 模块G：辅助功能（✅ 保留）

| 功能 | 接口 | 存储项 | 状态 |
|------|------|--------|------|
| Slug 管理 | `gen_unique_slug` | `SlugOf`, `GraveBySlug` | 如果删除 Grave，则删除 |
| 内部函数 | `is_member`, `check_admission_policy`, `primary_deceased_of`, `is_primary_deceased` | - | 如果删除 Grave，则删除 |

### 1.2 功能模块依赖关系

```
Grave 核心管理 (模块A)
    ├── 权限与成员管理 (模块B) ── 依赖 Grave
    ├── 关注系统 (模块C) ── 依赖 Grave
    ├── 内容管理 (模块D) ── 依赖 Grave
    ├── 亲属关系管理 (模块E) ── 依赖 Grave
    └── 投诉与审核 (模块F) ── 依赖 Grave
```

**结论**：所有模块都依赖 Grave 核心管理，删除 Grave 后，其他模块也需要删除或迁移。

---

## 2. 删除范围定义

### 2.1 明确删除范围

#### 核心删除项（必须删除）

**存储项**：
1. `NextGraveId` - 下一个墓位ID
2. `Graves` - 墓位主数据
3. `GravesByPark` - 园区墓位索引
4. `Interments` - 安葬记录
5. `PrimaryDeceasedOf` - 主逝者索引
6. `AdmissionPolicyOf` - 准入策略
7. `AdmissionWhitelist` - 准入白名单
8. `GraveAdmins` - 管理员列表
9. `JoinPolicyOf` - 加入策略
10. `Members` - 成员列表
11. `PendingApplications` - 待审批申请
12. `GraveMetaOf` - 墓位元数据
13. `NameIndex` - 名称索引
14. `SlugOf` - Slug索引
15. `GraveBySlug` - Slug反向索引
16. `FollowersOf` - 关注者列表
17. `IsFollower` - 关注映射
18. `LastFollowAction` - 关注冷却时间
19. `BannedFollowers` - 黑名单
20. `CoverCidOf` - 封面CID
21. `CoverOptions` - 公共封面目录
22. `AudioCidOf` - 音频CID
23. `AudioOptions` - 公共音频目录
24. `PrivateAudioOptionsOf` - 私有音频候选
25. `AudioPlaylistOf` - 播放列表
26. `Carousel` - 轮播图
27. `KinshipOf` - 亲属关系
28. `KinshipIndexByMember` - 亲属关系索引
29. `KinshipPolicyOf` - 亲属关系策略
30. `ComplaintsByGrave` - 投诉记录
31. `ModerationOf` - 审核状态
32. `LegacyFollowRefunds` - 关注押金退款

**接口**：
1. `create_grave` - 创建墓位
2. `update_grave` - 更新墓位
3. `transfer_grave` - 转让墓位
4. `remove_grave` - 删除墓位
5. `set_park` - 设置所属园区
6. `inter` - 安葬逝者
7. `exhume` - 起掘逝者
8. `set_primary_deceased` - 设置主逝者
9. `set_admission_policy` - 设置准入策略
10. `add_to_admission_whitelist` - 添加到准入白名单
11. `remove_from_admission_whitelist` - 从准入白名单移除
12. `set_meta` - 设置元数据
13. `set_name_hash` - 设置名称哈希
14. `clear_name_hash` - 清除名称哈希
15. `gov_transfer_grave` - 治理转让墓位
16. `gov_set_restricted` - 治理设置限制
17. `gov_remove_grave` - 治理删除墓位
18. `gov_restore_grave` - 治理恢复墓位
19. `add_admin` - 添加管理员
20. `remove_admin` - 移除管理员
21. `set_policy` - 设置加入策略
22. `join_open` - 公开加入
23. `apply_join` - 申请加入
24. `approve_member` - 批准成员
25. `reject_member` - 拒绝成员
26. `set_visibility` - 设置可见性
27. `follow` - 关注墓位
28. `unfollow` - 取消关注
29. `claim_legacy_follow_refund` - 领取关注押金退款
30. `set_cover` - 设置封面
31. `clear_cover` - 清除封面
32. `set_cover_via_governance` - 治理设置封面
33. `clear_cover_via_governance` - 治理清除封面
34. `add_cover_option` - 添加封面选项
35. `remove_cover_option` - 移除封面选项
36. `set_cover_from_option` - 从选项设置封面
37. `set_audio` - 设置音频
38. `clear_audio` - 清除音频
39. `set_audio_via_governance` - 治理设置音频
40. `clear_audio_via_governance` - 治理清除音频
41. `add_audio_option` - 添加音频选项
42. `remove_audio_option` - 移除音频选项
43. `set_audio_from_option` - 从选项设置音频
44. `set_audio_from_private_option` - 从私有选项设置音频
45. `add_private_audio_option` - 添加私有音频选项
46. `remove_private_audio_option` - 移除私有音频选项
47. `set_audio_playlist` - 设置播放列表
48. `set_carousel` - 设置轮播图
49. `set_kinship_policy` - 设置亲属关系策略
50. `declare_kinship` - 声明亲属关系
51. `approve_kinship` - 批准亲属关系
52. `reject_kinship` - 拒绝亲属关系
53. `update_kinship` - 更新亲属关系
54. `remove_kinship` - 移除亲属关系
55. `complain` - 提交投诉
56. `restrict` - 设置限制
57. `do_inter_internal` - 内部安葬函数
58. `do_exhume_internal` - 内部起掘函数
59. `primary_deceased_of` - 查询主逝者
60. `is_primary_deceased` - 检查是否为主逝者
61. `gen_unique_slug` - 生成唯一Slug
62. `is_member` - 检查是否为成员
63. `check_admission_policy` - 检查准入策略

**数据结构**：
1. `Grave<T>` - 墓位结构
2. `IntermentRecord<T>` - 安葬记录
3. `GraveAdmissionPolicy` - 准入策略枚举
4. `GraveMeta` - 墓位元数据
5. `Moderation` - 审核状态
6. `Complaint<T>` - 投诉记录
7. `CarouselItem<T>` - 轮播图项
8. `KinshipRecord<T>` - 亲属关系记录

**Trait**：
1. `OnIntermentCommitted` - 安葬回调接口
2. `ParkAdminOrigin` - 园区管理员权限接口
3. `DeceasedTokenAccess` - 逝者令牌访问接口

**事件**：
- 所有与 Grave 相关的事件（约 30+ 个）

**错误类型**：
- 所有与 Grave 相关的错误类型（约 20+ 个）

### 2.2 保留项（如果需要）

**配置项**：
- 如果其他 pallet 需要，可以保留部分配置常量

**辅助函数**：
- 如果其他 pallet 需要，可以迁移辅助函数

---

## 3. 依赖关系分析

### 3.1 外部依赖 pallet-stardust-grave 的模块

#### 3.1.1 pallet-deceased

**依赖方式**：通过 `GraveInspector` trait

**依赖的接口**：
- `grave_exists(grave_id)` - 检查墓位存在
- `can_attach(who, grave_id)` - 检查权限
- `owner_of(grave_id)` - 获取墓主
- `record_interment(...)` - 记录安葬
- `record_exhumation(...)` - 记录起掘
- `check_admission_policy(who, grave_id)` - 检查准入策略

**影响**：⭐⭐⭐⭐⭐（严重）

**处理方案**：
1. 在 `pallet-deceased` 中实现这些功能
2. 或者创建新的 `pallet-grave` 实现这些功能

#### 3.1.2 pallet-memorial

**依赖方式**：通过 `GraveProvider` trait

**依赖的接口**：
- `owner_of(grave_id)` - 获取墓主（用于分账）

**影响**：⭐⭐⭐（中等）

**处理方案**：
1. 从 `pallet-deceased` 获取墓主信息
2. 或者从新的 `pallet-grave` 获取

#### 3.1.3 pallet-stardust-pet

**依赖方式**：通过 `GraveInspector` trait

**依赖的接口**：
- `grave_exists(grave_id)` - 检查墓位存在
- `can_attach(who, grave_id)` - 检查权限

**影响**：⭐⭐（较低）

**处理方案**：
1. 从 `pallet-deceased` 检查
2. 或者从新的 `pallet-grave` 检查

#### 3.1.4 Runtime

**依赖方式**：直接注册和配置

**依赖的内容**：
- Pallet 注册
- `GraveProviderAdapter` 实现
- 治理调用

**影响**：⭐⭐⭐⭐⭐（严重）

**处理方案**：
1. 移除 pallet 注册
2. 更新适配器实现
3. 移除治理调用

### 3.2 依赖关系图

```
pallet-stardust-grave (Grave 功能)
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
        └── 治理调用
```

---

## 4. 迁移策略

### 4.1 策略选择

#### 方案A：功能迁移到 pallet-deceased（推荐）

**优点**：
- 墓位和逝者关系紧密，逻辑上更合理
- 减少 pallet 数量
- 降低跨 pallet 调用成本

**缺点**：
- `pallet-deceased` 已经很大，可能进一步膨胀
- 需要重构 `pallet-deceased` 的架构

**实施步骤**：
1. 在 `pallet-deceased` 中创建 `grave` 子模块
2. 迁移所有 Grave 相关功能
3. 更新 `GraveInspector` trait 实现
4. 更新 Runtime 配置

#### 方案B：创建新的 pallet-grave

**优点**：
- 保持功能独立
- 可以重新设计架构
- 不影响现有 pallet

**缺点**：
- 需要创建新 pallet
- 需要迁移所有数据
- 需要更新所有依赖

**实施步骤**：
1. 创建新的 `pallet-grave`
2. 迁移所有 Grave 相关功能
3. 更新所有依赖
4. 更新 Runtime 配置

#### 方案C：功能拆分到多个 pallet

**优点**：
- 功能更细分
- 降低单个 pallet 复杂度

**缺点**：
- 增加 pallet 数量
- 增加跨 pallet 调用

**实施步骤**：
1. 创建多个新 pallet（如 `pallet-grave-core`, `pallet-grave-content`）
2. 拆分功能到不同 pallet
3. 更新所有依赖

### 4.2 推荐方案：方案A（迁移到 pallet-deceased）

**理由**：
1. 墓位和逝者关系是核心业务逻辑
2. 减少 pallet 数量，降低系统复杂度
3. 降低跨 pallet 调用成本

---

## 5. 详细删除步骤

### 5.1 阶段一：准备工作（1-2周）

#### 步骤1.1：创建删除分支

```bash
git checkout -b feature/remove-grave-module
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
1. 导出所有存储项数据
2. 分析数据量和使用频率
3. 确定迁移优先级

**工具**：
```bash
# 使用 substrate-storage-exporter 导出数据
substrate-storage-exporter --url ws://localhost:9944 --output grave_data.json
```

#### 步骤1.4：创建删除清单

**文档内容**：
- 存储项删除清单
- 接口删除清单
- 事件删除清单
- 错误类型删除清单
- 数据结构删除清单
- Trait 删除清单

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

### 5.3 阶段三：删除旧代码（2-3周）

#### 步骤3.1：删除存储项

**任务**：
1. 从 `pallet-stardust-grave/src/lib.rs` 删除所有存储项定义
2. 删除相关的数据结构定义
3. 更新存储版本

**删除清单**：
```rust
// 删除以下存储项
- NextGraveId
- Graves
- GravesByPark
- Interments
- PrimaryDeceasedOf
- AdmissionPolicyOf
- AdmissionWhitelist
- GraveAdmins
- JoinPolicyOf
- Members
- PendingApplications
- GraveMetaOf
- NameIndex
- SlugOf
- GraveBySlug
- FollowersOf
- IsFollower
- LastFollowAction
- BannedFollowers
- CoverCidOf
- CoverOptions
- AudioCidOf
- AudioOptions
- PrivateAudioOptionsOf
- AudioPlaylistOf
- Carousel
- KinshipOf
- KinshipIndexByMember
- KinshipPolicyOf
- ComplaintsByGrave
- ModerationOf
- LegacyFollowRefunds
```

#### 步骤3.2：删除接口

**任务**：
1. 从 `pallet-stardust-grave/src/lib.rs` 删除所有接口实现
2. 删除相关的辅助函数
3. 更新权重定义

**删除清单**：
```rust
// 删除以下接口
- create_grave
- update_grave
- transfer_grave
- remove_grave
- set_park
- inter
- exhume
- set_primary_deceased
- set_admission_policy
- add_to_admission_whitelist
- remove_from_admission_whitelist
- set_meta
- set_name_hash
- clear_name_hash
- gov_transfer_grave
- gov_set_restricted
- gov_remove_grave
- gov_restore_grave
- add_admin
- remove_admin
- set_policy
- join_open
- apply_join
- approve_member
- reject_member
- set_visibility
- follow
- unfollow
- claim_legacy_follow_refund
- set_cover
- clear_cover
- set_cover_via_governance
- clear_cover_via_governance
- add_cover_option
- remove_cover_option
- set_cover_from_option
- set_audio
- clear_audio
- set_audio_via_governance
- clear_audio_via_governance
- add_audio_option
- remove_audio_option
- set_audio_from_option
- set_audio_from_private_option
- add_private_audio_option
- remove_private_audio_option
- set_audio_playlist
- set_carousel
- set_kinship_policy
- declare_kinship
- approve_kinship
- reject_kinship
- update_kinship
- remove_kinship
- complain
- restrict
- do_inter_internal
- do_exhume_internal
- primary_deceased_of
- is_primary_deceased
- gen_unique_slug
- is_member
- check_admission_policy
```

#### 步骤3.3：删除事件和错误类型

**任务**：
1. 从 `Event` 枚举中删除所有 Grave 相关事件
2. 从 `Error` 枚举中删除所有 Grave 相关错误类型
3. 更新事件和错误处理逻辑

#### 步骤3.4：删除 Trait

**任务**：
1. 删除 `OnIntermentCommitted` trait（如果不再需要）
2. 删除 `ParkAdminOrigin` trait（如果不再需要）
3. 删除 `DeceasedTokenAccess` trait（如果不再需要）

#### 步骤3.5：删除配置项

**任务**：
1. 从 `Config` trait 中删除 Grave 相关配置
2. 更新 Runtime 配置

**删除清单**：
```rust
// 删除以下配置项（如果不再需要）
- MaxPerPark
- MaxIntermentsPerGrave
- OnInterment
- ParkAdmin
- MaxIdsPerName
- MaxComplaintsPerGrave
- MaxAdminsPerGrave
- SlugLen
- MaxFollowers
- FollowCooldownBlocks
- FollowDeposit
- CreateFee
- FeeCollector
- MaxCoverOptions
- MaxAudioOptions
- MaxPrivateAudioOptions
- MaxAudioPlaylistLen
- MaxCarouselItems
- MaxTitleLen
- MaxLinkLen
- IpfsPinner
- Balance
- DefaultStoragePrice
```

### 5.4 阶段四：更新依赖（2-3周）

#### 步骤4.1：更新 pallet-deceased

**任务**：
1. 更新 `GraveInspector` trait 实现（从内部调用）
2. 移除对 `pallet-stardust-grave` 的依赖
3. 更新测试用例

#### 步骤4.2：更新 pallet-memorial

**任务**：
1. 更新 `GraveProvider` trait 实现
2. 从 `pallet-deceased` 获取墓位所有者
3. 更新测试用例

#### 步骤4.3：更新 pallet-stardust-pet

**任务**：
1. 更新 `GraveInspector` trait 实现
2. 从 `pallet-deceased` 检查墓位
3. 更新测试用例

#### 步骤4.4：更新 Runtime

**任务**：
1. 移除 `pallet-stardust-grave` 注册（如果完全删除）
2. 或者保留 pallet 但移除 Grave 功能
3. 更新 `GraveProviderAdapter` 实现
4. 更新治理调用
5. 更新 Cargo.toml

**关键代码**：
```rust
// runtime/src/lib.rs
// 如果完全删除 pallet
// pub type Grave = pallet_stardust_grave;

// 如果保留 pallet 但移除 Grave 功能
// 需要更新 pallet 注册

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

### 5.5 阶段五：数据迁移（1-2周）

#### 步骤5.1：创建数据迁移脚本

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

#### 步骤5.2：执行数据迁移

**任务**：
1. 在测试网测试迁移脚本
2. 验证数据完整性
3. 在主网执行迁移

#### 步骤5.3：清理旧数据

**任务**：
1. 确认新数据正常
2. 清理 `pallet-stardust-grave` 存储项
3. 释放存储空间

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

## 6. 数据迁移方案

### 6.1 迁移策略

#### 方案A：一次性迁移（推荐）

**优点**：
- 迁移速度快
- 数据一致性高

**缺点**：
- 需要停机维护
- 风险较高

**适用场景**：数据量不大，可以接受短暂停机

#### 方案B：渐进式迁移

**优点**：
- 不需要停机
- 风险较低

**缺点**：
- 迁移时间长
- 需要双写机制

**适用场景**：数据量大，不能停机

### 6.2 迁移步骤

#### 步骤1：数据导出

```rust
// 导出所有存储项
let graves = pallet_stardust_grave::Graves::<Runtime>::iter().collect();
let interments = pallet_stardust_grave::Interments::<Runtime>::iter().collect();
// ... 其他存储项
```

#### 步骤2：数据转换

```rust
// 转换数据格式（如果需要）
let new_graves: Vec<(u64, Grave<T>)> = graves.into_iter()
    .map(|(id, grave)| (id, convert_grave(grave)))
    .collect();
```

#### 步骤3：数据写入

```rust
// 写入新存储
for (id, grave) in new_graves {
    pallet_deceased::Graves::<Runtime>::insert(id, grave);
}
```

#### 步骤4：数据验证

```rust
// 验证数据完整性
ensure!(
    pallet_stardust_grave::Graves::<Runtime>::iter().count() == 
    pallet_deceased::Graves::<Runtime>::iter().count(),
    "Data count mismatch"
);
```

### 6.3 回滚方案

**如果迁移失败**：
1. 停止新版本
2. 恢复旧代码
3. 从备份恢复数据
4. 重启节点

---

## 7. 接口兼容性处理

### 7.1 前端兼容性

**问题**：前端可能依赖旧的接口

**解决方案**：
1. 保持接口签名不变
2. 提供兼容层
3. 更新前端代码

### 7.2 API 兼容性

**问题**：外部 API 可能依赖旧的接口

**解决方案**：
1. 提供 API 版本控制
2. 提供迁移指南
3. 逐步废弃旧接口

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

## 9. 风险评估

### 9.1 高风险项（⭐⭐⭐⭐⭐）

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

#### 风险3：依赖破坏

**描述**：其他 pallet 可能依赖 Grave 功能

**影响**：严重

**缓解措施**：
1. 完整分析所有依赖
2. 提前更新所有依赖
3. 充分测试集成

### 9.2 中风险项（⭐⭐⭐）

#### 风险4：性能下降

**描述**：迁移后性能可能下降

**影响**：中等

**缓解措施**：
1. 性能基准测试
2. 优化存储访问
3. 监控性能指标

#### 风险5：前端不兼容

**描述**：前端可能依赖旧的接口

**影响**：中等

**缓解措施**：
1. 保持接口签名不变
2. 提供兼容层
3. 更新前端代码

### 9.3 低风险项（⭐⭐）

#### 风险6：文档不完整

**描述**：文档可能不完整

**影响**：较低

**缓解措施**：
1. 及时更新文档
2. 代码注释完善
3. 迁移指南详细

---

## 10. 时间规划

### 10.1 总体时间线

| 阶段 | 任务 | 时间 | 负责人 |
|------|------|------|--------|
| **阶段一** | 准备工作 | 1-2周 | 开发团队 |
| **阶段二** | 功能迁移 | 3-4周 | 开发团队 |
| **阶段三** | 删除旧代码 | 2-3周 | 开发团队 |
| **阶段四** | 更新依赖 | 2-3周 | 开发团队 |
| **阶段五** | 数据迁移 | 1-2周 | 开发团队 + 运维 |
| **阶段六** | 测试与验证 | 2-3周 | 开发团队 + QA |
| **总计** | | **11-17周** | |

### 10.2 关键里程碑

| 里程碑 | 时间 | 验收标准 |
|--------|------|---------|
| **M1：功能迁移完成** | 第4-6周 | 所有功能已迁移，单元测试通过 |
| **M2：旧代码删除完成** | 第6-9周 | 所有旧代码已删除，编译通过 |
| **M3：依赖更新完成** | 第8-12周 | 所有依赖已更新，集成测试通过 |
| **M4：数据迁移完成** | 第9-14周 | 数据迁移成功，数据完整性验证通过 |
| **M5：测试完成** | 第11-17周 | 所有测试通过，性能达标 |
| **M6：主网部署** | 第17周+ | 主网部署成功，运行稳定 |

### 10.3 资源需求

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

## 11. 总结

### 11.1 关键成功因素

1. **充分准备**：完整的数据备份和迁移计划
2. **逐步执行**：分阶段执行，降低风险
3. **充分测试**：覆盖所有场景
4. **快速响应**：准备回滚方案

### 11.2 注意事项

1. **数据安全**：确保数据不丢失
2. **功能兼容**：保持接口兼容性
3. **性能监控**：持续监控性能指标
4. **文档更新**：及时更新文档

### 11.3 后续优化

1. **性能优化**：优化存储访问
2. **功能增强**：基于新架构增强功能
3. **代码清理**：清理冗余代码
4. **文档完善**：完善文档和注释

---

**文档版本**：v1.0.0  
**最后更新**：2025-01-XX  
**维护者**：Stardust 开发团队

