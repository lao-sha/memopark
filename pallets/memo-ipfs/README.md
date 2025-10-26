# pallet-memo-ipfs

## 💰 三重扣款机制（v3.0）

**核心特性**：初次 pin 请求使用三重扣款，优先使用公共费用池，其次逝者专属资金，最后调用者自费；周期扣款使用双重扣款

### 扣款优先级

#### 初次 Pin 请求（三重扣款）

```
request_pin_for_deceased(subject_id, ...)
    ↓
1️⃣ 优先从 IpfsPoolAccount 扣款（配额限制）
    ├─ 检查月度配额：100 MEMO/deceased
    ├─ 检查池余额是否充足
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
2️⃣ 从 SubjectFunding 扣款
    ├─ 派生账户：(creator, deceased_id)
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
3️⃣ 从调用者账户扣款（fallback，自费）
    ├─ 调用者账户：msg.sender
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
4️⃣ 返回 Error::AllThreeAccountsInsufficientBalance
```

#### 周期扣款（双重扣款）

```
charge_due() / on_initialize
    ↓
1️⃣ 优先从 IpfsPoolAccount 扣款（配额限制）
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
2️⃣ 从 SubjectFunding 扣款
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
3️⃣ 进入宽限期（Grace）或标记过期（Expired）
```

**注意**：周期扣款不使用调用者 fallback，因为没有调用者上下文

### 账户说明

| 账户 | PalletId/派生规则 | 用途 | 地址示例 |
|------|------------------|------|---------|
| **IpfsPoolAccount** | `py/ipfs+` | 公共费用池，由供奉路由分配 50% | `5Fm7k7uj...` |
| **SubjectFunding** | `SubjectPalletId + (domain, creator, deceased_id)` | 逝者专属资金，**任何人都可充值** | 派生地址（稳定） |
| **Caller** | msg.sender | 调用者账户，fallback 自费 | 用户地址 |
| **OperatorEscrowAccount** | `py/opesc` | 运营者托管，待 SLA 考核分配 | `5EYa...` |

### 配额规则

| 项目 | 配置值 | 说明 |
|------|--------|------|
| 月度配额 | 100 MEMO | 每个 deceased 每月的免费额度 |
| 重置周期 | 28 天 | 约 403,200 区块 |
| 计算方式 | 累计扣费 | 按实际扣费金额累计 |

### 使用示例

**示例 1：配额内使用（免费）**

```rust
// deceased_id = 1
// 本月已用配额：0 MEMO
// 本次费用：50 MEMO
// IpfsPoolAccount 余额：1000 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ✅ 从 IpfsPoolAccount 扣款 50 MEMO
// ✅ 转到 OperatorEscrowAccount
// 剩余配额：50 MEMO
```

**示例 2：超出配额，使用专属资金**

```rust
// deceased_id = 1
// 本月已用配额：95 MEMO
// 本次费用：50 MEMO
// 配额剩余：5 MEMO < 50 MEMO
// SubjectFunding 余额：100 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ❌ 配额不足
// ✅ 从 SubjectFunding 扣款 50 MEMO
// ✅ 转到 OperatorEscrowAccount
```

**示例 3：新用户，直接自费（友好）**

```rust
// IpfsPoolAccount 余额：0 MEMO（新链）
// SubjectFunding 余额：0 MEMO（未充值）
// Caller 余额：200 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ❌ IpfsPoolAccount 不足
// ❌ SubjectFunding 不足
// ✅ 从 Caller 扣款 50 MEMO（自费）
// ✅ 转到 OperatorEscrowAccount
// 💡 前端提示：建议充值到 SubjectFunding 享受配额优惠
```

**示例 4：三账户都不足（失败）**

```rust
// IpfsPoolAccount 余额：0 MEMO
// SubjectFunding 余额：0 MEMO
// Caller 余额：10 MEMO < 50 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ❌ Error::AllThreeAccountsInsufficientBalance
```

### 资金流向

```
供奉收入 → DecentralizedStorageAccount
    ↓（每 7 天分配 50%）
IpfsPoolAccount
    ↓（pin 服务扣款，配额限制）
OperatorEscrowAccount（托管）
    ↓（SLA 考核后分配）
运营者 A/B/C

或

用户充值 → SubjectFunding
    ↓（pin 服务扣款）
OperatorEscrowAccount（托管）
    ↓（SLA 考核后分配）
运营者 A/B/C

或

Caller（自费） → OperatorEscrowAccount（托管）
    ↓（SLA 考核后分配）
运营者 A/B/C
```

