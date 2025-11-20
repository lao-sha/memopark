# 📋 Phase 7 - 完整功能测试计划

**📅 创建时间**: 2025-10-29  
**🎯 测试目标**: 验证Trading整合和旧Pallet清理后所有功能正常工作  
**⏱️ 预计耗时**: 8-12小时  
**✅ 完成标准**: 所有核心功能测试通过，无重大Bug

---

## 🎯 测试范围

### 🔴 高优先级模块（必测）
1. **Trading Pallet** - 刚完成整合，需重点测试
   - OTC订单创建、支付、释放、取消
   - 做市商申请、管理、提取
   - 桥接服务（用户直接兑换、做市商兑换）

2. **Credit Pallet** - 新整合
   - 买家信用评分
   - 做市商信用评分
   - 信用等级变化

3. **Deceased Pallet** - 新整合
   - 创建逝者档案
   - 更新文本、媒体
   - 转移所有权

4. **Memorial Pallet** - 新整合（Phase 3）
   - 创建祭品
   - 供奉功能
   - 批量供奉

5. **Affiliate Pallet** - 新整合
   - 推荐关系
   - 奖励分配
   - 托管账户

---

### 🟡 中优先级模块（重要）
6. **Arbitration** - 与Trading关联
   - 创建争议
   - 委员会投票
   - 执行仲裁决定

7. **Escrow** - 与Trading关联
   - 托管MEMO
   - 释放/退款

8. **Pricing** - 与Trading关联
   - 价格查询
   - 历史价格

---

### 🟢 低优先级模块（可选）
9. **Membership** - 基础功能
10. **Deposits** - 押金管理
11. **IPFS** - 存储功能

---

## 📝 详细测试用例

### 1️⃣ Trading Pallet 测试

#### 1.1 OTC订单功能 ✅
**前置条件**: 
- Alice: 普通用户
- Bob: 做市商（已激活）

**测试步骤**:
```
1. Alice 创建OTC订单
   - createOrder(maker_id=1, memo_amount=100*10^12, contact_info)
   - ✅ 验证: Orders存储已创建
   - ✅ 验证: OrderCreated事件触发
   - ✅ 验证: MEMO已托管到Escrow

2. Alice 标记已支付
   - markPaid(order_id)
   - ✅ 验证: 订单状态 -> PaidOrCommitted
   - ✅ 验证: OrderStateChanged事件触发

3. Bob（做市商）释放MEMO
   - releaseMemo(order_id)
   - ✅ 验证: 订单状态 -> Released
   - ✅ 验证: MEMO转账到Alice
   - ✅ 验证: 买家信用分+1
   - ✅ 验证: 做市商信用分+1

4. Alice 取消订单（测试取消流程）
   - cancelOrder(order_id)
   - ✅ 验证: 订单状态 -> Cancelled
   - ✅ 验证: MEMO退回到Escrow
```

**预期结果**: 所有验证点通过

---

#### 1.2 做市商管理功能 ✅
**前置条件**: 
- Charlie: 新用户（准备申请做市商）

**测试步骤**:
```
1. Charlie 申请做市商
   - createMaker(
       public_cid, 
       memo_account, 
       premium_sell=50, 
       premium_buy=-30, 
       direction=BuyAndSell,
       tron_address
     )
   - ✅ 验证: MakerApplications存储已创建
   - ✅ 验证: MakerApplicationSubmitted事件触发
   - ✅ 验证: 1000 MEMO押金已锁定

2. Root 激活做市商（需要管理员权限）
   - 使用sudo或委员会投票激活
   - ✅ 验证: 做市商状态 -> Active

3. Charlie 更新溢价
   - updatePremium(sell=60, buy=-20)
   - ✅ 验证: MakerUpdated事件触发

4. Charlie 申请提取押金
   - requestWithdrawal(amount)
   - ✅ 验证: WithdrawalRequests存储已创建
   - ✅ 验证: 需要等待冷却期（7天）

5. 7天后执行提取
   - executeWithdrawal()
   - ✅ 验证: MEMO已退回到Charlie
   - ✅ 验证: 做市商状态可能变为Inactive
```

