# 主逝者功能基准测试指南

## 📋 概述

本指南说明如何运行`pallet-stardust-grave`中主逝者功能的性能基准测试。

## 🔧 前置要求

1. Rust工具链已安装
2. 项目已配置`runtime-benchmarks` feature
3. 节点已编译

## 🚀 运行基准测试

### 1. 编译带基准测试功能的节点

```bash
cargo build --release --features runtime-benchmarks
```

### 2. 运行主逝者功能基准测试

#### 完整基准测试

```bash
./target/release/solochain-template-node benchmark pallet \
    --chain=dev \
    --execution=wasm \
    --wasm-execution=compiled \
    --pallet=pallet_stardust_grave \
    --extrinsic="set_primary_deceased*" \
    --steps=50 \
    --repeat=20 \
    --output=./pallets/stardust-grave/src/weights.rs \
    --template=.maintain/frame-weight-template.hbs
```

#### 快速测试（减少重复次数）

```bash
./target/release/solochain-template-node benchmark pallet \
    --chain=dev \
    --execution=wasm \
    --wasm-execution=compiled \
    --pallet=pallet_stardust_grave \
    --extrinsic="set_primary_deceased*" \
    --steps=20 \
    --repeat=5
```

### 3. 测试单个基准场景

```bash
# 测试首次设置主逝者场景
./target/release/solochain-template-node benchmark pallet \
    --chain=dev \
    --pallet=pallet_stardust_grave \
    --extrinsic="set_primary_deceased_first_time" \
    --steps=50 \
    --repeat=20
```

## 📊 基准测试场景

| 场景名称 | 描述 | 变量 |
|---------|------|------|
| `set_primary_deceased_first_time` | 首次设置主逝者 | - |
| `set_primary_deceased_switch` | 切换主逝者 | - |
| `set_primary_deceased_clear` | 清除主逝者 | - |
| `set_primary_deceased_by_admin` | 管理员操作 | - |
| `set_primary_deceased_many_interments` | 大量安葬记录 | i: 1..100 |
| `set_primary_deceased_many_admins` | 多管理员 | a: 1..10 |
| `set_primary_deceased_idempotent` | 幂等性测试 | - |
| `set_primary_deceased_clear_empty` | 清除空状态 | - |

## 🔍 解读基准测试结果

### 输出格式

```
Running Benchmark: pallet_stardust_grave::set_primary_deceased_first_time
Median Slopes Analysis
========================================
-- Extrinsic Time --

Time ~=    230.00
    + r    0.000
             µs

Reads = 3 + (0 * r)
Writes = 1 + (0 * r)
```

### 关键指标

- **Time (µs)**: 操作执行时间（微秒）
- **Reads**: 数据库读取次数
- **Writes**: 数据库写入次数

### 预期结果

对于主逝者功能：
- **基础权重**: ~20,000 ref_time
- **数据库读取**: 3次
- **数据库写入**: 1次
- **总权重**: ~230,000 ref_time（含安全边际）

## 🧪 验证权重实现

运行测试确保权重实现正确：

```bash
# 检查编译（不带benchmarking）
cargo check -p pallet-stardust-grave

# 检查编译（带benchmarking）
cargo check -p pallet-stardust-grave --features runtime-benchmarks

# 运行单元测试
cargo test -p pallet-stardust-grave
```

## 📝 更新权重

如果基准测试结果显示权重需要调整：

1. 查看基准测试输出的中位数时间
2. 更新`pallets/stardust-grave/src/weights.rs`中的`SubstrateWeight`实现
3. 重新编译并测试
4. 提交权重更新

## 🐛 故障排除

### 错误：`runtime-benchmarks` feature未启用

**解决方案**：
```bash
cargo build --release --features runtime-benchmarks
```

### 错误：节点无法启动

**检查**：
1. 确保没有其他节点实例在运行
2. 检查端口9944和30333是否被占用
3. 清除旧的链数据：`./target/release/solochain-template-node purge-chain --dev`

### 错误：基准测试失败

**调试**：
```bash
# 查看详细日志
RUST_LOG=debug ./target/release/solochain-template-node benchmark pallet \
    --chain=dev \
    --pallet=pallet_stardust_grave \
    --extrinsic="set_primary_deceased*"
```

## 📚 相关文档

- [主逝者功能完整实现报告](./PRIMARY_DECEASED_IMPLEMENTATION_COMPLETE.md)
- [Frame Benchmarking官方文档](https://docs.substrate.io/reference/how-to-guides/weights/add-benchmarks/)
- [Pallet权重最佳实践](https://docs.substrate.io/build/tx-weights-fees/)

## 🎯 下一步

完成基准测试后：

1. ✅ 验证权重值合理性
2. ✅ 在测试网络验证性能
3. ✅ 监控生产环境实际性能
4. ✅ 根据实际使用调整权重

---

**最后更新**: 2025-11-10
**版本**: 1.0.0
