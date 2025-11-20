# IPFS节点分工与Pin机制 - 架构详解

## 🎯 核心问题

**在运行stardust的每个节点，都要记录PIN，都要发起PIN吗？**

---

## 📊 答案：分工明确

### 简短回答

| 操作 | 普通节点 | 验证者节点 | 运营者节点 |
|-----|---------|-----------|-----------|
| **记录Pin状态（链上）** | ✅ 是 | ✅ 是 | ✅ 是 |
| **发起Pin（IPFS实际存储）** | ❌ 否 | ❌ 否 | ✅ 是 |

---

## 🏗️ Substrate节点架构

### 1. 节点类型划分

```
Stardust网络节点分类：

┌─────────────────────────────────────────┐
│  1. 普通全节点 (Full Node)               │
│  - 同步链上数据                          │
│  - 不参与共识                            │
│  - 不存储IPFS内容                        │
│  角色：用户钱包、dApp后端、RPC服务        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  2. 验证者节点 (Validator)               │
│  - 同步链上数据                          │
│  - 参与共识（出块、验证）                 │
│  - 不存储IPFS内容                        │
│  角色：网络安全、共识维护                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  3. 运营者节点 (Operator Node) ⭐        │
│  - 同步链上数据                          │
│  - 不参与共识（可选）                    │
│  - 存储IPFS内容（实际Pin）               │
│  角色：IPFS存储服务提供商                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  4. 归档节点 (Archive Node)              │
│  - 存储所有历史状态                      │
│  - 提供历史查询                          │
│  - 不存储IPFS内容                        │
│  角色：区块浏览器、数据分析              │
└─────────────────────────────────────────┘
```

---

## 🔍 "记录PIN"的含义

### 链上状态 vs IPFS实际存储

```rust
// 1. 链上状态存储（所有节点都同步）
#[pallet::storage]
pub type PendingPins<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    (T::AccountId, u32, u64, u64, T::Balance),
    OptionQuery,
>;

#[pallet::storage]
pub type PinMeta<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    PinMetadata<BlockNumberFor<T>>,
    OptionQuery,
>;
```

**所有节点都会同步这些Storage**：
- ✅ 普通全节点：读取并存储到本地数据库
- ✅ 验证者节点：读取并存储到本地数据库
- ✅ 运营者节点：读取并存储到本地数据库
- ✅ 归档节点：读取并存储到本地数据库（包含历史）

**这就是"记录PIN"**：所有节点都知道哪些CID需要被pin，但不意味着都要执行pin。

---

### IPFS实际存储（仅运营者节点）

```bash
# IPFS实际pin操作（仅运营者节点执行）
ipfs pin add <CID>

# 效果：
# 1. CID内容下载到本地IPFS仓库
# 2. 内容被标记为"pinned"
# 3. 不会被垃圾回收删除
# 4. 占用本地存储空间
```

**仅运营者节点执行**：
- ❌ 普通全节点：不执行
- ❌ 验证者节点：不执行
- ✅ 运营者节点：执行 ⭐
- ❌ 归档节点：不执行

---

## 🔄 Pin流程详解

### 完整流程图

```
用户发起pin请求
     ↓
┌─────────────────────────────────────────────┐
│ 1. 链上交易（所有节点处理）                  │
├─────────────────────────────────────────────┤
│ request_pin_for_deceased(cid, replicas=3)   │
│  ↓                                          │
│ 写入PendingPins storage                     │
│ 写入PinMeta storage                         │
│ 事件: PinRequested(cid, requester)          │
└─────────────────────────────────────────────┘
     ↓
所有节点同步状态：
├─ 普通节点：同步storage ✅
├─ 验证者节点：同步storage ✅
├─ 运营者节点：同步storage ✅
└─ 归档节点：同步storage ✅

     ↓
┌─────────────────────────────────────────────┐
│ 2. OCW处理（仅运营者节点）                    │
├─────────────────────────────────────────────┤
│ offchain_worker() {                         │
│   // 读取PendingPins                        │
│   if let Some((cid, data)) = PendingPins::iter().next() { │
│     // 选择运营者                            │
│     let operators = select_operators(3);    │
│                                             │
│     // 仅被选中的运营者执行pin               │
│     if operators.contains(my_account) {     │
│       // 发送HTTP请求到ipfs-cluster         │
│       POST /pins { cid, allocations }       │
│     }                                       │
│   }                                         │
│ }                                           │
└─────────────────────────────────────────────┘
     ↓
仅运营者节点执行：
├─ 普通节点：不执行 ❌
├─ 验证者节点：不执行 ❌
├─ 运营者节点：执行HTTP调用 ✅
└─ 归档节点：不执行 ❌

     ↓
┌─────────────────────────────────────────────┐
│ 3. IPFS Cluster执行实际Pin                   │
├─────────────────────────────────────────────┤
│ IPFS Cluster (运营者1):                     │
│  ipfs pin add <CID>                         │
│  → 下载内容到本地                            │
│  → 标记为pinned                             │
│  → 占用存储空间                             │
│                                             │
│ IPFS Cluster (运营者2):                     │
│  ipfs pin add <CID>                         │
│  → 同上                                     │
│                                             │
│ IPFS Cluster (运营者3):                     │
│  ipfs pin add <CID>                         │
│  → 同上                                     │
└─────────────────────────────────────────────┘

     ↓
┌─────────────────────────────────────────────┐
│ 4. 上报完成状态（运营者→链上）               │
├─────────────────────────────────────────────┤
│ mark_pinned(cid) 由运营者提交                │
│  ↓                                          │
│ 更新PinStateOf = Pinned                     │
│ 清除PendingPins                             │
│ 事件: PinStateChanged(cid, Pinned)          │
└─────────────────────────────────────────────┘

     ↓
所有节点再次同步状态：
├─ 普通节点：同步storage ✅
├─ 验证者节点：同步storage ✅
├─ 运营者节点：同步storage ✅
└─ 归档节点：同步storage ✅
```

