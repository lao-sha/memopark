# Pallet-Deceased 查询接口设计方案

## 概述

本文档详细分析并设计了链端逝者查询接口的完整解决方案，包括6个核心查询接口的技术实现、存储优化和分阶段实施建议。

## 项目背景

当前 `pallet-deceased` 作为 Stardust 纪念园系统的核心模块，需要支持多种查询场景：
- 单个逝者详情查询
- 分页浏览所有逝者
- 按分类筛选（英雄、烈士、历史人物等）
- 按时间排序浏览
- 按生日查询纪念需求
- 通过唯一token标识查询

## 现状分析

### 当前 Pallet 结构

基于对 `pallets/deceased/src/lib.rs` 的代码分析，当前结构包含：

**存储结构**：
- `DeceasedOf<T>`：存储逝者详情（DeceasedId -> Deceased）
- `DeceasedIdByToken<T>`：按token查询逝者ID
- `CategoryOf<T>`：存储逝者分类信息
- `NextDeceasedId<T>`：递增计数器

**分类枚举**：
```rust
pub enum DeceasedCategory {
    Ordinary = 0,        // 普通民众
    HistoricalFigure = 1, // 历史人物
    Martyr = 2,          // 革命烈士
    Hero = 3,            // 英雄模范
    PublicFigure = 4,    // 公众人物
    ReligiousFigure = 5, // 宗教人物
    EventHall = 6,       // 事件馆
}
```

**现有查询能力**：
- 通过DeceasedId单点查询：`DeceasedOf::get(id)`
- 通过token查询ID：`DeceasedIdByToken::get(token)`

## 需求接口分析

| 接口 | 合理性 | 可行性 | 技术难度 | 存储成本 | 优先级 |
|------|--------|--------|----------|----------|---------|
| 查询单个逝者 | ✅ 高 | ✅ 高 | 低 | 无 | 高 |
| 分页查询所有逝者 | ✅ 高 | ✅ 高 | 中 | 无 | 高 |
| 按逝者类型分页查询 | ✅ 高 | ✅ 高 | 中 | 需索引 | 高 |
| 按创建时间分页查询 | ✅ 高 | ✅ 中 | 中 | 需索引 | 中 |
| 按最近生日分页查询 | ❓ 中 | ❓ 中 | 高 | 需索引 | 低 |
| 按token查询逝者 | ✅ 高 | ✅ 高 | 低 | 已有 | 高 |

## 技术设计方案

### 1. 核心查询接口设计

#### 1.1 查询单个逝者

```rust
/// 函数级详细中文注释：查询单个逝者详情（公开查询接口）
///
/// ### 功能说明
/// - 根据逝者ID查询完整的逝者信息
/// - 自动处理权限检查和可见性验证
/// - 支持前端单点查询需求
///
/// ### 参数
/// - `deceased_id`: 逝者ID
///
/// ### 返回
/// - `Some(Deceased)`: 查询成功，返回逝者详情
/// - `None`: 逝者不存在或无查看权限
pub fn get_deceased_by_id(deceased_id: T::DeceasedId) -> Option<Deceased<T>> {
    // 检查逝者是否存在
    let deceased = DeceasedOf::<T>::get(deceased_id)?;

    // 检查可见性（公开 or 权限验证）
    if Self::is_deceased_visible(deceased_id) {
        Some(deceased)
    } else {
        None
    }
}
```

#### 1.2 分页查询所有逝者

```rust
/// 函数级详细中文注释：分页查询所有逝者（公开查询接口）
///
/// ### 功能说明
/// - 按ID升序返回所有可见逝者
/// - 支持分页查询，避免单次查询过大
/// - 自动过滤不可见或已删除的逝者
///
/// ### 参数
/// - `start_id`: 起始逝者ID（包含）
/// - `limit`: 每页数量限制（最大100）
///
/// ### 返回
/// - `Vec<(DeceasedId, Deceased)>`: 逝者ID和详情的配对列表
pub fn get_deceased_paginated(
    start_id: Option<T::DeceasedId>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)> {
    let limit = limit.min(100); // 限制单次查询量
    let start = start_id.unwrap_or(T::DeceasedId::from(1u32));
    let mut results = Vec::new();
    let mut current_id = start;
    let mut count = 0;

    while count < limit {
        if let Some(deceased) = DeceasedOf::<T>::get(current_id) {
            // 检查可见性
            if Self::is_deceased_visible(current_id) {
                results.push((current_id, deceased));
                count += 1;
            }
        }

        // 递增查找下一个ID
        if let Some(next_id) = current_id.checked_add(&T::DeceasedId::from(1u32)) {
            current_id = next_id;
        } else {
            break; // ID溢出，结束查询
        }

        // 防止无限循环：检查是否超过最大ID
        if u64::from(current_id) >= u64::from(NextDeceasedId::<T>::get()) {
            break;
        }
    }

    results
}
```

