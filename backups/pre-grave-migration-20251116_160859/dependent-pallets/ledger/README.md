# Pallet Ledger（供奉账本模块）

## 📋 模块概述

`pallet-ledger` 是 Stardust 区块链的 **供奉账本与活跃度统计模块**，负责记录墓位的供奉统计数据，包括累计次数、累计金额、周活跃标记、去重机制等。本模块是精简版设计，不存储明细、排行榜和分类型统计，专注于核心业务需求，大幅降低存储成本和复杂度。

### 核心特性

- ✅ **最小必要存储**：仅累计次数、累计金额、周活跃标记
- ✅ **去重机制**：通过 tx_key 防止同一供奉被重复累计（幂等性）
- ✅ **周粒度统计**：按周为单位标记有效供奉，用于联盟营销计酬判定
- ✅ **墓位级累计**：墓位维度的供奉次数和金额统计
- ✅ **历史数据清理**：用户可手动清理历史周活跃标记，控制存储规模
- ✅ **无冗余功能**：移除了 60% 的旧版功能（明细、排行榜、分类型统计），聚焦核心业务
- ✅ **破坏式变更**：已移除 Deceased 维度统计（方案A），仅保留 Grave 维度

---

## 🔑 核心功能

### 1. 供奉记录（Hook 内部调用）

#### 1.1 record_from_hook_with_amount（供奉记录-带金额）

**调用方**：pallet-memo-offerings Hook（内部调用）

**功能**：记录供奉事件，累计次数和金额。

**实现流程**：
1. **去重检查**：若提供了去重键（tx_key），判断是否已处理
   - 若 `DedupKeys[(grave_id, tx_key)]` 已存在，直接返回（幂等）
   - 否则，写入 `DedupKeys[(grave_id, tx_key)] = ()`
2. **累加次数**：`TotalsByGrave[grave_id] += 1`
3. **累加金额**：若提供了 amount，`TotalMemoByGrave[grave_id] += amount`
4. **触发事件**：`GraveOfferingAccumulated(grave_id, delta, new_total)`

**参数说明**：
- `grave_id: T::GraveId` - 墓位 ID
- `who: T::AccountId` - 供奉者账户（不存储，仅用于兼容旧接口）
- `kind_code: u8` - 供奉品类型代码（不存储，仅用于兼容旧接口）
- `amount: Option<T::Balance>` - 供奉金额（可选，None 表示无金额变动）
- `memo: Option<Vec<u8>>` - 备注信息（不存储，仅用于兼容旧接口）
- `tx_key: Option<H256>` - 去重键（可选，如事件哈希或外部 tx id 的 blake2）

**去重键设计示例**：
```rust
use sp_core::H256;
use sp_io::hashing::blake2_256;
use codec::Encode;

// 构造去重键（基于事件哈希或外部 tx id）
let tx_key = H256::from(blake2_256(&[
    grave_id.encode(),
    who.encode(),
    kind_code.encode(),
    amount.encode(),
    memo.encode(),
].concat()));

// 调用记录方法
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    who,
    kind_code,
    Some(amount),
    memo,
    Some(tx_key),
);
```

**使用场景**：
- pallet-memo-offerings 的供奉 Hook 调用
- 防止同一供奉事件被重复累计（如区块重组、Hook 重试等场景）

#### 1.2 record_from_hook（供奉记录-无金额）

**调用方**：pallet-memo-offerings Hook（内部调用）

**功能**：兼容旧接口，无金额记录（仅累计次数）。

**实现流程**：
1. 直接调用 `record_from_hook_with_amount(grave_id, who, kind_code, None, memo, None)`

**参数说明**：
- `grave_id: T::GraveId` - 墓位 ID
- `who: T::AccountId` - 供奉者账户
- `kind_code: u8` - 供奉品类型代码
- `memo: Option<Vec<u8>>` - 备注信息

**使用场景**：
- 无金额转账的供奉事件（如免费供奉品、仅记录行为等）

---

### 2. 周活跃标记

#### 2.1 mark_weekly_active（标记周活跃）

**调用方**：pallet-memo-offerings Hook（内部调用）

**功能**：按"周"为粒度，标记有效供奉周期。这是联盟营销计酬的核心依据。

**实现流程**：
1. **计算起始周索引**：
   ```rust
   let bpw = T::BlocksPerWeek::get() as u128;
   let start_bn: u128 = start_block.saturated_into::<u128>();
   let start_week: u64 = (start_bn / bpw) as u64;
   ```
2. **循环标记连续周**：
   ```rust
   let weeks: u32 = duration_weeks.unwrap_or(1);
   for i in 0..weeks {
       let week_idx = start_week.saturating_add(i as u64);
       WeeklyActive::<T>::insert((grave_id, who.clone(), week_idx), ());
   }
   ```
3. **触发事件**：`WeeklyActiveMarked(grave_id, who, start_week, weeks)`

**参数说明**：
- `grave_id: T::GraveId` - 墓位 ID
- `who: T::AccountId` - 供奉者账户
- `start_block: BlockNumberFor<T>` - 供奉发生时的区块号
- `duration_weeks: Option<u32>` - 若为 Timed 供奉则为 Some(w)，否则 None（Instant 仅标记当周）

**周索引计算公式**：
```
week_index = floor(block_number / BlocksPerWeek)
```

**使用场景**：
- pallet-memo-affiliate 判断用户在某周是否有有效供奉（计酬资格判定）
- 统计"连续供奉天数"等指标
- 前端展示"供奉日历"

**重要说明**：
- **只做标记，不做资金变动**（纯统计性质）
- **不验证墓位或账户是否存在**（由调用方负责）
- **周活跃是联盟营销计酬的核心依据**（15 级压缩机制需查询此标记）

#### 2.2 is_week_active（查询指定周是否活跃）

**调用方**：其他 pallet（只读查询）

**功能**：查询某账户在某墓位的指定周是否存在有效供奉。

**实现**：
```rust
pub fn is_week_active(grave_id: T::GraveId, who: &T::AccountId, week_index: u64) -> bool {
    WeeklyActive::<T>::contains_key((grave_id, who.clone(), week_index))
}
```

