# Domain 7 阶段5实施计划：防刷机制

## 一、目标概述

**目标**: 实现三层防刷机制，防止恶意用户刷数据污染作品影响力评分

**优先级**: 中（影响数据质量和系统公平性）

**预计工作量**: 6-8小时

---

## 二、设计方案

### 2.1 三层防刷机制

```
┌─────────────────────────────────────────────────────────────┐
│                    防刷机制三层架构                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  第1层: 每日操作限额（Daily Limits）                          │
│  ├─ 每日浏览上限：1000个作品                                  │
│  ├─ 每日分享上限：100次                                       │
│  └─ 每日收藏上限：50次                                        │
│                                                               │
│  第2层: 时间窗口防重复（Time Window Deduplication）           │
│  ├─ 同一作品10秒内不重复计数浏览                              │
│  ├─ 同一作品1分钟内不重复计数分享                             │
│  └─ 收藏操作天然防重复（双向操作）                            │
│                                                               │
│  第3层: 异常行为检测（Anomaly Detection）                     │
│  ├─ 1小时内浏览>100个作品 → 警告                             │
│  ├─ 单个作品每日被同一用户重复操作>10次 → 拒绝               │
│  └─ 累计异常行为 → 暂时封禁（可治理解除）                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.2 存储结构设计

#### 存储1: 每日操作计数（DailyOperationCount）

```rust
/// 函数级中文注释：每日操作计数器（按账户+操作类型）
#[pallet::storage]
pub type DailyOperationCount<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::AccountId,        // 用户账户
    Blake2_128Concat,
    OperationType,       // 操作类型（View/Share/Favorite）
    DailyCountInfo<BlockNumberFor<T>>,
    ValueQuery,
>;

/// 每日计数信息
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Debug)]
pub struct DailyCountInfo<BlockNumber> {
    /// 当日总计数
    pub count: u32,
    /// 上次重置的区块号（用于判断是否跨天）
    pub last_reset: BlockNumber,
}
```

**重置逻辑**:
- 假设每天14400个区块（6秒/块）
- `current_block / 14400 != last_reset / 14400` → 跨天，重置为0

**示例**:
```rust
// Alice浏览作品123
DailyOperationCount::<T>::get(alice, OperationType::View)
// → DailyCountInfo { count: 42, last_reset: 100000 }

// 跨天后自动重置
if current_block / 14400 != last_reset / 14400 {
    count = 0;
    last_reset = current_block;
}
```

---

#### 存储2: 最近操作记录（RecentOperations）

```rust
/// 函数级中文注释：最近操作记录（用于时间窗口防重复）
#[pallet::storage]
pub type RecentOperations<T: Config> = StorageNMap<
    _,
    (
        NMapKey<Blake2_128Concat, T::AccountId>,  // 用户
        NMapKey<Blake2_128Concat, u64>,           // work_id
        NMapKey<Blake2_128Concat, OperationType>, // 操作类型
    ),
    BlockNumberFor<T>,  // 最后操作的区块号
    OptionQuery,
>;
```

**查询逻辑**:
```rust
// 检查Alice是否在10秒内重复浏览作品123
let last_view = RecentOperations::<T>::get((alice, 123, OperationType::View));
if let Some(last_block) = last_view {
    let elapsed_blocks = current_block - last_block;
    if elapsed_blocks < 100 {  // 100块 ≈ 10分钟（假设6秒/块）
        return Err(Error::<T>::TooFrequent.into());
    }
}
```

**GC策略**:
- 每个操作后清理超过1小时的旧记录
- 使用 `take_prefix()` 批量删除

---

#### 存储3: 异常行为统计（AnomalyStats）

```rust
/// 函数级中文注释：异常行为统计（1小时滑动窗口）
#[pallet::storage]
pub type HourlyOperationCount<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::AccountId,        // 用户账户
    Blake2_128Concat,
    OperationType,       // 操作类型
    HourlyCountInfo<BlockNumberFor<T>>,
    ValueQuery,
>;

/// 1小时计数信息
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Debug)]
pub struct HourlyCountInfo<BlockNumber> {
    /// 1小时内计数
    pub count: u32,
    /// 窗口起始区块号
    pub window_start: BlockNumber,
}
```

**滑动窗口逻辑**:
```rust
// 1小时 = 600块（假设6秒/块）
const HOURLY_WINDOW: u32 = 600;

let mut hourly = HourlyOperationCount::<T>::get(who, OperationType::View);
if current_block - hourly.window_start >= HOURLY_WINDOW {
    // 窗口过期，重置
    hourly.count = 0;
    hourly.window_start = current_block;
}