---

## 💳 SubjectFunding账户详解

### 派生方式

**派生公式**：
```rust
SubjectFunding = SubjectPalletId.into_sub_account_truncating(
    (DeceasedDomain, creator, deceased_id).encode()
)
```

**参数说明**：
- `SubjectPalletId`：`py/subj+`（PalletId常量）
- `DeceasedDomain`：`1`（逝者域编码）
- `creator`：创建者账户（**不可变**）
- `deceased_id`：逝者ID

**核心特性**：
- ✅ **地址稳定**：基于creator（创建时设置，永不改变）
- ✅ **支持转让**：owner可转让，不影响资金账户地址
- ✅ **资金隔离**：每个deceased有独立的资金账户
- ✅ **确定性派生**：相同输入总是产生相同输出

### 充值机制

#### fund_subject_account - 为逝者账户充值

**权限**：
- ✅ **任何账户都可以充值**（开放性）
- ✅ 无需owner权限
- ✅ 只需要deceased存在

**使用场景**：
1. **owner自己充值**（常规场景）
   ```rust
   fund_subject_account(deceased_id, 100 * UNIT)
   ```

2. **家人朋友赞助**（情感场景）
   ```rust
   // Bob为Alice创建的deceased充值
   fund_subject_account(1, 50 * UNIT)  // 情感支持
   ```

3. **社区众筹**（公益场景）
   ```rust
   // 多人为公益deceased众筹
   fund_subject_account(1, 10 * UNIT)  // 社区A
   fund_subject_account(1, 20 * UNIT)  // 社区B
   fund_subject_account(1, 30 * UNIT)  // 社区C
   // 总计：60 MEMO
   ```

4. **服务商预付费**（商业场景）
   ```rust
   // 服务商为客户充值
   fund_subject_account(deceased_id, 500 * UNIT)  // 预付费
   ```

5. **慈善捐赠**（慈善场景）
   ```rust
   // 慈善基金会为贫困家庭充值
   fund_subject_account(deceased_id, 1000 * UNIT)  // 慈善捐赠
   ```

**安全保障**：
- ✅ 资金只能用于IPFS pin
- ✅ 派生地址确定性，无法篡改
- ✅ 只检查deceased是否存在

### 权限控制

**充值权限**：
- ✅ 任何人都可以充值
- ✅ 无需owner权限

**使用权限**（pin操作）：
- ⚠️ **仅owner可以pin**
- ⚠️ 防止恶意消耗资金
- ⚠️ 保护deceased隐私

**示例**：
```rust
// 场景1：正常充值和使用
Alice创建deceased（creator=Alice, owner=Alice）
Bob充值100 MEMO  // ✅ 成功（任何人都可以充值）
Alice请求pin  // ✅ 成功（owner权限）
Bob请求pin  // ❌ Error::BadStatus（不是owner）

// 场景2：owner转让后的资金使用
Alice创建deceased（creator=Alice, owner=Alice）
Bob充值100 MEMO → SubjectFunding(Alice, 1)  // ✅ 成功
Alice转让owner给Carol  // ✅ 成功
Carol请求pin → 从SubjectFunding(Alice, 1)扣费  // ✅ 成功
// 💡 资金地址不变，因为基于creator派生
```

### Owner转让与资金稳定性

**核心设计**：
- **creator不可变** → 资金账户地址永久稳定
- **owner可转让** → 支持所有权转移

**转让流程**：
```rust
// 步骤1：Alice创建deceased
create_deceased(...)
// creator = Alice（不可变）
// owner = Alice（可转让）
// SubjectFunding = (domain, Alice, 1)

// 步骤2：充值
fund_subject_account(1, 100 * UNIT)
// 资金存入：SubjectFunding(Alice, 1)

// 步骤3：owner转让
transfer_deceased_owner(1, Carol)
// creator = Alice（不变）
// owner = Carol（已改变）
// SubjectFunding = (domain, Alice, 1)（不变）

// 步骤4：Carol使用资金
Carol.request_pin_for_deceased(1, ...)
// ✅ Carol是owner，有权限
// ✅ 从SubjectFunding(Alice, 1)扣费
// ✅ 资金地址未改变，正常使用
```

