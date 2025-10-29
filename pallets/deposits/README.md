# Pallet Deposits - 通用押金管理系统

## 📋 模块概述

`pallet-deposits` 是Stardust生态的**通用押金管理模块**，提供冻结、释放和罚没押金的标准化服务。支持多种业务场景（申诉、审核、投诉等），确保资金安全和可追溯。

## 🔑 核心功能

### 1. 押金用途枚举
```rust
pub enum DepositPurpose {
    Appeal { appeal_id: u64, domain: u8, target: u64, action: u8 },
    OfferingReview { offering_id: u64, kind_code: u8 },
    TextComplaint { text_id: u64, complaint_type: u8 },
    MediaComplaint { media_id: u64, complaint_type: u8 },
    Custom { pallet_name: BoundedVec<u8, ConstU32<32>>, purpose_id: u64, metadata: BoundedVec<u8, ConstU32<128>> },
}
```

### 2. 押金状态
```rust
pub enum DepositStatus {
    Active,      // 活跃中
    Released,    // 已释放
    Slashed,     // 已罚没
}
```

### 3. 核心接口

#### reserve_deposit - 冻结押金
```rust
pub fn reserve_deposit(
    origin: OriginFor<T>,
    amount: BalanceOf<T>,
    purpose: DepositPurpose,
) -> DispatchResult
```

**功能**：
- 冻结用户资金作为押金
- 创建押金记录
- 触发DepositReserved事件

#### release_deposit - 释放押金
```rust
pub fn release_deposit(
    origin: OriginFor<T>,
    deposit_id: u64,
) -> DispatchResult
```

**功能**：
- 全额退回押金
- 状态变更：Active → Released
- 触发DepositReleased事件

#### slash_deposit - 罚没押金
```rust
pub fn slash_deposit(
    origin: OriginFor<T>,
    deposit_id: u64,
    slash_ratio: Perbill,
) -> DispatchResult
```

**功能**：
- 按比例罚没押金（0-100%）
- 罚没金额转入国库
- 剩余部分退回用户
- 状态变更：Active → Slashed

## 📦 存储结构

```rust
pub struct DepositRecord<T: Config> {
    pub id: u64,
    pub depositor: T::AccountId,
    pub amount: BalanceOf<T>,
    pub purpose: DepositPurpose,
    pub status: DepositStatus,
    pub created_at: BlockNumberFor<T>,
    pub updated_at: BlockNumberFor<T>,
}

pub type Deposits<T: Config> = StorageMap<_, Blake2_128Concat, u64, DepositRecord<T>>;
pub type DepositorIndex<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u64, ConstU32<100>>>;
```

## 📡 可调用接口

### 1. reserve_deposit - 冻结押金
```rust
#[pallet::call_index(0)]
pub fn reserve_deposit(origin, amount, purpose) -> DispatchResult
```

### 2. release_deposit - 释放押金
```rust
#[pallet::call_index(1)]
pub fn release_deposit(origin, deposit_id) -> DispatchResult
```

### 3. slash_deposit - 罚没押金
```rust
#[pallet::call_index(2)]
pub fn slash_deposit(origin, deposit_id, slash_ratio) -> DispatchResult
```

## 🎉 事件

### DepositReserved - 押金冻结事件
```rust
DepositReserved {
    deposit_id: u64,
    depositor: T::AccountId,
    amount: BalanceOf<T>,
    purpose: DepositPurpose,
}
```

### DepositReleased - 押金释放事件
```rust
DepositReleased {
    deposit_id: u64,
    depositor: T::AccountId,
    amount: BalanceOf<T>,
}
```

### DepositSlashed - 押金罚没事件
```rust
DepositSlashed {
    deposit_id: u64,
    depositor: T::AccountId,
    slashed_amount: BalanceOf<T>,
    returned_amount: BalanceOf<T>,
}
```

## 🔌 使用示例

### 场景1：申诉押金

```rust
// 1. 用户发起申诉，冻结押金
let deposit_id = pallet_deposits::Pallet::<T>::reserve_deposit(
    user_origin,
    10_000_000_000_000u128,  // 10,000 DUST
    DepositPurpose::Appeal {
        appeal_id: 1,
        domain: 1,  // grave
        target: 123,
        action: 10,  // delete
    },
)?;

// 2. 申诉成功，释放押金
pallet_deposits::Pallet::<T>::release_deposit(
    governance_origin,
    deposit_id,
)?;

// 3. 申诉失败，罚没50%押金
pallet_deposits::Pallet::<T>::slash_deposit(
    governance_origin,
    deposit_id,
    Perbill::from_percent(50),
)?;
```

## 🛡️ 安全机制

1. **货币接口**：使用ReservableCurrency确保资金安全
2. **状态机保护**：防止重复释放/罚没
3. **权限控制**：释放/罚没需要治理权限
4. **可追溯**：完整记录押金生命周期

## 🔗 相关模块

- **pallet-memo-offerings**: 供奉品审核押金
- **pallet-deceased-text**: 文本投诉押金
- **pallet-deceased-media**: 媒体投诉押金

## 📚 参考资源

- [押金管理设计](../../docs/deposit-management-design.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Stardust 开发团队
