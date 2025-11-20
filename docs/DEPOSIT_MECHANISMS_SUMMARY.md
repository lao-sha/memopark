# Stardust 押金机制汇总

**日期**: 2025-11-19  
**目的**: 系统性列出所有需要押金机制的模块和场景

---

## 📋 押金机制概览

Substrate和Stardust中的押金机制用于：
1. **防止垃圾数据**：存储数据需要押金，防止滥用链上存储
2. **激励正确行为**：押金可返还，鼓励用户维护正确状态
3. **经济惩罚**：恶意行为会导致押金罚没

---

## 🎯 核心业务模块押金

### 1. Pallet Deceased（逝者内容）

#### 1.1 内容创建押金

**文本内容押金**
```rust
// 基础押金：10 DUST
type TextBaseDeposit = ConstU128<10_000_000_000>;

// 按字节押金：0.001 DUST/字节
type TextByteDeposit = ConstU128<1_000_000>;
```

**使用场景**：
- 创建文本内容（悼词、回忆录）
- 创建媒体内容（图片、视频）
- 创建AI训练作品

**押金计算**：
```rust
total_deposit = TextBaseDeposit + (content_size * TextByteDeposit)
```

**退还条件**：
- 删除内容时全额退还
- 内容不违规即可保留

---

#### 1.2 分类变更押金

```rust
// 分类变更申请押金：10 DUST
type CategoryChangeDeposit = ConstU128<10_000_000_000>;
```

**使用场景**：
- 申请变更内容分类（从draft到published）
- 申请变更作品类型

**押金处理**：
- ✅ **批准**：全额退回
- ⚠️ **拒绝**：50%退回，50%罚没至国库
- ⏰ **过期**：全额退回

**代码位置**：
```rust
// pallets/deceased/src/lib.rs
pub struct CategoryChangeRequest<T: Config> {
    pub applicant: T::AccountId,
    pub deposit: BalanceOf<T>,  // 押金金额
    pub status: CategoryChangeStatus,
    // ...
}
```

---

#### 1.3 永久质押押金（Phase 1.4）

```rust
// 永久质押基础金额
type PermanentLockBaseAmount: Get<BalanceOf<T>>;

// 永久质押按字节金额
type PermanentLockPerByte: Get<BalanceOf<T>>;
```

**使用场景**：
- 内容永久保存（永不删除）
- 区块链存储占用

**特点**：
- 💎 **永久锁定**：押金永远不退还
- 🔒 **不可逆**：一旦锁定无法取消
- 📈 **激励节点**：质押金额作为网络安全保障

**代码位置**：
```rust
// pallets/deceased/src/governance.rs
pub fn request_permanent_lock(
    origin: OriginFor<T>,
    content_hash: T::Hash,
) -> DispatchResult {
    // 计算并锁定押金
    let deposit = Self::calculate_permanent_lock_deposit(&content);
    T::Currency::reserve(&who, deposit)?;
    // ...
}
```

---

### 2. Pallet Stardust IPFS（IPFS存储）

#### 2.1 Pin押金

```rust
// Pin基础押金
type PinBaseDeposit: Get<BalanceOf<T>>;

// Pin按大小押金（每MB）
type PinPerMbDeposit: Get<BalanceOf<T>>;
```

**使用场景**：
- Pin CID到IPFS网络
- 请求持久化存储

**押金计算**：
```rust
total_deposit = PinBaseDeposit + (file_size_mb * PinPerMbDeposit)
```

**退还条件**：
- Unpin时全额退还
- 存储费用另计

---

#### 2.2 运营者质押

```rust
// 运营者质押账户
pub fn operator_bond_account(operator: &T::AccountId) -> T::AccountId {
    // 派生质押账户
}
```

**使用场景**：
- 注册为IPFS运营者
- 提供存储服务

**质押要求**：
- 💰 最小质押金额（待定义）
- 🔒 锁定期限
- ⚖️ 罚没条件（服务不达标）

---

### 3. Pallet Stardust Appeals（内容申诉）

#### 3.1 申诉押金（动态策略）

```rust
// 基础申诉押金：10 DUST
type AppealDeposit = ConstU128<10_000_000_000>;

// 动态押金策略
type AppealDepositPolicy = ContentAppealDepositPolicy;
```

**押金策略**：

| 域（Domain） | 操作（Action） | 押金倍数 |
|-------------|---------------|----------|
| `deceased` | `text_create` | 1.0x |
| `deceased` | `media_create` | 2.0x |
| `offerings` | `media_create` | 1.5x |
| `evidence` | `* ` | 3.0x |