**优势**：
1. **地址稳定**：不受owner转让影响
2. **资金安全**：无需手动迁移资金
3. **逻辑清晰**：creator管资金，owner管权限
4. **低成本**：无需支付资金迁移gas费

### Trait职责分离

**CreatorProvider**：
- 功能：从pallet-deceased读取creator字段
- 用途：SubjectFunding账户派生
- 特性：creator不可变，地址稳定

**OwnerProvider**：
- 功能：从pallet-deceased读取owner字段
- 用途：权限检查（pin操作）
- 特性：owner可转让，灵活管理

**设计理念**：
- ✅ **职责分离**：creator管资金，owner管权限
- ✅ **低耦合**：通过trait解耦pallet
- ✅ **灵活性**：支持owner转让，不影响资金

---

### 运营者奖励分配机制

**概念澄清**：
- **OperatorEscrowAccount**：运营者托管账户（无私钥，由 PalletId `py/opesc` 派生）
- **运营者账户**：各个挖矿节点通过 `join_operator` 注册的个人账户
- **资金流向**：用户付费 → OperatorEscrowAccount（托管） → 分配给各运营者

**分配方式：按存储量×可靠性加权分配**

#### 权重计算公式

```
运营者权重 = pinned_bytes × reliability_factor

reliability_factor = probe_ok / (probe_ok + probe_fail)

如果 probe_ok + probe_fail = 0（新运营者），则使用默认值 50%
```

#### 分配规则

| 项目 | 说明 |
|------|------|
| **触发方式** | 治理 Origin 调用 `distribute_to_operators(max_amount)` |
| **分配对象** | 仅状态为 Active(0) 的运营者 |
| **分配比例** | 运营者收益 = 总金额 × (运营者权重 / 所有运营者权重之和) |
| **最低要求** | pinned_bytes > 0（权重为 0 的运营者不参与分配） |
| **建议频率** | 每周执行一次 |

#### 使用示例

**示例 1：三个运营者的分配**

```
运营者A: pinned_bytes=1000 GB, probe_ok=90, probe_fail=10
    → reliability = 90/(90+10) = 0.9
    → weight = 1000 × 0.9 = 900

运营者B: pinned_bytes=500 GB, probe_ok=80, probe_fail=20
    → reliability = 80/(80+20) = 0.8
    → weight = 500 × 0.8 = 400

运营者C: pinned_bytes=300 GB, probe_ok=50, probe_fail=50
    → reliability = 50/(50+50) = 0.5
    → weight = 300 × 0.5 = 150

total_weight = 900 + 400 + 150 = 1450

假设 OperatorEscrowAccount 余额 = 1450 MEMO
    → A 获得: 1450 × (900/1450) = 900 MEMO
    → B 获得: 1450 × (400/1450) = 400 MEMO
    → C 获得: 1450 × (150/1450) = 150 MEMO
```

**示例 2：调用分配接口**

```rust
// 治理调用：分配托管账户中的全部余额
api.tx.memoIpfs.distributeToOperators(0)
    .signAndSend(sudoAccount);

// 或者：只分配指定金额（如 10000 MEMO）
api.tx.memoIpfs.distributeToOperators(10000 * UNIT)
    .signAndSend(sudoAccount);
```

#### 事件

| 事件 | 参数 | 说明 |
|------|------|------|
| `OperatorRewarded` | `operator`, `amount`, `weight`, `total_weight` | 单个运营者获得奖励 |
| `RewardDistributed` | `total_amount`, `operator_count`, `average_weight` | 完成一轮分配的汇总信息 |

#### 注册为运营者

如果您的 memopark 挖矿服务器想要获得奖励，需要先注册为运营者：

```rust
// 1. 调用 join_operator 注册
api.tx.memoIpfs.joinOperator(
    peer_id,           // IPFS peer ID
    capacity_gib,      // 声明的存储容量（GiB）
    endpoint_hash,     // 集群端点哈希
    cert_fingerprint,  // 证书指纹（可选）
    bond_amount        // 保证金（至少 MinOperatorBond）
).signAndSend(minerAccount);

// 2. OCW 会定期探测并更新 SLA 统计
// 3. 完成 pin 任务后上报 mark_pinned
// 4. 等待治理定期调用 distribute_to_operators 获得奖励
```