#### 1.3 按类型分页查询逝者

```rust
/// 函数级详细中文注释：按类型分页查询逝者（公开查询接口）
///
/// ### 功能说明
/// - 根据逝者分类筛选并分页返回
/// - 支持英雄、烈士、历史人物等分类查询
/// - 适用于纪念馆分类浏览功能
///
/// ### 参数
/// - `category`: 逝者分类枚举
/// - `start_id`: 起始逝者ID（可选）
/// - `limit`: 每页数量限制（最大50）
///
/// ### 返回
/// - `Vec<(DeceasedId, Deceased)>`: 符合分类的逝者列表
pub fn get_deceased_by_category(
    category: DeceasedCategory,
    start_id: Option<T::DeceasedId>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)> {
    let limit = limit.min(50); // 分类查询限制更小
    let start = start_id.unwrap_or(T::DeceasedId::from(1u32));
    let mut results = Vec::new();
    let mut current_id = start;
    let mut count = 0;

    while count < limit {
        // 检查逝者是否存在且属于指定分类
        if let Some(deceased_category) = CategoryOf::<T>::get(current_id) {
            if deceased_category == category {
                if let Some(deceased) = DeceasedOf::<T>::get(current_id) {
                    if Self::is_deceased_visible(current_id) {
                        results.push((current_id, deceased));
                        count += 1;
                    }
                }
            }
        }

        // 递增查找
        if let Some(next_id) = current_id.checked_add(&T::DeceasedId::from(1u32)) {
            current_id = next_id;
        } else {
            break;
        }

        if u64::from(current_id) >= u64::from(NextDeceasedId::<T>::get()) {
            break;
        }
    }

    results
}
```

#### 1.4 按token查询逝者

```rust
/// 函数级详细中文注释：按token查询逝者（已有接口的封装）
///
/// ### 功能说明
/// - 根据唯一token标识查询逝者
/// - 复用现有的 DeceasedIdByToken 存储
/// - 支持外部系统通过token集成
///
/// ### 参数
/// - `token`: 逝者的唯一标识token
///
/// ### 返回
/// - `Some((DeceasedId, Deceased))`: 查询成功
/// - `None`: token不存在或无查看权限
pub fn get_deceased_by_token(token: &[u8]) -> Option<(T::DeceasedId, Deceased<T>)> {
    let bounded_token = BoundedVec::try_from(token.to_vec()).ok()?;
    let deceased_id = DeceasedIdByToken::<T>::get(&bounded_token)?;
    let deceased = Self::get_deceased_by_id(deceased_id)?;
    Some((deceased_id, deceased))
}
```

#### 1.5 按创建时间分页查询

```rust
/// 函数级详细中文注释：按创建时间分页查询逝者（支持时间排序）
///
/// ### 功能说明
/// - 按创建时间倒序返回逝者（最新的在前）
/// - 支持时间范围筛选和分页查询
/// - 适用于"最新逝者"、"近期纪念"等功能
///
/// ### 参数
/// - `start_block`: 起始区块号（可选，默认当前块）
/// - `limit`: 返回数量限制（最大20）
///
/// ### 返回
/// - `Vec<(DeceasedId, Deceased, BlockNumber)>`: 逝者信息及创建时间
pub fn get_deceased_by_creation_time(
    start_block: Option<BlockNumberFor<T>>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>, BlockNumberFor<T>)> {
    let limit = limit.min(20);
    let mut results = Vec::new();
    let current_block = frame_system::Pallet::<T>::block_number();
    let start = start_block.unwrap_or(current_block);
    let mut count = 0;
    let mut block_num = start;

    // 从指定区块开始往前查找
    while count < limit && block_num > Zero::zero() {
        let deceased_ids = DeceasedByCreationTime::<T>::get(block_num);

        // 倒序遍历该区块的逝者（最新的在前）
        for deceased_id in deceased_ids.iter().rev() {
            if count >= limit { break; }

            if let Some(deceased) = DeceasedOf::<T>::get(deceased_id) {
                if Self::is_deceased_visible(*deceased_id) {
                    results.push((*deceased_id, deceased, block_num));
                    count += 1;
                }
            }
        }

        // 查找前一个区块
        block_num = block_num.saturating_sub(One::one());
    }

    results
}
```