hourly.count += 1;
if hourly.count > 100 {
    // 触发异常检测
    Self::deposit_event(Event::AnomalyDetected { who, operation_type });
}
```

---

#### 存储4: 每日单作品操作计数（PerWorkDailyCount）

```rust
/// 函数级中文注释：每日单作品操作计数（防止刷单个作品）
#[pallet::storage]
pub type PerWorkDailyCount<T: Config> = StorageNMap<
    _,
    (
        NMapKey<Blake2_128Concat, T::AccountId>,  // 用户
        NMapKey<Blake2_128Concat, u64>,           // work_id
        NMapKey<Blake2_128Concat, OperationType>, // 操作类型
    ),
    DailyCountInfo<BlockNumberFor<T>>,
    ValueQuery,
>;
```

**检查逻辑**:
```rust
// 检查Alice是否对作品123过度操作
let per_work_count = PerWorkDailyCount::<T>::get((alice, 123, OperationType::View));
if per_work_count.count > 10 {
    return Err(Error::<T>::TooManyOperationsOnSingleWork.into());
}
```

---

### 2.3 操作类型枚举

```rust
/// 函数级中文注释：操作类型枚举
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OperationType {
    /// 浏览作品
    View,
    /// 分享作品
    Share,
    /// 收藏作品
    Favorite,
}
```

---

### 2.4 错误类型定义

```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...

    // ========== Phase 5: 防刷机制错误 ==========
    /// 超过每日操作限额
    DailyLimitExceeded,

    /// 操作过于频繁（时间窗口内重复）
    TooFrequent,

    /// 对单个作品操作过多
    TooManyOperationsOnSingleWork,

    /// 检测到异常行为（1小时内操作过多）
    AnomalyDetected,
}
```

---

### 2.5 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 现有事件 ...

    // ========== Phase 5: 防刷机制事件 ==========
    /// 异常行为被检测到
    AnomalyDetected {
        who: T::AccountId,
        operation_type: OperationType,
        count_in_hour: u32,
    },

    /// 用户达到每日限额
    DailyLimitReached {
        who: T::AccountId,
        operation_type: OperationType,
        limit: u32,
    },
}
```

---

## 三、实现步骤

### Step 1: 定义类型和存储（预计1小时）

**文件**: `pallets/deceased/src/anti_spam.rs`（新建）

**内容**:
1. 定义 `OperationType` 枚举
2. 定义 `DailyCountInfo` 和 `HourlyCountInfo` 结构
3. 声明4个存储项
4. 添加防刷相关错误和事件

---

### Step 2: 实现核心检查函数（预计2小时）

**函数1**: `check_daily_limit()`
```rust
/// 检查每日操作限额
fn check_daily_limit(
    who: &T::AccountId,
    operation_type: OperationType,
) -> DispatchResult {
    let limit = Self::get_daily_limit(operation_type);
    let mut info = DailyOperationCount::<T>::get(who, operation_type);

    // 跨天重置
    let current_block = <frame_system::Pallet<T>>::block_number();
    if Self::should_reset_daily(current_block, info.last_reset) {
        info.count = 0;
        info.last_reset = current_block;
    }

    // 检查限额
    ensure!(info.count < limit, Error::<T>::DailyLimitExceeded);

    // 递增计数
    info.count += 1;
    DailyOperationCount::<T>::insert(who, operation_type, info);

    // 触发事件（接近限额时）
    if info.count >= limit * 90 / 100 {
        Self::deposit_event(Event::DailyLimitReached {
            who: who.clone(),
            operation_type,
            limit,
        });
    }

    Ok(())
}
```

**函数2**: `check_time_window()`
```rust
/// 检查时间窗口防重复
fn check_time_window(
    who: &T::AccountId,
    work_id: u64,
    operation_type: OperationType,
) -> DispatchResult {
    let window = Self::get_time_window(operation_type);
    let current_block = <frame_system::Pallet<T>>::block_number();

    if let Some(last_block) = RecentOperations::<T>::get((who, work_id, operation_type)) {
        let elapsed = current_block.saturating_sub(last_block);
        ensure!(
            elapsed >= window,
            Error::<T>::TooFrequent
        );
    }

    // 更新最近操作时间
    RecentOperations::<T>::insert((who, work_id, operation_type), current_block);

    Ok(())
}
```

