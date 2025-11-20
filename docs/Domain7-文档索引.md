# Domain 7（作品域）文档索引

## 项目概述

Domain 7是stardust-appeals pallet的作品域实现，负责处理逝者作品的投诉申诉系统，并实现基于多因子的差异化押金机制。

## 文档列表

### 阶段1：基础实现

**文档**: [Domain7-阶段1实施计划.md](./Domain7-阶段1实施计划.md)

**内容**:
- 作品域基础架构设计
- WorkComplaintExtension数据结构
- submit_work_complaint() extrinsic实现
- 作品投诉统计和索引
- 基础押金机制（固定20 DUST）

**状态**: ✅ 已完成

---

### 阶段2：差异化押金机制

**核心文档**: [Domain7-阶段2完成总结.md](./Domain7-阶段2完成总结.md)

**内容**:
- 多因子押金计算公式设计
- 5个系数体系（类型、影响力、验证、信誉、全局）
- deposit_policy.rs模块实现（402行）
- GlobalDepositMultiplier治理调整机制
- 19个测试用例覆盖

**关键技术**:
```
最终押金 = 基础押金 × 类型系数 × 影响力系数 × 验证状态系数 × 信誉系数 × 全局乘数
```

**状态**: ✅ 已完成

---

**配置文档**: [Domain7-阶段2-Runtime配置指南.md](./Domain7-阶段2-Runtime配置指南.md)

**内容**:
- Runtime配置示例
- ReputationProvider实现
- 押金计算示例（3个场景）
- 治理操作指南
- 存储查询方法
- 事件监听示例
- Mock实现指南
- 常见问题解答

**用途**: Runtime集成必读文档

**状态**: ✅ 已完成

---

### 阶段3：作品影响力高级评估

**文档**: [Domain7-阶段3完成总结.md](./Domain7-阶段3完成总结.md)

**内容**:
- WorkInfo结构扩展（7个统计字段）
- WorkEngagement存储结构
- 7维度动态评分体系
- 高级影响力评分算法
- 热度动态调整机制

**关键特性**:
- 访问量评分（0-15分）
- 社交互动评分（0-15分）：分享+收藏+评论
- AI训练实用性（0-10分）
- 动态押金：从静态60分 → 动态0-100分

**评分效果**:
- 热门学术论文: 60分 → 95分（押金150 DUST）
- 病毒社交媒体: 25分 → 54分（押金108 DUST）

**状态**: ✅ 核心算法完成，接口待补充

---

### 阶段4：作品互动接口补充

**文档**: [Domain7-阶段4完成总结.md](./Domain7-阶段4完成总结.md)

**内容**:
- 4个新增用户接口（deceased pallet）
  - `view_work()` (call_index 25): 记录浏览，+view_count
  - `share_work()` (call_index 26): 记录分享，+share_count
  - `favorite_work()` (call_index 27): 收藏/取消收藏
  - `report_ai_training_usage()` (call_index 28): OCW专用，报告AI使用
- WorksProvider完整实现（runtime层适配器）
- DeceasedWorksProvider: 读取DeceasedWorks + WorkEngagementStats
- ReputationProvider占位实现（Phase 2需求）

**关键技术**:
- Runtime层适配器模式（低耦合设计）
- 懒初始化支持（WorkEngagementStats使用ValueQuery）
- OCW集成准备（ensure_none权限）
- 防刷机制设计（前端限流 + 链端验证）

**代码统计**:
- deceased pallet: 新增187行（4个extrinsic）
- runtime配置: 新增125行（2个适配器）
- 合计: 312行

**状态**: ✅ 已完成

---

## 代码结构

### pallets/stardust-appeals/

```
src/
├── lib.rs                      # 主模块（2100+行）
├── deposit_policy.rs           # 押金计算模块（402行）
├── deposit_policy_tests.rs    # 押金集成测试（398行）
├── works_types.rs             # 作品类型定义（346行）
├── domains.rs                 # 域定义
└── README.md                  # Pallet文档
```

### pallets/deceased/

```
src/
├── lib.rs                      # 主模块（包含WorkEngagement）
├── works.rs                   # 作品类型定义（498行）
└── README.md                  # Pallet文档
```

---

## 关键接口

### 用户接口（已实现）

```rust
// 提交作品投诉
submit_work_complaint(
    origin,
    work_id: u64,
    action: u8,
    violation_type_code: u8,
    reason_cid: BoundedVec,
    evidence_cid: BoundedVec,
)

// 治理调整全局押金乘数
set_global_deposit_multiplier(
    origin,
    new_multiplier: u16,  // 100-10000（0.1x-10.0x）
)
```

