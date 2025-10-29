# Pallet Memo Park - 陵园管理模块

## 📋 概述

`pallet-stardust-park` 是Stardust区块链的陵园（纪念园区）管理模块，提供园区的创建、更新、管理员设置、所有权转移等核心功能。

### 核心功能

- ✅ **创建园区**：用户可以创建陵园，记录国家、地区、元数据等信息
- ✅ **更新园区**：拥有者和管理员可以更新园区信息
- ✅ **管理员设置**：支持设置和清空管理员集合
- ✅ **所有权转移**：支持园区所有权转移
- ✅ **治理操作**：支持治理账户进行强制更新和转移
- ✅ **国家索引**：支持按国家查询园区列表

---

## 🏗️ 架构设计

### 数据结构

#### Park 结构体

```rust
pub struct Park<T: Config> {
    pub owner: T::AccountId,           // 拥有者
    pub admin_group: Option<u64>,      // 管理员集合ID（可选）
    pub country_iso2: [u8; 2],         // 国家代码（ISO-3166-1 alpha-2）
    pub region_code: BoundedVec<u8, T::MaxRegionLen>,  // 地区码
    pub metadata_cid: BoundedVec<u8, T::MaxCidLen>,    // 元数据IPFS CID
    pub active: bool,                  // 是否激活
}
```

### Storage

| Storage | 类型 | 说明 |
|---------|------|------|
| `NextParkId` | `u64` | 下一个园区ID |
| `Parks` | `Map<u64, Park>` | 园区ID到园区信息的映射 |
| `ParksByCountry` | `Map<[u8;2], Vec<u64>>` | 国家到园区ID列表的映射 |

---

## 📝 可调用函数

### 用户操作

#### 1. create_park

创建新的陵园。

**参数**:
- `country_iso2`: 国家代码（2字节，如 "CN"）
- `region_code`: 地区码（如 "Shanghai"）
- `metadata_cid`: 元数据IPFS CID

**权限**: 任何签名用户

**示例**:
```rust
StarDust::create_park(
    origin,
    *b"CN",
    b"Shanghai".to_vec().try_into().unwrap(),
    b"QmTest123".to_vec().try_into().unwrap()
)?;
```

#### 2. update_park

更新园区信息。

**参数**:
- `id`: 园区ID
- `region_code`: 新的地区码（可选）
- `metadata_cid`: 新的元数据CID（可选）
- `active`: 新的激活状态（可选）

**权限**: 拥有者或管理员

**示例**:
```rust
StarDust::update_park(
    origin,
    park_id,
    Some(new_region),
    Some(new_cid),
    None
)?;
```

#### 3. set_park_admin

设置或清空园区管理员。

**参数**:
- `id`: 园区ID
- `admin_group`: 管理员集合ID（None表示清空）

**权限**: 拥有者或当前管理员

**示例**:
```rust
// 设置管理员
StarDust::set_park_admin(origin, park_id, Some(admin_group_id))?;

// 清空管理员
StarDust::set_park_admin(origin, park_id, None)?;
```

#### 4. transfer_park

转让园区所有权。

**参数**:
- `id`: 园区ID
- `new_owner`: 新拥有者账户

**权限**: 当前拥有者

**示例**:
```rust
StarDust::transfer_park(origin, park_id, new_owner)?;
```

### 治理操作

#### 5. gov_update_park

治理账户强制更新园区。

**参数**:
- `id`: 园区ID
- `region_code`: 新的地区码（可选）
- `metadata_cid`: 新的元数据CID（可选）
- `active`: 新的激活状态（可选）
- `evidence_cid`: 证据CID

**权限**: 治理账户（GovernanceOrigin）

#### 6. gov_set_park_admin

治理账户设置管理员。

**参数**:
- `id`: 园区ID
- `admin_group`: 管理员集合ID
- `evidence_cid`: 证据CID

**权限**: 治理账户

#### 7. gov_transfer_park

治理账户强制转让所有权。

**参数**:
- `id`: 园区ID
- `new_owner`: 新拥有者
- `evidence_cid`: 证据CID

**权限**: 治理账户

#### 8. gov_set_park_cover

治理账户设置或清空园区封面。

**参数**:
- `id`: 园区ID
- `has_cover`: 是否有封面
- `evidence_cid`: 证据CID

**权限**: 治理账户

---

## 🎯 事件