---

## 🎯 关键理解

### 1. 链上状态 vs 链下存储

| 层面 | 存储位置 | 同步范围 | 数据内容 |
|-----|---------|---------|---------|
| **链上状态** | Substrate数据库 | 所有节点 | Pin元数据（CID、副本数、状态） |
| **链下存储** | IPFS仓库 | 仅运营者节点 | 实际文件内容（图片、视频等） |

#### 示例

```rust
// 链上状态（所有节点同步）
PinMeta: {
    cid_hash: 0x1234...,
    replicas: 3,
    size: 1_073_741_824,  // 1GB
    created_at: 12345,
    last_activity: 12345,
}

// 链下存储（仅运营者节点）
// 运营者1的IPFS仓库：
~/.ipfs/blocks/12/1234567890abcdef... (1GB实际文件)

// 运营者2的IPFS仓库：
~/.ipfs/blocks/12/1234567890abcdef... (1GB实际文件)

// 运营者3的IPFS仓库：
~/.ipfs/blocks/12/1234567890abcdef... (1GB实际文件)

// 普通节点：无IPFS存储 ❌
// 验证者节点：无IPFS存储 ❌
```

---

### 2. OCW执行条件

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn offchain_worker(_n: BlockNumberFor<T>) {
        // ⚠️ 所有节点都会运行这段代码！
        // 但内部逻辑会判断：
        
        // 1. 检查本节点是否为运营者
        let my_account = get_my_account();
        
        if !Operators::<T>::contains_key(&my_account) {
            // 不是运营者，直接返回 ❌
            return;
        }
        
        // 2. 检查是否被选中
        if let Some(assignment) = PinAssignments::<T>::get(&cid_hash) {
            if !assignment.contains(&my_account) {
                // 未被选中，直接返回 ❌
                return;
            }
        }
        
        // 3. 仅被选中的运营者执行pin ✅
        execute_pin_request(&cid_hash);
    }
}
```

**执行逻辑**：
- 所有节点都运行OCW代码
- 但内部有判断逻辑
- 仅运营者节点且被选中的才执行实际pin

---

## 📈 资源消耗对比

### 10,000个CID，平均1GB/CID，3副本

| 节点类型 | 链上存储 | IPFS存储 | 带宽消耗 | 角色 |
|---------|---------|---------|---------|------|
| **普通全节点** | ~500MB | 0 | 仅同步区块 | RPC服务 |
| **验证者节点** | ~500MB | 0 | 同步区块+共识 | 网络安全 |
| **运营者节点** | ~500MB | **10TB** | 同步+Pin | **存储服务** ⭐ |
| **归档节点** | ~10GB | 0 | 同步所有历史 | 数据分析 |

**关键差异**：
- 链上存储：所有节点相同（~500MB）
- IPFS存储：仅运营者节点（10TB per operator）

---

## 🔧 运营者节点配置

### 1. 注册为运营者

```rust
// 链上注册
MemoIpfs::register_operator(
    origin,
    peer_id: Vec<u8>,      // IPFS节点peer_id
    capacity_gib: 10_000,  // 10TB
    endpoint_url: Vec<u8>, // http://operator1.example.com:9094
    bond: 1000 DUST,       // 保证金
);
```

### 2. 配置IPFS Cluster

```bash
# 运营者节点需要运行IPFS Cluster
docker-compose.yml:
  ipfs-cluster:
    image: ipfs/ipfs-cluster:latest
    volumes:
      - ./ipfs-cluster:/data/ipfs-cluster
    ports:
      - "9094:9094"  # API端口
      - "9096:9096"  # Proxy端口
