# IPFS运营者管理机制 - 设计方案

> **创建时间**: 2025-10-26  
> **目标**: 定义普通节点与运营者的区别，设计升级与降级机制  
> **状态**: 设计方案 + 实施建议

---

## 🎯 **核心问题**

### 问题1：如何区别普通节点、运营者？

### 问题2：普通节点如何自己提升到运营者？

### 问题3：运营者如何让自己变成普通节点？

---

## 📊 **节点类型对比**

### 1. 节点类型定义

| 节点类型 | 英文名称 | 核心职责 | 硬件要求 | 收益来源 |
|---------|---------|----------|----------|----------|
| **普通全节点** | Full Node | 同步链状态<br>验证区块<br>提供RPC服务 | CPU: 4核<br>RAM: 8GB<br>存储: 100GB SSD | 无直接收益 |
| **验证者节点** | Validator | 生产区块<br>验证交易<br>参与共识 | CPU: 8核<br>RAM: 32GB<br>存储: 500GB SSD | 出块奖励<br>质押收益 |
| **IPFS运营者节点** | IPFS Operator | 存储IPFS内容<br>提供Pin服务<br>响应OCW请求 | CPU: 8核<br>RAM: 32GB<br>存储: 10TB HDD | 存储费用<br>Pin收益 |

### 2. 节点职责详解

#### 2.1 普通全节点（Full Node）

**职责**：
- ✅ 同步整条链的区块数据
- ✅ 验证所有交易和区块
- ✅ 提供RPC接口供前端访问
- ❌ **不存储IPFS内容**
- ❌ **不参与Pin分配**
- ❌ **不获得存储费用**

**运行命令**：
```bash
./stardust-node \
  --chain mainnet \
  --base-path /data/stardust \
  --rpc-port 9944 \
  --rpc-cors all
```

**特点**：
- 任何人都可以运行
- 无需注册
- 无需保证金
- 无硬件要求（除了基础同步需求）

---

#### 2.2 验证者节点（Validator）

**职责**：
- ✅ 同步链状态
- ✅ 生产区块（出块节点）
- ✅ 验证交易
- ✅ 参与共识（Aura/GRANDPA）
- ❌ **不一定存储IPFS内容**（除非同时是运营者）

**运行命令**：
```bash
./stardust-node \
  --chain mainnet \
  --validator \
  --base-path /data/stardust \
  --name "我的验证者" \
  --rpc-port 9944
```

**注册流程**：
```rust
// 1. 设置Session Keys
author.rotateKeys()  // 生成Session Keys

// 2. 提交Session Keys
session.setKeys(keys, proof)

// 3. 质押MEMO（如有质押要求）
staking.bond(controller, value, payee)
```

**特点**：
- 需要通过治理/质押成为验证者
- 获得出块奖励
- 高性能硬件要求

---

#### 2.3 IPFS运营者节点（IPFS Operator）⭐ 重点

**职责**：
- ✅ 同步链状态（作为全节点）
- ✅ 运行IPFS节点（ipfs daemon）
- ✅ 运行IPFS Cluster（ipfs-cluster-service）
- ✅ 存储被分配的CID内容
- ✅ 响应OCW的健康检查
- ✅ 参与Pin分配
- ✅ 获得存储费用

**运行命令**：
```bash
# 1. 启动Stardust节点
./stardust-node \
  --chain mainnet \
  --base-path /data/stardust \
  --rpc-port 9944 \
  --offchain-worker always  # ← 重要：启用OCW

# 2. 启动IPFS节点
ipfs daemon &

# 3. 启动IPFS Cluster
ipfs-cluster-service daemon &
```

**注册流程**（链上）：
```rust
// 调用pallet-stardust-ipfs的register_operator
memoIpfs.registerOperator(
  endpoint: "http://my-cluster.example.com:9094",  // IPFS Cluster API地址
  capacity: 10_000_000_000_000,  // 10TB容量（字节）
  bond: 1_000_000_000_000_000_000,  // 1000 MEMO保证金
)
```

**特点**：
- ✅ 需要链上注册
- ✅ 需要缴纳保证金
- ✅ 需要声明存储容量
- ✅ 需要提供IPFS Cluster API端点
- ✅ 获得存储费用收益

---

## 🔑 **核心区分机制**

### 1. 链上存储结构

