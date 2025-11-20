# IPFS Cluster 部署方案 - 多节点网络配置

> **文档版本**: v1.0  
> **创建时间**: 2025-10-26  
> **作者**: Stardust开发团队  
> **状态**: 🚀 生产部署指南

---

## 📋 概述

本文档详细说明如何在Stardust项目的多个全节点之间部署IPFS Cluster网络，实现分布式存储和数据冗余。

### 核心目标

- ✅ 建立私有IPFS Cluster网络
- ✅ 实现多节点数据同步和复制
- ✅ 与Substrate节点集成
- ✅ 确保数据安全和访问控制
- ✅ 实现自动化故障恢复

---

## 🏗️ 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Stardust区块链网络                            │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  验证者节点1  │  │  验证者节点2  │  │  验证者节点3  │          │
│  │  (Validator) │  │  (Validator) │  │  (Validator) │          │
│  │              │  │              │  │              │          │
│  │  Substrate   │  │  Substrate   │  │  Substrate   │          │
│  │  Runtime     │  │  Runtime     │  │  Runtime     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         │  P2P Gossip     │                 │                   │
│         └─────────────────┴─────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
         │                 │                 │
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              IPFS Cluster 私有网络                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │IPFS Cluster 1│  │IPFS Cluster 2│  │IPFS Cluster 3│          │
│  │              │  │              │  │              │          │
│  │┌────────────┐│  │┌────────────┐│  │┌────────────┐│          │
│  ││ IPFS       ││  ││ IPFS       ││  ││ IPFS       ││          │
│  ││ Daemon     ││  ││ Daemon     ││  ││ Daemon     ││          │
│  │└────────────┘│  │└────────────┘│  │└────────────┘│          │
│  │              │  │              │  │              │          │
│  │┌────────────┐│  │┌────────────┐│  │┌────────────┐│          │
│  ││ Cluster    ││  ││ Cluster    ││  ││ Cluster    ││          │
│  ││ Service    ││  ││ Service    ││  ││ Service    ││          │
│  │└────────────┘│  │└────────────┘│  │└────────────┘│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         │  Cluster Protocol (Raft Consensus)                    │
│         └─────────────────┴─────────────────┘                   │
│                                                                  │
│         └────────── Cluster Secret 认证 ──────────┘             │
└─────────────────────────────────────────────────────────────────┘
         │                 │                 │
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ Storage │       │ Storage │       │ Storage │
    │  10TB   │       │  10TB   │       │  10TB   │
    └─────────┘       └─────────┘       └─────────┘
```

---

## 🔧 节点类型和角色

### 节点类型定义

| 节点类型 | Substrate | IPFS Daemon | IPFS Cluster | 数量 | 说明 |
|---------|-----------|-------------|--------------|------|------|
| **验证者+存储节点** | ✅ 完整同步<br>✅ 出块验证 | ✅ 运行 | ✅ 运行 | 3-5 | Layer 1核心节点<br>项目方运行 |
| **专用存储节点** | ⚠️ 轻同步<br>❌ 不参与共识 | ✅ 运行 | ✅ 运行 | 2-3 | Layer 1专用存储<br>项目方运行 |
| **社区存储节点** | ⚠️ 轻同步 | ✅ 运行 | ✅ 运行 | N个 | Layer 2社区节点<br>社区运营者 |
| **普通全节点** | ✅ 完整同步<br>❌ 不出块 | ❌ 不运行 | ❌ 不运行 | N个 | RPC服务节点 |

---

## 📦 部署架构方案

### 方案1：验证者+存储一体化（推荐用于MVP）

**适用场景**：
- MVP阶段
- 节点数量少（3-5个）
- 简化部署和管理

**架构**：
```
服务器1：
├─ Substrate验证者节点（端口：30333, 9944, 9933）
├─ IPFS Daemon（端口：4001, 5001, 8080）
└─ IPFS Cluster Service（端口：9094, 9095, 9096）

