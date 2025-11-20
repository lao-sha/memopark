# 供奉对象重构方案 A 实施指南

> **版本**: v1.0
> **日期**: 2025-11-09
> **目标**: 将供奉对象统一为 Grave（墓位），移除 Deceased 作为供奉目标的支持
> **依据**: `docs/供奉对象设计分析.md` - 方案 A（推荐方案）

---

## 📋 变更概述

### 核心变更

**当前设计（方案C - 双目标支持）**：
```rust
// 支持多种域：Grave(1), Deceased(2), Pet(3), Park(4)
target: (domain: u8, target_id: u64)

// 两套统计：
TotalsByGrave<GraveId>          // Grave 级统计
TotalMemoByGrave<GraveId>       // Grave 级统计
TotalMemoByDeceased<DeceasedId> // Deceased 级统计
```

**目标设计（方案A - 仅支持 Grave）**：
```rust
// 仅支持 Grave 域
target: (0, grave_id: u64)  // domain 固定为 0

// 单一统计：
TotalsByGrave<GraveId>     // Grave 级统计
TotalMemoByGrave<GraveId>  // Grave 级统计
```

---

## 🎯 变更目标

### 1. 简化域代码（Domain Code）

**变更前**：
```rust
// domain 代码
// 0 = 预留
// 1 = Grave（墓地）
// 2 = Deceased（逝者）
// 3 = Pet（宠物）
// 4 = Park（陵园）
// 5 = Memorial（纪念馆）
```

**变更后**：
```rust
// domain 代码（简化）
// 0 = Grave（墓地）- 主要业务
// 1 = Pet（宠物）- 未来扩展
// 2 = Park（陵园）- 未来扩展
// 3 = Memorial（纪念馆）- 未来扩展
```

**理由**：
- ✅ 移除 Deceased 作为供奉目标
- ✅ 将 Grave 域代码调整为 0（主域）
- ✅ 为未来扩展预留空间

---

### 2. 移除 Deceased 级统计

**变更前**：
```rust
// pallet-ledger
TotalMemoByDeceased<DeceasedId> // Deceased 级统计
pub fn add_to_deceased_total(deceased_id: u64, delta: Balance)
```

**变更后**：
```rust
// 完全移除 TotalMemoByDeceased 存储
// 移除 add_to_deceased_total 方法
```

**理由**：
- ✅ 不再支持 Deceased 作为供奉目标
- ✅ 减少存储成本
- ✅ 简化统计逻辑

---

### 3. 统一供奉接口

**变更前**：
```rust
// 需要用户选择 domain
offer(
    origin,
    target: (u8, u64),  // 用户需要指定 domain
    kind_code: u8,
    media: Vec<MediaItem>,
    duration: Option<u32>,
)
```

**变更后**：
```rust
// 简化为仅接受 grave_id
offer(
    origin,
    grave_id: u64,  // 直接传入墓位 ID
    kind_code: u8,
    media: Vec<MediaItem>,
    duration: Option<u32>,
)
```

**理由**：
- ✅ 用户体验简化（不需要选择域）
- ✅ 减少参数验证复杂度
- ✅ 更符合传统习俗

---

## 📦 涉及的模块

### 1. pallet-memorial（核心修改）

**文件路径**：
- `pallets/memorial/src/lib.rs`
- `pallets/memorial/src/types.rs`
- `pallets/memorial/README.md`

**变更内容**：
- 修改 `offer()` 接口签名
- 修改 `offer_by_sacrifice()` 接口签名
- 修改 `OfferingRecord` 结构
- 更新 `TargetControl` trait 验证逻辑
- 更新事件定义

---

### 2. pallet-ledger（次要修改）

**文件路径**：
- `pallets/ledger/src/lib.rs`
- `pallets/ledger/README.md`

**变更内容**：
- 移除 `TotalMemoByDeceased` 存储
- 移除 `add_to_deceased_total()` 方法
- 移除 `DeceasedOfferingAccumulated` 事件
- 简化统计逻辑

---

### 3. runtime（集成适配）

**文件路径**：
- `runtime/src/lib.rs`
- `runtime/src/configs/mod.rs`