**预期结果**: 所有验证点通过

---

#### 1.3 桥接服务功能 ✅
**前置条件**: 
- Alice: 用户
- Bob: 做市商（已激活，支持Buy方向）

**测试步骤**:
```
【用户直接桥接】
1. Alice 发起直接兑换
   - swap(memo_amount=50*10^12, tron_address)
   - ✅ 验证: Swaps存储已创建
   - ✅ 验证: SwapCreated事件触发
   - ✅ 验证: MEMO已锁定

2. 链下服务发送USDT TRC20
   - （模拟：链下操作）

3. OCW验证交易（自动）
   - ✅ 验证: Swap状态 -> Verified
   - ✅ 验证: SwapStateChanged事件触发

【做市商桥接】
4. Alice 通过做市商兑换
   - makerSwap(maker_id=1, memo_amount=50*10^12, tron_address)
   - ✅ 验证: MakerSwaps存储已创建
   - ✅ 验证: MakerSwapInitiated事件触发

5. Bob（做市商）标记完成
   - markSwapComplete(swap_id, trc20_tx_hash)
   - ✅ 验证: Swap状态 -> Completed
   - ✅ 验证: 做市商信用分+1

6. Alice 确认收款
   - confirmSwap(swap_id)
   - ✅ 验证: MEMO已销毁
   - ✅ 验证: SwapStateChanged事件触发
```

**预期结果**: 所有验证点通过

---

### 2️⃣ Credit Pallet 测试

#### 2.1 买家信用功能 ✅
**测试步骤**:
```
1. 查询初始信用
   - api.query.credit.buyerCredit(alice)
   - ✅ 验证: level=0, score=0

2. 完成3笔订单（通过Trading测试）
   - ✅ 验证: score=3

3. 发生1次争议（买家胜诉）
   - ✅ 验证: score不变（仲裁保护）

4. 发生1次争议（买家败诉）
   - ✅ 验证: score-1

5. 验证信用等级变化
   - 完成10笔订单
   - ✅ 验证: level升级到Level1（Bronze）
```

**预期结果**: 信用系统正常运作

---

#### 2.2 做市商信用功能 ✅
**测试步骤**:
```
1. 查询初始信用
   - api.query.credit.makerCredit(bob)
   - ✅ 验证: level=0, score=0, status=Normal

2. 完成5笔订单
   - ✅ 验证: score=5

3. 发生1次超时
   - ✅ 验证: score-2, default_count+1

4. 验证服务状态
   - 2次超时后
   - ✅ 验证: status=Warning

5. 验证暂停机制
   - 3次超时后
   - ✅ 验证: status=Suspended
   - ✅ 验证: 无法接单
```

**预期结果**: 做市商信用约束有效

---

### 3️⃣ Deceased Pallet 测试

#### 3.1 逝者档案管理 ✅
**测试步骤**:
```
1. Alice 创建逝者档案
   - createDeceased(
       full_name_cid,
       main_image_cid,
       birth_date,
       death_date,
       nationality
     )
   - ✅ 验证: DeceasedProfiles存储已创建
   - ✅ 验证: DeceasedCreated事件触发
   - ✅ 验证: IPFS自动Pin（4个CID）

2. Alice 更新文本信息
   - updateText(deceased_id, text_cid)
   - ✅ 验证: TextRecords存储已更新
   - ✅ 验证: TextUpdated事件触发

3. Alice 更新媒体信息
   - updateMedia(deceased_id, media_cid, media_type)
   - ✅ 验证: MediaRecords存储已更新
   - ✅ 验证: MediaUpdated事件触发

4. Alice 转移所有权给Bob
   - transferOwner(deceased_id, bob)
   - ✅ 验证: owner字段已更新
   - ✅ 验证: OwnerTransferred事件触发
   - ✅ 验证: 只有Bob可以操作
```

**预期结果**: 档案管理功能正常

---

### 4️⃣ Memorial Pallet 测试