服务器2：
├─ Substrate验证者节点
├─ IPFS Daemon
└─ IPFS Cluster Service

服务器3：
├─ Substrate验证者节点
├─ IPFS Daemon
└─ IPFS Cluster Service
```

**优势**：
- ✅ 部署简单，管理统一
- ✅ 减少服务器数量
- ✅ 降低网络延迟

**劣势**：
- ⚠️ 存储和共识竞争资源
- ⚠️ 单点故障影响更大

---

### 方案2：分离式部署（推荐用于生产）

**适用场景**：
- 生产环境
- 高可用性要求
- 资源充足

**架构**：
```
验证者集群（3-5台）：
├─ 仅运行Substrate验证者
└─ 专注于共识和出块

IPFS存储集群（3-5台）：
├─ 轻量级Substrate同步（仅同步必要数据）
├─ IPFS Daemon
└─ IPFS Cluster Service
```

**优势**：
- ✅ 资源隔离，性能最优
- ✅ 故障隔离，可用性高
- ✅ 存储扩展灵活

**劣势**：
- ⚠️ 需要更多服务器
- ⚠️ 管理复杂度增加

---

### 方案3：混合部署（推荐用于成长期）

**架构**：
```
Layer 1（项目方）：
├─ 3个验证者+存储一体化节点
└─ 2个专用IPFS存储节点

Layer 2（社区）：
└─ N个社区IPFS存储节点
```

**优势**：
- ✅ 平衡成本和性能
- ✅ 灵活扩展
- ✅ 渐进式去中心化

---

## 🚀 详细部署步骤

### 阶段1：环境准备

#### 1.1 系统要求

**硬件配置**（每台服务器）：

| 角色 | CPU | RAM | 存储 | 网络 |
|------|-----|-----|------|------|
| **验证者+存储** | 8核+ | 32GB+ | 500GB SSD + 10TB HDD | 1Gbps+ |
| **专用存储** | 4核+ | 16GB+ | 100GB SSD + 10TB HDD | 1Gbps+ |
| **社区存储** | 4核+ | 8GB+ | 50GB SSD + 5TB HDD | 100Mbps+ |

**操作系统**：
- Ubuntu 22.04 LTS（推荐）
- 或其他Linux发行版

#### 1.2 安装依赖

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git build-essential jq

# 安装Docker（可选，用于容器化部署）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装Go（IPFS Cluster需要）
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

---

### 阶段2：安装IPFS和IPFS Cluster

#### 2.1 安装IPFS Daemon

```bash
# 下载IPFS Kubo（官方IPFS实现）
wget https://dist.ipfs.tech/kubo/v0.25.0/kubo_v0.25.0_linux-amd64.tar.gz
tar -xvzf kubo_v0.25.0_linux-amd64.tar.gz
cd kubo
sudo bash install.sh

# 验证安装
ipfs version
# 输出：ipfs version 0.25.0
```

#### 2.2 安装IPFS Cluster

```bash
# 下载IPFS Cluster
wget https://dist.ipfs.tech/ipfs-cluster-service/v1.0.6/ipfs-cluster-service_v1.0.6_linux-amd64.tar.gz
tar -xvzf ipfs-cluster-service_v1.0.6_linux-amd64.tar.gz
sudo mv ipfs-cluster-service/ipfs-cluster-service /usr/local/bin/
sudo mv ipfs-cluster-service/ipfs-cluster-follow /usr/local/bin/

# 验证安装
ipfs-cluster-service version
# 输出：ipfs-cluster-service version 1.0.6
```

---

### 阶段3：配置私有IPFS网络

#### 3.1 生成Swarm Key（仅在第一个节点执行）

```bash
# 生成私有网络的Swarm Key
mkdir -p ~/stardust-ipfs-cluster
cd ~/stardust-ipfs-cluster

