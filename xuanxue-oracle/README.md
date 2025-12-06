# Xuanxue Oracle Node

玄学AI解读Oracle节点服务 - 为Stardust区块链提供AI驱动的占卜解读服务。

## 📋 项目概述

本项目实现了一个去中心化的Oracle节点,通过监听Stardust区块链上的解读请求事件,调用DeepSeek等AI模型生成专业的玄学解读,并将结果存储到IPFS,最后提交CID到链上。

### 支持的占卜类型

- ✅ **八字命理** (Bazi) - 四柱八字排盘解读
- ✅ **梅花易数** (Meihua) - 梅花易数卦象解读
- ✅ **六爻占卜** (Liuyao) - 六爻卦象解读
- 🔄 **奇门遁甲** (Qimen) - 待实现
- 🔄 **紫微斗数** (Ziwei) - 待实现
- 🔄 **塔罗牌** (Tarot) - 待实现

### 支持的解读类型

- **基础解读** (Basic) - 简要分析,800-1000字
- **详细解读** (Detailed) - 全面解读,1200-1500字
- **专业解读** (Professional) - 深度分析,1500-2000字
- **专项解读** - 事业/感情/健康/财运/学业/流年

## 🚀 快速开始

### 前置要求

- Rust 1.70+
- Substrate节点 (Stardust)
- DeepSeek API Key
- IPFS节点 或 Pinata账户

### 安装步骤

1. **克隆项目**
```bash
cd xuanxue-oracle
```

2. **配置环境**
```bash
cp .env.example .env
# 编辑.env文件,填入你的API密钥
vim .env
```

必须配置的项:
- `DEEPSEEK_API_KEY` - DeepSeek API密钥
- `CHAIN_WS_ENDPOINT` - 区块链WebSocket端点
- `ORACLE_ACCOUNT_SEED` - Oracle账户助记词/种子

3. **编译项目**
```bash
cargo build --release
```

4. **启动节点**
```bash
./start.sh
```

或开发模式:
```bash
./dev.sh
```

## ⚙️ 配置说明

### config.toml

```toml
[chain]
ws_endpoint = "ws://127.0.0.1:9944"
oracle_account_seed = "//Alice"

[deepseek]
api_key = "${DEEPSEEK_API_KEY}"
model = "deepseek-chat"
temperature = 0.7
max_tokens = 4096

[ipfs]
api_url = "http://127.0.0.1:5001"
# 或使用Pinata
# pinata_api_key = "${IPFS_PINATA_API_KEY}"
# pinata_secret = "${IPFS_PINATA_SECRET}"

[oracle]
name = "AI-Oracle-1"
supported_divination_types = 255  # 所有类型
supported_interpretation_types = 511  # 所有解读类型
```

### 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API密钥 | ✅ |
| `CHAIN_WS_ENDPOINT` | 区块链端点 | ✅ |
| `ORACLE_ACCOUNT_SEED` | Oracle账户种子 | ✅ |
| `IPFS_API_URL` | IPFS节点地址 | 可选 |
| `IPFS_PINATA_API_KEY` | Pinata API Key | 可选 |
| `IPFS_PINATA_SECRET` | Pinata Secret | 可选 |

## 📁 项目结构

```
xuanxue-oracle/
├── src/
│   ├── main.rs              # 主入口
│   ├── config.rs            # 配置管理
│   ├── error.rs             # 错误定义
│   ├── blockchain/          # 区块链交互
│   │   ├── mod.rs           # 事件监听核心
│   │   ├── events.rs        # 事件解析
│   │   ├── extrinsics.rs    # 交易提交
│   │   ├── queries.rs       # 数据查询
│   │   └── types.rs         # 类型定义
│   ├── ai/                  # AI服务
│   │   ├── mod.rs           # AI服务核心
│   │   ├── deepseek.rs      # DeepSeek客户端
│   │   └── prompt_builder.rs # Prompt构造
│   ├── storage/             # 存储服务
│   │   └── mod.rs           # IPFS客户端
│   ├── divination/          # 占卜数据
│   │   └── mod.rs           # 数据获取器
│   └── utils/               # 工具函数
│       ├── mod.rs
│       └── logger.rs        # 日志工具
├── prompts/                 # Prompt模板
│   ├── bazi/
│   │   ├── basic.txt
│   │   ├── professional.txt
│   │   └── default.txt
│   ├── meihua/
│   │   └── default.txt
│   └── liuyao/
│       └── default.txt
├── Cargo.toml              # 依赖配置
├── config.toml             # 运行时配置
├── .env.example            # 环境变量示例
├── start.sh                # 启动脚本
├── dev.sh                  # 开发脚本
└── test.sh                 # 测试脚本
```