**变更内容**：
- 更新 `TargetControl` trait 实现
- 更新 `OnOfferingCommitted` 回调逻辑
- 更新测试用例

---

### 4. 前端 DApp（适配修改）

**文件路径**：
- `stardust-dapp/src/services/tradingService.ts`
- `stardust-dapp/src/features/offerings/`
- 相关供奉页面组件

**变更内容**：
- 移除域选择逻辑
- 修改 API 调用参数
- 更新 UI 交互流程

---

## 🔧 详细代码修改方案

### Phase 1: pallet-memorial 核心修改

#### 1.1 修改类型定义（types.rs）

**文件**: `pallets/memorial/src/types.rs`

```rust
// ========================================
// 变更 1: 简化 Scene 枚举（移除 Deceased）
// ========================================

/// 场景枚举（简化版）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Scene {
    /// 墓地场景（主业务）
    Grave,      // domain = 0
    /// 宠物场景（未来扩展）
    Pet,        // domain = 1
    /// 公园场景（未来扩展）
    Park,       // domain = 2
    /// 纪念馆场景（未来扩展）
    Memorial,   // domain = 3
}

impl Scene {
    /// 将 Scene 转换为 domain 代码
    pub fn to_domain(&self) -> u8 {
        match self {
            Scene::Grave => 0,
            Scene::Pet => 1,
            Scene::Park => 2,
            Scene::Memorial => 3,
        }
    }

    /// 从 domain 代码构建 Scene
    pub fn from_domain(domain: u8) -> Option<Self> {
        match domain {
            0 => Some(Scene::Grave),
            1 => Some(Scene::Pet),
            2 => Some(Scene::Park),
            3 => Some(Scene::Memorial),
            _ => None,
        }
    }
}

// ========================================
// 变更 2: OfferingRecord 保持 target 但限制为 Grave
// ========================================

/// 供奉记录（简化版 - 仅支持 Grave）
#[derive(Encode, Decode, frame_support::CloneNoBound, frame_support::PartialEqNoBound, frame_support::EqNoBound, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OfferingRecord<T: Config> {
    pub who: T::AccountId,
    /// 供奉目标：(domain, target_id)
    /// 注意：domain 应始终为 0（Grave），其他值为历史数据或未来扩展
    pub target: (u8, u64),
    pub kind_code: u8,
    pub amount: u128,
    pub media: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering>,
    pub duration: Option<u32>,
    pub time: BlockNumberFor<T>,
}
```

**说明**：
- ✅ 移除 Deceased 场景
- ✅ 将 Grave 域代码调整为 0
- ✅ 保留 `target: (u8, u64)` 结构，便于未来扩展（Pet/Park/Memorial）
- ✅ 添加 Scene 与 domain 转换工具方法

---

#### 1.2 修改供奉接口（lib.rs）

**文件**: `pallets/memorial/src/lib.rs`

**变更 1: 修改 `offer()` 接口**

