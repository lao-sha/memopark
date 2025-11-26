# Pallet Bazi Chart (八字排盘 Pallet)

完整的中国传统命理八字排盘区块链模块，基于 Substrate FRAME 框架开发。

## 功能特性

### ✅ 已实现功能

- **基础架构**
  - ✅ 完整的数据类型定义（天干、地支、干支、五行、十神等）
  - ✅ 权威藏干查表（辰藏干使用"癸水"，符合主流派）
  - ✅ 纳音五行计算（30种纳音）
  - ✅ 十神查表系统
  - ✅ 子时双模式支持（传统派/现代派）

- **常量表**
  - ✅ 12地支藏干表（含权重）
  - ✅ 60甲子纳音表
  - ✅ 10×10十神关系矩阵
  - ✅ 12×36月令权重矩阵（简化版）

- **测试系统**
  - ✅ 基础类型测试
  - ✅ 常量表验证测试
  - ✅ 关键算法测试（辰藏干、纳音、十神）

### 🚧 待实现功能

- **Phase 3**: 核心计算模块
  - ⏳ 日柱计算
  - ⏳ 年柱计算
  - ⏳ 月柱计算（五虎遁）
  - ⏳ 时柱计算（五鼠遁 + 子时双模式）

- **Phase 4**: 大运计算
  - ⏳ 起运年龄计算
  - ⏳ 大运序列生成

- **Phase 5**: 五行分析
  - ⏳ 五行强度计算（月令旺衰法）
  - ⏳ 喜用神判断

- **Phase 6**: 存储和接口
  - ⏳ create_bazi_chart 完整实现
  - ⏳ delete_bazi_chart 实现
  - ⏳ 事件触发

## 技术规格

### 关键确认

1. **辰地支藏干**: ✅ 使用"戊乙癸"（主流派，87.5%项目支持）
2. **子时归属**: ✅ 支持传统派和现代派双模式
3. **节气精度**: 🚧 计划使用寿星天文算法（秒级精度）
4. **五行强度**: 🚧 计划实现BaziGo的月令权重矩阵

### 参考项目

- **BaziGo** (95/100) - 五行强度算法、藏干权重表
- **lunar-java** (93/100) - 节气算法、数据结构设计
- **bazi-mcp** (92/100) - 子时双模式、API设计

## 使用示例

```rust
use pallet_bazi_chart::{Gender, ZiShiMode};

// 创建八字（现代派子时模式）
BaziChart::create_bazi_chart(
    origin,
    1998,             // 年份
    7,                // 月份
    31,               // 日期
    14,               // 小时
    10,               // 分钟
    Gender::Male,     // 性别
    ZiShiMode::Modern, // 子时模式
)?;
```

## 配置参数

```rust
parameter_types! {
    pub const MaxChartsPerAccount: u32 = 10;   // 每个账户最多10个八字
    pub const MaxDaYunSteps: u32 = 12;         // 大运最多12步（120年）
    pub const MaxCangGan: u32 = 3;             // 每个地支最多3个藏干
}
```

## 测试

```bash
# 运行所有测试
cargo test -p pallet-bazi-chart

# 运行特定测试
cargo test -p pallet-bazi-chart test_chen_hidden_stems
```

### 关键测试用例

```rust
#[test]
fn test_chen_hidden_stems() {
    // ⚠️ 关键测试：确保辰藏干为"癸水"
    let chen = DiZhi(4);
    let stems = get_hidden_stems(chen);
    assert_eq!(stems[2].0 .0, 9); // 癸 (不是壬!)
}
```

## 开发状态

### 里程碑

- **Milestone 1** (当前): ✅ 基础架构完成
- **Milestone 2**: 🚧 核心算法开发中
- **Milestone 3**: ⏳ 测试验证
- **Milestone 4**: ⏳ 系统集成

### 完成进度

- Phase 1: 基础架构 ✅ 100%
- Phase 2: 常量表 ✅ 100%
- Phase 3: 核心计算 ⏳ 0%
- Phase 4: 大运计算 ⏳ 0%
- Phase 5: 五行分析 ⏳ 0%
- Phase 6: 接口实现 ⏳ 0%

**总体进度**: 约 33% (Phase 1-2 完成)

## 文档参考

- [八字排盘项目综合分析报告](../../八字排盘项目综合分析报告.md)
- [八字排盘Pallet详细设计文档](../../docs/八字排盘Pallet详细设计文档.md)
- [Pallet开发计划](../../pallet-bazi-chart-development-plan.md)

## 许可证

MIT-0

## 贡献

欢迎贡献代码和改进建议！请参考 [开发计划](../../pallet-bazi-chart-development-plan.md) 了解待实现的功能。

---

**创建日期**: 2025-11-25
**当前版本**: v0.1.0
**维护团队**: Stardust 开发团队