**计算示例**：
```rust
// deceased域的媒体创建申诉
base_deposit = 10 DUST
multiplier = 2.0
total_deposit = 10 * 2.0 = 20 DUST
```

**押金处理**：
- ✅ **批准**：全额退回
- ⚠️ **拒绝**：按比例罚没（30%）
- 📤 **撤回**：按比例罚没（10%）

**代码位置**：
```rust
// pallets/stardust-appeals/src/deposit_policy.rs
impl<T: Config> AppealDepositCalculator<T> for ContentAppealDepositPolicy {
    fn calculate_deposit(
        domain: &BoundedVec<u8, ConstU32<32>>,
        action: &BoundedVec<u8, ConstU32<64>>,
    ) -> BalanceOf<T> {
        // 动态计算押金
    }
}
```

---

### 4. Pallet Identity（身份管理）

#### 4.1 身份注册押金

```rust
// 基础押金：10 DUST
type BasicDeposit = ConstU128<10_000_000_000>;

// 每字节押金：0.001 DUST
type ByteDeposit = ConstU128<1_000_000>;

// 用户名押金：5 DUST
type UsernameDeposit = ConstU128<5_000_000_000>;

// 子账户押金：2 DUST
type SubAccountDeposit = ConstU128<2_000_000_000>;
```

**使用场景**：
- 注册链上身份
- 设置身份信息（昵称、邮箱等）
- 注册用户名
- 添加子账户

**押金计算**：
```rust
// 身份押金
identity_deposit = BasicDeposit + (info_size * ByteDeposit)

// 子账户押金
sub_account_deposit = SubAccountDeposit * sub_account_count
```

**退还条件**：
- 清除身份时退还
- 移除子账户时退还

---

### 5. Pallet Proxy（代理管理）

#### 5.1 代理押金

```rust
// 基础押金：5 DUST
type ProxyDepositBase = ConstU128<5_000_000_000>;

// 每个代理押金：1 DUST
type ProxyDepositFactor = ConstU128<1_000_000_000>;
```

**使用场景**：
- 添加代理账户
- 授权他人代理操作

**押金计算**：
```rust
total_deposit = ProxyDepositBase + (proxy_count * ProxyDepositFactor)
```

---

#### 5.2 公告押金

```rust
// 公告基础押金：2 DUST
type AnnouncementDepositBase = ConstU128<2_000_000_000>;

// 每个公告押金：0.5 DUST
type AnnouncementDepositFactor = ConstU128<500_000_000>;
```

**使用场景**：
- 代理发布公告
- 预告即将执行的操作

---

### 6. Pallet Multisig（多签管理）

#### 6.1 多签押金

```rust
// 基础押金：10 DUST
type DepositBase = ConstU128<10_000_000_000>;

// 每个签名者押金：1 DUST
type DepositFactor = ConstU128<1_000_000_000>;
```

**使用场景**：
- 创建多签账户
- 发起多签交易

**押金计算**：
```rust
total_deposit = DepositBase + (threshold * DepositFactor)
```

---

### 7. Pallet Democracy（民主治理）

#### 7.1 提案押金

```rust
// 最小提案押金：100 DUST
type MinimumDeposit = ConstU128<100_000_000_000>;
```

**使用场景**：
- 发起公投提案
- 发起外部提案

**押金处理**：
- ✅ **通过**：全额退回
- ❌ **不通过**：全额罚没

---

### 8. Pallet Bounties（赏金）

#### 8.1 赏金押金

```rust
// 赏金基础押金：20 DUST
type BountyDepositBase = ConstU128<20_000_000_000>;

// 数据按字节押金：0.001 DUST
type DataDepositPerByte = ConstU128<1_000_000>;

// 策展人最小押金：5 DUST
type CuratorDepositMin = Some(ConstU128<5_000_000_000>);

// 策展人最大押金：100 DUST
type CuratorDepositMax = Some(ConstU128<100_000_000_000>);
```

**使用场景**：
- 创建赏金任务
- 申请成为策展人

---

### 9. Pallet Tips（打赏）

#### 9.1 打赏报告押金

```rust
// 报告基础押金：1 DUST
type TipReportDepositBase = ConstU128<1_000_000_000>;

// 数据按字节押金：0.001 DUST
type DataDepositPerByte = ConstU128<1_000_000>;
```

**使用场景**：
- 提交打赏报告
- 提名打赏对象

---

### 10. Pallet Arbitration（仲裁）

#### 10.1 双向押金机制 🆕

