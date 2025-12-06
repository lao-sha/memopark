# 🔧 链上集成完整操作指南

本文档提供从测试网启动到Oracle节点完全运行的详细步骤。

---

## 📋 前置条件检查

```bash
# 1. 检查Rust工具链
rustc --version  # 应该 >= 1.70

# 2. 检查subxt-cli安装
subxt --version || cargo install subxt-cli

# 3. 检查项目编译
cd /home/xiaodong/文档/stardust/xuanxue-oracle
cargo check

# 4. 检查配置文件
cat .env | grep -E "(DEEPSEEK_API_KEY|CHAIN_WS_ENDPOINT|ORACLE_ACCOUNT_SEED)"

# 5. 检查IPFS (可选，可以用Pinata)
curl -X POST http://localhost:5001/api/v0/version
```

---

## 🚀 步骤1: 启动测试网

### 方式1: 本地开发链 (推荐用于测试)

```bash
cd /home/xiaodong/文档/stardust

# 清理旧数据 (可选)
./target/release/solochain-template-node purge-chain --dev -y

# 启动开发链
./target/release/solochain-template-node --dev

# 或者指定数据目录
./target/release/solochain-template-node --dev --base-path ./my-chain-state/
```

**预期输出**:
```
2025-12-06 10:00:00 Substrate Node
2025-12-06 10:00:00 ✌️  version 4.0.0-dev-xxxxx
2025-12-06 10:00:00 ❤️  by Substrate DevHub, 2017-2024
2025-12-06 10:00:00 📋 Chain specification: Development
2025-12-06 10:00:00 🏷  Node name: xxx
2025-12-06 10:00:00 👤 Role: AUTHORITY
2025-12-06 10:00:00 💾 Database: RocksDb at ./my-chain-state/chains/dev/db/full
2025-12-06 10:00:00 ⛓  Native runtime: node-template-100
2025-12-06 10:00:00 🔨 Initializing Genesis block/state
2025-12-06 10:00:00 👴 Loading GRANDPA authority set from genesis
2025-12-06 10:00:00 Using default protocol ID "sup" because none is configured
2025-12-06 10:00:00 🏷  Local node identity is: 12D3KooWxxxxx
2025-12-06 10:00:00 💻 Operating system: linux
2025-12-06 10:00:00 💻 CPU architecture: x86_64
2025-12-06 10:00:00 📦 Highest known block at #0
2025-12-06 10:00:00 〽️ Prometheus exporter started at 127.0.0.1:9615
2025-12-06 10:00:00 Running JSON-RPC server: addr=127.0.0.1:9944, allowed origins=["*"]
2025-12-06 10:00:00 🏁 CPU score: 1.00 GiBs
2025-12-06 10:00:00 🏁 Memory score: 15.00 GiBs
2025-12-06 10:00:00 🏁 Disk score (seq. writes): 1.00 GiBs
2025-12-06 10:00:06 💤 Idle (0 peers), best: #0 (0xabcd…), finalized #0 (0xabcd…), ⬇ 0 ⬆ 0
2025-12-06 10:00:12 🙌 Starting consensus session on top of parent 0xabcd…
2025-12-06 10:00:12 🎁 Prepared block for proposing at 1 (0 ms) [hash: 0xefgh…; parent_hash: 0xabcd…]
2025-12-06 10:00:12 🔖 Pre-sealed block for proposal at 1. Hash now 0xijkl…, previously 0xefgh…
2025-12-06 10:00:12 ✨ Imported #1 (0xijkl…)
```

### 方式2: 连接到远程测试网

```bash
# 修改 .env 文件
vim .env

# 设置远程端点
CHAIN_WS_ENDPOINT=ws://testnet.example.com:9944
```

**验证连接**:
```bash
# 使用curl测试JSON-RPC
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
     http://localhost:9944

# 预期返回
{"jsonrpc":"2.0","result":{"isSyncing":false,"peers":0,"shouldHavePeers":false},"id":1}
```

---

## 🔨 步骤2: 生成链上类型

```bash
cd /home/xiaodong/文档/stardust/xuanxue-oracle

# 确保测试网运行中
curl -s http://localhost:9944 > /dev/null && echo "✅ 链已连接" || echo "❌ 链未连接"

# 运行类型生成脚本
./generate-types.sh
```