**函数3**: `check_anomaly()`
```rust
/// 检查异常行为
fn check_anomaly(
    who: &T::AccountId,
    operation_type: OperationType,
) -> DispatchResult {
    let threshold = Self::get_hourly_threshold(operation_type);
    let current_block = <frame_system::Pallet<T>>::block_number();

    let mut hourly = HourlyOperationCount::<T>::get(who, operation_type);

    // 更新滑动窗口
    if current_block.saturating_sub(hourly.window_start) >= 600u32.into() {
        hourly.count = 0;
        hourly.window_start = current_block;
    }

    hourly.count += 1;

    // 检查异常
    if hourly.count > threshold {
        Self::deposit_event(Event::AnomalyDetected {
            who: who.clone(),
            operation_type,
            count_in_hour: hourly.count,
        });
        // 注意：这里只记录事件，不阻止操作（警告模式）
        // 如需阻止，可 return Err(Error::<T>::AnomalyDetected.into());
    }

    HourlyOperationCount::<T>::insert(who, operation_type, hourly);

    Ok(())
}
```

**函数4**: `check_per_work_limit()`
```rust
/// 检查单作品操作次数限制
fn check_per_work_limit(
    who: &T::AccountId,
    work_id: u64,
    operation_type: OperationType,
) -> DispatchResult {
    const PER_WORK_LIMIT: u32 = 10;
    let current_block = <frame_system::Pallet<T>>::block_number();

    let mut info = PerWorkDailyCount::<T>::get((who, work_id, operation_type));

    // 跨天重置
    if Self::should_reset_daily(current_block, info.last_reset) {
        info.count = 0;
        info.last_reset = current_block;
    }

    // 检查限制
    ensure!(
        info.count < PER_WORK_LIMIT,
        Error::<T>::TooManyOperationsOnSingleWork
    );

    info.count += 1;
    PerWorkDailyCount::<T>::insert((who, work_id, operation_type), info);

    Ok(())
}
```

---

### Step 3: 集成到现有接口（预计1小时）

修改4个extrinsic，添加防刷检查：

```rust
// view_work() 修改后
pub fn view_work(
    origin: OriginFor<T>,
    work_id: u64,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    ensure!(
        DeceasedWorks::<T>::contains_key(work_id),
        Error::<T>::WorkNotFound
    );

    // ========== Phase 5: 防刷检查 ==========
    Self::check_daily_limit(&who, OperationType::View)?;
    Self::check_time_window(&who, work_id, OperationType::View)?;
    Self::check_anomaly(&who, OperationType::View)?;
    Self::check_per_work_limit(&who, work_id, OperationType::View)?;
    // =====================================

    let now = <frame_system::Pallet<T>>::block_number();

    WorkEngagementStats::<T>::mutate(work_id, |stats| {
        stats.view_count = stats.view_count.saturating_add(1);
        stats.last_viewed_at = Some(now);
    });

    Ok(())
}
```

类似修改 `share_work()` 和 `favorite_work()`。

---

### Step 4: 添加辅助函数（预计30分钟）

```rust
impl<T: Config> Pallet<T> {
    /// 获取每日限额
    fn get_daily_limit(operation_type: OperationType) -> u32 {
        match operation_type {
            OperationType::View => 1000,
            OperationType::Share => 100,
            OperationType::Favorite => 50,
        }
    }

    /// 获取时间窗口（区块数）
    fn get_time_window(operation_type: OperationType) -> BlockNumberFor<T> {
        match operation_type {
            OperationType::View => 100u32.into(),    // 100块 ≈ 10分钟
            OperationType::Share => 10u32.into(),    // 10块 ≈ 1分钟
            OperationType::Favorite => 0u32.into(),  // 收藏无窗口限制
        }
    }

    /// 获取1小时异常阈值
    fn get_hourly_threshold(operation_type: OperationType) -> u32 {
        match operation_type {
            OperationType::View => 100,
            OperationType::Share => 30,
            OperationType::Favorite => 20,
        }
    }

    /// 判断是否应该重置每日计数
    fn should_reset_daily(
        current_block: BlockNumberFor<T>,
        last_reset: BlockNumberFor<T>,
    ) -> bool {
        const BLOCKS_PER_DAY: u32 = 14400;  // 假设6秒/块

        let current_day = Self::block_to_day(current_block);
        let last_day = Self::block_to_day(last_reset);

        current_day != last_day
    }

    /// 将区块号转换为天数
    fn block_to_day(block: BlockNumberFor<T>) -> u32 {
        const BLOCKS_PER_DAY: u32 = 14400;
        TryInto::<u32>::try_into(block)
            .unwrap_or(0)
            .saturating_div(BLOCKS_PER_DAY)
    }
}
```