# 生成密钥
go install github.com/Kubuxu/go-ipfs-swarm-key-gen/ipfs-swarm-key-gen@latest
~/go/bin/ipfs-swarm-key-gen > swarm.key

# 显示密钥（需要分发给其他节点）
cat swarm.key
```

**输出示例**：
```
/key/swarm/psk/1.0.0/
/base16/
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

⚠️ **重要**：将此 `swarm.key` 安全地分发给所有其他节点！

#### 3.2 初始化IPFS（所有节点）

```bash
# 初始化IPFS仓库
export IPFS_PATH=~/stardust-ipfs-cluster/.ipfs
ipfs init --profile=server

# 复制swarm.key到IPFS目录
cp ~/stardust-ipfs-cluster/swarm.key $IPFS_PATH/

# 配置IPFS（私有网络）
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST", "PUT"]'

# 禁用公共IPFS网络的引导节点（重要！确保私有网络）
ipfs bootstrap rm all

# 配置监听地址
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

# 配置Swarm地址
ipfs config --json Addresses.Swarm '[
  "/ip4/0.0.0.0/tcp/4001",
  "/ip6/::/tcp/4001"
]'

# 设置存储配置
ipfs config Datastore.StorageMax 10TB
```

#### 3.3 配置引导节点（所有节点）

**在第一个节点（节点1）获取PeerID**：
```bash
ipfs id
# 输出：
# {
#   "ID": "12D3KooWABC...",
#   "PublicKey": "...",
#   "Addresses": [...]
# }
```

**在其他节点（节点2、3...）添加引导节点**：
```bash
# 添加节点1作为引导节点
# 格式：/ip4/<节点1的IP>/tcp/4001/p2p/<节点1的PeerID>
ipfs bootstrap add /ip4/10.0.1.1/tcp/4001/p2p/12D3KooWABC...

# 也可以添加多个引导节点
ipfs bootstrap add /ip4/10.0.1.2/tcp/4001/p2p/12D3KooWXYZ...
```

---

### 阶段4：配置IPFS Cluster

#### 4.1 生成Cluster Secret（仅在第一个节点执行）

```bash
# 生成32字节的随机密钥
od -vN 32 -An -tx1 /dev/urandom | tr -d ' \n' > ~/stardust-ipfs-cluster/cluster-secret
cat ~/stardust-ipfs-cluster/cluster-secret
```

⚠️ **重要**：将此密钥安全地分发给所有其他节点！

#### 4.2 初始化Cluster（所有节点）

```bash
# 设置环境变量
export CLUSTER_PATH=~/stardust-ipfs-cluster/.ipfs-cluster
export CLUSTER_SECRET=$(cat ~/stardust-ipfs-cluster/cluster-secret)

# 初始化Cluster
ipfs-cluster-service init

# 配置Cluster
```

#### 4.3 配置Cluster服务（所有节点）

编辑 `$CLUSTER_PATH/service.json`：

