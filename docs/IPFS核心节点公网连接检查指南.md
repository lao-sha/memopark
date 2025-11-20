# IPFS核心节点公网连接检查指南

**版本**: v1.0  
**日期**: 2025-10-27  
**目的**: 验证3个核心IPFS节点是否正确连接到IPFS公网DHT

---

## 📋 检查目的

由于stardust项目**无需隐私保护**，所有IPFS节点应该连接到IPFS公网，以实现：
1. ✅ 数据全球可访问性
2. ✅ 更好的内容冗余和可用性
3. ✅ 利用全球IPFS网络的DHT和内容路由
4. ✅ 降低维护成本（利用公网节点）

---

## 🚀 快速开始

### 方式1：使用自动检查脚本（推荐）

```bash
cd /home/xiaodong/文档/stardust
./scripts/check-ipfs-public-network.sh
```

脚本会自动检查3个核心节点并生成详细报告。

### 方式2：手动检查单个节点

```bash
# 1. 检查节点ID和地址
curl -X POST "http://localhost:5001/api/v0/id" | jq

# 2. 检查连接的对等节点
curl -X POST "http://localhost:5001/api/v0/swarm/peers" | jq '.Peers | length'

# 3. 检查Routing配置
curl -X POST "http://localhost:5001/api/v0/config?arg=Routing.Type" | jq

# 4. 测试DHT查询
curl -X POST "http://localhost:5001/api/v0/dht/findprovs?arg=QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
```

---

## 🔍 检查项目详解

### 1. 节点在线状态
**检查内容**: 节点是否正在运行  
**判断标准**: 
- ✅ 能够访问IPFS API
- ❌ API无响应

### 2. 节点地址信息
**检查内容**: 节点监听的网络地址  
**判断标准**:
- ✅ 有公网IP地址（非10.x, 172.16-31.x, 192.168.x）
- ⚠️ 仅有私有IP地址
- ❌ 无有效地址

### 3. Swarm对等节点数量
**检查内容**: 连接到的IPFS节点数量和类型  
**判断标准**:
- ✅ 公网节点 > 10个（良好连接）
- ⚠️ 公网节点 1-10个（连接较弱）
- ❌ 公网节点 = 0（隔离网络）

### 4. DHT功能测试
**检查内容**: 分布式哈希表（DHT）是否正常工作  
**判断标准**:
- ✅ 能够通过DHT查询找到内容提供者
- ⚠️ DHT查询超时
- ❌ DHT查询失败

### 5. 内容路由测试（可选）
**检查内容**: 本地添加的内容能否被公网访问  
**判断标准**:
- ✅ 内容可通过公网网关（ipfs.io）访问
- ⚠️ 需要时间传播
- ❌ 公网无法访问

### 6. IPFS配置检查
**检查内容**: IPFS节点的关键配置项  
**判断标准**:
- ✅ `Routing.Type = dht`（完整DHT节点）
- ⚠️ `Routing.Type = dhtclient`（仅DHT客户端）
- ❌ `Routing.Type = none`（无DHT）

---

## 📊 报告解读

### 理想状态（全部✓）

```markdown
## 节点1: Core Node 1
**Peer ID**: `QmXXXXXXXXXXXXXXX...`
**对等节点数**: 156 (公网: 143 ✓, 私有: 13)
**DHT功能**: ✓ 正常 (找到 8 个提供者)
**Routing配置**: `dht` ✓
```

**解读**: 节点完美连接到IPFS公网，可以全球访问。

---

### 警告状态（部分⚠️）

```markdown
## 节点2: Core Node 2
**Peer ID**: `QmYYYYYYYYYYYYYYY...`
**对等节点数**: 35 (公网: 5 ⚠️, 私有: 30)
**DHT功能**: ⚠️ 超时
**Routing配置**: `dhtclient` ⚠️
```

**解读**: 节点连接较弱，可能：
- 防火墙限制
- 网络带宽不足
- 配置为DHT客户端模式

**建议操作**:
```bash
# 1. 改为完整DHT节点
ipfs config Routing.Type dht

# 2. 重启IPFS
systemctl restart ipfs

# 3. 检查防火墙
sudo ufw allow 4001/tcp
```

---

### 错误状态（多个❌）

```markdown
## 节点3: Core Node 3
**Peer ID**: `QmZZZZZZZZZZZZZZZ...`
**对等节点数**: 3 (公网: 0 ❌, 私有: 3)
**DHT功能**: ❌ 失败
**Routing配置**: `none` ❌
```

**解读**: 节点运行在完全隔离的私有网络中！

**紧急操作**:
```bash
# 1. 检查IPFS配置
ipfs config show

# 2. 启用DHT
ipfs config Routing.Type dht

# 3. 添加公网引导节点
ipfs bootstrap add /dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN

# 4. 重启IPFS Daemon
ipfs shutdown
ipfs daemon &

# 5. 检查swarm地址
ipfs swarm addrs local

# 6. 确保监听公网端口
ipfs config Addresses.Swarm --json '["/ip4/0.0.0.0/tcp/4001", "/ip6/::/tcp/4001"]'
```

