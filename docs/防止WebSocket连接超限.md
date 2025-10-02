# 防止 WebSocket 连接数超限指南

## 问题描述

链节点返回错误：
```
429 Too Many Requests - Too many connections
```

前端显示：
```
API 连接失败：区块链连接失败
```

## 根本原因

WebSocket 连接未正确释放，导致连接数累积超过节点限制（默认 25-50）。

**常见触发场景**：
1. 频繁刷新页面（每次创建新连接，旧连接未关闭）
2. 多个标签页同时打开前端
3. 页面组件多次调用 `getApi()` 创建重复连接
4. 浏览器未正确触发 `beforeunload` 事件
5. 开发时热重载导致连接泄漏

## 解决方案（已实施）

### 1. 链端：增加最大连接数限制 ✅

**启动参数优化**：
```bash
./target/release/memopark-node \
  --dev \
  --rpc-external \
  --rpc-port 9944 \
  --rpc-cors=all \
  --rpc-max-connections 100 \      # 增加到 100
  --ws-max-connections 100 \        # WebSocket 连接数限制
  --base-path ./my-chain-state/
```

**推荐值**：
- **开发环境**：100-200
- **测试环境**：200-500
- **生产环境**：1000+（根据负载调整）

### 2. 前端：优化 API 连接管理 ✅

**改进点**：

#### (1) 全局单例模式
```typescript
let api: ApiPromise | null = null  // 全局单例
```

#### (2) 自动重连机制
```typescript
api.on('disconnected', () => {
  console.warn('WebSocket 已断开，下次调用将重连')
  api = null  // 标记为 null，触发重连
})
```

#### (3) 错误监听
```typescript
api.on('error', (error) => {
  console.error('API 错误:', error)
})
```

#### (4) 手动断开接口
```typescript
export async function disconnectApi(): Promise<void> {
  if (api) {
    await api.disconnect()
    api = null
  }
}
```

### 3. 链端启动脚本优化 ✅

创建启动脚本：

```bash
#!/bin/bash
# 文件：start-node.sh

# 停止旧节点
pkill -9 memopark-node

# 等待端口释放
sleep 2

# 启动新节点（增加连接数限制）
cd /home/xiaodong/文档/memopark

nohup ./target/release/memopark-node \
  --dev \
  --rpc-external \
  --rpc-port 9944 \
  --rpc-cors=all \
  --rpc-max-connections 100 \
  --ws-max-connections 100 \
  --base-path ./my-chain-state/ \
  > blockchain.log 2>&1 &

echo "✓ 链节点已启动（最大连接数：100）"
echo "✓ 日志文件：blockchain.log"
echo "✓ 端口：9944"

# 等待启动
sleep 3

# 显示进程
ps aux | grep memopark-node | grep -v grep
```

使用方式：
```bash
chmod +x start-node.sh
./start-node.sh
```

## 开发最佳实践

### 1. 页面开发规范

**❌ 错误做法**：每个组件独立创建 API
```typescript
// 组件 A
const api = await ApiPromise.create(...)

// 组件 B
const api = await ApiPromise.create(...)

// 组件 C
const api = await ApiPromise.create(...)
// → 3 个连接！
```

**✅ 正确做法**：使用全局单例
```typescript
// 所有组件
import { getApi } from '../../lib/polkadot'
const api = await getApi()  // 复用同一个连接
```

### 2. 组件卸载时清理

**React 组件示例**：
```typescript
useEffect(() => {
  // 组件加载时连接
  const initApi = async () => {
    const apiInstance = await getApi()
    setApi(apiInstance)
  }
  initApi()
  
  // 组件卸载时清理（可选，全局 API 可以保持）
  return () => {
    // 如果需要强制断开
    // disconnectApi()
  }
}, [])
```

### 3. 避免重复连接

**使用 React Context 或全局状态**：
```typescript
// WalletProvider 中统一管理
const [api, setApi] = useState<ApiPromise | null>(null)

useEffect(() => {
  const init = async () => {
    const apiInstance = await getApi()
    setApi(apiInstance)
  }
  init()
}, [])

// 其他组件从 Context 获取
const { api } = useWallet()
```

### 4. 开发时注意事项

- ⚠️ **不要频繁刷新页面**（每次刷新可能留下僵尸连接）
- ⚠️ **关闭不用的标签页**（每个标签一个连接）
- ⚠️ **热重载后检查连接数**（Vite HMR 可能不释放连接）
- ✅ **定期重启节点**（清理所有连接）

## 监控和诊断

### 1. 检查当前连接数

**链端日志**：
```bash
tail -f blockchain.log | grep -i "connection\|websocket"
```

**netstat 查看**：
```bash
# 查看 9944 端口的连接数
netstat -an | grep 9944 | wc -l

# 详细连接列表
netstat -an | grep 9944 | grep ESTABLISHED
```

### 2. 浏览器 DevTools