```json
{
  "cluster": {
    "secret": "从cluster-secret文件读取的密钥",
    "leave_on_shutdown": false,
    "listen_multiaddress": [
      "/ip4/0.0.0.0/tcp/9096",
      "/ip4/0.0.0.0/udp/9096/quic"
    ],
    "enable_relay_hop": false,
    "connection_manager": {
      "high_water": 400,
      "low_water": 100,
      "grace_period": "2m0s"
    },
    "dial_peer_timeout": "10s",
    "state_sync_interval": "10m0s",
    "ipfs_sync_interval": "2m10s",
    "replication_factor_min": 3,
    "replication_factor_max": 5,
    "monitor_ping_interval": "15s",
    "peer_watch_interval": "5s",
    "mdns_interval": "10s",
    "pin_recover_interval": "1h0m0s",
    "disable_repinning": false
  },
  "consensus": {
    "crdt": {
      "cluster_name": "stardust-ipfs-cluster",
      "trusted_peers": [
        "*"
      ],
      "batching": {
        "max_batch_size": 0,
        "max_batch_age": "0s",
        "max_queue_size": 50000
      },
      "repair_interval": "1h0m0s"
    }
  },
  "api": {
    "ipfsproxy": {
      "listen_multiaddress": "/ip4/127.0.0.1/tcp/9095",
      "node_multiaddress": "/ip4/127.0.0.1/tcp/5001",
      "read_timeout": "0s",
      "read_header_timeout": "5s",
      "write_timeout": "0s",
      "idle_timeout": "1m0s"
    },
    "restapi": {
      "http_listen_multiaddress": "/ip4/0.0.0.0/tcp/9094",
      "read_timeout": "0s",
      "read_header_timeout": "5s",
      "write_timeout": "0s",
      "idle_timeout": "2m0s",
      "max_header_bytes": 4096,
      "basic_auth_credentials": null,
      "http_log_file": "",
      "headers": {},
      "cors_allowed_origins": ["*"],
      "cors_allowed_methods": ["GET", "POST"],
      "cors_allowed_headers": [],
      "cors_exposed_headers": ["Content-Type", "X-Stream-Output", "X-Chunked-Output", "X-Content-Length"],
      "cors_allow_credentials": true,
      "cors_max_age": "0s"
    }
  },
  "ipfs_connector": {
    "ipfshttp": {
      "node_multiaddress": "/ip4/127.0.0.1/tcp/5001",
      "connect_swarms_delay": "30s",
      "ipfs_request_timeout": "5m0s",
      "pin_timeout": "2m0s",
      "unpin_timeout": "3h0m0s",
      "repogc_timeout": "24h0m0s",
      "informer_trigger_interval": 0
    }
  },
  "pin_tracker": {
    "stateless": {
      "concurrent_pins": 10,
      "priority_pin_max_age": "24h0m0s",
      "priority_pin_max_retries": 5
    }
  },
  "monitor": {
    "pubsubmon": {
      "check_interval": "15s",
      "failure_threshold": 3
    }
  },
  "informer": {
    "disk": {
      "metric_ttl": "30s",
      "metric_type": "freespace"
    },
    "pinqueue": {
      "metric_ttl": "30s",
      "weight_bucket_size": 100000
    }
  },
  "observations": {
    "metrics": {
      "enable_stats": false,
      "prometheus_endpoint": "/ip4/0.0.0.0/tcp/8888",
      "reporting_interval": "2s"
    },
    "tracing": {
      "enable_tracing": false,
      "jaeger_agent_endpoint": "/ip4/0.0.0.0/udp/6831",
      "sampling_prob": 0.3,
      "service_name": "cluster-daemon"
    }
  },
  "datastore": {
    "badger": {
      "badger_options": {
        "max_levels": 7,
        "max_table_size": 8388608,
        "level_size_multiplier": 10,
        "value_log_max_entries": 1000000
      }
    }
  }
}
```

**关键配置说明**：
- `replication_factor_min: 3`：最少3副本
- `replication_factor_max: 5`：最多5副本
- `cluster_name: "stardust-ipfs-cluster"`：集群名称
- `pin_recover_interval: "1h0m0s"`：每小时检查一次Pin恢复

---

### 阶段5：启动服务

#### 5.1 创建systemd服务文件

**IPFS Daemon服务** (`/etc/systemd/system/ipfs.service`)：

```ini
[Unit]
Description=IPFS Daemon
After=network.target

[Service]
Type=simple
User=stardust
Environment="IPFS_PATH=/home/stardust/stardust-ipfs-cluster/.ipfs"
ExecStart=/usr/local/bin/ipfs daemon
Restart=on-failure
RestartSec=10s
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

**IPFS Cluster服务** (`/etc/systemd/system/ipfs-cluster.service`)：

```ini
[Unit]
Description=IPFS Cluster Service
Requires=ipfs.service
After=ipfs.service

