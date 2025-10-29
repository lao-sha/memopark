# Pallet Deceased - 逝者管理系统

## 📋 模块概述

`pallet-deceased` 是Stardust生态的**核心业务模块**，提供逝者信息的创建、管理、迁移和查询功能。通过低耦合设计与`pallet-grave`(墓地系统)协作，实现逝者与墓位的关联管理，并集成IPFS自动Pin功能保障媒体文件的持久化存储。

### 设计理念

- **低耦合**：通过GraveInspector Trait与墓地系统解耦
- **自由迁移**：逝者owner可自由迁移逝者（受墓地准入策略约束）
- **媒体持久化**：自动Pin逝者主图和全名CID到IPFS
- **双向同步**：操作deceased时自动同步grave的Interments存储

## 🏗️ 架构设计

```text
┌──────────────────────────────────────┐
│     用户操作 (Create/Transfer)       │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│     Deceased Pallet (逝者管理)       │
│  - create_deceased()    创建逝者      │
│  - transfer_deceased()  迁移逝者      │
│  - update_deceased()    更新信息      │
│  - set_main_image()     设置主图      │
└──────────────┬───────────────────────┘
               ↓ GraveInspector Trait
┌──────────────────────────────────────┐
│     Grave Pallet (墓地管理)          │
│  - grave_exists()       检查墓位存在  │
│  - can_attach()         检查附加权限  │
│  - record_interment()   记录安葬      │
│  - record_exhumation()  记录起掘      │
│  - check_admission_policy() 检查准入  │
└──────────────────────────────────────┘
               ↓
┌──────────────────────────────────────┐
│     IPFS Pinner (媒体持久化)         │
│  - Auto pin name_full_cid            │
│  - Auto pin main_image_cid           │
└──────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 逝者创建

#### create_deceased - 创建逝者记录
```rust
pub fn create_deceased(
    origin: OriginFor<T>,
    grave_id: T::GraveId,
    name: BoundedVec<u8, T::MaxNameLen>,
    gender: u8,
    name_full_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
    birth_ts: Option<u64>,
    death_ts: Option<u64>,
    main_image_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
    links: Vec<BoundedVec<u8, T::MaxLinkLen>>,
) -> DispatchResult
```

**参数说明**：
- `grave_id`: 墓位ID（逝者归属的墓位）
- `name`: 逝者简短名称（显示用）
- `gender`: 性别（0=未知, 1=男, 2=女, 3=其他）
- `name_full_cid`: 完整名称/生平CID（IPFS）
- `birth_ts`: 出生时间戳
- `death_ts`: 逝世时间戳
- `main_image_cid`: 主图CID（IPFS）
- `links`: 外部链接列表

**工作流程**：
1. 检查墓位是否存在（`GraveInspector::grave_exists`）
2. 检查操作者权限（`GraveInspector::can_attach`）
3. 创建逝者记录
4. 自动Pin `name_full_cid` 到IPFS
5. 自动Pin `main_image_cid` 到IPFS
6. 同步到墓地系统（`GraveInspector::record_interment`）
7. 建立索引：`DeceasedByGrave[grave_id][deceased_id]`

**权限**：
- 墓主（grave owner）
- 被授权者（根据墓地系统的授权机制）

### 2. 逝者迁移

#### transfer_deceased - 迁移逝者到新墓位
```rust
pub fn transfer_deceased(
    origin: OriginFor<T>,
    deceased_id: u64,
    to_grave_id: T::GraveId,
    slot: Option<u16>,
    note_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
) -> DispatchResult
```

**功能**：
- 将逝者从当前墓位迁移到新墓位
- 支持逝者owner自由迁移（解决需求3）
- 受目标墓位准入策略约束（解决P0问题2）

**准入策略**：
- **OwnerOnly（默认）**：仅墓主可迁入
- **Public**：任何人都可迁入
- **Whitelist**：仅白名单可迁入

**工作流程**：
1. 检查调用者是否为逝者owner
2. 检查目标墓位是否存在
3. **检查目标墓位准入策略**（`GraveInspector::check_admission_policy`）
4. 从旧墓位起掘（`GraveInspector::record_exhumation`）
5. 更新逝者的`grave_id`
6. 安葬到新墓位（`GraveInspector::record_interment`）
7. 更新索引

**设计理念**：
- 平衡**逝者自由迁移**（需求3）与**墓主控制权**
- 墓主可设置准入策略保护墓位
- 逝者owner在策略允许范围内自由迁移

### 3. 逝者更新

#### update_deceased - 更新逝者信息
```rust
pub fn update_deceased(
    origin: OriginFor<T>,
    deceased_id: u64,
    name: Option<BoundedVec<u8, T::MaxNameLen>>,
    gender: Option<u8>,
    name_full_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
    birth_ts: Option<u64>,
    death_ts: Option<u64>,
    links: Option<Vec<BoundedVec<u8, T::MaxLinkLen>>>,
) -> DispatchResult
```

**权限**：逝者owner或墓主（通过GovernanceOrigin）

**功能**：
- 更新逝者基本信息
- 如更新`name_full_cid`，自动Pin新CID到IPFS

#### set_main_image - 设置逝者主图
```rust
pub fn set_main_image(
    origin: OriginFor<T>,
    deceased_id: u64,
    cid: BoundedVec<u8, T::MaxCidLen>,
) -> DispatchResult
```

**权限**：GovernanceOrigin（墓主或委员会）

**功能**：
- 设置或更新逝者主图
- 自动Pin新CID到IPFS

### 4. 逝者删除

#### remove_deceased - 删除逝者记录
```rust
pub fn remove_deceased(
    origin: OriginFor<T>,
    deceased_id: u64,
) -> DispatchResult
```

**权限**：逝者owner或GovernanceOrigin

**功能**：
- 删除逝者记录
- 从墓地系统移除（`GraveInspector::record_exhumation`）
- 清理索引

### 5. 所有权转移

#### transfer_ownership - 转移逝者所有权
```rust
pub fn transfer_ownership(
    origin: OriginFor<T>,
    deceased_id: u64,
    new_owner: T::AccountId,
) -> DispatchResult
```

**权限**：GovernanceOrigin（墓主或委员会）

**功能**：
- 转移逝者的管理权
- 用于继承、授权等场景

## 📦 存储结构

### 逝者记录
```rust
pub type Deceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // deceased_id
    DeceasedInfo<T>,
    OptionQuery,