---

### Step 5: 编写单元测试（预计2小时）

**测试文件**: `pallets/deceased/src/tests_anti_spam.rs`

**测试用例**:
1. ✅ `test_daily_limit_enforcement` - 验证每日限额
2. ✅ `test_daily_limit_reset` - 验证跨天重置
3. ✅ `test_time_window_deduplication` - 验证时间窗口防重复
4. ✅ `test_anomaly_detection` - 验证异常行为检测
5. ✅ `test_per_work_limit` - 验证单作品操作限制
6. ✅ `test_multiple_users_no_interference` - 验证多用户无干扰

---

### Step 6: Runtime配置（预计30分钟）

在 `runtime/src/configs/mod.rs` 添加防刷参数：

```rust
parameter_types! {
    /// 每日浏览限额
    pub const ViewDailyLimit: u32 = 1000;

    /// 每日分享限额
    pub const ShareDailyLimit: u32 = 100;

    /// 每日收藏限额
    pub const FavoriteDailyLimit: u32 = 50;

    /// 浏览时间窗口（10分钟 = 100块）
    pub const ViewTimeWindow: u32 = 100;

    /// 分享时间窗口（1分钟 = 10块）
    pub const ShareTimeWindow: u32 = 10;

    /// 1小时异常阈值（浏览）
    pub const ViewHourlyThreshold: u32 = 100;
}
```

---

## 四、参数配置

### 4.1 每日限额（Daily Limits）

| 操作类型 | 限额 | 理由 |
|---------|------|------|
| 浏览（View） | 1000次/天 | 正常用户每天浏览10-50个作品，1000次足够容错 |
| 分享（Share） | 100次/天 | 分享是主动行为，100次已经很高 |
| 收藏（Favorite） | 50次/天 | 收藏是精选行为，50次合理 |

**治理可调整**: 通过链上治理修改限额

---

### 4.2 时间窗口（Time Windows）

| 操作类型 | 窗口大小 | 理由 |
|---------|---------|------|
| 浏览（View） | 10分钟 | 防止快速刷新刷浏览量 |
| 分享（Share） | 1分钟 | 分享后短时间内不应重复 |
| 收藏（Favorite） | 无限制 | 双向操作天然防重复 |

**说明**: 同一用户对同一作品在窗口内的重复操作被忽略

---

### 4.3 异常阈值（Anomaly Thresholds）

| 操作类型 | 1小时阈值 | 行为 |
|---------|----------|------|
| 浏览（View） | 100次 | 触发警告事件（不阻止） |
| 分享（Share） | 30次 | 触发警告事件 |
| 收藏（Favorite） | 20次 | 触发警告事件 |

**警告模式**: 第3层异常检测默认只记录事件，不阻止操作（可配置）

---

## 五、存储成本分析

### 5.1 存储开销估算

| 存储项 | 每条大小 | 10万用户 | 100万用户 |
|--------|----------|----------|-----------|
| DailyOperationCount | 40字节 | 12MB | 120MB |
| RecentOperations | 32字节 | 96MB | 960MB |
| HourlyOperationCount | 40字节 | 12MB | 120MB |
| PerWorkDailyCount | 40字节 | 400MB | 4GB |

**说明**:
- DailyOperationCount: 每用户3条（View/Share/Favorite）
- RecentOperations: 假设每用户平均最近操作30个作品
- PerWorkDailyCount: 假设每用户每天操作100个作品

**优化策略**:
1. RecentOperations自动GC（超过1小时删除）
2. PerWorkDailyCount每天重置
3. 考虑使用链下存储（Subsquid）记录历史

---

### 5.2 Gas成本影响

每次操作额外增加：
- 4次存储读取（每日限额、时间窗口、异常检测、单作品限制）
- 2-4次存储写入（取决于是否需要重置）

**预计Gas增加**: 5000-10000 gas（约+50%）

**用户体验**:
- 正常用户：几乎无感知
- 异常用户：会被阻止，但有明确错误提示

---

## 六、测试计划

### 6.1 单元测试

**覆盖场景**:
1. ✅ 正常用户操作不受影响
2. ✅ 超过每日限额被阻止
3. ✅ 跨天自动重置计数
4. ✅ 时间窗口内重复操作被忽略
5. ✅ 1小时内异常操作触发警告
6. ✅ 单作品过度操作被阻止
7. ✅ 多用户之间不互相干扰

---

### 6.2 集成测试

