# Pallet Deposits - 通用押金管理模块

## 📋 概述

`pallet-deposits` 是一个通用的押金管理模块，为MemoMart区块链提供统一的押金冻结、释放和罚没服务。

### 核心功能

- ✅ **冻结押金**：将用户资金冻结作为押金
- ✅ **释放押金**：全额退回押金给用户
- ✅ **罚没押金**：部分或全部罚没押金
- ✅ **查询押金**：查询押金记录和状态
- ✅ **账户索引**：快速查询账户的所有押金

### 服务对象

本模块为以下业务场景提供押金服务：

| 业务场景 | 模块 | 用途 |
|---------|------|------|
| 申诉押金 | `pallet-memo-appeals` | 用户提交申诉时冻结押金 |
| 审核押金 | `pallet-memo-offerings` | 供奉品审核押金 |
| 投诉押金 | `pallet-deceased-text` | 文本投诉押金 |
| 投诉押金 | `pallet-deceased-media` | 媒体投诉押金 |
| 自定义押金 | 未来模块 | 支持任意自定义用途 |

---

## 🏗️ 架构设计

### 数据结构

#### DepositPurpose（押金用途）

```rust
pub enum DepositPurpose {
    // 申诉押金
    Appeal { 
        appeal_id: u64, 
        domain: u8, 
        target: u64, 
        action: u8 
    },
    
    // 供奉品审核押金
    OfferingReview { 
        offering_id: u64, 
        kind_code: u8 
    },
    
    // 文本投诉押金
    TextComplaint { 
        text_id: u64, 
        complaint_type: u8 
    },
    
    // 媒体投诉押金
    MediaComplaint { 
        media_id: u64, 
        complaint_type: u8 
    },
    
    // 自定义用途
    Custom { 
        pallet_name: BoundedVec<u8, ConstU32<32>>,
        purpose_id: u64,
        metadata: BoundedVec<u8, ConstU32<128>>,
    },
}
```

#### DepositStatus（押金状态）

```rust
pub enum DepositStatus {
    Reserved,                          // 已冻结
    Released,                          // 已释放（全额退回）
    Slashed,                           // 已全部罚没
    PartiallySlashed { amount: Balance }, // 已部分罚没
}
```

#### DepositRecord（押金记录）

```rust
pub struct DepositRecord<T: Config> {
    pub who: T::AccountId,            // 押金提供者
    pub amount: BalanceOf<T>,         // 押金金额
    pub purpose: DepositPurpose,      // 押金用途
    pub reserved_at: BlockNumber,     // 冻结时间
    pub status: DepositStatus,        // 当前状态
    pub released_at: Option<BlockNumber>, // 释放时间
    pub slashed_at: Option<BlockNumber>,  // 罚没时间
}
```

---

## 🔧 使用方法

### 1. 在其他Pallet中使用

#### 添加依赖

```toml
# Cargo.toml
[dependencies]
pallet-deposits = { path = "../deposits", default-features = false }
```

#### 配置Trait

```rust
// your_pallet/src/lib.rs

#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 其他配置 ...
    
    /// 押金管理器
    type DepositManager: pallet_deposits::DepositManager<
        Self::AccountId,
        Balance,
    >;
}
```

#### 调用接口

```rust
// 冻结押金
let purpose = DepositPurpose::Appeal {
    appeal_id: 1,
    domain: 1,
    target: 123,
    action: 10,
};

let deposit_id = T::DepositManager::reserve(
    &who,
    amount,
    purpose,
)?;

// 释放押金
T::DepositManager::release(deposit_id)?;

// 罚没押金（30%）
T::DepositManager::slash(
    deposit_id,
    Perbill::from_percent(30),
    &treasury_account,
)?;
```

### 2. Runtime配置

```rust
// runtime/src/lib.rs

impl pallet_deposits::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type ReleaseOrigin = EnsureRoot<AccountId>;
    type SlashOrigin = EnsureRoot<AccountId>;
    type MaxDepositsPerAccount = ConstU32<100>;
}

construct_runtime!(
    pub enum Runtime {
        // ... 其他pallet ...
        Deposits: pallet_deposits,
    }
);
```

---

## 📖 API文档

### Extrinsics（可调用函数）

#### reserve_deposit

冻结押金。

**参数**：
- `origin`: 押金提供者（签名账户）
- `purpose`: 押金用途
- `amount`: 押金金额