#### 当前pallet-stardust-ipfs的存储项

```rust
/// 函数级详细中文注释：运营者信息存储
///
/// ### 数据结构
/// - Key: AccountId（运营者账户）
/// - Value: OperatorInfo（运营者详细信息）
///
/// ### OperatorInfo字段
/// - endpoint: IPFS Cluster API地址（例如：http://cluster.example.com:9094）
/// - capacity_gib: 声明的存储容量（GiB）
/// - registered_at: 注册时间（区块高度）
/// - is_active: 是否激活（true=可分配Pin，false=暂停）
#[pallet::storage]
pub type Operators<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    OperatorInfo<T>,
    OptionQuery,
>;

/// 运营者信息结构体
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct OperatorInfo<T: Config> {
    pub endpoint: BoundedVec<u8, T::MaxPeerIdLen>,  // IPFS Cluster API地址
    pub capacity_gib: u32,                          // 容量（GiB）
    pub registered_at: BlockNumberFor<T>,           // 注册时间
    pub is_active: bool,                            // 是否激活
}
```

**区分逻辑**：
```rust
/// 检查账户是否是运营者
fn is_operator(account: &T::AccountId) -> bool {
    Operators::<T>::contains_key(account)
}

/// 检查运营者是否激活
fn is_active_operator(account: &T::AccountId) -> bool {
    if let Some(info) = Operators::<T>::get(account) {
        info.is_active
    } else {
        false
    }
}
```

---

### 2. 三种节点状态

```
┌─────────────────────────────────────────────────────────────┐
│                    Stardust节点类型                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐                                            │
│  │ 普通全节点    │                                            │
│  │ Full Node    │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
│         │ register_operator() ✅                             │
│         │ + 缴纳保证金                                        │
│         │ + 提供endpoint                                     │
│         │ + 声明容量                                          │
│         ↓                                                     │
│  ┌──────────────┐                                            │
│  │ IPFS运营者   │ ←────────────────────┐                    │
│  │ Operator     │                       │                    │
│  │ (Active)     │  unregister_operator()│                    │
│  └──────┬───────┘  + 等待宽限期         │                    │
│         │          + 返还保证金          │                    │
│         │                                │                    │
│         │ pause_operator() ⏸️           │                    │
│         ↓                                │                    │
│  ┌──────────────┐                       │                    │
│  │ IPFS运营者   │                       │                    │
│  │ Operator     │  resume_operator() ▶️ │                    │
│  │ (Paused)     │ ──────────────────────┘                    │
│  └──────────────┘                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 **实施方案**

### 方案1：普通节点 → IPFS运营者（升级）

#### 1.1 前提条件

| 条件 | 要求 | 验证方式 |
|------|------|----------|
| 账户余额 | ≥1000 DUST | 检查free_balance |
| 硬件存储 | ≥1TB可用空间 | 用户自行声明 |
| IPFS环境 | 已安装ipfs + ipfs-cluster | 用户自行配置 |
| 网络条件 | 公网IP或域名 | 提供endpoint URL |

#### 1.2 升级流程

**步骤1：准备IPFS环境**

```bash
# 1. 安装IPFS
wget https://dist.ipfs.tech/kubo/v0.20.0/kubo_v0.20.0_linux-amd64.tar.gz
tar -xvzf kubo_v0.20.0_linux-amd64.tar.gz
cd kubo
sudo bash install.sh

# 2. 初始化IPFS
ipfs init

# 3. 配置IPFS（私有网络）
ipfs config --json Swarm.AddrFilters '["/ip4/10.0.0.0/ipcidr/8", "/ip4/172.16.0.0/ipcidr/12"]'

# 4. 启动IPFS
ipfs daemon &

# 5. 安装IPFS Cluster
wget https://dist.ipfs.tech/ipfs-cluster-service/v1.0.6/ipfs-cluster-service_v1.0.6_linux-amd64.tar.gz
tar -xvzf ipfs-cluster-service_v1.0.6_linux-amd64.tar.gz
cd ipfs-cluster-service
sudo bash install.sh

# 6. 初始化Cluster
ipfs-cluster-service init

# 7. 配置Cluster（加入Stardust集群）
# 编辑 ~/.ipfs-cluster/service.json
# 设置 cluster_secret, bootstrap等

