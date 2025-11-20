# Phase 4 Week 1 Day 1 快速开始

## 🎯 任务目标

**评估集成测试框架（Zombienet vs Chopsticks）**  
**预期时间**: 1天  
**预期结果**: 选定框架并生成决策报告  

---

## 📋 任务分解

### 上午任务（4小时）

#### 1. Zombienet调研（2小时）

**官方资源**:
- GitHub: https://github.com/paritytech/zombienet
- 文档: https://paritytech.github.io/zombienet/
- 示例: https://github.com/paritytech/zombienet/tree/main/examples

**关键特性调研**:
- [ ] 多节点网络模拟能力
- [ ] 配置文件格式（TOML）
- [ ] 支持的测试DSL
- [ ] 资源消耗（CPU/内存）
- [ ] 学习曲线评估

**快速示例**:
```toml
# zombienet-config.toml
[relaychain]
default_command = "polkadot"
chain = "rococo-local"

  [[relaychain.nodes]]
  name = "alice"
  validator = true

  [[relaychain.nodes]]
  name = "bob"
  validator = true

[[parachains]]
id = 2000
chain = "stardust-local"

  [[parachains.collators]]
  name = "collator-01"
  command = "stardust-node"
```

---

#### 2. Chopsticks调研（2小时）

**官方资源**:
- GitHub: https://github.com/AcalaNetwork/chopsticks
- 文档: https://github.com/AcalaNetwork/chopsticks/blob/master/README.md
- 示例: https://github.com/AcalaNetwork/chopsticks/tree/master/configs

**关键特性调研**:
- [ ] Fork链能力（可以fork Polkadot/Kusama）
- [ ] 轻量级特性
- [ ] 配置文件格式（YAML）
- [ ] API支持（Polkadot.js兼容）
- [ ] 启动速度

**快速示例**:
```yaml
# chopsticks-config.yml
endpoint: ws://localhost:9944
mock-signature-host: true
db: ./db.sqlite
port: 8000

import-storage:
  System:
    Account:
      - [5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY]
      - free: 1000000000000000
```

---

### 下午任务（4小时）

#### 3. 实践对比（2小时）

**Zombienet实践**:
```bash
# 1. 安装Zombienet
wget https://github.com/paritytech/zombienet/releases/latest/download/zombienet-linux-x64
chmod +x zombienet-linux-x64
sudo mv zombienet-linux-x64 /usr/local/bin/zombienet

# 2. 准备节点二进制
# 需要polkadot和parachain节点

# 3. 运行测试网络
zombienet spawn zombienet-config.toml
```

**Chopsticks实践**:
```bash
# 1. 安装Chopsticks
npm install -g @acala-network/chopsticks

# 2. 创建配置
cat > stardust-local.yml << EOF
endpoint: ws://localhost:9944
mock-signature-host: true
db: ./chopsticks-db.sqlite
EOF

# 3. 启动测试链
chopsticks --config stardust-local.yml
```

---

#### 4. 决策与报告（2小时）

**对比维度**:

| 维度 | Zombienet | Chopsticks | 权重 |
|------|-----------|-----------|------|
| 学习曲线 | 较陡 | 平缓 | 20% |
| 功能完整性 | 完整（中继链+平行链） | 有限（单链为主） | 30% |
| 资源消耗 | 高（多节点） | 低（单进程） | 15% |
| 启动速度 | 慢（~5分钟） | 快（~30秒） | 15% |
| 调试友好度 | 中等 | 高 | 10% |
| 社区支持 | Parity官方 | Acala社区 | 10% |

**决策框架**:
1. **快速验证场景** → Chopsticks优先
2. **完整集成测试** → Zombienet优先
3. **平衡方案** → 两者结合

---

## 🎯 今日目标

### 必达目标（P0）

- [ ] 完成Zombienet调研
- [ ] 完成Chopsticks调研
- [ ] 至少运行1个框架的demo
- [ ] 生成决策报告

### 重要目标（P1）

- [ ] 两个框架都运行demo
- [ ] 性能对比数据记录
- [ ] 创建测试模板