---

## 📊 运营者监控系统（v5.0 - 阶段1：链上基础监控）

### 核心特性

1. **实时健康度监控**：自动追踪每个运营者的Pin管理质量
2. **智能评分算法**：基于失败率和健康Pin比例的综合评分（0-100）
3. **容量自动告警**：使用率超过80%时自动发出警告
4. **多维度指标聚合**：Pin统计、容量使用、收益数据一体化查询

### 监控数据结构

#### OperatorPinStats - 运营者Pin健康统计

| 字段 | 类型 | 说明 |
|------|------|------|
| `total_pins` | `u32` | 当前管理的Pin总数 |
| `healthy_pins` | `u32` | 健康Pin数（副本数达标） |
| `failed_pins` | `u32` | 累计失败Pin数 |
| `last_check` | `BlockNumber` | 上次统计更新时间 |
| `health_score` | `u8` | 健康度得分（0-100） |

#### 健康度评分算法

```rust
// 基础分：60分
// 健康奖励：(healthy_pins / total_pins) * 40，最多+40分
// 失败惩罚：(failed_pins / total_pins) * 100 * 2，每1%失败率扣2分，最多扣60分
// 最终得分：max(0, min(100, 60 + 健康奖励 - 失败惩罚))

// 示例：
// - 无Pin：100分（初始满分）
// - 100个Pin，100个健康，0个失败：100分（60 + 40 - 0）
// - 100个Pin，90个健康，10个失败：78分（60 + 36 - 20）
// - 100个Pin，50个健康，50个失败：0分（60 + 20 - 100，取0）
```

### 监控事件

| 事件 | 参数 | 说明 |
|------|------|------|
| `OperatorCapacityWarning` | `operator`, `used_capacity_gib`, `total_capacity_gib`, `usage_percent` | 容量使用率超过80% |
| `OperatorHealthDegraded` | `operator`, `old_score`, `new_score`, `total_pins`, `failed_pins` | 健康度下降超过10分 |
| `PinAssignedToOperator` | `operator`, `cid_hash`, `current_pins`, `capacity_usage_percent` | Pin已分配给运营者 |
| `OperatorPinSuccess` | `operator`, `cid_hash`, `replicas_confirmed` | 运营者Pin成功 |
| `OperatorPinFailed` | `operator`, `cid_hash`, `reason` | 运营者Pin失败 |

### 辅助函数

#### update_operator_pin_stats() - 更新运营者统计

```rust
/// 更新运营者Pin统计并重新计算健康度得分
/// 
/// 参数：
/// - operator: 运营者账户
/// - delta_total: Pin总数变化（+1分配，-1移除）
/// - delta_failed: 失败Pin数变化（+1失败）
/// 
/// 调用时机：
/// - Pin分配时：(operator, +1, 0)
/// - Pin失败时：(operator, 0, +1)
/// - Pin移除时：(operator, -1, 0)
pub fn update_operator_pin_stats(
    operator: &T::AccountId,
    delta_total: i32,
    delta_failed: i32,
) -> DispatchResult
```

#### calculate_health_score() - 计算健康度得分

```rust
/// 计算运营者健康度得分（0-100）
/// 
/// 评分公式：
/// - 基础分：60分
/// - 健康奖励：(healthy_pins / total_pins) * 40
/// - 失败惩罚：(failed_pins / total_pins) * 100 * 2
/// 
/// 返回：u8（0-100）
pub fn calculate_health_score(operator: &T::AccountId) -> u8
```

#### check_operator_capacity_warning() - 容量告警检查

```rust
/// 检查运营者容量使用率，超过80%发出告警
/// 
/// 算法：
/// - 假设每个Pin平均2MB
/// - usage_percent = (current_pins * 2MB / 1024) / total_capacity_gib * 100
/// 
/// 返回：bool（true=已发出告警）
pub fn check_operator_capacity_warning(operator: &T::AccountId) -> bool
```

#### get_operator_metrics() - 获取综合指标

