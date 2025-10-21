# 做市商中继服务 (Maker Relay Service)

## 📋 项目简介

做市商中继服务是 Memopark OTC 系统的关键组件，负责接收 EPAY 支付网关的异步通知，验证支付信息后调用链上接口标记订单已支付。

**核心功能：**
- ✅ 接收 EPAY 异步支付通知
- ✅ 验证签名防止伪造
- ✅ 调用链上接口 `mark_order_paid`
- ✅ 支持 IP 白名单安全增强
- ✅ 完整的日志记录
- ✅ 健康检查和监控接口

---

## 🏗️ 架构说明

```
EPAY 支付网关
      ↓ (异步通知)
中继服务 (本项目)
      ↓ (调用链上接口)
Memopark 链
      ↓ (触发事件)
做市商监听程序
      ↓ (释放 MEMO)
买家
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd maker-relay-service
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
vim .env
```

配置说明：

```env
# EPAY 配置
EPAY_PID=1001                          # 您的 EPAY 商户ID
EPAY_KEY=your_epay_secret_key_here     # 您的 EPAY 商户密钥

# 链配置
CHAIN_WS=ws://127.0.0.1:9944          # Memopark 节点地址
MAKER_MNEMONIC=your mnemonic here      # 做市商账户助记词

# 做市商配置
MM_ID=1                                # 链上的做市商ID

# 服务配置
PORT=3000                              # 服务端口
NODE_ENV=production                    # 环境（development/production）
LOG_LEVEL=info                         # 日志级别

# 安全配置（可选）
ALLOWED_IPS=118.195.160.179,127.0.0.1  # IP白名单
```

### 3. 启动服务

**开发模式：**
```bash
npm run dev
```

**生产模式：**
```bash
npm start
```

**使用 PM2（推荐）：**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📡 API 接口

### 1. 接收 EPAY 通知

```
GET /api/relay/notify
```

**参数：**
- `pid` - 商户ID
- `trade_no` - EPAY 订单号
- `out_trade_no` - 链上订单ID
- `type` - 支付方式
- `name` - 商品名称
- `money` - 支付金额
- `trade_status` - 交易状态
- `sign` - 签名
- `sign_type` - 签名类型
- `param` - 业务扩展参数（可选）

**响应：**
```
success  // 成功
fail     // 失败
```

**示例：**
```
GET /api/relay/notify?pid=1001&trade_no=202501210001&out_trade_no=123&money=100.00&trade_status=TRADE_SUCCESS&sign=abc123...
```

### 2. 健康检查

```
GET /health
```

**响应：**
```json
{
  "status": "ok",
  "service": "maker-relay-service",
  "mmId": 1,
  "pid": "1001",
  "chain": "connected",
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
}
```

### 3. 获取做市商信息

```
GET /api/info
```

**响应：**
```json
{
  "mmId": 1,
  "pid": "1001",
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "notifyUrl": "http://your-domain:3000/api/relay/notify",
  "status": "ready"
}
```

### 4. 手动标记订单（应急用）

```
POST /api/manual/mark-paid
Content-Type: application/json

{
  "orderId": "123",
  "epayTradeNo": "202501210001",
  "amount": "100.00"
}
```

---

## 🔒 安全配置

### 1. IP 白名单

在 `.env` 中配置：

```env
ALLOWED_IPS=118.195.160.179,10.0.0.1
```

只允许这些 IP 访问 `/api/relay/notify` 接口。

### 2. 签名验证

所有 EPAY 通知都会进行签名验证：
- 使用 MD5 哈希算法
- 按键名升序排列
- 拼接密钥后计算

### 3. 账户安全

**建议：**
- ✅ 做市商账户只用于标记订单，不存放大量资金
- ✅ 定期备份助记词
- ✅ 使用强密码保护服务器
- ✅ 启用防火墙只开放必要端口

---

## 📊 监控和日志

### 日志文件

```
logs/
├── combined.log      # 所有日志
├── error.log         # 错误日志
├── pm2-out.log       # PM2 标准输出
└── pm2-error.log     # PM2 错误输出
```

### 查看日志

```bash
# 实时查看
tail -f logs/combined.log

# PM2 日志
pm2 logs maker-relay

# 查看错误
tail -f logs/error.log
```

### PM2 监控

```bash
pm2 status          # 查看状态
pm2 monit           # 实时监控
pm2 restart maker-relay  # 重启服务
```

---

## 🛠️ 部署指南

### 服务器要求

- **最低配置：** 1核1G, 20GB硬盘
- **推荐配置：** 2核2G, 40GB硬盘
- **操作系统：** Ubuntu 20.04+ / CentOS 7+
- **Node.js：** v16+

### Nginx 配置（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location /api/relay/ {
        proxy_pass http://127.0.0.1:3000/api/relay/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
```

### SSL 证书（生产环境必须）

```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 防火墙配置

```bash
# 只开放必要端口
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS
sudo ufw enable
```

---

## 🔧 故障排查

### 1. 服务无法启动

**检查配置：**
```bash
# 验证环境变量
cat .env

# 检查日志
tail -f logs/error.log
```

**常见问题：**
- ❌ EPAY_PID 或 EPAY_KEY 未配置
- ❌ MAKER_MNEMONIC 格式错误
- ❌ 链节点无法连接

### 2. 签名验证失败

**检查：**
- EPAY_KEY 是否正确
- EPAY 通知参数是否完整
- 签名算法是否匹配

**调试：**
```bash
# 查看签名验证详情
LOG_LEVEL=debug npm start
```

### 3. 链上交易失败

**检查：**
- 做市商账户余额是否足够
- 订单是否存在
- 订单状态是否为 Pending
- 调用者是否是订单对应的做市商

---

## 🧪 测试

### 测试签名验证

```bash
curl -X POST http://localhost:3000/api/test/verify-sign \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "pid": "1001",
      "trade_no": "test001",
      "out_trade_no": "123",
      "money": "100.00",
      "trade_status": "TRADE_SUCCESS",
      "sign": "your_signature"
    }
  }'
```

### 测试健康检查

```bash
curl http://localhost:3000/health
```

### 模拟 EPAY 通知

```bash
curl "http://localhost:3000/api/relay/notify?pid=1001&trade_no=test001&out_trade_no=123&type=alipay&name=test&money=100.00&trade_status=TRADE_SUCCESS&sign=calculated_sign&sign_type=MD5"
```

---

## 📝 维护建议

### 日常维护

1. **定期检查日志**
   ```bash
   pm2 logs maker-relay --lines 100
   ```

2. **监控服务状态**
   ```bash
   pm2 status
   ```

3. **定期备份**
   ```bash
   # 备份配置和日志
   tar -czf backup-$(date +%Y%m%d).tar.gz .env logs/
   ```

### 更新服务

```bash
# 1. 拉取最新代码
git pull

# 2. 安装依赖
npm install

# 3. 重启服务
pm2 restart maker-relay
```

---

## 🤝 技术支持

如有问题，请联系 Memopark 团队或查看项目文档。

---

## 📄 许可证

MIT License