**返回值**：
- `true`：存在有效供奉
- `false`：不存在有效供奉

**使用场景**：
- pallet-memo-affiliate 判断某账户在某周是否有资格参与计酬

#### 2.3 is_current_week_active（查询当前周是否活跃）

**调用方**：其他 pallet（只读查询）

**功能**：查询某账户在某墓位的"当前周"是否存在有效供奉。

**实现**：
```rust
pub fn is_current_week_active(grave_id: T::GraveId, who: &T::AccountId) -> bool {
    let now = <frame_system::Pallet<T>>::block_number();
    let bpw = T::BlocksPerWeek::get() as u128;
    let week_idx = (now.saturated_into::<u128>() / bpw) as u64;
    Self::is_week_active(grave_id, who, week_idx)
}
```

**返回值**：
- `true`：当前周存在有效供奉
- `false`：当前周不存在有效供奉

**使用场景**：
- 实时判断用户当前周是否有活跃供奉行为

#### 2.4 week_index_of_block（计算区块对应的周索引）

**调用方**：其他 pallet（只读查询）

**功能**：计算某区块号对应的周索引。

**实现**：
```rust
pub fn week_index_of_block(block: BlockNumberFor<T>) -> u64 {
    let bpw = T::BlocksPerWeek::get() as u128;
    (block.saturated_into::<u128>() / bpw) as u64
}
```

**使用场景**：
- 将区块号转换为周索引，便于跨模块统一计算

#### 2.5 current_week_index（获取当前周索引）

**调用方**：其他 pallet / 前端（只读查询）

**功能**：获取当前周索引。

**实现**：
```rust
pub fn current_week_index() -> u64 {
    let now = <frame_system::Pallet<T>>::block_number();
    Self::week_index_of_block(now)
}
```

**使用场景**：
- 前端展示"第 N 周"
- 其他模块判断当前周索引

#### 2.6 weeks_active_bitmap（批量查询周活跃情况）

**调用方**：其他 pallet / 前端（只读查询）

**功能**：按位图返回从 `start_week` 起连续 `len` 周的活跃情况（bit=1 表示活跃）。

**实现**：
```rust
pub fn weeks_active_bitmap(
    grave_id: T::GraveId,
    who: &T::AccountId,
    start_week: u64,
    len: u32,
) -> Vec<u8> {
    let mut out: Vec<u8> = Vec::new();
    // 防御性裁剪：最多返回 256 位（32 字节）
    let cap: u32 = core::cmp::min(len, 256);
    let mut byte: u8 = 0;
    let mut bit_idx: u32 = 0;
    for i in 0..cap {
        let week = start_week.saturating_add(i as u64);
        let active = WeeklyActive::<T>::contains_key((grave_id, who.clone(), week));
        if active {
            byte |= 1 << (bit_idx % 8);
        }
        bit_idx += 1;
        if bit_idx % 8 == 0 {
            out.push(byte);
            byte = 0;
        }
    }
    if bit_idx % 8 != 0 {
        out.push(byte);
    }
    out
}
```

**返回格式**：`Vec<u8>`，低位在前；位序为 [start_week + 0, start_week + 1, ...]；bit=1 表示活跃

**使用场景**：
- 前端展示"供奉日历"（如热力图）
- 批量判断连续供奉情况

**限制**：最多返回 256 位（32 字节），避免链上过大内存开销

---

### 3. 历史数据清理（用户自助清理）

#### 3.1 purge_weeks（清理历史周标记）

**调用方**：账户本人（Extrinsic）

**功能**：清理某账户在某墓位的历史周活跃标记（`week < before_week`），控制存储规模。

**实现流程**：
1. **验证调用者**：`ensure!(caller == who, DispatchError::BadOrigin)`
2. **迭代查找**：遍历 `WeeklyActive` 找到符合条件的键
3. **批量移除**：移除最多 `limit` 条记录
4. **触发事件**：`WeeksPurged(grave_id, who, before_week, removed)`

**参数说明**：
- `origin: OriginFor<T>` - 交易发起者（必须是账户本人）
- `grave_id: T::GraveId` - 墓位 ID
- `who: T::AccountId` - 账户地址（必须与 origin 一致）
- `before_week: u64` - 清理此周之前的所有记录（不含 before_week）
- `limit: u32` - 最多清理记录数（防止单次交易权重过大）

**使用场景**：
- 用户长期使用后，清理 100 周前的历史数据
- 控制 `WeeklyActive` 存储规模，便于长期运行

**重要说明**：
- **清理仅影响只读统计，不影响任何资金或权益**
- **仅允许账户本人调用**（防止恶意清理他人数据）
- **需要分批清理**（每次最多 `limit` 条，避免单次交易权重过大）

**Rust 调用示例**：
```rust
// 清理 100 周前的历史数据，每次最多 50 条
pallet_ledger::Pallet::<T>::purge_weeks(
    origin,
    grave_id,
    who,
    current_week - 100,
    50,
)?;
```

#### 3.2 purge_weeks_by_range（按区间批量清理）

**调用方**：账户本人（Extrinsic）

**功能**：清理某账户在某墓位的指定区间周活跃标记（`start_week <= week < end_week`）。

**实现流程**：
1. **验证调用者**：`ensure!(caller == who, DispatchError::BadOrigin)`
2. **迭代查找**：遍历 `WeeklyActive` 找到符合条件的键
3. **批量移除**：移除最多 `limit` 条记录
4. **触发事件**：`WeeksPurged(grave_id, who, end_week, removed)`

**参数说明**：
- `origin: OriginFor<T>` - 交易发起者（必须是账户本人）
- `grave_id: T::GraveId` - 墓位 ID
- `who: T::AccountId` - 账户地址（必须与 origin 一致）
- `start_week: u64` - 起始周索引（含）
- `end_week: u64` - 结束周索引（不含）
- `limit: u32` - 最多清理记录数（防止单次交易权重过大）

**使用场景**：
- TTL 压缩：周期性清理固定范围的历史周数据
- 精确清理：删除特定时间段的记录