```rust
/// 聚合运营者多维度数据，供RPC查询
/// 
/// 返回：Option<OperatorMetrics>，包含：
/// - status: 运营者状态（0=Active, 1=Suspended）
/// - capacity_gib: 声明的存储容量
/// - registered_at: 注册时间
/// - total_pins: 当前管理的Pin总数
/// - healthy_pins: 健康Pin数
/// - failed_pins: 累计失败Pin数
/// - health_score: 健康度得分（0-100）
/// - used_capacity_gib: 已使用容量（估算）
/// - capacity_usage_percent: 容量使用率（0-100）
/// - pending_rewards: 待领取收益
pub fn get_operator_metrics(
    operator: &T::AccountId,
) -> Option<OperatorMetrics<BalanceOf<T>, BlockNumberFor<T>>>
```

### 使用场景

#### 1. 运营者Dashboard查询

```rust
// 获取运营者综合指标
let metrics = Pallet::<T>::get_operator_metrics(&operator_account);
if let Some(m) = metrics {
    println!("健康度得分: {}", m.health_score);
    println!("容量使用率: {}%", m.capacity_usage_percent);
    println!("待领取收益: {}", m.pending_rewards);
}
```

#### 2. 健康度自动告警

```rust
// 在Pin失败时自动更新统计并告警
Pallet::<T>::update_operator_pin_stats(&operator, 0, 1)?;
// 如果健康度下降超过10分，会自动发送OperatorHealthDegraded事件
```

#### 3. 容量预警

```rust
// 在Pin分配后检查容量
Pallet::<T>::update_operator_pin_stats(&operator, 1, 0)?;
Pallet::<T>::check_operator_capacity_warning(&operator);
// 如果使用率≥80%，会自动发送OperatorCapacityWarning事件
```

### 前端集成建议

#### RPC接口（待实现）

```typescript
// 查询运营者指标
const metrics = await api.rpc.memoIpfs.getOperatorMetrics(operatorAccount);

// 监听健康度告警
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'memoIpfs' && event.method === 'OperatorHealthDegraded') {
      const [operator, oldScore, newScore] = event.data;
      console.warn(`运营者 ${operator} 健康度下降: ${oldScore} → ${newScore}`);
    }
  });
});
```

### 后续阶段

**阶段2（OCW健康检查增强）**：
- OCW定期调用IPFS Cluster API检查运营者节点状态
- 自动更新`healthy_pins`统计
- 自动触发Pin修复

**阶段3（链下聚合层）**：
- Subsquid监听监控Events
- 聚合历史数据（收益趋势、失败率趋势）
- 提供REST API

**阶段4（前端Dashboard）**：
- 运营者个人监控面板
- 全局运营者网络监控
- 实时图表与告警推送

---

## 🎯 智能运营者选择与副本管理（v4.0）

### 核心特性

1. **智能运营者选择**：按权重优先分配给高质量节点
2. **动态副本数支持**：允许不同文件使用不同副本数
3. **自动副本补充**：OCW 检测副本不足时自动补充

### 智能选择算法

**权重计算公式**：

```
权重 = 可用容量比例 × 可靠性

可用容量比例 = (capacity_gib - pinned_bytes/GiB) / capacity_gib
可靠性 = probe_ok / (probe_ok + probe_fail)
```

**选择策略**：
1. 计算所有活跃运营者的综合权重
2. 按权重从高到低排序
3. 优先选择权重高、容量充足、可靠性高的运营者
4. 确保负载均衡（避免单个运营者过载）

### 推荐副本数配置

| 等级 | 用途 | 推荐副本数 | 可靠性 | 使用场景 |
|------|------|-----------|--------|---------|
| Level 0 | 临时文件 | 2 | 99.99% | 缓存、草稿 |
| Level 1 ✅ | 一般文件 | 3 | 99.9999% | 大多数文件（默认） |
| Level 2 | 重要文件 | 5 | 99.99999999% | 照片、视频、音频 |
| Level 3 | 关键文件 | 7 | 99.9999999999999% | 遗嘱、证据、法律文件 |

### 新增接口

#### 治理接口：设置副本数配置

```rust
// 设置推荐副本数
api.tx.memoIpfs.setReplicasConfig(
    Some(2),  // Level 0: 临时文件
    Some(3),  // Level 1: 一般文件 ✅ 默认
    Some(5),  // Level 2: 重要文件
    Some(7),  // Level 3: 关键文件
    Some(2),  // 最小副本数阈值（触发自动补充）
).signAndSend(sudoAccount);
```

