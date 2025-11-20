# Pallet AI Strategy 完整测试流程

## 📋 概述

本文档提供 `pallet-ai-strategy` 和 Hyperliquid 集成的完整测试流程，分为以下几个层次：

1. **单元测试** - Pallet 内部逻辑测试
2. **集成测试** - 链上交互测试
3. **Hyperliquid 模块测试** - DEX 集成测试
4. **端到端测试** - 完整流程测试

---

## 🧪 测试层次一：单元测试

### 目标
测试 Pallet 的核心逻辑，不涉及真实的链和外部 API。

### 运行单元测试

```bash
cd /home/xiaodong/文档/stardust

# 测试 AI Strategy pallet
cargo test -p pallet-ai-strategy

# 查看详细输出
cargo test -p pallet-ai-strategy -- --nocapture

# 测试特定函数
cargo test -p pallet-ai-strategy test_create_strategy
```

### 预期结果

```
running 5 tests
test tests::test_create_strategy ... ok
test tests::test_toggle_strategy ... ok
test tests::test_update_ai_config ... ok
test tests::test_remove_strategy ... ok
test hyperliquid::tests::test_order_creation ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### 如果测试失败

检查 `pallets/ai-strategy/src/tests.rs`，确认测试用例与代码逻辑一致。

---

## 🔗 测试层次二：集成测试（链上）

### 目标
测试 Pallet 在真实链环境中的行为，验证存储、事件、错误处理等。

### 前置条件

1. **编译链**
```bash
cd /home/xiaodong/文档/stardust
cargo build --release
```

2. **启动开发链**
```bash
./target/release/stardust-node --dev --tmp --rpc-external --rpc-port 9944 --rpc-cors=all > /tmp/stardust-node.log 2>&1 &
```

3. **验证链运行**
```bash
# 查看日志
tail -f /tmp/stardust-node.log | grep "💤"

# 应该看到：
# 💤 Idle (0 peers), best: #3, finalized #1
```

### 测试步骤

#### 步骤 1：安装测试依赖

```bash
cd /home/xiaodong/文档/stardust
npm install
```

#### 步骤 2：修改测试脚本（简化版）

创建 `test-ai-strategy-simple.js`：

```javascript
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  console.log('🚀 开始简化测试...\n');

  // 1. 连接链
  const provider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider });
  console.log('✅ 已连接到链');

  // 2. 准备账户
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  console.log(`✅ 测试账户: ${alice.address}`);

  // 3. 测试：查询下一个策略ID
  const nextId = await api.query.aiStrategy.nextStrategyId();
  console.log(`📊 下一个策略ID: ${nextId.toNumber()}\n`);

  // 4. 测试：查询用户策略列表
  const userStrategies = await api.query.aiStrategy.userStrategies(alice.address);
  console.log(`📋 Alice 拥有 ${userStrategies.length} 个策略\n`);

  // 5. 监听事件（5秒）
  console.log('🎧 监听 AI 事件（5秒）...\n');
  const unsubscribe = await api.query.system.events((events) => {
    events.forEach((record) => {
      const { event } = record;
      if (event.section === 'aiStrategy') {
        console.log(`\t📡 事件: ${event.section}.${event.method}`);
        console.log(`\t   数据: ${event.data.toString()}\n`);
      }
    });
  });

  await new Promise(resolve => setTimeout(resolve, 5000));
  unsubscribe();

  await api.disconnect();
  console.log('✅ 测试完成');
}

main().catch(console.error).finally(() => process.exit());
```

#### 步骤 3：运行简化测试

```bash
node test-ai-strategy-simple.js
```

**预期输出：**
```
🚀 开始简化测试...

✅ 已连接到链
✅ 测试账户: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
📊 下一个策略ID: 0

📋 Alice 拥有 0 个策略

🎧 监听 AI 事件（5秒）...

✅ 测试完成
```

---

## 🏗️ 测试层次三：Hyperliquid 模块测试

### 目标
测试 Hyperliquid 模块的数据结构和辅助函数。

### 测试 Hyperliquid 数据结构

```bash
cargo test -p pallet-ai-strategy hyperliquid::tests
```

**预期结果：**
```
test hyperliquid::tests::test_order_creation ... ok
test hyperliquid::tests::test_eip712_domain_default ... ok
```

### 手动测试 EIP-712 签名（可选）

创建 `test-eip712.js`：

```javascript
const { ethers } = require('ethers');