```rust
// 押金比例：订单金额的15%
type DepositRatioBps = ConstU16<1500>;  // 基点制

// 应诉期限：7天
type ResponseDeadline = ConstU32<{ 7 * DAYS }>;

// 驳回罚没比例：30%
type DismissSlashBps = ConstU16<3000>;
```

**使用场景**：
- 买家发起纠纷（从托管扣押金）
- 卖家应诉（从托管扣押金）

**押金计算**：
```rust
// 发起方押金
initiator_deposit = order_amount * 15%

// 应诉方押金（相同）
respondent_deposit = order_amount * 15%
```

**押金处理**：

| 裁决结果 | 发起方押金 | 应诉方押金 |
|---------|-----------|-----------|
| **支持发起方** | ✅ 全额退回 | ❌ 全额罚没 |
| **支持应诉方** | ❌ 全额罚没 | ✅ 全额退回 |
| **驳回纠纷** | ⚠️ 30%罚没 | ✅ 全额退回 |
| **部分支持** | 🔄 按比例退回 | 🔄 按比例罚没 |

**代码位置**：
```rust
// pallets/arbitration/src/lib.rs
pub struct TwoWayDepositRecord<AccountId, Balance, BlockNumber> {
    pub initiator: AccountId,
    pub initiator_deposit: Balance,
    pub respondent: AccountId,
    pub respondent_deposit: Option<Balance>,
    pub response_deadline: BlockNumber,
    pub has_responded: bool,
}

// 发起纠纷并锁定押金
#[pallet::call_index(4)]
pub fn dispute_with_deposit(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
) -> DispatchResult {
    // 1. 从托管账户扣除发起方押金（15%）
    let deposit_amount = order_amount * 15 / 100;
    T::Fungible::hold(&escrow_account, deposit_amount)?;
    
    // 2. 登记纠纷记录
    TwoWayDeposits::insert(domain, id, deposit_record);
}

// 应诉并锁定押金
#[pallet::call_index(5)]
pub fn respond_to_dispute(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    rebuttal: Vec<u8>,
) -> DispatchResult {
    // 1. 从托管账户扣除应诉方押金（相同金额）
    T::Fungible::hold(&escrow_account, deposit_amount)?;
    
    // 2. 更新押金记录
    deposit_record.respondent_deposit = Some(deposit_amount);
}
```

---

### 11. Pallet Credit（信用系统）

#### 11.1 做市商动态保证金

```rust
// 动态保证金存储
pub type MakerDynamicDeposit<T> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // maker_id
    Balance,
>;
```

**使用场景**：
- 做市商注册
- 信用评分挂钩
- 订单保证金

**动态调整**：
```rust
// 信用分越高，保证金要求越低
if credit_score >= 90 {
    required_deposit = base_deposit * 0.5
} else if credit_score >= 70 {
    required_deposit = base_deposit * 0.8
} else {
    required_deposit = base_deposit * 1.2
}
```

---

### 12. Pallet NFTs（NFT）

#### 12.1 NFT相关押金

```rust
// Collection创建押金
type CollectionDeposit: Get<BalanceOf<T>>;

// Item铸造押金
type ItemDeposit: Get<BalanceOf<T>>;

// 元数据押金
type MetadataDepositBase: Get<BalanceOf<T>>;
type MetadataDepositPerByte: Get<BalanceOf<T>>;

// 属性押金
type AttributeDepositBase: Get<BalanceOf<T>>;
```

**使用场景**：
- 创建NFT集合
- 铸造NFT
- 设置元数据
- 添加属性

**押金计算**：
```rust
// Collection押金
collection_deposit = CollectionDeposit::get()

// Item押金
item_deposit = ItemDeposit::get()

// 元数据押金
metadata_deposit = MetadataDepositBase + (data_size * MetadataDepositPerByte)

// 属性押金
attribute_deposit = AttributeDepositBase * attribute_count
```

---

### 13. Pallet Recovery（账户恢复）

#### 13.1 社交恢复押金

```rust
// 配置押金：基础 + 每个好友
type ConfigDepositBase: Get<BalanceOf<T>>;
type FriendDepositFactor: Get<BalanceOf<T>>;

// 恢复押金
type RecoveryDeposit: Get<BalanceOf<T>>;
```

**使用场景**：
- 设置社交恢复
- 添加恢复好友
- 发起账户恢复

**押金计算**：
```rust
// 配置押金
config_deposit = ConfigDepositBase + (friend_count * FriendDepositFactor)

// 恢复押金
recovery_deposit = RecoveryDeposit::get()
```