```rust
/// 函数级详细中文注释：通过供奉品规格下单（简化版 - 仅支持 Grave）
///
/// ### 参数
/// - `origin`: 供奉者签名
/// - `grave_id`: 墓位 ID（直接传入，不需要 domain）
/// - `kind_code`: 供奉品类型代码
/// - `media`: 附带媒体列表（IPFS CID）
/// - `duration_weeks`: 时长（可选，按周计）
///
/// ### 流程
/// 1. 验证暂停状态（全局 + Grave 域）
/// 2. 检查供奉品规格（是否存在、是否启用）
/// 3. 验证墓位存在性（通过 TargetControl）
/// 4. 校验时长策略（Instant 不允许时长，Timed 必须提供时长）
/// 5. 限频控制（账户级 + 墓位级）
/// 6. 计算价格（含会员折扣）
/// 7. 简化分账转账
/// 8. 创建供奉记录并索引
/// 9. 调用回调（OnOfferingCommitted）
/// 10. 发出事件（OfferingCommitted）
///
/// ### 变更说明（方案 A）
/// - ✅ 移除 `target: (u8, u64)` 参数，改为直接传入 `grave_id: u64`
/// - ✅ 内部自动构建 `target = (0, grave_id)`（domain 固定为 0）
/// - ✅ 简化用户操作，不需要选择域
#[pallet::call_index(4)]
#[pallet::weight(10_000)]
pub fn offer(
    origin: OriginFor<T>,
    grave_id: u64,  // 🔧 变更：直接传入墓位 ID，不需要 domain
    kind_code: u8,
    media: Vec<MediaItem<T>>,
    duration_weeks: Option<u32>,
) -> DispatchResult {
    let who = ensure_signed(origin.clone())?;

    // 🔧 变更：自动构建 target，domain 固定为 0（Grave）
    let target = (0u8, grave_id);

    // 1. 验证暂停状态
    ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
    ensure!(!PausedByDomain::<T>::get(0), Error::<T>::NotAllowed);  // 检查 Grave 域

    // 2. 检查供奉品规格
    let spec = Specs::<T>::get(kind_code).ok_or(Error::<T>::BadKind)?;
    ensure!(spec.enabled, Error::<T>::OfferingDisabled);

    // 3. 验证墓位存在性
    ensure!(
        T::TargetControl::exists(target),
        Error::<T>::TargetNotFound
    );
    T::TargetControl::ensure_allowed(origin.clone(), target)?;

    // 4. 校验时长策略
    match &spec.kind {
        OfferingKind::Instant => {
            ensure!(duration_weeks.is_none(), Error::<T>::DurationNotAllowed);
        }
        OfferingKind::Timed { min, max, .. } => {
            let dur = duration_weeks.ok_or(Error::<T>::DurationRequired)?;
            ensure!(dur >= *min, Error::<T>::DurationOutOfRange);
            if let Some(m) = max {
                ensure!(dur <= *m, Error::<T>::DurationOutOfRange);
            }
        }
    }

    // 5-10. 后续流程保持不变...
    // （限频、定价、转账、记录、回调、事件）

    Ok(())
}
```

**变更 2: 修改 `offer_by_sacrifice()` 接口**

```rust
/// 函数级详细中文注释：通过祭祀品目录下单（简化版 - 仅支持 Grave）
///
/// ### 参数
/// - `origin`: 供奉者签名
/// - `grave_id`: 墓位 ID（直接传入）
/// - `sacrifice_id`: 祭祀品 ID
/// - `duration_weeks`: 时长（可选，按周计）
///
/// ### 变更说明（方案 A）
/// - ✅ 移除 `target: (u8, u64)` 参数，改为直接传入 `grave_id: u64`
/// - ✅ 内部自动构建 `target = (0, grave_id)`
#[pallet::call_index(5)]
#[pallet::weight(10_000)]
pub fn offer_by_sacrifice(
    origin: OriginFor<T>,
    grave_id: u64,  // 🔧 变更：直接传入墓位 ID
    sacrifice_id: u64,
    duration_weeks: Option<u32>,
) -> DispatchResult {
    let who = ensure_signed(origin.clone())?;

    // 🔧 变更：自动构建 target，domain 固定为 0（Grave）
    let target = (0u8, grave_id);

    // 1. 验证暂停状态
    ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
    ensure!(!PausedByDomain::<T>::get(0), Error::<T>::NotAllowed);

    // 2. 验证墓位存在性
    ensure!(
        T::TargetControl::exists(target),
        Error::<T>::TargetNotFound
    );
    T::TargetControl::ensure_allowed(origin.clone(), target)?;

    // 3-10. 后续流程保持不变...

    Ok(())
}
```

**变更 3: 更新事件定义**

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 其他事件 ...

    /// 函数级中文注释：供奉已提交（简化版 - 仅支持 Grave）
    OfferingCommitted {
        id: u64,
        grave_id: u64,      // 🔧 变更：直接使用 grave_id，不使用 target
        kind_code: u8,
        who: T::AccountId,
        amount: u128,
        duration_weeks: Option<u32>,
        block: BlockNumberFor<T>,
    },

    /// 函数级中文注释：通过祭祀品目录下单完成（简化版 - 仅支持 Grave）
    OfferingCommittedBySacrifice {
        id: u64,
        grave_id: u64,      // 🔧 变更：直接使用 grave_id
        sacrifice_id: u64,
        who: T::AccountId,
        amount: u128,
        duration_weeks: Option<u32>,
        block: BlockNumberFor<T>,
    },
}
```

**说明**：
- ✅ 事件中直接使用 `grave_id`，不使用 `target: (u8, u64)`
- ✅ 简化前端事件监听逻辑

---

#### 1.3 更新 README 文档

**文件**: `pallets/memorial/README.md`

**变更内容**：

```markdown
## 核心功能