**Rust 调用示例**：
```rust
// 清理第 10-20 周的数据，每次最多 20 条
pallet_ledger::Pallet::<T>::purge_weeks_by_range(
    origin,
    grave_id,
    who,
    10,
    20,
    20,
)?;
```

---

## 📊 数据结构

### 存储项

#### 1. TotalsByGrave（墓位累计供奉次数）

```rust
pub type TotalsByGrave<T: Config> =
    StorageMap<_, Blake2_128Concat, T::GraveId, u64, ValueQuery>;
```

**说明**：
- 键：墓位 ID
- 值：累计供奉次数（从 0 开始累加）
- 默认值：0（ValueQuery）

**用途**：
- 前端展示墓位总供奉次数
- 统计墓位活跃度

#### 2. TotalMemoByGrave（墓位累计 DUST 金额）

```rust
pub type TotalMemoByGrave<T: Config> =
    StorageMap<_, Blake2_128Concat, T::GraveId, T::Balance, ValueQuery>;
```

**说明**：
- 键：墓位 ID
- 值：累计 DUST 金额（从 0 开始累加）
- 默认值：0（ValueQuery）

**用途**：
- 前端展示墓位累计收到的供奉金额
- 统计墓位价值

#### 3. DedupKeys（去重键集合）

```rust
pub type DedupKeys<T: Config> =
    StorageMap<_, Blake2_128Concat, (T::GraveId, H256), (), OptionQuery>;
```

**说明**：
- 键：(墓位 ID, 去重键)
- 值：()（仅标记存在性）
- 默认值：None（OptionQuery）

**用途**：
- 防止同一供奉事件被重复累计（幂等性）
- 仅当 Hook 传入 tx_key 时写入

**去重键设计原则**：
- 使用 H256（32 字节哈希）作为去重键
- 通常为事件哈希或外部 tx id 的 blake2
- 保证同一事件多次调用 Hook 只累计一次

#### 4. WeeklyActive（周活跃标记）

```rust
pub type WeeklyActive<T: Config> =
    StorageMap<_, Blake2_128Concat, (T::GraveId, T::AccountId, u64), (), OptionQuery>;
```

**说明**：
- 键：(墓位 ID, 账户地址, 周索引)
- 值：()（仅标记存在性）
- 默认值：None（OptionQuery）
- 周索引计算公式：`floor(block_number / BlocksPerWeek)`

**用途**：
- 联盟营销计酬判定（15 级压缩需查询此标记）
- 统计用户连续供奉天数
- 前端展示供奉日历

**存储优化**：
- 仅在存在有效供奉时写入键；无效时无键，节省存储
- 支持用户自助清理历史数据

---

## 🎯 事件定义

### 1. WeeklyActiveMarked（周活跃标记事件）

```rust
WeeklyActiveMarked(T::GraveId, T::AccountId, u64, u32)
```

**字段说明**：
- `T::GraveId`：墓位 ID
- `T::AccountId`：供奉者账户
- `u64`：起始周索引
- `u32`：连续周数

**触发场景**：
- `mark_weekly_active` 方法被调用时

**前端监听示例**：
```typescript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'ledger' && event.method === 'WeeklyActiveMarked') {
      const [graveId, who, startWeek, weeks] = event.data;
      console.log(`用户 ${who} 在墓位 ${graveId} 标记了从第 ${startWeek} 周起连续 ${weeks} 周的有效供奉`);
    }
  });
});
```

### 2. GraveOfferingAccumulated（墓位供奉累计事件）

```rust
GraveOfferingAccumulated(T::GraveId, T::Balance, T::Balance)
```

**字段说明**：
- `T::GraveId`：墓位 ID
- `T::Balance`：本次增量金额（delta）
- `T::Balance`：新的累计总额（new_total）

**触发场景**：
- `record_from_hook_with_amount` 方法被调用且提供了 amount 时

**前端监听示例**：
```typescript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'ledger' && event.method === 'GraveOfferingAccumulated') {
      const [graveId, delta, newTotal] = event.data;
      console.log(`墓位 ${graveId} 累计供奉金额 +${delta}，新总额：${newTotal}`);
    }
  });
});
```

### 3. WeeksPurged（周标记清理事件）

```rust
WeeksPurged(T::GraveId, T::AccountId, u64, u32)
```

**字段说明**：
- `T::GraveId`：墓位 ID
- `T::AccountId`：账户地址
- `u64`：清理截止周索引（before_week 或 end_week）
- `u32`：实际清理记录数

**触发场景**：
- `purge_weeks` 或 `purge_weeks_by_range` 方法被调用时

**前端监听示例**：
```typescript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'ledger' && event.method === 'WeeksPurged') {
      const [graveId, who, beforeWeek, removed] = event.data;
      console.log(`用户 ${who} 在墓位 ${graveId} 清理了 ${removed} 条历史周标记（截止第 ${beforeWeek} 周）`);
    }
  });
});
```

---

## ❌ 错误定义

```rust
#[pallet::error]
pub enum Error<T> {}
```

**说明**：
- 当前版本无自定义错误（所有方法均为内部调用或简单验证）
- 使用标准 `DispatchError::BadOrigin` 处理权限错误

---

## ⚙️ 配置参数