**测试流程**:
```rust
#[test]
fn test_full_anti_spam_workflow() {
    new_test_ext().execute_with(|| {
        let alice = 1;
        let work_id = 1;
        create_test_work(work_id);

        // 1. 正常操作：前10次成功
        for _ in 0..10 {
            assert_ok!(Deceased::view_work(Origin::signed(alice), work_id));
            run_to_block(System::block_number() + 100);  // 跳过时间窗口
        }

        // 2. 快速重复：被时间窗口拦截
        assert_ok!(Deceased::view_work(Origin::signed(alice), work_id));
        assert_noop!(
            Deceased::view_work(Origin::signed(alice), work_id),
            Error::<Test>::TooFrequent
        );

        // 3. 超过每日限额
        for _ in 0..990 {
            assert_ok!(Deceased::view_work(Origin::signed(alice), work_id));
            run_to_block(System::block_number() + 100);
        }
        assert_noop!(
            Deceased::view_work(Origin::signed(alice), work_id),
            Error::<Test>::DailyLimitExceeded
        );

        // 4. 跨天重置
        run_to_block(14400);  // 跳过1天
        assert_ok!(Deceased::view_work(Origin::signed(alice), work_id));
    });
}
```

---

## 七、前端集成

### 7.1 错误处理

```typescript
// stardust-dapp/src/services/deceasedService.ts

export async function viewWork(workId: number): Promise<void> {
  try {
    const api = await getPolkadotApi();
    const account = getCurrentAccount();

    const tx = api.tx.deceased.viewWork(workId);
    await tx.signAndSend(account);
  } catch (error) {
    // 解析错误类型
    if (error.message.includes('DailyLimitExceeded')) {
      message.error('您今日的浏览次数已达上限（1000次），请明天再试');
    } else if (error.message.includes('TooFrequent')) {
      message.warning('操作过于频繁，请稍后再试');
    } else if (error.message.includes('TooManyOperationsOnSingleWork')) {
      message.warning('您对该作品的操作次数过多，请明天再试');
    } else if (error.message.includes('AnomalyDetected')) {
      message.warning('检测到异常行为，请注意操作频率');
    } else {
      message.error('操作失败，请稍后再试');
    }
  }
}
```

---

### 7.2 前端限流辅助

```typescript
// 前端额外防抖（减少链上负担）

const viewDebounceCache = new Map<number, number>();

export async function viewWorkWithDebounce(workId: number): Promise<void> {
  // 前端10秒防抖
  const now = Date.now();
  const lastView = viewDebounceCache.get(workId) || 0;
  if (now - lastView < 10000) {
    console.log('前端防抖：跳过重复提交');
    return;
  }

  viewDebounceCache.set(workId, now);

  try {
    await viewWork(workId);
  } catch (error) {
    // 失败时清除缓存（允许重试）
    viewDebounceCache.delete(workId);
    throw error;
  }
}
```

---

## 八、后续优化方向

### 8.1 动态限额（Phase 6）

根据用户信誉动态调整限额：
- 高信誉用户（90+）：限额 × 1.5
- 低信誉用户（<30）：限额 × 0.5

---

### 8.2 智能异常检测（Phase 7）

- 使用机器学习识别刷量模式
- 分析用户行为序列（如连续浏览ID递增的作品）
- 检测僵尸网络（多账户协同刷量）

---

### 8.3 链下存储优化（Phase 8）

- 将历史操作记录迁移到Subsquid
- 链上只保留最近7天数据
- 减少存储成本

---

## 九、时间安排

| 步骤 | 预计时间 | 负责人 |
|------|---------|--------|
| 设计方案评审 | 30分钟 | 团队 |
| 定义类型和存储 | 1小时 | 开发者 |
| 实现核心检查函数 | 2小时 | 开发者 |
| 集成到现有接口 | 1小时 | 开发者 |
| 添加辅助函数 | 30分钟 | 开发者 |
| 编写单元测试 | 2小时 | 开发者 |
| Runtime配置 | 30分钟 | 开发者 |
| 前端集成测试 | 1小时 | 前端开发者 |
| 代码审查和文档 | 1小时 | 团队 |
| **合计** | **8-10小时** | |

---

## 十、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 存储膨胀 | 高 | 实施GC策略，定期清理旧数据 |
| Gas成本增加 | 中 | 优化存储读写次数，使用缓存 |
| 误判正常用户 | 高 | 设置合理阈值，提供申诉机制 |
| 刷量者绕过限制 | 中 | 多层防护，持续优化检测算法 |

---

**文档维护**: Substrate开发团队
**创建日期**: 2025-01-15
**文档版本**: v1.0