[Service]
Type=simple
User=stardust
Environment="CLUSTER_PATH=/home/stardust/stardust-ipfs-cluster/.ipfs-cluster"
Environment="CLUSTER_SECRET=你的cluster-secret"
ExecStart=/usr/local/bin/ipfs-cluster-service daemon
Restart=on-failure
RestartSec=10s
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

#### 5.2 启动服务

```bash
# 重新加载systemd
sudo systemctl daemon-reload

# 启动IPFS
sudo systemctl start ipfs
sudo systemctl enable ipfs

# 等待IPFS启动（约10秒）
sleep 10

# 启动IPFS Cluster
sudo systemctl start ipfs-cluster
sudo systemctl enable ipfs-cluster

# 检查状态
sudo systemctl status ipfs
sudo systemctl status ipfs-cluster
```

#### 5.3 验证集群状态

```bash
# 查看Cluster成员
ipfs-cluster-ctl peers ls

# 查看Cluster状态
ipfs-cluster-ctl status

# 查看IPFS连接
ipfs swarm peers
```

**预期输出**：
```
# ipfs-cluster-ctl peers ls
12D3KooWABC... | node1 | Sees 2 other peers
12D3KooWXYZ... | node2 | Sees 2 other peers
12D3KooWDEF... | node3 | Sees 2 other peers
```

---

### 阶段6：与Substrate节点集成

#### 6.1 配置Substrate节点的OCW

在 `node/src/service.rs` 中配置OCW的HTTP客户端：

```rust
// 配置OCW HTTP Client连接到本地IPFS Cluster
use sc_offchain::OffchainWorkerOptions;

let offchain_worker_options = OffchainWorkerOptions {
    enable_http_requests: true,
    http_max_request_size: 10 * 1024 * 1024, // 10MB
    http_max_response_size: 100 * 1024 * 1024, // 100MB
    ..Default::default()
};

// 在spawn_tasks中启用OCW
sc_service::spawn_tasks(sc_service::SpawnTasksParams {
    offchain_worker: Some(offchain_worker_options),
    ..params
})?;
```

#### 6.2 配置IPFS Cluster API端点

在 `pallets/stardust-ipfs/src/lib.rs` 中：

```rust
// OCW中的IPFS Cluster API端点
const IPFS_CLUSTER_API: &str = "http://127.0.0.1:9094";

impl<T: Config> Pallet<T> {
    fn ipfs_cluster_pin(cid: &[u8], replication: u32) -> Result<(), &'static str> {
        // 构建Pin请求
        let url = format!("{}/pins/{}", IPFS_CLUSTER_API, 
            String::from_utf8_lossy(cid));
        
        // 设置replication参数
        let body = serde_json::json!({
            "replication_factor_min": replication,
            "replication_factor_max": replication,
            "name": "stardust-pin",
        });
        
        // 发送HTTP POST请求
        let request = http::Request::post(&url, vec![body.to_string().as_bytes()])
            .add_header("Content-Type", "application/json");
        
        // ... OCW HTTP请求逻辑
    }
}
```

---

## 🔒 安全配置

### 1. 网络隔离

**防火墙规则**（使用ufw）：

```bash
# 允许Substrate P2P（30333）
sudo ufw allow 30333/tcp

# 允许Substrate RPC（仅内网，9944/9933）
sudo ufw allow from 10.0.0.0/8 to any port 9944 proto tcp
sudo ufw allow from 10.0.0.0/8 to any port 9933 proto tcp

# 允许IPFS Swarm（4001，仅集群节点）
sudo ufw allow from 10.0.1.1 to any port 4001 proto tcp
sudo ufw allow from 10.0.1.2 to any port 4001 proto tcp
sudo ufw allow from 10.0.1.3 to any port 4001 proto tcp

# 允许IPFS Cluster（9094/9095/9096，仅集群节点）
sudo ufw allow from 10.0.1.0/24 to any port 9094 proto tcp
sudo ufw allow from 10.0.1.0/24 to any port 9095 proto tcp
sudo ufw allow from 10.0.1.0/24 to any port 9096 proto tcp

# 拒绝IPFS API公网访问（5001）
sudo ufw deny 5001/tcp

# 拒绝IPFS Gateway公网访问（8080）
sudo ufw deny 8080/tcp

# 启用防火墙
sudo ufw enable
```

