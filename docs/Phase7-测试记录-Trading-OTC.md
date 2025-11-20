# 🧪 Trading OTC 功能测试记录

**📅 测试时间**: 2025-10-29  
**🎯 测试目标**: 验证OTC订单创建、支付、释放流程  
**👤 测试账户**: Alice(买家), Bob(做市商)

---

## 📋 测试前准备清单

### ✅ 环境检查
- [ ] 节点正常运行（`./target/release/stardust-node --dev --tmp --rpc-cors all`）
- [ ] 前端正常访问（http://localhost:5173）
- [ ] Polkadot.js Apps已连接（可选）

### ✅ 账户准备
```
Alice:  5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
Bob:    5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty

初始余额（开发模式自动分配）:
- Alice: ~1,000,000,000 DUST
- Bob:   ~1,000,000,000 DUST
```

### ✅ 做市商状态检查
**重要**：Bob必须是已激活的做市商，否则无法创建订单

**检查方法1：通过Polkadot.js Apps**
```
1. 打开 https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944
2. Developer → Chain State
3. 选择: trading.makerApplications(1)  # 假设Bob是做市商ID=1
4. 查看状态: status 应为 "Active"
```

**检查方法2：通过前端**
```
1. 访问 http://localhost:5173
2. 进入 "做市商列表" 页面
3. 查看Bob是否在列表中且状态为"激活"
```

**如果Bob未激活，需要先激活：**
```bash
# 方法1：通过Polkadot.js Apps（Root权限）
1. Developer → Sudo
2. 选择: trading.activateMaker(1)  # Bob的做市商ID
3. 提交交易

# 方法2：如果Bob还没申请做市商
1. Bob需要先调用 trading.createMaker(...)
2. 然后Root调用 trading.activateMaker
```

---

## 🧪 测试步骤详解

### 步骤1: Alice登录前端 ✅

**操作**:
```
1. 访问 http://localhost:5173
2. 如果是首次访问，可能需要创建/导入钱包
3. 使用Alice账户登录（或切换到Alice）
   - 种子短语: //Alice
   - 或使用前端的开发账户快速登录
```

**验证**:
- ✅ 页面显示Alice地址
- ✅ 显示Alice余额（~1,000,000,000 DUST）
- ✅ 无错误提示

**问题排查**:
- 如果无法登录：检查钱包配置
- 如果余额为0：开发模式应自动分配余额
- 如果前端报错：查看浏览器Console日志

---

### 步骤2: 进入OTC页面并创建订单 ✅

**操作**:
```
1. 点击导航栏的 "OTC交易" 或 "创建订单"
2. 填写订单信息:
   - 选择做市商: Bob (或做市商ID=1)
   - MEMO数量: 100
   - 联系方式: test@example.com（或任意）
3. 点击 "创建订单" 按钮
4. 确认交易（输入密码或授权）
```

**预期结果**:
- ✅ 弹出交易确认对话框
- ✅ 交易成功提示："订单已创建，订单ID: X"
- ✅ 页面跳转到订单详情或订单列表
- ✅ 订单状态显示为 "待支付" 或 "Open"

**验证方法（Polkadot.js Apps）**:
```
1. Developer → Chain State
2. 查询: trading.orders(订单ID)
3. 验证字段:
   - maker: Bob的地址
   - taker: Alice的地址
   - qty: 100000000000000 (100 * 10^12)
   - state: Open
```

**验证方法（前端）**:
```
1. 在 "我的订单" 页面查看
2. 应该看到刚创建的订单
3. 状态为 "待支付"
```

**可能的错误**:
- ❌ "做市商不存在" → Bob未注册为做市商
- ❌ "做市商未激活" → Bob需要被Root激活
- ❌ "余额不足" → 检查Alice余额
- ❌ "MEMO数量超出范围" → 检查最小/最大限制

---

### 步骤3: Alice标记已支付 ✅

**操作**:
```
1. 在订单详情页面或订单列表
2. 找到刚创建的订单
3. 点击 "标记已支付" 或 "Mark Paid" 按钮
4. 确认交易
```

**预期结果**:
- ✅ 交易成功提示："已标记为已支付"
- ✅ 订单状态更新为 "已支付" 或 "PaidOrCommitted"
- ✅ 可能显示倒计时（做市商释放的截止时间）

**验证方法（Polkadot.js Apps）**:
```
1. 查询: trading.orders(订单ID)
2. 验证: state: PaidOrCommitted
```

**验证方法（事件）**:
```
1. Explorer → Recent Events
2. 查找: trading.OrderStateChanged
3. 验证事件数据:
   - order_id: 订单ID
   - state: PaidOrCommitted (或状态码)
```