**预期输出**:
```
🔍 Subxt Metadata Generator
================================

🌐 Connecting to: ws://127.0.0.1:9944
📥 Fetching metadata...
✅ Metadata downloaded: metadata.scale
-rw-r--r-- 1 user user 245K Dec  6 10:05 metadata.scale

🔨 Generating Rust code...
✅ Code generated: src/blockchain/runtime.rs
   Generated 8523 lines of code

🎉 Success! Generated files:
   - metadata.scale (metadata)
   - src/blockchain/runtime.rs (Rust types)

Next steps:
   1. Review the generated code
   2. Update your code to use the new types
   3. Run: cargo check
```

**验证生成**:
```bash
# 检查文件存在
ls -lh metadata.scale src/blockchain/runtime.rs

# 检查内容
grep -n "pub mod divination_ai" src/blockchain/runtime.rs
head -n 50 src/blockchain/runtime.rs
```

---

## 🔄 步骤3: 集成生成的类型

### 3.1 备份当前代码

```bash
cp src/blockchain/mod.rs src/blockchain/mod.rs.backup
```

### 3.2 替换为完整实现

```bash
# 方式1: 直接替换
cp src/blockchain/mod_complete.rs src/blockchain/mod.rs

# 方式2: 手动合并（推荐，更安全）
# 1. 打开两个文件对比
# 2. 将 mod_complete.rs 中的完整实现复制到 mod.rs
# 3. 保留 mod.rs 中的其他模块导出
```

### 3.3 验证编译

```bash
# 检查语法
cargo check

# 预期输出
    Checking xuanxue-oracle v0.1.0
    Finished dev [unoptimized + debuginfo] target(s) in 15.23s
```

**如果遇到编译错误**:

#### 错误1: `cannot find type runtime in module blockchain`
```bash
# 原因: runtime.rs未生成或未正确导入
# 解决: 确保 src/blockchain/mod.rs 包含:
pub mod runtime;
```

#### 错误2: `mismatched types`
```bash
# 原因: 生成的类型与代码中使用的类型不匹配
# 解决: 检查 runtime::divination_ai::events::InterpretationRequested 的实际字段
grep -A 20 "struct InterpretationRequested" src/blockchain/runtime.rs
```

#### 错误3: `trait bounds were not satisfied`
```bash
# 原因: 类型没有实现所需的trait
# 解决: 检查是否需要添加 #[derive(...)]
```

---

## ⚙️ 步骤4: 配置Oracle节点

### 4.1 编辑配置文件

```bash
vim config.toml
```

```toml
[oracle]
name = "My First Oracle"
# 支持的占卜类型 (位标志)
# 0x01 = Bazi (八字)
# 0x02 = Meihua (梅花易数)
# 0x04 = Liuyao (六爻)
# 0x08 = Qimen (奇门遁甲)
# 0xFF = 全部支持
supported_divination_types = 0x03  # Bazi + Meihua

# 支持的解读类型 (位标志)
# 0x0001 = Basic (基础)
# 0x0002 = Detailed (详细)
# 0x0004 = Professional (专业)
# 0x01FF = 全部支持
supported_interpretation_types = 0x0007  # Basic + Detailed + Professional

[chain]
ws_endpoint = "ws://localhost:9944"
oracle_account_seed = "//Alice"  # 测试用，生产环境请用安全的种子

[deepseek]
api_key = "sk-your-deepseek-api-key"
base_url = "https://api.deepseek.com/v1"
model = "deepseek-chat-v2.5"
temperature = 0.7
max_tokens = 4000

[ipfs]
api_url = "http://localhost:5001"
gateway_url = "http://localhost:8080"
use_pinata = false  # 如果本地IPFS不可用，设为true

# Pinata配置 (可选)
# pinata_api_key = "your-pinata-api-key"
# pinata_secret_key = "your-pinata-secret-key"
```

### 4.2 验证配置

```bash
# 测试配置加载
cargo run -- --help

# 应该看到启动信息
```

---

## 🚀 步骤5: 启动Oracle节点

### 5.1 编译Release版本

```bash
cargo build --release

# 预期耗时: 10-20分钟 (首次)
```

### 5.2 启动节点

```bash
# 开发模式 (详细日志)
RUST_LOG=xuanxue_oracle=debug ./dev.sh

# 生产模式
./start.sh
```

