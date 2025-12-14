# Xuanxue Oracle - 测试指南

本文档说明如何测试 xuanxue-oracle 节点与 DeepSeek API 的通信。

## 📋 测试脚本概览

项目提供了三个测试脚本，覆盖不同的测试场景：

### 1. `test_oracle_deepseek.sh` - 完整集成测试（推荐）

**功能**: 全面的集成测试套件，包含 10 个测试项目

**测试内容**:
- ✅ 环境配置检查
- ✅ 网络连接测试（DNS、HTTPS、延迟）
- ✅ DeepSeek API 基础功能测试
- ✅ API 错误处理测试
- ✅ Rust 代码编译测试
- ✅ Rust 单元测试
- ✅ 玄学解读场景测试（八字、六爻、梅花易数）
- ✅ 性能和并发测试
- ✅ 知识库集成测试
- ✅ 端到端集成测试

**使用方法**:
```bash
cd xuanxue-oracle
./test_oracle_deepseek.sh
```

**输出示例**:
```
🔮 Xuanxue Oracle - DeepSeek API 集成测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

测试统计：
  • 测试项目数: 10
  • 通过: 19
  • 失败: 0
  • 警告: 2
  • 总耗时: 59s

成功率：100%
🎉 测试评级: 优秀
   xuanxue-oracle 节点与 DeepSeek API 通信正常！
```

---

### 2. `test_deepseek_simple.sh` - 快速连接测试

**功能**: 快速验证基本连接和 API 调用

**测试内容**:
- 网络连接检查
- 简单的 API 调用测试

**使用方法**:
```bash
./test_deepseek_simple.sh
```

**适用场景**:
- 快速验证 API Key 是否有效
- 检查网络连接是否正常
- 日常开发中的快速测试

---

### 3. `test_deepseek.sh` - 综合测试

**功能**: 包含 API 测试和 Rust 代码测试

**测试内容**:
- 环境配置检查
- 网络连接测试
- DeepSeek API 调用
- Rust 单元测试
- 集成测试

**使用方法**:
```bash
./test_deepseek.sh
```

---

### 4. `test_knowledge.sh` - 知识库测试

**功能**: 验证八字知识库文件的完整性和格式

**测试内容**:
- 知识库文件存在性检查
- JSON 格式验证
- 知识库内容统计
- 查询示例

**使用方法**:
```bash
./test_knowledge.sh
```

---

## 🔧 前置要求

### 1. 环境配置

确保已创建 `.env` 文件并配置以下参数：

```bash
# DeepSeek AI API
DEEPSEEK_API_KEY=sk-your-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# 区块链配置
CHAIN_WS_ENDPOINT=ws://127.0.0.1:9944
ORACLE_ACCOUNT_SEED=your-seed-phrase-here

# Oracle配置
ORACLE_NAME=AI-Oracle-1
SUPPORTED_DIVINATION_TYPES=0,1,2,3,4,6,7,8
SUPPORTED_INTERPRETATION_TYPES=0,1,2,3,4,5,6,7,8
MIN_ORACLE_RATING=0
```

可以从 `.env.example` 复制模板：
```bash
cp .env.example .env
# 然后编辑 .env 文件，填入你的 API Key
```

### 2. 系统依赖

确保已安装以下工具：

- **Rust** (1.70+): `cargo --version`
- **curl**: 用于 HTTP 请求
- **Python3** (可选): 用于 JSON 解析
- **jq** (可选): 用于 JSON 格式化

安装依赖（Ubuntu/Debian）：
```bash
sudo apt-get update
sudo apt-get install curl python3 jq
```

### 3. Rust 项目构建

首次运行测试前，建议先编译项目：
```bash
cargo build --release
```

---

## 🚀 快速开始

### 步骤 1: 配置环境

```bash
# 1. 进入项目目录
cd xuanxue-oracle

# 2. 创建配置文件
cp .env.example .env

# 3. 编辑配置文件，填入你的 DeepSeek API Key
nano .env  # 或使用其他编辑器
```

### 步骤 2: 运行快速测试

```bash
# 快速验证连接
chmod +x test_deepseek_simple.sh
./test_deepseek_simple.sh
```

### 步骤 3: 运行完整测试

```bash
# 完整的集成测试
chmod +x test_oracle_deepseek.sh
./test_oracle_deepseek.sh
```