---

## 💰 押金金额总览

| 模块 | 押金类型 | 基础金额 | 变量部分 | 用途 |
|------|---------|---------|---------|------|
| **Deceased** | 文本内容 | 10 DUST | 0.001 DUST/字节 | 防止垃圾内容 |
| | 分类变更 | 10 DUST | - | 防止滥用审核 |
| | 永久质押 | 待定 | 待定 | 永久存储保障 |
| **IPFS** | Pin押金 | 待定 | 按大小 | 存储资源占用 |
| | 运营者质押 | 待定 | - | 服务质量保障 |
| **Appeals** | 申诉押金 | 10 DUST | 1.0x-3.0x | 防止恶意申诉 |
| **Identity** | 身份注册 | 10 DUST | 0.001 DUST/字节 | 防止身份滥用 |
| | 用户名 | 5 DUST | - | 用户名占用 |
| | 子账户 | 2 DUST | 每个 | 子账户管理 |
| **Proxy** | 代理 | 5 DUST | 1 DUST/个 | 代理关系管理 |
| | 公告 | 2 DUST | 0.5 DUST/个 | 公告存储 |
| **Multisig** | 多签 | 10 DUST | 1 DUST/签名者 | 多签管理 |
| **Democracy** | 提案 | 100 DUST | - | 提案质量保障 |
| **Bounties** | 赏金 | 20 DUST | 0.001 DUST/字节 | 赏金任务 |
| | 策展人 | 5-100 DUST | - | 策展人质押 |
| **Tips** | 打赏报告 | 1 DUST | 0.001 DUST/字节 | 打赏提名 |
| **Arbitration** | 纠纷押金 | 订单金额15% | 双向 | 防止恶意纠纷 |
| **Credit** | 做市商保证金 | 动态 | 信用评分 | 订单保障 |
| **NFTs** | Collection | 待定 | - | 集合创建 |
| | Item | 待定 | - | NFT铸造 |
| | 元数据 | 待定 | 按字节 | 元数据存储 |
| **Recovery** | 配置 | 待定 | 每个好友 | 社交恢复 |
| | 恢复 | 待定 | - | 发起恢复 |

---

## 🔄 押金处理流程

### 标准流程

```
用户发起操作
    ↓
计算所需押金
    ↓
检查余额是否足够
    ↓
冻结押金（reserve）
    ↓
执行业务逻辑
    ↓
操作完成/取消
    ↓
处理押金
    ├─ ✅ 成功：全额退还（unreserve）
    ├─ ⚠️ 部分罚没：按比例退还+罚没（slash）
    └─ ❌ 全额罚没：转入国库（slash_all）
```

### 代码实现

```rust
// 1. 冻结押金
T::Currency::reserve(&who, deposit)?;

// 2. 全额退还
T::Currency::unreserve(&who, deposit);

// 3. 部分罚没（30%）
let slash_amount = deposit * 30 / 100;
T::Currency::slash_reserved(&who, slash_amount);
T::Currency::unreserve(&who, deposit - slash_amount);

// 4. 全额罚没
T::Currency::slash_reserved(&who, deposit);
```

---

## 📊 押金使用统计

### 按用途分类

| 用途 | 模块数量 | 占比 |
|-----|---------|------|
| **内容存储** | 5 | 38% |
| **身份管理** | 3 | 23% |
| **治理相关** | 2 | 15% |
| **交易保障** | 2 | 15% |
| **代理/多签** | 2 | 15% |
| **资产管理** | 1 | 8% |

### 按金额分类

| 金额范围 | 模块 | 用途 |
|---------|------|------|
| **1-5 DUST** | Tips, Proxy公告, 子账户 | 轻量级操作 |
| **5-20 DUST** | Identity, Proxy代理, Multisig | 中等操作 |
| **20-100 DUST** | Deceased, Appeals, Bounties | 重要操作 |
| **100+ DUST** | Democracy | 治理提案 |
| **动态计算** | Arbitration, Credit, NFTs | 按实际价值 |

---

## ⚠️ 待定义的押金

以下押金机制需要在运行时配置中明确定义：

### 1. IPFS模块

- [ ] `PinBaseDeposit` - Pin基础押金
- [ ] `PinPerMbDeposit` - Pin按大小押金
- [ ] `OperatorMinBond` - 运营者最小质押
- [ ] `OperatorSlashAmount` - 运营者罚没金额

### 2. Deceased模块