# 8. 启动Cluster
ipfs-cluster-service daemon &
```

**步骤2：链上注册运营者**

**方式A：通过前端（推荐）**

```typescript
// 前端代码示例（stardust-dapp）
import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3FromAddress } from '@polkadot/extension-dapp';

async function registerAsOperator() {
  const api = await ApiPromise.create({
    provider: new WsProvider('wss://mainnet.stardust.io')
  });

  const endpoint = "http://my-cluster.example.com:9094";
  const capacityGib = 10000;  // 10TB = 10000 GiB
  const bond = 1000n * 10n**18n;  // 1000 DUST

  const injector = await web3FromAddress(account);
  
  const tx = api.tx.memoIpfs.registerOperator(
    endpoint,
    capacityGib,
    bond
  );

  await tx.signAndSend(account, { signer: injector.signer }, (result) => {
    if (result.status.isInBlock) {
      console.log('✅ 注册成功，交易已上链');
    }
  });
}
```

**方式B：通过Polkadot.js Apps**

1. 访问 https://polkadot.js.org/apps/?rpc=wss://mainnet.stardust.io
2. 导航到 **Developer → Extrinsics**
3. 选择 **memoIpfs → registerOperator**
4. 填写参数：
   - `endpoint`: "http://my-cluster.example.com:9094"
   - `capacity`: 10000000000000（10TB，字节）
   - 附加金额：1000 DUST（保证金）
5. 点击 **Submit Transaction**

**方式C：通过命令行**

```bash
# 使用substrate-api-cli
substrate-api-cli \
  --url wss://mainnet.stardust.io \
  pallet-stardust-ipfs register-operator \
  --endpoint "http://my-cluster.example.com:9094" \
  --capacity 10000000000000 \
  --bond 1000000000000000000000
```

**步骤3：验证注册结果**

```javascript
// 查询运营者信息
const operatorInfo = await api.query.memoIpfs.operators(accountId);

if (operatorInfo.isSome) {
  const info = operatorInfo.unwrap();
  console.log('✅ 您已是运营者');
  console.log('Endpoint:', info.endpoint.toUtf8());
  console.log('容量:', info.capacityGib.toString(), 'GiB');
  console.log('状态:', info.isActive ? '激活' : '暂停');
} else {
  console.log('❌ 您还不是运营者');
}
```

**步骤4：等待Pin分配**

```bash
# 监控IPFS Cluster日志
ipfs-cluster-service log tail

# 应该看到OCW发来的Pin请求
# 例如：
# 2025-10-26 15:00:00 INFO  Received pin request: QmTest123...
# 2025-10-26 15:00:05 INFO  Pin added successfully
```

#### 1.3 升级后的权益

| 权益 | 说明 |
|------|------|
| ✅ 参与Pin分配 | IPFS Cluster自动分配CID给您 |
| ✅ 获得存储费用 | 按分配的CID数量和大小获得收益 |
| ✅ 累计奖励 | 收益累计到OperatorRewards |
| ✅ 随时提现 | 调用operator_claim_rewards() |

#### 1.4 收益计算示例

**假设**：
- 您的容量：10TB
- 被分配的CID：500个
- 平均大小：1GB/CID
- 费率：30 DUST/GB/月
- 副本数：3（与其他2个运营者共享）

**月收益计算**：
```
总存储：500 CID × 1GB = 500 GB
总费用：500 GB × 30 DUST/GB/月 = 15,000 DUST/月
您的收益：15,000 / 3运营者 = 5,000 DUST/月
```

**年收益**：5,000 × 12 = **60,000 DUST/年**

---

### 方案2：IPFS运营者 → 普通节点（降级）

#### 2.1 降级原因

| 原因 | 说明 | 建议操作 |
|------|------|----------|
| 硬件不足 | 存储空间不够 | 暂停或退出 |
| 网络问题 | 带宽不足 | 暂停或退出 |
| 成本考虑 | 不想承担硬件成本 | 退出 |
| 临时维护 | 需要升级硬件 | 暂停（不退出） |

#### 2.2 降级方式

**方式A：暂停运营者（可恢复）⏸️**

```rust
// 调用pause_operator（保留运营者身份）
memoIpfs.pauseOperator()
```

**效果**：
- ✅ 保留运营者身份
- ✅ 保留保证金
- ❌ **停止分配新Pin**
- ✅ **已有Pin仍需维护**（直到迁移完成）
- ✅ 可随时调用resume_operator()恢复

**适用场景**：
- 短期维护（1-7天）
- 硬件升级
- 网络故障临时修复

---

**方式B：注销运营者（永久退出）❌**

```rust
// 调用unregister_operator（永久退出）
memoIpfs.unregisterOperator()
```

**流程**：
```
1. 提交unregister_operator()
   ↓