### Config Trait

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 墓位 ID 类型（与 pallet-stardust-grave 对齐）
    type GraveId: Parameter + Member + Copy + MaxEncodedLen;

    /// 链上余额类型（与 Runtime::Balance 对齐）
    type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

    /// 一周包含的区块数（用于"有效供奉周期"判定，按周粒度）
    #[pallet::constant]
    type BlocksPerWeek: Get<u32>;

    /// 权重信息提供者
    type WeightInfo: weights::WeightInfo;
}
```

### Runtime 配置示例

```rust
impl pallet_ledger::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type GraveId = u64;
    type Balance = Balance;
    /// 一周按 6s/块 × 60 × 60 × 24 × 7 = 100_800 块（可由治理升级调整）
    type BlocksPerWeek = frame_support::traits::ConstU32<100_800>;
    /// 绑定 ledger 手写占位权重（后续可替换为基准生成版）
    type WeightInfo = pallet_ledger::weights::SubstrateWeight<Runtime>;
}
```

### 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| RuntimeEvent | Event | - | 事件类型（标准 FRAME 配置） |
| GraveId | u64 | - | 墓位 ID 类型（与 pallet-stardust-grave 对齐） |
| Balance | u128 | - | 链上余额类型（与 Runtime::Balance 对齐，12 位小数） |
| BlocksPerWeek | ConstU32 | 100_800 | 一周包含的区块数（按 6s/块计算：7 × 24 × 60 × 10 = 100_800） |
| WeightInfo | SubstrateWeight | - | 权重信息提供者（用于交易费用计算） |

**BlocksPerWeek 计算说明**：
```
区块时间：6 秒/块
一周时间：7 天 × 24 小时 × 60 分钟 × 60 秒 = 604_800 秒
一周区块数：604_800 秒 / 6 秒 = 100_800 块
```

---

## 💻 使用示例

### 1. Hook 内部调用示例（Rust）

#### 1.1 记录带金额供奉

```rust
use sp_core::H256;
use sp_io::hashing::blake2_256;
use codec::Encode;

// 场景：用户在墓位 #123 供奉了 100 DUST
let grave_id: u64 = 123;
let who: T::AccountId = /* 供奉者账户 */;
let kind_code: u8 = 1; // 供奉品类型代码
let amount: u128 = 100_000_000_000_000; // 100 DUST（12 位小数）
let memo: Option<Vec<u8>> = Some(b"献给逝者的祝福".to_vec());

// 构造去重键（基于供奉事件哈希）
let tx_key = H256::from(blake2_256(&[
    grave_id.encode(),
    who.encode(),
    kind_code.encode(),
    amount.encode(),
    memo.clone().encode(),
].concat()));

// 调用记录方法（内部调用，无需 origin）
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    who.clone(),
    kind_code,
    Some(amount),
    memo,
    Some(tx_key),
);

// 结果：
// - TotalsByGrave[123] += 1
// - TotalMemoByGrave[123] += 100_000_000_000_000
// - DedupKeys[(123, tx_key)] = ()
// - 触发事件：GraveOfferingAccumulated(123, 100_000_000_000_000, new_total)
```

#### 1.2 标记周活跃

```rust
// 场景：用户购买了 4 周的 Timed 供奉
let grave_id: u64 = 123;
let who: T::AccountId = /* 供奉者账户 */;
let start_block = <frame_system::Pallet<T>>::block_number();
let duration_weeks: Option<u32> = Some(4);

// 调用标记方法（内部调用，无需 origin）
pallet_ledger::Pallet::<T>::mark_weekly_active(
    grave_id,
    who.clone(),
    start_block,
    duration_weeks,
);

// 结果：
// - 假设当前区块号为 200_000，BlocksPerWeek = 100_800
// - start_week = floor(200_000 / 100_800) = 1
// - 标记 WeeklyActive[(123, who, 1)] = ()
// - 标记 WeeklyActive[(123, who, 2)] = ()
// - 标记 WeeklyActive[(123, who, 3)] = ()
// - 标记 WeeklyActive[(123, who, 4)] = ()
// - 触发事件：WeeklyActiveMarked(123, who, 1, 4)
```

#### 1.3 查询周活跃状态

```rust
// 场景：pallet-memo-affiliate 判断用户在某周是否有资格参与计酬
let grave_id: u64 = 123;
let who: T::AccountId = /* 供奉者账户 */;
let week_index: u64 = 1;

// 查询指定周是否活跃
let is_active = pallet_ledger::Pallet::<T>::is_week_active(grave_id, &who, week_index);
if is_active {
    // 用户在第 1 周有有效供奉，可参与计酬
} else {
    // 用户在第 1 周无有效供奉，不可参与计酬
}

// 查询当前周是否活跃
let is_current_active = pallet_ledger::Pallet::<T>::is_current_week_active(grave_id, &who);
if is_current_active {
    // 用户在当前周有有效供奉
}
```

---

### 2. 前端调用示例（TypeScript）

#### 2.1 查询墓位累计数据

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';

// 连接到本地节点
const provider = new WsProvider('ws://localhost:9944');
const api = await ApiPromise.create({ provider });

// 查询墓位累计供奉次数
const graveId = 123;
const totalCount = await api.query.ledger.totalsByGrave(graveId);
console.log('累计供奉次数:', totalCount.toNumber());

// 查询墓位累计供奉金额
const totalAmount = await api.query.ledger.totalMemoByGrave(graveId);
console.log('累计供奉金额:', totalAmount.toString(), 'DUST');

// 格式化为可读金额（12 位小数）
const formattedAmount = (totalAmount.toBigInt() / BigInt(10 ** 12)).toString();
console.log('累计供奉金额（格式化）:', formattedAmount, 'DUST');
```

#### 2.2 查询周活跃状态

```typescript
// 获取当前周索引
const currentWeek = await api.call.ledgerApi.currentWeekIndex();
console.log('当前周索引:', currentWeek.toNumber());

// 查询用户在当前周是否活跃
const account = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'; // Alice
const isActive = await api.call.ledgerApi.isCurrentWeekActive(graveId, account);
console.log('用户在当前周是否活跃:', isActive.toHuman());

// 查询用户在指定周是否活跃
const weekIndex = 1;
const isWeekActive = await api.call.ledgerApi.isWeekActive(graveId, account, weekIndex);
console.log(`用户在第 ${weekIndex} 周是否活跃:`, isWeekActive.toHuman());
```

#### 2.3 批量查询周活跃位图

```typescript
// 查询用户最近 4 周的活跃情况
const currentWeek = await api.call.ledgerApi.currentWeekIndex();
const startWeek = currentWeek.toNumber() - 3; // 最近 4 周
const length = 4;

const bitmap = await api.call.ledgerApi.weeksActiveBitmap(graveId, account, startWeek, length);
console.log('最近 4 周活跃位图:', bitmap.toHex());

// 解析位图（bit=1 表示活跃）
const bitmapBytes = bitmap.toU8a();
for (let i = 0; i < length; i++) {
  const byteIndex = Math.floor(i / 8);
  const bitIndex = i % 8;
  const isActive = (bitmapBytes[byteIndex] & (1 << bitIndex)) !== 0;
  console.log(`第 ${startWeek + i} 周:`, isActive ? '活跃' : '不活跃');
}
```