---

### 2. TLS加密（可选，用于生产）

**使用Nginx反向代理IPFS Cluster API**：

```nginx
# /etc/nginx/sites-available/ipfs-cluster
server {
    listen 443 ssl http2;
    server_name ipfs-cluster.stardust.internal;

    ssl_certificate /etc/ssl/certs/stardust.crt;
    ssl_certificate_key /etc/ssl/private/stardust.key;

    location / {
        proxy_pass http://127.0.0.1:9094;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 仅允许内网IP访问
        allow 10.0.0.0/8;
        deny all;
    }
}
```

---

### 3. 访问控制

**启用Cluster API Basic Auth**（编辑 `service.json`）：

```json
{
  "api": {
    "restapi": {
      "basic_auth_credentials": {
        "stardust": "$apr1$abc123..."  // 使用htpasswd生成
      }
    }
  }
}
```

生成密码：
```bash
# 安装htpasswd
sudo apt install apache2-utils

# 生成密码
htpasswd -n stardust
# 输入密码后，将输出复制到service.json
```

---

## 📊 监控和管理

### 1. Prometheus监控

**启用Prometheus指标**（编辑 `service.json`）：

```json
{
  "observations": {
    "metrics": {
      "enable_stats": true,
      "prometheus_endpoint": "/ip4/0.0.0.0/tcp/8888",
      "reporting_interval": "2s"
    }
  }
}
```

**Prometheus配置** (`/etc/prometheus/prometheus.yml`)：

```yaml
scrape_configs:
  - job_name: 'ipfs-cluster'
    static_configs:
      - targets:
        - '10.0.1.1:8888'
        - '10.0.1.2:8888'
        - '10.0.1.3:8888'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        regex: '([^:]+):.*'
        replacement: '$1'
```

---

### 2. 健康检查脚本

**`/usr/local/bin/ipfs-cluster-health-check.sh`**：

```bash
#!/bin/bash

# IPFS Cluster健康检查脚本

# 检查IPFS Daemon
if ! systemctl is-active --quiet ipfs; then
    echo "IPFS Daemon is down! Restarting..."
    sudo systemctl restart ipfs
    exit 1
fi

# 检查IPFS Cluster
if ! systemctl is-active --quiet ipfs-cluster; then
    echo "IPFS Cluster is down! Restarting..."
    sudo systemctl restart ipfs-cluster
    exit 1
fi

# 检查Cluster Peers
PEERS=$(ipfs-cluster-ctl peers ls | wc -l)
if [ "$PEERS" -lt 3 ]; then
    echo "WARNING: Only $PEERS peers connected (expected 3+)"
    exit 1
fi

# 检查IPFS Swarm Peers
SWARM_PEERS=$(ipfs swarm peers | wc -l)
if [ "$SWARM_PEERS" -lt 2 ]; then
    echo "WARNING: Only $SWARM_PEERS IPFS peers connected (expected 2+)"
    exit 1
fi

echo "All checks passed. Cluster: $PEERS peers, IPFS: $SWARM_PEERS peers"
exit 0
```

**设置定时任务**：
```bash
# 每5分钟运行一次
echo "*/5 * * * * /usr/local/bin/ipfs-cluster-health-check.sh >> /var/log/ipfs-cluster-health.log 2>&1" | sudo crontab -
```

---

### 3. 管理命令速查