#### 查询接口：获取推荐副本数

```rust
// 在代码中获取推荐副本数
let replicas = Pallet::<T>::get_recommended_replicas(1); // 返回 3
```

### 自动副本补充

**工作流程**：

1. **OCW 巡检**：定期检查所有 Pin 状态
2. **检测不足**：发现副本数低于预期值
3. **智能选择**：使用智能算法选择新的运营者
4. **自动补充**：将新运营者添加到分配列表
5. **触发 Pin**：向新运营者发起 Pin 请求

**示例场景**：

```
初始状态:
  文件A → 运营者A、运营者B、运营者C (3 个副本)

运营者B 离线:
  文件A → 运营者A ✓、运营者B ✗、运营者C ✓ (只剩 2 个)

OCW 检测并补充:
  1. 检测到副本不足（2 < 3）
  2. 智能选择运营者D（权重最高）
  3. 更新分配：运营者A、运营者B、运营者C、运营者D
  4. 向运营者D 发起 Pin 请求

最终状态:
  文件A → 运营者A ✓、运营者C ✓、运营者D ✓ (恢复到 3 个)
```

### 使用建议

#### 1. 为不同类型文件选择合适的副本数

```rust
// 遗嘱文件（关键）
api.tx.memoIpfs.requestPinForDeceased(
    deceased_id,
    cid_hash,
    size_bytes,
    7,  // Level 3: 关键文件
    price
);

// 照片视频（重要）
api.tx.memoIpfs.requestPinForDeceased(
    deceased_id,
    cid_hash,
    size_bytes,
    5,  // Level 2: 重要文件
    price
);

// 一般文件（推荐）
api.tx.memoIpfs.requestPinForDeceased(
    deceased_id,
    cid_hash,
    size_bytes,
    3,  // Level 1: 一般文件 ✅ 默认
    price
);
```

#### 2. 监控副本健康状态

关注以下事件：
- `ReplicaDegraded(cid_hash, operator)`: 副本降级
- `ReplicaRepaired(cid_hash, operator)`: 副本修复
- `AssignmentCreated(cid_hash, count)`: 新增运营者
- `OperatorDegradationAlert(operator, count)`: 运营者频繁降级警告

#### 3. 定期审计副本分配

使用查询接口检查：
- `PinAssignments`: 每个文件分配给哪些运营者
- `PinSuccess`: 哪些运营者已成功 Pin
- `OperatorSla`: 运营者的 SLA 统计

---

## 存储业务与 Offchain Worker（OCW）骨架

- 用户通过 `request_pin_for_deceased` 发起 pin 请求，使用三重扣款机制（IpfsPool → SubjectFunding → Caller）
- 周期扣款使用双重扣款机制（IpfsPool → SubjectFunding），无 caller fallback
- 运营者（矿工）需 `join_operator` 并质押，活跃状态方可上报；上报/探测与 SLA 统计绑定。
- OCW 调用 ipfs-cluster API 完成 `POST /pins`（携带 allocations）与后续巡检/修复；指数退避与全局锁防抖。
- OCW 使用节点 keystore 的 `KeyTypeId = b"ipfs"` 专用密钥签名上报 `mark_pinned/mark_pin_failed/report_probe`。

安全与隐私：

- 链上仅存 `cid_hash`，不存明文 CID；OCW 可从本地密文/审计密钥解密得到 CID 后再发 HTTP。
- 集群端点与令牌存于 offchain 本地存储：`/memo/ipfs/cluster_endpoint`、`/memo/ipfs/token`。

## 流程

1) 下单与记账：`request_pin(cid_hash, size, replicas, price)` → `Endowment::deposit_from_storage` 入账
2) 副本分配：OCW 为该 `cid_hash` 选取 R 个活跃运营者 → `PinAssignments`
3) 发起 Pin：OCW 发送 `POST /pins`，body 含 `{ cid, allocations: [peer_id...] }`
4) 回执上链：运营者成功/失败上报 `mark_pinned/mark_pin_failed`，写入 `PinSuccess`；达成 R 副本 → `PinState=Pinned`
5) 巡检与修复：OCW 周期遍历 `PinState in {Pinning,Pinned}`，不足副本则再次 `POST /pins`（指数退避与全局锁防抖）；后续可细化 `ReplicaDegraded/ReplicaRepaired`
6) SLA 统计：OCW 读 `/peers` 上报 `report_probe(ok)`；基金会按期 `close_epoch_and_pay(budget)` 依权重发放
7) 轻量事件上报：在不提交链上写交易的前提下，OCW 统计 pinning/pinned/missing 样本并发出 `PinProbe` 事件，前端/索引可据此绘制健康度。