#### 2.4 前端展示供奉日历（热力图）

```typescript
// 查询用户过去 52 周的活跃情况（按年统计）
const currentWeek = await api.call.ledgerApi.currentWeekIndex();
const startWeek = Math.max(0, currentWeek.toNumber() - 51);
const length = Math.min(52, currentWeek.toNumber() + 1);

const bitmap = await api.call.ledgerApi.weeksActiveBitmap(graveId, account, startWeek, length);
const bitmapBytes = bitmap.toU8a();

// 构造供奉日历数据
const calendarData = [];
for (let i = 0; i < length; i++) {
  const byteIndex = Math.floor(i / 8);
  const bitIndex = i % 8;
  const isActive = (bitmapBytes[byteIndex] & (1 << bitIndex)) !== 0;
  calendarData.push({
    week: startWeek + i,
    active: isActive,
  });
}

// 渲染热力图（伪代码）
renderHeatmap(calendarData);
```

#### 2.5 清理历史周标记

```typescript
import { web3FromAddress } from '@polkadot/extension-dapp';

// 场景：用户清理 100 周前的历史数据
const currentWeek = await api.call.ledgerApi.currentWeekIndex();
const beforeWeek = currentWeek.toNumber() - 100;
const limit = 50; // 每次最多清理 50 条

// 构造交易
const purgeTx = api.tx.ledger.purgeWeeks(
  graveId,
  account,
  beforeWeek,
  limit
);

// 签名并发送
const injector = await web3FromAddress(account);
await purgeTx.signAndSend(account, { signer: injector.signer }, (result) => {
  if (result.status.isInBlock) {
    console.log('交易已打包，区块哈希:', result.status.asInBlock.toString());
  } else if (result.status.isFinalized) {
    console.log('交易已最终确认，区块哈希:', result.status.asFinalized.toString());
  }
});
```

#### 2.6 按区间清理周标记

```typescript
// 场景：用户清理第 10-20 周的数据
const startWeek = 10;
const endWeek = 20;
const limit = 20;

// 构造交易
const purgeRangeTx = api.tx.ledger.purgeWeeksByRange(
  graveId,
  account,
  startWeek,
  endWeek,
  limit
);

// 签名并发送
const injector = await web3FromAddress(account);
await purgeRangeTx.signAndSend(account, { signer: injector.signer }, (result) => {
  if (result.status.isFinalized) {
    console.log('清理完成，区块哈希:', result.status.asFinalized.toString());
  }
});
```

---

## 🔗 集成说明

### 1. 与 pallet-memo-offerings 的集成

**调用场景**：供奉 Hook 调用记录方法

**集成流程**：
1. 用户在前端发起供奉交易（通过 pallet-memo-offerings）
2. pallet-memo-offerings 执行供奉逻辑（转账、记录等）
3. pallet-memo-offerings Hook 调用 `pallet_ledger::record_from_hook_with_amount`
4. pallet-ledger 累计次数和金额，触发事件

**代码示例（pallet-memo-offerings 内部）**：
```rust
// 在 pallet-memo-offerings 的供奉方法中调用
impl<T: Config> Pallet<T> {
    fn do_offering(
        grave_id: T::GraveId,
        who: T::AccountId,
        kind_code: u8,
        amount: T::Balance,
    ) -> DispatchResult {
        // 1. 执行供奉逻辑（转账等）
        // ...

        // 2. 构造去重键
        let tx_key = H256::from(blake2_256(&[
            grave_id.encode(),
            who.encode(),
            kind_code.encode(),
            amount.encode(),
        ].concat()));

        // 3. 调用 ledger 记录方法
        pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
            grave_id,
            who.clone(),
            kind_code,
            Some(amount),
            None,
            Some(tx_key),
        );

        // 4. 标记周活跃
        let start_block = <frame_system::Pallet<T>>::block_number();
        let duration_weeks = /* 根据供奉类型计算 */;
        pallet_ledger::Pallet::<T>::mark_weekly_active(
            grave_id,
            who,
            start_block,
            duration_weeks,
        );

        Ok(())
    }
}
```

---

### 2. 与 pallet-memo-affiliate 的集成

**调用场景**：联盟营销计酬判定

**集成流程**：
1. pallet-memo-affiliate 执行周结算（settle）
2. 遍历 15 级上线，查询每级上线在该周是否有有效供奉
3. 调用 `pallet_ledger::is_week_active(grave_id, upline, week_index)`
4. 若返回 true，则该上线可参与计酬；否则跳过

**代码示例（pallet-memo-affiliate 内部）**：
```rust
// 在 pallet-memo-affiliate 的结算方法中调用
impl<T: Config> Pallet<T> {
    fn settle_for_week(
        grave_id: T::GraveId,
        who: T::AccountId,
        week_index: u64,
    ) -> DispatchResult {
        // 1. 获取上线列表（15 级压缩）
        let uplines = Self::get_uplines(&who, 15)?;

        // 2. 遍历上线，判断是否有资格参与计酬
        for (level, upline) in uplines.iter().enumerate() {
            // 3. 查询上线在该周是否有有效供奉
            let is_active = pallet_ledger::Pallet::<T>::is_week_active(
                grave_id,
                upline,
                week_index,
            );

            // 4. 若有效供奉，则分配佣金
            if is_active {
                let commission = Self::calculate_commission(level, total_amount);
                Self::do_transfer(escrow_account, upline, commission)?;
            } else {
                // 无效供奉，跳过该级
                log::debug!("上线 {:?} 在第 {} 周无有效供奉，跳过计酬", upline, week_index);
            }
        }

        Ok(())
    }
}
```

