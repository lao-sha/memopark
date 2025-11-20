# Frontier 官方支持监控计划

## 📋 方案确认

**选择方案**: A - 等待官方支持 ⭐️⭐️⭐️⭐️⭐️

**决策时间**: 2025-11-03

**决策理由**:
- ✅ 最稳妥可靠的方案
- ✅ 不需要修改代码
- ✅ 保证长期稳定性和安全性
- ✅ 避免技术债务
- ✅ 所有配置代码已完整保留

---

## 🎯 当前状态

### 系统状态
- ✅ Polkadot-SDK: stable2506（已升级）
- ✅ Runtime: 编译成功，运行正常
- ✅ Node: 启动成功，正常出块
- ✅ 所有非 EVM 功能: 正常工作
- ⚠️ Frontier: 临时禁用（配置已保留）

### 已保留的配置代码
1. ✅ `runtime/src/configs/evm.rs` - 完整的 EVM 配置（187 行）
2. ✅ `runtime/src/lib.rs` - Frontier pallet 声明（已注释）
3. ✅ `runtime/src/configs/mod.rs` - evm 模块引用（已注释）
4. ✅ `Cargo.toml` - Frontier 依赖声明
5. ✅ `runtime/Cargo.toml` - Frontier pallet 依赖

**启用方式**: 只需取消注释相关代码，重新编译即可

---

## 📅 监控时间线

### 第 1 阶段: 初始监控（2025-11 ～ 2025-12）

**时间**: 2025-11-03 开始，持续 1 个月

**监控频率**: 每 2 周检查一次

**监控内容**:
- [ ] Frontier Releases: https://github.com/polkadot-evm/frontier/releases
- [ ] Polkadot-SDK Releases: https://github.com/paritytech/polkadot-sdk/releases
- [ ] Substrate Stack Exchange: https://substrate.stackexchange.com/
- [ ] Frontier GitHub Issues: https://github.com/polkadot-evm/frontier/issues
- [ ] Parity Blog: https://www.parity.io/blog

**检查日期**:
- [ ] 2025-11-17（第 1 次检查）
- [ ] 2025-12-01（第 2 次检查）
- [ ] 2025-12-15（第 3 次检查）

### 第 2 阶段: 持续监控（2025-12 ～ 2026-02）

**时间**: 持续 2 个月

**监控频率**: 每 2 周检查一次

**监控内容**:
- [ ] 继续监控上述渠道
- [ ] 关注社区讨论中的 `ext_storage_proof_size` 相关话题
- [ ] 查看类似项目（Moonbeam、Astar）的更新

**检查日期**:
- [ ] 2026-01-01
- [ ] 2026-01-15
- [ ] 2026-02-01
- [ ] 2026-02-15

### 第 3 阶段: 测试验证（发现兼容版本时）

**触发条件**: 发现以下任一情况
- Frontier 发布新的稳定版本（如 stable2507、stable2508）
- Polkadot-SDK 发布包含 Frontier 兼容性的更新
- 官方文档说明 `ext_storage_proof_size` 问题已解决
- 社区确认 Frontier 可正常使用

**验证步骤**:
1. [ ] 更新 Frontier 依赖版本
2. [ ] 取消注释 Frontier 配置
3. [ ] 编译测试
4. [ ] 节点启动测试
5. [ ] 基础功能测试
6. [ ] 完整集成测试

**预计时长**: 1-2 周

---

## 🔍 监控方法

### 方法 1: GitHub Releases 监控

**Frontier Releases**:
```bash
# 每 2 周执行一次
cd ~/.cargo/git/checkouts/frontier-*
git fetch origin
git tag | grep stable | tail -10

# 查看最新的 stable 分支
git branch -r | grep stable
```

**Polkadot-SDK Releases**:
```bash
# 每 2 周执行一次
cd ~/.cargo/git/checkouts/polkadot-sdk-*
git fetch origin
git tag | grep polkadot-v | tail -10

# 查看 stable 分支
git branch -r | grep stable
```

**在线查看**:
- Frontier: https://github.com/polkadot-evm/frontier/tags
- Polkadot-SDK: https://github.com/paritytech/polkadot-sdk/tags

### 方法 2: GitHub Watch 订阅

**推荐设置**:
1. 访问 https://github.com/polkadot-evm/frontier
2. 点击右上角 "Watch" → "Custom"
3. 勾选:
   - ✅ Releases
   - ✅ Discussions
   - ✅ Issues（可选）

4. 访问 https://github.com/paritytech/polkadot-sdk
5. 重复上述步骤

**结果**: GitHub 会发送邮件通知新版本发布

### 方法 3: RSS 订阅

**Frontier Releases RSS**:
```
https://github.com/polkadot-evm/frontier/releases.atom
```

**Polkadot-SDK Releases RSS**:
```
https://github.com/paritytech/polkadot-sdk/releases.atom
```

**使用工具**:
- Feedly: https://feedly.com/
- Inoreader: https://www.inoreader.com/
- 浏览器 RSS 插件

### 方法 4: Substrate Stack Exchange