**预期输出**:
```
🚀 Xuanxue Oracle Node Starting...
2025-12-06 10:10:00 INFO  xuanxue_oracle: ✅ Configuration loaded
2025-12-06 10:10:00 INFO  xuanxue_oracle::blockchain: Connecting to blockchain at ws://localhost:9944...
2025-12-06 10:10:01 INFO  xuanxue_oracle::blockchain: ✅ Connected successfully
2025-12-06 10:10:01 INFO  xuanxue_oracle::blockchain: 👤 Oracle account: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
2025-12-06 10:10:01 INFO  xuanxue_oracle::blockchain: Checking Oracle registration status...
2025-12-06 10:10:02 WARN  xuanxue_oracle::blockchain: ⚠️  Oracle not registered, attempting registration...
2025-12-06 10:10:02 INFO  xuanxue_oracle::blockchain: 📝 Registering Oracle node...
2025-12-06 10:10:08 INFO  xuanxue_oracle::blockchain: ✅ Transaction included in block: 0x1234abcd...
2025-12-06 10:10:08 INFO  xuanxue_oracle::blockchain:    Name: My First Oracle
2025-12-06 10:10:08 INFO  xuanxue_oracle::blockchain:    Supported types: 0x03
2025-12-06 10:10:08 INFO  xuanxue_oracle::blockchain:    Supported interpretations: 0x0007
2025-12-06 10:10:08 INFO  xuanxue_oracle::blockchain: ✅ Oracle registered successfully
2025-12-06 10:10:08 INFO  xuanxue_oracle::blockchain: 👂 Starting event watcher...
2025-12-06 10:10:08 INFO  xuanxue_oracle::blockchain:    Watching for InterpretationRequested events
2025-12-06 10:10:14 DEBUG xuanxue_oracle::blockchain: 📦 Block: #15 (0x5678efgh...)
2025-12-06 10:10:20 DEBUG xuanxue_oracle::blockchain: 📦 Block: #16 (0x9012ijkl...)
```

### 5.3 验证运行状态

**在另一个终端窗口**:

```bash
# 方式1: 查看日志文件
tail -f xuanxue-oracle.log

# 方式2: 查看进程
ps aux | grep xuanxue-oracle

# 方式3: 使用Polkadot.js Apps
# 打开浏览器访问: https://polkadot.js.org/apps/
# 连接到 ws://localhost:9944
# Developer → Chain state → divinationAi → oracles
# 输入Oracle账户地址，查询注册信息
```

---

## 🧪 步骤6: 端到端测试

按照 `TESTING_GUIDE.md` 执行完整测试：

### 6.1 场景1: 创建八字命盘

在Polkadot.js Apps:
```
Developer → Extrinsics → baziChart → createBaziChart

参数:
- year: 1990
- month: 11
- day: 15
- hour: 14
- minute: 30
- gender: Male
- is_leap_month: false
- longitude: 116.4074
- is_dst: false

提交 → 记录 chart_id
```

### 6.2 场景2: 请求解读

```
Developer → Extrinsics → divinationAi → requestInterpretation

参数:
- divination_type: Bazi (0)
- result_id: <chart_id from step 1>
- interpretation_type: Basic (0)
- question: "请解读我的命运" (可选)

提交 → 记录 request_id
```

### 6.3 观察Oracle日志

切换回Oracle节点终端，应该看到:

```
2025-12-06 10:15:30 INFO  🔔 Detected InterpretationRequested event
2025-12-06 10:15:30 INFO     Request ID: 1
2025-12-06 10:15:30 INFO     Divination Type: 0
2025-12-06 10:15:30 INFO     Result ID: 1
2025-12-06 10:15:30 INFO  📝 Processing request #1: type 0 for result #1
2025-12-06 10:15:31 INFO  ✅ Request #1 accepted
2025-12-06 10:15:31 INFO  📊 Fetched divination data
2025-12-06 10:15:31 INFO  🤖 Generating AI interpretation...
2025-12-06 10:15:35 INFO  ✅ AI interpretation generated (2458 chars)
2025-12-06 10:15:35 INFO  📤 Uploading to IPFS...
2025-12-06 10:15:37 INFO  ✅ Uploaded to IPFS: QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP
2025-12-06 10:15:37 INFO  📤 Submitting result to blockchain...
2025-12-06 10:15:43 INFO  ✅ Result submitted for request #1
2025-12-06 10:15:43 INFO     CID: QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP
```