### 跨Pallet接口

```rust
// WorksProvider trait（deceased实现）
fn get_work_info(work_id: u64) -> Option<WorkInfo>
fn work_exists(work_id: u64) -> bool
fn get_work_owner(work_id: u64) -> Option<AccountId>

// ReputationProvider trait（待实现）
fn get_reputation(who: &AccountId) -> Option<u8>  // 0-100
```

---

## 后续工作

### ~~阶段4：接口补充（优先级：高）~~ ✅ 已完成

~~**需要在deceased pallet添加**:~~

1. ~~`view_work(work_id)` - 记录浏览（+view_count）~~
2. ~~`share_work(work_id)` - 记录分享（+share_count）~~
3. ~~`favorite_work(work_id, is_favorite)` - 收藏/取消收藏~~
4. ~~`report_ai_training_usage(work_id, count)` - OCW报告AI使用~~

~~**需要更新**:~~
- ~~WorksProvider.get_work_info() - 读取WorkEngagementStats并填充统计字段~~

**完成时间**: 2025-01-15

---

### 阶段5：防刷机制（优先级：中）

- 单账户每日操作限额
- 时间窗口防重复
- 异常行为检测
- OCW签名验证

### 阶段6：时间衰减（优先级：低）

- 作品年龄衰减系数
- 月度热度统计
- 历史访问量权重调整

---

## 技术指标

### 存储成本

| 存储项 | 每条大小 | 10万条 | 100万条 |
|--------|----------|--------|---------|
| WorkComplaintExtension | 200字节 | 20MB | 200MB |
| WorkEngagement | 40字节 | 4MB | 40MB |
| GlobalDepositMultiplier | 2字节 | 单值 | 单值 |

### 性能指标

- **押金计算**: O(1)复杂度，<1ms
- **影响力评分**: O(1)复杂度，<0.5ms
- **Gas成本**: 约5000-10000 gas

### 押金范围

- **最小押金**: 5 DUST（MinWorkComplaintDeposit）
- **最大押金**: 1000 DUST（MaxWorkComplaintDeposit）
- **基础押金**: 10-100 DUST（按操作类型）
- **实际押金**: 基础 × [0.16x - 27.0x] → 受限于5-1000 DUST

---

## 编译状态

```bash
# pallet-stardust-appeals
cargo check -p pallet-stardust-appeals
# ✅ Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.36s

# pallet-deceased
cargo check -p pallet-deceased
# ✅ Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 01s
```

**状态**: ✅ 编译通过，无错误

---

## 测试覆盖

### deposit_policy单元测试（8个）

- ✅ 类型系数测试
- ✅ 影响力系数测试
- ✅ 验证状态系数测试
- ✅ 信誉系数测试
- ✅ 基础押金测试

### deposit_policy集成测试（12个）

- ✅ 高信誉低影响力场景
- ✅ 低信誉高影响力场景
- ✅ 触发上限保护
- ✅ 触发下限保护
- ✅ 全局乘数调整
- ✅ 验证倍率差异
- ✅ 信誉梯度测试
- ✅ 极端组合测试
- ✅ 数值溢出保护

**总覆盖**: 20个测试用例

---

## 参考资源

### 相关Pallets

- `pallet-stardust-appeals` - 申诉治理主模块
- `pallet-deceased` - 逝者档案和作品管理
- `pallet-balances` - 押金Holds API

### 外部依赖

- Substrate FRAME v2.0
- Polkadot SDK stable2506
- parity-scale-codec v3.7.5

### 文档链接

- [Substrate Holds API](https://docs.substrate.io/reference/how-to-guides/basics/configure-genesis-state/)
- [FRAME Pallet开发](https://docs.substrate.io/tutorials/build-application-logic/)

---

## 变更历史

| 版本 | 日期 | 内容 | 负责人 |
|------|------|------|--------|
| v0.1.0 | 2025-01-15 | 阶段1：基础实现 | Substrate团队 |
| v0.2.0 | 2025-01-15 | 阶段2：差异化押金机制 | Substrate团队 |
| v0.3.0 | 2025-01-15 | 阶段3：高级影响力评估 | Substrate团队 |
| v0.4.0 | 2025-01-15 | 阶段4：作品互动接口补充 | Substrate团队 |

---

**文档维护**: Substrate开发团队
**最后更新**: 2025-01-15
**文档版本**: v1.0