## 计费生命周期（新增）

设计目标：上传与计费解耦；以链上请求为付费起点；从"主体派生资金账户"自动扣费，事件可审计、治理可控。

### 主题资金账户架构

**独立 PalletId 设计：**
- 使用专属的 `SubjectPalletId (*b"subjects")` 派生主题资金子账户
- 与 OTC 托管（`EscrowPalletId`）、联盟计酬（`AffiliatePalletId`）完全隔离
- 语义清晰，职责单一，易于扩展

**账户派生方式：**
- **派生公式**：`subject_account = SubjectPalletId.into_sub_account_truncating((domain:u8, subject_id:u64))`
- **逝者账户**：`domain=1`，例如 `(1, 1)` 表示逝者1的资金账户
- **墓地账户**：`domain=2`（未来扩展）
- **陵园账户**：`domain=3`（未来扩展）
- **特性**：派生账户无私钥，不可签名，仅用于托管与扣费

**架构优势：**
- ✅ **语义清晰**：`SubjectPalletId` 专门用于主题资金，不与其他业务混淆
- ✅ **职责单一**：每个域的资金独立管理，各司其职
- ✅ **资金隔离**：每个主题都有独立的资金账户，天然隔离
- ✅ **易于扩展**：可以轻松添加新的业务域（墓地、陵园等）

**使用流程：**
- 两步法：用户先向主体资金账户充值；再调用 `request_pin_for_deceased(subject_id, ...)` 固化进入生命周期。
- 周期扣费：按周（可配置）从主体账户扣 MEMO，失败进入宽限，超期过期。

### 新增存储
- `PricePerGiBWeek: u128`：每 GiB·周 单价（最小单位）。
- `BillingPeriodBlocks: u32`：计费周期区块数（默认 100_800 ≈ 1 周）。
- `GraceBlocks: u32`：宽限期区块数。
- `MaxChargePerBlock: u32`：每块最大扣费数（限流）。
- `SubjectMinReserve: Balance`：主体账户最低保留（KeepAlive 保护）。
- `BillingPaused: bool`：计费暂停开关。
- `PinBilling{cid_hash -> (next_charge_at, unit_price_snapshot, state)}`：state=0 Active/1 Grace/2 Expired。
- `PinSubjectOf{cid_hash -> (owner, subject_id)}`：仅“主体扣费”场景登记来源。
- `DueQueue{block -> Vec<cid_hash>}`：到期队列（每块处理上限）。
  - `DueEnqueueSpread: u32`：入队扩散窗口；将到期项在 `base..base+spread` 范围内寻找首个未满队列入队，以平滑负载。

### 新增事件
- `PinCharged(cid_hash, amount, period_blocks, next_charge_at)`：成功扣费并推进下一期。
- `PinGrace(cid_hash)`：余额不足进入宽限。
- `PinExpired(cid_hash)`：超出宽限仍不足，标记过期。
- `PinProbe(sample, pinning, pinned, missing)`：OCW 巡检周期性只读上报，样本总数与各状态计数，用于监控与告警。

### 扣费计算
`amount = ceil(size_bytes / GiB) * replicas * PricePerGiBWeek`。为避免小数，建议使用整数定价基数。

### 新增接口
- `request_pin_for_deceased(subject_id, cid_hash, size_bytes, replicas, price)`：从主体资金账户一次性扣除请求价，并初始化计费（登记 `PinSubjectOf`、`PinBilling`、入队 `DueQueue`）。
- `charge_due(limit)`【治理/白名单】：处理当前区块到期的 ≤limit 个 CID，完成扣费/宽限/过期处理，并事件记录。
- `set_billing_params(price_per_gib_week?, period_blocks?, grace_blocks?, max_charge_per_block?, subject_min_reserve?, paused?, allow_direct_pin?)`：治理更新参数（可部分更新）。当 `allow_direct_pin=false` 时，`request_pin` 将被拒绝，仅允许主体聚合扣费路径。

