# Week 1-2 实施指南

本文档提供Oracle节点服务的详细实施步骤,帮助快速部署和测试。

## 📅 第一周: 基础设施搭建

### Day 1-2: 环境准备

#### 1. 服务器准备
```bash
# 推荐配置: 2核4G Ubuntu 22.04

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y build-essential git curl
```

#### 2. 安装Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version
```

#### 3. 安装IPFS (可选,也可使用Pinata)
```bash
# 下载IPFS
wget https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz
tar -xvzf kubo_v0.24.0_linux-amd64.tar.gz
cd kubo
sudo bash install.sh

# 初始化IPFS
ipfs init
ipfs daemon &  # 后台运行
```

#### 4. 注册DeepSeek账户
1. 访问 https://platform.deepseek.com/
2. 注册账户
3. 充值(建议¥100起,足够测试)
4. 创建API Key

### Day 3-4: 部署Oracle节点

#### 1. 克隆和配置
```bash
cd /opt
git clone <your-repo>/xuanxue-oracle
cd xuanxue-oracle

# 复制配置
cp .env.example .env
vim .env
```

#### 2. 配置.env文件
```bash
# 区块链配置
CHAIN_WS_ENDPOINT=ws://your-chain-ip:9944
ORACLE_ACCOUNT_SEED="your mnemonic phrase here"

# DeepSeek配置
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# IPFS配置 (选择其一)
## 本地IPFS
IPFS_API_URL=http://127.0.0.1:5001

## 或Pinata
# IPFS_PINATA_API_KEY=your_pinata_key
# IPFS_PINATA_SECRET=your_pinata_secret

# 日志
RUST_LOG=info,xuanxue_oracle=debug
```

#### 3. 编译和运行
```bash
# 编译(首次较慢,约10-20分钟)
cargo build --release

# 测试运行
./target/release/xuanxue-oracle

# 看到以下输出表示成功:
# 🚀 Xuanxue Oracle Node Starting...
# ✅ Configuration loaded
# ✅ Connected to blockchain at ws://...
# 👂 Listening for interpretation requests...
```

### Day 5: 链上注册

#### 1. 准备账户
```bash
# 确保Oracle账户有足够DUST代币
# - 质押金额: 1000 DUST (示例)
# - Gas费用: 约10 DUST
```

#### 2. 使用Polkadot.js Apps注册

1. 连接到你的节点: https://polkadot.js.org/apps/
2. 切换到 Developer → Extrinsics
3. 选择账户和交易:
   ```
   extrinsic: divinationAi.registerOracle
   name: "AI-Oracle-1"
   supportedDivinationTypes: 255 (0xFF,支持所有)
   supportedInterpretationTypes: 511 (0x1FF,支持所有)
   ```
4. 提交并签名

#### 3. 验证注册
```
Developer → Chain state → divinationAi → oracles(AccountId)
```

查看你的账户信息应该显示:
```json
{
  "account": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "name": "AI-Oracle-1",
  "stake": 1000000000000000,
  "isActive": true,
  "requestsProcessed": 0,
  "requestsSucceeded": 0,
  "averageRating": 0
}
```

## 📅 第二周: 测试和优化

### Day 6-7: 功能测试

#### 测试流程

**1. 创建测试八字**
```bash
# 使用Polkadot.js Apps
extrinsic: baziChart.createBaziChart
year: 1990
month: 11
day: 15
hour: 14
minute: 30
gender: Male
```

记录返回的`chart_id`

**2. 请求AI解读**
```bash
extrinsic: divinationAi.requestInterpretation
divinationType: Bazi
resultId: <chart_id>
interpretationType: Professional
contextHash: None
```

**3. 观察Oracle日志**
```
🔔 Detected InterpretationRequested event
📝 Processing request #1: Bazi for result #123
✅ Request #1 accepted
📊 Fetched divination data
🤖 AI interpretation generated
📤 Uploaded to IPFS: QmXxxxxx
✅ Result submitted for request #1
```

**4. 查看解读结果**
```bash
# 查询结果
Developer → Chain state → divinationAi → results(u64)

# 获取IPFS内容
ipfs cat QmXxxxxx
# 或访问网关
https://ipfs.io/ipfs/QmXxxxxx
```

**5. 用户评分**
```bash
extrinsic: divinationAi.rateResult
requestId: 1
rating: 5  # 1-5星
```

### Day 8-9: 压力测试

#### 批量测试脚本

创建 `test_batch.sh`:
```bash
#!/bin/bash

# 创建10个测试请求
for i in {1..10}; do
    echo "Creating test request $i..."

    # 这里需要使用subxt或polkadot-js-api
    # 提交10个interpretation请求

    sleep 2
done