**重要说明**：
- **周活跃标记是联盟营销计酬的核心依据**
- **15 级压缩机制**：每级上线必须在该周有有效供奉才可参与计酬
- **有效供奉定义**：在该周购买了 Timed 供奉或 Instant 供奉

---

### 3. 与前端 DApp 的集成

**调用场景**：查询统计数据、展示供奉日历

**集成流程**：
1. 前端通过 Polkadot-JS API 查询墓位累计数据
2. 前端通过 Runtime API 查询周活跃状态
3. 前端展示供奉日历（热力图）
4. 前端提供历史数据清理功能

**前端页面示例**：
```typescript
// 墓位详情页
const GraveDetailPage = ({ graveId }) => {
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState('0');
  const [calendarData, setCalendarData] = useState([]);

  useEffect(() => {
    // 查询累计数据
    const fetchData = async () => {
      const count = await api.query.ledger.totalsByGrave(graveId);
      const amount = await api.query.ledger.totalMemoByGrave(graveId);
      setTotalCount(count.toNumber());
      setTotalAmount(formatAmount(amount.toString()));

      // 查询供奉日历
      const currentWeek = await api.call.ledgerApi.currentWeekIndex();
      const bitmap = await api.call.ledgerApi.weeksActiveBitmap(
        graveId,
        account,
        currentWeek.toNumber() - 51,
        52
      );
      setCalendarData(parseBitmap(bitmap));
    };

    fetchData();
  }, [graveId]);

  return (
    <div>
      <h1>墓位 #{graveId}</h1>
      <p>累计供奉次数: {totalCount}</p>
      <p>累计供奉金额: {totalAmount} DUST</p>
      <Heatmap data={calendarData} />
    </div>
  );
};
```

---

## 🔍 周活跃标记机制详解

### 1. 周活跃标记的设计目标

周活跃标记是 pallet-ledger 的核心功能之一，其设计目标为：

- **联盟营销计酬依据**：15 级上线必须在该周有有效供奉才可参与计酬
- **活跃度统计**：统计用户连续供奉天数、活跃周数等指标
- **激励机制**：鼓励用户持续供奉，增加用户粘性
- **存储优化**：仅标记存在性（`()`），不存储额外数据

### 2. 周索引计算规则

**周索引公式**：
```
week_index = floor(block_number / BlocksPerWeek)
```

**示例**：
- BlocksPerWeek = 100_800（7 天 × 24 小时 × 60 分钟 × 10 块/分钟）
- 区块号 0 ~ 100_799 → week_index = 0（第 0 周）
- 区块号 100_800 ~ 201_599 → week_index = 1（第 1 周）
- 区块号 201_600 ~ 302_399 → week_index = 2（第 2 周）

### 3. Instant vs Timed 供奉的标记规则

**Instant 供奉**（即时供奉）：
- 仅标记当前周（duration_weeks = None）
- 示例：用户在第 1 周购买 Instant 供奉 → 标记 WeeklyActive[(grave_id, who, 1)] = ()

**Timed 供奉**（周期供奉）：
- 标记连续多周（duration_weeks = Some(w)）
- 示例：用户在第 1 周购买 4 周 Timed 供奉 → 标记 WeeklyActive[(grave_id, who, 1/2/3/4)] = ()

### 4. 联盟营销计酬判定流程

**15 级压缩机制**：
1. 用户 A 在墓位 #123 供奉了 100 DUST
2. pallet-memo-affiliate 执行结算，遍历 A 的 15 级上线（B, C, D, ...）
3. 对于每级上线 X，查询 `pallet_ledger::is_week_active(123, X, current_week)`
4. 若返回 true，则 X 可获得该级的佣金（5%）；否则跳过
5. 若不足 15 级或某级无有效供奉，剩余佣金归国库

**示例**：
```
假设当前周为第 10 周，用户 A 的上线链为：
A → B → C → D → E → ...（15 级）

查询结果：
- is_week_active(123, B, 10) = true  → B 获得 5% 佣金
- is_week_active(123, C, 10) = true  → C 获得 5% 佣金
- is_week_active(123, D, 10) = false → D 无佣金，跳过
- is_week_active(123, E, 10) = true  → E 获得 5% 佣金
...

D 的 5% 佣金归国库（因 D 在第 10 周无有效供奉）
```

### 5. 周活跃标记的重要性

**为什么需要周活跃标记？**

1. **防止"挂名分成"**：上线必须持续活跃（有供奉行为）才能获得佣金，不能"躺赚"
2. **激励持续供奉**：鼓励用户每周都有供奉行为，增加用户粘性
3. **公平分配机制**：活跃用户获得更多佣金，非活跃用户佣金归国库（反哺社区）
4. **防止刷量**：仅有推荐关系不足以获得佣金，必须有实际供奉行为

**对比传统模型**：
- **传统模型**：只要有推荐关系，就可永久获得佣金（易被刷量）
- **周活跃模型**：必须在该周有有效供奉，才可获得该周的佣金（防止刷量）

---

## 🛡️ 去重机制说明

### 1. 去重机制的设计目标

去重机制是 pallet-ledger 的核心功能之一，其设计目标为：

- **防止重复累计**：同一供奉事件多次调用 Hook 只累计一次
- **幂等性保证**：区块重组、Hook 重试等场景不会导致重复累计
- **轻量级实现**：仅存储去重键（H256），不存储额外数据
- **可选启用**：仅当 Hook 传入 tx_key 时启用去重检查

### 2. 去重键设计原则

**去重键构造方法**：
```rust
use sp_core::H256;
use sp_io::hashing::blake2_256;
use codec::Encode;

// 方案 1：基于供奉事件哈希
let tx_key = H256::from(blake2_256(&[
    grave_id.encode(),
    who.encode(),
    kind_code.encode(),
    amount.encode(),
    memo.encode(),
].concat()));

// 方案 2：基于外部 tx id（推荐）
let extrinsic_index = <frame_system::Pallet<T>>::extrinsic_index().unwrap_or(0);
let tx_key = H256::from(blake2_256(&[
    grave_id.encode(),
    who.encode(),
    extrinsic_index.encode(),
].concat()));
```

