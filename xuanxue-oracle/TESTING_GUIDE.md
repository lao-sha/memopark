# 测试指南 - Oracle节点端到端测试

## 📋 测试前提条件

### 1. 环境准备

**必需组件**:
- ✅ Stardust测试网节点运行中 (`ws://localhost:9944`)
- ✅ DeepSeek API Key配置正确
- ✅ IPFS服务可用 (本地节点或Pinata)
- ✅ Oracle账户有足够余额用于交易费

**检查清单**:
```bash
# 1. 检查测试网节点
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
     http://localhost:9944

# 2. 检查IPFS
curl -X POST http://localhost:5001/api/v0/version

# 3. 检查DeepSeek API
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"

# 4. 检查Oracle配置
cat .env | grep -E "(CHAIN_WS_ENDPOINT|DEEPSEEK_API_KEY|ORACLE_ACCOUNT_SEED)"
```

### 2. 生成链上类型

**首次运行时必须执行**:

```bash
# 方式1: 使用脚本 (推荐)
CHAIN_WS_ENDPOINT=ws://localhost:9944 ./generate-types.sh

# 方式2: 手动执行
subxt metadata --url ws://localhost:9944 > metadata.scale
subxt codegen --file metadata.scale > src/blockchain/runtime.rs
```

**预期输出**:
```
🔍 Subxt Metadata Generator
================================

🌐 Connecting to: ws://localhost:9944
📥 Fetching metadata...
✅ Metadata downloaded: metadata.scale
-rw-r--r-- 1 user user 245K Dec  6 10:00 metadata.scale

🔨 Generating Rust code...
✅ Code generated: src/blockchain/runtime.rs
   Generated 8523 lines of code

🎉 Success! Generated files:
   - metadata.scale (metadata)
   - src/blockchain/runtime.rs (Rust types)
```

**验证生成的代码**:
```bash
# 检查生成的文件
ls -lh metadata.scale src/blockchain/runtime.rs

# 检查是否包含DivinationAi pallet
grep -n "DivinationAi" src/blockchain/runtime.rs

# 编译检查
cargo check
```

## 🧪 测试场景

### 场景1: Oracle节点注册

**目标**: 验证Oracle节点能成功注册到链上

**步骤**:

1. **启动Oracle节点**:
```bash
RUST_LOG=info ./target/release/xuanxue-oracle
```

2. **观察日志输出**:
```
🚀 Xuanxue Oracle Node Starting...
✅ Configuration loaded
🔗 Connecting to blockchain at ws://localhost:9944...
✅ Connected successfully
👤 Oracle account: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

📝 Checking Oracle registration status...
⚠️  Oracle not registered, attempting registration...
📝 Registering Oracle node...
   Name: DeepSeek Oracle
   Supported types: 0xFF
   Supported interpretations: 0x01FF
✅ Oracle registered successfully
✅ Transaction included in block: 0x1234...

👂 Starting event watcher...
   Watching for InterpretationRequested events
📦 Block: #1 (0xabcd...)
```

3. **在Polkadot.js Apps验证**:
```
Developer → Chain state → divinationAi → oracles(AccountId)
输入: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

预期结果:
{
  "account": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "name": "DeepSeek Oracle",
  "stake": 1000000000000,
  "isActive": true,
  "supportedDivinationTypes": 255,
  "supportedInterpretationTypes": 511
}
```

**预期结果**: ✅ Oracle节点成功注册并激活

---

### 场景2: 八字解读 - 基础级

**目标**: 测试完整的八字基础解读流程

**步骤**:

1. **创建八字命盘** (在Polkadot.js Apps):
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
- longitude: 116.4074 (北京)
- is_dst: false

提交交易 → 记录返回的 chart_id (例如: 1)
```

2. **请求基础解读**:
```
Developer → Extrinsics → divinationAi → requestInterpretation

参数:
- divination_type: Bazi
- result_id: 1 (上一步的chart_id)
- interpretation_type: Basic
- question: "请解读我的命运" (可选)
- additional_context: null

提交交易 → 记录返回的 request_id (例如: 1)
```

3. **观察Oracle日志**:
```
🔔 Detected InterpretationRequested event
   Request ID: 1
   Divination Type: Bazi
   Result ID: 1

📝 Processing request #1: Bazi for result #1
✅ Request #1 accepted

📊 Fetched divination data
   Four Pillars: 庚午年 丁亥月 甲寅日 辛未时
   Day Master: 甲木
   Gender: Male