>;
```

**DeceasedInfo结构**：
```rust
pub struct DeceasedInfo<T: Config> {
    pub grave_id: T::GraveId,                          // 归属墓位
    pub owner: T::AccountId,                           // 所有者
    pub creator: T::AccountId,                         // 创建者
    pub name: BoundedVec<u8, T::MaxNameLen>,           // 简短名称
    pub gender: u8,                                    // 性别
    pub name_full_cid: Option<BoundedVec<u8, T::MaxCidLen>>, // 完整名称CID
    pub birth_ts: Option<u64>,                         // 出生时间戳
    pub death_ts: Option<u64>,                         // 逝世时间戳
    pub main_image_cid: Option<BoundedVec<u8, T::MaxCidLen>>, // 主图CID
    pub deceased_token: Option<T::DeceasedToken>,      // 逝者代币（可选）
    pub links: BoundedVec<BoundedVec<u8, T::MaxLinkLen>, T::MaxLinks>, // 外部链接
    pub created: BlockNumberFor<T>,                    // 创建时间
    pub updated: BlockNumberFor<T>,                    // 更新时间
    pub version: u32,                                  // 版本号
}
```

### 墓位索引
```rust
pub type DeceasedByGrave<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::GraveId,  // grave_id
    Blake2_128Concat,
    u64,         // deceased_id
    (),
    OptionQuery,