**去重键要求**：
- **唯一性**：同一供奉事件生成相同的去重键
- **可重现性**：相同输入生成相同输出（确定性哈希）
- **碰撞极低**：使用 blake2_256 保证碰撞概率极低

### 3. 去重机制实现流程

**代码实现**：
```rust
pub fn record_from_hook_with_amount(
    grave_id: T::GraveId,
    who: T::AccountId,
    kind_code: u8,
    amount: Option<T::Balance>,
    memo: Option<Vec<u8>>,
    tx_key: Option<H256>,
) {
    // 1. 若提供了去重键，判断是否已处理
    if let Some(k) = tx_key {
        if DedupKeys::<T>::contains_key((grave_id, k)) {
            return; // 已处理，直接返回（幂等）
        }
        DedupKeys::<T>::insert((grave_id, k), ());
    }

    // 2. 累加次数
    TotalsByGrave::<T>::mutate(grave_id, |c| *c = c.saturating_add(1));

    // 3. 累加金额
    if let Some(amt) = amount {
        let new_total = TotalMemoByGrave::<T>::mutate(grave_id, |b| {
            *b = b.saturating_add(amt);
            *b
        });
        Self::deposit_event(Event::GraveOfferingAccumulated(grave_id, amt, new_total));
    }
}
```

### 4. 去重机制使用示例

**场景 1：区块重组导致 Hook 重复调用**
```rust
// 第一次调用（区块 #1000）
let tx_key = H256::from(blake2_256(&[...]));
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    who,
    kind_code,
    Some(amount),
    memo,
    Some(tx_key),
);
// 结果：TotalsByGrave[grave_id] = 1

// 区块重组，第二次调用（区块 #1000 被替换）
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    who,
    kind_code,
    Some(amount),
    memo,
    Some(tx_key), // 相同的 tx_key
);
// 结果：TotalsByGrave[grave_id] = 1（未累加，幂等）
```

**场景 2：无去重键的调用**
```rust
// 不传入 tx_key，不启用去重检查
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    who,
    kind_code,
    Some(amount),
    memo,
    None, // 无去重键
);
// 结果：每次调用都会累加（无幂等性）
```

### 5. 去重机制的重要性

**为什么需要去重机制？**

1. **区块重组场景**：Fork 链可能导致同一交易被执行多次
2. **Hook 重试机制**：某些 Hook 实现可能有重试逻辑
3. **数据一致性**：保证统计数据的准确性（不重复、不遗漏）
4. **防止刷量**：恶意用户无法通过重复调用 Hook 刷数据

**对比传统模型**：
- **传统模型**：每次 Hook 调用都累加，易导致重复累计
- **去重模型**：基于 tx_key 判断，保证每个事件只累计一次

---

## 🧹 历史清理机制

### 1. 清理机制的设计目标

历史清理机制是 pallet-ledger 的辅助功能，其设计目标为：

- **存储优化**：长期运行后，WeeklyActive 可能积累大量历史数据
- **用户自助**：用户可自主决定清理哪些历史周标记
- **权限控制**：仅允许账户本人清理自己的数据
- **渐进式清理**：支持分批清理，避免单次交易权重过大

### 2. 清理方法对比

| 方法 | 清理范围 | 适用场景 |
|-----|---------|---------|
| purge_weeks | `week < before_week` | 清理某周之前的所有历史数据 |
| purge_weeks_by_range | `start_week <= week < end_week` | 清理指定区间的历史数据 |

### 3. 清理机制使用示例

**场景 1：清理 100 周前的历史数据**
```typescript
// 用户已使用系统 2 年（100+ 周），需要清理历史数据
const currentWeek = await api.call.ledgerApi.currentWeekIndex();
const beforeWeek = currentWeek.toNumber() - 100;

// 第一次清理：最多 50 条
await api.tx.ledger.purgeWeeks(graveId, account, beforeWeek, 50).signAndSend(account);

// 若还有剩余，继续清理
await api.tx.ledger.purgeWeeks(graveId, account, beforeWeek, 50).signAndSend(account);
```

**场景 2：按区间清理指定周数据**
```typescript
// 用户想删除第 10-20 周的数据（如测试期数据）
await api.tx.ledger.purgeWeeksByRange(graveId, account, 10, 20, 20).signAndSend(account);
```

### 4. 清理机制注意事项

1. **不影响资金或权益**：清理仅删除只读统计数据，不影响任何资金或权益
2. **仅影响自己的数据**：只能清理自己的 WeeklyActive 标记，无法清理他人数据
3. **渐进式清理**：建议分批清理，避免单次交易权重过大（Gas 费高）
4. **历史周标记不影响当前周**：清理历史数据不影响当前周及未来周的计酬

---

## 🎯 最佳实践

### 1. Hook 调用最佳实践

#### 1.1 始终传入去重键

**推荐做法**：
```rust
// 推荐：基于外部 tx id 构造去重键
let extrinsic_index = <frame_system::Pallet<T>>::extrinsic_index().unwrap_or(0);
let tx_key = H256::from(blake2_256(&[
    grave_id.encode(),
    who.encode(),
    extrinsic_index.encode(),
].concat()));

pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    who,
    kind_code,
    Some(amount),
    memo,
    Some(tx_key), // 始终传入去重键
);
```

**不推荐做法**：
```rust
// 不推荐：不传入去重键，无幂等性保证
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(
    grave_id,
    who,
    kind_code,
    Some(amount),
    memo,
    None, // 无去重键
);
```

#### 1.2 同时标记周活跃

**推荐做法**：
```rust
// 在记录供奉后，立即标记周活跃
pallet_ledger::Pallet::<T>::record_from_hook_with_amount(/* ... */);

let start_block = <frame_system::Pallet<T>>::block_number();
let duration_weeks = /* 根据供奉类型计算 */;
pallet_ledger::Pallet::<T>::mark_weekly_active(
    grave_id,
    who,
    start_block,
    duration_weeks,
);
```

### 2. 前端查询最佳实践

#### 2.1 使用 Runtime API 而非 RPC 查询