🤖 Generating AI interpretation...
   Prompt length: 1847 chars
   Model: deepseek-chat-v2.5

📡 Calling DeepSeek API...
⏱️  Response time: 3.2s
✅ AI interpretation generated (2458 chars)

📤 Uploading to IPFS...
✅ Uploaded to IPFS: QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP

📤 Submitting result to blockchain...
✅ Result submitted for request #1
   CID: QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP
   Transaction: 0x5678...
```

4. **查询解读结果**:
```
Developer → Chain state → divinationAi → results(u64)
输入 request_id: 1

预期结果:
{
  "requestId": 1,
  "oracleNode": "5GrwvaEF...",
  "contentCid": "QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP",
  "summaryCid": null,
  "submittedAt": 1733457600,
  "modelVersion": "deepseek-chat-v2.5",
  "language": "zh-CN",
  "qualityScore": 0,
  "userRating": 0
}
```

5. **从IPFS获取内容**:
```bash
# 方式1: 本地IPFS
curl http://localhost:8080/ipfs/QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP

# 方式2: 公共网关
curl https://gateway.pinata.cloud/ipfs/QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP

# 方式3: 使用jq格式化
curl -s http://localhost:8080/ipfs/QmXg... | jq .
```

6. **验证解读内容质量**:
```json
{
  "divination_type": "Bazi",
  "interpretation_type": "Basic",
  "result_id": 1,
  "content": {
    "overview": "您的八字为庚午年丁亥月甲寅日辛未时...",
    "personality": "日主甲木生于亥月得水生,根基深厚...",
    "career": "甲木日主透辛金为正官,事业方面适合...",
    "wealth": "财星午火在年柱,早年家境...",
    "health": "八字中水木旺盛,需注意...",
    "suggestions": "1. 宜从事与木、火相关的行业..."
  },
  "metadata": {
    "generated_at": "2025-12-06T10:30:45Z",
    "model": "deepseek-chat-v2.5",
    "language": "zh-CN",
    "word_count": 856
  }
}
```

**质量检查标准**:
- ✅ 内容长度: 800-1000字
- ✅ 包含7个主要部分
- ✅ 语言流畅,逻辑清晰
- ✅ 专业术语使用正确
- ✅ 建议具体可行

**预期结果**: ✅ 3-5秒内完成解读,内容质量符合基础级标准

---

### 场景3: 八字解读 - 专业级

**目标**: 测试深度解读功能

**步骤**:

1. 使用场景2已创建的chart_id

2. **请求专业解读**:
```
Developer → Extrinsics → divinationAi → requestInterpretation

参数:
- divination_type: Bazi
- result_id: 1
- interpretation_type: Professional
- question: "请详细分析我的事业和财运走势"