**监控关键词**:
- `frontier`
- `ext_storage_proof_size`
- `evm substrate`
- `pallet-evm stable2506`

**订阅方式**:
1. 访问 https://substrate.stackexchange.com/
2. 搜索关键词
3. 点击右侧 "Subscribe to RSS"

### 方法 5: Discord/Telegram 社区

**Polkadot Discord**:
- 链接: https://discord.gg/polkadot
- 频道: `#dev-support`, `#frontier`, `#substrate-dev`

**Substrate Builders Program**:
- 链接: https://substrate.io/ecosystem/substrate-builders-program/

---

## 📊 检查清单

### 每次检查时使用

```markdown
## Frontier 监控检查 - [日期]

### 1. Frontier 仓库检查
- [ ] 访问 https://github.com/polkadot-evm/frontier/releases
- [ ] 最新版本: _____________
- [ ] 是否有新的 stable 分支: [ ] 是 [ ] 否
- [ ] 分支名称: _____________
- [ ] Release Notes 中是否提到兼容性改进: [ ] 是 [ ] 否

### 2. Polkadot-SDK 仓库检查
- [ ] 访问 https://github.com/paritytech/polkadot-sdk/releases
- [ ] 最新版本: _____________
- [ ] 是否有新的 stable 分支: [ ] 是 [ ] 否
- [ ] 分支名称: _____________
- [ ] Release Notes 中是否提到 Frontier: [ ] 是 [ ] 否

### 3. 社区讨论检查
- [ ] Substrate Stack Exchange 新问题: ___ 条
- [ ] 相关讨论: _____________
- [ ] Discord 重要信息: _____________

### 4. 类似项目检查
- [ ] Moonbeam 最新更新: _____________
- [ ] Astar 最新更新: _____________
- [ ] 其他 EVM 兼容链更新: _____________

### 5. 行动决策
- [ ] 是否发现兼容版本: [ ] 是 [ ] 否
- [ ] 是否需要立即测试: [ ] 是 [ ] 否
- [ ] 下次检查日期: _____________

### 备注
_____________________________________________
_____________________________________________
```

**保存位置**: 创建 `docs/Frontier-监控日志.md` 记录每次检查结果

---

## 🚀 快速启用指南

### 当发现兼容版本时

**步骤 1: 更新依赖**

```bash
cd /home/xiaodong/文档/stardust

# 编辑 Cargo.toml，更新 Frontier 版本
# 例如: branch = "stable2506" → branch = "stable2507"
```

**步骤 2: 取消注释配置**

```bash
# 编辑 runtime/src/lib.rs
# 取消注释 Frontier pallet 声明（约 25 行）
# 从第 554 行开始

# 编辑 runtime/src/configs/mod.rs
# 取消注释 evm 模块引用（约 2 行）
# 第 2702-2703 行
```

**步骤 3: 编译测试**

```bash
# 清理旧构建
cargo clean

# 编译 runtime
cargo build --release -p stardust-runtime 2>&1 | tee build.log

# 如果成功，编译完整节点
cargo build --release 2>&1 | tee build-full.log
```

**步骤 4: 启动测试**

```bash
# 启动开发节点
./target/release/stardust-node --dev --tmp

# 检查是否出现错误:
# - ✅ 没有 ext_storage_proof_size 错误 → 成功！
# - ❌ 仍有错误 → 记录错误信息，继续等待
```

**步骤 5: 功能验证**

如果节点启动成功，进行基础验证：

```bash
# 1. 检查节点日志
# 2. 检查是否正常出块
# 3. 使用 polkadot.js.org/apps 连接
# 4. 查看 EVM pallet 是否可用
```

**步骤 6: 完整测试**

参考 `docs/Frontier集成-测试手册.md` 进行完整功能测试：
- MetaMask 连接测试
- 简单合约部署
- 基本交易测试
- Gas 费用测试

---

## 📝 记录模板

### 创建监控日志文件

```bash
cd /home/xiaodong/文档/stardust
touch docs/Frontier-监控日志.md
```

**初始内容**:

```markdown
# Frontier 监控日志

## 监控目标

- **开始日期**: 2025-11-03
- **目标**: 等待 Frontier 官方支持 ext_storage_proof_size host 函数
- **当前状态**: 监控中

---

## 检查记录

### 2025-11-17 - 第 1 次检查

**检查人员**: _____________
**检查时间**: _____________

**Frontier 仓库**:
- 最新版本: _____________
- 新版本发布: [ ] 是 [ ] 否
- 相关更新: _____________

**Polkadot-SDK 仓库**:
- 最新版本: _____________
- 新版本发布: [ ] 是 [ ] 否
- 相关更新: _____________

**社区动态**:
- _____________

**决策**:
- [ ] 继续等待
- [ ] 开始测试
- 下次检查: _____________

---

### 2025-12-01 - 第 2 次检查

（待填写）

---

## 重要发现

### [日期] - [标题]

**来源**: _____________
**内容**: _____________
**影响**: _____________
**行动**: _____________

---
```

---

## 🎯 期望时间线

### 乐观情况（1-2 个月）

