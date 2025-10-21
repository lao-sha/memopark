# First Purchase Service - 首购服务

**版本**: v1.0.0  
**类型**: Claim中继服务（做市商代付GAS）  
**日期**: 2025-10-20

---

## 📋 功能概述

这是首购服务的**推荐实现方案**，保留了 `pallet-first-purchase` 的安全 `claim()` 机制，同时做市商代付GAS费用以优化用户体验。

### **核心功能**

✅ **安全授权**: 保留 `claim()` 的签名验证机制  
✅ **代付GAS**: 做市商自动代付交易费用  
✅ **自动化**: 自动轮询EPAY订单并执行claim  
✅ **用户友好**: 用户无需任何操作，MEMO自动到账

---

## 🎯 工作流程

```
1. 用户支付法币 → 做市商
2. EPAY记录订单（status=paid）
3. 做市商签发授权（链下签名）
4. 中继服务轮询订单
5. 检测到待处理订单
6. 做市商调用 claim() 并支付GAS
7. MEMO到账用户地址（全额）
8. 更新EPAY订单状态（completed）
```

---

## 🏗️ 目录结构

```
first-purchase-service/
├── src/
│   ├── config/
│   │   └── index.js              # 配置文件
│   ├── services/
│   │   ├── claim-relay-service.js # Claim中继服务
│   │   └── epay-service.js        # EPAY数据库服务
│   └── utils/
│       └── logger.js              # 日志工具
├── scripts/
│   ├── relay-worker.js            # 中继工作进程（主程序）
│   └── test-connection.js         # 连接测试脚本
├── package.json
├── .env
└── README.md
```

---

## 🚀 快速开始

### **1. 安装依赖**

```bash
cd /home/xiaodong/文档/memopark/first-purchase-service
npm install
```

### **2. 配置环境变量**

编辑 `.env` 文件：

```env
# 链节点地址
WS_ENDPOINT=ws://127.0.0.1:9944

# 做市商账户（用于代付GAS）
MAKER_SEED=//Alice

# 轮询间隔（毫秒）
POLL_INTERVAL=30000
```

### **3. 测试连接**

```bash
npm test
```

**预期输出**:
```
🧪 开始测试连接...

1️⃣ 测试链节点连接...
✅ 链节点连接成功
✅ 做市商账户: 5GrwvaEF...
💰 做市商余额: 1000000.0000 MEMO

✅ 所有测试通过！
```

### **4. 启动服务**

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

---

## 📊 核心组件

### **1. ClaimRelayService**

负责代付GAS并执行claim：

```javascript
const service = new ClaimRelayService(config.chain);
await service.init();

// 代付GAS执行claim
const result = await service.relayClaim({
  issuer_account: '5GrwvaEF...',
  order_id: '0x1234...',
  beneficiary: '5D5PhZQN...',
  amount_memo: '100000000000000', // 100 MEMO
  deadline_block: 12345,
  nonce: 1,
  signature: '0xabcd...'
});

console.log(`✅ TxHash: ${result.txHash}`);
console.log(`💰 GAS费用: ${result.gasCostMEMO} MEMO`);
```

### **2. EPAYService**

负责查询和更新EPAY订单：

```javascript
const service = new EPAYService(config.epay);
await service.init();

// 查询待处理订单
const orders = await service.getPendingOrders();

// 更新订单状态
await service.updateClaimStatus(orderId, {
  claimStatus: 'completed',
  txHash: '0x1234...'
});
```

### **3. RelayWorker**

自动化工作进程：

```javascript
const worker = new RelayWorker();
await worker.start(); // 开始轮询

// 自动执行：
// - 查询EPAY待处理订单
// - 代付GAS执行claim
// - 更新订单状态
// - 每30秒重复
```

---

## 🔒 安全特性

### **1. 授权验证**
- ✅ 链上验证做市商签名
- ✅ 防止未授权的claim
- ✅ 签名私钥可离线存储

### **2. 防重复**
- ✅ 订单ID唯一性检查
- ✅ 内存缓存已处理订单
- ✅ 链上 `ConsumedOrders` 标记

### **3. 限额保护**
- ✅ 做市商余额检查
- ✅ 单笔/日累计限额（链上）
- ✅ 余额不足时拒绝

### **4. 私钥安全**
- ✅ 环境变量存储（测试）
- ✅ 可升级到HSM/KMS（生产）
- ✅ 最小权限原则

---

## 📝 EPAY数据库设计

### **订单表结构**

```sql
CREATE TABLE first_purchase_orders (
  id VARCHAR(64) PRIMARY KEY COMMENT '订单ID',
  user_address VARCHAR(128) NOT NULL COMMENT '用户地址',
  memo_amount VARCHAR(32) NOT NULL COMMENT 'MEMO金额',
  fiat_amount DECIMAL(10,2) NOT NULL COMMENT '法币金额',
  status ENUM('pending','paid','expired') DEFAULT 'pending' COMMENT '支付状态',
  claim_status ENUM('pending','completed','failed') DEFAULT 'pending' COMMENT 'Claim状态',
  auth_data TEXT COMMENT '授权数据（JSON）',
  tx_hash VARCHAR(128) COMMENT '交易Hash',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP NULL COMMENT 'Claim完成时间',
  INDEX idx_claim_status (status, claim_status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首购订单表';
```