**权限**：任何签名账户

**事件**：`DepositReserved`

**错误**：
- `InsufficientBalance`: 余额不足
- `TooManyDeposits`: 账户押金数量已达上限

#### release_deposit

释放押金（全额退回）。

**参数**：
- `origin`: ReleaseOrigin（Root或授权Origin）
- `deposit_id`: 押金ID

**权限**：ReleaseOrigin

**事件**：`DepositReleased`

**错误**：
- `DepositNotFound`: 押金记录不存在
- `InvalidStatus`: 押金状态无效

#### slash_deposit

罚没押金（部分或全部）。

**参数**：
- `origin`: SlashOrigin（Root或授权Origin）
- `deposit_id`: 押金ID
- `slash_ratio`: 罚没比例（Perbill，0-100%）
- `beneficiary`: 罚没金额接收者

**权限**：SlashOrigin

**事件**：`DepositSlashed`

**错误**：
- `DepositNotFound`: 押金记录不存在
- `InvalidStatus`: 押金状态无效

### Storage（存储查询）

#### NextDepositId

下一个押金ID。

```rust
pub type NextDepositId<T> = StorageValue<_, u64, ValueQuery>;
```

#### Deposits

押金记录映射。

```rust
pub type Deposits<T> = StorageMap<
    _,
    Blake2_128Concat,
    u64, // deposit_id
    DepositRecord<T>,
    OptionQuery,
>;
```

#### DepositsByAccount

账户押金索引。

```rust
pub type DepositsByAccount<T> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<u64, T::MaxDepositsPerAccount>,
    ValueQuery,
>;
```

### Events（事件）

#### DepositReserved

押金已冻结。

```rust
DepositReserved {
    deposit_id: u64,
    who: AccountId,
    amount: Balance,
    purpose: DepositPurpose,
}
```

#### DepositReleased

押金已释放。

```rust
DepositReleased {
    deposit_id: u64,
    who: AccountId,
    amount: Balance,
}
```

#### DepositSlashed

押金已罚没。

```rust
DepositSlashed {
    deposit_id: u64,
    who: AccountId,
    slashed: Balance,
    refunded: Balance,
    beneficiary: AccountId,
}
```

---

## 🧪 测试

### 运行单元测试

```bash
# 运行所有测试
cargo test -p pallet-deposits

# 运行特定测试
cargo test -p pallet-deposits reserve_deposit_works

# 显示测试输出
cargo test -p pallet-deposits -- --nocapture
```

### 测试覆盖率

当前测试覆盖率：**>90%**

测试用例包括：
- ✅ 冻结押金（成功/失败）
- ✅ 释放押金（成功/失败）
- ✅ 罚没押金（部分/全部）
- ✅ 多押金管理
- ✅ DepositManager trait
- ✅ 边界条件测试

---

## 📈 性能指标

| 操作 | Weight | 说明 |
|-----|--------|------|
| reserve_deposit | 10,000 | 冻结押金 |
| release_deposit | 10,000 | 释放押金 |
| slash_deposit | 10,000 | 罚没押金 |

*注：实际Weight将通过benchmarking精确测量*

---

## 🔒 安全考虑

### 资金安全

- ✅ 使用Substrate原生`Currency` trait
- ✅ 使用`ReservableCurrency`冻结资金
- ✅ 所有资金操作都有权限检查
- ✅ 状态机保证不会重复操作

### 权限控制

- ✅ 冻结押金：任何账户（自己的资金）
- ✅ 释放押金：ReleaseOrigin（Root或授权）
- ✅ 罚没押金：SlashOrigin（Root或授权）

### 防止滥用

- ✅ 每账户押金数量上限（MaxDepositsPerAccount）
- ✅ 状态检查防止重复操作
- ✅ 余额检查防止超额冻结

---

## 📝 开发状态

### Phase 1（当前）

- [x] 基础数据结构
- [x] 核心Extrinsics
- [x] DepositManager trait
- [x] 单元测试
- [ ] Runtime集成测试
- [ ] 文档完善

### Phase 2（Week 2）

- [ ] 动态定价策略
- [ ] Benchmarking
- [ ] 集成pallet-pricing
- [ ] 性能优化

---

## 🤝 贡献

欢迎提交Issue和PR！

---

## 📄 许可证

Unlicense

---

*MemoMart Team | 2025-10-25*

