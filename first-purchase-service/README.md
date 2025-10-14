# 首购法币支付网关服务

## 📋 项目概述

这是 MemoPark 首购法币支付网关服务，为新用户提供通过法币（支付宝/微信）购买少量 MEMO 的功能，解决新用户"冷启动"问题。

### 核心特性

- ✅ **推荐码可选**：用户可选择填写推荐码，无推荐码也可完成首购
- ✅ **灵活激励**：有推荐人享9折优惠并绑定推荐关系，无推荐人资金进国库
- ✅ **防恶意机制**：每地址限购一次，金额限制50-100 MEMO，IP风控
- ✅ **15分钟有效期**：订单15分钟内完成支付，超时自动作废
- ✅ **安全可靠**：链上授权调用，签名验证，自动监控托管账户余额

---

## 🏗️ 技术架构

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│             │         │              │         │              │
│  前端 React │ ───────▶│ 链下服务     │ ───────▶│ 区块链节点   │
│             │         │ Node.js      │         │ Substrate    │
│             │         │              │         │              │
└─────────────┘         └──────────────┘         └──────────────┘
                               │
                               │
                        ┌──────▼──────┐
                        │             │
                        │  Redis      │
                        │  订单缓存   │
                        │             │
                        └─────────────┘
                               │
                               │
                        ┌──────▼──────┐
                        │             │
                        │  epay       │
                        │  支付网关   │
                        │             │
                        └─────────────┘
```

---

## 🚀 快速开始

### 1. 环境要求

- Node.js >= 18.0.0
- Redis >= 7.0
- Docker & Docker Compose (可选)

### 2. 安装依赖

```bash
cd first-purchase-service
npm install
```

### 3. 配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件
vim .env
```

**必需配置项：**

```bash
# 区块链配置
WS_ENDPOINT=ws://127.0.0.1:9944
FIAT_GATEWAY_SEED=0x...   # 服务账户私钥

# Redis配置
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# epay配置
EPAY_PID=10001
EPAY_KEY=your_epay_key_here
EPAY_GATEWAY=https://epay.example.com
EPAY_NOTIFY_URL=https://your-domain.com/api/first-purchase/notify
EPAY_RETURN_URL=https://your-domain.com/first-purchase/success

# 国库账户
TREASURY_ACCOUNT=5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z
```

### 4. 启动服务

#### 方式1：直接启动

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

#### 方式2：Docker Compose启动

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f first-purchase-service

# 停止服务
docker-compose down
```

### 5. 验证服务

```bash
# 健康检查
curl http://localhost:3100/api/first-purchase/health