### **授权数据格式**

```json
{
  "issuer_account": "5GrwvaEF...",
  "order_id": "0x1234...",
  "beneficiary": "5D5PhZQN...",
  "amount_memo": "100000000000000",
  "deadline_block": 12345,
  "nonce": 1,
  "signature": "0xabcd..."
}
```

---

## 🧪 测试

### **单元测试**

```bash
# 测试链节点连接
npm test

# 手动测试单个claim
node -e "
const service = require('./src/services/claim-relay-service');
const config = require('./src/config');

(async () => {
  const s = new service(config.chain);
  await s.init();
  
  const result = await s.relayClaim({
    issuer_account: '5GrwvaEF...',
    order_id: '0x1234...',
    beneficiary: '5D5PhZQN...',
    amount_memo: '100000000000000',
    deadline_block: 12345,
    nonce: 1,
    signature: '0xabcd...'
  });
  
  console.log('结果:', result);
  await s.close();
})();
"
```

---

## 📊 监控指标

### **关键指标**

- **处理订单数**: 每小时/每天
- **成功率**: 成功数/总数
- **平均GAS费用**: 单笔平均
- **做市商余额**: 实时监控
- **处理延迟**: 从支付到到账的时间

### **日志示例**

```
⏰ [2025-10-20T10:00:00.000Z] 开始轮询订单...
📋 待处理订单数: 3

📦 处理订单: ORDER_001
   用户地址: 5D5PhZQN...
   MEMO金额: 100
   支付状态: paid

🔄 开始中继claim...
  订单ID: ORDER_001
  受益人: 5D5PhZQN...
  金额: 100 MEMO

📤 提交claim交易...
📊 交易状态: Ready
📊 交易状态: InBlock
✅ 交易已打包到区块: 0x1234...
📊 交易状态: Finalized
✅ 交易已确认: 0x1234...
💰 GAS费用: 0.008500 MEMO
✅ Claim执行成功！

✅ Claim中继完成！
  TxHash: 0x1234...
  做市商支付GAS: 0.008500 MEMO
  用户收到: 100 MEMO（全额）

✅ 订单状态已更新: ORDER_001
✅ 订单处理完成: ORDER_001
```

---

## 🚀 生产部署

### **使用PM2**

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start scripts/relay-worker.js --name first-purchase-relay

# 查看状态
pm2 status

# 查看日志
pm2 logs first-purchase-relay

# 重启服务
pm2 restart first-purchase-relay

# 停止服务
pm2 stop first-purchase-relay

# 开机自启
pm2 startup
pm2 save
```

### **使用Docker**

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "scripts/relay-worker.js"]
```

```bash
# 构建
docker build -t first-purchase-relay .

# 运行
docker run -d \
  --name first-purchase-relay \
  --env-file .env \
  --restart unless-stopped \
  first-purchase-relay
```

---

## 💰 成本分析

### **GAS费用**

```
单笔claim: ~0.01 MEMO
日均100笔: ~1 MEMO
月均3000笔: ~30 MEMO

按MEMO价格 0.01 USDT:
日成本: ~$0.01
月成本: ~$0.30
年成本: ~$3.60
```

**结论**: GAS成本极低，不影响盈利模式

---

## 🎯 优势对比

| 特性 | claim() + 代付GAS | 直接转账 |
|-----|------------------|---------|
| **安全性** | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **用户体验** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **私钥风险** | 🟢 低（可离线） | 🔴 高（必须在线） |
| **防入侵** | 🟢 强 | 🟡 弱 |
| **防内部作恶** | 🟢 强 | 🟡 弱 |
| **合规性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **实施复杂度** | ⭐⭐⭐ | ⭐⭐ |
| **GAS成本** | 0.01 MEMO/笔 | 0.005 MEMO/笔 |

**推荐**: ✅ **claim() + 代付GAS 是最佳方案**

---

## 📚 相关文档

- [完整设计方案](../docs/首购直接转账-完整设计方案.md)
- [安全对比分析](../docs/首购claim机制-vs-直接转账分析.md)
- [快速对比](../docs/首购claim机制-快速对比.md)
- [GAS费用详解](../docs/首购GAS费用机制详解.md)

---

## 🆘 故障排查

### **问题1: 连接失败**

```bash
❌ 链节点连接失败
```

**解决**:
- 检查链节点是否运行: `curl -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getBlockHash"}' http://localhost:9944`
- 检查 `.env` 中 `WS_ENDPOINT` 配置

### **问题2: 余额不足**

```bash
❌ 做市商余额不足
```

**解决**:
- 查询余额: `polkadot-js-api query.system.account <address>`
- 转账MEMO到做市商地址

### **问题3: Claim失败**

```bash
❌ 交易执行失败: FirstPurchase.SignatureInvalid
```

**解决**:
- 检查授权数据是否正确
- 检查签名是否有效
- 检查订单是否已过期

---

## 📞 技术支持

- **文档**: [../docs](../docs)
- **问题反馈**: GitHub Issues
- **邮件**: dev@memopark.io

---

**版本**: v1.0.0  
**最后更新**: 2025-10-20  
**维护者**: Memopark 开发团队  
**状态**: ✅ 已完成，可投入使用

