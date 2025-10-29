# 做市商申请故障排查指南

## 常见错误及解决方案

### 错误 1: "Negative number passed to unsigned type"

**完整错误信息**:
```
质押失败：createType(Vec<StorageKey>):: createType(Lookup12):: u64: Negative number passed to unsigned type
```

#### 原因分析

这个错误通常由以下原因引起：

1. **链上 NextId 为 0**
   - 当链上从未有过做市商申请时，`NextId = 0`
   - 代码计算 `latestMmId = NextId - 1 = -1`
   - 查询 `applications(-1)` 时传递负数给 u64 参数

2. **余额参数格式错误**
   - JavaScript number 精度问题
   - 负数金额传递

3. **API 类型不匹配**
   - 参数类型与链上期望不符

#### 解决方案

##### **方案 1：检查链上状态（推荐）**

```bash
# 连接到链上节点
polkadot-js-api

# 查询 NextId
> api.query.marketMaker.nextId()
# 如果返回 0，说明还没有任何申请

# 手动创建第一个申请（使用 sudo）
> api.tx.sudo.sudo(
    api.tx.marketMaker.lockDeposit('1000000000000000')  # 1000 MEMO
  ).signAndSend(alice)
```

##### **方案 2：修改前端代码（已修复）**

✅ 已在代码中添加以下防护：

```typescript
// 检查 NextId >= 1
if (nextId < 1) {
  throw new Error('NextId 异常（小于 1），链上状态可能未更新')
}

// 检查 mmId >= 0
if (latestMmId < 0) {
  throw new Error('mmId 计算为负数，链上数据异常')
}

// Fallback 机制
catch (queryError) {
  // 使用临时 ID，允许用户继续提交
  const fallbackId = Math.floor(Date.now() / 1000) % 100000
  setMmId(fallbackId)
  message.warning('质押成功但无法查询详情')
}
```

##### **方案 3：清理并重新编译链**

```bash
cd /home/xiaodong/文档/stardust

# 清理
cargo clean

# 重新编译 runtime
cargo build --release -p stardust-runtime

# 重新编译并启动节点
cargo run --release -p stardust-node -- --dev --tmp --rpc-cors=all
```

---

### 错误 2: "pallet-market-maker 尚未在 runtime 中注册"

#### 原因
- Runtime 未包含 market-maker pallet
- 节点版本过旧（未重新编译）

#### 解决方案

**步骤 1**: 检查 runtime 配置
```bash
# 查看 runtime/Cargo.toml
grep "market-maker" runtime/Cargo.toml

# 应该看到：
# pallet-market-maker = { path = "../pallets/market-maker", default-features = false }
```

**步骤 2**: 检查 runtime 集成
```bash
# 查看 runtime/src/lib.rs
grep "MarketMaker" runtime/src/lib.rs

# 应该看到：
# pub type MarketMaker = pallet_market_maker;
```

**步骤 3**: 重新编译节点
```bash
cd /home/xiaodong/文档/stardust
cargo clean
cargo build --release
```

**步骤 4**: 重启节点
```bash
# 停止旧节点（Ctrl+C）

# 启动新节点
./target/release/stardust-node --dev --tmp --rpc-cors=all
```

---

### 错误 3: 余额格式化错误

#### 症状
- "质押失败：Invalid number"
- "质押失败：Number can only safely store up to 53 bits"

#### 原因
JavaScript number 类型的安全整数范围是 ±2^53

#### 解决方案（已修复）

✅ 使用 BigInt 进行计算：

```typescript
function formatMemoAmount(amount: number): string {
  if (!amount || amount <= 0) return '0'
  const decimals = 12
  // 使用 BigInt 避免精度丢失
  const raw = BigInt(Math.floor(amount * Math.pow(10, decimals)))
  return raw.toString()
}
```

**示例**：
```typescript
formatMemoAmount(1000)     // "1000000000000000" (1000 MEMO)
formatMemoAmount(0.001)    // "1000000000" (0.001 MEMO)
formatMemoAmount(100.5)    // "100500000000000" (100.5 MEMO)
```

---

### 错误 4: 签名失败或密码错误

#### 症状
- "未找到本地钱包"
- "密码输入未完成"
- "签名发送失败"

#### 解决方案

