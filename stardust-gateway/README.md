# 星尘链 API Gateway

统一 API 网关 - 为星尘链提供统一的 HTTP/WebSocket 接口

## 功能特性

- ✅ **统一路由** - 整合区块链、占卜、纪念等所有服务
- ✅ **JWT 认证** - 基于 Substrate 账户的身份验证
- ✅ **智能缓存** - Redis 缓存层，减少链上查询
- ✅ **请求限流** - 基于 IP 和用户的多级限流
- ✅ **服务降级** - 优雅处理微服务故障
- ✅ **日志追踪** - 结构化日志和请求追踪
- ✅ **CORS 支持** - 跨域资源共享配置

## 架构

```
┌─────────────┐
│ React DApp  │
└──────┬──────┘
       │ HTTP/WS
┌──────▼──────────────────────────┐
│   API Gateway (Axum + Tower)    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  • 路由转发  • 认证鉴权          │
│  • 缓存管理  • 限流控制          │
└───┬─────────┬──────────┬────────┘
    │         │          │
┌───▼───┐ ┌──▼─────┐ ┌──▼──────┐
│ 占卜  │ │ Redis  │ │Substrate│
│ 服务  │ │ 缓存   │ │  节点   │
└───────┘ └────────┘ └─────────┘
```

## 快速开始

### 1. 配置环境

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置（修改 JWT 密钥等）
vim .env
```

### 2. 本地运行

```bash
# 安装依赖
cargo build

# 运行开发服务器
cargo run

# 访问健康检查
curl http://localhost:8080/health
```

### 3. Docker 部署

```bash
# 构建镜像
docker build -t stardust-gateway:latest .

# 使用 Docker Compose 启动全套服务
docker-compose up -d

# 查看日志
docker-compose logs -f gateway
```

## API 文档

### 健康检查

```bash
GET /health
```

响应示例：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "0.1.0",
    "uptime": 3600,
    "services": {
      "substrate": true,
      "redis": true,
      "divination": true
    }
  },
  "timestamp": 1702886400
}
```

### 占卜接口

#### 小六壬占卜

```bash
POST /api/v1/divination/xiaoliuren
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "year": 2024,
  "month": 12,
  "day": 15,
  "hour": 14,
  "question": "今日运势如何？"
}
```

#### 紫微斗数

```bash
POST /api/v1/divination/ziwei
Authorization: Bearer <JWT_TOKEN>

{
  "birth_year": 1990,
  "birth_month": 1,
  "birth_day": 15,
  "birth_hour": 10,
  "gender": "male",
  "is_leap_month": false
}
```

### 区块链查询

#### 最新区块

```bash
GET /api/v1/chain/block/latest
```

#### Runtime 版本

```bash
GET /api/v1/chain/runtime/version
```

#### 账户信息

```bash
GET /api/v1/chain/account?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

## 配置说明

### 环境变量

所有配置通过环境变量设置，格式为 `STARDUST_GATEWAY__<SECTION>__<KEY>`：

| 配置项 | 说明 | 默认值 |
|-------|------|--------|
| `SERVER__HOST` | 监听地址 | `0.0.0.0` |
| `SERVER__PORT` | 监听端口 | `8080` |
| `SUBSTRATE__WS_URL` | Substrate 节点地址 | `ws://127.0.0.1:9944` |
| `REDIS__URL` | Redis 连接地址 | `redis://127.0.0.1:6379` |
| `DIVINATION__BASE_URL` | 占卜服务地址 | `http://127.0.0.1:3001` |
| `AUTH__JWT_SECRET` | JWT 签名密钥 | **必须设置** |
| `LOGGING__LEVEL` | 日志级别 | `info` |

## 开发指南

### 添加新路由

1. 在 `src/routes/` 创建新模块
2. 实现 Handler 函数
3. 在 `src/routes/mod.rs` 中注册路由

示例：

```rust
// src/routes/memorial.rs
pub async fn get_memorial_handler(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<Json<ApiResponse<Memorial>>, ApiError> {
    // 实现逻辑
}

// src/routes/mod.rs
Router::new()
    .route("/memorial/:id", get(memorial::get_memorial_handler))
```

### 添加中间件

在 `src/middleware/` 中实现，并在路由中应用：

```rust
.layer(middleware::from_fn_with_state(
    state.clone(),
    custom_middleware,
))
```

### 缓存策略

使用 `get_or_set` 模式：

```rust
let result = state.cache.get_or_set(&cache_key, 3600, || async {
    // 计算逻辑
    Ok(data)
}).await?;
```

## 性能优化

- **连接池**: Redis/Substrate 使用连接池管理
- **请求限流**: 全局 100 req/s，占卜接口 10 req/min
- **响应压缩**: 自动 gzip 压缩大响应体
- **缓存策略**: 占卜结果缓存 1 小时

## 监控与调试

### 查看日志

```bash
# JSON 格式（生产）
STARDUST_GATEWAY__LOGGING__JSON=true cargo run

# 人类可读（开发）
RUST_LOG=debug cargo run
```

### 健康检查

```bash
# 检查各服务状态
curl http://localhost:8080/health | jq
```

## 故障排查

### Gateway 无法连接 Substrate

- 检查节点是否运行：`curl http://localhost:9944`
- 验证 WebSocket 配置：`STARDUST_GATEWAY__SUBSTRATE__WS_URL`

### Redis 连接失败

```bash
# 检查 Redis 状态
redis-cli ping

# 查看连接配置
echo $STARDUST_GATEWAY__REDIS__URL
```

### 占卜服务超时

- 增加超时时间：`STARDUST_GATEWAY__DIVINATION__TIMEOUT=60`
- 增加重试次数：`STARDUST_GATEWAY__DIVINATION__RETRIES=5`

## 安全建议

- ✅ 生产环境更换强 JWT 密钥
- ✅ 使用 HTTPS/WSS 加密传输
- ✅ 配置严格的 CORS 策略
- ✅ 定期轮换密钥
- ✅ 监控异常请求

## 许可证

MIT License