---

## 📊 测试结果解读

### 成功指标

- **成功率 >= 90%**: 优秀 - 系统运行正常
- **成功率 >= 70%**: 良好 - 大部分功能正常
- **成功率 < 70%**: 需要改进 - 存在严重问题

### 常见问题

#### 1. API Key 无效
```
❌ API 请求失败 (HTTP 401)
```
**解决方案**: 检查 `.env` 文件中的 `DEEPSEEK_API_KEY` 是否正确

#### 2. 网络连接失败
```
❌ 无法连接到 api.deepseek.com
```
**解决方案**:
- 检查网络连接
- 检查防火墙设置
- 验证是否可以访问 https://api.deepseek.com

#### 3. API 配额用尽
```
❌ API 请求失败 (HTTP 429)
```
**解决方案**: 等待配额重置或升级 API 套餐

#### 4. 编译失败
```
❌ 项目编译失败
```
**解决方案**:
```bash
# 清理并重新编译
cargo clean
cargo build --release
```

---

## 🔍 测试详情

### 测试 1: 环境配置检查
验证所有必需的环境变量和工具是否正确配置。

### 测试 2: 网络连接测试
- DNS 解析测试
- HTTPS 连接测试
- 网络延迟测试

**性能标准**:
- < 500ms: 优秀
- 500-1000ms: 良好
- 1000-2000ms: 一般
- \> 2000ms: 较慢

### 测试 3: API 基础功能测试
发送简单的测试请求，验证 API 响应格式和内容。

**验证项**:
- HTTP 状态码 200
- 响应 JSON 格式正确
- AI 回复内容非空
- Token 使用统计

### 测试 4: API 错误处理测试
验证系统对错误情况的处理：
- 无效 API Key → 401/403
- 空请求 → 400/422

### 测试 5: Rust 代码编译测试
验证项目代码可以正确编译。

### 测试 6: Rust 单元测试
运行 DeepSeek 客户端的单元测试。

### 测试 7: 玄学解读场景测试
测试三种占卜场景：
- 八字命理解读
- 六爻占卜解释
- 梅花易数起卦

### 测试 8: 性能和并发测试
并发发送 5 个请求，测试：
- 并发处理能力
- 平均响应时间
- 成功率

### 测试 9: 知识库集成测试
验证知识库文件的完整性：
- 目录结构
- 文件存在性
- JSON 格式

### 测试 10: 端到端集成测试
模拟完整的八字命理解读流程：
1. 构建完整的八字数据
2. 发送到 DeepSeek API
3. 获取详细的命理解读
4. 验证响应质量

---

## 📝 日志文件

测试运行时会生成详细的日志文件：

```bash
/tmp/oracle_test_YYYYMMDD_HHMMSS.log
```

日志包含：
- 每个测试的详细输出
- API 请求和响应
- 错误信息和警告
- 时间戳

查看日志：
```bash
# 查看最新的测试日志
ls -lt /tmp/oracle_test_*.log | head -1 | awk '{print $9}' | xargs cat
```

---

## 🛠️ 开发建议

### 日常开发流程

1. **修改代码后**:
```bash
# 快速编译检查
cargo check

# 运行快速测试
./test_deepseek_simple.sh
```

2. **提交代码前**:
```bash
# 运行完整测试
./test_oracle_deepseek.sh

# 确保所有测试通过
```

3. **部署前**:
```bash
# 编译 release 版本
cargo build --release

# 运行完整测试套件
./test_oracle_deepseek.sh
./test_knowledge.sh
```

### 自定义测试

可以基于现有脚本创建自定义测试：

```bash
# 示例：测试特定的占卜类型
curl -X POST "https://api.deepseek.com/v1/chat/completions" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": "你是八字命理专家"},
      {"role": "user", "content": "解读甲子日柱"}
    ]
  }'
```

---

## 📚 相关文档

- [DeepSeek API 文档](https://platform.deepseek.com/api-docs/)
- [Rust 测试指南](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [项目 README](../README.md)

---

## 💡 提示

- 定期运行测试以确保系统稳定性
- 测试失败时查看详细日志文件
- API 请求有频率限制，避免过于频繁的测试
- 生产环境部署前务必运行完整测试套件

---

**测试脚本版本**: 1.0.0
**最后更新**: 2025-12-07
**维护团队**: Stardust Team