**Network 标签**：
- 查看 WebSocket 连接状态
- 检查是否有多个 ws://127.0.0.1:9944 连接
- 正常情况应该只有 1 个

**Console 日志**：
```javascript
// 检查 API 连接状态
window.__debugApi = async () => {
  const { getApi } = await import('./src/lib/polkadot')
  const api = await getApi()
  console.log('API 已连接:', api.isConnected)
  console.log('Provider 状态:', api.provider.isConnected)
}
```

### 3. 节点健康检查脚本

```bash
#!/bin/bash
# 文件：check-node.sh

echo "=== 节点健康检查 ==="

# 检查进程
if pgrep -f memopark-node > /dev/null; then
  echo "✓ 节点进程运行中"
else
  echo "✗ 节点进程未运行"
  exit 1
fi

# 检查端口
if netstat -tln | grep :9944 > /dev/null; then
  echo "✓ 端口 9944 监听中"
else
  echo "✗ 端口 9944 未监听"
  exit 1
fi

# 检查连接数
CONN_COUNT=$(netstat -an | grep 9944 | grep ESTABLISHED | wc -l)
echo "当前连接数: $CONN_COUNT"

if [ $CONN_COUNT -gt 80 ]; then
  echo "⚠️  警告：连接数过高（$CONN_COUNT/100）"
elif [ $CONN_COUNT -gt 50 ]; then
  echo "⚠️  注意：连接数较多（$CONN_COUNT/100）"
else
  echo "✓ 连接数正常"
fi

# 测试 RPC
if curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' http://127.0.0.1:9944 > /dev/null; then
  echo "✓ RPC 可访问"
else
  echo "✗ RPC 不可访问"
fi

echo ""
echo "=== 检查完成 ==="
```

## 预防措施

### 1. 启动脚本标准化

将启动命令保存为脚本：

```bash
# start-node.sh
#!/bin/bash

cd /home/xiaodong/文档/memopark

# 检查是否已运行
if pgrep -f memopark-node > /dev/null; then
  echo "节点已在运行，先停止..."
  pkill -9 memopark-node
  sleep 2
fi

# 清理旧日志（可选）
# mv blockchain.log blockchain.log.old

# 启动节点
nohup ./target/release/memopark-node \
  --dev \
  --rpc-external \
  --rpc-port 9944 \
  --rpc-cors=all \
  --rpc-max-connections 100 \
  --ws-max-connections 100 \
  --base-path ./my-chain-state/ \
  > blockchain.log 2>&1 &

sleep 3

# 验证启动
if pgrep -f memopark-node > /dev/null; then
  echo "✓ 链节点启动成功"
  echo "✓ 日志: tail -f blockchain.log"
  echo "✓ 端口: 9944"
  echo "✓ 最大连接数: 100"
else
  echo "✗ 链节点启动失败"
  exit 1
fi
```

### 2. 前端开发规范

**App.tsx 中统一管理连接**：
```typescript
// ✅ 正确：在顶层 Provider 初始化一次
const WalletProvider = ({ children }) => {
  const [api, setApi] = useState<ApiPromise | null>(null)
  
  useEffect(() => {
    getApi().then(setApi)
    
    // 页面卸载时断开（可选）
    return () => {
      // disconnectApi()  // 通常不需要，保持连接更好
    }
  }, [])
  
  return <Context.Provider value={{ api }}>{children}</Context.Provider>
}

// ✅ 子组件从 Context 获取
const MyComponent = () => {
  const { api } = useWallet()
  // 直接使用，不创建新连接
}
```

**❌ 避免的做法**：
```typescript
// 每个组件都调用 getApi()
const MyComponent = () => {
  const [api, setApi] = useState(null)
  
  useEffect(() => {
    getApi().then(setApi)  // ❌ 可能导致重复连接
  }, [])
}
```

### 3. 定期清理（Systemd/Cron）

**定时重启节点**（可选）：
```bash
# /etc/cron.d/memopark-node
# 每天凌晨 3 点重启节点
0 3 * * * xiaodong /home/xiaodong/文档/memopark/start-node.sh
```

### 4. 监控告警

**简单监控脚本**：
```bash
#!/bin/bash
# monitor-connections.sh

while true; do
  COUNT=$(netstat -an | grep 9944 | grep ESTABLISHED | wc -l)
  
  if [ $COUNT -gt 80 ]; then
    echo "[$(date)] ⚠️  连接数过高: $COUNT/100"
    # 发送告警（可选）
    # curl -X POST https://your-alert-webhook ...
  fi
  
  sleep 60  # 每分钟检查一次
done
```

## 应急处理

### 快速恢复（3 步）

```bash
# 1. 停止节点
pkill -9 memopark-node

# 2. 等待端口释放
sleep 2

# 3. 重启节点（增加连接数）
./target/release/memopark-node \
  --dev \
  --rpc-external \
  --rpc-port 9944 \
  --rpc-cors=all \
  --rpc-max-connections 100 \
  --ws-max-connections 100 \
  --base-path ./my-chain-state/ \
  > blockchain.log 2>&1 &
```

