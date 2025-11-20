# 卖家释放MEMO页面使用说明

## 页面概述

**卖家释放MEMO页面** 是OTC交易流程的核心环节，允许做市商（卖家）在确认收到买家的法币支付后，释放MEMO给买家完成交易。

## 访问地址

```
http://127.0.0.1:5173/#/otc/release
```

## 功能说明

### 1. 页面功能

- ✅ 显示所有待处理的订单（买家已标记"已支付"）
- ✅ 查看订单详情（买家地址、购买数量、金额等）
- ✅ 一键释放MEMO给买家
- ✅ 实时刷新订单状态
- ✅ 订单过期提示
- ✅ 确认释放对话框（防止误操作）

### 2. 订单显示条件

页面只显示满足以下条件的订单：
- 当前登录用户是订单的卖家（maker）
- 订单状态为 `PaidOrCommitted`（买家已支付）
- 订单未过期

### 3. 完整交易流程

```
步骤1: 买家创建订单
   ↓   状态: Created
   
步骤2: 买家线下支付法币给卖家
   ↓   （银行转账、支付宝、微信等）
   
步骤3: 买家标记"已支付"
   ↓   状态: Created → PaidOrCommitted
   
步骤4: 卖家确认收到法币
   ↓   检查银行账户/支付宝/微信等
   
步骤5: 卖家在页面点击"释放MEMO" ← 本页面
   ↓   状态: PaidOrCommitted → Released
   
步骤6: 交易完成
   ✅  MEMO从托管账户转给买家
```

---

## 使用步骤

### 步骤1：登录卖家账户

使用做市商账户登录钱包：

**测试账户**（根据之前的脚本）：
- **助记词**: `gold brick snake six junk cart alpha asset spoon that ice stumble`
- **地址**: `5CRubhWmwNmJ3z2Ffqs3nf71XQGHBkfKSc1edNvuHZErqvdL`

### 步骤2：访问释放页面

在浏览器中访问：
```
http://127.0.0.1:5173/#/otc/release
```

### 步骤3：查看待处理订单

页面会自动显示所有需要处理的订单：

**订单信息包括**：
- 订单ID
- 买家地址
- 购买数量（MEMO）
- 订单金额
- 创建时间
- 订单状态

### 步骤4：确认收到法币

⚠️ **重要**: 在释放MEMO之前，请务必确认：

1. ✅ 检查您的银行账户/支付宝/微信
2. ✅ 确认收到了买家的法币支付
3. ✅ 金额与订单金额一致
4. ✅ 支付人信息与买家联系方式匹配

### 步骤5：释放MEMO

1. 点击订单右侧的 **"释放MEMO"** 按钮（红色按钮）
2. 系统会弹出确认对话框，显示：
   - 订单ID
   - 买家地址
   - 释放数量
   - 订单金额
   - ⚠️ 警告提示
3. 再次确认无误后，点击 **"确认释放"**
4. 输入钱包密码（如果需要）
5. 等待交易确认（通常几秒钟）

### 步骤6：验证交易结果

释放成功后：
- ✅ 页面显示"释放成功！MEMO已转给买家"
- ✅ 订单从待处理列表中消失
- ✅ 订单状态变为 `Released`
- ✅ MEMO已从托管账户转给买家
- ✅ 买家可以在钱包中看到收到的MEMO

---

## 订单状态说明

| 状态 | 说明 | 显示颜色 | 可操作 |
|------|------|----------|--------|
| **Created** | 订单已创建，等待买家支付 | 灰色 | ❌ |
| **PaidOrCommitted** | 买家已标记"已支付" | 蓝色（处理中） | ✅ 可释放 |
| **Released** | 卖家已释放，交易完成 | 绿色（成功） | ❌ |
| **Refunded** | 已退款 | 橙色（警告） | ❌ |
| **Disputed** | 争议中 | 红色（错误） | ⚠️ 需仲裁 |
| **Canceled** | 已取消 | 灰色 | ❌ |

---

## 页面UI说明

### 1. 页面标题区域

```
释放MEMO给买家
买家已完成法币支付后，您需要在此页面释放MEMO给买家
当前账户: 5CRubh...ErqvdL
```

### 2. 待处理订单列表

每个订单卡片显示：
- 💰 左侧图标
- 订单ID和状态标签
- 买家地址（缩略显示）
- 购买数量（绿色高亮）
- 订单金额
- 创建时间（相对时间）
- "查看详情" 按钮（蓝色）
- "释放MEMO" 按钮（红色）