## 🔄 工作流程

1. **监听事件** - 订阅区块链的`InterpretationRequested`事件
2. **检查能力** - 验证节点是否支持该占卜类型和解读类型
3. **接受请求** - 调用`accept_request`交易接单
4. **获取数据** - 从链上查询完整的占卜数据
5. **构造Prompt** - 根据占卜类型和数据构造AI Prompt
6. **调用AI** - 请求DeepSeek API生成解读
7. **上传IPFS** - 将解读内容上传到IPFS获取CID
8. **提交结果** - 调用`submit_result`交易提交CID到链上
9. **等待评分** - 用户查看解读并评分

## 🧪 测试

```bash
# 运行所有测试
./test.sh

# 或使用cargo
cargo test

# 测试特定模块
cargo test --package xuanxue-oracle --lib blockchain
```

## 📊 性能指标

- **处理速度**: 30-120秒/次 (取决于AI响应时间)
- **并发能力**: 支持多请求并行处理
- **可用性**: 24/7 自动监听和处理
- **准确性**: 基于专业Prompt模板,质量稳定

## 🔒 安全考虑

1. **私钥安全**:
   - 使用环境变量存储敏感信息
   - 生产环境建议使用硬件钱包

2. **API密钥**:
   - 不要将.env文件提交到版本控制
   - 定期轮换API密钥

3. **质押要求**:
   - Oracle需要质押DUST代币
   - 恶意行为会被惩罚

4. **争议机制**:
   - 用户可对低质量解读提出争议
   - 仲裁员裁决,保护双方权益

## 💰 经济模型

### 费用分配

每次解读的费用分配:
- **Oracle**: 70% (覆盖AI API成本和运营)
- **Treasury**: 20% (生态发展)
- **Burn**: 5% (代币通缩)
- **Staking Pool**: 5% (质押奖励)

### 成本分析

- AI API成本: ¥0.001-0.01/次
- IPFS存储: 基本免费
- 服务器: ¥300/月 (可运行多个Oracle)
- **利润率**: >99%

### 收益示例

假设每次解读费用75 DUST (≈$7.5):
- Oracle收入: 52.5 DUST (≈$5.25)
- 成本: ¥0.01 (≈$0.0015)
- 净利润: ≈$5.25/次

## 🛠️ 故障排查

### 常见问题

**1. 无法连接到区块链**
```bash
# 检查节点是否运行
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
     ws://localhost:9944
```

**2. IPFS上传失败**
```bash
# 检查IPFS节点
ipfs id

# 或使用Pinata替代
# 在.env中配置IPFS_PINATA_API_KEY
```

**3. AI API错误**
```bash
# 验证API密钥
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"
```

**4. Oracle未注册**
```bash
# 查看日志确认注册状态
# 手动调用register_oracle
```

## 📈 监控和日志

### 日志级别

```bash
# 设置日志级别
export RUST_LOG=info,xuanxue_oracle=debug

# 或在.env中配置
RUST_LOG=info,xuanxue_oracle=debug
```

### 关键日志

- `InterpretationRequested` - 收到新请求
- `Request accepted` - 接受请求
- `AI interpretation generated` - AI生成完成
- `Uploaded to IPFS` - IPFS上传成功
- `Result submitted` - 结果已提交

## 🔮 未来计划

- [ ] 支持更多AI模型 (GLM-4, Claude, etc.)
- [ ] 实现流式输出(SSE)
- [ ] 添加质量自动评估
- [ ] 支持多语言解读
- [ ] 实现缓存机制(相似八字)
- [ ] 添加监控和告警
- [ ] Web管理界面

## 🤝 贡献指南

欢迎提交Issue和Pull Request!

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 许可证

MIT-0 License

## 📞 联系方式

- GitHub Issues: [提交问题](https://github.com/your-repo/xuanxue-oracle/issues)
- 邮箱: your-email@example.com

## 🙏 致谢

- Substrate/Polkadot SDK
- DeepSeek AI
- IPFS
- Rust社区

---

**注意**: 本项目用于教育和研究目的。解读结果仅供参考,不应作为人生决策的唯一依据。