async function testEIP712() {
  // 1. 创建测试钱包
  const wallet = ethers.Wallet.createRandom();
  console.log('测试钱包地址:', wallet.address);

  // 2. 定义 EIP-712 域
  const domain = {
    name: 'Hyperliquid',
    version: '1',
    chainId: 42161, // Arbitrum
    verifyingContract: '0x0000000000000000000000000000000000000000',
  };

  // 3. 定义订单类型
  const types = {
    Order: [
      { name: 'symbol', type: 'string' },
      { name: 'isBuy', type: 'bool' },
      { name: 'limitPx', type: 'uint256' },
      { name: 'sz', type: 'uint256' },
      { name: 'reduceOnly', type: 'uint256' },
      { name: 'postOnly', type: 'uint256' },
      { name: 'orderType', type: 'uint256' },
      { name: 'cloid', type: 'uint256' },
    ],
  };

  // 4. 订单数据
  const order = {
    symbol: 'BTC-USD',
    isBuy: true,
    limitPx: 45000000000,  // $45,000
    sz: 1000000,           // 0.001 BTC
    reduceOnly: 0,
    postOnly: 0,
    orderType: 0,          // Limit
    cloid: 12345,
  };

  // 5. 签名
  const signature = await wallet._signTypedData(domain, types, order);
  console.log('EIP-712 签名:', signature);

  // 6. 验证签名
  const recoveredAddress = ethers.utils.verifyTypedData(domain, types, order, signature);
  console.log('恢复的地址:', recoveredAddress);
  console.log('签名验证:', recoveredAddress === wallet.address ? '✅ 成功' : '❌ 失败');
}

testEIP712().catch(console.error);
```

运行：
```bash
npm install ethers@5
node test-eip712.js
```

---

## 🌐 测试层次四：端到端测试

### 目标
测试完整的 AI 策略流程，包括：
1. 创建策略
2. OCW 自动执行
3. AI 信号生成
4. （模拟）Hyperliquid 交易

### 前置条件

#### 1. 部署 AI 推理服务（Mock 版本）

创建简单的 Mock AI 服务 `mock-ai-service.py`：

```python
from fastapi import FastAPI
from pydantic import BaseModel
import random

app = FastAPI()

class InferenceRequest(BaseModel):
    strategy_id: int
    symbol: str
    current_price: int

class InferenceResponse(BaseModel):
    signal: str  # "BUY", "SELL", "HOLD"
    confidence: int  # 0-100
    position_size: int
    entry_price: int
    reasoning: str