### 6.4 查看结果

在Polkadot.js Apps:
```
Developer → Chain state → divinationAi → results(u64)
输入 request_id: 1

结果:
{
  "requestId": 1,
  "oracleNode": "5GrwvaEF...",
  "contentCid": "QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP",
  "submittedAt": 1733457943,
  "modelVersion": "deepseek-chat-v2.5",
  "language": "zh-CN"
}
```

### 6.5 从IPFS获取解读内容

```bash
# 本地IPFS
curl http://localhost:8080/ipfs/QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP | jq .

# 公共网关
curl https://gateway.pinata.cloud/ipfs/QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP | jq .
```

---

## 🐛 故障排除

### 问题1: 无法连接到区块链

**症状**:
```
ERROR Failed to connect: Connection refused
```

**排查**:
```bash
# 1. 检查节点是否运行
ps aux | grep solochain-template-node

# 2. 检查端口
netstat -tulpn | grep 9944

# 3. 尝试手动连接
curl http://localhost:9944

# 4. 检查防火墙
sudo ufw status
sudo ufw allow 9944
```

### 问题2: Oracle注册失败

**症状**:
```
ERROR Failed to submit tx: insufficient balance
```

**解决**:
```bash
# 测试账户默认有余额，如果用自定义账户需要转账
# 在Polkadot.js Apps:
# Accounts → Transfer → 转账到Oracle账户
```

### 问题3: DeepSeek API错误

**症状**:
```
ERROR AI API error: 401 Unauthorized
```

**排查**:
```bash
# 1. 验证API key
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"

# 2. 检查配置文件
cat .env | grep DEEPSEEK_API_KEY

# 3. 检查余额
# 访问 https://platform.deepseek.com/
```

### 问题4: IPFS上传失败

**症状**:
```
WARN Local IPFS failed: Connection refused
ERROR Failed to upload to IPFS
```

**解决**:
```bash
# 方式1: 启动本地IPFS
ipfs daemon

# 方式2: 使用Pinata
# 在config.toml中设置:
use_pinata = true
pinata_api_key = "your-api-key"
pinata_secret_key = "your-secret-key"
```

### 问题5: 编译错误

**症状**:
```
error[E0433]: failed to resolve: use of undeclared crate or module `runtime`
```

**解决**:
```bash
# 1. 重新生成runtime
./generate-types.sh

# 2. 清理重新编译
cargo clean
cargo check

# 3. 检查mod.rs
grep "pub mod runtime" src/blockchain/mod.rs
```

---

## 📊 监控和维护

### 日志管理

```bash
# 实时查看日志
tail -f xuanxue-oracle.log

# 按级别过滤
grep ERROR xuanxue-oracle.log
grep WARN xuanxue-oracle.log

# 查看最近100行
tail -n 100 xuanxue-oracle.log

# 日志轮转 (logrotate配置)
sudo vim /etc/logrotate.d/xuanxue-oracle
```

### 性能监控

```bash
# CPU和内存使用
top -p $(pgrep xuanxue-oracle)

# 详细统计
pidstat -p $(pgrep xuanxue-oracle) 1

# 网络流量
iftop
```

### 健康检查

```bash
# 检查Oracle是否在线
./scripts/health-check.sh

# 检查最近处理的请求数
# 在Polkadot.js Apps查询:
# divinationAi → oracles → requestsProcessed
```

---

## 🎉 完成确认

完成以下检查表，确保集成成功:

- [ ] 测试网正常运行
- [ ] 类型生成成功 (metadata.scale + runtime.rs)
- [ ] 代码编译通过 (cargo check)
- [ ] Oracle节点启动成功
- [ ] Oracle自动注册成功
- [ ] 能监听到区块事件
- [ ] 能接受解读请求
- [ ] AI生成解读成功
- [ ] IPFS上传成功
- [ ] 结果提交上链成功
- [ ] 能从IPFS获取结果

**全部完成后，Oracle节点已经完全可用！** 🎊

---

## 📚 相关文档

- `TESTING_GUIDE.md` - 详细测试场景
- `docs/SUBXT_INTEGRATION.md` - Subxt技术细节
- `README.md` - 项目使用手册
- `QUICKSTART.md` - 5分钟快速开始

---

**最后更新**: 2025-12-06
**状态**: ✅ 生产就绪