提交 → 记录 request_id (例如: 2)
```

3. **观察处理时间**:
```
🔔 Detected InterpretationRequested event (request #2)
🤖 Generating AI interpretation...
   Prompt length: 3245 chars (专业级模板更长)

📡 Calling DeepSeek API...
⏱️  Response time: 8.7s (更长,因为生成2000字)
✅ AI interpretation generated (4832 chars)

📤 Uploading to IPFS...
✅ Uploaded to IPFS: QmYh8...
```

4. **验证内容差异**:
```bash
# 对比基础级和专业级
curl -s http://localhost:8080/ipfs/QmXg7... | jq '.content | keys'
["overview", "personality", "career", "wealth", "health", "relationship", "suggestions"]

curl -s http://localhost:8080/ipfs/QmYh8... | jq '.content | keys'
["overview", "pattern_analysis", "wuxing_analysis", "shishen_analysis",
 "personality", "career", "wealth", "relationship", "health",
 "fortune_trends", "suggestions"]

# 字数对比
curl -s http://localhost:8080/ipfs/QmXg7... | jq '.metadata.word_count'
856

curl -s http://localhost:8080/ipfs/QmYh8... | jq '.metadata.word_count'
1847
```

**质量检查标准**:
- ✅ 内容长度: 1500-2000字
- ✅ 包含10个主要部分
- ✅ 格局分析深入
- ✅ 引用经典命理理论
- ✅ 提供10年大运分析

**预期结果**: ✅ 8-12秒内完成,内容深度明显高于基础级

---

### 场景4: 梅花易数解读

**目标**: 验证多种占卜类型支持

**步骤**:

1. **创建梅花易数卦象** (假设pallet已实现):
```
Developer → Extrinsics → meihua → create_hexagram

参数:
- method: NumberTime
- numbers: [3, 5, 8] (起卦数字)
- question: "近期事业发展如何"

提交 → 记录 hexagram_id (例如: 1)
```

2. **请求解读**:
```
Developer → Extrinsics → divinationAi → requestInterpretation

参数:
- divination_type: Meihua
- result_id: 1
- interpretation_type: Detailed
```

3. **验证Oracle日志**:
```
🔔 Detected InterpretationRequested event
   Divination Type: Meihua

📊 Fetched divination data
   Main Hexagram: 雷风恒 (Hexagram 32)
   Changing Line: 3
   Transformed: 雷山小过

🤖 Using prompt template: prompts/meihua/default.txt
✅ Interpretation generated
```

**预期结果**: ✅ 成功处理梅花易数占卜

---

### 场景5: 并发请求处理

**目标**: 测试Oracle处理多个请求的能力

**步骤**:

1. **快速提交5个解读请求** (使用不同chart_id):
```bash
# 使用脚本批量提交
for i in {1..5}; do
  echo "Submitting request for chart $i"
  # 使用polkadot-js-api或自定义脚本
done
```

2. **观察Oracle日志**:
```
🔔 Detected InterpretationRequested event (request #3)
🔔 Detected InterpretationRequested event (request #4)
🔔 Detected InterpretationRequested event (request #5)
🔔 Detected InterpretationRequested event (request #6)
🔔 Detected InterpretationRequested event (request #7)

📝 Processing request #3...
✅ Request #3 accepted

📝 Processing request #4...
✅ Request #4 accepted

[并发处理中...]

⏱️  Request #3 completed in 4.2s
⏱️  Request #4 completed in 4.8s
⏱️  Request #5 completed in 3.9s
⏱️  Request #6 completed in 5.1s
⏱️  Request #7 completed in 4.5s
```

**性能指标**:
- ✅ 所有请求都被接受
- ✅ 平均处理时间 <6秒
- ✅ 无错误或超时
- ✅ IPFS上传成功率 100%

**预期结果**: ✅ 能够并发处理多个请求,互不干扰

---

### 场景6: 错误处理测试

**目标**: 验证错误情况下的处理逻辑

#### 6.1 无效的result_id

```
请求参数:
- divination_type: Bazi
- result_id: 99999 (不存在)
- interpretation_type: Basic

预期日志:
❌ Failed to fetch divination data: Result not found
⚠️  Skipping request #8 due to data fetch error
```

#### 6.2 DeepSeek API错误

```bash
# 临时设置无效API Key
export DEEPSEEK_API_KEY=invalid_key
./target/release/xuanxue-oracle

预期日志:
🤖 Generating AI interpretation...
❌ DeepSeek API error: 401 Unauthorized
⚠️  Will retry in 5 seconds...
[重试逻辑...]
```

#### 6.3 IPFS上传失败

```bash
# 停止IPFS服务
systemctl stop ipfs

# 观察日志
预期日志:
📤 Uploading to IPFS...
⚠️  Local IPFS failed: Connection refused
🔄 Falling back to Pinata...
✅ Uploaded to Pinata: QmZx9...
```

**预期结果**: ✅ 所有错误都有适当的错误处理和日志记录

---

## 📊 性能基准测试

### 延迟测试

| 操作 | 目标时间 | 测量方法 |
|------|---------|----------|
| 事件检测 | <500ms | 从事件发出到Oracle日志出现 |
| 接受请求 | <2s | accept_request交易确认 |
| 数据获取 | <1s | 从链上读取占卜数据 |
| AI生成(基础) | 3-5s | DeepSeek API响应时间 |
| AI生成(专业) | 8-12s | DeepSeek API响应时间 |
| IPFS上传 | <2s | 上传并获取CID |
| 结果提交 | <3s | submit_result交易确认 |
| **总耗时(基础)** | **10-15s** | 从请求到结果上链 |
| **总耗时(专业)** | **15-20s** | 从请求到结果上链 |

### 吞吐量测试

```bash
# 测试1小时内可处理的请求数
# 假设平均12秒/请求
理论最大吞吐量: 300 requests/hour

# 实际测试脚本
./scripts/benchmark.sh --duration 3600 --concurrency 1
```

### 资源使用

```bash
# 监控Oracle节点资源
top -p $(pgrep xuanxue-oracle)

目标指标:
- CPU: <50%
- 内存: <200MB
- 网络: <1MB/s
```

---

## 🔍 调试技巧

### 启用详细日志

```bash
# 最详细模式
RUST_LOG=xuanxue_oracle=trace,subxt=debug ./target/release/xuanxue-oracle

# 只看关键信息
RUST_LOG=xuanxue_oracle=info ./target/release/xuanxue-oracle

# 只看错误
RUST_LOG=xuanxue_oracle=error ./target/release/xuanxue-oracle
```

### 事件追踪

```bash
# 在另一个终端监控链上事件
websocat ws://localhost:9944 -v <<EOF
{"id":1,"jsonrpc":"2.0","method":"chain_subscribeNewHeads"}
EOF
```

### IPFS内容验证

```bash
# 验证CID内容
ipfs cat QmXg7kJ4pz3Y8bvN9rW5mT2cV1dH6qZ8fR3sL9xK4wE2jP | jq .

# 检查固定状态
ipfs pin ls | grep QmXg7...
```

### 区块链状态检查

```bash
# 查询所有Oracle节点
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "state_getKeys",
          "params": ["0x..."]}' \
     http://localhost:9944

# 查询特定请求
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "state_getStorage",
          "params": ["0x..."]}' \
     http://localhost:9944
```

---

## ✅ 验收标准

### 功能验收

- [ ] Oracle节点能自动注册到链上
- [ ] 能监听InterpretationRequested事件
- [ ] 支持所有配置的占卜类型 (Bazi, Meihua, Liuyao...)
- [ ] 支持所有配置的解读类型 (Basic, Detailed, Professional...)
- [ ] AI生成的内容符合Prompt模板要求
- [ ] 内容成功上传到IPFS并获取CID
- [ ] 结果成功提交到区块链
- [ ] 用户能从IPFS获取解读内容

### 质量验收

- [ ] 基础解读: 800-1000字,7个部分
- [ ] 专业解读: 1500-2000字,10个部分
- [ ] 内容逻辑清晰,无明显错误
- [ ] 专业术语使用准确
- [ ] 建议具体可行

### 性能验收

- [ ] 基础解读完成时间 <15秒
- [ ] 专业解读完成时间 <20秒
- [ ] 并发处理无错误
- [ ] 资源使用合理 (CPU <50%, 内存 <200MB)

### 可靠性验收

- [ ] 运行24小时无崩溃
- [ ] 处理100+请求无错误
- [ ] 所有错误都有适当处理
- [ ] IPFS备用方案有效

---

## 📝 测试报告模板

```markdown
# Oracle节点测试报告

**测试日期**: 2025-12-06
**测试人员**: [姓名]
**Oracle版本**: 0.1.0
**测试网**: Stardust Testnet

## 测试环境
- 区块链端点: ws://localhost:9944
- IPFS: 本地节点 + Pinata备份
- DeepSeek模型: deepseek-chat-v2.5

## 测试结果

### 场景1: Oracle注册
- 状态: ✅ 通过
- 耗时: 3.2秒
- 备注: 无问题

### 场景2: 八字基础解读
- 状态: ✅ 通过
- 耗时: 12.5秒
- 内容质量: 优秀 (912字,7部分完整)
- 备注: 无问题

### 场景3: 八字专业解读
- 状态: ✅ 通过
- 耗时: 18.3秒
- 内容质量: 优秀 (1847字,10部分完整)
- 备注: 格局分析深入,引用经典

### 场景4: 梅花易数解读
- 状态: ⚠️ 未测试
- 原因: 梅花易数pallet尚未部署

### 场景5: 并发处理
- 状态: ✅ 通过
- 测试请求数: 5个
- 平均耗时: 13.8秒
- 成功率: 100%

### 场景6: 错误处理
- 6.1 无效result_id: ✅ 正确处理
- 6.2 API错误: ✅ 正确处理和重试
- 6.3 IPFS故障: ✅ 自动切换到Pinata

## 性能指标
- 基础解读平均: 12.5秒
- 专业解读平均: 18.3秒
- 并发吞吐量: ~280 req/hour
- CPU使用: 35%
- 内存使用: 145MB

## 发现的问题
1. [如有] 问题描述

## 改进建议
1. Prompt模板可进一步优化
2. 考虑添加缓存机制

## 总体评价
✅ **测试通过** - 系统功能完整,性能优秀,可投入生产使用

测试人签名: ____________
日期: 2025-12-06
```

---

## 🚀 下一步

测试通过后:
1. 部署到生产环境
2. 监控运行指标
3. 收集用户反馈
4. 持续优化Prompt
5. 扩展更多占卜类型
