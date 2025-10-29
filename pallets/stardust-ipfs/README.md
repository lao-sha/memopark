# Pallet Memo IPFS - IPFS存储管理系统

## 📋 模块概述

`pallet-memo-ipfs` 是Memopark生态的**IPFS存储管理模块**，提供CID自动Pin、存储费用计算和副本管理功能。通过IpfsPinner trait为其他模块提供标准化的IPFS存储服务，确保内容持久化。

## 🔑 核心功能

### 1. IpfsPinner Trait
```rust
pub trait IpfsPinner<AccountId, Balance> {
    /// 自动Pin单个CID
    fn auto_pin(cid: &[u8], owner: &AccountId) -> Result<(), &'static str>;
    
    /// 批量Pin多个CID
    fn auto_pin_batch(cids: &[&[u8]], owner: &AccountId) -> Result<(), &'static str>;
    
    /// 计算存储费用
    fn calculate_storage_fee(cid: &[u8], replicas: u32, months: u32) -> Balance;
    
    /// 取消Pin
    fn unpin(cid: &[u8], owner: &AccountId) -> Result<(), &'static str>;
}
```

### 2. 存储记录
```rust
pub struct IpfsRecord<T: Config> {
    pub cid: BoundedVec<u8, T::MaxCidLen>,
    pub owner: T::AccountId,
    pub replicas: u32,           // 副本数（默认3）
    pub pinned_at: BlockNumberFor<T>,
    pub expires_at: Option<BlockNumberFor<T>>,
    pub storage_fee_paid: T::Balance,
    pub source_pallet: BoundedVec<u8, ConstU32<32>>,  // 来源模块
    pub metadata: BoundedVec<u8, ConstU32<256>>,
}
```

### 3. 核心接口

#### auto_pin - 自动Pin CID
```rust
fn auto_pin(cid: &[u8], owner: &AccountId) -> Result<(), &'static str> {
    // 1. 检查CID是否已Pin
    if Self::is_pinned(cid) {
        return Ok(());
    }
    
    // 2. 创建存储记录
    let record = IpfsRecord {
        cid: cid.to_vec(),
        owner: owner.clone(),
        replicas: 3,  // 默认3副本
        pinned_at: current_block,
        expires_at: None,
        storage_fee_paid: 0,
        source_pallet: calling_pallet,
        metadata: vec![],
    };
    
    // 3. 存储记录
    IpfsRecords::<T>::insert(cid, record);
    
    // 4. 触发PinRequest事件（链下OCW监听）
    Self::deposit_event(Event::PinRequested {
        cid: cid.to_vec(),
        owner: owner.clone(),
    });
    
    Ok(())
}
```

#### calculate_storage_fee - 计算存储费用
```rust
fn calculate_storage_fee(cid: &[u8], replicas: u32, months: u32) -> Balance {
    let cid_size = Self::get_cid_size(cid);  // 假设链下查询或估算
    let base_fee = T::DefaultStoragePrice::get();
    
    // 费用 = 基础单价 × CID大小 × 副本数 × 月数
    let fee = base_fee
        .saturating_mul(cid_size.into())
        .saturating_mul(replicas.into())
        .saturating_mul(months.into());
    
    fee
}
```

### 4. 集成场景

#### pallet-deceased集成
```rust
// 逝者创建时自动Pin name_full_cid和main_image_cid
T::IpfsPinner::auto_pin_batch(
    &[&name_full_cid, &main_image_cid],
    &owner,
)?;
```

#### pallet-memo-grave集成
```rust
// 墓位设置音频时自动Pin
T::IpfsPinner::auto_pin(&audio_cid, &owner)?;
```

#### pallet-evidence集成
```rust
// 证据提交时自动Pin所有CID
for img_cid in imgs.iter() {
    T::IpfsPinner::auto_pin(img_cid, &owner)?;
}
```

## 📦 存储结构

```rust
pub type IpfsRecords<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BoundedVec<u8, T::MaxCidLen>,  // CID
    IpfsRecord<T>,
>;

pub type RecordsByOwner<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<BoundedVec<u8, T::MaxCidLen>, ConstU32<1000>>,  // CID列表
>;
```

## 📡 可调用接口

### 1. pin_cid - Pin CID
```rust
#[pallet::call_index(0)]
pub fn pin_cid(origin, cid, replicas, months) -> DispatchResult
```

### 2. unpin_cid - 取消Pin
```rust
#[pallet::call_index(1)]
pub fn unpin_cid(origin, cid) -> DispatchResult
```

### 3. extend_pin - 延长Pin期限
```rust
#[pallet::call_index(2)]
pub fn extend_pin(origin, cid, additional_months) -> DispatchResult
```

## 🎉 事件

### PinRequested - Pin请求事件
```rust
PinRequested {
    cid: Vec<u8>,
    owner: T::AccountId,
    replicas: u32,
}
```

### PinConfirmed - Pin确认事件
```rust
PinConfirmed {
    cid: Vec<u8>,
    ipfs_node: Vec<u8>,
}
```

### UnpinRequested - 取消Pin请求事件
```rust
UnpinRequested {
    cid: Vec<u8>,
    owner: T::AccountId,
}
```

## 🔌 使用示例

### 场景1：逝者创建时自动Pin

```rust
// pallet-deceased内部调用
impl<T: Config> Pallet<T> {
    pub fn do_create_deceased(...) -> DispatchResult {
        // 1. 创建逝者记录
        let deceased = Deceased {
            name_full_cid: name_cid.clone(),
            main_image_cid: image_cid.clone(),
            ...
        };
        
        // 2. 自动Pin CID
        T::IpfsPinner::auto_pin_batch(
            &[&name_cid, &image_cid],
            &owner,
        ).map_err(|_| Error::<T>::IpfsPinFailed)?;
        
        // 3. 存储记录
        Deceased::<T>::insert(deceased_id, deceased);
        
        Ok(())
    }
}
```

### 场景2：手动Pin自定义内容

```rust
// 用户手动Pin
pallet_memo_ipfs::Pallet::<T>::pin_cid(
    user_origin,
    b"Qm...".to_vec(),  // CID
    3,  // 3副本
    12,  // 12个月
)?;

// 查询Pin记录
let record = pallet_memo_ipfs::IpfsRecords::<T>::get(&cid);
```

## 🛡️ 安全机制

1. **去重保护**：同一CID只Pin一次
2. **权限控制**：仅owner可取消Pin
3. **费用计算**：基于大小×副本×时长
4. **到期管理**：自动清理过期Pin

## 🔗 相关模块

- **pallet-deceased**: 逝者管理（Pin逝者CID）
- **pallet-memo-grave**: 墓地管理（Pin音频CID）
- **pallet-evidence**: 证据管理（Pin证据CID）
- **pallet-chat**: 聊天系统（Pin消息CID）

## 📚 参考资源

- [IPFS Pin机制](../../docs/ipfs-pinning-mechanism.md)
- [存储费用计算](../../docs/storage-fee-calculation.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Memopark 开发团队