2. 进入宽限期（7天）
   ├─ 已分配的Pin迁移到其他运营者
   └─ OCW自动重新分配
   ↓
3. 宽限期结束
   ├─ 检查是否还有Pin
   ├─ 无Pin → 返还保证金
   └─ 有Pin → 延长宽限期
   ↓
4. 完全退出
   ├─ 保证金返还
   ├─ 从Operators存储中移除
   └─ 变为普通全节点
```

**关键点**：
- ⏰ 宽限期：7天（100,800块）
- 📦 Pin迁移：OCW自动处理
- 💰 保证金返还：宽限期结束后自动返还
- ⚠️ 不可逆：退出后需重新注册才能恢复

---

**方式C：被动降级（治理/Slash）**

**触发条件**：
- 连续健康检查失败≥10次
- 恶意删除Pin内容
- 长时间离线（>7天）
- 治理委员会投票Slash

**效果**：
- ❌ 强制标记为Inactive
- ❌ 停止分配新Pin
- ❌ 扣除保证金（部分或全部）
- ⚠️ 可能被永久禁止

---

## 📝 **完整接口设计**

### 1. 注册运营者

```rust
/// 函数级详细中文注释：注册为IPFS运营者
///
/// ### 参数
/// - origin: 签名账户（将成为运营者）
/// - endpoint: IPFS Cluster API地址（例如：http://cluster.example.com:9094）
/// - capacity: 声明的存储容量（字节）
///
/// ### 检查项
/// 1. 账户未注册过
/// 2. 保证金充足（从账户余额扣除）
/// 3. endpoint格式正确
/// 4. capacity > 0
///
/// ### 效果
/// - 扣除保证金（锁定到pallet账户）
/// - 记录到Operators存储
/// - 发送OperatorRegistered事件
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::register_operator())]
pub fn register_operator(
    origin: OriginFor<T>,
    endpoint: Vec<u8>,
    capacity: u64,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 检查是否已注册
    ensure!(!Operators::<T>::contains_key(&who), Error::<T>::AlreadyRegistered);

    // 检查保证金
    let bond = T::MinOperatorBond::get();
    ensure!(T::Currency::free_balance(&who) >= bond, Error::<T>::InsufficientBalance);

    // 扣除保证金
    T::Currency::transfer(
        &who,
        &Self::operator_bond_account(),
        bond,
        ExistenceRequirement::KeepAlive,
    )?;

    // 记录运营者
    let endpoint_bounded = BoundedVec::try_from(endpoint)
        .map_err(|_| Error::<T>::EndpointTooLong)?;
    
    let info = OperatorInfo {
        endpoint: endpoint_bounded,
        capacity_gib: (capacity / 1_000_000_000) as u32,
        registered_at: <frame_system::Pallet<T>>::block_number(),
        is_active: true,
    };
    
    Operators::<T>::insert(&who, info);

    // 发送事件
    Self::deposit_event(Event::OperatorRegistered {
        operator: who,
        endpoint: endpoint_bounded,
        capacity,
    });

    Ok(())
}
```

---

### 2. 暂停运营者

```rust
/// 函数级详细中文注释：暂停运营者（可恢复）
///
/// ### 参数
/// - origin: 签名账户（必须是已注册的运营者）
///
/// ### 效果
/// - 标记is_active = false
/// - 停止分配新Pin
/// - 已有Pin仍需维护
/// - 保留保证金
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::pause_operator())]
pub fn pause_operator(origin: OriginFor<T>) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 检查是否是运营者
    let mut info = Operators::<T>::get(&who)
        .ok_or(Error::<T>::NotOperator)?;

    // 检查是否已暂停
    ensure!(info.is_active, Error::<T>::AlreadyPaused);

    // 标记为暂停
    info.is_active = false;
    Operators::<T>::insert(&who, info);

    // 发送事件
    Self::deposit_event(Event::OperatorPaused { operator: who });

    Ok(())
}
```

---

### 3. 恢复运营者

```rust
/// 函数级详细中文注释：恢复运营者（从暂停状态）
///
/// ### 参数
/// - origin: 签名账户（必须是已暂停的运营者）
///
/// ### 效果
/// - 标记is_active = true
/// - 恢复分配新Pin
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::resume_operator())]
pub fn resume_operator(origin: OriginFor<T>) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 检查是否是运营者
    let mut info = Operators::<T>::get(&who)
        .ok_or(Error::<T>::NotOperator)?;

    // 检查是否已暂停
    ensure!(!info.is_active, Error::<T>::NotPaused);

    // 恢复激活
    info.is_active = true;
    Operators::<T>::insert(&who, info);

    // 发送事件
    Self::deposit_event(Event::OperatorResumed { operator: who });

    Ok(())
}
```

---

### 4. 注销运营者

```rust
/// 函数级详细中文注释：注销运营者（永久退出）
///
/// ### 参数
/// - origin: 签名账户（必须是已注册的运营者）
///
/// ### 流程
/// 1. 检查是否有未完成的Pin
/// 2. 如有Pin，进入宽限期（7天）
/// 3. OCW自动迁移Pin到其他运营者
/// 4. 宽限期结束，返还保证金
/// 5. 从Operators移除
///
/// ### 效果
/// - 标记is_active = false（立即）
/// - 进入宽限期（如有Pin）
/// - 返还保证金（宽限期后）
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::unregister_operator())]
pub fn unregister_operator(origin: OriginFor<T>) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 检查是否是运营者
    let info = Operators::<T>::get(&who)
        .ok_or(Error::<T>::NotOperator)?;

    // 检查是否有未完成的Pin
    let assigned_pins = Self::count_operator_pins(&who);
    
    if assigned_pins > 0 {
        // 进入宽限期
        let grace_period = T::OperatorGracePeriod::get();
        let expires_at = <frame_system::Pallet<T>>::block_number() + grace_period;
        
        PendingUnregistrations::<T>::insert(&who, expires_at);
        
        // 立即停止新Pin分配
        let mut updated_info = info;
        updated_info.is_active = false;
        Operators::<T>::insert(&who, updated_info);
        
        Self::deposit_event(Event::OperatorUnregistrationPending {
            operator: who,
            remaining_pins: assigned_pins,
            expires_at,
        });
    } else {
        // 无Pin，立即退出
        Self::finalize_operator_unregistration(&who)?;
    }

    Ok(())
}