### 2. 供奉业务管理

#### 2.1 供奉目标（方案 A - 简化版）

**当前设计**：
- ✅ **仅支持 Grave（墓位）作为供奉目标**
- ✅ **domain 固定为 0**
- ✅ **未来可扩展支持 Pet/Park/Memorial**

**历史设计（已废弃）**：
- ❌ ~~支持多种域：Grave(1), Deceased(2), Pet(3), Park(4)~~
- ❌ ~~用户需要选择 domain~~

**设计理由**：
1. ✅ 符合传统习俗（供奉针对墓位，而非逝者）
2. ✅ 简化用户操作（不需要选择域）
3. ✅ 支持合葬场景（一个墓位多个逝者）
4. ✅ 技术实现简单，维护成本低

#### 2.2 供奉接口

##### offer() - 通过供奉品规格下单

**签名**（方案 A - 简化版）：
```rust
pub fn offer(
    origin: OriginFor<T>,
    grave_id: u64,  // 直接传入墓位 ID
    kind_code: u8,
    media: Vec<MediaItem<T>>,
    duration_weeks: Option<u32>,
) -> DispatchResult
```

**参数说明**：
- `grave_id`: 墓位 ID（直接传入，不需要 domain）
- `kind_code`: 供奉品类型代码
- `media`: 附带媒体列表（IPFS CID）
- `duration_weeks`: 时长（可选，按周计）

**使用示例**：
```typescript
// 前端调用（简化版）
await api.tx.memorial.offer(
  graveId,       // 直接传入墓位 ID
  kindCode,
  mediaList,
  durationWeeks
).signAndSend(account);
```

##### offer_by_sacrifice() - 通过祭祀品目录下单

**签名**（方案 A - 简化版）：
```rust
pub fn offer_by_sacrifice(
    origin: OriginFor<T>,
    grave_id: u64,  // 直接传入墓位 ID
    sacrifice_id: u64,
    duration_weeks: Option<u32>,
) -> DispatchResult
```

**使用示例**：
```typescript
// 前端调用（简化版）
await api.tx.memorial.offerBySacrifice(
  graveId,       // 直接传入墓位 ID
  sacrificeId,
  durationWeeks
).signAndSend(account);
```
```

---

### Phase 2: pallet-ledger 简化修改

#### 2.1 移除 Deceased 级统计

**文件**: `pallets/ledger/src/lib.rs`

**变更 1: 移除存储定义**

```rust
// ========================================
// 🗑️ 变更：移除 TotalMemoByDeceased 存储
// ========================================

// ❌ 删除以下代码：
/*
#[pallet::storage]
#[pallet::getter(fn total_memo_by_deceased)]
pub type TotalMemoByDeceased<T: Config> =
    StorageMap<_, Blake2_128Concat, u64, T::Balance, ValueQuery>;
*/
```

**变更 2: 移除累计方法**

```rust
// ========================================
// 🗑️ 变更：移除 add_to_deceased_total 方法
// ========================================

// ❌ 删除以下代码：
/*
pub fn add_to_deceased_total(deceased_id: u64, delta: T::Balance) {
    let new_total = TotalMemoByDeceased::<T>::mutate(deceased_id, |b| {
        *b = b.saturating_add(delta);
        *b
    });
    Self::deposit_event(Event::DeceasedOfferingAccumulated(
        deceased_id,
        delta,
        new_total,
    ));
}
*/
```

**变更 3: 移除事件**

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 其他事件 ...

    // ❌ 删除以下事件：
    /*
    DeceasedOfferingAccumulated(u64, T::Balance, T::Balance),
    */
}
```