**推荐做法**：
```typescript
// 推荐：使用 Runtime API（性能更好）
const isActive = await api.call.ledgerApi.isCurrentWeekActive(graveId, account);
```

**不推荐做法**：
```typescript
// 不推荐：直接查询存储（性能较差）
const currentWeek = /* 计算当前周索引 */;
const isActive = await api.query.ledger.weeklyActive([graveId, account, currentWeek]);
```

#### 2.2 批量查询使用位图 API

**推荐做法**：
```typescript
// 推荐：使用位图 API 批量查询（一次 RPC 调用）
const bitmap = await api.call.ledgerApi.weeksActiveBitmap(graveId, account, startWeek, 52);
// 解析位图获取 52 周的活跃情况
```

**不推荐做法**：
```typescript
// 不推荐：循环查询（52 次 RPC 调用）
for (let week = startWeek; week < startWeek + 52; week++) {
  const isActive = await api.call.ledgerApi.isWeekActive(graveId, account, week);
  // ...
}
```

### 3. 存储清理最佳实践

#### 3.1 定期清理历史数据

**推荐做法**：
```typescript
// 推荐：每隔 3 个月清理一次历史数据（保留最近 12 周）
const currentWeek = await api.call.ledgerApi.currentWeekIndex();
const beforeWeek = currentWeek.toNumber() - 12;

// 分批清理（每次 50 条）
let removed = 0;
while (true) {
  const result = await api.tx.ledger.purgeWeeks(graveId, account, beforeWeek, 50).signAndSend(account);
  // 监听 WeeksPurged 事件获取实际清理数量
  if (removed < 50) break; // 已清理完毕
}
```

#### 3.2 根据业务需求调整清理策略

**场景 1：长期保留历史数据**
```typescript
// 适用于：需要长期展示供奉日历的用户
// 策略：保留最近 2 年（104 周）的数据
const beforeWeek = currentWeek.toNumber() - 104;
```

**场景 2：最小化存储成本**
```typescript
// 适用于：仅关注当前周计酬的用户
// 策略：仅保留最近 4 周的数据
const beforeWeek = currentWeek.toNumber() - 4;
```

### 4. 联盟营销集成最佳实践

#### 4.1 结算前批量预查询

**推荐做法**：
```rust
// 推荐：批量预查询所有上线的周活跃状态（减少存储访问）
let uplines = Self::get_uplines(&who, 15)?;
let active_uplines: Vec<(u32, T::AccountId)> = uplines
    .into_iter()
    .enumerate()
    .filter(|(level, upline)| {
        pallet_ledger::Pallet::<T>::is_week_active(grave_id, upline, week_index)
    })
    .collect();

// 仅对活跃上线分配佣金
for (level, upline) in active_uplines {
    let commission = Self::calculate_commission(level, total_amount);
    Self::do_transfer(escrow_account, &upline, commission)?;
}
```

#### 4.2 缓存当前周索引

**推荐做法**：
```rust
// 推荐：缓存当前周索引（避免重复计算）
let current_week = pallet_ledger::Pallet::<T>::current_week_index();

// 批量查询时复用 current_week
for upline in uplines {
    let is_active = pallet_ledger::Pallet::<T>::is_week_active(grave_id, upline, current_week);
    // ...
}
```

---

## 🔄 破坏式变更说明（方案A）

### 已移除功能

1. **TotalMemoByDeceased 存储**：不再支持 Deceased 维度的供奉金额统计
2. **add_to_deceased_total 方法**：不再支持为 Deceased 累计供奉金额
3. **DeceasedOfferingAccumulated 事件**：已移除 Deceased 相关事件

### 迁移指南

**如需 Deceased 维度统计**：
- 通过 Grave → Deceased 关联查询实现
- 在 Subsquid ETL 层聚合 Grave 数据

**代码变更**：
```rust
// 旧版（已废弃）
pallet_ledger::Pallet::<T>::add_to_deceased_total(deceased_id, amount);

// 新版（推荐）
// 1. 通过 pallet-stardust-grave 查询 Grave → Deceased 关联
// 2. 在 Subsquid ETL 层聚合 Grave 数据
```

---

## 📚 参考资料

### 相关文档

- [pallet-memo-offerings README](../memo-offerings/README.md)：供奉目录与订单记录
- [pallet-memo-affiliate README](../memo-affiliate/README.md)：15 级联盟营销系统
- [pallet-stardust-grave README](../stardust-grave/README.md)：墓位管理系统
- [Substrate Storage Documentation](https://docs.substrate.io/build/runtime-storage/)：Substrate 存储文档

### 技术规范

- **区块时间**：6 秒/块
- **一周区块数**：100_800 块（7 × 24 × 60 × 10）
- **Token**：DUST（12 位小数）
- **哈希算法**：Blake2_256（用于去重键）

### 开发工具

- **Polkadot-JS Apps**：https://polkadot.js.org/apps/
- **Substrate Docs**：https://docs.substrate.io/
- **Cargo Docs**：`cargo +nightly doc --open -p pallet-ledger`

---

## 📝 版本历史

### v0.1.0（当前版本）

- ✅ 精简版设计：移除 60% 旧版功能（明细、排行榜、分类型统计）
- ✅ 实现去重机制：基于 tx_key 防止重复累计
- ✅ 实现周活跃标记：用于联盟营销计酬判定
- ✅ 实现历史清理：用户可自助清理历史周标记
- ✅ 破坏式变更（方案A）：移除 Deceased 维度统计

### 未来规划

- 🔜 Runtime API：提供更多只读查询接口
- 🔜 自动清理：链上定时任务自动清理过期数据
- 🔜 性能优化：优化 WeeklyActive 存储结构（如位图压缩）

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- **项目仓库**：[Stardust GitHub](https://github.com/your-repo/stardust)
- **Issue Tracker**：[GitHub Issues](https://github.com/your-repo/stardust/issues)
- **开发文档**：[CLAUDE.md](../../CLAUDE.md)

---

**最后更新**：2025-11-11
**文档版本**：v1.0.0
**模块版本**：v0.1.0