#### 4.1 祭品和供奉功能 ✅
**测试步骤**:
```
1. Root 创建祭品
   - createSacrifice(
       name_cid,
       icon_cid,
       price_memo,
       max_supply
     )
   - ✅ 验证: Sacrifices存储已创建
   - ✅ 验证: SacrificeCreated事件触发

2. Alice 单次供奉
   - offer(
       deceased_id,
       sacrifice_id,
       quantity=3,
       message_cid
     )
   - ✅ 验证: Offerings存储已创建
   - ✅ 验证: OfferingCommitted事件触发
   - ✅ 验证: MEMO已转账
   - ✅ 验证: 销量统计已更新

3. Alice 通过祭品目录供奉
   - offerBySacrifice(
       deceased_id,
       sacrifice_id,
       quantity=5,
       message_cid
     )
   - ✅ 验证: 自动定价
   - ✅ 验证: VIP折扣（如果是会员）

4. Alice 批量供奉
   - batchOffer([
       (deceased_id_1, sacrifice_id_1, qty_1, msg_1),
       (deceased_id_2, sacrifice_id_2, qty_2, msg_2)
     ])
   - ✅ 验证: 多个供奉记录创建
   - ✅ 验证: BatchOfferingCompleted事件触发
```

**预期结果**: 供奉系统正常运作

---

### 5️⃣ Affiliate Pallet 测试

#### 5.1 推荐和奖励功能 ✅
**测试步骤**:
```
1. Alice 设置推荐关系
   - setReferrer(bob)
   - ✅ 验证: Referrals存储已更新

2. Alice 进行消费（通过Memorial供奉）
   - ✅ 验证: Bob获得推荐奖励
   - ✅ 验证: 资金分配正确（用户、推荐人、国库、销毁）

3. 验证多层级推荐
   - Charlie 推荐 Alice
   - Alice 推荐 Bob
   - Bob 进行消费
   - ✅ 验证: Alice和Charlie都获得奖励

4. 查询推荐统计
   - api.query.affiliate.referralStats(bob)
   - ✅ 验证: 推荐人数、总奖励正确
```

**预期结果**: 推荐系统正常分配奖励

---

### 6️⃣ Arbitration Pallet 测试

#### 6.1 仲裁流程 ✅
**测试步骤**:
```
1. Alice 创建OTC订单并标记支付
   - （参考Trading测试）

2. Bob（做市商）未及时释放（模拟争议）
   - 等待超过确认期

3. Alice 发起争议
   - api.tx.arbitration.createDispute(
       domain=OTC,
       id=order_id,
       evidence_cid
     )
   - ✅ 验证: Disputes存储已创建
   - ✅ 验证: DisputeCreated事件触发

4. 委员会成员投票
   - committee_member_1.vote(dispute_id, decision=Release)
   - committee_member_2.vote(dispute_id, decision=Release)
   - ✅ 验证: 票数统计正确

5. 达到多数后自动执行
   - ✅ 验证: 仲裁决定已执行（MEMO释放给Alice）
   - ✅ 验证: DisputeResolved事件触发
   - ✅ 验证: Bob的信用分-2（争议败诉）
```

**预期结果**: 仲裁流程完整、决定正确执行

---

## 🔧 测试环境准备

### 1. 启动开发节点
```bash
cd /home/xiaodong/文档/stardust

# 清理旧数据（可选）
rm -rf /tmp/stardust-*

# 启动开发节点
./target/release/stardust-node --dev --tmp
```

**验证**: 
- 节点启动成功
- 可以产生区块
- RPC端口9944可访问

---

### 2. 启动前端DApp
```bash
cd /home/xiaodong/文档/stardust/stardust-dapp

# 安装依赖（如需要）
npm install

# 启动开发服务器
npm run dev
```

**验证**: 
- 前端启动成功（http://localhost:5173）
- 可以连接到节点
- 钱包功能正常

---

### 3. 准备测试账户
```javascript
// 使用开发预设账户
Alice:   5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
Bob:     5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
Charlie: 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y
Dave:    5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy
Eve:     5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw
```

---

### 4. 初始化测试数据
```javascript
// 使用 Polkadot.js Apps 或脚本
// https://polkadot.js.org/apps/

1. 给测试账户转账（确保有足够MEMO）
   - 从Alice向Bob、Charlie转账各 10,000 DUST

2. 创建测试做市商
   - Bob申请做市商
   - Root激活Bob

3. 创建测试会员
   - Alice购买年费会员（用于测试VIP折扣）
```