```

### 3. 配置OCW

```bash
# 设置offchain storage（运营者节点）
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "offchain_localStorageSet",
    "params": [
      "PERSISTENT",
      "0x2f6d656d6f2f697066732f636c75737465725f656e64706f696e74",
      "0x687474703a2f2f6c6f63616c686f73743a39303934"
    ],
    "id": 1
  }'
```

### 4. 普通节点不需要

```bash
# 普通全节点启动（无需IPFS）
./stardust-node \
  --chain dev \
  --name "MyNode" \
  --rpc-port 9944

# 验证者节点启动（无需IPFS）
./stardust-node \
  --chain dev \
  --validator \
  --name "Validator1"

# 运营者节点启动（需要IPFS）⭐
./stardust-node \
  --chain dev \
  --name "Operator1" \
  --offchain-worker always  # 启用OCW
  # + IPFS Cluster运行在后台
```

---

## 🎯 实际案例

### 场景：网络中有10个节点

```
节点分布：
├─ 3个验证者节点（参与共识）
├─ 5个运营者节点（存储IPFS）⭐
└─ 2个普通全节点（RPC服务）

用户发起pin请求（3副本）：
1. 交易广播到所有10个节点 ✅
2. 所有10个节点写入PendingPins ✅
3. OCW在所有10个节点运行 ✅
4. 但仅5个运营者节点判断自己为运营者 ⚠️
5. 链上算法选择其中3个运营者 ⭐
6. 仅被选中的3个运营者执行实际pin ✅

最终结果：
├─ 10个节点都有链上状态
├─ 3个运营者节点有IPFS实际存储
└─ 7个节点无IPFS存储
```

---

## 📊 数据流向图

```
┌──────────────────────────────────────────────────┐
│              Stardust Blockchain                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Storage (所有节点同步)                     │  │
│  │  ├─ PendingPins                            │  │
│  │  ├─ PinMeta                                │  │
│  │  ├─ PinStateOf                             │  │
│  │  └─ PinAssignments                         │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
           ↓ 同步到所有节点
    ┌──────┴──────────┬──────────┬──────────┐
    ↓                 ↓          ↓          ↓
┌─────────┐   ┌─────────┐  ┌─────────┐  ┌─────────┐
│普通节点 │   │验证者   │  │运营者1  │  │运营者2  │
│Storage ✅│   │Storage ✅│  │Storage ✅│  │Storage ✅│
│IPFS ❌  │   │IPFS ❌  │  │IPFS ✅  │  │IPFS ✅  │
└─────────┘   └─────────┘  └─────────┘  └─────────┘
                                ↓            ↓
                          ┌─────────┐  ┌─────────┐
                          │ IPFS    │  │ IPFS    │
                          │ Cluster │  │ Cluster │
                          │ 10TB    │  │ 10TB    │
                          └─────────┘  └─────────┘
```

---

## ✅ 总结

### Q1: 每个节点都要记录PIN吗？

**答案：✅ 是（链上状态）**

- 所有节点都同步PinMeta、PendingPins等storage
- 这是Substrate的设计：所有节点保持状态一致
- 但这只是"元数据"，不是实际文件内容

---

### Q2: 每个节点都要发起PIN吗？

**答案：❌ 否（仅运营者节点）**

- 仅注册的运营者节点才执行实际pin
- 普通节点、验证者节点不执行pin
- 运营者中也仅被选中的才执行（3副本只选3个）

---

### 关键理解

```
记录PIN（链上） ≠ 发起PIN（IPFS）

记录PIN = 同步链上storage（所有节点）
发起PIN = 执行实际IPFS pin（仅运营者节点）

类比：
- 记录 = 记账本（所有节点都有账本）
- 发起 = 实际转账（仅银行执行）
```

---

### 节点选择建议

| 你的角色 | 推荐节点类型 | IPFS要求 |
|---------|------------|---------|
| **普通用户** | 普通全节点 | ❌ 不需要 |
| **dApp开发者** | 普通全节点 | ❌ 不需要 |
| **验证者** | 验证者节点 | ❌ 不需要 |
| **存储服务商** | 运营者节点 | ✅ 需要 ⭐ |
| **数据分析** | 归档节点 | ❌ 不需要 |

---

### 运营者节点要求

如果你想成为运营者节点：
- ✅ 注册为运营者（on-chain）
- ✅ 质押保证金（1000+ DUST）
- ✅ 运行IPFS Cluster
- ✅ 提供存储容量（推荐10TB+）
- ✅ 稳定网络和电力
- ✅ 定期维护和监控

**不想存储IPFS内容？只需运行普通全节点或验证者节点！** 🚀