### 3. 订单详情弹窗

点击"查看详情"后显示：
- 订单ID
- 挂单ID
- 买家地址（完整）
- 卖家地址（完整）
- 购买数量
- 执行价格
- 订单金额
- 订单状态
- 创建区块
- 过期区块
- 支付承诺哈希
- 联系方式哈希

### 4. 释放确认对话框

显示内容：
- 订单摘要信息
- ⚠️ 重要提示：
  - "释放后，MEMO将从托管账户转移给买家"
  - "此操作不可撤销"
  - "请确保您已收到买家的法币支付"

---

## 测试流程

### 完整测试步骤

#### 1. 创建测试订单（买家）

```bash
cd /home/xiaodong/文档/stardust
node 自动创建买单.js
```

**输出**：
- 订单ID: #0
- 买家: 5C7RjMrgfCJYyscR5Du1BLP99vFGgRDXjAt3ronftJZe39Qo
- 卖家: 5CRubhWmwNmJ3z2Ffqs3nf71XQGHBkfKSc1edNvuHZErqvdL
- 状态: Created

#### 2. 买家标记已支付

```bash
cd /home/xiaodong/文档/stardust
node 买家标记已支付.js
```

**输出**：
- 订单ID: #0
- 状态: Created → PaidOrCommitted
- 提示：卖家现在可以在"释放MEMO"页面看到此订单

#### 3. 卖家释放MEMO

**方式A: 使用前端页面**（推荐）
1. 访问 `http://127.0.0.1:5173/#/otc/release`
2. 使用卖家账户登录
3. 查看订单列表
4. 点击"释放MEMO"按钮
5. 确认释放

**方式B: 使用脚本**
```bash
cd /home/xiaodong/文档/stardust
node 卖家释放MEMO.js
```

#### 4. 验证结果

**检查订单状态**：
```bash
node -e "
const { ApiPromise, WsProvider } = require('@polkadot/api');
(async () => {
  const api = await ApiPromise.create({ 
    provider: new WsProvider('ws://127.0.0.1:9944') 
  });
  const order = await api.query.otcOrder.orders(0);
  console.log('订单状态:', order.unwrap().toJSON().state);
  await api.disconnect();
})();
"
```

**预期输出**: `订单状态: Released`

---

## 链上方法说明

### otcOrder.release

```rust
pub fn release(origin: OriginFor<T>, id: u64) -> DispatchResult
```

**功能**：
- 卖家释放MEMO给买家
- 从挂单托管账户转账给买家
- 更新订单状态为 Released

**权限检查**：
- ✅ 调用者必须是订单的 maker（卖家）
- ✅ 订单状态必须是 PaidOrCommitted 或 Disputed
- ✅ 托管账户有足够余额

**执行流程**：
1. 验证调用者是卖家
2. 检查订单状态
3. 从挂单托管账户转账给买家 `amount` 数量的MEMO
4. 更新订单状态为 `Released`
5. 触发 `OrderReleased` 事件

**事件**：
```rust
Event::OrderReleased { id: u64 }
```

---

## 常见问题

### Q1: 为什么页面显示"暂无待处理订单"？

**可能原因**：
1. ❌ 没有买家创建订单
2. ❌ 买家创建了订单但未标记"已支付"
3. ❌ 订单已经被处理（已释放或已退款）
4. ❌ 当前登录的不是卖家账户

**解决方法**：
- 检查当前登录账户是否是做市商账户
- 运行 `买家标记已支付.js` 脚本
- 刷新页面

### Q2: 点击"释放MEMO"后没有反应？

**可能原因**：
1. ❌ 钱包未解锁
2. ❌ 网络连接问题
3. ❌ 订单已过期
4. ❌ 余额不足

**解决方法**：
- 确认钱包已解锁
- 检查浏览器控制台错误信息
- 确认订单未过期
- 检查托管账户余额

### Q3: 释放失败，提示"BadState"？

**可能原因**：
1. ❌ 订单状态不是 PaidOrCommitted
2. ❌ 您不是订单的卖家
3. ❌ 托管账户余额不足

**解决方法**：
- 检查订单状态
- 确认使用正确的卖家账户
- 检查挂单托管余额

### Q4: 如何查看托管账户余额？

