# 八字AI解盘功能 - 快速启动指南

## 问题诊断

**错误信息**: `保存失败: 区块链节点未包含八字命理模块（pallet-bazi-chart），请检查节点配置`

**原因**: 区块链节点没有加载最新的 runtime，缺少 `pallet-bazi-chart` 模块。

## 解决方案

### 1. 重新编译并启动区块链节点

```bash
# 1. 进入项目根目录
cd /home/xiaodong/文档/stardust

# 2. 重新编译 runtime 和节点（确保包含 BaziChart pallet）
cargo build --release --bin stardust-node

# 3. 清除旧的链数据（可选，如果遇到兼容性问题）
./target/release/stardust-node purge-chain --dev -y

# 4. 启动开发节点
./target/release/stardust-node --dev
```

### 2. 启动 xuanxue-oracle 节点

在另一个终端：
```bash
cd /home/xiaodong/文档/stardust/xuanxue-oracle
./start.sh
```

### 3. 启动前端开发服务器

在第三个终端：
```bash
cd /home/xiaodong/文档/stardust/stardust-dapp
npm run dev
```

## 验证步骤

### 1. 检查 BaziChart Pallet 是否加载

访问 Polkadot.js Apps: https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944#/extrinsics

检查：
- Developer → Extrinsics → 选择 "baziChart"
- 应该能看到 `createChart` 等方法

### 2. 测试八字排盘流程

1. 打开前端: http://localhost:5173/#/bazi
2. 连接钱包
3. 输入出生信息并排盘
4. 点击"保存到链上"
5. 成功后点击"AI智能解盘"

## Runtime 配置确认

已确认 runtime 配置正确：

### runtime/src/lib.rs (line 707)
```rust
#[runtime::pallet_index(71)]
pub type BaziChart = pallet_bazi_chart;
```

### runtime/Cargo.toml (line 102)
```toml
pallet-bazi-chart = { path = "../pallets/divination/bazi", default-features = false }
```

### runtime/src/configs/mod.rs (line 3920)
```rust
impl pallet_bazi_chart::Config for Runtime {
    type WeightInfo = ();
    // ... 其他配置
}
```

## 常见问题排查

### Q1: 编译失败
**A**: 检查 Rust 工具链版本
```bash
rustup update stable
cargo --version  # 应该是 1.70+
```

### Q2: 节点启动后前端仍然报错
**A**: 清除浏览器缓存并刷新页面
```bash
# Chrome/Edge: Ctrl+Shift+Delete → 清除缓存
# Firefox: Ctrl+Shift+Delete → 清除缓存
```

### Q3: Oracle 节点无法连接
**A**: 检查 .env 配置
```bash
cd xuanxue-oracle
cat .env | grep CHAIN_WS_ENDPOINT
# 应该是: CHAIN_WS_ENDPOINT=ws://127.0.0.1:9944
```

### Q4: AI解读一直处于"处理中"
**A**: 检查 Oracle 节点日志
```bash
# 查看 Oracle 节点输出
# 应该能看到 "InterpretationRequested" 事件被捕获
```

## 系统架构

```
┌─────────────────┐
│  前端 DApp      │
│  (localhost:5173)│
│                 │
│  BaziPage.tsx   │
└────────┬────────┘
         │
         │ 1. createChart
         │ 2. requestInterpretation
         ▼
┌─────────────────┐
│  区块链节点      │
│  (localhost:9944)│
│                 │
│  BaziChart      │←─┐
│  DivinationAi   │  │
└────────┬────────┘  │
         │           │
         │ 3. Event │ 5. submitResult
         │           │
         ▼           │
┌─────────────────┐  │
│  Oracle 节点    │──┘
│  (xuanxue-oracle)│
│                 │
│  + DeepSeek AI  │
│  + 知识库       │
│  + IPFS        │
└─────────────────┘
```

## 完整流程

1. **用户排盘** → BaziPage.tsx
2. **保存到链** → `baziChart.createChart()` → 生成 chartId
3. **请求AI解读** → `divinationAi.requestInterpretation()` → 生成 requestId
4. **Oracle监听** → xuanxue-oracle 捕获 `InterpretationRequested` 事件
5. **AI处理** → DeepSeek + 知识库 → 生成解读
6. **上传IPFS** → 获得 contentCid
7. **提交结果** → `divinationAi.submitResult()` → 写入链上
8. **前端轮询** → 检测到 status=Completed
9. **跳转展示** → InterpretationResultPage 显示结果

## 性能优化建议

### 节点优化
```bash
# 增加数据库缓存
./target/release/stardust-node --dev \
  --db-cache 4096 \
  --state-cache-size 2048
```

### Oracle 优化
```toml
# .env 文件
RUST_LOG=info,xuanxue_oracle=debug
```

### 前端优化
- 使用 WebSocket 推送替代轮询（未来版本）
- 实现结果缓存

## 日志级别

### 区块链节点
```bash
# 查看详细日志
RUST_LOG=debug ./target/release/stardust-node --dev

# 只看 BaziChart 和 DivinationAi
RUST_LOG=runtime::bazi_chart=debug,runtime::divination_ai=debug \
  ./target/release/stardust-node --dev
```

### Oracle 节点
```bash
# 修改 .env
RUST_LOG=info,xuanxue_oracle=debug
```

## 端口占用检查

```bash
# 检查 9944 端口（区块链 RPC）
lsof -i :9944

# 检查 5173 端口（前端）
lsof -i :5173

# 如果被占用，杀死进程
kill -9 <PID>
```

## 数据目录

- 区块链数据: `/tmp/substrate<random>/chains/dev/`
- Oracle 缓存: `xuanxue-oracle/data/cache/`
- 前端缓存: 浏览器 LocalStorage

## 重置环境

```bash
# 完全重置开发环境
cd /home/xiaodong/文档/stardust

# 1. 停止所有进程
pkill -9 stardust-node
pkill -9 xuanxue-oracle

# 2. 清除链数据
./target/release/stardust-node purge-chain --dev -y

# 3. 清除 Oracle 缓存
rm -rf xuanxue-oracle/data/cache/*

# 4. 重新编译
cargo clean
cargo build --release

# 5. 重新启动
./target/release/stardust-node --dev &
cd xuanxue-oracle && ./start.sh &
cd ../stardust-dapp && npm run dev
```

---

**创建时间**: 2025-12-07
**版本**: v1.0
**状态**: ✅ 已验证配置正确，等待节点编译完成
