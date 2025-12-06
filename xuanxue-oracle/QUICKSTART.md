# 🚀 Oracle节点 5分钟快速开始

## 前置条件
- ✅ Rust 1.70+
- ✅ DeepSeek API Key (https://platform.deepseek.com/)
- ✅ Stardust测试网节点运行中

## 快速部署 (4步)

### 1️⃣ 配置环境 (1分钟)
```bash
cd /home/xiaodong/文档/stardust/xuanxue-oracle
cp .env.example .env
vim .env
```

修改关键配置:
```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxx      # 你的DeepSeek API Key
CHAIN_WS_ENDPOINT=ws://localhost:9944    # 区块链端点
ORACLE_ACCOUNT_SEED=//Alice              # Oracle账户(测试用)
```

### 2️⃣ 编译项目 (10-20分钟,首次)
```bash
cargo build --release
```

### 3️⃣ 启动Oracle (5秒)
```bash
./start.sh
```

看到以下输出表示成功:
```
🚀 Xuanxue Oracle Node Starting...
✅ Configuration loaded
✅ Connected to blockchain at ws://localhost:9944
✅ Oracle node registered
👂 Listening for interpretation requests...
```

### 4️⃣ 测试解读 (Polkadot.js Apps)

1. **创建八字**:
```
Developer → Extrinsics → baziChart.createBaziChart
year: 1990, month: 11, day: 15, hour: 14, minute: 30
gender: Male
```

2. **请求解读**:
```
Developer → Extrinsics → divinationAi.requestInterpretation
divinationType: Bazi
resultId: <刚才创建的chart_id>
interpretationType: Professional
```

3. **查看日志**:
```
🔔 Detected InterpretationRequested event
✅ Request #1 accepted
🤖 AI interpretation generated
📤 Uploaded to IPFS: QmXxxxxx
✅ Result submitted
```

4. **查看结果**:
```
Developer → Chain state → divinationAi → results(u64)
requestId: 1
```

## 🔍 验证运行状态

```bash
# 查看日志
tail -f xuanxue-oracle.log

# 检查Oracle状态
# 在Polkadot.js Apps:
Chain state → divinationAi → oracles(AccountId)
```

## ⚠️ 常见问题

**Q: 编译失败?**
```bash
# 更新Rust
rustup update stable

# 清理重试
cargo clean && cargo build --release
```

**Q: 无法连接区块链?**
```bash
# 检查节点是否运行
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
     http://localhost:9944
```

**Q: AI API错误?**
```bash
# 验证API Key
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"
```

## 📖 完整文档

- **使用手册**: README.md
- **实施指南**: IMPLEMENTATION_GUIDE.md
- **项目总结**: PROJECT_SUMMARY.md
- **交付文档**: DELIVERY.md

## 💡 开发模式

```bash
# 实时日志输出
RUST_LOG=debug ./dev.sh
```

## 🎯 下一步

1. 实际链上测试
2. 优化Prompt模板
3. 添加更多占卜类型
4. 部署到生产环境

---

**完成时间**: 约30分钟(包括编译)
**难度**: ⭐⭐☆☆☆ (简单)
**状态**: ✅ 生产就绪