```bash
node -e "
const { ApiPromise, WsProvider } = require('@polkadot/api');
(async () => {
  const api = await ApiPromise.create({ 
    provider: new WsProvider('ws://127.0.0.1:9944') 
  });
  const listingId = 1;
  const listing = await api.query.otcListing.listings(listingId);
  const data = listing.unwrap().toJSON();
  console.log('挂单 ID:', listingId);
  console.log('做市商:', data.maker);
  console.log('剩余数量:', (BigInt(data.remaining) / BigInt(1e12)).toString(), 'MEMO');
  await api.disconnect();
})();
"
```

### Q5: 订单过期了怎么办？

订单过期后：
- ❌ 无法再释放MEMO
- ✅ 可以调用 `refund_on_timeout` 退款
- ✅ 库存会自动恢复到挂单

**退款方法**：
```javascript
api.tx.otcOrder.refundOnTimeout(orderId).signAndSend(signer)
```

---

## 安全提示

### ⚠️ 重要安全规则

1. **必须确认收到法币**
   - ✅ 检查银行账户/支付宝/微信
   - ✅ 确认金额正确
   - ✅ 确认支付人身份
   - ❌ 不要仅凭买家口头承诺

2. **谨慎操作**
   - ✅ 释放前仔细核对订单信息
   - ✅ 确认买家地址正确
   - ✅ 确认释放数量正确
   - ❌ 释放后无法撤销

3. **防止欺诈**
   - ✅ 要求买家提供支付截图
   - ✅ 核对支付时间与订单时间
   - ✅ 保存所有沟通记录
   - ✅ 发现异常立即标记争议

4. **时间管理**
   - ✅ 及时处理订单（避免过期）
   - ✅ 设置订单提醒
   - ✅ 定期检查待处理订单

---

## 技术细节

### 订单状态机

```
       ┌──────────┐
       │ Created  │ 订单已创建
       └────┬─────┘
            │ markPaid()
            ↓
   ┌────────────────┐
   │PaidOrCommitted │ 买家已支付
   └───┬────────┬───┘
       │        │
       │        └─→ markDisputed() → Disputed (争议)
       │
       │ release()
       ↓
   ┌──────────┐
   │ Released │ 已完成
   └──────────┘
       
   超时/取消 → Refunded/Canceled
```

### 托管机制

**库存托管模式**：
1. 做市商创建挂单时，MEMO锁定在挂单托管账户
2. 买家创建订单时，从挂单库存中预留数量
3. 卖家释放时，从挂单托管转账给买家
4. 退款时，将预留数量退回挂单库存

**优点**：
- ✅ 买家无需预先锁定资金
- ✅ 降低双向锁定复杂度
- ✅ 简化退款流程

---

## 相关文件

| 文件路径 | 说明 |
|---------|------|
| `/home/xiaodong/文档/stardust/stardust-dapp/src/features/otc/SellerReleasePage.tsx` | 卖家释放页面组件 |
| `/home/xiaodong/文档/stardust/stardust-dapp/src/routes.tsx` | 路由配置（#/otc/release） |
| `/home/xiaodong/文档/stardust/自动创建买单.js` | 创建测试订单脚本 |
| `/home/xiaodong/文档/stardust/买家标记已支付.js` | 买家标记已支付脚本 |
| `/home/xiaodong/文档/stardust/pallets/otc-order/src/lib.rs` | OTC订单pallet源码 |

---

## 后续改进建议

### 1. 通知功能
- [ ] 订单状态变化邮件/短信通知
- [ ] 浏览器推送通知
- [ ] 订单即将过期提醒

### 2. 聊天功能
- [ ] 买卖双方实时沟通
- [ ] 发送支付截图
- [ ] 订单留言板

### 3. 自动化
- [ ] 对接支付宝/微信支付API
- [ ] 自动验证支付
- [ ] 自动释放MEMO

### 4. 数据统计
- [ ] 交易成功率
- [ ] 平均处理时间
- [ ] 卖家信用评分

---

## 总结

✅ **页面已完成的功能**：
- 显示待处理订单列表
- 查看订单详情
- 一键释放MEMO
- 确认对话框
- 实时刷新
- 过期提示

✅ **已测试的功能**：
- 订单查询
- 状态过滤
- 释放交易
- 事件监听

✅ **已创建的文档**：
- 使用说明（本文档）
- 测试脚本
- 示例代码

---

*文档创建时间: 2025-10-18*
*页面访问地址: http://127.0.0.1:5173/#/otc/release*