- [ ] `PermanentLockBaseAmount` - 永久质押基础金额
- [ ] `PermanentLockPerByte` - 永久质押按字节金额

### 3. NFTs模块

- [ ] `CollectionDeposit` - Collection创建押金
- [ ] `ItemDeposit` - NFT铸造押金
- [ ] `MetadataDepositBase` - 元数据基础押金
- [ ] `MetadataDepositPerByte` - 元数据按字节押金
- [ ] `AttributeDepositBase` - 属性押金

### 4. Recovery模块

- [ ] `ConfigDepositBase` - 社交恢复配置基础押金
- [ ] `FriendDepositFactor` - 每个好友押金
- [ ] `RecoveryDeposit` - 发起恢复押金

### 5. Credit模块

- [ ] `MakerBaseDeposit` - 做市商基础保证金
- [ ] 动态保证金规则（基于信用评分）

### 6. 其他待确认

- [ ] 市场挂单押金
- [ ] OTC交易押金

---

## 🛠️ 实现建议

### 1. 统一押金管理

建议创建一个统一的押金管理模块：

```rust
// pallets/deposit-manager/src/lib.rs
pub struct DepositConfig {
    pub base_amount: Balance,
    pub per_byte: Balance,
    pub slash_ratio: Perbill,
}

pub trait DepositManager<AccountId, Balance> {
    fn calculate_deposit(&self, data_size: u32) -> Balance;
    fn reserve_deposit(&self, who: &AccountId, amount: Balance) -> DispatchResult;
    fn refund_deposit(&self, who: &AccountId, amount: Balance);
    fn slash_deposit(&self, who: &AccountId, amount: Balance, ratio: Perbill);
}
```

### 2. 治理参数化

所有押金金额应该通过治理可调整：

```rust
// 使用 pallet-governance-params
impl Config for Runtime {
    type DeceasedTextDeposit = GovernanceParams::get("deceased.text_deposit");
    type DeceasedMediaDeposit = GovernanceParams::get("deceased.media_deposit");
    // ...
}
```

### 3. 押金退还优化

建议实现批量退还机制，减少交易费用：

```rust
pub fn batch_refund_deposits(
    origin: OriginFor<T>,
    deposits: Vec<(AccountId, Balance)>,
) -> DispatchResult {
    // 批量退还押金
}
```

---

## 📝 开发检查清单

在实现新功能时，检查是否需要押金：

- [ ] 功能是否占用链上存储？
- [ ] 功能是否可能被滥用？
- [ ] 功能是否需要经济激励？
- [ ] 押金金额是否合理？
- [ ] 押金退还条件是否明确？
- [ ] 押金罚没规则是否公平？
- [ ] 是否考虑了边界情况？
- [ ] 是否有测试覆盖？

---

## 🎯 总结

### 押金机制的核心价值

1. **防止垃圾数据** 💾
   - 存储成本外部化
   - 激励数据清理

2. **经济激励** 💰
   - 正确行为奖励
   - 恶意行为惩罚

3. **资源管理** ⚖️
   - 链上资源配额
   - 公平竞争机制

### 设计原则

1. ✅ **金额合理**：不能太高（阻碍使用）也不能太低（无法防止滥用）
2. ✅ **规则明确**：用户清楚何时退还、何时罚没
3. ✅ **可调整性**：通过治理动态调整
4. ✅ **用户体验**：自动计算、透明展示

---

## 📈 押金机制特色

### 1. 仲裁双向押金 🆕

**创新点**：
- ✅ 双方都要押金，防止恶意纠纷
- ✅ 从托管账户扣除，保障资金安全
- ✅ 应诉方有时间窗口（7天）
- ✅ 按裁决结果智能分配

**优势**：
- 🛡️ 防止买家恶意退款
- 🛡️ 防止卖家不应诉
- ⚖️ 公平保障双方权益

### 2. 动态保证金机制 🆕

**Credit系统**：
- 📊 信用评分越高，保证金越低
- 📈 激励良好行为
- 📉 惩罚不良记录

**示例**：
```
信用分90+：保证金50%
信用分70-89：保证金80%
信用分<70：保证金120%
```

### 3. 永久质押机制 🆕

**Deceased模块**：
- 💎 永久锁定，永不退还
- 🔒 确保内容永久保存
- 🌐 网络安全保障

---

**Stardust中共有13个主要模块使用押金机制，涵盖内容、身份、治理、交易、资产等多个领域。**

**所有押金设计都遵循"可退还、可罚没、可治理"的原则，并引入了双向押金、动态保证金、永久质押等创新机制。** ✅