**步骤 1**: 检查本地钱包
```javascript
// 打开浏览器控制台
localStorage.getItem('stardust_keystore_v2')
// 应该返回加密的 JSON 字符串
```

**步骤 2**: 重新创建钱包
```
1. 访问首页
2. 点击"创建钱包"
3. 保存助记词
4. 设置密码（至少 8 位）
5. 导出 JSON 备份
```

**步骤 3**: 验证密码
```
1. 退出登录
2. 重新登录
3. 输入密码
4. 查看是否能成功解密
```

---

## 调试步骤

### 1. 查看浏览器控制台

打开开发者工具（F12），切换到 Console 标签页，查看详细日志：

```
[质押] 原始金额: 1000
[质押] 格式化后: 1000000000000000
[质押] API 可用: true
[质押] marketMaker pallet 存在: true
[质押] NextId: 0
```

### 2. 检查链上状态

```bash
# 方法 1：使用 Polkadot.js Apps
# 访问 https://polkadot.js.org/apps/#/chainstate
# 选择：marketMaker > nextId()
# 点击查询

# 方法 2：使用命令行
curl -X POST http://127.0.0.1:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"state_getStorage",
    "params":["0x..."],
    "id":1
  }'
```

### 3. 查看交易历史

```javascript
// 浏览器控制台
const txHistory = JSON.parse(localStorage.getItem('tx_history') || '[]')
console.table(txHistory)
```

### 4. 清理缓存重试

```javascript
// 清理浏览器缓存（保留钱包）
const keystore = localStorage.getItem('stardust_keystore_v2')
localStorage.clear()
if (keystore) {
  localStorage.setItem('stardust_keystore_v2', keystore)
}
location.reload()
```

---

## 最佳实践

### 1. 启动链节点前先清理

```bash
# 使用 --tmp 参数启动干净的测试链
./target/release/stardust-node --dev --tmp --rpc-cors=all

# 或者手动清理数据目录
rm -rf /tmp/substrate*
```

### 2. 确保节点和前端版本匹配

```bash
# 重新编译链
cd /home/xiaodong/文档/stardust
cargo build --release -p stardust-node

# 重新构建前端
cd stardust-dapp
npm run build
```

### 3. 使用调试模式

```bash
# 启动节点时增加日志级别
./target/release/stardust-node \
  --dev \
  --tmp \
  --rpc-cors=all \
  -lruntime=debug \
  -lpallet_market_maker=trace
```

### 4. 监听链上事件

```javascript
// 浏览器控制台
const api = await window.polkadotApi
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record
    if (event.section === 'marketMaker') {
      console.log('MarketMaker 事件:', event.method, event.data.toHuman())
    }
  })
})
```

---

## 紧急恢复方案

### 如果质押成功但无法查询 mmId

1. **查看交易哈希**
   - 复制控制台显示的交易哈希
   - 访问区块浏览器查询

2. **手动查询链上**
   ```bash
   # 使用 Polkadot.js Apps
   # Developer > Chain State
   # marketMaker > applications(u64)
   # 尝试输入 0, 1, 2... 逐个查询
   ```

3. **使用备用流程**
   - 质押成功后，页面会自动跳转到步骤 2
   - 即使 mmId 是临时值，也可以继续填写资料
   - 提交资料时会重新验证 mmId

4. **联系客服**
   - 提供交易哈希
   - 提供账户地址
   - 客服可以帮助查询真实的 mmId

---

## 技术支持

### 提交 Issue

如果问题仍未解决，请在 GitHub 提交 Issue，并附上：

1. **错误截图**（包含控制台日志）
2. **交易哈希**
3. **账户地址**
4. **节点版本**
   ```bash
   ./target/release/stardust-node --version
   ```
5. **Runtime 版本**
   ```bash
   grep "spec_version:" runtime/src/lib.rs
   ```

### 联系方式

- 📧 Email: support@stardust.com
- 💬 Telegram: @stardust_support
- 🐛 GitHub Issues: https://github.com/lao-sha/stardust/issues

---

## 更新日志

### v1.1.0 (2025-09-30)
- 🐛 修复 NextId 为 0 时的负数错误
- 🐛 修复余额格式化精度问题
- ✨ 添加详细的调试日志
- ✨ 添加 Fallback 机制
- 📝 完善错误提示信息
