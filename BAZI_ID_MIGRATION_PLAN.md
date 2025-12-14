# BaziChart ID 类型迁移方案

## 📋 问题描述

**当前问题：**
- BaziChart pallet 使用 `T::Hash` 作为 chart_id
- DivinationAi pallet 期望 `u64` 类型的 result_id
- 导致 AI 解读功能无法工作（找不到对应的八字记录）

**影响范围：**
- ❌ AI智能解盘功能无法使用
- ❌ 与其他占卜模块（梅花易数、六爻等）设计不一致
- ❌ 前端需要复杂的 Hash ↔ 数字转换逻辑

---

## 🎯 解决方案：统一使用递增 ID

### 方案优势

1. **一致性**：与其他占卜模块保持相同的设计
2. **兼容性**：完美兼容 DivinationAi pallet
3. **简洁性**：前端逻辑简化，不需要 Hash 转换
4. **标准化**：递增ID是区块链项目的标准做法

---

## 🔧 实施步骤

### 第一步：修改 Pallet 存储结构

#### 1.1 修改存储定义（`pallets/divination/bazi/src/lib.rs`）

**当前代码（第 112-120 行）：**
```rust
/// 存储映射: 八字ID -> 八字详情
#[pallet::storage]
#[pallet::getter(fn chart_by_id)]
pub type ChartById<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,  // ← 使用 Hash
    BaziChart<T>,
>;
```

**修改为：**
```rust
/// 下一个八字ID计数器
#[pallet::storage]
#[pallet::getter(fn next_chart_id)]
pub type NextChartId<T: Config> = StorageValue<_, u64, ValueQuery>;

/// 存储映射: 八字ID -> 八字详情
#[pallet::storage]
#[pallet::getter(fn chart_by_id)]
pub type ChartById<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // ← 改为 u64
    BaziChart<T>,
>;

/// 存储映射: 用户 -> 八字ID列表
#[pallet::storage]
#[pallet::getter(fn user_charts)]
pub type UserCharts<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<u64, T::MaxChartsPerAccount>,
    ValueQuery,
>;
```

#### 1.2 修改事件定义（第 142-147 行）

**当前代码：**
```rust
BaziChartCreated {
    owner: T::AccountId,
    chart_id: T::Hash,  // ← 使用 Hash
    birth_time: BirthTime,
},
```

**修改为：**
```rust
BaziChartCreated {
    owner: T::AccountId,
    chart_id: u64,  // ← 改为 u64
    birth_time: BirthTime,
},
```

同样修改：
- `BaziChartQueried`
- `BaziChartDeleted`
- `BaziChartInterpreted`

所有事件中的 `T::Hash` 都改为 `u64`。

#### 1.3 修改 create_bazi_chart 函数（第 227 行开始）

**关键修改点：**

```rust
pub fn create_bazi_chart(
    origin: OriginFor<T>,
    // ... 参数保持不变
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 获取新的 chart_id
    let chart_id = NextChartId::<T>::get();

    // 验证ID不会溢出
    ensure!(
        chart_id < u64::MAX,
        Error::<T>::ChartIdOverflow
    );

    // ... 计算八字逻辑保持不变 ...

    // 创建八字记录
    let chart = BaziChart {
        owner: who.clone(),
        // ... 其他字段
    };

    // 保存到存储
    ChartById::<T>::insert(chart_id, chart);

    // 更新用户的八字列表
    UserCharts::<T>::try_mutate(&who, |charts| {
        charts.try_push(chart_id)
            .map_err(|_| Error::<T>::TooManyCharts)
    })?;

    // 递增计数器
    NextChartId::<T>::put(chart_id + 1);

    // 发出事件
    Self::deposit_event(Event::BaziChartCreated {
        owner: who,
        chart_id,  // ← 现在是 u64
        birth_time,
    });

    Ok(())
}
```

#### 1.4 修改其他函数

**需要修改的函数：**
- `delete_bazi_chart(chart_id: u64)` - 参数类型改为 u64
- `interpret_bazi_chart(chart_id: u64)` - 参数类型改为 u64
- 所有查询函数

#### 1.5 添加错误类型

```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...

    /// 八字ID已达到最大值
    ChartIdOverflow,

    /// 八字不存在
    ChartNotFound,
}
```

---

### 第二步：修改前端代码

#### 2.1 修改 baziChainService.ts

**当前代码（第 125-131 行）：**
```typescript
if (event) {
  const chartIdHash = event.event.data[1].toString();
  const numericId = parseInt(chartIdHash.substring(2, 10), 16);
  resolve(numericId);
}
```

**修改为：**
```typescript
if (event) {
  // chart_id 现在直接是 u64 类型
  const chartId = event.event.data[1].toNumber();
  console.log('[BaziChainService] 八字命盘创建成功，ID:', chartId);
  resolve(chartId);
}
```

#### 2.2 修改查询函数

**getBaziChart 函数：**
```typescript
export async function getBaziChart(chartId: number): Promise<OnChainBaziChart | null> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.chartById) {
    console.error('[BaziChainService] baziChart pallet 不存在');
    return null;
  }

  const result = await api.query.baziChart.chartById(chartId);

  if (result.isNone) {
    console.log('[BaziChainService] 命盘不存在');
    return null;
  }

  // ... 解析逻辑保持不变
}
```

**getUserBaziCharts 函数：**
```typescript
export async function getUserBaziCharts(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.baziChart || !api.query.baziChart.userCharts) {
    console.error('[BaziChainService] baziChart pallet 不存在');
    return [];
  }

  const result = await api.query.baziChart.userCharts(address);
  return result.map((id: any) => id.toNumber());
}
```

