# Pallet Memo Grave - 墓地管理系统

> **⚠️ 重要变更（Phase 3.3）**  
> **投诉功能已迁移到`pallet-memo-appeals`**  
> - ❌ 墓地投诉记录列表（`ComplaintsByGrave`）已废弃  
> - ✅ 请使用`pallet-memo-appeals`统一投诉治理系统  
> - 📚 [迁移指南](../../docs/投诉申诉治理-Phase3.3迁移指南.md)  
> - **主网未上线，破坏式变更，无需兼容旧API**

## 📋 模块概述

`pallet-memo-grave` 是Memopark生态的**核心墓地管理模块**，提供墓位创建、安葬管理、封面/音频设置、关注系统等功能。通过低耦合设计（GraveInspector trait）与逝者模块交互，支持IPFS自动Pin和关注押金管理。

**注意**: 投诉举报功能已统一迁移到`pallet-memo-appeals`，获得完整的治理流程（公示期、应答否决等），本模块专注于墓地管理功能。

## 🔑 核心功能

### 1. 墓地结构
```rust
pub struct Grave<T: Config> {
    pub park_id: Option<u64>,       // 所属园区ID
    pub owner: T::AccountId,
    pub admin_group: Option<u64>,
    pub name: BoundedVec<u8, T::MaxCidLen>,  // 墓地名称CID
    pub deceased_tokens: BoundedVec<BoundedVec<u8, T::MaxCidLen>, ConstU32<6>>,  // 安葬的逝者令牌
    pub is_public: bool,
    pub active: bool,
}
```

### 2. 安葬记录
```rust
pub struct IntermentRecord<T: Config> {
    pub grave_id: u64,
    pub deceased_id: u64,
    pub slot: Option<u16>,          // 墓位槽位（1-6）
    pub note_cid: Option<BoundedVec<u8, T::MaxCidLen>>,  // 安葬备注CID
    pub recorded_at: BlockNumberFor<T>,
}
```

### 3. 核心接口

#### create_grave - 创建墓位
```rust
pub fn create_grave(
    origin: OriginFor<T>,
    name_cid: Vec<u8>,
    is_public: bool,
) -> DispatchResult
```

**功能**：
- 支付CreateFee创建费
- 创建墓位记录
- 生成10位数字Slug（人类可读ID）

#### inter_deceased - 安葬逝者
```rust
pub fn inter_deceased(
    origin: OriginFor<T>,
    grave_id: u64,
    deceased_id: u64,
    slot: Option<u16>,
    note_cid: Option<Vec<u8>>,
) -> DispatchResult
```

**功能**：
- 检查准入策略（GraveInspector::check_admission_policy）
- 记录安葬信息
- 更新deceased_tokens列表（最多6人）

#### exhume_deceased - 迁出逝者
```rust
pub fn exhume_deceased(
    origin: OriginFor<T>,
    grave_id: u64,
    deceased_id: u64,
) -> DispatchResult
```

**功能**：
- 从墓位移除逝者
- 更新deceased_tokens列表

### 4. 封面与音频

#### set_cover - 设置封面
```rust
pub fn set_cover(
    origin: OriginFor<T>,
    grave_id: u64,
    cover_cid: Vec<u8>,
) -> DispatchResult
```

**功能**：
- 设置墓位封面图（可从公共目录选择）
- 自动Pin CID到IPFS

#### set_audio - 设置背景音乐
```rust
pub fn set_audio(
    origin: OriginFor<T>,
    grave_id: u64,
    audio_cid: Vec<u8>,
) -> DispatchResult
```

**功能**：
- 设置墓位背景音乐
- 自动Pin CID到IPFS

#### set_audio_playlist - 设置播放列表
```rust
pub fn set_audio_playlist(
    origin: OriginFor<T>,
    grave_id: u64,
    cids: Vec<Vec<u8>>,
) -> DispatchResult
```

**功能**：
- 设置多个音频组成播放列表
- 批量Pin所有CID到IPFS

### 5. 关注系统

#### follow_grave - 关注墓位
```rust
pub fn follow_grave(
    origin: OriginFor<T>,
    grave_id: u64,
) -> DispatchResult
```

**功能**：
- 冻结FollowDeposit押金（可配置为0）
- 添加到关注者列表
- 冷却期保护（FollowCooldownBlocks）

#### unfollow_grave - 取消关注
```rust
pub fn unfollow_grave(
    origin: OriginFor<T>,
    grave_id: u64,
) -> DispatchResult
```

**功能**：
- 释放押金
- 从关注者列表移除

### 6. GraveInspector Trait
```rust
pub trait GraveInspector<AccountId, GraveId> {
    /// 检查墓位是否存在
    fn grave_exists(grave_id: GraveId) -> bool;
    
    /// 检查是否允许安葬
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool;
    
    /// 记录安葬
    fn record_interment(
        grave_id: GraveId,
        deceased_id: u64,
        slot: Option<u16>,
        note_cid: Option<Vec<u8>>,
    ) -> Result<(), sp_runtime::DispatchError>;
    
    /// 记录迁出
    fn record_exhumation(
        grave_id: GraveId,
        deceased_id: u64,
    ) -> Result<(), sp_runtime::DispatchError>;
    
    /// 检查准入策略
    fn check_admission_policy(
        who: &AccountId,
        grave_id: GraveId,
    ) -> Result<(), sp_runtime::DispatchError>;
}
```

**用途**：pallet-deceased通过此trait与pallet-memo-grave交互，保持低耦合

## 📦 存储结构