echo "Submitted 10 test requests"
```

#### 监控指标

```bash
# 查看Oracle统计
Developer → Chain state → divinationAi → oracles

# 关注:
- requestsProcessed: 处理总数
- requestsSucceeded: 成功数
- averageRating: 平均评分
```

### Day 10: Prompt优化

#### 1. 收集反馈

查看前10个解读结果,评估:
- 内容长度是否合适
- 结构是否清晰
- 分析是否专业
- 建议是否实用

#### 2. 优化Prompt模板

编辑 `prompts/bazi/professional.txt`:
```markdown
# 根据反馈调整:

## 如果内容过短
- 增加每个章节的字数要求
- 添加更多分析维度

## 如果内容过长
- 精简字数要求
- 合并相似章节

## 如果专业性不足
- 强化系统提示词
- 添加更多理论要求

## 如果实用性不足
- 强调给出具体建议
- 要求列举实际案例
```

#### 3. A/B测试

```bash
# 保存旧版本
cp prompts/bazi/professional.txt prompts/bazi/professional_v1.txt

# 修改新版本
vim prompts/bazi/professional.txt

# 测试新版本
./dev.sh

# 对比效果,选择更好的版本
```

## 🔧 故障处理

### 常见问题和解决方案

#### 1. Oracle无法接单

**症状**: 日志显示"Unsupported divination type"

**解决**:
```bash
# 检查supported_divination_types配置
# 八字=1 (0b00000001)
# 梅花=2 (0b00000010)
# 全部=255 (0b11111111)

# 修改config.toml
[oracle]
supported_divination_types = 255
```

#### 2. AI API超时

**症状**: "AI API error: request timeout"

**解决**:
```bash
# 方案1: 增加超时时间
# 在代码中修改reqwest超时设置

# 方案2: 减少max_tokens
[deepseek]
max_tokens = 2048  # 从4096降低
```

#### 3. IPFS上传慢

**症状**: IPFS上传耗时>30秒

**解决**:
```bash
# 方案1: 使用Pinata
IPFS_PINATA_API_KEY=xxx
IPFS_PINATA_SECRET=xxx

# 方案2: 优化本地IPFS
ipfs config --json Datastore.StorageMax '"50GB"'
ipfs config --json Swarm.ConnMgr.HighWater 500
```

#### 4. 内存占用过高

**症状**: 内存使用>2GB

**解决**:
```bash
# 清理缓存
rm -rf data/cache/*

# 限制缓存大小
[cache]
ttl_seconds = 1800  # 从3600降低到30分钟
```

## 📊 性能优化

### 1. 并发处理

修改代码支持并发处理多个请求:
```rust
// 在main.rs中
#[tokio::main]
async fn main() -> Result<()> {
    // 创建任务池
    let max_concurrent = 5;
    let semaphore = Arc::new(Semaphore::new(max_concurrent));

    // 处理请求时获取信号量
    let permit = semaphore.acquire().await?;
    tokio::spawn(async move {
        // 处理请求
        let _permit = permit; // 保持所有权直到完成
    });
}
```

### 2. 缓存相似八字

```rust
// 计算八字相似度
fn calculate_similarity(chart1: &BaziData, chart2: &BaziData) -> f32 {
    // 如果四柱完全相同,相似度100%
    if chart1 == chart2 {
        return 1.0;
    }

    // 如果日柱相同,相似度50%
    if chart1.day_pillar == chart2.day_pillar {
        return 0.5;
    }

    0.0
}

// 查询缓存
if let Some(cached) = cache.get_similar(&bazi_data, 0.8) {
    return Ok(cached);
}
```

### 3. 批量处理

支持一次处理多个请求:
```rust
async fn batch_process(&self, request_ids: Vec<u64>) -> Result<Vec<String>> {
    // 批量获取数据
    let data_list = futures::future::join_all(
        request_ids.iter().map(|id| self.fetch_data(*id))
    ).await;

    // 批量调用AI
    // DeepSeek支持batch API

    Ok(cids)
}
```

## ✅ 验收标准

Week 1-2完成后,应达到:

- [x] Oracle节点成功注册
- [x] 能够监听和处理解读请求
- [x] AI解读质量达到可用标准
- [x] IPFS存储稳定可靠
- [x] 平均处理时间 < 2分钟
- [x] 成功率 > 95%
- [x] 用户评分 >= 4.0/5.0

## 📈 下一步计划

Week 3-4:
1. 支持更多占卜类型(六爻、奇门)
2. 实现Prompt自动优化
3. 添加Web管理界面
4. 部署到生产环境

## 📞 获取帮助

遇到问题?
1. 查看 [README.md](README.md)
2. 搜索GitHub Issues
3. 加入Discord/Telegram讨论组
4. 提交Issue获取支持

---

祝部署顺利! 🎉