@app.post("/inference")
async def inference(request: InferenceRequest):
    # 随机生成信号（用于测试）
    signals = ["BUY", "SELL", "HOLD"]
    signal = random.choice(signals)
    
    return InferenceResponse(
        signal=signal,
        confidence=random.randint(60, 95),
        position_size=1000000,  # 0.001 BTC
        entry_price=request.current_price,
        reasoning=f"Mock AI: 基于当前价格 {request.current_price}，建议{signal}"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

启动服务：
```bash
pip install fastapi uvicorn
python mock-ai-service.py
```

验证：
```bash
curl -X POST http://localhost:8000/inference \
  -H "Content-Type: application/json" \
  -d '{"strategy_id": 0, "symbol": "BTC-USD", "current_price": 45000000000}'
```

#### 2. 配置链节点

确保节点启用 OCW：
```bash
./target/release/stardust-node \
  --dev \
  --tmp \
  --rpc-external \
  --rpc-port 9944 \
  --rpc-cors=all \
  --enable-offchain-indexing true
```

### 测试步骤

#### 步骤 1：创建 AI 策略

使用修复后的测试脚本：
```bash
# 注意：需要先解决之前的 Codec error
# 当前测试脚本在参数编码上还有问题
node test-ai-strategy.js
```

**如果仍有编码错误，使用 Polkadot.js Apps UI：**

1. 打开 https://polkadot.js.org/apps/
2. 连接到 `ws://127.0.0.1:9944`
3. 导航到 **Developer** -> **Extrinsics**
4. 选择 `aiStrategy` -> `createAiStrategy`
5. 手动填写参数（使用 UI 会自动处理编码）

#### 步骤 2：验证策略创建

```javascript
// 查询策略
const strategy = await api.query.aiStrategy.aIStrategies(0);
console.log(strategy.toHuman());
```

#### 步骤 3：监控 OCW 执行

```bash
tail -f /tmp/stardust-node.log | grep -E "🤖 OCW|📊|✅"
```

**预期日志：**
```
🤖 OCW started at block 10
🤖 OCW执行于区块 #10
📊 处理策略 #0
✅ AI信号: BUY
```

#### 步骤 4：查询 AI 信号历史

```javascript
// 查询信号ID列表
const signalIds = await api.query.aiStrategy.strategySignals(0);
console.log('信号数量:', signalIds.length);

// 查询具体信号
for (const signalId of signalIds) {
  const signal = await api.query.aiStrategy.aISignalHistory(0, signalId);
  console.log('信号:', signal.toHuman());
}
```

---

## 📊 测试矩阵

| 测试类型 | 测试内容 | 工具 | 预期结果 | 状态 |
|---------|---------|------|---------|------|
| 单元测试 | Pallet 逻辑 | `cargo test` | 所有测试通过 | ⚠️ Mock 已修复，待运行 |
| 集成测试 | 链上交互 | `test-ai-strategy-simple.js` | 能查询状态、监听事件 | ✅ 可测试 |
| 创建策略 | 提交交易 | Polkadot.js Apps | 策略存储成功 | ⚠️ Codec 编码待解决 |
| OCW 执行 | 自动处理 | 节点日志 | 每10块执行一次 | ✅ 已实现 |
| AI 集成 | 调用 AI 服务 | Mock AI 服务 | 生成交易信号 | ⚠️ 需要 Mock 服务 |
| Hyperliquid | DEX 交易 | Mock API | 订单提交成功 | ❌ 需要实现 EIP-712 |

---

## 🔍 故障排查

### 问题 1：单元测试编译失败

**错误：** `not all trait items implemented`

**解决：** 已修复 `mock.rs`，重新测试：
```bash
cargo test -p pallet-ai-strategy
```

### 问题 2：创建策略时 Codec error

**错误：** `Bad input data provided to validate_transaction: Codec error`

**原因：** 参数编码格式不正确

**解决方案 A：** 使用 Polkadot.js Apps UI（推荐）
- UI 会自动处理编码

**解决方案 B：** 检查测试脚本参数格式
```javascript
// 确保所有枚举使用字符串
aiConfig: {
  primaryModel: 'Ensemble',  // ✅ 正确
  // primaryModel: { Ensemble: null },  // ❌ 错误
}
```

### 问题 3：OCW 不执行

**检查：**
```bash
# 查看 OCW 日志
grep "🤖 OCW" /tmp/stardust-node.log

# 确认策略状态
# 使用 Polkadot.js Apps 查询 aiStrategy.aIStrategies(0)
```

**常见原因：**
- 策略状态不是 Active
- 区块号不是 10 的倍数
- OCW 代码有运行时错误

### 问题 4：AI 服务连接失败

**错误：** `Network timeout` 或 `Connection refused`

**解决：**
```bash
# 检查 AI 服务
curl http://localhost:8000/inference

# 检查防火墙
sudo ufw allow 8000
```

---

## ✅ 测试检查清单

完成以下测试项目，确认模块功能正常：

- [ ] **基础功能**
  - [ ] 单元测试全部通过
  - [ ] 能连接到开发链
  - [ ] 能查询链上状态

- [ ] **策略管理**
  - [ ] 创建策略成功
  - [ ] 查询策略详情
  - [ ] 切换策略状态
  - [ ] 更新 AI 配置
  - [ ] 删除策略

- [ ] **OCW 功能**
  - [ ] OCW 每10块执行
  - [ ] 能读取活跃策略
  - [ ] 日志输出正常

- [ ] **AI 集成**（可选）
  - [ ] AI 服务可访问
  - [ ] 生成交易信号
  - [ ] 信号记录到链上

- [ ] **Hyperliquid 集成**（待实现）
  - [ ] EIP-712 签名实现
  - [ ] HTTP 请求正常
  - [ ] 订单提交成功

---

## 🚀 下一步计划

### 立即可做
1. ✅ 修复 Mock 测试 - **已完成**
2. ⏳ 运行单元测试
3. ⏳ 运行简化集成测试
4. ⏳ 部署 Mock AI 服务

### 需要开发
1. 🚧 完善 EIP-712 签名实现
2. 🚧 实现 Hyperliquid HTTP 客户端
3. 🚧 添加更多单元测试
4. 🚧 开发前端测试界面

---

## 📚 相关文档

- [AI Strategy Pallet README](../pallets/ai-strategy/README.md)
- [Stardust链与Hyperliquid交互方案](./Stardust链与Hyperliquid交互方案.md)
- [AI推理服务实现方案](./AI推理服务实现方案.md)
- [Polkadot.js API 文档](https://polkadot.js.org/docs/api/)

---

*文档更新时间: 2025-11-04*