---

## 🛠️ 常见问题解决

### Q1: 所有节点显示"离线"

**原因**: IPFS Daemon未运行  
**解决**:
```bash
# 启动IPFS Daemon
ipfs daemon &

# 或使用systemd
systemctl start ipfs
```

---

### Q2: 节点在线但无公网对等节点

**原因**: 
1. 防火墙阻止
2. 仅监听私有地址
3. 无公网IP

**解决**:
```bash
# 1. 检查监听地址
ipfs config Addresses.Swarm

# 2. 设置监听所有接口
ipfs config Addresses.Swarm --json '[
  "/ip4/0.0.0.0/tcp/4001",
  "/ip6/::/tcp/4001",
  "/ip4/0.0.0.0/udp/4001/quic",
  "/ip6/::/udp/4001/quic"
]'

# 3. 开放防火墙端口
sudo ufw allow 4001/tcp
sudo ufw allow 4001/udp

# 4. 重启IPFS
ipfs shutdown && ipfs daemon &
```

---

### Q3: DHT查询失败

**原因**: DHT未启用或配置错误  
**解决**:
```bash
# 1. 检查Routing配置
ipfs config Routing.Type

# 2. 启用DHT
ipfs config Routing.Type dht

# 3. 重启节点
ipfs shutdown && ipfs daemon &

# 4. 等待DHT索引建立（可能需要几分钟）
sleep 60

# 5. 再次测试
ipfs dht findprovs QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

---

### Q4: 内容无法通过公网网关访问

**原因**: 
1. 内容刚添加，还未传播
2. 节点未向DHT发布内容
3. 节点被防火墙隔离

**解决**:
```bash
# 1. 手动发布到DHT
ipfs dht provide <YOUR_CID>

# 2. 检查内容是否在本地
ipfs pin ls | grep <YOUR_CID>

# 3. 等待传播（通常5-30分钟）

# 4. 通过其他节点测试
ipfs cat /ipfs/<YOUR_CID> --api=/ip4/<OTHER_NODE_IP>/tcp/5001
```

---

## 📈 性能优化建议

### 1. 提升公网连接质量

```bash
# 增加连接限制
ipfs config Swarm.ConnMgr.HighWater 900
ipfs config Swarm.ConnMgr.LowWater 600

# 启用加速模式
ipfs config --json Experimental.AcceleratedDHTClient true
```

### 2. 优化DHT性能

```bash
# 使用DHT服务器模式（更主动）
ipfs config Routing.Type dht

# 增加DHT查询并发
ipfs config --json Routing.RefreshInterval 300
```

### 3. 配置公网宣告地址（如果有公网IP）

```bash
# 如果节点有公网IP（例如：203.0.113.10）
ipfs config --json Addresses.Announce '[
  "/ip4/203.0.113.10/tcp/4001"
]'

# 重启使生效
ipfs shutdown && ipfs daemon &
```

---

## 🔐 安全建议

### 无隐私保护场景（当前项目）

✅ **推荐配置**:
- 完全连接到IPFS公网
- 启用DHT（`dht`模式）
- 开放所有必要端口
- 使用公网引导节点

⚠️ **注意事项**:
- 所有添加的内容全球可访问
- CID公开可查询
- 适合公开数据场景

---

## 📝 检查报告模板

```markdown
# IPFS核心节点公网连接检查报告

**检查时间**: 2025-10-27 14:30:00
**检查节点**: 3个核心节点

## 执行摘要

| 节点 | 状态 | 公网对等节点 | DHT功能 | 评级 |
|------|------|-------------|---------|------|
| Core Node 1 | ✓ 在线 | 143 ✓ | ✓ 正常 | 优秀 |
| Core Node 2 | ✓ 在线 | 5 ⚠️ | ⚠️ 超时 | 一般 |
| Core Node 3 | ❌ 离线 | N/A | N/A | 需修复 |

## 总结

- ✅ 1个节点完美连接公网
- ⚠️ 1个节点部分连接
- ❌ 1个节点需要修复

## 建议

1. 修复Core Node 3的连接问题
2. 优化Core Node 2的DHT配置
3. 定期（每周）运行此检查脚本
```

---

## 🔄 定期检查建议

### 自动化检查（推荐）

```bash
# 1. 创建cron任务（每天凌晨2点检查）
crontab -e

# 添加以下行：
0 2 * * * /home/xiaodong/文档/stardust/scripts/check-ipfs-public-network.sh >> /var/log/ipfs-check.log 2>&1

# 2. 查看历史报告
ls -lh ipfs-public-network-check-*.md
```

### 监控指标

建议监控以下指标：
1. **对等节点数**: 应保持 > 50
2. **公网节点占比**: 应 > 80%
3. **DHT查询成功率**: 应 > 95%
4. **内容传播时间**: 应 < 5分钟

---

## 📞 支持

如果检查后仍有问题，请提供：
1. 完整的检查报告文件
2. IPFS配置文件：`ipfs config show`
3. IPFS日志：`ipfs log tail`
4. 网络环境信息

---

**文档版本**: v1.0  
**最后更新**: 2025-10-27