### 期望目标（P2）

- [ ] 编写第一个集成测试
- [ ] 配置CI集成
- [ ] 团队分享

---

## 📝 决策报告模板

```markdown
# Phase 4 Week 1 Day 1 - 集成测试框架选择

## 调研结果

### Zombienet
- 优势：...
- 劣势：...
- 适用场景：...

### Chopsticks
- 优势：...
- 劣势：...
- 适用场景：...

## 对比分析

| 维度 | Zombienet | Chopsticks | 选择 |
|------|-----------|-----------|------|
| ... | ... | ... | ... |

## 最终决策

**阶段1（Week 1-2）**: 使用 [框架名称]
**理由**: ...

**阶段2（Week 3+）**: 引入 [框架名称]
**理由**: ...

## 下一步行动

1. ...
2. ...
```

---

## 🔧 环境准备

### 系统要求

```bash
# 检查系统
uname -a
# 检查可用内存
free -h
# 检查磁盘空间
df -h
```

### 依赖安装

```bash
# Node.js（Chopsticks需要）
node --version  # 需要 >= 16

# Rust（构建节点需要）
rustc --version

# 其他工具
which wget
which curl
```

### 项目节点准备

```bash
# 构建stardust节点（如果需要）
cd /home/xiaodong/文档/stardust
cargo build --release

# 验证节点可运行
./target/release/stardust-node --version
```

---

## 📚 参考资源

### Zombienet
- 官方仓库: https://github.com/paritytech/zombienet
- 快速开始: https://paritytech.github.io/zombienet/intro.html
- 配置示例: https://github.com/paritytech/zombienet/tree/main/examples

### Chopsticks
- 官方仓库: https://github.com/AcalaNetwork/chopsticks
- README: https://github.com/AcalaNetwork/chopsticks/blob/master/README.md
- 配置示例: https://github.com/AcalaNetwork/chopsticks/tree/master/configs

### Substrate测试
- 测试指南: https://docs.substrate.io/test/
- 集成测试: https://docs.substrate.io/test/integration-testing/

---

## ⚠️ 注意事项

### Zombienet注意事项

1. **资源消耗**: 至少需要4GB内存、2核CPU
2. **端口占用**: 默认使用9944、9933等端口
3. **二进制准备**: 需要提前准备polkadot和parachain节点二进制

### Chopsticks注意事项

1. **Node.js版本**: 必须 >= 16
2. **网络依赖**: 需要连接到真实节点（如果fork）
3. **状态限制**: Fork的状态可能很大，注意磁盘空间

---

## 🎯 成功标准

### 今日完成标准

- [x] 理解两个框架的核心差异
- [x] 至少运行1个框架的demo成功
- [x] 生成决策报告（包含推荐方案）
- [x] 明确Week 1后续任务

### 输出物

1. `Phase4-Week1-Day1-Zombienet调研.md`
2. `Phase4-Week1-Day1-Chopsticks调研.md`
3. `Phase4-Week1-Day1-框架选择决策.md`
4. `Phase4-Week1-Day1-完成报告.md`

---

## 🚀 立即开始

### 第一步：Zombienet快速了解

```bash
# 1. 打开Zombienet GitHub
firefox https://github.com/paritytech/zombienet &

# 2. 阅读README（15分钟）

# 3. 查看示例配置（15分钟）
firefox https://github.com/paritytech/zombienet/tree/main/examples &
```

### 第二步：Chopsticks快速了解

```bash
# 1. 打开Chopsticks GitHub
firefox https://github.com/AcalaNetwork/chopsticks &

# 2. 阅读README（15分钟）

# 3. 查看配置示例（15分钟）
```

### 第三步：选择优先实践

**推荐**: 先实践Chopsticks（更简单）
```bash
# 安装Chopsticks
npm install -g @acala-network/chopsticks

# 创建简单配置
# 启动测试链
# 使用Polkadot.js Apps连接测试
```

---

**Phase 4 Week 1 Day 1 开始！** 🎯

**今日口号**: 选对工具，事半功倍！

