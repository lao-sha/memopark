# 🚀 Phase 7 - 快速启动和测试指南

**📅 更新时间**: 2025-10-29  
**🎯 目标**: 快速启动测试环境并开始功能验证  
**⏱️ 预计时间**: 10分钟环境准备 + 测试时间

---

## 🔧 快速启动（3步）

### 步骤1: 启动开发节点 ✅

```bash
# 在终端1中运行
cd /home/xiaodong/文档/stardust

# 清理旧数据（可选，首次测试建议清理）
rm -rf /tmp/stardust-*

# 启动开发节点
./target/release/stardust-node --dev --tmp --rpc-cors all

# 🎯 看到以下输出表示成功:
# 2025-10-29 XX:XX:XX ✨ Initializing Genesis block/state ...
# 2025-10-29 XX:XX:XX 💤 Idle (0 peers), best: #0 ...
# 2025-10-29 XX:XX:XX 💤 Idle (0 peers), best: #1 ...
```

**重要参数说明**:
- `--dev`: 开发模式（使用Alice等预设账户）
- `--tmp`: 使用临时数据库（测试后自动清理）
- `--rpc-cors all`: 允许前端跨域访问

**验证**: 
- ✅ 看到区块持续产生（#1, #2, #3...）
- ✅ 无错误日志
- ✅ RPC服务在 ws://127.0.0.1:9944

---

### 步骤2: 启动前端DApp ✅

```bash
# 在终端2中运行
cd /home/xiaodong/文档/stardust/stardust-dapp

# 安装依赖（如果还没装）
# npm install

# 启动开发服务器
npm run dev

# 🎯 看到以下输出表示成功:
# VITE v5.x.x  ready in xxx ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

**验证**: 
- ✅ 访问 http://localhost:5173
- ✅ 页面正常加载
- ✅ 控制台无Fatal错误

---

### 步骤3: 连接Polkadot.js Apps（可选但推荐）✅

```bash
# 在浏览器中打开
https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944#/explorer

# 或使用本地部署版本
```

**验证**: 
- ✅ 成功连接到本地节点
- ✅ 可以看到区块产生
- ✅ 可以查看链上数据

---

## 🧪 快速测试清单

### 🔴 紧急必测（30分钟）

#### 1. Trading OTC 基础流程 ✅
```
前置: Alice(用户), Bob(做市商已激活)

测试步骤:
1️⃣ 【前端】Alice登录 → OTC页面
2️⃣ 【前端】创建订单(选择Bob, 100 DUST, 填写联系方式)
3️⃣ 【前端】标记已支付
4️⃣ 【前端】Bob登录 → 卖家释放页面 → 释放MEMO
5️⃣ 【验证】Alice余额+100 DUST

预期: ✅ 流程完整，无错误
```

#### 2. Trading 桥接基础流程 ✅
```
测试步骤:
1️⃣ 【前端】Alice登录 → 桥接页面
2️⃣ 【前端】发起兑换(50 DUST → USDT TRC20)
3️⃣ 【验证】Swap记录创建
4️⃣ 【验证】MEMO已锁定

预期: ✅ Swap创建成功
注意: OCW验证需要链下服务，暂时跳过
```

#### 3. Memorial 供奉基础流程 ✅
```
测试步骤:
1️⃣ 【Polkadot.js】Root创建祭品
2️⃣ 【前端】Alice创建逝者档案
3️⃣ 【前端】Alice供奉（选择祭品，填写寄语）
4️⃣ 【验证】供奉记录创建
5️⃣ 【验证】MEMO已转账

预期: ✅ 供奉成功
```

---

### 🟡 重要功能测试（1-2小时）

#### 4. Credit 信用系统 ✅
```
1️⃣ 完成3笔OTC订单
2️⃣ 【Polkadot.js】查询 credit.buyerCredit(alice)
3️⃣ 【验证】score = 3

预期: ✅ 信用分正确增加
```

#### 5. Deceased 档案管理 ✅
```
1️⃣ 【前端】Alice创建逝者档案（填写姓名、生卒日期等）
2️⃣ 【前端】更新文本信息
3️⃣ 【前端】上传媒体（照片/视频）
4️⃣ 【验证】IPFS自动Pin（检查事件）

预期: ✅ 档案管理功能正常
```

#### 6. 做市商管理 ✅
```
1️⃣ 【Polkadot.js】Charlie申请做市商
2️⃣ 【Polkadot.js】Root激活Charlie
3️⃣ 【前端】Charlie登录 → 做市商Dashboard
4️⃣ 【验证】可以查看待处理订单
5️⃣ 【前端】Charlie更新溢价