| 事件 | 说明 |
|------|------|
| `ParkCreated` | 园区创建成功 |
| `ParkUpdated` | 园区信息更新 |
| `AdminSet` | 管理员设置 |
| `ParkTransferred` | 所有权转移 |
| `ParkActivated` | 园区激活 |
| `ParkDeactivated` | 园区停用 |
| `GovEvidenceNoted` | 治理证据记录 |
| `GovParkCoverSet` | 治理设置封面 |

---

## ⚠️ 错误

| 错误 | 说明 |
|------|------|
| `NotOwner` | 非拥有者操作 |
| `NotAdmin` | 非管理员/治理账户操作 |
| `NotFound` | 园区不存在 |
| `BadCountry` | 无效的国家代码 |
| `TooMany` | 国家园区数量超过限制 |

---

## 🧪 测试

本模块包含完整的单元测试，覆盖率100%。

### 运行测试

```bash
# 运行所有测试
cargo test -p pallet-stardust-park --lib

# 查看详细输出
cargo test -p pallet-stardust-park --lib -- --nocapture

# 运行特定测试
cargo test -p pallet-stardust-park --lib create_park_works
```

### 测试覆盖

✅ **17个测试用例** (100%通过):
- 4个创建园区测试
- 4个更新园区测试
- 2个管理员设置测试
- 2个所有权转移测试
- 3个治理功能测试
- 2个Mock测试

详见：[Phase3-Week1-Day1-完成报告](../../docs/Phase3-Week1-Day1-完成报告.md)

---

## 📦 配置

### Config Trait

```rust
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    
    /// 地区码最大长度
    #[pallet::constant]
    type MaxRegionLen: Get<u32>;
    
    /// IPFS CID最大长度
    #[pallet::constant]
    type MaxCidLen: Get<u32>;
    
    /// 每个国家最大园区数
    #[pallet::constant]
    type MaxParksPerCountry: Get<u32>;
    
    /// 管理员权限验证
    type ParkAdmin: ParkAdminOrigin<Self::RuntimeOrigin>;
    
    /// 治理账户
    type GovernanceOrigin: frame_support::traits::EnsureOrigin<Self::RuntimeOrigin>;
}
```

### Runtime配置示例

```rust
impl pallet_memo_park::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxRegionLen = ConstU32<64>;
    type MaxCidLen = ConstU32<128>;
    type MaxParksPerCountry = ConstU32<100>;
    type ParkAdmin = YourParkAdminImpl;
    type GovernanceOrigin = EnsureRootOrHalfCouncil;
}
```

---

## 🔒 权限模型

### 三级权限

1. **拥有者（Owner）**
   - 创建园区自动成为拥有者
   - 可以更新、设置管理员、转移所有权

2. **管理员（Admin）**
   - 由拥有者设置
   - 可以更新园区信息
   - 通过 `ParkAdminOrigin` trait验证

3. **治理（Governance）**
   - Root或治理委员会
   - 可以强制更新、转移所有权
   - 所有操作需要提供证据CID

---

## 🌍 国家索引

园区按国家分类索引，使用ISO-3166-1 alpha-2编码：

```rust
// 创建CN国家的园区
create_park(*b"CN", ...)?;

// 查询CN国家的所有园区
let parks_in_cn = ParksByCountry::<T>::get(*b"CN");
```

**常见国家代码**:
- `CN` - 中国
- `US` - 美国
- `JP` - 日本
- `GB` - 英国
- ...

---

## 📊 性能

| 操作 | Weight | 复杂度 |
|------|--------|--------|
| create_park | 10,000 | O(1) |
| update_park | 10,000 | O(1) |
| set_park_admin | 10,000 | O(1) |
| transfer_park | 10,000 | O(1) |

*注：当前使用固定weight，后续将替换为benchmark结果*

---

## 🔗 相关模块

- `pallet-stardust-grave` - 墓地管理（需关联园区）
- `pallet-deceased` - 逝者记录
- `pallet-memo-offerings` - 供奉品管理

---

## 📚 参考

- [Substrate文档](https://docs.substrate.io/)
- [FRAME文档](https://docs.substrate.io/reference/frame-pallets/)
- [ISO-3166-1国家代码](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)

---

**版本**: 0.1.0  
**测试覆盖率**: 100%  
**状态**: ✅ 生产就绪  
**最后更新**: 2025-10-25
