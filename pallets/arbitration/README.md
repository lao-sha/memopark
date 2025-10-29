# Pallet Arbitration - 去中心化仲裁系统

## 📋 模块概述

`pallet-arbitration` 是Stardust生态的**争议解决中心**，提供去中心化的仲裁机制，支持多业务域（OTC、Bridge等）的争议登记、证据管理和治理裁决。通过域路由(Domain Router)设计实现与业务pallet的低耦合集成。

### 设计理念

- **域隔离**：通过8字节域标识符区分不同业务
- **证据链上化**：证据CID上链，内容存IPFS
- **治理裁决**：委员会投票决定，非任意账户
- **路由解耦**：通过Router Trait与业务pallet解耦

## 🏗️ 架构设计

```text
┌──────────────────────────────────────────┐
│         用户/业务层                       │
│  - OTC买家/卖家发起争议                   │
│  - Bridge用户发起争议                     │
└──────────────┬───────────────────────────┘
               ↓ 调用 dispute()
┌──────────────────────────────────────────┐
│     Arbitration Pallet (仲裁层)          │
│  - 登记争议 (domain, id)                 │
│  - 关联证据 (evidence_id)                │
│  - 等待裁决                               │
└──────────────┬───────────────────────────┘
               ↓ 委员会裁决
┌──────────────────────────────────────────┐
│     治理层 (Governance)                   │
│  - 委员会审查证据                         │
│  - 投票表决 (Release/Refund/Partial)     │
└──────────────┬───────────────────────────┘
               ↓ arbitrate()
┌──────────────────────────────────────────┐
│     ArbitrationRouter Trait              │
│  - apply_decision(domain, id, decision)  │
└──────────────┬───────────────────────────┘
               ↓ 路由到业务pallet
┌──────────────────────────────────────────┐
│     业务Pallet (OTC/Bridge)              │
│  - 应用裁决到订单/桥接记录                │
│  - 调用Escrow释放/退款                    │
│  - 更新订单状态                           │
│  - 更新信用分                             │
└──────────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 争议登记

#### dispute - 发起仲裁（旧版，带CID列表）
```rust
pub fn dispute(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence: Vec<BoundedVec<u8, T::MaxCidLen>>,
) -> DispatchResult
```

**参数说明**：
- `domain`: 业务域标识（8字节，通常对应PalletId）
- `id`: 业务对象ID（订单ID、桥接ID等）
- `evidence`: 证据CID列表（直接提交，不推荐）

**功能**：
- 校验发起权限（通过Router.can_dispute）
- 防止重复争议
- 登记争议状态
- 触发Disputed事件

#### dispute_with_evidence_id - 发起仲裁（推荐，引用证据）
```rust
pub fn dispute_with_evidence_id(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> DispatchResult
```

**参数说明**：
- `domain`: 业务域标识
- `id`: 业务对象ID
- `evidence_id`: 证据ID（由pallet-evidence生成）

**优势**：
- ✅ 证据统一管理（复用pallet-evidence）
- ✅ 支持私有证据（加密存储）
- ✅ 支持访问控制
- ✅ 支持多案件复用同一证据

**工作流程**：
```text
1. 用户调用 pallet-evidence::commit() 提交证据
   → 获得 evidence_id
2. 用户调用 pallet-arbitration::dispute_with_evidence_id()
   → 关联证据到案件
3. 委员会查看证据（通过evidence_id）
4. 委员会投票裁决
```

### 2. 裁决执行

#### arbitrate - 委员会裁决
```rust
pub fn arbitrate(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    decision_code: u8,
    bps: Option<u16>,
) -> DispatchResult
```

**权限**：DecisionOrigin（Root或委员会阈值）

**裁决类型**：
- **decision_code = 0**: Release（全额放款给卖家/做市商）
- **decision_code = 1**: Refund（全额退款给买家）
- **decision_code = 2**: Partial（部分放款，bps指定比例）

**裁决流程**：
1. 校验DecisionOrigin权限
2. 确认案件处于Disputed状态
3. 构造Decision枚举
4. 调用 `Router::apply_decision(domain, id, decision)`
5. 业务pallet执行具体操作（释放资金、更新状态、扣信用分等）
6. 触发Arbitrated事件

### 3. 域路由机制

#### ArbitrationRouter Trait
```rust
pub trait ArbitrationRouter<AccountId> {
    /// 校验是否允许发起争议
    fn can_dispute(domain: [u8; 8], who: &AccountId, id: u64) -> bool;
    
    /// 应用裁决（放款/退款/部分放款）
    fn apply_decision(domain: [u8; 8], id: u64, decision: Decision) -> DispatchResult;
}
```

**Runtime实现示例**：
```rust
impl ArbitrationRouter<AccountId> for RuntimeArbitrationRouter {
    fn can_dispute(domain: [u8; 8], who: &AccountId, id: u64) -> bool {
        match domain {
            // OTC域
            b"stardust/otc_order" => {
                // 检查是否为买家或卖家
                pallet_otc_order::Pallet::<Runtime>::is_participant(who, id)
            },
            // Bridge域
            b"stardust/simple_bridge" => {
                // 检查是否为用户或做市商
                pallet_simple_bridge::Pallet::<Runtime>::is_party(who, id)
            },
            _ => false,
        }
    }
    
    fn apply_decision(domain: [u8; 8], id: u64, decision: Decision) -> DispatchResult {
        match domain {
            b"stardust/otc_order" => {
                pallet_otc_order::Pallet::<Runtime>::apply_arbitration(id, decision)
            },
            b"stardust/simple_bridge" => {
                pallet_simple_bridge::Pallet::<Runtime>::apply_arbitration(id, decision)
            },
            _ => Err(DispatchError::Other("Unknown domain")),
        }
    }
}
```

## 📦 存储结构

### 争议登记
```rust
pub type Disputed<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    [u8; 8],      // domain
    Blake2_128Concat,
    u64,          // object_id
    (),
    OptionQuery,
>;
```
- **Key1**：业务域标识
- **Key2**：业务对象ID
- **Value**：() 标记存在

### 证据引用列表
```rust
pub type EvidenceIds<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    [u8; 8],      // domain
    Blake2_128Concat,
    u64,          // object_id
    BoundedVec<u64, T::MaxEvidence>,
    ValueQuery,
>;
```
- **Key1**：业务域标识
- **Key2**：业务对象ID
- **Value**：证据ID列表（引用pallet-evidence中的证据）

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config + pallet_escrow::pallet::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 单案件最多关联的证据数
    type MaxEvidence: Get<u32>;

    /// CID最大长度
    type MaxCidLen: Get<u32>;

    /// 托管接口（调用释放/退款）
    type Escrow: EscrowTrait<Self::AccountId, BalanceOf<Self>>;

    /// 权重信息
    type WeightInfo: weights::WeightInfo;

    /// 域路由（将裁决路由到业务pallet）
    type Router: ArbitrationRouter<Self::AccountId>;

    /// 裁决权限（Root或委员会阈值）
    type DecisionOrigin: EnsureOrigin<Self::RuntimeOrigin>;
}
```

## 📡 可调用接口

### 用户接口

#### 1. dispute - 发起争议（旧版）
```rust
#[pallet::call_index(0)]
pub fn dispute(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence: Vec<BoundedVec<u8, T::MaxCidLen>>,
) -> DispatchResult
```

**权限**：任意签名账户（需通过Router.can_dispute校验）

#### 2. dispute_with_evidence_id - 发起争议（推荐）
```rust
#[pallet::call_index(2)]
pub fn dispute_with_evidence_id(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> DispatchResult
```

**权限**：任意签名账户（需通过Router.can_dispute校验）

#### 3. append_evidence - 追加证据
```rust
#[pallet::call_index(3)]
pub fn append_evidence(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> DispatchResult
```

**功能**：为已存在的争议案件追加新证据

### 治理接口

#### 4. arbitrate - 委员会裁决
```rust
#[pallet::call_index(1)]
pub fn arbitrate(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    decision_code: u8,
    bps: Option<u16>,
) -> DispatchResult
```

**权限**：DecisionOrigin（Root或委员会阈值）

**裁决代码**：
- `0`: Release（全额放款）
- `1`: Refund（全额退款）
- `2`: Partial（部分放款，bps指定比例）

## 🎉 事件

### Disputed - 争议发起事件
```rust
Disputed {
    domain: [u8; 8],
    id: u64,
}
```

**触发时机**：用户成功发起争议时

### Arbitrated - 裁决完成事件
```rust
Arbitrated {
    domain: [u8; 8],
    id: u64,
    decision: u8,
    bps: Option<u16>,
}
```

**触发时机**：委员会成功执行裁决时

## ❌ 错误处理

### AlreadyDisputed
- **说明**：该对象已经在争议中
- **触发**：重复发起争议

### NotDisputed
- **说明**：该对象未在争议中
- **触发**：
  - 对未争议对象执行裁决
  - can_dispute返回false

## 🔌 使用示例

### 场景1：OTC订单争议

```rust
// 1. 买家提交证据
let imgs = vec![b"QmXXX...".to_vec()];
let vids = vec![];
let docs = vec![];
let memo = b"Seller didn't transfer".to_vec();

let evidence_id = pallet_evidence::Pallet::<T>::commit(
    origin.clone(),
    b"otc_order",  // domain namespace
    order_id,      // target_id
    imgs,
    vids,
    docs,
    memo,
)?;

// 2. 买家发起争议
pallet_arbitration::Pallet::<T>::dispute_with_evidence_id(
    origin,
    *b"stardust/otc_order",  // domain
    order_id,
    evidence_id,
)?;

// 3. 卖家追加反证
let counter_evidence_id = pallet_evidence::Pallet::<T>::commit(
    seller_origin.clone(),
    b"otc_order",
    order_id,
    vec![b"QmYYY...".to_vec()],  // 转账截图
    vec![],
    vec![],
    b"I already transferred".to_vec(),
)?;

pallet_arbitration::Pallet::<T>::append_evidence(
    seller_origin,
    *b"stardust/otc_order",
    order_id,
    counter_evidence_id,
)?;

// 4. 委员会裁决（假设卖家胜诉）
let collective_origin = /* 委员会多签 */;
pallet_arbitration::Pallet::<T>::arbitrate(
    collective_origin,
    *b"stardust/otc_order",
    order_id,
    0,     // Release
    None,
)?;

// 5. OTC Pallet应用裁决
impl OtcOrder {
    pub fn apply_arbitration(id: u64, decision: Decision) -> DispatchResult {
        let order = Orders::<T>::get(id)?;
        match decision {
            Decision::Release => {
                // 释放给卖家
                T::Escrow::release_all(id, &order.seller)?;
                // 更新状态
                Orders::<T>::mutate(id, |o| o.status = OrderStatus::Completed);
                // 扣买家信用分（恶意争议）
                T::BuyerCredit::penalize_malicious_dispute(&order.buyer)?;
            },
            Decision::Refund => {
                // 退款给买家
                T::Escrow::refund_all(id, &order.buyer)?;
                // 更新状态
                Orders::<T>::mutate(id, |o| o.status = OrderStatus::Refunded);
                // 扣卖家信用分
                T::MakerCredit::record_dispute_result(order.maker_id, id, false)?;
            },
            Decision::Partial(bps) => {
                // 部分放款
                let total = T::Escrow::amount_of(id);
                let seller_amount = total * bps / 10000;
                T::Escrow::transfer_from_escrow(id, &order.seller, seller_amount)?;
                T::Escrow::refund_all(id, &order.buyer)?;
            },
        }
        Ok(())
    }
}
```

### 场景2：Bridge争议

```rust
// 1. 用户发起桥接
let bridge_id = pallet_simple_bridge::Pallet::<T>::create_bridge(
    origin.clone(),
    asset_id,
    amount,
    target_chain,
    target_address,
)?;

// 2. 超时未收到币，发起争议
let evidence_id = pallet_evidence::Pallet::<T>::commit(
    origin.clone(),
    b"bridge",
    bridge_id,
    vec![],  // 钱包截图
    vec![],
    vec![],
    b"Timeout, no transfer received".to_vec(),
)?;

pallet_arbitration::Pallet::<T>::dispute_with_evidence_id(
    origin,
    *b"stardust/simple_bridge",
    bridge_id,
    evidence_id,
)?;

// 3. 做市商提交转账证明
let maker_evidence_id = pallet_evidence::Pallet::<T>::commit(
    maker_origin.clone(),
    b"bridge",
    bridge_id,
    vec![b"QmTxHash...".to_vec()],  // 链上交易hash
    vec![],
    vec![],
    b"Transaction hash: 0xABC123...".to_vec(),
)?;

pallet_arbitration::Pallet::<T>::append_evidence(
    maker_origin,
    *b"stardust/simple_bridge",
    bridge_id,
    maker_evidence_id,
)?;

// 4. 委员会查链验证后裁决（做市商胜诉）
pallet_arbitration::Pallet::<T>::arbitrate(
    collective_origin,
    *b"stardust/simple_bridge",
    bridge_id,
    0,     // Release
    None,
)?;
```

## 🛡️ 安全机制

### 1. 权限控制

- **发起争议**：通过Router.can_dispute校验（买家/卖家/做市商）
- **裁决执行**：仅DecisionOrigin（Root或委员会阈值）
- **证据追加**：任意当事人（可配置）

### 2. 防止重复争议

- 每个(domain, id)只能争议一次
- 通过Disputed存储标记
- AlreadyDisputed错误防止重放

### 3. 域隔离

- 不同业务域互不干扰
- 8字节域标识符唯一性
- Router统一路由逻辑

### 4. 证据管理

- 证据CID上链（不可篡改）
- 证据内容存IPFS（去中心化）
- 支持私有证据（加密存储）
- 支持访问控制（仅当事人/委员会可见）

### 5. 裁决审计

- 所有裁决触发Arbitrated事件
- 链上可追溯裁决历史
- 委员会投票记录上链（通过collective）

## 📊 工作流程图

### 完整争议流程

```text
OTC订单/Bridge订单
   ↓
买家/用户发现问题
   ↓
提交证据到 pallet-evidence
   ← 获得 evidence_id
   ↓
发起争议 dispute_with_evidence_id()
   ↓ 登记争议状态
卖家/做市商反驳
   ↓
追加反证 append_evidence()
   ↓
委员会审查证据
   ├─ 查看所有evidence_id关联的证据
   ├─ 链上验证（交易hash等）
   └─ 委员会投票
   ↓
投票通过，执行裁决 arbitrate()
   ├─ Release → 做市商/卖家胜诉
   ├─ Refund → 买家/用户胜诉
   └─ Partial → 部分胜诉
   ↓ 调用 Router::apply_decision()
业务Pallet应用裁决
   ├─ 调用Escrow释放/退款
   ├─ 更新订单/桥接状态
   └─ 更新信用分
```

## 📝 最佳实践

### 1. 域标识符设计

- 使用8字节固定长度
- 建议与PalletId对齐
- 示例：`*b"stardust/otc_order"`, `*b"stardust/simple_bridge"`

### 2. 证据管理

- ✅ 优先使用 `dispute_with_evidence_id`
- ✅ 先提交证据，再发起争议
- ✅ 证据内容存储IPFS，CID上链
- ✅ 敏感证据使用私有模式（加密）

### 3. 裁决标准

- 查看所有证据（evidence_id列表）
- 链上验证（交易hash、区块高度等）
- 委员会多数投票通过
- 记录裁决理由（可通过collective proposal memo）

### 4. 信用分联动

- Release裁决：扣争议发起方信用分
- Refund裁决：扣争议被诉方信用分
- Partial裁决：双方都轻微扣分

### 5. 监控指标

- 争议发起率（Disputed事件数）
- 裁决完成率（Arbitrated事件数）
- 裁决分布（Release/Refund/Partial比例）
- 平均裁决时长

## 🔗 相关模块

- **pallet-escrow**: 托管服务（应用裁决，释放/退款资金）
- **pallet-evidence**: 证据管理（存储证据CID和内容）
- **pallet-otc-order**: OTC订单管理（争议来源之一）
- **pallet-simple-bridge**: 桥接服务（争议来源之一）
- **pallet-maker-credit**: 做市商信用（裁决后更新信用分）
- **pallet-buyer-credit**: 买家信用（裁决后更新信用分）
- **pallet-collective**: 委员会治理（裁决投票）

## 📚 参考资源

- [仲裁系统架构设计](../../docs/arbitration-architecture.md)
- [证据管理集成指南](../../docs/evidence-integration-guide.md)
- [委员会投票流程](../../docs/collective-voting-guide.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Stardust 开发团队