#### 只读视图函数（新增）
- `derive_subject_account_for_deceased(subject_id: u64) -> AccountId`：返回稳定派生的逝者主题资金账户地址。
- `derive_subject_account(domain: u8, subject_id: u64) -> AccountId`：返回任意 `(domain, subject_id)` 的主题资金账户地址。

**前端集成示例（TypeScript）：**

```typescript
import { encodeAddress, blake2AsU8a } from '@polkadot/util-crypto';
import { stringToU8a, u8aConcat } from '@polkadot/util';

/**
 * 派生主题资金子账户地址
 * @param palletId - PalletId 字符串（8字节）'subjects'
 * @param domain - 域编码（u8）1=逝者, 2=墓地, 3=陵园
 * @param subjectId - 主题ID（u64）
 * @returns 派生的账户地址
 */
function deriveSubjectAccount(palletId: string, domain: number, subjectId: number): string {
    // 1. PalletId 前缀：'modl' + palletId (padded to 8 bytes)
    const palletIdBytes = stringToU8a('modl' + palletId.padEnd(8, '\0'));
    
    // 2. Domain (u8)
    const domainBytes = new Uint8Array([domain]);
    
    // 3. SubjectId (u64, little-endian)
    const subjectIdBytes = new Uint8Array(8);
    new DataView(subjectIdBytes.buffer).setBigUint64(0, BigInt(subjectId), true);
    
    // 4. 拼接并哈希
    const combined = u8aConcat(palletIdBytes, domainBytes, subjectIdBytes);
    const hash = blake2AsU8a(combined, 256);
    
    // 5. 编码为 SS58 地址
    return encodeAddress(hash, 42);
}

// 便捷函数：派生逝者资金账户
function deriveDeceasedFundingAccount(subjectId: number): string {
    return deriveSubjectAccount('subjects', 1, subjectId);
}

// 使用示例
const address = deriveDeceasedFundingAccount(1); // 逝者1的资金账户
console.log('逝者1资金账户:', address);

// 查询余额
const { data } = await api.query.system.account(address);
const balance = data.free;

// 充值到逝者资金账户
await api.tx.balances.transferKeepAlive(address, amount).signAndSend(signer);
```

#### 只读查询（前端建议直读）
- `PinBilling{cid_hash}` → `(next_charge_at, unit_price_snapshot, state)`：state=0 Active/1 Grace/2 Expired。
- `PinSubjectOf{cid_hash}` → `(owner, subject_id)`：仅“主体扣费”场景存在。
- `PinMeta{cid_hash}` → `(replicas, size_bytes, created, last_checked)`：用于估算单周成本。
- `DueQueue{block}` → `Vec<cid_hash>`：仅供运维观测与调度，不建议前端依赖。

> 参数防呆：`set_billing_params` 对 `price/period/grace/max_per_block` 做 `>0` 校验，避免设置为 0 造成停摆或无限宽限。

### 安全与治理
- 仅允许 Pallet 内从“主体派生账户”扣款；金额依据链上参数与 CID 元数据计算；转账采用 `KeepAlive` 并校验 `free - amount ≥ SubjectMinReserve`。
- 通过 `BillingPaused` 可暂停计费；参数可治理调整；白名单服务商可触发 `charge_due(limit)` 无权变更金额。

### 前端使用建议
- 两步法页面展示：主体资金账户余额、预估单周成本、下次扣费区块、当前状态（Active/Grace/Expired）。
- 支持输入 owner+subject_id 推导派生地址并一键复制；提供充值快捷入口。

## 存储（新增）
- `PinMeta{cid_hash -> (replicas, size_bytes, created, last_checked)}`
- `PinStateOf{cid_hash -> u8}`：0=Requested,1=Pinning,2=Pinned,3=Degraded,4=Failed
- `PinAssignments{cid_hash -> BoundedVec<AccountId>}`
- `PinSuccess{(cid_hash, operator) -> bool}`
- `OperatorSla{account -> {probe_ok, probe_fail, ...}}`

## 退避与锁
- 全局 `StorageLock`：`/memo/ipfs/ocw_lock`，避免并发重复 OCW 周期
- 指数退避键：`/memo/ipfs/backoff/<cid_hash>`（SCALE 编码哈希后缀），失败 2s 起指数增加，上限 60s；成功则重置