>;
```

**用途**：快速查询墓位下的所有逝者

### 下一个ID
```rust
pub type NextDeceasedId<T: Config> = StorageValue<_, u64, ValueQuery>;
```

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 墓位ID类型
    type GraveId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

    /// 逝者代币类型（可选，用于NFT）
    type DeceasedToken: Parameter + Member + MaxEncodedLen;

    /// 逝者名称最大长度
    type MaxNameLen: Get<u32>;

    /// IPFS CID最大长度
    type MaxCidLen: Get<u32>;

    /// 外部链接最大长度
    type MaxLinkLen: Get<u32>;

    /// 每个逝者最多链接数
    type MaxLinks: Get<u32>;

    /// 墓位检查接口（与pallet-grave低耦合）
    type GraveInspector: GraveInspector<Self::AccountId, Self::GraveId>;

    /// 治理起源（墓主或委员会）
    type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

    /// IPFS自动Pin提供者
    type IpfsPinner: IpfsPinner<Self::AccountId, Self::Balance>;

    /// 余额类型（用于IPFS存储费用）
    type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

    /// 默认IPFS存储单价
    type DefaultStoragePrice: Get<Self::Balance>;

    /// 权重信息
    type WeightInfo: WeightInfo;
}
```

## 📡 可调用接口

### 用户接口

#### 1. create_deceased - 创建逝者
```rust
#[pallet::call_index(0)]
pub fn create_deceased(...) -> DispatchResult
```

**权限**：墓主或被授权者

#### 2. transfer_deceased - 迁移逝者
```rust
#[pallet::call_index(1)]
pub fn transfer_deceased(...) -> DispatchResult
```

**权限**：逝者owner（受目标墓位准入策略约束）

#### 3. update_deceased - 更新逝者
```rust
#[pallet::call_index(2)]
pub fn update_deceased(...) -> DispatchResult
```

**权限**：逝者owner或GovernanceOrigin

### 治理接口

#### 4. set_main_image - 设置主图
```rust
#[pallet::call_index(3)]
pub fn set_main_image(...) -> DispatchResult
```

**权限**：GovernanceOrigin

#### 5. transfer_ownership - 转移所有权
```rust
#[pallet::call_index(4)]
pub fn transfer_ownership(...) -> DispatchResult
```

**权限**：GovernanceOrigin

#### 6. remove_deceased - 删除逝者
```rust
#[pallet::call_index(5)]
pub fn remove_deceased(...) -> DispatchResult
```

**权限**：逝者owner或GovernanceOrigin

## 🎉 事件

### DeceasedCreated - 逝者创建事件
```rust
DeceasedCreated {
    deceased_id: u64,
    grave_id: T::GraveId,
    owner: T::AccountId,
    creator: T::AccountId,
}
```

### DeceasedTransferred - 逝者迁移事件
```rust
DeceasedTransferred {
    deceased_id: u64,
    from_grave_id: T::GraveId,
    to_grave_id: T::GraveId,
    operator: T::AccountId,
}
```

### DeceasedUpdated - 逝者更新事件
```rust
DeceasedUpdated {
    deceased_id: u64,
    operator: T::AccountId,
}
```

### MainImageSet - 主图设置事件
```rust
MainImageSet {
    deceased_id: u64,
    cid: BoundedVec<u8, T::MaxCidLen>,
}
```

### OwnershipTransferred - 所有权转移事件
```rust
OwnershipTransferred {
    deceased_id: u64,
    old_owner: T::AccountId,
    new_owner: T::AccountId,
}
```

### DeceasedRemoved - 逝者删除事件
```rust
DeceasedRemoved {
    deceased_id: u64,
    grave_id: T::GraveId,
}
```

## ❌ 错误处理

### DeceasedNotFound
- **说明**：逝者记录不存在
- **触发**：操作不存在的deceased_id

### GraveNotFound
- **说明**：墓位不存在
- **触发**：创建/迁移到不存在的墓位