**可能的错误**:
- ❌ "订单状态错误" → 订单可能已关闭或取消
- ❌ "权限不足" → 确保是订单创建者Alice操作

---

### 步骤4: 切换到Bob账户 ✅

**操作**:
```
1. 在前端右上角点击账户地址
2. 切换账户到Bob
   - 或重新登录为Bob
   - 种子短语: //Bob
```

**验证**:
- ✅ 页面显示Bob地址
- ✅ 显示Bob余额

---

### 步骤5: Bob释放MEMO ✅

**操作**:
```
1. Bob登录后，进入 "卖家释放" 或 "做市商管理" 页面
2. 查看 "待释放订单列表"
3. 找到Alice的订单（订单ID相同）
4. 确认订单信息无误
5. 点击 "释放MEMO" 按钮
6. 确认交易
```

**预期结果**:
- ✅ 交易成功提示："MEMO已释放"
- ✅ 订单状态更新为 "已完成" 或 "Released"
- ✅ Alice余额增加 100 DUST
- ✅ Bob信用分+1
- ✅ Alice信用分+1

**验证方法（订单状态）**:
```
1. 查询: trading.orders(订单ID)
2. 验证: state: Released
```

**验证方法（余额变化）**:
```
1. 查询Alice余额:
   - api.query.system.account(alice)
   - 应该增加了 100 DUST (100 * 10^12)

2. 查询托管余额（应该减少）:
   - api.query.escrow.deposits(做市商ID)
```

**验证方法（信用分）**:
```
1. 查询Bob信用:
   - api.query.credit.makerCredit(bob)
   - completed_orders 应该 +1

2. 查询Alice信用:
   - api.query.credit.buyerCredit(alice)
   - completed_orders 应该 +1
```

**验证方法（事件）**:
```
1. Explorer → Recent Events
2. 查找事件:
   - trading.OrderStateChanged (Released)
   - balances.Transfer (MEMO转账)
   - escrow.Released (托管释放)
```

**可能的错误**:
- ❌ "订单不存在" → 订单ID错误
- ❌ "状态错误" → 订单未标记为已支付
- ❌ "权限不足" → 确保是做市商Bob操作
- ❌ "托管余额不足" → 检查Escrow账户

---

## ✅ 测试结果总结

### 核心验证点
- [ ] **订单创建**: ✅ 成功 / ❌ 失败
- [ ] **标记支付**: ✅ 成功 / ❌ 失败
- [ ] **释放MEMO**: ✅ 成功 / ❌ 失败
- [ ] **余额正确**: ✅ Alice +100 DUST
- [ ] **状态正确**: ✅ 订单状态 = Released
- [ ] **信用更新**: ✅ Bob和Alice信用分各+1
- [ ] **事件触发**: ✅ 所有相关事件正确触发

### 性能指标
- **订单创建时间**: ___ 秒（区块确认时间）
- **标记支付时间**: ___ 秒
- **释放MEMO时间**: ___ 秒
- **总流程时间**: ___ 秒

### 发现的问题
```markdown
1. [问题描述]
   - 严重程度: 🔴高 / 🟡中 / 🟢低
   - 重现步骤: [...]
   - 错误信息: [...]
   - 截图: [如有]

2. [...]
```

---

## 🔄 额外测试场景（可选）

### 场景A: 订单取消流程 ✅
```
1. Alice创建订单
2. Alice在标记支付前取消订单
3. 验证: 订单状态变为Cancelled
4. 验证: MEMO退回到Escrow
```

### 场景B: 超时场景 ✅
```
1. Alice创建订单
2. Alice标记已支付
3. Bob在截止时间后才尝试释放
4. 验证: 可能触发超时机制
5. 验证: Bob信用分可能-2（超时违约）
```

### 场景C: 多笔订单 ✅
```
1. Alice连续创建3笔订单
2. Bob逐一释放
3. 验证: 信用分累计正确
4. 验证: 余额计算正确
```

---

## 📊 测试数据记录

### 测试前状态
```
Alice余额: _____________ DUST
Bob余额:   _____________ DUST
Alice信用分: ___________
Bob信用分:   ___________
```

### 测试后状态
```
Alice余额: _____________ DUST (预期: +100)
Bob余额:   _____________ DUST (可能不变)
Alice信用分: ___________ (预期: +1)
Bob信用分:   ___________ (预期: +1)
```

---

## 🎯 测试结论

**整体结果**: ✅ 通过 / ❌ 失败 / ⚠️ 部分通过

**核心功能**: ✅ 正常工作 / ❌ 存在问题

**建议**: 
- [ ] 可以继续下一个测试
- [ ] 需要修复问题后重新测试
- [ ] 其他建议: _________________

---

**📝 测试人员**: _____________  
**📅 完成时间**: 2025-10-29 __:__  
**✍️ 备注**: _________________