# 预期响应
{
  "success": true,
  "service": "first-purchase-service",
  "status": "running",
  "timestamp": "2025-10-13T10:00:00.000Z"
}
```

---

## 📡 API 接口文档

### 1. 创建首购订单

**POST** `/api/first-purchase/create`

**请求参数：**

```json
{
  "walletAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "amount": 80,
  "referralCode": "ABC123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| walletAddress | String | 是 | 钱包地址 |
| amount | Number | 是 | 购买数量（50-100 MEMO） |
| referralCode | String | 否 | 推荐码（6位字母数字） |

**响应示例：**

```json
{
  "success": true,
  "data": {
    "orderId": "MEMO_20251013_A1B2C3D4",
    "paymentUrl": "https://epay.com/pay?...",
    "amount": 80,
    "paymentAmount": 0.72,
    "discount": 0.08,
    "referrer": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    "expiresAt": "2025-10-13T10:15:00Z",
    "countdown": 900
  }
}
```

---

### 2. 查询订单状态

**GET** `/api/first-purchase/status/:orderId`

**响应示例：**

```json
{
  "success": true,
  "data": {
    "exists": true,
    "orderId": "MEMO_20251013_A1B2C3D4",
    "status": "completed",
    "walletAddress": "5GrwvaEF...",
    "amount": 80,
    "paymentAmount": 0.72,
    "referrer": "5FHneW46...",
    "blockHash": "0x1234...",
    "countdown": 0,
    "createdAt": "2025-10-13T10:00:00Z"
  }
}
```

**订单状态：**

- `pending` - 等待支付
- `paid` - 已支付，处理中
- `completed` - 已完成
- `expired` - 已过期

---

### 3. 检查地址是否已首购

**GET** `/api/first-purchase/check/:walletAddress`

**响应示例：**

```json
{
  "success": true,
  "data": {
    "walletAddress": "5GrwvaEF...",
    "hasFirstPurchased": false
  }
}
```

---

### 4. 支付回调接口（epay调用）

**POST** `/api/first-purchase/notify`

**epay回调参数：**

| 字段 | 说明 |
|------|------|
| trade_no | epay交易号 |
| out_trade_no | 商户订单号 |
| money | 支付金额 |
| trade_status | 支付状态 |
| sign | 签名 |

**响应：**

- 成功：返回 `success`
- 失败：返回 `fail`

---

## 🎯 前端集成

### 1. 安装依赖

前端已包含在 `memopark-dapp` 项目中，无需额外安装。

### 2. 配置API地址

```bash
# memopark-dapp/.env
VITE_FIRST_PURCHASE_API_URL=http://localhost:3100/api/first-purchase
```

### 3. 路由配置

```tsx
// memopark-dapp/src/App.tsx

import { FirstPurchasePage, PaymentPage } from './features/first-purchase';

<Routes>
  <Route path="/first-purchase" element={<FirstPurchasePage />} />
  <Route path="/first-purchase/payment/:orderId" element={<PaymentPage />} />
</Routes>
```

### 4. 使用示例

```tsx
import { useNavigate } from 'react-router-dom';

const MyComponent = () => {
  const navigate = useNavigate();
  
  return (
    <Button onClick={() => navigate('/first-purchase')}>
      首次购买 MEMO
    </Button>
  );
};
```

---

## 🔧 运维指南

### 1. 日志查看

```bash
# Docker环境
docker-compose logs -f first-purchase-service

# 直接启动
tail -f logs/combined.log
```

### 2. 监控托管账户余额

服务会自动监控托管账户余额，当余额低于阈值时会发送告警。

**手动查询：**

```bash
# 使用polkadot.js
const treasuryId = api.consts.otcOrder.fiatGatewayTreasuryAccount;
const balance = await api.query.system.account(treasuryId);
console.log('托管余额:', balance.data.free.toString());
```

### 3. 充值托管账户

```bash
# 计算托管账户地址
# PalletId(*b"fiatgate").into_account_truncating()

# 转账MEMO到托管账户
# 建议保持 10,000 - 100,000 MEMO
```

### 4. 处理异常订单

```bash
# 查询Redis中的订单
redis-cli
> KEYS order:*
> HGETALL order:MEMO_20251013_A1B2C3D4
```

### 5. 备份与恢复

```bash
# 备份Redis数据
redis-cli BGSAVE

# 恢复Redis数据
cp dump.rdb /data/redis/
docker-compose restart redis
```

---

## 🔐 安全最佳实践

### 1. 服务账户管理

- ✅ 使用环境变量存储私钥
- ✅ 定期轮换服务账户
- ✅ 限制服务账户权限（仅调用 first_purchase_by_fiat）

### 2. API安全

- ✅ 使用HTTPS（生产环境）
- ✅ 配置CORS白名单
- ✅ IP白名单（支付回调）
- ✅ 速率限制

### 3. 数据安全

- ✅ 定期备份Redis数据
- ✅ 敏感日志脱敏
- ✅ 监控异常订单

---

## 📊 性能优化

### 1. Redis优化

```bash
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### 2. Node.js优化

```bash
# 使用PM2管理进程
npm install -g pm2

pm2 start src/index.js --name first-purchase-service -i max
pm2 monit
```

### 3. Nginx优化

```nginx
# 启用gzip压缩
gzip on;
gzip_types application/json;

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;
```

---

## 🐛 常见问题

### 1. 连接区块链失败

**问题：** `Error: Unable to connect to ws://127.0.0.1:9944`

**解决：**
```bash
# 检查节点是否运行
ps aux | grep memopark-node

# 检查WebSocket端口
netstat -an | grep 9944

# 修改WS_ENDPOINT配置
WS_ENDPOINT=ws://host.docker.internal:9944  # Docker环境
```

---

### 2. Redis连接失败

**问题：** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**解决：**
```bash
# 启动Redis
docker-compose up -d redis

# 检查Redis状态
redis-cli ping
```

---

### 3. 支付回调未收到

**问题：** 已支付但订单状态未更新

**解决：**
```bash
# 检查回调URL配置
echo $EPAY_NOTIFY_URL  # 必须是公网可访问地址

# 检查日志
tail -f logs/combined.log | grep notify

# 手动查询epay订单状态
curl "https://epay.com/api.php?act=order&pid=10001&out_trade_no=MEMO_..."
```

---

### 4. 托管账户余额不足

**问题：** `Error: InsufficientBalance`

**解决：**
```bash
# 查询托管账户余额
curl http://localhost:3100/api/first-purchase/health

# 充值托管账户
# 转账到托管账户地址
```

---

## 📚 相关文档

1. [首购功能总结](../docs/首购功能总结.md)
2. [首购链端实现方案](../docs/首购链端实现方案.md)
3. [首购链端Runtime配置](../docs/首购链端Runtime配置.md)
4. [首购链端单元测试](../docs/首购链端单元测试.md)

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

## 📧 联系我们

- 项目主页：https://github.com/memopark/memopark
- 问题反馈：https://github.com/memopark/memopark/issues

---

*文档更新日期: 2025-10-13*