/// 完成运营者注销（内部函数）
fn finalize_operator_unregistration(operator: &T::AccountId) -> DispatchResult {
    // 返还保证金
    let bond = T::MinOperatorBond::get();
    T::Currency::transfer(
        &Self::operator_bond_account(),
        operator,
        bond,
        ExistenceRequirement::AllowDeath,
    )?;

    // 移除运营者记录
    Operators::<T>::remove(operator);
    PendingUnregistrations::<T>::remove(operator);

    // 发送事件
    Self::deposit_event(Event::OperatorUnregistered {
        operator: operator.clone(),
    });

    Ok(())
}
```

---

## 🎯 **总结**

### 节点类型区分

| 维度 | 普通全节点 | 验证者节点 | IPFS运营者 |
|------|-----------|-----------|-----------|
| **链上注册** | ❌ 不需要 | ✅ 需要（质押） | ✅ 需要（保证金） |
| **存储检查** | `Operators::contains_key()` | `Validators::contains_key()` | `Operators::contains_key()` |
| **运行要求** | 基础 | 高性能 | IPFS环境 |
| **收益来源** | 无 | 出块奖励 | 存储费用 |

### 升级流程（普通 → 运营者）

```
1. 准备环境（IPFS + Cluster）
2. 调用register_operator()
3. 缴纳保证金
4. 等待Pin分配
5. 开始获得收益
```

### 降级流程（运营者 → 普通）

**临时暂停**：
```
1. 调用pause_operator()
2. 停止新Pin分配
3. 随时调用resume_operator()恢复
```

**永久退出**：
```
1. 调用unregister_operator()
2. 进入宽限期（7天）
3. OCW迁移Pin
4. 返还保证金
5. 变为普通节点
```

---

**文档创建时间**：2025-10-26  
**维护者**：Stardust开发团队  
**状态**：✅ 设计完成，待实施