```
2025-11-03 (今天)
    ↓
    | 监控阶段
    ↓
2025-12-15 ~ 2026-01-15
    ↓
    | 发现兼容版本
    ↓
2026-01-15 ~ 2026-01-22
    ↓
    | 测试验证（1 周）
    ↓
2026-01-22 ~ 2026-02-05
    ↓
    | 完整集成（2 周）
    ↓
2026-02-05
    ✅ Frontier 完全启用
```

### 正常情况（2-3 个月）

```
2025-11-03 (今天)
    ↓
    | 监控阶段
    ↓
2026-01-15 ~ 2026-02-15
    ↓
    | 发现兼容版本
    ↓
2026-02-15 ~ 2026-02-22
    ↓
    | 测试验证（1 周）
    ↓
2026-02-22 ~ 2026-03-08
    ↓
    | 完整集成（2 周）
    ↓
2026-03-08
    ✅ Frontier 完全启用
```

### 保守情况（3-6 个月）

```
2025-11-03 (今天)
    ↓
    | 监控阶段
    ↓
2026-02-15 ~ 2026-05-15
    ↓
    | 发现兼容版本
    ↓
（后续同上）
```

---

## 💡 期间可进行的工作

### 继续开发其他功能

**优先级列表**:
1. 完善现有 60+ pallets 的功能
2. 开发前端 dApp 功能
3. 优化性能和用户体验
4. 准备测试用例和文档
5. 准备 EVM 相关的营销材料

### 准备 Frontier 集成后的工作

**文档准备**:
- [ ] EVM 使用手册
- [ ] Solidity 开发者指南
- [ ] MetaMask 连接教程
- [ ] 合约部署教程

**测试准备**:
- [ ] 准备测试合约代码
- [ ] 准备测试脚本
- [ ] 准备性能基准测试

**前端准备**:
- [ ] 设计 EVM 交互界面
- [ ] 准备 ethers.js/web3.js 集成
- [ ] 准备 MetaMask 连接组件

### 技术学习

**建议学习内容**:
1. **深入了解 Frontier 架构**
   - 阅读 Frontier 文档
   - 研究 Moonbeam 源代码
   - 了解 EVM ↔ Substrate 桥接机制

2. **学习 Solidity 开发**
   - 准备示例合约
   - 了解 Gas 优化技巧
   - 学习安全最佳实践

3. **研究预编译合约**
   - 了解标准预编译
   - 设计自定义预编译方案
   - 准备实施计划

---

## 📞 联系方式和资源

### 官方支持渠道

**Substrate Stack Exchange**:
- URL: https://substrate.stackexchange.com/
- 提问前搜索现有问题
- 使用标签: `frontier`, `evm`, `pallet-evm`

**Polkadot Discord**:
- URL: https://discord.gg/polkadot
- 频道: `#dev-support`, `#frontier`
- 礼貌提问，提供完整信息

**GitHub Issues**:
- Frontier: https://github.com/polkadot-evm/frontier/issues
- 报告问题前检查现有 issues
- 提供详细的错误信息和日志

### 参考项目

**Moonbeam** (成熟的 EVM 兼容链):
- GitHub: https://github.com/moonbeam-foundation/moonbeam
- 文档: https://docs.moonbeam.network/

**Astar** (支持 EVM + WASM):
- GitHub: https://github.com/AstarNetwork/Astar
- 文档: https://docs.astar.network/

**Acala** (DeFi 平台):
- GitHub: https://github.com/AcalaNetwork/Acala
- 文档: https://guide.acalaapps.wiki/

---

## 📋 总结

### 已确认的方案
✅ **方案 A: 等待官方支持**

### 监控计划
- 📅 每 2 周检查一次（共 6-12 次）
- 🔍 监控 5 个主要渠道
- 📝 记录每次检查结果

### 预期结果
- ⏱️ 1-3 个月内找到兼容版本
- ✅ 安全稳定地启用 Frontier
- 🚀 完整的 EVM 功能支持

### 备用方案
如果超过 6 个月仍无进展：
- 重新评估方案 B（Feature Flag）
- 考虑联系 Parity 官方技术支持
- 考虑方案 C（手动修复）

---

**文档版本**: v1.0  
**创建时间**: 2025-11-03 20:40 UTC+8  
**负责人**: 项目团队  
**状态**: 🟢 监控中

---

## 附录: 快速命令

### 检查 Frontier 版本
```bash
cd ~/.cargo/git/checkouts/frontier-*
git fetch origin
git tag | grep stable | tail -10
```

### 检查 Polkadot-SDK 版本
```bash
cd ~/.cargo/git/checkouts/polkadot-sdk-*
git fetch origin  
git tag | grep polkadot-v | tail -10
```

### 快速启用 Frontier（当兼容时）
```bash
cd /home/xiaodong/文档/stardust

# 1. 取消注释配置
vim runtime/src/lib.rs       # 第 554-578 行
vim runtime/src/configs/mod.rs  # 第 2702-2703 行

# 2. 编译测试
cargo build --release

# 3. 启动验证
./target/release/stardust-node --dev --tmp
```