**变更 4: 更新 README**

**文件**: `pallets/ledger/README.md`

```markdown
## 存储结构（简化版 - 方案 A）

### 核心统计存储

#### 1. TotalsByGrave - 墓位累计供奉次数

**类型**: `StorageMap<GraveId, u64>`

**说明**: 每个墓位收到的供奉总次数（累计）

#### 2. TotalMemoByGrave - 墓位累计供奉金额

**类型**: `StorageMap<GraveId, Balance>`

**说明**: 每个墓位收到的 DUST 总金额（累计）

### 已移除的存储（方案 A）

#### ~~TotalMemoByDeceased~~ （已移除）

**原因**：
- ✅ 不再支持 Deceased 作为供奉目标
- ✅ 简化统计逻辑，减少存储成本
- ✅ 如需逝者级统计，可通过 Grave 关联查询

**替代方案**：
- 前端可通过 `DeceasedByGrave` 索引，关联查询墓位的供奉记录
- 在墓位详情页聚合显示所有逝者的供奉
```

---

### Phase 3: runtime 集成适配

#### 3.1 更新 TargetControl 实现

**文件**: `runtime/src/lib.rs`

```rust
// ========================================
// 变更：简化 TargetControl 实现（仅支持 Grave）
// ========================================

impl pallet_memorial::TargetControl<RuntimeOrigin, AccountId> for Runtime {
    fn exists(target: (u8, u64)) -> bool {
        let (domain, id) = target;
        match domain {
            0 => {
                // Grave 域
                Grave::grave_of(id).is_some()
            }
            1 => {
                // Pet 域（未来扩展）
                false  // 暂不支持
            }
            2 => {
                // Park 域（未来扩展）
                false  // 暂不支持
            }
            3 => {
                // Memorial 域（未来扩展）
                false  // 暂不支持
            }
            _ => false,
        }
    }

    fn ensure_allowed(origin: RuntimeOrigin, target: (u8, u64)) -> DispatchResult {
        let who = ensure_signed(origin)?;
        let (domain, id) = target;

        match domain {
            0 => {
                // Grave 域：检查墓位是否存在且公开
                let grave = Grave::grave_of(id)
                    .ok_or(pallet_memorial::Error::<Runtime>::TargetNotFound)?;
                ensure!(grave.is_public, pallet_memorial::Error::<Runtime>::NotAllowed);
                Ok(())
            }
            _ => Err(pallet_memorial::Error::<Runtime>::TargetNotFound.into()),
        }
    }
}
```

**说明**：
- ✅ 仅处理 domain=0（Grave）
- ✅ 其他域返回 false，为未来扩展预留空间

---

#### 3.2 更新 OnOfferingCommitted 回调

**文件**: `runtime/src/lib.rs`

```rust
// ========================================
// 变更：简化 OnOfferingCommitted 回调（仅支持 Grave）
// ========================================

impl pallet_memorial::OnOfferingCommitted<AccountId> for Runtime {
    fn on_offering(
        target: (u8, u64),
        kind_code: u8,
        who: &AccountId,
        amount: u128,
        duration_weeks: Option<u32>,
    ) {
        let (domain, id) = target;

        match domain {
            0 => {
                // Grave 域：更新墓位级统计
                let grave_id: u64 = id;
                let balance = Self::u128_to_balance(amount);

                // 记录到 pallet-ledger
                Ledger::record_from_hook_with_amount(
                    grave_id,
                    Some(balance),
                    None,  // 无去重键
                );

                // 🔧 变更：不再更新 Deceased 级统计
                // ❌ 删除：Ledger::add_to_deceased_total(...)
            }
            _ => {
                // 其他域（未来扩展）
                // 暂不处理
            }
        }
    }
}
```

**说明**：
- ✅ 仅处理 Grave 域的供奉
- ✅ 不再调用 `add_to_deceased_total()`

---

### Phase 4: 前端 DApp 适配

#### 4.1 修改 API 调用

**文件**: `stardust-dapp/src/services/memorialService.ts`（新建或修改）