---

## 📊 测试工具

### 1. Polkadot.js Apps
- **URL**: https://polkadot.js.org/apps/?rpc=ws://localhost:9944
- **用途**: 
  - 查看链上数据
  - 手动调用extrinsic
  - 监听事件

### 2. 前端DApp
- **URL**: http://localhost:5173
- **用途**:
  - 测试用户交互
  - 验证UI功能
  - 测试钱包集成

### 3. Curl/Postman
- **用途**: 
  - 测试RPC接口
  - 验证OCW功能

### 4. 日志监控
```bash
# 查看节点日志
tail -f node.log

# 查看前端日志
# 浏览器开发者工具 Console
```

---

## ✅ 验证清单

### 核心功能验证
- [ ] **Trading OTC**: 订单创建、支付、释放、取消
- [ ] **Trading Maker**: 做市商申请、激活、更新、提取
- [ ] **Trading Bridge**: 用户直接桥接、做市商桥接
- [ ] **Credit Buyer**: 信用评分、等级变化
- [ ] **Credit Maker**: 信用约束、服务状态
- [ ] **Deceased**: 档案创建、更新、转移
- [ ] **Memorial**: 祭品创建、供奉、批量供奉
- [ ] **Affiliate**: 推荐关系、奖励分配
- [ ] **Arbitration**: 争议创建、投票、执行

### 前端功能验证
- [ ] **钱包**: 创建、恢复、切换
- [ ] **OTC页面**: 创建订单、查看订单、释放MEMO
- [ ] **桥接页面**: 直接兑换、做市商兑换、查看记录
- [ ] **做市商页面**: 申请、Dashboard、资金池管理
- [ ] **逝者页面**: 创建档案、更新信息、查看详情
- [ ] **供奉页面**: 选择祭品、供奉、查看记录
- [ ] **会员页面**: 购买会员、查看权益

### 性能验证
- [ ] **编译时间**: 记录编译耗时
- [ ] **节点启动**: 记录启动时间
- [ ] **交易速度**: 记录区块确认时间
- [ ] **前端加载**: 记录页面加载时间

---

## 📝 测试记录模板

### 测试用例记录
```markdown
## 测试用例: [功能名称]
- **测试人员**: [姓名]
- **测试时间**: [YYYY-MM-DD HH:MM]
- **测试环境**: Dev节点 + 本地前端
- **测试结果**: ✅ 通过 / ❌ 失败 / ⚠️ 部分通过

### 测试步骤
1. [步骤1] - ✅ 通过
2. [步骤2] - ✅ 通过
3. [步骤3] - ❌ 失败

### 发现的问题
- **问题1**: [描述]
  - **严重程度**: 🔴 高 / 🟡 中 / 🟢 低
  - **重现步骤**: [...]
  - **错误信息**: [...]
  - **影响范围**: [...]

### 截图/日志
[附加截图或日志]
```

---

## 🎯 成功标准

### 必须通过（P0）
- ✅ 所有Trading核心功能正常
- ✅ Credit系统正常运作
- ✅ 前端无Fatal错误
- ✅ 编译无Warning

### 建议通过（P1）
- ✅ Deceased、Memorial、Affiliate功能正常
- ✅ 仲裁流程完整
- ✅ UI体验流畅

### 可接受问题（P2）
- ⚠️ 非核心功能小Bug
- ⚠️ UI小瑕疵
- ⚠️ 性能可优化点

---

## 📋 下一步行动

### 测试完成后
1. 生成 `Phase7-功能测试报告.md`
2. 汇总所有发现的问题
3. 按优先级修复Bug
4. 回归测试
5. 准备上线部署

---

**🎯 目标**: 确保所有核心功能正常工作，为生产环境做好准备！

**📅 计划时间**: 2025-10-29 ~ 2025-10-30  
**👤 执行人员**: AI Assistant + 人工验证  
**🏷️ 标签**: `功能测试` `Phase7` `质量保证` `Trading验证`