```bash
# 查看Cluster状态
ipfs-cluster-ctl status

# 查看所有Pin
ipfs-cluster-ctl pin ls

# 手动Pin一个CID
ipfs-cluster-ctl pin add <CID> --replication-min 3 --replication-max 5

# 查看Cluster成员
ipfs-cluster-ctl peers ls

# 查看IPFS连接
ipfs swarm peers

# 查看IPFS仓库状态
ipfs repo stat

# 触发垃圾回收
ipfs repo gc

# 查看Cluster日志
sudo journalctl -u ipfs-cluster -f

# 查看IPFS日志
sudo journalctl -u ipfs -f
```

---

## 🚀 部署清单

### 前期准备

- [ ] 准备3-5台服务器
- [ ] 配置服务器操作系统（Ubuntu 22.04）
- [ ] 确保服务器之间网络互通
- [ ] 规划IP地址和端口

### 安装阶段

- [ ] 安装IPFS Kubo
- [ ] 安装IPFS Cluster
- [ ] 生成Swarm Key（节点1）
- [ ] 生成Cluster Secret（节点1）
- [ ] 分发密钥到所有节点

### 配置阶段

- [ ] 初始化IPFS（所有节点）
- [ ] 配置私有网络（复制swarm.key）
- [ ] 配置引导节点
- [ ] 初始化Cluster（所有节点）
- [ ] 配置Cluster服务

### 启动阶段

- [ ] 创建systemd服务文件
- [ ] 启动IPFS Daemon
- [ ] 启动IPFS Cluster
- [ ] 验证Cluster成员连接

### 集成阶段

- [ ] 配置Substrate OCW
- [ ] 测试Pin功能
- [ ] 验证副本复制

### 安全阶段

- [ ] 配置防火墙规则
- [ ] 启用TLS（可选）
- [ ] 配置访问控制

### 监控阶段

- [ ] 部署Prometheus监控
- [ ] 配置健康检查脚本
- [ ] 设置告警规则

---

## 📈 性能优化建议

### 1. IPFS配置优化

```bash
# 增加连接数上限
ipfs config --json Swarm.ConnMgr.HighWater 400
ipfs config --json Swarm.ConnMgr.LowWater 100

# 增加datastore缓存
ipfs config --json Datastore.BloomFilterSize 1048576

# 启用文件存储加速
ipfs config --json Experimental.FilestoreEnabled true
```

### 2. 存储优化

- ✅ 使用SSD存储IPFS元数据（`.ipfs/blocks`）
- ✅ 使用HDD存储大文件（`.ipfs/datastore`）
- ✅ 定期运行 `ipfs repo gc` 清理无用数据

### 3. 网络优化

- ✅ 使用专用内网连接Cluster节点
- ✅ 配置QoS优先级保证Cluster通信
- ✅ 使用QUIC协议加速传输

---

## 🎓 总结

### 核心要点

✅ **私有网络**：使用Swarm Key和Cluster Secret确保私有性  
✅ **高可用**：3-5个节点，3-5副本冗余  
✅ **自动恢复**：Cluster自动检测和修复失败的Pin  
✅ **安全隔离**：防火墙规则限制公网访问  
✅ **监控完善**：Prometheus + 健康检查脚本  

### 部署顺序

```
1. MVP阶段：   3个验证者+存储一体化节点
2. 生产阶段：   5个验证者 + 3-5个专用存储节点
3. 成熟阶段：   5个验证者 + 5个专用存储 + N个社区节点
```

### 关键配置

- `swarm.key`：确保私有IPFS网络
- `cluster-secret`：确保Cluster安全
- `replication_factor_min/max`：控制副本数
- 防火墙规则：限制公网访问

---

<div align="center">

**🎉 IPFS Cluster部署方案完成！**

**私有网络** ✅ | **高可用** ✅ | **自动恢复** ✅

**安全隔离** ✅ | **监控完善** ✅ | **生产就绪** 🚀

</div>