```typescript
/**
 * Memorial 服务（方案 A - 简化版）
 */
import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { ISubmittableResult } from '@polkadot/types/types';

export interface MediaItem {
  cid: string;
}

export interface OfferParams {
  graveId: number;        // 🔧 变更：直接传入墓位 ID
  kindCode: number;
  media: MediaItem[];
  durationWeeks?: number;
}

export interface OfferBySacrificeParams {
  graveId: number;        // 🔧 变更：直接传入墓位 ID
  sacrificeId: number;
  durationWeeks?: number;
}

/**
 * 通过供奉品规格下单（方案 A - 简化版）
 */
export function createOfferTx(
  api: ApiPromise,
  params: OfferParams
): SubmittableExtrinsic<'promise', ISubmittableResult> {
  return api.tx.memorial.offer(
    params.graveId,       // 🔧 变更：直接传入墓位 ID，不需要 domain
    params.kindCode,
    params.media,
    params.durationWeeks || null
  );
}

/**
 * 通过祭祀品目录下单（方案 A - 简化版）
 */
export function createOfferBySacrificeTx(
  api: ApiPromise,
  params: OfferBySacrificeParams
): SubmittableExtrinsic<'promise', ISubmittableResult> {
  return api.tx.memorial.offerBySacrifice(
    params.graveId,       // 🔧 变更：直接传入墓位 ID
    params.sacrificeId,
    params.durationWeeks || null
  );
}
```

**说明**：
- ✅ 移除 `target: (domain, id)` 参数
- ✅ 直接传入 `graveId`
- ✅ 简化前端调用逻辑

---

#### 4.2 修改供奉页面组件

**示例页面**: `stardust-dapp/src/features/offerings/OfferingPage.tsx`

```typescript
import React, { useState } from 'react';
import { Button, message } from 'antd';
import { usePolkadotApi } from '@/hooks/usePolkadotApi';
import { createOfferBySacrificeTx } from '@/services/memorialService';

interface OfferingPageProps {
  graveId: number;  // 🔧 变更：从父组件传入墓位 ID
}

export const OfferingPage: React.FC<OfferingPageProps> = ({ graveId }) => {
  const { api, account } = usePolkadotApi();
  const [loading, setLoading] = useState(false);

  // 🔧 变更：不再需要域选择逻辑
  // ❌ 删除：const [selectedDomain, setSelectedDomain] = useState(0);

  const handleOffer = async (sacrificeId: number) => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);

      // 🔧 变更：直接使用 graveId，不需要构建 target
      const tx = createOfferBySacrificeTx(api, {
        graveId,        // 直接传入墓位 ID
        sacrificeId,
        durationWeeks: undefined,
      });

      await tx.signAndSend(account, ({ status, events }) => {
        if (status.isInBlock) {
          message.success('供奉成功！');
          setLoading(false);
        }
      });
    } catch (error) {
      console.error('供奉失败:', error);
      message.error('供奉失败');
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 🔧 变更：移除域选择 UI */}
      {/* ❌ 删除：<DomainSelector /> */}

      <h2>为墓位 #{graveId} 供奉</h2>
      <Button onClick={() => handleOffer(1)} loading={loading}>
        点灯（祈福蜡烛）
      </Button>
      <Button onClick={() => handleOffer(2)} loading={loading}>
        献花（菊花）
      </Button>
    </div>
  );
};
```

**说明**：
- ✅ 移除域选择逻辑
- ✅ 直接使用 `graveId`
- ✅ 简化用户操作

---

#### 4.3 更新墓位详情页

**文件**: `stardust-dapp/src/features/grave/GraveDetailPage.tsx`

```typescript
import React from 'react';
import { useParams } from 'react-router-dom';
import { OfferingPage } from '@/features/offerings/OfferingPage';

export const GraveDetailPage: React.FC = () => {
  const { graveId } = useParams<{ graveId: string }>();

  return (
    <div>
      <h1>墓位详情 #{graveId}</h1>

      {/* 🔧 变更：直接传入墓位 ID */}
      <OfferingPage graveId={parseInt(graveId)} />
    </div>
  );
};
```

---

## 🧪 测试验证清单

### 1. 链端测试

#### 1.1 pallet-memorial 单元测试