#### 1.6 按生日查询接口（可选实现）

```rust
/// 函数级详细中文注释：按生日月份查询逝者（计算型查询）
///
/// ### 注意
/// - 这是计算密集型查询，建议在后台任务中执行
/// - 不建议频繁调用，可配合缓存使用
/// - 生日信息从逝者的生平或媒体数据中提取
///
/// ### 参数
/// - `month`: 目标月份（1-12）
/// - `limit`: 返回数量限制（最大10）
///
/// ### 返回
/// - `Vec<(DeceasedId, Deceased)>`: 该月份有生日的逝者
pub fn get_deceased_by_birthday_month(month: u8, limit: u32) -> Vec<(T::DeceasedId, Deceased<T>)> {
    if month < 1 || month > 12 {
        return Vec::new();
    }

    let limit = limit.min(10);
    let mut results = Vec::new();
    let mut count = 0;
    let max_id = NextDeceasedId::<T>::get();

    // 遍历所有逝者（性能开销大，建议后台执行）
    for id in 1..u64::from(max_id) {
        if count >= limit { break; }

        let deceased_id = T::DeceasedId::from(id as u32);
        if let Some(deceased) = DeceasedOf::<T>::get(deceased_id) {
            if Self::is_deceased_visible(deceased_id) {
                // 检查是否有生日信息匹配（需要从text/media数据中提取）
                if Self::has_birthday_in_month(deceased_id, month) {
                    results.push((deceased_id, deceased));
                    count += 1;
                }
            }
        }
    }

    results
}

/// 内部辅助函数：检查逝者是否在指定月份有生日
fn has_birthday_in_month(deceased_id: T::DeceasedId, month: u8) -> bool {
    // TODO: 实现生日信息提取逻辑
    // 1. 从Lives存储中查找生平信息
    // 2. 解析生日字段（如果有）
    // 3. 匹配目标月份
    false // 暂时返回false，待具体实现
}
```

### 2. 新增存储索引设计

#### 2.1 按分类索引

```rust
/// 函数级详细中文注释：按分类索引逝者（优化分类查询性能）
/// - Key: DeceasedCategory
/// - Value: Vec<DeceasedId> (最多1000个，超出后停止添加)
/// - 用途：快速分类查询，避免全表扫描
#[pallet::storage]
pub type DeceasedByCategory<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    DeceasedCategory,
    BoundedVec<T::DeceasedId, ConstU32<1000>>,
    ValueQuery,
>;
```

#### 2.2 按创建时间索引

```rust
/// 函数级详细中文注释：按创建时间索引逝者（支持时间排序查询）
/// - Key: BlockNumber（创建时的区块号）
/// - Value: Vec<DeceasedId>（该区块创建的所有逝者）
/// - 用途：按时间顺序浏览逝者，支持"最新"、"历史"等排序
#[pallet::storage]
pub type DeceasedByCreationTime<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BlockNumberFor<T>,
    BoundedVec<T::DeceasedId, ConstU32<100>>, // 单个区块最多100个逝者
    ValueQuery,
>;
```

## 实施方案

### 阶段1：基础查询接口（高优先级）

**目标**：实现核心查询功能，满足基本使用需求

**实施内容**：
- [ ] 实现 `get_deceased_by_id()` - 单个查询
- [ ] 实现 `get_deceased_by_token()` - token查询
- [ ] 实现 `get_deceased_paginated()` - 基础分页查询
- [ ] 添加对应的单元测试
- [ ] 更新pallet README文档

**时间估算**：1-2周
**技术风险**：低

### 阶段2：分类查询优化（中优先级）

**目标**：支持分类浏览功能，优化分类查询性能

**实施内容**：
- [ ] 实现 `get_deceased_by_category()` - 分类查询
- [ ] 添加 `DeceasedByCategory` 存储索引
- [ ] 在 `create_deceased` 函数中维护分类索引
- [ ] 添加分类索引的清理和维护逻辑
- [ ] 性能测试和优化

**时间估算**：2-3周
**技术风险**：中等（需要索引维护逻辑）

### 阶段3：时间查询功能（中优先级）

**目标**：支持按时间排序的浏览功能