---

### 第三步：实现 DivinationProvider Trait

DivinationAi pallet 需要 BaziChart 实现 `DivinationProvider` trait：

```rust
// 在 pallets/divination/bazi/src/lib.rs 底部添加

impl<T: Config> pallet_divination_common::DivinationProvider for Pallet<T> {
    type DivinationId = u64;

    fn result_exists(divination_type: DivinationType, result_id: u64) -> bool {
        // 只处理八字类型
        if divination_type != DivinationType::Bazi {
            return false;
        }

        ChartById::<T>::contains_key(result_id)
    }

    fn get_result_owner(divination_type: DivinationType, result_id: u64) -> Option<T::AccountId> {
        if divination_type != DivinationType::Bazi {
            return None;
        }

        ChartById::<T>::get(result_id).map(|chart| chart.owner)
    }
}
```

---

### 第四步：编译和测试

#### 4.1 编译 Pallet

```bash
cd /home/xiaodong/文档/stardust

# 编译 BaziChart pallet
cargo build --release -p pallet-bazi-chart

# 编译 runtime
cargo build --release -p stardust-runtime

# 编译节点
cargo build --release -p stardust-node
```

#### 4.2 重启节点

```bash
# 停止旧节点
pkill stardust-node

# 清除链数据（必须，因为存储结构改变了）
./target/release/stardust-node purge-chain --dev -y

# 启动新节点
./target/release/stardust-node --dev --rpc-external --rpc-port 9944 --rpc-cors=all --tmp
```

#### 4.3 测试流程

1. **测试八字排盘和保存**
   ```
   访问: http://localhost:5173/#/bazi
   → 输入出生信息
   → 点击"开始排盘"
   → 点击"保存到链上"（使用 Alice 账户）
   → 验证：应该返回数字ID（如 0, 1, 2...）
   ```

2. **测试 AI 智能解盘**
   ```
   → 保存成功后，点击"AI智能解盘"
   → 验证：请求应该成功提交到链上
   → 检查：xuanxue-oracle 应该能接收到请求
   ```

3. **验证链上数据**
   ```bash
   node check_ai_request.mjs
   # 应该能看到 AI 解读请求
   ```

---

## 📊 代码修改清单

### Rust 代码（后端）

| 文件 | 修改内容 | 行数 |
|------|---------|------|
| `pallets/divination/bazi/src/lib.rs` | 存储结构定义 | ~30行 |
| `pallets/divination/bazi/src/lib.rs` | 事件定义 | ~10行 |
| `pallets/divination/bazi/src/lib.rs` | create_bazi_chart 函数 | ~20行 |
| `pallets/divination/bazi/src/lib.rs` | delete_bazi_chart 函数 | ~5行 |
| `pallets/divination/bazi/src/lib.rs` | interpret_bazi_chart 函数 | ~5行 |
| `pallets/divination/bazi/src/lib.rs` | DivinationProvider 实现 | ~20行 |

**预计修改：** 约 90 行代码

### TypeScript 代码（前端）

| 文件 | 修改内容 | 行数 |
|------|---------|------|
| `src/services/baziChainService.ts` | saveBaziToChain | ~5行 |
| `src/services/baziChainService.ts` | getBaziChart | ~3行 |
| `src/services/baziChainService.ts` | getUserBaziCharts | ~3行 |
| `src/services/baziChainService.ts` | 其他查询函数 | ~10行 |

**预计修改：** 约 21 行代码

---

## ⏱️ 时间估算

| 任务 | 预计时间 |
|------|---------|
| 修改 Pallet 代码 | 30-45 分钟 |
| 修改前端代码 | 10-15 分钟 |
| 编译测试 | 15-20 分钟 |
| **总计** | **55-80 分钟** |

---

## ⚠️ 注意事项

### 数据迁移

**⚠️ 重要：此修改会导致存储结构不兼容！**

如果链上已有数据，必须：
1. 备份现有数据
2. 清除链数据：`./target/release/stardust-node purge-chain --dev -y`
3. 重新创建所有八字记录

### 测试建议

1. **先在开发链测试**
   - 使用 `--dev` 模式
   - 使用 Alice 账户测试

2. **完整功能测试**
   - 八字排盘
   - 保存到链上
   - AI智能解盘
   - 查询历史记录

3. **压力测试**
   - 创建多个八字记录
   - 验证ID递增正确
   - 验证用户列表正确

---

## 🚀 执行计划

### 立即执行

```bash
# 1. 创建备份分支
cd /home/xiaodong/文档/stardust
git checkout -b feature/bazi-id-migration

# 2. 执行修改（按照上述步骤）

# 3. 编译测试
cargo build --release -p pallet-bazi-chart
cargo build --release -p stardust-runtime
cargo build --release -p stardust-node

# 4. 清除链数据并重启
pkill stardust-node
./target/release/stardust-node purge-chain --dev -y
./target/release/stardust-node --dev --rpc-external --rpc-port 9944 --rpc-cors=all --tmp

# 5. 前端测试
cd stardust-dapp
npm run dev
# 访问 http://localhost:5173/#/bazi 测试
```

---

## ✅ 预期结果

修改完成后：

1. ✅ 八字保存返回递增ID（0, 1, 2...）
2. ✅ AI解读能找到对应的八字记录
3. ✅ 前端逻辑简化，不需要 Hash 转换
4. ✅ 与其他占卜模块设计一致

---

**创建时间**: 2025-12-07
**预计完成时间**: 1 小时内
**状态**: 📝 规划完成，待执行
