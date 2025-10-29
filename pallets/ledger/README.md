# Pallet Ledger - 供奉账本统计系统

## 📋 模块概述

`pallet-ledger` 是Memopark生态的**供奉统计模块**，维护墓位和逝者的累计供奉次数、金额和周活跃度标记。采用精简设计，仅保留必要统计数据，供前端查询和业务分析使用。

## 🔑 核心功能

### 1. 墓位供奉统计
```rust
// 累计供奉次数
pub type TotalsByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, u64, ValueQuery>;

// 累计MEMO金额
pub type TotalMemoByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, T::Balance, ValueQuery>;
```

### 2. 逝者供奉统计
```rust
// 累计MEMO金额（不含押金）
pub type TotalMemoByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, u64, T::Balance, ValueQuery>;
```

### 3. 周活跃度标记
```rust
// (grave_id, who, week_index) → ()
pub type WeeklyActive<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    (T::GraveId, T::AccountId, u64),
    (),
    OptionQuery,
>;
```

**week_index计算**：
```rust
let week_index = block_number / T::BlocksPerWeek::get();
```

### 4. Hook接口

#### record_from_hook_with_amount - 记录供奉
```rust
pub fn record_from_hook_with_amount(
    grave_id: T::GraveId,
    who: T::AccountId,
    kind_code: u8,
    amount: Option<T::Balance>,
    memo: Option<Vec<u8>>,
    tx_key: Option<H256>,
)
```

**功能**：
- 累计供奉次数+1
- 累计MEMO金额
- 去重处理（基于tx_key）

#### mark_weekly_active_batch - 标记周活跃
```rust
pub fn mark_weekly_active_batch(
    grave_id: T::GraveId,
    who: &T::AccountId,
    start_week: u64,
    duration_weeks: u32,
) -> DispatchResult
```

**功能**：
- 批量标记连续周活跃
- 用于会员有效期管理

## 📦 存储结构

```rust
// 墓位累计次数
TotalsByGrave<T>: grave_id => u64

// 墓位累计MEMO
TotalMemoByGrave<T>: grave_id => Balance

// 逝者累计MEMO
TotalMemoByDeceased<T>: deceased_id => Balance

// 周活跃标记
WeeklyActive<T>: (grave_id, who, week_index) => ()

// 去重键
DedupKeys<T>: (grave_id, tx_key) => ()
```

## 📡 可调用接口

### 用户接口

#### 1. mark_active_weeks - 标记活跃周
```rust
#[pallet::call_index(0)]
pub fn mark_active_weeks(
    origin: OriginFor<T>,
    grave_id: T::GraveId,
    start_week: u64,
    weeks: u32,
) -> DispatchResult
```

### 管理接口

#### 2. purge_old_weeks - 清理旧周标记
```rust
#[pallet::call_index(1)]
pub fn purge_old_weeks(
    origin: OriginFor<T>,
    grave_id: T::GraveId,
    who: T::AccountId,
    before_week: u64,
    limit: u32,
) -> DispatchResult
```

**用途**：释放存储空间，清理历史标记

## 🎉 事件

### WeeklyActiveMarked - 周活跃标记事件
```rust
WeeklyActiveMarked(
    grave_id: T::GraveId,
    who: T::AccountId,
    start_week: u64,
    weeks: u32,
)
```

### GraveOfferingAccumulated - 墓位供奉累计事件
```rust
GraveOfferingAccumulated(
    grave_id: T::GraveId,
    delta: T::Balance,
    new_total: T::Balance,
)
```

### DeceasedOfferingAccumulated - 逝者供奉累计事件
```rust
DeceasedOfferingAccumulated(
    deceased_id: u64,
    delta: T::Balance,
    new_total: T::Balance,
)
```

## 🔌 使用示例

### 场景1：供奉完成后记录

```rust
// pallet-memo-offerings Hook调用
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    buyer,
    kind_code,
    Some(100_000_000_000_000u128),  // 100 MEMO
    Some(memo),
    Some(tx_hash),  // 去重键
);

// 查询累计统计
let total_count = pallet_ledger::TotalsByGrave::<T>::get(grave_id);
let total_memo = pallet_ledger::TotalMemoByGrave::<T>::get(grave_id);
```

### 场景2：会员购买后标记活跃周

```rust
// 用户购买52周会员
let current_week = current_block / T::BlocksPerWeek::get();

pallet_ledger::Pallet::<T>::mark_weekly_active_batch(
    grave_id,
    &buyer,
    current_week,
    52,  // 52周
)?;
```

## 🛡️ 安全机制

1. **去重保护**：基于tx_key防止重复计数
2. **饱和运算**：防止溢出
3. **周索引计算**：基于区块高度，防止操纵
4. **存储清理**：支持清理历史标记

## 🔗 相关模块

- **pallet-memo-offerings**: 供奉系统（调用Hook记录）
- **pallet-membership**: 会员系统（标记活跃周）
- **pallet-memo-grave**: 墓地管理（提供grave_id）

## 📚 参考资源

- [供奉统计设计](../../docs/offering-statistics-design.md)
- [周活跃度管理](../../docs/weekly-activity-management.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Memopark 开发团队