**实施内容**：
- [ ] 实现 `get_deceased_by_creation_time()` - 时间查询
- [ ] 添加 `DeceasedByCreationTime` 存储索引
- [ ] 在创建逝者时维护时间索引
- [ ] 实现索引的清理策略（避免无限增长）
- [ ] 集成测试和性能验证

**时间估算**：2-3周
**技术风险**：中等（索引维护和清理策略）

### 阶段4：生日查询功能（低优先级）

**目标**：实现生日相关的纪念功能

**实施内容**：
- [ ] 分析生平数据中的生日信息格式
- [ ] 实现 `get_deceased_by_birthday_month()` - 生日查询
- [ ] 设计生日信息缓存策略
- [ ] 考虑实现生日索引（可选）
- [ ] 性能优化和缓存机制

**时间估算**：3-4周
**技术风险**：高（依赖生平数据结构，性能挑战大）

## 性能优化策略

### 1. 查询限制策略

- **分页查询限制**：单次最多100个结果
- **分类查询限制**：单次最多50个结果
- **时间查询限制**：单次最多20个结果
- **生日查询限制**：单次最多10个结果

### 2. 存储成本控制

- **索引大小限制**：使用BoundedVec限制索引条目数量
- **分类索引**：每个分类最多1000个逝者
- **时间索引**：每个区块最多100个逝者
- **自动清理**：实现过期索引的清理机制

### 3. 缓存策略

- **计算型查询**：生日查询等计算密集型操作建议配合缓存使用
- **结果缓存**：在应用层实现查询结果缓存
- **增量更新**：索引采用增量更新而非全量重建

## 权限与安全

### 1. 可见性控制

```rust
/// 检查逝者是否可见的辅助函数
fn is_deceased_visible(deceased_id: T::DeceasedId) -> bool {
    // 1. 检查逝者是否存在
    if DeceasedOf::<T>::get(deceased_id).is_none() {
        return false;
    }

    // 2. 检查可见性设置（默认公开）
    let visibility = VisibilityOf::<T>::get(deceased_id).unwrap_or(true);
    if !visibility {
        return false;
    }

    // 3. 其他权限检查...
    true
}
```

### 2. 防刷机制

- **查询频率限制**：防止恶意大量查询攻击
- **结果大小限制**：限制单次查询返回的结果数量
- **权限验证**：所有查询都经过权限检查

## 前端集成

### TypeScript API 接口

```typescript
// 前端API调用示例
const deceasedApi = {
  // 查询单个逝者
  getDeceased: (id: number) => polkadotApi.query.deceased.deceasedOf(id),

  // 分页查询所有逝者
  getDeceasedPaginated: (startId?: number, limit: number = 20) =>
    polkadotApi.rpc.deceased.getDeceasedPaginated(startId, limit),

  // 按分类查询
  getDeceasedByCategory: (category: DeceasedCategory, startId?: number, limit: number = 10) =>
    polkadotApi.rpc.deceased.getDeceasedByCategory(category, startId, limit),

  // 按创建时间查询
  getDeceasedByCreationTime: (startBlock?: number, limit: number = 10) =>
    polkadotApi.rpc.deceased.getDeceasedByCreationTime(startBlock, limit),

  // 按token查询
  getDeceasedByToken: (token: string) =>
    polkadotApi.rpc.deceased.getDeceasedByToken(token),

  // 按生日查询（可选）
  getDeceasedByBirthday: (month: number, limit: number = 5) =>
    polkadotApi.rpc.deceased.getDeceasedByBirthdayMonth(month, limit),
};
```

### React 组件示例

```tsx
// 逝者列表组件示例
const DeceasedList: React.FC = () => {
  const [deceased, setDeceased] = useState<Deceased[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadDeceased = async (category?: DeceasedCategory) => {
    setLoading(true);
    try {
      const result = category
        ? await deceasedApi.getDeceasedByCategory(category, undefined, 20)
        : await deceasedApi.getDeceasedPaginated(undefined, 20);
      setDeceased(result);
    } catch (error) {
      console.error('Failed to load deceased:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="deceased-list">
      {/* 分类筛选器 */}
      <CategoryFilter onCategoryChange={loadDeceased} />

      {/* 逝者列表 */}
      {loading ? <Spin /> : (
        <List
          dataSource={deceased}
          renderItem={(item) => <DeceasedCard deceased={item} />}
          pagination={{ current: currentPage, onChange: setCurrentPage }}
        />
      )}
    </div>
  );
};
```