### NoPermission
- **说明**：无权限操作
- **触发**：非owner/墓主尝试操作

### AdmissionDenied
- **说明**：准入策略拒绝
- **触发**：迁移到不允许的墓位

### AlreadyInGrave
- **说明**：已在目标墓位中
- **触发**：迁移到当前墓位

### InvalidGender
- **说明**：无效的性别值
- **触发**：性别值超出范围(0-3)

## 🔌 GraveInspector Trait

### 接口定义

```rust
pub trait GraveInspector<AccountId, GraveId> {
    /// 检查墓位是否存在
    fn grave_exists(grave_id: GraveId) -> bool;
    
    /// 检查操作者是否有权在该墓位管理逝者
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool;
    
    /// 记录安葬操作（同步Interments存储）
    fn record_interment(
        grave_id: GraveId,
        deceased_id: u64,
        slot: Option<u16>,
        note_cid: Option<Vec<u8>>,
    ) -> Result<(), DispatchError>;
    
    /// 记录起掘操作（同步Interments存储）
    fn record_exhumation(
        grave_id: GraveId,
        deceased_id: u64,
    ) -> Result<(), DispatchError>;
    
    /// 检查墓位准入策略
    fn check_admission_policy(
        who: &AccountId,
        grave_id: GraveId,
    ) -> Result<(), DispatchError>;
}
```

### Runtime实现示例

```rust
impl GraveInspector<AccountId, GraveId> for GraveInspectorImpl {
    fn grave_exists(grave_id: GraveId) -> bool {
        pallet_memo_grave::Graves::<Runtime>::contains_key(grave_id)
    }
    
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool {
        if let Some(grave) = pallet_memo_grave::Graves::<Runtime>::get(grave_id) {
            grave.owner == *who || grave.authorized_users.contains(who)
        } else {
            false
        }
    }
    
    fn record_interment(
        grave_id: GraveId,
        deceased_id: u64,
        slot: Option<u16>,
        note_cid: Option<Vec<u8>>,
    ) -> Result<(), DispatchError> {
        pallet_memo_grave::Pallet::<Runtime>::sync_interment(
            grave_id,
            deceased_id,
            slot,
            note_cid,
        )
    }
    
    fn record_exhumation(
        grave_id: GraveId,
        deceased_id: u64,
    ) -> Result<(), DispatchError> {
        pallet_memo_grave::Pallet::<Runtime>::sync_exhumation(
            grave_id,
            deceased_id,
        )
    }
    
    fn check_admission_policy(
        who: &AccountId,
        grave_id: GraveId,
    ) -> Result<(), DispatchError> {
        let grave = pallet_memo_grave::Graves::<Runtime>::get(grave_id)
            .ok_or(Error::<Runtime>::GraveNotFound)?;
        
        match grave.admission_policy {
            AdmissionPolicy::OwnerOnly => {
                ensure!(grave.owner == *who, Error::<Runtime>::AdmissionDenied);
            },
            AdmissionPolicy::Public => {
                // 任何人都可以
            },
            AdmissionPolicy::Whitelist => {
                ensure!(
                    grave.owner == *who || grave.authorized_users.contains(who),
                    Error::<Runtime>::AdmissionDenied
                );
            },
        }
        Ok(())
    }
}
```

## 📊 工作流程图

### 创建逝者流程

```text
用户A（墓主）
   ↓
调用 create_deceased()
   ├─ 检查墓位存在 (GraveInspector::grave_exists)
   ├─ 检查附加权限 (GraveInspector::can_attach)
   └─ 验证通过
   ↓
创建逝者记录
   ├─ deceased_id = NextDeceasedId
   ├─ owner = caller
   ├─ grave_id = 指定墓位
   └─ 其他字段
   ↓
IPFS自动Pin
   ├─ Pin name_full_cid (if Some)
   └─ Pin main_image_cid (if Some)
   ↓
同步到墓地系统
   └─ GraveInspector::record_interment()
      → grave.Interments[deceased_id] = (slot, note)
   ↓
建立索引
   └─ DeceasedByGrave[grave_id][deceased_id] = ()
   ↓
触发 DeceasedCreated 事件
```

