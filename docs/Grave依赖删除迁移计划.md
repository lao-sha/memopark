# Grave 依赖删除迁移计划

> **目标**：详细规划删除 `pallet-stardust-grave` 依赖的完整迁移方案，包括依赖分析、替代方案、迁移步骤和测试用例

---

## 📋 目录

1. [阶段1：准备阶段](#阶段1准备阶段)
2. [阶段2：重构阶段](#阶段2重构阶段)
3. [阶段3：清理阶段](#阶段3清理阶段)
4. [阶段4：测试阶段](#阶段4测试阶段)
5. [阶段5：部署阶段](#阶段5部署阶段)
6. [风险评估与回滚方案](#风险评估与回滚方案)

---

## 阶段1：准备阶段（1-2周）

### 1.1 分析所有依赖关系

#### 1.1.1 依赖关系总览

**已完成**：已创建《对Grave依赖的功能清单.md》，包含：
- 4个直接依赖的Pallet（deceased, memorial, pet, ledger）
- 20+个接口依赖
- 15+个存储项依赖
- 6个Trait依赖
- Runtime配置依赖
- 5个治理功能依赖

#### 1.1.2 依赖关系详细分析

**核心依赖链**：

```
pallet-stardust-grave (核心)
    │
    ├── Runtime (直接依赖)
    │   ├── Pallet注册: pub type Grave = pallet_stardust_grave;
    │   ├── Config配置: impl pallet_stardust_grave::Config for Runtime
    │   └── 适配器实现: 6个适配器
    │
    ├── pallet-deceased (严重依赖 ⭐⭐⭐⭐⭐)
    │   ├── Trait依赖: GraveInspector<AccountId, GraveId>
    │   ├── 接口依赖: 8个接口
    │   ├── 存储依赖: 6个存储项
    │   └── 数据依赖: Deceased.grave_id字段, DeceasedByGrave存储
    │
    ├── pallet-memorial (较高依赖 ⭐⭐⭐⭐)
    │   ├── Trait依赖: TargetControl, GraveProvider
    │   ├── 接口依赖: 2个接口
    │   ├── 存储依赖: 3个存储项
    │   └── 数据依赖: OfferingRecord.grave_id字段, OfferingsByGrave存储
    │
    ├── pallet-stardust-pet (中等依赖 ⭐⭐⭐)
    │   ├── Trait依赖: GraveInspector<AccountId, GraveId>
    │   ├── 接口依赖: 2个接口
    │   └── 数据依赖: Pet.grave_id字段（可选）
    │
    └── pallet-ledger (较高依赖 ⭐⭐⭐⭐)
        ├── 存储依赖: 所有存储项基于grave_id
        └── 接口依赖: 所有接口使用grave_id参数
```

#### 1.1.3 依赖影响评估

| 依赖模块 | 影响程度 | 处理优先级 | 预计工作量 |
|---------|---------|-----------|-----------|
| **pallet-deceased** | ⭐⭐⭐⭐⭐ | P0 | 4-6周 |
| **pallet-memorial** | ⭐⭐⭐⭐ | P1 | 2-3周 |
| **pallet-ledger** | ⭐⭐⭐⭐ | P1 | 2-3周 |
| **pallet-stardust-pet** | ⭐⭐⭐ | P2 | 1-2周 |
| **Runtime** | ⭐⭐⭐⭐⭐ | P0 | 1-2周 |
| **治理功能** | ⭐⭐⭐⭐ | P1 | 1周 |

---

### 1.2 设计替代方案

#### 1.2.1 墓位组织功能替代方案

**方案A：逝者关系组织（推荐）**

**设计思路**：
- 使用现有的逝者关系（Relations）功能组织逝者
- 通过亲属关系（父子、夫妻、兄弟姐妹）建立组织关系
- 支持多层级关系网络

**实现方式**：
```rust
// 现有关系类型
pub enum RelationType {
    Parent,      // 父母
    Child,       // 子女
    Spouse,      // 配偶
    Sibling,     // 兄弟姐妹
    // ... 其他关系
}

// 查询相关逝者
pub fn get_related_deceased(deceased_id: T::DeceasedId) -> Vec<T::DeceasedId> {
    // 通过Relations存储查询所有相关逝者
    Relations::<T>::iter_prefix(deceased_id)
        .map(|(_, related_id)| related_id)
        .collect()
}
```

**优点**：
- ✅ 无需新增功能，使用现有Relations
- ✅ 更灵活，支持复杂关系网络
- ✅ 符合实际家族关系

**缺点**：
- ❌ 需要手动建立关系
- ❌ 查询性能可能较慢（需要遍历关系）

**方案B：逝者分组功能（备选）**

**设计思路**：
- 新增逝者分组功能
- 支持创建分组、添加逝者到分组
- 支持按分组查询逝者

**实现方式**：
```rust
// 新增存储项
pub type DeceasedGroups<T: Config> = StorageMap<GroupId, DeceasedGroup<T>>;
pub type DeceasedByGroup<T: Config> = StorageDoubleMap<GroupId, DeceasedId, ()>;

pub struct DeceasedGroup<T: Config> {
    pub id: GroupId,
    pub name: BoundedVec<u8, T::StringLimit>,
    pub owner: T::AccountId,
    pub created: BlockNumberFor<T>,
}
```

**优点**：
- ✅ 查询性能好（直接索引）
- ✅ 支持灵活分组

**缺点**：
- ❌ 需要新增功能
- ❌ 增加代码复杂度

**推荐方案**：方案A（使用现有Relations功能）

---

#### 1.2.2 墓位权限功能替代方案

**方案A：逝者授权功能（推荐）**

**设计思路**：
- 新增逝者授权功能
- 逝者owner可以授权其他账户管理逝者
- 支持授权、撤销授权、查询授权列表

**实现方式**：
```rust
// 新增存储项
pub type DeceasedAuthorizations<T: Config> = StorageDoubleMap<
    T::DeceasedId,
    T::AccountId,
    AuthorizationInfo<T>
>;

pub struct AuthorizationInfo<T: Config> {
    pub authorized_by: T::AccountId,  // 授权者（逝者owner）
    pub authorized_at: BlockNumberFor<T>,
    pub permissions: AuthorizationPermissions,  // 权限类型
}

pub struct AuthorizationPermissions {
    pub can_update: bool,      // 可以更新逝者信息
    pub can_manage_relations: bool,  // 可以管理关系
    pub can_manage_works: bool,  // 可以管理作品
}

// 新增接口
pub fn authorize_deceased(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    authorized_account: T::AccountId,
    permissions: AuthorizationPermissions,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let deceased = DeceasedOf::<T>::get(deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    
    // 仅逝者owner可以授权
    ensure!(deceased.owner == who, Error::<T>::NotDeceasedOwner);
    
    // 存储授权信息
    DeceasedAuthorizations::<T>::insert(
        deceased_id,
        authorized_account.clone(),
        AuthorizationInfo {
            authorized_by: who.clone(),
            authorized_at: <frame_system::Pallet<T>>::block_number(),
            permissions,
        }
    );
    
    Self::deposit_event(Event::DeceasedAuthorized {
        deceased_id,
        authorized_account,
        authorized_by: who,
    });
    
    Ok(())
}

// 权限检查函数
pub fn can_manage_deceased(
    who: &T::AccountId,
    deceased_id: T::DeceasedId,
    permission: &str,  // "update", "relations", "works"
) -> bool {
    let deceased = match DeceasedOf::<T>::get(deceased_id) {
        Some(d) => d,
        None => return false,
    };
    
    // 逝者owner拥有所有权限
    if deceased.owner == *who {
        return true;
    }
    
    // 检查授权权限
    if let Some(auth) = DeceasedAuthorizations::<T>::get(deceased_id, who) {
        match permission {
            "update" => auth.permissions.can_update,
            "relations" => auth.permissions.can_manage_relations,
            "works" => auth.permissions.can_manage_works,
            _ => false,
        }
    } else {
        false
    }
}
```

**优点**：
- ✅ 权限更精确，支持细粒度控制
- ✅ 符合实际使用场景
- ✅ 可以灵活授权和撤销

**缺点**：
- ❌ 需要为每个逝者单独授权
- ❌ 需要新增授权功能

**方案B：关系自动权限（备选）**

**设计思路**：
- 通过逝者关系自动获得权限
- 例如：父子关系自动获得管理权限

**优点**：
- ✅ 自动权限管理，无需手动授权

**缺点**：
- ❌ 关系权限逻辑复杂
- ❌ 可能不符合所有场景

**推荐方案**：方案A（逝者授权功能）

---

#### 1.2.3 墓位准入策略替代方案

**方案A：逝者可见性（简单实现）**

**设计思路**：
- 使用现有的 `VisibilityOf` 存储
- 支持公开/私有两种状态
- 私有状态下，仅owner和授权账户可以访问

**实现方式**：
```rust
// 现有存储项（已存在）
pub type VisibilityOf<T: Config> = StorageMap<T::DeceasedId, bool>;

// 检查访问权限
pub fn can_access_deceased(
    who: &T::AccountId,
    deceased_id: T::DeceasedId,
) -> bool {
    let deceased = match DeceasedOf::<T>::get(deceased_id) {
        Some(d) => d,
        None => return false,
    };
    
    // 检查可见性
    let is_public = VisibilityOf::<T>::get(deceased_id).unwrap_or(true);
    
    if is_public {
        return true;  // 公开，所有人可访问
    }
    
    // 私有，仅owner和授权账户可访问
    if deceased.owner == *who {
        return true;
    }
    
    // 检查授权
    DeceasedAuthorizations::<T>::contains_key(deceased_id, who)
}
```

**优点**：
- ✅ 实现简单，使用现有功能
- ✅ 符合基本需求

**缺点**：
- ❌ 功能较简单，不支持白名单

**方案B：逝者白名单（完整实现）**

**设计思路**：
- 新增逝者白名单功能
- 支持添加/删除白名单账户
- 支持公开/私有/白名单三种模式

**实现方式**：
```rust
// 新增存储项
pub type DeceasedWhitelist<T: Config> = StorageDoubleMap<
    T::DeceasedId,
    T::AccountId,
    ()
>;

pub enum AccessMode {
    Public,      // 公开：所有人可访问
    Private,     // 私有：仅owner和授权账户可访问
    Whitelist,   // 白名单：仅owner、授权账户和白名单账户可访问
}

pub type AccessModeOf<T: Config> = StorageMap<T::DeceasedId, AccessMode>;

// 检查访问权限
pub fn can_access_deceased(
    who: &T::AccountId,
    deceased_id: T::DeceasedId,
) -> bool {
    let deceased = match DeceasedOf::<T>::get(deceased_id) {
        Some(d) => d,
        None => return false,
    };
    
    // owner和授权账户始终可访问
    if deceased.owner == *who {
        return true;
    }
    if DeceasedAuthorizations::<T>::contains_key(deceased_id, who) {
        return true;
    }
    
    // 检查访问模式
    let mode = AccessModeOf::<T>::get(deceased_id).unwrap_or(AccessMode::Public);
    
    match mode {
        AccessMode::Public => true,
        AccessMode::Private => false,
        AccessMode::Whitelist => DeceasedWhitelist::<T>::contains_key(deceased_id, who),
    }
}
```

**优点**：
- ✅ 功能完整，支持精细控制
- ✅ 符合复杂场景需求

**缺点**：
- ❌ 需要新增白名单功能
- ❌ 增加代码复杂度

**推荐方案**：方案A（简单实现）+ 方案B（未来扩展）

---

#### 1.2.4 墓位统计功能替代方案

**方案A：按逝者统计（直接实现）**

**设计思路**：
- 直接按逝者统计供奉次数、金额、周活跃
- 统计更精确，直接到目标

**实现方式**：
```rust
// pallet-ledger 存储项重构
pub type TotalsByTarget<T: Config> = StorageDoubleMap<
    u8,  // target_type: 0=逝者, 1=宠物
    u64,  // target_id: 逝者ID或宠物ID
    u64   // 累计次数
>;

pub type TotalMemoByTarget<T: Config> = StorageDoubleMap<
    u8,
    u64,
    T::Balance  // 累计金额
>;

pub type WeeklyActive<T: Config> = StorageMap<
    (u8, u64, T::AccountId, u64),  // (target_type, target_id, who, week_index)
    ()
>;
```

**优点**：
- ✅ 统计更精确，直接到目标
- ✅ 实现简单直接

**缺点**：
- ❌ 失去墓位级聚合统计

**方案B：关系聚合统计（扩展实现）**

**设计思路**：
- 通过逝者关系聚合统计
- 例如：统计所有亲属的供奉

**实现方式**：
```rust
// 聚合统计函数
pub fn get_aggregated_statistics(
    deceased_id: T::DeceasedId,
) -> (u64, T::Balance) {
    // 获取所有相关逝者
    let related_ids = Self::get_related_deceased(deceased_id);
    
    // 聚合统计
    let mut total_count = 0u64;
    let mut total_amount = T::Balance::zero();
    
    for related_id in related_ids {
        let count = TotalsByTarget::<T>::get(0, related_id);  // 0=逝者
        let amount = TotalMemoByTarget::<T>::get(0, related_id);
        
        total_count = total_count.saturating_add(count);
        total_amount = total_amount.saturating_add(amount);
    }
    
    (total_count, total_amount)
}
```

**优点**：
- ✅ 支持灵活聚合
- ✅ 可以按关系网络统计

**缺点**：
- ❌ 需要关系查询，性能可能较慢
- ❌ 需要新增聚合功能

**推荐方案**：方案A（直接实现）+ 方案B（未来扩展）

---

#### 1.2.5 墓位分账功能替代方案

**方案A：直接分账给逝者owner（推荐）**

**设计思路**：
- 供奉资金直接分账给逝者/宠物owner
- 分账更直接，减少中间层

**实现方式**：
```rust
// pallet-memorial 分账逻辑重构
fn transfer_with_simple_route(
    who: &T::AccountId,
    target_type: u8,
    target_id: u64,
    total_amount: T::Balance,
    sacrifice_id: u64,
    duration_weeks: Option<u32>,
) -> DispatchResult {
    // 获取目标owner
    let target_owner = match target_type {
        0 => {
            // 逝者owner
            let deceased = pallet_deceased::DeceasedOf::<T>::get(target_id)
                .ok_or(Error::<T>::TargetNotFound)?;
            deceased.owner
        },
        1 => {
            // 宠物owner
            let pet = pallet_stardust_pet::Pets::<T>::get(target_id)
                .ok_or(Error::<T>::TargetNotFound)?;
            pet.owner
        },
        _ => return Err(Error::<T>::InvalidTarget.into()),
    };
    
    // 分账给target_owner（通过affiliate系统）
    T::AffiliateProvider::transfer_with_route(
        who,
        &target_owner,
        total_amount,
        sacrifice_id,
        duration_weeks,
    )?;
    
    Ok(())
}
```

**优点**：
- ✅ 分账更直接，减少中间层
- ✅ 实现简单

**缺点**：
- ❌ 失去墓位级聚合分账

**方案B：关系聚合分账（扩展实现）**

**设计思路**：
- 通过逝者关系聚合分账
- 例如：分账给所有亲属

**优点**：
- ✅ 支持灵活分账

**缺点**：
- ❌ 需要关系查询，逻辑复杂

**推荐方案**：方案A（直接实现）

---

### 1.3 编写迁移计划

#### 1.3.1 迁移时间线

**总时间**：10-15周

| 阶段 | 时间 | 主要任务 | 优先级 |
|------|------|---------|--------|
| **阶段1：准备阶段** | 1-2周 | 依赖分析、替代方案设计、迁移计划、测试用例 | P0 |
| **阶段2：重构阶段** | 4-6周 | 重构各pallet、更新接口、迁移数据 | P0 |
| **阶段3：清理阶段** | 1-2周 | 移除Runtime配置、清理代码 | P0 |
| **阶段4：测试阶段** | 2-3周 | 单元测试、集成测试、端到端测试 | P0 |
| **阶段5：部署阶段** | 1周 | 数据迁移、部署、监控 | P0 |

#### 1.3.2 详细迁移步骤

**步骤1：pallet-deceased 重构（4-6周）**

**Week 1-2：数据结构重构**
- [ ] 移除 `Deceased.grave_id` 字段
- [ ] 移除 `DeceasedByGrave` 存储项
- [ ] 更新 `Deceased` 结构体定义
- [ ] 更新相关索引和查询

**Week 3-4：接口重构**
- [ ] 重构 `create_deceased` 接口（移除grave_id参数）
- [ ] 删除 `transfer_deceased` 接口（使用 `transfer_deceased_owner` 替代）
- [ ] 重构关系管理接口（改为基于逝者owner权限）
- [ ] 更新权限检查逻辑

**Week 5-6：新增功能**
- [ ] 实现逝者授权功能（`authorize_deceased`, `revoke_authorization`）
- [ ] 实现权限检查函数（`can_manage_deceased`）
- [ ] 更新可见性检查逻辑
- [ ] 更新所有相关事件

**步骤2：pallet-memorial 重构（2-3周）**

**Week 1：数据结构重构**
- [ ] 移除 `OfferingRecord.grave_id` 字段
- [ ] 新增 `OfferingRecord.target_type` 和 `target_id` 字段
- [ ] 移除 `OfferingsByGrave` 存储项
- [ ] 新增 `OfferingsByTarget` 存储项

**Week 2：接口重构**
- [ ] 重构 `offer` 接口（改为target_type + target_id）
- [ ] 重构分账逻辑（改为获取逝者/宠物owner）
- [ ] 更新Hook调用（改为传递target_type + target_id）
- [ ] 更新所有相关事件

**Week 3：查询功能重构**
- [ ] 重构 `get_offerings_by_grave` 接口（改为 `get_offerings_by_target`）
- [ ] 更新前端调用
- [ ] 更新统计功能

**步骤3：pallet-ledger 重构（2-3周）**

**Week 1：存储项重构**
- [ ] 重构 `TotalsByGrave` → `TotalsByTarget`
- [ ] 重构 `TotalMemoByGrave` → `TotalMemoByTarget`
- [ ] 重构 `WeeklyActive` 存储项
- [ ] 重构 `DedupKeys` 存储项

**Week 2：接口重构**
- [ ] 重构 `record_from_hook_with_amount` 接口
- [ ] 重构 `mark_weekly_active` 接口
- [ ] 重构所有查询接口
- [ ] 更新Hook调用

**Week 3：测试和优化**
- [ ] 单元测试
- [ ] 性能测试
- [ ] 优化查询性能

**步骤4：pallet-stardust-pet 重构（1-2周）**

**Week 1：数据结构重构**
- [ ] 移除 `Pet.grave_id` 字段
- [ ] 更新 `Pet` 结构体定义

**Week 2：接口重构**
- [ ] 重构 `create_pet` 接口（移除grave_id参数）
- [ ] 重构 `update_pet` 接口（移除grave_id更新）
- [ ] 更新所有相关事件

**步骤5：Runtime 清理（1-2周）**

**Week 1：移除配置**
- [ ] 移除 `pub type Grave = pallet_stardust_grave;`
- [ ] 移除 `impl pallet_stardust_grave::Config for Runtime`
- [ ] 移除相关常量定义

**Week 2：移除适配器**
- [ ] 移除 `GraveProviderAdapter`
- [ ] 移除 `MemorialTargetControl`
- [ ] 移除 `MemorialGraveProvider`
- [ ] 更新其他pallet的配置（移除GraveProvider等）

**步骤6：治理功能清理（1周）**

**Week 1：移除治理调用**
- [ ] 移除 `(1, 10)` → `clear_cover_via_governance`
- [ ] 移除 `(1, 11)` → `gov_transfer_grave`
- [ ] 移除 `(1, 12)` → `gov_set_restricted`
- [ ] 移除 `(1, 13)` → `gov_remove_grave`
- [ ] 移除 `(1, 14)` → `gov_restore_grave`
- [ ] 更新治理文档

---

### 1.4 准备测试用例

#### 1.4.1 测试用例分类

**单元测试**：
- 各pallet的接口测试
- 数据结构测试
- 权限检查测试
- 存储项测试

**集成测试**：
- Pallet间交互测试
- Runtime配置测试
- 事件发布测试

**端到端测试**：
- 完整业务流程测试
- 用户场景测试
- 性能测试

#### 1.4.2 pallet-deceased 测试用例

**测试用例1：创建逝者（无grave_id）**

```rust
#[test]
fn test_create_deceased_without_grave() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        
        // 创建逝者（不指定grave_id）
        assert_ok!(Deceased::create_deceased(
            Origin::signed(alice),
            None,  // 无grave_id
            b"Test Deceased".to_vec(),
            0,  // M
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        // 验证逝者创建成功
        let deceased_id = 1u64;
        let deceased = DeceasedOf::<Runtime>::get(deceased_id).unwrap();
        assert_eq!(deceased.owner, alice);
        assert_eq!(deceased.grave_id, None);  // 无grave_id
        assert_eq!(deceased.name, b"Test Deceased".to_vec());
        
        // 验证事件
        assert!(System::events().iter().any(|e| {
            matches!(e.event, RuntimeEvent::Deceased(DeceasedEvent::DeceasedCreated(
                id, grave_id, owner
            )) if id == deceased_id && grave_id.is_none() && owner == alice)
        }));
    });
}
```

**测试用例2：逝者授权功能**

```rust
#[test]
fn test_authorize_deceased() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        let bob = 2u64;
        
        // 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(alice),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        
        // Alice授权Bob管理逝者
        let permissions = AuthorizationPermissions {
            can_update: true,
            can_manage_relations: false,
            can_manage_works: false,
        };
        
        assert_ok!(Deceased::authorize_deceased(
            Origin::signed(alice),
            deceased_id,
            bob,
            permissions.clone(),
        ));
        
        // 验证授权成功
        let auth = DeceasedAuthorizations::<Runtime>::get(deceased_id, bob).unwrap();
        assert_eq!(auth.authorized_by, alice);
        assert_eq!(auth.permissions.can_update, true);
        
        // 验证Bob可以更新逝者
        assert!(Deceased::can_manage_deceased(&bob, deceased_id, "update"));
        
        // 验证Bob不能管理关系
        assert!(!Deceased::can_manage_deceased(&bob, deceased_id, "relations"));
    });
}
```

**测试用例3：权限检查（owner vs 授权账户）**

```rust
#[test]
fn test_permission_check() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        let bob = 2u64;
        let charlie = 3u64;
        
        // 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(alice),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        
        // Alice授权Bob
        let permissions = AuthorizationPermissions {
            can_update: true,
            can_manage_relations: true,
            can_manage_works: false,
        };
        
        assert_ok!(Deceased::authorize_deceased(
            Origin::signed(alice),
            deceased_id,
            bob,
            permissions,
        ));
        
        // 验证Alice（owner）拥有所有权限
        assert!(Deceased::can_manage_deceased(&alice, deceased_id, "update"));
        assert!(Deceased::can_manage_deceased(&alice, deceased_id, "relations"));
        assert!(Deceased::can_manage_deceased(&alice, deceased_id, "works"));
        
        // 验证Bob（授权账户）拥有部分权限
        assert!(Deceased::can_manage_deceased(&bob, deceased_id, "update"));
        assert!(Deceased::can_manage_deceased(&bob, deceased_id, "relations"));
        assert!(!Deceased::can_manage_deceased(&bob, deceased_id, "works"));
        
        // 验证Charlie（未授权）无权限
        assert!(!Deceased::can_manage_deceased(&charlie, deceased_id, "update"));
        assert!(!Deceased::can_manage_deceased(&charlie, deceased_id, "relations"));
        assert!(!Deceased::can_manage_deceased(&charlie, deceased_id, "works"));
    });
}
```

**测试用例4：删除transfer_deceased接口**

```rust
#[test]
fn test_transfer_deceased_removed() {
    // 验证transfer_deceased接口已删除
    // 应该使用transfer_deceased_owner替代
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        let bob = 2u64;
        
        // 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(alice),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        
        // 使用transfer_deceased_owner转让拥有权
        assert_ok!(Deceased::transfer_deceased_owner(
            Origin::signed(alice),
            deceased_id,
            bob,
        ));
        
        // 验证拥有权已转让
        let deceased = DeceasedOf::<Runtime>::get(deceased_id).unwrap();
        assert_eq!(deceased.owner, bob);
    });
}
```

#### 1.4.3 pallet-memorial 测试用例

**测试用例1：供奉目标改为逝者**

```rust
#[test]
fn test_offer_to_deceased() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        let bob = 2u64;
        
        // 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(bob),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        
        // 创建供奉商品
        // ... 创建sacrifice ...
        
        // Alice向逝者供奉
        assert_ok!(Memorial::offer(
            Origin::signed(alice),
            0,  // target_type: 0=逝者
            deceased_id,  // target_id
            sacrifice_id,
            1,  // quantity
            None,  // duration_weeks
            vec![],  // media
            None,  // memo
        ));
        
        // 验证供奉记录
        let offering_id = 1u64;
        let offering = OfferingRecords::<Runtime>::get(offering_id).unwrap();
        assert_eq!(offering.target_type, 0);  // 逝者
        assert_eq!(offering.target_id, deceased_id);
        
        // 验证分账给Bob（逝者owner）
        // ... 验证分账逻辑 ...
    });
}
```

**测试用例2：供奉目标改为宠物**

```rust
#[test]
fn test_offer_to_pet() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        let bob = 2u64;
        
        // 创建宠物
        assert_ok!(Pet::create_pet(
            Origin::signed(bob),
            b"Test Pet".to_vec(),
            // ... 其他参数
        ));
        
        let pet_id = 1u64;
        
        // 创建供奉商品
        // ... 创建sacrifice ...
        
        // Alice向宠物供奉
        assert_ok!(Memorial::offer(
            Origin::signed(alice),
            1,  // target_type: 1=宠物
            pet_id,  // target_id
            sacrifice_id,
            1,
            None,
            vec![],
            None,
        ));
        
        // 验证供奉记录
        let offering_id = 1u64;
        let offering = OfferingRecords::<Runtime>::get(offering_id).unwrap();
        assert_eq!(offering.target_type, 1);  // 宠物
        assert_eq!(offering.target_id, pet_id);
    });
}
```

**测试用例3：按目标查询供奉**

```rust
#[test]
fn test_get_offerings_by_target() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        let bob = 2u64;
        
        // 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(bob),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        
        // 创建多个供奉
        // ... 创建3个供奉 ...
        
        // 查询逝者的所有供奉
        let offerings = Memorial::get_offerings_by_target(0, deceased_id);
        assert_eq!(offerings.len(), 3);
        
        // 验证所有供奉都指向该逝者
        for offering_id in offerings {
            let offering = OfferingRecords::<Runtime>::get(offering_id).unwrap();
            assert_eq!(offering.target_type, 0);
            assert_eq!(offering.target_id, deceased_id);
        }
    });
}
```

#### 1.4.4 pallet-ledger 测试用例

**测试用例1：按目标统计供奉**

```rust
#[test]
fn test_record_by_target() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        
        // 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(alice),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        
        // 记录供奉
        Ledger::record_from_hook_with_amount(
            0,  // target_type: 0=逝者
            deceased_id,  // target_id
            alice,
            0,  // kind_code
            Some(1000u128),  // amount
            None,  // memo
            None,  // tx_key
        );
        
        // 验证统计
        let count = TotalsByTarget::<Runtime>::get(0, deceased_id);
        assert_eq!(count, 1);
        
        let amount = TotalMemoByTarget::<Runtime>::get(0, deceased_id);
        assert_eq!(amount, 1000u128);
    });
}
```

**测试用例2：周活跃标记**

```rust
#[test]
fn test_weekly_active_by_target() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        
        // 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(alice),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        let start_block = 100u32;
        let duration_weeks = Some(4u32);
        
        // 标记周活跃
        Ledger::mark_weekly_active(
            0,  // target_type
            deceased_id,
            alice,
            start_block,
            duration_weeks,
        );
        
        // 验证周活跃标记
        for week in 0..4 {
            let week_index = (start_block as u64 / BlocksPerWeek::get() as u64) + week;
            assert!(WeeklyActive::<Runtime>::contains_key(
                (0, deceased_id, alice, week_index)
            ));
        }
    });
}
```

#### 1.4.5 集成测试用例

**测试用例1：完整业务流程**

```rust
#[test]
fn test_complete_workflow() {
    new_test_ext().execute_with(|| {
        let alice = 1u64;
        let bob = 2u64;
        
        // 1. 创建逝者
        assert_ok!(Deceased::create_deceased(
            Origin::signed(alice),
            None,
            b"Test Deceased".to_vec(),
            0,
            None,
            b"19900101".to_vec(),
            b"20200101".to_vec(),
            vec![],
        ));
        
        let deceased_id = 1u64;
        
        // 2. Alice授权Bob管理逝者
        let permissions = AuthorizationPermissions {
            can_update: true,
            can_manage_relations: true,
            can_manage_works: false,
        };
        
        assert_ok!(Deceased::authorize_deceased(
            Origin::signed(alice),
            deceased_id,
            bob,
            permissions,
        ));
        
        // 3. Bob更新逝者信息
        assert_ok!(Deceased::update_deceased(
            Origin::signed(bob),
            deceased_id,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(vec![b"https://example.com".to_vec()]),
        ));
        
        // 4. Bob向逝者供奉
        // ... 创建sacrifice ...
        assert_ok!(Memorial::offer(
            Origin::signed(bob),
            0,
            deceased_id,
            sacrifice_id,
            1,
            None,
            vec![],
            None,
        ));
        
        // 5. 验证统计
        let count = Ledger::totals_by_target(0, deceased_id);
        assert_eq!(count, 1);
        
        // 6. 验证分账给Alice（逝者owner）
        // ... 验证分账逻辑 ...
    });
}
```

#### 1.4.6 性能测试用例

**测试用例1：大量逝者创建性能**

```rust
#[bench]
fn bench_create_many_deceased(b: &mut Bencher) {
    new_test_ext().execute_with(|| {
        b.iter(|| {
            for i in 0..100 {
                let account = i as u64;
                assert_ok!(Deceased::create_deceased(
                    Origin::signed(account),
                    None,
                    format!("Deceased {}", i).into_bytes(),
                    0,
                    None,
                    b"19900101".to_vec(),
                    b"20200101".to_vec(),
                    vec![],
                ));
            }
        });
    });
}
```

**测试用例2：关系查询性能**

```rust
#[bench]
fn bench_query_related_deceased(b: &mut Bencher) {
    new_test_ext().execute_with(|| {
        // 创建大量逝者和关系
        // ... 设置测试数据 ...
        
        b.iter(|| {
            let related = Deceased::get_related_deceased(1u64);
            assert!(!related.is_empty());
        });
    });
}
```

---

## 阶段2：重构阶段（4-6周）

### 2.1 重构顺序

**优先级顺序**：
1. **pallet-deceased**（P0，4-6周）
2. **pallet-memorial**（P1，2-3周）
3. **pallet-ledger**（P1，2-3周）
4. **pallet-stardust-pet**（P2，1-2周）

**并行任务**：
- pallet-memorial 和 pallet-ledger 可以并行进行
- pallet-stardust-pet 可以在其他pallet完成后进行

### 2.2 重构检查清单

**每个pallet重构完成后检查**：
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 代码审查通过
- [ ] 文档更新完成
- [ ] 性能测试通过

---

## 阶段3：清理阶段（1-2周）

### 3.1 Runtime清理

- [ ] 移除 `pub type Grave = pallet_stardust_grave;`
- [ ] 移除 `impl pallet_stardust_grave::Config for Runtime`
- [ ] 移除相关常量定义
- [ ] 移除适配器实现
- [ ] 更新其他pallet的配置

### 3.2 治理功能清理

- [ ] 移除5个治理调用
- [ ] 更新治理文档
- [ ] 更新前端治理页面

### 3.3 代码清理

- [ ] 移除所有grave相关注释
- [ ] 清理未使用的导入
- [ ] 更新README文档

---

## 阶段4：测试阶段（2-3周）

### 4.1 测试计划

**Week 1：单元测试和集成测试**
- [ ] 所有pallet的单元测试
- [ ] Pallet间集成测试
- [ ] Runtime配置测试

**Week 2：端到端测试**
- [ ] 完整业务流程测试
- [ ] 用户场景测试
- [ ] 性能测试

**Week 3：回归测试**
- [ ] 回归测试
- [ ] 边界条件测试
- [ ] 错误处理测试

### 4.2 测试覆盖率目标

- **单元测试覆盖率**：> 90%
- **集成测试覆盖率**：> 80%
- **端到端测试覆盖率**：> 70%

---

## 阶段5：部署阶段（1周）

### 5.1 数据迁移

**迁移策略**：
- 如果主网已上线，需要数据迁移
- 如果主网未上线，可以直接清理数据

**迁移步骤**：
1. 备份现有数据
2. 执行数据迁移脚本
3. 验证迁移结果
4. 回滚准备

### 5.2 部署计划

**部署步骤**：
1. 部署到测试网络
2. 测试网络验证
3. 部署到主网
4. 监控和回滚准备

### 5.3 监控指标

**关键指标**：
- 交易成功率
- 区块生成时间
- 存储使用量
- 错误率

---

## 风险评估与回滚方案

### 风险1：数据丢失风险

**风险描述**：删除grave相关数据可能导致数据丢失

**缓解措施**：
- 完整备份所有数据
- 数据迁移脚本验证
- 分阶段迁移

**回滚方案**：
- 保留数据备份
- 准备数据恢复脚本
- 快速回滚机制

### 风险2：功能中断风险

**风险描述**：重构过程中可能导致功能中断

**缓解措施**：
- 分阶段重构
- 充分测试
- 灰度发布

**回滚方案**：
- 保留旧版本代码
- 快速回滚机制
- 功能开关

### 风险3：性能下降风险

**风险描述**：重构后可能影响性能

**缓解措施**：
- 性能测试
- 性能优化
- 监控指标

**回滚方案**：
- 性能基准测试
- 性能回滚机制

---

**文档版本**：v1.0.0  
**最后更新**：2025-01-XX  
**维护者**：Stardust 开发团队