```bash
cargo test -p pallet-memorial
```

**测试用例**：
- ✅ `test_offer_to_grave()` - 测试供奉到墓位
- ✅ `test_offer_by_sacrifice()` - 测试通过祭祀品供奉
- ✅ `test_invalid_domain()` - 测试无效域（应失败）
- ✅ `test_grave_statistics()` - 测试墓位统计更新

#### 1.2 pallet-ledger 单元测试

```bash
cargo test -p pallet-ledger
```

**测试用例**：
- ✅ `test_grave_totals()` - 测试墓位累计统计
- ✅ `test_no_deceased_totals()` - 验证 Deceased 统计已移除

---

### 2. 集成测试

#### 2.1 Runtime 编译测试

```bash
cargo build --release
```

**验证点**：
- ✅ Runtime 编译成功
- ✅ 无编译警告
- ✅ 权重计算正确

#### 2.2 链上功能测试

**测试步骤**：
1. 启动本地节点：`./target/release/solochain-template-node --dev`
2. 连接 Polkadot-JS Apps：`https://polkadot.js.org/apps`
3. 测试供奉功能：
   - ✅ 创建墓位
   - ✅ 创建祭祀品
   - ✅ 通过 `memorial.offer()` 供奉
   - ✅ 通过 `memorial.offerBySacrifice()` 供奉
   - ✅ 验证墓位统计更新

---

### 3. 前端测试

#### 3.1 DApp 编译测试

```bash
cd stardust-dapp
npm run build
```

**验证点**：
- ✅ 编译成功
- ✅ 无 TypeScript 错误
- ✅ API 调用正确

#### 3.2 用户流程测试

**测试步骤**：
1. 启动前端：`npm run dev`
2. 连接钱包
3. 访问墓位详情页
4. 测试供奉功能：
   - ✅ 点灯（祈福蜡烛）
   - ✅ 献花（菊花）
   - ✅ 验证供奉记录显示
   - ✅ 验证墓位统计更新

---

## 📅 实施计划

### Week 1: 链端修改（3天）

**Day 1**: pallet-memorial 核心修改
- [ ] 修改 `types.rs`（Scene 枚举、OfferingRecord）
- [ ] 修改 `offer()` 接口
- [ ] 修改 `offer_by_sacrifice()` 接口
- [ ] 更新事件定义

**Day 2**: pallet-ledger 简化修改
- [ ] 移除 `TotalMemoByDeceased` 存储
- [ ] 移除 `add_to_deceased_total()` 方法
- [ ] 移除 `DeceasedOfferingAccumulated` 事件
- [ ] 更新 README

**Day 3**: runtime 集成适配
- [ ] 更新 `TargetControl` 实现
- [ ] 更新 `OnOfferingCommitted` 回调
- [ ] 编译测试
- [ ] 单元测试

---

### Week 2: 前端适配（2天）

**Day 4**: API 服务层修改
- [ ] 创建 `memorialService.ts`
- [ ] 修改 `createOfferTx()` 函数
- [ ] 修改 `createOfferBySacrificeTx()` 函数
- [ ] 类型定义更新

**Day 5**: UI 组件修改
- [ ] 修改 `OfferingPage.tsx`
- [ ] 移除域选择逻辑
- [ ] 更新墓位详情页
- [ ] 编译测试

---

### Week 3: 测试与优化（2天）

**Day 6**: 集成测试
- [ ] 启动本地节点
- [ ] 测试供奉功能
- [ ] 验证统计更新
- [ ] 修复问题

**Day 7**: 文档与交付
- [ ] 更新 README 文档
- [ ] 编写用户指南
- [ ] 代码审查
- [ ] 合并到主分支

---

## 🔄 数据迁移策略

### 历史数据处理

**问题**：现有链上可能存在 `domain=2`（Deceased）的供奉记录

**解决方案**：

#### 方案 1: 保留历史数据（推荐）

```rust
// 在 OfferingRecord 中添加说明：
// target: (domain, target_id)
// 注意：domain 应始终为 0（Grave），其他值为历史数据或未来扩展
```

**优势**：
- ✅ 不破坏历史数据
- ✅ 不需要数据迁移
- ✅ 保持链上数据不可篡改