## 测试策略

### 1. 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::mock::*;

    #[test]
    fn test_get_deceased_by_id() {
        new_test_ext().execute_with(|| {
            // 创建测试逝者
            let deceased_id = create_test_deceased();

            // 测试查询
            let result = Deceased::get_deceased_by_id(deceased_id);
            assert!(result.is_some());

            // 测试不存在的ID
            let invalid_result = Deceased::get_deceased_by_id(999u32.into());
            assert!(invalid_result.is_none());
        });
    }

    #[test]
    fn test_get_deceased_paginated() {
        new_test_ext().execute_with(|| {
            // 创建多个测试逝者
            for _ in 0..50 {
                create_test_deceased();
            }

            // 测试分页查询
            let page1 = Deceased::get_deceased_paginated(None, 20);
            assert_eq!(page1.len(), 20);

            let page2 = Deceased::get_deceased_paginated(Some(21u32.into()), 20);
            assert_eq!(page2.len(), 20);
        });
    }

    #[test]
    fn test_get_deceased_by_category() {
        new_test_ext().execute_with(|| {
            // 创建不同分类的逝者
            create_test_deceased_with_category(DeceasedCategory::Hero);
            create_test_deceased_with_category(DeceasedCategory::Martyr);
            create_test_deceased_with_category(DeceasedCategory::Hero);

            // 测试分类查询
            let heroes = Deceased::get_deceased_by_category(
                DeceasedCategory::Hero, None, 10
            );
            assert_eq!(heroes.len(), 2);

            let martyrs = Deceased::get_deceased_by_category(
                DeceasedCategory::Martyr, None, 10
            );
            assert_eq!(martyrs.len(), 1);
        });
    }
}
```

### 2. 集成测试

- **性能测试**：大量数据场景下的查询性能验证
- **并发测试**：多用户同时查询的场景测试
- **边界测试**：极限参数和异常情况的处理验证

### 3. 前端测试

- **API集成测试**：验证前端与链端接口的正确集成
- **UI组件测试**：查询组件的交互和显示测试
- **用户体验测试**：分页、筛选等功能的实际使用测试

## 监控与运维

### 1. 性能监控

- **查询延迟监控**：跟踪各类查询的响应时间
- **查询频率统计**：监控不同查询接口的使用频率
- **资源使用监控**：跟踪查询对链端资源的消耗

### 2. 索引维护

- **索引一致性检查**：定期验证索引数据的准确性
- **索引大小监控**：防止索引无限增长
- **自动清理机制**：过期和无效索引的自动清理

### 3. 错误处理

- **查询失败告警**：查询异常的实时告警
- **降级策略**：高负载时的查询限流和降级
- **恢复机制**：索引损坏时的自动重建

## 未来扩展

### 1. 高级查询功能

- **全文搜索**：基于逝者姓名、生平等内容的搜索
- **地理位置查询**：按地区筛选逝者
- **社交关系查询**：基于亲友关系的关联查询

### 2. 性能优化

- **分片存储**：大规模数据的分片存储策略
- **缓存层**：多层缓存的架构设计
- **异步查询**：复杂查询的异步处理机制

### 3. 数据分析

- **查询统计分析**：用户查询行为的数据分析
- **热点数据识别**：高频访问数据的优化
- **推荐算法**：基于查询历史的智能推荐

## 风险评估

| 风险类型 | 风险等级 | 影响范围 | 缓解措施 |
|----------|----------|----------|----------|
| 性能瓶颈 | 中 | 查询响应时间 | 分页限制、索引优化、缓存策略 |
| 存储膨胀 | 低 | 存储成本 | BoundedVec限制、自动清理 |
| 查询刷子 | 中 | 系统稳定性 | 频率限制、权限验证 |
| 索引不一致 | 低 | 数据准确性 | 一致性检查、自动修复 |
| 升级兼容 | 低 | 系统升级 | 版本兼容设计、迁移脚本 |

## 结论

本方案提供了完整的逝者查询接口设计，充分考虑了性能、安全、可扩展性等方面的需求。通过分阶段实施策略，可以逐步构建完善的查询能力，满足 Stardust 纪念园系统的各种使用场景。

建议优先实现阶段1的基础查询功能，然后根据实际使用情况和用户反馈，逐步推进后续阶段的开发工作。整体方案在技术上可行，风险可控，符合项目的长期发展规划。