### 迁移逝者流程（解决需求3 + P0问题2）

```text
用户B（逝者owner，非墓主）
   ↓
调用 transfer_deceased(deceased_id, to_grave_id)
   ├─ 检查调用者是否为逝者owner
   ├─ 检查目标墓位是否存在
   └─ 验证通过
   ↓
**检查目标墓位准入策略**（新增）
   └─ GraveInspector::check_admission_policy(B, to_grave_id)
      ├─ OwnerOnly → B == to_grave.owner? 否 → 拒绝
      ├─ Public → 通过
      └─ Whitelist → B in whitelist? 是 → 通过
   ↓
从旧墓位起掘
   └─ GraveInspector::record_exhumation(old_grave_id, deceased_id)
      → 从old_grave.Interments移除
   ↓
更新逝者记录
   └─ deceased.grave_id = to_grave_id
   ↓
安葬到新墓位
   └─ GraveInspector::record_interment(to_grave_id, deceased_id, slot, note)
      → 写入to_grave.Interments
   ↓
更新索引
   ├─ 删除 DeceasedByGrave[old_grave_id][deceased_id]
   └─ 插入 DeceasedByGrave[to_grave_id][deceased_id]
   ↓
触发 DeceasedTransferred 事件
```

## 🛡️ 安全机制

### 1. 权限控制

- **创建**：仅墓主或被授权者
- **迁移**：逝者owner（受准入策略约束）
- **更新**：逝者owner或GovernanceOrigin
- **删除**：逝者owner或GovernanceOrigin

### 2. 准入策略保护

- 墓主可设置OwnerOnly禁止外部迁入
- Public模式允许所有人迁入
- Whitelist模式仅允许白名单迁入
- 平衡逝者自由迁移与墓主控制权

### 3. 双向同步

- deceased操作时自动同步grave.Interments
- 通过GraveInspector Trait实现低耦合
- 确保数据一致性

### 4. IPFS自动Pin

- 创建/更新时自动Pin媒体CID
- 确保媒体文件持久化
- 失败仅记录日志，不阻塞操作

### 5. 版本控制

- 每次更新递增version
- 用于冲突检测和审计

## 📝 最佳实践

### 1. 创建逝者

- 提供尽可能完整的信息
- 主图使用高质量照片
- 外部链接使用HTTPS

### 2. 迁移逝者

- 确认目标墓位准入策略
- 提前与墓主沟通（如需要）
- 选择合适的slot（如有要求）

### 3. 媒体管理

- 优先使用IPFS存储
- CID使用CIDv1格式
- 定期检查Pin状态

### 4. 权限管理

- 谨慎转移所有权
- 定期审计授权列表
- 使用多签管理重要逝者

## 🔗 相关模块

- **pallet-stardust-grave**: 墓地系统（提供GraveInspector实现）
- **pallet-stardust-ipfs**: IPFS管理（自动Pin媒体）
- **pallet-deceased-media**: 逝者媒体扩展（更多媒体管理）
- **pallet-deceased-text**: 逝者文本扩展（生平文本）
- **pallet-memo-offerings**: 供奉系统（供奉对象）

## 📚 参考资源

- [逝者管理系统设计文档](../../docs/deceased-management-design.md)
- [墓地-逝者同步机制](../../docs/grave-deceased-sync.md)
- [准入策略设计](../../docs/admission-policy-design.md)
- [IPFS自动Pin集成指南](../../docs/ipfs-auto-pin-guide.md)

---

**版本**: 1.5.0  
**最后更新**: 2025-10-27  
**维护者**: Stardust 开发团队  
**Phase**: 1.5（已解决逝者-墓地同步问题 + 准入策略保护）