**劣势**：
- ⚠️ 需要前端兼容处理历史数据

---

#### 方案 2: 数据迁移（可选）

**如果必须清理历史数据**，可以通过治理提案执行：

```rust
// 迁移逻辑（伪代码）
for (id, record) in OfferingRecords::<T>::iter() {
    let (domain, target_id) = record.target;
    if domain == 2 {
        // Deceased 域
        // 查找 Deceased 对应的 Grave
        if let Some(grave_id) = get_grave_of_deceased(target_id) {
            // 更新 target 为 Grave
            record.target = (0, grave_id);
            OfferingRecords::<T>::insert(id, record);
        } else {
            // 无法找到对应 Grave，保留原数据
        }
    }
}
```

**注意**：
- ⚠️ 数据迁移需要治理提案
- ⚠️ 需要充分测试
- ⚠️ 建议在测试网先验证

---

## 📊 成本效益分析

### 存储成本节省

**变更前**（方案 C）：
```
TotalsByGrave:         N * 16 bytes
TotalMemoByGrave:      N * 16 bytes
TotalMemoByDeceased:   M * 16 bytes  // 🗑️ 将被移除
OfferingRecords:       K * 200 bytes
OfferingsByTarget:     (N+M) * 32 bytes  // 🔧 将简化为 N
```

**变更后**（方案 A）：
```
TotalsByGrave:         N * 16 bytes
TotalMemoByGrave:      N * 16 bytes
OfferingRecords:       K * 200 bytes
OfferingsByTarget:     N * 32 bytes  // 仅 Grave 域
```

**节省估算**（假设 N=1000 墓位，M=5000 逝者）：
```
存储节省 = M * 16 + M * 32
        = 5000 * 48
        = 240,000 bytes
        ≈ 234 KB
```

---

### 性能提升

**查询性能**：
- ✅ 减少索引查询（不需要 Deceased 级查询）
- ✅ 简化事件监听（仅监听 Grave 域）
- ✅ 降低链上计算复杂度

**事务成本**：
- ✅ 减少存储写入（不需要更新 `TotalMemoByDeceased`）
- ✅ 降低 Gas 费用

---

## 🚀 后续扩展计划

### Phase 4: 支持 Pet 域（可选）

**时间**: 3-6个月后

**实现方式**：
```rust
// 扩展 TargetControl 支持 Pet 域
match domain {
    0 => { /* Grave 逻辑 */ }
    1 => {
        // Pet 域
        Pet::pet_of(id).is_some()
    }
    _ => false,
}
```

**优势**：
- ✅ 基于方案 A 的架构可以轻松扩展
- ✅ 不影响现有 Grave 业务

---

### Phase 5: 支持 Park/Memorial 域（可选）

**时间**: 6-12个月后

**实现方式**：类似 Pet 域，扩展 `TargetControl`

---

## 📝 总结

### 方案 A 的优势

1. ✅ **符合传统习俗**：供奉针对墓位，而非逝者
2. ✅ **技术实现简单**：单一统计维度，代码清晰
3. ✅ **用户体验简化**：不需要选择域，操作流畅
4. ✅ **存储成本低**：减少冗余统计，节省链上资源
5. ✅ **易于维护**：代码逻辑简单，维护成本低
6. ✅ **支持合葬场景**：天然支持一个墓位多个逝者
7. ✅ **可扩展性好**：为未来扩展 Pet/Park/Memorial 预留空间

---

### 实施建议

1. **优先级**: P0（高优先级）
2. **实施周期**: 7天
3. **风险等级**: 低（变更清晰，影响范围可控）
4. **回滚策略**: 保留历史数据，可随时回滚

---

## 📚 相关文档

- `docs/供奉对象设计分析.md` - 方案对比分析
- `docs/Grave与Deceased功能整合设计.md` - 整体架构设计
- `pallets/memorial/README.md` - Memorial Pallet 文档
- `pallets/ledger/README.md` - Ledger Pallet 文档

---

**维护者**: Stardust Team
**最后更新**: 2025-11-09
**审核状态**: ✅ 待审核