```rust
// 墓位记录
pub type Graves<T: Config> = StorageMap<_, Blake2_128Concat, u64, Grave<T>>;

// Slug映射（10位数字 → grave_id）
pub type SlugToId<T: Config> = StorageMap<_, Blake2_128Concat, u64, u64>;

// 安葬记录
pub type Interments<T: Config> = StorageMap<_, Blake2_128Concat, (u64, u64), IntermentRecord<T>>;

// 关注者列表
pub type Followers<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // grave_id
    BoundedVec<T::AccountId, T::MaxFollowers>,
>;

// 封面设置
pub type CoverOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<u8, T::MaxCidLen>>;

// 音频设置
pub type AudioOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<u8, T::MaxCidLen>>;

// 播放列表
pub type AudioPlaylistOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,
    BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxAudioPlaylistLen>,
>;

// 公共封面目录
pub type CoverOptions<T: Config> = StorageValue<_, BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxCoverOptions>>;

// 公共音频目录
pub type AudioOptions<T: Config> = StorageValue<_, BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxAudioOptions>>;
```

## 📡 可调用接口

### 墓位管理

#### 1. create_grave - 创建墓位
```rust
#[pallet::call_index(0)]
pub fn create_grave(origin, name_cid, is_public) -> DispatchResult
```

#### 2. inter_deceased - 安葬逝者
```rust
#[pallet::call_index(1)]
pub fn inter_deceased(origin, grave_id, deceased_id, slot, note_cid) -> DispatchResult
```

#### 3. exhume_deceased - 迁出逝者
```rust
#[pallet::call_index(2)]
pub fn exhume_deceased(origin, grave_id, deceased_id) -> DispatchResult
```

### 媒体设置

#### 4. set_cover - 设置封面
```rust
#[pallet::call_index(3)]
pub fn set_cover(origin, grave_id, cover_cid) -> DispatchResult
```

#### 5. set_audio - 设置音频
```rust
#[pallet::call_index(4)]
pub fn set_audio(origin, grave_id, audio_cid) -> DispatchResult
```

#### 6. set_audio_playlist - 设置播放列表
```rust
#[pallet::call_index(5)]
pub fn set_audio_playlist(origin, grave_id, cids) -> DispatchResult
```

### 关注系统

#### 7. follow_grave - 关注墓位
```rust
#[pallet::call_index(6)]
pub fn follow_grave(origin, grave_id) -> DispatchResult
```

#### 8. unfollow_grave - 取消关注
```rust
#[pallet::call_index(7)]
pub fn unfollow_grave(origin, grave_id) -> DispatchResult
```

### 治理接口

#### 9. add_cover_option - 添加公共封面
```rust
#[pallet::call_index(8)]
pub fn add_cover_option(origin, cover_cid) -> DispatchResult
```

#### 10. add_audio_option - 添加公共音频
```rust
#[pallet::call_index(9)]
pub fn add_audio_option(origin, audio_cid) -> DispatchResult
```

## 🎉 事件

### GraveCreated - 墓位创建事件
```rust
GraveCreated {
    grave_id: u64,
    owner: T::AccountId,
    slug: u64,
}
```

### DeceasedInterred - 逝者安葬事件
```rust
DeceasedInterred {
    grave_id: u64,
    deceased_id: u64,
    slot: Option<u16>,
}
```

### GraveFollowed - 墓位关注事件
```rust
GraveFollowed {
    grave_id: u64,
    follower: T::AccountId,
}
```

## 🔌 使用示例

### 场景1：创建墓位并安葬逝者

```rust
// 1. 创建墓位
let grave_id = pallet_memo_grave::Pallet::<T>::create_grave(
    owner_origin,
    b"Qm...".to_vec(),  // 墓地名称CID
    true,  // 公开
)?;

// 2. 创建逝者（在pallet-deceased）
let deceased_id = pallet_deceased::Pallet::<T>::create_deceased(...)?;

// 3. 安葬逝者到墓位
pallet_memo_grave::Pallet::<T>::inter_deceased(
    owner_origin,
    grave_id,
    deceased_id,
    Some(1),  // 槽位1
    Some(b"Qm...".to_vec()),  // 安葬备注CID
)?;
```

### 场景2：设置墓位封面和音乐

```rust
// 1. 设置封面
pallet_memo_grave::Pallet::<T>::set_cover(
    owner_origin,
    grave_id,
    b"Qm...".to_vec(),  // 封面CID
)?;

// 2. 设置背景音乐播放列表
pallet_memo_grave::Pallet::<T>::set_audio_playlist(
    owner_origin,
    grave_id,
    vec![
        b"Qm1...".to_vec(),  // 音乐1
        b"Qm2...".to_vec(),  // 音乐2
        b"Qm3...".to_vec(),  // 音乐3
    ],
)?;
```

## 🛡️ 安全机制

1. **创建费用**：防止恶意创建墓位
2. **关注押金**：防止恶意关注（可配置为0）
3. **准入策略**：通过GraveInspector控制安葬权限
4. **冷却期保护**：防止频繁关注/取消关注
5. **IPFS自动Pin**：确保媒体内容持久化

## 🔗 相关模块

- **pallet-deceased**: 逝者管理（通过GraveInspector交互）
- **pallet-memo-ipfs**: IPFS存储（自动Pin CID）
- **pallet-memo-offerings**: 供奉系统（查询墓位信息）
- **pallet-ledger**: 供奉账本（统计墓位供奉）

## 📚 参考资源

- [墓地管理设计](../../docs/grave-management-design.md)
- [GraveInspector Trait](../../docs/grave-inspector-trait.md)
- [关注系统设计](../../docs/follow-system-design.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Memopark 开发团队