预期: ✅ 做市商管理正常
```

---

### 🟢 完整功能测试（3-5小时）

#### 7. Arbitration 仲裁流程 ✅
```
1️⃣ 创建OTC订单
2️⃣ 标记支付但做市商不释放（模拟争议）
3️⃣ 【Polkadot.js】Alice发起争议
4️⃣ 【Polkadot.js】委员会成员投票
5️⃣ 【验证】达到多数后自动执行

预期: ✅ 仲裁流程完整
```

#### 8. Affiliate 推荐系统 ✅
```
1️⃣ 【Polkadot.js】Alice设置推荐人为Bob
2️⃣ Alice进行消费（供奉）
3️⃣ 【验证】Bob获得推荐奖励

预期: ✅ 奖励分配正确
```

#### 9. 前端全面测试 ✅
```
测试所有前端页面:
- ✅ 钱包（创建、恢复、切换）
- ✅ OTC页面（创建、查看、释放）
- ✅ 桥接页面（兑换、查看记录）
- ✅ 做市商页面（申请、管理、资金池）
- ✅ 逝者页面（创建、更新、查看）
- ✅ 供奉页面（选择祭品、供奉）
- ✅ 会员页面（购买、查看权益）

预期: ✅ UI流畅，无Fatal错误
```

---

## 🛠️ 测试工具推荐

### 1. Polkadot.js Apps（必备）
```
URL: https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944

常用功能:
- Explorer: 查看区块和事件
- Extrinsics: 手动调用函数
- Chain State: 查询链上数据
- Accounts: 管理测试账户
```

### 2. 浏览器开发者工具（必备）
```
Chrome/Firefox DevTools:
- Console: 查看前端日志
- Network: 查看API请求
- Application: 查看LocalStorage
```

### 3. 测试账户（开发预设）
```
Alice:   5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
Bob:     5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
Charlie: 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y
Dave:    5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy
Eve:     5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw

种子短语: //Alice, //Bob, //Charlie, //Dave, //Eve
```

---

## 📝 测试记录模板

### 快速记录格式
```markdown
## 测试: [功能名称]
- 时间: [HH:MM]
- 结果: ✅ / ❌ / ⚠️
- 问题: [如有]

### 详细步骤
1. [步骤1] → ✅
2. [步骤2] → ❌ 错误: [描述]
3. [步骤3] → ⚠️ 警告: [描述]
```

---

## 🎯 常见问题 FAQ

### Q1: 节点启动失败
```bash
# 检查端口是否被占用
lsof -i:9944

# 如果被占用，杀掉进程或换端口
./target/release/stardust-node --dev --tmp --rpc-port 9945
```

### Q2: 前端无法连接节点
```bash
# 确认节点启动时加了 --rpc-cors all
# 检查前端配置（src/lib/polkadot.ts）
# 确认 RPC URL 为 ws://127.0.0.1:9944
```

### Q3: 交易失败
```
常见原因:
1. 余额不足 → 从Alice转账
2. Nonce错误 → 刷新页面重试
3. 权限不足 → 检查账户权限
4. 参数错误 → 检查类型和范围
```

### Q4: 前端报错
```
1. 刷新页面清除缓存
2. 检查浏览器Console日志
3. 检查Network请求状态
4. 验证API返回数据格式
```

---

## 📊 测试进度追踪

### 使用TODO工具
```bash
# 查看测试进度
# TODO列表会自动更新

当前进度:
- [ ] 准备测试环境
- [ ] Trading OTC测试
- [ ] Trading Maker测试
- [ ] Trading Bridge测试
- [ ] Credit测试
- [ ] Deceased测试
- [ ] Memorial测试
- [ ] Affiliate测试
- [ ] Arbitration测试
- [ ] 前端UI测试
- [ ] 生成测试报告
```

---

## 🎬 开始测试！

### 立即行动
1. ✅ **启动节点**: `./target/release/stardust-node --dev --tmp --rpc-cors all`
2. ✅ **启动前端**: `cd stardust-dapp && npm run dev`
3. ✅ **打开浏览器**: http://localhost:5173
4. ✅ **开始测试**: 按照上面的清单逐项验证

### 测试顺序建议
1. 🔴 **先测Trading**: 最核心，刚整合完成
2. 🟡 **再测Credit**: 与Trading关联
3. 🟢 **最后测其他**: Deceased, Memorial, Affiliate等

---

## 📋 测试完成后

### 生成报告
```markdown
1. 整理所有测试记录
2. 汇总发现的问题
3. 生成 Phase7-功能测试报告.md
4. 标记Bug优先级
5. 制定修复计划
```

---

**🎉 祝测试顺利！如有问题随时反馈！**

**📅 更新时间**: 2025-10-29  
**🏷️ 标签**: `快速启动` `Phase7` `测试指南` `Trading验证`