### 前端刷新

```bash
# 1. 清理浏览器
- 关闭所有标签页
- 清除浏览器缓存（Ctrl+Shift+Delete）

# 2. 清理 Vite 缓存
cd memopark-dapp
rm -rf node_modules/.vite

# 3. 重启前端
npm run dev
```

## 长期优化

### 1. 升级到连接池模式（高级）

```typescript
// lib/api-pool.ts
class ApiPool {
  private pool: ApiPromise[] = []
  private maxSize = 5
  
  async acquire(): Promise<ApiPromise> {
    // 从池中获取空闲连接
    // 或创建新连接
  }
  
  release(api: ApiPromise): void {
    // 归还连接到池
  }
}
```

### 2. 使用 HTTP RPC 作为回退

```typescript
// 如果 WebSocket 连接失败，回退到 HTTP
const provider = api.isConnected 
  ? new WsProvider('ws://127.0.0.1:9944')
  : new HttpProvider('http://127.0.0.1:9944')
```

### 3. 实现连接健康检查

```typescript
setInterval(async () => {
  if (api && !api.isConnected) {
    console.warn('检测到连接断开，重新连接...')
    api = null
    await getApi()
  }
}, 30_000)  // 每 30 秒检查一次
```

## 配置参考

### 开发环境

```toml
# 文件：start-node.sh 或 package.json scripts
--rpc-max-connections 100
--ws-max-connections 100
```

### 测试环境

```toml
--rpc-max-connections 500
--ws-max-connections 500
--rpc-max-request-size 10    # MB
--rpc-max-response-size 10   # MB
```

### 生产环境

```toml
--rpc-max-connections 2000
--ws-max-connections 2000
--rpc-max-request-size 50
--rpc-max-response-size 50
--rpc-max-subscriptions-per-connection 1024
```

## 监控指标

### 关键指标

| 指标 | 正常值 | 警告值 | 危险值 |
|------|--------|--------|--------|
| WebSocket 连接数 | < 50 | 50-80 | > 80 |
| 每秒请求数 | < 100 | 100-500 | > 500 |
| 内存使用 | < 2GB | 2-4GB | > 4GB |
| CPU 使用 | < 50% | 50-80% | > 80% |

### 监控脚本

```bash
#!/bin/bash
# health-check.sh

while true; do
  # 连接数
  WS_CONN=$(netstat -an | grep 9944 | grep ESTABLISHED | wc -l)
  
  # 内存使用（MB）
  MEM=$(ps -p $(pgrep -f memopark-node) -o rss= | awk '{print $1/1024}')
  
  # CPU 使用
  CPU=$(ps -p $(pgrep -f memopark-node) -o %cpu= | awk '{print $1}')
  
  echo "[$(date '+%H:%M:%S')] WS连接:$WS_CONN 内存:${MEM}MB CPU:${CPU}%"
  
  # 告警
  if [ $WS_CONN -gt 80 ]; then
    echo "⚠️  连接数过高，建议重启节点"
  fi
  
  sleep 10
done
```

## 故障排查

### 检查清单

- [ ] 链节点是否运行？`ps aux | grep memopark-node`
- [ ] 端口是否监听？`netstat -tln | grep 9944`
- [ ] 连接数是否超限？`netstat -an | grep 9944 | wc -l`
- [ ] 前端是否有多个标签页？
- [ ] Vite 缓存是否清理？`rm -rf node_modules/.vite`
- [ ] 浏览器是否清除缓存？

### 常见错误

**错误 1**：`Connection refused`
- **原因**：节点未启动
- **解决**：启动节点

**错误 2**：`429 Too Many Requests`
- **原因**：连接数超限
- **解决**：重启节点，增加连接数限制

**错误 3**：`Connection timeout`
- **原因**：网络延迟或节点负载高
- **解决**：增加超时时间（10 秒）

**错误 4**：`WebSocket disconnected`
- **原因**：节点重启或网络中断
- **解决**：自动重连机制（已实施）

## 总结

### 已实施的改进 ✅

1. **链端**：
   - ✅ 增加 `--rpc-max-connections 100`
   - ✅ 增加 `--ws-max-connections 100`
   - ✅ 优化启动脚本

2. **前端**：
   - ✅ 全局单例 API
   - ✅ 自动重连机制
   - ✅ 断开事件监听
   - ✅ 错误监听
   - ✅ 手动断开接口

3. **文档**：
   - ✅ 问题排查指南
   - ✅ 最佳实践
   - ✅ 监控脚本

### 预期效果

- ✅ 支持更多并发连接（100+）
- ✅ 连接断开自动重连
- ✅ 更清晰的错误提示
- ✅ 更稳定的开发体验

---

**现在请刷新浏览器，应该可以正常连接了！**

如果仍有问题，请提供：
1. 浏览器控制台的错误日志
2. `blockchain.log` 的最后 50 行
3. `netstat -an | grep 9944` 的输出
